<script lang="ts">
  /**
   * @staatslenker/app GaugeDashboard — Dashboard mit Indikator-Gauges und Gruppen-Heatmap (M5-03/M5-04).
   *
   * Zeigt alle Indikatoren als farbkodierte Gauges und alle Bevölkerungsgruppen als
   * farbkodierte Heatmap an. Nutzt den UI-Adapter für readonly Snapshots und Tick-Aktionen.
   */
  import IndikatorGauge from './IndikatorGauge.svelte';
  import GruppenHeatmap from './GruppenHeatmap.svelte';
  import NewsFeed from './NewsFeed.svelte';
  import MachtRegister from './MachtRegister.svelte';
  import Berater from './Berater.svelte';
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
  <h1>Staatslenker — Dashboard (M5)</h1>
  <p>Svelte 5 — readonly Snapshots, Indikator-Gauges, Gruppen-Heatmap, News-Feed und Machtregister</p>

  <div class="metrics">
    <div class="metric">
      <label>Jahr</label>
      <value>{state.jahr}</value>
    </div>
    <div class="metric">
      <label>Legitimität</label>
      <value>{state.legitimität}</value>
    </div>
    <div class="metric">
      <label>Politisches Kapital</label>
      <value>{state.politisches_kapital}</value>
    </div>
    <div class="metric">
      <label>Schulden</label>
      <value>{state.schulden}</value>
    </div>
    <div class="metric">
      <label>Radikalisierung</label>
      <value>{state.radikalisierung}</value>
    </div>
  </div>

  <div class="panels">
    <section class="panel">
      <h2>Indikatoren</h2>
      <div class="gauges">
        {#each Object.entries(state.indikatoren) as [tag, wert]}
          <IndikatorGauge indikator={tag} wert={wert} label={tag} />
        {/each}
      </div>
    </section>

    <section class="panel">
      <GruppenHeatmap gruppen={state.gruppen} />
    </section>

    <section class="panel">
      <NewsFeed news={state.news} />
    </section>

    <section class="panel">
      <MachtRegister regeln={adapter.regeln} state={state} />
    </section>

    <section class="panel">
      <Berater />
    </section>
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
    max-width: 1200px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .metrics {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .metric {
    background: #f1f5f9;
    padding: 0.75rem 1rem;
    border-radius: 6px;
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

  .panels {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .panel {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
  }

  .panel h2 {
    font-size: 1rem;
    color: #1e293b;
    margin: 0 0 1rem 0;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .gauges {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
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
