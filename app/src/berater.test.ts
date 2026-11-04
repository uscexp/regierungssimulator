/**
 * @staatslenker/app berater.test.ts — Tests für Berater-Empfehlungen (US-M5-09).
 *
 * Testet die Berater-Logik für verschiedene Spielzustände.
 */
import { describe, expect, it } from 'vitest';

/**
 * Berater-Logik extrahiert aus Berater.svelte — testbar isoliert.
 */
interface UIStateMock {
  indikatoren: Record<string, number>;
  gruppen: { tag: string; zufriedenheit: number }[];
  legitimität: number;
  radikalisierung: number;
  politisches_kapital: number;
}

interface BeraterEmpfehlung {
  titel: string;
  text: string;
  dringlichkeit: 'niedrig' | 'mittel' | 'hoch';
  aktion: string;
}

function berechneEmpfehlung(
  typ: string,
  state: UIStateMock,
): BeraterEmpfehlung {
  const indikatoren = state.indikatoren;
  const gruppen = state.gruppen;

  switch (typ) {
    case 'wirtschaft': {
      const wirtschaft = indikatoren.wirtschaft ?? 50;
      const infrastruktur = indikatoren.infrastruktur ?? 50;
      if (wirtschaft < 40) {
        return {
          titel: 'Wirtschaftskrise droht',
          text: 'Die Wirtschaft schwächelt drastisch. Sofortige Investitionen in Infrastruktur und Wirtschaft sind notwendig, um einen Zusammenbruch zu vermeiden.',
          dringlichkeit: 'hoch',
          aktion: 'Wirtschaft und Infrastruktur stark fördern',
        };
      } else if (wirtschaft < 60) {
        return {
          titel: 'Wirtschaftliche Schwäche',
          text: 'Die Wirtschaft ist anfällig. Gezielte Investitionen können die Resilienz erhöhen.',
          dringlichkeit: 'mittel',
          aktion: 'Wirtschaft moderat fördern',
        };
      } else {
        return {
          titel: 'Wirtschaft stabil',
          text: 'Die Wirtschaft ist stabil. Weiterhin vorsichtig investieren, um das Wachstum zu sichern.',
          dringlichkeit: 'niedrig',
          aktion: 'Ausgewogen investieren',
        };
      }
    }
    case 'soziales': {
      const unzufriedeneGruppen = gruppen.filter((g) => g.zufriedenheit < 50);
      if (unzufriedeneGruppen.length > 2) {
        return {
          titel: 'Hohe soziale Unzufriedenheit',
          text: 'Viele Gruppen sind unzufrieden. Sofortige soziale Maßnahmen sind notwendig, um Unruhen zu vermeiden.',
          dringlichkeit: 'hoch',
          aktion: 'Soziale Maßnahmen für unzufriedene Gruppen ergreifen',
        };
      } else if (unzufriedeneGruppen.length > 0) {
        return {
          titel: 'Einzelne unzufriedene Gruppen',
          text: 'Einige Gruppen sind unzufrieden. Gezielte Maßnahmen können die Zufriedenheit steigern.',
          dringlichkeit: 'mittel',
          aktion: 'Betroffene Gruppen gezielt unterstützen',
        };
      } else {
        return {
          titel: 'Hohe Zufriedenheit',
          text: 'Die Bevölkerungsgruppen sind zufrieden. Weiterhin auf Ausgewogenheit achten.',
          dringlichkeit: 'niedrig',
          aktion: 'Aktuellen Kurs beibehalten',
        };
      }
    }
    case 'sicherheit': {
      const sicherheit = indikatoren.sicherheit ?? 50;
      const radikalisierung = state.radikalisierung;
      if (sicherheit < 40 || radikalisierung > 70) {
        return {
          titel: 'Sicherheitskrise',
          text: 'Die Sicherheit ist kritisch und die Radikalisierung steigt. Sofortige Maßnahmen zur inneren Sicherheit sind notwendig.',
          dringlichkeit: 'hoch',
          aktion: 'Sicherheitsmaßnahmen verstärken und Radikalisierung bekämpfen',
        };
      } else if (sicherheit < 60 || radikalisierung > 50) {
        return {
          titel: 'Sicherheitsbedenken',
          text: 'Die Sicherheit ist mangelhaft und die Radikalisierung steigt. Präventive Maßnahmen sind ratsam.',
          dringlichkeit: 'mittel',
          aktion: 'Sicherheitsmaßnahmen moderat verstärken',
        };
      } else {
        return {
          titel: 'Sicherheit stabil',
          text: 'Die Sicherheit ist stabil. Weiterhin vorsichtig agieren, um den Zustand zu sichern.',
          dringlichkeit: 'niedrig',
          aktion: 'Aktuellen Sicherheitskurs beibehalten',
        };
      }
    }
    case 'bildung': {
      const bildung = indikatoren.bildung ?? 50;
      const forschung = indikatoren.forschung ?? 50;
      if (bildung < 40) {
        return {
          titel: 'Bildungsnotstand',
          text: 'Die Bildung ist kritisch niedrig. Ohne sofortige Investitionen droht langfristiger wirtschaftlicher Niedergang.',
          dringlichkeit: 'hoch',
          aktion: 'Bildung und Forschung stark fördern',
        };
      } else if (bildung < 60) {
        return {
          titel: 'Bildungslücken',
          text: 'Die Bildung ist mangelhaft. Gezielte Investitionen können die Grundlage für zukünftigen Wohlstand legen.',
          dringlichkeit: 'mittel',
          aktion: 'Bildung moderat fördern',
        };
      } else {
        return {
          titel: 'Bildung gut',
          text: 'Die Bildung ist auf einem guten Niveau. Weiterhin investieren, um die Spitzenstellung zu sichern.',
          dringlichkeit: 'niedrig',
          aktion: 'Bildungsniveau beibehalten',
        };
      }
    }
    case 'gesundheit': {
      const gesundheit = indikatoren.gesundheit ?? 50;
      if (gesundheit < 40) {
        return {
          titel: 'Gesundheitskrise',
          text: 'Das Gesundheitssystem ist kritisch belastet. Sofortige Investitionen sind notwendig, um eine Katastrophe zu vermeiden.',
          dringlichkeit: 'hoch',
          aktion: 'Gesundheitswesen stark fördern',
        };
      } else if (gesundheit < 60) {
        return {
          titel: 'Gesundheitliche Schwäche',
          text: 'Die Gesundheit ist mangelhaft. Präventive Maßnahmen können eine Verschlechterung verhindern.',
          dringlichkeit: 'mittel',
          aktion: 'Gesundheitswesen moderat fördern',
        };
      } else {
        return {
          titel: 'Gesundheit stabil',
          text: 'Die Gesundheit ist stabil. Weiterhin vorsichtig investieren, um das Niveau zu sichern.',
          dringlichkeit: 'niedrig',
          aktion: 'Aktuellen Gesundheitskurs beibehalten',
        };
      }
    }
  }
  throw new Error(`Unbekannter Beratertyp: ${typ}`);
}

describe('US-M5-09: Berater / Rat', () => {
  it('Wirtschaftsberater: Wirtschaftskrise bei niedrigem Wert', () => {
    const r = berechneEmpfehlung('wirtschaft', {
      indikatoren: { wirtschaft: 30 },
      gruppen: [],
      legitimität: 50,
      radikalisierung: 10,
      politisches_kapital: 5,
    });
    expect(r.titel).toContain('Wirtschaftskrise');
    expect(r.dringlichkeit).toBe('hoch');
    expect(r.aktion).toContain('Wirtschaft und Infrastruktur stark fördern');
  });

  it('Wirtschaftsberater: Stabil bei hohem Wert', () => {
    const r = berechneEmpfehlung('wirtschaft', {
      indikatoren: { wirtschaft: 70 },
      gruppen: [],
      legitimität: 50,
      radikalisierung: 10,
      politisches_kapital: 5,
    });
    expect(r.titel).toContain('Wirtschaft stabil');
    expect(r.dringlichkeit).toBe('niedrig');
  });

  it('Sozialberater: Hohe Unzufriedenheit bei >2 Gruppen unter 50', () => {
    const r = berechneEmpfehlung('soziales', {
      indikatoren: {},
      gruppen: [
        { tag: 'arbeitnehmer', zufriedenheit: 30 },
        { tag: 'unternehmen', zufriedenheit: 40 },
        { tag: 'bildung_jugend', zufriedenheit: 45 },
        { tag: 'gesundheit_wesen', zufriedenheit: 60 },
      ],
      legitimität: 50,
      radikalisierung: 10,
      politisches_kapital: 5,
    });
    expect(r.titel).toContain('Hohe soziale Unzufriedenheit');
    expect(r.dringlichkeit).toBe('hoch');
  });

  it('Sozialberater: Keine unzufriedenen Gruppen', () => {
    const r = berechneEmpfehlung('soziales', {
      indikatoren: {},
      gruppen: [
        { tag: 'arbeitnehmer', zufriedenheit: 60 },
        { tag: 'unternehmen', zufriedenheit: 70 },
      ],
      legitimität: 50,
      radikalisierung: 10,
      politisches_kapital: 5,
    });
    expect(r.titel).toContain('Hohe Zufriedenheit');
    expect(r.dringlichkeit).toBe('niedrig');
  });

  it('Sicherheitsberater: Sicherheitskrise bei niedriger Sicherheit', () => {
    const r = berechneEmpfehlung('sicherheit', {
      indikatoren: { sicherheit: 30 },
      gruppen: [],
      legitimität: 50,
      radikalisierung: 10,
      politisches_kapital: 5,
    });
    expect(r.titel).toContain('Sicherheitskrise');
    expect(r.dringlichkeit).toBe('hoch');
  });

  it('Bildungsberater: Bildungsnotstand bei niedrigem Wert', () => {
    const r = berechneEmpfehlung('bildung', {
      indikatoren: { bildung: 30 },
      gruppen: [],
      legitimität: 50,
      radikalisierung: 10,
      politisches_kapital: 5,
    });
    expect(r.titel).toContain('Bildungsnotstand');
    expect(r.dringlichkeit).toBe('hoch');
  });

  it('Gesundheitsberater: Gesundheitskrise bei niedrigem Wert', () => {
    const r = berechneEmpfehlung('gesundheit', {
      indikatoren: { gesundheit: 30 },
      gruppen: [],
      legitimität: 50,
      radikalisierung: 10,
      politisches_kapital: 5,
    });
    expect(r.titel).toContain('Gesundheitskrise');
    expect(r.dringlichkeit).toBe('hoch');
  });

  it('Bildungsberater: Gut bei hohem Wert', () => {
    const r = berechneEmpfehlung('bildung', {
      indikatoren: { bildung: 70 },
      gruppen: [],
      legitimität: 50,
      radikalisierung: 10,
      politisches_kapital: 5,
    });
    expect(r.titel).toContain('Bildung gut');
    expect(r.dringlichkeit).toBe('niedrig');
  });

  it('Alle 5 Beratertypen sind definiert', () => {
    const typen: string[] = ['wirtschaft', 'soziales', 'sicherheit', 'bildung', 'gesundheit'];
    typen.forEach((typ) => {
      const r = berechneEmpfehlung(typ, {
        indikatoren: {},
        gruppen: [],
        legitimität: 50,
        radikalisierung: 10,
        politisches_kapital: 5,
      });
      expect(r.titel).toBeDefined();
      expect(r.text).toBeDefined();
      expect(r.aktion).toBeDefined();
      expect(['niedrig', 'mittel', 'hoch']).toContain(r.dringlichkeit);
    });
  });
});
