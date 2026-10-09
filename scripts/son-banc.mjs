/**
 * Le banc du son : chaque son de la banque rendu hors ligne et mesuré.
 *
 * ## Pourquoi
 *
 * Les volumes de `fx.js` et de `cartes.js` étaient réglés à l'oreille, un par
 * un, sur un haut-parleur à la fois. Rien ne disait qu'un tic restait sous un
 * but, ni qu'un but, un geste parfait et une carte ensemble ne saturaient
 * pas. Ici, tout se mesure : `public/son.js` rend chaque son dans un
 * `OfflineAudioContext`, à travers **sa chaîne complète** (bus, limiteur,
 * plafond), et ce banc relève dans Chrome :
 *
 *   crête   l'échantillon le plus fort (dBFS) ;
 *   sonie   la sonie des cent millisecondes les plus fortes, pondérée K
 *           (BS.1770, coefficients exacts à 48 kHz), en LUFS ;
 *   moyen   la sonie sur toute la durée où le son s'entend ;
 *   durée   jusqu'à ce qu'il retombe sous −60 dBFS pour de bon.
 *
 * Il rend aussi les superpositions, les trois niveaux de l'ambiance, les
 * chants, une rafale de tics par-dessus un chant (lot 6), et un sinus qui
 * vérifie que la chaîne est transparente sous le seuil du limiteur.
 *
 * **Chaîne chaude.** Le limiteur de Chrome naît fermé et s'ouvre en deux
 * dixièmes de seconde ; `rendre` le laisse s'ouvrir dans le silence avant de
 * poser le son (voir CHAUFFE dans `son.js`). Jusqu'au lot 6, chaque son bref
 * était mesuré pendant cette ouverture, six à huit décibels sous ce que le
 * joueur entend, et les gains de la banque avaient été tirés de ces mesures.
 * Seuls les rendus de **la naissance** partent d'une chaîne froide (lot 6) :
 * le premier son d'une visite part dans le toucher qui fait naître le
 * contexte, et c'est lui qu'ils mesurent (voir NAISSANCE dans `son.js`).
 *
 * ## Usage
 *
 *   node scripts/son-banc.mjs [dossier]
 *
 * écrit un WAV par rendu (pour qui veut écouter) et `NIVEAUX.md`, le rapport,
 * dans `dossier` (par défaut `<temp>/tbf-son-banc`). Sans base, sans serveur
 * du jeu : un serveur statique sur un port libre.
 *
 * `scripts/son-smoke.mjs` importe d'ici la mesure (`ouvrirBanc`,
 * `mesurerTout`, `juger`) : une seule mesure, pas deux qui divergeraient.
 */
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

/* --------------------------------------------------------------- le banc */

/**
 * Un serveur statique de `public/` et un Chrome sans interface, sur une page
 * vide qui charge `fx.js` comme toutes les pages du jeu — donc `son.js` par
 * le chargeur de `fx.js`, et non par une balise posée exprès.
 *
 * @param {object} [o]
 * @param {(app: import('express').Express) => void} [o.routes]  des routes en plus
 * @returns {Promise<{ base: string, nav: import('puppeteer').Browser,
 *   page: import('puppeteer').Page, fermer(): Promise<void> }>}
 */
export async function ouvrirBanc({ routes } = {}) {
  const app = express();
  app.get('/__son', (_q, s) => s.type('html').send(PAGE_VIDE));
  routes?.(app);
  app.use(express.static(path.join(RACINE, 'public')));
  const http = createServer(app);
  await new Promise((r) => http.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${http.address().port}`;
  const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR'] });
  const page = await nav.newPage();
  await page.goto(`${base}/__son`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => Boolean(window.TBF_SON), { timeout: 10000 });
  } catch {
    // Nommer la cause : un « Waiting failed: 10000ms exceeded » ne dit rien.
    await nav.close();
    await new Promise((r) => http.close(r));
    throw new Error('son.js ne s’est pas chargé dans une page qui charge fx.js : '
      + 'fx.js doit ajouter la balise « /son.js » au chargement, et public/son.js '
      + 'doit exister et compiler.');
  }
  return {
    base, nav, page,
    async fermer() {
      await nav.close();
      await new Promise((r) => http.close(r));
    },
  };
}

/** La page vide du banc : la feuille de chaque page, fx.js en différé. */
export const PAGE_VIDE = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
  + '<title>banc du son</title></head><body><main id="app"><button id="geste" '
  + 'style="width:240px;height:120px">GESTE</button></main>'
  + '<script src="/fx.js" defer></script></body></html>';

/* ------------------------------------------------------------ la mesure

   Exécutée **dans la page** : le tampon rendu ne traverse pas le pont
   puppeteer (deux secondes en stéréo, c'est 192 000 nombres) — seuls les
   chiffres et, si on le demande, le WAV encodé en base 64 en reviennent. */
async function rendreEtMesurer(travaux, avecWav) {
  const K1 = [1.53512485958697, -2.69169618940638, 1.19839281085285,
    -1.69065929318241, 0.73248077421585];
  const K2 = [1, -2, 1, -1.99004745483398, 0.99007225036621];
  const biquad = (x, [b0, b1, b2, a1, a2]) => {
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
  const dB = (a) => (a > 0 ? 20 * Math.log10(a) : -Infinity);
  const lufs = (e) => -0.691 + 10 * Math.log10(Math.max(e, 1e-20));

  function mesurer(tampon, debut) {
    const sr = tampon.sampleRate;
    const n = tampon.length;
    const canaux = [];
    for (let k = 0; k < tampon.numberOfChannels; k++) canaux.push(tampon.getChannelData(k));
    let crete = 0;
    for (const x of canaux) for (let i = 0; i < n; i++) crete = Math.max(crete, Math.abs(x[i]));
    const pond = canaux.map((x) => biquad(biquad(x, K1), K2));
    const B = Math.round(sr * 0.01);
    const nb = Math.floor(n / B);
    const eK = new Float64Array(nb);
    const eBrut = new Float64Array(nb);
    for (let j = 0; j < nb; j++) {
      let sK = 0, sB = 0;
      for (let k = 0; k < canaux.length; k++) {
        const p = pond[k], x = canaux[k];
        for (let i = j * B; i < (j + 1) * B; i++) { sK += p[i] * p[i]; sB += x[i] * x[i]; }
      }
      // La somme des canaux pour la sonie (comme la norme), la moyenne pour le reste.
      eK[j] = sK / B;
      eBrut[j] = sB / (B * canaux.length);
    }
    let sonie = -Infinity;
    for (let j = 0; j + 10 <= nb; j++) {
      let s = 0;
      for (let m = 0; m < 10; m++) s += eK[j + m];
      sonie = Math.max(sonie, lufs(s / 10));
    }
    let premier = -1, dernier = -1;
    for (let j = 0; j < nb; j++) {
      if (eBrut[j] > 1e-6) { if (premier < 0) premier = j; dernier = j; }   // −60 dBFS
    }
    let moyen = -Infinity;
    if (premier >= 0) {
      let s = 0;
      for (let j = premier; j <= dernier; j++) s += eK[j];
      moyen = lufs(s / (dernier - premier + 1));
    }
    const arrondi = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : v);
    return {
      crete: arrondi(dB(crete)),
      sonie: arrondi(sonie),
      moyen: arrondi(moyen),
      duree: dernier < 0 ? 0 : arrondi((dernier + 1) * B / sr - debut),
    };
  }

  function wav(tampon) {
    const nc = tampon.numberOfChannels, n = tampon.length, sr = tampon.sampleRate;
    const octets = 44 + n * nc * 2;
    const tas = new ArrayBuffer(octets);
    const v = new DataView(tas);
    const ecrire = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ecrire(0, 'RIFF'); v.setUint32(4, octets - 8, true); ecrire(8, 'WAVE');
    ecrire(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, nc, true); v.setUint32(24, sr, true); v.setUint32(28, sr * nc * 2, true);
    v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true);
    ecrire(36, 'data'); v.setUint32(40, n * nc * 2, true);
    const ch = [];
    for (let k = 0; k < nc; k++) ch.push(tampon.getChannelData(k));
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < nc; k++) {
        const s = Math.max(-1, Math.min(1, ch[k][i]));
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        o += 2;
      }
    }
    const u8 = new Uint8Array(tas);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  const S = window.TBF_SON;
  const sorties = [];
  for (const t of travaux) {
    // `chauffe` : rendu depuis la naissance de la chaîne (voir « la naissance »).
    const tampon = await S.rendre(t.quoi, { duree: t.duree, graine: t.graine ?? 1,
      ...(t.chauffe != null ? { chauffe: t.chauffe } : {}) });
    if (!tampon) {
      sorties.push({ ...t, erreur: t.quoi.enregistre
        ? 'les fichiers de public/son/ ne se décodent pas' : 'pas de rendu hors ligne' });
      continue;
    }
    sorties.push({ ...t, ...mesurer(tampon, 0.02), ...(avecWav ? { wav: wav(tampon) } : {}) });
  }
  return sorties;
}

/* ----------------------------------------------------------- les travaux */

/**
 * Tout ce que le banc rend, d'après le mixage que le moteur déclare.
 * @param {object} mix  `TBF_SON.mixage()`
 */
export function travaux(mix) {
  const t = [];
  // La chaîne : transparente sous le seuil, tenue au-dessus.
  t.push({ id: 'chaine-sinus-20', sorte: 'chaine', quoi: { sinus: -20 }, duree: 1, attendu: -20 });
  t.push({ id: 'chaine-sinus-0', sorte: 'chaine', quoi: { sinus: 0 }, duree: 1 });
  // Chaque son, puis chacune de ses variantes.
  for (const [nom, s] of Object.entries(mix.sons)) {
    t.push({ id: nom, sorte: 'son', famille: s.famille, quoi: { son: nom }, duree: s.duree + 0.5 });
    s.variantes.forEach((options, i) => {
      t.push({ id: `${nom}~${i + 1}`, sorte: 'variante', famille: s.famille, options,
        quoi: { son: nom, options }, duree: s.duree + 0.5 });
    });
  }
  /* Les superpositions : ce que le joueur entend vraiment aux grands
     moments. Le limiteur et le plafond doivent les tenir sous la crête. */
  const sup = (id, sons, duree) => t.push({ id, sorte: 'superposition', quoi: { sons }, duree });
  sup('but+parfait+carte', ['but', 'parfait', 'carte'], 1.7);
  sup('butReel+ovation+pousse', ['butReel', 'ovation', 'pousse'], 5.9);
  sup('legendaire', ['rugissement', 'accord-legendaire', 'grondement', 'bache'], 2.4);
  /* Le verdict (lot 6) : la dernière frappe fait son tic, le tampon claque
     (« bache ») et le PARFAIT sonne — au pire, tous trois au même instant. */
  sup('verdict', ['tic', 'bache', 'parfait'], 0.9);
  sup('tous-les-moments', Object.keys(mix.sons).filter((n) => mix.sons[n].famille === 'moment'), 5.9);
  /* La tribune enregistrée (6 octobre 2026) : la clameur qui remplace
     l'ovation, seule et au but réel, jugée comme l'ovation — un moment. */
  t.push({ id: 'clameur', sorte: 'son', famille: 'moment', source: 'enregistree',
    quoi: { son: 'ovation', enregistre: true }, duree: 4.5 });
  t.push({ id: 'butReel+clameur+pousse', sorte: 'superposition', source: 'enregistree',
    quoi: { sons: ['butReel', 'ovation', 'pousse'], enregistre: true }, duree: 4.5 });
  /* L'ambiance, niveau par niveau, assez longtemps pour respirer. Avec sa
     fenêtre (la moyenne) et, aux niveaux qui restent sous l'interface, son
     plafond : la sonie sur cent millisecondes, celle d'une crête de la
     respiration ou d'un éclat, qui couvrirait un tic. */
  mix.ambiance.forEach((fenetre, n) => {
    if (n > 0) {
      t.push({ id: `ambiance-${n}`, sorte: 'ambiance', niveau: n, quoi: { ambiance: n }, duree: 8, fenetre,
        plafond: mix.ambiancePlafonds?.[n] ?? null });
    }
  });
  /* La rumeur enregistrée, aux trois mêmes niveaux, contre les mêmes
     fenêtres et les mêmes plafonds : elle remplace la synthèse là où elle
     se décode, et doit tenir ce que la synthèse tenait. */
  mix.ambiance.forEach((fenetre, n) => {
    if (n > 0) {
      t.push({ id: `rumeur-enregistree-${n}`, sorte: 'ambiance', source: 'enregistree', niveau: n,
        quoi: { ambiance: n, enregistre: true }, duree: 8, fenetre, plafond: mix.ambiancePlafonds?.[n] ?? null });
    }
  });
  /* Les échelles de la rumeur (lot 6) : la mi-temps et le vestiaire vide,
     au niveau 1, sur la même graine que la rumeur pleine. La chaîne est
     transparente sous le limiteur : l'écart de sonie moyenne se lit tel
     quel, et c'est lui qui dit qu'on entend la tribune retomber. */
  for (const [nom, echelle] of Object.entries(mix.echelles ?? {})) {
    t.push({ id: `ambiance-1-${nom}`, sorte: 'echelle', niveau: 1, echelle,
      quoi: { ambiance: 1, echelle }, duree: 8 });
  }
  // Les chants, aux tempos des gestes du serveur (gestures.js).
  const chant = (id, quoi, duree) => t.push({ id, sorte: 'chant', famille: 'jeu', quoi, duree });
  chant('chant-tempo', { chant: 'tempo', tempo: 560, temps: 8 }, 5.2);
  chant('chant-contretemps', { chant: 'contretemps', tempo: 620, temps: 6 }, 4.6);
  chant('chant-marche', { chant: 'marche', tempo: 500, temps: 16 }, 8.8);
  chant('chant-roulement', { chant: 'roulement', tempo: 500, temps: 4 }, 2.8);
  chant('chant-frappes-echo', { chant: 'frappes', instants: [0, 280, 840, 1120, 1680] }, 2.8);
  // L'équilibre des deux voix d'un chant : le tambour seul, les claps seuls (non jugés).
  t.push({ id: 'voix-tambour', sorte: 'voix', quoi: { chant: 'tempo', tempo: 560, temps: 8, voix: 'T' }, duree: 5.2 });
  t.push({ id: 'voix-claps', sorte: 'voix', quoi: { chant: 'tempo', tempo: 560, temps: 8, voix: 'C' }, duree: 5.2 });
  t.push(...rafales());
  t.push(...naissances(mix));
  return t;
}

/* ---------------------------------------------------------- la naissance

   Lot 6. Tout le reste du banc se rend **chaîne chaude** (CHAUFFE, dans
   son.js) : la chaîne telle qu'elle tourne en jeu. Mais le premier son d'une
   visite part dans le toucher même qui fait naître le contexte, sur une
   chaîne qui n'a encore rien entendu — et le limiteur de Chrome naît fermé :
   ce son-là sortait treize décibels sous la banque. Son remède (NAISSANCE,
   une relâche brève le temps que le limiteur s'ouvre) se mesure ici, en
   rendant **depuis la naissance** (`chauffe: 0`) : un son d'interface y sort
   comme chaîne chaude, à NAISSANCE_ECART près ; et ce qui s'empile pendant
   la relâche brève — tous les moments à la fois, ce qu'aucun écran ne joue
   au premier toucher — reste sous la crête de tout ce qui sort. */
export const NAISSANCE_ECART = 0.5;
export function naissances(mix) {
  const moments = Object.keys(mix.sons).filter((n) => mix.sons[n].famille === 'moment');
  return [
    { id: 'naissance-tic', sorte: 'naissance', comme: 'tic', quoi: { son: 'tic' }, duree: 0.6, chauffe: 0 },
    { id: 'naissance-bache', sorte: 'naissance', comme: 'bache', quoi: { son: 'bache' }, duree: 0.8, chauffe: 0 },
    { id: 'naissance-tous-les-moments', sorte: 'naissance', quoi: { sons: moments }, duree: 5.9, chauffe: 0 },
  ];
}

/* ------------------------------------------------------------- la rafale

   Lot 6 : le pavé fait un tic à chaque frappe (`geste.js`), jusqu'à huit ou
   dix par seconde au martelage, et le tambour du chant bat dessous. Un tic
   seul est mesuré dans la banque ; dix à la seconde, c'est autre chose :
   chacun garde la sonie d'un tic (il n'en tombe qu'un par fenêtre de cent
   millisecondes), mais ensemble ils remplissent les silences entre deux temps
   du chant, et c'est par là qu'ils pourraient le couvrir. Trois rendus, sur
   la même graine : le chant « tempo » du serveur (560 ms, huit temps) seul,
   la rafale seule (un tic toutes les RAFALE_MS, tant que dure le chant), et
   les deux ensemble — le chant y est, frappe pour frappe, celui qu'on rend
   seul (les tics ne tirent aucun hasard). Le premier tic tombe sur le
   premier temps, le vingt-neuvième sur le sixième : la crête la plus haute
   est celle d'un tic posé sur un coup de tambour. */
export const RAFALE_MS = 100;
/**
 * Ce que la rafale doit tenir, jugé sur l'ensemble contre ses deux moitiés :
 *
 *   sousChant  l'écart de sonie, en décibels, entre le chant seul et la
 *              rafale seule : celui que les familles gardent entre le haut
 *              de l'interface (−27) et le bas du jeu (−25). Deux décibels se
 *              lisent « plus bas » ; en deçà, les tics valent le tambour ;
 *   gonfle     ce que la rafale ajoute, au plus, à la sonie du chant : un
 *              décibel, sous ce que l'oreille lit « plus fort ».
 *
 * Et la crête de l'ensemble sous `creteMax`, comme toute superposition.
 */
export const RAFALE = { sousChant: 2, gonfle: 1 };
export function rafales() {
  const chant = { chant: 'tempo', tempo: 560, temps: 8 };
  const duree = 5.2;
  const suite = [];
  for (let a = 0; a < chant.temps * chant.tempo; a += RAFALE_MS) suite.push({ son: 'tic', a });
  const groupe = `tempo-${1000 / RAFALE_MS}hz`;
  return [
    { id: 'rafale-chant', sorte: 'rafale', groupe, role: 'chant', quoi: chant, duree },
    { id: 'rafale-tics', sorte: 'rafale', groupe, role: 'tics', quoi: { suite }, duree },
    { id: 'rafale-ensemble', sorte: 'rafale', groupe, role: 'ensemble', quoi: { ...chant, suite }, duree },
  ];
}

/**
 * Rend et mesure tout. Rend la liste des mesures, avec le mixage déclaré.
 * @param {import('puppeteer').Page} page  une page où `TBF_SON` est chargé
 */
export async function mesurerTout(page, { wav = false } = {}) {
  const mix = await page.evaluate(() => window.TBF_SON.mixage());
  const liste = travaux(mix);
  const mesures = await page.evaluate(rendreEtMesurer, liste, wav);
  return { mix, mesures };
}

/** L'écart, en décibels, qu'une rumeur creusée doit tenir sous la rumeur
    pleine : en deçà, on n'entend pas la tribune retomber (deux décibels se
    lisent « plus bas », six « autre chose »). */
export const RETOMBEE_MIN = 6;

/**
 * Le verdict de chaque mesure contre le mixage déclaré : sa fenêtre, sa
 * crête. Rend les mesures avec `ok` et, quand ça ne va pas, `pourquoi`.
 */
export function juger({ mix, mesures }) {
  const dans = (v, [a, b]) => v >= a && v <= b;
  return mesures.map((m) => {
    const fautes = [];
    if (m.erreur) fautes.push(m.erreur);
    else if (m.sorte === 'echelle') {
      /* Une rumeur creusée (lot 6) : sous la rumeur pleine du même niveau,
         d'au moins RETOMBEE_MIN. Sans la pleine, rien à quoi la comparer —
         c'est une faute, pas un vert. */
      const pleine = mesures.find((x) => x.sorte === 'ambiance' && !x.source && x.niveau === m.niveau && !x.erreur);
      if (!pleine) fautes.push(`pas de rumeur pleine au niveau ${m.niveau} à laquelle la comparer`);
      else if (pleine.moyen - m.moyen < RETOMBEE_MIN) {
        fautes.push(`seulement ${Math.round((pleine.moyen - m.moyen) * 10) / 10} dB sous la rumeur pleine `
          + `(${RETOMBEE_MIN} au moins) : on n'entendrait pas la tribune retomber`);
      }
      if (m.crete > mix.creteSeule) fautes.push(`crête ${m.crete} au-dessus de ${mix.creteSeule}`);
    }
    else if (m.sorte === 'son' || m.sorte === 'chant') {
      const f = mix.familles[m.famille].fenetre;
      if (!dans(m.sonie, f)) fautes.push(`sonie ${m.sonie} hors de [${f.join(', ')}]`);
      if (m.crete > mix.creteSeule) fautes.push(`crête ${m.crete} au-dessus de ${mix.creteSeule}`);
    } else if (m.sorte === 'variante') {
      /* **Une variante est un son que le jeu joue** : la déchirure à
         l'intensité du doigt, à celle de la finale. Elle tient la fenêtre de
         sa famille comme le son lui-même. Jugée sur sa seule crête, la
         déchirure passait « ok » à −44,7 LUFS (sous un tic) comme à −17,9
         (dans les moments). */
      const f = mix.familles[m.famille].fenetre;
      if (!dans(m.sonie, f)) fautes.push(`sonie ${m.sonie} hors de [${f.join(', ')}]`);
      if (m.crete > mix.creteSeule) fautes.push(`crête ${m.crete} au-dessus de ${mix.creteSeule}`);
    } else if (m.sorte === 'superposition') {
      if (m.crete > mix.creteMax) fautes.push(`crête ${m.crete} au-dessus de ${mix.creteMax}`);
    } else if (m.sorte === 'rafale') {
      /* La rafale (lot 6). Les tics seuls restent des sons d'interface :
         dix à la seconde ne sonnent pas plus fort qu'un. L'ensemble se juge
         contre ses deux moitiés rendues seules — sans elles, rien à quoi le
         comparer, et c'est une faute, pas un vert. */
      const de = (role) => mesures.find((x) => x.sorte === 'rafale' && x.groupe === m.groupe
        && x.role === role && !x.erreur);
      if (m.role === 'tics') {
        const haut = mix.familles.interface.fenetre[1];
        if (m.sonie > haut) fautes.push(`sonie ${m.sonie} au-dessus de l'interface (${haut})`);
        if (m.crete > mix.creteSeule) fautes.push(`crête ${m.crete} au-dessus de ${mix.creteSeule}`);
      } else if (m.role === 'ensemble') {
        const chant = de('chant');
        const tics = de('tics');
        if (!chant || !tics) fautes.push('le chant ou la rafale rendus seuls manquent : rien à quoi comparer');
        else {
          const sous = Math.round((chant.sonie - tics.sonie) * 10) / 10;
          if (sous < RAFALE.sousChant) {
            fautes.push(`les tics ne sont que ${sous} dB sous le chant (${RAFALE.sousChant} au moins) : `
              + 'ils couvriraient le tambour');
          }
          const plus = Math.round((m.sonie - chant.sonie) * 10) / 10;
          if (plus > RAFALE.gonfle) fautes.push(`la rafale gonfle le chant de ${plus} dB (${RAFALE.gonfle} au plus)`);
        }
        if (m.crete > mix.creteMax) fautes.push(`crête ${m.crete} au-dessus de ${mix.creteMax}`);
      }
    } else if (m.sorte === 'ambiance') {
      if (!dans(m.moyen, m.fenetre)) fautes.push(`moyen ${m.moyen} hors de [${m.fenetre.join(', ')}]`);
      /* La moyenne de huit secondes ne dit pas qu'une crête de la rumeur
         passe sur un tic : la sonie sur cent millisecondes, si. */
      if (m.plafond != null && m.sonie > m.plafond) {
        fautes.push(`sonie ${m.sonie} au-dessus de ${m.plafond} : la rumeur couvrirait l'interface`);
      }
      if (m.crete > mix.creteSeule) fautes.push(`crête ${m.crete} au-dessus de ${mix.creteSeule}`);
    } else if (m.sorte === 'naissance') {
      /* Depuis la naissance (lot 6) : le son seul contre le même son rendu
         chaîne chaude — sans lui, rien à quoi le comparer, et c'est une
         faute ; l'empilement, contre la crête de tout ce qui sort. */
      if (m.comme) {
        const chaud = mesures.find((x) => x.sorte === 'son' && x.id === m.comme && !x.erreur);
        if (!chaud) fautes.push(`pas de « ${m.comme} » chaîne chaude auquel le comparer`);
        else {
          const ecart = Math.max(Math.abs(m.crete - chaud.crete), Math.abs(m.sonie - chaud.sonie));
          if (ecart > NAISSANCE_ECART) {
            fautes.push(`${Math.round(ecart * 10) / 10} dB d'écart avec la chaîne chaude (crête ${m.crete} `
              + `contre ${chaud.crete}, sonie ${m.sonie} contre ${chaud.sonie}) : le limiteur naît fermé`);
          }
        }
      }
      if (m.crete > mix.creteMax) fautes.push(`crête ${m.crete} au-dessus de ${mix.creteMax}`);
    } else if (m.sorte === 'chaine') {
      if (m.attendu != null && Math.abs(m.crete - m.attendu) > 0.3) {
        fautes.push(`crête ${m.crete} au lieu de ${m.attendu} : la chaîne n'est pas transparente`);
      }
      if (m.crete > mix.creteMax) fautes.push(`crête ${m.crete} au-dessus de ${mix.creteMax}`);
    }
    return { ...m, ok: fautes.length === 0, pourquoi: fautes.join(' ; ') };
  });
}

/* ------------------------------------------------------------- le rapport */

const nombre = (v, n = 1) => (Number.isFinite(v) ? v.toFixed(n).replace('.', ',').replace('-', '−') : '—');
// Une durée au centième : un tic dure quatre centièmes, et « 0,0 s » ne dit rien.
const secondes = (v) => nombre(v, 2);

function rapport({ mix, mesures }, jugees) {
  const L = [];
  const ligne = (...c) => L.push(`| ${c.join(' | ')} |`);
  L.push('# Les niveaux du son de tribune');
  L.push('');
  L.push(`*Rendu par \`scripts/son-banc.mjs\` le ${new Date().toISOString().slice(0, 10)}, `
    + 'à travers la chaîne complète de `public/son.js` (bus, limiteur, plafond), à volume '
    + 'plein, 48 kHz.*');
  L.push('');
  L.push('**Crête** : l’échantillon le plus fort, en dBFS. **Sonie** : la sonie des cent '
    + 'millisecondes les plus fortes, pondérée K (BS.1770), en LUFS — c’est elle qui dit « fort ». '
    + '**Moyen** : la sonie sur toute la durée où le son s’entend. **Durée** : jusqu’à ce qu’il '
    + 'retombe sous −60 dBFS.');
  L.push('');
  L.push('## Les fenêtres');
  L.push('');
  ligne('famille', 'bus', 'sonie visée (LUFS)');
  ligne('---', '---', '---');
  for (const [nom, f] of Object.entries(mix.familles)) ligne(nom, f.bus, `${nombre(f.fenetre[0])} à ${nombre(f.fenetre[1])}`);
  L.push('');
  L.push(`Crête d’un son seul : au plus ${nombre(mix.creteSeule)} dBFS (sous le seuil du limiteur, `
    + `${nombre(mix.limiteur.seuil)} dB : un son seul ne le fait jamais travailler). Crête de tout ce `
    + `qui sort, superpositions comprises : au plus ${nombre(mix.creteMax)} dBFS.`);
  L.push('');
  const verdict = (j) => (j.ok ? 'ok' : `**HORS** (${j.pourquoi})`);
  const bloc = (titre, sorte, colonnes, cellules) => {
    const js = jugees.filter((j) => j.sorte === sorte);
    if (!js.length) return;
    L.push(`## ${titre}`);
    L.push('');
    ligne(...colonnes);
    ligne(...colonnes.map(() => '---'));
    for (const j of js) ligne(...cellules(j));
    L.push('');
  };
  bloc('La chaîne', 'chaine', ['rendu', 'crête', 'verdict'],
    (j) => [j.id, nombre(j.crete), verdict(j)]);
  bloc('La banque', 'son', ['son', 'famille', 'gain', 'crête', 'sonie', 'moyen', 'durée (s)', 'verdict'],
    (j) => [j.id, j.famille, String(mix.sons[j.id]?.gain ?? mix.clameur ?? 1).replace('.', ','), nombre(j.crete),
      nombre(j.sonie), nombre(j.moyen), secondes(j.duree), verdict(j)]);
  bloc('Les variantes', 'variante', ['son', 'options', 'famille', 'crête', 'sonie', 'verdict'],
    (j) => [j.id, `\`${JSON.stringify(j.options)}\``, j.famille, nombre(j.crete), nombre(j.sonie), verdict(j)]);
  bloc('Les superpositions', 'superposition', ['ensemble', 'crête', 'sonie', 'verdict'],
    (j) => [j.id, nombre(j.crete), nombre(j.sonie), verdict(j)]);
  bloc('L’ambiance', 'ambiance', ['niveau', 'fenêtre (moyen)', 'moyen', 'plafond (sonie)', 'sonie', 'crête', 'verdict'],
    (j) => [`${j.niveau}${j.source ? ' (enregistrée)' : ''}`, `${nombre(j.fenetre[0])} à ${nombre(j.fenetre[1])}`, nombre(j.moyen),
      j.plafond == null ? 'aucun (le but)' : nombre(j.plafond), nombre(j.sonie), nombre(j.crete), verdict(j)]);
  bloc('Les échelles de la rumeur (lot 6)', 'echelle', ['rendu', 'échelle', 'moyen', 'sonie', 'crête', 'verdict'],
    (j) => [j.id, String(j.echelle).replace('.', ','), nombre(j.moyen), nombre(j.sonie), nombre(j.crete), verdict(j)]);
  bloc('Les deux voix d’un chant', 'voix', ['voix', 'crête', 'sonie', 'moyen'],
    (j) => [j.id, nombre(j.crete), nombre(j.sonie), nombre(j.moyen)]);
  bloc('Les chants', 'chant', ['chant', 'crête', 'sonie', 'moyen', 'durée (s)', 'verdict'],
    (j) => [j.id, nombre(j.crete), nombre(j.sonie), nombre(j.moyen), secondes(j.duree), verdict(j)]);
  bloc(`La rafale de tics sur le chant (lot 6 : un tic toutes les ${RAFALE_MS} ms)`, 'rafale',
    ['rendu', 'rôle', 'crête', 'sonie', 'moyen', 'verdict'],
    (j) => [j.id, j.role, nombre(j.crete), nombre(j.sonie), nombre(j.moyen), verdict(j)]);
  bloc('La naissance de la chaîne (lot 6 : rendue sans chauffe, le premier son d’une visite)', 'naissance',
    ['rendu', 'comme', 'crête', 'sonie', 'verdict'],
    (j) => [j.id, j.comme ?? '—', nombre(j.crete), nombre(j.sonie), verdict(j)]);
  const hors = jugees.filter((j) => !j.ok);
  L.push(hors.length ? `**${hors.length} rendu(s) hors de leur fenêtre.**` : '**Tout est dans sa fenêtre.**');
  L.push('');
  return L.join('\n');
}

/* ------------------------------------------------------------- en direct */

const principal = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (principal) {
  const dossier = path.resolve(process.argv[2] ?? path.join(tmpdir(), 'tbf-son-banc'));
  mkdirSync(dossier, { recursive: true });
  const banc = await ouvrirBanc();
  try {
    const tout = await mesurerTout(banc.page, { wav: true });
    const jugees = juger(tout);
    for (const m of tout.mesures) {
      if (!m.wav) continue;
      writeFileSync(path.join(dossier, `${m.id.replace(/[^\w.+~-]/g, '_')}.wav`), Buffer.from(m.wav, 'base64'));
    }
    writeFileSync(path.join(dossier, 'NIVEAUX.md'), rapport(tout, jugees));
    for (const j of jugees) {
      console.log(`${j.ok ? '  ok  ' : ' HORS '} ${j.id.padEnd(26)} crête ${nombre(j.crete).padStart(6)}`
        + `  sonie ${nombre(j.sonie).padStart(6)}  moyen ${nombre(j.moyen).padStart(6)}`
        + `  ${secondes(j.duree)} s${j.ok ? '' : `  ${j.pourquoi}`}`);
    }
    console.log(`\n  ${tout.mesures.length} rendus, WAV et NIVEAUX.md dans ${dossier}`);
  } finally {
    await banc.fermer();
  }
}
