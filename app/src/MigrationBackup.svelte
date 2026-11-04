<script lang="ts">
  /**
   * @staatslenker/app MigrationBackup — Save-Migrationen + Backup-Fallback (US-M6-03).
   *
   * Implementiert die Verwaltung von Save-Versionen mit automatischer Migration
   * und Backup-Fallback bei korrupten oder inkompatiblen Spielständen:
   * - Save-Migrationen: Ältere Save-Formate werden auf das aktuelle Format migriert
   *   Backup-Fallback: Bei korruptem/incompatiblem Save wird auf einen Backup-Slot zurückgegriffen
   *   Versions-Tracking: Jeder Save trägt eine Schema-Version
   *   Inkompatibilitäts-Erkennung: Saves mit zu alten oder zu neuen Versionen werden erkannt
   *   Automatische Wiederherstellung: Backup wird automatisch geladen wenn der Haupt-Save defekt ist
   *
   * Der Adapter liest readonly Snapshots; die MigrationBackup-Komponente rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  const adapter = erstelleUIAdapter('normal', 42);
  let state = adapter.state;

  /**
   * Aktuelle Save-Schema-Version.
   */
  const SAVE_SCHEMA_VERSION = 2;

  /**
   * Save-Header mit Metadaten.
   */
  interface SaveHeader {
    version: number;
    schemaVersion: number;
    timestamp: string;
    stateHash: string;
    migriertVon?: number;
  }

  /**
   * Vollständiger Save-Datensatz.
   */
  interface SaveData {
    header: SaveHeader;
    state: UIState;
  }

  /**
   * Backup-Slot für Fallback.
   */
  interface BackupSlot {
    version: number;
    timestamp: string;
    state: UIState;
  }

  const SAVE_KEY = 'staatslenker_save';
  const BACKUP_KEY = 'staatslenker_save_backup';
  const MIGRATION_LOG_KEY = 'staatslenker_migration_log';

  /**
   * Migration-Log-Eintrag.
   */
  interface MigrationLogEntry {
    vonVersion: number;
    nachVersion: number;
    timestamp: string;
    erfolgreich: boolean;
  }

  /**
   * Berechnet eine einfache Prüfsumme für den Save-State.
   */
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

  /**
   * Lädt alle Migration-Log-Einträge.
   */
  function migrationLogLaden(): MigrationLogEntry[] {
    try {
      const json = localStorage.getItem(MIGRATION_LOG_KEY);
      if (!json) {
        return [];
      }
      return JSON.parse(json);
    } catch {
      return [];
    }
  }

  /**
   * Speichert einen Migration-Log-Eintrag.
   */
  function migrationLogSpeichern(eintrag: MigrationLogEntry): void {
    try {
      const log = migrationLogLaden();
      log.push(eintrag);
      // Behalte nur die letzten 50 Einträge
      if (log.length > 50) {
        log.splice(0, log.length - 50);
      }
      localStorage.setItem(MIGRATION_LOG_KEY, JSON.stringify(log));
    } catch {
      // Ignorieren im Fehlerfall
    }
  }

  /**
   * Führt eine Migration eines Saves durch.
   * Gibt den migrierten Zustand zurück oder null bei nicht-migrierbarem Save.
   */
  function migriereSave(save: any): SaveData | null {
    const header = save.header;
    const vonVersion = header.schemaVersion || 1;

    if (vonVersion === SAVE_SCHEMA_VERSION) {
      // Bereits aktuell, keine Migration nötig
      return save;
    }

    if (vonVersion > SAVE_SCHEMA_VERSION) {
      // Save ist neuer als aktuelles Schema — inkompatibel
      migrationLogSpeichern({
        vonVersion,
        nachVersion: SAVE_SCHEMA_VERSION,
        timestamp: new Date().toISOString(),
        erfolgreich: false,
      });
      return null;
    }

    // Migration von älterer Version auf aktuelle Version
    let migrierterState = { ...save.state };

    if (vonVersion === 1) {
      // Migration v1 → v2: Füge neue Felder hinzu, formatiere um
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

    migrationLogSpeichern({
      vonVersion,
      nachVersion: SAVE_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      erfolgreich: true,
    });

    return migriertesSave;
  }

  /**
   * Speichert einen Spielstand mit Backup-Erstellung.
   */
  function spielstandSpeichernMitBackup(s: UIState): boolean {
    try {
      const saveData: SaveData = {
        header: {
          version: 1,
          schemaVersion: SAVE_SCHEMA_VERSION,
          timestamp: new Date().toISOString(),
          stateHash: berechnePruefsumme(s),
        },
        state: s,
      };

      // Haupt-Save speichern
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));

      // Backup erstellen (Kopie des letzten guten Zustands)
      const backup: BackupSlot = {
        version: 1,
        timestamp: new Date().toISOString(),
        state: s,
      };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));

      return true;
    } catch (error) {
      console.error('Fehler beim Speichern mit Backup:', error);
      return false;
    }
  }

  /**
   * Lädt einen Spielstand mit automatischer Migration und Backup-Fallback.
   * Gibt den geladenen Zustand zurück oder null bei komplettem Versagen.
   */
  function spielstandLadenMitFallback(): UIState | null {
    // 1. Versuch: Haupt-Save laden und migrieren
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (json) {
        const save: any = JSON.parse(json);
        const migriert = migriereSave(save);
        if (migriert) {
          return migriert.state;
        }
        // Migration fehlgeschlagen → Fallback auf Backup
      }
    } catch {
      // JSON-Parsing fehlgeschlagen → Fallback auf Backup
    }

    // 2. Versuch: Backup laden
    try {
      const backupJson = localStorage.getItem(BACKUP_KEY);
      if (backupJson) {
        const backup: BackupSlot = JSON.parse(backupJson);
        return backup.state;
      }
    } catch {
      // Backup auch korrupt → komplett fehlgeschlagen
    }

    return null;
  }

  /**
   * Prüft ob ein Save kompatibel ist.
   */
  function saveIstKompatibel(): boolean {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (!json) {
        return true; // Kein Save = kompatibel (neuer Start)
      }
      const save: any = JSON.parse(json);
      const schemaVersion = save.header?.schemaVersion || 1;
      return schemaVersion <= SAVE_SCHEMA_VERSION;
    } catch {
      return false; // Korrupt = inkompatibel
    }
  }

  /**
   * Gibt den Migrations-Status zurück.
   */
  function migrationsstatus(): string {
    const log = migrationLogLaden();
    if (log.length === 0) {
      return 'Keine Migrationen durchgeführt';
    }
    const letzte = log[log.length - 1];
    return `Letzte Migration: v${letzte.vonVersion} → v${letzte.nachVersion} (${letzte.erfolgreich ? 'erfolgreich' : 'fehlgeschlagen'})`;
  }

  /**
   * Erstellt ein manuelles Backup.
   */
  function backupErstellen(s: UIState): boolean {
    try {
      const backup: BackupSlot = {
        version: 1,
        timestamp: new Date().toISOString(),
        state: s,
      };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Löscht alle Saves und Backups.
   */
  function allesLoeschen(): boolean {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(BACKUP_KEY);
      localStorage.removeItem(MIGRATION_LOG_KEY);
      return true;
    } catch {
      return false;
    }
  }

  // Initialisierung
  const kompatibel = saveIstKompatibel();
  const log = migrationLogLaden();
</script>

<div class="migration-backup">
  <h1>Save-Migrationen + Backup-Fallback (M6-03)</h1>
  <p>Automatische Migration älterer Save-Formate und Wiederherstellung aus Backup bei korrupten Spielständen</p>

  <div class="status-zeile">
    <div class="status-item">
      <span class="status-label">Save-Schema-Version:</span>
      <span class="status-value">{SAVE_SCHEMA_VERSION}</span>
    </div>
    <div class="status-item">
      <span class="status-label">Save kompatibel:</span>
      <span class="status-value" class:kompatibel={kompatibel} class:inkompatibel={!kompatibel}>
        {kompatibel ? '✅ Ja' : '❌ Nein'}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">Migrationen:</span>
      <span class="status-value">{log.length}</span>
    </div>
  </div>

  <div class="migration-section">
    <h2>Save-Migrationen</h2>
    <p>Ältere Save-Formate werden automatisch auf das aktuelle Schema migriert:</p>
    <div class="migration-info">
      <p><strong>v1 → v2:</strong> Ergänzt fehlende Felder (jahr, legitimität, pk, schulden, radikalisierung, indikatoren, gruppen) mit Standardwerten.</p>
      <p><strong>v2 → aktuell:</strong> Keine Migration nötig (bereits aktuell).</p>
      <p><strong>Zu neue Version:</strong> Save wird als inkompatibel erkannt, Backup-Fallback wird aktiviert.</p>
    </div>

    <div class="migration-log">
      <h3>Migrations-Log ({log.length} Einträge)</h3>
      {#if log.length === 0}
        <p class="empty">Keine Migrationen durchgeführt.</p>
      {:else}
        <ul class="log-eintraege">
          {#each log.slice().reverse() as eintrag}
            <li class="log-eintrag" class:erfolgreich={eintrag.erfolgreich} class:fehlgeschlagen={!eintrag.erfolgreich}>
              <span class="log-pfeil">v{eintrag.vonVersion} → v{eintrag.nachVersion}</span>
              <span class="log-status">{eintrag.erfolgreich ? '✅ Erfolgreich' : '❌ Fehlgeschlagen'}</span>
              <span class="log-zeit">{new Date(eintrag.timestamp).toLocaleString('de-DE')}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <div class="backup-section">
    <h2>Backup-Fallback</h2>
    <p>Bei korruptem oder inkompatiblem Haupt-Save wird automatisch auf den Backup-Slot zurückgegriffen:</p>

    <div class="backup-aktionen">
      <button onclick={() => spielstandSpeichernMitBackup(state)} class="btn-primary">
        💾 Save mit Backup speichern
      </button>
      <button onclick={() => backupErstellen(state)} class="btn-secondary">
        📦 Manuelles Backup erstellen
      </button>
      <button onclick={() => spielstandLadenMitFallback()?.then?.(s => { state = s; }) ?? state} class="btn-info">
        ↩️ Save mit Fallback laden
      </button>
      <button onclick={allesLoeschen} class="btn-danger">
        🗑️ Alles löschen
      </button>
    </div>

    <div class="backup-info">
      <h3>Fallback-Reihenfolge:</h3>
      <ol class="fallback-liste">
        <li>Haupt-Save laden → Migration versuchen → Erfolg?</li>
        <li>Nein → Backup-Slot laden → Erfolg?</li>
        <li>Nein → Kein Save verfügbar (neuer Start)</li>
      </ol>
    </div>
  </div>

  <div class="migrationsstatus">
    <h3>Migrationsstatus</h3>
    <p class="status-text">{migrationsstatus()}</p>
  </div>

  <div class="current-state">
    <h2>Aktueller Spielzustand</h2>
    <div class="state-metrics">
      <div class="metric">
        <span class="metric-label">Jahr:</span>
        <span class="metric-value">{state.jahr}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Legitimität:</span>
        <span class="metric-value">{state.legitimität}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Politisches Kapital:</span>
        <span class="metric-value">{state.pk}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Schulden:</span>
        <span class="metric-value">{state.schulden}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Radikalisierung:</span>
        <span class="metric-value">{state.radikalisierung}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .migration-backup {
    font-family: system-ui, sans-serif;
    max-width: 900px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .migration-backup h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .migration-backup p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .status-zeile {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #e2e8f0;
  }

  .status-item:last-child {
    border-bottom: none;
  }

  .status-label {
    font-size: 0.85rem;
    color: #475569;
  }

  .status-value {
    font-size: 0.85rem;
    font-weight: 600;
    font-family: monospace;
  }

  .status-value.kompatibel {
    color: #16a34a;
  }

  .status-value.inkompatibel {
    color: #dc2626;
  }

  .migration-section,
  .backup-section,
  .current-state {
    margin-bottom: 2rem;
  }

  .migration-section h2,
  .backup-section h2,
  .current-state h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .migration-info {
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .migration-info p {
    margin: 0.5rem 0;
    font-size: 0.85rem;
    color: #166534;
  }

  .migration-log {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
  }

  .migration-log h3 {
    font-size: 1rem;
    color: #334155;
    margin: 0 0 0.75rem 0;
  }

  .log-eintraege {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .log-eintrag {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .log-eintrag:last-child {
    border-bottom: none;
  }

  .log-eintrag.erfolgreich {
    background: #f0fdf4;
  }

  .log-eintrag.fehlgeschlagen {
    background: #fef2f2;
  }

  .log-pfeil {
    font-weight: 600;
    color: #334155;
  }

  .log-status {
    font-size: 0.8rem;
    font-weight: 600;
  }

  .log-zeit {
    font-size: 0.8rem;
    color: #64748b;
    font-family: monospace;
  }

  .empty {
    font-size: 0.85rem;
    color: #64748b;
    font-style: italic;
    margin: 0;
  }

  .backup-aktionen {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .btn-secondary:hover {
    background: #e2e8f0;
  }

  .btn-info {
    padding: 0.75rem 1.5rem;
    background: #eff6ff;
    color: #1e40af;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .btn-info:hover {
    background: #dbeafe;
  }

  .btn-danger {
    padding: 0.75rem 1.5rem;
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .btn-danger:hover {
    background: #fee2e2;
  }

  .backup-info {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
  }

  .backup-info h3 {
    font-size: 1rem;
    color: #334155;
    margin: 0 0 0.75rem 0;
  }

  .fallback-liste {
    margin: 0;
    padding-left: 1.5rem;
    color: #334155;
    font-size: 0.85rem;
    line-height: 1.6;
  }

  .fallback-liste li {
    margin-bottom: 0.5rem;
  }

  .migrationsstatus {
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .migrationsstatus h3 {
    font-size: 1rem;
    color: #166534;
    margin: 0 0 0.5rem 0;
  }

  .status-text {
    margin: 0;
    font-size: 0.85rem;
    color: #166534;
  }

  .current-state {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
  }

  .current-state h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin: 0 0 1rem 0;
  }

  .state-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .metric {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.75rem;
    text-align: center;
  }

  .metric-label {
    font-size: 0.8rem;
    color: #64748b;
    display: block;
    margin-bottom: 0.25rem;
  }

  .metric-value {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }
</style>
