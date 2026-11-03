/**
 * @staatslenker/cli cli-options — Flag-Parsing und Boot-Report für den Terminal-Loop (US-M0-14).
 *
 * Separate Module, damit `index.ts` nur der Einstieg ist und das Parsing ohne Seiteneffekt testbar
 * ist. Eine unbekannte Flag oder ein nicht-endlicher Wert gibt `null` mit Grund — der Einstieg zeigt
 * den Grund und beendet mit Exit-Code 1, statt still auf Defaults zu fallen.
 */
import { stdin as input } from 'node:process';
import { readFileSync } from 'node:fs';

import { STANDARD_SETUP, tickRegelnFürMitSetup } from '@staatslenker/cli/content-pack';
import { setupState } from '@staatslenker/cli/setup-phase';
import type { SchwierigkeitId } from '@staatslenker/cli/autosim';
import { tick } from '@staatslenker/core/tick';
import { demonstration } from '@staatslenker/cli/turn';
import { interaktiverLoop, type LoopOptionen } from '@staatslenker/cli/repl';
import { packManager, type PackManagerErgebnis } from '@staatslenker/loader';

/** Die Startwerte des Boot: Seed 1234 (derselbe Seed wie das RNG-Golden-Fixture), Schwierigkeit normal. */
export const STANDARD_SEED = 1234;
export const STANDARD_JAHRE = 6;

export interface CliOptionen extends LoopOptionen {
  /** true erzwingt die nicht-interaktive Demonstration (CI-Boot). */
  readonly demo: boolean;
  /** Pack-Liste anzeigen */
  readonly packList: boolean;
  /** Pack aktivieren */
  readonly packEnable: string | undefined;
  /** Pack deaktivieren */
  readonly packDisable: string | undefined;
  /** Pack laden */
  readonly packLoad: string | undefined;
}

export type ParseErgebnis =
  | { readonly ok: true; readonly optionen: CliOptionen }
  | { readonly ok: false; readonly grund: string };

export function optionsAusArgs(args: readonly string[]): ParseErgebnis {
  const optionen: {
    seed: number;
    schwierigkeit: SchwierigkeitId;
    jahre: number;
    demo: boolean;
    packList: boolean;
    packEnable: string | undefined;
    packDisable: string | undefined;
    packLoad: string | undefined;
  } = {
    seed: STANDARD_SEED,
    schwierigkeit: 'normal',
    jahre: STANDARD_JAHRE,
    demo: false,
    packList: false,
    packEnable: undefined,
    packDisable: undefined,
    packLoad: undefined,
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
      case '--pack-list':
        optionen.packList = true;
        break;
      case '--pack-enable': {
        if (!wert) {
          return { ok: false, grund: `--pack-enable braucht einen Pack-Namen` };
        }
        optionen.packEnable = wert;
        i++;
        break;
      }
      case '--pack-disable': {
        if (!wert) {
          return { ok: false, grund: `--pack-disable braucht einen Pack-Namen` };
        }
        optionen.packDisable = wert;
        i++;
        break;
      }
      case '--pack-load': {
        if (!wert) {
          return { ok: false, grund: `--pack-load braucht eine Datei` };
        }
        optionen.packLoad = wert;
        i++;
        break;
      }
      default:
        return {
          ok: false,
          grund: `Unbekannte Flag "${flag}" — bekannt sind --seed, --schwierigkeit, --jahre, --demo, --pack-list, --pack-enable, --pack-disable, --pack-load`,
        };
    }
  }

  return { ok: true, optionen: optionen as CliOptionen };
}

/**
 * Führt Pack-Operationen aus (laden, aktivieren, deaktivieren, auflisten).
 * Gibt true zurück, wenn eine Pack-Operation ausgeführt wurde und das Programm beendet werden soll.
 */
export function packOperation(optionen: CliOptionen): { durchgefuehrt: boolean; meldung: string } {
  if (optionen.packList) {
    const packe = packManager.listePacks();
    if (packe.length === 0) {
      return { durchgefuehrt: true, meldung: 'Keine Packs geladen.' };
    }
    const zeilen = packe.map(
      (p) => `  ${p.aktiv ? '[x]' : '[ ]'} ${p.name} (${p.datei})`,
    );
    return {
      durchgefuehrt: true,
      meldung: `Geladene Packs:
${zeilen.join('\n')}`,
    };
  }

  if (optionen.packEnable) {
    const ergebnis = packManager.aktivierePack(optionen.packEnable);
    return { durchgefuehrt: true, meldung: ergebnis.meldung };
  }

  if (optionen.packDisable) {
    const ergebnis = packManager.deaktivierePack(optionen.packDisable);
    return { durchgefuehrt: true, meldung: ergebnis.meldung };
  }

  if (optionen.packLoad) {
    try {
      const yamlInhalt = readFileSync(optionen.packLoad, 'utf-8');
      const ergebnis = packManager.ladePack(yamlInhalt, optionen.packLoad);
      return { durchgefuehrt: true, meldung: ergebnis.meldung };
    } catch (e) {
      return {
        durchgefuehrt: true,
        meldung: `Pack-Laden fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  return { durchgefuehrt: false, meldung: '' };
}

/**
 * Der Boot-Report: der Kern ist geladen und der Turn-Runner ist vorhanden (US-M0-14).
 */
export function boot(optionen: CliOptionen): string {
  const kernGeladen = typeof tick === 'function';
  return (
    `Staatslenker CLI — Kern geladen: ${kernGeladen ? 'ja' : 'nein'} — Turn-Runner: ja ` +
    `(Schwierigkeit ${optionen.schwierigkeit}, Seed ${optionen.seed}, bis ${optionen.jahre} Jahre).`
  );
}

/**
 * Der Einstieg: mit TTY interaktiv spielen, ohne TTY die deterministische Demonstration.
 */
export async function main(args: readonly string[]): Promise<number> {
  const parsed = optionsAusArgs(args);
  if (!parsed.ok) {
    console.log(`CLI: ${parsed.grund}`);
    return 1;
  }

  // Pack-Operationen zuerst ausführen (bevor das Spiel startet)
  const packOp = packOperation(parsed.optionen);
  if (packOp.durchgefuehrt) {
    console.log(packOp.meldung);
    return 0;
  }

  if (parsed.optionen.demo) {
    await demonstration(
      parsed.optionen.seed,
      parsed.optionen.schwierigkeit,
      parsed.optionen.jahre,
      tickRegelnFürMitSetup(parsed.optionen.schwierigkeit),
      (seed: number) => setupState(seed, STANDARD_SETUP.regierungsform),
    );
    return 0;
  }

  await interaktiverLoop(parsed.optionen);
  return 0;
}
