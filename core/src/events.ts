/** @staatslenker/core/events — Event-Registry mit typisierten Prädikaten (US-M2-02, FR-025).
 *
 * Eine Event-Registry prüft Bedingungen (typisierte Prädikate aus US-M2-01) und würfelt mit
 * dem State-RNG (FR-004), ob das Ereignis ausgelöst wird. Datenergetrieben, deterministisch
 * und replaybar: gleicher Seed + gleiche Regeln = gleiche Ereignisse.
 *
 * Alle Funktionen sind rein: State wird nie mutiert, keine Nebenwirkungen.
 */

import { nextFloat } from './rng.js';
import { type Modus } from './invariant.js';
import { evalPrädikat, type Praedikat } from './eval.js';
import type { Effekt, GameState, RngState } from './state.js';

/**
 * Eine Event-Regel aus dem Content-Pack: Bedingung (typisiertes Prädikat), Auslösungs-
 * wahrscheinlichkeit und Effekte.
 */
export interface EreignisRegel {
  readonly id: string;
  readonly bedingung: Praedikat;
  readonly wahrscheinlichkeit: number;
  readonly effekte: readonly Effekt[];
}

/** Ein ausgelöstes Event — Identifier für News-Feed und Golden-Hash. */
export interface AusgelöstesEreignis {
  readonly ereignis_id: string;
  readonly effekte: readonly Effekt[];
}

/** Ergebnis der Ereignis-Registrierung: ausgelöste Ereignisse + fortgeschrittener RNG. */
export interface EreignisErgebnis {
  readonly ereignisse: readonly AusgelöstesEreignis[];
  readonly rng: RngState;
}

/**
 * Prüft ein einzelnes Prädikat gegen einen Spielzustand.
 * Delegiert an evalPrädikat aus core/eval (US-M2-01).
 */
export function ereignisPruefen(prädikat: Praedikat, state: GameState): boolean {
  return evalPrädikat(prädikat, state);
}

/**
 * Registriert Events für das aktuelle Jahr: prüft Bedingungen und würfelt mit dem State-RNG.
 *
 * Regeln werden in Reihenfolge abgearbeitet. Eine Regel wird nur geprüft, wenn ihre Bedingung
 * erfüllt ist. Bei erfüllter Bedingung wird mit Wahrscheinlichkeit `wahrscheinlichkeit` gewürfelt:
 *  - 1.0 → Ereignis immer ausgelöst (kein Wurf, RNG unverändert)
 *  - 0.0 → nie ausgelöst (kein Wurf, RNG unverändert)
 *  - 0 < p < 1 → ein Wurf mit dem State-RNG, ausgelöst bei Wurf < p
 *
 * Der RNG-Zustand wird durchgereicht und im Ergebnis zurückgegeben, damit der Tick ihn in den
 * Snapshot schreiben kann (FR-004: kein globaler Generator, deterministischer Replay).
 *
 * @param regeln — die zu prüfenden Event-Regeln
 * @param state — der aktuelle GameState
 * @param modus — 'dev' wirft bei kaputten Werten, 'produktion' läuft weiter (FR-002)
 * @returns ausgelöste Ereignisse + fortgeschrittener RNG
 */
export function eregistrierung(
  regeln: readonly EreignisRegel[],
  state: GameState,
  modus: Modus = 'dev',
): EreignisErgebnis {
  let rng = state.rng;
  const ereignisse: AusgelöstesEreignis[] = [];

  for (const regel of regeln) {
    // Bedingung prüfen (typisiertes Prädikat, keine String-Expression)
    if (!evalPrädikat(regel.bedingung, state)) continue;

    // Wahrscheinlichkeit validieren
    if (
      !Number.isFinite(regel.wahrscheinlichkeit) ||
      regel.wahrscheinlichkeit < 0 ||
      regel.wahrscheinlichkeit > 1
    ) {
      if (modus === 'dev') {
        throw new TypeError(
          `Event-Regel "${regel.id}" hat ungültigen Wahrscheinlichkeitswert (${String(regel.wahrscheinlichkeit)})`,
        );
      }
      continue;
    }

    // Wahrscheinlichkeit 1.0 → immer ausgelöst, aber Wurf wird gemacht (RNG verbraucht)
    if (regel.wahrscheinlichkeit >= 1.0) {
      const wurf = nextFloat(rng);
      rng = wurf.rng;
      ereignisse.push({ ereignis_id: regel.id, effekte: regel.effekte });
      continue;
    }

    // Wahrscheinlichkeit 0.0 → nie ausgelöst, kein Wurf
    if (regel.wahrscheinlichkeit <= 0.0) continue;

    // 0 < p < 1 → ein Wurf mit dem State-RNG
    const wurf = nextFloat(rng);
    rng = wurf.rng;
    if (wurf.wert < regel.wahrscheinlichkeit) {
      ereignisse.push({ ereignis_id: regel.id, effekte: regel.effekte });
    }
  }

  return { ereignisse, rng };
}
