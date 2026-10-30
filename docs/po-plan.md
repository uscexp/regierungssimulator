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

## Build-Workflow (von Haui festgelegt, Build-Go 27. Okt)

**Pipeline je Story:** Tyrdor (Game Developer) setzt die Story um → erstellt PR → Lens (Code Reviewer) reviewt → bei OK leitet Maya (QA) Test-Cases aus der Story ab (Akzeptanzkriterien in `docs/akzeptanzkriterien.md`) → testet → Fehler gehen zurück an Tyrdor. Der PO (@trix) führt den Story-Status; Meilenstein-Gate = Abnahme durch Reto gegen Spec/Kriterien.

### Sprint-Status M0 / S0-A

| Story | Status | PR | Review (Lens) | Test (Maya) |
|---|---|---|---|---|
| US-M0-01 (Scripts) | review OK, QA PASS | #1 | OK | FINAL PASS 6/6 — Maya bestätigt Own-Run (Basis Exit 0; 3 Drift-Varianten Exit 1 mit präziser Verletzungsliste; Kontrolle nach Rückbau Exit 0; Haupt-Clone nie mutiert) |
| US-M0-02 (GameState) | review OK, QA bedingt | #2 | OK | BEDINGT PASS — F-02 offen, Tyrdor-Fix (budget-Finitheit) noch nicht gepushed; Merge erst nach Mayas Regression-PASS (NaN/Infinity/negatives budget + volle Suite) |
| US-M0-03 (RNG) | review OK, QA PASS | #3 | OK | FINAL PASS 8/8 |
| US-M0-04 (Clamp/Invariant) | review OK, QA PASS | #4 | OK | FINAL PASS 7/7 |
| US-M0-05 (Indikatorbewegung) | blocked (Lens), Fix auf Stack-Tip | #5 | blocked — diminishing_wirkung fehlt im Fixture, Kern fiel auf ?? 0 (still 0 über 85) | Maya wartet Lens-OK; der Pflichtfeld-Fix ist 1653e7a auf feat/m0-11-tick und kommt in Merge-Reihenfolge über #11 |
| US-M0-06 (Zufriedenheitsformel) | gebaut, wartet Review | #6 | — | — |
| US-M0-07 (Steuermodell aus Konstitution) | gebaut, wartet Review | #7 | — | — |
| US-M0-08 (Entscheidungsgedächtnis) | gebaut, wartet Review | #8 | — | — |
| US-M0-09 (Politisches Kapital) | gebaut, wartet Review | #9 | — | — |
| US-M0-10 (Budget, Zinsen, Spar-Event) | gebaut, wartet Review | #10 | — | — |
| US-M0-11 (tick — Kern-Loop) | gebaut, wartet Review | #11 | — | — |

S0-B gebaut von Tyrdor (PRs #6–#11, gestapelt): 88 Tests / 12 Files, typecheck/eslint/prettier/build/core-isolation grün. Zwei PO-Punkte offen, an Trix gemeldet: (a) Zufriedenheit am Jahrsanfang — Wahl prüft nach Events, vor Budget/Bewegung (§7-Lesart oder End-of-Year?), (b) Wahlregel als extern gereichte Callback vs. Regel-Id (Core-Kentbarkeit von Content).

Lens-Gate = sein DM-Verdikt (GitHub-Account ist PR-Eigentümer, formale Approvals dort nicht möglich; Reviews als PR-Kommentare gepostet). Merge-Reihenfolge #1→#2→#3→#4 nach je Maya-Pass. Nicht-blockierende Follow-ups: #1 Isolation-Check rekursiv vor erstem Unterordner; #2 Start-Factory validiert budget-Finitheit (NaN-Budget passiert den Start). NFR-004 von Lens live belegt (Driftprobe → Exit 1 + Verletzungsliste). Mayas Cases für #5 müssen dokumentieren: Schwellenwert inklusiv, Gate liest jahresaktuell aktualisierte Level, regelreihenfolge-abhängig. Ralfs §12-Korrektur (95e2f51, nur im geteilten Checkout — GitHub-PR-Head 0e51024 enthält sie nicht) wird PO-seitig aus dem PR-Scope rausgehalten: PRs bleiben core/ + package.json, die §12-Zeilen erreichen main über Retos Docs-Worktree-Flow. Test-Zahlen aufgelöst (Mayas O-2): Stack-Tip #1–#4 = 27 Tests, Tyrdors 36 inkl. PR-#5-Branch. O-1 (AC sagen literal „tick"): Mayas Äquivalent-Primitives sind als interim ok, die AC-End-to-End-Prüfung greift ab US-M0-05/# end-to-end — kein Finding. QA-Harness persistiert in C:/Users/muell/qa-berichte/ (nicht im Repo; der Repo-AutoSim-Harness kommt mit US-M0-17).

S0-A gesamt gebaut von Tyrdor: 27 Tests, typecheck/eslint/prettier grün, `npm run build` je Workspace, CLI bootet headless; PRs gestapelt (Basis = vorheriger Branch). Dokumentierte Abweichungen: AC-Kerne von US-M0-03/04 direkt gegen RNG bzw. Clamp/Invariant getestet (Tick ist S0-B); `npm test` baut vorher (Exports auf dist/); `app/` bis M5 kein Workspace.

## M0-Sprint-Zerlegung (Build-Order architektur.md §7)

| Sprint | Stories | Fokus | Exit-Kriterium |
|---|---|---|---|
| S0-A Fundament | US-M0-01 🔶 **in progress** (AC-Lücken: `npm run build` fehlt, Isolation-Check-Skript fehlt), US-M0-02, 03, 04 (~4 Tage + 2 Script-Arbeiten) | Monorepo-Skelett existiert (c77d497), aber Story erfüllt ihre Akzeptanz erst mit build-Task pro Workspace + Checker, der core-Dependencies zu app/cli fehlschlägt; GameState, seedbarer RNG, Invariant/Clamp | Repo baut (`npm run build`) & testet; Isolation-Check schlägt bei Drift fehl; kein NaN möglich |
| S0-B Mechanik | US-M0-05, 07, 08, 09, 10, 06, 11 (~17 Tage) | Tick-Mechaniken → Zufriedenheitsformel → reiner `tick()` | Formel als reine Funktion; 06 nach 05+07 |
| S0-C Content + CLI | US-M0-13, 15, 14 (~11 Tage) | Basis-Content, Lagebericht, kompletter Terminal-Loop | Spiel von Jahr 1 bis Ende im CLI durchspielbar |
| S0-D Beweise | US-M0-16, 17, 18 (~13 Tage) | Golden-Replay, AutoSim-Harness, Score-Spread-Fixture | Gate erfüllt; **Kurven an @ralf für Verschleiß-Abgleich** |

**Checkpoint nach S0-D:** Der erste echte Harness-Lauf liefert die 4 Naiv-Kurven (30 Jahre × 20 Seeds, seit D18 inkl. overspend) → @ralf justiert Verschleiß/Wirkung final. Das ist der geplante Balance-Nachlauf (~4–6 Tage Puffer), kein Scope-Change. Keine Kurven vor dem ersten echten Lauf erfinden.

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
| D9 | **Build-Go empfangen (Haui, 27. Okt) und S0-A dispatched** | Haui definiert die Team-Pipeline: Tyrdor (Game Developer) setzt Story um → PR → Lens (Code Reviewer) → bei OK Maya (QA) leitet Test-Cases aus der Story ab und testet → Fehler zurück an Tyrdor | PO baut selbst, Einzel-Agent ohne Review | Review + unabhängige QA vor Merge ist genau der Schutz, den die DoD (AC-Test, Golden-Test, Invariant) verlangt; PR-Branching erfordert Push der Docs-Baseline (ad0fb8e…f580c62) auf origin |
| D10 | **M0-Basis-Content entschieden (US-M0-13)** | Spec sagt „5 Indikatoren, 3 Gruppen" ohne Namensliste; balance-werte.md §2/§3 liefert die Werte. **5 Indikatoren:** Infrastruktur, Bildung, Gesundheit, Wirtschaft, Forschung (Verschleiß 3/2/2/2/2, budget_wirkung 0.5/0.6/0.7/0.4/0.5, diminishing_at 70/65/75/80/85, Forschung-Gate Bildung ≥ 50, Start Wirtschaft 45 / übrige 40). Recht & Freiheit + Sicherheit sind nicht-per-Budget und bleiben M1/M3. **3 Gruppen:** Unternehmen, Arbeitnehmer, Bildung & Jugend — Anteile renormalisiert auf Σ=100 % (21.3/51.1/27.6 %), Indikatorgewichte renormalisiert auf die in M0 vorhandenen Tags (fehlende Tags entfallen), Steuerlast flat = 4. **5 Basis-Entscheidungen:** je eine Budget-Allokation pro Indikator. **Implizite Dependency dokumentiert:** US-M0-13 validiert „gegen das Zod-Schema", die Schema-Story ist US-M4-02 → minimaler Zod-Schema für Basis-Typen wird in M0 eingeführt, M4 erweitert ihn zum Pack-Format. @ralf validiert renormierte Start-Ø und die Naiv-Anker („nur Wirtschaft" verliert Wahl ≤ Jahr 12 bleibt mit Infrastruktur-Gewicht 0.30 auf Unternehmen erfüllt) | 3 andere Gruppen oder 5 volle Gruppen ohne Renormierung | Unternehmen muss drin sein (der Naiv-Anker hängt an dessen Infrastruktur-Gewicht); Gesundheitswesen/Landwirte wären Tag-subsets ohne Wirtschaft-Bildung-Spannung; Renormierung folgt der Loader-Normalisierung (K4 Safety-net) |
| D11 | **Tyrdor beginnt S0-B sofort, ohne auf Reviews zu warten** | S0-A ist komplett gebaut, CI grün, GameState friert ein (PR #2); Tick + Zufriedenheitsformel sind reine Funktionen auf diesem State | wartend stehen bleiben | Serialisierung wartet auf Menschen, nicht auf Code; Merge-Disziplin bleibt Gate: kein S0-B-Merge auf main, bevor die zugehörigen S0-A-PRs Lens+Maya passiert haben; gestapelte Branches behalten die Build-Konsistenz |
| D12 | **Unruhe-Gate in der M0-Wahlregel (US-M0-12) akzeptiert** (Ralfs Validierung von D10, von Hand nachgerechnet) | Mit den renormierten 3 Gruppen verliert „nur Wirtschaft" bei der einfachen Regel „gewichtete Ø ≥ 50" nie eine Wahl (Ø bleibt ~62–70; nur bildung_jugend fällt) → dominante Strategie offen. Ralfs Gate: **Wahl-Gewinn erfordert gewichtete Ø ≥ 50 UND schwächste Gruppe ≥ 35.** Nachgerechnet: Jahr 4 Gewinn (bj 40.4), Jahr 8 verloren (bj 34.7) → Anker „Verlust ≤ Jahr 12" hält. Start-Ø-M0-Anker = **48.33** (nicht 46 — 46 war das 8-Gruppen-Modell; 48.4 nutzte Summe 100.1, Tyrdors Fixtures rechnen mit 48.33). Keine Wert-Änderung nötig; **korrigierter** M0-Unterhalt: 17.19 BE/Jahr ohne aktives Forschung (wirtschaft 5.0 + infrastruktur 6.0 + bildung 3.33 + gesundheit 2.86 — Forschung gate-closed kostet keinen Unterhalt), 21.19 BE mit offenem Gate, Spielraum 18.81 BE. Ralfs (c)-Zahl „12.19" war eine Rechnung ohne wirtschaft; Tyrdors Formel-Test bestätigt 17.19 (balance §1 ist stale, Reto korrigiert). Ralf hat den Fehler bestätigt und D12 autorisiert — §12 auf exakt 17.19/21.19 gezogen (Commit 95e2f51), Anker „gleichmäßig investieren" hält bei 17.19 BE gegen 36 BE (Spielraum 18.81, ~14.8 wenn Forschung aktiv wird). Ab M1/M3: auf die §12-Originalgewichte zurückgehen, renormierte nur für M0 | Werte re-ankern auf Jahr 20; Gate erst in M2 | Der Gate ist evidenzbasiert (Ralfs Rechnung), schließt die dominante Strategie vor M2 und ist durch die Oppositions-Mechanik in M2 ohnehin implizit vorhanden |
| D13 | **Forschung diminishing_wirkung über 85: final 0.20 (Ralfs Autorisierung, 40-%-Muster der §2-Tabelle)** | §12 hatte keinen abgesenkten Wert über diminishing_at 85. Ralf autorisiert **0.20** (40 % von 0.5 Grundwirkung — Muster: infra 0.5→0.2, bildung 0.6→0.25, wirtschaft 0.4→0.15). Trix interim 0.15 (Analog Wirtschaft) war dispatched, Tyrdor hat 0.15 gebaut, Ralfs finale Autorisierung vor S0-D-Freeze überschreibt auf 0.20. Balance-Update: Forschung-Zeile über 85 = 10.0 BE (2/0.20), Gesamtunterhalt mit aktivem Gate >85 = 27.19 BE gegen 36 BE Einnahmen (Spielraum 8.81 BE = 24 %). balance-werte.md §2 und K1-Tabelle auf final 0.20 gezogen. | 0.15 (Trix interim, Tyrdor baut) | 0.20 (Ralfs 40%-Muster, final) | Ralf ist Balance-Autorität; final vor S0-D-Freeze |
| D14 | **Tick-Reihenfolge & Wahl-Zeitpunkt bestätigt wie gebaut (Zufriedenheit am Jahresanfang)** | §7/Spec-Story US-M0-07 dokumentiert „Zufriedenheit → Events → Wahl → Budget → Jahr + PK-Regeneration"; Wahl prüft damit den Zufriedenheitsstand nach den Events, vor Budget/Indikatorbewegung. Ralfs Gate-Anker (Jahr 4 Gewinn, Jahr 8 Verlust bei „nur Wirtschaft") ist auf genau diese Lesart gerechnet. Semantik: Der Machtcheck spiegelt die Stimmung am Wahltag — Investitionen des laufenden Jahres wirken erst aufs Folgejahr, das ist gewollte Feedback-Verzögerung und verhindert „investieren und sofort gewinnen“ | End-of-Year-Zufriedenheit für den Machtcheck | Re-Ankerung aller von Ralf gerechneten Werte nötig; die dokumentierte §7-Order ist autoritativ |
| D15 | **WahlregelDelivery interim als injizierte Funktion (wahlPruefen), Architektur-Ruling durch @padu vor M1** | Kern bleibt content-agnostisch (ADR-002); Tyrdor reicht die Wahlprüfung als extern gereichte Funktion statt Regel-Id. Für M0 ok und gut testbar (Fixture A/B via CLI-Machtcheck, US-M0-12). M1-Gate verlangt „zwei Konstitutionen → nachweislich verschiedene Wahlmechanik" — damit muss die Delivery langfristig konstitutions-getrieben sein; injizierte Funktion erfüllt das, wenn der Adapter die Konstitutions-Regel auf die Funktion mappt. @padu entscheidet final (Funktion vs. Regel-Id im Regel-Register) | core liest Content-Regeln per Regel-Id | verletzte ADR-002 (Kern kennt Content); ohne Pädu-Ruling vor M1 würde die M1-Story auf eine nicht autorisierte Struktur gebaut |
| D16 | **Tick-Signatur-Absweichung akzeptiert: rng im State, kein rng-Parameter** | Tyrdor baut tick(state, action, regeln, modus?) ohne rng-Parameter (ADR-006: RNG liegt im GameState); die Spec-Story-Linie nennt „tick(state, action, rules, rng)". Die State-owned RNG ist purer (Snapshot-Funktion ohne externen Input), AC-Kern „rein + seedbar" bleibt erfüllt. Reto korrigiert die Spec-/AC-Zeile zu tick(state, action, regeln) mit rng im State | rng-Parameter beibehalten | dokumentierte Architektur (ADR-006) schlägt die ältere Story-Formulierung; Spec-Konsistenz ist Retos BA-Auftrag |

## Risiken (Pre-Mortem, Kurzform)
1. **Balance nicht balancierbar** (Konzept §11): erst der Harness zeigt es → S0-D ist der Entscheidungs Punkt; wenn Naiv-Strategien zu früh verlieren, justiert Ralf Werte, nicht Mechanik.
2. **M5-Gate durch Menschen blockiert**: ohne rekrutierte Testpersonen kein Abnahmetest → D4.
3. **Harness-Daten kommen zu spät für M1**: M1 startet formal erst nach M0-Gate; Balance-Nachlauf gehört in den M0-Puffer, nicht in M1.
4. **Scope Creep Richtung Multiplayer/Krieg**: bleibt auf der Won't-Liste (Konzept §10) — jede neue Idee wird als neuer Gap dokumentiert, nicht still ins Sprint genommen.

## Erfolgsmetriken nach M0
- Score-Spread über 20 Seeds ohne unspielbares Jahr (>50 Jahre oder Bankrott < Jahr 5 bei Naiv-Strategie „gleichmäßig max“)
- Golden-Hash stabil im CI (NFR-002/004)
- ≥ 1 Krise ab M2 in ≥ 80 % der Runs (M2-Gate)
- Session-Rahmen: 12–25 Jahre-Ziele, Hard-Cap 50 — das Ziel gilt ab M1/M2; der gemessene M0-Core-Loop endet Jahr 6 (Wahlregel 47/6 nach D18, Lesart in D19)


| D17 | **ADR-011: Wahlregel als Content-Datum im Register (Rulung Pädu, Option 2)** | `wahlregel` wird Content-Datum im Regel-Register, der Kern interpretiert ein geschlossenes Variant-Set (praesidentialwahl: fixed Term + Schwelle; parlamentmehrheit: aus Fraktionen ab G3; putsch-roll: Elite/Militär-Zufriedenheit + Legitimität). Neue Mechanik = neuer typisierter Variant in Kern + Zod-Schema. ADR-011 im architektur.md register eingefügt. Tyrdors Interim (1) als Platzhalter bis M0, aber der Refactor muss vor M1-Content landen, sonst wandert der Golden-Hash an die injizierte Implementierung und bei jeder Adapter-Änderung. M2 ist davon nicht betroffen — Events laufen schon als gereichte Regeln durch die rules-Schiene, wahlregel nutzt dieselbe Delivery. | Option 1 (Funktion statt Regel-Id) | Pädu ist die Architektur-Autorität; D17 im Plan eintragen |
| D18 | **Wahlregel auf Schwelle 47 und Zyklus 6 Jahre gezogen; Unterhalt bleibt Level-Decay** | Gemessener Befund auf dem echten AutoSim-Harness (4 Naiv-Strategien x 3 Schwierigkeiten, 20 Seeds, 30 Jahre geplant): der gemessene M0-Start (Wirtschaft 45, übrige Level 40) liegt bei gewichteter Ø 47.22, die Ø fällt ohne Investitionen ~1.2 Punkte/Jahr, weil die Einnahmen an der Zufriedenheit hängen und 10 BE Zuteilung nur +1 Level je Indikator gegen Verschleiß 2-3 bringt. Gate-Werte allein erreichen die Ziel-Session nicht: gemessenes erstes Wahljahr (leicht/normal/schwer) ist 50/4 = 4/4/4, 47/6 = 6/6/6, 44/8 = 8/8/8, 42/8 = 16/8/8, 40/10 = 20/10/10; bei zu tiefer Schwelle greift zuerst die schwächste Gruppe (`wahl:schwächste_unter_35`). Bei 47/6 endet jede der 12 Kombinationen Jahr 6 mit `wahl:gewichtete_unter_47`, ohne Defizit und ohne Spar-Event. Freigegeben von Haui nach Trix' Ruling (Trix' Session war zeitweise nicht entscheidungsfähig). Gebaut und gemerged als PR #17, main d2b1347; Lens Approve und Maya FINAL PASS auf dem Tip. Unterhalt bleibt Level-Decay und wird keine Budget-Ausgabe (`core/budget.ts` unverändert, Defizit = Ausgaben minus Einnahmen minus Zinsen, AC US-M0-10 bleibt), damit sind Spar-Event, Bankrott und Radikalisierung M1/M2-Features mit Events und Karten; das Ziel "überlebt 12-25 Jahre" zieht aus dem M0-Ziel heraus. Nachgezogen in: spezifikation.md (FR-013, US-M0-12, A-07), akzeptanzkriterien.md (US-M0-12, US-M0-17), spielkonzept.md (M0-Meilenstein, Wahlregel, Session-Rahmen), balance-werte.md (§4 M0-Anker), backlog.csv (US-M0-12). | Unterhalt als Budget-Ausgabe im Kern (Deficit-Spirale wäre messbar, müsste AC US-M0-10 mitziehen) | 50/4 (alte AC-Lesart, Horizont 4 Jahre), 44/8, 42/8, 40/10 | Haui ist die Freigabe-Autorität für dieses Ruling; Ralfs Empfehlung (Unterhalt bleibt Level-Decay) ist die Begründung |
| D19 | **Horizont-Lesart Option A: M0 endet Jahr 6, das Langzeit-Ziel gilt ab M1/M2 (Ruling von Reto)** | Gemessen über die gepinnten Fixtures: 12 Strategie/Schwierigkeits-Kombinationen × 20 Seeds × 30 Jahre (PR #24, Hash 1bec15cdb281) und die vier Naiv-Kurven × 20 Seeds (PR #28, Hash 686593c3413b) — alle enden Jahr 6 mit `wahl:gewichtete_unter_47`, kein Defizit, kein Spar-Event; der Verschleiß läuft über die Einnahmen- und Zufriedenheitskurve, der Unterhalt ist konstant (Level-Decay nach D18). Konsequenz: M0-Gate „das Spiel ist komplett im Terminal durchspielbar“ ist bei Jahr 6 erfüllt (AC US-M0-14 nachgezogen), keine Kern-Änderung, keine Fixture-Änderung, keine Balance-Neujustierung; „überlebt 12–25 Jahre“ ist als Anforderung an M1/M2 dokumentiert (nach Setup mit Events, Gesetzen und Deficit-Spirale). Autorität: Reto ist die Requirements-Autorität für Akzeptanz-Kriterien — die Frage lag nicht beim PO. | Option B: Unterhalt als Budget-Ausgabe im Kern — wäre messbar, zieht aber AC US-M0-10 und Spar-Event/Bankrott/Radikalisierung als M1/M2-Features nach und revokiert beide Fixtures plus die Balance-Anker-Tabelle | 30-Jahre-Cap ist Session-Hard-Cap (§10), nicht das Langzeit-Ziel | Reto entscheidet die Lesart für US-M0-14/Gate; Haui gibt frei, wenn Reto nicht entscheidet (wie bei D18) |

## S0-C Budget-Konflikt (§7 09–11)

**Pipeline:** Tyrdor (Game Developer) → PR → Lens (Code Reviewer) → bei OK Maya (QA) leitet Test-Cases aus der Story ab und testet → Fehler zurück an Tyrdor. Merge nur nach Lens-OK + Maya-Pass. PR-Branching erfordert Push der Docs-Baseline.

### Sprint-Status S0-C

| Story | Status | PR | Review (Lens) | Test (Maya) |
|---|---|---|---|---|
| US-M0-06 (Zufriedenheitsformel) | implemented | #6 | — | — |
| US-M0-07 (Steuermodell) | implemented | #7 | — | — |
| US-M0-08 (Entscheidungsgedächtnis) | implemented | #8 | — | — |
| US-M0-09 (Politisches Kapital) | pending | #9 | — | — |
| US-M0-10 (Budget/Zinsen/Spar-Event) | pending | #10 | — | — |
| US-M0-11 (tick) | implemented | #11 | — | — |
| US-M0-12 (Wahl mit Unruhe-Gate) | pending | #12 | — | — |

### S0-C Inhalt (§7-Reihenfolge 09–11)

**09 Politisches Kapital (PK)**
- Machbarkeit von PK-Gewinn durch Appeasement vs. Opposition
- PK als Währung für Entscheidungen und Agenda-Slots
- Ereignis-Karten: PK-Gewinn/Verlust, Koalitionsdruck
- PK-Entzug bei Nicht-Erfüllung von Agenda-Slots

**10 Budget-Konflikt**
- Priorisierung von Budget-Allokationen bei knapper Ressource
- Konflikt zwischen "gleichmäßig investieren" und "fokussiertes Wachstum"
- Ereignis: Finanzkrise bei Budget-Überschreitung
- Entscheidungs-Mechanik: Sparen vs. Investieren

**11 Fail-Fast**
- Frühe Warning-Mechanik bei systemischem Versagen
- Automatische Ereignisse bei langfristigem Verfall
- Game-Over-Bedingungen (Bankrott, Verlust bei konstanter Fahrlässigkeit)

### Merge-Reihenfolge
#6 → #7 → #8 → #9 → #10 → #11 → #12
Je PR: Lens OK + Maya PASS.

### QA über S0-C
Maya läuft nach Lens-OK. Test-Cases aus den Stories + AC (docs/akzeptanzkriterien.md). Failure Cases für Budget-Konflikt und Fail-Fast-Mechanik dokumentieren. Harness: C:/Users/muell/qa-berichte/ (persistiert nach jedem Merge).

### Offene Fragen für Haui
1. S0-C Scope: Sollen #9–#11 sofort nach #8 gestartet werden, oder gibt es Abhängigkeiten zu beachten?
2. Optional: Checkout-Fix für geteiltes Repository (sieht Retos Worktree-Kanal als erledigt an).

---
**Status:** S0-C ist aktiv gestartet. Die Stories #9–#11 beginnen nach #8. Checkout-Fix wurde durchgeführt und Main ist aufgeräumt.
EOT
## S0-C Budget-Konflikt (§7 09–11)

**Pipeline:** Tyrdor (Game Developer) → PR → Lens (Code Reviewer) → bei OK Maya (QA) leitet Test-Cases aus der Story ab und testet → Fehler zurück an Tyrdor. Merge nur nach Lens-OK + Maya-Pass. PR-Branching erfordert Push der Docs-Baseline.

### Sprint-Status S0-C

| Story | Status | PR | Review (Lens) | Test (Maya) |
|---|---|---|---|---|
| US-M0-06 (Zufriedenheitsformel) | implemented | #6 | — | — |
| US-M0-07 (Steuermodell) | implemented | #7 | — | — |
| US-M0-08 (Entscheidungsgedächtnis) | implemented | #8 | — | — |
| US-M0-09 (Politisches Kapital) | pending | #9 | — | — |
| US-M0-10 (Budget/Zinsen/Spar-Event) | pending | #10 | — | — |
| US-M0-11 (tick) | implemented | #11 | — | — |
| US-M0-12 (Wahl mit Unruhe-Gate) | pending | #12 | — | — |

### S0-C Inhalt (§7-Reihenfolge 09–11)

**09 Politisches Kapital (PK)**
- Machbarkeit von PK-Gewinn durch Appeasement vs. Opposition
- PK als Währung für Entscheidungen und Agenda-Slots
- Ereignis-Karten: PK-Gewinn/Verlust, Koalitionsdruck
- PK-Entzug bei Nicht-Erfüllung von Agenda-Slots

**10 Budget-Konflikt**
- Priorisierung von Budget-Allokationen bei knapper Ressource
- Konflikt zwischen "gleichmäßig investieren" und "fokussiertes Wachstum"
- Ereignis: Finanzkrise bei Budget-Überschreitung
- Entscheidungs-Mechanik: Sparen vs. Investieren

**11 Fail-Fast**
- Frühe Warning-Mechanik bei systemischem Versagen
- Automatische Ereignisse bei langfristigem Verfall
- Game-Over-Bedingungen (Bankrott, Verlust bei konstanter Fahrlässigkeit)

### Merge-Reihenfolge
#6 → #7 → #8 → #9 → #10 → #11 → #12
Je PR: Lens OK + Maya PASS.

### QA über S0-C
Maya läuft nach Lens-OK. Test-Cases aus den Stories + AC (docs/akzeptanzkriterien.md). Failure Cases für Budget-Konflikt und Fail-Fast-Mechanik dokumentieren. Harness: C:/Users/muell/qa-berichte/ (persistiert nach jedem Merge).

### Offene Fragen für Haui
1. S0-C Scope: Sollen #9–#11 sofort nach #8 gestartet werden, oder gibt es Abhängigkeiten zu beachten?
2. Optional: Checkout-Fix für geteiltes Repository (sieht Retos Worktree-Kanal als erledigt an).

---
**Status:** S0-C ist aktiv gestartet. Die Stories #9–#11 beginnen nach #8. Checkout-Fix wurde durchgeführt und Main ist aufgeräumt.
