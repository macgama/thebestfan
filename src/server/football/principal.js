/**
 * **Le club principal et la sélection principale.**
 *
 * Choix de Gaël du 28 octobre 2026 : le club principal se change, **une fois
 * par saison** ; et à côté de lui, une **sélection nationale principale**.
 * Pas de principal par compétition : le principal dit le vrai fan, et c'est
 * lui que le PLEIN CLUB récompense (`shared/fanzzy/clubs.js`). Un principal
 * qui se changerait avant chaque match se toucherait partout.
 *
 * Le club principal reste `user_follows.is_main`, que quinze requêtes lisent
 * déjà ; la sélection est `is_main_nation` (sql/principal.sql). Le dernier
 * changement de chacun est retenu sur la bourse, sous la clé de la saison où
 * il a eu lieu (`principal_saison`, `selection_saison`) : un retrait suivi
 * d'un nouveau choix compte, sinon retirer son club suffirait à en changer.
 * Le premier choix, au paquet de bienvenue, n'est pas un changement.
 *
 * Sans `sql/principal.sql` appliqué, rien ne casse : on lit le club
 * principal seul, et le bouton répond que le changement n'est pas branché.
 */
import { assurerBourse } from '../bourse.js';
import { saisonEnCours } from '../fanzzy/saisons.js';

export const SORTES = Object.freeze({
  club: { drapeau: 'is_main', colonne: 'principal_saison' },
  selection: { drapeau: 'is_main_nation', colonne: 'selection_saison' },
});

const fail = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });
const absente = (e) => e?.code === 'ER_BAD_FIELD_ERROR';

/**
 * La clé de la saison en cours : son numéro quand une saison est lancée,
 * sinon le trimestre civil — les saisons sont calées dessus (choix de Gaël
 * du 18 octobre 2026), et un serveur sans saison ne doit pas laisser changer
 * à volonté.
 */
export function cleDeSaison(instant = new Date(), saison = undefined) {
  let s = saison;
  if (s === undefined) {
    try { s = saisonEnCours(); } catch { s = null; }
  }
  if (s?.id != null) return `S${s.id}`;
  return `${instant.getUTCFullYear()}-T${Math.floor(instant.getUTCMonth() / 3) + 1}`;
}

/** `{ club, selection }` : les deux principaux d'un joueur, nuls s'il n'en a pas. */
export async function principauxDe(q, userId) {
  if (!userId) return { club: null, selection: null };
  const rangs = await q(
    `SELECT team_id, is_main, is_main_nation FROM user_follows
      WHERE user_id = ? AND (is_main = 1 OR is_main_nation = 1)`, [userId])
    .catch(async (e) => {
      if (!absente(e)) throw e;
      return q(`SELECT team_id, is_main, 0 AS is_main_nation FROM user_follows
        WHERE user_id = ? AND is_main = 1`, [userId]);
    })
    .catch(() => []);
  const de = (k) => rangs.find((r) => Number(r[k]) === 1)?.team_id ?? null;
  return { club: de('is_main'), selection: de('is_main_nation') };
}

/**
 * Faire de `teamId`, déjà suivi, son club principal ou sa sélection
 * principale — la sorte se lit sur `teams.national`.
 *
 * Refus : `onboarding.error.principal_non_suivi` (on ne choisit que parmi ses
 * suivis), `onboarding.error.principal_saison` (déjà changé cette saison),
 * `onboarding.error.principal_absent` (schéma non appliqué).
 */
export async function devenirPrincipal(q, userId, teamId, { cle = cleDeSaison() } = {}) {
  const rang = (await q(
    `SELECT f.is_main, f.is_main_nation, t.national
       FROM user_follows f LEFT JOIN teams t ON t.id = f.team_id
      WHERE f.user_id = ? AND f.team_id = ?`, [userId, teamId])
    .catch((e) => { throw absente(e) ? fail('onboarding.error.principal_absent') : e; }))[0];
  if (!rang) throw fail('onboarding.error.principal_non_suivi');

  const sorte = Number(rang.national) === 1 ? 'selection' : 'club';
  const { drapeau, colonne } = SORTES[sorte];
  if (Number(rang[drapeau]) === 1) return { sorte, deja: true };

  await assurerBourse(q, userId);
  const w = (await q(`SELECT ${colonne} AS saison FROM user_wallet WHERE user_id = ?`, [userId])
    .catch((e) => { throw absente(e) ? fail('onboarding.error.principal_absent') : e; }))[0];
  if (w?.saison === cle) throw fail('onboarding.error.principal_saison', { sorte });

  await q(`UPDATE user_follows SET ${drapeau} = 0 WHERE user_id = ?`, [userId]);
  await q(`UPDATE user_follows SET ${drapeau} = 1 WHERE user_id = ? AND team_id = ?`, [userId, teamId]);
  await q(`UPDATE user_wallet SET ${colonne} = ? WHERE user_id = ?`, [cle, userId]);
  return { sorte, deja: false };
}

/** Ce que le profil affiche : la sorte qui a déjà changé cette saison. */
export async function changementsDeLaSaison(q, userId, cle = cleDeSaison()) {
  const w = (await q(`SELECT principal_saison, selection_saison FROM user_wallet WHERE user_id = ?`,
    [userId]).catch(() => []))[0];
  return { club: w?.principal_saison === cle, selection: w?.selection_saison === cle };
}
