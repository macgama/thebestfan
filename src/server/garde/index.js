/**
 * Les gardes du serveur : en-têtes de sécurité, et débit maximal.
 *
 * ## Ce que ces gardes protègent, et ce qu'ils ne protègent pas
 *
 * Ils ne protègent pas le code du joueur : **sur le web, il n'y a rien à
 * protéger de ce côté-là**. Tout ce qui part au navigateur est lisible, quoi
 * qu'on fasse — minifier, obscurcir, désactiver le clic droit ne font que
 * ralentir de trois minutes quelqu'un qui sait ouvrir les outils de
 * développement. La seule question qui vaille est : *que se passe-t-il si le
 * joueur envoie n'importe quoi ?* Et la réponse vit côté serveur.
 *
 * Ces gardes-ci couvrent les deux angles que le serveur peut tenir :
 *
 * 1. **Ce que le navigateur d'un joueur a le droit de faire de nos pages.**
 *    Sans en-têtes, une page tierce peut nous afficher dans un cadre invisible
 *    et récolter des clics, et un fichier téléversé peut être servi comme du
 *    script.
 * 2. **À quelle cadence on accepte d'être appelé.** Les sockets étaient déjà
 *    bridées — un chant toutes les trois secondes — mais les routes HTTP ne
 *    l'étaient pas du tout. Ouvrir des boosters, chercher des joueurs, tenter
 *    des achats : rien n'empêchait mille appels par seconde depuis un script.
 */

/**
 * Les en-têtes de sécurité.
 *
 * Écrits à la main plutôt qu'avec `helmet` : sept lignes, aucune dépendance de
 * plus à suivre, et surtout chacune est **lisible ici** avec la raison qui la
 * justifie. Une politique de sécurité qu'on ne peut pas relire est une
 * politique qu'on n'ose plus modifier.
 */
export function entetesDeSecurite({ https = false } = {}) {
  return (req, res, next) => {
    /* Personne ne nous met dans un cadre. Sans ça, un site tiers affiche
       thebestfan dans une iframe transparente par-dessus ses propres boutons :
       le joueur croit cliquer chez eux et clique chez nous, connecté. */
    res.setHeader('X-Frame-Options', 'DENY');

    /* Le navigateur respecte le type que nous annonçons au lieu de le deviner.
       Sans ça, un fichier que nous servons comme une image mais qui contient du
       script peut être exécuté comme du script. */
    res.setHeader('X-Content-Type-Options', 'nosniff');

    /* Nos adresses ne partent pas chez les sites vers lesquels on sort. Une
       adresse de partage ou un identifiant dans l'URL fuiterait autrement dans
       les journaux d'un tiers. */
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    /* Rien de tout cela ne sert au jeu, et tout cela peut être demandé par du
       script injecté. On ferme ce qu'on n'utilise pas. */
    res.setHeader('Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');

    /* En clair : ce n'est pas un site de partage. */
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    /* La politique de contenu. C'est celle qui compte : elle décide de ce qui
       peut s'exécuter dans nos pages, et donc de ce qu'un script injecté
       pourrait faire.
       — `default-src 'self'` : rien ne vient d'ailleurs par défaut.
       — `'unsafe-inline'` sur les scripts et les styles est **nécessaire** ici :
         les vingt pages portent leur script et leur feuille en ligne, c'est le
         parti pris du dépôt (aucune étape de compilation). Le supprimer
         demanderait un condensat par bloc, calculé à la livraison — c'est le
         bon geste, ce n'est pas celui d'aujourd'hui, et l'écrire ici est plus
         honnête que de laisser croire que la politique est stricte.
       — `img-src data:` : les repliements dessinés sont des SVG en ligne.
       — `connect-src` : nos propres websockets, et rien d'autre.
       — `frame-ancestors 'none'` double `X-Frame-Options` pour les navigateurs
         qui ne lisent plus le second. */
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://media.api-sports.io",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '));

    /* HSTS seulement en HTTPS : posé en clair, il n'a aucun effet, et il
       enfermerait un développement local en HTTPS pendant six mois. */
    if (https) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }

    next();
  };
}

/**
 * Le débit maximal, par adresse et par fenêtre.
 *
 * ## Pourquoi une fenêtre glissante et non un compteur remis à zéro
 *
 * Un compteur remis à zéro toutes les minutes laisse passer deux fois la limite
 * à cheval sur la bascule : cent appels à la cinquante-neuvième seconde, cent
 * autres à la soixante-et-unième. La fenêtre glissante compte ce qui s'est
 * réellement produit dans les soixante dernières secondes.
 *
 * ## Pourquoi en mémoire
 *
 * Le jeu tourne sur une seule instance. Le jour où il y en aura deux, ce
 * compteur devra passer en base ou dans un cache partagé — et ce jour-là il
 * faudra s'en souvenir, d'où cette phrase. En attendant, une table en mémoire
 * coûte zéro requête et répond en microsecondes, ce qui est exactement ce
 * qu'on veut d'un garde placé devant tout le reste.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne remplace pas les limites métier. « Un chant toutes les trois secondes »
 * est une règle du jeu et vit dans le jeu ; « pas plus de deux cents appels par
 * minute » est une règle d'exploitation et vit ici. Confondre les deux mène à
 * un jeu dont l'équilibre dépend d'un réglage d'infrastructure.
 *
 * ## Pourquoi les fichiers se comptent à part
 *
 * **Une page de ce jeu, ce n'est pas une requête.** C'est la page, sa feuille
 * de style, ses six scripts, la police, les icônes, les blasons des équipes et
 * les dessins des Fanzzy : entre trente et cinquante allers-retours. Comptés
 * dans le même seau que les appels de jeu, deux cent quarante par minute
 * tombaient au bout de **six pages** — soit un joueur qui se promène une minute
 * dans son menu.
 *
 * L'audit d'interface a rencontré exactement ça : à la quinzième page visitée,
 * la boutique, l'abonnement et les boosters ne servaient plus l'écran mais
 * le JSON « trop_de_requetes » en texte brut.
 *
 * Un fichier statique coûte une lecture de disque et rien d'autre. Il a donc
 * son propre seau, large. Ce qu'on protège vraiment — la base, Stripe,
 * l'API-Football — est derrière /api, et ce seau-là n'a pas bougé.
 */
/* Ce qui se sert depuis le disque et ne touche à rien. La liste est fermée
   volontairement : un chemin inconnu tombe dans le seau étroit, ce qui est le
   bon défaut — on préfère limiter trop que pas assez. */
const FICHIER = /\.(?:css|m?js|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|mp4|webm|ogg|mp3|json|webmanifest|txt|xml)$/i;

/* La page du refus. Pas de feuille de style liée : elle doit s'afficher
   précisément au moment où le serveur refuse de servir des fichiers. Elle porte
   donc ses couleurs sur elle, et elle se recharge toute seule quand la minute
   est passée — c'est la seule chose que le joueur avait à faire. */
const PAGE_429 = (secondes) => [
  '<!doctype html><html lang="fr"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>Une seconde…</title>',
  '<meta http-equiv="refresh" content="' + secondes + '">',
  '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;',
  'justify-content:center;background:#0A0D11;color:#F2EEE4;',
  'font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}',
  'b{display:block;font-size:22px;letter-spacing:.06em;text-transform:uppercase;',
  'margin-bottom:10px}p{opacity:.85;max-width:34ch;margin:0 auto}</style>',
  '</head><body><div><b>Une seconde…</b><p>Tu as tourné les pages plus vite que',
  ' le serveur ne les sert. Ça repart tout seul dans ' + secondes,
  ' secondes.</p></div></body></html>',
].join('');

export function debitMaximal({
  fenetreMs = 60_000,
  maxParFenetre = 240,
  /* Les écritures coûtent plus cher que les lectures, et ce sont elles qu'on
     rejoue pour tricher : on les compte à part, et plus serré. */
  maxEcritures = 80,
  /* Les fichiers : large, mais pas infini — un seau sans fond n'est plus un
     garde. Quinze cents laisse passer trente pages en une minute, ce qu'aucun
     doigt humain ne fait. */
  maxStatiques = 1500,
  exemptes = [],
} = {}) {
  /** adresse → { lectures: number[], ecritures: number[], fichiers: number[] } */
  const vus = new Map();

  /* Un ménage périodique : sans lui, la table garde une entrée par adresse
     ayant jamais appelé, et une instance qui tourne six mois finit par porter
     un million d'entrées mortes. */
  const menage = setInterval(() => {
    const limite = Date.now() - fenetreMs;
    for (const [cle, e] of vus) {
      e.lectures = e.lectures.filter((t) => t > limite);
      e.ecritures = e.ecritures.filter((t) => t > limite);
      e.fichiers = e.fichiers.filter((t) => t > limite);
      if (!e.lectures.length && !e.ecritures.length && !e.fichiers.length) vus.delete(cle);
    }
  }, fenetreMs);
  menage.unref?.();

  const middleware = (req, res, next) => {
    if (exemptes.some((p) => req.path.startsWith(p))) return next();

    /* `req.ip` tient compte de `trust proxy`, déjà réglé : derrière le proxy
       d'Infomaniak, l'adresse réelle est dans `X-Forwarded-For`, et sans ce
       réglage tout le monde partagerait l'adresse du proxy — c'est-à-dire que
       le premier joueur un peu actif bloquerait tous les autres. */
    const cle = req.ip ?? 'inconnu';
    const now = Date.now();
    const limite = now - fenetreMs;

    let e = vus.get(cle);
    if (!e) { e = { lectures: [], ecritures: [], fichiers: [] }; vus.set(cle, e); }
    e.lectures = e.lectures.filter((t) => t > limite);
    e.ecritures = e.ecritures.filter((t) => t > limite);
    e.fichiers = e.fichiers.filter((t) => t > limite);

    /* Trois seaux, un seul choix : ce qu'on écrit, ce qu'on lit, et ce qu'on
       sert depuis le disque. */
    const ecrit = req.method !== 'GET' && req.method !== 'HEAD';
    const seau = ecrit ? 'ecritures' : (FICHIER.test(req.path) ? 'fichiers' : 'lectures');
    const plafond = {
      ecritures: maxEcritures, fichiers: maxStatiques, lectures: maxParFenetre,
    }[seau];

    if (e[seau].length >= plafond) {
      /* On dit **quand** réessayer. Un 429 sans `Retry-After` fait rejouer
         aussitôt, ce qui aggrave exactement ce qu'on essaie de calmer. */
      res.setHeader('Retry-After', Math.ceil(fenetreMs / 1000));
      /* **Une navigation refusée doit rester une page.** Le navigateur qui
         reçoit du JSON en réponse à une barre d'adresse l'affiche tel quel :
         l'audit a photographié le message d'erreur en noir sur noir au milieu
         de la boutique. Ce n'est pas un message, c'est une fuite de plomberie.

         On ne le fait que pour ce qui demande de l'HTML et ne vient pas de
         l'API : un appel de jeu doit continuer à recevoir un objet que le code
         sait lire. */
      if (!req.path.startsWith('/api') && req.accepts?.('html') === 'html') {
        return res.status(429).type('html').send(PAGE_429(Math.ceil(fenetreMs / 1000)));
      }
      return res.status(429).json({ error: 'app.error.trop_de_requetes' });
    }

    e[seau].push(now);
    next();
  };

  /* Pour les suites : de quoi repartir propre, et de quoi lire l'état sans
     fabriquer deux cents requêtes pour vérifier qu'on en refuse la deux cent
     unième. */
  middleware.oublier = () => vus.clear();
  middleware.compte = (cle) => ({
    lectures: vus.get(cle)?.lectures.length ?? 0,
    ecritures: vus.get(cle)?.ecritures.length ?? 0,
    fichiers: vus.get(cle)?.fichiers.length ?? 0,
  });
  middleware.arreter = () => clearInterval(menage);

  return middleware;
}
