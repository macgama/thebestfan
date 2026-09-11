/**
 * Applique les fichiers de `sql/` à la base, dans l'ordre, et vérifie.
 *
 * ## Pourquoi ce script existe
 *
 * C'est la panne la plus chère du projet, et elle s'est produite **deux fois** :
 * le code part en ligne, un fichier de `sql/` n'a pas été appliqué, le
 * démarrage lève, et *toutes* les routes `/api` disparaissent — connexion
 * comprise. Le site répond, sert ses pages, et refuse tout le monde. Onze
 * heures la première fois.
 *
 * La parade était une liste à recopier à la main dans un terminal, à minuit,
 * après une mise en ligne. Ça tient tant qu'on y pense. Ici, on n'y pense
 * plus : le déploiement l'exécute avant de redémarrer.
 *
 * ## Ce qu'il fait, et ce qu'il ne fait pas
 *
 * Il applique **tous** les fichiers, toujours, dans l'ordre de
 * `DEPLOIEMENT.md`. Ils sont tous idempotents — `CREATE TABLE IF NOT EXISTS`,
 * `ALTER TABLE … ADD COLUMN IF NOT EXISTS` — donc les rejouer sur une base à
 * jour ne coûte qu'un aller-retour et ne change rien. C'est très exactement ce
 * qui permet de ne pas avoir à savoir lesquels manquent.
 *
 * Il ne supprime rien, ne vide rien, ne migre aucune donnée de son propre chef.
 * Il n'emploie donc **pas** la garde de `base-de-test.mjs` : contrairement aux
 * suites, il est fait pour viser la base de production, et c'est son seul
 * emploi utile.
 *
 * `rattrapage.sql` est écarté : il corrige d'anciennes bases et suppose un état
 * qu'une base neuve n'a pas.
 *
 * Usage :
 *   npm run schema:appliquer            (lit DATABASE_URL dans .env)
 *   DATABASE_URL=mysql://… node scripts/appliquer-schema.mjs
 *   … --verifier-seulement              (ne touche à rien, dit ce qui manque)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifierSchema, messageDeManque } from '../src/server/auth/schema.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SQL = path.join(RACINE, 'sql');

/**
 * L'ordre d'application. Chaque fichier s'appuie sur les tables du précédent,
 * et une liste alphabétique casserait les clés étrangères.
 *
 * Il est écrit ici **et** dans `scripts/schema-smoke.mjs`, qui compare le sien
 * au contenu du dossier et échoue s'il manque un fichier. C'est ce qui empêche
 * cette liste-ci de dériver en silence : ajouter un `.sql` sans l'inscrire
 * fait rougir une suite avant la mise en ligne.
 */
const ORDRE = ['auth', 'football', 'minutes', 'couleurs', 'duel', 'souvenirs', 'fanzzy',
  'teletext', 'inventaire', 'skins', 'tenues', 'deck', 'admin', 'kop', 'amis',
  'niveau', 'raretes', 'stades'];

const verifierSeulement = process.argv.includes('--verifier-seulement');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error([
    '',
    '  DATABASE_URL est absent.',
    '',
    '  Sur le serveur, il vit dans .env et `npm run schema:appliquer` le lit.',
    '  Ailleurs, donne-le explicitement :',
    '',
    '      DATABASE_URL=mysql://user:pass@hote:3306/base node scripts/appliquer-schema.mjs',
    '',
  ].join('\n'));
  process.exit(1);
}

const mysql = await import('mysql2/promise');

/* `multipleStatements` : un fichier de schéma est une suite d'instructions, et
   c'est la seule manière de l'envoyer tel quel plutôt que de le découper au
   point-virgule — un découpage naïf casse à la première procédure ou au premier
   point-virgule dans un commentaire. */
const cnx = await mysql.createConnection({ uri: url, multipleStatements: true });

if (!verifierSeulement) {
  for (const nom of ORDRE) {
    const fichier = path.join(SQL, `${nom}.sql`);
    process.stdout.write(`  ${nom}.sql `.padEnd(22, '.'));
    try {
      await cnx.query(readFileSync(fichier, 'utf8'));
      console.log(' appliqué');
    } catch (e) {
      console.log(' ÉCHEC');
      console.error(`\n  sql/${nom}.sql n'a pas pu être appliqué :\n  ${e.message}\n`);
      /* On s'arrête au premier échec. Continuer appliquerait les suivants sur
         une base à laquelle il manque ce que celui-ci devait poser : les
         erreurs suivantes parleraient alors d'autre chose, et on chercherait
         au mauvais endroit. */
      await cnx.end();
      process.exit(1);
    }
  }
}

/* Le contrôle final est celui du démarrage, mot pour mot. Un schéma qu'on
   croit à jour parce qu'aucune commande n'a protesté n'est pas un schéma
   vérifié — et c'est ce même contrôle qui décidera, dans quelques secondes, si
   le site ouvre ou refuse tout le monde. */
const manques = await verifierSchema(cnx, SQL);
await cnx.end();

if (manques.length) {
  console.error('\n' + messageDeManque(manques));
  process.exit(1);
}
console.log(`\n${verifierSeulement ? 'La base est à jour.' : 'Schéma appliqué et vérifié.'}`);
