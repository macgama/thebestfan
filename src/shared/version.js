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
 * Il monte d'un centième à chaque livraison qui change quelque chose pour le
 * joueur, et d'un entier le jour où la bêta se ferme. Les quatre décimales sont
 * volontaires : elles disent « on livre souvent » mieux qu'une phrase.
 */
export const NUMERO = '0.0100';

/** Ce qui s'affiche, tel quel : « version bêta — 0.0100 ». */
export const ETIQUETTE = `version ${CANAL === 'beta' ? 'bêta' : CANAL} — ${NUMERO}`;

export const VERSION_PUBLIQUE = { canal: CANAL, numero: NUMERO, etiquette: ETIQUETTE };
