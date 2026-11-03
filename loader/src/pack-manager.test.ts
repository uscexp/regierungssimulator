import { describe, expect, it, beforeEach } from 'vitest';

import { packManager, type PackManagerErgebnis } from './pack-manager';
import { loadPack } from './index';

const validesPackYaml = `
schema_version: "1"
name: Test-Pack
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

describe('US-M4-07: Pack-Management (Loader)', () => {
  beforeEach(() => {
    packManager.reset();
  });
  it('lädt ein Pack und setzt es auf inaktiv', () => {
    const ergebnis = packManager.ladePack(validesPackYaml, 'test.pack.yaml');

    if (!ergebnis.erfolgreich) {
      throw new Error(`Unerwarteter Fehler: ${ergebnis.meldung}`);
    }
    expect(ergebnis.pack).toBeDefined();
    expect(ergebnis.pack?.name).toBe('Test-Pack');
    expect(ergebnis.pack?.aktiv).toBe(false);
  });

  it('lädt ein ungültiges Pack und meldet einen Fehler', () => {
    const gueltigesYaml = `
schema_version: "1"
name: Test
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
    // Erst ein gültiges Pack laden, dann ein ungültiges
    packManager.ladePack(gueltigesYaml, 'gut.pack.yaml');

    const kaputtesYaml = '{[ invalid yaml ::::';
    const ergebnis = packManager.ladePack(kaputtesYaml, 'kaputt.pack.yaml');

    expect(ergebnis.erfolgreich).toBe(false);
    expect(ergebnis.meldung).toContain('YAML-Parsefehler');
  });

  it('aktiviert ein geladenes Pack', () => {
    packManager.ladePack(validesPackYaml, 'test.pack.yaml');

    const ergebnis = packManager.aktivierePack('Test-Pack');

    expect(ergebnis.erfolgreich).toBe(true);
    expect(ergebnis.meldung).toBe('Pack "Test-Pack" aktiviert.');
    const paket = ergebnis.pack;
    expect(paket).toBeDefined();
    expect(paket?.aktiv).toBe(true);
  });

  it('deaktiviert ein geladenes Pack', () => {
    packManager.ladePack(validesPackYaml, 'test.pack.yaml');
    packManager.aktivierePack('Test-Pack');

    const ergebnis = packManager.deaktivierePack('Test-Pack');

    expect(ergebnis.erfolgreich).toBe(true);
    expect(ergebnis.meldung).toBe('Pack "Test-Pack" deaktiviert.');
    const paket = ergebnis.pack;
    expect(paket).toBeDefined();
    expect(paket?.aktiv).toBe(false);
  });

  it('listet alle Packs mit Status', () => {
    packManager.ladePack(validesPackYaml, 'test.pack.yaml');

    const pakete = packManager.listePacks();

    expect(pakete).toHaveLength(1);
    expect(pakete[0].name).toBe('Test-Pack');
    expect(pakete[0].aktiv).toBe(false);
    expect(pakete[0].datei).toBe('test.pack.yaml');
  });

  it('gibt nur aktive Pakete zurück', () => {
    packManager.ladePack(validesPackYaml, 'test.pack.yaml');
    packManager.aktivierePack('Test-Pack');

    const aktive = packManager.aktivePacks();

    expect(aktive).toHaveLength(1);
    expect(aktive[0].name).toBe('Test-Pack');
  });

  it('gibt die Anzahl der Pakete zurück', () => {
    packManager.ladePack(validesPackYaml, 'test.pack.yaml');

    expect(packManager.anzahlPacks()).toBe(1);
    expect(packManager.anzahlAktivePacks()).toBe(0);

    packManager.aktivierePack('Test-Pack');
    expect(packManager.anzahlAktivePacks()).toBe(1);
  });

  it('lehnt doppelten Pack-Namen ab', () => {
    packManager.ladePack(validesPackYaml, 'test1.pack.yaml');

    const ergebnis = packManager.ladePack(validesPackYaml, 'test2.pack.yaml');

    expect(ergebnis.erfolgreich).toBe(false);
    expect(ergebnis.meldung).toContain('bereits geladen');
  });

  it('lehnt Aktivierung unbekannten Packs ab', () => {
    const ergebnis = packManager.aktivierePack('nicht-vorhanden');

    expect(ergebnis.erfolgreich).toBe(false);
    expect(ergebnis.meldung).toContain('nicht gefunden');
  });

  it('lehnt Deaktivierung unbekannten Packs ab', () => {
    const ergebnis = packManager.deaktivierePack('nicht-vorhanden');

    expect(ergebnis.erfolgreich).toBe(false);
    expect(ergebnis.meldung).toContain('nicht gefunden');
  });
});
