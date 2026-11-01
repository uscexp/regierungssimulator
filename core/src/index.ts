/**
 * @staatslenker/core — deterministische Simulations-Engine.
 *
 * Der Kern ist eine pure Funktion: `tick(state, action, rules) → state'` — der RNG liegt im
 * GameState (ADR-006), deshalb gibt es keinen RNG-Parameter. Er importiert nichts aus UI oder CLI
 * (ADR-002) und der Build prüft das bei jedem `npm run build` (core-check.mjs).
 *
 * Der Kernel hat keinen Default-Export und kein barrel-only-API: jede Importstelle adressiert das
 * Modul direkt, damit der Isolation-Check Kern-Importe pro Modul zählt. Die Barrel-Exports unten
 * sind für Konsumenten, die den ganzen Snapshot brauchen (UI, CLI, Tests).
 */
export * from './state.js';
export * from './rng.js';
export * from './invariant.js';
export * from './zufriedenheit.js';
export * from './indikatoren.js';
export * from './beschlüsse.js';
export * from './kapital.js';
export * from './budget.js';
export * from './ereignisse.js';
export * from './tick.js';
export * from './wahl.js';
export * from './wahl-eval.js';
export * from './eval.js';
export * from './entscheidung.js';
export * from './rules.js';
export * from './setup.js';
