import { describe, expect, it } from 'vitest';

import { loadPack, mergePacks, type MergePolicy } from './index';

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
    expect(ergebnis.error).toContain('Nicht unterstützte schema_version');
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
    diminishing_at: 70
    diminishing_wirkung: 0.2
  - tag: bildung
    verschleiß: 2
    budget_wirkung: 0.6
    diminishing_at: 65
    diminishing_wirkung: 0.25
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

  it('Pack mit fehlendem verschleiß → gesamtes Pack abgelehnt', () => {
    const yamlInhalt = `
schema_version: "1"
name: Ungültiges-Pack
indikator_regeln:
  - tag: infrastruktur
    diminishing_at: 70
    diminishing_wirkung: 0.2
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
    diminishing_at: 70
    diminishing_wirkung: 0.2
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
    diminishing_at: 70
    diminishing_wirkung: 0.2
  - tag: bildung
    verschleiß: 2
    budget_wirkung: 0.6
    diminishing_at: 65
    diminishing_wirkung: 0.25
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
    diminishing_at: 70
    diminishing_wirkung: 0.2
  - tag: infrastruktur
    verschleiß: 2
    budget_wirkung: 0.4
    diminishing_at: 60
    diminishing_wirkung: 0.3
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
    diminishing_at: 70
    diminishing_wirkung: 0.2
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

describe('US-M4-03: Fehlerliste mit Datei/Zeile, Base-Pack unverändert', () => {
  const validesPack = `
schema_version: "1"
name: Test-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
    diminishing_at: 70
    diminishing_wirkung: 0.2
  - tag: bildung
    verschleiß: 2
    budget_wirkung: 0.6
    diminishing_at: 65
    diminishing_wirkung: 0.25
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

  it('YAML-Parsefehler meldet Zeilennummer', () => {
    // Ungültiges YAML: fehlender Doppelpunkt nach einem Key
    const yamlInhalt = `
schema_version: "1"
name: Test-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß 3
    budget_wirkung: 0.5
`;

    const ergebnis = loadPack(yamlInhalt, 'fehlerhaft.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toContain('YAML-Parsefehler');
    expect(ergebnis.datei).toBe('fehlerhaft.pack.yaml');
    // Zeilennummer sollte gesetzt sein (js-yaml liefert mark.line)
    expect(typeof ergebnis.zeile).toBe('number');
    expect(ergebnis.zeile).toBeGreaterThan(0);
  });

  it('Ungültige Regel: Datei und Zeile werden gemeldet, Pack abgelehnt', () => {
    const yamlInhalt = `
schema_version: "1"
name: Ungültiges-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: -1
    diminishing_at: 70
    diminishing_wirkung: 0.2
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
    expect(ergebnis.datei).toBe('ungueltig.pack.yaml');
  });

  it('Fehlende indikator_regeln: Datei wird gemeldet', () => {
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

    const ergebnis = loadPack(yamlInhalt, 'fehlend.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toContain('expected array');
    expect(ergebnis.datei).toBe('fehlend.pack.yaml');
  });

  it('Spiel läuft weiter: loadPack wirft keine Ausnahme', () => {
    // Auch bei völlig kaputtem YAML wird keine Exception geworfen
    const kaputtesYaml = 'das: ist: kein: gültiges: yaml: :::::';

    // Soll nicht werfen
    const ergebnis = loadPack(kaputtesYaml, 'kaputt.pack.yaml');

    // Entweder Fehler oder Erfolg, aber niemals eine geworfene Exception
    expect(ergebnis).toBeDefined();
    if ('pack' in ergebnis) {
      // Falls es doch geladen wird, ist es ein gültiges Pack
      expect(ergebnis.pack.name).toBeDefined();
    } else {
      expect(ergebnis.error).toBeDefined();
      expect(ergebnis.datei).toBe('kaputt.pack.yaml');
    }
  });

  it('Base-Pack bleibt unverändert: loadPack gibt nur Fehler zurück, keine Seitenwirkungen', () => {
    // Ein ungültiges Pack darf keinen globalen Zustand verändern
    const vorherigerZustand = { geladen: false };

    const ungültigesYaml = `
schema_version: "1"
name: Böse-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: -999
    diminishing_at: 70
    diminishing_wirkung: 0.2
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

    const ergebnis = loadPack(ungültigesYaml, 'boese.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toContain('>=0');

    // Der lokale Zustand darf sich nicht geändert haben
    expect(vorherigerZustand.geladen).toBe(false);

    // Ein nachfolgendes gültiges Pack muss noch funktionieren
    const valideErgebnis = loadPack(validesPack, 'valide.pack.yaml');
    if ('error' in valideErgebnis) {
      throw new Error(`Unerwarteter Fehler: ${valideErgebnis.error}`);
    }
    expect(valideErgebnis.pack.name).toBe('Test-Pack');
  });
});

describe('US-M4-04: Merge-Policy Override vs. Shadow (FR-034)', () => {
  const basePack = {
    schema_version: '1' as const,
    name: 'Base-Pack',
    indikator_regeln: [
      { tag: 'infrastruktur', verschleiß: 3, budget_wirkung: 0.5, diminishing_at: 70, diminishing_wirkung: 0.2 },
      { tag: 'bildung', verschleiß: 2, budget_wirkung: 0.6, diminishing_at: 65, diminishing_wirkung: 0.25 },
    ],
    gruppen: [
      {
        tag: 'arbeitnehmer',
        zufriedenheit: 50,
        bevölkerungsanteil: 60,
        gewichte: { infrastruktur: 0.4, bildung: 0.6 },
      },
    ],
    entscheidungen: [
      {
        regel_id: 'entscheidung:investition',
        label: 'Investition',
        beschreibung: 'Investiert in Infrastruktur',
      },
    ],
  };

  const overridePackOverride = {
    schema_version: '1' as const,
    name: 'Override-Pack',
    indikator_regeln: [
      { tag: 'infrastruktur', verschleiß: 5, budget_wirkung: 0.8, diminishing_at: 80, diminishing_wirkung: 0.15 },
      { tag: 'gesundheit', verschleiß: 2, budget_wirkung: 0.7, diminishing_at: 75, diminishing_wirkung: 0.2 },
    ],
    gruppen: [
      {
        tag: 'arbeitnehmer',
        zufriedenheit: 30,
        bevölkerungsanteil: 40,
        gewichte: { infrastruktur: 0.7, bildung: 0.3 }, // ersetzt Base komplett
      },
      {
        tag: 'landwirte',
        zufriedenheit: 40,
        bevölkerungsanteil: 40,
        gewichte: { infrastruktur: 0.7, bildung: 0.3 }, // neue Gruppe
      },
    ],
    entscheidungen: [
      {
        regel_id: 'entscheidung:investition', // ersetzt Base komplett
        label: 'Infrastruktur-Investition',
        beschreibung: 'Investiert stark in Infrastruktur',
      },
      {
        regel_id: 'entscheidung:reform', // neue Entscheidung
        label: 'Reform',
        beschreibung: 'Eine neue Reform',
      },
    ],
  };

  const overridePackShadow = {
    schema_version: '1' as const,
    name: 'Shadow-Pack',
    indikator_regeln: [
      { tag: 'infrastruktur', verschleiß: 99, budget_wirkung: 0.99, diminishing_at: 99, diminishing_wirkung: 0.99 },
      { tag: 'gesundheit', verschleiß: 2, budget_wirkung: 0.7, diminishing_at: 75, diminishing_wirkung: 0.2 },
    ],
    gruppen: [
      {
        tag: 'arbeitnehmer',
        zufriedenheit: 99,
        bevölkerungsanteil: 99,
        gewichte: { infrastruktur: 0.99, bildung: 0.01 }, // wird ignoriert (Shadow)
      },
      {
        tag: 'landwirte',
        zufriedenheit: 40,
        bevölkerungsanteil: 40,
        gewichte: { infrastruktur: 0.7, bildung: 0.3 }, // neue Gruppe
      },
    ],
    entscheidungen: [
      {
        regel_id: 'entscheidung:investition', // wird ignoriert (Shadow)
        label: 'Ignoriert',
        beschreibung: 'Wird nicht angewendet',
      },
      {
        regel_id: 'entscheidung:reform', // neue Entscheidung
        label: 'Reform',
        beschreibung: 'Eine neue Reform',
      },
    ],
  };

  it('Override-Policy: Base-Regel wird vollständig ersetzt', () => {
    const report = mergePacks(
      basePack,
      overridePackOverride,
      'override',
      'base.pack.yaml',
      'override.pack.yaml',
    );

    // Konflikte werden erkannt
    expect(report.conflicts).toHaveLength(3); // infrastruktur, arbeitnehmer, entscheidung:investition
    expect(report.conflicts.map((c) => c.regel_id)).toContain('infrastruktur');
    expect(report.conflicts.map((c) => c.regel_id)).toContain('arbeitnehmer');
    expect(report.conflicts.map((c) => c.regel_id)).toContain('entscheidung:investition');
    expect(report.conflicts.every((c) => c.policy === 'override')).toBe(true);
    expect(report.conflicts.every((c) => c.typ === 'indikator_regel' || c.typ === 'gruppe' || c.typ === 'entscheidung')).toBe(true);

    // Gemergtes Pack: Base-Regeln werden durch Override ersetzt
    const infraRegel = report.mergedPack.indikator_regeln.find((r) => r.tag === 'infrastruktur');
    expect(infraRegel).toBeDefined();
    expect(infraRegel?.verschleiß).toBe(5); // aus Override
    expect(infraRegel?.budget_wirkung).toBe(0.8); // aus Override

    const arbeitnehmerGruppe = report.mergedPack.gruppen.find((g) => g.tag === 'arbeitnehmer');
    expect(arbeitnehmerGruppe?.zufriedenheit).toBe(30); // aus Override
    expect(arbeitnehmerGruppe?.bevölkerungsanteil).toBe(40); // aus Override

    const investition = report.mergedPack.entscheidungen.find((e) => e.regel_id === 'entscheidung:investition');
    expect(investition?.label).toBe('Infrastruktur-Investition'); // aus Override

    // Neue Regeln aus Override sind hinzugefügt
    expect(report.mergedPack.indikator_regeln.some((r) => r.tag === 'gesundheit')).toBe(true);
    expect(report.mergedPack.gruppen.some((g) => g.tag === 'landwirte')).toBe(true);
    expect(report.mergedPack.entscheidungen.some((e) => e.regel_id === 'entscheidung:reform')).toBe(true);
  });

  it('Shadow-Policy: Base-Regel bleibt, Pack-Regel wird ignoriert', () => {
    const report = mergePacks(
      basePack,
      overridePackShadow,
      'shadow',
      'base.pack.yaml',
      'shadow.pack.yaml',
    );

    // Konflikte werden erkannt
    expect(report.conflicts).toHaveLength(3); // infrastruktur, arbeitnehmer, entscheidung:investition
    expect(report.conflicts.every((c) => c.policy === 'shadow')).toBe(true);

    // Gemergtes Pack: Base-Regeln bleiben erhalten
    const infraRegel = report.mergedPack.indikator_regeln.find((r) => r.tag === 'infrastruktur');
    expect(infraRegel?.verschleiß).toBe(3); // aus Base (nicht ersetzt)
    expect(infraRegel?.budget_wirkung).toBe(0.5); // aus Base

    const arbeitnehmerGruppe = report.mergedPack.gruppen.find((g) => g.tag === 'arbeitnehmer');
    expect(arbeitnehmerGruppe?.zufriedenheit).toBe(50); // aus Base
    expect(arbeitnehmerGruppe?.bevölkerungsanteil).toBe(60); // aus Base

    const investition = report.mergedPack.entscheidungen.find((e) => e.regel_id === 'entscheidung:investition');
    expect(investition?.label).toBe('Investition'); // aus Base

    // Neue Regeln aus Override sind trotzdem hinzugefügt (kein Konflikt)
    expect(report.mergedPack.indikator_regeln.some((r) => r.tag === 'gesundheit')).toBe(true);
    expect(report.mergedPack.gruppen.some((g) => g.tag === 'landwirte')).toBe(true);
    expect(report.mergedPack.entscheidungen.some((e) => e.regel_id === 'entscheidung:reform')).toBe(true);
  });

  it('Ohne Konflikte: Merge-Report ist leer', () => {
    const keinKonfliktPack = {
      schema_version: '1' as const,
      name: 'Kein-Konflikt-Pack',
      indikator_regeln: [
        { tag: 'gesundheit', verschleiß: 2, budget_wirkung: 0.7, diminishing_at: 75, diminishing_wirkung: 0.2 },
      ],
      gruppen: [],
      entscheidungen: [],
    };

    const report = mergePacks(basePack, keinKonfliktPack, 'override');

    expect(report.conflicts).toHaveLength(0);
    expect(report.mergedPack.indikator_regeln).toHaveLength(3); // 2 Base + 1 neu
  });

  it('Merge-Report enthält Datei-Informationen', () => {
    const report = mergePacks(
      basePack,
      overridePackOverride,
      'override',
      'base.pack.yaml',
      'override.pack.yaml',
    );

    expect(report.conflicts.every((c) => c.base_datei === 'base.pack.yaml')).toBe(true);
    expect(report.conflicts.every((c) => c.override_datei === 'override.pack.yaml')).toBe(true);
  });

  it('Merge-Report enthält korrekte Typen für jede Konfliktkategorie', () => {
    const report = mergePacks(
      basePack,
      overridePackOverride,
      'override',
    );

    const indikatorKonflikte = report.conflicts.filter((c) => c.typ === 'indikator_regel');
    const gruppeKonflikte = report.conflicts.filter((c) => c.typ === 'gruppe');
    const entscheidungKonflikte = report.conflicts.filter((c) => c.typ === 'entscheidung');

    expect(indikatorKonflikte.length).toBe(1);
    expect(indikatorKonflikte[0].regel_id).toBe('infrastruktur');

    expect(gruppeKonflikte.length).toBe(1);
    expect(gruppeKonflikte[0].regel_id).toBe('arbeitnehmer');

    expect(entscheidungKonflikte.length).toBe(1);
    expect(entscheidungKonflikte[0].regel_id).toBe('entscheidung:investition');
  });

  it('Merge mit leeren Override-Arrays: keine Konflikte, Base bleibt unverändert', () => {
    const leererOverride = {
      schema_version: '1' as const,
      name: 'Leerer-Override',
      indikator_regeln: [],
      gruppen: [],
      entscheidungen: [],
    };

    const report = mergePacks(basePack, leererOverride, 'override');

    expect(report.conflicts).toHaveLength(0);
    expect(report.mergedPack.indikator_regeln).toEqual(basePack.indikator_regeln);
    expect(report.mergedPack.gruppen).toEqual(basePack.gruppen);
    expect(report.mergedPack.entscheidungen).toEqual(basePack.entscheidungen);
  });
});

describe('US-M4-05: diminishing_at als Pflichtfeld im Schema (FR-034)', () => {
  const basisPackOhneDiminishing = `
schema_version: "1"
name: Test-Pack
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

  const basisPackMitDiminishing = `
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
`;

  it('Pack ohne diminishing_at → Pack abgelehnt', () => {
    const ergebnis = loadPack(basisPackOhneDiminishing, 'ohne-diminishing.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toContain('diminishing_at');
    expect(ergebnis.datei).toBe('ohne-diminishing.pack.yaml');
  });

  it('Pack mit diminishing_at aber ohne diminishing_wirkung → Pack abgelehnt', () => {
    const yamlInhalt = `
schema_version: "1"
name: Test-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
    diminishing_at: 70
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

    const ergebnis = loadPack(yamlInhalt, 'ohne-diminishing-wirkung.pack.yaml');

    if ('pack' in ergebnis) {
      throw new Error('Erwarteter Fehler wurde nicht zurückgegeben');
    }
    expect(ergebnis.error).toContain('diminishing_wirkung');
  });

  it('Pack mit diminishing_at und diminishing_wirkung → geladen', () => {
    const ergebnis = loadPack(basisPackMitDiminishing, 'mit-diminishing.pack.yaml');

    if ('error' in ergebnis) {
      throw new Error(`Unerwarteter Fehler: ${ergebnis.error}`);
    }
    expect(ergebnis.pack.name).toBe('Test-Pack');
    expect(ergebnis.pack.indikator_regeln[0].diminishing_at).toBe(70);
    expect(ergebnis.pack.indikator_regeln[0].diminishing_wirkung).toBe(0.2);
  });

  it('Pack mit diminishing_at=0 und diminishing_wirkung=0 → geladen (valide Grenzwerte)', () => {
    const yamlInhalt = `
schema_version: "1"
name: Test-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
    diminishing_at: 0
    diminishing_wirkung: 0
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

    const ergebnis = loadPack(yamlInhalt, 'grenzwerte.pack.yaml');

    if ('error' in ergebnis) {
      throw new Error(`Unerwarteter Fehler: ${ergebnis.error}`);
    }
    expect(ergebnis.pack.name).toBe('Test-Pack');
  });
});
