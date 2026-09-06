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

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
const ORIGIN_LOCAL = 'http://localhost';
let failures = 0;

const check = (label, cond) => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}`);
  if (!cond) failures++;
};

/* ---------------------------------------------------------- préparation */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
await raw.query(readFileSync(new URL('../sql/auth.sql', import.meta.url), 'utf8'));
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 8, charset: 'utf8mb4' });

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

/* --------------------------------------------------- vie privée en base */

const [rows] = await pool.query(`SELECT email, pseudo, password_hash FROM users WHERE status = 'deleted'`);
check('adresse neutralisée en base', rows[0]?.email?.endsWith('@invalid'));
check('hachage effacé en base', rows[0]?.password_hash === '');

const [sess] = await pool.query('SELECT token_hash FROM sessions LIMIT 1');
check('aucun jeton de session en clair en base',
  sess.length === 0 || /^[0-9a-f]{64}$/.test(sess[0].token_hash));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end();
http.close();
process.exit(failures ? 1 : 0);
