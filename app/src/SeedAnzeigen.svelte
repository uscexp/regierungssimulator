<script lang="ts">
  /**
   * @staatslenker/app SeedAnzeigen — Seed anzeigen/kopieren/weitergeben (US-M6-11).
   *
   * Implementiert die Anzeige und Weitergabe des Session-Seeds für Replay-Transparenz:
   * - Seed anzeigen: Aktuellen Session-Seed prominent anzeigen
   *   Seed kopieren: Seed in Zwischenablage kopieren (Clipboard API)
   *   Seed weitergeben: Seed als Text/Link zum Teilen vorbereiten
   *   Seed-Historie: Letzte verwendete Seeds anzeigen
   *   Seed-Validierung: Prüft ob Seed gültig ist (endliche Zahl)
   *
   * Der Adapter liest readonly Snapshots; die SeedAnzeigen-Komponente rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  const adapter = erstelleUIAdapter('normal', 42);
  let state = adapter.state;

  /**
   * Seed-Historie Eintrag.
   */
  interface SeedHistoryEntry {
    seed: number;
    verwendetAm: string;
    jahr: number;
  }

  /**
   * Maximale Anzahl Einträge im Seed-Historie.
   */
  const MAX_SEED_HISTORY = 10;

  /**
   * Lädt den Seed-Historie aus localStorage.
   */
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

  /**
   * Speichert den Seed-Historie in localStorage.
   */
  function seedHistorySpeichern(history: SeedHistoryEntry[]): void {
    try {
      localStorage.setItem('staatslenker_seed_history', JSON.stringify(history));
    } catch {
      // Ignorieren im Fehlerfall
    }
  }

  /**
   * Fügt einen Seed zum Historie hinzu.
   */
  function seedHistoryHinzufuegen(seed: number, jahr: number): void {
    const history = seedHistoryLaden();
    const eintrag: SeedHistoryEntry = {
      seed,
      verwendetAm: new Date().toISOString(),
      jahr,
    };
    // Entferne Duplikate (gleicher Seed)
    const gefiltert = history.filter((e) => e.seed !== seed);
    gefiltert.unshift(eintrag);
    // Behalte nur die letzten MAX_SEED_HISTORY Einträge
    seedHistorySpeichern(gefiltert.slice(0, MAX_SEED_HISTORY));
  }

  /**
   * Entfernt einen Seed aus dem Historie.
   */
  function seedHistoryEntfernen(seed: number): void {
    const history = seedHistoryLaden().filter((e) => e.seed !== seed);
    seedHistorySpeichern(history);
  }

  /**
   * Löscht den gesamten Seed-Historie.
   */
  function seedHistoryLeeren(): void {
    try {
      localStorage.removeItem('staatslenker_seed_history');
    } catch {
      // Ignorieren
    }
  }

  /**
   * Validiert einen Seed-Wert.
   * Gibt true zurück wenn der Seed gültig ist (endliche Zahl).
   */
  function istSeedGueltig(seed: unknown): seed is number {
    return typeof seed === 'number' && Number.isFinite(seed);
  }

  /**
   * Kopiert einen Wert in die Zwischenablage.
   * Gibt true zurück bei Erfolg, false bei Fehler.
   */
  function inZwischenablageKopieren(text: string): boolean {
    try {
      navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback für ältere Browser
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Kopiert den aktuellen Seed in die Zwischenablage.
   * Gibt true zurück bei Erfolg.
   */
  function kopiereSeed(): boolean {
    return inZwischenablageKopieren(String(state.rng.seed));
  }

  /**
   * Kopiert einen bestimmten Seed in die Zwischenablage.
   * Gibt true zurück bei Erfolg.
   */
  function kopiereSeedWert(seed: number): boolean {
    return inZwischenablageKopieren(String(seed));
  }

  /**
   * Erstellt einen Teil-Text für den Seed.
   */
  function erstelleTeilText(seed: number, jahr: number): string {
    return `Staatslenker Spielstand\nSeed: ${seed}\nJahr: ${jahr}\n`;
  }

  /**
   * Kopiert den Teil-Text in die Zwischenablage.
   * Gibt true zurück bei Erfolg.
   */
  function kopiereTeiltext(): boolean {
    return inZwischenablageKopieren(
      erstelleTeilText(state.rng.seed, state.jahr)
    );
  }

  /**
   * Gibt die Seed-Farbe zurück (basierend auf Wert).
   */
  function seedFarbe(seed: number): string {
    // Deterministische Farbe basierend auf Seed
    const hue = seed % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  /**
   * Prüft ob der aktuelle Seed bereits im Historie ist.
   */
  function istSeedImHistorie(seed: number): boolean {
    return seedHistoryLaden().some((e) => e.seed === seed);
  }

  // Aktuellen Seed zum Historie hinzufügen (bei initialer Renderung)
  // Wird erst bei expliziter Aktion hinzugefügt, nicht automatisch

  const currentSeed = state.rng.seed;
  const currentJahr = state.jahr;
  const seedHistory = seedHistoryLaden();
  const seedIstImHistorie = istSeedImHistorie(currentSeed);
</script>

<div class="seed-anzeigen">
  <h1>Seed anzeigen/kopieren/weitergeben (M6-11)</h1>
  <p>Session-Seed für Replay-Transparenz und Wiederholbarkeit von Spielverläufen</p>

  <div class="seed-status">
    <div class="status-item">
      <span class="status-label">Aktueller Seed:</span>
      <span class="status-seed" style:color={seedFarbe(currentSeed)}>{currentSeed}</span>
    </div>
    <div class="status-item">
      <span class="status-label">Jahr:</span>
      <span class="status-value">{currentJahr}</span>
    </div>
    <div class="status-item">
      <span class="status-label">Im Historie:</span>
      <span class="status-value" class:ja={seedIstImHistorie} class:nein={!seedIstImHistorie}>
        {seedIstImHistorie ? '✅ Ja' : '❌ Nein'}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">Seed gültig:</span>
      <span class="status-value" class:gueltig={istSeedGueltig(currentSeed)} class:ungueltig={!istSeedGueltig(currentSeed)}>
        {istSeedGueltig(currentSeed) ? '✅ Ja' : '❌ Nein'}
      </span>
    </div>
  </div>

  <div class="seed-aktionen">
    <h2>Seed-Aktionen</h2>
    <div class="aktionen-grid">
      <button onclick={kopiereSeed} class="btn-primary">
        📋 Seed kopieren
      </button>
      <button onclick={kopiereTeiltext} class="btn-secondary">
        📤 Teiltext kopieren
      </button>
      <button onclick={() => seedHistoryHinzufuegen(currentSeed, currentJahr)} class="btn-info">
        ➕ Zum Historie hinzufügen
      </button>
      <button onclick={seedHistoryLeeren} class="btn-danger" :disabled={seedHistory.length === 0}>
        🗑️ Historie leeren
      </button>
    </div>
  </div>

  <div class="seed-historie">
    <h2>Seed-Historie ({seedHistory.length} Einträge)</h2>
    {#if seedHistory.length === 0}
      <p class="empty">Keine Seed-Einträge im Historie.</p>
    {:else}
      <div class="historie-liste">
        {#each seedHistory as eintrag}
          <div class="historie-eintrag">
            <span class="historie-seed" style:color={seedFarbe(eintrag.seed)}>{eintrag.seed}</span>
            <span class="historie-jahr">Jahr {eintrag.jahr}</span>
            <span class="historie-datum">{new Date(eintrag.verwendetAm).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}</span>
            <button onclick={() => kopiereSeedWert(eintrag.seed)} class="btn-kopieren-klein">
              📋
            </button>
            <button onclick={() => seedHistoryEntfernen(eintrag.seed)} class="btn-entfernen-klein">
              🗑️
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="seed-teilen">
    <h2>Seed weitergeben</h2>
    <p>
      Teilen Sie diesen Seed mit anderen Spielern, damit sie denselben Spielverlauf
      reproduzieren können (gleicher Seed + gleiche Aktionen = gleicher Verlauf).
    </p>
    <div class="teilen-aktionen">
      <button onclick={kopiereTeiltext} class="btn-primary">
        📤 Teiltext kopieren
      </button>
      <div class="teiltext-vorschau">
        <span class="vorschau-label">Vorschau:</span>
        <span class="vorschau-text">{erstelleTeilText(currentSeed, currentJahr).replace(/\n/g, ' | ')}</span>
      </div>
    </div>
  </div>

  <div class="seed-hinweis">
    <h3>Wozu dient der Seed?</h3>
    <ul>
      <li><strong>Replay-Transparenz:</strong> Gleicher Seed + gleiche Aktionen = identischer Spielverlauf</li>
      <li><strong>Wiederholbarkeit:</strong> Bekannte Spielstände können exakt nachgespielt werden</li>
      <li><strong>Fehleranalyse:</strong> Bei Problemen kann der Seed weitergegeben werden zur Reproduktion</li>
      <li><strong>Wettbewerb:</strong> Gleicher Startzustand für faire Vergleiche zwischen Spielern</li>
    </ul>
  </div>
</div>

<style>
  .seed-anzeigen {
    font-family: system-ui, sans-serif;
    max-width: 900px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .seed-anzeigen h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .seed-anzeigen p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .seed-status {
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

  .status-seed {
    font-size: 1.25rem;
    font-weight: 700;
    font-family: monospace;
  }

  .status-value.ja {
    color: #16a34a;
  }

  .status-value.nein {
    color: #dc2626;
  }

  .status-value.gueltig {
    color: #16a34a;
  }

  .status-value.ungueltig {
    color: #dc2626;
  }

  .seed-aktionen {
    margin-bottom: 2rem;
  }

  .seed-aktionen h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .aktionen-grid {
    display: flex;
    gap: 0.5rem;
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-danger:hover:not(:disabled) {
    background: #fee2e2;
  }

  .btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-kopieren-klein,
  .btn-entfernen-klein {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-kopieren-klein {
    background: #eff6ff;
    color: #1e40af;
    border: 1px solid #bfdbfe;
  }

  .btn-kopieren-klein:hover {
    background: #dbeafe;
  }

  .btn-entfernen-klein {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  .btn-entfernen-klein:hover {
    background: #fee2e2;
  }

  .seed-historie {
    margin-bottom: 2rem;
  }

  .seed-historie h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .empty {
    font-size: 0.85rem;
    color: #64748b;
    font-style: italic;
    margin: 0;
  }

  .historie-liste {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .historie-eintrag {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }

  .historie-seed {
    font-size: 1rem;
    font-weight: 600;
    font-family: monospace;
  }

  .historie-jahr {
    font-size: 0.85rem;
    color: #64748b;
  }

  .historie-datum {
    font-size: 0.75rem;
    color: #94a3b8;
    font-family: monospace;
  }

  .seed-teilen {
    margin-bottom: 2rem;
  }

  .seed-teilen h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .seed-teilen p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1rem;
  }

  .teilen-aktionen {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .vorschau-label {
    font-size: 0.8rem;
    color: #64748b;
    font-weight: 600;
    margin-right: 0.5rem;
  }

  .vorschau-text {
    font-size: 0.8rem;
    font-family: monospace;
    color: #334155;
    background: #f1f5f9;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .seed-hinweis {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
  }

  .seed-hinweis h3 {
    font-size: 1rem;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .seed-hinweis ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #475569;
    font-size: 0.85rem;
    line-height: 1.6;
  }

  .seed-hinweis li {
    margin-bottom: 0.4rem;
  }
</style>
