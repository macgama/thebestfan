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

/**
 * Les tables qu'un fichier `.sql` promet de créer.
 *
 * **Les commentaires sont retirés avant lecture.** Un fichier de ce projet
 * commence toujours par expliquer ce qu'il fait, et l'un d'eux disait
 * « Rejouable : `CREATE TABLE IF NOT EXISTS` partout ». La phrase était lue
 * comme une déclaration, et il en sortait une table nommée « if » —
 * introuvable en base par construction. Le démarrage annonçait donc un schéma
 * incomplet pour l'éternité, `/healthz` répondait `ok: false`, et le message
 * réclamait d'appliquer un fichier déjà appliqué.
 *
 * Une prose qui casse un contrôle : exactement le genre de faute qu'on ne
 * cherche pas, puisqu'on relit le SQL et pas les commentaires.
 */
function tablesDeclarees(sql) {
  const code = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')      // blocs /* … */
    .replace(/--[^\n]*/g, ' ');             // lignes -- …
  return [...code.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/gi)]
    .map((m) => m[1].toLowerCase());
}

/**
 * Les colonnes qu'un fichier promet d'ajouter à une table existante.
 *
 * **Un fichier peut ne créer aucune table et rester indispensable.** Quatre
 * des derniers l'étaient : `niveau.sql` n'ajoute qu'une colonne `xp`,
 * `skins.sql` un `stage`, `stades.sql` un autre. Le contrôle ne regardait que
 * les tables — il les déclarait donc tous appliqués, toujours.
 *
 * Le 9 septembre 2026, `niveau.sql` a été oublié en production. Aucune table
 * ne manquait, `/healthz` répondait `ok: true`, le démarrage ne disait rien —
 * et le jeu refusait tous les boosters hors de la première série ainsi que
 * tout deck de trois Fanzzy. La même panne que le 8 septembre, sous une autre
 * forme : le code en ligne attend quelque chose que la base n’a pas.
 */
function colonnesDeclarees(sql) {
  const code = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
  const out = [];
  /* `ALTER TABLE <t> ADD COLUMN IF NOT EXISTS <c>` — la seule forme employée
     ici, et la seule qui décrive une promesse tenable. Un `ADD COLUMN` sans
     garde ne se rejoue pas : on ne le cherche pas.

     Le `[^;]*?` empêche de traverser un point-virgule : sans lui, un `ALTER
     TABLE` suivi plus loin, dans une *autre* instruction, d'un `ADD COLUMN IF
     NOT EXISTS` verrait les deux appariés — et le contrôle réclamerait une
     colonne sur une table qui ne la reçoit jamais. */
  const re = /ALTER\s+TABLE\s+`?(\w+)`?[^;]*?ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+`?(\w+)`?/gi;
  for (const m of code.matchAll(re)) {
    out.push({ table: m[1].toLowerCase(), colonne: m[2].toLowerCase() });
  }
  return out;
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

/** Les colonnes promises par `sql/`, `{ fichier -> [{table, colonne}] }`. */
export async function lireColonnesAttendues(dossier) {
  const attendu = new Map();
  for (const nom of (await readdir(dossier)).filter((f) => f.endsWith('.sql')).sort()) {
    if (nom === 'rattrapage.sql') continue;
    const cols = colonnesDeclarees(await readFile(path.join(dossier, nom), 'utf8'));
    if (cols.length) attendu.set(nom, cols);
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

  const manques = new Map();
  for (const [fichier, tables] of attendu) {
    const absentes = tables.filter((t) => !presentes.has(t));
    if (absentes.length) manques.set(fichier, { fichier, tables: absentes });
  }

  /* Les colonnes, ensuite.
   *
   * On ne les cherche que dans les tables **présentes** : réclamer une colonne
   * d'une table qui manque déjà noierait le vrai message sous le bruit, et le
   * fichier qui crée la table est de toute façon déjà nommé.
   */
  const colonnes = await lireColonnesAttendues(dossier);
  if (colonnes.size) {
    let vues = new Set();
    try {
      const [cols] = await pool.query(
        'SELECT table_name AS t, column_name AS c FROM information_schema.columns '
        + 'WHERE table_schema = DATABASE()');
      vues = new Set(cols.map((l) => `${String(l.t).toLowerCase()}.${String(l.c).toLowerCase()}`));
    } catch {
      // Un serveur qui refuse `information_schema.columns` ne doit pas empêcher
      // le démarrage : on renonce au contrôle des colonnes, pas au reste.
      return [...manques.values()];
    }
    for (const [fichier, liste] of colonnes) {
      const absentes = liste
        .filter((x) => presentes.has(x.table) && !vues.has(`${x.table}.${x.colonne}`))
        .map((x) => `${x.table}.${x.colonne}`);
      if (!absentes.length) continue;
      const deja = manques.get(fichier) ?? { fichier, tables: [] };
      manques.set(fichier, { ...deja, colonnes: absentes });
    }
  }

  return [...manques.values()];
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
  const lignes = manques.map(({ fichier, tables = [], colonnes = [] }) => {
    const quoi = [
      tables.length ? `table(s) absente(s) : ${tables.join(', ')}` : null,
      colonnes.length ? `colonne(s) absente(s) : ${colonnes.join(', ')}` : null,
    ].filter(Boolean).join(' · ');
    return `    sql/${fichier} — ${quoi}`;
  });
  return 'SCHÉMA INCOMPLET : la base ne contient pas tout ce que le code attend.\n'
    + lignes.join('\n')
    + '\n  À appliquer dans phpMyAdmin, onglet SQL, dans cet ordre. Ces fichiers '
    + 'sont écrits en CREATE TABLE IF NOT EXISTS et ADD COLUMN IF NOT EXISTS : '
    + 'les rejouer sur une base déjà à jour ne casse rien.';
}
