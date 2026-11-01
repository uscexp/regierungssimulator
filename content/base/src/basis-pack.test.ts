/**
 * Content-Anker: der Basis-Pack ist aus docs/balance-werte.md abgeleitet, nicht erfunden
 * (US-M0-13). Die Werte werden gegen die Tabellen in §1, §2, §3 und §9 geprüft — ein Wert, der
 * nicht in der Balance-Doku steht, fällt hier auf.
 */
import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

import {
  BASIS_ENTSCHEIDUNGEN,
  BASIS_PACK,
  GRUPPEN_START,
  INDIKATOR_REGELN,
  NEWS_VORLAGEN,
  SCHWIERIGKEIT_PACKS,
  START_INDICATOREN,
  STEUERFAKTOR,
  STEUERLAST,
  validiereBasisPack,
} from '@staatslenker/content-base';

const regelVon = (tag: string) => INDIKATOR_REGELN.find((r) => r.tag === tag)!;

describe('§2 — Indikator-Regeln sind die Tabelle aus balance-werte.md', () => {
  it('hat genau die acht Indikatoren der §2-Tabelle', () => {
    expect(INDIKATOR_REGELN.map((r) => r.tag)).toEqual([
      'infrastruktur',
      'bildung',
      'gesundheit',
      'wirtschaft',
      'forschung',
      'recht',
      'freiheit',
      'sicherheit',
    ]);
  });

  it('trägt Verschleiß und Budget-Wirkung je Zeile der §2-Tabelle', () => {
    const erwartet: Readonly<Record<string, readonly [number, number]>> = {
      infrastruktur: [3, 0.5],
      bildung: [2, 0.6],
      gesundheit: [2, 0.7],
      wirtschaft: [2, 0.4],
      forschung: [2, 0.5],
      recht: [1, 0],
      freiheit: [1, 0],
      sicherheit: [2, 0],
    };
    for (const [tag, [verschleiß, wirkung]] of Object.entries(erwartet)) {
      const regel = regelVon(tag);
      expect([regel.verschleiß, regel.budget_wirkung], tag).toEqual([verschleiß, wirkung]);
    }
  });

  it('trägt die diminishing-Paare der §2-Tabelle (Schwelle und abgesenkte Wirkung)', () => {
    const erwartet: Readonly<Record<string, readonly [number, number]>> = {
      infrastruktur: [70, 0.2],
      bildung: [65, 0.25],
      gesundheit: [75, 0.2],
      wirtschaft: [80, 0.15],
      forschung: [85, 0.2], // Ralfs autorisierter Wert (PO D13) — die §2-Tabelle nennt nur die Schwelle
    };
    for (const [tag, [schwelle, wirkung]] of Object.entries(erwartet)) {
      const regel = regelVon(tag);
      expect([regel.diminishing_at, regel.diminishing_wirkung], tag).toEqual([schwelle, wirkung]);
    }
  });

  it('hat das Forschungs-Gate Bildung ≥ 50 und keine Gates auf den anderen Regeln', () => {
    expect(regelVon('forschung').gate).toEqual({ indikator: 'bildung', min: 50 });
    for (const regel of INDIKATOR_REGELN) {
      if (regel.tag !== 'forschung') expect(regel.gate, regel.tag).toBeUndefined();
    }
  });

  it('hat auf jeder Regel eine Regel-Id (FR-006 — Fehler melden die Id, nicht nur den Tag)', () => {
    for (const regel of INDIKATOR_REGELN) expect(regel.regel_id, regel.tag).toBeTruthy();
  });

  it('adressiert mit keiner Regel einen Indikator, der nicht in der §2-Tabelle steht', () => {
    const budgetbareIndikatoren = new Set([
      'infrastruktur',
      'bildung',
      'gesundheit',
      'wirtschaft',
      'forschung',
      'recht',
      'freiheit',
      'sicherheit',
    ]);
    for (const regel of INDIKATOR_REGELN)
      expect(budgetbareIndikatoren.has(regel.tag), regel.tag).toBe(true);
  });
});

describe('§1 — Einnahmen und Start', () => {
  it('hat die Steuerfaktor-Tabelle mit flat 0.8 als M0-Anker (K2)', () => {
    expect(STEUERFAKTOR).toEqual({ niedrig: 0.6, flat: 0.8, progressiv: 1.0, hoch: 1.2 });
  });

  it('hat das §1-Startbild: Wirtschaft 45, alle übrigen Indikatoren 40', () => {
    expect(START_INDICATOREN).toEqual({
      infrastruktur: 40,
      bildung: 40,
      gesundheit: 40,
      wirtschaft: 45,
      forschung: 40,
      recht: 40,
      freiheit: 40,
      sicherheit: 40,
    });
  });
});

describe('§3 — Gruppen', () => {
  it('hat die zehn Gruppen mit den §3-Anteilen (Σ = 100, K4)', () => {
    const anteile = GRUPPEN_START.map((g) => g.bevölkerungsanteil);
    expect(anteile).toEqual([22.08, 9.2, 11.96, 11.04, 14.72, 8.28, 7.36, 7.36, 5, 3]);
    expect(anteile.reduce((acc, g) => acc + g, 0)).toBeCloseTo(100, 6);
  });

  it('hat die §3-Gewichte je Gruppe (je Σ = 1)', () => {
    const erwartet: Readonly<Record<string, Readonly<Record<string, number>>>> = {
      arbeitnehmer: { wirtschaft: 0.45, gesundheit: 0.25, recht: 0.15, sicherheit: 0.15 },
      unternehmen: { wirtschaft: 0.55, infrastruktur: 0.3, sicherheit: 0.15 },
      bildung_jugend: { bildung: 0.6, forschung: 0.25, freiheit: 0.15 },
      gesundheit_wesen: { gesundheit: 0.7, forschung: 0.15, infrastruktur: 0.15 },
      konservative: { sicherheit: 0.55, recht: 0.25, wirtschaft: 0.2 },
      liberale_minderheiten: { freiheit: 0.6, recht: 0.25, bildung: 0.15 },
      staatsapparat: { infrastruktur: 0.5, sicherheit: 0.3, bildung: 0.2 },
      landwirte: { wirtschaft: 0.6, infrastruktur: 0.4 },
      elite: { wirtschaft: 1 },
      militaer: { sicherheit: 1 },
    };
    for (const gruppe of GRUPPEN_START) {
      expect(gruppe.gewichte, gruppe.tag).toEqual(erwartet[gruppe.tag]);
      const summe = Object.values(gruppe.gewichte).reduce((acc, w) => acc + w, 0);
      expect(Math.abs(summe - 1) <= 1e-9, gruppe.tag).toBe(true);
    }
  });

  it('hat die §3-Steuerlast je Gruppe in Reihenfolge niedrig/flat/progressiv/hoch', () => {
    const erwartet: Readonly<Record<string, readonly [number, number, number, number]>> = {
      arbeitnehmer: [2, 4, 3, 8],
      unternehmen: [0, 4, 8, 12],
      bildung_jugend: [2, 4, 3, 8],
      gesundheit_wesen: [2, 4, 3, 8],
      konservative: [2, 4, 2, 7],
      liberale_minderheiten: [2, 4, 2, 7],
      staatsapparat: [3, 4, 3, 8],
      landwirte: [2, 4, 2, 7],
      elite: [2, 4, 2, 7],
      militaer: [2, 4, 2, 7],
    };
    for (const [tag, werte] of Object.entries(erwartet)) {
      const last = STEUERLAST[tag]!;
      expect([last.niedrig, last.flat, last.progressiv, last.hoch], tag).toEqual(werte);
    }
  });

  it('liefert keine Zufriedenheits-Werte als Content — die rechnet der Kern (eine Formel)', () => {
    // Der Start-Platzhalter ist 0; die Start-Zufriedenheit kommt aus core/zufriedenheit.
    for (const gruppe of GRUPPEN_START) expect(gruppe.zufriedenheit, gruppe.tag).toBe(0);
  });
});

describe('§9 — Schwierigkeit ist ein Parameter-Pack', () => {
  it('hat die drei Packs mit den §9-Werten', () => {
    expect(SCHWIERIGKEIT_PACKS.leicht).toEqual({
      verschleiß_multiplikator: 0.7,
      pk_regeneration: 1.2,
      event_wahrscheinlichkeit: 0.6,
      schuldenlimit: 120,
      zinsfaktor: 0.05,
      budget_zuschuss: 10,
    });
    expect(SCHWIERIGKEIT_PACKS.normal).toEqual({
      verschleiß_multiplikator: 1.0,
      pk_regeneration: 1.0,
      event_wahrscheinlichkeit: 1.0,
      schuldenlimit: 100,
      zinsfaktor: 0.08,
      budget_zuschuss: 0,
    });
    expect(SCHWIERIGKEIT_PACKS.schwer).toEqual({
      verschleiß_multiplikator: 1.3,
      pk_regeneration: 0.8,
      event_wahrscheinlichkeit: 1.4,
      schuldenlimit: 80,
      zinsfaktor: 0.12,
      budget_zuschuss: -10,
    });
  });
});

describe('G11 — News-Vorlagen sind Content', () => {
  it('hat eine Vorlage für das Spar-Event (§6) mit dem Gruppen-Abzug −5', () => {
    expect(NEWS_VORLAGEN.sparen).toBeTruthy();
    expect(NEWS_VORLAGEN.sparen).toContain('5');
  });
});

describe('PO D10 — die fünf Basis-Entscheidungen', () => {
  it('sind genau die fünf budgetbaren Indikatoren, keine Karte, kein PK-Kosten', () => {
    expect(BASIS_ENTSCHEIDUNGEN.map((e) => e.indikator)).toEqual([
      'infrastruktur',
      'bildung',
      'gesundheit',
      'wirtschaft',
      'forschung',
    ]);
    for (const entscheidung of BASIS_ENTSCHEIDUNGEN) {
      expect(entscheidung.pk_kosten).toBe(0);
      expect(entscheidung.pk_kosten).toBeGreaterThanOrEqual(0);
      expect(entscheidung.pk_kosten).toBeLessThanOrEqual(3); // FR-011-Grenze für Karten (M3)
      expect(entscheidung.label).toBeTruthy();
      expect(entscheidung.beschreibung).toBeTruthy();
    }
  });
});

describe('Content liegt in content-base, der Adapter enthält keine Zahlen', () => {
  it('validiert den Pack auf demselben Weg wie ein Mod-Pack (ADR-003)', () => {
    expect(validiereBasisPack('dev').fehlerfrei).toBe(true);
    expect(validiereBasisPack('produktion').fehlerfrei).toBe(true);
  });

  it('hat keine Balance-Zahlen mehr im CLI-Adapter', () => {
    const adapter = readFileSync('cli/src/content-pack.ts', 'utf8');
    expect(adapter).not.toMatch(/verschleiß\s*:/);
    expect(adapter).not.toMatch(/budget_wirkung\s*:/);
    expect(adapter).not.toMatch(/schuldenlimit\s*:/);
    expect(adapter).toContain('@staatslenker/content-base');
  });

  it('ist ein vollständiger Pack: alle Teile sind vorhanden', () => {
    expect(Object.keys(BASIS_PACK).sort()).toEqual([
      'entscheidungen',
      'gruppen',
      'indikator_regeln',
      'news_vorlagen',
      'schwierigkeit_packs',
      'start_indikatoren',
      'steuerfaktor',
      'steuerlast',
    ]);
  });
});
