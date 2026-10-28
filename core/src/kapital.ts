/**
 * core/kapital — Politisches Kapital als Engpass (FR-004, US-M0-09, Konzept §4).
 *
 * PK ist der eigentliche Engpass, nicht das Budget: eine Karte kostet 1–3 PK und am Jahresende
 * regeneriert `legitimität / 10 × Schwierigkeitsfaktor` (balance-werte.md §5, Minimum 1, Max 12).
 * Damit sind bei Legitimität 50 pro Jahr 2–5 Karten spielbar — genau das, was US-M3-12 verlangt.
 *
 * Der Kern kennt keine Karten: die Kosten kommen als Zahl aus Content (M3). Ein illegaler Einsatz
 * (Kosten > PK, Kosten außerhalb 1–3) wird mit Regel-Id abgewiesen — die UI/CLI prüft vorher mit
 * `karteWählbar`, der Kern ist die letzte Instanz.
 */
import { PK_MAX } from './invariant.js';
import type { SchwierigkeitsPack } from './indikatoren.js';
import type { GameState } from './state.js';

/**
 * Die Obergrenze des Politischen Kapitals liegt bei 12 und ist in `core/invariant` definiert —
 * die einzige Instanz, damit der Clamp und die Regel-Id dieselbe Zahl lesen (Konzept §4,
 * balance-werte.md §5). Dieses Modul exportiert sie nicht doppelt.
 */

/** Kartenkosten liegen im Content-Definitionsbereich 1–3 (balance-werte.md §5). */
export const PK_KOSTEN_MIN = 1;
export const PK_KOSTEN_MAX = 3;

/** Regeneration am Jahresende: Legitimität/10 × Faktor, mindestens 1 (bei Legitimität 0 bleibt 1). */
export function pkRegeneration(legitimitaet: number, schwierigkeit: SchwierigkeitsPack): number {
  if (!Number.isFinite(legitimitaet)) {
    throw new TypeError(`PK-Regeneration: Legitimität ist nicht endlich (${String(legitimitaet)})`);
  }
  const regen = (legitimitaet / 10) * schwierigkeit.pk_regeneration;
  return Math.max(1, regen);
}

/** Wendet die Jahresend-Regeneration an und begrenzt auf PK_MAX — der alte Snapshot bleibt unverändert. */
export function pkRegenerieren(state: GameState, schwierigkeit: SchwierigkeitsPack): GameState {
  const roh = state.politisches_kapital + pkRegeneration(state.legitimitaet, schwierigkeit);
  if (!Number.isFinite(roh)) {
    throw new TypeError(`PK-Regeneration: Ergebnis ist nicht endlich (${String(roh)})`);
  }
  // PK hat seine eigene Obergrenze (12), nicht die Level-Grenze 0–100 aus core/invariant.
  const neu = Math.min(PK_MAX, Math.max(0, roh));
  return Object.freeze({ ...state, politisches_kapital: neu }) as GameState;
}

/**
 * Prüft, ob eine Karte jetzt spielbar ist. Die Vorhersage und der CLI nutzen denselben Kern wie
 * der Tick (ADR-009) — es gibt keine zweite Regel, die "nicht wählbar" definiert.
 */
export function karteWählbar(state: GameState, kosten: number): boolean {
  return kosten >= PK_KOSTEN_MIN && kosten <= PK_KOSTEN_MAX && state.politisches_kapital >= kosten;
}

/**
 * Verbraucht PK für eine Karte. Ein Einsatz über dem Bestand oder außerhalb der Kosten-Spanne ist
 * ein illegaler Action und wird mit Regel-Id abgewiesen (FR-002); der Snapshot wird nicht mutiert.
 */
export function pkAusgeben(state: GameState, kosten: number, regel_id: string): GameState {
  if (!Number.isFinite(kosten)) {
    throw new TypeError(`PK-Einsatz "${regel_id}": Kosten sind nicht endlich (${String(kosten)})`);
  }
  if (kosten < PK_KOSTEN_MIN || kosten > PK_KOSTEN_MAX) {
    throw new TypeError(
      `PK-Einsatz "${regel_id}": Kosten ${kosten} liegen außerhalb ${PK_KOSTEN_MIN}–${PK_KOSTEN_MAX}`,
    );
  }
  if (state.politisches_kapital < kosten) {
    throw new TypeError(
      `PK-Einsatz "${regel_id}": nicht wählbar — PK ${state.politisches_kapital} < Kosten ${kosten}`,
    );
  }

  return Object.freeze({
    ...state,
    politisches_kapital: state.politisches_kapital - kosten,
  }) as GameState;
}
