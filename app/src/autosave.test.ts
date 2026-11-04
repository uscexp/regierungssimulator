/**
 * @staatslenker/app autosave.test.ts — Tests für AutoSave Logik (US-M6-02).
 *
 * Testet Speichern/Wiederherstellen, Konfiguration, Zustand-Erkennung.
 */
import { describe, expect, it } from 'vitest';

/**
 * AutoSave-Logik extrahiert aus AutoSave.svelte — testbar isoliert.
 */
const AUTOSAVE_KEY = 'staatslenker_autosave';
const AUTOSAVE_CONFIG_KEY = 'staatslenker_autosave_config';

interface UIStateMock {
  jahr: number;
  legitimität: number;
  pk: number;
  schulden: number;
  radikalisierung: number;
  indikatoren: Record<string, number>;
  gruppen: { zufriedenheit: number }[];
}

interface AutoSaveConfig {
  aktiviert: boolean;
  intervallSekunden: number;
  letzterSpeicherzeitpunkt: string | null;
  autosaveName: string;
}

const STANDARD_CONFIG: AutoSaveConfig = {
  aktiviert: true,
  intervallSekunden: 30,
  letzterSpeicherzeitpunkt: null,
  autosaveName: 'autosave',
};

function configLaden(): AutoSaveConfig {
  try {
    const json = localStorage.getItem(AUTOSAVE_CONFIG_KEY);
    if (!json) {
      return { ...STANDARD_CONFIG };
    }
    const geladen: AutoSaveConfig = JSON.parse(json);
    return { ...STANDARD_CONFIG, ...geladen };
  } catch {
    return { ...STANDARD_CONFIG };
  }
}

function configSpeichern(cfg: AutoSaveConfig): void {
  try {
    localStorage.setItem(AUTOSAVE_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // Ignorieren im Test
  }
}

function autoSaveSpeichern(s: UIStateMock, aktiviert: boolean): boolean {
  if (!aktiviert) {
    return false;
  }
  try {
    const saveData = {
      version: 1,
      timestamp: new Date().toISOString(),
      state: s,
    };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(saveData));
    return true;
  } catch {
    return false;
  }
}

function autoSaveWiederherstellen(): UIStateMock | null {
  try {
    const json = localStorage.getItem(AUTOSAVE_KEY);
    if (!json) {
      return null;
    }
    const saveData = JSON.parse(json);
    if (saveData.version !== 1) {
      return null;
    }
    return saveData.state;
  } catch {
    return null;
  }
}

function autosaveVorhanden(): boolean {
  try {
    return localStorage.getItem(AUTOSAVE_KEY) !== null;
  } catch {
    return false;
  }
}

function autosaveLoeschen(): boolean {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

function formatiereZeitstempel(zeitstempel: string | null): string {
  if (!zeitstempel) {
    return 'Noch nie gespeichert';
  }
  const date = new Date(zeitstempel);
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const TEST_STATE: UIStateMock = {
  jahr: 6,
  legitimität: 52,
  pk: 42,
  schulden: 10,
  radikalisierung: 0,
  indikatoren: { infrastruktur: 45, bildung: 50 },
  gruppen: [{ zufriedenheit: 60 }, { zufriedenheit: 45 }],
};

describe('US-M6-02: AutoSave', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Speichern und Wiederherstellen', () => {
    it('speichert einen Zustand in localStorage', () => {
      const erfolg = autoSaveSpeichern(TEST_STATE, true);
      expect(erfolg).toBe(true);
      expect(autosaveVorhanden()).toBe(true);
    });

    it('speichert nicht wenn Autosave deaktiviert ist', () => {
      const erfolg = autoSaveSpeichern(TEST_STATE, false);
      expect(erfolg).toBe(false);
      expect(autosaveVorhanden()).toBe(false);
    });

    it('stellt einen gespeicherten Zustand wieder her', () => {
      autoSaveSpeichern(TEST_STATE, true);
      const wiederhergestellt = autoSaveWiederherstellen();
      expect(wiederhergestellt).toBeDefined();
      expect(wiederhergestellt?.jahr).toBe(6);
      expect(wiederhergestellt?.legitimität).toBe(52);
      expect(wiederhergestellt?.pk).toBe(42);
    });

    it('gibt null zurück wenn kein Autosave vorhanden ist', () => {
      const wiederhergestellt = autoSaveWiederherstellen();
      expect(wiederhergestellt).toBe(null);
    });

    it('löscht den Autosave', () => {
      autoSaveSpeichern(TEST_STATE, true);
      expect(autosaveVorhanden()).toBe(true);
      const geloescht = autosaveLoeschen();
      expect(geloescht).toBe(true);
      expect(autosaveVorhanden()).toBe(false);
    });
  });

  describe('Konfiguration', () => {
    it('lädt die Standard-Konfiguration wenn keine gespeichert ist', () => {
      const config = configLaden();
      expect(config.aktiviert).toBe(true);
      expect(config.intervallSekunden).toBe(30);
      expect(config.letzterSpeicherzeitpunkt).toBeNull();
    });

    it('speichert und lädt eine benutzerdefinierte Konfiguration', () => {
      const customConfig: AutoSaveConfig = {
        aktiviert: false,
        intervallSekunden: 60,
        letzterSpeicherzeitpunkt: '2024-01-15T10:30:00.000Z',
        autosaveName: 'mein_autosave',
      };
      configSpeichern(customConfig);
      const geladen = configLaden();
      expect(geladen.aktiviert).toBe(false);
      expect(geladen.intervallSekunden).toBe(60);
      expect(geladen.letzterSpeicherzeitpunkt).toBe('2024-01-15T10:30:00.000Z');
      expect(geladen.autosaveName).toBe('mein_autosave');
    });
  });

  describe('Zeitstempel-Formatierung', () => {
    it('gibt "Noch nie gespeichert" für null zurück', () => {
      expect(formatiereZeitstempel(null)).toBe('Noch nie gespeichert');
    });

    it('formatiert einen Zeitstempel auf Deutsch', () => {
      const result = formatiereZeitstempel('2024-01-15T10:30:00.000Z');
      expect(result).toContain('15.');
      expect(result).toContain('01.');
      expect(result).toContain('2024');
    });
  });

  describe('Zustand-Erkennung', () => {
    ****it('erkennt vorhandenen Autosave', () => {
      expect(autosaveVorhanden()).toBe(false);
      autoSaveSpeichern(TEST_STATE, true);
      expect(autosaveVorhanden()).toBe(true);
    });

    it('erkennt fehlenden Autosave nach Löschung', () => {
      autoSaveSpeichern(TEST_STATE, true);
      autosaveLoeschen();
      expect(autosaveVorhanden()).toBe(false);
    });
  });
});
