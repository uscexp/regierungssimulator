# Backlog-Übergabe — „Staatslenker“ V1

**Zweck:** Übergabe an Product Owner (@trix, Backlog-Pflege) und Task Decomposer (Work Breakdown). Der Product Owner ist in diesem Install vorhanden (`@trix`); ein dedizierter Task Decomposer existiert nicht — die Work Breakdown steuert der PO gemeinsam mit dem Build-Team.
**Autoritative Quellen:** `spielkonzept.md` §12 (Werte, Ralf) · `architektur.md` §3/§3a + ADR-001…010 (Struktur, Pädu) · `spezifikation.md` (Requirements + Stories) · `akzeptanzkriterien.md` (Testbarkeit) · `balance-werte.md` (nachgerechnete Werte) · `backlog.csv` (100 Stories, maschinenlesbar).

---

## 1. Meilenstein-Leiter

| Milestone | Stories | Must | Should | Could | Gate (Abnahme) | Roheffekt Must+Should |
|---|---|---|---|---|---|---|
| M0 Core-Loop | 18 | 16 | 2 | 0 | Spiel komplett im Terminal durchspielbar; Zufriedenheitsformel im Log; Golden-Hash im CI; AutoSim-Harness reportet Score-Spread | ~66 Tage |
| M1 Form + Konstitution | 14 | 12 | 2 | 0 | Zwei Konstitutionen erzeugen nachweislich verschiedene Wahlmechanik und Event-Wahrscheinlichkeiten | ~67 Tage |
| M2 Krisen + Extremismus | 15 | 12 | 3 | 0 | Krisen ändern Gruppenzufriedenheit; Ketten lösen immer; ≥ 1 Krise in ≥ 80 % der Harness-Runs | ~63 Tage |
| M3 Gesetze-Katalog | 15 | 14 | 1 | 0 | ≥ 30 Karten mit Vorhersage; keine dominante Strategie; Dry-Run == echter Tick; Slot-Zahl und Agenda-Slots vor dem Sampling | ~45 Tage |
| M4 Regelsatz + Mod-Format | 11 | 8 | 2 | 1 | Beispiel-Pack ohne Code-Änderung ladbar; kaputtes Pack atomisch abgewiesen | ~41 Tage |
| M5 UI-Polish | 14 | 10 | 2 | 2 | 5 neue Spieler schaffen ≥ 5 Turns ohne Tutorial | ~54 Tage |
| M6 Finish | 13 | 7 | 3 | 3 | Replaybar mit seedbarer RNG; Save-Migration und Backup-Fallback getestet | ~41 Tage |

Roheffekt = Stories × (S = 2 Tage, M = 5 Tage), ein Entwickler, Sizes aus der Spec — eine grobe Größenordnung, kein Termin. Must allein: ~332 Tage; Could: ~27 Tage (bewusst verschiebbar).

**Schichten-Verteilung der Stories:** core 49 · app 17 · cli 12 · content 12 · loader 4 · Repo/Test/Doku/Build 5. Der Kern ist der größte Brocken und wird nur einmal gebaut — UI und CLI sind Adapter (ADR-002).

## 2. Reihenfolge & Parallelität

Build-Order laut `architektur.md` §7 (nicht verhandelbar, weil sie das Lern-Risiko minimiert):
1. `core: state + tick + rng + invariant` + Golden-Test → **lernt: ist die Zufriedenheitsformel balancierbar?**
2. CLI-Runner + AutoSim-Harness → Balance-Fundament vor Content.
3. Zod-Schema + TS-Content: Konstitution (M1), Event-Ketten (M2), Katalog (M3).
4. YAML-Loader + Beispiel-Pack (M4).
5. Svelte-Dashboard (M5).
6. Persistenz + Score + Schwierigkeit + Audio (M6).

Parallelisierbar ohne Konflikt: M3 Content-Packs (US-M3-07…11), M4 Beispiel-Pack (US-M4-07), M5 UI-Stories nach Snapshot-Kontrakt (US-M5-03…08).

Abhängigkeits-Ketten, die der Task Decomposer beachten muss:
- `US-M0-02 → US-M0-11 → US-M0-14 → US-M0-17` (State → tick → CLI → Harness)
- `US-M0-05 + US-M0-07 → US-M0-06` (Verschleiß + Steuerlast → Zufriedenheitsformel)
- `US-M1-01 → alle M1-Content-Stories`; `US-M1-14` ist die Gate-Story
- `US-M2-01 → US-M2-02 → alle Krisen-Content`; `US-M2-08/09 → US-M2-10/11`
- `US-M3-01 → alle Katalog-Packs`; `US-M3-02 → US-M5-07` (Vorhersage vor Karten-UI); `US-M3-15 → US-M3-06` (Slot-Zahl vor dem Sampling)
- `US-M4-02 → US-M4-03/06/07/09`
- `US-M5-01 → alle app-Stories`; `US-M5-12` ist die Gate-Story
- `US-M6-01 → US-M6-02/03/04/05`

## 3. Balance-Anker (M0, nachgerechnet)

`balance-werte.md` ist die ausführbare Referenz. Kurzform:
- Start *normal*: Wirtschaft 45, übrige Indikatoren 40, Steuermodell **flat** → Einnahmen 36 BE; Zinsen zuerst vom Budget.
- Unterhalt budgetbarer Indikatoren: **17.19 BE/Jahr** ohne Forschung, **21.19 BE/Jahr** wenn Bildung ≥ 50 (Forschung stagniert darunter — kein Wachstum, kein Verschleiß).
- Schwierigkeit *schwer*: 22.35 BE Unterhalt gegen 26 BE Einnahmen → erwartete Deficit-Spirale ab Jahr ~10–12, Bankrott um Jahr ~20 bei Nachlässigkeit.
- Harness-Erwartungen: „gleichmäßig maximal investieren“ hält Indikatoren bis Jahr ~20 stabil; „nur Wirtschaft“ fällt Infrastruktur mit 3/Jahr auf ~0 nach 13 Jahren und verliert die Wahl ≤ Jahr 12.
- Session-Rahmen: Ziel 12–25 Jahre-Schritte, Hard-Cap 50 Jahre, Score = Ø Indikatoren + gewichtete Ø Zufriedenheit + Regime-Dauer × 0.5.

## 4. Offene Punkte — alle 15 Gaps sind gelöst (G13: Pädu Option 1 · G14/G15: Ralf)

| ID | Offen | Owner | Betroffene Stories | Notiz |
|---|---|---|---|---|
| ~~G13~~ | **gelöst (Pädu, Option 1):** ADR-010 amendiert auf 2–5 Slots; der volle Coverage-Boden ist bei 2 Slots mathematisch unmöglich und wurde slot-begrenzt (höchst-gewichtete unzufriedene Gruppen zuerst, Agenda-Slots gelten als Coverage). | Pädu | US-M3-06, US-M3-13, US-M3-15 | Das 2-Slot-Jahr muss im News-Feed sichtbar sein und darf im Harness kein unplayables Jahr erzeugen. |
| Harness-Kurven | Ralf möchte die 3 Naiv-Kurven (30 Jahre × 20 Seeds) für den letzten Verschleiß-Abgleich. | Backend Developer + QA | US-M0-17/18 | Erst nach dem echten Harness-Lauf — keine Kurven vor der ersten Ausführung erfinden. |
| Coverage-Boden | Der volle Coverage-Boden „eine Karte je unzufriedene Gruppe“ gilt nicht mehr; er ist slot-begrenzt (ADR-010 amendiert). | — | US-M3-06, US-M3-15 | Ralfs §12-Mechanik steht damit auf dem capped Coverage-Boden; bei 2 Slots werden nur die zwei höchst-gewichteten Gruppen garantiert. |
| G14/G15 | Koalitionsdruck + Populismus-Fenster feuern nicht mehr gleichzeitig; Agenda-Karten kosten je 1 politisches Kapital. | Ralf | US-M2-11, US-M3-15 | Nachgerechnet: ohne Unterdrückung wären 3 Agenda-Slots nötig bei Band 2 → unerfüllbarer Tick. |
| 100 Stories | Ralfs Verifikation referenzierte 99 Stories; der Stand ist 100 Stories (79 Must / 15 Should / 6 Could) inkl. US-M3-15. | — | — | Roheffekt Must+Should ~377 Tage (Summe der Meilensteine), Must allein ~332 Tage, Could ~27 Tage; alle Stories ~404 Tage. |

Alle anderen Gaps (G1–G12) sind gelöst und dokumentiert: G1→ADR-008, G2→ADR-009, G3/G4/G5/G11→§3a, G12→ADR-010, G6–G10→Konzept §12.

## 5. Definition of Done (je Story, aus der Spec)

1. Implementierung in der zugeordneten Schicht; Kern importiert nichts aus `app/`/`cli/`.
2. Unit-Test gegen das Akzeptanzkriterium; Kern-Storys zusätzlich Golden-Test grün.
3. Invariant-Check nach jedem Tick sauber (kein NaN, kein Out-of-Range).
4. Content-Storys: Regeln validieren gegen das Zod-Schema, `diminishing_at` gesetzt.
5. Deutsch-Texte im Content; keine Tabellen im UI.
6. Harness-Score-Spread verschlechtert sich nicht gegen das letzte Fixture.
7. Meilenstein-Gate mit der Gate-Story belegt.

## 6. Nicht in V1 (Won't, unverändert aus Konzept §10)

Multiplayer (nachrüstbar per ADR-007), Krieg/Militär/Map, Echtzeit-Modus, reale Ländernamen, Cloud-Save/Accounts, weitere Sprachen, Online-Pack-Repo.
