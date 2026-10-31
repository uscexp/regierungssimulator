/**
 * content/base — die Konstitutions-Instanzen (US-M1-04, FR-017).
 *
 * Daten, keine Mechanik: das Schema liegt im Kern (`@staatslenker/core/rules`, §3b/D20/D21), dieses
 * Modul liefert die Instanzen und validiert sie dagegen. Der Loader (M4) und der Setup-Adapter lesen
 * diese Werte; der Tick rechnet die Effekte, sobald M1-02/M1-03 gebaut sind.
 *
 * **Wertquellen** — jede Zahl hat eine Quelle, keine ist erfunden:
 * - Die Richtungen je Entscheidung kommen aus `docs/spielkonzept.md` §3 („Konstitution als zweiter
 *   Spielzug": +Freiheit, +Liberalen, −Konservative, −Skandal-Wahrscheinlichkeit, +Ordnung bei Krisen,
 *   −regionale Gruppen, steuerlast je Gruppe, Staatsreligion/Weltlichkeit als Gruppen-Modifikatoren).
 * - Die Größenordnung ist der §12-Anker aus `docs/balance-werte.md` §4: „Baseline ohne
 *   Konstitutions-Modifikatoren = 10; Konstitution moduliert ±8". Alle Sofort-Effekte und alle
 *   dauerhaften Gruppen-Modifikatoren liegen deshalb in −8…+8.
 * - Das Steuermodell bleibt `flat` (K2: „der M0-Balance-Anker bleibt fix flat" → Einnahmen 36 BE bei
 *   Wirtschaft 45, Unterhalt-Anker 17.19/21.19/27.19 BE).
 * - **M0-Messbasis bleibt gültig (Haui-Ruling):** Kein Sofort-Effekt und kein dauerhafter Modifikator
 *   toucht `unternehmen`, `arbeitnehmer` oder `bildung_jugend` — das sind die renormierten Tags der
 *   M0-Basis (Anteile 21.3/51.1/27.6, §4), deren Start-Ø gemessen 47.22 bzw. Fixture-Referenz 48.33 ist.
 *   Damit bleiben Replay-, Spread- und Kurven-Fixture bitgleich, sobald der Kern die Konstitution
 *   anwendet. Ein Test pinnt diese Grenze, damit sie nicht durch einen Content-Edit fällt.
 * - Legitimität und Entscheidungsgeschwindigkeit sind Indikatoren und Ressourcen (Politische Kosten,
 *   §5 PK), keine Gruppen — sie werden über die spätere Mechanik abgebildet (M1-02/M1-05), nicht als
 *   Gruppen-Delta. Die betroffenen Entscheidungen tragen deshalb nur die Gruppen-Anteilung der
 *   Konzept-Richtung und einen dokumentierten Hinweis.
 */
import {
  konstitutionSchema,
  validiereSetupRegeln,
  type KonstitutionsEntscheidung,
} from '@staatslenker/core/rules';
import type { SetupAktion, SetupPflicht } from '@staatslenker/core/setup';
import type { Konstitution } from '@staatslenker/core/state';
import { STEUERLAST } from './basis-pack.js';

/** Die vier Gruppen, die der M0-Basis-Pack nicht simuliert — hier dürfen Effekte stehen. */
const NICHT_M0_GRUPPEN = [
  'konservative',
  'liberale_minderheiten',
  'staatsapparat',
  'landwirte',
] as const;

/** Die Entscheidungstexte sind M5-Karten- und News-Referenz (D21: `beschreibung` ist Pflichtfeld). */
const entscheidungen: readonly KonstitutionsEntscheidung[] = [
  {
    regel_id: 'grundrechte',
    label: 'Grundrechte garantieren',
    beschreibung:
      'Grundrechte sichern Freiheit und Recht: Liberale und Minderheiten gewinnen, Konservative verlieren, der Staatsapparat kann weniger durchgreifen. Die Krisenantwort wird flexibler, aber weniger kontrollierbar.',
    sofort_effekte: { liberale_minderheiten: 6, konservative: -4, staatsapparat: -2 },
    regelsatz_modifikator: {
      gruppen_modifikatoren: { liberale_minderheiten: 4, konservative: -3 },
    },
  },
  {
    regel_id: 'gewaltenteilung',
    label: 'Gewaltenteilung einführen',
    beschreibung:
      'Gewaltenteilung erhöht die Legitimität und verlangsamt Entscheidungen (mehr politische Kosten). Die Stabilisierung wirkt auf den Staatsapparat und die Landwirte; Legitimität und Politische Kosten sind Indikator und Ressource und werden über die Mechanik abgebildet (M1-02/M1-05).',
    sofort_effekte: { staatsapparat: 3, konservative: 2, liberale_minderheiten: 2 },
    regelsatz_modifikator: {
      gruppen_modifikatoren: { staatsapparat: 3, landwirte: 1 },
    },
  },
  {
    regel_id: 'wahlrecht',
    label: 'Allgemeines Wahlrecht',
    beschreibung:
      'Allgemeines Wahlrecht (inkl. Frauenwahlrecht und Pflichtwahl) erhöht die Legitimität und setzt die Wahl-Mechanik. Liberale und Landwirte gewinnen, der Staatsapparat verliert Einfluss.',
    sofort_effekte: { liberale_minderheiten: 3, landwirte: 2, staatsapparat: -2 },
    regelsatz_modifikator: {
      gruppen_modifikatoren: { liberale_minderheiten: 3, landwirte: 2 },
    },
  },
  {
    regel_id: 'pressefreiheit',
    label: 'Pressefreiheit zulassen',
    beschreibung:
      'Pressefreiheit senkt die Skandal-Wahrscheinlichkeit (kein Zensur-Druck, geringeres Putsch-Risiko durch verdeckte Skandale) und stärkt die Liberalen; Konservative verlieren.',
    sofort_effekte: { liberale_minderheiten: 4, konservative: -3 },
    /** Richtung aus spielkonzept §3: "-Skandal-Wahrscheinlichkeit" — als Event-Faktor < 1. */
    regelsatz_modifikator: { event_wahrscheinlichkeitfaktor: 0.8 },
  },
  {
    regel_id: 'zentralisierung',
    label: 'Zentralstaat gründen',
    beschreibung:
      'Zentralisierung bringt Ordnung bei Krisen (weniger Ereignis-Rolls) und kostet die regionalen Gruppen: Landwirte verlieren, der Staatsapparat gewinnt.',
    sofort_effekte: { staatsapparat: 4, landwirte: -4 },
    /** Richtung aus spielkonzept §3: "+Ordnung bei Krisen" — als Event-Faktor < 1. */
    regelsatz_modifikator: { event_wahrscheinlichkeitfaktor: 0.9 },
  },
  {
    regel_id: 'steuermodell',
    label: 'Steuermodell festlegen',
    beschreibung:
      'Das Steuermodell wird über die Konstitution gewählt und bleibt in M0 auf `flat` (K2, balance-werte §1: Faktor 0.8 → 36 BE Einnahmen bei Wirtschaft 45). Die Steuerlast je Gruppe ist bereits in balance-werte §3 als direkter Zufriedenheits-Abzug gerechnet, deshalb erzeugt diese Entscheidung keinen zusätzlichen Gruppen-Delta.',
    sofort_effekte: {},
    regelsatz_modifikator: { steuermodell: 'flat' },
  },
  {
    regel_id: 'staatsreligion',
    label: 'Staatsreligion festlegen',
    beschreibung:
      'Eine Staatsreligion stärkt die Konservativen und drückt die Liberalen und Minderheiten; die Wirkung bleibt als dauerhafter Gruppen-Modifikator erhalten.',
    sofort_effekte: { konservative: 4, liberale_minderheiten: -4 },
    regelsatz_modifikator: {
      gruppen_modifikatoren: { konservative: 4, liberale_minderheiten: -4 },
    },
  },
  {
    regel_id: 'weltlichkeit',
    label: 'Weltlichkeit des Staates',
    beschreibung:
      'Weltlichkeit stärkt die Liberalen und Minderheiten und drückt die Konservativen; die Wirkung bleibt als dauerhafter Gruppen-Modifikator erhalten.',
    sofort_effekte: { liberale_minderheiten: 4, konservative: -4 },
    regelsatz_modifikator: {
      gruppen_modifikatoren: { liberale_minderheiten: 4, konservative: -4 },
    },
  },
];

/** Die Basis-Konstitution als Instanz gegen das Kern-Schema (FR-017, D21). */
export const basisKonstitution = {
  typ: 'constitution' as const,
  regel_id: 'konstitution_basis',
  label: 'Verfassung der Republik',
  entscheidungen,
};

/** Validierung gegen das Kern-Schema — dieselbe Konvention wie der Pack (FR-002: dev wirft, Produktion läuft weiter). */
export function validiereBasisKonstitution(
  modus: 'dev' | 'produktion' = 'dev',
  instantanz: unknown = basisKonstitution,
): {
  readonly fehlerfrei: boolean;
  readonly grund: string;
} {
  const ergebnis = konstitutionSchema.safeParse(instantanz);
  if (ergebnis.success)
    return { fehlerfrei: true, grund: 'basis-konstitution validiert fehlerfrei' };
  const grund = ergebnis.error.issues
    .map((issue) => `${issue.path.join('.') || '(konstitution)'}: ${issue.message}`)
    .join(' · ');
  if (modus === 'dev') throw new TypeError(`Basis-Konstitution invalid: ${grund}`);
  return { fehlerfrei: false, grund };
}

/**
 * Der volle Setup-Regelsatz: Konstitution + Regierung + Wahl-Machtcheck. Die Regierung und die Wahlregel
 * sind die D18-Werte aus dem M0-Content (Zyklus 6, Ø 47, schwächste 35, §3b-Feldnamen) — die
 * Regierungsform ist praesidential, weil der M0-Loop über den Wahl-Gate endet (D18/D19). Die
 * Regierungsformen mit der `regierung`-Bindung und die weiteren Varianten sind US-M1-05/US-M1-03.
 */
export const basisSetupRegeln = [
  basisKonstitution,
  {
    typ: 'regierung' as const,
    regel_id: 'regierung_basis',
    form: 'praesidential' as const,
    amt: { modus: 'fixed_term' as const, jahre: 6 },
    machtverlust: 'wahl' as const,
  },
  {
    typ: 'praesidentialwahl' as const,
    regel_id: 'wahl_basis',
    /** D18: Wahlzyklus 6 Jahre, Jahr 4 ist kein Wahljahr. */
    intervall_jahre: 6,
    /** D18: gewichtete Ø ≥ 47 und schwächste Gruppe ≥ 35. */
    gewichtete_min: 47,
    schwächste_min: 35,
  },
];

/** Validierung des Setup-Regelsatzes gegen das Kern-Register (zwei Stufen, Feldnamen im Grund). */
export function validiereBasisSetup(
  modus: 'dev' | 'produktion' = 'dev',
  instantanz: unknown = basisSetupRegeln,
): {
  readonly fehlerfrei: boolean;
  readonly grund: string;
} {
  return validiereSetupRegeln(instantanz, modus);
}

/** Die Gruppen, die ein Konstitutions-Effekt berühren darf (M0-Messbasis-Guard). */
export const EFFEKT_GRUPPEN_NICH_M0 = NICHT_M0_GRUPPEN;

/**
 * Die Werte der Konstitution als `regel_id → Wert` (US-M1-02/D22): die Steuermodell-Entscheidung setzt
 * das Modell (flat, K2), alle anderen Entscheidungen sind gesetzt. Der Tick liest daraus in M0 nur das
 * Steuermodell — die Sofort-Effekte und Dauer-Modifikatoren angewendet erst US-M1-05/US-M1-06.
 */
export const KONSTITUTION_WERTE: Konstitution = Object.freeze(
  Object.fromEntries(
    basisKonstitution.entscheidungen.map((e) => [
      e.regel_id,
      e.regelsatz_modifikator.steuermodell ?? true,
    ]),
  ),
);

/** Die Setup-Pflicht des Registers (D22): der Wert kommt aus dem geladenen Register, nicht aus einem Adapter. */
export const SETUP_PFLICHT: SetupPflicht = Object.freeze({
  konstitutions_ids: Object.freeze(basisKonstitution.entscheidungen.map((e) => e.regel_id)),
  /** Die Entscheidungs-Instanzen desselben Registers (US-M1-05): daraus liest der Kern die Sofort-Effekte. */
  entscheidungen: Object.freeze(basisKonstitution.entscheidungen),
  /** Dieselbe Steuerlast-Tabelle wie im Tick (US-M1-05): nur damit die Formel am Setup gerechnet wird. */
  steuerlast: STEUERLAST,
});

/** Die im Basis-Register verfügbaren Regierungsformen — US-M1-03 liefert die weiteren Formen. */
export const SETUP_FORMEN = Object.freeze(
  basisSetupRegeln.filter((r) => r.typ === 'regierung').map((r) => r.form),
);

/** Der Standard-Setup des non-interaktiven Boots: praesidential + alle 8 Entscheidungen (K2: flat). */
export const STANDARD_SETUP: SetupAktion = Object.freeze({
  regierungsform: 'praesidential',
  konstitutions_ids: Object.freeze(basisKonstitution.entscheidungen.map((e) => e.regel_id)),
  konstitution: KONSTITUTION_WERTE,
});
