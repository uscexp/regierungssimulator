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
  { jahr: 10, hash: '07a56d1b6ee86a9e0b037d87302304d7b51c1232d8b2dd06a505ea078d4b2c61' },
  { jahr: 20, hash: '70e7d0385a687da0d2f417cf9151382569e2347c4380ddf4b6c83f00f11c0cf4' },
  { jahr: 30, hash: '620e62e742e0c8b295c55458db47c8ca822ef5ac7d819e5765b39eb354c5c46d' },
  { jahr: 40, hash: 'beb79139731c7a823153670367bc842ceeadabebaf46a1538d504918a49fb3c1' },
  { jahr: 50, hash: '0ef5ad382045d6a322d4a51767c2a5bb8881c0bd29cb45cd291eab48063fb2ef' },
  { jahr: 60, hash: '1cc76875a4113ba5ca0e82f9cbec722dc50437a5339def68e998772b38f3a1ec' },
  { jahr: 70, hash: 'a5b64219f008806ff7bd9a4b43f42b1e6de71d4aae59986cc88879dd63133a2d' },
  { jahr: 80, hash: '640ee99f1be588f7a060ae116d522c00a9fee145eb4f563d6100940332fa3adb' },
  { jahr: 90, hash: '0581b66341d6476d7d7907591700430c9fe3c3cb0e396afaad6b8dd8bdf3ab9f' },
  { jahr: 100, hash: 'f202571d8408c0556787eae3d721719d3086fa62cea2e721dee06ccd6ebf5f02' },
];

export const GOLDEN_REPLAY_FINAL_HASH =
  'f202571d8408c0556787eae3d721719d3086fa62cea2e721dee06ccd6ebf5f02';

/** Jahre mit gekuerzte_be > 0 (FR-041): die überallokierten Muster. */
export const GOLDEN_REPLAY_GEKUERZTE_JAHRE: readonly number[] = [
  11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95, 99,
];

/** Nach §3a schreibt eine Budget-Allokation kein Gedächtnis-Entry — der Wert muss 0 sein. */
export const GOLDEN_REPLAY_BESCHLUSS_ANZAHL = 0;

/** Der erste verlorene Machtcheck (FR-013); der Replay läuft bewusst weiter bis 100. */
export const GOLDEN_REPLAY_NIEDERLAGE_JAHR = 6;
