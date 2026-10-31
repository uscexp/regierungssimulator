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

/** Ein Beschluss-Delta auf einen Snapshot-Zielbereich. Die Werte kommen aus Content-Karten (M3). */
export interface Effekt {
  readonly ziel:
    | 'indikatoren'
    | 'gruppen'
    | 'legitimitaet'
    | 'radikalisierung'
    | 'politisches_kapital'
    | 'budget';
  readonly tag?: IndikatorTag | GruppenTag;
  readonly delta: number;
}

/**
 * Ein aktiver Beschluss im Entscheidungsgedächtnis (FR-006, US-M0-08). `wirkt_bis_jahr` ist
 * inklusive — ein Beschluss in Jahr 1 mit Dauer 3 wirkt bis Jahr 3 und fällt am Jahresende von
 * Jahr 3 aus dem Snapshot. Der Bestand ist Teil des Golden-Replay-Hashes (US-M0-16).
 */
export interface AktiverBeschluss {
  readonly regel_id: string;
  readonly wirkung: readonly Effekt[];
  readonly wirkdauer_jahre: number;
  readonly wirkt_bis_jahr: number;
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

/**
 * Die Setup-Phase vor Turn 1 (US-M1-02, Verdikt D22): die gewählte Regierungsform und die Ids der
 * Konstitutions-Entscheidungen. **Optional** — ein Start ohne Setup serialisiert den Key nicht, damit
 * die kanonische M0-Serialisierung bitgleich bleibt (Haui-Ruling: Replay/Spread/Kurven ohne Diff).
 */
export interface SetupPhase {
  readonly regierungsform: 'praesidential' | 'parlamentarisch' | 'diktatur';
  readonly konstitutions_ids: readonly string[];
}

/** Das Entscheidungsgedächtnis ist Teil des Snapshots; ein verlorener Machtcheck wird ebenfalls gespeichert. */
export interface WahlNiederlage {
  readonly jahr: number;
  readonly grund_id: string;
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
  /** Setup-Phase vor Turn 1 (US-M1-02/D22); fehlt bei einem Start ohne Setup — Key wird dann nicht serialisiert. */
  readonly setup?: SetupPhase;
  readonly zufriedenheits_trace: Readonly<Record<GruppenTag, readonly DeltaGrund[]>>;
  /** Entscheidungsgedächtnis (FR-006, US-M0-08) — Beschlüsse, die noch wirken. */
  readonly beschlüsse: readonly AktiverBeschluss[];
  /** Verlorener Machtcheck (US-M0-12) — gesetzt, wenn eine Wahl verloren wurde; der CLI zeigt das Spielende. */
  readonly wahl_niederlage?: WahlNiederlage;
}

/** Aktuelle Schema-Version des Snapshots; Migrationen hängen daran (ADR-005, save.ts ab M6). */
export const SCHEMA_VERSION = 1;

/**
 * Alles, was ein Start-State braucht. Das Entscheidungsgedächtnis ist optional — ein Start ist
 * immer leer, und `erzeugeGameState` schreibt das leere Array, damit der Snapshot überall
 * denselben Shape hat (Save-Roundtrip, ADR-005).
 */
export type Startkonfiguration = Omit<GameState, 'schema_version' | 'beschlüsse'> & {
  readonly beschlüsse?: readonly AktiverBeschluss[];
};

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
  // NaN-State erzeugen, den erst der Invariant-Check nach dem ersten Tick sähe (FR-002). Die
  // Untergrenze gehört auch zum Start: eine negative Allokation ist kein Spielzustand, sondern
  // kaputte Eingabe — der Tick-Invariant prüft dieselbe Regel, darf sie aber nicht als Erste sehen.
  for (const [tag, wert] of Object.entries(konfiguration.budget)) {
    if (!Number.isFinite(wert))
      throw new TypeError(`Start-State: Budget "${tag}" ist nicht endlich`);
    if (wert < 0) throw new TypeError(`Start-State: Budget "${tag}" ist negativ (wert=${wert})`);
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

  for (const beschluss of konfiguration.beschlüsse ?? []) {
    for (const effekt of beschluss.wirkung) {
      if (!Number.isFinite(effekt.delta) || !Number.isFinite(beschluss.wirkt_bis_jahr)) {
        throw new TypeError(
          `Start-State: Beschluss "${beschluss.regel_id}" hat nicht-endliche Werte`,
        );
      }
    }
  }

  return freezeSnapshot({
    ...konfiguration,
    beschlüsse: konfiguration.beschlüsse ?? [],
    schema_version: SCHEMA_VERSION,
  }) as GameState;
}
