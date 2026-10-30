/**
 * Tests für die Setup-Regel-Typen (US-M1-01, AC: „gültige Instanzen werden akzeptiert; fehlende
 * Pflichtfelder werden mit Feldnamen abgelehnt"). Die Feldnamen sind die Erwartung — ein Fehler ohne
 * Pfad wäre eine Ausgabe, die ein Modder nicht bedienen kann (ADR-003).
 */
import { describe, expect, it } from 'vitest';

import {
  konstitutionSchema,
  regierungSchema,
  setupRegelnSchema,
  setupRegelSchema,
  validiereSetupRegeln,
  wahlregelSchema,
} from '@staatslenker/content-base';

/** Ein gültiges Setup-Register: eine Regel je Typ (FR-015, FR-017, ADR-011). */
const gültigeRegeln = [
  {
    type: 'regierung',
    regel_id: 'regierung_m0',
    form: 'praesidential',
    amt: { modus: 'fixed_term', jahre: 6 },
    machtverlust: 'wahl',
  },
  {
    type: 'wahlregel',
    regel_id: 'wahlregel_m0',
    mechanik: {
      mechanik: 'praesidentialwahl',
      term_jahre: 6,
      gewichtete_min: 47,
      schwächste_min: 35,
    },
  },
  {
    type: 'constitution',
    regel_id: 'konstitution_m0',
    label: 'Verfassung',
    entscheidungen: [
      {
        regel_id: 'grundrechte_ja',
        label: 'Grundrechte',
        beschreibung: 'Grundrechte werden garantiert',
        sofort_effekte: [{ gruppe_tag: 'lehrer', delta: 4 }],
        regelsatz_modifikator: {
          event_wahrscheinlichkeitfaktor: 0.8,
          gruppen_modifikatoren: { lehrer: 2 },
        },
      },
    ],
  },
];

describe('Setup-Regel-Typen (US-M1-01)', () => {
  it('ein gültiges Register mit allen drei Typen validiert fehlerfrei', () => {
    expect(validiereSetupRegeln(gültigeRegeln)).toEqual({
      fehlerfrei: true,
      grund: 'setup-regeln validieren fehlerfrei',
    });
    expect(setupRegelnSchema.safeParse(gültigeRegeln).success).toBe(true);
  });

  it('jede Variante der Wahl-Mechanik wird akzeptiert (ADR-011 closed Variant-Set)', () => {
    const varianten = [
      { mechanik: 'praesidentialwahl', term_jahre: 5, gewichtete_min: 47, schwächste_min: 35 },
      { mechanik: 'parlamentmehrheit', mehrheit: 0.5, schwächste_min: 35 },
      { mechanik: 'putsch_roll', elite_min: 25, militär_min: 30, legitimität_min: 20 },
    ];
    for (const mechanik of varianten) {
      expect(
        wahlregelSchema.safeParse({ type: 'wahlregel', regel_id: 'wahlregel_m1', mechanik })
          .success,
      ).toBe(true);
    }
  });

  it('jede Regierungsform mit ihrer Machtverlust-Mechanik wird akzeptiert (FR-015)', () => {
    const forms = [
      { form: 'praesidential', machtverlust: 'wahl', amt: { modus: 'fixed_term', jahre: 6 } },
      { form: 'parlamentarisch', machtverlust: 'misstrauen', amt: { modus: 'zyklisch', jahre: 4 } },
      { form: 'diktatur', machtverlust: 'putsch', amt: { modus: 'keins' } },
    ];
    for (const f of forms) {
      expect(
        regierungSchema.safeParse({ type: 'regierung', regel_id: 'regierung_m1', ...f }).success,
      ).toBe(true);
    }
  });

  it('fehlende Pflichtfelder werden mit dem Feldnamen abgelehnt (AC US-M1-01)', () => {
    const felder: Array<[string, unknown]> = [
      [
        'form',
        { type: 'regierung', regel_id: 'r1', amt: { modus: 'keins' }, machtverlust: 'wahl' },
      ],
      ['amt', { type: 'regierung', regel_id: 'r1', form: 'diktatur', machtverlust: 'putsch' }],
      [
        'machtverlust',
        { type: 'regierung', regel_id: 'r1', form: 'diktatur', amt: { modus: 'keins' } },
      ],
      ['mechanik', { type: 'wahlregel', regel_id: 'r1' }],
      ['entscheidungen', { type: 'constitution', regel_id: 'r1', label: 'V' }],
      ['label', { type: 'constitution', regel_id: 'r1', entscheidungen: [] }],
    ];
    for (const [feld, kaputt] of felder) {
      const ergebnis = validiereSetupRegeln([kaputt], 'produktion');
      expect(ergebnis.fehlerfrei).toBe(false);
      expect(ergebnis.grund).toContain(feld);
    }
  });

  it('ein unbekannter Regel-Typ wird abgelehnt, mit type im Pfad (FR-034)', () => {
    const ergebnis = validiereSetupRegeln(
      [{ type: 'decision', regel_id: 'r1', label: 'x', beschreibung: 'y' }],
      'produktion',
    );
    expect(ergebnis.fehlerfrei).toBe(false);
    expect(ergebnis.grund).toContain('type');
  });

  it('eine unbekannte Wahl-Mechanik wird abgelehnt — neue Mechanik ist ein neuer Variant (ADR-004)', () => {
    const ergebnis = validiereSetupRegeln(
      [
        {
          type: 'wahlregel',
          regel_id: 'r1',
          mechanik: { mechanik: 'volksabstimmung', mehrheit: 0.5 },
        },
      ],
      'produktion',
    );
    expect(ergebnis.fehlerfrei).toBe(false);
    expect(ergebnis.grund).toContain('mechanik');
  });

  it('Mechanik-Widerspruch, Amts-Jahre-Widerspruch und Grenzen werden abgelehnt', () => {
    const kaput = [
      {
        type: 'regierung',
        regel_id: 'r1',
        form: 'diktatur',
        amt: { modus: 'keins' },
        machtverlust: 'wahl',
      },
      {
        type: 'regierung',
        regel_id: 'r2',
        form: 'praesidential',
        amt: { modus: 'keins', jahre: 6 },
        machtverlust: 'wahl',
      },
      {
        type: 'regierung',
        regel_id: 'r3',
        form: 'praesidential',
        amt: { modus: 'fixed_term' },
        machtverlust: 'wahl',
      },
      {
        type: 'wahlregel',
        regel_id: 'r4',
        mechanik: { mechanik: 'parlamentmehrheit', mehrheit: 0.4, schwächste_min: 35 },
      },
      {
        type: 'wahlregel',
        regel_id: 'r5',
        mechanik: {
          mechanik: 'praesidentialwahl',
          term_jahre: 0.5,
          gewichtete_min: 47,
          schwächste_min: 35,
        },
      },
      {
        type: 'constitution',
        regel_id: 'r6',
        label: 'V',
        entscheidungen: [
          {
            regel_id: 'e1',
            label: 'E',
            beschreibung: 'E',
            sofort_effekte: [{ gruppe_tag: 'lehrer', delta: 101 }],
            regelsatz_modifikator: {
              event_wahrscheinlichkeitfaktor: -1,
              gruppen_modifikatoren: {},
            },
          },
        ],
      },
    ];
    const ergebnis = validiereSetupRegeln(kaput, 'produktion');
    expect(ergebnis.fehlerfrei).toBe(false);
    expect(ergebnis.grund).toContain('Machtverlust-Mechanik muss zur Form passen');
    expect(ergebnis.grund).toContain('Amtsmodus');
    expect(ergebnis.grund).toContain('mehrheit');
    expect(ergebnis.grund).toContain('term_jahre');
    expect(ergebnis.grund).toContain('delta');
    expect(ergebnis.grund).toContain('event_wahrscheinlichkeitfaktor');
  });

  it('duplizierte Ids und ein Register ohne Wahlregel werden abgelehnt', () => {
    const duplikat = gültigeRegeln.map((r) => ({ ...r, regel_id: 'doppel' }));
    expect(validiereSetupRegeln(duplikat, 'produktion').grund).toContain('eindeutig');
    const ohneWahl = gültigeRegeln.filter((r) => r.type !== 'wahlregel');
    expect(validiereSetupRegeln(ohneWahl, 'produktion').grund).toContain('wahlregel');
    expect(setupRegelnSchema.safeParse([]).success).toBe(false);
  });

  it('dev wirft mit dem Grund, produktion läuft weiter (ADR-003, FR-002)', () => {
    expect(() => validiereSetupRegeln([{ type: 'regierung', regel_id: 'r1' }], 'dev')).toThrow(
      /Setup-Regeln invalid/,
    );
    const ergebnis = validiereSetupRegeln([{ type: 'regierung', regel_id: 'r1' }], 'produktion');
    expect(ergebnis.fehlerfrei).toBe(false);
    expect(ergebnis.grund).toContain('form');
  });

  it('die Einzel-Schemas akzeptieren ihre gültige Instanz und lehnen leere Arrays ab', () => {
    expect(setupRegelSchema.safeParse(gültigeRegeln[1]).success).toBe(true);
    expect(
      konstitutionSchema.safeParse({
        type: 'constitution',
        regel_id: 'r1',
        label: 'V',
        entscheidungen: [],
      }).success,
    ).toBe(false);
  });
});
