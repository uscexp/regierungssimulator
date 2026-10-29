/**
 * CLI-Flag-Tests (US-M0-14): der Boot-Report nennt Kern und Turn-Runner, die Flags haben für jede
 * ungültige Eingabe einen Grund — der Einstieg fällt nie still auf Defaults zurück.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  STANDARD_JAHRE,
  STANDARD_SEED,
  boot,
  main,
  optionsAusArgs,
} from '@staatslenker/cli/cli-options';

describe('Flag-Parsing', () => {
  it('hat die Standardwerte des CI-Boots', () => {
    const parsed = optionsAusArgs([]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.optionen.seed).toBe(STANDARD_SEED);
      expect(parsed.optionen.schwierigkeit).toBe('normal');
      expect(parsed.optionen.jahre).toBe(STANDARD_JAHRE);
      expect(parsed.optionen.demo).toBe(false);
    }
  });

  it('nimmt seed, Schwierigkeit, Jahre und demo', () => {
    const parsed = optionsAusArgs([
      '--seed',
      '42',
      '--schwierigkeit',
      'schwer',
      '--jahre',
      '3',
      '--demo',
    ]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.optionen).toEqual({ seed: 42, schwierigkeit: 'schwer', jahre: 3, demo: true });
    }
  });

  it('lehnt eine unbekannte Flag und kapute Werte ab — mit Grund', () => {
    expect(optionsAusArgs(['--ui']).ok).toBe(false);
    if (!optionsAusArgs(['--ui']).ok) {
      expect((optionsAusArgs(['--ui']) as { grund: string }).grund).toContain(
        'Unbekannte Flag "--ui"',
      );
    }
    expect(optionsAusArgs(['--seed', 'x']).ok).toBe(false);
    expect(optionsAusArgs(['--schwierigkeit', 'mittel']).ok).toBe(false);
    expect(optionsAusArgs(['--jahre', '0']).ok).toBe(false);
    expect(optionsAusArgs(['--jahre']).ok).toBe(false);
  });
});

describe('Boot-Report', () => {
  it('meldet den geladenen Kern und den Turn-Runner', () => {
    const report = boot({ seed: 1234, schwierigkeit: 'normal', jahre: 6, demo: true });
    expect(report).toContain('Kern geladen: ja');
    expect(report).toContain('Turn-Runner: ja');
    expect(report).toContain('Schwierigkeit normal');
    expect(report).toContain('Seed 1234');
  });
});

describe('Einstieg (Exit-Code)', () => {
  it('gibt 1 für ungültige Flags und 0 für eine gespielte Demonstration', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(await main(['--schwierigkeit', 'mittel'])).toBe(1);
      expect(log.mock.calls[0]?.[0]).toContain('CLI:');
      expect(await main(['--demo', '--jahre', '2'])).toBe(0);
    } finally {
      log.mockRestore();
    }
  });
});
