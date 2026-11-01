/** @staatslenker/core/eval — typisierte Prädikate für Bedingungs-Auswertung (US-M2-01, FR-027, ADR-004).
 *
 * Bedingungen sind **typisierte Daten**, keine String-Expressions und kein Interpreter.
 * Ein Modd-Pack darf keine arbitrary Bedingungen einschleusen — jeder Prädikat-Typ ist
 * ein geschlossenes Zod-Schema mit festen Operatoren und Werten.
 *
 * Prädikat-Typen:
 *  - `indikator_von`: Indikator-Tag gegen einen Wert prüfen (Operator >=, <=, >, <, ==)
 *  - `gruppe_zufriedenheit`: Zufriedenheit einer Gruppe gegen einen Wert prüfen
 *  - `schulden_von`: Schulden gegen einen Wert prüfen
 *  - `oder`: Liste von Prädikaten, mindestens eines muss wahr sein (OR als Liste)
 *
 * Alle Funktionen sind rein: State wird nie mutiert, keine Nebenwirkungen.
 */

import { z } from 'zod';
import type { GameState, GruppenTag } from './state.js';
import {
  steuerlastFuer,
  type Steuermodell,
  type SteuerlastTabelle,
  zufriedenheitBerechnen,
} from './zufriedenheit.js';
import { LEVEL_MIN, LEVEL_MAX } from './invariant.js';

/** Vergleichs-Operatoren — geschlossenes Vokabular, keine freien Operatoren. */
export const VERGLEICH_OP = z.enum(['>=', '<=', '>', '<', '==']);
export type VergleichOp = z.infer<typeof VERGLEICH_OP>;

/** Ein Wert, der gegen einen Level verglichen wird (0–100 für Indikatoren und Zufriedenheit). */
const LEVEL_WERT = z.number().finite().min(LEVEL_MIN).max(LEVEL_MAX);

/** Ein Schulden-Wert (BE, >= 0). */
const SCHULDEN_WERT = z.number().finite().min(0);

/**
 * Prädikat: Indikator-Vergleich.
 * Prüft, ob ein Indikator gegen einen Wert vergleichbar ist.
 * Fehlende Indikatoren zählen als 0 (wie in core/zufriedenheit).
 */
export const indikatorVonSchema = z
  .object({
    typ: z.literal('indikator_von'),
    regel_id: z.string().min(1),
    tag: z
      .string()
      .min(1)
      .regex(/^[a-z][a-z0-9_]*$/),
    op: VERGLEICH_OP,
    wert: LEVEL_WERT,
  })
  .strict();
export type IndikatorVonPraedikat = z.infer<typeof indikatorVonSchema>;

/**
 * Prädikat: Gruppen-Zufriedenheit.
 * Prüft, ob die Zufriedenheit einer Gruppe gegen einen Wert vergleichbar ist.
 * Die Zufriedenheit wird mit derselben Formel wie im Tick berechnet (core/zufriedenheit).
 */
export const gruppeZufriedenheitSchema = z
  .object({
    typ: z.literal('gruppe_zufriedenheit'),
    regel_id: z.string().min(1),
    tag: z
      .string()
      .min(1)
      .regex(/^[a-z][a-z0-9_]*$/),
    op: VERGLEICH_OP,
    wert: LEVEL_WERT,
  })
  .strict();
export type GruppeZufriedenheitPraedikat = z.infer<typeof gruppeZufriedenheitSchema>;

/**
 * Prädikat: Schulden-Vergleich.
 * Prüft, ob die Schulden des Staates gegen einen Wert vergleichbar sind.
 */
export const schuldenVonSchema = z
  .object({
    typ: z.literal('schulden_von'),
    regel_id: z.string().min(1),
    op: VERGLEICH_OP,
    wert: SCHULDEN_WERT,
  })
  .strict();
export type SchuldenVonPraedikat = z.infer<typeof schuldenVonSchema>;

/** Prädikat: OR-Liste — mindestens eines der verschachtelten Prädikate muss wahr sein. */
export interface OderPraedikat {
  readonly typ: 'oder';
  readonly regel_id: string;
  readonly praedikate: Praedikat[];
}

/** Der geschlossene Union-Typ aller Prädikat-Typen (rekursiv über OderPraedikat). */
export type Praedikat =
  IndikatorVonPraedikat | GruppeZufriedenheitPraedikat | SchuldenVonPraedikat | OderPraedikat;

/**
 * Prädikat: OR-Liste (Zod-Schema mit rekursivem Verweis auf praedikatSchema).
 * Eine leere Liste ist niemals wahr.
 */
export const oderSchema = z
  .object({
    typ: z.literal('oder'),
    regel_id: z.string().min(1),
    praedikate: z.array(z.lazy(() => praedikatSchema)).min(1),
  })
  .strict();

/** Die geschlossene Union aller Prädikat-Typen. */
export const praedikatSchema = z.discriminatedUnion('typ', [
  indikatorVonSchema,
  gruppeZufriedenheitSchema,
  schuldenVonSchema,
  oderSchema,
]) as z.ZodType<Praedikat>;

/** Eine einzelne Bedingung ist entweder ein einzelnes Prädikat oder eine OR-Liste. */
export const bedingungSchema = praedikatSchema;
export type Bedingung = Praedikat;

/** Der Zufriedenheits-Modifikator einer Konstitution für die Gruppen-Zufriedenheit. */
interface ZufriedenheitsKontext {
  readonly modell: Steuermodell;
  readonly tabelle: SteuerlastTabelle;
  readonly konstitutions_modifikator: number;
  readonly konstitutions_offset?: Readonly<Record<GruppenTag, number>>;
}

/**
 * Prüft ein einzelnes Prädikat gegen einen Spielzustand.
 * Rein: State wird nie mutiert, keine Nebenwirkungen, deterministisch bei gleichem Input.
 *
 * @param praedikat — das zu prüfende Prädikat (typisiert, keine String-Expression)
 * @param state — der aktuelle GameState
 * @param ctx — optionaler Kontext für die Zufriedenheitsberechnung (Modell, Tabelle, Modifikator)
 * @returns true, wenn die Bedingung erfüllt ist; false sonst
 * @throws TypeError bei kaputter Prädikat-Struktur (kaputter Save/Content)
 */
export function evalPrädikat(
  praedikat: Praedikat,
  state: GameState,
  ctx?: ZufriedenheitsKontext,
): boolean {
  switch (praedikat.typ) {
    case 'indikator_von': {
      const indikatorWert = state.indikatoren[praedikat.tag] ?? 0;
      return vergleiche(indikatorWert, praedikat.op, praedikat.wert);
    }
    case 'gruppe_zufriedenheit': {
      const gruppe = state.gruppen.find((g) => g.tag === praedikat.tag);
      if (gruppe === undefined) return false;
      const modell = ctx?.modell ?? 'flat';
      const tabelle = ctx?.tabelle ?? {};
      const modifikator = ctx?.konstitutions_modifikator ?? 0;
      const offset = ctx?.konstitutions_offset;
      const zufriedenheit = zufriedenheitBerechnen(
        gruppe,
        state.indikatoren,
        steuerlastFuer(gruppe.tag, modell, tabelle),
        modifikator + (offset?.[gruppe.tag] ?? 0),
      );
      return vergleiche(zufriedenheit, praedikat.op, praedikat.wert);
    }
    case 'schulden_von': {
      return vergleiche(state.schulden, praedikat.op, praedikat.wert);
    }
    case 'oder': {
      return praedikat.praedikate.some((p) => evalPrädikat(p, state, ctx));
    }
    default: {
      // Der Discriminator ist geschlossen — dieser Zweig ist kaputte Struktur (z. B. ein
      // ungevalidierter Save), kein Spielzustand und kein Weiterspielen in Produktion:
      // eine Mechanik, die der Kern nicht kennt, kann nicht ausgewertet werden (ADR-003).
      const kaput = praedikat as unknown as { typ?: unknown; regel_id?: unknown };
      throw new TypeError(
        `Prädikat: unbekannter Variant-Typ "${String(kaput.typ)}" (regel_id=${String(
          kaput.regel_id,
        )})`,
      );
    }
  }
}

/** Vergleicht einen Wert gegen einen Operator und einen Vergleichswert. */
function vergleiche(wert: number, op: VergleichOp, gegen: number): boolean {
  switch (op) {
    case '>=':
      return wert >= gegen;
    case '<=':
      return wert <= gegen;
    case '>':
      return wert > gegen;
    case '<':
      return wert < gegen;
    case '==':
      return wert === gegen;
    default: {
      const kaput = op as unknown;
      throw new TypeError(`Vergleich: unbekannter Operator "${String(kaput)}"`);
    }
  }
}

/**
 * Prüft eine Bedingung (einzelnes Prädikat oder OR-Liste) gegen einen Spielzustand.
 * Bequemer Aufruf für Code, der nur eine Bedingung hat (z. B. Karten-Constraints FR-032).
 */
export function evalBedingung(
  bedingung: Bedingung,
  state: GameState,
  ctx?: ZufriedenheitsKontext,
): boolean {
  return evalPrädikat(bedingung, state, ctx);
}

/**
 * Prüft, ob alle Bedingungen einer Liste erfüllt sind (UND-Semantik über die Liste).
 * Eine leere Liste ist immer wahr (keine Constraint).
 */
export function alleBedingungenErfullt(
  bedingungen: readonly Bedingung[],
  state: GameState,
  ctx?: ZufriedenheitsKontext,
): boolean {
  return bedingungen.every((b) => evalPrädikat(b, state, ctx));
}
