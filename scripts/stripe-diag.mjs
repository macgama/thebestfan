/**
 * Le contrôle de la configuration Stripe, en lecture seule.
 *
 * ## Pourquoi un script et pas un coup d'œil au tableau de bord
 *
 * Le tableau de bord montre ce qui existe ; il ne dit pas si c'est **ce que
 * ce code-ci attend**. Les trois choses qui font échouer un abonnement ne s'y
 * voient pas d'un regard : un compte qui n'encaisse pas encore, un webhook
 * déclaré sur la mauvaise adresse, et surtout une liste d'événements
 * incomplète — celle-là passe le premier paiement et éteint l'abonnement au
 * bout d'un mois, sans rien afficher nulle part.
 *
 * Ce script lit donc la configuration réelle et la compare à ce que
 * `boutique/index.js` sait traiter. Rien n'est créé ni modifié : toutes les
 * requêtes sont des GET.
 *
 * ## Il ne sort jamais aucun secret
 *
 * La clé n'est affichée que par son préfixe — `sk_live_…` ou `sk_test_…` —
 * parce que c'est la seule partie qui apprend quelque chose : savoir si l'on
 * regarde le mode test ou le mode réel. Le reste ne doit apparaître dans
 * aucune sortie de terminal, qui se colle dans des messages.
 *
 * ## Usage
 *
 *     npm run stripe:diag
 *
 * Sur le serveur, là où vit le `.env`. En local, il dira simplement que les
 * clés manquent — ce qui est la bonne réponse et non une panne.
 */

/* L'adresse de l'API. Surchargeable pour éprouver ce script contre un faux
   Stripe : sans cela, le seul moyen de vérifier qu'il dit vrai serait de
   casser une vraie configuration de production — ce qu'on ne fait pas sur
   un compte qui encaisse. */
const API = process.env.TBF_STRIPE_API || 'https://api.stripe.com/v1';

/* Les cinq événements que `boutique/index.js` traite. La liste est écrite ici
   plutôt que déduite du fichier : une déduction par expression régulière
   passerait pour une vérification tout en suivant la même erreur si le code
   en perdait un. Deux sources qui se contredisent, c'est un contrôle qui
   parle. */
const ATTENDUS = [
  ['checkout.session.completed', 'livre la commande, et pose l’abonnement'],
  ['checkout.session.async_payment_succeeded', 'idem, paiement différé'],
  ['checkout.session.expired', 'referme une commande abandonnée'],
  ['invoice.paid', 'LE RENOUVELLEMENT — sans lui, tout s’éteint au bout d’un mois'],
  ['customer.subscription.deleted', 'la résiliation'],
];

/* Les deux formules du catalogue, pour dire lesquelles on vérifie. */
const { CATALOGUE } = await import('../src/shared/boutique.js');
const formules = CATALOGUE.filter((a) => a.recurrence);

let soucis = 0;
const ok = (l) => console.log(`  ok   ${l}`);
const non = (l) => { console.log(` MANQUE ${l}`); soucis++; };
const note = (l) => console.log(`       ${l}`);

const cle = process.env.STRIPE_SECRET_KEY || '';
const hook = process.env.STRIPE_WEBHOOK_SECRET || '';
const origine = process.env.PUBLIC_ORIGIN || process.env.SITE_URL || '';

console.log('\n— la configuration Stripe, vue par ce code —\n');

/* ------------------------------------------------------------ les clés */

if (!cle) {
  non('STRIPE_SECRET_KEY : absente. La boutique reste en vitrine.');
  note('Rien d’autre ne peut être vérifié sans elle. Ajoute-la au .env,');
  note('puis relance. Elle n’est jamais affichée par ce script.');
  process.exit(1);
}
const mode = cle.startsWith('sk_live_') ? 'RÉEL' : cle.startsWith('sk_test_') ? 'test' : '?';
ok(`STRIPE_SECRET_KEY présente — mode ${mode} (${cle.slice(0, 8)}…)`);
if (mode === '?') note('Ce préfixe n’est ni sk_live_ ni sk_test_ : à vérifier.');

if (!hook) {
  non('STRIPE_WEBHOOK_SECRET : absent. Les paiements ne seront jamais livrés.');
  note('Stripe appellera, la signature sera refusée, et l’argent sera pris');
  note('sans que l’abonnement soit posé. C’est le pire des deux états.');
} else if (!hook.startsWith('whsec_')) {
  non('STRIPE_WEBHOOK_SECRET ne commence pas par whsec_ : ce n’est pas le bon secret.');
  note('Celui-ci se copie sur la page de l’endpoint, pas dans les clés d’API.');
} else {
  ok('STRIPE_WEBHOOK_SECRET présent');
}

if (!origine) {
  non('PUBLIC_ORIGIN : absent. Les retours de paiement iront sur localhost:3000.');
} else if (!origine.startsWith('https://')) {
  non(`PUBLIC_ORIGIN vaut « ${origine} » : Stripe exige https pour un retour réel.`);
} else {
  ok(`PUBLIC_ORIGIN : ${origine}`);
}

/* ------------------------------------------------------------ l'appel */

async function lire(chemin) {
  const r = await fetch(API + chemin, { headers: { Authorization: `Bearer ${cle}` } });
  const json = await r.json();
  if (!r.ok) throw new Error(json?.error?.message || `HTTP ${r.status}`);
  return json;
}

/* ----------------------------------------------------------- le compte */

console.log('\n  le compte');
let compte;
try {
  compte = await lire('/account');
} catch (e) {
  non(`Stripe refuse la clé : ${e.message}`);
  note('Une clé révoquée, ou celle d’un autre compte. Rien d’autre à vérifier.');
  process.exit(1);
}
ok(`compte joint : ${compte.business_profile?.name || compte.id}`);

/* `charges_enabled` est la question qui compte : un compte créé mais non
   activé accepte les clés de test et refuse tout paiement réel. On ne s'en
   aperçoit qu'au premier client. */
if (mode === 'RÉEL' && compte.charges_enabled === false) {
  non('le compte n’encaisse pas encore (charges_enabled = false)');
  note('Le dossier d’activation est incomplet : Stripe le liste dans');
  note('« requirements » sur le tableau de bord. Aucun paiement réel ne passera.');
} else if (mode === 'RÉEL') {
  ok('le compte encaisse (charges_enabled)');
} else {
  note('mode test : l’encaissement réel n’est pas vérifiable ici.');
}

/* Le reversement, et **seulement si l'encaissement marche**. La remarque
   s'affichait aussi sur un compte non activé, juste sous la ligne qui dit
   qu'il n'encaisse pas : « tu encaisses, mais rien ne sera reversé » sous
   « le compte n'encaisse pas encore », c'est deux phrases qui se
   contredisent dans le même paragraphe, et on cesse de croire les deux. */
if (mode === 'RÉEL' && compte.charges_enabled && compte.payouts_enabled === false) {
  note('payouts_enabled = false : tu encaisses, mais rien n’est encore reversé.');
  note('Sans conséquence pour le joueur — c’est ton virement qui attend.');
}

/* ---------------------------------------------------------- le webhook */

console.log('\n  le webhook');
let points;
try {
  points = (await lire('/webhook_endpoints?limit=100')).data ?? [];
} catch (e) {
  non(`impossible de lire les endpoints : ${e.message}`);
  points = [];
}

const attendue = origine ? `${origine}/api/boutique/webhook` : null;
const bons = points.filter((p) => p.url === attendue);

if (!points.length) {
  non('aucun endpoint déclaré. Stripe n’appellera jamais le site.');
  note(`À créer : POST ${attendue ?? '<PUBLIC_ORIGIN>/api/boutique/webhook'}`);
} else if (!bons.length) {
  non(`aucun endpoint ne pointe sur ${attendue}`);
  note('Déclarés aujourd’hui :');
  for (const p of points) note(`  · ${p.url} (${p.status})`);
  note('Une adresse qui diffère d’un caractère ne reçoit rien, en silence.');
} else {
  if (bons.length > 1) {
    note(`${bons.length} endpoints sur la même adresse : chaque événement`);
    note('arrivera en double. Le rejeu est sûr, mais c’est du bruit.');
  }
  for (const p of bons) {
    if (p.status !== 'enabled') non(`l’endpoint est « ${p.status} », pas « enabled »`);
    else ok(`endpoint actif sur ${p.url}`);

    /* Le cœur du contrôle. Un endpoint peut écouter « tous les événements »,
       ce que Stripe note par une étoile — c'est plus large que nécessaire
       mais correct, et il faut donc l'accepter au lieu de le signaler. */
    const ecoute = p.enabled_events ?? [];
    if (ecoute.includes('*')) {
      ok('il écoute tous les événements (*) — les cinq sont couverts');
      continue;
    }
    for (const [evt, role] of ATTENDUS) {
      if (ecoute.includes(evt)) ok(`  ${evt}`);
      else { non(`  ${evt} — ${role}`); }
    }
    const enTrop = ecoute.filter((e) => !ATTENDUS.some(([a]) => a === e));
    if (enTrop.length) {
      note(`${enTrop.length} événement(s) écouté(s) sans être traités : sans effet,`);
      note('ils reçoivent une réponse polie et rien ne se passe.');
    }
  }
}

/* --------------------------------------------------------- les formules */

console.log('\n  les deux formules');
for (const f of formules) {
  const euros = (f.prix / 100).toFixed(2).replace('.', ',');
  ok(`${f.nom} — ${euros} € / ${f.recurrence === 'month' ? 'mois' : 'an'}`);
}
note('Elles partent en price_data à chaque session : aucun produit ni tarif');
note('n’est à créer dans le tableau de bord, et il n’y a donc rien à y vérifier.');

/* ------------------------------------------------------------- verdict */

console.log(soucis
  ? `\n${soucis} point(s) à corriger avant qu’un joueur puisse s’abonner.\n`
  : '\nTout est en place : un joueur peut s’abonner au mois et à l’année.\n');
process.exitCode = soucis ? 1 : 0;
