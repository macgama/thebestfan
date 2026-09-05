import express from 'express';
import { DEX, BY_ID, SCARVES } from '../../shared/fanzzy/dex.js';
import { SKINS, STUFF, ACTIONS, SKIN_BY_ID, STUFF_BY_ID, combine }
  from '../../shared/fanzzy/inventaire.js';

/**
 * L'arrivée d'un joueur, et ce qu'il possède.
 *
 * Trois choses au moment de l'inscription : il choisit son club, il reçoit
 * deux emplacements de suivi, et il ouvre un paquet de bienvenue. Ensuite
 * l'inventaire suit — skins et équipement.
 *
 * Le paquet de bienvenue n'est pas un booster ordinaire : il est **garanti**.
 * Un joueur qui tombe sur cinq communes à sa première ouverture ne revient
 * pas. Il contient donc toujours un Fanzzy peu commun au minimum, une pièce
 * d'équipement et des écharpes.
 */

export const SLOTS_DEPART = 2;
export const SLOTS_MAX = 8;
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

export function createOnboarding({ pool, requireAuth, football }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const fail = (code) => Object.assign(new Error(code), { code });

  /* ------------------------------------------------------------- état */

  async function state(userId) {
    await q(`INSERT IGNORE INTO user_wallet (user_id) VALUES (?)`, [userId]);
    const w = (await q(
      `SELECT scarves, packs, follow_slots, onboarded_at, active_fanzzy, action_cards
         FROM user_wallet WHERE user_id = ?`, [userId]))[0];

    const [suivis, skins, stuff] = await Promise.all([
      q(`SELECT f.team_id, f.is_main, t.name, t.logo, t.country
           FROM user_follows f LEFT JOIN teams t ON t.id = f.team_id
          WHERE f.user_id = ? ORDER BY f.is_main DESC`, [userId]),
      q(`SELECT fanzzy_id, skin_id, equipped FROM user_skins WHERE user_id = ?`, [userId]),
      q(`SELECT stuff_id, copies, slot FROM user_stuff WHERE user_id = ?`, [userId]),
    ]);

    return {
      onboarded: Boolean(w.onboarded_at),
      slots: { used: suivis.length, total: w.follow_slots, max: SLOTS_MAX },
      follows: suivis,
      scarves: w.scarves,
      packs: w.packs,
      activeFanzzy: w.active_fanzzy,
      actions: typeof w.action_cards === 'string'
        ? JSON.parse(w.action_cards) : (w.action_cards ?? []),
      skins,
      stuff,
      worn: stuff.filter((s) => s.slot).map((s) => s.stuff_id),
    };
  }

  /* ---------------------------------------------- emplacements de suivi */

  /**
   * Suivre un club. C'est ici que les emplacements sont défendus : la route
   * football ne les connaît pas, et un client modifié pourrait sinon suivre
   * cinquante équipes.
   */
  async function follow(userId, teamId, { main = false } = {}) {
    const w = (await q(`SELECT follow_slots FROM user_wallet WHERE user_id = ?`, [userId]))[0];
    const deja = await q(`SELECT team_id FROM user_follows WHERE user_id = ?`, [userId]);
    if (!deja.some((d) => d.team_id === teamId) && deja.length >= (w?.follow_slots ?? SLOTS_DEPART)) {
      throw fail('onboarding.error.no_slot');
    }
    if (main) await q(`UPDATE user_follows SET is_main = 0 WHERE user_id = ?`, [userId]);
    await q(
      `INSERT INTO user_follows (user_id, team_id, is_main) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE is_main = VALUES(is_main)`,
      [userId, teamId, main ? 1 : 0]);
    // Premier suivi d'un club inconnu : on charge son calendrier en fond.
    football?.poller.refreshTeam(teamId).catch(() => {});
  }

  /** Un emplacement supplémentaire s'achète, il ne se donne pas. */
  const PRIX_SLOT = [0, 0, 120, 220, 380, 600, 900, 1300];

  async function buySlot(userId) {
    const w = (await q(`SELECT follow_slots, scarves FROM user_wallet WHERE user_id = ?`, [userId]))[0];
    if (w.follow_slots >= SLOTS_MAX) throw fail('onboarding.error.max_slots');
    const prix = PRIX_SLOT[w.follow_slots] ?? 1300;
    const [d] = await pool.execute(
      `UPDATE user_wallet SET scarves = scarves - ?, follow_slots = follow_slots + 1
        WHERE user_id = ? AND scarves >= ?`, [prix, userId, prix]);
    if (!d.affectedRows) throw fail('onboarding.error.not_enough_scarves');
    return { slots: w.follow_slots + 1, spent: prix };
  }

  /* --------------------------------------------------- paquet d'arrivée */

  /**
   * Le paquet de bienvenue. Cinq cartes, toujours les mêmes catégories :
   * deux Fanzzy dont un peu commun au moins, une pièce d'équipement, une
   * carte d'action, et des écharpes. Aucun mauvais tirage possible.
   */
  function tirerBienvenue() {
    const communs = DEX.filter((f) => f.rar === 'd1');
    const bons = DEX.filter((f) => ['d2', 'd3'].includes(f.rar));
    const equipement = STUFF.filter((s) => ['d1', 'd2'].includes(s.rar));

    return [
      { type: 'fanzzy', id: rnd(communs).id },
      { type: 'fanzzy', id: rnd(bons).id },
      { type: 'stuff', id: rnd(equipement).id },
      { type: 'action', id: rnd(ACTIONS).id },
      { type: 'scarves', amount: 80 + Math.floor(Math.random() * 40) },
    ];
  }

  async function openWelcome(userId, teamId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[w]] = await conn.query(
        `SELECT onboarded_at FROM user_wallet WHERE user_id = ? FOR UPDATE`, [userId]);
      if (w?.onboarded_at) throw fail('onboarding.error.already_done');

      const cartes = tirerBienvenue();
      let scarves = 0;
      const actions = [];

      for (const c of cartes) {
        if (c.type === 'fanzzy') {
          await conn.query(
            `INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE copies = copies + 1`, [userId, c.id]);
          // Le skin de base vient avec le Fanzzy, toujours.
          await conn.query(
            `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, skin_id, equipped)
             VALUES (?, ?, 'base', 1)`, [userId, c.id]);
        } else if (c.type === 'stuff') {
          await conn.query(
            `INSERT INTO user_stuff (user_id, stuff_id, copies, slot) VALUES (?, ?, 1, 1)
             ON DUPLICATE KEY UPDATE copies = copies + 1`, [userId, c.id]);
        } else if (c.type === 'action') {
          actions.push(c.id);
        } else {
          scarves += c.amount;
        }
      }

      const premier = cartes.find((c) => c.type === 'fanzzy' && BY_ID.get(c.id).rar !== 'd1')
        ?? cartes.find((c) => c.type === 'fanzzy');

      await conn.query(
        `UPDATE user_wallet
            SET onboarded_at = NOW(3), scarves = scarves + ?,
                active_fanzzy = COALESCE(active_fanzzy, ?),
                action_cards = ?
          WHERE user_id = ?`,
        [scarves, premier.id, JSON.stringify(actions), userId]);

      await conn.commit();
      return { cartes, scarves, activeFanzzy: premier.id };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /* ----------------------------------------------------------- porté */

  async function equip(userId, stuffId, slot) {
    if (![1, 2].includes(Number(slot))) throw fail('onboarding.error.bad_slot');
    const owned = await q(
      `SELECT 1 FROM user_stuff WHERE user_id = ? AND stuff_id = ?`, [userId, stuffId]);
    if (!owned.length) throw fail('onboarding.error.not_owned');
    // Un seul objet par emplacement, et un objet ne se porte qu'une fois.
    await q(`UPDATE user_stuff SET slot = NULL WHERE user_id = ? AND (slot = ? OR stuff_id = ?)`,
      [userId, slot, stuffId]);
    await q(`UPDATE user_stuff SET slot = ? WHERE user_id = ? AND stuff_id = ?`,
      [slot, userId, stuffId]);
    return { stuffId, slot: Number(slot) };
  }

  async function unequip(userId, stuffId) {
    await q(`UPDATE user_stuff SET slot = NULL WHERE user_id = ? AND stuff_id = ?`,
      [userId, stuffId]);
  }

  async function wearSkin(userId, fanzzyId, skinId) {
    const owned = await q(
      `SELECT 1 FROM user_skins WHERE user_id = ? AND fanzzy_id = ? AND skin_id = ?`,
      [userId, fanzzyId, skinId]);
    if (!owned.length) throw fail('onboarding.error.not_owned');
    await q(`UPDATE user_skins SET equipped = 0 WHERE user_id = ? AND fanzzy_id = ?`,
      [userId, fanzzyId]);
    await q(`UPDATE user_skins SET equipped = 1 WHERE user_id = ? AND fanzzy_id = ? AND skin_id = ?`,
      [userId, fanzzyId, skinId]);
  }

  /**
   * Les modificateurs réellement en jeu : ceux du Fanzzy équipé, combinés aux
   * deux pièces portées. Le skin n'intervient pas, par construction.
   */
  async function loadout(userId) {
    const w = (await q(`SELECT active_fanzzy FROM user_wallet WHERE user_id = ?`, [userId]))[0];
    const f = w?.active_fanzzy ? BY_ID.get(w.active_fanzzy) : null;
    const portes = await q(
      `SELECT stuff_id FROM user_stuff WHERE user_id = ? AND slot IS NOT NULL ORDER BY slot`,
      [userId]);
    const skin = (await q(
      `SELECT skin_id FROM user_skins WHERE user_id = ? AND fanzzy_id = ? AND equipped = 1`,
      [userId, w?.active_fanzzy ?? '']))[0]?.skin_id ?? 'base';

    return {
      fanzzy: f ? { id: f.id, nom: f.nom, type: f.type, cri: f.cri } : null,
      skin,
      stuff: portes.map((p) => p.stuff_id),
      mods: f ? { id: f.id, ...combine(f.mods, portes.map((p) => p.stuff_id)) } : {},
    };
  }

  /* ---------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (!res.headersSent) res.status(400).json({ error: e.code ?? 'onboarding.error.server' });
  });

  router.get('/catalogue', (_req, res) => {
    res.set('cache-control', 'public, max-age=3600');
    res.json({ skins: SKINS, stuff: STUFF, actions: ACTIONS, prixSlots: PRIX_SLOT });
  });

  router.get('/state', requireAuth, safe(async (req, res) =>
    res.json(await state(req.user.id))));

  router.get('/loadout', requireAuth, safe(async (req, res) =>
    res.json(await loadout(req.user.id))));

  router.post('/follow', requireAuth, safe(async (req, res) => {
    await follow(req.user.id, Number(req.body?.teamId), { main: Boolean(req.body?.main) });
    res.json(await state(req.user.id));
  }));

  router.delete('/follow/:teamId', requireAuth, safe(async (req, res) => {
    await q(`DELETE FROM user_follows WHERE user_id = ? AND team_id = ?`,
      [req.user.id, Number(req.params.teamId)]);
    res.json(await state(req.user.id));
  }));

  router.post('/slot', requireAuth, safe(async (req, res) =>
    res.json(await buySlot(req.user.id))));

  router.post('/welcome', requireAuth, safe(async (req, res) => {
    const teamId = Number(req.body?.teamId);
    if (Number.isInteger(teamId)) await follow(req.user.id, teamId, { main: true });
    res.json(await openWelcome(req.user.id, teamId));
  }));

  router.post('/equip', requireAuth, safe(async (req, res) =>
    res.json(await equip(req.user.id, String(req.body?.stuffId), req.body?.slot))));

  router.post('/unequip', requireAuth, safe(async (req, res) => {
    await unequip(req.user.id, String(req.body?.stuffId));
    res.json(await state(req.user.id));
  }));

  router.post('/skin', requireAuth, safe(async (req, res) => {
    await wearSkin(req.user.id, String(req.body?.fanzzyId), String(req.body?.skinId));
    res.json({ ok: true });
  }));

  return { router, state, follow, buySlot, openWelcome, equip, wearSkin, loadout };
}
