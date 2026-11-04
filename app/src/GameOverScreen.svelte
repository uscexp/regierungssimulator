<script lang="ts">
  /**
   * @staatslenker/app GameOverScreen — Game-Over-Screen: Score, Ursache des Machtverlusts, Seed, Neustart (US-M6-07).
   *
   * Implementiert den Game-Over-Bildschirm, der angezeigt wird, wenn der Spieler den Machtverlust erleidet:
   * - Finale Score-Anzeige mit Bewertung
   *   Ursache des Machtverlusts (Wahl verloren, Putsch, Misstrauensvotum etc.)
   *   Session-Seed für Replay-Transparenz
   *   Neustart-Button für neues Spiel
   *   Spielstatistik (Jahre überlebt, Indikatoren, Gruppen)
   *
   * Der Adapter liest readonly Snapshots; die GameOverScreen-Komponente rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  const adapter = erstelleUIAdapter('normal', 42);
  let state = adapter.state;

  /**
   * Game-Over-Ursachen.
   */
  interface MachtverlustUrsache {
    id: string;
    name: string;
    beschreibung: string;
    farbe: string;
  }

  const MACHTVERLUST_URSACHEN: Readonly<Record<string, MachtverlustUrsache>> = Object.freeze({
    'wahl:gewichtete_unter_47': {
      id: 'wahl:gewichtete_unter_47',
      name: 'Wahl verloren',
      beschreibung: 'Die gewichtete Zufriedenheit der Bevölkerung fiel unter die Schwelle von 47.',
      farbe: '#dc2626',
    },
    'wahl:schwächste_unter_35': {
      id: 'wahl:schwächste_unter_35',
      name: 'Wahl verloren (schwächste Gruppe)',
      beschreibung: 'Die schwächste Bevölkerungsgruppe fiel unter die Schwelle von 35 Zufriedenheit.',
      farbe: '#dc2626',
    },
    'putsch:verloren': {
      id: 'putsch:verloren',
      name: 'Putsch erfolgreich',
      beschreibung: 'Ein Militärputsch hat die Regierung gestürzt.',
      farbe: '#b91c1c',
    },
    'misstrauen:verloren': {
      id: 'misstrauen:verloren',
      name: 'Misstrauensvotum',
      beschreibung: 'Das Parlament hat das Misstrauensvotum gegen die Regierung angenommen.',
      farbe: '#eab308',
    },
    'legitimität:unter_null': {
      id: 'legitimität:unter_null',
      name: 'Legitimität zusammengebrochen',
      beschreibung: 'Die Legitimität der Regierung fiel auf 0.',
      farbe: '#dc2626',
    },
  });

  /**
   * Extrahiert die Machtverlust-Ursache aus dem State.
   */
  function extrahiereUrsache(state: UIState): MachtverlustUrsache | null {
    const niederlage = state.wahl_niederlage;
    if (!niederlage) {
      return null;
    }
    const ursache = MACHTVERLUST_URSACHEN[niederlage.grund_id];
    if (!ursache) {
      return {
        id: niederlage.grund_id,
        name: 'Unbekannte Ursache',
        beschreibung: 'Die Regierung ist aus einem unbekannten Grund gestürzt.',
        farbe: '#64748b',
      };
    }
    return ursache;
  }

  /**
   * Berechnet den finalen Score.
   * Nutzt dieselbe Logik wie ScoreEntwicklung (US-M6-06).
   */
  function berechneFinalScore(state: UIState): number {
    const indikatoren = state.indikatoren;
    const gruppen = state.gruppen;

    // Entwicklungsindex (gleiche Gewichtung wie M6-06)
    const gewichte: Readonly<Record<string, number>> = {
      wirtschaft: 0.25,
      gesundheit: 0.20,
      bildung: 0.20,
      infrastruktur: 0.20,
      forschung: 0.15,
    };
    let gewichteteSumme = 0;
    let gewichtSumme = 0;
    for (const [tag, gewicht] of Object.entries(gewichte)) {
      const wert = indikatoren[tag];
      if (wert !== undefined) {
        gewichteteSumme += wert * gewicht;
        gewichtSumme += gewicht;
      }
    }
    const entwicklungsindex = gewichtSumme === 0 ? 0 : Math.round((gewichteteSumme / gewichtSumme) * 10) / 10;

    // Ø Zufriedenheit
    const zufriedenheitO =
      gruppen.length > 0
        ? Math.round((gruppen.reduce((acc, g) => acc + g.zufriedenheit, 0) / gruppen.length) * 10) / 10
        : 0;

    // Regime-Dauer skaliert
    const regimeDauerSkaliert = Math.min(100, (state.jahr / 50) * 100);

    // Parlamentarisch als Default-Gewichtung
    const gewichtung = { entwicklungsindex: 40, zufriedenheit: 45, regimeDauer: 15 };

    const score =
      (entwicklungsindex * gewichtung.entwicklungsindex +
        zufriedenheitO * gewichtung.zufriedenheit +
        regimeDauerSkaliert * gewichtung.regimeDauer) /
      100;

    return Math.round(score * 10) / 10;
  }

  /**
   * Gibt die Score-Bewertung zurück.
   */
  function scoreBewertung(score: number): string {
    if (score >= 80) return 'exzellent';
    if (score >= 65) return 'gut';
    if (score >= 50) return 'befriedigend';
    if (score >= 35) return 'ausreichend';
    if (score >= 20) return 'mangelhaft';
    return 'ungenügend';
  }

  /**
   * Gibt die Score-Farbe zurück.
   */
  function scoreFarbe(score: number): string {
    if (score >= 80) return '#16a34a';
    if (score >= 65) return '#22c55e';
    if (score >= 50) return '#eab308';
    if (score >= 35) return '#f59e0b';
    if (score >= 20) return '#f97316';
    return '#dc2626';
  }

  /**
   * Formatiert einen Zeitstempel.
   */
  function formatiereZeitstempel(ts: string): string {
    return new Date(ts).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const ursache = extrahiereUrsache(state);
  const finalScore = berechneFinalScore(state);
  const bewertung = scoreBewertung(finalScore);
  const farbe = scoreFarbe(finalScore);

  /**
   * Startet ein neues Spiel (Neustart).
   */
  function neuesSpiel(): void {
    state = {
      ...state,
      jahr: 0,
      wahl_niederlage: undefined,
      legitimität: 50,
      pk: 40,
      schulden: 0,
      radikalisierung: 0,
    } as UIState;
  }

  /**
   * Gibt den Samen-Seed für Replay an.
   */
  function zeigeSeed(): number {
    return state.rng.seed;
  }
</script>

<div class="game-over">
  <h1>🏁 Spiel beendet</h1>
  <p>Die Regierung ist gestürzt. Hier ist dein finales Spielergebnis.</p>

  {#if ursache}
    <div class="ursache-karte" style:border-color={ursache.farbe}>
      <div class="ursache-header">
        <span class="ursache-icon">⚠️</span>
        <span class="ursache-name">{ursache.name}</span>
      </div>
      <div class="ursache-beschreibung">{ursache.beschreibung}</div>
      <div class="ursache-jahr">
        Jahr {state.jahr} — Machtverlust
      </div>
    </div>
  {/if}

  <div class="score-anzeige">
    <div class="score-wert" style:color={farbe}>{finalScore}</div>
    <div class="score-bewertung" style:color={farbe}>{bewertung}</div>
  </div>

  <div class="spielstatistik">
    <h2>Spielstatistik</h2>
    <div class="statistik-grid">
      <div class="stat-karte">
        <span class="stat-label">Jahre überlebt</span>
        <span class="stat-wert">{state.jahr}</span>
      </div>
      <div class="stat-karte">
        <span class="stat-label">Legitimität</span>
        <span class="stat-wert">{state.legitimität}</span>
      </div>
      <div class="stat-karte">
        <span class="stat-label">Politisches Kapital</span>
        <span class="stat-wert">{state.pk}</span>
      </div>
      <div class="stat-karte">
        <span class="stat-label">Schulden</span>
        <span class="stat-wert">{state.schulden}</span>
      </div>
      <div class="stat-karte">
        <span class="stat-label">Radikalisierung</span>
        <span class="stat-wert">{state.radikalisierung}</span>
      </div>
      <div class="stat-karte">
        <span class="stat-label">Session-Seed</span>
        <span class="stat-wert">{state.rng.seed}</span>
      </div>
    </div>
  </div>

  <div class="indikatoren-final">
    <h2>Finale Indikatoren</h2>
    <div class="indikatoren-grid">
      {#each Object.entries(state.indikatoren) as [tag, wert]}
        <div class="indikator-karte">
          <span class="indikator-tag">{tag}</span>
          <span class="indikator-wert" style:color={farbe(wert)}>{Math.round(wert)}</span>
        </div>
      {/each}
    </div>
  </div>

  <div class="gruppen-final">
    <h2>Finale Bevölkerungsgruppen</h2>
    <div class="gruppen-grid">
      {#each state.gruppen as gruppe}
        <div class="gruppe-karte">
          <span class="gruppe-tag">{gruppe.tag}</span>
          <span class="gruppe-wert" style:color={farbe(gruppe.zufriedenheit)}>{gruppe.zufriedenheit}</span>
        </div>
      {/each}
    </div>
  </div>

  <div class="neustart-aktionen">
    <button onclick={neuesSpiel} class="btn-primary">
      🔄 Neues Spiel starten
    </button>
    <button onclick={() => zeigeSeed()} class="btn-secondary">
      📋 Seed kopieren: {state.rng.seed}
    </button>
  </div>

  <div class="replay-hinweis">
    <h3>Replay-Information</h3>
    <p>
      Dieser Spielverlauf wurde mit dem Seed <strong>{state.rng.seed}</strong> generiert.
      Du kannst den Replay mit diesem Seed und der gleichen Action-Folge reproduzieren.
    </p>
  </div>
</div>

<style>
  .game-over {
    font-family: system-ui, sans-serif;
    max-width: 700px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .game-over h1 {
    font-size: 2rem;
    color: #dc2626;
    margin-bottom: 0.5rem;
    text-align: center;
  }

  .game-over p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .ursache-karte {
    background: #fef2f2;
    border: 2px solid #fecaca;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .ursache-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .ursache-icon {
    font-size: 1.5rem;
  }

  .ursache-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: #991b1b;
  }

  .ursache-beschreibung {
    font-size: 0.9rem;
    color: #334155;
    margin-bottom: 0.5rem;
    line-height: 1.4;
  }

  .ursache-jahr {
    font-size: 0.85rem;
    color: #64748b;
    font-weight: 600;
  }

  .score-anzeige {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .score-wert {
    font-size: 3rem;
    font-weight: 700;
  }

  .score-bewertung {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .spielstatistik {
    margin-bottom: 2rem;
  }

  .spielstatistik h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .statistik-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  .stat-karte {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
    text-align: center;
  }

  .stat-label {
    font-size: 0.8rem;
    color: #64748b;
    display: block;
    margin-bottom: 0.25rem;
  }

  .stat-wert {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
  }

  .indikatoren-final {
    margin-bottom: 2rem;
  }

  .indikatoren-final h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .indikatoren-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
  }

  .indikator-karte {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
    text-align: center;
  }

  .indikator-tag {
    font-size: 0.8rem;
    color: #64748b;
    display: block;
    margin-bottom: 0.25rem;
    text-transform: uppercase;
  }

  .indikator-wert {
    font-size: 1.5rem;
    font-weight: 600;
  }

  .gruppen-final {
    margin-bottom: 2rem;
  }

  .gruppen-final h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .gruppen-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
  }

  .gruppe-karte {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
    text-align: center;
  }

  .gruppe-tag {
    font-size: 0.8rem;
    color: #64748b;
    display: block;
    margin-bottom: 0.25rem;
  }

  .gruppe-wert {
    font-size: 1.5rem;
    font-weight: 600;
  }

  .neustart-aktionen {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 2rem;
    justify-content: center;
    flex-wrap: wrap;
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

  .replay-hinweis {
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 6px;
    padding: 1rem;
  }

  .replay-hinweis h3 {
    font-size: 1rem;
    color: #166534;
    margin: 0 0 0.5rem 0;
  }

  .replay-hinweis p {
    margin: 0;
    font-size: 0.85rem;
    color: #166534;
    line-height: 1.4;
  }
</style>
