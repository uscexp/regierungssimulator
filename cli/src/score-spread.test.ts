/**
 * Score-Spread-Baseline (US-M0-18, FR-049): der Harness-Report wird gegen das committed Fixture
 * verglichen. Ein Content-Change, der die Verteilung verschiebt, fällt hier im CI auf.
 */
import { describe, expect, it } from 'vitest';

import { GOLDEN_SPREAD_HASH, GOLDEN_SPREAD_REPORT } from '../fixtures/score-spread.golden.js';
import { alleLäufe, ANZAHL_SEEDS, MAX_JAHRE, SCHWIERIGKEITEN, STRATEGIE_IDS } from './autosim.js';
import { scoreSpreadHash, scoreSpreadReport, spreadZeilen } from './score-spread.js';

describe('Score-Spread-Fixture (US-M0-18)', () => {
  it('der Harness-Report ist identisch mit dem hinterlegten Fixture', () => {
    const report = scoreSpreadReport();
    expect(report.split('\n')).toEqual(GOLDEN_SPREAD_REPORT);
    expect(scoreSpreadHash(report)).toBe(GOLDEN_SPREAD_HASH);
  });

  it('der Report ist wiederholbar: derselbe Harness-Lauf ergibt denselben Hash', () => {
    const erster = scoreSpreadReport(alleLäufe(MAX_JAHRE));
    const zweiter = scoreSpreadReport(alleLäufe(MAX_JAHRE));
    expect(scoreSpreadHash(zweiter)).toBe(scoreSpreadHash(erster));
  });

  it('der Report deckt alle 12 Kombinationen ab (4 Strategien × 3 Schwierigkeiten)', () => {
    const zeilen = spreadZeilen(alleLäufe(MAX_JAHRE));
    expect(zeilen).toHaveLength(STRATEGIE_IDS.length * SCHWIERIGKEITEN.length);
    expect(GOLDEN_SPREAD_REPORT[0]).toContain(`${ANZAHL_SEEDS} Seeds`);
    for (const schwierigkeit of SCHWIERIGKEITEN) {
      for (const strategie of STRATEGIE_IDS) {
        expect(
          zeilen.some((z) => z.strategie === strategie && z.schwierigkeit === schwierigkeit),
        ).toBe(true);
      }
    }
  });

  it('jede Kombination endet Jahr 6 mit wahl:gewichtete_unter_47, ohne Defizit und ohne Spar-Event (AK US-M0-17)', () => {
    const zeilen = spreadZeilen(alleLäufe(MAX_JAHRE));
    for (const z of zeilen) {
      expect(z.erste_niederlage).toEqual({ jahr: 6, grund_id: 'wahl:gewichtete_unter_47' });
      expect(z.defizit_jahre).toHaveLength(0);
      expect(z.spar_jahre).toHaveLength(0);
      expect(z.überlebt_min).toBe(6);
    }
  });
});
