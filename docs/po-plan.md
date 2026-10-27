# PO-Plan — „Staatslenker“ V1

**Product Owner:** @trix · Stand: 27. Okt (nach Handoff-Review von @reto, Zahlen gegen `backlog.csv` verifiziert)

## Produktvision
Ein replaybares, solo-playbares Strategiedspiel, in dem Regieren wirklich spielbar wird — terminal-first, deterministisch (seedbar), moddable über Content-Packs, vollständig deutsch. V1 beweist die Spielmechanik; UI-Polish und Persistenz folgen dem Kern.

## aktuelles Quartals-Thema
**„Den Kern beweisen“** — M0 bauen und die Balance mit echten Harness-Daten validieren. Kein Content und keine UI vor dem bewiesenen Kern.

## Priorisierte Backlog-Leiter (verifiziert: 100 Stories · 79 Must / 15 Should / 6 Could)

| Meilenstein | Stories | Must+Should-Tage | Gate (Abnahme) | PO-Notiz |
|---|---|---|---|---|
| M0 Core-Loop | 18 (16 M / 2 S) | 66 | Terminal komplett + Golden-Hash im CI + AutoSim-Harness mit Score-Spread | **PO-seitig freigabebereit**; Build-Go liegt bei Haui |
| M1 Form + Konstitution | 14 | 67 | 2 Konstitutionen → nachweisbar verschiedene Wahlmechanik/Event-Wahrs. | Startet erst nach M0-Gate |
| M2 Krisen + Extremismus | 15 | 63 | ≥ 1 Krise in ≥ 80 % der Harness-Runs; Ketten lösen immer | |
| M3 Gesetze-Katalog | 15 | 45 | ≥ 30 Karten; keine dominante Strategie; Dry-Run == echter Tick | Content-Packs (US-M3-07…11) parallelisierbar |
| M4 Regelsatz + Mod-Format | 11 | 41 | Beispiel-Pack ohne Code-Änderung ladbar; kaputtes Pack atomisch abgewiesen | Loader `US-M4-02` zuerst (implizit, §7) |
| M5 UI-Polish | 14 | 54 | 5 neue Spieler ≥ 5 Turns ohne Tutorial | **Gate braucht echte Testpersonen** → Rekrutierung ab M3 starten |
| M6 Finish | 13 | 41 | Seedbare Replaybarkeit; Save-Migration + Backup-Fallback getestet | Could-Audio ist verschiebbar |

Summe Must+Should: **377 Tage** (Must allein 332, Could 27, alle 404) — Größenordnung, kein Termin. Die ältere ~336-Zahl war ein Zählfehler; gültig ist 377. US-M0-01 ist teilweise gebaut (c77d497) und läuft als **in progress** weiter — die verbleibenden ≈ 61 Tage M0 enthalten die zwei fehlenden Script-Arbeiten dieser Story (build-Task pro Workspace, core-Isolation-Checker).

## M0-Sprint-Zerlegung (Build-Order architektur.md §7)

| Sprint | Stories | Fokus | Exit-Kriterium |
|---|---|---|---|
| S0-A Fundament | US-M0-01 🔶 **in progress** (AC-Lücken: `npm run build` fehlt, Isolation-Check-Skript fehlt), US-M0-02, 03, 04 (~4 Tage + 2 Script-Arbeiten) | Monorepo-Skelett existiert (c77d497), aber Story erfüllt ihre Akzeptanz erst mit build-Task pro Workspace + Checker, der core-Dependencies zu app/cli fehlschlägt; GameState, seedbarer RNG, Invariant/Clamp | Repo baut (`npm run build`) & testet; Isolation-Check schlägt bei Drift fehl; kein NaN möglich |
| S0-B Mechanik | US-M0-05, 07, 08, 09, 10, 06, 11 (~17 Tage) | Tick-Mechaniken → Zufriedenheitsformel → reiner `tick()` | Formel als reine Funktion; 06 nach 05+07 |
| S0-C Content + CLI | US-M0-13, 15, 14 (~11 Tage) | Basis-Content, Lagebericht, kompletter Terminal-Loop | Spiel von Jahr 1 bis Ende im CLI durchspielbar |
| S0-D Beweise | US-M0-16, 17, 18 (~13 Tage) | Golden-Replay, AutoSim-Harness, Score-Spread-Fixture | Gate erfüllt; **Kurven an @ralf für Verschleiß-Abgleich** |

**Checkpoint nach S0-D:** Der erste echte Harness-Lauf liefert die 3 Naiv-Kurven (30 Jahre × 20 Seeds) → @ralf justiert Verschleiß/Wirkung final. Das ist der geplante Balance-Nachlauf (~4–6 Tage Puffer), kein Scope-Change. Keine Kurven vor dem ersten echten Lauf erfinden.

## implizite Reihenfolge M4–M6 (formalisiert vom PO, aus §7 — Spec dokumentiert hier keine Kanten)
- M4: `US-M4-02` (Loader + Zod-Schema) → 03, 06, 07, 09 · Beispiel-Pack (07) zuletzt
- M5: `US-M5-01` (Snapshot-Adapter) → alle app-Stories · `US-M3-02 → US-M5-07` (Vorhersage vor Karten-UI) · Gate `US-M5-12` zuletzt
- M6: `US-M6-01` (Persistenz) → 02, 03, 04, 05 · Score/Schwierigkeit vor Audio

## Decision Log

| # | Entscheidung | Kontext | Alternativen | Begründung |
|---|---|---|---|---|
| D1 | **M0 PO-Freigabe erteilt** — 18 Stories, 66 Tage | Handoff-Review grün, Traceability 51/51 FR, keine offenen Regelentscheidungen | weiter validieren | Kern-Risiko (Balance §11) wird durch den Harness selbst beantwortet; warten bringt keine neuen Daten. **Build-Go muss Haui geben.** |
| D2 | **Reihenfolge M0→M1→M2→M3→M4→M5→M6 unverändert** | §7 minimiert Lern-Risiko | M5 früher, Content parallel | Balance vor Content ist nicht verhandelbar; Parallelität nur wo dokumentiert (M3-Packs, M4-Pack, M5 nach Adapter) |
| D3 | **Could-Stories (27 Tage) aus dem V1-Kernpfad genommen** | M4-Can, M5-2 Can, M6-3 Can (u. a. Audio) | mitbauen | V1-Gates sind Must+Should; Could bleibt verschiebbar, schützt den Sprint |
| D4 | **M5-Usability-Test wird ab M3 vorbereitet** | Gate „5 neue Spieler ohne Tutorial“ = einzige nicht automatisch prüfbare Abnahme | Test erst in M5 starten | Rekrutierung (Beta-Liste, Freundeskreis, 5 Nicht-Spieler) braucht Vorlauf; ohne Planung ist das Gate blockiert |
| D5 | **Größen-Watchliste: US-M4-02, US-M6-05** | könnten bei genauerer Schätzung L (>5 Tage) werden | jetzt neu schätzen | beim Decomposing neu schätzen, Backlog dann korrigieren — keine L-Stories ohne neue Zahlen |
| D6 | **Datenkorrekturen: PO + BA abgeschlossen** | Separator-Konvention: mehrwertige CSV-Zellen mit `;` (PO normalisierte US-M0-06/10/11; von Reto als Convention übernommen). Reto bereinigte **6** stale Gap-Annotationen (US-M1-07/G3, US-M2-11/G8, US-M2-12/G7, US-M3-02/G2, US-M5-09/G1, US-M5-11/G5) in beiden Quellen. `handoff-backlog.md`: „99 Stories“ → 100. Dependencies: **18 Stories → 21 Kanten** (die 3 mehrwertigen Zeilen zählen doppelt), zyklenfrei | nur 2 Annotationen angenommen | 100 ↔ 100 ↔ 100 nach Retos Clean; meine Zählung 18 Kanten war Separator-bedingt zu niedrig |
| D7 | **Baseline-Commit `docs/` ausgeführt (ad0fb8e)** | Review-Artefacts + PO-Plan waren uncommitted; US-M0-01 ist bereits committet (c77d497) | Commit dem Build-Team überlassen | saubere Working-Tree-Baseline vor dem Build; Commit ist lokal und revertingbar |
| D8 | **US-M0-01 auf „in progress“ zurückgestuft** (Retos AC-Audit, vom PO selbst bestätigt: root/core/cli package.json gelesen) | AC verlangt `npm run build` (kein build-Skript anywhere) und einen Isolation-Check mit Fehlschlag bei core→app/cli-Dependencies (Checker existiert nicht; Isolation real erfüllt) | als done führen, Checker ignorieren | Die M0-Gate-Baseline darf nicht auf einer Story stehen, die ihre eigene Akzeptanz nicht erfüllt; der Checker ist der NFR-004-Driftschutz. Beide Script-Arbeiten laufen in S0-A innerhalb des ~61-Tage-Budgets |

## Risiken (Pre-Mortem, Kurzform)
1. **Balance nicht balancierbar** (Konzept §11): erst der Harness zeigt es → S0-D ist der Entscheidungs Punkt; wenn Naiv-Strategien zu früh verlieren, justiert Ralf Werte, nicht Mechanik.
2. **M5-Gate durch Menschen blockiert**: ohne rekrutierte Testpersonen kein Abnahmetest → D4.
3. **Harness-Daten kommen zu spät für M1**: M1 startet formal erst nach M0-Gate; Balance-Nachlauf gehört in den M0-Puffer, nicht in M1.
4. **Scope Creep Richtung Multiplayer/Krieg**: bleibt auf der Won't-Liste (Konzept §10) — jede neue Idee wird als neuer Gap dokumentiert, nicht still ins Sprint genommen.

## Erfolgsmetriken nach M0
- Score-Spread über 20 Seeds ohne unspielbares Jahr (>50 Jahre oder Bankrott < Jahr 5 bei Naiv-Strategie „gleichmäßig max“)
- Golden-Hash stabil im CI (NFR-002/004)
- ≥ 1 Krise ab M2 in ≥ 80 % der Runs (M2-Gate)
- Session-Rahmen: 12–25 Jahre-Ziele, Hard-Cap 50
