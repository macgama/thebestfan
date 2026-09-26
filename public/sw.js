/**
 * Le service worker.
 *
 * ## À quoi il sert ici, et à quoi il ne sert pas
 *
 * Il sert à **une** chose : rendre le jeu installable. Chrome ne propose
 * « Installer l'application » que si le site en a un — c'est la seule pièce
 * qui manquait, le manifeste et les icônes étant en place depuis toujours.
 * Sur iPhone, « Sur l'écran d'accueil » n'a jamais eu besoin de lui.
 *
 * Il ne sert **pas** à faire marcher le jeu hors ligne, et c'est délibéré :
 * tout ce que ce jeu fait est en direct. Une corde qu'on tire à plusieurs, un
 * score qui bouge, une file d'attente qui vit deux minutes. Un Grand Virage
 * servi depuis un cache serait un Grand Virage vide où l'on pousserait seul
 * contre une copie d'écran.
 *
 * ## Pourquoi presque rien n'est mis en cache
 *
 * La tentation, avec un service worker, est de garder les pages pour qu'elles
 * s'ouvrent vite. C'est exactement ce qu'il ne faut pas faire ici. Le jeu parle
 * à son serveur par socket, avec un protocole que les deux côtés doivent
 * partager : une page gardée d'avant un déploiement, c'est un client d'hier
 * qui parle à un serveur d'aujourd'hui. La panne serait silencieuse, rare, et
 * impossible à reproduire.
 *
 * Donc : **le réseau d'abord pour tout ce qui est du code**, et le cache
 * seulement pour ce qui ne peut pas mentir — les dessins. Un Fanzzy pèse deux
 * cents kilo-octets et ne change jamais ; c'est là qu'est le gain, et il n'y a
 * aucun risque à le garder.
 *
 * ## Ce qu'il ne touche sous aucun prétexte
 *
 * `/api/` et `/socket.io/` passent à côté de lui sans qu'il les regarde. Ce
 * sont le direct, les scores, l'authentification : rien de tout cela ne doit
 * pouvoir être servi deux fois.
 */

/* Le nom du cache porte un numéro. Le changer efface l'ancien au prochain
   démarrage — c'est le seul geste à faire si un jour on s'aperçoit qu'une
   image a été gardée à tort. */
const CACHE_IMAGES = 'tbf-images-1';

/* Les deux pages servies quand le jeu ne répond pas. Écrites ici plutôt que
   cherchées sur le serveur : celui qui les lira n'a justement pas de serveur. */
const ECRAN = (titre, mot, phrase, bouton, extra = '') => `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titre} — thebestfan</title>
<style>
 html,body{margin:0;height:100%;background:#05070A;color:#F2EEE4;
   font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
   display:flex;align-items:center;justify-content:center;text-align:center}
 div{padding:32px;max-width:340px;line-height:1.7}
 b{display:block;font-size:19px;letter-spacing:.12em;margin-bottom:14px}
 small{opacity:.55;font-size:13px}
 button{margin-top:22px;padding:12px 22px;border-radius:9px;border:1px solid #F5C33B;
   background:none;color:#F5C33B;font:inherit;font-size:14px;cursor:pointer}
 a{display:block;margin-top:16px;font-size:11px;opacity:.4;color:#F2EEE4}
</style></head><body><div>
 <b>${mot}</b>
 <small>${phrase}</small>
 <button onclick="location.reload()">${bouton}</button>
 <a href="/?sw-off=1">forcer le rechargement complet</a>
 ${extra}
</div></body></html>`;

const HORS_LIGNE = ECRAN('Hors ligne', 'PAS DE RÉSEAU',
  `Le jeu se joue en direct : il lui faut une connexion.
   Dès qu'elle revient, tout reprend où tu l'avais laissé.`,
  'Réessayer');

/* ## L'écran de redémarrage, et la règle qu'il a coûté cher d'apprendre
 *
 * Quand le serveur du jeu n'est pas là — une mise en ligne, un redémarrage —
 * l'hébergeur répond **à sa place** : « This website is currently undergoing
 * maintenance », en anglais, sur un fond bleu, avec son logo à lui. Pour le
 * joueur, c'est le jeu qui est mort. Il n'a aucune raison de réessayer une
 * minute plus tard, et beaucoup de raisons de ne pas revenir.
 *
 * ## La première version a mis le site entier hors service
 *
 * Elle reconnaissait nos pages à un en-tête `x-tbf` posé par `page()`, et
 * remplaçait **tout ce qui ne le portait pas**. L'en-tête n'arrive pas jusqu'au
 * navigateur — un proxy d'hébergement ne fait pas suivre les en-têtes qu'il ne
 * connaît pas —, donc plus aucune page ne le portait, donc toutes devenaient
 * cet écran. Le serveur répondait parfaitement ; `/healthz` était vert ; le jeu
 * était inaccessible, et l'écran d'attente se rechargeait à l'infini, ce qui
 * retirait au joueur jusqu'au moyen de s'en sortir.
 *
 * **Un garde-fou dans un service worker doit échouer ouvert.** Il est le
 * dernier maillon entre le joueur et le site : s'il se trompe dans le sens
 * « je bloque », personne ne peut plus rien, et il n'y a pas de bouton pour
 * l'éteindre. Le doute ne lui appartient pas.
 *
 * ## Ce qu'il fait maintenant
 *
 * Il ne remplace que les **pannes de passerelle** — 502, 503, 504 — que
 * l'hébergeur renvoie quand l'application ne répond pas. Une page qui arrive
 * normalement passe toujours, quoi qu'elle contienne et quels que soient ses
 * en-têtes. On attrape donc moins de cas qu'avant, et c'est le prix : aucun
 * réglage de proxy, aucun déploiement à moitié fait, aucune route oubliée ne
 * peut plus fermer le jeu depuis ici. */
/* ## Il réessaie de moins en moins souvent, et c'est important
 *
 * La première version rechargeait toutes les six secondes, indéfiniment. Sur
 * une mise en ligne de trente secondes c'est parfait ; sur une panne d'une
 * heure, chaque onglet ouvert frappe dix fois par minute, et ils frappent tous
 * **ensemble** au moment exact où le serveur se relève. Le premier écran qu'on
 * voit au retour est alors celui du limiteur de débit — on a fabriqué la
 * seconde panne avec l'écran censé adoucir la première.
 *
 * Six secondes, puis douze, puis vingt-quatre, plafonné à une minute. Le compte
 * vit dans `sessionStorage` parce que chaque rechargement rejoue ce script à
 * partir de rien : sans mémoire, il n'y a pas de « deuxième essai ». Et il est
 * remis à zéro par `pwa.js` dès qu'une vraie page s'ouvre — c'est la preuve que
 * le jeu est revenu, et la seule qui vaille.
 *
 * `try` partout : en navigation privée, l'accès peut lever. On retombe alors
 * sur six secondes, c'est-à-dire l'ancien comportement, ce qui est le bon
 * repli — mieux vaut réessayer trop que ne plus jamais réessayer. */
const REDEMARRE = ECRAN('Le jeu revient', 'LE JEU REDÉMARRE',
  `Ça arrive quand une nouvelle version est mise en ligne.
   Cette page réessaie toute seule — rien n'est perdu.`,
  'Recharger maintenant',
  `<script>(function(){var d=6000;try{
    var n=(+sessionStorage.getItem('tbf-attente')||0)+1;
    sessionStorage.setItem('tbf-attente',n);
    d=Math.min(60000,6000*Math.pow(2,n-1));
  }catch(e){}setTimeout(function(){location.reload()},d)})()</script>`);

/* On prend la main tout de suite, sans attendre que tous les onglets se
   ferment. Le comportement par défaut ferait tourner l'ancien service worker
   jusqu'à la prochaine fermeture complète de l'application — c'est-à-dire
   parfois des jours, sur un téléphone où l'on ne ferme rien. */
self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Les caches d'une version précédente n'ont plus de propriétaire.
    for (const nom of await caches.keys()) {
      if (nom !== CACHE_IMAGES) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

/* Les dessins : ils ne changent pas, et ce sont eux qui pèsent.
 *
 * Depuis que le serveur négocie le format, l'adresse ne dit plus ce qu'elle
 * renvoie : `neutre.webp` repart en AVIF à qui l'a annoncé dans `Accept`. Le
 * cache tient quand même, et sans rien changer ici — la réponse porte
 * `Vary: Accept`, et `cache.match` s'en sert : un enregistrement ne ressort que
 * pour une requête dont l'`Accept` correspond. Dans le pire des cas on manque
 * le cache et on redemande au réseau, ce qui est la bonne panne. Le jour où
 * quelqu'un ajoute `{ ignoreVary: true }` pour « améliorer le taux de cache »,
 * c'est un AVIF servi à un navigateur qui ne sait pas le lire. */
const estUneImage = (url) => url.origin === self.location.origin
  && /^\/img\//.test(url.pathname)
  && /\.(avif|webp|png|jpg|jpeg|svg|ico)$/i.test(url.pathname);

/** Ce qu'on ne regarde même pas. */
const estDuDirect = (url) => /^\/(api|socket\.io)\//.test(url.pathname);

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // Une écriture ne se rejoue pas : on ne touche qu'aux lectures.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* ## La sortie de secours
   *
   * `…/?sw-off=1` **désinstalle le service worker** et rend la page telle que
   * le serveur l'envoie. C'est le bouton qui manquait le jour où ce fichier a
   * mis le site hors service : un service worker s'installe tout seul, prend la
   * main sur toutes les navigations, et survit au rechargement — quand il se
   * trompe, le joueur n'a aucun moyen de s'en défaire depuis l'écran, et
   * l'ouverture des outils de développement n'est pas une réponse qu'on peut
   * demander à quelqu'un.
   *
   * Posé **avant tout le reste**, y compris avant `estDuDirect` : une porte de
   * sortie qui dépend du bon fonctionnement de ce qu'elle contourne n'est pas
   * une porte de sortie. */
  if (url.searchParams.has('sw-off')) {
    e.respondWith((async () => {
      try { await self.registration.unregister(); } catch { /* déjà parti */ }
      try { return await fetch(request); }
      catch { return new Response(HORS_LIGNE,
        { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 503 }); }
    })());
    return;
  }

  if (estDuDirect(url)) return;

  if (estUneImage(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE_IMAGES);
      const garde = await cache.match(request);
      if (garde) return garde;
      try {
        const rep = await fetch(request);
        // Seules les réponses complètes et valides : une image à moitié
        // téléchargée gardée pour toujours serait pire que pas d'image.
        if (rep.ok && rep.status === 200) cache.put(request, rep.clone());
        return rep;
      } catch {
        // Pas de réseau et pas en cache : on laisse le navigateur faire son
        // trou dans la page. Une image manquante n'est pas une panne.
        return Response.error();
      }
    })());
    return;
  }

  /* Tout le reste — pages, scripts, feuilles de style : le réseau, toujours.
     Le cache n'intervient que lorsqu'il n'y a plus de réseau du tout, et
     seulement pour dire pourquoi. */
  if (request.mode === 'navigate') {
    e.respondWith((async () => {
      const html = (corps, status) => new Response(corps,
        { headers: { 'content-type': 'text/html; charset=utf-8' }, status });
      let rep;
      try { rep = await fetch(request); }
      catch { return html(HORS_LIGNE, 503); }

      /* **Trois codes, et rien d'autre.** Voir `REDEMARRE` : tout test plus
         fin — un en-tête, une empreinte dans le corps — peut se tromper dans
         le sens qui ferme le jeu, et celui-là s'est déjà trompé. Une page qui
         arrive passe, toujours. */
      const panneDePasserelle = [502, 503, 504].includes(rep.status);
      return panneDePasserelle ? html(REDEMARRE, 503) : rep;
    })());
  }
});
