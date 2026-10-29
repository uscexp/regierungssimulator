/**
 * core/state — unveränderlicher Spielzustand (FR-001, US-M0-02, ADR-002/ADR-005/ADR-008).
 *
 * Der Turn ist eine Snapshot-Funktion: `tick` erzeugt einen neuen State, mutiert nie den alten.
 * Deshalb ist der Typ durchgehend readonly und der Snapshot wird tief eingefroren.
 *
 * Indikatoren und Gruppen sind **tag-getrieben**: das Set ist Content (`indikators`-Regel, M4),
 * nicht Kern. Der Kern kennt keine festen Indikatornamen, das Dashboard rendert N Gauges dynamisch.
 *
 * Im State steht nur persistent Kern-Zustand. Alles Ableitbare (Fraktionen, Berater-Text,
 * News-Varianten) ist eine pure View-Funktion und wird nicht gespeichert (§3a G3/G5/G11).
 */

/** Tag eines Indikators, z. B. "bildung". Das Set kommt aus Content, nicht aus dem Kern. */
export type IndikatorTag = string;

/** Tag einer Bevölkerungsgruppe, z. B. "arbeitnehmer". */
export type GruppenTag = string;

/**
 * Einer der Top-2 Delta-Gründe je Gruppe (ADR-008). Der Tick schreibt ihn, die UI rendert ihn nur —
 * der Tooltip "Wer ist sauer und warum?" ist damit reine Render-Arbeit und Teil des Golden-Hash.
 */
export interface DeltaGrund {
  readonly grund_id: string;
  readonly delta: number;
}

/** Eine Bevölkerungsgruppe. `gewichte` ist die Indikator-Gewicht-Matrix der Gruppe (Σ = 1). */
export interface GruppenSnapshot {
  readonly tag: GruppenTag;
  /** Zufriedenheit 0–100. */
  readonly zufriedenheit: number;
  /** Anteil der Bevölkerung in Prozent (Gruppe-Gewicht für die gewichtete Ø-Zufriedenheit). */
  readonly bevölkerungsanteil: number;
  readonly gewichte: Readonly<Record<IndikatorTag, number>>;
}

/**
 * Seedbarer RNG im State statt global (FR-004, US-M0-03). mulberry32 wird über (seed, counter)
 * determiniert, damit der Zustand serialisierbar ist und kein globaler Generator existiert.
 */
export interface RngState {
  readonly seed: number;
  readonly counter: number;
}

/** Konstitution als Regel-Id → Wert. Startet leer und wird in M1 per Setup-Phase gefüllt. */
export interface Konstitution {
  readonly [regel_id: string]: string | boolean;
}

/** Der vollständige Spielzustand eines Jahres — klein (< ~12 KB, ADR-008) und vollständig serialisierbar. */
export interface GameState {
  /** Schema-Version für Save-Migrationen (ADR-005). */
  readonly schema_version: number;
  readonly jahr: number;
  readonly indikatoren: Readonly<Record<IndikatorTag, number>>;
  readonly gruppen: readonly GruppenSnapshot[];
  /** Budget je Indikator-Kategorie in BE; Einnahmen und Defizit rechnen in BE, nicht 0–100. */
  readonly budget: Readonly<Record<IndikatorTag, number>>;
  /** Politisches Kapital 0–12 — der eigentliche Engpass (Konzept §4). */
  readonly politisches_kapital: number;
  /** Legitimität 0–100. */
  readonly legitimitaet: number;
  /** Schulden in BE, ≥ 0; das Limit ist Content/Schwierigkeit, nicht Kern. */
  readonly schulden: number;
  /** Extremismus-Anteil 0–100 (Radikalisierungskurve, Konzept §2C). */
  readonly radikalisierung: number;
  readonly rng: RngState;
  readonly konstitution: Konstitution;
  readonly zufriedenheits_trace: Readonly<Record<GruppenTag, readonly DeltaGrund[]>>;
}

/** Aktuelle Schema-Version des Snapshots; Migrationen hängen daran (ADR-005, save.ts ab M6). */
export const SCHEMA_VERSION = 1;

/** Alles, was ein Start-State braucht — die Felder eines GameState ohne Schema-Version. */
export type Startkonfiguration = Omit<GameState, 'schema_version'>;

/** Tiefes Einfrieren eines Snapshot-Werts. Der Kern erzeugt keine mutierbaren Objekte. */
export function freezeSnapshot<T>(wert: T): T {
  if (wert && typeof wert === 'object') {
    for (const kind of Object.keys(wert)) {
      freezeSnapshot((wert as Record<string, unknown>)[kind]);
    }
    return Object.freeze(wert);
  }
  return wert;
}

/**
 * Erzeugt einen frisch eingefrorenen Start-State.
 * Die Felder werden abgefragt (AC US-M0-02); nicht-numerische oder nicht-endliche Werte werden
 * abgewiesen, damit ein kaputter Start nie einen NaN-State erzeugt (FR-002, detailiert in core/invariant).
 */
export function erzeugeGameState(konfiguration: Startkonfiguration): GameState {
  const numerischeFelder: Array<keyof Startkonfiguration> = [
    'jahr',
    'politisches_kapital',
    'legitimitaet',
    'schulden',
    'radikalisierung',
  ];

  for (const feld of numerischeFelder) {
    const wert = konfiguration[feld];
    if (typeof wert !== 'number' || !Number.isFinite(wert)) {
      throw new TypeError(`Start-State: Feld "${feld}" ist nicht endlich (wert=${String(wert)})`);
    }
  }

  for (const [tag, wert] of Object.entries(konfiguration.indikatoren)) {
    if (!Number.isFinite(wert))
      throw new TypeError(`Start-State: Indikator "${tag}" ist nicht endlich`);
  }

  // Das Budget ist ein Zahlen-Record wie die Indikatoren: ein NaN-Budget würde sonst einen
  // NaN-State erzeugen, den erst der Invariant-Check nach dem ersten Tick sähe (FR-002).
  for (const [tag, wert] of Object.entries(konfiguration.budget)) {
    if (!Number.isFinite(wert))
      throw new TypeError(`Start-State: Budget "${tag}" ist nicht endlich`);
  }

  for (const gruppe of konfiguration.gruppen) {
    if (!Number.isFinite(gruppe.zufriedenheit) || !Number.isFinite(gruppe.bevölkerungsanteil)) {
      throw new TypeError(`Start-State: Gruppe "${gruppe.tag}" hat nicht-endliche Werte`);
    }
    for (const [tag, gewicht] of Object.entries(gruppe.gewichte)) {
      if (!Number.isFinite(gewicht))
        throw new TypeError(
          `Start-State: Gruppe "${gruppe.tag}" Gewicht "${tag}" ist nicht endlich`,
        );
    }
  }

  if (!Number.isFinite(konfiguration.rng.seed) || !Number.isFinite(konfiguration.rng.counter)) {
    throw new TypeError(
      'Start-State: RNG-Zustand muss seed und counter als endliche Zahlen enthalten',
    );
  }

  return freezeSnapshot({ ...konfiguration, schema_version: SCHEMA_VERSION }) as GameState;
}
