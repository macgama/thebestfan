/**
 * Le catalogue tient ses promesses — sans base ni serveur.
 *
 * ## Pourquoi cette suite existe
 *
 * Le catalogue est la seule partie du jeu qui grandit en **contenu** et non en
 * code : quatre cent quatre-vingt-onze cartes, dix-sept pièces d'équipement,
 * vingt-neuf cartes d'action, dix stades. Rien de tout cela ne « casse » : ça
 * dérive. Une famille qui annonce un geste qu'elle ne joue plus, une série sans
 * carte haute, une légendaire qui se met à grandir — ce sont des défauts de
 * cohérence, invisibles à l'exécution, et qu'aucune suite de mécanique ne peut
 * voir puisque le jeu tourne parfaitement avec.
 *
 * Ce sont donc des contrôles de **promesse**, pas de fonctionnement. Chacun
 * correspond à une phrase écrite quelque part dans le projet, et vérifie que le
 * contenu la tient encore.
 *
 * Usage : node scripts/catalogue-smoke.mjs
 */
import { DEX, TYPES, SETS, BY_ID } from '../src/shared/fanzzy/dex.js';
import { STUFF } from '../src/shared/fanzzy/inventaire.js';
import { ACTIONS } from '../src/shared/duel/actions.js';
import { STADES } from '../src/shared/stades.js';
import { GESTES } from '../src/server/ferveur/gestures.js';

let ko = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) ko++; };
const racine = (id) => /^([A-Z]+\d+)/.exec(id)?.[1] ?? id;

/* ============================================ les familles et leurs gestes */

console.log('\nLes familles');

/* **La famille dit ce qu'elle fait.**
 *
 * Elle annonçait un geste au singulier, et trois sur six ne le tenaient pas :
 * Tifo disait « contre » et jouait l'endurance 24 fois sur 38 ; Pyro disait
 * « risque » et jouait surtout le martelage ; Déplacement disait « souffle » et
 * jouait surtout le tempo. Un joueur qui choisissait un Pyro pour son geste de
 * risque prenait un tempo.
 *
 * La liste des gestes d'une famille **est** la règle maintenant. */
{
  const hors = DEX.filter((f) => !TYPES[f.type]?.gestes?.includes(f.cri?.gest));
  check(`les ${DEX.length} cartes portent un geste de leur famille`, hors.length === 0
    || (console.log('        ', hors.slice(0, 6)
      .map((f) => `${f.id} (${f.type}/${f.cri?.gest})`).join(' · ')), false));
}

/* Les dix-sept gestes du jeu sont répartis **sans trou ni doublon**. Un geste
   dans deux familles ne distinguerait plus rien ; un geste dans aucune serait
   injouable comme spécialité de Fanzzy — c'est-à-dire invisible. */
{
  const tous = Object.values(TYPES).flatMap((t) => t.gestes ?? []);
  const orphelins = GESTES.filter((g) => !tous.includes(g));
  const inventes = tous.filter((g) => !GESTES.includes(g));
  const doubles = tous.filter((g, i) => tous.indexOf(g) !== i);
  check(`les ${GESTES.length} gestes sont tous dans une famille`, orphelins.length === 0
    || (console.log('        sans famille :', orphelins.join(', ')), false));
  check('et aucun n’est dans deux', doubles.length === 0
    || (console.log('        en double :', [...new Set(doubles)].join(', ')), false));
  check('et aucune famille n’invente un geste', inventes.length === 0
    || (console.log('        inconnus :', inventes.join(', ')), false));
}

/* **Le geste qui porte le nom de la famille est le plus fréquent chez elle.**
 *
 * Sans quoi la famille ne dirait toujours pas vrai : une Voix dont le tempo
 * serait minoritaire ne serait pas une Voix, quelle que soit sa liste. */
{
  const faibles = [];
  for (const [id, t] of Object.entries(TYPES)) {
    const siens = DEX.filter((f) => f.type === id && f.stage === 1);
    if (siens.length < 4) continue;            // trop peu pour qu'une part ait un sens
    const principal = siens.filter((f) => f.cri.gest === t.gestes[0]).length;
    if (principal * 2 < siens.length) faibles.push(`${t.nom} ${principal}/${siens.length}`);
  }
  check('le geste éponyme domine chez chaque famille', faibles.length === 0
    || (console.log('        minoritaire :', faibles.join(' · ')), false));
}

/* **Et les variantes comptent.**
 *
 * C'est l'autre moitié de la règle, et elle a été écrite après coup parce qu'on
 * s'était contenté de la première. Une famille peut annoncer quatre gestes et
 * n'en jouer qu'un : la Voix comptait vingt-neuf tempo pour **un** contretemps
 * et **un** écho. Les deux variantes existaient au catalogue et n'existaient pas
 * dans le jeu — un joueur qui en voulait une avait une carte sur trente-cinq à
 * trouver.
 *
 * Le seuil est à un huitième de la famille. Il est bas exprès : ce n'est pas une
 * cible d'équilibrage, c'est le plancher sous lequel une variante cesse d'être
 * jouable. La répartition visée est la moitié au geste éponyme et le reste
 * partagé également — ce contrôle rougit bien avant qu'on s'en éloigne
 * dangereusement.
 */
{
  const rares = [];
  for (const [id, t] of Object.entries(TYPES)) {
    const siens = DEX.filter((f) => f.type === id && f.stage === 1);
    if (siens.length < 12) continue;          // trop peu pour qu'une part ait un sens
    const plancher = siens.length / 8;
    for (const g of t.gestes ?? []) {
      const n = siens.filter((f) => f.cri.gest === g).length;
      if (n < plancher) rares.push(`${t.nom}/${g} ${n}/${siens.length}`);
    }
  }
  check('et chaque variante est réellement jouable', rares.length === 0
    || (console.log('        trop rares :', rares.join(' · ')),
      console.log('        — une variante sous un huitième de sa famille '
        + 'n’existe qu’au catalogue'), false));
}

/* **Un âge ne change pas de spécialité.**
 *
 * `agesDe` reprend le geste du premier âge pour les quatre cent trente-cinq
 * âges calculés. Les sept premières lignées datent d'avant et sont écrites à la
 * main : leurs âges avaient dérivé, et un joueur qui faisait grandir son
 * personnage perdait le geste qu'il avait appris.
 *
 * **Ce contrôle ne les voyait pas.** `racine('T2')` rend `'T2'` — le motif
 * `^([A-Z]+\d+)` avale l'identifiant entier quand l'âge s'écrit en entrée
 * numérotée. Il comparait donc T2 avec lui-même, et passait au vert sur
 * exactement les lignées qu'il avait été écrit pour surveiller.
 *
 * Le renommage par série l'a démasqué : `T2` est devenu `MS31B`, le motif s'est
 * arrêté à `MS31`, et deux lignées ont rougi le jour même. Le Colleur
 * d'affiches jouait `tifo` et ses deux âges `tri` ; l'Auto-stoppeur jouait
 * `echarpe` et ses âges `memoire`. Corrigé.
 *
 * La leçon n'est pas sur les gestes : **un raccourci d'identifiant dans un
 * contrôle peut le rendre aveugle à son propre sujet**, sans rien casser et
 * sans jamais rougir. */
{
  const derivent = DEX.filter((f) => f.stage > 1
    && BY_ID.get(racine(f.id))?.cri?.gest !== f.cri?.gest);
  check('un âge garde le geste de son personnage', derivent.length === 0
    || (console.log('        ', derivent.slice(0, 6).map((f) => f.id).join(' · ')), false));
}

/* ====================================================== les séries */

console.log('\nLes séries');

/* **Au moins cinq légendaires par série.**
 *
 * Il y en avait quatorze pour neuf séries — cinq aux REVENANTS, zéro à VIRAGE
 * NORD, au VIRAGE IMPOSSIBLE et à CE QUI TRAÎNE AU STADE. Un joueur qui
 * collectionnait ces trois-là ouvrait des boosters sans sommet.
 *
 * Le contrôle exigeait **exactement** cinq, et il avait tort. Ce qu'on veut
 * vérifier, c'est qu'aucune série n'est sans sommet ; un plafond n'apporte
 * rien. La dissolution de VIRAGE NORD l'a montré : ses cinq légendaires — le
 * capo, la bâche, le tambour, le muret, la torche — sont les archétypes de la
 * tribune, LA TRIBUNE en compte donc dix, et c'est très bien ainsi. La plus
 * ancienne série est aussi la plus profonde. */
{
  const manque = [];
  for (const s of SETS) {
    const n = DEX.filter((f) => f.set === s.id && f.stage === 1
      && f.rar === 'legendaire' && f.publie !== false).length;
    if (n < 5) manque.push(`${s.id} ${n}`);
  }
  check(`chaque série a au moins cinq légendaires de stade 1 (${SETS.length} séries)`,
    manque.length === 0
    || (console.log('        sans sommet :', manque.join(' · ')), false));
}

/* **Une légendaire ne grandit pas.** C'est sa définition, et c'est ce qui la
   rend désirable : elle ne se fabrique pas à l'écharpe, elle se tire. */
{
  const grandissent = DEX.filter((f) => f.rar === 'legendaire' && f.evo);
  check('aucune légendaire n’a de lignée', grandissent.length === 0
    || (console.log('        ', grandissent.map((f) => f.id).join(' · ')), false));
}

/* Une série sans commune de stade 1 ne peut plus distribuer de booster :
   `drawPack` lève, et le kiosque propose une série qui refuse de s'ouvrir. */
{
  const vides = SETS.filter((s) => !DEX.some((f) => f.set === s.id
    && f.stage === 1 && f.rar === 'commune' && f.publie !== false));
  check('chaque série a de quoi remplir un booster', vides.length === 0
    || (console.log('        sans commune :', vides.map((s) => s.id).join(', ')), false));
}

/* ================================================ l'équipement et les cartes */

console.log('\nL’équipement et les cartes');

/* **Chaque pièce d'équipement a un revers.** C'est l'une des deux règles
   écrites en tête d'`inventaire.js`, et elle n'est pas négociable une fois des
   joueurs en ligne : une pièce sans défaut ne se choisit pas, elle s'accumule. */
{
  const FACTEURS = ['tempoWindow', 'mashBonus', 'holdBonus', 'perfectBonus',
    'parryBonus', 'parryResist', 'breathBonus', 'refundBonus'];
  const DECALAGES = ['tempoInterval', 'mashTime'];
  const sansRevers = STUFF.filter((s) => !Object.entries(s.mods ?? {}).some(
    ([k, v]) => (FACTEURS.includes(k) && v < 1)
      || (k === 'costPenalty' && v > 1)
      || (DECALAGES.includes(k) && v > 0)
      || (k === 'holdForgive' && v < 0)
      || v === true));
  check(`les ${STUFF.length} pièces ont toutes un revers`, sansRevers.length === 0
    || (console.log('        sans revers :', sansRevers.map((s) => s.id).join(', ')), false));
}

/* Une carte d'action dont l'effet n'a pas de branche dans le moteur est jouée,
   payée en souffle, et ne fait rien. La liste des types connus est tirée du
   moteur lui-même plutôt que recopiée : une seconde liste finirait par mentir. */
{
  const moteur = await import('node:fs')
    .then((fs) => fs.readFileSync('src/server/nvn/engine.js', 'utf8'));
  const connus = new Set([...moteur.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]));
  const muettes = ACTIONS.filter((a) => a.effet?.type && !connus.has(a.effet.type));
  check(`les ${ACTIONS.length} cartes d’action ont un effet que le moteur sait résoudre`,
    muettes.length === 0
    || (console.log('        sans branche :', muettes
      .map((a) => `${a.id} (${a.effet.type})`).join(' · ')), false));
}

/* ========================================================== les stades */

console.log('\nLes stades');

/* Un stade dont les `mods` sont vides est un décor qui se présente comme une
   règle : sa phrase d'effet annonce quelque chose qui n'arrive pas. */
{
  const inertes = STADES.filter((s) => !Object.keys(s.mods ?? {}).length);
  check(`les ${STADES.length} stades changent quelque chose`, inertes.length === 0
    || (console.log('        sans effet :', inertes.map((s) => s.id).join(', ')), false));
  const muets = STADES.filter((s) => !s.effet);
  check('et chacun dit ce qu’il change', muets.length === 0
    || (console.log('        sans phrase :', muets.map((s) => s.id).join(', ')), false));
}

/* ============================================ les effets ont tous une phrase

   Un effet que le jeu applique et que la carte n'affiche pas est un effet qui
   n'existe pas pour le joueur. C'est arrivé, et à grande échelle : `modsText`
   dans `public/cartes.js` ne nommait ni `parryResist` — **cent trois cartes** —
   ni `costPenalty` — dix-sept. La liste des effets n'était pas vide sur ces
   cartes, seulement incomplète, et une carte qui montre deux effets sur trois
   a exactement l'air d'une carte qui en a deux. Personne ne peut voir ça en
   relisant.

   On lit donc la table de la page — à l'expression régulière, faute de pouvoir
   importer un script de navigateur — et on la confronte aux clés employées par
   **le catalogue et l'équipement**, qui sont les deux seules choses que
   `modsText` rend. Les stades et les bonus de KOP portent les mêmes clés mais
   s'affichent ailleurs, avec leur propre phrase — le contrôle juste au-dessus
   vérifie qu'aucun stade n'est muet. Les mêler ici ferait rougir ce contrôle
   pour `pushMult`, que nulle carte ne porte : un garde-fou qui se plaint de ce
   qui va bien est un garde-fou qu'on désactive. */

/* ======================================= deux cartes, un seul nom

   Un classeur qui affiche deux fois la même ligne fait croire à un doublon, et
   le joueur cherche ce qu'il a raté. C'est arrivé : `BG15` et `BG27`
   s'appelaient tous les deux « Le Chat du Terrain », dans la même série — la
   commune et la légendaire du même chat.

   Le cri compte autant que le nom : c'est lui qui s'affiche en gros sur la
   fiche, et deux fiches au même cri se lisent comme une seule carte vue deux
   fois. `X49` criait « DE MON TEMPS » exactement comme `TR12`.

   **Les âges supérieurs sont hors du contrôle du cri**, et seulement de
   celui-là. Un cri est trois mots ; sur six cent quarante-trois cartes dont
   deux cent soixante-douze sont des âges, « MAINTENANT » et « ON Y VA »
   finissent par se croiser sans que ce soit une faute. Ce qui compte est que
   deux **personnages** ne crient pas la même chose. */

console.log('\nLes noms et les cris');

{
  const suite = new Set(DEX.map((f) => f.evo).filter(Boolean));
  const publies = DEX.filter((f) => f.publie !== false);
  const persos = publies.filter((f) => !suite.has(f.id));

  const grouper = (liste, cle) => {
    const m = new Map();
    for (const f of liste) {
      const k = cle(f);
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(f.id);
    }
    return [...m].filter(([, l]) => l.length > 1);
  };

  const noms = grouper(publies, (f) => f.nom);
  check('aucune carte ne porte le nom d’une autre', noms.length === 0
    || (console.log('        ', noms.map(([n, l]) => `${n} → ${l.join(' ')}`)
      .join(' · ')), false));

  const cris = grouper(persos, (f) => f.cri?.label);
  check('aucun personnage ne crie ce qu’un autre crie', cris.length === 0
    || (console.log('        ', cris.map(([n, l]) => `${n} → ${l.join(' ')}`)
      .join(' · ')), false));
}

console.log('\nLes effets');

/* **La table est maintenant exécutée, plus devinée.**

   Ce contrôle lisait `public/cartes.js` à l'expression régulière, en découpant
   entre deux noms de fonction et en ramassant les `m.<clé>`. C'était le prix à
   payer pour interroger un script de navigateur, et ça ne prouvait qu'une
   chose : que la clé était *mentionnée*. Une clé mentionnée dans une phrase
   fausse passait — et c'est précisément ce qui est arrivé, à grande échelle :

     `Souffle +${Math.round((m.breathBonus - 1) * 100)} %`

   Le signe est calculé, le « + » est en dur devant, et pour `breathBonus: 0.85`
   la carte affichait **« Souffle +-15 % »**. Trois cent soixante-dix-sept
   occurrences sur dix clés, sous un contrôle vert, parce que `breathBonus` était
   bien là.

   La table vit désormais seule dans `public/mods.js`, qui ne dépend de rien et
   pose `window.TBF_MODS`. On l'**exécute** donc dans un bac à sable — dix lignes
   de `node:vm`, pas de jsdom — et on éprouve ses phrases sur les valeurs
   réellement portées par le catalogue. Le contrôle ne demande plus « cette clé
   est-elle citée ? » mais « cette valeur-là produit-elle une phrase lisible ? ».

   C'est aussi ce qui permet de garder une seule table : un script de navigateur
   n'exporte rien, mais rien n'empêche de le faire tourner. */
const TBF_MODS = await (async () => {
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const source = readFileSync(new URL('../public/mods.js', import.meta.url), 'utf8');
  const bac = { window: {} };
  vm.createContext(bac);
  new vm.Script(source, { filename: 'public/mods.js' }).runInContext(bac);
  return bac.window.TBF_MODS;
})();

{
  check('public/mods.js pose bien sa table', Boolean(TBF_MODS?.NOMS && TBF_MODS?.phrase));

  const nommees = new Set(Object.keys(TBF_MODS?.NOMS ?? {}));

  const employees = new Set();
  const ramasser = (o) => { for (const k of Object.keys(o?.mods ?? {})) employees.add(k); };
  DEX.forEach(ramasser);
  STUFF.forEach(ramasser);

  const orphelines = [...employees].filter((k) => !nommees.has(k));
  check(`les ${employees.size} effets employés ont tous une phrase`,
    orphelines.length === 0
    || (console.log('        sans phrase :', orphelines.join(', ')), false));

  /* Et l'inverse : une phrase pour un effet que plus rien ne porte décrit un
     jeu qui n'existe plus. Moins grave, mais c'est la même dérive.

     Les clés des stades et des KOP sont écartées : elles sont dans la table
     parce que le panneau de bonus des deux écrans de jeu les affiche, et nulle
     carte ne les porte. Les compter ici ferait rougir le contrôle pour
     `pushMult` — un garde-fou qui se plaint de ce qui va bien est un garde-fou
     qu'on désactive. */
  const AILLEURS = new Set(['pushMult', 'ferveurBonus', 'scarvesBonus']);
  const mortes = [...nommees].filter((k) => !employees.has(k) && !AILLEURS.has(k));
  check('et aucune phrase ne décrit un effet disparu', mortes.length === 0
    || (console.log('        sans porteur :', mortes.join(', ')), false));

  /* ---------------------------------------- et les phrases se tiennent debout

     Sur **toutes** les valeurs réellement portées, pas sur un échantillon : la
     faute du « +-15 % » ne se voyait que pour les facteurs sous 1, qui sont la
     moitié du catalogue et aucun des exemples qu'on écrit à la main en relisant. */
  const suspects = [];
  const valeurs = new Map();
  for (const o of [...DEX, ...STUFF, ...STADES]) {
    for (const [k, v] of Object.entries(o?.mods ?? {})) {
      if (!valeurs.has(k)) valeurs.set(k, new Set());
      valeurs.get(k).add(v);
    }
  }
  for (const [cle, vs] of valeurs) {
    for (const v of vs) {
      const p = TBF_MODS.phrase(cle, v);
      if (p == null) continue;              // valeur neutre : pas de ligne, c'est voulu
      if (/\+-|--|NaN|undefined|Infinity/.test(p)) suspects.push(`${cle}=${v} → « ${p} »`);
    }
  }
  check(`les ${[...valeurs.values()].reduce((n, s) => n + s.size, 0)} valeurs portées se disent proprement`,
    suspects.length === 0
    || (console.log('        ', suspects.slice(0, 6).join(' · ')), false));

  /* Le sens, et non seulement les mots. Un malus annoncé comme un bonus est
     pire qu'un malus caché : le joueur choisit **contre** lui-même en croyant
     bien faire. On vérifie sur les deux clés dont le signe trompe — c'est là
     que deux des cinq copies s'étaient trompées. */
  check('un `tempoInterval` positif est un malus — les Jumelles ralentissent',
    TBF_MODS.sensDe('tempoInterval', 70) === 'moins');
  check('et un négatif est un bonus — le sifflet rend le contretemps lisible',
    TBF_MODS.sensDe('tempoInterval', -55) === 'plus');
  check('des chants plus chers sont un malus', TBF_MODS.sensDe('costPenalty', 1.1) === 'moins');
  check('un martelage plus court est un bonus', TBF_MODS.sensDe('mashTime', -600) === 'plus');
  check('un facteur sous 1 est un malus', TBF_MODS.sensDe('breathBonus', 0.85) === 'moins');
  check('et il se dit avec un seul signe',
    TBF_MODS.phrase('breathBonus', 0.85) === 'Souffle −15 %'
    || (console.log('        il dit :', TBF_MODS.phrase('breathBonus', 0.85)), false));
}

/* ======================================== le panneau « ce que tu portes »

   Il est monté par `mods.js` pour les deux arènes, et il assemble du HTML à
   partir de **deux sources d'entrée** : le nom d'un Fanzzy, qui vient du
   catalogue, et le nom d'un KOP, que des joueurs choisissent. Le second est de
   la saisie utilisateur qui finit dans un `innerHTML`, et c'est exactement le
   chemin qu'on ne prend jamais sans échapper.

   Aucune suite ne touchait `apports` — ni celle du Virage, qui l'envoie depuis
   une session, ni celle du duel, qui vient de s'y mettre. Ces contrôles sont
   donc les premiers, et le plus important est le dernier. */

console.log('\nCe que tu portes');

{
  const APPORTS = [
    { quoi: 'fanzzy', nom: 'Le Choriste', mods: { tempoWindow: 1.2, breathBonus: 0.9 } },
    { quoi: 'stuff', nom: 'Jumelles', mods: { tempoWindow: 1.25, tempoInterval: 70 } },
    { quoi: 'lieu', nom: 'Le Chaudron', texte: 'Le vent tourne au dernier quart.',
      mods: { pushMult: 1.14, tempoWindow: 0.86 } },
  ];

  const r = TBF_MODS.resume(APPORTS);
  check(`la ligne compte les deux sens (${r.texte})`, r.plus === 3 && r.moins === 3);

  check('rien à porter : la ligne ne dit rien plutôt que « 0 bonus »',
    TBF_MODS.resume([]).texte === '');

  const html = TBF_MODS.panneauHTML(APPORTS, { tempoWindow: 1.29, pushMult: 1.14 });
  check('le panneau nomme chaque source', ['Le Choriste', 'Jumelles', 'Le Chaudron']
    .every((n) => html.includes(n)));
  check('il rend la phrase du lieu', html.includes('Le vent tourne au dernier quart.'));
  check('il colore les bonus et les malus séparément',
    html.includes('class="plus"') && html.includes('class="moins"'));
  check('et il montre le total à part, sans le recalculer',
    html.includes('ce que le serveur applique') && html.includes('Poussée +14 %'));

  check('sans rien à montrer, il le dit en une phrase',
    TBF_MODS.panneauHTML([], null).includes('Rien ne modifie tes gestes'));

  /* **Le nom d'un KOP est de la saisie.** Il est choisi par des joueurs, il
     voyage jusqu'ici dans `apports`, et il est posé dans un `innerHTML`. Un
     KOP nommé `<img onerror=…>` exécuterait son script chez tous ses membres,
     au milieu d'un match. */
  const mechant = [{ quoi: 'kop', nom: '<img src=x onerror="alert(1)">',
    mods: { pushMult: 1.15 } }];
  const sorti = TBF_MODS.panneauHTML(mechant, null);
  check('un nom de KOP hostile est échappé, pas exécuté',
    !sorti.includes('<img') && sorti.includes('&lt;img')
    || (console.log('        il sort :', sorti.slice(0, 160)), false));

  /* Et la phrase d'un stade, qui vient du code mais passe par le même chemin :
     l'échapper aussi coûte un appel et supprime la question. */
  const lieuMechant = [{ quoi: 'lieu', nom: 'X', texte: '<b>gras</b>',
    mods: { pushMult: 1.1 } }];
  check('la phrase du lieu est échappée elle aussi',
    !TBF_MODS.panneauHTML(lieuMechant, null).includes('<b>gras</b>'));
}

console.log(ko ? `\n${ko} échec(s)\n` : '\ntout est vert\n');
process.exitCode = ko ? 1 : 0;
