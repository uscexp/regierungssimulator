/**
 * core/budget — Einnahmen, Zinsen, Defizit und das Spar-Event (FR-014, US-M0-10).
 *
 * Exakt balance-werte.md §1 und §6:
 *   Einnahmen = Wirtschaft-Level × Steuerfaktor (+ Schwierigkeits-Zuschuss)
 *   Zinsen werden **zuerst** vom Budget abgezogen
 *   Defizit bis Schuldenlimit ist erlaubt, darüber keine neuen Defizit-Ausgaben + Spar-Event (alle Gruppen −5)
 *
 * Der Kern rechnet in BE (keine 0–100-Level), die Faktoren und Limits sind Content bzw das
 * Schwierigkeits-Pack. Keine RNG: das Budget ist deterministisch, nur Events würfeln.
 */
import type { Steuermodell } from './zufriedenheit.js';
import type { SchwierigkeitsPack } from './indikatoren.js';
import type { Effekt, GameState, GruppenTag, IndikatorTag } from './state.js';

/** Steuerfaktor je Modell aus balance-werte.md §1 — Content-Werte, als Daten reingereicht. */
export type SteuerfaktorTabelle = Readonly<Record<Steuermodell, number>>;

/** Das Spar-Event bei Schulden ≥ Limit: alle Gruppen −5 (balance-werte.md §6, G7). */
export const SPAR_EVENT_GRUPPEN_DELTA = -5;

/** Das Ergebnis eines Jahres Budget-Abrechnung — State plus das erzwungene Spar-Event. */
export interface BudgetErgebnis {
  readonly state: GameState;
  readonly einnahmen: number;
  readonly zinsen: number;
  readonly ausgaben: number;
  /** true, wenn das Limit erreicht ist und das Spar-Event erzwungen wurde (§6). */
  readonly spar_event: boolean;
  /** BE, die wegen des Limits nicht ausgegeben werden konnten — der Lagebericht narrativiert sie. */
  readonly gekuerzte_be: number;
  /** Effekte des Spar-Events (alle Gruppen −5) — der Tick wendet sie über effektAnwenden an. */
  readonly spar_effekte: readonly Effekt[];
}

/** Einnahmen in BE: Wirtschaft-Level × Steuerfaktor + Schwierigkeits-Zuschuss (§1, §2-Tabelle). */
export function einnahmenBe(
  wirtschaftLevel: number,
  faktor: number,
  schwierigkeit: SchwierigkeitsPack,
): number {
  if (!Number.isFinite(wirtschaftLevel) || !Number.isFinite(faktor)) {
    throw new TypeError(
      `Einnahmen: Wirtschaft oder Steuerfaktor ist nicht endlich (${String(wirtschaftLevel)}, ${String(faktor)})`,
    );
  }
  return wirtschaftLevel * faktor + schwierigkeit.budget_zuschuss;
}

/** Zinsen des laufenden Jahres: Schulden × Zinsfaktor. Werden vor allen Ausgaben abgezogen (§1 K2). */
export function zinsenBe(schulden: number, schwierigkeit: SchwierigkeitsPack): number {
  if (!Number.isFinite(schulden) || schulden < 0) {
    throw new TypeError(`Zinsen: Schulden sind nicht endlich oder negativ (${String(schulden)})`);
  }
  return schulden * schwierigkeit.zinsfaktor;
}

/**
 * Ein Jahr Budget. `zuteilung` sind die BE-Allokationen der Spieler-Entscheidung,
 * `schulden_aufnahme` ist eine bewusste Aufnahme über das Defizit hinaus (0 in M0).
 *
 * Reihenfolge ist fest: Einnahmen → Zinsen abziehen → Ausgaben. Ist das Limit erreicht, werden
 * neue Defizit-Ausgaben blockiert (Ausgaben auf die verfügbaren Mittel begrenzt) und das
 * Spar-Event geliefert — der Tick wendet die Effekte an, damit Clamp und Regel-Id einheitlich sind.
 */
export function budgetSchritt(
  state: GameState,
  action: {
    readonly zuteilung: Readonly<Record<IndikatorTag, number>>;
    readonly schulden_aufnahme?: number;
  },
  steuerfaktor: SteuerfaktorTabelle,
  modell: Steuermodell,
  schwierigkeit: SchwierigkeitsPack,
): BudgetErgebnis {
  const wirtschaft = state.indikatoren.wirtschaft ?? 0;
  const einnahmen = einnahmenBe(wirtschaft, steuerfaktor[modell] ?? 0, schwierigkeit);
  const zinsen = zinsenBe(state.schulden, schwierigkeit);

  let ausgaben = 0;
  for (const [tag, be] of Object.entries(action.zuteilung)) {
    if (!Number.isFinite(be) || be < 0) {
      throw new TypeError(
        `Budget: Allokation "${tag}" ist nicht endlich oder negativ (${String(be)})`,
      );
    }
    ausgaben += be;
  }

  const aufnahme = action.schulden_aufnahme ?? 0;
  if (!Number.isFinite(aufnahme) || aufnahme < 0) {
    throw new TypeError(
      `Budget: schulden_aufnahme ist nicht endlich oder negativ (${String(aufnahme)})`,
    );
  }

  const verfügbar = einnahmen - zinsen;
  const limit = schwierigkeit.schuldenlimit;
  const limitErreicht = state.schulden >= limit;

  let gesparteAusgaben = 0;
  if (limitErreicht) {
    // Keine neuen Defizit-Ausgaben: nur was das Budget nach den Zinsen deckt, ist erlaubt.
    const erlaubt = Math.max(0, verfügbar);
    gesparteAusgaben = Math.max(0, ausgaben - erlaubt);
    ausgaben = Math.min(ausgaben, erlaubt);
  }

  const defizit = Math.max(0, ausgaben - verfügbar);
  const schuldenNeu = Math.max(0, state.schulden + defizit + aufnahme);

  // balance-werte.md §6: Schulden ≥ Limit => erzwungenes Spar-Event, unabhängig davon, ob die
  // Allokation tatsächlich gekürzt wurde. Der Tick wendet die Effekte an (alle Gruppen −5).
  const spar_effekte: readonly Effekt[] = limitErreicht
    ? state.gruppen.map((g) =>
        Object.freeze({ ziel: 'gruppen' as const, tag: g.tag, delta: SPAR_EVENT_GRUPPEN_DELTA }),
      )
    : [];

  const neu: GameState = Object.freeze({
    ...state,
    budget: Object.freeze({ ...action.zuteilung }),
    schulden: schuldenNeu,
  }) as GameState;

  return {
    state: neu,
    einnahmen,
    zinsen,
    ausgaben,
    spar_event: limitErreicht,
    gekuerzte_be: gesparteAusgaben,
    spar_effekte,
  };
}

/** Gruppen-Deltas des Spar-Events, nach Tag — direkt als Eingabe für den Tick. */
export function sparEventGruppen(state: GameState): Readonly<Record<GruppenTag, number>> {
  const deltas: Record<string, number> = {};
  for (const gruppe of state.gruppen) {
    deltas[gruppe.tag] = SPAR_EVENT_GRUPPEN_DELTA;
  }
  return deltas;
}
