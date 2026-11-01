/** core/src/events.test.ts — Event-Registry (US-M2-02, FR-025).
 *
 * Getestet wird die Bedingungs-Auswertung mit typisierten Prädikaten und der
 * seed-geregelte Wurf über den State-RNG (FR-004). Gleicher Seed = gleiche Folge
 * (deterministisch, replaybar).
 */

import { describe, expect, it } from 'vitest';

import { ereignisPruefen, eregistrierung, type EreignisRegel } from './events.js';
import { erzeugeGameState, type GameState } from './state.js';
import {
  indikatorVonSchema,
  gruppeZufriedenheitSchema,
  schuldenVonSchema,
  oderSchema,
  type Praedikat,
} from './eval.js';

const start: Startkonfiguration = {
  jahr: 1,
  indikatoren: { wirtschaft: 40, bildung: 50, gesundheit: 60, infrastruktur: 45, forschung: 30 },
  gruppen: [
    {
      tag: 'unternehmen',
      zufriedenheit: 45,
      bevölkerungsanteil: 21.3,
      gewichte: { wirtschaft: 0.647, infrastruktur: 0.353 },
    },
    {
      tag: 'arbeitnehmer',
      zufriedenheit: 50,
      bevölkerungsanteil: 51.1,
      gewichte: { wirtschaft: 0.643, gesundheit: 0.357 },
    },
  ],
  budget: {},
  politisches_kapital: 5,
  legitimitaet: 50,
  schulden: 10,
  radikalisierung: 10,
  rng: { seed: 424242, counter: 0 },
  konstitution: { steuermodell: 'flat' },
  zufriedenheits_trace: {},
  beschlüsse: [],
};

const state = (extra: Partial<Startkonfiguration> = {}): GameState =>
  erzeugeGameState({ ...start, ...extra });

type Startkonfiguration = Omit<GameState, 'schema_version' | 'beschlüsse'> & {
  readonly beschlüsse?: readonly never[];
};

const indikatorWirtschaftNiedrig: Praedikat = indikatorVonSchema.parse({
  typ: 'indikator_von',
  regel_id: 'pr_wirtschaft_niedrig',
  tag: 'wirtschaft',
  op: '<',
  wert: 45,
});

const gruppeArbeitnehmerUnzufrieden: Praedikat = gruppeZufriedenheitSchema.parse({
  typ: 'gruppe_zufriedenheit',
  regel_id: 'pr_arbeitnehmer_unzufrieden',
  tag: 'arbeitnehmer',
  op: '<',
  wert: 60,
});

const schuldenHoch: Praedikat = schuldenVonSchema.parse({
  typ: 'schulden_von',
  regel_id: 'pr_schulden_hoch',
  op: '>=',
  wert: 10,
});

const oderOder: Praedikat = oderSchema.parse({
  typ: 'oder',
  regel_id: 'pr_oder',
  praedikate: [
    schuldenVonSchema.parse({
      typ: 'schulden_von',
      regel_id: 'pr_schulden_hoch2',
      op: '>=',
      wert: 1000,
    }),
    schuldenVonSchema.parse({
      typ: 'schulden_von',
      regel_id: 'pr_schulden_hoch3',
      op: '>=',
      wert: 10,
    }),
  ],
});

describe('core/events — Event-Registry mit typisierten Prädikaten (US-M2-02, FR-025)', () => {
  describe('ereignisPrüfen — Bedingungsprüfung mit typisiertem Prädikat', () => {
    it('erfüllte Bedingung → wahr', () => {
      const ergebnis = ereignisPruefen(indikatorWirtschaftNiedrig, state());
      expect(ergebnis).toBe(true);
    });

    it('nicht erfüllte Bedingung → falsch', () => {
      const p = indikatorVonSchema.parse({
        typ: 'indikator_von',
        regel_id: 'pr_wirtschaft_hoch',
        tag: 'wirtschaft',
        op: '>',
        wert: 100,
      });
      const ergebnis = ereignisPruefen(p, state());
      expect(ergebnis).toBe(false);
    });

    it('fehlender Indikator zählt als 0 → wahr bei >= 0', () => {
      const p = indikatorVonSchema.parse({
        typ: 'indikator_von',
        regel_id: 'pr_fehlend',
        tag: 'nicht_da',
        op: '>=',
        wert: 0,
      });
      const ergebnis = ereignisPruefen(p, state());
      expect(ergebnis).toBe(true);
    });

    it('kaputter Prädikat-Typ wirft mit Regel-Id', () => {
      const kaput = { typ: 'unbekannt', regel_id: 'kaputt' } as never;
      expect(() => ereignisPruefen(kaput, state())).toThrow(/unbekannter Variant-Typ/);
    });
  });

  describe('eregistrierung — Würfel über den State-RNG (FR-004)', () => {
    const regelMitBedingung: EreignisRegel = {
      id: 'streik',
      bedingung: gruppeArbeitnehmerUnzufrieden,
      wahrscheinlichkeit: 1.0,
      effekte: [{ ziel: 'gruppen', tag: 'arbeitnehmer', delta: -5 }],
    };

    it('wahrscheinlichkeit 1.0 → Ereignis wird ausgelöst', () => {
      const ergebnis = eregistrierung([regelMitBedingung], state());
      expect(ergebnis.ereignisse).toHaveLength(1);
      expect(ergebnis.ereignisse[0]!.ereignis_id).toBe('streik');
    });

    it('wahrscheinlichkeit 0.0 → Ereignis wird nie ausgelöst', () => {
      const p = gruppeZufriedenheitSchema.parse({
        typ: 'gruppe_zufriedenheit',
        regel_id: 'pr_arbeitnehmer_immer_unzufrieden',
        tag: 'arbeitnehmer',
        op: '>=',
        wert: 0,
      });
      const regel: EreignisRegel = {
        id: 'streik_niemals',
        bedingung: p,
        wahrscheinlichkeit: 0.0,
        effekte: [{ ziel: 'gruppen', tag: 'arbeitnehmer', delta: -5 }],
      };
      const ergebnis = eregistrierung([regel], state());
      expect(ergebnis.ereignisse).toHaveLength(0);
      expect(ergebnis.rng.counter).toBe(0);
    });

    it('Bedingung nicht erfüllt → kein Wurf, RNG unverändert (FR-004)', () => {
      const p = gruppeZufriedenheitSchema.parse({
        typ: 'gruppe_zufriedenheit',
        regel_id: 'pr_arbeitnehmer_immer_zufrieden',
        tag: 'arbeitnehmer',
        op: '>=',
        wert: 90,
      });
      const regel: EreignisRegel = {
        id: 'streik_nie',
        bedingung: p,
        wahrscheinlichkeit: 1.0,
        effekte: [{ ziel: 'gruppen', tag: 'arbeitnehmer', delta: -5 }],
      };
      const ergebnis = eregistrierung([regel], state());
      expect(ergebnis.ereignisse).toHaveLength(0);
      expect(ergebnis.rng.counter).toBe(0);
    });

    it('gleicher Seed → identische Folge (deterministisch)', () => {
      const regeln: readonly EreignisRegel[] = [
        {
          id: 'ereignis_a',
          bedingung: schuldenHoch,
          wahrscheinlichkeit: 1.0,
          effekte: [{ ziel: 'legitimitaet', delta: -1 }],
        },
        {
          id: 'ereignis_b',
          bedingung: schuldenHoch,
          wahrscheinlichkeit: 1.0,
          effekte: [{ ziel: 'legitimitaet', delta: -2 }],
        },
      ];
      const links = eregistrierung(regeln, state());
      const rechts = eregistrierung(regeln, state());
      expect(links.ereignisse.map((e) => e.ereignis_id)).toEqual(
        rechts.ereignisse.map((e) => e.ereignis_id),
      );
      expect(links.rng.counter).toBe(rechts.rng.counter);
    });

    it('zwei Würfe verbrauchen den RNG-Counter um 2', () => {
      const p = schuldenVonSchema.parse({
        typ: 'schulden_von',
        regel_id: 'pr_schulden_immer',
        op: '>=',
        wert: 0,
      });
      const regelA: EreignisRegel = {
        id: 'ereignis_a',
        bedingung: p,
        wahrscheinlichkeit: 1.0,
        effekte: [],
      };
      const regelB: EreignisRegel = {
        id: 'ereignis_b',
        bedingung: p,
        wahrscheinlichkeit: 1.0,
        effekte: [],
      };
      const ergebnis = eregistrierung([regelA, regelB], state());
      expect(ergebnis.ereignisse).toHaveLength(2);
      expect(ergebnis.rng.counter).toBe(2);
    });
  });

  describe('OR-Bedingung in Ereignis-Regeln', () => {
    it('mindestens eine Bedingung erfüllt → Ereignis wird geprüft', () => {
      const regel: EreignisRegel = {
        id: 'krise_oder',
        bedingung: oderOder,
        wahrscheinlichkeit: 1.0,
        effekte: [{ ziel: 'legitimitaet', delta: -1 }],
      };
      const ergebnis = eregistrierung([regel], state());
      expect(ergebnis.ereignisse).toHaveLength(1);
      expect(ergebnis.ereignisse[0]!.ereignis_id).toBe('krise_oder');
    });

    it('keine Bedingung erfüllt → kein Ereignis', () => {
      const p = schuldenVonSchema.parse({
        typ: 'schulden_von',
        regel_id: 'pr_schulden_niemals',
        op: '>=',
        wert: 1000,
      });
      const regel: EreignisRegel = {
        id: 'krise_niemals',
        bedingung: p,
        wahrscheinlichkeit: 1.0,
        effekte: [],
      };
      const ergebnis = eregistrierung([regel], state());
      expect(ergebnis.ereignisse).toHaveLength(0);
    });
  });

  describe('Fehlerbehandlung (FR-002)', () => {
    it('kaputter Prädikat in Regel wirft mit Regel-Id', () => {
      const kaput = { typ: 'unbekannt', regel_id: 'kaputt' } as never;
      const regel: EreignisRegel = {
        id: 'kaputte_regel',
        bedingung: kaput,
        wahrscheinlichkeit: 1.0,
        effekte: [],
      };
      expect(() => eregistrierung([regel], state())).toThrow(/kaputt/);
    });

    it('kaputter Wahrscheinlichkeitswert wirft im Dev-Modus', () => {
      const regel: EreignisRegel = {
        id: 'kaputt_wahrscheinlichkeit',
        bedingung: schuldenHoch,
        wahrscheinlichkeit: Number.NaN,
        effekte: [],
      };
      expect(() => eregistrierung([regel], state(), 'dev')).toThrow(/wahrscheinlichkeit/);
    });

    it('kaputter Wahrscheinlichkeitswert wird im Produktionsmodus übersprungen', () => {
      const regel: EreignisRegel = {
        id: 'kaputt_wahrscheinlichkeit',
        bedingung: schuldenHoch,
        wahrscheinlichkeit: Number.NaN,
        effekte: [],
      };
      const ergebnis = eregistrierung([regel], state(), 'produktion');
      expect(ergebnis.ereignisse).toHaveLength(0);
    });

    it('leere Regeln-Liste → kein Ereignis, RNG unverändert', () => {
      const ergebnis = eregistrierung([], state());
      expect(ergebnis.ereignisse).toHaveLength(0);
      expect(ergebnis.rng.counter).toBe(0);
    });
  });
});
