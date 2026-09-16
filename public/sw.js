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

/* La page servie quand le réseau ne répond pas. Écrite ici plutôt que cherchée
   sur le serveur : celui qui la lira n'a justement pas de serveur. */
const HORS_LIGNE = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hors ligne — thebestfan</title>
<style>
 html,body{margin:0;height:100%;background:#05070A;color:#F2EEE4;
   font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
   display:flex;align-items:center;justify-content:center;text-align:center}
 div{padding:32px;max-width:340px;line-height:1.7}
 b{display:block;font-size:19px;letter-spacing:.12em;margin-bottom:14px}
 small{opacity:.55;font-size:13px}
 button{margin-top:22px;padding:12px 22px;border-radius:9px;border:1px solid #F5C33B;
   background:none;color:#F5C33B;font:inherit;font-size:14px;cursor:pointer}
</style></head><body><div>
 <b>PAS DE RÉSEAU</b>
 <small>Le jeu se joue en direct : il lui faut une connexion.
 Dès qu'elle revient, tout reprend où tu l'avais laissé.</small>
 <button onclick="location.reload()">Réessayer</button>
</div></body></html>`;

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

/** Les dessins : ils ne changent pas, et ce sont eux qui pèsent. */
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
      try { return await fetch(request); }
      catch {
        return new Response(HORS_LIGNE,
          { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 503 });
      }
    })());
  }
});
