/**
 * @staatslenker/cli score-spread — der Score-Spread-Report als Fixture (US-M0-18, FR-049).
 *
 * Der Report wird aus dem echten AutoSim-Harness erzeugt (4 Naiv-Strategien × 20 Seeds × 30 Jahre
 * × 3 Schwierigkeits-Packs) und als Fixture im Repo hinterlegt; jeder folgende Content-Change
 * wird im CI dagegen verglichen — eine Balance-Regression fällt als Testfehler auf, nicht als
 * stiller Zahlenwechsel. Der Report ist bewusst kompakt (eine Zeile je Kombination), damit ein
 * Diff bei einem Regel-Change lesbar bleibt.
 */
import { createHash } from 'node:crypto';

import {
  alleLäufe,
  ANZAHL_SEEDS,
  MAX_JAHRE,
  SCHWIERIGKEITEN,
  STRATEGIE_IDS,
  type SimErgebnis,
} from './autosim.js';

function median(werte: readonly number[]): number {
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 === 0
    ? (sortiert[mitte - 1]! + sortiert[mitte]!) / 2
    : sortiert[mitte]!;
}

function fmt(wert: number): string {
  return (Math.round(wert * 100) / 100).toFixed(2);
}

/** Eine Kombination aus Strategie × Schwierigkeit, aggregiert über alle Seeds. */
export interface SpreadZeile {
  readonly strategie: string;
  readonly schwierigkeit: string;
  readonly überlebt_min: number;
  readonly überlebt_median: number;
  readonly überlebt_max: number;
  /** Jahr und Grund der ersten verlorenen Wahl (`null`, wenn keine Wahl erreicht wurde). */
  readonly erste_niederlage: { readonly jahr: number; readonly grund_id: string } | null;
  readonly verlust_min: number;
  readonly verlust_max: number;
  /** Defizit/Spar-Event — nach D18 ist Unterhalt Level-Decay, kein Budget-Defizit. */
  readonly defizit_jahre: readonly number[];
  readonly spar_jahre: readonly number[];
  readonly score_median: number;
  readonly score_max: number;
  readonly finale_zufriedenheit_median: number;
}

export function spreadZeilen(läufe: readonly SimErgebnis[]): readonly SpreadZeile[] {
  const zeilen: SpreadZeile[] = [];
  for (const schwierigkeit of SCHWIERIGKEITEN) {
    for (const strategie of STRATEGIE_IDS) {
      const gruppe = läufe.filter(
        (l) => l.schwierigkeit === schwierigkeit && l.strategy === strategie,
      );
      if (gruppe.length === 0) continue;
      const survived = gruppe.map((l) => l.jahre_survived);
      const wahlen = gruppe.flatMap((l) => l.wahlen.filter((w) => !w.gewonnen));
      const defizite = gruppe
        .map((l) => l.first_deficit_year)
        .filter((d): d is number => d !== null);
      const spare = gruppe.map((l) => l.first_spar_year).filter((s): s is number => s !== null);
      const erste = wahlen.length > 0 ? wahlen[0]! : null;
      zeilen.push({
        strategie,
        schwierigkeit,
        überlebt_min: Math.min(...survived),
        überlebt_median: median(survived),
        überlebt_max: Math.max(...survived),
        erste_niederlage: erste === null ? null : { jahr: erste.jahr, grund_id: erste.grund_id },
        verlust_min: wahlen.length === 0 ? 0 : Math.min(...wahlen.map((w) => w.jahr)),
        verlust_max: wahlen.length === 0 ? 0 : Math.max(...wahlen.map((w) => w.jahr)),
        defizit_jahre: Object.freeze(defizite.sort((a, b) => a - b)),
        spar_jahre: Object.freeze(spare.sort((a, b) => a - b)),
        score_median: median(gruppe.map((l) => l.score)),
        score_max: Math.max(...gruppe.map((l) => l.score)),
        finale_zufriedenheit_median: median(gruppe.map((l) => l.final_gewichtete_zufriedenheit)),
      });
    }
  }
  return Object.freeze(zeilen);
}

/** Der Report als Text — eine Zeile je Kombination plus die Best-Strategie-Aggregierung. */
export function scoreSpreadReport(läufe: readonly SimErgebnis[] = alleLäufe(MAX_JAHRE)): string {
  const zeilen = spreadZeilen(läufe);
  const text = [
    `Score-Spread-Fixture (US-M0-18, FR-049): ${STRATEGIE_IDS.length} Strategien × ${ANZAHL_SEEDS} Seeds × ${MAX_JAHRE} Jahre × ${SCHWIERIGKEITEN.length} Schwierigkeiten`,
    'Strategie | Schw. | Überlebt min/med/max | erste Niederlage | Verlust min/max | Defizitjahre | Sparjahre | Score med/max | finale Ø',
  ];
  for (const z of zeilen) {
    text.push(
      `${z.strategie} | ${z.schwierigkeit} | ${z.überlebt_min}/${fmt(z.überlebt_median)}/${z.überlebt_max}` +
        ` | ${z.erste_niederlage === null ? 'keine' : `Jahr ${z.erste_niederlage.jahr} (${z.erste_niederlage.grund_id})`}` +
        ` | ${z.verlust_min}/${z.verlust_max}` +
        ` | ${z.defizit_jahre.length === 0 ? 'keine' : z.defizit_jahre.join(', ')}` +
        ` | ${z.spar_jahre.length === 0 ? 'keine' : z.spar_jahre.join(', ')}` +
        ` | ${fmt(z.score_median)}/${fmt(z.score_max)} | ${fmt(z.finale_zufriedenheit_median)}`,
    );
  }

  // Beste Strategie über alle Kombinationen: der höchste Median-Score, plus das Verhältnis zur
  // schwächsten Kombination — die Zahl, die Ralfs Verschleiß-Abgleich gegen die Baseline prüft.
  const beste = zeilen.reduce((a, b) => (b.score_median > a.score_median ? b : a), zeilen[0]!);
  const schwächste = zeilen.reduce((a, b) => (b.score_median < a.score_median ? b : a), zeilen[0]!);
  text.push(
    `Beste Kombination: ${beste.strategie} × ${beste.schwierigkeit} (Score-Median ${fmt(beste.score_median)});` +
      ` schwächste: ${schwächste.strategie} × ${schwächste.schwierigkeit} (${fmt(schwächste.score_median)})` +
      ` — Verhältnis schwächste/beste ${fmt(schwächste.score_median / beste.score_median)}.`,
  );
  return text.join('\n');
}

/** sha256 über dem Report — der Vergleichswert des Fixtures. */
export function scoreSpreadHash(report: string): string {
  return createHash('sha256').update(report).digest('hex');
}
