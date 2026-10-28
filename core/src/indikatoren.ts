/**
 * core/indikatoren — Indikatorbewegung pro Jahr (FR-005/FR-006, US-M0-05).
 *
 * Exakt aus Konzept §2A: `level += budget_wirkung + ereignis_delta − verschleiss`.
 * Die Werte (Verschleiß, budget_wirkung, diminishing_at, Gates) sind **Content** aus
 * `balance-werte.md` §2, keine Kern-Konstanten — der Kern kennt nur die Struktur.
 *
 * Nichtstun wird bestraft: ohne Budget sinkt der Indikator um den Verschleiß.
 * `diminishing_at` hält das Balancing beherrschbar (Konzept §11).
 */
import { clampLevel, effektAnwenden, type Modus } from './invariant.js';

export type Steuermodell = 'niedrig' | 'flat' | 'progressiv' | 'hoch';

/** Schwierigkeit ist ein Parameter-Pack (Konzept §12 G6), kein eigener Mechanismus. */
export interface SchwierigkeitsPack {
  readonly verschleiß_multiplikator: number;
  readonly pk_regeneration: number;
  readonly event_wahrscheinlichkeit: number;
  readonly schuldenlimit: number;
  readonly zinsfaktor: number;
  readonly budget_zuschuss: number;
}

/** Das Parameter-Pack "normal" aus balance-werte.md — Test-Fixture, nicht die Kern-Wahl. */
export const SCHWIERIGKEIT_NORMAL: SchwierigkeitsPack = Object.freeze({
  verschleiß_multiplikator: 1.0,
  pk_regeneration: 1.0,
  event_wahrscheinlichkeit: 1.0,
  schuldenlimit: 100,
  zinsfaktor: 0.08,
  budget_zuschuss: 0,
});

/** Eine Indikator-Regel aus dem Content-Pack. */
export interface IndikatorRegel {
  readonly tag: string;
  /** sinkt pro Jahr ohne Budget */
  readonly verschleiß: number;
  /** Zuwachs pro BE Budget in diesem Indikator */
  readonly budget_wirkung: number;
  /** ab diesem Level wirkt nur noch `diminishing_wirkung` pro BE */
  readonly diminishing_at?: number;
  readonly diminishing_wirkung?: number;
  /** Gate: unter diesem Level eines anderen Indikators stagniert dieser (kein Wachstum, kein Verschleiß) */
  readonly gate?: { readonly indikator: string; readonly min: number };
}

/**
 * Ein Jahr Bewegung eines Indikators. Gates brauchen Zugriff auf alle Level (K3: Forschung
 * stagniert bei Bildung < 50 — weder Wachstum noch Verschleiß). Event-Deltas wirken trotz Gate,
 * denn Krisen sind external. Nicht-endliche Ergebnisse werden nach Regel-ID gemeldet (FR-002).
 */
export function indikatorSchritt(
  regel: IndikatorRegel,
  level: number,
  budget: number,
  ereignis_delta: number,
  schwierigkeit: SchwierigkeitsPack,
  levelVon: (tag: string) => number,
  modus: Modus = 'dev',
): number {
  if (regel.gate !== undefined) {
    const gateLevel = levelVon(regel.gate.indikator);
    if (!(Number.isFinite(gateLevel) && gateLevel >= regel.gate.min)) {
      // Stagnation: kein Wachstum, kein Verschleiß — der Level bleibt, Events wirken trotzdem.
      return effektAnwenden(level, ereignis_delta, `gate:${regel.tag}`, modus);
    }
  }

  const wirkung =
    regel.diminishing_at !== undefined && level >= regel.diminishing_at
      ? (regel.diminishing_wirkung ?? 0)
      : regel.budget_wirkung;

  const budgetEffekt = wirkung * budget;
  const verschleiß = regel.verschleiß * schwierigkeit.verschleiß_multiplikator;

  return effektAnwenden(
    level,
    budgetEffekt + ereignis_delta - verschleiß,
    `indikator:${regel.tag}`,
    modus,
  );
}

/** Bewegt alle Indikatoren eines Jahres in einem neuen, eingefrorenen Record. */
export function indikatorenSchritt(
  regeln: readonly IndikatorRegel[],
  indikatoren: Readonly<Record<string, number>>,
  budget: Readonly<Record<string, number>>,
  ereignis_deltas: Readonly<Record<string, number>>,
  schwierigkeit: SchwierigkeitsPack,
  modus: Modus = 'dev',
): Record<string, number> {
  const neu: Record<string, number> = { ...indikatoren };
  for (const regel of regeln) {
    const level = neu[regel.tag] ?? 0;
    const wert = indikatorSchritt(
      regel,
      level,
      budget[regel.tag] ?? 0,
      ereignis_deltas[regel.tag] ?? 0,
      schwierigkeit,
      (tag) => neu[tag] ?? 0,
      modus,
    );
    neu[regel.tag] = clampLevel(wert);
  }
  return neu;
}

/**
 * Unterhalt = Verschleiß ÷ budget_wirkung; Gate-geschlossene Indikatoren zählen nicht
 * (balance-werte.md K1: 17.19 BE/Jahr bei offener Forschung, 12.19 BE bei Gate-closed Forschung).
 */
export function unterhaltOhneEvents(
  regeln: readonly IndikatorRegel[],
  levelVon: (tag: string) => number,
  schwierigkeit: SchwierigkeitsPack,
): number {
  let summe = 0;
  for (const regel of regeln) {
    if (regel.gate !== undefined) {
      const gateLevel = levelVon(regel.gate.indikator);
      if (!Number.isFinite(gateLevel) || gateLevel < regel.gate.min) continue;
    }
    summe += (regel.verschleiß * schwierigkeit.verschleiß_multiplikator) / regel.budget_wirkung;
  }
  return summe;
}
