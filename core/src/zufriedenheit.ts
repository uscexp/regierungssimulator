/**
 * core/zufriedenheit — die Zufriedenheitsformel (FR-003, US-M0-06/US-M0-07).
 *
 * Exakt Konzept §2B / balance-werte.md §4:
 *   zufriedenheit = baseline + Σ (gewicht_i × indikator_i) − steuerlast(gruppe)
 * Baseline ohne Konstitutions-Modifikator ist 10; die Konstitution moduliert ±8 (M1).
 *
 * Die Gewicht-Matrix einer Gruppe ist Content und summiert auf 1 (K4/US-M0-13 validiert das).
 * Der Kern normalisiert hier **nicht** — eine Normalisierung wäre ein zusätzlicher Term und
 * würde einen kaputen Pack verstecken. Tags, die im State nicht existieren, zählen als 0.
 * Steuerlast ist ein direkter Abzug, kein Multiplikator (balance-werte.md §3).
 */
import { clampLevel, type Modus } from './invariant.js';
import type { GruppenSnapshot, GruppenTag, IndikatorTag, Konstitution } from './state.js';

/** Steuermodelle der Konstitution; die Last-Tabelle je Gruppe ist Content. */
export type Steuermodell = 'niedrig' | 'flat' | 'progressiv' | 'hoch';

/** Baseline ohne Konstitutions-Modifikator (balance-werte.md §4). */
export const ZUFRIEDENHEIT_BASELINE = 10;

/** Steuerlast je Gruppe und Modell — Fixture aus balance-werte.md §3 (Content, kein Kern-Wert). */
export type SteuerlastTabelle = Readonly<
  Record<GruppenTag, Readonly<Record<Steuermodell, number>>>
>;

/**
 * Zufriedenheit einer Gruppe. Rein und ohne Nebenbedingungen: keine Fraktionen, kein PK,
 * kein Bevölkerungsanteil, kein Extremismus — alles davon ist ableitbare View oder M2/M3.
 */
export function zufriedenheitBerechnen(
  gruppe: GruppenSnapshot,
  indikatoren: Readonly<Record<IndikatorTag, number>>,
  steuerlast: number,
  konstitutions_modifikator = 0,
): number {
  let gewichteteSumme = 0;
  for (const [tag, gewicht] of Object.entries(gruppe.gewichte)) {
    gewichteteSumme += gewicht * (indikatoren[tag] ?? 0);
  }
  return clampLevel(
    ZUFRIEDENHEIT_BASELINE + gewichteteSumme - steuerlast + konstitutions_modifikator,
  );
}

/** Steuerlast einer Gruppe aus der Content-Tabelle; ein fehlender Eintrag ist 0 (kein Modell = keine Last). */
export function steuerlastFuer(
  gruppe: GruppenTag,
  modell: Steuermodell,
  tabelle: SteuerlastTabelle,
): number {
  return tabelle[gruppe]?.[modell] ?? 0;
}

/** Die vier Steuermodelle — Kern-Struktur; die Lasten je Gruppe sind Content. */
const STEUERMODELLE: readonly Steuermodell[] = ['niedrig', 'flat', 'progressiv', 'hoch'];

/**
 * Steuermodell aus der Konstitution (Regel-Id `steuermodell`). Die Konstitution startet in M0 leer
 * (US-M0-02), die Setup-Phase ist M1: im Dev-Modus wird `flat` verwendet (der CLI kann das im
 * Lagebericht zeigen), in Produktion wirft es mit Regel-Id (FR-002 — ein Snapshot ohne
 * Steuermodell ist ein kaputer Save, kein normaler Zustand). Ab M1 setzt die Setup-Phase die
 * Regel immer, der Produktionszweig ist dann der normale Weg.
 */
export function steuermodellAusKonstitution(
  konstitution: Konstitution,
  modus: Modus = 'dev',
): Steuermodell {
  const wert = konstitution.steuermodell;
  if (typeof wert === 'string' && (STEUERMODELLE as readonly string[]).includes(wert)) {
    return wert as Steuermodell;
  }

  if (modus === 'produktion') {
    throw new TypeError(
      `Konstitution: Regel "steuermodell" fehlt oder ist ungültig (wert=${String(wert)})`,
    );
  }

  return 'flat';
}

/** Rechnet alle Gruppen neu — der alte Snapshot wird nicht mutiert (ADR-002). */
export function gruppenZufriedenheit(
  gruppen: readonly GruppenSnapshot[],
  indikatoren: Readonly<Record<IndikatorTag, number>>,
  modell: Steuermodell,
  tabelle: SteuerlastTabelle,
  konstitutions_modifikator = 0,
): GruppenSnapshot[] {
  return gruppen.map((gruppe) => ({
    ...gruppe,
    zufriedenheit: zufriedenheitBerechnen(
      gruppe,
      indikatoren,
      steuerlastFuer(gruppe.tag, modell, tabelle),
      konstitutions_modifikator,
    ),
  }));
}

/**
 * Gewichtete Ø-Zufriedenheit der Bevölkerung — die Wahlbedingung (US-M0-12) und der
 * Naiv-Anker des Balance-Harness. Anteile sind Prozent; geteilt wird durch die tatsächliche
 * Summe der Anteile, damit ein Mod-Pack mit Σ ≠ 100 nicht skaliert statt normalisiert wird
 * (K4-Safety-net). Bei korrektem Content (Σ = 100) ist das identisch mit einer Prozent-Wertung.
 * Die Gruppen-Gewichte werden hier **nicht** normalisiert — Σ = 1 ist eine Content-Invariante
 * des Schemas (US-M0-13/US-M4-02), kein Kern-Fallback.
 */
export function gewichteteZufriedenheit(gruppen: readonly GruppenSnapshot[]): number {
  let anteile = 0;
  let summe = 0;
  for (const gruppe of gruppen) {
    anteile += gruppe.bevölkerungsanteil;
    summe += gruppe.bevölkerungsanteil * gruppe.zufriedenheit;
  }
  if (anteile === 0) return 0;
  return summe / anteile;
}

/** Zufriedenheit der schwächsten Gruppe — zweite Bedingung des Unruhe-Gates (D12). */
export function schwachsteZufriedenheit(gruppen: readonly GruppenSnapshot[]): number {
  if (gruppen.length === 0) return 0;
  return Math.min(...gruppen.map((g) => g.zufriedenheit));
}
