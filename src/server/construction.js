/**
 * La construction en ligne : un repère qui change à chaque mise en ligne, sans
 * que personne ait à y penser.
 *
 * ## Pourquoi il en fallait un
 *
 * Le numéro du menu (`src/shared/version.js`) est un nom donné au joueur, et
 * il ne monte qu'à la main. Le fichier `VERSION`, lu par `/healthz`, n'est
 * écrit que par `scripts/deployer.sh` — que la mise en ligne par le Manager
 * Infomaniak ne lance jamais : il est resté vide. Il n'y avait donc **aucun**
 * moyen fiable de savoir, depuis une page ouverte, que le jeu avait changé
 * derrière elle. Or une application posée sur l'écran d'un téléphone reste
 * ouverte des jours : c'est un client d'hier qui parle au serveur d'aujourd'hui.
 *
 * ## Deux repères, pour deux questions
 *
 *   — **L'empreinte du jeu** : celle de tout ce que le navigateur reçoit — les
 *     pages, les scripts, les feuilles de style, les dictionnaires. Calculée au
 *     démarrage, donc forcément juste : le serveur qui répond est celui qui
 *     sert ces fichiers. C'est elle que les pages comparent (`pwa.js`) pour se
 *     recharger. Une livraison qui ne touche que le serveur ne la change pas, et
 *     c'est voulu : recharger une page pour lui rendre le même code dérangerait
 *     le joueur pour rien.
 *
 *   — **Le commit** : lu dans `.git`, que la construction du Manager met à jour
 *     par `git pull`. C'est ce qu'il faut pour savoir **quel code tourne** ; il
 *     remplit `/healthz` quand `VERSION` manque. Lu sans lancer `git` : un
 *     processus de plus au démarrage, sur un hébergement où l'on ne sait pas
 *     s'il est installé, serait une panne de plus pour une simple lecture.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/* Ce qui ne compte pas : les dessins, les vidéos et les sons ont des adresses
   qui portent déjà leur contenu, et les parcourir à chaque démarrage coûterait
   une seconde pour ne rien apprendre. */
const SANS = new Set(['img', 'video', 'son']);

/* Douze caractères : de quoi ne jamais confondre deux livraisons, et assez
   court pour se lire dans le menu. */
const TAILLE = 12;

/**
 * L'empreinte de tout ce que le navigateur reçoit, sous `racine`.
 *
 * Les chemins entrent dans le calcul avec les contenus : un fichier renommé est
 * un jeu différent, même octet pour octet. L'ordre est trié, sinon deux disques
 * qui listent différemment donneraient deux empreintes au même jeu.
 */
export function empreinteDuJeu(racine) {
  const fichiers = [];
  const marcher = (dossier, prefixe) => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!(prefixe === '' && SANS.has(e.name))) marcher(path.join(dossier, e.name), `${prefixe}/${e.name}`);
      } else if (e.isFile()) {
        fichiers.push(`${prefixe}/${e.name}`);
      }
    }
  };
  try { marcher(racine, ''); } catch { return null; }
  if (!fichiers.length) return null;
  const h = createHash('sha1');
  for (const f of fichiers.sort()) {
    h.update(f).update('\0');
    try { h.update(readFileSync(path.join(racine, f))); } catch { /* parti entre-temps */ }
    h.update('\0');
  }
  return h.digest('hex').slice(0, TAILLE);
}

/**
 * Le commit de la copie de travail, ou `null`.
 *
 * `HEAD` désigne une branche (« ref: refs/heads/main ») ou, détaché, un commit.
 * La branche est un fichier, sauf après un `git gc` qui la range dans
 * `packed-refs` : les deux sont lus.
 */
export function commitDuDepot(racine) {
  const git = path.join(racine, '.git');
  try {
    const head = readFileSync(path.join(git, 'HEAD'), 'utf8').trim();
    const ref = /^ref:\s*(.+)$/.exec(head)?.[1];
    if (!ref) return /^[0-9a-f]{40}$/.test(head) ? head : null;
    try {
      const sha = readFileSync(path.join(git, ref), 'utf8').trim();
      if (/^[0-9a-f]{40}$/.test(sha)) return sha;
    } catch { /* rangée dans packed-refs */ }
    const range = readFileSync(path.join(git, 'packed-refs'), 'utf8');
    for (const ligne of range.split('\n')) {
      const [sha, nom] = ligne.trim().split(/\s+/);
      if (nom === ref && /^[0-9a-f]{40}$/.test(sha)) return sha;
    }
  } catch { /* pas de dépôt : un paquet copié à la main */ }
  return null;
}
