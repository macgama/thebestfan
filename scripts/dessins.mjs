/**
 * Où en est la production des dessins.
 *
 * ## Pourquoi ce script existe
 *
 * Toute la mécanique du jeu — les âges, le classeur, le défilé sur l'accueil,
 * les états qui réagissent au match — tourne sur un catalogue dont la grande
 * majorité n'a qu'une illustration de carte. C'est, et de loin, ce qui limite
 * le plus ce qu'un joueur voit.
 *
 * `verif-pages.mjs` en donne le total — « 10/191 lignées entièrement
 * dessinées » — et c'est tout ce qu'on avait. Le détail se cherchait à la main,
 * dossier par dossier, et personne ne le cherchait. Une production qu'on ne
 * peut pas regarder est une production qu'on ne pilote pas.
 *
 * Celui-ci répond à trois questions, dans l'ordre où on se les pose :
 *
 *   1. **Combien reste-t-il ?** Par série, et pour le catalogue entier.
 *   2. **Qu'est-ce qui est presque fini ?** Une lignée à laquelle il manque un
 *      seul dessin coûte une image et rend un personnage entier jouable ; une
 *      lignée vide en coûte trente-six. Ce n'est pas le même travail, et ce
 *      n'est pas la même valeur.
 *   3. **Que faut-il dessiner pour ce personnage-là ?** La liste exacte des
 *      fichiers manquants, aux noms que la chaîne de production attend.
 *
 * ## Les deux systèmes d'images, et pourquoi ils comptent séparément
 *
 * Un Fanzzy a deux vies. **La carte** — `TR32.png` et son buste — sert le
 * classeur, le deck, la liste d'amis, la boutique : elle est plate, une par âge,
 * et c'est ce que deux cents personnages ont. **Les états** — les douze poses
 * rangées sous `TR32/e1/base/` — servent l'accueil et le virage : ils font
 * réagir le personnage au match, et deux lignées seulement les ont.
 *
 * Les confondre donnerait un chiffre qui ne veut rien dire. Un personnage dont
 * la carte existe est collectionnable ; un personnage dont les états existent
 * est **vivant**. On compte donc les deux, et on les nomme.
 *
 * Usage :
 *   node scripts/dessins.mjs                 le tableau de bord
 *   node scripts/dessins.mjs --serie TR      une série en détail
 *   node scripts/dessins.mjs TR32            ce qu'il manque à une lignée
 *   node scripts/dessins.mjs --presque       les lignées les plus proches du but
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const IMG = path.join(RACINE, 'public', 'img', 'fanzzy');

const { DEX } = await import('../src/shared/fanzzy/dex.js');
const { ETATS } = await import('../src/shared/fanzzy/rendus.js');

const args = process.argv.slice(2);
const opt = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : null; };
const a = (nom) => args.includes(nom);
const cible = args.find((x) => !x.startsWith('--') && args[args.indexOf(x) - 1] !== '--serie');

/* ------------------------------------------------------------ le catalogue

   `suivi` porte les identifiants qui sont l'âge supérieur de quelqu'un : ce
   sont les cartes qu'on ne compte pas comme des lignées, sans quoi une lignée
   de trois âges compterait pour trois personnages. */
const pub = DEX.filter((f) => f.publie !== false);
const parId = new Map(pub.map((f) => [f.id, f]));
const suivi = new Set(pub.map((f) => f.evo).filter(Boolean));
const racines = pub.filter((f) => !suivi.has(f.id));

/** Les âges d'une lignée, du premier au dernier. */
function lignee(racine) {
  const suite = [racine];
  let c = racine;
  while (c?.evo && parId.has(c.evo)) { c = parId.get(c.evo); suite.push(c); }
  return suite;
}

/* -------------------------------------------------------------- le disque

   On cherche le **PNG**, et lui seul. Les trois formats sont produits ensemble
   par la même chaîne : l'AVIF sans son PNG serait une anomalie de production,
   pas un état partiel, et `verif-pages.mjs` la signale déjà de son côté. Le
   chercher trois fois ne dirait rien de plus et rendrait ce tableau trois fois
   plus lent sur onze cents fichiers. */
const carte = (id) => existsSync(path.join(IMG, `${id}.png`));
const buste = (id) => existsSync(path.join(IMG, `${id}-buste.png`));

/** Le manifeste des états d'une lignée, s'il existe. */
function manifeste(racineId) {
  try {
    return JSON.parse(readFileSync(path.join(IMG, racineId, 'manifeste.json'), 'utf8'));
  } catch { return null; }
}

/** Les états dessinés d'un âge, dans la tenue de base. */
function etatsDe(racineId, evo) {
  const m = manifeste(racineId);
  return m?.evolutions?.[`e${evo}`]?.skins?.base?.etats ?? [];
}

/* --------------------------------------------------------------- le bilan */

/**
 * Ce qui manque à une lignée, et ce qu'elle a.
 *
 * Deux comptes séparés — les cartes et les états — parce qu'ils ne se
 * remplacent pas : voir l'en-tête.
 */
function bilan(racine) {
  const ages = lignee(racine);
  const cartes = ages.map((f) => ({ id: f.id, nom: f.nom, a: carte(f.id) && buste(f.id) }));
  const etats = ages.map((f, i) => {
    const vus = etatsDe(racine.id, i + 1);
    return { evo: i + 1, id: f.id, vus, manque: ETATS.filter((e) => !vus.includes(e)) };
  });
  const cartesFaites = cartes.filter((c) => c.a).length;
  const etatsFaits = etats.reduce((n, e) => n + e.vus.length, 0);
  return {
    racine, set: racine.set ?? '?', nom: racine.nom, ages: ages.length,
    cartes, cartesFaites, cartesTotal: cartes.length,
    etats, etatsFaits, etatsTotal: ages.length * ETATS.length,
    /* « Vivant » veut dire : au moins le premier âge réagit au match. C'est le
       seuil qui change ce qu'un joueur voit sur son écran d'accueil, et il vaut
       mieux dix personnages vivants au premier âge que trois complets. */
    vivant: etats[0]?.vus.length === ETATS.length,
  };
}

const tous = racines.map(bilan);

/* ------------------------------------------------------------- l'affichage */

const pc = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const barre = (n, d, large = 18) => {
  const plein = d ? Math.round((n / d) * large) : 0;
  return '█'.repeat(plein) + '·'.repeat(large - plein);
};

if (cible) {
  /* ------------------------------------------- ce qu'il manque à une lignée */
  const r = racines.find((f) => f.id === cible.toUpperCase());
  if (!r) {
    console.error(`« ${cible} » n'est pas une racine de lignée publiée.`);
    console.error('Les âges supérieurs se demandent par leur racine : TR32, pas TR32B.');
    process.exit(1);
  }
  const b = bilan(r);
  console.log(`\n${b.nom}  (${b.racine.id}, série ${b.set}, ${b.ages} âge(s))\n`);

  console.log('  CARTES — le classeur, le deck, les amis');
  for (const c of b.cartes) {
    console.log(`    ${c.a ? 'ok  ' : 'MANQUE'}  ${c.id.padEnd(8)} ${c.nom ?? ''}`);
  }
  if (b.cartes.some((c) => !c.a)) {
    console.log('    → à déposer dans art/neuves/ sous <ID>.png, puis : npm run images art/neuves');
    console.log('      et ajouter l’identifiant à ILLUSTRES dans public/fanzzy-art.js');
  }

  console.log('\n  ÉTATS — l’accueil, le virage, les réactions au match');
  for (const e of b.etats) {
    const fait = e.vus.length;
    console.log(`    âge ${e.evo} : ${String(fait).padStart(2)}/${ETATS.length} ${barre(fait, ETATS.length)}`);
    if (e.manque.length) {
      console.log(`      manque : ${e.manque.join(', ')}`);
      console.log(`      soit : ${e.manque.map((x) => `${b.racine.id}-e${e.evo}-base-${x}.png`).slice(0, 3).join('  ')}${e.manque.length > 3 ? '  …' : ''}`);
    }
  }
  if (b.etats.some((e) => e.manque.length)) {
    console.log(`    → à déposer dans art/${b.racine.id}/_src/, puis : npm run art art/${b.racine.id}/_src`);
  }
  console.log('');
  process.exit(0);
}

if (a('--presque')) {
  /* ---------------------------------------- ce qui coûte le moins à finir

     Rangé par ce qu'il reste à faire, pas par ce qui est fait : une lignée à
     laquelle il manque un dessin est un personnage entier à un dessin près, et
     c'est le meilleur achat de la journée. */
  const reste = (b) => (b.cartesTotal - b.cartesFaites) + (b.etatsTotal - b.etatsFaits);
  const proches = tous.filter((b) => reste(b) > 0 && (b.cartesFaites > 0 || b.etatsFaits > 0))
    .sort((x, y) => reste(x) - reste(y)).slice(0, 25);
  console.log('\nLES PLUS PROCHES DU BUT — ce qui coûte le moins de dessins à finir\n');
  for (const b of proches) {
    console.log(`  ${String(reste(b)).padStart(3)} à faire   ${b.racine.id.padEnd(7)} ${
      (b.nom ?? '').padEnd(26)} cartes ${b.cartesFaites}/${b.cartesTotal} · états ${b.etatsFaits}/${b.etatsTotal}`);
  }
  console.log('');
  process.exit(0);
}

const serie = opt('--serie');
const vues = serie ? tous.filter((b) => b.set === serie.toUpperCase()) : tous;
if (serie && !vues.length) {
  console.error(`Aucune série « ${serie} ». Les séries : ${[...new Set(tous.map((b) => b.set))].join(', ')}`);
  process.exit(1);
}

if (serie) {
  console.log(`\nSÉRIE ${serie.toUpperCase()} — ${vues.length} lignée(s)\n`);
  for (const b of vues.sort((x, y) => (y.cartesFaites + y.etatsFaits) - (x.cartesFaites + x.etatsFaits))) {
    console.log(`  ${b.racine.id.padEnd(7)} ${(b.nom ?? '').padEnd(26)} cartes ${
      String(b.cartesFaites).padStart(2)}/${b.cartesTotal}  états ${
      String(b.etatsFaits).padStart(2)}/${b.etatsTotal} ${b.vivant ? ' · vivant' : ''}`);
  }
  console.log('');
  process.exit(0);
}

/* --------------------------------------------------------- le tableau entier */

const parSerie = new Map();
for (const b of tous) {
  if (!parSerie.has(b.set)) parSerie.set(b.set, []);
  parSerie.get(b.set).push(b);
}

console.log('\nLA PRODUCTION DES DESSINS\n');
console.log('  série  lignées   cartes              états               complètes  vivantes');
let tCartes = 0; let tCartesT = 0; let tEtats = 0; let tEtatsT = 0;
for (const [set, liste] of [...parSerie].sort((x, y) => y[1].length - x[1].length)) {
  const c = liste.reduce((n, b) => n + b.cartesFaites, 0);
  const cT = liste.reduce((n, b) => n + b.cartesTotal, 0);
  const e = liste.reduce((n, b) => n + b.etatsFaits, 0);
  const eT = liste.reduce((n, b) => n + b.etatsTotal, 0);
  tCartes += c; tCartesT += cT; tEtats += e; tEtatsT += eT;
  const completes = liste.filter((b) => b.cartesFaites === b.cartesTotal).length;
  const vivantes = liste.filter((b) => b.vivant).length;
  console.log(`  ${set.padEnd(6)} ${String(liste.length).padStart(5)}   ${
    barre(c, cT, 12)} ${pc(c, cT).padStart(4)}   ${
    barre(e, eT, 12)} ${pc(e, eT).padStart(4)}   ${
    String(completes).padStart(6)}   ${String(vivantes).padStart(7)}`);
}
console.log(`  ${''.padEnd(6)} ${String(tous.length).padStart(5)}   ${
  barre(tCartes, tCartesT, 12)} ${pc(tCartes, tCartesT).padStart(4)}   ${
  barre(tEtats, tEtatsT, 12)} ${pc(tEtats, tEtatsT).padStart(4)}   ${
  String(tous.filter((b) => b.cartesFaites === b.cartesTotal).length).padStart(6)}   ${
  String(tous.filter((b) => b.vivant).length).padStart(7)}`);

console.log(`
  cartes    ${tCartes}/${tCartesT} dessins — le classeur, le deck, les amis
  états     ${tEtats}/${tEtatsT} dessins — l'accueil, le virage, les réactions au match
  vivantes  ${tous.filter((b) => b.vivant).length}/${tous.length} lignées réagissent au match dès le premier âge

  node scripts/dessins.mjs --presque       ce qui coûte le moins à finir
  node scripts/dessins.mjs --serie TR      une série en détail
  node scripts/dessins.mjs TR32            ce qu'il manque à une lignée
`);
