/**
 * AutoSim-Harness-Tests (US-M0-13, FR-011). Die Anker werden über die core-Funktionen gemessen,
 * nicht hartcodiert geraten: `unterhaltOhneEvents`, `einnahmenBe`, `gewichteteZufriedenheit` und
 * `tick` rechnen gegen das Content-Pack aus docs/balance-werte.md.
 */
import { describe, expect, it } from 'vitest';

import { einnahmenBe } from '@staatslenker/core/budget';
import { SCHWIERIGKEIT_NORMAL, unterhaltOhneEvents } from '@staatslenker/core/indikatoren';
import { gewichteteZufriedenheit, gruppenZufriedenheit } from '@staatslenker/core/zufriedenheit';
import {
  ANKER_LEVEL_FORSCHUNG_UEBER_85,
  ANKER_LEVEL_UNTER_SCHWELLE,
  GRUPPEN_START,
  INDIKATOR_REGELN,
  SCHWIERIGKEIT_PACKS,
  START_INDICATOREN,
  STEUERFAKTOR,
  STEUERLAST,
} from '@staatslenker/cli/content-pack';
import { ANZAHL_SEEDS, STRATEGIE_IDS, alleLäufe, runSim } from '@staatslenker/cli/autosim';

const levelVon = (map: Readonly<Record<string, number>>) => (tag: string) => map[tag] ?? 0;
const gateZu = (tag: string) => (tag === 'wirtschaft' ? 45 : 40); // Bildung 40 → Forschungs-Gate zu

describe('Content-Pack gegen balance-werte.md validiert (K4: Σ-Anteile 100, Gewichte Σ 1)', () => {
  it('Gruppenanteile summieren auf 100 % und Gewichte je Gruppe auf 1 (§3, K4)', () => {
    const anteile = GRUPPEN_START.reduce((s, g) => s + g.bevölkerungsanteil, 0);
    expect(anteile).toBe(100);
    for (const gruppe of GRUPPEN_START) {
      const summe = Object.values(gruppe.gewichte).reduce((s, w) => s + w, 0);
      expect(summe).toBeCloseTo(1, 10);
    }
  });

  it('das normal-Pack des Content ist identisch zum Kern-Fixture SCHWIERIGKEIT_NORMAL (§9)', () => {
    expect(SCHWIERIGKEIT_PACKS.normal).toEqual(SCHWIERIGKEIT_NORMAL);
    expect(SCHWIERIGKEIT_PACKS.leicht).toEqual({
      verschleiß_multiplikator: 0.7,
      pk_regeneration: 1.2,
      event_wahrscheinlichkeit: 0.6,
      schuldenlimit: 120,
      zinsfaktor: 0.05,
      budget_zuschuss: 10,
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

describe('Unterhalt-Anker §2/K1/K3 gemessen über core unterhaltOhneEvents', () => {
  it('normal: 17.19 BE ohne Forschung, 21.19 BE mit offenem Gate ≤ 85, 27.19 BE über 85', () => {
    expect(unterhaltOhneEvents(INDIKATOR_REGELN, gateZu, SCHWIERIGKEIT_PACKS.normal)).toBeCloseTo(
      17.19,
      2,
    );
    expect(
      unterhaltOhneEvents(
        INDIKATOR_REGELN,
        levelVon(ANKER_LEVEL_UNTER_SCHWELLE),
        SCHWIERIGKEIT_PACKS.normal,
      ),
    ).toBeCloseTo(21.19, 2);
    expect(
      unterhaltOhneEvents(
        INDIKATOR_REGELN,
        levelVon(ANKER_LEVEL_FORSCHUNG_UEBER_85),
        SCHWIERIGKEIT_PACKS.normal,
      ),
    ).toBeCloseTo(27.19, 2);
  });

  it('leicht (Verschleiß×0.7, wirkt auf alle Regeln inkl. Forschung): 12.03 / 14.83 / 19.03 BE', () => {
    expect(unterhaltOhneEvents(INDIKATOR_REGELN, gateZu, SCHWIERIGKEIT_PACKS.leicht)).toBeCloseTo(
      12.03,
      2,
    );
    expect(
      unterhaltOhneEvents(
        INDIKATOR_REGELN,
        levelVon(ANKER_LEVEL_UNTER_SCHWELLE),
        SCHWIERIGKEIT_PACKS.leicht,
      ),
    ).toBeCloseTo(14.83, 2);
    expect(
      unterhaltOhneEvents(
        INDIKATOR_REGELN,
        levelVon(ANKER_LEVEL_FORSCHUNG_UEBER_85),
        SCHWIERIGKEIT_PACKS.leicht,
      ),
    ).toBeCloseTo(19.03, 2);
  });

  it('schwer (Verschleiß×1.3): 22.35 / 27.55 / 35.35 BE', () => {
    expect(unterhaltOhneEvents(INDIKATOR_REGELN, gateZu, SCHWIERIGKEIT_PACKS.schwer)).toBeCloseTo(
      22.35,
      2,
    );
    expect(
      unterhaltOhneEvents(
        INDIKATOR_REGELN,
        levelVon(ANKER_LEVEL_UNTER_SCHWELLE),
        SCHWIERIGKEIT_PACKS.schwer,
      ),
    ).toBeCloseTo(27.55, 2);
    expect(
      unterhaltOhneEvents(
        INDIKATOR_REGELN,
        levelVon(ANKER_LEVEL_FORSCHUNG_UEBER_85),
        SCHWIERIGKEIT_PACKS.schwer,
      ),
    ).toBeCloseTo(35.35, 2);
  });
});

describe('Einnahmen/Spielraum-Anker §1/K2 gemessen über core einnahmenBe', () => {
  it('flat bei Wirtschaft 45: leicht 46, normal 36, schwer 26 BE (§1 + §9 Zuschuss)', () => {
    expect(einnahmenBe(45, STEUERFAKTOR.flat, SCHWIERIGKEIT_PACKS.normal)).toBe(36);
    expect(einnahmenBe(45, STEUERFAKTOR.flat, SCHWIERIGKEIT_PACKS.leicht)).toBe(46);
    expect(einnahmenBe(45, STEUERFAKTOR.flat, SCHWIERIGKEIT_PACKS.schwer)).toBe(26);
  });

  it('Spielraum gegen 36 BE: 14.81 BE mit offenem Forschungsgate, 8.81 BE über 85', () => {
    const offen = unterhaltOhneEvents(
      INDIKATOR_REGELN,
      levelVon(ANKER_LEVEL_UNTER_SCHWELLE),
      SCHWIERIGKEIT_PACKS.normal,
    );
    const ueber85 = unterhaltOhneEvents(
      INDIKATOR_REGELN,
      levelVon(ANKER_LEVEL_FORSCHUNG_UEBER_85),
      SCHWIERIGKEIT_PACKS.normal,
    );
    expect(36 - offen).toBeCloseTo(14.81, 2);
    expect(36 - ueber85).toBeCloseTo(8.81, 2);
  });
});

describe('gewichtete Start-Ø gemessen über core gewichteteZufriedenheit (§4)', () => {
  it('Anker 46.0 bei Startlevel 40 (§4-Rechnung: 10 + 40 − 4 je Gruppe)', () => {
    const alleVierzig = Object.fromEntries(Object.keys(START_INDICATOREN).map((t) => [t, 40]));
    const gruppen = gruppenZufriedenheit(GRUPPEN_START, alleVierzig, 'flat', STEUERLAST);
    expect(gewichteteZufriedenheit(gruppen)).toBeCloseTo(46.0, 10);
  });

  it('gemessener §1-Start (Wirtschaft 45, übrige 40) ergibt 47.215 — nicht 46.0 wie §4 behauptet', () => {
    // §4 rechnet mit "Startlevel 40", §1 setzt Wirtschaft auf 45. Über das §1-Startbild gemessen:
    // Arbeitnehmer 48.25, Unternehmen 48.75, Konservative 47, Landwirte 49, übrige 46 → 47.215.
    const gruppen = gruppenZufriedenheit(GRUPPEN_START, START_INDICATOREN, 'flat', STEUERLAST);
    expect(gewichteteZufriedenheit(gruppen)).toBeCloseTo(47.215, 6);
  });
});

describe('Naiv-Kurve durch den echten Tick (dev-Modus, Invarianten ohne Wurf)', () => {
  it('Jahr-1-Zeile: Einnahmen 36 / Unterhalt 17.19 / Defizit 0 / keine Wahl (normal, gleichmaessig)', () => {
    const lauf = runSim('gleichmaessig', 1, 'normal', 4);
    const jahr1 = lauf.rows[0]!;
    expect(jahr1.einnahmen).toBe(36);
    expect(jahr1.unterhalt_be).toBeCloseTo(17.19, 2);
    expect(jahr1.defizit).toBe(0);
    expect(jahr1.wahl_grund).toBe('-');
    // PK-Regeneration am Jahresende: 5 + 50/10 × 1.0 = 10 (§5).
    expect(jahr1.pk).toBe(10);
  });

  it('Jahr-4-Wahl = verloren mit grund_id "wahl:gewichtete_unter_50" (US-M0-12 Anker)', () => {
    const lauf = runSim('gleichmaessig', 1, 'normal', 4);
    const wahl = lauf.wahlen[0]!;
    expect(wahl.jahr).toBe(4);
    expect(wahl.gewonnen).toBe(false);
    expect(wahl.grund_id).toBe('wahl:gewichtete_unter_50');
    expect(lauf.jahre_survived).toBe(4);
    expect(lauf.final_state.wahl_niederlage).toEqual({
      jahr: 4,
      grund_id: 'wahl:gewichtete_unter_50',
    });
  });

  it('alle Naiv-Kombinationen verlieren die Jahr-4-Wahl und überleben genau 4 Jahre', () => {
    for (const lauf of alleLäufe(30)) {
      expect(lauf.jahre_survived).toBe(4);
      expect(lauf.wahlen.length).toBe(1);
      expect(lauf.wahlen[0]!.gewonnen).toBe(false);
      expect(lauf.first_deficit_year).toBeNull(); // Zuteilung ≤ 10 BE gegen Einnahmen 26–46 BE
      expect(lauf.first_spar_year).toBeNull(); // Schulden bleiben 0 → kein Spar-Event (§6)
    }
    expect(STRATEGIE_IDS.length).toBe(3);
  });
});

describe('Determinismus und Seed-Unterscheidung (FR-004)', () => {
  it('Seed-Replay ist exakt: gleicher Seed, zweimal geführt → gleicher Final-State', () => {
    const einmal = runSim('bildung_zuerst', 7, 'schwer');
    const zweimal = runSim('bildung_zuerst', 7, 'schwer');
    expect(JSON.stringify(einmal.final_state)).toBe(JSON.stringify(zweimal.final_state));
    expect(JSON.stringify(einmal.rows)).toBe(JSON.stringify(zweimal.rows));
  });

  it('20 Seeds liefern 20 verschiedene Snapshots; ohne Event-Regeln sind die Kurven seedgleich', () => {
    // Der Pack enthält keine Event-Regeln (balance-werte.md definiert keine Events → M2-Content),
    // der Tick würfelt nicht; die Unterscheidung der Seeds liegt im RNG-Zustand des Snapshots.
    const snaps = new Set<string>();
    const kurven = new Set<string>();
    for (let seed = 1; seed <= ANZAHL_SEEDS; seed++) {
      const lauf = runSim('infrastruktur_zuerst', seed, 'normal');
      snaps.add(JSON.stringify(lauf.final_state));
      kurven.add(JSON.stringify(lauf.rows));
    }
    expect(snaps.size).toBe(ANZAHL_SEEDS);
    expect(kurven.size).toBe(1);
  });
});
