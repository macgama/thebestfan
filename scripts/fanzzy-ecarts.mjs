/**
 * Ce que la base contient et que le code ne dit pas — et l'inverse.
 *
 * ## Pourquoi ce script existe
 *
 * Le catalogue vit **en base**, parce qu'il s'édite depuis l'administration.
 * Il s'amorce depuis `dex.js` en `INSERT IGNORE`, et c'est voulu : sans ça,
 * chaque redémarrage écraserait les corrections faites à l'écran.
 *
 * La conséquence est qu'une base peut **diverger du code sans que rien ne le
 * signale**. Trois façons, toutes déjà vues sur ce projet :
 *
 *   — une carte renommée dans le code garde son ancien identifiant en base, et
 *     le nouvel identifiant s'ajoute à côté : **le personnage existe deux
 *     fois**, une fois dessiné, une fois en silhouette ;
 *   — une carte retirée du code reste en base et continue d'être distribuée ;
 *   — une carte ajoutée au code n'arrive jamais si l'amorçage n'a pas retourné.
 *
 * Aucune de ces trois-là ne lève d'erreur. Elles se voient à un seul endroit :
 * un compteur qui n'est pas celui qu'on attendait. « X / 73 » quand le code
 * annonce soixante personnages, c'est ce script qu'il fallait lancer.
 *
 * Il ne modifie rien. Il lit la base, la compare au code, et dit ce qui diffère.
 *
 * Usage :
 *   DATABASE_URL=mysql://user:pass@hote:port/base node scripts/fanzzy-ecarts.mjs
 */
import mysql from 'mysql2/promise';
import { DEX, SETS } from '../src/shared/fanzzy/dex.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant.\n'
    + 'Usage : DATABASE_URL=mysql://… node scripts/fanzzy-ecarts.mjs');
  process.exit(1);
}

const c = await mysql.createConnection(url);
const [lignes] = await c.query(
  'SELECT id, nom, set_id, stage, rar, evo, publie FROM fanzzy');

/* Les séries qu'une saison lancée a ouvertes. C'est sur elles que se compte la
   progression du joueur : sans ça, on compare un compteur à un catalogue qu'il
   ne compte pas. */
/* Les saisons sont additives : l'union des séries de toutes celles qui sont
   lancées — `lancee_a` non nul. `series` est une colonne JSON, pas une table
   de liaison ; la première version de ce script interrogeait une table qui
   n'existe pas et retombait en silence sur « aucune restriction ». Elle aurait
   donc annoncé 256 personnages sur une base qui n'en ouvre que 73, sans rien
   signaler. D'où l'absence de `catch` muet ici : si la lecture échoue, on veut
   le savoir. */
let ouvertes = null;
const [saisons] = await c.query(
  'SELECT numero, nom, series FROM saisons WHERE lancee_a IS NOT NULL ORDER BY numero');
if (saisons.length) {
  ouvertes = new Set();
  for (const s of saisons) {
    const l = typeof s.series === 'string' ? JSON.parse(s.series || '[]') : (s.series ?? []);
    for (const id of l) ouvertes.add(id);
  }
  /* Une saison lancée qui n'ouvre aucune série ne restreint rien — et « rien »
     ici veut dire « tout », pas « zéro ». Le serveur applique la même règle. */
  if (!ouvertes.size) ouvertes = null;
}
await c.end();

/** Un âge est une racine s'il n'est la suite de personne — la règle du serveur. */
function racines(liste) {
  const suivi = new Set(liste.map((f) => f.evo).filter(Boolean));
  return liste.filter((f) => !suivi.has(f.id));
}

const enBase = new Map(lignes.map((f) => [f.id, f]));
const enCode = new Map(DEX.map((f) => [f.id, f]));
const pubBase = lignes.filter((f) => f.publie);
const pubCode = DEX.filter((f) => f.publie !== false);

const titre = (t) => console.log(`\n${t}\n${'─'.repeat(t.length)}`);

titre('Les compteurs');
{
  const rb = racines(pubBase);
  const visibles = ouvertes ? rb.filter((f) => ouvertes.has(f.set_id)) : rb;
  console.log(`  lignes en base            ${lignes.length}  (publiées ${pubBase.length})`);
  console.log(`  cartes dans le code       ${DEX.length}  (publiées ${pubCode.length})`);
  console.log(`  personnages en base       ${rb.length}   ← une case de classeur chacun`);
  console.log(`  saisons lancées           ${saisons.length ? saisons.map((s) => `${s.numero} ${s.nom}`).join(' · ') : 'aucune'}`);
  console.log(`  séries ouvertes           ${ouvertes ? [...ouvertes].join(' ') : 'aucune restriction (toutes)'}`);
  console.log(`  « à collectionner »       ${visibles.length}   ← le nombre affiché après la barre oblique`);
  const attendu = racines(pubCode).filter((f) => !ouvertes || ouvertes.has(f.set)).length;
  console.log(`  ce que le code prévoit    ${attendu}`);
  if (visibles.length !== attendu) {
    console.log(`\n  ⚠ écart de ${visibles.length - attendu}. Les sections suivantes disent lesquelles.`);
  }
}

titre('Personnages par série — base contre code');
{
  const rb = racines(pubBase);
  const rc = racines(pubCode);
  const cb = {}; for (const f of rb) cb[f.set_id] = (cb[f.set_id] ?? 0) + 1;
  const cc = {}; for (const f of rc) cc[f.set] = (cc[f.set] ?? 0) + 1;
  const sets = [...new Set([...Object.keys(cb), ...Object.keys(cc)])].sort();
  for (const s of sets) {
    const b = cb[s] ?? 0, k = cc[s] ?? 0;
    const nom = SETS?.find?.((x) => x.id === s)?.nom ?? '';
    const marque = b === k ? '   ' : ' ⚠ ';
    console.log(`${marque}${s.padEnd(4)} base ${String(b).padStart(3)}  code ${String(k).padStart(3)}`
      + (b === k ? '' : `   ${b > k ? `+${b - k} en trop` : `${b - k} manquant(s)`}`)
      + (nom ? `   ${nom}` : ''));
  }
}

titre('En base, inconnues du code');
{
  /* Ce sont elles qui gonflent les compteurs et peuplent le classeur de
     silhouettes : leur dessin a été renommé avec le code, pas leur ligne. */
  const orphelines = lignes.filter((f) => !enCode.has(f.id));
  if (!orphelines.length) console.log('  aucune.');
  else {
    console.log(`  ${orphelines.length} ligne(s) — dont ${orphelines.filter((f) => f.publie).length} publiée(s) :`);
    for (const f of orphelines) {
      console.log(`    ${f.id.padEnd(8)} ${String(f.set_id).padEnd(4)} ${f.publie ? '  ' : '(retirée) '}${f.nom}`);
    }
  }
}

titre('Dans le code, absentes de la base');
{
  const manquantes = DEX.filter((f) => !enBase.has(f.id));
  if (!manquantes.length) console.log('  aucune — l’amorçage est passé.');
  else {
    console.log(`  ${manquantes.length} carte(s) : l’amorçage n’a pas tourné depuis leur ajout.`);
    console.log(`    ${manquantes.map((f) => f.id).join(' ')}`);
  }
}

titre('Le même personnage deux fois');
{
  /* Deux lignes publiées qui portent le même nom sont presque toujours une
     carte renommée dont l'ancienne ligne est restée. C'est le doublon qu'un
     joueur voit dans son classeur, et il en voit un dessiné et un en ombre. */
  const parNom = new Map();
  for (const f of pubBase) {
    const clef = String(f.nom).trim().toLowerCase();
    if (!parNom.has(clef)) parNom.set(clef, []);
    parNom.get(clef).push(f);
  }
  const doubles = [...parNom.values()].filter((v) => v.length > 1);
  if (!doubles.length) console.log('  aucun nom porté par deux cartes publiées.');
  else {
    console.log(`  ${doubles.length} nom(s) portés par plusieurs cartes :`);
    for (const v of doubles) {
      console.log(`    « ${v[0].nom} » → ${v.map((f) => `${f.id} (${f.set_id})`).join('  ')}`);
    }
  }
}

titre('Ce que ça veut dire');
console.log(`
  Une ligne « en base, inconnue du code » est le reste d'un renommage qui n'a
  pas été appliqué. Elle compte dans la progression, occupe une case du
  classeur, et n'a plus de dessin puisque le fichier est parti avec le nouvel
  identifiant : c'est une silhouette de plus, et un doublon du personnage qui,
  lui, porte le nouvel identifiant.

  La migration qui les corrige est sql/prefixes.sql. Elle est idempotente :
  relancée, elle ne fait rien de plus.
`);
