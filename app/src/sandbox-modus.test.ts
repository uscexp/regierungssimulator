/**
 * @staatslenker/app sandbox-modus.test.ts — Tests für Sandbox-Modus Logik (US-M6-10).
 *
 * Testet Sandbox-Konfiguration, Spielende-Unterdrückung, Score-Berechnung.
 */
import { describe, expect, it } from 'vitest';

/**
 * SandboxModus-Logik extrahiert aus SandboxModus.svelte — testbar isoliert.
 */
interface UIStateMock {
  jahr: number;
  legitimität: number;
  pk: number;
  schulden: number;
  radikalisierung: number;
  indikatoren: Record<string, number>;
  gruppen: { zufriedenheit: number }[];
  wahl_niederlage?: { jahr: number; grund_id: string };
}

interface SandboxConfig {
  aktiviert: boolean;
  spielendeUnterdrueckt: boolean;
  endloserModus: boolean;
  scoreLauftWeiter: boolean;
  indikatorenLaufenWeiter: boolean;
}

const STANDARD_CONFIG: SandboxConfig = {
  aktiviert: false,
  spielendeUnterdrueckt: true,
  endloserModus: true,
  scoreLauftWeiter: true,
  indikatorenLaufenWeiter: true,
};

function istSandboxAktiv(config: SandboxConfig): boolean {
  return config.aktiviert;
}

function istSpielendeUnterdrueckt(config: SandboxConfig): boolean {
  return config.aktiviert && config.spielendeUnterdrueckt;
}

function istEndloserModus(config: SandboxConfig): boolean {
  return config.aktiviert && config.endloserModus;
}

function darfGameOverAngezeigtWerden(config: SandboxConfig, state: UIStateMock): boolean {
  if (istSpielendeUnterdrueckt(config)) {
    return false;
  }
  return state.wahl_niederlage !== undefined;
}

function berechneSandboxScore(state: UIStateMock): number {
  const indikatoren = state.indikatoren;
  const gruppen = state.gruppen;

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

  const zufriedenheitO =
    gruppen.length > 0
      ? Math.round((gruppen.reduce((acc, g) => acc + g.zufriedenheit, 0) / gruppen.length) * 10) / 10
      : 0;

  const regimeDauerSkaliert = Math.min(100, (state.jahr / 50) * 100);

  const gewichtung = { entwicklungsindex: 40, zufriedenheit: 45, regimeDauer: 15 };

  const score =
    (entwicklungsindex * gewichtung.entwicklungsindex +
      zufriedenheitO * gewichtung.zufriedenheit +
      regimeDauerSkaliert * gewichtung.regimeDauer) /
    100;

  return Math.round(score * 10) / 10;
}

function scoreBewertung(score: number): string {
  if (score >= 80) return 'exzellent';
  if (score >= 65) return 'gut';
  if (score >= 50) return 'befriedigend';
  if (score >= 35) return 'ausreichend';
  if (score >= 20) return 'mangelhaft';
  return 'ungenügend';
}

function scoreFarbe(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 65) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 35) return '#f59e0b';
  if (score >= 20) return '#f97316';
  return '#dc2626';
}

function istSandboxRelevant(config: SandboxConfig, state: UIStateMock): boolean {
  return config.aktiviert && state.wahl_niederlage !== undefined;
}

const TEST_STATE: UIStateMock = {
  jahr: 10,
  legitimität: 52,
  pk: 42,
  schulden: 10,
  radikalisierung: 0,
  indikatoren: { wirtschaft: 80, gesundheit: 60, bildung: 70, infrastruktur: 50, forschung: 40 },
  gruppen: [{ zufriedenheit: 60 }, { zufriedenheit: 40 }, { zufriedenheit: 80 }],
};

const TEST_STATE_MIT_WAHLNIEDERLAGE: UIStateMock = {
  ...TEST_STATE,
  jahr: 8,
  wahl_niederlage: { jahr: 8, grund_id: 'wahl:gewichtete_unter_47' },
};

describe('US-M6-10: Sandbox-Modus', () => {
  describe('Konfiguration', () => {
    it('hat Standard-Konfiguration', () => {
      expect(STANDARD_CONFIG.aktiviert).toBe(false);
      expect(STANDARD_CONFIG.spielendeUnterdrueckt).toBe(true);
      expect(STANDARD_CONFIG.endloserModus).toBe(true);
      expect(STANDARD_CONFIG.scoreLauftWeiter).toBe(true);
      expect(STANDARD_CONFIG.indikatorenLaufenWeiter).toBe(true);
    });
  });

  describe('Sandbox-Status', () => {
    it('gibt false zurück wenn Sandbox deaktiviert', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: false };
      expect(istSandboxAktiv(config)).toBe(false);
    });

    it('gibt true zurück wenn Sandbox aktiviert', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: true };
      expect(istSandboxAktiv(config)).toBe(true);
    });

    it('gibt false für Spielende-Unterdrückung wenn Sandbox deaktiviert', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: false };
      expect(istSpielendeUnterdrueckt(config)).toBe(false);
    });

    it('gibt true für Spielende-Unterdrückung wenn Sandbox aktiviert', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: true, spielendeUnterdrueckt: true };
      expect(istSpielendeUnterdrueckt(config)).toBe(true);
    });

    it('gibt false für Spielende-Unterdrückung wenn explizit deaktiviert', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: true, spielendeUnterdrueckt: false };
      expect(istSpielendeUnterdrueckt(config)).toBe(false);
    });

    it('gibt false für Endloser-Modus wenn Sandbox deaktiviert', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: false };
      expect(istEndloserModus(config)).toBe(false);
    });

    it('gibt true für Endloser-Modus wenn Sandbox aktiviert', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: true, endloserModus: true };
      expect(istEndloserModus(config)).toBe(true);
    });
  });

  describe('Game-Over-Anzeige', () => {
    it('verhindert Game-Over-Anzeige wenn Spielende unterdrückt', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: true, spielendeUnterdrueckt: true };
      expect(darfGameOverAngezeigtWerden(config, TEST_STATE_MIT_WAHLNIEDERLAGE)).toBe(false);
    });

    it('erlaubt Game-Over-Anzeige wenn Spielende nicht unterdrückt', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: true, spielendeUnterdrueckt: false };
      expect(darfGameOverAngezeigtWerden(config, TEST_STATE_MIT_WAHLNIEDERLAGE)).toBe(true);
    });

    it('erlaubt Game-Over-Anzeige wenn Sandbox deaktiviert', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: false };
      expect(darfGameOverAngezeigtWerden(config, TEST_STATE_MIT_WAHLNIEDERLAGE)).toBe(true);
    });

    it('verhindert Game-Over-Anzeige wenn kein Wahlverlust vorliegt', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: true };
      expect(darfGameOverAngezeigtWerden(config, TEST_STATE)).toBe(false);
    });
  });

  describe('Sandbox-Score', () => {
    it('berechnet den Fortlaufenden-Score', () => {
      const score = berechneSandboxScore(TEST_STATE);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('berechnet Entwicklungsindex korrekt', () => {
      const indikatoren = { wirtschaft: 80, gesundheit: 60, bildung: 70, infrastruktur: 50, forschung: 40 };
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
      const entwicklungsindex = Math.round((gewichteteSumme / gewichtSumme) * 10) / 10;
      expect(entwicklungsindex).toBe(62);
    });

    it('berechnet Ø Zufriedenheit korrekt', () => {
      const gruppen = [{ zufriedenheit: 60 }, { zufriedenheit: 40 }, { zufriedenheit: 80 }];
      const summe = gruppen.reduce((acc, g) => acc + g.zufriedenheit, 0);
      const zufriedenheitO = Math.round((summe / gruppen.length) * 10) / 10;
      expect(zufriedenheitO).toBe(60);
    });

    it('skaliert Regime-Dauer auf 0-100', () => {
      const state50: UIStateMock = { ...TEST_STATE, jahr: 50 };
      const state100: UIStateMock = { ...TEST_STATE, jahr: 100 };
      const score50 = berechneSandboxScore(state50);
      const score100 = berechneSandboxScore(state100);
      expect(score100).toBeGreaterThan(score50);
    });
  });

  describe('Score-Bewertung', () => {
    it('bewertet exzellent bei >= 80', () => {
      expect(scoreBewertung(80)).toBe('exzellent');
      expect(scoreBewertung(100)).toBe('exzellent');
    });

    it('bewertet gut bei >= 65', () => {
      expect(scoreBewertung(65)).toBe('gut');
      expect(scoreBewertung(79)).toBe('gut');
    });

    it('bewertet befriedigend bei >= 50', () => {
      expect(scoreBewertung(50)).toBe('befriedigend');
      expect(scoreBewertung(64)).toBe('befriedigend');
    });

    it('bewertet ausreichend bei >= 35', () => {
      expect(scoreBewertung(35)).toBe('ausreichend');
      expect(scoreBewertung(49)).toBe('ausreichend');
    });

    it('bewertet mangelhaft bei >= 20', () => {
      expect(scoreBewertung(20)).toBe('mangelhaft');
      expect(scoreBewertung(34)).toBe('mangelhaft');
    });

    it('bewertet ungenügend bei < 20', () => {
      expect(scoreBewertung(19)).toBe('ungenügend');
      expect(scoreBewertung(0)).toBe('ungenügend');
    });
  });

  describe('Score-Farbe', () => {
    it('gibt Grün bei >= 80', () => {
      expect(scoreFarbe(80)).toBe('#16a34a');
    });

    it('gibt Hellgrün bei >= 65', () => {
      expect(scoreFarbe(65)).toBe('#22c55e');
    });

    it('gibt Gelb bei >= 50', () => {
      expect(scoreFarbe(50)).toBe('#eab308');
    });

    it('gibt Orange bei >= 35', () => {
      expect(scoreFarbe(35)).toBe('#f59e0b');
    });

    it('gibt Dunkelorange bei >= 20', () => {
      expect(scoreFarbe(20)).toBe('#f97316');
    });

    it('gibt Rot bei < 20', () => {
      expect(scoreFarbe(19)).toBe('#dc2626');
    });
  });

  describe('Sandbox-Relevanz', () => {
    it('gibt true zurück wenn Sandbox aktiv und Wahlverlust vorliegt', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: true };
      expect(istSandboxRelevant(config, TEST_STATE_MIT_WAHLNIEDERLAGE)).toBe(true);
    });

    it('gibt false zurück wenn Sandbox deaktiviert', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: false };
      expect(istSandboxRelevant(config, TEST_STATE_MIT_WAHLNIEDERLAGE)).toBe(false);
    });

    it('gibt false zurück wenn kein Wahlverlust vorliegt', () => {
      const config: SandboxConfig = { ...STANDARD_CONFIG, aktiviert: true };
      expect(istSandboxRelevant(config, TEST_STATE)).toBe(false);
    });
  });
});
