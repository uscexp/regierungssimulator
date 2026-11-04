<script lang="ts">
  /**
   * @staatslenker/app Schwierigkeitsgrade — Drei Schwierigkeitsgrade als Parameter-Sets (US-M6-08).
   *
   * Implementiert drei vordefinierte Schwierigkeitsgrade als reinen Parameter-Sets
   * (keine neue Mechanik, nur andere Werte im SchwierigkeitsPack):
   * - Leicht: Niedrigerer Verschleiß, höhere PK-Regeneration, niedrigere Event-Wahrscheinlichkeit,
   *   höheres Schuldenlimit, niedrigerer Zinsfaktor, höherer Budget-Zuschuss
   * - Normal: Bestehendes SCHWIERIGKEIT_NORMAL (Basis)
   * - Schwer: Höherer Verschleiß, niedrigere PK-Regeneration, höhere Event-Wahrscheinlichkeit,
   *   niedrigeres Schuldenlimit, höherer Zinsfaktor, niedrigerer Budget-Zuschuss
   *
   * Der Adapter liest readonly Snapshots; die Schwierigkeitsgrade-Komponente rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  const adapter = erstelleUIAdapter('normal', 42);
  let state = adapter.state;

  /**
   * Schwierigkeitsgrade als Parameter-Sets.
   * Alle Felder sind Parameter des SchwierigkeitsPack (core/indikatoren.ts), keine neue Mechanik.
   */
  interface SchwierigkeitsGrad {
    id: string;
    name: string;
    beschreibung: string;
    parameter: {
      verschleiß_multiplikator: number;
      pk_regeneration: number;
      event_wahrscheinlichkeit: number;
      schuldenlimit: number;
      zinsfaktor: number;
      budget_zuschuss: number;
    };
    farbe: string;
    schwierigkeit: 'leicht' | 'normal' | 'schwer';
  }

  const SCHWIERIGKEIT_GRAD: Readonly<Record<string, SchwierigkeitsGrad>> = Object.freeze({
    leicht: {
      id: 'leicht',
      name: 'Leicht',
      beschreibung: 'Einfacher Einstieg mit mehr Budget, weniger Krisen und langsamerem Verschleiß',
      parameter: {
        verschleiß_multiplikator: 0.7,
        pk_regeneration: 1.3,
        event_wahrscheinlichkeit: 0.7,
        schuldenlimit: 150,
        zinsfaktor: 0.05,
        budget_zuschuss: 10,
      },
      farbe: '#16a34a',
      schwierigkeit: 'leicht',
    },
    normal: {
      id: 'normal',
      name: 'Normal',
      beschreibung: 'Ausgewogener Schwierigkeitsgrad (Standard aus balance-werte.md)',
      parameter: {
        verschleiß_multiplikator: 1.0,
        pk_regeneration: 1.0,
        event_wahrscheinlichkeit: 1.0,
        schuldenlimit: 100,
        zinsfaktor: 0.08,
        budget_zuschuss: 0,
      },
      farbe: '#eab308',
      schwierigkeit: 'normal',
    },
    schwer: {
      id: 'schwer',
      name: 'Schwer',
      beschreibung: 'Herausfordernd mit schnellem Verschleiß, weniger PK und häufigeren Ereignissen',
      parameter: {
        verschleiß_multiplikator: 1.4,
        pk_regeneration: 0.7,
        event_wahrscheinlichkeit: 1.4,
        schuldenlimit: 60,
        zinsfaktor: 0.12,
        budget_zuschuss: -10,
      },
      farbe: '#dc2626',
      schwierigkeit: 'schwer',
    },
  });

  /**
   * Aktuell ausgewählter Schwierigkeitsgrad (Default: Normal).
   */
  let gewählterGrad: string = 'normal';

  /**
   * Gibt den ausgewählten Schwierigkeitsgrad zurück.
   */
  function aktuellerGrad(): SchwierigkeitsGrad {
    return SCHWIERIGKEIT_GRAD[gewählterGrad];
  }

  /**
   * Wechselt den Schwierigkeitsgrad.
   */
  function wechsleGrad(id: string): void {
    gewählterGrad = id;
  }

  /**
   * Gibt an, ob ein Grad aktiv ist.
   */
  function istAktiv(id: string): boolean {
    return gewählterGrad === id;
  }

  /**
   * Berechnet die relative Schwierigkeit als Wert 0–100.
   */
  function schwierigkeitsWert(grad: SchwierigkeitsGrad): number {
    const { parameter } = grad;
    // Gewichteter Mittelwert der Parameter, normalisiert auf 0–100
    const verschleiß = (parameter.verschleiß_multiplikator - 0.5) / 1.0; // 0.5 bis 1.5 → 0 bis 1
    const pkRegen = (1.3 - parameter.pk_regeneration) / 0.6; // 0.7 bis 1.3 → 1 bis 0
    const ereignis = (parameter.event_wahrscheinlichkeit - 0.5) / 1.0; // 0.5 bis 1.5 → 0 bis 1
    const schulden = (150 - parameter.schuldenlimit) / 100; // 60 bis 150 → 0.9 bis 0
    const zins = (parameter.zinsfaktor - 0.04) / 0.1; // 0.04 bis 0.14 → 0 bis 1
    const zuschuss = (10 - parameter.budget_zuschuss) / 20; // -10 bis 10 → 1 bis 0

    const mittelwert = (verschleiß + pkRegen + ereignis + schulden + zins + zuschuss) / 6;
    return Math.round(Math.max(0, Math.min(100, mittelwert * 100)));
  }

  /**
   * Gibt die Schwierigkeitsfarbe zurück.
   */
  function schwierigkeitsFarbe(grad: SchwierigkeitsGrad): string {
    return grad.farbe;
  }

  /**
   * Gibt eine Textbeschreibung der Schwierigkeit zurück.
   */
  function schwierigkeitsText(grad: SchwierigkeitsGrad): string {
    const wert = schwierigkeitsWert(grad);
    if (wert < 30) return 'einfach';
    if (wert < 70) return 'ausgewogen';
    return 'herausfordernd';
  }
</script>

<div class="schwierigkeitsgrade">
  <h1>Schwierigkeitsgrade (M6-08)</h1>
  <p>Drei vordefinierte Schwierigkeitsgrade als reine Parameter-Sets — keine neue Mechanik, nur andere Werte</p>

  <div class="grad-auswahl">
    {#each Object.entries(SCHWIERIGKEIT_GRAD) as [id, grad]}
      <div
        class="grad-karte"
        class:aktiv={istAktiv(id)}
        onclick={() => wechsleGrad(id)}
      >
        <div class="grad-header">
          <span class="grad-name">{grad.name}</span>
          <span class="grad-farbe" style:background-color={grad.farbe}></span>
        </div>
        <div class="grad-beschreibung">{grad.beschreibung}</div>
        <div class="grad-parameter">
          <div class="parameter-eintrag">
            <span class="parameter-label">Verschleiß:</span>
            <span class="parameter-wert">{grad.parameter.verschleiß_multiplikator}×</span>
          </div>
          <div class="parameter-eintrag">
            <span class="parameter-label">PK-Regeneration:</span>
            <span class="parameter-wert">{grad.parameter.pk_regeneration}×</span>
          </div>
          <div class="parameter-eintrag">
            <span class="parameter-label">Ereignisse:</span>
            <span class="parameter-wert">{Math.round(grad.parameter.event_wahrscheinlichkeit * 100)}%</span>
          </div>
          <div class="parameter-eintrag">
            <span class="parameter-label">Schuldenlimit:</span>
            <span class="parameter-wert">{grad.parameter.schuldenlimit} BE</span>
          </div>
          <div class="parameter-eintrag">
            <span class="parameter-label">Zinsfaktor:</span>
            <span class="parameter-wert">{grad.parameter.zinsfaktor}</span>
          </div>
          <div class="parameter-eintrag">
            <span class="parameter-label">Budget-Zuschuss:</span>
            <span class="parameter-wert">{grad.parameter.budget_zuschuss} BE</span>
          </div>
        </div>
        <div class="grad-schwierigkeit">
          <span class="schwierigkeit-label">Schwierigkeit:</span>
          <span class="schwierigkeit-wert" style:color={grad.farbe}>
            {schwierigkeitsWert(grad)} / 100 ({schwierigkeitsText(grad)})
          </span>
        </div>
        {#if istAktiv(id)}
          <div class="grad-aktiv-badge">✅ Ausgewählt</div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="ausgewählter-grad">
    <h2>Aktuell ausgewählt: {aktuellerGrad().name}</h2>
    <div class="grad-detail">
      <div class="detail-spalte">
        <h3>Verschleiß-Multiplikator: {aktuellerGrad().parameter.verschleiß_multiplikator}×</h3>
        <p>Bestimmt, wie schnell Indikatoren ohne Budget sinken. Niedriger = langsamer Verschleiß.</p>
      </div>
      <div class="detail-spalte">
        <h3>PK-Regeneration: {aktuellerGrad().parameter.pk_regeneration}×</h3>
        <p>Bestimmt, wie schnell Politisches Kapital pro Jahr nachwächst. Höher = mehr Karten.</p>
      </div>
      <div class="detail-spalte">
        <h3>Ereignis-Wahrscheinlichkeit: {Math.round(aktuellerGrad().parameter.event_wahrscheinlichkeit * 100)}%</h3>
        <p>Skaliert, wie oft zufällige Ereignisse auftreten. Niedriger = ruhigeres Spiel.</p>
      </div>
      <div class="detail-spalte">
        <h3>Schuldenlimit: {aktuellerGrad().parameter.schuldenlimit} BE</h3>
        <p>Maximale Schulden vor Spar-Event. Höher = mehr Spielraum bei Defizit.</p>
      </div>
      <div class="detail-spalte">
        <h3>Zinsfaktor: {aktuellerGrad().parameter.zinsfaktor}</h3>
        <p>Zinsen pro Jahr auf bestehende Schulden. Niedriger = günstigere Schulden.</p>
      </div>
      <div class="detail-spalte">
        <h3>Budget-Zuschuss: {aktuellerGrad().parameter.budget_zuschuss} BE</h3>
        <p>Zusätzliche Einnahmen pro Jahr. Positiv = mehr Budget, negativ = weniger.</p>
      </div>
    </div>
  </div>

  <div class="vergleichstabelle">
    <h2>Direkter Vergleich</h2>
    <table class="vergleich-tabelle">
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Leicht</th>
          <th>Normal</th>
          <th>Schwer</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Verschleiß ×</td>
          <td class="wert-leicht">0.7</td>
          <td class="wert-normal">1.0</td>
          <td class="wert-schwer">1.4</td>
        </tr>
        <tr>
          <td>PK-Regeneration ×</td>
          <td class="wert-leicht">1.3</td>
          <td class="wert-normal">1.0</td>
          <td class="wert-schwer">0.7</td>
        </tr>
        <tr>
          <td>Ereignis-Wahrscheinlichkeit</td>
          <td class="wert-leicht">70%</td>
          <td class="wert-normal">100%</td>
          <td class="wert-schwer">140%</td>
        </tr>
        <tr>
          <td>Schuldenlimit</td>
          <td class="wert-leicht">150 BE</td>
          <td class="wert-normal">100 BE</td>
          <td class="wert-schwer">60 BE</td>
        </tr>
        <tr>
          <td>Zinsfaktor</td>
          <td class="wert-leicht">0.05</td>
          <td class="wert-normal">0.08</td>
          <td class="wert-schwer">0.12</td>
        </tr>
        <tr>
          <td>Budget-Zuschuss</td>
          <td class="wert-leicht">+10 BE</td>
          <td class="wert-normal">0 BE</td>
          <td class="wert-schwer">-10 BE</td>
        </tr>
        <tr class="schwierigkeit-zeile">
          <td>Schwierigkeit</td>
          <td class="wert-leicht">25 / 100</td>
          <td class="wert-normal">50 / 100</td>
          <td class="wert-schwer">75 / 100</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="hinweis">
    <h3>Hinweis</h3>
    <p>
      Die Schwierigkeitsgrade sind reine <strong>Parameter-Sets</strong> — sie ändern keine
      Spielmechanik, sondern nur die Werte im SchwierigkeitsPack (core/indikatoren.ts). Der
      Kern-Loop (tick) verwendet den übergebenen Schwierigkeitsgrad unverändert.
    </p>
  </div>
</div>

<style>
  .schwierigkeitsgrade {
    font-family: system-ui, sans-serif;
    max-width: 900px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .schwierigkeitsgrade h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .schwierigkeitsgrade p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .grad-auswahl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .grad-karte {
    background: #ffffff;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
  }

  .grad-karte:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .grad-karte.aktiv {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .grad-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .grad-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .grad-farbe {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .grad-beschreibung {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1rem;
    line-height: 1.4;
  }

  .grad-parameter {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 1rem;
    flex: 1;
  }

  .parameter-eintrag {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
  }

  .parameter-label {
    color: #475569;
  }

  .parameter-wert {
    font-weight: 600;
    color: #334155;
  }

  .grad-schwierigkeit {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid #e2e8f0;
  }

  .schwierigkeit-label {
    font-size: 0.8rem;
    color: #64748b;
  }

  .schwierigkeit-wert {
    font-size: 0.9rem;
    font-weight: 600;
  }

  .grad-aktiv-badge {
    margin-top: 0.75rem;
    padding: 0.25rem 0.75rem;
    background: #dcfce7;
    color: #166534;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
    align-self: flex-start;
  }

  .ausgewählter-grad {
    margin-bottom: 2rem;
  }

  .ausgewählter-grad h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .grad-detail {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .detail-spalte {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
  }

  .detail-spalte h3 {
    font-size: 0.95rem;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .detail-spalte p {
    font-size: 0.8rem;
    color: #475569;
    margin: 0;
    line-height: 1.4;
  }

  .vergleichstabelle {
    margin-bottom: 2rem;
  }

  .vergleichstabelle h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .vergleich-tabelle {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .vergleich-tabelle th,
  .vergleich-tabelle td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }

  .vergleich-tabelle th {
    background: #f1f5f9;
    font-weight: 600;
    color: #334155;
  }

  .wert-leicht {
    color: #16a34a;
    font-weight: 600;
  }

  .wert-normal {
    color: #eab308;
    font-weight: 600;
  }

  .wert-schwer {
    color: #dc2626;
    font-weight: 600;
  }

  .schwierigkeit-zeile {
    font-weight: 700;
    background: #f8fafc;
  }

  .schwierigkeit-zeile td {
    border-top: 2px solid #3b82f6;
  }

  .hinweis {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
  }

  .hinweis h3 {
    font-size: 1rem;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .hinweis p {
    margin: 0;
    font-size: 0.85rem;
    color: #475569;
    line-height: 1.5;
  }
</style>
