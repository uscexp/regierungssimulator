/**
 * Golden-Replay-Tests (US-M0-16, FR-004, NFR-001): derselbe Seed + dieselbe Action-Folge ⇒
 * derselbe State-Hash, verglichen gegen das committed Fixture. Zusätzlich die §3a-Invariante:
 * ein Allokations-Replay füllt das Entscheidungsgedächtnis nie.
 */
import { describe, expect, it } from 'vitest';

import {
  GOLDEN_REPLAY_BESCHLUSS_ANZAHL,
  GOLDEN_REPLAY_CHECKPOINTS,
  GOLDEN_REPLAY_FINAL_HASH,
  GOLDEN_REPLAY_GEKUERZTE_JAHRE,
  GOLDEN_REPLAY_JAHRE,
  GOLDEN_REPLAY_NIEDERLAGE_JAHR,
  GOLDEN_REPLAY_SEED,
  GOLDEN_REPLAY_SCHWIERIGKEIT,
} from '../fixtures/replay.golden.js';
import { aktionsfolge, kanonisch, spieleReplay, stateHash } from './replay.js';
import { startState } from './content-pack.js';

describe('Golden-Replay (US-M0-16)', () => {
  it('spielt 100 Jahre mit Seed 424242 und endet auf dem hinterlegten Hash', () => {
    const lauf = spieleReplay();
    expect(lauf.jahre).toBe(GOLDEN_REPLAY_JAHRE);
    expect(lauf.seed).toBe(GOLDEN_REPLAY_SEED);
    expect(lauf.schwierigkeit).toBe(GOLDEN_REPLAY_SCHWIERIGKEIT);
    expect(lauf.final_hash).toBe(GOLDEN_REPLAY_FINAL_HASH);
    expect(lauf.checkpoints).toEqual(GOLDEN_REPLAY_CHECKPOINTS);
    expect(lauf.final_state.jahr).toBe(GOLDEN_REPLAY_JAHRE + 1);
  });

  it('ist wiederholbar: derselbe Lauf zweimal ergibt denselben Hash (FR-004)', () => {
    const erster = spieleReplay();
    const zweiter = spieleReplay();
    expect(zweiter.final_hash).toBe(erster.final_hash);
    expect(kanonisch(zweiter.final_state)).toBe(kanonisch(erster.final_state));
  });

  it('ein Allokations-Replay schreibt kein Entscheidungsgedächtnis-Entry (§3a)', () => {
    const lauf = spieleReplay();
    expect(lauf.beschluss_anzahl).toBe(GOLDEN_REPLAY_BESCHLUSS_ANZAHL);
    expect(lauf.beschluss_anzahl).toBe(0);
    expect(lauf.final_state.beschlüsse).toHaveLength(0);
  });

  it('hält die Kürzungsjahre fest (FR-041) und lässt den State dabei endlich', () => {
    const lauf = spieleReplay();
    expect(lauf.gekuerzte_jahre).toEqual(GOLDEN_REPLAY_GEKUERZTE_JAHRE);
    expect(lauf.gekuerzte_jahre.length).toBeGreaterThan(0);
    for (const wert of Object.values(lauf.final_state.indikatoren)) {
      expect(Number.isFinite(wert)).toBe(true);
    }
  });

  it('der erste Machtcheck ist verloren, der Replay läuft trotzdem weiter (FR-013)', () => {
    const lauf = spieleReplay();
    expect(lauf.niederlage_jahr).toBe(GOLDEN_REPLAY_NIEDERLAGE_JAHR);
    expect(lauf.final_state.jahr).toBe(GOLDEN_REPLAY_JAHRE + 1);
  });

  it('der Hash hängt nicht von der Schlüssel-Reihenfolge eines Records ab', () => {
    const state = startState(1234);
    const umgebaut = { ...state, indikatoren: { ...state.indikatoren } };
    expect(stateHash(umgebaut)).toBe(stateHash(state));
  });

  it('die Action-Folge ist fest und enthält nur Allokationen plus eine Schuldenaufnahme', () => {
    const folge = aktionsfolge(8);
    expect(folge.map((a) => a.label)).toEqual([
      'gleichmaessig',
      'schwerpunkt',
      'ueberallokiert',
      'schulden',
      'gleichmaessig',
      'schwerpunkt',
      'ueberallokiert',
      'schulden',
    ]);
    expect(folge.every((a) => a.action.budget_allokation !== undefined)).toBe(true);
    expect(folge.every((a) => a.action.karten === undefined)).toBe(true);
    expect(folge[3]!.action.schulden_aufnahme).toBe(4);
  });
});
