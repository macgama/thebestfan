/**
 * thebestfan.online — serveur.
 *
 * Démarre même sans base configurée : dans ce cas l'authentification est
 * désactivée et /diagnostic le signale, plutôt que de faire planter le site.
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { createPool } from './src/server/auth/db.js';
import { createAuth } from './src/server/auth/routes.js';
import { createMailer } from './src/server/auth/mailer.js';
import { createSocketAuthenticator } from './src/server/auth/socket.js';
import { createClient } from './src/server/football/client.js';
import { createFootball } from './src/server/football/routes.js';
import { createSouvenirs } from './src/server/souvenirs/index.js';
import { createFanzzy } from './src/server/fanzzy/index.js';
import { createVirage } from './src/server/ferveur/index.js';
import { createTeletext } from './src/server/teletext/index.js';
import { createOnboarding } from './src/server/onboarding/index.js';
import { attachDuelServer } from './dist/duel-server.mjs';
import { MysqlStore } from './dist/duel-server.mjs';
import { STARTER_DECK } from './dist/duel-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = process.env.PUBLIC_ORIGIN ?? 'https://thebestfan.online';
const app = express();
const http = createServer(app);

app.disable('x-powered-by');
app.set('trust proxy', 1); // Infomaniak place un proxy devant : X-Forwarded-For fait foi

const io = new Server(http, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  pingInterval: 20_000,
  pingTimeout: 25_000,
  cors: { origin: ORIGIN, credentials: true },
});

const started = Date.now();
let sockets = 0;

/* ------------------------------------------------ base et authentification */

let pool = null;
let auth = null;
let socketAuth = null;
let football = null;
let duels = null;
let souvenirs = null;
let fanzzy = null;
let virage = null;
let teletext = null;
let onboarding = null;

if (process.env.DATABASE_URL) {
  try {
    pool = await createPool(process.env.DATABASE_URL);
    const mailer = createMailer({
      smtpUrl: process.env.SMTP_URL,
      from: process.env.MAIL_FROM,
      origin: ORIGIN,
    });
    auth = createAuth({
      pool, mailer, origin: ORIGIN,
      sessionSecret: process.env.SESSION_SECRET ?? 'secret-absent-a-corriger',
    });
    socketAuth = createSocketAuthenticator({
      store: auth.store,
      sessionSecret: process.env.SESSION_SECRET ?? 'secret-absent-a-corriger',
    });

    app.use(auth.attachUser);
    app.use('/api/auth', auth.router);

    // Entretien quotidien : sessions, jetons et tentatives périmés.
    setInterval(() => auth.store.cleanup().catch((e) => console.error('[auth] purge', e.message)),
      24 * 60 * 60 * 1000).unref();

    console.log('authentification active');

    // ---- duels temps reel
    duels = attachDuelServer(io, {
      store: await MysqlStore.create(process.env.DATABASE_URL),
      // L'identite vient de la session : plus personne ne peut jouer sous un
      // autre nom ni reprendre le duel d'un autre.
      authenticate: socketAuth,
      // Deck de depart identique pour tous tant que la collection n'existe pas.
      getDeck: async () => [...STARTER_DECK],
      // Le Fanzzy équipé sera lu ici quand le moteur de tir à la corde
      // remplacera le tour par tour ; il est déjà exposé côté serveur.
      // Personne en face au bout de ce delai : on propose un entrainement
      // plutot que de laisser le joueur tourner devant un ecran d'attente.
      botAfterMs: Number(process.env.DUEL_BOT_AFTER_MS ?? 20000),
    });
    globalThis.duels = duels;
    console.log('duels temps reel actifs');

    // ---- collection Fanzzy
    fanzzy = createFanzzy({ pool, requireAuth: auth.requireAuth });
    app.use('/api/fanzzy', fanzzy.router);
    globalThis.fanzzy = fanzzy;
    console.log('collection fanzzy active');

    // ---- cartes-souvenirs
    souvenirs = createSouvenirs({ pool, requireAuth: auth.requireAuth });
    app.use('/api/souvenirs', souvenirs.router);
    console.log('cartes-souvenirs actives');

    // ---- inscription, emplacements de suivi, inventaire
    onboarding = createOnboarding({ pool, requireAuth: auth.requireAuth, football: null });
    app.use('/api/me', onboarding.router);
    console.log('inscription et inventaire actifs');

    // ---- Grand Virage (tir a la corde en direct)
    virage = createVirage({ pool, io, requireAuth: auth.requireAuth, souvenirs, fanzzy });
    app.use('/api/virage', virage.router);
    console.log('grand virage actif');

    // ---- suivi des équipes (API-Football)
    if (process.env.API_FOOTBALL_KEY) {
      const client = createClient({
        apiKey: process.env.API_FOOTBALL_KEY,
        dailyBudget: Number(process.env.API_FOOTBALL_BUDGET ?? 6800),
      });
      football = createFootball({
        pool, client, io,
        requireAuth: auth.requireAuth,
        // Branchement du bonus live des duels : un but du club suivi pendant
        // un duel devient un evenement du duel, estampille par le serveur.
        onGoal: async (g) => {
          // 0. Secouer la corde du Grand Virage AVANT de frapper les cartes :
          //    ceux qui chantaient à la seconde du but doivent être comptés
          //    présents, et la minute double s'ouvre aussitôt.
          try { virage.realGoal(g); } catch (e) { console.error('[virage]', e.message); }

          // 1. Frapper la carte-souvenir et la distribuer aux présents.
          //    Le rang du but sert de cle : rejouer un match ne refrappe rien.
          try {
            await souvenirs.mintGoal({
              fixtureId: g.fixtureId, seq: g.seq ?? 0, leagueId: g.leagueId,
              teamId: g.teamId, homeId: g.home?.id, awayId: g.away?.id,
              minute: g.minute, player: g.player,
              scoreHome: g.score?.[0] ?? 0, scoreAway: g.score?.[1] ?? 0,
              kickoffAt: g.kickoffAt,
            });
          } catch (e) { console.error('[souvenir]', e.message); }

          // 2. Souffle offert aux joueurs de ce club actuellement en duel.
          if (!globalThis.duels) return;
          const teamName = g.teamId === g.home?.id ? g.home?.name : g.away?.name;
          for (const userId of await football.store.followersOfTeam(g.teamId)) {
            await globalThis.duels.liveGoal(userId, g.fixtureId, teamName ?? '', g.minute ?? 0);
          }
        },
      });
      app.use('/api/football', football.router);
      football.poller.start();
      console.log('suivi des equipes actif');

      // ---- teletexte : classements, resultats, buteurs de toutes les ligues
      // Le télétexte range ce qu'il lit : les équipes et les matchs alimentent
      // aussi le suivi des clubs et le Grand Virage, sans un appel de plus.
      teletext = createTeletext({ pool, client, footballStore: football.store });
      app.use('/api/tt', teletext.router);
      setInterval(() => teletext.cleanup().catch(() => {}), 24 * 3600 * 1000).unref();
      console.log('teletexte actif');
    } else {
      console.warn('API_FOOTBALL_KEY absent : suivi des equipes desactive');
    }
    if (!process.env.SESSION_SECRET) {
      console.warn('SESSION_SECRET absent : à définir avant toute ouverture au public');
    }
  } catch (e) {
    console.error('base injoignable, authentification désactivée :', e.message);
  }
} else {
  console.warn('DATABASE_URL absent : authentification désactivée');
}

/* ---------------------------------------------------------------- routes */

// Les visuels ne changent jamais : un an de cache. Les pages, une heure.
app.use('/img', express.static(path.join(__dirname, 'public/img'), { maxAge: '365d', immutable: true }));
app.use('/video', express.static(path.join(__dirname, 'public/video'), { maxAge: '365d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    node: process.version,
    uptime_s: Math.round((Date.now() - started) / 1000),
    sockets,
    db: pool ? 'connectée' : process.env.DATABASE_URL ? 'injoignable' : 'absente',
    auth: auth ? 'active' : 'désactivée',
    football: football ? 'actif' : 'désactivé',
    souvenirs: souvenirs ? 'actives' : 'désactivées',
    fanzzy: fanzzy ? 'active' : 'désactivée',
    virage: virage ? virage.rooms.size + ' salle(s)' : 'désactivé',
    teletext: teletext ? 'actif' : 'désactivé',
    onboarding: onboarding ? 'actif' : 'désactivé',
    duel: duels ? duels.stats : null,
    mail: process.env.SMTP_URL ? 'smtp' : 'console',
    origin: ORIGIN,
  });
});

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/teletext', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'teletext.html')));
app.get('/bienvenue', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'bienvenue.html')));
app.get('/compte', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'compte.html')));
app.get('/diagnostic', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'diagnostic.html')));
app.get('/equipes', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'equipes.html')));
app.get('/duel', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'duel.html')));
app.get('/fanzzy', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'fanzzy.html')));
app.get('/virage', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'virage.html')));
app.get('/carnet', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'carnet.html')));

/* -------------------------------------------------------------- socket.io */

// Le diagnostic et le suivi des équipes fonctionnent sans compte ; seul le
// duel exige une identité, et il la vérifie lui-même à l'entrée en file.
io.use(async (socket, next) => {
  if (socketAuth) socket.data.user = await socketAuth(socket.handshake.auth?.token, socket);
  next();
});

io.on('connection', (socket) => {
  sockets++;
  socket.on('ping:client', (t0, ack) => {
    if (typeof ack === 'function') {
      ack({ t0, serverTime: Date.now(), transport: socket.conn.transport.name, user: socket.data.user?.name ?? null });
    }
  });
  socket.conn.on('upgrade', (t) => socket.emit('transport', t.name));
  socket.emit('transport', socket.conn.transport.name);
  socket.on('disconnect', () => { sockets--; });
});

/* ------------------------------------------------------------- démarrage */

const port = Number(process.env.PORT ?? 3000);
http.listen(port, () => console.log(`thebestfan écoute sur ${port}`));

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`${sig} reçu, arrêt propre`);
    football?.poller.stop();
    virage?.stop();
    duels?.close();
    io.close();
    http.close(async () => {
      await pool?.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
