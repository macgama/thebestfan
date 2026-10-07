/**
 * Test de bout en bout de l'authentification.
 * Monte un vrai serveur Express sur une vraie base MariaDB et déroule les
 * parcours réels : inscription, connexion, blocage par force brute,
 * vérification d'adresse, mot de passe oublié, suppression de compte.
 *
 *   DATABASE_URL=mysql://user:pass@host:3306/base node scripts/auth-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createAuth } from '../src/server/auth/routes.js';
import { createSocketAuthenticator } from '../src/server/auth/socket.js';
import { readTicket } from '../src/server/auth/tokens.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const ORIGIN_LOCAL = 'http://localhost';
let failures = 0;

const check = (label, cond) => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}`);
  if (!cond) failures++;
};

/* ---------------------------------------------------------- préparation */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS pronostics, recompenses, missions_jour, compteurs_jour, user_nouveautes,
  parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
/* Au-delà d'auth.sql, ce que la suppression d'un compte doit vider : les
   tables du quotidien et les colonnes qu'il pose sur la bourse. `admin.sql`
   pour `reglages`, que `saisons.sql` lit ; `saisons.sql` parce que
   `quotidien.sql` complète sa table. `arenes.sql` (vague 2) pour la
   préférence de présence, qui part elle aussi avec le compte. */
for (const f of ['auth', 'admin', 'souvenirs', 'saisons', 'quotidien', 'arenes']) {
  await raw.query(readFileSync(new URL(`../sql/${f}.sql`, import.meta.url), 'utf8'));
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 8, ...OPTIONS_BASE });

// Faux expéditeur : on capture les jetons au lieu de les envoyer.
const sent = [];
const mailer = {
  async sendVerification(m) { sent.push({ kind: 'verify', ...m }); return { delivered: true }; },
  async sendReset(m) { sent.push({ kind: 'reset', ...m }); return { delivered: true }; },
  async sendPasswordChanged(m) { sent.push({ kind: 'changed', ...m }); return { delivered: true }; },
};

const auth = createAuth({
  pool, mailer, origin: ORIGIN_LOCAL, sessionSecret: 'secret-de-test-uniquement',
});

const app = express();
app.set('trust proxy', true);
app.use(auth.attachUser);
app.use('/api/auth', auth.router);

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* -------------------------------------------------------------- client */

function client() {
  let cookie = null;
  return {
    get cookie() { return cookie; },
    async call(path, { method = 'POST', body, origin = ORIGIN_LOCAL, headers = {} } = {}) {
      const res = await fetch(base + path, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(origin ? { origin } : {}),
          ...(cookie ? { cookie } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const set = res.headers.getSetCookie?.() ?? [];
      for (const c of set) {
        const [pair] = c.split(';');
        if (pair.startsWith('tbf_session=')) {
          cookie = pair.endsWith('=') ? null : pair;
        }
      }
      let json = null;
      try { json = await res.json(); } catch { /* corps vide */ }
      return { status: res.status, json, setCookie: set };
    },
  };
}

const alice = client();

/* ------------------------------------------------------------- parcours */

let r = await alice.call('/api/auth/register', {
  body: { email: 'Alice@Exemple.fr', pseudo: 'BrigadeNord', password: 'virage-nord-1987', locale: 'fr' },
});
check('inscription acceptée', r.status === 201 && r.json.user.pseudo === 'BrigadeNord');
check('adresse normalisée en minuscules', r.json?.user?.email === 'alice@exemple.fr');
check('compte non vérifié à la création', r.json?.user?.verified === false);
check('cookie de session posé', Boolean(alice.cookie));
check('cookie httpOnly et SameSite', r.setCookie[0].includes('HttpOnly') && /SameSite=Lax/i.test(r.setCookie[0]));
check('mail de vérification envoyé', sent.at(-1)?.kind === 'verify');

r = await alice.call('/api/auth/me', { method: 'GET' });
check('session utilisable aussitôt', r.status === 200 && r.json.user.pseudo === 'BrigadeNord');

// Le mot de passe ne doit jamais ressortir, même haché.
check('aucun hachage exposé au client', !JSON.stringify(r.json).includes('scrypt'));

r = await alice.call('/api/auth/register', {
  body: { email: 'alice@exemple.fr', pseudo: 'Autre', password: 'un-mot-de-passe-long' },
});
check('adresse déjà prise refusée', r.status === 409 && r.json.error === 'auth.error.email_taken');

r = await alice.call('/api/auth/register', {
  body: { email: 'bob@exemple.fr', pseudo: 'BrigadeNord', password: 'un-mot-de-passe-long' },
});
check('pseudo déjà pris refusé', r.status === 409 && r.json.error === 'auth.error.pseudo_taken');

r = await alice.call('/api/auth/register', {
  body: { email: 'court@exemple.fr', pseudo: 'Court', password: 'court' },
});
check('mot de passe trop court refusé', r.status === 400 && r.json.error === 'auth.error.password_short');

r = await alice.call('/api/auth/register', {
  body: { email: 'pasunmail', pseudo: 'Test', password: 'un-mot-de-passe-long' },
});
check('adresse invalide refusée', r.status === 400 && r.json.error === 'auth.error.email_invalid');

r = await alice.call('/api/auth/register', {
  body: { email: 'x@exemple.fr', pseudo: 'a', password: 'un-mot-de-passe-long' },
});
check('pseudo trop court refusé', r.status === 400 && r.json.error === 'auth.error.pseudo_invalid');

/* --------------------------------------------------- vérification mail */

const verifyToken = sent.find((m) => m.kind === 'verify').token;
r = await alice.call('/api/auth/verify', { body: { token: 'jeton-bidon' } });
check('jeton de vérification invalide refusé', r.status === 400);

r = await alice.call('/api/auth/verify', { body: { token: verifyToken } });
check('vérification acceptée', r.status === 200);

r = await alice.call('/api/auth/verify', { body: { token: verifyToken } });
check('jeton non rejouable', r.status === 400);

r = await alice.call('/api/auth/me', { method: 'GET' });
check('compte marqué vérifié', r.json.user.verified === true);

/* ------------------------------------------------------------- CSRF */

r = await alice.call('/api/auth/logout', { origin: 'https://site-malveillant.example' });
check('origine étrangère refusée', r.status === 403 && r.json.error === 'auth.error.bad_origin');

/* --------------------------------------------------------- connexion */

r = await alice.call('/api/auth/logout', {});
check('déconnexion', r.status === 200);

r = await alice.call('/api/auth/me', { method: 'GET' });
check('session fermée après déconnexion', r.status === 401);

r = await alice.call('/api/auth/login', {
  body: { email: 'alice@exemple.fr', password: 'mauvais-mot-de-passe' },
});
check('mauvais mot de passe refusé', r.status === 401 && r.json.error === 'auth.error.bad_credentials');

const t0 = Date.now();
r = await alice.call('/api/auth/login', {
  body: { email: 'inconnu@exemple.fr', password: 'mauvais-mot-de-passe' },
});
const dtUnknown = Date.now() - t0;
check('compte inconnu et mauvais mot de passe : même réponse',
  r.status === 401 && r.json.error === 'auth.error.bad_credentials');
check('pas de réponse instantanée qui trahirait un compte inexistant', dtUnknown > 20);

r = await alice.call('/api/auth/login', {
  body: { email: 'alice@exemple.fr', password: 'virage-nord-1987' },
});
check('connexion réussie', r.status === 200 && r.json.user.pseudo === 'BrigadeNord');

/* --------------------------------------------------- force brute */

const attaquant = client();
let blocked = false;
for (let i = 0; i < 8; i++) {
  const a = await attaquant.call('/api/auth/login', {
    body: { email: 'alice@exemple.fr', password: `essai-${i}` },
  });
  if (a.status === 429) { blocked = true; break; }
}
check('blocage après plusieurs échecs', blocked);

r = await attaquant.call('/api/auth/login', {
  body: { email: 'alice@exemple.fr', password: 'virage-nord-1987' },
});
check('bon mot de passe refusé pendant le blocage', r.status === 429);

// Le blocage vise bien le compte : on simule la fin de la fenêtre de 15 minutes
// pour poursuivre le test, au lieu d'attendre réellement.
await pool.query('DELETE FROM login_attempts');

/* --------------------------------------------- mot de passe oublié */

sent.length = 0;
const t1 = Date.now();
r = await alice.call('/api/auth/forgot', { body: { email: 'personne@exemple.fr' } });
const dtNone = Date.now() - t1;
check('adresse inconnue : réponse neutre', r.status === 200 && r.json.ok === true);
check('aucun mail envoyé pour une adresse inconnue', sent.length === 0);

r = await alice.call('/api/auth/forgot', { body: { email: 'alice@exemple.fr' } });
check('adresse connue : même réponse neutre', r.status === 200 && r.json.ok === true);
check('mail de réinitialisation envoyé', sent.at(-1)?.kind === 'reset');

const resetToken = sent.find((m) => m.kind === 'reset').token;
r = await alice.call('/api/auth/reset', { body: { token: resetToken, password: 'court' } });
check('mot de passe faible refusé à la réinitialisation', r.status === 400);

r = await alice.call('/api/auth/reset', {
  body: { token: resetToken, password: 'nouveau-mot-de-passe-2026' },
});
check('réinitialisation acceptée', r.status === 200);
check('avertissement de changement envoyé', sent.at(-1)?.kind === 'changed');

r = await alice.call('/api/auth/me', { method: 'GET' });
check('sessions fermées après changement de mot de passe', r.status === 401);

r = await alice.call('/api/auth/reset', {
  body: { token: resetToken, password: 'encore-un-autre-mdp' },
});
check('jeton de réinitialisation non rejouable', r.status === 400);

r = await alice.call('/api/auth/login', {
  body: { email: 'alice@exemple.fr', password: 'virage-nord-1987' },
});
check('ancien mot de passe invalidé', r.status === 401);

r = await alice.call('/api/auth/login', {
  body: { email: 'alice@exemple.fr', password: 'nouveau-mot-de-passe-2026' },
});
check('connexion avec le nouveau mot de passe', r.status === 200);

/* ------------------------------------------------------ socket.io */

r = await alice.call('/api/auth/socket-ticket', {});
const ticket = r.json?.ticket;
check('ticket délivré', typeof ticket === 'string');
const parsed = readTicket('secret-de-test-uniquement', ticket);
check('ticket lisible et signé', parsed?.name === 'BrigadeNord');
check('ticket rejeté avec une autre clé', readTicket('mauvaise-cle', ticket) === null);

const authenticate = createSocketAuthenticator({ store: auth.store, sessionSecret: 'secret-de-test-uniquement' });
const viaCookie = await authenticate(null, { handshake: { headers: { cookie: alice.cookie } } });
check('handshake accepté via le cookie', viaCookie?.name === 'BrigadeNord');

const viaTicket = await authenticate(ticket, { handshake: { headers: {} } });
check('handshake accepté via le ticket', viaTicket?.name === 'BrigadeNord');

const viaRien = await authenticate('jeton-invente', { handshake: { headers: {} } });
check('handshake refusé sans identité valable', viaRien === null);

/* ------------------------------------------------ suppression compte */

/* Ce que le quotidien garde d'un joueur, semé comme le serveur l'écrit :
   sous son **identifiant public**, jours et instants en SQL. La route de
   suppression, elle, passe l'identifiant **interne** (`users.id`) : c'est
   tout le piège, et c'est pourquoi on passe par elle et non par
   `deleteUser` appelé à la main avec le bon identifiant.

   Un témoin, Bob, reçoit les mêmes lignes : la suppression d'Alice ne doit
   rien emporter d'autre. */
const [[{ public_id: ALICE }]] = await pool.query(
  `SELECT public_id FROM users WHERE email = 'alice@exemple.fr'`);
const BOB = '00000000-0000-4000-8000-00000000b0b0';
await pool.query(`INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
  [BOB, 'bob-temoin@exemple.fr', 'TemoinBob']);
for (const qui of [ALICE, BOB]) {
  /* `presence = 0` : l'un et l'autre ont choisi d'apparaître hors ligne
     (`CONTRATS.md`, § 18.2). C'est un choix qui décrit une personne. */
  await pool.query(`INSERT INTO user_wallet (user_id, packs, packs_at, rangs_vus, visite_a, instantane, presence)
    VALUES (?, 3, ?, JSON_OBJECT('ref', JSON_OBJECT('jour', '2026-10-01')), NOW(3), JSON_OBJECT('k', 1), 0)`,
  [qui, new Date()]);
  await pool.query(`INSERT INTO missions_jour (user_id, jour, rang, mission, cible, echarpes, xp, tampons)
    VALUES (?, CURDATE(), 0, 'boosters', 3, 30, 20, 1), (?, CURDATE(), 3, 'sachet', 3, 0, 0, 1)`, [qui, qui]);
  await pool.query(`INSERT INTO compteurs_jour (user_id, jour, cle, n) VALUES (?, CURDATE(), 'booster', 2)`,
    [qui]);
  await pool.query(`INSERT INTO user_nouveautes (user_id, cle, sorte) VALUES (?, 'fanzzy:RP4', 'fanzzy')`,
    [qui]);
  await pool.query(`INSERT INTO recompenses (user_id, source, cle, echarpes, xp, tampons)
    VALUES (?, 'mission', DATE_FORMAT(CURDATE(), '%Y-%m-%d:0'), 30, 20, 1)`, [qui]);
}
const lignesDe = async (qui) => {
  const compte = async (t) => Number((await pool.query(
    `SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`, [qui]))[0][0].n);
  const [[w]] = await pool.query(
    'SELECT rangs_vus, visite_a, instantane, presence FROM user_wallet WHERE user_id = ?', [qui]);
  return {
    nouveautes: await compte('user_nouveautes'),
    missions: await compte('missions_jour'),
    compteurs: await compte('compteurs_jour'),
    grandLivre: await compte('recompenses'),
    bourse: w ? [w.rangs_vus, w.visite_a, w.instantane].filter((x) => x !== null).length : -1,
    // Le choix de présence : 0 (caché), 1 (visible), null (le défaut du registre).
    presence: w ? w.presence : 'sans bourse',
  };
};
const avantSuppression = await lignesDe(ALICE);
check('les lignes du quotidien d’Alice et son choix de présence sont bien semés avant la suppression',
  JSON.stringify(avantSuppression)
    === JSON.stringify({ nouveautes: 1, missions: 2, compteurs: 1, grandLivre: 1, bourse: 3, presence: 0 })
  || (console.log('        semées :', JSON.stringify(avantSuppression)), false));

r = await alice.call('/api/auth/me', { method: 'DELETE', body: { password: 'mauvais' } });
check('suppression refusée sans le bon mot de passe', r.status === 403);

r = await alice.call('/api/auth/me', { method: 'DELETE', body: { password: 'nouveau-mot-de-passe-2026' } });
check('suppression acceptée', r.status === 200);

r = await alice.call('/api/auth/login', {
  body: { email: 'alice@exemple.fr', password: 'nouveau-mot-de-passe-2026' },
});
check('compte supprimé : connexion impossible', r.status === 401);

const apresSuppression = await authenticate(ticket, { handshake: { headers: {} } });
check('ticket inutilisable après suppression du compte', apresSuppression === null);

/* ================ ce que la politique de confidentialité affirme, vérifié ici

   `PRIVACITE.md` écrit que la suppression **efface les données personnelles** et
   conserve les parties, anonymes, parce que les effacer réécrirait les soirées
   des adversaires. Une politique de confidentialité qui décrit un comportement
   que rien ne vérifie est une promesse, pas une garantie — et c'est le genre de
   promesse qu'on vient nous demander de prouver.

   Ces contrôles sont donc la contrepartie du document : si quelqu'un change
   `deleteUser`, c'est ici que ça rougit, et le document redevient vrai ou faux
   au même moment. */
{
  const [[ligne]] = await pool.query(
    `SELECT id, email, pseudo, password_hash, main_team_id, status FROM users
      WHERE email LIKE 'supprime+%' ORDER BY id DESC LIMIT 1`);

  check('l’adresse est effacée', !String(ligne.email).includes('alice@exemple.fr')
    || (console.log('        elle dit :', ligne.email), false));
  check('le pseudo aussi', !String(ligne.pseudo).toLowerCase().includes('alice')
    || (console.log('        il dit :', ligne.pseudo), false));
  /* Le mot de passe part, et c'est ce qui rend la reconnexion impossible même
     si quelqu'un devinait l'adresse de remplacement. */
  check('le mot de passe ne vaut plus rien', ligne.password_hash === '');
  check('le club suivi est oublié', ligne.main_team_id === null);
  check('et le compte est marqué supprimé', ligne.status === 'deleted');

  /* **La ligne reste**, et c'est délibéré : elle porte l'identifiant public que
     les parties déjà jouées référencent. La retirer casserait l'historique des
     adversaires — leurs soirées, pas celles du partant. */
  check('la ligne subsiste, sans rien qui nomme personne', Boolean(ligne));

  const [[sess]] = await pool.query(
    'SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?', [ligne.id]);
  check('plus aucune session ouverte', Number(sess.n) === 0);
  const [[jet]] = await pool.query(
    'SELECT COUNT(*) AS n FROM auth_tokens WHERE user_id = ?', [ligne.id]);
  check('plus aucun jeton en attente', Number(jet.n) === 0);

  /* Le quotidien : `CONFIDENTIALITE.md` promet que l'activité du jour, les
     missions tirées, les nouveautés, la dernière visite et les rangs vus
     partent avec le compte, et que le grand livre reste, anonyme. */
  const apres = await lignesDe(ALICE);
  check('ses nouveautés, ses missions tirées et son activité du jour sont effacées',
    apres.nouveautes === 0 && apres.missions === 0 && apres.compteurs === 0
    || (console.log('        restent :', JSON.stringify(apres)), false));
  check('sa dernière visite, ses rangs vus et l’état des pots sont oubliés', apres.bourse === 0
    || (console.log('        restent :', apres.bourse, 'colonne(s)'), false));
  check('le grand livre garde sa ligne : la trace comptable ne nomme personne', apres.grandLivre === 1);
  /* La présence (`CONFIDENTIALITE.md`, vague 2) : le choix d'apparaître hors
     ligne part avec le compte, remis à NULL — le défaut du registre, comme
     pour qui n'a jamais choisi. */
  check('son choix de présence est oublié (remis à NULL)', apres.presence === null
    || (console.log('        reste :', apres.presence), false));
  check('et rien n’est pris au témoin',
    JSON.stringify(await lignesDe(BOB))
      === JSON.stringify({ nouveautes: 1, missions: 2, compteurs: 1, grandLivre: 1, bourse: 3, presence: 0 }));
}

/* ======== une base sans sql/arenes.sql : la colonne absente n'emporte qu'elle

   Le choix de présence s'efface par **une instruction à lui**. Glissé dans
   celle du quotidien, il la ferait lever sur une base où `arenes.sql` n'est
   pas encore passé — et le repli tolérant avalerait avec lui l'effacement de
   la dernière visite et des rangs vus : la politique de confidentialité
   mentirait sans un mot au journal. On retire la colonne, on supprime un
   compte, on regarde ce qui reste ; puis on la repose. `deleteUser` est
   appelé avec le numéro interne, comme la route le fait. */
{
  const { createStore } = await import('../src/server/auth/store.js');
  const CAROLE = '00000000-0000-4000-8000-0000000ca201';
  const [ins] = await pool.query(
    `INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
    [CAROLE, 'carole-sans-arenes@exemple.fr', 'CaroleSansArenes']);
  await pool.query(`INSERT INTO user_wallet (user_id, packs, packs_at, rangs_vus, visite_a, instantane)
    VALUES (?, 3, ?, JSON_OBJECT('ref', 1), NOW(3), JSON_OBJECT('k', 1))`, [CAROLE, new Date()]);
  await pool.query('ALTER TABLE user_wallet DROP COLUMN presence');
  let leve = null;
  try { await createStore(pool).deleteUser(ins.insertId); } catch (e) { leve = e; }
  const [[w]] = await pool.query(
    'SELECT rangs_vus, visite_a, instantane FROM user_wallet WHERE user_id = ?', [CAROLE]);
  await pool.query(readFileSync(new URL('../sql/arenes.sql', import.meta.url), 'utf8')
    .replace(/--[^\n]*/g, '').split(';').map((s) => s.trim())
    .find((s) => /ADD COLUMN IF NOT EXISTS presence\b/.test(s)));
  check('sans la colonne presence, la suppression passe et oublie quand même la dernière visite',
    !leve && w && w.rangs_vus === null && w.visite_a === null && w.instantane === null
    || (console.log('        lève :', leve?.message ?? 'non', '· reste :', JSON.stringify(w)), false));
}

/* ================ l'entretien : les durées que la page publique annonce

   `public/confidentialite.html` promet « deux jours au plus » pour les
   tentatives de connexion manquées, et la fin d'une session à son terme.
   C'est `cleanup()` qui le tient, au démarrage puis chaque jour (`server.js`,
   que `confidentialite:smoke` relit). Une tentative de plus d'un jour part,
   une récente reste ; une session échue part, une vivante reste. */
{
  const [[u]] = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
  await pool.query(`INSERT INTO login_attempts (key_type, key_value, success, at) VALUES
      ('ip', 'entretien-vieille', 0, NOW(3) - INTERVAL 25 HOUR),
      ('ip', 'entretien-recente', 0, NOW(3) - INTERVAL 23 HOUR)`);
  const [echue, vivante] = ['e', 'f'].map((c) => c.repeat(64));
  await pool.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES
      (?, ?, UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE), (?, ?, UTC_TIMESTAMP(3) + INTERVAL 1 DAY)`,
  [echue, u.id, vivante, u.id]);
  await auth.store.cleanup();
  const [tentatives] = await pool.query(
    `SELECT key_value FROM login_attempts WHERE key_value LIKE 'entretien-%'`);
  const restent = tentatives.map((t) => t.key_value);
  check('l’entretien efface les tentatives manquées de plus d’un jour',
    !restent.includes('entretien-vieille'));
  check('et garde celles du jour', restent.includes('entretien-recente'));
  if (restent.length !== 1) console.log('        restent :', restent.join(', ') || 'aucune');
  const [ouvertes] = await pool.query(
    'SELECT token_hash FROM sessions WHERE token_hash IN (?, ?)', [echue, vivante]);
  const gardees = ouvertes.map((s) => s.token_hash);
  check('il efface les sessions échues', !gardees.includes(echue));
  check('et garde les vivantes', gardees.includes(vivante));
  await pool.query(`DELETE FROM login_attempts WHERE key_value LIKE 'entretien-%'`);
  await pool.query('DELETE FROM sessions WHERE token_hash = ?', [vivante]);
}

/* --------------------------------------------------- vie privée en base */

const [rows] = await pool.query(`SELECT email, pseudo, password_hash FROM users WHERE status = 'deleted'`);
check('adresse neutralisée en base', rows[0]?.email?.endsWith('@invalid'));
check('hachage effacé en base', rows[0]?.password_hash === '');

const [sess] = await pool.query('SELECT token_hash FROM sessions LIMIT 1');
check('aucun jeton de session en clair en base',
  sess.length === 0 || /^[0-9a-f]{64}$/.test(sess[0].token_hash));

/* ================================ ce que /healthz raconte au monde entier

   **Cette sonde est publique.** Pas de session, pas de jeton, pas de réseau
   privé : l'hébergeur doit pouvoir l'appeler, donc tout le monde le peut.

   Le 18 septembre 2026, elle publiait le mot de passe SMTP du domaine. La
   variable `SMTP_URL` avait été écrite sans schéma — `adresse:motdepasse:465`
   au lieu d'une URL — nodemailer avait échoué en citant la valeur reçue, et
   cette valeur était rangée telle quelle dans l'état servi.

   Personne n'avait tort dans cette chaîne : un message d'erreur cite ce qu'on
   lui donne, et une sonde dit pourquoi ça ne marche pas. C'est la **jonction**
   qui était fausse, et elle ne se voit qu'en la regardant de dehors.

   Ces contrôles la regardent de dehors, avec la vraie forme du défaut. */
console.log('\n— ce que la sonde publique laisse voir —');
{
  const { createMailer } = await import('../src/server/auth/mailer.js');

  const SECRET = 'MotDePasseTresSecret_42';
  const m = createMailer({ smtpUrl: `compte@exemple.fr:${SECRET}:465` });

  /* Avant même d'essayer d'envoyer : la forme est reconnue, et elle est dite
     sans citer la valeur. Laisser nodemailer découvrir le défaut, c'est
     échanger un diagnostic clair contre un message obscur. */
  const forme = m.status;
  check('une URL SMTP sans schéma est reconnue comme telle',
    typeof forme.forme === 'string' && /smtps:\/\//.test(forme.forme)
    || (console.log('        il dit :', JSON.stringify(forme)), false));
  check('et le diagnostic ne répète pas la valeur',
    !JSON.stringify(forme).includes(SECRET));

  /* Puis avec la vraie erreur de nodemailer, qui est celle qui a fui. */
  await m.test('personne@exemple.fr').catch(() => {});
  const apres = m.status;
  check('l’erreur du transport est bien remontée',
    typeof apres.erreur === 'string' && apres.erreur.length > 0);
  check('mais le mot de passe n’y est plus',
    !JSON.stringify(apres).includes(SECRET)
    || (console.log('        il publie :', apres.erreur), false));
  check('il est remplacé par une marque lisible',
    /caviardé/.test(apres.erreur));

  /* La forme en URL complète fuit autrement : c'est l'URL entière qui porte le
     secret, et c'est elle que le message cite. */
  const m2 = createMailer({ smtpUrl: `smtps://compte%40exemple.fr:${SECRET}@mail.invalide:465` });
  await m2.test('personne@exemple.fr').catch(() => {});
  check('une URL complète ne fuit pas non plus',
    !JSON.stringify(m2.status).includes(SECRET)
    || (console.log('        il publie :', m2.status.erreur), false));

  /* Et la forme recommandée — quatre variables séparées — dont le mot de passe
     ne traverse jamais une chaîne. C'est le chemin normal, il doit être
     couvert comme les autres. */
  const m3 = createMailer({
    host: 'mail.invalide', port: 465, user: 'compte@exemple.fr', pass: SECRET });
  await m3.test('personne@exemple.fr').catch(() => {});
  check('ni les quatre variables séparées',
    !JSON.stringify(m3.status).includes(SECRET)
    || (console.log('        il publie :', m3.status.erreur), false));
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end();
http.close();
process.exit(failures ? 1 : 0);
