/**
 * core/wahl-eval.test — die AC zu US-M1-11 (FR-013/FR-014/FR-016): die drei closed Wahl-Varianten des
 * Registers werden als reine Daten ausgewertet. Die Regel-Objekte sind **local** — der Kern importiert
 * kein Content (ADR-002) — aber ihre Werte spiegeln das Register aus `content/base` (wahl_basis:
 * Zyklus 6, Ø 47, schwächste 35, D18) und die Kanon-Beispiele aus `core/rules.test` (mehrheit 0.5,
 * putsch 40/35/30 mit Wahrscheinlichkeit 0.3).
 */
import { describe, expect, it } from 'vitest';

import {
  wahlAuswerten,
  type AuswertungParlamentmehrheit,
  type AuswertungPraesidentialwahl,
  type AuswertungPutschRoll,
} from '@staatslenker/core/wahl-eval';
import { erzeugeGameState, type GruppenSnapshot, type GameState } from '@staatslenker/core/state';
import type { Modus } from '@staatslenker/core/invariant';
import type { WahlregelVariant } from '@staatslenker/core/rules';

const gruppe = (tag: string, zufriedenheit: number, anteil: number): GruppenSnapshot =>
  Object.freeze({ tag, zufriedenheit, bevölkerungsanteil: anteil, gewichte: {} });

/** Die D18-Wahlregel des Basis-Registers (content/base `wahl_basis`) — Werte, nicht Kern-Zahlen. */
const praesidentialwahl = {
  typ: 'praesidentialwahl',
  regel_id: 'wahl_basis',
  intervall_jahre: 6,
  gewichtete_min: 47,
  schwächste_min: 35,
} as const satisfies WahlregelVariant;

const parlamentmehrheit = {
  typ: 'parlamentmehrheit',
  regel_id: 'regel_mehrheit',
  mehrheit: 0.5,
} as const satisfies WahlregelVariant;

const putschRoll = {
  typ: 'putsch_roll',
  regel_id: 'regel_putsch',
  elite_min: 40,
  militaer_min: 35,
  legitimitaet_min: 30,
  wahrscheinlichkeit: 0.3,
} as const satisfies WahlregelVariant;

type PraesVariante = Extract<WahlregelVariant, { typ: 'praesidentialwahl' }>;
type MehrheitVariante = Extract<WahlregelVariant, { typ: 'parlamentmehrheit' }>;
type PutschVariante = Extract<WahlregelVariant, { typ: 'putsch_roll' }>;

/** Der Discriminator der Variante bestimmt den Typ der Auswertung — die Guards holen ihn zurück. */
function alsPraesidential(variante: PraesVariante, state: GameState) {
  const aus = wahlAuswerten(variante, state);
  if (aus !== undefined && aus.typ !== 'praesidentialwahl') {
    throw new Error(`erwartet eine praesidentialwahl-Auswertung, bekam ${aus.typ}`);
  }
  return aus as AuswertungPraesidentialwahl | undefined;
}
function alsMehrheit(variante: MehrheitVariante, state: GameState): AuswertungParlamentmehrheit {
  const aus = wahlAuswerten(variante, state);
  if (aus === undefined || aus.typ !== 'parlamentmehrheit') {
    throw new Error('erwartet eine parlamentmehrheit-Auswertung');
  }
  return aus;
}
function alsPutsch(variante: PutschVariante, state: GameState, modus: Modus): AuswertungPutschRoll {
  const aus = wahlAuswerten(variante, state, modus);
  if (aus === undefined || aus.typ !== 'putsch_roll') {
    throw new Error('erwartet eine putsch_roll-Auswertung');
  }
  return aus;
}

/** Ein Minimal-Snapshot — die Auswertung braucht nur gruppen, jahr, legitimitaet und rng. */
function state(
  overrides: Partial<Pick<GameState, 'jahr' | 'gruppen' | 'legitimitaet' | 'rng'>> = {},
): GameState {
  return erzeugeGameState({
    jahr: overrides.jahr ?? 1,
    indikatoren: {},
    gruppen: overrides.gruppen ?? [],
    budget: {},
    politisches_kapital: 5,
    legitimitaet: overrides.legitimitaet ?? 60,
    schulden: 0,
    radikalisierung: 0,
    rng: overrides.rng ?? { seed: 42, counter: 0 },
    konstitution: {},
    zufriedenheits_trace: {},
  });
}

/** fixtureA/fixtureB aus AC US-M0-12, gegen die Register-Schwellen 47/35 gerechnet. */
const stabileGruppen: readonly GruppenSnapshot[] = [
  gruppe('unternehmen', 55, 21.3),
  gruppe('arbeitnehmer', 52, 51.1),
  gruppe('bildung_jugend', 45, 27.7),
];
const unruhigeGruppen: readonly GruppenSnapshot[] = [
  gruppe('unternehmen', 62, 21.3),
  gruppe('arbeitnehmer', 58, 51.1),
  gruppe('bildung_jugend', 34.7, 27.7),
];

const elite = (zufriedenheit: number): GruppenSnapshot => gruppe('elite', zufriedenheit, 10);
const militaer = (zufriedenheit: number): GruppenSnapshot => gruppe('militaer', zufriedenheit, 10);

describe('core/wahl-eval — Präesidentialwahl als Daten-Auswertung (FR-013)', () => {
  it('Nicht-Wahljahre liefern undefined, kein erfundenes Ergebnis (Lens-Fund zu PR #12)', () => {
    expect(
      wahlAuswerten(praesidentialwahl, state({ jahr: 1, gruppen: stabileGruppen })),
    ).toBeUndefined();
    expect(
      wahlAuswerten(praesidentialwahl, state({ jahr: 5, gruppen: stabileGruppen })),
    ).toBeUndefined();
    expect(
      wahlAuswerten(praesidentialwahl, state({ jahr: 7, gruppen: stabileGruppen })),
    ).toBeUndefined();
  });

  it('das Wahljahr prüft den Gate: alle ≥ 35 und Ø ≥ 47 ist gewonnen (AC)', () => {
    const aus = alsPraesidential(praesidentialwahl, state({ jahr: 6, gruppen: stabileGruppen }))!;
    expect(aus.gewonnen).toBe(true);
    expect(aus.grund_id).toBe('wahl:gewonnen');
    expect(aus.gewichtete_zufriedenheit).toBeGreaterThanOrEqual(47);
    expect(aus.schwächste_zufriedenheit).toBeGreaterThanOrEqual(35);
    expect(aus.schwächste_gruppe).toBe('bildung_jugend');
  });

  it('verlorene Wahl mit Unruhe-Gate: grund_id nennt die Schwelle der Regel (wahl:schwächste_unter_35)', () => {
    const aus = alsPraesidential(praesidentialwahl, state({ jahr: 6, gruppen: unruhigeGruppen }))!;
    expect(aus.gewonnen).toBe(false);
    expect(aus.grund_id).toBe('wahl:schwächste_unter_35');
    expect(aus.gewichtete_zufriedenheit).toBeGreaterThanOrEqual(47);
  });

  it('verlorene Wahl mit unterlaufener Ø-Schwelle: grund_id ist wahl:gewichtete_unter_47', () => {
    const armeGruppen = [gruppe('arbeitnehmer', 45, 100)];
    const aus = alsPraesidential(praesidentialwahl, state({ jahr: 6, gruppen: armeGruppen }))!;
    expect(aus.gewonnen).toBe(false);
    expect(aus.grund_id).toBe('wahl:gewichtete_unter_47');
  });

  it('die Schwellen sind inklusiv: genau die gerechneten Werte sind gewonnen, +0.01 verloren', () => {
    const reale = alsPraesidential(praesidentialwahl, state({ jahr: 6, gruppen: stabileGruppen }))!;
    const knapp: PraesVariante = {
      ...praesidentialwahl,
      gewichtete_min: reale.gewichtete_zufriedenheit,
      schwächste_min: reale.schwächste_zufriedenheit,
    };
    expect(alsPraesidential(knapp, state({ jahr: 6, gruppen: stabileGruppen }))?.gewonnen).toBe(
      true,
    );
    expect(
      alsPraesidential(
        { ...knapp, gewichtete_min: reale.gewichtete_zufriedenheit + 0.01 },
        state({ jahr: 6, gruppen: stabileGruppen }),
      )?.gewonnen,
    ).toBe(false);
  });

  it('ein Snapshot ohne Gruppen ist der Definitionfehler wahl:keine_gruppen (FR-002)', () => {
    const aus = alsPraesidential(praesidentialwahl, state({ jahr: 6, gruppen: [] }))!;
    expect(aus.gewonnen).toBe(false);
    expect(aus.grund_id).toBe('wahl:keine_gruppen');
  });
});

describe('core/wahl-eval — parlamentmehrheit als Anteil (FR-016, G3/§3a)', () => {
  it('mehrheit 0.5 ist bei Zustimmung 0.5 gewonnen — die Grenze ist inklusiv', () => {
    const gleich = [gruppe('arbeitnehmer', 50, 100)];
    const aus = alsMehrheit(parlamentmehrheit, state({ gruppen: gleich }));
    expect(aus.gewonnen).toBe(true);
    expect(aus.grund_id).toBe('mehrheit:gewonnen');
    expect(aus.zustimmung).toBe(0.5);
    expect(aus.mehrheit).toBe(0.5);
  });

  it('Zustimmung knapp unter der Schwelle ist verloren — der Grund nennt die Schwelle der Regel', () => {
    const aus = alsMehrheit(
      parlamentmehrheit,
      state({ gruppen: [gruppe('arbeitnehmer', 49, 100)] }),
    );
    expect(aus.gewonnen).toBe(false);
    expect(aus.grund_id).toBe('mehrheit:unter_0.5');
  });

  it('die Grenze 1 ist erreichbar: volle Zustimmung 100 erfüllt mehrheit 1', () => {
    const volle: MehrheitVariante = { ...parlamentmehrheit, mehrheit: 1 };
    const aus = alsMehrheit(volle, state({ gruppen: [gruppe('arbeitnehmer', 100, 100)] }));
    expect(aus.gewonnen).toBe(true);
    expect(aus.zustimmung).toBe(1);
    expect(aus.grund_id).toBe('mehrheit:gewonnen');
  });

  it('mehrheit außerhalb 0.5–1 ist durch das Register gesperrt — die Auswertung erfindet keine Grenze', () => {
    // Das Schema (core/rules, parlamentmehrheitSchema) begrenzt mehrheit auf 0.5–1; ein gevalidiertes
    // Objekt kann 0.75 lawful sein und die Auswertung prüft exakt gegen den gereichten Anteil.
    const qual: MehrheitVariante = { ...parlamentmehrheit, mehrheit: 0.75 };
    expect(alsMehrheit(qual, state({ gruppen: [gruppe('arbeitnehmer', 75, 100)] })).gewonnen).toBe(
      true,
    );
    expect(alsMehrheit(qual, state({ gruppen: [gruppe('arbeitnehmer', 74, 100)] })).gewonnen).toBe(
      false,
    );
  });

  it('ein Snapshot ohne Gruppen ist der Definitionfehler mehrheit:keine_gruppen (FR-002)', () => {
    const aus = alsMehrheit(parlamentmehrheit, state({ gruppen: [] }));
    expect(aus.gewonnen).toBe(false);
    expect(aus.grund_id).toBe('mehrheit:keine_gruppen');
    expect(aus.zustimmung).toBe(0);
  });

  it('der Check läuft in jedem Jahr — nur die Präesidentialwahl hat einen Zyklus', () => {
    const gruppen = [gruppe('arbeitnehmer', 60, 100)];
    for (const jahr of [1, 2, 3, 7]) {
      expect(alsMehrheit(parlamentmehrheit, state({ jahr, gruppen })).gewonnen).toBe(true);
    }
  });
});

describe('core/wahl-eval — putsch_roll würfelt über den State-RNG (FR-014)', () => {
  it('erreichte Bedingungen würfeln nicht und verbrauchen den RNG nicht', () => {
    const s = state({
      gruppen: [elite(40), militaer(35)], // Schwellen inklusiv erfüllt
      legitimitaet: 30,
      rng: { seed: 7, counter: 0 },
    });
    const aus = alsPutsch(putschRoll, s, 'dev');
    expect(aus.gewonnen).toBe(true);
    expect(aus.grund_id).toBe('putsch:bedingung_erfüllt');
    expect(aus.gerollt).toBe(false);
    expect(aus.roll_wert).toBeUndefined();
    expect(aus.rng).toEqual(s.rng); // counter bleibt — kein Wurf ohne Risiko
    expect(aus.elite_zufriedenheit).toBe(40);
    expect(aus.militaer_zufriedenheit).toBe(35);
    expect(aus.legitimitaet).toBe(30);
  });

  it('die Roll ist deterministisch: zwei Aufrufe mit gleichem seed/counter geben dasselbe Ergebnis', () => {
    const s = state({
      gruppen: [elite(20), militaer(20)],
      legitimitaet: 10,
      rng: { seed: 42, counter: 0 },
    });
    const erste = alsPutsch(putschRoll, s, 'dev');
    const zweite = alsPutsch(putschRoll, s, 'dev');
    expect(erste).toEqual(zweite);
    expect(erste.rng.counter).toBe(s.rng.counter + 1); // genau ein Wurf
    // Der State wird nicht mutiert (ADR-002): der Eingangs-RNG bleibt unverändert.
    expect(s.rng.counter).toBe(0);
    // Der fortgeschrittene State würfelt den *nächsten* Wert — ein Wurf pro Schritt, kein Replay desselben.
    const dritte = alsPutsch(
      putschRoll,
      state({ gruppen: s.gruppen, legitimitaet: 10, rng: erste.rng }),
      'dev',
    );
    expect(dritte.roll_wert).not.toBe(erste.roll_wert);
    expect(dritte.rng.counter).toBe(2);
  });

  it('die Roll nennt den fehlenden Grund im Grund-Muster oder die abgewehrte Roll', () => {
    // seed 42, counter 0: mulberry32 liefert einen festen Wert; mit p=0.3 ist das Ergebnis fix.
    const s = state({
      gruppen: [elite(20), militaer(35)],
      legitimitaet: 60,
      rng: { seed: 42, counter: 0 },
    });
    const aus = alsPutsch(putschRoll, s, 'dev');
    expect(aus.gerollt).toBe(true);
    expect(aus.riskogründe).toEqual(['putsch:elite_unter_40']);
    if (aus.putsch_eingetreten) {
      expect(aus.gewonnen).toBe(false);
      expect(aus.grund_id).toBe('putsch:elite_unter_40'); // erste fehlende Bedingung ist die Ursache
    } else {
      expect(aus.gewonnen).toBe(true);
      expect(aus.grund_id).toBe('putsch:gerollt_abgewehrt');
    }
    expect(aus.roll_wert).toBeGreaterThanOrEqual(0);
    expect(aus.roll_wert).toBeLessThan(1);
  });

  it('wahrscheinlichkeit 0 tritt nie ein, 1 tritt immer ein — die Roll bleibt ein Wurf', () => {
    const s = state({
      gruppen: [elite(20), militaer(20)],
      legitimitaet: 0,
      rng: { seed: 99, counter: 3 },
    });
    const nie: PutschVariante = { ...putschRoll, wahrscheinlichkeit: 0 };
    const immer: PutschVariante = { ...putschRoll, wahrscheinlichkeit: 1 };
    const nullAus = alsPutsch(nie, s, 'dev');
    expect(nullAus.gerollt).toBe(true);
    expect(nullAus.putsch_eingetreten).toBe(false);
    expect(nullAus.gewonnen).toBe(true);
    expect(nullAus.grund_id).toBe('putsch:gerollt_abgewehrt');
    const einsAus = alsPutsch(immer, s, 'dev');
    expect(einsAus.putsch_eingetreten).toBe(true);
    expect(einsAus.gewonnen).toBe(false);
    expect(einsAus.grund_id).toBe('putsch:elite_unter_40');
    expect(nullAus.rng.counter).toBe(4);
    expect(einsAus.rng.counter).toBe(4);
  });

  it('fehlende Elite-Gruppe: Dev wirft mit Gruppen-Tag und Regel-Id (FR-002)', () => {
    const s = state({ gruppen: [militaer(60)], legitimitaet: 60 });
    expect(() => wahlAuswerten(putschRoll, s, 'dev')).toThrow(/elite/);
    expect(() => wahlAuswerten(putschRoll, s, 'dev')).toThrow(/regel_putsch/);
  });

  it('fehlende Elite-Gruppe in Produktion: nicht erreicht, die Roll läuft — kein Crash, nicht „0 erfüllt"', () => {
    const s = state({ gruppen: [militaer(60)], legitimitaet: 60, rng: { seed: 42, counter: 0 } });
    const aus = alsPutsch(putschRoll, s, 'produktion');
    expect(aus.elite_zufriedenheit).toBeUndefined();
    expect(aus.riskogründe).toContain('putsch:gruppe_fehlt_elite');
    expect(aus.gerollt).toBe(true);
    expect(aus.rng.counter).toBe(1);
  });

  it('fehlende Militär-Gruppe in Produktion: eigener Risiko-Grund putsch:gruppe_fehlt_militaer', () => {
    const s = state({ gruppen: [elite(60)], legitimitaet: 60, rng: { seed: 42, counter: 0 } });
    const aus = alsPutsch(putschRoll, s, 'produktion');
    expect(aus.riskogründe).toContain('putsch:gruppe_fehlt_militaer');
    expect(aus.gerollt).toBe(true);
  });

  it('alle drei Bedingungen fehlen gleichzeitig: alle Gründe werden gemeldet (dev wirft trotzdem)', () => {
    const s = state({ gruppen: [], legitimitaet: 10 });
    expect(() => wahlAuswerten(putschRoll, s, 'dev')).toThrow(/elite/);
    const prod = alsPutsch(putschRoll, state({ gruppen: [], legitimitaet: 10 }), 'produktion');
    expect(prod.riskogründe).toEqual([
      'putsch:gruppe_fehlt_elite',
      'putsch:gruppe_fehlt_militaer',
      'putsch:legitimitaet_unter_30',
    ]);
  });
});

describe('core/wahl-eval — kaputte Variante ist kein Spielzustand', () => {
  it('ein unbekannter typ wirft in beiden Modi mit Typ und Regel-Id (closed Discriminator)', () => {
    const kaput = {
      typ: 'volksabstimmung',
      regel_id: 'regel_fremd',
    } as unknown as WahlregelVariant;
    expect(() => wahlAuswerten(kaput, state(), 'dev')).toThrow(/volksabstimmung/);
    expect(() => wahlAuswerten(kaput, state(), 'produktion')).toThrow(/regel_fremd/);
  });
});
