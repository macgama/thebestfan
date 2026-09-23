/**
 * Une page appelle-t-elle une aide que personne ne lui donne ?
 *
 * ## Pourquoi ce contrôle existe
 *
 * Le kiosque des boosters avait une case à messages — un « div.toast » au bas
 * du document — et deux appels pour la remplir : le refus d'ouverture, qui
 * traduit le code du serveur en français, et la carte inconnue du catalogue.
 * Il manquait la fonction. Les deux appels levaient un « ReferenceError » au
 * lieu d'afficher quoi que ce soit, à l'intérieur de « openPack », hors de
 * toute reprise : un refus propre du serveur arrêtait la page en plein geste.
 *
 * Personne ne pouvait le voir. Les deux chemins concernés sont des chemins
 * d'erreur — on ne les emprunte pas en jouant, et aucune suite ne les visait.
 * Le seul symptôme était une épreuve rouge une fois sur dix dans la série
 * complète, verte à chaque essai en isolation. On ne lisait pas « une page
 * fragile », on lisait « un test capricieux » : la lecture la plus coûteuse
 * qu'on puisse faire d'un rouge.
 *
 * ## Ce qu'il regarde
 *
 * Pour chaque page de « public/ », les noms qu'elle **appelle** dans son code
 * en ligne, moins ceux qu'elle déclare, moins ceux que déclarent les scripts
 * qu'elle charge, moins ce que le navigateur fournit. Ce qui reste n'existe
 * pas au moment de l'appel.
 *
 * C'est un contrôle de texte, pas d'exécution : il ne demande ni base, ni
 * navigateur, ni serveur, et il passe en une seconde. C'est ce qui lui permet
 * d'être lancé à chaque fois plutôt qu'aux grandes occasions.
 *
 * ## Ce qu'il ne regarde pas
 *
 * Les variables lues sans être appelées, et les méthodes — « a.b() » a son
 * point, on ne sait pas ce que vaut « a ». Le jour où une page appellera une
 * fonction qui existe mais ne fait pas ce qu'il faut, ce n'est pas ici que ça
 * se verra.
 *
 * Usage : node scripts/appels-smoke.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PUB = path.join(fileURLToPath(new URL('..', import.meta.url)), 'public');

let fautes = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) fautes += 1; };

/* ------------------------------------------------------------ le blanchiment

 * **On cherche du code, et une page en est pleine de ce qui lui ressemble.**
 *
 * Le premier jet comptait « rgba( », « translateX( », « var( » — du CSS écrit
 * dans un gabarit — et « perdre(s) », « essaie(r) » — du français écrit dans un
 * commentaire. Soixante-six noms, dont aucun vrai. Un contrôle qui rend
 * soixante-six faux positifs ne se lit pas : on le désactive la semaine
 * suivante, et il aurait autant valu ne pas l'écrire.
 *
 * Alors on efface d'abord les commentaires, les chaînes et les expressions
 * régulières, en remplaçant chaque caractère par une espace pour que les
 * numéros de ligne ne bougent pas. Mais **pas les « ${…} »** : ce qu'il y a
 * entre les accolades d'un gabarit est du code comme le reste, et c'est même
 * là que vivent la moitié des appels de ce dépôt.
 */
export const blanchir = (s) => {
  const out = Array.from(s);
  const efface = (a, b) => { for (let k = a; k < b; k += 1) if (out[k] !== '\n') out[k] = ' '; };
  /* Les gabarits ouverts, et pour chacun la profondeur d'accolades où l'on se
     trouve : le « } » qui la ramène à zéro rend la main au texte du gabarit.
     Une pile, parce qu'un gabarit peut en contenir un autre — et le dépôt le
     fait, dans les fonctions qui rendent une carte. */
  const pile = [];
  /* Le texte du gabarit jusqu'au prochain « ${ » ou au « ` » de fin. */
  const texte = (depuis) => {
    let j = depuis;
    while (j < s.length) {
      if (s[j] === '\\') { j += 2; continue; }
      if (s[j] === '`' || (s[j] === '$' && s[j + 1] === '{')) break;
      j += 1;
    }
    efface(depuis, j);
    return j;
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const d = s[i + 1];
    if (c === '/' && d === '/') {
      const j = s.indexOf('\n', i); const f = j < 0 ? s.length : j;
      efface(i, f); i = f; continue;
    }
    if (c === '/' && d === '*') {
      const j = s.indexOf('*/', i + 2); const f = j < 0 ? s.length : j + 2;
      efface(i, f); i = f; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < s.length && s[j] !== c) { if (s[j] === '\\') j += 1; j += 1; }
      efface(i + 1, j); i = j + 1; continue;
    }
    if (c === '`') {
      const j = texte(i + 1);
      if (s[j] === '$') { pile.push(1); i = j + 2; continue; }
      i = j + 1; continue;
    }
    if (pile.length && (c === '{' || c === '}')) {
      pile[pile.length - 1] += c === '{' ? 1 : -1;
      if (pile[pile.length - 1] === 0) {
        const j = texte(i + 1);
        if (s[j] === '$') { pile[pile.length - 1] = 1; i = j + 2; continue; }
        pile.pop(); i = j + 1; continue;
      }
    }
    /* Une expression régulière, ou une division ? Seul ce qui précède tranche,
       et c'est la vieille ambiguïté de la grammaire de JavaScript. Le signe
       d'avant suffit ici : ce dépôt ne divise jamais par une parenthèse
       fermante suivie d'un slash. */
    if (c === '/') {
      const p = (s.slice(0, i).match(/(\S)\s*$/) ?? ['', ''])[1];
      if (p === '' || '=(,:;!&|?{}[+-*%~^'.includes(p) || /[A-Za-z]/.test(p) === false) {
        let j = i + 1; let crochet = false; let ok = false;
        while (j < s.length && s[j] !== '\n') {
          if (s[j] === '\\') { j += 2; continue; }
          if (s[j] === '[') crochet = true;
          else if (s[j] === ']') crochet = false;
          else if (s[j] === '/' && !crochet) { ok = true; break; }
          j += 1;
        }
        if (ok) { efface(i + 1, j); i = j + 1; continue; }
      }
    }
    i += 1;
  }
  return out.join('');
};

/* ------------------------------------------------------------- le vocabulaire

 * Les mots-clés qui prennent une parenthèse — « if( », « for( », « catch( » —
 * et ce que le navigateur pose sur « window ». Une liste écrite à la main,
 * qu'il faudra compléter le jour où une page emploiera une API absente d'ici :
 * le contrôle dira alors « appelé sans déclaration », et la réponse sera
 * d'ajouter le nom ci-dessous. C'est un faux positif bon marché, et le prix à
 * payer pour ne pas avoir à comprendre la page.
 */
const MOTS = new Set(('if for while switch catch return typeof function do else async'
  + ' await new delete void yield throw in of case with try finally get set static').split(' '));

const GLOBAUX = new Set((
  'setTimeout clearTimeout setInterval clearInterval requestAnimationFrame'
  + ' cancelAnimationFrame requestIdleCallback fetch alert confirm prompt open close'
  + ' parseInt parseFloat isNaN isFinite String Number Boolean Array Object Date'
  + ' Math JSON Promise Map Set WeakMap WeakSet Error TypeError RangeError Symbol'
  + ' RegExp Proxy Reflect BigInt encodeURIComponent decodeURIComponent encodeURI'
  + ' decodeURI btoa atob structuredClone queueMicrotask getComputedStyle matchMedia'
  + ' scrollTo scrollBy addEventListener removeEventListener dispatchEvent CustomEvent'
  + ' Event MouseEvent KeyboardEvent PointerEvent TouchEvent URL URLSearchParams'
  + ' FormData Headers Request Response Intl AbortController IntersectionObserver'
  + ' ResizeObserver MutationObserver Audio Image Worker Blob File FileReader'
  + ' Notification DOMParser XMLHttpRequest WebSocket EventSource Function'
  + ' import require super eval print focus blur postMessage reportError'
  /* « io » vient de socket.io, servi par le serveur et non par « public/ ». */
  + ' io'
).split(' '));

/** Un nom suivi d'une parenthèse, et qui n'est pas une méthode. */
const APPELS = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;

/**
 * Tout ce qu'un fichier met à disposition de la suite.
 *
 * **On déclare large, volontairement.** Un nom oublié ici devient un faux
 * positif, c'est-à-dire un rouge qu'on ne peut pas corriger ; un nom pris pour
 * déclaré alors qu'il ne l'est pas coûte seulement de manquer un défaut. Entre
 * les deux, le contrôle qui survit est celui qui ne crie pas pour rien.
 */
const declare = (src) => {
  const out = new Set();
  for (const m of src.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const n of m[1].split(',')) {
      const v = n.split(':').pop().split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(v)) out.add(v);
    }
  }
  for (const m of src.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  for (const m of src.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) out.add(m[1]);
  /* Les paramètres : un rappel se déclare là et nulle part ailleurs. */
  for (const m of src.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) {
    for (const n of m[1].split(',')) {
      const v = n.split('=')[0].replace(/^\.\.\./, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(v)) out.add(v);
    }
  }
  for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) out.add(m[1]);
  /* La méthode abrégée d'un objet : « async apercu() { » dans l'administration.
     Sans elle, chacune des neuf vues se dénonçait elle-même. */
  for (const m of src.matchAll(/(?:^|[{,;]|\basync\b)\s*([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/gm)) {
    out.add(m[1]);
  }
  for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?(?:function|\()/g)) out.add(m[1]);
  return out;
};

/** Le code en ligne d'une page : ses balises « script » sans « src ». */
const enLigne = (page) => blanchir(
  [...page.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n'));

/** Les noms qu'une page appelle sans les avoir. */
const orphelins = (page, lire) => {
  const code = enLigne(page);
  const connus = declare(code);
  for (const m of page.matchAll(/<script[^>]*src="\/([\w.-]+\.js)"/g)) {
    const src = lire(m[1]);
    if (src !== null) for (const n of declare(blanchir(src))) connus.add(n);
  }
  const manque = new Set();
  for (const m of code.matchAll(APPELS)) {
    const n = m[1];
    if (!MOTS.has(n) && !GLOBAUX.has(n) && !connus.has(n)) manque.add(n);
  }
  return [...manque];
};

/* ==================================================== le blanchiment tient-il ?

 * **Un blanchiment trop gourmand rend un contrôle toujours vert.** S'il efface
 * le code au lieu des commentaires, il n'y a plus d'appels à trouver et le
 * tableau est parfait. C'est la panne qu'on ne voit jamais : elle ne rougit
 * pas, elle rassure. Le contrôle d'interface de ce dépôt l'a eue — il auditait
 * zéro page en annonçant « rien à signaler » — et on ne l'a pas vue passer.
 *
 * Alors on éprouve l'outil avant de s'en servir.
 */
console.log('\n— le blanchiment');
{
  const g = '`du texte ${appelle(x)} et la suite`';
  check('le texte d’un gabarit part, le code des ${…} reste',
    !/texte/.test(blanchir(g)) && /appelle\(x\)/.test(blanchir(g)));

  check('un commentaire ne laisse pas d’appel',
    blanchir('/* on perdre(s) des heures */ vrai()').match(APPELS)?.length === 1);

  check('une chaîne non plus',
    blanchir("const a = 'rgba(0,0,0,.5)'; vrai();").match(APPELS)?.length === 1);

  check('une expression régulière non plus',
    blanchir('const r = /\\d+(\\.\\d+)?/g; vrai();').match(APPELS)?.length === 1);

  check('les lignes ne bougent pas',
    blanchir('a\n/* deux\nlignes */\nb').split('\n').length === 4);

  /* Une division n'est pas une expression régulière, et la confondre effacerait
     la fin de la ligne — donc les appels qui s'y trouvent. */
  check('une division reste une division',
    /apres\(/.test(blanchir('const x = a / b; apres();')));
}

/* ==================================================== le contrôle se déclenche-t-il ?

 * Le canari. Une page fabriquée qui appelle une fonction absente doit être
 * dénoncée ; la même page, la fonction écrite, doit passer. Sans ces deux
 * lignes, tout ce qui précède pourrait rendre « rien à signaler » pour la pire
 * des raisons.
 */
console.log('\n— le contrôle se déclenche');
{
  const sans = '<script>function go(){ toast("plus de booster"); }</script>';
  const avec = '<script>function toast(t){} function go(){ toast("x"); }</script>';
  check('une page qui appelle une aide absente est dénoncée',
    orphelins(sans, () => null).includes('toast'));
  check('la même, l’aide écrite, ne l’est plus',
    orphelins(avec, () => null).length === 0);
  /* C'est exactement la panne du kiosque : la case existait, l'appel existait,
     la fonction non. */
  const depuisUnAutreFichier = '<script src="/aides.js"></script>'
    + '<script>function go(){ toast("x"); }</script>';
  check('une aide venue d’un script chargé compte comme présente',
    orphelins(depuisUnAutreFichier, () => 'function toast(t){}').length === 0);
}

/* ==================================================== les pages du jeu */
console.log('\n— les pages');
const lire = (nom) => {
  const p = path.join(PUB, nom);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};
const pages = readdirSync(PUB).filter((n) => n.endsWith('.html')).sort();

/* Aucune page trouvée serait un tableau vert par accident. */
check(`il y a des pages à contrôler (${pages.length})`, pages.length >= 15);

for (const f of pages) {
  const manque = orphelins(readFileSync(path.join(PUB, f), 'utf8'), lire);
  check(manque.length
    ? `${f} appelle ${manque.length} nom(s) que rien ne lui donne : ${manque.join(', ')}`
    : `${f} n’appelle que ce qu’elle a`, manque.length === 0);
}

console.log(fautes ? `\n${fautes} faute(s)` : '\ntout est vert');
process.exit(fautes ? 1 : 0);
