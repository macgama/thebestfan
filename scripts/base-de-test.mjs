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

const DEFAUT = 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';

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

  if (LOCAUX.has(hote) || process.env.TBF_BASE_JETABLE === '1') return url;

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
