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
import { verifierSchema, lireSchemaAttendu, lireColonnesAttendues, messageDeManque,
  CLES_PRIMAIRES, grandLivreFerme } from '../src/server/auth/schema.js';
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
/* Les quatre tables du quotidien sont recréées à chaque passage. `CREATE TABLE
   IF NOT EXISTS` ne touche pas à une table qui existe : sans ce DROP, les
   contrôles de clé primaire plus bas éprouveraient la table qu'un passage
   précédent a laissée, et non le fichier tel qu'il est écrit — une clé
   retirée du CREATE resterait invisible ici. Aucune table ne les référence. */
await raw.query('DROP TABLE IF EXISTS recompenses, missions_jour, compteurs_jour, user_nouveautes');
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
check('et le grand livre y est ouvert', grandLivreFerme() === null);

/* ------------------------------------------------- le quotidien et son grand livre

   `sql/quotidien.sql` porte l'idempotence de tous les versements nouveaux :
   la clé primaire de `recompenses` est ce qui empêche un double clic de payer
   deux fois. Une clé posée autrement que prévu ne se voit dans aucun
   contrôle de tables — d'où celui-ci, lu dans la base et non dans le
   fichier. Les clés attendues sont écrites ici en toutes lettres, et non
   reprises de `schema.js` : une faute dans la liste du démarrage ne doit pas
   pouvoir se confirmer elle-même. */
{
  const ATTENDUES = {
    compteurs_jour: 'user_id,jour,cle',
    missions_jour: 'user_id,jour,rang',
    recompenses: 'user_id,source,cle',
    user_nouveautes: 'user_id,cle',
  };
  const [k] = await pool.query(
    `SELECT table_name AS t, column_name AS c FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND index_name = 'PRIMARY'
        AND table_name IN ('recompenses', 'missions_jour', 'compteurs_jour', 'user_nouveautes')
      ORDER BY table_name, seq_in_index`);
  const vues = {};
  for (const l of k) (vues[String(l.t).toLowerCase()] ??= []).push(String(l.c).toLowerCase());
  for (const [t, cle] of Object.entries(ATTENDUES)) {
    check(`${t} a sa clé primaire (${cle})`, vues[t]?.join(',') === cle
      || (console.log('        vue :', vues[t]?.join(',') ?? 'aucune'), false));
  }
  check('le contrôle de démarrage attend les mêmes clés',
    CLES_PRIMAIRES.every((c) => ATTENDUES[c.table] === c.cle.join(','))
      && CLES_PRIMAIRES.length === Object.keys(ATTENDUES).length);

  /* Pas de clé étrangère, et c'est un choix écrit en tête du fichier : une
     fille de `users` absente des listes de ménage des suites fait tomber
     leur DROP. Qui la remet doit d'abord lire pourquoi elle n'y est pas. */
  const [fk] = await pool.query(
    `SELECT DISTINCT table_name AS t FROM information_schema.key_column_usage
      WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL
        AND table_name IN ('recompenses', 'missions_jour', 'compteurs_jour', 'user_nouveautes')`);
  check('les tables du quotidien n’ont aucune clé étrangère (voir l’en-tête de sql/quotidien.sql)',
    fk.length === 0 || (console.log('        en ont une :', fk.map((x) => x.t).join(', ')), false));

  /* Une colonne par ALTER : le contrôle de démarrage ne voit que le premier
     ajout d'une instruction (`colonnesDeclarees`). Un second ajout dans le
     même ALTER pourrait manquer en production sans que rien ne le dise. On
     le vérifie de deux côtés : chaque instruction n'en porte qu'un, et le
     contrôle de démarrage en voit autant qu'il y a d'instructions. */
  const code = readFileSync(path.join(SQL, 'quotidien.sql'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
  const alters = code.split(';').filter((s) => /ALTER\s+TABLE/i.test(s));
  const doubles = alters.filter((s) => (s.match(/ADD\s+COLUMN/gi) ?? []).length !== 1);
  const vuesAuDemarrage = (await lireColonnesAttendues(SQL)).get('quotidien.sql') ?? [];
  check(`dans sql/quotidien.sql, chaque ALTER TABLE porte un seul ADD COLUMN (${alters.length})`,
    alters.length > 0 && doubles.length === 0
    || (console.log('        à découper :', doubles.map((s) => s.trim().slice(0, 60)).join(' | ')), false));
  check('et le contrôle de démarrage voit chacune de ces colonnes',
    vuesAuDemarrage.length === alters.length);

  check('sql/quotidien.sql vient après ce qu’il complète (auth, souvenirs, saisons)',
    ORDRE.indexOf('quotidien') > Math.max(ORDRE.indexOf('auth'), ORDRE.indexOf('souvenirs'),
      ORDRE.indexOf('saisons')));

  /* Rejoué, il ne change rien : c'est la promesse que le déploiement tient à
     chaque mise en ligne (il applique tout `sql/`, à chaque fois). On photographie
     les colonnes et les index de tout ce qu'il touche, on le rejoue, on
     recompare. */
  const photo = async () => {
    const tables = ['recompenses', 'missions_jour', 'compteurs_jour', 'user_nouveautes',
      'saisons', 'user_wallet', 'virage_presence'];
    const [c] = await pool.query(
      `SELECT table_name, column_name, column_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name IN (?)
        ORDER BY table_name, ordinal_position`, [tables]);
    const [i] = await pool.query(
      `SELECT table_name, index_name, column_name, seq_in_index, non_unique
         FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name IN (?)
        ORDER BY table_name, index_name, seq_in_index`, [tables]);
    return JSON.stringify([c, i]);
  };
  const avant = await photo();
  let leve = null;
  const deux = await mysql.createConnection({ uri: DB, multipleStatements: true });
  try {
    await deux.query(readFileSync(path.join(SQL, 'quotidien.sql'), 'utf8'));
  } catch (e) { leve = e; }
  await deux.end();
  check('sql/quotidien.sql se rejoue sans erreur', !leve
    || (console.log('        il lève :', leve.message), false));
  check('et appliqué deux fois, il donne le même état', avant === await photo());
}

/* ------------------------------------------- les arènes (vague 2, lot 6)

   `sql/arenes.sql` pose ce que le bilan de tribune compte dans l'upsert de
   présence (PARFAITS, meilleure série, meilleur chant), l'index du rang, et
   la préférence de présence. Quatre promesses à tenir, chacune lue dans la
   base et dans le fichier : les colonnes avec leur forme, l'index, une
   colonne par instruction (et par ligne), le dernier rang de `ORDRE` — et le
   fichier rejoué deux fois ne change rien. */
console.log('\n— les arènes —');
{
  /* La forme compte autant que le nom. `presence` doit rester **nullable et
     sans défaut** : NULL y veut dire « le défaut du registre », et un
     `NOT NULL DEFAULT 1` ferait de chaque joueur quelqu'un qui a choisi d'être
     vu — Gaël ne pourrait plus changer le défaut depuis /admin. Les trois
     compteurs partent à zéro sur les lignes déjà écrites. */
  const ATTENDUES = {
    'virage_presence.parfaits': { nul: 'NO', defaut: '0' },
    'virage_presence.serie_max': { nul: 'NO', defaut: '0' },
    'virage_presence.meilleur_q': { nul: 'NO', defaut: '0' },
    'virage_presence.meilleur_chant': { nul: 'YES', defaut: null },
    'user_wallet.presence': { nul: 'YES', defaut: null },
  };
  const [cols] = await pool.query(
    `SELECT table_name AS t, column_name AS c, is_nullable AS n, column_default AS d
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND ((table_name = 'virage_presence'
              AND column_name IN ('parfaits', 'serie_max', 'meilleur_q', 'meilleur_chant'))
          OR (table_name = 'user_wallet' AND column_name = 'presence'))`);
  /* MariaDB écrit le défaut d'une colonne nullable sans défaut « NULL », en
     toutes lettres ; MySQL, `null`. Les deux veulent dire la même chose. */
  const vues = Object.fromEntries(cols.map((x) => [`${String(x.t).toLowerCase()}.${
    String(x.c).toLowerCase()}`, { nul: x.n, defaut: x.d === 'NULL' ? null : x.d }]));
  const ecarts = Object.entries(ATTENDUES).filter(([k, v]) => JSON.stringify(vues[k]) !== JSON.stringify(v))
    .map(([k, v]) => `${k} : attendu ${JSON.stringify(v)}, vu ${JSON.stringify(vues[k] ?? 'absente')}`);
  check('les cinq colonnes des arènes sont en base, avec leur forme (nullable, défaut)',
    ecarts.length === 0 || (console.log('       ', ecarts.join('\n        ')), false));
  check('user_wallet.presence est nullable et sans défaut : NULL = « le défaut du registre »',
    vues['user_wallet.presence']?.nul === 'YES' && vues['user_wallet.presence']?.defaut === null);

  const [ix] = await pool.query(
    `SELECT column_name AS c FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'virage_presence' AND index_name = 'idx_bilan'
      ORDER BY seq_in_index`);
  check('l’index idx_bilan couvre (fixture_id, side, ferveur), dans cet ordre',
    ix.map((x) => String(x.c).toLowerCase()).join(',') === 'fixture_id,side,ferveur'
    || (console.log('        vu :', ix.map((x) => x.c).join(',') || 'aucun'), false));

  /* Une colonne par ALTER, comme pour le quotidien : le contrôle de démarrage
     ne voit que le premier ajout d'une instruction. **Et une instruction par
     ligne** : les suites du Virage prennent ces lignes une à une, au motif,
     pour retirer ou reposer une colonne sans le reste du fichier — une
     instruction coupée en deux ne s'y laisserait pas prendre. La ligne
     `CREATE INDEX` ne doit troubler ni l'un ni l'autre. */
  const code = readFileSync(path.join(SQL, 'arenes.sql'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
  const instructions = code.split(';').map((s) => s.trim()).filter(Boolean);
  const alters = instructions.filter((s) => /^ALTER\s+TABLE/i.test(s));
  const doubles = alters.filter((s) => (s.match(/ADD\s+COLUMN/gi) ?? []).length !== 1);
  check(`dans sql/arenes.sql, chaque ALTER TABLE porte un seul ADD COLUMN (${alters.length})`,
    alters.length === 5 && doubles.length === 0
    || (console.log('        à découper :', doubles.map((s) => s.slice(0, 70)).join(' | ')), false));
  const coupees = instructions.filter((s) => s.includes('\n'));
  check('et chaque instruction tient sur une ligne',
    coupees.length === 0 || (console.log('        coupées :', coupees.map((s) => s.slice(0, 50)).join(' | ')), false));
  check('le fichier ne fait rien d’autre : cinq ALTER, un CREATE INDEX',
    instructions.length === 6 && instructions.filter((s) => /^CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_bilan\b/i
      .test(s)).length === 1
    || (console.log('        instructions :', instructions.map((s) => s.slice(0, 40)).join(' | ')), false));
  const auDemarrage = ((await lireColonnesAttendues(SQL)).get('arenes.sql') ?? [])
    .map((x) => `${x.table}.${x.colonne}`).sort();
  check('le contrôle de démarrage voit exactement ces cinq colonnes, l’index ne le trouble pas',
    JSON.stringify(auDemarrage) === JSON.stringify(Object.keys(ATTENDUES).sort())
    || (console.log('        vues :', auDemarrage.join(', ')), false));

  /* Le dernier à toucher `virage_presence` et `user_wallet`. Seul
     `pronostics.sql` (6 octobre 2026) vient après lui : une table neuve, qui
     ne touche à aucune colonne d'un autre fichier. */
  const apresArenes = ORDRE.slice(ORDRE.indexOf('arenes') + 1);
  check('sql/arenes.sql est le dernier à compléter des tables d’autres fichiers',
    apresArenes.every((f) => f === 'pronostics')
    || (console.log('        après lui :', apresArenes.join(', ')), false));
  check('et vient après ce qu’il complète (souvenirs, quotidien)',
    ORDRE.indexOf('arenes') > Math.max(ORDRE.indexOf('souvenirs'), ORDRE.indexOf('quotidien')));

  /* Sans lui, le démarrage le nomme : la panne du 9 septembre (un fichier qui
     n'ajoute que des colonnes, oublié) ne doit pas revenir par celui-ci. On
     retire ce qu'il pose, on regarde, on le rejoue — sur une base de test
     que cette suite vient de remonter entière. */
  await pool.query(`ALTER TABLE virage_presence DROP COLUMN parfaits, DROP COLUMN serie_max,
    DROP COLUMN meilleur_q, DROP COLUMN meilleur_chant, DROP INDEX idx_bilan`);
  await pool.query('ALTER TABLE user_wallet DROP COLUMN presence');
  const sans = await verifierSchema(pool, SQL);
  const m = sans.find((x) => x.fichier === 'arenes.sql');
  check('sans lui, le démarrage nomme sql/arenes.sql et ses cinq colonnes',
    m?.colonnes?.length === 5 && sans.length === 1
      && (messageDeManque(sans) ?? '').includes('sql/arenes.sql')
    || (console.log('        vu :', JSON.stringify(sans)), false));

  /* Appliqué deux fois de suite, le même état — et pas une erreur : c'est ce
     que le déploiement fait à chaque mise en ligne. */
  const photo = async () => {
    const [c] = await pool.query(
      `SELECT table_name, column_name, column_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name IN ('virage_presence', 'user_wallet')
        ORDER BY table_name, ordinal_position`);
    const [i] = await pool.query(
      `SELECT table_name, index_name, column_name, seq_in_index, non_unique
         FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name IN ('virage_presence', 'user_wallet')
        ORDER BY table_name, index_name, seq_in_index`);
    return JSON.stringify([c, i]);
  };
  const rejouer = async () => {
    const cnx = await mysql.createConnection({ uri: DB, multipleStatements: true });
    try {
      await cnx.query(readFileSync(path.join(SQL, 'arenes.sql'), 'utf8'));
      return null;
    } catch (e) { return e; } finally { await cnx.end(); }
  };
  const premier = await rejouer();
  const apresUn = await photo();
  const second = await rejouer();
  check('sql/arenes.sql s’applique, puis se rejoue, sans erreur', !premier && !second
    || (console.log('        il lève :', (premier ?? second).message), false));
  check('et appliqué deux fois, il donne le même état', apresUn === await photo());
  check('rejoué, la base est de nouveau à jour', (await verifierSchema(pool, SQL)).length === 0);
}

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
  //
  // Les cles primaires du grand livre et de ses voisines sont rendues justes :
  // sans cela, la fausse base declarerait aussi une cle absente, et le
  // controle de la colonne se lirait au milieu d'une autre faute.
  const toutesTables = [...attendu.values()].flat().map((t) => ({ t }));
  const clesJustes = CLES_PRIMAIRES.flatMap((k) => k.cle.map((c, i) => ({ t: k.table, c, n: i + 1 })));
  const sansXp = {
    query: async (sql) => (/information_schema.tables/i.test(sql)
      ? [toutesTables]
      : /information_schema.statistics/i.test(sql)
        ? [clesJustes]
        : [[...cols.values()].flat()
            .filter((c) => !(c.table === 'user_wallet' && c.colonne === 'xp'))
            .map((c) => ({ t: c.table, c: c.colonne }))]),
  };
  const vus = await verifierSchema(sansXp, SQL);
  check('une colonne absente est signalee, meme si toutes les tables sont la',
    vus.some((m) => m.fichier === 'niveau.sql' && m.colonnes?.includes('user_wallet.xp')));
  check('et le message nomme la colonne, pas seulement le fichier',
    (messageDeManque(vus) ?? '').includes('colonne(s) absente(s) : user_wallet.xp'));
  check('sans accuser une clé primaire qui est juste', !vus.some((m) => m.cles?.length)
    || (console.log('        il accuse :', JSON.stringify(vus.filter((m) => m.cles))), false));
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
