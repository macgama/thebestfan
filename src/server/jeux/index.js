/**
 * Les mini-jeux d'entre les matchs : les jongles, le chant en rythme et le
 * déplacement (seul, pour un record), les tirs au but (en 1 contre 1, pas en
 * même temps), le tifo du club et la tribune contre le boss (tout le club
 * ensemble).
 *
 * Demandés par Gaël le 18 octobre 2026 : « des jeux à jouer entre les matchs,
 * à jouer seul ou en 1v1 avec classement ; on gagne des écharpes ; à chaque
 * nouvelle saison, on remet les compteurs à zéro ».
 *
 * ## Les compteurs d'une saison
 *
 * Chaque partie porte la saison en cours au moment où elle s'ouvre
 * (`saisonEnCours`, la dernière lancée). Un classement ne lit que les parties
 * de la saison en cours : quand la suivante se lance, tout le monde repart de
 * zéro, et rien n'est effacé.
 *
 * ## Les écharpes
 *
 * Par le grand livre (`recompenses.js`, sources `jongles` et `tirs`, clé
 * l'identifiant de la partie), donc une seule fois par partie et jamais
 * au-delà du disjoncteur. En plus, les deux jeux ensemble ne versent pas plus
 * de `jeux.echarpes_jour` par jour de jeu : on joue pour le classement, pas
 * pour remplir sa bourse.
 *
 * ## Ce que le serveur vérifie
 *
 * Les jongles se jouent dans la page ; le serveur vérifie que les instants
 * des frappes sont possibles (`scoreDeJongles`). Les tirs au but se règlent
 * ici, jamais dans la page : chacun envoie ses tirs et ses plongeons sans
 * voir ceux de l'autre, et `reglerTirs` décide.
 */
import express from 'express';
import { verser } from '../recompenses.js';
import { reglage } from '../../shared/reglages.js';
import { saisonEnCours } from '../fanzzy/saisons.js';
import { habillerJoueurs } from '../fanzzy/avatar.js';
import {
  JONGLES, scoreDeJongles, gainDeJongles, TIRS, jeuDeTirs, reglerTirs, jeuDeLaMachine,
  CHANT, partitionDuChant, noterChant, COURSE, rejouerCourse, gainDeScore,
  TIFO, lettresDuClub, motifDuTifo, fideliteDuTifo,
} from '../../shared/mini-jeux.js';
import { chantReussiPour } from './voix.js';

const SCHEMA_INCOMPLET = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR']);

/** Au plus tant de séries ouvertes à la fois par joueur, défis compris. */
export const SERIES_OUVERTES_MAX = 5;

/** Les jeux seuls de `jeux_parties`, et ce que chacun rapporte. */
const SEULS = new Set(['chant', 'deplacement']);

/** La taille d'un classement servi. */
const CLASSEMENT = 50;

const lireJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

export function createJeux({ pool, requireAuth }) {
  const q = async (sql, params = []) => (await pool.execute(sql, params))[0];

  const saisonId = () => {
    try { return saisonEnCours()?.id ?? null; } catch { return null; }
  };
  const saisonVue = () => {
    try {
      const s = saisonEnCours();
      return s ? { id: s.id, numero: s.numero, nom: s.nom } : null;
    } catch { return null; }
  };

  /* ---------------------------------------------------------- les écharpes */

  /** Ce que les mini-jeux ont déjà versé à ce joueur aujourd'hui. */
  async function versesDuJour(userId) {
    const [r] = await q(
      `SELECT COALESCE(SUM(echarpes), 0) AS n FROM recompenses
        WHERE user_id = ? AND source IN ('jongles', 'tirs', 'chant', 'deplacement')
          AND verse_a >= CURDATE()`, [userId]);
    return Number(r?.n ?? 0);
  }

  /**
   * Verse `voulu` écharpes, ramenées sous le plafond du jour. Rend ce qui a
   * réellement été versé (0 si rien : plafond atteint, jeu éteint,
   * disjoncteur, déjà versé).
   */
  async function payer(userId, source, cle, voulu) {
    if (!reglage('jeux.actif') || voulu <= 0) return 0;
    const reste = Math.max(0, reglage('jeux.echarpes_jour') - await versesDuJour(userId));
    const echarpes = Math.min(voulu, reste);
    if (echarpes <= 0) return 0;
    const r = await verser(pool, { userId, source, cle: String(cle), saisonId: saisonId(),
      gain: { echarpes } });
    return r.verse ? echarpes : 0;
  }

  /* ------------------------------------------------------------ les amis */

  async function idsDesAmis(userId) {
    const rows = await q(
      `SELECT IF(a = ?, b, a) AS id FROM amities WHERE (a = ? OR b = ?) AND etat = 'amis'`,
      [userId, userId, userId]);
    return rows.map((r) => r.id);
  }

  async function sontAmis(x, y) {
    const [r] = await q(
      `SELECT 1 AS ok FROM amities WHERE ((a = ? AND b = ?) OR (a = ? AND b = ?)) AND etat = 'amis'`,
      [x, y, y, x]);
    return Boolean(r);
  }

  /* -------------------------------------------------------- les classements */

  /**
   * Un classement de la saison en cours : `{ lignes, moi }`. `portee` vaut
   * `tous` ou `amis` (moi et mes amis).
   */
  async function classement(jeu, userId, portee = 'tous') {
    const sid = saisonId();
    let rows;
    if (jeu === 'jongles') {
      rows = await q(
        `SELECT j.user_id AS id, u.pseudo, MAX(j.score) AS valeur, COUNT(*) AS parties
           FROM jeux_jongles j JOIN users u ON u.public_id = j.user_id AND u.status = 'active'
          WHERE j.saison_id <=> ? AND j.score IS NOT NULL
          GROUP BY j.user_id, u.pseudo
          ORDER BY valeur DESC, parties ASC, j.user_id`, [sid]);
    } else if (SEULS.has(jeu)) {
      rows = await q(
        `SELECT j.user_id AS id, u.pseudo, MAX(j.score) AS valeur, COUNT(*) AS parties
           FROM jeux_parties j JOIN users u ON u.public_id = j.user_id AND u.status = 'active'
          WHERE j.jeu = ? AND j.saison_id <=> ? AND j.score IS NOT NULL
          GROUP BY j.user_id, u.pseudo
          ORDER BY valeur DESC, parties ASC, j.user_id`, [jeu, sid]);
    } else {
      rows = await q(
        `SELECT t.id, u.pseudo, SUM(t.pts) AS valeur, SUM(t.v) AS victoires, SUM(t.n) AS nuls,
                SUM(t.d) AS defaites, COUNT(*) AS parties
           FROM (SELECT a_id AS id, IF(buts_a > buts_b, 3, IF(buts_a = buts_b, 1, 0)) AS pts,
                        buts_a > buts_b AS v, buts_a = buts_b AS n, buts_a < buts_b AS d
                   FROM jeux_tirs WHERE saison_id <=> ? AND joue_a IS NOT NULL AND machine = 0
                 UNION ALL
                 SELECT b_id, IF(buts_b > buts_a, 3, IF(buts_a = buts_b, 1, 0)),
                        buts_b > buts_a, buts_a = buts_b, buts_b < buts_a
                   FROM jeux_tirs WHERE saison_id <=> ? AND joue_a IS NOT NULL AND machine = 0
                    AND b_id IS NOT NULL) t
           JOIN users u ON u.public_id = t.id AND u.status = 'active'
          GROUP BY t.id, u.pseudo
          ORDER BY valeur DESC, victoires DESC, parties ASC, t.id`, [sid, sid]);
    }
    if (portee === 'amis') {
      const garder = new Set([userId, ...await idsDesAmis(userId)]);
      rows = rows.filter((r) => garder.has(r.id));
    }
    const lignes = rows.map((r, i) => ({
      rang: i + 1, id: r.id, pseudo: r.pseudo, valeur: Number(r.valeur), parties: Number(r.parties),
      ...(jeu === 'tirs' ? { victoires: Number(r.victoires), nuls: Number(r.nuls),
        defaites: Number(r.defaites) } : {}),
    }));
    const moi = lignes.find((l) => l.id === userId) ?? null;
    const servies = lignes.slice(0, CLASSEMENT);
    const formes = await habillerJoueurs(q, servies.map((l) => l.id)).catch(() => new Map());
    return {
      lignes: servies.map(({ id, ...l }) => ({ ...l, moi: id === userId,
        avatar: formes.get(id)?.avatar ?? null })),
      moi: moi ? { rang: moi.rang, valeur: moi.valeur } : null,
      total: lignes.length,
    };
  }

  /* -------------------------------------------------------------- jongles */

  async function ouvrirJongles(userId) {
    const graine = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    const r = await q(`INSERT INTO jeux_jongles (user_id, saison_id, graine) VALUES (?, ?, ?)`,
      [userId, saisonId(), graine]);
    return { id: Number(r.insertId), graine };
  }

  async function finirJongles(userId, id, score, frappes) {
    const [p] = await q(
      `SELECT id, saison_id, fin_a, ROUND((UNIX_TIMESTAMP(NOW(3)) - UNIX_TIMESTAMP(debut_a)) * 1000) AS ms
         FROM jeux_jongles WHERE id = ? AND user_id = ?`, [id, userId]);
    if (!p) return { erreur: 'jeux.error.partie_inconnue', status: 404 };
    if (p.fin_a != null) return { erreur: 'jeux.error.partie_finie', status: 409 };
    const duree = Number(p.ms);
    if (duree > JONGLES.DUREE_MAX_MS) return { erreur: 'jeux.error.partie_perimee', status: 409 };
    const retenu = scoreDeJongles(score, frappes, duree);
    if (retenu == null) return { erreur: 'jeux.error.score_invalide', status: 400 };

    const [avant] = await q(
      `SELECT MAX(score) AS m FROM jeux_jongles WHERE user_id = ? AND saison_id <=> ? AND score IS NOT NULL`,
      [userId, p.saison_id]);
    const ferme = await q(
      `UPDATE jeux_jongles SET fin_a = NOW(3), score = ? WHERE id = ? AND fin_a IS NULL`, [retenu, id]);
    if (!ferme.affectedRows) return { erreur: 'jeux.error.partie_finie', status: 409 };

    const echarpes = await payer(userId, 'jongles', id, gainDeJongles(retenu, {
      parEcharpe: reglage('jeux.jongles_par_echarpe'), maxPartie: reglage('jeux.jongles_max_partie') }));
    await q(`UPDATE jeux_jongles SET echarpes = ? WHERE id = ?`, [echarpes, id]);
    const ancien = avant?.m == null ? null : Number(avant.m);
    return {
      score: retenu, echarpes,
      record: Math.max(retenu, ancien ?? 0),
      nouveauRecord: retenu > 0 && (ancien == null || retenu > ancien),
    };
  }

  async function etatJongles(userId) {
    const [r] = await q(
      `SELECT MAX(score) AS record, COUNT(score) AS parties FROM jeux_jongles
        WHERE user_id = ? AND saison_id <=> ?`, [userId, saisonId()]);
    return { record: r?.record == null ? null : Number(r.record), parties: Number(r?.parties ?? 0) };
  }

  /* ---------------------------------------------------------- tirs au but */

  const GAINS_TIRS = () => ({
    victoire: reglage('jeux.tirs_victoire'),
    nul: reglage('jeux.tirs_nul'),
    defaite: reglage('jeux.tirs_defaite'),
  });

  /** Ce qu'une issue rapporte ; contre la machine, une victoire vaut moitié. */
  function gainDesTirs(mesButs, sesButs, machine) {
    const g = GAINS_TIRS();
    if (mesButs > sesButs) return machine ? Math.floor(g.victoire / 2) : g.victoire;
    if (mesButs === sesButs) return g.nul;
    return g.defaite;
  }

  /**
   * Règle une série : écrit le jeu du second, le score, et paie les deux.
   * L'écriture ne passe que si la série n'est pas déjà jouée : deux
   * règlements en même temps n'en font qu'un.
   */
  async function regler(serie, jeuB, { bId, machine }) {
    const jeuA = lireJson(serie.a_jeu);
    const r = reglerTirs(jeuA, jeuB);
    const ecrit = await q(
      `UPDATE jeux_tirs SET b_id = ?, b_jeu = ?, buts_a = ?, buts_b = ?, joue_a = NOW(3), machine = ?
        WHERE id = ? AND joue_a IS NULL`,
      [bId ?? null, JSON.stringify(jeuB), r.butsA, r.butsB, machine ? 1 : 0, serie.id]);
    if (!ecrit.affectedRows) return null;
    const payeA = await payer(serie.a_id, 'tirs', serie.id, gainDesTirs(r.butsA, r.butsB, machine));
    const payeB = bId && !machine
      ? await payer(bId, 'tirs', serie.id, gainDesTirs(r.butsB, r.butsA, false)) : 0;
    return { ...r, payeA, payeB };
  }

  /** Les séries restées sans adversaire trop longtemps : la machine les joue. */
  async function reglerLesAttentes(userId) {
    const h = reglage('jeux.tirs_attente_h');
    const rows = await q(
      `SELECT id, a_id, a_jeu FROM jeux_tirs
        WHERE a_id = ? AND joue_a IS NULL
          AND cree_a < NOW(3) - INTERVAL IF(ami = 1, ? * 3, ?) HOUR`, [userId, h, h]);
    for (const s of rows) {
      try { await regler(s, jeuDeLaMachine(Number(s.id)), { bId: null, machine: true }); }
      catch (e) { console.error('[jeux] machine', s.id, e.message); }
    }
  }

  async function ouvertes(userId) {
    const [r] = await q(
      `SELECT COUNT(*) AS n FROM jeux_tirs WHERE a_id = ? AND joue_a IS NULL`, [userId]);
    return Number(r?.n ?? 0);
  }

  /**
   * Tirer contre le premier venu : relever la plus ancienne série ouverte d'un
   * autre joueur, ou, s'il n'y en a pas, ouvrir la sienne.
   */
  async function tirerAuHasard(userId, jeu) {
    const conn = await pool.getConnection();
    let prise = null;
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        `SELECT id, a_id, a_jeu FROM jeux_tirs
          WHERE joue_a IS NULL AND ami = 0 AND b_id IS NULL AND a_id <> ? AND saison_id <=> ?
          ORDER BY cree_a LIMIT 1 FOR UPDATE SKIP LOCKED`, [userId, saisonId()]);
      prise = rows[0] ?? null;
      if (prise) {
        /* Réservée sous le verrou : un second joueur qui arrive en même temps
           ne peut plus la prendre. Le règlement suit, hors transaction. */
        await conn.execute(`UPDATE jeux_tirs SET b_id = ? WHERE id = ? AND joue_a IS NULL`,
          [userId, prise.id]);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback().catch(() => {});
      throw e;
    } finally {
      conn.release();
    }

    if (prise) {
      const r = await regler(prise, jeu, { bId: userId, machine: false });
      if (r) return { id: Number(prise.id), etat: 'jouee', ...vueReglee(r, 'b'), adversaire: prise.a_id };
    }
    if (await ouvertes(userId) >= SERIES_OUVERTES_MAX) {
      return { erreur: 'jeux.error.trop_de_series', status: 409 };
    }
    const r = await q(`INSERT INTO jeux_tirs (saison_id, a_id, a_jeu) VALUES (?, ?, ?)`,
      [saisonId(), userId, JSON.stringify(jeu)]);
    return { id: Number(r.insertId), etat: 'attend' };
  }

  async function defier(userId, amiId, jeu) {
    if (amiId === userId || !await sontAmis(userId, amiId)) {
      return { erreur: 'jeux.error.pas_ami', status: 403 };
    }
    if (await ouvertes(userId) >= SERIES_OUVERTES_MAX) {
      return { erreur: 'jeux.error.trop_de_series', status: 409 };
    }
    const [deja] = await q(
      `SELECT id FROM jeux_tirs WHERE a_id = ? AND b_id = ? AND ami = 1 AND joue_a IS NULL`,
      [userId, amiId]);
    if (deja) return { erreur: 'jeux.error.defi_en_cours', status: 409 };
    const r = await q(`INSERT INTO jeux_tirs (saison_id, a_id, b_id, ami, a_jeu) VALUES (?, ?, ?, 1, ?)`,
      [saisonId(), userId, amiId, JSON.stringify(jeu)]);
    return { id: Number(r.insertId), etat: 'attend' };
  }

  async function releverDefi(userId, id, jeu) {
    const [s] = await q(
      `SELECT id, a_id, a_jeu, b_id, joue_a FROM jeux_tirs WHERE id = ? AND ami = 1`, [id]);
    if (!s || s.b_id !== userId) return { erreur: 'jeux.error.serie_inconnue', status: 404 };
    if (s.joue_a != null) return { erreur: 'jeux.error.serie_jouee', status: 409 };
    const r = await regler(s, jeu, { bId: userId, machine: false });
    if (!r) return { erreur: 'jeux.error.serie_jouee', status: 409 };
    return { id: Number(s.id), etat: 'jouee', ...vueReglee(r, 'b'), adversaire: s.a_id };
  }

  /** Une série réglée, vue par l'un des deux (`cote` : 'a' ou 'b'). */
  function vueReglee(r, cote) {
    const mes = cote === 'a' ? r.butsA : r.butsB;
    const ses = cote === 'a' ? r.butsB : r.butsA;
    return {
      coups: r.coups.map((c) => ({ ...c, moi: c.tireur === cote })),
      mesButs: mes, sesButs: ses,
      issue: mes > ses ? 'victoire' : mes === ses ? 'nul' : 'defaite',
      echarpes: cote === 'a' ? r.payeA : r.payeB,
    };
  }

  /** Mes séries : en attente, à relever, et les dernières jouées. */
  async function mesSeries(userId) {
    await reglerLesAttentes(userId);
    const rows = await q(
      `SELECT id, a_id, b_id, ami, machine, a_jeu, b_jeu, buts_a, buts_b, cree_a, joue_a, vu_a
         FROM jeux_tirs
        WHERE (a_id = ? OR b_id = ?) AND (saison_id <=> ? OR joue_a IS NULL)
        ORDER BY COALESCE(joue_a, cree_a) DESC LIMIT 30`, [userId, userId, saisonId()]);
    const autres = rows.map((s) => (s.a_id === userId ? s.b_id : s.a_id)).filter(Boolean);
    const formes = await habillerJoueurs(q, autres).catch(() => new Map());
    const pseudos = new Map();
    if (autres.length) {
      const u = await q(`SELECT public_id, pseudo FROM users WHERE public_id IN (${
        autres.map(() => '?').join(',')})`, autres);
      for (const x of u) pseudos.set(x.public_id, x.pseudo);
    }
    const series = rows.map((s) => {
      const cote = s.a_id === userId ? 'a' : 'b';
      const autre = cote === 'a' ? s.b_id : s.a_id;
      const adversaire = s.machine ? { machine: true }
        : autre ? { pseudo: pseudos.get(autre) ?? null, avatar: formes.get(autre)?.avatar ?? null }
          : null;
      const base = { id: Number(s.id), ami: Boolean(s.ami), adversaire, cree: s.cree_a };
      if (s.joue_a == null) {
        /* Un défi qu'on m'a lancé et que je n'ai pas relevé : à moi de jouer. */
        if (cote === 'b') return { ...base, etat: 'a_relever' };
        return { ...base, etat: 'attend' };
      }
      const r = reglerTirs(lireJson(s.a_jeu), lireJson(s.b_jeu));
      return { ...base, etat: 'jouee', joue: s.joue_a, machine: Boolean(s.machine),
        nouveau: cote === 'a' && !s.vu_a,
        ...vueReglee({ ...r, payeA: null, payeB: null }, cote) };
    });
    return series;
  }

  async function etatTirs(userId) {
    const series = await mesSeries(userId);
    return {
      series,
      aRelever: series.filter((s) => s.etat === 'a_relever').length,
      nouveaux: series.filter((s) => s.nouveau).length,
    };
  }


  /* ---------------------------------------- chant en rythme, déplacement

     Deux jeux seuls de plus, dans une seule table (`jeux_parties`). Le
     serveur ouvre la partie avec sa graine ; à la fin, il retrouve la
     partition ou la route, et calcule le score lui-même à partir des gestes.
     Le score annoncé par la page n'est jamais lu. */

  const GAINS_SEULS = () => ({
    chant: { parEcharpe: reglage('jeux.chant_par_echarpe'), maxPartie: reglage('jeux.chant_max_partie') },
    deplacement: { parEcharpe: reglage('jeux.deplacement_par_echarpe'),
      maxPartie: reglage('jeux.deplacement_max_partie') },
  });

  async function ouvrirPartie(userId, jeu) {
    const graine = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    const r = await q(`INSERT INTO jeux_parties (jeu, user_id, saison_id, graine) VALUES (?, ?, ?, ?)`,
      [jeu, userId, saisonId(), graine]);
    return { id: Number(r.insertId), graine };
  }

  /** Le score que donnent les gestes, ou `null` s'ils sont impossibles. */
  function juger(jeu, graine, gestes, duree) {
    if (jeu === 'chant') {
      const b = noterChant(partitionDuChant(graine), gestes);
      /* La dernière frappe ne peut pas venir après l'envoi. */
      if (!b || (gestes.length && gestes.at(-1).t > duree + 1000)) return null;
      return { score: b.score, detail: b };
    }
    const c = rejouerCourse(graine, gestes);
    /* Une course ne va pas plus vite que le temps : une image dure 1/60 s. */
    if (!c || c.images * 1000 / COURSE.IMAGES_S > duree * 1.05 + 2000) return null;
    return { score: c.score, detail: c };
  }

  async function finirPartie(userId, jeu, id, gestes) {
    const [p] = await q(
      `SELECT id, saison_id, graine, fin_a,
              ROUND((UNIX_TIMESTAMP(NOW(3)) - UNIX_TIMESTAMP(debut_a)) * 1000) AS ms
         FROM jeux_parties WHERE id = ? AND user_id = ? AND jeu = ?`, [id, userId, jeu]);
    if (!p) return { erreur: 'jeux.error.partie_inconnue', status: 404 };
    if (p.fin_a != null) return { erreur: 'jeux.error.partie_finie', status: 409 };
    const duree = Number(p.ms);
    if (duree > JONGLES.DUREE_MAX_MS) return { erreur: 'jeux.error.partie_perimee', status: 409 };
    const jugement = juger(jeu, Number(p.graine), gestes, duree);
    if (!jugement) return { erreur: 'jeux.error.score_invalide', status: 400 };

    const [avant] = await q(
      `SELECT MAX(score) AS m FROM jeux_parties
        WHERE user_id = ? AND jeu = ? AND saison_id <=> ? AND score IS NOT NULL`,
      [userId, jeu, p.saison_id]);
    const ferme = await q(
      `UPDATE jeux_parties SET fin_a = NOW(3), score = ? WHERE id = ? AND fin_a IS NULL`,
      [jugement.score, id]);
    if (!ferme.affectedRows) return { erreur: 'jeux.error.partie_finie', status: 409 };

    const echarpes = await payer(userId, jeu, id, gainDeScore(jugement.score, GAINS_SEULS()[jeu]));
    await q(`UPDATE jeux_parties SET echarpes = ? WHERE id = ?`, [echarpes, id]);
    /* Le chant en rythme pousse aussi contre le boss : un coup toutes les dix
       notes réussies. */
    if (jeu === 'chant') chantReussiPour(userId, Math.floor(jugement.detail.reussis / 10));
    const ancien = avant?.m == null ? null : Number(avant.m);
    return {
      score: jugement.score, ...jugement.detail, echarpes,
      record: Math.max(jugement.score, ancien ?? 0),
      nouveauRecord: jugement.score > 0 && (ancien == null || jugement.score > ancien),
    };
  }

  async function etatSeul(userId, jeu) {
    const [r] = await q(
      `SELECT MAX(score) AS record, COUNT(score) AS parties FROM jeux_parties
        WHERE user_id = ? AND jeu = ? AND saison_id <=> ?`, [userId, jeu, saisonId()]);
    return { record: r?.record == null ? null : Number(r.record), parties: Number(r?.parties ?? 0) };
  }

  /* ------------------------------------------------------------ le club

     Le tifo et le boss se jouent pour le club du supporter : son club de
     cœur (`user_follows.is_main`), sinon le premier qu'il a suivi. Sans club
     suivi, la page invite à en choisir un. La même règle dans `voix.js`. */

  async function clubDe(userId) {
    const [u] = await q(
      `SELECT t.id, t.name, t.code, t.color1, t.color2
         FROM user_follows f JOIN teams t ON t.id = f.team_id
        WHERE f.user_id = ? ORDER BY f.is_main DESC, f.created_at, f.team_id LIMIT 1`, [userId]);
    if (!u) return null;
    const c1 = u.color1 || '#C8102E';
    const c2 = u.color2 && u.color2.toLowerCase() !== c1.toLowerCase() ? u.color2 : '#F2EEE4';
    /* La craie, sauf si la seconde couleur est déjà blanche : alors l'encre. */
    const clair = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16)
      + parseInt(h.slice(5, 7), 16) > 600;
    const c3 = clair(c2) ? '#0A0D11' : '#F2EEE4';
    return { id: Number(u.id), nom: u.name, lettres: lettresDuClub(u.code, u.name),
      couleurs: [c1, c2, c3] };
  }

  /* ------------------------------------------------------------ le tifo */

  const NOMBRE_CASES = TIFO.COLONNES * TIFO.RANGS;

  /** Le prochain match du club, celui dont on peint le tifo. */
  async function matchAPeindre(teamId) {
    const [f] = await q(
      `SELECT f.id, f.kickoff_at, f.home_id, h.name AS home, a.name AS away,
              TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), f.kickoff_at) AS dans_s
         FROM fixtures f LEFT JOIN teams h ON h.id = f.home_id LEFT JOIN teams a ON a.id = f.away_id
        WHERE (f.home_id = ? OR f.away_id = ?) AND f.kickoff_at > UTC_TIMESTAMP()
          AND f.status_short IN ('NS', 'TBD')
        ORDER BY f.kickoff_at LIMIT 1`, [teamId, teamId]);
    return f ?? null;
  }

  /** Le dernier match commencé depuis moins de trois jours : son tifo est levé. */
  async function matchLeve(teamId) {
    const [f] = await q(
      `SELECT f.id, f.kickoff_at, f.home_id, h.name AS home, a.name AS away,
              TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), f.kickoff_at) AS dans_s
         FROM fixtures f LEFT JOIN teams h ON h.id = f.home_id LEFT JOIN teams a ON a.id = f.away_id
        WHERE (f.home_id = ? OR f.away_id = ?) AND f.kickoff_at <= UTC_TIMESTAMP()
          AND f.kickoff_at > UTC_TIMESTAMP() - INTERVAL 3 DAY
        ORDER BY f.kickoff_at DESC LIMIT 1`, [teamId, teamId]);
    return f ?? null;
  }

  async function casesDuTifo(teamId, fixtureId) {
    const rows = await q(
      `SELECT case_n, couleur FROM jeux_tifo WHERE team_id = ? AND fixture_id = ?`,
      [teamId, fixtureId]);
    const cases = new Array(NOMBRE_CASES).fill(null);
    for (const r of rows) {
      if (r.case_n < NOMBRE_CASES) cases[r.case_n] = Number(r.couleur);
    }
    const p = await q(
      `SELECT COUNT(DISTINCT user_id) AS n FROM jeux_tifo WHERE team_id = ? AND fixture_id = ?`,
      [teamId, fixtureId]);
    return { cases, peintres: Number(p[0]?.n ?? 0) };
  }

  async function casesDuJour(userId) {
    const [r] = await q(
      `SELECT n FROM compteurs_jour WHERE user_id = ? AND jour = CURDATE() AND cle = 'tifo'`, [userId]);
    return Number(r?.n ?? 0);
  }

  const vueMatch = (f, teamId) => ({
    id: Number(f.id), coupEnvoi: f.kickoff_at,
    /* Les secondes jusqu'au coup d'envoi (négatives une fois le match
       commencé), à l'horloge de la base : la page n'a pas à deviner le
       fuseau de `coupEnvoi`. */
    dans: Number(f.dans_s),
    adversaire: Number(f.home_id) === teamId ? f.away : f.home,
    domicile: Number(f.home_id) === teamId,
  });

  async function etatTifo(userId) {
    const club = await clubDe(userId);
    if (!club) return { club: null };
    const motif = motifDuTifo(club.lettres);
    const [prochain, leve] = await Promise.all([matchAPeindre(club.id), matchLeve(club.id)]);
    const r = { club, motif, casesJour: reglage('jeux.tifo_cases_jour'),
      mesCasesAujourdhui: await casesDuJour(userId), seuil: reglage('jeux.tifo_seuil'),
      gain: reglage('jeux.tifo_gain'), prochain: null, leve: null };
    if (prochain) {
      const t = await casesDuTifo(club.id, prochain.id);
      r.prochain = { ...vueMatch(prochain, club.id), cases: t.cases, peintres: t.peintres,
        fidelite: fideliteDuTifo(motif, t.cases) };
    }
    if (leve) {
      const t = await casesDuTifo(club.id, leve.id);
      const fidelite = fideliteDuTifo(motif, t.cases);
      const reussi = t.peintres > 0 && fidelite * 100 >= reglage('jeux.tifo_seuil');
      let verse = 0;
      if (reussi) {
        const [moi] = await q(
          `SELECT 1 AS ok FROM jeux_tifo WHERE team_id = ? AND fixture_id = ? AND user_id = ? LIMIT 1`,
          [club.id, leve.id, userId]);
        if (moi && reglage('jeux.actif')) {
          const v = await verser(pool, { userId, source: 'tifo', cle: `${club.id}:${leve.id}`,
            saisonId: saisonId(), gain: { echarpes: reglage('jeux.tifo_gain') } });
          verse = v.verse ? reglage('jeux.tifo_gain') : 0;
        }
      }
      r.leve = { ...vueMatch(leve, club.id), cases: t.cases, peintres: t.peintres, fidelite,
        reussi, verse };
    }
    return r;
  }

  /** Peindre une case du tifo du prochain match. */
  async function peindre(userId, fixtureId, n, couleur) {
    if (!Number.isInteger(n) || n < 0 || n >= NOMBRE_CASES
      || !Number.isInteger(couleur) || couleur < 0 || couleur >= TIFO.COULEURS) {
      return { erreur: 'jeux.error.case_invalide', status: 400 };
    }
    const club = await clubDe(userId);
    if (!club) return { erreur: 'jeux.error.sans_club', status: 409 };
    const prochain = await matchAPeindre(club.id);
    if (!prochain || Number(prochain.id) !== fixtureId) {
      return { erreur: 'jeux.error.tifo_ferme', status: 409 };
    }
    /* Le compte du jour d'abord, sous sa limite : deux poses en même temps
       n'en passent pas une de trop. */
    const limite = reglage('jeux.tifo_cases_jour');
    const plus = await q(
      `UPDATE compteurs_jour SET n = n + 1
        WHERE user_id = ? AND jour = CURDATE() AND cle = 'tifo' AND n < ?`, [userId, limite]);
    if (!plus.affectedRows) {
      const neuf = await q(
        `INSERT IGNORE INTO compteurs_jour (user_id, jour, cle, n) VALUES (?, CURDATE(), 'tifo', 1)`,
        [userId]);
      if (!neuf.affectedRows) return { erreur: 'jeux.error.tifo_plus_de_cases', status: 409 };
    }
    await q(
      `INSERT INTO jeux_tifo (team_id, fixture_id, case_n, couleur, user_id) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE couleur = VALUES(couleur), user_id = VALUES(user_id), pose_a = NOW(3)`,
      [club.id, fixtureId, n, couleur, userId]);
    return { ok: true, mesCasesAujourdhui: await casesDuJour(userId) };
  }

  /* ------------------------------------------------------------- le boss

     Une tribune rivale par semaine, du lundi au dimanche. Sa voix : tant de
     chants réussis par supporter du club, au moins un minimum. Le club la
     fait taire en réussissant ce nombre de chants dans la semaine ; chaque
     supporter qui a poussé reçoit alors sa récompense, à sa prochaine visite
     (pendant la semaine, ou la suivante pour la semaine passée). */

  async function voixDuBoss(teamId) {
    const [r] = await q(
      `SELECT COUNT(*) AS n FROM user_follows f JOIN users u ON u.public_id = f.user_id
        WHERE f.team_id = ? AND u.status = 'active'`, [teamId]);
    return Math.max(reglage('jeux.boss_voix_min'),
      reglage('jeux.boss_voix_par_supporter') * Number(r?.n ?? 0));
  }

  async function semaineDuBoss(teamId, userId, decalage) {
    const [r] = await q(
      `SELECT DATE_FORMAT(CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY - INTERVAL ? WEEK, '%Y-%m-%d') AS lundi`,
      [decalage]);
    const lundi = r.lundi;
    const [s] = await q(
      `SELECT COALESCE(SUM(coups), 0) AS total, COALESCE(SUM(IF(user_id = ?, coups, 0)), 0) AS moi
         FROM jeux_boss WHERE team_id = ? AND semaine = ?`, [userId, teamId, lundi]);
    return { lundi, retire: Number(s?.total ?? 0), mesCoups: Number(s?.moi ?? 0) };
  }

  async function etatBoss(userId) {
    const club = await clubDe(userId);
    if (!club) return { club: null };
    const voix = await voixDuBoss(club.id);
    const gain = reglage('jeux.boss_gain');
    const vue = async (decalage) => {
      const s = await semaineDuBoss(club.id, userId, decalage);
      const tombe = s.retire >= voix;
      let verse = 0;
      if (tombe && s.mesCoups > 0 && reglage('jeux.actif')) {
        const v = await verser(pool, { userId, source: 'boss', cle: `${club.id}:${s.lundi}`,
          saisonId: saisonId(), gain: { echarpes: gain } });
        verse = v.verse ? gain : 0;
      }
      return { ...s, voix, tombe, verse };
    };
    return { club, gain, semaine: await vue(0), precedente: await vue(1) };
  }

  /* -------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));

  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (SCHEMA_INCOMPLET.has(e?.code)) {
      return res.status(503).json({ error: 'jeux.error.schema', raison: 'schema' });
    }
    console.error('[jeux]', req.method, req.path, e.message);
    res.status(500).json({ error: 'jeux.error.interne' });
  });
  const repondre = (res, r) => (r?.erreur
    ? res.status(r.status ?? 400).json({ error: r.erreur }) : res.json(r));
  const ferme = (res) => res.status(409).json({ error: 'jeux.error.inactif' });
  const idDe = (req) => {
    const n = Number(req.params.id);
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  /** L'état des deux jeux pour ce joueur, et les règles du moment. */
  router.get('/', requireAuth, safe(async (req, res) => {
    const moi = req.user.id;
    const [jongles, tirs, chant, deplacement, aujourdhui, formes] = await Promise.all([
      etatJongles(moi), etatTirs(moi), etatSeul(moi, 'chant'), etatSeul(moi, 'deplacement'),
      versesDuJour(moi), habillerJoueurs(q, [moi]).catch(() => new Map()),
    ]);
    res.json({
      actif: Boolean(reglage('jeux.actif')),
      saison: saisonVue(),
      avatar: formes.get(moi)?.avatar ?? null,
      echarpes: { aujourdhui, plafond: reglage('jeux.echarpes_jour') },
      gains: { jongles: { parEcharpe: reglage('jeux.jongles_par_echarpe'),
        maxPartie: reglage('jeux.jongles_max_partie') }, tirs: GAINS_TIRS(), ...GAINS_SEULS() },
      jongles, tirs, chant, deplacement,
    });
  }));

  /** Ce qui attend le joueur, pour le sticker du menu : un défi, un résultat. */
  router.get('/attente', requireAuth, safe(async (req, res) => {
    const [r] = await q(
      `SELECT SUM(b_id = ? AND ami = 1 AND joue_a IS NULL) AS defis,
              SUM(a_id = ? AND joue_a IS NOT NULL AND vu_a = 0) AS resultats
         FROM jeux_tirs WHERE (a_id = ? OR b_id = ?)`, [req.user.id, req.user.id,
      req.user.id, req.user.id]);
    res.json({ defis: Number(r?.defis ?? 0), resultats: Number(r?.resultats ?? 0) });
  }));

  router.get('/classement/:jeu', requireAuth, safe(async (req, res) => {
    const jeu = req.params.jeu;
    if (jeu !== 'jongles' && jeu !== 'tirs' && !SEULS.has(jeu)) {
      return res.status(404).json({ error: 'jeux.error.jeu_inconnu' });
    }
    const portee = req.query.portee === 'amis' ? 'amis' : 'tous';
    res.json({ jeu, portee, saison: saisonVue(), ...await classement(jeu, req.user.id, portee) });
  }));

  router.post('/jongles', requireAuth, safe(async (req, res) => {
    if (!reglage('jeux.actif')) return ferme(res);
    res.json(await ouvrirJongles(req.user.id));
  }));

  router.post('/jongles/:id', requireAuth, safe(async (req, res) => {
    const id = idDe(req);
    if (!id) return res.status(400).json({ error: 'jeux.error.partie_inconnue' });
    const score = Number(req.body?.score);
    repondre(res, await finirJongles(req.user.id, id, score, req.body?.frappes));
  }));

  /** Tirer : contre un ami (`ami` : son identifiant), ou contre le premier venu. */
  router.post('/tirs', requireAuth, safe(async (req, res) => {
    if (!reglage('jeux.actif')) return ferme(res);
    const jeu = jeuDeTirs(req.body?.jeu);
    if (!jeu) return res.status(400).json({ error: 'jeux.error.jeu_invalide' });
    const ami = typeof req.body?.ami === 'string' && req.body.ami ? req.body.ami : null;
    repondre(res, ami ? await defier(req.user.id, ami, jeu) : await tirerAuHasard(req.user.id, jeu));
  }));

  /** Relever le défi d'un ami. */
  router.post('/tirs/:id', requireAuth, safe(async (req, res) => {
    if (!reglage('jeux.actif')) return ferme(res);
    const id = idDe(req);
    const jeu = jeuDeTirs(req.body?.jeu);
    if (!id || !jeu) return res.status(400).json({ error: 'jeux.error.jeu_invalide' });
    repondre(res, await releverDefi(req.user.id, id, jeu));
  }));

  /** Le premier tireur a vu le résultat de ses séries. */
  router.post('/tirs-vus', requireAuth, safe(async (req, res) => {
    await q(`UPDATE jeux_tirs SET vu_a = 1 WHERE a_id = ? AND joue_a IS NOT NULL AND vu_a = 0`,
      [req.user.id]);
    res.json({ ok: true });
  }));

  /** Ouvrir une partie de chant en rythme ou de déplacement. */
  router.post('/partie/:jeu', requireAuth, safe(async (req, res) => {
    if (!SEULS.has(req.params.jeu)) return res.status(404).json({ error: 'jeux.error.jeu_inconnu' });
    if (!reglage('jeux.actif')) return ferme(res);
    res.json(await ouvrirPartie(req.user.id, req.params.jeu));
  }));

  /** La finir avec ses gestes : `frappes` (chant) ou `gestes` (déplacement). */
  router.post('/partie/:jeu/:id', requireAuth, safe(async (req, res) => {
    const jeu = req.params.jeu;
    if (!SEULS.has(jeu)) return res.status(404).json({ error: 'jeux.error.jeu_inconnu' });
    const id = idDe(req);
    if (!id) return res.status(400).json({ error: 'jeux.error.partie_inconnue' });
    const gestes = jeu === 'chant' ? req.body?.frappes : req.body?.gestes;
    repondre(res, await finirPartie(req.user.id, jeu, id, gestes));
  }));

  router.get('/tifo', requireAuth, safe(async (req, res) => {
    res.json({ actif: Boolean(reglage('jeux.actif')), ...await etatTifo(req.user.id) });
  }));

  router.post('/tifo', requireAuth, safe(async (req, res) => {
    if (!reglage('jeux.actif')) return ferme(res);
    repondre(res, await peindre(req.user.id, Number(req.body?.match), Number(req.body?.case),
      Number(req.body?.couleur)));
  }));

  router.get('/boss', requireAuth, safe(async (req, res) => {
    res.json({ actif: Boolean(reglage('jeux.actif')), ...await etatBoss(req.user.id) });
  }));

  return { router, classement, finirJongles, ouvrirJongles, tirerAuHasard, defier, releverDefi,
    mesSeries, reglerLesAttentes, ouvrirPartie, finirPartie, etatTifo, peindre, etatBoss };
}

export { TIRS, JONGLES, CHANT, COURSE };
