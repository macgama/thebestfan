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
 * ouverte en production, LA REPRISE, n'a pas encore de visuel : le joueur
 * voyait trois cartes identiques là où il venait chercher un sachet.
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
 * Elle ne dépend de rien d'autre dans ce fichier : la boutique et la barre,
 * qui ne le chargent pas, peuvent la reprendre telle quelle.
 *
 * @param {{ packs: number, max?: number|null, recharge?: boolean }} r
 *   `max` : le plafond de ce joueur (abonnement compris), ou rien ;
 *   `recharge` : un booster est en route (la réserve n'est pas pleine).
 * @returns {{ enFentes: boolean, html: string }} le contenu de `.tbf-fentes`.
 *   En compte, la page pose `.tbf-fentes--compte` sur le conteneur, et
 *   l'anneau de recharge hors des fentes.
 */
const PLACES_EN_FENTES = 5;
function reserveHTML({ packs, max = null, recharge = false }) {
  const n = Math.max(0, Math.floor(Number(packs) || 0));
  const plafond = Number(max) > 0 ? Math.floor(Number(max)) : null;
  const places = plafond === null ? Infinity : Math.max(plafond, n + (recharge ? 1 : 0));
  if (places <= PLACES_EN_FENTES) {
    const html = Array.from({ length: places }, (_, i) =>
      (i < n ? '<span class="tbf-fente"></span>'
        : i === n && recharge
          ? '<span class="tbf-fente tbf-fente--vide"><span class="tbf-recharge" aria-hidden="true"></span></span>'
          : '<span class="tbf-fente tbf-fente--vide"></span>')).join('');
    return { enFentes: true, html };
  }
  return { enFentes: false,
    html: `<span class="tbf-fente${n ? '' : ' tbf-fente--vide'}"></span>`
      + `<b class="tbf-sticker" aria-hidden="true">${n}</b>` };
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
 * La rareté chiffrée : un à trois losanges, une couronne pour la légendaire.
 *
 * La seconde ligne testait `legendaire` une deuxième fois — elle était donc
 * morte, et l'épique retombait sur les losanges. Une faute muette : trois
 * losanges restent une réponse plausible, personne ne cherche l'étoile qui
 * manque.
 */
function rarMark(rar) {
  if (rar === 'legendaire') return `<span class="s">♛</span>`;
  if (rar === 'epique') return `<span class="s">★</span>`;
  return '<span class="d"></span>'.repeat(RAR[rar] ?? 1);
}

/**
 * Une carte.
 *
 * `--tc` porte le type, `r-<rareté>` porte la rareté. Les deux étaient
 * confondus : le cadre prenait la couleur du type, si bien qu'une commune et
 * une légendaire du même type se ressemblaient trait pour trait dans la
 * grille. La rareté est pourtant la seule chose qu'on montre aux autres.
 *
 * `opts.verrou` : le personnage qu'on n'a pas encore. Il s'affiche quand
 * même, en ombre — voir la grille.
 */
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
function objetHTML(f) {
  return `<div class="illuwrap">${artFond(f)}
    ${window.TBF_STUFF.illustration(f.id, 'illu objet')}</div>`;
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
 */
function dessinDeCarte(f) {
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
     * Montrer le personnage au repos dit au moins **de qui** il s'agit. */
    const src = r?.src ?? window.FZART?.adresse?.(f.pour, 'buste');
    if (src) {
      return `<div class="illuwrap">${artFond(f)}
        <img class="illu" src="${src}" alt="" loading="lazy"
             onerror="this.src=window.TBF_ETATS?.secours?.(this.src,true)||''">
        ${f.etatMot ? `<span class="tbf-etiq">${esc(f.etatMot)}</span>` : ''}</div>`;
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

       `portrait` reste en second : un skin peut n'avoir qu'un buste. */
    const r = window.TBF_ETATS?.resoudre?.(f.pour, { evo, skin: f.id, etat: 'neutre' })
      ?? window.TBF_ETATS?.portrait?.(f.pour, { evo, skin: f.id });
    const src = r?.src ?? window.FZART?.adresse?.(f.pour, 'buste');
    if (src) {
      return `<div class="illuwrap">${artFond(f)}
        <img class="illu" src="${src}" alt="" loading="lazy"
             onerror="this.src=window.TBF_ETATS?.secours?.(this.src,true)||''">
        ${f.skinMot ? `<span class="tbf-etiq">${esc(f.skinMot)}</span>` : ''}</div>`;
    }
  }
  if (f.stuff) return objetHTML(f);
  if (f.action && window.TBF_ACTION) {
    return `<div class="illuwrap">${artFond(f)}
      ${window.TBF_ACTION.illustration(f.id, 'illu')}</div>`;
  }
  if (f.echarpes && window.TBF_STUFF?.illustrationGain) {
    return `<div class="illuwrap">${artFond(f)}
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
  if (f.pour) return art({ ...f, id: f.pour });
  return art(f);
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

function cardHTML(f, opts = {}) {
  const t = typeDe(f);
  const holo = !opts.verrou && ['epique','legendaire'].includes(f.rar) ? ' holo' : '';
  const rc = ` r-${f.rar ?? 'commune'}`;
  /* **Le pied ne porte que la rareté.** Il écrivait aussi « famille · ét. N »
     derrière un séparateur, que cartes.css masquait toujours : la pastille dit
     la famille, et le badge `.age` dit l'âge en clair. Resté dans le balisage,
     ce texte mort commençait par un « · » seul dès que la famille manquait au
     catalogue (`typeDe` rend alors un nom vide) — une ligne sans donnée, qui
     doit partir entière, et elle part.

     `.rar` reste un `div`, et plus aucune règle de cartes.css ne vise le
     dernier `span` du pied. Il y en avait une, écrite pour cacher ce texte :
     elle attrapait aussi la dernière marque de rareté (les losanges et
     l'étoile sont des `span`), si bien que la commune n'avait aucun losange et
     que l'épique et la légendaire montraient une pastille vide. Elle est partie
     avec le texte qu'elle cachait. */
  return `<div class="fz${rc}${holo}" style="--tc:${t.c}" data-id="${f.id}">
    <div class="body">
      <div class="top">
        <div class="pip"><svg viewBox="0 0 24 24" fill="none" stroke="#0B0E13" stroke-width="2"
          stroke-linecap="round"><path d="${t.ico}"/></svg></div>
        <div class="nm">${f.nom}</div>
      </div>
      <div class="art">${dessinDeCarte(f)}</div>
      ${opts.verrou ? `<svg class="cadenas" viewBox="0 0 24 24" stroke-linecap="round">
        <rect x="4" y="10" width="16" height="11" rx="2.5"/>
        <path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>` : ''}
      ${opts.mini ? '' : `<div class="mods">${modsText(f).slice(0, 2).join('<br>')}</div>`}
      <div class="foot"><div class="rar">${rarMark(f.rar)}</div></div>
      ${opts.verrou ? '' : `<div class="age a${f.stage}">${
        f.rar === 'legendaire' ? 'LÉGENDAIRE' : `ÉVO ${f.stage}`}</div>`}
    </div>
  </div>`;
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
  window.TBF_CARTES = { $, AC, ACTES, ART, BY_ID, DEX, EVO_COST, ILLUSTRES, IMG_EXT, MAXP, PERSOS, PLACES_EN_FENTES, RAR, S, SCARVES, SETS, SETS_TOUTES, STUFFS, TENUES, TYPES, api, art, artFond, artProcedural, audio, buzz, cardHTML, carteDuPaquet, chargerCatalogue, clamp, dessinDeCarte, esc, illustration, load, modsText, objetHTML, packArt, rarMark, reserveHTML, save, seeded, src, uid };
})();
