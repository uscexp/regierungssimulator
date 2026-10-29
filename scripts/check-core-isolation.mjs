/**
 * Kern-Isolation-Check (NFR-004 / ADR-002 / US-M0-01).
 *
 * `core/` darf nichts aus `app/` oder `cli/` importieren und keine Abhängigkeit auf diese
 * Pakete haben. Der Kern ist eine pure Funktion und muss headless testbar bleiben — deshalb
 * wird die Richtung der Abhängigkeiten maschinell geprüft, nicht nur beim Review gelesen.
 *
 * Two layers:
 *  1. core/package.json: dependency names pointing at @staatslenker/app or @staatslenker/cli
 *  2. core/src/*.ts: import specifiers pointing at those packages or outside core/
 *
 * Exit code 1 + violation list on any violation. Used as `npm run check:core-isolation` and in CI.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const VERBOTENE_PAKETE = ['@staatslenker/app', '@staatslenker/cli'];
const ABHANGIGKEITSFELDER = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

/** @param {string} paketName true, wenn das Paket ein Adapter ist (app/cli), kein Kern */
export function istVerbotenesPaket(paketName) {
  return VERBOTENE_PAKETE.includes(paketName);
}

/**
 * Prüfungen ohne Dateizugriff — rein, damit der Test kaputte Fixtures prüfen kann.
 * @param {Record<string, unknown>} packageJson
 * @param {Array<{ pfad: string; quelle: string }>} imports  quelle ist relativ zu coreWurzel (z. B. "src/tick.ts")
 * @param {string} coreWurzel Verzeichnis, innerhalb dessen relative Imports bleiben müssen
 * @returns {string[]} Verletzungen, leer wenn sauber
 */
export function pruefeCoreIsolation(packageJson, imports, coreWurzel) {
  const verletzungen = [];

  for (const feld of ABHANGIGKEITSFELDER) {
    const deps = packageJson[feld];
    if (deps && typeof deps === 'object') {
      for (const name of Object.keys(deps)) {
        if (istVerbotenesPaket(name)) {
          verletzungen.push(`core/package.json ${feld}: Abhängigkeit "${name}"`);
        }
      }
    }
  }

  for (const { pfad, quelle } of imports) {
    if (istVerbotenesPaket(pfad)) {
      verletzungen.push(`core/${quelle}: importiert "${pfad}"`);
      continue;
    }
    if (pfad.startsWith('.')) {
      const ziel = resolve(join(coreWurzel, quelle, '..'), pfad);
      const relativ = relative(coreWurzel, ziel);
      if (relativ.startsWith('..') || relativ === '') {
        verletzungen.push(`core/${quelle}: relativer Import "${pfad}" liegt außerhalb von core/`);
      }
    }
  }

  return verletzungen;
}

/** Sammelt alle Import-Specifiers aus einer TS-Datei (import, export-from, dynamisch). */
export function importsAusQuelle(quelle) {
  const pattern = /(?:from|import)\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const found = [];
  let match;
  while ((match = pattern.exec(quelle)) !== null) {
    found.push(match[1] ?? match[2]);
  }
  return found.filter(Boolean);
}

/** Alle .ts-Dateien unter einem Verzeichnis, rekursiv, ohne node_modules/dist. */
function dateienUnter(verzeichnis) {
  const fund = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    if (eintrag.name === 'node_modules' || eintrag.name === 'dist') continue;
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) fund.push(...dateienUnter(pfad));
    else if (eintrag.name.endsWith('.ts')) fund.push(pfad);
  }
  return fund;
}

/** Prüft das echte Repo: core/package.json + alle .ts-Dateien unter core/src (rekursiv). */
export function pruefeRepoIsolation(repoWurzel) {
  const coreWurzel = join(repoWurzel, 'core');
  const packageJsonPf = join(coreWurzel, 'package.json');
  if (!existsSync(packageJsonPf)) {
    return [`core/package.json fehlt: ${packageJsonPf}`];
  }
  const packageJson = JSON.parse(readFileSync(packageJsonPf, 'utf8'));

  const srcDir = join(coreWurzel, 'src');
  const imports = [];
  if (existsSync(srcDir)) {
    // Rekursiv: sobald core/ Unterordner hat (z. B. src/content/, src/save/), darf ein Import
    // aus einem Unterordner nicht ungeprüft bleiben — ein flacher readdirSync wäre eine still
    // übersehene Drift (Lens-Follow-up zu PR #1).
    for (const datei of dateienUnter(srcDir)) {
      const quelle = relative(srcDir, datei).replaceAll('\\', '/');
      for (const pfad of importsAusQuelle(readFileSync(datei, 'utf8'))) {
        imports.push({ pfad, quelle: `src/${quelle}` });
      }
    }
  }

  return pruefeCoreIsolation(packageJson, imports, coreWurzel);
}

if (process.argv[1] && resolve(process.argv[1]).endsWith('check-core-isolation.mjs')) {
  const repoWurzel = resolve(process.cwd());
  const verletzungen = pruefeRepoIsolation(repoWurzel);
  if (verletzungen.length > 0) {
    console.error('core-Isolation verletzt (NFR-004, ADR-002):');
    for (const v of verletzungen) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log('core-Isolation ok: core hat keine Abhängigkeit zu app/ oder cli/');
}
