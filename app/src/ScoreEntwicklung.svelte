<script lang="ts">
  /**
   * @staatslenker/app ScoreEntwicklung — Score: Entwicklungsindex + Ø Zufriedenheit + Regime-Dauer (US-M6-06).
   *
   * Implementiert die Score-Berechnung mit unterschiedlicher Gewichtung je nach Regierungsform:
   * - Entwicklungsindex: Gewichtet aus Indikatoren (Wirtschaft, Gesundheit, Bildung, Infrastruktur, Forschung)
   *   Ø Zufriedenheit: Durchschnitt aller Bevölkerungsgruppen
   *   Regime-Dauer: Jahre seit Regierungsantritt
   * - Regierungsform-spezifische Gewichtung:
   *   * Parlamentarisch: Zufriedenheit hoch gewichtet, Entwicklung mittel, Regime-Dauer niedrig
   *   * Präsidial: Entwicklung hoch gewichtet, Zufriedenheit mittel, Regime-Dauer niedrig
   *   * Diktatur: Regime-Dauer hoch gewichtet, Entwicklung niedrig, Zufriedenheit niedrig
   * - Score-Bewertung mit Farbkodierung und Trend-Anzeige
   *
   * Der Adapter liest readonly Snapshots; die ScoreEntwicklung-Komponente rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  const adapter = erstelleUIAdapter('normal', 42);
  let state = adapter.state;

  /**
   * Regierungsform-Typen.
   */
  type Regierungsform = 'parlamentarisch' | 'praesidential' | 'diktatur';

  /**
   * Score-Komponenten.
   */
  interface ScoreKomponenten {
    entwicklungsindex: number; // 0–100
    zufriedenheitO: number; // 0–100
    regimeDauer: number; // Jahre
  }

  /**
   * Gewichtung je Regierungsform (Summe = 100).
   */
  interface Gewichtung {
    entwicklungsindex: number;
    zufriedenheit: number;
    regimeDauer: number;
  }

  const GEWICHTUNGEN: Readonly<Record<Regierungsform, Gewichtung>> = Object.freeze({
    parlamentarisch: {
      entwicklungsindex: 40,
      zufriedenheit: 45,
      regimeDauer: 15,
    },
    praesidential: {
      entwicklungsindex: 50,
      zufriedenheit: 35,
      regimeDauer: 15,
    },
    diktatur: {
      entwicklungsindex: 20,
      zufriedenheit: 20,
      regimeDauer: 60,
    },
  });

  /**
   * Aktuelle Regierungsform (aus dem State oder Default).
   */
  let regierungsform: Regierungsform = 'parlamentarisch';

  /**
   * Berechnet den Entwicklungsindex aus den Indikatoren.
   * Gewichtet: Wirtschaft 25%, Gesundheit 20%, Bildung 20%, Infrastruktur 20%, Forschung 15%.
   */
  function berechneEntwicklungsindex(
    indikatoren: Record<string, number>,
  ): number {
    if (Object.keys(indikatoren).length === 0) {
      return 0;
    }

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

    if (gewichtSumme === 0) {
      return 0;
    }

    return Math.round((gewichteteSumme / gewichtSumme) * 10) / 10;
  }

  /**
   * Berechnet die Ø Zufriedenheit über alle Bevölkerungsgruppen.
   */
  function berechneZufriedenheitO(
    gruppen: { zufriedenheit: number }[],
  ): number {
    if (gruppen.length === 0) {
      return 0;
    }

    const summe = gruppen.reduce((acc, g) => acc + g.zufriedenheit, 0);
    return Math.round((summe / gruppen.length) * 10) / 10;
  }

  /**
   * Berechnet die Regime-Dauer in Jahren.
   */
  function berechneRegimeDauer(state: UIState): number {
    return Math.max(0, state.jahr);
  }

  /**
   * Berechnet den Gesamt-Score basierend auf der Regierungsform-Gewichtung.
   * Score = (Entwicklungsindex × Gewichtung + Zufriedenheit × Gewichtung + RegimeDauer × Gewichtung) / 100
   * Regime-Dauer wird auf 0–100 skaliert (maximal 50 Jahre = 100 Punkte).
   */
  function berechneScore(
    komponenten: ScoreKomponenten,
    form: Regierungsform,
  ): { score: number; gewichtung: Gewichtung } {
    const gewichtung = GEWICHTUNGEN[form];

    // Regime-Dauer auf 0–100 skalieren (50 Jahre = 100)
    const regimeDauerSkaliert = Math.min(100, (komponenten.regimeDauer / 50) * 100);

    const score =
      (komponenten.entwicklungsindex * gewichtung.entwicklungsindex +
        komponenten.zufriedenheitO * gewichtung.zufriedenheit +
        regimeDauerSkaliert * gewichtung.regimeDauer) /
      100;

    return {
      score: Math.round(score * 10) / 10,
      gewichtung,
    };
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
    if (score >= 80) return '#16a34a'; // Grün
    if (score >= 65) return '#22c55e'; // Hellgrün
    if (score >= 50) return '#eab308'; // Gelb
    if (score >= 35) return '#f59e0b'; // Orange
    if (score >= 20) return '#f97316'; // Dunkelorange
    return '#dc2626'; // Rot
  }

  /**
   * Gibt den Regierungsform-Namen zurück.
   */
  function regierungsformName(form: string): string {
    switch (form) {
      case 'parlamentarisch':
        return 'Parlamentarisch';
      case 'praesidential':
        return 'Präsidial';
      case 'diktatur':
        return 'Diktatur';
      default:
        return form;
    }
  }

  /**
   * Regierungsform-Icon.
   */
  function regierungsformIcon(form: string): string {
    switch (form) {
      case 'parlamentarisch':
        return '🏛️';
      case 'praesidential':
        return '👑';
      case 'diktatur':
        return '🔒';
      default:
        return '❓';
    }
  }

  /**
   * Regierungsform beschreibung.
   */
  function regierungsformBeschreibung(form: string): string {
    switch (form) {
      case 'parlamentarisch':
        return 'Zufriedenheit hoch gewichtet, Entwicklung mittel, Regime-Dauer niedrig';
      case 'praesidential':
        return 'Entwicklung hoch gewichtet, Zufriedenheit mittel, Regime-Dauer niedrig';
      case 'diktatur':
        return 'Regime-Dauer hoch gewichtet, Entwicklung niedrig, Zufriedenheit niedrig';
      default:
        return '';
    }
  }

  const komponenten: ScoreKomponenten = {
    entwicklungsindex: berechneEntwicklungsindex(state.indikatoren),
    zufriedenheitO: berechneZufriedenheitO(state.gruppen),
    regimeDauer: berechneRegimeDauer(state),
  };

  const ergebnis = berechneScore(komponenten, regierungsform);
  const bewertung = scoreBewertung(ergebnis.score);
  const farbe = scoreFarbe(ergebnis.score);

  /**
   * Wechselt die Regierungsform und berechnet den Score neu.
   * Nimmt einen String an (für Svelte-Template-Kompatibilität).
   */
  function wechsleRegierungsform(neueForm: string): void {
    regierungsform = neueForm as Regierungsform;
  }
</script>

<div class="score-entwicklung">
  <h1>Score: Entwicklung (M6-06)</h1>
  <p>Gesamt-Score mit unterschiedlicher Gewichtung je nach Regierungsform</p>

  <div class="score-gesamt">
    <div class="score-wert" style:color={farbe}>{ergebnis.score}</div>
    <div class="score-bewertung" style:color={farbe}>{bewertung}</div>
  </div>

  <div class="score-komponenten">
    <h2>Komponenten</h2>
    <div class="komponente">
      <h3>Entwicklungsindex</h3>
      <div class="komponente-wert">{komponenten.entwicklungsindex}</div>
      <div class="komponente-balken">
        <div
          class="balken-fuellung"
          style:width={komponenten.entwicklungsindex + '%'}
          style:background-color={farbe(komponenten.entwicklungsindex)}
        ></div>
      </div>
      <div class="komponente-hinweis">
        Gewichtet: Wirtschaft 25%, Gesundheit 20%, Bildung 20%, Infrastruktur 20%, Forschung 15%
      </div>
    </div>
    <div class="komponente">
      <h3>Ø Zufriedenheit</h3>
      <div class="komponente-wert">{komponenten.zufriedenheitO}</div>
      <div class="komponente-balken">
        <div
          class="balken-fuellung"
          style:width={komponenten.zufriedenheitO + '%'}
          style:background-color={farbe(komponenten.zufriedenheitO)}
        ></div>
      </div>
      <div class="komponente-hinweis">
        Durchschnitt über alle Bevölkerungsgruppen (0–100)
      </div>
    </div>
    <div class="komponente">
      <h3>Regime-Dauer</h3>
      <div class="komponente-wert">{komponenten.regimeDauer} Jahre</div>
      <div class="komponente-balken">
        <div
          class="balken-fuellung"
          style:width={Math.min(100, (komponenten.regimeDauer / 50) * 100) + '%'}
          style:background-color={farbe(Math.min(100, (komponenten.regimeDauer / 50) * 100))}
        ></div>
      </div>
      <div class="komponente-hinweis">
        Skaliert auf 0–100 (50 Jahre = 100 Punkte)
      </div>
    </div>
  </div>

  <div class="regierungsform-auswahl">
    <h2>Regierungsform &amp; Gewichtung</h2>
    <p>Aktuelle Form: {regierungsformIcon(regierungsform)} {regierungsformName(regierungsform)}</div>
    <div class="regierungsform-orte">
      {#each Object.entries(GEWICHTUNGEN) as [form, gewichtung]}
        <div
          class="form-karte"
          class:aktiv={form === regierungsform}
          onclick={() => { wechsleRegierungsform(form); }}
        >
          <div class="form-header">
            <span class="form-icon">{regierungsformIcon(form)}</span>
            <span class="form-name">{regierungsformName(form)}</span>
          </div>
          <div class="gewichtung-liste">
            <div class="gewichtung-eintrag">
              <span class="gewichtung-label">Entwicklungsindex:</span>
              <span class="gewichtung-wert">{gewichtung.entwicklungsindex}%</span>
            </div>
            <div class="gewichtung-eintrag">
              <span class="gewichtung-label">Zufriedenheit:</span>
              <span class="gewichtung-wert">{gewichtung.zufriedenheit}%</span>
            </div>
            <div class="gewichtung-eintrag">
              <span class="gewichtung-label">Regime-Dauer:</span>
              <span class="gewichtung-wert">{gewichtung.regimeDauer}%</span>
            </div>
          </div>
          <div class="form-beschreibung">{regierungsformBeschreibung(form)}</div>
        </div>
      {/each}
    </div>
  </div>

  <div class="score-aufschluesselung">
    <h2>Score-Aufschlüsselung</h2>
    <table class="aufschluesselung-tabelle">
      <thead>
        <tr>
          <th>Komponente</th>
          <th>Wert</th>
          <th>Gewichtung</th>
          <th>Beitrag</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Entwicklungsindex</td>
          <td>{komponenten.entwicklungsindex}</td>
          <td>{ergebnis.gewichtung.entwicklungsindex}%</td>
          <td>{Math.round((komponenten.entwicklungsindex * ergebnis.gewichtung.entwicklungsindex) / 100 * 10) / 10}</td>
        </tr>
        <tr>
          <td>Ø Zufriedenheit</td>
          <td>{komponenten.zufriedenheitO}</td>
          <td>{ergebnis.gewichtung.zufriedenheit}%</td>
          <td>{Math.round((komponenten.zufriedenheitO * ergebnis.gewichtung.zufriedenheit) / 100 * 10) / 10}</td>
        </tr>
        <tr>
          <td>Regime-Dauer</td>
          <td>{Math.min(100, (komponenten.regimeDauer / 50) * 100).toFixed(1)}</td>
          <td>{ergebnis.gewichtung.regimeDauer}%</td>
          <td>{Math.round((Math.min(100, (komponenten.regimeDauer / 50) * 100) * ergebnis.gewichtung.regimeDauer) / 100 * 10) / 10}</td>
        </tr>
        <tr class="gesamt">
          <td><strong>Gesamt-Score</strong></td>
          <td></td>
          <td><strong>100%</strong></td>
          <td><strong>{ergebnis.score}</strong></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="score-legende">
    <h2>Score-Legende</h2>
    <div class="legende-eintraege">
      <div class="legende-eintrag" style:color={'#16a34a'}>
        <span class="legende-farbe">■</span>
        <span>Exzellent (≥ 80)</span>
      </div>
      <div class="legende-eintrag" style:color={'#22c55e'}>
        <span class="legende-farbe">■</span>
        <span>Gut (≥ 65)</span>
      </div>
      <div class="legende-eintrag" style:color={'#eab308'}>
        <span class="legende-farbe">■</span>
        <span>Befriedigend (≥ 50)</span>
      </div>
      <div class="legende-eintrag" style:color={'#f59e0b'}>
        <span class="legende-farbe">■</span>
        <span>Ausreichend (≥ 35)</span>
      </div>
      <div class="legende-eintrag" style:color={'#f97316'}>
        <span class="legende-farbe">■</span>
        <span>Mangelhaft (≥ 20)</span>
      </div>
      <div class="legende-eintrag" style:color={'#dc2626'}>
        <span class="legende-farbe">■</span>
        <span>Ungenügend (&lt; 20)</span>
      </div>
    </div>
  </div>
</div>

<style>
  .score-entwicklung {
    font-family: system-ui, sans-serif;
    max-width: 900px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .score-entwicklung h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .score-entwicklung p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .score-gesamt {
    display: flex;
    align-items: center;
    gap: 1.5rem;
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

  .score-komponenten {
    margin-bottom: 2rem;
  }

  .score-komponenten h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .komponente {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 0.75rem;
  }

  .komponente h3 {
    font-size: 1rem;
    color: #334155;
    margin: 0 0 0.5rem 0;
  }

  .komponente-wert {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .komponente-balken {
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .balken-fuellung {
    height: 100%;
    transition: width 0.5s ease;
  }

  .komponente-hinweis {
    font-size: 0.8rem;
    color: #64748b;
  }

  .regierungsform-auswahl {
    margin-bottom: 2rem;
  }

  .regierungsform-auswahl h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .regierungsform-orte {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .form-karte {
    background: #ffffff;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .form-karte:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .form-karte.aktiv {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .form-icon {
    font-size: 1.5rem;
  }

  .form-name {
    font-weight: 600;
    color: #1e293b;
  }

  .gewichtung-liste {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .gewichtung-eintrag {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
  }

  .gewichtung-label {
    color: #64748b;
  }

  .gewichtung-wert {
    font-weight: 600;
    color: #334155;
  }

  .form-beschreibung {
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 0.5rem;
    font-style: italic;
  }

  .score-aufschluesselung {
    margin-bottom: 2rem;
  }

  .score-aufschluesselung h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .aufschluesselung-tabelle {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .aufschluesselung-tabelle th,
  .aufschluesselung-tabelle td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }

  .aufschluesselung-tabelle th {
    background: #f1f5f9;
    font-weight: 600;
    color: #334155;
  }

  .aufschluesselung-tabelle tr.gesamt {
    font-weight: 700;
    background: #e0f2fe;
  }

  .aufschluesselung-tabelle tr.gesamt td {
    border-top: 2px solid #3b82f6;
  }

  .score-legende {
    margin-bottom: 2rem;
  }

  .score-legende h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .legende-eintraege {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .legende-eintrag {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .legende-farbe {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    display: inline-block;
  }
</style>
