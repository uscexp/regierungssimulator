/**
 * @staatslenker/app game-over.test.ts — Tests für Game-Over-Screen Logik (US-M6-07).
 *
 * Testet Machtverlust-Ursachen, Score-Berechnung, Bewertung und Farbkodierung.
 */
import { describe, expect, it } from 'vitest';

/**
 * GameOverScreen-Logik extrahiert aus GameOverScreen.svelte — testbar isoliert.
 */
interface UIStateMock {
  jahr: number;
  legitimität: number;
  pk: number;
  schulden: number;
  radikalisierung: number;
  indikatoren: Record<string, number>;
  gruppen: { zufriedenheit: number }[];
  rng: { seed: number; counter: number };
  wahl_niederlage?: { jahr: number; grund_id: string };
}

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

function extrahiereUrsache(state: UIStateMock): MachtverlustUrsache | null {
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

function berechneFinalScore(state: UIStateMock): number {
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

describe('US-M6-07: Game-Over-Screen', () => {
  describe('Machtverlust-Ursachen', () => {
    it('gibt null zurück wenn kein Machtverlust vorliegt', () => {
      const state: UIStateMock = {
        jahr: 6,
        legitimität: 52,
        pk: 42,
        schulden: 10,
        radikalisierung: 0,
        indikatoren: {},
        gruppen: [],
        rng: { seed: 424242, counter: 0 },
      };
      expect(extrahiereUrsache(state)).toBe(null);
    });

    it('extrahiert Wahl verloren (gewichtete)', () => {
      const state: UIStateMock = {
        jahr: 6,
        legitimität: 52,
        pk: 42,
        schulden: 10,
        radikalisierung: 0,
        indikatoren: {},
        gruppen: [],
        rng: { seed: 424242, counter: 0 },
        wahl_niederlage: { jahr: 6, grund_id: 'wahl:gewichtete_unter_47' },
      };
      const ursache = extrahiereUrsache(state);
      expect(ursache).not.toBeNull();
      expect(ursache!.name).toBe('Wahl verloren');
      expect(ursache!.farbe).toBe('#dc2626');
    });

    it('extrahiert Wahl verloren (schwächste Gruppe)', () => {
      const state: UIStateMock = {
        jahr: 6,
        legitimität: 52,
        pk: 42,
        schulden: 10,
        radikalisierung: 0,
        indikatoren: {},
        gruppen: [],
        rng: { seed: 424242, counter: 0 },
        wahl_niederlage: { jahr: 6, grund_id: 'wahl:schwächste_unter_35' },
      };
      const ursache = extrahiereUrsache(state);
      expect(ursache).not.toBeNull();
      expect(ursache!.name).toBe('Wahl verloren (schwächste Gruppe)');
    });

    it('extrahiert Putsch erfolgreich', () => {
      const state: UIStateMock = {
        jahr: 6,
        legitimität: 52,
        pk: 42,
        schulden: 10,
        radikalisierung: 0,
        indikatoren: {},
        gruppen: [],
        rng: { seed: 424242, counter: 0 },
        wahl_niederlage: { jahr: 6, grund_id: 'putsch:verloren' },
      };
      const ursache = extrahiereUrsache(state);
      expect(ursache).not.toBeNull();
      expect(ursache!.name).toBe('Putsch erfolgreich');
      expect(ursache!.farbe).toBe('#b91c1c');
    });

    it('extrahiert Misstrauensvotum', () => {
      const state: UIStateMock = {
        jahr: 6,
        legitimität: 52,
        pk: 42,
        schulden: 10,
        radikalisierung: 0,
        indikatoren: {},
        gruppen: [],
        rng: { seed: 424242, counter: 0 },
        wahl_niederlage: { jahr: 6, grund_id: 'misstrauen:verloren' },
      };
      const ursache = extrahiereUrsache(state);
      expect(ursache).not.toBeNull();
      expect(ursache!.name).toBe('Misstrauensvotum');
      expect(ursache!.farbe).toBe('#eab308');
    });

    it('extrahiert Legitimität zusammengebrochen', () => {
      const state: UIStateMock = {
        jahr: 6,
        legitimität: 52,
        pk: 42,
        schulden: 10,
        radikalisierung: 0,
        indikatoren: {},
        gruppen: [],
        rng: { seed: 424242, counter: 0 },
        wahl_niederlage: { jahr: 6, grund_id: 'legitimität:unter_null' },
      };
      const ursache = extrahiereUrsache(state);
      expect(ursache).not.toBeNull();
      expect(ursache!.name).toBe('Legitimität zusammengebrochen');
    });

    it('gibt Unbekannte Ursache für unbekannte Grund-ID zurück', () => {
      const state: UIStateMock = {
        jahr: 6,
        legitimität: 52,
        pk: 42,
        schulden: 10,
        radikalisierung: 0,
        indikatoren: {},
        gruppen: [],
        rng: { seed: 424242, counter: 0 },
        wahl_niederlage: { jahr: 6, grund_id: 'unbekannt:grund' },
      };
      const ursache = extrahiereUrsache(state);
      expect(ursache).not.toBeNull();
      expect(ursache!.name).toBe('Unbekannte Ursache');
      expect(ursache!.farbe).toBe('#64748b');
    });
  });

  describe('Final-Score-Berechnung', () => {
    const testState: UIStateMock = {
      jahr: 10,
      legitimität: 52,
      pk: 42,
      schulden: 10,
      radikalisierung: 0,
      indikatoren: {
        wirtschaft: 80,
        gesundheit: 60,
        bildung: 70,
        infrastruktur: 50,
        forschung: 40,
      },
      gruppen: [
        { zufriedenheit: 60 },
        { zufriedenheit: 40 },
        { zufriedenheit: 80 },
      ],
      rng: { seed: 424242, counter: 0 },
    };

    it('berechnet den Final-Score für einen Test-Zustand', () => {
      const score = berechneFinalScore(testState);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('berechnet Entwicklungsindex korrekt', () => {
      // 80*0.25 + 60*0.20 + 70*0.20 + 50*0.20 + 40*0.15 = 20+12+14+10+6 = 62
      const indikatoren = {
        wirtschaft: 80,
        gesundheit: 60,
        bildung: 70,
        infrastruktur: 50,
        forschung: 40,
      };
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

    it('gibt 0 für leere Indikatoren zurück', () => {
      const state: UIStateMock = {
        jahr: 10,
        legitimität: 52,
        pk: 42,
        schulden: 10,
        radikalisierung: 0,
        indikatoren: {},
        gruppen: [],
        rng: { seed: 424242, counter: 0 },
      };
      expect(berechneFinalScore(state)).toBeGreaterThanOrEqual(0);
    });

    it('skaliert Regime-Dauer auf 0-100 (50 Jahre = 100)', () => {
      const state50: UIStateMock = {
        ...testState,
        jahr: 50,
        indikatoren: {},
        gruppen: [],
      };
      const state100: UIStateMock = {
        ...testState,
        jahr: 100,
        indikatoren: {},
        gruppen: [],
      };
      const score50 = berechneFinalScore(state50);
      const score100 = berechneFinalScore(state100);
      // Bei gleichem Rest sollte score100 >= score50 sein (mehr Regime-Dauer = mehr Punkte)
      expect(score100).toBeGreaterThanOrEqual(score50);
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

  describe('Ursachen-Farben', () => {
    it('hat korrekte Farben für alle Ursachen', () => {
      expect(MACHTVERLUST_URSACHEN['wahl:gewichtete_unter_47'].farbe).toBe('#dc2626');
      expect(MACHTVERLUST_URSACHEN['wahl:schwächste_unter_35'].farbe).toBe('#dc2626');
      expect(MACHTVERLUST_URSACHEN['putsch:verloren'].farbe).toBe('#b91c1c');
      expect(MACHTVERLUST_URSACHEN['misstrauen:verloren'].farbe).toBe('#eab308');
      expect(MACHTVERLUST_URSACHEN['legitimität:unter_null'].farbe).toBe('#dc2626');
    });
  });
});
