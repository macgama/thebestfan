/**
 * Test de l'abonnement.
 *
 * ## La règle que ce banc défend
 *
 * **On vend de la largeur et du confort, jamais de la puissance.**
 *
 * Deux règles du jeu l'imposaient déjà, chacune de son côté. `deck/index.js` :
 * « un deck entre toujours au premier âge […] l'écart se creuse par ce qu'on
 * joue, pas par ce qu'on a payé ». Et `shared/niveau.js` : « le niveau ne donne
 * aucune puissance ; s'il en avait, l'ancienneté deviendrait de la force ».
 *
 * Un abonnement qui ouvrirait un format de duel, un âge jouable ou un
 * classement ferait à l'argent ce que ces deux règles refusent au temps. La
 * moitié de cette suite ne vérifie donc pas ce que l'abonnement ouvre, mais ce
 * qu'il **n'ouvre pas** — c'est la partie qu'on cassera par inadvertance le
 * jour où l'on voudra « rendre l'abonnement plus attractif ».
 *
 * Usage : node scripts/abonnement-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer } from 'node:http';
import { createAbonnement } from '../src/server/abonnement/index.js';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { FORMATS } from '../src/server/deck/index.js';
import { reglage } from '../src/shared/reglages.js';
import { ARTICLE_PAR_ID } from '../src/shared/boutique.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
const [tables] = await raw.query('SHOW TABLES');
const noms = tables.map((r) => Object.values(r)[0]);
if (noms.length) await raw.query(`DROP TABLE ${noms.join(',')}`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'duel.sql',
                 'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'inventaire.sql',
                 'skins.sql', 'etats.sql', 'tenues.sql', 'deck.sql', 'niveau.sql', 'kop.sql',
                 'historique.sql', 'abonnement.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const LIBRE = 'aaaa0000-0000-0000-0000-000000000001';
const ABO = 'aaaa0000-0000-0000-0000-000000000002';
for (const [i, id] of [LIBRE, ABO].entries()) {
  await raw.query("INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')",
    [id, `a${i}@ex.fr`, `Joueur${i}`]);
  await raw.query('INSERT INTO user_wallet (user_id,scarves,packs) VALUES (?,0,0)', [id]);
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);

let moi = LIBRE;
const requireAuth = (q, _s, n) => { q.user = { id: moi }; n(); };
const abonnement = createAbonnement({ pool, requireAuth });
const fanzzy = createFanzzy({ pool, requireAuth, abonnement });

const app = express();
app.use((q, _s, n) => { q.user = { id: moi }; n(); });
app.use('/api/abonnement', abonnement.router);
app.use('/api/fanzzy', fanzzy.router);
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const get = async (p) => (await fetch(base + p)).json();

/* --------------------------------------------------- accorder et retirer */

check('un joueur inscrit n’est pas abonné', (await abonnement.estAbonne(LIBRE)) === false);

await abonnement.accorder(ABO, { formule: 'mensuel', jours: 30, source: 'admin' });
check('un abonnement accordé prend effet', (await abonnement.estAbonne(ABO)) === true);

/* **Un renouvellement pousse l'échéance, il ne la remplace pas.** Sans cela,
   renouveler trois jours avant le terme perdrait ces trois jours — et c'est
   précisément le moment où l'on renouvelle. */
{
  const avant = (await abonnement.etat(ABO)).fin;
  await abonnement.accorder(ABO, { formule: 'mensuel', jours: 30, source: 'stripe' });
  const apres = (await abonnement.etat(ABO)).fin;
  const gagne = (new Date(apres) - new Date(avant)) / 86_400_000;
  check(`un renouvellement prolonge au lieu d’écraser (${Math.round(gagne)} j)`,
    Math.round(gagne) === 30
    || (console.log('        avant', avant, '· après', apres), false));
}

/* Une échéance passée ne vaut plus, sans qu'on ait rien à effacer. */
await pool.query('UPDATE abonnements SET fin = NOW(3) - INTERVAL 1 DAY WHERE user_id = ?', [ABO]);
check('un abonnement échu ne compte plus', (await abonnement.estAbonne(ABO)) === false);
await abonnement.accorder(ABO, { formule: 'annuel', jours: 365 });
check('et on peut le reprendre', (await abonnement.estAbonne(ABO)) === true);

/* Sans terme : ce que pose un administrateur pour un bêta-testeur. Rien ne
   l'expire, et c'est voulu — un accès offert qui s'éteint sans prévenir se lit
   comme une panne. */
await abonnement.accorder(LIBRE, { formule: 'offert', jours: null });
check('un accès offert n’a pas de terme', (await abonnement.etat(LIBRE)).fin === null);
check('et il compte', (await abonnement.estAbonne(LIBRE)) === true);
await abonnement.retirer(LIBRE);
check('le retirer le retire vraiment', (await abonnement.estAbonne(LIBRE)) === false);

/* ------------------------------------------------------- ce qu'il ouvre */

/* Le rythme des boosters : une réserve plus haute et une recharge plus courte.
   Ce sont les deux seules choses que l'abonnement change au portefeuille — le
   contenu d'un booster est exactement le même, sans quoi on vendrait de la
   collection, donc de la puissance par la bande. */
{
  const libre = reglage('pack.max');
  const abo = reglage('abo.pack_max');
  check(`la réserve d’un abonné est plus haute (${libre} → ${abo})`, abo > libre);
  check('et sa recharge plus courte',
    reglage('abo.pack_regen_min') < reglage('pack.regen_min'));

  /* Le plafond s'applique vraiment : on donne à chacun de quoi déborder, et on
     relit son portefeuille. C'est le calcul de `wallet` qui est éprouvé, pas la
     valeur du réglage. */
  /* **`UTC_TIMESTAMP` et non `NOW`.** Le pilote est réglé sur UTC et `NOW(3)`
     écrit dans le fuseau de la session : relue, une date posée avec `NOW`
     atterrit deux heures dans le futur, la recharge calcule un écart négatif
     et n'ajoute rien. C'est le piège que ce projet a déjà payé sur les
     horloges de match, et il attendait ici aussi. */
  await pool.query('UPDATE user_wallet SET packs = ?, packs_at = UTC_TIMESTAMP(3) - INTERVAL 2 DAY',
    [abo + 5]);
  moi = LIBRE;
  const wLibre = (await get('/api/fanzzy/state')).wallet;
  moi = ABO;
  const wAbo = (await get('/api/fanzzy/state')).wallet;
  /* `wallet` ne rabote pas une réserve déjà au-dessus du plafond — elle cesse
     seulement d'en ajouter. Ce qui se vérifie est donc la **recharge**, pas un
     écrêtage : on remet les deux à zéro et on laisse le temps passer. */
  await pool.query('UPDATE user_wallet SET packs = 0, packs_at = UTC_TIMESTAMP(3) - INTERVAL 1 HOUR');
  moi = LIBRE;
  const rLibre = (await get('/api/fanzzy/state')).wallet.packs;
  moi = ABO;
  const rAbo = (await get('/api/fanzzy/state')).wallet.packs;
  check(`en une heure, l’abonné reçoit plus de boosters (${rLibre} contre ${rAbo})`,
    rAbo > rLibre
    || (console.log('        libre', rLibre, '· abonné', rAbo), false));
  check('et les deux portefeuilles restent lisibles',
    Number.isInteger(wLibre?.packs) && Number.isInteger(wAbo?.packs));
}

/* La route dit ce qu'il ouvre, pour que l'écran n'en porte pas sa propre copie
   — elle divergerait au premier réglage changé depuis /admin. */
{
  moi = ABO;
  const r = await get('/api/abonnement');
  check('la route rend l’état du joueur', r.abonne === true);
  check('et ce que l’abonnement ouvre', r.ouvre?.packMax === reglage('abo.pack_max'));
  check('ainsi que ce qui reste libre pour tous', Array.isArray(r.libre) && r.libre.length > 0);

  /* **Et ce qu'on a sans lui**, pour que l'écran écrive « 24 au lieu de 12 ».
     Un chiffre seul ne se compare à rien, et « plus de boosters » ne veut rien
     dire. La page avait recopié ce second nombre et annonçait « au lieu de 10 »
     quand le réglage en dit douze : un barème recopié dans une page ment au
     premier ajustement fait depuis /admin, et personne ne relit une page pour
     vérifier un nombre qu'il croit connaître. */
  check('et ce qu’on a sans lui, pour pouvoir comparer',
    r.sans?.packMax === reglage('pack.max')
    && r.sans?.packRegenMin === reglage('pack.regen_min')
    || (console.log('        elle rend :', JSON.stringify(r.sans),
      '· attendu', reglage('pack.max'), reglage('pack.regen_min')), false));
  check('et les deux ne disent pas la même chose', r.sans?.packMax !== r.ouvre?.packMax);

  /* **Les formules, avec leur prix et leur cadeau.**

     La page les écrivait en dur — « 3,99 € », « 39,90 € », « deux mois
     offerts », « un booster offert » — à côté du seul endroit qui les décide.
     Quatre nombres recopiés sur l'écran qui prend l'argent, c'est-à-dire le
     seul où se tromper coûte la confiance plutôt qu'un haussement d'épaules.

     Le jour où le cadeau annuel est passé de un à six, elle aurait continué
     d'en promettre un. Ce contrôle-là est celui qui l'aurait dit. */
  const f = r.formules ?? [];
  check(`la route rend les formules (${f.length})`, f.length >= 2);
  check('chacune porte un prix déjà mis en forme',
    f.every((x) => typeof x.prixTexte === 'string' && /\d/.test(x.prixTexte))
    || (console.log('        elles rendent :', JSON.stringify(f)), false));
  check('et un identifiant que la boutique sait commander',
    f.every((x) => ARTICLE_PAR_ID.has(x.id)));

  /* Le cadeau vient du catalogue et de nulle part ailleurs : recopié ici, ce
     contrôle mesurerait sa propre copie et ne dirait plus rien. */
  check('et le nombre de boosters que dit le catalogue',
    f.every((x) => x.packs === (ARTICLE_PAR_ID.get(x.id)?.livraison?.packs ?? 0))
    || (console.log('        elles rendent :',
      f.map((x) => `${x.id} ${x.packs}`).join(' · ')), false));

  /* **Et les deux formules ne donnent plus la même chose.** C'est la raison
     d'être du bloc dessiné sur la page : tant que le cadeau était le même des
     deux côtés, une phrase au-dessus des boutons suffisait. */
  check('l’annuelle donne plus que la mensuelle',
    Math.max(...f.map((x) => x.packs)) > Math.min(...f.map((x) => x.packs)));
}

/* --------------------------------------------- ce qu'il n'ouvre PAS

   C'est la moitié qui compte. Ces contrôles sont là pour échouer le jour où
   quelqu'un voudra « rendre l'abonnement plus attractif » en y mettant un
   avantage de jeu. */

check('tous les formats de duel restent ouverts à tous',
  Object.keys(FORMATS).length === 5
  && !Object.keys(FORMATS).some((f) => /abo/i.test(f)));

/* Aucun réglage d'abonnement ne doit toucher au duel, au deck ni au virage :
   ce sont les trois sections où se décide ce qui pèse sur la corde. */
{
  const { REGLAGES } = await import('../src/shared/reglages.js');
  const abo = REGLAGES.filter((r) => r.cle.startsWith('abo.'));
  check(`les réglages d’abonnement sont dans leur section (${abo.length})`,
    abo.length > 0 && abo.every((r) => r.section === 'abonnement'));
  const interdits = ['duel.', 'deck.', 'ferveur.', 'virage.'];
  check('et aucun ne gouverne le duel, le deck ou le virage',
    !abo.some((r) => interdits.some((p) => r.cle.replace('abo.', '').startsWith(p))));
}

/* Le module d'abonnement n'expose **aucune** porte vers le jeu lui-même. Si
   l'une apparaît, elle sera nommée ici, et il faudra la défendre. */
{
  /* La liste des exclus est de la **plomberie**, pas des portes : monter un
     routeur, lire un état, poser ou retirer une ligne, repousser une échéance
     quand le prestataire annonce une facture payée. Aucune n'ouvre quoi que ce
     soit dans le jeu.

     `renouveler` a été ajoutée ici le jour où Stripe est passé en abonnement,
     et l'y ajouter est le geste que ce contrôle réclame : on ne grossit pas la
     liste sans venir dire pourquoi. */
  const portes = Object.keys(abonnement).filter((k) =>
    !['router', 'estAbonne', 'etat', 'accorder', 'renouveler', 'retirer'].includes(k));
  const attendues = ['plafondPacks', 'regenMs', 'profondeurParcours',
    'profondeurSouvenirs', 'clubsEnPlus'];
  check(`l’abonnement n’ouvre que le rythme, la mémoire et la largeur (${portes.length})`,
    portes.length === attendues.length && portes.every((p) => attendues.includes(p))
    || (console.log('        portes :', portes.join(', ')), false));
}


/* ============================== les quatre autres portes

   Chacune ouvre de la largeur, du confort ou de l'identité — jamais de la
   puissance. On vérifie les deux côtés de chaque porte : ce qu'un abonné peut,
   et ce qu'un joueur inscrit ne peut pas encore. */

const { createSouvenirs } = await import('../src/server/souvenirs/index.js');
const { createClassements } = await import('../src/server/classements/index.js');
const { createKop } = await import('../src/server/kop/index.js');
const { createOnboarding } = await import('../src/server/onboarding/index.js');

/* ------------------------------------------------ la mémoire du parcours */

{
  const C = createClassements({ pool, requireAuth, abonnement });
  const garde = reglage('abo.parcours_libre');

  /* On sème plus de parties que la limite, une par minute, pour que leur ordre
     soit certain. `UTC_TIMESTAMP` et non `NOW` : le pilote lit en UTC. */
  const n = garde + 8;
  const lignes = Array.from({ length: n }, (_, i) =>
    `('d${i}', ?, 'x', 'win', 1, 0, NULL, NULL, 10, '1v1', 'classe',
      UTC_TIMESTAMP(3) - INTERVAL ${i} MINUTE)`).join(',');
  await pool.query(
    `INSERT INTO duel_results
       (duel_id, user_id, opponent_id, outcome, goals_for, goals_against,
        fixture_id, team_id, ferveur, format, mode, ended_at)
     VALUES ${lignes}`, Array.from({ length: n }, () => ABO));

  await abonnement.accorder(ABO, { formule: 'offert', jours: null });
  const tout = await C.historiqueDe(ABO, { limite: 50 });
  check(`un abonné voit tout son historique (${tout.lignes.length})`,
    tout.lignes.length === n
    || (console.log('        vu', tout.lignes.length, 'sur', n), false));
  check('et rien ne lui est annoncé comme tronqué', tout.tronque === false);

  await abonnement.retirer(ABO);
  const court = await C.historiqueDe(ABO, { limite: 50 });
  check(`un joueur inscrit s'arrête à la limite (${court.lignes.length})`,
    court.lignes.length === garde
    || (console.log('        vu', court.lignes.length, 'pour une garde de', garde), false));
  /* **Et il le sait.** « la mémoire s'arrête là » et « il n'a rien joué de
     plus » se ressemblent à l'écran ; les confondre laisserait croire que des
     parties ont disparu. */
  check('et on le lui dit', court.tronque === true);
  /* La pagination ne contourne pas la limite : demander une page plus lointaine
     ne doit pas rendre ce que la première a caché. */
  check('demander la suite ne rouvre pas le passé', court.suite === null);
  const plusLoin = await C.historiqueDe(ABO,
    { limite: 50, avant: court.lignes[court.lignes.length - 1].quand });
  check('et un curseur forcé ne rend rien de plus ancien',
    plusLoin.lignes.length === 0
    || (console.log('        il rend encore', plusLoin.lignes.length, 'ligne(s)'), false));

  /* Les classements, eux, ne bougent pas d'un iota : la mémoire est une
     lecture, pas un droit de jouer. */
  C.oublier();
  const duel = await C.duellistes();
  const mien = (duel ?? []).find((x) => x.public_id === ABO);
  check('et le classement compte toutes ses parties',
    Number(mien?.joues) === n
    || (console.log('        il en compte', mien?.joues, 'sur', n), false));
}

/* ----------------------------------------------- la mémoire des souvenirs */

{
  const S = createSouvenirs({ pool, requireAuth, abonnement });
  /* La lecture joint `teams` sur les deux clubs : sans eux, la requete ne
     rend rien et le controle accuserait la profondeur alors que c'est le
     decor qui manque. */
  await pool.query('INSERT IGNORE INTO teams (id, name) VALUES (85, ?), (91, ?)',
    ['FC Sion', 'FC Bale']);
  const garde = reglage('abo.souvenirs_libres');
  const n = garde + 5;
  /* La table des souvenirs porte tout le match, pas seulement une date : on
     sème donc des lignes complètes. Les valeurs sont sans importance pour ce
     contrôle — ce qui compte est leur **nombre** et leur ordre. */
  await pool.query(
    `INSERT INTO souvenirs
       (id, fixture_id, seq, league_id, family, scorer_team, home_id, away_id,
        score_home, score_away, kickoff_at, expires_at, price)
     VALUES ${Array.from({ length: n }, (_, i) =>
    `(${1000 + i}, ${9000 + i}, 1, 207, 'championnat', 85, 85, 91, 1, 0,
       UTC_TIMESTAMP(3) - INTERVAL ${i} DAY,
       UTC_TIMESTAMP(3) + INTERVAL 30 DAY, 5)`).join(',')}`);
  await pool.query(
    `INSERT INTO user_souvenirs (user_id, souvenir_id, kind)
     VALUES ${Array.from({ length: n }, (_, i) => `(?, ${1000 + i}, 'presence')`).join(',')}`,
    Array.from({ length: n }, () => ABO));

  const court = await S.collection(ABO);
  check(`un joueur inscrit voit ses ${garde} dernières cartes`, court.length === garde
    || (console.log('        il en voit', court.length), false));

  await abonnement.accorder(ABO, { formule: 'offert', jours: null });
  const tout = await S.collection(ABO);
  check(`et l'abonnement les rouvre toutes (${tout.length})`, tout.length === n
    || (console.log('        il en voit', tout.length, 'sur', n), false));

  /* **Rien n'a été effacé.** C'est la lecture qui s'arrête, et c'est la seule
     chose que ce jeu s'autorise : « fermer, c'est cesser de distribuer ». */
  const [[compte]] = await pool.query(
    'SELECT COUNT(*) AS n FROM user_souvenirs WHERE user_id = ?', [ABO]);
  check('et aucune carte n a disparu de la base', Number(compte.n) === n);
  await abonnement.retirer(ABO);
}

/* ---------------------------------------------------------- créer un KOP */

{
  const K = createKop({ pool, requireAuth, abonnement });
  await pool.query('INSERT IGNORE INTO teams (id, name) VALUES (85, ?)', ['FC Sion']);
  await pool.query('INSERT IGNORE INTO user_follows (user_id, team_id, is_main) VALUES (?, 85, 1)',
    [ABO]);

  let refus = null;
  try { await K.creer(ABO, 85, 'Les Fideles'); } catch (e) { refus = e.code; }
  check('créer un KOP sans abonnement est refusé', refus === 'kop.error.abonnement'
    || (console.log('        refus :', refus), false));

  await abonnement.accorder(ABO, { formule: 'offert', jours: null });
  const kop = await K.creer(ABO, 85, 'Les Fideles');
  const kopId = kop?.id ?? kop?.kop?.id;
  check('et un abonné le crée', Boolean(kopId)
    || (console.log('        rendu :', JSON.stringify(kop).slice(0, 140)), false));

  /* **Rejoindre reste libre.** C'est tout l'intérêt de cette porte : elle fait
     payer celui qui organise, et chaque abonné ramène des joueurs inscrits au
     lieu d'en éloigner. */
  await pool.query('INSERT IGNORE INTO user_follows (user_id, team_id, is_main) VALUES (?, 85, 1)',
    [LIBRE]);
  let refusLibre = null;
  try { await K.rejoindre(LIBRE, kopId); } catch (e) { refusLibre = e.code; }
  check('rejoindre un KOP reste ouvert à tous', refusLibre === null
    || (console.log('        refus :', refusLibre), false));
  await abonnement.retirer(ABO);
}

/* ------------------------------------------------------ porter une tenue */

{
  const O = createOnboarding({ pool, requireAuth, abonnement });
  const { tenuesPubliees } = await import('../src/server/fanzzy/tenues.js');
  const tenue = tenuesPubliees().find((t) => t.id !== 'base');
  await pool.query(
    'INSERT IGNORE INTO user_fanzzy (user_id, fanzzy_id, copies, stage) VALUES (?, ?, 1, 1)',
    [ABO, 'TR32']);

  if (!tenue) {
    check('une tenue publiée existe pour ce contrôle', false);
  } else {
    let refus = null;
    try { await O.wearSkin(ABO, 'TR32', tenue.id); } catch (e) { refus = e.code; }
    check('un joueur inscrit ne porte que ce qu il a gagné',
      refus === 'onboarding.error.not_owned'
      || (console.log('        refus :', refus), false));

    await abonnement.accorder(ABO, { formule: 'offert', jours: null });
    let leve = null;
    try { await O.wearSkin(ABO, 'TR32', tenue.id); } catch (e) { leve = e.code ?? e.message; }
    check(`un abonné porte toute tenue publiée (${tenue.id})`, leve === null
      || (console.log('        refus :', leve), false));

    /* **Et il la garde.** C'est la règle de ce jeu : une série qu'on referme
       n'efface pas les cartes de qui les possède. Reprendre une tenue qu'on a
       vue sur son personnage serait la seule chose qu'un collectionneur ne
       pardonne pas. */
    await abonnement.retirer(ABO);
    const [[gardee]] = await pool.query(
      `SELECT equipped FROM user_skins
        WHERE user_id = ? AND fanzzy_id = 'TR32' AND skin_id = ?`, [ABO, tenue.id]);
    check('et elle lui reste quand l abonnement s arrête',
      Number(gardee?.equipped) === 1
      || (console.log('        en base :', JSON.stringify(gardee)), false));

    /* Mais il n'en prend plus de nouvelles. */
    const autre = tenuesPubliees().find((t) => t.id !== 'base' && t.id !== tenue.id);
    if (autre) {
      let apres = null;
      try { await O.wearSkin(ABO, 'TR32', autre.id); } catch (e) { apres = e.code; }
      check('mais il n en prend plus de nouvelles',
        apres === 'onboarding.error.not_owned');
    }
  }
}

/* Une base sans la table ne casse rien : tout le monde y est joueur inscrit,
   ce qui est exactement l'état d'avant. C'est ce qui permet de livrer le code
   avant la migration sans fermer le jeu. */
{
  await pool.query('DROP TABLE abonnements');
  check('sans la table, personne n’est abonné et rien ne lève',
    (await abonnement.estAbonne(ABO)) === false);
  check('et l’état reste lisible', (await abonnement.etat(ABO)).abonne === false);
  moi = ABO;
  const w = (await get('/api/fanzzy/state')).wallet;
  check('le portefeuille répond quand même', Number.isInteger(w?.packs));
}

await new Promise((r) => http.close(r));
await pool.end();
console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exitCode = failures ? 1 : 0;
