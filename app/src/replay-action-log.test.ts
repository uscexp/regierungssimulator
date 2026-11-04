/**
 * @staatslenker/app replay-action-log.test.ts — Tests für Replay/Action-Log Logik (US-M6-05).
 *
 * Testet Action-Log, Replay-Start, Rückspulen, Log-Export/Import.
 */
import { describe, expect, it } from 'vitest';

/**
 * ReplayActionLog-Logik extrahiert aus ReplayActionLog.svelte — testbar isoliert.
 */
const SAVE_SCHEMA_VERSION = 2;

interface UIStateMock {
  jahr: number;
  legitimität: number;
  pk: number;
  schulden: number;
  radikalisierung: number;
  indikatoren: Record<string, number>;
  gruppen: { zufriedenheit: number }[];
  rng: { seed: number; counter: number };
}

interface ActionLogEintrag {
  jahr: number;
  zuteilung: Readonly<Record<string, number>>;
  karten: string[];
  schulden_aufnahme: number;
  timestamp: string;
  rng_seed: number;
  rng_counter: number;
}

interface ReplayState {
  aktiv: boolean;
  seed: number;
  counter: number;
  eintraege: ActionLogEintrag[];
  originalState: UIStateMock | null;
}

function erzeugeRngState(seed: number): { seed: number; counter: number } {
  if (!Number.isFinite(seed))
    throw new TypeError(`RNG-Seed ist nicht endlich (wert=${String(seed)})`);
  return Object.freeze({ seed: seed | 0, counter: 0 });
}

function loggeAktion(
  eintraege: ActionLogEintrag[],
  jahr: number,
  zuteilung: Readonly<Record<string, number>>,
  karten: string[],
  schulden_aufnahme: number,
  state: UIStateMock,
): void {
  const eintrag: ActionLogEintrag = {
    jahr,
    zuteilung: { ...zuteilung },
    karten: [...karten],
    schulden_aufnahme,
    timestamp: new Date().toISOString(),
    rng_seed: state.rng.seed,
    rng_counter: state.rng.counter,
  };
  eintraege.push(eintrag);
}

function starteReplay(
  seed: number,
  state: UIStateMock,
): { replay: ReplayState; neuerState: UIStateMock } {
  const rngState = erzeugeRngState(seed);
  const replay: ReplayState = {
    aktiv: true,
    seed,
    counter: 0,
    eintraege: [],
    originalState: { ...state },
  };
  const neuerState = {
    ...state,
    rng: rngState,
    jahr: 0,
  };
  return { replay, neuerState };
}

function rueckspulen(
  zielJahr: number,
  replay: ReplayState,
  state: UIStateMock,
): { replay: ReplayState; neuerState: UIStateMock | null } {
  const eintrag = replay.eintraege.find((e) => e.jahr === zielJahr);
  if (!eintrag) {
    return { replay, neuerState: null };
  }

  const rngState = erzeugeRngState(eintrag.rng_seed);
  rngState.counter = eintrag.rng_counter;

  const neuerReplay: ReplayState = {
    ...replay,
    eintraege: replay.eintraege.filter((e) => e.jahr <= zielJahr),
    counter: eintrag.rng_counter,
  };

  const neuerState = {
    ...replay.originalState!,
    rng: rngState,
    jahr: zielJahr,
  };

  return { replay: neuerReplay, neuerState };
}

function beendeReplay(
  replay: ReplayState,
  state: UIStateMock,
): { replay: ReplayState; neuerState: UIStateMock } {
  return {
    replay: {
      aktiv: false,
      seed: 424242,
      counter: 0,
      eintraege: [],
      originalState: null,
    },
    neuerState: replay.originalState ?? state,
  };
}

function logLoeschen(replay: ReplayState): ReplayState {
  return {
    ...replay,
    eintraege: [],
    counter: 0,
  };
}

function logExportieren(replay: ReplayState): string {
  return JSON.stringify(
    {
      seed: replay.seed,
      counter: replay.counter,
      eintraege: replay.eintraege,
      exportiertAm: new Date().toISOString(),
    },
    null,
    2,
  );
}

function logImportieren(json: string): { replay: ReplayState; erfolgreich: boolean } {
  try {
    const daten = JSON.parse(json);
    const replay: ReplayState = {
      aktiv: true,
      seed: daten.seed ?? 424242,
      counter: daten.counter ?? 0,
      eintraege: daten.eintraege ?? [],
      originalState: null,
    };
    return { replay, erfolgreich: true };
  } catch {
    return { replay: { aktiv: false, seed: 424242, counter: 0, eintraege: [], originalState: null }, erfolgreich: false };
  }
}

function aktionsAnzahl(replay: ReplayState): number {
  return replay.eintraege.length;
}

function jahreAbgedeckt(replay: ReplayState): number {
  if (replay.eintraege.length === 0) return 0;
  const jahre = replay.eintraege.map((e) => e.jahr);
  return Math.max(...jahre) - Math.min(...jahre) + 1;
}

const TEST_STATE: UIStateMock = {
  jahr: 6,
  legitimität: 52,
  pk: 42,
  schulden: 10,
  radikalisierung: 0,
  indikatoren: { infrastruktur: 45, bildung: 50 },
  gruppen: [{ zufriedenheit: 60 }, { zufriedenheit: 45 }],
  rng: { seed: 424242, counter: 0 },
};

describe('US-M6-05: Replay & Action-Log', () => {
  describe('Action-Log', () => {
    it('protokolliert eine Aktion korrekt', () => {
      const eintraege: ActionLogEintrag[] = [];
      loggeAktion(eintraege, 1, { infrastruktur: 2, bildung: 2 }, [], 0, TEST_STATE);
      expect(eintraege.length).toBe(1);
      expect(eintraege[0].jahr).toBe(1);
      expect(eintraege[0].zuteilung.infrastruktur).toBe(2);
      expect(eintraege[0].karten).toEqual([]);
      expect(eintraege[0].schulden_aufnahme).toBe(0);
      expect(eintraege[0].rng_seed).toBe(424242);
      expect(eintraege[0].rng_counter).toBe(0);
      expect(eintraege[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('protokolliert mehrere Aktionen mit steigenden Jahren', () => {
      const eintraege: ActionLogEintrag[] = [];
      loggeAktion(eintraege, 1, { a: 1 }, [], 0, TEST_STATE);
      loggeAktion(eintraege, 2, { b: 2 }, ['karte_x'], 5, TEST_STATE);
      loggeAktion(eintraege, 3, { c: 3 }, ['karte_y'], 0, TEST_STATE);
      expect(eintraege.length).toBe(3);
      expect(eintraege[0].jahr).toBe(1);
      expect(eintraege[1].jahr).toBe(2);
      expect(eintraege[2].jahr).toBe(3);
      expect(eintraege[1].karten).toEqual(['karte_x']);
      expect(eintraege[2].schulden_aufnahme).toBe(0);
    });
  });

  describe('Replay-Start', () => {
    it('startet einen Replay mit gegebenem Seed', () => {
      const { replay, neuerState } = starteReplay(12345, TEST_STATE);
      expect(replay.aktiv).toBe(true);
      expect(replay.seed).toBe(12345);
      expect(replay.counter).toBe(0);
      expect(replay.eintraege.length).toBe(0);
      expect(replay.originalState).toBeDefined();
      expect(neuerState.rng.seed).toBe(12345);
      expect(neuerState.rng.counter).toBe(0);
      expect(neuerState.jahr).toBe(0);
    });

    it('verwendet einen anderen Seed für jeden Replay-Start', () => {
      const r1 = starteReplay(100, TEST_STATE);
      const r2 = starteReplay(200, TEST_STATE);
      expect(r1.replay.seed).toBe(100);
      expect(r2.replay.seed).toBe(200);
      expect(r1.neuerState.rng.seed).toBe(100);
      expect(r2.neuerState.rng.seed).toBe(200);
    });
  });

  describe('Rückspulen', () => {
    it('spult zu einem existierenden Jahr zurück', () => {
      const eintraege: ActionLogEintrag[] = [];
      loggeAktion(eintraege, 1, { a: 1 }, [], 0, TEST_STATE);
      loggeAktion(eintraege, 2, { b: 2 }, [], 0, TEST_STATE);
      loggeAktion(eintraege, 3, { c: 3 }, [], 0, TEST_STATE);

      const replay: ReplayState = {
        aktiv: true,
        seed: 424242,
        counter: 10,
        eintraege,
        originalState: TEST_STATE,
      };

      const { replay: neuerReplay, neuerState } = rueckspulen(2, replay, TEST_STATE);
      expect(neuerState).not.toBeNull();
      expect(neuerState!.jahr).toBe(2);
      expect(neuerReplay.eintraege.length).toBe(2);
      expect(neuerReplay.eintraege[0].jahr).toBe(1);
      expect(neuerReplay.eintraege[1].jahr).toBe(2);
      expect(neuerReplay.counter).toBe(eintraege[1].rng_counter);
    });

    it('gibt null zurück bei nicht existierendem Jahr', () => {
      const eintraege: ActionLogEintrag[] = [];
      loggeAktion(eintraege, 1, { a: 1 }, [], 0, TEST_STATE);

      const replay: ReplayState = {
        aktiv: true,
        seed: 424242,
        counter: 0,
        eintraege,
        originalState: TEST_STATE,
      };

      const { replay: neuerReplay, neuerState } = rueckspulen(99, replay, TEST_STATE);
      expect(neuerState).toBeNull();
      expect(neuerReplay.eintraege.length).toBe(1);
    });
  });

  describe('Replay beenden', () => {
    it('kehrt zum Original-State zurück', () => {
      const replay: ReplayState = {
        aktiv: true,
        seed: 12345,
        counter: 5,
        eintraege: [
          { jahr: 1, zuteilung: {}, karten: [], schulden_aufnahme: 0, timestamp: '', rng_seed: 1, rng_counter: 1 },
        ],
        originalState: TEST_STATE,
      };

      const { replay: neuerReplay, neuerState } = beendeReplay(replay, TEST_STATE);
      expect(neuerReplay.aktiv).toBe(false);
      expect(neuerReplay.eintraege.length).toBe(0);
      expect(neuerState).toBe(TEST_STATE);
    });

    it('behält den aktuellen State wenn kein Original vorhanden', () => {
      const replay: ReplayState = {
        aktiv: true,
        seed: 12345,
        counter: 5,
        eintraege: [],
        originalState: null,
      };

      const { replay: neuerReplay, neuerState } = beendeReplay(replay, TEST_STATE);
      expect(neuerReplay.aktiv).toBe(false);
      expect(neuerState).toBe(TEST_STATE);
    });
  });

  describe('Log löschen', () => {
    it('löscht alle Einträge und setzt Counter zurück', () => {
      const eintraege: ActionLogEintrag[] = [];
      loggeAktion(eintraege, 1, { a: 1 }, [], 0, TEST_STATE);
      loggeAktion(eintraege, 2, { b: 2 }, [], 0, TEST_STATE);

      const replay: ReplayState = {
        aktiv: true,
        seed: 424242,
        counter: 10,
        eintraege,
        originalState: TEST_STATE,
      };

      const gelöscht = logLoeschen(replay);
      expect(gelöscht.eintraege.length).toBe(0);
      expect(gelöscht.counter).toBe(0);
      expect(gelöscht.aktiv).toBe(true);
      expect(gelöscht.seed).toBe(424242);
    });
  });

  describe('Log Export / Import', () => {
    it('exportiert den Log als JSON', () => {
      const eintraege: ActionLogEintrag[] = [];
      loggeAktion(eintraege, 1, { a: 1 }, [], 0, TEST_STATE);

      const replay: ReplayState = {
        aktiv: true,
        seed: 424242,
        counter: 1,
        eintraege,
        originalState: TEST_STATE,
      };

      const json = logExportieren(replay);
      const daten = JSON.parse(json);
      expect(daten.seed).toBe(424242);
      expect(daten.counter).toBe(1);
      expect(daten.eintraege.length).toBe(1);
      expect(daten.eintraege[0].jahr).toBe(1);
      expect(daten.exportiertAm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('importiert einen gültigen Log', () => {
      const json = JSON.stringify({
        seed: 99999,
        counter: 5,
        eintraege: [
          { jahr: 1, zuteilung: { a: 1 }, karten: [], schulden_aufnahme: 0, timestamp: '2024-01-01T00:00:00.000Z', rng_seed: 1, rng_counter: 1 },
        ],
      });
      const { replay, erfolgreich } = logImportieren(json);
      expect(erfolgreich).toBe(true);
      expect(replay.aktiv).toBe(true);
      expect(replay.seed).toBe(99999);
      expect(replay.counter).toBe(5);
      expect(replay.eintraege.length).toBe(1);
      expect(replay.eintraege[0].jahr).toBe(1);
    });

    it('schlägt bei ungültigem JSON fehl', () => {
      const { replay, erfolgreich } = logImportieren('nicht-json');
      expect(erfolgreich).toBe(false);
      expect(replay.aktiv).toBe(false);
      expect(replay.eintraege.length).toBe(0);
    });

    it('schlägt bei leerem String fehl', () => {
      const { erfolgreich } = logImportieren('');
      expect(erfolgreich).toBe(false);
    });
  });

  describe('Hilfsfunktionen', () => {
    it('gibt die Aktions-Anzahl zurück', () => {
      const replayLeer: ReplayState = { aktiv: false, seed: 1, counter: 0, eintraege: [], originalState: null };
      expect(aktionsAnzahl(replayLeer)).toBe(0);

      const eintraege: ActionLogEintrag[] = [];
      loggeAktion(eintraege, 1, { a: 1 }, [], 0, TEST_STATE);
      loggeAktion(eintraege, 2, { b: 2 }, [], 0, TEST_STATE);
      const replayMitEinträgen: ReplayState = { aktiv: true, seed: 1, counter: 2, eintraege, originalState: null };
      expect(aktionsAnzahl(replayMitEinträgen)).toBe(2);
    });

    it('gibt die abgedeckten Jahre zurück', () => {
      const replayLeer: ReplayState = { aktiv: false, seed: 1, counter: 0, eintraege: [], originalState: null };
      expect(jahreAbgedeckt(replayLeer)).toBe(0);

      const eintraege: ActionLogEintrag[] = [];
      loggeAktion(eintraege, 5, { a: 1 }, [], 0, TEST_STATE);
      loggeAktion(eintraege, 8, { b: 2 }, [], 0, TEST_STATE);
      loggeAktion(eintraege, 10, { c: 3 }, [], 0, TEST_STATE);
      const replayMitEinträgen: ReplayState = { aktiv: true, seed: 1, counter: 3, eintraege, originalState: null };
      expect(jahreAbgedeckt(replayMitEinträgen)).toBe(6); // 10 - 5 + 1 = 6
    });
  });

  describe('RNG-State', () => {
    it('erzeugt einen konsistenten RNG-State', () => {
      const r1 = erzeugeRngState(424242);
      const r2 = erzeugeRngState(424242);
      expect(r1.seed).toBe(r2.seed);
      expect(r1.counter).toBe(r2.counter);
    });

    it('wirft einen Fehler bei nicht-endlichem Seed', () => {
      expect(() => erzeugeRngState(NaN)).toThrow();
      expect(() => erzeugeRngState(Infinity)).toThrow();
    });

    it('normalisiert einen Float-Seed auf int32', () => {
      const r = erzeugeRngState(42.7);
      expect(r.seed).toBe(42);
    });
  });
});
