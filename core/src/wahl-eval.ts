/**
 * core/wahl-eval — die Kern-Interpretation der closed Wahl-Varianten (US-M1-11, FR-013/FR-014/FR-016).
 *
 * Die Variante ist **Daten, keine injizierte Funktion und kein Interpreter** (ADR-011): der Kern
 * verzweigt typisch über den Discriminator `typ`; alle Schwellen und Wahrscheinlichkeiten kommen aus
 * dem gereichten Regel-Objekt — keine Kern-Konstanten, keine erfundenen Balance-Zahlen. Das Register
 * (`core/rules`) validiert die Struktur, dieses Modul rechnet die Mechanik auf dem Snapshot.
 *
 * Die Präesidentialwahl reuse't den bestehenden Gate aus `core/wahl` (eine Formel, eine Instanz):
 * gewichtete Ø ≥ `gewichtete_min` UND schwächste Gruppe ≥ `schwächste_min`, Schwellen inklusiv.
 * Geprüft wird nur im Wahljahr (`jahr % intervall_jahre === 0`); ein Nicht-Wahljahr liefert
 * `undefined`, damit der Tick keinen Machtcheck protokolliert, der nie stattgefunden hat
 * (Lens-Fund zu PR #12 — ein Nicht-Wahljahr ist niemals als gewonnen).
 *
 * Die andern Formen sind die andern Mechaniken: `parlamentmehrheit` (FR-016) ist ein Anteil
 * (G3/§3a: keine Fraktions-Ids) und wird gegen die bevölkerungsgewichtete Zustimmung gemessen —
 * `gewichteteZufriedenheit / 100 ≥ mehrheit`, Schwellen inklusiv wie im Wahl-Gate. `putsch_roll`
 * (FR-014) würfelt über den **State-RNG** (FR-004): die Bedingung ist Elite-/Militärzufriedenheit
 * und Legitimität; sind alle Schwellen erfüllt, läuft **keine** Roll und der RNG wird nicht
 * verbraucht. Eine fehlende Elite-/Militär-Gruppe ist nicht „0 als erfüllt": im Dev-Modus wirft sie
 * mit Gruppen-Tag und Regel-Id (FR-002), in Produktion gilt sie als nicht erreicht und die Roll läuft
 * — ein Snapshot ohne Elite-Gruppe darf das Spiel nie crashen (die Gruppen liefert US-M1-09 erst).
 *
 * Die Gruppen-Tags der Putsch-Bedingung sind `elite` und `militaer` — dieselben ASCII-Namen wie die
 * Register-Felder `elite_min`/`militaer_min` (§3b-Kanon); ein Pack mit anderen Tags ist US-M1-09,
 * nicht hier. Alles ist pure Funktion: der Snapshot und sein RNG werden nie mutiert; der
 * fortgeschrittene RNG-Zustand kommt als Rückgabewert (ADR-002).
 */
import { type Modus } from './invariant.js';
import { nextFloat } from './rng.js';
import { gewichteteZufriedenheit, schwachsteZufriedenheit } from './zufriedenheit.js';
import type { WahlregelVariant } from './rules.js';
import type { GameState, GruppenTag, RngState } from './state.js';
import { wahlPrüfen, wahlJahr } from './wahl.js';

/** Die Tags, die die Putsch-Bedingung im State sucht (Kanon zu den Register-Feldnamen). */
const ELITE_TAG: GruppenTag = 'elite';
const MILITAER_TAG: GruppenTag = 'militaer';

/** Auswertung der Präesidentialwahl — die gemessenen Werte des Gates aus `core/wahl`. */
export interface AuswertungPraesidentialwahl {
  readonly typ: 'praesidentialwahl';
  readonly gewonnen: boolean;
  /** Grund-Muster aus `core/wahl`: `wahl:gewonnen`, `wahl:gewichtete_unter_X`, `wahl:schwächste_unter_X`. */
  readonly grund_id: string;
  readonly gewichtete_zufriedenheit: number;
  readonly schwächste_zufriedenheit: number;
  readonly schwächste_gruppe: string;
}

/** Auswertung der parlamentarischen Mehrheit (FR-016) — Zustimmung als Anteil 0–1 gegen `mehrheit`. */
export interface AuswertungParlamentmehrheit {
  readonly typ: 'parlamentmehrheit';
  readonly gewonnen: boolean;
  /** Grund-Muster mit der Schwelle der Regel: `mehrheit:gewonnen` oder `mehrheit:unter_X`. */
  readonly grund_id: string;
  readonly mehrheit: number;
  /** Die gemessene Zustimmung: gewichtete Ø-Zufriedenheit als Anteil (0–1). */
  readonly zustimmung: number;
  readonly gewichtete_zufriedenheit: number;
  readonly schwächste_zufriedenheit: number;
}

/** Auswertung der Putsch-Roll (FR-014) — erreichte Werte, Roll-Grund und der fortgeschrittene RNG. */
export interface AuswertungPutschRoll {
  readonly typ: 'putsch_roll';
  /** true heißt: die Macht bleibt (keine Roll, oder die Roll wurde abgewehrt). */
  readonly gewonnen: boolean;
  /** `putsch:bedingung_erfüllt`, `putsch:gerollt_abgewehrt`, oder die fehlende Bedingung im Grund-Muster. */
  readonly grund_id: string;
  /** undefined, wenn die Gruppe im State fehlt (nur Produktionsmodus — im Dev-Modus wirft sie). */
  readonly elite_zufriedenheit: number | undefined;
  readonly militaer_zufriedenheit: number | undefined;
  readonly legitimitaet: number;
  /** Die Risiko-Gründe der nicht erreichten Bedingungen (Grund-Muster je Bedingung). */
  readonly riskogründe: readonly string[];
  readonly gerollt: boolean;
  readonly roll_wert: number | undefined;
  readonly putsch_eingetreten: boolean;
  /** Der fortgeschrittene RNG — nur verbraucht, wenn tatsächlich gewürfelt wurde (FR-004). */
  readonly rng: RngState;
}

export type WahlAuswertung =
  AuswertungPraesidentialwahl | AuswertungParlamentmehrheit | AuswertungPutschRoll;

/** Auswertung eines Machtchecks — `undefined` heißt: kein Check in diesem Jahr. */
export type WahlAuswertungErgebnis = WahlAuswertung | undefined;

function zufriedenheitDerGruppe(state: GameState, tag: GruppenTag): number | undefined {
  return state.gruppen.find((g) => g.tag === tag)?.zufriedenheit;
}

/**
 * Die Putsch-Bedingung: jede Schwelle inklusiv erreicht heißt „erfüllt". Eine fehlende Gruppe ist im
 * Dev-Modus ein Definitionfehler (wirft mit Gruppen-Tag und Regel-Id, FR-002) und in Produktion
 * **nicht erreicht** — nie als 0 erfüllt, sonst würde ein Pack ohne Elite-Gruppe nie riskieren.
 */
function putschBedingung(
  variante: Extract<WahlregelVariant, { typ: 'putsch_roll' }>,
  state: GameState,
  modus: Modus,
): {
  readonly elite: number | undefined;
  readonly militaer: number | undefined;
  readonly riskogründe: string[];
} {
  const elite = zufriedenheitDerGruppe(state, ELITE_TAG);
  const militaer = zufriedenheitDerGruppe(state, MILITAER_TAG);
  for (const [tag, wert] of [
    [ELITE_TAG, elite],
    [MILITAER_TAG, militaer],
  ] as const) {
    if (wert === undefined && modus === 'dev') {
      throw new TypeError(
        `Putsch-Regel "${variante.regel_id}": Gruppe "${tag}" fehlt im State — die Bedingung ist nicht erreichbar`,
      );
    }
  }
  const riskogründe: string[] = [];
  if (elite === undefined) riskogründe.push(`putsch:gruppe_fehlt_${ELITE_TAG}`);
  else if (elite < variante.elite_min) riskogründe.push(`putsch:elite_unter_${variante.elite_min}`);
  if (militaer === undefined) riskogründe.push(`putsch:gruppe_fehlt_${MILITAER_TAG}`);
  else if (militaer < variante.militaer_min)
    riskogründe.push(`putsch:militaer_unter_${variante.militaer_min}`);
  if (state.legitimitaet < variante.legitimitaet_min)
    riskogründe.push(`putsch:legitimitaet_unter_${variante.legitimitaet_min}`);
  return { elite, militaer, riskogründe };
}

/**
 * Die Kern-Interpretation einer gereichten Wahl-Mechanik auf dem Snapshot. Die Variante wird typisch
 * über den Discriminator verzweigt (ADR-011 — keine injizierte Funktion, kein Interpreter); ein
 * Nicht-Wahljahr der Präesidentialwahl liefert `undefined`, kein Ergebnis.
 */
export function wahlAuswerten(
  variante: WahlregelVariant,
  state: GameState,
  modus: Modus = 'dev',
): WahlAuswertungErgebnis {
  switch (variante.typ) {
    case 'praesidentialwahl': {
      // Nicht-Wahljahr ⇒ kein Ergebnis: ein `gewonnen: true` für einen Check, der nie lief, wäre ein
      // erfundenes Ereignis im Tick-Protokoll (Lens-Fund zu PR #12).
      if (!wahlJahr(state.jahr, variante)) return undefined;
      const prüfung = wahlPrüfen(state.gruppen, variante);
      return Object.freeze({
        typ: 'praesidentialwahl',
        gewonnen: prüfung.gewonnen,
        grund_id: prüfung.grund_id,
        gewichtete_zufriedenheit: prüfung.gewichtete_zufriedenheit,
        schwächste_zufriedenheit: schwachsteZufriedenheit(state.gruppen),
        schwächste_gruppe: prüfung.schwächste_gruppe,
      });
    }

    case 'parlamentmehrheit': {
      const gewichtete = gewichteteZufriedenheit(state.gruppen);
      const zustimmung = gewichtete / 100;
      // Ein Snapshot ohne Gruppen ist derselbe Definitionfehler wie im Wahl-Gate (`wahl:keine_gruppen`)
      // — die Ursache nennt die fehlenden Gruppen, nicht eine unterlaufene Schwelle.
      if (state.gruppen.length === 0) {
        return Object.freeze({
          typ: 'parlamentmehrheit',
          gewonnen: false,
          grund_id: 'mehrheit:keine_gruppen',
          mehrheit: variante.mehrheit,
          zustimmung: 0,
          gewichtete_zufriedenheit: 0,
          schwächste_zufriedenheit: 0,
        });
      }
      const gewonnen = zustimmung >= variante.mehrheit;
      return Object.freeze({
        typ: 'parlamentmehrheit',
        gewonnen,
        // Die Ursache nennt die Schwelle der Regel, nicht eine feste Zahl — dieselbe Konvention wie
        // `wahl:gewichtete_unter_X` im Wahl-Gate (Schwellen sind Content, PO-Ruling zu D18).
        grund_id: gewonnen ? 'mehrheit:gewonnen' : `mehrheit:unter_${variante.mehrheit}`,
        mehrheit: variante.mehrheit,
        zustimmung,
        gewichtete_zufriedenheit: gewichtete,
        schwächste_zufriedenheit: schwachsteZufriedenheit(state.gruppen),
      });
    }

    case 'putsch_roll': {
      const { elite, militaer, riskogründe } = putschBedingung(variante, state, modus);
      if (riskogründe.length === 0) {
        // Alle Schwellen erreicht ⇒ keine Roll ⇒ der RNG wird nicht verbraucht (der Replay-Strom
        // bleibt unverändert — kein Wurf ohne Risiko).
        return Object.freeze({
          typ: 'putsch_roll',
          gewonnen: true,
          grund_id: 'putsch:bedingung_erfüllt',
          elite_zufriedenheit: elite,
          militaer_zufriedenheit: militaer,
          legitimitaet: state.legitimitaet,
          riskogründe: Object.freeze([]),
          gerollt: false,
          roll_wert: undefined,
          putsch_eingetreten: false,
          rng: state.rng,
        });
      }
      // Die Wahrscheinlichkeit ist Register-Datum; ein Wert außerhalb 0–1 ist kaputte Struktur und
      // wirft wie `würfele` in beiden Modi mit Regel-Id. Der Roll-Wert kommt aus dem State-RNG.
      if (!(variante.wahrscheinlichkeit >= 0 && variante.wahrscheinlichkeit <= 1)) {
        throw new TypeError(
          `Wahrscheinlichkeit außerhalb 0–1 für Regel "${variante.regel_id}" (wert=${String(variante.wahrscheinlichkeit)})`,
        );
      }
      const wurf = nextFloat(state.rng);
      const eingetreten = wurf.wert < variante.wahrscheinlichkeit;
      return Object.freeze({
        typ: 'putsch_roll',
        gewonnen: !eingetreten,
        // Eingetreten: der erste Risiko-Grund ist die Spielende-Ursache (Grund-Muster wie im
        // Wahl-Gate). Abgewehrt: die Roll fand statt, die Macht blieb — der Grund nennt die Roll.
        grund_id: eingetreten ? riskogründe[0]! : 'putsch:gerollt_abgewehrt',
        elite_zufriedenheit: elite,
        militaer_zufriedenheit: militaer,
        legitimitaet: state.legitimitaet,
        riskogründe: Object.freeze(riskogründe),
        gerollt: true,
        roll_wert: wurf.wert,
        putsch_eingetreten: eingetreten,
        rng: wurf.rng,
      });
    }

    default: {
      // Der Discriminator ist closed — dieser Zweig ist kaputte Regel-Struktur (z. B. ein
      // ungevalidierter Save), kein Spielzustand und kein Weiterspielen in Produktion: eine
      // Mechanik, die der Kern nicht kennt, kann nicht evaluiert werden (ADR-003).
      const kaput = variante as unknown as { typ?: unknown; regel_id?: unknown };
      throw new TypeError(
        `Wahl-Auswertung: unbekannter Variant-Typ "${String(kaput.typ)}" (regel_id=${String(kaput.regel_id)})`,
      );
    }
  }
}
