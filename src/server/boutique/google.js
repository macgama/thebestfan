/**
 * Google Play, côté serveur : vérifier un achat fait dans l'appli Android.
 *
 * ## Pourquoi le serveur demande à Google
 *
 * La page reçoit un `purchaseToken` quand le joueur a payé dans la feuille de
 * Google. Ce jeton n'est **pas** une preuve : n'importe qui peut en envoyer
 * un, inventé ou volé. Seule la réponse de la Google Play Developer API fait
 * foi (`purchases.products.get`) : le produit, l'état du paiement, la commande.
 *
 * ## Le compte de service
 *
 * L'API se lit avec un compte de service Google Cloud relié à la Play Console.
 * Sa clé JSON est posée sur le serveur, jamais dans le dépôt :
 *
 *   GOOGLE_PLAY_CLE=/chemin/vers/cle.json   (ou le JSON lui-même)
 *   ANDROID_PAQUET=online.thebestfan.app    (voir src/server/android.js)
 *
 * Sans clé, `configure()` est faux et la route refuse en 503 : rien n'est livré
 * sans vérification.
 *
 * ## Consommer
 *
 * Le PASS est un produit « consommable » côté Google : on le **consomme**
 * après l'avoir livré, sinon Google refuserait d'en vendre un second (le PASS
 * de la saison suivante) et rembourserait d'office un achat non confirmé au
 * bout de trois jours.
 */
import crypto from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { PAQUET_PAR_DEFAUT } from '../android.js';

/** Le produit de la Play Console qui correspond au PASS de saison. */
export const PRODUIT_PASS = 'pass_saison';

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const PORTEE = 'https://www.googleapis.com/auth/androidpublisher';

/** L'empreinte qui sert de clé unique dans `achats.stripe_session`. */
export const referenceGoogle = (jeton) =>
  `google:${crypto.createHash('sha256').update(String(jeton)).digest('hex')}`;

function lireCle(env) {
  const brut = String(env.GOOGLE_PLAY_CLE || '').trim();
  if (!brut) return null;
  try {
    const texte = brut.startsWith('{') ? brut : existsSync(brut) ? readFileSync(brut, 'utf8') : '';
    const cle = JSON.parse(texte);
    return cle.client_email && cle.private_key ? cle : null;
  } catch {
    return null;
  }
}

const b64url = (x) => Buffer.from(x).toString('base64url');

export function createGooglePlay({ env = process.env, fetch: f = globalThis.fetch } = {}) {
  const paquet = () => String(env.ANDROID_PAQUET || PAQUET_PAR_DEFAUT).trim();
  let jeton = null; // { valeur, expire }

  const configure = () => Boolean(lireCle(env));

  /* Un jeton d'accès OAuth, signé avec la clé du compte de service (JWT
     RS256), gardé jusqu'à une minute avant son échéance. */
  async function acces() {
    if (jeton && jeton.expire > Date.now() + 60_000) return jeton.valeur;
    const cle = lireCle(env);
    if (!cle) throw new Error('google.non_configure');
    const maintenant = Math.floor(Date.now() / 1000);
    const corps = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
      iss: cle.client_email, scope: PORTEE, aud: cle.token_uri || 'https://oauth2.googleapis.com/token',
      iat: maintenant, exp: maintenant + 3600,
    }))}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(corps), cle.private_key).toString('base64url');
    const r = await f(cle.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${corps}.${signature}`,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(`google.oauth ${r.status}`);
    jeton = { valeur: j.access_token, expire: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    return jeton.valeur;
  }

  const adresse = (produit, purchaseToken, suite = '') =>
    `${API}/${encodeURIComponent(paquet())}/purchases/products/${encodeURIComponent(produit)}`
    + `/tokens/${encodeURIComponent(purchaseToken)}${suite}`;

  /**
   * L'achat tel que Google le connaît, ou `null` s'il ne le connaît pas.
   * `purchaseState` : 0 payé, 1 annulé, 2 en attente.
   * `consumptionState` : 0 pas encore consommé, 1 consommé.
   */
  async function lireAchat(produit, purchaseToken) {
    const r = await f(adresse(produit, purchaseToken), {
      headers: { authorization: `Bearer ${await acces()}` },
    });
    if (r.status === 404 || r.status === 400 || r.status === 410) return null;
    if (!r.ok) throw new Error(`google.api ${r.status}`);
    return r.json();
  }

  async function consommer(produit, purchaseToken) {
    const r = await f(adresse(produit, purchaseToken, ':consume'), {
      method: 'POST', headers: { authorization: `Bearer ${await acces()}` },
    });
    if (!r.ok) throw new Error(`google.consume ${r.status}`);
  }

  return { configure, lireAchat, consommer, paquet };
}
