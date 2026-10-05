/**
 * La présence (`src/server/presence/index.js`, `CONTRATS.md`, § 18).
 *
 * C'est la donnée la plus sensible du jeu, pour un public qui compte des
 * mineurs : la suite vérifie d'abord ce que le module **ne fait pas**, parce
 * que c'est là que la promesse se joue et que rien ne le montrerait autrement
 * — une présence servie à qui ne devrait pas la voir ne casse rien, ne lève
 * rien, et part dans le cache du navigateur d'un inconnu.
 *
 *   1. **Éteinte, rien.** `presence.actif` vaut faux à la livraison : ni état,
 *      ni lecture, ni écriture, ni mémoire ; `/api/presence` répond
 *      `{ actif: false }`.
 *   2. **Trois états, un seul, sans heure** : `virage` avant `duel` avant
 *      `en_ligne`, et « en ligne » s'arrête **à** `presence.en_ligne_sec`
 *      secondes, pas une de plus.
 *   3. **Les amis mutuels seulement** : ni une demande en attente, ni un refus,
 *      ni un inconnu, ni un compte supprimé.
 *   4. **Chacun peut se cacher, tout de suite**, et voit ses amis comme avant ;
 *      le défaut du registre vaut pour qui n'a pas choisi, et se relit à chaque
 *      fois.
 *   5. **Rien n'est écrit en base**, sauf le choix de se cacher : on compte
 *      les instructions.
 *   6. **Ce que ça coûte** : une lecture pour les amis et leurs choix, gardée
 *      deux minutes et partagée par les demandes simultanées.
 *   7. **Une colonne absente éteint**, plutôt que de montrer des joueurs à qui
 *      l'on a promis un interrupteur qui ne marche pas.
 *
 * L'horloge du module est remplacée : deux minutes passent sans qu'on les
 * attende. Les deux arènes sont doublées par deux ensembles (`auVirage`,
 * `enDuel`) : ce qui est éprouvé ici, c'est ce que la présence fait de leur
 * réponse ; ce qu'elles répondent est dans leurs suites.
 *
 * Usage : node scripts/presence-smoke.mjs
 */
import express from 'express';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPresence, ETATS, GARDE_MS } from '../src/server/presence/index.js';
import { createAmis } from '../src/server/amis/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { createStore } from '../src/server/auth/store.js';
import { poserReglages, DEFAUTS, reglage } from '../src/shared/reglages.js';
import { baseDeTest, OPTIONS_BASE, enParallele } from './base-de-test.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const meme = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ids = (liste) => liste.map((x) => x.id).sort();

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
{
  const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
  /* Les clés étrangères coupées le temps du ménage, comme `recompenses-smoke` :
     la suite ne reconstruit que ses tables, et les filles de `users` qu'une
     autre suite a laissées ne bloquent pas le `DROP`. */
  await raw.query('SET FOREIGN_KEY_CHECKS = 0');
  await raw.query(`DROP TABLE IF EXISTS abonnements, achats, parrainages, kop_invites, amities, kop_bulletins,
    kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
    user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
    duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
    team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
  await raw.query('SET FOREIGN_KEY_CHECKS = 1');
  /* Ce que lit la liste d'amis (personnage, niveau), et `arenes.sql` pour la
     colonne du choix, `user_wallet.presence`. */
  for (const f of ['auth', 'football', 'minutes', 'couleurs', 'souvenirs', 'billets', 'fanzzy',
                   'inventaire', 'skins', 'etats', 'stades', 'kop', 'amis', 'niveau', 'arenes']) {
    await raw.query(readFileSync(path.join(RACINE, 'sql', `${f}.sql`), 'utf8'));
  }
  await raw.end();
}

/* Neuf supporters, chacun pour un cas. Les identifiants ne suivent pas
   l'ordre alphabétique des rôles : la table range les paires, et une règle
   qui ne marcherait que dans un sens ne se verrait pas autrement. */
const U = {
  ANA: 'aaaaaaaa-0000-0000-0000-00000000000a', // celle qui regarde
  BOB: 'ffffffff-0000-0000-0000-00000000000b', // ami mutuel
  CLA: 'bbbbbbbb-0000-0000-0000-00000000000c', // ami mutuel
  DAN: 'eeeeeeee-0000-0000-0000-00000000000d', // demande en attente (Ana → Dan)
  EVE: 'cccccccc-0000-0000-0000-00000000000e', // a refusé Ana
  FAB: 'dddddddd-0000-0000-0000-00000000000f', // inconnu
  GUS: '99999999-0000-0000-0000-000000000010', // ami, compte supprimé plus bas
  HUG: '11111111-0000-0000-0000-000000000011', // ami, se cachera
  IDA: '22222222-0000-0000-0000-000000000012', // amie de Bob, pas d'Ana
};
const { ANA, BOB, CLA, DAN, EVE, FAB, GUS, HUG, IDA } = U;
{
  const raw = await mysql.createConnection({ uri: DB });
  for (const [nom, id] of Object.entries(U)) {
    await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
      [id, `${nom.toLowerCase()}@ex.fr`, nom[0] + nom.slice(1).toLowerCase()]);
    // Hug n'a pas de bourse : se cacher doit marcher quand même.
    if (id !== HUG) await raw.query('INSERT INTO user_wallet (user_id, scarves) VALUES (?, 0)', [id]);
  }
  const lier = (x, y, etat, par = x) => raw.query(
    'INSERT INTO amities (a, b, par, etat) VALUES (?, ?, ?, ?)',
    [x < y ? x : y, x < y ? y : x, par, etat]);
  await lier(ANA, BOB, 'amis');
  await lier(ANA, CLA, 'amis');
  await lier(ANA, DAN, 'demande');
  await lier(ANA, EVE, 'refuse');
  await lier(ANA, GUS, 'amis');
  await lier(ANA, HUG, 'amis');
  await lier(BOB, IDA, 'amis');
  await raw.end();
}

const pool = mysql.createPool({ uri: DB, connectionLimit: 12, ...OPTIONS_BASE });
await chargerCatalogue(pool);

/* Le pool que voit le module : chaque instruction y est rangée, lue ou
   écrite. « Rien n'est écrit en base » se vérifie en les comptant. */
const lues = [];
const ecrites = [];
const ranger = (sql) => (/^\s*(INSERT|UPDATE|DELETE|REPLACE|ALTER|CREATE|DROP|TRUNCATE)\b/i
  .test(sql) ? ecrites : lues).push(sql.replace(/\s+/g, ' ').trim());
const poolCompte = {
  execute: (sql, p) => { ranger(sql); return pool.execute(sql, p); },
  query: (sql, p) => { ranger(sql); return pool.query(sql, p); },
  getConnection: () => pool.getConnection(),
};
const remettre = () => { lues.length = 0; ecrites.length = 0; };

/* L'horloge du module. */
let maintenant = 1_900_000_000_000;
const horloge = () => maintenant;

/* Le journal, gardé : une panne doit s'y dire, une fois. */
const journal = [];
const log = {
  warn: (...a) => journal.push(['warn', a.join(' ')]),
  error: (...a) => journal.push(['error', a.join(' ')]),
  log() {},
};

const requireAuth = (req, res, next) => (req.user ? next()
  : res.status(401).json({ error: 'auth.error.unauthenticated' }));

/** Une présence neuve, avec ses deux arènes doublées. */
function monter() {
  const auVirage = new Set();
  const enDuel = new Set();
  const P = createPresence({ pool: poolCompte, requireAuth, horloge, log });
  P.brancher({ estAuVirage: (id) => auVirage.has(id), estEnDuel: (id) => enDuel.has(id) });
  return { P, auVirage, enDuel };
}

let { P, auVirage, enDuel } = monter();
/* Les amis parlent toujours à la présence **en cours** : la suite en remonte
   une neuve pour repartir d'une mémoire vide, et la liste doit la suivre. */
const A = createAmis({ pool, requireAuth, presence: {
  etatsPour: (...a) => P.etatsPour(...a),
  oublierAmis: (...a) => P.oublierAmis(...a),
} });

/* Les routes, montées comme le serveur les monte ; le joueur vient d'un
   en-tête, pour pouvoir en faire parler plusieurs en même temps. */
const app = express();
app.use((req, _res, next) => {
  const qui = req.get('x-qui');
  if (qui) req.user = { id: qui };
  next();
});
app.use('/api/presence', (req, res, next) => P.router(req, res, next));
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}/api/presence`;

/** Un appel à `/api/presence` : `{ status, corps }`. */
async function appel(methode, qui, corps, { brut = null, type = 'application/json' } = {}) {
  const r = await fetch(base, {
    method: methode,
    headers: { ...(qui ? { 'x-qui': qui } : {}), ...(methode === 'POST' ? { 'content-type': type } : {}) },
    ...(methode === 'POST' ? { body: brut ?? JSON.stringify(corps) } : {}),
  });
  let lu = null;
  try { lu = await r.json(); } catch { lu = null; }
  return { status: r.status, corps: lu };
}
const choixEnBase = async (id) =>
  (await pool.query('SELECT presence FROM user_wallet WHERE user_id = ?', [id]))[0][0]?.presence ?? null;

/** Rien de ce module ne ressemble à une heure : ni clé, ni grand nombre. */
const sansHeure = (o) => !/(^|[^a-z])(t|le|depuis|vu|a|at|quand|heure|ts|time)"\s*:/i
  .test(JSON.stringify(o)) && !/\d{9,}/.test(JSON.stringify(o));

try {
  /* ============================================================ éteinte */
  console.log('— éteinte, à la livraison —');
  {
    check('presence.actif est éteint par défaut', DEFAUTS['presence.actif'] === false
      && reglage('presence.actif') === false);

    remettre();
    P.noter(BOB);
    P.noter(CLA);
    auVirage.add(CLA);
    enDuel.add(BOB);
    const etats = await P.etatsPour(ANA, [BOB, CLA, HUG]);
    check('aucun état servi, même à un ami au Virage', etats.size === 0);
    check('ni dans la tribune', (await P.amisPresents(ANA, [BOB, CLA])).length === 0
      && (await P.aPrevenir(ANA, [BOB, CLA])).length === 0);
    check('personne n’est « visible »', (await P.visible(ANA)) === false);
    check('et pas une lecture en base pour le dire', lues.length === 0
      || (console.log('        lues :', lues), false));

    const g = await appel('GET', ANA);
    check('GET /api/presence → 200 { actif: false }, et rien d’autre',
      g.status === 200 && meme(g.corps, { actif: false })
      || (console.log('        il rend :', g.status, JSON.stringify(g.corps)), false));
    const p = await appel('POST', ANA, { visible: false });
    check('POST → { actif: false }', p.status === 200 && meme(p.corps, { actif: false }));
    check('et rien n’est écrit', ecrites.length === 0 && (await choixEnBase(ANA)) === null
      || (console.log('        écrites :', ecrites), false));
    const faux = await appel('POST', ANA, { visible: 'non' });
    check('un corps faux reste un corps faux, éteinte ou non',
      faux.status === 400 && meme(faux.corps, { error: 'presence.error.requete' }));

    const t = await A.tableau(ANA);
    check('/api/amis ne porte aucune pastille', !JSON.stringify(t).includes('"presence"'));

    /* Rien n'est gardé : Bob et Clara ont été « vus » pendant que la présence
       était éteinte. L'allumer ne doit pas révéler cette activité-là. */
    poserReglages({ 'presence.actif': true });
    auVirage.clear(); enDuel.clear();
    const apres = await P.etatsPour(ANA, [BOB, CLA]);
    check('allumée ensuite, rien de ce qui précède n’a été gardé', apres.size === 0
      || (console.log('        il sait :', [...apres]), false));
  }

  /* ===================================================== les trois états */
  console.log('\n— allumée : trois états, un seul, sans heure —');
  {
    const t0 = maintenant;
    P.noter(BOB);
    check('une activité à l’instant : « en_ligne »', (await P.etatsPour(ANA, [BOB])).get(BOB) === 'en_ligne');
    maintenant = t0 + 30_000;
    check('depuis 30 s : toujours « en_ligne »', (await P.etatsPour(ANA, [BOB])).get(BOB) === 'en_ligne');
    /* La borne : « depuis moins de 120 s ». Une milliseconde avant, oui ; à
       120 s pile, non. Un délai ignoré, ou lu en minutes, se verrait ici. */
    maintenant = t0 + 120_000 - 1;
    check('à 119,999 s : encore « en_ligne »', (await P.etatsPour(ANA, [BOB])).get(BOB) === 'en_ligne');
    maintenant = t0 + 120_000;
    check('à 120 s pile : hors ligne, donc absent', !(await P.etatsPour(ANA, [BOB])).has(BOB));
    maintenant = t0 + 3_600_000;
    check('une heure plus tard : absent', !(await P.etatsPour(ANA, [BOB])).has(BOB));

    /* Le délai est un réglage vivant : `/admin` le change sans redémarrer. */
    const t1 = maintenant;
    P.noter(BOB);
    maintenant = t1 + 200_000;
    poserReglages({ 'presence.actif': true, 'presence.en_ligne_sec': 300 });
    check('le délai se relit à chaque fois (300 s : encore en ligne à 200 s)',
      (await P.etatsPour(ANA, [BOB])).get(BOB) === 'en_ligne');
    poserReglages({ 'presence.actif': true });

    maintenant += 1;
    P.noter(CLA);
    auVirage.add(CLA);
    check('au Virage : « virage », même active à l’instant', (await P.etatsPour(ANA, [CLA])).get(CLA) === 'virage');
    P.noter(BOB);
    enDuel.add(BOB);
    check('en duel ou en file : « duel »', (await P.etatsPour(ANA, [BOB])).get(BOB) === 'duel');
    auVirage.add(BOB);
    check('au Virage et en duel : « virage » d’abord', (await P.etatsPour(ANA, [BOB])).get(BOB) === 'virage');
    auVirage.delete(BOB);
    enDuel.delete(BOB);

    const tous = await P.etatsPour(ANA, [BOB, CLA]);
    check('chaque valeur est l’un des trois états, une chaîne',
      [...tous.values()].every((e) => ETATS.includes(e)) && ETATS.length === 3);

    /* Une arène qui rendrait une promesse : un `if` sans `await` la croirait
       vraie, et tout le monde serait au Virage. */
    P.brancher({ estAuVirage: async (id) => auVirage.has(id), estEnDuel: async (id) => enDuel.has(id) });
    const asynchrone = await P.etatsPour(ANA, [BOB, CLA]);
    check('une arène qui répond par une promesse est attendue, pas crue sur parole',
      asynchrone.get(CLA) === 'virage' && asynchrone.get(BOB) === 'en_ligne'
      || (console.log('        il dit :', [...asynchrone]), false));

    /* Une arène qui lève ne fait tomber ni la liste ni les autres états. */
    journal.length = 0;
    P.brancher({ estAuVirage: (id) => auVirage.has(id), estEnDuel: () => { throw new Error('salle illisible'); } });
    let leve = null;
    let malgre = null;
    try { malgre = await P.etatsPour(ANA, [BOB, CLA]); } catch (e) { leve = e; }
    check('une arène qui lève : la liste passe, sans l’état qu’elle devait dire',
      !leve && malgre?.get(CLA) === 'virage' && malgre?.get(BOB) === 'en_ligne');
    await P.etatsPour(ANA, [BOB, CLA]);
    check('et le journal le dit une fois, pas à chaque lecture',
      journal.filter(([n, m]) => n === 'error' && /estEnDuel/.test(m)).length === 1
      || (console.log('        journal :', JSON.stringify(journal)), false));
    P.brancher({ estAuVirage: (id) => auVirage.has(id), estEnDuel: (id) => enDuel.has(id) });

    /* Une arène absente se dit au montage : c'est la panne muette que
       `verif-cablage` surveille, et le journal du démarrage doit la nommer. */
    journal.length = 0;
    P.brancher({ estAuVirage: (id) => auVirage.has(id) });
    check('une arène non branchée se dit au journal',
      journal.some(([n, m]) => n === 'warn' && /duel non branché/.test(m)));
    check('et ne dit jamais « duel »', (enDuel.add(BOB), (await P.etatsPour(ANA, [BOB])).get(BOB)) === 'en_ligne');
    enDuel.delete(BOB);
    P.brancher({ estAuVirage: (id) => auVirage.has(id), estEnDuel: (id) => enDuel.has(id) });
  }

  /* ================================================ les amis mutuels seuls */
  console.log('\n— les amis mutuels, et eux seuls —');
  {
    /* Ana aussi est active : sans quoi « rien du côté de Dan » serait vrai
       pour une mauvaise raison. */
    P.noter(ANA);
    for (const id of [DAN, EVE, FAB, GUS, IDA]) { P.noter(id); auVirage.add(id); }
    const etats = await P.etatsPour(ANA, [BOB, CLA, DAN, EVE, FAB, GUS, IDA]);
    check('une demande en attente : rien', !etats.has(DAN));
    check('dans l’autre sens non plus', !(await P.etatsPour(DAN, [ANA])).has(ANA));
    check('un refus : rien, ni dans un sens ni dans l’autre',
      !etats.has(EVE) && !(await P.etatsPour(EVE, [ANA])).has(ANA));
    check('un inconnu : rien, même passé dans la liste', !etats.has(FAB));
    check('l’amie d’un ami : rien', !etats.has(IDA));
    check('les amis mutuels, si', etats.get(BOB) === 'en_ligne' && etats.get(CLA) === 'virage');
    check('et l’on ne se voit pas soi-même', !(await P.etatsPour(ANA, [ANA])).has(ANA));

    /* Un compte supprimé : la ligne d'amitié survit (le compte est anonymisé,
       pas effacé), mais rien de lui ne doit plus apparaître. */
    const [[{ id: interne }]] = await pool.query('SELECT id FROM users WHERE public_id = ?', [GUS]);
    await createStore(pool).deleteUser(interne);
    P.oublierAmis(ANA, GUS);
    P.noter(GUS);
    check('un ami au compte supprimé : rien', !(await P.etatsPour(ANA, [GUS])).has(GUS));

    const dansLaSalle = [ANA, BOB, CLA, DAN, EVE, FAB, GUS, IDA];
    check('dans la tribune, Ana voit ses amis mutuels présents, et eux seuls',
      meme(ids(await P.amisPresents(ANA, dansLaSalle)), [BOB, CLA].sort())
      || (console.log('        elle voit :', JSON.stringify(await P.amisPresents(ANA, dansLaSalle))), false));
    check('et son arrivée n’est annoncée qu’à eux',
      meme(ids(await P.aPrevenir(ANA, dansLaSalle)), [BOB, CLA].sort()));
    check('un ami absent de la salle n’y est pas compté',
      meme(ids(await P.amisPresents(ANA, [FAB, DAN])), []));

    const t = await A.tableau(ANA);
    check('/api/amis : la pastille sur les amis',
      t.amis.find((g) => g.id === BOB)?.presence === 'en_ligne'
      && t.amis.find((g) => g.id === CLA)?.presence === 'virage');
    check('jamais sur une demande envoyée',
      t.envoyees.some((g) => g.id === DAN) && t.envoyees.every((g) => !('presence' in g)));
    check('ni sur un ami au compte supprimé', !('presence' in (t.amis.find((g) => g.id === GUS) ?? {})));
    check('et du côté de Dan, rien sur la demande reçue',
      (await A.tableau(DAN)).recues.every((g) => !('presence' in g)));
    for (const id of [DAN, EVE, FAB, GUS, IDA]) auVirage.delete(id);
  }

  /* ========================================================= se cacher */
  console.log('\n— apparaître hors ligne —');
  {
    P.noter(HUG);
    auVirage.add(HUG);
    check('Hug, visible, est vu au Virage', (await P.etatsPour(ANA, [HUG])).get(HUG) === 'virage');
    /* Et sur la liste d'Ana, telle que `/api/amis` la sert : sans cette
       lecture-ci, « il disparaît de sa liste » plus bas serait vrai pour une
       mauvaise raison. Elle remplit aussi la mémoire d'Ana — c'est elle que
       le choix de Hug doit battre. */
    const pastilleDeHug = async () => (await A.tableau(ANA)).amis.find((g) => g.id === HUG)?.presence;
    check('et sa liste chez Ana porte « virage »', (await pastilleDeHug()) === 'virage');

    remettre();
    const r = await appel('POST', HUG, { visible: false });
    check('POST { visible: false } → { actif: true, visible: false }',
      r.status === 200 && meme(r.corps, { actif: true, visible: false })
      || (console.log('        il rend :', r.status, JSON.stringify(r.corps)), false));
    check('le choix est écrit, même sans bourse au départ', Number(await choixEnBase(HUG)) === 0);
    check('et seul le choix est écrit (la bourse ouverte par la règle commune)',
      ecrites.length === 2 && /^INSERT IGNORE INTO user_wallet/.test(ecrites[0])
      && /^UPDATE user_wallet SET presence = \?/.test(ecrites[1])
      || (console.log('        écrites :', ecrites), false));

    /* Tout de suite : la mémoire d'Ana gardait Hug visible depuis une seconde. */
    check('caché, il disparaît tout de suite de chez ses amis', !(await P.etatsPour(ANA, [HUG])).has(HUG));
    check('et de la liste d’Ana (/api/amis), sans attendre les deux minutes de sa mémoire',
      (await pastilleDeHug()) === undefined);
    check('et de leur tribune', meme(ids(await P.amisPresents(ANA, [HUG, BOB])), [BOB]));
    check('son arrivée n’est annoncée à personne', (await P.aPrevenir(HUG, [ANA, BOB])).length === 0);

    P.noter(ANA);
    check('lui voit ses amis comme avant', (await P.etatsPour(HUG, [ANA])).get(ANA) === 'en_ligne'
      && meme(ids(await P.amisPresents(HUG, [ANA])), [ANA]));
    check('et l’arrivée d’Ana lui est annoncée, caché ou non',
      meme(ids(await P.aPrevenir(ANA, [HUG, BOB, FAB])), [BOB, HUG].sort()));

    const g = await appel('GET', HUG);
    check('GET le relit : { actif: true, visible: false }', meme(g.corps, { actif: true, visible: false }));

    /* Une seconde instance, qui n'a jamais rien gardé de Hug : c'est la base
       qui doit le dire, pas la mémoire de la première. */
    const autre = monter();
    autre.auVirage.add(HUG);
    autre.P.noter(HUG);
    check('le choix tient en base, pas seulement en mémoire', !(await autre.P.etatsPour(ANA, [HUG])).has(HUG));

    const de = await appel('POST', HUG, { visible: true });
    check('il se remontre, tout de suite', de.corps?.visible === true
      && (await P.etatsPour(ANA, [HUG])).get(HUG) === 'virage');
    auVirage.delete(HUG);
  }

  /* ================================================ le défaut du registre */
  console.log('\n— le défaut du registre —');
  {
    poserReglages({ 'presence.actif': true, 'presence.visible_defaut': false });
    P.noter(BOB);
    P.noter(CLA);
    check('défaut à faux : qui n’a pas choisi est absent', !(await P.etatsPour(ANA, [BOB])).has(BOB));
    check('GET le dit à l’intéressé', meme((await appel('GET', BOB)).corps, { actif: true, visible: false }));
    await appel('POST', CLA, { visible: true });
    check('qui a choisi d’être vu l’est', (await P.etatsPour(ANA, [CLA])).has(CLA));

    poserReglages({ 'presence.actif': true, 'presence.visible_defaut': true });
    check('le défaut se relit à chaque fois, sans attendre la mémoire',
      (await P.etatsPour(ANA, [BOB])).has(BOB));
    await appel('POST', CLA, { visible: false });
    poserReglages({ 'presence.actif': true, 'presence.visible_defaut': true });
    check('et un joueur qui a choisi de se cacher garde son choix', !(await P.etatsPour(ANA, [CLA])).has(CLA));
    await pool.query('UPDATE user_wallet SET presence = NULL WHERE user_id = ?', [CLA]);
    ({ P, auVirage, enDuel } = monter());
  }

  /* ===================================================== le corps du POST */
  console.log('\n— l’interrupteur : le corps, la session —');
  {
    const faux = [
      ['un objet vide', { corps: {} }],
      ['une chaîne pour un booléen', { corps: { visible: 'false' } }],
      ['un nombre pour un booléen', { corps: { visible: 0 } }],
      ['null', { corps: { visible: null } }],
      ['une clé de trop', { corps: { visible: false, depuis: 1 } }],
      ['un tableau', { corps: [false] }],
      ['une chaîne JSON', { brut: '"false"' }],
      ['un JSON illisible', { brut: '{"visible":' }],
      ['un corps trop long', { brut: JSON.stringify({ visible: false, x: 'a'.repeat(4000) }) }],
      ['un autre type que JSON', { brut: 'visible=false', type: 'application/x-www-form-urlencoded' }],
      ['rien du tout', { brut: '' }],
    ];
    remettre();
    for (const [quoi, o] of faux) {
      const r = await appel('POST', ANA, o.corps, { brut: o.brut ?? null, type: o.type });
      check(`${quoi} → 400 presence.error.requete`,
        r.status === 400 && meme(r.corps, { error: 'presence.error.requete' })
        || (console.log('        il rend :', r.status, JSON.stringify(r.corps)), false));
    }
    check('et aucun n’écrit rien', ecrites.length === 0 && (await choixEnBase(ANA)) === null);
    check('sans session : 401', (await appel('GET', null)).status === 401
      && (await appel('POST', null, { visible: false })).status === 401);
  }

  /* ========================================================= sans heure */
  console.log('\n— jamais d’heure, jamais le match —');
  {
    const reponses = [await appel('GET', ANA), await appel('POST', ANA, { visible: true })];
    check('/api/presence ne rend que actif et visible, en booléens',
      reponses.every((r) => Object.keys(r.corps).every((k) => ['actif', 'visible'].includes(k))
        && Object.values(r.corps).every((v) => typeof v === 'boolean')));
    check('aucune clé ni valeur d’heure', reponses.every((r) => sansHeure(r.corps)));

    P.noter(BOB);
    auVirage.add(CLA);
    const allumee = await A.tableau(ANA);
    poserReglages({});
    const eteinte = await A.tableau(ANA);
    poserReglages({ 'presence.actif': true });
    const cles = (t, id) => Object.keys(t.amis.find((g) => g.id === id) ?? {}).sort();
    check('/api/amis : la pastille est la seule clé ajoutée',
      meme(cles(allumee, BOB), [...cles(eteinte, BOB), 'presence'].sort())
      && meme(cles(allumee, CLA), [...cles(eteinte, CLA), 'presence'].sort())
      || (console.log('        allumée :', cles(allumee, BOB), '· éteinte :', cles(eteinte, BOB)), false));
    check('et sa valeur est un des trois mots, rien d’autre',
      allumee.amis.filter((g) => 'presence' in g).every((g) => ETATS.includes(g.presence)));
    auVirage.delete(CLA);
  }

  /* =============================================== rien d'écrit en base */
  console.log('\n— rien d’écrit en base —');
  {
    remettre();
    for (let i = 0; i < 100; i += 1) P.noter(i % 2 ? BOB : CLA);
    await P.etatsPour(ANA, [BOB, CLA, DAN]);
    await P.amisPresents(ANA, [BOB, CLA]);
    await P.aPrevenir(ANA, [BOB, CLA]);
    await P.visible(BOB);
    await appel('GET', ANA);
    await A.tableau(ANA);
    check('cent activités, des états, la tribune, la liste : pas une écriture',
      ecrites.length === 0 || (console.log('        écrites :', ecrites), false));
  }

  /* ===================================================== ce que ça coûte */
  console.log('\n— une lecture pour deux minutes —');
  {
    ({ P, auVirage, enDuel } = monter());
    remettre();
    const salle = [BOB, CLA, HUG, DAN, FAB];
    /* Dix entrées à la même seconde, au coup d'envoi : une lecture. */
    await enParallele(10, () => P.amisPresents(ANA, salle));
    const amities = () => lues.filter((s) => /FROM amities/.test(s)).length;
    const choixSeuls = () => lues.filter((s) => /^SELECT presence AS choix/.test(s)).length;
    check('dix entrées simultanées : une seule lecture des amis',
      amities() === 1 || (console.log('        lectures :', amities()), false));
    check('et les choix des amis viennent avec, sans une lecture chacun', choixSeuls() === 0);

    for (let i = 0; i < 50; i += 1) await P.amisPresents(ANA, salle);
    await P.etatsPour(ANA, salle);
    check('cinquante de plus dans les deux minutes : toujours une', amities() === 1);

    maintenant += GARDE_MS;
    await P.amisPresents(ANA, salle);
    check('passé deux minutes, on relit', amities() === 2);

    /* **Ce que paie une entrée dans la tribune**, telle que le Virage la fait :
       `amisPresents`, puis `aPrevenir`. Dans le cas courant — aucun ami dans
       la salle —, une lecture et une seule : celle des amis. Le choix de
       l'entrant ne se lit que s'il y a quelqu'un à prévenir. Une présence
       neuve, pour que rien ne soit déjà en mémoire. */
    ({ P, auVirage, enDuel } = monter());
    remettre();
    const sansAmi = [FAB, IDA, DAN, EVE];
    const vus = await P.amisPresents(ANA, sansAmi);
    const prevenus = await P.aPrevenir(ANA, sansAmi);
    check('une entrée sans ami dans la salle : une seule lecture, celle des amis',
      vus.length === 0 && prevenus.length === 0 && lues.length === 1 && amities() === 1
      || (console.log('        lectures :', lues), false));
    remettre();
    const avecBob = await P.aPrevenir(ANA, [FAB, BOB]);
    check('avec un ami dans la salle, son propre choix se lit, une fois',
      meme(ids(avecBob), [BOB]) && choixSeuls() === 1 && amities() === 0
      || (console.log('        lectures :', lues), false));
    await P.aPrevenir(ANA, [FAB, BOB]);
    check('et reste en mémoire les deux minutes suivantes', choixSeuls() === 1 && amities() === 0);

    /* Deux onglets, puis dix, qui posent le même choix en même temps. */
    for (const n of [2, 10]) {
      const r = await enParallele(n, () => appel('POST', BOB, { visible: false }));
      check(`${n} onglets qui se cachent ensemble : tous répondent, le choix tient`,
        r.every((x) => x.status === 200 && x.corps?.visible === false)
        && Number(await choixEnBase(BOB)) === 0 && !(await P.etatsPour(ANA, [BOB])).has(BOB));
      await appel('POST', BOB, { visible: true });
    }
  }

  /* ====================================== une amitié qui change, tout de suite */
  console.log('\n— une amitié qui change vaut tout de suite —');
  {
    P.noter(FAB);
    check('Fab, inconnu, n’apparaît pas', !(await P.etatsPour(ANA, [FAB])).has(FAB));
    await A.demander(ANA, FAB);
    await A.repondre(FAB, ANA, true);
    check('ami accepté : il apparaît sans attendre la mémoire',
      (await P.etatsPour(ANA, [FAB])).get(FAB) === 'en_ligne');
    await A.retirer(FAB, ANA);
    check('ami retiré : il disparaît sans attendre la mémoire', !(await P.etatsPour(ANA, [FAB])).has(FAB));

    /* Une amitié qui change **pendant** qu'une lecture est en vol. L'oubli
       vide la place de cette lecture, une neuve s'y assoit ; la première, en
       finissant, ne doit pas l'en chasser : la demande suivante rejoindrait
       sinon une troisième lecture au lieu de la deuxième, déjà en route. Les
       lectures des amis sont retenues à la porte, une par une, pour que
       l'ordre soit celui qu'on écrit et non celui du hasard. */
    const portes = [];
    const poolRetenu = {
      execute: async (sql, p) => {
        if (/FROM amities/.test(sql)) await new Promise((ouvre) => portes.push(ouvre));
        return poolCompte.execute(sql, p);
      },
      query: (sql, p) => poolCompte.query(sql, p),
    };
    const R = createPresence({ pool: poolRetenu, requireAuth, horloge, log });
    R.brancher({ estAuVirage: (id) => auVirage.has(id), estEnDuel: (id) => enDuel.has(id) });
    const salle = [BOB, CLA, HUG];
    const premiere = R.amisPresents(ANA, salle);
    R.oublierAmis(ANA, FAB);
    const deuxieme = R.amisPresents(ANA, salle);
    portes[0]();
    await premiere;
    const troisieme = R.amisPresents(ANA, salle);
    check('une amitié qui change en plein vol : la demande suivante rejoint la lecture neuve',
      portes.length === 2 || (console.log('        lectures parties :', portes.length), false));
    for (const ouvre of portes) ouvre();
    /* Une éventuelle troisième lecture s'est assise après le tour d'ouverture :
       on la laisse partir aussi, sans quoi la suite attendrait pour toujours. */
    await new Promise((r) => setImmediate(r));
    for (const ouvre of portes) ouvre();
    check('et chacun a sa réponse',
      (await Promise.all([deuxieme, troisieme])).every((l) => meme(ids(l), [BOB, CLA, HUG].sort())));
  }

  /* ================================================== la colonne absente */
  console.log('\n— sans sql/arenes.sql : éteinte, pas exposée —');
  {
    await pool.query('ALTER TABLE user_wallet DROP COLUMN presence');
    ({ P, auVirage, enDuel } = monter());
    journal.length = 0;
    P.noter(BOB);
    let leve = null;
    let etats = null;
    try { etats = await P.etatsPour(ANA, [BOB]); } catch (e) { leve = e; }
    check('la liste ne lève pas', !leve || (console.log('        levé :', leve.message), false));
    check('mais ne montre personne : sans colonne, personne ne peut se cacher', etats?.size === 0);
    check('le tiroir ne dessine pas l’interrupteur', meme((await appel('GET', ANA)).corps, { actif: false }));
    check('un POST ne fait rien croire', meme((await appel('POST', ANA, { visible: false })).corps, { actif: false }));
    check('le journal nomme le fichier, une fois',
      journal.filter(([n, m]) => n === 'warn' && /sql\/arenes\.sql/.test(m)).length === 1
      || (console.log('        journal :', JSON.stringify(journal)), false));

    await pool.query('ALTER TABLE user_wallet ADD COLUMN IF NOT EXISTS presence TINYINT(1) NULL');
    maintenant += 10 * 60_000;
    P.noter(BOB);
    check('la colonne rendue, dix minutes plus tard, la présence revient sans redémarrer',
      (await P.etatsPour(ANA, [BOB])).get(BOB) === 'en_ligne');
  }

  /* ========================================================= l'éteindre */
  console.log('\n— l’éteindre efface —');
  {
    P.noter(BOB);
    auVirage.add(CLA);
    poserReglages({});
    check('éteinte depuis /admin : plus rien, à la lecture suivante',
      (await P.etatsPour(ANA, [BOB, CLA])).size === 0);
    poserReglages({ 'presence.actif': true });
    auVirage.delete(CLA);
    check('rallumée : l’activité d’avant l’extinction est oubliée',
      !(await P.etatsPour(ANA, [BOB])).has(BOB));
  }
} finally {
  poserReglages({});
  await new Promise((r) => http.close(r));
  await pool.end();
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
/* `process.exitCode` et non `process.exit()` : sous Windows, couper la boucle
   avant que le pool ait rendu ses sockets fait échouer la suite au hasard
   (`ETAT.md`, § 2). */
process.exitCode = failures ? 1 : 0;
