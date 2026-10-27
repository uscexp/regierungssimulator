# Handoff-Review — Regierungssimulator (M0-Freigabe)

Reviewer: Reto (Business Analyst). Prüfungsgegenstand: das Übergabepaket für den Build — `spezifikation.md`, `akzeptanzkriterien.md`, `backlog.csv`, `handoff-backlog.md`, `balance-werte.md`, `spielkonzept.md`, `architektur.md`. Alle Zahlen sind aus den Dateien gerechnet, nicht aus dem Kopf.

## 1. Was geprüft wurde

| Prüfpunkt | Ergebnis |
|---|---|
| Story-Abdeckung Spec ↔ Akzeptanzkriterien ↔ CSV | 100 ↔ 100 ↔ 100, keine Differenzen |
| Must-/Could-Stories ohne Akzeptanzkriterium | 0 |
| Größen/Prioritäten/Layer Spec ↔ CSV | identisch, keine Mismatch |
| MoSCoW-Verteilung | 79 Must / 15 Should / 6 Could |
| Effizienz je Meilenstein (S = 2 Tage, M = 5 Tage, wie dokumentiert) | M0 66 · M1 67 · M2 63 · M3 45 · M4 41 · M5 54 · M6 41 = **377 Tage Must+Should** · 332 Must · 27 Could · 404 alle |
| Schicht-Zuordnung | jede Story genau einer Architektur-Schicht; 28 verschiedene Schichten, alle im Architektur-§2 benannt |
| Gap-Analyse | 15 Gaps, IDs lückenlos G1–G15, jeder Gap mit Owner und betroffenen Stories, alle gelöst |
| Regelkonsistenz über alle Dokumente | identisch: Slot-Band 2–5, Agenda-Slots vor dem Sampling, capped Coverage, Unterdrückung G14, Agenda-Kosten 1 PK; keine stale Regelstelle; kein Fremdschrift-Zeichen im Ordner |
| Architektur-Autorität | ADR-010 Zeile 186 enthält G14/G15 als Entscheidungssätze; Register-Zeile §1 ergänzt |

## 2. Gefundene Fehler — korrigiert

| Befund | Beweislage | Korrektur |
|---|---|---|
| **Traceability-Matrix war unvollständig.** Sie hatte nur 26 Zeilen und damit 25 von 51 Feature Requirements ohne FR → Story → Testcase-Kette (FR-006, 008, 010, 014, 015, 018, 20, 21, 23, 24, 26, 31, 32, 35, 37, 38, 40, 42, 43, 44, 46, 47, 49, 50, 51). Die frühere Prüfung hatte Register- und Trace-Zeilen verwechselt und deshalb „alle 51 abgedeckt" gemeldet. | Trace-Zeilen haben 6 Spalten, FR-Zeilen 4; nach dieser Trennung waren es 26 Trace-Zeilen | 25 Trace-Zeilen ergänzt (FR → primäre Story → alle adressierenden Stories → Testfall aus der Akzeptanz → Meilenstein → Status). Jetzt 51 Zeilen, alle 51 FRs abgedeckt |
| **4 FRs ohne Story-Besitzer**: FR-006 (Verschleiß/`budget_wirkung`/`diminishing_at`), FR-008 (Gruppen-Gewicht-Matrix), FR-050 (alle Texte deutsch, keine realen Ländernamen), FR-051 (Agenda-Kosten + Unterdrückung) tauchten in keiner Story-FR-Spalte auf. | Story-FR-Spalten gegen das FR-Register gerechnet | FR-006 → US-M0-05/US-M0-17; FR-008 → US-M0-06/US-M0-07; FR-050 → US-M0-13/US-M3-07 (und die weiteren Content-Pack-Stories); FR-051 → US-M2-11/US-M3-15 |
| **NFR-Register hatte keine IDs.** Die Stakeholder-Tabelle referenzierte NFR-001/002/003, aber das Register (8 Zeilen) war ohne ID und ohne Story-Link — die nicht-funktionalen Anforderungen waren nicht rückverfolgbar. | `^\| NFR-` fand 0 Zeilen | IDs NFR-001…NFR-008 vergeben, Spalte „Stories" ergänzt: NFR-001 → US-M0-03/16/17 · NFR-002 → US-M0-04 · NFR-003 → US-M4-02 · NFR-004 → US-M0-11/14 · NFR-005 → US-M4-07 · NFR-006 → US-M0-01 · NFR-007 → US-M6-12 · NFR-008 → US-M0-11/US-M5-01 |
| **Roheffekt-Kopfzahl war falsch.** Handoff und meine Meldungen nannten „~336 Tage Must+Should". Nachgerechnet mit der dokumentierten Mapping (S = 2, M = 5): die Meilenstein-Summe der Must+Should-Stories ist **377 Tage**; 332 Tage ist Must allein, 27 Tage Could, 404 Tage alle Stories. Die Meilenstein-Werte im Widget waren korrekt. | Summen aus `backlog.csv` gerechnet | Handoff-Kopfzeile auf 377 / 332 / 27 / 404 korrigiert |
| **Abhängigkeiten waren nur Prose.** Die Spec beschreibt Reihenfolgen in Textzeilen (nur M0–M3, keine M4–M6); `backlog.csv` hatte keine maschinenlesbare Abhängigkeit — ein Task Decomposer konnte die Reihenfolge nicht ableiten. | 4 Prose-Zeilen, 0 CSV-Spalten | Spalte `depends_on` in `backlog.csv` ergänzt, 18 Stories mit Dependencies, aus den Prose-Zeilen abgeleitet (Layer `content/*` hängt an der Regel-Story des Meilensteins). Zyklen geprüft: keine |

## 3. Reste, die der Build entscheiden muss (keine BA-Blocker)

- **M4–M6 haben keine dokumentierten Abhängigkeiten.** Die Spec nennt Reihenfolgen nur für M0–M3. Für M4 (Loader vor Schema-Stories), M5 (Adapter vor Dashboard-Stories) und M6 (Save vor Score) ist die Reihenfolge implizit aus der Build-Order §7 ablesbar, aber nicht formalisiert. Empfehlung: beim Decomposing nachziehen.
- **Größen sind grob.** S ≤ 2 Tage, M ≤ 5 Tage, ein Entwickler — Roheffekt ist eine Größenordnung, kein Termin. Keine Story hat L (mehr als 5 Tage); M6-05 (Replay über 100 Jahre) und M4-02 (Loader + Zod-Schema) könnten bei genauerer Schätzung L werden.
- **M5-Abnahme ist nutzerabhängig** („5 neue Spieler schaffen ≥ 5 Turns ohne Tutorial") — braucht echte Testpersonen, nicht nur Tests. Das ist die einzige Abnahme, die nicht automatisch prüfbar ist.
- **`depends_on` deckt nur formulierte Kanten ab** (18 Stories). Leer bedeutet „nicht dokumentiert", nicht „keine Abhängigkeit".

## 4. Urteil für M0

M0 ist freigabebereit: 18 Stories (16 Must, 2 Should), ~66 Roh-Tage, Gate „Spiel komplett im Terminal + Golden-Hash + AutoSim-Harness". Die Kern-Risk-Story ist die Zufriedenheitsformel (Konzept §11) — der Harness liefert die ersten echten Daten, danach justiert Ralf Verschleiß/Wirkung. Keine offene Regelentscheidung, keine unerfüllbare Mechanik, Traceability und Abdeckung vollständig.
