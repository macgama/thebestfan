/**
 * La version que le joueur voit.
 *
 * ## Pourquoi elle ne vient pas de `package.json`
 *
 * `package.json` porte une version de paquet — `1.0.0` — qui sert à npm et à
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
 * Il monte d'un cran à **chaque mise en ligne**, tout seul. Le serveur compte
 * ses livraisons au démarrage (`src/server/livraisons.js`) et pose le compte
 * ici. Gaël l'a demandé le 27 octobre 2026 (0.0200, 0.0201…), puis, le
 * 6 novembre 2026, le passage à la **1.0.0** pour la période de test :
 * 1.0.0, puis 1.0.01, 1.0.02, 1.0.03… — même numéro de départ que l'appli
 * Android (`android/twa-manifest.json`, `appVersionName`).
 *
 * Le compte de la 1.0 repart de zéro (sa propre clé dans `reglages`) : la
 * mise en ligne qui apporte ce code est la 1.0.0, la suivante la 1.0.01.
 * Au-delà de 99, on écrit 1.0.100 : rien ne casse.
 */
export const BASE = '1.0';

/* Le nombre de mises en ligne depuis la 1.0.0, elle comprise. Zéro tant que
   le serveur ne l'a pas lu — sans base, en développement, il le reste. */
let livraisons = 0;

/** Le numéro pour `n` livraisons : 0 ou 1 → « 1.0.0 », 2 → « 1.0.01 », 13 → « 1.0.12 ». */
export function numeroPour(n) {
  const cran = Math.max(0, Math.trunc(Number(n) || 0) - 1);
  return cran ? `${BASE}.${String(cran).padStart(2, '0')}` : `${BASE}.0`;
}

/** Pose le compte des livraisons. Appelé une fois, au démarrage du serveur. */
export function poserLivraisons(n) {
  livraisons = Math.max(0, Math.trunc(Number(n) || 0));
}

/** Le numéro d'aujourd'hui, « 1.0.07 ». */
export function numero() {
  return numeroPour(livraisons);
}

/** Ce qui s'affiche, tel quel : « version bêta — 1.0.07 ». */
export function etiquette() {
  return `version ${CANAL === 'beta' ? 'bêta' : CANAL} — ${numero()}`;
}

/** Ce que rend `/api/version`. */
export function versionPublique() {
  return { canal: CANAL, numero: numero(), etiquette: etiquette() };
}
