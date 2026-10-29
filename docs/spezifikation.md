# Detail-Spezifikation — „Staatslenker“ (Regierungssimulator)

**Status:** V1-Spezifikation · Autor: Reto (Business Analyst) · Auftraggeber: Haui
**Basis:** `spielkonzept.md` (Ralf) · `architektur.md` (Pädu) · Sprache des Spiels und der Dokumente: Deutsch
**Sprache der Umsetzung laut Architektur:** TypeScript strict, Monorepo, kein Backend (ADR-001, ADR-002)

---

## 1. Business Context

**Problem:** Regierungsführung ist komplex (Budget, Gruppenzufriedenheit, Krisen, Machterhalt). Bestehende Spiele bilden diese Komplexität als „Zahlenfriedhof“ ab oder reduzieren sie auf wenige Knöpfe. Haui will beides: **die Komplexität abbilden und trotzdem übersichtlich bleiben** — mit der Konstitution als erster Spielzug und einem data-driven Regelsatz, der ohne Code erweiterbar ist.

**Geschäftsziele (messbar):**
| Ziel | Messgröße | Zielwert V1 |
|---|---|---|
| Übersichtlichkeit ohne Erklärtext | Turns bis erste successful Turn-Abgabe ohne Tutorial | ≥ 5 Turns (Konzept §9 M5) |
| Entscheidungen sind vor dem Klick verständlich | Karten mit vollständiger Vorhersage | 100 % der Karten |
| Vorhersage ist wahr | Dry-Run-Ergebnis == echter Tick | 100 % Übereinstimmung (Test) |
| Erweiterbarkeit ohne Code | neuer Pack mit Gruppe + Entscheidung | ladbar, ohne Kern-Änderung (M4) |
| Balance ohne dominante Strategie | Score-Spread über ≥ 5 Strategien | kein Strategie-Anteil > 30 % der besten Score-Median |
| Wiederholbarkeit/Replay | gleicher Seed + gleiche Aktionen | identischer State-Hash (Golden-Test) |

**Kernfantasie (Konzept §1):** „Ich regiere ein Land. Jede Entscheidung hat sichtbare Folgen — ich balanciere Machterhalt gegen Fortschritt.“ Der Engpass ist **politisches Kapital**, nicht Geld — das ist das eigentliche Spielziel.

---

## 2. Stakeholders

| Stakeholder | Rolle | Interesse | Einfluss |
|---|---|---|---|
| Haui | Auftraggeber | Vision, Übersichtslichkeit, Konstitution als erster Spielzug | entscheidet Priorisierung & Scope |
| Ralf | Konzeptautor (Requirements Engineer) | Spielmechanik, Balance, Konzept-Konsistenz | besitzt `spielkonzept.md` |
| Pädu | Solution Architect | Determinismus, Schichten, ADRs | besitzt `architektur.md`, entscheidet offene Architekturfragen |
| Product Owner | Backlog | Story-Reihenfolge, Milestone-Gates | nimmt Stories ab |
| Task Decomposer | Work breakdown | Story → Tasks | zerlegt Stories nach Abnahme |
| Backend Developer | Kern-Implementierung | `core/`, `loader/`, `cli/` | baut M0–M4 |
| UI/UX Designer | Dashboard, News-Feed | Übersichtlichkeit, Tooltip-Logik | baut M5 |
| QA Engineer / Test Writer | Golden-, Robustheits-, Balance-Tests | NFR-001/002/003 | hält die Gates |
| Modder (später) | Pack-Autor | stabiles, validierbares Format |verbraucht M4-Pack-Doku |
| Spieler (Zielgruppe) | Einzelspieler, deutsch | ein Bildschirm, erzählte Zahlen | Validierung via Onboarding-Test |

---

## 3. Architektur-Bezug (Story-Schichten)

Jede Story ist genau einer Schicht aus `architektur.md §3` zugeordnet — der Kern wird nie ein zweites Mal geschrieben (ADR-002).

| Schicht | Modul | Verantwortung | Meilensteine |
|---|---|---|---|
| core | `state.ts`, `tick.ts`, `invariant.ts`, RNG | deterministische Simulation, pure Funktion | M0–M2 |
| core | `rules.ts` (Zod), `eval.ts` (typisierte Prädikate) | Regel-Schema, Bedingungs-Auswertung | M1–M4 |
| core | `events.ts` | Event-Ketten, Wahrscheinlichkeiten, Options | M2 |
| core | `save.ts` | versionierter Snapshot + Action-Log | M6 |
| content | `content/base/` | Basis-Regelsatz als TS gegen dasselbe Zod-Schema | M0–M3 |
| loader | `loader/` | YAML + js-yaml + Zod, atomische Validierung | M4 |
| cli | `cli/` | Text-UI (M0/M1/M2) + AutoSim-Harness | M0–M4 |
| app | `app/` (Svelte 5 + Vite) | Adapter: sieht Snapshots, sendet Actions | M5–M6 |

**Regel für alle Stories:** Der Kern importiert nichts aus `app/` oder `cli/`. UI und CLI sind Adapter. Der Vorhersage-Mechanismus ist kein zweiter Rechner, sondern `tick` im Dry-Run auf einer State-Kopie.

---

## 4. Funktions-Requirements (FR)

| ID | Requirement (messbar) | Quelle | Schicht |
|---|---|---|---|
| FR-001 | `GameState` enthält: `indikatoren: Record<tag, number>`, Gruppen (Zufriedenheit + Gewicht), Budget, politisches Kapital, Legitimität, Schulden, Radikalisierung, Jahr, RNG-State, Konstitution und `zufriedenheits_trace` (Top-2 Delta-Gründe je Gruppe) | Architektur §3 + §3a, ADR-008 | core/state |
| FR-002 | Nach jedem Tick gilt: alle Werte 0–100, kein NaN; Verstoß bricht im dev-Modus mit Regel-ID im Log | Architektur §5 | core/invariant |
| FR-003 | `tick(state, action, regeln, modus?)` ist eine pure Funktion; der alte State wird nicht mutiert; RNG liegt im GameState (ADR-006) | ADR-002 | core/tick |
| FR-004 | Gleicher Seed + gleiche Action-Folge ⇒ identischer State (replaybar) | Konzept §5, Architektur §2 | core/RNG |
| FR-005 | Indikatorbewegung pro Jahr exakt: `level += budget_wirkung + ereignis_delta − verschleiss` | Konzept §2A | core/tick |
| FR-006 | Je Indikator sind Verschleiß (1–3/Jahr), budget_wirkung pro BE und `diminishing_at` definiert — Werte in `balance-werte.md` §2; Forschung stagniert bei Bildung < 50 (weder Wachstum noch Verschleiß), ab Bildung ≥ 50 +0.5/BE und −2/Jahr | Konzept §2A + §12 | content/base |
| FR-007 | Zufriedenheitsformel exakt wie Konzept §2B: Grundzufriedenheit (Gewicht-Matrix) − Steuerlast + Entscheidungsgedächtnis + Konstitutions-Modifikatoren + Ereignis-Modifikatoren, geclampt; keine zusätzlichen Terme | Konzept §2B, Architektur §3.3 | core/tick |
| FR-008 | Acht Gruppen mit Gewicht-Matrix (Σ=1) und Bevölkerungsanteil; die Anteile summieren auf 100 %; die Loader-Normalisierung bleibt als Safety net für Mod-Packs; Steuerlast je Steuermodell (0–12) | Konzept §2B + §12 | content/base |
| FR-009 | Die letzten 3 Beschlüsse wirken nach („Entscheidungsgedächtnis“) und sind im State gespeichert | Konzept §2B | core/state |
| FR-010 | Steuerlast je Gruppe folgt aus dem Steuermodell der Konstitution (flat/progressiv/hoch/niedrig) | Konzept §3 | core/tick |
| FR-011 | Karten kosten 1–3 politisches Kapital, Maximum 12; Regeneration/Jahr = Legitimität/10 × Schwierigkeitsfaktor (1.2/1.0/0.8), Minimum 1; ohne Kapital keine Karte | Konzept §4 + §12 | core/tick |
| FR-012 | Einnahmen = Steuermodell × Wirtschaft; Zinsen werden zuerst vom Budget abgezogen; Defizit bis Schuldenlimit; darüber → Spar-Event und Finanzkrise-Trigger. Startkonfiguration *normal* = Steuermodell flat → 36 BE (M0-Balance-Anker) | Konzept §4.2 + §12 | core/tick |
| FR-013 | In Demokratie findet alle N Jahre eine Wahl statt; gewonnen nur bei gewichteter Ø-Zufriedenheit ≥ 47 UND Zufriedenheit der schwächsten Gruppe ≥ 35 (Unruhe-Gate, PO D12; Schwelle und Zyklus nach dem S0-D-Harness-Befund auf 47 bzw. N = 6 gezogen, PO D18); verlorene Wahl ⇒ Niederlage | Konzept §4.5, §8, §12 | core/events/wahl |
| FR-014 | Misstrauen (parlamentarisch) und Putsch-Roll (Diktatur) als Machtverlust-Rolls | Konzept §3 | core/tick |
| FR-015 | Drei Regierungsformen mit Amtsmodus, Machtverlust und Sondermechanik | Konzept §3 | rules/regierung |
| FR-016 | In parlamentarischer Form braucht ein Gesetz eine Mehrheit im Parlament; Fraktionen sind eine abgeleitete View (pure Funktion aus Gruppenzufriedenheit + Konstitution), zur Mehrheitprüfung im `tick` berechnet und nicht im State gespeichert | Konzept §3, §3a | core/tick |
| FR-017 | Konstitution: ~8 Entscheidungen mit sofortigem baseline-Effekt auf Gruppen und dauerhaftem Regelsatz-Modifikator | Konzept §3 | rules/constitution |
| FR-018 | Konstitution ist nach dem Setup nicht änderbar; Änderung nur per Referendum mit hohen Risiko-Kosten | Konzept §3, §11 | core/tick |
| FR-019 | Legitimität steigt mit Zufriedenheit + Konstitutionstreue, sinkt mit Skandalen/Zensur | Konzept §2C | core/tick |
| FR-020 | Opposition = Σ (unzufriedene Gruppen × Gewicht × Radikalisierungsgrad) | Konzept §2C | core/tick |
| FR-021 | Radikalisierungskurve: E (0–100, Start 10) wächst/Jahr bei Opposition > 40 UND Legitimität < 40 um `(Opposition−40)×0.3 + (40−Legitimität)×0.2`, sonst −3; Stimmanteil = E × 0.6 | Konzept §2C + §12 | core/tick |
| FR-022 | Extremistische Agenda erzwingt Trade-offs (z. B. sinkende liberale Zufriedenheit), nicht „nur appeasen“ | Konzept §11 | core/events |
| FR-023 | Niederlagen: Wahl verloren, Putsch, Staatsbankrott (Schulden ≥ Limit zwei Jahre in Folge UND Wirtschaft < 25), extremistische Machtergreifung bei Wahl wenn E ≥ 70 UND Stimmanteil (E × 0.6) ≥ Regierungspartei; Koalitionsdruck bei Wahl gewonnen mit 58 ≤ E < 70 (3 Jahre, pro Jahr 2 Agenda-Slots; bei Band 2 alle Slots, bei Band 4–5 mindestens 2) | Konzept §8 + §12 | core/tick |
| FR-024 | Score = Ø Indikatoren + gewichtete Ø Zufriedenheit + Regime-Dauer × 0.5; Spiel endet spätestens nach 50 Jahren (Hard-Cap), danach Score-Ende | Konzept §8 + §12 | core/score |
| FR-025 | Events sind deklarative Regeln: `bedingung → wahrscheinlichkeit → Kette/Options` | Konzept §5 | rules/event |
| FR-026 | Ketten-Tiefe ist im Schema begrenzt; jedes Event hat einen garantierten Exit („Effekt verfällt“) | Architektur §5 | rules/event |
| FR-027 | Bedingungen nur als typisierte Prädikate (Indikator-Vergleich, Gruppen-Zufriedenheit, Schulden, OR als Liste); kein Expression-Interpreter | ADR-004 | core/eval |
| FR-028 | Karten-Vorhersage = Dry-Run von `tick` auf einer Kopie mit eigenem RNG-Fork (Substream aus `hash(seed, Spieljahr, Action-Folge)`); der echte RNG-Stream wird nicht verbraucht, die Kopie wird verworfen; Event-Effekte werden als Wahrscheinlichkeiten/Erwartungswerte angezeigt, deterministische Effekte exakt | Architektur §3, ADR-009 | core/tick |
| FR-029 | Karten-Auswahl im `tick`: Slots pro Jahr = **2–5** (Standard 3, 4 bei Legitimität ≥ 70, 2 bei politischem Kapital ≤ 2); erzwungene Agenda-Slots aus G8/G10 werden vor dem Sampling besetzt und zählen in die Slots; Pool = constraint- und cooldown-erfüllende Karten; Gewicht = Σ Gewicht unzufriedener adressierter Gruppen + (100 − Indikatorlevel) − Cooldown-Nähe; gewichtetes seedgesteuertes Sampling ohne Zurücklegen (Seed = Session-Seed + Jahr); **Coverage-Boden, slot-begrenzt:** mindestens eine Karte je unzufriedener Gruppe, solange die Slots reichen; bei weniger Slots als unzufriedenen Gruppen werden die höchst-gewichteten priorisiert und Agenda-Slots gelten bereits als Coverage für die Gruppen, die sie adressieren; das 2-Slot-Jahr wird im News-Feed als „die Regierung ist schwach“ sichtbar · Agenda-Karten (G8/G10) kosten je 1 politisches Kapital · während des Koalitionsdrucks ist das Populismus-Fenster außer Kraft gesetzt (G14), damit die Agenda-Last maximal 2 Slots beträgt und bei jedem Band erfüllbar ist | Konzept §4.3 + §12, ADR-010 (amendiert durch G13) | core/tick |
| FR-030 | Cooldown je Entscheidung (in Jahren) wird im State geführt | Konzept §6 | core/state |
| FR-031 | `diminishing_at`: oberhalb des Schwellenwerts wirkt der Indikator-Delta reduziert | Konzept §6 | core/tick |
| FR-032 | Constraints: Regierungsform und `erfordert: { indikator: "<op>" }` müssen erfüllt sein, sonst ist die Karte nicht wählbar | Konzept §6 | core/eval |
| FR-033 | Gesetze-Katalog V1: ~30 Decision-Cards, jede mit Kosten, Voraussetzungen, Vorhersage | Konzept §9 M3 | content/base |
| FR-034 | Regel-Typen: `decision`, `event`, `constitution`, `gruppe`, `indikators`, `wahlregel`, `regierung` — alle gegen dasselbe Zod-Schema | Konzept §6, ADR-003 | core/rules |
| FR-035 | Gruppen und Indikatoren werden per Tag referenziert; Packs docken an bestehende Regeln an | Konzept §6 | core/rules |
| FR-036 | YAML-Pack-Loader validiert atomisch (alles-oder-nichts); Base-Pack bleibt bei Fehler unverändert | Architektur §5 | loader |
| FR-037 | Pack-Fehlerliste enthält Datei und Zeile; das Spiel läuft ohne das Pack weiter | Architektur §5 | loader |
| FR-038 | Jedes Pack trägt `schema_version`; Migrationen sind definiert, inkl. Indikator-Migration 5 → 7 mit Default-Werten; Mod-Packs dürfen weitere Indikator-Tags definieren | ADR-003, §3a | loader/rules |
| FR-039 | Save enthält Schema-Version, Seed, Action-Log, letzten Snapshot und Backup-Slot | ADR-005 | core/save |
| FR-040 | Autosave nach jedem Tick; Reload stellt den Spielzustand wieder her | Architektur §5 | core/save + app |
| FR-041 | News-Einträge werden im `tick` aus deterministischen Templates erzeugt; Templates sind Pack-Content (Tags), die Variantenwahl läuft über den seedbaren RNG; kein LLM, kein seedloses Rauschen; die News gehören in den Golden-Hash | Konzept §7, §3a | core/tick + content |
| FR-042 | Dashboard auf einem Bildschirm: N Indikator-Gauges dynamisch aus dem Indikator-Set (V1: 7), Gruppen-Heatmap, Budget-Slider, PK-Balken; keine Tabellen | Konzept §7, §3a | app |
| FR-043 | Der `tick` erzeugt den `zufriedenheits_trace` mit den Top-2 Delta-Beiträgen inkl. Ursprungs-ID (Regel/Event/Indikator); die UI rendert nur den Trace und berechnet nichts selbst; der Trace ist deterministisch und Teil des Golden-Hash | Konzept §7, ADR-008 | core/tick + app |
| FR-044 | Berater-Text ist eine narrative Ableitung des `zufriedenheits_trace` in der app-Schicht (kein Kern); „Genauigkeit“ = Detailtiefe, skaliert mit dem Forschungs-Indikator; die Vorhersage bleibt exakt (ADR-009) | Konzept §7, §3a | app |
| FR-045 | Drei Schwierigkeitsgrade als Parameter-Pack: Verschleiß 0.7/1.0/1.3, PK-Regeneration 1.2/1.0/0.8, Event-Wahrsch. 0.6/1.0/1.4, Schuldenlimit 120/100/80, Zins 0.05/0.08/0.12, Startzuschuss +10/0/−10 BE | Konzept §9 M6 + §12 | content/packs |
| FR-046 | Score-Anzeige und Neustart mit Seed am Spielende | Konzept §8, §9 M6 | app |
| FR-047 | Setup-Phase ist der erste Spielzug: Regierungsform, dann Konstitution | Konzept §3 | core+cli+app |
| FR-048 | CLI (Text-UI) spielt das ganze Spiel durch; die Zufriedenheitsformel ist im Log sichtbar | Konzept §9 M0 | cli |
| FR-049 | AutoSim-Harness: kopflose Strategien × Seeds × Jahre, reportet Score-Spread | Konzept §11, Architektur §2 | cli |
| FR-050 | Spiel und alle Texte sind deutsch; keine realen Ländernamen | Konzept §7, §10 | content/base |
| FR-051 | Erzwungene Agenda-Karten (G8/G10) kosten je 1 politisches Kapital; während des Koalitionsdrucks feuert das Populismus-Fenster nicht; die Agenda-Last überschreitet nie das Slot-Band | Konzept §12 (G14, G15), ADR-010 | core/tick |

**Non-Goals (Konzept §10, unverändert übernommen):** keine Militär-/Kriegssimulation, keine Map/Territorium, kein Multiplayer, keine echte Volkswirtschafts-Gleichung, kein Echtzeit-Modus, keine realen Ländernamen.

---

## 5. Nicht-funktional Requirements (NFR)

| ID | Kategorie | Requirement | Metrik | Quelle | Stories |
|---|---|---|---|---|---|
| NFR-001 | Determinismus | gleicher Seed + gleiche Aktionen ⇒ gleicher Verlauf | Golden-Test: Seed → 100 Jahre → identischer State-Hash, im CI | Architektur §2/§5 | US-M0-03, US-M0-16, US-M0-17 |
| NFR-002 | Robustheit | kein State-Wert je NaN oder außerhalb 0–100 | Invariant-Check nach jedem Tick, 0 Verletzungen in 10 000 Harness-Ticks | Architektur §5 | US-M0-04 |
| NFR-003 | Robustheit | kaputtes Mod-Pack crasht das Spiel nie | atomische Abweisung, Base-Pack bleibt aktiv | Architektur §5 | US-M4-02 |
| NFR-004 | Testbarkeit | Kern läuft headless ohne Browser | alle Kern-Tests ohne DOM; `core/` hat keine Abhängigkeit zu `app/` | ADR-002 | US-M0-11, US-M0-14 |
| NFR-005 | Erweiterbarkeit | Expansion-Pack = Dateien, kein Code | Beispiel-Pack mit neuer Gruppe + neuer Entscheidung ohne Kern-Änderung | Konzept §6/M4 | US-M4-07 |
| NFR-006 | Einfachheit | eine Sprache, ein Build, kein Server, keine DB | 1 npm-Build, 0 Backend-Prozesse | Architektur §4 | US-M0-01 |
| NFR-007 | Offline | Spielbar ohne Netz nach Erstlad | kein Runtime-Fetch außer Assets | ADR-001 | US-M6-12 |
| NFR-008 | Performance | Tick ist trivial klein | Tick < 100 ms headless; UI-Update nach Tick < 250 ms; Snapshot ~12 KB (ADR-008 lockert die <10 KB-Grenze) | Architektur §4, ADR-008 | US-M0-11, US-M5-01 |
| Persistenz | ein localStorage-Slot + JSON-Export als Fallback | Quota-Fallback getestet | Architektur §5 |
| Usability | neue Spieler schaffen ≥ 5 Turns ohne Tutorial | Onboarding-Test mit 5 Testern, keine Erklärung von außen | Konzept §9 M5 |
| Verständlichkeit | Vorhersage auf jeder Karte sichtbar | 100 % Karten mit Vorhersage; Konsistenz-Test | Konzept §7 |
| Barrierefreiheit (Annahme) | Heatmap-Kontrast ≥ 4.5:1, Karten per Tastatur erreichbar | WCAG AA für das Dashboard | eigene Annahme, siehe A-06 |
| Bundle | Start-Load klein | Build < 1 MB gzip, initial < 3 s auf 4G | eigene Annahme, A-05 |

---

## 6. Process-Modell (AS-IS → TO-BE)

**AS-IS (Konzept §4, unvollständig):** Lagebericht → Budget verteilen → Karten wählen → Auflösung → Machtcheck.
Unklar im AS-IS: Reihenfolge von PK-Regeneration, Event-Auflösung vs. Zufriedenheit, Vorhersage-Mechanismus, Parlament-Mehrheit, Grund einer Zufriedenheitsänderung.

**TO-BE (Spezifikation, exakt die Turn-Pipeline der Architektur §3):**

1. **Action-Annahme** — UI/CLI sendet Action (Budget-Verteilung, Kartenwahl) als reine Daten-Nachricht. Ungültige Action (zu viel Budget, fehlendes PK, Constraint verletzt) wird abgewiesen, der State bleibt unverändert.
2. **Budget-Wirkung + Verschleiß + Konstitutions-Modifikatoren** → Indikatoren (FR-005/006/017).
3. **Zufriedenheitsformel** als eine reine Funktion (FR-007). Dabei wird je Gruppe die Delta-Ursache protokolliert (für FR-043; siehe Gap G1).
4. **Event-Registry** prüft typisierte Prädikate, würfelt mit dem RNG im State, öffnet Ketten/Options (FR-025/027). Options werden als Decision-Cards angeboten.
5. **Machtcheck** — Wahl alle N Jahre (FR-013), Misstrauen (FR-014), Putsch-Roll, Bankrott-Check (FR-012/023), Radikalisierung (FR-021).
6. **Invariant-Check** (FR-002) → neuer State-Snapshot + News-Einträge; Autosave (FR-040).
7. **Vorhersage** ist Schritt 2–6 als Dry-Run auf einer Kopie, ohne den RNG des echten States zu verbrauchen (FR-028, Gap G2).

**Key Changes AS-IS → TO-BE:** Vorhersage wird Teil des Kerns (nicht der UI); ungültige Actions sind abweisbar; Zufriedenheits-Ursachen werden getrackt; Invariant-Check ist ein Pflicht-Gate am Ende jedes Ticks; PK-Regeneration läuft vor der Kartenwahl (sonst ist „letzte Karte des Jahres“ nicht entscheidbar).

---

## 7. Stories nach Meilenstein

Testbare Akzeptanzkriterien (Given/When/Then) je Story: `akzeptanzkriterien.md` (99 Kriterien-Blöcke, deckt alle 99 Stories).

Legende: **MoSCoW** (M=Must, S=Should, C=Could, W=Won't), **Größe** S = ≤ 2 Tage, M = ≤ 5 Tage (ein Entwickler, TypeScript-Niveau der Architektur). Reihenfolge = empfohlene Sequenz innerhalb des Milestones.

### M0 — Core-Loop & Balance-Fundament (Text-UI)
**Gate:** ein Spiel ist komplett im Terminal durchspielbar; Zufriedenheitsformel ist im Log sichtbar; Golden-Hash läuft in CI; AutoSim-Harness reportet Score-Spread.

| ID | Story | Schicht | MoSCoW | Größe | FR |
|---|---|---|---|---|---|
| US-M0-01 | Als Entwickler will ich ein Monorepo mit `core/` + `cli/` in TypeScript strict, npm workspaces, ESLint/Prettier und vitest, damit der Kern ohne UI gebaut und getestet werden kann. | Repo | M | S | Architektur §4 |
| US-M0-02 | Als Kern-Entwickler will ich ein unveränderliches `GameState` mit 5 Indikatoren, 3 Gruppen (Zufriedenheit + Gewicht), Budget, PK, Legitimität, Schulden, Jahr, RNG-State und leerem Konstitutions-Feld, damit der Turn eine Snapshot-Funktion sein kann. | core/state | M | M | FR-001 |
| US-M0-03 | Als Tester will ich den seedbaren RNG (mulberry32) im GameState statt global, damit derselbe Seed denselben Verlauf erzeugt. | core/RNG | M | S | FR-004 |
| US-M0-04 | Als QA will ich Clamp auf 0–100 an allen Effekten und einen Invariant-Check nach jedem Tick mit Regel-ID im Fehlerfall, damit schlechte Regelwerte nie NaN erzeugen. | core/invariant | M | S | FR-002 |
| US-M0-05 | Als Spieler will ich, dass Indikatoren jährlich nach `budget_wirkung + ereignis_delta − verschleiss` laufen, damit Nichtstun bestraft wird. | core/tick + content | M | M | FR-005/006 |
| US-M0-06 | Als Designer der Balance will ich die Zufriedenheitsformel aus Konzept §2B als eine reine Funktion ohne Zusatz-Terme, damit das Balance-Risiko des Konzepts (§11) messbar wird. | core/tick | M | M | FR-007/008 |
| US-M0-07 | Als Spieler will ich, dass die Steuerlast der Konstitution die Gruppenzufriedenheit mindert, damit das Steuermodell echte Folgen hat. | core/tick | M | S | FR-010 |
| US-M0-08 | Als Spieler will ich, dass die letzten 3 Beschlüsse nachwirken, damit kurzfristige Konsequenzen sichtbar sind und „Optimal-Pflanzen“ verhindert wird. | core/state | M | M | FR-009 |
| US-M0-09 | Als Spieler will ich, dass jede Entscheidung politisches Kapital kostet und sich nach Legitimität regeneriert, damit Machterhalt das Spielziel ist. | core/tick | M | S | FR-011 |
| US-M0-10 | Als Spieler will ich Budget verteilen mit Einnahmen = Steuermodell × Wirtschaft und einem Schuldenlimit, damit Deficit eine Grenze hat. | core/tick | M | M | FR-012 |
| US-M0-11 | Als Kern-Entwickler will ich `tick(state, action, regeln, modus?) → Snapshot` als pure Funktion mit Action-API als einziger Schreibstraße. | core/tick | M | M | FR-003 |
| US-M0-12 | Als Spieler will ich alle 6 Jahre eine Wahl, deren Verlust das Spiel beendet, damit der Kern-Loop ein Ende hat. | core/tick | M | M | FR-013 |
| US-M0-13 | Als Content-Autor will ich den M0-Basis-Content (5 Indikatoren, 3 Gruppen, 5 Basis-Entscheidungen) als TS-Objekte gegen das Zod-Schema, damit der Loop spielbaren Content hat. | content/base | M | S | FR-034 |
| US-M0-14 | Als Spieler will ich das Spiel komplett im Terminal spielen (Lagebericht → Budget → Karten → Auflösung → Machtcheck), damit M0 ohne UI abgenommen werden kann. | cli | M | M | FR-048 |
| US-M0-15 | Als Spieler will ich im CLI einen textuellen Lagebericht pro Turn, damit die Zahlen erzählt statt getabellt werden. | cli | S | S | FR-041 |
| US-M0-16 | Als QA will ich einen Golden-Replay-Test (fester Seed → 100 Jahre → State-Hash) im CI, damit Determinismus-Regressionen sofort auffallen. | cli/test | M | M | FR-004, NFR-001 |
| US-M0-17 | als Balance-Analyst will ich den AutoSim-Harness (4 Naiv-Strategien × 20 Seeds × 30 Jahre), damit die Formel vor dem Content balanciert wird. | cli | M | M | FR-049 |
| US-M0-18 | als Balance-Analyst will ich den Score-Spread als Fixture im Repo, damit jede spätere Regel gegen eine Baseline geprüft wird. | cli/test | S | S | FR-049 |

**Abhängigkeiten M0:** US-M0-02 → US-M0-11 → US-M0-14; US-M0-06 hängt an US-M0-05 und US-M0-07. Gate-Storys: US-M0-14, US-M0-16, US-M0-17.

### M1 — Regierungsform + Konstitution (Setup-Phase)
**Gate:** die Konstitution verändert nachweislich Wahlmechanik und Event-Wahrscheinlichkeiten (Konzept §9 M1).

| ID | Story | Schicht | MoSCoW | Größe | FR |
|---|---|---|---|---|---|
| US-M1-01 | Als Modder will ich die Regel-Typen `constitution`, `regierung`, `wahlregel` im Zod-Schema, damit Setup-Mechanik deklarativ ist. | core/rules | M | M | FR-034 |
| US-M1-02 | Als Spieler will ich als ersten Spielzug die Regierungsform wählen, damit die Baseline des Spiels feststeht. | core + cli | M | M | FR-015/047 |
| US-M1-03 | Als Spieler will ich die drei Formen präsidentielle / parlamentarisch / Diktatur mit Amtsmodus und eigener Machtverlust-Mechanik. | core/tick | M | M | FR-015/014 |
| US-M1-04 | Als Spieler will ich ~8 Konstitutions-Entscheidungen (Grundrechte, Gewaltenteilung, Wahlrecht, Pressefreiheit, Zentral/föderal, Steuermodell, Staatsreligion/Weltlichkeit) mit sichtbaren Sofort-Effekten. | content/base | M | M | FR-017 |
| US-M1-05 | Als Spieler will ich, dass die Konstitution die baseline-Zufriedenheit der Gruppen sofort verschiebt, damit der erste Einfluss auf die Bevölkerung spürbar ist. | core/tick | M | M | FR-017 |
| US-M1-06 | Als Spieler will ich, dass die Konstitution dauerhaft Event-Wahrscheinlichkeiten und Gruppen-Modifikatoren verändert, damit der Setup das ganze Spiel prägt. | core/tick | M | M | FR-017 |
| US-M1-07 | Als Spieler in parlamentarischer Form will ich, dass Gesetze eine Mehrheit im Parlament brauchen, damit die Regierungsform echte politische Kosten erzeugt. | core/tick | M | M | FR-016 |
| US-M1-08 | Als Spieler in parlamentarischer Form will ich ein Misstrauens-Votum bei niedriger Legitimität. | core/tick | S | S | FR-014 |
| US-M1-09 | Als Spieler in der Diktatur will ich eine Putsch-Roll aus Elite-/Militärzufriedenheit und Legitimität, inkl. „Elite“ als Gruppe. | core + content | M | M | FR-014 |
| US-M1-10 | Als Spieler will ich Legitimität aus Zufriedenheit + Konstitutionstreue − Skandalen/Zensur, damit Machterhalt messbar ist. | core/tick | M | M | FR-019 |
| US-M1-11 | als QA will ich die Wahlregel-Auswertung (Termin, Wahlvolk, Ergebnis aus Zufriedenheit) typisiert, damit Wahlen je Form unterschiedlich sind. | core/rules/eval | M | M | FR-013 |
| US-M1-12 | Als Spieler will ich, dass die Konstitution nur per Referendum mit hohem Risiko änderbar ist, damit der Setup Gewicht behält. | core/tick | S | M | FR-018 |
| US-M1-13 | Als Spieler will ich die Setup-Phase im CLI bedienen (Form + Konstitution vor Turn 1). | cli | M | M | FR-047 |
| US-M1-14 | als QA will ich Regressionstests, die belegen: zwei verschiedene Konstitutionen erzeugen verschiedene Wahlmechanik und Event-Wahrscheinlichkeiten. | core/test | M | M | Gate M1 |

**Abhängigkeiten M1:** US-M1-01 vor allen Content-Stories; US-M1-07 hängt an der offenen Entscheidung G3 (Fraktionsmodell); US-M1-14 ist die Gate-Story.

### M2 — Krisen & Extremismus
**Gate:** Krisen verändern Gruppenzufriedenheit und können Machtverlust verursachen; Ketten lösen immer (garantierter Exit).

| ID | Story | Schicht | MoSCoW | Größe | FR |
|---|---|---|---|---|---|
| US-M2-01 | als QA will ich typisierte Prädikate (Indikator-Vergleich, Gruppen-Zufriedenheit, Schulden, OR-Liste) statt eines Interpreters, damit Modds keine arbitrary Bedingungen einschleusen. | core/eval | M | M | FR-027 (ADR-004) |
| US-M2-02 | Als Spieler will ich eine Event-Registry, die Bedingungen prüft und mit dem Seed würfelt, damit Krisen datengetrieben und replaybar sind. | core/events | M | M | FR-025 |
| US-M2-03 | als QA will ich Event-Ketten mit Stufen, Options als Decision-Cards, Tiefen-Limit und garantiertem Exit, damit keine Endlosschleife entsteht. | core/events + rules | M | M | FR-025/026 |
| US-M2-04 | Als Spieler will ich die Pandemie-Kette (Ausbruch → Ausbreitung → Gegenmaßnahmen-Pfad) mit Konflikt zwischen Gesundheits- und Wirtschaftszufriedenheit. | content/base | M | M | FR-025 |
| US-M2-05 | Als Spieler will ich die Finanzkrise bei `wirtschaft < 40` OR `schulden > 60 %` mit der Wahl Sparen vs. Stimulus. | content/base | M | M | FR-025/012 |
| US-M2-06 | Als Spieler will ich, dass unzufriedene Unternehmen Kapitalflucht auslösen und die Wirtschaft sinkt. | core/events | S | S | FR-025 |
| US-M2-07 | Als Spieler will ich Skandal-Events, deren Wahrscheinlichkeit von Pressefreiheit/Zensur abhängt. | content/base | S | S | FR-019 |
| US-M2-08 | Als Spieler will ich die Oppositions-Berechnung aus unzufriedenen Gruppen × Gewicht × Radikalisierungsgrad. | core/tick | M | M | FR-020 |
| US-M2-09 | Als Spieler will ich die Radikalisierungskurve (Extremismus-Anteil mit Rechts/Links-Spektrum), damit Unzufriedenheit in Machtverlust münden kann. | core/tick | M | M | FR-021 |
| US-M2-10 | Als Spieler will ich, dass erstarkender Extremismus bei Wahlen eine Populismus-Agenda erzwingt, die liberale Gruppen sinkt — statt „nur appeasen“. | core/events | M | M | FR-022 |
| US-M2-11 | Als Spieler will ich, dass eine extremistische Machtergreifung das Spiel beendet oder Koalitionsdruck erzeugt. | core/tick | M | M | FR-023 |
| US-M2-12 | Als Spieler will ich Staatsbankrott als Niederlage (Schuldenlimit + Zins-Kurve). | core/tick | M | M | FR-023 |
| US-M2-13 | Als Spieler will ich News-Einträge für jede Krise im CLI, damit die Krise erzählt wird. | cli | S | S | FR-041 |
| US-M2-14 | als QA will ich einen Krisen-Harness: über 20 Seeds müssen Krisen auftreten und Ketten immer aufgelöst oder verfallen werden. | cli/test | M | M | FR-026 |
| US-M2-15 | als QA will ich einen Golden-Test mit Seed, der eine Pandemie enthält, damit Event-RNG deterministisch bleibt. | cli/test | M | S | FR-004 |

**Abhängigkeiten M2:** US-M2-01 → US-M2-02 → alle Krisen-Content-Stories; US-M2-08/09 vor US-M2-10/11.

### M3 — Gesetze-Katalog (~30 Karten)
**Gate:** keine dominante Strategie (PK + diminishing returns + RNG); Vorhersage == echter Tick.

| ID | Story | Schicht | MoSCoW | Größe | FR |
|---|---|---|---|---|---|
| US-M3-01 | als Modder will ich das vollständige `decision`-Schema: `cost {budget, politisches_kapital}`, `effects` (indikator/gruppe), `constraints`, `cooldown`, `diminishing_at`. | core/rules | M | M | FR-030/031/032 |
| US-M3-02 | Als Spieler will ich die Vorhersage einer Karte als Dry-Run von `tick` auf einer State-Kopie, ohne den echten RNG zu verbrauchen. | core/tick | M | M | FR-028 |
| US-M3-03 | Als Spieler will ich, dass Karten mit verletzten Constraints nicht wählbar sind (Regierungsform, `erfordert: indikator`). | core/eval | M | S | FR-032 |
| US-M3-04 | Als Spieler will ich Cooldowns pro Entscheidung im State geführt, damit dieselbe Karte nicht jedes Jahr spielbar ist. | core/state | M | S | FR-030 |
| US-M3-05 | als QA will ich `diminishing_at`: oberhalb der Schwelle wirkt der Delta reduziert (Konzept: ab 70 nur noch +1). | core/tick | M | S | FR-031 |
| US-M3-06 | Als Spieler will ich pro Jahr 2–5 Karten aus dem Katalog (Slots nach Lage), ausgewählt nach Seed + Lage, damit der Katalog nicht komplett sichtbar ist. | core/tick | M | M | FR-029 |
| US-M3-07 | Als Content-Autor will ich das Themen-Pack Bildung/Forschung (~6 Karten). | content/base | M | S | FR-033 |
| US-M3-08 | Als Content-Autor will ich das Themen-Pack Wirtschaft/Budget (~6 Karten). | content/base | M | S | FR-033 |
| US-M3-09 | Als Content-Autor will ich das Themen-Pack Soziales/Gesundheit (~6 Karten). | content/base | M | S | FR-033 |
| US-M3-10 | Als Content-Autor will ich das Themen-Pack Sicherheit/Justiz (~6 Karten). | content/base | M | S | FR-033 |
| US-M3-11 | Als Content-Autor will ich das Themen-Pack Reformen/Verfassungsnahe (~6 Karten). | content/base | S | S | FR-033 |
| US-M3-12 | als Balance-Analyst will ich die PK-Kosten so budgetieren, dass nicht alle guten Karten in einem Jahr spielbar sind. | content/base | M | M | FR-011, NFR-Balance |
| US-M3-13 | als Balance-Analyst will ich den Harness mit ≥ 5 Strategien und dem Score-Spread-Report, damit keine Strategie dominiert. | cli/test | M | M | Gate M3 |
| US-M3-14 | als QA will ich einen Vorhersage-Konsistenz-Test: Dry-Run-Ergebnis == Ergebnis des folgenden echten Ticks. | core/test | M | S | FR-028 |
| US-M3-15 | als Spieler will ich, dass erzwungene Agenda-Slots aus Krisen und Populismus vor dem Sampling besetzt werden und die Slot-Zahl je Jahr feststeht (3, 4 bei Legitimität ≥ 70, 2 bei politischem Kapital ≤ 2), damit Koalitionsdruck und PK-Engpass zusammenwirken. | core/tick | M | S | FR-029 |

**Abhängigkeiten M3:** US-M3-01 vor allen Content-Stories; US-M3-02 vor UI-Karten (M5); US-M3-15 vor US-M3-06 (Slot-Zahl muss vor dem Sampling feststehen); Content-Packs (M3-07…M3-11) sind parallelisierbar.

### M4 — Regelsatz-Engine & Mod-Format
**Gate:** ein neuer Pack mit Gruppe + Entscheidung ist ohne Code-Änderung ladbar; kaputte Packs werden atomisch abgewiesen.

| ID | Story | Schicht | MoSCoW | Größe | FR |
|---|---|---|---|---|---|
| US-M4-01 | als Modder will ich `schema_version` im Pack-Header und im Regel-Schema, damit Modds über Versionen migrieren können. | core/rules | M | S | FR-038 |
| US-M4-02 | als Modder will ich einen YAML-Loader (js-yaml + Zod), der ein Pack atomisch validiert (alles-oder-nichts). | loader | M | M | FR-036 |
| US-M4-03 | als Modder will ich eine Fehlerliste mit Datei und Zeile; das Base-Pack bleibt unverändert und das Spiel läuft weiter. | loader | M | M | FR-037 |
| US-M4-04 | als Modder will ich Tag-Referenzen für `gruppe`/`indik`, damit ein Pack an bestehende Regeln andockt, ohne Balance zu brechen. | core/rules | M | M | FR-035 |
| US-M4-05 | als QA will ich `diminishing_at` als Pflichtfeld im Schema, damit unausgewogene Packs zur Load-Zeit abgewiesen werden. | core/rules | M | S | FR-031 |
| US-M4-06 | als Modder will ich eine klare Merge-Policy für Namenskonflikte (Override vs. Shadow) zwischen Base und Pack. | loader | M | M | FR-036 |
| US-M4-07 | als Modder will ich ein Beispiel-Pack (neue Gruppe + neue Entscheidung), das ohne Code-Änderung geladen wird. | loader + content | M | M | Gate M4 |
| US-M4-08 | als Spieler will ich im CLI Packs laden/listen/aktivieren/deaktivieren. | cli | S | M | FR-036 |
| US-M4-09 | als QA will ich den Balance-Harness gegen alle geladenen Packs, damit ein Pack die Balance nicht zerstört. | cli/test | M | M | NFR-Erweiterbarkeit |
| US-M4-10 | als Modder will ich eine Pack-Dokumentation (`references/mod-format.md`) mit gültigen Beispielen und Fehlerfällen. | Doku | S | S | FR-036 |
| US-M4-11 | als Spieler will ich ein Pack per Datei in der Web-UI importieren (Drag & Drop). | app | C | M | Annahme A-04 |

### M5 — UI-Polish (Dashboard, Svelte-Adapter)
**Gate:** neue Spieler verstehen das Spiel ohne Tutorial und schaffen ≥ 5 Turns erfolgreich.

| ID | Story | Schicht | MoSCoW | Größe | FR |
|---|---|---|---|---|---|
| US-M5-01 | als UI-Entwickler will ich den Svelte-5/Vite-Adapter, der nur readonly-Snapshots liest und Actions sendet, damit der Kern nicht mutiert wird. | app | M | S | FR-003 (ADR-002/006) |
| US-M5-02 | als Spieler will ich die Setup-Phase als UI (Regierungsform + Konstitution mit sichtbaren Effekten). | app | M | M | FR-047 |
| US-M5-03 | als Spieler will ich 7 Indikator-Gauges auf einem Bildschirm, damit der Zustand sofort erkennbar ist. | app | M | M | FR-042 |
| US-M5-04 | als Spieler will ich eine Gruppen-Heatmap farbcodiert nach Zufriedenheit. | app | M | M | FR-042 |
| US-M5-05 | als Spieler will ich Budget-Slider mit Einnahmen-/Defizit-Anzeige und Schuldenlimit-Warnung. | app | M | M | FR-012 |
| US-M5-06 | als Spieler will ich einen Politisches-Kapital-Balken, damit der Engpass sichtbar ist. | app | M | S | FR-011 |
| US-M5-07 | als Spieler will ich Decision-Karten mit vollständiger Vorhersage (`+4 Bildung · +6 Jugend · −2 Unternehmen · 10 Budget · 2 PK`). | app | M | M | FR-028 |
| US-M5-08 | als Spieler will ich den News-Feed als Primärinterface, das Zahlen erzählt. | app + content | M | M | FR-041 |
| US-M5-09 | als Spieler will ich auf jeder Gruppe den Tooltip „Wer ist sauer und warum?“ mit den 2 wichtigsten Gründen. | core + app | M | M | FR-043 |
| US-M5-10 | als Spieler will ich das Machtregister sehen (Legitimität, Opposition, Extremismus-Anteil, Schulden). | app | S | M | FR-019/020/021 |
| US-M5-11 | als Spieler will ich Berater, deren Genauigkeit mit dem Forschungslevel steigt. | app | C | M | FR-044 |
| US-M5-12 | als Product Owner will ich einen Onboarding-Test mit 5 neuen Spielern ohne Tutorial (≥ 5 Turns erfolgreich). | Test | M | M | Gate M5, NFR-Usability |
| US-M5-13 | als Spieler will ich das Dashboard auf Tablet nutzen (Layout ab 768 px). | app | C | S | Annahme A-05 |
| US-M5-14 | als Spieler will ich Tastatur-Navigation und suffizienten Kontrast in der Heatmap. | app | S | M | NFR-Accessibility |

### M6 — Persistenz, Score, Schwierigkeit, Finish
**Gate:** Replaybar mit seedbarer RNG; Save-Migration und Backup-Fallback getestet.

| ID | Story | Schicht | MoSCoW | Größe | FR |
|---|---|---|---|---|---|
| US-M6-01 | als QA will ich das versionierte Save-Format: Schema-Version + Seed + Action-Log + letzter Snapshot + Backup-Slot. | core/save | M | M | FR-039 (ADR-005) |
| US-M6-02 | als Spieler will ich nach jedem Tick ein Autosave in localStorage und Wiederherstellung beim Reload. | core/save + app | M | M | FR-040 |
| US-M6-03 | als QA will ich Migrationen und den Backup-Fallback bei korruptem/incompatiblem Save mit Warnung. | core/save | M | M | FR-039 |
| US-M6-04 | als Spieler will ich Saves als JSON exportieren/importieren (localStorage-Quota-Fallback). | app | S | M | FR-039 |
| US-M6-05 | als QA will ich den Replay aus Seed + Action-Log (Rückspulen optional). | core/save + cli | C | M | FR-004 |
| US-M6-06 | als Spieler will ich den Score (Entwicklungsindex + Ø Zufriedenheit + Regime-Dauer) mit je Regierungsform eigener Gewichtung. | core/score | M | M | FR-024 |
| US-M6-07 | als Spieler will ich am Spielende Score, Ursache des Machtverlusts und den Seed sehen und neu starten. | app | S | S | FR-046 |
| US-M6-08 | als Spieler will ich drei Schwierigkeitsgrade als Parameter-Set ohne neue Mechanik. | content/packs | M | M | FR-045 |
| US-M6-09 | als Spieler will ich dezente Audio-Signale (Turn-Abschluss, Krisen-Alarm, Wahl). | app | C | M | Konzept §9 M6 |
| US-M6-10 | als Spieler will ich eine endlose Sandbox ohne Spielende. | core/tick | C | M | Konzept §8 |
| US-M6-11 | als Spieler will ich den Seed anzeigen, kopieren und weitergeben können. | app | S | S | FR-004 |
| US-M6-12 | als Maintainer will ich den Vite-Build statisch auf GitHub Pages/itch.io deployen, offline spielbar. | Build | M | S | ADR-001 |
| US-M6-13 | als QA will ich das Release-Gate: Golden-Hash, Score-Spread, Pack-Load-Test, Save-Migration-Test, Onboarding-Ergebnis. | Test | M | M | alle NFR |

### V1-Backlog gesamt
| Meilenstein | Stories | Must | Should | Could | Won't (V1) |
|---|---|---|---|---|---|
| M0 | 18 | 16 | 2 | 0 | — |
| M1 | 14 | 12 | 2 | 0 | — |
| M2 | 15 | 12 | 3 | 0 | — |
| M3 | 15 | 14 | 1 | 0 | — |
| M4 | 11 | 8 | 2 | 1 | — |
| M5 | 14 | 10 | 2 | 2 | — |
| M6 | 13 | 7 | 3 | 3 | — |
| **Summe** | **100** | **79** | **15** | **6** | Multiplayer, Krieg/Map, Echtzeit, Cloud-Save, reale Länder, Multi-Language |

---

## 8. Annahmen & Constraints

| ID | Annahme/Constraint | Status | Konsequenz wenn falsch |
|---|---|---|---|
| A-01 | Auslieferung als client-only Web-App (Browser) | Annahme (Architektur §1) | nur Adapter-Change, Kern bleibt (ADR-002) |
| A-02 | Offline spielbar nach Erstlad, kein Netz für Spielbarkeit | Annahme | Cloud-Save/Multiplayer brauchen Backend |
| A-03 | Team: klein, TypeScript-erfahren, kleines Budget | Annahme | Svelte-Choice betroffen, nicht der Kern |
| A-04 | Mod-Packs werden als Datei distribuiert (Import), kein Online-Pack-Repo | Annahme | UI-Import-Flow nötig (US-M4-11) |
| A-05 | Zielgeräte: Desktop-Browser + Tablet; Chrome/Firefox/Safari aktueller Stand | Annahme (BA) | Layout-Arbeit in M5-13 |
| A-06 | Barrierefreiheit: WCAG AA für das Dashboard | Annahme (BA) | zusätzlich S, M5-14 |
| A-07 | Ziel-Session 12–25 Jahre-Schritte, Hard-Cap 50 Jahre, danach Score-Ende (von Ralf korrigiert) | real (Konzept §12) | Score- und Schulden-Kurve ist im 50-Jahre-Rahmen balanciert (Spar-Zone ab ~Jahr 15 bei normal); der M0-Core-Loop endet gemessen Jahr 6 — das Ziel gilt ab M1/M2 (D18) |
| A-08 | Turn-Ausführung ist synchron (kein Async-Work im Tick) | Annahme | Determinismus-Garantie bleibt |
| C-01 | Einzelspieler, diskreter Jahres-Turn, kein Echtzeit | real (Konzept §10) | kein Streaming/Echtzeit im Kern |
| C-02 | Seedbarer Zufall/Replaybarkeit | real (Konzept §5/§9) | RNG im State, kein crypto.random für Gameplay |
| C-03 | Regelsatz data-driven: Pack = Dateien, kein Code | real (Konzept §6) | Zod-Schema ist Modder-API, versionspflichtig |
| C-04 | Balance-Test mit Auto-Simulator ab M0 | real (Konzept §11) | Harness ist Gate, nicht optional |
| C-05 | UI deutsch, ein Dashboard, keine Tabellen | real (Konzept §7) | keine Tabellen-Komponente |
| C-06 | Kein Backend, keine DB, keine Accounts | real (ADR-001) | kein Cloud-Save, kein Multiplayer in V1 |
| C-07 | Multiplayer bleibt nachrüstbar gehalten (server-authoritative lockstep), wird in V1 nicht gebaut | real (ADR-007) | `tick` kennt keinen Singleplayer-Zweig |
| C-08 | Der M0-Balance-Anker ist fix: Schwierigkeit normal, Steuermodell flat, Verschleiß normal → 17.19 BE Unterhalt gegen 36 BE Einnahmen | real (Konzept §12, K1/K2 gelöst) | Harness-Erwartungen sind an diesen Konstanten fest, nicht an Content-Änderungen |

**Explizit nicht in V1 (Won't):** Multiplayer, Krieg/Militär/Map, Echtzeit-Modus, reale Ländernamen, Cloud-Save/Accounts, Lokalisierung in andere Sprachen, Online-Pack-Repo.

---

## 9. Gap-Analyse — offene Entscheidungen (Konzept ↔ Architektur)

Diese Punkte waren im Konzept oder der Architektur nicht ausdefiniert. **G6–G10 sind durch Ralf gelöst** (Werte in `spielkonzept.md` §12, nachgerechnet in `balance-werte.md`); G1–G5 und G11/G12 warten auf Pädu bzw. Ralf. Ich habe je eine Default-Proposal vorgeschlagen; Pädu/Ralf müssen entscheiden.

| ID | Gap | Betroffene Stories | Default-Proposal | Owner | Blockiert |
|---|---|---|---|---|---|
| G1 | Der Tooltip „Wer ist sauer und warum?“ braucht die **Ursachen** einer Zufriedenheitsänderung; im `state.ts`-Register fehlt ein Delta-Trace. | US-M5-09 | **gelöst (Pädu, ADR-008):** Trace wird vom `tick` erzeugt, UI rendert nur; Snapshot-Grenze ~12 KB; Invariant-Test „Trace-Summe ≈ Delta“ als Gegenmittel gegen neue Effekte ohne Trace. | Pädu | gelöst |
| G2 | Vorhersage per Dry-Run darf den **RNG nicht verbrauchen** — sonst driftet der echte Turn. | US-M3-02, US-M5-07 | **gelöst (Pädu, ADR-009):** RNG-Fork mit Substream aus `hash(seed, Spieljahr, Action-Folge)`; Kopie wird verworfen; Events als Wahrscheinlichkeiten/Erwartungswerte. | Pädu | gelöst |
| G3 | Das **Fraktionsmodell** der parlamentarischen Mehrheit fehlt im State-Register. | US-M1-07 | **gelöst (Pädu, §3a):** Fraktionen = abgeleitete View, pure Funktion; Grundsatz: nur persistent Kern-Zustand im State, alles Ableitbare als pure view-Funktion. | Pädu | gelöst |
| G4 | M0 nutzt 5 Indikatoren, das Dashboard zeigt 7 Gauges → das Indikator-Set wächst zwischen M0 und M3. | US-M0-02, US-M5-03, US-M6-03 | **gelöst (Pädu, §3a):** `indikatoren: Record<tag, number>`, Core ist tag-getrieben, Dashboard rendert N Gauges dynamisch, Migration 5→7 über `schema_version` mit Defaults; Mod-Packs dürfen weitere Indikatoren definieren. | Pädu | gelöst |
| G5 | „Berater-Genauigkeit steigt mit Forschungslevel“ kollidiert mit der garantierten Vorhersage-Korrektur. | US-M5-11 | **gelöst (Pädu, §3a):** Berater = narrative Ableitung des `zufriedenheits_trace` in der app-Schicht; Genauigkeit = Detailtiefe, skaliert mit Forschungslevel; Vorhersage bleibt exakt per ADR-009. | Pädu | gelöst |
| G6 | Schwierigkeitsgrade sind im Konzept nur als „3 Schwierigkeiten“ genannt, ohne Definition. | US-M6-08 | **gelöst (Ralf, §12, bestätigt):** Parameter-Pack mit Verschleiß 0.7/1.0/1.3, PK-Regeneration 1.2/1.0/0.8, Event-Wahrsch. 0.6/1.0/1.4, Schuldenlimit, Zinsfaktor, Startzuschuss. | Ralf | gelöst |
| G7 | Staatsbankrott ist Niederlage, aber die Schulden-Kurve (Zinsen und Zinswachstum) ist nicht definiert. | US-M2-12 | **gelöst (Ralf, §12):** Limit 120/100/80, Zins = Schulden × 0.05/0.08/0.12; Bankrott bei Limit in zwei Folgejahren UND Wirtschaft < 25. | Ralf | gelöst |
| G8 | „Koalitionsdruck“ bei extremistischer Machtergreifung ist nicht spezifiziert. | US-M2-11 | **gelöst (Ralf, §12):** Niederlage bei Wahl wenn E ≥ 70 UND Stimmanteil (E × 0.6) ≥ Regierungspartei; Koalitionsdruck bei Wahl gewonnen mit 58 ≤ E < 70 → 3 Jahre, pro Jahr 2 Agenda-Slots nach Band (bei Band 2 alle Slots, bei Band 4–5 mindestens 2). | Ralf | gelöst |
| G9 | Die konkreten Werte für Verschleiß, Gewichts-Matrizen und budget_wirkung fehlen. | US-M0-05, US-M0-06 | **gelöst (Ralf, §12 revidiert):** Verschleiß-, Wirkungs- und Gewichts-Tabelle in `balance-werte.md`; Unterhalt nachgerechnet 17.19 BE ohne / 21.19 BE mit Forschung (K1 korrigiert). | Ralf | gelöst |
| G10 | „Populismus-Zwang“ braucht eine Agenda-Mechanik (welche Karten werden erzwungen?). | US-M2-10 | **gelöst (Ralf, §12):** Populismus-Fenster bei E ≥ 40 und ≥ 2 Jahre vor Wahl; pro Jahr 1 Slot aus dem Band 2–5, erzwungene Karte 0 BE / 1 PK, permanent −5 Liberale bzw. −5 Unternehmen; während des Koalitionsdrucks außer Kraft (G14). | Ralf | gelöst |
| G11 | News-Feed: Textgenerierung ist nicht definiert. | US-M5-08 | **gelöst (Pädu, §3a):** Templates als Pack-Content (Tags), Variantenwahl über seedbaren RNG, News gehören in den Golden-Hash. | Pädu | gelöst |
| G12 | Kartenauswahl „3–5 Karten pro Jahr“ ohne Auswahl-Heuristik. | US-M3-06 | **gelöst (Pädu, ADR-010):** gewichtetes seedgesteuertes Sampling + Coverage-Boden (mindestens eine Karte je unzufriedener Gruppe); Heuristik wird im AutoSim-Harness mitgetestet (zu enge Heuristik → tote Jahre). | Pädu | gelöst |
| G13 | ADR-010 sagte „3–5 Karten pro Jahr“, das revidierte Konzept §12 erlaubt 2 Slots bei politischem Kapital ≤ 2 und besetzt Agenda-Slots vor dem Sampling. | US-M3-06, US-M3-13, US-M3-15 | **gelöst (Pädu, Option 1, Ralf endorscht):** ADR-010 amendiert auf **2–5 Slots**. Der volle Coverage-Boden ist bei 2 Slots mathematisch unmöglich und wird slot-begrenzt (höchst-gewichtete unzufriedene Gruppen zuerst, Agenda-Slots gelten als Coverage für adressierte Gruppen). Option 2 wurde verworfen, weil sie den PK-Engpass in schwachen Jahren abgeschaltet hätte. | Pädu | gelöst |
| G14 | Koalitionsdruck (2 Agenda-Slots) und Populismus-Fenster (1 Agenda-Slot) feuern gleichzeitig: bei Band 2 ein unerfüllbarer Tick, bei Band 3 ein totes Jahr mit 0 gesampleten Karten. | US-M2-11, US-M3-15 | **gelöst (Ralf, Option 1):** Während des Koalitionsdrucks ist das Populismus-Fenster außer Kraft gesetzt — G8 bedient schon die gleiche Richtung und die gleichen Gruppen. Option 2 („Agenda-Last schlägt das Band“) verworfen, weil sie den PK-Engpass aus G13 abschaltet. | Ralf | gelöst |
| G15 | Die Populismus-Karte kostete 3 politisches Kapital; bei Band 2 und PK ≤ 2 war ein Zwangslot damit unerfüllbar. | US-M2-11, US-M3-15 | **gelöst (Ralf):** Agenda-Karten (G8 und G10) kosten je 1 politisches Kapital, damit Zwangslots immer spielbar bleiben. | Ralf | gelöst |

---

## 10. Traceability-Matrix (Auszug der Must-Requirements)

| FR | Requirement-Kurz | Story(s) | Testcase | Meilenstein | Status |
|---|---|---|---|---|---|
| FR-001 | GameState-Felder | US-M0-02 | `state.snapshot` enthält alle Felder, Typ-Check | M0 | spezifiziert |
| FR-002 | Clamp/Invariant | US-M0-04 | 10 000 Harness-Ticks ohne Invariant-Verletzung | M0 | spezifiziert |
| FR-003 | pure tick | US-M0-11 | alter Snapshot bleibt nach Tick unverändert | M0 | spezifiziert |
| FR-004 | Determinismus | US-M0-03, US-M0-16, US-M6-05 | Seed → 100 Jahre → Hash identisch (CI) | M0/M6 | spezifiziert |
| FR-005/006 | Indikatorbewegung + Verschleiß | US-M0-05 | ohne Budget sinkt Infrastruktur jedes Jahr | M0 | spezifiziert |
| FR-007/008 | Zufriedenheitsformel | US-M0-06, US-M0-07 | Formel-Schritte im CLI-Log sichtbar | M0 | spezifiziert |
| FR-009 | Entscheidungsgedächtnis | US-M0-08 | nach 3 Beschlüssen wirkt nur noch die letzten 3 | M0 | spezifiziert |
| FR-011 | Politisches Kapital | US-M0-09 | ohne PK ist keine Karte wählbar | M0/M3 | spezifiziert |
| FR-012 | Budget/Einnahmen/Schulden | US-M0-10, US-M2-05 | Deficit > Limit → Finanzkrise-Trigger | M0/M2 | spezifiziert |
| FR-013/014 | Wahl/Misstrauen/Putsch | US-M0-12, US-M1-03, US-M1-08, US-M1-09 | verlorene Wahl → Niederlage; Putsch-Roll je Form | M0/M1 | spezifiziert |
| FR-016 | Parlamentsmehrheit | US-M1-07 | Gesetz ohne Mehrheit wird abgewiesen; Fraktionen sind berechenbar aus dem Snapshot | M1 | spezifiziert (ADR/§3a) |
| FR-017/018 | Konstitution + Unänderbarkeit | US-M1-04…06, US-M1-12 | Konstitution ändert Wahlmechanik + Event-Wahrsch. | M1 | spezifiziert |
| FR-019/020/021 | Legitimität/Opposition/Radikalisierung | US-M1-10, US-M2-08/09 | niedrige Legitimität + hohe Opposition → Extremismus wächst | M1/M2 | spezifiziert |
| FR-022/023 | Populismus-Zwang, Niederlagen | US-M2-10/11/12 | extremistische Agenda erzwingt Trade-off | M2 | spezifiziert |
| FR-029/051 | Kartenauswahl + Agenda-Regeln | US-M3-06, US-M3-15, US-M2-11 | 2-Slot-Koalitionsjahr: beide Slots erzwungen, 0 gesamplete Karten, Tick spielbar, News-Feed narrirt schwaches Jahr | M2/M3 | spezifiziert (ADR-010) |
| FR-025/026 | Event-Ketten + Exit | US-M2-02/03/14 | Ketten-Tiefe ≤ Limit, jeder Fall endet | M2 | spezifiziert |
| FR-027 | typisierte Prädikate | US-M2-01 | Schema lehnt String-Expression ab | M2 | spezifiziert |
| FR-028 | Vorhersage == echter Tick | US-M3-02, US-M3-14, US-M5-07 | Dry-Run == echter Tick, echter RNG-Stream unverbraucht | M3/M5 | spezifiziert (ADR-009) |
| FR-030/031/032 | Cooldown, diminishing_at, Constraints | US-M3-01/03/04/05 | ab 70 nur +1; Cooldown blockiert; Constraint verletzt → nicht wählbar | M3 | spezifiziert |
| FR-033 | ~30 Karten | US-M3-07…11 | Katalog-Count ≥ 30, alle mit Vorhersage | M3 | spezifiziert |
| FR-034/035/038 | Regel-Typen, Tags, schema_version | US-M1-01, US-M4-01/04 | Zod lehnt ungültige Regel ab | M1/M4 | spezifiziert |
| FR-036/037 | atomischer Loader | US-M4-02/03 | invalides Pack → Base unverändert, Spiel läuft | M4 | spezifiziert |
| FR-039/040 | Save + Autosave | US-M6-01/02/03 | Reload stellt Zustand her; korrupter Save → Backup | M6 | spezifiziert |
| FR-041/042/043 | News, Dashboard, Tooltip | US-M5-03…09 | ein Bildschirm, keine Tabellen; 2 Gründe im Tooltip aus dem Trace | M5 | spezifiziert (ADR-008) |
| FR-045 | Schwierigkeit | US-M6-08 | 3 Parameter-Packs, Score-Spread je Grad | M6 | spezifiziert (§12) |
| FR-006 | US-M0-05 (2 Stories) | US-M0-05, US-M0-17 | Infrastruktur sinkt um 3/Jahr, Bildung und Gesundheit um 2/Jahr; Forschung stagniert bei Bildung < 50 ohne Wachstum und  | M0 | spezifiziert |
| FR-008 | US-M0-06 (2 Stories) | US-M0-06, US-M0-07 | das Ergebnis ist exakt Grundzufriedenheit − Steuerlast; bei Startlevel 40 und Gewicht Σ=1 liegt die Gruppe bei 50, mit S | M0 | spezifiziert |
| FR-010 | US-M0-07 (1 Stories) | US-M0-07 | `steuerlast[unternehmen] > steuerlast[arbeitnehmer]` und die Zufriedenheit ist entsprechend niedriger | M0 | spezifiziert |
| FR-014 | US-M1-08 (2 Stories) | US-M1-08, US-M1-09 | ein Misstrauens-Votum kann ausgelöst werden und das Spiel endet mit Ursache „Misstrauen verloren“ | M1 | spezifiziert |
| FR-015 | US-M1-02 (2 Stories) | US-M1-02, US-M1-03 | die Form ist im State gesetzt und Turn 1 ist erst nach der Konstitution möglich | M1 | spezifiziert |
| FR-018 | US-M1-12 (1 Stories) | US-M1-12 | ohne Referendum wird sie abgewiesen; ein Referendum kostet politisches Kapital und erhöht das Putsch-Risiko | M1 | spezifiziert |
| FR-020 | US-M2-08 (1 Stories) | US-M2-08 | der Wert entspricht der Formel aus Konzept §2C (Test gegen Handberechnung) | M2 | spezifiziert |
| FR-021 | US-M2-09 (1 Stories) | US-M2-09 | der Extremismus-Anteil E wächst nach `E += (Opposition−40)×0.3 + (40−Legitimität)×0.2`; bei Opposition 60 und Legitimitä | M2 | spezifiziert |
| FR-023 | US-M2-11 (2 Stories) | US-M2-11, US-M2-12 | bei einer Wahl endet das Spiel mit Ursache „extremistische Partei an der Macht“, wenn E ≥ 70 UND der Stimmanteil (E × 0. | M2 | spezifiziert |
| FR-024 | US-M6-06 (1 Stories) | US-M6-06 | der Score = Ø Indikatoren + gewichtete Ø Zufriedenheit + Regime-Dauer × 0.5 und die Gewichtung folgt der Regierungsform  | M6 | spezifiziert |
| FR-026 | US-M2-14 (1 Stories) | US-M2-14 | in ≥ 80 % der Runs tritt mindestens eine Krise auf und keine Kette bleibt am Run-Ende offen | M2 | spezifiziert |
| FR-031 | US-M3-05 (2 Stories) | US-M3-05, US-M4-05 | Bildung steigt nur um den reduzierten Delta (+1) statt um +4 | M3/M4 | spezifiziert |
| FR-032 | US-M3-03 (1 Stories) | US-M3-03 | die Karte ist nicht wählbar und der Verletzungsgrund wird angezeigt | M3 | spezifiziert |
| FR-035 | US-M4-04 (1 Stories) | US-M4-04 | die Regel dockt an die bestehende tag-getriebene Mechanik an, der neue Indikator erscheint im Snapshot und im Dashboard, | M4 | spezifiziert |
| FR-037 | US-M4-03 (1 Stories) | US-M4-03 | Datei und Zeile werden gemeldet, das Base-Pack bleibt unverändert und das Spiel läuft weiter | M4 | spezifiziert |
| FR-038 | US-M4-01 (1 Stories) | US-M4-01 | es wird mit der Meldung „schema_version fehlt“ abgewiesen; ein Pack mit unterstützter Version wird geladen | M4 | spezifiziert |
| FR-040 | US-M6-02 (1 Stories) | US-M6-02 | der letzte Zustand wird aus dem Autosave hergestellt und der Turn ist fortsetzbar | M6 | spezifiziert |
| FR-042 | US-M5-03 (2 Stories) | US-M5-03, US-M5-04 | die Gauges werden dynamisch aus dem Indikator-Set erzeugt, sind auf einem Bildschirm ohne Scrollen sichtbar und es gibt  | M5 | spezifiziert |
| FR-043 | US-M5-09 (1 Stories) | US-M5-09 | die 2 wichtigsten Gründe werden aus `zufriedenheits_trace` gerendert, vom `tick` erzeugt mit Ursprungs-ID (Regel/Event/I | M5 | spezifiziert |
| FR-044 | US-M5-11 (1 Stories) | US-M5-11 | der Berater leitet den `zufriedenheits_trace` narrativ ab (app-Schicht), die Detailtiefe ist bei 80 höher und die Vorher | M5 | spezifiziert |
| FR-046 | US-M6-07 (1 Stories) | US-M6-07 | Score, Ursache des Machtverlusts und Seed stehen bereit und ein Neustart ist möglich | M6 | spezifiziert |
| FR-047 | US-M1-13 (2 Stories) | US-M1-13, US-M5-02 | zuerst wird die Regierungsform, dann die Konstitution abgefragt; erst danach ist Turn 1 spielbar | M1/M5 | spezifiziert |
| FR-049 | US-M0-17 (2 Stories) | US-M0-17, US-M0-18 | ein Score-Spread-Report entsteht (Median, Spread, beste Strategie); die Naiv-Strategie „gleichmäßig maximal investieren“ | M0 | spezifiziert |
| FR-050 | US-M0-13 (2 Stories) | US-M0-13, US-M3-07 | alle Regeln validieren fehlerfrei und der Jahreszyklus ist damit vollständig spielbar | M0/M3 | spezifiziert |
| FR-051 | US-M2-11 (2 Stories) | US-M2-11, US-M3-15 | bei einer Wahl endet das Spiel mit Ursache „extremistische Partei an der Macht“, wenn E ≥ 70 UND der Stimmanteil (E × 0. | M2/M3 | spezifiziert |
| FR-048/049 | CLI + AutoSim | US-M0-14/17 | Spiel komplett im Terminal; Harness im CI | M0 | spezifiziert |

---

## 11. Definition of Done (je Story)

1. Implementierung in der zugeordneten Schicht; Kern importiert nichts aus `app/`/`cli/`.
2. Unit-Test gegen die Akzeptanzkriterien; bei Kern-Storys zusätzlich Golden-Test grün.
3. Invariant-Check nach allen neuen Effekten aktiv (kein NaN, kein Out-of-Range).
4. Content-Storys: Regeln validieren gegen das Zod-Schema, `diminishing_at` gesetzt.
5. Deutsch-Texte sind im Content enthalten; keine Tabellen im UI.
6. Harness-Score-Spread verschlechtert sich nicht gegenüber dem letzten Fixture.
7. Milestone-Gate ist mit der Gate-Story des Meilensteins belegt.

---

## 12. Handoffs

- **Pädu (Solution Architect):** alle sechs Architektur-Gaps sind entschieden und in `architektur.md` dokumentiert (ADR-008 Zufriedenheits-Trace, ADR-009 RNG-Fork, ADR-010 Kartenauswahl, §3a State-Register für Fraktionen/Indikatoren/Berater/News). Damit sind die M3/M5-Vorbedingungen erfüllt.
- **Ralf (Konzeptautor):** G6–G10 und K1–K6 sind geliefert und revidiert in §12 hinterlegt — alle Werte nachgerechnet und konsistent (`balance-werte.md`). Wertseitig sind M0/M2/M6 final.
- **Pädu (erledigt):** G13 entschieden — ADR-010 amendiert auf Slot-Band 2–5; Agenda-Slots vor dem Sampling, capped Coverage-Boden. G14/G15 wurden von Ralf entschieden und sind in FR-051 verankert.
- **Product Owner:** Reihenfolge innerhalb der Meilensteine wie oben; M0 zuerst, Events vor Katalog, Mod-Format nach stabilem Kern (Konzept §9 Priorisierung).
- **Task Decomposer:** Stories der Größen S/M sind direkt zerlegbar; Content-Packs (M3-07…M3-11, M4-07) sind parallelisierbar.
- **QA / Test Writer:** Akzeptanzkriterien je Story in `akzeptanzkriterien.md`, Testcases aus der Traceability-Matrix; Golden-Hash, Invariant-, Loader-, Save-Migrations- und Onboarding-Test sind die Gates.
- **UI/UX Designer:** M5-02…09 brauchen G1 (Gründe) und G2 (Dry-Run) als Vorbedingung.
