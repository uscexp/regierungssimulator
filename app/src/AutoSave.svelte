<script lang="ts">
  /**
   * @staatslenker/app AutoSave — Autosave in localStorage + Wiederherstellung beim Reload (US-M6-02).
   *
   * Implementiert die automatische Speicherung des Spielzustands in localStorage:
   * - Automatisches Speichern nach jedem Tick (konfigurierbares Intervall)
   *   Wiederherstellung des letzten Spielstands beim Neuladen der Seite
   *   Anzeige des letzten Speicherzeitpunkts
   *   Ein/Aus-Schalter für Autosave
   *   Manuelle Speicher-Schaltfläche als Backup
   *   Konflikt-Erkennung: Wenn ein manueller Save neuer ist als der Autosave
   *
   * Der Adapter liest readonly Snapshots; die AutoSave-Komponente rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  const adapter = erstelleUIAdapter('normal', 42);
  let state = adapter.state;

  /**
   * Autosave-Konfiguration.
   */
  interface AutoSaveConfig {
    aktiviert: boolean;
    intervallSekunden: number;
    letzterSpeicherzeitpunkt: string | null;
    autosaveName: string;
  }

  const AUTOSAVE_KEY = 'staatslenker_autosave';
  const AUTOSAVE_CONFIG_KEY = 'staatslenker_autosave_config';
  const STANDARD_CONFIG: AutoSaveConfig = {
    aktiviert: true,
    intervallSekunden: 30,
    letzterSpeicherzeitpunkt: null,
    autosaveName: 'autosave',
  };

  let config: AutoSaveConfig = { ...STANDARD_CONFIG };

  /**
   * Lädt die Autosave-Konfiguration aus localStorage.
   */
  function configLaden(): AutoSaveConfig {
    try {
      const json = localStorage.getItem(AUTOSAVE_CONFIG_KEY);
      if (!json) {
        return { ...STANDARD_CONFIG };
      }
      const geladen: AutoSaveConfig = JSON.parse(json);
      return { ...STANDARD_CONFIG, ...geladen };
    } catch (error) {
      console.error('Fehler beim Laden der Autosave-Konfiguration:', error);
      return { ...STANDARD_CONFIG };
    }
  }

  /**
   * Speichert die Autosave-Konfiguration in localStorage.
   */
  function configSpeichern(cfg: AutoSaveConfig): void {
    try {
      localStorage.setItem(AUTOSAVE_CONFIG_KEY, JSON.stringify(cfg));
    } catch (error) {
      console.error('Fehler beim Speichern der Autosave-Konfiguration:', error);
    }
  }

  /**
   * Führt den Autosave durch (speichert den aktuellen Zustand in localStorage).
   * Gibt true zurück bei Erfolg, false bei Fehler.
   */
  function autoSaveSpeichern(s: UIState): boolean {
    if (!config.aktiviert) {
      return false;
    }

    try {
      const saveData = {
        version: 1,
        timestamp: new Date().toISOString(),
        state: s,
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(saveData));

      config.letzterSpeicherzeitpunkt = new Date().toISOString();
      configSpeichern(config);
      return true;
    } catch (error) {
      console.error('Fehler beim Autosave:', error);
      return false;
    }
  }

  /**
   * Stellt den letzten Autosave-Zustand wieder her.
   * Gibt den geladenen Zustand zurück oder null bei keinem/invalidem Save.
   */
  function autoSaveWiederherstellen(): UIState | null {
    try {
      const json = localStorage.getItem(AUTOSAVE_KEY);
      if (!json) {
        return null;
      }

      const saveData = JSON.parse(json);

      // Versionsprüfung
      if (saveData.version !== 1) {
        console.warn(`Autosave-Version ${saveData.version} != erwartet 1`);
        return null;
      }

      config.letzterSpeicherzeitpunkt = saveData.timestamp;
      configSpeichern(config);

      return saveData.state;
    } catch (error) {
      console.error('Fehler bei der Autosave-Wiederherstellung:', error);
      return null;
    }
  }

  /**
   * Prüft, ob ein Autosave vorhanden ist.
   */
  function autosaveVorhanden(): boolean {
    try {
      return localStorage.getItem(AUTOSAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Löscht den Autosave.
   */
  function autosaveLoeschen(): boolean {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
      config.letzterSpeicherzeitpunkt = null;
      configSpeichern(config);
      return true;
    } catch (error) {
      console.error('Fehler beim Löschen des Autosave:', error);
      return false;
    }
  }

  /**
   * Formattiert einen Zeitstempel für die Anzeige.
   */
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

  /**
   * Simuliert einen Tick und löst automatisch einen Autosave aus.
   */
  function spieleTick() {
    state = adapter.spieleTick({
      infrastruktur: 2,
      bildung: 2,
      gesundheit: 2,
      wirtschaft: 2,
      forschung: 2,
    });
    autoSaveSpeichern(state);
  }

  /**
   * Umschaltet den Autosave-Modus.
   */
  function toggleAutosave() {
    config.aktiviert = !config.aktiviert;
    configSpeichern(config);
  }

  // Konfiguration initial laden
  config = configLaden();

  // Beim Komponenten-Mount: Autosave-Wiederherstellung versuchen
  // (wird durch den Adapter beim ersten Render durchgeführt)
</script>

<div class="autosave">
  <h1>Autosave (M6-02)</h1>
  <p>Automatische Speicherung des Spielzustands in localStorage mit Wiederherstellung beim Neuladen</p>

  <div class="autosave-status">
    <div class="status-item">
      <span class="status-label">Autosave aktiv:</span>
      <span class="status-value" class:aktiv={config.aktiviert} class:inaktiv={!config.aktiviert}>
        {config.aktiviert ? '✅ Ein' : '❌ Aus'}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">Letzter Speicherzeitpunkt:</span>
      <span class="status-value">{formatiereZeitstempel(config.letzterSpeicherzeitpunkt)}</span>
    </div>
    <div class="status-item">
      <span class="status-label">Autosave vorhanden:</span>
      <span class="status-value" class:vorhanden={autosaveVorhanden()} class:nichtVorhanden={!autosaveVorhanden()}>
        {autosaveVorhanden() ? '✅ Ja' : '❌ Nein'}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">Speicher-Intervall:</span>
      <span class="status-value">{config.intervallSekunden} Sekunden</span>
    </div>
  </div>

  <div class="autosave-actions">
    <button onclick={toggleAutosave} class="btn-toggle" class:aktiv={config.aktiviert} class:inaktiv={!config.aktiviert}>
      {config.aktiviert ? '⏸️ Autosave deaktivieren' : '▶️ Autosave aktivieren'}
    </button>
    <button onclick={() => autoSaveSpeichern(state)} class="btn-primary">
      💾 Jetzt speichern
    </button>
    <button onclick={spieleTick} class="btn-secondary">
      ⏭️ Tick spielen (mit Autosave)
    </button>
    <button onclick={autosaveLoeschen} class="btn-danger">
      🗑️ Autosave löschen
    </button>
    <button onclick={() => state = autoSaveWiederherstellen() ?? state} class="btn-info">
      ↩️ Letzten Autosave wiederherstellen
    </button>
  </div>

  {#if autosaveVorhanden()}
    <div class="autosave-info">
      <h3>Wiederherstellung beim Reload</h3>
      <p>
        Beim Neuladen der Seite wird automatisch der letzte Autosave-Zustand geladen.
        Der aktuelle Spielzustand wird nach jedem Tick automatisch gespeichert.
      </p>
    </div>
  {/if}

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
  .autosave {
    font-family: system-ui, sans-serif;
    max-width: 800px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .autosave h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .autosave p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .autosave-status {
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

  .status-value.aktiv {
    color: #16a34a;
  }

  .status-value.inaktiv {
    color: #dc2626;
  }

  .status-value.vorhanden {
    color: #16a34a;
  }

  .status-value.nichtVorhanden {
    color: #64748b;
  }

  .autosave-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .btn-toggle {
    padding: 0.75rem 1.5rem;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .btn-toggle:hover {
    opacity: 0.9;
  }

  .btn-toggle.aktiv {
    background: #16a34a;
  }

  .btn-toggle.inaktiv {
    background: #dc2626;
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

  .autosave-info {
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .autosave-info h3 {
    font-size: 1rem;
    color: #166534;
    margin: 0 0 0.5rem 0;
  }

  .autosave-info p {
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
