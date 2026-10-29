/**
 * REPL-Parsing-Tests (US-M0-14, FR-048): der Loop nimmt zwei Eingaben pro Turn — Allokation und
 * Entscheidung. Beide Parser haben für jede ungültige Eingabe einen Grund, niemals einen Absturz.
 */
import { describe, expect, it } from 'vitest';
import { Readable, Writable } from 'node:stream';

import {
  entscheidungAusText,
  entscheidungsListe,
  interaktiverLoop,
  zuteilungAusText,
} from '@staatslenker/cli/repl';

const kategorien = ['infrastruktur', 'bildung', 'gesundheit', 'wirtschaft', 'forschung'];

describe('Allokations-Eingabe', () => {
  it('nimmt eine Positionsliste in Kategorie-Reihenfolge', () => {
    const parsed = zuteilungAusText('2,2,2,2,2', kategorien);
    expect(parsed.ok).toBe(true);
    if (parsed.ok)
      expect(parsed.zuteilung).toEqual({
        infrastruktur: 2,
        bildung: 2,
        gesundheit: 2,
        wirtschaft: 2,
        forschung: 2,
      });
  });

  it('nimmt key=BE-Paare in beliebiger Reihenfolge', () => {
    const parsed = zuteilungAusText('bildung=4 infrastruktur=2', kategorien);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.zuteilung).toEqual({ bildung: 4, infrastruktur: 2 });
  });

  it('leer und 0 sind "kein Budget"', () => {
    expect(zuteilungAusText('', kategorien)).toEqual({ ok: true, zuteilung: {} });
    expect(zuteilungAusText('0', kategorien)).toEqual({ ok: true, zuteilung: {} });
  });

  it('lehnt keine Zahl, negative Zahl und zu viele Werte ab — mit Grund', () => {
    expect(zuteilungAusText('zwei', kategorien).ok).toBe(false);
    expect(zuteilungAusText('-2', kategorien).ok).toBe(false);
    expect(zuteilungAusText('1,1,1,1,1,1', kategorien).ok).toBe(false);
    if (!zuteilungAusText('1,1,1,1,1,1', kategorien).ok) {
      expect((zuteilungAusText('1,1,1,1,1,1', kategorien) as { grund: string }).grund).toContain(
        'budgetbare Kategorien',
      );
    }
    expect(zuteilungAusText('bildung=x', kategorien).ok).toBe(false);
    expect(zuteilungAusText('bildung', kategorien).ok).toBe(false);
  });
});

describe('Entscheidungs-Eingabe', () => {
  it('nimmt die Nummer und die Regel-Id', () => {
    expect(entscheidungAusText('3')).toEqual({ ok: true, id: 'entscheidung:gesundheit' });
    expect(entscheidungAusText('entscheidung:forschung')).toEqual({
      ok: true,
      id: 'entscheidung:forschung',
    });
  });

  it('lehnt Nummer außerhalb der Liste und unbekannte Id ab — mit der Liste der Optionen', () => {
    const prüfung = entscheidungAusText('9');
    expect(prüfung.ok).toBe(false);
    if (!prüfung.ok) expect(prüfung.grund).toContain('entscheidung:infrastruktur');
    expect(entscheidungAusText('entscheidung:karten').ok).toBe(false);
    expect(entscheidungAusText('').ok).toBe(false);
  });

  it('zeigt die fünf Basis-Entscheidungen mit Nummer und Label (PO D10)', () => {
    const liste = entscheidungsListe();
    expect(liste.split('\n')).toHaveLength(5);
    expect(liste).toContain('1. Infrastruktur ausbauen');
    expect(liste).toContain('5. Forschung fördern');
  });
});

describe('Interaktiver Loop über Streams (US-M0-14)', () => {
  /**
   * Der Loop schreibt pro Frage die Prompt "> " — der Test liefert darauf genau eine Zeile. Damit
   * wird jede Frage mit genau einer Zeile beantwortet, ohne Timing-Raten.
   */
  async function spiele(zeilen: readonly string[]): Promise<string> {
    const input = new Readable({ read() {} });
    const lines: string[] = [];
    let next = 0;
    const output = new Writable({
      write(chunk, _enc, cb) {
        lines.push(String(chunk));
        if (String(chunk) === '> ' && next < zeilen.length) {
          input.push(`${zeilen[next++]}\n`);
        }
        cb();
      },
    });
    await interaktiverLoop({ seed: 1234, schwierigkeit: 'normal', jahre: 5 }, { input, output });
    input.destroy();
    return lines.join('');
  }

  it('spielt Turns mit gereichter Eingabe und endet bei q', async () => {
    const text = await spiele(['2,2,2,2,2', '1', '3,2,2,2,1', '2', 'q']);
    expect(text).toContain('Jahr 1');
    expect(text).toContain('Zuteilungen');
    expect(text).toContain('entscheidung:bildung');
    expect(text).toContain('Jahr 3');
  });

  it('bleibt nach einer ungültigen Eingabe im Loop und spielt weiter', async () => {
    // Drei definierte Fälle: Allokation über dem Budget wird vom Kern gekürzt (kein Wurf), eine
    // Entscheidung ohne BE auf ihrem Indikator wird abgelehnt, eine unbekannte Entscheidung wird
    // vom Parser abgelehnt. Der Loop fragt nach jeder Meldung erneut und spielt weiter.
    const text = await spiele([
      '2,2,2,2,2',
      '1',
      '5,0,0,0,0',
      'entscheidung:forschung',
      '2,2,2,2,2',
      '9',
      '2,2,2,2,2',
      '1',
      'q',
    ]);
    expect(text).toContain('Diese Entscheidung ist ungültig');
    expect(text).toContain('Diese Eingabe ist ungültig');
    expect(text).toContain('Jahr 3');
  });

  it('beendet das Spiel bei EOF ohne Absturz', async () => {
    const input = Readable.from(['2,2,2,2,2\n', '1\n']);
    const lines: string[] = [];
    const output = new Writable({
      write(chunk, _enc, cb) {
        lines.push(String(chunk));
        cb();
      },
    });
    await interaktiverLoop({ seed: 1234, schwierigkeit: 'normal', jahre: 5 }, { input, output });
    const text = lines.join('');
    expect(text).toContain('Entscheidung (Nummer oder Regel-Id)');
    expect(text).not.toContain('readline was closed');
  });
});
