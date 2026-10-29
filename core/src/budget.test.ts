import { describe, expect, it } from 'vitest';

import {
  SPAR_EVENT_GRUPPEN_DELTA,
  budgetSchritt,
  einnahmenBe,
  sparEventGruppen,
  zinsenBe,
  type SteuerfaktorTabelle,
} from '@staatslenker/core/budget';
import { SCHWIERIGKEIT_NORMAL } from '@staatslenker/core/indikatoren';
import { erzeugeGameState, type Startkonfiguration } from '@staatslenker/core/state';

/** Steuerfaktor aus balance-werte.md §1 — Content-Fixture, kein Kern-Wert. */
const steuerfaktor: SteuerfaktorTabelle = { niedrig: 0.6, flat: 0.8, progressiv: 1.0, hoch: 1.2 };

const gruppen = [
  {
    tag: 'unternehmen',
    zufriedenheit: 49.21,
    bevölkerungsanteil: 21.3,
    gewichte: { wirtschaft: 1 },
  },
  {
    tag: 'arbeitnehmer',
    zufriedenheit: 49.21,
    bevölkerungsanteil: 51.1,
    gewichte: { wirtschaft: 1 },
  },
  {
    tag: 'bildung_jugend',
    zufriedenheit: 46.0,
    bevölkerungsanteil: 27.7,
    gewichte: { wirtschaft: 1 },
  },
];

function stateMit(extra: Partial<Startkonfiguration>): ReturnType<typeof erzeugeGameState> {
  return erzeugeGameState({
    jahr: 1,
    indikatoren: { infrastruktur: 40, bildung: 40, gesundheit: 40, wirtschaft: 45, forschung: 40 },
    gruppen,
    budget: {},
    politisches_kapital: 6,
    legitimitaet: 50,
    schulden: 0,
    radikalisierung: 10,
    rng: { seed: 424242, counter: 0 },
    konstitution: { steuermodell: 'flat' },
    zufriedenheits_trace: {},
    ...extra,
  });
}

const schwer = Object.freeze({
  ...SCHWIERIGKEIT_NORMAL,
  verschleiß_multiplikator: 1.3,
  schuldenlimit: 80,
  zinsfaktor: 0.12,
  budget_zuschuss: -10,
});
const leicht = Object.freeze({
  ...SCHWIERIGKEIT_NORMAL,
  verschleiß_multiplikator: 0.7,
  schuldenlimit: 120,
  zinsfaktor: 0.05,
  budget_zuschuss: 10,
});

describe('Budget, Zinsen und Spar-Event (FR-014, US-M0-10)', () => {
  it('Einnahmen = Wirtschaft × Steuerfaktor; progressiv bei Wirtschaft 50 = 50 BE, Anker normal/flat bei 45 = 36 BE (AC)', () => {
    expect(einnahmenBe(50, steuerfaktor.progressiv!, SCHWIERIGKEIT_NORMAL)).toBe(50);
    expect(einnahmenBe(45, steuerfaktor.flat!, SCHWIERIGKEIT_NORMAL)).toBe(36);
    expect(einnahmenBe(45, steuerfaktor.niedrig!, SCHWIERIGKEIT_NORMAL)).toBe(27);
    expect(einnahmenBe(45, steuerfaktor.hoch!, SCHWIERIGKEIT_NORMAL)).toBe(54);
  });

  it('die Schwierigkeit verschiebt die Einnahmen über den Zuschuss (leicht 46 BE, schwer 26 BE)', () => {
    expect(einnahmenBe(45, steuerfaktor.flat!, leicht)).toBe(46);
    expect(einnahmenBe(45, steuerfaktor.flat!, schwer)).toBe(26);
  });

  it('Zinsen werden zuerst abgezogen — Schulden × Zinsfaktor vor jeder Ausgabe (§1 K2)', () => {
    expect(zinsenBe(100, SCHWIERIGKEIT_NORMAL)).toBe(8);
    const ergebnis = budgetSchritt(
      stateMit({ schulden: 50 }),
      { zuteilung: { bildung: 30 } },
      steuerfaktor,
      'flat',
      SCHWIERIGKEIT_NORMAL,
    );
    expect(ergebnis.zinsen).toBe(4);
    expect(ergebnis.einnahmen).toBe(36);
    expect(ergebnis.ausgaben).toBe(30);
    // 36 − 4 − 30 = 2 Rest: kein Defizit, die Schulden bleiben 50.
    expect(ergebnis.state.schulden).toBe(50);
    expect(ergebnis.spar_event).toBe(false);
  });

  it('Defizit bis zum Schuldenlimit ist erlaubt und erhöht die Schulden', () => {
    const ergebnis = budgetSchritt(
      stateMit({ schulden: 60 }),
      { zuteilung: { bildung: 40 } },
      steuerfaktor,
      'flat',
      SCHWIERIGKEIT_NORMAL,
    );
    // 36 − 4.8 − 40 = −8.8 Defizit, unter dem Limit 100.
    expect(ergebnis.zinsen).toBeCloseTo(4.8, 10);
    expect(ergebnis.state.schulden).toBeCloseTo(68.8, 10);
    expect(ergebnis.spar_event).toBe(false);
    expect(ergebnis.spar_effekte).toHaveLength(0);
  });

  it('über dem Limit: keine neuen Defizit-Ausgaben und das Spar-Event trifft alle Gruppen (AC)', () => {
    const state = stateMit({ schulden: 100 });
    const ergebnis = budgetSchritt(
      state,
      { zuteilung: { bildung: 30 } },
      steuerfaktor,
      'flat',
      SCHWIERIGKEIT_NORMAL,
    );

    // Zinsen 8, Einnahmen 36 → 28 verfügbar; 30 BE waren beantragt, 2 BE werden gespart.
    expect(ergebnis.spar_event).toBe(true);
    expect(ergebnis.ausgaben).toBe(28);
    expect(ergebnis.gekuerzte_be).toBe(2);
    expect(ergebnis.state.schulden).toBe(100);
    expect(ergebnis.spar_effekte).toHaveLength(3);
    expect(ergebnis.spar_effekte.every((e) => e.delta === SPAR_EVENT_GRUPPEN_DELTA)).toBe(true);
    expect(sparEventGruppen(state)).toEqual({
      unternehmen: -5,
      arbeitnehmer: -5,
      bildung_jugend: -5,
    });
  });

  it('schwer hat ein eigenes Limit (80) und einen höheren Zins — dort greift die Sperre früher', () => {
    const ergebnis = budgetSchritt(
      stateMit({ schulden: 80 }),
      { zuteilung: { bildung: 20 } },
      steuerfaktor,
      'flat',
      schwer,
    );
    // Einnahmen 26, Zinsen 9.6 → 16.4 verfügbar; beantragt 20 → 3.6 gespart.
    expect(ergebnis.einnahmen).toBe(26);
    expect(ergebnis.zinsen).toBeCloseTo(9.6, 10);
    expect(ergebnis.spar_event).toBe(true);
    expect(ergebnis.ausgaben).toBeCloseTo(16.4, 10);
  });

  it('bewusste Schuldenaufnahme über das Defizit hinaus ist möglich, aber nicht unter dem Limit', () => {
    const ergebnis = budgetSchritt(
      stateMit({ schulden: 10 }),
      { zuteilung: {}, schulden_aufnahme: 25 },
      steuerfaktor,
      'flat',
      SCHWIERIGKEIT_NORMAL,
    );
    expect(ergebnis.state.schulden).toBe(35);
  });

  it('negative oder nicht-endliche Werte werden abgewiesen, der alte Snapshot bleibt unverändert (FR-002/ADR-002)', () => {
    const state = stateMit({ schulden: 0 });
    expect(() =>
      budgetSchritt(
        state,
        { zuteilung: { bildung: -5 } },
        steuerfaktor,
        'flat',
        SCHWIERIGKEIT_NORMAL,
      ),
    ).toThrow(/bildung/);
    expect(() =>
      budgetSchritt(
        state,
        { zuteilung: { bildung: Number.NaN } },
        steuerfaktor,
        'flat',
        SCHWIERIGKEIT_NORMAL,
      ),
    ).toThrow(/bildung/);
    expect(() =>
      budgetSchritt(
        state,
        { zuteilung: {}, schulden_aufnahme: -1 },
        steuerfaktor,
        'flat',
        SCHWIERIGKEIT_NORMAL,
      ),
    ).toThrow(TypeError);
    expect(() => einnahmenBe(Number.NaN, 0.8, SCHWIERIGKEIT_NORMAL)).toThrow(TypeError);
    expect(() => zinsenBe(-1, SCHWIERIGKEIT_NORMAL)).toThrow(TypeError);

    const ok = budgetSchritt(
      state,
      { zuteilung: { bildung: 12 } },
      steuerfaktor,
      'flat',
      SCHWIERIGKEIT_NORMAL,
    );
    expect(state.budget).toEqual({});
    expect(ok.state.budget).toEqual({ bildung: 12 });
    expect(ok.state).not.toBe(state);
  });
});
