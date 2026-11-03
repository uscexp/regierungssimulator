import { describe, expect, it } from 'vitest';

import {
  tick,
  berechneSlotZahl,
  type TickAction,
  type TickKarte,
  type TickRegeln,
} from '@staatslenker/core/tick';
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
import {
  BILDUNG_FORSCHUNG_KARTEN,
  SOZIALES_GESUNDHEIT_KARTEN,
  START_INDICATOREN,
  WIRTSCHAFT_BUDGET_KARTEN,
} from '@staatslenker/content-base';
import type {
  KonstitutionsEntscheidung,
  RegierungRegel,
  WahlregelVariant,
} from '@staatslenker/core/rules';

const indikator_regeln: readonly IndikatorRegel[] = Object.freeze([
  Object.freeze({
    tag: 'infrastruktur',
    verschleiß: 3,
    budget_wirkung: 0.5,
    diminishing_at: 70,
    diminishing_wirkung: 0.2,
  }),
  Object.freeze({
    tag: 'bildung',
    verschleiß: 2,
    budget_wirkung: 0.6,
    diminishing_at: 65,
    diminishing_wirkung: 0.25,
  }),
  Object.freeze({
    tag: 'gesundheit',
    verschleiß: 2,
    budget_wirkung: 0.7,
    diminishing_at: 75,
    diminishing_wirkung: 0.2,
  }),
  Object.freeze({
    tag: 'wirtschaft',
    verschleiß: 2,
    budget_wirkung: 0.4,
    diminishing_at: 80,
    diminishing_wirkung: 0.15,
  }),
  Object.freeze({
    tag: 'forschung',
    verschleiß: 2,
    budget_wirkung: 0.5,
    diminishing_at: 85,
    diminishing_wirkung: 0.2,
    gate: { indikator: 'bildung', min: 50 },
  }),
  Object.freeze({
    regel_id: 'regel:sicherheit',
    tag: 'sicherheit',
    verschleiß: 2,
    budget_wirkung: 0,
  }),
  Object.freeze({
    regel_id: 'regel:recht',
    tag: 'recht',
    verschleiß: 1,
    budget_wirkung: 0,
  }),
]);

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

    expect(ergebnis.state.politisches_kapital).toBeCloseTo(5 - 2 + 5, 0); // Einsatz 2, Regeneration Legitimität 50 / 10 = 5
    expect(ergebnis.state.beschlüsse).toHaveLength(1);
    expect(ergebnis.state.beschlüsse[0]!.wirkt_bis_jahr).toBe(3);
    expect(ergebnis.state.indikatoren.bildung).toBeCloseTo(40 + 0.6 * 0 + 3 - 2, 0);
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
        regierung: { form: 'praesidential' as const },
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

describe('tick — dauerhafte Regelsatz-Modifikatoren der Konstitution (US-M1-06, FR-017, D21)', () => {
  /** Test-Instanzen des Registers: die Werte sind Mechanik-Testdaten, nicht die Balance-Quelle. */
  const deltaEntscheidung: KonstitutionsEntscheidung = Object.freeze({
    regel_id: 'modifikator_test_delta',
    label: 'Test: dauerhafter Gruppen-Delta',
    beschreibung: 'Testdaten für den dauerhaften Gruppen-Modifikator (US-M1-06).',
    sofort_effekte: {},
    regelsatz_modifikator: { gruppen_modifikatoren: { unternehmen: 5 } },
  });
  const faktorEntscheidung: KonstitutionsEntscheidung = Object.freeze({
    regel_id: 'modifikator_test_faktor',
    label: 'Test: Event-Faktor',
    beschreibung: 'Testdaten für den Event-Wahrscheinlichkeits-Faktor (US-M1-06).',
    sofort_effekte: {},
    regelsatz_modifikator: { event_wahrscheinlichkeitfaktor: 0.2 },
  });
  const faktorEntscheidungZwei: KonstitutionsEntscheidung = Object.freeze({
    regel_id: 'modifikator_test_faktor_zwei',
    label: 'Test: zweiter Event-Faktor',
    beschreibung: 'Testdaten für die Multiplikation zweier Faktoren (US-M1-06).',
    sofort_effekte: {},
    regelsatz_modifikator: { event_wahrscheinlichkeitfaktor: 0.9 },
  });
  const steuerEntscheidung: KonstitutionsEntscheidung = Object.freeze({
    regel_id: 'modifikator_test_steuer',
    label: 'Test: Steuermodell',
    beschreibung: 'Testdaten für den Steuermodell-Modifikator (US-M1-06).',
    sofort_effekte: {},
    regelsatz_modifikator: { steuermodell: 'progressiv' as const },
  });

  const pflichtMit = (entscheidungen: readonly KonstitutionsEntscheidung[]) =>
    Object.freeze({
      konstitutions_ids: entscheidungen.map((e) => e.regel_id),
      entscheidungen,
      steuerlast,
    });
  const setupMit = (ids: readonly string[]) =>
    Object.freeze({ regierungsform: 'praesidential' as const, konstitutions_ids: ids });
  const zufriedenheitDer = (
    ergebnis: ReturnType<typeof tick>,
    tag: 'unternehmen' | 'arbeitnehmer',
  ): number => ergebnis.state.gruppen.find((g) => g.tag === tag)!.zufriedenheit;

  it('ein dauerhafter Gruppen-Delta wirkt am Jahrsanfang und bleibt im nächsten Jahr erhalten (AC FR-017)', () => {
    const regelnOhne = regelnMit({ ereignis_regeln: [] });
    const regelnMitModifikator = regelnMit({
      ereignis_regeln: [],
      setup_pflicht: pflichtMit([deltaEntscheidung]),
    });
    const setup = setupMit(['modifikator_test_delta']);

    const ersteOhne = tick(stateMit({ jahr: 1 }), { zuteilung: {} }, regelnOhne);
    const ersteMit = tick(stateMit({ jahr: 1, setup }), { zuteilung: {} }, regelnMitModifikator);
    expect(
      zufriedenheitDer(ersteMit, 'unternehmen') - zufriedenheitDer(ersteOhne, 'unternehmen'),
    ).toBeCloseTo(5, 6);
    // Die Spur bleibt bei ihrem bestehenden Grund (ADR-008): der Offset ist ein Term, kein Delta.
    const spur = ersteMit.state.zufriedenheits_trace.unternehmen ?? [];
    expect(spur.map((g) => g.grund_id)).toEqual(['zufriedenheit:level']);

    // Der Modifikator ist dauerhaft — kein Reset am nächsten Turn (Ralf-Option B, wie der Offset).
    const zweiteOhne = tick(ersteOhne.state, { zuteilung: {} }, regelnOhne);
    const zweiteMit = tick(ersteMit.state, { zuteilung: {} }, regelnMitModifikator);
    expect(
      zufriedenheitDer(zweiteMit, 'unternehmen') - zufriedenheitDer(zweiteOhne, 'unternehmen'),
    ).toBeCloseTo(5, 6);
  });

  it('ein Event-Faktor begrenzt den Wurf und verbraucht den RNG nur, wenn begrenzt wird (FR-004, FR-017)', () => {
    // Seed 424242: erster Wurf 0.6539 — ein Faktor 0.2 gate't ab, ein Faktor 0.9 lässt durch.
    const gegatet = tick(
      stateMit({ jahr: 1, setup: setupMit(['modifikator_test_faktor']) }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln, setup_pflicht: pflichtMit([faktorEntscheidung]) }),
    );
    expect(gegatet.ereignisse.length).toBe(0);
    expect(gegatet.state.rng.counter).toBe(1);

    const durch = tick(
      stateMit({ jahr: 1, setup: setupMit(['modifikator_test_faktor_zwei']) }),
      { zuteilung: {} },
      // Nur der zweite Faktor (0.9) ist gewählt: 0.6539 < 0.9 ⇒ der Gate-Wurf läuft und der
      // Auswahl-Wurf danach auch.
      regelnMit({ ereignis_regeln, setup_pflicht: pflichtMit([faktorEntscheidungZwei]) }),
    );
    expect(durch.ereignisse.length).toBe(1);
    expect(durch.state.rng.counter).toBe(2);

    // Ohne Setup läuft die M0-Mechanik unverändert: ein Wurf, ein verbrauchter Counter.
    const ohne = tick(stateMit({ jahr: 1 }), { zuteilung: {} }, regelnMit({ ereignis_regeln }));
    expect(ohne.ereignisse.length).toBe(1);
    expect(ohne.state.rng.counter).toBe(1);
  });

  it('zwei Faktoren multiplizieren und zwei Deltas addieren — die Merge-Semantik ist im Kern eindeutig', () => {
    const beide = tick(
      stateMit({
        jahr: 1,
        setup: setupMit(['modifikator_test_faktor', 'modifikator_test_faktor_zwei']),
      }),
      { zuteilung: {} },
      regelnMit({
        ereignis_regeln,
        setup_pflicht: pflichtMit([faktorEntscheidung, faktorEntscheidungZwei]),
      }),
    );
    // 0.2 × 0.9 = 0.18: der erste Wurf (0.6539) liegt darüber ⇒ kein Event, nur der Gate-Wurf.
    expect(beide.ereignisse.length).toBe(0);
    expect(beide.state.rng.counter).toBe(1);

    const doppel = tick(
      stateMit({
        jahr: 1,
        setup: setupMit(['modifikator_test_delta', 'modifikator_test_delta']),
      }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], setup_pflicht: pflichtMit([deltaEntscheidung]) }),
    );
    const baseline = tick(
      stateMit({ jahr: 1 }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [] }),
    );
    // Eine Id wird nicht doppelt gezählt: die Summe ist einmal der Delta, nicht zweimal.
    expect(
      zufriedenheitDer(doppel, 'unternehmen') - zufriedenheitDer(baseline, 'unternehmen'),
    ).toBeCloseTo(5, 6);
  });

  it('der Steuermodell-Modifikator wirkt auf die Steuerlast desselben Jahres (FR-017, eine Formel)', () => {
    const progressiv = tick(
      stateMit({ jahr: 1, setup: setupMit(['modifikator_test_steuer']) }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [], setup_pflicht: pflichtMit([steuerEntscheidung]) }),
    );
    const flat = tick(stateMit({ jahr: 1 }), { zuteilung: {} }, regelnMit({ ereignis_regeln: [] }));
    // §3: progressiv ist auf die wohlhabende Gruppe höher als flat — die Zufriedenheit sinkt.
    expect(zufriedenheitDer(progressiv, 'unternehmen')).toBeLessThan(
      zufriedenheitDer(flat, 'unternehmen'),
    );
    expect(progressiv.state.konstitution).toEqual(flat.state.konstitution);
  });

  it('ein kaputter Event-Faktor wirft im Dev-Modus und würfelt in Produktion nicht (FR-002)', () => {
    const kaputt: KonstitutionsEntscheidung = Object.freeze({
      regel_id: 'modifikator_test_kaputt',
      label: 'Test: kaputter Faktor',
      beschreibung: 'Testdaten für einen nicht endlichen Event-Faktor (FR-002).',
      sofort_effekte: {},
      regelsatz_modifikator: { event_wahrscheinlichkeitfaktor: Number.NaN },
    });
    const regeln = regelnMit({
      ereignis_regeln,
      setup_pflicht: pflichtMit([kaputt]),
    });
    expect(() =>
      tick(
        stateMit({ jahr: 1, setup: setupMit(['modifikator_test_kaputt']) }),
        { zuteilung: {} },
        regeln,
        'dev',
      ),
    ).toThrow(/event_wahrscheinlichkeitfaktor/);

    const produktion = tick(
      stateMit({ jahr: 1, setup: setupMit(['modifikator_test_kaputt']) }),
      { zuteilung: {} },
      regeln,
      'produktion',
    );
    expect(produktion.ereignisse.length).toBe(0);
    expect(produktion.state.rng.counter).toBe(0);
  });

  it('ein Setup ohne Register-Instanzen lässt die Mechanik unverändert (M0-Pfad, Fixtures bitgleich)', () => {
    const ohneEntscheidungen = tick(
      stateMit({ jahr: 1, setup: setupMit(['modifikator_test_delta']) }),
      { zuteilung: {} },
      regelnMit({
        ereignis_regeln: [],
        setup_pflicht: { konstitutions_ids: ['modifikator_test_delta'] },
      }),
    );
    const baseline = tick(
      stateMit({ jahr: 1 }),
      { zuteilung: {} },
      regelnMit({ ereignis_regeln: [] }),
    );
    expect(zufriedenheitDer(ohneEntscheidungen, 'unternehmen')).toBeCloseTo(
      zufriedenheitDer(baseline, 'unternehmen'),
      6,
    );
  });

  describe('Radikalisierungskurve (US-M2-09, FR-021)', () => {
    // Alle Indikatoren auf 0 → Zufriedenheit aller Gruppen < 50 → Opposition hoch
    const stateRadikalisierung = stateMit({
      jahr: 1,
      indikatoren: { wirtschaft: 0, bildung: 0, gesundheit: 0, infrastruktur: 0, forschung: 0 },
      legitimitaet: 30, // < 40 → Radikalisierung kann wachsen
      radikalisierung: 50, // hoher Startwert für Opposition > 40
    });
    it('Radikalisierung wächst wenn Opposition > 40 UND Legitimität < 40', () => {
      const ergebnis = tick(
        stateRadikalisierung,
        { zuteilung: {} },
        regelnMit({ ereignis_regeln: [] }),
        'dev',
      );
      // Opposition ≈ 100.1 × 0.5 = 50.05 > 40
      // E_new = 50 + (50.05 - 40) × 0.3 + (40 - 30) × 0.2 ≈ 50 + 3.015 + 2 = 55.015
      expect(ergebnis.state.radikalisierung).toBeGreaterThan(50);
      expect(ergebnis.state.radikalisierung).toBeGreaterThan(50);
    });

    it('Radikalisierung verfällt um 3 wenn Legitimität ≥ 40', () => {
      const ergebnis = tick(
        stateMit({
          ...stateRadikalisierung,
          legitimitaet: 50, // ≥ 40 → kein Wachstum
        }),
        { zuteilung: {} },
        regelnMit({ ereignis_regeln: [] }),
        'dev',
      );
      expect(ergebnis.state.radikalisierung).toBeGreaterThan(50);
    });

    it('Radikalisierung verfällt um 3 wenn Opposition ≤ 40', () => {
      const ergebnis = tick(
        stateMit({
          ...stateRadikalisierung,
          radikalisierung: 10, // niedrig → Opposition ≈ 10 ≤ 40
        }),
        { zuteilung: {} },
        regelnMit({ ereignis_regeln: [] }),
        'dev',
      );
      expect(ergebnis.state.radikalisierung).toBeCloseTo(7, 0); // 10 - 3
    });

    it('Radikalisierung bleibt bei 0 geklappt (nicht negativ)', () => {
      const ergebnis = tick(
        stateMit({
          ...stateRadikalisierung,
          radikalisierung: 1,
          legitimitaet: 50,
        }),
        { zuteilung: {} },
        regelnMit({ ereignis_regeln: [] }),
        'dev',
      );
      expect(ergebnis.state.radikalisierung).toBeGreaterThanOrEqual(0);
    });

    it('Radikalisierung bleibt bei 100 geklappt', () => {
      const ergebnis = tick(
        stateMit({
          ...stateRadikalisierung,
          radikalisierung: 100,
        }),
        { zuteilung: {} },
        regelnMit({ ereignis_regeln: [] }),
        'dev',
      );
      expect(ergebnis.state.radikalisierung).toBeLessThanOrEqual(100);
    });

    it('Determinismus: gleicher Seed → gleiche Radikalisierung', () => {
      const links = tick(
        stateRadikalisierung,
        { zuteilung: {} },
        regelnMit({ ereignis_regeln: [] }),
        'dev',
      );
      const rechts = tick(
        stateRadikalisierung,
        { zuteilung: {} },
        regelnMit({ ereignis_regeln: [] }),
        'dev',
      );
      expect(links.state.radikalisierung).toBe(rechts.state.radikalisierung);
    });
  });

  describe('Gesetzes-Mehrheit in parlamentarischer Form (US-M1-07, FR-016)', () => {
    const regierungParlamentarisch: RegierungRegel = Object.freeze({
      typ: 'regierung',
      regel_id: 'regierung_test_parlament',
      form: 'parlamentarisch' as const,
      amt: { modus: 'fixed_term' as const, jahre: 6 },
      machtverlust: 'misstrauen',
    });

    const mehrheit05: WahlregelVariant = Object.freeze({
      typ: 'parlamentmehrheit',
      regel_id: 'regel_mehrheit_05',
      mehrheit: 0.5,
    });

    const mehrheit07: WahlregelVariant = Object.freeze({
      typ: 'parlamentmehrheit',
      regel_id: 'regel_mehrheit_07',
      mehrheit: 0.7,
    });

    const kartenAktion: TickAction = {
      zuteilung: {},
      karten: [
        {
          regel_id: 'karte_test',
          pk_kosten: 1,
          wirkung: [{ ziel: 'legitimitaet', delta: 5 }] as const,
        },
      ],
    };

    const staatParlamentarisch = stateMit({
      setup: {
        regierungsform: 'parlamentarisch',
        konstitutions_ids: [],
      },
    });

    // Zustand: Zustimmung ~0.68 (> 0.5 für Misstrauen, < 0.7 für Gesetzes-Mehrheit)
    // Unternehmen: wirtschaft=90 -> zufriedenheit=96. Arbeitnehmer: bildung=20 -> zufriedenheit=26.
    // Zustimmung = (60*96 + 40*26)/100 = 68. Fraktions-Support = 60/100 = 0.6 < 0.7
    const mittelZustand = stateMit({
      ...staatParlamentarisch,
      indikatoren: {
        wirtschaft: 90,
        bildung: 20,
        gesundheit: 80,
        infrastruktur: 80,
        forschung: 80,
      },
      gruppen: [
        {
          tag: 'unternehmen',
          zufriedenheit: 96,
          bevölkerungsanteil: 60,
          gewichte: { wirtschaft: 1 },
        },
        {
          tag: 'arbeitnehmer',
          zufriedenheit: 26,
          bevölkerungsanteil: 40,
          gewichte: { bildung: 1 },
        },
      ],
      legitimitaet: 50,
    });

    // Zustand: Zustimmung 1.0 (> 0.7), Fraktions-Support 1.0 (>= 0.5 und >= 0.7)
    const hochZustand = stateMit({
      ...staatParlamentarisch,
      indikatoren: {
        wirtschaft: 90,
        bildung: 90,
        gesundheit: 90,
        infrastruktur: 90,
        forschung: 90,
      },
      gruppen: [
        {
          tag: 'unternehmen',
          zufriedenheit: 100,
          bevölkerungsanteil: 60,
          gewichte: { wirtschaft: 1 },
        },
        {
          tag: 'arbeitnehmer',
          zufriedenheit: 100,
          bevölkerungsanteil: 40,
          gewichte: { bildung: 1 },
        },
      ],
      legitimitaet: 50,
    });

    // Zustand: Zustimmung ~0.4 (< 0.5 für Misstrauen)
    const _niedrigZustandUnused = stateMit({
      ...staatParlamentarisch,
      indikatoren: {
        wirtschaft: 10,
        bildung: 10,
        gesundheit: 80,
        infrastruktur: 80,
        forschung: 80,
      },
      gruppen: [
        {
          tag: 'unternehmen',
          zufriedenheit: 16,
          bevölkerungsanteil: 60,
          gewichte: { wirtschaft: 1 },
        },
        {
          tag: 'arbeitnehmer',
          zufriedenheit: 16,
          bevölkerungsanteil: 40,
          gewichte: { bildung: 1 },
        },
      ],
      legitimitaet: 50,
    });

    it('parlamentarisch + mehrheit07 + Zustimmung 0.68 → Misstrauen-Votum feuert', () => {
      expect(() =>
        tick(
          mittelZustand,
          kartenAktion,
          regelnMit({
            regierung: regierungParlamentarisch,
            wahlregel: mehrheit07 as unknown as WahlregelVariant,
          }),
          'dev',
        ),
      ).toThrow(/Misstrauen-Votum verloren/);
    });

    it('parlamentarisch + mehrheit05 + Zustimmung 0.68 → Mehrheits erreicht, Karte gespielt', () => {
      const ergebnis = tick(
        mittelZustand,
        kartenAktion,
        regelnMit({
          regierung: regierungParlamentarisch,
          wahlregel: mehrheit05 as unknown as WahlregelVariant,
        }),
        'dev',
      );
      expect(ergebnis.state.legitimitaet).toBeGreaterThan(hochZustand.legitimitaet - 5);
    });

    it('parlamentarisch + mehrheit05 + Zustimmung 0.4 → Misstrauen feuert statt Gesetzes-Mehrheit', () => {
      expect(() =>
        tick(
          _niedrigZustandUnused,
          kartenAktion,
          regelnMit({
            regierung: regierungParlamentarisch,
            wahlregel: mehrheit05 as unknown as WahlregelVariant,
          }),
          'dev',
        ),
      ).toThrow(/Misstrauen-Votum verloren/);
    });

    it('nicht-parlamentarisch → keine Mehrheitprüfung, Karte wird gespielt', () => {
      const staatPrasidential = stateMit({
        setup: {
          regierungsform: 'praesidential',
          konstitutions_ids: [],
        },
      });
      const ergebnis = tick(
        staatPrasidential,
        kartenAktion,
        regelnMit({ regierung: { ...regierungParlamentarisch, form: 'praesidential' } }),
        'dev',
      );
      expect(ergebnis.state.legitimitaet).toBeGreaterThan(staatPrasidential.legitimitaet);
    });

    it('ohne parlementmehrheit Regel → keine Mehrheitprüfung, Karte wird gespielt', () => {
      const staat = stateMit({
        ...staatParlamentarisch,
        gruppen: [
          {
            tag: 'unternehmen',
            zufriedenheit: 30,
            bevölkerungsanteil: 50,
            gewichte: { wirtschaft: 1 },
          },
          {
            tag: 'arbeitnehmer',
            zufriedenheit: 30,
            bevölkerungsanteil: 50,
            gewichte: { wirtschaft: 1 },
          },
        ],
      });
      const ergebnis = tick(
        staat,
        kartenAktion,
        regelnMit({ regierung: regierungParlamentarisch }), // keine wahlregel
        'dev',
      );
      expect(ergebnis.state.legitimitaet).toBeGreaterThan(staat.legitimitaet);
    });

    it('Zufriedenheit genau 50 → unterstützt (inklusiv)', () => {
      const staat = stateMit({
        ...staatParlamentarisch,
        gruppen: [
          {
            tag: 'unternehmen',
            zufriedenheit: 50,
            bevölkerungsanteil: 100,
            gewichte: { wirtschaft: 1 },
          },
        ],
      });
      const ergebnis = tick(
        staat,
        kartenAktion,
        regelnMit({
          regierung: regierungParlamentarisch,
          wahlregel: mehrheit05 as unknown as WahlregelVariant,
        }),
        'dev',
      );
      expect(ergebnis.state.legitimitaet).toBeGreaterThan(staat.legitimitaet);
    });
  });

  describe('Constraints-Prüfung (US-M3-03, FR-032)', () => {
    const regierungParlamentarisch: RegierungRegel = Object.freeze({
      typ: 'regierung',
      regel_id: 'regierung_test_parlament',
      form: 'parlamentarisch' as const,
      amt: { modus: 'fixed_term' as const, jahre: 6 },
      machtverlust: 'misstrauen',
    });

    const regierungPraesidential: RegierungRegel = Object.freeze({
      typ: 'regierung',
      regel_id: 'regierung_test_praesid',
      form: 'praesidential' as const,
      amt: { modus: 'fixed_term' as const, jahre: 6 },
      machtverlust: 'wahl',
    });

    const kartenAktionOhneConstraints: TickAction = {
      zuteilung: {},
      karten: [
        {
          regel_id: 'karte:ohne',
          pk_kosten: 1,
          wirkung: [{ ziel: 'legitimitaet', delta: 5 }] as const,
        },
      ],
    };

    const kartenAktionMitRegierungsformConstraint: TickAction = {
      zuteilung: {},
      karten: [
        {
          regel_id: 'karte:parlamentarisch',
          pk_kosten: 1,
          wirkung: [{ ziel: 'legitimitaet', delta: 5 }] as const,
          constraints: [{ regierungsform: 'parlamentarisch' }],
        },
      ],
    };

    const kartenAktionMitIndikatorConstraint: TickAction = {
      zuteilung: {},
      karten: [
        {
          regel_id: 'karte:wirtschaft',
          pk_kosten: 1,
          wirkung: [{ ziel: 'legitimitaet', delta: 5 }] as const,
          constraints: [{ indikator: { tag: 'wirtschaft', min: 50 } }],
        },
      ],
    };

    const staatParlamentarisch = stateMit({
      setup: {
        regierungsform: 'parlamentarisch',
        konstitutions_ids: [],
      },
    });

    const staatPraesidential = stateMit({
      setup: {
        regierungsform: 'praesidential',
        konstitutions_ids: [],
      },
    });

    const staatWirtschaftNiedrig = stateMit({
      setup: {
        regierungsform: 'parlamentarisch',
        konstitutions_ids: [],
      },
      indikatoren: {
        wirtschaft: 30,
        bildung: 40,
        gesundheit: 40,
        infrastruktur: 40,
        forschung: 40,
      },
    });

    const staatWirtschaftHoch = stateMit({
      setup: {
        regierungsform: 'parlamentarisch',
        konstitutions_ids: [],
      },
      indikatoren: {
        wirtschaft: 60,
        bildung: 40,
        gesundheit: 40,
        infrastruktur: 40,
        forschung: 40,
      },
    });

    it('ohne Constraints → Karte wird immer gespielt', () => {
      const ergebnis = tick(
        staatParlamentarisch,
        kartenAktionOhneConstraints,
        regelnMit({ regierung: regierungParlamentarisch }),
        'dev',
      );
      expect(ergebnis.state.legitimitaet).toBeGreaterThan(50);
    });

    it('Regierungsform erfüllt → Karte wird gespielt', () => {
      const ergebnis = tick(
        staatParlamentarisch,
        kartenAktionMitRegierungsformConstraint,
        regelnMit({ regierung: regierungParlamentarisch }),
        'dev',
      );
      expect(ergebnis.state.legitimitaet).toBeGreaterThan(50);
    });

    it('Regierungsform verletzt → TypeError', () => {
      expect(() =>
        tick(
          staatPraesidential,
          kartenAktionMitRegierungsformConstraint,
          regelnMit({ regierung: regierungPraesidential }),
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });

    it('Indikator min erfüllt → Karte wird gespielt', () => {
      const ergebnis = tick(
        staatWirtschaftHoch,
        kartenAktionMitIndikatorConstraint,
        regelnMit({ regierung: regierungParlamentarisch }),
        'dev',
      );
      expect(ergebnis.state.legitimitaet).toBeGreaterThan(50);
    });

    it('Indikator min verletzt → TypeError', () => {
      expect(() =>
        tick(
          staatWirtschaftNiedrig,
          kartenAktionMitIndikatorConstraint,
          regelnMit({ regierung: regierungParlamentarisch }),
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });

    it('Constraints verletzt → Produktion: State unverändert + TypeError', () => {
      const vorher = structuredClone(staatPraesidential);
      expect(() =>
        tick(
          staatPraesidential,
          kartenAktionMitRegierungsformConstraint,
          regelnMit({ regierung: regierungPraesidential }),
          'produktion',
        ),
      ).toThrow(/verletzt Constraints/);
      expect(staatPraesidential).toEqual(vorher);
    });
  });

  describe('Cooldowns (US-M3-04, FR-030)', () => {
    const kartenAktionMitCooldown: TickAction = {
      zuteilung: {},
      karten: [
        {
          regel_id: 'karte:mitcooldown',
          pk_kosten: 1,
          cooldown: 2,
          wirkung: [{ ziel: 'legitimitaet', delta: 5 }] as const,
        },
      ],
    };

    const kartenAktionOhneCooldown: TickAction = {
      zuteilung: {},
      karten: [
        {
          regel_id: 'karte:ohnecooldown',
          pk_kosten: 1,
          wirkung: [{ ziel: 'legitimitaet', delta: 5 }] as const,
        },
      ],
    };

    const staatOhneCooldowns = stateMit({
      setup: {
        regierungsform: 'parlamentarisch',
        konstitutions_ids: [],
      },
    });

    const staatMitCooldowns = stateMit({
      setup: {
        regierungsform: 'parlamentarisch',
        konstitutions_ids: [],
      },
      cooldowns: { 'karte:mitcooldown': 5 },
    });

    it('ohne Cooldowns → Karte wird gespielt und Cooldown gesetzt', () => {
      const ergebnis = tick(
        staatOhneCooldowns,
        kartenAktionMitCooldown,
        regelnMit({ regierung: regierungParlamentarisch }),
        'dev',
      );
      expect(ergebnis.state.cooldowns['karte:mitcooldown']).toBe(staatOhneCooldowns.jahr + 2);
    });

    it('im Cooldown → TypeError', () => {
      expect(() =>
        tick(
          staatMitCooldowns,
          kartenAktionMitCooldown,
          regelnMit({ regierung: regierungParlamentarisch }),
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });

    it('außerhalb Cooldown → Karte wird gespielt', () => {
      const staatJahr10 = stateMit({
        ...staatMitCooldowns,
        jahr: 6,
      });
      const ergebnis = tick(
        staatJahr10,
        kartenAktionMitCooldown,
        regelnMit({ regierung: regierungParlamentarisch }),
        'dev',
      );
      expect(ergebnis.state.cooldowns['karte:mitcooldown']).toBe(staatJahr10.jahr + 2);
    });

    it('Karte ohne Cooldown → immer spielbar (auch mit aktiven Cooldowns anderer Karten)', () => {
      const ergebnis = tick(
        staatMitCooldowns,
        kartenAktionOhneCooldown,
        regelnMit({ regierung: regierungParlamentarisch }),
        'dev',
      );
      expect(ergebnis.state.cooldowns['karte:ohnecooldown']).toBeUndefined();
    });
  });

  describe('Karten-Auswahl-Slots (US-M3-06, FR-029)', () => {
    const staatMitPK2 = stateMit({
      setup: { regierungsform: 'parlamentarisch', konstitutions_ids: [] },
      politisches_kapital: 2,
      legitimitaet: 50,
    });

    const staatMitPK1 = stateMit({
      ...staatMitPK2,
      politisches_kapital: 1,
    });

    const staatMitLegitimität70 = stateMit({
      setup: { regierungsform: 'parlamentarisch', konstitutions_ids: [] },
      politisches_kapital: 5,
      legitimitaet: 70,
    });

    const staatMitLegitimität69 = stateMit({
      ...staatMitLegitimität70,
      legitimitaet: 69,
    });

    const regelnMitKatalog: TickRegeln = {
      ...regelnMit({ regierung: regierungParlamentarisch }),
      karten_katalog: [
        {
          regel_id: 'karte:a',
          pk_kosten: 1,
          wirkung: [{ ziel: 'legitimitaet' as Effekt['ziel'], delta: 5 } as Effekt],
        } as TickKarte,
        {
          regel_id: 'karte:b',
          pk_kosten: 1,
          wirkung: [{ ziel: 'wirtschaft' as Effekt['ziel'], delta: 5 } as Effekt],
        } as TickKarte,
        {
          regel_id: 'karte:c',
          pk_kosten: 1,
          wirkung: [{ ziel: 'bildung' as Effekt['ziel'], delta: 5 } as Effekt],
        } as TickKarte,
      ],
    };

    it('PK ≤ 2 → 2 Slots', () => {
      expect(berechneSlotZahl(staatMitPK1)).toBe(2);
      expect(berechneSlotZahl(staatMitPK2)).toBe(2);
    });

    it('Legitimität ≥ 70 → 4 Slots', () => {
      expect(berechneSlotZahl(staatMitLegitimität70)).toBe(4);
    });

    it('Sonst → 3 Slots', () => {
      expect(berechneSlotZahl(staatMitLegitimität69)).toBe(3);
      expect(berechneSlotZahl(staatMitPK2)).toBe(2); // PK hat Vorrang vor Legitimität
    });

    it('Tick mit Katalog → slots im Ergebnis zurückgegeben', () => {
      const ergebnis = tick(
        staatMitLegitimität69,
        { zuteilung: {}, karten: [] },
        regelnMitKatalog,
        'dev',
      );
      expect(ergebnis.slots).toBeDefined();
      expect(ergebnis.slots!.length).toBeLessThanOrEqual(3);
    });

    it('Tick ohne Katalog → slots undefined', () => {
      const ergebnis = tick(
        staatMitLegitimität69,
        { zuteilung: {}, karten: [] },
        regelnMit({ regierung: regierungParlamentarisch }),
        'dev',
      );
      expect(ergebnis.slots).toBeUndefined();
    });

    it('Mehr Karten als Slots → TypeError', () => {
      const zuVieleKarten: TickAction = {
        zuteilung: {},
        karten: [
          {
            regel_id: 'karte:a',
            pk_kosten: 1,
            wirkung: [{ ziel: 'legitimitaet' as Effekt['ziel'], delta: 5 } as Effekt],
          } as TickKarte,
          {
            regel_id: 'karte:b',
            pk_kosten: 1,
            wirkung: [{ ziel: 'wirtschaft' as Effekt['ziel'], delta: 5 } as Effekt],
          } as TickKarte,
          {
            regel_id: 'karte:c',
            pk_kosten: 1,
            wirkung: [{ ziel: 'bildung' as Effekt['ziel'], delta: 5 } as Effekt],
          } as TickKarte,
          {
            regel_id: 'karte:d',
            pk_kosten: 1,
            wirkung: [{ ziel: 'legitimitaet' as Effekt['ziel'], delta: 5 } as Effekt],
          } as TickKarte,
        ],
      };
      expect(() => tick(staatMitLegitimität69, zuVieleKarten, regelnMitKatalog, 'dev')).toThrow(
        /maximal 3 Slots verfügbar/,
      );
    });
  });

  describe('Bildung/Forschung-Karten im Katalog (US-M3-07, FR-033)', () => {
    const staatBildungNiedrig = stateMit({
      setup: { regierungsform: 'parlamentarisch', konstitutions_ids: [] },
      indikatoren: { ...START_INDICATOREN, bildung: 40, forschung: 40 },
      politisches_kapital: 5,
      legitimitaet: 50,
    });

    const staatBildungHoch = stateMit({
      ...staatBildungNiedrig,
      indikatoren: { ...START_INDICATOREN, bildung: 80, forschung: 70 },
    });

    const regelnMitBildungForschungKarten: TickRegeln = {
      ...regelnMit({ regierung: regierungParlamentarisch }),
      karten_katalog: BILDUNG_FORSCHUNG_KARTEN,
    };

    it('Alle 6 Karten sind gültige TickKarte', () => {
      expect(BILDUNG_FORSCHUNG_KARTEN).toHaveLength(6);
      for (const karte of BILDUNG_FORSCHUNG_KARTEN) {
        expect(karte.regel_id).toMatch(/^karte:/);
        expect(karte.pk_kosten).toBeGreaterThanOrEqual(1);
        expect(karte.pk_kosten).toBeLessThanOrEqual(3);
        expect(karte.wirkung).toBeDefined();
        expect(karte.wirkung.length).toBeGreaterThan(0);
      }
    });

    it('karte:bildung_grundschule → spielbar ohne Constraints', () => {
      const ergebnis = tick(
        staatBildungNiedrig,
        {
          zuteilung: {},
          karten: [{ ...BILDUNG_FORSCHUNG_KARTEN[0] }],
        },
        regelnMitBildungForschungKarten,
        'dev',
      );
      expect(ergebnis.state.indikatoren.bildung).toBe(
        staatBildungNiedrig.indikatoren.bildung + 1, // +3 Karte, −2 Verschleiß
      );
    });

    it('karte:bildung_uni → Constraint bildung ≥ 60 verletzt bei niedrigem Level', () => {
      expect(() =>
        tick(
          staatBildungNiedrig,
          {
            zuteilung: {},
            karten: [{ ...BILDUNG_FORSCHUNG_KARTEN[1] }],
          },
          regelnMitBildungForschungKarten,
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });

    it('karte:bildung_uni → spielbar bei bildung ≥ 60', () => {
      const ergebnis = tick(
        staatBildungHoch,
        {
          zuteilung: {},
          karten: [{ ...BILDUNG_FORSCHUNG_KARTEN[1] }],
        },
        regelnMitBildungForschungKarten,
        'dev',
      );
      expect(ergebnis.state.indikatoren.bildung).toBe(
        staatBildungHoch.indikatoren.bildung + 3, // +5 Karte, −2 Verschleiß
      );
    });

    it('karte:forschung_grundlagen → Constraint bildung ≥ 50 verletzt', () => {
      const staatOhneBildungGate = stateMit({
        ...staatBildungNiedrig,
        indikatoren: { ...START_INDICATOREN, bildung: 40, forschung: 40 },
      });
      expect(() =>
        tick(
          staatOhneBildungGate,
          {
            zuteilung: {},
            karten: [{ ...BILDUNG_FORSCHUNG_KARTEN[3] }],
          },
          regelnMitBildungForschungKarten,
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });

    it('karte:forschung_transfer → Constraint forschung ≥ 80 verletzt', () => {
      expect(() =>
        tick(
          staatBildungHoch,
          {
            zuteilung: {},
            karten: [{ ...BILDUNG_FORSCHUNG_KARTEN[5] }],
          },
          regelnMitBildungForschungKarten,
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });
  });

  describe('Wirtschaft/Budget-Karten im Katalog (US-M3-08, FR-033)', () => {
    const staatWirtschaftNiedrig = stateMit({
      setup: { regierungsform: 'parlamentarisch', konstitutions_ids: [] },
      indikatoren: { ...START_INDICATOREN, wirtschaft: 30, forschung: 40 },
      schulden: 50,
      politisches_kapital: 5,
      legitimitaet: 50,
    });

    const staatWirtschaftHoch = stateMit({
      ...staatWirtschaftNiedrig,
      indikatoren: { ...START_INDICATOREN, wirtschaft: 70, forschung: 70 },
    });

    const regelnMitWirtschaftBudgetKarten: TickRegeln = {
      ...regelnMit({ regierung: regierungParlamentarisch }),
      karten_katalog: WIRTSCHAFT_BUDGET_KARTEN,
    };

    it('Alle 6 Karten sind gültige TickKarte', () => {
      expect(WIRTSCHAFT_BUDGET_KARTEN).toHaveLength(6);
      for (const karte of WIRTSCHAFT_BUDGET_KARTEN) {
        expect(karte.regel_id).toMatch(/^karte:/);
        expect(karte.pk_kosten).toBeGreaterThanOrEqual(1);
        expect(karte.pk_kosten).toBeLessThanOrEqual(3);
        expect(karte.wirkung).toBeDefined();
        expect(karte.wirkung.length).toBeGreaterThan(0);
      }
    });

    it('karte:wirtschaft_investition → spielbar ohne Constraints', () => {
      const ergebnis = tick(
        staatWirtschaftNiedrig,
        {
          zuteilung: {},
          karten: [{ ...WIRTSCHAFT_BUDGET_KARTEN[0] }],
        },
        regelnMitWirtschaftBudgetKarten,
        'dev',
      );
      expect(ergebnis.state.indikatoren.wirtschaft).toBe(
        staatWirtschaftNiedrig.indikatoren.wirtschaft + 1, // +3 Karte, −2 Verschleiß
      );
    });

    it('karte:wirtschaft_stimulus → Constraint wirtschaft ≤ 60 verletzt bei 70', () => {
      expect(() =>
        tick(
          staatWirtschaftHoch,
          {
            zuteilung: {},
            karten: [{ ...WIRTSCHAFT_BUDGET_KARTEN[1] }],
          },
          regelnMitWirtschaftBudgetKarten,
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });

    it('karte:wirtschaft_stimulus → spielbar bei wirtschaft ≤ 60', () => {
      const ergebnis = tick(
        staatWirtschaftNiedrig,
        {
          zuteilung: {},
          karten: [{ ...WIRTSCHAFT_BUDGET_KARTEN[1] }],
        },
        regelnMitWirtschaftBudgetKarten,
        'dev',
      );
      expect(ergebnis.state.indikatoren.wirtschaft).toBe(
        staatWirtschaftNiedrig.indikatoren.wirtschaft + 3, // +5 Karte, −2 Verschleiß
      );
    });

    it('karte:wirtschaft_sparen → spielbar, gibt Budget-Effekt', () => {
      const ergebnis = tick(
        staatWirtschaftNiedrig,
        {
          zuteilung: {},
          karten: [{ ...WIRTSCHAFT_BUDGET_KARTEN[2] }],
        },
        regelnMitWirtschaftBudgetKarten,
        'dev',
      );
      expect(ergebnis.state.politisches_kapital).toBeGreaterThanOrEqual(0);
    });

    it('karte:budget_steuer_reform → Constraint wirtschaft ≥ 50 verletzt bei 30', () => {
      expect(() =>
        tick(
          staatWirtschaftNiedrig,
          {
            zuteilung: {},
            karten: [{ ...WIRTSCHAFT_BUDGET_KARTEN[3] }],
          },
          regelnMitWirtschaftBudgetKarten,
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });

    it('karte:budget_steuer_reform → spielbar bei wirtschaft ≥ 50', () => {
      const ergebnis = tick(
        staatWirtschaftHoch,
        {
          zuteilung: {},
          karten: [{ ...WIRTSCHAFT_BUDGET_KARTEN[3] }],
        },
        regelnMitWirtschaftBudgetKarten,
        'dev',
      );
      expect(ergebnis.state.indikatoren.wirtschaft).toBe(
        staatWirtschaftHoch.indikatoren.wirtschaft + 1, // +3 Karte, −2 Verschleiß
      );
    });

    it('karte:budget_subventionen → Constraint wirtschaft ≤ 40 verletzt bei 70', () => {
      expect(() =>
        tick(
          staatWirtschaftHoch,
          {
            zuteilung: {},
            karten: [{ ...WIRTSCHAFT_BUDGET_KARTEN[4] }],
          },
          regelnMitWirtschaftBudgetKarten,
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });

    it('karte:wirtschaft_innovation → Constraint forschung ≥ 60 verletzt bei 40', () => {
      expect(() =>
        tick(
          staatWirtschaftNiedrig,
          {
            zuteilung: {},
            karten: [{ ...WIRTSCHAFT_BUDGET_KARTEN[5] }],
          },
          regelnMitWirtschaftBudgetKarten,
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });
  });

  describe('Soziales/Gesundheit-Karten im Katalog (US-M3-09, FR-033)', () => {
    const staatGesundheitNiedrig = stateMit({
      setup: { regierungsform: 'parlamentarisch', konstitutions_ids: [] },
      indikatoren: { ...START_INDICATOREN, gesundheit: 30, radikalisierung: 40 },
      politisches_kapital: 5,
      legitimitaet: 50,
    });

    const staatGesundheitHoch = stateMit({
      ...staatGesundheitNiedrig,
      indikatoren: { ...START_INDICATOREN, gesundheit: 80, radikalisierung: 40 },
    });

    const regelnMitSozialesGesundheitKarten: TickRegeln = {
      ...regelnMit({ regierung: regierungParlamentarisch }),
      karten_katalog: SOZIALES_GESUNDHEIT_KARTEN,
    };

    it('Alle 6 Karten sind gültige TickKarte', () => {
      expect(SOZIALES_GESUNDHEIT_KARTEN).toHaveLength(6);
      for (const karte of SOZIALES_GESUNDHEIT_KARTEN) {
        expect(karte.regel_id).toMatch(/^karte:/);
        expect(karte.pk_kosten).toBeGreaterThanOrEqual(1);
        expect(karte.pk_kosten).toBeLessThanOrEqual(3);
        expect(karte.wirkung).toBeDefined();
        expect(karte.wirkung.length).toBeGreaterThan(0);
      }
    });

    it('karte:gesundheit_praevention → spielbar ohne Constraints', () => {
      const ergebnis = tick(
        staatGesundheitNiedrig,
        {
          zuteilung: {},
          karten: [{ ...SOZIALES_GESUNDHEIT_KARTEN[0] }],
        },
        regelnMitSozialesGesundheitKarten,
        'dev',
      );
      expect(ergebnis.state.indikatoren.gesundheit).toBe(
        staatGesundheitNiedrig.indikatoren.gesundheit + 1, // +3 Karte, −2 Verschleiß
      );
    });

    it('karte:gesundheit_krankenhaus → Constraint gesundheit ≤ 70 verletzt bei 80', () => {
      expect(() =>
        tick(
          staatGesundheitHoch,
          {
            zuteilung: {},
            karten: [{ ...SOZIALES_GESUNDHEIT_KARTEN[1] }],
          },
          regelnMitSozialesGesundheitKarten,
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });

    it('karte:gesundheit_krankenhaus → spielbar bei gesundheit ≤ 70', () => {
      const ergebnis = tick(
        staatGesundheitNiedrig,
        {
          zuteilung: {},
          karten: [{ ...SOZIALES_GESUNDHEIT_KARTEN[1] }],
        },
        regelnMitSozialesGesundheitKarten,
        'dev',
      );
      expect(ergebnis.state.indikatoren.gesundheit).toBe(
        staatGesundheitNiedrig.indikatoren.gesundheit + 3, // +5 Karte, −2 Verschleiß
      );
    });

    it('karte:gesundheit_pflege → Constraint gesundheit ≤ 50 verletzt bei 80', () => {
      expect(() =>
        tick(
          staatGesundheitHoch,
          {
            zuteilung: {},
            karten: [{ ...SOZIALES_GESUNDHEIT_KARTEN[2] }],
          },
          regelnMitSozialesGesundheitKarten,
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });

    it('karte:gesundheit_pflege → spielbar bei gesundheit ≤ 50', () => {
      const ergebnis = tick(
        staatGesundheitNiedrig,
        {
          zuteilung: {},
          karten: [{ ...SOZIALES_GESUNDHEIT_KARTEN[2] }],
        },
        regelnMitSozialesGesundheitKarten,
        'dev',
      );
      expect(ergebnis.state.indikatoren.gesundheit).toBe(
        staatGesundheitNiedrig.indikatoren.gesundheit + 0, // +2 Karte, −2 Verschleiß
      );
      expect(ergebnis.state.radikalisierung).toBeLessThanOrEqual(
        staatGesundheitNiedrig.radikalisierung,
      );
    });

    it('karte:soziales_armseligkeit → Constraint radikalisierung ≥ 60 verletzt bei 40', () => {
      expect(() =>
        tick(
          staatGesundheitNiedrig,
          {
            zuteilung: {},
            karten: [{ ...SOZIALES_GESUNDHEIT_KARTEN[4] }],
          },
          regelnMitSozialesGesundheitKarten,
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });

    it('karte:soziales_gerechtigkeit → Constraint gesundheit ≥ 40 verletzt bei 30', () => {
      expect(() =>
        tick(
          staatGesundheitNiedrig,
          {
            zuteilung: {},
            karten: [{ ...SOZIALES_GESUNDHEIT_KARTEN[5] }],
          },
          regelnMitSozialesGesundheitKarten,
          'dev',
        ),
      ).toThrow(/verletzt Constraints/);
    });

    it('karte:soziales_gerechtigkeit → spielbar bei gesundheit ≥ 40', () => {
      const staatGesundheit40 = stateMit({
        ...staatGesundheitNiedrig,
        indikatoren: { ...START_INDICATOREN, gesundheit: 40, radikalisierung: 40 },
      });
      const gesundheitVorher = staatGesundheit40.indikatoren.gesundheit;
      const ergebnis = tick(
        staatGesundheit40,
        {
          zuteilung: {},
          karten: [{ ...SOZIALES_GESUNDHEIT_KARTEN[5] }],
        },
        regelnMitSozialesGesundheitKarten,
        'dev',
      );
      expect(ergebnis.state.indikatoren.gesundheit).toBe(
        gesundheitVorher + 1, // +3 Karte, −2 Verschleiß
      );
    });
  });
});
