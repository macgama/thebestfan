import { randomUUID } from 'node:crypto';
import express from 'express';
import { DuelNvN, RULES } from './engine.js';
import { Cheat } from '../ferveur/gestures.js';
import { FORMATS } from '../deck/index.js';

/**
 * Couche réseau du duel N contre N.
 *
 * Le moteur ne connaît ni socket ni base. Ce module fait le reste : il forme
 * les équipes, ouvre les salles, diffuse les événements et gère les départs.
 *
 * Deux choix qui gouvernent le reste :
 *
 * **La file est par format ET par match support.** Deux joueurs qui veulent
 * un 3v3 sur Sion–Bâle jouent ensemble ; celui qui veut un 3v3 sur un autre
 * match attend ailleurs. C'est plus lent à remplir, mais un duel adossé à un
 * match qu'on ne suit pas ne veut rien dire.
 *
 * **Une déconnexion ne fait pas perdre l'équipe.** Le joueur cesse simplement
 * de pousser et sa place l'attend : les tribunes ne s'effondrent pas parce que
 * quelqu'un a pris l'ascenseur.
 */

const TICK_MS = 500;
const BOT_APRES_MS = 20_000;
const GRACE_MS = 90_000;

export function createNvN({ pool, io, requireAuth, decks }) {
  const salles = new Map();          // duelId -> { duel, membres, timer }
  const salleDe = new Map();         // userId -> duelId
  const files = new Map();           // clé -> [candidats]
  const cadence = new WeakMap();     // socket -> horodatages

  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const cle = (format, fixtureId) => `${format}:${fixtureId}`;

  /* ------------------------------------------------------- appariement */

  async function entrerEnFile(socket, { format, fixtureId, contreBot }) {
    const u = socket.data?.user;
    if (!u) throw new Cheat('unauthenticated');
    if (!FORMATS[format]) throw new Cheat('unknown_format');

    // Le deck et le match sont validés avant toute chose : mieux vaut refuser
    // maintenant que faire attendre trois minutes pour rien.
    const loadout = await decks.loadout(u.userId);
    if (!loadout) throw new Cheat('no_deck');
    const support = await decks.matchSupport(Number(fixtureId));

    quitterFile(u.userId);
    const c = cle(format, fixtureId);
    const file = files.get(c) ?? [];
    file.push({ userId: u.userId, nom: u.name, socket, loadout, support,
                depuis: Date.now(), format, contreBot: Boolean(contreBot) });
    files.set(c, file);

    socket.emit('nvn:file', {
      format, mode: support.mode, raison: support.raison,
      attendus: FORMATS[format] * 2, presents: file.length,
      botDansMs: support.mode === 'entrainement' ? BOT_APRES_MS : null,
    });

    if (contreBot) return ouvrirAvecBots(c);
    return tenterAppariement(c);
  }

  function quitterFile(userId) {
    for (const [c, file] of files) {
      const i = file.findIndex((f) => f.userId === userId);
      if (i === -1) continue;
      file.splice(i, 1);
      if (!file.length) files.delete(c);
      else files.set(c, file);
    }
  }

  function tenterAppariement(c) {
    const file = files.get(c);
    if (!file) return null;
    const taille = FORMATS[file[0].format];
    if (file.length < taille * 2) return null;

    const pris = file.splice(0, taille * 2);
    if (!file.length) files.delete(c);
    // Une alternance simple répartit les premiers arrivés des deux côtés :
    // sans elle, les six premiers d'un 3v3 formeraient une équipe d'habitués
    // contre une équipe de retardataires.
    const equipes = [[], []];
    pris.forEach((p, i) => equipes[i % 2].push(p));
    return ouvrir(equipes, pris[0].support);
  }

  /** Entraînement immédiat : les places manquantes sont tenues par des bots. */
  function ouvrirAvecBots(c) {
    const file = files.get(c);
    if (!file?.length) return null;
    const taille = FORMATS[file[0].format];
    const humains = file.splice(0, taille * 2);
    if (!file.length) files.delete(c);

    const equipes = [[], []];
    humains.forEach((p, i) => equipes[i % 2].push(p));
    for (const side of [0, 1]) {
      while (equipes[side].length < taille) {
        equipes[side].push(faireBot(humains[0].loadout, equipes[side].length, side));
      }
    }
    // Un entraînement ne compte jamais, même adossé à un match du jour.
    return ouvrir(equipes, { ...humains[0].support, mode: 'entrainement' });
  }

  function faireBot(modele, i, side) {
    return {
      userId: `bot:${randomUUID().slice(0, 8)}`,
      nom: ['Momo', 'Sarah', 'Le Gros', 'Nadia', 'Tonio'][i % 5],
      socket: null,
      bot: { prochain: Date.now() + 1500 + Math.random() * 2500, adresse: 0.55 + Math.random() * 0.3 },
      loadout: modele,
    };
  }

  /* ------------------------------------------------------------ salles */

  function ouvrir(equipes, support) {
    const id = randomUUID();
    const duel = new DuelNvN({
      id,
      equipes: equipes.map((eq) => eq.map((p) => ({
        userId: p.userId, nom: p.nom, loadout: p.loadout }))),
      fixture: support.fixture,
      mode: support.mode,
    });

    const membres = new Map();
    equipes.flat().forEach((p) => membres.set(p.userId, {
      socket: p.socket, bot: p.bot ?? null, coupeA: null, nom: p.nom }));

    const salle = { duel, membres, room: `nvn:${id}` };
    salles.set(id, salle);

    for (const [userId, m] of membres) {
      if (!m.socket) continue;
      salleDe.set(userId, id);
      m.socket.join(salle.room);
      m.socket.emit('nvn:start', duel.vue(userId));
    }

    salle.timer = setInterval(() => void horloge(salle), TICK_MS);
    return salle;
  }

  /** Diffusion : les événements partent à tous, les vues restent privées. */
  function diffuser(salle, evenements) {
    if (!evenements?.length) return;
    io.to(salle.room).emit('nvn:events', evenements);
    for (const [userId, m] of salle.membres) {
      if (m.socket?.connected) m.socket.emit('nvn:state', salle.duel.vue(userId));
    }
    if (salle.duel.termine) fermer(salle);
  }

  async function horloge(salle) {
    const t = Date.now();
    try {
      const ev = salle.duel.tick(t);

      // Les bots jouent : un entraînement sans adversaire actif n'apprend rien.
      for (const [userId, m] of salle.membres) {
        if (!m.bot || salle.duel.termine || t < m.bot.prochain) continue;
        m.bot.prochain = t + 2500 + Math.random() * 3500;
        try {
          const j = salle.duel.joueur(userId);
          const carte = j.main[Math.floor(Math.random() * j.main.length)];
          if (carte && Math.random() < 0.35) ev.push(...salle.duel.jouer(userId, carte, t));
          else ev.push(...salle.duel.chanter(userId, {
            geste: 'tempo',
            taps: Array.from({ length: 8 }, (_, i) =>
              i * 560 + (Math.random() * 2 - 1) * 260 * (1 - m.bot.adresse)),
          }, t));
        } catch { /* souffle insuffisant ou geste refusé : il attend */ }
      }

      // Grâce épuisée : le joueur est retiré de la salle, pas puni.
      for (const [userId, m] of salle.membres) {
        if (m.coupeA && t - m.coupeA > GRACE_MS) {
          m.parti = true;
          m.coupeA = null;
          ev.push({ seq: ++salle.duel.seq, t: 'left', userId });
        }
      }

      diffuser(salle, ev);
    } catch (e) {
      console.error(`[nvn ${salle.duel.id}]`, e.message);
    }
  }

  async function fermer(salle) {
    clearInterval(salle.timer);
    const d = salle.duel;
    salles.delete(d.id);
    for (const userId of salle.membres.keys()) salleDe.delete(userId);

    // Seul un duel classé s'écrit au classement. Les bots n'y figurent pas.
    if (d.mode !== 'classe' || d.vainqueur === null) return;
    try {
      for (const [userId, j] of d.joueurs) {
        if (userId.startsWith('bot:')) continue;
        const adverse = [...d.joueurs.values()].find((x) => x.side !== j.side);
        await q(
          `INSERT IGNORE INTO duel_results
             (duel_id, user_id, opponent_id, outcome, goals_for, goals_against, ended_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
          [d.id, userId, adverse?.userId ?? 'inconnu',
           j.side === d.vainqueur ? 'win' : 'loss',
           d.goals[j.side], d.goals[j.side ^ 1]]);
      }
    } catch (e) {
      console.error('[nvn] enregistrement du résultat', e.message);
    }
  }

  /* ------------------------------------------------------------ socket */

  const MAX_ACTIONS_10S = 30;

  function limite(socket) {
    const t = Date.now();
    const b = (cadence.get(socket) ?? []).filter((x) => t - x < 10_000);
    if (b.length >= MAX_ACTIONS_10S) return false;
    b.push(t); cadence.set(socket, b);
    return true;
  }

  io.on('connection', (socket) => {
    const moi = () => socket.data?.user ?? null;
    const maSalle = () => {
      const u = moi();
      const id = u ? salleDe.get(u.userId) : null;
      return id ? salles.get(id) : null;
    };

    const erreur = (e) => socket.emit('nvn:error',
      { code: e instanceof Cheat ? e.code : 'nvn.error.server' });

    socket.on('nvn:queue', async (p = {}) => {
      try { await entrerEnFile(socket, p); }
      catch (e) {
        if (!(e instanceof Cheat)) console.error('[nvn] file', e.message);
        socket.emit('nvn:error', { code: e.code ?? 'nvn.error.server' });
      }
    });

    socket.on('nvn:leave_queue', () => {
      const u = moi();
      if (u) quitterFile(u.userId);
    });

    for (const [evt, fn] of [
      ['nvn:chant', (salle, u, p) => salle.duel.chanter(u.userId, p)],
      ['nvn:play', (salle, u, p) => salle.duel.jouer(u.userId, String(p?.cardId))],
      ['nvn:swap', (salle, u, p) => salle.duel.changer(u.userId, Number(p?.index))],
    ]) {
      socket.on(evt, (p = {}) => {
        const u = moi();
        const salle = maSalle();
        if (!u || !salle) return socket.emit('nvn:error', { code: 'nvn.error.not_in_duel' });
        if (!limite(socket)) return socket.emit('nvn:error', { code: 'nvn.error.rate_limited' });
        try { diffuser(salle, fn(salle, u, p)); }
        catch (e) { erreur(e); }
      });
    }

    /** Reprise après coupure : la place attendait. */
    socket.on('nvn:resume', () => {
      const u = moi();
      const salle = maSalle();
      if (!u || !salle) return socket.emit('nvn:error', { code: 'nvn.error.not_in_duel' });
      const m = salle.membres.get(u.userId);
      if (!m || m.parti) return socket.emit('nvn:error', { code: 'nvn.error.slot_lost' });
      m.socket = socket;
      m.coupeA = null;
      socket.join(salle.room);
      socket.emit('nvn:start', salle.duel.vue(u.userId));
      io.to(salle.room).emit('nvn:events',
        [{ seq: ++salle.duel.seq, t: 'back', userId: u.userId }]);
    });

    socket.on('disconnect', () => {
      const u = moi();
      if (!u) return;
      quitterFile(u.userId);
      const salle = maSalle();
      const m = salle?.membres.get(u.userId);
      if (!m) return;
      m.socket = null;
      m.coupeA = Date.now();
      io.to(salle.room).emit('nvn:events', [{
        seq: ++salle.duel.seq, t: 'disconnected', userId: u.userId,
        graceMs: GRACE_MS,
      }]);
    });
  });

  /* ---------------------------------------------- bascule vers les bots */

  const veille = setInterval(() => {
    const t = Date.now();
    for (const [c, file] of [...files]) {
      // Un joueur seul un mardi soir doit pouvoir jouer : au bout du délai,
      // les places manquantes sont tenues par des bots, en entraînement.
      if (file.some((f) => t - f.depuis > BOT_APRES_MS)) ouvrirAvecBots(c);
    }
  }, 2000);
  veille.unref?.();

  /* ------------------------------------------------------------ routes */

  const router = express.Router();

  router.get('/etat', requireAuth, (req, res) => {
    res.json({
      formats: Object.keys(FORMATS),
      files: [...files].map(([c, f]) => ({ cle: c, presents: f.length })),
      salles: salles.size,
      duelEnCours: salleDe.get(req.user.id) ?? null,
    });
  });

  return { router, salles, files, ouvrir, ouvrirAvecBots, tenterAppariement,
           stop: () => { clearInterval(veille); for (const s of salles.values()) clearInterval(s.timer); } };
}
