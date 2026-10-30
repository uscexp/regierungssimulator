/**
 * core/rules.test — die AC zu US-M1-01 (FR-034): die drei Setup-Typen mit ihren Pflichtfeldern und den
 * Pädu-Kanon-Feldnamen (§3b), gegen das Schema validiert. Getestet werden beide AC-Varianten: gültige
 * Instanzen werden akzeptiert, kapute werden mit dem Feldnamen abgelehnt. Das Schema prüft Struktur und
 * Grenzen — keine Balance-Werte (die stehen im Pack und in docs/balance-werte.md).
 */
import { describe, expect, it } from 'vitest';
import {
  konstitutionSchema,
  regelnNachTyp,
  regelNachId,
  regierungSchema,
  setupRegelSchema,
  validiereSetupRegeln,
  wahlregelImRegister,
  wahlregelSchema,
} from './rules.js';

const REGEL_ID = 'regel_basis';

/** Eine gültige Konstitutionsregel mit einer sofortigen und einer dauerhaften Wirkung (FR-017). */
const konstitution = {
  typ: 'constitution' as const,
  regel_id: REGEL_ID,
  label: 'Verfassung der Republik',
  entscheidungen: [
    {
      regel_id: 'entscheidung_presidency',
      label: 'Präsidentschaft einführen',
      beschreibung: 'Die Präsidentschaft wird eingeführt.',
      sofort_effekte: { arbeitnehmer: 6 },
      regelsatz_modifikator: {
        event_wahrscheinlichkeitfaktor: 1.2,
        gruppen_modifikatoren: { arbeitnehmer: 2 },
        steuermodell: 'progressiv' as const,
      },
    },
  ],
};

/** Eine gültige Regierungsregel je Form (FR-015) — Mechanik an die Form gebunden (Pädu-Kanon §3b). */
const regierungPraesidential = {
  typ: 'regierung' as const,
  regel_id: 'regel_regierung',
  form: 'praesidential' as const,
  amt: { modus: 'fixed_term' as const, jahre: 4 },
  machtverlust: 'wahl' as const,
};

/** Die drei Wahl-Mechaniken als Content-Datum (FR-013, ADR-011) mit den Kern-Feldnamen. */
const praesidentialwahl = {
  typ: 'praesidentialwahl' as const,
  regel_id: 'regel_wahl',
  intervall_jahre: 6,
  gewichtete_min: 47,
  schwächste_min: 35,
};
const parlamentmehrheit = {
  typ: 'parlamentmehrheit' as const,
  regel_id: 'regel_mehrheit',
  mehrheit: 0.5,
};
const putschRoll = {
  typ: 'putsch_roll' as const,
  regel_id: 'regel_putsch',
  elite_min: 40,
  militaer_min: 35,
  legitimitaet_min: 30,
  wahrscheinlichkeit: 0.3,
};

/** Ein gültiges Register: Regierung + Wahl-Machtcheck + Constitution. */
const register = [konstitution, regierungPraesidential, praesidentialwahl];

describe('Setup-Regel-Typen im Schema (FR-034)', () => {
  it('akzeptiert eine gültige Regierungsregel für jede der drei Formen', () => {
    expect(regierungSchema.safeParse(regierungPraesidential).success).toBe(true);
    expect(
      regierungSchema.safeParse({
        typ: 'regierung',
        regel_id: 'regel_regierung',
        form: 'parlamentarisch',
        amt: { modus: 'zyklisch', jahre: 5 },
        machtverlust: 'misstrauen',
      }).success,
    ).toBe(true);
    expect(
      regierungSchema.safeParse({
        typ: 'regierung',
        regel_id: 'regel_regierung',
        form: 'diktatur',
        amt: { modus: 'keins' },
        machtverlust: 'putsch',
      }).success,
    ).toBe(true);
  });

  it('lehnt den Amtsmodus-Widerspruch ab: "keins" mit Amts-Jahren, fixed_term ohne sie', () => {
    expect(
      regierungSchema.safeParse({
        ...regierungPraesidential,
        amt: { modus: 'keins', jahre: 4 },
      }).success,
    ).toBe(false);
    expect(
      regierungSchema.safeParse({
        typ: 'regierung',
        regel_id: 'r',
        form: 'praesidential',
        amt: { modus: 'fixed_term' },
        machtverlust: 'wahl',
      }).success,
    ).toBe(false);
  });

  it('lehnt eine Machtverlust-Mechanik ab, die nicht zur Form passt — der Grund nennt die Felder', () => {
    const fehler = regierungSchema.safeParse({ ...regierungPraesidential, form: 'diktatur' });
    expect(fehler.success).toBe(false);
    if (!fehler.success) {
      const grund = fehler.error.issues.map((i) => i.message).join(' · ');
      expect(grund).toContain('Form');
      expect(grund).toContain('wahl');
      expect(grund).toContain('putsch');
    }
  });

  it('akzeptiert eine gültige Konstitutionsregel und lehnt fehlende Pflichtfelder mit Feldnamen ab', () => {
    expect(konstitutionSchema.safeParse(konstitution).success).toBe(true);
    const kaput = {
      ...konstitution,
      entscheidungen: [
        {
          regel_id: 'e',
          label: '',
          beschreibung: 'x',
          sofort_effekte: { arbeitnehmer: 6 },
          regelsatz_modifikator: { event_wahrscheinlichkeitfaktor: 1 },
        },
      ],
    };
    const fehler = konstitutionSchema.safeParse(kaput);
    expect(fehler.success).toBe(false);
    if (!fehler.success)
      expect(fehler.error.issues.map((i) => i.path.join('.'))).toContain('entscheidungen.0.label');
    // Verdikt D21: der Modifikator ist Pflichtfeld — Konzept §3 verspricht jede Entscheidung mit
    // dauerhaftem Regelsatz-Modifikator (Balance-Guard, M1-Gate). Ohne Modifikator ist sie ungültig.
    const ohneModifikator = {
      ...konstitution,
      entscheidungen: [{ ...konstitution.entscheidungen[0], regelsatz_modifikator: undefined }],
    };
    const fehlend = konstitutionSchema.safeParse(ohneModifikator);
    expect(fehlend.success).toBe(false);
    if (!fehlend.success)
      expect(fehlend.error.issues.map((i) => i.path.join('.'))).toContain(
        'entscheidungen.0.regelsatz_modifikator',
      );
  });

  it('nimmt Sofort-Effekte als Record je Gruppe und begrenzt den Delta auf die Kern-Invariante', () => {
    expect(
      konstitutionSchema.safeParse({
        ...konstitution,
        entscheidungen: [
          {
            ...konstitution.entscheidungen[0],
            sofort_effekte: { arbeitnehmer: -100, eliten: 100 },
          },
        ],
      }).success,
    ).toBe(true);
    const uebergrenze = konstitutionSchema.safeParse({
      ...konstitution,
      entscheidungen: [
        { ...konstitution.entscheidungen[0], sofort_effekte: { arbeitnehmer: 200 } },
      ],
    });
    expect(uebergrenze.success).toBe(false);
    if (!uebergrenze.success)
      expect(uebergrenze.error.issues.map((i) => i.path.join('.'))).toContain(
        'entscheidungen.0.sofort_effekte.arbeitnehmer',
      );
    // Die alte Array-Form mit gruppe_tag/delta ist gegen den Record illegal — strict lehnt das Objekt.
    expect(
      konstitutionSchema.safeParse({
        ...konstitution,
        entscheidungen: [
          {
            ...konstitution.entscheidungen[0],
            sofort_effekte: [{ gruppe_tag: 'arbeitnehmer', delta: 6 }],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('verlangt vom Modifikator mindestens eine Änderung und nimmt das Steuermodell als Enum', () => {
    expect(
      konstitutionSchema.safeParse({
        ...konstitution,
        entscheidungen: [
          { ...konstitution.entscheidungen[0], regelsatz_modifikator: { steuermodell: 'hoch' } },
        ],
      }).success,
    ).toBe(true);
    const leer = konstitutionSchema.safeParse({
      ...konstitution,
      entscheidungen: [{ ...konstitution.entscheidungen[0], regelsatz_modifikator: {} }],
    });
    expect(leer.success).toBe(false);
    if (!leer.success)
      expect(leer.error.issues.map((i) => i.message).join(' · ')).toContain(
        'mindestens eine Änderung',
      );
    expect(
      konstitutionSchema.safeParse({
        ...konstitution,
        entscheidungen: [
          {
            ...konstitution.entscheidungen[0],
            regelsatz_modifikator: { steuermodell: 'autoritär' },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      konstitutionSchema.safeParse({
        ...konstitution,
        entscheidungen: [
          {
            ...konstitution.entscheidungen[0],
            regelsatz_modifikator: { event_wahrscheinlichkeitfaktor: -1 },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('die Entscheidungs-Ids bleiben ein Pattern-Feld, kein gepinntes enum im Kern-Schema', () => {
    // Eine neue Entscheidung mit neuer Id ist gültig — der Loader validiert Ids gegen das Register,
    // nicht gegen eine Kern-Liste (M4: Pack ohne Code).
    expect(
      konstitutionSchema.safeParse({
        ...konstitution,
        entscheidungen: [
          { ...konstitution.entscheidungen[0], regel_id: 'grundrechte' },
          { ...konstitution.entscheidungen[0], regel_id: 'weltlichkeit' },
        ],
      }).success,
    ).toBe(true);
    expect(
      konstitutionSchema.safeParse({
        ...konstitution,
        entscheidungen: [{ ...konstitution.entscheidungen[0], regel_id: 'Grundrechte' }],
      }).success,
    ).toBe(false);
  });

  it('lehnt eine unbekannte Konstitutions-Wirkung ab — das Schema hat keinen Interpreter', () => {
    expect(
      konstitutionSchema.safeParse({
        ...konstitution,
        entscheidungen: [{ ...konstitution.entscheidungen[0], sofort_bonus: 10 }],
      }).success,
    ).toBe(false);
  });

  it('akzeptiert jede der drei Wahl-Mechaniken als typisierten Variant', () => {
    expect(wahlregelSchema.safeParse(praesidentialwahl).success).toBe(true);
    expect(wahlregelSchema.safeParse(parlamentmehrheit).success).toBe(true);
    expect(wahlregelSchema.safeParse(putschRoll).success).toBe(true);
  });

  it('lehnt eine erfundene Wahl-Mechanik und ein illegitimes Feld ab', () => {
    expect(
      wahlregelSchema.safeParse({ typ: 'volksabstimmung', regel_id: 'r', mehrheit: 0.5 }).success,
    ).toBe(false);
    expect(wahlregelSchema.safeParse({ ...praesidentialwahl, term_jahre: 4 }).success).toBe(false);
    // Der Variant ist über `typ` discriminiert; eine unbekannte Mechanik zeigt im Grund den Feldnamen `typ`.
    const fehler = wahlregelSchema.safeParse({
      typ: 'volksabstimmung',
      regel_id: 'r',
      mehrheit: 0.5,
    });
    expect(fehler.success).toBe(false);
    if (!fehler.success) expect(fehler.error.issues.map((i) => i.path.join('.'))).toContain('typ');
    // Das illegitime Feld `term_jahre` (statt `intervall_jahre`) wird vom strict-Schema benannt.
    const illegal = wahlregelSchema.safeParse({ ...praesidentialwahl, term_jahre: 4 });
    expect(illegal.success).toBe(false);
    if (!illegal.success) expect(illegal.error.message).toContain('term_jahre');
  });

  it('begrenzt die Mehrheit auf den Spec-Bereich und die Putsch-Wahrscheinlichkeit auf 0–1', () => {
    expect(wahlregelSchema.safeParse({ ...parlamentmehrheit, mehrheit: 0.2 }).success).toBe(false);
    expect(wahlregelSchema.safeParse({ ...putschRoll, wahrscheinlichkeit: 1.4 }).success).toBe(
      false,
    );
    const fehler = wahlregelSchema.safeParse({ ...parlamentmehrheit, mehrheit: 1.5 });
    expect(fehler.success).toBe(false);
    if (!fehler.success)
      expect(fehler.error.issues.map((i) => i.path.join('.'))).toContain('mehrheit');
  });

  it('akzeptiert ein gültiges Register und lehnt ein Register ohne Wahl-Mechanik ab', () => {
    expect(validiereSetupRegeln(register, 'produktion').fehlerfrei).toBe(true);
    const ohneWahl = [konstitution, regierungPraesidential];
    const grund = validiereSetupRegeln(ohneWahl, 'produktion').grund;
    expect(validiereSetupRegeln(ohneWahl, 'produktion').fehlerfrei).toBe(false);
    expect(grund).toContain('regierung');
  });

  it('meldet im Register die Form-Mechanik-Bindung und den Amtsmodus-Widerspruch mit Feldnamen', () => {
    const widerstreit = validiereSetupRegeln(
      [{ ...regierungPraesidential, form: 'diktatur' }, praesidentialwahl],
      'produktion',
    );
    expect(widerstreit.fehlerfrei).toBe(false);
    expect(widerstreit.grund).toContain('regierung');
    expect(widerstreit.grund).toContain('wahl');
    const amtOhneJahre = validiereSetupRegeln(
      [{ ...regierungPraesidential, amt: { modus: 'fixed_term' } }, praesidentialwahl],
      'produktion',
    );
    expect(amtOhneJahre.fehlerfrei).toBe(false);
    expect(amtOhneJahre.grund).toContain('Amts-Jahre');
  });

  it('verlangt eindeutige Regel-Ids im Register', () => {
    expect(
      validiereSetupRegeln(
        [regierungPraesidential, { ...praesidentialwahl, regel_id: 'regel_regierung' }],
        'produktion',
      ).fehlerfrei,
    ).toBe(false);
  });

  it('lookup nach Typ und Id liefert die erwarteten Regeln', () => {
    expect(regelnNachTyp(register, 'constitution')).toHaveLength(1);
    expect(regelnNachTyp(register, 'praesidentialwahl')).toHaveLength(1);
    expect(regelnNachTyp(register, 'parlamentmehrheit')).toHaveLength(0);
    expect(regelNachId(register, 'regel_wahl')?.typ).toBe('praesidentialwahl');
    expect(regelNachId(register, 'regel_fehlt')).toBeUndefined();
    expect(wahlregelImRegister(register)?.regel_id).toBe('regel_wahl');
    expect(wahlregelImRegister([regierungPraesidential])).toBeUndefined();
  });

  it('gibt einen kaputen Regelsatz im Dev als Fehler mit Feldnamen, in Produktion läuft er weiter', () => {
    const kaput = [{ typ: 'regierung' }];
    expect(() => validiereSetupRegeln(kaput, 'dev')).toThrow(/form|amt|machtverlust|regel_id/);
    const ergebnis = validiereSetupRegeln(kaput, 'produktion');
    expect(ergebnis.fehlerfrei).toBe(false);
    expect(ergebnis.grund).toMatch(/form|amt|machtverlust|regel_id/);
  });

  it('nimmt ein unbekanntes Typ-Feld im Register als Schema-Fehler, nicht als Interpreter', () => {
    expect(setupRegelSchema.safeParse({ typ: 'karte', regel_id: 'r' }).success).toBe(false);
    expect(validiereSetupRegeln([{ typ: 'karte', regel_id: 'r' }], 'produktion').fehlerfrei).toBe(
      false,
    );
  });
});
