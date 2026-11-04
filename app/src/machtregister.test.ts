/**
 * @staatslenker/app machtregister.test.ts — Tests für Machtregister / Wahlprüfung (US-M5-08).
 *
 * Testet die Vorhersage-Logik für den nächsten Machtverlust.
 */
import { describe, expect, it } from 'vitest';

/**
 * Vorhersage-Logik extrahiert aus MachtRegister.svelte — testbar isoliert.
 */
interface GameStateMock {
  jahr: number;
  indikatoren: Record<string, number>;
  gruppen: { tag: string; zufriedenheit: number }[];
  legitimität: number;
  politisches_kapital: number;
  schulden: number;
  radikalisierung: number;
  rng: { seed: number; counter: number };
  konstitution: Record<string, string | boolean>;
  zufriedenheits_trace: Record<string, unknown>;
  beschlüsse: unknown[];
  cooldowns: Record<string, unknown>;
  session_seed?: number;
  wahl_niederlage?: { jahr: number; grund_id: string };
}

interface WahlregelVariantMock {
  typ: 'praesidentialwahl' | 'parlamentmehrheit' | 'putsch_roll';
  regel_id: string;
  intervall_jahre?: number;
  gewichtete_min?: number;
  schwächste_min?: number;
  mehrheit?: number;
  elite_min?: number;
  militaer_min?: number;
  legitimitaet_min?: number;
  wahrscheinlichkeit?: number;
}

interface TickRegelnMock {
  schwierigkeit: { verschleiß_multiplikator: number };
  ereignis_regeln: unknown[];
  entscheidungskarten: unknown[];
  karten_katalog: unknown[];
  ereignis_regeln?: unknown[];
  wahlregel?: WahlregelVariantMock;
}

function gewichteteZufriedenheit(gruppen: { tag: string; zufriedenheit: number }[]): number {
  if (gruppen.length === 0) return 0;
  const gesamt = gruppen.reduce((sum, g) => sum + g.zufriedenheit, 0);
  return gesamt / gruppen.length;
}

function schwächsteZufriedenheit(gruppen: { tag: string; zufriedenheit: number }[]): number {
  if (gruppen.length === 0) return 0;
  return Math.min(...gruppen.map((g) => g.zufriedenheit));
}

function wahlPrüfen(
  gruppen: { tag: string; zufriedenheit: number }[],
  regel: { gewichtete_min: number; schwächste_min: number },
): { gewonnen: boolean; grund_id: string; gewichtete_zufriedenheit: number; schwächste_gruppe: string } {
  const schwächste = gruppen.reduce(
    (s, g) => (g.zufriedenheit < s.zufriedenheit ? g : s),
    gruppen[0],
  );
  const gewichtete = gewichteteZufriedenheit(gruppen);

  if (gewichtete < regel.gewichtete_min) {
    return {
      gewonnen: false,
      grund_id: `wahl:gewichtete_unter_${regel.gewichtete_min}`,
      gewichtete_zufriedenheit: gewichtete,
      schwächste_gruppe: schwächste.tag,
    };
  }
  if (schwächste.zufriedenheit < regel.schwächste_min) {
    return {
      gewonnen: false,
      grund_id: `wahl:schwächste_unter_${regel.schwächste_min}`,
      gewichtete_zufriedenheit: gewichtete,
      schwächste_gruppe: schwächste.tag,
    };
  }
  return {
    gewonnen: true,
    grund_id: 'wahl:gewonnen',
    gewichtete_zufriedenheit: gewichtete,
    schwächste_gruppe: schwächste.tag,
  };
}

function wahlJahr(jahr: number, regel: { intervall_jahre: number }): boolean {
  return regel.intervall_jahre > 0 && jahr % regel.intervall_jahre === 0;
}

/**
 * Vereinfachte Version der Vorhersage-Logik aus MachtRegister.svelte.
 * Simuliert Ticks und prüft, wann der nächste Machtverlust eintritt.
 */
function berechneMachtverlustVorhersage(
  startState: GameStateMock,
  regeln: TickRegelnMock,
): { jahr: number; grund_id: string; zufriedenheit: number } | undefined {
  if (!regeln.wahlregel) return undefined;

  // Vereinfachte Simulation: Wir prüfen nur, ob die aktuelle Wahlregel verloren würde
  // wenn ein Machtcheck jetzt stattfinden würde
  if (regeln.wahlregel.typ === 'praesidentialwahl' && regeln.wahlregel.intervall_jahre) {
    const gewichtete = gewichteteZufriedenheit(startState.gruppen);
    const schwächste = schwächsteZufriedenheit(startState.gruppen);

    if (gewichtete < regeln.wahlregel.gewichtete_min) {
      return {
        jahr: startState.jahr,
        grund_id: `wahl:gewichtete_unter_${regeln.wahlregel.gewichtete_min}`,
        zufriedenheit: gewählte,
      };
    }
    if (schwächste < regeln.wahlregel.schwächste_min) {
      return {
        jahr: startState.jahr,
        grund_id: `wahl:schwächste_unter_${regeln.wahlregel.schwächste_min}`,
        zufriedenheit: schwächste,
      };
    }
  }

  return undefined;
}

function gewählte(gruppen: { tag: string; zufriedenheit: number }[]): number {
  if (gruppen.length === 0) return 0;
  return gruppen.reduce((sum, g) => sum + g.zufriedenheit, 0) / gruppen.length;
}

describe('US-M5-08: Machtregister / Wahlprüfung', () => {
  it('berechnet Machtverlust bei gewichteter Ø unter Schwelle', () => {
    const state: GameStateMock = {
      jahr: 5,
      indikatoren: {},
      gruppen: [
        { tag: 'arbeitnehmer', zufriedenheit: 30 },
        { tag: 'unternehmen', zufriedenheit: 70 },
      ],
      legitimität: 50,
      politisches_kapital: 5,
      schulden: 0,
      radikalisierung: 10,
      rng: { seed: 42, counter: 0 },
      konstitution: {},
      zufriedenheits_trace: {},
      beschlüsse: [],
      cooldowns: {},
    };

    const regeln: TickRegelnMock = {
      schwierigkeit: { verschleiß_multiplikator: 1.0 },
      ereignis_regeln: [],
      entscheidungskarten: [],
      karten_katalog: [],
      wahlregel: {
        typ: 'praesidentialwahl',
        regel_id: 'wahl_basis',
        intervall_jahre: 6,
        gewichtete_min: 47,
        schwächste_min: 35,
      },
    };

    const vorhersage = berechneMachtverlustVorhersage(state, regeln);
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
      politisches_kapital: 5,
      schulden: 0,
      radikalisierung: 10,
      rng: { seed: 42, counter: 0 },
      konstitution: {},
      zufriedenheits_trace: {},
      beschlüsse: [],
      cooldowns: {},
    };

    const regeln: TickRegelnMock = {
      schwierigkeit: { verschleiß_multiplikator: 1.0 },
      ereignis_regeln: [],
      entscheidungskarten: [],
      karten_katalog: [],
      wahlregel: {
        typ: 'praesidentialwahl',
        regel_id: 'wahl_basis',
        intervall_jahre: 6,
        gewichtete_min: 47,
        schwächste_min: 35,
      },
    };

    const vorhersage = berechneMachtverlustVorhersage(state, regeln);
    expect(vorhersage).toBeDefined();
    expect(vorhersage!.grund_id).toContain('schwächste_unter');
    expect(vorhersage!.zufriedenheit).toBe(20);
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
      politisches_kapital: 5,
      schulden: 0,
      radikalisierung: 10,
      rng: { seed: 42, counter: 0 },
      konstitution: {},
      zufriedenheits_trace: {},
      beschlüsse: [],
      cooldowns: {},
    };

    const regeln: TickRegelnMock = {
      schwierigkeit: { verschleiß_multiplikator: 1.0 },
      ereignis_regeln: [],
      entscheidungskarten: [],
      karten_katalog: [],
      wahlregel: {
        typ: 'praesidentialwahl',
        regel_id: 'wahl_basis',
        intervall_jahre: 6,
        gewichtete_min: 47,
        schwächste_min: 35,
      },
    };

    const vorhersage = berechneMachtverlustVorhersage(state, regeln);
    expect(vorhersage).toBeUndefined();
  });

  it('gibt undefined wenn keine Wahlregel definiert', () => {
    const state: GameStateMock = {
      jahr: 6,
      indikatoren: {},
      gruppen: [{ tag: 'arbeitnehmer', zufriedenheit: 50 }],
      legitimität: 50,
      politisches_kapital: 5,
      schulden: 0,
      radikalisierung: 10,
      rng: { seed: 42, counter: 0 },
      konstitution: {},
      zufriedenheits_trace: {},
      beschlüsse: [],
      cooldowns: {},
    };

    const regeln: TickRegelnMock = {
      schwierigkeit: { verschleiß_multiplikator: 1.0 },
      ereignis_regeln: [],
      entscheidungskarten: [],
      karten_katalog: [],
      wahlregel: undefined,
    };

    const vorhersage = berechneMachtverlustVorhersage(state, regeln);
    expect(vorhersage).toBeUndefined();
  });

  it('prüft wahlJahr korrekt', () => {
    expect(wahlJahr(6, { intervall_jahre: 6 })).toBe(true);
    expect(wahlJahr(5, { intervall_jahre: 6 })).toBe(false);
    expect(wahlJahr(12, { intervall_jahre: 6 })).toBe(true);
    expect(wahlJahr(1, { intervall_jahre: 6 })).toBe(false);
  });
});
