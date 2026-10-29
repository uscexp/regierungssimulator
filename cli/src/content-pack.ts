/**
 * @staatslenker/cli content-pack — der M0-Basis-Content (US-M0-13, FR-011).
 *
 * Der Content lebt im CLI, nie im Kern (ADR-002, Kern-Isolation): der Kern kennt nur die
 * Struktur, dieses Pack liefert die Zahlen. Alle Werte sind ausschließlich aus
 * docs/balance-werte.md abgeleitet — §1 (Einnahmen/Start/K2), §2 (Indikator-Regeln),
 * §3 (Gruppenanteile/Gewichte/Steuerlast), §5 (PK), §7 (Radikalisierung-Start), §9
 * (Schwierigkeits-Packs). Erfundene Werte gibt es hier nicht; wo eine Zahl nur im Repo-Fixture
 * steht (PK-Start 5, Legitimität-Start 50), ist die Quelle als Fixture-Kommentar markiert.
 *
 * Forschung `diminishing_wirkung` = 0.20/BE über 85: der von Ralf autorisierte finale Wert
 * (PO D13, dokumentiert in core/src/indikatoren.test.ts und docs/handoff-backlog.md); die
 * §2-Tabelle nennt nur die Schwelle 85. Mit 0.20/BE ist der Anker 27.19 BE Unterhalt über 85
 * konsistent (17.19 + 2/0.2).
 */
import type { SteuerfaktorTabelle } from '@staatslenker/core/budget';
import type { IndikatorRegel, SchwierigkeitsPack } from '@staatslenker/core/indikatoren';
import { erzeugeGameState, type GameState, type GruppenSnapshot } from '@staatslenker/core/state';
import type { TickRegeln } from '@staatslenker/core/tick';
import { gruppenZufriedenheit, type SteuerlastTabelle } from '@staatslenker/core/zufriedenheit';
import { WAHLREGEL_M0, wahlRegelAlsPrüfung } from '@staatslenker/core/wahl';

/** §2 — Indikator-Regeln (Schwierigkeit normal; der Verschleiß-Multiplikator kommt aus dem Pack). */
export const INDIKATOR_REGELN: readonly IndikatorRegel[] = Object.freeze([
  Object.freeze({
    tag: 'infrastruktur',
    verschleiß: 3,
    budget_wirkung: 0.5,
    diminishing_at: 70,
    diminishing_wirkung: 0.2,
  }),
  Object.freeze({
    tag: 'bildung',
    verschleiß: 2,
    budget_wirkung: 0.6,
    diminishing_at: 65,
    diminishing_wirkung: 0.25,
  }),
  Object.freeze({
    tag: 'gesundheit',
    verschleiß: 2,
    budget_wirkung: 0.7,
    diminishing_at: 75,
    diminishing_wirkung: 0.2,
  }),
  Object.freeze({
    tag: 'wirtschaft',
    verschleiß: 2,
    budget_wirkung: 0.4,
    diminishing_at: 80,
    diminishing_wirkung: 0.15,
  }),
  Object.freeze({
    tag: 'forschung',
    verschleiß: 2,
    budget_wirkung: 0.5,
    diminishing_at: 85,
    diminishing_wirkung: 0.2,
    gate: Object.freeze({ indikator: 'bildung', min: 50 }),
  }),
  // §2: Recht & Freiheit und Sicherheit sind nicht per Budget unterhaltbar ("nur Gesetze") —
  // budget_wirkung 0 wirkt im Unterhalt als übersprungen (wirkung ≤ 0), der Verschleiß wirkt.
  Object.freeze({ tag: 'recht', verschleiß: 1, budget_wirkung: 0 }),
  Object.freeze({ tag: 'freiheit', verschleiß: 1, budget_wirkung: 0 }),
  Object.freeze({ tag: 'sicherheit', verschleiß: 2, budget_wirkung: 0 }),
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
});

/** §3 — die acht Gruppen mit Anteilen (Σ = 100, K4) und Gewichten (je Σ = 1). */
export const GRUPPEN_START: readonly GruppenSnapshot[] = Object.freeze([
  Object.freeze({
    tag: 'arbeitnehmer',
    zufriedenheit: 0, // wird beim Start über core/zufriedenheit gerechnet — keine zweite Formel
    bevölkerungsanteil: 24,
    gewichte: Object.freeze({ wirtschaft: 0.45, gesundheit: 0.25, recht: 0.15, sicherheit: 0.15 }),
  }),
  Object.freeze({
    tag: 'unternehmen',
    zufriedenheit: 0,
    bevölkerungsanteil: 10,
    gewichte: Object.freeze({ wirtschaft: 0.55, infrastruktur: 0.3, sicherheit: 0.15 }),
  }),
  Object.freeze({
    tag: 'bildung_jugend',
    zufriedenheit: 0,
    bevölkerungsanteil: 13,
    gewichte: Object.freeze({ bildung: 0.6, forschung: 0.25, freiheit: 0.15 }),
  }),
  Object.freeze({
    tag: 'gesundheit_wesen',
    zufriedenheit: 0,
    bevölkerungsanteil: 12,
    gewichte: Object.freeze({ gesundheit: 0.7, forschung: 0.15, infrastruktur: 0.15 }),
  }),
  Object.freeze({
    tag: 'konservative',
    zufriedenheit: 0,
    bevölkerungsanteil: 16,
    gewichte: Object.freeze({ sicherheit: 0.55, recht: 0.25, wirtschaft: 0.2 }),
  }),
  Object.freeze({
    tag: 'liberale_minderheiten',
    zufriedenheit: 0,
    bevölkerungsanteil: 9,
    gewichte: Object.freeze({ freiheit: 0.6, recht: 0.25, bildung: 0.15 }),
  }),
  Object.freeze({
    tag: 'staatsapparat',
    zufriedenheit: 0,
    bevölkerungsanteil: 8,
    gewichte: Object.freeze({ infrastruktur: 0.5, sicherheit: 0.3, bildung: 0.2 }),
  }),
  Object.freeze({
    tag: 'landwirte',
    zufriedenheit: 0,
    bevölkerungsanteil: 8,
    gewichte: Object.freeze({ wirtschaft: 0.6, infrastruktur: 0.4 }),
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

/** §9 — Schwierigkeit ist ein Parameter-Pack (G6), kein Mechanismus. */
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

/** US-M0-12: Der Machtcheck-Zyklus ist Content (`wahl_intervall` im Tick) und wird aus der Wahlregel
 * des Packs abgeleitet — Zyklus und Regel können nicht auseinanderfallen (Tick und Adapter prüfen
 * denselben Wert; ein Auseinanderfallen wäre der Lens-Fund zu PR #12). */
export const WAHL_INTERVALL = WAHLREGEL_M0.intervall_jahre;

/** G11: News-Vorlagen sind Pack-Content. Das Spar-Event (Id `sparen`, §6) ist der einzige Event,
 * den der Tick ohne M2-Event-Regeln selbst erzeugt. */
export const NEWS_VORLAGEN: Readonly<Record<string, string>> = Object.freeze({
  sparen: 'Austerität: Schulden beim Limit — alle Gruppen −5 (balance-werte.md §6).',
});

/**
 * Die Start-Gruppen mit gerechneter Zufriedenheit — die Formel kommt aus core/zufriedenheit
 * (eine Formel, eine Instanz), das Pack liefert nur die Daten. Steuermodell `flat` ist der
 * M0-Anker (§1, K2); die Konstitution setzt ihn im Start-State.
 */
export function gruppenStartMitZufriedenheit(
  indikatoren: Readonly<Record<string, number>> = START_INDICATOREN,
): readonly GruppenSnapshot[] {
  return gruppenZufriedenheit(GRUPPEN_START, indikatoren, 'flat', STEUERLAST);
}

/**
 * Der Start-State eines AutoSim-Laufs. Der RNG liegt im State (FR-004): ein Lauf wird pro Seed
 * mit seed und counter 0 gestartet und ist damit vollständig replizierbar.
 * Legitimität 50 und PK 5 sind die Startwerte des M0-Fixtures (core/src/tick.test.ts);
 * balance-werte.md §5 fixiert nur Maximum 12 und Regeneration. Radikalisierung-Start 10 ist §7.
 */
export function startState(seed: number): GameState {
  return erzeugeGameState({
    jahr: 1,
    indikatoren: START_INDICATOREN,
    gruppen: gruppenStartMitZufriedenheit(),
    budget: {},
    politisches_kapital: 5,
    legitimitaet: 50,
    schulden: 0,
    radikalisierung: 10,
    rng: { seed, counter: 0 },
    konstitution: { steuermodell: 'flat' },
    zufriedenheits_trace: {},
    beschlüsse: [],
  });
}

/** Der Regelsatz für den Tick — alles als Daten, keine Kern-Zweige (ADR-002). */
export function tickRegelnFür(schwierigkeitId: 'leicht' | 'normal' | 'schwer'): TickRegeln {
  return Object.freeze({
    indikator_regeln: INDIKATOR_REGELN,
    steuerfaktor: STEUERFAKTOR,
    steuerlast: STEUERLAST,
    schwierigkeit: SCHWIERIGKEIT_PACKS[schwierigkeitId],
    wahl_intervall: WAHL_INTERVALL,
    wahlPruefen: wahlRegelAlsPrüfung(WAHLREGEL_M0),
    news_vorlagen: NEWS_VORLAGEN,
    // Keine Event-Regeln: balance-werte.md definiert keine konkreten Events (das ist M2-Content).
    // Ohne Kandidaten würfelt der Tick nicht — der AutoSim ist damit rein deterministisch.
    ereignis_regeln: [],
  });
}

/** Anker-Levels für den Unterhalt: alle Levels unter dem jeweiligen `diminishing_at`. */
export const ANKER_LEVEL_UNTER_SCHWELLE: Readonly<Record<string, number>> = Object.freeze({
  infrastruktur: 40,
  bildung: 55, // Gate offen (≥ 50), aber unter diminishing_at 65
  gesundheit: 40,
  wirtschaft: 45,
  forschung: 40, // unter 85 → volle Wirkung 0.5
  recht: 40,
  freiheit: 40,
  sicherheit: 40,
});

/** Forschungslevel über 85 bei offenem Gate (Bildung ≥ 50) → abgesenkte Wirkung 0.20/BE (PO D13). */
export const ANKER_LEVEL_FORSCHUNG_UEBER_85: Readonly<Record<string, number>> = Object.freeze({
  ...ANKER_LEVEL_UNTER_SCHWELLE,
  forschung: 88,
});
