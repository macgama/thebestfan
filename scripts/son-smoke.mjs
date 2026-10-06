/**
 * Le son de tribune : le moteur commun (`public/son.js`), sans base.
 *
 * ## Ce que cette suite tient
 *
 *   1. **Chaque nom qu'une page appelle existe dans la banque.** Deux appels
 *      sonnaient dans le vide depuis longtemps sans que rien ne le dise —
 *      `FX.son('gong')` à l'affiche du duel, `FX.son('ok')` à l'accueil :
 *      la banque ne les avait pas, et un nom inconnu se tait. Même chose pour
 *      la façade de `cartes.js`, les chants et les niveaux d'ambiance.
 *   2. **Un seul contexte, jamais avant le premier geste**, chargé par
 *      `fx.js` sans balise de plus dans les pages. `cartes.js` n'en crée
 *      plus : sa façade, chargée dans une page comme au kiosque, sonne par
 *      le moteur ; aucun fichier de `public/` hors de `son.js` ne construit
 *      (ni ne garde de quoi construire) un AudioContext ; un seul nœud va
 *      aux haut-parleurs, celui de la chaîne. Un geste, c'est le joueur : un
 *      clic lancé par script (le Virage en lance un à l'entrée par un lien)
 *      ou la touche Échap, sur une page que rien n'a activée, n'ouvrent
 *      rien, et aucun son demandé avant ne part d'un coup au premier vrai
 *      toucher.
 *   3. **Le calme coupe tout**, ambiance et chants compris, et ce qui joue
 *      déjà : arrêté, pas mis en pause (l'ovation ne reprend pas au réveil).
 *   4. **Aucun son ne sort de sa fenêtre, aucun ne sature** : le banc
 *      (`son-banc.mjs`) rend chaque son hors ligne à travers la chaîne
 *      complète, et la mesure est jugée contre le mixage que le moteur
 *      déclare. Le plafond est éprouvé seul, par un signal que le limiteur
 *      ne peut plus tenir. La mesure se fait **chaîne chaude**, limiteur
 *      ouvert, comme en jeu (lot 6) ; et une rafale de tics à dix par
 *      seconde, celle du pavé, ne couvre pas le tambour du chant. **Le
 *      premier son d'une visite**, joué dans le toucher qui fait naître le
 *      contexte, sort comme les suivants — hors ligne, sur une chaîne rendue
 *      depuis sa naissance, et à l'écoute du contexte vivant (lot 6).
 *   5. **Tout fonctionne sans AudioContext** : un navigateur qui n'en a pas
 *      n'entend rien, et rien ne lève.
 *   6. **L'ambiance s'arrête quand l'onglet est caché**, et revient au
 *      retour ; demandée onglet caché, elle ne construit rien ; à zéro,
 *      elle baisse en fondu puis se démonte ; elle ne recrée aucun nœud
 *      tant que rien ne change. Les sons ponctuels en cours (l'ovation)
 *      s'arrêtent avec elle, et ne reprennent pas au retour.
 *   7. **Le volume agit sur ce qui sort**, pas seulement dans le stockage :
 *      mi-course sonne à −12 dB, zéro tait la sortie en moins de 100 ms.
 *   8. **Le chant tombe sur le geste** (lot 6) : `chantDuGeste` chante les
 *      quatre gestes de rythme du serveur et eux seuls, aux instants de la
 *      grille que `geste.js` dessine — une seule source : la grille déplacée
 *      déplace le chant, et sans grille rien ne chante ; pour chacun des
 *      quatre, avec la même origine que le pavé, chaque coup s'entend à sa
 *      place, latence de sortie comprise, et avec la pulsation dessinée ;
 *      le crescendo part après le temps d'avance de sa grille, un intervalle
 *      après l'origine (compté depuis la configuration servie) ; l'écho
 *      garde son motif entier ; un chant demandé en retard tait ses temps
 *      passés.
 *   9. **La rumeur suit le match** (lot 6) : l'entrée monte le temps du
 *      compte, la mi-temps retombe et s'entend, la minute double survit à
 *      l'ovation qui l'ouvre et au chant qui la traverse, la fin vide la
 *      tribune sans se relancer, le vestiaire prend la mesure de ses places ;
 *      le calme et l'absence de geste n'y changent rien de ce qu'ils
 *      tenaient.
 *  10. **À côté du son, la scène d'un Fanzzy tient sa célébration** (lot 6,
 *      même périmètre `fx`, aucune autre suite pour elle) : une pose tenue
 *      ne cède pas au fond qu'un rendu redemande pendant son décodage, et
 *      celle qui ne paraît pas rend la main au fond.
 *
 * Un serveur statique sur un port libre et un Chrome sans interface :
 * aucune base, aucun verrou. Les départs de sons se comptent en espionnant
 * `AudioScheduledSourceNode.prototype.start` dans la page — ce qui part
 * vraiment, pas ce que le moteur croit avoir fait.
 *
 * **Ce qui joue, pas ce que le moteur en dit.** `TBF_SON.etat()` dit ce que
 * le moteur croit : `eteindreLit` met `joue` à 0 avant le fondu, si bien
 * qu'une rumeur qui ne baissait jamais et ne se démontait jamais passait
 * pour éteinte, et un curseur de volume qui ne changeait rien à la sortie
 * restait vert. L'espion regarde donc aussi le graphe lui-même : la rumeur
 * se voit à ses **sources sans fin** (un oscillateur ou une boucle lancés
 * sans arrêt prévu — elle seule en a), le volume au **gain du dernier nœud
 * avant les haut-parleurs**, et le silence à une **écoute** (AnalyserNode)
 * branchée sur ce nœud.
 *
 * Avant de lancer (puppeteer est en devDependencies) : npm install
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirBanc, mesurerTout, juger, RETOMBEE_MIN, RAFALE, RAFALE_MS, NAISSANCE_ECART } from './son-banc.mjs';
import { GESTES, resoudreGeste } from '../src/server/ferveur/gestures.js';
import { ACTIONS } from '../src/shared/duel/actions.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = path.join(RACINE, 'public');

let failures = 0;
const check = (l, c, ...preuves) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`);
  if (!c) {
    failures++;
    for (const p of preuves) if (p !== undefined) console.log(`        ${typeof p === 'string' ? p : JSON.stringify(p)}`);
  }
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/* La page qui charge son.js elle-même ET fx.js : le moteur ne doit pas
   être chargé deux fois. */
const PAGE_DOUBLE = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
  + '<title>double</title><script src="/son.js"></script></head><body>'
  + '<button id="geste" style="width:240px;height:120px">GESTE</button>'
  + '<script src="/fx.js" defer></script></body></html>';

/* La page du kiosque réduite à ce qui fait son son : le dessin des Fanzzy
   (cartes.js le déstructure à son chargement), cartes.js, puis fx.js en
   différé comme partout — donc le moteur par le chargeur de fx.js. Sans
   elle, la suite n'appelait jamais TBF_CARTES.audio, celle que le kiosque
   et la collection appellent : cartes.js aurait pu reprendre son propre
   contexte sans que rien ne rougisse. */
const PAGE_CARTES = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
  + '<title>cartes</title></head><body>'
  + '<button id="geste" style="width:240px;height:120px">GESTE</button>'
  + '<script src="/fanzzy-art.js"></script><script src="/cartes.js"></script>'
  + '<script src="/fx.js" defer></script></body></html>';

/* La page du geste (lot 6) : le pavé de geste.js et le moteur, comme dans
   les deux arènes et la salle de répétition. C'est elle qui dit si le chant
   d'un geste tombe sur la pulsation que le pavé dessine. */
const PAGE_GESTE = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
  + '<title>geste</title></head><body>'
  + '<button id="geste" style="width:240px;height:120px">GESTE</button><div id="zone"></div>'
  + '<script src="/geste.js"></script><script src="/fx.js" defer></script></body></html>';

/* La scène d'un Fanzzy seule (`fanzzy-scene.js`, lot 6) : aucun son, voir
   « la scène tient sa célébration ». */
const PAGE_SCENE = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
  + '<title>scene</title></head><body><div id="hote" style="width:200px;height:300px"></div>'
  + '<script src="/fanzzy-scene.js"></script></body></html>';

/* Sans moteur, rien d'autre ne se mesure : la panne est un contrôle rouge
   qui dit sa cause, pas une exception qui coupe la suite. */
const banc = await ouvrirBanc({
  routes: (app) => {
    app.get('/__son-double', (_q, s) => s.type('html').send(PAGE_DOUBLE));
    app.get('/__son-cartes', (_q, s) => s.type('html').send(PAGE_CARTES));
    app.get('/__son-geste', (_q, s) => s.type('html').send(PAGE_GESTE));
    app.get('/__son-scene', (_q, s) => s.type('html').send(PAGE_SCENE));
  },
}).catch((e) => {
  check('fx.js charge le moteur (son.js) dans une page qui n’a que lui', false, e.message);
  return null;
});

/* L'espion : posé avant tout script de la page. Il compte les contextes
   vivants créés, les sources qui démarrent, les nœuds créés et les
   branchements aux haut-parleurs hors des rendus hors ligne (ceux du banc
   ne comptent pas). Il tient aussi les sources sans fin, et branche une
   écoute sur le nœud qui va aux haut-parleurs (voir l'en-tête : ce qui
   joue, pas ce que le moteur en dit). `sansAudio` retire toutes les
   interfaces audio, comme un navigateur qui n'en a pas. */
function espion({ sansAudio = false } = {}) {
  window.__son = { contextes: 0, departs: 0, noeuds: 0, destinations: 0 };
  window.__sonSansFin = new Set();
  /* Les sources du contexte vivant qui sonnent encore, quelles qu'elles
     soient : ajoutées à leur départ, retirées à leur fin (« ended »). Une
     source mise en pause au milieu par un contexte suspendu y reste, et
     reprendrait au retour ; une source arrêtée en sort. */
  window.__sonVivantes = new Set();
  window.__sonSortie = null;
  window.__sonEcoute = null;
  /* L'instant où chaque source du contexte vivant **s'entendra**, en temps
     de la page (performance.now()) : son départ sur l'horloge audio,
     ramené par l'horodatage de sortie que le navigateur tient au moment du
     départ — le même que son.js emploie pour caler un chant (lot 6). Sans
     horodatage, rien : les contrôles qui le lisent rougissent. */
  window.__sonQuand = [];
  /* Les cibles posées sur les paramètres audio (« setTargetAtTime ») : la
     valeur visée et la constante de temps. C'est l'instruction que le
     graphe exécute, pas ce que le moteur en raconte : une entrée qui monte
     au pas du compte, une fin qui se vide au sien, se lisent là, sans la
     respiration de la rumeur qui brouille l'écoute. Les rendus hors ligne
     n'en posent pas (ils posent leurs niveaux d'un coup). */
  window.__sonCibles = [];
  window.__sonTampons = [];
  if (sansAudio) {
    for (const nom of ['AudioContext', 'webkitAudioContext', 'OfflineAudioContext',
      'webkitOfflineAudioContext']) {
      try { delete window[nom]; } catch { /* rien */ }
      window[nom] = undefined;
    }
    return;
  }
  const hors = (c) => typeof OfflineAudioContext === 'function' && c instanceof OfflineAudioContext;
  const cibler = AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime = function setTargetAtTime(v, t, tc) {
    if (window.__sonCibles.length < 4000) window.__sonCibles.push({ v, tc });
    return cibler.call(this, v, t, tc);
  };
  const C = window.AudioContext;
  window.AudioContext = class extends C {
    constructor(...a) { super(...a); window.__son.contextes += 1; }
  };
  /* Les deux « start » : celui des oscillateurs (hérité) et celui des
     sources de tampon, qui déclarent le leur (décalage, durée). N'envelopper
     que le premier comptait la moitié des départs — les bruits et les claps
     passaient dessous.
     Une source **sans fin** est un oscillateur, ou une boucle de tampon
     lancée sans durée, qui n'a reçu aucun arrêt : elle joue tant que
     personne ne l'arrête. Tous les sons de la banque prévoient leur fin au
     départ (un arrêt daté, ou une durée) ; seule la rumeur de la tribune
     n'en a pas — ses deux boucles de bruit et ses deux respirations. Le
     nombre de sources sans fin dit donc si la rumeur est montée, sans rien
     savoir de son graphe : zéro, elle est démontée pour de bon. */
  const sansFin = window.__sonSansFin;
  for (const P of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
    if (!Object.prototype.hasOwnProperty.call(P, 'start')) continue;
    const depart = P.start;
    P.start = function start(...a) {
      if (!hors(this.context)) {
        window.__son.departs += 1;
        try {
          const ts = this.context.getOutputTimestamp?.();
          const q = Number(a[0]) || 0;
          window.__sonQuand.push(ts && ts.performanceTime > 0
            ? Math.round((ts.performanceTime + (q - ts.contextTime) * 1000) * 10) / 10 : null);
        } catch { window.__sonQuand.push(null); }
        /* Les tampons qui partent (la tribune enregistrée, 6 octobre 2026) :
           une boucle dit ses bornes, un son entier sa durée. */
        if (this instanceof AudioBufferSourceNode && this.buffer && window.__sonTampons.length < 400) {
          window.__sonTampons.push({ boucle: this.loop, debut: this.loopStart, fin: this.loopEnd,
            duree: this.buffer.duration, depart: a[1] ?? 0 });
        }
        const vivantes = window.__sonVivantes;
        vivantes.add(this);
        this.addEventListener('ended', () => vivantes.delete(this));
        const sansDuree = this instanceof OscillatorNode
          || (this instanceof AudioBufferSourceNode && this.loop && a[2] === undefined);
        if (sansDuree) {
          sansFin.add(this);
          this.addEventListener('ended', () => sansFin.delete(this));
        }
      }
      return depart.apply(this, a);
    };
  }
  /* Un arrêt, même daté, donne une fin. Compté à l'appel, pas à l'événement
     « ended » : un contexte suspendu juste après (l'onglet caché, le calme)
     ne le livrerait qu'au retour. */
  for (const P of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
    if (!Object.prototype.hasOwnProperty.call(P, 'stop')) continue;
    const arret = P.stop;
    P.stop = function stop(...a) {
      sansFin.delete(this);
      return arret.apply(this, a);
    };
  }
  for (const m of ['createOscillator', 'createBufferSource', 'createGain', 'createBiquadFilter']) {
    const f = BaseAudioContext.prototype[m];
    BaseAudioContext.prototype[m] = function cree(...a) {
      if (!hors(this)) window.__son.noeuds += 1;
      return f.apply(this, a);
    };
  }
  /* Le nœud qui va aux haut-parleurs : celui-là porte le volume du joueur
     (le dernier gain de la chaîne), et on l'écoute. L'écoute est un
     analyseur sans sortie : Chrome le fait tourner quand même, et il ne
     change rien à ce qu'on entend. Elle ne passe pas par les quatre
     créations comptées plus haut : la mesure des nœuds n'en bouge pas. Un
     second branchement aux haut-parleurs serait un son qui contourne le
     limiteur, le volume et le calme — on les compte. */
  const relier = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function connect(dest, ...r) {
    const rendu = relier.call(this, dest, ...r);
    if (!hors(this.context) && dest === this.context.destination) {
      window.__son.destinations += 1;
      window.__sonSortie = this;
      try {
        const ecoute = this.context.createAnalyser();
        ecoute.fftSize = 8192;
        relier.call(this, ecoute);
        window.__sonEcoute = ecoute;
      } catch { /* sans écoute, les contrôles qui la lisent rougissent */ }
    }
    return rendu;
  };
}

async function nouvellePage(chemin = '/__son', options = {}) {
  const page = await banc.nav.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.evaluateOnNewDocument(espion, options);
  await page.goto(banc.base + chemin, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.TBF_SON && window.FX), { timeout: 10000 });
  return { page, erreurs };
}
/* Ce que fait le Virage à l'entrée par un lien (/virage?match=…) : un clic
   de script sur la carte du match, au chargement — puis ce qu'une page fait
   ensuite sans que le joueur ait touché : une fête de niveau, un but reçu,
   un chant, la tribune. Joué dans la page, avant tout geste. */
function clicDeScript() {
  const quandPret = () => {
    const S = window.TBF_SON;
    if (!S || !window.FX) { setTimeout(quandPret, 20); return; }
    document.getElementById('geste').click();   // « isTrusted » : faux
    const r = {
      activation: navigator.userActivation ? navigator.userActivation.hasBeenActive : null,
      apresClic: S.etat(),
      joue: [S.jouer('niveau'), S.jouer('but'), S.audio.ready() !== null],
    };
    S.ambiance(3);
    r.chant = S.chant('tempo', { temps: 2 }).joue;
    r.etat = S.etat();
    r.son = { ...window.__son };
    // La liaison brute ne prend qu'une chaîne (voir « pageSansGeste »).
    window.__sonPret(JSON.stringify(r));
  };
  addEventListener('load', quandPret);
}
/* Rien que les touches qui arrivent, et le moteur prêt. */
function touchesSeulement() {
  window.__touches = [];
  addEventListener('keydown', (e) => window.__touches.push(`${e.key}:${e.isTrusted}`), true);
  const quandPret = () => {
    if (!window.TBF_SON || !window.FX) { setTimeout(quandPret, 20); return; }
    window.__sonPret(JSON.stringify(true));
  };
  addEventListener('load', quandPret);
}
/**
 * Une page qui n'est passée par aucune évaluation : l'espion, puis `script`,
 * posés avant tout ; la page dit « prête » (avec ce qu'elle a relevé, en
 * JSON) par une liaison brute du protocole (« Runtime.addBinding »), qui
 * porte une chaîne de la page au banc et rien en sens inverse.
 *
 * **Pas « page.exposeFunction ».** Puppeteer rend à la page la réponse de
 * sa fonction exposée par une évaluation marquée geste du joueur
 * (« userGesture ») : la page recevait une activation passagère, cinq
 * secondes sous Chrome, au moment même où elle se disait prête. Échap,
 * tapé juste après, arrivait donc pendant une activation que le navigateur
 * tenait pour vraie, et le moteur ouvrait le contexte — comme il le doit :
 * le contrôle rougissait sur le banc, pas sur le moteur. La liaison brute
 * ne livre ses appels qu'à une session où Runtime est actif ; la même
 * session sert à lire la page sans l'activer (voir « lireSansGeste »).
 */
async function pageSansGeste(script) {
  const page = await banc.nav.newPage();
  const erreurs = [], consoles = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => consoles.push(m.text()));
  const cdp = await page.createCDPSession();
  let dire;
  const dit = new Promise((r) => { dire = r; });
  cdp.on('Runtime.bindingCalled', (e) => {
    if (e.name !== '__sonPret') return;
    // Illisible, c'est « pas prête » : les contrôles qui lisent r rougissent.
    try { dire(JSON.parse(e.payload)); } catch { dire(null); }
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Runtime.addBinding', { name: '__sonPret' });
  await page.evaluateOnNewDocument(espion, {});
  await page.evaluateOnNewDocument(script);
  await page.goto(`${banc.base}/__son`, { waitUntil: 'load' });
  const r = await Promise.race([dit, attendre(10000).then(() => null)]);
  return { page, cdp, erreurs, consoles, r };
}
/**
 * Lit la page sans l'activer. « page.evaluate » (et « waitForFunction »)
 * évaluent marqués geste du joueur, et la page est active le temps de la
 * lecture et cinq secondes après ; « Runtime.evaluate » sans cette marque,
 * par la session de « pageSansGeste », ne change rien. `fn` est jouée dans
 * la page : elle ne capture rien d'ici.
 */
async function lireSansGeste(cdp, fn) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate',
    { expression: `(${fn})()`, returnByValue: true });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  }
  return result.value;
}
/* Ce que le navigateur tient pour l'activation de la page, et ce que le
   moteur en a fait — lu sans geste. */
const activation = (cdp) => lireSansGeste(cdp, () => ({
  actif: navigator.userActivation.isActive,
  deja: navigator.userActivation.hasBeenActive,
  touches: window.__touches ?? [],
  geste: window.TBF_SON.etat().geste,
  contexte: window.TBF_SON.etat().contexte,
  contextes: window.__son.contextes,
}));
const compte = (page) => page.evaluate(() => ({ ...window.__son, sansFin: window.__sonSansFin.size,
  vivantes: window.__sonVivantes.size }));
const etat = (page) => page.evaluate(() => window.TBF_SON.etat());
/** Attend qu'une condition sur l'état du moteur (ou sur `lire`) soit vraie, ou renonce. */
async function jusqua(page, fn, ms = 2000, lire = etat) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn(await lire(page))) return true;
    await attendre(40);
  }
  return false;
}
/* Ce qui sort, d'après l'écoute branchée sur le dernier nœud : la valeur
   efficace et la crête des 8 192 derniers échantillons (170 ms à 48 kHz),
   en dBFS ; −200 pour un silence numérique. Rien quand aucune chaîne n'est
   née. */
const ecoute = (page) => page.evaluate(() => {
  const an = window.__sonEcoute;
  if (!an) return null;
  const x = new Float32Array(an.fftSize);
  an.getFloatTimeDomainData(x);
  let s = 0, c = 0;
  for (const v of x) { s += v * v; c = Math.max(c, Math.abs(v)); }
  const db = (a) => (a > 0 ? Math.max(-200, Math.round(200 * Math.log10(a)) / 10) : -200);
  return { rms: db(Math.sqrt(s / x.length)), crete: db(c) };
});
/* Le gain de sortie, cent millisecondes d'horloge audio après avoir réglé
   le volume (ou sans rien régler, `v` absent). L'horloge du rendu, pas
   celle des minuteries : c'est elle qui fait avancer la rampe, et une
   machine chargée retarde les minuteries, pas la rampe. Rien quand aucune
   chaîne n'est née. */
const sortie = (page, v) => page.evaluate(async (v) => {
  const noeud = window.__sonSortie;
  if (!noeud) return null;
  const c = noeud.context;
  const t0 = c.currentTime;
  if (v !== undefined) window.TBF_SON.volume(v);
  const limite = performance.now() + 2000;
  while (c.currentTime < t0 + 0.1 && performance.now() < limite) {
    await new Promise((r) => setTimeout(r, 5));
  }
  return { gain: noeud.gain.value, volume: window.TBF_SON.volume(),
    ecoule: Math.round((c.currentTime - t0) * 1000) };
}, v);
/* Cache ou montre l'onglet : la propriété est posée sur le document lui-même,
   devant celle du prototype, et l'événement est celui du navigateur. */
const cacher = (page, oui) => page.evaluate((o) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => o });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (o ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}, oui);

if (banc) try {
  /* ===================================================== 1. les noms appelés */

  console.log('\n  les noms que les pages appellent');
  const mix = await banc.page.evaluate(() => window.TBF_SON.mixage());
  const facade = await banc.page.evaluate(() => Object.keys(window.TBF_SON.audio));
  const chants = await banc.page.evaluate(() => window.TBF_SON.chants());
  const rumeurs = await banc.page.evaluate(() => window.TBF_SON.rumeurs?.() ?? []);
  const chantes = await banc.page.evaluate(() => window.TBF_SON.gestesChantes?.() ?? []);
  const banque = new Set(Object.keys(mix.sons));

  /* Un appel se reconnaît à sa forme : un littéral seul, un littéral suivi
     d'options, ou un choix « condition ? 'a' : 'b' ». Une parenthèse de prose
     (« le son (l'objet…) ») n'a jamais cette forme : les noms de la banque
     n'ont ni espace ni apostrophe. */
  const ARGS = /^\s*(?:[^'"()]*\?\s*)?(['"])([\w-]+)\1(?:\s*:\s*(['"])([\w-]+)\3)?\s*(?:,[^()]*)?$/;
  const APPELS_SON = /(?:\bson|\bjouerSon|TBF_SON\s*(?:\?\.|\.)\s*jouer)\s*(?:\?\.)?\s*\(([^()]*)\)/g;
  const APPELS_FACADE = /\baudio\s*(?:\?\.|\.)\s*(\w+)\s*(?:\?\.)?\s*\(/g;
  const APPELS_CHANT = /TBF_SON\s*(?:\?\.|\.)\s*chant\s*(?:\?\.)?\s*\(\s*(['"])([\w-]+)\1/g;
  const APPELS_AMBIANCE = /TBF_SON\s*(?:\?\.|\.)\s*ambiance\s*(?:\?\.)?\s*\(\s*(-?[\d.]+)/g;
  /* La rumeur du match et le chant d'un geste (lot 6) : un moment de la
     rumeur, un geste écrit en toutes lettres. Un nom que le moteur ne
     connaît pas se tait sans rien dire — c'est exactement la panne que ce
     relevé attrape. Un geste passé par une variable (le cas ordinaire) ne
     se relève pas ici : le moteur le vérifie lui-même plus bas. */
  const APPELS_RUMEUR = /TBF_SON\s*(?:\?\.|\.)\s*rumeur\s*(?:\?\.)?\s*\(\s*(['"])([\w-]+)\1/g;
  const APPELS_GESTE = /TBF_SON\s*(?:\?\.|\.)\s*chantDuGeste\s*(?:\?\.)?\s*\(\s*(['"])([\w-]+)\1/g;
  const inconnus = [], facadeInconnue = [], chantsInconnus = [], niveauxFaux = [];
  const rumeursInconnues = [], gestesInconnus = [];
  const vus = new Set();
  for (const nom of readdirSync(PUBLIC).filter((f) => /\.(html|js)$/.test(f)).sort()) {
    const src = readFileSync(path.join(PUBLIC, nom), 'utf8');
    for (const m of src.matchAll(APPELS_SON)) {
      const a = ARGS.exec(m[1]);
      if (!a) continue;
      for (const n of [a[2], a[4]].filter(Boolean)) {
        vus.add(n);
        if (!banque.has(n)) inconnus.push(`${nom} : « ${n} »`);
      }
    }
    if (nom !== 'son.js') {
      for (const m of src.matchAll(APPELS_FACADE)) {
        if (!facade.includes(m[1])) facadeInconnue.push(`${nom} : audio.${m[1]}`);
      }
    } else {
      /* Le moteur s'appelle lui-même : la façade de cartes.js, l'ovation du
         but. Un son renommé dans la banque et pas là se tairait. */
      for (const m of src.matchAll(/\bjouer\s*\(\s*(['"])([\w-]+)\1/g)) {
        vus.add(m[2]);
        if (!banque.has(m[2])) inconnus.push(`${nom} : « ${m[2]} »`);
      }
    }
    for (const m of src.matchAll(APPELS_CHANT)) if (!chants.includes(m[2])) chantsInconnus.push(`${nom} : « ${m[2]} »`);
    for (const m of src.matchAll(APPELS_AMBIANCE)) {
      const v = Number(m[1]);
      if (!(Number.isInteger(v) && v >= 0 && v <= 3)) niveauxFaux.push(`${nom} : ambiance(${m[1]})`);
    }
    for (const m of src.matchAll(APPELS_RUMEUR)) {
      if (!rumeurs.includes(m[2])) rumeursInconnues.push(`${nom} : rumeur(« ${m[2]} »)`);
    }
    for (const m of src.matchAll(APPELS_GESTE)) {
      if (!chantes.includes(m[2])) gestesInconnus.push(`${nom} : chantDuGeste(« ${m[2]} »)`);
    }
  }
  check(`chaque son appelé existe dans la banque (${vus.size} noms relevés)`, inconnus.length === 0,
    ...inconnus);
  check('dont les deux qui sonnaient dans le vide : « gong » et « ok »',
    vus.has('gong') && vus.has('ok') && banque.has('gong') && banque.has('ok'));
  check('la relève est vivante : elle trouve les appels de fx.js, du duel et de la fête',
    ['but', 'bache', 'rugissement', 'carillon', 'parfait', 'niveau'].every((n) => vus.has(n)),
    [...vus].sort().join(', '));
  check('chaque méthode de la façade audio appelée existe (ready, rip, flip, chime, roar)',
    facadeInconnue.length === 0 && ['ready', 'rip', 'flip', 'chime', 'roar'].every((m) => facade.includes(m)),
    ...facadeInconnue);
  check('chaque chant appelé existe', chantsInconnus.length === 0, ...chantsInconnus);
  check('chaque niveau d’ambiance écrit est un entier de 0 à 3', niveauxFaux.length === 0, ...niveauxFaux);
  /* Les huit moments que le brief du lot 6 nomme (l'entrée, la mi-temps, la
     minute double, le but, la fin, le vestiaire et ses arrivées), et le jeu
     qui lève la mi-temps : un moment retiré du moteur serait une page qui se
     tait sans le savoir. */
  check('la rumeur connaît les moments du match (entree, jeu, mi-temps, double, but, fin, vestiaire, arrivee)',
    ['entree', 'jeu', 'mi-temps', 'double', 'but', 'fin', 'vestiaire', 'arrivee']
      .every((m) => rumeurs.includes(m)), rumeurs);
  check('chaque moment de la rumeur appelé existe', rumeursInconnues.length === 0, ...rumeursInconnues);
  check('chaque geste chanté écrit en toutes lettres a son chant', gestesInconnus.length === 0, ...gestesInconnus);

  /* ============================================ 2. un seul moteur, au geste */

  console.log('\n  le chargement et le premier geste');
  {
    const { page, erreurs } = await nouvellePage();
    const balises = await page.evaluate(() => document.querySelectorAll('script[src="/son.js"]').length);
    check('fx.js charge le moteur, sans balise dans la page', balises === 1);
    // Avant tout geste : on demande tout, rien ne doit naître.
    await page.evaluate(() => {
      window.FX.son('but');
      window.TBF_SON.ambiance(1);
      window.TBF_SON.chant('tempo');
      window.TBF_SON.audio.rip(1);
      window.TBF_SON.audio.ready();
    });
    let c = await compte(page);
    let e = await etat(page);
    check('avant le premier geste, aucun contexte audio n’est créé', c.contextes === 0 && e.contexte === 'absent', c, e);
    check('mais l’ambiance demandée est retenue pour le premier geste', e.ambiance.voulu === 1, e.ambiance);

    await page.click('#geste');
    const vivant = await jusqua(page, (x) => x.contexte === 'running');
    c = await compte(page);
    check('au premier geste, un contexte naît et joue', vivant && c.contextes === 1, await etat(page));
    check('et l’ambiance attendue démarre avec lui (ses sources sans fin sont lancées)',
      (await etat(page)).ambiance.joue === 1 && c.sansFin > 0, c);

    const d0 = (await compte(page)).departs;
    await page.evaluate(() => window.FX.son('carte'));
    check('FX.son passe par le moteur (une source part)', (await compte(page)).departs === d0 + 1);
    const d1 = (await compte(page)).departs;
    await page.evaluate(() => { window.FX.son('tic'); window.FX.son('tic'); });
    check('le même son demandé deux fois d’un coup ne part qu’une fois', (await compte(page)).departs === d1 + 1);
    const dR = (await compte(page)).departs;
    await page.evaluate(() => { window.TBF_SON.audio.rip(0.5); window.TBF_SON.audio.rip(1.4); });
    check('mais deux déchirures d’intensités différentes partent toutes deux (la finale n’est pas avalée)',
      (await compte(page)).departs === dR + 2);
    const d2 = (await compte(page)).departs;
    await page.evaluate(() => {
      const A = window.TBF_SON.audio;
      A.flip(); A.rip(1); A.chime('epique'); A.chime('legendaire'); A.roar();
    });
    c = await compte(page);
    /* La façade du moteur, appelée directement. Celle de cartes.js — que le
       kiosque et la collection appellent — a sa propre page, plus bas. */
    check('la façade du moteur (TBF_SON.audio) sonne', c.departs > d2, c);
    const d3 = c.departs;
    await page.evaluate(() => window.FX.reveler('legendaire', null));
    await attendre(300);
    c = await compte(page);
    check('la cérémonie FX.reveler sonne par le moteur (rugissement, puis le clac du tampon)',
      c.departs >= d3 + 5, { avant: d3, apres: c.departs });
    check('et tout cela dans un seul contexte', c.contextes === 1, c);
    check('par un seul nœud branché aux haut-parleurs : rien ne contourne limiteur, volume et calme',
      c.destinations === 1, c);
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await page.close();
  }
  {
    /* La façade de cartes.js, dans une page qui la charge comme le kiosque.
       Avant le moteur, cartes.js avait son propre contexte, branché droit
       sur la sortie : il ne doit pas revenir. */
    const { page, erreurs } = await nouvellePage('/__son-cartes');
    const chargee = await page.evaluate(() => typeof window.TBF_CARTES?.audio?.rip === 'function');
    check('cartes.js se charge à côté du moteur, avec sa façade audio', chargee, ...erreurs);
    if (chargee) {
      const pret = await page.evaluate(() => window.TBF_CARTES.audio.ready());
      let c = await compte(page);
      check('cartes.js : avant le premier geste, audio.ready() ne crée aucun contexte',
        pret === null && c.contextes === 0, { pret, ...c });
      await page.click('#geste');
      await jusqua(page, (x) => x.contexte === 'running');
      const memeContexte = await page.evaluate(() => {
        const a = window.TBF_CARTES.audio.ready();
        return Boolean(a) && a === window.TBF_SON.ouvrir();
      });
      check('au geste, audio.ready() de cartes.js rend le contexte du moteur, pas un second',
        memeContexte);
      const sonne = async (fn) => {
        const a = (await compte(page)).departs;
        await page.evaluate(fn);
        return (await compte(page)).departs - a;
      };
      /* Les deux déchirures du kiosque : celle du glissé et la finale, à
         quelques millisecondes. Si la façade perdait l'intensité en chemin,
         les deux arriveraient au moteur à 1, copies exactes, et
         l'anti-doublon avalerait la seconde. On compare à une déchirure
         seule plutôt qu'à un nombre de sources écrit en dur. */
      const une = await sonne(() => window.TBF_CARTES.audio.rip(0.22));
      const deux = await sonne(() => { window.TBF_CARTES.audio.rip(0.5); window.TBF_CARTES.audio.rip(1.4); });
      check('cartes.js : rip(0.5) puis rip(1.4) partent tous les deux (l’intensité traverse la façade)',
        une > 0 && deux === 2 * une, { une, deux });
      const d = {
        flip: await sonne(() => window.TBF_CARTES.audio.flip()),
        epique: await sonne(() => window.TBF_CARTES.audio.chime('epique')),
        legendaire: await sonne(() => window.TBF_CARTES.audio.chime('legendaire')),
        roar: await sonne(() => window.TBF_CARTES.audio.roar()),
      };
      check('cartes.js : flip, chime(epique), chime(legendaire) et roar sonnent',
        Object.values(d).every((n) => n > 0), d);
      c = await compte(page);
      check('et tout cela dans le seul contexte du moteur, par la seule sortie de sa chaîne',
        c.contextes === 1 && c.destinations === 1, c);
    }
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await page.close();
  }
  {
    /* Aucun autre contexte dans le jeu. La suite ne charge pas toutes les
       pages : un fichier de public/ qui recréerait le sien sonnerait à côté
       du limiteur, du volume et du calme. Les deux formes qu'on a connues :
       cartes.js d'avant le moteur, « new (window.AudioContext ||
       window.webkitAudioContext)() », et fx.js d'avant, qui le gardait sous
       un autre nom (« const C = window.AudioContext ?? … », puis
       « new C() »). Hors de son.js, on ne peut qu'en tester l'existence
       (« typeof », comme le tiroir pour son curseur de volume). Le rendu
       hors ligne (OfflineAudioContext) ne joue rien : il n'est pas visé. */
    const CONSTRUIT = /\bnew\s+\(?\s*(?:window\.)?(?:webkit)?AudioContext\b/;
    const NOMME = /\b(?:webkit)?AudioContext\b/;
    const ailleurs = [];
    for (const nom of readdirSync(PUBLIC).filter((f) => /\.(html|js)$/.test(f) && f !== 'son.js').sort()) {
      readFileSync(path.join(PUBLIC, nom), 'utf8').split('\n').forEach((ligne, i) => {
        const l = ligne.trim();
        // Une ligne de commentaire en parle, elle ne construit rien.
        if (/^(?:\/\/|\/?\*)/.test(l)) return;
        if (CONSTRUIT.test(l)) ailleurs.push(`${nom}:${i + 1} construit un AudioContext`);
        else if (NOMME.test(l) && !/\btypeof\b/.test(l)) ailleurs.push(`${nom}:${i + 1} garde AudioContext sous un autre nom`);
      });
    }
    check('aucun fichier de public/ hors de son.js ne crée (ni ne garde de quoi créer) un AudioContext',
      ailleurs.length === 0, ...ailleurs);
  }
  {
    const { page, erreurs } = await nouvellePage('/__son-double');
    const balises = await page.evaluate(() => document.querySelectorAll('script[src="/son.js"]').length);
    check('une page qui pose déjà sa balise ne charge pas le moteur deux fois', balises === 1 && erreurs.length === 0,
      { balises, erreurs });
    await page.close();
  }

  /* ------------------------------------------ un geste, c'est le joueur

     Ces deux pages ne passent par aucune évaluation avant leur lecture
     finale : puppeteer accorde une activation à chaque « page.evaluate »
     (et à « waitForFunction »), qui ferait passer n'importe quoi pour un
     geste. La page attend le moteur elle-même et le dit par une liaison
     brute, qui n'active rien — la fonction exposée de puppeteer, elle,
     active la page en lui répondant (voir « pageSansGeste »). */
  {
    const { page, erreurs, consoles, r } = await pageSansGeste(clicDeScript);
    check('la page a cliqué d’elle-même au chargement, sans aucune activation du joueur',
      r !== null && r.activation !== true, r);
    if (r) {
      check('un clic lancé par script ne compte pas pour le premier geste : aucun contexte',
        r.apresClic.geste === false && r.etat.contexte === 'absent' && r.son.contextes === 0, r);
      check('ce que la page demande ensuite (fête, corne, chant) ne prétend pas partir',
        r.joue.every((x) => x === false) && r.chant === false && r.son.departs === 0, r);
    }
    const refus = consoles.filter((t) => /AudioContext/i.test(t));
    check('aucun « AudioContext was not allowed to start » en console', refus.length === 0, ...refus);
    await page.click('#geste');
    const vivant = await jusqua(page, (x) => x.contexte === 'running');
    const c = await compte(page);
    check('au premier vrai toucher, le contexte naît et tourne', vivant && c.contextes === 1, c);
    /* Rien n'était posé nulle part : ce qui démarre est la rumeur demandée
       (retenue pour le geste, par sa règle) — rien que des sources sans
       fin —, et pas la fanfare, la corne et l'ovation d'avant, qui partaient
       toutes d'un coup sur un contexte né du clic de script. */
    check('et rien de ce qui avait été demandé avant ne part d’un coup : seule la rumeur attendue démarre',
      c.departs === c.sansFin, c);
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await page.close();
  }
  {
    /* Le moteur n'ouvre le contexte que pendant une activation que le
       navigateur tient ; Échap n'en donne pas. Le contrôle ne prouve donc
       quelque chose que si la page n'est pas déjà active quand la touche
       arrive, et si le navigateur ne l'a pas comptée : les deux se lisent,
       sans geste, plutôt que de se supposer. Une page active avant la
       touche ouvrirait le contexte à bon droit — ce serait le banc qu'il
       faudrait corriger, pas le moteur. */
    const { page, cdp, erreurs, r } = await pageSansGeste(touchesSeulement);
    const avant = r === true ? await activation(cdp) : null;
    check('avant Échap, la page n’a reçu aucune activation (dire « prête » n’en donne aucune)',
      avant !== null && avant.actif === false && avant.deja === false, { r, avant });
    if (avant?.actif === false) {
      await page.keyboard.press('Escape');
      await attendre(150);
      const lu = await activation(cdp);
      check('la touche Échap arrive à la page comme le joueur la tape, et le navigateur ne la compte pas pour une activation',
        lu.touches.includes('Escape:true') && lu.actif === false, lu);
      check('Échap n’ouvre aucun contexte',
        lu.geste === false && lu.contextes === 0 && lu.contexte === 'absent', lu);
      /* Le témoin, sur la même page : une touche que le navigateur compte
         ouvre le contexte. Le silence d'Échap vient de la règle, pas d'une
         page qui n'écoute rien. Le contexte qui tourne suffit à le dire (le
         moteur n'ouvre que pendant une activation) : l'activation elle-même,
         passagère, peut être retombée quand une machine chargée la relit. */
      await page.keyboard.press('a');
      const ouvert = await jusqua(page, (x) => x.contexte === 'running', 2000, () => activation(cdp));
      const apres = await activation(cdp);
      check('témoin : une lettre tapée, elle, compte pour un geste et ouvre le contexte',
        ouvert && apres.geste === true && apres.contextes === 1, apres);
    }
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await page.close();
  }

  /* ========================================================= 3. l'ambiance */

  console.log('\n  l’ambiance');
  {
    const { page, erreurs } = await nouvellePage();
    await page.click('#geste');
    await jusqua(page, (x) => x.contexte === 'running');
    await page.evaluate(() => window.TBF_SON.ambiance(1));
    check('ambiance(1) : la rumeur joue (ses sources sans fin sont lancées)',
      (await etat(page)).ambiance.joue === 1 && (await compte(page)).sansFin > 0, await compte(page));
    /* Au niveau 1, le premier éclat de voix vient au plus tôt quatre secondes
       et demie après le départ : en une seconde et demie, une ambiance qui
       ne recrée rien ne crée aucun nœud. */
    /* L'enregistrée relaie la synthèse dès qu'elle est décodée (voir « la
       tribune enregistrée ») : ce relais crée ses nœuds, une fois. On
       l'attend, puis plus rien ne doit naître. */
    await jusqua(page, (x) => x.ambiance.source === 'enregistree', 4000);
    const n0 = (await compte(page)).noeuds;
    await attendre(1500);
    const n1 = (await compte(page)).noeuds;
    check('elle ne recrée aucun nœud tant que rien ne change', n1 === n0, { avant: n0, apres: n1 });
    await page.evaluate(() => window.TBF_SON.ambiance(2, { pendant: 400 }));
    check('une poussée passagère monte à 2', (await etat(page)).ambiance.joue === 2);
    const retombee = await jusqua(page, (x) => x.ambiance.joue === 1 && x.ambiance.voulu === 1, 1500);
    check('et retombe seule au niveau posé', retombee, await etat(page));
    const d0 = (await compte(page)).departs;
    await page.evaluate(() => window.TBF_SON.ambiance(3));
    let e = await etat(page);
    check('le but : la tribune au maximum', e.ambiance.joue === 3, e.ambiance);
    check('et l’ovation part', (await compte(page)).departs > d0);
    await page.evaluate(() => window.TBF_SON.ambiance(2, { pendant: 5000 }));
    check('une poussée pendant l’ovation ne la coupe pas', (await etat(page)).ambiance.joue === 3);
    await page.evaluate(() => window.TBF_SON.ambiance(0));
    e = await etat(page);
    /* Ce que le moteur veut, seulement : l'ovation lancée par le but joue
       encore ici. Que la rumeur baisse puis se démonte vraiment se mesure
       sur une page à elle, plus bas (« le fondu, puis le démontage »). */
    check('ambiance(0) : le moteur ne veut plus de tribune, but compris',
      e.ambiance.voulu === 0 && e.ambiance.joue === 0, e.ambiance);

    /* ---------------------------------------------------- l'onglet caché */
    await page.evaluate(() => {
      window.TBF_SON.ambiance(2);
      window.__chant = window.TBF_SON.chant('marche', { tempo: 300, temps: Infinity });
    });
    let c = await compte(page);
    check('avant de cacher : la rumeur et un chant ouvert jouent',
      (await etat(page)).ambiance.joue === 2 && (await etat(page)).chant === true && c.sansFin > 0, c);
    await cacher(page, true);
    e = await etat(page);
    c = await compte(page);
    check('onglet caché : la rumeur s’arrête, et ses sources avec elle',
      e.ambiance.joue === 0 && c.sansFin === 0, e.ambiance, c);
    check('onglet caché : le chant s’arrête', e.chant === false);
    check('onglet caché : le contexte est suspendu', await jusqua(page, (x) => x.contexte === 'suspended'),
      await etat(page));
    const d1 = (await compte(page)).departs;
    await page.evaluate(() => window.FX.son('but'));
    check('onglet caché : un son demandé ne part pas', (await compte(page)).departs === d1);
    /* La page change de niveau pendant l'absence (le match continue, et ses
       événements arrivent) : rien ne doit se construire tant que personne
       n'écoute — ni nœud, ni source. Le contrôle d'avant ne demandait
       l'ambiance qu'onglet visible. */
    const avantDemande = await compte(page);
    await page.evaluate(() => window.TBF_SON.ambiance(1));
    const apresDemande = await compte(page);
    check('onglet caché : l’ambiance demandée ne construit rien (aucun nœud, aucune source)',
      apresDemande.noeuds === avantDemande.noeuds && apresDemande.departs === avantDemande.departs
        && apresDemande.sansFin === 0, { avant: avantDemande, apres: apresDemande });
    await cacher(page, false);
    check('au retour, le contexte reprend', await jusqua(page, (x) => x.contexte === 'running'), await etat(page));
    e = await etat(page);
    c = await compte(page);
    check('et la rumeur revient, au niveau demandé pendant l’absence', e.ambiance.joue === 1 && c.sansFin > 0,
      e.ambiance, c);
    // L'onglet caché ferme la sortie : un retour qui l'oublierait laisserait le jeu muet.
    const g = await sortie(page);
    check('et la sortie se rouvre au volume du joueur', g !== null && Math.abs(g.gain - g.volume ** 2) < 0.01, g);
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await page.close();
  }

  /* ------------------------------------------ le fondu, puis le démontage */
  {
    /* Une page à elle : l'ovation d'un but passé, qui retombe seule, ferait
       croire à un fondu qui n'existe pas. */
    const { page, erreurs } = await nouvellePage();
    await page.click('#geste');
    await jusqua(page, (x) => x.contexte === 'running');
    await page.evaluate(() => window.TBF_SON.ambiance(1));
    /* Une seconde et demie : la rumeur est montée (deux constantes de temps
       et demie), et au niveau 1 le premier éclat de voix ne vient pas avant
       quatre secondes et demie — la mesure ne prend que la rumeur, et
       ambiance(0) arrive avant le premier cri. */
    await attendre(1500);
    const avant = await ecoute(page);
    let c = await compte(page);
    check('la rumeur sort vraiment des haut-parleurs (l’écoute la mesure)',
      avant !== null && avant.rms > -60 && c.sansFin > 0, avant, c);
    const t0 = Date.now();
    await page.evaluate(() => window.TBF_SON.ambiance(0));
    await attendre(500);
    const debut = await ecoute(page);
    c = await compte(page);
    check('ambiance(0) l’éteint en fondu, pas d’un coup : une demi-seconde après, elle s’entend encore',
      debut !== null && debut.rms > -60 && c.sansFin > 0, debut, c);
    /* Trois secondes, près de deux constantes de la descente (1,6 s) : le
       fondu y a retiré dix-sept à dix-neuf décibels (mesuré, le 3 octobre
       2026). Une rumeur laissée à son niveau n'y varie que de trois, au gré
       de sa respiration : dix décibels séparent les deux sans hésiter. */
    await attendre(Math.max(0, 3000 - (Date.now() - t0)));
    const fondu = await ecoute(page);
    check('ses gains baissent vraiment : trois secondes après, dix décibels de moins au moins',
      avant !== null && fondu !== null && fondu.rms <= avant.rms - 10, { avant, apres3s: fondu });
    /* Le démontage vient à cinq constantes de temps (8 s) : on lui en laisse
       dix, puis le temps que l'écoute (170 ms) n'ait plus que l'après. */
    const demontee = await jusqua(page, (x) => x.sansFin === 0, Math.max(0, 10000 - (Date.now() - t0)), compte);
    await attendre(300);
    const silence = await ecoute(page);
    check('puis elle se démonte : plus une source sans fin, et rien ne sort plus',
      demontee && silence !== null && silence.crete <= -120,
      { secondes: (Date.now() - t0) / 1000, ...(await compte(page)), silence });
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await page.close();
  }

  /* --------------------------------- les sons en cours, onglet caché */
  {
    /* Une ovation (5,1 s), l'onglet caché une demi-seconde plus tard, puis
       montré. Suspendue au milieu sans être arrêtée, elle reprenait au
       retour là où elle en était — mesuré par le relecteur : vivante 300 ms
       après le retour, finie cinq secondes et demie plus tard, sur un écran
       passé à autre chose. Une page sans rumeur : seule l'ovation y vit. */
    const { page, erreurs } = await nouvellePage();
    await page.click('#geste');
    await jusqua(page, (x) => x.contexte === 'running');
    await page.evaluate(() => window.TBF_SON.jouer('ovation'));
    await attendre(400);
    const avant = await compte(page);
    check('une ovation sonne avant qu’on cache l’onglet', avant.vivantes > 0, avant);
    await cacher(page, true);
    const cache = await etat(page);
    check('onglet caché : les sons en cours sont arrêtés, pas mis en pause', cache.enCours === 0, cache);
    await attendre(300);
    await cacher(page, false);
    await jusqua(page, (x) => x.contexte === 'running');
    /* Arrêtées, toutes les sources finissent dès la reprise (ses cris
       compris, posés jusqu'à 1,9 s après le but) ; l'ovation mise en pause,
       elle, vivrait encore cinq secondes. */
    const finies = await jusqua(page, (x) => x.vivantes === 0, 2500, compte);
    check('au retour, rien ne reprend : plus une source vivante', finies, await compte(page));
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await page.close();
  }

  /* ============================================================ 4. le calme */

  console.log('\n  le calme');
  {
    const { page, erreurs } = await nouvellePage();
    await page.click('#geste');
    await jusqua(page, (x) => x.contexte === 'running');
    await page.evaluate(() => {
      window.TBF_SON.ambiance(2);
      window.TBF_SON.chant('marche', { tempo: 300, temps: Infinity });
    });
    await page.evaluate(() => window.FX.sonCoupe(true));
    await attendre(60);
    let e = await etat(page);
    let c = await compte(page);
    check('le calme arrête la rumeur, et ses sources avec elle', e.ambiance.joue === 0 && c.sansFin === 0,
      e.ambiance, c);
    check('le calme arrête le chant', e.chant === false);
    check('le calme suspend le contexte : ce qui jouait se tait',
      await jusqua(page, (x) => x.contexte === 'suspended'), await etat(page));
    const d0 = (await compte(page)).departs;
    const poignee = await page.evaluate(() => {
      window.FX.son('but');
      window.TBF_SON.jouer('ovation');
      window.TBF_SON.ambiance(3);
      window.TBF_SON.audio.rip(1.4);
      window.TBF_SON.audio.roar();
      return window.TBF_SON.chant('tempo').joue;
    });
    await attendre(300);
    check('sous le calme, aucun son, aucun chant, aucune ovation ne part',
      (await compte(page)).departs === d0 && poignee === false, { avant: d0, apres: (await compte(page)).departs });
    await page.evaluate(() => window.FX.sonCoupe(false));
    check('le calme levé, le contexte reprend', await jusqua(page, (x) => x.contexte === 'running'));
    e = await etat(page);
    c = await compte(page);
    check('et la rumeur revient (le but demandé pendant le calme compris)', e.ambiance.joue >= 2 && c.sansFin > 0,
      e.ambiance, c);
    // Le calme ferme la sortie : un réveil qui l'oublierait laisserait le jeu muet.
    const g = await sortie(page);
    check('et la sortie se rouvre au volume du joueur', g !== null && Math.abs(g.gain - g.volume ** 2) < 0.01, g);
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await page.close();
  }
  {
    const { page } = await nouvellePage();
    await page.evaluate(() => window.FX.sonCoupe(true));
    await page.click('#geste');
    await page.evaluate(() => { window.FX.son('but'); window.TBF_SON.ambiance(1); });
    const c = await compte(page);
    check('calmé dès l’arrivée : même au geste, le contexte n’est pas créé', c.contextes === 0, c);
    await page.evaluate(() => window.FX.sonCoupe(false));
    await page.close();
  }
  {
    /* Le calme posé pendant une ovation, puis levé : elle ne reprend pas au
       réveil. Une page sans rumeur : seule l'ovation y vit. */
    const { page, erreurs } = await nouvellePage();
    await page.click('#geste');
    await jusqua(page, (x) => x.contexte === 'running');
    await page.evaluate(() => window.TBF_SON.jouer('ovation'));
    await attendre(300);
    const avant = await compte(page);
    await page.evaluate(() => window.FX.sonCoupe(true));
    await attendre(60);
    const calme = await etat(page);
    await page.evaluate(() => window.FX.sonCoupe(false));
    await jusqua(page, (x) => x.contexte === 'running');
    const finies = await jusqua(page, (x) => x.vivantes === 0, 2500, compte);
    check('le calme arrête les sons en cours : l’ovation ne reprend pas au réveil',
      avant.vivantes > 0 && calme.enCours === 0 && finies, { avant, calme: calme.enCours, apres: await compte(page) });
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await page.evaluate(() => window.FX.sonCoupe(false));
    await page.close();
  }

  /* =========================================================== 5. les chants */

  console.log('\n  les chants');
  {
    const { page, erreurs } = await nouvellePage();
    await page.click('#geste');
    await jusqua(page, (x) => x.contexte === 'running');
    const duree = await page.evaluate(() => window.TBF_SON.chant('tempo', { tempo: 560, temps: 8 }).duree);
    check('un chant dit sa durée : huit temps de 560 ms', Math.abs(duree - 4480) < 1, duree);
    await page.evaluate(() => window.TBF_SON.arreterChant());
    /* Quatre temps de « tempo » : à chaque temps, un tambour (trois sources :
       la peau, le choc, l'harmonique) et un clap (une source). Seize départs,
       ni plus ni moins : aucune frappe perdue, aucune doublée. */
    const d0 = (await compte(page)).departs;
    await page.evaluate(() => window.TBF_SON.chant('tempo', { tempo: 200, temps: 4 }));
    check('le chant joue', (await etat(page)).chant === true);
    const fini = await jusqua(page, (x) => x.chant === false, 3000);
    const d1 = (await compte(page)).departs;
    check('il frappe chaque temps une fois, puis rend la place', fini && d1 - d0 === 16, { departs: d1 - d0, fini });
    const d2 = (await compte(page)).departs;
    await page.evaluate(() => { window.__c = window.TBF_SON.chant('marche', { tempo: 200, temps: Infinity }); });
    await attendre(500);
    await page.evaluate(() => window.__c.arreter());
    const d3 = (await compte(page)).departs;
    await attendre(600);
    const d4 = (await compte(page)).departs;
    check('un chant ouvert joue jusqu’à arreter(), puis plus une frappe', d3 > d2 && d4 === d3, { d2, d3, d4 });
    const vide = await page.evaluate(() => window.TBF_SON.chant('hymne-du-club'));
    check('un chant inconnu ne joue rien et ne lève pas', vide.joue === false && erreurs.length === 0, vide, ...erreurs);
    await page.close();
  }

  /* ========================================= 5 bis. le chant calé sur le geste

     Lot 6 : les deux arènes chantent sur la pulsation que le serveur sert,
     comme la salle de répétition. Ce qui se vérifie : le passage du geste au
     chant (`chantDuGeste`, écrit une fois), et que les frappes **s'entendent**
     sur la grille du geste — `origine + debut + k × tempo`, latence de sortie
     comprise — et sur la pulsation que `geste.js` dessine. L'instant où une
     frappe s'entend est lu par l'espion (`__sonQuand`) : le départ sur
     l'horloge audio, ramené par l'horodatage de sortie du navigateur. */

  console.log('\n  le chant calé sur le geste (lot 6)');
  {
    const servis = resoudreGeste({}, { motif: 1 });
    const { page, erreurs } = await nouvellePage('/__son-geste');
    await page.click('#geste');
    await jusqua(page, (x) => x.contexte === 'running');
    const chantes = await page.evaluate(() => window.TBF_SON.gestesChantes());
    check('les gestes chantés sont des gestes du serveur (tempo, contretemps, echo, crescendo)',
      chantes.length === 4 && chantes.every((g) => GESTES.includes(g))
        && ['tempo', 'contretemps', 'echo', 'crescendo'].every((g) => chantes.includes(g)), chantes);
    /* Sur la configuration que le serveur sert, geste par geste : les quatre
       chantent, et aucun des vingt autres. */
    const parGeste = await page.evaluate((gestes, liste) => liste.map((g) => {
      const p = window.TBF_SON.chantDuGeste(g, gestes);
      p.arreter();
      return [g, p.joue, p.duree];
    }), servis, GESTES);
    const faux = parGeste.filter(([g, joue]) => joue !== chantes.includes(g));
    check(`sur les gestes servis, seuls les gestes de rythme chantent (${GESTES.length} gestes)`,
      faux.length === 0, faux);
    /* La durée : celle des pulsations que geste.js bat — le tempo, ses
       `beats` temps et un intervalle d'avance ; le contretemps, un temps de
       plus que ses frappes. */
    const duree = Object.fromEntries(parGeste.map(([g, , d]) => [g, d]));
    const t = servis.tempo, ct = servis.contretemps;
    check('le chant du tempo dure ses temps et un intervalle d’avance',
      Math.abs(duree.tempo - (t.beats + 1) * t.interval) < 1, { duree: duree.tempo, tempo: t });
    check('celui du contretemps compte un temps de plus que ses frappes',
      Math.abs(duree.contretemps - (ct.beats + 2) * ct.interval) < 1, { duree: duree.contretemps, contretemps: ct });
    const sansConfig = await page.evaluate(() => [
      window.TBF_SON.chantDuGeste('tempo', {}).joue,
      window.TBF_SON.chantDuGeste('tempo', { tempo: { interval: 'vite' } }).joue,
      window.TBF_SON.chantDuGeste('echo', { echo: { instants: [] } }).joue,
      window.TBF_SON.chantDuGeste('constructor', { constructor: {} }).joue]);
    check('sans durées servies, rien ne chante (pas de tempo inventé)', sansConfig.every((x) => x === false),
      sansConfig);

    /* **Une seule source pour la pulsation** : les instants du chant sont
       ceux de la grille que `geste.js` dessine (`TBF_GESTE.grille`), et non
       une table recopiée dans le moteur. Les gestes chantés sont donc
       exactement ceux qui ont une grille ; et une grille déplacée déplace le
       chant — sans grille, rien ne chante, même sur des durées lisibles. */
    const frappe = await page.evaluate(() => [...(window.TBF_GESTE?.FRAPPE ?? [])]);
    check('les gestes chantés sont ceux qui ont une grille dans geste.js (FRAPPE)',
      frappe.length > 0 && [...chantes].sort().join() === [...frappe].sort().join(), { chantes, frappe });
    const suit = await page.evaluate(async () => {
      const G = window.TBF_GESTE;
      const vraie = G.grille;
      const gestes = { tempo: { interval: 300, beats: 3, window: 200 } };
      try {
        // La grille décalée de 37 ms, le temps d'un chant.
        G.grille = (g, c) => {
          const gr = vraie(g, c);
          return gr && { ...gr, pulsations: gr.pulsations.map((t) => t + 37) };
        };
        window.__sonQuand.length = 0;
        const origine = performance.now();
        const p = window.TBF_SON.chantDuGeste('tempo', gestes, { origine });
        await new Promise((r) => setTimeout(r, 1400));
        p.arreter();
        G.grille = () => null;
        const sans = window.TBF_SON.chantDuGeste('tempo', gestes);
        sans.arreter();
        return { origine, quand: window.__sonQuand.slice(), joue: p.joue, sansGrille: sans.joue };
      } finally { G.grille = vraie; }
    });
    const tempsSuivis = [];
    for (const q of suit.quand.filter((x) => x !== null).map((x) => x - suit.origine).sort((a, b) => a - b)) {
      if (!tempsSuivis.length || q - tempsSuivis[tempsSuivis.length - 1] > 5) tempsSuivis.push(q);
    }
    const ecartsSuivis = tempsSuivis.map((q, k) => Math.round(q - (300 * (k + 1) + 37)));
    check('le chant suit la grille de geste.js : décalée de 37 ms, il frappe décalé de 37 ms (à 5 ms près)',
      suit.joue && tempsSuivis.length === 3 && ecartsSuivis.every((e) => Math.abs(e) <= 5),
      { temps: tempsSuivis.map(Math.round), ecarts: ecartsSuivis });
    check('et sans grille, rien ne chante', suit.sansGrille === false, suit);

    /* **Le calage, geste par geste.** Les quatre gestes de rythme, chant et
       pavé ouverts au même instant et avec **la même origine**, comme les
       arènes et la salle de répétition le font (`jouer(…, { zone, origine })`) :
       chaque frappe doit s'entendre à son instant de la grille, latence de
       sortie comprise, et la pulsation dessinée tomber avec elle.

       Le tempo bat à 300 ms, sous les 420 ms qui ferment sa fenêtre après le
       dernier temps : `geste.js` battait autrefois par une minuterie répétée,
       qui dessinait une pulsation de trop sous cet intervalle, et ce contrôle
       s'en tenait à 480 ms. Il pose maintenant ses pulsations sur sa grille,
       autant que de temps servis. Le contretemps, l'écho et le crescendo
       prennent les durées du serveur. L'écho frappe à l'instant zéro, déjà
       passé d'une latence quand le chant part : son motif glisse d'un bloc
       (moins de 150 ms, la marge du moteur), et garde ses écarts. Le
       crescendo ne le fait plus : sa grille lui donne un temps d'avance, et
       son premier temps tombe un intervalle après l'origine (contrôlé à
       part, depuis la configuration servie).

       Le contexte est né au clic, quelques centaines de millisecondes plus
       tôt : son horodatage de sortie se corrige encore, et c'est ce cas que
       le calage doit tenir. */
    const CAS = [
      ['tempo', { tempo: { interval: 300, beats: 4, window: 200 } }],
      ['contretemps', { contretemps: servis.contretemps }],
      ['crescendo', { crescendo: servis.crescendo }],
      ['echo', { echo: servis.echo }],
    ];
    for (const [g, gestes] of CAS) {
      const cale = await page.evaluate(async (g, gestes) => {
        const zone = document.getElementById('zone');
        const vus = [];
        /* Une pulsation, c'est la classe « beat » retirée puis remise dans la
           même tâche (geste.js, « battre ») : deux mutations, une seule
           pulsation — la première compte, l'autre tombe dans la même
           milliseconde. */
        const veille = new MutationObserver((ms) => {
          const t = performance.now();
          for (const m of ms) {
            if (m.target.id === 'ring' && m.target.classList.contains('beat')
              && !/\bbeat\b/.test(m.oldValue ?? '') && !(vus.length && t - vus[vus.length - 1] < 50)) vus.push(t);
          }
        });
        veille.observe(zone, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
        window.__sonQuand.length = 0;
        const origine = performance.now();
        const p = window.TBF_SON.chantDuGeste(g, gestes, { origine });
        const grille = window.TBF_GESTE.grille(g, gestes);
        /* Le bruitage d'ouverture de l'épreuve (6 octobre 2026) part dans
           l'appel même, avant tout temps : il est mis à part — ce n'est pas
           une frappe du chant —, et jugé plus bas. */
        const avant = window.__sonQuand.length;
        const fin = window.TBF_GESTE.jouer(g, gestes, { zone, origine });
        const ouverture = window.__sonQuand.splice(avant, window.__sonQuand.length - avant);
        await fin;
        p.arreter();
        veille.disconnect();
        return { origine, quand: window.__sonQuand.slice(), vus, joue: p.joue, ouverture,
          pulsations: grille?.pulsations ?? null };
      }, g, gestes);
      const pulsations = cale.pulsations ?? [];
      const ouvre = cale.ouverture.filter((x) => x !== null).map((x) => x - cale.origine);
      check(`${g} : le bruitage d’ouverture part avec l’épreuve, avant son premier temps`,
        ouvre.length > 0 && pulsations.length > 0 && Math.max(...ouvre) < pulsations[0] - 100,
        { ouverture: ouvre.map(Math.round), premierTemps: pulsations[0] });
      /* Ce qui doit s'entendre : un coup par pulsation ; au contretemps,
         les claps entre deux, une demi-mesure après chaque coup. */
      const pas = Number(gestes[g]?.interval);
      const attendus = pulsations.flatMap((p) => (g === 'contretemps' ? [p, p + pas / 2] : [p]));
      // Les frappes, regroupées par instant : un coup de tambour et ses claps partent ensemble.
      const temps = [];
      for (const q of cale.quand.filter((x) => x !== null).map((x) => x - cale.origine).sort((a, b) => a - b)) {
        if (!temps.length || q - temps[temps.length - 1] > 5) temps.push(q);
      }
      const ecarts = temps.map((q, k) => Math.round(q - (attendus[k] ?? NaN)));
      /* Sur la grille : à 5 ms près. Un motif qui part à l'instant zéro
         glisse d'un bloc — un seul décalage pour toutes ses frappes, à 5 ms
         près, et sous la marge de 150 ms. */
      const glisse = pulsations[0] === 0;
      const surLaGrille = glisse
        ? ecarts.every((e) => e >= -5 && e <= 150) && Math.max(...ecarts) - Math.min(...ecarts) <= 5
        : ecarts.every((e) => Math.abs(e) <= 5);
      check(`${g} : avec son origine, le chant frappe ses ${attendus.length} coups ${glisse
        ? 'd’un seul bloc, à la latence près' : 'sur la grille du geste (à 5 ms près)'}`,
      cale.joue && pulsations.length > 0 && temps.length === attendus.length && surLaGrille,
      { attendus: attendus.map(Math.round), temps: temps.map(Math.round), ecarts });
      /* Et avec le pavé : chaque pulsation dessinée tombe avec le coup du
         chant à sa place (les claps du contretemps n'ont pas de pulsation).
         Un motif qui glisse s'entend en bloc derrière son dessin — de la
         latence de sortie et d'un souffle, une cinquantaine de
         millisecondes sur ce Chrome — : on y tient le même écart pour tous
         les coups, à 40 ms près, sous la marge de 150 ms. */
      const vus = cale.vus.map((v) => v - cale.origine);
      const coups = pulsations.map((p) => temps[attendus.indexOf(p)]);
      const avecPave = vus.map((v, k) => Math.round((coups[k] ?? NaN) - v));
      const ensemble = glisse
        ? Math.max(...avecPave) - Math.min(...avecPave) <= 40 && avecPave.every((e) => e >= -40 && e <= 150)
        : avecPave.every((e) => Math.abs(e) <= 40);
      check(`${g} : et chaque coup s’entend avec la pulsation que geste.js dessine (${pulsations.length}, ${glisse
        ? 'un même retard pour tous, à 40 ms près' : 'à 40 ms près'})`,
      vus.length === pulsations.length && ensemble,
      { pave: vus.map(Math.round), chant: coups.map((x) => Math.round(x)), ecarts: avecPave });
      /* **Le temps d'avance du crescendo** (`geste.js`, sa grille) : son
         premier temps tombe un intervalle après l'origine — le premier du
         crescendo, `instants[1] − instants[0]` de la configuration servie,
         700 ms —, et non à l'instant zéro. Les deux contrôles d'au-dessus
         comparent le chant à la grille : une grille qui perdrait ce temps
         d'avance, avec le chant qui la suit, y resterait verte (un motif à
         zéro « glisse »). Celui-ci compte depuis le serveur : la première
         frappe entendue et la première pulsation dessinée, toutes deux à
         cet instant. Un chant qui partirait sans le décalage battrait
         700 ms avant le pavé, et le joueur qui suit le son taperait à
         côté. */
      if (g === 'crescendo') {
        const ins = (gestes.crescendo?.instants ?? []).map(Number);
        const avance = ins.length > 1 ? ins[1] - ins[0] : 0;
        check(`crescendo : la première frappe s’entend sur la première pulsation dessinée, un intervalle (${
          avance} ms) après l’origine — à 5 ms près pour le chant, 40 ms pour le pavé`,
        avance > 0 && Math.abs((temps[0] ?? NaN) - avance) <= 5 && Math.abs((vus[0] ?? NaN) - avance) <= 40,
        { avance, chant: temps.length ? Math.round(temps[0]) : null, pave: vus.length ? Math.round(vus[0]) : null });
      }
    }

    /* L'écho frappe à l'instant zéro, déjà passé d'une latence de sortie
       quand le chant part : le motif glisse en entier, rien ne se perd et
       ses écarts restent les siens. */
    const echo = await page.evaluate(async () => {
      window.__sonQuand.length = 0;
      const origine = performance.now();
      const p = window.TBF_SON.chantDuGeste('echo', { echo: { instants: [0, 200, 500] } }, { origine });
      await new Promise((r) => setTimeout(r, 900));
      p.arreter();
      return { origine, quand: window.__sonQuand.slice() };
    });
    const frappesEcho = [];
    for (const q of echo.quand.filter((x) => x !== null).sort((a, b) => a - b)) {
      if (!frappesEcho.length || q - frappesEcho[frappesEcho.length - 1] > 5) frappesEcho.push(q);
    }
    const intervalles = frappesEcho.slice(1).map((q, k) => Math.round(q - frappesEcho[k]));
    check('l’écho, qui frappe à l’instant zéro, garde ses trois frappes et ses écarts (200, 300 ms)',
      frappesEcho.length === 3 && Math.abs(intervalles[0] - 200) <= 3 && Math.abs(intervalles[1] - 300) <= 3,
      { frappes: frappesEcho.map((q) => Math.round(q - echo.origine)), intervalles });

    /* Un chant demandé bien après son origine : les temps passés se taisent,
       les suivants tombent sur la grille. Six temps de 200 ms partis il y a
       650 ms : quatre sont passés, deux s'entendent — huit sources. */
    const tard = await page.evaluate(async () => {
      window.__sonQuand.length = 0;
      const origine = performance.now() - 650;
      const p = window.TBF_SON.chant('tempo', { tempo: 200, temps: 6, origine });
      await new Promise((r) => setTimeout(r, 700));
      p.arreter();
      return { origine, quand: window.__sonQuand.slice() };
    });
    const tardifs = tard.quand.filter((x) => x !== null).map((q) => Math.round(q - tard.origine));
    check('demandé 650 ms après son origine, il tait les temps passés et frappe les deux suivants sur la grille',
      tardifs.length === 8 && tardifs.every((q) => Math.abs(q - 800) <= 5 || Math.abs(q - 1000) <= 5),
      { sources: tardifs.length, instants: [...new Set(tardifs)] });
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await page.close();
  }

  /* ========================================= 5 ter. la rumeur suit le match

     Lot 6 : `TBF_SON.rumeur(moment)`. Les contrôles qui disent « ça
     s'entend » écoutent la sortie (l'écoute de l'espion) ; ceux qui disent
     quel niveau joue lisent l'état du moteur, et la rumeur elle-même par ses
     sources sans fin. */

  console.log('\n  la rumeur suit le match (lot 6)');
  /* La valeur efficace la plus basse sur `n` écoutes espacées : un éclat de
     voix qui passe pendant l'une d'elles ne la fausse pas. */
  const plancher = async (page, n = 6, pas = 110) => {
    let bas = Infinity;
    for (let k = 0; k < n; k++) {
      const e = await ecoute(page);
      if (e) bas = Math.min(bas, e.rms);
      await attendre(pas);
    }
    return Number.isFinite(bas) ? bas : null;
  };
  {
    const { page, erreurs } = await nouvellePage();
    // Avant tout geste : la phase est retenue, rien ne se construit.
    await page.evaluate(() => window.TBF_SON.rumeur('entree', { ms: 3000 }));
    let c = await compte(page);
    let e = await etat(page);
    check('avant le premier geste, l’entrée ne crée rien, mais la phase « jeu » est retenue',
      c.contextes === 0 && e.rumeur?.phase === 'jeu' && e.ambiance.voulu === 1, e, c);
    await page.evaluate(() => window.TBF_SON.ambiance(0));
    await page.click('#geste');
    await jusqua(page, (x) => x.contexte === 'running');
    /* L'entrée : la foule compte trois secondes. Trois cents millisecondes
       après, la rumeur est encore loin de sa pleine mesure — six décibels au
       moins ; une rumeur ordinaire (`ambiance(1)`) y serait déjà à huit
       décibels de la sienne, l'entrée y est à douze. */
    const cibles = await page.evaluate(() => {
      window.__sonCibles.length = 0;
      window.TBF_SON.rumeur('entree', { ms: 3000 });
      return window.__sonCibles.map((x) => x.tc);
    });
    /* Trois constantes de temps pour le compte : une seconde ici. Une
       entrée au pas ordinaire de la rumeur (0,6 s) passerait l'écoute
       ci-dessous — les deux sont loin de leur pleine mesure à 250 ms —,
       pas celui-ci. Les six paramètres de la rumeur la visent. */
    check('l’entrée monte au pas du compte : la rumeur vise son niveau en ms / 3 (1 s pour 3 s de compte)',
      cibles.filter((tc) => Math.abs(tc - 1) < 0.001).length >= 6, cibles);
    await attendre(250);
    const debut = await plancher(page, 2, 40);
    await attendre(3200);
    const plein = await plancher(page);
    check('l’entrée fait monter la rumeur le temps du compte : au début, six décibels sous sa pleine mesure au moins',
      debut !== null && plein !== null && plein - debut >= 6, { debut, plein });

    /* La mi-temps : la rumeur retombe, et tient. Six secondes de creux
       (plus de deux constantes de temps) : huit décibels visés, quatre
       exigés — la respiration de la rumeur va et vient de deux ou trois. */
    await page.evaluate(() => window.TBF_SON.rumeur('mi-temps'));
    e = await etat(page);
    check('la mi-temps garde la tribune (niveau 1) et creuse son échelle',
      e.rumeur?.phase === 'mi-temps' && e.ambiance.voulu === 1 && e.rumeur.echelle < 1, e);
    await attendre(6000);
    const creux = await plancher(page);
    check('la mi-temps s’entend : la rumeur retombe de quatre décibels au moins',
      creux !== null && plein - creux >= 4, { plein, creux });
    // Redite chaque seconde (une page la rappelle à chaque rendu) : rien ne bouge.
    const n0 = (await compte(page)).noeuds;
    await page.evaluate(() => { window.TBF_SON.rumeur('mi-temps'); window.TBF_SON.rumeur('mi-temps'); });
    check('redite, une phase ne recrée rien', (await compte(page)).noeuds === n0);
    await page.evaluate(() => window.TBF_SON.rumeur('jeu'));
    e = await etat(page);
    check('le jeu lève la mi-temps', e.rumeur?.phase === 'jeu' && e.rumeur.echelle === 1, e);

    /* La minute double et le but, ensemble : le but réel joue l'ovation et
       ouvre la minute double au même instant. L'ovation finie, la minute
       double court encore ; un chant pendant la minute double ne l'abrège
       pas. Durées réduites : l'ovation 600 ms, la minute 1,8 s. */
    await page.evaluate(() => {
      window.TBF_SON.ambiance(3, { pendant: 600 });
      window.TBF_SON.rumeur('double', { ms: 1800 });
      window.TBF_SON.ambiance(2, { pendant: 300 });
    });
    check('au but réel, l’ovation (3) passe devant la minute double', (await etat(page)).ambiance.joue === 3);
    await attendre(1000);
    e = await etat(page);
    check('l’ovation finie, la minute double court encore (2), et le chant ne l’a pas abrégée',
      e.ambiance.joue === 2 && e.ambiance.passager === 2, e.ambiance);
    const retombe = await jusqua(page, (x) => x.ambiance.joue === 1 && x.ambiance.passager === 0, 1600);
    check('puis la tribune retombe seule à la rumeur du jeu', retombe, await etat(page));
    const sansDuree = await page.evaluate(() => {
      window.TBF_SON.rumeur('double', { ms: 0 });
      return window.TBF_SON.etat().ambiance.passager;
    });
    check('une minute double déjà finie (surgeMs 0) ne fait rien pousser', sansDuree === 0);

    /* La fin : la tribune se vide, en un fondu qu'une page qui la redit à
       chaque rendu ne relance pas. 1,5 s demandées : démontée vers 2,5 s.
       Redite à 1,5 s, elle repartirait et se démonterait vers 4 s. */
    const { vers0, source } = await page.evaluate(() => {
      window.__sonCibles.length = 0;
      const src = window.TBF_SON.etat().ambiance.source;
      window.TBF_SON.rumeur('fin', { ms: 1500 });
      return { vers0: window.__sonCibles.filter((x) => x.v === 0).map((x) => x.tc), source: src };
    });
    /* Cinq gains vers zéro pour la synthèse (ses couches et sa
       respiration), un pour l'enregistrée (son niveau). */
    check('la fin se vide à son pas : la rumeur vise le silence en ms / 3 (0,5 s pour 1,5 s)',
      vers0.filter((tc) => Math.abs(tc - 0.5) < 0.001).length >= (source === 'enregistree' ? 1 : 5),
      { vers0, source });
    await attendre(400);
    check('à la fin, la tribune se vide en fondu : elle s’entend encore un instant',
      ((await ecoute(page))?.rms ?? -200) > -60 && (await compte(page)).sansFin > 0);
    await attendre(1100);
    await page.evaluate(() => window.TBF_SON.rumeur('fin', { ms: 1500 }));
    await attendre(1700);
    c = await compte(page);
    await attendre(300);
    const vide = await ecoute(page);
    check('puis elle se démonte, et la redire ne relance pas son fondu',
      c.sansFin === 0 && vide !== null && vide.crete <= -120, { ...c, vide });
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await page.close();
  }
  {
    /* Le vestiaire du duel : la rumeur à la mesure des places prises, qui
       enfle à chaque arrivée puis reprend sa nouvelle mesure. Et le calme :
       rien ne se construit, et la phase revient avec lui levé. */
    const { page, erreurs } = await nouvellePage();
    await page.click('#geste');
    await jusqua(page, (x) => x.contexte === 'running');
    await page.evaluate(() => window.TBF_SON.rumeur('vestiaire', { part: 1 / 3 }));
    let e = await etat(page);
    const tiers = e.rumeur?.echelle;
    check('au vestiaire, la rumeur joue à la mesure des places prises (moins que pleine)',
      e.rumeur?.phase === 'vestiaire' && e.ambiance.joue === 1 && tiers > 0 && tiers < 1, e);
    await page.evaluate(() => window.TBF_SON.rumeur('arrivee', { part: 2 / 3 }));
    e = await etat(page);
    check('une arrivée la fait enfler (2) et monter d’un cran',
      e.ambiance.joue === 2 && e.rumeur.echelle > tiers && e.rumeur.echelle < 1, e);
    const repos = await jusqua(page, (x) => x.ambiance.joue === 1, 3500);
    check('puis elle reprend la rumeur, à sa nouvelle mesure', repos && (await etat(page)).rumeur.echelle > tiers);
    await page.evaluate(() => window.FX.sonCoupe(true));
    await attendre(80);
    await page.evaluate(() => { window.TBF_SON.rumeur('entree'); window.TBF_SON.rumeur('mi-temps'); });
    let c = await compte(page);
    check('sous le calme, la rumeur ne construit rien', c.sansFin === 0, c);
    await page.evaluate(() => window.FX.sonCoupe(false));
    await jusqua(page, (x) => x.contexte === 'running');
    e = await etat(page);
    c = await compte(page);
    check('le calme levé, elle revient dans la phase demandée pendant (la mi-temps)',
      e.rumeur?.phase === 'mi-temps' && e.ambiance.joue === 1 && c.sansFin > 0, e, c);
    await page.evaluate(() => window.TBF_SON.ambiance(0));
    e = await etat(page);
    check('ambiance(0) vide la tribune pour de bon : ni phase, ni échelle creusée',
      e.rumeur?.phase === null && e.rumeur.echelle === 1 && e.ambiance.voulu === 0, e);
    const inconnu = await page.evaluate(() => window.TBF_SON.rumeur('hymne'));
    check('un moment inconnu ne fait rien et ne lève pas', inconnu === 0 && erreurs.length === 0, ...erreurs);
    await page.close();
  }

  /* =========================================================== 6. le volume */

  console.log('\n  le volume');
  {
    const { page } = await nouvellePage();
    const r = await page.evaluate(() => {
      let annonce = null;
      window.addEventListener('tbf-volume', (e) => { annonce = e.detail; });
      const v = window.TBF_SON.volume(0.5);
      return { v, annonce, cle: localStorage.getItem('tbf-volume'), lu: window.TBF_SON.volume(),
        borne: window.TBF_SON.volume(3), faux: window.TBF_SON.volume('fort') };
    });
    check('volume(0.5) le règle, le retient et l’annonce',
      r.v === 0.5 && r.annonce === 0.5 && r.cle === '0.5' && r.lu === 0.5, r);
    check('un volume hors bornes est ramené à 1, un volume illisible ignoré', r.borne === 1 && r.faux === 1, r);
    await page.evaluate(() => window.TBF_SON.volume(0.5));
    await page.close();
    const { page: p2, erreurs } = await nouvellePage();
    const relu = await p2.evaluate(() => window.TBF_SON.volume());
    check('il survit au rechargement', relu === 0.5, relu);
    /* Le stockage ne suffit pas : un curseur qui écrit sa clé et ne change
       rien à la sortie restait vert. On lit donc le gain du dernier nœud
       avant les haut-parleurs, et ce qui sort. */
    await p2.click('#geste');
    await jusqua(p2, (x) => x.contexte === 'running');
    const ne = await p2.evaluate(() => window.__sonSortie?.gain.value ?? null);
    check('relu, il vaut dès le premier son : la sortie naît à 0,25 (le curseur au carré, −12 dB)',
      ne !== null && Math.abs(ne - 0.25) < 0.01, ne);
    const plein = await sortie(p2, 1);
    check('volume(1) ouvre la sortie en moins de 100 ms', plein !== null && plein.gain >= 0.99, plein);
    await p2.evaluate(() => window.TBF_SON.ambiance(1));
    await attendre(1200);
    const fort = await ecoute(p2);
    const demi = await sortie(p2, 0.5);
    check('volume(0.5) met la sortie à 0,25 en moins de 100 ms : mi-course sonne à mi-course (−12 dB)',
      demi !== null && Math.abs(demi.gain - 0.25) < 0.01, demi);
    const muet = await sortie(p2, 0);
    check('volume(0) met la sortie à zéro en moins de 100 ms (sous −40 dB)', muet !== null && muet.gain <= 0.01, muet);
    // L'écoute garde 170 ms : qu'elle n'ait plus que l'après.
    await attendre(300);
    const tu = await ecoute(p2);
    const sources = (await compte(p2)).sansFin;
    check('et rien ne sort, alors que la rumeur joue toujours derrière',
      fort !== null && tu !== null && fort.crete > -60 && tu.crete <= fort.crete - 40 && sources > 0,
      { fort, tu, sources });
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await p2.evaluate(() => localStorage.removeItem('tbf-volume'));
    await p2.close();
  }

  /* ================================================== 7. sans AudioContext */

  console.log('\n  sans AudioContext');
  {
    const { page, erreurs } = await nouvellePage('/__son', { sansAudio: true });
    await page.click('#geste');
    const r = await page.evaluate(async () => {
      const S = window.TBF_SON;
      const sortis = S.noms().map((n) => { window.FX.son(n); return S.jouer(n); });
      for (const n of [0, 1, 2, 3]) S.ambiance(n);
      S.ambiance(2, { pendant: 100 });
      const poignees = S.chants().map((t) => S.chant(t, { tempo: 300, temps: 4, instants: [0, 100] }));
      // Lot 6 : le chant d'un geste, calé ou non, et chaque moment de la rumeur.
      const gestes = { tempo: { interval: 300, beats: 4 }, contretemps: { interval: 300, beats: 4 },
        echo: { instants: [0, 100] }, crescendo: { instants: [0, 100] } };
      for (const g of S.gestesChantes()) {
        poignees.push(S.chantDuGeste(g, gestes), S.chantDuGeste(g, gestes, { origine: performance.now() }));
      }
      for (const m of S.rumeurs()) S.rumeur(m, { part: 0.5, ms: 200 });
      poignees.forEach((p) => p.arreter());
      const A = S.audio;
      const pret = A.ready();
      A.rip(1); A.flip(); A.chime('legendaire'); A.roar();
      S.volume(0.8);
      const rendu = await S.rendre({ son: 'but' });
      await window.FX.reveler('epique', document.getElementById('geste'));
      S.volume(1);
      return { joues: sortis.filter(Boolean).length, chants: poignees.filter((p) => p.joue).length,
        pret, rendu, etat: S.etat() };
    });
    check('sans AudioContext, aucun son ne prétend partir', r.joues === 0 && r.chants === 0 && r.pret === null, r);
    check('le rendu hors ligne se refuse proprement', r.rendu === null);
    check('le moteur le dit : pas de contexte', r.etat.contexte === 'absent', r.etat);
    check('et rien ne lève, ni le moteur ni la cérémonie', erreurs.length === 0, ...erreurs);
    await page.close();
  }

  /* ============================================ 7 bis. le premier son d'une visite

     Lot 6. Le contexte naît au premier toucher, et le son de ce toucher part
     dans le même instant, sur une chaîne qui n'a encore rien entendu. Le
     limiteur de Chrome naît fermé : ce son-là sortait treize décibels sous
     les suivants (un tic à −33,1 dBFS de crête contre −20,0, à l'écoute), un
     son qu'on n'entend pas. NAISSANCE (son.js) l'ouvre à temps. L'écoute
     relève la crête de ce qui sort autour du premier tic — joué dans le
     gestionnaire du clic qui fait naître le contexte, comme une page le
     fait —, puis autour d'un second, une demi-seconde plus tard. Deux
     décibels de marge : le premier perd encore un peu de son attaque
     pendant que le détecteur s'ouvre. */

  console.log('\n  le premier son d’une visite (lot 6)');
  {
    const { page, erreurs } = await nouvellePage('/__son');
    await page.evaluate(() => document.getElementById('geste').addEventListener('click',
      () => { window.__premier = window.TBF_SON.jouer('tic'); }, { once: true }));
    /* La crête la plus haute de l'écoute pendant une demi-seconde : la
       fenêtre de l'analyseur (170 ms) glisse sur le tic, une lecture toutes
       les trente millisecondes ne le manque pas. */
    const pic = async () => {
      let c = -200;
      for (let k = 0; k < 16; k++) {
        const e = await ecoute(page);
        if (e) c = Math.max(c, e.crete);
        await attendre(30);
      }
      return c;
    };
    await page.click('#geste');
    const premier = await pic();
    await attendre(500);
    await page.evaluate(() => window.TBF_SON.jouer('tic'));
    const second = await pic();
    const parti = await page.evaluate(() => window.__premier === true);
    check('le premier son d’une visite, joué dans le toucher qui fait naître le contexte, sort comme les suivants (à 2 dB près)',
      parti && second > -60 && Math.abs(premier - second) <= 2, { parti, premier, second });
    check('et rien ne lève', erreurs.length === 0, ...erreurs);
    await page.close();
  }

  /* ===================================================== 8. les niveaux */

  console.log('\n  les niveaux (rendus hors ligne, chaîne complète)');
  {
    const fen = Object.values(mix.familles).map((f) => f.fenetre).sort((a, b) => a[0] - b[0]);
    check('les fenêtres des familles montent sans se chevaucher',
      fen.every((f, i) => f[0] < f[1] && (i === 0 || fen[i - 1][1] < f[0])), fen);
    const tout = await mesurerTout(banc.page);
    const jugees = juger(tout);
    const parSorte = (s) => jugees.filter((j) => j.sorte === s);
    const hors = (s) => parSorte(s).filter((j) => !j.ok).map((j) => `${j.id} : ${j.pourquoi}`);
    check('la chaîne est transparente sous le limiteur et tient au-dessus', hors('chaine').length === 0, ...hors('chaine'));
    check(`chaque son est dans la fenêtre de sa famille (${parSorte('son').length} sons)`,
      hors('son').length === 0, ...hors('son'));
    /* Les variantes sont des sons que le jeu joue (la déchirure à
       l'intensité du doigt, celle de la finale) : elles tiennent la fenêtre
       de leur famille comme le son lui-même. Jugées sur leur seule crête,
       elles passaient à −44,7 LUFS comme à −17,9. Et ce sont bien les
       intensités que le kiosque joue, ses deux bouts compris. */
    const rip = (mix.sons.dechirure?.variantes ?? []).map((o) => o.intensite);
    check('la déchirure est essayée aux intensités que le kiosque joue (0,22 à 0,72, puis 1,4)',
      [0.22, 0.72, 1.4].every((i) => rip.includes(i)), rip);
    check(`chaque variante est dans la fenêtre de sa famille (${parSorte('variante').length} variantes)`,
      hors('variante').length === 0, ...hors('variante'));
    check(`aucun son seul ne dépasse ${mix.creteSeule} dBFS, variantes comprises`,
      [...parSorte('son'), ...parSorte('variante')].every((j) => j.crete <= mix.creteSeule));
    check('la clameur enregistrée est rendue et jugée comme l’ovation qu’elle remplace (un moment)',
      jugees.some((j) => j.id === 'clameur' && j.sorte === 'son' && j.famille === 'moment' && !j.erreur));
    check(`rien ne sature : les superpositions restent sous ${mix.creteMax} dBFS`,
      hors('superposition').length === 0, ...hors('superposition'));
    const tous = parSorte('superposition').find((j) => j.id === 'tous-les-moments');
    const plusFort = Math.max(...parSorte('son').filter((j) => j.famille === 'moment').map((j) => j.crete));
    check('et le limiteur travaille vraiment : dix moments ensemble ne s’additionnent pas',
      tous && tous.crete < plusFort + 6, { ensemble: tous?.crete, plusFortSeul: plusFort });
    /* Le plafond, seul. Rien de ce qui précède ne le fait travailler : sans
       lui, chaque rendu du banc reste sous sa crête. Un sinus à +6 dB ne
       l'éprouve pas non plus — le limiteur de Chrome regarde six
       millisecondes en avance et le tient seul à −5,2 dBFS, plafond ou pas
       (mesuré le 3 octobre 2026, son.js muté à côté du vrai). Il faut un
       signal que le rapport 20:1 ne peut plus ramener : à +120 dB, le
       limiteur seul laisse sortir +1,3 dBFS ; avec le plafond, −0,9. C'est
       sa garantie — quoi qu'on empile dans le maître, rien ne sort
       au-dessus — et c'est elle qu'on éprouve. */
    const exces = await banc.page.evaluate(async () => {
      const b = await window.TBF_SON.rendre({ sinus: 120 }, { duree: 0.5 });
      if (!b) return null;
      let c = 0;
      for (let k = 0; k < b.numberOfChannels; k++) for (const v of b.getChannelData(k)) c = Math.max(c, Math.abs(v));
      return c > 0 ? Math.round(2000 * Math.log10(c)) / 100 : -200;
    });
    /* Et il ressort fort, au-dessus du genou du plafond (−3 dB) : une chaîne
       qui « tiendrait » en se taisant passerait sinon pour un plafond. */
    check(`le plafond tient seul ce que le limiteur ne tient plus : un sinus à +120 dB ressort sous ${mix.creteMax} dBFS`,
      exces !== null && exces <= mix.creteMax && exces > -3, { crete: exces });
    check('l’ambiance est dans ses fenêtres, niveau par niveau', hors('ambiance').length === 0, ...hors('ambiance'));
    /* La rumeur ne couvre jamais l'interface, sauf au but : jugée sur sa
       moyenne de huit secondes seulement, celle du niveau 2 montait sur cent
       millisecondes à −30,3 LUFS, dans la fenêtre du tic. */
    /* Pour chacune des deux rumeurs, la synthétisée et l'enregistrée
       (6 octobre 2026) : l'une remplace l'autre, chacune tient la règle. */
    for (const [quelle, source] of [['synthétisée', undefined], ['enregistrée', 'enregistree']]) {
      const ses = parSorte('ambiance').filter((j) => j.source === source);
      const plafonnes = ses.filter((j) => j.plafond != null);
      check(`la rumeur ${quelle} des niveaux 1 et 2 reste sous l’interface, crêtes comprises (sonie sur 100 ms)`,
        plafonnes.map((j) => j.niveau).join() === '1,2'
          && plafonnes.every((j) => j.plafond < mix.familles.interface.fenetre[0] && j.sonie <= j.plafond),
        plafonnes.map((j) => ({ niveau: j.niveau, sonie: j.sonie, plafond: j.plafond })));
      const amb = ses.map((j) => j.moyen);
      check(`et chaque niveau de la rumeur ${quelle} sonne plus fort que le précédent`,
        amb.length === 3 && amb[0] < amb[1] && amb[1] < amb[2], amb);
    }
    /* Lot 6 : la mi-temps et le vestiaire vide creusent la rumeur. Assez
       pour qu'on l'entende, et sans rien dépasser — une échelle ne fait que
       baisser. */
    check(`la mi-temps et le vestiaire vide sonnent ${RETOMBEE_MIN} dB au moins sous la rumeur pleine`,
      parSorte('echelle').length === 2 && hors('echelle').length === 0,
      ...hors('echelle'), parSorte('echelle').map((j) => ({ id: j.id, moyen: j.moyen })));
    check('les chants sont dans la fenêtre du jeu', hors('chant').length === 0, ...hors('chant'));
    /* Lot 6 : le pavé fait un tic à chaque frappe, jusqu'à dix par seconde
       au martelage, par-dessus le tambour du chant. Chaîne froide, la rafale
       valait le chant (−21,2 LUFS contre −20,4) et le gonflait de 2,6 dB. */
    check(`une rafale de tics à ${1000 / RAFALE_MS} Hz sur le chant « tempo » reste sous ${mix.creteMax} dBFS `
      + `et ne le couvre pas (${RAFALE.sousChant} dB dessous, ${RAFALE.gonfle} dB de plus au plus)`,
      parSorte('rafale').length === 3 && hors('rafale').length === 0,
      ...hors('rafale'), parSorte('rafale').map((j) => ({ id: j.id, crete: j.crete, sonie: j.sonie })));
    /* **La mesure se fait chaîne chaude** (CHAUFFE, dans son.js). Le
       limiteur naît fermé : un son posé au début d'un rendu froid sortait
       huit décibels sous le même son joué une seconde plus tard — sous ce
       que le joueur entend —, et les gains de la banque avaient été tirés
       de là. Le tic au début du rendu et le tic une seconde après doivent
       sortir pareils. */
    const chaud = await banc.page.evaluate(async () => {
      const pic = (b) => {
        let p = 0;
        for (let k = 0; k < b.numberOfChannels; k++) for (const v of b.getChannelData(k)) p = Math.max(p, Math.abs(v));
        return p > 0 ? Math.round(2000 * Math.log10(p)) / 100 : -200;
      };
      const S = window.TBF_SON;
      return {
        debut: pic(await S.rendre({ son: 'tic' }, { duree: 0.6 })),
        apres: pic(await S.rendre({ suite: [{ son: 'tic', a: 1000 }] }, { duree: 1.6 })),
      };
    });
    check('le banc mesure chaîne chaude : un tic au début du rendu sort comme un tic une seconde après',
      Math.abs(chaud.debut - chaud.apres) <= 0.5, chaud);
    /* **Et la chaîne qui vient de naître** (lot 6, NAISSANCE dans son.js) :
       rendue sans chauffe, comme au premier toucher d'une visite, un tic et
       une bâche y sortent comme chaîne chaude ; et tous les moments empilés
       pendant la relâche brève de la naissance ne saturent pas. Sans
       NAISSANCE, le tic y sortait à −27,8 dBFS contre −20,0. */
    check(`à sa naissance, la chaîne laisse passer le premier son comme chaîne chaude (à ${NAISSANCE_ECART} dB près), `
      + `et rien n’y sature (${mix.creteMax} dBFS)`,
    parSorte('naissance').length === 3 && hors('naissance').length === 0,
    ...hors('naissance'), parSorte('naissance').map((j) => ({ id: j.id, crete: j.crete, sonie: j.sonie })));
    /* Reproductible à −100 dB près, pas au bit : Chrome lui-même rend deux
       fois le même graphe avec un écart d'un bit de flottant (1,2e-7, soit
       −138 dB) sur quelques centaines d'échantillons. Un hasard qui fuirait
       — une graine oubliée — ferait des écarts de l'ordre du signal. */
    const ecart = await banc.page.evaluate(async () => {
      const a = await window.TBF_SON.rendre({ son: 'butReel' }, { graine: 7 });
      const b = await window.TBF_SON.rendre({ son: 'butReel' }, { graine: 7 });
      const c = await window.TBF_SON.rendre({ son: 'butReel' }, { graine: 8 });
      const x = a.getChannelData(0), y = b.getChannelData(0), z = c.getChannelData(0);
      let meme = 0, autre = 0;
      for (let i = 0; i < x.length; i++) {
        meme = Math.max(meme, Math.abs(x[i] - y[i]));
        autre = Math.max(autre, Math.abs(x[i] - z[i]));
      }
      return { meme, autre };
    });
    check('un rendu est reproductible : même graine, même son (à −100 dB près)',
      ecart.meme < 1e-5 && ecart.autre > 1e-3, ecart);
  }

  /* ============================================ la tribune enregistrée */

  /* 6 octobre 2026 : la rumeur et la clameur du but viennent de deux
     fichiers (`public/son/`), choisis par Gaël à l'écoute. Ce qu'on tient :
     rien ne se télécharge sous le calme, ni sur une page sans tribune, et
     une seule fois par page malgré l'appel de chaque seconde ; la boucle
     se joue entre ses bornes, jamais le fichier entier ; un fichier qui ne
     se décode pas laisse la synthèse jouer, sans erreur ; le calme arrête
     la source enregistrée ; la clameur part au but une fois décodée. */
  console.log('\n  la tribune enregistrée (6 octobre 2026)');
  {
    const telechargements = (page) => {
      const vus = [];
      page.on('request', (r) => { if (new URL(r.url()).pathname.startsWith('/son/')) vus.push(new URL(r.url()).pathname); });
      return vus;
    };
    {
      const { page, erreurs } = await nouvellePage();
      const vus = telechargements(page);
      await page.click('#geste');
      await jusqua(page, (x) => x.contexte === 'running');
      await page.evaluate(() => window.TBF_SON.jouer('tic'));
      await attendre(500);
      check('une page sans tribune ne télécharge aucun son', vus.length === 0, vus);
      await page.evaluate(() => { for (let i = 0; i < 5; i++) window.TBF_SON.ambiance(1); });
      const passee = await jusqua(page, (x) => x.ambiance.source === 'enregistree', 5000);
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => { window.TBF_SON.ambiance(1); window.TBF_SON.rumeur('jeu'); });
        await attendre(100);
      }
      check('la tribune demandée, la rumeur enregistrée relaie la synthèse', passee, await etat(page));
      check('chaque fichier n’est téléchargé qu’une fois par page, malgré l’appel répété',
        vus.length === 2 && new Set(vus).size === 2, vus);
      const boucles = await page.evaluate(() => window.__sonTampons.filter((x) => x.boucle && x.duree > 10));
      check('la boucle se joue entre ses bornes (0,25 s et 12,25 s), jamais le fichier entier',
        boucles.length >= 1 && boucles.every((b) => Math.abs(b.debut - 0.25) < 0.001
          && Math.abs(b.fin - 12.25) < 0.001 && b.depart >= b.debut && b.depart <= b.fin), boucles);
      // Le relais démonte la synthèse au bout de trois secondes (PASSAGE, dans son.js).
      await attendre(3500);
      let c = await compte(page);
      check('le relais fini, il ne reste que la boucle enregistrée (la synthèse est démontée)', c.sansFin === 1, c);
      check('l’ovation sera la clameur : elle est déjà décodée', (await etat(page)).fichiers.clameur === true,
        (await etat(page)).fichiers);
      await page.evaluate(() => { window.__sonTampons.length = 0; window.TBF_SON.ambiance(3, { pendant: 600 }); });
      const parties = await page.evaluate(() => window.__sonTampons.filter((x) => !x.boucle));
      check('au but, la clameur part (3,75 s), à la place de l’ovation synthétisée',
        parties.some((x) => x.duree > 3.7 && x.duree < 3.8), parties);
      await page.evaluate(() => document.documentElement.setAttribute('data-calme', 'sons'));
      await attendre(100);
      c = await compte(page);
      check('le calme arrête la boucle enregistrée et la clameur', c.sansFin === 0
        && (await etat(page)).ambiance.joue === 0, c);
      await page.evaluate(() => document.documentElement.removeAttribute('data-calme'));
      const revenue = await jusqua(page, (x) => x.ambiance.source === 'enregistree' && x.ambiance.joue === 1, 2000);
      check('le calme levé, l’enregistrée revient tout de suite, sans rien retélécharger', revenue && vus.length === 2,
        { revenue, vus });
      check('aucune erreur de script', erreurs.length === 0, ...erreurs);
      await page.close();
    }
    {
      // Sous le calme : la tribune demandée ne télécharge rien.
      const page = await banc.nav.newPage();
      const erreurs = [];
      page.on('pageerror', (e) => erreurs.push(e.message));
      const vus = telechargements(page);
      await page.evaluateOnNewDocument(espion, {});
      await page.evaluateOnNewDocument(() => {
        document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-calme', 'sons'));
      });
      await page.goto(banc.base + '/__son', { waitUntil: 'load' });
      await page.waitForFunction(() => Boolean(window.TBF_SON && window.FX), { timeout: 10000 });
      await page.evaluate(() => document.documentElement.setAttribute('data-calme', 'sons'));
      await page.click('#geste');
      await page.evaluate(() => { window.TBF_SON.ambiance(1); window.TBF_SON.rumeur('jeu'); });
      await attendre(600);
      check('sous le calme, la tribune demandée ne télécharge rien', vus.length === 0, vus);
      check('aucune erreur de script (calme)', erreurs.length === 0, ...erreurs);
      await page.close();
    }
    {
      // Un fichier qui ne se décode pas : la synthèse joue, sans erreur.
      const page = await banc.nav.newPage();
      const erreurs = [];
      page.on('pageerror', (e) => erreurs.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (r) => (new URL(r.url()).pathname.startsWith('/son/')
        ? r.respond({ status: 200, contentType: 'audio/ogg', body: 'pas du son' }) : r.continue()));
      await page.evaluateOnNewDocument(espion, {});
      await page.goto(banc.base + '/__son', { waitUntil: 'load' });
      await page.waitForFunction(() => Boolean(window.TBF_SON && window.FX), { timeout: 10000 });
      await page.click('#geste');
      await jusqua(page, (x) => x.contexte === 'running');
      await page.evaluate(() => window.TBF_SON.ambiance(1));
      await attendre(1500);
      const e = await etat(page);
      check('un fichier illisible laisse la synthèse jouer', e.ambiance.source === 'synthese' && e.ambiance.joue === 1
        && e.fichiers.rumeur === false && e.fichiers.clameur === false, e);
      check('aucune erreur de script (fichier illisible)', erreurs.length === 0, ...erreurs);
      await page.close();
    }
  }

  /* ===================================== les cartes et les épreuves

     6 octobre 2026, à la demande de Gaël : chaque carte d'action a son
     bruitage, joué quand elle part (`TBF_ACTION.jouee`, des deux côtés), et
     chaque épreuve le sien, joué à son ouverture (`TBF_GESTE.jouer`). Tous
     synthétisés. Leurs niveaux sont jugés plus haut avec la banque ; ici, ce
     qui les relie au jeu : une carte ou un geste de plus sans bruitage, une
     page qui ne l'appelle plus, un bruitage de rythme qui déborderait sur le
     premier temps. */
  console.log('\n  les cartes et les épreuves (6 octobre 2026)');
  {
    const sansCarte = ACTIONS.filter((a) => mix.sons[a.id]?.famille !== 'jeu').map((a) => a.id);
    check(`chaque carte d’action a son bruitage, de la famille du jeu (${ACTIONS.length} cartes)`,
      ACTIONS.length > 0 && sansCarte.length === 0, ...sansCarte);
    const sansEpreuve = GESTES.filter((g) => mix.sons[`epreuve-${g}`]?.famille !== 'jeu');
    check(`chaque épreuve a son bruitage d’ouverture, de la famille du jeu (${GESTES.length} épreuves)`,
      GESTES.length > 0 && sansEpreuve.length === 0, ...sansEpreuve);
    /* Les quatre de rythme : la tribune chante leurs temps, le premier un
       intervalle après l'ouverture — 280 ms au plus court (l'écho). Leur
       bruitage doit s'être tu avant : rendu seul, il retombe sous −60 dBFS
       en moins de 250 ms. */
    const durees = await banc.page.evaluate(async (noms) => {
      const r = {};
      for (const nom of noms) {
        const b = await window.TBF_SON.rendre({ son: nom }, { duree: 0.6 });
        const x = b.getChannelData(0);
        let der = 0;
        for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > 0.001) der = i;
        r[nom] = Math.round((der / b.sampleRate - 0.02) * 1000);
      }
      return r;
    }, ['tempo', 'contretemps', 'echo', 'crescendo'].map((g) => `epreuve-${g}`));
    check('les bruitages des épreuves de rythme se taisent en moins de 250 ms (avant le premier temps)',
      Object.values(durees).every((ms) => ms > 0 && ms < 250), durees);

    const { page, erreurs } = await nouvellePage('/__son-geste');
    await page.addScriptTag({ url: '/action-art.js' });
    await page.click('#geste');
    await jusqua(page, (x) => x.contexte === 'running');
    const joues = (fn, ...args) => page.evaluate(async (fn, args) => {
      const vus = [];
      const S = window.TBF_SON;
      const jouer = S.jouer;
      S.jouer = (nom, o) => { vus.push(nom); return jouer(nom, o); };
      try { await new Function(`return (${fn})`)()(...args); } finally { S.jouer = jouer; }
      return vus;
    }, fn.toString(), args);
    const carte = (id, pour) => window.TBF_ACTION.jouee({ id, nom: id, fam: 'pousse', cost: 20, texte: '' }, { pour });
    let vus = await joues(carte, 'a-fumigene', true);
    check('une carte jouée fait entendre son bruitage (le fumigène)', vus.includes('a-fumigene') && !vus.includes('carte'), vus);
    vus = await joues(carte, 'a-arbitre', false);
    check('celle de l’adversaire aussi (l’arbitre)', vus.includes('a-arbitre'), vus);
    vus = await joues(carte, 'a-carte-inconnue', true);
    check('une carte sans bruitage garde le claquement ordinaire', vus.includes('carte'), vus);
    await page.evaluate(() => document.documentElement.setAttribute('data-calme', 'animations'));
    vus = await joues(carte, 'a-ancre', true);
    check('le calme des animations retire le vol de la carte, pas son bruitage', vus.includes('a-ancre'), vus);
    await page.evaluate(() => document.documentElement.removeAttribute('data-calme'));
    const gestes = resoudreGeste({}, { motif: 1 });
    vus = await joues((g, gestes) => {
      const zone = document.getElementById('zone');
      const p = window.TBF_GESTE.jouer(g, gestes, { zone });
      zone.querySelector('#valider')?.click();
      return Promise.race([p, new Promise((r) => setTimeout(r, 50))]);
    }, 'tifo', gestes);
    check('une épreuve qui s’ouvre fait entendre son bruitage (le tifo)', vus[0] === 'epreuve-tifo', vus);
    check('aucune erreur de script (cartes et épreuves)', erreurs.length === 0, ...erreurs);
    await page.close();
  }

  /* ============================== 9. la scène tient sa célébration (fx)

     Pas du son, mais du même périmètre, et sans autre suite pour elle :
     `fanzzy-scene.js`, le personnage du Virage, de la fiche du match, de
     « Mon Fanzzy » et du kiosque (l'accueil a sa propre scène). Une pose
     tenue — `pose(nom, tenir)`, le but, la poussée d'un chant — est une
     célébration **dès sa demande** : un `poserFond` demandé pendant le
     décodage de son dessin prenait un jeton neuf et passait devant elle, et
     au Virage le rendu qui suit un but réel effaçait le « GOAL ! » du
     personnage avant qu'il paraisse (lot 6, vu par `virage:ui`). La page
     s'en garde maintenant elle-même : sans ce contrôle, une scène qui
     retomberait dans la faute ne rougirait plus nulle part.

     Les dessins sont des leurres et leur décodage dure ce que le contrôle
     veut : 300 ms pour « but » (le temps qu'un rendu passe), un refus pour
     « manque » (un état sans dessin, sans repli), 10 ms pour les autres. */
  console.log('\n  la scène tient sa célébration (fanzzy-scene.js, lot 6)');
  {
    const page = await banc.nav.newPage();
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    await page.evaluateOnNewDocument(() => {
      window.TBF_ETATS = {
        charger: async () => {},
        resoudre: (_id, { evo, etat }) => ({ evo, src: `data:image/gif;base64,R0lGODlhAQABAAAAACw=#${etat}` }),
        secours: () => null,
      };
      HTMLImageElement.prototype.decode = function decode() {
        const etat = String(this.src).split('#')[1];
        return new Promise((ok, non) => setTimeout(() => (etat === 'manque' ? non(new Error('manque')) : ok()),
          etat === 'but' ? 300 : 10));
      };
    });
    await page.goto(banc.base + '/__son-scene', { waitUntil: 'load' });
    const r = await page.evaluate(async () => {
      const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
      const scene = window.TBF_SCENE.creer(document.getElementById('hote'), { fond: 'attente' });
      await scene.definir({ id: 'ESSAI' });
      const vu = { depart: scene.etat() };
      // Le but, tenu 600 ms ; le rendu suivant redemande le fond pendant son décodage.
      const but = scene.pose('but', 600);
      scene.poserFond('pousse');
      vu.butParu = await but;
      vu.pendant = scene.etat();
      await dormir(800);
      vu.apres = scene.etat();
      // Une pose tenue qui ne paraît pas, et un fond demandé pendant son décodage.
      const manque = scene.pose('manque', 600);
      scene.poserFond('attente');
      vu.manqueParu = await manque;
      await dormir(100);
      vu.apresManque = scene.etat();
      scene.poserFond('pousse');
      await dormir(100);
      vu.fondLibre = scene.etat();
      /* La même, sans fond demandé pendant son décodage : le fond retenu est
         déjà à l'écran, rien n'est à reposer — et la scène doit quand même
         se libérer, sans quoi plus aucun fond ne passerait. */
      vu.seuleParue = await scene.pose('manque', 600);
      await dormir(50);
      scene.poserFond('attente');
      await dormir(100);
      vu.libreApresSeule = scene.etat();
      scene.arreter();
      return vu;
    });
    check('un fond demandé pendant le décodage d’une pose tenue ne passe pas devant elle (le « GOAL ! » paraît)',
      r.depart === 'attente' && r.butParu === true && r.pendant === 'but', r);
    check('la célébration finie, la scène revient au dernier fond demandé', r.apres === 'pousse', r);
    check('une pose tenue qui ne paraît pas libère la scène : le fond demandé entre-temps passe, et les suivants aussi',
      r.manqueParu === false && r.apresManque === 'attente' && r.fondLibre === 'pousse', r);
    check('et sans fond demandé entre-temps, elle se libère aussi : le fond suivant passe',
      r.seuleParue === false && r.libreApresSeule === 'attente', r);
    check('aucune erreur de script (la scène)', erreurs.length === 0, ...erreurs);
    await page.close();
  }
} finally {
  await banc.fermer();
}

console.log(failures ? `\n  ${failures} contrôle(s) en échec\n` : '\n  tout est vert\n');
process.exitCode = failures ? 1 : 0;
