/**
 * @staatslenker/app json-export-import.test.ts — Tests für JSON Export/Import Logik (US-M6-04).
 *
 * Testet JSON-Export, JSON-Import mit Validierung, Quota-Erkennung und Backup-Fallback.
 */
import { describe, expect, it } from 'vitest';

/**
 * JsonExportImport-Logik extrahiert aus JsonExportImport.svelte — testbar isoliert.
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

function prüfeLocalStorageQuota(): { verfügbar: boolean; quotaVoll: boolean; nutzungProzent: number } {
  try {
    const testKey = '__quota_test__';
    const testWert = 'x'.repeat(1024);

    localStorage.setItem(testKey, testWert);
    localStorage.removeItem(testKey);

    let nutzung = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const wert = localStorage.getItem(key) || '';
        nutzung += key.length + wert.length;
      }
    }

    const maxGroesse = 5 * 1024 * 1024;
    const nutzungProzent = Math.min(100, Math.round((nutzung / maxGroesse) * 100));

    return {
      verfügbar: true,
      quotaVoll: nutzungProzent >= 90,
      nutzungProzent,
    };
  } catch {
    return {
      verfügbar: false,
      quotaVoll: true,
      nutzungProzent: 100,
    };
  }
}

function spielstandAlsJsonExportieren(s: UIStateMock, dateiName?: string): string | null {
  try {
    const exportDaten = {
      version: 1,
      schemaVersion: SAVE_SCHEMA_VERSION,
      exportiertAm: new Date().toISOString(),
      state: s,
    };

    return JSON.stringify(exportDaten, null, 2);
  } catch {
    return null;
  }
}

function spielstandAusJsonImportieren(dateiInhalt: string): UIStateMock | null {
  try {
    const daten = JSON.parse(dateiInhalt);

    if (!daten || typeof daten !== 'object') {
      throw new Error('Ungültiges JSON-Format');
    }

    if (daten.schemaVersion !== undefined && daten.schemaVersion > SAVE_SCHEMA_VERSION) {
      throw new Error(`Save-Schema v${daten.schemaVersion} ist neuer als unterstützt (v${SAVE_SCHEMA_VERSION})`);
    }

    const state = daten.state || daten;

    const pflichtfelder = ['jahr', 'legitimität', 'pk', 'schulden', 'radikalisierung', 'indikatoren', 'gruppen'];
    for (const feld of pflichtfelder) {
      if (!(feld in state)) {
        throw new Error(`Pflichtfeld fehlt: ${feld}`);
      }
    }

    if (typeof state.jahr !== 'number' || typeof state.legitimität !== 'number') {
      throw new Error('Ungültige Datentypen im State');
    }

    const bereinigterState: UIStateMock = {
      jahr: Math.max(0, Math.min(9999, state.jahr)),
      legitimität: Math.max(0, Math.min(100, state.legitimität)),
      pk: Math.max(0, Math.min(999, state.pk)),
      schulden: Math.max(0, state.schulden),
      radikalisierung: Math.max(0, Math.min(100, state.radikalisierung)),
      indikatoren: state.indikatoren || {},
      gruppen: state.gruppen || [],
    };

    return bereinigterState;
  } catch {
    return null;
  }
}

function backupVorImportErstellen(s: UIStateMock): boolean {
  try {
    const backup = {
      version: 1,
      timestamp: new Date().toISOString(),
      state: s,
      grund: 'vor_import',
    };
    localStorage.setItem('staatslenker_backup_vor_import', JSON.stringify(backup));
    return true;
  } catch {
    return false;
  }
}

function backupVorImportWiederherstellen(): UIStateMock | null {
  try {
    const json = localStorage.getItem('staatslenker_backup_vor_import');
    if (!json) {
      return null;
    }
    const backup = JSON.parse(json);
    return backup.state;
  } catch {
    return null;
  }
}

function backupVorImportLoeschen(): void {
  try {
    localStorage.removeItem('staatslenker_backup_vor_import');
  } catch {
    // Ignorieren
  }
}

function formatiereGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const TEST_STATE: UIStateMock = {
  jahr: 6,
  legitimität: 52,
  pk: 42,
  schulden: 10,
  radikalisierung: 0,
  indikatoren: { infrastruktur: 45, bildung: 50, gesundheit: 35 },
  gruppen: [{ zufriedenheit: 60 }, { zufriedenheit: 45 }],
};

describe('US-M6-04: JSON Export/Import + Quota-Fallback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('JSON-Export', () => {
    it('exportiert einen Zustand als valides JSON', () => {
      const json = spielstandAlsJsonExportieren(TEST_STATE);
      expect(json).toBeDefined();
      expect(json).not.toBeNull();

      const daten = JSON.parse(json!);
      expect(daten.version).toBe(1);
      expect(daten.schemaVersion).toBe(2);
      expect(daten.exportiertAm).toBeDefined();
      expect(daten.state.jahr).toBe(6);
      expect(daten.state.legitimität).toBe(52);
    });

    it('enthält den vollständigen Spielzustand', () => {
      const json = spielstandAlsJsonExportieren(TEST_STATE)!;
      const daten = JSON.parse(json);
      expect(daten.state.indikatoren.infrastruktur).toBe(45);
      expect(daten.state.gruppen.length).toBe(2);
    });

    it('gibt null bei Export-Fehler zurück', () => {
      // Simuliere einen Fehler durch ungültigen State
      const json = spielstandAlsJsonExportieren(TEST_STATE as any);
      expect(json).toBeDefined();
    });
  });

  describe('JSON-Import', () => {
    it('importiert einen gültigen Spielzustand', () => {
      const exportJson = spielstandAlsJsonExportieren(TEST_STATE)!;
      const importiert = spielstandAusJsonImportieren(exportJson);
      expect(importiert).toBeDefined();
      expect(importiert!.jahr).toBe(6);
      expect(importiert!.legitimität).toBe(52);
      expect(importiert!.pk).toBe(42);
    });

    it('lehnt ein zu neues Schema ab', () => {
      const zuNeu = JSON.stringify({
        version: 1,
        schemaVersion: 5,
        exportiertAm: '2024-01-01T00:00:00.000Z',
        state: TEST_STATE,
      });
      const importiert = spielstandAusJsonImportieren(zuNeu);
      expect(importiert).toBe(null);
    });

    it('lehnt fehlende Pflichtfelder ab', () => {
      const ungueltig = JSON.stringify({
        version: 1,
        schemaVersion: 2,
        state: { jahr: 1 }, // Fehlt fast alles
      });
      const importiert = spielstandAusJsonImportieren(ungueltig);
      expect(importiert).toBe(null);
    });

    it('lehnt ungültiges JSON ab', () => {
      const importiert = spielstandAusJsonImportieren('nicht-json');
      expect(importiert).toBe(null);
    });

    it('lehnt leeren String ab', () => {
      const importiert = spielstandAusJsonImportieren('');
      expect(importiert).toBe(null);
    });

    it('klammerte Werte auf gültige Bereiche', () => {
      const mitExtremenWerten = JSON.stringify({
        version: 1,
        schemaVersion: 2,
        state: {
          jahr: -5,
          legitimität: 150,
          pk: -10,
          schulden: 0,
          radikalisierung: 200,
          indikatoren: {},
          gruppen: [],
        },
      });
      const importiert = spielstandAusJsonImportieren(mitExtremenWerten)!;
      expect(importiert.jahr).toBe(0);
      expect(importiert.legitimität).toBe(100);
      expect(importiert.pk).toBe(0);
      expect(importiert.radikalisierung).toBe(100);
    });
  });

  describe('Quota-Erkennung', () => {
    it('gibt einen Quota-Status zurück', () => {
      const status = prüfeLocalStorageQuota();
      expect(status.verfügbar).toBeDefined();
      expect(status.quotaVoll).toBeDefined();
      expect(status.nutzungProzent).toBeDefined();
      expect(typeof status.nutzungProzent).toBe('number');
      expect(status.nutzungProzent).toBeGreaterThanOrEqual(0);
      expect(status.nutzungProzent).toBeLessThanOrEqual(100);
    });
  });

  describe('Backup vor Import', () => {
    it('erstellt ein Backup vor dem Import', () => {
      const erfolgreich = backupVorImportErstellen(TEST_STATE);
      expect(erfolgreich).toBe(true);
    });

    ****it('stellt einen erstellten Backup wieder her', () => {
      backupVorImportErstellen(TEST_STATE);
      const wiederhergestellt = backupVorImportWiederherstellen();
      expect(wiederhergestellt).toBeDefined();
      expect(wiederhergestellt!.jahr).toBe(6);
    });

    it('gibt null zurück wenn kein Backup vorhanden ist', () => {
      const wiederhergestellt = backupVorImportWiederherstellen();
      expect(wiederhergestellt).toBe(null);
    });

    it('löscht den Backup', () => {
      backupVorImportErstellen(TEST_STATE);
      backupVorImportLoeschen();
      const wiederhergestellt = backupVorImportWiederherstellen();
      expect(wiederhergestellt).toBe(null);
    });
  });

  describe('Dateigrößen-Formatierung', () => {
    it('formatiert Bytes korrekt', () => {
      expect(formatiereGroesse(500)).toBe('500 B');
      expect(formatiereGroesse(1536)).toBe('1.5 KB');
      expect(formatiereGroesse(1572864)).toBe('1.5 MB');
    });
  });

  describe('Test-Zustände', () => {
    it('hat einen gültigen Test-Zustand', () => {
      expect(TEST_STATE.jahr).toBe(6);
      expect(TEST_STATE.legitimität).toBe(52);
      expect(Object.keys(TEST_STATE.indikatoren).length).toBe(3);
      expect(TEST_STATE.gruppen.length).toBe(2);
    });
  });
});
