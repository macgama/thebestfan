import express from 'express';
import { XP, niveauPour, progression, droits, paliersEntre, ecarpesDuPalier, NIVEAU_MAX }
  from '../../shared/niveau.js';

/**
 * Le niveau, côté serveur.
 *
 * Deux responsabilités, et une seule porte pour chacune :
 *
 * **Créditer.** `gagner()` est le seul endroit qui ajoute de l'XP. Les modules
 * qui en produisent — les boosters, les duels — l'appellent et n'écrivent
 * jamais la colonne eux-mêmes. Sans ce passage obligé, la montée de palier
 * serait détectée à trois endroits différents, et un jour à deux seulement.
 *
 * **Autoriser.** `droitsDe()` répond « ce joueur a-t-il le droit ». Les séries,
 * les slots d'équipe et les emplacements de deck passent par là plutôt que de
 * refaire chacun sa comparaison de niveau.
 *
 * **Un gain d'XP ne fait jamais échouer ce qui l'a produit.** Un booster ouvert
 * reste ouvert même si la bourse n'a pas pu être créditée : les cartes sont
 * déjà dans la collection, et rendre une erreur au joueur pour une barre de
 * progression serait absurde. On journalise et on continue — c'est la même
 * règle que pour les écharpes de fin de duel.
 */
export function createNiveau({ pool, requireAuth }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /**
   * Ajoute de l'XP et rend ce qui a changé.
   *
   * `montant` est calculé par l'appelant à partir de `XP` : c'est lui qui sait
   * s'il s'agit d'un booster, d'un entraînement ou d'une victoire.
   *
   * @returns {{xp:number, niveau:number, avant:number, monte:boolean,
   *            paliers:Array, ecarpes:number}}
   */
  async function gagner(userId, montant) {
    const n = Math.max(0, Math.round(Number(montant) || 0));
    const vide = { xp: 0, niveau: 1, avant: 1, monte: false, paliers: [], ecarpes: 0 };
    if (!n) return vide;

    try {
      await q(`INSERT IGNORE INTO user_wallet (user_id) VALUES (?)`, [userId]);
      const avantXp = (await q(
        `SELECT xp FROM user_wallet WHERE user_id = ?`, [userId]))[0]?.xp ?? 0;
      const apresXp = Number(avantXp) + n;

      const avant = niveauPour(avantXp);
      const apres = niveauPour(apresXp);
      const paliers = paliersEntre(avant, apres);

      /* Les écharpes de palier se versent dans la même requête que l'XP.
         Séparées, un incident entre les deux laisserait un joueur monté de
         niveau sans sa récompense — et rien pour s'en apercevoir, puisque le
         palier ne se franchit qu'une fois. */
      let ecarpes = 0;
      for (let k = avant + 1; k <= apres; k++) ecarpes += ecarpesDuPalier(k);

      await q(
        `UPDATE user_wallet SET xp = xp + ?, scarves = scarves + ? WHERE user_id = ?`,
        [n, ecarpes, userId]);

      return { xp: apresXp, niveau: apres, avant, monte: apres > avant, paliers, ecarpes };
    } catch (e) {
      // Une colonne absente ne doit pas casser l'ouverture d'un booster : le
      // message nomme le fichier à appliquer, ce que « Unknown column 'xp' »
      // ne fait pas.
      if (/Unknown column|doesn't exist/i.test(e.message ?? '')) {
        console.error('[niveau] schéma incomplet — applique sql/niveau.sql :', e.message);
      } else {
        console.error('[niveau]', e.message);
      }
      return vide;
    }
  }

  /** L'XP d'un joueur, sans lever si la colonne n'existe pas encore. */
  /**
   * L'XP d'un joueur, ou `null` si la colonne est **illisible**.
   *
   * La nuance compte, et elle a coûté cher : renvoyer zéro dans les deux cas
   * confondait « nouveau joueur » et « migration pas appliquée ».
   */
  let deja = false;
  async function xpDe(userId) {
    try {
      const r = await q(`SELECT xp FROM user_wallet WHERE user_id = ?`, [userId]);
      return Number(r[0]?.xp ?? 0);
    } catch (e) {
      // Une fois, pas à chaque requête : ce message doit rester lisible dans
      // un journal, pas le noyer.
      if (!deja) {
        deja = true;
        console.error('[niveau] colonne xp illisible — applique sql/niveau.sql. '
          + 'En attendant, tous les déblocages sont ouverts : ' + e.message);
      }
      return null;
    }
  }

  /**
   * Ce que ce joueur a le droit de faire.
   *
   * Les modules qui limitent — kiosque, clubs suivis, deck — passent par ici.
   * Refaire la comparaison de niveau chacun de son côté, c'est se garantir que
   * deux d'entre eux finiront par ne plus dire la même chose.
   */
  async function droitsDe(userId) {
    const xp = await xpDe(userId);

    /* **Une progression illisible n'enlève rien.**
     *
     * C'est la règle, et elle vient d'une vraie panne. Sans la colonne `xp`,
     * la version d'avant lisait zéro, en concluait « niveau 1 », et
     * *confisquait* : plus qu'une série au kiosque, deux emplacements de deck,
     * deux clubs. Le jeu se refermait sur tout le monde parce qu'un `ALTER
     * TABLE` n'avait pas été joué — sans erreur, sans message, avec des refus
     * parfaitement polis.
     *
     * Un schéma incomplet est une faute d'exploitation. Elle doit être bruyante
     * dans les journaux et **invisible pour le joueur**, jamais l'inverse. On
     * ouvre donc tout, et le journal dit quoi appliquer.
     */
    if (xp === null) {
      return { xp: 0, ...progression(0), ...droits(NIVEAU_MAX), indisponible: true };
    }

    return { xp, ...progression(xp), ...droits(niveauPour(xp)) };
  }

  /* -------------------------------------------------------------- routes */

  const router = express.Router();

  router.get('/', requireAuth, async (req, res) => {
    const d = await droitsDe(req.user.id);
    res.json({
      xp: d.xp,
      niveau: d.niveau,
      dans: d.dans,
      pour: d.pour,
      part: d.part,
      max: d.max,
      niveauMax: NIVEAU_MAX,
      // Des tableaux, pas des `Set` : ceci part en JSON.
      series: [...d.series],
      slots: d.slots,
      deckFanzzy: d.deckFanzzy,
      // Ce que rapporte chaque geste, pour que l'écran puisse l'annoncer sans
      // recopier le barème — une copie qui divergerait au premier réglage.
      gains: XP,
    });
  });

  return { router, gagner, xpDe, droitsDe };
}
