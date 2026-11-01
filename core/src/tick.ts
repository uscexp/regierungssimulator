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
import { setupAbweisung, type SetupPflicht } from './setup.js';
import { wahlAuswerten, type WahlAuswertung } from './wahl-eval.js';
import type { KonstitutionsEntscheidung, RegierungRegel, WahlregelVariant } from './rules.js';
import { ereignisKetteVerarbeiten, type Entscheidungskarte } from './entscheidung.js';
import type {
  DeltaGrund,
  Effekt,
  GruppenSnapshot,
  GruppenTag,
  GameState,
  IndikatorTag,
} from './state.js';
import type { Wahlprüfung } from './wahl.js';

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
  /**
   * Die Basis-Entscheidung dieses Jahres (Pädu-Ruling zu PR #20, architektur.md §3a): eine reine
   * Daten-Action mit `regel_id` und Dauer — sie schreibt **kein** Entry ins Entscheidungsgedächtnis,
   * weil das Gedächtnis ein Gameplay-Objekt ist (Golden-Replay prüft den exakten Active-Bestand,
   * künftige Regeln zählen oder mustern Beschlüsse). Die Wirkung läuft über die `budget_wirkung` im
   * Bewegungsschritt, die Kürzung über `TickErgebnis.gekuerzte_be`; die Transparenz für den Spieler
   * ist Aufgabe des Adapters (Lagebericht, Adapter-Store), nicht des States.
   */
  readonly budget_allokation?: { readonly regel_id: string; readonly wirkdauer_jahre?: number };
}

/** Der Regelsatz eines Packs als Daten — alles, was der Tick braucht, ohne Code-Zweige. */
export interface TickRegeln {
  readonly indikator_regeln: readonly IndikatorRegel[];
  readonly steuerfaktor: SteuerfaktorTabelle;
  readonly steuerlast: SteuerlastTabelle;
  readonly schwierigkeit: SchwierigkeitsPack;
  readonly ereignis_regeln?: readonly EreignisRegel[];
  /**
   * Die Regierungsregel des Packs als Daten (US-M1-03, FR-015): Form, Amtsmodus und
   * Machtverlust-Mechanik. Der Kern liest sie als Register-Wert, nicht als Code-Zweig — ein Pack
   * ohne Regierungs-Register prüft den gereichten Wahl-Zyklus unverändert (M0-Harness ohne Setup).
   */
  readonly regierung?: RegierungRegel;
  /**
   * Die gereichte Wahl-Mechanik als Register-Variante (ADR-011): der Kern interpretiert den
   * Discriminator typisch (`wahlAuswerten`), kein injizierter Callback. `undefined` heißt: dieser
   * Pack liefert keinen Machtcheck.
   */
  readonly wahlregel?: WahlregelVariant;
  /** News-Vorlagen je Event-Id; Templates sind Pack-Content (G11), ohne Template fällt der Text auf die Id zurück. */
  readonly news_vorlagen?: Readonly<Record<string, string>>;
  /**
   * Entscheidungs-Karten für Event-Ketten (US-M2-03, FR-025): der Spieler wählt bei einem Event
   * zwischen Optionen, jede Option kann zu einem Folge-Event führen. Tiefen-Limit garantiert Exit.
   */
  readonly entscheidungskarten?: readonly Entscheidungskarte[];
  /**
   * Die Setup-Pflicht des geladenen Regelsatzes (US-M1-02, Verdikt D22): ein Turn ohne vollständigen
   * Setup wird abgewiesen. Der Wert kommt aus dem Register des Packs, **nicht** aus einem Adapter —
   * zwei Adapter bei identischen Regeln müssen identisch gate'en (ADR-002). Ein Pack ohne Setup-
   * Register lässt das Feld `undefined` und gate't nie (der M0-Harness spielt ohne Setup).
   */
  readonly setup_pflicht?: SetupPflicht;
}

export type WahlErgebnis = Wahlprüfung;

export interface NewsEintrag {
  readonly id: string;
  readonly text: string;
}

/** Rückgabewert des Ticks — der neue Snapshot und die Ausgaben für UI und Replay-Hash (ADR-008). */
export interface TickErgebnis {
  readonly state: GameState;
  readonly ereignisse: readonly AusgelöstesEreignis[];
  readonly news: readonly NewsEintrag[];
  readonly wahl?: WahlAuswertung;
  /**
   * Grund-Muster, wenn für die gewählte Regierungsform kein Regel-Set im geladenen Pack liegt
   * (US-M1-03, FR-015): dieser Turn läuft ohne Machtcheck, der State bleibt unverändert. Die
   * Inhalte von `parlamentarisch` und `diktatur` warten auf ihre Balance-Werte (Ralf/FR-015).
   */
  readonly machtverlust_regelset?: string;
  readonly unterhalt_be: number;
  /**
   * Der Grund, warum dieser Turn abgewiesen wurde (US-M1-02/D22, Produktionsmodus): der State ist
   * unverändert, der Jahr-Schritt lief nicht. Im Dev-Modus wirft der Kern stattdessen.
   */
  readonly setup_abgewiesen?: string;
  /** BE, die im Budget-Schritt nicht ausgegeben werden konnten (§1/§6) — der Lagebericht narrativiert sie (FR-041). */
  readonly gekuerzte_be: number;
}

/** Standard-Wahlzyklus (PO-Ruling nach dem AutoSim-Befund: 6 Jahre statt 4). Ein Pack deklariert
 * seinen eigenen Zyklus über `regeln.wahl_intervall`; dieser Wert ist nur der Default, damit ein
 * Pack nicht zwei Zahlen für denselben Zyklus schreibt (cli/content-pack importiert ihn). */
export const WAHL_INTERVALL = 6;

/** Die Variante, die zu einer Machtverlust-Mechanik gehört (Register-Bindung, FR-015). */
const MACHTVERLUST_VARIANTEN: Readonly<
  Record<RegierungRegel['machtverlust'], WahlregelVariant['typ']>
> = Object.freeze({
  wahl: 'praesidentialwahl',
  misstrauen: 'parlamentmehrheit',
  putsch: 'putsch_roll',
});

/**
 * Das Machtverlust-Paar aus dem Register (US-M1-03): der Kern wertet nur die Variante, die zur
 * Form passt und deren Mechanik in dieser Story gebaut ist. Fehlt für die gewählte Form das
 * Regel-Set — die Inhalte von `parlamentarisch` und `diktatur` warten auf ihre Balance-Werte
 * (FR-015) — läuft **kein** Check und das Ergebnis meldet den Grund. Eine erfundene Mechanik
 * würde den State desync'en. Der Dev-Modus wirft nur bei einem falschen Paar im Register
 * (FR-002, Definitionfehler des Packs), nie bei einer legalen Setup-Wahl ohne Regel-Set.
 */
function machtverlustAuswerten(
  regeln: TickRegeln,
  setupForm: RegierungRegel['form'] | undefined,
  modus: Modus,
): { readonly variante?: WahlregelVariant; readonly regelset_fehlt?: string } {
  const variante = regeln.wahlregel;
  if (variante === undefined) return {};
  const form = regeln.regierung;
  if (form === undefined) {
    // Kein Regierungs-Register: der M0-Pfad prüft den gereichten Wahl-Zyklus unverändert.
    return variante.typ === 'praesidentialwahl' ? { variante } : {};
  }
  const erwartet = MACHTVERLUST_VARIANTEN[form.machtverlust];
  if (variante.typ !== erwartet) {
    if (modus === 'dev') {
      throw new Error(
        `Machtverlust-Bindung falsch: Form '${form.form}' erwartet die Variante '${erwartet}', gereicht ist '${variante.typ}' (regel_id '${variante.regel_id}')`,
      );
    }
    return {};
  }
  if (setupForm !== undefined && setupForm !== form.form) {
    return { regelset_fehlt: `machtverlust:kein_regelset_fuer_${setupForm}` };
  }
  if (form.machtverlust === 'misstrauen') {
    // Das Misstrauens-Votum ist US-M1-08, die Gesetzes-Mehrheit US-M1-07: die Bindung steht im
    // Register, der Check läuft in dieser Story noch nicht.
    return {};
  }
  if (form.amt.modus === 'keins') {
    // Diktatur: kein Amts-Zyklus; die Mechanik ist die Putsch-Roll in jedem Jahr.
    return form.machtverlust === 'putsch' ? { variante } : {};
  }
  return { variante };
}

/**
 * Ein Jahr Simulation. Wirft bei einem illegalen Action (Karte ohne genug PK, negative Allokation)
 * mit Regel-Id; ein kaputter Regelsatz wirft im Dev-Modus und läuft im Produktionsmodus weiter
 * (FR-002). Der alte Snapshot wird nie mutiert (ADR-002).
 */
/**
 * Die dauerhaften Regelsatz-Modifikatoren der gewählten Konstitutions-Entscheidungen (US-M1-06,
 * FR-017, Verdikt D21): Event-Faktoren multiplizieren, Gruppen-Deltas addieren, das Steuermodell
 * gewinnt gegen eine frühere Entscheidung. Die Instanzen kommen aus dem Register des Packs
 * (`SetupPflicht.entscheidungen`), der Kern erfindet keine Zahl — ohne Setup oder ohne Register-
 * Instanzen ist der Modifikator leer und die M0-Mechanik läuft unverändert.
 */
function dauerhafterModifikator(
  ids: readonly string[] | undefined,
  entscheidungen: readonly KonstitutionsEntscheidung[] | undefined,
): {
  readonly event_wahrscheinlichkeitfaktor?: number;
  readonly gruppen_modifikatoren?: Readonly<Record<GruppenTag, number>>;
  readonly steuermodell?: Steuermodell;
} {
  if (ids === undefined || entscheidungen === undefined || ids.length === 0) return {};
  const gewählt = new Set(ids);
  let faktor: number | undefined;
  const deltas: Record<string, number> = {};
  let modell: Steuermodell | undefined;
  for (const entscheidung of entscheidungen) {
    if (!gewählt.has(entscheidung.regel_id)) continue;
    const modifikator = entscheidung.regelsatz_modifikator;
    if (modifikator.event_wahrscheinlichkeitfaktor !== undefined) {
      faktor = (faktor ?? 1) * modifikator.event_wahrscheinlichkeitfaktor;
    }
    for (const [tag, delta] of Object.entries(modifikator.gruppen_modifikatoren ?? {})) {
      deltas[tag] = (deltas[tag] ?? 0) + delta;
    }
    if (modifikator.steuermodell !== undefined) modell = modifikator.steuermodell;
  }
  return Object.freeze({
    ...(faktor === undefined ? {} : { event_wahrscheinlichkeitfaktor: faktor }),
    ...(Object.keys(deltas).length === 0 ? {} : { gruppen_modifikatoren: Object.freeze(deltas) }),
    ...(modell === undefined ? {} : { steuermodell: modell }),
  });
}

/**
 * Der Baseline-Term der Zufriedenheitsformel für dieses Jahr: der Setup-Offset (US-M1-05) plus die
 * dauerhaften Gruppen-Deltas der Konstitution (US-M1-06). Beide sind Terms derselben Formel, die
 * Spur behält den bestehenden Grund (`konstitutions_modifikator`) — ADR-008 erlaubt keinen neuen
 * Delta-Grund in der Spur.
 */
function baselineOffset(
  setupOffset: Readonly<Record<GruppenTag, number>> | undefined,
  dauerhafte: Readonly<Record<GruppenTag, number>> | undefined,
): Readonly<Record<GruppenTag, number>> | undefined {
  if (dauerhafte === undefined) return setupOffset;
  if (setupOffset === undefined) return dauerhafte;
  const merged: Record<string, number> = { ...setupOffset };
  for (const [tag, delta] of Object.entries(dauerhafte)) merged[tag] = (merged[tag] ?? 0) + delta;
  return Object.freeze(merged);
}

export function tick(
  state: GameState,
  action: TickAction,
  regeln: TickRegeln,
  modus: Modus = 'dev',
): TickErgebnis {
  // 0) Setup-Gate (US-M1-02, D22): ohne vollständige Setup-Phase läuft kein Jahr Simulation. Der
  //    Grund wird über ein News-Template narrativiert, damit es nicht wie ein Bug wirkt (G11).
  const setupGrund = setupAbweisung(state, regeln.setup_pflicht);
  if (setupGrund !== undefined) {
    if (modus === 'dev') {
      throw new TypeError(`Turn ohne Setup: ${setupGrund}`);
    }
    const text = regeln.news_vorlagen?.['setup_abgewiesen'] ?? setupGrund;
    return {
      state,
      ereignisse: [],
      news: [{ id: 'setup_abgewiesen', text }],
      unterhalt_be: 0,
      gekuerzte_be: 0,
      setup_abgewiesen: setupGrund,
    };
  }

  const schwierigkeit = regeln.schwierigkeit;
  // Die dauerhaften Modifikatoren des Registers (US-M1-06, FR-017) wirken in jedem Jahr — sie sind
  // Daten aus den gewählten Konstitutions-Ids, nicht ein Adapter-Zweig.
  const modifikator = dauerhafterModifikator(
    state.setup?.konstitutions_ids,
    regeln.setup_pflicht?.entscheidungen,
  );
  const konstitution =
    modifikator.steuermodell === undefined
      ? state.konstitution
      : Object.freeze({ ...state.konstitution, steuermodell: modifikator.steuermodell });
  const modell = steuermodellAusKonstitution(konstitution, modus);
  const baseline = baselineOffset(
    state.setup?.konstitutions_offset,
    modifikator.gruppen_modifikatoren,
  );

  // 1) Zufriedenheit am Jahrsanfang — aus den Leveln, die der letzte Tick hinterlassen hat. Der
  //    Konstitutions-Offset der Setup-Phase (US-M1-05) ist ein Baseline-Term der Formel und bleibt
  //    erhalten, bis die nächste Konstitution ihn ersetzt (Ralf-Option B, kein Reset am Turn 1).
  const gruppen = gruppenZufriedenheit(
    state.gruppen,
    state.indikatoren,
    modell,
    regeln.steuerlast,
    0,
    baseline,
  );
  const spuren = zufriedenheitsSpuren(
    state.gruppen,
    gruppen,
    state.indikatoren,
    modell,
    regeln.steuerlast,
    baseline,
  );
  let aktuell: GameState = Object.freeze({
    ...state,
    gruppen: Object.freeze(gruppen),
    zufriedenheits_trace: Object.freeze(spuren),
  }) as GameState;

  // 2) Events: gewichtete Auswahl über den State-RNG, Effekte auf Gruppen und Skalar-Ziele.
  const lost = ereignisAuslosen(
    aktuell,
    regeln.ereignis_regeln ?? [],
    schwierigkeit,
    1,
    modus,
    modifikator.event_wahrscheinlichkeitfaktor,
  );
  aktuell = Object.freeze({
    ...ereignisAnwenden(aktuell, lost.ereignisse, modus),
    rng: lost.rng,
  }) as GameState;
  const ereignisse: AusgelöstesEreignis[] = [...lost.ereignisse];

  // 2b) Event-Ketten mit Entscheidungs-Karten (US-M2-03): für jedes ausgelöste Event prüfen,
  // ob eine entsprechende Entscheidungskarte existiert und die Kette verarbeiten.
  for (const ereignis of lost.ereignisse) {
    const karte = (regeln.entscheidungskarten ?? []).find((k) => k.regel_id === ereignis.ereignis_id);
    if (karte === undefined) continue;

    const kettenErgebnis = ereignisKetteVerarbeiten(
      regeln.entscheidungskarten ?? [],
      karte.regel_id,
      aktuell,
      modus,
      0,
      5,
    );
    aktuell = Object.freeze({ ...aktuell, ...kettenErgebnis.state }) as GameState;
    ereignisse.push(...kettenErgebnis.ereignisse);
  }

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

  // 4) Machtverlust — der Kern interpretiert die gereichten Register-Varianten (US-M1-03, ADR-011).
  //    Kein injizierter Callback mehr: die Mechanik steht als Daten im Register und der Kern
  //    verzweigt typisch über den Discriminator (`wahlAuswerten`). Die Bindung von Regierungsform
  //    und Variante ist Teil des Registers; ein falsches Paar ist im Dev-Modus ein
  //    Definitionfehler und in Produktion kein Check (erfundene Mechanik wäre ein Desync).
  //    Der Amtsmodus entscheidet, ob ein Amts-Zyklus läuft: `keins` (Diktatur) prüft keinen
  //    Zyklus, `fixed_term`/`zyklisch` prüfen in den Jahren des gereichten Intervalls.
  let wahl: WahlAuswertung | undefined;
  const paar = machtverlustAuswerten(regeln, aktuell.setup?.regierungsform, modus);
  const machtverlust_regelset = paar.regelset_fehlt;
  if (paar.variante !== undefined) {
    const auswertung = wahlAuswerten(paar.variante, aktuell, modus);
    if (auswertung !== undefined) {
      wahl = auswertung;
      if (auswertung.typ === 'putsch_roll' && auswertung.rng !== undefined) {
        // Die Roll verbraucht den State-RNG nur, wenn tatsächlich gewürfelt wurde (FR-004).
        aktuell = Object.freeze({ ...aktuell, rng: auswertung.rng }) as GameState;
      }
      if (!auswertung.gewonnen) {
        aktuell = Object.freeze({
          ...aktuell,
          wahl_niederlage: Object.freeze({ jahr: state.jahr, grund_id: auswertung.grund_id }),
        }) as GameState;
      }
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
    machtverlust_regelset,
    unterhalt_be: unterhaltOhneEvents(
      regeln.indikator_regeln,
      (tag) => indikatoren[tag] ?? 0,
      schwierigkeit,
    ),
    gekuerzte_be: budget.gekuerzte_be,
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
  /** Der Konstitutions-Offset beider Seiten (US-M1-05) — er ist kein Delta, sonst wäre der Grund erfunden. */
  offset?: Readonly<Record<string, number>>,
): Readonly<Record<string, readonly DeltaGrund[]>> {
  const spuren: Record<string, readonly DeltaGrund[]> = {};

  for (const gruppe of neue) {
    const alt = alte.find((g) => g.tag === gruppe.tag);
    if (alt === undefined) continue;

    const last = steuerlastFuer(gruppe.tag, modell, tabelle);
    const beitrag = offset?.[gruppe.tag] ?? 0;
    // Der gewichtete Level am Jahrsanfang ist aus der alten Zufriedenheit ableitbar:
    // alt = baseline + gewichtete Level − last + offset.
    const gewichtetAlt = alt.zufriedenheit - ZUFRIEDENHEIT_BASELINE + last - beitrag;
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
