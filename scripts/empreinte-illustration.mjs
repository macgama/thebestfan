/**
 * L'empreinte d'une illustration de carte — ce que porte son adresse.
 *
 * Les images de `/img` sont servies « immuables, un an », et le service worker
 * les garde sans jamais les redemander. C'est juste pour une image qui ne
 * change pas, et faux pour une carte **redessinée** : l'adresse
 * `/img/fanzzy/RP1-buste.webp` restant la même, un joueur qui avait vu
 * l'ancien RP1 le gardait un an. L'adresse porte donc une empreinte de son
 * contenu — `RP1-buste.webp?v=3f9a…` : un nouveau dessin, une nouvelle
 * adresse, et l'ancienne peut rester en cache sans gêner personne.
 *
 * **Sur les deux WebP, et pas sur les six fichiers.** Les six sortent du même
 * passage de `fanzzy-images.mjs` et changent ensemble ; les PNG pèsent dix fois
 * plus lourd, et relire trois cents mégaoctets à chaque lot pour la même
 * réponse serait du temps perdu.
 *
 * Isolée ici pour que `maj-illustres.mjs`, qui l'écrit, et la suite, qui la
 * vérifie, calculent **la même chose** : deux copies de la règle finiraient par
 * diverger, et le contrôle approuverait une empreinte que le jeu ne produit
 * pas.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** La longueur de `src/server/empreintes.js`, pour la même raison. */
const TAILLE = 10;

export function empreinteIllustration(dossier, id) {
  const h = createHash('sha1');
  for (const variante of ['', '-buste']) {
    h.update(readFileSync(path.join(dossier, `${id}${variante}.webp`)));
  }
  return h.digest('hex').slice(0, TAILLE);
}
