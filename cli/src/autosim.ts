/**
 * @staatslenker/cli autosim — der Balance-Harness (US-M0-13, FR-011).
 *
 * Runnt den Kern-Loop `tick(state, action, regeln, 'dev')` für 4 Naiv-Strategien × 20 Seeds ×
 * 30 Jahre × 3 Schwierigkeits-Packs und druckt Jahreskurven plus Summary. Der Harness rechnet
 * keine eigene Simulation — alle Zahlen kommen aus `tick` bzw. den core-Funktionen
 * (`einnahmenBe`, `zinsenBe`, `gewichteteZufriedenheit`, `unterhaltOhneEvents`); das Pack ist
 * Content aus `./content-pack.js` (docs/balance-werte.md).
 *
 * Determinismus: der RNG liegt im State (FR-004). Der Pack enthält keine Event-Regeln
 * (balance-werte.md definiert keine konkreten Events — das ist M2-Content), also würfelt der
 * Tick nicht; die 20 Seeds unterscheiden sich im Snapshot über den RNG-Zustand, die Kurven sind
 * identisch. Ein Seed-Replay ist exakt gleich (Test), zwei Seeds liefern verschiedene Snapshots.
 *
 * Spielende ist der verlorene Machtcheck (`wahl_niederlage`, US-M0-12) — der Harness bricht dann;
 * die §6-Staatsbankrott-Regel ist im Kern noch nicht implementiert (kein Bankruptcy-Zweig im
 * Tick), deshalb ist das Wahl-Ende die einzige Überlebensgrenze.
 */
import { einnahmenBe, zinsenBe } from '@staatslenker/core/budget';
import { unterhaltOhneEvents } from '@staatslenker/core/indikatoren';
import type { GameState, IndikatorTag } from '@staatslenker/core/state';
import { tick } from '@staatslenker/core/tick';
import { gewichteteZufriedenheit } from '@staatslenker/core/zufriedenheit';
import {
  ANKER_LEVEL_FORSCHUNG_UEBER_85,
  ANKER_LEVEL_UNTER_SCHWELLE,
  INDIKATOR_REGELN,
  SCHWIERIGKEIT_PACKS,
  STEUERFAKTOR,
  startState,
  tickRegelnFür,
} from '@staatslenker/cli/content-pack';

export type SchwierigkeitId = 'leicht' | 'normal' | 'schwer';
export const SCHWIERIGKEITEN: readonly SchwierigkeitId[] = ['leicht', 'normal', 'schwer'];

/**
 * Die drei Naiv-Strategien (US-M0-13). Budgetierbar sind nur die fünf Indikatoren mit
 * `budget_wirkung > 0` (§2 — Recht/Freiheit/Sicherheit sind "nur Gesetze", eine Zuteilung dort
 * wäre verbranntes Budget, keine Strategie).
 */
export const STRATEGIEN: Readonly<
  Record<
    'gleichmaessig' | 'infrastruktur_zuerst' | 'bildung_zuerst' | 'overspend',
    Readonly<Record<IndikatorTag, number>>
  >
> = Object.freeze({
  /** §11-Anker „gleichmäßig investieren“: 2 BE je budgetbarer Kategorie. */
  gleichmaessig: Object.freeze({
    infrastruktur: 2,
    bildung: 2,
    gesundheit: 2,
    wirtschaft: 2,
    forschung: 2,
  }),
  /** 4 BE Infrastruktur + 2 BE Wirtschaft. */
  infrastruktur_zuerst: Object.freeze({ infrastruktur: 4, wirtschaft: 2 }),
  /** 4 BE Bildung + 2 BE Infrastruktur. */
  bildung_zuerst: Object.freeze({ bildung: 4, infrastruktur: 2 }),
  /** Ralfs Probe für die Deficit-Spirale (§6): 14 BE über dem Einnahmen-Satz — bei „schwer“
   * bleibt nach Unterhalt 22.35 BE nur 26 − 22.35 = 3.65 BE Spielraum, also ein Defizit von
   * 10.35 BE/Jahr. Damit wird das Spar-Event (Schulden ≥ Limit 80) in einem Naiv-Lauf erreichbar. */
  overspend: Object.freeze({
    infrastruktur: 3,
    bildung: 3,
    gesundheit: 3,
    wirtschaft: 3,
    forschung: 2,
  }),
});
export const STRATEGIE_IDS: readonly string[] = Object.keys(STRATEGIEN);

/** Das Hard-Cap der Session (balance-werte.md §10) — der Harness läuft bis 30 Jahre. */
export const MAX_JAHRE = 30;
export const ANZAHL_SEEDS = 20;

export interface SimRow {
  readonly jahr: number;
  readonly einnahmen: number;
  readonly unterhalt_be: number;
  readonly ausgaben: number;
  readonly defizit: number;
  readonly schulden: number;
  readonly gewichtete_zufriedenheit: number;
  /** Grund-Id des Machtchecks in diesem Jahr, sonst '-'. */
  readonly wahl_grund: string;
  readonly pk: number;
}

export interface WahlEintrag {
  readonly jahr: number;
  readonly gewonnen: boolean;
  readonly grund_id: string;
}

export interface SimErgebnis {
  readonly strategy: string;
  readonly schwierigkeit: SchwierigkeitId;
  readonly seed: number;
  readonly rows: readonly SimRow[];
  /** Jahre bis Spielende (wahl_niederlage) oder bis zum 30-Jahre-Cap. */
  readonly jahre_survived: number;
  readonly first_deficit_year: number | null;
  readonly first_spar_year: number | null;
  readonly final_state: GameState;
  readonly final_gewichtete_zufriedenheit: number;
  /** Score nach §10: Ø Indikatoren + gewichtete Ø Zufriedenheit + Regime-Dauer × 0.5. */
  readonly score: number;
  readonly wahlen: readonly WahlEintrag[];
}

/** Ein Lauf: `jahre` Jahre `tick` mit der Strategie, der State wird durchgereicht (ADR-002). */
export function runSim(
  strategy: string,
  seed: number,
  schwierigkeit: SchwierigkeitId,
  jahre: number = MAX_JAHRE,
): SimErgebnis {
  const zuteilung = STRATEGIEN[strategy as keyof typeof STRATEGIEN];
  if (zuteilung === undefined) {
    throw new TypeError(`AutoSim: unbekannte Strategie "${strategy}"`);
  }
  const pack = SCHWIERIGKEIT_PACKS[schwierigkeit];
  const regeln = tickRegelnFür(schwierigkeit);
  const ausgaben = Object.values(zuteilung).reduce((sum, be) => sum + be, 0);

  let state = startState(seed);
  const rows: SimRow[] = [];
  const wahlen: WahlEintrag[] = [];
  let firstDeficit: number | null = null;
  let firstSpar: number | null = null;
  let survived = 0;

  for (let jahr = 1; jahr <= jahre; jahr++) {
    // Einnahmen und Zinsen des Jahrsanfangs — dieselben core-Funktionen wie der Tick (budget.ts).
    const einnahmen = einnahmenBe(state.indikatoren.wirtschaft ?? 0, STEUERFAKTOR.flat, pack);
    const zinsen = zinsenBe(state.schulden, pack);
    void zinsen; // nur für die Defizit-Deutung sichtbar — das Defizit wird aus dem State gemessen

    const result = tick(state, { zuteilung }, regeln, 'dev');
    const defizit = result.state.schulden - state.schulden;
    const sparEvent = result.ereignisse.some((e) => e.ereignis_id === 'sparen');

    rows.push({
      jahr,
      einnahmen,
      unterhalt_be: result.unterhalt_be,
      ausgaben,
      defizit,
      schulden: result.state.schulden,
      gewichtete_zufriedenheit: gewichteteZufriedenheit(result.state.gruppen),
      wahl_grund: result.wahl ? result.wahl.grund_id : '-',
      pk: result.state.politisches_kapital,
    });
    if (result.wahl) {
      wahlen.push({ jahr, gewonnen: result.wahl.gewonnen, grund_id: result.wahl.grund_id });
    }
    if (firstDeficit === null && defizit > 0) firstDeficit = jahr;
    if (firstSpar === null && sparEvent) firstSpar = jahr;

    state = result.state;
    survived = jahr;
    if (state.wahl_niederlage !== undefined) break; // Spielende: Machtcheck verloren (US-M0-12)
  }

  const levelSumme = Object.values(state.indikatoren).reduce<number>((s, v) => s + v, 0);
  const finalGewichtete = gewichteteZufriedenheit(state.gruppen);
  return {
    strategy,
    schwierigkeit,
    seed,
    rows: Object.freeze(rows),
    jahre_survived: survived,
    first_deficit_year: firstDeficit,
    first_spar_year: firstSpar,
    final_state: state,
    final_gewichtete_zufriedenheit: finalGewichtete,
    score: levelSumme / Object.keys(state.indikatoren).length + finalGewichtete + survived * 0.5,
    wahlen: Object.freeze(wahlen),
  };
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

/** Der gemessene Anker-Block: Unterhalt/Varianten/Einnahmen über die core-Funktionen. */
export function ankerZeilen(): string[] {
  const zeilen = [
    'Balance-Anker (§2/K1/K2/K3, gemessen über core-Funktionen, Levels unter diminishing_at):',
    ' Schw. | Unterhalt ohne Forschung | Forschung offen ≤85 | Forschung >85 | Einnahmen (flat 45) | Spielraum gegen Einnahmen (ohne/offen/über85)',
  ];
  for (const id of SCHWIERIGKEITEN) {
    const pack = SCHWIERIGKEIT_PACKS[id];
    const gateZu = (tag: string) => (tag === 'wirtschaft' ? 45 : 40); // Bildung 40 → Gate zu
    const offen = (tag: string) => ANKER_LEVEL_UNTER_SCHWELLE[tag] ?? 0;
    const ueber85 = (tag: string) => ANKER_LEVEL_FORSCHUNG_UEBER_85[tag] ?? 0;
    const uOhne = unterhaltOhneEvents(INDIKATOR_REGELN, gateZu, pack);
    const uOffen = unterhaltOhneEvents(INDIKATOR_REGELN, offen, pack);
    const uUeber = unterhaltOhneEvents(INDIKATOR_REGELN, ueber85, pack);
    const einnahmen = einnahmenBe(45, STEUERFAKTOR.flat, pack);
    zeilen.push(
      ` ${id.padEnd(6)} | ${fmt(uOhne)} BE | ${fmt(uOffen)} BE | ${fmt(uUeber)} BE | ${fmt(einnahmen)} BE` +
        ` | ${fmt(einnahmen - uOhne)} / ${fmt(einnahmen - uOffen)} / ${fmt(einnahmen - uUeber)} BE`,
    );
  }
  return zeilen;
}

/** Kurve eines Laufs (Seed 1 pro Kombination) — kompakt, endet mit Spielende oder Cap. */
export function kurveZeilen(lauf: SimErgebnis): string[] {
  const zeilen = [
    `Kurve ${lauf.strategy} × ${lauf.schwierigkeit} × Seed ${lauf.seed}:`,
    ' Jahr | Einn. | Unterh. | Ausg. | Defizit | Schulden | Ø-Zufried. | Wahl-Grund | PK',
  ];
  for (const r of lauf.rows) {
    zeilen.push(
      `  ${String(r.jahr).padStart(4)} | ${fmt(r.einnahmen)} | ${fmt(r.unterhalt_be)} | ${fmt(r.ausgaben)}` +
        ` | ${fmt(r.defizit)} | ${fmt(r.schulden)} | ${fmt(r.gewichtete_zufriedenheit)} | ${r.wahl_grund} | ${fmt(r.pk)}`,
    );
  }
  return zeilen;
}

/** Summary einer Kombination über alle Seeds (min/median/max Überleben, Defizit, Spar, Wahlen). */
export function summaryZeilen(läufe: readonly SimErgebnis[]): string[] {
  const erste = läufe[0]!;
  const survived = läufe.map((l) => l.jahre_survived);
  const defizite = läufe.map((l) => l.first_deficit_year);
  const spare = läufe.map((l) => l.first_spar_year);
  const schulden = läufe.map((l) => l.final_state.schulden);
  const wahlText = erste.wahlen
    .map((w) => `Jahr ${w.jahr}: ${w.gewonnen ? 'gewonnen' : `verloren (${w.grund_id})`}`)
    .join(', ');
  return [
    `Summary ${erste.strategy} × ${erste.schwierigkeit} (${läufe.length} Seeds):`,
    ` Überlebt Jahre: min ${Math.min(...survived)} / median ${fmt(median(survived), 0)} / max ${Math.max(...survived)}`,
    ` Erstes Defizit: ${defizite.every((d) => d === null) ? 'kein Defizit' : `min Jahr ${Math.min(...(defizite.filter((d) => d !== null) as number[]))}`}`,
    ` Erstes Spar-Event: ${spare.every((s) => s === null) ? 'kein Spar-Event' : `min Jahr ${Math.min(...(spare.filter((s) => s !== null) as number[]))}`}`,
    ` Finale Schulden (median): ${fmt(median(schulden))} BE`,
    ` Finale Ø-Zufriedenheit (median): ${fmt(median(läufe.map((l) => l.final_gewichtete_zufriedenheit)))}`,
    ` Score (median, §10): ${fmt(median(läufe.map((l) => l.score)))}`,
    ` Wahl-Ergebnisse je Wahljahr: ${wahlText === '' ? 'keine Wahl erreicht' : wahlText}`,
  ];
}

/** Alle 3×3×20 Läufe — für Tests und Main. */
export function alleLäufe(jahre: number = MAX_JAHRE): SimErgebnis[] {
  const laufe: SimErgebnis[] = [];
  for (const schwierigkeit of SCHWIERIGKEITEN) {
    for (const strategie of STRATEGIE_IDS) {
      for (let seed = 1; seed <= ANZAHL_SEEDS; seed++) {
        laufe.push(runSim(strategie, seed, schwierigkeit, jahre));
      }
    }
  }
  return laufe;
}

function main(): void {
  console.log(
    'AutoSim US-M0-13 — 4 Naiv-Strategien × 20 Seeds × 30 Jahre × 3 Schwierigkeits-Packs',
  );
  console.log(...ankerZeilen());
  for (const schwierigkeit of SCHWIERIGKEITEN) {
    for (const strategie of STRATEGIE_IDS) {
      const laufe = Array.from({ length: ANZAHL_SEEDS }, (_, i) =>
        runSim(strategie, i + 1, schwierigkeit),
      );
      console.log(...kurveZeilen(laufe[0]!));
      console.log(...summaryZeilen(laufe));
    }
  }
}

// Nur als Konsolen-Aufruf drucken — als Import (Tests) bleibt das Modul rein.
const argv1 = process.argv[1]?.replace(/\\/g, '/');
if (
  argv1 !== undefined &&
  (argv1.endsWith('cli/src/autosim.ts') || argv1.endsWith('cli/dist/autosim.js'))
) {
  main();
}
