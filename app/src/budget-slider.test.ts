/**
 * @staatslenker/app budget-slider.test.ts — Tests für Budget-Logik (US-M5-05).
 *
 * Testet die Berechnung von Einnahmen, Zinsen, Ausgaben, Defizit und Spar-Event.
 */
import { describe, expect, it } from 'vitest';

/**
 * Budget-Logik extrahiert aus BudgetSlider.svelte — testbar isoliert.
 */
function berechneBudget(
  wirtschaftLevel: number,
  schulden: number,
  zuteilung: Record<string, number>,
  steuerfaktor: number = 0.8,
  zinsfaktor: number = 0.08,
  schuldenlimit: number = 80,
) {
  const einnahmen = wirtschaftLevel * steuerfaktor;
  const zinsen = schulden * zinsfaktor;
  const ausgaben = Object.values(zuteilung).reduce((sum, be) => sum + be, 0);
  const verfügbar = einnahmen - zinsen;
  const defizit = Math.max(0, ausgaben - verfügbar);
  const schuldenNeu = Math.max(0, schulden + defizit);
  const sparEvent = schulden >= schuldenlimit;

  return {
    einnahmen,
    zinsen,
    ausgaben,
    defizit,
    schuldenNeu,
    sparEvent,
    verfügbar,
  };
}

describe('US-M5-05: Budget-Slider Logik', () => {
  it('berechnet Einnahmen korrekt (Wirtschaft × Steuerfaktor)', () => {
    const r = berechneBudget(45, 0, {});
    expect(r.einnahmen).toBe(36); // 45 × 0.8 = 36
  });

  it('berechnet Zinsen korrekt (Schulden × Zinsfaktor)', () => {
    const r = berechneBudget(45, 100, {});
    expect(r.zinsen).toBe(8); // 100 × 0.08 = 8
  });

  it('berechnet Ausgaben als Summe der Zuteilungen', () => {
    const r = berechneBudget(45, 0, { infrastruktur: 3, bildung: 2, gesundheit: 2 });
    expect(r.ausgaben).toBe(7);
  });

  it('berechnet Defizit wenn Ausgaben > Verfügbar', () => {
    // Einnahmen 36, Zinsen 0, Verfügbar 36. Ausgaben 50 → Defizit 14
    const r = berechneBudget(45, 0, { infrastruktur: 10, bildung: 10, gesundheit: 10, wirtschaft: 10, forschung: 10 });
    expect(r.defizit).toBe(14);
  });

  it('Defizit ist 0 wenn Ausgaben ≤ Verfügbar', () => {
    // Einnahmen 36, Zinsen 0, Verfügbar 36. Ausgaben 20 → Defizit 0
    const r = berechneBudget(45, 0, { infrastruktur: 5, bildung: 5, gesundheit: 5 });
    expect(r.defizit).toBe(0);
  });

  it('Spar-Event bei Schulden ≥ Limit (80)', () => {
    const r1 = berechneBudget(45, 79, {});
    expect(r1.sparEvent).toBe(false);

    const r2 = berechneBudget(45, 80, {});
    expect(r2.sparEvent).toBe(true);

    const r3 = berechneBudget(45, 100, {});
    expect(r3.sparEvent).toBe(true);
  });

  it('Schulden steigen bei Defizit', () => {
    const r = berechneBudget(45, 50, { infrastruktur: 20, bildung: 20 }); // Ausgaben 40, Verfügbar 36 → Defizit 4
    expect(r.schuldenNeu).toBe(54); // 50 + 4 = 54
  });

  it('Schulden sinken nicht unter 0', () => {
    const r = berechneBudget(45, 0, { infrastruktur: 0 });
    expect(r.schuldenNeu).toBe(0);
  });

  it('Verfügbar = Einnahmen − Zinsen', () => {
    const r = berechneBudget(45, 100, {});
    expect(r.verfügbar).toBe(28); // 36 − 8 = 28
  });
});
