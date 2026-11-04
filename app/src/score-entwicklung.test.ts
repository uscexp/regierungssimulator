/**
 * @staatslenker/app score-entwicklung.test.ts — Tests für ScoreEntwicklung Logik (US-M6-06).
 *
 * Testet Entwicklungsindex, Ø Zufriedenheit, Regime-Dauer und Regierungsform-Gewichtung.
 */
import { describe, expect, it } from 'vitest';

/**
 * ScoreEntwicklung-Logik extrahiert aus ScoreEntwicklung.svelte — testbar isoliert.
 */
type Regierungsform = 'parlamentarisch' | 'praesidential' | 'diktatur';

interface UIStateMock {
  jahr: number;
  indikatoren: Record<string, number>;
  gruppen: { zufriedenheit: number }[];
}

interface ScoreKomponenten {
  entwicklungsindex: number;
  zufriedenheitO: number;
  regimeDauer: number;
}

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

function berechneEntwicklungsindex(indikatoren: Record<string, number>): number {
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

function berechneZufriedenheitO(gruppen: { zufriedenheit: number }[]): number {
  if (gruppen.length === 0) {
    return 0;
  }

  const summe = gruppen.reduce((acc, g) => acc + g.zufriedenheit, 0);
  return Math.round((summe / gruppen.length) * 10) / 10;
}

function berechneRegimeDauer(state: UIStateMock): number {
  return Math.max(0, state.jahr);
}

function berechneScore(
  komponenten: ScoreKomponenten,
  form: Regierungsform,
): { score: number; gewichtung: Gewichtung } {
  const gewichtung = GEWICHTUNGEN[form];
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

describe('US-M6-06: Score Entwicklung', () => {
  describe('Entwicklungsindex', () => {
    it('berechnet den Entwicklungsindex für alle Indikatoren', () => {
      const indikatoren = {
        wirtschaft: 80,
        gesundheit: 60,
        bildung: 70,
        infrastruktur: 50,
        forschung: 40,
      };
      // 80*0.25 + 60*0.20 + 70*0.20 + 50*0.20 + 40*0.15 = 20+12+14+10+6 = 62
      expect(berechneEntwicklungsindex(indikatoren)).toBe(62);
    });

    it('gibt 0 für leere Indikatoren zurück', () => {
      expect(berechneEntwicklungsindex({})).toBe(0);
    });

    it('ignoriert unbekannte Indikatoren', () => {
      const indikatoren = { wirtschaft: 80, unbekannt: 99 };
      expect(berechneEntwicklungsindex(indikatoren)).toBe(20); // 80*0.25 = 20, gewichtSumme=0.25
    });

    it('rundet auf eine Dezimalstelle', () => {
      const indikatoren = { wirtschaft: 33, gesundheit: 33, bildung: 33, infrastruktur: 33, forschung: 33 };
      expect(berechneEntwicklungsindex(indikatoren)).toBe(33);
    });
  });

  describe('Ø Zufriedenheit', () => {
    it('berechnet den Durchschnitt aller Gruppen', () => {
      const gruppen = [
        { zufriedenheit: 60 },
        { zufriedenheit: 40 },
        { zufriedenheit: 80 },
      ];
      // (60+40+80)/3 = 60
      expect(berechneZufriedenheitO(gruppen)).toBe(60);
    });

    it('gibt 0 für leere Gruppen zurück', () => {
      expect(berechneZufriedenheitO([])).toBe(0);
    });

    it('rundet auf eine Dezimalstelle', () => {
      const gruppen = [{ zufriedenheit: 33 }, { zufriedenheit: 34 }];
      expect(berechneZufriedenheitO(gruppen)).toBe(33.5);
    });
  });

  describe('Regime-Dauer', () => {
    it('berechnet die Regime-Dauer aus dem Jahr', () => {
      expect(berechneRegimeDauer({ jahr: 6, indikatoren: {}, gruppen: [] })).toBe(6);
      expect(berechneRegimeDauer({ jahr: 0, indikatoren: {}, gruppen: [] })).toBe(0);
    });

    it('gibt nie negative Werte zurück', () => {
      expect(berechneRegimeDauer({ jahr: -5, indikatoren: {}, gruppen: [] })).toBe(0);
    });
  });

  describe('Score-Berechnung', () => {
    const testKomponenten: ScoreKomponenten = {
      entwicklungsindex: 60,
      zufriedenheitO: 50,
      regimeDauer: 10,
    };

    it('berechnet den Score für parlamentarisch', () => {
      // 60*0.40 + 50*0.45 + (10/50*100)*0.15 = 24 + 22.5 + 3 = 49.5
      const ergebnis = berechneScore(testKomponenten, 'parlamentarisch');
      expect(ergebnis.score).toBe(49.5);
      expect(ergebnis.gewichtung.entwicklungsindex).toBe(40);
      expect(ergebnis.gewichtung.zufriedenheit).toBe(45);
      expect(ergebnis.gewichtung.regimeDauer).toBe(15);
    });

    it('berechnet den Score für präsidial', () => {
      // 60*0.50 + 50*0.35 + 20*0.15 = 30 + 17.5 + 3 = 50.5
      const ergebnis = berechneScore(testKomponenten, 'praesidential');
      expect(ergebnis.score).toBe(50.5);
      expect(ergebnis.gewichtung.entwicklungsindex).toBe(50);
      expect(ergebnis.gewichtung.zufriedenheit).toBe(35);
      expect(ergebnis.gewichtung.regimeDauer).toBe(15);
    });

    it('berechnet den Score für Diktatur', () => {
      // 60*0.20 + 50*0.20 + 20*0.60 = 12 + 10 + 12 = 34
      const ergebnis = berechneScore(testKomponenten, 'diktatur');
      expect(ergebnis.score).toBe(34);
      expect(ergebnis.gewichtung.entwicklungsindex).toBe(20);
      expect(ergebnis.gewichtung.zufriedenheit).toBe(20);
      expect(ergebnis.gewichtung.regimeDauer).toBe(60);
    });

    it('skaliert die Regime-Dauer auf 0–100', () => {
      const hoheDauer: ScoreKomponenten = {
        entwicklungsindex: 0,
        zufriedenheitO: 0,
        regimeDauer: 50,
      };
      const ergebnis = berechneScore(hoheDauer, 'diktatur');
      // 0*0.20 + 0*0.20 + 100*0.60 = 60
      expect(ergebnis.score).toBe(60);
    });

    it('kappt die Regime-Dauer bei 100', () => {
      const sehrHoheDauer: ScoreKomponenten = {
        entwicklungsindex: 0,
        zufriedenheitO: 0,
        regimeDauer: 100,
      };
      const ergebnis = berechneScore(sehrHoheDauer, 'diktatur');
      // 100*0.60 = 60 (gekappt)
      expect(ergebnis.score).toBe(60);
    });
  });

  describe('Gewichtungssumme', () => {
    it('summiert zu 100% für jede Regierungsform', () => {
      for (const [form, gewichtung] of Object.entries(GEWICHTUNGEN)) {
        const summe = gewichtung.entwicklungsindex + gewichtung.zufriedenheit + gewichtung.regimeDauer;
        expect(summe).toBe(100, `${form} Gewichtungssumme sollte 100 sein`);
      }
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

  describe('Regierungsform-spezifische Bewertung', () => {
    it('bewertet Diktatur mit langer Regime-Dauer höher', () => {
      const langeDauer: ScoreKomponenten = {
        entwicklungsindex: 0,
        zufriedenheitO: 0,
        regimeDauer: 50,
      };
      const diktatur = berechneScore(langeDauer, 'diktatur');
      const parlamentarisch = berechneScore(langeDauer, 'parlamentarisch');
      expect(diktatur.score).toBeGreaterThan(parlamentarisch.score);
    });

    it('bewertet Parlamentarisch mit hoher Zufriedenheit höher', () => {
      const hoheZufriedenheit: ScoreKomponenten = {
        entwicklungsindex: 0,
        zufriedenheitO: 100,
        regimeDauer: 0,
      };
      const parlamentarisch = berechneScore(hoheZufriedenheit, 'parlamentarisch');
      const diktatur = berechneScore(hoheZufriedenheit, 'diktatur');
      expect(parlamentarisch.score).toBeGreaterThan(diktatur.score);
    });

    it('bewertet Präsidial mit hoher Entwicklung höher', () => {
      const hoheEntwicklung: ScoreKomponenten = {
        entwicklungsindex: 100,
        zufriedenheitO: 0,
        regimeDauer: 0,
      };
      const praesidential = berechneScore(hoheEntwicklung, 'praesidential');
      const diktatur = berechneScore(hoheEntwicklung, 'diktatur');
      expect(praesidential.score).toBeGreaterThan(diktatur.score);
    });
  });
});
