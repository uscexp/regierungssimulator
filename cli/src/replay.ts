/**
 * @staatslenker/cli replay — der Golden-Replay (US-M0-16, FR-004, NFR-001).
 *
 * Ein fester Seed plus eine feste Action-Folge über 100 Jahre, deterministisch durch `tick`
 * gespielt; der End-State wird kanonisch serialisiert und gehasht. Das Fixture liegt im Repo
 * (`cli/fixtures/replay.golden.ts`) und wird von `scripts/generate-replay-golden.mjs` aus dem
 * gebauten Kern erzeugt — der Test vergleicht den laufenden Replay dagegen, damit eine
 * Determinismus-Regression im CI auffällt, nicht erst im Balance-Harness.
 *
 * Der Replay ist ein State-Machine-Lauf, kein Spiel: der Machtcheck wird ignoriert und der Tick
 * läuft weiter, weil US-M0-16 100 Jahre verlangt. Das Spielende ist Sache des CLI (FR-013).
 * Die Action-Folge enthält ausschließlich Budget-Allokationen (§3a: keine Karten, keine Beschlüsse)
 * plus eine Schuldenaufnahme — damit prüft der Replay die Invariante aus §3a mit: ein Allokations-
 * Replay darf das Entscheidungsgedächtnis nie füllen.
 */
import { createHash } from 'node:crypto';

import { tick, type TickAction, type TickErgebnis } from '@staatslenker/core/tick';
import type { GameState } from '@staatslenker/core/state';

import { startState, tickRegelnFür } from './content-pack.js';
import { entscheidungen } from './turn.js';
import type { SchwierigkeitId } from './autosim.js';

export const REPLAY_SEED = 424242;
export const REPLAY_JAHRE = 100;
export const REPLAY_SCHWIERIGKEIT: SchwierigkeitId = 'normal';
/** Hash-Checkpunkt alle N Jahre — eine Regression soll sofort sagen, in welchem Jahr sie startet. */
export const REPLAY_CHECKINTERVAL = 10;

/** Eine Jahres-Action des Replays mit einem Label, das im Fixture steht. */
export interface ReplayAktionsjahr {
  readonly label: string;
  readonly action: TickAction;
}

/** Die feste Action-Folge: vier Muster im Wechsel, content-abhängig nur bei den Regel-Ids. */
export function aktionsfolge(jahre: number): readonly ReplayAktionsjahr[] {
  const regeln = tickRegelnFür(REPLAY_SCHWIERIGKEIT);
  const kategorien = regeln.indikator_regeln.filter((r) => r.budget_wirkung > 0).map((r) => r.tag);
  const ids = entscheidungen().map((e) => e.regel_id);
  if (ids.length === 0) throw new TypeError('Replay: das Pack hat keine Basis-Entscheidungen');

  const gleichmaessig = Object.fromEntries(kategorien.map((k) => [k, 2]));
  const schwerpunkt: Record<string, number> = {};
  schwerpunkt[kategorien[0]!] = 4;
  schwerpunkt[kategorien[1]!] = 4;
  const ueberallokiert = Object.fromEntries(kategorien.map((k) => [k, 20]));
  const sparsam: Record<string, number> = {};
  sparsam[kategorien[2]!] = 3;

  const aus: ReplayAktionsjahr[] = [];
  for (let jahr = 1; jahr <= jahre; jahr++) {
    const muster = (jahr - 1) % 4;
    const regel_id = ids[(jahr - 1) % ids.length]!;
    if (muster === 0) {
      aus.push({
        label: 'gleichmaessig',
        action: { zuteilung: gleichmaessig, budget_allokation: { regel_id } },
      });
    } else if (muster === 1) {
      aus.push({
        label: 'schwerpunkt',
        action: { zuteilung: schwerpunkt, budget_allokation: { regel_id } },
      });
    } else if (muster === 2) {
      // FR-041: überallokierte BE werden gekürzt — der Replay hält die Kürzungsjahre fest.
      aus.push({
        label: 'ueberallokiert',
        action: { zuteilung: ueberallokiert, budget_allokation: { regel_id } },
      });
    } else {
      aus.push({
        label: 'schulden',
        action: { zuteilung: sparsam, schulden_aufnahme: 4, budget_allokation: { regel_id } },
      });
    }
  }
  return aus;
}

/**
 * Kanonische Serialisierung: Objektschlüssel sortiert, Arrays in Reihenfolge, Zahlen als
 * `JSON.stringify`. Damit hängt der Hash nicht von der Einfüge-Reihenfolge eines Records ab.
 */
export function kanonisch(wert: unknown): string {
  if (Array.isArray(wert)) return `[${wert.map(kanonisch).join(',')}]`;
  if (wert === null || typeof wert !== 'object') return JSON.stringify(wert) ?? 'null';
  const objekt = wert as Record<string, unknown>;
  const schlüssel = Object.keys(objekt).sort();
  return `{${schlüssel.map((k) => `${JSON.stringify(k)}:${kanonisch(objekt[k])}`).join(',')}}`;
}

/** sha256 über der kanonischen Serialisierung des Snapshots (inklusive `zufriedenheits_trace`). */
export function stateHash(state: GameState): string {
  return createHash('sha256').update(kanonisch(state)).digest('hex');
}

export interface ReplayCheckpunkt {
  readonly jahr: number;
  readonly hash: string;
}

export interface ReplayErgebnis {
  readonly seed: number;
  readonly jahre: number;
  readonly schwierigkeit: SchwierigkeitId;
  readonly final_state: GameState;
  readonly final_hash: string;
  readonly checkpoints: readonly ReplayCheckpunkt[];
  /** Jahre, in denen der Tick `gekuerzte_be > 0` meldete (FR-041). */
  readonly gekuerzte_jahre: readonly number[];
  /** Länge des Entscheidungsgedächtnisses am Ende — nach §3a immer 0 für einen Allokations-Replay. */
  readonly beschluss_anzahl: number;
  /** Der verlorene Machtcheck des ersten Jahrs — gesetzt, aber für den Replay ohne Effekt. */
  readonly niederlage_jahr: number | null;
}

/** Ein Replay-Lauf: 100 Jahre `tick` mit der festen Folge, `dev`-Modus (Regression wirft laut). */
export function spieleReplay(
  seed: number = REPLAY_SEED,
  jahre: number = REPLAY_JAHRE,
  schwierigkeit: SchwierigkeitId = REPLAY_SCHWIERIGKEIT,
): ReplayErgebnis {
  const regeln = tickRegelnFür(schwierigkeit);
  const folge = aktionsfolge(jahre);

  let state = startState(seed);
  const checkpoints: ReplayCheckpunkt[] = [];
  const gekuerzte: number[] = [];
  let niederlage: number | null = null;

  for (let jahr = 1; jahr <= jahre; jahr++) {
    const ergebnis: TickErgebnis = tick(state, folge[jahr - 1]!.action, regeln, 'dev');
    if (ergebnis.gekuerzte_be > 0) gekuerzte.push(jahr);
    if (niederlage === null && ergebnis.state.wahl_niederlage !== undefined) {
      niederlage = ergebnis.state.wahl_niederlage.jahr;
    }
    state = ergebnis.state;
    if (jahr % REPLAY_CHECKINTERVAL === 0) checkpoints.push({ jahr, hash: stateHash(state) });
  }

  return {
    seed,
    jahre,
    schwierigkeit,
    final_state: state,
    final_hash: stateHash(state),
    checkpoints: Object.freeze(checkpoints),
    gekuerzte_jahre: Object.freeze(gekuerzte),
    beschluss_anzahl: state.beschlüsse.length,
    niederlage_jahr: niederlage,
  };
}
