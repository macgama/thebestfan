/**
 * Les défis de la semaine, en règles pures (demande de Gaël du 3 novembre
 * 2026 : « jouer 5 duels avec un Fanzzy Le Terraces », « utiliser 5 fois la
 * corne de brume dans le virage », « jouer 5 duels avec un skin préhistorique »).
 *
 * ## Ce qui les distingue des missions du jour
 *
 * Les missions du jour sont **les mêmes pour tout le monde** (`quotidien.js`).
 * Un défi, lui, parle de ce que le joueur **possède** : une série dont il a un
 * Fanzzy, une pièce qu'il a, une tenue qu'il a. Le tirage est donc semé par la
 * semaine **et** par le joueur, et il ne choisit que parmi ses affaires : un
 * défi qu'il ne pourrait pas faire n'est jamais proposé.
 *
 * Trois défis pour tous, renouvelés chaque lundi : une série, une pièce de
 * stuff, une tenue. Le stuff ne s'« utilise » pas, il est porté et agit seul :
 * le défi demande donc de chanter au Grand Virage en le portant.
 *
 * Un quatrième pour les membres d'un PASS dont la saison court : jouer en
 * tenue de ce PASS. **Il ne rapporte que des points de la voie PASS** (choix
 * de Gaël du 3 novembre 2026) : du visuel, jamais d'écharpes ni de tampons du
 * carnet — le PASS ne donne jamais d'écharpes (`shared/pass.js`).
 *
 * Rien ici ne lit la base ni l'horloge : `src/server/defis/` le fait.
 */
import { reglage } from './reglages.js';
import { hacher } from './quotidien.js';

/** Les rangs d'une semaine. Dessinés : ils ne se règlent pas. */
export const RANGS = Object.freeze({ serie: 0, stuff: 1, tenue: 2, pass: 3 });

/**
 * Les quatre sortes de défis. Les cibles sont des règles du jeu, comme celles
 * des missions : elles ne se règlent pas. Seuls les montants sont au registre.
 *
 * `compte` : ce qui fait avancer le défi — un duel (d'au moins une minute,
 * pas quitté : la règle des missions) ou un chant au Grand Virage.
 */
export const SORTES = Object.freeze({
  serie: Object.freeze({ rang: 0, cible: 5, compte: 'duels', ou: '/duel-nvn', bouton: 'Jouer un duel' }),
  stuff: Object.freeze({ rang: 1, cible: 30, compte: 'chants', ou: '/virage', bouton: 'Entrer dans le Virage' }),
  tenue: Object.freeze({ rang: 2, cible: 3, compte: 'duels', ou: '/duel-nvn', bouton: 'Jouer un duel' }),
  pass: Object.freeze({ rang: 3, cible: 5, compte: 'duels', ou: '/duel-nvn', bouton: 'Jouer un duel' }),
});

export const SORTE_DU_RANG = Object.freeze(Object.fromEntries(
  Object.entries(SORTES).map(([s, d]) => [d.rang, s])));

/**
 * L'intitulé d'un défi. `nom` est le nom de la série, de la pièce ou de la
 * tenue, tel que le catalogue l'écrit.
 */
export function titreDefi(sorte, cible, nom) {
  switch (sorte) {
    case 'serie': return `Joue ${cible} duels avec un Fanzzy ${nom}`;
    case 'stuff': return `Chante ${cible} fois au Grand Virage en portant « ${nom} »`;
    case 'tenue': return `Joue ${cible} duels avec un Fanzzy en tenue « ${nom} »`;
    case 'pass': return `Joue ${cible} duels en tenue « ${nom} », celle de ton PASS`;
    default: return '';
  }
}

/**
 * Un choix parmi des identifiants, semé par la semaine, le joueur et la
 * sorte : le même à chaque tirage (deux onglets écrivent la même chose, et
 * `INSERT IGNORE` ne garde que la première), différent d'un joueur à l'autre.
 * La liste est triée d'abord : l'ordre de la base ne compte pas.
 */
export function choisirParmi(ids, { semaine, userId, sorte }) {
  const liste = [...new Set((ids ?? []).filter((x) => typeof x === 'string' && x))].sort();
  if (!liste.length) return null;
  return liste[hacher(`${semaine}|${userId}|${sorte}`) % liste.length];
}

/** Ce qu'un défi rapporte, copié au tirage. */
export function gainDefi(sorte, { avecSaison = true, lire = reglage } = {}) {
  if (sorte === 'pass') return { echarpes: 0, tampons: 0, points: lire('defis.points_voie') };
  return {
    echarpes: lire('defis.echarpes'),
    tampons: avecSaison ? lire('defis.tampons') : 0,
    points: 0,
  };
}

/**
 * Le tirage d'une semaine.
 *
 * @param possede  `{ series, stuff, tenues }` : les codes de séries dont il a
 *                 un Fanzzy, les pièces qu'il a, les tenues qu'il a (hors
 *                 tenues de PASS)
 * @param pass     `{ tenue, saisonId }` pour un membre dont le PASS court, ou
 *                 `null`
 * @returns `[{ rang, sorte, objet, cible }]`, sans les sortes qu'il ne peut
 *          pas faire
 */
export function tirerDefis({ semaine, userId, possede = {}, pass = null }) {
  const out = [];
  const ajouter = (sorte, objet) => {
    if (objet) out.push({ rang: SORTES[sorte].rang, sorte, objet, cible: SORTES[sorte].cible });
  };
  ajouter('serie', choisirParmi(possede.series, { semaine, userId, sorte: 'serie' }));
  ajouter('stuff', choisirParmi(possede.stuff, { semaine, userId, sorte: 'stuff' }));
  ajouter('tenue', choisirParmi(possede.tenues, { semaine, userId, sorte: 'tenue' }));
  if (pass?.tenue) ajouter('pass', pass.tenue);
  return out;
}

/**
 * Ce qu'un duel fait avancer : les rangs des défis que ce duel remplit.
 *
 * @param defis   les défis de la semaine, `[{ rang, sorte, objet, fait, cible }]`
 * @param joues   les Fanzzy montés en tribune, `[{ serie, tenues: [..], stuff: [..] }]`
 */
export function rangsDuDuel(defis, joues) {
  const rangs = [];
  for (const d of defis ?? []) {
    if (SORTES[d.sorte]?.compte !== 'duels' || Number(d.fait) >= Number(d.cible)) continue;
    const ok = (joues ?? []).some((f) => (d.sorte === 'serie'
      ? f.serie === d.objet
      : (f.tenues ?? []).includes(d.objet)));
    if (ok) rangs.push(Number(d.rang));
  }
  return rangs;
}

/** Ce qu'un chant au Virage fait avancer, d'après le sac du Fanzzy qui chante. */
export function rangsDuChant(defis, sac) {
  const porte = new Set(sac ?? []);
  return (defis ?? [])
    .filter((d) => SORTES[d.sorte]?.compte === 'chants' && Number(d.fait) < Number(d.cible)
      && porte.has(d.objet))
    .map((d) => Number(d.rang));
}
