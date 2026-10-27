/**
 * core/rng — seedbarer Zufall im GameState statt global (FR-004, US-M0-03, ADR-002/ADR-009).
 *
 * mulberry32 wird über (seed, counter) determiniert statt über einen mutierenden Generator.
 * Der RNG-Zustand liegt damit im Snapshot, ist serialisierbar und kein globaler Stream kann
 * nebenbei verbraucht werden — derselbe Seed + dieselbe Action-Folge ⇒ derselbe Verlauf.
 *
 * Für Vorhersagen (ADR-009) wird später ein Fork über einen eigenen Substream gebaut; der echte
 * Stream darf dabei nicht verbraucht werden. Das ist S0-B, nicht diese Story.
 */
import type { RngState } from './state.js';

/** Standard-Multiplikator von mulberry32. */
const DELTA = 0x6d2b79f5;

/** Normalisiert einen Seed auf int32, damit ein Float-Seed denselben Verlauf wie sein ganzzahliger Anteil hat. */
export function erzeugeRngState(seed: number): RngState {
  if (!Number.isFinite(seed))
    throw new TypeError(`RNG-Seed ist nicht endlich (wert=${String(seed)})`);
  return Object.freeze({ seed: seed | 0, counter: 0 });
}

/**
 * Der Wert des **nächsten** Draws, ohne den State zu verbrauchen — identisch zur kanonischen
 * mulberry32-Folge für denselben Seed (a_i = seed + (i+1)·DELTA, i = counter).
 */
export function rngWert(state: RngState): number {
  const a = (state.seed + (state.counter + 1) * DELTA) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), 29 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Zieht einen Wert in [0, 1) und gibt den **fortgeschrittenen** State zurück. Der Eingangs-State
 * wird nicht mutiert (ADR-002 — der Tick arbeitet auf Snapshots).
 */
export function nextFloat(state: RngState): { readonly wert: number; readonly rng: RngState } {
  const wert = rngWert(state);
  return Object.freeze({
    wert,
    rng: Object.freeze({ seed: state.seed, counter: state.counter + 1 }),
  });
}

/** Ganzzahl in [0, grenze) — für WahlWürfe, Event-Wahrscheinlichkeiten und Sampling. */
export function nextInt(
  state: RngState,
  grenze: number,
): { readonly wert: number; readonly rng: RngState } {
  if (!Number.isInteger(grenze) || grenze <= 0) {
    throw new TypeError(`RNG-Grenze muss eine positive Ganzzahl sein (wert=${String(grenze)})`);
  }
  const { wert, rng } = nextFloat(state);
  return Object.freeze({ wert: Math.floor(wert * grenze), rng });
}

/**
 * Wahrscheinlichkeitswurf gegen eine Wahrscheinlichkeit 0–1.
 * Die Regel-ID wird mitgegeben, damit ein Fehler im Invariant-Check die Regel benennen kann (FR-002).
 */
export function würfele(
  state: RngState,
  wahrscheinlichkeit: number,
  regelId: string,
): { readonly eingetreten: boolean; readonly rng: RngState } {
  if (!(wahrscheinlichkeit >= 0 && wahrscheinlichkeit <= 1)) {
    throw new TypeError(
      `Wahrscheinlichkeit außerhalb 0–1 für Regel "${regelId}" (wert=${String(wahrscheinlichkeit)})`,
    );
  }
  const { wert, rng } = nextFloat(state);
  return Object.freeze({ eingetreten: wert < wahrscheinlichkeit, rng });
}
