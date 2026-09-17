import express from 'express';
import { reglage } from '../../shared/reglages.js';

/**
 * L'abonnement : ce qui distingue un joueur inscrit d'un joueur abonné.
 *
 * ## La règle, et pourquoi elle est écrite ici
 *
 * **On vend de la largeur et du confort, jamais de la puissance.**
 *
 * Deux règles du jeu l'imposaient déjà, chacune de son côté. `deck/index.js` :
 * « un deck entre toujours au premier âge […] l'écart se creuse par ce qu'on
 * joue, pas par ce qu'on a payé ». Et `shared/niveau.js` : « le niveau ne donne
 * aucune puissance ; s'il en avait, l'ancienneté deviendrait de la force et le
 * nouveau venu n'aurait plus de raison de rester ».
 *
 * Un abonnement qui ouvrirait des formats de duel, des âges jouables ou des
 * classements ferait à l'argent exactement ce que ces deux règles refusent au
 * temps. Le classement se mettrait à mesurer la carte bancaire, et un jeu de
 * supporters dont le meilleur est celui qui paie n'a plus grand-chose à
 * raconter.
 *
 * Tous les formats, tous les âges, tous les classements restent donc ouverts à
 * tout le monde. Ce module ne sait ouvrir que quatre choses : le rythme,
 * l'identité, la mémoire et le confort.
 *
 * ## Une seule définition
 *
 * `estAbonne` est la seule réponse à « est-il abonné ». Les modules qui
 * ouvrent quelque chose passent par elle — jamais par une requête à eux. Six
 * requêtes qui lisent la même table finissent par ne plus dire la même chose,
 * et la première à diverger ouvrira à quelqu'un ce qu'une autre lui refuse.
 *
 * ## Sans Stripe
 *
 * Le prestataire n'est pas branché, et ce module ne l'attend pas : un
 * administrateur peut accorder un abonnement, ce qui suffit à ouvrir la bêta et
 * à éprouver les deux côtés du jeu. `source` dit d'où vient la ligne, et le
 * jour où Stripe arrive il écrit ici par le même chemin.
 */
export function createAbonnement({ pool, requireAuth }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /**
   * Est-il abonné **en ce moment** ?
   *
   * `fin` nulle veut dire sans terme — un accès offert par l'administration.
   * La comparaison se fait en SQL et non en JavaScript : `NOW(3)` et
   * `Date.now()` ne vivent pas dans le même fuseau, et ce projet a déjà payé
   * cette confusion sur les horloges de match.
   *
   * Une table absente rend `false` et ne lève pas : le jeu doit tourner sur une
   * base où `sql/abonnement.sql` n'est pas encore appliqué — tout le monde y est
   * simplement joueur inscrit, ce qui est l'état d'avant.
   */
  async function estAbonne(userId) {
    if (!userId) return false;
    try {
      const rows = await q(
        `SELECT 1 FROM abonnements
          WHERE user_id = ? AND (fin IS NULL OR fin > NOW(3)) LIMIT 1`, [userId]);
      return rows.length > 0;
    } catch (e) {
      if (e?.code === 'ER_NO_SUCH_TABLE') return false;
      throw e;
    }
  }

  /** L'état complet, pour l'écran qui le montre. */
  async function etat(userId) {
    const defaut = { abonne: false, formule: null, fin: null, source: null };
    if (!userId) return defaut;
    try {
      const [a] = await q(
        `SELECT formule, debut, fin, source FROM abonnements WHERE user_id = ?`, [userId]);
      if (!a) return defaut;
      const actif = a.fin === null || new Date(a.fin) > new Date();
      return { abonne: actif, formule: a.formule, debut: a.debut, fin: a.fin,
        source: a.source };
    } catch (e) {
      if (e?.code === 'ER_NO_SUCH_TABLE') return defaut;
      throw e;
    }
  }

  /**
   * Accorder ou prolonger.
   *
   * **Un renouvellement pousse `fin` plus loin, il ne la remplace pas.** Sans
   * cela, renouveler trois jours avant l'échéance perdrait ces trois jours — et
   * c'est précisément le moment où l'on renouvelle.
   *
   * `jours` nul veut dire sans terme : c'est ce que pose un administrateur pour
   * un bêta-testeur. Rien ne l'expire, et c'est voulu.
   */
  async function accorder(userId, { formule = 'offert', jours = null,
    source = 'admin', reference = null } = {}) {
    await q(
      `INSERT INTO abonnements (user_id, formule, fin, source, reference)
       VALUES (?, ?, ${jours === null ? 'NULL'
    : 'DATE_ADD(GREATEST(NOW(3), COALESCE(fin, NOW(3))), INTERVAL ? DAY)'}, ?, ?)
       ON DUPLICATE KEY UPDATE
         formule = VALUES(formule), source = VALUES(source),
         reference = VALUES(reference),
         fin = ${jours === null ? 'NULL'
    : 'DATE_ADD(GREATEST(NOW(3), COALESCE(abonnements.fin, NOW(3))), INTERVAL ? DAY)'}`,
      jours === null ? [userId, formule, source, reference]
        : [userId, formule, jours, source, reference, jours]);
    return etat(userId);
  }

  /** Retirer. La ligne part : une échéance au passé dirait la même chose, et il
      faudrait se souvenir de la lire comme telle à chaque requête. */
  async function retirer(userId) {
    await q('DELETE FROM abonnements WHERE user_id = ?', [userId]);
    return etat(userId);
  }

  /* ------------------------------------------------ ce que l'abonnement ouvre

     Chaque porte est **une fonction nommée**, et non un `if (abonne)` recopié
     dans six modules. Le jour où l'une d'elles change de règle, elle change ici
     — et le jour où l'on en ajoute une, on voit d'un coup d'œil ce qui est déjà
     vendu, ce qui évite d'en vendre deux fois la même.

     Les valeurs vivent dans les réglages : elles s'ajustent depuis /admin, sans
     livraison, comme tout le reste du barème. */

  /** Le plafond de boosters en réserve. */
  const plafondPacks = (abonne) => (abonne
    ? reglage('abo.pack_max') : reglage('pack.max'));

  /** Le temps qu'un booster met à revenir. */
  const regenMs = (abonne) => (abonne
    ? reglage('abo.pack_regen_min') : reglage('pack.regen_min')) * 60_000;

  /** Combien de parties le parcours garde en mémoire. `null` = tout. */
  const profondeurParcours = (abonne) => (abonne ? null : reglage('abo.parcours_libre'));

  /** Combien de cartes-souvenirs restent lisibles. `null` = toutes. */
  const profondeurSouvenirs = (abonne) => (abonne ? null : reglage('abo.souvenirs_libres'));

  /** Un emplacement de club en plus, par-dessus ce que le niveau ouvre. */
  const clubsEnPlus = (abonne) => (abonne ? reglage('abo.clubs_en_plus') : 0);

  /* ---------------------------------------------------------------- routes */

  const router = express.Router();

  router.get('/', requireAuth, async (req, res) => {
    try {
      const e = await etat(req.user.id);
      /* Ce que l'abonnement ouvre part **avec** l'état : l'écran qui le propose
         doit pouvoir le dire sans porter sa propre copie du barème, qui
         divergerait au premier réglage changé depuis /admin. */
      res.json({
        ...e,
        ouvre: {
          packMax: plafondPacks(true),
          packRegenMin: reglage('abo.pack_regen_min'),
          clubsEnPlus: reglage('abo.clubs_en_plus'),
          parcoursLibre: reglage('abo.parcours_libre'),
          souvenirsLibres: reglage('abo.souvenirs_libres'),
        },
        /* Et ce dont il ne décide pas. La liste est courte et elle est là pour
           être lue : c'est la promesse du jeu, et un joueur qui hésite à
           s'abonner doit pouvoir vérifier qu'il ne lui manque rien pour jouer. */
        libre: ['tous les formats de duel', 'tous les âges des Fanzzy',
          'tous les classements', 'le Grand Virage'],
      });
    } catch (e) {
      console.error('[abonnement]', e.message);
      res.status(503).json({ error: 'abo.error.unavailable' });
    }
  });

  return { router, estAbonne, etat, accorder, retirer,
    plafondPacks, regenMs, profondeurParcours, profondeurSouvenirs, clubsEnPlus };
}
