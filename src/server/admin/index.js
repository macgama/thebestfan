import express from 'express';

/**
 * Administration.
 *
 * Trois principes qui ne se négocient pas :
 *
 * **Tout est tracé.** Chaque écriture passe par le journal d'audit, avec
 * l'auteur, la cible et le détail. Le jour où un compte est bloqué à tort ou
 * où dix mille écharpes apparaissent, la seule question qui compte est « qui,
 * quand, pourquoi » — et personne ne s'en souvient trois semaines après.
 *
 * **Un administrateur ne peut pas se retirer ses propres droits**, ni
 * supprimer son compte depuis cette interface. C'est le moyen le plus simple
 * de se retrouver avec une application sans personne pour l'administrer.
 *
 * **Rien ici ne lit un mot de passe.** Le module ne renvoie jamais de hachage,
 * et ne permet pas d'en fixer un : un administrateur qui peut choisir le mot
 * de passe d'un joueur peut se connecter à sa place.
 */

export function createAdmin({ pool, requireAuth, deps = {} }) {
  // Les dépendances d'exploitation (client API, salles du virage) sont
  // branchées après coup : elles n'existent pas encore au moment où ce module
  // est créé, et il ne doit pas les attendre pour fonctionner.
  const module = { deps };
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const fail = (code, status = 400) => Object.assign(new Error(code), { code, status });

  /* -------------------------------------------------------------- rôle */

  /** Promeut les adresses listées dans ADMIN_EMAILS. Résout l'amorçage. */
  async function amorcer(emails) {
    const liste = String(emails ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!liste.length) return 0;
    let n = 0;
    for (const email of liste) {
      const [r] = await pool.execute(
        `UPDATE users SET role = 'admin' WHERE email = ? AND role <> 'admin'`, [email]);
      if (r.affectedRows) {
        n++;
        await journal('systeme', 'admin.promu', email, { via: 'ADMIN_EMAILS' }, null);
      }
    }
    return n;
  }

  const estAdmin = async (userId) => {
    const r = await q(`SELECT role FROM users WHERE public_id = ?`, [userId]);
    return r[0]?.role === 'admin';
  };

  function requireAdmin(req, res, next) {
    requireAuth(req, res, async () => {
      if (!(await estAdmin(req.user.id))) {
        return res.status(403).json({ error: 'admin.error.forbidden' });
      }
      next();
    });
  }

  /* ------------------------------------------------------------- audit */

  async function journal(acteur, action, cible, detail, ip) {
    await q(
      `INSERT INTO admin_audit (acteur, action, cible, detail, ip) VALUES (?, ?, ?, ?, ?)`,
      [acteur, action, cible ?? null, JSON.stringify(detail ?? null), ip ?? null]);
  }

  const ip = (req) => (req.headers['x-forwarded-for']?.split(',')[0]
    ?? req.socket.remoteAddress ?? '').trim().slice(0, 45);

  /* ----------------------------------------------------------- aperçu */

  /**
   * MySQL renvoie les SUM() en chaînes de caractères, pas en nombres.
   * Un client qui compare ou additionne se casse dessus : on convertit ici,
   * une fois, plutôt que dans chaque page.
   */
  const nombres = (o) => Object.fromEntries(Object.entries(o ?? {})
    .map(([k, v]) => [k, v === null ? 0 : (typeof v === 'string' && /^-?\d+$/.test(v) ? Number(v) : v)]));

  async function apercu() {
    const [[u]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(status = 'active') AS actifs,
              SUM(role = 'admin') AS admins,
              SUM(email_verified_at IS NOT NULL) AS verifies,
              SUM(created_at > NOW(3) - INTERVAL 7 DAY) AS nouveaux
         FROM users`);
    const [[j]] = await pool.query(
      `SELECT COUNT(*) AS souvenirs,
              SUM(kind = 'presence') AS vecus FROM user_souvenirs`).catch(() => [[{}]]);
    const [[v]] = await pool.query(
      `SELECT COUNT(DISTINCT user_id) AS supporters, COALESCE(SUM(ferveur),0) AS ferveur
         FROM virage_presence`).catch(() => [[{}]]);
    const [[c]] = await pool.query(
      `SELECT COUNT(*) AS competitions, SUM(enabled = 1) AS activees
         FROM souvenir_leagues`).catch(() => [[{}]]);

    return {
      joueurs: nombres(u),
      jeu: nombres({ ...j, ...v }),
      competitions: nombres(c),
      quota: module.deps.client?.quota ?? null,
      virage: module.deps.virage ? [...module.deps.virage.rooms.values()].map((r) => ({
        fixtureId: r.fixture.id, foule: r.crowd(), corde: Math.round(r.rope),
      })) : [],
      mail: globalThis.mailer?.status ?? null,
    };
  }

  /* ---------------------------------------------------------- joueurs */

  async function joueurs({ q: terme = '', limite = 40, offset = 0 } = {}) {
    const where = terme ? `WHERE (u.pseudo LIKE ? OR u.email LIKE ?)` : '';
    const args = terme ? [`%${terme}%`, `%${terme}%`] : [];
    return q(
      `SELECT u.public_id, u.pseudo, u.email, u.role, u.status, u.locale,
              u.email_verified_at, u.created_at, u.last_login_at,
              w.scarves, w.packs, w.follow_slots, w.onboarded_at,
              (SELECT COUNT(*) FROM user_fanzzy f WHERE f.user_id = u.public_id) AS fanzzy,
              (SELECT COALESCE(SUM(vp.ferveur),0) FROM virage_presence vp
                WHERE vp.user_id = u.public_id) AS ferveur
         FROM users u LEFT JOIN user_wallet w ON w.user_id = u.public_id
         ${where}
        ORDER BY u.created_at DESC
        LIMIT ${Number(limite) || 40} OFFSET ${Number(offset) || 0}`, args);
  }

  /**
   * Modifie un joueur. Chaque champ est traité séparément et journalisé :
   * une seule requête qui écrirait tout d'un bloc rendrait le journal illisible.
   */
  async function modifier(acteur, cibleId, champs, adresseIp) {
    const cible = (await q(`SELECT public_id, role, status FROM users WHERE public_id = ?`,
      [cibleId]))[0];
    if (!cible) throw fail('admin.error.unknown_user', 404);

    const fait = {};

    if (champs.status && ['active', 'locked'].includes(champs.status)) {
      if (cibleId === acteur) throw fail('admin.error.not_yourself');
      await q(`UPDATE users SET status = ? WHERE public_id = ?`, [champs.status, cibleId]);
      // Un compte bloqué doit perdre ses sessions immédiatement, sinon il
      // reste connecté jusqu'à expiration.
      if (champs.status === 'locked') {
        await q(`DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE public_id = ?)`,
          [cibleId]);
      }
      fait.status = champs.status;
    }

    if (champs.role && ['joueur', 'admin'].includes(champs.role)) {
      if (cibleId === acteur) throw fail('admin.error.not_yourself');
      await q(`UPDATE users SET role = ? WHERE public_id = ?`, [champs.role, cibleId]);
      fait.role = champs.role;
    }

    if (champs.verifier === true) {
      await q(`UPDATE users SET email_verified_at = NOW(3) WHERE public_id = ?`, [cibleId]);
      fait.verifie = true;
    }

    // Les montants sont des ajustements, positifs ou négatifs. Le plancher
    // s'applique au résultat, pas à l'ajustement : sinon un débit serait
    // silencieusement transformé en zéro et ne ferait rien.
    if (Number.isInteger(champs.scarves) && champs.scarves !== 0) {
      await q(`INSERT IGNORE INTO user_wallet (user_id) VALUES (?)`, [cibleId]);
      await q(`UPDATE user_wallet SET scarves = GREATEST(0, scarves + ?) WHERE user_id = ?`,
        [champs.scarves, cibleId]);
      fait.scarves = champs.scarves;
    }

    if (Number.isInteger(champs.packs) && champs.packs !== 0) {
      await q(`INSERT IGNORE INTO user_wallet (user_id) VALUES (?)`, [cibleId]);
      await q(`UPDATE user_wallet SET packs = GREATEST(0, LEAST(99, packs + ?)) WHERE user_id = ?`,
        [champs.packs, cibleId]);
      fait.packs = champs.packs;
    }

    if (Number.isInteger(champs.slots)) {
      await q(`UPDATE user_wallet SET follow_slots = GREATEST(2, LEAST(12, ?)) WHERE user_id = ?`,
        [champs.slots, cibleId]);
      fait.slots = champs.slots;
    }

    if (!Object.keys(fait).length) throw fail('admin.error.nothing_to_do');
    await journal(acteur, 'joueur.modifie', cibleId, fait, adresseIp);
    return fait;
  }

  /* ----------------------------------------------------- compétitions */

  async function competitions({ q: terme = '', pays = '', palier = '', limite = 100 } = {}) {
    const w = [];
    const a = [];
    if (terme) { w.push('(name LIKE ? OR country LIKE ?)'); a.push(`%${terme}%`, `%${terme}%`); }
    if (pays) { w.push('country = ?'); a.push(pays); }
    if (palier) { w.push('tier = ?'); a.push(Number(palier)); }
    return q(
      `SELECT league_id, season, name, country, type, family, tier, enabled,
              has_events, has_standings, has_top_scorers, starts_on, ends_on
         FROM souvenir_leagues
         ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
        ORDER BY tier, country, name
        LIMIT ${Number(limite) || 100}`, a);
  }

  async function modifierCompetition(acteur, leagueId, season, champs, adresseIp) {
    const fait = {};
    if (typeof champs.enabled === 'boolean') {
      await q(`UPDATE souvenir_leagues SET enabled = ? WHERE league_id = ? AND season = ?`,
        [champs.enabled ? 1 : 0, leagueId, season]);
      fait.enabled = champs.enabled;
    }
    if ([1, 2, 3].includes(Number(champs.tier))) {
      await q(`UPDATE souvenir_leagues SET tier = ? WHERE league_id = ? AND season = ?`,
        [Number(champs.tier), leagueId, season]);
      fait.tier = Number(champs.tier);
    }
    // Les dates de saison décident de ce qui s'affiche dans le télétexte :
    // les corriger à la main évite d'attendre que l'API se mette à jour.
    for (const [k, col] of [['debut', 'starts_on'], ['fin', 'ends_on']]) {
      if (champs[k] && /^\d{4}-\d{2}-\d{2}$/.test(champs[k])) {
        await q(`UPDATE souvenir_leagues SET ${col} = ? WHERE league_id = ? AND season = ?`,
          [champs[k], leagueId, season]);
        fait[k] = champs[k];
      }
    }
    if (!Object.keys(fait).length) throw fail('admin.error.nothing_to_do');
    await journal(acteur, 'competition.modifiee', `${leagueId}/${season}`, fait, adresseIp);
    return fait;
  }

  /* -------------------------------------------------------- réglages */

  async function reglages() {
    const rows = await q(`SELECT cle, valeur, maj FROM reglages`);
    return Object.fromEntries(rows.map((r) => [r.cle,
      typeof r.valeur === 'string' ? JSON.parse(r.valeur) : r.valeur]));
  }

  async function fixerReglage(acteur, cle, valeur, adresseIp) {
    if (!/^[a-z0-9_.]{2,48}$/.test(String(cle))) throw fail('admin.error.bad_key');
    await q(
      `INSERT INTO reglages (cle, valeur, maj_par) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE valeur = VALUES(valeur), maj_par = VALUES(maj_par)`,
      [cle, JSON.stringify(valeur ?? null), acteur]);
    await journal(acteur, 'reglage.modifie', cle, { valeur }, adresseIp);
    return { cle, valeur };
  }

  /* ---------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (res.headersSent) return;
    console.error('[admin]', e.message);
    res.status(e.status ?? 400).json({ error: e.code ?? 'admin.error.server' });
  });

  /** Le client demande si l'onglet doit exister. Ouvert à tout connecté. */
  router.get('/suis-je', requireAuth, safe(async (req, res) =>
    res.json({ admin: await estAdmin(req.user.id) })));

  router.use(requireAdmin);

  router.get('/apercu', safe(async (_req, res) => res.json(await apercu())));

  router.get('/joueurs', safe(async (req, res) => res.json({
    joueurs: await joueurs({ q: String(req.query.q ?? ''),
      limite: req.query.limite, offset: req.query.offset }),
  })));

  router.patch('/joueur/:id', safe(async (req, res) =>
    res.json(await modifier(req.user.id, req.params.id, req.body ?? {}, ip(req)))));

  router.get('/competitions', safe(async (req, res) => res.json({
    competitions: await competitions({
      q: String(req.query.q ?? ''), pays: String(req.query.pays ?? ''),
      palier: req.query.palier }),
  })));

  router.patch('/competition/:id/:season', safe(async (req, res) =>
    res.json(await modifierCompetition(req.user.id, Number(req.params.id),
      Number(req.params.season), req.body ?? {}, ip(req)))));

  router.get('/reglages', safe(async (_req, res) => res.json(await reglages())));

  router.put('/reglage/:cle', safe(async (req, res) =>
    res.json(await fixerReglage(req.user.id, req.params.cle, req.body?.valeur, ip(req)))));

  router.get('/journal', safe(async (req, res) => res.json({
    journal: await q(
      `SELECT a.id, a.action, a.cible, a.detail, a.au, u.pseudo AS acteur
         FROM admin_audit a LEFT JOIN users u ON u.public_id = a.acteur
        ORDER BY a.au DESC LIMIT ?`, [Number(req.query.limite) || 100]),
  })));

  /* -------------------------------------------------- outils d'exploitation */

  router.post('/cache/purge', safe(async (req, res) => {
    const [r] = await pool.query(`DELETE FROM api_cache`);
    await journal(req.user.id, 'cache.purge', null, { lignes: r.affectedRows }, ip(req));
    res.json({ purge: r.affectedRows });
  }));

  router.post('/mail-test', safe(async (req, res) => {
    const r = await globalThis.mailer?.test(req.user.email);
    await journal(req.user.id, 'mail.test', req.user.email, { delivered: r?.delivered }, ip(req));
    res.json({ ...r, etat: globalThis.mailer?.status });
  }));

  return Object.assign(module, { router, requireAdmin, estAdmin, amorcer, apercu, joueurs,
    modifier, competitions, modifierCompetition, reglages, fixerReglage, journal });
}
