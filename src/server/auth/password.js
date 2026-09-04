import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/**
 * Paramètres scrypt. N=16384, r=8, p=1 occupe environ 16 Mo et prend ~60 ms
 * par vérification : assez lent pour décourager une attaque hors ligne, assez
 * rapide pour ne pas saturer un hébergement mutualisé sous plusieurs connexions
 * simultanées.
 *
 * Pourquoi scrypt et pas argon2id : argon2 demande une compilation native ou
 * des binaires précompilés, ce qui est fragile sur un hébergement mutualisé où
 * l'on ne maîtrise ni le compilateur ni la libc. scrypt est intégré à Node,
 * sans aucune dépendance, et reste une fonction à coût mémoire reconnue.
 * Le format ci-dessous porte son nom en préfixe : on pourra migrer vers
 * argon2id plus tard en réhachant à la volée à la connexion.
 */
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(plain) {
  const salt = randomBytes(16);
  const key = await scryptAsync(plain.normalize('NFKC'), salt, PARAMS.keylen, PARAMS);
  return [
    'scrypt', PARAMS.N, PARAMS.r, PARAMS.p,
    salt.toString('base64'), key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(plain, stored) {
  try {
    const [algo, N, r, p, saltB64, keyB64] = String(stored).split('$');
    if (algo !== 'scrypt') return false;

    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    const actual = await scryptAsync(plain.normalize('NFKC'), salt, expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Vrai si le hachage a été produit avec des paramètres plus faibles qu'aujourd'hui. */
export function needsRehash(stored) {
  const [algo, N, r, p] = String(stored).split('$');
  return algo !== 'scrypt' || Number(N) < PARAMS.N || Number(r) < PARAMS.r || Number(p) < PARAMS.p;
}

/**
 * Consomme le même temps qu'une vraie vérification.
 * Sans ça, une réponse instantanée trahirait qu'aucun compte ne porte cette
 * adresse, et permettrait d'énumérer les inscrits.
 */
export async function fakeVerify() {
  await scryptAsync('mot-de-passe-factice', randomBytes(16), PARAMS.keylen, PARAMS);
  return false;
}
