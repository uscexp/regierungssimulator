/**
 * Golden-Replay-Fixture (US-M0-16): Seed 424242, 100 Jahre, Schwierigkeit
 * "normal", feste Action-Folge aus cli/src/replay.ts (vier Muster im Wechsel).
 * Erzeugt von `node scripts/generate-replay-golden.mjs` gegen den gebauten Kern — nicht von Hand
 * geändert. Der Vergleich in cli/src/replay.test.ts ist der Determinismus-Guard (FR-004, NFR-001).
 */
export const GOLDEN_REPLAY_SEED = 424242;
export const GOLDEN_REPLAY_JAHRE = 100;
export const GOLDEN_REPLAY_SCHWIERIGKEIT = "normal";
export const GOLDEN_REPLAY_CHECKINTERVAL = 10;

/** Hash alle 10 Jahre — eine Regression lokalisiert sich über diesen Track. */
export const GOLDEN_REPLAY_CHECKPOINTS: readonly { readonly jahr: number; readonly hash: string }[] = [
  { jahr: 10, hash: "abbc7a8d11822542f877304e9121015ff57bb0fd4471e85f6eb28c9c0ff8e264" },
  { jahr: 20, hash: "8db48e967695fe3c9aeecfadbd092a01d4c6ea3a5aefe940e8fa5bd070827b84" },
  { jahr: 30, hash: "8f32ecac7c1a5fd99ae041b2880499d970252e3d54d23e0dfb007ddf6296da5c" },
  { jahr: 40, hash: "235ad0af9698c9ac86007bcc255e5c441dbbe987ccb1c49638f2253e02e6925e" },
  { jahr: 50, hash: "6bbaba67648e3cb019037894a94cee6d426fad97f9e7c45a0949bb2ad59ad843" },
  { jahr: 60, hash: "5028937db63223fffa372ee6e03ef88eb0d00237a14d32a4ebc850113734aa54" },
  { jahr: 70, hash: "f9e080e56c7dc374e4c4049a7930cc5750404190199ec6d18a5551dfe0155ff9" },
  { jahr: 80, hash: "68e32d29af439d109eb3ecb028b4bc48eddf00eb67703ac3b0c4eb1febac6a1a" },
  { jahr: 90, hash: "242779b39ef7905385741a536dff633f5e39bcb5046741ef3fe3d54487ceea56" },
  { jahr: 100, hash: "1189408cec1393c3408257f30f3c4a0f7a8f4786b60755b058d7f8abe78d0d23" },
];

export const GOLDEN_REPLAY_FINAL_HASH = "1189408cec1393c3408257f30f3c4a0f7a8f4786b60755b058d7f8abe78d0d23";

/** Jahre mit gekuerzte_be > 0 (FR-041): die überallokierten Muster. */
export const GOLDEN_REPLAY_GEKUERZTE_JAHRE: readonly number[] = [11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95, 99];

/** Nach §3a schreibt eine Budget-Allokation kein Gedächtnis-Entry — der Wert muss 0 sein. */
export const GOLDEN_REPLAY_BESCHLUSS_ANZAHL = 0;

/** Der erste verlorene Machtcheck (FR-013); der Replay läuft bewusst weiter bis 100. */
export const GOLDEN_REPLAY_NIEDERLAGE_JAHR = 6;
