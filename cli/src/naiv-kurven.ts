/**
 * @staatslenker/cli naiv-kurven — die Naiv-Kurven-Baseline für den Verschleiß-Abgleich (US-M0-20,
 * FR-011/D18).
 *
 * Der Harness aus `./autosim.js` läuft 4 Naiv-Strategien × 20 Seeds × 30 Jahre. Dieses Modul
 * aggregiert daraus je Jahr den Median über die Seeds und druckt die vier Kurven plus Summary —
 * dieselben Zahlen, die der Kern-Loop produziert (`tick`, `einnahmenBe`, `gewichteteZufriedenheit`).
 * Es erfindet keine eigene Simulation und greift nicht in den Kern: der Unterhalt-Verlauf ist der
 * Level-Decay aus D18, nicht eine hier definierte Verschleiß-Formel.
 *
 * Horizont: 30 Jahre ist das Session-Hard-Cap (§10) und der D18-Kurvenhorizont. Die Kurven enden
 * mit dem Spielende (verlorener Machtcheck, US-M0-12) — mit dem Basis-Pack fällt jede Naiv-Strategie
 * Jahr 6 (`wahl:gewichtete_unter_47`), deshalb ist die Kurve kurz und der Langzeit-Horizont (12–25
 * Jahre) ist M1/M2-Content. Diese Baseline ist der Messwert, den Ralf für den Verschleiß-Abgleich
 * braucht; sie wird nicht nachträglich angepasst.
 */
import { createHash } from 'node:crypto';
import {
  ANZAHL_SEEDS,
  MAX_JAHRE,
  STRATEGIE_IDS,
  runSim,
  type SimErgebnis,
  type SchwierigkeitId,
} from './autosim.js';

export interface KurvePunkt {
  readonly jahr: number;
  readonly einnahmen: number;
  readonly unterhalt_be: number;
  readonly ausgaben: number;
  readonly defizit: number;
  readonly schulden: number;
  readonly zufriedenheit: number;
  readonly pk: number;
  /** Grund-Id des Machtchecks in diesem Jahr, sonst '-'. */
  readonly wahl_grund: string;
}

export interface NaivKurve {
  readonly strategie: string;
  readonly schwierigkeit: SchwierigkeitId;
  readonly seeds: number;
  readonly punkte: readonly KurvePunkt[];
  /** Jahre bis Spielende über die Seeds (min/median/max). */
  readonly überlebt: { readonly min: number; readonly median: number; readonly max: number };
  readonly erstes_defizit: number | null;
  readonly erstes_spar_event: number | null;
  readonly score_median: number;
  /** Unterhalt im ersten und letzten Jahr der Kurve — der Verschleiß-Verlauf für den Abgleich. */
  readonly unterhalt_start: number;
  readonly unterhalt_ende: number;
}

function median(werte: readonly number[]): number {
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 === 0
    ? (sortiert[mitte - 1]! + sortiert[mitte]!) / 2
    : sortiert[mitte]!;
}

function fmt(n: number, stellen = 2): string {
  return n.toFixed(stellen);
}

/** Median je Jahr über die Seeds eines Strategie/Schwierigkeits-Blocks, bis zum frühesten Spielende. */
export function naiveKurve(
  strategie: string,
  schwierigkeit: SchwierigkeitId = 'normal',
  seeds: number = ANZAHL_SEEDS,
  jahre: number = MAX_JAHRE,
): NaivKurve {
  const läufe: SimErgebnis[] = Array.from({ length: seeds }, (_, i) =>
    runSim(strategie, i + 1, schwierigkeit, jahre),
  );
  const überlebt = läufe.map((l) => l.jahre_survived);
  const letzte = Math.min(...überlebt);
  const punkte: KurvePunkt[] = [];
  for (let jahr = 1; jahr <= letzte; jahr++) {
    const rows = läufe.map((l) => l.rows[jahr - 1]).filter((r) => r !== undefined);
    if (rows.length === 0) break;
    punkte.push({
      jahr,
      einnahmen: median(rows.map((r) => r!.einnahmen)),
      unterhalt_be: median(rows.map((r) => r!.unterhalt_be)),
      ausgaben: median(rows.map((r) => r!.ausgaben)),
      defizit: median(rows.map((r) => r!.defizit)),
      schulden: median(rows.map((r) => r!.schulden)),
      zufriedenheit: median(rows.map((r) => r!.gewichtete_zufriedenheit)),
      pk: median(rows.map((r) => r!.pk)),
      wahl_grund: rows[0]!.wahl_grund,
    });
  }
  const defizite = läufe.map((l) => l.first_deficit_year).filter((d) => d !== null) as number[];
  const spare = läufe.map((l) => l.first_spar_year).filter((s) => s !== null) as number[];
  const erste = läufe[0]!;
  return {
    strategie,
    schwierigkeit,
    seeds,
    punkte: Object.freeze(punkte),
    überlebt: {
      min: Math.min(...überlebt),
      median: median(überlebt),
      max: Math.max(...überlebt),
    },
    erstes_defizit: defizite.length === 0 ? null : Math.min(...defizite),
    erstes_spar_event: spare.length === 0 ? null : Math.min(...spare),
    score_median: median(läufe.map((l) => l.score)),
    unterhalt_start: erste.rows[0]?.unterhalt_be ?? 0,
    unterhalt_ende: erste.rows[erste.rows.length - 1]?.unterhalt_be ?? 0,
  };
}

/** Alle vier Naiv-Kurven auf einer Schwierigkeit — die Baseline für den Abgleich. */
export function alleKurven(
  schwierigkeit: SchwierigkeitId = 'normal',
  seeds: number = ANZAHL_SEEDS,
  jahre: number = MAX_JAHRE,
): readonly NaivKurve[] {
  return STRATEGIE_IDS.map((s) => naiveKurve(s, schwierigkeit, seeds, jahre));
}

/** Der gemessene Report — deterministic, kein Post Processing aus Docs-Zahlen. */
export function kurvenReport(
  schwierigkeit: SchwierigkeitId = 'normal',
  seeds: number = ANZAHL_SEEDS,
  jahre: number = MAX_JAHRE,
): string {
  const zeilen = [
    `Naiv-Kurven (${STRATEGIE_IDS.length} Strategien × ${seeds} Seeds × ${jahre} Jahre-Cap,` +
      ` Schwierigkeit '${schwierigkeit}', Median je Jahr über die Seeds):`,
    ' Strategie | Jahr | Einn. | Unterh. | Ausg. | Defizit | Schulden | Ø-Zufried. | Wahl-Grund | PK',
  ];
  for (const k of alleKurven(schwierigkeit, seeds, jahre)) {
    for (const p of k.punkte) {
      zeilen.push(
        ` ${k.strategie.padEnd(20)} | ${String(p.jahr).padStart(4)} | ${fmt(p.einnahmen)}` +
          ` | ${fmt(p.unterhalt_be)} | ${fmt(p.ausgaben)} | ${fmt(p.defizit)} | ${fmt(p.schulden)}` +
          ` | ${fmt(p.zufriedenheit)} | ${p.wahl_grund} | ${fmt(p.pk)}`,
      );
    }
    zeilen.push(
      ` ${k.strategie.padEnd(20)}   Überlebt Jahre: min ${k.überlebt.min}` +
        ` / median ${fmt(k.überlebt.median, 0)} / max ${k.überlebt.max}` +
        ` | erstes Defizit: ${k.erstes_defizit === null ? 'kein Defizit' : `Jahr ${k.erstes_defizit}`}` +
        ` | erstes Spar-Event: ${k.erstes_spar_event === null ? 'kein Spar-Event' : `Jahr ${k.erstes_spar_event}`}` +
        ` | Unterhalt Jahr 1 → Jahr ${k.punkte.length}: ${fmt(k.unterhalt_start)} → ${fmt(k.unterhalt_ende)} BE` +
        ` (Verschleiß ${fmt(k.unterhalt_start - k.unterhalt_ende)} BE)` +
        ` | Score median (§10): ${fmt(k.score_median)}`,
    );
  }
  return zeilen.join('\n');
}

/** Hash des Reports — derselbe Mechanismus wie die anderen Golden-Fixtures (SHA-256, 12 Hex). */
export function kurvenHash(
  schwierigkeit: SchwierigkeitId = 'normal',
  seeds: number = ANZAHL_SEEDS,
  jahre: number = MAX_JAHRE,
): string {
  return createHash('sha256')
    .update(kurvenReport(schwierigkeit, seeds, jahre))
    .digest('hex');
}
