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

/** Felder, die jede Indikator-Regel hat. */
interface IndikatorRegelBasis {
  readonly tag: string;
  /**
   * Regel-Id aus dem Content-Pack (FR-006, PO-Plan D12: bis US-M0-13 war sie vertagt). Sie ist
   * optional, damit Kern-Fixtures ohne Content-Schema weiterlaufen; mit ihr meldet der Dev-Wurf die
   * echte Id statt nur `regel.tag`.
   */
  readonly regel_id?: string;
  /** sinkt pro Jahr ohne Budget */
  readonly verschleiß: number;
  /** Zuwachs pro BE Budget in diesem Indikator */
  readonly budget_wirkung: number;
  /** Gate: unter diesem Level eines anderen Indikators stagniert dieser (kein Wachstum, kein Verschleiß) */
  readonly gate?: { readonly indikator: string; readonly min: number };
}

/**
 * Eine Indikator-Regel aus dem Content-Pack. `diminishing_at` und `diminishing_wirkung` sind ein
 * Paar — entweder beide oder keines. Ein Schwellenwert ohne abgesenkte Wirkung wäre ein
 * Balance-Fehler (das Level wächst über der Schwelle weiter), deshalb ist die Wirkung Pflichtfeld
 * und nicht optional mit `?? 0`-Fallback (FR-002, Lens-Blocker zu PR #5, PO D13). Geladener
 * Content (YAML, US-M0-13) kann trotzdem kaputt ankommen; dafür prüft der Laufzeitpfad.
 */
export type IndikatorRegel = IndikatorRegelBasis &
  (
    | {
        /** ab diesem Level wirkt nur noch `diminishing_wirkung` pro BE */
        readonly diminishing_at: number;
        readonly diminishing_wirkung: number;
      }
    | { readonly diminishing_at?: undefined; readonly diminishing_wirkung?: undefined }
  );

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
  const kennung = regel.regel_id ?? regel.tag;
  if (regel.gate !== undefined) {
    const gateLevel = levelVon(regel.gate.indikator);
    if (!(Number.isFinite(gateLevel) && gateLevel >= regel.gate.min)) {
      // Stagnation: kein Wachstum, kein Verschleiß — der Level bleibt, Events wirken trotzdem.
      return effektAnwenden(level, ereignis_delta, `gate:${kennung}`, modus);
    }
  }

  const wirkung =
    regel.diminishing_at !== undefined && level >= regel.diminishing_at
      ? diminishingWirkung(regel, modus)
      : regel.budget_wirkung;

  const budgetEffekt = wirkung * budget;
  const verschleiß = regel.verschleiß * schwierigkeit.verschleiß_multiplikator;

  return effektAnwenden(
    level,
    budgetEffekt + ereignis_delta - verschleiß,
    `indikator:${kennung}`,
    modus,
  );
}

/**
 * Die abgesenkte Budgetwirkung über `diminishing_at`. Ein Schwellenwert ohne abgesenkten Wert ist
 * ein Content-Fehler: im Dev-Modus wirft er mit Regel-Id, im Produktionsmodus wirkt darüber 0 —
 * ein Level, das über der Schwelle noch wächst, wäre ein Balance-Fehler, kein Spielerfehler (FR-002).
 */
function diminishingWirkung(regel: IndikatorRegel, modus: Modus): number {
  const wirkung = regel.diminishing_wirkung;
  if (wirkung === undefined || !Number.isFinite(wirkung)) {
    if (modus === 'dev') {
      throw new TypeError(
        `Indikator "${regel.regel_id ?? regel.tag}" hat diminishing_at ${regel.diminishing_at} ohne diminishing_wirkung`,
      );
    }
    return 0;
  }
  return wirkung;
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
 * Unterhalt = Verschleiß ÷ Budgetwirkung. Gate-geschlossene Indikatoren zählen nicht, und über
 * `diminishing_at` zählt die abgesenkte Wirkung — sonst wäre der Unterhalt zu niedrig und der
 * AutoSim-Harness (US-M0-13/US-M0-17) rechnet mit einem Spielraum, den das Spiel nicht hat.
 * balance-werte.md K1: 17.19 BE/Jahr ohne aktives Forschung, 21.19 BE mit offener Forschung ≤ 85.
 */
export function unterhaltOhneEvents(
  regeln: readonly IndikatorRegel[],
  levelVon: (tag: string) => number,
  schwierigkeit: SchwierigkeitsPack,
  modus: Modus = 'dev',
): number {
  let summe = 0;
  for (const regel of regeln) {
    if (regel.gate !== undefined) {
      const gateLevel = levelVon(regel.gate.indikator);
      if (!Number.isFinite(gateLevel) || gateLevel < regel.gate.min) continue;
    }
    const level = levelVon(regel.tag);
    const wirkung =
      regel.diminishing_at !== undefined && level >= regel.diminishing_at
        ? diminishingWirkung(regel, modus)
        : regel.budget_wirkung;
    // Eine Wirkung ≤ 0 ist nicht per Budget unterhaltbar (z. B. Recht & Freiheit: nur Gesetze).
    // Ohne diese Zeile wäre der Unterhalt Infinity — kein Zahlwert für den Harness.
    if (wirkung <= 0) continue;
    summe += (regel.verschleiß * schwierigkeit.verschleiß_multiplikator) / wirkung;
  }
  return summe;
}
