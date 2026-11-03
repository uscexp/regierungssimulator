import { describe, expect, it, beforeEach } from 'vitest';

import { packManager } from '@staatslenker/loader';
import {
  balanceCheckFürPack,
  balanceCheckGegenAllePacks,
  formatiereBalanceReport,
  type BalanceReport,
} from './balance-harness.js';

const validesPackYaml = `
schema_version: "1"
name: Balance-Test-Pack
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
  - tag: gesundheit
    verschleiß: 2
    budget_wirkung: 0.7
    diminishing_at: 75
    diminishing_wirkung: 0.2
  - tag: wirtschaft
    verschleiß: 2
    budget_wirkung: 0.4
    diminishing_at: 80
    diminishing_wirkung: 0.15
  - tag: forschung
    verschleiß: 2
    budget_wirkung: 0.5
    diminishing_at: 85
    diminishing_wirkung: 0.2
    gate:
      indikator: bildung
      min: 50
gruppen:
  - tag: arbeitnehmer
    zufriedenheit: 50
    bevölkerungsanteil: 25
    gewichte:
      infrastruktur: 0.3
      bildung: 0.3
      gesundheit: 0.2
      wirtschaft: 0.2
entscheidungen:
  - regel_id: entscheidung:test1
    label: Test 1
    beschreibung: Test
    cost:
      budget: 5
      politisches_kapital: 0
    effects:
      - ziel: indikatoren
        tag: infrastruktur
        delta: 1
`;

describe('US-M4-08: Balance-Harness gegen alle geladenen Packs', () => {
  beforeEach(() => {
    packManager.reset();
  });

  it('prüft ein einzelnes geladenes Pack als balanced', () => {
    const ergebnis = packManager.ladePack(validesPackYaml, 'balance-test.pack.yaml');

    expect(ergebnis.erfolgreich).toBe(true);

    const packErgebnis = balanceCheckFürPack(ergebnis.pack!);

    expect(packErgebnis.packName).toBe('Balance-Test-Pack');
    expect(packErgebnis.aktiv).toBe(false);
    expect(packErgebnis.balanced).toBe(true);
    expect(packErgebnis.grund).toBeUndefined();
  });

  it('gibt einen Report über alle aktiven Packs zurück', () => {
    packManager.ladePack(validesPackYaml, 'pack1.pack.yaml');
    packManager.aktivierePack('Balance-Test-Pack');

    const report = balanceCheckGegenAllePacks();

    expect(report.packs).toHaveLength(1);
    expect(report.packs[0].packName).toBe('Balance-Test-Pack');
    expect(report.alleBalanced).toBe(true);
  });

  it('gibt leeren Report wenn keine Packs geladen sind', () => {
    const report = balanceCheckGegenAllePacks();

    expect(report.packs).toHaveLength(0);
    expect(report.alleBalanced).toBe(true);
  });

  it('formatiert den Balance-Report als String', () => {
    packManager.ladePack(validesPackYaml, 'pack1.pack.yaml');
    packManager.aktivierePack('Balance-Test-Pack');

    const report = balanceCheckGegenAllePacks();
    const formatted = formatiereBalanceReport(report);

    expect(formatted).toContain('Balance-Harness gegen alle geladenen Packs');
    expect(formatted).toContain('Balance-Test-Pack');
    expect(formatted).toContain('balanced');
  });

  it('prägt das geladene Pack als unbalanced wenn es keine Indikatoren hat', () => {
    const packOhneIndikatoren = `
schema_version: "1"
name: Ohne-Indikatoren-Pack
indikator_regeln: []
gruppen:
  - tag: arbeitnehmer
    zufriedenheit: 50
    bevölkerungsanteil: 100
    gewichte: {}
entscheidungen: []
`;

    const ergebnis = packManager.ladePack(packOhneIndikatoren, 'ohne-indikatoren.pack.yaml');
    expect(ergebnis.erfolgreich).toBe(false); // min(1) für indikator_regeln
  });

  it('prüft ein Pack mit aktivem Status', () => {
    packManager.ladePack(validesPackYaml, 'aktiv-test.pack.yaml');
    packManager.aktivierePack('Balance-Test-Pack');

    const aktivePacks = packManager.aktivePacks();
    expect(aktivePacks).toHaveLength(1);
    expect(aktivePacks[0].aktiv).toBe(true);

    const report = balanceCheckGegenAllePacks();
    expect(report.packs[0].aktiv).toBe(true);
    expect(report.packs[0].balanced).toBe(true);
  });
});
