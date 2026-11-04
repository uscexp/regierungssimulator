/**
 * @staatslenker/app ui-adapter — UI-Adapter für readonly GameState-Snapshots + Actions (US-M5-01).
 *
 * Der Adapter ist die Brücke zwischen dem Spielkern (tick/state) und der Web-UI.
 * Er liest nur readonly Snapshots (GameState) und sendet Actions (TickAction) an den Kern.
 * Keine eigene Simulation — alle Zahlen kommen aus `tick` bzw. den core-Funktionen.
 *
 * Architektur (ADR-002, Kern-Isolation): Der Adapter importiert den Kern, aber der Kern
 * importiert niemals den Adapter oder UI-Code.
 */
import { erzeugeGameState, type GameState, type GruppenSnapshot } from '@staatslenker/core/state';
import { tick, type TickRegeln, type TickAction } from '@staatslenker/core/tick';
import { startState, tickRegelnFür } from '@staatslenker/cli/content-pack';
import type { SchwierigkeitId } from '@staatslenker/cli/autosim';

/** Readonly-View des Spielzustands für die UI. Alle Felder sind readonly — die UI darf nicht mutieren. */
export interface UIState {
  readonly jahr: number;
  readonly indikatoren: Readonly<Record<string, number>>;
  readonly legitimität: number;
  readonly politisches_kapital: number;
  readonly schulden: number;
  readonly radikalisierung: number;
  readonly gruppen: readonly { readonly tag: string; readonly zufriedenheit: number }[];
  readonly wahl_niederlage?: { readonly jahr: number; readonly grund_id: string };
}

/** Wandelt einen GameState in einen readonly UIState um. Der UIState ist eine Kopie — die UI kann den Kern nicht mutieren. */
export function uiStateAusGameState(state: GameState): UIState {
  return {
    jahr: state.jahr,
    indikatoren: { ...state.indikatoren },
    legitimität: state.legitimitaet,
    politisches_kapital: state.politisches_kapital,
    schulden: state.schulden,
    radikalisierung: state.radikalisierung,
    gruppen: state.gruppen.map((g) => ({ tag: g.tag, zufriedenheit: g.zufriedenheit })),
    wahl_niederlage: state.wahl_niederlage,
  };
}

/** Der UI-Adapter verwaltet einen aktuellen State und bietet spieleTick() für Actions an. */
export interface UIAdapter {
  readonly state: UIState;
  readonly regeln: TickRegeln;
  /** Führt einen Tick mit der gegebenen Zuteilung aus und gibt den neuen UIState zurück. */
  spieleTick(zuteilung: Readonly<Record<string, number>>): UIState;
  /** Setzt den Adapter auf einen neuen Start-State zurück. */
  reset(seed?: number): UIState;
}

/** Erstellt einen UI-Adapter für die gegebene Schwierigkeit und Seed. */
export function erstelleUIAdapter(
  schwierigkeit: SchwierigkeitId = 'normal',
  seed: number = 1234,
): UIAdapter {
  const regeln = tickRegelnFür(schwierigkeit);
  let current = startState(seed);

  return {
    state: uiStateAusGameState(current),
    regeln,
    spieleTick(zuteilung: Readonly<Record<string, number>>) {
      const ergebnis = tick(current, { zuteilung }, regeln, 'dev');
      current = ergebnis.state;
      return uiStateAusGameState(current);
    },
    reset(seedValue?: number) {
      current = startState(seedValue ?? 1234);
      return uiStateAusGameState(current);
    },
  };
}
