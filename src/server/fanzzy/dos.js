/**
 * Le dos d'une carte : la série à laquelle elle appartient, ou aucune.
 * ====================================================================
 *
 * **Demande de Gaël du 3 novembre 2026** : « les dos des cartes ne
 * correspondent pas forcément à leur série ». Le booster posait le dos du
 * sachet sur ses cinq cartes, et le paquet de bienvenue celui de son premier
 * Fanzzy : une pièce d'équipement commune, une poignée d'écharpes ou le
 * second Fanzzy d'une autre série se retournaient sur un dos qui n'était pas
 * le leur. Chaque carte porte maintenant **le dos de sa propre série**, et
 * celles qui n'en ont pas un dos à part, le dos neutre
 * (`public/img/dos/NEUTRE.*`).
 *
 * D'où vient la série :
 *  - un Fanzzy, sa fiche ;
 *  - une tenue, un état, une carte Ultimate : le Fanzzy qu'ils habillent ;
 *  - une pièce, une carte d'action, un stade : la série posée par Gaël dans
 *    CATALOGUE › CONTENUS (`donnees.serie`), sinon le préfixe de leur
 *    identifiant (`rp-gourde`, `a-rp-filet`), la même règle que le rangement
 *    du menu PASS de l'administration ;
 *  - une poignée d'écharpes : aucune.
 */
import { SETS } from '../../shared/fanzzy/dex.js';
import { parIdentifiant } from './catalogue.js';
import { tous as tousLesContenus } from '../contenus/index.js';

const FAMILLE_DE = { stuff: 'stuff', action: 'action', lieu: 'stade' };

const connue = (code) => {
  const c = code ? String(code).toUpperCase() : null;
  return c && SETS.some((s) => s.id === c) ? c : null;
};

/** La série d'un identifiant d'objet par son préfixe, `a-` des actions sauté. */
function serieDuPrefixe(id) {
  const morceaux = String(id ?? '').split('-');
  if (morceaux[0] === 'a') morceaux.shift();
  return morceaux.length > 1 ? connue(morceaux[0]) : null;
}

/** Le Fanzzy d'un identifiant, sans jamais lever (catalogue non chargé). */
function fanzzy(id) {
  try { return parIdentifiant(id); } catch { return null; }
}

/**
 * Le code de série du dos d'une carte de booster ou de bienvenue, ou `null`
 * pour le dos neutre.
 */
export function serieDuDos(c) {
  switch (c?.type) {
    case 'fanzzy': return connue(c.set ?? fanzzy(c.id)?.set);
    case 'skin': case 'etat': return connue(fanzzy(c.pour)?.set);
    case 'stuff': case 'action': case 'lieu': {
      const o = tousLesContenus(FAMILLE_DE[c.type]).find((x) => x.id === c.id);
      return connue(o?.serie) ?? serieDuPrefixe(c.id);
    }
    default: return null;
  }
}

/** Pose `dos` sur chaque carte : le code de sa série, ou `null`. */
export function poserLesDos(cartes) {
  for (const c of cartes) c.dos = serieDuDos(c);
  return cartes;
}
