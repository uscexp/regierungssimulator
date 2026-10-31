/**
 * @staatslenker/cli content-pack — der Adapter, der den Basis-Content zum Regelsatz macht (US-M0-13).
 *
 * Die Zahlen liegen seit US-M0-13 in `@staatslenker/content-base` (validiert gegen das Zod-Schema,
 * ADR-003) — dieses Modul enthält keine Balance-Werte mehr, sondern baut daraus den `TickRegeln`-Satz
 * und den Start-State. Der Kern importiert keinen Content (ADR-002, Kern-Isolation); der CLI ist der
 * Adapter, der Content und Kern zusammenbringt. Die Export-Namen bleiben stabil, damit AutoSim und
 * Tests unverändert importieren.
 */
import {
  BASIS_ENTSCHEIDUNGEN,
  GRUPPEN_START,
  INDIKATOR_REGELN,
  KONSTITUTION_WERTE,
  NEWS_VORLAGEN,
  SCHWIERIGKEIT_PACKS,
  SETUP_FORMEN,
  SETUP_PFLICHT,
  STANDARD_SETUP,
  START_INDICATOREN,
  STEUERFAKTOR,
  STEUERLAST,
  REGIERUNG_REGEL_M0,
  WAHLREGEL_VARIANT_M0,
  basisKonstitution,
} from '@staatslenker/content-base';
import { erzeugeGameState, type GameState, type GruppenSnapshot } from '@staatslenker/core/state';
import type { TickRegeln } from '@staatslenker/core/tick';
import { gruppenZufriedenheit } from '@staatslenker/core/zufriedenheit';

/** Content wird re-exportiert — eine Instanz der Zahlen, sie liegt im content-base-Pack. */
export {
  BASIS_PACK,
  BASIS_PACK_SCHEMA,
  GRUPPEN_START,
  INDIKATOR_REGELN,
  NEWS_VORLAGEN,
  SCHWIERIGKEIT_NORMAL,
  SCHWIERIGKEIT_PACKS,
  START_INDICATOREN,
  STEUERFAKTOR,
  STEUERLAST,
  validiereBasisPack,
  validierePack,
} from '@staatslenker/content-base';

/** Das Setup-Register wird re-exportiert — die Werte liegen in `content-base`, der Adapter hat keine davon (D22).
 */
export {
  BASIS_ENTSCHEIDUNGEN,
  basisKonstitution,
  KONSTITUTION_WERTE,
  SETUP_FORMEN,
  SETUP_PFLICHT,
  STANDARD_SETUP,
};

/** Der Machtcheck-Zyklus des Packs (M0: 6 Jahre) — abgeleitet aus der gereichten Wahl-Variante, damit
 * Zyklus und Regel nicht auseinanderfallen (Tick und Adapter lesen denselben Register-Wert). */
export const WAHL_INTERVALL = WAHLREGEL_VARIANT_M0.intervall_jahre;

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
/**
 * Der Regelsatz **mit** Setup-Pflicht (US-M1-02, Verdikt D22). Der Flag kommt aus dem geladenen
 * Register (`SETUP_PFLICHT` aus content-base), nicht aus einer Adapter-Option: zwei Adapter bei
 * identischen Regeln gate'n identisch (ADR-002). `tickRegelnFür` bleibt der Satz ohne Setup — der
 * M0-Harness (Replay/Spread/Kurven) spielt weiter ohne Setup und seine Hashes bleiben bitgleich.
 */
export function tickRegelnFürMitSetup(schwierigkeitId: 'leicht' | 'normal' | 'schwer'): TickRegeln {
  return Object.freeze({ ...tickRegelnFür(schwierigkeitId), setup_pflicht: SETUP_PFLICHT });
}

export function tickRegelnFür(schwierigkeitId: 'leicht' | 'normal' | 'schwer'): TickRegeln {
  return Object.freeze({
    indikator_regeln: INDIKATOR_REGELN,
    steuerfaktor: STEUERFAKTOR,
    steuerlast: STEUERLAST,
    schwierigkeit: SCHWIERIGKEIT_PACKS[schwierigkeitId],
    // Die Machtverlust-Mechanik ist Register-Daten (US-M1-03, ADR-011): der Tick interpretiert
    // Form und Variante, der Adapter reicht keine Funktion.
    regierung: REGIERUNG_REGEL_M0,
    wahlregel: WAHLREGEL_VARIANT_M0,
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
