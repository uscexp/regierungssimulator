/**
 * @staatslenker/content-base — der M0-Basis-Content als TS-Objekte (US-M0-13).
 *
 * Alle Werte sind ausschließlich aus docs/balance-werte.md abgeleitet: §1 (Einnahmen/Start/K2),
 * §2 (Indikator-Regeln), §3 (Gruppenanteile/Gewichte/Steuerlast), §5 (PK), §7 (Radikalisierung-Start),
 * §9 (Schwierigkeits-Packs). Erfundene Werte gibt es hier nicht; wo eine Zahl nur im Repo-Fixture
 * steht (PK-Start 5, Legitimität-Start 50), ist die Quelle als Fixture-Kommentar markiert.
 *
 * Forschung `diminishing_wirkung` = 0.20/BE über 85: der von Ralf autorisierte finale Wert
 * (PO D13, dokumentiert in core/src/indikatoren.test.ts und docs/handoff-backlog.md); die
 * §2-Tabelle nennt nur die Schwelle 85. Mit 0.20/BE ist der Anker 27.19 BE Unterhalt über 85
 * konsistent (17.19 + 2/0.2).
 *
 * Der Content ist Daten, kein Code-Zweig: der Kern kennt die Struktur als Typ, dieses Modul liefert
 * die Zahlen und validiert sie gegen das Zod-Schema (ADR-003). Ein Adapter (cli) baut daraus den
 * Regelsatz für den Tick.
 */
import type { SteuerfaktorTabelle } from '@staatslenker/core/budget';
import type { IndikatorRegel, SchwierigkeitsPack } from '@staatslenker/core/indikatoren';
import type { Effekt, GruppenSnapshot } from '@staatslenker/core/state';
import type { Entscheidungskarte } from '@staatslenker/core/entscheidung';
import type { EreignisRegel } from '@staatslenker/core/ereignisse';
import type { TickKarte } from '@staatslenker/core/tick';
import type { SteuerlastTabelle } from '@staatslenker/core/zufriedenheit';
import { basisPackSchema, validierePack } from './schema.js';

/** §2 — Indikator-Regeln (Schwierigkeit normal; der Verschleiß-Multiplikator kommt aus dem Pack). */
export const INDIKATOR_REGELN: readonly IndikatorRegel[] = Object.freeze([
  Object.freeze({
    regel_id: 'regel:infrastruktur',
    tag: 'infrastruktur',
    verschleiß: 3,
    budget_wirkung: 0.5,
    diminishing_at: 70,
    diminishing_wirkung: 0.2,
  }),
  Object.freeze({
    regel_id: 'regel:bildung',
    tag: 'bildung',
    verschleiß: 2,
    budget_wirkung: 0.6,
    diminishing_at: 65,
    diminishing_wirkung: 0.25,
  }),
  Object.freeze({
    regel_id: 'regel:gesundheit',
    tag: 'gesundheit',
    verschleiß: 2,
    budget_wirkung: 0.7,
    diminishing_at: 75,
    diminishing_wirkung: 0.2,
  }),
  Object.freeze({
    regel_id: 'regel:wirtschaft',
    tag: 'wirtschaft',
    verschleiß: 2,
    budget_wirkung: 0.4,
    diminishing_at: 80,
    diminishing_wirkung: 0.15,
  }),
  Object.freeze({
    regel_id: 'regel:forschung',
    tag: 'forschung',
    verschleiß: 2,
    budget_wirkung: 0.5,
    diminishing_at: 85,
    diminishing_wirkung: 0.2,
    gate: Object.freeze({ indikator: 'bildung', min: 50 }),
  }),
  // §2: Recht & Freiheit und Sicherheit sind nicht per Budget unterhaltbar ("nur Gesetze") —
  // budget_wirkung 0 wirkt im Unterhalt als übersprungen (wirkung ≤ 0), der Verschleiß wirkt.
  Object.freeze({ regel_id: 'regel:recht', tag: 'recht', verschleiß: 1, budget_wirkung: 0 }),
  Object.freeze({ regel_id: 'regel:freiheit', tag: 'freiheit', verschleiß: 1, budget_wirkung: 0 }),
  Object.freeze({
    regel_id: 'regel:sicherheit',
    tag: 'sicherheit',
    verschleiß: 2,
    budget_wirkung: 0,
  }),
]);

/** §1 — Steuerfaktor-Tabelle. Der M0-Anker ist fix `flat` (K2). */
export const STEUERFAKTOR: SteuerfaktorTabelle = Object.freeze({
  niedrig: 0.6,
  flat: 0.8,
  progressiv: 1.0,
  hoch: 1.2,
});

/** §3 — Steuerlast je Gruppe in Reihenfolge niedrig/flat/progressiv/hoch (direkter Abzug). */
export const STEUERLAST: SteuerlastTabelle = Object.freeze({
  arbeitnehmer: Object.freeze({ niedrig: 2, flat: 4, progressiv: 3, hoch: 8 }),
  unternehmen: Object.freeze({ niedrig: 0, flat: 4, progressiv: 8, hoch: 12 }),
  bildung_jugend: Object.freeze({ niedrig: 2, flat: 4, progressiv: 3, hoch: 8 }),
  gesundheit_wesen: Object.freeze({ niedrig: 2, flat: 4, progressiv: 3, hoch: 8 }),
  konservative: Object.freeze({ niedrig: 2, flat: 4, progressiv: 2, hoch: 7 }),
  liberale_minderheiten: Object.freeze({ niedrig: 2, flat: 4, progressiv: 2, hoch: 7 }),
  staatsapparat: Object.freeze({ niedrig: 3, flat: 4, progressiv: 3, hoch: 8 }),
  landwirte: Object.freeze({ niedrig: 2, flat: 4, progressiv: 2, hoch: 7 }),
  // Platzhalter — von Ralf/Reto zu bestätigen:
  elite: Object.freeze({ niedrig: 2, flat: 4, progressiv: 2, hoch: 7 }),
  militaer: Object.freeze({ niedrig: 2, flat: 4, progressiv: 2, hoch: 7 }),
});

/** §3 — die zehn Gruppen mit Anteilen (Σ = 100, K4) und Gewichten (je Σ = 1). Elite und Militaer sind US-M1-09 (Ralf: 5% / 3% Rohwerte, zusammen mit den bestehenden 92 auf 100 normalisiert). Ihre Gewichte und die Putsch-Schwellen fehlen noch (Ralf nachzuliefern). */
export const GRUPPEN_START: readonly GruppenSnapshot[] = Object.freeze([
  Object.freeze({
    tag: 'arbeitnehmer',
    zufriedenheit: 0, // wird beim Start über core/zufriedenheit gerechnet — keine zweite Formel
    bevölkerungsanteil: 22.08, // 24 × 0.92 (Normalisierung mit Elite 5% + Militaer 3%, Σ = 100)
    gewichte: Object.freeze({ wirtschaft: 0.45, gesundheit: 0.25, recht: 0.15, sicherheit: 0.15 }),
  }),
  Object.freeze({
    tag: 'unternehmen',
    zufriedenheit: 0,
    bevölkerungsanteil: 9.2, // 10 × 0.92
    gewichte: Object.freeze({ wirtschaft: 0.55, infrastruktur: 0.3, sicherheit: 0.15 }),
  }),
  Object.freeze({
    tag: 'bildung_jugend',
    zufriedenheit: 0,
    bevölkerungsanteil: 11.96, // 13 × 0.92
    gewichte: Object.freeze({ bildung: 0.6, forschung: 0.25, freiheit: 0.15 }),
  }),
  Object.freeze({
    tag: 'gesundheit_wesen',
    zufriedenheit: 0,
    bevölkerungsanteil: 11.04, // 12 × 0.92
    gewichte: Object.freeze({ gesundheit: 0.7, forschung: 0.15, infrastruktur: 0.15 }),
  }),
  Object.freeze({
    tag: 'konservative',
    zufriedenheit: 0,
    bevölkerungsanteil: 14.72, // 16 × 0.92
    gewichte: Object.freeze({ sicherheit: 0.55, recht: 0.25, wirtschaft: 0.2 }),
  }),
  Object.freeze({
    tag: 'liberale_minderheiten',
    zufriedenheit: 0,
    bevölkerungsanteil: 8.28, // 9 × 0.92
    gewichte: Object.freeze({ freiheit: 0.6, recht: 0.25, bildung: 0.15 }),
  }),
  Object.freeze({
    tag: 'staatsapparat',
    zufriedenheit: 0,
    bevölkerungsanteil: 7.36, // 8 × 0.92
    gewichte: Object.freeze({ infrastruktur: 0.5, sicherheit: 0.3, bildung: 0.2 }),
  }),
  Object.freeze({
    tag: 'landwirte',
    zufriedenheit: 0,
    bevölkerungsanteil: 7.36, // 8 × 0.92
    gewichte: Object.freeze({ wirtschaft: 0.6, infrastruktur: 0.4 }),
  }),
  Object.freeze({
    tag: 'elite',
    zufriedenheit: 0, // wird beim Start über core/zufriedenheit gerechnet
    bevölkerungsanteil: 5, // Rohwert aus docs/balance-werte.md (Ralf), zusammen mit militaer auf 100 normalisiert
    gewichte: Object.freeze({ wirtschaft: 1 }), // Platzhalter — Gewichte von Ralf/Reto zu bestätigen
  }),
  Object.freeze({
    tag: 'militaer',
    zufriedenheit: 0, // wird beim Start über core/zufriedenheit gerechnet
    bevölkerungsanteil: 3, // Rohwert aus docs/balance-werte.md (Ralf), zusammen mit elite auf 100 normalisiert
    gewichte: Object.freeze({ sicherheit: 1 }), // Platzhalter — Gewichte von Ralf/Reto zu bestätigen
  }),
]);

/** §1 — Startwerte Schwierigkeit normal: Wirtschaft 45, übrige Indikatoren 40. */
export const START_INDICATOREN: Readonly<Record<string, number>> = Object.freeze({
  infrastruktur: 40,
  bildung: 40,
  gesundheit: 40,
  wirtschaft: 45,
  forschung: 40,
  recht: 40,
  freiheit: 40,
  sicherheit: 40,
});

/** §9 — Schwierigkeit ist ein Parameter-Pack (G6), kein eigener Mechanismus. */
export const SCHWIERIGKEIT_PACKS: Readonly<
  Record<'leicht' | 'normal' | 'schwer', SchwierigkeitsPack>
> = Object.freeze({
  leicht: Object.freeze({
    verschleiß_multiplikator: 0.7,
    pk_regeneration: 1.2,
    event_wahrscheinlichkeit: 0.6,
    schuldenlimit: 120,
    zinsfaktor: 0.05,
    budget_zuschuss: 10,
  }),
  normal: Object.freeze({
    verschleiß_multiplikator: 1.0,
    pk_regeneration: 1.0,
    event_wahrscheinlichkeit: 1.0,
    schuldenlimit: 100,
    zinsfaktor: 0.08,
    budget_zuschuss: 0,
  }),
  schwer: Object.freeze({
    verschleiß_multiplikator: 1.3,
    pk_regeneration: 0.8,
    event_wahrscheinlichkeit: 1.4,
    schuldenlimit: 80,
    zinsfaktor: 0.12,
    budget_zuschuss: -10,
  }),
});

/** Das "normal"-Pack des Kern-Fixtures ist identisch mit §9 — eine Instanz der Zahlen. */
export const SCHWIERIGKEIT_NORMAL: SchwierigkeitsPack = SCHWIERIGKEIT_PACKS.normal;

/** G11: News-Vorlagen sind Pack-Content. Das Spar-Event (Id `sparen`, §6) ist der einzige Event,
 * den der Tick ohne M2-Event-Regeln selbst erzeugt. */
export const NEWS_VORLAGEN: Readonly<Record<string, string>> = Object.freeze({
  sparen: 'Austerität: Schulden beim Limit — alle Gruppen −5 (balance-werte.md §6).',
  /** US-M1-02/D22: ein Turn ohne Setup wird abgewiesen — narrativiert, damit es nicht wie ein Bug wirkt (G11). */
  setup_abgewiesen:
    'Die Regierung ist noch nicht gegründet — Turn 1 erst nach Regierungsform und Konstitution.',
});

/**
 * PO D10: die 5 Basis-Entscheidungen sind je eine Budget-Allokation pro budgetbarem Indikator.
 * Sie kosten kein politisches Kapital (FR-011 kostet nur Karten; Karten kommen in M3), ihre
 * Wirkung läuft über die `budget_wirkung` des Indikators im Bewegungsschritt.
 */
export interface BasisEntscheidung {
  readonly regel_id: string;
  readonly label: string;
  readonly beschreibung: string;
  readonly cost: {
    readonly budget: number;
    readonly politisches_kapital: number;
  };
  readonly effects: readonly {
    readonly ziel: string;
    readonly tag?: string;
    readonly delta: number;
  }[];
  readonly constraints?: readonly {
    readonly indikator: {
      readonly tag: string;
      readonly min?: number;
      readonly max?: number;
    };
  }[];
  readonly cooldown?: number;
  readonly diminishing_at?: number;
}

export const BASIS_ENTSCHEIDUNGEN: readonly BasisEntscheidung[] = Object.freeze([
  Object.freeze({
    regel_id: 'entscheidung:infrastruktur',
    label: 'Infrastruktur ausbauen',
    beschreibung: 'Budget in Infrastruktur — +0.5 Level je BE, Verschleiß 3/Jahr (balance §2)',
    cost: { budget: 5, politisches_kapital: 0 },
    effects: [{ ziel: 'indikatoren' as const, tag: 'infrastruktur', delta: 1 }],
  }),
  Object.freeze({
    regel_id: 'entscheidung:bildung',
    label: 'Bildung ausbauen',
    beschreibung: 'Budget in Bildung — +0.6 Level je BE, Verschleiß 2/Jahr (balance §2)',
    cost: { budget: 5, politisches_kapital: 0 },
    effects: [{ ziel: 'indikatoren' as const, tag: 'bildung', delta: 1 }],
  }),
  Object.freeze({
    regel_id: 'entscheidung:gesundheit',
    label: 'Gesundheit ausbauen',
    beschreibung: 'Budget in Gesundheit — +0.7 Level je BE, Verschleiß 2/Jahr (balance §2)',
    cost: { budget: 5, politisches_kapital: 0 },
    effects: [{ ziel: 'indikatoren' as const, tag: 'gesundheit', delta: 1 }],
  }),
  Object.freeze({
    regel_id: 'entscheidung:wirtschaft',
    label: 'Wirtschaft stärken',
    beschreibung: 'Budget in Wirtschaft — +0.4 Level je BE, Verschleiß 2/Jahr (balance §2)',
    cost: { budget: 5, politisches_kapital: 0 },
    effects: [{ ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: 1 }],
  }),
  Object.freeze({
    regel_id: 'entscheidung:forschung',
    label: 'Forschung fördern',
    beschreibung:
      'Budget in Forschung — +0.5 Level je BE (über 85: 0.20), Gate Bildung ≥ 50 (balance §2, PO D13)',
    cost: { budget: 5, politisches_kapital: 0 },
    effects: [{ ziel: 'indikatoren' as const, tag: 'forschung', delta: 1 }],
    constraints: [{ indikator: { tag: 'bildung', min: 50 } }],
  }),
]);

/** US-M3-07: Themen-Pack Bildung/Forschung (~6 Karten für den Karten-Katalog, FR-033).
 * Karten wirken auf Indikatoren (bildung, forschung, wirtschaft) und kosten politisches Kapital.
 * Constraints steuern die Verfügbarkeit im Slot-Sampling (US-M3-06, FR-029).
 * Keine Cooldowns gesetzt (Design-Entscheidung: Cooldowns sind für spätere M3-Karten vorgesehen).
 */
export const BILDUNG_FORSCHUNG_KARTEN: readonly TickKarte[] = Object.freeze([
  Object.freeze({
    regel_id: 'karte:bildung_grundschule',
    pk_kosten: 1,
    wirkung: [{ ziel: 'indikatoren' as const, tag: 'bildung', delta: 3 }] as readonly Effekt[],
  }),
  Object.freeze({
    regel_id: 'karte:bildung_uni',
    pk_kosten: 2,
    wirkung: [{ ziel: 'indikatoren' as const, tag: 'bildung', delta: 5 }] as readonly Effekt[],
    constraints: [{ indikator: { tag: 'bildung', min: 60 } }],
  }),
  Object.freeze({
    regel_id: 'karte:bildung_digital',
    pk_kosten: 2,
    wirkung: [
      { ziel: 'indikatoren' as const, tag: 'bildung', delta: 2 },
      { ziel: 'indikatoren' as const, tag: 'forschung', delta: 1 },
    ] as readonly Effekt[],
  }),
  Object.freeze({
    regel_id: 'karte:forschung_grundlagen',
    pk_kosten: 1,
    wirkung: [{ ziel: 'indikatoren' as const, tag: 'forschung', delta: 3 }] as readonly Effekt[],
    constraints: [{ indikator: { tag: 'bildung', min: 50 } }],
  }),
  Object.freeze({
    regel_id: 'karte:forschung_angewandt',
    pk_kosten: 2,
    wirkung: [
      { ziel: 'indikatoren' as const, tag: 'forschung', delta: 5 },
      { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: 2 },
    ] as readonly Effekt[],
    constraints: [
      { indikator: { tag: 'bildung', min: 70 } },
      { indikator: { tag: 'forschung', min: 60 } },
    ],
  }),
  Object.freeze({
    regel_id: 'karte:forschung_transfer',
    pk_kosten: 3,
    wirkung: [
      { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: 5 },
      { ziel: 'indikatoren' as const, tag: 'forschung', delta: 3 },
    ] as readonly Effekt[],
    constraints: [{ indikator: { tag: 'forschung', min: 80 } }],
  }),
]);

/** US-M3-08: Themen-Pack Wirtschaft/Budget (~6 Karten für den Karten-Katalog, FR-033).
 * Karten wirken auf Indikatoren (wirtschaft, schulden, forschung) und kosten politisches Kapital.
 * Constraints steuern die Verfügbarkeit im Slot-Sampling (US-M3-06, FR-029).
 * Keine Cooldowns gesetzt (Design-Entscheidung: Cooldowns sind für spätere M3-Karten vorgesehen).
 */
export const WIRTSCHAFT_BUDGET_KARTEN: readonly TickKarte[] = Object.freeze([
  Object.freeze({
    regel_id: 'karte:wirtschaft_investition',
    pk_kosten: 1,
    wirkung: [{ ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: 3 }] as readonly Effekt[],
  }),
  Object.freeze({
    regel_id: 'karte:wirtschaft_stimulus',
    pk_kosten: 2,
    wirkung: [{ ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: 5 }] as readonly Effekt[],
    constraints: [{ indikator: { tag: 'wirtschaft', max: 60 } }],
  }),
  Object.freeze({
    regel_id: 'karte:wirtschaft_sparen',
    pk_kosten: 1,
    wirkung: [{ ziel: 'budget' as const, delta: 5 }] as readonly Effekt[],
  }),
  Object.freeze({
    regel_id: 'karte:budget_steuer_reform',
    pk_kosten: 2,
    wirkung: [
      { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: 3 },
      { ziel: 'legitimitaet' as const, delta: -2 },
    ] as readonly Effekt[],
    constraints: [{ indikator: { tag: 'wirtschaft', min: 50 } }],
  }),
  Object.freeze({
    regel_id: 'karte:budget_subventionen',
    pk_kosten: 3,
    wirkung: [{ ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: 4 }] as readonly Effekt[],
    constraints: [{ indikator: { tag: 'wirtschaft', max: 40 } }],
  }),
  Object.freeze({
    regel_id: 'karte:wirtschaft_innovation',
    pk_kosten: 2,
    wirkung: [
      { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: 2 },
      { ziel: 'indikatoren' as const, tag: 'forschung', delta: 1 },
    ] as readonly Effekt[],
    constraints: [{ indikator: { tag: 'forschung', min: 60 } }],
  }),
]);

/** US-M2-04: Pandemie-Kette (Ausbruch → Ausbreitung → Gegenmaßnahmen).
 * Konflikt zwischen Gesundheits- und Wirtschaftszufriedenheit (FR-025).
 * Die Kette läuft über nachfolgeEreignisId der Optionen, garantiert Exit durch maxTiefe.
 */
export const PANDEMIE_EREIGNISSE = Object.freeze([
  {
    id: 'pandemie_ausbruch',
    gewicht: 1,
    bedingung: {
      indikator: { tag: 'gesundheit', max: 25 },
    },
    effekte: [
      { ziel: 'indikatoren' as const, tag: 'gesundheit', delta: -15 },
      { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: -5 },
      { ziel: 'radikalisierung' as const, delta: 5 },
    ],
  },
]) as readonly EreignisRegel[];

export const PANDEMIE_KARTEN = Object.freeze([
  {
    regel_id: 'pandemie_ausbruch',
    label: 'Pandemie-Ausbruch',
    optionen: [
      {
        id: 'pandemie_lockdown',
        bedingung: {
          typ: 'indikator_von' as const,
          regel_id: 'pred_lockdown_bedingt',
          tag: 'legitimitaet',
          op: '>=',
          wert: 40,
        },
        effekte: [
          { ziel: 'indikatoren' as const, tag: 'gesundheit', delta: 10 },
          { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: -20 },
          { ziel: 'legitimitaet' as const, delta: -5 },
        ],
        nachfolgeEreignisId: 'pandemie_ausbreitung',
      },
      {
        id: 'pandemie_wirtschaft_offen',
        bedingung: {
          typ: 'indikator_von' as const,
          regel_id: 'pred_wirtschaft_offen_bedingt',
          tag: 'wirtschaft',
          op: '>=',
          wert: 50,
        },
        effekte: [
          { ziel: 'indikatoren' as const, tag: 'gesundheit', delta: -20 },
          { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: 10 },
        ],
        nachfolgeEreignisId: 'pandemie_ausbreitung',
      },
    ],
    maxTiefe: 5,
  },
  {
    regel_id: 'pandemie_ausbreitung',
    label: 'Pandemie-Ausbreitung',
    optionen: [
      {
        id: 'pandemie_gesundheit_system',
        bedingung: {
          typ: 'indikator_von' as const,
          regel_id: 'pred_gesundheit_system_bedingt',
          tag: 'gesundheit',
          op: '<',
          wert: 40,
        },
        effekte: [
          { ziel: 'indikatoren' as const, tag: 'gesundheit', delta: 15 },
          { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: -10 },
        ],
        nachfolgeEreignisId: 'pandemie_gegenmaßnahmen',
      },
      {
        id: 'pandemie_konjunktur',
        bedingung: {
          typ: 'indikator_von' as const,
          regel_id: 'pred_konjunktur_bedingt',
          tag: 'wirtschaft',
          op: '<',
          wert: 40,
        },
        effekte: [
          { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: 15 },
          { ziel: 'indikatoren' as const, tag: 'gesundheit', delta: -10 },
        ],
        nachfolgeEreignisId: 'pandemie_gegenmaßnahmen',
      },
    ],
    maxTiefe: 5,
  },
  {
    regel_id: 'pandemie_gegenmassnahmen',
    label: 'Pandemie-Gegenmaßnahmen',
    optionen: [
      {
        id: 'pandemie_gesundheit_staerken',
        effekte: [
          { ziel: 'indikatoren' as const, tag: 'gesundheit', delta: 15 },
          { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: -10 },
        ],
      },
      {
        id: 'pandemie_konjunkturpaket',
        effekte: [
          { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: 15 },
          { ziel: 'indikatoren' as const, tag: 'gesundheit', delta: -10 },
        ],
      },
    ],
    maxTiefe: 5,
  },
]) as readonly Entscheidungskarte[];

/** US-M2-05: Finanzkrise (wirtschaft < 40 ODER schulden > 60).
 * Zwei Auslöser-Regeln führen zur selben Entscheidungs-Karte (OR-Bedingung über zwei Regeln).
 * Konflikt: Sparen (Schulden −, Wirtschaft −) vs. Stimulus (Schulden +, Wirtschaft +).
 */
export const FINANZKRISE_EREIGNISSE = Object.freeze([
  {
    id: 'finanzkrise_wirtschaft',
    gewicht: 25,
    bedingung: {
      indikator: { tag: 'wirtschaft', max: 39 },
    },
    effekte: [{ ziel: 'legitimitaet' as const, delta: -5 }],
  },
  {
    id: 'finanzkrise_schulden',
    gewicht: 25,
    bedingung: {
      schulden_min: 61,
    },
    effekte: [{ ziel: 'legitimitaet' as const, delta: -5 }],
  },
]) as readonly EreignisRegel[];

export const FINANZKRISE_KARTEN: readonly Entscheidungskarte[] = Object.freeze([
  {
    regel_id: 'finanzkrise',
    label: 'Finanzkrise',
    optionen: [
      {
        id: 'finanzkrise_sparen',
        effekte: [
          { ziel: 'schulden' as const, delta: -20 },
          { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: -10 },
          { ziel: 'legitimitaet' as const, delta: -5 },
        ],
      },
      {
        id: 'finanzkrise_stimulus',
        effekte: [
          { ziel: 'schulden' as const, delta: +20 },
          { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: +15 },
          { ziel: 'legitimitaet' as const, delta: -5 },
        ],
      },
    ],
    maxTiefe: 5,
  },
]) as readonly Entscheidungskarte[];

/** US-M2-06: Kapitalflucht (Unternehmen Zufriedenheit < 50).
 * Ein Event-Regel ohne Entscheidungs-Karte — die Wirkung tritt automatisch ein,
 * sobald die Bedingung erfüllt ist (wie ein Passiv-Event).
 */
export const KAPITALFLUCHT_EREIGNISSE = Object.freeze([
  {
    id: 'kapitalflucht_unternehmen',
    gewicht: 20,
    bedingung: {
      gruppe: { tag: 'unternehmen', max_zufriedenheit: 49 },
    },
    effekte: [
      { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: -15 },
      { ziel: 'radikalisierung' as const, delta: 5 },
    ],
  },
]) as readonly EreignisRegel[];

/** US-M2-07: Skandal-Events (Wahrscheinlichkeit hängt von Pressefreiheit/Zensur ab).
 * Niedrige Freiheit (freiheit <= 50) erhöht die Skandalwahrscheinlichkeit.
 * Wirkung: Legitimität -10, allgemeine Zufriedenheit -5.
 */
export const SKANDAL_EREIGNISSE = Object.freeze([
  {
    id: 'skandal_pressefreiheit',
    gewicht: 15,
    bedingung: {
      indikator: { tag: 'freiheit', max: 50 },
    },
    effekte: [
      { ziel: 'legitimitaet' as const, delta: -10 },
      { ziel: 'indikatoren' as const, tag: 'wirtschaft', delta: -5 },
    ],
  },
]) as readonly EreignisRegel[];

/** Der Basis-Pack als ein Objekt — dieselbe Struktur, die ein YAML-Pack in M4 liefert (ADR-003). */
export const BASIS_PACK = {
  indikator_regeln: INDIKATOR_REGELN,
  gruppen: GRUPPEN_START,
  start_indikatoren: START_INDICATOREN,
  steuerfaktor: STEUERFAKTOR,
  steuerlast: STEUERLAST,
  schwierigkeit_packs: SCHWIERIGKEIT_PACKS,
  news_vorlagen: NEWS_VORLAGEN,
  entscheidungen: BASIS_ENTSCHEIDUNGEN,
  karten_katalog: [...BILDUNG_FORSCHUNG_KARTEN, ...WIRTSCHAFT_BUDGET_KARTEN],
  ereignis_regeln: [
    ...PANDEMIE_EREIGNISSE,
    ...FINANZKRISE_EREIGNISSE,
    ...KAPITALFLUCHT_EREIGNISSE,
    ...SKANDAL_EREIGNISSE,
  ],
  entscheidungskarten: [...PANDEMIE_KARTEN, ...FINANZKRISE_KARTEN],
} as const;

/** Das Schema auf den Pack — ein Test ist die Abnahme (AC US-M0-13: alle Regeln validieren fehlerfrei). */
export function validiereBasisPack(modus: 'dev' | 'produktion' = 'dev') {
  return validierePack(BASIS_PACK, modus);
}

/** Die Deklaration des Basis-Packs — für Konsumenten, die das Schema selbst anlegen wollen. */
export const BASIS_PACK_SCHEMA = basisPackSchema;
