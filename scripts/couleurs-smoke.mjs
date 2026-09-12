/**
 * Test des couleurs de club.
 *
 * Deux choses s'y jouent, et aucune ne se lit dans le code.
 *
 *   1. **Le décodeur PNG.** Il est écrit à la main pour éviter une
 *      bibliothèque native sur un hébergement mutualisé. Le défiltrage est la
 *      partie qu'on rate en écrivant vite : les cinq filtres se ressemblent, et
 *      un Paeth de travers donne une image *presque* juste — donc des couleurs
 *      plausibles mais fausses. Chaque filtre est donc éprouvé séparément, sur
 *      une image dont on connaît chaque pixel.
 *
 *   2. **Le choix des deux couleurs.** Un écusson est surtout fait de blanc,
 *      de noir et de fond transparent : la couleur moyenne d'un blason est
 *      toujours grise. On vérifie donc qu'une teinte minoritaire mais franche
 *      l'emporte sur un blanc majoritaire — c'est tout l'intérêt de la chose.
 *
 * Le remplissage en base est éprouvé contre un vrai serveur HTTP local : c'est
 * là que se cache la faute qui coûte cher, un blason illisible retéléchargé à
 * chaque affichage du match.
 *
 * Usage : node scripts/couleurs-smoke.mjs
 */
import { createServer } from 'node:http';
import { deflateSync, crc32 } from 'node:zlib';
import { decoderPng, couleursDuBlason } from '../src/server/football/blason.js';
import { createCouleurs } from '../src/server/football/couleurs.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ------------------------------------------------------- fabriquer un PNG

   L'encodeur du test applique **le filtre qu'on lui demande**, ligne par
   ligne. C'est ce qui permet d'éprouver le décodeur sur les cinq : un encodeur
   qui n'écrirait que des lignes non filtrées laisserait quatre branches du
   défiltrage sans aucun contrôle, et elles seraient fausses sans que rien ne
   le dise.                                                                  */

function morceau(type, data) {
  const t = Buffer.from(type, 'ascii');
  const taille = Buffer.alloc(4);
  taille.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0);
  return Buffer.concat([taille, t, data, crc]);
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/**
 * @param {number} largeur
 * @param {number} hauteur
 * @param {Uint8Array} octets  les canaux bruts, `canaux` par pixel
 * @param {object} opt  { couleur: type PNG, canaux, filtre, profondeur, entrelace, palette, trns }
 */
function png(largeur, hauteur, octets, opt = {}) {
  const { couleur = 6, canaux = 4, filtre = 0, profondeur = 8,
          entrelace = 0, palette = null, trns = null } = opt;
  const parLigne = largeur * canaux;
  const brut = Buffer.alloc(hauteur * (parLigne + 1));
  for (let y = 0; y < hauteur; y++) {
    brut[y * (parLigne + 1)] = filtre;
    for (let x = 0; x < parLigne; x++) {
      const val = octets[y * parLigne + x];
      const a = x >= canaux ? octets[y * parLigne + x - canaux] : 0;
      const b = y > 0 ? octets[(y - 1) * parLigne + x] : 0;
      const c = (x >= canaux && y > 0) ? octets[(y - 1) * parLigne + x - canaux] : 0;
      let e;
      switch (filtre) {
        case 0: e = val; break;
        case 1: e = val - a; break;
        case 2: e = val - b; break;
        case 3: e = val - ((a + b) >> 1); break;
        case 4: e = val - paeth(a, b, c); break;
        default: throw new Error('filtre inconnu dans le test');
      }
      brut[y * (parLigne + 1) + 1 + x] = e & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = profondeur; ihdr[9] = couleur; ihdr[12] = entrelace;
  const bouts = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', ihdr),
  ];
  if (palette) bouts.push(morceau('PLTE', Buffer.from(palette)));
  if (trns) bouts.push(morceau('tRNS', Buffer.from(trns)));
  bouts.push(morceau('IDAT', deflateSync(brut)), morceau('IEND', Buffer.alloc(0)));
  return Buffer.concat(bouts);
}

/**
 * Une image de bruit, pour éprouver le défiltrage octet par octet.
 *
 * **Du bruit, et pas un dégradé** : c'est toute la différence entre un
 * contrôle et un contrôle vert. Le premier essai employait `x * 37 + y * 11`,
 * un motif régulier — sur lequel le prédicteur de Paeth choisit toujours le
 * même voisin. Un Paeth faux y donnait exactement la même image, et le
 * contrôle du filtre 4 ne pouvait pas échouer. Avec du bruit, les trois
 * branches du prédicteur se rencontrent toutes.
 *
 * La suite de nombres est reproductible : un test qui échoue une fois sur dix
 * ne se corrige jamais, il se relance.
 */
function bruit(largeur, hauteur) {
  const o = new Uint8Array(largeur * hauteur * 4);
  let h = 0x2f6e2b1 >>> 0;
  for (let i = 0; i < o.length; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    o[i] = (i % 4 === 3) ? 255 : h & 0xff;      // alpha opaque, le reste au hasard
  }
  return o;
}

/** Une image d'une seule couleur unie, avec un fond transparent. */
function blason({ largeur = 20, hauteur = 20, parts }) {
  // `parts` : [{ couleur:[r,g,b,a], n }] — n pixels de cette couleur, à la file.
  const o = new Uint8Array(largeur * hauteur * 4);
  let p = 0;
  for (const { couleur, n } of parts) {
    for (let i = 0; i < n && p < largeur * hauteur; i++, p++) {
      o.set(couleur, p * 4);
    }
  }
  return png(largeur, hauteur, o);
}

/* ------------------------------------------------------------ le décodeur */

{
  const [L, H] = [9, 7];
  const attendu = bruit(L, H);
  for (const filtre of [0, 1, 2, 3, 4]) {
    const { largeur, hauteur, rgba } = decoderPng(png(L, H, attendu, { filtre }));
    const pareil = largeur === L && hauteur === H
      && rgba.every((v, i) => v === attendu[i]);
    check(`le filtre ${filtre} se défiltre exactement`, pareil);
  }

  /* Les trois autres rangements d'un PNG. Un blason peut arriver en RGB sans
     transparence, ou indexé — c'est fréquent pour un dessin à plat. */
  const rgb = new Uint8Array([200, 10, 30, 255, 255, 255]);      // 2 pixels
  const dec = decoderPng(png(2, 1, rgb, { couleur: 2, canaux: 3 }));
  check('un PNG sans canal alpha se lit comme opaque',
    dec.rgba[0] === 200 && dec.rgba[3] === 255 && dec.rgba[7] === 255);

  const indexe = decoderPng(png(2, 1, new Uint8Array([0, 1]),
    { couleur: 3, canaux: 1, palette: [200, 10, 30, 255, 255, 255], trns: [255, 0] }));
  check('un PNG indexé rend les couleurs de sa palette',
    indexe.rgba[0] === 200 && indexe.rgba[1] === 10 && indexe.rgba[2] === 30);
  /* `tRNS` d'un PNG indexé donne l'opacité de chaque entrée. Sans lui, le fond
     transparent d'un écusson compterait comme une couleur — et ce serait
     souvent la plus présente. */
  check('et la transparence de sa palette', indexe.rgba[7] === 0);

  const gris = decoderPng(png(2, 1, new Uint8Array([0, 255]), { couleur: 0, canaux: 1 }));
  check('un PNG en niveaux de gris se lit aussi',
    gris.rgba[0] === 0 && gris.rgba[4] === 255);
}

/* ------------------------------------------- ce qu'on refuse, en le disant */

{
  const dit = (fn) => { try { fn(); return ''; } catch (e) { return e.message; } };

  check('un fichier qui n’est pas un PNG est refusé en le disant',
    /signature/.test(dit(() => decoderPng(Buffer.from('pas une image')))));
  check('l’entrelacement est refusé par son nom',
    /entrelac/i.test(dit(() => decoderPng(png(2, 1, bruit(2, 1), { entrelace: 1 })))));
  check('les seize bits par canal aussi',
    /16 bits/.test(dit(() => decoderPng(png(2, 1, bruit(2, 1), { profondeur: 16 })))));
  /* Un blason entièrement transparent n'a pas de couleur : mieux vaut le dire
     que rendre du noir, qui deviendrait la couleur officielle du club. */
  check('un blason entièrement transparent est refusé',
    /transparent/.test(dit(() => couleursDuBlason(
      blason({ parts: [{ couleur: [0, 0, 0, 0], n: 400 }] })))));
}

/* ------------------------------------------------------- le choix des deux

 * Le cœur de l'affaire. Un écusson est surtout fait de fond transparent, de
 * blanc et de contour noir : la couleur du club y est minoritaire en surface.
 * Une moyenne, ou même un simple « la couleur la plus fréquente », rendrait du
 * blanc pour la moitié des clubs du monde.
 */
{
  const rouge = [200, 16, 46, 255];
  const blanc = [255, 255, 255, 255];
  const noir = [10, 10, 12, 255];
  const vide = [0, 0, 0, 0];

  const proche = (hex, [r, g, b]) => {
    const n = parseInt(hex.slice(1), 16);
    return Math.abs(((n >> 16) & 255) - r) < 26 && Math.abs(((n >> 8) & 255) - g) < 26
      && Math.abs((n & 255) - b) < 26;
  };

  {
    // 240 pixels transparents, 100 blancs, 60 rouges : le rouge est trois fois
    // moins présent que le blanc, et c'est pourtant la couleur du club.
    const c = couleursDuBlason(blason({ parts: [
      { couleur: vide, n: 240 }, { couleur: blanc, n: 100 }, { couleur: rouge, n: 60 },
    ] }));
    check('une teinte franche l’emporte sur un blanc majoritaire',
      proche(c.c1, rouge) || (console.log('        elle rend', c.c1), false));
    check('et le blanc devient la seconde couleur',
      c.c2 !== null && proche(c.c2, blanc)
      || (console.log('        seconde :', c.c2), false));
  }

  {
    // Le club en noir et blanc. Aucune teinte : c'est le contraste de clarté
    // qui doit fournir les deux couleurs, sinon un maillot rayé n'a qu'un ton.
    const c = couleursDuBlason(blason({ parts: [
      { couleur: vide, n: 200 }, { couleur: blanc, n: 120 }, { couleur: noir, n: 80 },
    ] }));
    check('un club sans teinte garde ses deux tons',
      c.c2 !== null && ((proche(c.c1, blanc) && proche(c.c2, noir))
        || (proche(c.c1, noir) && proche(c.c2, blanc)))
      || (console.log('        il rend', c.c1, 'et', c.c2), false));
  }

  {
    // Une seule couleur : on ne va pas en inventer une seconde. Un dégradé que
    // personne n'a dessiné vaut moins qu'un aplat franc.
    const c = couleursDuBlason(blason({ parts: [
      { couleur: vide, n: 300 }, { couleur: rouge, n: 100 },
    ] }));
    check('un blason d’une seule couleur n’en invente pas une seconde',
      proche(c.c1, rouge) && c.c2 === null
      || (console.log('        il rend', c.c1, 'et', c.c2), false));
  }

  {
    /* L'anticrénelage. Un contour dessiné produit trois cents nuances voisines
       d'un même rouge : sans regroupement, aucune ne l'emporte et la couleur
       du club perd contre un blanc parfaitement uni. */
    const parts = [{ couleur: vide, n: 150 }, { couleur: blanc, n: 90 }];
    for (let i = 0; i < 40; i++) {
      parts.push({ couleur: [200 + (i % 5), 16 + (i % 7), 46 - (i % 4), 255], n: 4 });
    }
    const c = couleursDuBlason(blason({ largeur: 24, hauteur: 24, parts }));
    check('les nuances d’un même rouge comptent ensemble',
      proche(c.c1, rouge) || (console.log('        elle rend', c.c1), false));
  }
}

/* ------------------------------------------------ le remplissage en base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS achats, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, api_cache`);
for (const f of ['football.sql', 'minutes.sql', 'couleurs.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 3, ...OPTIONS_BASE });

/* Un vrai serveur : c'est le seul moyen d'éprouver le compte des
   téléchargements, et donc la garde qui empêche de retélécharger sans fin. */
let appels = 0;
const image = blason({ parts: [
  { couleur: [0, 0, 0, 0], n: 240 },
  { couleur: [255, 255, 255, 255], n: 100 },
  { couleur: [40, 70, 190, 255], n: 60 },
] });
const srv = createServer((req, res) => {
  appels++;
  if (req.url === '/casse.png') { res.writeHead(404).end(); return; }
  if (req.url === '/pas-une-image.png') { res.writeHead(200).end('bonjour'); return; }
  res.writeHead(200, { 'content-type': 'image/png' }).end(image);
});
await new Promise((r) => srv.listen(0, r));
const base = `http://localhost:${srv.address().port}`;

await pool.query(`INSERT INTO teams (id,name,logo) VALUES
  (1,'Un',?),(2,'Deux',?),(3,'Trois',?),(4,'Sans blason',NULL)`,
[`${base}/1.png`, `${base}/casse.png`, `${base}/pas-une-image.png`]);

const couleurs = createCouleurs({ pool, log: { warn: () => {} } });

{
  const faits = await couleurs.assurer([1, 2, 3, 4]);
  check('le club dont le blason se lit reçoit ses couleurs', faits === 1);
  const [[t]] = await pool.query(`SELECT color1, color2, colors_at FROM teams WHERE id = 1`);
  check('elles sont écrites en base, au format d’une couleur CSS',
    /^#[0-9A-F]{6}$/.test(t.color1 ?? '')
    || (console.log('        elle vaut', t.color1), false));
  check('et ce sont bien celles du blason', t.color1 !== t.color2 && Boolean(t.color2));

  /* La mémoire de la tentative, et pas seulement du succès. Sans elle, un
     blason illisible serait retéléchargé à chaque affichage du match — pour
     toujours, et sans que personne ne s'en aperçoive. */
  const [[casse]] = await pool.query(`SELECT color1, colors_at FROM teams WHERE id = 2`);
  check('un blason introuvable laisse une trace de la tentative',
    casse.colors_at !== null && casse.color1 === null);
  const [[pasImage]] = await pool.query(`SELECT color1, colors_at FROM teams WHERE id = 3`);
  check('un fichier qui n’est pas une image aussi',
    pasImage.colors_at !== null && pasImage.color1 === null);

  const avant = appels;
  await couleurs.assurer([1, 2, 3, 4]);
  check('et rien n’est retéléchargé au passage suivant',
    appels === avant || (console.log(`        ${appels - avant} appel(s) de plus`), false));

  /* Le club sans blason n'est pas une tentative ratée : il n'y a rien à
     tenter. Le marquer comme essayé empêcherait de le reprendre le jour où
     l'API lui donne enfin un écusson. */
  const [[sans]] = await pool.query(`SELECT colors_at FROM teams WHERE id = 4`);
  check('un club sans blason n’est pas marqué comme tenté', sans.colors_at === null);

  // La reprise forcée : c'est ce que fait le script de remplissage.
  const repris = await couleurs.assurer([1, 2, 3], { rejouer: true });
  check('la reprise forcée retente les échecs', repris === 0 && appels > avant);
}

{
  /* La vague. Un soir de Coupe d'Europe présente quarante clubs d'un coup, et
     rien ne presse : on en fait quelques-uns, les autres au prochain écran. */
  await pool.query(`INSERT INTO teams (id,name,logo) VALUES
    (11,'A',?),(12,'B',?),(13,'C',?),(14,'D',?)`,
  ...[[`${base}/a.png`, `${base}/b.png`, `${base}/c.png`, `${base}/d.png`]]);
  const faits = await couleurs.assurer([11, 12, 13, 14], { parVague: 2 });
  check('une vague est bornée', faits === 2);
  const [[{ n }]] = await pool.query(
    `SELECT COUNT(*) n FROM teams WHERE id IN (11,12,13,14) AND colors_at IS NULL`);
  check('et le reste attend le passage suivant', n === 2);
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
srv.close(); await pool.end();
process.exit(failures ? 1 : 0);
