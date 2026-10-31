/**
 * @staatslenker/cli setup-phase — die Setup-Phase im Terminal (US-M1-02, FR-047, Verdikt D22).
 *
 * Die Reihenfolge ist Adapter-Angelegenheit und ok (D22): **zuerst die Regierungsform, dann die
 * Konstitution**, erst danach ist Turn 1 spielbar. Der Gate selbst lebt im Kern als Datenregel
 * (`regeln.setup_pflicht` aus dem geladenen Register) — der Adapter setzt keinen Flag, er fragt nur.
 *
 * Der Adapter rechnet nichts: `core/setup.setupAnwenden` erzeugt den neuen Snapshot, die Karten sind
 * gerenderte Content-Daten (US-M1-04: Sofort-Effekte und Dauer-Modifikator sind sichtbar). Jede
 * ungültige Eingabe gibt einen Grund und wird erneut gefragt; `q` oder EOF beendet das Spiel, bevor
 * ein Turn läuft — ein kaputer Setup crasht nie.
 */
import {
  KONSTITUTION_WERTE,
  SETUP_FORMEN,
  SETUP_PFLICHT,
  STANDARD_SETUP,
  basisKonstitution,
} from '@staatslenker/content-base';
import type { Regierungsform } from '@staatslenker/core/rules';
import { setupAnwenden } from '@staatslenker/core/setup';
import type { GameState } from '@staatslenker/core/state';
import { startState, tickRegelnFürMitSetup } from './content-pack.js';

export type FormErgebnis =
  | { readonly ok: true; readonly form: Regierungsform }
  | { readonly ok: false; readonly grund: string };

/** Die Formen-Liste des Registers, wie der REPL sie zeigt (Nummer + Form). */
export function formsListe(): string {
  return SETUP_FORMEN.map((form, i) => `  ${i + 1}. ${form}`).join('\n');
}

/** Eine Form-Eingabe: der Name oder die 1-basierte Nummer aus dem Register. */
export function formAusText(text: string): FormErgebnis {
  const bereinigt = text.trim();
  const nummer = Number(bereinigt);
  if (Number.isInteger(nummer) && nummer >= 1 && nummer <= SETUP_FORMEN.length) {
    return { ok: true, form: SETUP_FORMEN[nummer - 1]! };
  }
  if ((SETUP_FORMEN as readonly string[]).includes(bereinigt)) {
    return { ok: true, form: bereinigt as Regierungsform };
  }
  return {
    ok: false,
    grund: `Unbekannte Regierungsform "${bereinigt}" — zur Wahl: ${SETUP_FORMEN.join(', ')} (das Register liefert die Formen, der Kern nicht)`,
  };
}

/** Die Konstitutions-Karten wie der REPL sie zeigt — label, Sofort-Effekte, Dauer-Modifikator (AC US-M1-04). */
export function konstitutionsKarten(): string {
  return basisKonstitution.entscheidungen
    .map((entscheidung) => {
      const effekte = Object.entries(entscheidung.sofort_effekte)
        .map(([tag, delta]) => `${tag} ${delta >= 0 ? '+' : ''}${delta}`)
        .join(', ');
      const modifikator = entscheidung.regelsatz_modifikator;
      const dauer = [
        modifikator.steuermodell !== undefined
          ? `steuermodell ${modifikator.steuermodell}`
          : undefined,
        modifikator.event_wahrscheinlichkeitfaktor !== undefined
          ? `event-faktor ${modifikator.event_wahrscheinlichkeitfaktor}`
          : undefined,
        modifikator.gruppen_modifikatoren !== undefined
          ? Object.entries(modifikator.gruppen_modifikatoren)
              .map(([tag, delta]) => `${tag} ${delta >= 0 ? '+' : ''}${delta}`)
              .join(', ')
          : undefined,
      ]
        .filter((teil) => teil !== undefined && teil !== '')
        .join('; ');
      return [
        `  ${entscheidung.label} (${entscheidung.regel_id}) — ${entscheidung.beschreibung}`,
        `    Sofort-Effekte: ${effekte === '' ? 'keine (die Wirkung ist im Modell gerechnet)' : effekte}`,
        `    Dauer-Modifikator: ${dauer === '' ? 'keiner' : dauer}`,
      ].join('\n');
    })
    .join('\n');
}

/** Die Konstitution-Eingabe: `bestätigen`/`y`/leer übernimmt alle Entscheidungen des Registers. */
export function konstitutionAusText(
  text: string,
): { readonly ok: true } | { readonly ok: false; readonly grund: string } {
  const bereinigt = text.trim().toLowerCase();
  if (bereinigt === '' || bereinigt === 'y' || bereinigt === 'ja' || bereinigt === 'bestätigen') {
    return { ok: true };
  }
  return {
    ok: false,
    grund: `Unbekannte Antwort "${text}" — die Konstitution des Registers wird mit Enter oder "ja" übernommen`,
  };
}

/** Der State nach dem Setup — pure Kern-Funktion, validiert gegen das Register (D22: atomisch). */
export function setupState(seed: number, form: Regierungsform): GameState {
  return setupAnwenden(
    startState(seed),
    {
      regierungsform: form,
      konstitutions_ids: STANDARD_SETUP.konstitutions_ids,
      konstitution: KONSTITUTION_WERTE,
    },
    SETUP_PFLICHT,
  );
}

/** Der Regelsatz des Spiels — inklusive der Setup-Pflicht aus dem geladenen Register (kein Adapter-Flag). */
export const spielRegelnFür = tickRegelnFürMitSetup;
