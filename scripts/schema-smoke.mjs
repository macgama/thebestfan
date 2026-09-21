/**
 * Test du contrôle de schéma.
 *
 * Il rejoue la panne du 8 septembre 2026 : le code en ligne attend la table
 * `fanzzy`, la base ne l'a pas, et tout le site se ferme sans dire pourquoi.
 * Ce que le contrôle doit garantir, c'est qu'à la place du silence il y ait un
 * nom de fichier.
 */
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifierSchema, lireSchemaAttendu, lireColonnesAttendues, messageDeManque }
  from '../src/server/auth/schema.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const SQL = fileURLToPath(new URL('../sql/', import.meta.url));
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');

/**
 * Le schéma entier, remonté avant de mesurer quoi que ce soit.
 *
 * Les autres suites déposent la base dans l'état dont elles ont besoin, jamais
 * dans l'état complet : `admin-smoke`, par exemple, laisse `duels` supprimée.
 * Sans ce remontage, ce contrôle mesurerait le résidu de la suite précédente au
 * lieu du schéma du dépôt. Tous les fichiers sont idempotents, les rejouer ne
 * coûte rien.
 *
 * L'ordre est celui de `DEPLOIEMENT.md` : chaque fichier s'appuie
 * sur les tables du précédent, et une liste alphabétique casserait les clés
 * étrangères.
 *
 * Elle est écrite à la main, et c'est donc une **seconde vérité** à côté du
 * dossier `sql/`. Elle a déjà dérivé une fois : `kop.sql` ajouté, cinq tables
 * de plus dans le dépôt, et cette liste ne les montait pas — la suite
 * annonçait alors un schéma incomplet selon l'ordre où on la lançait, sur un
 * défaut qui n'existait pas. Un test qui se plaint de ce que ses voisins ont
 * fait est un test auquel on cesse de croire.
 *
 * D'où le contrôle juste en dessous : la liste doit couvrir tout le dossier.
 */
/* La liste vit dans `ordre-schema.mjs`, et `appliquer-schema.mjs` lit la
   même. Voir son en-tête : elles étaient deux, et elles ont divergé deux
   fois. Le contrôle juste en dessous — « la liste couvre tout le dossier » —
   garde tout son sens : il surveille les oublis, là où le module partagé
   supprime les désaccords. */
import { ORDRE } from './ordre-schema.mjs';

{
  const surLeDisque = (await readdir(SQL)).filter((f) => f.endsWith('.sql'))
    .map((f) => f.replace(/\.sql$/, ''))
    // `rattrapage.sql` corrige d'anciennes bases : il suppose un état qu'une
    // base neuve n'a pas, et il ne déclare aucune table.
    .filter((f) => f !== 'rattrapage');
  const oublies = surLeDisque.filter((f) => !ORDRE.includes(f));
  if (oublies.length) {
    console.log(` FAIL  sql/${oublies.join('.sql, sql/')}.sql `
      + 'n’est pas dans l’ordre d’application de schema-smoke.mjs. '
      + 'Ajoute-le à ORDRE, au bon rang, et à DEPLOIEMENT.md.');
    failures++;
  } else {
    console.log(`  ok   les ${ORDRE.length} fichiers de sql/ sont tous montés`);
  }
}

const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
for (const f of ORDRE) {
  await raw.query(readFileSync(path.join(SQL, `${f}.sql`), 'utf8'));
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 2, ...OPTIONS_BASE });

/* ------------------------------------------------------- lecture des .sql */

const attendu = await lireSchemaAttendu(SQL);
check('les fichiers de sql/ déclarent des tables', attendu.size >= 5);
check('sql/fanzzy.sql déclare bien la table fanzzy',
  attendu.get('fanzzy.sql')?.includes('fanzzy'));
check('sql/auth.sql déclare users et sessions',
  ['users', 'sessions'].every((t) => attendu.get('auth.sql')?.includes(t)));
check('rattrapage.sql est écarté : il corrige, il ne décrit pas',
  !attendu.has('rattrapage.sql'));

/* --------------------------------- le nombre de tables annoncé au déploiement

   `DEPLOIEMENT.md` dit combien de tables `SHOW TABLES;` doit lister. C'est le
   seul contrôle dont dispose celui qui applique le schéma à la main, sur une
   base de production, à minuit — et il a été faux deux fois : écrit de tête,
   recalculé à chaque ajout, jamais recompté.

   On le compare donc à ce que `sql/` déclare, et on donne le bon chiffre dans
   le message. Un nombre qu'il faut penser à mettre à jour finit toujours par
   mentir, et celui-là ment à quelqu'un qui n'a aucun moyen de le vérifier. */
{
  const doc = readFileSync(path.join(SQL, '..', 'DEPLOIEMENT.md'), 'utf8');
  const annonce = Number(doc.match(/`SHOW TABLES;` doit en lister \*\*(\d+)\*\*/)?.[1]);
  const declarees = new Set([...attendu.values()].flat()).size;
  check(`DEPLOIEMENT.md annonce le bon nombre de tables (${declarees})`,
    annonce === declarees
    || (console.log(`        il annonce ${annonce || '—'}, sql/ en déclare ${declarees}`), false));
}

/* ------------------------- les suites savent-elles encore vider la base ?

   Chaque suite vide la base au démarrage avec sa propre liste de `DROP TABLE`,
   écrite à la main. Or **une table fille bloque le DROP de sa mère** : ajouter
   une table qui référence `users` et oublier de l'ajouter à ces listes fait
   tomber toutes les suites qui suppriment `users` — avant leur premier
   contrôle, donc sans une seule ligne rouge pour dire pourquoi.

   C'est arrivé le jour de `parrainages` : huit suites d'un coup, chacune
   annonçant « sortie 1 · 2s » et rien d'autre. Le diagnostic a pris plus de
   temps que la correction, qui tenait en un mot par fichier.

   Ce contrôle-là s'occupe donc du dossier entier : il relit les `sql/` pour
   savoir qui référence quoi, puis vérifie que toute suite qui supprime une
   table mère supprime aussi ses filles. Il n'empêche pas d'ajouter une table —
   il empêche de l'ajouter **à moitié**.

   Les suites qui construisent leur liste depuis `information_schema` sont
   écartées nommément : elles suppriment déjà tout ce qui existe, ce qui est la
   meilleure réponse au problème, et rien ne leur manque jamais. */
{
  const SCRIPTS = path.join(SQL, '..', 'scripts');
  const DYNAMIQUES = new Set(['prefixes-smoke.mjs', 'audit-ui.mjs']);

  /* Qui référence qui. On lit le texte des fichiers plutôt que la base : le
     but est de juger ce que `sql/` **déclare**, et une base dont il manque un
     fichier rendrait un graphe incomplet sans le dire. */
  const enfants = new Map();   // mère → [filles]
  for (const f of (await readdir(SQL)).filter((x) => x.endsWith('.sql'))) {
    const texte = readFileSync(path.join(SQL, f), 'utf8');
    /* Une table court jusqu'au `CREATE TABLE` suivant : c'est assez pour
       rattacher chaque `REFERENCES` à la table qui le porte. */
    for (const bloc of texte.split(/CREATE TABLE IF NOT EXISTS\s+/i).slice(1)) {
      const fille = bloc.match(/^`?(\w+)`?/)?.[1];
      if (!fille) continue;
      for (const m of bloc.matchAll(/REFERENCES\s+`?(\w+)`?/gi)) {
        const mere = m[1];
        if (mere === fille) continue;   // une hiérarchie sur elle-même
        if (!enfants.has(mere)) enfants.set(mere, new Set());
        enfants.get(mere).add(fille);
      }
    }
  }
  check('les fichiers de sql/ décrivent des clés étrangères', enfants.size >= 3
    || (console.log('        mères vues :', [...enfants.keys()].join(' ')), false));

  const manques = [];
  for (const f of (await readdir(SCRIPTS)).filter((x) => x.endsWith('.mjs'))) {
    if (DYNAMIQUES.has(f)) continue;
    const texte = readFileSync(path.join(SCRIPTS, f), 'utf8');
    if (!/DROP TABLE IF EXISTS/.test(texte)) continue;
    /* **Couper les clés étrangères est l'autre bonne réponse**, et plusieurs
       suites la prennent déjà : `SET FOREIGN_KEY_CHECKS = 0` fait tomber
       n'importe quelle table sans égard pour ses filles. C'est même la plus
       robuste des deux — elle ne demande rien à personne le jour où une table
       s'ajoute. Une suite qui le fait n'a donc rien à déclarer ici.

       Ce contrôle ne juge que celles qui ont choisi de nommer leur liste : à
       elles de la tenir. */
    if (/FOREIGN_KEY_CHECKS\s*=\s*0/.test(texte)) continue;
    /* Ce que cette suite dit supprimer : **la clause elle-même**, et rien
       d'autre du fichier. Chercher les noms dans tout le texte paraissait plus
       sûr et se trompait dans l'autre sens : une suite qui ne fait qu'insérer
       dans `users` était accusée de la supprimer sans ses filles. Trente-neuf
       reproches, aucun vrai — un contrôle qui crie sans raison finit décoché.

       La clause court jusqu'au point-virgule ou jusqu'à la fin du gabarit de
       chaîne qui la porte : les deux formes existent dans scripts/. */
    const nomme = new Set();
    for (const m of texte.matchAll(/DROP TABLE IF EXISTS([^;`]*)/gi)) {
      for (const nom of m[1].match(/[a-z_][a-z0-9_]*/gi) ?? []) nomme.add(nom);
    }
    for (const [mere, filles] of enfants) {
      if (!nomme.has(mere)) continue;
      for (const fille of filles) {
        if (!nomme.has(fille)) manques.push(`${f} : supprime ${mere}, pas ${fille}`);
      }
    }
  }
  check('chaque suite qui vide la base emporte les tables filles',
    manques.length === 0
    || (console.log('       ', manques.slice(0, 6).join('\n        ')),
      manques.length > 6 && console.log(`        … et ${manques.length - 6} de plus`),
      false));
}

/* ------------------------------------------- la base de test est complète */

const surBaseSaine = await verifierSchema(pool, SQL);
check('aucune table ne manque sur une base à jour',
  surBaseSaine.length === 0
    || (console.log('       manques vus :',
        JSON.stringify(surBaseSaine)), false));
check('une base à jour ne produit aucun message', messageDeManque([]) === null);

/* --------------------------------------------- la panne réelle, rejouée */

// On ne supprime pas la vraie table : `user_fanzzy` a des clés étrangères et
// les autres suites tournent sur la même base. On interroge donc un schéma
// vide, ce qui produit exactement le même verdict — toutes les tables absentes.
const vide = {
  query: async () => [[]],
};
const toutManque = await verifierSchema(vide, SQL);
check('sur une base vide, chaque fichier est signalé', toutManque.length === attendu.size);

const msg = messageDeManque(toutManque);
check('le message nomme le fichier à appliquer', msg.includes('sql/fanzzy.sql'));
check('le message nomme la table absente', /table\(s\) absente\(s\) : .*fanzzy/.test(msg));
check('le message dit où le coller', msg.includes('phpMyAdmin'));
check('le message dit que rejouer ne casse rien', msg.includes('ne casse rien'));

// Le vieux message accusait le réseau alors que la base répondait très bien.
check('le message n’accuse pas la base d’être injoignable',
  !/injoignable/i.test(msg));

/* ------------------------------- la panne du 9 septembre, rejouee

   `niveau.sql` ne cree aucune table : il ajoute une colonne `xp`. Le controle
   ne regardait que les tables, il le declarait donc applique — toujours.

   Oublie en production, aucune table ne manquait, /healthz repondait ok:true,
   le demarrage ne disait rien. Et le jeu refusait tous les boosters hors de la
   premiere serie, plus tout deck de trois Fanzzy : sans XP lisible, chaque
   joueur retombait au niveau 1 et se voyait confisquer ses droits.

   Trois fichiers sur quatre parmi les derniers sont dans ce cas. */

{
  const cols = await lireColonnesAttendues(SQL);
  check('sql/niveau.sql promet bien une colonne',
    cols.get('niveau.sql')?.some((c) => c.table === 'user_wallet' && c.colonne === 'xp'));
  check('et sql/skins.sql aussi',
    cols.get('skins.sql')?.some((c) => c.table === 'user_skins' && c.colonne === 'stage'));

  // Une base qui a toutes les tables mais pas la colonne : exactement le cas
  // reel. Le controle doit la voir, et nommer le fichier.
  const toutesTables = [...attendu.values()].flat().map((t) => ({ t }));
  const sansXp = {
    query: async (sql) => (/information_schema.tables/i.test(sql)
      ? [toutesTables]
      : [[...cols.values()].flat()
          .filter((c) => !(c.table === 'user_wallet' && c.colonne === 'xp'))
          .map((c) => ({ t: c.table, c: c.colonne }))]),
  };
  const vus = await verifierSchema(sansXp, SQL);
  check('une colonne absente est signalee, meme si toutes les tables sont la',
    vus.some((m) => m.fichier === 'niveau.sql' && m.colonnes?.includes('user_wallet.xp')));
  check('et le message nomme la colonne, pas seulement le fichier',
    (messageDeManque(vus) ?? '').includes('colonne(s) absente(s) : user_wallet.xp'));
}

/* ------------------------------------------------- un seul fichier manquant */

const unSeul = {
  query: async () => [[{ t: 'users' }, { t: 'sessions' }]],
};
const partiel = await verifierSchema(unSeul, SQL);
check('les tables présentes ne sont pas signalées',
  !partiel.find((m) => m.fichier === 'auth.sql')?.tables.includes('users'));

await pool.end();
console.log(failures ? `\n${failures} échec(s)` : '\ntout est vert');
process.exitCode = failures ? 1 : 0;
