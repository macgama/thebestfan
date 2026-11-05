/**
 * L'écusson du jeu : un club dessiné à ses couleurs, sans son logo.
 *
 * ## Pourquoi
 *
 * Le logo d'un club est une **marque** qui lui appartient. La licence
 * d'API-Football donne les données, pas le droit d'utiliser ces marques
 * (`LICENCE-API-FOOTBALL.md`, question 5). Choix de Gaël du 5 novembre 2026,
 * pour prendre le moins de risque possible face aux clubs :
 *
 * - **Dans « Matchs »** (matchs du jour, télétexte, résultats et classements
 *   réels), le logo officiel reste : il y informe, comme un site de scores.
 * - **Dans le jeu** (accueil, Virage, duels, deck, KOP, classements du jeu,
 *   fiche d'un Fanzzy, profil, mes équipes, carnet, bienvenue), le logo est
 *   remplacé par cet écusson : un blason partagé aux deux couleurs du club,
 *   avec ses initiales. Le nom du club reste écrit à côté.
 *
 * Côté navigateur, `public/ecusson.js` remplace chaque logo d'API-Football
 * par l'adresse d'ici, sur les pages du jeu. Rien ne change dans la base :
 * les couleurs viennent de `teams.color1`/`color2` (`couleurs.js`), les
 * initiales de `teams.code` ou du nom.
 *
 * ## Les adresses
 *
 * - `GET /api/ecusson/:id.svg`        un club (identifiant de l'API) ;
 * - `GET /api/ecusson/ligue/:id.svg`  une compétition (son logo est aussi
 *   une marque : écusson neutre, or et nuit, à ses initiales).
 *
 * Un club inconnu reçoit quand même un écusson, aux couleurs du jeu : une
 * image cassée au milieu d'un écran de jeu serait pire qu'un blason sans
 * couleur.
 */
import { Router } from 'express';
import { COULEURS_A_LA_MAIN } from './couleurs.js';

/** Les couleurs du jeu, pour un club dont on ne sait rien. */
export const COULEURS_DU_JEU = ['#F5C33B', '#1B2340'];
const ENCRE = '#0B0F1C';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const couleur = (c) => (typeof c === 'string' && HEX.test(c) ? c.toUpperCase() : null);

/** « #RRGGBB » → luminance relative (0 sombre, 1 clair). */
function luminance(hex) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

/** Trois lettres au plus, tirées du code du club ou de son nom. */
export function initiales({ code, name } = {}) {
  const c = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length >= 2 && c.length <= 3) return c;
  const mots = String(name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().split(/[^A-Z0-9]+/)
    .filter((m) => m && !['FC', 'AFC', 'CF', 'SC', 'AC', 'AS', 'FK', 'SK', 'DE', 'DU', 'LA', 'LE', 'THE'].includes(m));
  if (!mots.length) return '?';
  if (mots.length === 1) return mots[0].slice(0, 3);
  return mots.slice(0, 3).map((m) => m[0]).join('');
}

const echapper = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Le dessin : un blason « parti » (moitié gauche, moitié droite), un liseré
 * clair et un contour d'encre, les initiales au milieu dans la couleur qui
 * se lit le mieux. 64 × 72, vectoriel : net à toutes les tailles.
 */
export function dessinerEcusson({ c1, c2, lettres }) {
  const a = couleur(c1) ?? COULEURS_DU_JEU[0];
  let b = couleur(c2) ?? (a === COULEURS_DU_JEU[0] ? COULEURS_DU_JEU[1] : '#FFFFFF');
  if (b === a) b = luminance(a) > 0.5 ? ENCRE : '#FFFFFF';
  const fond = (luminance(a) + luminance(b)) / 2;
  const texte = fond > 0.45 ? ENCRE : '#FFFFFF';
  const trait = texte === ENCRE ? '#FFFFFF' : ENCRE;
  const l = echapper(String(lettres ?? '?').slice(0, 3));
  const taille = l.length >= 3 ? 19 : 24;
  const bouclier = 'M32 3 L59 10 V34 C59 52 47 63 32 69 C17 63 5 52 5 34 V10 Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 72" width="64" height="72">`
    + `<defs><clipPath id="e"><path d="${bouclier}"/></clipPath></defs>`
    + `<g clip-path="url(#e)"><rect width="32" height="72" fill="${a}"/>`
    + `<rect x="32" width="32" height="72" fill="${b}"/>`
    + `<rect y="10" width="64" height="2" fill="#FFFFFF" opacity=".35"/></g>`
    + `<path d="${bouclier}" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".9"/>`
    + `<path d="${bouclier}" fill="none" stroke="${ENCRE}" stroke-width="1.5"/>`
    + `<text x="32" y="${l.length >= 3 ? 43 : 45}" text-anchor="middle" `
    + `font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="${taille}" `
    + `fill="${texte}" stroke="${trait}" stroke-width="1.2" paint-order="stroke" `
    + `letter-spacing=".5">${l}</text></svg>`;
}

/** Écusson d'une compétition : or et nuit, ses initiales. */
export function dessinerEcussonLigue({ name }) {
  return dessinerEcusson({ c1: COULEURS_DU_JEU[0], c2: COULEURS_DU_JEU[1], lettres: initiales({ name }) });
}

export function createEcusson({ pool, aLaMain = COULEURS_A_LA_MAIN }) {
  const router = Router();
  const envoyer = (res, svg) => {
    res.set('Content-Type', 'image/svg+xml; charset=utf-8');
    /* Les couleurs d'un club changent rarement, mais elles arrivent parfois
       après le premier affichage (lecture du blason en fond) : un jour de
       cache, pas plus. */
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(svg);
  };

  router.get('/ligue/:id.svg', async (req, res) => {
    const id = Number(req.params.id);
    let ligue = null;
    if (Number.isInteger(id) && id > 0) {
      ligue = (await pool.query('SELECT name FROM leagues WHERE id = ?', [id])
        .catch(() => [[]]))[0]?.[0] ?? null;
    }
    envoyer(res, dessinerEcussonLigue({ name: ligue?.name ?? '' }));
  });

  router.get('/:id.svg', async (req, res) => {
    const id = Number(req.params.id);
    let club = null;
    if (Number.isInteger(id) && id > 0) {
      club = (await pool.query('SELECT name, code, color1, color2 FROM teams WHERE id = ?', [id])
        .catch(() => [[]]))[0]?.[0] ?? null;
    }
    const main = aLaMain[id];
    envoyer(res, dessinerEcusson({
      c1: main?.[0] ?? club?.color1, c2: main ? main[1] : club?.color2,
      lettres: initiales(club ?? {}),
    }));
  });

  return { router };
}
