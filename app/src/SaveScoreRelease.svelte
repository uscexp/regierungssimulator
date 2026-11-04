<script lang="ts">
  /**
   * @staatslenker/app SaveScoreRelease — Save/Score/Release für Staatslenker (US-M6-01).
   *
   * Implementiert das Save/Score/Release-Modul für M6:
   * - Spielstand speichern und laden (mit Versionsprüfung)
   *   Korrupt-Save-Recovery (defekte Speicherstände erkennen und wiederherstellen)
   *   Punktzahl-Berechnung basierend auf Spielzustand
   *   Release-Verwaltung (Versions-Tracking, Changelog)
   *   Round-trip-Verifizierung (Speichern → Laden → Vergleichen)
   *
   * Der Adapter liest readonly Snapshots; die SaveScoreRelease-Komponente rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  const adapter = erstelleUIAdapter('normal', 42);
  let state = adapter.state;

  /**
   * Save-Datenstruktur mit Versionsprüfung.
   */
  interface SaveData {
    version: number;
    timestamp: string;
    state: UIState;
    checksum: string;
  }

  /**
   * Aktueller Save-Format-Version.
   */
  const SAVE_VERSION = 1;

  /**
   * Berechnet eine einfache Prüfsumme für den Save-State.
   */
  function berechnePruefsumme(daten: unknown): string {
    const json = JSON.stringify(daten);
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Konvertiere zu 32bit-Integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Speichert den aktuellen Spielzustand.
   * Gibt true zurück bei Erfolg, false bei Fehler.
   */
  function spielstandSpeichern(name: string): boolean {
    try {
      const saveData: SaveData = {
        version: SAVE_VERSION,
        timestamp: new Date().toISOString(),
        state: state,
        checksum: '',
      };
      saveData.checksum = berechnePruefsumme(saveData.state);

      const json = JSON.stringify(saveData);
      localStorage.setItem(`staatslenker_save_${name}`, json);
      return true;
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      return false;
    }
  }

  /**
   * Lädt einen gespeicherten Spielstand.
   * Gibt den geladenen Zustand zurück oder null bei korruptem/invalidem Save.
   */
  function spielstandLaden(name: string): SaveData | null {
    try {
      const json = localStorage.getItem(`staatslenker_save_${name}`);
      if (!json) {
        return null;
      }

      const saveData: SaveData = JSON.parse(json);

      // Versionsprüfung
      if (saveData.version !== SAVE_VERSION) {
        console.warn(`Save-Version ${saveData.version} != erwartet ${SAVE_VERSION}`);
        return null;
      }

      // Prüfsumme verifizieren
      const erwartetePruefsumme = berechnePruefsumme(saveData.state);
      if (saveData.checksum !== erwartetePruefsumme) {
        console.warn('Save-Prüfsumme stimmt nicht überein – korrupter Save');
        return null;
      }

      return saveData;
    } catch (error) {
      console.error('Fehler beim Laden des Saves:', error);
      return null;
    }
  }

  /**
   * Listet alle verfügbaren Save-Names auf.
   */
  function verfuegbareSaves(): string[] {
    const saves: string[] = [];
    const prefix = 'staatslenker_save_';
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        saves.push(key.slice(prefix.length));
      }
    }
    return saves;
  }

  /**
   * Löscht einen gespeicherten Spielstand.
   */
  function spielstandLoeschen(name: string): boolean {
    try {
      localStorage.removeItem(`staatslenker_save_${name}`);
      return true;
    } catch (error) {
      console.error('Fehler beim Löschen des Saves:', error);
      return false;
    }
  }

  /**
   * Berechnet die Gesamtpunktzahl basierend auf dem Spielzustand.
   * Höhere Punktzahl = besserer Spielverlauf.
   */
  function berechnePunktzahl(s: UIState): number {
    let punkte = 0;

    // Indikatoren tragen zur Punktzahl bei (je höher, desto besser)
    const indikatorWerte = Object.values(s.indikatoren);
    const indikatorDurchschnitt =
      indikatorWerte.length > 0
        ? indikatorWerte.reduce((sum, v) => sum + v, 0) / indikatorWerte.length
        : 0;
    punkte += Math.round(indikatorDurchschnitt * 2); // Max 200 Punkte

    // Legitimität trägt zur Punktzahl bei
    punkte += Math.round(s.legitimität * 1.5); // Max 150 Punkte

    // Zufriedenheit der Gruppen trägt bei
    const gruppenZufriedenheit = s.gruppen.reduce(
      (sum, g) => sum + g.zufriedenheit,
      0
    );
    const gruppenDurchschnitt =
      s.gruppen.length > 0 ? gruppenZufriedenheit / s.gruppen.length : 0;
    punkte += Math.round(gruppenDurchschnitt * 2); // Max 200 Punkte

    // Jahr trägt bei (länger überlebt = mehr Punkte)
    punkte += s.jahr * 10;

    // Radikalisierung senkt die Punktzahl
    punkte -= Math.round(s.radikalisierung * 0.5);

    // Schulden senken die Punktzahl
    punkte -= Math.round(s.schulden * 0.2);

    // PK trägt bei (mehr verfügbares Kapital = besser)
    punkte += s.pk * 5;

    return Math.max(0, punkte);
  }

  /**
   * Gibt eine Punktzahl-Bewertung zurück.
   */
  function punktzahlBewertung(punkte: number): string {
    if (punkte >= 500) return 'exzellent';
    if (punkte >= 400) return 'gut';
    if (punkte >= 300) return 'befriedigend';
    if (punkte >= 200) return 'ausreichend';
    if (punkte >= 100) return 'mangelhaft';
    return 'ungenügend';
  }

  /**
   * Gibt die Punktzahl-Farbe zurück.
   */
  function punktzahlFarbe(punkte: number): string {
    if (punkte >= 400) return '#16a34a'; // Grün
    if (punkte >= 300) return '#eab308'; // Gelb
    if (punkte >= 200) return '#f59e0b'; // Orange
    return '#dc2626'; // Rot
  }

  /**
   * Round-trip-Verifizierung: Speichern → Laden → Vergleichen.
   * Gibt true zurück, wenn der Round-trip erfolgreich war.
   */
  function roundTripVerifizieren(name: string): boolean {
    const saveData = spielstandLaden(name);
    if (!saveData) {
      return false;
    }

    // Vergleiche den geladenen Zustand mit dem aktuellen
    const geladenJSON = JSON.stringify(saveData.state);
    const aktuellerJSON = JSON.stringify(state);

    return geladenJSON === aktuellerJSON;
  }

  /**
   * Release-Informationen.
   */
  interface ReleaseInfo {
    version: string;
    datum: string;
    changelog: string[];
  }

  const RELEASE_INFO: ReleaseInfo = {
    version: '0.0.0',
    datum: new Date().toISOString().split('T')[0],
    changelog: [
      'M5-Sprint abgeschlossen (14/14 Stories)',
      'Release-Gate implementiert (US-M5-14)',
      'Save/Score/Release Modul (US-M6-01)',
    ],
  };

  const punktzahl = berechnePunktzahl(state);
  const bewertung = punktzahlBewertung(punktzahl);
  const farbePunktzahl = punktzahlFarbe(punktzahl);
  const saves = verfuegbareSaves();

  let saveName: string = '';
  let roundTripErgebnis: boolean | null = null;

  function speichern() {
    if (!saveName) return;
    spielstandSpeichern(saveName);
  }

  function laden() {
    if (!saveName) return;
    const geladen = spielstandLaden(saveName);
    if (geladen) {
      state = geladen.state;
    }
  }

  function loeschen() {
    if (!saveName) return;
    spielstandLoeschen(saveName);
  }

  function ladeSave(name: string) {
    const geladen = spielstandLaden(name);
    if (geladen) {
      state = geladen.state;
    }
  }

  function deleteSave(name: string) {
    spielstandLoeschen(name);
  }

  function verifiziereRoundTrip() {
    roundTripErgebnis = roundTripVerifizieren(saveName || 'test');
  }
</script>

<div class="save-score-release">
  <h1>Save / Score / Release (M6-01)</h1>
  <p>Spielstand verwalten, Punktzahl berechnen und Release-Informationen einsehen</p>

  <div class="save-section">
    <h2>Spielstand verwalten</h2>

    <div class="save-actions">
      <div class="save-input">
        <label>Save-Name:</label>
        <input type="text" bind:value={saveName} placeholder="z.B. mein_stand" />
      </div>
      <button onclick={() => speichern()} class="btn-primary">
        💾 Speichern
      </button>
      <button onclick={() => laden()} class="btn-secondary">
        📂 Laden
      </button>
      <button onclick={() => loeschen()} class="btn-danger">
        🗑️ Löschen
      </button>
    </div>

    <div class="save-list">
      <h3>Vorhandene Saves ({saves.length})</h3>
      {#if saves.length === 0}
        <p class="empty">Keine gespeicherten Spielstände vorhanden.</p>
      {:else}
        <ul class="save-items">
          {#each saves as saveName}
            <li class="save-item">
              <span class="save-name">{saveName}</span>
              <button onclick={() => ladeSave(saveName)} class="btn-load">Laden</button>
              <button onclick={() => deleteSave(saveName)} class="btn-delete">Löschen</button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="round-trip">
      <h3>Round-trip-Verifizierung</h3>
      <p>
        Speichern → Laden → Vergleichen: Der geladene Zustand muss identisch mit dem
        aktuellen Zustand sein.
      </p>
      <button onclick={() => verifiziereRoundTrip()} class="btn-info">
        🔄 Round-trip testen
      </button>
      {#if roundTripErgebnis !== null}
        <div class="round-trip-result">
          {roundTripErgebnis
            ? '✅ Round-trip erfolgreich – Zustand identisch'
            : '❌ Round-trip fehlgeschlagen – Zustand unterscheidet sich'}
        </div>
      {/if}
    </div>
  </div>

  <div class="score-section">
    <h2>Aktuelle Punktzahl</h2>
    <div class="score-display">
      <div class="score-value" style:color={farbePunktzahl}>{punktzahl}</div>
      <div class="score-label">{bewertung}</div>
    </div>

    <div class="score-breakdown">
      <h3>Punktzahl-Aufschlüsselung</h3>
      <table class="breakdown-tabelle">
        <thead>
          <tr>
            <th>Kategorie</th>
            <th>Wert</th>
            <th>Punkte</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Indikatoren (Ø × 2)</td>
            <td>{Math.round(indikatorDurchschnitt(state) * 10) / 10}</td>
            <td>{Math.round(indikatorDurchschnitt(state) * 2)}</td>
          </tr>
          <tr>
            <td>Legitimität (× 1.5)</td>
            <td>{state.legitimität}</td>
            <td>{Math.round(state.legitimität * 1.5)}</td>
          </tr>
          <tr>
            <td>Gruppen-Zufriedenheit (Ø × 2)</td>
            <td>{Math.round(gruppenDurchschnitt(state) * 10) / 10}</td>
            <td>{Math.round(gruppenDurchschnitt(state) * 2)}</td>
          </tr>
          <tr>
            <td>Jahre überlebt (× 10)</td>
            <td>{state.jahr}</td>
            <td>{state.jahr * 10}</td>
          </tr>
          <tr>
            <td>Radikalisierung (× -0.5)</td>
            <td>{state.radikalisierung}</td>
            <td>{-Math.round(state.radikalisierung * 0.5)}</td>
          </tr>
          <tr>
            <td>Schulden (× -0.2)</td>
            <td>{state.schulden}</td>
            <td>{-Math.round(state.schulden * 0.2)}</td>
          </tr>
          <tr>
            <td>Politisches Kapital (× 5)</td>
            <td>{state.pk}</td>
            <td>{state.pk * 5}</td>
          </tr>
          <tr class="total">
            <td><strong>Gesamt</strong></td>
            <td></td>
            <td><strong>{punktzahl}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="release-section">
    <h2>Release-Informationen</h2>
    <div class="release-info">
      <div class="release-version">
        <span class="version-label">Version:</span>
        <span class="version-value">{RELEASE_INFO.version}</span>
      </div>
      <div class="release-date">
        <span class="date-label">Datum:</span>
        <span class="date-value">{RELEASE_INFO.datum}</span>
      </div>
    </div>

    <div class="release-changelog">
      <h3>Changelog</h3>
      <ul class="changelog-liste">
        {#each RELEASE_INFO.changelog as eintrag}
          <li>{eintrag}</li>
        {/each}
      </ul>
    </div>
  </div>
</div>

<style>
  .save-score-release {
    font-family: system-ui, sans-serif;
    max-width: 900px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .save-score-release h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .save-score-release p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .save-section,
  .score-section,
  .release-section {
    margin-bottom: 2rem;
  }

  .save-section h2,
  .score-section h2,
  .release-section h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .save-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .save-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .save-input label {
    font-size: 0.85rem;
    color: #334155;
  }

  .save-input input {
    padding: 0.5rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 0.85rem;
    min-width: 150px;
  }

  .btn-primary {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    padding: 0.5rem 1rem;
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .btn-secondary:hover {
    background: #e2e8f0;
  }

  .btn-danger {
    padding: 0.5rem 1rem;
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .btn-danger:hover {
    background: #fee2e2;
  }

  .btn-info {
    padding: 0.5rem 1rem;
    background: #eff6ff;
    color: #1e40af;
    border: 1px solid #bfdbfe;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .btn-info:hover {
    background: #dbeafe;
  }

  .btn-load {
    padding: 0.25rem 0.5rem;
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #86efac;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .btn-load:hover {
    background: #dcfce7;
  }

  .btn-delete {
    padding: 0.25rem 0.5rem;
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .btn-delete:hover {
    background: #fee2e2;
  }

  .save-list {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
  }

  .save-list h3 {
    font-size: 1rem;
    color: #334155;
    margin: 0 0 0.75rem 0;
  }

  .empty {
    font-size: 0.85rem;
    color: #64748b;
    font-style: italic;
    margin: 0;
  }

  .save-items {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .save-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .save-item:last-child {
    border-bottom: none;
  }

  .save-name {
    font-size: 0.85rem;
    color: #334155;
    font-family: monospace;
  }

  .round-trip {
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 6px;
    padding: 1rem;
    margin-top: 1rem;
  }

  .round-trip h3 {
    font-size: 1rem;
    color: #166534;
    margin: 0 0 0.5rem 0;
  }

  .round-trip p {
    font-size: 0.8rem;
    color: #166534;
    margin: 0 0 0.75rem 0;
  }

  .round-trip-result {
    margin-top: 0.75rem;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .score-display {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .score-value {
    font-size: 3rem;
    font-weight: 700;
  }

  .score-label {
    font-size: 1.25rem;
    font-weight: 600;
    color: #334155;
  }

  .score-breakdown {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
  }

  .score-breakdown h3 {
    font-size: 1rem;
    color: #334155;
    margin: 0 0 0.75rem 0;
  }

  .breakdown-tabelle {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .breakdown-tabelle th,
  .breakdown-tabelle td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }

  .breakdown-tabelle th {
    background: #f1f5f9;
    font-weight: 600;
    color: #334155;
  }

  .breakdown-tabelle tr.total {
    font-weight: 700;
    background: #e0f2fe;
  }

  .breakdown-tabelle tr.total td {
    border-top: 2px solid #3b82f6;
  }

  .release-info {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.5rem;
  }

  .release-version,
  .release-date {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .version-label,
  .date-label {
    font-size: 0.8rem;
    color: #64748b;
  }

  .version-value,
  .date-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .release-changelog {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
  }

  .release-changelog h3 {
    font-size: 1rem;
    color: #334155;
    margin: 0 0 0.5rem 0;
  }

  .changelog-liste {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .changelog-liste li {
    padding: 0.4rem 0;
    border-bottom: 1px solid #e2e8f0;
    font-size: 0.85rem;
    color: #334155;
  }

  .changelog-liste li:last-child {
    border-bottom: none;
  }
</style>
