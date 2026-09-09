import { randomUUID } from 'node:crypto';
import express from 'express';
import { BONUS, BONUS_PAR_ID, DUREE_VOTE_MS, PART_POT, depouiller, nomValide }
  from '../../shared/kop.js';

/**
 * Le KOP, côté serveur.
 *
 * **Le dépouillement se fait à la lecture, jamais par une minuterie.** Un vote
 * dont l'échéance est passée est dépouillé au premier regard — celui d'un
 * membre qui ouvre la page, ou celui du VIRAGE qui cherche les bonus actifs.
 * Une tâche périodique aurait demandé un ordonnanceur à maintenir, et surtout
 * elle aurait laissé des votes ouverts pour l'éternité au premier redémarrage
 * tombé au mauvais moment.
 *
 * **Le pot ne se retire pas.** Il n'existe aucun chemin qui rende des écharpes
 * à un membre. C'est la règle « ce qui est versé est versé », et elle tient
 * parce qu'on ne l'a écrite nulle part — il n'y a simplement pas de fonction
 * pour le faire.
 */
export function createKop({ pool, requireAuth, io = null }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const fail = (code, extra) => Object.assign(new Error(code), { code, extra });

  /* --------------------------------------------------------- appartenance */

  /** Les KOP de ce joueur, un par club suivi au plus. */
  async function miens(userId) {
    return q(
      `SELECT k.id, k.nom, k.team_id, k.pot, k.verse_total, k.createur,
              m.verse, m.depuis, t.name AS team_nom,
              (SELECT COUNT(*) FROM kop_membres x WHERE x.kop_id = k.id) AS membres
         FROM kop_membres m
         JOIN kops k ON k.id = m.kop_id
         LEFT JOIN teams t ON t.id = k.team_id
        WHERE m.user_id = ?
        ORDER BY m.depuis`, [userId]);
  }

  /** Le KOP de ce joueur pour ce club, ou `null`. */
  async function mienPour(userId, teamId) {
    const r = await q(
      `SELECT k.* FROM kop_membres m JOIN kops k ON k.id = m.kop_id
        WHERE m.user_id = ? AND m.team_id = ? LIMIT 1`, [userId, teamId]);
    return r[0] ?? null;
  }

  /** Les KOP existants pour un club, pour qu'on puisse en rejoindre un. */
  async function pourClub(teamId) {
    return q(
      `SELECT k.id, k.nom, k.pot, k.verse_total, k.cree,
              (SELECT COUNT(*) FROM kop_membres x WHERE x.kop_id = k.id) AS membres
         FROM kops k WHERE k.team_id = ?
        ORDER BY membres DESC, k.cree`, [teamId]);
  }

  /** On ne crée ni ne rejoint le KOP d'un club qu'on ne suit pas. */
  async function suit(userId, teamId) {
    const r = await q(`SELECT 1 FROM user_follows WHERE user_id = ? AND team_id = ?`,
      [userId, teamId]);
    return r.length > 0;
  }

  async function creer(userId, teamId, nomBrut) {
    const nom = nomValide(nomBrut);
    if (!nom) throw fail('kop.error.nom');
    if (!Number.isFinite(Number(teamId))) throw fail('kop.error.club');
    if (!await suit(userId, teamId)) throw fail('kop.error.pas_ton_club');

    const id = randomUUID();
    try {
      await q(`INSERT INTO kops (id, team_id, nom, createur) VALUES (?, ?, ?, ?)`,
        [id, teamId, nom, userId]);
      await q(
        `INSERT INTO kop_membres (kop_id, user_id, team_id) VALUES (?, ?, ?)`,
        [id, userId, teamId]);
    } catch (e) {
      // La clé unique fait foi : le joueur est déjà au KOP d'un club, et c'est
      // la base qui le dit — pas une vérification qu'on aurait pu manquer.
      if (e.code === 'ER_DUP_ENTRY') {
        await q(`DELETE FROM kops WHERE id = ?`, [id]);
        throw fail('kop.error.deja_membre');
      }
      throw e;
    }
    return { id, nom, teamId, createur: userId };
  }

  async function rejoindre(userId, kopId) {
    const k = (await q(`SELECT * FROM kops WHERE id = ?`, [kopId]))[0];
    if (!k) throw fail('kop.error.inconnu');
    if (!await suit(userId, k.team_id)) throw fail('kop.error.pas_ton_club');
    try {
      await q(`INSERT INTO kop_membres (kop_id, user_id, team_id) VALUES (?, ?, ?)`,
        [kopId, userId, k.team_id]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') throw fail('kop.error.deja_membre');
      throw e;
    }
    return { id: k.id, nom: k.nom, teamId: k.team_id };
  }

  /**
   * Quitter. **Rien n'est rendu.**
   *
   * Le versement reste au pot, et c'est ce qui empêche d'entrer la veille du
   * match, de voter, puis de repartir avec sa part. Le compteur personnel
   * disparaît avec l'adhésion : il ne décrivait qu'une relation qui n'existe
   * plus.
   *
   * Un créateur qui part laisse le KOP debout. Ses cinq voix partent avec lui —
   * plus personne ne départage, et une égalité vaut alors rejet. Un groupe sans
   * meneur décide plus difficilement, ce qui est une description assez juste de
   * la réalité.
   */
  async function quitter(userId, kopId) {
    const r = await q(`DELETE FROM kop_membres WHERE kop_id = ? AND user_id = ?`,
      [kopId, userId]);
    if (!r.affectedRows) throw fail('kop.error.pas_membre');
    return { quitte: kopId };
  }

  /* ------------------------------------------------------------- le pot */

  /**
   * Verse au pot du KOP la part gagnée pour ce club.
   *
   * Rend `{ verse, kopId }`, ou `{ verse: 0, sansKop: true }` quand le joueur
   * n'a pas de KOP pour ce club — l'appelant s'en sert pour le lui dire. Les
   * écharpes sont alors **perdues** : c'est voulu, et c'est ce qui donne une
   * raison d'en créer un.
   *
   * Jamais d'exception : verser au pot ne doit pas faire échouer la fin d'un
   * duel qui s'est bien joué.
   */
  async function verser(userId, teamId, montant) {
    const n = Math.max(0, Math.round(Number(montant) || 0));
    if (!n) return { verse: 0 };
    try {
      const k = await mienPour(userId, teamId);
      if (!k) return { verse: 0, sansKop: true, teamId };
      await q(`UPDATE kops SET pot = pot + ?, verse_total = verse_total + ? WHERE id = ?`,
        [n, n, k.id]);
      await q(`UPDATE kop_membres SET verse = verse + ? WHERE kop_id = ? AND user_id = ?`,
        [n, k.id, userId]);
      return { verse: n, kopId: k.id, nom: k.nom };
    } catch (e) {
      if (/doesn't exist/i.test(e.message ?? '')) {
        console.error('[kop] schéma incomplet — applique sql/kop.sql :', e.message);
      } else {
        console.error('[kop]', e.message);
      }
      return { verse: 0 };
    }
  }

  /* -------------------------------------------------------------- votes */

  /**
   * Dépouille les votes échus d'un KOP, et applique ceux qui sont adoptés.
   *
   * Appelée avant toute lecture. C'est ce qui remplace l'ordonnanceur : le vote
   * se ferme au premier regard qui suit son échéance, et jamais plus tard —
   * puisque personne ne peut lire l'état sans passer par ici.
   */
  async function depouillerEchus(kopId) {
    const echus = await q(
      `SELECT * FROM kop_votes
        WHERE kop_id = ? AND issue = 'en_cours' AND ferme <= NOW(3)`, [kopId]);
    const faits = [];

    for (const v of echus) {
      const bulletins = await q(
        `SELECT user_id AS userId, pour FROM kop_bulletins WHERE vote_id = ?`, [v.id]);
      const k = (await q(`SELECT createur, pot FROM kops WHERE id = ?`, [v.kop_id]))[0];
      const r = depouiller(bulletins.map((b) => ({ userId: b.userId, pour: Boolean(b.pour) })),
        k?.createur);

      // Adopté, mais le pot a fondu entre-temps — un autre vote est passé
      // avant. On rejette plutôt que de creuser un pot négatif, et le KOP
      // pourra revoter.
      const payable = r.adopte && (k?.pot ?? 0) >= v.prix;

      await q(`UPDATE kop_votes SET issue = ? WHERE id = ? AND issue = 'en_cours'`,
        [payable ? 'adopte' : 'rejete', v.id]);

      if (payable) {
        const def = BONUS_PAR_ID.get(v.bonus_id);
        await q(`UPDATE kops SET pot = pot - ? WHERE id = ?`, [v.prix, v.kop_id]);
        await q(
          `INSERT INTO kop_bonus (id, kop_id, bonus_id, portee, restant)
           VALUES (?, ?, ?, ?, ?)`,
          [randomUUID(), v.kop_id, v.bonus_id, def.portee,
           def.portee === 'match' ? 1 : def.portee === 'charges' ? (def.charges ?? 3) : null]);
      }
      faits.push({ id: v.id, bonusId: v.bonus_id, ...r,
        issue: payable ? 'adopte' : 'rejete',
        // On distingue les deux : « rejeté » et « pot insuffisant » ne se
        // corrigent pas de la même façon.
        potInsuffisant: r.adopte && !payable });
    }

    if (faits.length && io) io.to(`kop:${kopId}`).emit('kop:votes', faits);
    return faits;
  }

  async function proposer(userId, kopId, bonusId) {
    const def = BONUS_PAR_ID.get(String(bonusId));
    if (!def) throw fail('kop.error.bonus_inconnu');

    const m = await q(`SELECT 1 FROM kop_membres WHERE kop_id = ? AND user_id = ?`,
      [kopId, userId]);
    if (!m.length) throw fail('kop.error.pas_membre');

    await depouillerEchus(kopId);

    // Un seul vote à la fois. Deux votes ouverts, ce sont deux dépenses
    // acceptées séparément sur un pot qui n'en couvre qu'une — et le second
    // serait rejeté au dépouillement, après que tout le monde a voté pour.
    const enCours = await q(
      `SELECT id FROM kop_votes WHERE kop_id = ? AND issue = 'en_cours'`, [kopId]);
    if (enCours.length) throw fail('kop.error.vote_en_cours');

    const k = (await q(`SELECT pot FROM kops WHERE id = ?`, [kopId]))[0];
    if (!k) throw fail('kop.error.inconnu');
    if (k.pot < def.prix) throw fail('kop.error.pot_insuffisant');

    const id = randomUUID();
    await q(
      `INSERT INTO kop_votes (id, kop_id, bonus_id, prix, ouvert_par, ferme)
       VALUES (?, ?, ?, ?, ?, NOW(3) + INTERVAL ? MICROSECOND)`,
      [id, kopId, def.id, def.prix, userId, DUREE_VOTE_MS * 1000]);

    // Celui qui propose vote pour : il n'aurait pas proposé sinon, et le lui
    // faire cliquer une seconde fois ne prouve rien.
    await q(`INSERT INTO kop_bulletins (vote_id, user_id, pour) VALUES (?, ?, 1)`,
      [id, userId]);

    const vote = { id, kopId, bonusId: def.id, prix: def.prix, nom: def.nom,
      fermeDansMs: DUREE_VOTE_MS, ouvertPar: userId };
    /* La notification. Trois minutes, c'est court : si l'on attendait que les
       membres rafraîchissent leur page, la moitié d'entre eux voterait après la
       clôture. */
    if (io) io.to(`kop:${kopId}`).emit('kop:vote', vote);
    return vote;
  }

  async function voter(userId, voteId, pour) {
    const v = (await q(`SELECT * FROM kop_votes WHERE id = ?`, [voteId]))[0];
    if (!v) throw fail('kop.error.vote_inconnu');
    const m = await q(`SELECT 1 FROM kop_membres WHERE kop_id = ? AND user_id = ?`,
      [v.kop_id, userId]);
    if (!m.length) throw fail('kop.error.pas_membre');
    if (v.issue !== 'en_cours' || new Date(v.ferme) <= new Date()) {
      throw fail('kop.error.vote_clos');
    }
    // On peut changer d'avis tant que c'est ouvert : trois minutes, c'est
    // exactement la durée d'une discussion.
    await q(
      `INSERT INTO kop_bulletins (vote_id, user_id, pour) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE pour = VALUES(pour), a = NOW(3)`,
      [voteId, userId, pour ? 1 : 0]);
    return { voteId, pour: Boolean(pour) };
  }

  /* ------------------------------------------------------------ bonus */

  /**
   * Les modificateurs que le KOP de ce joueur lui apporte pour ce match.
   *
   * Rendus dans le vocabulaire du moteur — `tempoWindow`, `breathBonus`,
   * `pushMult`… — et fusionnés par multiplication. Le VIRAGE les mêle à ceux du
   * Fanzzy équipé sans savoir d'où ils viennent, et c'est ce qui permet à un
   * bonus de KOP de peser sur une mécanique inventée demain.
   *
   * Les bonus **ne se cumulent pas entre eux sur la même clé** : le plus fort
   * l'emporte. Deux bonus de tempo achetés le même soir donneraient sinon une
   * fenêtre de tempo absurde, et un KOP riche deviendrait injouable à
   * affronter.
   */
  async function modsDe(userId, teamId, fixtureId = null) {
    try {
      const k = await mienPour(userId, teamId);
      if (!k) return {};
      await depouillerEchus(k.id);

      const actifs = await q(
        `SELECT * FROM kop_bonus
          WHERE kop_id = ? AND epuise IS NULL
            AND (restant IS NULL OR restant > 0)`, [k.id]);
      if (!actifs.length) return {};

      const mods = {};
      const ids = [];
      for (const a of actifs) {
        const def = BONUS_PAR_ID.get(a.bonus_id);
        if (!def) continue;
        ids.push(def.id);
        for (const [cle, v] of Object.entries(def.mods)) {
          mods[cle] = Math.max(mods[cle] ?? 0, v);
        }
      }

      /* La consommation. Un bonus de match ou à charges se décompte **une fois
         par match**, pas une fois par entrée dans le VIRAGE : sans
         `fixture_id`, quelqu'un qui rafraîchit sa page trois fois brûlerait
         trois matchs de bonus. */
      if (fixtureId != null) {
        for (const a of actifs) {
          if (a.portee === 'saison') continue;
          if (Number(a.fixture_id) === Number(fixtureId)) continue;
          const restant = Math.max(0, Number(a.restant ?? 1) - 1);
          await q(
            `UPDATE kop_bonus SET restant = ?, fixture_id = ?, epuise = ?
              WHERE id = ? AND (fixture_id IS NULL OR fixture_id <> ?)`,
            [restant, fixtureId, restant ? null : new Date(), a.id, fixtureId]);
        }
      }

      return { ...mods, kopId: k.id, kopNom: k.nom, kopBonus: ids };
    } catch (e) {
      // Un bonus indisponible ne doit pas empêcher d'entrer dans le virage.
      if (!/doesn't exist/i.test(e.message ?? '')) console.error('[kop] mods', e.message);
      return {};
    }
  }

  /** L'état complet d'un KOP : membres, pot, vote en cours, bonus actifs. */
  async function etat(kopId, userId) {
    await depouillerEchus(kopId);
    const k = (await q(`SELECT * FROM kops WHERE id = ?`, [kopId]))[0];
    if (!k) throw fail('kop.error.inconnu');

    const [membres, vote, actifs] = await Promise.all([
      q(`SELECT m.user_id, m.verse, m.depuis, u.pseudo
           FROM kop_membres m JOIN users u ON u.public_id = m.user_id
          WHERE m.kop_id = ? ORDER BY m.verse DESC`, [kopId]),
      q(`SELECT * FROM kop_votes WHERE kop_id = ? AND issue = 'en_cours' LIMIT 1`, [kopId]),
      q(`SELECT * FROM kop_bonus WHERE kop_id = ? AND epuise IS NULL
           AND (restant IS NULL OR restant > 0)`, [kopId]),
    ]);

    let bulletins = [];
    if (vote[0]) {
      bulletins = await q(
        `SELECT user_id AS userId, pour FROM kop_bulletins WHERE vote_id = ?`, [vote[0].id]);
    }

    return {
      id: k.id, nom: k.nom, teamId: k.team_id, pot: k.pot, verseTotal: k.verse_total,
      createur: k.createur, jeSuisCreateur: k.createur === userId,
      membres: membres.map((m) => ({ id: m.user_id, pseudo: m.pseudo, verse: m.verse,
        depuis: m.depuis, createur: m.user_id === k.createur })),
      vote: vote[0] ? {
        id: vote[0].id, bonusId: vote[0].bonus_id, prix: vote[0].prix,
        ferme: vote[0].ferme,
        fermeDansMs: Math.max(0, new Date(vote[0].ferme).getTime() - Date.now()),
        // Le décompte en direct, avec le poids réel de chaque voix.
        ...depouiller(bulletins.map((b) => ({ userId: b.userId, pour: Boolean(b.pour) })),
          k.createur),
        monBulletin: bulletins.find((b) => b.userId === userId)?.pour ?? null,
      } : null,
      bonus: actifs.map((a) => ({ id: a.id, bonusId: a.bonus_id, portee: a.portee,
        restant: a.restant })),
      catalogue: BONUS,
    };
  }

  /* ------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (res.headersSent) return;
    const code = String(e.code ?? '').startsWith('kop.') ? e.code : 'kop.error.server';
    if (code === 'kop.error.server') console.error('[kop]', e.message);
    res.status(400).json({ error: code });
  });

  router.get('/miens', requireAuth, safe(async (req, res) => {
    const liste = await miens(req.user.id);
    for (const k of liste) await depouillerEchus(k.id);
    res.json({ kops: liste, catalogue: BONUS, dureeVoteMs: DUREE_VOTE_MS });
  }));

  router.get('/club/:teamId', requireAuth, safe(async (req, res) =>
    res.json({ kops: await pourClub(Number(req.params.teamId)) })));

  router.get('/:id', requireAuth, safe(async (req, res) =>
    res.json(await etat(req.params.id, req.user.id))));

  router.post('/', requireAuth, safe(async (req, res) =>
    res.json(await creer(req.user.id, Number(req.body?.teamId), req.body?.nom))));

  router.post('/:id/rejoindre', requireAuth, safe(async (req, res) =>
    res.json(await rejoindre(req.user.id, req.params.id))));

  router.post('/:id/quitter', requireAuth, safe(async (req, res) =>
    res.json(await quitter(req.user.id, req.params.id))));

  router.post('/:id/proposer', requireAuth, safe(async (req, res) =>
    res.json(await proposer(req.user.id, req.params.id, req.body?.bonusId))));

  router.post('/vote/:voteId', requireAuth, safe(async (req, res) =>
    res.json(await voter(req.user.id, req.params.voteId, Boolean(req.body?.pour)))));

  /* ------------------------------------------------------------- socket

     Le serveur émet vers `kop:<id>` quand un vote s'ouvre ou se dépouille.
     Encore faut-il que quelqu'un y soit : sans ce salon, les notifications
     partaient dans le vide et les trois minutes du vote s'écoulaient pendant
     que les membres regardaient une page immobile.

     On rejoint **tous ses KOP** d'un coup plutôt qu'un par page ouverte : un
     vote qui s'ouvre sur le KOP de Bâle doit atteindre celui qui regarde la
     page de son KOP de Sion, sinon il le découvre après la clôture. */
  if (io) {
    io.on('connection', (socket) => {
      socket.on('kop:suivre', async () => {
        const u = socket.data?.user;
        if (!u?.userId) return;
        try {
          for (const k of await miens(u.userId)) socket.join(`kop:${k.id}`);
        } catch (e) {
          // Pas de KOP, pas de table, peu importe : la page marche sans temps
          // réel, elle relit simplement à son rythme.
          if (!/doesn't exist/i.test(e.message ?? '')) console.error('[kop] suivre', e.message);
        }
      });
    });
  }

  return { router, miens, mienPour, pourClub, creer, rejoindre, quitter,
    verser, proposer, voter, depouillerEchus, modsDe, etat, PART_POT };
}
