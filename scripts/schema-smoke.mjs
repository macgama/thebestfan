/**
 * Test du contrôle de schéma.
 *
 * Il rejoue la panne du 8 septembre 2026 : le code en ligne attend la table
 * `fanzzy`, la base ne l'a pas, et tout le site se ferme sans dire pourquoi.
 * Ce que le contrôle doit garantir, c'est qu'à la place du silence il y ait un
 * nom de fichier.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifierSchema, lireSchemaAttendu, messageDeManque }
  from '../src/server/auth/schema.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
const SQL = fileURLToPath(new URL('../sql/', import.meta.url));
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');

// Les autres suites déposent la base dans l'état dont elles ont besoin, jamais
// dans l'état complet : admin-smoke, par exemple, laisse `duels` supprimée. On
// remonte donc le schéma entier — les neuf fichiers sont idempotents — pour que
// ce contrôle mesure le schéma du dépôt et non le résidu de la suite d'avant.
const ORDRE = ['auth', 'football', 'duel', 'souvenirs', 'fanzzy', 'teletext',
  'inventaire', 'deck', 'admin'];
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
for (const f of ORDRE) {
  await raw.query(readFileSync(path.join(SQL, `${f}.sql`), 'utf8'));
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 2, charset: 'utf8mb4' });

/* ------------------------------------------------------- lecture des .sql */

const attendu = await lireSchemaAttendu(SQL);
check('les fichiers de sql/ déclarent des tables', attendu.size >= 5);
check('sql/fanzzy.sql déclare bien la table fanzzy',
  attendu.get('fanzzy.sql')?.includes('fanzzy'));
check('sql/auth.sql déclare users et sessions',
  ['users', 'sessions'].every((t) => attendu.get('auth.sql')?.includes(t)));
check('rattrapage.sql est écarté : il corrige, il ne décrit pas',
  !attendu.has('rattrapage.sql'));

/* ------------------------------------------- la base de test est complète */

// Les suites précédentes ont monté le schéma entier. Si ce contrôle voit un
// manque ici, c'est qu'un fichier de sql/ n'est appliqué nulle part.
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
