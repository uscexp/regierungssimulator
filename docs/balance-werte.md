# Balance-Werte — „Staatslenker“ (V1)

**Quelle der Werte:** Ralf (Konzeptautor), hinterlegt als §12 in `spielkonzept.md`. Übergeben per Bot-Chat am 26. Okt.
**Verwendung:** Basis-Content in `content/base/` und Parameter-Packs; der AutoSim-Harness prüft dagegen (US-M0-17/18, US-M3-13, US-M4-09).
**Einheit:** Budget-Einheiten [BE]. Alle abgeleiteten Werte unten sind nachgerechnet, nicht übernommen.

---

## 1. Einnahmen & Start

`Einnahmen = Wirtschaft-Level × Steuerfaktor` · Steuerfaktor: niedrig 0.6 · flat 0.8 · progressiv 1.0 · hoch 1.2
Startwerte (Schwierigkeit *normal*): Wirtschaft 45, übrige Indikatoren 40.

| Steuermodell | Faktor | Einnahmen bei Wirtschaft 45 |
|---|---|---|
| niedrig | 0.6 | 27 BE |
| flat | 0.8 | 36 BE |
| progressiv | 1.0 | 45 BE |
| hoch | 1.2 | 54 BE |

**K2 bestätigt:** Startkonfiguration *normal* = Steuermodell **flat** (0.8) → 36 BE. Das Steuermodell wird ab M1 über die Konstitution gewählt; der M0-Balance-Anker bleibt fix flat. Zinsen werden zuerst vom Budget abgezogen.

## 2. Indikatoren: Verschleiß, Budgetwirkung, diminishing_at (Schwierigkeit normal)

| Indikator | Verschleiß/Jahr | budget_wirkung pro BE | diminishing_at | Nachgerechneter Unterhalt |
|---|---|---|---|---|
| Infrastruktur | 3 (korrigiert, war 4) | +0.5 | 70 (darüber +0.2) | 6.00 BE |
| Bildung | 2 | +0.6 | 65 (darüber +0.25) | 3.33 BE |
| Gesundheit | 2 (korrigiert, war 3) | +0.7 | 75 (darüber +0.2) | 2.86 BE |
| Wirtschaft | 2 | +0.4 | 80 (darüber +0.15) | 5.00 BE |
| Forschung | 2 (korrigiert, war 3) | +0.5 | 85 (darüber +0.20, D13 final autorisiert von Ralf — 0.10 verworfen) | 4.00 BE — nur aktiv bei Bildung ≥ 50, siehe Gate unten |

**K3 korrigiert durch Ralf (neue Gate-Regel):** bei Bildung < 50 *stagniert* Forschung — weder Wachstum noch Verschleiß, sie bleibt auf ihrem Level (Start 40). Bei Bildung ≥ 50 wirkt +0.5/BE und −2/Jahr. Damit ist Bildung → Forschung eine echte Freischalt-Abhängigkeit: Bildung braucht +10 Level = 16.67 BE Budget, bevor Forschung überhaupt beweglich wird.
| Recht & Freiheit | 1 | nur Gesetze | — | nicht per Budget |
| Sicherheit | 2 | nur Gesetze | — | nicht per Budget |

**K1 korrigiert durch Ralf — die Rechnung ist jetzt konsistent:** Unterhalt ohne Forschung = 6.0 + 3.33 + 2.86 + 5.0 = **17.19 BE/Jahr** (Ralf: 17.2). Mit aktivem Forschung ≤ 85 = **21.19 BE/Jahr** (Ralf: 21.2). Mit aktivem Forschung > 85 (diminishing 0.20/BE, D13 final) = **27.19 BE/Jahr** (Forschung-Zeile 10.0 BE + Basis 17.19 BE). Einnahmen flat 36 BE → Spielraum 8.81 BE (über 85) bzw. 14.81 BE (≤ 85).

| Schwierigkeit | Verschleiß× | Unterhalt ohne Forschung | Unterhalt mit Forschung (≤85) | Unterhalt mit Forschung (>85) | Einnahmen (flat, inkl. Zuschuss) | Spielraum (≤85) | Spielraum (>85) |
|---|---|---|---|---|---|---|---|
| leicht | 0.7 | 12.03 BE | 14.83 BE | 19.03 BE | 46 BE | 31.17 BE | 26.97 BE |
| normal | 1.0 | 17.19 BE | 21.19 BE | 27.19 BE | 36 BE | 14.81 BE | 8.81 BE |
| schwer | 1.3 | 22.35 BE | 27.55 BE | 35.35 BE | 26 BE | -1.55 BE | -9.35 BE |

Bei *leicht* bleibt der Spielraum auch bei Forschung > 85 komfortabel (26.97 BE); *normal* hat bei Forschung ≤ 85 14.81 BE Spielraum und bei > 85 noch 8.81 BE (24 %); *schwer* ist bei Forschung ≤ 85 bereits negativ (−1.55 BE) und bei Forschung > 85 (0.20/BE) deutlich negativ (−9.35 BE) — die von Ralf erwartete Deficit-Spirale ab Jahr ~10–12 ist damit rechnerisch plausibel; Forschung über 85 verschärft sie spürbar. Bei interim 0.15 wäre Spielraum >85 nur −9.68 BE (schwer).

## 3. Gruppen: Anteile, Gewichte, Steuerlast

Gewichte je Gruppe Σ = 1 (nachgerechnet ✓). Steuerlast als direkter Abzug auf Zufriedenheit in Reihenfolge niedrig/flat/progressiv/hoch.

| Gruppe | Anteil (Ralf) | Anteil normalisiert (Σ=100 %) | Indikatorgewichte | Steuerlast n/f/p/h |
|---|---|---|---|---|
| Arbeitnehmer | 24 % | — | Wirtschaft .45, Gesundheit .25, Recht .15, Sicherheit .15 | 2 / 4 / 3 / 8 |
| Unternehmen | 10 % | — | Wirtschaft .55, Infrastruktur .30, Sicherheit .15 | 0 / 4 / 8 / 12 |
| Bildung & Jugend | 13 % | — | Bildung .60, Forschung .25, Freiheit .15 | 2 / 4 / 3 / 8 |
| Gesundheitswesen | 12 % | — | Gesundheit .70, Forschung .15, Infrastruktur .15 | 2 / 4 / 3 / 8 |
| Konservative | 16 % | — | Sicherheit .55, Recht .25, Wirtschaft .20 | 2 / 4 / 2 / 7 |
| Liberale/Minderheiten | 9 % | — | Freiheit .60, Recht .25, Bildung .15 | 2 / 4 / 2 / 7 |
| Staatsapparat | 8 % | — | Infrastruktur .50, Sicherheit .30, Bildung .20 | 3 / 4 / 3 / 8 |
| Landwirte | 8 % | — | Wirtschaft .60, Infrastruktur .40 | 2 / 4 / 2 / 7 |

**K4 korrigiert durch Ralf:** die Anteile summieren jetzt auf **100 %** (nachgerechnet ✓). Die Loader-Normalisierung ist nicht mehr nötig, bleibt aber als Safety net für Mod-Packs bestehen (ein Pack kann Anteile verschieben).

## 4. Zufriedenheit beim Start (nachgerechnet)

Baseline ohne Konstitutions-Modifikatoren = 10; Konstitution moduliert ±8.
Bei Startlevel 40 und Gewicht Σ=1: Grundzufriedenheit = 10 + 40 = **50**. Mit Steuerlast flat (Abzug 4, Unternehmen 4): **46** je Gruppe. Gewichtete Ø-Zufriedenheit der Bevölkerung bei flat: **46.0** (der früher berechnete Wert 50.6 kam von den fehlerhaften 110 % Anteile).

**M0-Anker (3 Gruppen, D10/D12):** M0-Basis-Content nutzt Unternehmen · Arbeitnehmer · Bildung & Jugend mit renormierten Anteilen 21.3 / 51.1 / 27.6 % (Σ = 100 %) und renormierten Gewichten auf die in M0 vorhandenen Tags; Start Wirtschaft 45, übrige 40, Steuerlast flat 4 → Unternehmen 49.24 · Arbeitnehmer 49.21 · Bildung & Jugend 46.0, gewichtete Ø = **48.33** (nicht 48.4 — 48.4 nutzte Summe 100.1). Die Formel normalisiert über die echte Summe; Tyrdors Fixtures rechnen mit den normierten Anteilen. Schwächste Gruppe 46.0. Der Unruhe-Gate für Wahlen ist identisch in Spec/AC/Konzept: Wahl gewonnen nur bei gewichteter Ø-Zufriedenheit ≥ 50 UND Zufriedenheit der schwächsten Gruppe ≥ 35. Bei 48.33 Start verliert der Spieler die Wahl in Jahr 4 ohne Investitionen — bewusste Druckwirkung. Ab M1/M3 gilt das §12-Originalmodell mit 8 Gruppen, der Gate bleibt derselbe.

## 5. Politisches Kapital

Max 12. Regeneration/Jahr = Legitimität/10 × Schwierigkeitsfaktor (leicht 1.2 · normal 1.0 · schwer 0.8), Minimum 1. Kartenkosten 1–3 PK.

| Legitimität | leicht | normal | schwer |
|---|---|---|---|
| 25 | 3.0 | 2.5 | 2.0 |
| 50 | 6.0 | 5.0 | 4.0 |
| 75 | 9.0 | 7.5 | 6.0 |

Bei Legitimität 50 sind damit pro Jahr 2–5 Karten spielbar (Kosten 1–3 PK) — das erfüllt US-M3-12 („nicht alle guten Karten gleichzeitig“).

## 6. Schuldenkurve (G7)

Schulden in BE. Limit: leicht 120 · normal 100 · schwer 80. Zins/Jahr = Schulden × Faktor (0.05 / 0.08 / 0.12).
- Schulden ≥ Limit: keine neuen Defizit-Ausgaben + erzwungenes Spar-Event (alle Gruppen −5).
- Staatsbankrott/Niederlage: Schulden ≥ Limit **in zwei aufeinanderfolgenden Jahren** UND Wirtschaft < 25.

## 7. Radikalisierung & Extremismus-Ausgänge (G8)

Extremismus-Anteil E (0–100), Start 10.
Wächst/Jahr wenn Opposition > 40 UND Legitimität < 40: `E += (Opposition − 40) × 0.3 + (40 − Legitimität) × 0.2`; sonst `E − 3`.
Stimmanteil extremistischer Parteien = E × 0.6.

Nachgerechnetes Beispiel (Opposition 60, Legitimität 20, Start E 10):

| Jahr | E | Stimmanteil | Band (K5 korrigiert, nur in E definiert) |
|---|---|---|---|
| 1 | 20 | 12 % | neutral |
| 2 | 30 | 18 % | neutral |
| 3 | 40 | 24 % | Populismus-Fenster offen (E ≥ 40) |
| 4 | 50 | 30 % | Populismus-Fenster offen |
| 5 | 60 | 36 % | Koalitionsdruck-Band (58 ≤ E < 70) |
| 6 | 70 | 42 % | Niederlage möglich (E ≥ 70) |
| 7 | 80 | 48 % | Niederlage möglich |

**K5 korrigiert durch Ralf — beide Ausgänge nur in E, keine Überlappung:**
- **Niederlage Machtergreifung:** bei einer Wahl wenn E ≥ 70 UND Stimmanteil (E × 0.6) ≥ Stimmanteil der Regierungspartei → sofortiges Spielende.
- **Koalitionsdruck:** Wahl gewonnen bei 58 ≤ E < 70 (Stimmanteil 34.8–42 %, die Stimmanteil-Bedingung ist redundant) → Amt bleibt, die nächsten 3 Jahre müssen pro Jahr 2 Agenda-Slots aus der festen Agenda gespielt werden (bei Band 2 alle Slots, bei Band 4–5 mindestens 2; Agenda-Karten kosten je 1 politisches Kapital): Notstandsdekret, Einwanderungsstopp, Presse-Einschränkung, Subventionsstopp, Sicherheitspaket. Je Karte: Konservative +6, Arbeitnehmer +4, Liberale −10, Freiheit −4, Legitimität −3. Druck endet früh bei Opposition < 30 UND E < 25, sonst +3 Jahre. Chronologisch korrekt: erst Druck, dann Machtergreifung.

## 8. Populismus-Agenda (G10)

E ≥ 40 UND ≥ 2 Jahre vor einer Wahl → Populismus-Fenster: pro Jahr 1 Slot aus dem Slot-Band 2–5 aus der Agenda der dominierenden Richtung; während des Koalitionsdrucks feuert das Populismus-Fenster nicht (Agenda-Karten kosten je 1 politisches Kapital) (rechts = die G8-Karten; links = Umverteilung, Marktregulierung).
Erzwungene Agenda-Karte: 0 BE, 1 PK; Zielgruppen +6 kurzfristig; +5 % Stimmen bis zur Wahl; permanent −5 Liberale (rechts) bzw. −5 Unternehmen (links); Freiheit −2; Legitimität −3 → E wächst wieder. Appeasement ist damit kein freier Loop.

## 9. Schwierigkeit = Parameter-Pack (G6, bestätigt)

| Parameter | leicht | normal | schwer |
|---|---|---|---|
| Verschleiß-Multiplikator | 0.7 | 1.0 | 1.3 |
| PK-Regeneration-Faktor | 1.2 | 1.0 | 0.8 |
| Event-Wahrscheinlichkeits-Multiplikator | 0.6 | 1.0 | 1.4 |
| Schuldenlimit | 120 | 100 | 80 |
| Zinsfaktor | 0.05 | 0.08 | 0.12 |
| Startbudget-Zuschuss/Jahr | +10 | 0 | −10 BE |

## 10. Session-Rahmen & Score (Korrektur durch Ralf)

Ziel-Session **12–25 Jahre-Schritte** (nicht 10–20), Hard-Cap **50 Jahre**, danach Score-Ende; Sandbox optional darüber.
`Score = Ø Indikatoren + gewichtete Ø Zufriedenheit + Regime-Dauer × 0.5`.
Bei normal (Zins 0.08) führt dauerhaftes Defizit ab etwa Jahr 15 in die Spar-Event-Zone — innerhalb des 50-Jahre-Caps balanciert.

## 11. Harness-Anker (Ralfs Erwartung)

- Naiv-Strategie „gleichmäßig maximal investieren“: hält alle Indikatoren ~stabil bis Jahr ~20 (17.19 BE Unterhalt gegen 36 BE Einnahmen). Gegen Krisen und Schulden wird das knapp, aber nicht unmöglich.
- Naiv-Strategie „nur Wirtschaft“: Infrastruktur fällt 3/Jahr von 40 und ist nach ~13 Jahren bei 0; die Wahl geht ≤ Jahr 12 verloren (Unternehmen-Zufriedenheit crasht vorher, Infrastruktur-Gewicht 0.30).
Diese zwei Erwartungen sind die Abnahmekriterien für US-M0-17/US-M0-18.

## 12. Klärungen — Status nach Ralfs Revision von §12

| ID | Klärung | Warum relevant |
|---|---|---|
| K1 | Unterhalt 18 BE vs. 26.62 BE | **gelöst:** Ralf korrigiert Verschleiß (Infra 3, Gesundheit 2, Forschung 2) → Unterhalt 17.19 BE / 21.19 BE. Anker bleibt „stabil bis Jahr ~20“.
| K2 | Start-Steuermodell | **gelöst:** normal = flat (0.8) → 36 BE; ab M1 über Konstitution wählbar; M0-Anker fix flat.
| K3 | Forschungs-Gate | **gelöst:** bei Bildung < 50 stagniert Forschung (kein Wachstum, kein Verschleiß); bei ≥ 50 +0.5/BE und −2/Jahr.
| K4 | Gruppenanteile Σ=110 % | **gelöst:** neue Anteile Σ=100 %; Loader-Normalisierung bleibt als Safety net für Packs.
| K5 | Extremismus-Ausgänge über Stimmanteil | **gelöst:** beide Ausgänge nur in E (Niederlage E ≥ 70, Koalitionsdruck 58 ≤ E < 70).
| K6 | Kartenauswahl-Heuristik | **gelöst durch Pädu (ADR-010)**, Ralf bestätigt und ergänzt: erzwungene Agenda-Slots werden vor dem Sampling besetzt und zählen in die Slots; Slots/Jahr = 3, 4 bei Legitimität ≥ 70, 2 bei PK ≤ 2. |
| Gelöst | Slot-Band 2–5 ist in ADR-010 amendiert (Pädu, G13); Koalitionsdruck unterdrückt das Populismus-Fenster (G14) und Agenda-Karten kosten je 1 politisches Kapital (G15). | Betrifft US-M3-06, US-M2-11, US-M3-15. |
