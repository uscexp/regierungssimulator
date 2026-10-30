/**
 * core/rules — das Regel-Register für die Setup-Typen (US-M1-01, FR-034, Pädu-Kanon §3b).
 *
 * Das Register liegt **im Kern** (architektur.md §3b): Typen + Schema + refine + Lookup nach Typ und Id.
 * Content (`content/base`) liefert Regel-*Instanzen*, die gegen dieses Schema validieren, und der Loader
 * (M4) importiert das Schema aus dem Kern — Adapter→Kern ist erlaubt, Kern→Adapter verboten (ADR-002).
 * zod ist eine Bibliothek, kein Adapter; der Kern importiert kein Content-Modul.
 *
 * Das Schema beschreibt Struktur und Grenzen, keine Balance-Zahlen: Schwellen, Wahrscheinlichkeiten und
 * Effekte stehen im Pack und in docs/balance-werte.md (dasselbe Prinzip wie das Content-Schema zu
 * US-M0-13). Eine neue Mechanik ist ein neuer typisierter Variant in Kern und Schema (ADR-004), kein
 * Interpreter und keine injizierte Funktion (ADR-011).
 *
 * Die Feldnamen der `wahlregel`- und `regierung`-Varianten sind Pädu-Kanon (§3b, gemerged als PR #30):
 * `typ` als Discriminator, `intervall_jahre` statt `term_jahre` (bestehendes Feld aus core/wahl.ts),
 * `mehrheit` ohne Fraktions-Ids (Fraktionen sind abgeleitete Views, G3/§3a), `putsch_roll` mit
 * `wahrscheinlichkeit` und ASCII-Feldnamen nach Kern-Stil (`militaer_min`, `legitimitaet_min`).
 * Die Pflichtfelder der `constitution` sind aus FR-017 abgeleitet und warten Retos Bestätigung
 * (Requirements-Autorität) — ein rename danach ist eine Schema-Zeile plus Test-Zeile, kein Kern-Change.
 */
import { z } from 'zod';

/** Level-Grenzen sind Kern-Invarianten (core/invariant.ts, LEVEL_MIN/LEVEL_MAX) — das Schema spiegelt sie. */
const LEVEL = z.number().finite().min(0).max(100);
/** Content-Tags sind klein mit Unterstrichen und nie leer (dasselbe Vokabular wie das Content-Schema). */
const TAG = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/);
/** Eine Regel-Id ist die Fehlerfall-Referenz (FR-006) — die `grund_id` der Wahlprüfung zeigt auf sie. */
const REGEL_ID = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/);
/** Jahres-Zahlen sind positive Ganzzahlen — ein Bruchjahr wäre kein Jahreszyklus. */
const JAHR = z.number().int().positive();
/** Eine Wahrscheinlichkeit ist ein Anteil 0–1 (seedbarer Roll, G6–G10); der Wert kommt aus dem Pack. */
const WAHRSCHEINLICHKEIT = z.number().finite().min(0).max(1);

/** Die Spec-Regel-Typen des Setups (FR-034); ein unbekannter Typ ist ein Content-Fehler. */
export const setupRegelTyp = z.enum([
  'constitution',
  'regierung',
  'praesidentialwahl',
  'parlamentmehrheit',
  'putsch_roll',
]);
export type SetupRegelTypString = z.infer<typeof setupRegelTyp>;

/** Die drei Regierungsformen sind Spec-Vokabular (FR-015); eine vierte wäre ein neues Spiel. */
const REGIERUNG_FORM = z.enum(['praesidential', 'parlamentarisch', 'diktatur']);
/** Der Amtsmodus ist Daten, kein Mechanismus (FR-015). */
const AMTS_MODUS = z.enum(['fixed_term', 'zyklisch', 'keins']);
/** Die Machtverlust-Mechanik je Form ist Spec-Vokabular (FR-013/FR-014). */
const MACHTVERLUST = z.enum(['wahl', 'misstrauen', 'putsch']);

/** Struktur einer Regierungsregel (FR-015) — rein, damit der Discriminator präzise Feldnamen liefert. */
const regierungBasisSchema = z
  .object({
    typ: z.literal('regierung'),
    regel_id: REGEL_ID,
    form: REGIERUNG_FORM,
    amt: z.object({ modus: AMTS_MODUS, jahre: JAHR.optional() }).strict(),
    machtverlust: MACHTVERLUST,
  })
  .strict();

/**
 * Eine Regierungsregel (FR-015) mit den Pädu-Bindungen (§3b): praesidential ⇒ wahl mit fixed_term,
 * parlamentarisch ⇒ misstrauen, diktatur ⇒ putsch — eine Diktatur mit `wahl` ist ein Content-Fehler,
 * weil der Kern die Mechanik je Form interpretiert (US-M1-03). Dazu der Amtsmodus-Widerspruch: `keins`
 * hat keine Amts-Jahre, `fixed_term` und `zyklisch` brauchen sie. Die Wahlniederlage des Kanzlers läuft
 * über denselben Wahl-Gate (FR-013, demokratieübergreifend) — misstrauen ist die zusätzliche Roll, kein
 * Ersatz.
 */
export const regierungSchema = regierungBasisSchema
  .refine((regel) => (regel.amt.modus === 'keins') === (regel.amt.jahre === undefined), {
    message: 'Amtsmodus "keins" hat keine Amts-Jahre, fixed_term und zyklisch brauchen sie',
  })
  .refine(
    (regel) =>
      (regel.form === 'praesidential' &&
        regel.machtverlust === 'wahl' &&
        regel.amt.modus === 'fixed_term') ||
      (regel.form === 'parlamentarisch' && regel.machtverlust === 'misstrauen') ||
      (regel.form === 'diktatur' && regel.machtverlust === 'putsch'),
    {
      message:
        'Machtverlust muss zur Form passen: praesidential⇒wahl+fixed_term, parlamentarisch⇒misstrauen, diktatur⇒putsch',
    },
  );

/**
 * Wahl-Machtcheck in präsidentieller Lesart: Zyklus und beide Schwellen. Die Feldnamen sind die
 * bestehenden Werte aus `core/wahl.ts` (D18: 6/47/35) — kein neues `term_jahre`. Der Gate gilt für alle
 * Demokratie-Formen (FR-013), der Variant-Name bindet nicht an die Regierungsform.
 */
export const praesidentialwahlSchema = z
  .object({
    typ: z.literal('praesidentialwahl'),
    regel_id: REGEL_ID,
    intervall_jahre: JAHR,
    gewichtete_min: LEVEL,
    schwächste_min: LEVEL,
  })
  .strict();

/** Gesetzes-Mehrheit in parlamentarischer Form (FR-016) — ein Anteil, keine Fraktions-Ids (G3/§3a). */
export const parlamentmehrheitSchema = z
  .object({
    typ: z.literal('parlamentmehrheit'),
    regel_id: REGEL_ID,
    mehrheit: z.number().finite().min(0.5).max(1),
  })
  .strict();

/** Putsch-Roll in der Diktatur (FR-014): Bedingung aus Elite-/Militärzufriedenheit und Legitimität. */
export const putschRollSchema = z
  .object({
    typ: z.literal('putsch_roll'),
    regel_id: REGEL_ID,
    elite_min: LEVEL,
    militaer_min: LEVEL,
    legitimitaet_min: LEVEL,
    wahrscheinlichkeit: WAHRSCHEINLICHKEIT,
  })
  .strict();

/** Die closed Variante des Wahl-Machtchecks als Content-Datum (ADR-011) — nie eine injizierte Funktion. */
export const wahlregelSchema = z.discriminatedUnion('typ', [
  praesidentialwahlSchema,
  parlamentmehrheitSchema,
  putschRollSchema,
]);

/** Der baseline-Effekt einer Konstitutions-Entscheidung auf eine Gruppe (FR-017, sofort). */
const gruppenDeltaSchema = z
  .object({ gruppe_tag: TAG, delta: z.number().finite().min(-100).max(100) })
  .strict();

/**
 * Der dauerhafte Modifikator (FR-017): Event-Wahrscheinlichkeits-Faktor und Gruppen-Modifikatoren.
 * Ein Faktor ist positiv — ein negativer Faktor wäre eine erfundene Inversion der Event-Mechanik.
 */
const regelsatzModifikatorSchema = z
  .object({
    event_wahrscheinlichkeitfaktor: z.number().finite().positive(),
    gruppen_modifikatoren: z.record(TAG, z.number().finite().min(-100).max(100)),
  })
  .strict();

/** Struktur einer Konstitutions-Entscheidung — die Eindeutigkeit der Effekte kommt als refine dazu. */
const konstitutionEntscheidungBasisSchema = z
  .object({
    regel_id: REGEL_ID,
    label: z.string().min(1),
    beschreibung: z.string().min(1),
    /** Der Sofort-Effekt ist Daten; die Gruppenzufriedenheit rechnet der Kern (core/zufriedenheit). */
    sofort_effekte: z.array(gruppenDeltaSchema),
    regelsatz_modifikator: regelsatzModifikatorSchema,
  })
  .strict();

/** Eine Konstitutions-Entscheidung (FR-017) mit Sofort-Effekt und Dauer-Modifikator. */
export const konstitutionEntscheidungSchema = konstitutionEntscheidungBasisSchema.refine(
  (entscheidung) =>
    entscheidung.sofort_effekte.length ===
    new Set(entscheidung.sofort_effekte.map((e) => e.gruppe_tag)).size,
  { message: 'Sofort-Effekte müssen je Gruppe eindeutig sein' },
);

/** Struktur einer Konstitutionsregel — die Id-Eindeutigkeit der Entscheidungen kommt als refine dazu. */
const konstitutionBasisSchema = z
  .object({
    typ: z.literal('constitution'),
    regel_id: REGEL_ID,
    label: z.string().min(1),
    entscheidungen: z.array(konstitutionEntscheidungBasisSchema).min(1),
  })
  .strict();

/** Eine Konstitutionsregel (FR-017); die Entscheidungs-Felder warten Retos Kanons (US-M1-04 zählt ~8). */
export const konstitutionSchema = konstitutionBasisSchema.refine(
  (regel) =>
    new Set(regel.entscheidungen.map((e) => e.regel_id)).size === regel.entscheidungen.length,
  { message: 'Konstitutions-Entscheidungen müssen eindeutige regel_id haben' },
);

/**
 * Das Register über alle Setup-Typen als discriminated Union über `typ` — die reine Struktur, damit der
 * Discriminator die Feldnamen-Fehler liefert (AC zu US-M1-01). Die gebundenen Refinements (Form ⇒
 * Mechanik, Amtsmodus ⇒ Amts-Jahre, Id-Eindeutigkeit je Regel) prüft `validiereSetupRegeln` über die
 * verfeinerten Typ-Schemata.
 */
export const setupRegelSchema = z.discriminatedUnion('typ', [
  konstitutionBasisSchema,
  regierungBasisSchema,
  praesidentialwahlSchema,
  parlamentmehrheitSchema,
  putschRollSchema,
]);

/** TS-Struktur für Konsumenten — der Kern kennt die Struktur, das Schema ist die Validierung. */
export type SetupRegel = z.infer<typeof setupRegelSchema>;
export type RegierungRegel = z.infer<typeof regierungSchema>;
export type WahlregelVariant = z.infer<typeof wahlregelSchema>;
export type KonstitutionRegel = z.infer<typeof konstitutionSchema>;

/** Ein Setup-Regelsatz: eindeutige Ids und mindestens eine Regierung plus eine Wahl-Mechanik. */
export const setupRegelnSchema = z
  .array(setupRegelSchema)
  .min(1)
  .refine((regeln) => new Set(regeln.map((r) => r.regel_id)).size === regeln.length, {
    message: 'Setup-Regel-Ids müssen eindeutig sein',
  })
  .refine(
    (regeln) =>
      regeln.some((r) => r.typ === 'regierung') &&
      regeln.some(
        (r) =>
          r.typ === 'praesidentialwahl' || r.typ === 'parlamentmehrheit' || r.typ === 'putsch_roll',
      ),
    { message: 'Ein Setup-Regelsatz braucht eine regierung-Regel und eine Wahl-Machtcheck-Regel' },
  );

/** Die verfeinerten Typ-Schemata nach Discriminator — die gebundenen Regeln des Kanons (§3b). */
const verfeinertNachTyp: Record<SetupRegelTypString, z.ZodType<unknown>> = {
  constitution: konstitutionSchema,
  regierung: regierungSchema,
  praesidentialwahl: praesidentialwahlSchema,
  parlamentmehrheit: parlamentmehrheitSchema,
  putsch_roll: putschRollSchema,
};

/** Lookup nach Typ (FR-034): alle Regeln eines Typs, in Register-Reihenfolge. */
export function regelnNachTyp(
  regeln: readonly SetupRegel[],
  typ: SetupRegelTypString,
): SetupRegel[] {
  return regeln.filter((regel) => regel.typ === typ);
}

/** Lookup nach Id: die Regel oder `undefined` — ein Fehlwurf wäre ein Adapter-Fehler, kein Spielzustand. */
export function regelNachId(
  regeln: readonly SetupRegel[],
  regelId: string,
): SetupRegel | undefined {
  return regeln.find((regel) => regel.regel_id === regelId);
}

/** Die aktive Wahl-Machtcheck-Regel des Registers — der Kern interpretiert den gereichten Variant. */
export function wahlregelImRegister(regeln: readonly SetupRegel[]): WahlregelVariant | undefined {
  return regeln.find((regel) => wahlregelSchema.safeParse(regel).success) as
    WahlregelVariant | undefined;
}

/**
 * Validiert ein Setup-Regelsatz in zwei Stufen, beide mit Feldnamen: erst die Struktur über den
 * Discriminator, dann die gebundenen Refinements je Regel. Dieselbe Konvention wie die
 * Kern-Fehlerkonvention (FR-002): Dev wirft mit den Feldnamen, Produktion liefert `fehlerfrei: false`
 * und läuft weiter — ein kaputtes Register crasht das Spiel nie. Die Feldnamen sind die AC-Erwartung zu
 * US-M1-01 („fehlende Pflichtfelder werden mit Feldnamen abgelehnt").
 */
export function validiereSetupRegeln(
  regeln: unknown,
  modus: 'dev' | 'produktion' = 'dev',
): { readonly fehlerfrei: boolean; readonly grund: string } {
  const strukturell = setupRegelnSchema.safeParse(regeln);
  const gründe: string[] = strukturell.success
    ? []
    : strukturell.error.issues.map(
        (issue) => `${issue.path.join('.') || '(regeln)'}: ${issue.message}`,
      );
  if (strukturell.success) {
    for (const regel of strukturell.data) {
      const gebunden = verfeinertNachTyp[regel.typ].safeParse(regel);
      if (!gebunden.success) {
        for (const issue of gebunden.error.issues) {
          gründe.push(`${issue.path.join('.') || regel.typ}: ${issue.message}`);
        }
      }
    }
  }
  if (gründe.length === 0) return { fehlerfrei: true, grund: 'setup-regeln validieren fehlerfrei' };
  const grund = gründe.join(' · ');
  if (modus === 'dev') throw new TypeError(`Setup-Regeln invalid: ${grund}`);
  return { fehlerfrei: false, grund };
}
