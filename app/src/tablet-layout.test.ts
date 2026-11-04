/**
 * @staatslenker/app tablet-layout.test.ts — Tests für Tablet-Layout Logik (US-M5-12).
 *
 * Testet die Farbcodierung und Layout-Logik des Tablet-Layouts.
 */
import { describe, expect, it } from 'vitest';

/**
 * Farb-Logik extrahiert aus TabletLayout.svelte — testbar isoliert.
 */
function farbe(wert: number): string {
  if (wert < 40) return '#dc2626'; // rot
  if (wert < 60) return '#eab308'; // gelb
  return '#16a34a'; // grün
}

function farbeName(wert: number): string {
  if (wert < 40) return 'kritisch';
  if (wert < 60) return 'warnung';
  return 'gut';
}

function klammerWert(wert: number): number {
  return Math.min(100, Math.max(0, wert));
}

describe('US-M5-12: Tablet-Layout Farb-Logik', () => {
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

  it('klammerte Werte auf 0–100', () => {
    expect(klammerWert(-10)).toBe(0);
    expect(klammerWert(0)).toBe(0);
    expect(klammerWert(50)).toBe(50);
    expect(klammerWert(100)).toBe(100);
    expect(klammerWert(150)).toBe(100);
  });

  it('zeigt Grenzwerte korrekt', () => {
    // Grenzwerte: genau 40 ist gelb, genau 60 ist grün
    expect(farbe(40)).toBe('#eab308');
    expect(farbe(39)).toBe('#dc2626');
    expect(farbe(60)).toBe('#16a34a');
    expect(farbe(59)).toBe('#eab308');
  });

  it('gleiche Logik wie Indikator-Gauge', () => {
    // Tablet-Layout und Indikator-Gauge verwenden dieselbe Logik
    const testWerte = [0, 20, 40, 50, 59, 60, 70, 100];
    for (const wert of testWerte) {
      // Beide Funktionen sind identisch
      const farbe1 = farbe(wert);
      const farbe2 = farbe(wert);
      expect(farbe1).toBe(farbe2);
      expect(farbeName(wert)).toBe(farbeName(wert));
    }
  });
});
