/**
 * La migration des **identités** : ce qu'`INSERT IGNORE` ne sait pas dire.
 *
 * ## Le trou
 *
 * Le catalogue vit en base parce qu'il s'édite depuis l'administration. Il
 * s'amorce depuis `dex.js` au démarrage, en `INSERT IGNORE` — et c'est
 * volontaire : sans ça, chaque redémarrage écraserait les corrections faites à
 * l'écran.
 *
 * La conséquence est rarement énoncée : **changer le nom, l'histoire ou le cri
 * d'une carte existante dans le code ne change rien du tout.** La ligne est
 * déjà là, `IGNORE` l'ignore, et le jeu continue d'afficher l'ancienne version.
 * Sans erreur, sans trace.
 *
 * C'est arrivé à dix-neuf cartes d'un coup : `G1` est devenu Le Faux Départ,
 * `X7` Celui Qui Reste, `BG27` Les Neuf Minutes… dans le code. En base, ils
 * gardaient leur ancien nom, celui qui doublonnait un autre personnage — c'est
 *-à-dire exactement ce qu'on venait de corriger.
 *
 * ## Ce que ce script produit
 *
 * `sql/identites.sql` : un `UPDATE` par carte dont le texte a changé, et rien
 * d'autre. Pas de réécriture en masse — une commande qui recopierait tout le
 * catalogue par-dessus la base effacerait les corrections faites à l'écran
 * d'administration, qui sont la raison d'être de cette table.
 *
 * Il compare donc **le code et la base**, et n'écrit que les écarts. Sans base
 * joignable, il ne produit rien plutôt que de deviner.
 *
 * Usage :
 *   DATABASE_URL=… node scripts/fanzzy-identites.mjs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEX } from '../src/shared/fanzzy/dex.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manque : ce script compare le code à une base réelle.');
  process.exit(1);
}

const mysql = await import('mysql2/promise');
const c = await mysql.createConnection(url);
const [rows] = await c.query('SELECT id, nom, histoire, cri, publie FROM fanzzy');
await c.end();

/** Une colonne JSON revient en objet ou en chaîne selon le pilote. */
const lire = (v) => (typeof v === 'string' ? JSON.parse(v || 'null') : v);

const parId = new Map(rows.map((r) => [r.id, r]));
const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

const ecarts = [];
for (const f of DEX) {
  const b = parId.get(f.id);
  if (!b) continue;                      // absente : l'amorçage la posera
  const cri = lire(b.cri) ?? {};
  const champs = [];
  if (b.nom !== f.nom) champs.push(['nom', f.nom]);
  if ((b.histoire ?? null) !== (f.histoire ?? null)) champs.push(['histoire', f.histoire ?? null]);
  /* Le cri est un objet : on ne compare que ce qui se lit à l'écran et ce qui
     décide du mini-jeu. Comparer le JSON entier signalerait un écart à chaque
     changement d'ordre des clés. */
  if (cri.label !== f.cri?.label || cri.gest !== f.cri?.gest
      || Number(cri.power) !== Number(f.cri?.power)) {
    champs.push(['cri', JSON.stringify(f.cri)]);
  }
  if (champs.length) ecarts.push({ id: f.id, nom: f.nom, champs });
}

if (!ecarts.length) {
  console.log('Aucun écart entre le code et la base : rien à migrer.');
  process.exit(0);
}

const L = [
  '-- Les identités que l’amorçage ne sait pas corriger.',
  '--',
  '-- Le catalogue s’amorce en `INSERT IGNORE` depuis `dex.js`, pour ne pas',
  '-- écraser les corrections faites à l’écran d’administration. La contrepartie',
  '-- est rarement énoncée : **changer le nom, l’histoire ou le cri d’une carte',
  '-- existante dans le code ne change rien.** La ligne est déjà là, `IGNORE`',
  '-- l’ignore, et le jeu affiche toujours l’ancienne version — sans erreur et',
  '-- sans trace.',
  '--',
  `-- Ce fichier rattrape ${ecarts.length} carte(s), et elles seulement. Une`,
  '-- réécriture en masse du catalogue effacerait les corrections faites à',
  '-- l’écran, qui sont la raison d’être de cette table.',
  '--',
  '-- Produit par scripts/fanzzy-identites.mjs en comparant le code à la base.',
  '-- Ne pas modifier à la main.',
  '',
  'START TRANSACTION;',
  '',
];
for (const e of ecarts) {
  L.push(`-- ${e.id} — ${e.nom}`);
  L.push(`UPDATE fanzzy SET ${e.champs.map(([k, v]) => `${k} = ${q(v)}`).join(', ')}`);
  L.push(`  WHERE id = ${q(e.id)};`);
  L.push('');
}
L.push('COMMIT;');
L.push('');

const sortie = path.join(RACINE, 'sql', 'identites.sql');
writeFileSync(sortie, L.join('\n'));
console.log(`sql/identites.sql — ${ecarts.length} carte(s) :`);
for (const e of ecarts) {
  console.log(`  ${e.id.padEnd(7)} ${e.champs.map(([k]) => k).join(', ').padEnd(22)} ${e.nom}`);
}
