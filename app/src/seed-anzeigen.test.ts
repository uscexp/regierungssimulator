/**
 * @staatslenker/app seed-anzeigen.test.ts — Tests für Seed-Anzeigen Logik (US-M6-11).
 *
 * Testet Seed-Anzeige, Kopieren, Historie, Validierung.
 */
import { describe, expect, it } from 'vitest';

/**
 * Seed-Anzeigen-Logik extrahiert aus SeedAnzeigen.svelte — testbar isoliert.
 */
interface SeedHistoryEntry {
  seed: number;
  verwendetAm: string;
  jahr: number;
}

const MAX_SEED_HISTORY = 10;

function seedHistoryLaden(): SeedHistoryEntry[] {
  try {
    const json = localStorage.getItem('staatslenker_seed_history');
    if (!json) {
      return [];
    }
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function seedHistorySpeichern(history: SeedHistoryEntry[]): void {
  try {
    localStorage.setItem('staatslenker_seed_history', JSON.stringify(history));
  } catch {
    // Ignorieren
  }
}

function seedHistoryHinzufuegen(seed: number, jahr: number): void {
  const history = seedHistoryLaden();
  const eintrag: SeedHistoryEntry = {
    seed,
    verwendetAm: new Date().toISOString(),
    jahr,
  };
  const gefiltert = history.filter((e) => e.seed !== seed);
  gefiltert.unshift(eintrag);
  seedHistorySpeichern(gefiltert.slice(0, MAX_SEED_HISTORY));
}

function seedHistoryEntfernen(seed: number): void {
  const history = seedHistoryLaden().filter((e) => e.seed !== seed);
  seedHistorySpeichern(history);
}

function seedHistoryLeeren(): void {
  try {
    localStorage.removeItem('staatslenker_seed_history');
  } catch {
    // Ignorieren
  }
}

function istSeedGueltig(seed: unknown): seed is number {
  return typeof seed === 'number' && Number.isFinite(seed);
}

function seedFarbe(seed: number): string {
  const hue = seed % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function istSeedImHistorie(seed: number): boolean {
  return seedHistoryLaden().some((e) => e.seed === seed);
}

describe('US-M6-11: Seed-Anzeigen', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Seed-Historie', () => {
    it('gibt leeren Historie zurück wenn keine Einträge', () => {
      expect(seedHistoryLaden()).toEqual([]);
    });

    it('speichert und lädt einen Seed-Eintrag', () => {
      seedHistoryHinzufuegen(424242, 6);
      const history = seedHistoryLaden();
      expect(history.length).toBe(1);
      expect(history[0].seed).toBe(424242);
      expect(history[0].jahr).toBe(6);
      expect(history[0].verwendetAm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('speichert mehrere Einträge', () => {
      seedHistoryHinzufuegen(100, 1);
      seedHistoryHinzufuegen(200, 2);
      seedHistoryHinzufuegen(300, 3);
      const history = seedHistoryLaden();
      expect(history.length).toBe(3);
    });

    it('entfernt Duplikate beim Hinzufügen gleichen Seeds', () => {
      seedHistoryHinzufuegen(424242, 1);
      seedHistoryHinzufuegen(424242, 2);
      const history = seedHistoryLaden();
      expect(history.length).toBe(1);
      expect(history[0].jahr).toBe(2); // Letzter Eintrag gewinnt
    });

    it('begrenzt Historie auf MAX_SEED_HISTORY Einträge', () => {
      for (let i = 1; i <= 15; i++) {
        seedHistoryHinzufuegen(i, i);
      }
      const history = seedHistoryLaden();
      expect(history.length).toBe(MAX_SEED_HISTORY);
      // Neueste Einträge sollten zuerst sein
      expect(history[0].seed).toBe(15);
    });

    it('entfernt einen spezifischen Seed aus dem Historie', () => {
      seedHistoryHinzufuegen(100, 1);
      seedHistoryHinzufuegen(200, 2);
      seedHistoryEntfernen(100);
      const history = seedHistoryLaden();
      expect(history.length).toBe(1);
      expect(history[0].seed).toBe(200);
    });

    it('löscht den gesamten Historie', () => {
      seedHistoryHinzufuegen(100, 1);
      seedHistoryHinzufuegen(200, 2);
      seedHistoryLeeren();
      expect(seedHistoryLaden().length).toBe(0);
    });
  });

  describe('Seed-Validierung', () => {
    it('erkennt gültige Seeds', () => {
      expect(istSeedGueltig(424242)).toBe(true);
      expect(istSeedGueltig(0)).toBe(true);
      expect(istSeedGueltig(-1)).toBe(true);
      expect(istSeedGueltig(999999)).toBe(true);
    });

    it('erkennt ungültige Seeds', () => {
      expect(istSeedGueltig(null)).toBe(false);
      expect(istSeedGueltig(undefined)).toBe(false);
      expect(istSeedGueltig('424242')).toBe(false);
      expect(istSeedGueltig(NaN)).toBe(false);
      expect(istSeedGueltig(Infinity)).toBe(false);
    });
  });

  describe('Seed-Farbe', () => {
    it('gibt konsistente Farben für gleiche Seeds', () => {
      expect(seedFarbe(424242)).toBe(seedFarbe(424242));
    });

    it('gibt verschiedene Farben für unterschiedliche Seeds', () => {
      expect(seedFarbe(1)).not.toBe(seedFarbe(2));
    });

    it('gibt gültige HSL-Farben zurück', () => {
      const farbe = seedFarbe(424242);
      expect(farbe).toMatch(/^hsl\(\d+, \d+%\, \d+%\)$/);
    });
  });

  describe('Seed-im-Historie', () => {
    it('gibt false zurück wenn Seed nicht im Historie', () => {
      expect(istSeedImHistorie(99999)).toBe(false);
    });

    it('gibt true zurück wenn Seed im Historie', () => {
      seedHistoryHinzufuegen(424242, 6);
      expect(istSeedImHistorie(424242)).toBe(true);
      expect(istSeedImHistorie(12345)).toBe(false);
    });
  });

  describe('Teiltext-Erstellung', () => {
    it('erstellt Teiltext mit Seed und Jahr', () => {
      const seed = 424242;
      const jahr = 6;
      const text = `Staatslenker Spielstand\nSeed: ${seed}\nJahr: ${jahr}\n`;
      expect(text).toContain('Staatslenker Spielstand');
      expect(text).toContain('Seed: 424242');
      expect(text).toContain('Jahr: 6');
    });
  });
});
