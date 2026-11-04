<script lang="ts">
  /**
   * @staatslenker/app BudgetSlider — Budget-Slider mit Einnahmen-/Defizit-Anzeige (US-M5-05).
   *
   * Zeigt Einnahmen, Zinsen, Ausgaben, Defizit und Schulden an. Ermöglicht die
   * Budget-Zuteilung pro Indikator über Slider. Das Spar-Event (Schulden ≥ Limit)
   * wird farblich hervorgehoben.
   *
   * Der Adapter liest readonly Snapshots; die Slider senden Actions (TickAction) an den Kern.
   */
  import IndikatorGauge from './IndikatorGauge.svelte';
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  export let schwierigkeit: string = 'normal';
  export let seed: number = 42;

  const adapter = erstelleUIAdapter(schwierigkeit as 'leicht' | 'normal' | 'schwer', seed);
  let state = $state(adapter.state);

  // Zuteilung pro Indikator (Start: gleichmäßig 2 BE je budgetbarer Kategorie)
  let zuteilung = $state<Record<string, number>>({
    infrastruktur: 2,
    bildung: 2,
    gesundheit: 2,
    wirtschaft: 2,
    forschung: 2,
  });

  function spieleTick() {
    const zuteilungKopie = { ...zuteilung };
    state = $state(adapter.spieleTick(zuteilungKopie as Record<string, number>));
  }

  function reset() {
    state = $state(adapter.reset(seed));
    zuteilung = { infrastruktur: 2, bildung: 2, gesundheit: 2, wirtschaft: 2, forschung: 2 };
  }

  function setZuteilung(tag: string, wert: number) {
    zuteilung = { ...zuteilung, [tag]: Math.max(0, Math.round(wert)) };
  }

  /**
   * Berechnet die Budget-Kennzahlen für den aktuellen State und die Zuteilung.
   * Nimmt dieselbe Logik wie core/budget.budgetSchritt.
   */
  function berechneBudget() {
    const wirtschaftLevel = state.indikatoren.wirtschaft ?? 0;
    const steuerfaktor = 0.8; // flat (K2)
    const schwierigkeit = state.schulden >= 100 ? 0.8 : 1.0; // vereinfacht für Demo

    const einnahmen = wirtschaftLevel * steuerfaktor;
    const zinsen = state.schulden * 0.08;
    const ausgaben = Object.values(zuteilung).reduce((sum, be) => sum + be, 0);
    const defizit = Math.max(0, ausgaben - (einnahmen - zinsen));
    const schuldenNeu = Math.max(0, state.schulden + defizit);

    return {
      einnahmen,
      zinsen,
      ausgaben,
      defizit,
      schuldenNeu,
      sparEvent: state.schulden >= 80, // normaler Schwierigkeitsgrad-Limit
      verfügbar: einnahmen - zinsen,
    };
  }

  const budget = berechneBudget();
</script>

<div class="budget-slider">
  <h1>Staatslenker — Budget (M5-05)</h1>
  <p>Svelte 5 — Budget-Zuteilung pro Indikator, Einnahmen-/Defizit-Anzeige</p>

  <div class="budget-metrics">
    <div class="metric">
      <label>Einnahmen (BE)</label>
      <value class={budget.einnahmen >= 0 ? 'positiv' : 'negativ'}>{budget.einnahmen.toFixed(1)}</value>
    </div>
    <div class="metric">
      <label>Zinsen (BE)</label>
      <value>{budget.zinsen.toFixed(1)}</value>
    </div>
    <div class="metric">
      <label>Ausgaben (BE)</label>
      <value>{budget.ausgaben.toFixed(1)}</value>
    </div>
    <div class="metric">
      <label>Verfügbar (BE)</label>
      <value>{budget.verfügbar.toFixed(1)}</value>
    </div>
    <div class="metric">
      <label>Defizit (BE)</label>
      <value class={budget.defizit > 0 ? 'defizit' : 'ok'}>{budget.defizit.toFixed(1)}</value>
    </div>
    <div class="metric">
      <label>Schulden (BE)</label>
      <value class={budget.schuldenNeu > 60 ? 'warnung' : 'ok'}>{budget.schuldenNeu.toFixed(1)}</value>
    </div>
  </div>

  {#if budget.sparEvent}
    <div class="spar-event">
      ⚠️ Spar-Event aktiv: Schulden ≥ Limit (80 BE). Alle Gruppen −5 Zufriedenheit.
    </div>
  {/if}

  <div class="zuteilungen">
    <h2>Budget-Zuteilung (BE pro Indikator)</h2>
    <div class="slider-grid">
      {#each Object.entries(state.indikatoren) as [tag, level]}
        <div class="slider-karte">
          <div class="slider-header">
            <span class="slider-tag">{tag}</span>
            <span class="slider-level">Level: {level}</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            bind:value={zuteilung[tag] || 0}
            oninput={() => setZuteilung(tag, zuteilung[tag] || 0)}
          />
          <div class="slider-wert">{zuteilung[tag] || 0} BE</div>
        </div>
      {/each}
    </div>
  </div>

  <div class="actions">
    <button onclick={spieleTick}>Tick spielen</button>
    <button onclick={reset}>Reset</button>
  </div>

  {#if state.wahl_niederlage}
    <div class="error">
      Wahl verloren in Jahr {state.wahl_niederlage.jahr}: {state.wahl_niederlage.grund_id}
    </div>
  {/if}
</div>

<style>
  .budget-slider {
    font-family: system-ui, sans-serif;
    max-width: 1000px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .budget-metrics {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .metric {
    background: #f1f5f9;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    min-width: 120px;
  }

  .metric label {
    display: block;
    font-size: 0.8rem;
    color: #64748b;
  }

  .metric value {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .metric.value.positiv { color: #16a34a; }
  .metric.value.defizit { color: #dc2626; }
  .metric.value.warnung { color: #eab308; }

  .spar-event {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .zuteilungen {
    margin-bottom: 1.5rem;
  }

  .slider-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
  }

  .slider-karte {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .slider-tag {
    text-transform: uppercase;
    font-size: 0.75rem;
  }

  .slider-level {
    font-size: 0.75rem;
    color: #64748b;
  }

  input[type="range"] {
    width: 100%;
    margin: 0.5rem 0;
    accent-color: #3b82f6;
  }

  .slider-wert {
    font-size: 0.9rem;
    color: #3b82f6;
    font-weight: 600;
  }

  .actions {
    margin-top: 1rem;
  }

  button {
    padding: 0.5rem 1rem;
    margin-right: 0.5rem;
    cursor: pointer;
  }

  .error {
    color: #dc2626;
    margin-top: 1rem;
  }
</style>
