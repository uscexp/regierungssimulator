import { describe, expect, it } from 'vitest';

import { loadPack } from './index';

describe('US-M4-01: Pack-Validierung (schema_version)', () => {
  it('Pack ohne schema_version → "schema_version fehlt"', () => {
    const yamlInhalt = `
name: Beispiel-Pack
version: 1.0.0
beschreibung: Ein Test-Pack ohne schema_version
`;

    const ergebnis = loadPack(yamlInhalt, 'beispiel.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toBe('schema_version fehlt');
    expect(ergebnis.datei).toBe('beispiel.pack.yaml');
  });

  it('Pack mit unterstützter schema_version → geladen', () => {
    const yamlInhalt = `
schema_version: "1"
name: Beispiel-Pack
version: 1.0.0
beschreibung: Ein Test-Pack
`;

    const ergebnis = loadPack(yamlInhalt, 'beispiel.pack.yaml');

    if ('error' in ergebnis) {
      throw new Error(`Unerwarteter Fehler: ${ergebnis.error}`);
    }
    expect(ergebnis.pack.schema_version).toBe('1');
    expect(ergebnis.pack.name).toBe('Beispiel-Pack');
    expect(ergebnis.warnings).toEqual([]);
  });

  it('leeres YAML → "schema_version fehlt"', () => {
    const ergebnis = loadPack('');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toBe('schema_version fehlt');
  });

  it('YAML-Array statt Objekt → "schema_version fehlt"', () => {
    const ergebnis = loadPack('- item1\n- item2');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toBe('schema_version fehlt');
  });

  it('nicht unterstützte schema_version → Fehler', () => {
    const yamlInhalt = `
schema_version: "99"
name: Beispiel-Pack
`;

    const ergebnis = loadPack(yamlInhalt, 'test.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toBe('Nicht unterstützte schema_version');
  });
});
