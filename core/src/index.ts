/**
 * @staatslenker/core — deterministische Simulations-Engine.
 *
 * Der Kern ist eine pure Funktion: `tick(state, action, rules, rng) → state'`.
 * Er importiert nichts aus UI oder CLI (ADR-002) und hält den RNG im GameState.
 *
 * Noch kein Spielcode: M0 baut `state.ts`, `tick.ts`, `rng.ts`, `invariant.ts`
 * (architektur.md §7, Build-Order 1) und den Golden-Replay-Test Seed → Hash.
 */
export const CORE_PLACEHOLDER = true;
