import { randomUUID } from 'node:crypto';
import { hashToken, randomToken } from './tokens.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours
export const SESSION_REFRESH_MS = 24 * 60 * 60 * 1000;  // prolongée au plus 1×/jour
export const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 20;

const asDate = (ms) => new Date(Date.now() + ms);

export function createStore(pool) {
  const q = async (sql, params) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  return {
    /* ------------------------------------------------------------ users */

    async findByEmail(email) {
      const rows = await q(
        `SELECT * FROM users WHERE email = ? AND status <> 'deleted' LIMIT 1`,
        [email],
      );
      return rows[0] ?? null;
    },

    async findByPublicId(publicId) {
      const rows = await q(
        `SELECT * FROM users WHERE public_id = ? AND status <> 'deleted' LIMIT 1`,
        [publicId],
      );
      return rows[0] ?? null;
    },

    async pseudoTaken(pseudo) {
      const rows = await q(`SELECT id FROM users WHERE pseudo = ? LIMIT 1`, [pseudo]);
      return rows.length > 0;
    },

    async createUser({ email, pseudo, passwordHash, locale }) {
      const publicId = randomUUID();
      const res = await q(
        `INSERT INTO users (public_id, email, pseudo, password_hash, locale)
         VALUES (?, ?, ?, ?, ?)`,
        [publicId, email, pseudo, passwordHash, locale],
      );
      return { id: res.insertId, publicId };
    },

    async setPassword(userId, passwordHash) {
      await q(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId]);
    },

    async markVerified(userId) {
      await q(`UPDATE users SET email_verified_at = NOW(3) WHERE id = ?`, [userId]);
    },

    async touchLogin(userId) {
      await q(`UPDATE users SET last_login_at = NOW(3) WHERE id = ?`, [userId]);
    },

    async updateProfile(userId, { locale, mainTeamId }) {
      await q(
        `UPDATE users SET locale = COALESCE(?, locale), main_team_id = COALESCE(?, main_team_id)
         WHERE id = ?`,
        [locale ?? null, mainTeamId ?? null, userId],
      );
    },

    /**
     * Suppression RGPD. L'adresse et le pseudo sont neutralisés pour libérer
     * les contraintes d'unicité, la ligne est conservée pour ne pas casser
     * l'historique des duels déjà joués.
     */
    async deleteUser(userId) {
      await q(
        `UPDATE users
            SET status = 'deleted',
                email = CONCAT('supprime+', id, '@invalid'),
                pseudo = CONCAT('supprime_', id),
                password_hash = '',
                main_team_id = NULL
          WHERE id = ?`,
        [userId],
      );
      await q(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
      await q(`DELETE FROM auth_tokens WHERE user_id = ?`, [userId]);
    },

    /* --------------------------------------------------------- sessions */

    async createSession(userId, { ip, userAgent }) {
      const token = randomToken();
      await q(
        `INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [hashToken(token), userId, asDate(SESSION_TTL_MS), ip ?? null, (userAgent ?? '').slice(0, 255)],
      );
      return token;
    },

    async findSession(token) {
      const rows = await q(
        `SELECT s.token_hash, s.user_id, s.expires_at, s.last_seen_at,
                u.public_id, u.pseudo, u.email, u.locale, u.status,
                u.email_verified_at, u.main_team_id
           FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ? AND s.expires_at > NOW(3) AND u.status = 'active'
          LIMIT 1`,
        [hashToken(token)],
      );
      return rows[0] ?? null;
    },

    async refreshSession(tokenHash) {
      await q(
        `UPDATE sessions SET last_seen_at = NOW(3), expires_at = ?
          WHERE token_hash = ?`,
        [asDate(SESSION_TTL_MS), tokenHash],
      );
    },

    async destroySession(token) {
      await q(`DELETE FROM sessions WHERE token_hash = ?`, [hashToken(token)]);
    },

    /** Après changement de mot de passe : toutes les autres sessions tombent. */
    async destroyAllSessions(userId) {
      await q(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
    },

    /* ----------------------------------------------------------- jetons */

    async issueToken(userId, purpose, ttlMs) {
      // Un seul jeton valide à la fois par usage.
      await q(`DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?`, [userId, purpose]);
      const token = randomToken();
      await q(
        `INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)`,
        [hashToken(token), userId, purpose, asDate(ttlMs)],
      );
      return token;
    },

    /** Lit un jeton sans le consommer : sert à valider la saisie avant de le brûler. */
    async peekToken(token, purpose) {
      const rows = await q(
        `SELECT t.user_id, u.email, u.pseudo, u.locale
           FROM auth_tokens t JOIN users u ON u.id = t.user_id
          WHERE t.token_hash = ? AND t.purpose = ?
            AND t.used_at IS NULL AND t.expires_at > NOW(3)
          LIMIT 1`,
        [hashToken(token), purpose],
      );
      return rows[0] ?? null;
    },

    async consumeToken(token, purpose) {
      const hash = hashToken(token);
      const rows = await q(
        `SELECT t.user_id, u.email, u.pseudo, u.locale
           FROM auth_tokens t JOIN users u ON u.id = t.user_id
          WHERE t.token_hash = ? AND t.purpose = ?
            AND t.used_at IS NULL AND t.expires_at > NOW(3)
          LIMIT 1`,
        [hash, purpose],
      );
      if (!rows[0]) return null;
      await q(`UPDATE auth_tokens SET used_at = NOW(3) WHERE token_hash = ?`, [hash]);
      return rows[0];
    },

    /* ------------------------------------------------------- tentatives */

    async recordAttempt(keyType, keyValue, success) {
      await q(
        `INSERT INTO login_attempts (key_type, key_value, success) VALUES (?, ?, ?)`,
        [keyType, String(keyValue).slice(0, 190), success ? 1 : 0],
      );
    },

    async isThrottled(email, ip) {
      const rows = await q(
        `SELECT key_type, COUNT(*) AS n
           FROM login_attempts
          WHERE success = 0 AND at > (NOW(3) - INTERVAL ? SECOND)
            AND ((key_type = 'email' AND key_value = ?) OR (key_type = 'ip' AND key_value = ?))
          GROUP BY key_type`,
        [Math.floor(ATTEMPT_WINDOW_MS / 1000), email ?? '', ip ?? ''],
      );
      for (const r of rows) {
        if (r.key_type === 'email' && r.n >= MAX_FAILS_PER_EMAIL) return true;
        if (r.key_type === 'ip' && r.n >= MAX_FAILS_PER_IP) return true;
      }
      return false;
    },

    async clearAttempts(email, ip) {
      await q(
        `DELETE FROM login_attempts WHERE key_value IN (?, ?)`,
        [email ?? '', ip ?? ''],
      );
    },

    /* ------------------------------------------------------- entretien */

    /** À lancer une fois par jour : purge des sessions, jetons et tentatives périmés. */
    async cleanup() {
      await q(`DELETE FROM sessions WHERE expires_at < NOW(3)`);
      await q(`DELETE FROM auth_tokens WHERE expires_at < NOW(3)`);
      await q(`DELETE FROM login_attempts WHERE at < (NOW(3) - INTERVAL 1 DAY)`);
    },
  };
}
