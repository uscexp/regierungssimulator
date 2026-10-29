# Spielkonzept — Regierungssimulator (Arbeitstitel: „Staatslenker“)

**Status:** V1-Konzept · Autor: Ralf · Auftraggeber: Haui · Sprache des Spiels: Deutsch

---

## 1. Vision & Spielerlebnis

**Kernfantasie:** „Ich regiere ein Land. Jede Entscheidung hat sichtbare Folgen — ich balanciere Machterhalt gegen Fortschritt.“

**Idee/Problem:** Regierungsführung ist komplex (Budget, Gruppenzufriedenheit, Krisen, Macht). Das Spiel soll den größten Teil dieser Komplexität abbilden — aber **übersichtlich**, nicht als Zahlenfriedhof.

**Spielgefühl:** Wie eine Mischung aus *Democracy 4*, *Tropico* und *SuperPower*, aber schlank und daten-getrieben: Ein Dashboard, Decision-Karten mit Vorhersage, ein News-Feed, der Zahlen erzählt statt zeigt.

**Differentiator:** Die **Konstitution als erster Spielzug** (Grundrechte, Gewaltenteilung, Wahlrecht setzen die Baseline für alles Folgende) und ein **data-driven Regelsatz**, den Spieler/modder flexibel erweitern können.

---

## 2. Grundmodell — drei Registerschichten

Das gesamte Spiel läuft auf nur drei Schichten Variablen. Komplexität entsteht durch Verknüpfung, nicht durch Masse.

### A) Staatsindikatoren (Level 0–100)
| Indikator | wächst durch | sinkt durch |
|---|---|---|
| Infrastruktur | Budget Infrastruktur |/events |
| Bildung | Budget Bildung | Brain Drain |
| Gesundheit | Budget Gesundheit | Pandemien |
| Wirtschaft | Budget Wirtschaftsförderung + Wirtschaftsfreundlichkeit der Gesetze | Finanzkrisen |
| Forschung | Budget Forschung | Bildungsmangel |
| Recht & Freiheit | Konstitution + Gesetze | Freiheitseinschränkende Entscheidungen |
| Sicherheit/Ordnung | Polizei/Justiz-Gesetze | Unruhen, extremistische Parteien |

Indikatoren bewegen sich pro Jahr: `level += budget_wirkung + ereignis_delta − verschleiss`. „Verschleiß“ (Infrastruktur altert, Gesundheit ohne Budget sinkt) erzwingt dauerhaftes Investieren — sonst wird Nichtstun bestraft.

### B) Bevölkerungsgruppen (Zufriedenheit 0–100, Gewicht = Anteil der Bevölkerung)
Sechs bis acht Gruppen, jede mit „Bedürfnissen“ (welche Indikatoren sie zählen):

| Gruppe | Gewichtung Indikatoren | Beispiel-Effekte |
|---|---|---|
| Arbeitnehmer | Wirtschaft, soziale Sicherheit | + bei Sozialausbau, − bei Steuererhöhung |
| Unternehmen | Wirtschaft, Infrastruktur, niedrige Steuern | + Wirtschaftsförderung, − Bildungspflichtkosten |
| Bildung & Jugend | Bildung, Forschung | + Bildungsbudget |
| Gesundheitswesen | Gesundheit | + Gesundheitsbudget |
| Konservative/Traditionelle | Sicherheit, Ordnung, Recht | + Sicherheitsgesetze, − liberale Reformen |
| Liberale/Minderheiten | Freiheit, Recht | + Grundrechte, − Zensur/Polizei |
| Staatsapparat / Beamte | Infrastruktur, Stabilität | + Status quo, − Reformen |
| Landwirte o.ä. | Wirtschaft, Infrastruktur | expansibel |

**Zufriedenheits-Formel (pro Jahr):**
```
zufriedenheit[g] = clamp(
    baseline_konstitution[g]
  + Σ(weight[g][indik] * level[indik])          # Grundzufriedenheit
  - steuerlast[g]                               # Steuermodell der Konstitution
  + gedächtnis(gesetzte entscheidungen, letzte 3)
  + konstitutions-modifikatoren[g]
  + ereignis-modifikatoren[g]
)
```
Das „Entscheidungsgedächtnis“ (letzte 3 Beschlüsse wirken nach) macht kurzfristige Konsequenzen sichtbar und verhindert sofortiges „Optimal-Pflanzen“.

### C) Machtregister
- **Legitimität** (0–100): steigt mit Zufriedenheit + Konstitutionstreue, sinkt mit Skandalen/Zensur.
- **Opposition** = Σ (unzufriedene Gruppen × Gewicht × Radikalisierungsgrad).
- **Extremistische Strömungen:** wenn Opposition > Schwelle und Legitimität niedrig, wächst der Zulauf zu extremistischen Parteien (Mechanik „Radikalisierungskurve“ — nicht „eine Partei“, sondern ein Extremismus-Anteil mit Rechts/Links-Spektrum, der die Agenda des Spiels verschiebt: Populismus-Zwang bei Wahlen).
- **Machtverlust je Regierungsform:** Demokratie = Wahl verloren; Diktatur = Putsch probability = f(Elite-/Militärzufriedenheit, Legitimität).

---

## 3. Setup-Phase: Regierungsform + Konstitution

### Regierungsform (erste Wahl)
| Form | Amtsmodus | Machtverlust | Sondermechanik |
|---|---|---|---|
| Präsidentielle Republik | Präsident, fixed Term | Wahl alle 4–5 Jahre | Wahlvolk; veto-Mechanik? |
| Parlamentarisch (Kanzler) | Kanzler | Misstrauen oder Wahlniederlage | **Mehrheit im Parlament** — Gesetze brauchen Stimmen aus Fraktionen, die sich aus Gruppen-Zufriedenheit zusammensetzen |
| Diktatur | unbegrenzt | Putsch | Verbote/Zensur erlaubt, aber Legitimität sinkt schneller; „Elite“ als eigene Gruppe |

### Konstitution (zweiter Spielzug)
Ein Satz Entscheidungen, jede mit **sofortigem Effekt auf die Baseline-Zufriedenheit** und **dauerhaftem Regelsatz-Modifikator**:

- Grundrechte ja/nein → +Freiheit, +Liberalen, −Konservative, −Krisenantwort-Flexibilität
- Gewaltenteilung → +Legitimität, −Entscheidungsgeschwindigkeit (mehr politische Kosten)
- Wahlrecht / Frauenwahlrecht / Pflichtwahl → +Legitimität, Wahl-Mechanik
- Pressefreiheit → −Skandal-Wahrscheinlichkeit, +Liberalen; Zensur → +Ordnung, +Putschrisiko
- Zentral vs. föderal → +Ordnung bei Krisen, −regionale Gruppen
- Steuermodell (flat/progressiv/hoch/niedrig) → steuerlast je Gruppe
- Staatsreligion / Weltlichkeit → Gruppen-Modifikatoren

Die Konstitution ist damit genau das, was Haui beschreibt: **der erste Einfluss auf die Bevölkerung** — und später nicht änderbar (oder nur per Referendum mit hohem Risiko).

---

## 4. Der Jahreszyklus (Core-Turn)

1. **Lagebericht** — News-Feed: „Die Wirtschaft wächst 3 %, aber die Lehrer sind unzufrieden.“ (Zahlen werden narrativ erzählt → Übersichtlichkeit.)
2. **Budget verteilen** — Einnahmen = Steuermodell × Wirtschaft. Slider pro Kategorie. Deficit bis Schuldenlimit; darüber → Finanzkrise-Event.
3. **Entscheidungen/Gesetze** — 3–5 Karten pro Jahr aus dem Gesetze-Katalog, jede mit Kosten, Voraussetzungen und **Vorhersage der Effekte (± Gruppen, ± Indikatoren)**.
4. **Auflösung** — Indikatoren + Zufriedenheit aktualisieren, Event-Checks.
5. **Machtcheck** — Wahl / Putsch-Rolls (in Demokratie alle N Jahre).

### Zweite Ressource: Politisches Kapital
Jede Entscheidung kostet **politischen Kapital** (Verhandlungsarbeit). Regeneration pro Jahr = f(Legitimität). Das ist der eigentliche Engpass — verhindert „alle guten Karten gleichzeitig spielen“ und macht Machterhalt zum Spielziel statt Nebeneffekt.

---

## 5. Events & Krisen

Events sind **datengetriebene Regeln** mit Ketten:

- **Pandemie:** mehrstufige Krise (Ausbruch → Ausbreitung → Gegenmaßnahmen-Pfad: Budget Gesundheit, Quarantäne-Gesetz vs. Wirtschaftsstopp → Gruppen-Konflikt Gesundheits-/Wirtschaftszufriedenheit).
- **Finanzkrise:** Wirtschaftseinbruch, Einnahmen fallen,choices = Sparen vs. Stimulus.
- **Extremistische Partei:** wächst aus der Radikalisierungskurve; bei Machtübernahme via Wahl → Spielende oder „Koalitionsdruck“ (Agenda des Spielers wird erzwungen).
- **Unternehmensunzufriedenheit:** Unternehmensgruppe → Kapitalflucht → Wirtschaft sinkt.
- **Skandale, Dürren, Nachbarschaftskonflikte** → expansibel.

Jedes Event: `bedingung → wahrscheinlichkeit → chain von sub-Events/decision-cards`. Seedbarer Zufall für Replaybarkeit.

---

## 6. Der Regelsatz (Erweiterbarkeits-Kern) — data-driven

Alle Spielmechanik als deklarative Regeln. Ein Expansion-Pack = neue Dateien, kein Code.

```yaml
# Entscheidung (Gesetz/Beschluss)
id: bildungsoffensive
type: decision
cost: { budget: 10, politisches_kapital: 2 }
effects:
  - indikator: bildung, delta: +4, diminishing_at: 70   # ab 70 nur noch +1
  - gruppe: bildung_jugend, zufriedenheit: +6
  - gruppe: unternehmen, zufriedenheit: -2              # Steuerlast
constraints:
  regierungsform: [praesidential, parlamentarisch]
  erfordert: { indikator: { bildung: "<80" } }
cooldown: 2 jahre
```

```yaml
# Event (Krise)
id: finanzkrise
type: event
kette:
  - bedingung: { wirtschaft: "<40" } OR { schulden: ">60%" }
  - wahrscheinlichkeit: 0.25/jahr
  - effekte:
      - indikator: wirtschaft, delta: -15
      - gruppe: unternehmen, zufriedenheit: -10
  - options: [{ stimulus, sparen }]   # Decision-Cards als Reaktion
```

```yaml
# Konstitutions-Entscheidung
id: pressefreiheit
type: constitution
baseline: { gruppe: liberale: +8, gruppe: konservative: -4 }
dauer_modifikator:
  - event: skandal, wahrscheinlichkeit: -30%
  - gruppe: elite, putsch_risiko: +5%   # wenn später per Referendum abgeschafft
```

**Regel-Typen:** `decision`, `event`, `constitution`, `gruppe`, `indikators`, `wahlregel`, `regierung`. Gruppen und Indikatoren sind per **Tag** referenziert (`gruppe:unternehmen`), damit Packs neue Gruppen an bestehende Regeln andocken können, ohne Balance zu brechen. **Diminishing returns** (`diminishing_at`) sind Teil des Formats und halten das Balancing beherrschbar.

---

## 7. UI / Übersichtlichkeit (das „übersichtlich“-Ziel)

- **Dashboard:** 7 Indikator-Gauges + Gruppen-Heatmap (farbcodiert nach Zufriedenheit), Budget-Slider, Politisches-Kapital-Balken. Ein Bildschirm, keine Tabellen.
- **Decision-Karten mit Vorhersage:** `+4 Bildung · +6 Jugend · −2 Unternehmen · 10 € Budget · 2 PK` — Konsequenz ist vor dem Klick sichtbar.
- **News-Feed als Primärinterface** (erzählt Zahlen); Dashboard dient zur Verifikation.
- **Tooltip „Wer ist sauer und warum?“** auf jeder Gruppe: zeigt die 2 wichtigsten Gründe.
- Optional: Berater-genauigkeit steigt mit Forschungslevel (lustiger Balancing-Knur).

---

## 8. Sieg / Niederlage / Score

- **Niederlage:** Wahl verloren (Demokratie), Putsch (Diktatur), Staatsbankrott, extremistische Partei an der Macht.
- **Score:** Entwicklungsindex (Ø Indikatoren) + Ø Bevölkerungszufriedenheit + Regime-Dauer. Für Diktaturen andere Gewichtung (Stabilität/Fortschritt statt Zufriedenheit) → verschiedene „Spielziele“ pro Form.
- **Endlose Sandbox optional** ab M5.

---

## 9. Meilensteine (mit Akzeptanzkriterien)

| Meilenstein | Objective | Scope | Akzeptanz |
|---|---|---|---|
| **M0 – Core-Loop (Prototyp, Text-UI)** | Jahreszyklus spielbar | 5 Indikatoren, 3 Gruppen, Budget-Slider, Wahl alle 6 Jahre, keine Events | Ein Spiel durchspielbar; Zufriedenheitsformel sichtbar im Log |
| **M1 – Regierungsform + Konstitution** | Setup-Phase | 3 Formen, ~8 Konstitutions-Entscheidungen mit baseline + Dauer-Modifikatoren | Konstitution ändert Wahlmechanik und Event-Wahrscheinlichkeiten |
| **M2 – Krisen & Extremismus** | Externalität | Pandemie (3 Stufen), Finanzkrise, Radikalisierungskurve + Wahl-Effekt | Krisen ändern Gruppenzufriedenheit und können Machtverlust verursachen |
| **M3 – Gesetze-Katalog** | Entscheidungstiefe | ~30 Decision-Cards, alle mit Vorhersage, Cooldowns, PK-Kosten | Keine dominante „beste Strategie“ (durch PK + diminishing returns) |
| **M4 – Regelsatz-Engine + Mod-Format** | Erweiterbarkeit | YAML-Format, Loader, Tag-Referenzen, ein Beispiel-Pack | Neues Group+Decision-Pack ohne Code-Änderung ladbar |
| **M5 – UI-Polish** | Übersicht | Dashboard, Heatmap, News-Feed, Tooltips | Neue Spieler verstehen ohne Tutorial ≥5 Turns erfolgreich |
| **M6 – Score, Schwierigkeit, Sound** | Finish | Scoring, 3 Schwierigkeiten, Audio | Replaybar mit seedbarer RNG |

**Priorisierung:** M0 zuerst → Balance-Fundament vor Content. Events vor Katalog (Events erzeugen die Nachfrage nach Entscheidungen). Mod-Format (M4) erst nach stabilem Kernmodell, sonst Format-Churn.

---

## 10. Non-Goals (bewusst außen vor)

- Keine Militär-/Kriegsimulation, keine Map/Territorium (Krieg als Event andockbar später)
- Kein Multiplayer (zunächst)
- Keine echte Volkswirtschafts-Simulation (Makro-Abstraktion reicht — Indikatoren, nicht Gleichungen)
- Kein Echtzeit-Modus (Jahre-Turn bleibt diskret)
- Keine realen Länder-Namen (generische Nationen, expansibel als Packs)

---

## 11. Risiken & Gegenmittel

| Risiko | Gegenmittel |
|---|---|
| Zufriedenheitsformel zu komplex zum Balancen | nur Gewicht-Matrizen + additive Modifier; Balance-Test mit Auto-Simulator (M0) |
| Eine „optimale Strategy“ dominiert | Politisches Kapital, diminishing returns, Ereignis-RNG |
| Extremismus-Mechanik → „nur appeasen“ | extremistische Agenda erzwingt Trade-offs (z. B. liberale Gruppen sinken) |
| Übersicht geht verloren | Vorhersagen auf Karten + News-Feed als Primärinterface |
| Konstitution später änderbar → Setup verliert Gewicht | nur Referendum mit hoher Risiko-Kosten |
| Mod-Packs brechen Balance | Tag-Referenzen + diminishing_at Pflichtfelder im Format |

---

## 12. Wert-Definitionen für G6–G10 (übergeben an Reto — blockieren M0/M2/M6 nicht mehr)

### Budget-Basis (für G9)
Einnahmen [BE] = Wirtschaft-Level × Steuerfaktor (niedrig 0.6 · flat 0.8 · progressiv 1.0 · hoch 1.2). Startwerte (normal): Wirtschaft 45, übrige Indikatoren 40, Steuermodell **flat** → Einnahmen ≈ 36 BE. Das Steuermodell wird ab M1 über die Konstitution gewählt; der M0-Balance-Anker bleibt flat. Zinsen werden zuerst vom Budget abgezogen.

### G9 — Verschleiß, budget_wirkung, Gewichte

| Indikator | Verschleiß/Jahr (normal) | budget_wirkung pro BE | diminishing_at | Notiz |
|---|---|---|---|---|
| Infrastruktur | 3 | +0.5 | 70 | darüber nur +0.2 |
| Bildung | 2 | +0.6 | 65 | darüber nur +0.25 |
| Gesundheit | 2 | +0.7 | 75 | darüber nur +0.2 |
| Wirtschaft | 2 | +0.4 | 80 | darüber nur +0.15 |
| Forschung | 2 | +0.5 | 85 | Bildung-Gate: bei Bildung < 50 stagniert Forschung (kein Wachstum, kein Verschleiß); bei ≥ 50 wirkt +0.5/BE und −2/Jahr |
| Recht & Freiheit | 1 | — (nur Gesetze) | — | |
| Sicherheit | 2 | — (nur Gesetze) | — | |

Unterhalt = Verschleiß ÷ budget_wirkung: Infrastruktur 6.0 · Bildung 3.33 · Gesundheit 2.86 · Wirtschaft 5.0 → **17.2 BE/Jahr** ohne Forschung; wenn Bildung ≥ 50 kommen 4.0 BE dazu → max **21.2 BE**. Bei Starteinnahmen 36 BE (flat) bleibt ~15 BE Spielraum — Sparen bedrohlich, Verschwenden nicht trivial. AutoSim-Anker: „gleichmäßig investieren“ hält Indikatoren bis Jahr ~20 stabil; „nur Wirtschaft“ verliert Wahl ≤ Jahr 12.

| Gruppe | Bevölkerungsanteil | Gewichte auf Indikatoren (Σ = 1) | Steuerlast-Faktor |
|---|---|---|---|
| Arbeitnehmer | 24 % | Wirtschaft 0.45, Gesundheit 0.25, Recht 0.15, Sicherheit 0.15 | niedrig 2 · flat 4 · progressiv 3 · hoch 8 |
| Unternehmen | 10 % | Wirtschaft 0.55, Infrastruktur 0.30, Sicherheit 0.15 | 0 · 4 · 8 · 12 |
| Bildung & Jugend | 13 % | Bildung 0.60, Forschung 0.25, Freiheit 0.15 | 2 · 4 · 3 · 8 |
| Gesundheitswesen | 12 % | Gesundheit 0.70, Forschung 0.15, Infrastruktur 0.15 | 2 · 4 · 3 · 8 |
| Konservative/Traditionelle | 16 % | Sicherheit 0.55, Recht 0.25, Wirtschaft 0.20 | 2 · 4 · 2 · 7 |
| Liberale/Minderheiten | 9 % | Freiheit 0.60, Recht 0.25, Bildung 0.15 | 2 · 4 · 2 · 7 |
| Staatsapparat/Beamte | 8 % | Infrastruktur 0.50, Sicherheit 0.30, Bildung 0.20 | 3 · 4 · 3 · 8 |
| Landwirte | 8 % | Wirtschaft 0.60, Infrastruktur 0.40 | 2 · 4 · 2 · 7 |

Summe Anteile = 100 %. Zufriedenheits-Baseline (Konstitution ohne Modifikatoren) = **10**, sodass bei Startlevel 40 die Zufriedenheit ≈ 50 liegt; Konstitutions-Entscheidungen modulieren ±8.

**Politisches Kapital:** Max 12, Regeneration/Jahr = Legitimität/10 × Schwierigkeitsfaktor (1.2 / 1.0 / 0.8), Minimum 1. Kartenkosten im Katalog: 1–3 PK.

### G7 — Schuldenkurve & Staatsbankrott
- Schulden in BE; **Limit** = 120 (leicht) / 100 (normal) / 80 (schwer).
- **Zins/Jahr = Schulden × Zinsfaktor**: 0.05 / 0.08 / 0.12.
- Schulden ≥ Limit: keine neuen Defizit-Ausgaben mehr + erzwungenes Spar-Event (alle Gruppen −5).
- **Staatsbankrott (Niederlage):** Schulden ≥ Limit zwei aufeinanderfolgende Jahre UND Wirtschaft < 25.

### G8 — Extremismus, Niederlage & Koalitionsdruck
Extremismus-Anteil E (0–100), Start 10.
- Wächst/Jahr, wenn Opposition > 40 UND Legitimität < 40: `E += (Opposition−40)×0.3 + (40−Legitimität)×0.2`; sonst `E −= 3`.
- Stimmanteil extremistischer Parteien bei Wahl = **E × 0.6**.
- **Niederlage Machtergreifung:** bei einer Wahl, wenn **E ≥ 70** UND Extremismus-Stimmanteil ≥ Stimmanteil der Regierungspartei → sofortiges Spielende.
- **Koalitionsdruck:** Wahl gewonnen bei **58 ≤ E < 70** (entspricht Stimmanteil 35–42 %) → Spieler bleibt im Amt; die **nächsten 3 Jahre** müssen pro Jahr 2 Slots aus der extremistischen Agenda-Liste gewählt werden (bei 2 Slots: alle Slots; bei 4–5 Slots: mindestens 2). Die Agenda-Liste umfasst 5 feste Karten: Notstandsdekret, Einwanderungsstopp, Presse-Einschränkung, Subventionsstopp, Sicherheitspaket; Effekte pro Karte: Konservative +6, Arbeitnehmer +4, Liberale −10, Freiheit −4, Legitimität −3; Agenda-Karten kosten je 1 politisches Kapital. Bei Band 2 sind beide Slots erzwungen (0 gesamplete Karten) — spielbar, im News-Feed als schwache Jahre narrirt. Druck fällt früh weg, wenn Opposition < 30 UND E < 25; sonst verlängert er um weitere 3 Jahre. Beide Ausgänge sind ausschließlich in E definiert — keine Überlappung über Stimmanteile.

### G10 — Populismus-Zwang bei Wahlen (Agenda-Mechanik)
E ≥ 40 UND ≥ 2 Jahre vor einer Wahl → **Populismus-Fenster**: pro Jahr muss mindestens 1 Slot (aus dem Slot-Band 2–5, siehe Kartenauswahl) aus der Agenda-Liste der doministischen Extremismus-Richtung gewählt werden (rechts: Karten wie G8; links: Umverteilung, Marktregulierung). Effekte einer erzwungenen Populismus-Karte: Budget 0 BE, **PK 1** (Agenda-Karten kosten generell 1 politisches Kapital, damit Zwangslots auch bei PK ≤ 2 erfüllbar bleiben), Zielgruppen +6 kurzfristig, +5 % Stimmenanteil bis zur Wahl, aber **permanent −5** auf Liberale (rechts) bzw. **permanent −5** auf Unternehmen (links) und Freiheit −2, Legitimität −3 → E wächst wieder. Appeasement ist damit nicht kostenlos — es ist ein Loop mit Trade-off. **Unterdrückung (G14):** Während des Koalitionsdrucks ist das Populismus-Fenster außer Kraft gesetzt — die extremistische Agenda (gleiche Richtung) wird bereits über G8 bedient; sonst entstünde bei Band 2 ein unerfüllbarer Tick und bei Band 3 ein totes Jahr.

### Kartenauswahl je Jahr (G12/G13) — entschieden via ADR-010 amendiert (Pädu, architektur.md)
Autorität ist ADR-010 in der amendierten Fassung; Konzept und ADR haben dieselbe Regel: Slots pro Jahr = **Band 2–5** (Standard 3, 4 bei Legitimität ≥ 70, 2 bei politischem Kapital ≤ 2). Erzwungene Agenda-Slots aus G8/G10 werden **vor** dem Sampling besetzt und zählen in die Slot-Zahl. **Capped Coverage-Boden:** Der alte volle Coverage-Boden („eine Karte je unzufriedene Gruppe“) gilt nicht mehr — bei weniger Slots als unzufriedenen Gruppen werden die höchst-gewichteten Karten priorisiert; Agenda-Slots gelten als Coverage für die Gruppen, die sie adressieren. Ein 2-Slot-Jahr wird im News-Feed als „die Regierung ist schwach“ narriert; der Tick darf kein unplaybares Jahr erzeugen.

### Wahlregel D12/D18 (Gate — identischer Text in Spec, AC und balance-werte.md)
Wahl gewonnen nur bei gewichteter Ø-Zufriedenheit ≥ 47 UND Zufriedenheit der schwächsten Gruppe ≥ 35 (D18, vorher 50); sonst Niederlage mit Ursache „Wahl verloren“, im State als `wahl:gewichtete_unter_47` bzw. `wahl:schwächste_unter_35`. Wahlzyklus 6 Jahre — Jahr 4 ist kein Wahljahr. Ab M1/M3 gilt das §12-Originalmodell mit 8 Gruppen, der Gate bleibt derselbe. Zwei Konsequenzen, beide am echten Harness gemessen: (1) der im AutoSim gemessene M0-Start (Wirtschaft 45, übrige Level 40) liegt bei gewichteter Ø 47.22 und verliert ohne Wachstums-Investitionen das Wahljahr 6 — bewusste Druckwirkung, nicht ein Bug; die Ø fällt ohne Investitionen ~1.2 Punkte/Jahr, weil die Einnahmen an der Zufriedenheit hängen; (2) der Gate wird durch die schwächste Gruppe entschieden, nicht durch die Ø: bei Monokultur auf Wirtschaft bleibt die Ø hoch, die schwächste Gruppe fällt unter 35 und verliert zuerst. Gate-Werte allein bringen das Spiel nicht auf die Ziel-Session: gemessenes erstes Wahljahr (leicht/normal/schwer) ist 50/4 → 4/4/4, 47/6 → 6/6/6, 44/8 → 8/8/8, 42/8 → 16/8/8, 40/10 → 20/10/10. Das Ziel „überlebt 12–25 Jahre“ gilt deshalb ab M1/M2, nicht für M0 (D18).

### G6 — Schwierigkeit = Parameter-Pack (bestätigt, keine neue Mechanik)
Verschleiß-Multiplikator 0.7 / 1.0 / 1.3 · PK-Regeneration-Faktor 1.2 / 1.0 / 0.8 · Event-Wahrscheinlichkeits-Multiplikator 0.6 / 1.0 / 1.4 · Schuldenlimit 120 / 100 / 80 BE · Zinsfaktor 0.05 / 0.08 / 0.12 · Startbudget-Zuschuss/Jahr +10 / 0 / −10 BE.

### Session-Rahmen (Reto-Annahme bestätigt, leicht korrigiert)
Ziel-Session **12–25 Jahre-Schritte**, Hard-Cap **50 Jahre** (danach Score-Ende; Sandbox optional). Score bei Jahr ≤ 50 = Ø Indikatoren + gewichtete Ø Zufriedenheit + Regime-Dauer × 0.5. Der M0-Core-Loop endet gemessen Jahr 6 (Wahlregel 47/6, D18) — das Ziel gilt ab M1/M2, wenn Events, Gesetze und die Deficit-Spirale (Unterhalt als Budget-Ausgabe) hinzukommen.
