/**
 * cli/konstitution-messung.test — die AC-Instanz von US-M1-05 (FR-017).
 *
 * Die AC vergleicht „baseline-Zufriedenheit der liberalen Gruppen ist höher, der konservativen
 * niedriger als ohne Grundrechte" — zwei Setups bei identischem Seed, eine Zahl je Gruppe (Trix-
 * Ruling: der Report ist die AC-Instanz, kein Golden-Fixture). Getestet wird außerdem: die
 * M0-Messbasis bleibt unberührt (kein Delta auf den drei renormierten Basis-Gruppen), der Report ist
 * deterministisch, und die M0-Fixtures bleiben ohne Setup bitgleich.
 */
import { describe, expect, it } from 'vitest';

import { konstitutionsMessung, messungAlsReport } from '@staatslenker/cli/konstitution-messung';
import { startState } from '@staatslenker/cli/content-pack';

/** Die drei renormierten M0-Basis-Gruppen (balance-werte §4) — dort darf kein Konstitutions-Effekt stehen. */
const M0_BASIS = ['unternehmen', 'arbeitnehmer', 'bildung_jugend'];

describe('Konstitutions-Messung — AC US-M1-05', () => {
  it('Grundrechte verschieben die baseline: liberale höher, konservative niedriger', () => {
    const messung = konstitutionsMessung(424242);
    const liberale = messung.zeilen.find((z) => z.tag === 'liberale_minderheiten');
    const konservative = messung.zeilen.find((z) => z.tag === 'konservative');
    expect(liberale).toBeDefined();
    expect(konservative).toBeDefined();
    expect(liberale!.delta).toBeGreaterThan(0);
    expect(konservative!.delta).toBeLessThan(0);
    expect(liberale!.mit).toBeGreaterThan(liberale!.ohne);
    expect(konservative!.mit).toBeLessThan(konservative!.ohne);
  });

  it('die M0-Messbasis bleibt unberührt — kein Delta auf den drei Basis-Gruppen', () => {
    const messung = konstitutionsMessung(424242);
    for (const tag of M0_BASIS) {
      const zeile = messung.zeilen.find((z) => z.tag === tag);
      expect(zeile?.delta).toBe(0);
    }
  });

  it('der Report ist eine Zahl je Gruppe und enthält beide Werte', () => {
    const report = messungAlsReport(konstitutionsMessung(424242));
    expect(report).toContain('Konstitutions-Messung');
    expect(report).toContain('liberale_minderheiten');
    expect(report).toContain('(Delta');
  });

  it('die Messung ist deterministisch: derselbe Seed gibt identische Zeilen', () => {
    const a = konstitutionsMessung(424242);
    const b = konstitutionsMessung(424242);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(konstitutionsMessung(7))).not.toBe(JSON.stringify(a));
  });

  it('ein anderer Vergleich fällt die Differenz auf dieselbe Weise', () => {
    const weltlichkeit = konstitutionsMessung(424242, 'weltlichkeit');
    const liberale = weltlichkeit.zeilen.find((z) => z.tag === 'liberale_minderheiten');
    const konservative = weltlichkeit.zeilen.find((z) => z.tag === 'konservative');
    expect(liberale?.delta).toBeGreaterThan(0);
    expect(konservative?.delta).toBeLessThan(0);
  });
});

describe('M0-Messbasis-Guard (Haui-Ruling): der Harnesspfad bleibt ohne Setup', () => {
  it('ein Start-State ohne Setup serialisiert keinen setup-Key — die Formel läuft wie vorher', () => {
    const start = startState(424242);
    expect(JSON.stringify(start).includes('"setup"')).toBe(false);
    expect(start.setup).toBeUndefined();
  });

  it('die Messreihe berührt keine Gruppenzufriedenheit im State (sie ist ein Report, kein Sideffekt)', () => {
    const vor = JSON.stringify(startState(424242));
    konstitutionsMessung(424242);
    expect(JSON.stringify(startState(424242))).toBe(vor);
  });
});
