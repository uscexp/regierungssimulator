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
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
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

describe('US-M4-02: Pack-Validierung (Schema-Versioning + Tag-Referenzen)', () => {
  const validesPack = `
schema_version: "1"
name: Test-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
  - tag: bildung
    verschleiß: 2
    budget_wirkung: 0.6
gruppen:
  - tag: arbeitnehmer
    zufriedenheit: 50
    bevölkerungsanteil: 60
    gewichte:
      infrastruktur: 0.4
      bildung: 0.6
entscheidungen:
  - regel_id: entscheidung:investition
    label: Investition
    beschreibung: Investiert in Infrastruktur
`;

  it('gültiges Pack mit Regeln, Gruppen und Entscheidungen → geladen', () => {
    const ergebnis = loadPack(validesPack, 'valides.pack.yaml');

    if ('error' in ergebnis) {
      throw new Error(`Unerwarteter Fehler: ${ergebnis.error}`);
    }
    expect(ergebnis.pack.name).toBe('Test-Pack');
    expect(ergebnis.pack.indikator_regeln).toHaveLength(2);
    expect(ergebnis.pack.gruppen).toHaveLength(1);
    expect(ergebnis.pack.entscheidungen).toHaveLength(1);
  });

  it('Pack mit ungültiger Regel (fehlendes verschleiß) → gesamtes Pack abgelehnt', () => {
    const yamlInhalt = `
schema_version: "1"
name: Ungültiges-Pack
indikator_regeln:
  - tag: infrastruktur
    budget_wirkung: 0.5
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
`;

    const ergebnis = loadPack(yamlInhalt, 'ungueltig.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toContain('expected number');
  });

  it('Pack mit ungültiger Regel (negativer Verschleiß) → gesamtes Pack abgelehnt', () => {
    const yamlInhalt = `
schema_version: "1"
name: Ungültiges-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: -1
    budget_wirkung: 0.5
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
`;

    const ergebnis = loadPack(yamlInhalt, 'ungueltig.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toContain('>=0');
  });

  it('Pack mit fehlenden indikator_regeln → Pack abgelehnt', () => {
    const yamlInhalt = `
schema_version: "1"
name: Ungültiges-Pack
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
`;

    const ergebnis = loadPack(yamlInhalt, 'ungueltig.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toContain('expected array');
  });

  it('Pack mit Dangling-Tag in karten_katalog (unbekannter Indikator) → Pack abgelehnt', () => {
    const yamlInhalt = `
schema_version: "1"
name: Dangling-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
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
karten_katalog:
  - regel_id: karte:unbekannt
    pk_kosten: 2
    wirkung:
      - ziel: indikatoren
        tag: nicht_existierender_indikator
        delta: 5
`;

    const ergebnis = loadPack(yamlInhalt, 'dangling.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toContain('Wirkungs-Tags');
  });

  it('Pack mit Dangling-Tag in karten_katalog (unbekannte Gruppe) → Pack abgelehnt', () => {
    const yamlInhalt = `
schema_version: "1"
name: Dangling-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
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
karten_katalog:
  - regel_id: karte:unbekannt
    pk_kosten: 2
    wirkung:
      - ziel: gruppen
        tag: nicht_existierende_gruppe
        delta: 5
`;

    const ergebnis = loadPack(yamlInhalt, 'dangling.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toContain('Wirkungs-Tags');
  });

  it('Pack mit gültigem karten_katalog (bekannte Indikator- und Gruppe-Tags) → geladen', () => {
    const yamlInhalt = `
schema_version: "1"
name: Gültiges-Karten-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
  - tag: bildung
    verschleiß: 2
    budget_wirkung: 0.6
gruppen:
  - tag: arbeitnehmer
    zufriedenheit: 50
    bevölkerungsanteil: 60
    gewichte:
      infrastruktur: 0.4
      bildung: 0.6
  - tag: landwirte
    zufriedenheit: 40
    bevölkerungsanteil: 40
    gewichte:
      infrastruktur: 0.7
      bildung: 0.3
entscheidungen:
  - regel_id: entscheidung:investition
    label: Investition
    beschreibung: Investiert in Infrastruktur
karten_katalog:
  - regel_id: karte:landwirte_forderung
    pk_kosten: 2
    wirkung:
      - ziel: gruppen
        tag: landwirte
        delta: 3
      - ziel: indikatoren
        tag: infrastruktur
        delta: 2
`;

    const ergebnis = loadPack(yamlInhalt, 'gueltig-karten.pack.yaml');

    if ('error' in ergebnis) {
      throw new Error(`Unerwarteter Fehler: ${ergebnis.error}`);
    }
    expect(ergebnis.pack.karten_katalog).toHaveLength(1);
    expect(ergebnis.pack.karten_katalog![0].wirkung).toHaveLength(2);
    expect(ergebnis.pack.gruppen.some((g) => g.tag === 'landwirte')).toBe(true);
  });

  it('Pack mit doppelten Indikator-Regel-Tags → Pack abgelehnt', () => {
    const yamlInhalt = `
schema_version: "1"
name: Duplikat-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
  - tag: infrastruktur
    verschleiß: 2
    budget_wirkung: 0.4
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
`;

    const ergebnis = loadPack(yamlInhalt, 'duplikat.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toContain('Indikator-Regel-Tags');
  });

  it('Pack mit doppelten Gruppen-Tags → Pack abgelehnt', () => {
    const yamlInhalt = `
schema_version: "1"
name: Duplikat-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
gruppen:
  - tag: arbeitnehmer
    zufriedenheit: 50
    bevölkerungsanteil: 50
    gewichte:
      infrastruktur: 1.0
  - tag: arbeitnehmer
    zufriedenheit: 30
    bevölkerungsanteil: 50
    gewichte:
      infrastruktur: 1.0
entscheidungen:
  - regel_id: entscheidung:test
    label: Test
    beschreibung: Test
`;

    const ergebnis = loadPack(yamlInhalt, 'duplikat.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toContain('Gruppen-Tags');
  });
});
