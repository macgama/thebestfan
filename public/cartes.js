/**
 * Ce que les Fanzzy et les boosters ont en commun.
 *
 * ## Pourquoi ce fichier existe
 *
 * Le kiosque et le classeur vivaient dans la même page, et partageaient donc
 * tout sans que rien ne le dise : l'état de la bourse, le catalogue, le dessin
 * d'une carte, la table des raretés. Les séparer en deux écrans a rendu ce
 * partage visible — et il fallait bien le mettre quelque part.
 *
 * Il est ici et **pas recopié**. Une carte dessinée deux fois finit par être
 * dessinée de deux façons ; ce dépôt en a déjà fait l'expérience avec la table
 * des sept familles, écrite dans le classeur et dans le duel, dont l'orange de
 * « bascule » n'existait que d'un côté.
 *
 * ## Ce que les pages en font
 *
 * Elles le **réaliasent** en tête de leur script :
 *
 *     const { $, api, cardHTML, S, load } = window.TBF_CARTES;
 *
 * De sorte qu'aucun site d'appel ne porte de préfixe, et qu'une aide oubliée
 * se voit à la première ligne plutôt que dans une branche rare.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
/* Le visuel du paquet, série par série. **La table est volontairement
   incomplète** : une série sans entrée est dessinée par `packArt`, qui compose
   un paquet à partir de ses deux couleurs. C'est le repli, pas une panne — et
   c'est ce qui permet d'ajouter une série sans attendre son illustration.

   VIRAGE NORD et NUITS EUROPÉENNES sont parties avec leurs séries ; leurs
   fichiers restent dans `public/img/` et ne sont plus demandés. */
const ART = {
  TR: 'img/pack-la-tribune',
  MS: 'img/pack-metiers-du-stade',
  BG: 'img/pack-bestiaire-des-gradins',
  OB: 'img/pack-ce-qui-traine',
  RV: 'img/pack-les-revenants',
  EP: 'img/pack-les-epoques',
  IM: 'img/pack-virage-impossible',
  /* LA REPRISE, la série de la saison (`SET_SAISON`, dex-saison.js). La clé
     est son code de série, tel que les pages le lisent (`ART[set.id]`) :
     une clé qui ne le recopie pas exactement ne lève rien, elle rend le
     repli de `packArt` sous les projecteurs. */
  RP: 'img/pack-la-reprise',
  /* La gerbe filmée (`video/gerbe.mp4`) n'est plus ici : elle ne servait
     qu'à la révélation d'une légendaire au kiosque, qui passe maintenant par
     l'échelle commune de cérémonie (`FX.reveler`, dans fx.js). La bienvenue
     la charge encore par son adresse. */
};

// Choix du format d'image et dessin des Fanzzy : voir /fanzzy-art.js. L'accueil
// dessine les mêmes personnages, et deux copies d'un même dessin divergent
// toujours — c'est déjà arrivé au catalogue.
const { IMG_EXT, src } = FZART;

const $ = (id) => document.getElementById(id);

// `esc` était utilisé dans le rendu de la grille sans avoir jamais été défini :
// la branche des Fanzzy non possédés levait une ReferenceError, `list.map`
// s'interrompait, et la grille restait vide pour tout joueur dont la
// collection n'était pas complète — donc pour tout le monde.
const esc = (s) => String(s ?? '').replace(/[<>&"]/g,
  (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
// Déclarée en fonction, donc utilisable avant sa ligne : le fond parallaxe
// s'installe tout en haut du script.
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/**
 * Le mode calme du tiroir (contrat C4) vaut aussi ici, pour la seule chose
 * que ce fichier fait encore lui-même : **vibrer**. Sans ce garde, la
 * déchirure du booster continuait de vibrer pour un joueur qui avait tout
 * coupé. Le son ne passe plus par ici (voir plus bas) : le moteur commun lit
 * le calme seul.
 *
 * Lu sur la racine du document (`data-calme`), où `fx.js` et `menu.js`
 * recopient la clé `tbf-calme` — donc sans toucher au stockage. Et lu **au
 * moment du geste**, pas au chargement : ce script passe avant eux, et un
 * interrupteur basculé dans le tiroir doit valoir tout de suite.
 */
function calme(facette) {
  return (document.documentElement.dataset.calme ?? '').split(' ').includes(facette);
}

/**
 * Vibration. Enveloppée dans un try : tous les navigateurs n'exposent pas
 * l'API, et Safari iOS l'ignore silencieusement. Une animation ne doit jamais
 * tomber parce que le retour haptique n'est pas disponible. Muette sous le
 * calme « vibrations » : voir `calme`.
 */
function buzz(pattern) {
  if (calme('vibrations')) return;
  try { navigator.vibrate?.(pattern); } catch { /* sans importance */ }
}

/* ------------------------------------------------------------------ son
   **Un seul moteur pour tout le jeu** : `son.js`, que fx.js charge sur
   chaque page qui charge ce fichier. Celui-ci avait son propre contexte audio
   et sa propre synthèse, branchée droit sur la sortie : un second fil de
   rendu audio sur un téléphone, des volumes réglés à l'oreille hors du
   mixage, et aucun limiteur quand la déchirure tombait sur un autre son. Il
   ne garde que la façade, sous les mêmes noms et les mêmes signatures, et la
   confie au moteur (`TBF_SON.audio`) : la déchirure y devient « dechirure »
   (avec son intensité), le retournement « retournement », l'accord
   « accord-epique » ou « accord-legendaire », le grondement « grondement ».
   Le moteur tient le calme, le volume et le mixage.

   Lu **au moment du geste** : ce script passe avant fx.js, et le moteur
   n'existe pas encore quand il s'exécute. Sans moteur (une page qui ne
   chargerait pas fx.js, un geste plus rapide que son chargement), le son se
   tait et rien ne lève — le son ne porte jamais seul une information.

   `AC` reste exporté, à `null` : le kiosque et le classeur le déstructurent
   encore. Il valait déjà `null` pour eux — l'export recopiait la valeur au
   chargement, avant tout contexte. */
const AC = null;
const audio = {
  ready: () => window.TBF_SON?.audio?.ready() ?? null,
  rip: (intensite) => window.TBF_SON?.audio?.rip(intensite),
  flip: () => window.TBF_SON?.audio?.flip(),
  chime: (rar) => window.TBF_SON?.audio?.chime(rar),
  roar: () => window.TBF_SON?.audio?.roar(),
};

/* ------------------------------------------------------------ stockage */

/**
 * Tout l'état vit sur le serveur.
 *
 * Boosters, écharpes, collection et Fanzzy équipé étaient dans le navigateur
 * tant qu'ils ne servaient à rien. Depuis qu'une écharpe achète une vignette,
 * un solde côté client se modifierait avec la console du navigateur : c'est le
 * serveur qui tire les boosters et tient les comptes.
 */
const api = async (path, body, method) => {   // eslint-disable-line no-unused-vars
  const res = await fetch('/api/fanzzy' + path, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) { location.href = '/compte'; throw new Error('auth'); }
  /* **Le corps du refus se lit quel que soit le code**, parce que c'est lui qui
     porte `error` — le kiosque en tire « Plus de booster », « Pas assez
     d'écharpes ». Mais une réponse qui n'est **pas du JSON** rendait un objet
     vide, et c'est la faute la plus chère de ce fichier :

       — la fiche d'un Fanzzy recevait `{}`, donc `d.fanzzy` indéfini, et
         `rendre()` levait sur `f.type`. La page restait blanche alors que son
         `catch` savait dire « Ce Fanzzy est introuvable » — il n'était jamais
         atteint, puisque rien n'avait été jeté ;
       — le kiosque recevait `{}` pour son catalogue, `chargerCatalogue` levait
         « catalogue incomplet » depuis son propre contrôle, et le démarrage
         mourait sans un mot.

     Les deux se sont vus le jour où les pages ont été ouvertes dans un vrai
     navigateur avec un serveur muet — jamais avant, parce qu'un serveur qui
     répond ne produit jamais ce cas. On échoue donc en le nommant, et les
     `catch` déjà écrits partout font enfin leur travail. */
  const json = await res.json().catch(() => null);
  if (!json) {
    console.warn(`[cartes] ${path} : ${res.status}, et ce n’est pas du JSON`);
    throw Object.assign(new Error('reponse illisible'),
      { code: 'app.error.illisible' });
  }
  if (json.error) {
    throw Object.assign(new Error(json.error), { code: json.error, detail: json.detail });
  }
  return json;
};

/* ------------------------------------------------------------ catalogue */

/**
 * Le catalogue vient du serveur, il n'est plus recopié ici.
 *
 * Cette page en gardait sa propre copie : vingt-sept entrées écrites à la
 * main, plus les types, les paliers de rareté, les sets et les taux de
 * tirage. Elles avaient divergé sans que rien ne le signale — la lignée du
 * Gamin de Devant manquait dans la page alors que le serveur la tirait des
 * boosters, et un TR37 sorti d'un paquet arrivait ici comme `undefined` et
 * cassait l'ouverture.
 *
 * Une copie qu'il faut penser à mettre à jour finit toujours par ne plus
 * l'être. `/api/fanzzy/dex` porte désormais tout, y compris les constantes
 * qui restaient locales faute d'être servies : sans elles, la copie
 * repartait par la petite porte.
 *
 * La réponse est mise en cache une heure par le navigateur, donc ce
 * chargement ne coûte rien à la navigation.
 */
const DEX = [];
let BY_ID = new Map();
/** Les personnages : une entrée par lignée, jamais ses âges supérieurs. */
const PERSOS = [];
let TYPES = {};
/** Les séries **ouvertes**. C'est ce dans quoi un joueur peut tirer aujourd'hui. */
const SETS = [];
/**
 * Et toutes les séries, ouvertes ou non, avec leur champ `ouverte`.
 *
 * Le kiosque en a besoin : il annonce ce qui vient — « trois séries en attente
 * d'une saison ». Il ne pouvait pas, puisque `SETS` était déjà filtré ; il s'en
 * remettait alors à la liste des séries débloquées du joueur, qui n'existe plus
 * depuis que les saisons ouvrent pour tout le monde.
 *
 * Deux listes plutôt qu'un filtre à chaque site d'appel : les écrans qui tirent
 * — kiosque, boosters — veulent les ouvertes, et ce sont les plus nombreux.
 * C'est le cas courant qui garde le nom court.
 */
const SETS_TOUTES = [];
// Ce qu'un joueur peut encore obtenir : le catalogue publié restreint aux
// séries ouvertes. Le serveur le calcule et l'envoie — la page le recalculerait
// mal le jour où la règle se nuance, et c'est le genre de copie que ce projet a
// déjà payé une fois avec le catalogue recopié.
let RAR = {};
let SCARVES = {};
let EVO_COST = {};
// Ce qu’un booster tire en dehors des supporters. Trois tables, parce
// qu’une carte doit s’afficher avec son nom et sa rareté : sans elles la
// page ne savait dire d’une tenue que son identifiant.
let TENUES = new Map();
let STUFFS = new Map();
let ACTES = new Map();
// Les lieux : les stades où l'on joue, qui se collectionnent aussi. Pas
// exigés du catalogue — un serveur d'avant ne les sert pas, et la page tient.
let LIEUX = new Map();

/** Vide un tableau et le remplit, sans en fabriquer un autre. */
const remplir = (cible, source) => { cible.length = 0; cible.push(...source); };

/** Vide une table et la remplit. Même raison, même forme. */
const recharger = (cible, couples) => {
  cible.clear();
  for (const [k, v] of couples) cible.set(k, v);
};

/** Vide un objet et le remplit. */
const rejeter = (cible, source) => {
  for (const k of Object.keys(cible)) delete cible[k];
  Object.assign(cible, source);
};

async function chargerCatalogue() {
  const d = await api('/dex');

  // On refuse un catalogue incomplet plutôt que d'afficher une grille à
  // moitié vide : le message doit nommer la cause, pas laisser deviner.
  const manque = ['dex', 'types', 'sets', 'rar', 'scarves', 'evoCost', 'rates',
                  'stuff', 'actions', 'tenues']
    .filter((k) => !d?.[k] || (Array.isArray(d[k]) && !d[k].length));
  if (manque.length) {
    throw Object.assign(new Error('catalogue'),
      { code: `catalogue incomplet, champs manquants : ${manque.join(', ')}` });
  }

  remplir(DEX, d.dex);
  recharger(BY_ID, DEX.map((f) => [f.id, f]));
  // Le classeur range des **personnages**, pas des âges. Le Choriste, le Meneur
  // de chant et le Capo di Curva sont trois entrées du catalogue et une seule
  // case : c'est le même individu, et le joueur n'en possède qu'un exemplaire,
  // arrivé à un certain stade.
  //
  // `racine` vient du serveur, on ne le devine pas ici. Une page qui déduit
  // elle-même qu'une carte est le deuxième âge d'une autre finit par le déduire
  // de travers, et sans rien dire — c'est la faute du catalogue recopié sous
  // une autre forme.
  remplir(PERSOS, DEX.filter((f) => (f.racine ?? f.id) === f.id));
  rejeter(TYPES, d.types);
  // Seules les séries ouvertes sont proposées au kiosque. Les autres restent
  // dans le catalogue — un joueur qui possède déjà une de leurs cartes doit
  // continuer à la voir — mais on ne peut plus en acheter le booster.
  remplir(SETS, d.sets.filter((x) => x.ouverte !== false));
  remplir(SETS_TOUTES, d.sets);
  /* La saison en cours, pour que le kiosque puisse l'annoncer. Elle vient de la
     même réponse que le catalogue : c'est du contenu, pas un état de joueur. */
  S.saison = d.saison ?? null;
  /* Un nombre ne se mute pas : il vit dans l'état, qui est un objet partagé.
     C'est le seul des douze conteneurs qui ait dû changer de place. */
  S.aCollectionner = d.aCollectionner ?? d.dex.length;
  rejeter(RAR, d.rar);
  rejeter(SCARVES, d.scarves);
  rejeter(EVO_COST, d.evoCost);
  recharger(TENUES, (d.tenues ?? []).map((t) => [t.id, t]));
  recharger(STUFFS, (d.stuff ?? []).map((o) => [o.id, o]));
  recharger(ACTES, (d.actions ?? []).map((a) => [a.id, a]));
  recharger(LIEUX, (d.lieux ?? []).map((l) => [l.id, l]));
}

/* ------------------------------------------------------------- état */

const MAXP = 12, REGEN = 10 * 60 * 1000;
let S = { col:{}, scarves:0, packs:MAXP, last:Date.now(), active:null, set:0, filter:'all' };

/** L'état complet vient du serveur : bourse, collection, Fanzzy équipé. */
async function load() {
  // Le catalogue d'abord : tout le rendu en dépend, et il n'existe plus en
  // dur dans la page.
  if (!DEX.length) await chargerCatalogue();
  const st = await api('/state');
  S.col = st.collection;
  S.stades = st.stades ?? {};
  /* **Les états gagnés.** Ils étaient donnés avec le personnage ; ils se
     tirent maintenant en booster, et `fanzzy-etats.js` doit savoir lesquels
     pour ne montrer que ceux-là. Posé avant tout rendu : une carte dessinée
     avant que la table arrive montrerait une expression que ce joueur n'a
     pas gagnée, et la verrait disparaître au rendu suivant. */
  S.etats = st.etats ?? {};
  /* **Les nouveautés** (contrat § 2.1) : ce que ce joueur a gagné et pas
     encore vu — NOUVEAU dans le classeur, le « +N » de son onglet, et la
     fiche et /collection pour la même raison. `null` et non `[]` quand le
     champ manque : le serveur ne sait pas (sa table est absente), ce qui
     n'est pas « rien de nouveau » ; l'écran n'en invente aucun. */
  S.nouveautes = Array.isArray(st.nouveautes) ? st.nouveautes : null;
  window.TBF_ETATS?.possedes?.(S.etats);
  S.scarves = st.wallet.scarves;
  S.packs = st.wallet.packs;
  S.active = st.wallet.active;
  /* **La tenue portée et l'âge auquel on se montre.** Les deux viennent du
     portefeuille, qui les calcule pour tout le jeu — sans quoi chaque écran
     en décide, et ils finissent par ne plus montrer le même personnage. */
  S.activeSkin = st.wallet.activeSkin ?? 'base';
  S.activeStade = st.wallet.activeStade ?? null;
  /* **L'avatar entier**, tel que le serveur le résout. Les deux champs du
     dessus en sont tirés côté serveur ; les écrans devraient lire
     celui-ci et rien d'autre — un objet complet ne peut pas avoir oublié
     une dimension. */
  S.avatar = st.wallet.avatar ?? null;
  S.avatarEnJeu = st.wallet.avatarEnJeu ?? null;
  S.nextIn = st.wallet.nextPackInMs;
  /* **La durée d'une recharge**, pour l'anneau de la réserve du kiosque :
     lue si le serveur la sert, et rien sinon — le kiosque prend alors un
     repli (voir `cadence`, dans boosters.html). Une durée inventée ici
     serait une copie du réglage, qui mentirait au premier changement depuis
     l'administration. */
  S.cadenceMs = Number(st.wallet.cadenceMs) > 0 ? Number(st.wallet.cadenceMs) : null;
  /* **Le plafond de la réserve, pour ce joueur-là** (abonnement compris),
     lu s'il est servi et rien sinon. `maxPacks`, à la racine de la même
     réponse, est celui du joueur gratuit : il ferait dessiner douze places
     à un abonné qui en a vingt-quatre. Sans lui, la réserve écrit son
     compte au lieu de dessiner des places (voir `reserveHTML`). */
  S.packMax = Number(st.wallet.packMax) > 0 ? Number(st.wallet.packMax) : null;
  S.packPrice = st.packPrice;
  /* La saison en cours, et celle que ce joueur a déjà vue annoncée.
     `S.series` — les séries que ce joueur-là avait débloquées, tirées de son
     niveau — n'existe plus : les séries s'ouvrent par saison, pour tout le monde
     le même jour, et `serieDebloquee` lit le champ `ouverte` du catalogue. */
  S.saison = st.saison ?? S.saison ?? null;
  S.saisonVue = st.saisonVue ?? null;
  /* L état a changé. On ne dit pas **qui** doit se redessiner : ce fichier
     est partagé par deux écrans qui n affichent pas les mêmes choses, et il
     appelait le rendu du kiosque même sur la page des Fanzzy, où ni le bouton
     d ouverture ni le compte à rebours n existent — la page levait à sa
     première ligne. Chaque écran écoute et redessine ce qu il a. */
  dispatchEvent(new Event("tbf:bourse"));
}

// Plus rien à sauvegarder ici : chaque action passe par une route qui écrit
// en base et renvoie le nouvel état.
const save = () => {};

/* La minuterie du booster suivant vit avec le kiosque : voir /boosters. */

/* ----------------------------------------------------- illustrations */

// Le dessin des Fanzzy vit dans /fanzzy-art.js, partagé avec l’accueil : une
// seule définition, comme pour le catalogue.
//
// `uid` reste ici parce que packArt, propre à cette page, s’en sert encore.
// Son préfixe « p » ne peut pas entrer en collision avec le « g » du module.
let uid = 0;
const { seeded, ILLUSTRES, illustration, art, artFond, artProcedural } = FZART;

/**
 * Le sachet d'une série qui n'a pas encore son visuel dessiné.
 *
 * **Il se lit comme un paquet, et non comme une carte.** Le repli d'avant
 * remplissait tout le cadre d'un dégradé, avec « FANZZY » et le nom de la
 * série en tête : une carte plate, sans dentelure. Or c'est l'objet central
 * du kiosque, sur son socle et sous les projecteurs — et la seule série
 * ouverte en production, LA REPRISE, a d'abord été servie sans visuel : le
 * joueur voyait trois cartes identiques là où il venait chercher un sachet.
 * Elle a maintenant le sien (`ART.RP`). Le repli reste celui des séries qui
 * attendent leur dessin — cinq sur treize quand celui de LA REPRISE est
 * arrivé —, partout où l'une d'elles montre son paquet.
 *
 * Il prend donc le dessin des sachets dessinés (`ART`) : un fond sombre de
 * scène, et dedans le sachet scellé — dentelure en haut et en bas, ses deux
 * couleurs, la bande diagonale de la série, le nom au milieu. La soudure du
 * haut finit avant la ligne de la déchirure (`--bande`, 20 % de la hauteur,
 * dans boosters.html) : la bande qu'on arrache emporte le haut du sachet,
 * pas du vide.
 *
 * Le nom part en deux ou trois lignes plutôt que de rapetisser : à la
 * largeur d'un sachet du carrousel, une ligne de vingt capitales tombait à
 * sept pixels. Il est échappé — c'est du texte du catalogue posé dans du
 * balisage.
 */
function packArt(set) {
  const r = seeded(set.id), u = 'p' + uid++;
  const c1 = esc(set.c1 ?? '#C2CAD6'), c2 = esc(set.c2 ?? '#1A1F27');
  /* La dentelure : vingt-cinq dents sur la largeur du sachet (de 12 à 88),
     vers l'extérieur — en haut de gauche à droite, en bas de droite à
     gauche, pour que le contour se referme. */
  const G = 12, D = 88, N = 25, pas = (D - G) / N;
  const dents = (y, sens, versLaDroite) => {
    let d = '';
    for (let i = 0; i < N; i++) {
      const a = versLaDroite ? G + i * pas : D - i * pas;
      const k = versLaDroite ? 1 : -1;
      d += `L${(a + k * pas / 2).toFixed(2)} ${(y + sens * 2.4).toFixed(1)}L${(a + k * pas).toFixed(2)} ${y}`;
    }
    return d;
  };
  const corps = `M${G} 16${dents(16, -1, true)}L${D} 150${dents(150, 1, false)}Z`;
  /* Les mots du nom, rangés en lignes de onze signes au plus, en onze
     unités — le plancher du jeu, que l'audit lit sur la police déclarée.
     Une ligne plus longue que la largeur du sachet (un mot de douze signes)
     se resserre à sa largeur plutôt que d'en sortir. */
  const lignes = [];
  for (const mot of String(set.nom ?? '').toUpperCase().split(/\s+/).filter(Boolean)) {
    const der = lignes.length - 1;
    if (der >= 0 && (lignes[der] + ' ' + mot).length <= 11) lignes[der] += ' ' + mot;
    else lignes.push(mot);
  }
  const noms = lignes.slice(0, 3).map((l, i) =>
    `<text x="50" y="${62 + i * 13}" text-anchor="middle" font-family="Oswald,Impact,sans-serif"
      font-weight="700" font-size="11" fill="#F2EEE4" letter-spacing=".4"${l.length > 10
        ? ' textLength="70" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(l)}</text>`).join('');
  let s = `<svg viewBox="0 0 100 160" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
   <defs>
     <radialGradient id="pf${u}" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#232A33"/>
       <stop offset="1" stop-color="#07090C"/></radialGradient>
     <linearGradient id="pg${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c2}"/>
       <stop offset=".5" stop-color="${c1}" stop-opacity=".55"/><stop offset="1" stop-color="${c2}"/></linearGradient>
     <linearGradient id="pl${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".35"/>
       <stop offset=".18" stop-color="#fff" stop-opacity=".12"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/>
       <stop offset=".85" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>
     <clipPath id="pc${u}"><path d="${corps}"/></clipPath>
   </defs>
   <rect width="100" height="160" fill="url(#pf${u})"/>
   <g clip-path="url(#pc${u})">
     <rect width="100" height="160" fill="url(#pg${u})"/>`;
  // Le grain du sachet : quelques taches de sa couleur, tirées de son code.
  for (let i = 0; i < 4; i++) {
    s += `<circle cx="${(18 + r() * 64).toFixed(1)}" cy="${(30 + r() * 100).toFixed(1)}" r="${(10 + r() * 14).toFixed(1)}"
      fill="${c1}" opacity=".12"/>`;
  }
  s += `<polygon points="0,112 100,84 100,104 0,132" fill="${c1}"/>
     <polygon points="0,112 100,84 100,87 0,115" fill="#F2EEE4" opacity=".35"/>
     <rect x="0" y="12" width="100" height="12" fill="#000" opacity=".28"/>
     <rect x="0" y="140" width="100" height="14" fill="#000" opacity=".28"/>
     <rect width="100" height="160" fill="url(#pl${u})"/>
   </g>
   <path d="${corps}" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="1"/>
   <path d="M12 24H88M12 140H88" stroke="#F2EEE4" stroke-opacity=".3" stroke-width=".6" stroke-dasharray="1.5 1.5"/>
   <text x="50" y="45" text-anchor="middle" font-family="Oswald,Impact,sans-serif" font-weight="700"
     font-size="11" fill="#F2EEE4" letter-spacing="2.2">FANZZY</text>
   ${noms}</svg>`;
  return s;
}

/**
 * **La réserve de boosters, dessinée d'une seule façon.**
 *
 * Le même objet se dessinait de trois façons : au kiosque, cinq fentes
 * écrites en dur, qui faisaient croire à un plafond de cinq quand il est de
 * douze, puis un sachet seul avec son compte dans un sticker rond —
 * presque celui du niveau de l'avatar, cinquante pixels plus haut ; à la
 * boutique, un compte derrière un pictogramme de paquet cadeau, avec un
 * seuil de sept places ; dans la barre, un troisième pictogramme. Trois
 * dessins se lisent comme trois choses.
 *
 * La règle, ici et une fois : **une fente par place quand le plafond de ce
 * joueur est connu et qu'elles tiennent** (`PLACES_EN_FENTES` au plus, la
 * réserve débordée par un cadeau comprise) ; sinon, **le sachet seul et son
 * compte** dans un sticker craie rectangulaire, jamais rond — le rond est
 * celui du niveau. Sans plafond servi, on ne dessine pas de places qu'on ne
 * sait pas compter : on écrit le compte.
 *
 * **Cinq places, mesuré.** À côté de « PROCHAIN » et d'un solde à quatre
 * chiffres, six fentes font déborder la réserve de quinze pixels à 320 px
 * de large (la page glisse de côté), sept de deux pixels à 360. La boutique
 * en dessinait jusqu'à sept.
 *
 * Elle ne dépend, dans ce fichier, que de `esc` et de `clamp` (une ligne
 * chacune) : la boutique et la barre, qui ne le chargent pas, peuvent la
 * reprendre telle quelle.
 *
 * ## La brique (lot 4) : `brique` et `contenu`
 *
 * La réserve est devenue **une seule brique** de `ui.css` (le sticker
 * `.tbf-monnaie.tbf-boosters`, BRIQUES § 1) : ses sachets, puis le compte,
 * puis l'anneau et le compte à rebours. `brique` rend ce qui **précède** le
 * compte et ce qui le **suit**, et pas le compte lui-même : la page garde son
 * `<b>` en place d'un rendu à l'autre, c'est lui que `FX.compter` fait
 * défiler — un compte ne survit pas à un `innerHTML`. `contenu` est le tout,
 * pour qui pose la brique d'un coup. Le compte est toujours le premier `<b>`
 * (celui que lisent la bande du HUD et les suites).
 *
 * **L'ancienne rangée de fentes (`html`) est partie** : le kiosque, son
 * dernier lecteur, ne prend plus que `brique`, et seule la suite de la carte
 * la lisait encore — pour vérifier qu'elle n'avait pas changé. `enFentes`
 * reste : il dit, sans relire le balisage, laquelle des deux formes la
 * brique a prise.
 *
 * Deux crochets pour la seconde suivante, ceux que la boutique employait
 * déjà : l'anneau porte `data-recharge` (la page y pose `--part`), le temps
 * est le `<b data-prochain>` du compte à rebours (la page le récrit). **Ce
 * qu'on ne veut pas, on ne l'écrit pas** : réserve pleine, ni anneau ni
 * compte à rebours (jamais « 0:00 ») ; le mot PROCHAIN ou le temps qu'une
 * page n'a pas la place de montrer ne se posent pas, plutôt que d'être
 * cachés par une règle (un texte à zéro pixel est un petit texte pour
 * l'audit).
 *
 * @param {{ packs: number, max?: number|null, recharge?: boolean,
 *   forme?: 'auto'|'compte', anneau?: boolean, part?: number|null,
 *   prochain?: 'mot'|'temps'|false, temps?: string, plus?: boolean }} r
 *   `max` : le plafond de ce joueur (abonnement compris), ou rien ;
 *   `recharge` : un booster est en route (la réserve n'est pas pleine) ;
 *   `forme: 'compte'` : le sachet seul quoi qu'il arrive (la bande du HUD,
 *     le vestiaire, où cinq places ne tiennent pas) ;
 *   `anneau` : l'anneau de la recharge (par défaut, dès que `recharge`) —
 *     faux quand on ne sait pas la durée d'une recharge, dont il est la part ;
 *   `part` : la part de l'anneau au premier rendu, de 0 à 1 ;
 *   `prochain` : `'mot'` écrit « PROCHAIN » et le temps (kiosque,
 *     boutique), `'temps'` le temps seul (vestiaire), rien sinon (HUD) ;
 *     posé seulement si `recharge` ;
 *   `temps` : le temps au premier rendu (« 9:55 », « 1 h 02 ») ;
 *   `plus` : le « + » au bout du sticker, quand il est un lien.
 * @returns {{ enFentes: boolean, brique: { avant: string, apres: string }, contenu: string }}
 *   `enFentes` : la brique dessine une place par booster (sinon le sachet
 *   seul et son compte) ; `brique` et `contenu` : le contenu du sticker de la
 *   brique.
 */
const PLACES_EN_FENTES = 5;
function reserveHTML({ packs, max = null, recharge = false, forme = 'auto', anneau = recharge,
  part = null, prochain = false, temps = '', plus = false } = {}) {
  const n = Math.max(0, Math.floor(Number(packs) || 0));
  const plafond = Number(max) > 0 ? Math.floor(Number(max)) : null;
  const places = forme === 'compte' || plafond === null ? Infinity : Math.max(plafond, n + (recharge ? 1 : 0));
  const enFentes = places <= PLACES_EN_FENTES;

  /* L'anneau et le compte à rebours de la brique : seulement si un booster
     est en route. La part est bornée ici, une seule fois — un anneau à
     1,2 tour ferait le tour et repartirait. */
  const p = part === null || part === '' ? NaN : Number(part);
  const style = Number.isFinite(p) ? ` style="--part:${clamp(p, 0, 1).toFixed(3)}"` : '';
  const rond = recharge && anneau
    ? `<span class="tbf-recharge" data-recharge${style} aria-hidden="true"></span>` : '';
  const mot = prochain === 'mot' || prochain === true;
  const rebours = recharge && (mot || prochain === 'temps')
    ? `<span class="tbf-reserve-prochain" aria-hidden="true">${mot ? 'PROCHAIN' : ''}<b data-prochain>${
      esc(temps)}</b></span>` : '';
  const fin = plus ? '<i class="tbf-monnaie-plus" aria-hidden="true">+</i>' : '';

  let brique;
  if (enFentes) {
    /* Les places : les pleines d'abord, la première vide porte l'anneau. */
    const fentes = Array.from({ length: places }, (_, i) =>
      (i < n ? '<span class="tbf-fente"></span>'
        : `<span class="tbf-fente tbf-fente--vide">${i === n ? rond : ''}</span>`)).join('');
    brique = { avant: `<span class="tbf-fentes" aria-hidden="true">${fentes}</span>`, apres: rebours + fin };
  } else {
    /* Le sachet seul — vide s'il n'y en a aucun —, l'anneau à côté du compte. */
    brique = { avant: `<span class="tbf-fente${n ? '' : ' tbf-fente--vide'}" aria-hidden="true"></span>`,
      apres: rond + rebours + fin };
  }
  return { enFentes, brique, contenu: `${brique.avant}<b>${n}</b>${brique.apres}` };
}

/* --------------------------------------------------------- rendu carte */

/**
 * Les effets d'une carte, en français.
 *
 * **La table est partie dans `/mods.js`, et ce n'est pas un rangement.**
 *
 * Elle vivait ici en entier, et elle mentait sur la majorité des malus du jeu.
 * Trois fautes, toutes mesurées sur le catalogue réel :
 *
 *   — le signe était en dur devant un nombre calculé, d'où « Souffle +-15 % »
 *     pour un `breathBonus: 0.85`. **377 occurrences**, dix clés ;
 *   — « Tempo plus tolérant (×0.9) » disait l'inverse de son nombre, et c'est
 *     le mot qu'on lit ;
 *   — « Martelage 0.5 s plus court » pour un `mashTime: 500`, qui l'allonge.
 *
 * `deck.html` en avait une seconde copie, correcte celle-là, sous un
 * commentaire qui affirmait « les mêmes mots partout » — alors que le même
 * effet s'y écrivait « +20 % » là où la carte écrivait « ×1.2 », et « Coût des
 * cartes » là où la carte disait « Chants plus chers ». Les deux écrans
 * décrivaient le même effet de deux façons, et le joueur pouvait croire qu'il
 * en avait deux.
 *
 * Il n'y a donc plus qu'une table, dans un fichier qui ne dépend de rien — les
 * deux écrans de jeu l'emploient aussi, pour leur panneau de bonus. Ce qui
 * reste ici est le seul garde-fou qui appartienne aux cartes :
 *
 * `?? {}` et non `f.mods` : seuls un supporter et une pièce d'équipement portent
 * des effets. Une tenue n'en a jamais eu, une carte d'action porte un `effet` et
 * non des `mods` — et c'est en butant ici que l'ouverture d'un booster
 * s'interrompait sans un mot, le paquet débité et l'écran vide.
 *
 * Le repli sur un tableau vide quand `/mods.js` n'a pas chargé est du même
 * esprit : une carte sans sa ligne d'effets reste une carte, une exception ici
 * arrête la boucle qui monte les cinq.
 */
function modsText(f) {
  return window.TBF_MODS?.lignes(f.mods ?? {}) ?? [];
}

/**
 * Le mot de chaque rareté, tel qu'on l'écrit sur une carte.
 *
 * La rareté est une **information** (couleur, forme et mot) : le mot
 * s'écrit toujours, dans la forme ou en étiquette qui la traverse
 * (amendement 20), et c'est aussi ce que lit le lecteur d'écran.
 */
const MOT_RARETE = { commune: 'COMMUNE', rare: 'RARE', epique: 'ÉPIQUE', legendaire: 'LÉGENDAIRE' };
const rareteDe = (rar) => (MOT_RARETE[rar] ? rar : 'commune');

/**
 * **La forme de rareté** (`.tbf-forme`, dans `ui.css`) : un rectangle mat, un
 * rond de vinyle, une étoile, un éclat — avec son mot.
 *
 * Elle remplace les losanges, l'étoile ★ et la couronne ♛ : trois signes de
 * plus à apprendre, dont deux caractères dessinés par la police du
 * téléphone, et une épique qui retombait sur trois losanges le jour où une
 * condition se trompait (c'est arrivé). Le même balisage pour les quatre :
 * un script la pose sans savoir laquelle.
 *
 * `coin` : posée au coin d'une carte, l'étiquette de l'étoile et de l'éclat
 * court vers l'intérieur au lieu de déborder sur la voisine de grille.
 * `tourne` : le holo de l'éclat légendaire tourne (vitrine, fiche,
 * révélation : il compte alors dans le budget des animations infinies).
 * `mot: false` : une forme trop petite pour son mot (14 px, dans une liste)
 * le perd, et le garde pour le lecteur d'écran.
 */
function formeHTML(rar, { coin = false, tourne = false, mot = true, classe = '' } = {}) {
  const r = rareteDe(rar);
  const cls = ['tbf-forme', coin && 'tbf-forme--coin', tourne && 'tbf-forme--tourne', classe]
    .filter(Boolean).join(' ');
  return mot
    ? `<span class="${cls}" data-rar="${r}"><i></i><b>${MOT_RARETE[r]}</b></span>`
    : `<span class="${cls}" data-rar="${r}" role="img" aria-label="${MOT_RARETE[r].toLowerCase()}"><i></i></span>`;
}

/**
 * La rareté d'une carte, pour qui la pose à côté d'elle (la scène du
 * vestiaire, par exemple). **C'est désormais la forme**, avec son mot : la
 * signature ne change pas, ce qu'elle rend si — les losanges et les ★/♛
 * disparaissent partout (lot 4).
 */
function rarMark(rar) {
  return formeHTML(rar);
}

/**
 * Une pièce d'équipement sur une carte de booster.
 *
 * `art()` dessine des Fanzzy : pour un identifiant qu'il ne connaît pas — et
 * `echarpe` n'est pas un Fanzzy — il retombait sur une silhouette procédurale.
 * On ouvrait donc un booster épique pour y trouver un bonhomme gris nommé
 * « Thermos ».
 *
 * Le fond de tribune reste celui du type, comme pour un personnage : c'est lui
 * qui porte la couleur. L'objet, lui, est détouré, donc il se pose dedans
 * plutôt que de le remplir.
 */
/** Le dessin d'un stade, au format que ce navigateur lit (comme `stade-art.js`). */
function lieuSrc(id, mini = false) {
  return `/img/stade/${encodeURIComponent(id)}${mini ? '-mini' : ''}${IMG_EXT ?? '.jpg'}`;
}

function objetHTML(f) {
  return `<div class="illuwrap">${fondDeCarte(f)}
    ${window.TBF_STUFF.illustration(f.id, 'illu objet')}</div>`;
}

/**
 * **Le fond d'une carte : la plaque de sa rareté** (lot 4).
 *
 * `artFond` (fanzzy-art.js) demande le décor de la scène, celui du
 * vestiaire, où la tenue choisit sa plaque. Une carte, elle, se tient
 * devant la plaque de sa rareté, quelles que soient sa série et sa tenue :
 * voir `plaqueCarte` dans fanzzy-fond.js. Sans ce module (une page qui ne le
 * charge pas), le fond de `artFond` reste le repli.
 */
function fondDeCarte(f) {
  return window.TBF_FOND?.fond?.(f, { carte: true }) ?? artFond(f);
}

/**
 * Le portrait d'un Fanzzy sur sa carte : `FZART.art`, au fond près.
 *
 * C'est le même assemblage — le dessin s'il existe, posé sur son décor,
 * sinon la silhouette procédurale, qui est le dessin prévu d'un personnage
 * pas encore illustré —, avec la plaque de la carte au lieu de celle de la
 * scène. Trois lignes et non un appel : `art` ne transmet pas l'option du
 * fond, et fanzzy-art.js n'appartient pas à la carte.
 *
 * `pied` : le personnage en pied (520 × 945) plutôt que son buste (320 ×
 * 320). Une carte regardée seule — la vitrine, la fiche — montre le
 * personnage entier devant sa plaque ; en buste, à trois cents pixels, on ne
 * voyait plus qu'un visage de la taille de la carte. Tout le reste garde le
 * buste : quatre fois moins lourd (RP1 : 55 Ko contre 14), et lisible à
 * quatre-vingt-six pixels. Voir `cardHTML`, option `pied`.
 */
function portraitDeCarte(f, pied = false) {
  const dessin = illustration(f, pied ? 'plein' : 'buste');
  if (!dessin) return artProcedural(f);
  /* La classe de cadrage du personnage en pied (voir `cartes.css`). Le
     balisage vient de fanzzy-art.js et commence toujours ainsi. */
  const img = pied ? dessin.split('<img class="illu"').join('<img class="illu fz-pied"') : dessin;
  return `<div class="illuwrap">${fondDeCarte(f)}${img}</div>`;
}

/**
 * Le dessin d'une carte, quelle que soit sa sorte.
 *
 * ## Trois sortes sur quatre tombaient sur une silhouette
 *
 * `art()` dessine des Fanzzy. Tout le reste — une carte d'action, une poignée
 * d'écharpes — n'est pas un Fanzzy, et retombait donc sur le bonhomme gris
 * procédural : on ouvrait un booster pour y trouver deux silhouettes
 * identiques nommées « 14 écharpes » et « 35 écharpes ».
 *
 * L'équipement avait déjà été rattrapé, seul, par `objetHTML`. Les deux autres
 * suivent ici, au même endroit, pour qu'on n'ait plus à se souvenir lequel des
 * quatre est branché.
 *
 * Les écharpes prennent **le même dessin qu'à la création d'un compte** —
 * `TBF_STUFF.illustrationGain('echarpes')`, la pile noir, blanc et orange. Deux
 * écrans qui montrent la même monnaie doivent montrer la même image, sinon le
 * joueur croit avoir gagné autre chose.
 *
 * Chaque branche est **facultative** : ces trois bibliothèques sont chargées
 * page par page, et une page qui n'en charge pas une doit retomber sur le
 * dessin procédural plutôt que de ne rien afficher.
 *
 * ## L'étiquette d'un état ou d'une tenue (lot 4)
 *
 * Elle était posée **sur le dessin**, en position absolue au-dessus du nom,
 * et sa hauteur se devinait : un nom de trois lignes la faisait encore
 * passer dessous. `cardHTML` la range maintenant **dans le flux du bandeau
 * du nom**, où elle ne peut plus le recouvrir, et demande donc le dessin
 * sans elle (`etiquette: false`). Appelée seule, la fonction la garde : qui
 * montre le dessin sans la carte veut encore savoir de quel moment il
 * s'agit.
 *
 * Les images reçoivent une classe de cadrage : `fz-pied` pour un
 * personnage en pied (la pose d'un état, d'une tenue, ou le Fanzzy d'une
 * grande carte quand on demande `pied`), `fz-pleine` pour une illustration
 * qui couvre toute la carte (une carte d'action). Sans classe, c'est le
 * buste d'un Fanzzy. Voir `cartes.css`, « le dessin ».
 *
 * ## La silhouette d'une carte qu'on n'a pas (`silhouette`)
 *
 * Le pochoir gris d'une carte non possédée éteint l'image au noir puis la
 * remonte en gris : ce n'est une silhouette que si l'image est **détourée**.
 * Les bustes ne le sont pas tous (celui de la Clé du Local est opaque à
 * 95 %, le portrait du troisième âge de Gosier à 84 %) : éteints, ils
 * devenaient une dalle grise tachée de noir, et les cartes les plus
 * désirables étaient les plus ternes. `silhouette` demande donc une image
 * détourée partout où le dessin d'un personnage en a une — la pose en pied
 * (`resoudre`) ou le plein-pied plat (`adresse(…, 'plein')`, comme les
 * pochettes du classeur), jamais le portrait ni le buste —, et la marque
 * `fz-pied`. `cardHTML` le pose avec `verrou`.
 */
function dessinDeCarte(f, { etiquette = true, pied = false, silhouette = false } = {}) {
  /* **Un état se dessine avec le dessin qu'il donne.**
   *
   * `art(f)` cherche un Fanzzy nommé `f.id` — or l'identifiant d'un état est
   * « joie », pas « RP21 ». Sans cette branche, la carte d'un état tombait sur
   * la silhouette grise procédurale, exactement la faute que le commentaire
   * ci-dessus raconte pour les trois autres sortes. C'est la quatrième.
   *
   * On montre donc le personnage **dans cet état-là** : c'est le gain, et le
   * voir est tout l'intérêt de l'avoir tiré. `resoudre` retombe seul sur le
   * repos si le dessin n'existe pas encore — toutes les lignées ne sont pas
   * dessinées, et une carte sans image serait pire qu'une carte au repos. */
  if (f.etat && f.pour) {
    /* Le dessin de l'état, s'il existe. Toutes les lignées ne sont pas
       dessinées dans les quatre expressions, et `resoudre` rend `null`
       plutôt que d'inventer. */
    const r = window.TBF_ETATS?.resoudre?.(f.pour, { evo: f.stage ?? 1, etat: f.id });
    /* **Le repli est le portrait du personnage, pas une silhouette.**
     *
     * Sans cette ligne, la carte retombait sur `art(f)`, qui cherche un
     * Fanzzy nommé « pousse » — un identifiant d'état, pas de personnage — et
     * dessinait donc le bonhomme gris procédural. C'est la faute que le
     * commentaire de `dessinDeCarte` raconte pour les trois autres sortes,
     * et je l'ai refaite en ajoutant la quatrième.
     *
     * Montrer le personnage au repos dit au moins **de qui** il s'agit.
     * En silhouette, le plein-pied plutôt que le buste : il est détouré. */
    const src = r?.src ?? window.FZART?.adresse?.(f.pour, silhouette ? 'plein' : 'buste');
    if (src) {
      const enPied = r?.src ? !/portrait\.\w+(\?|$)/.test(r.src) : silhouette;
      return `<div class="illuwrap">${fondDeCarte(f)}
        <img class="illu${enPied ? ' fz-pied' : ''}" src="${src}" alt="" loading="lazy"
             onerror="this.src=window.TBF_ETATS?.secours?.(this.src,true)||''">
        ${etiquette && f.etatMot ? `<span class="tbf-etiq">${esc(f.etatMot)}</span>` : ''}</div>`;
    }
  }
  /* **Et la cinquième sorte tombait encore sur la silhouette.**
   *
     Le commentaire en tête de cette fonction raconte la même panne pour
     trois sortes de cartes, celui de la branche précédente pour la
     quatrième. La tenue faisait la cinquième : `art(f)` cherche un Fanzzy
     nommé « halloween », n'en trouve évidemment aucun, et dessine le
     bonhomme gris. Le joueur gagnait un déguisement et voyait une
     silhouette — c'est-à-dire exactement ce que le déguisement n'est pas.

     Les images existaient : le manifeste de chaque lignée déclare son skin
     avec son portrait. Personne ne les demandait.

     On montre donc le personnage **habillé comme ça**, à l'âge tiré. Le
     repli est le même que pour un état, et pour la même raison : le
     portrait ordinaire dit au moins de qui il s'agit. */
  if (f.skin && f.pour) {
    const evo = f.stage ?? 1;
    /* **Le repos, pas le portrait**, et c'est une question de cadrage : `.illu`
       pose l'image sur la base de la carte et la déborde de 4 % en hauteur —
       un réglage fait pour une silhouette entière. Un portrait est déjà un
       buste ; recadré par-dessus, il ne montre plus qu'un front.

       C'est aussi ce que fait la branche des états quelques lignes plus haut,
       et deux cartes voisines dans le même butin doivent se ressembler.

       `portrait` reste en second : un skin peut n'avoir qu'un buste. Pas en
       silhouette : un portrait est opaque, et le plein-pied plat, détouré,
       dit aussi bien de qui il s'agit. */
    const r = window.TBF_ETATS?.resoudre?.(f.pour, { evo, skin: f.id, etat: 'neutre' })
      ?? (silhouette ? null : window.TBF_ETATS?.portrait?.(f.pour, { evo, skin: f.id }));
    const src = r?.src ?? window.FZART?.adresse?.(f.pour, silhouette ? 'plein' : 'buste');
    if (src) {
      /* `fz-pied` seulement quand c'est la pose en pied : `portrait`, le
         second repli, rend un buste, que le cadrage du buste pose mieux. */
      const enPied = r?.src ? !/portrait\.\w+(\?|$)/.test(r.src) : silhouette;
      return `<div class="illuwrap">${fondDeCarte(f)}
        <img class="illu${enPied ? ' fz-pied' : ''}" src="${src}" alt="" loading="lazy"
             onerror="this.src=window.TBF_ETATS?.secours?.(this.src,true)||''">
        ${etiquette && f.skinMot ? `<span class="tbf-etiq">${esc(f.skinMot)}</span>` : ''}</div>`;
    }
  }
  if (f.stuff) return objetHTML(f);
  if (f.lieu) {
    return `<div class="illuwrap">${fondDeCarte(f)}
      <img class="illu fz-pleine" src="${lieuSrc(f.id, true)}" alt="" loading="lazy"
           onerror="if(!/\\.jpg$/.test(this.src))this.src='/img/stade/${esc(f.id)}-mini.jpg';else this.remove()"></div>`;
  }
  if (f.action && window.TBF_ACTION) {
    return `<div class="illuwrap">${fondDeCarte(f)}
      ${window.TBF_ACTION.illustration(f.id, 'illu fz-pleine')}</div>`;
  }
  if (f.echarpes && window.TBF_STUFF?.illustrationGain) {
    return `<div class="illuwrap">${fondDeCarte(f)}
      ${window.TBF_STUFF.illustrationGain('echarpes', 'illu objet')}</div>`;
  }
  /* **La silhouette de repli est celle du personnage, pas celle de l'objet.**

     Toutes les lignées ne sont pas dessinées, et celles-là n'ont que le
     bonhomme procédural — c'est leur dessin, pas un pis-aller. Mais
     `artProcedural` tire son bonhomme de l'identifiant qu'on lui donne : avec
     « halloween » ou « depit », il en tirait un inconnu, sans rapport avec
     celui que le classeur montre pour ce même personnage sur toutes ses
     autres cartes. Le joueur voyait donc **deux êtres différents** sous le
     même nom, à deux écrans d'écart.

     `pour` est la racine de lignée, et c'est la graine que le reste du jeu
     emploie. La carte de la tenue montre alors la même silhouette que la
     carte du personnage — ce qui est, exactement, ce qu'elle raconte. */
  /* En silhouette, le plein-pied, détouré : voir plus haut. */
  if (f.pour) return portraitDeCarte({ ...f, id: f.pour }, pied || silhouette);
  return portraitDeCarte(f, pied || silhouette);
}

/**
 * La famille d'une carte, et son repli.
 *
 * **Une famille inconnue vidait toutes les grilles du jeu.** `TYPES[f.type]`
 * était lu sans garde et déréférencé trois fois — la couleur de la pastille,
 * son pictogramme, le nom de la famille. Un type absent du catalogue rendait
 * donc `undefined`, `t.c` levait, et le `map(...).join('')` qui l'entoure
 * s'interrompait **au complet** : pas une carte abîmée, une grille vide. Sur le
 * classeur, le kiosque, la collection et l'écran de bienvenue à la fois,
 * puisque tous les quatre dessinent par ici.
 *
 * Et ça n'a rien d'hypothétique : `chargerCatalogue` vérifie que `types` n'est
 * pas vide, jamais que chaque carte a le sien. Une famille ajoutée à une carte
 * et oubliée dans la table, un catalogue servi à moitié, et c'est l'écran
 * entier qui disparaît.
 *
 * Le repli est celui de `famDe` dans `action-art.js`, au mot près : « une
 * famille inconnue ne doit pas vider une carte ». La craie plutôt que le
 * violet — ici c'est la rareté qui porte la couleur, et le gris neutre est
 * celui d'une commune.
 */
const typeDe = (f) => TYPES[f?.type] ?? { nom: '', c: '#C2CAD6', ico: '' };

/**
 * Ce que dit le pied d'une grande carte, sous le nom : la famille et la
 * poussée du cri d'un Fanzzy (« VOIX · POUSSÉE 64 »), la sorte de tout le
 * reste. Les autres sortes empruntent une famille pour leur couleur et leur
 * pictogramme (voir `carteDuPaquet`) : l'écrire en clair ferait d'une tenue
 * un tifo. Une poignée d'écharpes n'a rien à dire de plus que son nom — la
 * ligne disparaît, jamais un tiret.
 */
function piedDe(f, t) {
  if (f.etat) return 'état';
  if (f.skin) return 'tenue';
  if (f.stuff) return 'équipement';
  if (f.action) return 'carte d’action';
  if (f.lieu) return 'stade';
  if (f.echarpes) return '';
  const puissance = Number(f.cri?.power);
  return [t.nom, Number.isFinite(puissance) && puissance > 0 ? `poussée ${puissance}` : '']
    .filter(Boolean).join(' · ');
}

/** Le numéro de pochette, « N° 013 » : trois chiffres au moins, comme un album. */
const numeroDe = (n) => `N° ${/^\d+$/.test(String(n)) ? String(n).padStart(3, '0') : String(n)}`;

/**
 * **Une carte : le sticker de carte** (lot 4, refonte FAIT MAIN).
 *
 * La plaque de sa rareté en fond, le personnage devant ; autour, le bord de
 * découpe craie et le cerne d'encre, l'ombre dure ; le nom en banderole sur
 * une bande craie de travers ; le pin de la famille et l'âge en haut à
 * gauche, la forme de rareté et son mot en haut à droite. La matière dit la
 * rareté une quatrième fois — carton mat, liseré plastifié, holo, liseré
 * d'or — et **ne bouge pas en grille** : seules la vitrine, la fiche et la
 * révélation l'animent (`anime`).
 *
 * `--tc` porte toujours la couleur de la famille et `r-<rareté>` la rareté.
 * Les deux ont été confondus un temps : le cadre prenait la couleur du type,
 * et une commune et une légendaire du même type se ressemblaient trait pour
 * trait dans la grille.
 *
 * ## Les options — toutes facultatives
 *
 * La signature ne change pas : les sept écrans et les suites qui l'appellent
 * avec `{ mini }` ou `{ mini, verrou }` reçoivent la même carte, redessinée.
 *
 *   mini       carte de grille : matière statique, pas de ligne d'effets ;
 *   verrou     non possédée : pochoir gris sous trame, scotch en croix et
 *              cadenas ; ni âge, ni doublons, ni AVATAR, **ni matière** — pas
 *              de liseré d'or sur une légendaire, rien qui bouge sauf si la
 *              page le demande (`anime`) ; le personnage en silhouette, tiré
 *              d'une image détourée (voir `dessinDeCarte`) ;
 *   numero     avec `verrou` : la bande porte le numéro de pochette
 *              (« N° 013 ») au lieu du nom, gardé pour le lecteur d'écran ;
 *   raison     avec `verrou` : ce qui ouvre la case (« NIV. 10 »), écrit à
 *              côté du cadenas — une croix ne reste jamais muette ;
 *   secret     âge à venir : le dessin flou, « ÂGE À VENIR » sur la bande ;
 *   prix       le sticker de prix craie, jeton d'écharpes et montant ;
 *   doublons   « ×N » en sticker rond, quand N > 1 ;
 *   avatar     AVATAR en sticker craie, sur la bande du nom ;
 *   titulaire  TITULAIRE en sticker vert, sur la bande du nom ;
 *   anime      la matière bouge (l'épique dérive, la légendaire tourne) et
 *              le personnage respire ; par défaut, toute carte qui n'est
 *              ni `mini` ni `verrou` — la vitrine, la fiche, la révélation ;
 *   pied       le Fanzzy en pied plutôt qu'en buste, **sur demande** : la
 *              carte regardée seule (la vitrine, la fiche). Il était posé
 *              par défaut sur toute carte non `mini`, et la révélation d'un
 *              booster téléchargeait chaque carte deux fois (en pied pour
 *              la révélation, en buste pour le butin), la bienvenue ses neuf
 *              plein-pieds d'un coup — 55 Ko pièce contre 14. Une pile ou
 *              une grille garde le buste. `verrou` prend toujours l'image
 *              détourée, quelle que soit cette option ;
 *   flip       la carte se retourne : `retourner(el)` construit son verso
 *              au premier appel, pas avant.
 *
 * Les tailles sont toutes en `--u` (un centième de la carte) avec des
 * planchers en pixels : la même carte se lit de 86 à 300 pixels. Ce que
 * chaque écran doit savoir (les débords, les classes, le budget
 * d'animations) est écrit en tête de `cartes.css`.
 */
function cardHTML(f, opts = {}) {
  /* La famille du pin. Un état et une tenue appartiennent à un personnage :
     ils prennent **sa** famille, pas celle qu'ils empruntent pour leur
     couleur (`carteDuPaquet` leur prête la fidélité et le tifo). Une pièce,
     une action, des écharpes n'ont pas de famille : leur pin garde son
     pictogramme d'emprunt, et ne le dit pas au lecteur d'écran. */
  const proprio = (f.etat || f.skin) && f.pour ? BY_ID.get(f.pour) : null;
  const t = typeDe(proprio ?? f);
  const famille = !(f.stuff || f.action || f.lieu || f.echarpes) && t.nom;
  /* **Le pictogramme du pin, et son repli.** Le tracé vient du catalogue
     (`TYPES[type].ico`). Une page qui ne charge pas le catalogue — la fiche,
     à l'adresse /fanzzy/<id> : une requête lourde de plus — ne connaît de la
     famille que son nom et sa couleur, et le pin restait un rond de craie
     vide. On y pose alors l'emblème de la famille (`TBF_LOGO`,
     /img/logo/type-*), que la feuille éteint en grisaille d'encre : c'est un
     pictogramme de pin, pas un pin's émaillé — l'or de la Voix et le violet
     du Tifo ne se posent pas sur une carte. Seulement pour une famille dont
     on sait le nom (son emblème existe) : une famille inconnue ne coûte pas
     une requête vers une image qui n'existe pas. Sans `TBF_LOGO`, le rond
     reste vide, comme avant. */
  const cleType = (proprio ?? f)?.type;
  const picto = t.ico
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${esc(t.ico)}"/></svg>`
    : t.nom && /^[a-z]+$/.test(String(cleType ?? '')) && window.TBF_LOGO?.type
      ? window.TBF_LOGO.type(cleType, 'fz-picto') : '';
  const rar = rareteDe(f.rar);
  const verrou = Boolean(opts.verrou);
  const secret = Boolean(opts.secret);
  /* **Une carte qu'on n'a pas ne bouge pas** : c'est un pochoir sous scotch,
     sans matière. Animée par défaut parce qu'elle n'était pas `mini`, la
     légendaire manquante de la vitrine faisait tourner son liseré d'or sans
     fin autour d'une silhouette grise qui respirait. */
  const anime = opts.anime ?? (!opts.mini && !verrou);
  const enPied = verrou || opts.pied === true;
  const holo = !verrou && (rar === 'epique' || rar === 'legendaire') ? ' holo' : '';
  const classes = `fz r-${rar}${holo}${opts.mini ? ' fz-mini' : ''}${anime ? ' fz-anime' : ''}`
    + `${verrou ? ' fz-verrou' : ''}${secret ? ' fz-secret' : ''}${opts.flip ? ' fz-flip' : ''}`;
  /* Le dos qu'on montrera au retournement : celui de la série de la carte,
     LA REPRISE pour ce qui n'en a pas (une tenue, une pièce, une action). Une
     adresse et pas une image : rien ne se télécharge avant le geste. */
  const dos = opts.flip ? window.FZART?.dos?.(f.set ?? 'RP') ?? '' : '';

  /* L'âge : un Fanzzy, un état, une tenue en ont un. Une pièce, une action,
     une poignée d'écharpes n'en ont pas — « ÉVO 1 » sur un thermos ne disait
     rien —, et une légendaire n'en a qu'un, que sa forme dit déjà. */
  const sansAge = verrou || rar === 'legendaire' || f.stuff || f.action || f.lieu || f.echarpes;
  const stade = Math.max(1, Number(f.stage) || 1);
  const age = sansAge ? '' : `<div class="age a${stade}">ÉVO ${stade}</div>`;

  /* Ce qui se pose **sur** la bande du nom, dans son flux : la bande les
     porte, elle ne peut donc plus passer dessous, quel que soit le nombre de
     lignes du nom. */
  const etiquette = f.etatMot ?? f.skinMot ?? '';
  const sur = [
    opts.titulaire && !verrou ? '<span class="tbf-sticker fz-titulaire" data-ton="vert">TITULAIRE</span>' : '',
    opts.avatar && !verrou ? '<span class="tbf-sticker fz-avatar">AVATAR</span>' : '',
    etiquette ? `<span class="tbf-etiq">${esc(etiquette)}</span>` : '',
  ].join('');

  const nom = verrou && opts.numero != null && opts.numero !== ''
    ? `<div class="nm numero"><span class="tbf-vh">${esc(f.nom)}, </span>${esc(numeroDe(opts.numero))}</div>`
    : secret ? '<div class="nm">ÂGE À VENIR</div>'
      : `<div class="nm">${esc(f.nom)}</div>`;
  const pied = piedDe(f, t);

  /* L'éclat de la forme ne tourne pas sur la carte, même animée : le liseré
     d'or tourne déjà, et deux holos feraient deux animations infinies pour
     un seul mouvement (trois au plus par écran). */
  const forme = formeHTML(rar, { coin: true, classe: 'fz-forme' });

  const n = Math.floor(Number(opts.doublons) || 0);
  const prix = opts.prix != null && opts.prix !== '' && Number.isFinite(Number(opts.prix))
    ? Number(opts.prix) : null;
  const jeton = window.TBF_STUFF?.gain?.('echarpes') ?? '/img/gains/echarpes.webp';

  return `<div class="${classes}" style="--tc:${t.c}" data-id="${esc(f.id)}" data-rar="${rar}"${
    dos ? ` data-dos="${esc(dos)}"` : ''}>
    <div class="body">
      <div class="art">${dessinDeCarte(f, { etiquette: false, pied: enPied, silhouette: verrou })}</div>
      ${rar === 'legendaire' && !verrou ? '<i class="lisere" aria-hidden="true"></i>' : ''}
      <div class="haut">
        <div class="pip"${famille ? ` role="img" aria-label="${esc(t.nom)}"` : ' aria-hidden="true"'}>${picto}</div>
        ${age}
      </div>
      ${forme}
      ${verrou ? `<span class="tbf-scotch tbf-scotch--croix fz-croix" aria-hidden="true"></span>
        <span class="cadenas" role="img" aria-label="pas encore à toi"><i class="tbf-ico tbf-ico-cadenas"
          aria-hidden="true"></i>${opts.raison ? `<b>${esc(opts.raison)}</b>` : ''}</span>` : ''}
      ${prix !== null ? `<span class="tbf-sticker tbf-sticker--prix fz-prix"><img src="${esc(jeton)}"
        alt="" aria-hidden="true">${prix}<span class="tbf-vh"> écharpes</span></span>` : ''}
      ${!verrou && n > 1 ? `<span class="tbf-sticker fz-doublons">×${n}</span>` : ''}
      ${opts.mini ? '' : `<div class="mods">${modsText(f).slice(0, 2).join('<br>')}</div>`}
      ${sur ? `<div class="sur">${sur}</div>` : ''}
      <div class="top">
        ${nom}
        ${pied ? `<div class="foot">${esc(pied)}</div>` : ''}
      </div>
    </div>
  </div>`;
}

/**
 * **Retourne une carte** posée avec `flip`, et construit son verso au
 * premier appel (« le verso construit à la demande ») : une grille de
 * cinquante cartes retournables ne télécharge pas cinquante dos.
 *
 * `el` est la carte (`.fz`) ou n'importe quoi dedans ou autour d'elle ;
 * `retournee` force un côté, sinon on bascule. Rend le côté montré
 * (`true` : le dos). Sans mouvement (préférence ou mode calme), la carte
 * change de face sans tourner — c'est `cartes.css` qui le décide.
 */
function retourner(el, retournee) {
  const fz = el?.closest?.('.fz') ?? el?.querySelector?.('.fz') ?? null;
  if (!fz) return false;
  if (!fz.querySelector(':scope > .verso')) {
    const v = document.createElement('div');
    v.className = 'verso';
    v.setAttribute('aria-hidden', 'true');
    if (fz.dataset.dos) v.style.backgroundImage = `url("${fz.dataset.dos}")`;
    fz.append(v);
    fz.classList.add('fz-flip');
    /* Une image de lecture : la face cachée doit avoir pris sa place avant
       de tourner, sinon le premier retournement se fait d'un bloc. */
    void v.offsetWidth;
  }
  const dos = fz.classList.toggle('fz-retournee', retournee);
  fz.querySelector(':scope > .body')?.setAttribute('aria-hidden', String(dos));
  return dos;
}

/**
 * Une carte tirée, telle que le serveur l'annonce, rendue en entrée de
 * catalogue — celle que `cardHTML` sait dessiner.
 *
 * ## Pourquoi elle est ici et non dans la page
 *
 * Elle a vécu dans `boosters.html`, et l'accueil en avait sa propre version :
 * une tuile faite main, avec un buste, un nom et une phrase. Le joueur ouvrait
 * donc son premier paquet sur des cartes qui ne ressemblaient pas à celles du
 * jeu, et découvrait les vraies au deuxième booster. **Le premier paquet est
 * celui dont on se souvient**, et c'était le seul à ne pas montrer le jeu.
 *
 * Deux tables pour la même conversion auraient divergé — c'est exactement ce
 * qui est arrivé au catalogue recopié. Il n'y en a plus qu'une.
 *
 * ## Les quatre sortes, et leurs emprunts
 *
 * `type` sert à choisir une couleur et un pictogramme, faute d'en avoir de
 * propres : une tenue prend ceux du tifo, l'équipement ceux du déplacement, une
 * carte d'action ceux de la pyro.
 *
 * La page n'en connaissait qu'une sorte à l'origine. Les tenues arrivaient sous
 * leur identifiant — « prehistorique » là où il fallait lire « Préhistorique » —
 * et l'équipement comme les cartes d'action n'étaient connus de personne : ils
 * tombaient dans la branche « carte inconnue », se faisaient jeter, et le joueur
 * lisait qu'il devait recharger sa page.
 *
 * ## Deux noms pour les écharpes
 *
 * Le kiosque les annonce `echarpes/montant`, l'accueil `scarves/amount` : deux
 * routes écrites à des mois d'écart pour la même monnaie. On accepte les deux
 * ici plutôt que de renommer une réponse d'API dont d'anciens clients
 * dépendent — et le reste du jeu n'a plus à savoir qu'il y en avait deux.
 */
/* Le nom et la phrase d'un état, côté joueur.
   `rendus.js` décrit le dessin — « bras levés… » — ce qui sert à le
   fabriquer. Sur une carte, c'est le **moment** qu'on nomme : un supporter
   ne collectionne pas « bras levés », il collectionne la joie. */
const ETATS_CARTE = {
  joie: ['La joie', 'But, victoire, carton pour eux — il exulte.'],
  depit: ['Le dépit', 'On encaisse, on perd — il se prend la tête.'],
  pousse: ['On pousse', 'Il chante, penché en avant, l’écharpe tendue.'],
  colere: ['Pas content', 'Carton contre nous — il conteste.'],
};

function carteDuPaquet(c) {
  /* **Un état.** Il appartient à un âge d'un personnage précis — d'où `pour`
     et `stade`, comme pour un skin — et il ne change rien au jeu : c'est du
     confort, jamais de la puissance. `fide` pour sa couleur, celle de la
     fidélité : c'est ce que la case remplie raconte. */
  if (c.type === 'etat') {
    const [mot, texte] = ETATS_CARTE[c.id] ?? [c.id, ''];
    /* **La carte porte le nom du personnage, pas celui de l'état.**
     *
     * Elle affichait « ON POUSSE » et rien d'autre : on ouvrait un paquet, on
     * gagnait un état, et on ne savait pas **de qui**. Or un état n'existe pas
     * tout seul — c'est la joie de quelqu'un, et c'est ce quelqu'un qu'on
     * collectionne. Le mot de l'état reste, en étiquette sur le dessin.
     *
     * `pour` est la racine de lignée ; le catalogue la connaît toujours, même
     * si le joueur n'a pas encore l'âge concerné. */
    const perso = BY_ID.get(c.pour);
    return { id: c.id, nom: perso?.nom ?? mot, texte: `${mot} — ${texte}`,
      type: 'fide', rar: 'rare', stage: c.stade ?? 1,
      etat: true, etatMot: mot, pour: c.pour };
  }
  /* **Une tenue non plus n'existe pas toute seule.**
   *
     La carte annonçait « HALLOWEEN » et rien d'autre : on ouvrait un paquet,
     on gagnait un déguisement, et on ne savait pas **pour qui**. C'est mot
     pour mot ce qui avait été corrigé deux branches plus haut pour les
     états, et la tenue est restée en arrière — les deux cas sont pourtant le
     même : un objet qui appartient à l'âge d'un personnage précis, et que le
     serveur envoie avec son `pour` et son `stade` depuis le premier jour.

     `stade` était jeté au passage, remplacé par un 1 en dur. Le serveur
     habille l'âge qu'il a tiré — il peut très bien donner la tenue du
     second âge — et la carte annonçait alors « ÉVO 1 » en montrant l'autre. */
  if (c.type === 'skin') {
    const t = TENUES.get(c.id);
    const perso = BY_ID.get(c.pour);
    return { id: c.id, nom: perso?.nom ?? t?.nom ?? c.id, texte: t?.texte, type: 'tifo',
      rar: t?.rar ?? 'rare', stage: c.stade ?? 1, skin: true,
      skinMot: t?.nom ?? c.id, pour: c.pour };
  }
  if (c.type === 'stuff') {
    const o = STUFFS.get(c.id);
    return { id: c.id, nom: o?.nom ?? c.id, texte: o?.texte, type: 'depl',
      rar: o?.rar ?? 'rare', stage: 1, stuff: true, mods: o?.mods };
  }
  /* **Un lieu.** Un stade vu du dessus, qui remplit la carte comme une scène
     de carte d'action. Son effet est écrit en clair : il change la même
     règle pour les deux tribunes, et c'est ce qu'on veut savoir en le
     gagnant. `depl` pour sa couleur, le vert de la pelouse, et son bus : on
     se déplace pour aller dans un stade. Faute de famille propre — en
     inventer une la ferait apparaître dans les filtres. */
  if (c.type === 'lieu') {
    const l = LIEUX.get(c.id);
    return { id: c.id, nom: l?.nom ?? c.id, texte: l?.effet ?? l?.texte, type: 'depl',
      rar: l?.rar ?? 'rare', stage: 1, lieu: true };
  }
  if (c.type === 'action') {
    const a = ACTES.get(c.id);
    return { id: c.id, nom: a?.nom ?? c.id, texte: a?.texte, type: 'pyro',
      rar: a?.rar ?? 'rare', stage: 1, action: true };
  }
  /* Une poignée d'écharpes. Ce n'est pas un lot de consolation : c'est ce qui
     paie les évolutions, donc les âges qu'aucun booster ne donne. La rareté
     suit la taille de la poignée, pour que l'ouverture ait la couleur du gain
     plutôt qu'une couleur fixe. */
  if (c.type === 'echarpes' || c.type === 'scarves') {
    const n = c.montant ?? c.amount ?? 0;
    // `voix` pour sa couleur : c'est l'or du jeu, celui des écharpes. Il n'y a
    // pas de type propre à la monnaie, et en inventer un ferait apparaître une
    // famille de plus dans tous les filtres du classeur.
    return { id: 'echarpes', nom: `${n} écharpes`, type: 'voix',
      texte: 'De quoi faire grandir un supporter que tu as déjà.',
      rar: n >= 30 ? 'epique' : n >= 14 ? 'rare' : 'commune',
      stage: 1, echarpes: true, montant: n };
  }
  return BY_ID.get(c.id);
}

/* -------------------------------------------------------------- tirage

   Il n'est pas ici. Le serveur tire, débite le booster et écrit la collection
   dans une seule transaction ; la page reçoit les cinq cartes déjà décidées.

   Une copie du tirage a vécu à cet endroit, avec ses propres taux et son
   propre repli. Elle n'était appelée nulle part — et c'est le pire des cas :
   personne ne la corrigeait quand le serveur changeait, et personne ne la
   voyait diverger. Le jour où le serveur a appris à ne plus tirer de carte
   « undefined » sur une série sans commune, cette copie-là ne l'a pas appris.
   Elle est partie. */


  /* L'état est un **objet partagé**, pas une copie : le kiosque le modifie en
     ouvrant un booster, la page des Fanzzy le relit. Exporter une copie ferait
     deux vérités dont l'une vieillirait en silence. */
  window.TBF_CARTES = { $, AC, ACTES, ART, BY_ID, DEX, EVO_COST, ILLUSTRES, IMG_EXT, LIEUX, MAXP, MOT_RARETE, PERSOS, PLACES_EN_FENTES, RAR, S, SCARVES, SETS, SETS_TOUTES, STUFFS, TENUES, TYPES, api, art, artFond, artProcedural, audio, buzz, cardHTML, carteDuPaquet, chargerCatalogue, clamp, dessinDeCarte, esc, formeHTML, illustration, lieuSrc, load, modsText, objetHTML, packArt, rarMark, reserveHTML, retourner, save, seeded, src, uid };
})();
