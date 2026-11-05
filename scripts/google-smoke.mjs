/**
 * Le paiement Google de l'appli Android : le serveur ne livre qu'un achat que
 * Google confirme, une seule fois, au seul joueur qui l'a fait, puis le
 * consomme. Google est simulé ; le module d'abonnement aussi (sa propre suite
 * éprouve `accorderPass`).
 */
import express from 'express';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createBoutique } from '../src/server/boutique/index.js';
import { createGooglePlay, PRODUIT_PASS, referenceGoogle } from '../src/server/boutique/google.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
await raw.query(`DROP TABLE IF EXISTS user_pass, parrainages, abonnements, achats, tenues, user_stuff, user_etats,
  user_skins, user_fanzzy, user_souvenirs, user_decks, virage_presence, user_nouveautes, user_wallet, users`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');
/* `reglages` (sql/admin.sql), que boutique.sql met à jour : une autre suite
   peut l'avoir laissée tomber. On la prend telle que le fichier la déclare. */
const REGLAGES = (await readFile('sql/admin.sql', 'utf8'))
  .match(/CREATE TABLE IF NOT EXISTS reglages \([\s\S]*?\)[^;]*;/)?.[0];
if (!REGLAGES) throw new Error('sql/admin.sql ne déclare plus reglages');
await raw.query(REGLAGES);
/* Le même ordre que boutique:smoke : boutique.sql s'appuie sur ce qui précède. */
for (const f of ['auth.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'inventaire.sql',
  'skins.sql', 'etats.sql', 'tenues.sql', 'boutique.sql']) {
  await raw.query(await readFile(`sql/${f}`, 'utf8'));
}
for (const p of ['Un', 'Deux']) {
  await raw.query(`INSERT INTO users (email, pseudo, password_hash, status, public_id)
                   VALUES (?, ?, 'x', 'active', UUID())`, [`${p}@b.c`, p]);
}
const [[u1], [u2]] = (await raw.query('SELECT public_id FROM users ORDER BY id'))[0].map((x) => [x]);
const U = u1.public_id; const V = u2.public_id;
for (const id of [U, V]) await raw.query('INSERT INTO user_wallet (user_id, scarves, packs) VALUES (?,0,0)', [id]);

const pool = mysql.createPool({ uri: DB, ...OPTIONS_BASE });
const q = (s, a) => pool.query(s, a).then(([r]) => r);

/* Google simulé : des achats connus par jeton, et les consommations notées. */
const achats = new Map();
const consommes = [];
const google = {
  configure: () => true,
  lireAchat: async (produit, jeton) => (produit === PRODUIT_PASS ? achats.get(jeton) ?? null : null),
  consommer: async (produit, jeton) => { consommes.push(jeton); },
};
const accordes = [];
let offre = { couvre: [], aAcheter: [1], deja: [], bientot: null };
const abonnement = {
  offre: async () => offre,
  anciensEnVente: async () => [],
  accorderPass: async (userId, opts) => { accordes.push({ userId, ...opts }); return [1]; },
};

let qui = U;
const boutique = createBoutique({
  pool, google, abonnement, site: 'http://localhost', fanzzy: {},
  requireAuth: (req, _res, next) => { req.user = { id: qui }; next(); },
});
const app = express();
app.use(express.json());
app.use('/api/boutique', boutique.router);
const http = createServer(app).listen(0);
await new Promise((r) => http.once('listening', r));
const base = `http://127.0.0.1:${http.address().port}/api/boutique`;
const post = async (chemin, corps) => {
  const r = await fetch(base + chemin, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps) });
  return { statut: r.status, ...(await r.json().catch(() => ({}))) };
};

try {
  const avant = await post('/google/avant', { article: 'pass-saison' });
  check('avant de payer, le serveur donne le produit Google du PASS', avant.statut === 200 && avant.produit === PRODUIT_PASS);

  offre = { couvre: [1], aAcheter: [], deja: [1], bientot: null };
  const deja = await post('/google/avant', { article: 'pass-saison' });
  check('un PASS déjà payé est refusé avant d’aller chez Google', deja.statut === 400 && deja.error === 'pass.error.deja');
  offre = { couvre: [], aAcheter: [1], deja: [], bientot: { ouvre: '2026-12-01' } };
  const tot = await post('/google/avant', { article: 'pass-saison' });
  check('et pendant la BASE, il est « bientôt »', tot.error === 'pass.error.bientot');
  offre = { couvre: [], aAcheter: [1], deja: [], bientot: null };

  const inconnu = await post('/google', { article: 'pass-saison', jeton: 'invente' });
  check('un jeton que Google ne connaît pas ne livre rien', inconnu.statut === 400 && accordes.length === 0);

  achats.set('attente', { purchaseState: 2, consumptionState: 0, orderId: 'GPA.0' });
  const att = await post('/google', { article: 'pass-saison', jeton: 'attente' });
  check('un paiement en attente chez Google ne livre pas encore', att.statut === 202 && accordes.length === 0);

  achats.set('annule', { purchaseState: 1, consumptionState: 0, orderId: 'GPA.1' });
  const ann = await post('/google', { article: 'pass-saison', jeton: 'annule' });
  check('un achat annulé ne livre rien', ann.statut === 400 && accordes.length === 0);

  const JETON = 'jeton-' + crypto.randomUUID();
  achats.set(JETON, { purchaseState: 0, consumptionState: 0, orderId: 'GPA.1234-5678' });
  const ok = await post('/google', { article: 'pass-saison', jeton: JETON });
  check('un achat confirmé par Google livre le PASS', ok.statut === 200 && ok.ok && accordes.length === 1
    && accordes[0].userId === U);
  check('et il est consommé chez Google', consommes.includes(JETON));
  const [ligne] = await q('SELECT * FROM achats WHERE stripe_session = ?', [referenceGoogle(JETON)]);
  check('la commande est notée : Google, livrée, jeton et numéro de commande',
    ligne?.fournisseur === 'google' && ligne.etat === 'livre' && ligne.google_jeton === JETON
    && ligne.google_commande === 'GPA.1234-5678' && ligne.user_id === U);
  const [{ packs }] = await q('SELECT packs FROM user_wallet WHERE user_id = ?', [U]);
  check('aucun booster n’est crédité : l’argent n’achète aucun tirage', Number(packs) === 0);

  /* Le joueur a maintenant le PASS : l'offre le dit. Le même jeton renvoyé
     (un double clic, un réseau qui rejoue) ne livre pas une seconde fois. */
  offre = { couvre: [1], aAcheter: [], deja: [1], bientot: null };
  const bis = await post('/google', { article: 'pass-saison', jeton: JETON });
  check('le même jeton renvoyé ne livre pas deux fois', bis.statut === 200 && bis.deja && accordes.length === 1);

  qui = V;
  offre = { couvre: [], aAcheter: [1], deja: [], bientot: null };
  const vol = await post('/google', { article: 'pass-saison', jeton: JETON });
  check('le jeton d’un autre joueur est refusé', vol.statut === 409 && accordes.length === 1);
  qui = U;

  /* Sans clé de compte de service, rien ne passe. */
  const sansCle = createGooglePlay({ env: {} });
  check('sans GOOGLE_PLAY_CLE, le paiement Google n’est pas configuré', sansCle.configure() === false);
  const app2 = express(); app2.use(express.json());
  app2.use('/b', createBoutique({ pool, google: sansCle, abonnement, site: 'http://localhost', fanzzy: {},
    requireAuth: (req, _res, next) => { req.user = { id: U }; next(); } }).router);
  const h2 = createServer(app2).listen(0);
  await new Promise((r) => h2.once('listening', r));
  const r2 = await fetch(`http://127.0.0.1:${h2.address().port}/b/google`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ article: 'pass-saison', jeton: 'x' }) });
  check('et la route répond 503', r2.status === 503);
  h2.close();

  /* Le client Google réel : la signature du compte de service et l'adresse
     de l'API, avec un fetch simulé. */
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const cle = JSON.stringify({ client_email: 'tbf@exemple.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  const appels = [];
  const faux = async (url, opts = {}) => {
    appels.push({ url: String(url), opts });
    if (String(url).includes('oauth2')) {
      return new Response(JSON.stringify({ access_token: 'acces', expires_in: 3600 }), { status: 200 });
    }
    if (String(url).endsWith(':consume')) return new Response('{}', { status: 200 });
    return new Response(JSON.stringify({ purchaseState: 0, orderId: 'GPA.9' }), { status: 200 });
  };
  const vrai = createGooglePlay({ env: { GOOGLE_PLAY_CLE: cle, ANDROID_PAQUET: 'online.thebestfan.app' }, fetch: faux });
  const lu = await vrai.lireAchat(PRODUIT_PASS, 'a/b');
  await vrai.consommer(PRODUIT_PASS, 'a/b');
  const assertion = new URLSearchParams(appels[0].opts.body).get('assertion') ?? '';
  check('le client Google signe un JWT RS256 et lit l’achat à la bonne adresse',
    lu?.orderId === 'GPA.9' && assertion.split('.').length === 3
    && appels[1].url === 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/online.thebestfan.app/purchases/products/pass_saison/tokens/a%2Fb'
    && appels[1].opts.headers.authorization === 'Bearer acces');
  check('le jeton d’accès est gardé, et la consommation est un POST :consume',
    appels.filter((a) => a.url.includes('oauth2')).length === 1
    && appels[2].url.endsWith(':consume') && appels[2].opts.method === 'POST');
} finally {
  http.close();
  await pool.end();
  await raw.end();
}

console.log(rates ? `\n${rates} contrôle(s) rouge(s)` : '\ngoogle:smoke ok');
process.exit(rates ? 1 : 0);
