/**
 * @staatslenker/cli repl — der Terminal-Loop (US-M0-14, FR-048).
 *
 * Der Loop ist: Lagebericht → Budget verteilen → Basis-Entscheidung wählen → tick → Lagebericht →
 * Machtcheck. Der Karten-Schritt entfällt in M0 (PO-Freigabe: Karten sind M3-Content, Konzept §10) —
 * es gibt kein Platzhalter-Feld und keine leere Meldung, der Schritt existiert nicht.
 *
 * Der REPL rechnet nichts: er parse't Eingaben, prüft sie mit `prüfeEingabe` und führt `turn` aus.
 * Jede ungültige Eingabe wird mit dem Grund gezeigt und erneut gefragt; EOF oder `q` beendet den
 * Loop. Ein verlorener Machtcheck beendet das Spiel (FR-013).
 */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import type { Regierungsform } from '@staatslenker/core/rules';
import { entscheidungen, prüfeEingabe, turn, type TurnEingabe } from './turn.js';
import { lagebericht } from './lagebericht.js';
import { SETUP_PFLICHT, tickRegelnFürMitSetup } from './content-pack.js';
import {
  konstitutionsKarten,
  konstitutionAusText,
  formsListe,
  formAusText,
  setupState,
} from './setup-phase.js';
import type { SchwierigkeitId } from './autosim.js';

/** Eine Allokation-Eingabe: `2,2,2` (Positionsliste in Kategorie-Reihenfolge) oder `bildung=4 infrastruktur=2`. */
export function zuteilungAusText(
  text: string,
  kategorien: readonly string[],
):
  | { readonly ok: true; readonly zuteilung: Readonly<Record<string, number>> }
  | { readonly ok: false; readonly grund: string } {
  const bereinigt = text.trim();
  if (bereinigt === '' || bereinigt === '0') return { ok: true, zuteilung: {} };

  if (bereinigt.includes('=')) {
    const parts = bereinigt.split(/\s+/);
    const zuteilung: Record<string, number> = {};
    for (const part of parts) {
      const [tag, wert] = part.split('=');
      if (tag === undefined || wert === undefined) {
        return { ok: false, grund: `Konforme Eingabe erwartet "tag=BE", ist "${part}"` };
      }
      const be = Number(wert);
      if (!Number.isFinite(be) || be < 0) {
        return {
          ok: false,
          grund: `Allokation auf "${tag}" ist keine endliche Zahl >= 0 ("${wert}")`,
        };
      }
      zuteilung[tag] = be;
    }
    return { ok: true, zuteilung };
  }

  const werte = bereinigt.split(/[,\s]+/).filter((w) => w !== '');
  if (werte.length > kategorien.length) {
    return {
      ok: false,
      grund: `Zu viele Werte — das Pack hat ${kategorien.length} budgetbare Kategorien (${kategorien.join(', ')})`,
    };
  }
  const zuteilung: Record<string, number> = {};
  for (const [index, wert] of werte.entries()) {
    const be = Number(wert);
    if (!Number.isFinite(be) || be < 0) {
      return { ok: false, grund: `Allokation "${wert}" ist keine endliche Zahl >= 0` };
    }
    const tag = kategorien[index];
    if (tag === undefined) return { ok: false, grund: `Keine Kategorie an Position ${index + 1}` };
    zuteilung[tag] = be;
  }
  return { ok: true, zuteilung };
}

/** Eine Entscheidungs-Eingabe: die Regel-Id oder die 1-basierte Nummer aus dem Pack. */
export function entscheidungAusText(
  text: string,
): { readonly ok: true; readonly id: string } | { readonly ok: false; readonly grund: string } {
  const bereinigt = text.trim();
  const liste = entscheidungen();
  const nummer = Number(bereinigt);
  if (Number.isInteger(nummer) && nummer >= 1 && nummer <= liste.length) {
    return { ok: true, id: liste[nummer - 1]!.regel_id };
  }
  if (liste.some((e) => e.regel_id === bereinigt)) return { ok: true, id: bereinigt };
  return {
    ok: false,
    grund: `Unbekannte Entscheidung "${bereinigt}" — zur Wahl: ${liste
      .map((e, i) => `${i + 1} = ${e.regel_id}`)
      .join(', ')}`,
  };
}

/** Die Liste der Basis-Entscheidungen, wie der REPL sie zeigt (Nummer + Label, PO D10). */
export function entscheidungsListe(): string {
  return entscheidungen()
    .map((e, i) => `  ${i + 1}. ${e.label} (${e.regel_id}) — ${e.beschreibung}`)
    .join('\n');
}

export interface LoopOptionen {
  readonly seed: number;
  readonly schwierigkeit: SchwierigkeitId;
  readonly jahre: number;
}

/** Der interaktive Loop über einem stdin/stdout-Paar. Endet bei `q`, EOF oder Spielende. */
export async function interaktiverLoop(
  optionen: LoopOptionen,
  streams: { readonly input?: NodeJS.ReadableStream; readonly output?: NodeJS.WritableStream } = {},
): Promise<void> {
  const regeln = tickRegelnFürMitSetup(optionen.schwierigkeit);
  const kategorien = regeln.indikator_regeln.filter((r) => r.budget_wirkung > 0).map((r) => r.tag);
  const rl = createInterface({ input: streams.input ?? input, output: streams.output ?? output });
  // Der Loop schreibt auf den gereichten Stream (Standard: process.stdout) — damit ist er testbar.
  const aus = streams.output ?? output;
  const log = (text: string): void => {
    aus.write(`${text}\n`);
  };
  // EOF (Ctrl-D, Pipe-Ende) ist ein definierter Fall: `null` beendet das Spiel, nicht ein Wurf.
  const frage = async (prompt: string): Promise<string | null> => {
    try {
      return await rl.question(prompt);
    } catch {
      return null;
    }
  };

  /**
   * Die Setup-Phase vor Turn 1 (US-M1-02, FR-047, Verdikt D22): zuerst die Regierungsform, dann die
   * Konstitution. Der Gate selbst ist eine Kern-Datenregel (`regeln.setup_pflicht` aus dem Register) —
   * der Adapter fragt nur und setzt keinen Flag. EOF oder `q` während des Setups beendet das Spiel,
   * bevor ein Turn läuft; eine ungültige Eingabe wird mit Grund gezeigt und erneut gefragt.
   */
  log('Setup — die Regierung wird gegründet. Turn 1 ist erst nach Form und Konstitution möglich.');
  log(`Regierungsform (Nummer oder Name) — "q" beendet das Spiel:`);
  log(formsListe());
  let formEingabe = await frage('> ');
  let form: Regierungsform | undefined;
  while (form === undefined) {
    if (formEingabe === null || formEingabe.trim() === 'q') return;
    const parsed = formAusText(formEingabe);
    if (!parsed.ok) {
      log(`Diese Eingabe ist ungültig: ${parsed.grund}`);
      formEingabe = await frage('> ');
      continue;
    }
    form = parsed.form;
  }

  log('Konstitution — die Entscheidungen des Registers (US-M1-04):');
  log(konstitutionsKarten());
  log('Konstitution übernehmen (Enter oder "ja") — "q" beendet das Spiel:');
  let konstitutionsEingabe = await frage('> ');
  let konstitutionOk = false;
  while (!konstitutionOk) {
    if (konstitutionsEingabe === null || konstitutionsEingabe.trim() === 'q') return;
    const parsed = konstitutionAusText(konstitutionsEingabe);
    if (!parsed.ok) {
      log(`Diese Eingabe ist ungültig: ${parsed.grund}`);
      konstitutionsEingabe = await frage('> ');
      continue;
    }
    konstitutionOk = true;
  }

  let state = setupState(optionen.seed, form);
  log(
    `Setup gesetzt: Regierungsform ${form}, Konstitution ${SETUP_PFLICHT.konstitutions_ids.join(', ')}.`,
  );
  try {
    for (let jahr = 1; jahr <= optionen.jahre; jahr++) {
      log(lagebericht(state, regeln));
      log(`Zuteilungen (${kategorien.join(', ')}) in BE — "q" beendet das Spiel:`);
      const allokation = await frage('> ');
      if (allokation === null || allokation.trim() === 'q') break;

      const parsed = zuteilungAusText(allokation, kategorien);
      if (!parsed.ok) {
        log(`Diese Eingabe ist ungültig: ${parsed.grund}`);
        continue;
      }

      log(entscheidungsListe());
      log('Entscheidung (Nummer oder Regel-Id):');
      const entscheidung = await frage('> ');
      if (entscheidung === null || entscheidung.trim() === 'q') break;

      const ids = entscheidungAusText(entscheidung);
      if (!ids.ok) {
        log(`Diese Eingabe ist ungültig: ${ids.grund}`);
        continue;
      }

      const eingabe: TurnEingabe = { zuteilung: parsed.zuteilung, entscheidung_id: ids.id };
      const prüfung = prüfeEingabe(state, regeln, eingabe);
      if (!prüfung.ok) {
        log(`Diese Entscheidung ist ungültig: ${prüfung.grund}`);
        continue;
      }

      const ergebnis = turn(state, regeln, eingabe);
      log(ergebnis.lagebericht_nach);
      state = ergebnis.ergebnis.state;
      if (ergebnis.spielende) break;
    }
  } finally {
    rl.close();
  }
}
