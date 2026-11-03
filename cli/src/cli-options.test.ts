/**
 * CLI-Flag-Tests (US-M0-14): der Boot-Report nennt Kern und Turn-Runner, die Flags haben für jede
 * ungültige Eingabe einen Grund — der Einstieg fällt nie still auf Defaults zurück.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';

import {
  STANDARD_SEED,
  STANDARD_JAHRE,
  boot,
  main,
  optionsAusArgs,
  packOperation,
} from '@staatslenker/cli/cli-options';
import { packManager } from '@staatslenker/loader';

describe('Flag-Parsing', () => {
  it('hat die Standardwerte des CI-Boots', () => {
    const parsed = optionsAusArgs([]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.optionen.seed).toBe(STANDARD_SEED);
      expect(parsed.optionen.schwierigkeit).toBe('normal');
      expect(parsed.optionen.jahre).toBe(STANDARD_JAHRE);
      expect(parsed.optionen.demo).toBe(false);
    }
  });

  it('nimmt seed, Schwierigkeit, Jahre und demo', () => {
    const parsed = optionsAusArgs([
      '--seed',
      '42',
      '--schwierigkeit',
      'schwer',
      '--jahre',
      '3',
      '--demo',
    ]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.optionen).toEqual({
        seed: 42,
        schwierigkeit: 'schwer',
        jahre: 3,
        demo: true,
        packList: false,
        packEnable: undefined,
        packDisable: undefined,
        packLoad: undefined,
        packBalance: false,
      });
    }
  });

  it('lehnt eine unbekannte Flag und kapute Werte ab — mit Grund', () => {
    expect(optionsAusArgs(['--ui']).ok).toBe(false);
    if (!optionsAusArgs(['--ui']).ok) {
      expect((optionsAusArgs(['--ui']) as { grund: string }).grund).toContain(
        'Unbekannte Flag "--ui"',
      );
    }
    expect(optionsAusArgs(['--seed', 'x']).ok).toBe(false);
    expect(optionsAusArgs(['--schwierigkeit', 'mittel']).ok).toBe(false);
    expect(optionsAusArgs(['--jahre', '0']).ok).toBe(false);
    expect(optionsAusArgs(['--jahre']).ok).toBe(false);
  });
});

describe('Boot-Report', () => {
  it('meldet den geladenen Kern und den Turn-Runner', () => {
    const report = boot({
      seed: 1234,
      schwierigkeit: 'normal',
      jahre: 6,
      demo: true,
      packList: false,
      packEnable: undefined,
      packDisable: undefined,
      packLoad: undefined,
    });
    expect(report).toContain('Kern geladen: ja');
    expect(report).toContain('Turn-Runner: ja');
    expect(report).toContain('Schwierigkeit normal');
    expect(report).toContain('Seed 1234');
  });
});

describe('Einstieg (Exit-Code)', () => {
  it('gibt 1 für ungültige Flags und 0 für eine gespielte Demonstration', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(await main(['--schwierigkeit', 'mittel'])).toBe(1);
      expect(log.mock.calls[0]?.[0]).toContain('CLI:');
      expect(await main(['--demo', '--jahre', '2'])).toBe(0);
    } finally {
      log.mockRestore();
    }
  });
});

describe('US-M4-07: Pack-Management (CLI)', () => {
  beforeEach(() => {
    packManager.reset();
  });

  it('listet keine Packs, wenn keine geladen sind', () => {
    const ergebnis = packOperation({
      seed: 1234,
      schwierigkeit: 'normal',
      jahre: 6,
      demo: false,
      packList: true,
      packEnable: undefined,
      packDisable: undefined,
      packLoad: undefined,
    } as any);

    expect(ergebnis.durchgefuehrt).toBe(true);
    expect(ergebnis.meldung).toBe('Keine Packs geladen.');
  });

  it('listet geladene Packs', () => {
    const yamlInhalt = `
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
    packManager.ladePack(yamlInhalt, 'test.pack.yaml');

    const ergebnis = packOperation({
      seed: 1234,
      schwierigkeit: 'normal',
      jahre: 6,
      demo: false,
      packList: true,
      packEnable: undefined,
      packDisable: undefined,
      packLoad: undefined,
    } as any);

    expect(ergebnis.durchgefuehrt).toBe(true);
    expect(ergebnis.meldung).toContain('Test-Pack');
    expect(ergebnis.meldung).toContain('test.pack.yaml');
  });

  it('lädt ein Pack über die CLI', () => {
    const yamlInhalt = `
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
    // Datei erstellen, bevor wir sie laden
    writeFileSync('test-laden.pack.yaml', yamlInhalt);

    const ergebnis = packOperation({
      seed: 1234,
      schwierigkeit: 'normal',
      jahre: 6,
      demo: false,
      packList: false,
      packEnable: undefined,
      packDisable: undefined,
      packLoad: 'test-laden.pack.yaml',
    } as any);

    expect(ergebnis.durchgefuehrt).toBe(true);
    expect(ergebnis.meldung).toContain('geladen');
  });

  it('aktiviert ein Pack über die CLI', () => {
    packManager.ladePack(`
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
`, 'test.pack.yaml');

    const ergebnis = packOperation({
      seed: 1234,
      schwierigkeit: 'normal',
      jahre: 6,
      demo: false,
      packList: false,
      packEnable: 'Test-Pack',
      packDisable: undefined,
      packLoad: undefined,
    } as any);

    expect(ergebnis.durchgefuehrt).toBe(true);
    expect(ergebnis.meldung).toContain('aktiviert');
  });

  it('deaktiviert ein Pack über die CLI', () => {
    packManager.ladePack(`
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
`, 'test.pack.yaml');
    packManager.aktivierePack('Test-Pack');

    const ergebnis = packOperation({
      seed: 1234,
      schwierigkeit: 'normal',
      jahre: 6,
      demo: false,
      packList: false,
      packEnable: undefined,
      packDisable: 'Test-Pack',
      packLoad: undefined,
    } as any);

    expect(ergebnis.durchgefuehrt).toBe(true);
    expect(ergebnis.meldung).toContain('deaktiviert');
  });
});

