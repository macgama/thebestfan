/**
 * Le plan de renommage : un identifiant qui dit sa série.
 *
 * ## Pourquoi
 *
 * `V1` « Choriste », `G1` « Le Faux Départ », `F1` « Abonné », `X23`… sont tous
 * dans LA TRIBUNE, et rien dans leur identifiant ne le dit. Cent dix-neuf
 * cartes sur six cent quarante-trois portent un préfixe qui n'est pas celui de
 * leur série. Pour qui range des dessins, écrit `rendus.js` ou cherche une
 * carte dans le catalogue, c'est cent dix-neuf occasions de se tromper.
 *
 * Après : `TR32` est dans LA TRIBUNE, et on le sait sans rien ouvrir.
 *
 * ## Ce que ce script fait, et ne fait pas
 *
 * Il **calcule et affiche** le plan. Il n'écrit rien. Le renommage lui-même
 * touche aux possessions des joueurs — `user_fanzzy`, `user_skins`,
 * `user_decks`, `user_wallet.active_fanzzy`, `souvenirs` — et se fait par une
 * migration SQL écrite à partir de ce plan, jamais à la main.
 *
 * `--json` rend le plan en JSON, pour les scripts qui l'appliquent.
 *
 * ## Les deux conventions de lignée
 *
 * Cent soixante-quinze lignées écrivent leurs âges en suffixe — `TR1`, `TR1B`,
 * `TR1C` — et sept les écrivent en entrées numérotées : `V1` → `V2` → `V3`.
 * Ce sont les sept premières du jeu, d'avant la règle.
 *
 * Le plan unifie les **identifiants** : `V1` devient `TR32`, et ses âges
 * `TR32B` et `TR32C` — pas `TR33` et `TR34`, qui laisseraient croire à trois
 * personnages. Le suffixe porte une information que le numéro ne porte pas :
 * **c'est le même**.
 *
 * Il ne touche pas à la **forme** du source. Les sept lignées d'origine gardent
 * leurs entrées écrites à la main, et c'est délibéré : la table `AGES` ne
 * fournit que les noms et les cris, les modificateurs étant **recalculés** par
 * formule. Convertir ces sept-là ferait passer `G1B` de 1,45 à 1,7 de geste
 * parfait sans que personne ne l'ait demandé. Un renommage qui rééquilibre le
 * jeu au passage est un renommage dont on ne relit plus le diff.
 *
 * Usage : node scripts/fanzzy-prefixes.mjs [--json]
 */
import { DEX, SETS } from '../src/shared/fanzzy/dex.js';

const json = process.argv.includes('--json');

const SUITE = new Set(DEX.map((f) => f.evo).filter(Boolean));
const parId = new Map(DEX.map((f) => [f.id, f]));

/** Les âges d'une lignée, du premier au dernier, quelle que soit la convention. */
function lignee(racine) {
  const l = [racine];
  let x = racine;
  while (x?.evo) {
    x = parId.get(x.evo);
    if (!x || l.includes(x)) break;
    l.push(x);
  }
  return l;
}

/* Le prochain numéro libre d'une série : on part du plus grand déjà employé.
   Reprendre les trous laisserait deux cartes porter le même numéro à un an
   d'intervalle, une fois la première dépubliée. */
const prochain = new Map();
for (const s of SETS) {
  let max = 0;
  for (const f of DEX) {
    const m = f.id.match(new RegExp(`^${s.id}(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  prochain.set(s.id, max + 1);
}

const plan = [];
const racines = DEX.filter((f) => !SUITE.has(f.id));

/* Les racines d'abord, dans l'ordre du catalogue : le plan doit être le même à
   chaque exécution, sinon deux passages produisent deux migrations
   différentes et l'on ne sait plus laquelle a été appliquée. */
for (const r of racines) {
  const bon = r.id.startsWith(r.set) && /^\d+$/.test(r.id.slice(r.set.length));
  if (bon) continue;

  const n = prochain.get(r.set);
  if (n === undefined) throw new Error(`série inconnue : ${r.set} (carte ${r.id})`);
  prochain.set(r.set, n + 1);
  const neuf = `${r.set}${n}`;

  const ages = lignee(r);
  ages.forEach((a, i) => {
    plan.push({
      de: a.id,
      vers: i === 0 ? neuf : neuf + (i === 1 ? 'B' : 'C'),
      set: a.set,
      nom: a.nom,
      rar: a.rar,
      stade: i + 1,
      /* L'âge changeait de convention d'identifiant : il s'appelait `V2` et
         s'appellera `TR32B`. Son entrée reste écrite à la main — voir
         l'en-tête : la convertir recalculerait ses modificateurs. */
      suffixeNeuf: i > 0 && a.id !== r.id + (i === 1 ? 'B' : 'C'),
    });
  });
}

/* Une carte peut être hors série **sans** être une racine ni l'âge d'une racine
   hors série : ce serait un âge dont la racine est bien nommée. Le plan ne
   saurait pas quoi en faire, et c'est exactement le genre de cas qu'on préfère
   voir refuser que traiter de travers. */
const vus = new Set(plan.map((p) => p.de));
const orphelins = DEX.filter((f) =>
  !vus.has(f.id) && !(f.id.startsWith(f.set) && /^\d+[BC]?$/.test(f.id.slice(f.set.length))));
if (orphelins.length) {
  console.error('Des cartes hors série ne sont rattachées à aucune lignée à renommer :');
  for (const f of orphelins) console.error(`  ${f.id} (${f.set}) ${f.nom}`);
  process.exit(1);
}

/* Aucune destination ne doit exister déjà, ni être visée deux fois. Un plan qui
   écrase une carte vivante est pire que pas de plan. */
const existants = new Set(DEX.map((f) => f.id));
const vises = new Set();
for (const p of plan) {
  if (existants.has(p.vers)) throw new Error(`${p.vers} existe déjà (pour ${p.de})`);
  if (vises.has(p.vers)) throw new Error(`${p.vers} visé deux fois`);
  vises.add(p.vers);
}

if (json) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  const parSet = new Map();
  for (const p of plan) {
    if (!parSet.has(p.set)) parSet.set(p.set, []);
    parSet.get(p.set).push(p);
  }
  for (const s of SETS) {
    const l = parSet.get(s.id);
    if (!l) continue;
    console.log(`\n${s.nom}  (${s.id}) — ${l.length} carte(s)`);
    for (const p of l) {
      console.log(`  ${p.de.padEnd(6)} → ${p.vers.padEnd(7)} ${p.rar.padEnd(11)} `
        + `${p.nom}${p.suffixeNeuf ? '   [passe au suffixe]' : ''}`);
    }
  }
  const conv = plan.filter((p) => p.suffixeNeuf).length;
  console.log(`\n${plan.length} carte(s) à renommer, dont ${conv} âge(s) qui passent `
    + 'à la convention de suffixe. Aucun modificateur ne change.');
  console.log('Ce script n’écrit rien : le renommage se fait par migration.');
}
