import { describe, expect, it } from 'vitest';

import {
  LEVEL_MAX,
  LEVEL_MIN,
  PK_MAX,
  InvariantError,
  effektAnwenden,
  pruefeInvarianten,
  verletzungText,
} from '@staatslenker/core/invariant';
import { erzeugeRngState, nextFloat } from '@staatslenker/core/rng';
import {
  SCHEMA_VERSION,
  erzeugeGameState,
  type GameState,
  type Startkonfiguration,
} from '@staatslenker/core/state';

const basis: Startkonfiguration = {
  jahr: 1,
  indikatoren: { infrastruktur: 40, bildung: 40, gesundheit: 40, wirtschaft: 45, forschung: 40 },
  gruppen: [
    { tag: 'arbeitnehmer', zufriedenheit: 50, bevölkerungsanteil: 40, gewichte: { wirtschaft: 1 } },
    { tag: 'unternehmen', zufriedenheit: 50, bevölkerungsanteil: 35, gewichte: { wirtschaft: 1 } },
    { tag: 'bildung_jugend', zufriedenheit: 50, bevölkerungsanteil: 25, gewichte: { bildung: 1 } },
  ],
  budget: { infrastruktur: 6, bildung: 4, gesundheit: 4, wirtschaft: 5, forschung: 0 },
  politisches_kapital: 12,
  legitimitaet: 60,
  schulden: 0,
  radikalisierung: 10,
  rng: erzeugeRngState(1234),
  konstitution: {},
  zufriedenheits_trace: {},
};

function stateMit(
  indikatoren: Record<string, number>,
  extra: Partial<Startkonfiguration> = {},
): GameState {
  return erzeugeGameState({ ...basis, indikatoren, ...extra });
}

/**
 * Ein kaputter Snapshot **ohne** Factory-Validierung: der Factory weist nicht-endliche Startwerte ab
 * (US-M0-02), aber ein Tick kann über eine kaputte Regel trotzdem einen NaN-Wert erzeugen — genau
 * diesen Fall muss der Invariant-Check nach dem Tick finden (FR-002).
 */
function korruptSnapshot(teil: Partial<GameState>): GameState {
  return Object.freeze({ ...basis, schema_version: SCHEMA_VERSION, ...teil }) as GameState;
}

describe('Clamp + Invariant-Check (FR-002, US-M0-04)', () => {
  it('eine Regel mit delta +200 auf Indikator 90 endet bei 100 und der Check meldet nichts (AC)', () => {
    const state = stateMit({ infrastruktur: 90 });
    const neuerWert = effektAnwenden(
      state.indikatoren.infrastruktur!,
      200,
      'bildungsoffensive',
      'dev',
    );
    expect(neuerWert).toBe(LEVEL_MAX);

    const nachTick = stateMit({ infrastruktur: neuerWert });
    expect(pruefeInvarianten(nachTick, 'dev')).toEqual([]);
  });

  it('ein negatives Delta clampt bei 0, nie darunter', () => {
    expect(effektAnwenden(10, -150, 'brain-drain', 'dev')).toBe(LEVEL_MIN);
    expect(effektAnwenden(50, 4, 'bildungsbudget', 'dev')).toBe(54);
  });

  it('ein absichtlicher NaN bricht im Dev-Modus mit Regel-ID im Log (AC)', () => {
    let fehler: unknown;
    try {
      effektAnwenden(90, Number.NaN, 'pandemie-kette-3', 'dev');
    } catch (e) {
      fehler = e;
    }
    expect(fehler).toBeInstanceOf(InvariantError);
    const err = fehler as InvariantError;
    expect(err.regel_id).toBe('pandemie-kette-3');
    expect(err.message).toContain('pandemie-kette-3');
  });

  it('im Produktionsmodus crasht eine kaputte Regel das Spiel nicht — sie wird gemeldet (Architektur §5)', () => {
    const wert = effektAnwenden(90, Number.POSITIVE_INFINITY, 'finanzkrise', 'produktion');
    expect(wert).toBe(90);
    expect(Number.isFinite(wert)).toBe(true);

    const kaputt = korruptSnapshot({ indikatoren: { wirtschaft: Number.NaN } });
    const verletzungen = pruefeInvarianten(kaputt, 'produktion', 'finanzkrise');
    expect(verletzungen.length).toBeGreaterThan(0);
    expect(verletzungText(verletzungen[0]!)).toContain('finanzkrise');
    expect(() => pruefeInvarianten(kaputt, 'dev', 'finanzkrise')).toThrow(InvariantError);
  });

  it('der Check findet jede Grenzenverletzung — Level, PK, Schulden, Jahr, Budget', () => {
    const felder = [
      stateMit({ wirtschaft: 120 }),
      stateMit({ bildung: -3 }),
      stateMit({ wirtschaft: 45 }, { politisches_kapital: PK_MAX + 1 }),
      stateMit({ wirtschaft: 45 }, { schulden: -5 }),
      stateMit({ wirtschaft: 45 }, { jahr: 0 }),
      stateMit({ wirtschaft: 45 }, { budget: { infrastruktur: -1 } }),
      stateMit({ wirtschaft: 45 }, { legitimitaet: 101 }),
    ];

    const texts = felder.map((s) => verletzungText(pruefeInvarianten(s, 'produktion')[0]!));
    expect(texts.some((t) => t.includes('indikator:wirtschaft'))).toBe(true);
    expect(texts.some((t) => t.includes('politisches_kapital'))).toBe(true);
    expect(texts.some((t) => t.includes('schulden'))).toBe(true);
    expect(texts.some((t) => t.includes('jahr'))).toBe(true);
    expect(texts.some((t) => t.includes('budget:infrastruktur'))).toBe(true);
    expect(texts.some((t) => t.includes('legitimitaet'))).toBe(true);
  });

  it('eine Gruppe mit NaN Zufriedenheit wird gefunden (Tick-Kaputt, nicht Start-Kaputt)', () => {
    const state = korruptSnapshot({
      gruppen: [
        {
          tag: 'unternehmen',
          zufriedenheit: Number.NaN,
          bevölkerungsanteil: 35,
          gewichte: { wirtschaft: 1 },
        },
      ],
    });
    const verletzungen = pruefeInvarianten(state, 'produktion');
    expect(verletzungen.some((v) => v.feld === 'gruppe:unternehmen.zufriedenheit')).toBe(true);
  });

  it('Budget und Schulden werden nicht auf 0–100 geclampt — sie sind Wirtschafts-, keine Level-Werte', () => {
    const state = stateMit({ wirtschaft: 45 }, { schulden: 100, budget: { infrastruktur: 120 } });
    expect(pruefeInvarianten(state, 'dev')).toEqual([]);
  });

  it('10 000 zufällige Effekte erzeugen keinen NaN und keine Verletzung (NFR-002-Metrik)', () => {
    let rng = erzeugeRngState(424242);
    let verletzt = 0;
    for (let i = 0; i < 10_000; i++) {
      const basisDraw = nextFloat(rng);
      rng = basisDraw.rng;
      const deltaDraw = nextFloat(rng);
      rng = deltaDraw.rng;
      const wert = effektAnwenden(
        basisDraw.wert * 100,
        (deltaDraw.wert - 0.5) * 400,
        `harness-regel-${i}`,
        'produktion',
      );
      if (!Number.isFinite(wert) || wert < LEVEL_MIN || wert > LEVEL_MAX) verletzt += 1;
    }
    expect(verletzt).toBe(0);
  });
});
