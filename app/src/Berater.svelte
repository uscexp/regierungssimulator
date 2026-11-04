<script lang="ts">
  /**
   * @staatslenker/app Berater — Berater / Rat für den Spieler (US-M5-09).
   *
   * Zeigt verschiedene Berater-Typen mit Empfehlungen basierend auf dem aktuellen
   * Spielzustand. Jeder Berater analysiert Indikatoren, Gruppen und den allgemeinen
   * Zustand und gibt eine handlungsorientierte Empfehlung.
   *
   * Der Adapter liest readonly Snapshots; die Berater-Komponente rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  export let adapter: ReturnType<typeof erstelleUIAdapter>;
  export let state: UIState;

  adapter = erstelleUIAdapter('normal', 42);
  state = adapter.state;

  /** Berater-Typen mit ihren Schwerpunkten. */
  type BeraterTyp =
    | 'wirtschaft'
    | 'soziales'
    | 'sicherheit'
    | 'bildung'
    | 'gesundheit';

  const BERATER: { id: BeraterTyp; name: string; farbe: string; beschreibung: string }[] = [
    {
      id: 'wirtschaft',
      name: 'Wirtschaftsberater',
      farbe: '#3b82f6',
      beschreibung: 'Empfiehlt Maßnahmen zur Stärkung der Wirtschaft und Haushaltssanierung.',
    },
    {
      id: 'soziales',
      name: 'Sozialberater',
      farbe: '#10b981',
      beschreibung: 'Empfiehlt Maßnahmen zur Verbesserung der sozialen Gerechtigkeit und Gruppen-Zufriedenheit.',
    },
    {
      id: 'sicherheit',
      name: 'Sicherheitsberater',
      farbe: '#ef4444',
      beschreibung: 'Empfiehlt Maßnahmen zur Sicherung der inneren Sicherheit und Bekämpfung der Radikalisierung.',
    },
    {
      id: 'bildung',
      name: 'Bildungsberater',
      farbe: '#8b5cf6',
      beschreibung: 'Empfiehlt Maßnahmen zur Verbesserung von Bildung und Forschung für langfristigen Wohlstand.',
    },
    {
      id: 'gesundheit',
      name: 'Gesundheitsberater',
      farbe: '#06b6d4',
      beschreibung: 'Empfiehlt Maßnahmen zur Verbesserung der Gesundheit und Bekämpfung von Pandemien.',
    },
  ];

  /** Berechnet die Empfehlung für einen Berater basierend auf dem aktuellen State. */
  function berechneEmpfehlung(
    typ: BeraterTyp,
    state: UIState,
  ): { titel: string; text: string; dringlichkeit: 'niedrig' | 'mittel' | 'hoch'; aktion: string } {
    const indikatoren = state.indikatoren;
    const gruppen = state.gruppen;

    switch (typ) {
      case 'wirtschaft': {
        const wirtschaft = indikatoren.wirtschaft ?? 50;
        const infrastruktur = indikatoren.infrastruktur ?? 50;
        if (wirtschaft < 40) {
          return {
            titel: 'Wirtschaftskrise droht',
            text: 'Die Wirtschaft schwächelt drastisch. Sofortige Investitionen in Infrastruktur und Wirtschaft sind notwendig, um einen Zusammenbruch zu vermeiden.',
            dringlichkeit: 'hoch',
            aktion: 'Wirtschaft und Infrastruktur stark fördern',
          };
        } else if (wirtschaft < 60) {
          return {
            titel: 'Wirtschaftliche Schwäche',
            text: 'Die Wirtschaft ist anfällig. Gezielte Investitionen können die Resilienz erhöhen.',
            dringlichkeit: 'mittel',
            aktion: 'Wirtschaft moderat fördern',
          };
        } else {
          return {
            titel: 'Wirtschaft stabil',
            text: 'Die Wirtschaft ist stabil. Weiterhin vorsichtig investieren, um das Wachstum zu sichern.',
            dringlichkeit: 'niedrig',
            aktion: 'Ausgewogen investieren',
          };
        }
      }
      case 'soziales': {
        const unzufriedeneGruppen = gruppen.filter((g) => g.zufriedenheit < 50);
        if (unzufriedeneGruppen.length > 2) {
          return {
            titel: 'Hohe soziale Unzufriedenheit',
            text: 'Viele Gruppen sind unzufrieden. Sofortige soziale Maßnahmen sind notwendig, um Unruhen zu vermeiden.',
            dringlichkeit: 'hoch',
            aktion: 'Soziale Maßnahmen für unzufriedene Gruppen ergreifen',
          };
        } else if (unzufriedeneGruppen.length > 0) {
          return {
            titel: 'Einzelne unzufriedene Gruppen',
            text: 'Einige Gruppen sind unzufrieden. Gezielte Maßnahmen können die Zufriedenheit steigern.',
            dringlichkeit: 'mittel',
            aktion: 'Betroffene Gruppen gezielt unterstützen',
          };
        } else {
          return {
            titel: 'Hohe Zufriedenheit',
            text: 'Die Bevölkerungsgruppen sind zufrieden. Weiterhin auf Ausgewogenheit achten.',
            dringlichkeit: 'niedrig',
            aktion: 'Aktuellen Kurs beibehalten',
          };
        }
      }
      case 'sicherheit': {
        const sicherheit = indikatoren.sicherheit ?? 50;
        const radikalisierung = state.radikalisierung;
        if (sicherheit < 40 || radikalisierung > 70) {
          return {
            titel: 'Sicherheitskrise',
            text: 'Die Sicherheit ist kritisch und die Radikalisierung steigt. Sofortige Maßnahmen zur inneren Sicherheit sind notwendig.',
            dringlichkeit: 'hoch',
            aktion: 'Sicherheitsmaßnahmen verstärken und Radikalisierung bekämpfen',
          };
        } else if (sicherheit < 60 || radikalisierung > 50) {
          return {
            titel: 'Sicherheitsbedenken',
            text: 'Die Sicherheit ist mangelhaft und die Radikalisierung steigt. Präventive Maßnahmen sind ratsam.',
            dringlichkeit: 'mittel',
            aktion: 'Sicherheitsmaßnahmen moderat verstärken',
          };
        } else {
          return {
            titel: 'Sicherheit stabil',
            text: 'Die Sicherheit ist stabil. Weiterhin vorsichtig agieren, um den Zustand zu sichern.',
            dringlichkeit: 'niedrig',
            aktion: 'Aktuellen Sicherheitskurs beibehalten',
          };
        }
      }
      case 'bildung': {
        const bildung = indikatoren.bildung ?? 50;
        const forschung = indikatoren.forschung ?? 50;
        if (bildung < 40) {
          return {
            titel: 'Bildungsnotstand',
            text: 'Die Bildung ist kritisch niedrig. Ohne sofortige Investitionen droht langfristiger wirtschaftlicher Niedergang.',
            dringlichkeit: 'hoch',
            aktion: 'Bildung und Forschung stark fördern',
          };
        } else if (bildung < 60) {
          return {
            titel: 'Bildungslücken',
            text: 'Die Bildung ist mangelhaft. Gezielte Investitionen können die Grundlage für zukünftigen Wohlstand legen.',
            dringlichkeit: 'mittel',
            aktion: 'Bildung moderat fördern',
          };
        } else {
          return {
            titel: 'Bildung gut',
            text: 'Die Bildung ist auf einem guten Niveau. Weiterhin investieren, um die Spitzenstellung zu sichern.',
            dringlichkeit: 'niedrig',
            aktion: 'Bildungsniveau beibehalten',
          };
        }
      }
      case 'gesundheit': {
        const gesundheit = indikatoren.gesundheit ?? 50;
        if (gesundheit < 40) {
          return {
            titel: 'Gesundheitskrise',
            text: 'Das Gesundheitssystem ist kritisch belastet. Sofortige Investitionen sind notwendig, um eine Katastrophe zu vermeiden.',
            dringlichkeit: 'hoch',
            aktion: 'Gesundheitswesen stark fördern',
          };
        } else if (gesundheit < 60) {
          return {
            titel: 'Gesundheitliche Schwäche',
            text: 'Die Gesundheit ist mangelhaft. Präventive Maßnahmen können eine Verschlechterung verhindern.',
            dringlichkeit: 'mittel',
            aktion: 'Gesundheitswesen moderat fördern',
          };
        } else {
          return {
            titel: 'Gesundheit stabil',
            text: 'Die Gesundheit ist stabil. Weiterhin vorsichtig investieren, um das Niveau zu sichern.',
            dringlichkeit: 'niedrig',
            aktion: 'Aktuellen Gesundheitskurs beibehalten',
          };
        }
      }
    }
  }

  /** Berechnet die Empfehlungen für alle Berater. */
  $: beraterEmpfehlungen = BERATER.map((b) => ({
    ...b,
    empfehlung: berechneEmpfehlung(b.id, state),
  }));
</script>

<div class="berater-panel">
  <h1>Beraterrat (M5-09)</h1>
  <p>Beratung basierend auf dem aktuellen Spielzustand</p>

  <div class="berater-grid">
    {#each beraterEmpfehlungen as berater}
      <div class="berater-karte" class:hoch={berater.empfehlung.dringlichkeit === 'hoch'} class:mittel={berater.empfehlung.dringlichkeit === 'mittel'} class:niedrig={berater.empfehlung.dringlichkeit === 'niedrig'}>
        <div class="berater-header">
          <span class="berater-name">{berater.name}</span>
          <span class="berater-dringlichkeit">{berater.empfehlung.dringlichkeit}</span>
        </div>
        <p class="berater-beschreibung">{berater.beschreibung}</p>
        <div class="berater-effekte">
          <h4>{berater.empfehlung.titel}</h4>
          <p>{berater.empfehlung.text}</p>
          <div class="berater-aktion">
            <strong>Aktion:</strong> {berater.empfehlung.aktion}
          </div>
        </div>
        <button onclick={() => aufBeraterGewaehlt(berater.id)} class="berater-button">
          Empfehlung anwenden
        </button>
      </div>
    {/each}
  </div>

  <div class="zustands-uebersicht">
    <h3>Aktueller Spielzustand</h3>
    <div class="zustand-grid">
      {#each Object.entries(state.indikatoren) as [tag, wert]}
        <div class="zustand-karte">
          <span class="zustand-name">{tag}</span>
          <span class="zustand-wert" style:color={farbe(wert)}>{Math.round(wert)}</span>
        </div>
      {/each}
    </div>
    <div class="zustand-meta">
      <span>Legitimität: <span class="meta-wert" style:color={farbe(state.legitimität)}>{Math.round(state.legitimität)}</span></span>
      <span>Radikalisierung: <span class="meta-wert" style:color={state.radikalisierung > 60 ? '#dc2626' : '#16a34a'}>{state.radikalisierung}</span></span>
      <span>PK: {state.politisches_kapital}</span>
    </div>
  </div>
</div>

<style>
  .berater-panel {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .berater-panel h1 {
    font-size: 1.5rem;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .berater-panel p {
    font-size: 0.85rem;
    color: #64748b;
    margin: 0 0 1rem 0;
  }

  .berater-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .berater-karte {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .berater-karte.hoch {
    border-left: 4px solid #dc2626;
  }

  .berater-karte.mittel {
    border-left: 4px solid #eab308;
  }

  .berater-karte.niedrig {
    border-left: 4px solid #16a34a;
  }

  .berater-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .berater-name {
    font-weight: 600;
    font-size: 1rem;
    color: #1e293b;
  }

  .berater-dringlichkeit {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .berater-karte.hoch .berater-dringlichkeit {
    background: #fef2f2;
    color: #991b1b;
  }

  .berater-karte.mittel .berater-dringlichkeit {
    background: #fef3c7;
    color: #92400e;
  }

  .berater-karte.niedrig .berater-dringlichkeit {
    background: #dcfce7;
    color: #166534;
  }

  .berater-beschreibung {
    font-size: 0.8rem;
    color: #64748b;
    margin-bottom: 0.5rem;
    font-style: italic;
  }

  .berater-effekte {
    margin-top: 0.5rem;
  }

  .berater-effekte h4 {
    margin: 0 0 0.25rem 0;
    font-size: 0.9rem;
    color: #1e293b;
  }

  .berater-effekte p {
    font-size: 0.85rem;
    color: #475569;
    margin: 0 0 0.5rem 0;
  }

  .berater-aktion {
    font-size: 0.8rem;
    background: #f1f5f9;
    padding: 0.5rem;
    border-radius: 4px;
  }

  .berater-button {
    width: 100%;
    padding: 0.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    margin-top: 0.5rem;
  }

  .berater-button:hover {
    background: #2563eb;
  }

  .zustands-uebersicht {
    margin-top: 1.5rem;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 1rem;
  }

  .zustands-uebersicht h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    color: #1e293b;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .zustand-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .zustand-karte {
    background: #f1f5f9;
    border-radius: 6px;
    padding: 0.5rem;
    text-align: center;
  }

  .zustand-name {
    font-size: 0.7rem;
    color: #64748b;
    text-transform: uppercase;
    display: block;
    margin-bottom: 0.25rem;
  }

  .zustand-wert {
    font-weight: 600;
    font-size: 1rem;
    display: block;
  }

  .zustand-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
    color: #64748b;
    flex-wrap: wrap;
  }

  .zustand-meta span {
    display: flex;
    gap: 0.25rem;
  }
</style>
