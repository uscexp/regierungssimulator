import { describe, expect, it } from 'vitest';

import { SCHWIERIGKEIT_NORMAL, type IndikatorRegel } from '@staatslenker/core/indikatoren';
import { tick } from '@staatslenker/core/tick';
import { erzeugeGameState, type Startkonfiguration } from '@staatslenker/core/state';
import type { SteuerfaktorTabelle } from '@staatslenker/core/budget';
import type { SteuerlastTabelle } from '@staatslenker/core/zufriedenheit';

/**
 * Der Smoke-Test fährt den Kern von einem Start-Snapshot: Build → Boot → ein Tick. Das ist das
 * Quality-Gate "ein Build bootet und ist spielbar" (US-M0-11, architektur.md §7) — ohne UI, ohne
 * Content-Paket, nur mit Regel-Daten.
 */
const indikator_regeln: readonly IndikatorRegel[] = [
  { tag: 'infrastruktur', verschleiß: 3, budget_wirkung: 0.5 },
  { tag: 'bildung', verschleiß: 2, budget_wirkung: 0.6 },
  { tag: 'gesundheit', verschleiß: 2, budget_wirkung: 0.7 },
  { tag: 'wirtschaft', verschleiß: 2, budget_wirkung: 0.4 },
  { tag: 'forschung', verschleiß: 2, budget_wirkung: 0.5, gate: { indikator: 'bildung', min: 50 } },
];

const steuerfaktor: SteuerfaktorTabelle = { niedrig: 0.6, flat: 0.8, progressiv: 1.0, hoch: 1.2 };
const steuerlast: SteuerlastTabelle = {
  unternehmen: { niedrig: 0, flat: 4, progressiv: 8, hoch: 12 },
};

const start: Startkonfiguration = {
  jahr: 1,
  indikatoren: { infrastruktur: 40, bildung: 40, gesundheit: 40, wirtschaft: 45, forschung: 40 },
  gruppen: [
    {
      tag: 'unternehmen',
      zufriedenheit: 49.235,
      bevölkerungsanteil: 21.3,
      gewichte: { wirtschaft: 0.647, infrastruktur: 0.353 },
    },
  ],
  budget: {},
  politisches_kapital: 5,
  legitimitaet: 50,
  schulden: 0,
  radikalisierung: 10,
  rng: { seed: 424242, counter: 0 },
  konstitution: { steuermodell: 'flat' },
  zufriedenheits_trace: {},
};

describe('Toolchain-Smoke', () => {
  it('der Kern ist ladbar und ein Tick läuft von Start bis Jahr 2 ohne Regelverletzung', () => {
    const ergebnis = tick(
      erzeugeGameState(start),
      { zuteilung: {} },
      { indikator_regeln, steuerfaktor, steuerlast, schwierigkeit: SCHWIERIGKEIT_NORMAL },
    );

    expect(ergebnis.state.jahr).toBe(2);
    expect(ergebnis.state.beschlüsse).toHaveLength(0);
    // Ohne Event-Regeln im Regelsatz gibt es keine Events und damit keine News — der Tick erfindet keine.
    expect(ergebnis.ereignisse).toHaveLength(0);
    expect(ergebnis.news).toHaveLength(0);
    expect(ergebnis.wahl).toBeUndefined();
  });
});
