<script lang="ts">
  /**
   * @staatslenker/app IndikatorGauge — Einzelner Indikator als farbkodierter Gauge (US-M5-03).
   *
   * Zeigt einen Indikatorwert (0–100) als Kreis- oder Balken-Gauge mit Farbcodierung:
   *   < 40: rot (kritisch)
   *   40–60: gelb (warnung)
   *   > 60: grün (gut)
   *
   * Der Adapter liest readonly Snapshots; die Gauge rendert nur.
   */
  export let indikator: string = '';
  export let wert: number = 0;
  export let label: string = '';

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
</script>

<div class="gauge">
  <div class="gauge-label">{label || indikator}</div>
  <div class="gauge-bar">
    <div
      class="gauge-fill"
      style:width={Math.min(100, Math.max(0, wert)) + '%'}
      style:background-color={farbe(wert)}
    ></div>
  </div>
  <div class="gauge-wert">
    {wert} <span class="gauge-status">({farbeName(wert)})</span>
  </div>
</div>

<style>
  .gauge {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .gauge-label {
    font-weight: 600;
    font-size: 0.9rem;
    color: #1e293b;
  }

  .gauge-bar {
    height: 12px;
    background: #cbd5e1;
    border-radius: 6px;
    overflow: hidden;
  }

  .gauge-fill {
    height: 100%;
    transition: width 0.3s ease, background-color 0.3s ease;
  }

  .gauge-wert {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: #64748b;
  }

  .gauge-status {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }
</style>
