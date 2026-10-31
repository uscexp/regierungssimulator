/**
 * core/setup — die Setup-Phase vor Turn 1 (US-M1-02, FR-015/047, Verdikt D22).
 *
 * Der Gate ist eine **Datenregel im Kern**, keine Adapter-Entscheidung: `setup_pflicht` kommt aus dem
 * geladenen Regelsatz (das Register des Packs), damit zwei Adapter bei identischen Regeln identisch
 * gate'en (ADR-002 — derselbe Grund wie D20 gegen injizierte Verhalten). Ein Adapter darf den Flag
 * nicht selbst setzen.
 *
 * `GameState.setup` ist optional und wird nur bei gesetztem Setup serialisiert — die kanonische
 * M0-Serialisierung bleibt bitgleich (Haui-Ruling: Replay/Spread/Kurven ohne Diff). Ein Pflichtfeld
 * über `schema_version` 2 wäre ein Umbenennen der M0-Referenz und ist verworfen (D22).
 *
 * `setupAnwenden` ist eine pure Funktion und validiert die Konstitutions-Ids **gegen das geladene
 * Register**, bevor der Snapshot geschrieben wird — atomisch wie die Pack-Validierung (ADR-003): ein
 * kaputer Setup erzeugt nie einen halb gesetzten State. Die Regierungsform nutzt das bestehende
 * `regierung`-Enum aus `core/rules.ts` (§3b/D20), kein zweites Vokabular.
 */
import { REGIERUNGSFORMEN, STEUERMODELLE, type Regierungsform } from './rules.js';
import { freezeSnapshot, type GameState, type Konstitution, type SetupPhase } from './state.js';

/** Die Setup-Pflicht eines Packs — die Ids, die die Konstitution enthalten muss (aus dem Register). */
export interface SetupPflicht {
  readonly konstitutions_ids: readonly string[];
}

/** Die Setup-Aktion des Spielers: Form + die gewählten Konstitutions-Entscheidungen. */
export interface SetupAktion {
  readonly regierungsform: Regierungsform;
  readonly konstitutions_ids: readonly string[];
  /** Die Werte der Konstitution (regel_id → Wert); `steuermodell` ist eines der vier Modelle. */
  readonly konstitution?: Konstitution;
}

/**
 * Wendet den Setup an und gibt einen frisch eingefrorenen Snapshot zurück. Wirft mit Feldnamen, wenn
 * die Form unbekannt ist, eine Id nicht im Register steht, Ids doppelt sind oder das Steuermodell
 * nicht zum Enum gehört — ein kaputer Setup ist Spieler-Eingabe, kein Pack-Fehler, und wirft immer.
 */
export function setupAnwenden(
  state: GameState,
  aktion: SetupAktion,
  pflicht: SetupPflicht,
): GameState {
  if (!REGIERUNGSFORMEN.includes(aktion.regierungsform)) {
    throw new TypeError(
      `Setup: regierungsform "${aktion.regierungsform}" ist unbekannt — bekannt sind ${REGIERUNGSFORMEN.join(', ')}`,
    );
  }

  const ids = aktion.konstitutions_ids;
  if (ids.length === 0) {
    throw new TypeError(
      'Setup: konstitutions_ids ist leer — die Konstitution muss eine Entscheidung haben',
    );
  }
  if (new Set(ids).size !== ids.length) {
    throw new TypeError('Setup: konstitutions_ids enthält Duplikate');
  }
  for (const id of ids) {
    if (!pflicht.konstitutions_ids.includes(id)) {
      throw new TypeError(
        `Setup: konstitutions_id "${id}" ist nicht im geladenen Register — das Register liefert die Ids, der Kern nicht`,
      );
    }
  }

  const steuermodellWert = aktion.konstitution?.steuermodell;
  if (
    steuermodellWert !== undefined &&
    !STEUERMODELLE.some((modell) => modell === steuermodellWert)
  ) {
    throw new TypeError(
      `Setup: steuermodell "${String(steuermodellWert)}" ist unbekannt — bekannt sind ${STEUERMODELLE.join(', ')}`,
    );
  }

  const setup: SetupPhase = Object.freeze({
    regierungsform: aktion.regierungsform,
    konstitutions_ids: Object.freeze([...ids]),
  });
  const konstitution = Object.freeze({ ...state.konstitution, ...(aktion.konstitution ?? {}) });
  return freezeSnapshot({ ...state, setup, konstitution }) as GameState;
}

/** true, wenn der Setup vollständig ist: Form gesetzt und alle Pflicht-Ids der Konstitution gewählt. */
export function setupVollständig(state: GameState, pflicht: SetupPflicht): boolean {
  const setup = state.setup;
  if (setup === undefined) return false;
  return pflicht.konstitutions_ids.every((id) => setup.konstitutions_ids.includes(id));
}

/**
 * Der Grund, warum ein Turn abgewiesen werden muss — `undefined` heißt: der Turn ist erlaubt. Ein
 * Pack ohne Setup-Pflicht gate't nie (der M0-Harness spielt ohne Setup, D22).
 */
export function setupAbweisung(
  state: GameState,
  pflicht: SetupPflicht | undefined,
): string | undefined {
  if (pflicht === undefined) return undefined;
  const setup = state.setup;
  if (setup === undefined) {
    return 'Setup fehlt: die Regierungsform ist nicht gesetzt und die Konstitution nicht gewählt — Turn 1 ist erst danach möglich';
  }
  const fehlend = pflicht.konstitutions_ids.filter((id) => !setup.konstitutions_ids.includes(id));
  if (fehlend.length > 0) {
    return `Konstitution unvollständig: ${fehlend.join(', ')} fehlt — Turn 1 ist erst nach der Konstitution möglich`;
  }
  return undefined;
}
