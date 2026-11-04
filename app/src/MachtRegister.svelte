<script lang="ts">
  /**
   * @staatslenker/app MachtRegister — Machtregister / Wahlprüfung UI (US-M5-08).
   *
   * Zeigt die aktuellen Wahlregeln, den nächsten Machtcheck, die Schwellen und die
   * Vorhersage des nächsten Machtverlusts. Der Adapter liest readonly Snapshots;
   * die Komponente rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';
  import { tick, type TickRegeln } from '@staatslenker/core/tick';
  import { wahlAuswerten, type WahlregelVariant } from '@staatslenker/core/tick';
  import { startState } from '@staatslenker/cli/content-pack';
  import type { GameState } from '@staatslenker/core/state';

  export let regeln: TickRegeln;
  export let state: UIState;
  export let aufNächsteWahl: () => void = () => {};

  /** Die aktuelle Wahlregel. */
  export let aktuelleWahlregel: WahlregelVariant | undefined;

  /** Der nächste vorausgesagte Machtverlust (aus der Prognose). */
  let nächsterMachtverlust: { jahr: number; grund_id: string; zufriedenheit: number } | undefined;

  /** Berechnet die Vorhersage des nächsten Machtverlusts. */
  function berechneMachtverlustVorhersage(
    currentState: GameState,
    regeln: TickRegeln,
  ): { jahr: number; grund_id: string; zufriedenheit: number } | undefined {
    if (!regeln.wahlregel) return undefined;

    let testState: GameState = currentState;
    for (let jahr = currentState.jahr + 1; jahr <= currentState.jahr + 50; jahr++) {
      const ergebnis = tick(testState, {}, regeln, 'dev');
      testState = ergebnis.state;

      if (ergebnis.wahl) {
        return {
          jahr: ergebnis.state.jahr,
          grund_id: ergebnis.wahl.grund_id,
          zufriedenheit: ergebnis.wahl.typ === 'praesidentialwahl'
            ? ergebnis.wahl.gewichtete_zufriedenheit ?? 0
            : ergebnis.wahl.zustimmung ?? 0,
        };
      }
    }
    return undefined;
  }

  $: if (regeln) {
    // Erstelle einen temporären State für die Vorhersage
    const tempState: GameState = {
      jahr: state.jahr,
      indikatoren: { ...state.indikatoren },
      gruppen: state.gruppen.map((g) => ({ ...g, zufriedenheit: g.zufriedenheit })),
      budget: {},
      politisches_kapital: state.politisches_kapital,
      legitimitaet: state.legitimität,
      schulden: state.schulden,
      radikalisierung: state.radikalisierung,
      rng: { seed: 42, counter: 0 },
      konstitution: { steuermodell: 'flat' },
      zufriedenheits_trace: {},
      beschlüsse: [],
      cooldowns: {},
    };

    nächsterMachtverlust = berechneMachtverlustVorhersage(tempState, regeln);
  }

  function farbe(wert: number): string {
    if (wert < 40) return '#dc2626';
    if (wert < 60) return '#eab308';
    return '#16a34a';
  }
</script>

<div class="machtregister">
  <h2>Machtregister / Wahlprüfung (US-M5-08)</h2>
  <p>Machtverlust-Mechanik und nächster Machtcheck</p>

  {#if !regeln.wahlregel}
    <div class="keine-regel">
      Keine Wahlregel im Regelsatz registriert. Kein Machtcheck wird durchgeführt.
    </div>
  {/else}
    <div class="wahl-regel">
      <h3>Wahlregel: {regeln.wahlregel.regel_id}</h3>
      <div class="regel-info">
        <span class="regel-typ">{regeln.wahlregel.typ}</span>
        {#if regeln.wahlregel.typ === 'praesidentialwahl'}
          <span class="regel-wert">Intervall: {regeln.wahlregel.intervall_jahre} Jahre</span>
          <span class="regel-wert">Gewichtete Ø ≥ {regeln.wahlregel.gewichtete_min}</span>
          <span class="regel-wert">Schwächste ≥ {regeln.wahlregel.schwächste_min}</span>
        {/if}
        {#if regeln.wahlregel.typ === 'parlamentmehrheit'}
          <span class="regel-wert">Mehrheit ≥ {(regeln.wahlregel.mehrheit * 100).toFixed(0)}%</span>
        {/if}
        {#if regeln.wahlregel.typ === 'putsch_roll'}
          <span class="regel-wert">Elite ≥ {regeln.wahlregel.elite_min}</span>
          <span class="regel-wert">Militär ≥ {regeln.wahlregel.militaer_min}</span>
          <span class="regel-wert">Legitimität ≥ {regeln.wahlregel.legitimität_min}</span>
          <span class="regel-wert">Wahrscheinlichkeit: {(regeln.wahlregel.wahrscheinlichkeit * 100).toFixed(0)}%</span>
        {/if}
      </div>
    </div>

    <div class="machtstatus">
      <div class="status-karte">
        <h4>Nächster Machtcheck</h4>
        {#if nächsterMachtverlust}
          <div class="status-wert">
            <span class="label">Jahr:</span>
            <span class="wert">{nächsterMachtverlust.jahr}</span>
          </div>
          <div class="status-wert">
            <span class="label">Grund:</span>
            <span class="wert">{nächsterMachtverlust.grund_id}</span>
          </div>
          <div class="status-wert">
            <span class="label">Wert:</span>
            <span class="wert" style:color={farbe(nächsterMachtverlust.zufriedenheit)}>
              {Math.round(nächsterMachtverlust.zufriedenheit * 100) / 100}
            </span>
          </div>
        {/else}
          <div class="status-wert">
            <span class="label">Status:</span>
            <span class="wert" style:color="#16a34a">Kein Machtverlust in den nächsten 50 Jahren</span>
          </div>
        {/if}
      </div>

      <div class="status-karte">
        <h4>Aktuelle Werte</h4>
        <div class="status-wert">
          <span class="label">Gewichtete Ø Zufriedenheit:</span>
          <span class="wert" style:color={farbe(state.legitimität)}>{Math.round(state.legitimität * 10) / 10}</span>
        </div>
        <div class="status-wert">
          <span class="label">Politisches Kapital:</span>
          <span class="wert">{state.politisches_kapital}</span>
        </div>
        <div class="status-wert">
          <span class="label">Radikalisierung:</span>
          <span class="wert" style:color={state.radikalisierung > 60 ? '#dc2626' : '#16a34a'}>{state.radikalisierung}</span>
        </div>
      </div>
    </div>

    <div class="gruppen-status">
      <h3>Gruppen-Zufriedenheit</h3>
      <div class="gruppen-grid">
        {#each state.gruppen as gruppe}
          <div class="gruppe-karte">
            <span class="gruppe-name">{gruppe.tag}</span>
            <span class="gruppe-wert" style:color={farbe(gruppe.zufriedenheit)}>{gruppe.zufriedenheit}</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="aktionen">
      <button onclick={aufNächsteWahl} class="wahl-button">Nächste Wahl simulieren</button>
    </div>
  {/if}
</div>

<style>
  .machtregister {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .machtregister h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin: 0 0 0.75rem 0;
  }

  .machtregister p {
    font-size: 0.85rem;
    color: #64748b;
    margin: 0 0 1rem 0;
  }

  .wahl-regel {
    margin-bottom: 1rem;
  }

  .wahl-regel h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: #1e293b;
  }

  .regel-info {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .regel-typ {
    font-weight: 600;
    color: #3b82f6;
    font-size: 0.85rem;
  }

  .regel-wert {
    font-size: 0.8rem;
    color: #475569;
    background: #f1f5f9;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .machtstatus {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .status-karte {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 0.75rem;
  }

  .status-karte h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
    color: #1e293b;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.25rem;
  }

  .status-wert {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    margin-bottom: 0.25rem;
  }

  .status-wert:last-child {
    margin-bottom: 0;
  }

  .label {
    color: #64748b;
  }

  .wert {
    font-weight: 600;
  }

  .gruppen-status {
    margin-bottom: 1rem;
  }

  .gruppen-status h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: #1e293b;
  }

  .gruppen-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.5rem;
  }

  .gruppe-karte {
    background: #ffffff;
    border: 1px solid #cbd5e1;
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

  .aktionen {
    margin-top: 1rem;
  }

  .wahl-button {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
  }

  .wahl-button:hover {
    background: #2563eb;
  }

  .wahl-button:active {
    background: #1d4ed8;
  }

  .keine-regel {
    color: #64748b;
    font-style: italic;
    padding: 1rem;
  }
</style>
