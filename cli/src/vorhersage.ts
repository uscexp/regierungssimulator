/**
 * @staatslenker/cli vorhersage — die frühe Warnung vor dem Machtcheck (§7/S0-C Punkt 11).
 *
 * Die Prognose ist keine zweite Engine und keine eigene Mechanik: sie ist `tick` im Dry-Run auf
 * einer Kopie des States mit derselben Regel-Instanz (ADR-009 — deshalb ist sie garantiert dasselbe
 * Spiel). Sie spielt die nächsten Jahre mit der Zuteilung des Spielers weiter und meldet den
 * Machtcheck, der daraus folgt, samt Jahr und Ursache. Der Kern bleibt frei von UI und
 * Serialisierung (ADR-002); die Vorhersage ist Adapter-Arbeit.
 *
 * Die Basis-Entscheidung wird nicht simuliert: sie ist eine reine Daten-Action ohne State-Wirkung
 * (Pädu-Ruling zu PR #20, architektur.md §3a), ihre Bewegung läuft über die `budget_wirkung` der
 * Allokation — die Zuteilung ist die Simulation. Das PK bleibt in der Prognose unbeeinflusst, weil
 * in M0 keine Karte wählbar ist (Konzept §10, Karten sind M3) und die Basis-Entscheidungen 0 PK
 * kosten.
 *
 * Deterministisch: der RNG liegt im State (ADR-006), `tick` ist pure — derselbe State und dieselbe
 * Zuteilung ergeben dieselbe Prognose. Die Kaputt-Probe wirft im Dev-Modus laut (eine kaputte Regel
 * wäre ein Bug, kein Spielzustand); der `produktion`-Modus überspringt die kaputte Regel wie der Tick.
 */
import { prognose as kernPrognose, type Prognose } from '@staatslenker/core/tick';
import type { GameState } from '@staatslenker/core/state';
import type { TickRegeln } from '@staatslenker/core/tick';
import type { Modus } from '@staatslenker/core/invariant';

export type { Prognose };

/** Nach so vielen Jahren bricht die Prognose ab — der Session-Hard-Cap ist 50 Jahre (§7). */
const PROGNOSE_CAP = 50;

/**
 * Vorhersage des nächsten verlorenen Machtchecks bei unveränderter Zuteilung. `null` heißt: innerhalb
 * des Caps verliert dieser Lauf keinen Machtcheck — die Warnung bleibt dann aus, sie wird nicht
 * erfunden.
 */
export function prognose(
  state: GameState,
  regeln: TickRegeln,
  zuteilung: Readonly<Record<string, number>>,
  modus: Modus = 'dev',
  capJahre: number = PROGNOSE_CAP,
): Prognose | null {
  return kernPrognose(state, regeln, zuteilung, modus, capJahre);
}
