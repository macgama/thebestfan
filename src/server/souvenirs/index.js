import express from 'express';

/**
 * Cartes-souvenirs.
 *
 * Un but réel frappe une carte. Ceux qui poussaient dans le Grand Virage au
 * moment où le serveur a vu ce but en reçoivent la version « présence » :
 * nominative, incessible, teintée du Fanzzy qu'ils portaient. Les autres
 * peuvent en acheter la « vignette » en écharpes, pendant quinze jours.
 *
 * Les deux montrent la même image. Une seule prouve quelque chose.
 */

export const PRESENCE_WINDOW_MS = 2 * 60 * 1000;   // avoir poussé dans les 2 minutes
export const MARKET_DAYS = 15;

/** Prix d'une vignette, en écharpes. Une finale vaut plus qu'un match de poule. */
const PRICE = { championnat: 60, coupe: 90, international: 140, amical: 30 };

/**
 * Combien de temps la présence s'écrit sans les chants, après avoir trouvé
 * leurs colonnes absentes. Voir `recordPush`.
 */
export const REPLI_CHANTS_MS = 10 * 60_000;

export function createSouvenirs({ pool, requireAuth,
  /* L'abonnement ouvre la **mémoire longue** : un joueur inscrit voit ses
     vingt dernières cartes, un abonné les voit toutes. Rien n’est effacé —
     c’est la lecture qui s’arrête, et elle rouvre entièrement dès
     l’abonnement. Voir `abonnement/index.js`. */
  abonnement = null,
  /* L'horloge du repli des chants, et elle seule. Une suite l'avance de dix
     minutes pour éprouver la reprise sans attendre dix minutes ni remonter
     le module — c'est précisément ce que la production ne fait pas. */
  horloge = Date.now }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /* ------------------------------------------------------- présence */

  /* Les trois formes de l'écriture de présence, de la plus riche à la plus
     nue : celle des arènes (`sql/arenes.sql`, qui suppose le quotidien),
     celle du quotidien (`sql/quotidien.sql`), et celle d'avant les deux, mot
     pour mot. Le repli descend de l'une à l'autre : voir `recordPush`.

     **Dans la forme des arènes, le chant s'écrit avant la note.** Un `ON
     DUPLICATE KEY UPDATE` s'évalue de gauche à droite sur MariaDB : la note
     écrite d'abord, la comparaison du chant lirait la nouvelle note contre
     elle-même, et le meilleur chant ne changerait plus jamais après le
     premier — sans une erreur (`SERVEUR-VAGUE2.md`, règle 15).

     `meilleur_chant IS NULL` le pose aussi quand la ligne n'en a pas encore :
     une ligne ouverte par une carte (note 0, pas de chant), puis un chant noté
     0, garderait sinon un meilleur geste vide sur un match où l'on a chanté.
     `COALESCE` : une carte ne l'efface jamais. */
  const PRESENCE_ARENES = `INSERT INTO virage_presence (user_id, fixture_id, side, team_id, fanzzy_id,
                                    ferveur, classe, chants, chants_mt1, chants_mt2,
                                    parfaits, serie_max, meilleur_q, meilleur_chant)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ferveur = ferveur + VALUES(ferveur),
         fanzzy_id = VALUES(fanzzy_id),
         chants = chants + VALUES(chants),
         chants_mt1 = chants_mt1 + VALUES(chants_mt1),
         chants_mt2 = chants_mt2 + VALUES(chants_mt2),
         parfaits = parfaits + VALUES(parfaits),
         serie_max = GREATEST(serie_max, VALUES(serie_max)),
         meilleur_chant = IF(VALUES(meilleur_q) > meilleur_q OR meilleur_chant IS NULL,
                             COALESCE(VALUES(meilleur_chant), meilleur_chant), meilleur_chant),
         meilleur_q = GREATEST(meilleur_q, VALUES(meilleur_q)),
         last_push_at = NOW(3)`;
  const PRESENCE = `INSERT INTO virage_presence (user_id, fixture_id, side, team_id, fanzzy_id,
                                    ferveur, classe, chants, chants_mt1, chants_mt2)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ferveur = ferveur + VALUES(ferveur),
         fanzzy_id = VALUES(fanzzy_id),
         chants = chants + VALUES(chants),
         chants_mt1 = chants_mt1 + VALUES(chants_mt1),
         chants_mt2 = chants_mt2 + VALUES(chants_mt2),
         last_push_at = NOW(3)`;
  const PRESENCE_SANS_CHANTS = `INSERT INTO virage_presence (user_id, fixture_id, side, team_id, fanzzy_id,
                                    ferveur, classe)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ferveur = ferveur + VALUES(ferveur),
         fanzzy_id = VALUES(fanzzy_id),
         last_push_at = NOW(3)`;

  /* Les formes, dans l'ordre où le repli les essaie, et ce que le journal dit
     quand on doit s'y arrêter ou qu'on en remonte. */
  const FORMES = [
    { sql: PRESENCE_ARENES },
    { sql: PRESENCE,
      perte: 'PARFAITS, série et meilleur geste du Virage non comptés',
      fichier: 'sql/arenes.sql',
      retour: 'les PARFAITS, la série et le meilleur geste du Virage se comptent de nouveau '
        + '(colonnes de sql/arenes.sql trouvées)' },
    { sql: PRESENCE_SANS_CHANTS,
      perte: 'chants du Virage non comptés',
      fichier: 'sql/quotidien.sql',
      retour: 'les chants du Virage se comptent de nouveau (colonnes de sql/quotidien.sql trouvées)' },
  ];

  /* L'état du repli : la forme par laquelle commencer, jusqu'à quand (passé
     ce délai, on retente la plus riche), et ce que le journal a déjà dit. */
  let forme = 0;
  let repliJusqua = 0;
  const dits = new Set();

  /**
   * Enregistre une poussée dans le Grand Virage.
   * Appelée par la couche temps réel à chaque contribution, pas par le client.
   */
  /**
   * @param {boolean} [classe] ce Virage compte-t-il au classement ?
   *
   * **Écrit à l'insertion et jamais mis à jour.** La décision se prend une
   * fois, à l'entrée dans la tribune, et ne doit plus bouger : sans quoi un
   * match commencé « compté » cesserait de l'être au milieu, parce qu'on a
   * ouvert un autre onglet entre-temps. C'est la raison pour laquelle
   * `classe` est absent de la clause `ON DUPLICATE KEY UPDATE`, et c'est
   * voulu — ce n'est pas un oubli à corriger.
   *
   * @param {number} [chant] 1 si la poussée est un chant, 0 pour une carte.
   * @param {number} [mt] la mi-temps du vrai match : 1, 2, ou 0 hors des deux.
   *
   * ## Les chants, dans l'écriture qui existe
   *
   * Les missions du Virage comptent des chants (`chants`), et la mission « dans
   * chaque mi-temps » les compte par moitié (`chants_mt1`, `chants_mt2`). Ils
   * s'ajoutent **dans le même upsert** que la présence : une poussée reste une
   * instruction, et une tribune de mille ne paie pas une écriture de plus à
   * chaque chant. Une ligne par match, comme avant : c'est le module des
   * missions qui la rattache au jour de jeu du coup d'envoi, pas celui-ci.
   *
   * ## Le repli, et pourquoi il expire
   *
   * Les colonnes viennent de `sql/quotidien.sql`. Sur une base qui ne l'a pas
   * encore, l'instruction complète lève `ER_BAD_FIELD_ERROR` : **la présence
   * ne doit jamais se perdre pour un compteur** — elle porte les
   * cartes-souvenirs et le classement de ferveur. On rejoue donc aussitôt
   * l'instruction d'avant, on le dit une fois au journal, et l'on écrit sans
   * les chants pendant dix minutes.
   *
   * Dix minutes, et non la vie du processus. Après un passage par le Manager,
   * on applique le schéma (`npm run schema:appliquer`) sur un processus déjà
   * démarré : un repli définitif ne compterait alors plus jamais un chant
   * jusqu'au prochain redémarrage, et les missions du Virage resteraient à
   * zéro sans un mot.
   *
   * ## Trois formes, et non plus deux
   *
   * `sql/arenes.sql` (le bilan de tribune, vague 2) ajoute les PARFAITS, la
   * meilleure série et le meilleur geste. **Une colonne des arènes absente ne
   * doit pas faire perdre le compte des chants**, que les missions lisent :
   * `ER_BAD_FIELD_ERROR` sur la forme des arènes retente celle du quotidien,
   * puis la nue. On s'arrête sur la première qui passe, pour dix minutes ; le
   * journal dit une fois ce qui ne se compte plus, et quel fichier appliquer,
   * puis dit la reprise quand une forme plus riche repasse. Au pire, deux
   * instructions en échec toutes les dix minutes, sur une base qui n'a ni
   * l'un ni l'autre fichier ; jamais plus.
   *
   * @param {number} [parfait] 1 si le chant est un PARFAIT (`verdict.js`).
   * @param {number} [serie] la meilleure série de PARFAIT de la salle ; la
   *   base garde la plus grande.
   * @param {number} [q] la note du verdict en millièmes (0 pour une carte).
   * @param {string|null} [chantId] le chant de cette note (nul pour une carte).
   */
  async function recordPush({ userId, fixtureId, side, teamId = null, fanzzyId,
                              amount, classe = true, chant = 0, mt = 0,
                              parfait = 0, serie = 0, q: note = 0, chantId = null }) {
    const presence = [userId, fixtureId, side ? 1 : 0, teamId ?? null, fanzzyId ?? null,
      Math.max(0, Math.round(amount ?? 0)), classe === false ? 0 : 1];
    /* Une carte n'est pas un chant, et une mi-temps ne se compte que pour un
       chant : la salle transporte la mi-temps de toute poussée. De même, une
       carte n'est ni un PARFAIT ni un geste noté. */
    const c = chant ? 1 : 0;
    const chants = [c, c && mt === 1 ? 1 : 0, c && mt === 2 ? 1 : 0];
    const arenes = [c && parfait ? 1 : 0, entier(serie, 65535),
      c ? entier(note, 1200) : 0, c && chantId ? String(chantId).slice(0, 24) : null];
    const valeurs = [[...presence, ...chants, ...arenes], [...presence, ...chants], presence];

    const debut = horloge() >= repliJusqua ? 0 : forme;
    for (let k = debut; k < FORMES.length; k++) {
      try {
        await q(FORMES[k].sql, valeurs[k]);
      } catch (e) {
        /* La dernière forme ne se replie sur rien : une colonne qu'elle n'a
           pas est une panne, et elle remonte comme avant. */
        if (e?.code !== 'ER_BAD_FIELD_ERROR' || k === FORMES.length - 1) throw e;
        continue;
      }
      /* Une forme plus riche que la dernière repasse : on le dit, pour
         chaque étage regagné. */
      for (let j = forme; j > k; j--) console.warn(`[souvenirs] ${FORMES[j].retour}`);
      /* Ce qui ne se compte pas, une fois par étage et par processus. */
      for (let j = 1; j <= k; j++) {
        if (dits.has(j)) continue;
        dits.add(j);
        console.warn(`[souvenirs] ${FORMES[j].perte} — appliquer ${FORMES[j].fichier} `
          + '(npm run schema:appliquer). La présence s’écrit sans eux, et le comptage '
          + 'se retente toutes les dix minutes.');
      }
      /* On a dû descendre depuis la forme essayée en premier : on s'y tient
         dix minutes. Revenu à la plus riche, plus de repli. */
      if (k > debut) repliJusqua = horloge() + REPLI_CHANTS_MS;
      else if (k === 0) repliJusqua = 0;
      forme = k;
      return;
    }
  }

  /** Un entier borné, jamais `NaN` : il part dans une colonne non signée. */
  function entier(v, max) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
  }

  /* ---------------------------------------------------------- frappe */

  /**
   * Frappe la carte d'un but et la distribue aux présents.
   * Idempotent : rejouer le même but ne crée ni doublon ni seconde
   * distribution, ce qui compte parce que le worker peut relire un match.
   */
  async function mintGoal(goal) {
    const family = (await q(
      `SELECT family FROM souvenir_leagues WHERE league_id = ? AND enabled = 1 LIMIT 1`,
      [goal.leagueId],
    ))[0]?.family;

    // Compétition non couverte ou désactivée : pas de carte, et c'est voulu.
    if (!family) return { minted: false, reason: 'league_not_eligible', userIds: [] };

    const price = PRICE[family] ?? 60;
    const expires = new Date(Date.now() + MARKET_DAYS * 864e5);

    const res = await q(
      `INSERT IGNORE INTO souvenirs
        (fixture_id, seq, league_id, family, scorer_team, home_id, away_id,
         minute, player, score_home, score_away, kickoff_at, expires_at, price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [goal.fixtureId, goal.seq, goal.leagueId, family, goal.teamId, goal.homeId, goal.awayId,
       goal.minute ?? null, goal.player ?? null, goal.scoreHome ?? 0, goal.scoreAway ?? 0,
       goal.kickoffAt, expires, price],
    );

    if (!res.affectedRows) return { minted: false, reason: 'already_minted', userIds: [] };

    const souvenirId = res.insertId;

    // Les présents : ceux qui ont poussé dans les deux minutes précédentes.
    // Laisser son téléphone ouvert ne suffit pas, il faut avoir chanté.
    const presents = await q(
      `SELECT user_id, fanzzy_id, ferveur FROM virage_presence
        WHERE fixture_id = ? AND last_push_at > (NOW(3) - INTERVAL ? SECOND)`,
      [goal.fixtureId, Math.floor(PRESENCE_WINDOW_MS / 1000)],
    );

    if (presents.length) {
      await pool.query(
        `INSERT IGNORE INTO user_souvenirs (user_id, souvenir_id, kind, fanzzy_id, ferveur)
         VALUES ?`,
        [presents.map((p) => [p.user_id, souvenirId, 'presence', p.fanzzy_id, p.ferveur])],
      );
    }
    /* **Les receveurs, nommés** (`userIds`, défaut D5). La page annonçait la
       carte à chaque but de son club — « Elle est dans ton carnet » — alors
       qu'elle n'est frappée que pour une compétition couverte, et donnée qu'à
       ceux qui ont poussé dans la fenêtre. Le Virage ne l'annonce plus qu'à
       ces joueurs-là (`souvenirFrappe`, `ferveur/index.js`), et c'est
       `server.js` qui fait le lien : ce nom exact est leur point de contact.

       Tous ceux de la fenêtre l'ont reçue : la carte vient d'être frappée
       (`affectedRows` ci-dessus), personne ne pouvait déjà l'avoir. */
    const userIds = [...new Set(presents.map((p) => String(p.user_id)))];
    return { minted: true, souvenirId, presents: presents.length, userIds, family, price };
  }

  /* --------------------------------------------------------- lecture */

  const CARD = `s.id, s.fixture_id, s.seq, s.league_id, s.family, s.minute, s.player,
                s.score_home, s.score_away, s.kickoff_at, s.expires_at, s.price,
                s.scorer_team, s.home_id, s.away_id,
                h.name AS home_name, h.logo AS home_logo,
                a.name AS away_name, a.logo AS away_logo,
                l.name AS league_name`;
  const JOINS = `FROM souvenirs s
                 JOIN teams h ON h.id = s.home_id
                 JOIN teams a ON a.id = s.away_id
                 LEFT JOIN leagues l ON l.id = s.league_id`;

  /**
   * Les cartes-souvenirs du joueur, les plus récentes d’abord.
   *
   * **La vitrine est plus courte sans abonnement, la collection est la
   * même.** Aucune carte n’est effacée ni reprise : la lecture s’arrête aux
   * vingt dernières, et elle rouvre entièrement le jour de l’abonnement.
   * C’est la règle de ce jeu — « fermer, c’est cesser de distribuer » — et
   * reprendre un souvenir vécu serait exactement ce qu’il refuse.
   *
   * `profondeur` nulle veut dire « tout » : c’est ce que rend un abonnement,
   * et c’est aussi ce qu’on obtient sans module d’abonnement monté — donc le
   * comportement d’avant, inchangé.
   */
  async function collection(userId) {
    const abonne = abonnement ? await abonnement.estAbonne(userId) : true;
    const profondeur = abonnement ? abonnement.profondeurSouvenirs(abonne) : null;
    const rows = await q(
      `SELECT ${CARD}, us.kind, us.fanzzy_id, us.ferveur, us.acquired_at
         ${JOINS}
         JOIN user_souvenirs us ON us.souvenir_id = s.id
        WHERE us.user_id = ?
        ORDER BY s.kickoff_at DESC, s.seq`,
      [userId],
    );
    return profondeur === null ? rows : rows.slice(0, profondeur);
  }

  /** Combien il en a vraiment, quelle que soit la profondeur lue. Sans ce
      nombre, l’écran ne pourrait pas dire « et 34 autres, avec
      l’abonnement » — il ne verrait que ce qu’on lui a montré. */
  async function combien(userId) {
    const [r] = await q(
      'SELECT COUNT(*) AS n FROM user_souvenirs WHERE user_id = ?', [userId]);
    return Number(r?.n ?? 0);
  }

  /** Le marché : quinze jours, et seulement ce que le joueur n'a pas déjà. */
  async function market(userId, { teamId, family, limit = 40 } = {}) {
    return q(
      `SELECT ${CARD}
         ${JOINS}
        WHERE s.expires_at > UTC_TIMESTAMP(3)
          AND NOT EXISTS (SELECT 1 FROM user_souvenirs us
                           WHERE us.souvenir_id = s.id AND us.user_id = ?)
          ${teamId ? 'AND (s.home_id = ? OR s.away_id = ?)' : ''}
          ${family ? 'AND s.family = ?' : ''}
        ORDER BY s.seen_at DESC
        LIMIT ${Number(limit) || 40}`,
      teamId && family ? [userId, teamId, teamId, family]
        : teamId ? [userId, teamId, teamId]
        : family ? [userId, family]
        : [userId],
    );
  }

  /* ----------------------------------------------------------- achat */

  async function buy(userId, souvenirId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[s]] = await conn.query(
        `SELECT id, price, expires_at FROM souvenirs WHERE id = ? FOR UPDATE`, [souvenirId]);
      if (!s) throw Object.assign(new Error(), { code: 'souvenir.error.unknown' });
      if (new Date(s.expires_at) < new Date()) {
        throw Object.assign(new Error(), { code: 'souvenir.error.expired' });
      }

      const [[owned]] = await conn.query(
        `SELECT kind FROM user_souvenirs WHERE user_id = ? AND souvenir_id = ?`,
        [userId, souvenirId]);
      if (owned) throw Object.assign(new Error(), { code: 'souvenir.error.already_owned' });

      // Les écharpes vivent dans la collection Fanzzy. On les débite d'abord,
      // et la ligne n'est écrite que si le débit a réussi : sans transaction,
      // deux achats simultanés videraient le compte deux fois.
      const [deb] = await conn.query(
        `UPDATE user_wallet SET scarves = scarves - ? WHERE user_id = ? AND scarves >= ?`,
        [s.price, userId, s.price]);
      if (!deb.affectedRows) throw Object.assign(new Error(), { code: 'souvenir.error.not_enough_scarves' });

      await conn.query(
        `INSERT INTO user_souvenirs (user_id, souvenir_id, kind) VALUES (?, ?, 'vignette')`,
        [userId, souvenirId]);

      await conn.commit();
      return { ok: true, spent: s.price };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /* ---------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));

  router.get('/mine', requireAuth, async (req, res) => {
    const [souvenirs, total] = await Promise.all([
      collection(req.user.id), combien(req.user.id),
    ]);
    /* `total` dit ce qu’il possède, `souvenirs` ce qu’on lui montre. Les deux
       ensemble permettent à l’écran d’annoncer ce que l’abonnement rouvre,
       sans jamais laisser croire que des cartes ont disparu. */
    res.json({ souvenirs, total, tronque: total > souvenirs.length });
  });

  router.get('/market', requireAuth, async (req, res) => {
    res.json({
      souvenirs: await market(req.user.id, {
        teamId: req.query.teamId ? Number(req.query.teamId) : null,
        family: req.query.family ?? null,
      }),
      windowDays: MARKET_DAYS,
    });
  });

  router.post('/buy', requireAuth, async (req, res) => {
    try {
      res.json(await buy(req.user.id, Number(req.body?.souvenirId)));
    } catch (e) {
      res.status(400).json({ error: e.code ?? 'souvenir.error.server' });
    }
  });

  /** Ce qu'un joueur a vécu d'un match : utile pour la page du match. */
  router.get('/fixture/:id', requireAuth, async (req, res) => {
    const rows = await q(
      `SELECT ${CARD}, us.kind, us.fanzzy_id
         ${JOINS}
         LEFT JOIN user_souvenirs us ON us.souvenir_id = s.id AND us.user_id = ?
        WHERE s.fixture_id = ? ORDER BY s.seq`,
      [req.user.id, Number(req.params.id)]);
    res.json({ souvenirs: rows });
  });

  return { router, mintGoal, recordPush, collection, market, buy };
}
