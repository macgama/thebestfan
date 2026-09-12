/**
 * La boutique : le circuit d'achat, sans Stripe.
 *
 * ## Ce qu'on éprouve, et ce qu'on ne peut pas éprouver
 *
 * On n'appelle pas Stripe. Ce qui compte n'est pas qu'un paiement aboutisse —
 * c'est ce que **nous** faisons de l'événement quand il arrive : vérifier sa
 * signature, livrer une fois, et une seule, même rejoué dix fois.
 *
 * On fabrique donc des webhooks à la main, signés avec notre propre secret,
 * exactement comme Stripe les signe. C'est la seule façon d'éprouver la
 * protection contre le rejeu, qui est la partie du circuit où une erreur coûte
 * de l'argent réel.
 *
 * Trois choses, dans l'ordre d'importance :
 *   1. un webhook **mal signé** ne livre rien ;
 *   2. un webhook **rejoué** ne livre qu'une fois ;
 *   3. le prix ne vient **jamais** du client.
 */
import express from 'express';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import { createBoutique } from '../src/server/boutique/index.js';
import { CATALOGUE, ARTICLE_PAR_ID } from '../src/shared/boutique.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
/* Les clés étrangères se moquent de l ordre qu on écrit : on les désarme le
   temps du ménage, sinon MySQL refuse de laisser tomber une table qu une autre
   référence encore — et il a raison. */
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
await raw.query(`DROP TABLE IF EXISTS achats, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, user_decks, virage_presence, user_wallet, users`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');
const { readFile } = await import('node:fs/promises');
/* L ordre compte : souvenirs.sql crée la bourse, et fanzzy.sql lui ajoute une
   colonne. Le lire dans le désordre échoue sur un ALTER TABLE d une table qui
   n existe pas encore — et le message ne dit pas laquelle manque. */
for (const f of ['auth.sql', 'souvenirs.sql', 'fanzzy.sql', 'inventaire.sql',
  'skins.sql', 'boutique.sql']) {
  await raw.query(await readFile(`sql/${f}`, 'utf8'));
}
await raw.query(
  `INSERT INTO users (email, pseudo, password_hash, status, public_id)
   VALUES ('a@b.c','Un','x','active', UUID())`);
/* Le joueur est désigné par son public_id partout dans le jeu : la bourse, la
   collection et les achats s y accrochent tous. Prendre la clé numérique ici
   ferait une suite qui éprouve un schéma que le serveur n emploie pas. */
const [[u]] = await raw.query('SELECT public_id FROM users LIMIT 1');
const U = u.public_id;
await raw.query('INSERT INTO user_wallet (user_id, scarves, packs) VALUES (?,0,0)', [U]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });

/* Les clés de test. Elles ne servent qu'à signer : aucune requête ne part chez
   Stripe, et `commander` sera donc refusé — c'est attendu et c'est éprouvé. */
process.env.STRIPE_SECRET_KEY = 'sk_test_faux';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_secret_de_test';

const boutique = createBoutique({
  pool,
  requireAuth: (req, _res, next) => { req.user = { id: U }; next(); },
  fanzzy: null,
});

const app = express();
app.use('/api/boutique', boutique.webhook);
app.use('/api/boutique', boutique.router);
const http = createServer(app).listen(0);
const base = `http://localhost:${http.address().port}`;

const q = (sql, args) => pool.query(sql, args).then(([r]) => r);

/** Un webhook signé comme Stripe le signe. */
function poster(corps, { secret = 'whsec_secret_de_test', t = Math.floor(Date.now() / 1000) } = {}) {
  const brut = JSON.stringify(corps);
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${brut}`).digest('hex');
  return fetch(`${base}/api/boutique/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` },
    body: brut,
  });
}

const evenement = (sessionId) => ({
  type: 'checkout.session.completed',
  data: { object: { id: sessionId, payment_status: 'paid' } },
});

/* ------------------------------------------------------------- le catalogue */
{
  const r = await fetch(`${base}/api/boutique/catalogue`).then((x) => x.json());
  check('le catalogue est servi', Array.isArray(r.articles) && r.articles.length === CATALOGUE.length);
  check('avec ses rayons', Array.isArray(r.rayons) && r.rayons.length > 0);
  /* Ce que la page n'a **pas** à savoir : ce que contient un article. Le
     contenu décide de la livraison, et l'exposer invite à s'en servir. */
  check('mais jamais ce que contient un article',
    r.articles.every((a) => a.livraison === undefined));
  check('et le prix est déjà mis en forme',
    r.articles.every((a) => typeof a.prixTexte === 'string' && a.prixTexte.includes('€')));
}

/* ------------------------------------------------------- le prix, côté serveur */
{
  /* On commande en réclamant un autre prix. Stripe est injoignable, donc la
     commande échoue — mais ce qui compte est qu'aucune ligne ne soit écrite
     avec le montant du client. */
  await fetch(`${base}/api/boutique/commander`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article: 'pack-1', prix: 1, montant: 1 }),
  }).catch(() => {});
  const lignes = await q('SELECT montant FROM achats');
  check('un prix envoyé par le client n’écrit aucune ligne à ce prix',
    lignes.every((l) => l.montant !== 1));

  const r = await fetch(`${base}/api/boutique/commander`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article: 'article-qui-n-existe-pas' }),
  });
  check('et un article inconnu est refusé', r.status === 400);
}

/* ------------------------------------------------------------- la signature */
{
  await q(`INSERT INTO achats (user_id, article, montant, devise, stripe_session)
           VALUES (?, 'ech-500', ?, 'eur', 'cs_sig')`,
    [U, ARTICLE_PAR_ID.get('ech-500').prix]);

  const mauvais = await poster(evenement('cs_sig'), { secret: 'whsec_pas_le_bon' });
  check('un webhook mal signé est refusé', mauvais.status === 400);
  const [[w1]] = [await q('SELECT scarves FROM user_wallet WHERE user_id = ?', [U])];
  check('et il n’a rien livré', Number(w1.scarves) === 0);

  /* Un horodatage vieux d'une heure : la signature est juste, mais l'événement
     a été capté ailleurs et rejoué plus tard. C'est exactement ce que la
     tolérance de cinq minutes est là pour écarter. */
  const vieux = await poster(evenement('cs_sig'),
    { t: Math.floor(Date.now() / 1000) - 3600 });
  check('un webhook trop vieux est refusé', vieux.status === 400);
  const [[w2]] = [await q('SELECT scarves FROM user_wallet WHERE user_id = ?', [U])];
  check('et il n’a rien livré non plus', Number(w2.scarves) === 0);
}

/* ------------------------------------------------ la livraison, et le rejeu */
{
  const bon = await poster(evenement('cs_sig'));
  check('un webhook bien signé est accepté', bon.status === 200);

  const [[w]] = [await q('SELECT scarves FROM user_wallet WHERE user_id = ?', [U])];
  check(`les 500 écharpes sont livrées (${w.scarves})`, Number(w.scarves) === 500);

  const [[a]] = [await q('SELECT etat, livraison FROM achats WHERE stripe_session = ?', ['cs_sig'])];
  check('la commande est marquée livrée', a.etat === 'livre');
  check('et elle garde la trace de ce qui a été remis',
    JSON.stringify(a.livraison).includes('500'));

  /* **Le contrôle qui porte tout.** Stripe rejoue ses webhooks — c'est écrit
     dans sa documentation, ce n'est pas une panne. Dix rejeux, et le solde ne
     doit pas bouger d'une écharpe. */
  for (let i = 0; i < 10; i++) await poster(evenement('cs_sig'));
  const [[w2]] = [await q('SELECT scarves FROM user_wallet WHERE user_id = ?', [U])];
  check(`dix rejeux ne livrent pas une seconde fois (${w2.scarves})`, Number(w2.scarves) === 500);

  /* Et dix rejeux **en même temps**. La protection est une contrainte en base
     et un verrou de ligne, pas un `if` : deux requêtes simultanées passeraient
     toutes les deux au travers d'un test en JavaScript. */
  await q(`INSERT INTO achats (user_id, article, montant, devise, stripe_session)
           VALUES (?, 'pack-5', ?, 'eur', 'cs_course')`,
    [U, ARTICLE_PAR_ID.get('pack-5').prix]);
  await Promise.all(Array.from({ length: 10 }, () => poster(evenement('cs_course'))));
  const [[p]] = [await q('SELECT packs FROM user_wallet WHERE user_id = ?', [U])];
  check(`dix rejeux simultanés non plus (${p.packs} boosters)`, Number(p.packs) === 5);
}

/* ------------------------------------------------ la vraie course, sans HTTP

   Dix requêtes HTTP ne courent pas vraiment : le temps du réseau et la file du
   pool les mettent presque en rang, et la mutation qui retire le verrou de
   ligne passait au vert. On appelle donc encaisser() en parallèle, sans rien
   entre les appels — c est là que deux transactions lisent la même ligne au
   même instant, et c est exactement ce que FOR UPDATE est là pour empêcher. */
{
  await q(`INSERT INTO achats (user_id, article, montant, devise, stripe_session)
           VALUES (?, 'ech-1400', ?, 'eur', 'cs_vraie_course')`,
    [U, ARTICLE_PAR_ID.get('ech-1400').prix]);
  const [[avant]] = [await q('SELECT scarves FROM user_wallet WHERE user_id = ?', [U])];
  await Promise.all(Array.from({ length: 6 }, () => boutique.encaisser('cs_vraie_course')));
  const [[apres]] = [await q('SELECT scarves FROM user_wallet WHERE user_id = ?', [U])];
  const gagne = Number(apres.scarves) - Number(avant.scarves);
  check(`six encaissements simultanés ne livrent qu une fois (+${gagne})`, gagne === 1400);
}

/* ------------------------------------------- l unicité, garantie par la base

   Le code ne peut pas empêcher deux lignes pour une même session : deux
   requêtes concurrentes vérifieraient toutes les deux qu elle n existe pas,
   puis l écriraient toutes les deux. Seule la contrainte le peut, et c est
   pour ça qu elle est en base et pas dans un if. */
{
  let refuse = null;
  try {
    await q(`INSERT INTO achats (user_id, article, montant, devise, stripe_session)
             VALUES (?, 'pack-1', 199, 'eur', 'cs_sig')`, [U]);
  } catch (e) { refuse = e.code; }
  check('deux commandes pour la même session sont refusées par la base',
    refuse === 'ER_DUP_ENTRY');
}

/* ------------------------------------------------------- une session inconnue */
{
  const r = await poster(evenement('cs_jamais_vue'));
  check('une session qu’on ne connaît pas ne fait rien, et ne casse rien',
    r.status === 200);
}

/* ------------------------------------------------------------- l'abandon */
{
  await q(`INSERT INTO achats (user_id, article, montant, devise, stripe_session)
           VALUES (?, 'pack-1', 199, 'eur', 'cs_expire')`, [U]);
  await poster({ type: 'checkout.session.expired', data: { object: { id: 'cs_expire' } } });
  const [[a]] = [await q('SELECT etat FROM achats WHERE stripe_session = ?', ['cs_expire'])];
  check('une session expirée est marquée abandonnée', a.etat === 'abandonne');
}

console.log(`\n${rates ? `${rates} échec(s)` : 'tout est vert'}`);
http.close();
await pool.end();
process.exit(rates ? 1 : 0);
