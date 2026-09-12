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
const ART = {
  VN: 'img/pack-virage-nord',
  NE: 'img/pack-nuits-europeennes',
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
 * boosters, et un G1 sorti d'un paquet arrivait ici comme `undefined` et
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
const SETS = [];
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
  S.scarves = st.wallet.scarves;
  S.packs = st.wallet.packs;
  S.active = st.wallet.active;
  S.nextIn = st.wallet.nextPackInMs;
  S.packPrice = st.packPrice;
  /* Les séries que ce joueur a débloquées. `null` quand la progression n'est
     pas montée : tout est alors ouvert, comme avant. */
  S.series = st.series ? new Set(st.series) : null;
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
      <div class="art">${f.stuff ? objetHTML(f) : art(f)}</div>
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
  window.TBF_CARTES = { $, AC, ACTES, ART, BY_ID, DEX, EVO_COST, ILLUSTRES, IMG_EXT, MAXP, PERSOS, RAR, S, SCARVES, SETS, STUFFS, TENUES, TYPES, api, art, artFond, artProcedural, audio, buzz, cardHTML, chargerCatalogue, clamp, esc, illustration, load, modsText, objetHTML, packArt, rarMark, save, seeded, src, uid };
})();
