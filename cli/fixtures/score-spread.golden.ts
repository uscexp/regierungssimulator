/**
 * Score-Spread-Fixture (US-M0-18): 5 Naiv-Strategien × 20 Seeds
 * × 30 Jahre × 3 Schwierigkeits-Packs, gemessen mit dem gebauten
 * Kern. Erzeugt von `node scripts/generate-score-spread.mjs` — nicht von Hand geändert. Der
 * Vergleich in cli/src/score-spread.test.ts ist die Balance-Baseline: jeder Content-Change, der die
 * gemessene Verteilung verschiebt, fällt im CI als Testfehler auf (FR-049).
 */
export const GOLDEN_SPREAD_HASH = "a3c1b0a0fbba3bb4b2c3aa957620b42b5358fe14b41e2a5e46d6fe0e83fa6760";

export const GOLDEN_SPREAD_REPORT = [
  "Score-Spread-Fixture (US-M0-18, FR-049): 5 Strategien × 20 Seeds × 30 Jahre × 3 Schwierigkeiten",
  "Strategie | Schw. | Überlebt min/med/max | erste Niederlage | Verlust min/max | Defizitjahre | Sparjahre | Score med/max | finale Ø",
  "gleichmaessig | leicht | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 84.13/84.13 | 44.03",
  "infrastruktur_zuerst | leicht | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 81.96/81.96 | 43.06",
  "bildung_zuerst | leicht | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 81.95/81.95 | 42.60",
  "overspend | leicht | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 87.36/87.36 | 45.61",
  "gesundheit_zuerst | leicht | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 82.92/82.92 | 43.27",
  "gleichmaessig | normal | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 78.41/78.41 | 41.24",
  "infrastruktur_zuerst | normal | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 76.24/76.24 | 40.27",
  "bildung_zuerst | normal | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 76.24/76.24 | 39.81",
  "overspend | normal | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 81.65/81.65 | 42.82",
  "gesundheit_zuerst | normal | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 77.20/77.20 | 40.48",
  "gleichmaessig | schwer | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 72.70/72.70 | 38.45",
  "infrastruktur_zuerst | schwer | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 70.53/70.53 | 37.48",
  "bildung_zuerst | schwer | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 70.52/70.52 | 37.02",
  "overspend | schwer | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 75.93/75.93 | 40.03",
  "gesundheit_zuerst | schwer | 6/6.00/6 | Jahr 6 (wahl:gewichtete_unter_47) | 6/6 | keine | keine | 71.49/71.49 | 37.69",
  "Beste Kombination: overspend × leicht (Score-Median 87.36); schwächste: bildung_zuerst × schwer (70.52) — Verhältnis schwächste/beste 0.81.",
];
