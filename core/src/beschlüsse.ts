/**
 * core/beschlüsse — das Entscheidungsgedächtnis (FR-006, US-M0-08).
 *
 * Ein Beschluss wirkt drei Jahre und fällt dann aus dem State (Konzept §5: "Beschlüsse wirken
 * drei Jahre, danach sinkt der Effekt"). Das Gedächtnis ist eine **Liste im Snapshot**, keine
 * versteckte Engine: der Golden-Replay-Test (US-M0-16) prüft damit den exakten Active-Bestand.
 *
 * Die Wirkungswerte sind Content (Karten, M3) — der Kern kennt nur Ziel, Tag und Delta.
 */
import type { AktiverBeschluss, Effekt, GameState, GruppenTag, IndikatorTag } from './state.js';

/** Standard-Wirkdauer aus Konzept §5. Karten können sie überschreiben (Content). */
export const BESCHLUSS_WIRKDAUER = 3;

/**
 * Ein Beschluss wird in den Snapshot geschrieben. Jahr der Wirkung ist das aktuelle Jahr des
 * States; die Dauer ist inklusive (Beschluss in Jahr 1 wirkt bis Jahr 3). Nicht-endliche Deltas
 * werden mit Regel-Id abgewiesen (FR-002).
 */
export function beschlussEintragen(
  state: GameState,
  beschluss: {
    readonly regel_id: string;
    readonly wirkung: readonly Effekt[];
    readonly wirkdauer_jahre?: number;
  },
): GameState {
  const dauer = beschluss.wirkdauer_jahre ?? BESCHLUSS_WIRKDAUER;
  if (!Number.isFinite(dauer) || dauer < 1) {
    throw new TypeError(
      `Beschluss "${beschluss.regel_id}": wirkdauer_jahre ist nicht >= 1 (${String(dauer)})`,
    );
  }

  for (const effekt of beschluss.wirkung) {
    if (!Number.isFinite(effekt.delta)) {
      throw new TypeError(
        `Beschluss "${beschluss.regel_id}": Delta ist nicht endlich (${String(effekt.delta)})`,
      );
    }
  }

  const eintrag: AktiverBeschluss = Object.freeze({
    regel_id: beschluss.regel_id,
    wirkung: Object.freeze(beschluss.wirkung.map((e) => Object.freeze({ ...e }))),
    wirkdauer_jahre: dauer,
    wirkt_bis_jahr: state.jahr + dauer - 1,
  });

  return Object.freeze({
    ...state,
    beschlüsse: Object.freeze([...state.beschlüsse, eintrag]),
  }) as GameState;
}

/** Beschlüsse, die im aktuellen Jahr noch wirken — ein abgelaufener Beschluss wirkt nie mehr. */
export function aktiveBeschlüsse(state: GameState): readonly AktiverBeschluss[] {
  return state.beschlüsse.filter((b) => b.wirkt_bis_jahr >= state.jahr);
}

/**
 * Entfernt Beschlüsse, deren letztes Wirkjahr vorbei ist. Wird am Jahresende nach der
 * Jahressteigerung gerufen, also auf dem State des **neuen** Jahres: ein Beschluss mit
 * `wirkt_bis_jahr === jahr` wirkt in diesem Jahr noch und fällt erst danach raus (AC US-M0-08).
 * Der Prädikat ist identisch zu `aktiveBeschlüsse` — das Gedächtnis ist eine Liste, kein Zustand
 * zweiter Klasse.
 */
export function beschlüssePrunen(state: GameState): GameState {
  const gehalten = state.beschlüsse.filter((b) => b.wirkt_bis_jahr >= state.jahr);
  if (gehalten.length === state.beschlüsse.length) return state;
  return Object.freeze({ ...state, beschlüsse: Object.freeze(gehalten) }) as GameState;
}

/**
 * Aggregierte Effekt-Deltas aller aktiven Beschlüsse, nach Ziel gruppiert. Indikatoren und Gruppen
 * kommen als Tag → Delta; Skalar-Ziele als Summe. Der Tick wendet sie über `effektAnwenden` an,
 * damit der Clamp und die Regel-Id überall gleich bleiben.
 */
export function effekteAusBeschlüsse(state: GameState): {
  readonly indikatoren: Readonly<Record<IndikatorTag, number>>;
  readonly gruppen: Readonly<Record<GruppenTag, number>>;
  readonly legitimitaet: number;
  readonly radikalisierung: number;
  readonly politisches_kapital: number;
  readonly budget: Readonly<Record<IndikatorTag, number>>;
} {
  const indikatoren: Record<string, number> = {};
  const gruppen: Record<string, number> = {};
  const budget: Record<string, number> = {};
  let legitimitaet = 0;
  let radikalisierung = 0;
  let politisches_kapital = 0;

  for (const beschluss of aktiveBeschlüsse(state)) {
    for (const effekt of beschluss.wirkung) {
      switch (effekt.ziel) {
        case 'indikatoren':
          if (effekt.tag !== undefined)
            indikatoren[effekt.tag] = (indikatoren[effekt.tag] ?? 0) + effekt.delta;
          break;
        case 'gruppen':
          if (effekt.tag !== undefined)
            gruppen[effekt.tag] = (gruppen[effekt.tag] ?? 0) + effekt.delta;
          break;
        case 'budget':
          if (effekt.tag !== undefined)
            budget[effekt.tag] = (budget[effekt.tag] ?? 0) + effekt.delta;
          break;
        case 'legitimitaet':
          legitimitaet += effekt.delta;
          break;
        case 'radikalisierung':
          radikalisierung += effekt.delta;
          break;
        case 'politisches_kapital':
          politisches_kapital += effekt.delta;
          break;
      }
    }
  }

  return { indikatoren, gruppen, budget, legitimitaet, radikalisierung, politisches_kapital };
}
