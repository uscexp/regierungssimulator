<script lang="ts">
  /**
   * @staatslenker/app GaugeDashboard — Dashboard mit Indikator-Gauges (US-M5-03).
   *
   * Zeigt alle Indikatoren des aktuellen UIState als farbkodierte Gauges an.
   * Nutzt den UI-Adapter für readonly Snapshots und Tick-Aktionen.
   */
  import IndikatorGauge from './IndikatorGauge.svelte';
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  const adapter = erstelleUIAdapter('normal', 42);
  let state = $state(adapter.state);

  function spieleTick() {
    state = $state(
      adapter.spieleTick({
        infrastruktur: 2,
        bildung: 2,
        gesundheit: 2,
        wirtschaft: 2,
        forschung: 2,
      }),
    );
  }

  function reset() {
    state = $state(adapter.reset(42));
  }
</script>

<div class="dashboard">
  <h1>Staatslenker — Indikator-Gauges (M5-03)</h1>
  <p>Svelte 5 — readonly Snapshots, farbkodierte Gauges</p>

  <div class="gauges">
    {#each Object.entries(state.indikatoren) as [tag, wert]}
      <IndikatorGauge indikator={tag} wert={wert} label={tag} />
    {/each}
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
  .dashboard {
    font-family: system-ui, sans-serif;
    max-width: 900px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .gauges {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
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
