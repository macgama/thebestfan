/**
 * L'aide : la FAQ, et l'état réel du parcours des premiers pas.
 *
 * ## Ce que ce module refuse de faire
 *
 * **Il ne garde aucune mémoire de ce que le joueur a lu.** Une étape n'est pas
 * « vue », elle est faite ou elle ne l'est pas, et la réponse se calcule à
 * chaque lecture depuis ce que le joueur possède. C'est le choix qui coûte le
 * plus cher en requêtes et qui rapporte le plus :
 *
 *   — rien à remettre à zéro, rien à migrer, rien qui puisse se désynchroniser ;
 *   — un joueur qui ouvre son premier booster voit l'étape cochée en revenant,
 *     sans qu'aucun écran n'ait eu à prévenir l'aide ;
 *   — et surtout, on ne peut pas cocher une étape en cliquant dessus. Un
 *     tutoriel qu'on traverse en appuyant sur « suivant » n'apprend rien : la
 *     seule preuve qu'on a compris, c'est de l'avoir fait.
 *
 * ## Les six signaux
 *
 * Cinq existaient déjà en base ; seul « a ouvert un booster » a demandé une
 * colonne — voir `sql/aide.sql`, qui dit pourquoi les indices qu'on aurait pu
 * deviner à sa place mentent tous les deux.
 *
 * ## Une base incomplète ne fait pas d'erreur
 *
 * Chaque signal est interrogé à part, et une table ou une colonne absente vaut
 * « pas fait » au lieu de lever. C'est la même précaution que pour les saisons
 * et les contenus : un fichier SQL oublié doit se voir sur un écran, pas
 * éteindre une route. Ici la conséquence serait absurde — l'écran d'aide est
 * exactement celui qu'on ouvre quand quelque chose ne va pas.
 */
import express from 'express';
import { faq, etapes, RECOMPENSE } from '../../shared/aide.js';

/**
 * Les codes que MySQL rend quand le schéma n'est pas à jour.
 *
 * `ER_NO_SUCH_TABLE` : le fichier SQL n'a jamais été appliqué.
 * `ER_BAD_FIELD_ERROR` : la table est là, la colonne non — c'est le cas d'une
 * base à jour de tout **sauf** de `sql/aide.sql`, qui est précisément celui
 * qu'on veut traverser sans bruit le jour du déploiement.
 */
const SCHEMA_INCOMPLET = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR']);

/**
 * @param o.fanzzy  le module fanzzy : `recharger(conn, userId)` compte la
 *                  recharge due avant le booster de fin (voir `recompenser`).
 *                  Lu au moment du versement, et non à la construction : une
 *                  suite peut le poser après, comme pour le quotidien.
 */
export function createAide({ pool, requireAuth, fanzzy = null }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /**
   * La porte de la recharge, cherchée au moment du versement.
   *
   * L'injection d'abord. À défaut, `globalThis.fanzzy`, que `server.js` pose
   * dès que le module fanzzy est monté — avant celui-ci : `server.js` ne
   * passe pas encore `fanzzy` à l'aide, et sans ce repli le correctif
   * n'existerait que dans la suite, la production continuant de perdre la
   * recharge. Le jour où `server.js` le passe, le repli ne sert plus.
   */
  const porteRecharge = () => {
    const f = fanzzy ?? globalThis.fanzzy;
    return typeof f?.recharger === 'function' ? f.recharger : null;
  };

  /**
   * **La recharge due, comptée avant de prendre le verrou** — la même
   * précaution que le quotidien (`avantUnBooster`). `recharger` lit
   * l'abonnement (le rythme de la réserve) dans un souvenir de deux minutes,
   * et sans souvenir elle passe par le pool. Sous le verrou, c'est le cas
   * qu'il faut éviter : huit demandes simultanées du même joueur tiennent les
   * huit connexions de la production en attente du verrou, et celle qui le
   * tient n'en trouve plus pour lire l'abonnement — tout le serveur attend
   * cinquante secondes (`ECARTS.md`, fanzzy § 1).
   *
   * Appelée ici sur le pool, hors transaction, elle pose ce souvenir et
   * compte déjà la recharge : son écriture est conditionnelle, elle ne peut
   * pas écraser un débit. Une panne ici n'empêche rien, le versement
   * recompte sous le verrou.
   */
  let prechauffeMuette = false;
  async function prechauffer(recharger, userId) {
    try {
      await recharger(pool, userId);
    } catch (e) {
      if (!prechauffeMuette) {
        prechauffeMuette = true;
        console.error('[aide] recharge préalable impossible, le versement la refera sous '
          + 'le verrou :', e.message);
      }
    }
  }

  /**
   * Une question posée à la base dont la réponse « non » est acceptable.
   *
   * Sans ce filet, un signal sur six suffirait à rendre tout l'écran d'aide
   * indisponible — et il le rendrait indisponible en rendant une erreur, donc
   * au moment où le joueur en a le plus besoin.
   */
  const essai = async (fn, defaut = false) => {
    try { return await fn(); } catch (e) {
      if (SCHEMA_INCOMPLET.has(e?.code)) return defaut;
      throw e;
    }
  };

  /**
   * Le deck compte comme fait quand le joueur l'a **touché**.
   *
   * `premierDeck` en écrit un tout seul à l'ouverture du paquet de bienvenue,
   * avec un unique Fanzzy : si posséder un deck suffisait, l'étape serait cochée
   * avant que le joueur ait vu l'écran, et elle ne lui apprendrait rien.
   *
   * Deux preuves, parce qu'aucune des deux ne suffit seule :
   *
   *   — `maj > cree` dit qu'il a été réenregistré. C'est le cas normal : le
   *     premier écrit pose les deux dates ensemble, chaque sauvegarde ensuite
   *     ne bouge que `maj` ;
   *   — deux Fanzzy ou plus dit qu'il en a placé un. C'est le filet pour le
   *     joueur dont le deck de départ n'a jamais pu s'écrire — le cas est prévu
   *     dans `premierDeck`, qui préfère rendre `null` plutôt que de faire échouer
   *     une ouverture de paquet.
   */
  const deckTouche = (r) => {
    if (!r) return false;
    if (new Date(r.maj).getTime() > new Date(r.cree).getTime()) return true;
    const c = typeof r.contenu === 'string' ? JSON.parse(r.contenu || '{}') : (r.contenu ?? {});
    return Array.isArray(c.fanzzy) && c.fanzzy.length >= 2;
  };

  /** Ce que le joueur a réellement fait, étape par étape. */
  async function faits(userId) {
    const [cartes, paquets, deck, virage, duel] = await Promise.all([
      essai(() => q(
        `SELECT COUNT(*) AS n, COALESCE(MAX(stage), 1) AS age
           FROM user_fanzzy WHERE user_id = ?`, [userId]), [{ n: 0, age: 1 }]),
      essai(() => q(
        `SELECT packs_ouverts AS n FROM user_wallet WHERE user_id = ?`, [userId]),
      [{ n: 0 }]),
      essai(() => q(
        `SELECT contenu, cree, maj FROM user_decks WHERE user_id = ?`, [userId]), []),
      /* `ferveur > 0` et non la simple présence : entrer dans une salle et
         regarder la corde bouger n'est pas pousser, et l'étape dit « pousse ». */
      essai(() => q(
        `SELECT 1 AS oui FROM virage_presence
          WHERE user_id = ? AND ferveur > 0 LIMIT 1`, [userId]), []),
      essai(() => q(
        `SELECT 1 AS oui FROM duel_results WHERE user_id = ? LIMIT 1`, [userId]), []),
    ]);

    return {
      fanzzy: Number(cartes[0]?.n ?? 0) > 0,
      booster: Number(paquets[0]?.n ?? 0) > 0,
      evolution: Number(cartes[0]?.age ?? 1) > 1,
      deck: deckTouche(deck[0]),
      virage: virage.length > 0,
      duel: duel.length > 0,
    };
  }

  /**
   * Le parcours tel que l'écran le reçoit : les textes, et l'état de chacun.
   *
   * `paye` dit si le booster de fin a déjà été versé. La page s'en sert pour
   * savoir si elle doit demander la récompense ou simplement montrer que
   * c'est fini — sans quoi elle la redemanderait à chaque ouverture, et le
   * serveur répondrait « non » sans que personne ne comprenne pourquoi.
   */
  async function parcours(userId) {
    const etat = await faits(userId);
    const liste = etapes().map((e) => ({ ...e, fait: Boolean(etat[e.cle]) }));
    /* Le repli vaut **vrai** et non faux : sans la colonne, aucun versement
       n'est possible, et dire « pas encore payé » ferait afficher une
       récompense que le serveur refuserait ensuite. Mieux vaut ne rien
       promettre que promettre et se dédire. */
    const paye = await essai(async () => Number((await q(
      `SELECT parcours_paye AS p FROM user_wallet WHERE user_id = ?`,
      [userId]))[0]?.p ?? 0) === 1, true);

    /* **Un identifiant, et non la carte.** La page charge déjà le catalogue
       pour dessiner, et le lui renvoyer ici en ferait une seconde copie —
       celle-ci figée au format que l'aide aurait choisi ce jour-là. Le module
       n'a ainsi aucune raison de connaître le catalogue, et la carte dessinée
       est exactement celle des autres écrans.

       Le titulaire d'abord, la plus ancienne ensuite : la première étape parle
       de « ton premier Fanzzy », et montrer celui que le joueur a choisi comme
       avatar est plus juste que d'en montrer un au hasard. */
    const carteId = await essai(async () => {
      const [w] = await q(
        `SELECT active_fanzzy AS id FROM user_wallet WHERE user_id = ?`, [userId]);
      if (w?.id) return String(w.id);
      const [f] = await q(
        `SELECT fanzzy_id AS id FROM user_fanzzy WHERE user_id = ?
          ORDER BY first_at LIMIT 1`, [userId]);
      return f?.id ? String(f.id) : null;
    }, null);

    return {
      etapes: liste,
      faites: liste.filter((e) => e.fait).length,
      total: liste.length,
      recompense: RECOMPENSE,
      paye,
      carteId,
    };
  }

  /**
   * Verser le booster de fin. Une fois, et une seule.
   *
   * **Le serveur recompte les six étapes.** La page en connaît le résultat, et
   * c'est précisément pour ça qu'on ne l'écoute pas : une récompense accordée
   * sur la parole du client s'obtient avec la console du navigateur. C'est la
   * même règle que pour le deck, validé par le serveur et jamais par l'écran.
   *
   * Le drapeau se pose **dans la transaction**, et le `FOR UPDATE` en est la
   * moitié utile : deux onglets ouverts sur l'écran d'aide, c'est deux appels
   * simultanés, et sans verrou les deux liraient « pas encore payé ».
   *
   * **La recharge due entre avant le cadeau**, sous le même verrou : c'est la
   * règle du grand livre (`recompenses.js`, étape 7), et la raison est la
   * même — voir plus bas.
   */
  async function recompenser(userId) {
    const etat = await faits(userId);
    const complet = Object.values(etat).every(Boolean);
    if (!complet) return { verse: false, raison: 'incomplet' };

    /* Sans la porte, on refuse **avant toute écriture**, comme le grand
       livre : verser quand même, ce serait reproduire en silence le défaut
       qu'elle corrige. C'est une faute de câblage, pas un refus à rendre au
       joueur — d'où l'erreur et non une `raison`. */
    const recharger = porteRecharge();
    if (!recharger) {
      throw new Error('aide : verser le booster de fin demande « recharger » '
        + '(fanzzy.recharger) — sans elle, le cadeau effacerait la recharge en attente');
    }
    await prechauffer(recharger, userId);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[w]] = await conn.query(
        `SELECT parcours_paye AS p FROM user_wallet WHERE user_id = ? FOR UPDATE`,
        [userId]);
      if (!w) { await conn.rollback(); return { verse: false, raison: 'sans_bourse' }; }
      if (Number(w.p) === 1) { await conn.rollback(); return { verse: false, raison: 'deja' }; }

      /* **La recharge due d'abord, sur cette connexion.** On croirait que la
         régénération attend simplement que la réserve redescende : non. La
         lecture suivante, voyant la réserve pleine, remet le compte à rebours
         à zéro — un booster offert à 11 sur 12 avec une recharge due
         laisserait le joueur à 12 au lieu de 13, la recharge perdue. Ici,
         sous le `FOR UPDATE`, elle entre dans la transaction : une annulation
         la défait avec le reste.

         Le cadeau entre ensuite, même au-dessus du plafond, et c'est voulu :
         on ne retire pas au joueur ce qu'on vient de lui promettre parce
         qu'il avait rangé ses paquets. C'est un cadeau, pas une réserve plus
         grande — la régénération, elle, attend qu'il redescende. */
      await recharger(conn, userId);
      await conn.query(
        `UPDATE user_wallet SET packs = packs + ?, parcours_paye = 1 WHERE user_id = ?`,
        [RECOMPENSE, userId]);
      await conn.commit();
      return { verse: true, packs: RECOMPENSE };
    } catch (e) {
      await conn.rollback();
      /* Sans `sql/aide.sql`, la colonne n'existe pas : on ne verse rien et on le
         dit, plutôt que de rendre une erreur sur un écran d'aide. */
      if (SCHEMA_INCOMPLET.has(e?.code)) return { verse: false, raison: 'schema' };
      throw e;
    } finally {
      conn.release();
    }
  }

  /* ---------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (!res.headersSent) res.status(400).json({ error: e.code ?? 'aide.error.server' });
  });

  /* Publique, et mise en cache une heure : la FAQ ne dépend d'aucun joueur, et
     quelqu'un qui hésite à s'inscrire doit pouvoir la lire. La durée est la même
     que celle du catalogue — un réglage changé depuis l'administration met donc
     au plus une heure à se voir, ce qui est le prix du cache et non un oubli. */
  router.get('/faq', (_req, res) => {
    res.set('cache-control', 'public, max-age=3600');
    res.json({ rubriques: faq() });
  });

  router.get('/parcours', requireAuth, safe(async (req, res) =>
    res.json(await parcours(req.user.id))));

  router.post('/recompense', requireAuth, safe(async (req, res) => {
    const versement = await recompenser(req.user.id);
    res.json({ ...versement, ...(await parcours(req.user.id)) });
  }));

  return { router, parcours, faits, recompenser };
}
