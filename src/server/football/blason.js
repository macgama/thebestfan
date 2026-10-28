/**
 * Les couleurs d'un club, lues dans son blason.
 *
 * L'API ne donne pas les couleurs des équipes — elle donne un écusson. On les
 * en extrait donc, une fois par club, et on ne garde **que les couleurs** :
 * deux chaînes de sept caractères. Ni le dessin, ni le nom, ni rien qui
 * appartienne au club ne descend en base. C'est ce qui permet de teindre
 * « GOAL ! » aux couleurs de l'équipe sans rien s'approprier.
 *
 * ## Pourquoi un décodeur PNG écrit à la main
 *
 * Décoder une image demande normalement une bibliothèque native — `sharp` et
 * ses binaires compilés — pour un service qui tourne sur un hébergement
 * mutualisé et dont c'est le seul besoin d'image. Un PNG en huit bits par
 * canal, non entrelacé, tient pourtant en cent lignes : la décompression est
 * du `zlib`, que Node a déjà, et le reste est de l'arithmétique. C'est le même
 * choix que les sons du jeu, synthétisés plutôt que téléchargés.
 *
 * Ce décodeur ne prétend pas être complet. Il refuse **en le disant** ce qu'il
 * ne sait pas lire — seize bits par canal, entrelacement Adam7 — plutôt que de
 * rendre des couleurs fausses. Un blason qu'on ne sait pas lire n'est pas une
 * panne : le club garde la couleur par défaut du jeu.
 *
 * ## Pourquoi pas la couleur moyenne
 *
 * Elle donne du gris, toujours. Un écusson est fait d'un fond transparent,
 * d'un contour noir, de blanc, et de la couleur du club — qui est souvent
 * minoritaire en surface. On écarte donc les pixels transparents, on
 * dépondère les gris et les quasi-blancs, et on garde les deux teintes les
 * plus présentes de ce qui reste.
 */
import { inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Le nombre d'octets par pixel, par type de couleur PNG (en 8 bits). */
const CANAUX = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * Décode un PNG 8 bits non entrelacé en RGBA.
 *
 * @returns {{ largeur:number, hauteur:number, rgba:Uint8Array }}
 * @throws  {Error} en nommant ce qui n'est pas lisible.
 */
export function decoderPng(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('blason : ce fichier n’est pas un PNG (signature absente)');
  }

  let i = 8;
  let ihdr = null;
  let palette = null;
  let transparence = null;
  const morceaux = [];

  while (i + 8 <= buf.length) {
    const taille = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const debut = i + 8;
    if (debut + taille > buf.length) {
      throw new Error(`blason : morceau ${type} tronqué (${taille} octets annoncés)`);
    }
    const data = buf.subarray(debut, debut + taille);

    if (type === 'IHDR') {
      ihdr = {
        largeur: data.readUInt32BE(0),
        hauteur: data.readUInt32BE(4),
        profondeur: data[8],
        couleur: data[9],
        entrelacement: data[12],
      };
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') transparence = data;
    else if (type === 'IDAT') morceaux.push(data);
    else if (type === 'IEND') break;

    i = debut + taille + 4;                 // + CRC
  }

  if (!ihdr) throw new Error('blason : PNG sans en-tête IHDR');
  if (ihdr.entrelacement !== 0) {
    throw new Error('blason : PNG entrelacé (Adam7), non pris en charge');
  }
  if (ihdr.profondeur !== 8) {
    throw new Error(`blason : PNG en ${ihdr.profondeur} bits par canal, `
      + 'seuls les 8 bits sont pris en charge');
  }
  const canaux = CANAUX[ihdr.couleur];
  if (!canaux) throw new Error(`blason : type de couleur PNG ${ihdr.couleur} inconnu`);
  if (ihdr.couleur === 3 && !palette) throw new Error('blason : PNG indexé sans palette');
  if (!morceaux.length) throw new Error('blason : PNG sans données (aucun IDAT)');

  const brut = inflateSync(Buffer.concat(morceaux));
  const { largeur, hauteur } = ihdr;
  const parLigne = largeur * canaux;
  if (brut.length < hauteur * (parLigne + 1)) {
    throw new Error('blason : PNG incomplet une fois décompressé');
  }

  /* Le défiltrage. Chaque ligne porte en tête le filtre qui lui a été appliqué,
     et se reconstruit à partir du pixel de gauche et de la ligne du dessus. Il
     se fait **sur les octets bruts**, avant toute conversion : c'est la seule
     étape où l'ordre compte, et c'est celle qu'on rate en écrivant vite. */
  const lignes = Buffer.alloc(hauteur * parLigne);
  let src = 0;
  for (let y = 0; y < hauteur; y++) {
    const filtre = brut[src++];
    const ici = y * parLigne;
    const dessus = ici - parLigne;
    for (let x = 0; x < parLigne; x++) {
      const val = brut[src + x];
      const a = x >= canaux ? lignes[ici + x - canaux] : 0;
      const b = y > 0 ? lignes[dessus + x] : 0;
      const c = (x >= canaux && y > 0) ? lignes[dessus + x - canaux] : 0;
      let out;
      switch (filtre) {
        case 0: out = val; break;
        case 1: out = val + a; break;
        case 2: out = val + b; break;
        case 3: out = val + ((a + b) >> 1); break;
        case 4: {
          // Paeth : on garde celui des trois voisins dont la somme prédite
          // s'écarte le moins. C'est la définition de la spécification, pas
          // une approximation.
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          out = val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`blason : filtre PNG ${filtre} inconnu à la ligne ${y}`);
      }
      lignes[ici + x] = out & 0xff;
    }
    src += parLigne;
  }

  /* La conversion en RGBA. Un seul format en sortie : tout le reste du module
     n'a plus à savoir comment le fichier était rangé. */
  const rgba = new Uint8Array(largeur * hauteur * 4);
  for (let p = 0; p < largeur * hauteur; p++) {
    const s = p * canaux;
    const d = p * 4;
    switch (ihdr.couleur) {
      case 0: rgba[d] = rgba[d + 1] = rgba[d + 2] = lignes[s]; rgba[d + 3] = 255; break;
      case 4: rgba[d] = rgba[d + 1] = rgba[d + 2] = lignes[s]; rgba[d + 3] = lignes[s + 1]; break;
      case 2: rgba[d] = lignes[s]; rgba[d + 1] = lignes[s + 1];
        rgba[d + 2] = lignes[s + 2]; rgba[d + 3] = 255; break;
      case 6: rgba[d] = lignes[s]; rgba[d + 1] = lignes[s + 1];
        rgba[d + 2] = lignes[s + 2]; rgba[d + 3] = lignes[s + 3]; break;
      case 3: {
        const idx = lignes[s] * 3;
        rgba[d] = palette[idx]; rgba[d + 1] = palette[idx + 1]; rgba[d + 2] = palette[idx + 2];
        // `tRNS` d'un PNG indexé donne l'opacité de chaque entrée de palette.
        // Sans lui, le fond transparent d'un écusson compterait comme une
        // couleur — et ce serait souvent la plus présente.
        rgba[d + 3] = transparence?.[lignes[s]] ?? 255;
        break;
      }
      default: break;
    }
  }

  return { largeur, hauteur, rgba };
}

/** Teinte, saturation et clarté, à la façon HSL. `t` en degrés. */
function tsc(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 510;                       // 0 → 1
  const d = max - min;
  if (d === 0) return { t: 0, s: 0, l };
  const s = d / (255 - Math.abs(max + min - 255));
  let t;
  if (max === r) t = ((g - b) / d) % 6;
  else if (max === g) t = (b - r) / d + 2;
  else t = (r - g) / d + 4;
  return { t: (t * 60 + 360) % 360, s, l };
}

/** L'écart de teinte, en degrés, sur un cercle. */
const ecartTeinte = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const hex = (r, g, b) => '#' + [r, g, b]
  .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
  .join('').toUpperCase();

/**
 * Le format d'un fichier, lu dans ses premiers octets — jamais dans l'adresse
 * ni dans l'en-tête HTTP, qui mentent : l'API sert parfois sous `….png` autre
 * chose qu'un PNG.
 *
 * @returns {'PNG'|'SVG'|'JPEG'|'GIF'|'WebP'|'HTML'|'inconnu'}
 */
export function formatDuBlason(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return 'inconnu';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(SIGNATURE)) return 'PNG';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'JPEG';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'GIF';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF'
    && buf.toString('ascii', 8, 12) === 'WEBP') return 'WebP';
  const debut = buf.toString('utf8', 0, Math.min(buf.length, 1024))
    .replace(/^\uFEFF/, '').trimStart().toLowerCase();
  if (debut.includes('<svg')) return 'SVG';
  if (debut.startsWith('<!doctype html') || debut.startsWith('<html')) return 'HTML';
  /* Un SVG commence souvent par un long commentaire ou un `<?xml …>` : on
     cherche la balise plus loin avant de renoncer. */
  if (debut.startsWith('<') && buf.toString('utf8').toLowerCase().includes('<svg')) return 'SVG';
  return 'inconnu';
}

/** Les couleurs CSS qu'on sait lire dans un SVG, en [r, g, b]. */
const NOMMEES = {
  black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], blue: [0, 0, 255],
  green: [0, 128, 0], yellow: [255, 255, 0], navy: [0, 0, 128], maroon: [128, 0, 0],
  gold: [255, 215, 0], orange: [255, 165, 0], purple: [128, 0, 128], gray: [128, 128, 128],
  grey: [128, 128, 128], silver: [192, 192, 192], darkblue: [0, 0, 139],
  darkred: [139, 0, 0], darkgreen: [0, 100, 0], skyblue: [135, 206, 235],
};

function lireCouleurCss(v) {
  v = v.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    if (h.length === 8 && parseInt(h.slice(6, 8), 16) < 128) return null;   // presque transparent
    return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16));
  }
  m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    if (p.length < 3) return null;
    if (p[3] !== undefined && parseFloat(p[3]) < 0.5) return null;
    return p.slice(0, 3).map((x) => x.endsWith('%')
      ? Math.round(parseFloat(x) * 2.55) : Math.round(parseFloat(x)));
  }
  return NOMMEES[v] ?? null;
}

/**
 * Les couleurs d'un SVG, comptées une fois par endroit où elles sont
 * employées (`fill`, `stroke`, `stop-color`, dans un attribut ou un style).
 * On ne dessine pas l'image : la surface réelle de chaque couleur est
 * inconnue, et le nombre d'emplois en est une approximation suffisante pour
 * un écusson, fait de quelques aplats.
 */
function pixelsDuSvg(buf) {
  const texte = buf.toString('utf8');
  const re = /(?:fill|stroke|stop-color)\s*(?:=\s*["']|:\s*)([^"';}>]+)/gi;
  const vus = [];
  for (const m of texte.matchAll(re)) {
    const c = lireCouleurCss(m[1]);
    if (c && c.every((x) => Number.isFinite(x))) vus.push(c);
  }
  /* Un SVG sans aucune couleur écrite se peint en noir par défaut : c'est un
     dessin au trait, pas une couleur de club. */
  if (!vus.length) throw new Error('blason : SVG sans couleur lisible');
  const rgba = new Uint8Array(vus.length * 4);
  vus.forEach(([r, g, b], k) => { rgba.set([r, g, b, 255], k * 4); });
  return rgba;
}

/** Erreur d'un blason dans un format que le jeu ne lit pas. */
export class FormatDeBlason extends Error {
  constructor(format) {
    super(`blason au format ${format}, que le jeu ne lit pas`);
    this.format = format;
  }
}

/**
 * Les deux couleurs d'un blason.
 *
 * Lit un PNG ou un SVG. Les autres formats (JPEG, GIF, WebP, page d'erreur)
 * lèvent une `FormatDeBlason` : le club garde alors la couleur par défaut.
 *
 * @param {Buffer} buf
 * @returns {{ c1:string, c2:string|null }} `c2` est nulle quand le blason
 *   n'offre pas de seconde couleur franchement distincte — un écusson d'une
 *   seule teinte existe, et inventer un second ton donnerait un dégradé que
 *   personne n'a dessiné.
 * @throws {Error} si l'image n'est pas lisible, en nommant la cause.
 */
export function couleursDuBlason(buf) {
  const format = formatDuBlason(buf);
  let rgba;
  if (format === 'PNG') rgba = decoderPng(buf).rgba;
  else if (format === 'SVG') rgba = pixelsDuSvg(buf);
  else throw new FormatDeBlason(format);

  /* Les couleurs sont regroupées par paquets de seize valeurs par canal.
     Sans ce regroupement, l'anticrénelage d'un contour éparpille une même
     couleur sur trois cents nuances voisines, dont aucune ne l'emporte. */
  const paquets = new Map();
  for (let p = 0; p < rgba.length; p += 4) {
    const a = rgba[p + 3];
    if (a < 128) continue;                            // fond transparent
    const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    const { s, l } = tsc(r, g, b);

    /* Un écusson est surtout fait de blanc, de noir et de contour. Ces
       pixels-là comptent, mais **six fois moins** : sans cette dépondération,
       tous les clubs du monde ressortent en blanc cassé. Avec elle, un club
       réellement monochrome garde quand même sa couleur, puisque rien d'autre
       ne concourt. */
    const poids = (s >= 0.28 && l > 0.12 && l < 0.9) ? 1 : 1 / 6;

    const cle = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
    const acc = paquets.get(cle) ?? { poids: 0, n: 0, r: 0, g: 0, b: 0 };
    acc.poids += poids; acc.n++; acc.r += r; acc.g += g; acc.b += b;
    paquets.set(cle, acc);
  }

  if (!paquets.size) throw new Error('blason : image entièrement transparente');

  // La couleur rendue est la **moyenne du paquet**, pas son centre : un rouge
  // de club ne tombe jamais pile au milieu d'un intervalle de seize.
  const tries = [...paquets.values()]
    .map((a) => ({ poids: a.poids, r: a.r / a.n, g: a.g / a.n, b: a.b / a.n }))
    .sort((x, y) => y.poids - x.poids);

  const premier = tries[0];
  const t1 = tsc(premier.r, premier.g, premier.b);

  /* La seconde couleur doit être **vue comme une autre couleur**, pas comme
     une nuance de la première : soit une autre teinte, soit un contraste de
     clarté franc — le noir et blanc d'un maillot rayé est un cas réel. */
  const second = tries.slice(1).find((c) => {
    const t = tsc(c.r, c.g, c.b);
    const teinteLoin = t.s > 0.2 && t1.s > 0.2 && ecartTeinte(t.t, t1.t) > 40;
    const clarteLoin = Math.abs(t.l - t1.l) > 0.34;
    return (teinteLoin || clarteLoin) && c.poids > premier.poids * 0.08;
  }) ?? null;

  return {
    c1: hex(premier.r, premier.g, premier.b),
    c2: second ? hex(second.r, second.g, second.b) : null,
  };
}
