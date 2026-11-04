import { describe, expect, it } from 'vitest';

import { erstelleUIAdapter, type UIAdapter, type UIState } from './ui-adapter.js';

describe('US-M5-01: UI-Adapter (readonly Snapshots + Actions)', () => {
  it('erstellt einen initialen State mit Standardwerten', () => {
    const adapter = erstelleUIAdapter('normal', 42);

    expect(adapter.state.jahr).toBe(1);
    expect(adapter.state.legitimität).toBe(50);
    expect(adapter.state.politisches_kapital).toBe(5);
    expect(adapter.state.schulden).toBe(0);
    expect(adapter.state.radikalisierung).toBe(10);
    expect(adapter.state.indikatoren).toBeDefined();
    expect(adapter.state.gruppen).toBeDefined();
  });

  it('spielt einen Tick mit Zuteilung und gibt neuen State zurück', () => {
    const adapter = erstelleUIAdapter('normal', 42);
    const vor = adapter.state;

    const nach = adapter.spieleTick({ infrastruktur: 2, bildung: 2, gesundheit: 2, wirtschaft: 2, forschung: 2 });

    expect(nach.jahr).toBe(2);
    expect(nach).not.toBe(vor); // neuer Snapshot, nicht mutiert
    expect(nach.indikatoren).not.toBe(vor.indikatoren); // neuer Record
  });

  it('der UIState ist readonly — die UI kann den Kern nicht mutieren', () => {
    const adapter = erstelleUIAdapter('normal', 42);

    // @ts-expect-error — UIState ist readonly, Zuweisung sollte fehlschlagen
    adapter.state.jahr = 999;
    // @ts-expect-error — indikatoren ist readonly
    adapter.state.indikatoren.infrastruktur = 999;

    expect(adapter.state.jahr).toBe(1);
    expect(adapter.state.indikatoren.infrastruktur).toBe(40);
  });

  it('reset setzt den State auf einen neuen Start-State zurück', () => {
    const adapter = erstelleUIAdapter('normal', 42);

    adapter.spieleTick({ infrastruktur: 5 });
    expect(adapter.state.jahr).toBe(2);

    adapter.reset(99);
    expect(adapter.state.jahr).toBe(1);
    expect(adapter.state.legitimität).toBe(50);
  });

  it('funktioniert mit verschiedenen Schwierigkeitsgraden', () => {
    const leicht = erstelleUIAdapter('leicht', 42);
    const schwer = erstelleUIAdapter('schwer', 42);

    expect(leicht.regeln).toBeDefined();
    expect(schwer.regeln).toBeDefined();
    expect(leicht.regeln.schwierigkeit).not.toBe(schwer.regeln.schwierigkeit);
  });

  it('UIState enthält alle erwarteten Felder', () => {
    const adapter = erstelleUIAdapter('normal', 42);
    const state: UIState = adapter.state;

    expect(typeof state.jahr).toBe('number');
    expect(typeof state.legitimität).toBe('number');
    expect(typeof state.politisches_kapital).toBe('number');
    expect(typeof state.schulden).toBe('number');
    expect(typeof state.radikalisierung).toBe('number');
    expect(Array.isArray(state.gruppen)).toBe(true);
    expect(state.gruppen.length).toBeGreaterThan(0);
    expect(state.gruppen[0]).toMatchObject({ tag: expect.any(String), zufriedenheit: expect.any(Number) });
  });
});
