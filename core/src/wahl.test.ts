import { describe, expect, it } from 'vitest';

import { WAHLREGEL_M0, wahlJahr, wahlPrüfen, schwächsteGruppe } from '@staatslenker/core/wahl';
import type { GruppenSnapshot } from '@staatslenker/core/state';

const gruppe = (tag: string, zufriedenheit: number, anteil: number): GruppenSnapshot =>
  Object.freeze({ tag, zufriedenheit, bevölkerungsanteil: anteil, gewichte: {} });

/** Fixture A aus AC US-M0-12: alle Gruppen ≥ 35 und gewichtete Ø ≥ 50 ⇒ Gewinn. */
const fixtureA: readonly GruppenSnapshot[] = [
  gruppe('unternehmen', 55, 21.3),
  gruppe('arbeitnehmer', 52, 51.1),
  gruppe('bildung_jugend', 45, 27.7),
];

/** Fixture B aus AC US-M0-12: Ø ≥ 50, aber die schwächste Gruppe 34.7 ⇒ Verlust (Unruhe-Gate). */
const fixtureB: readonly GruppenSnapshot[] = [
  gruppe('unternehmen', 62, 21.3),
  gruppe('arbeitnehmer', 58, 51.1),
  gruppe('bildung_jugend', 34.7, 27.7),
];

describe('core/wahl — der Machtcheck mit Unruhe-Gate (FR-013, US-M0-12, PO D12)', () => {
  it('Fixture A: alle ≥ 35 und Ø ≥ 50 ist gewonnen (AC)', () => {
    const ergebnis = wahlPrüfen(fixtureA, WAHLREGEL_M0);
    expect(ergebnis.gewonnen).toBe(true);
    expect(ergebnis.grund_id).toBe('wahl:gewonnen');
    expect(ergebnis.gewichtete_zufriedenheit).toBeGreaterThanOrEqual(50);
  });

  it('Fixture B: Ø ≥ 50 mit schwächster Gruppe 34.7 ist verloren — die einfache Ø-Regel allein wäre dominant (AC)', () => {
    const ergebnis = wahlPrüfen(fixtureB, WAHLREGEL_M0);
    expect(ergebnis.gewonnen).toBe(false);
    expect(ergebnis.grund_id).toBe('wahl:schwächste_unter_35');
    expect(ergebnis.gewichtete_zufriedenheit).toBeGreaterThanOrEqual(50);
    expect(ergebnis.schwächste_gruppe).toBe('bildung_jugend');
  });

  it('die fehlende Ø-Bedingung bekommt ihre eigene Ursache (Spielende-Text im CLI)', () => {
    const ergebnis = wahlPrüfen([gruppe('unternehmen', 45, 100)], WAHLREGEL_M0);
    expect(ergebnis.gewonnen).toBe(false);
    // Die Ursache nennt die Schwelle der Regel — bei der M0-Regel (PO-Ruling: 47) ist das
    // `wahl:gewichtete_unter_47`, nicht eine fest eingetextete Zahl.
    expect(ergebnis.grund_id).toBe('wahl:gewichtete_unter_47');
  });

  it('die Schwellen sind inklusiv: genau 50 und genau 35 ist gewonnen', () => {
    // Die Schwellen werden gegen die tatsächlich gerechneten Werte gesetzt — die Anteile von
    // fixtureA summieren 100.1, die Formel normalisiert (K4-Safety-net), deshalb ist Ø exakt der
    // Gerechnete Wert und nicht die Docs-Zahl 50.7.
    const reale = wahlPrüfen(fixtureA, WAHLREGEL_M0);
    expect(reale.gewonnen).toBe(true);
    expect(
      wahlPrüfen(fixtureA, { ...WAHLREGEL_M0, gewichtete_min: reale.gewichtete_zufriedenheit })
        .gewonnen,
    ).toBe(true);
    expect(
      wahlPrüfen(fixtureA, {
        ...WAHLREGEL_M0,
        gewichtete_min: reale.gewichtete_zufriedenheit + 0.01,
      }).gewonnen,
    ).toBe(false);
    expect(wahlPrüfen(fixtureA, { ...WAHLREGEL_M0, schwächste_min: 45 }).gewonnen).toBe(true);
    expect(wahlPrüfen(fixtureA, { ...WAHLREGEL_M0, schwächste_min: 45.1 }).gewonnen).toBe(false);
  });

  it('der Wahlzyklus läuft alle 6 Jahre, Jahr 1 ist das Startjahr (PO-Ruling: Zyklus 6)', () => {
    expect(wahlJahr(6, WAHLREGEL_M0)).toBe(true);
    expect(wahlJahr(12, WAHLREGEL_M0)).toBe(true);
    // Jahr 4 ist kein Wahljahr mehr — der AutoSim-Befund zeigte dort den guaranteed Verlust.
    expect(wahlJahr(4, WAHLREGEL_M0)).toBe(false);
    expect(wahlJahr(3, WAHLREGEL_M0)).toBe(false);
    expect(wahlJahr(1, WAHLREGEL_M0)).toBe(false);
    expect(wahlJahr(5, { ...WAHLREGEL_M0, intervall_jahre: 0 })).toBe(false);
  });

  it('ein Nicht-Wahljahr ist kein Check, damit der Tick keinen Machtcheck protokolliert (Lens-Fund zu PR #12)', () => {
    // Der Zyklus ist Teil des Regel-Objekts (US-M1-03: die Mechanik ist Daten, kein Adapter-Callback).
    expect(wahlJahr(3, WAHLREGEL_M0)).toBe(false);
    expect(wahlJahr(1, WAHLREGEL_M0)).toBe(false);
    expect(wahlJahr(6, WAHLREGEL_M0)).toBe(true);
  });

  it('ein Snapshot ohne Gruppen ist ein Definitionfehler mit eigener Regel-Id (FR-002)', () => {
    const ergebnis = wahlPrüfen([], WAHLREGEL_M0);
    expect(ergebnis.gewonnen).toBe(false);
    expect(ergebnis.grund_id).toBe('wahl:keine_gruppen');
    expect(schwächsteGruppe([])).toBeUndefined();
  });

  it('Anteile mit Σ ≠ 100 werden normalisiert statt skaliert (K4-Safety-net)', () => {
    const doppelte = [gruppe('unternehmen', 60, 42.6), gruppe('arbeitnehmer', 40, 102.2)];
    const ergebnis = wahlPrüfen(doppelte, WAHLREGEL_M0);
    expect(ergebnis.gewichtete_zufriedenheit).toBeCloseTo((60 * 42.6 + 40 * 102.2) / 144.8, 10);
  });
});
