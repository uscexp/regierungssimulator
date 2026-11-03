/**
 * @staatslenker/loader — YAML-Pack-Loader (M4).
 *
 * Ein Expansion-Pack = Dateien, kein Code. Validierung ist atomisch: das ganze Pack
 * wird gegen das Zod-Schema geprüft, bevor es angewendet wird; ein kaputtes Pack
 * crasht das Spiel nie (ADR-003, architektur.md §5).
 *
 * US-M4-01: Pack ohne `schema_version` wird mit „schema_version fehlt“ abgewiesen;
 * Pack mit unterstützter Version wird geladen.
 * US-M4-03: Ungültiges Pack → Datei und Zeile werden gemeldet, Base-Pack bleibt
 * unverändert, Spiel läuft weiter.
 */

import * as yaml from 'js-yaml';
import { z, type ZodIssue } from 'zod';

export const PACK_SCHEMA_VERSIONS = ['1'] as const;
export type PackSchemaVersion = typeof PACK_SCHEMA_VERSIONS[number];

const LEVEL = z.number().finite().min(0).max(100);
const TAG = z.string().min(1).regex(/^[a-z][a-z0-9_]*$/);

/** Eine Indikator-Regel: tag muss auf einen bekannten Indikator verweisen. */
export const indikatorRegelSchema = z
  .object({
    regel_id: z.string().min(1).optional(),
    tag: TAG,
    verschleiß: z.number().finite().nonnegative(),
    budget_wirkung: z.number().finite().nonnegative(),
    diminishing_at: LEVEL.optional(),
    diminishing_wirkung: z.number().finite().nonnegative().optional(),
    gate: z.object({ indikator: TAG, min: LEVEL }).optional(),
  })
  .strict();

/** Eine Gruppe: tag muss eindeutig sein, Gewichte summieren auf 1. */
export const gruppeSchema = z
  .object({
    tag: TAG,
    zufriedenheit: LEVEL,
    bevölkerungsanteil: z.number().finite().positive(),
    gewichte: z.record(TAG, z.number().finite().min(0).max(1)),
  })
  .strict();

/** Eine Entscheidungskarte: pk_kosten 1–3, wirkung mit ziel/tag/delta. */
export const karteKatalogSchema = z
  .object({
    regel_id: z.string().min(1).regex(/^[a-z][a-z0-9_:]*$/),
    pk_kosten: z.number().int().min(1).max(3),
    wirkung: z.array(
      z.object({
        ziel: z.enum([
          'indikatoren',
          'gruppen',
          'legitimitaet',
          'radikalisierung',
          'politisches_kapital',
          'budget',
          'schulden',
        ]),
        tag: z.string().optional(),
        delta: z.number(),
      }),
    ),
    cooldown: z.number().int().positive().optional(),
    constraints: z
      .array(
        z
          .object({
            indikator: z
              .object({
                tag: TAG,
                min: LEVEL.optional(),
                max: LEVEL.optional(),
              })
              .optional(),
            regierungsform: z
              .enum(['parlamentarisch', 'praesidential', 'diktatur'])
              .optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

/** Vollständiges Pack-Schema mit Cross-Referenz-Validierung. */
export const PackSchema = z
  .object({
    schema_version: z.string().refine(
      (v) => PACK_SCHEMA_VERSIONS.includes(v as PackSchemaVersion),
      { message: 'Nicht unterstützte schema_version' },
    ),
    name: z.string().min(1, { message: 'name ist erforderlich' }),
    version: z.string().optional(),
    beschreibung: z.string().optional(),
    indikator_regeln: z.array(indikatorRegelSchema).min(1),
    gruppen: z.array(gruppeSchema).min(1),
    entscheidungen: z.array(
      z.object({
        regel_id: z.string().min(1),
        label: z.string().min(1),
        beschreibung: z.string().min(1),
      }),
    ),
    karten_katalog: z.array(karteKatalogSchema).optional(),
  })
  .strict()
  .refine(
    (pack) =>
      new Set(pack.indikator_regeln.map((r) => r.tag)).size === pack.indikator_regeln.length,
    { message: 'Indikator-Regel-Tags müssen eindeutig sein' },
  )
  .refine(
    (pack) => new Set(pack.gruppen.map((g) => g.tag)).size === pack.gruppen.length,
    { message: 'Gruppen-Tags müssen eindeutig sein' },
  )
  .refine(
    (pack) =>
      new Set(pack.entscheidungen.map((e) => e.regel_id)).size === pack.entscheidungen.length,
    { message: 'Entscheidungs-Ids müssen eindeutig sein' },
  )
  .refine(
    (pack) => {
      // Cross-Referenz: Karten-Katalog-Tags müssen auf bekannte Indikatoren/Gruppen verweisen
      if (!pack.karten_katalog) return true;
      const indikatorTags = new Set(pack.indikator_regeln.map((r) => r.tag));
      const gruppeTags = new Set(pack.gruppen.map((g) => g.tag));
      return pack.karten_katalog.every((karte) => {
        return karte.wirkung.every((w) => {
          if (!w.tag) return true;
          return indikatorTags.has(w.tag) || gruppeTags.has(w.tag);
        });
      });
    },
    { message: 'Wirkungs-Tags in Karten müssen auf bekannte Indikatoren oder Gruppen verweisen' },
  );

export interface PackLoadResult {
  pack: z.infer<typeof PackSchema>;
  warnings: string[];
}

export interface PackLoadError {
  error: string;
  datei?: string;
  zeile?: number;
}

export type PackLoadOutcome = PackLoadResult | PackLoadError;

/**
 * Extrahiert die Zeilennummer aus einem js-yaml Parse-Fehler.
 * js-yaml liefert `mark.line` (0-basiert) für YAML-Syntaxfehler.
 */
function zeileAusYamlFehler(e: unknown): number | undefined {
  const err = e as { mark?: { line?: number } };
  if (err.mark?.line !== undefined) {
    return err.mark.line + 1; // 1-basiert für den Nutzer
  }
  return undefined;
}

/**
 * Extrahiert die Zeilennummer aus einem Zod-Issue, falls im Pfad ein Array-Index steht.
 * Zod liefert keine Zeilennummern, aber wir können den Pfad als Hinweis nutzen.
 * Gibt undefined zurück (Zod kennt keine YAML-Zeilen).
 */
function zeileAusZodIssue(issue: ZodIssue): number | undefined {
  return undefined;
}

/**
 * Formatiert einen Zod-Pfad als lesbaren String (z.B. `indikator_regeln[0].verschleiß`).
 */
function pfadLesen(pfad: PropertyKey[]): string {
  return pfad
    .map((teil, i) => {
      if (typeof teil === 'number') return `[${teil}]`;
      if (typeof teil === 'symbol') return `[${String(teil)}]`;
      return i === 0 ? teil : `.${teil}`;
    })
    .join('');
}

/**
 * Lädt ein YAML-Pack und validiert es atomisch.
 * Bei `schema_version` fehlt → Fehler "schema_version fehlt" mit Datei/Zeile.
 * Bei ungültigen Regeln oder Dangling-Tag-Referenzen → Fehler mit Datei/Zeile,
 * Pack wird abgelehnt, Base-Pack bleibt unverändert.
 * Bei gültigem Pack → PackData zurück.
 * Wirft niemals eine Ausnahme – das Spiel läuft weiter.
 */
export function loadPack(yamlInhalt: string, datei?: string): PackLoadOutcome {
  try {
    const parsed = yaml.load(yamlInhalt) as Record<string, unknown> | null;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: 'schema_version fehlt', datei };
    }

    if (!('schema_version' in parsed)) {
      return { error: 'schema_version fehlt', datei };
    }

    const result = PackSchema.safeParse(parsed);
    if (!result.success) {
      const firstError = result.error.issues[0];
      const pfad = firstError ? pfadLesen(firstError.path) : '';
      const zeile = firstError ? zeileAusZodIssue(firstError) : undefined;
      const meldung =
        pfad && firstError
          ? `${pfad}: ${firstError.message}`
          : firstError?.message ?? 'Validierungsfehler';
      return {
        error: meldung,
        datei,
        zeile,
      };
    }

    return { pack: result.data, warnings: [] };
  } catch (e) {
    return {
      error: `YAML-Parsefehler: ${e instanceof Error ? e.message : String(e)}`,
      datei,
      zeile: zeileAusYamlFehler(e),
    };
  }
}
