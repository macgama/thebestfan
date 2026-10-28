import express from 'express';
import { reglage } from '../../shared/reglages.js';
import { niveauPour } from '../../shared/niveau.js';
import { GESTE_PAR_ID, GESTE_PAUSE_MS, gesteEnvoyable } from '../../shared/amis-ensemble.js';
import { verser } from '../recompenses.js';
import { avatarsDe } from '../fanzzy/avatar.js';
import { auStade, parIdentifiant, racineDe } from '../fanzzy/catalogue.js';

/**
 * Jouer entre amis (Gaël, 28 octobre 2026).
 *
 * La liste d'amis savait qui l'on connaît ; elle ne donnait presque rien à
 * faire ensemble. Ce module ajoute ce qui se fait **entre deux amis mutuels**,
 * et rien qu'entre eux :
 *
 *   — **la fiche d'un ami** : sa collection, son deck, ses cartes-souvenirs,
 *     et ce qu'on a ou n'a pas en commun ;
 *   — **les gestes** : une liste fermée (`shared/amis-ensemble.js`), jamais
 *     un texte. C'est la règle qui tient tout le reste : un jeu qui compte des
 *     mineurs ne transporte pas de messages libres ;
 *   — **le cadeau du jour** : quelques écharpes, offertes par le jeu au nom
 *     de l'ami — rien n'est pris dans la bourse de celui qui offre ;
 *   — **le défi de la semaine** : des chants réussis au Virage, comptés à
 *     deux, sur les lignes que `virage_presence` garde déjà ;
 *   — **l'échange de doubles** : un exemplaire en trop contre un exemplaire
 *     en trop, proposé par l'un, accepté par l'autre ;
 *   — **le prêt** : un Fanzzy d'un ami, à jouer dans son deck jusqu'à minuit.
 *
 * Le bonus « côte à côte » vit dans la salle du Virage (`ferveur/virage.js`),
 * qui seule sait qui pousse à côté de qui.
 *
 * ## Les écharpes passent par le grand livre
 *
 * Le cadeau et le défi versent par `verser` (`recompenses.js`) : une seule
 * fois par clé, sous le disjoncteur du jour, jamais sans trace. Le cadeau a sa
 * table en plus — une ligne par ami et par jour — parce que c'est elle qui
 * dit « déjà offert aujourd'hui » à la fiche, et que sa clé primaire tient la
 * règle mieux que n'importe quel `SELECT` avant un `INSERT`.
 */

/** Combien de gestes reçus le fil garde à l'écran. */
const FIL_MAX = 30;

export function createEnsemble({ pool, requireAuth }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const fail = (code, extra) => Object.assign(new Error(code), { code, extra });
  const actif = () => Boolean(reglage('amis.actif'));
  const paire = (x, y) => (x < y ? [x, y] : [y, x]);

  /** Sont-ils amis mutuels, et l'autre est-il un compte actif ? */
  async function amis(userId, autreId) {
    if (!autreId || autreId === userId) return false;
    const [a, b] = paire(userId, autreId);
    const [l] = await q(
      `SELECT 1 FROM amities am JOIN users u ON u.public_id = ?
        WHERE am.a = ? AND am.b = ? AND am.etat = 'amis' AND u.status = 'active'`,
      [autreId, a, b]);
    return Boolean(l);
  }
  async function exigerAmis(userId, autreId) {
    if (!actif()) throw fail('amis.error.ensemble_eteint');
    if (!(await amis(userId, autreId))) throw fail('amis.error.pas_ami');
  }

  const nomDe = (id, stage = 1) => (auStade(id, stage) ?? parIdentifiant(id))?.nom ?? id;
  const rarDe = (id) => parIdentifiant(id)?.rar ?? null;

  /* ------------------------------------------------------------ la fiche */

  /** Le lundi de la semaine de jeu, en SQL : l'horloge des quotas. */
  const LUNDI = 'DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)';

  /** Les chants réussis au Virage cette semaine, par joueur. */
  async function chantsDeLaSemaine(ids) {
    const lignes = await q(
      `SELECT user_id, COALESCE(SUM(chants), 0) AS n FROM virage_presence
        WHERE user_id IN (${ids.map(() => '?').join(',')}) AND joined_at >= ${LUNDI}
        GROUP BY user_id`, ids).catch((e) => {
      // Une base sans la colonne `chants` (quotidien.sql) : pas de défi.
      if (e?.code === 'ER_BAD_FIELD_ERROR') return [];
      throw e;
    });
    return new Map(lignes.map((l) => [l.user_id, Number(l.n) || 0]));
  }

  /** La clé du défi au grand livre : le lundi et l'ami, 39 caractères. */
  async function cleDuDefi(autreId) {
    const [{ l }] = await q(`SELECT DATE_FORMAT(${LUNDI}, '%y%m%d') AS l`);
    return `${l}:${String(autreId).replace(/-/g, '')}`;
  }

  async function etatDuDefi(userId, autreId) {
    const cible = reglage('amis.defi_cible');
    const chants = await chantsDeLaSemaine([userId, autreId]);
    const moi = chants.get(userId) ?? 0;
    const lui = chants.get(autreId) ?? 0;
    const cle = await cleDuDefi(autreId);
    const [pris] = await q(
      `SELECT 1 FROM recompenses WHERE user_id = ? AND source = 'defi' AND cle = ?`,
      [userId, cle]).catch(() => []);
    const [{ n }] = await q(
      `SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ? AND source = 'defi'
          AND cle LIKE CONCAT(DATE_FORMAT(${LUNDI}, '%y%m%d'), ':%')`, [userId])
      .catch(() => [{ n: 0 }]);
    return {
      cible, moi, lui,
      releve: moi >= 1 && lui >= 1 && moi + lui >= cible,
      recupere: Boolean(pris),
      restants: Math.max(0, reglage('amis.defis_semaine') - Number(n)),
      echarpes: reglage('amis.defi_echarpes'),
    };
  }

  async function fiche(userId, autreId) {
    await exigerAmis(userId, autreId);

    const [qui] = await q(
      `SELECT u.public_id AS userId, u.pseudo, w.active_fanzzy, w.active_evo, w.active_etat,
              w.xp
         FROM users u LEFT JOIN user_wallet w ON w.user_id = u.public_id
        WHERE u.public_id = ?`, [autreId]).catch(async (e) => {
      if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
      return q(`SELECT u.public_id AS userId, u.pseudo, w.active_fanzzy, w.active_evo,
                       w.active_etat, NULL AS xp
                  FROM users u LEFT JOIN user_wallet w ON w.user_id = u.public_id
                 WHERE u.public_id = ?`, [autreId]);
    });
    let avatar = null;
    try { avatar = (await avatarsDe(q, [qui])).get(autreId)?.avatar ?? null; } catch (e) {
      if (!/catalogue/i.test(e?.message ?? '')) throw e;
    }
    const xp = qui.xp == null ? NaN : Number(qui.xp);

    const [siens, miens, deck, souvenirs, clubs] = await Promise.all([
      q(`SELECT fanzzy_id, stage, copies FROM user_fanzzy WHERE user_id = ?`, [autreId]),
      q(`SELECT fanzzy_id, stage, copies FROM user_fanzzy WHERE user_id = ?`, [userId]),
      q(`SELECT contenu FROM user_decks WHERE user_id = ? AND actif = 1 LIMIT 1`, [autreId])
        .catch(() => []),
      q(`SELECT COUNT(*) AS n FROM user_souvenirs WHERE user_id = ?`, [autreId])
        .catch(() => [{ n: 0 }]),
      q(`SELECT t.name FROM user_follows f
           JOIN user_follows moi ON moi.team_id = f.team_id AND moi.user_id = ?
           LEFT JOIN teams t ON t.id = f.team_id
          WHERE f.user_id = ?`, [userId, autreId]).catch(() => []),
    ]);
    const mesFanzzy = new Map(miens.map((l) => [l.fanzzy_id, l]));
    const sesFanzzy = new Map(siens.map((l) => [l.fanzzy_id, l]));
    const carte = (l, autre) => ({
      id: l.fanzzy_id, stage: Number(l.stage) || 1, nom: nomDe(l.fanzzy_id, Number(l.stage) || 1),
      rar: rarDe(l.fanzzy_id), double: Number(l.copies) > 1, chezLautre: autre.has(l.fanzzy_id),
    });
    const brut = deck[0]?.contenu;
    const contenu = typeof brut === 'string' ? JSON.parse(brut) : brut;

    const [cadeau] = await q(
      `SELECT 1 FROM amis_cadeaux WHERE de = ? AND a = ? AND jour = CURDATE()`,
      [userId, autreId]);
    const [{ n: offerts }] = await q(
      `SELECT COUNT(*) AS n FROM amis_cadeaux WHERE de = ? AND jour = CURDATE()`, [userId]);
    const echanges = await q(
      `SELECT id, de, donne, demande FROM amis_echanges
        WHERE etat = 'proposee' AND ((de = ? AND a = ?) OR (de = ? AND a = ?))
        ORDER BY le DESC`, [userId, autreId, autreId, userId]);
    const pret = await pretDe(userId);

    return {
      ami: {
        id: autreId, pseudo: qui.pseudo, avatar,
        ...(Number.isFinite(xp) && xp >= 0 ? { niveau: niveauPour(xp) } : {}),
        clubs: clubs.map((c) => c.name).filter(Boolean),
      },
      collection: {
        total: siens.length,
        communs: siens.filter((l) => mesFanzzy.has(l.fanzzy_id)).length,
        siens: siens.map((l) => carte(l, mesFanzzy)),
        tesDoubles: miens.filter((l) => Number(l.copies) > 1).map((l) => carte(l, sesFanzzy)),
      },
      deck: (contenu?.fanzzy ?? []).map((f) => racineDe(f.id))
        .map((id) => ({ id, nom: nomDe(id), rar: rarDe(id) })),
      souvenirs: Number(souvenirs[0]?.n ?? 0),
      cadeau: {
        offert: Boolean(cadeau),
        restants: Math.max(0, reglage('amis.cadeaux_jour') - Number(offerts)),
        echarpes: reglage('amis.cadeau_echarpes'),
      },
      defi: await etatDuDefi(userId, autreId),
      echanges: echanges.map((e) => ({
        id: String(e.id), deMoi: e.de === userId,
        donne: { id: e.donne, nom: nomDe(e.donne), rar: rarDe(e.donne) },
        demande: { id: e.demande, nom: nomDe(e.demande), rar: rarDe(e.demande) },
      })),
      pret: {
        actif: Boolean(reglage('amis.pret_actif')),
        mien: pret ? { ...pret, nom: nomDe(pret.id, pret.stage) } : null,
      },
      actif: actif(),
    };
  }

  /* ------------------------------------------------------------ les gestes */

  /** Écrit un geste au fil de `a`. Le jeu s'en sert aussi pour ses nouvelles. */
  async function poserGeste(de, a, geste) {
    await q(`INSERT INTO amis_gestes (de, a, geste) VALUES (?, ?, ?)`, [de, a, geste]);
  }

  async function envoyerGeste(userId, autreId, geste) {
    if (!gesteEnvoyable(geste)) throw fail('amis.error.geste_inconnu');
    await exigerAmis(userId, autreId);
    const [{ n }] = await q(
      `SELECT COUNT(*) AS n FROM amis_gestes WHERE de = ? AND le >= CURDATE()
          AND geste NOT IN ('cadeau','pret','echange')`, [userId]);
    if (Number(n) >= reglage('amis.gestes_jour')) throw fail('amis.error.trop_de_gestes');
    const [recent] = await q(
      `SELECT 1 FROM amis_gestes WHERE de = ? AND a = ? AND geste = ?
          AND le > NOW(3) - INTERVAL ? SECOND`,
      [userId, autreId, geste, Math.round(GESTE_PAUSE_MS / 1000)]);
    if (recent) throw fail('amis.error.geste_recent');
    await poserGeste(userId, autreId, geste);
    await q(`DELETE FROM amis_gestes WHERE de = ? AND le < NOW(3) - INTERVAL 30 DAY`, [userId])
      .catch(() => {});
    return { envoye: geste };
  }

  /**
   * Le fil de ce qu'on a reçu : les sept derniers jours, du plus récent au
   * plus ancien. Un geste d'un ancien ami ou d'un compte effacé n'y paraît
   * plus : on ne montre que des amis mutuels actifs.
   */
  async function fil(userId) {
    /* Trente jours, puis oubliés (`/confidentialite`) : le ménage se fait ici,
       sur les siens, à chaque lecture. */
    await q(`DELETE FROM amis_gestes WHERE a = ? AND le < NOW(3) - INTERVAL 30 DAY`, [userId])
      .catch(() => {});
    const lignes = await q(
      `SELECT g.id, g.de AS userId, g.geste, g.vu,
              UNIX_TIMESTAMP(g.le) * 1000 AS le,
              u.pseudo, w.active_fanzzy, w.active_evo, w.active_etat
         FROM amis_gestes g
         JOIN users u ON u.public_id = g.de AND u.status = 'active'
         JOIN amities am ON am.a = LEAST(g.de, g.a) AND am.b = GREATEST(g.de, g.a)
                        AND am.etat = 'amis'
         LEFT JOIN user_wallet w ON w.user_id = g.de
        WHERE g.a = ? AND g.le > NOW(3) - INTERVAL 7 DAY
        ORDER BY g.le DESC, g.id DESC
        LIMIT ${FIL_MAX}`, [userId]);
    let av = new Map();
    try { av = await avatarsDe(q, lignes); } catch (e) {
      if (!/catalogue/i.test(e?.message ?? '')) throw e;
    }
    return lignes.filter((l) => GESTE_PAR_ID.has(l.geste)).map((l) => ({
      id: String(l.id), de: { id: l.userId, pseudo: l.pseudo, avatar: av.get(l.userId)?.avatar ?? null },
      geste: l.geste, le: Number(l.le), neuf: !Number(l.vu),
    }));
  }

  async function nonVus(userId) {
    try {
      const [{ n }] = await q(
        `SELECT COUNT(*) AS n FROM amis_gestes WHERE a = ? AND vu = 0
            AND le > NOW(3) - INTERVAL 7 DAY`, [userId]);
      const [{ e }] = await q(
        `SELECT COUNT(*) AS e FROM amis_echanges WHERE a = ? AND etat = 'proposee'`, [userId]);
      return { gestes: Number(n), echanges: Number(e) };
    } catch (err) {
      if (err?.code === 'ER_NO_SUCH_TABLE') return { gestes: 0, echanges: 0 };
      throw err;
    }
  }

  async function marquerVus(userId) {
    await q(`UPDATE amis_gestes SET vu = 1 WHERE a = ? AND vu = 0`, [userId]);
    return { ok: true };
  }

  /* ------------------------------------------------------------ le cadeau */

  async function offrir(userId, autreId) {
    await exigerAmis(userId, autreId);
    const montant = reglage('amis.cadeau_echarpes');
    if (!(montant > 0)) throw fail('amis.error.ensemble_eteint');
    const [{ n }] = await q(
      `SELECT COUNT(*) AS n FROM amis_cadeaux WHERE de = ? AND jour = CURDATE()`, [userId]);
    if (Number(n) >= reglage('amis.cadeaux_jour')) throw fail('amis.error.trop_de_cadeaux');
    try {
      await q(`INSERT INTO amis_cadeaux (de, a, jour) VALUES (?, ?, CURDATE())`, [userId, autreId]);
    } catch (e) {
      if (e?.code === 'ER_DUP_ENTRY') throw fail('amis.error.deja_offert');
      throw e;
    }
    const [{ id }] = await q(
      `SELECT id FROM amis_cadeaux WHERE de = ? AND a = ? AND jour = CURDATE()`, [userId, autreId]);

    /* Ce qu'il reçoit d'abord. Un refus du grand livre — son plafond du jour
       est atteint — défait le cadeau : il pourra être offert demain, et celui
       qui offre le sait tout de suite. */
    const recu = await verser(pool, { userId: autreId, source: 'cadeau', cle: `C${id}`,
      gain: { echarpes: montant } });
    if (!recu.verse) {
      await q(`DELETE FROM amis_cadeaux WHERE id = ?`, [id]);
      throw fail(recu.raison === 'plafond' ? 'amis.error.plafond_ami' : 'amis.error.cadeau_refuse');
    }
    await poserGeste(userId, autreId, 'cadeau').catch(() => {});

    /* Le merci : un peu pour celui qui offre. Son propre plafond peut le
       refuser — le cadeau, lui, est parti. */
    const merci = reglage('amis.cadeau_merci');
    let gagne = 0;
    if (merci > 0) {
      const r = await verser(pool, { userId, source: 'cadeau', cle: `M${id}`,
        gain: { echarpes: merci } }).catch(() => ({ verse: false }));
      if (r.verse) gagne = merci;
    }
    return { offert: montant, merci: gagne };
  }

  /* -------------------------------------------------------------- le défi */

  async function recupererDefi(userId, autreId) {
    await exigerAmis(userId, autreId);
    const echarpes = reglage('amis.defi_echarpes');
    if (!(echarpes > 0)) throw fail('amis.error.ensemble_eteint');
    const cle = await cleDuDefi(autreId);
    const r = await verser(pool, {
      userId, source: 'defi', cle, gain: { echarpes },
      /* Le recompte, sous le verrou du joueur : la cible et le quota de la
         semaine se relisent au moment de verser, pas à l'affichage. */
      verifier: async (conn) => {
        const d = await etatDuDefi(userId, autreId);
        if (!d.releve) return 'incomplet';
        const [[{ n }]] = await conn.execute(
          `SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ? AND source = 'defi'
              AND cle LIKE ?`, [userId, `${cle.slice(0, 6)}:%`]);
        return Number(n) >= reglage('amis.defis_semaine') ? 'quota' : true;
      },
    });
    if (!r.verse) {
      throw fail({ deja: 'amis.error.defi_deja', incomplet: 'amis.error.defi_incomplet',
        quota: 'amis.error.defi_quota', plafond: 'amis.error.plafond' }[r.raison]
        ?? 'amis.error.defi_refuse');
    }
    return { echarpes };
  }

  /* ---------------------------------------------------------- les échanges */

  async function echangesDuJour(userId) {
    const [{ n }] = await q(
      `SELECT COUNT(*) AS n FROM amis_echanges
        WHERE (de = ? AND le >= CURDATE())
           OR (a = ? AND etat = 'acceptee' AND repondu_le >= CURDATE())`, [userId, userId]);
    return Number(n);
  }

  async function copiesDe(userId, fanzzyId, conn = null) {
    const lire = conn
      ? async (sql, p) => (await conn.execute(sql, p))[0]
      : q;
    const [l] = await lire(
      `SELECT copies FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?${conn ? ' FOR UPDATE' : ''}`,
      [userId, fanzzyId]);
    return Number(l?.copies ?? 0);
  }

  async function proposer(userId, autreId, donneBrut, demandeBrut) {
    await exigerAmis(userId, autreId);
    if (!(reglage('amis.echanges_jour') > 0)) throw fail('amis.error.ensemble_eteint');
    const donne = racineDe(String(donneBrut ?? ''));
    const demande = racineDe(String(demandeBrut ?? ''));
    if (!parIdentifiant(donne) || !parIdentifiant(demande)) throw fail('amis.error.echange_inconnu');
    if (donne === demande) throw fail('amis.error.echange_meme');
    if ((await copiesDe(userId, donne)) < 2) throw fail('amis.error.pas_ton_double');
    if ((await copiesDe(autreId, demande)) < 2) throw fail('amis.error.pas_son_double');
    if ((await echangesDuJour(userId)) >= reglage('amis.echanges_jour')) {
      throw fail('amis.error.trop_d_echanges');
    }
    const [deja] = await q(
      `SELECT 1 FROM amis_echanges WHERE de = ? AND a = ? AND etat = 'proposee'`, [userId, autreId]);
    if (deja) throw fail('amis.error.echange_en_cours');
    await q(`INSERT INTO amis_echanges (de, a, donne, demande) VALUES (?, ?, ?, ?)`,
      [userId, autreId, donne, demande]);
    return { propose: true };
  }

  /**
   * Accepter ou refuser un échange reçu ; annuler le sien.
   *
   * **Tout se relit sous verrou** : les deux lignes de possession, dans un
   * ordre fixe — celle du plus petit identifiant d'abord — pour que deux
   * échanges croisés acceptés en même temps ne s'attendent pas l'un l'autre.
   * Un double qui n'en est plus un (il l'a échangé ailleurs entre-temps)
   * fait échouer l'échange, qui passe à « annulée » : il ne reviendrait pas.
   */
  async function repondreEchange(userId, idBrut, oui) {
    if (!actif()) throw fail('amis.error.ensemble_eteint');
    const id = Number(idBrut);
    if (!Number.isInteger(id) || id < 1) throw fail('amis.error.echange_introuvable');
    const [e] = await q(`SELECT * FROM amis_echanges WHERE id = ? AND etat = 'proposee'`, [id]);
    if (!e || (e.a !== userId && e.de !== userId)) throw fail('amis.error.echange_introuvable');

    if (!oui || e.de === userId) {
      // Refuser celui qu'on reçoit, ou retirer le sien.
      await q(`UPDATE amis_echanges SET etat = ?, repondu_le = NOW(3)
                WHERE id = ? AND etat = 'proposee'`, [e.de === userId ? 'annulee' : 'refusee', id]);
      return { etat: e.de === userId ? 'annulee' : 'refusee' };
    }
    if (!(await amis(userId, e.de))) throw fail('amis.error.pas_ami');
    if ((await echangesDuJour(userId)) >= reglage('amis.echanges_jour')) {
      throw fail('amis.error.trop_d_echanges');
    }

    const conn = await pool.getConnection();
    let rate = null;
    try {
      await conn.beginTransaction();
      const [x] = await conn.execute(
        `SELECT etat FROM amis_echanges WHERE id = ? FOR UPDATE`, [id]);
      if (x[0]?.etat !== 'proposee') { rate = 'amis.error.echange_introuvable'; }
      const verrous = [[e.de, e.donne], [e.a, e.demande]]
        .sort((p, r) => (p[0] < r[0] ? -1 : 1));
      const copies = new Map();
      if (!rate) {
        for (const [u, f] of verrous) copies.set(`${u}:${f}`, await copiesDe(u, f, conn));
        if (copies.get(`${e.de}:${e.donne}`) < 2 || copies.get(`${e.a}:${e.demande}`) < 2) {
          rate = 'amis.error.plus_de_double';
        }
      }
      if (rate) {
        await conn.execute(`UPDATE amis_echanges SET etat = 'annulee', repondu_le = NOW(3)
                             WHERE id = ? AND etat = 'proposee'`, [id]);
        await conn.commit();
        throw fail(rate);
      }
      const passer = async (de, a, f) => {
        await conn.execute(
          `UPDATE user_fanzzy SET copies = copies - 1 WHERE user_id = ? AND fanzzy_id = ?`, [de, f]);
        await conn.execute(
          `INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE copies = copies + 1`, [a, f]);
        await conn.execute(
          `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id, equipped)
           VALUES (?, ?, 1, 'base', 1)`, [a, f]);
      };
      await passer(e.de, e.a, e.donne);
      await passer(e.a, e.de, e.demande);
      await conn.execute(`UPDATE amis_echanges SET etat = 'acceptee', repondu_le = NOW(3)
                           WHERE id = ?`, [id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
    /* Ce qui arrive est une nouveauté, comme au booster ; et l'autre le
       sait par son fil. */
    await q(`INSERT INTO user_nouveautes (user_id, cle, sorte) VALUES (?, ?, 'fanzzy'), (?, ?, 'fanzzy')
             ON DUPLICATE KEY UPDATE got_at = got_at`,
    [e.a, `fanzzy:${e.donne}`, e.de, `fanzzy:${e.demande}`]).catch(() => {});
    await poserGeste(userId, e.de, 'echange').catch(() => {});
    return { etat: 'acceptee', recu: { id: e.donne, nom: nomDe(e.donne) } };
  }

  /* -------------------------------------------------------------- le prêt */

  async function pretDe(userId) {
    const [l] = await q(
      `SELECT p.fanzzy_id, p.stage, p.preteur, u.pseudo FROM amis_prets p
         LEFT JOIN users u ON u.public_id = p.preteur
        WHERE p.emprunteur = ? AND p.jour = CURDATE()`, [userId]);
    return l ? { id: l.fanzzy_id, stage: Number(l.stage) || 1, preteur: l.pseudo ?? null,
      preteurId: l.preteur } : null;
  }

  async function emprunter(userId, autreId, fanzzyBrut) {
    await exigerAmis(userId, autreId);
    if (!reglage('amis.pret_actif')) throw fail('amis.error.ensemble_eteint');
    const f = racineDe(String(fanzzyBrut ?? ''));
    if (await pretDe(userId)) throw fail('amis.error.pret_deja');
    const [sien] = await q(
      `SELECT stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ? AND copies >= 1`,
      [autreId, f]);
    if (!sien) throw fail('amis.error.pret_inconnu');
    if ((await copiesDe(userId, f)) >= 1) throw fail('amis.error.pret_deja_a_toi');
    try {
      await q(`INSERT INTO amis_prets (emprunteur, jour, preteur, fanzzy_id, stage)
               VALUES (?, CURDATE(), ?, ?, ?)`, [userId, autreId, f, Number(sien.stage) || 1]);
    } catch (e) {
      if (e?.code === 'ER_DUP_ENTRY') throw fail('amis.error.pret_deja');
      throw e;
    }
    await poserGeste(userId, autreId, 'pret').catch(() => {});
    return { pret: { id: f, stage: Number(sien.stage) || 1, nom: nomDe(f, Number(sien.stage) || 1) } };
  }

  /* ------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '2kb' }));
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (res.headersSent) return;
    const propre = String(e.code ?? '').startsWith('amis.');
    if (!propre) console.error('[amis ensemble]', e.message);
    res.status(400).json({ error: propre ? e.code : 'amis.error.server', ...(e.extra ?? {}) });
  });
  const id = (v) => String(v ?? '');

  router.get('/nouveau', requireAuth, safe(async (req, res) =>
    res.json(await nonVus(req.user.id))));
  router.get('/fiche/:id', requireAuth, safe(async (req, res) =>
    res.json(await fiche(req.user.id, id(req.params.id)))));
  router.get('/fil', requireAuth, safe(async (req, res) =>
    res.json({ fil: await fil(req.user.id) })));
  router.post('/fil/vu', requireAuth, safe(async (req, res) =>
    res.json(await marquerVus(req.user.id))));
  router.post('/geste', requireAuth, safe(async (req, res) =>
    res.json(await envoyerGeste(req.user.id, id(req.body?.id), id(req.body?.geste)))));
  router.post('/cadeau', requireAuth, safe(async (req, res) =>
    res.json(await offrir(req.user.id, id(req.body?.id)))));
  router.post('/defi', requireAuth, safe(async (req, res) =>
    res.json(await recupererDefi(req.user.id, id(req.body?.id)))));
  router.post('/echange', requireAuth, safe(async (req, res) =>
    res.json(await proposer(req.user.id, id(req.body?.id), req.body?.donne, req.body?.demande))));
  router.post('/echange/reponse', requireAuth, safe(async (req, res) =>
    res.json(await repondreEchange(req.user.id, req.body?.echange, Boolean(req.body?.ok)))));
  router.post('/pret', requireAuth, safe(async (req, res) =>
    res.json(await emprunter(req.user.id, id(req.body?.id), req.body?.fanzzy))));

  return { router, fiche, envoyerGeste, fil, nonVus, marquerVus, offrir, recupererDefi,
    proposer, repondreEchange, emprunter, pretDe, etatDuDefi };
}
