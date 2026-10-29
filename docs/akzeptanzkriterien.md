# Akzeptanzkriterien — „Staatslenker“ (V1)

**Ergänzung zu:** `spezifikation.md` · jede Story aus dem Backlog hat genau einen Given/When/Then-Block.
**Testbar ohne Browser:** alle Kern- und CLI-Kriterien laufen in vitest bzw. dem AutoSim-Harness (NFR-003, ADR-002).
**Gemeinsame Voraussetzung für alle Stories:** Nach jedem Tick ist der Invariant-Check sauber (FR-002) und der Seed wird nicht nebenläufig verbraucht (FR-004, G2).

---

## M0 — Core-Loop & Balance-Fundament

| ID | Given | When | Then |
|---|---|---|---|
| US-M0-01 | ein Monorepo mit `core/`, `cli/`, npm workspaces | `npm run build` und `npm test` werden ausgeführt | beide Pakete bauen headless; `core/package.json` enthält keine Abhängigkeit zu `app/` oder `cli/` (Check-Skript schlägt fehl, wenn doch) |
| US-M0-02 | ein frisch erzeugter GameState | alle Pflichtfelder werden abgefragt | 5 Indikatoren, 3 Gruppen mit Gewicht + Bevölkerungsanteil, Budget, politisches Kapital, Legitimität, Schulden, Jahr, rng-state und Konstitution sind vorhanden; der exportierte Snapshot-Typ ist readonly |
| US-M0-03 | Seed 1234 | `tick` wird 100 mal ausgeführt | die Zahlenfolge ist identisch mit dem Golden-Fixture; der rng-state liegt im Snapshot und ist serialisierbar |
| US-M0-04 | eine Regel mit delta +200 auf Indikator 90 | `tick` wird ausgeführt | der Indikator endet bei 100; der Invariant-Check meldet keine Verletzung; ein absichtlich erzeugter NaN bricht im dev-Modus mit Regel-ID im Log |
| US-M0-05 | Budget 0 für Infrastruktur und Forschung, Bildung 40, Schwierigkeit normal | ein Tick läuft | Infrastruktur sinkt um 3/Jahr, Bildung und Gesundheit um 2/Jahr; Forschung stagniert bei Bildung < 50 ohne Wachstum und ohne Verschleiß; mit Budget steigt der Wert um `budget_wirkung × BE + ereignis_delta` (Werte: `balance-werte.md` §2) |
| US-M0-06 | eine Gruppe mit Gewicht-Matrix, ohne Beschlüsse | die Zufriedenheitsfunktion wird gerechnet | das Ergebnis ist exakt Grundzufriedenheit − Steuerlast; bei Startlevel 40 und Gewicht Σ=1 liegt die Gruppe bei 50, mit Steuerlast flat bei 46; die gewichtete Ø-Zufriedenheit der Bevölkerung beträgt 46.0 bei Anteile Σ=100 %; ein Test gegen die Formel-Fixture verbietet zusätzliche Terme |
| US-M0-07 | Steuermodell „hoch“ | Zufriedenheit von `unternehmen` und `arbeitnehmer` wird gerechnet | `steuerlast[unternehmen] > steuerlast[arbeitnehmer]` und die Zufriedenheit ist entsprechend niedriger |
| US-M0-08 | 4 Beschlüsse in vier aufeinanderfolgenden Jahren | Jahr 4 wird gerechnet | nur die Beschlüsse 2–4 wirken; Beschluss 1 ist aus dem Entscheidungsgedächtnis entfernt |
| US-M0-09 | politisches Kapital 3, Legitimität 50 | eine Karte mit PK-Kosten 2 wird gespielt | PK sinkt auf 1; die Regeneration am Jahresende ist Legitimität/10 × Schwierigkeitsfaktor, bei Legitimität 50 also 5.0 (normal); das PK-Maximum ist 12 und eine Karte kostet 1–3 PK; bei PK < Kosten ist die Karte nicht wählbar |
| US-M0-10 | Wirtschaft 50, Steuermodell progressiv | Budget wird verteilt | Einnahmen = Steuermodell × Wirtschaft (Anker normal = flat → 36 BE); die Zinsen werden zuerst vom Budget abgezogen; Defizit bis Schuldenlimit ist erlaubt; darüber werden keine neuen Defizit-Ausgaben zugelassen und das Spar-Event (alle Gruppen −5) ausgelöst |
| US-M0-11 | ein State-Snapshot | `tick(state, action, regeln, modus?)` wird aufgerufen | der alte Snapshot ist danach deep-equal unverändert; der Rückgabewert enthält neuen State, Events und News-Einträge; RNG liegt im GameState (ADR-006) |
| US-M0-12 | Jahr 6 (Wahlzyklus 6; Jahr 4 ist kein Wahljahr) | der Machtcheck läuft | eine Wahl wird gewürfelt; gewonnen ist sie nur, wenn die gewichtete Ø-Zufriedenheit ≥ 47 UND die Zufriedenheit der schwächsten Gruppe ≥ 35; endet das Spiel mit Ursache „Wahl verloren“, wenn eine der beiden Bedingungen fehlt — die Ursache liegt im State als `wahl:gewichtete_unter_47` bzw. `wahl:schwächste_unter_35` und nicht als stummer Gewinn; der Machtcheck verwendet den Zufriedenheitsstand nach den Events des Jahres, vor der Budgetwirkung — Fixture A: alle Gruppen ≥ 35 und Ø ≥ 47 ⇒ Gewinn; Fixture B: Ø ≥ 47 aber schwächste Gruppe 34.7 ⇒ Verlust; ein Nicht-Wahljahr liefert keine Wahl (der Adapter gibt `undefined` zurück, nicht „gewonnen“) |
| US-M0-13 | der M0-Basis-Content (5 Indikatoren, 3 Gruppen, 5 Entscheidungen) | das Zod-Schema wird angewendet | alle Regeln validieren fehlerfrei und der Jahreszyklus ist damit vollständig spielbar |
| US-M0-14 | eine CLI-Session | Setup wird übersprungen, Budget gesetzt, Karten gewählt bis zum Spielende | das Spiel ist komplett durchspielbar und die Phasen erscheinen in der Reihenfolge Lagebericht → Budget → Karten → Auflösung → Machtcheck |
| US-M0-15 | ein Tick mit Indikator- und Gruppenänderungen | der Lagebericht wird gedruckt | die Änderungen stehen als Sätze („Die Wirtschaft wächst 3 %, die Lehrer sind unzufrieden“) und es wird keine Tabelle ausgegeben |
| US-M0-16 | Seed 424242 als Fixture | 100 Jahre mit fester Action-Folge laufen | der State-Hash ist identisch mit dem hinterlegten Golden-Hash (inklusive `zufriedenheits_trace` und der News-Einträge) und der Test läuft im CI |
| US-M0-17 | 4 Naiv-Strategien | der Harness 20 Seeds × 30 Jahre durchführt | ein Score-Spread-Report entsteht (Median, Spread, beste Strategie); gemessen bei Wahlregel 47/6 endet jede der 12 Kombinationen (4 Strategien × 3 Schwierigkeiten) Jahr 6 mit `wahl:gewichtete_unter_47`, ohne Defizit und ohne Spar-Event — Unterhalt ist Level-Decay und keine Budget-Ausgabe (D18); die beste Strategie erreicht ≤ 30 % des besten Median |
| US-M0-18 | der Harness-Lauf | der Report geschrieben wird | der Report liegt als Fixture im Repo; jeder folgende Content-Change wird im CI dagegen verglichen |

## M1 — Regierungsform + Konstitution

| ID | Given | When | Then |
|---|---|---|---|
| US-M1-01 | Regeln mit `type: constitution`, `regierung`, `wahlregel` | sie werden gegen das Zod-Schema validiert | gültige Instanzen werden akzeptiert; fehlende Pflichtfelder werden mit Feldnamen abgelehnt |
| US-M1-02 | Spielstart ohne Regierungsform | die Action „Regierungsform wählen“ wird gesendet | die Form ist im State gesetzt und Turn 1 ist erst nach der Konstitution möglich |
| US-M1-03 | jede der drei Regierungsformen | je ein Spiel über 10 Jahre läuft | Amtsmodus, Wahlzyklus und Machtverlust-Mechanik sind je Form unterschiedlich und im Content dokumentiert |
| US-M1-04 | die 8 Konstitutions-Entscheidungen | sie im Setup angezeigt werden | jede Karte zeigt Sofort-Effekte (baseline) und den Dauer-Modifikator |
| US-M1-05 | Grundrechte = ja | das Setup abgeschlossen wird | baseline-Zufriedenheit der liberalen Gruppen ist höher, der konservativen niedriger als ohne Grundrechte |
| US-M1-06 | Pressefreiheit = ja | 30 Jahre mit festem Seed gespielt werden | die Skandal-Wahrscheinlichkeit ist gegenüber der Variante ohne Pressefreiheit reduziert (Harness-Messung im Report) |
| US-M1-07 | parlamentarische Form, Gesetz ohne Mehrheit | die Kartenwahl wird gesendet | die Action wird abgewiesen und der News-Feed nennt „keine Mehrheit in den Fraktionen“; die Fraktionen werden als pure View aus dem Snapshot berechnet und nicht im State gespeichert |
| US-M1-08 | niedrige Legitimität und niedrige Fraktionszustimmung | der Machtcheck läuft | ein Misstrauens-Votum kann ausgelöst werden und das Spiel endet mit Ursache „Misstrauen verloren“ |
| US-M1-09 | Elite-Zufriedenheit 20, Legitimität 25 | der jährliche Putsch-Roll läuft | die Putsch-Wahrscheinlichkeit ist deutlich höher als bei Elite 80 / Legitimität 80; ein Putsch beendet das Spiel mit Ursache „Putsch“ |
| US-M1-10 | steigende Gruppenzufriedenheit | der Tick läuft | die Legitimität steigt; nach einem Skandal und nach Zensur sinkt sie messbar |
| US-M1-11 | eine `wahlregel` mit Term 5 | Jahr 5 erreicht wird | die Wahl wird ausgewürfelt und das Ergebnis folgt aus der Bevölkerungszufriedenheit; die präsidentielle Form nutzt den fixed Term |
| US-M1-12 | eine bereits gesetzte Konstitution | die Action „Konstitution ändern“ wird gesendet | ohne Referendum wird sie abgewiesen; ein Referendum kostet politisches Kapital und erhöht das Putsch-Risiko |
| US-M1-13 | CLI-Start | die Setup-Phase bedient wird | zuerst wird die Regierungsform, dann die Konstitution abgefragt; erst danach ist Turn 1 spielbar |
| US-M1-14 | zwei Konstitutionen (liberal vs. Zensur) mit identischem Seed | 30 Jahre gespielt werden | Wahlmechanik und Event-Wahrscheinlichkeiten unterscheiden sich im Report und beide Pfade sind im Golden-Test hinterlegt |

## M2 — Krisen & Extremismus

| ID | Given | When | Then |
|---|---|---|---|
| US-M2-01 | Prädikate `{wirtschaft:"<40"}`, `{gruppe:unternehmen:"<30"}`, `{schulden:">60%"}` und eine OR-Liste | `eval` wird ausgeführt | alle Prädikate werden korrekt ausgewertet; eine String-Expression wie `wirtschaft*2>80` wird vom Schema abgelehnt |
| US-M2-02 | identischer Seed und identische Lage | der Tick läuft | es werden dieselben Events gewählt; ein Event ohne erfüllte Bedingung wird nie gewählt |
| US-M2-03 | eine Event-Kette mit Tiefe über dem Schema-Limit | das Pack validiert wird | es wird abgewiesen; jede aktive Kette endet spätestens mit der Timeout-Option „Effekt verfällt“ |
| US-M2-04 | Pandemie Stufe „Ausbruch“ | drei Jahre gespielt werden | die Kette läuft Ausbruch → Ausbreitung → Gegenmaßnahmen; Quarantäne senkt die Wirtschafts- und erhöht die Gesundheitszufriedenheit (und umgekehrt) |
| US-M2-05 | Wirtschaft 35 oder Schulden 65 % | der Jahrescheck läuft | die Finanzkrise kann ausgelöst werden; die Options „Sparen“ und „Stimulus“ sind als Karten verfügbar und wirken unterschiedlich auf Wirtschaft und Schulden |
| US-M2-06 | Unternehmen-Zufriedenheit unter der Schwelle | der Tick läuft | Kapitalflucht wird ausgelöst und Wirtschaft sinkt um den definierten Delta |
| US-M2-07 | Zensur statt Pressefreiheit | 30 Jahre gespielt werden | die Skandal-Wahrscheinlichkeit ist höher als mit Pressefreiheit und die Legitimität sinkt stärker |
| US-M2-08 | drei unzufriedene Gruppen mit Gewichten | die Opposition gerechnet wird | der Wert entspricht der Formel aus Konzept §2C (Test gegen Handberechnung) |
| US-M2-09 | Opposition über der Schwelle, Legitimität unter der Schwelle | drei Jahre laufen | der Extremismus-Anteil E wächst nach `E += (Opposition−40)×0.3 + (40−Legitimität)×0.2`; bei Opposition 60 und Legitimität 20 erreicht E von Start 10 in Jahr 5 den Wert 60 (Koalitionsdruck-Band 58 ≤ E < 70, Stimmanteil 36 %) und in Jahr 6 den Wert 70 (Stimmanteil 42 %); ohne Bedingung sinkt E um 3/Jahr |
| US-M2-10 | Extremismus-Anteil über der Agenda-Schwelle | die nächste Wahl stattfindet | ein Populismus-Fenster öffnet bei E ≥ 40 und mindestens 2 Jahren vor der Wahl; pro Jahr muss 1 Slot aus dem Slot-Band 2–5 aus der Agenda der dominierenden Richtung gespielt werden; die erzwungene Agenda-Karte kostet 0 BE und 1 PK, senkt permanent 5 Liberale (rechts) bzw. 5 Unternehmen (links), Freiheit −2 und Legitimität −3 |
| US-M2-11 | Extremismus über der Machtschwelle | die Wahl läuft | bei einer Wahl endet das Spiel mit Ursache „extremistische Partei an der Macht“, wenn E ≥ 70 UND der Stimmanteil (E × 0.6) ≥ der Regierungspartei; bei Wahl gewonnen mit 58 ≤ E < 70 bleibt das Amt und die nächsten 3 Jahre müssen pro Jahr 2 Slots aus der festen Agenda gespielt werden (bei Band 2 alle Slots, bei Band 4–5 mindestens 2); der Druck endet früh bei Opposition < 30 UND E < 25, sonst +3 Jahre und während des Koalitionsdrucks feuert das Populismus-Fenster nicht (kein zusätzlicher Agenda-Slot) |
| US-M2-12 | Schulden ≥ Limit (normal 100 BE) in zwei aufeinanderfolgenden Jahren UND Wirtschaft < 25 | der Tick läuft | das Spiel endet mit Ursache „Staatsbankrott“; im ersten Limit-Jahr wird nur das Spar-Event (alle Gruppen −5) ausgelöst und keine neuen Defizit-Ausgaben erlaubt |
| US-M2-13 | eine ausgelöste Krise | der Turn endet | der News-Feed enthält mindestens einen Satz zur Krise mit betroffenen Gruppen und Indikatoren |
| US-M2-14 | 20 Seeds × 30 Jahre im Harness | der Krisen-Report läuft | in ≥ 80 % der Runs tritt mindestens eine Krise auf und keine Kette bleibt am Run-Ende offen |
| US-M2-15 | ein Seed, der eine Pandemie auslöst | 30 Jahre gespielt werden | der State-Hash ist reproduzierbar und im Golden-Fixture hinterlegt |

## M3 — Gesetze-Katalog

| ID | Given | When | Then |
|---|---|---|---|
| US-M3-01 | eine Entscheidung mit allen Pflichtfeldern | sie gegen Zod validiert wird | `cost`, `effects`, `constraints`, `cooldown`, `diminishing_at` werden akzeptiert; fehlende Kosten oder fehlendes `diminishing_at` werden abgelehnt |
| US-M3-02 | ein State und eine Karte | die Vorhersage per Dry-Run mit RNG-Fork erzeugt wird | alle Effekte werden angezeigt, der echte rng-state bleibt unverbraucht, die Kopie wird vollständig verworfen und Event-Effekte erscheinen als Wahrscheinlichkeiten statt als Würfelwert |
| US-M3-03 | eine Karte, deren Constraint (Regierungsform oder `erfordert: indikator`) verletzt ist | die Kartenliste angezeigt wird | die Karte ist nicht wählbar und der Verletzungsgrund wird angezeigt |
| US-M3-04 | eine Karte mit cooldown 2 Jahre | sie in Jahr 1 gespielt wird | in Jahr 2 und 3 ist sie nicht wählbar und in Jahr 4 wieder verfügbar |
| US-M3-05 | Bildung 70, `diminishing_at: 70`, delta +4 | die Karte gespielt wird | Bildung steigt nur um den reduzierten Delta (+1) statt um +4 |
| US-M3-06 | ein Katalog mit ≥ 30 Karten und sechs unzufriedenen Gruppen | ein Turn beginnt | es werden 3 Slots angeboten (4 bei Legitimität ≥ 70, **2 bei politischem Kapital ≤ 2**), erzwungene Agenda-Slots sind vor dem Sampling besetzt, die Auswahl ist bei gleichem Seed identisch und der Coverage-Boden ist slot-begrenzt: bei 2 Slots werden die zwei höchst-gewichteten unzufriedenen Gruppen adressiert (Agenda-Slots zählen als Coverage für die Gruppen, die sie treffen), nicht alle sechs |
| US-M3-07 | das Themen-Pack Bildung/Forschung | es validiert und gespielt wird | ~6 Karten mit Kosten/Voraussetzungen/Vorhersage; die Karten heben Bildung/Forschung und senken die Unternehmenzufriedenheit |
| US-M3-08 | das Themen-Pack Wirtschaft/Budget | es validiert und gespielt wird | ~6 Karten; Wirtschaftsförderung hebt Wirtschaft, Steuererhöhung senkt Arbeitnehmer und Unternehmen |
| US-M3-09 | das Themen-Pack Soziales/Gesundheit | es validiert und gespielt wird | ~6 Karten; Sozialausbau hebt Arbeitnehmer, Gesundheitsbudget hebt die Gesundheitsgruppe |
| US-M3-10 | das Themen-Pack Sicherheit/Justiz | es validiert und gespielt wird | ~6 Karten; Sicherheitsgesetze heben Ordnung/Konservative und senken die liberale Gruppe |
| US-M3-11 | das Themen-Pack Reformen/verfassungsnahe | es validiert und gespielt wird | ~6 Karten; Reformen heben Legitimität/Recht und senken den Staatsapparat |
| US-M3-12 | ein Jahr mit politischem Kapital 6 (Regeneration bei Legitimität 50) | die 6 besten Karten des Katalogs versucht werden | maximal 3 sind spielbar (Kosten 1–3 PK), die übrigen werden wegen PK abgewiesen |
| US-M3-13 | ≥ 5 Strategien im Harness | 20 Seeds × 30 Jahre laufen | der Score-Spread ist dokumentiert und keine Strategie erreicht > 30 % des besten Median |
| US-M3-14 | eine Karte und ein State | Vorhersage berechnet und danach der echte Tick ausgeführt | die Indikator- und Gruppen-Deltas stimmen exakt überein (Dry-Run == echter Tick) und der echte RNG-Stream ist durch die Vorhersage nicht verschoben |
| US-M3-15 | ein Turn mit aktivem Koalitionsdruck und PK 2 | der Tick läuft | die Agenda-Slots werden vor dem Sampling besetzt, es stehen genau 2 Slots zur Verfügung (PK ≤ 2), die Agenda-Slots zählen in die Slot-Zahl, bei Legitimität ≥ 70 stehen 4 Slots zur Verfügung, das 2-Slot-Jahr erscheint im News-Feed als „die Regierung ist schwach“ (G11-Templates) und der AutoSim-Harness erzeugt in diesem Jahr kein unplaybares Jahr (mindestens eine spielbare Karte nach Coverage-Boden) und ein Agenda-Karten-Jahr mit PK ≤ 2 ist spielbar: beide Slots sind erzwungen, 0 Karten werden gesamplet, die Agenda-Karten kosten je 1 politisches Kapital |

## M4 — Regelsatz-Engine & Mod-Format

| ID | Given | When | Then |
|---|---|---|---|
| US-M4-01 | ein Pack ohne `schema_version` | es geladen wird | es wird mit der Meldung „schema_version fehlt“ abgewiesen; ein Pack mit unterstützter Version wird geladen |
| US-M4-02 | ein Pack mit einer ungültigen Regel | es geladen wird | das gesamte Pack wird abgewiesen und keine Regel dieses Packs ist im Spiel aktiv |
| US-M4-03 | ein ungültiges Pack | es geladen wird | Datei und Zeile werden gemeldet, das Base-Pack bleibt unverändert und das Spiel läuft weiter |
| US-M4-04 | ein Pack mit neuer Gruppe `landwirte`, einem neuen Indikator-Tag und einer Regel mit Tag `gruppe:landwirte` | es geladen wird | die Regel dockt an die bestehende tag-getriebene Mechanik an, der neue Indikator erscheint im Snapshot und im Dashboard, ohne dass bestehende Regeln oder Kern-Code verändert werden |
| US-M4-05 | eine Regel ohne `diminishing_at` | sie validiert wird | sie wird mit Hinweis auf das Pflichtfeld abgelehnt |
| US-M4-06 | ein Pack, das eine Base-Regel mit gleicher ID überschreibt | es geladen wird | die Merge-Policy gilt (Override ersetzt vollständig, Shadow ergänzt nur Tags) und der Konflikt erscheint im Load-Report |
| US-M4-07 | das Beispiel-Pack | es geladen und gespielt wird | die neue Gruppe ist sichtbar und die neue Entscheidung spielbar, ohne dass Kern-Code geändert wurde (Diff auf `core/` ist leer) |
| US-M4-08 | zwei Packs | `pack list`, `enable`, `disable` im CLI ausgeführt werden | nur das aktive Pack ist wirksam und die Liste zeigt Version und Regel-Count |
| US-M4-09 | Base-Pack + Beispiel-Pack | der Balance-Harness läuft | der Score-Spread je Packkombination wird reportet; ein Pack, das den Spread über die Toleranz verschiebt, wird als Balance-Warnung gemeldet |
| US-M4-10 | die Pack-Dokumentation | ein Modder ein Beispiel kopiert | das Beispiel validiert und die dokumentierten Fehlerfälle erzeugen genau die gemeldeten Fehlermeldungen |
| US-M4-11 | die Web-UI | eine YAML-Datei per Drag & Drop importiert wird | Regel-Count oder die Fehlerliste wird angezeigt, ohne dass das Spiel neu gestartet werden muss |

## M5 — UI-Polish

| ID | Given | When | Then |
|---|---|---|---|
| US-M5-01 | die App mit einem Snapshot | der Snapshot übernommen wird | der State ist readonly und jede Änderung läuft über die Action-API; ein Test belegt, dass die App den Kern nicht mutiert |
| US-M5-02 | Spielstart | die Setup-UI bedient wird | Regierungsform und Konstitution werden mit Effekten angezeigt; der erste Turn ist erst danach möglich |
| US-M5-03 | ein Snapshot mit 7 Indikator-Tags | das Dashboard rendert | die Gauges werden dynamisch aus dem Indikator-Set erzeugt, sind auf einem Bildschirm ohne Scrollen sichtbar und es gibt keine Tabellen |
| US-M5-04 | Gruppenzufriedenheit | die Heatmap rendert | jede Gruppe ist farbcodiert und die Reihenfolge folgt der Zufriedenheit (unzufriedene Gruppen zuerst) |
| US-M5-05 | Einnahmen 40 | die Slider auf 50 gesetzt werden | das Defizit wird angezeigt und die Überschreitung des Schuldenlimits wird gewarnt bzw. abgewiesen |
| US-M5-06 | politisches Kapital 2 | eine Karte mit Kosten 3 angezeigt wird | der PK-Balken zeigt 2 und die Karte ist mit Begründung deaktiviert |
| US-M5-07 | eine Karte | sie vor der Wahl angezeigt wird | alle deterministischen Effekte (Indikatoren, Gruppen, Budget, PK) stehen vor dem Klick und entsprechen dem Dry-Run, mögliche Event-Folgen nur als Wahrscheinlichkeit |
| US-M5-08 | ein abgeschlossener Tick | der News-Feed aktualisiert wird | der Feed erzählt die Zahlen in Sätzen aus deterministischen Templates (Pack-Content, Variantenwahl über den seedbaren RNG), ist das erste Element im Lesefluss und die Einträge stehen im Golden-Hash |
| US-M5-09 | eine unzufriedene Gruppe | der Tooltip geöffnet wird | die 2 wichtigsten Gründe werden aus `zufriedenheits_trace` gerendert, vom `tick` erzeugt mit Ursprungs-ID (Regel/Event/Indikator); die UI berechnet nichts selbst und die Trace-Summe ergibt den Delta (Invariant-Test) |
| US-M5-10 | Legitimität, Opposition, Extremismus, Schulden | das Dashboard rendert | alle vier Werte sind sichtbar und verständlich beschriftet |
| US-M5-11 | Forschungslevel 20 vs. 80 | der Berater gelesen wird | der Berater leitet den `zufriedenheits_trace` narrativ ab (app-Schicht), die Detailtiefe ist bei 80 höher und die Vorhersage bleibt in beiden Fällen exakt |
| US-M5-12 | 5 neue Spieler ohne jede Erklärung | sie spielen | alle erreichen mindestens 5 Turns ohne Abbruch und ohne Rückfrage |
| US-M5-13 | ein Viewport ab 768 px | das Dashboard rendert | Gauges, Heatmap und Karten sind ohne Overlap nutzbar |
| US-M5-14 | Tastatur-Navigation | mit Tab und Enter gespielt wird | alle Karten und Slider sind erreichbar und der Heatmap-Kontrast ist ≥ 4.5:1 |

## M6 — Persistenz, Score, Schwierigkeit, Finish

| ID | Given | When | Then |
|---|---|---|---|
| US-M6-01 | ein Save | er gelesen wird | er enthält `schema_version`, Seed, Action-Log und Snapshot; der Backup-Slot enthält den vorherigen Snapshot |
| US-M6-02 | ein laufendes Spiel | der Browser-Tab neu geladen wird | der letzte Zustand wird aus dem Autosave hergestellt und der Turn ist fortsetzbar |
| US-M6-03 | ein Save mit 5 Indikatoren aus einer älteren Schema-Version | er geladen wird | die Migration über `schema_version` setzt das 7er-Indikator-Set mit Default-Werten, der Seed bleibt erhalten und das Spiel crasht nicht; ein korrupter Save fällt auf den Backup-Slot mit Warnung zurück |
| US-M6-04 | erschöpfte localStorage-Quota | Save exportiert und importiert wird | die JSON-Datei ist vollständig und der Import stellt den Zustand wieder her |
| US-M6-05 | Seed und Action-Log | der Replay läuft | der reproduzierte State ist identisch mit dem gespeicherten Snapshot |
| US-M6-06 | ein Spielende | der Score berechnet wird | der Score = Ø Indikatoren + gewichtete Ø Zufriedenheit + Regime-Dauer × 0.5 und die Gewichtung folgt der Regierungsform (Demokratie: Zufriedenheit; Diktatur: Stabilität/Fortschritt); spätestens nach 50 Jahren endet das Spiel zwangsweise mit Score-Ende |
| US-M6-07 | Spielende durch Putsch | das Endbild gezeigt wird | Score, Ursache des Machtverlusts und Seed stehen bereit und ein Neustart ist möglich |
| US-M6-08 | die drei Schwierigkeits-Packs | dieselbe Strategie 30 Jahre läuft | Verschleiß-Multiplikator 0.7/1.0/1.3, PK-Regeneration-Faktor 1.2/1.0/0.8, Event-Wahrscheinlichkeits-Multiplikator 0.6/1.0/1.4, Schuldenlimit 120/100/80, Zinsfaktor 0.05/0.08/0.12 und Startzuschuss +10/0/−10 BE unterscheiden sich; bei schwer stehen 22.35 BE Unterhalt gegen 26 BE Einnahmen, was die erwartete Deficit-Spirale ab Jahr ~10–12 und Bankrott um Jahr ~20 bei Nachlässigkeit erzeugt; der Score-Spread je Grad wird reportet |
| US-M6-09 | Turn-Abschluss und Krise | Audio abgespielt wird | die Signale sind unterscheidbar, deaktivierbar und ohne Netz-Asset |
| US-M6-10 | Sandbox-Modus | 60 Jahre gespielt werden | das Spiel endet nicht und der Score läuft weiter |
| US-M6-11 | ein laufendes Spiel | der Seed angezeigt und kopiert wird | mit demselben Seed und demselben Action-Log entsteht derselbe Verlauf |
| US-M6-12 | der Vite-Build | die Dateien statisch deployed werden | das Spiel ist ohne Server und nach Erstlad offline spielbar |
| US-M6-13 | der Release-Kandidat | das Release-Gate ausgeführt wird | Golden-Hash, Score-Spread, Pack-Load-Test, Save-Migration-Test und Onboarding-Ergebnis sind dokumentiert und grün |
