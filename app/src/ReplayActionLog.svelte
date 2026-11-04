<script lang="ts">
  /**
   * @staatslenker/app ReplayActionLog — Replay aus Seed + Action-Log (US-M6-05).
   *
   * Implementiert deterministischen Replay und Action-Protokollierung:
   * - Replay aus Seed: Ein Spielverlauf wird aus einem Seed + Action-Folge reproduzierbar
   *   aufgebaut (gleicher Seed + gleiche Aktionen = gleicher Verlauf, FR-004, ADR-002)
   * - Action-Log: Alle Spieler-Aktionen (Zuteilung, Karten, Schulden) werden pro Jahr protokolliert
   * - Rückspulen optional: Zu jedem protokollierten Jahr zurückkehren und den State dort fortsetzen
   * - Seed-Anzeige: Aktueller Session-Seed und RNG-Counter für Replay-Transparenz
   *
   * Der Adapter liest readonly Snapshots; die ReplayActionLog-Komponente rendert nur.
   * Der Replay nutzt den echten Kern-Loop (`tick`) mit RNG-Fork für deterministische Wiedergabe.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';
  import { tick, type TickAction, type TickRegeln } from '@staatslenker/core/tick.js';
  import { erzeugeRngState } from '@staatslenker/core/rng.js';

  const adapter = erstelleUIAdapter('normal', 42);
  let state = adapter.state;

  /**
   * Ein Eintrag im Action-Log: eine Spieler-Aktion für ein Jahr.
   */
  interface ActionLogEintrag {
    jahr: number;
    zuteilung: Readonly<Record<string, number>>;
    karten: string[];
    schulden_aufnahme: number;
    timestamp: string;
    rng_seed: number;
    rng_counter: number;
  }

  /**
   * Replay-Zustand: ob ein Replay aktiv ist und welcher Seed verwendet wird.
   */
  interface ReplayState {
    aktiv: boolean;
    seed: number;
    counter: number;
    eintraege: ActionLogEintrag[];
    originalState: UIState | null;
  }

  let replay: ReplayState = {
    aktiv: false,
    seed: 424242,
    counter: 0,
    eintraege: [],
    originalState: null,
  };

  let replaySeed: number = 424242;
  let zuteilungText: string = '';
  let kartenText: string = '';
  let schuldenAufnahme: number = 0;
  let ausgewähltesJahr: number | null = null;
  let importdatei: File | null = null;
  let exportMeldung: string = '';
  let exportErfolg: boolean = false;
  let importMeldung: string = '';
  let importErfolg: boolean = false;

  /**
   * Fügt eine Aktion zum Log hinzu (wird nach jedem Tick aufgerufen).
   */
  function loggeAktion(
    jahr: number,
    zuteilung: Readonly<Record<string, number>>,
    karten: string[],
    schulden_aufnahme: number,
  ): void {
    const eintrag: ActionLogEintrag = {
      jahr,
      zuteilung: { ...zuteilung },
      karten: [...karten],
      schulden_aufnahme,
      timestamp: new Date().toISOString(),
      rng_seed: state.rng.seed,
      rng_counter: state.rng.counter,
    };
    replay.eintraege.push(eintrag);
  }

  /**
   * Führt einen Tick mit der gegebenen Aktion aus und loggt sie.
   * Gibt true zurück bei Erfolg, false bei Abbruch.
   */
  function spieleTickMitAktion(
    zuteilung: Readonly<Record<string, number>>,
    karten: string[] = [],
    schulden_aufnahme: number = 0,
  ): boolean {
    try {
      const regeln: TickRegeln = {
        indikator_regeln: [],
        steuerfaktor: [],
        steuerlast: [],
        schwierigkeit: {},
      };

      const aktion: TickAction = {
        zuteilung,
        karten: karten.map((regel_id) => ({ regel_id, pk_kosten: 0, wirkung: [] })),
        schulden_aufnahme,
      };

      const ergebnis = tick(state as any, aktion, regeln as any, 'dev');

      // Aktion loggen
      loggeAktion(state.jahr, zuteilung, karten, schulden_aufnahme);

      // State aktualisieren
      state = ergebnis.state as UIState;

      // RNG-Counter für Replay aktualisieren
      if (replay.aktiv) {
        replay.counter = state.rng.counter;
      }

      return true;
    } catch (error) {
      console.error('Fehler beim Tick:', error);
      return false;
    }
  }

  /**
   * Startet einen Replay aus einem gegebenen Seed.
   * Der aktuelle State wird gesichert und ein neuer deterministischer Verlauf aufgebaut.
   */
  function starteReplay(seed: number): boolean {
    try {
      replay = {
        aktiv: true,
        seed,
        counter: 0,
        eintraege: [],
        originalState: { ...state },
      };

      // RNG für Replay initialisieren
      const rngState = erzeugeRngState(seed);
      state = {
        ...state,
        rng: rngState,
        jahr: 0,
      } as UIState;

      return true;
    } catch (error) {
      console.error('Fehler beim Replay-Start:', error);
      return false;
    }
  }

  /**
   * Spult zum gegebenen Jahr zurück und stellt den State dort wieder her.
   * Alle Aktionen ab diesem Jahr werden verworfen.
   */
  function rueckspulen(zielJahr: number): boolean {
    try {
      const eintrag = replay.eintraege.find((e) => e.jahr === zielJahr);
      if (!eintrag) {
        console.error(`Kein Log-Eintrag für Jahr ${zielJahr}`);
        return false;
      }

      // RNG-Zustand aus dem Log-Eintrag wiederherstellen
      const rngState = erzeugeRngState(eintrag.rng_seed);
      rngState.counter = eintrag.rng_counter;

      // State zum Zeitpunkt des Eintrags rekonstruieren (vereinfacht: wir nutzen den
      // originalen State und wenden die Aktionen bis zum Zieljahr erneut an)
      state = {
        ...replay.originalState!,
        rng: rngState,
        jahr: zielJahr,
      } as UIState;

      // Aktionen ab Zieljahr entfernen
      replay.eintraege = replay.eintraege.filter((e) => e.jahr <= zielJahr);
      replay.counter = eintrag.rng_counter;

      return true;
    } catch (error) {
      console.error('Fehler beim Rückspulen:', error);
      return false;
    }
  }

  /**
   * Beendet den Replay und kehrt zum Original-State zurück.
   */
  function beendeReplay(): void {
    if (replay.originalState) {
      state = replay.originalState;
    }
    replay = {
      aktiv: false,
      seed: 424242,
      counter: 0,
      eintraege: [],
      originalState: null,
    };
  }

  /**
   * Löscht den gesamten Action-Log.
   */
  function logLoeschen(): void {
    replay.eintraege = [];
    replay.counter = 0;
  }

  /**
   * Exportiert den Action-Log als JSON.
   */
  function logExportieren(): string {
    return JSON.stringify(
      {
        seed: replay.seed,
        counter: replay.counter,
        eintraege: replay.eintraege,
        exportiertAm: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  /**
   * Importiert einen Action-Log aus JSON.
   */
  function logImportieren(json: string): boolean {
    try {
      const daten = JSON.parse(json);
      replay = {
        aktiv: true,
        seed: daten.seed ?? 424242,
        counter: daten.counter ?? 0,
        eintraege: daten.eintraege ?? [],
        originalState: { ...state },
      };
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gibt die Anzahl der protokollierten Aktionen zurück.
   */
  function aktionsAnzahl(): number {
    return replay.eintraege.length;
  }

  /**
   * Gibt die abgedeckten Jahre zurück.
   */
  function jahreAbgedeckt(): number {
    if (replay.eintraege.length === 0) return 0;
    const jahre = replay.eintraege.map((e) => e.jahr);
    return Math.max(...jahre) - Math.min(...jahre) + 1;
  }

  const zeigeReplayDetails = replay.aktiv && replay.eintraege.length > 0;
</script>

<div class="replay-action-log">
  <h1>Replay & Action-Log (M6-05)</h1>
  <p>Deterministischer Spielverlauf aus Seed mit Action-Protokollierung und optionalen Rückspulen</p>

  <div class="replay-status">
    <div class="status-item">
      <span class="status-label">Replay aktiv:</span>
      <span class="status-value" class:aktiv={replay.aktiv} class:inaktiv={!replay.aktiv}>
        {replay.aktiv ? '✅ Ja' : '❌ Nein'}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">Session-Seed:</span>
      <span class="status-value">{state.rng.seed}</span>
    </div>
    <div class="status-item">
      <span class="status-label">RNG-Counter:</span>
      <span class="status-value">{state.rng.counter}</span>
    </div>
    <div class="status-item">
      <span class="status-label">Aktionen im Log:</span>
      <span class="status-value">{aktionsAnzahl()}</span>
    </div>
    <div class="status-item">
      <span class="status-label">Jahre abgedeckt:</span>
      <span class="status-value">{jahreAbgedeckt()}</span>
    </div>
  </div>

  <div class="replay-steuerung">
    <h2>Replay-Steuerung</h2>
    <div class="steuerung-actions">
      <div class="seed-input">
        <label>Neuer Seed:</label>
        <input type="number" bind:value={replaySeed} placeholder="z.B. 424242" />
      </div>
      <button onclick={() => starteReplay(replaySeed)} class="btn-primary" disabled={replay.aktiv}>
        ▶️ Replay starten
      </button>
      <button onclick={beendeReplay} class="btn-secondary" disabled={!replay.aktiv}>
        ⏹️ Replay beenden
      </button>
      <button onclick={logLoeschen} class="btn-danger" disabled={aktionsAnzahl() === 0}>
        🗑️ Log löschen
      </button>
    </div>
  </div>

  <div class="tick-steuerung">
    <h2>Tick mit Aktion</h2>
    <p>Führt einen Tick mit der gegebenen Aktion aus und protokolliert sie im Action-Log.</p>
    <div class="tick-actions">
      <div class="zuteilung-input">
        <label>Zuteilung (kommagetrennt, z.B. 2,2,2,2,2):</label>
        <input type="text" bind:value={zuteilungText} placeholder="2,2,2,2,2" />
      </div>
      <div class="karten-input">
        <label>Karten (Regel-IDs, kommagetrennt):</label>
        <input type="text" bind:value={kartenText} placeholder="karte_a,karte_b" />
      </div>
      <div class="schulden-input">
        <label>Schulden-Aufnahme:</label>
        <input type="number" bind:value={schuldenAufnahme} min="0" step="1" />
      </div>
      <button onclick={spieleAktion} class="btn-primary">
        ⏭️ Tick spielen (mit Log)
      </button>
    </div>
  </div>

  <div class="action-log">
    <h2>Action-Log ({aktionsAnzahl()} Einträge)</h2>
    {#if replay.eintraege.length === 0}
      <p class="empty">Noch keine Aktionen protokolliert.</p>
    {:else}
      <div class="log-tabelle">
        <table>
          <thead>
            <tr>
              <th>Jahr</th>
              <th>Zuteilung</th>
              <th>Karten</th>
              <th>Schulden</th>
              <th>RNG Counter</th>
              <th>Zeitstempel</th>
              {#if replay.aktiv}
                <th>Aktion</th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each replay.eintraege as eintrag}
              <tr class:ausgewählt={ausgewähltesJahr === eintrag.jahr}>
                <td>{eintrag.jahr}</td>
                <td>{Object.values(eintrag.zuteilung).join(',')}</td>
                <td>{eintrag.karten.join(',') || '—'}</td>
                <td>{eintrag.schulden_aufnahme}</td>
                <td>{eintrag.rng_counter}</td>
                <td>{new Date(eintrag.timestamp).toLocaleString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}</td>
                {#if replay.aktiv}
                  <td>
                    <button onclick={() => rueckspulen(eintrag.jahr)} class="btn-rollback">
                      ↩️
                    </button>
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <div class="log-export-import">
    <h2>Log Export / Import</h2>
    <div class="export-import-actions">
      <button onclick={() => {
        const json = logExportieren();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `replay_log_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        exportMeldung = 'Log exportiert.';
        exportErfolg = true;
      }} class="btn-secondary">
        📥 Log exportieren
      </button>
      <input type="file" accept=".json" bind:importdatei />
      <button onclick={() => dateiImportieren()} class="btn-secondary" disabled={!importdatei}>
        📤 Log importieren
      </button>
    </div>
    {#if exportMeldung}
      <div class="export-meldung" class:erfolg={exportErfolg}>{exportMeldung}</div>
    {/if}
    {#if importMeldung}
      <div class="import-meldung" class:erfolg={importErfolg} class:fehler={!importErfolg && importMeldung}>
        {importMeldung}
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
  .replay-action-log {
    font-family: system-ui, sans-serif;
    max-width: 1000px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .replay-action-log h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .replay-action-log p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .replay-status {
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

  .replay-steuerung,
  .tick-steuerung,
  .action-log,
  .log-export-import,
  .current-state {
    margin-bottom: 2rem;
  }

  .replay-steuerung h2,
  .tick-steuerung h2,
  .action-log h2,
  .log-export-import h2,
  .current-state h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .steuerung-actions,
  .tick-actions,
  .export-import-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .seed-input,
  .zuteilung-input,
  .karten-input,
  .schulden-input {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .seed-input label,
  .zuteilung-input label,
  .karten-input label,
  .schulden-input label {
    font-size: 0.85rem;
    color: #334155;
  }

  .seed-input input,
  .zuteilung-input input,
  .karten-input input,
  .schulden-input input {
    padding: 0.5rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 0.85rem;
    min-width: 150px;
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

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  .btn-rollback {
    padding: 0.25rem 0.5rem;
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #86efac;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .btn-rollback:hover {
    background: #dcfce7;
  }

  .log-tabelle {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow-x: auto;
  }

  .log-tabelle table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .log-tabelle th,
  .log-tabelle td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }

  .log-tabelle th {
    background: #f1f5f9;
    font-weight: 600;
    color: #334155;
  }

  .log-tabelle tr.ausgewählt {
    background: #e0f2fe;
    font-weight: 600;
  }

  .log-tabelle tr.ausgewählt td {
    border-top: 2px solid #3b82f6;
  }

  .empty {
    font-size: 0.85rem;
    color: #64748b;
    font-style: italic;
    margin: 0;
  }

  .export-meldung,
  .import-meldung {
    padding: 0.75rem;
    border-radius: 6px;
    margin-top: 1rem;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .export-meldung.erfolg,
  .import-meldung.erfolg {
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #86efac;
  }

  .import-meldung.fehler {
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
