import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  importsAusQuelle,
  istVerbotenesPaket,
  pruefeCoreIsolation,
  pruefeRepoIsolation,
} from './check-core-isolation.mjs';

describe('core-Isolation (NFR-004, ADR-002)', () => {
  it('erkennt eine app/cli-Abhängigkeit in core/package.json', () => {
    const packageJson = { dependencies: { '@staatslenker/cli': '*' } };
    const verletzungen = pruefeCoreIsolation(packageJson, [], '/repo/core');
    expect(verletzungen).toHaveLength(1);
    expect(verletzungen[0]).toContain('@staatslenker/cli');
  });

  it('erkennt einen Import aus app oder cli in einer Kern-Datei', () => {
    const verletzungen = pruefeCoreIsolation(
      { dependencies: {} },
      [
        { pfad: '@staatslenker/app', quelle: 'src/tick.ts' },
        { pfad: '../../cli/src/render.ts', quelle: 'src/save.ts' },
      ],
      '/repo/core',
    );
    expect(verletzungen).toHaveLength(2);
    expect(verletzungen.some((v) => v.includes('@staatslenker/app'))).toBe(true);
    expect(verletzungen.some((v) => v.includes('außerhalb von core'))).toBe(true);
  });

  it('lässt einen sauberen Kern durch', () => {
    const verletzungen = pruefeCoreIsolation(
      { dependencies: { zod: '^3.0.0' }, devDependencies: { vitest: '^5.0.0' } },
      [{ pfad: './state.js', quelle: 'src/tick.ts' }],
      '/repo/core',
    );
    expect(verletzungen).toEqual([]);
  });

  it('isolatedModules: Import-Specifiers werden aus der Quelle gelesen', () => {
    const quelle =
      "import { a } from './x.js';\nimport type { b } from '@staatslenker/core';\nconst c = await import('../cli/y.js');";
    expect(importsAusQuelle(quelle)).toEqual(['./x.js', '@staatslenker/core', '../cli/y.js']);
    expect(istVerbotenesPaket('@staatslenker/app')).toBe(true);
    expect(istVerbotenesPaket('zod')).toBe(false);
  });

  it('das reale Repo ist aktuell isoliert', () => {
    expect(pruefeRepoIsolation(process.cwd())).toEqual([]);
  });

  it('ein Unterordner in core/src wird rekursiv gescannt (Lens-Follow-up zu PR #1)', () => {
    const wurzel = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'iso-drift-'));
    mkdirSync(join(wurzel, 'core', 'src', 'content'), { recursive: true });
    writeFileSync(join(wurzel, 'core', 'package.json'), JSON.stringify({ dependencies: {} }));
    writeFileSync(
      join(wurzel, 'core', 'src', 'content', 'deep.ts'),
      "import { render } from '../../../cli/src/render.ts';\nexport const x = render;",
    );
    writeFileSync(
      join(wurzel, 'core', 'src', 'sauber.ts'),
      "import './state.js';\nexport const y = 1;",
    );

    const verletzungen = pruefeRepoIsolation(wurzel);
    expect(verletzungen).toHaveLength(1);
    expect(verletzungen[0]).toContain('src/content/deep.ts');
    rmSync(wurzel, { recursive: true, force: true });
  });
});
