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
  async function etat(userId) { return etatVia(q, userId); }

  /**
   * Le même, avec un lecteur choisi.
   *
   * Une transaction en cours doit relire par **sa** connexion : le pool lui
   * rendrait l'état d'avant l'écriture, et `accorder` annoncerait « non
   * abonné » à l'instant où il vient de poser la ligne.
   */
  async function etatVia(lire, userId) {
    const defaut = { abonne: false, formule: null, fin: null, source: null };
    if (!userId) return defaut;
    try {
      const [a] = await lire(
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
   *
   * ## `conn` : écrire **dans** la transaction de l'appelant
   *
   * La boutique livre à l'intérieur d'une transaction, et c'est elle qui tient
   * la propriété : si la remise échoue après le débit, le `rollback` défait
   * tout. Écrire par le pool depuis ici sortirait de cette transaction — un
   * abonnement posé survivrait à l'annulation de l'achat qui l'a payé.
   *
   * Et ce n'est pas qu'une question de propreté : la transaction tient un
   * verrou sur la ligne, une écriture par le pool l'attend, et six
   * encaissements simultanés se bloquent les uns les autres jusqu'au
   * `Lock wait timeout`. C'est ce qui est arrivé, et c'est ce qui l'a révélé.
   *
   * Nul par défaut : l'administration, elle, n'a pas de transaction à partager.
   */
  async function accorder(userId, { formule = 'offert', jours = null,
    source = 'admin', reference = null, conn = null } = {}) {
    const ecrire = conn
      ? (sql, params) => conn.query(sql, params).then(([r]) => r)
      : q;

    await ecrire(
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
    /* Relu par la **même** connexion quand il y en a une : hors transaction, le
       pool rendrait l'état d'avant l'écriture qu'on vient de faire. */
    return conn ? etatVia((sql, pp) => conn.query(sql, pp).then(([r]) => r), userId)
      : etat(userId);
  }

  /**
   * Repousser l'échéance d'un abonnement **retrouvé par sa référence**.
   *
   * C'est ce que le prestataire de paiement appelle à chaque facture payée, et
   * une fois de plus à la résiliation. Il ne connaît pas nos joueurs : il
   * connaît l'identifiant de l'abonnement qu'il gère, et c'est ce que
   * `reference` porte depuis le premier jour — la colonne existait pour ça.
   *
   * **La date vient d'en face**, pas de notre calendrier. Stripe sait quand le
   * mois s'arrête ; recopier « trente et un jours » décalerait d'un jour à
   * chaque renouvellement, et le décalage s'accumulerait sans que personne ne
   * le voie avant un an.
   *
   * Une référence inconnue ne lève pas et n'écrit rien : un événement qui
   * concerne un abonnement qu'on n'a jamais posé — un essai de test, un compte
   * supprimé — est une nouvelle sans conséquence, et la rejeter ferait rejouer
   * Stripe indéfiniment.
   */
  async function renouveler(reference, fin) {
    if (!reference) return { touche: 0 };
    try {
      const r = await q(
        'UPDATE abonnements SET fin = ? WHERE reference = ?',
        [fin ?? null, String(reference)]);
      return { touche: r.affectedRows ?? 0 };
    } catch (e) {
      if (e?.code === 'ER_NO_SUCH_TABLE') return { touche: 0 };
      throw e;
    }
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
        /* **Et ce qu'on a sans lui.** L'écran qui propose l'abonnement doit
           écrire « 24 au lieu de 12 » : un chiffre seul ne se compare à rien,
           et « plus de boosters » ne veut rien dire du tout.

           Les deux côtés partent d'ici plutôt que la page ne retienne le
           second. Elle l'avait fait, et elle annonçait « au lieu de 10 » quand
           le réglage en dit douze — une page qui recopie un barème le fait
           mentir au premier ajustement depuis /admin, et personne ne relit une
           page pour vérifier un nombre qu'on croit connaître. */
        sans: {
          packMax: plafondPacks(false),
          packRegenMin: reglage('pack.regen_min'),
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

  return { router, estAbonne, etat, accorder, renouveler, retirer,
    plafondPacks, regenMs, profondeurParcours, profondeurSouvenirs, clubsEnPlus };
}
