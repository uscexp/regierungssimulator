/**
 * core/ereignisse — deterministische Event-Auswahl (FR-007, Teil von US-M0-11).
 *
 * Events sind datengetriebene Regeln (Konzept §5/§6): Bedingung → Gewicht → Effekte. Der Kern kennt
 * die Struktur; die Regeln selbst sind Pack-Content (M2: Pandemie, Finanzkrise, Radikalisierung).
 *
 * Gewürfelt wird über den RNG **im State** (FR-004): `rngAt(seed, counter)` mit einem Zähler pro
 * Wurf, damit der Replay exakt ist und kein globaler Generator existiert. Keine Event-Regel kann
 * den State über 0–100 hinausziehen — Effekte laufen über `effektAnwenden`.
 */
import { effektAnwenden, type Modus } from './invariant.js';
import { nextFloat } from './rng.js';
import type { SchwierigkeitsPack } from './indikatoren.js';
import type { Effekt, GameState, GruppenTag, IndikatorTag, RngState } from './state.js';

/** Eine Bedingung, die erfüllt sein muss, damit das Event zur Auswahl zugelassen wird. */
export interface EreignisBedingung {
  readonly indikator?: { readonly tag: IndikatorTag; readonly min?: number; readonly max?: number };
  readonly gruppe?: {
    readonly tag: GruppenTag;
    readonly max_zufriedenheit?: number;
    readonly min_zufriedenheit?: number;
  };
  readonly schulden_min?: number;
  readonly radikalisierung_min?: number;
  readonly legitimitaet_max?: number;
}

/** Ein Event aus dem Content-Pack. `gewicht` ist das relative Auswahlgewicht. */
export interface EreignisRegel {
  readonly id: string;
  readonly gewicht: number;
  readonly bedingung?: EreignisBedingung;
  readonly effekte: readonly Effekt[];
}

/** Ein ausgelöstes Event — Identifier für News-Feed und Golden-Hash. */
export interface AusgelöstesEreignis {
  readonly ereignis_id: string;
  readonly effekte: readonly Effekt[];
}

export interface EreignisErgebnis {
  readonly ereignisse: readonly AusgelöstesEreignis[];
  /** Der RNG-Zustand nach allen Würfen — der Tick schreibt ihn in den Snapshot. */
  readonly rng: RngState;
}

/** Prüft, ob eine Event-Bedingung im Snapshot erfüllt ist. Eine fehlende Bedingung ist immer erfüllt. */
export function bedingungErfüllt(state: GameState, bedingung?: EreignisBedingung): boolean {
  if (bedingung === undefined) return true;

  if (bedingung.indikator !== undefined) {
    const level = state.indikatoren[bedingung.indikator.tag];
    if (level === undefined) return false;
    if (bedingung.indikator.min !== undefined && level < bedingung.indikator.min) return false;
    if (bedingung.indikator.max !== undefined && level > bedingung.indikator.max) return false;
  }

  if (bedingung.gruppe !== undefined) {
    const gruppe = state.gruppen.find((g) => g.tag === bedingung.gruppe!.tag);
    if (gruppe === undefined) return false;
    if (
      bedingung.gruppe.max_zufriedenheit !== undefined &&
      gruppe.zufriedenheit > bedingung.gruppe.max_zufriedenheit
    )
      return false;
    if (
      bedingung.gruppe.min_zufriedenheit !== undefined &&
      gruppe.zufriedenheit < bedingung.gruppe.min_zufriedenheit
    )
      return false;
  }

  if (bedingung.schulden_min !== undefined && state.schulden < bedingung.schulden_min) return false;
  if (
    bedingung.radikalisierung_min !== undefined &&
    state.radikalisierung < bedingung.radikalisierung_min
  )
    return false;
  if (bedingung.legitimitaet_max !== undefined && state.legitimitaet > bedingung.legitimitaet_max)
    return false;

  return true;
}

/**
 * Wählt höchstens `max_ereignisse` Events per Jahr, gewichtet über die erfüllten Regeln. Der
 * Schwierigkeits-Faktor skaliert die Anzahl — ein Pack kann damit Krisen dichter machen (G6).
 */
export function ereignisAuslosen(
  state: GameState,
  regeln: readonly EreignisRegel[],
  schwierigkeit: SchwierigkeitsPack,
  max_ereignisse = 1,
  modus: Modus = 'dev',
): EreignisErgebnis {
  // Ein kaputer Gewichtswert ist ein Content-Fehler: im Dev-Modus wirft er mit Regel-Id, im
  // Produktionsmodus wird die Regel aus den Kandidaten entfernt und der Tick läuft weiter (FR-002).
  const kandidaten = regeln
    .filter((r) => bedingungErfüllt(state, r.bedingung))
    .filter((r) => {
      if (!Number.isFinite(r.gewicht) || r.gewicht <= 0) {
        if (modus === 'dev') {
          throw new TypeError(
            `Event-Regel "${r.id}" hat kein positives endliches Gewicht (${String(r.gewicht)})`,
          );
        }
        return false;
      }
      return true;
    });
  let rng = state.rng;
  const ereignisse: AusgelöstesEreignis[] = [];

  const anzahl = Math.max(0, Math.round(max_ereignisse * schwierigkeit.event_wahrscheinlichkeit));
  for (let wurf = 0; wurf < anzahl; wurf++) {
    if (kandidaten.length === 0) break;

    let summe = 0;
    for (const regel of kandidaten) summe += regel.gewicht;
    if (summe === 0) break;

    // Ein Wurf pro Jahr-Schritt; der RNG-Zustand wird durchgereicht, kein globaler Generator (FR-004).
    const gewurf = nextFloat(rng);
    rng = gewurf.rng;

    let schwelle = 0;
    let gewählt: EreignisRegel | undefined;
    for (const regel of kandidaten) {
      schwelle += regel.gewicht;
      if (gewurf.wert * summe < schwelle) {
        gewählt = regel;
        break;
      }
    }
    if (gewählt === undefined) gewählt = kandidaten[kandidaten.length - 1]!;

    ereignisse.push({ ereignis_id: gewählt.id, effekte: gewählt.effekte });
  }

  return { ereignisse, rng };
}

/**
 * Wendet Effekt-Deltas auf den Snapshot an — alle Ziele über `effektAnwenden`, damit der Clamp und
 * die Regel-Id überall gleich sind (FR-002). Der alte Snapshot wird nicht mutiert (ADR-002).
 * `quell_id` ist der Ursprung (Event- oder Karten-Id) und landet im Fehlerfall im Log.
 *
 * Indikator-Deltas werden **nicht** angewendet: die Indikatorbewegung rechnet der Tick in einem
 * Schritt mit Budget und Deltas zusammen (Konzept §2A), sonst zählt ein Delta zweimal.
 */
export function effekteAnwenden(
  state: GameState,
  effekte: readonly Effekt[],
  quell_id: string,
  modus: Modus = 'dev',
): GameState {
  let gruppen = state.gruppen;
  let legitimitaet = state.legitimitaet;
  let radikalisierung = state.radikalisierung;
  let politisches_kapital = state.politisches_kapital;
  const budget: Record<string, number> = { ...state.budget };

  for (const effekt of effekte) {
    switch (effekt.ziel) {
      case 'gruppen': {
        if (effekt.tag === undefined) break;
        if (!gruppen.some((g) => g.tag === effekt.tag)) {
          // Ein Effekt auf eine Gruppe, die im Snapshot nicht existiert, ist ein Content-Fehler:
          // im Dev-Modus wirft er mit Quell-Id, im Produktionsmodus wird er übersprungen (FR-002).
          if (modus === 'dev') {
            throw new TypeError(`Effekt "${quell_id}" zielt auf unbekannte Gruppe "${effekt.tag}"`);
          }
          break;
        }
        gruppen = gruppen.map((g) =>
          g.tag === effekt.tag
            ? Object.freeze({
                ...g,
                zufriedenheit: effektAnwenden(g.zufriedenheit, effekt.delta, `${quell_id}`, modus),
              })
            : g,
        );
        break;
      }
      case 'legitimitaet':
        legitimitaet = effektAnwenden(legitimitaet, effekt.delta, quell_id, modus);
        break;
      case 'radikalisierung':
        radikalisierung = effektAnwenden(radikalisierung, effekt.delta, quell_id, modus);
        break;
      case 'politisches_kapital':
        // PK hat seine eigene Grenze (12) — nicht die Level-Grenze 0–100.
        politisches_kapital = Math.min(12, Math.max(0, politisches_kapital + effekt.delta));
        break;
      case 'budget':
        if (effekt.tag !== undefined) budget[effekt.tag] = (budget[effekt.tag] ?? 0) + effekt.delta;
        break;
      case 'indikatoren':
        break; // siehe Doc: der Tick rechnet Indikator-Deltas im Bewegungsschritt
    }
  }

  return Object.freeze({
    ...state,
    gruppen: Object.freeze(gruppen),
    legitimitaet,
    radikalisierung,
    politisches_kapital,
    budget: Object.freeze(budget),
  }) as GameState;
}

/** Wendet die Effekte eines ausgelösten Events an — dieselbe Funktion wie für Karten (§2A/§4). */
export function ereignisAnwenden(
  state: GameState,
  ereignisse: readonly AusgelöstesEreignis[],
  modus: Modus = 'dev',
): GameState {
  let aktuell = state;
  for (const ereignis of ereignisse) {
    aktuell = effekteAnwenden(aktuell, ereignis.effekte, `event:${ereignis.ereignis_id}`, modus);
  }
  return aktuell;
}

/** Indikator-Deltas aller Events, nach Tag — Eingabe für das Bewegungsschritt des Ticks. */
export function ereignisIndikatorDeltas(
  ereignisse: readonly AusgelöstesEreignis[],
): Readonly<Record<IndikatorTag, number>> {
  const deltas: Record<string, number> = {};
  for (const ereignis of ereignisse) {
    for (const effekt of ereignis.effekte) {
      if (effekt.ziel === 'indikatoren' && effekt.tag !== undefined) {
        deltas[effekt.tag] = (deltas[effekt.tag] ?? 0) + effekt.delta;
      }
    }
  }
  return deltas;
}
