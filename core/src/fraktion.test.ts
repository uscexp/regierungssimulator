/** core/src/fraktion.test.ts — Fraktionen als abgeleitete View (US-M1-07, FR-016, G3/§3a).
 *
 * Getestet wird:
 * - berechneFraktionSupport: Summe der Bevölkerungsanteile zufriedener Gruppen (Zufriedenheit ≥ 50) / 100
 * - pruefeGesetzesMehrheit: unterstützt >= mehrheit ⇒ wahr, sonst falsch
 * - Clamping bei 0 und 1
 */

import { describe, expect, it } from 'vitest';

import { berechneFraktionSupport, pruefeGesetzesMehrheit } from './fraktion.js';

const gruppe = (
  tag: string,
  zufriedenheit: number,
  anteil: number,
): {
  readonly tag: string;
  readonly zufriedenheit: number;
  readonly bevölkerungsanteil: number;
  readonly gewichte: Record<string, number>;
} => Object.freeze({ tag, zufriedenheit, bevölkerungsanteil: anteil, gewichte: {} });

describe('core/fraktion — Fraktionen als abgeleitete View (US-M1-07)', () => {
  describe('berechneFraktionSupport', () => {
    it('keine Gruppe → 0', () => {
      expect(berechneFraktionSupport([])).toBe(0);
    });

    it('alle Gruppen zufrieden → 1.0', () => {
      const gruppen = [gruppe('a', 60, 40), gruppe('b', 70, 60)];
      expect(berechneFraktionSupport(gruppen)).toBeCloseTo(1.0, 6);
    });

    it('keine Gruppe zufrieden → 0', () => {
      const gruppen = [gruppe('a', 40, 40), gruppe('b', 30, 60)];
      expect(berechneFraktionSupport(gruppen)).toBe(0);
    });

    it('gemischte Gruppen → korrekter Anteil', () => {
      const gruppen = [
        gruppe('a', 60, 40), // unterstützt
        gruppe('b', 40, 60), // nicht unterstützt
      ];
      // 40 / 100 = 0.4
      expect(berechneFraktionSupport(gruppen)).toBeCloseTo(0.4, 6);
    });

    it('Zufriedenheit genau 50 → unterstützt (inklusiv)', () => {
      const gruppen = [gruppe('a', 50, 100)];
      expect(berechneFraktionSupport(gruppen)).toBeCloseTo(1.0, 6);
    });

    it('Zufriedenheit 49 → nicht unterstützt', () => {
      const gruppen = [gruppe('a', 49, 100)];
      expect(berechneFraktionSupport(gruppen)).toBe(0);
    });

    it('Anteile > 100 → geklappt auf 1.0', () => {
      const gruppen = [gruppe('a', 60, 60), gruppe('b', 70, 60)];
      // 120 / 100 = 1.2 → geklappt auf 1.0
      expect(berechneFraktionSupport(gruppen)).toBeCloseTo(1.0, 6);
    });
  });

  describe('pruefeGesetzesMehrheit', () => {
    it('unterstützung >= mehrheit → wahr', () => {
      expect(pruefeGesetzesMehrheit(0.6, 0.5)).toBe(true);
    });

    it('unterstützung == mehrheit → wahr (inklusiv)', () => {
      expect(pruefeGesetzesMehrheit(0.5, 0.5)).toBe(true);
    });

    it('unterstützung < mehrheit → falsch', () => {
      expect(pruefeGesetzesMehrheit(0.4, 0.5)).toBe(false);
    });

    it('mehrheit 1.0 → nur volle Unterstützung reicht', () => {
      expect(pruefeGesetzesMehrheit(0.99, 1.0)).toBe(false);
      expect(pruefeGesetzesMehrheit(1.0, 1.0)).toBe(true);
    });

    it('mehrheit 0.5 → einfache Mehrheit', () => {
      expect(pruefeGesetzesMehrheit(0.5, 0.5)).toBe(true);
      expect(pruefeGesetzesMehrheit(0.49, 0.5)).toBe(false);
    });
  });
});
