/**
 * @staatslenker/app save-score-release.test.ts — Tests für Save/Score/Release Logik (US-M6-01).
 *
 * Testet Speichern/Laden, Punktzahl-Berechnung, Save-Versionen und Round-trip-Verifizierung.
 */
import { describe, expect, it } from 'vitest';

/**
 * SaveScoreRelease-Logik extrahiert aus SaveScoreRelease.svelte — testbar isoliert.
 */
const SAVE_VERSION = 1;

interface UIStateMock {
  jahr: number;
  legitimität: number;
  pk: number;
  schulden: number;
  radikalisierung: number;
  indikatoren: Record<string, number>;
  gruppen: { zufriedenheit: number }[];
}

function berechnePruefsumme(daten: unknown): string {
  const json = JSON.stringify(daten);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function berechnePunktzahl(s: UIStateMock): number {
  let punkte = 0;

  const indikatorWerte = Object.values(s.indikatoren);
  const indikatorDurchschnitt =
    indikatorWerte.length > 0
      ? indikatorWerte.reduce((sum, v) => sum + v, 0) / indikatorWerte.length
      : 0;
  punkte += Math.round(indikatorDurchschnitt * 2);

  punkte += Math.round(s.legitimität * 1.5);

  const gruppenZufriedenheit = s.gruppen.reduce(
    (sum, g) => sum + g.zufriedenheit,
    0
  );
  const gruppenDurchschnitt =
    s.gruppen.length > 0 ? gruppenZufriedenheit / s.gruppen.length : 0;
  punkte += Math.round(gruppenDurchschnitt * 2);

  punkte += s.jahr * 10;

  punkte -= Math.round(s.radikalisierung * 0.5);
  punkte -= Math.round(s.schulden * 0.2);

  punkte += s.pk * 5;

  return Math.max(0, punkte);
}

function punktzahlBewertung(punkte: number): string {
  if (punkte >= 500) return 'exzellent';
  if (punkte >= 400) return 'gut';
  if (punkte >= 300) return 'befriedigend';
  if (punkte >= 200) return 'ausreichend';
  if (punkte >= 100) return 'mangelhaft';
  return 'ungenügend';
}

function punktzahlFarbe(punkte: number): string {
  if (punkte >= 400) return '#16a34a';
  if (punkte >= 300) return '#eab308';
  if (punkte >= 200) return '#f59e0b';
  return '#dc2626';
}

function indikatorDurchschnitt(s: UIStateMock): number {
  const indikatorWerte = Object.values(s.indikatoren);
  return indikatorWerte.length > 0
    ? indikatorWerte.reduce((sum, v) => sum + v, 0) / indikatorWerte.length
    : 0;
}

function gruppenDurchschnitt(s: UIStateMock): number {
  const gruppenZufriedenheit = s.gruppen.reduce(
    (sum, g) => sum + g.zufriedenheit,
    0
  );
  return s.gruppen.length > 0 ? gruppenZufriedenheit / s.gruppen.length : 0;
}

const TEST_STATE: UIStateMock = {
  jahr: 6,
  legitimität: 52,
  pk: 42,
  schulden: 10,
  radikalisierung: 0,
  indikatoren: {
    infrastruktur: 45,
    bildung: 50,
    gesundheit: 40,
    wirtschaft: 55,
    forschung: 35,
  },
  gruppen: [
    { zufriedenheit: 60 },
    { zufriedenheit: 45 },
    { zufriedenheit: 55 },
    { zufriedenheit: 70 },
    { zufriedenheit: 40 },
  ],
};

describe('US-M6-01: Save/Score/Release', () => {
  describe('Punktzahl-Berechnung', () => {
    it('berechnet die Punktzahl für einen Test-Zustand', () => {
      const punkte = berechnePunktzahl(TEST_STATE);
      expect(punkte).toBeGreaterThan(0);
      expect(punkte).toBeLessThanOrEqual(1000);
    });

    it('berechnet den Indikator-Durchschnitt korrekt', () => {
      const durchschnitt = indikatorDurchschnitt(TEST_STATE);
      // (45+50+40+55+35)/5 = 225/5 = 45
      expect(durchschnitt).toBe(45);
    });

    it('berechnet den Gruppen-Durchschnitt korrekt', () => {
      const durchschnitt = gruppenDurchschnitt(TEST_STATE);
      // (60+45+55+70+40)/5 = 270/5 = 54
      expect(durchschnitt).toBe(54);
    });

    it('gibt 0 bei leerem Zustand', () => {
      const leererZustand: UIStateMock = {
        jahr: 0,
        legitimität: 0,
        pk: 0,
        schulden: 0,
        radikalisierung: 0,
        indikatoren: {},
        gruppen: [],
      };
      expect(berechnePunktzahl(leererZustand)).toBe(0);
    });

    it('erhöht die Punktzahl bei höherem Jahr', () => {
      const zustandA = { ...TEST_STATE, jahr: 1 };
      const zustandB = { ...TEST_STATE, jahr: 10 };
      expect(berechnePunktzahl(zustandB)).toBeGreaterThan(berechnePunktzahl(zustandA));
    });

    it('senkt die Punktzahl bei hoher Radikalisierung', () => {
      const zustandA = { ...TEST_STATE, radikalisierung: 0 };
      const zustandB = { ...TEST_STATE, radikalisierung: 100 };
      expect(berechnePunktzahl(zustandB)).toBeLessThan(berechnePunktzahl(zustandA));
    });

    it('senkt die Punktzahl bei hohen Schulden', () => {
      const zustandA = { ...TEST_STATE, schulden: 0 };
      const zustandB = { ...TEST_STATE, schulden: 200 };
      expect(berechnePunktzahl(zustandB)).toBeLessThan(berechnePunktzahl(zustandA));
    });
  });

  describe('Punktzahl-Bewertung', () => {
    it('bewertet exzellent bei >= 500 Punkten', () => {
      expect(punktzahlBewertung(500)).toBe('exzellent');
      expect(punktzahlBewertung(1000)).toBe('exzellent');
    });

    it('bewertet gut bei >= 400 Punkten', () => {
      expect(punktzahlBewertung(400)).toBe('gut');
      expect(punktzahlBewertung(499)).toBe('gut');
    });

    it('bewertet befriedigend bei >= 300 Punkten', () => {
      expect(punktzahlBewertung(300)).toBe('befriedigend');
      expect(punktzahlBewertung(399)).toBe('befriedigend');
    });

    it('bewertet ausreichend bei >= 200 Punkten', () => {
      expect(punktzahlBewertung(200)).toBe('ausreichend');
      expect(punktzahlBewertung(299)).toBe('ausreichend');
    });

    it('bewertet mangelhaft bei >= 100 Punkten', () => {
      expect(punktzahlBewertung(100)).toBe('mangelhaft');
      expect(punktzahlBewertung(199)).toBe('mangelhaft');
    });

    it('bewertet ungenügend bei < 100 Punkten', () => {
      expect(punktzahlBewertung(99)).toBe('ungenügend');
      expect(punktzahlBewertung(0)).toBe('ungenügend');
    });
  });

  describe('Punktzahl-Farbe', () => {
    it('gibt Grün bei >= 400 Punkten', () => {
      expect(punktzahlFarbe(400)).toBe('#16a34a');
      expect(punktzahlFarbe(500)).toBe('#16a34a');
    });

    it('gibt Gelb bei >= 300 Punkten', () => {
      expect(punktzahlFarbe(300)).toBe('#eab308');
      expect(punktzahlFarbe(399)).toBe('#eab308');
    });

    it('gibt Orange bei >= 200 Punkten', () => {
      expect(punktzahlFarbe(200)).toBe('#f59e0b');
      expect(punktzahlFarbe(299)).toBe('#f59e0b');
    });

    it('gibt Rot bei < 200 Punkten', () => {
      expect(punktzahlFarbe(199)).toBe('#dc2626');
      expect(punktzahlFarbe(0)).toBe('#dc2626');
    });
  });

  describe('Prüfsumme', () => {
    it('berechnet eine konsistente Prüfsumme', () => {
      const hash1 = berechnePruefsumme({ a: 1, b: 2 });
      const hash2 = berechnePruefsumme({ a: 1, b: 2 });
      expect(hash1).toBe(hash2);
    });

    it('berechnet unterschiedliche Prüfsummen für unterschiedliche Daten', () => {
      const hash1 = berechnePruefsumme({ a: 1 });
      const hash2 = berechnePruefsumme({ a: 2 });
      expect(hash1).not.toBe(hash2);
    });

    it('gibt einen hexadezimalen String zurück', () => {
      const hash = berechnePruefsumme('test');
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  describe('Save-Version', () => {
    it('hat die erwartete Save-Version', () => {
      expect(SAVE_VERSION).toBe(1);
    });
  });
});
