<script lang="ts">
  /**
   * @staatslenker/app AudioSignale — Audio-Signale für Spielereignisse (US-M6-09).
   *
   * Implementiert Audio-Signale für drei Spielereignisse ohne externe Audio-Dateien:
   * - Turn-Abschluss: Bestätigender Ton (aufsteigend, moll)
   * - Krisen-Alarm: Dringender, repetitiver Ton (absteigend, dissonant)
   *   Wahl: Offizieller, feierlicher Ton (akkordartig, major)
   *
   * Nutzt Web Audio API (OscillatorNode + GainNode) für rein synthetisierte Töne.
   * Keine externen Audio-Dateien, kein Netzwerkzugriff, keine Core-Änderungen.
   *
   * Der Adapter liest readonly Snapshots; die AudioSignale-Komponente rendert nur.
   */
  import { erstelleUIAdapter, type UIState } from './ui-adapter.js';

  const adapter = erstelleUIAdapter('normal', 42);
  let state = adapter.state;

  /**
   * Audio-Kontext (lazy initialisiert bei erster Interaktion).
   */
  let audioContext: AudioContext | null = null;

  /**
   * Stelle den Audio-Kontext bereit (muss durch Nutzer-Interaktion ausgelöst werden).
   */
  function stelleAudioContextBereit(): AudioContext {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
  }

  /**
   * Spielt einen reinen Ton mit gegebener Frequenz und Dauer ab.
   */
  function spieleTon(
    frequenz: number,
    dauerSekunden: number,
    typ: 'sine' | 'square' | 'sawtooth' | 'triangle' = 'sine',
    lautstaerke: number = 0.3,
  ): void {
    const ctx = stelleAudioContextBereit();
    const jetzt = ctx.currentTime;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = typ;
    oscillator.frequency.setValueAtTime(frequenz, jetzt);

    gainNode.gain.setValueAtTime(lautstaerke, jetzt);
    gainNode.gain.exponentialRampToValueAtTime(0.01, jetzt + dauerSekunden);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(jetzt);
    oscillator.stop(jetzt + dauerSekunden);
  }

  /**
   * Spielt einen Akkord (mehrere Frequenzen gleichzeitig) ab.
   */
  function spieleAkkord(
    frequenzen: number[],
    dauerSekunden: number,
    lautstaerke: number = 0.2,
  ): void {
    const ctx = stelleAudioContextBereit();
    const jetzt = ctx.currentTime;

    for (const freq of frequenzen) {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, jetzt);

      gainNode.gain.setValueAtTime(lautstaerke, jetzt);
      gainNode.gain.exponentialRampToValueAtTime(0.01, jetzt + dauerSekunden);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(jetzt);
      oscillator.stop(jetzt + dauerSekunden);
    }
  }

  /**
   * Spielt ein Ton-Muster (Sequenz von Tönen) ab.
   */
  function spieleMuster(
    tonfolge: { frequenz: number; dauerSekunden: number; pauseSekunden: number }[],
    lautstaerke: number = 0.3,
  ): void {
    const ctx = stelleAudioContextBereit();
    const jetzt = ctx.currentTime;
    let zeitOffset = 0;

    for (const ton of tonfolge) {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(ton.frequenz, jetzt + zeitOffset);

      gainNode.gain.setValueAtTime(lautstaerke, jetzt + zeitOffset);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        jetzt + zeitOffset + ton.dauerSekunden,
      );

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(jetzt + zeitOffset);
      oscillator.stop(jetzt + zeitOffset + ton.dauerSekunden);

      zeitOffset += ton.dauerSekunden + ton.pauseSekunden;
    }
  }

  /**
   * Signal-Typen für Spielereignisse.
   */
  type SignalTyp = 'turn_abschluss' | 'krisen_alarm' | 'wahl';

  /**
   * Spielt ein Signal für ein Spielereignis ab.
   */
  function spieleSignal(typ: SignalTyp): void {
    switch (typ) {
      case 'turn_abschluss':
        // Bestätigender, aufsteigender Dreiklang (moll)
        spieleAkkord([220, 261.63, 329.63], 0.4, 0.25);
        setTimeout(() => spieleTon(392, 0.3, 'sine', 0.2), 400);
        break;

      case 'krisen_alarm':
        // Dringender, repetitiver absteigender Ton (dissonant)
        spieleMuster(
          [
            { frequenz: 440, dauerSekunden: 0.15, pauseSekunden: 0.1 },
            { frequenz: 330, dauerSekunden: 0.15, pauseSekunden: 0.1 },
            { frequenz: 440, dauerSekunden: 0.15, pauseSekunden: 0.1 },
            { frequenz: 220, dauerSekunden: 0.4, pauseSekunden: 0 },
          ],
          0.4,
        );
        break;

      case 'wahl':
        // Offizieller, feierlicher Akkord (major)
        spieleAkkord([261.63, 329.63, 392, 523.25], 0.6, 0.2);
        setTimeout(() => spieleTon(523.25, 0.5, 'sine', 0.15), 600);
        break;
    }
  }

  /**
   * Gibt die Beschreibung für einen Signal-Typ zurück.
   */
  function signalBeschreibung(typ: SignalTyp): string {
    switch (typ) {
      case 'turn_abschluss':
        return 'Bestätigender Ton beim Abschluss eines Spielturns';
      case 'krisen_alarm':
        return 'Dringender Alarmton bei Krisenereignissen';
      case 'wahl':
        return 'Feierlicher Ton bei Wahlen und Machtwechseln';
    }
  }

  /**
   * Gibt den Icon für einen Signal-Typ zurück.
   */
  function signalIcon(typ: SignalTyp): string {
    switch (typ) {
      case 'turn_abschluss':
        return '✓';
      case 'krisen_alarm':
        return '⚠';
      case 'wahl':
        return '🗳️';
    }
  }

  /**
   * Gibt den Signal-Namen zurück.
   */
  function signalName(typ: SignalTyp): string {
    switch (typ) {
      case 'turn_abschluss':
        return 'Turn-Abschluss';
      case 'krisen_alarm':
        return 'Krisen-Alarm';
      case 'wahl':
        return 'Wahl';
    }
  }

  /**
   * Audio-Status (ob AudioContext bereit ist).
   */
  let audioBereit: boolean = false;

  /**
   * Initialisiert den Audio-Kontext (wird durch Nutzer-Interaktion aufgerufen).
   */
  function initialisiereAudio(): void {
    try {
      stelleAudioContextBereit();
      audioBereit = true;
    } catch {
      audioBereit = false;
    }
  }

  const signalTypen: SignalTyp[] = ['turn_abschluss', 'krisen_alarm', 'wahl'];
</script>

<div class="audio-signale">
  <h1>Audio-Signale (M6-09)</h1>
  <p>Audio-Signale für Spielereignisse ohne externe Dateien — rein synthetisiert via Web Audio API</p>

  <div class="audio-status">
    <div class="status-item">
      <span class="status-label">Audio-Kontext:</span>
      <span class="status-value" class:bereit={audioBereit} class:nichtBereit={!audioBereit}>
        {audioBereit ? '✅ Bereit' : '❌ Nicht initialisiert'}
      </span>
    </div>
    <div class="status-item">
      <span class="status-label">Signale:</span>
      <span class="status-value">3</span>
    </div>
    <div class="status-item">
      <span class="status-label">Technologie:</span>
      <span class="status-value">Web Audio API</span>
    </div>
  </div>

  <div class="audio-initialisierung">
    <button onclick={initialisiereAudio} class="btn-primary" :disabled={audioBereit}>
      {audioBereit ? '✅ Audio bereitgestellt' : '🔊 Audio initialisieren (erster Klick)'}
    </button>
    <p class="hinweis">
      Der Audio-Kontext muss durch eine Nutzer-Interaktion initialisiert werden (Browser-Sicherheit).
      Erstes Klicken auf einen Signal-Button initialisiert automatisch.
    </p>
  </div>

  <div class="signal-raster">
    {#each signalTypen as typ}
      <div class="signal-karte">
        <div class="signal-header">
          <span class="signal-icon">{signalIcon(typ)}</span>
          <span class="signal-name">{signalName(typ)}</span>
        </div>
        <div class="signal-beschreibung">{signalBeschreibung(typ)}</div>
        <button
          onclick={() => {
            if (!audioBereit) {
              initialisiereAudio();
            }
            spieleSignal(typ);
          }}
          class="btn-spiele"
        >
          ▶️ Abspielen
        </button>
      </div>
    {/each}
  </div>

  <div class="signal-detail">
    <h2>Signal-Details</h2>
    <table class="signal-tabelle">
      <thead>
        <tr>
          <th>Signal</th>
          <th>Ton-Charakter</th>
          <th>Verwendung</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="signal-icon">✓</span> Turn-Abschluss</td>
          <td>Aufsteigender Dreiklang (moll), bestärkend</td>
          <td>Am Ende jedes Spielturns, nach Tick-Verarbeitung</td>
        </tr>
        <tr>
          <td><span class="signal-icon">⚠</span> Krisen-Alarm</td>
          <td>Repetitiver, absteigender Ton (dissonant), dringend</td>
          <td>Bei Krisenereignissen, Machtverlust, niedriger Legitimität</td>
        </tr>
        <tr>
          <td><span class="signal-icon">🗳️</span> Wahl</td>
          <td>Feierlicher Akkord (major), offiziell</td>
          <td>Bei Wahlen, Regierungswechsel, Machtwechseln</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="audio-hinweis">
    <h3>Technische Hinweise</h3>
    <ul>
      <li>Keine externen Audio-Dateien — alle Töne werden synthetisiert (OscillatorNode)</li>
      <li>Kein Netzwerkzugriff für Audio-Ressourcen</li>
      <li>Keine Core-Änderungen — reine UI-Komponente</li>
      <li>AudioContext wird erst bei erster Nutzer-Interaktion initialisiert (Browser-Autoplay-Policy)</li>
      <li>Alle Frequenzen im hörbaren Bereich (220–523 Hz)</li>
      <li>Lautstärke auf 0.15–0.4 begrenzt (ohrenfreundlich)</li>
    </ul>
  </div>
</div>

<style>
  .audio-signale {
    font-family: system-ui, sans-serif;
    max-width: 900px;
    margin: 2rem auto;
    padding: 1rem;
  }

  .audio-signale h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  .audio-signale p {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1.5rem;
  }

  .audio-status {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #e2e8f0;
  }

  .status-item:last-child {
    border-bottom: none;
  }

  .status-label {
    font-size: 0.85rem;
    color: #475569;
  }

  .status-value {
    font-size: 0.85rem;
    font-weight: 600;
    font-family: monospace;
  }

  .status-value.bereit {
    color: #16a34a;
  }

  .status-value.nichtBereit {
    color: #dc2626;
  }

  .audio-initialisierung {
    margin-bottom: 1.5rem;
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .hinweis {
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 0.5rem;
    margin-bottom: 1rem;
  }

  .signal-raster {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .signal-karte {
    background: #ffffff;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
  }

  .signal-karte:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .signal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .signal-icon {
    font-size: 1.5rem;
  }

  .signal-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .signal-beschreibung {
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 1rem;
    line-height: 1.4;
  }

  .btn-spiele {
    padding: 0.6rem 1.2rem;
    background: #16a34a;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: auto;
  }

  .btn-spiele:hover {
    background: #15803d;
  }

  .btn-spiele:active {
    background: #166534;
  }

  .signal-detail {
    margin-bottom: 2rem;
  }

  .signal-detail h2 {
    font-size: 1.25rem;
    color: #1e293b;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .signal-tabelle {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .signal-tabelle th,
  .signal-tabelle td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }

  .signal-tabelle th {
    background: #f1f5f9;
    font-weight: 600;
    color: #334155;
  }

  .audio-hinweis {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1rem;
  }

  .audio-hinweis h3 {
    font-size: 1rem;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .audio-hinweis ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #475569;
    font-size: 0.85rem;
    line-height: 1.6;
  }

  .audio-hinweis li {
    margin-bottom: 0.4rem;
  }
</style>
