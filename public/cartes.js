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
  burst: 'video/gerbe.mp4',
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
 * Vibration. Enveloppée dans un try : tous les navigateurs n'exposent pas
 * l'API, et Safari iOS l'ignore silencieusement. Une animation ne doit jamais
 * tomber parce que le retour haptique n'est pas disponible.
 */
function buzz(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* sans importance */ }
}

/* ------------------------------------------------------------------ son
   Aucun fichier audio : tout est synthétisé au moment du geste. Zéro octet
   téléchargé, et le son colle exactement à l'action. Le contexte n'est créé
   qu'au premier toucher, comme l'exigent les navigateurs. */

let AC = null;
const audio = {
  ready() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
    if (AC?.state === 'suspended') AC.resume();
    return AC;
  },
  /** Bruit filtré : le papier alu qu'on déchire. */
  rip(intensity = 1) {
    const ac = this.ready(); if (!ac) return;
    const dur = 0.28 * intensity;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 1.6;
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(1400, ac.currentTime);
    f.frequency.exponentialRampToValueAtTime(4200, ac.currentTime + dur);
    f.Q.value = 0.8;
    const g = ac.createGain(); g.gain.value = 0.22 * intensity;
    src.connect(f).connect(g).connect(ac.destination); src.start();
  },
  /** Claquement sec : la carte qui se retourne. */
  flip() {
    const ac = this.ready(); if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(620, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(180, ac.currentTime + 0.09);
    g.gain.setValueAtTime(0.14, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.11);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.12);
  },
  /** Accord montant : plus la carte est rare, plus l'accord est riche. */
  chime(rar) {
    const ac = this.ready(); if (!ac) return;
    const notes = { epique:[523,659], legendaire:[523,659,784,1047,1319] }[rar];
    if (!notes) return;
    notes.forEach((hz, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = hz;
      const t = ac.currentTime + i * 0.07;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 1.2);
    });
  },
  /** Grondement de tribune pour une couronne. */
  roar() {
    const ac = this.ready(); if (!ac) return;
    const dur = 1.8;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / d.length;
      d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * t) * 0.9;
    }
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = ac.createGain(); g.gain.value = 0.3;
    src.connect(f).connect(g).connect(ac.destination); src.start();
  },
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
  const json = await res.json().catch(() => ({}));
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
  S.nextIn = st.wallet.nextPackInMs;
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

function packArt(set) {
  const r = seeded(set.id), u = 'p' + uid++;
  let s = `<svg viewBox="0 0 100 160" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
   <defs><linearGradient id="pg${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${set.c2}"/>
     <stop offset=".55" stop-color="${set.c1}" stop-opacity=".5"/><stop offset="1" stop-color="${set.c2}"/></linearGradient>
   <filter id="pb${u}"><feGaussianBlur stdDeviation="6"/></filter></defs>
   <rect width="100" height="160" fill="url(#pg${u})"/>
   <polygon points="10,0 24,0 46,96 -6,96" fill="#F5C33B" opacity=".11"/>
   <polygon points="76,0 90,0 106,96 54,96" fill="#F5C33B" opacity=".11"/>`;
  for (let i = 0; i < 5; i++) s += `<ellipse cx="${(14 + r() * 72).toFixed(1)}" cy="${(90 + r() * 50).toFixed(1)}" rx="${(18 + r() * 22).toFixed(1)}" ry="${(14 + r() * 16).toFixed(1)}" fill="${set.c1}" opacity=".28" filter="url(#pb${u})"/>`;
  let st = 'M0 160'; for (let i = 0; i < 7; i++) st += `L${i * 15} ${160 - i * 7}L${(i + 1) * 15} ${160 - i * 7}`;
  s += `<path d="${st}L100 160Z" fill="#05080C" opacity=".9"/>
   <text x="50" y="34" text-anchor="middle" font-family="Oswald,Impact,sans-serif" font-size="13" fill="#F2EEE4" letter-spacing="3">FANZZY</text>
   <line x1="26" y1="40" x2="74" y2="40" stroke="#F2EEE4" stroke-width=".8" opacity=".5"/>
   <text x="50" y="55" text-anchor="middle" font-family="Oswald,Impact,sans-serif" font-size="7.5" fill="${set.c1}" letter-spacing="1.4">${set.nom}</text></svg>`;
  return s;
}

/* --------------------------------------------------------- rendu carte */

function modsText(f) {
  // `?? {}` et non `f.mods` : seuls un supporter et une pièce
  // d’équipement portent des effets. Une tenue n’en a jamais eu, une
  // carte d’action porte un `effet` et non des `mods` — et c’est en
  // butant ici que l’ouverture d’un booster s’interrompait sans un mot,
  // le paquet débité et l’écran vide.
  const m = f.mods ?? {}, out = [];
  if (m.tempoWindow) out.push(`Tempo plus tolérant (×${m.tempoWindow})`);
  if (m.tempoInterval) out.push(`Cadence ralentie de ${m.tempoInterval} ms`);
  if (m.mashTime) out.push(`Martelage ${Math.abs(m.mashTime) / 1000} s plus court`);
  if (m.mashBonus) out.push(`Martelage +${Math.round((m.mashBonus - 1) * 100)} %`);
  if (m.holdBonus) out.push(`Endurance +${Math.round((m.holdBonus - 1) * 100)} %`);
  if (m.holdForgive) out.push(`Peut lâcher ${m.holdForgive} fois`);
  if (m.perfectBonus) out.push(`Geste parfait ×${m.perfectBonus}`);
  if (m.backfire) out.push('Geste raté : retour de flamme');
  if (m.parryBonus) out.push(`Contre ×${m.parryBonus}`);
  if (m.breathBonus) out.push(`Souffle +${Math.round((m.breathBonus - 1) * 100)} %`);
  if (m.refundBonus) out.push(`Reprise ×${m.refundBonus}`);
  /* Ces deux-là manquaient, et ce n'est pas un détail : **cent trois cartes**
     portent `parryResist` et dix-sept portent `costPenalty`. Sur toutes, la
     fiche affichait la liste des effets sans celui-là — un effet qui agit dans
     le duel et que le joueur ne pouvait lire nulle part.

     La faute est invisible par construction : la liste n'était pas vide, elle
     était juste incomplète, et une carte qui montre deux effets sur trois a
     exactement l'air d'une carte qui en a deux. Trouvée en écrivant le
     catalogue illustré, qui compare cette table à toutes les clés employées ;
     `catalogue:test` refuse désormais qu'une clé reste sans phrase. */
  if (m.parryResist) out.push(`Résiste au contre ×${m.parryResist}`);
  if (m.costPenalty) out.push(`Chants plus chers ×${m.costPenalty}`);
  return out;
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
        ${f.etatMot ? `<span class="tbf-etiq-etat">${esc(f.etatMot)}</span>` : ''}</div>`;
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
  return art(f);
}

function cardHTML(f, opts = {}) {
  const t = TYPES[f.type];
  const holo = !opts.verrou && ['epique','legendaire'].includes(f.rar) ? ' holo' : '';
  const rc = ` r-${f.rar ?? 'commune'}`;
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
      <div class="foot"><span class="rar">${rarMark(f.rar)}</span><span class="sep"></span>
        <span>${t.nom} · ét. ${f.stage}</span></div>
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
  if (c.type === 'skin') {
    const t = TENUES.get(c.id);
    return { id: c.id, nom: t?.nom ?? c.id, texte: t?.texte, type: 'tifo',
      rar: t?.rar ?? 'rare', stage: 1, skin: true, pour: c.pour };
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
  window.TBF_CARTES = { $, AC, ACTES, ART, BY_ID, DEX, EVO_COST, ILLUSTRES, IMG_EXT, MAXP, PERSOS, RAR, S, SCARVES, SETS, SETS_TOUTES, STUFFS, TENUES, TYPES, api, art, artFond, artProcedural, audio, buzz, cardHTML, carteDuPaquet, chargerCatalogue, clamp, dessinDeCarte, esc, illustration, load, modsText, objetHTML, packArt, rarMark, save, seeded, src, uid };
})();
