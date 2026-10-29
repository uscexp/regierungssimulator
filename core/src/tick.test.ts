import { describe, expect, it } from 'vitest';

import { tick, type TickRegeln } from '@staatslenker/core/tick';
import { SCHWIERIGKEIT_NORMAL, type IndikatorRegel } from '@staatslenker/core/indikatoren';
import type { SteuerfaktorTabelle } from '@staatslenker/core/budget';
import {
  erzeugeGameState,
  type Effekt,
  type GruppenSnapshot,
  type GameState,
  type Startkonfiguration,
} from '@staatslenker/core/state';
import type { SteuerlastTabelle } from '@staatslenker/core/zufriedenheit';
import type { EreignisRegel } from '@staatslenker/core/ereignisse';
import { WAHLREGEL_M0, wahlRegelAlsPrüfung } from '@staatslenker/core/wahl';

const indikator_regeln: readonly IndikatorRegel[] = [
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
];

const steuerfaktor: SteuerfaktorTabelle = { niedrig: 0.6, flat: 0.8, progressiv: 1.0, hoch: 1.2 };
const steuerlast: SteuerlastTabelle = {
  unternehmen: { niedrig: 0, flat: 4, progressiv: 8, hoch: 12 },
  arbeitnehmer: { niedrig: 2, flat: 4, progressiv: 3, hoch: 8 },
  bildung_jugend: { niedrig: 2, flat: 4, progressiv: 3, hoch: 8 },
};

const ereignis_regeln: readonly EreignisRegel[] = [
  {
    id: 'rezession',
    gewicht: 1,
    effekte: [
      { ziel: 'indikatoren', tag: 'wirtschaft', delta: -10 },
      { ziel: 'gruppen', tag: 'unternehmen', delta: -6 },
    ],
  },
];

const start: Startkonfiguration = {
  jahr: 1,
  indikatoren: { infrastruktur: 40, bildung: 40, gesundheit: 40, wirtschaft: 45, forschung: 40 },
  gruppen: [
    {
      tag: 'unternehmen',
      zufriedenheit: 49.21,
      bevölkerungsanteil: 21.3,
      gewichte: { wirtschaft: 0.647, infrastruktur: 0.353 },
    },
    {
      tag: 'arbeitnehmer',
      zufriedenheit: 49.21,
      bevölkerungsanteil: 51.1,
      gewichte: { wirtschaft: 0.643, gesundheit: 0.357 },
    },
    {
      tag: 'bildung_jugend',
      zufriedenheit: 46.0,
      bevölkerungsanteil: 27.7,
      gewichte: { bildung: 0.706, forschung: 0.294 },
    },
  ],
  budget: {},
  politisches_kapital: 5,
  legitimitaet: 50,
  schulden: 0,
  radikalisierung: 10,
  rng: { seed: 424242, counter: 0 },
  konstitution: { steuermodell: 'flat' },
  zufriedenheits_trace: {},
};

function stateMit(extra: Partial<Startkonfiguration> = {}): GameState {
  return erzeugeGameState({ ...start, ...extra });
}

function regelnMit(extra: Partial<TickRegeln> = {}): TickRegeln {
  return {
    indikator_regeln,
    steuerfaktor,
    steuerlast,
    schwierigkeit: SCHWIERIGKEIT_NORMAL,
    ...extra,
  };
}

const deepcopy = (wert: unknown): unknown => structuredClone(wert);

describe('tick — ein Jahr Simulation (FR-001, US-M0-11)', () => {
  it('der alte Snapshot ist danach deep-equal unverändert und der Rückgabewert enthält State, Events und News (AC)', () => {
    const state = stateMit({ schulden: 100 });
    const vorher = deepcopy(state);
    const ergebnis = tick(state, { zuteilung: { bildung: 10 } }, regelnMit());

    expect(deepcopy(state)).toEqual(vorher);
    expect(ergebnis.state).not.toBe(state);
    expect(ergebnis.state.jahr).toBe(2);
    expect(ergebnis.ereignisse.length).toBeGreaterThan(0);
    expect(ergebnis.news.length).toBe(ergebnis.ereignisse.length);
    expect(ergebnis.news.every((n) => typeof n.text === 'string' && n.text.length > 0)).toBe(true);
    expect(ergebnis.state.beschlüsse).toHaveLength(0);
  });

  it('die Indikatorbewegung läuft im Budget-Schritt: ohne Budget sinkt Bildung um 2, Forschung bleibt Gate-geschlossen', () => {
    const ergebnis = tick(stateMit(), { zuteilung: {} }, regelnMit({ ereignis_regeln: [] }));
    expect(ergebnis.state.indikatoren.bildung).toBe(38);
    expect(ergebnis.state.indikatoren.infrastruktur).toBe(37);
    expect(ergebnis.state.indikatoren.forschung).toBe(40);
    expect(ergebnis.state.indikatoren.wirtschaft).toBe(43);
  });

  it('Budget wirkt: 12 BE in Bildung heben den Level um 0.6 × 12 − 2', () => {
    const ergebnis = tick(
      stateMit(),
      { zuteilung: { bildung: 12 } },
      regelnMit({ ereignis_regeln: [] }),
    );
    expect(ergebnis.state.indikatoren.bildung).toBe(40 + 0.6 * 12 - 2);
    expect(ergebnis.state.budget).toEqual({ bildung: 12 });
  });

  it('gleicher Seed und gleiche Action ergeben exakt denselben Verlauf (FR-004)', () => {
    const regeln = regelnMit({ ereignis_regeln });
    let a = stateMit();
    let b = stateMit();
    for (let jahr = 0; jahr < 5; jahr++) {
      a = tick(a, { zuteilung: { bildung: 6, wirtschaft: 8 } }, regeln).state;
      b = tick(b, { zuteilung: { bildung: 6, wirtschaft: 8 } }, regeln).state;
    }
    expect(deepcopy(a)).toEqual(deepcopy(b));
    expect(a.rng.counter).toBe(5);
  });

  it('eine Karte verbraucht PK und kommt ins Entscheidungsgedächtnis; ihre Wirkung wirkt in diesem Jahr', () => {
    const wirkung: readonly Effekt[] = [{ ziel: 'indikatoren', tag: 'bildung', delta: 3 }];
    const ergebnis = tick(
      stateMit({ politisches_kapital: 5 }),
      { zuteilung: {}, karten: [{ regel_id: 'karte:bildungsausbau', pk_kosten: 2, wirkung }] },
      regelnMit({ ereignis_regeln: [] }),
    );

    expect(ergebnis.state.politisches_kapital).toBe(5 - 2 + 5); // Einsatz 2, Regeneration Legitimität 50 / 10 = 5
    expect(ergebnis.state.beschlüsse).toHaveLength(1);
    expect(ergebnis.state.beschlüsse[0]!.wirkt_bis_jahr).toBe(3);
    expect(ergebnis.state.indikatoren.bildung).toBe(40 + 0.6 * 0 + 3 - 2);
  });

  it('eine Karte über dem PK-Bestand wird mit Regel-Id abgewiesen, der State bleibt unverändert (FR-002)', () => {
    const state = stateMit({ politisches_kapital: 1 });
    const vorher = deepcopy(state);
    expect(() =>
      tick(
        state,
        { zuteilung: {}, karten: [{ regel_id: 'karte:teuer', pk_kosten: 3, wirkung: [] }] },
        regelnMit(),
      ),
    ).toThrow(/karte:teuer/);
    expect(deepcopy(state)).toEqual(vorher);
  });

  it('eine Budget-Allokation-Action schreibt kein Gedächtnis-Entry und verändert keine Zahl (Pädu-Ruling zu PR #20)', () => {
    const state = stateMit({ politisches_kapital: 5 });
    const mitAktion = tick(
      state,
      { zuteilung: { bildung: 12 }, budget_allokation: { regel_id: 'entscheidung:bildung' } },
      regelnMit({ ereignis_regeln: [] }),
    );
    const ohneAktion = tick(
      state,
      { zuteilung: { bildung: 12 } },
      regelnMit({ ereignis_regeln: [] }),
    );

    // Das Gedächtnis ist ein Gameplay-Objekt: ein wirkungsloser Eintrag wäre Rauschen zwischen
    // echten Gesetzen und würde den Active-Bestand des Golden-Replays verändern.
    expect(mitAktion.state.beschlüsse).toHaveLength(0);
    expect(mitAktion.state.politisches_kapital).toBe(ohneAktion.state.politisches_kapital);
    expect(mitAktion.state.indikatoren).toEqual(ohneAktion.state.indikatoren);
    expect(mitAktion.state.jahr).toBe(ohneAktion.state.jahr);
  });

  it('der Tick meldet die gekürzten BE des Budget-Schritts im Ergebnis (FR-041, §1/§6)', () => {
    const ergebnis = tick(
      stateMit({ schulden: 100 }),
      { zuteilung: { bildung: 50 } },
      regelnMit({ ereignis_regeln: [] }),
    );
    expect(ergebnis.gekuerzte_be).toBeGreaterThan(0);
  });

  it('das Spar-Event trifft alle Gruppen und erscheint in Events und News (§6)', () => {
    const ergebnis = tick(
      stateMit({ schulden: 100 }),
      { zuteilung: { bildung: 30 } },
      regelnMit({
        ereignis_regeln: [],
        news_vorlagen: { sparen: 'Das Sparprogramm trifft alle Gruppen.' },
      }),
    );
    const sparen = ergebnis.ereignisse.find((e) => e.ereignis_id === 'sparen');
    expect(sparen).toBeDefined();
    expect(ergebnis.news.find((n) => n.id === 'sparen')!.text).toBe(
      'Das Sparprogramm trifft alle Gruppen.',
    );
    // Zufriedenheit am Jahrsanfang bleibt stehen; die Spar-Kürze trifft die Gruppen im selben Tick.
    expect(ergebnis.state.gruppen.every((g) => g.zufriedenheit < 49.25)).toBe(true);
    expect(ergebnis.state.gruppen.find((g) => g.tag === 'bildung_jugend')!.zufriedenheit).toBe(
      41.0,
    );
  });

  it('der Machtcheck läuft alle sechs Jahre und die Wahlregel kommt von außen (PO-Ruling: Zyklus 6)', () => {
    const verloren = (gruppen: readonly GruppenSnapshot[]) => ({
      gewonnen: false,
      grund_id: 'wahl:gewichtete_unter_47',
      gewichtete_zufriedenheit: 46,
      schwächste_gruppe: gruppen[0]!.tag,
    });
    const sechste = tick(
      stateMit({ jahr: 6 }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], wahlPruefen: verloren }),
    );
    expect(sechste.wahl?.gewonnen).toBe(false);
    expect(sechste.state.wahl_niederlage).toEqual({
      jahr: 6,
      grund_id: 'wahl:gewichtete_unter_47',
    });

    const dritte = tick(
      stateMit({ jahr: 3 }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], wahlPruefen: verloren }),
    );
    expect(dritte.wahl).toBeUndefined();
    expect(dritte.state.wahl_niederlage).toBeUndefined();
  });

  it('ein Intervall-Konflikt protokolliert keinen Gewinn: der Adapter sagt „kein Wahljahr", der Tick sagt „Wahljahr" (Lens-Fund zu PR #12)', () => {
    // Der Tick-Zyklus ist Content (`wahl_intervall`), der Adapter folgt der Wahlregel (Intervall 6).
    // Bei Intervall 3 wäre Jahr 3 für den Tick ein Wahljahr — der Adapter prüft nicht, und es
    // darf kein stiller `gewonnen: true` im Ergebnis stehen.
    const konflikt = tick(
      stateMit({ jahr: 3 }),
      { zuteilung: {} },
      regelnMit({
        ereignis_regeln: [],
        wahl_intervall: 3,
        wahlPruefen: wahlRegelAlsPrüfung(WAHLREGEL_M0),
      }),
    );
    expect(konflikt.wahl).toBeUndefined();
    expect(konflikt.state.wahl_niederlage).toBeUndefined();

    // Jahr 12 ist durch beide Intervalle teilbar (3 und 6): hier prüfen beide, und das Ergebnis
    // ist ein echter Machtcheck, kein Stumm-Gewinn. Mit dem Start-Content (Ø 48.33) ist er bei der
    // M0-Schwelle 47 gewonnen; mit einem Snapshot unter der Schwelle verliert er end-to-end im Tick.
    const zwölfte = tick(
      stateMit({ jahr: 12 }),
      { zuteilung: {} },
      regelnMit({
        ereignis_regeln: [],
        wahl_intervall: 3,
        wahlPruefen: wahlRegelAlsPrüfung(WAHLREGEL_M0),
      }),
    );
    expect(zwölfte.wahl?.gewonnen).toBe(true);
    expect(zwölfte.wahl?.grund_id).toBe('wahl:gewonnen');
    expect(zwölfte.state.wahl_niederlage).toBeUndefined();

    // Ein Snapshot unter der Schwelle verliert denselben Machtcheck — der Gate ist im Tick wirksam,
    // nicht nur in core/wahl. Die Zufriedenheit wird am Jahrsanfang aus den Leveln gerechnet,
    // deshalb senkt der Test die Leveln (nicht die Gruppenwerte des Snapshots).
    const tief = stateMit({
      jahr: 12,
      indikatoren: {
        infrastruktur: 30,
        bildung: 30,
        gesundheit: 30,
        wirtschaft: 35,
        forschung: 30,
      },
    });
    const verloren = tick(
      tief,
      { zuteilung: {} },
      regelnMit({
        ereignis_regeln: [],
        wahl_intervall: 3,
        wahlPruefen: wahlRegelAlsPrüfung(WAHLREGEL_M0),
      }),
    );
    expect(verloren.wahl?.gewonnen).toBe(false);
    expect(verloren.wahl?.grund_id).toBe('wahl:gewichtete_unter_47');
    expect(verloren.state.wahl_niederlage).toEqual({
      jahr: 12,
      grund_id: 'wahl:gewichtete_unter_47',
    });
  });

  it('die reale M0-Regel (Schwelle 47, Zyklus 6) gewinnt Jahr 6 mit dem Start-Content — Ø 48.33 ≥ 47', () => {
    const ergebnis = tick(
      stateMit({ jahr: 6 }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], wahlPruefen: wahlRegelAlsPrüfung(WAHLREGEL_M0) }),
    );
    expect(ergebnis.wahl?.gewonnen).toBe(true);
    expect(ergebnis.wahl?.grund_id).toBe('wahl:gewonnen');
    // Die M0-Anteile aus balance-werte.md summieren 100.1 (nicht 100) — die Formel normalisiert,
    // deshalb ist Ø 48.33 und nicht die Docs-Zahl 48.4. Die Anteile sind Content, der Kern nicht.
    expect(ergebnis.wahl?.gewichtete_zufriedenheit).toBeCloseTo(48.3296, 4);
    expect(ergebnis.state.wahl_niederlage).toBeUndefined();

    // Jahr 5 ist kein Wahljahr (Zyklus 6): der Tick protokolliert nichts.
    const fünfte = tick(
      stateMit({ jahr: 5 }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], wahlPruefen: wahlRegelAlsPrüfung(WAHLREGEL_M0) }),
    );
    expect(fünfte.wahl).toBeUndefined();
  });

  it('ein kaputer Regelsatz wirft im Dev-Modus mit Regel-Id, der Produktionsmodus läuft weiter (FR-002)', () => {
    const kaputt = regelnMit({
      indikator_regeln: [{ tag: 'bildung', verschleiß: Number.NaN, budget_wirkung: 0.6 }],
    });
    expect(() => tick(stateMit(), { zuteilung: {} }, kaputt, 'dev')).toThrow(/indikator:bildung/);

    const ergebnis = tick(stateMit(), { zuteilung: {} }, kaputt, 'produktion');
    expect(ergebnis.state.indikatoren.bildung).toBe(40);
  });

  it('der Zufriedenheits-Trace zeigt die Level-Bewegung des Vorjahres (ADR-008)', () => {
    const regeln = regelnMit({ ereignis_regeln: [] });
    const erster = tick(stateMit(), { zuteilung: {} }, regeln);
    // Am Jahrsanfang von Jahr 1 gibt es keine Bewegung — ein Grund ohne Wirkung ist kein Grund.
    expect(erster.state.zufriedenheits_trace.bildung_jugend).toEqual([]);

    const zweiter = tick(erster.state, { zuteilung: {} }, regeln);
    // Bildung ist um 2 gesunken; bildung_jugend wiegt Bildung 0.706 → der Grund ist −1.412.
    const grund = zweiter.state.zufriedenheits_trace.bildung_jugend![0]!;
    expect(grund.grund_id).toBe('zufriedenheit:level');
    expect(grund.delta).toBeCloseTo(-1.412, 10);
  });
});
