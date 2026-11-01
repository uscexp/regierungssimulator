/**
 * Golden-Replay-Fixture (US-M0-16): Seed 424242, 100 Jahre, Schwierigkeit
 * "normal", feste Action-Folge aus cli/src/replay.ts (vier Muster im Wechsel).
 * Erzeugt von `node scripts/generate-replay-golden.mjs` gegen den gebauten Kern — nicht von Hand
 * geändert. Der Vergleich in cli/src/replay.test.ts ist der Determinismus-Guard (FR-004, NFR-001).
 */
export const GOLDEN_REPLAY_SEED = 424242;
export const GOLDEN_REPLAY_JAHRE = 100;
export const GOLDEN_REPLAY_SCHWIERIGKEIT = 'normal';
export const GOLDEN_REPLAY_CHECKINTERVAL = 10;

/** Hash alle 10 Jahre — eine Regression lokalisiert sich über diesen Track. */
export const GOLDEN_REPLAY_CHECKPOINTS: readonly {
  readonly jahr: number;
  readonly hash: string;
}[] = [
  { jahr: 10, hash: '40c300bf9e0a15285039a870b217c43750f583ab89638d36da8f49baec421edc' },
  { jahr: 20, hash: 'cb3357d13c79989f2435bb4381f0c3a87b5364729517018d0016dce6074b9dc7' },
  { jahr: 30, hash: 'ae981718eac3097f2003a887ad79684509081b15c4fe2f1a91a9fd9ab542cf3e' },
  { jahr: 40, hash: '86724740641f3f8aa59923fca2472b3b58ca52f8c1783465cf227e29362a2c54' },
  { jahr: 50, hash: '9002d838d9f2662ad405992fdb42eceace5de00f509eb240318c20120b6a6e6e' },
  { jahr: 60, hash: 'accfc698c62594192261e301c5fa73ebc68145384a7895660cd02cf704552380' },
  { jahr: 70, hash: '895406ea96730cf2b256e64891f20fcfaafd02339cb930b543a0e48e29432bcc' },
  { jahr: 80, hash: '8a3f8ce57135353cb6d6ae4d55a9bdce46299ae299c5bf9809135fd5adbb6e81' },
  { jahr: 90, hash: '9221bf2d83b2eab41526d4d4d566d59352cc4432d71f981d1a197175ae40d46a' },
  { jahr: 100, hash: '5fb41a48a57fb8678d94b9ea32f99b871a32195eef7373a0820c3f2249610256' },
];

export const GOLDEN_REPLAY_FINAL_HASH =
  '5fb41a48a57fb8678d94b9ea32f99b871a32195eef7373a0820c3f2249610256';

/** Jahre mit gekuerzte_be > 0 (FR-041): die überallokierten Muster. */
export const GOLDEN_REPLAY_GEKUERZTE_JAHRE: readonly number[] = [
  11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95, 99,
];

/** Nach §3a schreibt eine Budget-Allokation kein Gedächtnis-Entry — der Wert muss 0 sein. */
export const GOLDEN_REPLAY_BESCHLUSS_ANZAHL = 0;

/** Der erste verlorene Machtcheck (FR-013); der Replay läuft bewusst weiter bis 100. */
export const GOLDEN_REPLAY_NIEDERLAGE_JAHR = 6;
