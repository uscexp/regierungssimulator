/**
 * Generiert das Naiv-Kurven-Fixture für US-M0-20 (FR-011/D18).
 *
 * Der Report kommt aus dem echten Harness (`kurvenReport` → `runSim` → `tick`), nicht von Hand
 * abgeschrieben. `npm run build` muss vorher laufen. Der npm-Script normalisiert danach das Format
 * mit Prettier — ein bare `node`-Aufruf liefert Prettier-unformes Format:
 *   npm run golden:curves
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { ANZAHL_SEEDS, MAX_JAHRE, STRATEGIE_IDS } from '@staatslenker/cli/autosim';
import { kurvenHash, kurvenReport } from '@staatslenker/cli/naiv-kurven';

const report = kurvenReport();
const hash = kurvenHash();

const inhalt = `/**
 * Naiv-Kurven-Fixture (US-M0-20): ${STRATEGIE_IDS.length} Naiv-Strategien × ${ANZAHL_SEEDS} Seeds
 * × ${MAX_JAHRE} Jahre-Cap auf Schwierigkeit 'normal', gemessen mit dem gebauten Kern. Erzeugt von
 * \`node scripts/generate-naiv-kurven.mjs\` — nicht von Hand geändert. Der Vergleich in
 * cli/src/naiv-kurven.test.ts ist die Verschleiß-Baseline für den Balance-Nachlauf: jeder
 * Content-Change, der Unterhalt-Verlauf, Defizit oder Spielende verschiebt, fällt im CI als
 * Testfehler auf (FR-049).
 */
export const GOLDEN_NAIV_HASH = "${hash}";

export const GOLDEN_NAIV_REPORT = [
${report
  .split('\n')
  .map((zeile) => `  ${JSON.stringify(zeile)},`)
  .join('\n')}
];
`;

mkdirSync('cli/fixtures', { recursive: true });
writeFileSync('cli/fixtures/naiv-kurven.golden.ts', inhalt);
console.log(
  `Naiv-Kurven-Fixture geschrieben: ${report.split('\n').length} Zeilen, Hash ${hash.slice(0, 12)}…`,
);
