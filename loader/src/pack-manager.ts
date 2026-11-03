/**
 * @staatslenker/loader — Pack-Verwaltung (US-M4-07).
 *
 * Verwaltet geladene YAML-Packs mit aktiv/inaktiv-Status.
 * Ein Paket kann geladen, aber inaktiv sein (wird nicht angewendet).
 * Nur aktive Packs fließen in den Regelsatz ein.
 */

import { z } from 'zod';
import { loadPack, type PackLoadOutcome, type PackSchema } from './index.js';

/** Ein geladenes Pack mit Aktivierungs-Status. */
export interface GeladenesPack {
  name: string;
  pack: z.infer<typeof PackSchema>;
  aktiv: boolean;
  datei: string;
}

/** Ergebnis des Pack-Managers. */
export interface PackManagerErgebnis {
  erfolgreich: boolean;
  meldung: string;
  pack?: GeladenesPack;
}

/**
 * Pack-Manager: verwaltet geladene YAML-Packs mit aktiv/inaktiv-Status.
 * Das Spiel läuft weiter, auch wenn ein Pack nicht geladen werden kann.
 */
export class PackManager {
  private packs: Map<string, GeladenesPack> = new Map();

  /**
   * Lädt ein YAML-Pack und fügt es als inaktiv hinzu.
   * Bei Fehler wird der Fehler zurückgegeben, aber keine Ausnahme geworfen.
   */
  ladePack(yamlInhalt: string, datei: string): PackManagerErgebnis {
    const ergebnis = loadPack(yamlInhalt, datei);

    if ('error' in ergebnis) {
      return {
        erfolgreich: false,
        meldung: `Pack-Laden fehlgeschlagen: ${ergebnis.error}${
          ergebnis.zeile ? ` (Zeile ${ergebnis.zeile})` : ''
        }${ergebnis.datei ? ` (${ergebnis.datei})` : ''}`,
      };
    }

    const pack = ergebnis.pack;
    if (this.packs.has(pack.name)) {
      return {
        erfolgreich: false,
        meldung: `Pack mit Name "${pack.name}" ist bereits geladen.`,
      };
    }

    this.packs.set(pack.name, {
      name: pack.name,
      pack,
      aktiv: false,
      datei,
    });

    return {
      erfolgreich: true,
      meldung: `Pack "${pack.name}" geladen (inaktiv).`,
      pack: { ...this.packs.get(pack.name)! },
    };
  }

  /**
   * Aktiviert ein geladenes Pack.
   */
  aktivierePack(name: string): PackManagerErgebnis {
    const pack = this.packs.get(name);
    if (!pack) {
      return {
        erfolgreich: false,
        meldung: `Pack "${name}" nicht gefunden.`,
      };
    }

    pack.aktiv = true;
    return {
      erfolgreich: true,
      meldung: `Pack "${name}" aktiviert.`,
      pack: { ...pack },
    };
  }

  /**
   * Deaktiviert ein geladenes Pack.
   */
  deaktivierePack(name: string): PackManagerErgebnis {
    const pack = this.packs.get(name);
    if (!pack) {
      return {
        erfolgreich: false,
        meldung: `Pack "${name}" nicht gefunden.`,
      };
    }

    pack.aktiv = false;
    return {
      erfolgreich: true,
      meldung: `Pack "${name}" deaktiviert.`,
      pack: { ...pack },
    };
  }

  /**
   * Listet alle geladenen Packs mit ihrem Status.
   */
  listePacks(): GeladenesPack[] {
    return [...this.packs.values()].map((p) => ({ ...p }));
  }

  /**
   * Gibt nur aktive Packs zurück.
   */
  aktivePacks(): GeladenesPack[] {
    return this.listePacks().filter((p) => p.aktiv);
  }

  /**
   * Gibt die Anzahl aller geladenen Packs zurück.
   */
  anzahlPacks(): number {
    return this.packs.size;
  }

  /**
   * Setzt den Pack-Manager zurück (für Tests).
   */
  reset(): void {
    this.packs.clear();
  }

  /**
   * Gibt die Anzahl aktiver Packs zurück.
   */
  anzahlAktivePacks(): number {
    return this.aktivePacks().length;
  }

  /**
   * Prüft, ob ein Pack mit dem Namen existiert.
   */
  hatPack(name: string): boolean {
    return this.packs.has(name);
  }
}

/** Singleton-Instanz des Pack-Managers für den CLI. */
export const packManager = new PackManager();
