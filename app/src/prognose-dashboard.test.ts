/**
 * @staatslenker/app prognose-dashboard.test.ts — Tests für Prognose-Logik (US-M5-10).
 *
 * Testet die Berechnung der Prognose für den nächsten Machtverlust.
 */
import { describe, expect, it } from 'vitest';

/**
 * Prognose-Logik extrahiert aus PrognoseDashboard.svelte — testbar isoliert.
 */
interface GameStateMock {
  jahr: number;
  indikatoren: Record<string, number>;
  gruppen: { tag: string; zufriedenheit: number }[];
  legitimität: number;
  radikalisierung: number;
  politisches_kapital: number;
  schulden: number;
  wahl_niederlage?: { jahr: number; grund_id: string };
}

interface WahlregelVariantMock {
  typ: string;
  regel_id: string;
  intervall_jahre?: number;
  gewählte_at?: number;
  schwächste_min?: number;
}

function gewichteteZufriedenheit(gruppen: { tag: string; zufriedenheit: number }[]): number {
  if (gruppen.length === 0) return 0;
  return gruppen.reduce((sum, g) => sum + g.zufriedenheit, 0) / gruppen.length;
}

function schwächsteZufriedenheit(gruppen: { tag: string; zufriedenheit: number }[]): number {
  if (gruppen.length === 0) return 0;
  return Math.min(...gruppen.map((g) => g.zufriedenheit));
}

function wahlPrüfen(
  gruppen: { tag: string; zufriedenheit: number }[],
  regel: { gewichtete_min: number; schwächste_min: number },
): { gewonnen: boolean; grund_id: string; gewichtete_zufriedenheit: number; schwächste_gruppe: string } {
  const schwächste = gruppen.reduce((s, g) => (g.zufriedenheit < s.zufriedenheit ? g : s), gruppen[0]);
  const gewichtete = gewichteteZufriedenheit(gruppen);

  if (gewichtet < regel.gewichtete_min) {
    return {
      gewonnen: false,
      grund_id: `wahl:gewichtete_unter_${regel.gewichtete_min}`,
      gewichtete_zufriedenheit: gewichtet,
      schwächste_gruppe: schwächste.tag,
    };
  }
  if (schwächtste.zufriedenheit < regel.schwächste_min) {
    return {
      gewonnen: false,
      grund_id: `wahl:schwächste_unter_${regel.schwächste_min}`,
      gewichtete_zufriedenheit: gewichtet,
      schwächste_gruppe: schwächste.tag,
    };
  }
  return {
    gewonnen: true,
    grund_id: 'wahl:gewonnen',
    gewichtete_zufriedenheit: gewichtet,
    schwächste_gruppe: schwächste.tag,
  };
}

function wahlJahr(jahr: number, regel: { intervall_jahre: number }): boolean {
  return regel.intervall_jahre > 0 && jahr % regel.intervall_jahre === 0;
}

/**
 * Vereinfachte Version der Prognose-Logik aus PrognoseDashboard.svelte.
 * Simuliert Ticks und prüft, wann der nächste Machtverlust eintritt.
 */
function berechnePrognose(
  startState: GameStateMock,
  regeln: { wahlregel?: WahlregelVariantMock },
): { jahr: number; grund_id: string; wert: number; jahre_bis_zum_verlust: number } | null {
  if (!regeln.wahlregel) return null;

  if (regeln.wahlregel.typ === 'praesidentialwahl' && regeln.wahlregel.intervall_jahre) {
    const gewichtete = gewichteteZufriedenheit(startState.gruppen);
    const schwächste = schwächsteZufriedenheit(startState.gruppen);

    if (gewichtete < regeln.wahlregel!.gewählte_at!) {
      return {
        jahr: startState.jahr,
        grund_id: `wahl:gewählte_unter_${regeln.wahlregel!.gewählte_at}`,
        wert: gewichtete,
        jahre_bis_zum_verlust: 0,
      };
    }
    if (schwächste.zufriedenheit < regeln.wahlregel!.schwächste_min!) {
      return {
        jahr: startState.jahr,
        grund_id: `wahl:schwächste_unter_${regeln.wahlregel!.schwächste_min}`,
        wert: schwächste.zufriedenheit,
        jahre_bis_zum_verlust: 0,
      };
    }
  }

  return null;
}

describe('US-M5-10: Prognose-Dashboard', () => {
  it('berechnet Machtverlust bei gewichteter Ø unter Schwelle', () => {
    const state: GameStateMock = {
      jahr: 5,
      indikatoren: {},
      gruppen: [
        { tag: 'arbeitnehmer', zufriedenheit: 30 },
        { tag: 'unternehmen', zufriedenheit: 70 },
      ],
      legitimität: 50,
      radikalisierung: 10,
      politisches_kapital: 5,
      schulden: 0,
      wahl_niederlage: undefined,
    };

    const regeln = {
      wahlregel: {
        typ: 'praesidentialwahl',
        regel_id: 'wahl_basis',
        intervall_jahre: 6,
        gewichtete_min: 47,
        schwächste_min: 35,
      },
    };

    const vorhersage = berechnePrognose(state, regeln);
    expect(vorhersage).toBeDefined();
    expect(vorhersage!.grund_id).toContain('gewichtete_unter');
    expect(vorhersage!.jahr).toBe(5);
  });

  it('berechnet Machtverlust bei schwächster Gruppe unter Schwelle', () => {
    const state: GameStateMock = {
      jahr: 6,
      indikatoren: {},
      gruppen: [
        { tag: 'arbeitnehmer', zufriedenheit: 40 },
        { tag: 'unternehmen', zufriedenheit: 20 },
      ],
      legitimität: 50,
      radikalisierung: 10,
      politisches_kapital: 5,
      schulden: 0,
      wahl_niederlage: undefined,
    };

    const regeln = {
      wahlregel: {
        typ: 'praesidentialwahl',
        regel_id: 'wahl_basis',
        intervall_jahre: 6,
        gewichtete_min: 47,
        schwächste_min: 35,
      },
    };

    const vorhersage = berechnePrognose(state, regeln);
    expect(vorhersage).toBeDefined();
    expect(vorhersage!.grund_id).toContain('schwächste_unter');
    expect(vorhersage!.wert).toBe(20);
  });

  it('gibt keinen Machtverlust bei Erfüllung aller Schwellen', () => {
    const state: GameStateMock = {
      jahr: 6,
      indikatoren: {},
      gruppen: [
        { tag: 'arbeitnehmer', zufriedenheit: 60 },
        { tag: 'unternehmen', zufriedenheit: 50 },
      ],
      legitimität: 50,
      radikalisierung: 10,
      politisches_kapital: 5,
      schulden: 0,
      wahl_niederlage: undefined,
    };

    const regeln = {
      wahlregel: {
        typ: 'praesidentialwahl',
        regel_id: 'wahl_basis',
        intervall_jahre: 6,
        gewichtete_min: 47,
        schwächste_min: 35,
      },
    };

    const vorhersage = berechnePrognose(state, regeln);
    expect(vorhersage).toBeUndefined();
  });

  it('gibt undefined wenn keine Wahlregel definiert', () => {
    const state: GameStateMock = {
      jahr: 6,
      indikatoren: {},
      gruppen: [{ tag: 'arbeitnehmer', zufriedenheit: 50 }],
      legitimität: 50,
      radikalisierung: 10,
      politisches_kapital: 5,
      schulden: 0,
      wahl_niederlage: undefined,
    };

    const regeln = {
      wahlregel: undefined,
    };

    const vorhersage = berechnePrognose(state, regeln);
    expect(vorhersage).toBeUndefined();
  });

  it('prüft wahlJahr korrekt', () => {
    expect(wahlJahr(6, { intervall_jahre: 6 })).toBe(true);
    expect(wahlJahr(5, { intervall_jahre: 6 })).toBe(false);
    expect(wahlJahr(12, { intervall_jahre: 6 })).toBe(true);
    expect(wahlJahr(1, { intervall_jahre: 6 })).toBe(false);
  });
});
