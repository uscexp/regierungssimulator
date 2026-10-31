# Software-Architektur — „Staatslenker“ (Regierungssimulator)

**Status:** V1 · Autor: Pädu · Auftraggeber: Haui · Basis: spielkonzept.md (Ralf)
**Designprinzipien:** Einfachheit vor Eleganz, Robustheit vor Feature-Vielfalt. Determinismus ist der Anker der gesamten Architektur.

---

## 1. Constraint-Register

| Constraint | Status | Quelle |
|---|---|---|
| Einzelspieler, diskreter Jahres-Turn, kein Echtzeit-Modus | **real** | Spielkonzept §10 |
| Seedbarer Zufall / Replaybarkeit | **real** | Konzept §5, §9 (M6) |
| Regelsatz data-driven: Expansion-Pack = Dateien, kein Code | **real** | Konzept §6 (M4) |
| Balance-Test mit Auto-Simulator ab M0 | **real** | Konzept §11 (Risiko) |
| UI deutsch, ein Dashboard, keine Tabellen | **real** | Konzept §7 |
| Keine Netz-Abhängigkeit zur Spielbarkeit (offline spielbar) | **annahme** | abgeleitet aus „kein Multiplayer“ — korrigierbar |
| Auslieferung als **Web-App** (Browser, statisches Hosting, z. B. itch.io/GitHub Pages) | **annahme** — wichtigste Entscheidung, siehe ADR-001 |
| Team: klein, TypeScript-erfahren, Budget klein | **annahme** |
| Mod-Packs werden als Dateien distribuiert (Upload), nicht als Online-Pack-Repo | **annahme** |
| Zufriedenheits-Delta-Trace im Snapshot (Tooltip-Gründe, ~1 KB) | decision | G1 → ADR-008 |
| Vorhersage ohne RNG-Verbrauch: Dry-Run mit RNG-Fork | decision | G2 → ADR-009 |
| Fraktionen = abgeleitete View, nicht persistent gespeichert | decision | G3 → §3a |
| Indikator-Set als Content (Tag-Map), Migration 5→7 | decision | G4 → §3a |
| Berater = narrative View auf dem Trace; Vorhersage bleibt exakt | decision | G5 → §3a |
| News-Feed = deterministische Templates aus dem Tick, kein LLM | decision | G11 → §3a |
| Kartenauswahl gewichtet + seedgesteuert, Katalog nicht voll sichtbar | decision | G12 → ADR-010 |
| Slot-Zahl 2–5: PK ≤ 2 → 2 Slots, Legitimität ≥ 70 → 4; Agenda-Slots vor Sampling, zählen mit; Koalitionsdruck unterdrückt Populismus-Fenster (Agenda-Last ≤ 2), Agenda-Karten kosten je 1 PK | decision | G13/G14/G15 → ADR-010 (amendiert) |
| Wahl-Machtcheck = typisierte wahlregel-Content im Kern, keine injizierte Funktion | decision | D15 → ADR-011 |

Annahmen sind explizit markiert; wenn eine davon falsch ist (z. B. Desktop-App statt Browser), ändert sich nur der Adapter, nicht der Kern (ADR-002 isoliert den Kern).

---

## 2. Requirements (vom Konzept abgeleitet)

**Funktional:** Setup (Regierungsform + Konstitution), Jahreszyklus (Lagebericht → Budget → Karten → Auflösung → Machtcheck), politisches Kapital, Events mit Ketten, Radikalisierungskurve, Wahl/Putsch, Score, Mod-Format (decision/event/constitution/gruppe/wahlregel), Dashboard mit Vorhersagen auf Karten.

**Nicht-funktional:**
- **Determinismus:** gleicher Seed + gleiche Aktionen ⇒ gleicher Spielverlauf (Replays, Tests, Balance-Harness).
- **Robustheit:** kein Spielzustand darf jemals NaN/Out-of-Range werden; ein kaputtes Mod-Pack darf das Spiel nie crashen.
- **Testbarkeit ohne Browser:** der Kern muss headless laufen (M0 ist Text-UI; Balance-Harness läuft im CI).
- **Erweiterbarkeit:** Tag-Referenzen, Packs andocken ohne Code.
- **Einfachheit:** eine Sprache, ein Build, kein Server, keine Datenbank.

---

## 3. Architektur — vier Schichten, ein Repo

```
core/          Deterministische Simulations-Engine — reines TypeScript, kein DOM
  state.ts     GameState: Indikatoren, Gruppen, Budget, PK, Legitimität,
               Schulden, Radikalisierung, Jahr, RNG-State, Konstitution,
               zufriedenheits_trace (Top-2 Delta-Gründe je Gruppe, ADR-008)
  tick.ts      tick(state, action, regeln, modus?) → neuer State + Events + News-Einträge
               — PURE Funktion; State wird nicht mutiert, sondern als Snapshot erzeugt; RNG liegt im GameState (ADR-006)
  rules.ts     Regel-Typen + ZOD-Schema (decision/event/constitution/gruppe/wahlregel)
  eval.ts      Bedingungs-Auswertung: typisierte Prädikate ({ wirtschaft: "<40" }),
               KEINE generische Expression-Interpreter-Schicht
  events.ts    Event-Ketten, Wahrscheinlichkeiten, Options→Decision-Cards
  save.ts      Versioniertes Save-Format (Schema-Version + Migrationen)
  invariant.ts clamp 0–100 überall; Invariant-Check nach jedem Tick

content/base/  Basis-Regelsatz als TS-Objekte, gegen dasselbe Zod-Schema validiert
loader/        YAML-Pack-Loader: js-yaml + Zod; Validierung atomisch (alles-oder-nichts)
cli/           Text-UI für M0 + AutoSim-Balance-Harness (kopflose Spieler-Strategien)
app/           Svelte-UI — Adapter, sieht nur Snapshots und sendet Actions
```

**Die zentrale Kante:** UI und CLI sind *Adapter* auf denselben Kern. Der Kern kennt kein DOM, keine UI, kein localStorage. M0 (Text-UI) und M5 (Dashboard) sind zwei Adapter auf derselben Engine — der Kern wird nie ein zweites Mal geschrieben.

**Datenfluss eines Turns:**
1. UI sendet Action (Budget-Verteilung, Kartenwahl) → `tick(state, action, regeln, modus?)`
2. Tick wendet Konstitution-Modifikatoren, Budget-Wirkung, Verschleiß an → Indikatoren
3. Zufriedenheitsformel aus Konzept §2B wird als eine reine Funktion implementiert (Gewicht-Matrix + additive Modifier — exakt wie im Konzept, keine Extras)
4. Event-Registry prüft Bedingungen, würfelt mit seedbarem RNG, öffnet Ketten/Options
5. Machtcheck (Wahl alle N Jahre, Putsch-Roll)
6. Ergebnis = neuer State-Snapshot + News-Feed-Einträge; UI rendert Snapshot

Vorhersage auf Karten (Konzept §7) ist keine zweite Engine: sie ist `tick` im Dry-Run auf einer Kopie des State — dieselbe Funktion, deshalb ist die Vorhersage garantiert korrekt (Details: ADR-009).

### 3a. State-Register-Ergänzungen (aus den Spezifikations-Gaps G3–G5, G11)

Der Grundsatz: **im GameState steht nur persistent Kern-Zustand; alles Ableitbare wird als pure View-Funktion berechnet.**

- **G3 — Fraktionsmodell:** Fraktionen sind eine *abgeleitete View* — pure Funktion aus Gruppenzufriedenheit + Konstitution. Zur Mehrheitprüfung im `tick` berechnet, **nicht** dauerhaft gespeichert; UI kann sie jederzeit aus dem Snapshot neu berechnen (deterministisch, replaybar, State bleibt klein).
- **G4 — Indikator-Set als Content:** `indikatoren: Record<tag, number>` im State; das Set selbst ist Content über die Regel `indikators` (Konzept §6). Core ist tag-getrieben, das Dashboard rendert N Gauges dynamisch. Save-Migration 5→7 über `schema_version` mit Default-Werten (ADR-005); Mod-Packs dürfen weitere Indikatoren definieren.
- **G5 — Berater-Genauigkeit:** Berater-Text ist eine *narrative Ableitung des `zufriedenheits_trace`* (app-Schicht, kein Kern). „Genauigkeit“ = Detailtiefe, skaliert mit dem Forschungs-Indikator — die Vorhersage bleibt exakt (ADR-009), sonst kollidiert sie mit der garantierten Vorhersage-Korrektur.
- **G11 — News-Feed:** News-Einträge werden im `tick` aus deterministischen Templates erzeugt; Templates sind Pack-Content (tags), Variantenwahl über den seedbaren RNG. Kein LLM, kein seedloses Rauschen — News gehören damit in den Tick-Ausgaben und in den Golden-Hash.
- **Budget-Allokation (PR #20 Ruling):** Budget-Allokation bleibt eine Tick-Action und wird über `TickErgebnis` narrativiert (`gekuerzte_be`-Durchreichung — Tick-Ausgabe ist transient, kein State-Schema-Change). Sie wird **nicht** als wirkungsloser Eintrag mit leerer `wirkung` ins Entscheidungsgedächtnis geschrieben: das Gedächtnis ist ein Effekte-Objekt (`effekteAusBeschlüsse`), wirkungslose Einträge verwässern es mit Nicht-Effekten, kosten Snapshot-Bytes und würden künftige Regeln, die Beschlüsse zählen (Agenda-/Populismus-Mechanik, News-Templates), mit Budget-Rauschen infizieren. Transparenz kommt aus dem Action-Log (ADR-005) bzw. einem Adapter-Store bis M6; ein eigenes Snapshot-Feld ist nicht nötig (§3a: ableitbar, schon im State). Wenn Budget-Beschlüsse *nachhaltig* in die Zufriedenheit sollen, ist das eine Content-Entscheidung mit echter `wirkung` — keine wirkungslose Kern-Action.

### 3b. Regel-Register-Kanons (US-M1-01 — Pädu-Kanon, Feldnamen aus dem bestehenden Kern)

Das Regel-Register ist ein Modul **im Kern** (`core/rules.ts`): Regel-Typen + Zod-Schema + Lookup nach Typ/Tag. Das Schema liegt im Kern, **nicht** in `content/base` — content/base enthält Regel-*Instanzen*, die gegen das Kern-Schema validieren; der Loader (M4) importiert das Schema aus core (Adapter→Kern erlaubt, Kern→Adapter verboten, ADR-002).

`wahlregel` = discriminated union über `typ` (closed Variant-Set, ADR-011):

**Verdikt D20 (Pädu):** Discriminator ist `typ`, Felder flach — ein `variant`/`parameter`-Envelope (`Record<string, unknown>`) ist verworfen. Ein Envelope zieht die variant-spezifischen Schwellen aus der Zod-Validierung beim Pack-Laden heraus (ADR-003: Schema als Quelle der Wahrheit, atomische Pack-Validierung) und verletzt ADR-011s closed, typisierte Variants; eine unnamed Parameter-Map wäre eine zweite Wahrheit zur Kern-Interpretation. Retos Feld-Vokabular gilt **innerhalb** der Varianten (ist deckungsgleich); `variant`/`parameter` ist Requirements-Prosa, keine Schema-Form — AC brauchen keine Änderung.

- **praesidentialwahl** `{ regel_id, typ: 'praesidentialwahl', intervall_jahre, gewichtete_min, schwächste_min }` — Feldnamen = bestehende `core/wahl.ts` Wahlregel (`intervall_jahre`, `gewichtete_min`, `schwächste_min`; D18-Werte 6/47/35), ergänzt um `regel_id` (die `grund_id` der Wahlprüfung referenziert die Regel-Id). Der Wahl-Gate gilt für **alle** Demokratie-Formen (FR-013) — auch den Kanzler; der Variant-Name bindet nicht an die Regierungsform. Kein `term_jahre`: das bestehende Feld ist `intervall_jahre`.
- **parlamentmehrheit** `{ regel_id, typ: 'parlamentmehrheit', mehrheit: number }` mit mehrheit ∈ [0.5, 1] — Gesetzes-Mehrheit (FR-016). **Keine Fraktions-Ids in Regeln**: Fraktionen sind abgeleitete Views (G3/§3a) ohne stabile Identität; Ids wären fragil. Der Anteil wird gegen die tick-abgeleitete Fraktions-Support-Summe geprüft.
- **putsch_roll** `{ regel_id, typ: 'putsch_roll', elite_min, militaer_min, legitimitaet_min, wahrscheinlichkeit }` — Bedingung: `(elite < elite_min ODER militaer < militaer_min) UND (legitimitaet < legitimitaet_min)` ⇒ seedbarer Roll mit `wahrscheinlichkeit` (Wert: Ralf über balance-werte, G6–G10). `elite`/`militaer` sind Gruppen-Tags aus Content (US-M1-09: „Elite“ als eigene Gruppe); Feldnamen ASCII nach Kern-Stil (`legitimitaet` wie im State).

**regierung** `{ regel_id, typ: 'regierung', form: 'praesidential'|'parlamentarisch'|'diktatur', amt: { modus: 'fixed_term'|'zyklisch'|'keins', jahre?: number }, machtverlust: 'wahl'|'misstrauen'|'putsch' }` mit refine exakt wie vorgeschlagen: praesidential ⇒ wahl + fixed_term mit jahre > 0; parlamentarisch ⇒ misstrauen; diktatur ⇒ putsch. Die Wahlniederlage des Kanzlers läuft über denselben Wahl-Gate (FR-013, demokratieübergreifend) — misstrauen ist die zusätzliche Roll, kein Ersatz.

**Scope US-M1-01:** ja, das Register-Modul (`core/rules.ts`) ist Teil von US-M1-01 (Layer laut Spec: core/rules) — Typen + Schema + refine + Lookup. Der Loader bleibt M4 und validiert Packs gegen dieses Schema.

**Verdikt D21 (Pädu, constitution-Shape zu Tyrdors Follow-up `feat/m1-01-vokabular`):**
- `sofort_effekte` als `Record<gruppe_tag, delta>`: angenommen — der Record ist per Schlüssel eindeutig, die Array-Eindeutigkeits-Refine ist überflüssig; delta-Grenze −100…100 bleibt (Invariant-Stil).
- `steuermodell` ∈ flat/progressiv/hoch/niedrig: angenommen — exakt Konzept §3.
- Refine „mindestens eine Änderung" im `regelsatz_modifikator`: angenommen — leerer Modifikator ist Rauschen.
- `regelsatz_modifikator` ist **Pflichtfeld**, nicht optional — Konzept §3 verspricht „jede Entscheidung mit dauerhaftem Regelsatz-Modifikator", und dieses Versprechen ist der Balance-Guard, der das Setup relevant macht (M1-Gate: zwei Konstitutionen ändern Mechanik). Symbolische Nur-Baseline-Entscheidungen sind erst gültig, wenn Ralf §3/§12 revidiert.
- Entscheidungs-Ids: Pattern-Feld `^[a-z][a-z0-9_]*$` (snake_case wie die Kern-Tags), kein enum — konsistent mit D20/M4; „Grundrechte" (Großbuchstabe) wird korrekt abgelehnt.
- `beschreibung` Pflichtfeld: architektonisch begünstigt — M5-Karten und News-Templates (G11) referenzieren Entscheidungstext; ohne Pflichtfeld fehlen Karten Titel. Retos Wortlaut bleibt Requirements-Autorität, aber ein Fall zu „optional" braucht dann einen M5-Text-Ersatz. **Update (Reto confirmed):** „beschreibung Pflicht" ist eingetroffen und im gebauten Kopf umgesetzt (label + beschreibung Pflicht). Retos Schema-Snip schrieb `regelnatz_modifikator?` optional — das widerspricht D21 und seiner eigenen Begründungslogik; das Pflichtfeld bleibt, bis Ralf §3/§12 revidiert (dann amendiert der Kanon, nicht das Schema).

**Verdikt D22 (Pädu, Setup-Gate US-M1-02):** Tyrdors Richtung 1/2/3 angenommen, mit einem Kanon-Punkt:

- `GameState.setup` ist optional und wird **nur bei gesetztem Setup serialisiert** (der Key fehlt bei undefined) — die kanonische M0-Serialisierung bleibt bitgleich (Haui-Ruling: Replay/Spread/Kurven ohne Diff). Pflichtfeld über `schema_version` 2 (Alternative b) ist verworfen: es benennt die M0-Referenz um und ist gegen Haui/Ralf-Ruling.
- Der Gate lebt **im Kern als Datenregel**, aber `setup_pflicht` ist ein Feld des **geladenen Regelsatzes** (Pack-Level, aus dem Register), kein Adapter-Option: identische Regeln ⇒ identischer Gate über CLI und Web (ADR-002 — derselbe Grund wie D20 gegen injizierte Verhalten). Ein Adapter darf den Flag nicht selbst setzen — sonst hätten zwei Adapter bei identischen Regeln verschiedene Gate-Wirkung, und der Determinismus ist gebrochen.
- `setupAnwenden(state, aktion) → neuer Snapshot` ist pure; die Konstitutions-Ids werden gegen das geladene Register validiert, **bevor** der Snapshot geschrieben wird (atomisch wie die Pack-Validierung, ADR-003). `regierungsform` nutzt das bestehende `regierung`-Enum.
- Turn ohne vollständigen Setup: dev wirft mit Grund; Produktion gibt den unveränderten State zurück plus `TickErgebnis.setup_abgewiesen` — der Grund wird über News-Templates (G11) narrativiert („die Regierung ist noch nicht gegründet“), damit es nicht wie ein Bug wirkt.
- Adapter-Gate allein (Alternative a) ist verworfen: Spielregeln gehören nicht in Adapter — zwei Adapter dürfen nicht zwei Regelautoritäten sein. Der REPL-Order (Form → Konstitution → Turn 1) und der Standard-Setup im non-interaktiven Boot sind Adapter-Angelegenheit und ok.

---

## 4. Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Sprache | **TypeScript (strict), eine Sprache für alles** | Kern testbar, UI teilt Typen; ein Build, eine Toolchain |
| UI | **Svelte 5 + Vite** | Ein Dashboard mit viel kleinem Reactive-State — Svelte hat die kleinste Codefläche; kein UI-Framework nötig (Gauges/Heatmap = CSS/SVG) |
| Simulation | Pure Functions, immutable Snapshots | State ist winzig (<10 KB) — Kopieren ist trivial, kein Immer/Redux nötig |
| RNG | **mulberry32**, Seed im GameState | Deterministisch, serialisierbar, schnell; kein crypto.random für Gameplay |
| Validierung | **Zod** — ein Schema für Regeln UND Saves | Eine Quelle der Wahrheit: TS-Content und YAML-Packs validieren gegen dasselbe Schema |
| Packs | **js-yaml** + Zod | Konzept-Format (YAML) ohne eigenen Parser |
| Tests | **vitest** | Unit-Tests tick, **Golden-Replay-Tests** (Seed → Hash), **Balance-Harness** (100 Jahre × Strategien) |
| Persistenz | **localStorage** + JSON-Export/Import | Snapshot ist klein; kein IndexedDB, kein Server |
| Build/Deploy | Vite → statische Dateien → GitHub Pages / itch.io | Keine Infrastruktur, offline spielbar, kostenlos |
| Tooling | npm workspaces (Monorepo), ESLint, Prettier | core/app/cli teilen ein Repo, core hat keine Abhängigkeit zu app |

**Abgelehnt:** Python-Kern + Web-Frontend (zwei Sprachen, IPC, Server-Betrieb — verstößt gegen Einfachheit), Unity/Godot (ein Daten-Dashboard-Spiel braucht keine Game-Engine), React (mehr Boilerplate für eine Bildschirm-App), IndexedDB (State <10 KB, localStorage reicht), Backend/Cloud-Save (kein Multiplayer, kein Konto nötig).

---

## 5. Failure-Mode-Analyse

| Komponente | Failure | Verhalten |
|---|---|---|
| Tick-Engine | NaN / Out-of-Range durch schlechte Regelwerte | clamp an allen Effekten; Invariant-Check nach jedem Tick; dev-Modus: assert + Log mit Regel-ID |
| Tick-Engine | Determinismus-Regression | Golden-Test: fester Seed → 100 Jahre → State-Hash; im CI |
| Pack-Loader | kaputtes/invalides YAML-Pack | **atomisch**: ganzes Pack wird validiert, bevor es angewendet wird; Fehlerliste mit Datei+Zeile; Base-Pack bleibt unberührt; Spiel läuft weiter |
| Pack-Loader | Pack mit unausgewogenen Regeln | `diminishing_at` als Pflichtfeld im Schema (Konzept §11); Balance-Harness gegen alle geladenen Packs |
| Save | korrupt/incompatible Save-Datei | Schema-Version + Migrationen; Backup-Slot (letzter guter Snapshot); unparsebar → Backup, sonst neu starten mit Warnung |
| Browser-Tab | Crash mitten im Spiel | Autosave **nach jedem Tick** (billig, Snapshot <10 KB); Restore beim Reload |
| UI | mutiert State (Klassenfehler) | Kern exportiert nur readonly-Snapshots; Action-API ist die einzige Schreibstraße |
| localStorage | Quota erschöpft | nur ein Save-Slot; Export/Import als JSON-Datei als Fallback |
| Balance | eine dominante Strategie | PK + diminishing returns + RNG; Harness prüft Score-Spread über Strategien |
| Event-Ketten | Endlosschleife / nicht auflösbare Kette | Ketten-Tiefe im Schema begrenzt; jedes Event hat einen garantierten Exit (Timeout-Option „Effekt verfällt“) |

---

## 6. ADRs

### ADR-001 — Auslieferung als client-only Web-App, kein Backend
**Kontext:** Einzelspieler, turn-based, keine Netz-Features gefordert; Team klein; Budget klein.
**Entscheidung:** Statische Web-App (Vite-Build), Deploy auf GitHub Pages/itch.io. Kein Server, keine Datenbank, keine Accounts. Saves in localStorage + JSON-Export.
**Konsequenzen:** +null Infrastrukturkosten, +offline spielbar, +einfacher Deploy. −kein Cloud-Save, −kein Multiplayer (bewusst Non-Goal), −Mod-Distribution nur per Datei. Bei späterem Desktop-Wunsch: Electron-Wrapper um denselben Build (ADR-002 hält den Kern portabel).
**Abgelehnt:** Node-Backend mit DB (löst kein Requirement, kostet Betrieb), Python+Flask (zweite Sprache), native App (Build-Komplexität ohne Benefit).

### ADR-002 — Deterministischer, UI-freier Kern; UI und CLI sind Adapter
**Kontext:** M0 ist Text-UI; Balance braucht Auto-Simulator; Replays/Replaybarkeit gefordert; Vorhersagen auf Karten müssen korrekt sein.
**Entscheidung:** Kern ist eine pure Funktion `(state, action, rules, rng) → state'`. UI importiert den Kern, aber der Kern importiert nichts aus der UI. RNG-State liegt im GameState, nicht global.
**Konsequenzen:** +ein Kern für CLI (M0), Web-UI (M5) und Balance-Harness; +Golden-Replay-Tests möglich; +Vorhersage = Dry-Run von tick, keine zweite Logik. −jeder Tick kopiert den State (trivial bei <10 KB). −keine Echtzeit-Streaming-Events (diskreter Turn ist sowieso Requirement).
**Abgelehnt:** UI-integrierte Simulation (M0/M5 bricht Balance-Harness, Vorhersagen würden driften), Redux/Immer (unnötig für kleinen State).

### ADR-003 — Ein Zod-Schema als Quelle der Wahrheit für den Regelsatz
**Kontext:** M0–M3 brauchen Content schnell; M4 verlangt YAML-Mod-Format. Zwei Darstellungen desselben Regelsatzes (TS zur Entwicklung, YAML für Modder).
**Entscheidung:** Regel-Schema (decision/event/constitution/gruppe/wahlregel) einmal in Zod definiert. TS-Content und YAML-Packs validieren gegen dasselbe Schema. Pack-Loading atomisch.
**Konsequenzen:** +Mod-Format „fällt nebenbei“ aus dem Schema (M4 ist Loader + Beispiel-Pack, kein Format-Erfinden); +kaputte Packs werden zur Compile-/Load-Zeit abgewiesen, nicht zur Runtime. −Schema-Migrationen bei Regel-Änderung betreffen auch Modder (Versionsfeld im Pack nötig: `schema_version`).
**Abgelehnt:** eigenes YAML-Schema mit eigenem Parser (doppelte Wahrheit → Drift zwischen TS und YAML), JSON nur (Konzept spezifiziert YAML, Modder-freundlicher), TS-only ohne Loader (M4 unmöglich).

### ADR-004 — Bedingungs-DSL: typisierte Prädikate, kein Interpreter
**Kontext:** Events brauchen Bedingungen wie `{ wirtschaft: "<40" }`. Man könnte eine generische Expression-Engine bauen.
**Entscheidung:** Nur die im Konzept vorkommenden Prädikat-Formen implementieren (Indikator-Vergleich, Gruppen-Zufriedenheit, Schulden, OR als Liste). Keine Ausdrucks-Auswertung, keine eval.
**Konsequenzen:** +robust: kein Parsing von Arbitrary-Code, keine Injection durch Mods; +Vorhersage/Balance verstehen die Bedingungen vollständig. −Modder können keine arbitrarily komplexen Bedingungen schreiben (bewusste Grenze; erweiterbar via neue Prädikat-Typen im Code, nicht via String-DSL).
**Abgelehnt:** Mini-Interpreter/Expression-Sprache (Komplexität ohne Requirement; Sicherheits-/Debugging-Problem bei Modders).

### ADR-005 — Save = versionierter Snapshot + Action-Log
**Kontext:** Replaybarkeit, Autosave je Tick, Migrationen über Versionen hinweg.
**Entscheidung:** Save enthält Schema-Version, Seed, Action-Log und den letzten Snapshot. Laden: Snapshot direkt; Replay aus Seed+Log möglich (für Tests/Rückspulen optional). Backup-Slot für den vorherigen Snapshot.
**Konsequenzen:** +Robustheit gegen korrupte Saves; +Replays sind trivial. −Action-Log wächst (klein: ~5 Aktionen/Jahr × 50 Jahre ≈ paar KB). −Migration-Code muss gepflegt werden.
**Abgelehnt:** nur Snapshot ohne Log (kein Replay), IndexedDB (überdimensioniert für <10 KB), Server-seitige Saves (ADR-001).

### ADR-006 — Svelte statt React
**Kontext:** Eine Bildschirm-App (Dashboard + Karten + News-Feed), kleines Team.
**Entscheidung:** Svelte 5 + Vite; Gauges/Heatmap als CSS/SVG ohne UI-Framework.
**Konsequenzen:** +wenig Boilerplate, +kleinster Bundle, +reaktiver Store passt zu „Snapshot ersetzen“-Pattern. −kle Ökosystem, weniger Recruiter-known. Bei Team-Präferenz React ist der Kern davon unberührt (ADR-002) — Swap ist ein reiner Adapter-Change.
**Abgelehnt:** React (mehr Code für eine App mit einem Screen), Vanilla+Lit (Heatmap-Reaktivität von Hand), UI-Framework (Material et al.) — Dashboard ist individuell, Framework-Macht nichts.

### ADR-007 — Multiplayer ist nachrüstbar gehalten, wird aber jetzt nicht gebaut
**Kontext:** Multiplayer ist Non-Goal im Konzept (§10), aber später möglich gewünscht. Diskrete Jahres-Turns bedeuten: kein Echtzeit-Latenzproblem.
**Entscheidung:** Der Kern bleibt multiplayer-kompatibel ohne zusätzliche Kosten: `tick` kennt keinen „Single-Player“-Annahme-Zweig, Actions sind reine Daten-Nachrichten, GameState ist vollständig serialisierbar, RNG liegt im State. Multiplayer wird später als **server-authoritative lockstep** gebaut: Server sammelt die Actions aller Spieler pro Jahr, führt `tick` deterministisch aus, sendet den <10 KB-Snapshot zurück. Keine Rollback-Netcode nötig (Turns sind diskret).
**Konsequenzen:** +Nachrüstung bleibt ein Adapter-Change (Server läuft dasselbe pure `tick` in Node); +State-Sync ist trivial (<10 KB pro Turn). −Ab jetzt nötig: Backend-Betrieb, Accounts, Matchmaking, Versions-Handshake zwischen Client und Server. −Spieler-sichtbare State-Filter nötig (versteckte Events/Nachrichten für kompetitive Modi — der Snapshot ist heute voll sichtbar). −Timeout-Policy nötig: ein nicht antwortender Spieler blockiert den Turn → Timer + AI-Übernahme oder Turn-Verfall.
**Abgelehnt:** Peer-to-Peer-Host (ein Spieler ist Host — einfach, aber der Host kann cheaten und fällt als Single Point of Failure aus), Echtzeit-Sync (verletzt das diskrete-Turn-Requirement), Multiplayer jetzt zu bauen (Non-Goal; Kosten ohne Requirement — die Hooks kosten jetzt nichts).

### ADR-008 — Zufriedenheits-Delta-Trace im Snapshot (G1)
**Kontext:** Tooltip „Wer ist sauer und warum?“ (M5) braucht die 2 wichtigsten Gründe je Gruppe. Die UI darf sie nicht selbst berechnen (ADR-002: UI sieht nur Snapshots).
**Entscheidung:** Der `tick` protokolliert pro Gruppe die Top-2 Delta-Beiträge mit Ursprungs-ID (Regel/Event/Indikator) im Snapshot-Feld `zufriedenheits_trace`. UI rendert den Trace nur.
**Konsequenzen:** +Gründe sind deterministisch und Teil des Golden-Hash; +Tooltip ist reine Render-Arbeit. +~1 KB Kosten — die Snapshot-Grenze wird von <10 KB auf ~12 KB gelockert (für localStorage trivial). −Der Trace muss bei jeder neuen Effekt-Kategorie gepflegt werden (Vergessens-Risiko: neue Effekte ohne Trace → Tooltip zeigt falsche Gründe); Gegenmittel: Invariant-Test „Trace-Summe ≈ Delta“.
**Abgelehnt:** UI-seitige Berechnung aus Rohwerten (zweite Logik, Drift gegen Kern), vollständige Delta-Historie (zu groß, Übersicht verloren).

### ADR-009 — Vorhersage-Dry-Run mit RNG-Fork (G2)
**Kontext:** Vorhersage = Dry-Run von `tick`, aber ein normaler Dry-Run würde den RNG-Stream des echten States verbrauchen → der echte Turn driftet.
**Entscheidung:** Dry-Run auf einer State-Kopie mit eigenem **RNG-Fork**: ein Substream aus `hash(seed, spieljahr, action-folge)`. Der echte Stream wird nicht verbraucht; die Kopie wird vollständig verworfen — nichts sickert in den echten Turn. Event-Effekte werden als Wahrscheinlichkeiten/Erwartungswerte angezeigt, nie als Würfelwert.
**Konsequenzen:** +Der echte Turn bleibt deterministisch (Seed + Log unverändert). +Vorhersage ist für alle deterministischen Effekte exakt. −Für Zufalls-Events ist die Vorhersage probabilistisch (angezeigt als %, nicht als Ergebnis) — bewusste UX-Grenze. −Der Fork muss stabil hashen (Änderung am Fork-Hash ändert Vorhersagen → Golden-Test fängt es).
**Abgelehnt:** Vorhersage ohne Events (zu dünn — Krisen sind der Kern des Spiels), „Vorhersage einfrieren“ (Würfelwert vorher anzeigen und garantieren zerstört die RNG-Semantik), separate Vorhersage-Engine (Drift, zweite Wahrheit).

### ADR-010 — Kartenauswahl-Heuristik im Tick (G12, amendiert durch G13/G14/G15)
**Kontext:** „3–5 Karten pro Jahr“ braucht eine Auswahlregel; der Katalog (~30 Karten) soll nicht vollständig angezeigt werden (§7 Übersicht). Ralfs revidiertes §12 definiert Slot-Zahlen nach Lage (Standard 3, 4 bei Legitimität ≥ 70, 2 bei PK ≤ 2) und erzwungene Agenda-Slots (Koalitionsdruck, G8/G10). Untergrenze 2 vs. „3–5" war offen (G13).
**Entscheidung (G13 → Option 1):** Slot-Zahl pro Jahr = **2–5**, bestimmt durch Konzept §12: Standard 3, 4 bei Legitimität ≥ 70, 2 bei politischem Kapital ≤ 2. **Agenda-Slots werden vor dem Sampling besetzt und zählen in die Slot-Zahl.** Während des Koalitionsdrucks feuert das Populismus-Fenster nicht (G14) — damit ist die Agenda-Last maximal 2 Slots; ohne diese Unterdrückung könnte bei Band 2 eine Agenda-Last von 3 Slots entstehen und der Tick seine eigene Slot-Regel nicht erfüllen. Agenda-Karten kosten je 1 politisches Kapital (G15), damit Zwangslots bei PK ≤ 2 spielbar bleiben. Die restlichen Slots werden gefüllt durch: Filter der Karten, deren constraints erfüllt sind; Gewicht = Σ Gewicht unzufriedener Gruppen, die die Karte adressiert, + (100 − Indikatorlevel) der adressierten Indikatoren − Cooldown-Nähe; gewichtetes seedgesteuertes Sampling. **Coverage-Boden (slot-begrenzt):** mindestens eine Karte je unzufriedener Gruppe, solange die Slots reichen; wenn weniger Slots als unzufriedene Gruppen, werden die höchst-gewichteten unzufriedenen Gruppen priorisiert (Agenda-Slots gelten bereits als Coverage für die Gruppen, die sie adressieren).
**Konsequenzen:** +Karten zeigen immer „die Lage der Nation“, nicht den ganzen Katalog → Übersicht bleibt. +Das 2-Slot-Jahr ist der **bewusste PK-Engpass**: schwaches Jahr = sichtbare Handlungsfähigkeitskrise (soll im News-Feed auftauchen, „die Regierung ist schwach“). −Der volle Coverage-Boden „eine Karte je unzufriedener Gruppe" ist bei 2 Slots mathematisch unmöglich — er ist jetzt slot-begrenzt; die US-M3-06-Akzeptanz muss diese Kappung verwenden, sonst widerspricht sie US-M3-15. −Spieler können nicht strategisch aus dem vollen Katalog planen — bewusster Tradeoff gegen Kartenshoppen. −Heuristik selbst ist balanzierbar und muss im AutoSim-Harness mitgetestet werden (eine zu enge Heuristik erzeugt tote Jahre; das 2-Slot-Jahr darf nicht zum Unplayable-Jahr werden).
**Abgelehnt:** Untergrenze 3 mit Agenda-Auffüllung bei PK ≤ 2 (G13 Option 2 — macht den PK-Engpass in schwachen Jahren wirkungslos; PK ist laut §4 das Spielziel, nicht eine Dekoration), volle Katalog-Anzeige (Zahlenfriedhof, verstößt §7), reine Zufallsauswahl (Lage ignoriert → frustrierende Jahre), freie Wahl durch den Spieler (M3-Akzeptanz „keine dominante Strategie“ verletzt).

### ADR-011 — Wahl-Machtcheck als typisierte wahlregel-Content, nicht als injizierte Funktion (PO-Ruling D15)
**Kontext:** Tyrdor baut den Wahl-Machtcheck interim als extern injizierte `wahlPruefen`-Funktion im `tick`. Das Spec-M1-Gate verlangt: zwei Konstitutionen erzeugen nachweislich verschiedene Wahlmechanik und Event-Wahrscheinlichkeiten. M4 verlangt, dass Mod-Packs Wahlregeln als Dateien liefern können.
**Entscheidung (Option 2):** `wahlregel` ist **Content-Datum** im Regel-Register (Zod-Schema, ADR-003 — der Typ ist dort bereits definiert). Der Kern interpretiert einen **closed Variant-Set**: `praesidentialwahl` (fixed Term + Stimmen-Schwelle), `parlamentmehrheit` (aus Fraktionen abgeleitet, G3), `putsch-roll` (Parameter: Elite-/Militärzufriedenheit, Legitimität). Neue Mechanik = neuer typisierter Variant in Kern + Schema (ADR-004-Grenze: keine String-DSL, kein Interpreter), **nicht** eine injizierte Funktion.
**Konsequenzen:** +Replays bleiben über alle Build-Versionen deterministisch: Seed + Action-Log + Regeln reichen — eine injizierte Funktion wäre eine versteckte Abhängigkeit, die den Replay nur mit dem exakten Adapter-Build reproduzierbar macht. +Das M1-Gate ist rein in Content prüfbar: zwei Konstitutions-Packs, derselbe Kern. +M4: Wahlmechanik ist als YAML-Pack-Datei lieferbar. −Der Kern muss die closed Variants implementieren (etwas mehr Kern-Logik). −Neue Wahlmechanik erfordert Code (bewusste ADR-004-Grenze).
**Implizit schon festgelegt:** ADR-002 verbietet Verhalten vom Adapter in den Kern (Kern importiert nichts aus `app`/`cli`; CLI und Web müssen mit identischen Regeln identische Tick-Ergebnisse liefern — injizierte Funktionen können über Adapter divergieren und machen den Golden-Hash adapter-abhängig). ADR-003 setzt das Regel-Register als Quelle der Wahrheit. Damit ist Option 1 nicht ADR-002-konform, auch wenn die Signatur „content-agnostisch" wirkt — der Content liegt im Adapter, nicht im Kern.
**Abgelehnt:** injizierte `wahlPruefen`-Funktion (versteckte Abhängigkeit bricht Cross-Adapter-Determinismus und Replay-Portabilität; M4 ohne Code unmöglich; M1-Gate würde Adapter-Code testen statt Content), generische Wahl-DSL mit Interpreter (verstößt ADR-004).

---

## 7. Build-Order (was zuerst gebaut wird, um am schnellsten zu lernen)

1. **core: state + tick + rng + invariant.ts** + vitest-Golden-Test (Seed → Hash). *Lernt: ist die Zufriedenheitsformel balancierbar?*
2. **cli-Runner (M0-Akzeptanz):** ganzes Spiel im Terminal durchspielbar + AutoSim-Harness (4 Naiv-Strategien × 20 Seeds × 30 Jahre, seit D18 inkl. overspend). *Balance-Fundament vor Content — wie im Konzept priorisiert.*
3. **Zod-Regel-Schema + TS-Content:** Konstitutionen (M1), Event-Ketten Pandemie/Finanzkrise/Radikalisierung (M2), Katalog ~30 Karten (M3).
4. **YAML-Loader + Beispiel-Pack (M4):** neuer Pack mit Gruppe+Decision ohne Code-Änderung, atomische Validierung.
5. **Svelte-Dashboard (M5):** Snapshots konsumieren, Vorhersage per Dry-Run-Tick, News-Feed, Heatmap, Tooltips.
6. **Persistence + Score + Schwierigkeit + Audio (M6):** localStorage-Saves mit Migration, Export/Import.

**Warum diese Reihenfolge:** Der Balance-Harness (2) ist das schnellste Lernen — die Zufriedenheitsformel ist das Risiko des Konzepts (§11), und jede Regel danach wird gegen den Harness getestet statt gegen Vermutungen. UI kommt bewusst zuletzt: sie ist ein Adapter und kann später parallel gebaut werden.

---

## 8. Architektur-Tradeoffs in einem Satz

- **Kein Backend:** keine Accounts/Cloud-Save/Multiplayer gekauft — dafür null Betrieb, null Kosten, offline.
- **Pure-Funktion-Kern:** kein Streaming/Echtzeit möglich — dafür Determinismus, Replays, Vorhersage-Korrektur, Testbarkeit.
- **Zod-Schema als Regel-Quelle:** Modder sind an das Schema gebunden (versionspflichtig) — dafür eine Wahrheit, kein Runtime-Crash durch Packs.
- **Typisierte Prädikate statt DSL-Interpreter:** Modder können keine eigenen Bedingungen erfinden — dafür kein Arbitrary-Code, predictable Balance.
- **Svelte:** kleineres Ökosystem — dafür weniger Code auf einem Screen.

---

*Diagramm: architektur-diagram.html · Änderungen an Annahmen bitte als neue Constraints ins Register eintragen.*
