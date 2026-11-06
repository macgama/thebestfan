/**
 * L'usage du jeu : quelles pages les joueurs ouvrent, pour savoir ce qui les
 * intéresse le plus (demande de Gaël du 6 novembre 2026, menu JOUEURS de
 * l'administration).
 *
 * **Le moins possible, et rien chez un tiers.** Une ouverture de page d'un
 * joueur connecté ajoute un à un compteur du jour : `v:<page>` dans
 * `compteurs_jour`, la table qui compte déjà les boosters ouverts et les
 * parties de mini-jeux. Ni heure, ni adresse, ni appareil, ni parcours : un
 * nombre par joueur, par page et par jour. Les lignes partent avec le compte
 * (`auth/store.js`) et s'effacent d'elles-mêmes après `GARDE_JOURS`.
 *
 * Les missions du jour lisent `compteurs_jour` par clé exacte (`booster`,
 * `prono`…) : le préfixe `v:` ne les touche pas.
 *
 * Le compte se fait côté serveur, sur la navigation elle-même : le service
 * worker laisse passer les pages au réseau (`public/sw.js`), aucun script de
 * plus n'est chargé dans le navigateur. Un visiteur sans compte n'est jamais
 * compté, et l'administration non plus.
 */
import { compterDuJour } from '../quotidien/compteurs.js';

export const PREFIXE = 'v:';
export const GARDE_JOURS = 90;

/** Le chemin d'une page → son nom court (16 caractères au plus avec `v:`). */
const PAGES = {
  '/': 'accueil', '/index.html': 'accueil',
  '/matchs': 'matchs', '/aujourdhui.html': 'matchs',
  '/duel-nvn': 'duel', '/duel-nvn.html': 'duel',
  '/deck': 'deck', '/deck.html': 'deck',
  '/virage': 'virage', '/virage.html': 'virage',
  '/boosters': 'boosters', '/boosters.html': 'boosters',
  '/boutique': 'boutique', '/boutique.html': 'boutique',
  '/abonnement': 'pass', '/abonnement.html': 'pass',
  '/collection': 'collection', '/collection.html': 'collection',
  '/fanzzy': 'fanzzy', '/fanzzy.html': 'fanzzy', '/fanzzy-fiche.html': 'fiche',
  '/classement': 'classement', '/classement.html': 'classement',
  '/amis': 'amis', '/amis.html': 'amis',
  '/kop': 'kop', '/kop.html': 'kop',
  '/jeux': 'jeux', '/jeux.html': 'jeux',
  '/carnet': 'carnet', '/carnet.html': 'carnet',
  '/equipes': 'clubs', '/equipes.html': 'clubs',
  '/profil': 'profil', '/profil.html': 'profil',
  '/compte': 'compte', '/compte.html': 'compte',
  '/teletext': 'teletext', '/teletext.html': 'teletext',
  '/aide': 'aide', '/aide.html': 'aide',
  '/comment-jouer': 'comment', '/comment-jouer.html': 'comment',
};

/** Les noms lisibles, pour l'administration. */
export const NOMS = {
  accueil: 'Accueil', matchs: 'Matchs du jour (duel)', duel: 'Duel en jeu', deck: 'Deck',
  virage: 'Virage', boosters: 'Boosters', boutique: 'Boutique', pass: 'PASS',
  collection: 'Collection', fanzzy: 'Mes Fanzzy', fiche: 'Fiche d’un Fanzzy',
  classement: 'Classement', amis: 'Amis', kop: 'KOP', jeux: 'Mini-jeux', carnet: 'Carnet',
  clubs: 'Clubs', profil: 'Profil', compte: 'Compte', teletext: 'Télétexte',
  aide: 'Aide', comment: 'Comment jouer',
};

/** La page d'un chemin, ou `null` quand elle ne se compte pas. */
export function pageDe(chemin) {
  let p = String(chemin ?? '').split('?')[0];
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  if (PAGES[p]) return PAGES[p];
  if (/^\/fanzzy\/[^/]+$/.test(p)) return 'fiche';
  return null;
}

/**
 * @param {{ pool: any, horloge?: () => number }} o
 */
export function createUsage({ pool, horloge = Date.now }) {
  const q = (sql, params = []) => pool.execute(sql, params);
  let menageLe = null;

  /** Une fois par jour au plus : les lignes de plus de `GARDE_JOURS` s'en vont. */
  async function menage() {
    const jour = new Date(horloge()).toISOString().slice(0, 10);
    if (menageLe === jour) return;
    menageLe = jour;
    try {
      await q(`DELETE FROM compteurs_jour
                WHERE cle LIKE 'v:%' AND jour < CURDATE() - INTERVAL ${GARDE_JOURS} DAY`);
    } catch (e) {
      console.error('[usage] ménage non fait :', e?.code ?? e?.message ?? e);
    }
  }

  /** Le crochet Express : après `attachUser`, avant les pages. Ne bloque jamais. */
  function noter(req, _res, next) {
    if (req.method === 'GET' && req.user?.id) {
      const page = pageDe(req.path);
      if (page) {
        compterDuJour(q, req.user.id, PREFIXE + page);
        menage();
      }
    }
    next();
  }

  return { noter, menage };
}
