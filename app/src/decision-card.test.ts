/**
 * @staatslenker/app decision-card.test.ts — Tests für Decision-Karten Vorhersage (US-M5-07).
 *
 * Testet die Berechnung der Vorhersagen für Entscheidungs-Karten Optionen.
 */
import { describe, expect, it } from 'vitest';

/**
 * Vorhersage-Logik extrahiert aus DecisionCard.svelte — testbar isoliert.
 */
function berechneVorhersage(
  indikatoren: Record<string, number>,
  gruppen: { tag: string; zufriedenheit: number }[],
  legitimität: number,
  politisches_kapital: number,
  schulden: number,
  radikalisierung: number,
  effekte: readonly { readonly ziel: string; readonly tag?: string; readonly delta: number }[],
) {
  const neueIndikatoren = { ...indikatoren };
  const neueGruppen = gruppen.map((g) => ({ ...g, zufriedenheit: g.zufriedenheit }));
  let neueLegitimität = legitimität;
  let neuePK = politisches_kapital;
  let neueSchulden = schulden;
  let neueRadikalisierung = radikalisierung;

  for (const effekt of effekte) {
    if (effekt.ziel === 'indikatoren' && effekt.tag) {
      neueIndikatoren[effekt.tag] = Math.min(100, Math.max(0, (neueIndikatoren[effekt.tag] ?? 0) + effekt.delta));
    } else if (effekt.ziel === 'gruppen' && effekt.tag) {
      const gruppe = neueGruppen.find((g) => g.tag === effekt.tag);
      if (gruppe) {
        gruppe.zufriedenheit = Math.min(100, Math.max(0, gruppe.zufriedenheit + effekt.delta));
      }
    } else if (effekt.ziel === 'legitimitaet') {
      neueLegitimität = Math.min(100, Math.max(0, neueLegitimität + effekt.delta));
    } else if (effekt.ziel === 'radikalisierung') {
      neueRadikalisierung = Math.min(100, Math.max(0, neueRadikalisierung + effekt.delta));
    } else if (effekt.ziel === 'politisches_kapital') {
      neuePK = Math.min(12, Math.max(0, neuePK + effekt.delta));
    } else if (effekt.ziel === 'schulden') {
      neueSchulden = Math.max(0, neueSchulden + effekt.delta);
    }
  }

  return {
    indikatoren: neueIndikatoren,
    gruppen: neueGruppen,
    legitimität: neueLegitimität,
    politisches_kapital: neuePK,
    schulden: neueSchulden,
    radikalisierung: neueRadikalisierung,
  };
}

describe('US-M5-07: Decision-Karten Vorhersage', () => {
  it('wendet Indikator-Effekte korrekt an', () => {
    const r = berechneVorhersage(
      { infrastruktur: 40, bildung: 40 },
      [],
      50, 5, 0, 10,
      [{ ziel: 'indikatoren', tag: 'infrastruktur', delta: 3 }],
    );
    expect(r.indikatoren.infrastruktur).toBe(43);
    expect(r.indikatoren.bildung).toBe(40);
  });

  it('wendet Gruppen-Effekte korrekt an', () => {
    const r = berechneVorhersage(
      {},
      [{ tag: 'arbeitnehmer', zufriedenheit: 50 }],
      50, 5, 0, 10,
      [{ ziel: 'gruppen', tag: 'arbeitnehmer', delta: 5 }],
    );
    expect(r.gruppen[0].zufriedenheit).toBe(55);
  });

  it('ändert Legitimität korrekt', () => {
    const r = berechneVorhersage(
      {}, [], 50, 5, 0, 10,
      [{ ziel: 'legitimitaet', delta: -3 }],
    );
    expect(r.legitimität).toBe(47);
  });

  it('ändert Politisches Kapital korrekt', () => {
    const r = berechneVorhersage(
      {}, [], 50, 5, 0, 10,
      [{ ziel: 'politisches_kapital', delta: -2 }],
    );
    expect(r.politisches_kapital).toBe(3);
  });

  it('ändert Schulden korrekt', () => {
    const r = berechneVorhersage(
      {}, [], 50, 5, 10, 10,
      [{ ziel: 'schulden', delta: -5 }],
    );
    expect(r.schulden).toBe(5);
  });

  it('ändert Radikalisierung korrekt', () => {
    const r = berechneVorhersage(
      {}, [], 50, 5, 0, 10,
      [{ ziel: 'radikalisierung', delta: 5 }],
    );
    expect(r.radikalisierung).toBe(15);
  });

  it('klammerte Indikatoren auf 0–100', () => {
    const r = berechneVorhersage(
      { infrastruktur: 98 },
      [], 50, 5, 0, 10,
      [{ ziel: 'indikatoren', tag: 'infrastruktur', delta: 10 }],
    );
    expect(r.indikatoren.infrastruktur).toBe(100);
  });

  it('klammerte Indikatoren nicht unter 0', () => {
    const r = berechneVorhersage(
      { infrastruktur: 5 },
      [], 50, 5, 0, 10,
      [{ ziel: 'indikatoren', tag: 'infrastruktur', delta: -10 }],
    );
    expect(r.indikatoren.infrastruktur).toBe(0);
  });

  it('klammerte PK auf 0–12', () => {
    const r = berechneVorhersage(
      {}, [], 50, 12, 0, 10,
      [{ ziel: 'politisches_kapital', delta: 5 }],
    );
    expect(r.politisches_kapital).toBe(12);
  });

  it('änderte keine Unbekannten-Ziele', () => {
    const r = berechneVorhersage(
      { infrastruktur: 40 }, [], 50, 5, 0, 10,
      [{ ziel: 'budget', delta: 5 }],
    );
    expect(r.indikatoren.infrastruktur).toBe(40);
    expect(r.schulden).toBe(0);
  });
});
