/**
 * Generiert das Score-Spread-Fixture für US-M0-18 (FR-049).
 *
 * Der Report kommt aus dem echten Harness (`scoreSpreadReport` über alle Läufe), nicht von Hand
 * abgeschrieben. `npm run build` muss vorher laufen. Der npm-Script normalisiert danach das
 * Format mit Prettier — ein bare `node`-Aufruf liefert Prettier-unformes Format:
 *   npm run golden:spread
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { MAX_JAHRE, ANZAHL_SEEDS, SCHWIERIGKEITEN, STRATEGIE_IDS } from '@staatslenker/cli/autosim';
import { scoreSpreadHash, scoreSpreadReport } from '@staatslenker/cli/score-spread';

const report = scoreSpreadReport();
const hash = scoreSpreadHash(report);

const inhalt = `/**
 * Score-Spread-Fixture (US-M0-18): ${STRATEGIE_IDS.length} Naiv-Strategien × ${ANZAHL_SEEDS} Seeds
 * × ${MAX_JAHRE} Jahre × ${SCHWIERIGKEITEN.length} Schwierigkeits-Packs, gemessen mit dem gebauten
 * Kern. Erzeugt von \`node scripts/generate-score-spread.mjs\` — nicht von Hand geändert. Der
 * Vergleich in cli/src/score-spread.test.ts ist die Balance-Baseline: jeder Content-Change, der die
 * gemessene Verteilung verschiebt, fällt im CI als Testfehler auf (FR-049).
 */
export const GOLDEN_SPREAD_HASH = "${hash}";

export const GOLDEN_SPREAD_REPORT = [
${report
  .split('\n')
  .map((zeile) => `  ${JSON.stringify(zeile)},`)
  .join('\n')}
];
`;

mkdirSync('cli/fixtures', { recursive: true });
writeFileSync('cli/fixtures/score-spread.golden.ts', inhalt);
console.log(
  `Score-Spread-Fixture geschrieben: ${report.split('\n').length} Zeilen, Hash ${hash.slice(0, 12)}…`,
);
