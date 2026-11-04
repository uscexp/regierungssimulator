<script lang="ts">
  /**
   * @staatslenker/app PrognoseDashboard — Prognose des nächsten Machtverlusts (US-M5-10).
   *
   * Zeigt eine Vorhersage basierend auf der aktuellen Zuteilung: wann der nächste
   * Machtcheck verloren geht, mit welcher Ursache und bei welchem Wert.
   * Die Prognose ist ein Dry-Run des echten Kern-Loops (tick) mit derselben Zuteilung,
   * der RNG-Zustand wird geforkt (ADR-009).
   *
   * Der Adapter liest readonly Snapshots; die Prognose rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';
  import { tick, type TickRegeln } from '@staatslenker/core/tick';
  import { type GameState } from '@staatslenker/core/state';
  import type { Prognose } from '@staatslenker/core/tick';

  export let adapter: ReturnType<typeof erstelleUIAdapter>;
  export let state: UIState;
  export let regeln: TickRegeln;

  adapter = erstelleUIAdapter('normal', 42);
  state = adapter.state;
  regeln = adapter.regeln;

  /** Die aktuelle Prognose. */
  export let prognose: {
    jahr: number;
    grund_id: string;
    wert: number;
    jahre_bis_zum_verlust: number;
  } | null = null;

  /** Die aktuelle Zuteilung für die Prognose. */
  export let zuteilung: Record<string, number> = {
    infrastruktur: 2,
    bildung: 2,
    gesundheit: 2,
    wirtschaft: 2,
    forschung: 2,
  };

  /** Berechnet die Prognose basierend auf dem aktuellen State und der Zuteilung. */
  function berechnePrognose() {
    if (!regeln.wahlregel) {
      prognose = null;
      return;
    }

    // Erstelle einen temporären GameState aus dem aktuellen UIState
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

    let aktuell: GameState = tempState;

    for (let schritt = 0; schritt < 50; schritt++) {
      const ergebnis = tick(aktuell, { zuteilung }, regeln, 'dev');
      aktuell = ergebnis.state;

      if (ergebnis.wahl && !ergebnis.wahl.gewonnen) {
        prognose = {
          jahr: ergebnis.state.jahr,
          grund_id: ergebnis.wahl.grund_id,
          wert:
            ergebnis.wahl.typ === 'praesidentialwahl'
              ? ergebnis.wahl.gewichtete_zufriedenheit ?? 0
              : ergebnis.wahl.zustimmung ?? 0,
          jahre_bis_zum_verlust: ergebnis.state.jahr - state.jahr,
        };
        return;
      }
    }

    prognose = null;
  }

  $: if (regeln) {
    berechnePrognose();
  }

  function farbe(wert: number): string {
    if (wert < 40) return '#dc2626';
    if (wert < 60) return '#eab308';
    return '#16a34a';
  }

  function grundText(grund_id: string): string {
    if (grund_id === 'wahl:gewichtete_unter_47') return 'Gewichtete Zufriedenheit unter 47';
    if (grund_id === 'wahl:schwächste_unter_35') return 'Schwächste Gruppe unter 35';
    if (grund_id === 'mehrheit:unter_0.5') return 'Parlamentarische Mehrheit unter 50%';
    if (grund_id === 'putsch:bedingung_erfüllt') return 'Putsch-Bedingung erfüllt';
    if (grund_id === 'putsch:gerollt_abgewehrt') return 'Putsch-Roll abgewehrt';
    return grund_id;
  }
</script>

<div class="prognose-dashboard">
  <h1>Prognose-Dashboard (M5-10)</h1>
  <p>Vorhersage des nächsten Machtverlusts basierend auf der aktuellen Zuteilung</p>

  <div class="prognose-status">
    <div class="status-karte">
      <h3>Nächster Machtcheck</h3>
      {#if prognose}
        <div class="prognose-wert">
          <span class="label">Jahr:</span>
          <span class="wert">{prognose.jahr}</span>
        </div>
        <div class="prognose-wert">
          <span class="label">Grund:</span>
          <span class="wert">{grundText(prognose.grund_id)}</span>
        </div>
        <div class="prognose-wert">
          <span class="label">Wert:</span>
          <span class="wert" style:color={farbe(prognose.wert)}>
            {Math.round(prognose.wert * 100) / 100}
          </span>
        </div>
        <div class="prognose-wert">
          <span class="label">Jahre bis zum Verlust:</span>
          <span class="wert">{prognose.jahre_bis_zum_verlust}</span>
        </div>
        <div class="prognose-warnung">
          ⚠️ Machtverlust in {prognose.jahre_bis_zum_verlust} Jahren droht!
        </div>
      {/else}
        <div class="prognose-wert">
          <span class="label">Status:</span>
          <span class="wert" style:color="#16a34a">Kein Machtverlust in den nächsten 50 Jahren</span>
        </div>
      {/if}
    </div>

    <div class="status-karte">
      <h3>Aktuelle Werte</h3>
      <div class="prognose-wert">
        <span class="label">Gewichtete Ø Zufriedenheit:</span>
        <span class="wert" style:color={farbe(state.legitimität)}>{Math.round(state.legitimität * 10) / 10}</span>
      </div>
      <div class="prognose-wert">
        <span class="label">Politisches Kapital:</span>
        <span class="wert">{state.politisches_kapital}</span>
      </div>
      <div class="prognose-wert">
        <span class="label">Radikalisierung:</span>
        <span class="wert" style:color={state.radikalisierung > 60 ? '#dc2626' : '#16a34a'}>{state.radikalisierung}</span>
      </div>
      <div class="prognose-wert">
        <span class="label">Jahr:</span>
        <span class="wert">{state.jahr}</span>
      </div>
    </div>
  </div>

  <div class="prognose-hinweis">
    <p>
      Die Prognose basiert auf der aktuellen Zuteilung und simuliert den
      Spielverlauf bis zu 50 Jahre im Voraus. Sie zeigt den ersten verlorenen
      Machtcheck, der unter dieser Zuteilung eintreten würde.
    </p>
  </div>

  <div class="aktionen">
    <button onclick={() => {
      zuteilung = { infrastruktur: 2, bildung: 2, gesundheit: 2, wirtschaft: 2, forschung: 2 };
      berechnePrognose();
    }} class="aktion-button">Standard-Zuteilung</button>
    <button onclick={() => {
      zuteilung = { infrastruktur: 4, wirtschaft: 2 };
      berechnePrognose();
    }} class="aktion-button">Infrastruktur zuerst</button>
    <button onclick={() => {
      zuteilung = { bildung: 4, infrastruktur: 2 };
      berechnePrognose();
    }} class="aktion-button">Bildung zuerst</button>
    <button onclick={() => {
      zuteilung = { gesundheit: 4, infrastruktur: 2 };
      berechnePrognose();
    }} class="aktion-button">Gesundheit zuerst</button>
  </div>
</div>

<style>
  .prognose-dashboard {
    font-family: system-ui, sans-serif;
    max-width: 1000px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .prognose-dashboard h1 {
    font-size: 1.5rem;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .prognose-dashboard p {
    font-size: 0.85rem;
    color: #64748b;
    margin: 0 0 1rem 0;
  }

  .prognose-status {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .status-karte {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
  }

  .status-karte h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    color: #1e293b;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .prognose-wert {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    margin-bottom: 0.25rem;
  }

  .prognose-wert:last-child {
    margin-bottom: 0;
  }

  .label {
    color: #64748b;
  }

  .wert {
    font-weight: 600;
  }

  .prognose-warnung {
    margin-top: 1rem;
    padding: 0.75rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    border-radius: 6px;
    font-weight: 600;
  }

  .prognose-hinweis {
    margin-top: 1.5rem;
    padding: 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    color: #1e40af;
    font-size: 0.85rem;
  }

  .aktionen {
    margin-top: 1.5rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .aktion-button {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
  }

  .aktion-button:hover {
    background: #2563eb;
  }

  .aktion-button:active {
    background: #1d4ed8;
  }
</style>
