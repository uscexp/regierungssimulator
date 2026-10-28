/**
 * core/tick — der Kern-Loop (FR-001, US-M0-11, ADR-002/ADR-006).
 *
 * Ein Tick ist eine pure Funktion über einem Snapshot: `tick(state, action, regeln) → neuer State
 * + Events + News`. Der RNG liegt im State (FR-004), deshalb gibt es keinen RNG-Parameter — die
 * Architektur-Linie `tick(state, action, rules, rng)` ist durch den State-RNG ersetzt (ADR-006).
 *
 * Reihenfolge ist fest (PO-Plan §7): Zufriedenheit → Events → Wahl → Budget → Jahr + PK-Regeneration.
 * Die Zufriedenheit wird am **Jahrsanfang** aus den aktuellen Leveln gerechnet; Events wirken auf
 * die Gruppen vor der Wahl, die Bewegung der Indikatoren läuft im Budget-Schritt danach. Der
 * gespeicherte Snapshot hat damit eine Zufriedenheit des Jahrsanfangs — der nächste Tick rechnet
 * sie aus den neuen Leveln neu. Diese Lesart ist dokumentiert, nicht implizit.
 *
 * Alle Werte kommen als Daten rein (Regeln, Tabellen, Schwierigkeits-Pack): der Kern importiert
 * keinen Content und keine UI (Architektur §3/§5, NFR-004).
 */
import { budgetSchritt, type SteuerfaktorTabelle } from './budget.js';
import {
  BESCHLUSS_WIRKDAUER,
  beschlussEintragen,
  beschlüssePrunen,
  effekteAusBeschlüsse,
} from './beschlüsse.js';
import {
  ereignisAnwenden,
  ereignisAuslosen,
  ereignisIndikatorDeltas,
  effekteAnwenden,
  type AusgelöstesEreignis,
  type EreignisRegel,
} from './ereignisse.js';
import {
  indikatorenSchritt,
  unterhaltOhneEvents,
  type IndikatorRegel,
  type SchwierigkeitsPack,
} from './indikatoren.js';
import { karteWählbar, pkAusgeben, pkRegenerieren } from './kapital.js';
import { pruefeInvarianten, type Modus } from './invariant.js';
import {
  ZUFRIEDENHEIT_BASELINE,
  gruppenZufriedenheit,
  steuerlastFuer,
  steuermodellAusKonstitution,
  type Steuermodell,
  type SteuerlastTabelle,
} from './zufriedenheit.js';
import type { DeltaGrund, Effekt, GruppenSnapshot, GameState, IndikatorTag } from './state.js';

/** Eine Karte aus dem Content-Katalog (M3) — Kosten und Wirkung sind Daten, keine Kern-Konstanten. */
export interface TickKarte {
  readonly regel_id: string;
  readonly pk_kosten: number;
  readonly wirkung: readonly Effekt[];
  readonly wirkdauer_jahre?: number;
}

/** Der Action des Spielers für ein Jahr: Budget verteilen, Karten spielen, Schulden aufnehmen. */
export interface TickAction {
  readonly zuteilung: Readonly<Record<IndikatorTag, number>>;
  readonly karten?: readonly TickKarte[];
  readonly schulden_aufnahme?: number;
}

/** Der Regelsatz eines Packs als Daten — alles, was der Tick braucht, ohne Code-Zweige. */
export interface TickRegeln {
  readonly indikator_regeln: readonly IndikatorRegel[];
  readonly steuerfaktor: SteuerfaktorTabelle;
  readonly steuerlast: SteuerlastTabelle;
  readonly schwierigkeit: SchwierigkeitsPack;
  readonly ereignis_regeln?: readonly EreignisRegel[];
  /** Wahlzyklus in Jahren (M0: alle 4 Jahre, AC US-M0-12). */
  readonly wahl_intervall?: number;
  /** Die Wahlregel wird von außen gereicht (US-M0-12), damit der Tick sie nicht erfindet. */
  readonly wahlPruefen?: (gruppen: readonly GruppenSnapshot[], jahr: number) => WahlErgebnis;
  /** News-Vorlagen je Event-Id; Templates sind Pack-Content (G11), ohne Template fällt der Text auf die Id zurück. */
  readonly news_vorlagen?: Readonly<Record<string, string>>;
}

export interface WahlErgebnis {
  readonly gewonnen: boolean;
  readonly grund_id: string;
}

export interface NewsEintrag {
  readonly id: string;
  readonly text: string;
}

/** Rückgabewert des Ticks — der neue Snapshot und die Ausgaben für UI und Replay-Hash (ADR-008). */
export interface TickErgebnis {
  readonly state: GameState;
  readonly ereignisse: readonly AusgelöstesEreignis[];
  readonly news: readonly NewsEintrag[];
  readonly wahl?: WahlErgebnis;
  readonly unterhalt_be: number;
}

/** Standard-Wahlzyklus aus AC US-M0-12 (Machtcheck alle 4 Jahre). */
export const WAHL_INTERVALL = 4;

/**
 * Ein Jahr Simulation. Wirft bei einem illegalen Action (Karte ohne genug PK, negative Allokation)
 * mit Regel-Id; ein kaputter Regelsatz wirft im Dev-Modus und läuft im Produktionsmodus weiter
 * (FR-002). Der alte Snapshot wird nie mutiert (ADR-002).
 */
export function tick(
  state: GameState,
  action: TickAction,
  regeln: TickRegeln,
  modus: Modus = 'dev',
): TickErgebnis {
  const schwierigkeit = regeln.schwierigkeit;
  const modell = steuermodellAusKonstitution(state.konstitution, modus);

  // 1) Zufriedenheit am Jahrsanfang — aus den Leveln, die der letzte Tick hinterlassen hat.
  const gruppen = gruppenZufriedenheit(state.gruppen, state.indikatoren, modell, regeln.steuerlast);
  const spuren = zufriedenheitsSpuren(
    state.gruppen,
    gruppen,
    state.indikatoren,
    modell,
    regeln.steuerlast,
  );
  let aktuell: GameState = Object.freeze({
    ...state,
    gruppen: Object.freeze(gruppen),
    zufriedenheits_trace: Object.freeze(spuren),
  }) as GameState;

  // 2) Events: gewichtete Auswahl über den State-RNG, Effekte auf Gruppen und Skalar-Ziele.
  const lost = ereignisAuslosen(aktuell, regeln.ereignis_regeln ?? [], schwierigkeit, 1, modus);
  aktuell = Object.freeze({
    ...ereignisAnwenden(aktuell, lost.ereignisse, modus),
    rng: lost.rng,
  }) as GameState;
  const ereignisse: AusgelöstesEreignis[] = [...lost.ereignisse];

  // 3) Karten: PK zuerst prüfen und verbrauchen, dann ins Entscheidungsgedächtnis schreiben.
  let mitKarten = aktuell;
  for (const karte of action.karten ?? []) {
    if (!karteWählbar(aktuell, karte.pk_kosten)) {
      throw new TypeError(
        `Karte "${karte.regel_id}" ist nicht wählbar — PK ${aktuell.politisches_kapital} < Kosten ${karte.pk_kosten}`,
      );
    }
    mitKarten = pkAusgeben(mitKarten, karte.pk_kosten, karte.regel_id);
    mitKarten = beschlussEintragen(mitKarten, {
      regel_id: karte.regel_id,
      wirkung: karte.wirkung,
      wirkdauer_jahre: karte.wirkdauer_jahre ?? BESCHLUSS_WIRKDAUER,
    });
  }
  aktuell = mitKarten;

  // Beschlüsse des Gedächtnisses (inklusive der gerade gespielten Karten) wirken in diesem Jahr.
  const beschlussEffekte = effekteAusBeschlüsse(aktuell);
  aktuell = effekteAnwenden(aktuell, skalarEffekte(beschlussEffekte), 'beschlüsse', modus);

  // 4) Wahlzyklus — die Wahlregel kommt von außen (US-M0-12), der Intervall ist Content.
  let wahl: WahlErgebnis | undefined;
  const intervall = regeln.wahl_intervall ?? WAHL_INTERVALL;
  if (regeln.wahlPruefen !== undefined && state.jahr % intervall === 0) {
    wahl = regeln.wahlPruefen(aktuell.gruppen, state.jahr);
    if (!wahl.gewonnen) {
      aktuell = Object.freeze({
        ...aktuell,
        wahl_niederlage: Object.freeze({ jahr: state.jahr, grund_id: wahl.grund_id }),
      }) as GameState;
    }
  }

  // 5) Budget: Einnahmen → Zinsen → Ausgaben; Spar-Event bei Schulden ≥ Limit (§6).
  const budget = budgetSchritt(
    aktuell,
    { zuteilung: action.zuteilung, schulden_aufnahme: action.schulden_aufnahme },
    regeln.steuerfaktor,
    modell,
    schwierigkeit,
  );
  aktuell = budget.state;
  if (budget.spar_event) {
    aktuell = effekteAnwenden(aktuell, budget.spar_effekte, 'event:sparen', modus);
    ereignisse.push({ ereignis_id: 'sparen', effekte: budget.spar_effekte });
  }

  // 6) Indikatorbewegung: Budget + Event-Deltas + Beschluss-Deltas in einem Schritt (§2A).
  const indikatorDeltas = {
    ...ereignisIndikatorDeltas(ereignisse),
    ...beschlussEffekte.indikatoren,
  };
  const indikatoren = indikatorenSchritt(
    regeln.indikator_regeln,
    aktuell.indikatoren,
    action.zuteilung,
    indikatorDeltas,
    schwierigkeit,
    modus,
  );
  aktuell = Object.freeze({ ...aktuell, indikatoren: Object.freeze(indikatoren) }) as GameState;

  // 7) Jahr + PK-Regeneration + Gedächtnis-Pruning am Jahresende.
  aktuell = Object.freeze({ ...aktuell, jahr: aktuell.jahr + 1 }) as GameState;
  aktuell = pkRegenerieren(aktuell, schwierigkeit);
  aktuell = beschlüssePrunen(aktuell);

  // Der Invariant-Check läuft nach jedem Tick — im Dev-Modus wirft er mit Regel-Id (FR-002).
  pruefeInvarianten(aktuell, modus, 'tick');

  return {
    state: aktuell,
    ereignisse: Object.freeze(ereignisse),
    news: Object.freeze(newsAus(ereignisse, regeln.news_vorlagen)),
    wahl,
    unterhalt_be: unterhaltOhneEvents(
      regeln.indikator_regeln,
      (tag) => indikatoren[tag] ?? 0,
      schwierigkeit,
    ),
  };
}

/** Die Skalar- und Gruppen-Deltas eines Beschlusses — Indikator-Deltas rechnet der Bewegungsschritt. */
function skalarEffekte(
  beschlussEffekte: ReturnType<typeof effekteAusBeschlüsse>,
): readonly Effekt[] {
  const effekte: Effekt[] = [];
  for (const [tag, delta] of Object.entries(beschlussEffekte.gruppen)) {
    effekte.push({ ziel: 'gruppen', tag, delta });
  }
  if (beschlussEffekte.legitimitaet !== 0)
    effekte.push({ ziel: 'legitimitaet', delta: beschlussEffekte.legitimitaet });
  if (beschlussEffekte.radikalisierung !== 0)
    effekte.push({ ziel: 'radikalisierung', delta: beschlussEffekte.radikalisierung });
  if (beschlussEffekte.politisches_kapital !== 0)
    effekte.push({ ziel: 'politisches_kapital', delta: beschlussEffekte.politisches_kapital });
  for (const [tag, delta] of Object.entries(beschlussEffekte.budget)) {
    effekte.push({ ziel: 'budget', tag, delta });
  }
  return effekte;
}

/** News-Einträge aus den ausgelösten Events — Templates sind Pack-Content (G11), ohne Template die Event-Id. */
function newsAus(
  ereignisse: readonly AusgelöstesEreignis[],
  vorlagen?: Readonly<Record<string, string>>,
): readonly NewsEintrag[] {
  return ereignisse.map((ereignis) => ({
    id: ereignis.ereignis_id,
    text: vorlagen?.[ereignis.ereignis_id] ?? `Ereignis: ${ereignis.ereignis_id}`,
  }));
}

/**
 * Top-2 Delta-Gründe je Gruppe (ADR-008) — der Tooltip "Wer ist sauer und warum?" ist damit
 * Render-Arbeit und Teil des Golden-Hashes. Der Beitrag wird aus der Formel abgeleitet: die
 * Veränderung der gewichteten Level-Summe seit dem letzten Tick. Eine Steuer-Änderung ist nur
 * sichtbar, wenn die Konstitution sich ändert (M1-Setup) — der Snapshot speichert das alte Modell
 * nicht, deshalb gibt es in M0 genau einen Grund pro Gruppe. Delta 0 wird nicht gelistet: ein
 * Grund ohne Wirkung ist kein Grund.
 */
function zufriedenheitsSpuren(
  alte: readonly GruppenSnapshot[],
  neue: readonly GruppenSnapshot[],
  indikatoren: Readonly<Record<IndikatorTag, number>>,
  modell: Steuermodell,
  tabelle: SteuerlastTabelle,
): Readonly<Record<string, readonly DeltaGrund[]>> {
  const spuren: Record<string, readonly DeltaGrund[]> = {};

  for (const gruppe of neue) {
    const alt = alte.find((g) => g.tag === gruppe.tag);
    if (alt === undefined) continue;

    const last = steuerlastFuer(gruppe.tag, modell, tabelle);
    // Der gewichtete Level am Jahrsanfang ist aus der alten Zufriedenheit ableitbar:
    // alt = baseline + gewichtete Level − last.
    const gewichtetAlt = alt.zufriedenheit - ZUFRIEDENHEIT_BASELINE + last;
    let gewichtetNeu = 0;
    for (const [tag, gewicht] of Object.entries(gruppe.gewichte)) {
      gewichtetNeu += gewicht * (indikatoren[tag] ?? 0);
    }

    const gründe: DeltaGrund[] = [];
    const levelDelta = gewichtetNeu - gewichtetAlt;
    if (levelDelta !== 0) gründe.push({ grund_id: 'zufriedenheit:level', delta: levelDelta });

    gründe.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    spuren[gruppe.tag] = Object.freeze(gründe.slice(0, 2));
  }

  return spuren;
}
