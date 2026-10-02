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

/* ======================================================= l'horloge figée

   **Le jour de jeu est celui de la base**, pas celui de Node : `CURDATE()`,
   `NOW(3)`, `CURRENT_TIMESTAMP(3)`. Les missions, le bonus, les quotas et le
   disjoncteur changent tous à son minuit. Éprouver minuit, le dimanche de 25
   heures ou celui de 23 heures demande donc d'arrêter **son** horloge, et
   non celle de Node — que personne ne sait arrêter proprement, et qui ne
   déciderait de rien.

   MySQL et MariaDB le permettent par connexion : `SET @@session.timestamp`
   fige `NOW()`, `CURDATE()`, `UTC_TIMESTAMP()`, `UNIX_TIMESTAMP()` et les
   défauts `CURRENT_TIMESTAMP` de cette session. Le piège est le pool : une
   suite (et le serveur qu'elle monte) prend ses connexions au hasard parmi
   plusieurs, et une seule restée à l'heure réelle suffit à faire mentir un
   contrôle sur deux.

   D'où l'interception, à un seul endroit : **chaque connexion que le pool
   rend** passe par ici avant d'arriver à qui l'a demandée, et reçoit l'heure
   voulue si elle ne l'a pas déjà. `pool.query`, `pool.execute` et
   `pool.getConnection` passent tous par `getConnection` du pool sous-jacent,
   y compris la connexion qu'un appel en attente reçoit des mains d'un autre —
   le seul chemin où l'événement `acquire` de mysql2 ne sonne pas.

   Une connexion déjà tenue (une transaction ouverte) garde son heure jusqu'à
   ce qu'elle soit rendue : on ne change pas l'heure sous les pieds d'une
   transaction. Node, lui, reste à l'heure réelle — `Date.now()`, la recharge
   des boosters, `packs_at`. */

const HORLOGES = new WeakMap();   // pool sous-jacent → { voulu, vu: WeakMap(connexion → voulu) }

function intercepter(pool) {
  const coeur = pool.pool ?? pool;   // le pool à promesses enveloppe le pool à rappels
  let etat = HORLOGES.get(coeur);
  if (etat) return etat;
  etat = { voulu: null, vu: new WeakMap() };
  HORLOGES.set(coeur, etat);

  const prendre = coeur.getConnection.bind(coeur);
  coeur.getConnection = (rendre) => prendre((err, conn) => {
    if (err) return rendre(err);
    const voulu = etat.voulu;
    /* Une connexion jamais touchée est à l'heure réelle : rien à faire si
       c'est ce qu'on veut. */
    if ((etat.vu.get(conn) ?? null) === voulu) return rendre(null, conn);
    const sql = voulu === null
      ? 'SET @@session.timestamp = DEFAULT'
      : 'SET @@session.timestamp = ?';
    conn.query(sql, voulu === null ? [] : [voulu], (e) => {
      if (e) {
        /* Une connexion qu'on n'a pas pu régler ne part pas dans la suite :
           elle y mentirait sur l'heure. Le message nomme ce qui a échoué. */
        conn.release();
        return rendre(new Error(`figerHorloge : impossible de régler l’heure de la `
          + `connexion (${e.message})`));
      }
      etat.vu.set(conn, voulu);
      return rendre(null, conn);
    });
  });
  return etat;
}

/**
 * Fige l'horloge de la base pour toutes les connexions du pool, ou la relâche.
 *
 * `instant` :
 *   - une chaîne `'AAAA-MM-JJ HH:MM[:SS[.mmm]]'`, lue **à l'heure murale de
 *     la base** (son fuseau de session) — c'est ce qu'on veut presque
 *     toujours : « minuit trente le 25 octobre », là où le serveur compte ;
 *   - un nombre de secondes depuis l'époque Unix, ou un objet `Date` : un
 *     instant absolu ;
 *   - `null` : l'horloge repart.
 *
 * Rend l'instant figé, en secondes Unix (ou `null`). Le contrôle du contrôle
 * est à la charge de la suite : `SELECT NOW()` doit rendre l'instant figé, sur
 * deux connexions différentes du pool.
 *
 *     await figerHorloge(pool, '2026-10-25 00:30:00');
 *     …
 *     await figerHorloge(pool, null);
 */
export async function figerHorloge(pool, instant) {
  const etat = intercepter(pool);
  if (instant === null || instant === undefined) {
    etat.voulu = null;
    return null;
  }
  let secondes;
  if (instant instanceof Date) {
    secondes = instant.getTime() / 1000;
  } else if (typeof instant === 'number') {
    secondes = instant;
  } else if (typeof instant === 'string'
    && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?$/.test(instant)) {
    /* L'heure murale se convertit **par la base**, dans son fuseau : c'est le
       seul convertisseur qui sache où tombent ses changements d'heure. Avec
       un argument, `UNIX_TIMESTAMP` ne lit pas l'horloge : peu importe
       qu'elle soit déjà figée. */
    const [[r]] = await pool.query('SELECT UNIX_TIMESTAMP(?) AS t', [instant]);
    secondes = r?.t === null || r?.t === undefined ? NaN : Number(r.t);
  } else {
    throw new Error(`figerHorloge : instant « ${instant} » illisible — attendu `
      + '« AAAA-MM-JJ HH:MM:SS », un nombre de secondes, un Date ou null');
  }
  if (!Number.isFinite(secondes) || secondes <= 0) {
    throw new Error(`figerHorloge : la base ne sait pas lire « ${instant} » comme un instant`);
  }
  etat.voulu = secondes;
  return secondes;
}

/**
 * Lance `n` appels de `fn(i)` **ensemble** — deux onglets, dix clics — et
 * attend qu'ils soient **tous** finis avant de rendre.
 *
 * Tous partent dans le même tour de boucle, avant qu'aucun n'ait eu une
 * réponse : c'est ce qui en fait une vraie course. Et l'on attend la fin de
 * chacun même si l'un échoue : rendre au premier échec laisserait les autres
 * écrire dans la base pendant que la suite contrôle déjà, et le contrôle
 * suivant accuserait le code d'une écriture qui n'était pas finie.
 *
 * Rend les résultats dans l'ordre des appels, ou lève la première erreur une
 * fois tout terminé.
 */
export async function enParallele(n, fn) {
  /* L'enveloppe `async` range une exception levée tout de suite par `fn`
     parmi les échecs, au lieu d'empêcher les appels suivants de partir. */
  const issues = await Promise.allSettled(
    Array.from({ length: n }, (_, i) => (async () => fn(i))()));
  const echec = issues.find((x) => x.status === 'rejected');
  if (echec) throw echec.reason;
  return issues.map((x) => x.value);
}
