/**
 * @staatslenker/cli — Adapter für M0: Text-UI und AutoSim-Balance-Harness.
 *
 * Der CLI importiert den Kern und sendet Actions; er berechnet keine eigene Simulation.
 * Noch kein Turn-Runner: M0-Story US-M0-12 (Spiel im Terminal durchspielbar) und
 * US-M0-13 (AutoSim: 3 Naiv-Strategien × 20 Seeds × 30 Jahre) bauen hier.
 */
import { CORE_PLACEHOLDER } from '@staatslenker/core';

export function boot(): string {
  return `Staatslenker CLI — Kern geladen: ${CORE_PLACEHOLDER ? 'ja' : 'nein'} — noch kein Turn-Runner (M0).`;
}

console.log(boot());
