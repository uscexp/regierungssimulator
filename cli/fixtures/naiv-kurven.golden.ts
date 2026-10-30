/**
 * Naiv-Kurven-Fixture (US-M0-20): 4 Naiv-Strategien × 20 Seeds
 * × 30 Jahre-Cap auf Schwierigkeit 'normal', gemessen mit dem gebauten Kern. Erzeugt von
 * `node scripts/generate-naiv-kurven.mjs` — nicht von Hand geändert. Der Vergleich in
 * cli/src/naiv-kurven.test.ts ist die Verschleiß-Baseline für den Balance-Nachlauf: jeder
 * Content-Change, der Unterhalt-Verlauf, Defizit oder Spielende verschiebt, fällt im CI als
 * Testfehler auf (FR-049).
 */
export const GOLDEN_NAIV_HASH = '686593c3413b7d7a80b6c4e94a48bf1a099271eb1901dfdfc0996216bc009f8d';

export const GOLDEN_NAIV_REPORT = [
  "Naiv-Kurven (4 Strategien × 20 Seeds × 30 Jahre-Cap, Schwierigkeit 'normal', Median je Jahr über die Seeds):",
  ' Strategie | Jahr | Einn. | Unterh. | Ausg. | Defizit | Schulden | Ø-Zufried. | Wahl-Grund | PK',
  ' gleichmaessig        |    1 | 36.00 | 17.19 | 10.00 | 0.00 | 0.00 | 47.22 | - | 10.00',
  ' gleichmaessig        |    2 | 35.04 | 17.19 | 10.00 | 0.00 | 0.00 | 46.01 | - | 12.00',
  ' gleichmaessig        |    3 | 34.08 | 17.19 | 10.00 | 0.00 | 0.00 | 44.81 | - | 12.00',
  ' gleichmaessig        |    4 | 33.12 | 17.19 | 10.00 | 0.00 | 0.00 | 43.61 | - | 12.00',
  ' gleichmaessig        |    5 | 32.16 | 17.19 | 10.00 | 0.00 | 0.00 | 42.41 | - | 12.00',
  ' gleichmaessig        |    6 | 31.20 | 17.19 | 10.00 | 0.00 | 0.00 | 41.20 | wahl:gewichtete_unter_47 | 12.00',
  ' gleichmaessig          Überlebt Jahre: min 6 / median 6 / max 6 | erstes Defizit: kein Defizit | erstes Spar-Event: kein Spar-Event | Unterhalt Jahr 1 → Jahr 6: 17.19 → 17.19 BE (Verschleiß 0.00 BE) | Score median (§10): 78.38',
  ' infrastruktur_zuerst |    1 | 36.00 | 17.19 | 6.00 | 0.00 | 0.00 | 47.22 | - | 10.00',
  ' infrastruktur_zuerst |    2 | 35.04 | 17.19 | 6.00 | 0.00 | 0.00 | 45.80 | - | 12.00',
  ' infrastruktur_zuerst |    3 | 34.08 | 17.19 | 6.00 | 0.00 | 0.00 | 44.39 | - | 12.00',
  ' infrastruktur_zuerst |    4 | 33.12 | 17.19 | 6.00 | 0.00 | 0.00 | 42.98 | - | 12.00',
  ' infrastruktur_zuerst |    5 | 32.16 | 17.19 | 6.00 | 0.00 | 0.00 | 41.56 | - | 12.00',
  ' infrastruktur_zuerst |    6 | 31.20 | 17.19 | 6.00 | 0.00 | 0.00 | 40.15 | wahl:gewichtete_unter_47 | 12.00',
  ' infrastruktur_zuerst   Überlebt Jahre: min 6 / median 6 / max 6 | erstes Defizit: kein Defizit | erstes Spar-Event: kein Spar-Event | Unterhalt Jahr 1 → Jahr 6: 17.19 → 17.19 BE (Verschleiß 0.00 BE) | Score median (§10): 76.13',
  ' bildung_zuerst       |    1 | 36.00 | 17.19 | 6.00 | 0.00 | 0.00 | 47.22 | - | 10.00',
  ' bildung_zuerst       |    2 | 34.40 | 17.19 | 6.00 | 0.00 | 0.00 | 45.75 | - | 12.00',
  ' bildung_zuerst       |    3 | 32.80 | 17.19 | 6.00 | 0.00 | 0.00 | 44.28 | - | 12.00',
  ' bildung_zuerst       |    4 | 31.20 | 17.19 | 6.00 | 0.00 | 0.00 | 42.81 | - | 12.00',
  ' bildung_zuerst       |    5 | 29.60 | 17.19 | 6.00 | 0.00 | 0.00 | 41.34 | - | 12.00',
  ' bildung_zuerst       |    6 | 28.00 | 17.19 | 6.00 | 0.00 | 0.00 | 39.87 | wahl:gewichtete_unter_47 | 12.00',
  ' bildung_zuerst         Überlebt Jahre: min 6 / median 6 / max 6 | erstes Defizit: kein Defizit | erstes Spar-Event: kein Spar-Event | Unterhalt Jahr 1 → Jahr 6: 17.19 → 17.19 BE (Verschleiß 0.00 BE) | Score median (§10): 76.29',
  ' overspend            |    1 | 36.00 | 17.19 | 14.00 | 0.00 | 0.00 | 47.22 | - | 10.00',
  ' overspend            |    2 | 35.36 | 17.19 | 14.00 | 0.00 | 0.00 | 46.34 | - | 12.00',
  ' overspend            |    3 | 34.72 | 17.19 | 14.00 | 0.00 | 0.00 | 45.46 | - | 12.00',
  ' overspend            |    4 | 34.08 | 17.19 | 14.00 | 0.00 | 0.00 | 44.58 | - | 12.00',
  ' overspend            |    5 | 33.44 | 17.19 | 14.00 | 0.00 | 0.00 | 43.70 | - | 12.00',
  ' overspend            |    6 | 32.80 | 17.19 | 14.00 | 0.00 | 0.00 | 42.82 | wahl:gewichtete_unter_47 | 12.00',
  ' overspend              Überlebt Jahre: min 6 / median 6 / max 6 | erstes Defizit: kein Defizit | erstes Spar-Event: kein Spar-Event | Unterhalt Jahr 1 → Jahr 6: 17.19 → 17.19 BE (Verschleiß 0.00 BE) | Score median (§10): 81.64',
];
