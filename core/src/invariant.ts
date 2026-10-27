/**
 * core/invariant — Clamp auf 0–100 an allen Effekten und der Invariant-Check nach jedem Tick
 * (FR-002, US-M0-04, Architektur §5, NFR-002).
 *
 * Zwei Grenzen, bewusst getrennt:
 *  - **Level-Werte** (Indikatoren, Gruppenzufriedenheit, Legitimität, Extremismus) leben in 0–100.
 *  - **Wirtschafts-Werte** (Budget, Schulden in BE, politisches Kapital) sind keine Level — sie
 *    haben eigene Grenzen (PK ≤ 12, Schulden ≥ 0) und werden nicht auf 0–100 geclampt.
 *
 * Dev-Modus bricht mit Regel-ID im Log; Produktionsmodus crasht das Spiel nie — eine kaputte
 * Regel wird als Verletzung gemeldet und der Wert bleibt auf dem sicheren Stand (Architektur §5).
 */
import type { GameState } from './state.js';

export const LEVEL_MIN = 0;
export const LEVEL_MAX = 100;
/** Politisches Kapital ist kein Level — Obergrenze aus balance-werte.md §2 (PK-Maximum 12). */
export const PK_MAX = 12;

/** Laufmodus: dev bricht, produktion meldet nur. */
export type Modus = 'dev' | 'produktion';

/** Fehler mit Regel-ID, damit eine kaputte Regel im Log benannt wird (FR-002). */
export class InvariantError extends Error {
  readonly regel_id: string;
  readonly wert: unknown;

  constructor(message: string, regel_id: string, wert: unknown) {
    super(message);
    this.name = 'InvariantError';
    this.regel_id = regel_id;
    this.wert = wert;
  }
}

/** Begrenzt einen Level-Wert auf 0–100; nicht-endliche Werte werden nicht durchgereicht. */
export function clampLevel(wert: number): number {
  if (!Number.isFinite(wert)) throw new TypeError('clampLevel: Wert ist nicht endlich');
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, wert));
}

/**
 * Wendet ein Effekte-Delta auf einen Level-Wert an und clampt das Ergebnis.
 * `regel_id` stammt aus dem Regelsatz und landet im Fehlerfall im Log.
 */
export function effektAnwenden(
  basis: number,
  delta: number,
  regel_id: string,
  modus: Modus,
): number {
  if (!Number.isFinite(basis)) {
    if (modus === 'dev')
      throw new InvariantError(`Basis nicht endlich für Regel "${regel_id}"`, regel_id, basis);
    return LEVEL_MIN;
  }

  if (!Number.isFinite(delta)) {
    if (modus === 'dev') {
      throw new InvariantError(
        `Delta nicht endlich für Regel "${regel_id}" (wert=${String(delta)})`,
        regel_id,
        delta,
      );
    }
    // Produktionsmodus: kaputte Regel darf das Spiel nicht crashen — der Wert bleibt unverändert.
    return clampLevel(basis);
  }

  return clampLevel(basis + delta);
}

/** Eine Invariant-Verletzung: Feld, erwartete Grenze, tatsächlicher Wert und Regel-ID (falls bekannt). */
export interface Verletzung {
  readonly feld: string;
  readonly grenze: string;
  readonly wert: unknown;
  readonly regel_id?: string;
}

/** Menschenlesbare Zeile für Log/News-Feed. */
export function verletzungText(v: Verletzung): string {
  return `${v.feld}=${String(v.wert)} verletzt ${v.grenze}${v.regel_id ? ` (Regel "${v.regel_id}")` : ''}`;
}

/** Prüft einen Snapshot gegen alle Grenzen. Im Dev-Modus wird die erste Verletzung geworfen. */
export function pruefeInvarianten(state: GameState, modus: Modus, regel_id?: string): Verletzung[] {
  const verletzungen: Verletzung[] = [];

  const pruefeLevel = (feld: string, wert: number): void => {
    if (!Number.isFinite(wert)) {
      verletzungen.push({ feld: feld, grenze: 'endlich', wert, regel_id });
      return;
    }
    if (wert < LEVEL_MIN || wert > LEVEL_MAX) {
      verletzungen.push({ feld: feld, grenze: `${LEVEL_MIN}–${LEVEL_MAX}`, wert, regel_id });
    }
  };

  for (const [tag, wert] of Object.entries(state.indikatoren)) {
    pruefeLevel(`indikator:${tag}`, wert);
  }

  for (const gruppe of state.gruppen) {
    pruefeLevel(`gruppe:${gruppe.tag}.zufriedenheit`, gruppe.zufriedenheit);
    if (
      !Number.isFinite(gruppe.bevölkerungsanteil) ||
      gruppe.bevölkerungsanteil < 0 ||
      gruppe.bevölkerungsanteil > 100
    ) {
      verletzungen.push({
        feld: `gruppe:${gruppe.tag}.bevölkerungsanteil`,
        grenze: '0–100',
        wert: gruppe.bevölkerungsanteil,
        regel_id,
      });
    }
  }

  pruefeLevel('legitimitaet', state.legitimitaet);
  pruefeLevel('radikalisierung', state.radikalisierung);

  if (
    !Number.isFinite(state.politisches_kapital) ||
    state.politisches_kapital < 0 ||
    state.politisches_kapital > PK_MAX
  ) {
    verletzungen.push({
      feld: 'politisches_kapital',
      grenze: `0–${PK_MAX}`,
      wert: state.politisches_kapital,
      regel_id,
    });
  }

  if (!Number.isFinite(state.schulden) || state.schulden < 0) {
    verletzungen.push({ feld: 'schulden', grenze: '≥ 0', wert: state.schulden, regel_id });
  }

  if (!Number.isInteger(state.jahr) || state.jahr < 1) {
    verletzungen.push({ feld: 'jahr', grenze: 'Ganzzahl ≥ 1', wert: state.jahr, regel_id });
  }

  for (const [name, wert] of Object.entries(state.budget)) {
    if (!Number.isFinite(wert) || wert < 0) {
      verletzungen.push({ feld: `budget:${name}`, grenze: '≥ 0', wert, regel_id });
    }
  }

  if (modus === 'dev' && verletzungen.length > 0) {
    const erste = verletzungen[0]!;
    throw new InvariantError(
      `Invariant-Check nach Tick: ${verletzungText(erste)}`,
      erste.regel_id ?? 'tick',
      erste.wert,
    );
  }

  return verletzungen;
}
