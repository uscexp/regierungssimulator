/**
 * @staatslenker/app schwerigkeitsgrade.test.ts — Tests für Schwierigkeitsgrade Logik (US-M6-08).
 *
 * Testet die drei Schwierigkeitsgrade als Parameter-Sets.
 */
import { describe, expect, it } from 'vitest';

/**
 * Schwierigkeitsgrade-Logik extrahiert aus Schwierigkeitsgrade.svelte — testbar isoliert.
 */
interface SchwierigkeitsGrad {
  id: string;
  name: string;
  beschreibung: string;
  parameter: {
    verschleiß_multiplikator: number;
    pk_regeneration: number;
    event_wahrscheinlichkeit: number;
    schuldenlimit: number;
    zinsfaktor: number;
    budget_zuschuss: number;
  };
  farbe: string;
  schwierigkeit: 'leicht' | 'normal' | 'schwer';
}

const SCHWIERIGKEIT_GRAD: Readonly<Record<string, SchwierigkeitsGrad>> = Object.freeze({
  leicht: {
    id: 'leicht',
    name: 'Leicht',
    beschreibung: 'Einfacher Einstieg mit mehr Budget, weniger Krisen und langsamerem Verschleiß',
    parameter: {
      verschleiß_multiplikator: 0.7,
      pk_regeneration: 1.3,
      event_wahrscheinlichkeit: 0.7,
      schuldenlimit: 150,
      zinsfaktor: 0.05,
      budget_zuschuss: 10,
    },
    farbe: '#16a34a',
    schwierigkeit: 'leicht',
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    beschreibung: 'Ausgewogener Schwierigkeitsgrad (Standard aus balance-werte.md)',
    parameter: {
      verschleiß_multiplikator: 1.0,
      pk_regeneration: 1.0,
      event_wahrscheinlichkeit: 1.0,
      schuldenlimit: 100,
      zinsfaktor: 0.08,
      budget_zuschuss: 0,
    },
    farbe: '#eab308',
    schwierigkeit: 'normal',
  },
  schwer: {
    id: 'schwer',
    name: 'Schwer',
    beschreibung: 'Herausfordernd mit schnellem Verschleiß, weniger PK und häufigeren Ereignissen',
    parameter: {
      verschleiß_multiplikator: 1.4,
      pk_regeneration: 0.7,
      event_wahrscheinlichkeit: 1.4,
      schuldenlimit: 60,
      zinsfaktor: 0.12,
      budget_zuschuss: -10,
    },
    farbe: '#dc2626',
    schwierigkeit: 'schwer',
  },
});

function schwierigkeitsWert(grad: SchwierigkeitsGrad): number {
  const { parameter } = grad;
  const verschleiß = (parameter.verschleiß_multiplikator - 0.5) / 1.0;
  const pkRegen = (1.3 - parameter.pk_regeneration) / 0.6;
  const ereignis = (parameter.event_wahrscheinlichkeit - 0.5) / 1.0;
  const schulden = (150 - parameter.schuldenlimit) / 100;
  const zins = (parameter.zinsfaktor - 0.04) / 0.1;
  const zuschuss = (10 - parameter.budget_zuschuss) / 20;

  const mittelwert = (verschleiß + pkRegen + ereignis + schulden + zins + zuschuss) / 6;
  return Math.round(Math.max(0, Math.min(100, mittelwert * 100)));
}

function schwierigkeitsText(grad: SchwierigkeitsGrad): string {
  const wert = schwierigkeitsWert(grad);
  if (wert < 30) return 'einfach';
  if (wert < 70) return 'ausgewogen';
  return 'herausfordernd';
}

describe('US-M6-08: Schwierigkeitsgrade', () => {
  describe('Grad-Struktur', () => {
    it('definiert genau drei Schwierigkeitsgrade', () => {
      expect(Object.keys(SCHWIERIGKEIT_GRAD).length).toBe(3);
      expect(SCHWIERIGKEIT_GRAD.leicht).toBeDefined();
      expect(SCHWIERIGKEIT_GRAD.normal).toBeDefined();
      expect(SCHWIERIGKEIT_GRAD.schwer).toBeDefined();
    });

    it('hat eindeutige IDs', () => {
      const ids = Object.values(SCHWIERIGKEIT_GRAD).map((g) => g.id);
      expect(ids).toContain('leicht');
      expect(ids).toContain('normal');
      expect(ids).toContain('schwer');
    });

    it('hat eindeutige Farben', () => {
      const farben = Object.values(SCHWIERIGKEIT_GRAD).map((g) => g.farbe);
      expect(new Set(farben).size).toBe(3);
    });
  });

  describe('Leichter Grad', () => {
    const leicht = SCHWIERIGKEIT_GRAD.leicht;

    it('hat niedrigen Verschleiß-Multiplikator (< 1)', () => {
      expect(leicht.parameter.verschleiß_multiplikator).toBeLessThan(1);
      expect(leicht.parameter.verschleiß_multiplikator).toBe(0.7);
    });

    it('hat hohe PK-Regeneration (> 1)', () => {
      expect(leicht.parameter.pk_regeneration).toBeGreaterThan(1);
      expect(leicht.parameter.pk_regeneration).toBe(1.3);
    });

    it('hat niedrige Ereignis-Wahrscheinlichkeit (< 1)', () => {
      expect(leicht.parameter.event_wahrscheinlichkeit).toBeLessThan(1);
      expect(leicht.parameter.event_wahrscheinlichkeit).toBe(0.7);
    });

    it('hat hohes Schuldenlimit (> 100)', () => {
      expect(leicht.parameter.schuldenlimit).toBeGreaterThan(100);
      expect(leicht.parameter.schuldenlimit).toBe(150);
    });

    it('hat niedrigen Zinsfaktor (< 0.08)', () => {
      expect(leicht.parameter.zinsfaktor).toBeLessThan(0.08);
      expect(leicht.parameter.zinsfaktor).toBe(0.05);
    });

    it('hat positiven Budget-Zuschuss (> 0)', () => {
      expect(leicht.parameter.budget_zuschuss).toBeGreaterThan(0);
      expect(leicht.parameter.budget_zuschuss).toBe(10);
    });

    it('hat die einfachste Schwierigkeit (< 30)', () => {
      const wert = schwierigkeitsWert(leicht);
      expect(wert).toBeLessThan(30);
      expect(schwierigkeitsText(leicht)).toBe('einfach');
    });

    it('hat die grüne Farbe', () => {
      expect(leicht.farbe).toBe('#16a34a');
    });
  });

  describe('Normaler Grad', () => {
    const normal = SCHWIERIGKEIT_GRAD.normal;

    it('hat Basis-Verschleiß-Multiplikator (= 1)', () => {
      expect(normal.parameter.verschleiß_multiplikator).toBe(1.0);
    });

    it('hat Basis-PK-Regeneration (= 1)', () => {
      expect(normal.parameter.pk_regeneration).toBe(1.0);
    });

    it('hat Basis-Ereignis-Wahrscheinlichkeit (= 1)', () => {
      expect(normal.parameter.event_wahrscheinlichkeit).toBe(1.0);
    });

    it('hat Basis-Schuldenlimit (= 100)', () => {
      expect(normal.parameter.schuldenlimit).toBe(100);
    });

    it('hat Basis-Zinsfaktor (= 0.08)', () => {
      expect(normal.parameter.zinsfaktor).toBe(0.08);
    });

    it('hat neutralen Budget-Zuschuss (= 0)', () => {
      expect(normal.parameter.budget_zuschuss).toBe(0);
    });

    it('hat die ausgewogene Schwierigkeit (30–70)', () => {
      const wert = schwierigkeitsWert(normal);
      expect(wert).toBeGreaterThanOrEqual(30);
      expect(wert).toBeLessThan(70);
      expect(schwierigkeitsText(normal)).toBe('ausgewogen');
    });

    it('hat die gelbe Farbe', () => {
      expect(normal.farbe).toBe('#eab308');
    });
  });

  describe('Schwerer Grad', () => {
    const schwer = SCHWIERIGKEIT_GRAD.schwer;

    it('hat hohen Verschleiß-Multiplikator (> 1)', () => {
      expect(schwer.parameter.verschleiß_multiplikator).toBeGreaterThan(1);
      expect(schwer.parameter.verschleiß_multiplikator).toBe(1.4);
    });

    it('hat niedrige PK-Regeneration (< 1)', () => {
      expect(schwer.parameter.pk_regeneration).toBeLessThan(1);
      expect(schwer.parameter.pk_regeneration).toBe(0.7);
    });

    it('hat hohe Ereignis-Wahrscheinlichkeit (> 1)', () => {
      expect(schwer.parameter.event_wahrscheinlichkeit).toBeGreaterThan(1);
      expect(schwer.parameter.event_wahrscheinlichkeit).toBe(1.4);
    });

    it('hat niedriges Schuldenlimit (< 100)', () => {
      expect(schwer.parameter.schuldenlimit).toBeLessThan(100);
      expect(schwer.parameter.schuldenlimit).toBe(60);
    });

    it('hat hohen Zinsfaktor (> 0.08)', () => {
      expect(schwer.parameter.zinsfaktor).toBeGreaterThan(0.08);
      expect(schwer.parameter.zinsfaktor).toBe(0.12);
    });

    it('hat negativen Budget-Zuschuss (< 0)', () => {
      expect(schwer.parameter.budget_zuschuss).toBeLessThan(0);
      expect(schwer.parameter.budget_zuschuss).toBe(-10);
    });

    it('hat die herausfordernde Schwierigkeit (> 70)', () => {
      const wert = schwierigkeitsWert(schwer);
      expect(wert).toBeGreaterThanOrEqual(70);
      expect(schwierigkeitsText(schwer)).toBe('herausfordernd');
    });

    it('hat die rote Farbe', () => {
      expect(schwer.farbe).toBe('#dc2626');
    });
  });

  describe('Parameter-Vergleich', () => {
    it('hat monoton steigenden Verschleiß: leicht < normal < schwer', () => {
      expect(SCHWIERIGKEIT_GRAD.leicht.parameter.verschleiß_multiplikator).toBeLessThan(
        SCHWIERIGKEIT_GRAD.normal.parameter.verschleiß_multiplikator
      );
      expect(SCHWIERIGKEIT_GRAD.normal.parameter.verschleiß_multiplikator).toBeLessThan(
        SCHWIERIGKEIT_GRAD.schwer.parameter.verschleiß_multiplikator
      );
    });

    it('hat fallende PK-Regeneration: leicht > normal > schwer', () => {
      expect(SCHWIERIGKEIT_GRAD.leicht.parameter.pk_regeneration).toBeGreaterThan(
        SCHWIERIGKEIT_GRAD.normal.parameter.pk_regeneration
      );
      expect(SCHWIERIGKEIT_GRAD.normal.parameter.pk_regeneration).toBeGreaterThan(
        SCHWIERIGKEIT_GRAD.schwer.parameter.pk_regeneration
      );
    });

    it('hat steigende Ereignis-Wahrscheinlichkeit: leicht < normal < schwer', () => {
      expect(SCHWIERIGKEIT_GRAD.leicht.parameter.event_wahrscheinlichkeit).toBeLessThan(
        SCHWIERIGKEIT_GRAD.normal.parameter.event_wahrscheinlichkeit
      );
      expect(SCHWIERIGKEIT_GRAD.normal.parameter.event_wahrscheinlichkeit).toBeLessThan(
        SCHWIERIGKEIT_GRAD.schwer.parameter.event_wahrscheinlichkeit
      );
    });

    it('hat fallendes Schuldenlimit: leicht > normal > schwer', () => {
      expect(SCHWIERIGKEIT_GRAD.leicht.parameter.schuldenlimit).toBeGreaterThan(
        SCHWIERIGKEIT_GRAD.normal.parameter.schuldenlimit
      );
      expect(SCHWIERIGKEIT_GRAD.normal.parameter.schuldenlimit).toBeGreaterThan(
        SCHWIERIGKEIT_GRAD.schwer.parameter.schuldenlimit
      );
    });

    it('hat steigenden Zinsfaktor: leicht < normal < schwer', () => {
      expect(SCHWIERIGKEIT_GRAD.leicht.parameter.zinsfaktor).toBeLessThan(
        SCHWIERIGKEIT_GRAD.normal.parameter.zinsfaktor
      );
      expect(SCHWIERIGKEIT_GRAD.normal.parameter.zinsfaktor).toBeLessThan(
        SCHWIERIGKEIT_GRAD.schwer.parameter.zinsfaktor
      );
    });

    it('hat fallenden Budget-Zuschuss: leicht > normal > schwer', () => {
      expect(SCHWIERIGKEIT_GRAD.leicht.parameter.budget_zuschuss).toBeGreaterThan(
        SCHWIERIGKEIT_GRAD.normal.parameter.budget_zuschuss
      );
      expect(SCHWIERIGKEIT_GRAD.normal.parameter.budget_zuschuss).toBeGreaterThan(
        SCHWIERIGKEIT_GRAD.schwer.parameter.budget_zuschuss
      );
    });
  });

  describe('Schwierigkeits-Wert', () => {
    it('ist für alle Grade zwischen 0 und 100', () => {
      for (const grad of Object.values(SCHWIERIGKEIT_GRAD)) {
        const wert = schwierigkeitsWert(grad);
        expect(wert).toBeGreaterThanOrEqual(0);
        expect(wert).toBeLessThanOrEqual(100);
      }
    });

    it('ist für leicht am niedrigsten', () => {
      const leicht = schwierigkeitsWert(SCHWIERIGKEIT_GRAD.leicht);
      const normal = schwierigkeitsWert(SCHWIERIGKEIT_GRAD.normal);
      const schwer = schwierigkeitsWert(SCHWIERIGKEIT_GRAD.schwer);
      expect(leicht).toBeLessThan(normal);
      expect(normal).toBeLessThan(schwer);
    });

    it('gibt ganze Zahlen zurück', () => {
      for (const grad of Object.values(SCHWIERIGKEIT_GRAD)) {
        const wert = schwierigkeitsWert(grad);
        expect(Number.isInteger(wert)).toBe(true);
      }
    });
  });

  describe('Schwierigkeits-Text', () => {
    it('gibt für leicht "einfach" zurück', () => {
      expect(schwierigkeitsText(SCHWIERIGKEIT_GRAD.leicht)).toBe('einfach');
    });

    it('gibt für normal "ausgewogen" zurück', () => {
      expect(schwierigkeitsText(SCHWIERIGKEIT_GRAD.normal)).toBe('ausgewogen');
    });

    it('gibt für schwer "herausfordernd" zurück', () => {
      expect(schwierigkeitsText(SCHWIERIGKEIT_GRAD.schwer)).toBe('herausfordernd');
    });
  });

  describe('Keine neue Mechanik', () => {
    it('nutzt nur Parameter des SchwierigkeitsPack', () => {
      for (const grad of Object.values(SCHWIERIGKEIT_GRAD)) {
        expect(grad.parameter.verschleiß_multiplikator).toBeDefined();
        expect(grad.parameter.pk_regeneration).toBeDefined();
        expect(grad.parameter.event_wahrscheinlichkeit).toBeDefined();
        expect(grad.parameter.schuldenlimit).toBeDefined();
        expect(grad.parameter.zinsfaktor).toBeDefined();
        expect(grad.parameter.budget_zuschuss).toBeDefined();
      }
    });

    it('enthält keine Callback- oder Mechanik-Felder', () => {
      for (const grad of Object.values(SCHWIERIGKEIT_GRAD)) {
        const keys = Object.keys(grad.parameter);
        expect(keys).not.toContain('callback');
        expect(keys).not.toContain('funktion');
        expect(keys).not.toContain('mechanik');
      }
    });
  });
});
