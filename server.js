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
import { charger as chargerCatalogue, ecartsCatalogue }
  from './src/server/fanzzy/catalogue.js';
import { chargerReglages, reglagesPublics } from './src/server/reglages/index.js';
import { VERSION_PUBLIQUE } from './src/shared/version.js';
import { empreinte, estampiller, releverEmpreintes } from './src/server/empreintes.js';
import { reglage } from './src/shared/reglages.js';
import { entetesDeSecurite, debitMaximal } from './src/server/garde/index.js';
import { chargerTenues } from './src/server/fanzzy/tenues.js';
import { createVirage } from './src/server/ferveur/index.js';
import { createTeletext } from './src/server/teletext/index.js';
import { createOnboarding } from './src/server/onboarding/index.js';
import { createGoogleAuth } from './src/server/auth/google.js';
import { createClassements } from './src/server/classements/index.js';
import { createDecks } from './src/server/deck/index.js';
import { createNiveau } from './src/server/niveau/index.js';
import { createAbonnement } from './src/server/abonnement/index.js';
import { createContenus } from './src/server/contenus/index.js';
import { createAide } from './src/server/aide/index.js';
import { createRepetition } from './src/server/repetition/index.js';
import { createKop } from './src/server/kop/index.js';
import { createAmis } from './src/server/amis/index.js';
import { createAdmin } from './src/server/admin/index.js';
import { createNvN } from './src/server/nvn/index.js';
import { createBoutique } from './src/server/boutique/index.js';
import { negocierAvif } from './src/server/images/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = process.env.PUBLIC_ORIGIN ?? 'https://thebestfan.online';
const app = express();
const http = createServer(app);

app.disable('x-powered-by');
app.set('trust proxy', 1); // Infomaniak place un proxy devant : X-Forwarded-For fait foi

/* ------------------------------------------------------------ les gardes

   Avant tout le reste, et ce n'est pas une préférence de rangement : un garde
   posé après une route ne la garde pas. Ceux-ci couvrent donc les fichiers, les
   routeurs et le webhook de Stripe, sans exception à retenir.

   Ils ne protègent **pas** le code envoyé au navigateur : sur le web, il n'y a
   rien à protéger de ce côté-là. Tout ce qui part au client est lisible, et
   l'obscurcir ne ralentit que les curieux. La sécurité du jeu tient à ce que le
   serveur ne croie rien sur parole — c'est déjà le cas partout : les gestes
   sont notés ici, l'identité vient de la session et jamais du message, et
   chaque requête SQL est paramétrée. */

/* **`PUBLIC_ORIGIN` en premier, `SITE_URL` en repli.**

   Cette ligne ne lisait que `SITE_URL` — une variable que rien d'autre ne
   lit dans le serveur, et que la procédure de déploiement ne demande pas.
   Une installation faite selon la documentation posait donc `PUBLIC_ORIGIN`,
   laissait `SITE_URL` vide, et **n'envoyait jamais l'en-tête HSTS** : le
   site répond en HTTPS, et aucun navigateur ne se le voit dire. Quelqu’un
   qui tape l'adresse sans protocole passe en clair au moins une fois.

   Deux noms pour la même chose finissent toujours par se contredire : on
   lit d'abord celui que tout le monde emploie, et l'autre reste accepté pour
   les installations qui l'ont déjà posé. */
const SITE_EN_HTTPS = [process.env.PUBLIC_ORIGIN, process.env.SITE_URL, ORIGIN]
  .some((u) => String(u || '').startsWith('https://'));
app.use(entetesDeSecurite({ https: SITE_EN_HTTPS }));

/* Le débit maximal. Les sockets étaient déjà bridées — un chant toutes les
   trois secondes, une action toutes les demi-secondes — mais **aucune route
   HTTP ne l'était**. Rien n'empêchait un script d'ouvrir des boosters ou de
   tenter des achats mille fois par seconde.

   `/healthz` en est exempté : c'est la sonde de l'hébergeur, elle appelle sans
   arrêt et elle a le droit. Le webhook de Stripe aussi : Stripe rejoue ses
   événements en rafale quand il croit qu'on ne répond pas, et lui répondre 429
   le ferait rejouer encore plus. Sa protection à lui est la signature, qui est
   plus sûre qu'un compteur. */
const limiteur = debitMaximal({
  exemptes: ['/healthz', '/api/boutique/webhook'],
});
app.use(limiteur);

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
let abonnement = null;
let virage = null;
let teletext = null;
let onboarding = null;
let classements = null;
let decks = null;
let niveau = null;
let kop = null;
let amis = null;
let admin = null;
let boutique = null;
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

    /* Les réglages d'abord : le catalogue, l'inscription et les moteurs de
       jeu lisent des valeurs qui viennent d'ici. Chargés après eux, les
       premiers appels travailleraient sur les valeurs du registre pendant que
       l'administration en affiche d'autres — et rien ne le dirait. */
    /* Les empreintes, relevées une fois : on paie le calcul au démarrage
       plutôt qu'à la première visite, et **un zéro ici veut dire qu'on sert le
       site sans protection de cache** — ce qu'on ne veut pas découvrir par un
       joueur qui redemande comment vider le sien. */
    const estampes = releverEmpreintes(path.join(__dirname, 'public'));
    console.log(`empreintes : ${estampes.length} fichier(s) de code sous cache long`);

    const reg = await chargerReglages(pool);
    console.log(`réglages : ${Object.keys(reg).length} clés effectives`);

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
    /* Les saisons sont chargées par `chargerCatalogue` — ce sont elles qui
       décident des séries ouvertes, et tout ce qui monte un catalogue passe par
       là. On ne les charge pas ici, on les annonce : le jour où le kiosque ne
       propose plus rien, cette ligne dit si c'est une saison mal réglée ou un
       fichier de schéma non appliqué. */
    console.log(cat.saisons === null
      ? 'saisons : table absente — applique sql/saisons.sql'
      : `saisons : ${cat.saisons} déclarée(s)`);
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

    /* ---- l'abonnement

       Monté **avant** tout ce qui ouvre quelque chose, parce que tout ce qui
       ouvre quelque chose le lui demande. Il vend de la largeur et du
       confort, jamais de la puissance : tous les formats de duel, tous les
       âges et tous les classements restent ouverts à tout le monde. Voir la
       tête de `abonnement/index.js`. */
    abonnement = createAbonnement({ pool, requireAuth: auth.requireAuth });
    app.use('/api/abonnement', abonnement.router);
    globalThis.abonnement = abonnement;
    console.log('abonnement actif');


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
    kop = createKop({ pool, io, requireAuth: auth.requireAuth, abonnement });
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
    decks = createDecks({ pool, requireAuth: auth.requireAuth, niveau,
      /* La journée du football, pour le choix du match support. Même détour que
         pour le Virage : le télétexte se monte plus bas, la fonction le lira au
         moment de l'appel. Voir src/server/football/journee.js. */
      jourDuFoot: () => teletext?.jour('') ?? null });
    app.use('/api/deck', decks.router);
    globalThis.decks = decks;
    console.log('decks actifs');

    // ---- duel N contre N (tir a la corde en equipe)
    /* `abonnement` est monté plus haut, et il le faut : c'est lui qui dit
       combien de duels classés il reste dans la journée. Reçu à `null`, le
       duel ne plafonne rien — et personne ne s'en apercevrait, ce qui est
       exactement la panne que `verif-cablage.mjs` surveille. */
    nvn = createNvN({ pool, io, decks, requireAuth: auth.requireAuth, niveau, kop,
      abonnement });
    app.use('/api/nvn', nvn.router);
    console.log('duels NvN actifs');

    // ---- administration
    /* Les cartes d'action, l'équipement et les stades vivaient dans le code :
       une saison pouvait les annoncer, elle ne pouvait pas les ouvrir. Ce
       module les sème en base et porte leur état de publication.

       Chargé **avant** l'administration, parce que c'est elle qui publie au
       lancement d'une saison. Sans la table, il le dit et le jeu garde les
       listes du code, toutes jouables — l'état d'avant.

       Il vient **après** les modules de jeu, et c'est sans conséquence : les
       six tirages qui le lisent le font à la requête, jamais au montage. Ce
       qu'il faut, c'est qu'il soit chargé avant la première requête — et tout
       ceci s'exécute avant que le serveur n'écoute. */
    const contenus = createContenus({ pool });
    await contenus.charger();

    admin = createAdmin({ pool, requireAuth: auth.requireAuth,
      /* `abonnement` : l'administration peut en accorder un, ce qui ouvre la
         bêta sans attendre le prestataire de paiement — et restera le geste
         de service après-vente quand il sera branché. */
      deps: { client: globalThis.footClient ?? null, virage: null, abonnement,
        contenus } });
    app.use('/api/admin', admin.router);

    /* ------------------------------------------------- la fermeture du jeu

       Un réglage, et il est le plus dangereux de l'écran : mal posé, il
       enferme dehors celui qui vient de le poser.

       — Le premier test est le réglage lui-même, lu en mémoire : levé, ce
         verrou ne coûte rien. Fermé, et seulement fermé, on interroge la base
         pour le rôle — une requête par appel, acceptable le temps d'une
         fermeture, jamais le reste de l'année.
       — L'authentification et l'administration restent ouvertes. Sans ça il
         n'existe plus aucun chemin pour rouvrir autrement que dans la base :
         le réglage qui ferme doit toujours laisser passer celui qui rouvre.
       — Le refus se nomme. Un joueur qui lit « le jeu est fermé quelques
         minutes » attend ; devant une page qui s'écroule, il croit que c'est
         cassé et il s'en va. */
    const OUVERT_MALGRE_TOUT = /^\/(auth|admin|public)(\/|$)/;
    app.use('/api', async (req, res, next) => {
      if (!reglage('maintenance.actif')) return next();
      if (OUVERT_MALGRE_TOUT.test(req.path)) return next();
      try {
        if (req.user && await admin.estAdmin(req.user.id)) return next();
      } catch (e) {
        // Base injoignable pendant une fermeture : on refuse, mais en le
        // disant. Laisser passer par défaut ferait du verrou une décoration.
        console.error('[maintenance] rôle illisible', e.message);
      }
      return res.status(503).json({
        error: 'app.error.maintenance',
        message: reglage('maintenance.texte'),
      });
    });
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
    classements = createClassements({ pool, requireAuth: auth.requireAuth, abonnement });
    app.use('/api/rank', classements.router);
    console.log('classements actifs');

    // Entretien quotidien : sessions, jetons et tentatives périmés.
    setInterval(() => auth.store.cleanup().catch((e) => console.error('[auth] purge', e.message)),
      24 * 60 * 60 * 1000).unref();

    console.log('authentification active');

    // ---- collection Fanzzy
    /* `decks` : la fiche d'un Fanzzy dit où il est dans la tribune du joueur
       et permet de l'y placer. Le module de deck est monté plus haut, ce qui
       rend la dépendance possible dans ce sens et pas dans l'autre. */
    fanzzy = createFanzzy({ pool, requireAuth: auth.requireAuth, niveau, decks,
      abonnement });
    app.use('/api/fanzzy', fanzzy.router);
    globalThis.fanzzy = fanzzy;
    console.log('collection fanzzy active');

    /* ---- la boutique
       Deux montages, et l ordre compte. Le **webhook d abord**, avec son
       analyseur de corps brut : Stripe signe les octets qu il envoie, et un
       express.json() monté au-dessus les transformerait en objet avant
       qu on ait pu vérifier la signature. On accepterait alors n importe
       quel appel prétendant venir de Stripe, ce qui revient à offrir des
       boosters à qui connaît l adresse. */
    boutique = createBoutique({ pool, requireAuth: auth.requireAuth, fanzzy, abonnement });
    app.use("/api/boutique", boutique.webhook);
    app.use("/api/boutique", boutique.router);
    console.log(boutique.configure()
      ? "boutique active"
      : "boutique en vitrine — STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET manquent");

    // ---- cartes-souvenirs
    souvenirs = createSouvenirs({ pool, requireAuth: auth.requireAuth, abonnement });
    app.use('/api/souvenirs', souvenirs.router);
    console.log('cartes-souvenirs actives');

    // ---- inscription, emplacements de suivi, inventaire
    onboarding = createOnboarding({ pool, requireAuth: auth.requireAuth, football: null,
      niveau, decks, abonnement });
    app.use('/api/me', onboarding.router);
    console.log('inscription et inventaire actifs');

    /* ---- l'aide : la FAQ, et les premiers pas
       Monté après l'inscription parce qu'il lit ce qu'elle écrit, et il ne
       dépend de rien d'autre : ses six signaux se lisent directement en base,
       sans passer par un module de jeu. Une table ou une colonne absente vaut
       « pas fait » plutôt que de lever — c'est l'écran qu'on ouvre quand
       quelque chose ne va pas. */
    const aide = createAide({ pool, requireAuth: auth.requireAuth });
    app.use('/api/aide', aide.router);
    console.log('aide et premiers pas actifs');

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
      souvenirs, fanzzy, kop, couleurs, decks,
      /* Pour savoir si ce Virage-ci compte au classement. Absent, tout
         compte : voir le branchement du duel juste au-dessus. */
      abonnement,
      /* La journée du football, pour la liste « ailleurs en direct ».
         Le télétexte n'est pas encore monté — il l'est plus bas, et il a besoin
         du client API. On passe donc une **fonction** : elle lira `teletext`
         au moment de l'appel, pas maintenant. Tant qu'il n'est pas là, la liste
         retombe sur la base, qui ne connaît que les clubs suivis. */
      jourDuFoot: () => teletext?.jour('') ?? null });
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

          // 2. Le but déborde sur les duels adossés à ce match : la tribune
          //    du club buteur reprend son souffle, et la corde tressaille de
          //    son côté. Depuis que les deux camps d'un duel sont les deux
          //    clubs du match, il n'y a plus à demander à la base qui suit
          //    qui — c'est une lecture de moins à chaque but.
          try { nvn?.butReel(g); }
          catch (e) { console.error('[nvn] but réel', e.message); }
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

/* **Le service worker ne se met jamais en cache.**
 *
 * C'est lui qui décide de ce que le navigateur garde : un service worker
 * périmé est un jeu périmé, et il le resterait aussi longtemps que son cache.
 * Les navigateurs le savent et le relisent au plus toutes les vingt-quatre
 * heures ; on leur dit ici de le relire à chaque fois. Le fichier pèse quatre
 * kilo-octets, et c'est le prix d'un déploiement qui prend effet.
 *
 * Cette route passe avant le static, qui le servirait avec l'en-tête des
 * fichiers ordinaires. */
app.get('/sw.js', (_req, res) => {
  res.set('cache-control', 'no-cache');
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'public/sw.js'));
});

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

/* L'AVIF part à qui l'a annoncé dans `Accept`, sous l'adresse du WebP.
 *
 * C'est le serveur qui négocie, et c'est le seul endroit où la question se
 * pose correctement : le navigateur dit ce qu'il sait **lire** à chaque
 * requête d'image. La page, elle, avait essayé de le deviner en demandant à un
 * canvas ce qu'il savait **écrire** — personne n'encode l'AVIF, le format n'a
 * donc jamais été servi à qui que ce soit, et tout ce qui n'était pas Chrome
 * repartait avec une extension qui ne désignait aucun fichier. Le détail est
 * dans `src/server/images/index.js`.
 *
 * Avant le static, forcément : un middleware posé après ne réécrit plus rien.
 * Et `typer` reste en place derrière — c'est lui qui donne son type MIME à
 * l'AVIF, qu'Express ne connaît toujours pas. */
app.use('/img', negocierAvif(path.join(__dirname, 'public/img')));

// Les visuels ne changent jamais : un an de cache.
app.use('/img', express.static(path.join(__dirname, 'public/img'),
  { maxAge: '365d', immutable: true, setHeaders: typer }));
app.use('/video', express.static(path.join(__dirname, 'public/video'),
  { maxAge: '365d', immutable: true }));

/* ============================================ le code, et sa fraîcheur

   **Les mises à jour n'arrivaient pas chez les joueurs.**

   `public/` partait avec `max-age=1h` et les pages appelaient leurs scripts
   par une adresse fixe — `<script src="/cartes.js">`. Après un déploiement, un
   navigateur qui avait déjà ce fichier le ressortait de son propre cache sans
   demander au serveur : la page était neuve, son code ne l'était pas. Une heure
   en théorie, bien plus en pratique — un proxy d'hébergement garde une réponse
   `public` et la ressert à tout le monde, et une application posée sur l'écran
   d'accueil d'un iPhone est plus tenace encore. Les joueurs n'avaient d'autre
   issue que de vider leur cache, pour un jeu dont le client et le serveur
   doivent parler le même protocole.

   La règle tient en une phrase, et ses deux moitiés vont ensemble : **ce qui
   peut changer n'est jamais gardé, ce qui est gardé ne peut plus changer.**

   Une adresse estampillée — `/cartes.js?v=8f3a1c2e` — décrit un contenu et non
   un fichier : on peut la garder un an sans risque, puisqu'un contenu différent
   porte une autre adresse. Une adresse nue, elle, ne promet rien : on la
   revalide à chaque fois. Le coût est un aller-retour qui répond 304 sur
   quelques octets, et ça n'arrive qu'à qui tape l'adresse à la main.

   Voir `src/server/empreintes.js` pour le calcul et pour les raisons. */
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, fichier, ...reste) {
    typer(res, fichier, ...reste);
    const estampe = /\?v=/.test(res.req?.originalUrl ?? '');
    res.set('cache-control', estampe
      ? 'public, max-age=31536000, immutable'
      : 'no-cache');
  },
}));

/**
 * Ce que les réglages disent aux joueurs.
 *
 * Le filtrage vit dans `reglagesPublics()`, pas ici : la suite éprouve la
 * même fonction que la route. Une suite qui recopierait le filtre ne
 * contrôlerait qu'elle-même, et l'on pourrait le retirer du serveur sans
 * qu'un seul contrôle rougisse.
 */
app.get('/api/public/reglages', (_req, res) => {
  res.set('cache-control', 'no-store');
  res.json(reglagesPublics());
});

/**
 * La version que le joueur voit.
 *
 * **Ce n'est pas `/healthz`.** Celui-là rend l'empreinte du code en ligne, et
 * il est fait pour une surveillance : il dit tout, y compris l'état de la
 * base et le nombre de sockets. Celle-ci ne rend qu'un nom, et elle est
 * publique — le menu l'affiche à qui ouvre le tiroir.
 *
 * Une heure de cache : le numéro ne bouge qu'à une livraison, et un joueur
 * qui vient de recharger a de toute façon rechargé. Ce n'est pas `no-store`
 * comme les réglages, parce que rien ici ne dépend du joueur ni de l'instant.
 */
app.get('/api/version', (_req, res) => {
  res.set('cache-control', 'public, max-age=3600');
  res.json(VERSION_PUBLIQUE);
});

/**
 * Le catalogue en trois chiffres, pour `/healthz`.
 *
 * Rien sur les écarts quand il n'y en a pas : une clé « ecarts: 0 » à chaque
 * lecture se regarde deux fois puis plus jamais, et c'est exactement ce qu'on
 * cherche à éviter ici.
 */
function catalogueEnBref() {
  const e = ecartsCatalogue();
  if (!e) return 'non chargé';
  const orphelines = e.orphelines.filter((o) => o.publie).length;
  return {
    cartes: e.compteurs.base,
    aCollectionner: e.compteurs.aCollectionner,
    ...(e.faute ? {
      ecarts: {
        ...(e.manquantes.length ? { manquantes: e.manquantes.length } : {}),
        ...(orphelines ? { orphelines } : {}),
        ...(e.doublons.length ? { doublons: e.doublons.length } : {}),
        voir: 'npm run ecarts',
      },
    } : {}),
    ...(e.retouchees.length ? { retouchees: e.retouchees.length } : {}),
  };
}

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
    /* L'écart entre `dex.js` et la table `fanzzy`, relevé au chargement.
     *
     * Il est ici parce que c'est ici qu'on regarde après une mise en ligne, et
     * qu'une divergence de catalogue ne se voit nulle part ailleurs : ni
     * erreur, ni page cassée — un compteur qui n'est pas le bon, des semaines
     * plus tard.
     *
     * **Il ne touche pas à `ok`.** Ce drapeau dit si le site est ouvert, et un
     * catalogue qui a dérivé reste un site parfaitement ouvert. Le faire
     * passer au rouge ferait échouer des déploiements sains et apprendrait à
     * tout le monde à ignorer le rouge — ce qui coûterait la panne suivante,
     * la vraie. */
    catalogue: catalogueEnBref(),
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

/**
 * Une page, estampillée et jamais mise en cache.
 *
 * Elle est minuscule et elle porte les adresses de tout le reste : la garder
 * une seconde, c'est risquer de servir la carte d'un jeu qui a changé. Elle est
 * relue à chaque requête — le disque a son propre cache, et vingt kilo-octets
 * ne se mesurent pas à côté d'une requête SQL.
 *
 * `no-store` et non `no-cache` : le premier interdit de garder, le second
 * autorise à garder en obligeant à revalider. La nuance compte à travers un
 * proxy d'hébergement, qui répond volontiers à la place du serveur.
 */
function page(res, fichier) {
  const chemin = path.join(__dirname, 'public', fichier);
  try {
    res.set('cache-control', 'no-store');
    res.type('html').send(estampiller(readFileSync(chemin, 'utf8'),
      path.join(__dirname, 'public')));
  } catch {
    // Le fichier manque : on laisse Express rendre son 404 plutôt que
    // d'envoyer une page à moitié écrite.
    res.status(404).end();
  }
}

/* ------------------------------------------------------- la répétition

   **Hors du bloc qui exige une base**, et c'est tout son intérêt. Elle ne lit
   rien, n'écrit rien et ne paie rien : elle n'a besoin ni du pool, ni d'une
   garde d'entrée. Elle tient donc debout les jours où le reste du jeu ne
   répond plus — et c'est exactement l'écran qu'on a envie d'ouvrir ce jour-là.

   Montée ici, entre les routeurs et les pages, parce qu'elle appartient aux
   deux : une route d'API et l'écran qui la lit, sans une dépendance à déclarer
   entre les deux. */
app.use('/api/repetition', createRepetition().router);

app.get('/', (_req, res) => page(res, 'index.html'));
app.get('/teletext', (_req, res) => page(res, 'teletext.html'));
app.get('/matchs', (_req, res) => page(res, 'aujourdhui.html'));
app.get('/bienvenue', (_req, res) => page(res, 'bienvenue.html'));
app.get('/profil', (_req, res) => page(res, 'profil.html'));
app.get('/collection', (_req, res) => page(res, 'collection.html'));
app.get('/classement', (_req, res) => page(res, 'classement.html'));
app.get('/boutique', (_req, res) => page(res, 'boutique.html'));
/* L'abonnement a sa page, et non un rayon de la boutique : il ne s'achète pas
   comme un objet, il se comprend avant de s'acheter. Il lui faut la place de
   dire ce qu'il ouvre et, surtout, ce qu'il n'enferme pas — cette seconde
   liste est la promesse du jeu, et elle ne tient pas dans une vignette. */
app.get('/abonnement', (_req, res) => page(res, 'abonnement.html'));
app.get('/boosters', (_req, res) => page(res, 'boosters.html'));
app.get('/admin', (_req, res) => page(res, 'admin.html'));
// Fiche d'un Fanzzy : /fanzzy/V3 comme /fanzzy?id=V3, pour des liens partageables.
app.get('/fanzzy/:id', (_req, res) => page(res, 'fanzzy-fiche.html'));
app.get('/compte', (_req, res) => page(res, 'compte.html'));
app.get('/diagnostic', (_req, res) => page(res, 'diagnostic.html'));
app.get('/equipes', (_req, res) => page(res, 'equipes.html'));
app.get('/kop', (_req, res) => page(res, 'kop.html'));
app.get('/amis', (_req, res) => page(res, 'amis.html'));
app.get('/deck', (_req, res) => page(res, 'deck.html'));
app.get('/duel-nvn', (_req, res) => page(res, 'duel-nvn.html'));
app.get('/fanzzy', (_req, res) => page(res, 'fanzzy.html'));
app.get('/virage', (_req, res) => page(res, 'virage.html'));
app.get('/carnet', (_req, res) => page(res, 'carnet.html'));
/* L'aide porte les deux : le parcours des premiers pas et la FAQ. Une seule
   page parce qu'un joueur bloque rarement sur une question pure — il bloque sur
   ce qu'il est en train de faire, et la réponse est à côté de l'étape. */
app.get('/aide', (_req, res) => page(res, 'aide.html'));
app.get('/repetition', (_req, res) => page(res, 'repetition.html'));

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
