import { createHash, randomBytes, randomUUID } from 'node:crypto';
import express from 'express';
import { hashPassword } from './password.js';
import { parseCookies } from './tokens.js';
import { COOKIE } from './routes.js';
import { SESSION_TTL_MS } from './store.js';

/**
 * Connexion avec Google.
 *
 * Flux « code d'autorisation » avec PKCE, sans aucune dépendance : trois
 * appels HTTPS et un peu de rigueur suffisent.
 *
 * Sur la vérification du jeton d'identité : on ne contrôle pas sa signature,
 * et c'est volontairement acceptable ici parce qu'on ne le reçoit pas du
 * navigateur mais directement de l'API de Google, en HTTPS, avec notre secret
 * client. Le jeton n'a donc jamais transité par un tiers. Si un jour on
 * acceptait un jeton envoyé par le client — flux implicite, application
 * mobile — il faudrait vérifier la signature contre les clés publiques de
 * Google, et ce raccourci deviendrait une faille.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ETAT_TTL_MS = 10 * 60 * 1000;

export function createGoogleAuth({ pool, store, origin, clientId, clientSecret }) {
  const actif = Boolean(clientId && clientSecret);
  const redirectUri = `${origin}/api/auth/google/callback`;
  // États en cours, gardés en mémoire : ils ne vivent que le temps d'un
  // aller-retour, et un redémarrage n'oblige qu'à recommencer la connexion.
  const attente = new Map();

  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of attente) if (now > v.expire) attente.delete(k);
  }, 60_000).unref?.();

  const b64url = (b) => b.toString('base64url');

  /** Pseudo libre dérivé du nom Google, sans collision. */
  async function pseudoLibre(base) {
    const propre = String(base || 'Supporter')
      .normalize('NFKD').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 18) || 'Supporter';
    for (let i = 0; i < 40; i++) {
      const essai = i === 0 ? propre : `${propre.slice(0, 15)}${Math.floor(Math.random() * 9999)}`;
      if (essai.length < 3) continue;
      const pris = await q(`SELECT 1 FROM users WHERE pseudo = ? LIMIT 1`, [essai]);
      if (!pris.length) return essai;
    }
    return 'Supporter' + Math.floor(Math.random() * 999999);
  }

  const router = express.Router();

  /** Le client demande si le bouton doit s'afficher. */
  router.get('/google/available', (_req, res) => res.json({ available: actif }));

  router.get('/google/start', (req, res) => {
    if (!actif) return res.status(503).json({ error: 'auth.error.google_disabled' });

    const state = b64url(randomBytes(24));
    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash('sha256').update(verifier).digest());
    attente.set(state, { verifier, expire: Date.now() + ETAT_TTL_MS });

    const url = new URL(AUTH_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('prompt', 'select_account');
    res.redirect(url.toString());
  });

  router.get('/google/callback', async (req, res) => {
    if (!actif) return res.redirect('/compte?erreur=google');
    const { code, state } = req.query;
    const en = attente.get(String(state));
    attente.delete(String(state));

    // Un état inconnu, c'est soit un lien rejoué, soit une tentative de
    // connexion forcée depuis un autre site.
    if (!code || !en) return res.redirect('/compte?erreur=etat');

    try {
      const jetons = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: en.verifier,
        }),
        signal: AbortSignal.timeout(10_000),
      }).then((r) => r.json());

      if (!jetons.id_token) throw new Error(jetons.error ?? 'pas de jeton');

      const charge = JSON.parse(
        Buffer.from(jetons.id_token.split('.')[1], 'base64url').toString());
      const email = String(charge.email ?? '').toLowerCase();
      if (!email || charge.email_verified === false) return res.redirect('/compte?erreur=email');
      if (charge.aud !== clientId) throw new Error('jeton destiné à une autre application');

      let user = await store.findByEmail(email);
      let nouveau = false;

      if (!user) {
        // Compte créé à la volée. Le mot de passe est aléatoire et jamais
        // communiqué : on se connecte par Google, ou par « mot de passe
        // oublié » qui en fixera un.
        const pseudo = await pseudoLibre(charge.given_name ?? charge.name ?? email.split('@')[0]);
        const hash = await hashPassword(randomUUID() + randomUUID());
        await store.createUser({
          email, pseudo, passwordHash: hash,
          locale: ['fr', 'en', 'de', 'es'].includes(String(charge.locale).slice(0, 2))
            ? String(charge.locale).slice(0, 2) : 'fr',
        });
        user = await store.findByEmail(email);
        // Google a déjà vérifié l'adresse : inutile de la faire confirmer.
        await store.markVerified(user.id);
        nouveau = true;
      } else if (!user.email_verified_at) {
        await store.markVerified(user.id);
      }

      await store.touchLogin(user.id);
      const session = await store.createSession(user.id, {
        ip: (req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket.remoteAddress ?? '').trim(),
        userAgent: req.headers['user-agent'],
      });
      res.cookie(COOKIE, session, {
        httpOnly: true, secure: origin.startsWith('https://'),
        sameSite: 'lax', maxAge: SESSION_TTL_MS, path: '/',
      });

      // Un nouveau venu passe par la cérémonie d'arrivée.
      const w = (await q(`SELECT onboarded_at FROM user_wallet WHERE user_id = ?`,
        [user.public_id]))[0];
      res.redirect(nouveau || !w?.onboarded_at ? '/bienvenue' : '/');
    } catch (e) {
      console.error('[google]', e.message);
      res.redirect('/compte?erreur=google');
    }
  });

  return { router, actif };
}
