/**
 * Generiert das Golden-Replay-Fixture für US-M0-16 (FR-004, NFR-001).
 *
 * Der Inhalt kommt aus der echten Implementierung (`spieleReplay` gegen den gebauten Kern),
 * nicht von Hand abgeschrieben. `npm run build` muss vorher laufen. Der npm-Script normalisiert
 * danach das Format mit Prettier — ein bare `node`-Aufruf liefert Prettier-unformes Format:
 *   npm run golden:replay
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import {
  REPLAY_CHECKINTERVAL,
  REPLAY_JAHRE,
  REPLAY_SEED,
  REPLAY_SCHWIERIGKEIT,
  spieleReplay,
} from '@staatslenker/cli/replay';

const ergebnis = spieleReplay();

const inhalt = `/**
 * Golden-Replay-Fixture (US-M0-16): Seed ${REPLAY_SEED}, ${REPLAY_JAHRE} Jahre, Schwierigkeit
 * "${REPLAY_SCHWIERIGKEIT}", feste Action-Folge aus cli/src/replay.ts (vier Muster im Wechsel).
 * Erzeugt von \`node scripts/generate-replay-golden.mjs\` gegen den gebauten Kern — nicht von Hand
 * geändert. Der Vergleich in cli/src/replay.test.ts ist der Determinismus-Guard (FR-004, NFR-001).
 */
export const GOLDEN_REPLAY_SEED = ${REPLAY_SEED};
export const GOLDEN_REPLAY_JAHRE = ${REPLAY_JAHRE};
export const GOLDEN_REPLAY_SCHWIERIGKEIT = "${REPLAY_SCHWIERIGKEIT}";
export const GOLDEN_REPLAY_CHECKINTERVAL = ${REPLAY_CHECKINTERVAL};

/** Hash alle ${REPLAY_CHECKINTERVAL} Jahre — eine Regression lokalisiert sich über diesen Track. */
export const GOLDEN_REPLAY_CHECKPOINTS: readonly { readonly jahr: number; readonly hash: string }[] = [
${ergebnis.checkpoints.map((c) => `  { jahr: ${c.jahr}, hash: "${c.hash}" },`).join('\n')}
];

export const GOLDEN_REPLAY_FINAL_HASH = "${ergebnis.final_hash}";

/** Jahre mit gekuerzte_be > 0 (FR-041): die überallokierten Muster. */
export const GOLDEN_REPLAY_GEKUERZTE_JAHRE: readonly number[] = [${ergebnis.gekuerzte_jahre.join(', ')}];

/** Nach §3a schreibt eine Budget-Allokation kein Gedächtnis-Entry — der Wert muss 0 sein. */
export const GOLDEN_REPLAY_BESCHLUSS_ANZAHL = ${ergebnis.beschluss_anzahl};

/** Der erste verlorene Machtcheck (FR-013); der Replay läuft bewusst weiter bis ${REPLAY_JAHRE}. */
export const GOLDEN_REPLAY_NIEDERLAGE_JAHR = ${ergebnis.niederlage_jahr === null ? 'null' : ergebnis.niederlage_jahr};
`;

mkdirSync('cli/fixtures', { recursive: true });
writeFileSync('cli/fixtures/replay.golden.ts', inhalt);
console.log(
  `Golden-Replay geschrieben: ${REPLAY_JAHRE} Jahre, Seed ${REPLAY_SEED}, Final-Hash ${ergebnis.final_hash.slice(0, 12)}…, ${ergebnis.checkpoints.length} Checkpunkte, Kürzungsjahre ${ergebnis.gekuerzte_jahre.length}, Beschlüsse ${ergebnis.beschluss_anzahl}.`,
);
