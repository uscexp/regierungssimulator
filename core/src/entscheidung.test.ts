/** core/src/entscheidung.test.ts — Entscheidungs-Karten für Event-Ketten (US-M2-03, FR-025/026).
 *
 * Getestet wird:
 * - Karte wählt erste verfügbare Option (deterministisch, kein RNG)
 * - Tiefen-Limit verhindert Endlosschleife (max 5 Stufen)
 * - Garantierter Exit: Kette endet bei fehlender Karte, keine verfügbare Option oder Tiefen-Limit
 * - Effekte werden auf den State angewendet und der neue State zurückgegeben
 */

import { describe, expect, it } from 'vitest';

import { karteVerarbeiten, ereignisKetteVerarbeiten, type Entscheidungskarte } from './entscheidung.js';
import { erzeugeGameState, type GameState } from './state.js';
import { praedikatSchema, type Praedikat } from './eval.js';

const start: GameState = erzeugeGameState({
  jahr: 1,
  indikatoren: { wirtschaft: 40, bildung: 50, gesundheit: 60, infrastruktur: 45, forschung: 30 },
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
  schulden: 10,
  radikalisierung: 10,
  rng: { seed: 424242, counter: 0 },
  konstitution: { steuermodell: 'flat' },
  zufriedenheits_trace: {},
  beschlüsse: [],
});

const pWirtschaftNiedrig: Praedikat = praedikatSchema.parse({
  typ: 'indikator_von',
  regel_id: 'pr_wirtschaft_niedrig',
  tag: 'wirtschaft',
  op: '<',
  wert: 45,
});

const pWirtschaftHoch: Praedikat = praedikatSchema.parse({
  typ: 'indikator_von',
  regel_id: 'pr_wirtschaft_hoch',
  tag: 'wirtschaft',
  op: '>',
  wert: 100,
});

describe('core/entscheidung — Entscheidungs-Karten für Event-Ketten (US-M2-03)', () => {
  describe('karteVerarbeiten — einzelne Karte', () => {
    const karteOhneBedingung: Entscheidungskarte = {
      regel_id: 'karte_ohne_bedingung',
      optionen: [
        {
          id: 'option_a',
          effekte: [{ ziel: 'legitimitaet', delta: -5 }],
        },
      ],
      maxTiefe: 5,
    };

    const karteMitBedingung: Entscheidungskarte = {
      regel_id: 'karte_mit_bedingung',
      optionen: [
        {
          id: 'option_bedingung',
          bedingung: pWirtschaftNiedrig,
          effekte: [{ ziel: 'legitimitaet', delta: -10 }],
        },
      ],
      maxTiefe: 5,
    };

    it('keine Bedingung → erste Option wird ausgewählt', () => {
      const ergebnis = karteVerarbeiten(karteOhneBedingung, start, 'dev');
      expect(ergebnis.ereignisse).toHaveLength(1);
      expect(ergebnis.ereignisse[0]!.ereignis_id).toBe('karte_ohne_bedingung');
      expect(ergebnis.state.legitimitaet).toBe(45); // 50 - 5
      expect(ergebnis.rng.counter).toBe(0); // Kein RNG-Verbrauch
    });

    it('Bedingung erfüllt → Option ausgewählt', () => {
      const ergebnis = karteVerarbeiten(karteMitBedingung, start, 'dev');
      expect(ergebnis.ereignisse).toHaveLength(1);
      expect(ergebnis.state.legitimitaet).toBe(40); // 50 - 10
    });

    it('Bedingung nicht erfüllt → keine Option, kein Ereignis', () => {
      const karteOhneTreffer: Entscheidungskarte = {
        regel_id: 'karte_ohne_treffer',
        optionen: [
          {
            id: 'option_unavailable',
            bedingung: pWirtschaftHoch,
            effekte: [{ ziel: 'legitimitaet', delta: -5 }],
          },
        ],
        maxTiefe: 5,
      };
      const ergebnis = karteVerarbeiten(karteOhneTreffer, start, 'dev');
      expect(ergebnis.ereignisse).toHaveLength(0);
      expect(ergebnis.state).toBe(start); // State unverändert
      expect(ergebnis.rng.counter).toBe(0);
    });

    it('mehrere Optionen → erste verfügbare gewinnt', () => {
      const karteMehrereOptionen: Entscheidungskarte = {
        regel_id: 'karte_mehrere_optionen',
        optionen: [
          {
            id: 'option_unavailable',
            bedingung: pWirtschaftHoch,
            effekte: [{ ziel: 'legitimitaet', delta: -1 }],
          },
          {
            id: 'option_available',
            bedingung: pWirtschaftNiedrig,
            effekte: [{ ziel: 'legitimitaet', delta: -3 }],
          },
          {
            id: 'option_keine_bedingung',
            effekte: [{ ziel: 'legitimitaet', delta: -5 }],
          },
        ],
        maxTiefe: 5,
      };
      const ergebnis = karteVerarbeiten(karteMehrereOptionen, start, 'dev');
      expect(ergebnis.state.legitimitaet).toBe(47); // 50 - 3 (zweite Option, erste nicht verfügbar)
    });
  });

  describe('ereignisKetteVerarbeiten — Event-Kette mit Tiefen-Limit', () => {
    const karte1: Entscheidungskarte = {
      regel_id: 'karte_1',
      optionen: [
        {
          id: 'opt_1_zu_2',
          effekte: [{ ziel: 'legitimitaet', delta: -5 }],
          nachfolgeEreignisId: 'karte_2',
        },
      ],
      maxTiefe: 5,
    };

    const karte2: Entscheidungskarte = {
      regel_id: 'karte_2',
      optionen: [
        {
          id: 'opt_2_zu_3',
          effekte: [{ ziel: 'legitimitaet', delta: -3 }],
          nachfolgeEreignisId: 'karte_3',
        },
      ],
      maxTiefe: 5,
    };

    const karte3: Entscheidungskarte = {
      regel_id: 'karte_3',
      optionen: [
        {
          id: 'opt_3_exit',
          effekte: [{ ziel: 'legitimitaet', delta: -2 }],
        },
      ],
      maxTiefe: 5,
    };

    const karten = [karte1, karte2, karte3];

    it('Kette verarbeitet alle Karten bis zum Exit', () => {
      const ergebnis = ereignisKetteVerarbeiten(karten, 'karte_1', start, 'dev');
      expect(ergebnis.ereignisse).toHaveLength(3);
      expect(ergebnis.ereignisse.map((e) => e.ereignis_id)).toEqual([
        'karte_1',
        'karte_2',
        'karte_3',
      ]);
      expect(ergebnis.state.legitimitaet).toBe(40); // 50 - 5 - 3 - 2
    });

    it('keine passende Karte → leeres Ergebnis', () => {
      const ergebnis = ereignisKetteVerarbeiten(karten, 'nicht_vorhanden', start, 'dev');
      expect(ergebnis.ereignisse).toHaveLength(0);
      expect(ergebnis.state).toBe(start);
    });

    it('Tiefen-Limit erreicht → Exit ohne weitere Karten', () => {
      const karteMaxTiefe1: Entscheidungskarte = {
        regel_id: 'karte_tiefe_1',
        optionen: [
          {
            id: 'opt_tiefe_zu_2',
            effekte: [{ ziel: 'legitimitaet', delta: -1 }],
            nachfolgeEreignisId: 'karte_tiefe_2',
          },
        ],
        maxTiefe: 1,
      };
      const karteMaxTiefe2: Entscheidungskarte = {
        regel_id: 'karte_tiefe_2',
        optionen: [
          {
            id: 'opt_tiefe_exit',
            effekte: [{ ziel: 'legitimitaet', delta: -1 }],
          },
        ],
        maxTiefe: 5,
      };
      const kartenTiefe = [karteMaxTiefe1, karteMaxTiefe2];
      const ergebnis = ereignisKetteVerarbeiten(kartenTiefe, 'karte_tiefe_1', start, 'dev');
      expect(ergebnis.ereignisse).toHaveLength(1); // Nur karte_1, karte_2 durch Tiefen-Limit blockiert
      expect(ergebnis.state.legitimitaet).toBe(49); // 50 - 1
    });

    it('garantierter Exit: keine unendliche Rekursion bei Kreis', () => {
      const karteKreisA: Entscheidungskarte = {
        regel_id: 'kreis_a',
        optionen: [
          {
            id: 'opt_kreis_zu_b',
            effekte: [{ ziel: 'legitimitaet', delta: -1 }],
            nachfolgeEreignisId: 'kreis_b',
          },
        ],
        maxTiefe: 3,
      };
      const karteKreisB: Entscheidungskarte = {
        regel_id: 'kreis_b',
        optionen: [
          {
            id: 'opt_kreis_zu_a',
            effekte: [{ ziel: 'legitimitaet', delta: -1 }],
            nachfolgeEreignisId: 'kreis_a',
          },
        ],
        maxTiefe: 3,
      };
      const kartenKreis = [karteKreisA, karteKreisB];
      const ergebnis = ereignisKetteVerarbeiten(kartenKreis, 'kreis_a', start, 'dev');
      expect(ergebnis.ereignisse.length).toBeLessThanOrEqual(3);
      expect(ergebnis.state.legitimitaet).toBeLessThanOrEqual(47); // Max 3 × -1
    });
  });
});
