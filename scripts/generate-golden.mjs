/**
 * Generiert das Golden-Fixture für den seedbaren RNG (US-M0-03 / FR-004).
 *
 * Der Inhalt wird aus der echten Implementierung erzeugt — nicht von Hand abgeschrieben.
 * `npm run build` muss vorher laufen, weil das Fixture den gebauten Kern importiert.
 * Der Test vergleicht das committed Fixture gegen den aktuellen Kern: eine Determinismus-
 * Regression fällt dort auf, nicht erst im Balance-Harness.
 *
 * Aufruf: node scripts/generate-golden.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { erzeugeRngState, nextFloat } from '@staatslenker/core/rng';

const SEED = 1234;
const ANZAHL = 100;

let rng = erzeugeRngState(SEED);
const werte = [];
for (let i = 0; i < ANZAHL; i++) {
  const draw = nextFloat(rng);
  werte.push(draw.wert);
  rng = draw.rng;
}

const inhalt = `/**
 * Golden-Fixture: die ersten ${ANZAHL} Draws von mulberry32 mit Seed ${SEED}, counter 0..${ANZAHL - 1}.
 * Erzeugt von \`node scripts/generate-golden.mjs\` gegen den gebauten Kern — nicht von Hand geändert.
 * Der Vergleich in core/src/rng.test.ts ist der Determinismus-Guard (FR-004, NFR-001).
 */
export const GOLDEN_SEED_${SEED}: readonly number[] = [
${werte.map((wert) => `  ${wert}`).join(',\n')}
];

export const GOLDEN_SEED = ${SEED};
`;

mkdirSync('core/fixtures', { recursive: true });
writeFileSync('core/fixtures/rng.golden.ts', inhalt);
console.log(
  `Golden-Fixture geschrieben: ${werte.length} Werte, erster=${werte[0]}, letzter=${werte[werte.length - 1]}`,
);
