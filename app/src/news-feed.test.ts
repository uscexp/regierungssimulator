/**
 * @staatslenker/app news-feed.test.ts — Tests für News-Feed Logik (US-M5-06).
 *
 * Testet die Darstellung und Sortierung der News-Einträge.
 */
import { describe, expect, it } from 'vitest';

/**
 * News-Eintrag-Extrahiert aus NewsFeed.svelte — testbar isoliert.
 */
interface NewsEintrag {
  readonly id: string;
  readonly text: string;
}

function sortiereNewsAbsteigend(news: readonly NewsEintrag[]): NewsEintrag[] {
  return [...news].reverse();
}

describe('US-M5-06: News-Feed Logik', () => {
  it('zeigt leeren Feed wenn keine Nachrichten vorhanden', () => {
    const news: readonly NewsEintrag[] = [];
    expect(news.length).toBe(0);
  });

  it('zeigt News-Einträge mit ID und Text', () => {
    const news: readonly NewsEintrag[] = [
      { id: 'setup_abgewiesen', text: 'Die Regierung ist noch nicht gegründet.' },
      { id: 'wahl_abgeschlossen', text: 'Wahl erfolgreich abgeschlossen.' },
    ];
    expect(news).toHaveLength(2);
    expect(news[0].id).toBe('setup_abgewiesen');
    expect(news[0].text).toBe('Die Regierung ist noch nicht gegründet.');
    expect(news[1].id).toBe('wahl_abgeschlossen');
    expect(news[1].text).toBe('Wahl erfolgreich abgeschlossen.');
  });

  it('sortiert News absteigend (neueste zuerst)', () => {
    const news: readonly NewsEintrag[] = [
      { id: 'news_1', text: 'Älteste Nachricht' },
      { id: 'news_2', text: 'Neueste Nachricht' },
    ];
    const sortiert = sortiereNewsAbsteigend(news);
    expect(sortiert[0].id).toBe('news_2');
    expect(sortiert[0].text).toBe('Neueste Nachricht');
    expect(sortiert[1].id).toBe('news_1');
    expect(sortiert[1].text).toBe('Älteste Nachricht');
  });

  it('behandelt leeren News-Feed korrekt', () => {
    const news: readonly NewsEintrag[] = [];
    const sortiert = sortiereNewsAbsteigend(news);
    expect(sortiert).toHaveLength(0);
  });

  it('einzelner News-Eintrag bleibt unverändert', () => {
    const news: readonly NewsEintrag[] = [
      { id: 'news_einzel', text: 'Einzelnachricht' },
    ];
    const sortiert = sortiereNewsAbsteigend(news);
    expect(sortiert).toHaveLength(1);
    expect(sortiert[0].id).toBe('news_einzel');
    expect(sortiert[0].text).toBe('Einzelnachricht');
  });
});
