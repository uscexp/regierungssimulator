/**
 * Score-Spread-Fixture (US-M0-18): 4 Naiv-Strategien × 20 Seeds
 * × 30 Jahre × 3 Schwierigkeits-Packs, gemessen mit dem gebauten
 * Kern. Erzeugt von `node scripts/generate-score-spread.mjs` — nicht von Hand geändert. Der
 * Vergleich in cli/src/score-spread.test.ts ist die Balance-Baseline: jeder Content-Change, der die
 * gemessene Verteilung verschiebt, fällt im CI als Testfehler auf (FR-049).
 */
export const GOLDEN_SPREAD_HASH =
  '1bec15cdb281696d876fe8e3370cb0993d86e41babdaa60dd08a484763ff1024';

export const GOLDEN_SPREAD_REPORT = [
  'Score-Spread-Fixture (US-M0-18, FR-049): 4 Strategien × 20 Seeds × 30 Jahre × 3 Schwierigkeiten',
  'Strategie | Schw. | Überlebt min/med/max | erste Niederlage | Verlust min/max | Defizitjahre | Sparjahre | Score med/max | finale Ø',
  'gleichmaessig | leicht | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 84.08/84.08 | 43.98',
  'infrastruktur_zuerst | leicht | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 81.82/81.82 | 42.92',
  'bildung_zuerst | leicht | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 81.99/81.99 | 42.64',
  'overspend | leicht | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 87.34/87.34 | 45.59',
  'gleichmaessig | normal | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 78.38/78.38 | 41.20',
  'infrastruktur_zuerst | normal | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 76.13/76.13 | 40.15',
  'bildung_zuerst | normal | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 76.29/76.29 | 39.87',
  'overspend | normal | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 81.64/81.64 | 42.82',
  'gleichmaessig | schwer | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 72.68/72.68 | 38.43',
  'infrastruktur_zuerst | schwer | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 70.43/70.43 | 37.38',
  'bildung_zuerst | schwer | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 70.60/70.60 | 37.10',
  'overspend | schwer | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 75.95/75.95 | 40.05',
  'Beste Kombination: overspend × leicht (Score-Median 87.34); schwächste: infrastruktur_zuerst × schwer (70.43) — Verhältnis schwächste/beste 0.81.',
];
