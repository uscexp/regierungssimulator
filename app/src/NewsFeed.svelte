<script lang="ts">
  /**
   * @staatslenker/app NewsFeed — Nachrichten-Feed für Spielereignisse (US-M5-06).
   *
   * Zeigt News-Einträge aus dem Spielkern an. Jeder Eintrag hat eine ID und einen Text.
   * Die neuesten Nachrichten werden oben angezeigt.
   *
   * Der Adapter liest readonly Snapshots; die News-Feed rendert nur.
   */
  export let news: readonly { readonly id: string; readonly text: string }[] = [];
</script>

<div class="news-feed">
  <h2>News-Feed</h2>
  {#if news.length === 0}
    <div class="news-empty">Noch keine Nachrichten.</div>
  {/else}
    <ul class="news-list">
      {#each news.reverse() as eintrag}
        <li class="news-eintrag">
          <span class="news-id">{eintrag.id}</span>
          <span class="news-text">{eintrag.text}</span>
        </li>
      {/each}
    </ul>
  {/each}
</div>

<style>
  .news-feed {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
  }

  .news-feed h2 {
    font-size: 1rem;
    color: #1e293b;
    margin: 0 0 0.75rem 0;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .news-empty {
    color: #64748b;
    font-size: 0.85rem;
    font-style: italic;
  }

  .news-list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 300px;
    overflow-y: auto;
  }

  .news-eintrag {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.85rem;
  }

  .news-eintrag:last-child {
    border-bottom: none;
  }

  .news-id {
    font-weight: 600;
    color: #3b82f6;
    min-width: 120px;
    font-size: 0.8rem;
  }

  .news-text {
    color: #334155;
    flex: 1;
  }
</style>
