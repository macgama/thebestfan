/**
 * L'échelle unique du verdict (`src/shared/verdict.js`).
 *
 * ## Pourquoi une suite à part, et sans base
 *
 * Le même geste recevait trois mots selon l'écran : le Virage coupait à 0,9 /
 * 0,7 / 0,4, la salle de répétition à 0,95 / 0,8 / 0,6 / 0,3 avec d'autres
 * mots, le duel à 90 et 70 pour un son. Gaël a tranché le 3 octobre 2026 (Q3) :
 * **une échelle, quatre mots, partout**, et le serveur nomme le verdict qu'il
 * sert (`CONTRATS.md`, § 16.1). Une échelle se trompe à ses bornes, et elle se
 * trompe sans bruit : un `>=` à la place d'un `>` ne lève rien, il change le
 * compte des PARFAITS d'un bilan à l'autre.
 *
 * Ces contrôles vivaient dans `reglages-smoke`, qui vide la base pour éprouver
 * le registre : il fallait une base pour vérifier quatre comparaisons. Ils
 * sont ici, sans base, sans réseau et sans port ; `reglages-smoke` garde le
 * seul qui parle du registre (aucun réglage ne porte le verdict).
 *
 * ## Ce qu'elle garde
 *
 *   1. **le module** : quatre mots figés, trois seuils figés, « au-dessus de »
 *      strict aux bornes exactes, une note hors de 0–1 ou illisible qui ne
 *      lève pas, le Cri à 0,95, `auMoins` (le plancher de ferveur, Q4) ;
 *   2. **la grandeur mesurée** (D7) : la note brute relevée par le plancher,
 *      avant les modificateurs du Fanzzy — un 0,95 sous `perfectBonus` 0,82
 *      reste PARFAIT ; et `noteDuVerdict` rend toujours un nombre fini ≥ 0,
 *      puisqu'il s'écrit en millièmes dans `virage_presence.meilleur_q` ;
 *   3. **le parfait payé et le PARFAIT écrit sont un seul fait** : le seuil de
 *      `perfectBonus` (`gestures.js`, lu par les deux arènes) est celui du
 *      verdict, strict lui aussi ;
 *   4. **le contrat dit les mêmes nombres que le module** : le tableau du
 *      § 16.1 et la ligne du Cri au § 16.2. Les écrans codent contre le
 *      contrat ; s'il ment, ils mentent avec lui ;
 *   5. **le serveur nomme par le module** : tout fichier de `src/server/` qui
 *      écrit un champ `verdict` le tire de `verdictDe`, ou recopie un verdict
 *      déjà nommé. Une seconde échelle écrite dans une salle, c'est D7 qui
 *      revient ;
 *   6. **le module se charge des deux côtés** : il n'importe rien, ne lit ni
 *      `window`, ni `document`, ni `process` ;
 *   7. **la note écrite en millièmes garde son verdict** : le bilan du Virage
 *      relit le verdict du meilleur geste sur `virage_presence.meilleur_q`,
 *      que le Virage écrit par `enMilliemes` (`ferveur/virage.js`). Les seuils
 *      doivent être des millièmes exacts, et l'arrondi aller vers le haut —
 *      sinon un geste annoncé PARFAIT en tribune revient BON au bilan.
 *
 * Que les pages n'importent pas le module et n'écrivent aucun seuil, c'est
 * `gestes-smoke` et `verif-pages` qui le gardent ; que le registre ne
 * l'héberge pas, `reglages-smoke`.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as V from '../src/shared/verdict.js';
import { applyHeroMods } from '../src/server/ferveur/gestures.js';
import { enMilliemes } from '../src/server/ferveur/virage.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };

/** Le code sans ses commentaires : un commentaire qui cite un seuil n'en écrit pas. */
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1 ');

/* ------------------------------------------------------------ 1. le module */

console.log('\n— le module —');

check('quatre mots, du meilleur au pire, liste figée',
  JSON.stringify(V.VERDICTS) === JSON.stringify(['parfait', 'bon', 'moyen', 'rate'])
    && Object.isFrozen(V.VERDICTS));
check('les seuils du contrat : 0,9, 0,7, 0,4, figés',
  JSON.stringify(V.SEUILS) === JSON.stringify({ parfait: 0.9, bon: 0.7, moyen: 0.4 })
    && Object.isFrozen(V.SEUILS));

/* Aux bornes exactes : « au-dessus de » est strict. C'est là, et seulement là,
   qu'un `>=` se distingue d'un `>`. */
const BORNES = [
  [0.9, 'bon'], [0.9001, 'parfait'], [0.7, 'moyen'], [0.7001, 'bon'],
  [0.4, 'rate'], [0.4001, 'moyen'], [0, 'rate'], [1, 'parfait'],
];
const fausses = BORNES.filter(([q, v]) => V.verdictDe(q) !== v)
  .map(([q, v]) => `${q} → ${V.verdictDe(q)}, attendu ${v}`);
check('aux bornes : 0,9 → bon, 0,9001 → parfait, 0,7 → moyen, 0,4 → rate, 0 et 1',
  fausses.length === 0 || (console.log('        ', fausses.join(' · ')), false));

/* Une note hors de 0–1 ne lève pas : certains gestes notent jusqu'à 1,2
   (`grade`). Une note illisible est RATÉE : une fonction qui lèverait au
   milieu d'un chant ferait perdre le chant entier pour un mot. */
let leveHors = null;
let horsDeBornes = [];
try {
  horsDeBornes = [1.2, -0.5, NaN, undefined, null, 'abc', Infinity].map((q) => V.verdictDe(q));
} catch (e) { leveHors = e; }
check('une note hors de 0–1 ou illisible ne lève pas : 1,2 → parfait, le reste → rate',
  !leveHors && JSON.stringify(horsDeBornes)
    === JSON.stringify(['parfait', 'rate', 'rate', 'rate', 'rate', 'rate', 'parfait'])
  || (console.log('        vu :', leveHors?.message ?? JSON.stringify(horsDeBornes)), false));

check('estParfait suit le verdict (0,9 non, 0,91 oui)',
  V.estParfait(0.9) === false && V.estParfait(0.91) === true);
check('le Cri part strictement au-dessus de 0,95',
  V.criDe(0.95) === false && V.criDe(0.9501) === true && V.SEUIL_CRI === 0.95);
check('le Cri ne fait pas de cinquième mot : 0,97 reste « parfait »', V.verdictDe(0.97) === 'parfait');

check('« au moins moyen » : parfait, bon et moyen oui ; rate et un mot inconnu non',
  ['parfait', 'bon', 'moyen'].every((v) => V.auMoins(v, 'moyen'))
    && !V.auMoins('rate', 'moyen') && !V.auMoins('excellent', 'moyen') && !V.auMoins(undefined, 'moyen'));
let palierFaux = null;
try { V.auMoins('bon', 'superbe'); } catch (e) { palierFaux = e; }
check('un palier hors de la liste lève en le nommant (une faute d’appelant)',
  /superbe/.test(palierFaux?.message ?? ''));

/* -------------------------------------------- 2. la grandeur mesurée (D7) */

console.log('\n— la note que le verdict mesure —');

/* Le cas qui a tout déclenché : un Fanzzy à `perfectBonus` 0,82 sur un geste
   brut de 0,95. Sur la note finale, l'écran écrivait BON ; mesuré comme le
   contrat le dit, c'est un PARFAIT. */
const finale = applyHeroMods(0.95, { perfectBonus: 0.82 }).quality;
check('D7 : un 0,95 brut sous perfectBonus 0,82 reste parfait (la note finale, 0,779, dirait bon)',
  V.verdictDe(V.noteDuVerdict(0.95)) === 'parfait' && V.verdictDe(finale) === 'bon'
  || (console.log('        finale :', finale), false));
check('le plancher relève un raté (0,2 → 0,5 : moyen), et ne baisse jamais un bon geste',
  V.noteDuVerdict(0.2, 0.5) === 0.5 && V.verdictDe(V.noteDuVerdict(0.2, 0.5)) === 'moyen'
    && V.noteDuVerdict(0.95, 0.65) === 0.95);
check('sans plancher (null), la note brute passe telle quelle', V.noteDuVerdict(0.73, null) === 0.73);
const illisibles = [V.noteDuVerdict(NaN), V.noteDuVerdict(-1), V.noteDuVerdict(undefined, null),
  V.noteDuVerdict(0.3, NaN), V.noteDuVerdict('x', 'y'), V.noteDuVerdict(1.2)];
check('la note mesurée est toujours un nombre fini ≥ 0 (elle s’écrit en millièmes)',
  JSON.stringify(illisibles) === JSON.stringify([0, 0, 0, 0.3, 0, 1.2])
  || (console.log('        vu :', JSON.stringify(illisibles)), false));
check('et en millièmes elle tient dans meilleur_q (SMALLINT UNSIGNED, 0 à 1 200)',
  Math.round(V.noteDuVerdict(1.2) * 1000) === 1200 && Math.round(V.noteDuVerdict(-3) * 1000) === 0);

/* ---------------------------- 3. le parfait payé est le PARFAIT écrit */

console.log('\n— perfectBonus, au même seuil —');

/* « Comme perfectBonus » : `applyHeroMods` (gestures.js, lu par le Virage et
   par le moteur du duel) récompense le geste parfait au même seuil strict que
   le verdict le nomme. Exactement 0,9 n'est pas boosté ; un rien au-dessus
   l'est. Si l'un bougeait sans l'autre, le PARFAIT écrit et le parfait payé
   redeviendraient deux faits. */
check('le seuil de perfectBonus (gestures.js) est celui du PARFAIT, strict',
  applyHeroMods(V.SEUILS.parfait, { perfectBonus: 2 }).quality === V.SEUILS.parfait
    && applyHeroMods(V.SEUILS.parfait + 0.0001, { perfectBonus: 2 }).quality > 1.8);

/* ------------------------------------ 4. le contrat dit les mêmes nombres */

console.log('\n— le contrat —');

const contrat = await readFile(path.join(RACINE, 'serveur/CONTRATS.md'), 'utf8');
const s161 = contrat.split('### 16.1')[1]?.split('### 16.2')[0] ?? '';
const lignes = [...s161.matchAll(/^\|\s*`"(\w+)"`\s*\|\s*([^|]+?)\s*\|/gm)].map((m) => [m[1], m[2]]);
check('le tableau du § 16.1 nomme les quatre mots, dans l’ordre du module',
  JSON.stringify(lignes.map(([mot]) => mot)) === JSON.stringify(V.VERDICTS)
  || (console.log('        lu :', JSON.stringify(lignes)), false));
const nombre = (texte) => Number((/(\d+,\d+)/.exec(texte)?.[1] ?? '').replace(',', '.'));
const ecrits = Object.fromEntries(lignes.filter(([mot]) => mot !== 'rate')
  .map(([mot, texte]) => [mot, /au-dessus de/.test(texte) ? nombre(texte) : NaN]));
check('et ses seuils sont ceux de SEUILS, « au-dessus de » compris',
  JSON.stringify(ecrits) === JSON.stringify(V.SEUILS)
  || (console.log('        lu :', JSON.stringify(ecrits)), false));
const rate = lignes.find(([mot]) => mot === 'rate')?.[1] ?? '';
check('« rate » est écrit « 0,4 ou moins » : la borne du bas lui revient',
  nombre(rate) === V.SEUILS.moyen && /ou moins/.test(rate) || (console.log('        lu :', rate), false));
const s162 = contrat.split('### 16.2')[1]?.split('### 16.3')[0] ?? '';
const ligneCri = s162.split('\n').find((l) => /`cri`/.test(l)) ?? '';
check('la ligne du Cri au § 16.2 dit le seuil de SEUIL_CRI',
  nombre(/dépasse\s+([\d,]+)/.exec(ligneCri)?.[1] ?? '') === V.SEUIL_CRI
  || (console.log('        lu :', ligneCri.slice(0, 160)), false));

/* --------------------------------------- 5. le serveur nomme par le module

   Chaque champ `verdict` que le serveur écrit — une propriété `verdict:` ou
   une affectation `.verdict =` — doit venir de `verdictDe(…)`, ou recopier un
   verdict déjà nommé (`r.verdict`). Une salle qui écrirait sa propre échelle
   (`q > 0.9 ? 'parfait' : …`) ne lèverait rien et servirait un autre mot que
   les deux autres arènes. Lu dans le texte, sans les commentaires. */

console.log('\n— le serveur nomme par le module —');

async function fichiersJs(dossier) {
  const sortie = [];
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...await fichiersJs(p));
    else if (e.name.endsWith('.js')) sortie.push(p);
  }
  return sortie;
}

/** Le code sans le contenu de ses chaînes : un message de journal qui dit
    « verdict : » n'écrit pas de verdict. Après `sansCommentaires`, sans quoi
    les apostrophes des commentaires ouvriraient des chaînes. */
const sansChaines = (s) => s
  .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
  .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
  .replace(/`(?:[^`\\]|\\.)*`/g, '``');

/** Une déstructuration (`const { verdict: v } = r`) lit un verdict, elle ne
    l'écrit pas : la première accolade qui suit ferme un motif suivi de `=`. */
function estDestructuration(code, fin) {
  const apres = code.slice(fin);
  const i = apres.search(/[;{}()]/);
  return i >= 0 && apres[i] === '}' && /^\}\s*=(?![=>])/.test(apres.slice(i));
}

/**
 * Ce que le code met dans un champ `verdict` : une propriété `verdict:` ou
 * une affectation `.verdict =`, hors déstructuration. Le code reçu est déjà
 * sans commentaires ; les chaînes sont vidées ici.
 */
function ecrituresDeVerdict(code) {
  const net = sansChaines(code);
  const sortie = [];
  for (const m of net.matchAll(/(?:\bverdict\s*:(?!:)|\.verdict\s*=(?!=))\s*([^,;\n})]+(?:\([^)\n]*\))?)/g)) {
    if (estDestructuration(net, m.index + m[0].length)) continue;
    sortie.push(m[1].trim());
  }
  return { net, ecritures: sortie };
}

/**
 * Ce qui est permis à droite : l'appel au module ; un verdict déjà nommé
 * (`r.verdict`) ; ou une variable que ce même fichier tire de l'un des deux
 * (`const v = verdictDe(q)` … `verdict: v`).
 */
function permis(rhs, net) {
  if (/^verdictDe\(/.test(rhs) || /^[\w$]+(?:\??\.[\w$]+)*\??\.verdict$/.test(rhs)) return true;
  if (!/^[\w$]+$/.test(rhs)) return false;
  const nomme = new RegExp(`\\b${rhs}\\s*=\\s*(?:verdictDe\\(|[\\w$]+(?:\\??\\.[\\w$]+)*\\??\\.verdict\\b)`);
  return nomme.test(net);
}

const serveur = await fichiersJs(path.join(RACINE, 'src/server'));
const fautes = [];
let ecrivains = 0;
for (const f of serveur) {
  const code = sansCommentaires(await readFile(f, 'utf8'));
  const { net, ecritures } = ecrituresDeVerdict(code);
  if (!ecritures.length) continue;
  ecrivains++;
  const nom = path.relative(RACINE, f).split(path.sep).join('/');
  for (const rhs of ecritures) if (!permis(rhs, net)) fautes.push(`${nom} : verdict = ${rhs}`);
  /* L'import se lit sur le code avec ses chaînes : le chemin en est une. */
  if (/\bverdictDe\(/.test(net)
      && !/import\s*\{[^}]*\bverdictDe\b[^}]*\}\s*from\s*['"][./]*shared\/verdict\.js['"]/.test(code)) {
    fautes.push(`${nom} : appelle verdictDe sans l’importer de src/shared/verdict.js`);
  }
}
check('le détecteur trouve les écrivains qu’on connaît (le duel et la répétition, au moins)',
  ecrivains >= 2 || (console.log('        écrivains :', ecrivains), false));
check('tout verdict écrit par src/server vient de verdictDe, ou recopie un verdict nommé',
  fautes.length === 0 || (console.log('        ' + fautes.join('\n        ')), false));

/* Le détecteur lui-même, sur des lignes fabriquées : sans ça, une expression
   régulière qui ne trouverait plus rien serait verte pour toujours. */
const temoins = {
  'x = { verdict: verdictDe(q) };': true,
  'chant.verdict = verdictDe(mesure.note);': true,
  'emit({ verdict: r.verdict, quality });': true,
  'const v = verdictDe(n); emit({ verdict: v });': true,
  'const { verdict: v } = r;': null,
  "console.error('[nvn] verdict : la note rejouée', x);": null,
  "emit({ verdict: q > 0.9 ? 'parfait' : 'bon' });": false,
  "chant.verdict = 'parfait';": false,
  'const mot = choisir(q); emit({ verdict: mot });': false,
};
const temoinsFaux = Object.entries(temoins).filter(([ligne, ok]) => {
  const { net, ecritures } = ecrituresDeVerdict(ligne);
  if (ok === null) return ecritures.length !== 0;
  return ecritures.length !== 1 || permis(ecritures[0], net) !== ok;
}).map(([ligne]) => ligne);
check('le détecteur reconnaît une échelle écrite à la main, et laisse passer le module, une lecture et un journal',
  temoinsFaux.length === 0 || (console.log('        mal lus :', temoinsFaux.join(' · ')), false));

/* ---------------------------------- 6. le module se charge des deux côtés */

console.log('\n— le module, sans dépendance —');

const source = await readFile(path.join(RACINE, 'src/shared/verdict.js'), 'utf8');
const code = sansCommentaires(source);
check('src/shared/verdict.js n’importe rien et ne lit ni window, ni document, ni process',
  !/\bimport\b|\brequire\s*\(|\bwindow\b|\bdocument\b|\bprocess\b/.test(code));

/* ------------------------- 7. la note écrite en millièmes garde son verdict

   Le bilan du Virage ne relit pas la note du geste : il relit
   `virage_presence.meilleur_q`, en millièmes, et en tire le verdict du
   meilleur geste (`verdictDe(q / 1000)`, `ferveur/bilan.js`). Arrondi au plus
   proche, un 0,9004 ferait 900 : BON au bilan pour un geste annoncé PARFAIT en
   tribune. Le Virage arrondit donc au millième supérieur (`enMilliemes`) — et
   cela ne suffit que si chaque seuil est lui-même un millième exact : un seuil
   à 0,9005 casserait l'aller-retour sans que rien ne lève. Les deux moitiés de
   la règle sont gardées ensemble, ici. */

console.log('\n— la note en millièmes garde son verdict —');

check('chaque seuil est un millième exact (sans quoi aucun arrondi au millième ne garde le mot)',
  Object.values(V.SEUILS).every((s) => Math.abs(s * 1000 - Math.round(s * 1000)) < 1e-9)
  || (console.log('        seuils :', JSON.stringify(V.SEUILS)), false));

/* Chaque millième de 0 à 1,2, et des notes de part et d'autre de chaque seuil,
   jusqu'à un dix-millionième : en deçà, c'est le bruit des flottants que
   `enMilliemes` efface exprès ((0,1 + 0,2) × 1 000 = 300,00000000000006). */
const NOTES = [];
for (let k = 0; k <= 1200; k++) NOTES.push(k / 1000);
for (const s of Object.values(V.SEUILS)) {
  for (const d of [1e-7, 1e-5, 1e-4, 4e-4, 5e-4, 6e-4, 9e-4]) NOTES.push(s + d, s - d);
}
const perdusPar = (ecrire) => NOTES.filter((n) => V.verdictDe(ecrire(n) / 1000) !== V.verdictDe(n));
const perdus = perdusPar(enMilliemes);
check(`écrite par enMilliemes (ferveur/virage.js), la note garde son verdict (${NOTES.length} notes)`,
  perdus.length === 0
  || (console.log('        perdus :', perdus.slice(0, 6).map((n) => `${n} → ${enMilliemes(n)}`).join(' · ')), false));
check('et le contrôle distingue : arrondie au plus proche ou tronquée, la note perd des PARFAITS',
  perdusPar((n) => Math.round(n * 1000)).length > 0 && perdusPar((n) => Math.floor(n * 1000)).length > 0);
check('enMilliemes tient dans meilleur_q (0 à 1 200) et efface le bruit des flottants',
  enMilliemes(1.2) === 1200 && enMilliemes(5) === 1200 && enMilliemes(-1) === 0
    && enMilliemes(NaN) === 0 && enMilliemes(0.1 + 0.2) === 300 && enMilliemes(0.9) === 900
  || (console.log('        vu :', [1.2, 5, -1, NaN, 0.1 + 0.2, 0.9].map(enMilliemes).join(', ')), false));

/* ------------------------------------------------------------------ fin */

console.log(rates ? `\n${rates} test(s) en échec` : '\ntout est vert');
process.exitCode = rates ? 1 : 0;
