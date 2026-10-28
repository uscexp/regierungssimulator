import { describe, expect, it } from 'vitest';

import {
  ZUFRIEDENHEIT_BASELINE,
  gewichteteZufriedenheit,
  gruppenZufriedenheit,
  schwachsteZufriedenheit,
  steuerlastFuer,
  steuermodellAusKonstitution,
  zufriedenheitBerechnen,
  type SteuerlastTabelle,
} from '@staatslenker/core/zufriedenheit';
import type { GruppenSnapshot } from '@staatslenker/core/state';

/** Steuerlast aus balance-werte.md §3 — Content-Fixture, kein Kern-Wert. */
const steuerlast: SteuerlastTabelle = {
  unternehmen: { niedrig: 0, flat: 4, progressiv: 8, hoch: 12 },
  arbeitnehmer: { niedrig: 2, flat: 4, progressiv: 3, hoch: 8 },
  bildung_jugend: { niedrig: 2, flat: 4, progressiv: 3, hoch: 8 },
};

const gruppe = (
  tag: string,
  gewichte: Record<string, number>,
  anteil: number,
  zufriedenheit = 0,
): GruppenSnapshot => ({
  tag,
  zufriedenheit,
  bevölkerungsanteil: anteil,
  gewichte,
});

describe('Zufriedenheitsformel (FR-003, US-M0-06)', () => {
  it('bei Startlevel 40 und Gewicht Σ=1 liegt die Gruppe bei 50, mit flat-Steuerlast bei 46 (AC)', () => {
    const indikatoren = { wirtschaft: 40, infrastruktur: 40 };
    const g = gruppe('unternehmen', { wirtschaft: 0.55, infrastruktur: 0.45 }, 100);

    expect(zufriedenheitBerechnen(g, indikatoren, 0)).toBe(ZUFRIEDENHEIT_BASELINE + 40);
    expect(zufriedenheitBerechnen(g, indikatoren, steuerlast.unternehmen!.flat)).toBe(46);
  });

  it('gewichtete Ø-Zufriedenheit der Bevölkerung ist 46.0 bei Anteile Σ=100 % (AC)', () => {
    const indikatoren = {
      infrastruktur: 40,
      bildung: 40,
      gesundheit: 40,
      wirtschaft: 40,
      forschung: 40,
    };
    const gruppen = gruppenZufriedenheit(
      [
        gruppe('unternehmen', { wirtschaft: 0.55, infrastruktur: 0.45 }, 21.3),
        gruppe('arbeitnehmer', { wirtschaft: 0.45, gesundheit: 0.55 }, 51.1),
        gruppe('bildung_jugend', { bildung: 0.85, forschung: 0.15 }, 27.7),
      ],
      indikatoren,
      'flat',
      steuerlast,
    );
    expect(gruppen.every((g) => g.zufriedenheit === 46)).toBe(true);
    expect(gewichteteZufriedenheit(gruppen)).toBeCloseTo(46.0, 10);
  });

  it('die Formel hat keine zusätzlichen Terme — das Ergebnis ist exakt baseline + Σgewichte·level − steuerlast (AC)', () => {
    const indikatoren = { wirtschaft: 62, infrastruktur: 21, bildung: 33 };
    const g = gruppe('arbeitnehmer', { wirtschaft: 0.6, infrastruktur: 0.2, bildung: 0.2 }, 51.1);
    const erwartet =
      ZUFRIEDENHEIT_BASELINE + (0.6 * 62 + 0.2 * 21 + 0.2 * 33) - steuerlast.arbeitnehmer!.flat;
    expect(zufriedenheitBerechnen(g, indikatoren, steuerlast.arbeitnehmer!.flat)).toBe(erwartet);

    // Ein nicht-per-Budget-Tag im Gewicht zählt als 0 statt den Wert zu verschieben.
    const mitFremdemTag = { ...g, gewichte: { ...g.gewichte, sicherheit: 0 } };
    expect(zufriedenheitBerechnen(mitFremdemTag, indikatoren, steuerlast.arbeitnehmer!.flat)).toBe(
      erwartet,
    );
  });

  it('M0-Anker aus D10/D12: Gruppen 49.24/49.21/46.0, Start-Ø 48.33 (nicht 46 und nicht 48.4)', () => {
    // Renormierung aus D10: die §12-Gewichte werden auf die in M0 vorhandenen Tags skaliert
    // (unternehmen .55+.30=0.85, arbeitnehmer .45+.25=0.70, bildung_jugend .60+.25=0.85) und die
    // Anteile auf Σ=100 (10/24/13 von 47). Die gerundeten Docs-Werte 21.3/51.1/27.7 summieren auf
    // 100.1 — mit ihnen fällt die Ø auf 48.3 statt 48.4; gemeldet an Trix/Reto.
    const indikatoren = {
      infrastruktur: 40,
      bildung: 40,
      gesundheit: 40,
      wirtschaft: 45,
      forschung: 40,
    };
    const gruppen = gruppenZufriedenheit(
      [
        gruppe(
          'unternehmen',
          { wirtschaft: 0.55 / 0.85, infrastruktur: 0.3 / 0.85 },
          (10 / 47) * 100,
        ),
        gruppe('arbeitnehmer', { wirtschaft: 0.45 / 0.7, gesundheit: 0.25 / 0.7 }, (24 / 47) * 100),
        gruppe('bildung_jugend', { bildung: 0.6 / 0.85, forschung: 0.25 / 0.85 }, (13 / 47) * 100),
      ],
      indikatoren,
      'flat',
      steuerlast,
    );
    // Die Docs-Anker sind auf zwei Dezimalen gerundet (49.24 / 49.21 / 46.00); getestet wird der
    // gerundete Wert, damit die Rundungsgrenze (49.235) nicht als Abweichung durchfällt.
    const aufZweiGerundet = (wert: number) => Math.round(wert * 100) / 100;
    // Nachgerechnet mit exakt renormierten Anteilen (Σ=100) ergibt die Formel **48.33**, nicht 48.4.
    // Der Docs-Anker 48.4 entsteht nur, wenn die gerundeten Anteile 21.3/51.1/27.7 als Σ=100
    // behandelt werden — die gerundeten Werte summieren aber auf 100.1. Gemeldet an Trix/Reto:
    // K4-Aussage "Anteile Σ=100 ✓" hält für die gerundete M0-Tabelle nicht; der Loader normalisiert.
    expect(aufZweiGerundet(gruppen[0]!.zufriedenheit)).toBe(49.24);
    expect(aufZweiGerundet(gruppen[1]!.zufriedenheit)).toBe(49.21);
    expect(aufZweiGerundet(gruppen[2]!.zufriedenheit)).toBe(46.0);
    expect(aufZweiGerundet(gewichteteZufriedenheit(gruppen))).toBe(48.33);
    expect(aufZweiGerundet(schwachsteZufriedenheit(gruppen))).toBe(46.0);
  });

  it('Ergebnisse werden geclampt: ein sehr hoher Level endet bei 100, ein Absturz bei 0', () => {
    const hoch = gruppe('unternehmen', { wirtschaft: 1 }, 21.3);
    expect(zufriedenheitBerechnen(hoch, { wirtschaft: 200 }, 0)).toBe(100);
    expect(zufriedenheitBerechnen(hoch, { wirtschaft: -50 }, 12)).toBe(0);
  });

  it('der Konstitutions-Modifikator moduliert ±8 (M1) und der alte Snapshot bleibt unverändert (ADR-002)', () => {
    const indikatoren = { wirtschaft: 40, infrastruktur: 40 };
    const alt = gruppe('unternehmen', { wirtschaft: 0.55, infrastruktur: 0.45 }, 21.3);
    const neu = gruppenZufriedenheit([alt], indikatoren, 'flat', steuerlast, 8);
    expect(neu[0]!.zufriedenheit).toBe(54);
    expect(alt.zufriedenheit).toBe(0);
    expect(neu[0]).not.toBe(alt);
  });

  it('ein fehlender Steuerlast-Eintrag ist 0 — ein Pack ohne Steuerlast bestraft niemanden', () => {
    expect(
      zufriedenheitBerechnen(gruppe('landwirte', { wirtschaft: 1 }, 8), { wirtschaft: 40 }, 0),
    ).toBe(50);
  });
});

describe('Steuermodell aus der Konstitution (US-M0-07)', () => {
  const indikatoren = { wirtschaft: 45, infrastruktur: 40, gesundheit: 40 };

  it('bei "hoch" ist die Last von Unternehmen höher als die der Arbeitnehmer und die Zufriedenheit entsprechend niedriger (AC)', () => {
    const gruppen = gruppenZufriedenheit(
      [
        gruppe('unternehmen', { wirtschaft: 0.55, infrastruktur: 0.45 }, 21.3),
        gruppe('arbeitnehmer', { wirtschaft: 0.45, gesundheit: 0.55 }, 51.1),
      ],
      indikatoren,
      'hoch',
      steuerlast,
    );

    expect(steuerlast.unternehmen!.hoch).toBeGreaterThan(steuerlast.arbeitnehmer!.hoch);
    expect(gruppen[0]!.zufriedenheit).toBeLessThan(gruppen[1]!.zufriedenheit);
    expect(gruppen[0]!.zufriedenheit).toBe(10 + (0.55 * 45 + 0.45 * 40) - 12);
    expect(gruppen[1]!.zufriedenheit).toBe(10 + (0.45 * 45 + 0.55 * 40) - 8);
  });

  it('die Steuerlast-Tabelle aus balance-werte.md §3 ist exakt die Werte-Quelle für alle vier Modelle', () => {
    // progressiv ist für Arbeitnehmer *niedriger* als flat (3 vs 4) — das ist Absicht: die
    // progressive Last trifft Unternehmen (8), nicht die Arbeitnehmer. Eine monotone Reihenfolge
    // der Modelle ist deshalb keine Invariante; getestet werden die Tabellenwerte.
    expect(steuerlast.unternehmen).toEqual({ niedrig: 0, flat: 4, progressiv: 8, hoch: 12 });
    expect(steuerlast.arbeitnehmer).toEqual({ niedrig: 2, flat: 4, progressiv: 3, hoch: 8 });
    expect(steuerlast.bildung_jugend).toEqual({ niedrig: 2, flat: 4, progressiv: 3, hoch: 8 });
    // AC-Kern: bei progressiv und hoch zahlt Unternehmen mehr als Arbeitnehmer. Bei "niedrig"
    // zahlt Unternehmen 0 und die Arbeitnehmer 2 — die Reihenfolge der Gruppen kehrt sich dort um.
    for (const modell of ['progressiv', 'hoch'] as const) {
      expect(steuerlastFuer('unternehmen', modell, steuerlast)).toBeGreaterThan(
        steuerlastFuer('arbeitnehmer', modell, steuerlast),
      );
    }
    expect(steuerlastFuer('unternehmen', 'niedrig', steuerlast)).toBeLessThan(
      steuerlastFuer('arbeitnehmer', 'niedrig', steuerlast),
    );
  });

  it('bei "niedrig" zahlt Unternehmen 0 — die Zufriedenheit ist dann nur baseline + gewichtete Level', () => {
    const unternehmen = gruppe('unternehmen', { wirtschaft: 0.55, infrastruktur: 0.45 }, 21.3);
    expect(zufriedenheitBerechnen(unternehmen, indikatoren, steuerlast.unternehmen!.niedrig)).toBe(
      10 + 0.55 * 45 + 0.45 * 40,
    );
  });

  it('das Steuermodell kommt aus der Konstitution; leer ist im Dev-Modus "flat", in Produktion ein Fehler mit Regel-Id', () => {
    expect(steuermodellAusKonstitution({ steuermodell: 'hoch' })).toBe('hoch');
    expect(steuermodellAusKonstitution({})).toBe('flat');
    expect(steuermodellAusKonstitution({ steuermodell: 'progressiv' }, 'produktion')).toBe(
      'progressiv',
    );

    expect(() => steuermodellAusKonstitution({}, 'produktion')).toThrow(/steuermodell/);
    expect(() => steuermodellAusKonstitution({ steuermodell: 'vip' }, 'produktion')).toThrow(
      /steuermodell/,
    );
  });
});
