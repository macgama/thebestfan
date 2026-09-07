/**
 * Construction du projet — il n'y a plus rien à construire.
 *
 * Le seul TypeScript du dépôt était l'ancien duel tour par tour, remplacé par
 * le tir à la corde. Tout le reste est du JavaScript servi tel quel, sans
 * étape intermédiaire : c'est plus simple, plus rapide à déployer, et une
 * panne de moins entre le code et la page.
 *
 * Ce fichier est conservé volontairement. La commande de build du Manager
 * Infomaniak l'appelle encore (`git pull && npm ci && node build.mjs`), et un
 * déploiement qui échoue sur un fichier introuvable coûterait bien plus cher
 * que ces quelques lignes. Le jour où la commande sera simplifiée, il pourra
 * disparaître.
 */
console.log('rien à construire : le projet est en JavaScript simple.');
