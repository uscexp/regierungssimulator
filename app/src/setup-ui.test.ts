import { describe, expect, it } from 'vitest';

import { setupAnwendenAusUI, setupStartState, setupPflicht, regierungsformen, konstitutionsEntscheidungen } from './setup-ui.js';

describe('US-M5-02: Setup-Phase UI-Adapter', () => {
  it('liefert die Regierungsformen aus dem Register', () => {
    const formen = regierungsformen();
    expect(formen).toHaveLength(1);
    expect(formen[0]).toBe('praesidential');
  });

  it('liefert die Konstitutions-Entscheidungen aus dem Register', () => {
    const entscheidungen = konstitutionsEntscheidungen();
    expect(entscheidungen.length).toBeGreaterThan(0);
    expect(entscheidungen[0]).toMatchObject({
      regel_id: expect.any(String),
      label: expect.any(String),
      beschreibung: expect.any(String),
      sofort_effekte: expect.any(Object),
    });
  });

  it('liefert die Setup-Pflicht aus dem Register', () => {
    const pflicht = setupPflicht();
    expect(pflicht.konstitutions_ids.length).toBeGreaterThan(0);
    expect(pflicht.entscheidungen.length).toBeGreaterThan(0);
    expect(pflicht.steuerlast).toBeDefined();
  });

  it('wendet den Setup erfolgreich an und gibt einen neuen State zurück', () => {
    const startState = setupStartState(42);
    const pflicht = setupPflicht();
    const entscheidungen = konstitutionsEntscheidungen();
    const ids = entscheidungen.map((e) => e.regel_id);

    const konstitution: Record<string, string | boolean> = {};
    for (const entscheidung of entscheidungen) {
      konstitution[entscheidung.regel_id] = entscheidung.regelsatz_modifikator.steuermodell ?? true;
    }

    const ergebnis = setupAnwendenAusUI(
      startState,
      'praesidential',
      ids,
      konstitution,
      pflicht,
    );

    expect(ergebnis.erfolgreich).toBe(true);
    expect(ergebnis.state).toBeDefined();
    expect(ergebnis.uiState).toBeDefined();
    expect(ergebnis.uiState!.jahr).toBe(1);
    expect(ergebnis.uiState!.legitimität).toBe(50);
    expect(ergebnis.grund).toBeUndefined();
  });

  it('lehnt eine unbekannte Regierungsform ab', () => {
    const startState = setupStartState(42);
    const pflicht = setupPflicht();
    const entscheidungen = konstitutionsEntscheidungen();
    const ids = entscheidungen.map((e) => e.regel_id);

    const konstitution: Record<string, string | boolean> = {};
    for (const entscheidung of entscheidungen) {
      konstitution[entscheidung.regel_id] = entscheidung.regelsatz_modifikator.steuermodell ?? true;
    }

    const ergebnis = setupAnwendenAusUI(
      startState,
      'unbekannte-form',
      ids,
      konstitution,
      pflicht,
    );

    expect(ergebnis.erfolgreich).toBe(false);
    expect(ergebnis.grund).toBeDefined();
    expect(ergebnis.state).toBeUndefined();
    expect(ergebnis.uiState).toBeUndefined();
  });

  it('lehnt leere konstitutions_ids ab', () => {
    const startState = setupStartState(42);
    const pflicht = setupPflicht();

    const ergebnis = setupAnwendenAusUI(
      startState,
      'praesidential',
      [],
      {},
      pflicht,
    );

    expect(ergebnis.erfolgreich).toBe(false);
    expect(ergebnis.grund).toBeDefined();
  });
});
