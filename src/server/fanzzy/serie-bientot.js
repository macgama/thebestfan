/**
 * Une série de championnat **pas encore ouverte** : quand, et avec quel PASS.
 *
 * Demande de Gaël du 8 novembre 2026 : « les fanzzy SU ne seront accessibles
 * que lorsque le PASS 1 sera activé, si on les affiche déjà maintenant, on
 * pourrait croire qu'ils sont déjà disponibles ». Choix de Gaël (option A) :
 * le championnat garde sa marque, mais « BIENTÔT · PASS 1 », des silhouettes
 * à la place des visages, et « Ses Fanzzy arrivent le 1er décembre avec le
 * PASS 1 », qui mène à la page du PASS.
 *
 * La règle est celle du catalogue (`serieOuverte`) : les séries ouvertes sont
 * celles des saisons lancées dans l'administration. Le jour où la saison du
 * PASS se lance, la série s'ouvre et tout apparaît seul.
 *
 * Le numéro et le jour viennent de la saison en préparation qui porte la
 * série (onglet SAISONS de l'admin) ; à défaut, du programme des PASS et du
 * calendrier prévu (`shared/saisons-prevues.js`).
 */

import { serieOuverte } from './catalogue.js';
import { toutesLesSaisons } from './saisons.js';
import { PROGRAMME_DES_PASS, SAISONS_PREVUES } from '../../shared/saisons-prevues.js';

/**
 * `null` si la série est ouverte (ou si rien n'est encore chargé : on ne
 * cache pas ce qu'on ne sait pas fermé), sinon `{ pass, ouvre }` : le numéro
 * du PASS qui l'ouvre et son jour `YYYY-MM-DD`, chacun `null` s'il est
 * inconnu.
 */
export function bientotDeSerie(code) {
  if (!code || serieOuverte(code)) return null;
  let saison = null;
  try {
    saison = toutesLesSaisons()
      .filter((s) => !s.lancee && (s.series ?? []).includes(code))
      .sort((a, b) => a.numero - b.numero)[0] ?? null;
  } catch { /* saisons pas chargées : le programme suffit */ }
  const prog = PROGRAMME_DES_PASS.find((p) => p.championnat?.id === code || p.serie?.id === code);
  const pass = Number.isInteger(saison?.numero) ? saison.numero : (prog?.numero ?? null);
  const ouvre = saison?.ouvre ?? SAISONS_PREVUES.find((s) => s.numero === pass)?.ouvre ?? null;
  return { pass, ouvre };
}
