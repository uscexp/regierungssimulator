/**
 * Tests für die Naiv-Kurven-Baseline (US-M0-20, FR-011/D18). Alles gemessen gegen das committed
 * Fixture; keine Erwartung wird aus Docs-Zahlen abgeleitet.
 */
import { describe, expect, it } from 'vitest';

import { ANZAHL_SEEDS, MAX_JAHRE, STRATEGIE_IDS } from './autosim.js';
import { GOLDEN_NAIV_HASH, GOLDEN_NAIV_REPORT } from '../fixtures/naiv-kurven.golden.js';
import { alleKurven, kurvenHash, kurvenReport, naiveKurve } from './naiv-kurven.js';

describe('Naiv-Kurven (US-M0-20)', () => {
  it('der Report ist identisch mit dem committed Fixture (FR-049)', () => {
    const report = kurvenReport();
    expect(report).toBe(GOLDEN_NAIV_REPORT.join('\n'));
    expect(kurvenHash()).toBe(GOLDEN_NAIV_HASH);
  });

  it('zwei Aufrufe liefern denselben Report und denselben Hash (Determinismus)', () => {
    expect(kurvenReport()).toBe(kurvenReport());
    expect(kurvenHash()).toBe(kurvenHash());
  });

  it('genau vier Kurven, jede endet mit dem verlorenen Machtcheck Jahr 6 ohne Defizit und Schulden', () => {
    const kurven = alleKurven();
    expect(kurven.map((k) => k.strategie)).toEqual(STRATEGIE_IDS);
    expect(kurven).toHaveLength(4);
    for (const k of kurven) {
      expect(k.punkte.length).toBe(6);
      const letzte = k.punkte[k.punkte.length - 1]!;
      expect(letzte.jahr).toBe(6);
      expect(letzte.wahl_grund).toBe('wahl:gewichtete_unter_47');
      expect(k.punkte.every((p) => p.defizit === 0)).toBe(true);
      expect(k.punkte.every((p) => p.schulden === 0)).toBe(true);
      expect(k.erstes_defizit).toBeNull();
      expect(k.erstes_spar_event).toBeNull();
      expect(k.überlebt).toEqual({ min: 6, median: 6, max: 6 });
    }
  });

  it('die Kurve bricht am Spielende, nicht am 30-Jahre-Cap (Horizont ist gemessen)', () => {
    const k = naiveKurve('gleichmaessig', 'normal', ANZAHL_SEEDS, MAX_JAHRE);
    expect(MAX_JAHRE).toBe(30);
    expect(k.punkte.length).toBe(6);
    expect(k.punkte[5]!.wahl_grund).toBe('wahl:gewichtete_unter_47');
  });

  it('der Seed-Median ist gleich dem Einzel-Seed (der Basis-Pack würfelt nicht)', () => {
    for (const strategie of STRATEGIE_IDS) {
      const ein = naiveKurve(strategie, 'normal', 1);
      const zwanzig = naiveKurve(strategie, 'normal', ANZAHL_SEEDS);
      expect(zwanzig.punkte).toEqual(ein.punkte);
      expect(zwanzig.score_median).toBeCloseTo(ein.score_median, 6);
    }
  });

  it('Unterhalt ist über die sechs Jahre konstant, Einnahmen und Zufriedenheit fallen (D18-Verschleiß-Fund)', () => {
    // Der Level-Decay (D18) wirkt bei den Naiv-Strategien auf Einnahmen und Zufriedenheit, nicht auf
    // den Unterhalt: der Unterhalt wird auf den Gate-Levels gemessen und die Naiv-Zuteilungen halten
    // die Levels im Gate. Das ist der gemessene Abgleich-Wert für Ralf — keine hier erfundene Formel.
    for (const k of alleKurven()) {
      expect(new Set(k.punkte.map((p) => p.unterhalt_be)).size).toBe(1);
      expect(k.unterhalt_start).toBe(k.unterhalt_ende);
      const einnahmen = k.punkte.map((p) => p.einnahmen);
      for (let i = 1; i < einnahmen.length; i++) {
        expect(einnahmen[i]!).toBeLessThan(einnahmen[i - 1]!);
      }
      const zufriedenheit = k.punkte.map((p) => p.zufriedenheit);
      for (let i = 1; i < zufriedenheit.length; i++) {
        expect(zufriedenheit[i]!).toBeLessThan(zufriedenheit[i - 1]!);
      }
    }
  });

  it('andere Schwierigkeiten verschieben die Kurve, ohne den Report-Fixture zu verändern', () => {
    expect(kurvenReport('schwer')).not.toBe(GOLDEN_NAIV_REPORT.join('\n'));
    expect(kurvenReport()).toBe(GOLDEN_NAIV_REPORT.join('\n'));
    // Gemessen auf 'schwer': Unterhalt 22.35 BE überschreitet die Einnahmen ab Jahr 5, aber die
    // Zuteilung wird auf den Spielraum gekürzt (D18 / PO-Ruling), also bleibt das Defizit 0 und die
    // Schulden 0 — die Deficit-Spirale braucht einen längeren Horizont, nicht diesen Kurvenlauf.
    const schwer = naiveKurve('overspend', 'schwer');
    expect(schwer.punkte.length).toBe(6);
    expect(schwer.punkte.every((p) => p.defizit === 0 && p.schulden === 0)).toBe(true);
    expect(schwer.punkte[4]!.einnahmen).toBeLessThan(schwer.punkte[4]!.unterhalt_be);
    expect(schwer.erstes_defizit).toBeNull();
    expect(schwer.erstes_spar_event).toBeNull();
  });
});
