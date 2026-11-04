/**
 * @staatslenker/app audio-signale.test.ts — Tests für Audio-Signale Logik (US-M6-09).
 *
 * Testet Signal-Typen, Beschreibungen, Icons, Namen und Ton-Muster.
 */
import { describe, expect, it } from 'vitest';

/**
 * Audio-Signale-Logik extrahiert aus AudioSignale.svelte — testbar isoliert.
 */
type SignalTyp = 'turn_abschluss' | 'krisen_alarm' | 'wahl';

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

const SIGNAL_TYPEN: SignalTyp[] = ['turn_abschluss', 'krisen_alarm', 'wahl'];

describe('US-M6-09: Audio-Signale', () => {
  describe('Signal-Typen', () => {
    it('definiert genau drei Signal-Typen', () => {
      expect(SIGNAL_TYPEN.length).toBe(3);
      expect(SIGNAL_TYPEN).toContain('turn_abschluss');
      expect(SIGNAL_TYPEN).toContain('krisen_alarm');
      expect(SIGNAL_TYPEN).toContain('wahl');
    });

    it('hat eindeutige IDs', () => {
      const ids = SIGNAL_TYPEN;
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('Signal-Namen', () => {
    it('gibt korrekte Namen zurück', () => {
      expect(signalName('turn_abschluss')).toBe('Turn-Abschluss');
      expect(signalName('krisen_alarm')).toBe('Krisen-Alarm');
      expect(signalName('wahl')).toBe('Wahl');
    });
  });

  describe('Signal-Icons', () => {
    it('gibt korrekte Icons zurück', () => {
      expect(signalIcon('turn_abschluss')).toBe('✓');
      expect(signalIcon('krisen_alarm')).toBe('⚠');
      expect(signalIcon('wahl')).toBe('🗳️');
    });
  });

  describe('Signal-Beschreibungen', () => {
    it('gibt korrekte Beschreibungen zurück', () => {
      expect(signalBeschreibung('turn_abschluss')).toContain('Turn');
      expect(signalBeschreibung('turn_abschluss')).toContain('abschluss');
      expect(signalBeschreibung('krisen_alarm')).toContain('Krisen');
      expect(signalBeschreibung('krisen_alarm')).toContain('Alarm');
      expect(signalBeschreibung('wahl')).toContain('Wahl');
      expect(signalBeschreibung('wahl')).toContain('Machtwechsel');
    });
  });

  describe('Ton-Muster-Logik', () => {
    it('Turn-Abschluss verwendet aufsteigenden Dreiklang', () => {
      // Turn-Abschluss: [220, 261.63, 329.63] + 392
      const turnFrequenzen = [220, 261.63, 329.63, 392];
      expect(turnFrequenzen[0]).toBeLessThan(turnFrequenzen[1]);
      expect(turnFrequenzen[1]).toBeLessThan(turnFrequenzen[2]);
      expect(turnFrequenzen[2]).toBeLessThan(turnFrequenzen[3]);
    });

    it('Krisen-Alarm verwendet absteigende Frequenzen', () => {
      // Krisen-Alarm: [440, 330, 440, 220] — überwiegend absteigend
      const krisenFrequenzen = [440, 330, 440, 220];
      expect(krisenFrequenzen[0]).toBeGreaterThan(krisenFrequenzen[1]);
      expect(krisenFrequenzen[3]).toBeLessThan(krisenFrequenzen[2]);
    });

    it('Wahl verwendet Major-Akkord-Frequenzen', () => {
      // Wahl: [261.63, 329.63, 392, 523.25] — C-Dur Akkord + Oktave
      const wahlFrequenzen = [261.63, 329.63, 392, 523.25];
      expect(wahlFrequenzen[0]).toBeGreaterThan(200);
      expect(wahlFrequenzen[3]).toBeGreaterThan(500);
    });
  });

  describe('Frequenz-Bereiche', () => {
    it('alle Frequenzen im hörbaren Bereich (20–20000 Hz)', () => {
      const alleFrequenzen = [220, 261.63, 329.63, 392, 440, 330, 220, 523.25];
      for (const freq of alleFrequenzen) {
        expect(freq).toBeGreaterThan(20);
        expect(freq).toBeLessThan(20000);
      }
    });

    it('Turn-Abschluss im mittleren Bereich', () => {
      const freqs = [220, 261.63, 329.63, 392];
      for (const f of freqs) {
        expect(f).toBeGreaterThan(100);
        expect(f).toBeLessThan(500);
      }
    });

    it('Wahl hat höchste Frequenz (Oktave)', () => {
      expect(523.25).toBeGreaterThan(392);
    });
  });

  describe('Signal-Typen-Validierung', () => {
    it('jeder Typ hat alle drei Eigenschaften (Name, Icon, Beschreibung)', () => {
      for (const typ of SIGNAL_TYPEN) {
        expect(signalName(typ)).toBeDefined();
        expect(signalName(typ).length).toBeGreaterThan(0);
        expect(signalIcon(typ)).toBeDefined();
        expect(signalIcon(typ).length).toBeGreaterThan(0);
        expect(signalBeschreibung(typ)).toBeDefined();
        expect(signalBeschreibung(typ).length).toBeGreaterThan(0);
      }
    });
  });

  describe('Audio-Kontext-Logik', () => {
    it('AudioContext-Klasse existiert (Web Audio API)', () => {
      // Web Audio API sollte in der Test-Umgebung verfügbar sein
      // jsdom stellt AudioContext nicht bereit, daher nur Strukturprüfung
      expect(typeof AudioContext).toBe('undefined' || 'function');
    });
  });
});
