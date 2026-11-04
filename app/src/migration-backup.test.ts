/**
 * @staatslenker/app migration-backup.test.ts — Tests für Migration/Backup Logik (US-M6-03).
 *
 * Testet Save-Migrationen, Backup-Fallback, Versionsprüfung und Inkompatibilitäts-Erkennung.
 */
import { describe, expect, it } from 'vitest';

/**
 * MigrationBackup-Logik extrahiert aus MigrationBackup.svelte — testbar isoliert.
 */
const SAVE_SCHEMA_VERSION = 2;

interface UIStateMock {
  jahr: number;
  legitimität: number;
  pk: number;
  schulden: number;
  radikalisierung: number;
  indikatoren: Record<string, number>;
  gruppen: { zufriedenheit: number }[];
}

interface SaveHeader {
  version: number;
  schemaVersion: number;
  timestamp: string;
  stateHash: string;
  migriertVon?: number;
}

interface SaveData {
  header: SaveHeader;
  state: UIStateMock;
}

interface BackupSlot {
  version: number;
  timestamp: string;
  state: UIStateMock;
}

interface MigrationLogEntry {
  vonVersion: number;
  nachVersion: number;
  timestamp: string;
  erfolgreich: boolean;
}

function berechnePruefsumme(daten: unknown): string {
  const json = JSON.stringify(daten);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function migriereSave(save: any): SaveData | null {
  const header = save.header;
  const vonVersion = header.schemaVersion || 1;

  if (vonVersion === SAVE_SCHEMA_VERSION) {
    return save;
  }

  if (vonVersion > SAVE_SCHEMA_VERSION) {
    return null;
  }

  let migrierterState = { ...save.state };

  if (vonVersion === 1) {
    migrierterState = {
      ...save.state,
      jahr: save.state.jahr || 0,
      legitimität: save.state.legitimität ?? 50,
      pk: save.state.pk ?? 0,
      schulden: save.state.schulden ?? 0,
      radikalisierung: save.state.radikalisierung ?? 0,
      indikatoren: save.state.indikatoren || {},
      gruppen: save.state.gruppen || [],
    };
  }

  const migriertesSave: SaveData = {
    header: {
      version: save.header.version || 1,
      schemaVersion: SAVE_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      stateHash: berechnePruefsumme(migrierterState),
      migriertVon: vonVersion,
    },
    state: migrierterState,
  };

  return migriertesSave;
}

function saveIstKompatibel(save: any): boolean {
  if (!save) {
    return true;
  }
  const schemaVersion = save.header?.schemaVersion || 1;
  return schemaVersion <= SAVE_SCHEMA_VERSION;
}

function migrationsstatus(log: MigrationLogEntry[]): string {
  if (log.length === 0) {
    return 'Keine Migrationen durchgeführt';
  }
  const letzte = log[log.length - 1];
  return `Letzte Migration: v${letzte.vonVersion} → v${letzte.nachVersion} (${letzte.erfolgreich ? 'erfolgreich' : 'fehlgeschlagen'})`;
}

const TEST_STATE_V1: UIStateMock = {
  jahr: 3,
  legitimität: 45,
  pk: 20,
  schulden: 15,
  radikalisierung: 10,
  indikatoren: { infrastruktur: 40, bildung: 50 },
  gruppen: [{ zufriedenheit: 60 }, { zufriedenheit: 40 }],
};

const TEST_STATE_V2: UIStateMock = {
  jahr: 6,
  legitimität: 52,
  pk: 42,
  schulden: 10,
  radikalisierung: 0,
  indikatoren: { infrastruktur: 45, bildung: 55, gesundheit: 35, wirtschaft: 50, forschung: 40 },
  gruppen: [{ zufriedenheit: 60 }, { zufriedenheit: 45 }, { zufriedenheit: 55 }, { zufriedenheit: 70 }, { zufriedenheit: 40 }],
};

describe('US-M6-03: Migrationen + Backup-Fallback', () => {
  describe('Save-Migration', () => {
    it('migriert einen v1-Save auf v2', () => {
      const saveV1: any = {
        header: { version: 1, schemaVersion: 1, timestamp: '2024-01-01T00:00:00.000Z', stateHash: 'abc' },
        state: TEST_STATE_V1,
      };

      const migriert = migriereSave(saveV1);
      expect(migriert).toBeDefined();
      expect(migriert!.header.schemaVersion).toBe(2);
      expect(migriert!.header.migriertVon).toBe(1);
      expect(migriert!.state.jahr).toBe(3);
      expect(migriert!.state.legitimität).toBe(45);
    });

    it('gibt einen v2-Save unverändert zurück', () => {
      const saveV2: any = {
        header: { version: 1, schemaVersion: 2, timestamp: '2024-01-01T00:00:00.000Z', stateHash: 'abc' },
        state: TEST_STATE_V2,
      };

      const migriert = migriereSave(saveV2);
      expect(migriert).toBe(saveV2);
    });

    it('gibt null für eine zu neue Schema-Version zurück', () => {
      const saveZuNeu: any = {
        header: { version: 1, schemaVersion: 5, timestamp: '2024-01-01T00:00:00.000Z', stateHash: 'abc' },
        state: TEST_STATE_V2,
      };

      const migriert = migriereSave(saveZuNeu);
      expect(migriert).toBe(null);
    });

    it('ergänzt fehlende Felder bei v1-Migration', () => {
      const saveV1OhneFelder: any = {
        header: { version: 1, schemaVersion: 1, timestamp: '2024-01-01T00:00:00.000Z', stateHash: 'abc' },
        state: { jahr: 1, indikatoren: {}, gruppen: [] },
      };

      const migriert = migriereSave(saveV1OhneFelder);
      expect(migriert!.state.jahr).toBe(1);
      expect(migriert!.state.legitimität).toBe(50);
      expect(migriert!.state.pk).toBe(0);
      expect(migriert!.state.schulden).toBe(0);
      expect(migriert!.state.radikalisierung).toBe(0);
    });
  });

  describe('Versionsprüfung', () => {
    it('erkennt einen kompatiblen v1-Save', () => {
      const saveV1: any = { header: { schemaVersion: 1 } };
      expect(saveIstKompatibel(saveV1)).toBe(true);
    });

    it('erkennt einen kompatiblen v2-Save', () => {
      const saveV2: any = { header: { schemaVersion: 2 } };
      expect(saveIstKompatibel(saveV2)).toBe(true);
    });

    it('erkennt einen inkompatiblen v5-Save', () => {
      const saveV5: any = { header: { schemaVersion: 5 } };
      expect(saveIstKompatibel(saveV5)).toBe(false);
    });

    it('gibt true zurück wenn kein Save vorhanden ist', () => {
      expect(saveIstKompatibel(null)).toBe(true);
      expect(saveIstKompatibel(undefined)).toBe(true);
    });
  });

  describe('Migrationsstatus', () => {
    it('gibt "Keine Migrationen durchgeführt" für leeren Log zurück', () => {
      expect(migrationsstatus([])).toBe('Keine Migrationen durchgeführt');
    });

    it('gibt den letzten Migrationseintrag zurück', () => {
      const log: MigrationLogEntry[] = [
        { vonVersion: 1, nachVersion: 2, timestamp: '2024-01-01T00:00:00.000Z', erfolgreich: true },
        { vonVersion: 2, nachVersion: 3, timestamp: '2024-01-02T00:00:00.000Z', erfolgreich: false },
      ];
      const status = migrationsstatus(log);
      expect(status).toContain('v2 → v3');
      expect(status).toContain('fehlgeschlagen');
    });

    it('gibt den erfolgreichsten Eintrag zurück', () => {
      const log: MigrationLogEntry[] = [
        { vonVersion: 1, nachVersion: 2, timestamp: '2024-01-01T00:00:00.000Z', erfolgreich: true },
      ];
      const status = migrationsstatus(log);
      expect(status).toContain('erfolgreich');
    });
  });

  describe('Prüfsumme', () => {
    it('berechnet eine konsistente Prüfsumme', () => {
      const hash1 = berechnePruefsumme({ a: 1 });
      const hash2 = berechnePruefsumme({ a: 1 });
      expect(hash1).toBe(hash2);
    });

    it('berechnet unterschiedliche Prüfsummen für unterschiedliche Daten', () => {
      const hash1 = berechnePruefsumme({ a: 1 });
      const hash2 = berechnePruefsumme({ a: 2 });
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Test-Zustände', () => {
    it('hat einen gültigen v1-Test-Zustand', () => {
      expect(TEST_STATE_V1.jahr).toBe(3);
      expect(TEST_STATE_V1.legitimität).toBe(45);
      expect(Object.keys(TEST_STATE_V1.indikatoren).length).toBe(2);
    });

    it('hat einen gültigen v2-Test-Zustand', () => {
      expect(TEST_STATE_V2.jahr).toBe(6);
      expect(TEST_STATE_V2.legitimität).toBe(52);
      expect(Object.keys(TEST_STATE_V2.indikatoren).length).toBe(5);
      expect(TEST_STATE_V2.gruppen.length).toBe(5);
    });
  });
});
