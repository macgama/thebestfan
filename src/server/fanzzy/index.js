import express from 'express';
import { DEX, BY_ID, SETS, TYPES, RATES, SCARVES, EVO_COST } from '../../shared/fanzzy/dex.js';
import { SKINS, SKIN_BY_ID, STUFF, STUFF_BY_ID, combine } from '../../shared/fanzzy/inventaire.js';

/**
 * Collection Fanzzy, tenue par le serveur.
 *
 * Rien de tout ceci ne peut vivre dans le navigateur : le tirage d'un booster,
 * le solde d'écharpes et les évolutions décident de ce qu'un joueur possède, et
 * un joueur possède des choses qui s'achètent. Le client n'affiche que ce que
 * le serveur lui dit.
 */

export const MAX_PACKS = 12;
export const PACK_REGEN_MS = 10 * 60 * 1000;
export const PACK_PRICE = 45;          // acheter un booster en écharpes

/**
 * Chance qu'une carte du booster soit un skin plutôt qu'un Fanzzy.
 *
 * Un skin ne tombe que pour un Fanzzy déjà possédé : sans le supporter, la
 * tenue n'a rien à habiller. Un joueur qui n'a encore rien reçoit donc des
 * Fanzzy, ce qui est exactement ce qu'il lui faut.
 */
const CHANCE_SKIN = 0.22;

const rnd = (a) => a[Math.floor(Math.random() * a.length)];

export function createFanzzy({ pool, requireAuth }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /* -------------------------------------------------------- portefeuille */

  /**
   * Recharge les boosters au prorata du temps écoulé, puis renvoie l'état.
   * Le calcul se fait à la lecture plutôt qu'avec une tâche périodique :
   * pas de minuterie à maintenir, et le résultat est le même.
   */
  async function wallet(userId) {
    await q(
      `INSERT IGNORE INTO user_wallet (user_id, scarves, packs) VALUES (?, 0, ?)`,
      [userId, MAX_PACKS],
    );
    const w = (await q(
      `SELECT scarves, packs, packs_at, active_fanzzy FROM user_wallet WHERE user_id = ?`,
      [userId],
    ))[0];

    if (w.packs < MAX_PACKS) {
      const gained = Math.floor((Date.now() - new Date(w.packs_at).getTime()) / PACK_REGEN_MS);
      if (gained > 0) {
        const packs = Math.min(MAX_PACKS, w.packs + gained);
        const at = new Date(new Date(w.packs_at).getTime() + gained * PACK_REGEN_MS);
        await q(`UPDATE user_wallet SET packs = ?, packs_at = ? WHERE user_id = ?`,
          [packs, at, userId]);
        w.packs = packs; w.packs_at = at;
      }
    } else {
      await q(`UPDATE user_wallet SET packs_at = NOW(3) WHERE user_id = ?`, [userId]);
      w.packs_at = new Date();
    }

    const nextIn = w.packs >= MAX_PACKS ? null
      : Math.max(0, PACK_REGEN_MS - (Date.now() - new Date(w.packs_at).getTime()));
    return { scarves: w.scarves, packs: w.packs, nextPackInMs: nextIn, active: w.active_fanzzy };
  }

  async function collection(userId) {
    const rows = await q(`SELECT fanzzy_id, copies FROM user_fanzzy WHERE user_id = ?`, [userId]);
    return Object.fromEntries(rows.map((r) => [r.fanzzy_id, r.copies]));
  }

  /* -------------------------------------------------------------- tirage */

  function pickRarity(slot) {
    const r = Math.random();
    let acc = 0;
    for (const [rar, p] of RATES[slot]) { acc += p; if (r < acc) return rar; }
    return 'd2';
  }

  function drawPack(setId) {
    const pool_ = (rar) => DEX.filter((f) => f.set === setId && f.rar === rar);
    return Array.from({ length: 5 }, (_, i) => {
      const rar = i < 3 ? 'd1' : pickRarity(i + 1);
      const p = pool_(rar);
      return rnd(p.length ? p : pool_('d1'));
    });
  }

  /**
   * Ouvre un booster. Toute l'opération est transactionnelle : sans cela, deux
   * requêtes lancées en même temps consommeraient un seul booster pour deux
   * tirages.
   */
  async function openPack(userId, setId, { buy = false } = {}) {
    if (!SETS.some((s) => s.id === setId)) throw fail('fanzzy.error.unknown_set');
    await wallet(userId);   // recharge avant de débiter

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[w]] = await conn.query(
        `SELECT scarves, packs FROM user_wallet WHERE user_id = ? FOR UPDATE`, [userId]);

      if (w.packs > 0) {
        await conn.query(
          `UPDATE user_wallet SET packs = packs - 1,
             packs_at = IF(packs = ?, NOW(3), packs_at) WHERE user_id = ?`,
          [MAX_PACKS, userId]);
      } else if (buy) {
        const [d] = await conn.query(
          `UPDATE user_wallet SET scarves = scarves - ? WHERE user_id = ? AND scarves >= ?`,
          [PACK_PRICE, userId, PACK_PRICE]);
        if (!d.affectedRows) throw fail('fanzzy.error.not_enough_scarves');
      } else {
        throw fail('fanzzy.error.no_packs');
      }

      const pull = drawPack(setId);

      const [owned] = await conn.query(
        `SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?`, [userId]);
      const had = new Set(owned.map((o) => o.fanzzy_id));
      const [skinsOwned] = await conn.query(
        `SELECT fanzzy_id, skin_id FROM user_skins WHERE user_id = ?`, [userId]);
      const skinsPris = new Set(skinsOwned.map((s) => `${s.fanzzy_id}:${s.skin_id}`));

      // Photographie de la collection avant ouverture : un skin ne peut pas
      // habiller un supporter reçu dans le même paquet. Le joueur n'a pas
      // encore eu le temps de le regarder.
      const avant = new Set(had);

      let scarves = 0;
      const cards = [];

      for (const [i, f] of pull.entries()) {
        // Les trois premières places restent des supporters : c'est la
        // garantie qui empêche une ouverture entièrement décevante.
        const candidats = i < 3 ? [] : [...avant].filter((id) =>
          SKINS.some((sk) => sk.id !== 'base' && !skinsPris.has(`${id}:${sk.id}`)));

        if (candidats.length && Math.random() < CHANCE_SKIN) {
          const pour = rnd(candidats);
          const libres = SKINS.filter((sk) => sk.id !== 'base' && !skinsPris.has(`${pour}:${sk.id}`));
          const skin = rnd(libres);
          skinsPris.add(`${pour}:${skin.id}`);
          await conn.query(
            `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, skin_id) VALUES (?, ?, ?)`,
            [userId, pour, skin.id]);
          cards.push({ type: 'skin', id: skin.id, pour, new: true });
          continue;
        }

        const isNew = !had.has(f.id);
        if (isNew) had.add(f.id); else scarves += SCARVES[f.rar];
        cards.push({ type: 'fanzzy', id: f.id, new: isNew });
        await conn.query(
          `INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE copies = copies + 1`,
          [userId, f.id]);
        // Le skin de base accompagne toujours le supporter.
        await conn.query(
          `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, skin_id, equipped)
           VALUES (?, ?, 'base', 1)`,
          [userId, f.id]);
      }
      if (scarves) {
        await conn.query(`UPDATE user_wallet SET scarves = scarves + ? WHERE user_id = ?`,
          [scarves, userId]);
      }

      // Premier Fanzzy obtenu : on l'équipe d'office, sinon le duel démarre nu.
      const premierFanzzy = cards.find((c) => c.type === 'fanzzy')?.id ?? pull[0].id;
      await conn.query(
        `UPDATE user_wallet SET active_fanzzy = COALESCE(active_fanzzy, ?) WHERE user_id = ?`,
        [premierFanzzy, userId]);

      await conn.commit();
      return { cards, scarvesGained: scarves };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /* ----------------------------------------------------------- évolution */

  async function evolve(userId, fromId) {
    const from = BY_ID.get(fromId);
    if (!from?.evo) throw fail('fanzzy.error.no_evolution');
    const to = BY_ID.get(from.evo);
    const cost = EVO_COST[to.stage] ?? 90;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[have]] = await conn.query(
        `SELECT copies FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ? FOR UPDATE`,
        [userId, fromId]);
      if (!have || have.copies < 1) throw fail('fanzzy.error.not_owned');

      const [d] = await conn.query(
        `UPDATE user_wallet SET scarves = scarves - ? WHERE user_id = ? AND scarves >= ?`,
        [cost, userId, cost]);
      if (!d.affectedRows) throw fail('fanzzy.error.not_enough_scarves');

      if (have.copies > 1) {
        await conn.query(
          `UPDATE user_fanzzy SET copies = copies - 1 WHERE user_id = ? AND fanzzy_id = ?`,
          [userId, fromId]);
      } else {
        await conn.query(`DELETE FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`,
          [userId, fromId]);
      }
      await conn.query(
        `INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE copies = copies + 1`, [userId, to.id]);
      // Le Fanzzy équipé suit son évolution.
      await conn.query(
        `UPDATE user_wallet SET active_fanzzy = ? WHERE user_id = ? AND active_fanzzy = ?`,
        [to.id, userId, fromId]);

      await conn.commit();
      return { from: fromId, to: to.id, spent: cost };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  const fail = (code) => Object.assign(new Error(code), { code });

  /* ------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));

  const send = (res, p) => p.then((v) => res.json(v))
    .catch((e) => res.status(400).json({ error: e.code ?? 'fanzzy.error.server' }));

  /** Le catalogue : envoyé une fois, mis en cache par le navigateur. */
  router.get('/dex', (_req, res) => {
    res.set('cache-control', 'public, max-age=3600');
    res.json({ dex: DEX, sets: SETS, types: TYPES, scarves: SCARVES, evoCost: EVO_COST });
  });

  router.get('/state', requireAuth, async (req, res) => {
    const [w, col] = await Promise.all([wallet(req.user.id), collection(req.user.id)]);
    res.json({ wallet: w, collection: col, maxPacks: MAX_PACKS, packPrice: PACK_PRICE });
  });

  router.post('/open', requireAuth, (req, res) =>
    send(res, openPack(req.user.id, String(req.body?.set ?? 'VN'), { buy: Boolean(req.body?.buy) })
      .then(async (r) => ({ ...r, wallet: await wallet(req.user.id) }))));

  router.post('/evolve', requireAuth, (req, res) =>
    send(res, evolve(req.user.id, String(req.body?.id ?? ''))
      .then(async (r) => ({ ...r, wallet: await wallet(req.user.id) }))));

  router.get('/fiche/:id', requireAuth, async (req, res) => {
    const d = await fiche(req.user.id, String(req.params.id));
    if (!d) return res.status(404).json({ error: 'fanzzy.error.unknown' });
    res.json(d);
  });

  /** Le catalogue de l'équipement, pour l'écran de détail. */
  router.get('/stuff', (_req, res) => {
    res.set('cache-control', 'public, max-age=3600');
    res.json({ stuff: STUFF, skins: SKINS });
  });

  router.post('/active', requireAuth, async (req, res) => {
    const id = String(req.body?.id ?? '');
    if (!BY_ID.has(id)) return res.status(400).json({ error: 'fanzzy.error.unknown' });
    const owned = await q(`SELECT 1 FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`,
      [req.user.id, id]);
    if (!owned.length) return res.status(400).json({ error: 'fanzzy.error.not_owned' });
    await q(`UPDATE user_wallet SET active_fanzzy = ? WHERE user_id = ?`, [id, req.user.id]);
    res.json({ active: id });
  });

  /**
   * Fiche complète d'un Fanzzy : ce qu'il est, ce que le joueur en possède,
   * ses tenues, sa lignée et l'effet réel de son équipement.
   *
   * Tout est assemblé côté serveur en une seule fois : la page n'a pas à
   * enchaîner cinq requêtes pour afficher une carte.
   */
  async function fiche(userId, fanzzyId) {
    const f = BY_ID.get(fanzzyId);
    if (!f) return null;

    const [copies, skins, stuff, w] = await Promise.all([
      q(`SELECT copies, first_at FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`,
        [userId, fanzzyId]),
      q(`SELECT skin_id, equipped, got_at FROM user_skins WHERE user_id = ? AND fanzzy_id = ?`,
        [userId, fanzzyId]),
      q(`SELECT stuff_id, copies, slot FROM user_stuff WHERE user_id = ?`, [userId]),
      q(`SELECT active_fanzzy FROM user_wallet WHERE user_id = ?`, [userId]),
    ]);

    // La lignée : on remonte à la base puis on redescend.
    let base = f;
    for (let i = 0; i < 5; i++) {
      const avant = DEX.find((x) => x.evo === base.id);
      if (!avant) break;
      base = avant;
    }
    const lignee = [base];
    while (lignee.at(-1).evo) lignee.push(BY_ID.get(lignee.at(-1).evo));

    const possedes = new Set((await q(
      `SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?`, [userId])).map((r) => r.fanzzy_id));

    const portes = stuff.filter((s) => s.slot).sort((a, b) => a.slot - b.slot)
      .map((s) => s.stuff_id);

    return {
      fanzzy: {
        id: f.id, nom: f.nom, type: f.type, set: f.set, stage: f.stage, rar: f.rar,
        mods: f.mods, cri: f.cri, evo: f.evo ?? null,
      },
      possede: copies[0]?.copies ?? 0,
      depuis: copies[0]?.first_at ?? null,
      equipe: w[0]?.active_fanzzy === f.id,
      skins: SKINS.map((sk) => {
        const mien = skins.find((x) => x.skin_id === sk.id);
        return { ...sk, possede: Boolean(mien), porte: Boolean(mien?.equipped),
                 depuis: mien?.got_at ?? null };
      }),
      lignee: lignee.map((x) => ({
        id: x.id, nom: x.nom, stage: x.stage, rar: x.rar,
        possede: possedes.has(x.id),
        cout: x.stage > 1 ? (EVO_COST[x.stage] ?? 90) : 0,
      })),
      // L'effet réel : les modificateurs du Fanzzy combinés à l'équipement
      // actuellement porté. C'est ce que le duel utilisera vraiment.
      effetReel: combine(f.mods, portes),
      stuffPorte: portes.map((id) => STUFF_BY_ID.get(id)).filter(Boolean),
    };
  }

  /** Le Fanzzy équipé, lu par le duel au démarrage d'une partie. */
  async function activeFanzzy(userId) {
    const w = (await q(`SELECT active_fanzzy FROM user_wallet WHERE user_id = ?`, [userId]))[0];
    const f = w?.active_fanzzy ? BY_ID.get(w.active_fanzzy) : null;
    return f ?? null;
  }

  return { router, wallet, collection, openPack, evolve, activeFanzzy, fiche };
}
