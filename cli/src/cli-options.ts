/**
 * @staatslenker/cli cli-options — Flag-Parsing und Boot-Report für den Terminal-Loop (US-M0-14).
 *
 * Separate Module, damit `index.ts` nur der Einstieg ist und das Parsing ohne Seiteneffekt testbar
 * ist. Eine unbekannte Flag oder ein nicht-endlicher Wert gibt `null` mit Grund — der Einstieg zeigt
 * den Grund und beendet mit Exit-Code 1, statt still auf Defaults zu fallen.
 */
import { stdin as input } from 'node:process';

import { STANDARD_SETUP, tickRegelnFürMitSetup } from '@staatslenker/cli/content-pack';
import { setupState } from '@staatslenker/cli/setup-phase';
import type { SchwierigkeitId } from '@staatslenker/cli/autosim';
import { tick } from '@staatslenker/core/tick';
import { demonstration } from '@staatslenker/cli/turn';
import { interaktiverLoop, type LoopOptionen } from '@staatslenker/cli/repl';

/** Die Startwerte des Boot: Seed 1234 (derselbe Seed wie das RNG-Golden-Fixture), Schwierigkeit normal. */
export const STANDARD_SEED = 1234;
export const STANDARD_JAHRE = 6;

export interface CliOptionen extends LoopOptionen {
  /** true erzwingt die nicht-interaktive Demonstration (CI-Boot). */
  readonly demo: boolean;
}

export type ParseErgebnis =
  | { readonly ok: true; readonly optionen: CliOptionen }
  | { readonly ok: false; readonly grund: string };

export function optionsAusArgs(args: readonly string[]): ParseErgebnis {
  const optionen: { seed: number; schwierigkeit: SchwierigkeitId; jahre: number; demo: boolean } = {
    seed: STANDARD_SEED,
    schwierigkeit: 'normal',
    jahre: STANDARD_JAHRE,
    demo: false,
  };

  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const wert = args[i + 1];
    switch (flag) {
      case '--seed': {
        const seed = Number(wert);
        if (!Number.isInteger(seed))
          return { ok: false, grund: `--seed braucht eine ganze Zahl, ist "${wert}"` };
        optionen.seed = seed;
        i++;
        break;
      }
      case '--schwierigkeit': {
        if (wert !== 'leicht' && wert !== 'normal' && wert !== 'schwer') {
          return {
            ok: false,
            grund: `--schwierigkeit erwartet leicht|normal|schwer, ist "${wert}"`,
          };
        }
        optionen.schwierigkeit = wert;
        i++;
        break;
      }
      case '--jahre': {
        const jahre = Number(wert);
        if (!Number.isInteger(jahre) || jahre < 1) {
          return { ok: false, grund: `--jahre braucht eine ganze Zahl >= 1, ist "${wert}"` };
        }
        optionen.jahre = jahre;
        i++;
        break;
      }
      case '--demo':
        optionen.demo = true;
        break;
      default:
        return {
          ok: false,
          grund: `Unbekannte Flag "${flag}" — bekannt sind --seed, --schwierigkeit, --jahre, --demo`,
        };
    }
  }

  return { ok: true, optionen };
}

/** Der Boot-Report: der Kern ist geladen und der Turn-Runner ist vorhanden (US-M0-14). */
export function boot(optionen: CliOptionen): string {
  const kernGeladen = typeof tick === 'function';
  return (
    `Staatslenker CLI — Kern geladen: ${kernGeladen ? 'ja' : 'nein'} — Turn-Runner: ja ` +
    `(Schwierigkeit ${optionen.schwierigkeit}, Seed ${optionen.seed}, bis ${optionen.jahre} Jahre).`
  );
}

/** Der Einstieg: mit TTY interaktiv spielen, ohne TTY die deterministische Demonstration. */
export async function main(args: readonly string[]): Promise<number> {
  const parsed = optionsAusArgs(args);
  if (!parsed.ok) {
    console.log(`CLI: ${parsed.grund}`);
    return 1;
  }

  const optionen = parsed.optionen;
  console.log(boot(optionen));

  if (!optionen.demo && input.isTTY === true) {
    await interaktiverLoop(optionen);
    return 0;
  }

  // Nicht interaktiv: ein echter Turn-Loop, deterministisch über den Seed im State (FR-004). Der
  // Standard-Setup wird vor Turn 1 angewendet (US-M1-02/D22): der Gate ist eine Kern-Datenregel aus
  // dem Register, ohne Setup würde der dev-Tick werfen — der Boot spielt ihn daher zuerst.
  const regeln = tickRegelnFürMitSetup(optionen.schwierigkeit);
  console.log(
    `Setup (Standard): Regierungsform ${STANDARD_SETUP.regierungsform}, Konstitution ${STANDARD_SETUP.konstitutions_ids.length} Entscheidungen.`,
  );
  for (const zeile of demonstration(
    optionen.seed,
    optionen.schwierigkeit,
    optionen.jahre,
    regeln,
    (seed: number) => setupState(seed, STANDARD_SETUP.regierungsform),
  )) {
    console.log(zeile);
  }
  return 0;
}
