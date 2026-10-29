/**
 * Turn-Tests (US-M0-14, FR-048): ein Turn ist Budget → Basis-Entscheidung → tick → Lagebericht.
 * Der Adapter rechnet nichts; jede ungültige Eingabe hat eine definiertes Verhalten mit Grund.
 */
import { describe, expect, it } from 'vitest';

import { startState, tickRegelnFür } from '@staatslenker/cli/content-pack';
import {
  budgetbareKategorien,
  entscheidungen,
  prüfeEingabe,
  turn,
  demonstration,
} from '@staatslenker/cli/turn';

const regeln = tickRegelnFür('normal');
const gleichmaessig = { infrastruktur: 2, bildung: 2, gesundheit: 2, wirtschaft: 2, forschung: 2 };

describe('Ein Turn führt den Kern-Loop', () => {
  it('rückt das Jahr vor und schreibt die Basis-Entscheidung ins Gedächtnis (PO-Ruling zu US-M0-14)', () => {
    const state = startState(1234);
    const ergebnis = turn(state, regeln, {
      zuteilung: gleichmaessig,
      entscheidung_id: 'entscheidung:bildung',
    });
    expect(ergebnis.ergebnis.state.jahr).toBe(2);
    // PO D10 + Ruling: die Allokation ist ein Beschluss ohne Karte — kein PK, keine Wirkungseinträge.
    expect(ergebnis.ergebnis.state.beschlüsse).toHaveLength(1);
    expect(ergebnis.ergebnis.state.beschlüsse[0]!.regel_id).toBe('entscheidung:bildung');
    expect(ergebnis.ergebnis.state.beschlüsse[0]!.wirkung).toHaveLength(0);
    expect(ergebnis.entscheidung.indikator).toBe('bildung');
    expect(ergebnis.spielende).toBe(false);
  });

  it('verbraucht kein politisches Kapital für eine Basis-Entscheidung (PO D10: Karten sind M3)', () => {
    const state = startState(1234);
    const ergebnis = turn(state, regeln, {
      zuteilung: gleichmaessig,
      entscheidung_id: 'entscheidung:forschung',
    });
    // Der Turn kostet kein PK; die Regeneration am Jahresende (FR-011, balance §5) darf steigen.
    expect(ergebnis.ergebnis.state.politisches_kapital).toBeGreaterThanOrEqual(
      state.politisches_kapital,
    );
  });

  it('bewegt den gewählten Indikator über die budget_wirkung des Packs (§2)', () => {
    const state = startState(1234);
    const ergebnis = turn(state, regeln, {
      zuteilung: { wirtschaft: 4 },
      entscheidung_id: 'entscheidung:wirtschaft',
    });
    // Wirtschaft 45 + 4 * 0.4 − 2 Verschleiß = 44.6.
    expect(ergebnis.ergebnis.state.indikatoren.wirtschaft).toBeCloseTo(44.6, 10);
  });

  it('ist deterministisch: gleicher Seed, zweimal geführt → gleiche Berichte (FR-004)', () => {
    const einmal = turn(startState(7), regeln, {
      zuteilung: gleichmaessig,
      entscheidung_id: 'entscheidung:gesundheit',
    });
    const zweimal = turn(startState(7), regeln, {
      zuteilung: gleichmaessig,
      entscheidung_id: 'entscheidung:gesundheit',
    });
    expect(einmal.lagebericht_nach).toBe(zweimal.lagebericht_nach);
    expect(einmal.ergebnis.state).toEqual(zweimal.ergebnis.state);
  });

  it('der alte Snapshot wird nie mutiert (ADR-002)', () => {
    const state = startState(1234);
    const vorJahr = state.jahr;
    turn(state, regeln, {
      zuteilung: gleichmaessig,
      entscheidung_id: 'entscheidung:infrastruktur',
    });
    expect(state.jahr).toBe(vorJahr);
    expect(state.beschlüsse).toHaveLength(0);
  });
});

describe('Ungültige Eingabe hat eine definiertes Verhalten (Grund statt Absturz)', () => {
  it('lehnt eine unbekannte Entscheidung ab und nennt die wählbaren Ids', () => {
    const prüfung = prüfeEingabe(startState(1234), regeln, {
      zuteilung: gleichmaessig,
      entscheidung_id: 'entscheidung:karten',
    });
    expect(prüfung.ok).toBe(false);
    if (!prüfung.ok) {
      expect(prüfung.grund).toContain('entscheidung:infrastruktur');
      expect(prüfung.grund).toContain('entscheidung:karten');
    }
  });

  it('lehnt eine Allokation auf einem nicht-budgetbaren Indikator ab (balance §2)', () => {
    const prüfung = prüfeEingabe(startState(1234), regeln, {
      zuteilung: { recht: 3 },
      entscheidung_id: 'entscheidung:bildung',
    });
    expect(prüfung.ok).toBe(false);
    if (!prüfung.ok) expect(prüfung.grund).toContain('nicht per Budget unterhaltbar');
  });

  it('lehnt eine unbekannte Kategorie, NaN und negative Werte ab', () => {
    const base = { entscheidung_id: 'entscheidung:bildung' };
    expect(prüfeEingabe(startState(1234), regeln, { ...base, zuteilung: { unkannt: 1 } }).ok).toBe(
      false,
    );
    expect(
      prüfeEingabe(startState(1234), regeln, { ...base, zuteilung: { bildung: Number.NaN } }).ok,
    ).toBe(false);
    expect(prüfeEingabe(startState(1234), regeln, { ...base, zuteilung: { bildung: -2 } }).ok).toBe(
      false,
    );
  });

  it('verlangt mindestens 1 BE auf dem Indikator der gewählten Entscheidung', () => {
    const prüfung = prüfeEingabe(startState(1234), regeln, {
      zuteilung: { infrastruktur: 2 },
      entscheidung_id: 'entscheidung:forschung',
    });
    expect(prüfung.ok).toBe(false);
    if (!prüfung.ok) {
      expect(prüfung.grund).toContain('mindestens 1 BE');
      expect(prüfung.grund).toContain('forschung');
    }
  });

  it('turn wirft den Prüfungsgrund als TypeError, wenn der REPL nicht vorher geprüft hat', () => {
    expect(() =>
      turn(startState(1234), regeln, {
        zuteilung: { sicherheit: 1 },
        entscheidung_id: 'entscheidung:sicherheit',
      }),
    ).toThrow(TypeError);
  });

  it('das Pack kennt genau die fünf budgetbaren Kategorien und fünf Basis-Entscheidungen', () => {
    expect(budgetbareKategorien(regeln)).toEqual([
      'infrastruktur',
      'bildung',
      'gesundheit',
      'wirtschaft',
      'forschung',
    ]);
    expect(entscheidungen()).toHaveLength(5);
  });
});

describe('Der nicht-interaktive Boot ist ein echter Loop', () => {
  it('die Demonstration endet beim verlorenen Machtcheck Jahr 6 (D18: Zyklus 6)', () => {
    const zeilen = demonstration(1234, 'normal', 6, regeln, startState);
    expect(zeilen.join('\n')).toContain('Jahr 1');
    expect(zeilen.join('\n')).toContain('Machtcheck Jahr 6: VERLOREN');
    expect(zeilen.join('\n')).toContain('Spiel beendet');
  });

  it('die Demonstration ist deterministisch über den Seed', () => {
    const a = demonstration(99, 'schwer', 3, tickRegelnFür('schwer'), startState).join('\n');
    const b = demonstration(99, 'schwer', 3, tickRegelnFür('schwer'), startState).join('\n');
    expect(a).toBe(b);
  });
});
