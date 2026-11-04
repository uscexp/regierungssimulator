<script lang="ts">
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
  <p>Svelte 5 + Vite — readonly Snapshots, Actions an den Kern</p>

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

  <h2>Indikatoren</h2>
  <ul>
    {#each Object.entries(state.indikatoren) as [tag, wert]}
      <li>{tag}: {wert}</li>
    {/each}
  </ul>

  <h2>Gruppen</h2>
  <ul>
    {#each state.gruppen as gruppe}
      <li>{gruppe.tag}: {gruppe.zufriedenheit}</li>
    {/each}
  </ul>

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
    max-width: 800px;
    margin: 2rem auto;
    padding: 1rem;
  }
  .metrics {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .metric {
    background: #f1f5f9;
    padding: 0.5rem 1rem;
    border-radius: 6px;
  }
  .metric label {
    display: block;
    font-size: 0.85rem;
    color: #64748b;
  }
  .metric value {
    font-size: 1.25rem;
    font-weight: 600;
  }
  ul {
    list-style: none;
    padding: 0;
  }
  li {
    padding: 0.25rem 0;
    border-bottom: 1px solid #e2e8f0;
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
