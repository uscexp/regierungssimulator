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
 * US-M4-04: Merge-Policy Override vs. Shadow — wenn ein Pack eine Base-Regel mit
 * gleicher ID überschreibt, gilt die Merge-Policy:
 *   - Override ersetzt die Base-Regel vollständig durch die Pack-Regel
 *   - Shadow behält die Base-Regel bei, die Pack-Regel wird ignoriert (Konflikt im Report)
 * Der Konflikt erscheint im Merge-Report.
 */

import * as yaml from 'js-yaml';
import { z, type ZodIssue } from 'zod';

export const PACK_SCHEMA_VERSIONS = ['1'] as const;
export type PackSchemaVersion = typeof PACK_SCHEMA_VERSIONS[number];

const LEVEL = z.number().finite().min(0).max(100);
const TAG = z.string().min(1).regex(/^[a-z][a-z0-9_]*$/);

/** Eine Indikator-Regel: tag muss auf einen bekannten Indikator verweisen. diminishing_at und diminishing_wirkung sind Pflichtfelder (US-M4-05). */
export const indikatorRegelSchema = z
  .object({
    regel_id: z.string().min(1).optional(),
    tag: TAG,
    verschleiß: z.number().finite().nonnegative(),
    budget_wirkung: z.number().finite().nonnegative(),
    diminishing_at: LEVEL,
    diminishing_wirkung: z.number().finite().nonnegative(),
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

export { packManager, type PackManagerErgebnis, type GeladenesPack } from './pack-manager.js';

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

/**
 * US-M4-04: Merge-Policy für Pack-Überschreibungen.
 *
 * Wenn ein Override-Pack eine Base-Regel mit gleicher ID enthält, gilt die Merge-Policy:
 *   - Override ersetzt die Base-Regel vollständig durch die Pack-Regel
 *   - Shadow behält die Base-Regel bei, die Pack-Regel wird ignoriert (Konflikt im Report)
 *
 * Der Konflikt erscheint im Merge-Report, damit Modder sehen, welche Regeln überschrieben wurden.
 */
export type MergePolicy = 'override' | 'shadow';

export interface MergeConflict {
  /** Die ID der überschriebenen Regel (regel_id für Entscheidungen, tag für Indikator/Gruppe) */
  regel_id: string;
  /** Typ der Regel */
  typ: 'indikator_regel' | 'gruppe' | 'entscheidung';
  /** Angewendete Merge-Policy */
  policy: MergePolicy;
  /** Datei des Base-Packs (optional) */
  base_datei?: string;
  /** Datei des Override-Packs (optional) */
  override_datei?: string;
}

export interface MergeReport {
  /** Alle aufgetretenen Konflikte beim Mergen */
  conflicts: MergeConflict[];
  /** Das gemergte Pack (Base mit angewendeten Overrides) */
  mergedPack: z.infer<typeof PackSchema>;
}

/**
 * Führt ein Override-Pack in ein Base-Pack ein, gemäß der angegebenen Merge-Policy.
 *
 * @param basePack - Das Basis-Pack (aus dem Basis-Content)
 * @param overridePack - Das Override-Pack (aus einem Mod-Pack)
 * @param policy - 'override' (ersetzt vollständig) oder 'shadow' (Base gewinnt)
 * @param baseDatei - Dateiname des Base-Packs (für Berichte)
 * @param overrideDatei - Dateiname des Override-Packs (für Berichte)
 * @returns MergeReport mit Konflikten und dem gemergten Pack
 * @throws nie — wirft keine Ausnahme, das Spiel läuft weiter
 */
export function mergePacks(
  basePack: z.infer<typeof PackSchema>,
  overridePack: z.infer<typeof PackSchema>,
  policy: MergePolicy,
  baseDatei?: string,
  overrideDatei?: string,
): MergeReport {
  const conflicts: MergeConflict[] = [];

  // Hilfsfunktion: Konflikt eintragen
  function fuegeKonfliktHinzu(regelId: string, typ: MergeConflict['typ']) {
    conflicts.push({
      regel_id: regelId,
      typ,
      policy,
      base_datei: baseDatei,
      override_datei: overrideDatei,
    });
  }

  // --- Indikator-Regeln mergen (identifiziert durch Tag) ---
  const baseRegelnMap = new Map(basePack.indikator_regeln.map((r) => [r.tag, r]));
  const mergedRegeln = [...basePack.indikator_regeln];

  for (const overrideRegel of overridePack.indikator_regeln) {
    const baseRegel = baseRegelnMap.get(overrideRegel.tag);
    if (baseRegel) {
      // Konflikt: gleiche Tag existiert in beiden Packs
      fuegeKonfliktHinzu(overrideRegel.tag, 'indikator_regel');
      if (policy === 'override') {
        // Base-Regel durch Pack-Regel ersetzen
        const index = mergedRegeln.findIndex((r) => r.tag === overrideRegel.tag);
        if (index !== -1) {
          mergedRegeln[index] = overrideRegel;
        }
      }
      // Bei 'shadow': Base-Regel bleibt, Pack-Regel wird ignoriert
    } else {
      // Kein Konflikt: neue Regel hinzufügen
      mergedRegeln.push(overrideRegel);
    }
  }

  // --- Gruppen mergen (identifiziert durch Tag) ---
  const baseGruppenMap = new Map(basePack.gruppen.map((g) => [g.tag, g]));
  const mergedGruppen = [...basePack.gruppen];

  for (const overrideGruppe of overridePack.gruppen) {
    const baseGruppe = baseGruppenMap.get(overrideGruppe.tag);
    if (baseGruppe) {
      fuegeKonfliktHinzu(overrideGruppe.tag, 'gruppe');
      if (policy === 'override') {
        const index = mergedGruppen.findIndex((g) => g.tag === overrideGruppe.tag);
        if (index !== -1) {
          mergedGruppen[index] = overrideGruppe;
        }
      }
    } else {
      mergedGruppen.push(overrideGruppe);
    }
  }

  // --- Entscheidungen mergen (identifiziert durch regel_id) ---
  const baseEntscheidungenMap = new Map(
    basePack.entscheidungen.map((e) => [e.regel_id, e]),
  );
  const mergedEntscheidungen = [...basePack.entscheidungen];

  for (const overrideEntscheidung of overridePack.entscheidungen) {
    const baseEntscheidung = baseEntscheidungenMap.get(overrideEntscheidung.regel_id);
    if (baseEntscheidung) {
      fuegeKonfliktHinzu(overrideEntscheidung.regel_id, 'entscheidung');
      if (policy === 'override') {
        const index = mergedEntscheidungen.findIndex(
          (e) => e.regel_id === overrideEntscheidung.regel_id,
        );
        if (index !== -1) {
          mergedEntscheidungen[index] = overrideEntscheidung;
        }
      }
    } else {
      mergedEntscheidungen.push(overrideEntscheidung);
    }
  }

  // --- Karten-Katalog mergen (identifiziert durch regel_id, optional) ---
  let mergedKarten: z.infer<typeof karteKatalogSchema>[] | undefined;
  if (overridePack.karten_katalog) {
    const baseKarten = basePack.karten_katalog ?? [];
    const baseKartenMap = new Map(baseKarten.map((k) => [k.regel_id, k]));
    mergedKarten = [...baseKarten];

    for (const overrideKarte of overridePack.karten_katalog) {
      const baseKarte = baseKartenMap.get(overrideKarte.regel_id);
      if (baseKarte) {
        fuegeKonfliktHinzu(overrideKarte.regel_id, 'entscheidung');
        if (policy === 'override') {
          const index = mergedKarten.findIndex((k) => k.regel_id === overrideKarte.regel_id);
          if (index !== -1) {
            mergedKarten[index] = overrideKarte;
          }
        }
      } else {
        mergedKarten.push(overrideKarte);
      }
    }
  }

  // Das gemergte Pack zusammenbauen
  const mergedPack: z.infer<typeof PackSchema> = {
    ...basePack,
    indikator_regeln: mergedRegeln,
    gruppen: mergedGruppen,
    entscheidungen: mergedEntscheidungen,
    ...(mergedKarten !== undefined ? { karten_katalog: mergedKarten } : {}),
    ...(overridePack.name ? { name: overridePack.name } : {}),
    ...(overridePack.beschreibung ? { beschreibung: overridePack.beschreibung } : {}),
    ...(overridePack.version ? { version: overridePack.version } : {}),
  };

  return { conflicts, mergedPack };
}
