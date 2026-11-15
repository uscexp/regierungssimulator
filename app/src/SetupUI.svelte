<script lang="ts">
  /** @staatslenker/app SetupUI — Setup-Phase UI (US-M5-02).
   *
   * Zeigt Regierungsform + Konstitutions-Entscheidungen zur Auswahl.
   * Nach Abschluss ruft der Parent-Callback `onAbschluss` mit dem SetupErgebnis auf.
   */
  import { setupAnwendenAusUI, regierungsformen, konstitutionsEntscheidungen, setupPflicht, setupStartState } from './setup-ui.js';
  import type { UIState } from './ui-adapter.js';

  export let onAbschluss: (uiState: UIState) => void = () => {};

  const formen = regierungsformen();
  const entscheidungen = konstitutionsEntscheidungen().filter((e) => e.regel_id !== 'steuermodell');
  const pflicht = setupPflicht();

  let gewählteForm: string = formen[0] ?? '';
  const gewählteIds: Set<string> = new Set();
  let gewähltesSteuermodell: string = 'flat';

  let lädt = false;
  let fehler: string | undefined;

  function entscheide(id: string) {
    if (gewählteIds.has(id)) gewählteIds.delete(id);
    else gewählteIds.add(id);
  }

  async function starteSpiel() {
    lädt = true;
    fehler = undefined;

    try {
      if (gewählteIds.size === 0) {
        fehler = 'Bitte wähle mindestens eine Konstitutions-Entscheidung aus.';
        lädt = false;
        return;
      }

      const startState = setupStartState(42);
      const ids = [...gewählteIds, 'steuermodell'];
      const ergebnis = setupAnwendenAusUI(
        startState,
        gewählteForm,
        ids,
        {
          ...Object.fromEntries([...gewählteIds].map((id) => [id, true])),
          steuermodell: gewähltesSteuermodell,
        },
        pflicht,
      );

      if (!ergebnis.erfolgreich || !ergebnis.uiState) {
        fehler = ergebnis.grund ?? 'Unbekannter Fehler';
        lädt = false;
        return;
      }

      onAbschluss(ergebnis.uiState);
      lädt = false;
    } catch (e) {
      fehler = e instanceof Error ? e.message : String(e);
      lädt = false;
    }
  }
</script>

<div class="setup">
  <h1>Staatslenker — Setup (US-M5-02)</h1>
  <p>Wähle Regierungsform und Konstitution, bevor das Spiel beginnt.</p>

  {#if fehler}
    <div class="fehler">{fehler}</div>
  {/if}

  <div class="setup-grid">
    <div class="setup-karte">
      <h2>Regierungsform</h2>
      {#each formen as form}
        <label class="form-option">
          <input
            type="radio"
            name="regierungsform"
            checked={form === gewählteForm}
            onchange={() => { gewählteForm = form; }}
          />
          {form.charAt(0).toUpperCase() + form.slice(1)}
        </label>
      {/each}
    </div>

    <div class="setup-karte">
      <h2>Konstitution</h2>
      <p>Wähle die Konstitutions-Entscheidungen aus:</p>
      {#each entscheidungen as entscheidung}
        <label class="entscheidung-option">
          <input
            type="checkbox"
            checked={gewählteIds.has(entscheidung.regel_id)}
            onchange={() => entscheide(entscheidung.regel_id)}
          />
          <strong>{entscheidung.label}</strong>
          <p class="beschreibung">{entscheidung.beschreibung}</p>
        </label>
      {/each}
    </div>

    <div class="setup-karte">
      <h2>Steuermodell</h2>
      {#each ['flat', 'progressiv', 'hoch', 'niedrig'] as modell}
        <label class="form-option">
          <input
            type="radio"
            name="steuermodell"
            checked={modell === gewähltesSteuermodell}
            onchange={() => { gewähltesSteuermodell = modell; }}
          />
          {modell.charAt(0).toUpperCase() + modell.slice(1)}
        </label>
      {/each}
    </div>
  </div>

  <div class="setup-actions">
    <button
      onclick={starteSpiel}
      disabled={lädt}
      class="start-button"
    >
      {#if lädt}Lädt...{:else}Spiel starten{/if}
    </button>
  </div>
</div>

<style>
  .setup {
    max-width: 800px;
    margin: 2rem auto;
    padding: 1rem;
    font-family: system-ui, sans-serif;
  }

  .setup h1 {
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .setup p {
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .fehler {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .setup-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .setup-karte {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .setup-karte h2 {
    color: #1e293b;
    margin-top: 0;
    font-size: 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .setup-karte p {
    margin-top: 0.5rem;
    font-size: 0.9rem;
    color: #475569;
  }

  .form-option,
  .entscheidung-option {
    display: block;
    margin-bottom: 0.75rem;
    cursor: pointer;
    font-size: 0.95rem;
  }

  .form-option input,
  .entscheidung-option input {
    margin-right: 0.5rem;
  }

  .entscheidung-option .beschreibung {
    margin: 0.25rem 0 0 0;
    font-size: 0.85rem;
    color: #64748b;
  }

  .setup-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .start-button {
    padding: 0.75rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    font-size: 1rem;
  }

  .start-button:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }

  .start-button:hover:not(:disabled) {
    background: #2563eb;
  }
</style>