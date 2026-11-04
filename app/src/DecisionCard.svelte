<script lang="ts">
  /**
   * @staatslenker/app DecisionCard — Entscheidungskarte mit Vorhersage (US-M5-07).
   *
   * Zeigt eine Entscheidungs-Karte mit allen verfügbaren Optionen und einer
   * Vorhersage der Auswirkungen jeder Option auf den Spielzustand.
   *
   * Der Adapter liest readonly Snapshots; die Karte rendert nur.
   */
  import { tick, type TickRegeln, type TickKarte, type TickAction } from '@staatslenker/core/tick';
  import { type GameState } from '@staatslenker/core/state';
  import { type Entscheidungskarte, type EntscheidungErgebnis } from '@staatslenker/core/entscheidung';
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  export let karte: Entscheidungskarte;
  export let state: UIState;
  export let regeln: TickRegeln;

  export let aufOptionGewaehlt: (regel_id: string, optionId: string) => void = () => {};

  /** Vorhergesagtes Ergebnis für jede Option. */
  let vorhersagen: Map<string, { state: UIState; ereignisse: string[] }> = new Map();

  function berechneVorhersage(option: { readonly id: string; readonly effekte: readonly { readonly ziel: string; readonly tag?: string; readonly delta: number }[] }) {
    // Konvertiere Entscheidungskarten-Effekte in Kern-Effekte
    const kernEffekte = option.effekte.map((e) => ({
      ziel: e.ziel as 'indikatoren' | 'gruppen' | 'legitimitaet' | 'radikalisierung' | 'politisches_kapital' | 'budget',
      tag: e.tag,
      delta: e.delta,
    }));

    // Erstelle einen temporären State und wende die Effekte an
    // Da tick() ein Jahr simuliert, verwenden wir einen vereinfachten Ansatz:
    // Wir kopieren den aktuellen State und wenden die Effekte direkt an
    const tempState: GameState = {
      ...state,
      indikatoren: { ...state.indikatoren },
      gruppen: state.gruppen.map((g) => ({ ...g, zufriedenheit: g.zufriedenheit })),
    };

    for (const effekt of kernEffekte) {
      if (effekt.ziel === 'indikatoren' && effekt.tag) {
        tempState.indikatoren[effekt.tag] = Math.min(100, Math.max(0, (tempState.indikatoren[effekt.tag] ?? 0) + effekt.delta));
      } else if (effekt.ziel === 'gruppen' && effekt.tag) {
        const gruppe = tempState.gruppen.find((g) => g.tag === effekt.tag);
        if (gruppe) {
          gruppe.zufriedenheit = Math.min(100, Math.max(0, gruppe.zufriedenheit + effekt.delta));
        }
      } else if (effekt.ziel === 'legitimitaet') {
        tempState.legitimitaet = Math.min(100, Math.max(0, tempState.legitimitaet + effekt.delta));
      } else if (effekt.ziel === 'radikalisierung') {
        tempState.radikalisierung = Math.min(100, Math.max(0, tempState.radikalisierung + effekt.delta));
      } else if (effekt.ziel === 'politisches_kapital') {
        tempState.politisches_kapital = Math.min(12, Math.max(0, tempState.politisches_kapital + effekt.delta));
      } else if (effekt.ziel === 'schulden') {
        tempState.schulden = Math.max(0, tempState.schulden + effekt.delta);
      } else if (effekt.ziel === 'budget') {
        // Budget-Effekt wird nicht direkt auf State angewendet
      }
    }

    return {
      state: {
        jahr: tempState.jahr,
        indikatoren: { ...tempState.indikatoren },
        legitimität: tempState.legitimitaet,
        politisches_kapital: tempState.politisches_kapital,
        schulden: tempState.schulden,
        radikalisierung: tempState.radikalisierung,
        gruppen: tempState.gruppen.map((g) => ({ tag: g.tag, zufriedenheit: g.zufriedenheit })),
        wahl_niederlage: tempState.wahl_niederlage,
        news: [],
      },
      ereignisse: [`Option "${option.id}" angewendet`],
    };
  }

  $: if (karte) {
    vorhersagen = new Map();
    for (const option of karte.optionen) {
      vorhersagen.set(option.id, berechneVorhersage(option));
    }
  }

  function optionWaehlen(optionId: string) {
    aufOptionGewaehlt(karte.regel_id, optionId);
  }

  function farbe(wert: number): string {
    if (wert < 40) return '#dc2626';
    if (wert < 60) return '#eab308';
    return '#16a34a';
  }
</script>

<div class="decision-card">
  <div class="card-header">
    <h2>{karte.regel_id}</h2>
    <p class="karten-tiefe">Max-Tiefe: {karte.maxTiefe}</p>
  </div>

  <div class="optionen">
    {#each karte.optionen as option}
      <div class="option-karte">
        <h3>{option.id}</h3>
        
        <div class="effekte">
          {#each option.effekte as effekt}
            <div class="effekt">
              <span class="effekt-ziel">{effekt.ziel}</span>
              {#if effekt.tag}
                <span class="effekt-tag">{effekt.tag}</span>
              {/if}
              <span class="effekt-delta {effekt.delta >= 0 ? 'positiv' : 'negativ'}">{effekt.delta >= 0 ? '+' : ''}{effekt.delta}</span>
            </div>
          {/each}
        </div>

        <div class="vorhersage">
          {#if vorhersagen.has(option.id)}
            {#const v = vorhersagen.get(option.id)}
            <div class="vorhersage-indikatoren">
              {#each Object.entries(v.state.indikatoren) as [tag, wert]}
                <div class="mini-gauge">
                  <span class="mini-tag">{tag}</span>
                  <span class="mini-wert" style:color={farbe(wert)}>{Math.round(wert)}</span>
                </div>
              {/each}
            </div>
            <div class="mini-meta">
              <span>Leg: {v.state.legitimität}</span>
              <span>PK: {v.state.politisches_kapital}</span>
              <span>Rad: {v.state.radikalisierung}</span>
            </div>
          {/if}
        </div>

        <button onclick={() => optionWaehlen(option.id)} class="wahl-button">
          Option wählen
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .decision-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    border-bottom: 2px solid #3b82f6;
    padding-bottom: 0.5rem;
  }

  .card-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #1e293b;
  }

  .karten-tiefe {
    font-size: 0.75rem;
    color: #64748b;
    background: #e2e8f0;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .optionen {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .option-karte {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 1rem;
  }

  .option-karte h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: #1e293b;
  }

  .effekte {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
  }

  .effekt {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    padding: 0.25rem 0;
    border-bottom: 1px solid #f1f5f9;
  }

  .effekt-ziel {
    font-weight: 500;
    color: #334155;
  }

  .effekt-tag {
    font-size: 0.7rem;
    color: #64748b;
    margin-right: 0.5rem;
  }

  .effekt-delta {
    font-weight: 600;
  }

  .effekt-delta.positiv {
    color: #16a34a;
  }

  .effekt-delta.negativ {
    color: #dc2626;
  }

  .vorhersage {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #f1f5f9;
  }

  .vorhersage-indikatoren {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }

  .mini-gauge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    padding: 0.25rem;
    background: #f1f5f9;
    border-radius: 4px;
    font-size: 0.7rem;
  }

  .mini-tag {
    font-size: 0.65rem;
    color: #64748b;
    text-transform: uppercase;
  }

  .mini-wert {
    font-weight: 600;
    font-size: 0.85rem;
  }

  .mini-meta {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.25rem;
  }

  .wahl-button {
    width: 100%;
    padding: 0.5rem;
    margin-top: 0.75rem;
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
</style>
