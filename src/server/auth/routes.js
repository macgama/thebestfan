import express from 'express';
import { hashPassword, verifyPassword, needsRehash, fakeVerify } from './password.js';
import { issueTicket, parseCookies } from './tokens.js';
import { createStore, SESSION_TTL_MS, SESSION_REFRESH_MS, VERIFY_TTL_MS, RESET_TTL_MS } from './store.js';

export const COOKIE = 'tbf_session';
const LOCALES = ['fr', 'en', 'de', 'es'];

/* ----------------------------------------------------------- validation */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PSEUDO_RE = /^[\p{L}\p{N}][\p{L}\p{N}_.\- ]{1,18}[\p{L}\p{N}]$/u;

function checkEmail(v) {
  const email = String(v ?? '').trim().toLowerCase();
  if (email.length > 190 || !EMAIL_RE.test(email)) return { error: 'auth.error.email_invalid' };
  return { value: email };
}

function checkPassword(v, { email, pseudo }) {
  const pw = String(v ?? '');
  if (pw.length < 10) return { error: 'auth.error.password_short' };
  if (pw.length > 200) return { error: 'auth.error.password_long' };
  const low = pw.toLowerCase();
  if (email && low === String(email).toLowerCase()) return { error: 'auth.error.password_obvious' };
  if (pseudo && low === String(pseudo).toLowerCase()) return { error: 'auth.error.password_obvious' };
  if (/^(?:1234567890|motdepasse|password|azertyuiop|qwertyuiop)/.test(low)) {
    return { error: 'auth.error.password_obvious' };
  }
  return { value: pw };
}

function checkPseudo(v) {
  const pseudo = String(v ?? '').trim();
  if (!PSEUDO_RE.test(pseudo)) return { error: 'auth.error.pseudo_invalid' };
  return { value: pseudo };
}

const checkLocale = (v) => (LOCALES.includes(v) ? v : 'fr');

/* --------------------------------------------------------------- cookie */

function setSessionCookie(res, token, secure) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

function publicUser(row) {
  return {
    id: row.public_id,
    pseudo: row.pseudo,
    email: row.email,
    locale: row.locale,
    verified: Boolean(row.email_verified_at),
    mainTeamId: row.main_team_id ?? null,
    // Sert à la page profil : « dans la tribune depuis le… »
    createdAt: row.created_at ?? null,
  };
}

const clientIp = (req) =>
  (req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket.remoteAddress ?? '').trim().slice(0, 45);

/* ------------------------------------------------------------- fabrique */

export function createAuth({ pool, mailer, origin, sessionSecret }) {
  const store = createStore(pool);
  const secure = String(origin).startsWith('https://');

  /** Charge la session sur chaque requête, sans jamais échouer. */
  async function attachUser(req, _res, next) {
    try {
      const token = parseCookies(req.headers.cookie)[COOKIE];
      if (!token) return next();
      const s = await store.findSession(token);
      if (!s) return next();

      req.user = publicUser(s);
      req.userId = s.user_id;
      req.sessionToken = token;

      // Prolongation glissante, au plus une fois par jour pour épargner la base.
      if (Date.now() - new Date(s.last_seen_at).getTime() > SESSION_REFRESH_MS) {
        await store.refreshSession(s.token_hash);
      }
    } catch (e) {
      console.error('[auth] session', e.message);
    }
    next();
  }

  function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'auth.error.unauthenticated' });
    next();
  }

  /**
   * Défense CSRF. Le cookie est en SameSite=Lax, ce qui bloque déjà les
   * requêtes inter-sites, mais on refuse explicitement toute écriture dont
   * l'origine ne correspond pas au site.
   */
  function sameOrigin(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const o = req.headers.origin;
    if (o && o !== origin) return res.status(403).json({ error: 'auth.error.bad_origin' });
    next();
  }

  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));
  router.use(sameOrigin);

  /* ------------------------------------------------------- inscription */

  router.post('/register', async (req, res) => {
    const email = checkEmail(req.body?.email);
    if (email.error) return res.status(400).json({ error: email.error });
    const pseudo = checkPseudo(req.body?.pseudo);
    if (pseudo.error) return res.status(400).json({ error: pseudo.error });
    const pw = checkPassword(req.body?.password, { email: email.value, pseudo: pseudo.value });
    if (pw.error) return res.status(400).json({ error: pw.error });
    const locale = checkLocale(req.body?.locale);

    try {
      if (await store.findByEmail(email.value)) {
        return res.status(409).json({ error: 'auth.error.email_taken' });
      }
      if (await store.pseudoTaken(pseudo.value)) {
        return res.status(409).json({ error: 'auth.error.pseudo_taken' });
      }

      const passwordHash = await hashPassword(pw.value);
      const { id } = await store.createUser({
        email: email.value, pseudo: pseudo.value, passwordHash, locale,
      });

      const token = await store.issueToken(id, 'verify_email', VERIFY_TTL_MS);
      await mailer.sendVerification({ to: email.value, pseudo: pseudo.value, locale, token });

      const session = await store.createSession(id, {
        ip: clientIp(req), userAgent: req.headers['user-agent'],
      });
      setSessionCookie(res, session, secure);

      const row = await store.findByEmail(email.value);
      res.status(201).json({ user: publicUser(row) });
    } catch (e) {
      // Course entre deux inscriptions simultanées sur la même adresse.
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'auth.error.email_taken' });
      console.error('[auth] register', e);
      res.status(500).json({ error: 'auth.error.server' });
    }
  });

  /* --------------------------------------------------------- connexion */

  router.post('/login', async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const ip = clientIp(req);

    try {
      if (await store.isThrottled(email, ip)) {
        return res.status(429).json({ error: 'auth.error.too_many_attempts' });
      }

      const user = await store.findByEmail(email);
      // Même coût de calcul qu'un vrai essai, pour ne pas révéler l'existence du compte.
      const ok = user ? await verifyPassword(password, user.password_hash) : await fakeVerify();

      if (!ok) {
        await store.recordAttempt('email', email, false);
        await store.recordAttempt('ip', ip, false);
        return res.status(401).json({ error: 'auth.error.bad_credentials' });
      }
      if (user.status !== 'active') {
        return res.status(403).json({ error: 'auth.error.account_locked' });
      }

      if (needsRehash(user.password_hash)) {
        await store.setPassword(user.id, await hashPassword(password));
      }
      await store.clearAttempts(email, ip);
      await store.touchLogin(user.id);

      const session = await store.createSession(user.id, {
        ip, userAgent: req.headers['user-agent'],
      });
      setSessionCookie(res, session, secure);
      res.json({ user: publicUser(user) });
    } catch (e) {
      console.error('[auth] login', e);
      res.status(500).json({ error: 'auth.error.server' });
    }
  });

  router.post('/logout', async (req, res) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) await store.destroySession(token).catch(() => {});
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  /* ------------------------------------------------------------ compte */

  router.get('/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'auth.error.unauthenticated' });
    res.json({ user: req.user });
  });

  router.patch('/me', requireAuth, async (req, res) => {
    const locale = req.body?.locale === undefined ? null : checkLocale(req.body.locale);
    const team = req.body?.mainTeamId === undefined ? null : Number(req.body.mainTeamId) || null;
    await store.updateProfile(req.userId, { locale, mainTeamId: team });
    const row = await store.findByPublicId(req.user.id);
    res.json({ user: publicUser(row) });
  });

  router.delete('/me', requireAuth, async (req, res) => {
    const row = await store.findByPublicId(req.user.id);
    const ok = await verifyPassword(String(req.body?.password ?? ''), row.password_hash);
    if (!ok) return res.status(403).json({ error: 'auth.error.bad_credentials' });
    await store.deleteUser(req.userId);
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  /* --------------------------------------------- vérification d'adresse */

  router.post('/verify', async (req, res) => {
    const row = await store.consumeToken(String(req.body?.token ?? ''), 'verify_email');
    if (!row) return res.status(400).json({ error: 'auth.error.token_invalid' });
    await store.markVerified(row.user_id);
    res.json({ ok: true });
  });

  router.post('/resend-verification', requireAuth, async (req, res) => {
    if (req.user.verified) return res.json({ ok: true });
    const token = await store.issueToken(req.userId, 'verify_email', VERIFY_TTL_MS);
    await mailer.sendVerification({
      to: req.user.email, pseudo: req.user.pseudo, locale: req.user.locale, token,
    });
    res.json({ ok: true });
  });

  /* --------------------------------------------------- mot de passe oublié */

  router.post('/forgot', async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    try {
      const user = await store.findByEmail(email);
      if (user) {
        const token = await store.issueToken(user.id, 'reset_password', RESET_TTL_MS);
        await mailer.sendReset({
          to: user.email, pseudo: user.pseudo, locale: user.locale, token,
        });
      }
    } catch (e) {
      console.error('[auth] forgot', e);
    }
    // Réponse identique dans tous les cas : sinon on saurait qui est inscrit.
    res.json({ ok: true });
  });

  router.post('/reset', async (req, res) => {
    const token = String(req.body?.token ?? '');

    // On lit d'abord sans consommer : un mot de passe refusé ne doit pas
    // brûler le lien reçu par mail.
    const row = await store.peekToken(token, 'reset_password');
    if (!row) return res.status(400).json({ error: 'auth.error.token_invalid' });

    const pw = checkPassword(req.body?.password, { email: row.email, pseudo: row.pseudo });
    if (pw.error) return res.status(400).json({ error: pw.error });

    // Le jeton n'est brûlé qu'une fois la saisie validée.
    if (!(await store.consumeToken(token, 'reset_password'))) {
      return res.status(400).json({ error: 'auth.error.token_invalid' });
    }

    await store.setPassword(row.user_id, await hashPassword(pw.value));
    await store.destroyAllSessions(row.user_id);
    await store.markVerified(row.user_id); // recevoir le mail prouve l'adresse
    await mailer.sendPasswordChanged({ to: row.email, pseudo: row.pseudo, locale: row.locale });
    res.json({ ok: true });
  });

  /* ------------------------------------------------- ticket socket.io */

  router.post('/socket-ticket', requireAuth, (req, res) => {
    res.json({ ticket: issueTicket(sessionSecret, req.user.id, req.user.pseudo) });
  });

  return { router, store, attachUser, requireAuth, publicUser };
}
