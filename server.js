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
    mail: process.env.SMTP_URL ? 'smtp' : 'console',
    origin: ORIGIN,
  });
});

app.get('/', (_req, res) => res.redirect('/compte'));
app.get('/compte', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'compte.html')));
app.get('/diagnostic', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'diagnostic.html')));
app.get('/equipes', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'equipes.html')));

/* -------------------------------------------------------------- socket.io */

io.use(async (socket, next) => {
  if (!socketAuth) return next(); // avant la base : connexion anonyme tolérée
  const token = socket.handshake.auth?.token;
  const who = await socketAuth(token, socket);
  if (!who) return next(new Error('auth.error.unauthenticated'));
  socket.data.user = who;
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
    io.close();
    http.close(async () => {
      await pool?.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
