import { describe, expect, it } from 'vitest';

import {
  SCHWIERIGKEIT_NORMAL,
  indikatorenSchritt,
  indikatorSchritt,
  unterhaltOhneEvents,
  type IndikatorRegel,
} from '@staatslenker/core/indikatoren';

/**
 * M0-Content-Werte aus docs/balance-werte.md §2 (autoritativ, PO D10). Der Kern kennt nur die
 * Struktur — diese Regeln sind Fixture, nicht Kern-Konstanten. Forschung über 85 wirkt 0.20/BE —
 * der von Ralf autorisierte finale Wert aus PO D13 (40 % der Grundwirkung, das Diminishing-Muster
 * der §2-Tabelle: infra 0.5→0.2, bildung 0.6→0.25, wirtschaft 0.4→0.15). Der interim 0.15 ist
 * damit obsolet.
 */
const regeln: readonly IndikatorRegel[] = Object.freeze([
  {
    tag: 'infrastruktur',
    verschleiß: 3,
    budget_wirkung: 0.5,
    diminishing_at: 70,
    diminishing_wirkung: 0.2,
  },
  {
    tag: 'bildung',
    verschleiß: 2,
    budget_wirkung: 0.6,
    diminishing_at: 65,
    diminishing_wirkung: 0.25,
  },
  {
    tag: 'gesundheit',
    verschleiß: 2,
    budget_wirkung: 0.7,
    diminishing_at: 75,
    diminishing_wirkung: 0.2,
  },
  {
    tag: 'wirtschaft',
    verschleiß: 2,
    budget_wirkung: 0.4,
    diminishing_at: 80,
    diminishing_wirkung: 0.15,
  },
  {
    tag: 'forschung',
    verschleiß: 2,
    budget_wirkung: 0.5,
    diminishing_at: 85,
    diminishing_wirkung: 0.2,
    gate: { indikator: 'bildung', min: 50 },
  },
]);

const start: Record<string, number> = {
  infrastruktur: 40,
  bildung: 40,
  gesundheit: 40,
  wirtschaft: 45,
  forschung: 40,
};

describe('Indikatorbewegung pro Jahr (FR-005/FR-006, US-M0-05)', () => {
  it('ohne Budget sinkt jeder Indikator um den Verschleiß; Forschung stagniert bei Bildung < 50 (AC)', () => {
    const neu = indikatorenSchritt(regeln, start, {}, {}, SCHWIERIGKEIT_NORMAL);

    expect(neu.infrastruktur).toBe(37);
    expect(neu.bildung).toBe(38);
    expect(neu.gesundheit).toBe(38);
    expect(neu.wirtschaft).toBe(43);
    // K3: kein Wachstum, kein Verschleiß — Forschung bleibt auf dem Level.
    expect(neu.forschung).toBe(40);
  });

  it('Nichtstun bestraft: nach vier Jahren ohne Budget ist Infrastruktur bei 28 (Verschleiß 3/Jahr)', () => {
    let level = start;
    for (let jahr = 0; jahr < 4; jahr++) {
      level = indikatorenSchritt(regeln, level, {}, {}, SCHWIERIGKEIT_NORMAL);
    }
    expect(level.infrastruktur).toBe(28);
    expect(level.forschung).toBe(40);
  });

  it('mit Budget steigt der Wert um budget_wirkung × BE + ereignis_delta − verschleiss (AC)', () => {
    const neu = indikatorenSchritt(regeln, start, { infrastruktur: 12 }, {}, SCHWIERIGKEIT_NORMAL);
    expect(neu.infrastruktur).toBe(40 + 0.5 * 12 - 3);

    const mitEvent = indikatorenSchritt(
      regeln,
      start,
      {},
      { wirtschaft: -15 },
      SCHWIERIGKEIT_NORMAL,
    );
    expect(mitEvent.wirtschaft).toBe(45 - 15 - 2);
  });

  it('Forschung wird beweglich, sobald Bildung ≥ 50 ist (Gate K3)', () => {
    const mitBildung = { ...start, bildung: 55 };
    const neu = indikatorenSchritt(regeln, mitBildung, { forschung: 8 }, {}, SCHWIERIGKEIT_NORMAL);
    expect(neu.forschung).toBe(40 + 0.5 * 8 - 2);

    // Gate-closed wirkt Budget nicht, aber ein Event-Delta trotzdem (Krise ist external).
    const geschlossen = indikatorenSchritt(
      regeln,
      start,
      { forschung: 8 },
      { forschung: -4 },
      SCHWIERIGKEIT_NORMAL,
    );
    expect(geschlossen.forschung).toBe(36);
  });

  it('diminishing_at senkt die Budgetwirkung ab dem Schwellenwert', () => {
    const hoch: Record<string, number> = { ...start, infrastruktur: 72 };
    const neu = indikatorSchritt(
      regeln[0]!,
      72,
      10,
      0,
      SCHWIERIGKEIT_NORMAL,
      (tag) => hoch[tag] ?? 0,
    );
    expect(neu).toBe(72 + 0.2 * 10 - 3);
    const unterSchwelle = indikatorSchritt(regeln[0]!, 68, 10, 0, SCHWIERIGKEIT_NORMAL, () => 40);
    expect(unterSchwelle).toBe(68 + 0.5 * 10 - 3);
  });

  it('der Schwierigkeits-Multiplikator skaliert den Verschleiß (G6)', () => {
    const schwer = Object.freeze({ ...SCHWIERIGKEIT_NORMAL, verschleiß_multiplikator: 1.3 });
    const neu = indikatorenSchritt(regeln, start, {}, {}, schwer);
    expect(neu.infrastruktur).toBe(40 - 3 * 1.3);
    expect(neu.forschung).toBe(40);
  });

  it('Ergebnisse werden geclampt — ein Event kann keinen Indikator unter 0 oder über 100 ziehen', () => {
    const tief = indikatorenSchritt(
      regeln,
      { infrastruktur: 2 },
      {},
      { infrastruktur: -50 },
      SCHWIERIGKEIT_NORMAL,
    );
    expect(tief.infrastruktur).toBe(0);
    const hoch = indikatorenSchritt(
      regeln,
      { infrastruktur: 98 },
      {},
      { infrastruktur: 50 },
      SCHWIERIGKEIT_NORMAL,
    );
    expect(hoch.infrastruktur).toBe(100);
  });

  it('der alte Snapshot wird nicht mutiert (ADR-002)', () => {
    const neu = indikatorenSchritt(regeln, start, { infrastruktur: 12 }, {}, SCHWIERIGKEIT_NORMAL);
    expect(start.infrastruktur).toBe(40);
    expect(neu).not.toBe(start);
  });

  it('Unterhalt nach der Formel aus balance-werte.md §1: Gate-closed Forschung 17.19 BE, offene 21.19 BE', () => {
    // Die Docs nennen für dieselbe Formel "≈ 12.19 BE" (§1), während §K1 "≈ 17.19 BE" sagt.
    // 3/0.5 + 2/0.6 + 2/0.7 + 2/0.4 = 17.19 — die 12.19 sind die Summe ohne Wirtschaft
    // (6+3.33+2.86) und passen zu keiner Gate-Definition. Getestet wird die Formel; die
    // Numbers-Korrektur ist an Trix/Lens gemeldet (docs/balance-werte.md §1 vs §K1).
    expect(
      unterhaltOhneEvents(regeln, (tag) => (tag === 'bildung' ? 40 : 0), SCHWIERIGKEIT_NORMAL),
    ).toBeCloseTo(17.19, 2);
    expect(
      unterhaltOhneEvents(regeln, (tag) => (tag === 'bildung' ? 55 : 0), SCHWIERIGKEIT_NORMAL),
    ).toBeCloseTo(21.19, 2);
  });

  it('Forschung über 85 wirkt mit dem von Ralf autorisierten finalen Wert 0.20/BE (PO D13)', () => {
    const offen = (tag: string) => (tag === 'bildung' ? 55 : 88);
    const neu = indikatorSchritt(regeln[4]!, 88, 10, 0, SCHWIERIGKEIT_NORMAL, offen);
    expect(neu).toBe(88 + 0.2 * 10 - 2);
  });

  it('Unterhalt über diminishing_at nutzt die abgesenkte Wirkung: Forschung über 85 = 10 BE, gesamt 27.19 BE (0.20)', () => {
    const über85 = (tag: string) => (tag === 'bildung' ? 55 : tag === 'forschung' ? 88 : 40);
    // Ralfs autorisierte Anker: 17.19 BE ohne Forschung, 21.19 mit offenem Gate ≤ 85, 27.19 über 85.
    expect(unterhaltOhneEvents(regeln, über85, SCHWIERIGKEIT_NORMAL)).toBeCloseTo(
      17.19 + 2 / 0.2,
      2,
    );
    // Ein Level über der Schwelle ohne abgesenkten Wert ist ein Content-Fehler (FR-002). Im
    // Fixture ist das ein Typfehler — der Cast modelliert kaputten geladenen Content (YAML).
    const kaputt: readonly IndikatorRegel[] = [
      {
        tag: 'bildung',
        verschleiß: 2,
        budget_wirkung: 0.6,
        diminishing_at: 65,
      } as unknown as IndikatorRegel,
    ];
    expect(() => unterhaltOhneEvents(kaputt, () => 70, SCHWIERIGKEIT_NORMAL)).toThrow(/bildung/);
    expect(unterhaltOhneEvents(kaputt, () => 70, SCHWIERIGKEIT_NORMAL, 'produktion')).toBe(0);
  });

  it('ein diminishing_at ohne diminishing_wirkung ist ein Content-Fehler: Dev wirft, Produktion wirkt 0 (FR-002, Lens-Finding zu PR #5)', () => {
    // `diminishing_wirkung` ist Pflichtfeld; der Cast modelliert kaputten geladenen Content.
    const kaputt = {
      tag: 'bildung',
      verschleiß: 2,
      budget_wirkung: 0.6,
      diminishing_at: 65,
    } as unknown as IndikatorRegel;
    expect(() =>
      indikatorSchritt(kaputt, 70, 10, 0, SCHWIERIGKEIT_NORMAL, () => 40, 'dev'),
    ).toThrow(/indikator:bildung|bildung/);

    const produktion = indikatorSchritt(
      kaputt,
      70,
      10,
      0,
      SCHWIERIGKEIT_NORMAL,
      () => 40,
      'produktion',
    );
    // Über der Schwelle wirkt nichts statt der Grundwirkung — das Level sinkt nur um den Verschleiß.
    expect(produktion).toBe(70 - 2);
  });
});
