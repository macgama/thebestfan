import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Jeton opaque de 256 bits, lisible dans une URL. */
export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Seule l'empreinte est stockée en base. Pas de sel ici : le jeton fait déjà
 * 256 bits aléatoires, il n'est pas devinable, et le sel empêcherait la
 * recherche par clé primaire.
 */
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/* ------------------------------------------------------------- tickets */

/**
 * Ticket court pour le handshake socket.io, signé et non stocké.
 * Utile quand le cookie de session ne peut pas être lu (navigateur qui bloque
 * les cookies tiers, client mobile futur). Durée de vie volontairement très
 * courte : il ne sert qu'à ouvrir la connexion, pas à rester connecté.
 */
export function issueTicket(secret, publicId, pseudo, ttlMs = 60_000) {
  const payload = Buffer.from(JSON.stringify({
    u: publicId, n: pseudo, e: Date.now() + ttlMs,
  })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function readTicket(secret, ticket) {
  try {
    const [payload, sig] = String(ticket).split('.');
    if (!payload || !sig) return null;

    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof data.e !== 'number' || Date.now() > data.e) return null;
    return { userId: data.u, name: data.n };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- cookies */

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
