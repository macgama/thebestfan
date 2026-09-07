/**
 * Régénère la liste `ILLUSTRES` de `public/fanzzy-art.js`.
 *
 * Un identifiant n'y entre que s'il a **ses six fichiers** et **une fiche au
 * catalogue**. Tenue à la main, cette liste finit toujours par promettre une
 * image absente — ou par oublier une image présente, ce qui est plus discret
 * et tout aussi ennuyeux : le Fanzzy garde sa silhouette alors qu'il est
 * dessiné.
 *
 * À relancer après chaque passage de scripts/fanzzy-images.mjs.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEX } from '../src/shared/fanzzy/dex.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DOSSIER = path.join(RACINE, 'public', 'img', 'fanzzy');

const complet = (id) => ['', '-buste'].every((variante) =>
  ['.avif', '.webp', '.png'].every((ext) =>
    existsSync(path.join(DOSSIER, `${id}${variante}${ext}`))));

const ids = DEX.map((f) => f.id).filter(complet);
const sans = DEX.map((f) => f.id).filter((id) => !complet(id));

const lignes = [];
for (let i = 0; i < ids.length; i += 8) {
  lignes.push('    ' + ids.slice(i, i + 8).map((x) => `'${x}'`).join(', ') + ',');
}

const F = path.join(RACINE, 'public', 'fanzzy-art.js');
let s = readFileSync(F, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const DEBUT = '  const ILLUSTRES = new Set([';
const FIN = '  ]);';
const i = s.indexOf(DEBUT);
const j = s.indexOf(FIN, i);
if (i < 0 || j < 0) throw new Error('bornes de ILLUSTRES introuvables dans fanzzy-art.js');

s = s.slice(0, i) + [DEBUT, ...lignes].join(NL) + NL + s.slice(j);
writeFileSync(F, s, 'utf8');

console.log(`ILLUSTRES : ${ids.length} Fanzzy dessinés sur ${DEX.length}`);
if (sans.length) console.log(`Encore sans illustration (${sans.length}) : ${sans.join(', ')}`);
