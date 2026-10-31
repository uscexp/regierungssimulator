/**
 * cli/setup-phase.test — die Setup-Phase des Adapters (US-M1-02, FR-047, Verdikt D22).
 *
 * Der Adapter fragt nur (Form, dann Konstitution) und rechnet nichts: die Karten sind gerenderte
 * Content-Daten, der Snapshot kommt aus `core/setup.setupAnwenden`. Jede ungültige Eingabe hat einen
 * Grund, niemals einen Absturz. Die Setup-Pflicht kommt aus dem geladenen Register, nicht aus einer
 * Adapter-Option — zwei Adapter bei identischen Regeln gate'n identisch (ADR-002).
 */
import { describe, expect, it } from 'vitest';

import { SETUP_PFLICHT, STANDARD_SETUP, basisKonstitution } from '@staatslenker/cli/content-pack';
import {
  konstitutionsKarten,
  konstitutionAusText,
  formsListe,
  formAusText,
  setupState,
  spielRegelnFür,
} from '@staatslenker/cli/setup-phase';

describe('Form-Eingabe (FR-047: zuerst die Form)', () => {
  it('nimmt den Namen und die Nummer aus dem Register', () => {
    expect(formAusText('praesidential')).toEqual({ ok: true, form: 'praesidential' });
    expect(formAusText('1')).toEqual({ ok: true, form: 'praesidential' });
    expect(formsListe()).toContain('1. praesidential');
  });

  it('lehnt eine unbekannte Form mit Grund ab — das Register liefert die Formen, der Kern nicht', () => {
    const parsed = formAusText('diktatur');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.grund).toContain('Unbekannte Regierungsform "diktatur"');
    expect(formAusText('2,2,2,2,2').ok).toBe(false);
    expect(formAusText('').ok).toBe(false);
  });
});

describe('Konstitution-Eingabe', () => {
  it('übernimmt die Entscheidungen des Registers mit Enter, "ja" oder "y"', () => {
    expect(konstitutionAusText('').ok).toBe(true);
    expect(konstitutionAusText('ja').ok).toBe(true);
    expect(konstitutionAusText('Y').ok).toBe(true);
  });

  it('lehnt eine unbekannte Antwort mit Grund ab', () => {
    const parsed = konstitutionAusText('nein');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.grund).toContain('Unbekannte Antwort "nein"');
  });
});

describe('Konstitutions-Karten sind sichtbar (AC US-M1-04)', () => {
  it('jede Karte zeigt Label, Regel-Id, Beschreibung, Sofort-Effekte und Dauer-Modifikator', () => {
    const karten = konstitutionsKarten();
    for (const entscheidung of basisKonstitution.entscheidungen) {
      expect(karten).toContain(entscheidung.label);
      expect(karten).toContain(entscheidung.regel_id);
      expect(karten).toContain('Sofort-Effekte:');
      expect(karten).toContain('Dauer-Modifikator:');
    }
    // Die Steuermodell-Karte zeigt "keine" Sofort-Effekte mit Begründung statt eines leeren Feldes.
    expect(karten).toContain('keine (die Wirkung ist im Modell gerechnet)');
    expect(karten).toContain('steuermodell flat');
    expect(karten).toContain('event-faktor 0.8');
  });
});

describe('Setup-State und Regelsatz (D22: Pflicht aus dem Register)', () => {
  it('der Standard-Setup erfüllt die Setup-Pflicht des Registers', () => {
    expect(setupState(424242, 'praesidential').setup?.konstitutions_ids).toEqual(
      SETUP_PFLICHT.konstitutions_ids,
    );
    expect(STANDARD_SETUP.konstitutions_ids).toEqual(
      basisKonstitution.entscheidungen.map((e) => e.regel_id),
    );
  });

  it('der Spielsatz trägt die Setup-Pflicht aus dem Content, der Harness-Satz nicht', () => {
    expect(spielRegelnFür('normal').setup_pflicht).toEqual(SETUP_PFLICHT);
    expect(spielRegelnFür('normal').news_vorlagen?.setup_abgewiesen).toBeTruthy();
  });

  it('der Setup-State serialisiert die Setup-Phase, ein Harness-Start nicht (M0-Messbasis)', async () => {
    const { startState } = await import('@staatslenker/cli/content-pack');
    expect(JSON.stringify(startState(424242)).includes('"setup"')).toBe(false);
    expect(JSON.stringify(setupState(424242, 'praesidential')).includes('"setup"')).toBe(true);
  });
});
