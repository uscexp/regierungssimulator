/**
 * @staatslenker/app onboarding-test.test.ts — Tests für Onboarding-Test Logik (US-M5-11).
 *
 * Testet die Bewertung der Onboarding-Fragen und die Berechnung des Scores.
 */
import { describe, expect, it } from 'vitest';

/**
 * Onboarding-Logik extrahiert aus OnboardingTest.svelte — testbar isoliert.
 */
interface Frage {
  id: string;
  frage: string;
  optionen: { id: string; text: string; richtig: boolean }[];
  erklaerung: string;
}

interface AntwortErgebnis {
  titel: string;
  text: string;
  dringlichkeit: 'niedrig' | 'mittel' | 'hoch';
  aktion: string;
}

const FRAGEN: Frage[] = [
  {
    id: 'indikatoren',
    frage: 'Was stellen Indikatoren im Spiel dar?',
    optionen: [
      { id: 'a', text: 'Die Zufriedenheit der Bevölkerungsgruppen', richtig: false },
      { id: 'b', text: 'Die wichtigsten staatlichen Kennzahlen (z.B. Wirtschaft, Gesundheit, Bildung)', richtig: true },
      { id: 'c', text: 'Die Höhe der Staatsschulden', richtig: false },
      { id: 'd', text: 'Die Anzahl der Regierungsmitglieder', richtig: false },
    ],
    erklaerung: 'Indikatoren messen den Zustand wichtiger Staatsbereiche wie Wirtschaft, Bildung, Gesundheit, Infrastruktur und Forschung. Sie liegen zwischen 0 und 100.',
  },
  {
    id: 'zufriedenheit',
    frage: 'Wie wird die Zufriedenheit einer Bevölkerungsgruppe berechnet?',
    optionen: [
      { id: 'a', text: 'Durchschnitt aller Indikatoren', richtig: false },
      { id: 'b', text: 'Gewichteter Durchschnitt der Indikatoren, die für die Gruppe wichtig sind', richtig: true },
      { id: 'c', text: 'Nur der wichtigste Indikator', richtig: false },
      { id: 'd', text: 'Zufällig', richtig: false },
    ],
    erklaerung: 'Jede Gruppe gewichtet Indikatoren unterschiedlich (z.B. Arbeitnehmer gewichten Wirtschaft stark, Bildung_Jugend gewichtet Bildung stark). Die Zufriedenheit ist der gewichtete Durchschnitt.',
  },
  {
    id: 'legitimität',
    frage: 'Was bedeutet Legitimität im Spiel?',
    optionen: [
      { id: 'a', text: 'Wie viel Geld der Staat hat', richtig: false },
      { id: 'b', text: 'Wie sehr die Bevölkerung der Regierung vertraut', richtig: true },
      { id: 'c', text: 'Wie viele Karten der Spieler hat', richtig: false },
      { id: 'd', text: 'Wie viele Jahre die Regierung noch regiert', richtig: false },
    ],
    erklaerung: 'Legitimität misst das Vertrauen der Bevölkerung in die Regierung. Sie steigt mit Zufriedenheit und Konstitutionstreue, sinkt mit Skandalen und Zensur. Bei zu niedriger Legitimität verliert die Regierung die Wahl.',
  },
  {
    id: 'kapital',
    frage: 'Wofür wird Politisches Kapital (PK) verwendet?',
    optionen: [
      { id: 'a', text: 'Für den Kauf von Indikatoren', richtig: false },
      { id: 'b', text: 'Für das Spielen von Entscheidungskarten', richtig: true },
      { id: 'c', text: 'Für die Bezahlung von Steuern', richtig: false },
      { id: 'd', text: 'Für die Deaktivierung von Gruppen', richtig: false },
    ],
    erklaerung: 'Politisches Kapital (PK) ist der wichtigste Engpass im Spiel. Es wird benötigt, um Entscheidungskarten zu spielen. PK regeneriert sich jedes Jahr basierend auf der Legitimität.',
  },
  {
    id: 'entscheidungen',
    frage: 'Was sind Entscheidungen im Spiel?',
    optionen: [
      { id: 'a', text: 'Karten, die der Spieler spielen kann', richtig: false },
      { id: 'b', text: 'Konstitutionelle Grundentscheidungen mit dauerhaften Effekten', richtig: true },
      { id: 'c', text: 'Tägliche Regierungsakte', richtig: false },
      { id: 'd', text: 'Wahlversprechen', richtig: false },
    ],
    erklaerung: 'Entscheidungen sind konstitutionelle Grundentscheidungen (z.B. Steuermodell, Bildungsreform) mit dauerhaften Effekten auf Indikatoren und Gruppen. Sie werden in der Setup-Phase gewählt.',
  },
];

function berechneAntwort(
  frageId: string,
  antwortId: string,
): { richtig: boolean; erklaerung: string } {
  const frage = FRAGEN.find((f) => f.id === frageId);
  if (!frage) {
    throw new Error(`Unbekannte Frage: ${frageId}`);
  }

  const option = frage.optionen.find((o) => o.id === antwortId);
  if (!option) {
    throw new Error(`Unbekannte Antwort: ${antwortId}`);
  }

  return {
    richtig: option.richtig,
    erklaerung: frage.erklaerung,
  };
}

function berechneScore(
  antworten: { frageId: string; antwortId: string }[],
): { punktzahl: number; gesamt: number; prozent: number } {
  let richtige = 0;
  for (const antwort of antworten) {
    const ergebnis = berechneAntwort(antwort.frageId, antwort.antwortId);
    if (ergebnis.richtig) {
      richtige++;
    }
  }

  const gesamt = antworten.length;
  const prozent = gesamt === 0 ? 0 : (richtige / gesamt) * 100;

  return { punktzahl: richtige, gesamt, prozent };
}

describe('US-M5-11: Onboarding-Test', () => {
  it('bewertet eine richtige Antwort korrekt', () => {
    const ergebnis = berechneAntwort('indikatoren', 'b');
    expect(ergebnis.richtig).toBe(true);
    expect(ergebnis.erklaerung).toContain('Indikatoren messen');
  });

  it('bewertet eine falsche Antwort korrekt', () => {
    const ergebnis = berechneAntwort('indikatoren', 'a');
    expect(ergebnis.richtig).toBe(false);
    expect(ergebnis.erklaerung).toContain('Indikatoren messen');
  });

  it('berechnet den Punktzahl für alle richtigen Antworten', () => {
    const antworten = [
      { frageId: 'indikatoren', antwortId: 'b' },
      { frageId: 'zufriedenheit', antwortId: 'b' },
      { frageId: 'legitimität', antwortId: 'b' },
      { frageId: 'kapital', antwortId: 'b' },
      { frageId: 'entscheidungen', antwortId: 'b' },
    ];

    const ergebnis = berechneScore(antworten);
    expect(ergebnis.punktzahl).toBe(5);
    expect(ergebnis.gesamt).toBe(5);
    expect(ergebnis.prozent).toBe(100);
  });

  it('berechnet den Punktzahl für keine richtigen Antworten', () => {
    const antworten = [
      { frageId: 'indikatoren', antwortId: 'a' },
      { frageId: 'zufriedenheit', antwortId: 'a' },
      { frageId: 'legitimität', antwortId: 'a' },
      { frageId: 'kapital', antwortId: 'a' },
      { frageId: 'entscheidungen', antwortId: 'a' },
    ];

    const ergebnis = berechneScore(antworten);
    expect(ergebnis.punktzahl).toBe(0);
    expect(ergebnis.gesamt).toBe(5);
    expect(ergebnis.prozent).toBe(0);
  });

  it('berechnet den Punktzahl für gemischte Antworten', () => {
    const antworten = [
      { frageId: 'indikatoren', antwortId: 'b' },
      { frageId: 'zufriedenheit', antwortId: 'a' },
      { frageId: 'legitimität', antwortId: 'b' },
      { frageId: 'kapital', antwortId: 'a' },
      { frageId: 'entscheidungen', antwortId: 'b' },
    ];

    const ergebnis = berechneScore(antworten);
    expect(ergebnis.punktzahl).toBe(3);
    expect(ergebnis.gesamt).toBe(5);
    expect(ergebnis.prozent).toBe(60);
  });

  it('gibt 0% bei leeren Antworten', () => {
    const ergebnis = berechneScore([]);
    expect(ergebnis.punktzahl).toBe(0);
    expect(ergebnis.gesamt).toBe(0);
    expect(ergebnis.prozent).toBe(0);
  });

  it('wirft einen Fehler bei unbekannter Frage', () => {
    expect(() => berechneAntwort('unbekannt', 'a')).toThrow('Unbekannte Frage');
  });

  it('wirft einen Fehler bei unbekannter Antwort', () => {
    expect(() => berechneAntwort('indikatoren', 'z')).toThrow('Unbekannte Antwort');
  });
});
