/**
 * Point d'entrée du paquet client du duel.
 * esbuild en fait un fichier unique exposé en global `TBF`, que public/duel.html
 * utilise. Le moteur de règles reste côté serveur : seule la projection des
 * événements et l'affichage vivent ici.
 */
import { project } from '../../shared/duel/project.js';
import { CARDS, CARD_BY_ID, cardDef } from '../../shared/duel/cards.js';
import { RULES } from '../../shared/duel/engine.js';
import { AMBIANCE, cardArt, costColor } from './art.js';
import { CARD_NAMES, cardName, cardClub, chantName } from '../../shared/duel/names.js';
import dict from '../../shared/i18n/duel.json';

export {
  project, CARDS, CARD_BY_ID, cardDef, RULES, AMBIANCE, cardArt, costColor, dict,
  CARD_NAMES, cardName, cardClub, chantName,
};
