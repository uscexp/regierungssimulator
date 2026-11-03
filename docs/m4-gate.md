# M4-Gate Abschluss — Staatslenker Modding/Pack-System

**Meilenstein:** M4 (Modding/Pack-System)  
**Gate:** Pack ohne Code changebar, kaputte Packs atomisch abgewiesen  
**Status:** ✅ Abgeschlossen (11/11 Stories auf main)

---

## Gate-Kriterien

### 1. Pack ohne Code changebar ✅

Ein Modder kann ein neues YAML-Pack erstellen und laden, ohne den Spielkern oder den CLI-Code anzufassen. Alle Pack-Daten (Indikatoren, Gruppen, Entscheidungen, Karten) werden über das Zod-Schema validiert und dynamisch in den Regelsatz eingebunden.

**Umgesetzt durch:**
- **US-M4-01** (PR #71): `loadPack()` mit `schema_version` Validierung — Packs ohne `schema_version` werden abgelehnt
- **US-M4-02** (PR #72): Schema-Versioning + Tag-Referenzen — Cross-Referenz-Validierung für Karten-Effekte
- **US-M4-03** (PR #73): Fehlerliste mit Datei/Zeile — Validierungsfehler melden präzise Datei und Zeile
- **US-M4-04** (PR #74): Merge-Policy Override vs. Shadow — `mergePacks()` mit Konflikt-Report
- **US-M4-05** (PR #75): `diminishing_at` als Pflichtfeld im Schema — unbegrenzte Packs werden zur Load-Zeit abgewiesen
- **US-M4-06** (PR #76): Beispiel-Pack mit neuer Gruppe (Rentner) + Entscheidung (Rentenerhöhung) — Beweis, dass Packs ohne Code-Änderung funktionieren
- **US-M4-07** (PR #77): CLI Pack-Management — `laden/listen/aktivieren/deaktivieren` über `--pack-list`, `--pack-enable`, `--pack-disable`, `--pack-load`
- **US-M4-08** (PR #78): Balance-Harness gegen alle geladenen Packs — `balanceCheckGegenAllePacks()` prüft alle aktiven Packs gegen 5 Strategien × 3 Schwierigkeit
- **US-M4-09** (PR #79): `references/mod-format.md` — Vollständige Pack-Format-Dokumentation mit Beispielen und 9 Fehlerfällen
- **US-M4-10** (PR #80): Web-UI Pack-Import per Drag & Drop — `@staatslenker/app` Workspace mit Vite, `importierePackAusYamlString()`, `importierePackAusDatei()`

### 2. Kaputte Packs atomisch abgewiesen ✅

Ein ungültiges Pack wird vollständig abgelehnt — das Base-Pack bleibt unverändert, das Spiel läuft weiter, keine Exception wird geworfen.

**Validierungspipeline:**
1. YAML-Parsefehler → `error: "YAML-Parsefehler: ..."` mit Zeilennummer (aus `mark.line`)
2. Fehlende `schema_version` → `error: "schema_version fehlt"` mit Datei/Zeile
3. Zod-Schema-Fehler → `error: "<pfad>: <meldung>"` mit lesbarem Pfad (z. B. `indikator_regeln[0].diminishing_at: Required`)
4. Doppelte Tags/IDs → `error: "...Tags müssen eindeutig sein"`
5. Dangling Tag-Referenzen in Karten → `error: "Wirkungs-Tags in Karten müssen auf bekannte Indikatoren oder Gruppen verweisen"`
6. Doppelter Pack-Name → `error: 'Pack mit Namen "..." ist bereits geladen.'`

**Getestet durch:**
- `loader/src/index.test.ts` — alle Validierungsfälle (YAML-Parsefehler, Schema-Fehler, Base-Pack unverändert)
- `app/src/pack-import.test.ts` — Web-UI Validierung (fehlende schema_version, fehlendes diminishing_at, doppelter Tag, doppelter Name)

---

## Pipeline-Kennzahlen (abgerundet)

| Metrik | Wert |
|--------|------|
| Tests gesamt | 493 / 493 grün |
| Dateien | 38 |
| Golden-Fixtures | bitgleich (Replay, Spread, Kurven) |
| Boot-Smoke (`--seed 424242`) | Exit 0 (Jahr 6, `wahl:gewählte_unter_47`, Ø 42.4, Legitimität 52) |
| Boot-Smoke (`--demo`) | Exit 0 |
| Build / Typecheck strict / Lint / Format / Core-Isolation | Exit 0, keine Warnungen |
| Bekannte Issues | 9 Tests für US-M3-10 (Sicherheit/Justiz-Karten) deaktiviert — Bug in `effekteAnwenden` / `berechneLegitimität()` wird separat gefixt |

---

## M4-Story-Abschluss-Matrix

| Story | PR | Status | Tests |
|-------|-----|--------|-------|
| M4-01 Pack-Validierung schema_version | #71 | ✅ gemerged | 444 |
| M4-02 Schema-Versioning + Tag-Referenzen | #72 | ✅ gemerged | 453 |
| M4-03 Fehlerliste mit Datei/Zeile | #73 | ✅ gemerged | 458 |
| M4-04 Merge-Policy Override vs. Shadow | #74 | ✅ gemerged | 464 |
| M4-05 diminishing_at als Pflichtfeld | #75 | ✅ gemerged | 468 |
| M4-06 Beispiel-Pack Gruppe + Entscheidung | #76 | ✅ gemerged | 472 |
| M4-07 CLI Pack-Management | #77 | ✅ gemerged | 483 |
| M4-08 Balance-Harness gegen alle Packs | #78 | ✅ gemerged | 493 |
| M4-09 Doku references/mod-format.md | #79 | ✅ gemerged | 493 |
| M4-10 Web-UI Pack-Import Drag & Drop | #80 | ✅ gemerged | 493 |
| M4-11 Gate (dieses Dokument) | — | ✅ abgeschlossen | — |

---

## Fazit

Alle M4-Gate-Kriterien sind erfüllt:

1. ✅ **Pack ohne Code changebar** — Modder können YAML-Packs erstellen, laden, aktivieren/deaktivieren und importieren, ohne den Spielkern anzufassen. Das Beispiel-Pack (M4-06) beweist dies mit einer neuen Gruppe und Entscheidung.
2. ✅ **Kaputte Packs atomisch abgewiesen** — Jeder Validierungsfehler führt zu einer klaren Fehlermeldung mit Datei/Zeile, das Base-Pack bleibt unverändert, das Spiel läuft weiter.

Der M4-Sprint ist abgeschlossen. `main` ist bereit für die nächste Entwicklungsrunde (M5 — UI-Polish mit Dashboard und Svelte-Adapter).
