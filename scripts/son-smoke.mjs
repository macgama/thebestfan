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
 *      `fx.js` sans balise de plus dans les pages.
 *   3. **Le calme coupe tout**, ambiance et chants compris, et ce qui joue
 *      déjà.
 *   4. **Aucun son ne sort de sa fenêtre, aucun ne sature** : le banc
 *      (`son-banc.mjs`) rend chaque son hors ligne à travers la chaîne
 *      complète, et la mesure est jugée contre le mixage que le moteur
 *      déclare.
 *   5. **Tout fonctionne sans AudioContext** : un navigateur qui n'en a pas
 *      n'entend rien, et rien ne lève.
 *   6. **L'ambiance s'arrête quand l'onglet est caché**, et revient au
 *      retour ; elle ne recrée aucun nœud tant que rien ne change.
 *
 * Un serveur statique sur un port libre et un Chrome sans interface :
 * aucune base, aucun verrou. Les départs de sons se comptent en espionnant
 * `AudioScheduledSourceNode.prototype.start` dans la page — ce qui part
 * vraiment, pas ce que le moteur croit avoir fait.
 *
 * Avant de lancer (puppeteer est en devDependencies) : npm install
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirBanc, mesurerTout, juger } from './son-banc.mjs';

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

/* Sans moteur, rien d'autre ne se mesure : la panne est un contrôle rouge
   qui dit sa cause, pas une exception qui coupe la suite. */
const banc = await ouvrirBanc({
  routes: (app) => app.get('/__son-double', (_q, s) => s.type('html').send(PAGE_DOUBLE)),
}).catch((e) => {
  check('fx.js charge le moteur (son.js) dans une page qui n’a que lui', false, e.message);
  return null;
});

/* L'espion : posé avant tout script de la page. Il compte les contextes
   vivants créés, les sources qui démarrent et les nœuds créés hors des
   rendus hors ligne (ceux du banc ne comptent pas). `sansAudio` retire
   toutes les interfaces audio, comme un navigateur qui n'en a pas. */
function espion({ sansAudio = false } = {}) {
  window.__son = { contextes: 0, departs: 0, noeuds: 0 };
  if (sansAudio) {
    for (const nom of ['AudioContext', 'webkitAudioContext', 'OfflineAudioContext',
      'webkitOfflineAudioContext']) {
      try { delete window[nom]; } catch { /* rien */ }
      window[nom] = undefined;
    }
    return;
  }
  const hors = (c) => typeof OfflineAudioContext === 'function' && c instanceof OfflineAudioContext;
  const C = window.AudioContext;
  window.AudioContext = class extends C {
    constructor(...a) { super(...a); window.__son.contextes += 1; }
  };
  /* Les deux « start » : celui des oscillateurs (hérité) et celui des
     sources de tampon, qui déclarent le leur (décalage, durée). N'envelopper
     que le premier comptait la moitié des départs — les bruits et les claps
     passaient dessous. */
  for (const P of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
    if (!Object.prototype.hasOwnProperty.call(P, 'start')) continue;
    const depart = P.start;
    P.start = function start(...a) {
      if (!hors(this.context)) window.__son.departs += 1;
      return depart.apply(this, a);
    };
  }
  for (const m of ['createOscillator', 'createBufferSource', 'createGain', 'createBiquadFilter']) {
    const f = BaseAudioContext.prototype[m];
    BaseAudioContext.prototype[m] = function cree(...a) {
      if (!hors(this)) window.__son.noeuds += 1;
      return f.apply(this, a);
    };
  }
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
const compte = (page) => page.evaluate(() => ({ ...window.__son }));
const etat = (page) => page.evaluate(() => window.TBF_SON.etat());
/** Attend qu'une condition sur l'état du moteur soit vraie (ou renonce). */
async function jusqua(page, fn, ms = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn(await etat(page))) return true;
    await attendre(40);
  }
  return false;
}
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
  const inconnus = [], facadeInconnue = [], chantsInconnus = [], niveauxFaux = [];
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
    check('et l’ambiance attendue démarre avec lui', (await etat(page)).ambiance.joue === 1);

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
    check('la façade de cartes.js sonne par le même moteur', c.departs > d2, c);
    const d3 = c.departs;
    await page.evaluate(() => window.FX.reveler('legendaire', null));
    await attendre(300);
    c = await compte(page);
    check('la cérémonie FX.reveler sonne par le moteur (rugissement, puis le clac du tampon)',
      c.departs >= d3 + 5, { avant: d3, apres: c.departs });
    check('et tout cela dans un seul contexte', c.contextes === 1, c);
    check('aucune erreur de script', erreurs.length === 0, ...erreurs);
    await page.close();
  }
  {
    const { page, erreurs } = await nouvellePage('/__son-double');
    const balises = await page.evaluate(() => document.querySelectorAll('script[src="/son.js"]').length);
    check('une page qui pose déjà sa balise ne charge pas le moteur deux fois', balises === 1 && erreurs.length === 0,
      { balises, erreurs });
    await page.close();
  }

  /* ========================================================= 3. l'ambiance */

  console.log('\n  l’ambiance');
  {
    const { page, erreurs } = await nouvellePage();
    await page.click('#geste');
    await jusqua(page, (x) => x.contexte === 'running');
    await page.evaluate(() => window.TBF_SON.ambiance(1));
    check('ambiance(1) : la rumeur joue', (await etat(page)).ambiance.joue === 1);
    /* Au niveau 1, le premier éclat de voix vient au plus tôt quatre secondes
       et demie après le départ : en une seconde et demie, une ambiance qui
       ne recrée rien ne crée aucun nœud. */
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
    check('ambiance(0) : la tribune se vide, but compris', e.ambiance.voulu === 0 && e.ambiance.joue === 0, e.ambiance);

    /* ---------------------------------------------------- l'onglet caché */
    await page.evaluate(() => {
      window.TBF_SON.ambiance(2);
      window.__chant = window.TBF_SON.chant('marche', { tempo: 300, temps: Infinity });
    });
    check('avant de cacher : la rumeur et un chant ouvert jouent',
      (await etat(page)).ambiance.joue === 2 && (await etat(page)).chant === true);
    await cacher(page, true);
    e = await etat(page);
    check('onglet caché : la rumeur s’arrête', e.ambiance.joue === 0, e.ambiance);
    check('onglet caché : le chant s’arrête', e.chant === false);
    check('onglet caché : le contexte est suspendu', await jusqua(page, (x) => x.contexte === 'suspended'),
      await etat(page));
    const d1 = (await compte(page)).departs;
    await page.evaluate(() => window.FX.son('but'));
    check('onglet caché : un son demandé ne part pas', (await compte(page)).departs === d1);
    await cacher(page, false);
    check('au retour, le contexte reprend', await jusqua(page, (x) => x.contexte === 'running'), await etat(page));
    e = await etat(page);
    check('et la rumeur revient au niveau voulu', e.ambiance.joue === 2, e.ambiance);
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
    check('le calme arrête la rumeur', e.ambiance.joue === 0, e.ambiance);
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
    check('et la rumeur revient (le but demandé pendant le calme compris)', e.ambiance.joue >= 2, e.ambiance);
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
    const { page: p2 } = await nouvellePage();
    const relu = await p2.evaluate(() => window.TBF_SON.volume());
    check('il survit au rechargement', relu === 0.5, relu);
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
    check(`aucun son seul ne dépasse ${mix.creteSeule} dBFS, variantes comprises`,
      hors('variante').length === 0 && parSorte('son').every((j) => j.crete <= mix.creteSeule), ...hors('variante'));
    check(`rien ne sature : les superpositions restent sous ${mix.creteMax} dBFS`,
      hors('superposition').length === 0, ...hors('superposition'));
    const tous = parSorte('superposition').find((j) => j.id === 'tous-les-moments');
    const plusFort = Math.max(...parSorte('son').filter((j) => j.famille === 'moment').map((j) => j.crete));
    check('et le limiteur travaille vraiment : dix moments ensemble ne s’additionnent pas',
      tous && tous.crete < plusFort + 6, { ensemble: tous?.crete, plusFortSeul: plusFort });
    check('l’ambiance est dans ses fenêtres, niveau par niveau', hors('ambiance').length === 0, ...hors('ambiance'));
    const amb = parSorte('ambiance').map((j) => j.moyen);
    check('et chaque niveau sonne plus fort que le précédent', amb.length === 3 && amb[0] < amb[1] && amb[1] < amb[2], amb);
    check('les chants sont dans la fenêtre du jeu', hors('chant').length === 0, ...hors('chant'));
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
} finally {
  await banc.fermer();
}

console.log(failures ? `\n  ${failures} contrôle(s) en échec\n` : '\n  tout est vert\n');
process.exitCode = failures ? 1 : 0;
