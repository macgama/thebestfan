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
 * âges calculés. Les trois premières lignées — T, Y, D — datent d'avant et sont
 * écrites à la main : leurs âges avaient dérivé, et un joueur qui faisait
 * grandir son personnage perdait le geste qu'il avait appris. */
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

{
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../public/cartes.js', import.meta.url), 'utf8');
  const corps = source.slice(source.indexOf('function modsText'),
    source.indexOf('function rarMark'));
  const nommees = new Set([...corps.matchAll(/\bm\.([A-Za-z]+)/g)].map((x) => x[1]));

  const employees = new Set();
  const ramasser = (o) => { for (const k of Object.keys(o?.mods ?? {})) employees.add(k); };
  DEX.forEach(ramasser);
  STUFF.forEach(ramasser);

  const orphelines = [...employees].filter((k) => !nommees.has(k));
  check(`les ${employees.size} effets employés ont tous une phrase`,
    orphelines.length === 0
    || (console.log('        sans phrase :', orphelines.join(', ')), false));

  /* Et l'inverse : une phrase pour un effet que plus rien ne porte décrit un
     jeu qui n'existe plus. Moins grave, mais c'est la même dérive. */
  const mortes = [...nommees].filter((k) => !employees.has(k));
  check('et aucune phrase ne décrit un effet disparu', mortes.length === 0
    || (console.log('        sans porteur :', mortes.join(', ')), false));
}

console.log(ko ? `\n${ko} échec(s)\n` : '\ntout est vert\n');
process.exitCode = ko ? 1 : 0;
