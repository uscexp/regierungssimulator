import { describe, expect, it } from 'vitest';

import { GOLDEN_SEED, GOLDEN_SEED_1234 } from '../fixtures/rng.golden.ts';
import { erzeugeRngState, nextFloat, nextInt, würfele } from '@staatslenker/core/rng';
import { erzeugeGameState, type Startkonfiguration } from '@staatslenker/core/state';

/** Kanonische mulberry32 als Referenz — unabhängig implementiert, damit die Counter-Version verglichen werden kann. */
function kanonisch(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 29 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Zieht n Werte und gibt den fortgeschrittenen RNG-State zurück. */
function serie(
  seed: number,
  n: number,
): { werte: number[]; rng: { seed: number; counter: number } } {
  let rng = erzeugeRngState(seed);
  const werte: number[] = [];
  for (let i = 0; i < n; i++) {
    const draw = nextFloat(rng);
    werte.push(draw.wert);
    rng = draw.rng;
  }
  return { werte, rng };
}

describe('seedbarer RNG im State (FR-004, US-M0-03)', () => {
  it('Seed 1234 reproduziert exakt das Golden-Fixture über 100 Draws', () => {
    const { werte, rng } = serie(GOLDEN_SEED, 100);
    expect(werte).toEqual([...GOLDEN_SEED_1234]);
    expect(rng.counter).toBe(100);
  });

  it('die Counter-Version ist identisch zur kanonischen mulberry32-Folge', () => {
    const Referenz = kanonisch(1234);
    const { werte } = serie(1234, 100);
    expect(werte).toEqual(Array.from({ length: 100 }, () => Referenz()));
  });

  it('derselbe Seed ergibt denselben Verlauf — zweimal, ohne globalen Zustand', () => {
    expect(serie(424242, 25).werte).toEqual(serie(424242, 25).werte);
    expect(serie(424242, 25).werte).not.toEqual(serie(1, 25).werte);
  });

  it('ein Draw verbraucht den Eingangs-State nicht (ADR-002 — pure Funktion)', () => {
    const state = erzeugeRngState(7);
    const erster = nextFloat(state);
    const zweiter = nextFloat(state);
    expect(erster.wert).toBe(zweiter.wert);
    expect(state).toEqual({ seed: 7, counter: 0 });
    expect(erster.rng).toEqual({ seed: 7, counter: 1 });
    expect(erster.wert).not.toBe(nextFloat(erster.rng).wert);
  });

  it('der RNG-Zustand liegt im Snapshot und ist serialisierbar', () => {
    const konfiguration: Startkonfiguration = {
      jahr: 1,
      indikatoren: { wirtschaft: 45 },
      gruppen: [
        {
          tag: 'arbeitnehmer',
          zufriedenheit: 50,
          bevölkerungsanteil: 100,
          gewichte: { wirtschaft: 1 },
        },
      ],
      budget: { wirtschaft: 5 },
      politisches_kapital: 12,
      legitimitaet: 60,
      schulden: 0,
      radikalisierung: 10,
      rng: erzeugeRngState(1234),
      konstitution: {},
      zufriedenheits_trace: {},
    };
    const state = erzeugeGameState(konfiguration);
    expect(JSON.stringify(state.rng)).toBe('{"seed":1234,"counter":0}');
    expect(JSON.parse(JSON.stringify(state.rng))).toEqual({ seed: 1234, counter: 0 });
  });

  it('nextInt liegt in [0, grenze) und lehnt ungültige Grenzen ab', () => {
    let rng = erzeugeRngState(99);
    for (let i = 0; i < 50; i++) {
      const draw = nextInt(rng, 6);
      expect(draw.wert).toBeGreaterThanOrEqual(0);
      expect(draw.wert).toBeLessThan(6);
      rng = draw.rng;
    }
    expect(() => nextInt(erzeugeRngState(1), 0)).toThrow(TypeError);
    expect(() => nextInt(erzeugeRngState(1), 2.5)).toThrow(TypeError);
  });

  it('würfele meldet die Regel-ID, wenn eine Wahrscheinlichkeit außerhalb 0–1 liegt (FR-002)', () => {
    const fehler = (() => {
      try {
        würfele(erzeugeRngState(5), 1.5, 'finanzkrise');
        return '';
      } catch (e) {
        return (e as TypeError).message;
      }
    })();
    expect(fehler).toContain('finanzkrise');
    expect(fehler).toContain('0–1');
  });

  it(' Seeds werden auf int32 normalisiert und nicht-endliche Seeds abgewiesen', () => {
    expect(erzeugeRngState(42.9).seed).toBe(42);
    expect(serie(42.9, 10).werte).toEqual(serie(42, 10).werte);
    expect(() => erzeugeRngState(Number.NaN)).toThrow(TypeError);
  });
});
