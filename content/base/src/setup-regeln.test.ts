/**
 * content/base/setup-regeln.test — die AC zu US-M1-04 (FR-017): die 8 Konstitutions-Entscheidungen als
 * Instanzen gegen das Kern-Schema. Getestet wird die Struktur (Schema), die Wertgrenzen (§12-Anker),
 * die Quellen-Zuordnung und der Guard, der die M0-Messbasis schützt (Haui-Ruling: die gemessene Basis
 * darf durch Konstitutions-Werte nicht verschoben werden).
 */
import { describe, expect, it } from 'vitest';
import { konstitutionSchema } from '@staatslenker/core/rules';
import {
  basisKonstitution,
  basisSetupRegeln,
  validiereBasisKonstitution,
  validiereBasisSetup,
} from './setup-regeln.js';

/** Die renormierten Gruppen-Tags der M0-Basis (§4, Anteile 21.3/51.1/27.6) — ihre Effekte sind gemessen. */
const M0_BASIS_TAGS = ['unternehmen', 'arbeitnehmer', 'bildung_jugend'];

/** Die 8 Ids aus spielkonzept §3 / spezifikation US-M1-04. */
const ERWARTETE_IDS = [
  'grundrechte',
  'gewaltenteilung',
  'wahlrecht',
  'pressefreiheit',
  'zentralisierung',
  'steuermodell',
  'staatsreligion',
  'weltlichkeit',
];

describe('Konstitutions-Instanzen gegen das Kern-Schema (US-M1-04)', () => {
  it('validiert die Basis-Konstitution gegen das Kern-Schema', () => {
    expect(konstitutionSchema.safeParse(basisKonstitution).success).toBe(true);
    expect(validiereBasisKonstitution('produktion').fehlerfrei).toBe(true);
    expect(validiereBasisKonstitution('dev').fehlerfrei).toBe(true);
  });

  it('enthält genau die acht Konstitutions-Entscheidungen mit eindeutigen Ids', () => {
    expect(basisKonstitution.entscheidungen.map((e) => e.regel_id)).toEqual(ERWARTETE_IDS);
    expect(new Set(basisKonstitution.entscheidungen.map((e) => e.regel_id)).size).toBe(8);
  });

  it('jede Entscheidung hat Label, Beschreibung und einen Dauer-Modifikator mit mindestens einer Änderung', () => {
    for (const entscheidung of basisKonstitution.entscheidungen) {
      expect(entscheidung.label.length).toBeGreaterThan(0);
      expect(entscheidung.beschreibung.length).toBeGreaterThan(0);
      const modifikator = entscheidung.regelsatz_modifikator;
      const änderungen = [
        modifikator.event_wahrscheinlichkeitfaktor !== undefined,
        modifikator.gruppen_modifikatoren !== undefined,
        modifikator.steuermodell !== undefined,
      ].filter(Boolean).length;
      expect(änderungen).toBeGreaterThanOrEqual(1);
    }
  });

  it('alle Effekte und Modifikatoren bleiben im §12-Band ±8 (balance-werte §4)', () => {
    for (const entscheidung of basisKonstitution.entscheidungen) {
      for (const delta of Object.values(entscheidung.sofort_effekte)) {
        expect(delta).toBeGreaterThanOrEqual(-8);
        expect(delta).toBeLessThanOrEqual(8);
      }
      for (const modifikator of Object.values(
        entscheidung.regelsatz_modifikator.gruppen_modifikatoren ?? {},
      )) {
        expect(modifikator).toBeGreaterThanOrEqual(-8);
        expect(modifikator).toBeLessThanOrEqual(8);
      }
    }
  });

  it('kein Effekt und kein Modifikator toucht die M0-Basis-Tags — die Messbasis bleibt bitgleich', () => {
    for (const entscheidung of basisKonstitution.entscheidungen) {
      for (const tag of M0_BASIS_TAGS) {
        const sofortEffekte = entscheidung.sofort_effekte as Record<string, number | undefined>;
        const dauerModifikator = entscheidung.regelsatz_modifikator.gruppen_modifikatoren as
          Record<string, number | undefined> | undefined;
        expect(sofortEffekte[tag]).toBeUndefined();
        expect(dauerModifikator?.[tag]).toBeUndefined();
      }
    }
  });

  it('das Steuermodell bleibt flat (K2) und die Event-Faktoren folgen den Richtungen aus spielkonzept §3', () => {
    const steuer = basisKonstitution.entscheidungen.find((e) => e.regel_id === 'steuermodell');
    expect(steuer?.regelsatz_modifikator.steuermodell).toBe('flat');
    // Kein Sofort-Effekt ist hier korrekt: die Steuerlast je Gruppe ist in balance-werte §3 schon als
    // Zufriedenheits-Abzug gerechnet — ein zusätzlicher Delta wäre eine doppelte Anwendung.
    expect(steuer?.sofort_effekte).toEqual({});
    const presse = basisKonstitution.entscheidungen.find((e) => e.regel_id === 'pressefreiheit');
    const zentral = basisKonstitution.entscheidungen.find((e) => e.regel_id === 'zentralisierung');
    expect(presse?.regelsatz_modifikator.event_wahrscheinlichkeitfaktor).toBeLessThan(1);
    expect(zentral?.regelsatz_modifikator.event_wahrscheinlichkeitfaktor).toBeLessThan(1);
    expect(presse?.regelsatz_modifikator.event_wahrscheinlichkeitfaktor).toBeGreaterThan(0);
    expect(zentral?.regelsatz_modifikator.event_wahrscheinlichkeitfaktor).toBeGreaterThan(0);
  });

  it('ein kaputer Konstitutions-Wert wird im Dev mit Feldnamen geworfen, in Produktion läuft er weiter', () => {
    const kaput = {
      ...basisKonstitution,
      entscheidungen: [
        { ...basisKonstitution.entscheidungen[0], beschreibung: undefined },
        { ...basisKonstitution.entscheidungen[1], sofort_effekte: { liberale_minderheiten: 40 } },
      ],
    };
    expect(() => validiereBasisKonstitution('dev', kaput)).toThrow(/beschreibung|sofort_effekte/);
    expect(validiereBasisKonstitution('produktion', kaput).fehlerfrei).toBe(false);
    expect(validiereBasisKonstitution('produktion', kaput).grund).toMatch(
      /beschreibung|sofort_effekte/,
    );
  });

  it('der Setup-Regelsatz validiert gegen das Kern-Register mit den D18-Werten', () => {
    expect(validiereBasisSetup('produktion').fehlerfrei).toBe(true);
    const wahl = basisSetupRegeln.find((r) => r.typ === 'praesidentialwahl');
    expect(wahl?.intervall_jahre).toBe(6);
    expect(wahl?.gewichtete_min).toBe(47);
    expect(wahl?.schwächste_min).toBe(35);
    const regierung = basisSetupRegeln.find((r) => r.typ === 'regierung');
    expect(regierung?.form).toBe('praesidential');
    expect(regierung?.machtverlust).toBe('wahl');
  });

  it('ein kaputer Setup-Regelsatz wird im Register mit Feldnamen abgelehnt', () => {
    const kaput: unknown = [
      basisKonstitution,
      {
        typ: 'regierung',
        regel_id: 'regierung_basis',
        form: 'diktatur',
        amt: { modus: 'fixed_term', jahre: 6 },
        machtverlust: 'wahl',
      },
      basisSetupRegeln[2],
    ];
    expect(validiereBasisSetup('produktion', kaput).fehlerfrei).toBe(false);
    expect(validiereBasisSetup('produktion', kaput).grund).toContain('regierung');
    expect(() => validiereBasisSetup('dev', kaput)).toThrow(/regierung|wahl|machtverlust/);
  });
});
