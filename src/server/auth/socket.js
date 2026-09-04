import { parseCookies, readTicket } from './tokens.js';
import { COOKIE } from './routes.js';

/**
 * Fournit la fonction `authenticate` attendue par attachDuelServer.
 *
 * Deux chemins, dans cet ordre :
 *  1. le cookie de session, envoyé automatiquement puisque le socket part du
 *     même domaine — c'est le cas normal ;
 *  2. un ticket signé de courte durée, obtenu via POST /api/auth/socket-ticket,
 *     pour les cas où le cookie n'est pas disponible (application mobile
 *     future, navigateur restrictif).
 *
 * Sans identité vérifiée, la connexion est refusée : c'est ce qui empêche un
 * joueur de reprendre le duel d'un autre en se déclarant sous son identifiant.
 */
export function createSocketAuthenticator({ store, sessionSecret }) {
  return async function authenticate(token, socket) {
    try {
      const cookieToken = parseCookies(socket.handshake.headers?.cookie)[COOKIE];
      if (cookieToken) {
        const s = await store.findSession(cookieToken);
        if (s) return { userId: s.public_id, name: s.pseudo };
      }

      if (token) {
        const t = readTicket(sessionSecret, token);
        if (t) {
          // Le ticket est signé, mais le compte a pu être supprimé entre-temps.
          const user = await store.findByPublicId(t.userId);
          if (user) return { userId: user.public_id, name: user.pseudo };
        }
      }
      return null;
    } catch (e) {
      console.error('[auth] socket', e.message);
      return null;
    }
  };
}
