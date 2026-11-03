# Pack-Format für Staatslenker (US-M4-10, FR-036)

Dieses Dokument beschreibt das YAML-Format für Staatslenker-Mod-Packs. Ein Pack ist eine reine Datendatei — kein Code. Es erweitert den Basis-Regelsatz um neue Indikatoren, Gruppen, Entscheidungen und Karten, ohne dass der Spielkern angefasst werden muss (ADR-002, ADR-003).

## Überblick

Ein Pack wird über `--pack-load <datei>` in den CLI geladen und durch `loadPack()` atomisch validiert. Ein ungültiges Pack wird abgelehnt, das Base-Pack bleibt unverändert und das Spiel läuft weiter.

## Pflichtfelder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `schema_version` | String | Muss `"1"` sein. Andere Versionen werden abgelehnt. |
| `name` | String | Eindeutiger Pack-Name, mind. 1 Zeichen. |
| `indikator_regeln` | Array | Mind. 1 Regel. Jeder `tag` muss eindeutig sein. |
| `gruppen` | Array | Mind. 1 Gruppe. Jeder `tag` muss eindeutig sein. |
| `entscheidungen` | Array | Mind. 1 Entscheidung. Jede `regel_id` muss eindeutig sein. |

## Optionale Felder

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `version` | String | Pack-Version (z. B. `"1.0.0"`). |
| `beschreibung` | String | Menschlesbare Pack-Beschreibung. |
| `karten_katalog` | Array | Entscheidungs-Karten für den Karten-Katalog (M3). |

## Indikator-Regel (`indikator_regeln`)

Jede Regel definiert, wie sich ein Indikator pro Jahr bewegt.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `tag` | String | Ja | Muss dem Muster `^[a-z][a-z0-9_]*$` entsprechen. Eindeutig im Pack. |
| `verschleiß` | Zahl | Ja | Sinkt pro Jahr ohne Budget (>= 0). |
| `budget_wirkung` | Zahl | Ja | Zuwachs pro BE Budget (>= 0). |
| `diminishing_at` | Zahl | Ja | Ab diesem Level wirkt nur noch `diminishing_wirkung` (0–100). |
| `diminishing_wirkung` | Zahl | Ja | Abgesenkte Wirkung über `diminishing_at` (>= 0). |
| `gate` | Objekt | Nein | Stagnation, wenn referenzierter Indikator unter `min` liegt. |
| `regel_id` | String | Nein | Id für Dev-Fehlerausgabe. |

**Wichtig:** `diminishing_at` und `diminishing_wirkung` sind ein Pflichtfeld-Paar (US-M4-05). Ein Schwellenwert ohne abgesenkte Wirkung ist ein Content-Fehler.

## Gruppe (`gruppen`)

Jede Gruppe definiert eine Bevölkerungsgruppe mit Zufriedenheit und Indikator-Gewichten.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `tag` | String | Ja | Muss dem Muster `^[a-z][a-z0-9_]*$` entsprechen. Eindeutig im Pack. |
| `zufriedenheit` | Zahl | Ja | Start-Zufriedenheit (0–100). |
| `bevölkerungsanteil` | Zahl | Ja | Anteil der Bevölkerung in Prozent (> 0). |
| `gewichte` | Objekt | Ja | Indikator-Tag → Gewicht (0–1, Summe pro Gruppe = 1). |

## Entscheidung (`entscheidungen`)

Eine Entscheidungskarte, die der Spieler spielen kann.

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `regel_id` | String | Ja | Muss `^[a-z][a-z0-9_:]*$` entsprechen. Eindeutig im Pack. |
| `label` | String | Ja | Anzeigename (mind. 1 Zeichen). |
| `beschreibung` | String | Ja | Beschreibung (mind. 1 Zeichen). |
| `cost.budget` | Zahl | Ja | Budget-Kosten in BE (>= 0). |
| `cost.politisches_kapital` | Zahl | Ja | PK-Kosten (>= 0). |
| `effects` | Array | Ja | Liste von Effekten (mind. 1). |
| `constraints` | Array | Nein | Verfügbarkeits-Constraints (Regierungsform, Indikator-Level). |
| `cooldown` | Zahl | Nein | Jahre, in denen die Karte nach dem Spielen gesperrt ist. |

### Effekt (`effects[]`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `ziel` | Enum | Ja | `indikatoren` \| `gruppen` \| `legitimitaet` \| `radikalisierung` \| `politisches_kapital` \| `budget` |
| `tag` | String | Nein | Ziel-Indikator oder Ziel-Gruppe (bei `ziel: indikatoren` / `ziel: gruppen` erforderlich). |
| `delta` | Zahl | Ja | Änderung des Zielwerts. |

### Constraint (`constraints[]`)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `indikator.tag` | String | Nein | Indikator, dessen Level geprüft wird. |
| `indikator.min` | Zahl | Nein | Mindest-Level (inklusiv). |
| `indikator.max` | Zahl | Nein | Höchst-Level (inklusiv). |
| `regierungsform` | Enum | Nein | `parlamentarisch` \| `praesidential` \| `diktatur`. |

## Karten-Katalog (`karten_katalog`)

Karten für den Slot-Samling pro Jahr (US-M3-06, FR-029). Jede Karte hat `regel_id`, `pk_kosten` (1–3), `wirkung` (Effekt-Array) und optionale `constraints`. Wirkungs-Tags müssen auf bekannte Indikator- oder Gruppe-Tags verweisen (Cross-Referenz-Validierung).

## Merge-Policy (US-M4-04)

Wenn ein Override-Pack eine Base-Regel mit gleicher ID/Tag enthält, gilt die Merge-Policy:

- **override**: Die Pack-Regel ersetzt die Base-Regel vollständig.
- **shadow**: Die Base-Regel bleibt, die Pack-Regel wird ignoriert (Konflikt im Report).

Gilt für: `indikator_regeln` (Tag), `gruppen` (Tag), `entscheidungen` (regel_id), `karten_katalog` (regel_id).

---

## Gültiges Beispiel (Beispiel-Pack aus M4-06)

```yaml
schema_version: "1"
name: Beispiel-Pack
version: 1.0.0
beschreibung: Beispiel-Modpack mit neuer Gruppe (Rentner) und Entscheidung (Rentenerhöhung)
indikator_regeln:
  - tag: gesundheit
    verschleiß: 2
    budget_wirkung: 0.7
    diminishing_at: 75
    diminishing_wirkung: 0.2
  - tag: sicherheit
    verschleiß: 2
    budget_wirkung: 0
    diminishing_at: 100
    diminishing_wirkung: 0
gruppen:
  - tag: rentner
    zufriedenheit: 40
    bevölkerungsanteil: 15.0
    gewichte:
      gesundheit: 0.6
      sicherheit: 0.4
entscheidungen:
  - regel_id: entscheidung:rentner_rente
    label: Rentenerhöhung
    beschreibung: Erhöht die Rente und steigert die Zufriedenheit der Rentner
    cost:
      budget: 8
      politisches_kapital: 2
    effects:
      - ziel: gruppen
        tag: rentner
        delta: 5
      - ziel: legitimitaet
        delta: 1
```

**Warum das gültig ist:**
- `schema_version: "1"` — unterstützte Version
- `indikator_regeln` — 2 Regeln mit eindeutigen Tags, beide haben `diminishing_at` + `diminishing_wirkung`
- `gruppen` — 1 Gruppe mit eindeutigem Tag, Gewichte summieren auf 1.0
- `entscheidungen` — 1 Entscheidung mit eindeutiger `regel_id`, `cost` und `effects` vorhanden

---

## Fehlerfälle

### 1. Fehlende `schema_version`

```yaml
name: Kaputtes-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
    diminishing_at: 70
    diminishing_wirkung: 0.2
```

**Fehler:** `schema_version fehlt` — Pack wird abgelehnt.

### 2. Nicht unterstützte `schema_version`

```yaml
schema_version: "2"
name: Neues-Pack
```

**Fehler:** `Nicht unterstützte schema_version` — Pack wird abgelehnt.

### 3. Fehlendes Pflichtfeld `diminishing_at` (US-M4-05)

```yaml
schema_version: "1"
name: Kaputtes-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
    # diminishing_at fehlt!
```

**Fehler:** `indikator_regeln[0].diminishing_at: Required` — Pack wird abgelehnt.

### 4. Nur eines von `diminishing_at` / `diminishing_wirkung` vorhanden

```yaml
schema_version: "1"
name: Kaputtes-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
    diminishing_at: 70
    # diminishing_wirkung fehlt!
```

**Fehler:** `indikator_regeln[0].diminishing_wirkung: Required` — Pack wird abgelehnt.

### 5. Doppelter Indikator-Tag

```yaml
schema_version: "1"
name: Kaputtes-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
    diminishing_at: 70
    diminishing_wirkung: 0.2
  - tag: infrastruktur    # Duplikat!
    verschleiß: 1
    budget_wirkung: 0.1
    diminishing_at: 50
    diminishing_wirkung: 0.1
```

**Fehler:** `Indikator-Regel-Tags müssen eindeutig sein` — Pack wird abgelehnt.

### 6. Dangling Tag-Referenz in Karten-Katalog

```yaml
schema_version: "1"
name: Kaputtes-Pack
indikator_regeln:
  - tag: infrastruktur
    verschleiß: 3
    budget_wirkung: 0.5
    diminishing_at: 70
    diminishing_wirkung: 0.2
gruppen:
  - tag: arbeitnehmer
    zufriedenheit: 50
    bevölkerungsanteil: 100
    gewichte:
      infrastruktur: 1.0
entscheidungen:
  - regel_id: entscheidung:test
    label: Test
    beschreibung: Test
    cost:
      budget: 1
      politisches_kapital: 1
    effects:
      - ziel: indikatoren
        tag: nicht_vorhanden   # Referenziert unbekannten Indikator!
        delta: 1
karten_katalog:
  - regel_id: karte:test
    pk_kosten: 1
    wirkung:
      - ziel: indikatoren
        tag: unbekannt         # Dangling-Referenz!
        delta: 3
```

**Fehler:** `Wirkungs-Tags in Karten müssen auf bekannte Indikatoren oder Gruppen verweisen` — Pack wird abgelehnt.

### 7. Ungültiger Tag (falsches Muster)

```yaml
schema_version: "1"
name: Kaputtes-Pack
indikator_regeln:
  - tag: 123-invalid    # Beginnt mit Ziffer, ungültig
    verschleiß: 3
    budget_wirkung: 0.5
    diminishing_at: 70
    diminishing_wirkung: 0.2
```

**Fehler:** `indikator_regeln[0].tag: Ungültiges Format` — Pack wird abgelehnt.

### 8. Leere `indikator_regeln`

```yaml
schema_version: "1"
name: Kaputtes-Pack
indikator_regeln: []    # Muss mindestens 1 Regel enthalten
```

**Fehler:** `indikator_regeln: Array muss mindestens 1 Element enthalten` — Pack wird abgelehnt.

### 9. Wirkung ≤ 0 für nicht-unterhaltbaren Indikator

Indikatoren mit `budget_wirkung: 0` (wie Recht, Freiheit, Sicherheit) sind nicht per Budget unterhaltbar. Eine Zuteilung dort ist verbranntes Budget, keine Strategie. Das ist kein Validierungsfehler, aber ein Balance-Hinweis.

---

## CLI-Integration

Packs werden über den CLI geladen und verwaltet:

```
--pack-load <datei>      Lädt ein YAML-Pack und validiert es
--pack-list              Listet alle geladenen Packs mit Status
--pack-enable <name>     Aktiviert ein geladenes Pack
--pack-disable <name>    Deaktiviert ein geladenes Pack
--balance-check          Führt die Balance-Harness gegen alle aktiven Packs aus
```

Nur aktive Packs fließen in den Regelsatz ein. Inaktive Packs sind geladen, aber nicht angewendet.

---

## Cross-Referenzen

- **M4-05**: `diminishing_at` und `diminishing_wirkung` sind Pflichtfelder (FR-031/038)
- **M4-06**: Entscheidungen verwenden `cost` + `effects` statt `modifikationen` (FR-034)
- **M4-07**: `packManager` verwaltet laden/aktivieren/deaktivieren/listen (FR-040)
- **M4-08**: Balance-Harness prüft alle geladenen Packs gegen 5 Strategien × 3 Schwierigkeit (NFR-Erweiterbarkeit)