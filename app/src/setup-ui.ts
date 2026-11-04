/**
 * @staatslenker/app setup-ui — Setup-Phase UI-Adapter (US-M5-02).
 *
 * Stellt die Regierungsformen und Konstitutions-Entscheidungen des geladenen Registers dar
 * und wendet den Setup über `core/setup.setupAnwenden` an. Der Adapter rechnet nichts:
 * Sofort-Effekte und Dauer-Modifikatoren sind Register-Daten, der Kern wendet sie an.
 */
import { setupAnwenden, type SetupAktion, type SetupPflicht } from '@staatslenker/core/setup';
import { startState } from '@staatslenker/cli/content-pack';
import { SETUP_FORMEN, SETUP_PFLICHT, basisKonstitution } from '@staatslenker/content-base';
import type { Regierungsform } from '@staatslenker/core/rules';
import type { GameState } from '@staatslenker/core/state';
import type { UIState } from './ui-adapter.js';

/** Ergebnis einer Setup-Aktion. */
export interface SetupErgebnis {
  readonly erfolgreich: boolean;
  readonly grund?: string;
  readonly state?: GameState;
  readonly uiState?: UIState;
}

/** Die verfügbaren Regierungsformen aus dem Register (SETUP_FORMEN aus content-base). */
export function regierungsformen(): readonly string[] {
  return SETUP_FORMEN;
}

/** Die Konstitutions-Entscheidungen aus dem Register (basisKonstitution aus content-base). */
export function konstitutionsEntscheidungen() {
  return basisKonstitution.entscheidungen;
}

/** Die Setup-Pflicht aus dem Register (SETUP_PFLICHT aus content-base). */
export function setupPflicht(): SetupPflicht {
  return SETUP_PFLICHT;
}

/** Wendet den Setup an: Regierungsform + Konstitutions-Entscheidungen. */
export function setupAnwendenAusUI(
  state: GameState,
  regierungsform: string,
  konstitutionsIds: readonly string[],
  konstitution: Record<string, string | boolean>,
  pflicht: SetupPflicht,
): SetupErgebnis {
  try {
    const neueState = setupAnwenden(state, {
      regierungsform: regierungsform as Regierungsform,
      konstitutions_ids: konstitutionsIds,
      konstitution,
    }, pflicht);

    return {
      erfolgreich: true,
      state: neueState,
      uiState: {
        jahr: neueState.jahr,
        indikatoren: { ...neueState.indikatoren },
        legitimität: neueState.legitimitaet,
        politisches_kapital: neueState.politisches_kapital,
        schulden: neueState.schulden,
        radikalisierung: neueState.radikalisierung,
        gruppen: neueState.gruppen.map((g) => ({ tag: g.tag, zufriedenheit: g.zufriedenheit })),
        wahl_niederlage: neueState.wahl_niederlage,
      },
    };
  } catch (e) {
    return {
      erfolgreich: false,
      grund: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Erstellt einen Start-State für die Setup-Phase. */
export function setupStartState(seed: number = 42): GameState {
  return startState(seed);
}
