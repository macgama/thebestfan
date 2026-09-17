/**
 * La négociation de format : servir l'AVIF à qui sait le lire.
 *
 * ## Pourquoi c'est le serveur qui décide, et pas la page
 *
 * Le client a essayé pendant des mois, et il s'y est cassé les dents. Trois
 * fichiers de `public/` demandaient à un canvas `toDataURL('image/avif')` pour
 * savoir quel format servir — c'est-à-dire ce que le navigateur sait
 * **écrire**, qui ne dit rien de ce qu'il sait **afficher**. Personne n'encode
 * l'AVIF, pas même Chrome : la branche ne s'est jamais ouverte, les vingt-
 * quatre mégaoctets d'AVIF du dépôt n'ont jamais été servis à personne, et tout
 * ce qui n'était pas Chrome retombait sur une extension qui, pour un Fanzzy,
 * ne désignait aucun fichier — d'où un écran d'accueil sans personnage sur
 * Firefox et sur iPhone.
 *
 * Or **le navigateur dit déjà ce qu'il sait lire**, à chaque requête d'image,
 * et il le dit exactement : c'est l'en-tête `Accept`. Il n'y a rien à deviner,
 * il y a à lire. La page demande donc le WebP — le format que tout le monde
 * lit depuis 2020 — et le serveur remplace par le jumeau `.avif` quand, et
 * seulement quand, le navigateur l'a annoncé.
 *
 * L'adresse ne change pas. C'est ce qui rend la chose sûre : le HTML, le
 * classeur, le service worker, le manifeste des états continuent de parler de
 * `neutre.webp?v=10`, et personne n'a à savoir ce qui part sur le fil.
 *
 * ## Les deux pièges de la négociation
 *
 * **Un joker ne veut pas dire AVIF.** Safari 15 annonce `image/webp`,
 * `image/png`, `image/svg+xml`, puis `image/` suivi d'une étoile en `q=0.8`,
 * et il ne sait pas lire un AVIF — il n'a appris qu'en 16.4. Accepter le
 * joker reviendrait à
 * refaire la faute qu'on corrige, en plus discret : une image cassée au lieu
 * d'un 404. On ne reconnaît donc que le jeton **`image/avif` écrit en toutes
 * lettres**, et un `q=0` explicite vaut un refus.
 *
 * **`Vary: Accept` n'est pas une politesse.** Deux navigateurs demandent la
 * même adresse et reçoivent deux fichiers différents : sans cet en-tête, un
 * cache partagé — proxy d'entreprise, cache du navigateur lui-même après une
 * mise à jour — sert l'AVIF de l'un à l'autre, qui n'affiche rien. Il est donc
 * posé sur **toutes** les images négociables, y compris celles qu'on ne
 * remplace pas : c'est la réponse qui dépend d'`Accept`, pas le remplacement.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';

/** Les formats qui ont un sens à être remplacés par leur jumeau AVIF. */
const NEGOCIABLE = /\.(webp|png|jpe?g)$/i;

/**
 * Le navigateur a-t-il annoncé qu'il sait lire l'AVIF ?
 *
 * On ne lit que le jeton exact. Voir plus haut pourquoi les jokers ne comptent
 * pas : ce sont des préférences, pas des déclarations de capacité, et Safari 15
 * en envoie deux sans savoir décoder un seul AVIF.
 */
export function accepteAvif(entete) {
  return String(entete ?? '').split(',').some((piece) => {
    const [type, ...params] = piece.trim().split(';').map((s) => s.trim());
    if (type.toLowerCase() !== 'image/avif') return false;
    // `q=0` est un refus explicite — rare, mais c'est la manière normalisée de
    // dire « surtout pas celui-là », et l'ignorer serait ne pas lire l'en-tête.
    const q = params.map((p) => /^q=(.*)$/i.exec(p)?.[1]).find((v) => v !== undefined);
    return q === undefined || Number(q) > 0;
  });
}

/**
 * Relève, une fois, les images qui ont un jumeau `.avif`.
 *
 * Une lecture de disque par requête d'image serait un appel système sur le
 * chemin le plus fréquenté du site, pour une réponse qui ne change pas : les
 * images sont déployées avec le code et le service redémarre à chaque mise en
 * ligne. On la fait donc au démarrage.
 *
 * Les clés sont les **adresses demandées** — `/fanzzy/TR57.avif` —, pas des
 * chemins de disque. C'est ce qui ferme la porte aux `..` : une adresse
 * bricolée ne peut pas ressembler à une entrée de ce relevé, puisque le relevé
 * ne contient que ce qui a été trouvé sur le disque.
 *
 * Ne lève jamais : un dossier illisible désactive la négociation, il
 * n'empêche pas le site de démarrer. Les images partiront en WebP, c'est-à-dire
 * exactement ce qui se passait avant.
 */
export function releverAvif(dossier) {
  const vus = new Set();
  const marcher = (courant) => {
    for (const e of readdirSync(courant, { withFileTypes: true })) {
      const complet = path.join(courant, e.name);
      if (e.isDirectory()) { marcher(complet); continue; }
      if (path.extname(e.name).toLowerCase() !== '.avif') continue;
      vus.add('/' + path.relative(dossier, complet).split(path.sep).join('/'));
    }
  };
  try { marcher(dossier); } catch (e) {
    console.warn(`négociation AVIF désactivée : ${e.message}`);
  }
  return vus;
}

/**
 * Le middleware, à poser **avant** le `express.static` de `/img`.
 *
 * Il ne sert rien lui-même : il réécrit l'adresse demandée et passe la main.
 * Tout ce qui suit — le type MIME, l'ETag, les requêtes conditionnelles, les
 * plages d'octets, l'année de cache — reste le travail de `express.static`, qui
 * le fait sur le fichier AVIF comme il le ferait sur n'importe quel autre.
 *
 * @param {string} dossier  la racine servie sous `/img`
 */
export function negocierAvif(dossier) {
  const avif = releverAvif(dossier);

  return (req, res, next) => {
    // Une écriture ne se négocie pas. GET et HEAD seulement — et HEAD compte :
    // sa réponse doit annoncer le même type que le GET qui suivrait.
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const coupe = req.url.indexOf('?');
    const chemin = coupe === -1 ? req.url : req.url.slice(0, coupe);
    const requete = coupe === -1 ? '' : req.url.slice(coupe);
    if (!NEGOCIABLE.test(chemin)) return next();

    /* Posé avant tout renvoi, et même quand on ne remplace rien : c'est la
       réponse à cette adresse qui dépend d'`Accept`, pas notre décision du
       jour. Un client sans AVIF qui reçoit le WebP sans `Vary` laisserait un
       cache partagé le resservir à un client qui, lui, aurait eu l'AVIF — et
       l'inverse, qui est la panne visible. */
    res.vary('Accept');

    if (!avif.has(remplacerExtension(chemin))) return next();
    if (!accepteAvif(req.headers.accept)) return next();

    // La révision `?v=` suit l'image : c'est elle qui casse le cache d'un an
    // quand un dessin est repris, et elle vaut pour les deux formats.
    req.url = remplacerExtension(chemin) + requete;
    next();
  };
}

/**
 * `…/neutre.webp` → `…/neutre.avif`, sur l'adresse telle qu'elle est demandée.
 *
 * L'extension est en ASCII simple : elle ne peut pas être encodée en
 * pourcents, et on n'a donc pas à décoder l'adresse pour la réécrire — ce qui
 * évite d'avoir à la ré-encoder ensuite, opération où l'on perd toujours un
 * caractère quelque part.
 */
const remplacerExtension = (chemin) => chemin.replace(NEGOCIABLE, '.avif');
