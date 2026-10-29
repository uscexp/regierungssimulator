import { describe, expect, it } from 'vitest';

import {
  SCHEMA_VERSION,
  erzeugeGameState,
  type Startkonfiguration,
} from '@staatslenker/core/state';

/**
 * Fixture für M0: 5 Indikatoren, 3 Gruppen (AC US-M0-02). Das tatsächliche M0-Content-Set
 * entscheidet US-M0-13 — der Kern ist tag-getrieben und kennt diese Namen nicht.
 */
const start: Startkonfiguration = {
  jahr: 1,
  indikatoren: {
    infrastruktur: 40,
    bildung: 40,
    gesundheit: 40,
    wirtschaft: 45,
    forschung: 40,
  },
  gruppen: [
    {
      tag: 'arbeitnehmer',
      zufriedenheit: 50,
      bevölkerungsanteil: 40,
      gewichte: { wirtschaft: 0.45, gesundheit: 0.25, recht: 0.15, sicherheit: 0.15 },
    },
    {
      tag: 'unternehmen',
      zufriedenheit: 50,
      bevölkerungsanteil: 35,
      gewichte: { wirtschaft: 0.55, infrastruktur: 0.3, sicherheit: 0.15 },
    },
    {
      tag: 'bildung_jugend',
      zufriedenheit: 50,
      bevölkerungsanteil: 25,
      gewichte: { bildung: 0.6, forschung: 0.25, freiheit: 0.15 },
    },
  ],
  budget: { infrastruktur: 6, bildung: 4, gesundheit: 4, wirtschaft: 5, forschung: 0 },
  politisches_kapital: 12,
  legitimitaet: 60,
  schulden: 0,
  radikalisierung: 10,
  rng: { seed: 1234, counter: 0 },
  konstitution: {},
  zufriedenheits_trace: {},
};

describe('GameState (FR-001, US-M0-02)', () => {
  it('enthält alle Pflichtfelder — 5 Indikatoren, 3 Gruppen, Budget, PK, Legitimität, Schulden, Jahr, RNG, Konstitution', () => {
    const state = erzeugeGameState(start);

    expect(Object.keys(state.indikatoren)).toHaveLength(5);
    expect(state.gruppen).toHaveLength(3);
    for (const gruppe of state.gruppen) {
      expect(typeof gruppe.tag).toBe('string');
      expect(typeof gruppe.zufriedenheit).toBe('number');
      expect(typeof gruppe.bevölkerungsanteil).toBe('number');
      expect(typeof gruppe.gewichte).toBe('object');
    }
    expect(state.budget).toBeDefined();
    expect(state.politisches_kapital).toBe(12);
    expect(state.legitimitaet).toBe(60);
    expect(state.schulden).toBe(0);
    expect(state.jahr).toBe(1);
    expect(state.rng).toEqual({ seed: 1234, counter: 0 });
    expect(state.konstitution).toEqual({});
    expect(state.zufriedenheits_trace).toEqual({});
    expect(state.schema_version).toBe(SCHEMA_VERSION);
  });

  it('der Snapshot-Typ ist readonly — Zuweisung kompiliert nicht und läuft im Freeze auf', () => {
    const state = erzeugeGameState(start);

    // Compilezeit: readonly (ADR-002 — der Tick darf den alten Snapshot nicht mutieren).
    expect(() => {
      // @ts-expect-error Der Snapshot ist readonly.
      state.jahr = 2;
    }).toThrow(TypeError);
    expect(() => {
      // @ts-expect-error Ebenso für die Gruppenliste.
      state.gruppen.push({ tag: 'bauern', zufriedenheit: 50, bevölkerungsanteil: 5, gewichte: {} });
    }).toThrow(TypeError);

    expect(state.jahr).toBe(1);
    expect(state.gruppen).toHaveLength(3);
  });

  it('der Snapshot ist tief eingefroren, nicht nur oberflächlich', () => {
    const state = erzeugeGameState(start);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.indikatoren)).toBe(true);
    expect(Object.isFrozen(state.budget)).toBe(true);
    expect(Object.isFrozen(state.gruppen)).toBe(true);
    expect(Object.isFrozen(state.gruppen[0])).toBe(true);
    expect(Object.isFrozen(state.gruppen[0]?.gewichte)).toBe(true);
    expect(Object.isFrozen(state.rng)).toBe(true);
    expect(() => {
      (state.indikatoren as Record<string, number>).wirtschaft = 90;
    }).toThrow(TypeError);
  });

  it('der Snapshot ist serialisierbar und round-trip gleich (Save/Persistenz, ADR-005)', () => {
    const state = erzeugeGameState(start);
    const json = JSON.stringify(state);
    expect(JSON.parse(json)).toEqual(state);
    expect(json.length).toBeLessThan(12_000);
  });

  it('weist nicht-endliche Startwerte ab, statt einen NaN-State zu erzeugen (FR-002)', () => {
    expect(() => erzeugeGameState({ ...start, legitimitaet: Number.NaN })).toThrow(TypeError);
    expect(() =>
      erzeugeGameState({ ...start, indikatoren: { ...start.indikatoren, bildung: Number.NaN } }),
    ).toThrow(TypeError);
    expect(() =>
      erzeugeGameState({ ...start, gruppen: [{ ...start.gruppen[0]!, zufriedenheit: Infinity }] }),
    ).toThrow(TypeError);
    // Das Budget ist ein Zahlen-Record wie die Indikatoren (Lens-Follow-up zu PR #2): ein
    // NaN-Budget würde sonst einen NaN-State erzeugen, den erst der Tick sähe.
    expect(() => erzeugeGameState({ ...start, budget: { bildung: Number.NaN } })).toThrow(
      TypeError,
    );
    expect(() => erzeugeGameState({ ...start, budget: { wirtschaft: Infinity } })).toThrow(
      TypeError,
    );
    expect(() => erzeugeGameState({ ...start, budget: { forschung: -Infinity } })).toThrow(
      TypeError,
    );
    // Maya-F-02 Regression: eine negative Allokation ist kaputte Eingabe, kein Spielzustand.
    expect(() => erzeugeGameState({ ...start, budget: { bildung: -1 } })).toThrow(/ negativ/);
    expect(() => erzeugeGameState({ ...start, budget: { wirtschaft: -0.5 } })).toThrow(/ negativ/);
    // 0 BE ist erlaubt (Forschung startet unallokiert).
    expect(erzeugeGameState({ ...start, budget: { forschung: 0 } }).budget.forschung).toBe(0);
  });
});
