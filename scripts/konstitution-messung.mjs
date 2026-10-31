/**
 * Der Balance-Nachlauf der Konstitutions-Baseline (US-M1-05).
 *
 * Erzeugt den Report, den die AC instanziiert: dieselbe Seed, einmal das vollständige Setup, einmal
 * dasselbe Setup ohne Grundrechte — eine Zahl je Gruppe. Kein Golden-Fixture: die AC ist ein Vergleich,
 * keine bitgleich zu pinning Kurve (Trix-Ruling). Die M0-Fixtures bleiben unverändert, weil der Harness
 * ohne Setup spielt.
 *
 * Aufruf: npm run balance:konstitution (nach dem Build)
 */
import { konstitutionsMessung, messungAlsReport } from '@staatslenker/cli/konstitution-messung';

const messung = konstitutionsMessung(424242);
console.log(messungAlsReport(messung));
