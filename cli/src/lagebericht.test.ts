/**
 * Lagebericht-Tests (US-M0-15, FR-041): der Bericht erzählt die Lage — Jahr, Bewegung, schwächste
 * Gruppe, Finanzlage in BE, Macht, Gedächtnis, Machtcheck und Spielende. Er rechnet nichts selbst.
 */
import { describe, expect, it } from 'vitest';

import { startState, tickRegelnFür } from '@staatslenker/cli/content-pack';
import { lagebericht } from '@staatslenker/cli/lagebericht';
import { turn } from '@staatslenker/cli/turn';
import { beschlussEintragen } from '@staatslenker/core/beschlüsse';
import { tick } from '@staatslenker/core/tick';

const regeln = tickRegelnFür('normal');
const gleichmaessig = { infrastruktur: 2, bildung: 2, gesundheit: 2, wirtschaft: 2, forschung: 2 };

describe('Lagebericht erzählt die Lage', () => {
  it('nennt Jahr, Indikator-Set, Gruppen und den nächsten Machtcheck', () => {
    const text = lagebericht(startState(1234), regeln);
    expect(text).toContain('Jahr 1');
    expect(text).toContain('8 Indikatoren');
    expect(text).toContain('8 Gruppen');
    expect(text).toContain('wirtschaft 45.0');
    expect(text).toContain('gewichtete Ø');
    expect(text).toContain('schwächste Gruppe');
    expect(text).toContain('Nächster Machtcheck: Jahr 6 (Zyklus 6 Jahre)');
  });

  it('zeigt die Finanzlage in BE mit Einnahmen, Unterhalt, Zinsen, Spielraum und Limit', () => {
    const state = startState(1234);
    const ergebnis = turn(state, regeln, {
      zuteilung: { infrastruktur: 2, bildung: 2, gesundheit: 2, wirtschaft: 2, forschung: 2 },
      entscheidung_id: 'entscheidung:infrastruktur',
    });
    const text = lagebericht(ergebnis.ergebnis.state, regeln, {
      vorher: state,
      ergebnis: ergebnis.ergebnis,
    });
    expect(text).toContain('BE Einnahmen');
    expect(text).toContain('BE Unterhalt');
    expect(text).toContain('Spielraum');
    expect(text).toContain('Limit 100');
  });

  it('zeigt die Bewegung gegen den letzten Snapshot', () => {
    const vorher = startState(1234);
    const ergebnis = turn(vorher, regeln, {
      zuteilung: { infrastruktur: 2 },
      entscheidung_id: 'entscheidung:infrastruktur',
    });
    const text = lagebericht(ergebnis.ergebnis.state, regeln, { vorher });
    // Infrastruktur: +2 BE * 0.5 Wirkung − 3 Verschleiß = −2 Level.
    expect(text).toContain('infrastruktur 38.0 (−2.0)');
  });

  it('meldet einen verlorenen Machtcheck als Spielende mit der Regel-Id des Packs', () => {
    let state = startState(1234);
    let nach = '';
    for (let jahr = 1; jahr <= 6; jahr++) {
      const ergebnis = turn(state, regeln, {
        zuteilung: { infrastruktur: 2, bildung: 2, gesundheit: 2, wirtschaft: 2, forschung: 2 },
        entscheidung_id: 'entscheidung:infrastruktur',
      });
      nach = ergebnis.lagebericht_nach;
      state = ergebnis.ergebnis.state;
    }
    expect(nach).toContain('Machtcheck Jahr 6: VERLOREN');
    expect(nach).toContain('wahl:gewichtete_unter_47');
    expect(nach).toContain('Spiel beendet');
  });

  it('rendert das Entscheidungsgedächtnis mit Regel-Id und Wirkdauer (FR-006/FR-009)', () => {
    // Das Gedächtnis wird in M0 nicht gefüllt (Karten sind M3) — der Bericht rendert, was der Kern schreibt.
    const state = beschlussEintragen(startState(1234), {
      regel_id: 'karte:infra_ausbau',
      wirkung: [{ ziel: 'indikatoren', tag: 'infrastruktur', delta: 4 }],
    });
    const text = lagebericht(state, regeln);
    expect(text).toContain('karte:infra_ausbau bis Jahr 3');
  });

  it('nennt eine Budget-Allokation im Gedächtnis als Entscheidung ohne Nachwirkung (PO-Ruling zu US-M0-14)', () => {
    const ergebnis = turn(startState(1234), regeln, {
      zuteilung: gleichmaessig,
      entscheidung_id: 'entscheidung:bildung',
    });
    expect(ergebnis.lagebericht_nach).toContain(
      'entscheidung:bildung (Beschluss Jahr 1, ohne Nachwirkung)',
    );
  });

  it('sagt dem Spieler, wenn eine Allokation auf den Spielraum gekürzt wurde (FR-041, PO-Ruling)', () => {
    const state = Object.freeze({ ...startState(1234), schulden: 100 });
    const ergebnis = tick(state, { zuteilung: { bildung: 50 } }, regeln, 'dev');
    const text = lagebericht(ergebnis.state, regeln, {
      vorher: state,
      ergebnis,
      gekuerzte_be: ergebnis.gekuerzte_be,
    });
    expect(text).toContain('Budget-Allokation auf den verfügbaren Spielraum gekürzt');
    expect(text).toContain('BE nicht ausgegeben');
  });

  it('meldet die M0-Limitation der Zufriedenheitsspuren, statt nichts zu zeigen (ADR-008, PO-Ruling)', () => {
    const text = lagebericht(startState(1234), regeln);
    expect(text).toContain(
      'Spuren: aktuell nicht verfügbar (M0-Limitation nach ADR-008, M1-Ticket)',
    );
  });

  it('rendert die Gründe, warum eine Gruppe sauer ist (ADR-008)', () => {
    // Der Bericht rendert den Trace, der Kern schreibt ihn — hier wird ein Trace gereicht, weil der
    // Tick die Spur am Jahrsanfang aus den *alten* Leveln rechnet (core/tick.ts, zufriedenheitsSpuren):
    // in M0 ist der Trace dadurch immer leer, ein Fund, kein Render-Fehler.
    const state = Object.freeze({
      ...startState(1234),
      zufriedenheits_trace: Object.freeze({
        arbeitnehmer: Object.freeze([
          Object.freeze({ grund_id: 'zufriedenheit:level', delta: -2.4 }),
        ]),
      }),
    });
    const text = lagebericht(state, regeln);
    expect(text).toContain('Gründe:');
    expect(text).toContain('zufriedenheit:level');
    expect(text).toContain('-2.4');
  });
});
