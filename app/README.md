# app/ — Web-Adapter (M5)

Svelte 5 + Vite Dashboard. Dieser Ordner ist ein **Adapter**: er importiert den Kern,
konsumiert Snapshots und sendet Actions — er berechnet keine eigene Simulation (ADR-002).

Bewusst noch kein Framework installiert: die UI kommt in der Build-Order zuletzt
(architektur.md §7), weil der Kern und der Balance-Harness das schnellste Lernen liefern.

Sichtbare Flächen (docs/spielkonzept.md §7):

- Dashboard: Indikator-Gauges + Gruppen-Heatmap + Budget-Slider + Politisches-Kapital-Balken
- Decision-Karten mit Vorhersage (Dry-Run von `tick` mit RNG-Fork, ADR-009)
- News-Feed als Primärinterface
- Tooltip „Wer ist sauer und warum?“ aus `zufriedenheits_trace` (ADR-008)

Der Ordner ist aus dem Root-`tsconfig.json` ausgeschlossen, bis Svelte/Vite gesetzt wird.
