/**
 * Test du repli des états — sans base ni serveur.
 *
 * `fanzzy-etats.js` décide, pour un état demandé qui n'existe pas, lequel
 * afficher à la place. C'est une poignée de boucles imbriquées, elle a l'air
 * juste à la lecture, et elle est exactement du genre à rendre un skin
 * circulaire responsable d'un onglet figé. On la fait donc tourner ici sur un
 * manifeste fabriqué, où l'on contrôle ce qui existe et ce qui manque.
 *
 * Le fichier est un script classique destiné au navigateur : on lui prête un
 * `window`, un `document` et un `fetch`, et on lui prend son global.
 *
 * Usage : node scripts/etats-smoke.mjs
 */
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* Un manifeste taillé pour les cas limites, pas pour ressembler au vrai :
   - TR1 : un stade complet, un stade presque vide au-dessus ;
   - TR2 : un skin partiel qui se replie sur `base` ;
   - TR3 : deux skins qui se renvoient l'un à l'autre — la boucle. */
const INDEX = { fanzzy: {
  TR1: { rev: 4, evolutions: {
    e1: { skins: { base: { etats: ['neutre', 'but', 'pousse'], portrait: true } } },
    e2: { skins: { base: { etats: ['victoire'], portrait: false } } },
  } },
  TR2: { rev: 1, evolutions: {
    e1: { skins: {
      base: { etats: ['neutre', 'but', 'pousse'], portrait: true },
      hiver: { etats: ['neutre', 'pousse'], portrait: false, repli: 'base' },
    } },
  } },
  TR3: { rev: 1, evolutions: {
    e1: { skins: {
      base: { etats: ['neutre'], portrait: true },
      a: { etats: [], portrait: false, repli: 'b' },
      b: { etats: [], portrait: false, repli: 'a' },
    } },
  } },
} };

/* ------------------------------------------------- on prête un navigateur */

const bac = { console };
bac.window = bac;
bac.document = {
  /* Pas de canvas ici, et le module ne doit plus en vouloir : il en demandait
     un pour savoir quel format servir, ce qui était déjà une mauvaise question
     — un canvas dit ce qu'il sait écrire, pas ce que le navigateur sait lire.
     On garde le piège en place pour que le jour où quelqu'un remet une
     détection, ce contrôle le dise au lieu de la laisser passer. */
  createElement: () => { throw new Error('pas de canvas'); },
};
bac.fetch = async () => ({ ok: true, json: async () => INDEX });
bac.Image = class { set src(v) { this._src = v; } get src() { return this._src; } };

const code = await readFile(new URL('../public/fanzzy-etats.js', import.meta.url), 'utf8');
new Script(code, { filename: 'fanzzy-etats.js' }).runInContext(createContext(bac));
const E = bac.window.TBF_ETATS;

check('le module s’expose', typeof E?.resoudre === 'function');
check('douze états', E.ETATS.length === 12);
/* ## Le format ne se devine plus

   Le WebP pour tout le monde — il est lu partout depuis 2020, et chaque image
   du dépôt a son jumeau. Le repli d'un personnage reste le PNG : il est
   détouré, un JPEG lui rendrait son carré noir. Et surtout **aucun Fanzzy
   n'est publié en JPEG** : c'est le `.jpg` que servait l'ancienne détection à
   tout ce qui n'est pas Chrome qui a vidé l'accueil de son personnage sur
   Firefox et sur iPhone. */
check('un seul format servi, lisible partout',
  E.EXT === '.webp' && E.EXT_ALPHA === '.webp');
check('le repli d’un personnage garde sa transparence',
  E.REPLI_ALPHA === '.png' && E.REPLI === '.jpg');
check('le secours remplace l’extension sans manger la révision',
  E.secours('/img/fanzzy/TR1/e1/base/neutre.webp?v=10')
    === '/img/fanzzy/TR1/e1/base/neutre.png?v=10');
check('le secours d’une photo est le JPEG',
  E.secours('/img/accueil.webp', false) === '/img/accueil.jpg');
check('au dernier recours, le secours rend null plutôt que la même adresse',
  E.secours('/img/fanzzy/TR1.png') === null);

/* ------------------------------------------- avant le chargement, rien */

check('rien à résoudre tant que le manifeste n’est pas là',
  E.resoudre('TR1', { etat: 'but' }) === null);

await E.charger();
check('le manifeste est chargé', E.pret() !== null);

/* --------------------------------------------------------- le cas simple */

let r = E.resoudre('TR1', { evo: 1, etat: 'but' });
check('l’état demandé quand il existe',
  r.src === '/img/fanzzy/TR1/e1/base/but.webp?v=4' && r.exact === true);

check('la révision casse le cache', r.src.endsWith('?v=4'));

r = E.resoudre('TR1', { evo: 1, etat: 'encaisse' });
check('un état manquant retombe sur neutre',
  r.etat === 'neutre' && r.evo === 1 && r.exact === false);

/* ----------------------------------------------- le repli entre les stades

   e2 n'a que « victoire ». Demander le but au stade 2 doit descendre au stade
   1, qui l'a : le personnage paraît plus jeune une seconde, mais il exulte.
   L'inverse — un neutre de stade 2 immobile pendant que le club marque —
   serait pris pour un bug d'affichage.                                       */

r = E.resoudre('TR1', { evo: 2, etat: 'but' });
check('la bonne pose passe avant le bon stade',
  r.etat === 'but' && r.evo === 1);

r = E.resoudre('TR1', { evo: 2, etat: 'victoire' });
check('le stade demandé est gardé quand il a la pose',
  r.evo === 2 && r.etat === 'victoire' && r.exact === true);

r = E.resoudre('TR1', { evo: 3, etat: 'victoire' });
check('un stade jamais dessiné descend jusqu’à celui qui existe', r.evo === 2);

/* ------------------------------------------------------ le repli des skins */

r = E.resoudre('TR2', { evo: 1, skin: 'hiver', etat: 'pousse' });
check('le skin demandé garde ce qu’il a', r.skin === 'hiver' && r.exact === true);

r = E.resoudre('TR2', { evo: 1, skin: 'hiver', etat: 'but' });
check('un skin partiel emprunte la pose à son repli',
  r.skin === 'base' && r.etat === 'but');

r = E.resoudre('TR2', { evo: 1, skin: 'inconnu', etat: 'but' });
check('un skin qui n’existe pas retombe sur base', r.skin === 'base');

/* Deux skins qui se renvoient l'un à l'autre : sans garde, la résolution
   tourne sans fin et l'onglet se fige — un défaut qu'aucune relecture
   n'attrape et qu'aucun message d'erreur n'annonce. */
const minuteur = setTimeout(() => {
  console.log(' FAIL  un repli circulaire fige la résolution');
  process.exit(1);
}, 2000);
r = E.resoudre('TR3', { evo: 1, skin: 'a', etat: 'neutre' });
clearTimeout(minuteur);
check('un repli circulaire se termine et retombe sur base', r?.skin === 'base');

/* ------------------------------------------------------------- portraits */

r = E.portrait('TR1', { evo: 1 });
check('le portrait quand il existe',
  r.src === '/img/fanzzy/TR1/e1/base/portrait.webp?v=4' && r.exact === true);

r = E.portrait('TR1', { evo: 2 });
check('un stade sans portrait prend celui d’en dessous',
  r.evo === 1 && r.exact === false);

check('un Fanzzy inconnu ne rend rien',
  E.resoudre('ZZ9', { etat: 'but' }) === null && E.portrait('ZZ9') === null);

/* ------------------------------------------ le vrai manifeste, s'il est là

   Ce contrôle-ci ne vérifie pas la logique mais l'accord entre les deux :
   `fanzzy-manifeste.mjs` écrit une forme, `fanzzy-etats.js` en lit une autre.
   Le jour où l'une bouge sans l'autre, tout compile et plus rien ne
   s'affiche.                                                                */
{
  let vrai = null;
  try { vrai = JSON.parse(await readFile(new URL('../public/img/fanzzy/index.json', import.meta.url), 'utf8')); }
  catch { /* pas encore produit */ }
  if (!vrai) {
    console.log('  --   index.json absent : lance scripts/fanzzy-manifeste.mjs');
  } else {
    const ids = Object.keys(vrai.fanzzy ?? {});
    bac.fetch = async () => ({ ok: true, json: async () => vrai });
    const bac2 = createContext({ ...bac, window: undefined });
    bac2.window = bac2;
    new Script(code, { filename: 'fanzzy-etats.js' }).runInContext(bac2);
    await bac2.window.TBF_ETATS.charger();
    /* **Pour au moins une des tenues qu'il déclare**, et non pour `base`.

       Ce contrôle demandait la tenue par défaut à chaque entrée. Il a rougi
       le jour où une lignée a reçu son costume d'Halloween sans avoir de
       base dans ce système-ci : RP21 est dessiné, mais dans l'**ancien**
       format plat — `/img/fanzzy/RP21.webp` — que `FZART` sert très bien.

       Rien n'était cassé. Un joueur sans tenue voit le dessin plat, un
       joueur en Halloween voit son costume, et les deux chemins marchent.
       Le contrôle exigeait simplement une chose que le manifeste n'a jamais
       promis : qu'une entrée contienne forcément `base`.

       Ce qu'il doit garder, et qu'il garde : **une entrée qui ne se résout
       pour rien du tout est cassée**. Une tenue déclarée sans dessin, un
       `repli` qui boucle, un âge vide — tout ça rougit encore. */
    const tenuesDe = (id) => [...new Set(Object.values(vrai.fanzzy[id].evolutions ?? {})
      .flatMap((e) => Object.keys(e.skins ?? {})))];

    const muets = ids.filter((id) => !tenuesDe(id).some((skin) => {
      const r = bac2.window.TBF_ETATS.resoudre(id, { etat: 'neutre', skin });
      return r && r.src.startsWith('/img/fanzzy/');
    }));

    check(`les ${ids.length} Fanzzy du manifeste réel se résolvent tous`,
      muets.length === 0
      || (console.log('        ne rendent rien :', muets.join(', ')), false));
  }
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
