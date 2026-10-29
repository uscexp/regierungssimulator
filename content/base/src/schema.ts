/**
 * @staatslenker/content-base schema — das Zod-Schema für Regel-Content (ADR-003, US-M0-13).
 *
 * Das Schema ist die einzige Wahrheit für die Regel-Struktur: TS-Basis-Content (hier) und
 * YAML-Mod-Packs (M4-Loader) validieren gegen dasselbe Schema, damit Modder und Repo dieselben
 * Fehler bekommen. Es beschreibt Struktur und Grenzen — keine Balance-Zahlen: Verschleiß, Wirkung
 * und Anteile stehen im Pack und in docs/balance-werte.md, nicht im Schema.
 *
 * Der Kern importiert dieses Modul nicht (ADR-002, Kern-Isolation): der Kern kennt nur die
 * Struktur als TS-Typen, das Schema gehört zum Content.
 */
import { z } from 'zod';

/** Level-Grenzen sind Kern-Invarianten (core/invariant.ts, LEVEL_MIN/LEVEL_MAX) — das Schema spiegelt sie. */
const LEVEL = z.number().finite().min(0).max(100);
/** Content-Tags sind klein mit Unterstrichen (`arbeitnehmer`, `bildung_jugend`) und nie leer. */
const TAG = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/);
/** Eine Summenprüfung auf Fließkomma-Werten braucht eine Toleranz, nie `===`. */
function summe(werte: readonly number[]): number {
  return werte.reduce((acc, wert) => acc + wert, 0);
}

/** Gate: dieser Indikator stagniert unter einem Level eines anderen Indikators (§2). */
export const gateSchema = z.object({ indikator: TAG, min: LEVEL }).strict();

/**
 * Eine Indikator-Regel. `diminishing_at` und `diminishing_wirkung` sind ein Paar — beide oder
 * keines. Ein Schwellenwert ohne abgesenkte Wirkung ist ein Balance-Fehler, kein Default (FR-002,
 * Lens-Blocker zu PR #5): das Schema lehnt ihn ab, statt auf 0 zu fallen.
 */
export const indikatorRegelSchema = z
  .object({
    /** Regel-Id für Fehlerfälle und das Entscheidungsgedächtnis (FR-006); ohne sie meldet der Kern `regel.tag`. */
    regel_id: z.string().min(1).optional(),
    tag: TAG,
    verschleiß: z.number().finite().nonnegative(),
    budget_wirkung: z.number().finite().nonnegative(),
    diminishing_at: LEVEL.optional(),
    diminishing_wirkung: z.number().finite().nonnegative().optional(),
    gate: gateSchema.optional(),
  })
  .strict()
  .refine(
    (regel) => (regel.diminishing_at === undefined) === (regel.diminishing_wirkung === undefined),
    { message: 'diminishing_at und diminishing_wirkung sind ein Paar — beide oder keines' },
  );

/** Die Steuermodell-Schlüssel sind Kern-Vokabular (core/zufriedenheit), vier feste Felder. */
const steuermodellSchluessel = z
  .object({
    niedrig: z.number().finite().nonnegative(),
    flat: z.number().finite().nonnegative(),
    progressiv: z.number().finite().nonnegative(),
    hoch: z.number().finite().nonnegative(),
  })
  .strict();

/** Steuerfaktor-Tabelle (multipliziert die Einnahmen) und Steuerlast-Tabelle (direkter Abzug je Gruppe). */
export const steuerfaktorSchema = steuermodellSchluessel;
export const steuerlastJeGruppeSchema = steuermodellSchluessel;

/** Eine Gruppe: Anteil und Gewichte sind Daten; die Zufriedenheit rechnet der Kern, nie das Pack. */
export const gruppeSchema = z
  .object({
    tag: TAG,
    /** Startwert; der Kern rechnet beim ersten Tick neu — ein Pack darf keine Formel haben. */
    zufriedenheit: LEVEL,
    bevölkerungsanteil: z.number().finite().positive(),
    gewichte: z.record(TAG, z.number().finite().min(0).max(1)),
  })
  .strict()
  .refine((gruppe) => Math.abs(summe(Object.values(gruppe.gewichte)) - 1) <= 1e-9, {
    message: 'Gewichte einer Gruppe müssen auf 1 summieren',
  });

/** Die Bevölkerunganteile summieren auf 100 % (K4); doppelte Tags wären eine stille Doppelzählung. */
export const gruppenSchema = z
  .array(gruppeSchema)
  .min(1)
  .refine((gruppen) => Math.abs(summe(gruppen.map((g) => g.bevölkerungsanteil)) - 100) <= 1e-9, {
    message: 'Bevölkerungsanteile müssen auf 100 % summieren',
  })
  .refine((gruppen) => new Set(gruppen.map((g) => g.tag)).size === gruppen.length, {
    message: 'Gruppen-Tags müssen eindeutig sein',
  });

/** Schwierigkeit ist ein Parameter-Pack (G6), kein Mechanismus; der Zuschuss darf negativ sein. */
export const schwierigkeitPackSchema = z
  .object({
    verschleiß_multiplikator: z.number().finite().positive(),
    pk_regeneration: z.number().finite().positive(),
    event_wahrscheinlichkeit: z.number().finite().positive(),
    schuldenlimit: z.number().finite().positive(),
    zinsfaktor: z.number().finite().nonnegative(),
    budget_zuschuss: z.number().finite(),
  })
  .strict();

/** Die drei Schwierigkeits-Ids sind fest (leicht/normal/schwer); ein viertes Pack wäre ein neues Spiel. */
export const schwierigkeitPacksSchema = z
  .object({
    leicht: schwierigkeitPackSchema,
    normal: schwierigkeitPackSchema,
    schwer: schwierigkeitPackSchema,
  })
  .strict();

/** Eine Basis-Entscheidung (M0: eine Budget-Allokation pro Indikator). PK-Kosten 0–3 (FR-011). */
export const basisEntscheidungSchema = z
  .object({
    regel_id: z.string().min(1),
    label: z.string().min(1),
    beschreibung: z.string().min(1),
    indikator: TAG,
    pk_kosten: z.number().finite().min(0).max(3),
  })
  .strict();

/** Der ganze Basis-Pack: alles, was der Tick als Daten braucht, plus die spielbaren Entscheidungen. */
export const basisPackSchema = z
  .object({
    indikator_regeln: z.array(indikatorRegelSchema).min(1),
    gruppen: gruppenSchema,
    start_indikatoren: z.record(TAG, LEVEL),
    steuerfaktor: steuerfaktorSchema,
    steuerlast: z.record(TAG, steuerlastJeGruppeSchema),
    schwierigkeit_packs: schwierigkeitPacksSchema,
    /** News-Vorlagen je Event-Id (G11); ohne Vorlage fällt der Text auf die Id zurück. */
    news_vorlagen: z.record(TAG, z.string().min(1)),
    entscheidungen: z.array(basisEntscheidungSchema).min(1),
  })
  .strict()
  .refine(
    (pack) =>
      new Set(pack.indikator_regeln.map((r) => r.tag)).size === pack.indikator_regeln.length,
    { message: 'Indikator-Regel-Tags müssen eindeutig sein' },
  )
  .refine(
    (pack) =>
      new Set(pack.entscheidungen.map((e) => e.regel_id)).size === pack.entscheidungen.length,
    { message: 'Entscheidungs-Ids müssen eindeutig sein' },
  )
  .refine(
    (pack) => {
      const budgetbar = new Map(pack.indikator_regeln.map((r) => [r.tag, r.budget_wirkung]));
      return pack.entscheidungen.every(
        (entscheidung) => (budgetbar.get(entscheidung.indikator) ?? 0) > 0,
      );
    },
    {
      message:
        'Eine Entscheidung muss einen budgetbaren Indikator adressieren (budget_wirkung > 0)',
    },
  )
  .refine(
    (pack) => {
      const tags = new Set(pack.indikator_regeln.map((r) => r.tag));
      return Object.keys(pack.start_indikatoren).every((tag) => tags.has(tag));
    },
    { message: 'Start-Indikatoren müssen zu den Indikator-Regeln passen' },
  )
  .refine(
    (pack) => {
      const tags = new Set(pack.gruppen.map((g) => g.tag));
      return Object.keys(pack.steuerlast).every((tag) => tags.has(tag));
    },
    { message: 'Steuerlast-Tabelle muss zu den Gruppen passen' },
  );

/** Die Validierungs-Ausgabe: im Dev-Modus wirft sie, im Produktionsmodus liefert sie die Gründe. */
export interface ContentValidierung {
  readonly fehlerfrei: boolean;
  readonly grund: string;
}

/**
 * Validiert einen Pack gegen das Schema. Nach der FR-002-Konvention: Dev wirft mit dem Grund,
 * Produktion liefert `fehlerfrei: false` und läuft weiter — ein kaputtes Pack crasht das Spiel nie
 * (ADR-003).
 */
export function validierePack(
  pack: unknown,
  modus: 'dev' | 'produktion' = 'dev',
): ContentValidierung {
  const ergebnis = basisPackSchema.safeParse(pack);
  if (ergebnis.success) return { fehlerfrei: true, grund: 'pack validiert fehlerfrei' };
  const grund = ergebnis.error.issues
    .map((issue) => `${issue.path.join('.') || '(pack)'}: ${issue.message}`)
    .join(' · ');
  if (modus === 'dev') throw new TypeError(`Basis-Pack invalid: ${grund}`);
  return { fehlerfrei: false, grund };
}
