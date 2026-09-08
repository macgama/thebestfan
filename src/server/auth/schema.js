/**
 * Contrôle du schéma au démarrage.
 *
 * Le 8 septembre 2026, thebestfan.online a passé onze heures sans
 * authentification. Le code de la veille était bien en ligne, la base bien
 * joignable — mais `sql/fanzzy.sql` n'avait jamais été appliqué en production.
 * Le chargement du catalogue levait, le `catch` du démarrage attrapait tout, et
 * *toutes* les routes `/api` disparaissaient d'un coup. Côté joueur : « Erreur
 * du serveur » sur la page de connexion, sans autre indice.
 *
 * Le défaut n'est pas la table manquante — ça arrivera à chaque fois qu'on en
 * ajoutera une, parce que le déploiement pousse le code et jamais le schéma.
 * Le défaut, c'est que rien ne l'a dit. Ce module compare donc ce que `sql/`
 * déclare à ce que la base contient, et nomme le fichier à appliquer.
 *
 * Il ne modifie rien. Appliquer du DDL tout seul sur une base de production,
 * au démarrage, sans que personne regarde, ferait courir un risque plus grand
 * que celui qu'on cherche à écarter.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** Les tables qu'un fichier `.sql` promet de créer. */
function tablesDeclarees(sql) {
  return [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/gi)]
    .map((m) => m[1].toLowerCase());
}

/**
 * Lit `sql/` et renvoie `{ fichier -> [tables] }`.
 *
 * `rattrapage.sql` est écarté : c'est un correctif pour bases anciennes, il ne
 * décrit pas l'état attendu.
 */
export async function lireSchemaAttendu(dossier) {
  const attendu = new Map();
  for (const nom of (await readdir(dossier)).filter((f) => f.endsWith('.sql')).sort()) {
    if (nom === 'rattrapage.sql') continue;
    const tables = tablesDeclarees(await readFile(path.join(dossier, nom), 'utf8'));
    if (tables.length) attendu.set(nom, tables);
  }
  return attendu;
}

/**
 * Compare le schéma attendu à la base.
 *
 * Renvoie la liste des fichiers incomplets, chacun avec ses tables manquantes.
 * Une liste vide veut dire que la base est à jour.
 */
export async function verifierSchema(pool, dossier) {
  const attendu = await lireSchemaAttendu(dossier);
  const [lignes] = await pool.query(
    'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()');
  const presentes = new Set(lignes.map((l) => String(l.t).toLowerCase()));

  const manques = [];
  for (const [fichier, tables] of attendu) {
    const absentes = tables.filter((t) => !presentes.has(t));
    if (absentes.length) manques.push({ fichier, tables: absentes });
  }
  return manques;
}

/**
 * Le message à afficher au démarrage, ou `null` si tout va bien.
 *
 * Il est long et il donne le geste exact à faire. Le message précédent —
 * « base injoignable, authentification désactivée » — était faux : la base
 * était parfaitement joignable. Un diagnostic qui envoie chercher au mauvais
 * endroit coûte plus cher que pas de diagnostic du tout.
 */
export function messageDeManque(manques) {
  if (!manques.length) return null;
  const lignes = manques.map(
    ({ fichier, tables }) => `    sql/${fichier} — table(s) absente(s) : ${tables.join(', ')}`);
  return 'SCHÉMA INCOMPLET : la base ne contient pas toutes les tables que le '
    + 'code attend.\n' + lignes.join('\n')
    + '\n  À appliquer dans phpMyAdmin, onglet SQL, dans cet ordre. Ces fichiers '
    + 'sont écrits en CREATE TABLE IF NOT EXISTS : les rejouer sur une base déjà '
    + 'à jour ne casse rien.';
}
