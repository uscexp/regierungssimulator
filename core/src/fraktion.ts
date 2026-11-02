/** @staatslenker/core/fraktion — Fraktionen als abgeleitete View (US-M1-07, FR-016, G3/§3a).
 *
 * Fraktionen sind **kein persistenter State**, sondern eine pure View-Funktion aus
 * Gruppenzufriedenheit + Konstitution. Sie werden im Tick zur Mehrheitprüfung berechnet
 * und nicht gespeichert (deterministisch, replaybar, State bleibt klein).
 *
 * Jede Gruppe mit Zufriedenheit ≥ 50 unterstützt ein Gesetz. Die Fraktions-Support-Summe
 * ist die Summe der Bevölkerungsanteile der unterstützenden Gruppen geteilt durch 100
 * (Anteil 0–1). Ein Gesetz braucht `mehrheit` Anteil (z. B. 0.5 = 50%).
 */

import type { GruppenSnapshot } from './state.js';

/** Berechnet die Fraktions-Support-Summe als Anteil 0–1.
 *
 * Jede Gruppe mit Zufriedenheit ≥ 50 unterstützt das Gesetz.
 * Die Unterstützung ist Σ Bevölkerungsanteil der unterstützenden Gruppen / 100.
 */
export function berechneFraktionSupport(gruppen: readonly GruppenSnapshot[]): number {
  let support = 0;
  for (const gruppe of gruppen) {
    if (gruppe.zufriedenheit >= 50) {
      support += gruppe.bevölkerungsanteil / 100;
    }
  }
  return Math.min(1, Math.max(0, support));
}

/** Prüft ob ein Gesetz eine Mehrheit hat (FR-016).
 *
 * Unterstützt >= mehrheit ⇒ Gesetz wird angenommen.
 * Unterstützt < mehrheit ⇒ Gesetz wird abgelehnt.
 */
export function pruefeGesetzesMehrheit(fraktionSupport: number, mehrheit: number): boolean {
  return fraktionSupport >= mehrheit;
}
