/**
 * Les gestes du bot d'entraînement.
 *
 * **Il tapait un tempo sur tous les chants.** Huit frappes à 560 ms, quel que
 * soit le geste de la carte choisie : sur vingt-deux chants sur vingt-six, il
 * ne poussait rien ou se faisait refuser (« trop de frappes », « frappe hors
 * de la fenêtre »), et un débutant le battait neuf fois sur dix
 * (`npm run simuler -- duels`, 27 octobre 2026). Sa force tenait au hasard
 * des cinq chants du duel.
 *
 * Il fait maintenant **le geste de la carte**, avec son adresse : de 0, il
 * tape n'importe comment, à 1, il est juste à quelques millisecondes près.
 * Les seize épreuves (dessiner, viser, retenir…) demandent un tracé ou une
 * grille qu'un bot ne fabrique pas : il choisit donc parmi les chants de
 * rythme de son répertoire, qui en compte toujours au moins un.
 *
 * Écrit à part pour que la simulation (`scripts/simuler-parties.mjs`) joue le
 * bot du jeu, et non une copie.
 */
import { resoudreGeste, GESTURES } from '../ferveur/gestures.js';
import { CHANTS } from '../../shared/duel/chants.js';

/** Les dix gestes que le bot sait jouer : ceux qui se tapent. */
export const GESTES_DU_BOT = new Set(['tempo', 'mash', 'hold', 'contretemps', 'echo',
  'crescendo', 'relance', 'salves', 'tenue', 'retenue']);

/* Un tirage centré, sans dépendance : la somme de trois tirages uniformes. */
const bruit = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

/** Les frappes d'un humain : jamais deux à moins de 45 ms. */
function humain(taps) {
  const out = [];
  for (const t of taps.sort((a, b) => a - b)) {
    out.push(Math.round(out.length ? Math.max(t, out[out.length - 1] + 45) : Math.max(0, t)));
  }
  return out;
}

/**
 * Les frappes du bot pour un geste de rythme.
 *
 * @param adresse de 0 à 1 : de la frappe au hasard à la frappe juste
 * @param mods    les modificateurs de son Fanzzy, pour la pulsation affichée
 * @param motif   le motif d'écho du moment
 */
export function frappesDuBot(geste, adresse = 0.4, mods = {}, motif = 0) {
  const a = Math.min(1, Math.max(0, Number(adresse) || 0));
  const ecart = 60 + (1 - a) * 640;
  const j = (f = 1) => bruit() * ecart * f;
  const cfg = resoudreGeste(mods, { motif })[geste] ?? resoudreGeste(mods).tempo;
  switch (geste) {
    case 'contretemps':
      return humain(Array.from({ length: cfg.beats }, (_, i) => (i + 0.5) * cfg.interval + j()));
    case 'echo':
    case 'crescendo':
      return humain(cfg.instants.map((t) => t + j()));
    case 'mash': {
      const n = Math.max(1, Math.round(cfg.target * (0.45 + 0.6 * a + bruit() * 0.08)));
      const pas = cfg.ms / (n + 0.5);
      return humain(Array.from({ length: n }, (_, i) => i * pas + bruit() * 40));
    }
    case 'hold':
      return [0, Math.round(GESTURES.hold.need * Math.min(1, 0.55 + 0.45 * a + bruit() * 0.1))];
    case 'relance':
      return [0, Math.round(cfg.attente + j(1.5))];
    case 'tenue':
      return [0, Math.round(cfg.limite * (0.6 + 0.35 * a) + j(1.5))];
    case 'retenue': {
      const n = Math.max(0, Math.round(cfg.exact + bruit() * ecart / 25));
      const pas = cfg.ms / (n + 1);
      return humain(Array.from({ length: n }, (_, i) => (i + 1) * pas + bruit() * 30));
    }
    case 'salves': {
      const t = [];
      let x = 0;
      for (let r = 0; r < cfg.rafales; r++) {
        for (let k = 0; k < cfg.parRafale; k++) { t.push(x + j(0.3)); x += 120; }
        x += cfg.silence - 120 + j(1.5);
      }
      return humain(t);
    }
    default:
      // Le tempo, et le repli pour un geste qu'il ne sait pas faire.
      return humain(Array.from({ length: cfg.beats }, (_, i) => i * cfg.interval + j()));
  }
}

/** Le chant du bot : au hasard, parmi ceux de son répertoire qu'il sait taper. */
export function chantDuBot(offre) {
  const siens = offre.filter((id) => GESTES_DU_BOT.has(CHANTS[id]?.gest));
  const choix = siens.length ? siens : offre;
  return choix[Math.floor(Math.random() * choix.length)];
}

/**
 * L'adresse d'un bot d'entraînement : tirée entre `min` et `min + plage`.
 *
 * Réglée sur la simulation pour qu'un débutant le batte à peu près six fois
 * sur dix (choix de Gaël, 27 octobre 2026) : assez pour gagner en
 * apprenant, pas assez pour gagner sans rien faire.
 */
export const ADRESSE_BOT = Object.freeze({ min: 0, plage: 0.25 });
export const adresseDuBot = () => ADRESSE_BOT.min + Math.random() * ADRESSE_BOT.plage;
