# Staatslenker — Regierungssimulator

Ein rundenbasiertes Strategiespiel über Regierungsführung: Du regierst eine generische Nation,
balancierst Machterhalt gegen Fortschritt und siehst zu, wie jede Entscheidung sichtbare Folgen hat.

**Kernfantasie:** „Ich regiere ein Land. Jede Entscheidung hat sichtbare Folgen — ich balanciere Machterhalt gegen Fortschritt.“

Sprache des Spiels: Deutsch. Einzelspieler, diskreter Jahres-Turn, offline spielbare Web-App.

## Kernloop (ein Jahr)

1. **Lagebericht** — News-Feed erzählt die Zahlen, statt sie als Tabelle zu zeigen
2. **Budget verteilen** — Einnahmen = Steuermodell × Wirtschaft, Deficit bis Schuldenlimit
3. **Entscheidungen/Gesetze** — 2–5 Karten pro Jahr, jede mit Vorhersage der Effekte
4. **Auflösung** — Indikatoren und Gruppenzufriedenheit aktualisiert, Event-Checks
5. **Machtcheck** — Wahl alle N Jahre oder Putsch-Roll (Diktatur)

Der eigentliche Engpass ist **politisches Kapital**, nicht das Budget: Machterhalt ist das Spielziel.

Das Spiel startet mit zwei Setup-Spielzügen: **Regierungsform** und **Konstitution** — die Konstitution
setzt die Baseline für alle Zufriedenheit und alle Event-Wahrscheinlichkeiten und ist später nur per
Referendum mit hohem Risiko änderbar.

## Drei Registerschichten

| Schicht | Inhalt |
|---|---|
| Staatsindikatoren | 7 Level 0–100 (Infrastruktur, Bildung, Gesundheit, Wirtschaft, Forschung, Recht & Freiheit, Sicherheit), bewegt durch `budget_wirkung + ereignis_delta − verschleiss` |
| Bevölkerungsgruppen | 8 Gruppen mit Zufriedenheit 0–100 und Gewicht = Bevölkerungsanteil, bedingt über Gewicht-Matrizen auf Indikatoren |
| Machtregister | Legitimität, Opposition, Extremismus-Anteil (Radikalisierungskurve), Wahl/Putsch |

Komplexität entsteht durch Verknüpfung, nicht durch Masse.

## Repositories-Struktur

Der Kern ist eine pure Funktion `(state, action, rules, rng) → state'` und kennt kein DOM. UI und CLI
sind Adapter auf derselben Engine — der Kern wird nie ein zweites Mal geschrieben.

```
core/          deterministische Simulation: state, tick, rng (mulberry32), invariant, save, rules, eval
content/base/  Basis-Regelsatz als TS-Objekte, validiert gegen dasselbe Zod-Schema
loader/        YAML-Pack-Loader: js-yaml + Zod, atomische Validierung (Expansion-Pack = Dateien, kein Code)
cli/           Text-UI (M0) + AutoSim-Balance-Harness
app/           Svelte 5 + Vite Dashboard (M5) — sieht nur Snapshots, sendet Actions
docs/          Spielkonzept, Spezifikation, Architektur (ADR-001…010), Akzeptanzkriterien, Balance-Werte, Backlog
```

**Ansetzpunkte:**
- `docs/spielkonzept.md` — Vision, Kernloop, Meilensteine M0–M6
- `docs/spezifikation.md` — Requirements FR/NFR, User Stories
- `docs/architektur.md` — Schichten, Tech-Stack, Failure-Modes, 10 ADRs
- `docs/akzeptanzkriterien.md` — testbare Kriterien je User Story
- `docs/balance-werte.md` — fixierte Werte (Verschleiß, Gewichte, Schuldenkurve, Extremismus)
- `docs/backlog.csv` — 100 User Stories, sortiert nach Meilenstein

## Toolchain

TypeScript strict, eine Sprache für alles. npm workspaces, vitest, Zod als Schema-Quelle der Wahrheit,
Vite für den Build, localStorage für Saves. Kein Server, keine Datenbank.

```bash
npm install     # einmalig
npm run typecheck
npm test        # vitest
npm run lint
npm run dev     # CLI-Runner (Text-UI, M0)
```

## Meilensteine

| Meilenstein | Ziel | Akzeptanz |
|---|---|---|
| M0 | Core-Loop im Terminal | Spiel durchspielbar, Zufriedenheitsformel im Log sichtbar |
| M1 | Regierungsform + Konstitution | Konstitution ändert Wahlmechanik und Event-Wahrscheinlichkeiten |
| M2 | Krisen & Extremismus | Pandemie (3 Stufen), Finanzkrise, Radikalisierungskurve |
| M3 | Gesetze-Katalog | ~30 Karten mit Vorhersage, Cooldowns, PK-Kosten; keine dominante Strategie |
| M4 | Regelsatz-Engine + Mod-Format | neues Group+Decision-Pack ohne Code-Änderung ladbar |
| M5 | UI-Polish | Dashboard, Heatmap, News-Feed; neue Spieler verstehen ≥5 Turns ohne Tutorial |
| M6 | Score, Schwierigkeit, Sound | replaybar mit seedbarer RNG |

Reihenfolge: Kern + Balance-Harness zuerst, UI zuletzt. Der Balance-Harness ist das schnellste Lernen —
die Zufriedenheitsformel ist das Risiko des Konzepts.

## Aktuelle Status

Doku steht vollständig (Konzept, Spezifikation, Architektur, Akzeptanzkriterien, Balance-Werte, Backlog).
Der Code ist ein Skelett: Packages, Toolchain und ein Smoke-Test laufen, die Engine ist noch nicht gebaut.

## Nicht-Ziele

Keine Militär-/Kriegssimulation, kein Multiplayer (Nachrüstung über server-authoritative lockstep ist
architektonisch offengehalten, ADR-007), keine echte Volkswirtschaftsgleichungen, kein Echtzeit-Modus,
keine realen Ländernamen.

## Lizenz

MIT — siehe `LICENSE`. Mod-Packs und Erweiterungen sind ausdrücklich gewünscht (M4).
