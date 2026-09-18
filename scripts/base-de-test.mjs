/**
 * La base sur laquelle les suites ont le droit de travailler.
 *
 * **Toutes les suites commencent par `DROP TABLE … users`.** C'est voulu :
 * chacune reconstruit exactement ce dont elle a besoin, et c'est ce qui les
 * rend lisibles et reproductibles. C'est aussi ce qui les rend dangereuses —
 * lancée sur la base de production, n'importe laquelle efface les comptes, les
 * collections et les decks de tout le monde.
 *
 * Rien n'empêchait ça. La seule protection était une phrase dans `ETAT.md` et
 * le fait que `DATABASE_URL` n'est en principe pas exporté sur le serveur. Le
 * 9 septembre 2026, `npm run stades:smoke` a été lancé en SSH sur la machine de
 * production ; il a échoué parce que le dossier courant n'était pas le bon, et
 * pour aucune autre raison. Une protection qui tient à un hasard n'est pas une
 * protection.
 *
 * D'où ce module. Il refuse toute base qui n'est pas locale, et il le dit en
 * nommant l'hôte visé — parce qu'un refus qu'on ne comprend pas se contourne.
 *
 * Pour viser délibérément une base distante (une machine de recette, par
 * exemple), il faut l'écrire :
 *
 *     TBF_BASE_JETABLE=1 DATABASE_URL=mysql://… node scripts/deck-smoke.mjs
 *
 * Ce nom est long et laid exprès. Personne ne le tape par distraction, et
 * personne ne peut prétendre l'avoir écrit sans savoir ce qu'il faisait.
 */

import { openSync, closeSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAUT = 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';

/* ============================================ une suite à la fois, et pas deux

   **Les suites partagent une seule base, et chacune commence par la vider.**
   Deux suites lancées en même temps se détruisent donc mutuellement : la
   seconde efface les tables de la première au milieu de ses contrôles, et ce
   qui rougit ensuite ne parle de rien.

   Ça n'est pas théorique — c'est arrivé deux fois en une session, parce qu'on
   lance volontiers une suite « juste pour vérifier » pendant qu'une batterie
   tourne en fond. Les contrôles qui tombent alors accusent le code, et on perd
   une demi-heure à chercher une régression qui n'existe pas.

   L'isolation propre serait **une base par suite**. Elle demande le droit de
   créer des bases, que le compte `tbf` n'a pas :

       GRANT ALL PRIVILEGES ON `tbf_%`.* TO 'tbf'@'%';

   Tant que ce droit n'est pas donné, un verrou fait le travail : il ne sépare
   pas les suites, il les empêche de se croiser. C'est moins bien et c'est
   suffisant.

   **Un fichier, et non un verrou MySQL.** `GET_LOCK` demanderait une connexion,
   donc une fonction asynchrone, donc quarante-sept appels à modifier. Un
   fichier se prend et se rend sans rien attendre, depuis la fonction que toutes
   les suites appellent déjà. */

const VERROU = path.join(fileURLToPath(new URL('..', import.meta.url)), '.tbf-suite.lock');

/* Dix minutes : plus long que la plus lente des suites, plus court qu'une
   pause. Au-delà, le verrou est tenu par un processus mort — un Ctrl-C, un
   plantage — et le garder fermé bloquerait tout le monde pour rien. */
const PERIME_MS = 10 * 60_000;

/** Le nom de la suite en cours, tel qu'on le montre. */
const quiSuisJe = () => path.basename(process.argv[1] ?? 'inconnu');

function prendreLeVerrou() {
  if (process.env.TBF_SANS_VERROU === '1') return;

  for (let essai = 0; essai < 2; essai++) {
    try {
      const fd = openSync(VERROU, 'wx');
      closeSync(fd);
      /* On écrit **après** avoir créé le fichier : la création est ce qui est
         atomique, le contenu n'est là que pour nommer le coupable. */
      try {
        writeFileSync(VERROU, JSON.stringify({ suite: quiSuisJe(), pid: process.pid, a: Date.now() }));
      } catch { /* le verrou tient même sans son étiquette */ }
      const rendre = () => { try { unlinkSync(VERROU); } catch { /* déjà rendu */ } };
      process.on('exit', rendre);
      process.on('SIGINT', () => { rendre(); process.exit(130); });
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;

      let tenu = null;
      try { tenu = JSON.parse(readFileSync(VERROU, 'utf8')); } catch { /* illisible */ }
      const age = tenu?.a ? Date.now() - tenu.a : Infinity;

      if (age > PERIME_MS) {
        /* Périmé : on le reprend, et on le dit. Un verrou qu'on force en
           silence est un verrou qui ne protège plus personne. */
        console.warn(`  (verrou de test périmé, laissé par ${tenu?.suite ?? '?'} — repris)`);
        try { unlinkSync(VERROU); } catch { /* quelqu'un l'a repris avant nous */ }
        continue;
      }

      console.error([
        '',
        '  ARRÊT — une autre suite travaille déjà sur cette base.',
        '',
        `  Elle : ${tenu?.suite ?? 'inconnue'} (pid ${tenu?.pid ?? '?'}, depuis ${
          Math.round(age / 1000)} s)`,
        `  Toi  : ${quiSuisJe()}`,
        '',
        '  Les suites vident la base au démarrage : les lancer ensemble les fait',
        '  échouer toutes les deux, et ce qui rougit ensuite ne parle de rien.',
        '',
        '  Attends la fin de la première, ou lance-les en série :',
        '',
        '      npm test',
        '',
      ].join('\n'));
      process.exit(1);
    }
  }
}

/** Les hôtes qui désignent la machine où tourne le test. */
const LOCAUX = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '']);

/**
 * L'URL de la base de test, ou une sortie immédiate si elle n'est pas locale.
 *
 * On sort par `process.exit(1)` plutôt qu'en levant : une exception au milieu
 * d'un `for` shell continue sur la suite suivante, et il n'y a aucune raison de
 * laisser dix-huit autres suites tenter leur chance sur la même base.
 */
export function baseDeTest() {
  const url = process.env.DATABASE_URL ?? DEFAUT;

  let hote;
  try { hote = new URL(url).hostname.toLowerCase(); }
  catch {
    console.error(`DATABASE_URL n'est pas une URL lisible : ${url}`);
    process.exit(1);
  }

  /* Le verrou se prend **une fois l'hôte validé** : un refus de base distante
     ne doit pas laisser derrière lui un fichier qui bloquerait les suivantes. */
  if (LOCAUX.has(hote) || process.env.TBF_BASE_JETABLE === '1') { prendreLeVerrou(); return url; }

  console.error([
    '',
    '  ARRÊT — cette suite refuse de travailler sur une base distante.',
    '',
    `  Hôte visé : ${hote}`,
    '',
    '  Les suites de test commencent toutes par « DROP TABLE … users ». Sur une',
    '  base réelle, celle-ci effacerait les comptes, les collections et les decks.',
    '',
    '  Les tests se lancent en local, avant de livrer. Sur le serveur, on',
    '  n’applique que les fichiers de sql/ :',
    '',
    '      cd ~/sites/thebestfan.online',
    '      mysql -h <hôte> -u <user> -p <base> < sql/<fichier>.sql',
    '',
    '  Si tu vises vraiment une base jetable, dis-le explicitement :',
    '',
    '      TBF_BASE_JETABLE=1 DATABASE_URL=… node scripts/<suite>.mjs',
    '',
  ].join('\n'));
  process.exit(1);
}

/**
 * Les options du pool, telles que le serveur les emploie.
 *
 * **`timezone: 'Z'` n'est pas un détail de confort.** C'est le réglage de
 * `src/server/auth/db.js`, donc celui de la production, et il décide de la
 * façon dont mysql2 transforme une colonne DATETIME en objet `Date`. Les
 * suites construisaient leur pool sans lui : elles lisaient les dates
 * autrement que le serveur, et vérifiaient donc une application qui n'existe
 * nulle part.
 *
 * Ce que cela a coûté : la minute du vrai match restait figée parce que
 * `polled_at`, écrit par `NOW(3)` dans le fuseau de la session MySQL et relu
 * comme de l'UTC, partait deux heures dans le futur. Une suite qui lit avec le
 * fuseau local ne voit jamais cet écart — elle est verte sur un réglage que
 * personne ne déploie. Le contrôle qui devait attraper la panne la laissait
 * passer, deux fois.
 *
 * À utiliser partout où une suite ouvre un pool :
 *
 *     const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
 */
export const OPTIONS_BASE = { charset: 'utf8mb4', timezone: 'Z' };
