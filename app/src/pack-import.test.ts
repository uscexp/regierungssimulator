import { describe, expect, it, beforeEach } from 'vitest';

import { packManager } from '@staatslenker/loader';
import { importierePackAusYamlString, type PackImportResult } from './main.js';

const validesPackYaml = `
schema_version: "1"
name: Test-Import-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
    diminishing_at: 70
    diminishing_wirkung: 0.2
gruppen:
  - tag: arbeitnehmer
    zufriedenheit: 50
    bevölkerungsanteil: 100
    gewichte:
      infrastruktur: 1.0
entscheidungen:
  - regel_id: entscheidung:test
    label: Test
    beschreibung: Test
    cost:
      budget: 1
      politisches_kapital: 1
    effects:
      - ziel: indikatoren
        tag: infrastruktur
        delta: 1
`;

describe('US-M4-10: Web-UI Pack-Import (Drag & Drop)', () => {
  beforeEach(() => {
    packManager.reset();
  });

  it('importiert ein gültiges Pack erfolgreich', () => {
    const ergebnis = importierePackAusYamlString(validesPackYaml, 'test.pack.yaml');

    expect(ergebnis.erfolgreich).toBe(true);
    expect(ergebnis.packName).toBe('Test-Import-Pack');
    expect(ergebnis.meldung).toContain('erfolgreich geladen');
  });

  it('lehnt ein Pack ohne schema_version ab', () => {
    const kaputtesYaml = `
name: Test
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
    diminishing_at: 70
    diminishing_wirkung: 0.2
`;

    const ergebnis = importierePackAusYamlString(kaputtesYaml, 'kaputt.pack.yaml');

    expect(ergebnis.erfolgreich).toBe(false);
    expect(ergebnis.meldung).toContain('schema_version fehlt');
  });

  it('lehnt ein Pack ohne diminishing_at ab (US-M4-05)', () => {
    const kaputtesYaml = `
schema_version: "1"
name: Test
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
`;

    const ergebnis = importierePackAusYamlString(kaputtesYaml, 'kaputt.pack.yaml');

    expect(ergebnis.erfolgreich).toBe(false);
    expect(ergebnis.meldung).toContain('diminishing_at');
  });

  it('lehnt ein Pack mit doppelter Indikator-Regel ab', () => {
    const duplikatYaml = `
schema_version: "1"
name: Test
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
    diminishing_at: 70
    diminishing_wirkung: 0.2
  - tag: infrastruktur
    verschleiß: 1
    budget_wirkung: 0.1
    diminishing_at: 50
    diminishing_wirkung: 0.1
gruppen:
  - tag: arbeitnehmer
    zufriedenheit: 50
    bevölkerungsanteil: 100
    gewichte:
      infrastruktur: 1.0
entscheidungen:
  - regel_id: entscheidung:test
    label: Test
    beschreibung: Test
    cost:
      budget: 1
      politisches_kapital: 1
    effects:
      - ziel: indikatoren
        tag: infrastruktur
        delta: 1
`;

    const ergebnis = importierePackAusYamlString(duplikatYaml, 'doppel.pack.yaml');

    expect(ergebnis.erfolgreich).toBe(false);
    expect(ergebnis.meldung).toContain('eindeutig');
  });

  it('registriert das importierte Pack im packManager als inaktiv', () => {
    importierePackAusYamlString(validesPackYaml, 'test.pack.yaml');

    const pakete = packManager.listePacks();
    expect(pakete).toHaveLength(1);
    expect(pakete[0].name).toBe('Test-Import-Pack');
    expect(pakete[0].aktiv).toBe(false);
  });

  it('lehnt doppelten Pack-Namen ab', () => {
    importierePackAusYamlString(validesPackYaml, 'test1.pack.yaml');

    const ergebnis = importierePackAusYamlString(validesPackYaml, 'test2.pack.yaml');

    expect(ergebnis.erfolgreich).toBe(false);
    expect(ergebnis.meldung).toContain('bereits geladen');
  });
});
