/**
 * La remise à zéro de la base pour lancer la vraie Saison 1.
 *
 * ## Ce que Gaël a demandé (25 octobre 2026)
 *
 * « Supprimer les USER existants, les duels existants, les classements
 * existants. Pour avoir une base de données vierge de données afin de lancer
 * une véritable Saison 1 avec mes bêta-testeurs. » Puis, à nos questions :
 * garder son compte admin, supprimer même les abonnements Stripe, démarrer la
 * saison au moment du nettoyage et la finir fin mars, en repoussant les
 * saisons 2 à 5 déjà créées.
 *
 * ## Ce qu'il fait, dans cet ordre
 *
 *   1. Il **sauvegarde** toute la base (mysqldump, compressé) dans
 *      `~/sauvegardes/`. Sans sauvegarde lisible, il s'arrête : rien d'autre
 *      ne se fait.
 *   2. Il **résilie chez Stripe**, tout de suite, chaque abonnement que la base
 *      connaît (sinon Stripe continuerait de prélever des comptes qui
 *      n'existent plus).
 *   3. Dans **une seule transaction** : il vide les tables des joueurs, supprime
 *      les comptes qui ne sont pas admin, remet les comptes admin à neuf (ils
 *      repasseront par le paquet de bienvenue), relance la saison 1 maintenant
 *      et repousse les saisons suivantes. Puis il vérifie qu'il ne reste aucune
 *      ligne orpheline ; sinon il annule tout.
 *
 * ## Ce qu'il garde
 *
 * Le catalogue (Fanzzy, tenues), les réglages de /admin, les saisons, les
 * contenus, le football (matchs, clubs, championnats, cache de l'API), les
 * modèles des cartes-souvenirs (un but réel, pas l'exemplaire d'un joueur),
 * les clés des notifications (les changer rendrait muets tous les appareils
 * à venir) et le journal de /admin (en ajout seul, par principe).
 *
 * ## Les gardes
 *
 * - Sans `--pour-de-bon`, c'est un **essai** : il compte, montre et ne touche
 *   à rien (chez Stripe, il ne fait que lire).
 * - `--pour-de-bon` demande encore de taper `SAISON 1`.
 * - Une table de la base qu'il ne connaît pas et qui parle d'un joueur
 *   (`user_id` ou clé vers `users`) l'arrête : on ne vide pas à moitié.
 * - Une saison 2 à 5 déjà lancée l'arrête : la repousser n'aurait pas de sens.
 *
 * Usage, en SSH, dans le dossier du site, hors d'un match :
 *
 *     npm run saison1:essai                     (ne touche à rien)
 *     npm run saison1:remise                    (pour de bon)
 *     … -- --fin-saison1=2027-03-30             (autre dernier jour de la saison 1)
 *
 * Puis redémarrer dans l'onglet Node.js du Manager.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, statSync, readFileSync } from 'node:fs';
import { createGzip, gunzipSync } from 'node:zlib';
import { createInterface } from 'node:readline';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGUE } from '../src/shared/boutique.js';

/* ===================================================== les listes de tables */

/** Vidées entièrement, comptes admin compris. */
export const VIDER = [
  // les connexions (celles d'un admin restent : voir plus bas)
  'auth_tokens', 'login_attempts',
  // les duels et ce qui fait les classements
  'duels', 'duel_events', 'duel_results', 'virage_presence',
  // la collection, le deck, la bourse
  'user_wallet', 'user_fanzzy', 'user_skins', 'user_stuff', 'user_etats', 'user_decks',
  'user_souvenirs', 'user_stades', 'user_nouveautes',
  // les clubs et championnats suivis
  'user_follows', 'user_league_follows',
  // le KOP et les amis
  'kops', 'kop_membres', 'kop_votes', 'kop_bulletins', 'kop_bonus', 'kop_invites',
  'amities', 'parrainages',
  // boutique et abonnement (résiliés chez Stripe avant)
  'achats', 'abonnements', 'abonnement_departs',
  // le quotidien, le carnet, les récompenses
  'missions_jour', 'compteurs_jour', 'recompenses',
  // pronostics, mini-jeux, notifications
  'pronostics', 'jeux_jongles', 'jeux_tirs', 'jeux_parties', 'jeux_tifo', 'jeux_boss',
  'notif_appareils',
];

/** Gardées telles quelles. `users` et `sessions` gardent les comptes admin. */
export const GARDER = [
  'users', 'sessions', 'admin_audit', 'reglages', 'saisons', 'contenus',
  'fanzzy', 'tenues', 'souvenirs', 'souvenir_leagues', 'notif_cles',
  'leagues', 'teams', 'team_leagues', 'fixtures', 'fixture_events', 'standings',
  'api_cache', 'api_quota',
];

/* ======================================================= les dates de saison */

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const versJour = (d) => d.toISOString().slice(0, 10);
const lireJour = (s) => new Date(`${s}T00:00:00Z`);

/** Le lendemain d'un jour `AAAA-MM-JJ`. */
export function lendemain(jour) {
  const d = lireJour(jour);
  d.setUTCDate(d.getUTCDate() + 1);
  return versJour(d);
}

/**
 * Le dernier jour d'une saison de trois mois qui ouvre ce jour-là : la fin du
 * trimestre où l'on est un mois après l'ouverture. 1er avril → 30 juin,
 * 1er janvier → 31 mars ; et une ouverture décalée d'un jour (31 mars) se
 * recale sur la fin de trimestre (30 juin) au lieu de glisser.
 */
export function finTrimestre(ouvre) {
  const d = lireJour(ouvre);
  const mois = d.getUTCMonth() + 1;                  // un mois plus tard, 0 à 12
  const an = d.getUTCFullYear() + Math.floor(mois / 12);
  const premierDuTrimestreSuivant = (Math.floor((mois % 12) / 3) + 1) * 3;
  return versJour(new Date(Date.UTC(an, premierDuTrimestreSuivant, 0)));
}

/**
 * Les nouvelles dates des saisons qui suivent la saison 1 : chacune ouvre le
 * lendemain de la précédente et dure trois mois (calendrier de Gaël du
 * 18 octobre 2026). `suivantes` : leurs numéros, dans l'ordre.
 */
export function calendrier(finSaison1, suivantes) {
  const out = [];
  let fin = finSaison1;
  for (const numero of suivantes) {
    const ouvre = lendemain(fin);
    fin = finTrimestre(ouvre);
    out.push({ numero, ouvre_le: ouvre, fin_le: fin });
  }
  return out;
}

/* ================================================================ le script */

const lance = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (lance) await principal();

async function principal() {
  const args = process.argv.slice(2);
  const pourDeBon = args.includes('--pour-de-bon');
  const finArg = args.find((a) => a.startsWith('--fin-saison1='))?.split('=')[1];
  const FIN_S1 = finArg || '2027-03-31';
  if (!JOUR.test(FIN_S1) || versJour(lireJour(FIN_S1)) !== FIN_S1) {
    sortir(`--fin-saison1 attend un jour AAAA-MM-JJ, reçu « ${FIN_S1} ».`);
  }

  const url = process.env.DATABASE_URL;
  if (!url) sortir('DATABASE_URL est absent. Sur le serveur, il vit dans .env : lance « npm run saison1:essai ».');

  const mysql = await import('mysql2/promise');
  const db = await mysql.createConnection({ uri: url, charset: 'utf8mb4', timezone: 'Z' });
  const q = async (sql, p) => (await db.query(sql, p))[0];
  const nomBase = new URL(url).pathname.replace(/^\//, '');

  console.log('');
  console.log(pourDeBon ? '  REMISE À ZÉRO — POUR DE BON' : '  REMISE À ZÉRO — ESSAI (rien ne sera modifié)');
  console.log(`  Base « ${nomBase} » sur ${new URL(url).hostname}`);
  console.log('');

  /* ------------------------------------------------ 1. ce qu'il y a dans la base */
  const tables = (await q(
    `SELECT table_name AS t FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`)).map((r) => r.t ?? r.T ?? r.TABLE_NAME);
  const presentes = new Set(tables);
  const inconnues = tables.filter((t) => !VIDER.includes(t) && !GARDER.includes(t));
  const bloquantes = [];
  for (const t of inconnues) {
    const [c] = await q(
      `SELECT
         (SELECT COUNT(*) FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'user_id') AS col,
         (SELECT COUNT(*) FROM information_schema.key_column_usage
           WHERE table_schema = DATABASE() AND table_name = ? AND referenced_table_name = 'users') AS fk`,
      [t, t]);
    if (Number(c.col) || Number(c.fk)) bloquantes.push(t);
  }
  if (bloquantes.length) {
    sortir(`Ces tables parlent d'un joueur et ce script ne les connaît pas : ${bloquantes.join(', ')}.\n`
      + '  Rien n\'a été touché. Colle ce message dans le fil, on les ajoutera à la liste.');
  }
  if (inconnues.length) {
    console.log(`  Tables inconnues gardées (aucun lien vers un joueur) : ${inconnues.join(', ')}`);
  }

  const [comptes] = await q(
    `SELECT SUM(role = 'admin') AS admins, SUM(role <> 'admin') AS joueurs FROM users`);
  const admins = await q(`SELECT public_id, pseudo, email FROM users WHERE role = 'admin' ORDER BY id`);
  if (!admins.length) {
    sortir('Aucun compte admin dans la base : le script garderait zéro compte. Rien n\'a été touché.');
  }
  console.log(`  Comptes gardés (admin, remis à neuf) : ${admins.map((a) => a.pseudo).join(', ')}`);
  console.log(`  Comptes supprimés : ${Number(comptes.joueurs) || 0}`);
  console.log('');
  console.log('  Lignes vidées :');
  for (const t of VIDER) {
    if (!presentes.has(t)) { console.log(`    ${t.padEnd(22)} (absente, rien à faire)`); continue; }
    const [n] = await q(`SELECT COUNT(*) AS n FROM \`${t}\``);
    console.log(`    ${t.padEnd(22)} ${n.n}`);
  }
  console.log('');

  const live = presentes.has('fixtures') ? (await q(
    `SELECT COUNT(*) AS n FROM fixtures
      WHERE status_short IN ('1H','HT','2H','ET','BT','P','LIVE','INT')`))[0].n : 0;
  if (Number(live)) {
    console.log(`  Attention : ${live} match(s) en direct en ce moment. Mieux vaut lancer hors d'un match.`);
    console.log('');
  }

  /* ------------------------------------------------------ 2. les saisons */
  const saisons = await q(
    `SELECT id, numero, nom, DATE_FORMAT(ouvre_le, '%Y-%m-%d') AS ouvre_le,
            DATE_FORMAT(fin_le, '%Y-%m-%d') AS fin_le, lancee_a
       FROM saisons ORDER BY numero, id`);
  const s1 = saisons.filter((s) => Number(s.numero) === 1);
  if (s1.length !== 1) sortir(`Attendu une seule saison numéro 1, trouvé ${s1.length}. Rien n'a été touché.`);
  const suivantes = saisons.filter((s) => Number(s.numero) > 1);
  const lancees = suivantes.filter((s) => s.lancee_a);
  if (lancees.length) {
    sortir(`Saison(s) déjà lancée(s) après la 1 : ${lancees.map((s) => s.numero).join(', ')}. `
      + 'Les repousser n\'aurait pas de sens. Rien n\'a été touché.');
  }
  const [{ aujourdhui }] = await q(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS aujourdhui`);
  if (FIN_S1 <= aujourdhui) sortir(`La fin de la saison 1 (${FIN_S1}) doit venir après aujourd'hui (${aujourdhui}).`);
  const plan = calendrier(FIN_S1, suivantes.map((s) => Number(s.numero)));
  console.log('  Saisons :');
  console.log(`    1 « ${s1[0].nom} » : lancée maintenant (${aujourdhui}), dernier jour ${FIN_S1}`
    + `  (avant : ${s1[0].fin_le ?? 'sans fin'})`);
  suivantes.forEach((s, i) => {
    console.log(`    ${s.numero} « ${s.nom} » : du ${plan[i].ouvre_le} au ${plan[i].fin_le}`
      + `  (avant : ${s.ouvre_le ?? '?'} → ${s.fin_le ?? '?'})`);
  });
  console.log('');

  /* -------------------------------------------- 3. les abonnements Stripe */
  const refs = new Set();
  if (presentes.has('abonnements')) {
    for (const r of await q(`SELECT reference FROM abonnements WHERE source = 'stripe' AND reference IS NOT NULL`)) {
      refs.add(r.reference);
    }
  }
  const cle = process.env.STRIPE_SECRET_KEY || '';
  const API = process.env.TBF_STRIPE_API || 'https://api.stripe.com/v1';
  const stripe = async (chemin, methode = 'GET') => {
    const r = await fetch(API + chemin, { method: methode, headers: { Authorization: `Bearer ${cle}` } });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json?.error?.message || `Stripe ${r.status}`);
    return json;
  };
  /* Une ligne posée avant que la référence soit écrite : la session Checkout
     de la commande d'abonnement connaît l'abonnement qu'elle a ouvert. */
  const sessions = presentes.has('achats') ? await q(
    `SELECT DISTINCT stripe_session FROM achats
      WHERE stripe_session IS NOT NULL AND etat = 'livre' AND article IN (?)`,
    [CATALOGUE.filter((a) => a.recurrence).map((a) => a.id)]) : [];
  if ((refs.size || sessions.length) && !cle) {
    sortir('La base connaît des abonnements Stripe, mais STRIPE_SECRET_KEY est absent : '
      + 'impossible de les résilier. Rien n\'a été touché.');
  }
  for (const s of sessions) {
    try {
      const cs = await stripe(`/checkout/sessions/${encodeURIComponent(s.stripe_session)}`);
      const ref = typeof cs?.subscription === 'string' ? cs.subscription : cs?.subscription?.id;
      if (ref) refs.add(ref);
    } catch (e) {
      sortir(`Stripe ne lit pas une commande d'abonnement (${e.message}). Rien n'a été touché.`);
    }
  }
  const aResilier = [];
  console.log('  Abonnements Stripe :');
  for (const ref of refs) {
    let sub;
    try { sub = await stripe(`/subscriptions/${encodeURIComponent(ref)}`); } catch (e) {
      sortir(`Stripe ne lit pas l'abonnement …${ref.slice(-6)} (${e.message}). Rien n'a été touché.`);
    }
    const fini = sub.status === 'canceled' || sub.status === 'incomplete_expired';
    console.log(`    …${ref.slice(-6)}  ${sub.status}${fini ? ' (déjà terminé)' : '  → résilié tout de suite'}`);
    if (!fini) aResilier.push(ref);
  }
  if (!refs.size) console.log('    aucun');
  console.log('');

  if (!pourDeBon) {
    console.log('  Essai terminé : rien n\'a été modifié.');
    console.log('  Pour de bon : npm run saison1:remise');
    await db.end();
    return;
  }

  /* ------------------------------------------------- 4. la confirmation */
  const reponse = await demander('  Tape SAISON 1 pour lancer (autre chose annule) : ');
  if (reponse.trim().toUpperCase() !== 'SAISON 1') sortir('Annulé. Rien n\'a été touché.');

  /* -------------------------------------------------- 5. la sauvegarde */
  const dossier = process.env.TBF_SAUVEGARDES || path.join(os.homedir(), 'sauvegardes');
  mkdirSync(dossier, { recursive: true });
  const horo = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const fichier = path.join(dossier, `tbf-avant-saison1-${horo}.sql.gz`);
  console.log(`  Sauvegarde dans ${fichier} …`);
  await sauvegarder(url, fichier);
  const taille = statSync(fichier).size;
  const fin = gunzipSync(readFileSync(fichier)).toString('utf8').slice(-400);
  if (!fin.includes('Dump completed')) sortir('La sauvegarde est incomplète. Rien n\'a été touché.');
  console.log(`  Sauvegarde faite (${(taille / 1024 / 1024).toFixed(1)} Mo).`);

  /* ------------------------------------------------------- 6. Stripe */
  for (const ref of aResilier) {
    try {
      await stripe(`/subscriptions/${encodeURIComponent(ref)}`, 'DELETE');
      console.log(`  Stripe : abonnement …${ref.slice(-6)} résilié.`);
    } catch (e) {
      sortir(`Stripe refuse de résilier …${ref.slice(-6)} (${e.message}). La base n'a pas été touchée ; `
        + 'relance le script une fois le souci réglé.');
    }
  }

  /* ---------------------------------------------- 7. la base, d'un bloc */
  await q('START TRANSACTION');
  try {
    /* Les clés étrangères coupées le temps de vider : l'ordre des DELETE
       n'a plus d'importance, et le contrôle des orphelins, après, vérifie
       qu'aucune ligne ne pointe plus nulle part. */
    await q('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of VIDER) if (presentes.has(t)) await q(`DELETE FROM \`${t}\``);
    await q(`DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users WHERE role = 'admin')`);
    await q(`DELETE FROM users WHERE role <> 'admin'`);
    // Le club de cœur se rechoisit au paquet de bienvenue, avec les clubs suivis.
    await q(`UPDATE users SET main_team_id = NULL`);
    await q('SET FOREIGN_KEY_CHECKS = 1');

    await q(`UPDATE saisons SET lancee_a = NOW(3), ouvre_le = CURDATE(), fin_le = ? WHERE id = ?`,
      [FIN_S1, s1[0].id]);
    for (let i = 0; i < suivantes.length; i++) {
      await q(`UPDATE saisons SET ouvre_le = ?, fin_le = ? WHERE id = ?`,
        [plan[i].ouvre_le, plan[i].fin_le, suivantes[i].id]);
    }

    const orphelins = await q(
      `SELECT table_name AS t, column_name AS c, referenced_table_name AS rt,
              referenced_column_name AS rc
         FROM information_schema.key_column_usage
        WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL`);
    for (const o of orphelins) {
      const t = o.t ?? o.TABLE_NAME; const c = o.c ?? o.COLUMN_NAME;
      const rt = o.rt ?? o.REFERENCED_TABLE_NAME; const rc = o.rc ?? o.REFERENCED_COLUMN_NAME;
      const [n] = await q(
        `SELECT COUNT(*) AS n FROM \`${t}\` x
          WHERE x.\`${c}\` IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM \`${rt}\` y WHERE y.\`${rc}\` = x.\`${c}\`)`);
      if (Number(n.n)) throw new Error(`${n.n} ligne(s) orpheline(s) dans ${t}.${c}`);
    }
    await q('COMMIT');
  } catch (e) {
    await q('ROLLBACK').catch(() => {});
    await q('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    sortir(`La base a été remise comme avant (${e.message}). La sauvegarde reste dans ${fichier}.`);
  }

  const [reste] = await q(`SELECT COUNT(*) AS n FROM users`);
  console.log('');
  console.log(`  Fait. ${reste.n} compte(s) admin gardé(s), tout le reste est vide.`);
  console.log(`  Saison 1 lancée, dernier jour ${FIN_S1}.`);
  console.log(`  Sauvegarde : ${fichier}`);
  console.log('  Redémarre maintenant le site dans l\'onglet Node.js du Manager.');
  await db.end();
}

/* ============================================================ les outils */

function sortir(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function demander(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    process.stdout.write(question);
    let fait = false;
    rl.once('line', (l) => { fait = true; rl.close(); resolve(l); });
    rl.once('close', () => { if (!fait) resolve(''); });
  });
}

/** mysqldump de toute la base, compressé. Le mot de passe passe par MYSQL_PWD, jamais par la ligne de commande. */
function sauvegarder(url, fichier) {
  const u = new URL(url);
  const argsDump = ['--single-transaction', '--routines', '--triggers', '--no-tablespaces',
    '--default-character-set=utf8mb4', '-h', u.hostname, '-P', u.port || '3306',
    '-u', decodeURIComponent(u.username), u.pathname.replace(/^\//, '')];
  return new Promise((resolve, reject) => {
    const p = spawn('mysqldump', argsDump, {
      env: { ...process.env, MYSQL_PWD: decodeURIComponent(u.password) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', () => sortir('mysqldump est introuvable : sans sauvegarde, rien n\'est touché.'));
    const sortie = createWriteStream(fichier);
    p.stdout.pipe(createGzip()).pipe(sortie);
    let code = null; let ecrit = false;
    const fini = () => {
      if (code === null || !ecrit) return;
      if (code !== 0) sortir(`mysqldump a échoué (${err.trim() || code}). Rien n'a été touché.`);
      resolve();
    };
    p.on('close', (c) => { code = c; fini(); });
    sortie.on('finish', () => { ecrit = true; fini(); });
    sortie.on('error', reject);
  });
}
