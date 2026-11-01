/** @staatslenker/core/entscheidung — Entscheidungs-Karten für Event-Ketten (US-M2-03, FR-025/026).
 *
 * Eine Entscheidungs-Karte bietet dem Spieler Optionen. Jede Option hat eine optionale
 * Bedingung (typisiertes Prädikat), sofortige Effekte und eine optionale Nachfolge-Event-Id
 * für die Kette. Der Kern wählt die erste verfügbare Option (deterministisch) und verfolgt
 * die Kette bis zum Exit (keine weitere Karte, maxTiefe erreicht, oder keine verfügbare
 * Option).
 *
 * Alle Funktionen sind rein: State wird nie mutiert, keine Nebenwirkungen.
 */

import { type Modus } from './invariant.js';
import { effekteAnwenden } from './ereignisse.js';
import { evalPrädikat, type Praedikat } from './eval.js';
import type { Effekt, GameState, RngState } from './state.js';
import type { AusgelöstesEreignis } from './ereignisse.js';

/** Eine Option (Decision-Card) bei einem Ereignis. */
export interface EntscheidungsOption {
  readonly id: string;
  readonly bedingung?: Praedikat; // Optional: Nur verfügbar wenn Bedingung erfüllt
  /** Effekte im Pack-Format: { ziel, tag?, delta } — wird vor Anwendung in Effekt[] konvertiert. */
  readonly effekte: readonly { readonly ziel: string; readonly tag?: string; readonly delta: number }[];
  readonly nachfolgeEreignisId?: string; // Id des Folge-Events in der Kette
}

/** Eine Entscheidungs-Karte: Ein Event mit Optionen, die zu Folge-Events führen können. */
export interface Entscheidungskarte {
  readonly regel_id: string;
  readonly optionen: readonly EntscheidungsOption[];
  readonly maxTiefe: number; // Maximale Tiefe für diese Kette
}

/** Ergebnis der Karten-Verarbeitung: ausgelöste Ereignisse + fortgeschrittener RNG. */
export interface EntscheidungErgebnis {
  readonly ereignisse: readonly AusgelöstesEreignis[];
  readonly rng: RngState;
  readonly state: GameState; // Der modifizierte State nach Anwendung der Effekte
}

/**
 * Prüft, ob eine Option verfügbar ist (keine Bedingung oder Bedingung erfüllt).
 */
function optionVerfuegbar(option: EntscheidungsOption, state: GameState): boolean {
  return option.bedingung === undefined || evalPrädikat(option.bedingung, state);
}

/**
 * Konvertiert die rohen Effekte einer Option in das Effekt-Format des Kerns.
 */
function effekteZuKernEffekten(
  effekte: readonly { readonly ziel: string; readonly tag?: string; readonly delta: number }[],
): Effekt[] {
  return effekte.map((e) => ({
    ziel: e.ziel as Effekt['ziel'],
    tag: e.tag,
    delta: e.delta,
  }));
}

/**
 * Verarbeitet eine einzelne Karte: Wählt die erste verfügbare Option,
 * wendet deren Effekte an und gibt das Ergebnis zurück.
 *
 * @param karte — Die zu verarbeitende Karte
 * @param state — Der aktuelle GameState
 * @param modus — 'dev' oder 'produktion'
 * @returns Das Ergebnis der Karten-Verarbeitung
 */
export function karteVerarbeiten(
  karte: Entscheidungskarte,
  state: GameState,
  modus: Modus,
): EntscheidungErgebnis {
  // Erste verfügbare Option wählen (deterministisch, kein RNG-Verbrauch)
  const option = karte.optionen.find((o) => optionVerfuegbar(o, state));
  if (option === undefined) {
    return { ereignisse: [], rng: state.rng, state };
  }

  // Effekte der Option in Kern-Effekte konvertieren und anwenden
  const kernEffekte = effekteZuKernEffekten(option.effekte);
  const nachEffekten = effekteAnwenden(
    state,
    kernEffekte,
    `event:${karte.regel_id}:option:${option.id}`,
    modus,
  );

  const ereignisse: AusgelöstesEreignis[] = [
    { ereignis_id: karte.regel_id, effekte: kernEffekte },
  ];

  return { ereignisse, rng: nachEffekten.rng, state: nachEffekten };
}

/**
 * Verarbeitet eine Ereignis-Kette rekursiv: Startet bei der angegebenen Karte, wählt die
 * erste verfügbare Option, wendet Effekte an und folgt ggf. dem Folge-Event (mit Tiefen-Limit).
 *
 * @param karten — Alle verfügbaren Karten
 * @param karteId — Die Id der Start-Karte (regel_id)
 * @param state — Der aktuelle GameState
 * @param modus — 'dev' oder 'produktion'
 * @param tiefe — Aktuelle Tiefe in der Kette (0 = erste Karte)
 * @param maxTiefe — Maximale Tiefe (begrenzt die Rekursion, garantiert Exit)
 * @returns Das Ergebnis der Kette-Verarbeitung
 */
export function ereignisKetteVerarbeiten(
  karten: readonly Entscheidungskarte[],
  karteId: string,
  state: GameState,
  modus: Modus,
  tiefe: number = 0,
  maxTiefe: number = 5,
): EntscheidungErgebnis {
  const karte = karten.find((k) => k.regel_id === karteId);
  if (karte === undefined) return { ereignisse: [], rng: state.rng, state };

  // Tiefen-Limit erreicht → Exit (garantiert kein Endlosschleife).
  // Das engere der beiden Limits gewinnt (karte.maxTiefe oder global maxTiefe).
  const effektiveTiefe = Math.min(karte.maxTiefe, maxTiefe);
  if (tiefe >= effektiveTiefe) return { ereignisse: [], rng: state.rng, state };

  // Einzelne Karte verarbeiten
  const ergebnis = karteVerarbeiten(karte, state, modus);

  // Wenn die gewählte Option eine Folge-Karte hat und wir noch Tiefe haben: Rekursion
  const option = karte.optionen.find((o) => optionVerfuegbar(o, state));
  if (
    option !== undefined &&
    option.nachfolgeEreignisId !== undefined &&
    tiefe + 1 < effektiveTiefe
  ) {
    const folgeErgebnis = ereignisKetteVerarbeiten(
      karten,
      option.nachfolgeEreignisId,
      ergebnis.state,
      modus,
      tiefe + 1,
      effektiveTiefe,
    );
    return {
      ereignisse: [...ergebnis.ereignisse, ...folgeErgebnis.ereignisse],
      rng: folgeErgebnis.rng,
      state: folgeErgebnis.state,
    };
  }

  return ergebnis;
}
