/**
 * cli/konstitution-messung — der Balance-Nachlauf der Konstitutions-Baseline (US-M1-05, FR-017).
 *
 * Die AC vergleicht „baseline-Zufriedenheit der liberalen Gruppen ist höher, der konservativen
 * niedriger als ohne Grundrechte" — das ist ein Vergleich zweier Setups bei **identischem Seed**,
 * keine Golden-Fixture. Der Report ist die AC-Instanz (Trix-Ruling): zwei Läufe, eine Zahl je Gruppe.
 *
 * Der Vergleich läuft über die Kern-Funktion `konstitutionsOffset` (core/setup) — dieselbe Summe, die
 * `setupAnwenden` in den Snapshot schreibt, und dieselbe Formel, die der Tick am Jahrsanfang rechnet
 * (core/zufriedenheit). Der Harness erfindet keine Zahl: die Effekte kommen aus dem geladenen Register.
 *
 * Die Messreihe liegt zusätzlich zu den M0-Fixtures (Replay/Spread/Kurven). Diese spielen ohne Setup
 * (`tickRegelnFür` ohne Pflicht), ihr Offset ist `undefined` und die Hashes bleiben bitgleich.
 */
import { konstitutionsOffset } from '@staatslenker/core/setup';
import {
  gruppenZufriedenheit,
  steuermodellAusKonstitution,
} from '@staatslenker/core/zufriedenheit';
import type { GruppenTag } from '@staatslenker/core/state';
import {
  KONSTITUTION_WERTE,
  SETUP_PFLICHT,
  START_INDICATOREN,
  STEUERLAST,
  startState,
} from './content-pack.js';

/** Die Vergleich-Entscheidung der AC (US-M1-05): Grundrechte ja vs. nein. */
export const MESS_ENTSCHEIDUNG = 'grundrechte';

/** Eine Messzeile: die gerechnete baseline-Zufriedenheit je Gruppe mit und ohne die Entscheidung. */
export interface MessZeile {
  readonly tag: GruppenTag;
  readonly mit: number;
  readonly ohne: number;
  readonly delta: number;
}

/** Der Report einer Messung — eine Zahl je Gruppe, deterministisch bei identischem Seed. */
export interface KonstitutionsMessung {
  readonly seed: number;
  readonly entscheidung: string;
  readonly zeilen: readonly MessZeile[];
}

/** Die Ids des Registers ohne die Vergleich-Entscheidung — der Gegenfall „ohne Grundrechte". */
function idsOhne(id: string): readonly string[] {
  return SETUP_PFLICHT.konstitutions_ids.filter((eintrag) => eintrag !== id);
}

/** Die baseline-Zufriedenheit aller Gruppen für einen Konstitutions-Offset (Formel aus core). */
function baselineMitOffset(
  seed: number,
  offset: Readonly<Record<string, number>>,
): Readonly<Map<GruppenTag, number>> {
  const start = startState(seed);
  const modell = steuermodellAusKonstitution(KONSTITUTION_WERTE, 'dev');
  const gruppen = gruppenZufriedenheit(
    start.gruppen,
    START_INDICATOREN,
    modell,
    STEUERLAST,
    0,
    offset,
  );
  return new Map(gruppen.map((gruppe) => [gruppe.tag, gruppe.zufriedenheit]));
}

/**
 * Die Messung der AC-Instanz: dasselbe Seed, einmal das vollständige Setup, einmal dasselbe Setup
 * ohne die Vergleich-Entscheidung. Die Differenz ist genau der Sofort-Effekt dieser Entscheidung.
 */
export function konstitutionsMessung(
  seed: number,
  entscheidung: string = MESS_ENTSCHEIDUNG,
): KonstitutionsMessung {
  const entscheidungen = SETUP_PFLICHT.entscheidungen ?? [];
  const mit = baselineMitOffset(
    seed,
    konstitutionsOffset(SETUP_PFLICHT.konstitutions_ids, entscheidungen),
  );
  const ohne = baselineMitOffset(seed, konstitutionsOffset(idsOhne(entscheidung), entscheidungen));

  const zeilen: MessZeile[] = [...mit.entries()].map(([tag, wert]) => {
    const gegen = ohne.get(tag) ?? 0;
    return Object.freeze({ tag, mit: wert, ohne: gegen, delta: wert - gegen });
  });

  return Object.freeze({ seed, entscheidung, zeilen: Object.freeze(zeilen) });
}

/** Die Messzeilen als Report-Text (eine Zahl je Gruppe) — der Report, den die AC instanziiert. */
export function messungAlsReport(messung: KonstitutionsMessung): string {
  const zeilen = messung.zeilen
    .map(
      (zeile) =>
        `  ${zeile.tag}: mit ${zeile.mit.toFixed(2)} / ohne ${zeile.ohne.toFixed(2)} (Delta ${zeile.delta >= 0 ? '+' : ''}${zeile.delta.toFixed(2)})`,
    )
    .join('\n');
  return `Konstitutions-Messung (Seed ${messung.seed}, Vergleich "${messung.entscheidung}")\n${zeilen}`;
}

/** Der Harness-Lauf als Boot-Ausgabe (npm run balance:konstitution). */
export function main(): string {
  return messungAlsReport(konstitutionsMessung(424242));
}
