/**
 * @staatslenker/content-base setup-schema — die Regel-Typen des Setups (US-M1-01, FR-034).
 *
 * Das Schema beschreibt **Struktur und Grenzen**, keine Balance-Zahlen: Schwellen, Wahrscheinlichkeiten
 * und Effekte stehen im Pack und in docs/balance-werte.md (dasselbe Prinzip wie `schema.ts`). Der Kern
 * importiert dieses Modul nicht (ADR-002) — er kennt die Struktur als TS-Typen und interpretiert die
 * closed Varianten, die ADR-011 festgelegt hat.
 *
 * Die drei Typen sind die Setup-Mechanik aus dem Spec: `regierung` (FR-015: drei Formen mit Amtsmodus,
 * Machtverlust und Sondermechanik), `konstitution` (FR-017: Entscheidungen mit sofortigem baseline-Effekt
 * auf Gruppen und dauerhaftem Regelsatz-Modifikator) und `wahlregel` (FR-013/ADR-011: Wahl-Machtcheck als
 * Content-Datum, nicht als injizierte Funktion). Eine neue Mechanik ist ein neuer typisierter Variant in
 * Kern und Schema (ADR-004: keine String-DSL, kein Interpreter).
 *
 * Feld-Namen sind aus FR-015/FR-017 und ADR-011 abgeleitet und warten die Bestätigung von Reto
 * (Requirements) und Pädu (Register-Struktur). Ein rename nach dem Ruling ist eine Schema-Zeile, kein
 * Kern-Change.
 */
import { z } from 'zod';

/** Level-Grenzen sind Kern-Invarianten (core/invariant.ts) — das Schema spiegelt sie. */
const LEVEL = z.number().finite().min(0).max(100);
/** Content-Tags sind klein mit Unterstrichen und nie leer (dasselbe Vokabular wie schema.ts). */
const TAG = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/);
/** Eine Regel-Id ist der Fehlerfall-Referenzwert (FR-006) und muss eindeutig sein. */
const REGEL_ID = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/);
/** Amts-Jahre sind positive Ganzzahlen — ein Bruchjahr wäre kein Jahreszyklus. */
const AMTS_JAHRE = z.number().int().positive();

/** Die drei Regierungsformen sind Spec-Vokabular (FR-015); eine vierte wäre ein neues Spiel. */
const REGIERUNG_FORM = z.enum(['praesidential', 'parlamentarisch', 'diktatur']);
/** Der Amtsmodus ist Daten, kein Mechanismus: fixed Term, zyklisch oder keiner (FR-015). */
const AMTS_MODUS = z.enum(['fixed_term', 'zyklisch', 'keins']);
/** Die Machtverlust-Mechanik je Form ist Spec-Vokabular (FR-013/FR-014): Wahl, Misstrauen, Putsch. */
const MACHTVERLUST = z.enum(['wahl', 'misstrauen', 'putsch']);

/**
 * Eine Regierungsregel. Die Form bestimmt die Machtverlust-Mechanik — eine Diktatur mit `wahl` wäre
 * ein Content-Fehler, weil der Kern die Mechanik je Form interpretiert (FR-015, US-M1-03).
 */
export const regierungSchema = z
  .object({
    type: z.literal('regierung'),
    regel_id: REGEL_ID,
    form: REGIERUNG_FORM,
    amt: z
      .object({ modus: AMTS_MODUS, jahre: AMTS_JAHRE.optional() })
      .strict()
      .refine((amt) => (amt.modus === 'keins') === (amt.jahre === undefined), {
        message: 'Amtsmodus "keins" hat keine Amts-Jahre, fixed_term und zyklisch brauchen sie',
      }),
    machtverlust: MACHTVERLUST,
  })
  .strict()
  .refine(
    (regel) =>
      (regel.form === 'praesidential' && regel.machtverlust === 'wahl') ||
      (regel.form === 'parlamentarisch' && regel.machtverlust === 'misstrauen') ||
      (regel.form === 'diktatur' && regel.machtverlust === 'putsch'),
    {
      message:
        'Machtverlust-Mechanik muss zur Form passen: praesidential⇒wahl, parlamentarisch⇒misstrauen, diktatur⇒putsch',
    },
  );

/** Der baseline-Effekt einer Konstitutions-Entscheidung auf eine Gruppe (FR-017, sofort). */
const gruppenDeltaSchema = z
  .object({ gruppe_tag: TAG, delta: z.number().finite().min(-100).max(100) })
  .strict();

/**
 * Der dauerhafte Modifikator (FR-017): Wahrscheinlichkeits-Faktor für Events und Gruppen-Modifikatoren.
 * Ein Faktor ist positiv — ein negativer Faktor wäre eine erfundene Inversion der Event-Mechanik.
 */
const regelsatzModifikatorSchema = z
  .object({
    event_wahrscheinlichkeitfaktor: z.number().finite().positive(),
    gruppen_modifikatoren: z.record(TAG, z.number().finite().min(-100).max(100)),
  })
  .strict();

/** Eine Konstitutions-Entscheidung (FR-017) mit Sofort-Effekt und Dauer-Modifikator. */
export const konstitutionEntscheidungSchema = z
  .object({
    regel_id: REGEL_ID,
    label: z.string().min(1),
    beschreibung: z.string().min(1),
    /** Der Sofort-Effekt ist Daten; die Gruppenzufriedenheit rechnet der Kern (core/zufriedenheit). */
    sofort_effekte: z.array(gruppenDeltaSchema),
    regelsatz_modifikator: regelsatzModifikatorSchema,
  })
  .strict()
  .refine(
    (entscheidung) =>
      entscheidung.sofort_effekte.length ===
      new Set(entscheidung.sofort_effekte.map((e) => e.gruppe_tag)).size,
    { message: 'Sofort-Effekte müssen je Gruppe eindeutig sein' },
  );

/** Eine Konstitutionsregel: die Entscheidungen des Setups (FR-017, US-M1-04 zählt ~8). */
export const konstitutionSchema = z
  .object({
    type: z.literal('constitution'),
    regel_id: REGEL_ID,
    label: z.string().min(1),
    entscheidungen: z.array(konstitutionEntscheidungSchema).min(1),
  })
  .strict()
  .refine(
    (regel) =>
      new Set(regel.entscheidungen.map((e) => e.regel_id)).size === regel.entscheidungen.length,
    { message: 'Konstitutions-Entscheidungen müssen eindeutige regel_id haben' },
  );

/** ADR-011, Variant 1: präsidentielle Wahl mit fixed Term und zwei Schwellen. */
const praesidentialwahlSchema = z
  .object({
    mechanik: z.literal('praesidentialwahl'),
    term_jahre: AMTS_JAHRE,
    gewichtete_min: LEVEL,
    schwächste_min: LEVEL,
  })
  .strict();

/** ADR-011, Variant 2: parlamentarische Mehrheit aus den Fraktionen (ab G3, FR-016). */
const parlamentmehrheitSchema = z
  .object({
    mechanik: z.literal('parlamentmehrheit'),
    /** Mehrheit als Anteil — 0.5 ist die einfache Mehrheit, 1 ist einstimmig. */
    mehrheit: z.number().finite().min(0.5).max(1),
    schwächste_min: LEVEL,
  })
  .strict();

/** ADR-011, Variant 3: Putsch-Roll aus Elite-/Militärzufriedenheit und Legitimität (FR-014). */
const putschRollSchema = z
  .object({
    mechanik: z.literal('putsch_roll'),
    elite_min: LEVEL,
    militär_min: LEVEL,
    legitimität_min: LEVEL,
  })
  .strict();

/** Die closed Variante der Wahl-Machtcheck-Mechanik (ADR-011); eine unbekannte Mechanik ist ein Fehler. */
const wahlregelMechanikSchema = z.discriminatedUnion('mechanik', [
  praesidentialwahlSchema,
  parlamentmehrheitSchema,
  putschRollSchema,
]);

/** Die Wahlregel als Content-Datum (ADR-011) — nie eine injizierte Funktion. */
export const wahlregelSchema = z
  .object({
    type: z.literal('wahlregel'),
    regel_id: REGEL_ID,
    mechanik: wahlregelMechanikSchema,
  })
  .strict();

/** Das Setup-Register: die drei Typen als discriminated Union, dieselbe Wahrheit wie der Basis-Pack. */
export const setupRegelSchema = z.discriminatedUnion('type', [
  konstitutionSchema,
  regierungSchema,
  wahlregelSchema,
]);

/** Ein Setup-Regelsatz: mindestens eine Regel je Typ, und die Ids sind global eindeutig. */
export const setupRegelnSchema = z
  .array(setupRegelSchema)
  .min(1)
  .refine((regeln) => new Set(regeln.map((r) => r.regel_id)).size === regeln.length, {
    message: 'Setup-Regel-Ids müssen eindeutig sein',
  })
  .refine(
    (regeln) => {
      const typen = new Set(regeln.map((r) => r.type));
      return typen.has('regierung') && typen.has('wahlregel');
    },
    { message: 'Ein Setup-Regelsatz braucht mindestens eine regierung- und eine wahlregel-Regel' },
  );

/**
 * Validiert ein Setup-Regelsatz gegen das Schema — dieselbe Konvention wie `validierePack` (ADR-003):
 * Dev wirft mit den Feldnamen, Produktion liefert `fehlerfrei: false` und läuft weiter. Die Feldnamen
 * sind die AC-Erwartung zu US-M1-01 („fehlende Pflichtfelder werden mit Feldnamen abgelehnt").
 */
export function validiereSetupRegeln(
  regeln: unknown,
  modus: 'dev' | 'produktion' = 'dev',
): { readonly fehlerfrei: boolean; readonly grund: string } {
  const ergebnis = setupRegelnSchema.safeParse(regeln);
  if (ergebnis.success) return { fehlerfrei: true, grund: 'setup-regeln validieren fehlerfrei' };
  const grund = ergebnis.error.issues
    .map((issue) => `${issue.path.join('.') || '(regeln)'}: ${issue.message}`)
    .join(' · ');
  if (modus === 'dev') throw new TypeError(`Setup-Regeln invalid: ${grund}`);
  return { fehlerfrei: false, grund };
}
