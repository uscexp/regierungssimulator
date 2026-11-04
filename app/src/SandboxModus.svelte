<script lang="ts">
  /**
   * @staatslenker/app SandboxModus — Endloser Sandbox-Modus ohne Spielende (US-M6-10).
   *
   * Implementiert den Sandbox-Modus, der das Spielende deaktiviert und endloses
   * Weiterspielen erlaubt:
   * - Spielende (Wahl-Niederlage) wird unterdrückt — Game-Over-Screen nicht angezeigt
   *   Spiel läuft endlos weiter über Jahr 6 hinaus
   *   Score-Berechnung läuft weiter (Entwicklungsindex, Zufriedenheit, Regime-Dauer)
   *   Alle Indikatoren, Gruppen und Budget laufen weiter
   *   Sandbox-Modus kann ein-/ausgeschaltet werden
   *   Sandbox-Status wird im State gespeichert
   *
   * Der Adapter liest readonly Snapshots; die SandboxModus-Komponente rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  const adapter = erstelleUIAdapter('normal', 42);
  let state = adapter.state;

  /**
   * Sandbox-Modus Konfiguration.
   */
  interface SandboxConfig {
    aktiviert: boolean;
    spielendeUnterdrueckt: boolean;
    endloserModus: boolean;
    scoreLauftWeiter: boolean;
    indikatorenLaufenWeiter: boolean;
  }

  const STANDARD_CONFIG: SandboxConfig = {
    aktiviert: false,
    spielendeUnterdrueckt: true,
    endloserModus: true,
    scoreLauftWeiter: true,
    indikatorenLaufenWeiter: true,
  };

  let config: SandboxConfig = { ...STANDARD_CONFIG };

  /**
   * Prüft, ob das Spiel im Sandbox-Modus läuft.
   */
  function istSandboxAktiv(): boolean {
    return config.aktiviert;
  }

  /**
   * Prüft, ob das Spielende unterdrückt wird.
   */
  function istSpielendeUnterdrueckt(): boolean {
    return config.aktiviert && config.spielendeUnterdrueckt;
  }

  /**
   * Prüft, ob der Endloser-Modus aktiv ist.
   */
  function istEndloserModus(): boolean {
    return config.aktiviert && config.endloserModus;
  }

  /**
   * Schaltet den Sandbox-Modus ein/aus.
   */
  function toggleSandboxModus(): void {
    config.aktiviert = !config.aktiviert;
  }

  /**
   * Schaltet die Spielende-Unterdrückung ein/aus.
   */
  function toggleSpielendeUnterdrueckt(): void {
    if (config.aktiviert) {
      config.spielendeUnterdrueckt = !config.spielendeUnterdrueckt;
    }
  }

  /**
   * Schaltet den Endloser-Modus ein/aus.
   */
  function toggleEndloserModus(): void {
    if (config.aktiviert) {
      config.endloserModus = !config.endloserModus;
    }
  }

  /**
   * Gibt an, ob der Game-Over-Screen angezeigt werden darf.
   * Im Sandbox-Modus nie, außerhalb immer.
   */
  function darfGameOverAngezeigtWerden(state: UIState): boolean {
    if (istSpielendeUnterdrueckt()) {
      return false;
    }
    return state.wahl_niederlage !== undefined;
  }

  /**
   * Berechnet den fortlaufenden Score im Sandbox-Modus.
   * Nutzt dieselbe Logik wie ScoreEntwicklung (US-M6-06).
   */
  function berechneSandboxScore(state: UIState): number {
    const indikatoren = state.indikatoren;
    const gruppen = state.gruppen;

    const gewichte: Readonly<Record<string, number>> = {
      wirtschaft: 0.25,
      gesundheit: 0.20,
      bildung: 0.20,
      infrastruktur: 0.20,
      forschung: 0.15,
    };
    let gewichteteSumme = 0;
    let gewichtSumme = 0;
    for (const [tag, gewicht] of Object.entries(gewichte)) {
      const wert = indikatoren[tag];
      if (wert !== undefined) {
        gewichteteSumme += wert * gewicht;
        gewichtSumme += gewicht;
      }
    }
    const entwicklungsindex = gewichtSumme === 0 ? 0 : Math.round((gewichteteSumme / gewichtSumme) * 10) / 10;

    const zufriedenheitO =
      gruppen.length > 0
        ? Math.round((gruppen.reduce((acc, g) => acc + g.zufriedenheit, 0) / gruppen.length) * 10) / 10
        : 0;

    const regimeDauerSkaliert = Math.min(100, (state.jahr / 50) * 100);

    const gewichtung = { entwicklungsindex: 40, zufriedenheit: 45, regimeDauer: 15 };

    const score =
      (entwicklungsindex * gewichtung.entwicklungsindex +
        zufriedenheitO * gewichtung.zufriedenheit +
        regimeDauerSkaliert * gewichtung.regimeDauer) /
      100;

    return Math.round(score * 10) / 10;
  }

  /**
   * Gibt die Score-Bewertung zurück.
   */
  function scoreBewertung(score: number): string {
    if (score >= 80) return 'exzellent';
    if (score >= 65) return 'gut';
    if (score >= 50) return 'befriedigend';
    if (score >= 35) return 'ausreichend';
    if (score >= 20) return 'mangelhaft';
    return 'ungenügend';
  }

  /**
   * Gibt die Score-Farbe zurück.
   */
  function scoreFarbe(score: number): string {
    if (score >= 80) return '#16a34a';
    if (score >= 65) return '#22c55e';
    if (score >= 50) return '#eab308';
    if (score >= 35) return '#f59e0b';
    if (score >= 20) return '#f97316';
    return '#dc2626';
  }

  /**
   * Prüft, ob der Sandbox-Modus den Spielstand beeinflusst.
   */
  function istSandboxRelevant(state: UIState): boolean {
    return config.aktiviert && state.wahl_niederlage !== undefined;
  }

  const sandboxScore = berechneSandboxScore(state);
  const sandboxBewertung = scoreBewertung(sandboxScore);
  const sandboxFarbe = scoreFarbe(sandboxScore);
</script>

<div class="sandbox-modus">
  <h1>Sandbox-Modus (M6-10)</h1>
  <p>Endloser Spielmodus ohne Spielende — spielen Sie so lange Sie möchten</p>

  <div class="sandbox-status">
    <div class="status-item">
      <span class="status-label">Sandbox-Modus:</span>
      <span class="status-value" class:aktiv={config.aktiviert} class:inaktiv={!config.aktiviert}>
        {config.aktiviert ? '✅ Aktiv' : '❌ Aus'}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">Spielende unterdrückt:</span>
      <span class="status-value" class:aktiv={config.spielendeUnterdrueckt} class:inaktiv={!config.spielendeUnterdrueckt}>
        {config.spielendeUnterdrueckt ? '✅ Ja' : '❌ Nein'}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">Endloser Modus:</span>
      <span class="status-value" class:aktiv={config.endloserModus} class:inaktiv={!config.endloserModus}>
        {config.endloserModus ? '✅ Ja' : '❌ Nein'}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">Score läuft weiter:</span>
      <span class="status-value" class:aktiv={config.scoreLauftWeiter} class:inaktiv={!config.scoreLauftWeiter}>
        {config.scoreLauftWeiter ? '✅ Ja' : '❌ Nein'}
      </span>
    </div>
  </div>

  <div class="sandbox-steuerung">
    <h2>Sandbox-Steuerung</h2>
    <div class="steuerung-buttons">
      <button onclick={toggleSandboxModus} class="btn-toggle" class:aktiv={config.aktiviert} class:inaktiv={!config.aktiviert}>
        {config.aktiviert ? '⏹️ Sandbox-Modus deaktivieren' : '▶️ Sandbox-Modus aktivieren'}
      </button>
      <button onclick={toggleSpielendeUnterdrueckt} class="btn-toggle" class:aktiv={config.spielendeUnterdrueckt} class:inaktiv={!config.spielendeUnterdrueckt} :disabled={!config.aktiviert}>
        {config.spielendeUnterdrueckt ? '⚠️ Spielende wieder erlauben' : '🛡️ Spielende unterdrücken'}
      </button>
      <button onclick={toggleEndloserModus} class="btn-toggle" class:aktiv={config.endloserModus} class:inaktiv={!config.endloserModus} :disabled={!config.aktiviert}>
        {config.endloserModus ? '⏹️ Endloser Modus deaktivieren' : '♾️ Endloser Modus aktivieren'}
      </button>
    </div>
  </div>

  {#if config.aktiviert}
    <div class="sandbox-info">
      <h3>Sandbox-Modus aktiv</h3>
      <p>
        Das Spiel läuft endlos weiter. Der Game-Over-Screen wird nicht angezeigt,
        selbst wenn eine Wahl verloren wird. Alle Indikatoren, Gruppen und das
        Budget laufen weiter. Der Score wird kontinuierlich berechnet.
      </p>
    </div>
  {/if}

  <div class="sandbox-score">
    <h2>Aktueller Sandbox-Score</h2>
    <div class="score-wert" style:color={sandboxFarbe}>{sandboxScore}</div>
    <div class="score-bewertung" style:color={sandboxFarbe}>{sandboxBewertung}</div>
    <p class="score-hinweis">
      Im Sandbox-Modus läuft der Score endlos weiter — es gibt kein Spielende,
      daher steigt der Regime-Dauer-Anteil mit jedem Jahr weiter an.
    </p>
  </div>

  <div class="spielstand">
    <h2>Aktueller Spielstand</h2>
    <div class="stand-grid">
      <div class="stand-karte">
        <span class="stand-label">Jahr:</span>
        <span class="stand-wert">{state.jahr}</span>
      </div>
      <div class="stand-karte">
        <span class="stand-label">Legitimität:</span>
        <span class="stand-wert">{state.legitimität}</span>
      </div>
      <div class="stand-karte">
        <span class="stand-label">Politisches Kapital:</span>
        <span class="stand-wert">{state.pk}</span>
      </div>
      <div class="stand-karte">
        <span class="stand-label">Schulden:</span>
        <span class="stand-wert">{state.schulden}</span>
      </div>
      <div class="stand-karte">
        <span class="stand-label">Radikalisierung:</span>
        <span class="stand-wert">{state.radikalisierung}</span>
      </div>
      {#if state.wahl_niederlage}
        <div class="stand-karte stand-karte--wahlverlust">
          <span class="stand-label">Wahl-Niederlage:</span>
          <span class="stand-wert stand-wert--kritisch">Ja (Jahr {state.wahl_niederlage.jahr})</span>
        </div>
      {/if}
    </div>
    {#if state.wahl_niederlage && config.spielendeUnterdrueckt}
      <div class="spielende-hinweis">
        <span class="hinweis-icon">🛡️</span>
        <span class="hinweis-text">
          Wahl-Niederlage im Jahr {state.wahl_niederlage.jahr} wurde unterdrückt — Spiel läuft im Sandbox-Modus weiter.
        </span>
      </div>
    {/if}
  </div>

  <div class="sandbox-hinweis">
    <h3>Funktionsweise</h3>
    <ul>
      <li><strong>Spielende unterdrückt:</strong> Die Wahl-Niederlage wird nicht als Spielende gewertet. Der Game-Over-Screen wird nicht angezeigt.</li>
      <li><strong>Endloser Modus:</strong> Das Spiel läuft über Jahr 6 hinaus weiter. Alle Spielmechaniken bleiben aktiv.</li>
      <li><strong>Score-Berechnung:</strong> Der Score wird kontinuierlich neu berechnet. Der Regime-Dauer-Anteil steigt mit jedem Jahr.</li>
      <li><strong>Indikatoren:</strong> Alle Indikatoren, Gruppen und das Budget laufen normal weiter.</li>
      <li><strong>Keine neue Mechanik:</strong> Der Sandbox-Modus ist ein reiner Parameter-Set — er unterdrückt nur die Spielende-Prüfung.</li>
    </ul>
  </div>
</div>

<style>
  .sandbox-modus {
    font-family: system-ui, sans-serif;
    max-width: 900px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .sandbox-modus h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .sandbox-modus p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .sandbox-status {
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

  .sandbox-steuerung {
    margin-bottom: 2rem;
  }

  .sandbox-steuerung h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .steuerung-buttons {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-toggle.aktiv {
    background: #16a34a;
  }

  .btn-toggle.aktiv:hover {
    background: #15803d;
  }

  .btn-toggle.inaktiv {
    background: #3b82f6;
  }

  .btn-toggle.inaktiv:hover {
    background: #2563eb;
  }

  .btn-toggle:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .sandbox-info {
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 2rem;
  }

  .sandbox-info h3 {
    font-size: 1rem;
    color: #166534;
    margin: 0 0 0.5rem 0;
  }

  .sandbox-info p {
    margin: 0;
    font-size: 0.85rem;
    color: #166534;
  }

  .sandbox-score {
    margin-bottom: 2rem;
  }

  .sandbox-score h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .score-wert {
    font-size: 3rem;
    font-weight: 700;
  }

  .score-bewertung {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .score-hinweis {
    font-size: 0.85rem;
    color: #64748b;
    margin-top: 0.5rem;
  }

  .spielstand {
    margin-bottom: 2rem;
  }

  .spielstand h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .stand-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .stand-karte {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
    text-align: center;
  }

  .stand-karte--wahlverlust {
    background: #fef2f2;
    border-color: #fecaca;
  }

  .stand-label {
    font-size: 0.8rem;
    color: #64748b;
    display: block;
    margin-bottom: 0.25rem;
  }

  .stand-wert {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
  }

  .stand-wert--kritisch {
    color: #dc2626;
  }

  .spielende-hinweis {
    margin-top: 1rem;
    padding: 0.75rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #991b1b;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .hinweis-icon {
    font-size: 1.25rem;
  }

  .hinweis-text {
    font-weight: 600;
  }

  .sandbox-hinweis {
    margin-bottom: 2rem;
  }

  .sandbox-hinweis h3 {
    font-size: 1rem;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .sandbox-hinweis ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #475569;
    font-size: 0.85rem;
    line-height: 1.6;
  }

  .sandbox-hinweis li {
    margin-bottom: 0.4rem;
  }
</style>
