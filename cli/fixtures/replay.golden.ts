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
  { jahr: 10, hash: '034ff0902d08c0dc365eb9dbb5f93362e36616b008695f6cc93601dc7e7c2d3d' },
  { jahr: 20, hash: '84a671a930a630039e11364757e9e2acf6b894af6d56a0a932e655af24365041' },
  { jahr: 30, hash: '6630729217ab4e53f879d33773003c7c6c5d6d7629238f7f551d6b799d2a5ec1' },
  { jahr: 40, hash: '2461b0a9f574c3b0195e9f699146577034cf92bcc59cb5710ed1b037d35d3fbd' },
  { jahr: 50, hash: '6fb65fcbfb7dda71ae5a049b1c1f5330fd914bb1496eb04d332d68b780590d11' },
  { jahr: 60, hash: '4e4e28fd7a83058c6d23f6d78c749e712257887529e26c80dba38b5694bc6755' },
  { jahr: 70, hash: 'de0638e7dba197010da8cded3d36a6a875be5045946c8e23ee99fa09be6b013e' },
  { jahr: 80, hash: '312c893cae19effb1e24959b41c4934d517a137cff3e791e7e7b711dbaf815b5' },
  { jahr: 90, hash: '70f937071b9ee39d9c7c8f4cdd731720adcb0b8b51765eaf918186b1c7b7feca' },
  { jahr: 100, hash: 'e35ac47a9eb5f53f60e67dbc8411bb687ee9b1d170447c1440b8cdcb6fbc346a' },
];

export const GOLDEN_REPLAY_FINAL_HASH =
  'e35ac47a9eb5f53f60e67dbc8411bb687ee9b1d170447c1440b8cdcb6fbc346a';

/** Jahre mit gekuerzte_be > 0 (FR-041): die überallokierten Muster. */
export const GOLDEN_REPLAY_GEKUERZTE_JAHRE: readonly number[] = [
  11, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 55, 59, 63, 67, 71, 75, 79, 83, 87, 91, 95, 99,
];

/** Nach §3a schreibt eine Budget-Allokation kein Gedächtnis-Entry — der Wert muss 0 sein. */
export const GOLDEN_REPLAY_BESCHLUSS_ANZAHL = 0;

/** Der erste verlorene Machtcheck (FR-013); der Replay läuft bewusst weiter bis 100. */
export const GOLDEN_REPLAY_NIEDERLAGE_JAHR = 6;
