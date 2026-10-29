/**
 * Schema-Tests für den Regel-Content (US-M0-13, AC: "Schema validiert alle Basis-Regeln fehlerfrei;
 * ein absichtlich kaputes Pack wird mit dem Grund abgelehnt"). Das Schema ist dieselbe Wahrheit, die
 * ein YAML-Mod-Pack in M4 validiert (ADR-003) — ein Fehler muss den Pfad nennen, nicht nur "invalid".
 */
import { describe, expect, it } from 'vitest';

import { BASIS_PACK, basisPackSchema, validierePack } from '@staatslenker/content-base';

/** Ein kaputes Pack: nur ein Schwellenwert ohne abgesenkte Wirkung (FR-002 — kein Default 0). */
const kaputesPack = {
  ...BASIS_PACK,
  indikator_regeln: [
    {
      regel_id: 'regel:kaputt',
      tag: 'bildung',
      verschleiß: 2,
      budget_wirkung: 0.6,
      diminishing_at: 65,
    },
  ],
};

/** Ein Minimal-Pack, wie ein Modder es in M4 liefert (ADR-003: dasselbe Schema für TS und YAML). */
function einModPack() {
  const schwierigkeit = {
    verschleiß_multiplikator: 1,
    pk_regeneration: 1,
    event_wahrscheinlichkeit: 1,
    schuldenlimit: 100,
    zinsfaktor: 0.08,
    budget_zuschuss: 0,
  };
  const last = { niedrig: 2, flat: 4, progressiv: 3, hoch: 8 };
  return {
    indikator_regeln: [
      { regel_id: 'regel:bildung', tag: 'bildung', verschleiß: 2, budget_wirkung: 0.6 },
    ],
    gruppen: [
      { tag: 'arbeitnehmer', zufriedenheit: 40, bevölkerungsanteil: 100, gewichte: { bildung: 1 } },
    ],
    start_indikatoren: { bildung: 40 },
    steuerfaktor: { niedrig: 0.6, flat: 0.8, progressiv: 1.0, hoch: 1.2 },
    steuerlast: { arbeitnehmer: last },
    schwierigkeit_packs: { leicht: schwierigkeit, normal: schwierigkeit, schwer: schwierigkeit },
    news_vorlagen: { sparen: 'Austerität: Schulden beim Limit.' },
    entscheidungen: [
      {
        regel_id: 'entscheidung:bildung',
        label: 'Bildung',
        beschreibung: 'Budget in Bildung',
        indikator: 'bildung',
        pk_kosten: 0,
      },
    ],
  };
}

describe('Basis-Pack validiert gegen das Schema', () => {
  it('validiert den ganzen Basis-Pack fehlerfrei (Dev und Produktion)', () => {
    expect(basisPackSchema.safeParse(BASIS_PACK).success).toBe(true);
    expect(validierePack(BASIS_PACK, 'dev').fehlerfrei).toBe(true);
    expect(validierePack(BASIS_PACK, 'produktion').fehlerfrei).toBe(true);
  });

  it('lehnt ein kaputes Pack mit dem Grund ab, nicht mit "invalid"', () => {
    const ergebnis = validierePack(kaputesPack, 'produktion');
    expect(ergebnis.fehlerfrei).toBe(false);
    expect(ergebnis.grund).toContain('diminishing_at und diminishing_wirkung sind ein Paar');
  });

  it('wirft im Dev-Modus mit dem Grund, läuft im Produktionsmodus weiter (FR-002-Konvention)', () => {
    expect(() => validierePack(kaputesPack, 'dev')).toThrow(TypeError);
    expect(() => validierePack(kaputesPack, 'dev')).toThrow(/diminishing_wirkung/);
    expect(validierePack(kaputesPack, 'produktion').fehlerfrei).toBe(false);
  });
});

describe('Schema-Grenzen (Struktur und Grenzen, keine Balance-Zahlen)', () => {
  const schwierigkeit = {
    verschleiß_multiplikator: 1,
    pk_regeneration: 1,
    event_wahrscheinlichkeit: 1,
    schuldenlimit: 100,
    zinsfaktor: 0.08,
    budget_zuschuss: 0,
  };
  const entscheidung = {
    regel_id: 'entscheidung:bildung',
    label: 'Bildung',
    beschreibung: 'Budget in Bildung',
    indikator: 'bildung',
    pk_kosten: 0,
  };
  const pack = (über: Record<string, unknown>) => ({ ...BASIS_PACK, ...über });
  /** Ersetzt die Bildungs-Regel an ihrem Platz — die anderen Regeln bleiben, damit die
   * Pack-Invarianten (Entscheidungen, Start-Indikatoren) nicht nebenbei brechen. */
  const mitRegel = (über: Record<string, unknown>) =>
    pack({
      indikator_regeln: BASIS_PACK.indikator_regeln.map((r) =>
        r.tag === 'bildung' ? { ...r, ...über } : r,
      ),
    });

  it('verlangt das diminishing-Paar in beide Richtungen', () => {
    // Der Merge entfernt den Partner: ein Feld allein ist kein gültiger Pack.
    expect(
      basisPackSchema.safeParse(mitRegel({ diminishing_at: 65, diminishing_wirkung: undefined }))
        .success,
    ).toBe(false);
    expect(
      basisPackSchema.safeParse(mitRegel({ diminishing_at: undefined, diminishing_wirkung: 0.25 }))
        .success,
    ).toBe(false);
    expect(
      basisPackSchema.safeParse(mitRegel({ diminishing_at: 65, diminishing_wirkung: 0.25 }))
        .success,
    ).toBe(true);
  });

  it('lehnt nicht-endliche und negative Regelwerte ab', () => {
    expect(basisPackSchema.safeParse(mitRegel({ verschleiß: -1 })).success).toBe(false);
    expect(basisPackSchema.safeParse(mitRegel({ budget_wirkung: Number.NaN })).success).toBe(false);
    expect(
      basisPackSchema.safeParse(mitRegel({ verschleiß: Number.POSITIVE_INFINITY })).success,
    ).toBe(false);
    expect(basisPackSchema.safeParse(mitRegel({ diminishing_wirkung: -0.2 })).success).toBe(false);
  });

  it('begrenzt Levels auf 0..100 und Tags auf kleine Tags', () => {
    expect(basisPackSchema.safeParse(pack({ start_indikatoren: { bildung: 120 } })).success).toBe(
      false,
    );
    expect(basisPackSchema.safeParse(pack({ start_indikatoren: { bildung: -5 } })).success).toBe(
      false,
    );
    expect(
      basisPackSchema.safeParse(pack({ start_indikatoren: { bildung: Number.NaN } })).success,
    ).toBe(false);
    expect(basisPackSchema.safeParse(mitRegel({ tag: '' })).success).toBe(false);
    expect(basisPackSchema.safeParse(mitRegel({ tag: 'Bildung' })).success).toBe(false);
  });

  it('lehnt unbekannte Felder ab (strict) — ein Tippfehler ist ein Fehler, kein ignorierter Feldname', () => {
    expect(basisPackSchema.safeParse(mitRegel({ verschleiss: 2 })).success).toBe(false);
    expect(
      basisPackSchema.safeParse(pack({ news_vorlagen: { sparen: '', other: 'text' } })).success,
    ).toBe(false);
  });

  it('prüft Gruppen-Invarianten: Anteile Σ 100, Gewichte Σ 1, eindeutige Tags', () => {
    const gruppen = BASIS_PACK.gruppen;
    expect(basisPackSchema.safeParse(pack({ gruppen: gruppen.slice(0, 7) })).success).toBe(false); // Σ ≠ 100
    expect(basisPackSchema.safeParse(pack({ gruppen: [...gruppen, gruppen[0]!] })).success).toBe(
      false,
    ); // doppeltes Tag
    const gewichteKaputt = gruppen.map((g) => ({
      ...g,
      gewichte: { ...g.gewichte, wirtschaft: (g.gewichte.wirtschaft ?? 0) + 0.5 },
    }));
    expect(basisPackSchema.safeParse(pack({ gruppen: gewichteKaputt })).success).toBe(false);
    expect(basisPackSchema.safeParse(pack({ gruppen: [] })).success).toBe(false);
    // Ein Minimal-Pack (ein Modder mit einer Gruppe) muss dasselbe Schema bestehen.
    expect(basisPackSchema.safeParse(einModPack()).success).toBe(true);
  });

  it('verlangt die drei Schwierigkeit-Packs mit positiven Werten (Zuschuss darf negativ sein)', () => {
    const ohneLeicht = {
      ...BASIS_PACK,
      schwierigkeit_packs: { normal: schwierigkeit, schwer: schwierigkeit },
    };
    expect(basisPackSchema.safeParse(ohneLeicht).success).toBe(false);
    const nullMultiplikator = {
      ...BASIS_PACK,
      schwierigkeit_packs: {
        leicht: { ...schwierigkeit, verschleiß_multiplikator: 0 },
        normal: schwierigkeit,
        schwer: schwierigkeit,
      },
    };
    expect(basisPackSchema.safeParse(nullMultiplikator).success).toBe(false);
    const negativerZuschuss = {
      ...BASIS_PACK,
      schwierigkeit_packs: {
        leicht: schwierigkeit,
        normal: schwierigkeit,
        schwer: { ...schwierigkeit, budget_zuschuss: -10 },
      },
    };
    expect(basisPackSchema.safeParse(negativerZuschuss).success).toBe(true);
  });

  it('begrenzt PK-Kosten auf 0..3 und verlangt eindeutige, budgetbare Entscheidungen', () => {
    expect(
      basisPackSchema.safeParse(pack({ entscheidungen: [{ ...entscheidung, pk_kosten: 4 }] }))
        .success,
    ).toBe(false);
    expect(
      basisPackSchema.safeParse(pack({ entscheidungen: [{ ...entscheidung, pk_kosten: -1 }] }))
        .success,
    ).toBe(false);
    expect(basisPackSchema.safeParse(pack({ entscheidungen: [] })).success).toBe(false);
    expect(
      basisPackSchema.safeParse(pack({ entscheidungen: [entscheidung, entscheidung] })).success,
    ).toBe(false);
    // Recht & Freiheit sind nicht budgetbar (§2: "nur Gesetze") — eine Entscheidung darauf ist ein Fehler.
    expect(
      basisPackSchema.safeParse(pack({ entscheidungen: [{ ...entscheidung, indikator: 'recht' }] }))
        .success,
    ).toBe(false);
  });

  it('verlangt passende Tags für Start-Indikatoren und Steuerlast', () => {
    expect(
      basisPackSchema.safeParse(
        pack({ start_indikatoren: { ...BASIS_PACK.start_indikatoren, unbekannt: 40 } }),
      ).success,
    ).toBe(false);
    const unbekannteGruppe = { niedrig: 2, flat: 4, progressiv: 3, hoch: 8 };
    expect(
      basisPackSchema.safeParse(
        pack({ steuerlast: { ...BASIS_PACK.steuerlast, unbekannte_gruppe: unbekannteGruppe } }),
      ).success,
    ).toBe(false);
  });
});
