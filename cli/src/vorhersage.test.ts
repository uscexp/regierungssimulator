/**
 * Prognose-Tests (§7/S0-C Punkt 11, ADR-009): die Vorhersage ist ein Dry-Run des echten Kern-Loops,
 * sie erfindet keine Warnung und sie verändert den gereichten State nicht.
 */
import { describe, expect, it } from 'vitest';

import { startState, tickRegelnFür } from '@staatslenker/cli/content-pack';
import { prognose } from '@staatslenker/cli/vorhersage';
import { tick } from '@staatslenker/core/tick';

const gleichmaessig = { infrastruktur: 2, bildung: 2, gesundheit: 2, wirtschaft: 2, forschung: 2 };

type Snapshot = ReturnType<typeof startState>;

/** Ein State mit allen Indikatoren auf 100 — die Wahl wird gewonnen, die Warnung muss ausbleiben. */
function vollerState(seed: number): ReturnType<typeof startState> {
  const basis = startState(seed);
  const indikatoren: Record<string, number> = {};
  for (const tag of Object.keys(basis.indikatoren)) indikatoren[tag] = 100;
  return { ...basis, indikatoren } as ReturnType<typeof startState>;
}

describe('Die Prognose warnt vor dem Machtcheck', () => {
  it('sagt Jahr 6 und die Ursache des Packs vorher (gleicher Befund wie der AutoSim)', () => {
    const p = prognose(startState(424242), tickRegelnFür('normal'), gleichmaessig);
    expect(p).not.toBeNull();
    expect(p!.jahr).toBe(6);
    expect(p!.grund_id).toBe('wahl:gewichtete_unter_47');
    expect(p!.gewichtete_zufriedenheit).toBeLessThan(47);
  });

  it('warnt auf jeder Schwierigkeit — derselbe Befund wie die Score-Spread-Baseline', () => {
    for (const schwierigkeit of ['leicht', 'normal', 'schwer'] as const) {
      const p = prognose(startState(424242), tickRegelnFür(schwierigkeit), gleichmaessig);
      expect(p!.jahr).toBe(6);
      expect(p!.grund_id).toBe('wahl:gewichtete_unter_47');
    }
  });

  it('bleibt aus, wenn der Lauf den Machtcheck gewinnt (keine erfundene Warnung)', () => {
    const p = prognose(vollerState(424242), tickRegelnFür('leicht'), gleichmaessig, 'dev', 12);
    expect(p).toBeNull();
  });

  it('bleibt aus nach einem schon verlorenen Machtcheck', () => {
    const regeln = tickRegelnFür('normal');
    const verloren = spieleJahre(startState(424242), 6);
    expect(verloren.wahl_niederlage).not.toBeUndefined();
    expect(prognose(verloren, regeln, gleichmaessig)).toBeNull();
  });

  it('ist deterministisch und lässt den gereichten State unverändert', () => {
    const regeln = tickRegelnFür('normal');
    const state = startState(424242);
    const vorher = JSON.stringify(state);
    const erste = prognose(state, regeln, gleichmaessig);
    const zweite = prognose(state, regeln, gleichmaessig);
    expect(erste).toEqual(zweite);
    expect(JSON.stringify(state)).toBe(vorher);
  });

  it('bricht am Cap ab statt ewig zu laufen', () => {
    const p = prognose(startState(424242), tickRegelnFür('normal'), gleichmaessig, 'dev', 3);
    expect(p).toBeNull();
  });
});

/** Spielt `jahre` Jahre im echten Tick — der Dry-Run ist dieselbe Funktion (ADR-009). */
function spieleJahre(state: Snapshot, jahre: number): Snapshot {
  const regeln = tickRegelnFür('normal');
  let aktuell = state;
  for (let jahr = 0; jahr < jahre; jahr++) {
    aktuell = tick(aktuell, { zuteilung: gleichmaessig }, regeln, 'dev').state;
  }
  return aktuell;
}
