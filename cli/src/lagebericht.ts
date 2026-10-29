/**
 * @staatslenker/cli lagebericht — der textuelle Lagebericht pro Turn (US-M0-15, FR-041).
 *
 * Der Bericht erzählt die Lage in Sätzen, er tabelliert nicht: Jahr, Indikatoren mit Bewegung
 * seit dem letzten Turn, die Zufriedenheit der Gruppen mit der schwächsten, die Finanzlage in BE,
 * Politisches Kapital, Legitimität, Radikalisierung, das Entscheidungsgedächtnis und die Gründe,
 * warum eine Gruppe sauer ist (ADR-008). Ein verlorener Machtcheck wird als Spielende gemeldet
 * (US-M0-12, FR-013).
 *
 * Der Bericht rechnet nichts Neues: alle Zahlen kommen aus dem Snapshot oder aus den
 * core-Funktionen (`einnahmenBe`, `zinsenBe`, `gewichteteZufriedenheit`, `schwächsteGruppe`).
 * Render-Arbeit, kein Kern-Zweig (ADR-002).
 */
import { einnahmenBe, zinsenBe } from '@staatslenker/core/budget';
import type { NewsEintrag, TickErgebnis, TickRegeln } from '@staatslenker/core/tick';
import type { GameState } from '@staatslenker/core/state';
import { schwächsteGruppe } from '@staatslenker/core/wahl';
import { gewichteteZufriedenheit } from '@staatslenker/core/zufriedenheit';

/** Der Steueranker des M0-Packs ist `flat` (§1, K2) — der Bericht nutzt dasselbe Modell wie der Tick. */
const STEUERMODELL_M0 = 'flat' as const;

/** Runden für die Anzeige nur — die Spielwerte bleiben ungerundet (FR-003: der Kern entscheidet). */
function fmt(wert: number): string {
  return (Math.round(wert * 10) / 10).toFixed(1);
}

function fmtInt(wert: number): string {
  return String(Math.round(wert));
}

function deltaText(delta: number): string {
  if (delta === 0) return '';
  return delta > 0 ? ` (+${fmt(delta)})` : ` (−${fmt(Math.abs(delta))})`;
}

/** Der Lagebericht eines Jahres. `vorher` ist der Snapshot des letzten Turn — ohne ihn gibt es keine Bewegung. */
export interface LageberichtOptionen {
  readonly vorher?: GameState;
  /** Der Tick dieses Jahrs — liefert Unterhalt, Events und den Machtcheck (US-M0-11/12). */
  readonly ergebnis?: TickErgebnis;
  /** Das Jahr, in dem der Tick gereicht hat (vor der Jahresincrement) — der Machtcheck-Zeiler nennt es. */
  readonly wahl_jahr?: number;
  /** BE, die wegen des Schuldenlimits nicht ausgegeben werden konnten (§6) — der Tick meldet das im Budget-Schritt. */
  readonly gekuerzte_be?: number;
  /** Die Allokationen des Turns in BE — der Bericht nennt sie, weil die Basis-Entscheidung eine Allokation ist (PO-Ruling zu US-M0-14). */
  readonly allokation?: Readonly<Record<string, number>>;
}

export function lagebericht(
  state: GameState,
  regeln: TickRegeln,
  optionen: LageberichtOptionen = {},
): string {
  const zeilen: string[] = [];
  const vorher = optionen.vorher;
  const schwierigkeit = regeln.schwierigkeit;

  zeilen.push(
    `Jahr ${state.jahr} — ${Object.keys(state.indikatoren).length} Indikatoren, ${state.gruppen.length} Gruppen.`,
  );

  // Indikatoren: Level plus Bewegung seit dem letzten Snapshot.
  const indikatorZeilen = Object.entries(state.indikatoren).map(([tag, level]) => {
    const delta = vorher === undefined ? 0 : level - (vorher.indikatoren[tag] ?? 0);
    return `${tag} ${fmt(level)}${deltaText(delta)}`;
  });
  zeilen.push(`Lage: ${indikatorZeilen.join(', ')}.`);

  // Zufriedenheit: gewichtete Ø und die schwächste Gruppe — der Unruhe-Gate der Wahl prüft sie.
  const gewichtete = gewichteteZufriedenheit(state.gruppen);
  const schwächste = schwächsteGruppe(state.gruppen);
  zeilen.push(
    `Zufriedenheit: gewichtete Ø ${fmt(gewichtete)}` +
      (schwächste === undefined
        ? '.'
        : `, schwächste Gruppe ${schwächste.tag} ${fmt(schwächste.zufriedenheit)}.`),
  );

  // Die Gründe, warum eine Gruppe sauer ist (ADR-008) — der Tick schreibt sie, hier wird nur gerendert.
  const sauer = Object.entries(state.zufriedenheits_trace)
    .filter(([, gründe]) => gründe.length > 0)
    .map(
      ([tag, gründe]) =>
        `${tag} (${gründe.map((g) => `${g.grund_id} ${fmt(g.delta)}`).join(', ')})`,
    );
  if (sauer.length > 0) {
    zeilen.push(`Gründe: ${sauer.join('; ')}.`);
  } else {
    // PO-Ruling zu diesem Fund: der Kern rechnet die Spuren am Jahrsanfang aus den alten Leveln,
    // die Bewegung läuft danach — alle Delta-Spuren sind 0. In M0 ist das eine bekannte Limitation
    // (M1-Ticket: Spuren nach der Bewegung), der Bericht sagt es dem Spieler statt nichts zu zeigen.
    zeilen.push(
      'Zufriedenheits-Gründe: aktuell nicht verfügbar (M0-Limitation, M1-Ticket nach ADR-008).',
    );
  }

  // Finanzlage in BE: Einnahmen, Unterhalt, Spielraum, Schulden — dieselben core-Funktionen wie der Tick.
  const einnahmen = einnahmenBe(
    state.indikatoren.wirtschaft ?? 0,
    regeln.steuerfaktor[STEUERMODELL_M0],
    schwierigkeit,
  );
  const zinsen = zinsenBe(state.schulden, schwierigkeit);
  const unterhalt = optionen.ergebnis?.unterhalt_be ?? 0;
  const spielraum = einnahmen - zinsen - unterhalt;
  zeilen.push(
    `Finanzen: ${fmt(einnahmen)} BE Einnahmen, ${fmt(unterhalt)} BE Unterhalt, ${fmt(zinsen)} BE Zinsen, ` +
      `Spielraum ${fmt(spielraum)} BE, Schulden ${fmt(state.schulden)} BE (Limit ${fmtInt(schwierigkeit.schuldenlimit)}).`,
  );
  if ((optionen.gekuerzte_be ?? 0) > 0) {
    // PO-Ruling zu US-M0-15: die Kürzung ist für den Spieler sichtbar, nicht still (FR-041).
    zeilen.push(
      `Budget-Allokation auf verfügbaren Spielraum gekürzt: ${fmt(optionen.gekuerzte_be!)} BE gekürzt (§1/§6).`,
    );
  }

  zeilen.push(
    `Macht: ${fmt(state.politisches_kapital)} politisches Kapital, Legitimität ${fmtInt(state.legitimitaet)}, ` +
      `Radikalisierung ${fmtInt(state.radikalisierung)}.`,
  );

  // Das Entscheidungsgedächtnis (FR-006/FR-009) — die Beschlüsse, die noch wirken. Nur Beschlüsse
  // mit Wirkung kommen hierher; eine Budget-Allokation ist kein Gedächtnis-Entry (Pädu-Ruling zu
  // PR #20) und wird unten als Allokation des Turns gerendert.
  const aktive = state.beschlüsse.filter((b) => b.wirkt_bis_jahr >= state.jahr);
  if (aktive.length > 0) {
    zeilen.push(
      `Beschlüsse (${aktive.length}): ${aktive.map((b) => `${b.regel_id} bis Jahr ${b.wirkt_bis_jahr}`).join(', ')}.`,
    );
  }

  // Die Allokationen des Turns (PO-Ruling zu US-M0-14): die Basis-Entscheidung ist eine
  // Budget-Allokation, ihre BE sind die Entscheidung — der Bericht nennt sie pro Turn.
  if (optionen.allokation !== undefined) {
    const teile = Object.entries(optionen.allokation)
      .filter(([, be]) => be > 0)
      .map(([tag, be]) => `${tag} +${Number.isInteger(be) ? String(be) : fmt(be)} BE`);
    zeilen.push(
      teile.length > 0
        ? `Beschlüsse dieses Jahres: ${teile.join(', ')}.`
        : 'Beschlüsse dieses Jahres: kein Budget verteilt.',
    );
  }

  // News aus den Events des Ticks — Text aus dem Pack (G11), nicht erfunden.
  const news: readonly NewsEintrag[] = optionen.ergebnis?.news ?? [];
  for (const eintrag of news) zeilen.push(`News: ${eintrag.text}`);

  // Der Machtcheck (FR-013): gewonnen oder verloren — die Ursache ist die Regel-Id des Packs.
  const wahl = optionen.ergebnis?.wahl;
  if (wahl !== undefined) {
    zeilen.push(
      `Machtcheck Jahr ${optionen.wahl_jahr ?? state.jahr}: ${wahl.gewonnen ? 'gewonnen' : 'VERLOREN'} — ${wahl.grund_id} ` +
        `(Ø ${fmt(wahl.gewichtete_zufriedenheit)}, schwächste ${wahl.schwächste_gruppe} ${fmt(schwächste?.zufriedenheit ?? 0)}).`,
    );
  } else {
    // Kein Machtcheck in diesem Jahr — der nächste ist aus dem Zyklus des Packs ablesbar (US-M0-12).
    const intervall = regeln.wahl_intervall ?? 6;
    const naechster = Math.ceil((state.jahr + 1) / intervall) * intervall;
    zeilen.push(`Nächster Machtcheck: Jahr ${naechster} (Zyklus ${intervall} Jahre).`);
  }

  if (state.wahl_niederlage !== undefined) {
    zeilen.push(
      `Spiel beendet: Machtcheck Jahr ${state.wahl_niederlage.jahr} verloren (${state.wahl_niederlage.grund_id}).`,
    );
  }

  return zeilen.join('\n');
}
