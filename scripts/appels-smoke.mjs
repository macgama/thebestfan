/**
 * Une page nomme-t-elle quelque chose qui n'existe pas ?
 *
 * Deux formes du même défaut, et elles sont muettes toutes les deux : une
 * **fonction** appelée que rien ne définit, et un **code d'erreur** que le
 * serveur envoie et que la page ne sait pas traduire. Aucune ne rougit, aucune
 * ne se voit à la lecture, et les deux n'éclatent que sur un chemin d'erreur
 * — c'est-à-dire le jour où quelqu'un avait déjà un problème.
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
 *
 * `chaines: false` garde le contenu des chaînes et n'efface que les
 * commentaires. C'est ce qu'il faut quand **ce qu'on cherche est une chaîne**
 * — les codes d'erreur du bloc des refus, plus bas. Le blanchiment complet y
 * rendait zéro résultat, donc deux contrôles verts pour la pire des raisons :
 * ils ne mesuraient plus rien. Le parcours reste le même dans les deux cas,
 * et c'est ce qui compte — il faut traverser une chaîne pour savoir que le
 * `//` d'une adresse web n'ouvre pas un commentaire.
 *
 * **Et tout se compte en points de code, jamais en unités UTF-16.** Un émoji
 * hors du plan de base (🟥, 🟨 : le ticket terrain du Virage) tient en deux
 * unités pour `s.length` et `s[i]`, en un seul point de code pour
 * `Array.from(s)`. Le tableau de sortie était indexé d'une façon et le parcours
 * de l'autre : chaque émoji décalait d'un cran tout l'effacement qui suivait,
 * qui tombait alors un caractère trop tard — le début de « nomCourt », de
 * « String » ou de « function » partait avec, et la page dénonçait soixante-
 * quatre noms qu'elle déclare pourtant. On travaille donc sur `t`, le tableau
 * des points de code, pour lire comme pour écrire : un seul compte, partout.
 */
export const blanchir = (s, { chaines = true } = {}) => {
  const t = Array.from(s);
  const out = t.slice();
  const efface = (a, b) => {
    if (!chaines) return;
    for (let k = a; k < b; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  /* Les commentaires partent toujours : c'est le seul endroit où l'on trouve
     du français qui ressemble à du code, dans un sens comme dans l'autre. */
  const effaceToujours = (a, b) => {
    for (let k = a; k < b; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  /* Les gabarits ouverts, et pour chacun la profondeur d'accolades où l'on se
     trouve : le « } » qui la ramène à zéro rend la main au texte du gabarit.
     Une pile, parce qu'un gabarit peut en contenir un autre — et le dépôt le
     fait, dans les fonctions qui rendent une carte. */
  const pile = [];
  /* Le texte du gabarit jusqu'au prochain « ${ » ou au « ` » de fin. */
  const texte = (depuis) => {
    let j = depuis;
    while (j < t.length) {
      if (t[j] === '\\') { j += 2; continue; }
      if (t[j] === '`' || (t[j] === '$' && t[j + 1] === '{')) break;
      j += 1;
    }
    efface(depuis, j);
    return j;
  };
  /* Où se ferme un commentaire de bloc : la première paire « * / » à partir de
     « depuis ». Un tableau de points de code n'a pas d'« indexOf » de sous-
     chaîne, et la chercher sur `s` rendrait un indice d'unités UTF-16. */
  const finDuBloc = (depuis) => {
    for (let k = depuis; k < t.length - 1; k += 1) {
      if (t[k] === '*' && t[k + 1] === '/') return k;
    }
    return -1;
  };
  let i = 0;
  while (i < t.length) {
    const c = t[i];
    const d = t[i + 1];
    if (c === '/' && d === '/') {
      const j = t.indexOf('\n', i); const f = j < 0 ? t.length : j;
      effaceToujours(i, f); i = f; continue;
    }
    if (c === '/' && d === '*') {
      const j = finDuBloc(i + 2); const f = j < 0 ? t.length : j + 2;
      effaceToujours(i, f); i = f; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < t.length && t[j] !== c) { if (t[j] === '\\') j += 1; j += 1; }
      efface(i + 1, j); i = j + 1; continue;
    }
    if (c === '`') {
      const j = texte(i + 1);
      if (t[j] === '$') { pile.push(1); i = j + 2; continue; }
      i = j + 1; continue;
    }
    if (pile.length && (c === '{' || c === '}')) {
      pile[pile.length - 1] += c === '{' ? 1 : -1;
      if (pile[pile.length - 1] === 0) {
        const j = texte(i + 1);
        if (t[j] === '$') { pile[pile.length - 1] = 1; i = j + 2; continue; }
        pile.pop(); i = j + 1; continue;
      }
    }
    /* Une expression régulière, ou une division ? Seul ce qui précède tranche,
       et c'est la vieille ambiguïté de la grammaire de JavaScript. Le signe
       d'avant suffit ici : ce dépôt ne divise jamais par une parenthèse
       fermante suivie d'un slash. */
    if (c === '/') {
      /* Le dernier signe qui n'est pas une espace, en remontant. Même résultat
         que « (\S)\s*$ » sur le texte d'avant, sans recopier tout ce texte à
         chaque barre oblique, et en points de code comme le reste. */
      let k = i - 1;
      while (k >= 0 && /\s/.test(t[k])) k -= 1;
      const p = k >= 0 ? t[k] : '';
      if (p === '' || '=(,:;!&|?{}[+-*%~^'.includes(p) || /[A-Za-z]/.test(p) === false) {
        let j = i + 1; let crochet = false; let ok = false;
        while (j < t.length && t[j] !== '\n') {
          if (t[j] === '\\') { j += 2; continue; }
          if (t[j] === '[') crochet = true;
          else if (t[j] === ']') crochet = false;
          else if (t[j] === '/' && !crochet) { ok = true; break; }
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

  /* **Un émoji hors plan de base ne décale rien.** C'est la panne du ticket
     terrain du Virage : deux carrés de couleur dans une chaîne (🟥, 🟨), et
     soixante-quatre noms de la page dénoncés à tort. Chaque émoji valait deux
     unités UTF-16 pour le parcours et un point de code pour la sortie, donc un
     cran de retard de plus à chaque émoji, mesuré sur l'ancien parcours : un
     seul efface le « $ » du « ${ » qui suit, deux font perdre son début à
     « function » après un commentaire, trois mangent la première lettre du nom
     qui suit « ${ » (« nomCourt » devenait « omCourt »). La page en portait
     trois, d'où les soixante-quatre. Le jeu d'essai en met quatre pour tenir
     les trois cas d'un coup.

     Les émojis sont écrits en échappements : le contrôle ne dépend ni de
     l'encodage du fichier, ni de l'éditeur qui le rouvre. */
  const rouge = '\u{1F7E5}'; const jaune = '\u{1F7E8}'; const vert = '\u{1F7E9}';
  const avecEmojis = 'const carte = (c) => c ? \'' + rouge + '\' : \'' + jaune + '\';\n'
    + 'const tag = \'' + vert + '\';\n'
    + 'const m = `' + rouge + ' ${nomCourt(x)}`;\n'
    + 'const un = `un ${premier(1)} deux ${second(2)} trois`;\n'
    + 'const re = /[/]perdre(s)/g; vrai();\n'
    + 'n / dedans() / 2;\n'
    + '/* note */\nfunction scoreTerrain() {}\nscoreTerrain();';
  const blanc = blanchir(avecEmojis);
  /* Un contrôle par endroit du parcours qui lit le texte : le gabarit et ses
     interpolations, l'expression régulière (sa fin, puis la division qui la
     distingue), le commentaire de bloc. Chacun a son contrôle, parce que
     chacun a failli relire `s` en unités sans que les autres le disent. */
  check('un émoji hors plan de base ne décale pas l’effacement qui suit',
    /\$\{nomCourt\(x\)\}/.test(blanc)
    && /\$\{premier\(1\)\}/.test(blanc) && /\$\{second\(2\)\}/.test(blanc)
    && /\bvrai\(\);/.test(blanc)
    && /\bdedans\(\) \/ 2;/.test(blanc)
    && /\nfunction scoreTerrain\(\) \{\}\nscoreTerrain\(\);$/.test(blanc));
  check('et ce qui doit partir part encore : les émojis, le texte, le commentaire, la regex',
    ![rouge, jaune, vert].some((e) => blanc.includes(e))
    && !/note/.test(blanc) && !/perdre/.test(blanc) && !/deux/.test(blanc));
  check('ni une ligne ni un point de code ne bougent',
    blanc.split('\n').length === avecEmojis.split('\n').length
    && Array.from(blanc).length === Array.from(avecEmojis).length);
  /* Sans l'effacement des chaînes, le contenu reste, émoji compris : c'est ce
     que lisent les contrôles de codes d'erreur plus bas, et un « /^🟥 Keller$/ »
     écrit dans une chaîne n'a pas à se faire mordre. */
  const chaine = 'const t = \'' + rouge + ' Keller\'; /* x */ vrai();';
  check('chaines: false garde l’émoji d’une chaîne et n’efface que le commentaire',
    blanchir(chaine, { chaines: false }) === chaine.replace('/* x */', '       '));
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

  /* Le ticket terrain du Virage : des émojis hors plan de base (🟥, 🟨, 🟩, en
     échappements) avant des fonctions déclarées. Le faux positif d'origine
     dénonçait soixante-quatre noms que la page écrit pourtant elle-même ; et,
     du même geste, la fonction vraiment absente doit rester dénoncée — le
     contrôle ne doit pas se taire parce qu'il y a des émojis. */
  const ticket = '<script>const carte = (c) => c ? \'\u{1F7E5}\' : \'\u{1F7E8}\';\n'
    + 'const tag = \'\u{1F7E9}\'; const m = `\u{1F7E5} ${nomCourt(1)}`;\n'
    + '/* ticket */\nfunction nomCourt(n) { return scoreTerrain(n); }\n'
    + 'function scoreTerrain(n) { return n; }</script>';
  check('une page qui porte des émojis n’est pas dénoncée pour ce qu’elle déclare',
    orphelins(ticket, () => null).length === 0);
  check('et ce qui lui manque reste dénoncé malgré les émojis',
    orphelins(ticket.replace('return scoreTerrain(n);', 'return toast(n);'), () => null)
      .join() === 'toast');
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

/* ============================== les refus que le joueur doit pouvoir lire

 * **Le duel refusait en langage machine.** `Cheat` préfixe ses codes de
 * `ferveur.error.` — c'est la classe du Virage, réutilisée par le duel — et
 * la page du duel les avait écrits sous `nvn.error.`, qui est le préfixe des
 * refus du duel **en cours**. Trois phrases parfaitement rédigées ne
 * servaient donc à personne, et un joueur sans deck lisait « Refusé par le
 * serveur : ferveur.error.no_deck » sur le geste le plus courant du jeu.
 *
 * Un tableau de traduction dont une entrée ne correspond à rien a l'air d'un
 * travail fait. C'est ce qui rend ce défaut-là si long à voir : on relit la
 * phrase, on la trouve bonne, et on passe.
 */
console.log('\n— les refus');
{
  const src = (f) => readFileSync(path.join(PUB, '..', f), 'utf8');
  /* Le serveur et la page, côte à côte. On lit les deux plutôt que d'en
     recopier un : une liste recopiée ne mesure plus que sa propre copie. */
  const sansCommentaires = blanchir(src('src/server/nvn/index.js'),
    { chaines: false });
  const emis = new Set([...sansCommentaires
    .matchAll(/new Cheat\('([a-z_]+)'\)/g)].map((m) => `ferveur.error.${m[1]}`));
  const page = src('public/duel-nvn.html');
  const traduits = new Set([...page.matchAll(/'((?:nvn|ferveur)\.error\.[a-z_]+)'\s*:/g)]
    .map((m) => m[1]));

  check(`le duel peut refuser de ${emis.size} façons`, emis.size >= 4);
  const muets = [...emis].filter((c) => !traduits.has(c));
  check(muets.length
    ? `${muets.length} refus s’affichent en code brut : ${muets.join(', ')}`
    : 'et chacun a sa phrase sur la page du duel', muets.length === 0);

  /* **Et l'inverse.** Une phrase écrite sous un code que personne n'envoie
     est du travail perdu, et surtout le signe qu'on s'est trompé de préfixe
     — c'est exactement comme ça que les trois autres se cachaient. On ne
     regarde que les codes du duel : le Virage a sa page, et elle partage ce
     tableau pour les refus de chant. */
  const duServeur = new Set([...sansCommentaires
    .matchAll(/'(nvn\.error\.[a-z_]+)'/g)].map((m) => m[1]));
  const orphelines = [...traduits]
    .filter((c) => c.startsWith('nvn.error.') && !duServeur.has(c));
  check(orphelines.length
    ? `${orphelines.length} phrase(s) sous un code que rien n’envoie : ${orphelines.join(', ')}`
    : 'et aucune phrase n’attend un code qui n’arrive jamais',
    orphelines.length === 0);
}

/* =============================== et les refus du Virage, qui manquaient ici
 *
 * **Le contrôle du dessus ne regardait que le duel**, et il le disait : « le
 * Virage a sa page ». Personne ne regardait celle-là. Dix-sept refus y
 * tombaient sur « Refusé par le serveur » — tout le contrôle anti-triche des
 * quatorze mini-jeux.
 *
 * Deux raisons, et chacune suffisait :
 *
 *   — le motif ne connaissait que `new Cheat`, jamais `new Triche`, qui est la
 *     classe des épreuves ;
 *   — et il cherchait `([a-z_]+)`, **sans le point**. Les codes d'épreuve
 *     s'écrivent `trace.trop_longue`, `reponse.trop_reguliere` : aucun ne
 *     pouvait correspondre, même en visant le bon fichier.
 *
 * Un contrôle qui ne peut structurellement rien trouver est pire qu'absent : il
 * compte dans le vert et laisse croire que la question est traitée.
 *
 * ## Les familles
 *
 * La page ne nomme pas les dix-sept un par un — elle répond à la **raison** du
 * refus, qui se répète d'une épreuve à l'autre : `.trop_rapide`, `.invalide`,
 * `.hors_delai`… Voir `familleDuRefus` dans `virage.html`, et le commentaire
 * qui explique pourquoi dix-sept lignes écrites à la main redeviendraient
 * incomplètes à la prochaine épreuve.
 *
 * Les suffixes sont donc recopiés ici, et c'est assumé : un contrôle qui lirait
 * sa référence dans le fichier qu'il contrôle serait d'accord avec lui par
 * construction. Le jour où une famille change de nom d'un seul côté, celui-ci
 * rougit — et c'est exactement ce qu'on lui demande.
 */
console.log('\n— les refus du Virage');
{
  const src = (f) => readFileSync(path.join(PUB, '..', f), 'utf8');
  const serveur = ['virage.js', 'gestures.js', 'epreuves.js', 'index.js']
    .map((f) => blanchir(src(`src/server/ferveur/${f}`), { chaines: false })).join('\n');

  /* `Cheat` **et** `Triche`, et le point dans le nom. */
  const emis = new Set([...serveur.matchAll(/new (?:Cheat|Triche)\('([a-z_.]+)'\)/g)]
    .map((m) => `ferveur.error.${m[1]}`));
  /* Les deux que la couche réseau envoie sans passer par une exception. */
  for (const c of [...serveur.matchAll(/code:\s*'([a-z]+\.error\.[a-z_.]+)'/g)]) {
    emis.add(c[1]);
  }

  const page = src('public/virage.html');
  const nommes = new Set([...page.matchAll(/'([a-z]+\.error\.[a-z_.]+)'\s*:/g)].map((m) => m[1]));
  const FAMILLES = [/\.trop_rapide$/, /\.trop_reguliere$/, /\.trop_juste$/, /\.hors_delai$/,
    /\.(?:trop_nombreuses|trop_nombreux|trop_longue)$/, /\.invalide$/,
    /^ferveur\.error\.(?:epreuve|consigne)\./];

  check(`le Virage peut refuser de ${emis.size} façons`, emis.size >= 20);
  const muets = [...emis]
    .filter((c) => !nommes.has(c) && !FAMILLES.some((f) => f.test(c)));
  check(muets.length
    ? `${muets.length} refus s’affichent en code brut : ${muets.join(', ')}`
    : 'et chacun a sa phrase, nommément ou par famille', muets.length === 0);
}

console.log(fautes ? `\n${fautes} faute(s)` : '\ntout est vert');
process.exit(fautes ? 1 : 0);
