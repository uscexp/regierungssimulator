<script lang="ts">
  /**
   * @staatslenker/app TabletLayout — Tablet-Layout für Staatslenker Dashboard (US-M5-12).
   *
   * Bietet ein responsives Tablet-Layout mit den Hauptkomponenten des Spiels:
   * - Indikator-Gauges (oben links)
   * - Gruppen-Heatmap (oben rechts)
   * - Budget-Slider (unten links)
   * - News-Feed (unten rechts)
   * - Schnellzugriffs-Aktionen (unterhalb)
   *
   * Das Layout passt sich an verschiedene Tablet-Größen an und ist für Touch-Bedienung optimiert.
   */
  import IndikatorGauge from './IndikatorGauge.svelte';
  import GruppenHeatmap from './GruppenHeatmap.svelte';
  import BudgetSlider from './BudgetSlider.svelte';
  import NewsFeed from './NewsFeed.svelte';
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

  function farbe(wert: number): string {
    if (wert < 40) return '#dc2626';
    if (wert < 60) return '#eab308';
    return '#16a34a';
  }

  function farbeName(wert: number): string {
    if (wert < 40) return 'kritisch';
    if (wert < 60) return 'warnung';
    return 'gut';
  }
</script>

<div class="tablet-layout">
  <header class="tablet-header">
    <h1>Staatslenker — Tablet-Dashboard (M5-12)</h1>
    <p>Svelte 5 — Tablet-optimiertes Dashboard mit allen Kernfunktionen</p>
  </header>

  <div class="tablet-grid">
    <!-- Indikatoren-Gauges (Top Left) -->
    <section class="tablet-panel indikatoren-panel">
      <h2>Indikatoren</h2>
      <div class="gauges-grid">
        {#each Object.entries(state.indikatoren) as [tag, wert]}
          <IndikatorGauge indikator={tag} wert={wert} label={tag} />
        {/each}
      </div>
    </section>

    <!-- Gruppen-Heatmap (Top Right) -->
    <section class="tablet-panel gruppen-panel">
      <h2>Bevölkerungsgruppen</h2>
      <div class="gruppen-grid">
        {#each state.gruppen as gruppe}
          <div class="gruppe-karte">
            <div class="gruppe-name">{gruppe.tag}</div>
            <div class="gruppe-wert" style:color={farbe(gruppe.zufriedenheit)}>{gruppe.zufriedenheit}</div>
          </div>
        {/each}
      </div>
    </section>

    <!-- Budget-Slider (Bottom Left) -->
    <section class="tablet-panel budget-panel">
      <h2>Budget-Zuteilung</h2>
      <div class="budget-slider">
        {#each Object.entries(state.indikatoren) as [tag, wert]}
          <div class="slider-karte">
            <div class="slider-header">
              <span class="slider-tag">{tag}</span>
              <span class="slider-level">{Math.round(wert)}</span>
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
    </section>

    <!-- News-Feed (Bottom Right) -->
    <section class="tablet-panel news-panel">
      <h2>News-Feed</h2>
      <div class="news-list">
        {#each state.news as eintrag}
          <div class="news-eintrag">
            <span class="news-id">{eintrag.id}</span>
            <span class="news-text">{eintrag.text}</span>
          </div>
        {/each}
        {#if state.news.length === 0}
          <div class="news-empty">Keine Nachrichten verfügbar.</div>
        {/if}
      </div>
    </section>
  </div>

  <div class="aktionen">
    <button onclick={spieleTick} class="btn-primary">Tick spielen</button>
    <button onclick={reset} class="btn-secondary">Reset</button>
  </div>

  {#if state.wahl_niederlage}
    <div class="wahl-niederlage">
      <h3>⚠️ Wahl verloren</h3>
      <p>Jahr {state.wahl_niederlage.jahr}: {state.wahl_niederlage.grund_id}</p>
    </div>
  {/if}
</div>

<style>
  .tablet-layout {
    font-family: system-ui, sans-serif;
    max-width: 1024px;
    margin: 1rem auto;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .tablet-header {
    text-align: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #3b82f6;
  }

  .tablet-header h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .tablet-header p {
    font-size: 0.9rem;
    color: #64748b;
    margin: 0;
  }

  .tablet-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .tablet-panel {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .tablet-panel h2 {
    font-size: 1.1rem;
    color: #1e293b;
    margin: 0 0 1rem 0;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .gauges-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .indikator-gauge {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.75rem;
    text-align: center;
  }

  .indikator-name {
    font-size: 0.8rem;
    color: #64748b;
    margin-bottom: 0.25rem;
    text-transform: uppercase;
  }

  .indikator-wert {
    font-weight: 600;
    font-size: 1.5rem;
  }

  .gruppen-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .gruppe-karte {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .gruppe-name {
    font-size: 0.8rem;
    color: #334155;
  }

  .gruppe-wert {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .slider-karte {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .slider-tag {
    font-size: 0.75rem;
    text-transform: uppercase;
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

  .news-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 300px;
    overflow-y: auto;
  }

  .news-eintrag {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.85rem;
  }

  .news-eintrag:last-child {
    border-bottom: none;
  }

  .news-id {
    font-weight: 600;
    color: #3b82f6;
    min-width: 120px;
    font-size: 0.75rem;
  }

  .news-text {
    color: #334155;
    flex: 1;
  }

  .news-empty {
    font-size: 0.85rem;
    color: #64748b;
    font-style: italic;
    padding: 1rem;
    text-align: center;
  }

  .aktionen {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.5rem;
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

  .btn-primary:active {
    background: #1d4ed8;
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

  .wahl-niederlage {
    margin-top: 1.5rem;
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #991b1b;
  }

  .wahl-niederlage h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
  }

  .wahl-niederlage p {
    margin: 0;
    font-size: 0.85rem;
  }

  /* Tablet-specific adjustments */
  @media (min-width: 768px) {
    .tablet-dashboard {
      padding: 2rem;
    }

    .tablet-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }

    .gauges-grid {
      grid-template-columns: repeat(4, 1fr);
    }

    .gruppen-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (max-width: 767px) {
    .tablet-layout {
      width: 100%;
      padding: 0.5rem;
      border-radius: 0;
      border: none;
    }

    .tablet-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .gauges-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .gruppen-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .tablet-header {
      padding-bottom: 0.5rem;
    }

    .tablet-header h1 {
      font-size: 1.25rem;
    }
  }
</style>
