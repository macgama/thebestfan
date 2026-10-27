/**
 * La version que le joueur voit.
 *
 * ## Pourquoi elle ne vient pas de `package.json`
 *
 * `package.json` porte une version de paquet — `0.3.0` — qui sert à npm et à
 * personne d'autre. Elle ne dit rien à quelqu'un qui joue : ni où en est le
 * jeu, ni ce qu'il peut en attendre. Le numéro d'ici est une **promesse faite
 * au joueur**, et c'est une décision de produit, pas de dépendances.
 *
 * ## Pourquoi il faut qu'elle soit affichée
 *
 * Un joueur qui signale un défaut décrit ce qu'il voit ; il ne peut pas dire
 * sur quelle version il le voit. Sans ce numéro, chaque retour commence par
 * « as-tu rechargé ? » — une question qu'on ne devrait jamais avoir à poser, et
 * qui fait porter au joueur la charge de notre déploiement.
 *
 * Et le mot **bêta** n'est pas de la modestie : il dit qu'on peut casser des
 * choses, que les soldes peuvent bouger, qu'une saison peut être rejouée. Un
 * joueur prévenu pardonne ; un joueur surpris s'en va.
 *
 * ## Le commit, lui, reste ailleurs
 *
 * `/healthz` rend déjà la référence exacte du code en ligne, lue dans le
 * fichier `VERSION` que le déploiement écrit. C'est ce qu'il faut pour savoir
 * **quel code tourne** ; ce n'est pas ce qu'il faut pour le dire à quelqu'un.
 * Les deux coexistent, et ne se confondent pas : l'un est une empreinte, celui
 * d'ici est un nom.
 */

/** Le canal. `beta` tant que les données peuvent être remises à zéro. */
export const CANAL = 'beta';

/**
 * Le numéro, et sa règle.
 *
 * Il monte d'un cran à **chaque mise en ligne**, tout seul : 0.0200, 0.0201,
 * 0.0202… Le serveur compte ses livraisons au démarrage
 * (`src/server/livraisons.js`) et pose le compte ici. Gaël l'a demandé le
 * 27 octobre 2026 : le numéro restait à 0.0200, écrit à la main, et un joueur
 * ne voyait pas que le jeu bougeait — alors qu'il bouge presque chaque jour.
 *
 * Les quatre décimales sont volontaires : elles disent « on livre souvent »
 * mieux qu'une phrase. `BASE` est le point de départ ; on la monte à la main
 * le jour où la bêta se ferme (1.0000), le compte repart de là.
 */
export const BASE = 200;

/* Le nombre de mises en ligne depuis `BASE`. Zéro tant que le serveur ne l'a
   pas lu — sans base, en développement, il le reste. */
let livraisons = 0;

/** Le numéro pour `n` livraisons : 0 → « 0.0200 », 7 → « 0.0207 ». */
export function numeroPour(n) {
  const cran = BASE + Math.max(0, Math.trunc(Number(n) || 0));
  return `${Math.floor(cran / 10000)}.${String(cran % 10000).padStart(4, '0')}`;
}

/** Pose le compte des livraisons. Appelé une fois, au démarrage du serveur. */
export function poserLivraisons(n) {
  livraisons = Math.max(0, Math.trunc(Number(n) || 0));
}

/** Le numéro d'aujourd'hui, « 0.0207 ». */
export function numero() {
  return numeroPour(livraisons);
}

/** Ce qui s'affiche, tel quel : « version bêta — 0.0207 ». */
export function etiquette() {
  return `version ${CANAL === 'beta' ? 'bêta' : CANAL} — ${numero()}`;
}

/** Ce que rend `/api/version`. */
export function versionPublique() {
  return { canal: CANAL, numero: numero(), etiquette: etiquette() };
}
