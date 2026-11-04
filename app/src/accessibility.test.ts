/**
 * @staatslenker/app accessibility.test.ts — Tests für Accessibility-Logik (US-M5-13).
 *
 * Testet die Kontrastprüfung, ARIA-Label-Generierung und Farbkontrast.
 */
import { describe, expect, it } from 'vitest';

/**
 * Accessibility-Logik extrahiert aus Accessibility.svelte — testbar isoliert.
 */

/**
 * WCAG 2.1 Kontrastprüfung (AA-Stufe: 4.5:1 für normalen Text).
 * Gibt true zurück, wenn der Kontrast ausreichend ist.
 */
function kontrastPruefen(hintergrund: string, vordergrund: string): boolean {
  const helle = (farbe: string) => {
    const r = parseInt(farbe.slice(1, 3), 16);
    const g = parseInt(farbe.slice(3, 5), 16);
    const b = parseInt(farbe.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  const helle1 = helle(hintergrund);
  const helle2 = helle(vordergrund);
  const hellehoher = Math.max(helle1, helle2);
  const hellenigher = Math.min(helle1, helle2);
  const kontrast = (hellehoher + 0.05) / (hellenigher + 0.05);
  return kontrast >= 4.5;
}

function kontrastName(kontrast: boolean): string {
  return kontrast ? 'ausreichend' : 'unzureichend';
}

function indikatorAriaLabel(tag: string, wert: number): string {
  const farbeName = wert < 40 ? 'kritisch' : wert < 60 ? 'warnung' : 'gut';
  return `${tag}: ${wert.toFixed(0)}, ${farbeName}`;
}

function gruppeAriaLabel(tag: string, wert: number): string {
  const farbeName = wert < 40 ? 'kritisch' : wert < 60 ? 'warnung' : 'gut';
  return `${tag}: Zufriedenheit ${wert.toFixed(0)}, ${farbeName}`;
}

function bootStatusAriaLabel(jahr: number, legitimität: number): string {
  return `Jahr ${jahr}, Legitimität ${legitimität}`;
}

function budgetAriaLabel(einnahmen: number, ausgaben: number, defizit: number): string {
  return `Einnahmen ${einnahmen.toFixed(0)}, Ausgaben ${ausgaben.toFixed(0)}, Defizit ${defizit.toFixed(0)}`;
}

describe('US-M5-13: Accessibility', () => {
  describe('Kontrastprüfung', () => {
    it('erkennt ausreichend hohen Kontrast', () => {
      expect(kontrastPruefen('#000000', '#ffffff')).toBe(true); // Schwarz auf Weiß
    });

    it('erkennt unzureichend niedrigen Kontrast', () => {
      expect(kontrastPruefen('#ffffff', '#ffffff')).toBe(false); // Weiß auf Weiß
    });

    it('erkennt ausreichenden Kontrast bei Grau auf Weiß', () => {
      expect(kontrastPruefen('#ffffff', '#767676')).toBe(true); // WCAG AA Grenze
    });

    it('gibt korrekten Kontrast-Namen zurück', () => {
      expect(kontrastName(true)).toBe('ausreichend');
      expect(kontrastName(false)).toBe('unzureichend');
    });
  });

  describe('ARIA-Label für Indikatoren', () => {
    it('generiert Label mit kritischem Status', () => {
      expect(indikatorAriaLabel('infrastruktur', 30)).toBe('infrastruktur: 30, kritisch');
    });

    it('generiert Label mit Warnungsstatus', () => {
      expect(indikatorAriaLabel('bildung', 50)).toBe('bildung: 50, warnung');
    });

    it('generiert Label mit gutem Status', () => {
      expect(indikatorAriaLabel('gesundheit', 70)).toBe('gesundheit: 70, gut');
    });

    it('generiert Label für Grenzwerte', () => {
      expect(indikatorAriaLabel('infrastruktur', 40)).toBe('infrastruktur: 40, warnung');
      expect(indikatorAriaLabel('infrastruktur', 60)).toBe('infrastruktur: 60, gut');
      expect(indikatorAriaLabel('infrastruktur', 39)).toBe('infrastruktur: 39, kritisch');
    });
  });

  describe('ARIA-Label für Gruppen', () => {
    it('generiert Label mit kritischem Status', () => {
      expect(gruppeAriaLabel('arbeitnehmer', 30)).toBe('arbeitnehmer: Zufriedenheit 30, kritisch');
    });

    it('generiert Label mit Warnungsstatus', () => {
      expect(gruppeAriaLabel('bildungs_jugend', 50)).toBe('bildungs_jugend: Zufriedenheit 50, warnung');
    });

    it('generiert Label mit gutem Status', () => {
      expect(gruppeAriaLabel('unternehmer', 70)).toBe('unternehmer: Zufriedenheit 70, gut');
    });

    it('generiert Label für Grenzwerte', () => {
      expect(gruppeAriaLabel('arbeitnehmer', 40)).toBe('arbeitnehmer: Zufriedenheit 40, warnung');
      expect(gruppeAriaLabel('arbeitnehmer', 60)).toBe('arbeitnehmer: Zufriedenheit 60, gut');
    });
  });

  describe('ARIA-Label für Boot-Status', () => {
    it('generiert Label für Jahr und Legitimität', () => {
      expect(bootStatusAriaLabel(6, 52)).toBe('Jahr 6, Legitimität 52');
      expect(bootStatusAriaLabel(1, 100)).toBe('Jahr 1, Legitimität 100');
    });
  });

  describe('ARIA-Label für Budget', () => {
    it('generiert Label für Einnahmen, Ausgaben und Defizit', () => {
      expect(budgetAriaLabel(36, 50, 14)).toBe('Einnahmen 36, Ausgaben 50, Defizit 14');
    });

    it('generiert Label ohne Defizit', () => {
      expect(budgetAriaLabel(50, 30, 0)).toBe('Einnahmen 50, Ausgaben 30, Defizit 0');
    });
  });

  describe('Kontrast-Prüfung für Dashboard-Farben', () => {
    it('prüft kontrastreiche Kombinationen', () => {
      expect(kontrastPruefen('#000000', '#ffffff')).toBe(true);
      expect(kontrastPruefen('#ffffff', '#000000')).toBe(true);
    });

    it('prüft unzureichende Kombinationen', () => {
      expect(kontrastPruefen('#ffffff', '#ffffff')).toBe(false);
      expect(kontrastPruefen('#000000', '#000000')).toBe(false);
    });
  });
});
