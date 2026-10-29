/**
 * core/wahl — der Machtcheck (FR-013, US-M0-12, PO D12).
 *
 * Die Wahl ist eine reine Funktion über dem Snapshot. Beide Schwellen sind **Daten** aus dem
 * Content-Pack, keine Kern-Konstanten: der Kern kennt nur die Struktur des Unruhe-Gates. Verloren
 * ist die Wahl, wenn eine der beiden Bedingungen fehlt — die einfache Regel "gewichtete Ø ≥ 50"
 * wäre mit den renormierten M0-Gruppen dominant (Ø fällt nie unter 50), deshalb verlangt der Gate
 * zusätzlich die Zufriedenheit der schwächsten Gruppe. Die Ø-Berechnung kommt aus
 * `core/zufriedenheit`: eine Formel, eine Instanz.
 */
import { gewichteteZufriedenheit } from './zufriedenheit.js';
import type { GruppenSnapshot } from './state.js';

/** Die Wahlregel eines Packs: Zyklus und beide Schwellen als Content-Werte. */
export interface Wahlregel {
  /** Intervall in Jahren — M0: alle 4 Jahre (AC US-M0-12). */
  readonly intervall_jahre: number;
  /** Schwelle der gewichteten Ø-Zufriedenheit (D12: 50). */
  readonly gewichtete_min: number;
  /** Schwelle der schwächsten Gruppe, der Unruhe-Gate (D12: 35). */
  readonly schwächste_min: number;
}

export interface Wahlprüfung {
  readonly gewonnen: boolean;
  /** Regel-Id der fehlenden Bedingung; im Gewinnfall die Id der Regel selbst. */
  readonly grund_id: string;
  readonly gewichtete_zufriedenheit: number;
  readonly schwächste_gruppe: string;
}

/** Die schwächste Gruppe nach Zufriedenheit — der Gate prüft sie, nicht den Durchschnitt. */
export function schwächsteGruppe(gruppen: readonly GruppenSnapshot[]): GruppenSnapshot | undefined {
  if (gruppen.length === 0) return undefined;
  return gruppen.reduce((schwächste, gruppe) =>
    gruppe.zufriedenheit < schwächste.zufriedenheit ? gruppe : schwächste,
  );
}

/** Prüft, ob in diesem Jahr ein Machtcheck läuft (Jahr modulo Intervall, Jahr 1 ist Startjahr). */
export function wahlJahr(jahr: number, regel: Wahlregel): boolean {
  return regel.intervall_jahre > 0 && jahr % regel.intervall_jahre === 0;
}

/**
 * Der Machtcheck. `grund_id` nennt die Bedingung, die fehlt — das ist die Spielende-Ursache
 * "Wahl verloren" im CLI (US-M0-14) und Teil des Replay-Hashes (ADR-008).
 */
export function wahlPrüfen(gruppen: readonly GruppenSnapshot[], regel: Wahlregel): Wahlprüfung {
  const schwächste = schwächsteGruppe(gruppen);
  const gewichtete = gewichteteZufriedenheit(gruppen);

  if (schwächste === undefined) {
    return {
      gewonnen: false,
      grund_id: 'wahl:keine_gruppen',
      gewichtete_zufriedenheit: 0,
      schwächste_gruppe: '',
    };
  }

  if (gewichtete < regel.gewichtete_min) {
    return {
      gewonnen: false,
      grund_id: 'wahl:gewichtete_unter_50',
      gewichtete_zufriedenheit: gewichtete,
      schwächste_gruppe: schwächste.tag,
    };
  }
  if (schwächste.zufriedenheit < regel.schwächste_min) {
    return {
      gewonnen: false,
      grund_id: 'wahl:schwächste_unter_35',
      gewichtete_zufriedenheit: gewichtete,
      schwächste_gruppe: schwächste.tag,
    };
  }

  return {
    gewonnen: true,
    grund_id: 'wahl:gewonnen',
    gewichtete_zufriedenheit: gewichtete,
    schwächste_gruppe: schwächste.tag,
  };
}

/** Adapter für den Tick: die Regel wird als Callback gereicht, damit der Tick keinen Content liest. */
export function wahlRegelAlsPrüfung(
  regel: Wahlregel,
): (gruppen: readonly GruppenSnapshot[], jahr: number) => Wahlprüfung {
  return (gruppen, jahr) =>
    wahlJahr(jahr, regel)
      ? wahlPrüfen(gruppen, regel)
      : {
          gewonnen: true,
          grund_id: 'wahl:kein_wahljahr',
          gewichtete_zufriedenheit: gewichteteZufriedenheit(gruppen),
          schwächste_gruppe: schwächsteGruppe(gruppen)?.tag ?? '',
        };
}

/** Die M0-Wahlregel aus D12 — Werte sind Content, hier als Referenz für Fixtures und den CLI. */
export const WAHLREGEL_M0: Wahlregel = Object.freeze({
  intervall_jahre: 4,
  gewichtete_min: 50,
  schwächste_min: 35,
});
