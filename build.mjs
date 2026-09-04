/**
 * Construction du projet.
 * Le serveur et les pages restent en JavaScript simple ; seul le duel est en
 * TypeScript, et c'est esbuild qui le transforme en deux fichiers :
 *   dist/duel-server.mjs   importé par server.js
 *   public/duel.bundle.js  chargé par la page de duel
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/server/duel/entry.ts'],
  outfile: 'dist/duel-server.mjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external: ['socket.io', 'mysql2', 'mysql2/promise'],
  logLevel: 'info',
});

await build({
  entryPoints: ['src/client/duel/entry.ts'],
  outfile: 'public/duel.bundle.js',
  bundle: true,
  platform: 'browser',
  target: ['es2022'],
  format: 'iife',
  globalName: 'TBF',
  minify: true,
  loader: { '.json': 'json' },
  logLevel: 'info',
});

console.log('construction terminée');
