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
 */
export function debitMaximal({
  fenetreMs = 60_000,
  maxParFenetre = 240,
  /* Les écritures coûtent plus cher que les lectures, et ce sont elles qu'on
     rejoue pour tricher : on les compte à part, et plus serré. */
  maxEcritures = 80,
  exemptes = [],
} = {}) {
  /** adresse → { lectures: number[], ecritures: number[] } */
  const vus = new Map();

  /* Un ménage périodique : sans lui, la table garde une entrée par adresse
     ayant jamais appelé, et une instance qui tourne six mois finit par porter
     un million d'entrées mortes. */
  const menage = setInterval(() => {
    const limite = Date.now() - fenetreMs;
    for (const [cle, e] of vus) {
      e.lectures = e.lectures.filter((t) => t > limite);
      e.ecritures = e.ecritures.filter((t) => t > limite);
      if (!e.lectures.length && !e.ecritures.length) vus.delete(cle);
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
    if (!e) { e = { lectures: [], ecritures: [] }; vus.set(cle, e); }
    e.lectures = e.lectures.filter((t) => t > limite);
    e.ecritures = e.ecritures.filter((t) => t > limite);

    const ecrit = req.method !== 'GET' && req.method !== 'HEAD';
    const trop = ecrit
      ? e.ecritures.length >= maxEcritures
      : e.lectures.length >= maxParFenetre;

    if (trop) {
      /* On dit **quand** réessayer. Un 429 sans `Retry-After` fait rejouer
         aussitôt, ce qui aggrave exactement ce qu'on essaie de calmer. */
      res.setHeader('Retry-After', Math.ceil(fenetreMs / 1000));
      return res.status(429).json({ error: 'app.error.trop_de_requetes' });
    }

    (ecrit ? e.ecritures : e.lectures).push(now);
    next();
  };

  /* Pour les suites : de quoi repartir propre, et de quoi lire l'état sans
     fabriquer deux cents requêtes pour vérifier qu'on en refuse la deux cent
     unième. */
  middleware.oublier = () => vus.clear();
  middleware.compte = (cle) => ({
    lectures: vus.get(cle)?.lectures.length ?? 0,
    ecritures: vus.get(cle)?.ecritures.length ?? 0,
  });
  middleware.arreter = () => clearInterval(menage);

  return middleware;
}
