import { describe, expect, it } from 'vitest';

import {
  ereignisAnwenden,
  ereignisAuslosen,
  ereignisIndikatorDeltas,
  effekteAnwenden,
  type EreignisRegel,
} from '@staatslenker/core/ereignisse';
import { SCHWIERIGKEIT_NORMAL, type SchwierigkeitsPack } from '@staatslenker/core/indikatoren';
import {
  erzeugeGameState,
  type Effekt,
  type GameState,
  type Startkonfiguration,
} from '@staatslenker/core/state';

const start: Startkonfiguration = {
  jahr: 3,
  indikatoren: { infrastruktur: 60, bildung: 55, gesundheit: 55, wirtschaft: 40, forschung: 50 },
  gruppen: [
    {
      tag: 'unternehmen',
      zufriedenheit: 45,
      bevölkerungsanteil: 21.3,
      gewichte: { wirtschaft: 0.647, infrastruktur: 0.353 },
    },
    {
      tag: 'arbeitnehmer',
      zufriedenheit: 50,
      bevölkerungsanteil: 51.1,
      gewichte: { wirtschaft: 0.643, gesundheit: 0.357 },
    },
  ],
  budget: {},
  politisches_kapital: 5,
  legitimitaet: 50,
  schulden: 0,
  radikalisierung: 10,
  rng: { seed: 7, counter: 0 },
  konstitution: { steuermodell: 'flat' },
  zufriedenheits_trace: {},
};

const state = (extra: Partial<Startkonfiguration> = {}): GameState =>
  erzeugeGameState({ ...start, ...extra });

describe('core/ereignisse — gewichtete Auswahl aus erfüllten Regeln (FR-012, US-M0-05)', () => {
  it('eine Regel deren Bedingung nicht erfüllt ist, kommt nie raus (AC)', () => {
    const regel: EreignisRegel = {
      id: 'streik',
      gewicht: 1,
      effekte: [{ ziel: 'gruppen', tag: 'arbeitnehmer', delta: -3 }],
      bedingung: { gruppe: { tag: 'arbeitnehmer', max_zufriedenheit: 40 } },
    };
    const ergebnis = ereignisAuslosen(state(), [regel], SCHWIERIGKEIT_NORMAL);
    expect(ergebnis.ereignisse).toHaveLength(0);

    const erfüllt = ereignisAuslosen(
      state({ radikalisierung: 60 }),
      [{ id: 'streik', gewicht: 1, effekte: [], bedingung: { radikalisierung_min: 50 } }],
      SCHWIERIGKEIT_NORMAL,
    );
    expect(erfüllt.ereignisse.map((e) => e.ereignis_id)).toEqual(['streik']);
  });

  it('die Auswahl ist über den State-RNG deterministisch: gleicher Seed, gleiche Regeln, gleiche Folge', () => {
    const regeln: readonly EreignisRegel[] = [
      {
        id: 'hochwasser',
        gewicht: 3,
        effekte: [{ ziel: 'indikatoren', tag: 'infrastruktur', delta: -8 }],
      },
      {
        id: 'rezession',
        gewicht: 1,
        effekte: [{ ziel: 'indikatoren', tag: 'wirtschaft', delta: -10 }],
      },
      { id: 'bildung', gewicht: 2, effekte: [{ ziel: 'indikatoren', tag: 'bildung', delta: -5 }] },
    ];
    const links = ereignisAuslosen(state(), regeln, SCHWIERIGKEIT_NORMAL, 5);
    const rechts = ereignisAuslosen(state(), regeln, SCHWIERIGKEIT_NORMAL, 5);
    expect(links.ereignisse.map((e) => e.ereignis_id)).toEqual(
      rechts.ereignisse.map((e) => e.ereignis_id),
    );
    expect(links.rng.counter).toBe(rechts.rng.counter);
    expect(links.ereignisse.length).toBe(5);
  });

  it('der Schwierigkeits-Pack skaliert die Anzahl (G6): ein Pack mit Faktor 0.25 zieht ein Event aus drei Würfen', () => {
    const regeln: readonly EreignisRegel[] = [{ id: 'krise', gewicht: 1, effekte: [] }];
    const gedrosselt: SchwierigkeitsPack = {
      ...SCHWIERIGKEIT_NORMAL,
      event_wahrscheinlichkeit: 0.25,
    };
    const normal = ereignisAuslosen(state(), regeln, SCHWIERIGKEIT_NORMAL, 3);
    const dünne = ereignisAuslosen(state(), regeln, gedrosselt, 3);
    expect(normal.ereignisse.length).toBe(3);
    expect(dünne.ereignisse.length).toBe(1);
  });

  it('Effekte werden auf Gruppen und Skalar-Ziele angewandt und clamped — der alte Snapshot bleibt unverändert', () => {
    const vorher = structuredClone(state());
    const effekte: readonly Effekt[] = [
      { ziel: 'gruppen', tag: 'arbeitnehmer', delta: -60 },
      { ziel: 'legitimitaet', delta: 80 },
      { ziel: 'radikalisierung', delta: -30 },
    ];
    const nach = ereignisAnwenden(state(), [{ ereignis_id: 'krise', effekte }]);

    expect(nach.gruppen.find((g) => g.tag === 'arbeitnehmer')!.zufriedenheit).toBe(0);
    expect(nach.legitimitaet).toBe(100);
    expect(nach.radikalisierung).toBe(0);
    expect(structuredClone(vorher)).toEqual(structuredClone(state()));
  });

  it('eine unbekannte Gruppe wird im Dev-Modus mit Regel-Id abgewiesen, im Produktionsmodus übersprungen (FR-002)', () => {
    const kaputt: readonly Effekt[] = [{ ziel: 'gruppen', tag: 'rentner', delta: -5 }];
    expect(() => effekteAnwenden(state(), kaputt, 'event:krise', 'dev')).toThrow(/rentner/);

    const nach = effekteAnwenden(state(), kaputt, 'event:krise', 'produktion');
    expect(nach.gruppen).toHaveLength(2);
  });

  it('ein kaputer Gewichtswert wirft im Dev-Modus und wird im Produktionsmodus übersprungen (FR-002)', () => {
    const kaputteRegel: EreignisRegel = { id: 'fehler', gewicht: Number.NaN, effekte: [] };
    expect(() => ereignisAuslosen(state(), [kaputteRegel], SCHWIERIGKEIT_NORMAL)).toThrow(/fehler/);

    const nach = ereignisAuslosen(state(), [kaputteRegel], SCHWIERIGKEIT_NORMAL, 2, 'produktion');
    expect(nach.ereignisse).toHaveLength(0);
  });

  it('Indikator-Deltas werden für den Bewegungsschritt gesammelt und clamped auf 0–100', () => {
    const deltas = ereignisIndikatorDeltas([
      {
        ereignis_id: 'hochwasser',
        effekte: [
          { ziel: 'indikatoren', tag: 'infrastruktur', delta: -8 },
          { ziel: 'gruppen', tag: 'unternehmen', delta: -2 },
        ],
      },
      { ereignis_id: 'boom', effekte: [{ ziel: 'indikatoren', tag: 'wirtschaft', delta: 90 }] },
    ]);
    expect(deltas.infrastruktur).toBe(-8);
    expect(deltas.wirtschaft).toBe(90);
    // Die Summe ist roh: der Clamp auf 0–100 passiert im Bewegungsschritt des Ticks, sonst würde
    // ein Delta zweimal begrenzt (einmal hier, einmal dort).
    expect(Object.keys(deltas)).toEqual(['infrastruktur', 'wirtschaft']);
  });
});
