/**
 * Ce que la base contient et que le code ne dit pas — et l'inverse, en détail.
 *
 * ## Ce que ce script est devenu
 *
 * Il portait le calcul **et** l'affichage, et il fallait penser à le lancer.
 * Le calcul vit maintenant dans `src/server/fanzzy/ecarts.js` : le démarrage
 * s'en sert pour dire tout seul, à chaque fois, qu'une base diverge de son
 * code — trois lignes de journal au lieu d'un compteur bizarre découvert six
 * semaines plus tard. Ce script en reste **la loupe** : le démarrage nomme les
 * cartes, lui les liste, série par série et champ par champ.
 *
 * Les deux lisent donc la même fonction. C'eût été une drôle de façon de
 * finir : un outil de détection de divergence qui diverge de ce qu'il surveille.
 *
 * Il ne modifie rien. Il **sort en erreur** quand il trouve une faute — une
 * carte du code absente de la base, une ligne publiée que le code ne connaît
 * pas, deux cartes publiées sous le même nom — pour être utilisable avant une
 * mise en ligne. Une retouche, elle, ne fait pas échouer : elle peut être le
 * travail normal de l'administration.
 *
 * Usage :
 *   DATABASE_URL=mysql://user:pass@hote:port/base node scripts/fanzzy-ecarts.mjs
 */
import mysql from 'mysql2/promise';
import { DEX, SETS } from '../src/shared/fanzzy/dex.js';
import { comparer, depuisLigne, resumer } from '../src/server/fanzzy/ecarts.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant.\n'
    + 'Usage : DATABASE_URL=mysql://… node scripts/fanzzy-ecarts.mjs');
  process.exit(1);
}

const c = await mysql.createConnection(url);
/* Toutes les colonnes que la comparaison regarde. La requête n'en prenait que
   sept : les textes et les modificateurs manquaient, donc une carte réécrite
   dans le code passait pour identique — l'écart que `sql/identites.sql` a dû
   rattraper à la main sur vingt-neuf cartes. */
const [lignes] = await c.query(
  `SELECT id, nom, set_id, stage, rar, evo, histoire, mods, cri, publie FROM fanzzy`);

/* Les séries qu'une saison lancée a ouvertes. C'est sur elles que se compte la
   progression du joueur : sans ça, on compare un compteur à un catalogue qu'il
   ne compte pas.

   Les saisons sont additives : l'union des séries de toutes celles qui sont
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

const base = lignes.map(depuisLigne);
const r = comparer({ code: DEX, base, ouvertes });

const titre = (t) => console.log(`\n${t}\n${'─'.repeat(t.length)}`);
const publiee = (f) => f.publie !== false;

titre('Les compteurs');
{
  console.log(`  lignes en base            ${r.compteurs.base}  (publiées ${base.filter(publiee).length})`);
  console.log(`  cartes dans le code       ${r.compteurs.code}  (publiées ${DEX.filter(publiee).length})`);
  console.log(`  personnages en base       ${r.compteurs.personnages}   ← une case de classeur chacun`);
  console.log(`  saisons lancées           ${saisons.length ? saisons.map((s) => `${s.numero} ${s.nom}`).join(' · ') : 'aucune'}`);
  console.log(`  séries ouvertes           ${ouvertes ? [...ouvertes].join(' ') : 'aucune restriction (toutes)'}`);
  console.log(`  « à collectionner »       ${r.compteurs.aCollectionner}   ← le nombre affiché après la barre oblique`);
  console.log(`  ce que le code prévoit    ${r.compteurs.attendu}`);
  const ecart = r.compteurs.aCollectionner - r.compteurs.attendu;
  if (ecart) console.log(`\n  ⚠ écart de ${ecart}. Les sections suivantes disent lesquelles.`);
}

titre('Personnages par série — base contre code');
{
  const racines = (l) => {
    const suivi = new Set(l.map((f) => f.evo).filter(Boolean));
    return l.filter((f) => !suivi.has(f.id));
  };
  const cb = {}; for (const f of racines(base.filter(publiee))) cb[f.set] = (cb[f.set] ?? 0) + 1;
  const cc = {}; for (const f of racines(DEX.filter(publiee))) cc[f.set] = (cc[f.set] ?? 0) + 1;
  for (const s of [...new Set([...Object.keys(cb), ...Object.keys(cc)])].sort()) {
    const b = cb[s] ?? 0, k = cc[s] ?? 0;
    const nom = SETS?.find?.((x) => x.id === s)?.nom ?? '';
    console.log(`${b === k ? '   ' : ' ⚠ '}${s.padEnd(4)} base ${String(b).padStart(3)}  code ${String(k).padStart(3)}`
      + (b === k ? '' : `   ${b > k ? `+${b - k} en trop` : `${b - k} manquant(s)`}`)
      + (nom ? `   ${nom}` : ''));
  }
}

titre('En base, inconnues du code');
{
  /* Ce sont elles qui gonflent les compteurs et peuplent le classeur de
     silhouettes : leur dessin a été renommé avec le code, pas leur ligne. */
  if (!r.orphelines.length) console.log('  aucune.');
  else {
    console.log(`  ${r.orphelines.length} ligne(s) — dont ${r.orphelines.filter((o) => o.publie).length} publiée(s) :`);
    for (const o of r.orphelines) {
      console.log(`    ${o.id.padEnd(8)} ${String(o.set).padEnd(4)} ${o.publie ? '  ' : '(retirée) '}${o.nom}`);
    }
  }
}

titre('Dans le code, absentes de la base');
{
  if (!r.manquantes.length) console.log('  aucune — l’amorçage est passé.');
  else {
    console.log(`  ${r.manquantes.length} carte(s) : l’amorçage n’a pas tourné depuis leur ajout.`);
    console.log(`    ${r.manquantes.join(' ')}`);
  }
}

titre('Le même personnage deux fois');
{
  if (!r.doublons.length) console.log('  aucun nom porté par deux cartes publiées.');
  else {
    console.log(`  ${r.doublons.length} nom(s) portés par plusieurs cartes :`);
    for (const d of r.doublons) console.log(`    « ${d.nom} » → ${d.ids.join('  ')}`);
  }
}

titre('Présentes des deux côtés, mais pas pareilles');
{
  /* La section que le script n'avait pas, et c'est celle qui a coûté le plus
     cher : `INSERT IGNORE` n'écrase rien, donc un nom ou un cri réécrit dans
     `dex.js` n'arrive jamais en base. Ni erreur, ni trace — le jeu affiche
     simplement l'ancienne version. */
  if (!r.retouchees.length) console.log('  aucune — le code et la base disent la même chose.');
  else {
    console.log(`  ${r.retouchees.length} carte(s) dont au moins un champ diffère :\n`);
    const parChamp = {};
    for (const t of r.retouchees) {
      console.log(`    ${t.id.padEnd(8)} ${String(t.nom).padEnd(28)} ${t.champs.join(', ')}`);
      for (const c of t.champs) parChamp[c] = (parChamp[c] ?? 0) + 1;
    }
    console.log(`\n    par champ : ${Object.entries(parChamp)
      .sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · ')}`);
    console.log('\n    Une retouche n’est pas forcément une faute : l’administration a le'
      + '\n    droit de corriger une carte, et c’est même la raison d’être de cette'
      + '\n    table. Mais un texte réécrit dans le code et jamais arrivé en base a'
      + '\n    exactement la même apparence. Pour pousser le code par-dessus, sans'
      + '\n    écraser le reste : node scripts/fanzzy-identites.mjs, qui produit'
      + '\n    sql/identites.sql à partir de ces écarts-là.');
  }
}

titre('Ce que le démarrage en dirait');
{
  const lignes = resumer(r);
  if (!lignes.length) console.log('  rien : cette base et ce code disent la même chose.');
  else for (const l of lignes) console.log(`  ${l}`);
}

if (r.faute) {
  console.log('\n⚠ Au moins une faute : une carte du code absente de la base, une ligne'
    + '\n  publiée que le code ne connaît pas, ou deux cartes publiées sous le même'
    + '\n  nom. Aucune manœuvre normale ne produit ça.');
  console.log('\n  La migration des renommages est sql/prefixes.sql, idempotente :'
    + '\n  relancée, elle ne fait rien de plus.');
}
process.exit(r.faute ? 1 : 0);
