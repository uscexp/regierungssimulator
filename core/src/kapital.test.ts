import { describe, expect, it } from 'vitest';

import {
  PK_KOSTEN_MAX,
  PK_KOSTEN_MIN,
  karteWählbar,
  pkAusgeben,
  pkRegeneration,
  pkRegenerieren,
} from '@staatslenker/core/kapital';
import { PK_MAX } from '@staatslenker/core/invariant';
import { SCHWIERIGKEIT_NORMAL } from '@staatslenker/core/indikatoren';
import {
  erzeugeGameState,
  freezeSnapshot,
  type Startkonfiguration,
} from '@staatslenker/core/state';

const basis: Startkonfiguration = {
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
  budget: {},
  politisches_kapital: 3,
  legitimitaet: 50,
  schulden: 0,
  radikalisierung: 0,
  rng: { seed: 1234, counter: 0 },
  konstitution: { steuermodell: 'flat' },
  zufriedenheits_trace: {},
};

const stateMit = (extra: Partial<Startkonfiguration>): ReturnType<typeof erzeugeGameState> => {
  const s = erzeugeGameState({ ...basis, ...extra });
  return freezeSnapshot(s);
};

describe('Politisches Kapital (FR-004, US-M0-09)', () => {
  it('eine Karte mit Kosten 2 senkt PK von 3 auf 1 (AC)', () => {
    const state = stateMit({ politisches_kapital: 3 });
    const neu = pkAusgeben(state, 2, 'karte:bildungsausbau');
    expect(neu.politisches_kapital).toBe(1);
    expect(state.politisches_kapital).toBe(3);
    expect(neu).not.toBe(state);
  });

  it('Regeneration am Jahresende ist Legitimität/10 × Schwierigkeitsfaktor — bei 50 normal 5.0 (AC)', () => {
    const state = stateMit({ politisches_kapital: 1, legitimitaet: 50 });

    const leicht = { ...SCHWIERIGKEIT_NORMAL, pk_regeneration: 1.2 };
    const schwer = { ...SCHWIERIGKEIT_NORMAL, pk_regeneration: 0.8 };

    expect(pkRegeneration(50, SCHWIERIGKEIT_NORMAL)).toBe(5.0);
    expect(pkRegeneration(25, SCHWIERIGKEIT_NORMAL)).toBe(2.5);
    expect(pkRegeneration(75, leicht)).toBe(9.0);
    expect(pkRegeneration(50, schwer)).toBe(4.0);

    expect(pkRegenerieren(state, SCHWIERIGKEIT_NORMAL).politisches_kapital).toBe(6);
    expect(pkRegenerieren(state, schwer).politisches_kapital).toBe(5);
  });

  it('die Regeneration hat ein Minimum von 1 — bei Legitimität 0 regeneriert trotzdem 1 PK', () => {
    const state = stateMit({ politisches_kapital: 0, legitimitaet: 0 });
    expect(pkRegeneration(0, SCHWIERIGKEIT_NORMAL)).toBe(1);
    expect(pkRegenerieren(state, SCHWIERIGKEIT_NORMAL).politisches_kapital).toBe(1);
  });

  it('das PK-Maximum ist 12 — Regeneration über die Obergrenze wird begrenzt', () => {
    const state = stateMit({ politisches_kapital: 10, legitimitaet: 100 });
    expect(pkRegenerieren(state, SCHWIERIGKEIT_NORMAL).politisches_kapital).toBe(PK_MAX);
    expect(
      pkRegenerieren(state, { ...SCHWIERIGKEIT_NORMAL, pk_regeneration: 1.2 }).politisches_kapital,
    ).toBe(PK_MAX);
  });

  it('bei PK < Kosten ist die Karte nicht wählbar — Prüfer und Kern sagen dasselbe (AC)', () => {
    const state = stateMit({ politisches_kapital: 2 });
    expect(karteWählbar(state, 2)).toBe(true);
    expect(karteWählbar(state, 3)).toBe(false);
    expect(() => pkAusgeben(state, 3, 'karte:krisenmanagement')).toThrow(/karte:krisenmanagement/);
  });

  it('Kosten außerhalb 1–3 sind ein illegaler Action und werden mit Regel-Id abgewiesen (FR-002)', () => {
    const state = stateMit({ politisches_kapital: 12 });
    expect(PK_KOSTEN_MIN).toBe(1);
    expect(PK_KOSTEN_MAX).toBe(3);
    expect(() => pkAusgeben(state, 0, 'karte:gratis')).toThrow(/karte:gratis/);
    expect(() => pkAusgeben(state, 4, 'karte:zu_teuer')).toThrow(/karte:zu_teuer/);
    expect(() => pkAusgeben(state, Number.NaN, 'karte:kaputt')).toThrow(/karte:kaputt/);
    expect(karteWählbar(state, 4)).toBe(false);
  });

  it('eine nicht-endliche Legitimität bei der Regeneration wird abgewiesen, nicht durchgereicht', () => {
    const state = stateMit({ legitimitaet: 50 });
    expect(() => pkRegeneration(Number.NaN, SCHWIERIGKEIT_NORMAL)).toThrow(TypeError);
    expect(() =>
      pkRegenerieren(
        freezeSnapshot({ ...state, legitimitaet: Number.NaN }) as never,
        SCHWIERIGKEIT_NORMAL,
      ),
    ).toThrow(TypeError);
  });
});
