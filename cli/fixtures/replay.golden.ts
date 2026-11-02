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
  { jahr: 10, hash: "b08d0e80a09c1afa2e0c65ecb35308d82c7993dff3bec468955e8739f1326a1d" },
  { jahr: 20, hash: "e9a3c2d1907ee2bfe15d9aa2859680ae442ec7d4cbcfac8a3782edbe36dbe1a2" },
  { jahr: 30, hash: "a29eef296ce09011c49449954bea1fc2acf1543ba4ce77db8cd1f31c0d34c1e3" },
  { jahr: 40, hash: "6e73203d457163c7582e2cb8cfb378a9d3f98bfe2e715f1e3e05429d178732d9" },
  { jahr: 50, hash: "41f2e03520a5044e70801da1e9bdad583b6824dc9c1ec88683e91004d2b9581c" },
  { jahr: 60, hash: "123fa08514e8abbb06fbd87f4d10a08e86165c5647c61e2b2620574772f80a04" },
  { jahr: 70, hash: "3a1150c116abcb6d6ff3e27d5e8f80ce3c03f62c94250571e44ca6f6c1435048" },
  { jahr: 80, hash: "1c279cda603b61d649ddb97029519dd91079b67d7f54e6a52117f6517ac5fe7f" },
  { jahr: 90, hash: "92b34dc50bd1776d3ad4bebba2a159e3ca7d5cd7547c884ce78bebd1884a91e8" },
  { jahr: 100, hash: "fa1958d106e6bb4c38b69705a9ac501c1bc630c52aae4bf8950c907d4b74b45d" },
];

export const GOLDEN_REPLAY_FINAL_HASH = "fa1958d106e6bb4c38b69705a9ac501c1bc630c52aae4bf8950c907d4b74b45d";

/** Jahre mit gekuerzte_be > 0 (FR-041): die überallokierten Muster. */
export const GOLDEN_REPLAY_GEKUERZTE_JAHRE: readonly number[] = [11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95, 99];

/** Nach §3a schreibt eine Budget-Allokation kein Gedächtnis-Entry — der Wert muss 0 sein. */
export const GOLDEN_REPLAY_BESCHLUSS_ANZAHL = 0;

/** Der erste verlorene Machtcheck (FR-013); der Replay läuft bewusst weiter bis 100. */
export const GOLDEN_REPLAY_NIEDERLAGE_JAHR = 6;
