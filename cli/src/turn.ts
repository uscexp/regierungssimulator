/**
 * @staatslenker/cli turn — der Terminal-Turn (US-M0-14, FR-048).
 *
 * Ein Turn ist: Lagebericht → Budget verteilen → Basis-Entscheidung wählen → `tick` → Lagebericht →
 * Machtcheck. Der Adapter rechnet nichts selbst: die Bewegung macht `core/tick`, die Entscheidung
 * wird als Beschluss ins Gedächtnis geschrieben (FR-006/FR-009) und ihre Wirkung läuft über die
 * `budget_wirkung` des Indikators im Bewegungsschritt (PO D10). Karten gibt es in M0 nicht
 * (Konzept §10, Karten sind M3) — der Karten-Schritt existiert in diesem Loop nicht.
 *
 * Unerwartete Eingabe hat ein definiertes Verhalten: jede ungültige Eingabe wirft einen Grund, den
 * der REPL dem Spieler zeigt und dann erneut fragt. Ein illegaler Action crasht das Spiel nie.
 */
import { BASIS_ENTSCHEIDUNGEN, type BasisEntscheidung } from '@staatslenker/content-base';
import type { GameState } from '@staatslenker/core/state';
import { tick, type TickErgebnis, type TickRegeln } from '@staatslenker/core/tick';
import type { Modus } from '@staatslenker/core/invariant';
import { lagebericht } from './lagebericht.js';

/** Die Eingabe eines Spielers für ein Jahr: Allokationen in BE und eine Basis-Entscheidung. */
export interface TurnEingabe {
  readonly zuteilung: Readonly<Record<string, number>>;
  readonly entscheidung_id: string;
}

/** Das Ergebnis eines Turns — Snapshot, Entscheidung und die beiden Berichte (US-M0-15). */
export interface TurnErgebnis {
  readonly ergebnis: TickErgebnis;
  readonly entscheidung: BasisEntscheidung;
  readonly lagebericht_vorher: string;
  readonly lagebericht_nach: string;
  /** true, wenn der Machtcheck verloren wurde — das Spiel endet (FR-013, US-M0-12). */
  readonly spielende: boolean;
}

/** Die Kategorien, die per Budget unterhaltbar sind (§2: `budget_wirkung > 0`). */
export function budgetbareKategorien(regeln: TickRegeln): readonly string[] {
  return regeln.indikator_regeln.filter((r) => r.budget_wirkung > 0).map((r) => r.tag);
}

/** Die Basis-Entscheidungen des Packs (PO D10) — fünf Budget-Allokationen, keine Karten. */
export function entscheidungen(): readonly BasisEntscheidung[] {
  return BASIS_ENTSCHEIDUNGEN;
}

export function entscheidungAusId(id: string): BasisEntscheidung | undefined {
  return BASIS_ENTSCHEIDUNGEN.find((e) => e.regel_id === id);
}

/**
 * Prüft eine Eingabe gegen den Pack und den State. Rückgabe statt Wurf, damit der REPL den Grund
 * zeigen und neu fragen kann, ohne dass ein Tippfehler das Spiel beendet.
 */
export function prüfeEingabe(
  state: GameState,
  regeln: TickRegeln,
  eingabe: TurnEingabe,
): { readonly ok: true } | { readonly ok: false; readonly grund: string } {
  const entscheidung = entscheidungAusId(eingabe.entscheidung_id);
  if (entscheidung === undefined) {
    return {
      ok: false,
      grund: `Unbekannte Entscheidung "${eingabe.entscheidung_id}" — zur Wahl stehen: ${entscheidungen()
        .map((e) => e.regel_id)
        .join(', ')}`,
    };
  }

  const kategorien = new Set(regeln.indikator_regeln.map((r) => r.tag));
  const budgetbar = new Set(budgetbareKategorien(regeln));

  for (const [tag, be] of Object.entries(eingabe.zuteilung)) {
    if (!kategorien.has(tag)) {
      return {
        ok: false,
        grund: `Unbekannte Kategorie "${tag}" — das Pack kennt: ${[...kategorien].join(', ')}`,
      };
    }
    if (!Number.isFinite(be) || be < 0) {
      return {
        ok: false,
        grund: `Allokation auf "${tag}" ist nicht endlich oder negativ (${String(be)})`,
      };
    }
    if (!budgetbar.has(tag)) {
      return {
        ok: false,
        grund: `Kategorie "${tag}" ist nicht per Budget unterhaltbar (balance-werte.md §2: budget_wirkung 0) — eine Allokation dort wäre verbranntes Budget`,
      };
    }
  }

  const beAufIndikator = eingabe.zuteilung[entscheidung.indikator] ?? 0;
  if (beAufIndikator < 1) {
    return {
      ok: false,
      grund: `Entscheidung "${entscheidung.regel_id}" verlangt mindestens 1 BE auf "${entscheidung.indikator}" (ist ${String(beAufIndikator)})`,
    };
  }

  if (state.politisches_kapital < entscheidung.pk_kosten) {
    return {
      ok: false,
      grund: `Entscheidung "${entscheidung.regel_id}" kostet ${entscheidung.pk_kosten} politisches Kapital — verfügbar sind ${state.politisches_kapital}`,
    };
  }

  return { ok: true };
}

/**
 * Ein Turn: `tick` mit der Allokation und der gewählten Basis-Entscheidung als Beschluss.
 * Wirft nur, wenn die Eingabe vorher nicht geprüft wurde (`prüfeEingabe` ist der Weg des REPLs);
 * der Wurf nennt denselben Grund wie die Prüfung.
 */
export function turn(
  state: GameState,
  regeln: TickRegeln,
  eingabe: TurnEingabe,
  modus: Modus = 'dev',
): TurnErgebnis {
  const prüfung = prüfeEingabe(state, regeln, eingabe);
  if (!prüfung.ok) throw new TypeError(`Turn: ${prüfung.grund}`);

  const entscheidung = entscheidungAusId(eingabe.entscheidung_id)!;
  const lagebericht_vorher = lagebericht(state, regeln);

  // Die Basis-Entscheidung ist eine Budget-Allokation ohne Karte (PO D10, PO-Ruling zu US-M0-14):
  // keine PK-Kosten, keine Wirkungseinträge. Der Tick schreibt sie als Beschluss ins Gedächtnis —
  // sichtbar für Spieler, Debugging und Replay — die Bewegung macht die `budget_wirkung` des
  // Indikators im Bewegungsschritt.
  const ergebnis = tick(
    state,
    { zuteilung: eingabe.zuteilung, budget_allokation: { regel_id: entscheidung.regel_id } },
    regeln,
    modus,
  );

  const lagebericht_nach = lagebericht(ergebnis.state, regeln, {
    vorher: state,
    ergebnis,
    wahl_jahr: state.jahr,
    gekuerzte_be: ergebnis.gekuerzte_be,
  });

  return Object.freeze({
    ergebnis,
    entscheidung,
    lagebericht_vorher,
    lagebericht_nach,
    spielende: ergebnis.state.wahl_niederlage !== undefined,
  });
}

/**
 * Die nicht-interaktive Demonstration (CI-Boot, Quality-Gate "ein Build bootet und ist spielbar"):
 * `jahre` Turns mit einer gleichmäßigen Allokation (§11-Anker „gleichmäßig investieren", 2 BE je
 * budgetbarer Kategorie) und der ersten Basis-Entscheidung. Deterministisch über den Seed im State
 * (FR-004); endet beim verlorenen Machtcheck.
 */
export function demonstration(
  seed: number,
  schwierigkeit: 'leicht' | 'normal' | 'schwer',
  jahre: number,
  regeln: TickRegeln,
  startState: (seed: number) => GameState,
): readonly string[] {
  const gleichmaessig: Readonly<Record<string, number>> = Object.fromEntries(
    budgetbareKategorien(regeln).map((tag) => [tag, 2]),
  );
  const entscheidung_id = entscheidungen()[0]!.regel_id;

  let state = startState(seed);
  const zeilen: string[] = [];
  for (let jahr = 1; jahr <= jahre; jahr++) {
    const ergebnis = turn(state, regeln, { zuteilung: gleichmaessig, entscheidung_id });
    zeilen.push(ergebnis.lagebericht_vorher);
    zeilen.push(
      `Entscheidung: ${ergebnis.entscheidung.regel_id} — ${ergebnis.entscheidung.beschreibung}`,
    );
    zeilen.push(ergebnis.lagebericht_nach);
    state = ergebnis.ergebnis.state;
    if (ergebnis.spielende) {
      // Das Spiel endet mit dem Machtcheck — die Demo sagt, wie viele Jahre gespielt wurden.
      zeilen.push(`Ende nach ${jahr} Jahren (Machtcheck verloren).`);
      break;
    }
  }
  return zeilen;
}
