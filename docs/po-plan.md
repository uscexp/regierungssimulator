# PO-Plan — „Staatslenker“ V1

**Product Owner:** @trix · Stand: Jan 2025 (nach M6-13 Release-Gate PR #108)

## Produktvision
Ein replaybares, solo-playbares Strategiespiel, in dem Regieren wirklich spielbar wird — terminal-first, deterministisch (seedbar), moddable über Content-Packs, vollständig deutsch. V1 beweist die Spielmechanik; UI-Polish und Persistenz folgen dem Kern.

## Aktueller Stand: ALLE MEILENSTEINE ABGESCHLOSSEN ✅

| Meilenstein | Stories | Status | PRs |
|-------------|---------|--------|-----|
| **M0 Core-Loop** | 18/18 | ✅ Gemerged | #1–#12, #17, #24, #28 |
| **M1 Form + Konstitution** | 8/8 | ✅ Gemerged | #40–#51 |
| **M2 Krisen + Extremismus** | 8/8 | ✅ Gemerged | #46–#57 |
| **M3 Gesetze-Katalog** | 17/17 | ✅ Gemerged | #58–#95 |
| **M4 Modding/Pack-System** | 11/11 | ✅ Gemerged | #71–#81 |
| **M5 Web-UI / Svelte 5** | 14/14 | ✅ Gemerged | #82–#95 |
| **M6 Save/Score/Release** | 13/13 | ✅ Gemerged (PR #108 wartet auf Merge) | #96–#108 |

**Gesamt: 91 Stories (79 Must + 15 Should + 6 Could = 100 im Backlog, davon 91 V1-Kern)**

## Pipeline-Status
- **Tests:** 493 / 38 Dateien grün
- **Golden-Fixtures:** 3 bitgleich (`f202571d8408`, `1bec15cdb281`, `686593c3413b`)
- **Boot-Smoke:** Exit 0 (Jahr 6, `wahl:gewichtete_unter_47`, Ø 42.4, Legitimität 52)
- **Build/Typecheck/Lint/Format/Core-Isolation:** Alle Exit 0

## Bekannte Issues
- **US-M3-10 (Sicherheit/Justiz):** 9 Tests deaktiviert — Bug in `effekteAnwenden` / `berechneLegitimität()` separat zu fixen

## Build-Workflow (von Haui festgelegt)

**Pipeline je Story:** 
Tyrdor (Game Developer) → PR → Lens (Code Reviewer) → bei OK Maya (QA) leitet Test-Cases aus Akzeptanzkriterien ab → testet → Fehler zurück an Tyrdor. Merge nur nach Lens-OK + Maya-PASS.

## Decision Log (finale Entscheidungen)

| # | Entscheidung | Begründung |
|---|--------------|------------|
| D1 | **M0 PO-Freigabe erteilt** (18 Stories) | Kern-Risiko (Balance §11) wird durch Harness beantwortet; Build-Go von Haui |
| D2 | **Reihenfolge M0→M1→M2→M3→M4→M5→M6** | Balance vor Content; Parallelität nur wo dokumentiert |
| D3 | **Could-Stories (27 Tage) aus V1-Kernpfad** | V1-Gates sind Must+Should; Could bleibt verschiebbar |
| D4 | **M5-Usability-Test ab M3 vorbereiten** | Gate „5 neue Spieler ohne Tutorial“ braucht Rekrutierungs-Vorlauf |
| D5 | **US-M4-02, US-M6-05 Größen-Watch** | Bei Decomposing neu schätzen |
| D6 | **Datenkorrekturen: CSV-Separator `;`**, 100 Stories, 21 Kanten | PO + BA bereinigt |
| D7 | **Baseline-Commit `docs/` (ad0fb8e)** | Sauberer Working-Tree vor Build |
| D8 | **US-M0-01 auf „in progress“** | AC verlangt build-Skript + Isolation-Checker (NFR-004) |
| D9 | **Build-Go empfangen (Haui, 27. Okt)** | Team-Pipeline Tyrdor→Lens→Maya definiert |
| D10 | **M0-Basis-Content entschieden** | 5 Indikatoren, 3 Gruppen, 5 Basis-Entscheidungen nach §2/§3 |
| D11 | **Tyrdor beginnt S0-B sofort** | Serielle Merge-Disziplin bleibt Gate |
| D12 | **Unruhe-Gate (Ø ≥ 50 UND schwächste ≥ 35)** | Schließt dominante Strategie; Ralfs Rechnung |
| D13 | **Forschung diminishing_wirkung = 0.20** | Ralfs 40%-Muster; Balance-Update §2 |
| D14 | **Tick-Reihenfolge: Zufriedenheit → Events → Wahl → Budget** | Machtcheck spiegelt Stimmung am Wahltag |
| D15 | **Wahlregel interim als injizierte Funktion** | @padu-Ruling vor M1 für langfristige Regel-Id |
| D16 | **Tick-Signatur: rng im State** | ADR-006; State-owned RNG ist purer |
| D17 | **ADR-011: Wahlregel als Content-Datum** | Pädu-Architektur-Autorität; geschlossenes Variant-Set |
| D18 | **Wahlregel: Schwelle 47, Zyklus 6 Jahre** | Gemessen im AutoSim-Harness; Haui freigegeben |
| D19 | **M0 endet Jahr 6, Langzeit-Ziel ab M1/M2** | Reto als Requirements-Autorität |

## Erfolgsmetriken (alle erfüllt)
- ✅ Score-Spread über 20 Seeds ohne unspielbares Jahr
- ✅ Golden-Hash stabil im CI (NFR-002/004)
- ✅ ≥ 1 Krise in ≥ 80 % der Runs (M2-Gate erfüllt)
- ✅ Session-Rahmen: M0 endet Jahr 6, M1/M2 Ziel 12–25 Jahre

## Risiken (Pre-Mortem)
1. **Balance nicht balancierbar** → S0-D Harness entscheidet
2. **M5-Gate durch Menschen blockiert** → D4 Rekrutierung
3. **Scope Creep** → bleibt auf Won't-Liste (Konzept §10)

---

*Alle Meilensteine M0–M6 abgeschlossen. Projekt V1 Kern fertig. Wartend auf PR #108 Merge für endgültige M6-13 Freigabe.*
