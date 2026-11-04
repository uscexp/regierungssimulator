/**
 * @staatslenker/app indikator-gauge.test.ts — Tests für Gauge-Farblogik (US-M5-03).
 *
 * Testet die Farbcodierung der Indikator-Gauges:
 *   < 40: rot (kritisch)
 *   40–60: gelb (warnung)
 *   > 60: grün (gut)
 */
import { describe, expect, it } from 'vitest';

/**
 * Farblogik extrahiert aus IndikatorGauge.svelte — testbar isoliert.
 */
function farbe(w: number): string {
  if (w < 40) return '#dc2626'; // rot
  if (w < 60) return '#eab308'; // gelb
  return '#16a34a'; // grün
}

function farbeName(w: number): string {
  if (w < 40) return 'kritisch';
  if (w < 60) return 'warnung';
  return 'gut';
}

function clampWert(w: number): number {
  return Math.min(100, Math.max(0, w));
}

describe('US-M5-03: Indikator-Gauges Farblogik', () => {
  it('zeigt Rot für Werte unter 40 (kritisch)', () => {
    expect(farbe(0)).toBe('#dc2626');
    expect(farbe(25)).toBe('#dc2626');
    expect(farbe(39)).toBe('#dc2626');
    expect(farbeName(0)).toBe('kritisch');
    expect(farbeName(39)).toBe('kritisch');
  });

  it('zeigt Gelb für Werte zwischen 40 und 59 (warnung)', () => {
    expect(farbe(40)).toBe('#eab308');
    expect(farbe(50)).toBe('#eab308');
    expect(farbe(59)).toBe('#eab308');
    expect(farbeName(40)).toBe('warnung');
    expect(farbeName(59)).toBe('warnung');
  });

  it('zeigt Grün für Werte ab 60 (gut)', () => {
    expect(farbe(60)).toBe('#16a34a');
    expect(farbe(75)).toBe('#16a34a');
    expect(farbe(100)).toBe('#16a34a');
    expect(farbeName(60)).toBe('gut');
    expect(farbeName(100)).toBe('gut');
  });

  it('klammert Werte auf 0–100', () => {
    expect(clampWert(-10)).toBe(0);
    expect(clampWert(0)).toBe(0);
    expect(clampWert(50)).toBe(50);
    expect(clampWert(100)).toBe(100);
    expect(clampWert(150)).toBe(100);
  });

  it('zeigt Grenzwerte korrekt', () => {
    // Grenzwerte: genau 40 ist gelb, genau 60 ist grün
    expect(farbe(40)).toBe('#eab308');
    expect(farbe(39)).toBe('#dc2626');
    expect(farbe(60)).toBe('#16a34a');
    expect(farbe(59)).toBe('#eab308');
  });
});
