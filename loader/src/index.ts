/**
 * @staatslenker/loader — YAML-Pack-Loader (M4).
 *
 * Ein Expansion-Pack = Dateien, kein Code. Validierung ist atomisch: das ganze Pack
 * wird gegen das Zod-Schema geprüft, bevor es angewendet wird; ein kaputtes Pack
 * crasht das Spiel nie (ADR-003, architektur.md §5).
 *
 * US-M4-01: Pack ohne `schema_version` wird mit „schema_version fehlt“ abgewiesen;
 * Pack mit unterstützter Version wird geladen.
 */

import * as yaml from 'js-yaml';
import { z } from 'zod';

export const PACK_SCHEMA_VERSIONS = ['1'] as const;
export type PackSchemaVersion = typeof PACK_SCHEMA_VERSIONS[number];

export const PackSchema = z.object({
  schema_version: z.string().refine(
    (v) => PACK_SCHEMA_VERSIONS.includes(v as PackSchemaVersion),
    { message: 'Nicht unterstützte schema_version' },
  ),
  name: z.string().min(1, { message: 'name ist erforderlich' }),
  version: z.string().optional(),
  beschreibung: z.string().optional(),
});

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
 * Lädt ein YAML-Pack und validiert es atomisch.
 * Bei `schema_version` fehlt → Fehler "schema_version fehlt".
 * Bei nicht unterstützter Version → Fehler "Nicht unterstützte schema_version".
 * Bei gültigem Pack → PackData zurück.
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
      return { error: firstError?.message ?? 'Validierungsfehler', datei };
    }

    return { pack: result.data, warnings: [] };
  } catch (e) {
    return {
      error: `YAML-Parsefehler: ${e instanceof Error ? e.message : String(e)}`,
      datei,
    };
  }
}
