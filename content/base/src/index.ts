/**
 * @staatslenker/content-base — Basis-Regelsatz als TS-Objekte, validiert gegen dasselbe Zod-Schema
 * wie YAML-Mod-Packs (ADR-003, US-M0-13).
 *
 * Dieses Modul liefert Daten und Schema, keine Mechanik: der Kern rechnet (core/tick), der Adapter
 * (cli) baut aus diesem Pack den Regelsatz für den Tick. Die Zahlen stammen ausschließlich aus
 * docs/balance-werte.md — siehe basis-pack.ts für die Quellen je Wert. Das Indikator-Set und die
 * Gruppen sind seit PO D10 und dem Ruling zu §3 entschieden (8 Gruppen, §1-Startbild).
 */
export * from './schema.js';
export * from './basis-pack.js';
