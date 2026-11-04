<script lang="ts">
  /**
   * @staatslenker/app GruppenHeatmap — Bevölkerungsgruppen als farbkodierte Heatmap (US-M5-04).
   *
   * Zeigt jede Bevölkerungsgruppe mit ihrer Zufriedenheit (0–100) als farbkodierte Karte:
   *   < 40: rot (kritisch/unzufrieden)
   *   40–60: gelb (warnung)
   *   > 60: grün (gut)
   *
   * Der Adapter liest readonly Snapshots; die Heatmap rendert nur.
   */
  export let gruppen: { readonly tag: string; readonly zufriedenheit: number }[] = [];

  function farbe(w: number): string {
    if (w < 40) return '#dc2626'; // rot
    if (w < 60) return '#eab308'; // gelb
    return '#16a34a'; // grün
  }

  function farbeName(w: number): string {
    if (w < 40) return 'kritisch';
    if (w < 60) return 'warnung';
    return 'gut';
  }

  function clampWert(w: number): number {
    return Math.min(100, Math.max(0, w));
  }
</script>

<div class="heatmap">
  <h2>Bevölkerungsgruppen — Zufriedenheit</h2>
  <div class="heatmap-grid">
    {#each gruppen as gruppe}
      <div class="heatmap-karte">
        <div class="karte-label">{gruppe.tag}</div>
        <div class="karte-balken">
          <div
            class="karte-fill"
            style:width={clampWert(gruppe.zufriedenheit) + '%'}
            style:background-color={farbe(gruppe.zufriedenheit)}
          ></div>
        </div>
        <div class="karte-status">
          {gruppe.zufriedenheit} <span class="status-badge">{farbeName(gruppe.zufriedenheit)}</span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .heatmap {
    padding: 1rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .heatmap h2 {
    font-size: 1.1rem;
    color: #1e293b;
    margin: 0 0 1rem 0;
  }

  .heatmap-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
  }

  .karte-label {
    font-weight: 600;
    font-size: 0.9rem;
    color: #1e293b;
    margin-bottom: 0.25rem;
  }

  .karte-balken {
    height: 14px;
    background: #cbd5e1;
    border-radius: 7px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .karte-fill {
    height: 100%;
    transition: width 0.3s ease, background-color 0.3s ease;
  }

  .karte-status {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: #64748b;
  }

  .status-badge {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
  }
</style>
