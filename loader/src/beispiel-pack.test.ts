import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadPack } from './index';

describe('US-M4-06: Beispiel-Pack mit neuer Gruppe und Entscheidung', () => {
  const yamlInhalt = readFileSync(new URL('./beispiel-pack.pack.yaml', import.meta.url), 'utf-8');

  it('lädt das Beispiel-Pack erfolgreich (schema_version, name, indikator_regeln, gruppen, entschl)', () => {
    const ergebnis = loadPack(yamlInhalt, 'beispiel-pack.pack.yaml');

    if ('error' in ergebnis) {
      throw new Error(`Unerwarteter Fehler: ${ergebnis.error}`);
    }
    expect(ergebnis.pack.schema_version).toBe('1');
    expect(ergebnis.pack.name).toBe('Beispiel-Pack');
    expect(ergebnis.pack.version).toBe('1.0.0');
    expect(ergebnis.pack.indikator_regeln).toHaveLength(2);
    expect(ergebnis.pack.gruppen).toHaveLength(1);
    expect(ergebnis.pack.entscheidungen).toHaveLength(1);
  });

  it('enthält die neue Gruppe Rentner mit korrekten Werten', () => {
    const ergebnis = loadPack(yamlInhalt, 'beispiel-pack.pack.yaml');

    if ('error' in ergebnis) {
      throw new Error(`Unerwarteter Fehler: ${ergebnis.error}`);
    }
    const rentner = ergebnis.pack.gruppen.find((g) => g.tag === 'rentner');
    expect(rentner).toBeDefined();
    expect(rentner?.zufriedenheit).toBe(40);
    expect(rentner?.bevölkerungsanteil).toBe(15.0);
    expect(rentner?.gewichte).toEqual({ gesundheit: 0.6, sicherheit: 0.4 });
  });

  it('enthält die neue Entscheidung Rentenerhöhung mit korrekten Werten', () => {
    const ergebnis = loadPack(yamlInhalt, 'beispiel-pack.pack.yaml');

    if ('error' in ergebnis) {
      throw new Error(`Unerwarteter Fehler: ${ergebnis.error}`);
    }
    const entscheidung = ergebnis.pack.entscheidungen.find((e) => e.regel_id === 'entscheidung:rentner_rente');
    expect(entscheidung).toBeDefined();
    expect(entscheidung.label).toBe('Rentenerhöhung');
    expect(entscheidung.beschreibung).toBe('Erhöht die Rente und steigert die Zufriedenheit der Rentner');
    expect(entscheidung.cost).toEqual({ budget: 8, politisches_kapital: 2 });
    expect(entscheidung.effects).toEqual([
      { ziel: 'gruppen', tag: 'rentner', delta: 5 },
      { ziel: 'legitimitaet', delta: 1 },
    ]);
  });

  it('enthält korrekte Indikator-Regeln mit diminishing_at und diminishing_wirkung', () => {
    const ergebnis = loadPack(yamlInhalt, 'beispiel-pack.pack.yaml');

    if ('error' in ergebnis) {
      throw new Error(`Unerwarteter Fehler: ${ergebnis.error}`);
    }
    const gesundheit = ergebnis.pack.indikator_regeln.find((r) => r.tag === 'gesundheit');
    expect(gesundheit).toBeDefined();
    expect(gesundheit.verschleiß).toBe(2);
    expect(gesundheit.budget_wirkung).toBe(0.7);
    expect(gesundheit.diminishing_at).toBe(75);
    expect(gesundheit.diminishing_wirkung).toBe(0.2);

    const sicherheit = ergebnis.pack.indikator_regeln.find((r) => r.tag === 'sicherheit');
    expect(sicherheit).toBeDefined();
    expect(sicherheit.verschleiß).toBe(2);
    expect(sicherheit.budget_wirkung).toBe(0);
    expect(sicherheit.diminishing_at).toBe(100);
    expect(sicherheit.diminishing_wirkung).toBe(0);
  });
});
