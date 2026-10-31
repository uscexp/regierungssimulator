import { describe, expect, it } from 'vitest';

import { tick, type TickRegeln } from '@staatslenker/core/tick';
import { SCHWIERIGKEIT_NORMAL, type IndikatorRegel } from '@staatslenker/core/indikatoren';
import type { SteuerfaktorTabelle } from '@staatslenker/core/budget';
import {
  erzeugeGameState,
  type Effekt,
  type GameState,
  type Startkonfiguration,
} from '@staatslenker/core/state';
import type { SteuerlastTabelle } from '@staatslenker/core/zufriedenheit';
import type { EreignisRegel } from '@staatslenker/core/ereignisse';
import type { RegierungRegel, WahlregelVariant } from '@staatslenker/core/rules';

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

/**
 * Test-Instanzen des Registers. Die Werte sind hier Testdaten für die Mechanik, nicht die
 * Balance-Quelle — die liegt im Content-Pack (`WAHLREGEL_VARIANT_M0`, D18: 6/47/35).
 */
const wahlBasis: WahlregelVariant = Object.freeze({
  typ: 'praesidentialwahl',
  regel_id: 'wahl_test_basis',
  intervall_jahre: 6,
  gewichtete_min: 47,
  schwächste_min: 35,
});
const wahlStreng: WahlregelVariant = Object.freeze({
  typ: 'praesidentialwahl',
  regel_id: 'wahl_test_streng',
  intervall_jahre: 6,
  gewichtete_min: 60,
  schwächste_min: 35,
});
const regierungPraesidential: RegierungRegel = Object.freeze({
  typ: 'regierung',
  regel_id: 'regierung_test_praes',
  form: 'praesidential',
  amt: { modus: 'fixed_term' as const, jahre: 6 },
  machtverlust: 'wahl',
});
const regierungDiktatur: RegierungRegel = Object.freeze({
  typ: 'regierung',
  regel_id: 'regierung_test_diktatur',
  form: 'diktatur',
  amt: { modus: 'keins' as const },
  machtverlust: 'putsch',
});
const regierungParlamentarisch: RegierungRegel = Object.freeze({
  typ: 'regierung',
  regel_id: 'regierung_test_parlament',
  form: 'parlamentarisch',
  amt: { modus: 'zyklisch' as const, jahre: 4 },
  machtverlust: 'misstrauen',
});
// Die Zufriedenheit wird im Tick am Jahresanfang aus den Indikator-Leveln neu gerechnet — die
// Snapshot-Werte der Gruppen gelten nicht durch den Turn hindurch. Die Schwellen dieser Instanzen
// sind deshalb gegen den gerechneten Start-Ø (~48) gesetzt, nicht gegen die Snapshot-Werte.
const putschOhneRisiko: WahlregelVariant = Object.freeze({
  typ: 'putsch_roll',
  regel_id: 'putsch_test_ohne_risiko',
  elite_min: 40,
  militaer_min: 40,
  legitimitaet_min: 30,
  wahrscheinlichkeit: 0.5,
});
const putschMitRisiko: WahlregelVariant = Object.freeze({
  typ: 'putsch_roll',
  regel_id: 'putsch_test_mit_risiko',
  elite_min: 60,
  militaer_min: 60,
  legitimitaet_min: 40,
  wahrscheinlichkeit: 0.5,
});
const parlamentmehrheit: WahlregelVariant = Object.freeze({
  typ: 'parlamentmehrheit',
  regel_id: 'mehrheit_test',
  mehrheit: 0.5,
});

/** Gruppen, die die Putsch-Bedingung erfüllen (elite und militaer über der Schwelle). */
const gruppenMitElite = [
  ...start.gruppen,
  {
    tag: 'elite' as const,
    zufriedenheit: 70,
    bevölkerungsanteil: 5,
    gewichte: { wirtschaft: 1 },
  },
  {
    tag: 'militaer' as const,
    zufriedenheit: 70,
    bevölkerungsanteil: 5,
    gewichte: { infrastruktur: 1 },
  },
];

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

  it('der Machtcheck läuft alle sechs Jahre und die Mechanik kommt als Register-Datum (PO-Ruling: Zyklus 6)', () => {
    // Eine strenge Variante (Ø ≥ 60) verliert den Start-Ø 48.33 — die Schwelle kommt aus dem
    // Regel-Objekt, der Tick erfindet keine Zahl (ADR-011).
    const sechste = tick(
      stateMit({ jahr: 6 }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], regierung: regierungPraesidential, wahlregel: wahlStreng }),
    );
    expect(sechste.wahl?.gewonnen).toBe(false);
    expect(sechste.wahl?.typ).toBe('praesidentialwahl');
    expect(sechste.state.wahl_niederlage).toEqual({
      jahr: 6,
      grund_id: 'wahl:gewichtete_unter_60',
    });

    const dritte = tick(
      stateMit({ jahr: 3 }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], regierung: regierungPraesidential, wahlregel: wahlStreng }),
    );
    expect(dritte.wahl).toBeUndefined();
    expect(dritte.state.wahl_niederlage).toBeUndefined();
  });

  it('ein Nicht-Wahljahr protokolliert keinen Gewinn: der Zyklus kommt aus dem Regel-Objekt, nicht aus einem Adapter-Zweig (Lens-Fund zu PR #12)', () => {
    // Der Fund zu PR #12 war ein Konflikt zwischen Tick-Zyklus und Adapter-Regel. Mit der
    // Mechanik als Daten (US-M1-03) gibt es nur eine Quelle: Jahr 3 ist bei Intervall 6 kein
    // Wahljahr und darf kein Ergebnis liefern — weder Gewinn noch Niederlage.
    const nonWahljahr = tick(
      stateMit({ jahr: 3 }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], regierung: regierungPraesidential, wahlregel: wahlBasis }),
    );
    expect(nonWahljahr.wahl).toBeUndefined();
    expect(nonWahljahr.state.wahl_niederlage).toBeUndefined();

    // Jahr 12 ist ein Wahljahr der Variante: ein echter Machtcheck, kein Stumm-Gewinn. Mit dem
    // Start-Ø 48.33 ist er bei Schwelle 47 gewonnen.
    const zwölfte = tick(
      stateMit({ jahr: 12 }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], regierung: regierungPraesidential, wahlregel: wahlBasis }),
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
      regelnMit({ ereignis_regeln: [], regierung: regierungPraesidential, wahlregel: wahlBasis }),
    );
    expect(verloren.wahl?.gewonnen).toBe(false);
    expect(verloren.wahl?.grund_id).toBe('wahl:gewichtete_unter_47');
    expect(verloren.state.wahl_niederlage).toEqual({
      jahr: 12,
      grund_id: 'wahl:gewichtete_unter_47',
    });
  });

  it('die M0-Regel als Daten (Schwelle 47, Zyklus 6) gewinnt Jahr 6 mit dem Start-Content — Ø 48.33 ≥ 47', () => {
    const ergebnis = tick(
      stateMit({ jahr: 6 }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], regierung: regierungPraesidential, wahlregel: wahlBasis }),
    );
    expect(ergebnis.wahl?.gewonnen).toBe(true);
    expect(ergebnis.wahl?.grund_id).toBe('wahl:gewonnen');
    // Die Messwerte gehören zur Wahl-Variante (US-M1-03: der Rückgabewert ist die Auswertung).
    const auswertung = ergebnis.wahl;
    if (auswertung === undefined || auswertung.typ !== 'praesidentialwahl') {
      throw new Error('Test: erwartet eine praesidentialwahl-Auswertung');
    }
    // Die M0-Anteile aus balance-werte.md summieren 100.1 (nicht 100) — die Formel normalisiert,
    // deshalb ist Ø 48.33 und nicht die Docs-Zahl 48.4. Die Anteile sind Content, der Kern nicht.
    expect(auswertung.gewichtete_zufriedenheit).toBeCloseTo(48.3296, 4);
    expect(ergebnis.state.wahl_niederlage).toBeUndefined();

    // Jahr 5 ist kein Wahljahr (Zyklus 6): der Tick protokolliert nichts.
    const fünfte = tick(
      stateMit({ jahr: 5 }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], regierung: regierungPraesidential, wahlregel: wahlBasis }),
    );
    expect(fünfte.wahl).toBeUndefined();
  });

  it('ein Setup ohne geladenes Regel-Set für die gewählte Form läuft ohne Machtcheck und meldet den Grund (US-M1-03, FR-015)', () => {
    // Das Basis-Pack liefert nur das praesidential-Regel-Set. Eine legale Setup-Wahl ohne
    // Regel-Set darf keine erfundene Mechanik ausführen: der State bleibt unverändert, der
    // Grund-Muster-Wert im Ergebnis ist die Transparenz dafür (Adapter narrativiert ihn).
    const ohneRegelset = tick(
      stateMit({
        jahr: 6,
        setup: { regierungsform: 'parlamentarisch', konstitutions_ids: [] },
      }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], regierung: regierungPraesidential, wahlregel: wahlBasis }),
    );
    expect(ohneRegelset.wahl).toBeUndefined();
    expect(ohneRegelset.machtverlust_regelset).toBe(
      'machtverlust:kein_regelset_fuer_parlamentarisch',
    );
    expect(ohneRegelset.state.wahl_niederlage).toBeUndefined();
    expect(ohneRegelset.state.jahr).toBe(7);
  });

  it('ein falsches Form-Variante-Paar im Register wirft im Dev-Modus mit Regel-Id und läuft in Produktion ohne Check (FR-002, ADR-011)', () => {
    const falsch = regelnMit({
      ereignis_regeln: [],
      regierung: regierungPraesidential,
      wahlregel: putschMitRisiko,
    });
    expect(() => tick(stateMit({ jahr: 6 }), { zuteilung: {} }, falsch, 'dev')).toThrow(
      /Machtverlust-Bindung falsch/,
    );
    const produktion = tick(stateMit({ jahr: 6 }), { zuteilung: {} }, falsch, 'produktion');
    expect(produktion.wahl).toBeUndefined();
    expect(produktion.state.wahl_niederlage).toBeUndefined();
  });

  it('die Diktatur würfelt die Putsch-Roll in jedem Jahr und verbraucht den RNG nur bei echter Roll (US-M1-03, FR-014)', () => {
    // Die Semantik ist die aus US-M1-11: keine Risiko-Gründe ⇒ kein Wurf, die Macht bleibt.
    // Risiko-Gründe ⇒ genau ein Wurf aus dem State-RNG, eingetreten bei `roll < wahrscheinlichkeit`.
    const ungefährdet = stateMit({ jahr: 2, gruppen: gruppenMitElite, legitimitaet: 90 });
    const gehalten = tick(
      ungefährdet,
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], regierung: regierungDiktatur, wahlregel: putschOhneRisiko }),
    );
    expect(gehalten.wahl?.typ).toBe('putsch_roll');
    expect(gehalten.wahl?.gewonnen).toBe(true);
    expect(gehalten.wahl?.grund_id).toBe('putsch:bedingung_erfüllt');
    expect(gehalten.state.rng.counter).toBe(0);
    expect(gehalten.state.wahl_niederlage).toBeUndefined();
    // Kein Amts-Zyklus bei `keins`: Jahr 2 ist kein Wahljahr, aber die Roll-Linie läuft trotzdem.

    // Risiko (Elite unter der Schwelle) + wahrscheinlichkeit 1 ⇒ der Wurf tritt immer ein:
    // Spielende über das Grund-Muster der fehlenden Bedingung, der RNG-Counter steigt um 1.
    const riskant = stateMit({
      jahr: 2,
      gruppen: [
        ...start.gruppen,
        { tag: 'elite', zufriedenheit: 30, bevölkerungsanteil: 5, gewichte: { wirtschaft: 1 } },
        {
          tag: 'militaer',
          zufriedenheit: 70,
          bevölkerungsanteil: 5,
          gewichte: { infrastruktur: 1 },
        },
      ],
      legitimitaet: 90,
    });
    const eingetreten = tick(
      riskant,
      { zuteilung: {} },
      regelnMit({
        ereignis_regeln: [],
        regierung: regierungDiktatur,
        wahlregel: { ...putschMitRisiko, wahrscheinlichkeit: 1 },
      }),
    );
    expect(eingetreten.wahl?.gewonnen).toBe(false);
    expect(eingetreten.wahl?.grund_id).toBe('putsch:elite_unter_60');
    expect(eingetreten.state.wahl_niederlage).toEqual({
      jahr: 2,
      grund_id: 'putsch:elite_unter_60',
    });
    expect(eingetreten.state.rng.counter).toBe(1);

    // Derselbe Risiko-Fall mit wahrscheinlichkeit 0 ⇒ der Wurf findet statt, die Macht bleibt.
    const abgewehrt = tick(
      riskant,
      { zuteilung: {} },
      regelnMit({
        ereignis_regeln: [],
        regierung: regierungDiktatur,
        wahlregel: { ...putschMitRisiko, wahrscheinlichkeit: 0 },
      }),
    );
    expect(abgewehrt.wahl?.gewonnen).toBe(true);
    expect(abgewehrt.wahl?.grund_id).toBe('putsch:gerollt_abgewehrt');
    expect(abgewehrt.state.rng.counter).toBe(1);
    expect(abgewehrt.state.wahl_niederlage).toBeUndefined();
  });

  it('das Misstrauens-Votum ist im Register gebunden, der Check läuft in dieser Story noch nicht (US-M1-08)', () => {
    const ergebnis = tick(
      stateMit({ jahr: 4 }),
      { zuteilung: {} },
      regelnMit({
        ereignis_regeln: [],
        regierung: regierungParlamentarisch,
        wahlregel: parlamentmehrheit,
      }),
    );
    expect(ergebnis.wahl).toBeUndefined();
    expect(ergebnis.machtverlust_regelset).toBeUndefined();
    expect(ergebnis.state.wahl_niederlage).toBeUndefined();
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
