/**
 * core/setup.test — die Setup-Phase vor Turn 1 (US-M1-02, FR-015/047, Verdikt D22).
 *
 * Getestet wird: die pure Setup-Anwendung (atomisch, validiert gegen das Register), der Gate als
 * Kern-Datenregel (dev wirft, Produktion weist ab und lässt den State unverändert), und der Guard,
 * dass ein State ohne Setup die kanonische Serialisierung nicht verändert (Haui-Ruling: M0-Fixtures
 * bitgleich). Ein Pack ohne Setup-Pflicht greift nie — der M0-Harness spielt weiter ohne Setup.
 */
import { describe, expect, it } from 'vitest';

import { tick, type TickRegeln } from '@staatslenker/core/tick';
import { SCHWIERIGKEIT_NORMAL, type IndikatorRegel } from '@staatslenker/core/indikatoren';
import type { SteuerfaktorTabelle } from '@staatslenker/core/budget';
import type { SteuerlastTabelle } from '@staatslenker/core/zufriedenheit';
import {
  konstitutionsOffset,
  setupAnwenden,
  setupAbweisung,
  setupVollständig,
  type SetupPflicht,
} from '@staatslenker/core/setup';
import type { KonstitutionsEntscheidung } from '@staatslenker/core/rules';
import {
  erzeugeGameState,
  type GameState,
  type Startkonfiguration,
} from '@staatslenker/core/state';

const pflicht: SetupPflicht = {
  konstitutions_ids: ['grundrechte', 'gewaltenteilung', 'steuermodell'],
};

const indikator_regeln: readonly IndikatorRegel[] = [
  {
    tag: 'bildung',
    verschleiß: 2,
    budget_wirkung: 0.6,
    diminishing_at: 65,
    diminishing_wirkung: 0.25,
  },
];
const steuerfaktor: SteuerfaktorTabelle = { niedrig: 0.6, flat: 0.8, progressiv: 1.0, hoch: 1.2 };
const steuerlast: SteuerlastTabelle = {
  arbeitnehmer: { niedrig: 2, flat: 4, progressiv: 3, hoch: 8 },
};

const start: Startkonfiguration = {
  jahr: 1,
  indikatoren: { bildung: 40 },
  gruppen: [
    {
      tag: 'arbeitnehmer',
      zufriedenheit: 49.21,
      bevölkerungsanteil: 51.1,
      gewichte: { bildung: 1 },
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

function stateOhneSetup(): GameState {
  return erzeugeGameState(start);
}

function regelnMit(extra: Partial<TickRegeln> = {}): TickRegeln {
  return {
    indikator_regeln,
    steuerfaktor,
    steuerlast,
    schwierigkeit: SCHWIERIGKEIT_NORMAL,
    news_vorlagen: { setup_abgewiesen: 'Die Regierung ist noch nicht gegründet.' },
    ...extra,
  };
}

describe('setupAnwenden — pure Setup-Anwendung (D22)', () => {
  it('setzt die Form und die Konstitutions-Ids und merged die Konstitutions-Werte', () => {
    const state = stateOhneSetup();
    const nach = setupAnwenden(
      state,
      {
        regierungsform: 'praesidential',
        konstitutions_ids: ['grundrechte', 'gewaltenteilung', 'steuermodell'],
        konstitution: { grundrechte: true, steuermodell: 'flat' },
      },
      pflicht,
    );
    expect(nach.setup?.regierungsform).toBe('praesidential');
    expect(nach.setup?.konstitutions_ids).toEqual([
      'grundrechte',
      'gewaltenteilung',
      'steuermodell',
    ]);
    expect(nach.konstitution).toEqual({ steuermodell: 'flat', grundrechte: true });
    expect(Object.isFrozen(nach)).toBe(true);
    expect(state.setup).toBeUndefined();
  });

  it('lehnt eine unbekannte Form, eine Id außerhalb des Registers, Duplikate und ein leeres Feld ab — mit Namen', () => {
    const state = stateOhneSetup();
    expect(() =>
      setupAnwenden(
        state,
        { regierungsform: 'monarchie' as 'praesidential', konstitutions_ids: ['grundrechte'] },
        pflicht,
      ),
    ).toThrow(/regierungsform "monarchie"/);
    expect(() =>
      setupAnwenden(
        state,
        { regierungsform: 'praesidential', konstitutions_ids: ['pressefreiheit'] },
        pflicht,
      ),
    ).toThrow(/konstitutions_id "pressefreiheit" ist nicht im geladenen Register/);
    expect(() =>
      setupAnwenden(
        state,
        { regierungsform: 'praesidential', konstitutions_ids: ['grundrechte', 'grundrechte'] },
        pflicht,
      ),
    ).toThrow(/Duplikate/);
    expect(() =>
      setupAnwenden(state, { regierungsform: 'praesidential', konstitutions_ids: [] }, pflicht),
    ).toThrow(/konstitutions_ids ist leer/);
    expect(() =>
      setupAnwenden(
        state,
        {
          regierungsform: 'praesidential',
          konstitutions_ids: ['steuermodell'],
          konstitution: { steuermodell: 'autoritär' },
        },
        pflicht,
      ),
    ).toThrow(/steuermodell "autoritär"/);
  });

  it('schreibt keinen halb gesetzten Snapshot: eine kapute Id wirft, bevor der State entsteht (ADR-003)', () => {
    const state = stateOhneSetup();
    expect(() =>
      setupAnwenden(
        state,
        {
          regierungsform: 'praesidential',
          konstitutions_ids: ['grundrechte', 'nicht_im_register'],
        },
        pflicht,
      ),
    ).toThrow(/nicht_im_register/);
    expect(state.setup).toBeUndefined();
  });
});

describe('Setup-Vollständigkeit und Abweisung (AC US-M1-02)', () => {
  it('ein Setup ohne Pflicht-Ids ist unvollständig; alle Pflicht-Ids sind vollständig', () => {
    const teil = setupAnwenden(
      stateOhneSetup(),
      { regierungsform: 'praesidential', konstitutions_ids: ['grundrechte'] },
      pflicht,
    );
    expect(setupVollständig(teil, pflicht)).toBe(false);
    expect(setupAbweisung(teil, pflicht)).toContain('gewaltenteilung');
    const voll = setupAnwenden(
      stateOhneSetup(),
      { regierungsform: 'praesidential', konstitutions_ids: pflicht.konstitutions_ids },
      pflicht,
    );
    expect(setupVollständig(voll, pflicht)).toBe(true);
    expect(setupAbweisung(voll, pflicht)).toBeUndefined();
  });

  it('ein Pack ohne Setup-Pflicht greift nie — der M0-Harness spielt ohne Setup weiter', () => {
    const state = stateOhneSetup();
    expect(setupAbweisung(state, undefined)).toBeUndefined();
    const ergebnis = tick(state, { zuteilung: {} }, regelnMit());
    expect(ergebnis.state.jahr).toBe(2);
    expect(ergebnis.setup_abgewiesen).toBeUndefined();
  });
});

describe('tick-Gate ohne vollständigen Setup (D22)', () => {
  it('im Dev-Modus wirft der Kern mit Grund', () => {
    expect(() =>
      tick(stateOhneSetup(), { zuteilung: {} }, regelnMit({ setup_pflicht: pflicht })),
    ).toThrow(/Turn ohne Setup: Setup fehlt/);
  });

  it('im Produktionsmodus bleibt der State unverändert und der Grund kommt als setup_abgewiesen + News-Template', () => {
    const state = stateOhneSetup();
    const ergebnis = tick(
      state,
      { zuteilung: { bildung: 4 } },
      regelnMit({ setup_pflicht: pflicht }),
      'produktion',
    );
    expect(ergebnis.state).toBe(state);
    expect(ergebnis.state.jahr).toBe(1);
    expect(ergebnis.setup_abgewiesen).toContain('Turn 1 ist erst danach möglich');
    expect(ergebnis.news).toEqual([
      { id: 'setup_abgewiesen', text: 'Die Regierung ist noch nicht gegründet.' },
    ]);
    expect(ergebnis.unterhalt_be).toBe(0);
    expect(ergebnis.gekuerzte_be).toBe(0);
  });

  it('nach vollständigem Setup läuft der Turn', () => {
    const state = setupAnwenden(
      stateOhneSetup(),
      { regierungsform: 'praesidential', konstitutions_ids: pflicht.konstitutions_ids },
      pflicht,
    );
    const ergebnis = tick(
      state,
      { zuteilung: { bildung: 4 } },
      regelnMit({ setup_pflicht: pflicht }),
    );
    expect(ergebnis.state.jahr).toBe(2);
    expect(ergebnis.setup_abgewiesen).toBeUndefined();
    expect(ergebnis.state.setup?.regierungsform).toBe('praesidential');
  });
});

describe('kanonische Serialisierung bleibt bitgleich (Haui-Ruling, D22)', () => {
  it('ein State ohne Setup serialisiert den Key nicht; mit Setup erscheint er', () => {
    const ohne = JSON.stringify(stateOhneSetup());
    expect(ohne.includes('"setup"')).toBe(false);
    const mit = JSON.stringify(
      setupAnwenden(
        stateOhneSetup(),
        { regierungsform: 'praesidential', konstitutions_ids: pflicht.konstitutions_ids },
        pflicht,
      ),
    );
    expect(mit.includes('"setup"')).toBe(true);
    expect(mit.includes('"grundrechte"')).toBe(true);
  });
});

describe('Konstitutions-Baseline (US-M1-05, AC: sofort verschiebt)', () => {
  const entscheidungen: readonly KonstitutionsEntscheidung[] = [
    {
      regel_id: 'grundrechte',
      label: 'Grundrechte garantieren',
      beschreibung: 'Liberale gewinnen, Konservative verlieren.',
      sofort_effekte: { liberale_minderheiten: 6, konservative: -4 },
      regelsatz_modifikator: { steuermodell: 'flat' },
    },
    {
      regel_id: 'weltlichkeit',
      label: 'Weltlichkeit des Staates',
      beschreibung: 'Weltlichkeit drueckt die Konservativen.',
      sofort_effekte: { konservative: -2 },
      regelsatz_modifikator: { steuermodell: 'flat' },
    },
    {
      regel_id: 'steuermodell',
      label: 'Steuermodell festlegen',
      beschreibung: 'Das Modell wird festgelegt.',
      sofort_effekte: {},
      regelsatz_modifikator: { steuermodell: 'flat' },
    },
  ];
  const ids = ['grundrechte', 'weltlichkeit', 'steuermodell'];
  const pflichtMitRegister: SetupPflicht = { konstitutions_ids: ids, entscheidungen };
  const pflichtMitSteuerlast: SetupPflicht = {
    konstitutions_ids: ids,
    entscheidungen,
    steuerlast: steuerlast,
  };

  /**
   * Start-Gruppen, deren Zufriedenheit der Formel entspricht. Die Steuerlast-Tabelle dieses Tests
   * enthaelt nur `arbeitnehmer` (last 4) — die beiden neuen Gruppen haben last 0, also 10 + 40 = 50.
   */
  function stateMitGruppen(): GameState {
    return erzeugeGameState({
      ...start,
      gruppen: [
        {
          tag: 'arbeitnehmer',
          zufriedenheit: 46,
          bevölkerungsanteil: 51.1,
          gewichte: { bildung: 1 },
        },
        {
          tag: 'liberale_minderheiten',
          zufriedenheit: 50,
          bevölkerungsanteil: 24.9,
          gewichte: { bildung: 1 },
        },
        {
          tag: 'konservative',
          zufriedenheit: 50,
          bevölkerungsanteil: 24.9,
          gewichte: { bildung: 1 },
        },
      ],
    });
  }

  function setupMit(pflichtValue: SetupPflicht): GameState {
    return setupAnwenden(
      stateMitGruppen(),
      { regierungsform: 'praesidential', konstitutions_ids: ids },
      pflichtValue,
    );
  }

  it('die Sofort-Effekte der gewaehlten Entscheidungen werden als Offset summiert', () => {
    const nach = setupMit(pflichtMitRegister);
    expect(nach.setup?.konstitutions_offset).toEqual({
      liberale_minderheiten: 6,
      konservative: -6,
    });
    expect(Object.isFrozen(nach.setup?.konstitutions_offset)).toBe(true);
    expect(konstitutionsOffset(['weltlichkeit'], entscheidungen)).toEqual({ konservative: -2 });
    expect(konstitutionsOffset([], entscheidungen)).toEqual({});
  });

  it('ein Setup ohne Register-Entscheidungen schreibt keinen Offset-Key (M0-Pfad unveraendert)', () => {
    const nach = setupAnwenden(
      stateMitGruppen(),
      { regierungsform: 'praesidential', konstitutions_ids: pflicht.konstitutions_ids },
      pflicht,
    );
    expect(nach.setup?.konstitutions_offset).toBeUndefined();
    expect(JSON.stringify(nach.setup).includes('konstitutions_offset')).toBe(false);
  });

  it('die Verschiebung ist sofort sichtbar: das Setup rechnet die Gruppen-Zufriedenheit neu', () => {
    const nach = setupMit(pflichtMitSteuerlast);
    const liberale = nach.gruppen.find((g) => g.tag === 'liberale_minderheiten');
    const konservative = nach.gruppen.find((g) => g.tag === 'konservative');
    // AC: liberaler hoeher, konservativer niedriger als ohne Grundrechte (Baseline 50).
    // 50 + 6 = 56, 50 - 6 = 44.
    expect(liberale?.zufriedenheit).toBe(56);
    expect(konservative?.zufriedenheit).toBe(44);
    expect(liberale?.zufriedenheit).toBeGreaterThan(50);
    expect(konservative?.zufriedenheit).toBeLessThan(50);
  });

  it('der Tick erhaelt den Offset am Jahrsanfang und erfindet keinen Delta-Grund dafuer', () => {
    const state = setupMit(pflichtMitSteuerlast);
    const ergebnis = tick(
      state,
      { zuteilung: {} },
      regelnMit({ setup_pflicht: pflichtMitSteuerlast }),
    );
    const liberale = ergebnis.state.gruppen.find((g) => g.tag === 'liberale_minderheiten');
    // Der Tick rechnet die Zufriedenheit am Jahrsanfang aus den Leveln des letzten Tick (Tick-
    // Semantik, US-M0-11): die Bildung ist noch 40, der Offset bleibt — 10 + 40 + 6 = 56. Der
    // Verschleiss erscheint im Folgejahr. Die Spur ist leer, weil der Offset kein Delta ist: ein
    // erfundener Konstitutions-Grund waere ein Grund ohne Wirkung (ADR-008).
    expect(liberale?.zufriedenheit).toBe(56);
    expect(ergebnis.state.zufriedenheits_trace['liberale_minderheiten']).toEqual([]);
    expect(ergebnis.state.setup?.konstitutions_offset).toEqual({
      liberale_minderheiten: 6,
      konservative: -6,
    });
  });

  it('ein State ohne Setup rechnet bitgleich weiter (M0-Fixtures bleiben unveraendert)', () => {
    const a = tick(stateMitGruppen(), { zuteilung: {} }, regelnMit());
    const b = tick(stateMitGruppen(), { zuteilung: {} }, regelnMit());
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(JSON.stringify(stateMitGruppen()).includes('"setup"')).toBe(false);
  });

  it('der Offset ist atomisch: eine kapute Id wirft, bevor Offset und Zufriedenheit entstehen', () => {
    const state = stateMitGruppen();
    expect(() =>
      setupAnwenden(
        state,
        {
          regierungsform: 'praesidential',
          konstitutions_ids: ['grundrechte', 'nicht_im_register'],
        },
        pflichtMitSteuerlast,
      ),
    ).toThrow(/nicht_im_register/);
    expect(state.setup).toBeUndefined();
    expect(state.gruppen.find((g) => g.tag === 'liberale_minderheiten')?.zufriedenheit).toBe(50);
  });
});
