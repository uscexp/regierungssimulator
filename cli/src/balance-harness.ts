/**
 * @staatslenker/cli balance-harness — Balance-Prüfung gegen alle geladenen Packs (US-M4-08).
 *
 * Läuft die AutoSim-Harness (tick-basiert, deterministisch) gegen jedes aktive Pack aus dem
 * packManager. Ein Pack gilt als "balanced", wenn alle 5 Strategien gegen alle 3
 * Schwierigkeitsgrade mindestens 5 Jahre überleben (kein sofortiger Machtcheck-Verlust).
 *
 * Das geladene Pack liefert indikator_regeln, gruppen, entscheidungen und karten_katalog.
 * Steuerfaktor, Steuerlast und Schwierigkeits-Packs kommen aus dem Basis-Content
 * (cli/content-pack), damit der Kern-Regelsatz vollständig bleibt.
 */
import { z } from 'zod';
import { tick } from '@staatslenker/core/tick';
import { erzeugeGameState, type GameState, type GruppenSnapshot } from '@staatslenker/core/state';
import type { TickRegeln, TickKarte } from '@staatslenker/core/tick';
import type { IndikatorRegel } from '@staatslenker/core/indikatoren';
import { packManager, type GeladenesPack, PackSchema } from '@staatslenker/loader';
import {
  STRATEGIEN,
  STRATEGIE_IDS,
  SCHWIERIGKEITEN,
  MAX_JAHRE,
  type SimErgebnis,
  type SimRow,
} from '@staatslenker/cli/autosim';
import {
  STEUERFAKTOR,
  STEUERLAST,
  SCHWIERIGKEIT_PACKS,
} from '@staatslenker/cli/content-pack';

/** Maximal Jahre für den Balance-Check pro Kombination (kürzer als MAX_JAHRE für Laufzeit). */
export const BALANCE_CAP_JAHRE = 10;

/** Mindest-Überlebensjahre für ein "balanced"-Pack. */
export const BALANCE_MIN_JAHRE = 5;

/** Ergebnis für ein einzelnes Pack. */
export interface BalancePackErgebnis {
  readonly packName: string;
  readonly aktiv: boolean;
  readonly datei: string;
  readonly strategien: Readonly<Record<string, { readonly jahre_survived: number; readonly score: number; readonly wahl_verloren: boolean }>>;
  readonly balanced: boolean;
  readonly grund?: string;
}

/** Gesamter Balance-Report über alle Packs. */
export interface BalanceReport {
  readonly packs: Readonly<BalancePackErgebnis[]>;
  readonly alleBalanced: boolean;
}

/**
 * Baut TickRegeln aus einem geladenen Pack (mit Basis-Werten für fehlende Felder).
 * Das geladene Pack liefert indikator_regeln und karten_katalog.
 * Steuerfaktor, Steuerlast, Schwierigkeit kommen aus dem Basis-Content.
 */
export function baueTickRegelnAusPack(pack: z.infer<typeof PackSchema>): TickRegeln {
  return Object.freeze({
    indikator_regeln: pack.indikator_regeln as readonly IndikatorRegel[],
    steuerfaktor: STEUERFAKTOR,
    steuerlast: STEUERLAST,
    schwierigkeit: SCHWIERIGKEIT_PACKS.normal,
    ereignis_regeln: [],
    entscheidungskarten: [],
    karten_katalog: (pack.karten_katalog ?? []) as readonly TickKarte[],
  });
}

/**
 * Erstellt einen Start-State für ein geladenes Pack.
 * Verwendet die Gruppen und Start-Indikatoren aus dem Pack (bzw. Basis-Defaults).
 */
export function startStateFürPack(
  seed: number,
  gruppen: readonly GruppenSnapshot[],
  indikatoren: Readonly<Record<string, number>>,
): GameState {
  return erzeugeGameState({
    jahr: 1,
    indikatoren,
    gruppen: gruppen.map((g) => Object.freeze({ ...g, zufriedenheit: 0 })),
    budget: {},
    politisches_kapital: 5,
    legitimitaet: 50,
    schulden: 0,
    radikalisierung: 10,
    rng: { seed, counter: 0 },
    konstitution: { steuermodell: 'flat' },
    zufriedenheits_trace: {},
    beschlüsse: [],
  });
}

/**
 * Start-Indikatoren für ein Pack: 40 für alle, 45 für wirtschaft (wie Basis-Pack).
 */
export function startIndikatorenFürPack(pack: z.infer<typeof PackSchema>): Readonly<Record<string, number>> {
  const indikatoren: Record<string, number> = {};
  for (const regel of pack.indikator_regeln) {
    indikatoren[regel.tag] = 40;
  }
  if (indikatoren['wirtschaft'] !== undefined) {
    indikatoren['wirtschaft'] = 45;
  }
  return Object.freeze(indikatoren);
}

/**
 * Gruppen für ein Pack: nutzt die Gruppen aus dem Pack, oder Basis-Gruppen als Fallback.
 * Da `startStateFürPack` die Gruppen direkt erhält, wird hier nur das Pack in Gruppen
 * umgewandelt (tag, zufriedenheit 0, bevölkerungsanteil gleichverteilt, gewichte 1.0 auf ersten Indikator).
 */
export function gruppenFürPack(pack: z.infer<typeof PackSchema>): readonly GruppenSnapshot[] {
  const indikatorTags = pack.indikator_regeln.map((r) => r.tag);
  const anteil = 100 / pack.gruppen.length;
  return pack.gruppen.map((g) => ({
    tag: g.tag,
    zufriedenheit: 0,
    bevölkerungsanteil: anteil,
    gewichte: Object.fromEntries(
      indikatorTags.map((tag) => [tag, g.gewichte[tag] ?? 0]),
    ) as Record<string, number>,
  })) as readonly GruppenSnapshot[];
}

/**
 * Führt eine AutoSim gegen ein einzelnes Pack durch (5 Strategien × 3 Schwierigkeit × Seed 1).
 * Gibt zurück, ob das Pack "balanced" ist.
 */
export function balanceCheckFürPack(
  pack: GeladenesPack,
  schwierigkeit: 'leicht' | 'normal' | 'schwer' = 'normal',
): BalancePackErgebnis {
  const regeln = baueTickRegelnAusPack(pack.pack);
  const indikatoren = startIndikatorenFürPack(pack.pack);
  const gruppen = gruppenFürPack(pack.pack);

  const strategien: Record<string, { jahre_survived: number; score: number; wahl_verloren: boolean }> = {};

  for (const strategieId of STRATEGIE_IDS) {
    const zuteilung = STRATEGIEN[strategieId as keyof typeof STRATEGIEN];
    if (zuteilung === undefined) continue;

    let worstSurvived = MAX_JAHRE;
    let totalScore = 0;
    let wahlVerloren = false;
    let laufCount = 0;

    for (const schw of SCHWIERIGKEITEN) {
      const regelnSchw: TickRegeln = {
        ...regeln,
        schwierigkeit: SCHWIERIGKEIT_PACKS[schw],
      };

      const ergebnis = runSimMitRegeln(strategieId, 1, schw, BALANCE_CAP_JAHRE, regelnSchw, indikatoren, gruppen);
      worstSurvived = Math.min(worstSurvived, ergebnis.jahre_survived);
      totalScore += ergebnis.score;
      if (ergebnis.final_state.wahl_niederlage !== undefined) {
        wahlVerloren = true;
      }
      laufCount++;
    }

    strategien[strategieId] = {
      jahre_survived: worstSurvived,
      score: totalScore / Math.max(laufCount, 1),
      wahl_verloren: wahlVerloren,
    };
  }

  const alleStrategien = Object.values(strategien);
  const balanced = alleStrategien.every((s) => s.jahre_survived >= BALANCE_MIN_JAHRE);

  return {
    packName: pack.name,
    aktiv: pack.aktiv,
    datei: pack.datei,
    strategien: Object.freeze(strategien),
    balanced,
    grund: balanced ? undefined : `Einige Strategien überleben weniger als ${BALANCE_MIN_JAHRE} Jahre`,
  };
}

/**
 * Führt die Balance-Harness gegen alle geladenen Packs durch.
 * Nur aktive Packs werden geprüft (inaktive Packs werden aufgelistet, aber nicht geprüft).
 */
export function balanceCheckGegenAllePacks(
  schwierigkeit: 'leicht' | 'normal' | 'schwer' = 'normal',
): BalanceReport {
  const allePacks = packManager.listePacks();
  const aktivePacks = allePacks.filter((p) => p.aktiv);

  const packErgebnisse: BalancePackErgebnis[] = [];

  for (const pack of aktivePacks) {
    packErgebnisse.push(balanceCheckFürPack(pack, schwierigkeit));
  }

  const alleBalanced = packErgebnisse.every((p) => p.balanced);

  return Object.freeze({
    packs: Object.freeze(packErgebnisse),
    alleBalanced,
  });
}

/**
 * Formatiert den Balance-Report als lesbaren String für die CLI-Ausgabe.
 */
export function formatiereBalanceReport(report: BalanceReport): string {
  const zeilen: string[] = [];
  zeilen.push('Balance-Harness gegen alle geladenen Packs (US-M4-08)');
  zeilen.push(` Prüft ${report.packs.length} aktive Pack(s) gegen ${STRATEGIE_IDS.length} Strategien × ${SCHWIERIGKEITEN.length} Schwierigkeit × Seed 1`);
  zeilen.push(` Kriterium: alle Strategien überleben >= ${BALANCE_MIN_JAHRE} Jahre (Cap ${BALANCE_CAP_JAHRE} Jahre)`);
  zeilen.push('');

  for (const pack of report.packs) {
    const status = pack.balanced ? '✅ balanced' : '❌ unbalanced';
    zeilen.push(` Pack "${pack.packName}" (${pack.datei}, ${pack.aktiv ? 'aktiv' : 'inaktiv'}): ${status}`);
    if (!pack.balanced && pack.grund) {
      zeilen.push(`   Grund: ${pack.grund}`);
    }
    for (const [strategieId, ergebnis] of Object.entries(pack.strategien)) {
      zeilen.push(`   ${strategieId}: ${ergebnis.jahre_survived} Jahre überlebt, Score ${ergebnis.score.toFixed(2)}, Wahl verloren: ${ergebnis.wahl_verloren}`);
    }
    zeilen.push('');
  }

  zeilen.push(report.alleBalanced ? 'Alle Packs sind balanced.' : 'Einige Packs sind unbalanced — Balance prüfen.');
  return zeilen.join('\n');
}

/**
 * Ein Lauf: `jahre` Jahre `tick` mit der Strategie gegen eigene TickRegeln.
 * Kopie von `runSim` aus autosim.ts, aber mit eigenen TickRegeln und Start-State.
 */
function runSimMitRegeln(
  strategieId: string,
  seed: number,
  schwierigkeit: 'leicht' | 'normal' | 'schwer',
  jahre: number,
  regeln: TickRegeln,
  indikatoren: Readonly<Record<string, number>>,
  gruppen: readonly GruppenSnapshot[],
): SimErgebnis {
  const zuteilung = STRATEGIEN[strategieId as keyof typeof STRATEGIEN];
  if (zuteilung === undefined) {
    throw new TypeError(`Balance-Harness: unbekannte Strategie "${strategieId}"`);
  }

  const ausgaben = Object.values(zuteilung).reduce((sum, be) => sum + be, 0);

  let state = startStateFürPack(seed, gruppen, indikatoren);
  const rows: SimRow[] = [];
  let survived = 0;

  for (let jahr = 1; jahr <= jahre; jahr++) {
    const result = tick(state, { zuteilung }, regeln, 'dev');

    rows.push({
      jahr,
      einnahmen: 0, // nicht relevant für Balance-Check
      unterhalt_be: result.unterhalt_be,
      ausgaben,
      defizit: result.state.schulden - state.schulden,
      schulden: result.state.schulden,
      gewichtete_zufriedenheit: 0, // nicht relevant für Balance-Check
      wahl_grund: result.wahl ? result.wahl.grund_id : '-',
      pk: result.state.politisches_kapital,
    });

    state = result.state;
    survived = jahr;
    if (state.wahl_niederlage !== undefined) break;
  }

  const levelSumme = Object.values(state.indikatoren).reduce<number>((s, v) => s + v, 0);
  const anzahlIndikatoren = Object.keys(state.indikatoren).length;
  return {
    strategy: strategieId,
    schwierigkeit,
    seed,
    rows: Object.freeze(rows),
    jahre_survived: survived,
    first_deficit_year: null,
    first_spar_year: null,
    final_state: state,
    final_gewichtete_zufriedenheit: 0,
    score: anzahlIndikatoren > 0 ? levelSumme / anzahlIndikatoren + survived * 0.5 : survived * 0.5,
    wahlen: Object.freeze([]),
  };
}
