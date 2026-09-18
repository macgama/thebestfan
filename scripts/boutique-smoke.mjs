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
import { createAbonnement } from '../src/server/abonnement/index.js';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { STUFF } from '../src/shared/fanzzy/inventaire.js';
import { prixDe, prixStuff } from '../src/shared/etal.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { CATALOGUE, ARTICLE_PAR_ID, LIVRAISONS_PAYANTES, verifierCatalogue }
  from '../src/shared/boutique.js';
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
await raw.query(`DROP TABLE IF EXISTS parrainages, abonnements, achats, tenues, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, user_decks, virage_presence, user_wallet, users`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');
const { readFile } = await import('node:fs/promises');
/* L ordre compte : souvenirs.sql crée la bourse, et fanzzy.sql lui ajoute une
   colonne. Le lire dans le désordre échoue sur un ALTER TABLE d une table qui
   n existe pas encore — et le message ne dit pas laquelle manque. */
for (const f of ['auth.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'inventaire.sql',
  'skins.sql', 'tenues.sql', 'boutique.sql', 'abonnement.sql']) {
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

/* Le vrai module des Fanzzy, et non `null` : c'est lui qui remet les objets
   nommés. Tant que la boutique ne livrait que des nombres dans une colonne, un
   bouchon suffisait ; depuis qu'elle remet des pièces d'équipement et des
   tenues, un bouchon éprouverait le bouchon. */
/* Le catalogue des Fanzzy et celui des tenues vivent en base et se lisent en
   mémoire : ils doivent être chargés **avant** les modules qui s'en servent,
   sinon ceux-ci travaillent sur un catalogue vide. Le garde de `tenues.js` le
   dit en toutes lettres quand on l'oublie — c'est ce qui a permis de trouver
   l'oubli en une lecture. */
await chargerCatalogue(pool);
await chargerTenues(pool);

const fanzzy = createFanzzy({ pool, requireAuth: (req, _res, next) => next() });

/* L'abonnement est **le seul** article payant depuis que les billets ont
   disparu : sans lui monté, la boutique n'a plus rien à livrer, et la moitié de
   cette suite n'aurait plus d'objet. */
const abonnement = createAbonnement({ pool, requireAuth: (_q, _s, n) => n() });

const boutique = createBoutique({
  pool,
  requireAuth: (req, _res, next) => { req.user = { id: U }; next(); },
  fanzzy,
  abonnement,
});

/** L'abonnement du joueur, tel que la base le porte. */
const abo = async () => (await pool.query(
  'SELECT formule, fin, source FROM abonnements WHERE user_id = ?', [U]))[0][0] ?? null;

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
    body: JSON.stringify({ article: 'abo-mensuel', prix: 1, montant: 1 }),
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
           VALUES (?, 'abo-annuel', ?, 'eur', 'cs_sig')`,
    [U, ARTICLE_PAR_ID.get('abo-annuel').prix]);

  const mauvais = await poster(evenement('cs_sig'), { secret: 'whsec_pas_le_bon' });
  check('un webhook mal signé est refusé', mauvais.status === 400);
  check('et il n’a rien livré', (await abo()) === null);

  /* Un horodatage vieux d'une heure : la signature est juste, mais l'événement
     a été capté ailleurs et rejoué plus tard. C'est exactement ce que la
     tolérance de cinq minutes est là pour écarter. */
  const vieux = await poster(evenement('cs_sig'),
    { t: Math.floor(Date.now() / 1000) - 3600 });
  check('un webhook trop vieux est refusé', vieux.status === 400);
  check('et il n’a rien livré non plus', (await abo()) === null);
}

/* ------------------------------------------------ la livraison, et le rejeu */
{
  const bon = await poster(evenement('cs_sig'));
  check('un webhook bien signé est accepté', bon.status === 200);

  const pose = await abo();
  check('l’abonnement est posé', pose?.formule === 'annuel'
    || (console.log('        la base dit :', JSON.stringify(pose)), false));
  /* `source` dit d'où vient la ligne, et c'est ce qui distingue un abonnement
     payé d'un abonnement offert par l'administration. Sans cette colonne, on ne
     saurait pas quoi rembourser. */
  check('et il porte la trace du paiement', pose?.source === 'stripe');

  const [[a]] = [await q('SELECT etat, livraison FROM achats WHERE stripe_session = ?', ['cs_sig'])];
  check('la commande est marquée livrée', a.etat === 'livre');
  /* La trace n'est plus un nombre de billets mais la formule posée. Elle sert
     le jour d'un remboursement : on doit pouvoir dire ce qui a été remis sans
     aller le demander à Stripe. */
  check('et elle garde la trace de ce qui a été remis',
    JSON.stringify(a.livraison).includes('annuel')
    || (console.log('        elle garde :', JSON.stringify(a.livraison)), false));

  /* **Le contrôle qui porte tout.** Stripe rejoue ses webhooks — c'est écrit
     dans sa documentation, ce n'est pas une panne. Dix rejeux, et le solde ne
     doit pas bouger d'une écharpe. */
  for (let i = 0; i < 10; i++) await poster(evenement('cs_sig'));
  /* **Un rejeu ne doit pas prolonger l'abonnement.** C'est le même défaut
     qu'avec les billets, en plus sournois : personne ne se plaint de recevoir un
     an de plus, et on ne le découvre qu'en lisant les comptes. La preuve est que
     l'échéance n'a pas bougé d'une milliseconde. */
  const apresRejeux = await abo();
  check('dix rejeux ne livrent pas une seconde fois',
    String(apresRejeux?.fin) === String(pose?.fin)
    || (console.log('        avant', pose?.fin, '· après', apresRejeux?.fin), false));

  /* Et dix rejeux **en même temps**. La protection est une contrainte en base
     et un verrou de ligne, pas un `if` : deux requêtes simultanées passeraient
     toutes les deux au travers d'un test en JavaScript. */
  await q(`INSERT INTO achats (user_id, article, montant, devise, stripe_session)
           VALUES (?, 'abo-annuel', ?, 'eur', 'cs_course')`,
    [U, ARTICLE_PAR_ID.get('abo-annuel').prix]);
  await Promise.all(Array.from({ length: 10 }, () => poster(evenement('cs_course'))));
  const p = await abo();
  /* 550 du contrôle précédent, plus les 1 200 de celui-ci, et **une seule
     fois** : un total figé à 1 200 mesurerait la mise en scène au lieu du
     comportement. */
  /* Dix encaissements lancés ensemble : une seule commande est réclamée, donc
     une seule livraison. L'échéance ne peut avoir été poussée qu'une fois. */
  check('dix rejeux simultanés non plus', p?.formule === 'annuel');
}

/* ------------------------------ l'argent réel n'achète que des billets

   La propriété qui fait tenir tout le modèle, et elle se casse en **ajoutant**,
   pas en retirant : trois lignes au catalogue — « remettons les boosters, les
   gens les réclament » — et la chaîne euro → coffre aléatoire est rouverte sans
   qu'un fichier existant ait bougé.

   Ces contrôles ne regardent donc pas ce que le code fait, mais ce que le
   catalogue ne contient pas. C'est la seule forme qui résiste à un ajout.

   Rappel de ce qui a été retiré et pourquoi :
     — les boosters, parce qu'un coffre à contenu aléatoire payé en argent réel
       est interdit en Belgique et aux Pays-Bas, et réglementé ailleurs ;
     — « une tenue » et « une pièce d'équipement », parce que c'étaient des
       **tirages** et non des objets choisis ;
     — les écharpes, parce qu'une écharpe achète un booster à quarante-cinq :
       les vendre revenait à vendre un coffre avec une étape de plus. */
{
  const fautes = verifierCatalogue();
  check('le catalogue se tient lui-même pour correct',
    fautes.length === 0 || (console.log('        ', fautes.join(' | ')), false));

  /* Et le vérificateur voit vraiment une faute quand il y en a une. Sans ce
     contrôle, on pouvait lui retirer sa règle principale sans que rien ne
     bouge : il ne lisait que le vrai catalogue, qui est correct. */
  const faux = verifierCatalogue([
    { id: 'faux-pack', rayon: 'billets', nom: 'Cinq boosters',
      prix: 899, livraison: { type: 'packs', n: 5 } },
  ]);
  check('et il refuse un catalogue qui vendrait des boosters',
    faux.some((f) => /packs/.test(f))
    || (console.log('        fautes vues :', JSON.stringify(faux)), false));
  check('en nommant l’article fautif, pas seulement « invalide »',
    faux.some((f) => f.includes('faux-pack')));

  /* ===================== ce que l'argent réel a le droit d'acheter, et rien d'autre

     Ce contrôle disait « rien que des billets ». Il dit maintenant « rien que
     des billets ou l'abonnement », et **l'avoir modifié est le geste qui
     compte** : la liste blanche existe pour qu'on ne puisse pas y ajouter
     quelque chose sans venir l'écrire ici, c'est-à-dire sans décider.

     Ce qui n'a pas bougé d'un iota, et ne doit pas bouger : l'argent réel ne
     produit **ni écharpe, ni booster, ni tirage**. Une écharpe achète un
     booster à quarante-cinq ; les vendre rouvrirait la chaîne euro → tirage,
     que la Belgique et les Pays-Bas traitent comme un jeu de hasard. Les deux
     contrôles qui suivent sont là pour ça, et ils sont plus sévères que celui
     qu'ils remplacent : ils nomment l'interdit au lieu d'énumérer le permis. */
  const PERMIS = new Set(['abonnement']);
  check('aucun article payant ne livre autre chose que l’abonnement',
    CATALOGUE.every((a) => PERMIS.has(a.livraison.type))
    || (console.log('        fautifs :', CATALOGUE
      .filter((a) => !PERMIS.has(a.livraison.type))
      .map((a) => `${a.id} → ${a.livraison.type}`).join(', ')), false));

  /* **L'interdit, nommé.** Un jour quelqu'un voudra « rendre la boutique plus
     attractive » ; ce contrôle est ce qu'il rencontrera. */
  for (const interdit of ['billets', 'echarpes', 'écharpes', 'packs', 'boosters', 'fanzzy']) {
    check(`l'argent réel n'achète jamais « ${interdit} »`,
      !LIVRAISONS_PAYANTES.has(interdit)
      && !CATALOGUE.some((a) => a.livraison.type === interdit));
  }

  /* La liste blanche est le point de décision, et elle reste courte. Le jour
     où elle s'allonge, ce contrôle rougit — et c'est là qu'il faut s'arrêter
     pour reprendre la question des taux de tirage, des territoires et du
     garde-fou d'âge. */
  /* **Une seule entrée**, et c'est le plus court qu'elle puisse être sans être
     vide. Elle en avait deux : les billets sont partis avec la monnaie
     achetable, et la chaîne euro → tirage n'est plus coupée par une séparation
     qu'il fallait tenir — elle est coupée à la racine. */
  check('la liste des livraisons payantes tient en une entrée',
    LIVRAISONS_PAYANTES.size === 1 && LIVRAISONS_PAYANTES.has('abonnement')
    || (console.log('        elle contient :', [...LIVRAISONS_PAYANTES].join(', ')), false));

  /* Et l'abonnement ne livre rien d'autre que lui-même : ni écharpes de
     bienvenue, ni booster offert. Ce serait le chemin le plus naturel pour
     rouvrir la porte, et le plus facile à défendre en réunion. */
  for (const a of CATALOGUE.filter((x) => x.livraison.type === 'abonnement')) {
    check(`« ${a.id} » ne livre que l'abonnement, sans cadeau de bienvenue`,
      Object.keys(a.livraison).every((k) => ['type', 'formule', 'jours'].includes(k))
      || (console.log('        il livre :', JSON.stringify(a.livraison)), false));
  }

  check('aucun article payant ne s’appelle « booster » ou « écharpe »',
    !CATALOGUE.some((a) => /booster|écharpe|echarpe/i.test(a.nom + ' ' + a.id)));

  /* Et la règle est tenue **par le moteur**, pas seulement par le catalogue :
     un article fabriqué à la main, qui ne passe par aucune liste, est refusé à
     la livraison. Sans ce contrôle, la règle ne vivrait que dans un tableau. */
  let refus = null;
  try {
    await boutique.livrer(pool, U, { livraison: { type: 'packs', n: 5 } });
  } catch (e) { refus = e; }
  check('le moteur refuse de livrer un type interdit, même hors catalogue',
    /livraison_interdite/.test(refus?.message ?? '')
    || (console.log('        levé :', refus?.message ?? '(rien)'), false));

  const [[w]] = [await q('SELECT packs FROM user_wallet WHERE user_id = ?', [U])];
  check('et aucun booster n’a été crédité au passage', Number(w.packs) === 0);
}

/* ------------------------------------------------ la vraie course, sans HTTP

   Dix requêtes HTTP ne courent pas vraiment : le temps du réseau et la file du
   pool les mettent presque en rang, et la mutation qui retire le verrou de
   ligne passait au vert. On appelle donc encaisser() en parallèle, sans rien
   entre les appels — c est là que deux transactions lisent la même ligne au
   même instant, et c est exactement ce que FOR UPDATE est là pour empêcher. */
{
  await q(`INSERT INTO achats (user_id, article, montant, devise, stripe_session)
           VALUES (?, 'abo-mensuel', ?, 'eur', 'cs_vraie_course')`,
    [U, ARTICLE_PAR_ID.get('abo-mensuel').prix]);
  const avant = await abo();
  await Promise.all(Array.from({ length: 6 }, () => boutique.encaisser('cs_vraie_course')));
  const apres = await abo();
  /* Six encaissements de la **même** session, lancés ensemble. La commande
     n'est réclamée qu'une fois — `UPDATE … WHERE etat <> 'livre'` — donc
     l'échéance n'est poussée qu'une fois.

     On regarde qu'elle a bougé **et** que la formule est la bonne : une
     livraison qui n'aurait pas eu lieu du tout passerait un contrôle qui ne
     regarderait que « pas deux fois ». */
  check('six encaissements simultanés ne livrent qu une fois',
    String(apres?.fin) !== String(avant?.fin) && apres?.formule === 'mensuel'
    || (console.log('        avant', JSON.stringify(avant),
      '· après', JSON.stringify(apres)), false));
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
             VALUES (?, 'abo-mensuel', 199, 'eur', 'cs_sig')`, [U]);
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
           VALUES (?, 'abo-mensuel', 199, 'eur', 'cs_expire')`, [U]);
  await poster({ type: 'checkout.session.expired', data: { object: { id: 'cs_expire' } } });
  const [[a]] = [await q('SELECT etat FROM achats WHERE stripe_session = ?', ['cs_expire'])];
  check('une session expirée est marquée abandonnée', a.etat === 'abandonne');
}

/* ----------------------------------------------------- dépenser des écharpes

   L'autre moitié du modèle. On gagne des écharpes en jouant ; on les échange
   contre un objet **nommé**. C'est ici que se trouvent les erreurs qui
   coûtent : débiter sans livrer, livrer sans débiter, ou débiter deux fois.

   L'étal se payait en billets, la monnaie que l'argent réel achetait. Les
   billets n'existent plus : la chaîne euro → tirage n'est plus coupée par une
   séparation qu'il fallait tenir, elle est coupée à la racine — il n'y a plus
   de monnaie achetable du tout.

   Ce qui protège est la **transaction**, et non l'ordre des deux blocs : si
   la remise échoue après le débit, le `rollback` rend les écharpes. C'est une
   mutation qui l'a établi — échanger les blocs ne fait rougir personne, alors
   que retirer le `rollback` fait tomber « et elle n'a rien coûté ». Mieux
   valait le savoir que de le supposer. */
{
  const piece = STUFF.find((x) => x.rar === 'commune');
  const prix = prixStuff(piece.rar);

  const depenser = (corps) => fetch(base + '/api/boutique/depenser', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  }).then(async (r) => ({ code: r.status, json: await r.json().catch(() => ({})) }));

  await q('UPDATE user_wallet SET scarves = ? WHERE user_id = ?', [prix, U]);
  await q('DELETE FROM user_stuff WHERE user_id = ?', [U]);

  const etal = await fetch(base + '/api/boutique/etal').then((r) => r.json());
  check('l’étal liste l’équipement avec son prix en écharpes',
    (etal.stuff ?? []).some((o) => o.id === piece.id && o.prix === prix)
    || (console.log('        étal :', JSON.stringify(etal.stuff?.slice(0, 2))), false));
  check('et il dit combien d’écharpes on a', etal.echarpes === prix);
  /* Aucun objet de l'étal n'est un tirage : chacun porte un identifiant précis.
     C'est toute la différence avec ce que cette boutique vendait avant, où
     « une tenue » à 2,49 € tirait au sort. */
  check('chaque objet de l’étal est nommé, aucun n’est un tirage',
    (etal.stuff ?? []).every((o) => typeof o.id === 'string' && o.id.length > 0));

  const a = await depenser({ type: 'stuff', id: piece.id });
  check('acheter une pièce nommée réussit', a.code === 200
    || (console.log('        ', a.code, JSON.stringify(a.json)), false));
  check('le prix débité est celui du registre, pas celui du client', a.json.paye === prix);

  const [[w]] = [await q('SELECT scarves FROM user_wallet WHERE user_id = ?', [U])];
  check(`les écharpes sont débitées (${w.billets})`, Number(w.scarves) === 0);

  const ont = await q('SELECT stuff_id, copies FROM user_stuff WHERE user_id = ?', [U]);
  check('et c’est bien la pièce demandée qui arrive, pas une autre',
    ont.length === 1 && ont[0].stuff_id === piece.id
    || (console.log('        reçu :', JSON.stringify(ont)), false));

  /* Sans écharpes, on ne prend rien — et rien ne bouge. Le contrôle regarde les
     deux côtés : le refus, et l'absence d'effet. Un refus qui aurait quand
     même livré serait pire qu'un achat qui aurait échoué. */
  const b = await depenser({ type: 'stuff', id: piece.id });
  check('sans écharpes, l’achat est refusé', b.code === 400);
  check('et le refus nomme la cause', b.json.error === 'boutique.error.echarpes_insuffisantes'
    || (console.log('        ', JSON.stringify(b.json)), false));
  const apres = await q('SELECT stuff_id, copies FROM user_stuff WHERE user_id = ?', [U]);
  check('rien n’a été remis au passage',
    apres.length === 1 && Number(apres[0].copies) === 1);

  /* Le prix ne vient jamais du client — même règle que pour les euros, même
     raison. Sans elle, il suffit d'un champ modifié dans le navigateur. */
  await q('UPDATE user_wallet SET scarves = 5 WHERE user_id = ?', [U]);
  const c = await depenser({ type: 'stuff', id: piece.id, prix: 1, echarpes: 1 });
  check('un prix envoyé par le client n’achète rien', c.code === 400);
  const [[w3]] = [await q('SELECT scarves FROM user_wallet WHERE user_id = ?', [U])];
  check('et le solde n’a pas bougé', Number(w3.scarves) === 5);

  const d = await depenser({ type: 'stuff', id: 'objet-qui-nexiste-pas' });
  check('un objet inconnu est refusé', d.code === 400
    && d.json.error === 'boutique.error.objet_inconnu');

  /* Et le refus vient bien du tarif, pas de la remise qui suit. Les deux
     rendent le même code — c'est de la défense en profondeur, et c'est très
     bien — mais un contrôle qui ne les distingue pas ne dit pas lequel des deux
     remparts tient encore. */
  check('un objet hors catalogue n’a pas de prix du tout',
    prixDe('stuff', 'objet-qui-nexiste-pas') === null);
  check('et une pièce du catalogue en a un',
    prixDe('stuff', piece.id) === prix);

  /* Une tenue se pose sur un Fanzzy qu'on possède, à un âge qu'on a atteint.
     Refuser **avant** de débiter est la règle ; ce contrôle vérifie qu'on n'a
     pas payé pour un refus. */
  await q('UPDATE user_wallet SET scarves = 9999 WHERE user_id = ?', [U]);
  /* On prend une tenue **de l'étal** : nommer un identifiant en dur ici le
     rendrait faux à la prochaine dépublication, et le contrôle mesurerait
     alors « cette tenue n'est plus en vente » au lieu de ce qu'il vise. */
  const vendable = (etal.tenues ?? [])[0];
  check('au moins une tenue est en vente', Boolean(vendable)
    || (console.log('        aucune tenue publiée : le contrôle suivant ne prouve rien'), false));
  const e = await depenser({ type: 'tenue', id: vendable?.id, fanzzy: 'inconnu', stage: 1 });
  check('une tenue sur un Fanzzy qu’on ne possède pas est refusée', e.code === 400);
  /* **Notre** garde, et non celle de la base. Les clés étrangères refusent de
     toute façon cette écriture ; sans ce contrôle sur le code, on pouvait
     retirer la vérification de possession sans que rien ne bouge — et le
     joueur aurait reçu « impossible » au lieu de « tu ne possèdes pas ce
     Fanzzy ». */
  check('et c’est notre garde qui refuse, en nommant la cause',
    e.json.error === 'boutique.error.fanzzy_non_possede'
    || (console.log('        refus :', JSON.stringify(e.json)), false));
  const [[w4]] = [await q('SELECT scarves FROM user_wallet WHERE user_id = ?', [U])];
  check('et elle n’a rien coûté', Number(w4.scarves) === 9999
    || (console.log('        solde :', w4.billets), false));

  /* Et jamais de booster, par aucun chemin : c'est la demande d'origine. */
  const [[p]] = [await q('SELECT packs FROM user_wallet WHERE user_id = ?', [U])];
  check('aucun booster n’a été crédité par la dépense', Number(p.packs) === 0);
}

console.log(`\n${rates ? `${rates} échec(s)` : 'tout est vert'}`);
http.close();
await pool.end();
process.exit(rates ? 1 : 0);
