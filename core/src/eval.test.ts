/** core/src/eval.test — typisierte Prädikate (US-M2-01, FR-027, ADR-004).
 *
 * Getestet wird die Bedingungs-Auswertung als typisierte Daten:
 *  - Indikator-Vergleich (alle 5 Operatoren, fehlender Indikator = 0)
 *  - Gruppen-Zufriedenheit (alle 5 Operatoren, fehlende Gruppe = false)
 *  - Schulden-Vergleich (alle 5 Operatoren)
 *  - OR-Liste (mindestens eines wahr, alle falsch → false, leere Liste → false)
 *  - Geschachtelte OR-Listen
 *  - Unbekannter Typ → TypeError mit Regel-Id
 *  - Determinismus (zwei Aufrufe mit gleichem Seed/State identisch)
 *  - Keine String-Expression möglich (nur typisierte Prädikate)
 */

import { describe, expect, it } from 'vitest';

import { evalPrädikat, praedikatSchema, karteErfuelltConstraints, karteImCooldown } from './eval.js';
import { erzeugeGameState, type GameState } from './state.js';
import { zufriedenheitBerechnen } from './zufriedenheit.js';

const basisState: GameState = erzeugeGameState({
  jahr: 1,
  indikatoren: {
    wirtschaft: 45,
    bildung: 40,
    gesundheit: 30,
    infrastruktur: 50,
    forschung: 20,
    recht: 40,
    freiheit: 40,
    sicherheit: 35,
  },
  gruppen: [
    { tag: 'arbeitnehmer', zufriedenheit: 48, bevölkerungsanteil: 50, gewichte: { wirtschaft: 1 } },
    { tag: 'unternehmen', zufriedenheit: 52, bevölkerungsanteil: 30, gewichte: { wirtschaft: 1 } },
    { tag: 'bildungs_gruppe', zufriedenheit: 40, bevölkerungsanteil: 20, gewichte: { bildung: 1 } },
  ],
  budget: {},
  politisches_kapital: 5,
  legitimitaet: 50,
  schulden: 40,
  radikalisierung: 10,
  rng: { seed: 424242, counter: 0 },
  konstitution: {},
  zufriedenheits_trace: {},
  beschlüsse: [],
});

const ctx = {
  modell: 'flat' as const,
  tabelle: {},
  konstitutions_modifikator: 0,
};

describe('eval — typisierte Prädikate (US-M2-01, FR-027, ADR-004)', () => {
  describe('indikator_von', () => {
    it('>=: wirtschaft 45 >= 45 ist wahr', () => {
      const p = praedikatSchema.parse({
        typ: 'indikator_von',
        regel_id: 'pr1',
        tag: 'wirtschaft',
        op: '>=',
        wert: 45,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(true);
    });

    it('>: wirtschaft 45 > 45 ist falsch', () => {
      const p = praedikatSchema.parse({
        typ: 'indikator_von',
        regel_id: 'pr2',
        tag: 'wirtschaft',
        op: '>',
        wert: 45,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(false);
    });

    it('<=: bildung 40 <= 40 ist wahr', () => {
      const p = praedikatSchema.parse({
        typ: 'indikator_von',
        regel_id: 'pr3',
        tag: 'bildung',
        op: '<=',
        wert: 40,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(true);
    });

    it('<: gesundheit 30 < 35 ist wahr', () => {
      const p = praedikatSchema.parse({
        typ: 'indikator_von',
        regel_id: 'pr4',
        tag: 'gesundheit',
        op: '<',
        wert: 35,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(true);
    });

    it('==: sicherheit 35 == 35 ist wahr', () => {
      const p = praedikatSchema.parse({
        typ: 'indikator_von',
        regel_id: 'pr5',
        tag: 'sicherheit',
        op: '==',
        wert: 35,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(true);
    });

    it('fehlender Indikator zählt als 0', () => {
      const p = praedikatSchema.parse({
        typ: 'indikator_von',
        regel_id: 'pr6',
        tag: 'nicht_existierend',
        op: '>',
        wert: 0,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(false);
    });
  });

  describe('gruppe_zufriedenheit', () => {
    it('>=: arbeitnehmer 48 >= 48 ist wahr', () => {
      const p = praedikatSchema.parse({
        typ: 'gruppe_zufriedenheit',
        regel_id: 'pr7',
        tag: 'arbeitnehmer',
        op: '>=',
        wert: 48,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(true);
    });

    it('<: arbeitnehmer-Zufriedenheit < berechneter Wert ist wahr', () => {
      const direkt = zufriedenheitBerechnen(basisState.gruppen[0]!, basisState.indikatoren, 0, 0);
      const p = praedikatSchema.parse({
        typ: 'gruppe_zufriedenheit',
        regel_id: 'pr8',
        tag: 'arbeitnehmer',
        op: '<',
        wert: direkt + 1,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(true);
    });

    it('fehlende Gruppe ist false', () => {
      const p = praedikatSchema.parse({
        typ: 'gruppe_zufriedenheit',
        regel_id: 'pr9',
        tag: 'nicht_existierende_gruppe',
        op: '>=',
        wert: 0,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(false);
    });
  });

  describe('schulden_von', () => {
    it('<=: schulden 40 <= 40 ist wahr', () => {
      const p = praedikatSchema.parse({
        typ: 'schulden_von',
        regel_id: 'pr10',
        op: '<=',
        wert: 40,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(true);
    });

    it('>: schulden 40 > 50 ist falsch', () => {
      const p = praedikatSchema.parse({
        typ: 'schulden_von',
        regel_id: 'pr11',
        op: '>',
        wert: 50,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(false);
    });

    it('==: schulden 40 == 40 ist wahr', () => {
      const p = praedikatSchema.parse({
        typ: 'schulden_von',
        regel_id: 'pr12',
        op: '==',
        wert: 40,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(true);
    });
  });

  describe('oder', () => {
    it('mindestens eines wahr → oder ist wahr', () => {
      const p = praedikatSchema.parse({
        typ: 'oder',
        regel_id: 'pr13',
        praedikate: [
          {
            typ: 'indikator_von',
            regel_id: 'pr13a',
            tag: 'wirtschaft',
            op: '>',
            wert: 100, // falsch (45 > 100)
          },
          {
            typ: 'schulden_von',
            regel_id: 'pr13b',
            op: '<=',
            wert: 40, // wahr (40 <= 40)
          },
        ],
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(true);
    });

    it('alle falsch → oder ist falsch', () => {
      const p = praedikatSchema.parse({
        typ: 'oder',
        regel_id: 'pr14',
        praedikate: [
          {
            typ: 'indikator_von',
            regel_id: 'pr14a',
            tag: 'wirtschaft',
            op: '>',
            wert: 100,
          },
          {
            typ: 'schulden_von',
            regel_id: 'pr14b',
            op: '<',
            wert: 10,
          },
        ],
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(false);
    });

    it('leere Liste → oder ist falsch', () => {
      const p = praedikatSchema.safeParse({
        typ: 'oder',
        regel_id: 'pr15',
        praedikate: [],
      });
      expect(p.success).toBe(false);
    });

    it('geschachtelte oder: inneres oder wahr → äußeres oder wahr', () => {
      const p = praedikatSchema.parse({
        typ: 'oder',
        regel_id: 'pr16',
        praedikate: [
          {
            typ: 'oder',
            regel_id: 'pr16a',
            praedikate: [
              {
                typ: 'indikator_von',
                regel_id: 'pr16b',
                tag: 'wirtschaft',
                op: '>',
                wert: 100,
              },
              {
                typ: 'indikator_von',
                regel_id: 'pr16c',
                tag: 'bildung',
                op: '>=',
                wert: 40,
              },
            ],
          },
          {
            typ: 'schulden_von',
            regel_id: 'pr16d',
            op: '<',
            wert: 10,
          },
        ],
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(true);
    });
  });

  describe('unbekannter Typ', () => {
    it('wirft TypeError mit Regel-Id', () => {
      const kaput = { typ: 'unbekannter_typ', regel_id: 'kaputt' } as never;
      expect(() => evalPrädikat(kaput, basisState, ctx)).toThrow(/unbekannter Variant-Typ/);
      expect(() => evalPrädikat(kaput, basisState, ctx)).toThrow(/kaputt/);
    });
  });

  describe('Determinismus', () => {
    it('zwei Aufrufe mit gleichem State sind identisch', () => {
      const p = praedikatSchema.parse({
        typ: 'oder',
        regel_id: 'pr17',
        praedikate: [
          {
            typ: 'indikator_von',
            regel_id: 'pr17a',
            tag: 'wirtschaft',
            op: '>=',
            wert: 45,
          },
          {
            typ: 'gruppe_zufriedenheit',
            regel_id: 'pr17b',
            tag: 'unternehmen',
            op: '<',
            wert: 60,
          },
        ],
      });
      const ergebnis1 = evalPrädikat(p, basisState, ctx);
      const ergebnis2 = evalPrädikat(p, basisState, ctx);
      expect(ergebnis1).toBe(ergebnis2);
      expect(ergebnis1).toBe(true);
    });
  });

  describe('Gruppen-Zufriedenheit nutzt dieselbe Formel wie der Tick', () => {
    it('zufriedenheitBerechnen und Prädikat liefern identische Werte', () => {
      const gruppe = basisState.gruppen[0]!;
      const direkt = zufriedenheitBerechnen(gruppe, basisState.indikatoren, 0, 0);
      const p = praedikatSchema.parse({
        typ: 'gruppe_zufriedenheit',
        regel_id: 'pr18',
        tag: 'arbeitnehmer',
        op: '==',
        wert: direkt,
      });
      expect(evalPrädikat(p, basisState, ctx)).toBe(true);
    });
  });

  describe('keine String-Expression möglich', () => {
    it('ein String als Prädikat wird vom Schema abgelehnt', () => {
      expect(() => praedikatSchema.parse('wirtschaft >= 45')).toThrow();
    });

    it('ein freier Operator wird abgelehnt', () => {
      expect(() =>
        praedikatSchema.parse({
          typ: 'indikator_von',
          regel_id: 'pr19',
          tag: 'wirtschaft',
          op: 'contains' as never,
          wert: 45,
        }),
      ).toThrow();
    });
  });
});

describe('karteErfuelltConstraints (US-M3-03, FR-032)', () => {
  interface TestEntscheidung {
    regel_id: string;
    label: string;
    beschreibung: string;
    cost: { budget: number; politisches_kapital: number };
    effects: { ziel: string; tag?: string; delta: number }[];
    constraints?: readonly {
      indikator?: { tag: string; min?: number; max?: number };
      regierungsform?: 'parlamentarisch' | 'praesidential' | 'diktatur';
    }[];
  }

  const entscheidungOhneConstraints: TestEntscheidung = {
    regel_id: 'entscheidung:ohne',
    label: 'Ohne Constraints',
    beschreibung: 'Keine Constraints',
    cost: { budget: 5, politisches_kapital: 0 },
    effects: [{ ziel: 'indikatoren', tag: 'wirtschaft', delta: 1 }],
  };

  const entscheidungMitRegierungsform: TestEntscheidung = {
    regel_id: 'entscheidung:regierungsform',
    label: 'Nur Parlamentarisch',
    beschreibung: 'Nur für parlamentarische Form',
    cost: { budget: 5, politisches_kapital: 0 },
    effects: [{ ziel: 'indikatoren', tag: 'wirtschaft', delta: 1 }],
    constraints: [{ regierungsform: 'parlamentarisch' }],
  };

  const entscheidungMitIndikatorMin: TestEntscheidung = {
    regel_id: 'entscheidung:indikatorMin',
    label: 'Wirtschaft >= 45',
    beschreibung: 'Nur wenn Wirtschaft >= 45',
    cost: { budget: 5, politisches_kapital: 0 },
    effects: [{ ziel: 'indikatoren', tag: 'wirtschaft', delta: 1 }],
    constraints: [{ indikator: { tag: 'wirtschaft', min: 45 } }],
  };

  const entscheidungMitIndikatorMax: TestEntscheidung = {
    regel_id: 'entscheidung:indikatorMax',
    label: 'Schulden < 50',
    beschreibung: 'Nur wenn Schulden < 50',
    cost: { budget: 5, politisches_kapital: 0 },
    effects: [{ ziel: 'indikatoren', tag: 'wirtschaft', delta: 1 }],
    constraints: [{ indikator: { tag: 'schulden', max: 50 } }],
  };

  const entscheidungMitBeiden: TestEntscheidung = {
    regel_id: 'entscheidung:beide',
    label: 'Beide Constraints',
    beschreibung: 'Parlamentarisch UND Wirtschaft >= 45',
    cost: { budget: 5, politisches_kapital: 0 },
    effects: [{ ziel: 'indikatoren', tag: 'wirtschaft', delta: 1 }],
    constraints: [
      { regierungsform: 'parlamentarisch' },
      { indikator: { tag: 'wirtschaft', min: 45 } },
    ],
  };

  const staatParlamentarisch = erzeugeGameState({
    ...basisState,
    setup: { regierungsform: 'parlamentarisch' },
  });

  const staatPraesidential = erzeugeGameState({
    ...basisState,
    setup: { regierungsform: 'praesidential' },
  });

  const staatWirtschaftNiedrig = erzeugeGameState({
    ...basisState,
    indikatoren: { ...basisState.indikatoren, wirtschaft: 30 },
  });

  const staatWirtschaftHoch = erzeugeGameState({
    ...basisState,
    indikatoren: { ...basisState.indikatoren, wirtschaft: 60 },
  });

  const staatSchuldenHoch = erzeugeGameState({
    ...basisState,
    schulden: 60,
  });

  const staatSchuldenNiedrig = erzeugeGameState({
    ...basisState,
    schulden: 30,
  });

  it('ohne Constraints → immer wahr', () => {
    expect(karteErfuelltConstraints(entscheidungOhneConstraints, staatParlamentarisch)).toBe(
      true,
    );
    expect(karteErfuelltConstraints(entscheidungOhneConstraints, staatPraesidential)).toBe(
      true,
    );
  });

  it('Regierungsform erfüllt → wahr', () => {
    expect(
      karteErfuelltConstraints(entscheidungMitRegierungsform, staatParlamentarisch),
    ).toBe(true);
  });

  it('Regierungsform verletzt → falsch', () => {
    expect(
      karteErfuelltConstraints(entscheidungMitRegierungsform, staatPraesidential),
    ).toBe(false);
  });

  it('Indikator min erfüllt → wahr', () => {
    expect(
      karteErfuelltConstraints(entscheidungMitIndikatorMin, staatWirtschaftHoch),
    ).toBe(true);
  });

  it('Indikator min verletzt → falsch', () => {
    expect(
      karteErfuelltConstraints(entscheidungMitIndikatorMin, staatWirtschaftNiedrig),
    ).toBe(false);
  });

  it('Indikator max erfüllt → wahr', () => {
    expect(
      karteErfuelltConstraints(entscheidungMitIndikatorMax, staatSchuldenNiedrig),
    ).toBe(true);
  });

  it('Indikator max verletzt → falsch', () => {
    expect(
      karteErfuelltConstraints(entscheidungMitIndikatorMax, staatSchuldenHoch),
    ).toBe(false);
  });

  it('beide Constraints erfüllt → wahr', () => {
    expect(
      karteErfuelltConstraints(entscheidungMitBeiden, staatParlamentarisch),
    ).toBe(true);
    expect(
      karteErfuelltConstraints(entscheidungMitBeiden, staatParlamentarisch),
    ).toBe(true);
    expect(
      karteErfuelltConstraints(entscheidungMitBeiden, staatParlamentarisch),
    ).toBe(true);
  });

  it('ein Constraint verletzt → falsch', () => {
    expect(
      karteErfuelltConstraints(entscheidungMitBeiden, staatPraesidential),
    ).toBe(false);
    expect(
      karteErfuelltConstraints(entscheidungMitBeiden, staatWirtschaftNiedrig),
    ).toBe(false);
  });
});

describe('karteImCooldown (US-M3-04, FR-030)', () => {
  const cooldowns: Record<string, number> = { 'karte:a': 5, 'karte:b': 3 };

  it('im Cooldown (aktuelles Jahr <= bisJahr) → true', () => {
    expect(karteImCooldown('karte:a', cooldowns, 5)).toBe(true);
    expect(karteImCooldown('karte:a', cooldowns, 3)).toBe(true);
    expect(karteImCooldown('karte:b', cooldowns, 3)).toBe(true);
  });

  it('außerhalb Cooldown (aktuelles Jahr > bisJahr) → false', () => {
    expect(karteImCooldown('karte:a', cooldowns, 6)).toBe(false);
    expect(karteImCooldown('karte:b', cooldowns, 4)).toBe(false);
    expect(karteImCooldown('karte:c', cooldowns, 1)).toBe(false); // nicht im Register
  });
});

describe('karteErfuelltConstraints mit Cooldown (US-M3-03/04, FR-032/030)', () => {
  const entscheidungMitCooldown = {
    regel_id: 'entscheidung:mitcooldown',
    label: 'Mit Cooldown',
    beschreibung: 'Nur wenn nicht im Cooldown',
    cost: { budget: 5, politisches_kapital: 0 },
    effects: [{ ziel: 'indikatoren', tag: 'wirtschaft', delta: 1 }],
    cooldown: 2,
  };

  const entscheidungOhneCooldown = {
    regel_id: 'entscheidung:ohnecooldown',
    label: 'Ohne Cooldown',
    beschreibung: 'Immer spielbar',
    cost: { budget: 5, politisches_kapital: 0 },
    effects: [{ ziel: 'indikatoren', tag: 'wirtschaft', delta: 1 }],
  };

  const cooldownsAktiv: Record<string, number> = { 'entscheidung:mitcooldown': 5 };
  const cooldownsAbgelaufen: Record<string, number> = { 'entscheidung:mitcooldown': 0 };

  const staatParlamentarisch = erzeugeGameState({
    ...basisState,
    setup: {
      regierungsform: 'parlamentarisch',
      konstitutions_ids: [],
    },
  });

  const staatPraesidential = erzeugeGameState({
    ...basisState,
    setup: {
      regierungsform: 'praesidential',
      konstitutions_ids: [],
    },
  });

  it('keine Cooldowns → Karte spielbar', () => {
    expect(
      karteErfuelltConstraints(entscheidungMitCooldown, staatParlamentarisch),
    ).toBe(true);
    expect(
      karteErfuelltConstraints(entscheidungMitCooldown, staatPraesidential),
    ).toBe(true); // keine Constraints auf der Entscheidung → spielbar
  });

  it('im Cooldown → Karte nicht spielbar', () => {
    expect(
      karteErfuelltConstraints(entscheidungMitCooldown, staatParlamentarisch, cooldownsAktiv),
    ).toBe(false);
  });

  it('außerhalb Cooldown → Karte spielbar', () => {
    expect(
      karteErfuelltConstraints(entscheidungMitCooldown, staatParlamentarisch, cooldownsAbgelaufen),
    ).toBe(true);
  });

  it('ohne Cooldown auf Karte → immer spielbar (außer andere Constraints)', () => {
    expect(
      karteErfuelltConstraints(entscheidungOhneCooldown, staatParlamentarisch, cooldownsAktiv),
    ).toBe(true);
    expect(
      karteErfuelltConstraints(entscheidungOhneCooldown, staatPraesidential, cooldownsAktiv),
    ).toBe(true); // keine Constraints auf der Entscheidung → spielbar
  });
});
