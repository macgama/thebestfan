/**
 * thebestfan.online — serveur.
 *
 * Démarre même sans base configurée : dans ce cas l'authentification est
 * désactivée et /diagnostic le signale, plutôt que de faire planter le site.
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { createPool } from './src/server/auth/db.js';
import { createAuth } from './src/server/auth/routes.js';
import { createMailer } from './src/server/auth/mailer.js';
import { createSocketAuthenticator } from './src/server/auth/socket.js';
import { verifierSchema, messageDeManque } from './src/server/auth/schema.js';
import { createClient } from './src/server/football/client.js';
import { createFootball } from './src/server/football/routes.js';
import { createCouleurs } from './src/server/football/couleurs.js';
import { createSouvenirs } from './src/server/souvenirs/index.js';
import { createFanzzy } from './src/server/fanzzy/index.js';
import { charger as chargerCatalogue } from './src/server/fanzzy/catalogue.js';
import { chargerTenues } from './src/server/fanzzy/tenues.js';
import { createVirage } from './src/server/ferveur/index.js';
import { createTeletext } from './src/server/teletext/index.js';
import { createOnboarding } from './src/server/onboarding/index.js';
import { createGoogleAuth } from './src/server/auth/google.js';
import { createClassements } from './src/server/classements/index.js';
import { createDecks } from './src/server/deck/index.js';
import { createNiveau } from './src/server/niveau/index.js';
import { createKop } from './src/server/kop/index.js';
import { createAmis } from './src/server/amis/index.js';
import { createAdmin } from './src/server/admin/index.js';
import { createNvN } from './src/server/nvn/index.js';

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

/**
 * Le code qui tourne réellement, en une ligne.
 *
 * `scripts/deployer.sh` écrit ce fichier juste après avoir récupéré le dépôt.
 * Sans lui, un déploiement ne pouvait pas se vérifier : `/healthz` disait que
 * le site était ouvert, ce qui restait vrai **quand le redémarrage n'avait pas
 * eu lieu** — l'ancienne version répondait très bien. Le déploiement se
 * croyait fini, la correction n'était pas en ligne, et on le découvrait le
 * lendemain.
 *
 * Absent en développement, et c'est normal : on n'y déploie rien.
 */
const VERSION = (() => {
  try { return readFileSync(path.join(__dirname, 'VERSION'), 'utf8').trim() || null; }
  catch { return null; }
})();

/**
 * Ce qui a empêché le démarrage d'aller au bout, s'il y a lieu.
 *
 * Le serveur sait démarrer sans base — c'est voulu, ça permet de travailler le
 * front sans rien installer. Mais ce mode dégradé était muet : /healthz
 * répondait `ok: true` alors que plus aucune route /api n'existait. On garde
 * donc la raison ici pour que le diagnostic tienne en un curl.
 */
let panneDemarrage = null;

/* ------------------------------------------------ base et authentification */

let pool = null;
let auth = null;
let socketAuth = null;
let football = null;
let souvenirs = null;
let fanzzy = null;
let virage = null;
let teletext = null;
let onboarding = null;
let classements = null;
let decks = null;
let niveau = null;
let kop = null;
let amis = null;
let admin = null;
let nvn = null;
let google = null;

if (process.env.DATABASE_URL) {
  try {
    pool = await createPool(process.env.DATABASE_URL);

    // Le déploiement pousse le code, jamais le schéma. Une table absente fait
    // lever le premier module qui s'en sert, et comme le catch plus bas attrape
    // tout, c'est l'application entière qui s'éteint — connexion comprise. On
    // regarde donc avant, et on nomme le fichier à appliquer.
    const manques = await verifierSchema(pool, path.join(__dirname, 'sql'));
    if (manques.length) {
      panneDemarrage = messageDeManque(manques);
      console.error(panneDemarrage);
    }

    // Le catalogue Fanzzy vient de la base et se lit en mémoire. Il doit être
    // chargé avant tout module qui s'en sert — collection, deck, inscription —
    // sinon ils travaillent sur un catalogue vide et le disent mal.
    const cat = await chargerCatalogue(pool);
    // Les tenues aussi : elles se gèrent depuis l’administration, donc elles
    // vivent en base. Chargées avant les modules qui les lisent — collection,
    // inscription — sinon ils travaillent sur un catalogue vide.
    const ten = await chargerTenues(pool);
    console.log(`catalogue des tenues : ${ten.total} tenue(s)`
      + (ten.amorces ? ` (${ten.amorces} amorcée(s))` : ''));
    console.log(`catalogue fanzzy : ${cat.total} carte(s)`
      + (cat.amorces ? ` (${cat.amorces} amorcée(s) depuis dex.js)` : '')
      // Les séries ouvertes décident de ce qu'un joueur peut obtenir. Le jour
      // où les boosters ne proposent qu'une série, il faut pouvoir vérifier en
      // une ligne de journal que c'est voulu et non un réglage perdu.
      + (cat.series ? ` · séries ouvertes : ${cat.series.join(', ')}`
                    : ' · toutes les séries ouvertes'));
    const mailer = createMailer({
      smtpUrl: process.env.SMTP_URL,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.MAIL_FROM,
      origin: ORIGIN,
    });
    globalThis.mailer = mailer;
    // Vérification au démarrage : mieux vaut voir l'erreur maintenant que
    // découvrir dans trois jours que personne n'a reçu son mail.
    mailer.test?.call && setTimeout(() => { void mailer.status; }, 0);
    auth = createAuth({
      pool, mailer, origin: ORIGIN,
      sessionSecret: process.env.SESSION_SECRET ?? 'secret-absent-a-corriger',
    });
    socketAuth = createSocketAuthenticator({
      store: auth.store,
      sessionSecret: process.env.SESSION_SECRET ?? 'secret-absent-a-corriger',
    });

    app.use(auth.attachUser);

    // Connexion Google, montée avant les routes classiques pour que
    // /api/auth/google/* ne passe pas par la vérification d'origine.
    google = createGoogleAuth({
      pool, store: auth.store, origin: ORIGIN,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    });
    app.use('/api/auth', google.router);
    console.log(google.actif ? 'connexion google active'
      : 'GOOGLE_CLIENT_ID absent : connexion google desactivee');

    app.use('/api/auth', auth.router);

    // ---- niveau et XP
    //
    // Monté avant tout ce qui le consulte : decks, duels, collection et
    // inscription lui demandent les droits du joueur. Construit après eux, il
    // resterait à `null` dans leurs fermetures — une panne qui ne dit rien,
    // celle que verif-cablage.mjs existe pour attraper.
    niveau = createNiveau({ pool, requireAuth: auth.requireAuth });
    app.use('/api/niveau', niveau.router);
    console.log('niveau et XP actifs');

    // ---- les KOP : caisse commune, votes, bonus de virage
    //
    // Monté avant les duels et le virage, qui le consultent : le premier y
    // verse la part du club, le second y lit les bonus actifs.
    kop = createKop({ pool, io, requireAuth: auth.requireAuth });
    app.use('/api/kop', kop.router);
    console.log('KOP actifs');

    /* ---- les amis
       Monté juste après le KOP, et il en dépend : accepter une invitation
       passe par `kop.rejoindre`, pour que les règles d’entrée — suivre le
       club, un seul KOP par club — restent écrites à un seul endroit. */
    amis = createAmis({ pool, requireAuth: auth.requireAuth, kop });
    app.use('/api/amis', amis.router);
    console.log('amis actifs');

    // ---- decks de duel et choix du match support
    decks = createDecks({ pool, requireAuth: auth.requireAuth, niveau });
    app.use('/api/deck', decks.router);
    globalThis.decks = decks;
    console.log('decks actifs');

    // ---- duel N contre N (tir a la corde en equipe)
    nvn = createNvN({ pool, io, decks, requireAuth: auth.requireAuth, niveau, kop });
    app.use('/api/nvn', nvn.router);
    console.log('duels NvN actifs');

    // ---- administration
    admin = createAdmin({ pool, requireAuth: auth.requireAuth,
      deps: { client: globalThis.footClient ?? null, virage: null } });
    app.use('/api/admin', admin.router);
    // Amorçage : sans cela, personne ne peut devenir administrateur, puisque
    // seul un administrateur peut en nommer un autre.
    if (process.env.ADMIN_EMAILS) {
      const n = await admin.amorcer(process.env.ADMIN_EMAILS).catch((e) => {
        console.error('[admin] amorçage', e.message); return 0;
      });
      if (n) console.log(`administration : ${n} compte(s) promu(s)`);
    }
    console.log('administration active');

    // ---- classements
    classements = createClassements({ pool, requireAuth: auth.requireAuth });
    app.use('/api/rank', classements.router);
    console.log('classements actifs');

    // Entretien quotidien : sessions, jetons et tentatives périmés.
    setInterval(() => auth.store.cleanup().catch((e) => console.error('[auth] purge', e.message)),
      24 * 60 * 60 * 1000).unref();

    console.log('authentification active');

    // ---- collection Fanzzy
    fanzzy = createFanzzy({ pool, requireAuth: auth.requireAuth, niveau });
    app.use('/api/fanzzy', fanzzy.router);
    globalThis.fanzzy = fanzzy;
    console.log('collection fanzzy active');

    // ---- cartes-souvenirs
    souvenirs = createSouvenirs({ pool, requireAuth: auth.requireAuth });
    app.use('/api/souvenirs', souvenirs.router);
    console.log('cartes-souvenirs actives');

    // ---- inscription, emplacements de suivi, inventaire
    onboarding = createOnboarding({ pool, requireAuth: auth.requireAuth, football: null, niveau });
    app.use('/api/me', onboarding.router);
    console.log('inscription et inventaire actifs');

    /* ---- les couleurs des clubs
       Extraites du blason, une fois par club, hors quota — c'est le CDN de
       l'API, pas l'API. Elles teignent « GOAL ! » aux couleurs de l'équipe.
       Rien du blason lui-même n'est conservé : deux couleurs, et c'est tout. */
    const couleurs = createCouleurs({ pool });
    console.log('couleurs des clubs actives');

    // ---- Grand Virage (tir a la corde en direct)
    /* `decks` donne au Virage la main de chaque supporter. Il est créé plus
       haut, donc disponible : sans lui la salle s'ouvre quand même, et tout le
       monde y entre avec sa voix pour seule arme. */
    virage = createVirage({ pool, io, requireAuth: auth.requireAuth,
      souvenirs, fanzzy, kop, couleurs, decks });
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
        // Fin de match : on efface le classement et les buteurs de cette
        // compétition. C'est exactement le moment où les gens vont les
        // regarder, et six heures de cache les rendraient faux.
        onFinished: async (f) => {
          try { await teletext?.invalider(f.leagueId); }
          catch (e) { console.error('[teletext] invalidation', e.message); }
        },

        /* ---------------------------------------------- le fil du match
           Trois branchements, et deux d'entre eux ne coûtent aucun appel.

           `onStatus` part à chaque tour du relevé du direct : le score, la
           minute et la période sont déjà dans la réponse. `onEvents` porte
           les cartons et les remplacements, qui eux se paient — d'où
           `fixturesAuFil`, qui répond « seulement pour les matchs dont une
           salle est occupée ». */
        onStatus: (fixtureId, etat) => virage.matchStatus(fixtureId, etat),
        onEvents: (fixtureId, events) => virage.matchEvents(fixtureId, events),
        fixturesAuFil: () => virage.sallesOccupees(),
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

          // 2. Le but déborde sur les duels adossés à ce match : ceux qui
          //    suivent le club buteur reprennent leur souffle, et la corde
          //    tressaille du côté où ils sont les plus nombreux.
          try {
            const abonnes = new Set(await football.store.followersOfTeam(g.teamId));
            nvn?.butReel(g, abonnes);
          } catch (e) { console.error('[nvn] but réel', e.message); }
        },
      });
      app.use('/api/football', football.router);

      // L'inscription est montée plus haut, avant que le suivi existe : elle a
      // reçu `null`. On la rebranche ici, sinon le club choisi à la cérémonie
      // d'arrivée n'a jamais son calendrier et le joueur neuf ne trouve aucun
      // match dans /deck ni dans /duel-nvn.
      if (onboarding) onboarding.football = football;

      football.poller.start();
      console.log('suivi des equipes actif');

      // ---- teletexte : classements, resultats, buteurs de toutes les ligues
      // Le télétexte range ce qu'il lit : les équipes et les matchs alimentent
      // aussi le suivi des clubs et le Grand Virage, sans un appel de plus.
      globalThis.footClient = client;
      if (admin) admin.deps = { client, virage };
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
    // Ce message annonçait « base injoignable » quoi qu'il arrive. Le jour où
    // c'était une table manquante, il envoyait chercher la panne du mauvais
    // côté pendant que le site restait fermé.
    panneDemarrage ??= `démarrage interrompu : ${e.message}`;
    console.error('AUCUNE ROUTE /api MONTÉE — le site est en ligne mais fermé.');
    console.error(panneDemarrage);
  }
} else {
  panneDemarrage = 'DATABASE_URL absent : aucune route /api n’est montée.';
  console.warn(panneDemarrage);
}

/* ---------------------------------------------------------------- routes */

// Express ne connaît pas encore l'AVIF : sans ça, les images partent en
// « application/octet-stream » et ne tiennent que par la reconnaissance de
// format du navigateur — ce qui casse le cache de certains proxys.
const TYPES = { '.avif': 'image/avif', '.webmanifest': 'application/manifest+json' };
const typer = (res, chemin) => {
  const t = TYPES[path.extname(chemin).toLowerCase()];
  if (t) res.setHeader('content-type', t);
};

/* Le seul fichier de `/img` qui doit changer.
 *
 * `index.json` dit quels dessins existent pour chaque Fanzzy. Il vit avec eux
 * — c'est ce qui l'empêche de mentir, il est produit du même passage — mais il
 * ne partage pas leur immuabilité : servi en « immutable, un an » comme ses
 * voisins, un joueur qui a ouvert l'accueil une fois n'apprendrait jamais
 * qu'une nouvelle lignée a été dessinée. Le nouveau Fanzzy serait en ligne, sur
 * le disque, dans la base, et invisible chez lui.
 *
 * Une heure, donc, et cette route avant le static qui la couvrirait. */
app.get('/img/fanzzy/index.json', (_req, res) => {
  res.set('cache-control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'public/img/fanzzy/index.json'));
});

// Les visuels ne changent jamais : un an de cache. Les pages, une heure.
app.use('/img', express.static(path.join(__dirname, 'public/img'),
  { maxAge: '365d', immutable: true, setHeaders: typer }));
app.use('/video', express.static(path.join(__dirname, 'public/video'),
  { maxAge: '365d', immutable: true }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', setHeaders: typer }));

app.get('/healthz', (_req, res) => {
  // `ok` disait vrai tant que le processus respirait — y compris quand plus
  // aucune route /api n'existait. Une surveillance branchée dessus n'avait donc
  // rien vu passer. Il dit maintenant si le site est ouvert, pas s'il est vivant.
  res.json({
    ok: !panneDemarrage,
    ...(panneDemarrage ? { panne: panneDemarrage } : {}),
    // Le commit en ligne : c'est lui que le déploiement attend pour se
    // déclarer terminé. Voir `VERSION` plus haut.
    version: VERSION,
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
    classements: classements ? 'actifs' : 'désactivés',
    decks: decks ? 'actifs' : 'désactivés',
    admin: admin ? 'actif' : 'désactivé',
    nvn: nvn ? { salles: nvn.salles.size, files: nvn.files.size } : 'désactivé',
    google: google?.actif ? 'active' : 'désactivée',
    mail: globalThis.mailer?.status ?? { etat: 'console' },
    origin: ORIGIN,
  });
});

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/teletext', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'teletext.html')));
app.get('/matchs', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'aujourdhui.html')));
app.get('/bienvenue', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'bienvenue.html')));
app.get('/profil', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'profil.html')));
app.get('/classement', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'classement.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
// Fiche d'un Fanzzy : /fanzzy/V3 comme /fanzzy?id=V3, pour des liens partageables.
app.get('/fanzzy/:id', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'fanzzy-fiche.html')));
app.get('/compte', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'compte.html')));
app.get('/diagnostic', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'diagnostic.html')));
app.get('/equipes', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'equipes.html')));
app.get('/kop', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'kop.html')));
app.get('/amis', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'amis.html')));
app.get('/deck', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'deck.html')));
app.get('/duel-nvn', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'duel-nvn.html')));
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
    nvn?.stop();
    io.close();
    http.close(async () => {
      await pool?.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
