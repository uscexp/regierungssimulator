<script lang="ts">
  /**
   * @staatslenker/app JsonExportImport — Saves als JSON exportieren/importieren, localStorage-Quota-Fallback (US-M6-04).
   *
   * Implementiert den Import/Export von Spielständen als JSON-Dateien mit
   * automatischem Fallback bei localStorage-Quota-Überschreitung:
   * - JSON-Export: Speichert den aktuellen Spielstand als JSON-Datei zum Download
   *   JSON-Import: Lädt einen Spielstand aus einer JSON-Datei mit Validierung
   *   Quota-Erkennung: Erkennt ob localStorage voll ist (QuotaExceededError)
   *   Quota-Fallback: Bei vollem localStorage wird nur Datei-Export angeboten
   *   Import-Validierung: Prüft Schema-Version, Pflichtfelder und Datenintegrität
   *   Backup vor Import: Erstellt automatisch einen Backup-Slot vor dem Import
   *
   * Der Adapter liest readonly Snapshots; die JsonExportImport-Komponente rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  const adapter = erstelleUIAdapter('normal', 42);
  let state = adapter.state;

  /**
   * Aktuelle Save-Schema-Version.
   */
  const SAVE_SCHEMA_VERSION = 2;

  /**
   * Export-Datei-Name-Präfix.
   */
  const EXPORT_PREFIX = 'staatslenker_save';

  /**
   * Prüft ob localStorage verfügbar ist und nicht voll ist.
   * Gibt ein Objekt mit verfügbarem Speicher und Quota-Status zurück.
   */
  function prüfeLocalStorageQuota(): { verfügbar: boolean; quotaVoll: boolean; nutzungProzent: number } {
    try {
      const testKey = '__quota_test__';
      const testWert = 'x'.repeat(1024); // 1KB Test

      // Versuche zu schreiben
      localStorage.setItem(testKey, testWert);
      localStorage.removeItem(testKey);

      // Schätzung der Nutzung (vereinfacht)
      let nutzung = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const wert = localStorage.getItem(key) || '';
          nutzung += key.length + wert.length;
        }
      }

      // localStorage hat typischerweise 5MB = 5.242.880 Bytes
      const maxGroesse = 5 * 1024 * 1024;
      const nutzungProzent = Math.min(100, Math.round((nutzung / maxGroesse) * 100));

      return {
        verfügbar: true,
        quotaVoll: nutzungProzent >= 90,
        nutzungProzent,
      };
    } catch (error) {
      // QuotaExceededError oder ähnlicher Fehler
      return {
        verfügbar: false,
        quotaVoll: true,
        nutzungProzent: 100,
      };
    }
  }

  /**
   * Exportiert den aktuellen Spielstand als JSON-Datei zum Download.
   * Gibt true zurück bei Erfolg, false bei Fehler.
   */
  function spielstandAlsJsonExportieren(s: UIState, dateiName?: string): boolean {
    try {
      const exportDaten = {
        version: 1,
        schemaVersion: SAVE_SCHEMA_VERSION,
        exportiertAm: new Date().toISOString(),
        state: s,
      };

      const json = JSON.stringify(exportDaten, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const name = dateiName || `${EXPORT_PREFIX}_${new Date().toISOString().slice(0, 10)}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Fehler beim JSON-Export:', error);
      return false;
    }
  }

  /**
   * Importiert einen Spielstand aus einer JSON-Datei.
   * Gibt den importierten Zustand zurück oder null bei Validierungsfehler.
   */
  function spielstandAusJsonImportieren(dateiInhalt: string): UIState | null {
    try {
      const daten = JSON.parse(dateiInhalt);

      // Grundstruktur prüfen
      if (!daten || typeof daten !== 'object') {
        throw new Error('Ungültiges JSON-Format');
      }

      // Schema-Version prüfen
      if (daten.schemaVersion !== undefined && daten.schemaVersion > SAVE_SCHEMA_VERSION) {
        throw new Error(`Save-Schema v${daten.schemaVersion} ist neuer als unterstützt (v${SAVE_SCHEMA_VERSION})`);
      }

      // State extrahieren
      const state = daten.state || daten;

      // Pflichtfelder prüfen
      const pflichtfelder = ['jahr', 'legitimität', 'pk', 'schulden', 'radikalisierung', 'indikatoren', 'gruppen'];
      for (const feld of pflichtfelder) {
        if (!(feld in state)) {
          throw new Error(`Pflichtfeld fehlt: ${feld}`);
        }
      }

      // Typen prüfen
      if (typeof state.jahr !== 'number' || typeof state.legitimität !== 'number') {
        throw new Error('Ungültige Datentypen im State');
      }

      // Werte klammen (Sicherheit)
      const bereinigterState: UIState = {
        jahr: Math.max(0, Math.min(9999, state.jahr)),
        legitimität: Math.max(0, Math.min(100, state.legitimität)),
        pk: Math.max(0, Math.min(999, state.pk)),
        schulden: Math.max(0, state.schulden),
        radikalisierung: Math.max(0, Math.min(100, state.radikalisierung)),
        indikatoren: state.indikatoren || {},
        gruppen: state.gruppen || [],
      };

      return bereinigterState;
    } catch (error) {
      console.error('Fehler beim JSON-Import:', error);
      return null;
    }
  }

  /**
   * Erstellt ein Backup des aktuellen Zustands vor einem Import.
   * Gibt true zurück bei Erfolg.
   */
  function backupVorImportErstellen(s: UIState): boolean {
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

  /**
   * Stellt den Backup-Zustand vor einem Import wieder her.
   * Gibt den Backup-Zustand zurück oder null.
   */
  function backupVorImportWiederherstellen(): UIState | null {
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

  /**
   * Löscht den Vor-Import-Backup.
   */
  function backupVorImportLoeschen(): void {
    try {
      localStorage.removeItem('staatslenker_backup_vor_import');
    } catch {
      // Ignorieren
    }
  }

  /**
   * Formattiert Dateigröße für Anzeige.
   */
  function formatiereGroesse(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // Quota-Status initial prüfen
  const quotaStatus = prüfeLocalStorageQuota();

  let importdatei: File | null = null;
  let exportErfolg: boolean = false;
  let exportMeldung: string = '';
  let importErfolg: boolean = false;
  let importMeldung: string = '';
  let backupErfolg: boolean = false;
  let backupMeldung: string = '';

  function dateiImportieren() {
    if (!importdatei) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const inhalt = e.target?.result as string;
      const importiert = spielstandAusJsonImportieren(inhalt);
      if (importiert) {
        // Backup vor Import erstellen
        backupVorImportErstellen(state);
        state = importiert;
        importErfolg = true;
        importMeldung = 'Import erfolgreich durchgeführt.';
        importdatei = null;
      } else {
        importErfolg = false;
        importMeldung = 'Import fehlgeschlagen – ungültiges Dateiformat.';
      }
    };
    reader.onerror = () => {
      importErfolg = false;
      importMeldung = 'Datei konnte nicht gelesen werden.';
    };
    reader.readAsText(importdatei);
  }

  const TEST_STATE: UIState = {
    jahr: state.jahr,
    legitimität: state.legitimität,
    pk: state.pk,
    schulden: state.schulden,
    radikalisierung: state.radikalisierung,
    indikatoren: { ...state.indikatoren },
    gruppen: [...state.gruppen],
  };
</script>

<div class="json-export-import">
  <h1>JSON Export / Import (M6-04)</h1>
  <p>Spielstände als JSON-Datei exportieren und importieren mit localStorage-Quota-Fallback</p>

  <div class="quota-status">
    <h2>localStorage-Quota</h2>
    <div class="quota-item">
      <span class="quota-label">Verfügbar:</span>
      <span class="quota-value" class:verfügbar={quotaStatus.verfügbar} class:nichtVerfügbar={!quotaStatus.verfügbar}>
        {quotaStatus.verfügbar ? '✅ Ja' : '❌ Nein'}
      </span>
    </div>
    <div class="quota-item">
      <span class="quota-label">Quota voll:</span>
      <span class="quota-value" class:quotaVoll={quotaStatus.quotaVoll}>
        {quotaStatus.quotaVoll ? '⚠️ Ja' : '✅ Nein'}
      </span>
    </div>
    <div class="quota-item">
      <span class="quota-label">Nutzung:</span>
      <span class="quota-value">{quotaStatus.nutzungProzent}%</span>
    </div>
    {#if quotaStatus.quotaVoll}
      <div class="quota-warning">
        ⚠️ localStorage-Quota fast voll. Export als Datei wird empfohlen.
      </div>
    {/if}
  </div>

  <div class="export-section">
    <h2>JSON-Export</h2>
    <p>Speichert den aktuellen Spielstand als JSON-Datei zum Herunterladen.</p>
    <div class="export-actions">
      <button onclick={() => spielstandAlsJsonExportieren(state)} class="btn-primary">
        📥 Als JSON exportieren
      </button>
      {#if !quotaStatus.quotaVoll}
        <button onclick={() => {
          const erfolgreich = spielstandAlsJsonExportieren(state, 'manuell.json');
          if (erfolgreich) {
            exportErfolg = true;
            exportMeldung = 'Export erfolgreich als Datei gespeichert.';
          } else {
            exportErfolg = false;
            exportMeldung = 'Export fehlgeschlagen.';
          }
        }} class="btn-secondary">
          💾 Benannte Datei
        </button>
      {/if}
    </div>
    {#if exportMeldung}
      <div class="export-meldung" class:erfolg={exportErfolg}>
        {exportMeldung}
      </div>
    {/if}
  </div>

  <div class="import-section">
    <h2>JSON-Import</h2>
    <p>Lädt einen Spielstand aus einer JSON-Datei mit Validierung und automatischem Backup.</p>
    <div class="import-actions">
      <input type="file" accept=".json" bind:datei importdatei />
      <button onclick={() => dateiImportieren()} class="btn-primary" disabled={!importdatei}>
        📤 Aus Datei importieren
      </button>
    </div>
    {#if importMeldung}
      <div class="import-meldung" class:erfolg={importErfolg} class:fehler={!importErfolg && importMeldung}>
        {importMeldung}
      </div>
    {/if}
  </div>

  <div class="backup-section">
    <h2>Backup vor Import</h2>
    <p>Vor jedem Import wird automatisch ein Backup des aktuellen Zustands erstellt.</p>
    <div class="backup-actions">
      <button onclick={() => {
        const erfolgreich = backupVorImportErstellen(state);
        backupMeldung = erfolgreich ? 'Backup erstellt.' : 'Backup fehlgeschlagen.';
        backupErfolg = erfolgreich;
      }} class="btn-secondary">
        📦 Manuelles Backup
      </button>
      <button onclick={() => {
        const wiederhergestellt = backupVorImportWiederherstellen();
        if (wiederhergestellt) {
          state = wiederhergestellt;
          backupVorImportLoeschen();
          backupMeldung = 'Backup wiederhergestellt.';
          backupErfolg = true;
        } else {
          backupMeldung = 'Kein Backup vorhanden.';
          backupErfolg = false;
        }
      }} class="btn-info">
        ↩️ Backup wiederherstellen
      </button>
      <button onclick={backupVorImportLoeschen} class="btn-danger">
        🗑️ Backup löschen
      </button>
    </div>
    {#if backupMeldung}
      <div class="backup-meldung" class:erfolg={backupErfolg}>
        {backupMeldung}
      </div>
    {/if}
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
  .json-export-import {
    font-family: system-ui, sans-serif;
    max-width: 900px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .json-export-import h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .json-export-import p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .quota-status {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .quota-status h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin: 0 0 1rem 0;
  }

  .quota-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #e2e8f0;
  }

  .quota-item:last-child {
    border-bottom: none;
  }

  .quota-label {
    font-size: 0.85rem;
    color: #475569;
  }

  .quota-value {
    font-size: 0.85rem;
    font-weight: 600;
    font-family: monospace;
  }

  .quota-value.verfügbar {
    color: #16a34a;
  }

  .quota-value.nichtVerfügbar {
    color: #dc2626;
  }

  .quota-value.quotaVoll {
    color: #eab308;
  }

  .quota-warning {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 6px;
    padding: 0.75rem;
    margin-top: 1rem;
    color: #92400e;
    font-size: 0.85rem;
  }

  .export-section,
  .import-section,
  .backup-section,
  .current-state {
    margin-bottom: 2rem;
  }

  .export-section h2,
  .import-section h2,
  .backup-section h2,
  .current-state h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .export-actions,
  .import-actions,
  .backup-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
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

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  .btn-secondary:hover:not(:disabled) {
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

  .btn-info:hover:not(:disabled) {
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

  .btn-danger:hover:not(:disabled) {
    background: #fee2e2;
  }

  .export-meldung,
  .import-meldung,
  .backup-meldung {
    padding: 0.75rem;
    border-radius: 6px;
    margin-top: 1rem;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .export-meldung.erfolg,
  .import-meldung.erfolg,
  .backup-meldung.erfolg {
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #86efac;
  }

  .import-meldung.fehler,
  .backup-meldung:not(.erfolg) {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
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
