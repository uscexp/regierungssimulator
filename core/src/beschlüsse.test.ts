import { beforeEach, describe, expect, it } from 'vitest';

import {
  BESCHLUSS_WIRKDAUER,
  aktiveBeschlüsse,
  beschlüssePrunen,
  beschlussEintragen,
  effekteAusBeschlüsse,
} from '@staatslenker/core/beschlüsse';
import {
  erzeugeGameState,
  freezeSnapshot,
  type Effekt,
  type GameState,
} from '@staatslenker/core/state';

const basis: Omit<GameState, 'schema_version' | 'beschlüsse'> = {
  jahr: 1,
  indikatoren: { bildung: 40, wirtschaft: 45 },
  gruppen: [
    {
      tag: 'arbeitnehmer',
      zufriedenheit: 46,
      bevölkerungsanteil: 51.1,
      gewichte: { wirtschaft: 1 },
    },
  ],
  budget: { bildung: 0 },
  politisches_kapital: 6,
  legitimitaet: 50,
  schulden: 0,
  radikalisierung: 0,
  rng: { seed: 1234, counter: 0 },
  konstitution: { steuermodell: 'flat' },
  zufriedenheits_trace: {},
};

const bildungPlus = (delta: number): readonly Effekt[] => [
  { ziel: 'indikatoren', tag: 'bildung', delta },
];

function stateImJahr(jahr: number): GameState {
  return erzeugeGameState({ ...basis, jahr });
}

function jahrSetzen(state: GameState, jahr: number): GameState {
  return freezeSnapshot({ ...state, jahr }) as GameState;
}

describe('Entscheidungsgedächtnis (FR-006, US-M0-08)', () => {
  let state: GameState;

  beforeEach(() => {
    state = stateImJahr(1);
  });

  it('ein Beschluss wirkt drei Jahre inklusive des Jahres, in dem er gefallen ist', () => {
    state = beschlussEintragen(state, { regel_id: 'karte:bildung_plus', wirkung: bildungPlus(3) });

    expect(state.beschlüsse).toHaveLength(1);
    expect(state.beschlüsse[0]!.wirkt_bis_jahr).toBe(1 + BESCHLUSS_WIRKDAUER - 1);
    expect(aktiveBeschlüsse(jahrSetzen(state, 3))).toHaveLength(1);
    expect(aktiveBeschlüsse(jahrSetzen(state, 4))).toHaveLength(0);
  });

  it('vier Beschlüsse in vier Jahren: in Jahr 4 wirken nur 2–4, Beschluss 1 ist entfernt (AC)', () => {
    let s = state;
    for (let jahr = 1; jahr <= 4; jahr++) {
      s = beschlussEintragen(jahrSetzen(s, jahr), {
        regel_id: `karte:${jahr}`,
        wirkung: bildungPlus(jahr),
      });
      s = beschlüssePrunen(s);
    }

    const aktiv = aktiveBeschlüsse(s);
    expect(aktiv.map((b) => b.regel_id)).toEqual(['karte:2', 'karte:3', 'karte:4']);

    const effekte = effekteAusBeschlüsse(s);
    expect(effekte.indikatoren.bildung).toBe(2 + 3 + 4);
  });

  it('ein Beschluss mit wirkt_bis_jahr == jahr wirkt in diesem Jahr noch und fällt erst am Jahresende raus', () => {
    state = beschlussEintragen(state, { regel_id: 'karte:sparen', wirkung: bildungPlus(-2) });
    const jahr3 = beschlüssePrunen(jahrSetzen(state, 3));

    expect(aktiveBeschlüsse(jahr3)).toHaveLength(1);
    expect(effekteAusBeschlüsse(jahr3).indikatoren.bildung).toBe(-2);
    expect(beschlüssePrunen(jahrSetzen(state, 4)).beschlüsse).toHaveLength(0);
  });

  it('Effekte mehrerer Beschlüsse werden je Tag und je Skalar aufsummiert', () => {
    let s = beschlussEintragen(state, {
      regel_id: 'a',
      wirkung: [{ ziel: 'indikatoren', tag: 'bildung', delta: 2 }],
    });
    s = beschlussEintragen(s, {
      regel_id: 'b',
      wirkung: [{ ziel: 'indikatoren', tag: 'bildung', delta: 1 }],
    });
    s = beschlussEintragen(s, {
      regel_id: 'c',
      wirkung: [{ ziel: 'gruppen', tag: 'arbeitnehmer', delta: -4 }],
    });
    s = beschlussEintragen(s, { regel_id: 'd', wirkung: [{ ziel: 'legitimitaet', delta: 5 }] });

    const effekte = effekteAusBeschlüsse(s);
    expect(effekte.indikatoren.bildung).toBe(3);
    expect(effekte.gruppen.arbeitnehmer).toBe(-4);
    expect(effekte.legitimitaet).toBe(5);
    expect(effekte.politisches_kapital).toBe(0);
  });

  it('der alte Snapshot wird nicht mutiert (ADR-002)', () => {
    const neu = beschlussEintragen(state, { regel_id: 'karte:x', wirkung: bildungPlus(3) });
    expect(state.beschlüsse).toHaveLength(0);
    expect(neu.beschlüsse).toHaveLength(1);
    expect(neu).not.toBe(state);
  });

  it('ein nicht-endliches Delta oder eine Dauer < 1 werden mit Regel-Id abgewiesen (FR-002)', () => {
    expect(() =>
      beschlussEintragen(state, { regel_id: 'karte:kaputt', wirkung: bildungPlus(Number.NaN) }),
    ).toThrow(/karte:kaputt/);
    expect(() =>
      beschlussEintragen(state, {
        regel_id: 'karte:dauer',
        wirkung: bildungPlus(1),
        wirkdauer_jahre: 0,
      }),
    ).toThrow(/karte:dauer/);
    expect(() =>
      erzeugeGameState({
        ...basis,
        beschlüsse: [
          {
            regel_id: 'alt',
            wirkung: bildungPlus(Infinity),
            wirkdauer_jahre: 3,
            wirkt_bis_jahr: 4,
          },
        ],
      }),
    ).toThrow(/alt/);
  });

  it('eine Karten-Wirkdauer ist Content und kann die Standarddauer überschreiben', () => {
    const s = beschlussEintragen(state, {
      regel_id: 'karte:befristet',
      wirkung: bildungPlus(4),
      wirkdauer_jahre: 1,
    });
    expect(s.beschlüsse[0]!.wirkt_bis_jahr).toBe(1);
    expect(aktiveBeschlüsse(jahrSetzen(s, 2))).toHaveLength(0);
  });
});
