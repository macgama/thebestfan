/**
 * L'empreinte des fichiers servis, et pourquoi les pages ne se mettaient pas à
 * jour chez les joueurs.
 *
 * ## Le défaut
 *
 * `public/` était servi avec `max-age=1h`, et les pages appelaient leurs
 * scripts par une adresse fixe : `<script src="/cartes.js">`. Après un
 * déploiement, un navigateur qui avait déjà `/cartes.js` le ressortait de son
 * propre cache **sans demander au serveur** — la page était neuve, son code ne
 * l'était pas.
 *
 * Une heure en théorie. En pratique, bien plus : un proxy d'hébergement garde
 * une réponse `public, max-age=3600` et la ressert à tout le monde, et une
 * application posée sur l'écran d'accueil d'un iPhone est encore plus tenace.
 * D'où la seule issue que trouvaient les joueurs — vider le cache — pour un jeu
 * dont le client et le serveur doivent parler le même protocole.
 *
 * ## La règle, qui n'est pas négociable
 *
 * **Ce qui peut changer n'est jamais gardé ; ce qui est gardé ne peut plus
 * changer.** Les deux moitiés vont ensemble, et c'est la seconde qui manquait.
 *
 *   — Les pages : jamais de cache. Elles sont minuscules et elles portent les
 *     adresses de tout le reste.
 *   — Les scripts et les feuilles de style : leur adresse porte l'empreinte de
 *     leur contenu — `/cartes.js?v=8f3a1c2e9b`. Un fichier qui change change
 *     d'adresse, donc le navigateur le redemande **forcément** ; un fichier qui
 *     ne change pas garde la sienne et n'est jamais redemandé. On gagne le
 *     cache d'un an sur ce qui ne bouge pas, et l'on perd toute possibilité de
 *     servir du périmé.
 *
 * ## Pourquoi une empreinte par fichier, et non un numéro de version global
 *
 * Un numéro global — celui du déploiement, par exemple — marcherait aussi, et
 * ferait retélécharger **tout** le code à chaque livraison, y compris les
 * quatre-vingts kilo-octets de `cartes.js` qui n'ont pas bougé depuis un mois.
 * L'empreinte du contenu ne fait retélécharger que ce qui a changé.
 *
 * Et surtout : elle ne se met pas à jour à la main. Un numéro qu'il faut penser
 * à incrémenter finit toujours par ne pas l'être, et la panne revient le jour
 * où on l'a oublié — sans que rien ne le signale.
 *
 * ## Pourquoi c'est calculé ici et non à la construction
 *
 * Ce projet n'a pas d'étape de construction, délibérément : « une panne de
 * moins entre le code et la page », dit `build.mjs`. On garde ce choix. Les
 * empreintes se calculent au démarrage, en quelques millisecondes pour une
 * vingtaine de fichiers, et se recalculent quand un fichier change sur le
 * disque — ce qui garde le développement vivant sans redémarrage.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/* Dix caractères d'un SHA-1 : quarante bits, soit une collision tous les
   millions de fichiers. On en a vingt. Une empreinte plus longue n'achèterait
   rien et allongerait chaque adresse de la page. */
const TAILLE = 10;

/** Ce qu'on estampille. Le reste — images, vidéos — a sa propre règle. */
const ESTAMPILLABLE = /\.(js|css)$/i;

/**
 * Le service worker ne s'estampille pas.
 *
 * Son adresse est écrite dans `pwa.js` et dans l'enregistrement du navigateur :
 * la changer ferait croire à un **second** service worker, et les deux
 * cohabiteraient. C'est le navigateur qui gère sa fraîcheur, et le serveur lui
 * répond déjà `no-cache`.
 */
const JAMAIS = new Set(['/sw.js']);

/**
 * Le registre.
 *
 * Clé : le chemin servi, avec sa barre de tête — `/cartes.js`.
 * Valeur : `{ v, mtime, taille }` — l'empreinte, et de quoi savoir si le
 * fichier a bougé depuis.
 */
const registre = new Map();

function calculer(fichier) {
  const h = createHash('sha1').update(readFileSync(fichier)).digest('hex');
  return h.slice(0, TAILLE);
}

/**
 * L'empreinte d'un fichier servi, ou `null` s'il n'est pas estampillable.
 *
 * Elle est recalculée quand le fichier a changé sur le disque, et **la date ne
 * suffit pas à le dire**. Windows n'écrit pas les horodatages à la
 * milliseconde : deux écritures rapprochées peuvent porter la même, et le
 * fichier ressortait alors avec l'empreinte de son contenu d'avant — un cache
 * d'un an sur du périmé, c'est-à-dire précisément la panne qu'on répare.
 *
 * La taille tranche les cas que la date laisse passer. Deux contenus de même
 * taille écrits dans la même milliseconde resteraient confondus ; c'est un
 * risque qu'on accepte, parce qu'un déploiement récrit les fichiers l'un après
 * l'autre et que rien n'écrit dans `public/` pendant que le serveur tourne.
 */
export function empreinte(racine, chemin) {
  if (JAMAIS.has(chemin) || !ESTAMPILLABLE.test(chemin)) return null;
  const fichier = path.join(racine, chemin);
  let st;
  try { st = statSync(fichier); } catch { return null; }

  const vu = registre.get(chemin);
  if (vu && vu.mtime === st.mtimeMs && vu.taille === st.size) return vu.v;

  const v = calculer(fichier);
  registre.set(chemin, { v, mtime: st.mtimeMs, taille: st.size });
  return v;
}

/**
 * Relève tous les fichiers estampillables d'un dossier, au démarrage.
 *
 * Sert à deux choses : payer le calcul une fois plutôt qu'à la première visite,
 * et pouvoir dire au démarrage combien de fichiers sont sous cette règle — un
 * zéro dans ce journal veut dire qu'on sert le site sans protection de cache,
 * et c'est exactement ce qu'on ne veut pas découvrir par un joueur.
 */
export function releverEmpreintes(racine) {
  const vus = [];
  const marcher = (dossier, prefixe) => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, e.name);
      const servi = `${prefixe}/${e.name}`;
      if (e.isDirectory()) {
        // `img` et `video` ont leur propre règle : un an, immuables, jamais
        // estampillés. Les parcourir coûterait une seconde pour rien.
        if (e.name === 'img' || e.name === 'video') continue;
        marcher(complet, servi);
        continue;
      }
      if (empreinte(racine, servi)) vus.push(servi);
    }
  };
  try { marcher(racine, ''); } catch (e) {
    console.warn(`empreintes : ${e.message}`);
  }
  return vus;
}

/**
 * Estampille les adresses d'une page.
 *
 * On ne touche qu'aux adresses **absolues et locales** — celles qui commencent
 * par une seule barre. Une adresse externe appartient à quelqu'un d'autre, et
 * une adresse relative n'existe pas ici. Une adresse qui porte déjà un `?` est
 * laissée telle quelle : elle sait ce qu'elle fait.
 *
 * L'expression cherche `src="…"` et `href="…"` sans s'occuper de la balise. Un
 * `href` de `<a>` vers un `.js` n'existe pas dans ce jeu, et s'il existait un
 * jour, l'estamper ne casserait rien.
 */
export function estampiller(html, racine) {
  return String(html).replace(
    /\b(src|href)="(\/[^"?#>]+\.(?:js|css))"/gi,
    (tout, attr, chemin) => {
      const v = empreinte(racine, chemin);
      return v ? `${attr}="${chemin}?v=${v}"` : tout;
    });
}
