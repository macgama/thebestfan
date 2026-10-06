/**
 * Test du niveau et de l'XP.
 *
 * Deux moitiés, et la seconde est celle qui compte.
 *
 * La **courbe** se vérifie sans base : c'est de l'arithmétique, et une faute
 * s'y voit tout de suite. Ce qui ne se voit pas, ce sont les **conséquences** —
 * un palier qui n'ouvre rien, une série accessible avant son niveau, un
 * emplacement de deck que le serveur refuse alors que l'écran le proposait.
 *
 * D'où la règle que ce fichier éprouve d'abord : **le niveau ouvre, il ne donne
 * pas.** Un joueur de niveau 30 n'a aucun avantage sur la corde. S'il en gagnait
 * un, l'ancienneté deviendrait de la puissance et le nouveau venu n'aurait plus
 * de raison de rester — et ça, aucun test d'équilibrage ne le rattraperait
 * après coup.
 *
 * Depuis le chantier serveur d'octobre 2026, deux promesses de plus, qui
 * viennent de la même porte (`gagner()` et `gagnerDans()`) :
 *
 *   — **un gain d'XP est atomique** (défaut E2). Deux gains simultanés
 *     lisaient la même XP : un palier payé deux fois, ou jamais. La course
 *     est rendue *certaine* par un crochet posé entre la lecture et
 *     l'écriture, et elle se joue sur deux bases : celle du poste, et une
 *     qui éteint l'isolation par instantané, comme les MariaDB d'avant 11.6 ;
 *   — **le résultat porte la jauge** (`CONTRATS.md`, § 1) : `gain`, `dans`,
 *     `pour`, `part`, `max` et `depart`, comparés à des valeurs écrites à la
 *     main, jamais recalculées par les fonctions qu'on éprouve.
 *
 * Usage : node scripts/niveau-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer } from 'node:http';
import { createNiveau } from '../src/server/niveau/index.js';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { createDecks } from '../src/server/deck/index.js';
import { createOnboarding } from '../src/server/onboarding/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { XP, PALIERS, NIVEAU_MAX, seuil, niveauPour, progression, droits, coutDuPalier,
  ecarpesDuPalier, paliersEntre } from '../src/shared/niveau.js';
import { baseDeTest, OPTIONS_BASE, enParallele } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ============================================================== la courbe

   Sans base : de l'arithmétique pure, et c'est là que se cachent les fautes de
   borne — un seuil décalé d'un cran, un niveau maximum qu'on dépasse.        */

check('on commence au niveau 1', niveauPour(0) === 1 && seuil(1) === 0);
check('le premier palier coûte 60', coutDuPalier(1) === 60 && seuil(2) === 60);
check('juste en dessous, on n’est pas monté', niveauPour(59) === 1);
check('au seuil exact, on monte', niveauPour(60) === 2);
check('les paliers s’allongent',
  coutDuPalier(2) > coutDuPalier(1) && coutDuPalier(9) > coutDuPalier(8));

// La courbe doit rester strictement croissante : un seuil qui repasse en
// dessous du précédent ferait redescendre un joueur d'un niveau.
{
  let croissante = true;
  for (let n = 1; n < NIVEAU_MAX; n++) if (seuil(n + 1) <= seuil(n)) croissante = false;
  check('les seuils sont strictement croissants', croissante);
}
check('le niveau maximum ne se dépasse pas',
  niveauPour(seuil(NIVEAU_MAX) * 10) === NIVEAU_MAX);

{
  const p = progression(seuil(4) + 30);
  check('la jauge dit où on en est dans son palier',
    p.niveau === 4 && p.dans === 30 && p.pour === coutDuPalier(4));
  check('et la part est entre 0 et 1', p.part > 0 && p.part < 1);
}
check('au niveau maximum, la jauge est pleine plutôt que divisée par zéro',
  progression(seuil(NIVEAU_MAX)).part === 1 && progression(seuil(NIVEAU_MAX)).max === true);

/* --------------------------------------------------------- les déblocages */

{
  const d1 = droits(1);
  check('au niveau 1 : deux clubs, deux Fanzzy',
    d1.slots === 2 && d1.deckFanzzy === 2);

  /* **Le niveau n'ouvre plus de séries**, et c'est ce que ce contrôle défend.
     Elles s'ouvrent par saison, pour tout le monde le même jour. Un `series`
     qui réapparaîtrait ici serait le retour de la règle qu'on vient de retirer,
     et deux règles pour une question laissent le joueur deviner laquelle le
     refuse. */
  check('le niveau n’ouvre aucune série',
    droits(NIVEAU_MAX).series === undefined
    && PALIERS.every((p) => p.series === undefined));

  const dMax = droits(NIVEAU_MAX);
  check('et les huit emplacements de club', dMax.slots === 8);
  check('et les trois emplacements de deck', dMax.deckFanzzy === 3);

  // Les droits ne doivent jamais reculer : un palier mal écrit — un `slots: 3`
  // posé après un `slots: 4` — retirerait un emplacement en montant de niveau,
  // et le joueur perdrait un club sans comprendre pourquoi.
  let recul = null;
  let avant = droits(1);
  for (let n = 2; n <= NIVEAU_MAX; n++) {
    const d = droits(n);
    if (d.slots < avant.slots || d.deckFanzzy < avant.deckFanzzy) recul = n;
    avant = d;
  }
  check('aucun palier ne retire quoi que ce soit',
    recul === null || (console.log('        recul au niveau', recul), false));

  check('chaque palier apporte quelque chose',
    PALIERS.every((p) => p.slots || p.deckFanzzy));
  check('les paliers sont dans l’ordre',
    PALIERS.every((p, i) => i === 0 || p.niveau > PALIERS[i - 1].niveau));
  /* L'intervalle a changé parce que les paliers se sont clairsemés : ceux qui
     ouvraient des séries sont partis avec elles. Ce que le contrôle défend est
     le même — deux niveaux franchis d'un coup n'avalent aucun palier — et il le
     vérifie sur un intervalle qui en contient toujours deux. */
  check('deux niveaux d’un coup n’avalent aucun palier',
    paliersEntre(3, 5).map((p) => p.niveau).join(',') === '4,5');
  check('et un intervalle sans palier n’en invente pas',
    paliersEntre(6, 8).length === 0);
}

/* ============================================================== en base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
/* `saisons` fait partie du ménage, et son absence coûtait cher.

   Cette suite ne la créait ni ne la supprimait : elle héritait donc de celle
   qu'une autre avait laissée. Or `fanzzy-ui` et `onboarding` lancent une
   saison qui n'ouvre que LA TRIBUNE — après elles, « un joueur de niveau 1
   ouvre la série qui demandait le niveau 26 » échouait sur
   `fanzzy.error.set_closed`, et accusait le niveau alors que la série était
   simplement fermée. Le rouge dépendait de l’ordre des suites, donc il
   apparaissait une fois sur trois et jamais quand on le cherchait. */
await raw.query(`DROP TABLE IF EXISTS pronostics, parrainages, abonnements, saisons, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql',
                 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql', 'deck.sql', 'niveau.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = 'cccccccc-0000-0000-0000-00000000000n'.replace('n', '1');
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
  [U, 'niv@ex.fr', 'Grimpeur']);
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs) VALUES (?,0,40)`, [U]);
/* Un second joueur pour la jauge et les courses : le premier porte l'état
   que les contrôles des clubs et du deck construisent pas à pas, et le
   remettre à zéro au milieu les ferait mentir. */
const V = 'cccccccc-0000-0000-0000-000000000002';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
  [V, 'jauge@ex.fr', 'Jaugeur']);
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs) VALUES (?,0,0)`, [V]);
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle'),(60,'Lugano'),(61,'Coire')`);
await raw.end();

/* Douze connexions : dix gains simultanés en tiennent dix pendant qu'ils
   attendent le verrou du joueur, et celui qui le tient doit encore pouvoir
   relire la bourse. Avec six, la course de dix se jouait à six — et une
   mutation qui retire le verrou passait par moins de lectures croisées
   qu'annoncé. */
const pool = mysql.createPool({ uri: DB, connectionLimit: 12, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);

const requireAuth = (r, _s, n) => { r.user = { id: U }; n(); };
const niveau = createNiveau({ pool, requireAuth });
const fanzzy = createFanzzy({ pool, requireAuth, niveau });
const decks = createDecks({ pool, requireAuth, niveau });
const onboarding = createOnboarding({ pool, requireAuth, niveau });

const app = express();
app.use('/api/niveau', niveau.router);
app.use('/api/fanzzy', fanzzy.router);
app.use('/api/deck', decks.router);
app.use('/api/me', onboarding.router);
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const call = async (p, o = {}) => {
  const r = await fetch(base + p, { method: o.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const xpEnBase = async () =>
  Number((await pool.query('SELECT xp FROM user_wallet WHERE user_id = ?', [U]))[0][0].xp);
const solde = async () =>
  Number((await pool.query('SELECT scarves FROM user_wallet WHERE user_id = ?', [U]))[0][0].scarves);

let r = await call('/api/niveau');
check('un nouveau joueur est au niveau 1 sans XP', r.json.niveau === 1 && r.json.xp === 0);
check('et la route annonce le barème',
  r.json.gains?.pack === XP.pack && r.json.gains?.duel?.classe === XP.duel.classe);
/* La route du niveau ne sert plus de séries. Elles ne dépendent plus du
   joueur : une saison les ouvre pour tout le monde le même jour, et le
   catalogue les porte déjà. Redire ici ce qui vaut pour tous serait une
   seconde vérité à tenir à jour. */
check('la route du niveau ne parle pas de séries', r.json.series === undefined);

/* Les écharpes de chaque niveau. Le chemin du profil annonce ce que chaque
   nœud à venir versera ; `paliers` ne le disait que pour les niveaux qui
   ouvrent quelque chose, et la page recopiait la règle pour les autres. Les
   valeurs sont écrites à la main : relues dans `ecarpesDuPalier`, elles
   diraient seulement que la route est d'accord avec la fonction qu'elle
   appelle. Dix par niveau, de 20 au niveau 2 à 300 au niveau 30, et 4 640 en
   tout — le total que l'en-tête de `shared/niveau.js` promet. */
const annonce = new Map((r.json.echarpesParNiveau ?? []).map((p) => [p.niveau, p.echarpes]));
{
  const liste = r.json.echarpesParNiveau ?? [];
  check('la route sert les écharpes des vingt-neuf niveaux, du 2 au 30, dans l’ordre',
    liste.length === 29 && liste.every((p, i) => p.niveau === i + 2
      && Object.keys(p).sort().join(',') === 'echarpes,niveau')
    || (console.log('        niveaux :', liste.map((p) => p.niveau).join(',')), false));
  check('20 au niveau 2, 30 au 3, 50 au 5, 130 au 13, 300 au 30',
    annonce.get(2) === 20 && annonce.get(3) === 30 && annonce.get(5) === 50
    && annonce.get(13) === 130 && annonce.get(30) === 300
    || (console.log('        annoncé :', JSON.stringify(liste)), false));
  check('4 640 écharpes en tout, ni plus ni moins',
    liste.reduce((s, p) => s + p.echarpes, 0) === 4640);
  /* Une seule vérité : un palier qui ouvre quelque chose annonce, dans
     `paliers`, le même montant que la table complète. */
  check('et les paliers qui ouvrent quelque chose disent la même chose',
    (r.json.paliers ?? []).length === PALIERS.length
    && r.json.paliers.every((p) => annonce.get(p.niveau) === p.echarpes)
    || (console.log('        paliers :', JSON.stringify(r.json.paliers)), false));
}

/* ------------------------------------------------- l'XP se gagne en jouant */

const avantXp = await xpEnBase();
r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'TR' } });
check('un booster s’ouvre', r.json.cards?.length === 5);
check('et il rapporte de l’XP', (await xpEnBase()) === avantXp + XP.pack);
check('l’ouverture annonce la progression', r.json.niveau?.xp === avantXp + XP.pack);
/* Le contrat le dit enrichi (`CONTRATS.md`, § 1) : la jauge d'avant et le gain
   voyagent avec le butin, pour que l'anneau s'anime sans relire `/api/niveau`.
   Les douze champs, ni plus ni moins : un champ de trop serait une promesse
   que personne n'a écrite. */
{
  const n = r.json.niveau ?? {};
  check('et la réponse du booster porte les douze champs de la jauge',
    Object.keys(n).sort().join(',')
      === 'avant,dans,depart,ecarpes,gain,max,monte,niveau,paliers,part,pour,xp'
    || (console.log('        champs :', Object.keys(n).sort().join(',')), false));
  check('dont le gain du booster et la jauge d’avant',
    n.gain === XP.pack && n.depart?.xp === avantXp && n.depart?.niveau === 1
    || (console.log('        niveau :', JSON.stringify(n)), false));
}

/* ----------------------------- le niveau ne ferme plus aucune série

   Il y avait ici un contrôle du refus « série au-dessus de ton niveau ». Il
   n'a plus de sujet : les séries s'ouvrent par saison, pour tout le monde le
   même jour, et un joueur de niveau 1 tire dans tout ce qui est ouvert.

   C'est la règle qu'on vérifie maintenant, et dans ce sens-là : LE VIRAGE
   IMPOSSIBLE s'ouvrait au niveau 26. Le demander au niveau 1 doit marcher. */

r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'IM' } });
check('un joueur de niveau 1 ouvre la série qui demandait le niveau 26',
  r.json.cards?.length === 5
  || (console.log('        refus :', r.json.error), false));

/* ------------------------------------------------------ monter de palier */

// On pose l'XP juste sous le seuil du niveau 4, celui qui ouvre un club de
// plus : le palier suivant doit tomber au prochain geste, et pas avant.
await pool.query('UPDATE user_wallet SET xp = ?, scarves = 0 WHERE user_id = ?',
  [seuil(4) - 1, U]);
check('juste sous le seuil, on est encore au niveau 3',
  (await call('/api/niveau')).json.niveau === 3);

const monte = await niveau.gagner(U, 1);
check('un point suffit à franchir le palier', monte.monte === true && monte.niveau === 4);
check('le palier franchi est nommé',
  monte.paliers.length === 1 && monte.paliers[0].niveau === 4);
check('les écharpes du palier sont versées',
  monte.ecarpes === ecarpesDuPalier(4) && (await solde()) === ecarpesDuPalier(4));

/* Deux niveaux d'un coup : une grosse victoire après une série de boosters.

   On part d'une unité sous le seuil du 5 — donc au niveau 4 — et on ajoute de
   quoi couvrir deux paliers entiers. Le compte tombe une unité sous le seuil du
   7, c'est-à-dire au niveau 6 : deux crans franchis, et le troisième tout juste
   manqué, ce qui éprouve la borne au passage. */
await pool.query('UPDATE user_wallet SET xp = ? WHERE user_id = ?', [seuil(5) - 1, U]);
const saut = await niveau.gagner(U, coutDuPalier(5) + coutDuPalier(6));
check('un gros gain peut franchir deux paliers',
  saut.avant === 4 && saut.niveau === 6 && saut.xp === seuil(7) - 1);
/* Un seul palier entre 4 et 6 depuis que ceux des séries sont partis : le 5,
   qui ouvre le troisième rang de tribune. C'est lui qui ne doit pas être
   avalé. */
check('et le palier franchi est annoncé',
  saut.paliers.some((p) => p.niveau === 5)
  || (console.log('        annoncés :', saut.paliers.map((p) => p.niveau).join(',')), false));
/* Ce que la route annonçait au début de la suite, c'est ce que la montée
   verse : les niveaux 5 et 6, l'un qui ouvre un rang de tribune et l'autre
   rien, chacun au montant que le chemin du profil a affiché. */
check('la montée verse exactement les écharpes que la route annonçait pour 5 et 6',
  saut.ecarpes === annonce.get(5) + annonce.get(6) && saut.ecarpes === 110
  || (console.log('        versé :', saut.ecarpes), false));

/* ------------------------------------------- ce que le palier a ouvert */

r = await call('/api/niveau');
check('et le troisième emplacement de deck est ouvert', r.json.deckFanzzy === 3);

/* **Aucune série n'est hors de portée d'un joueur de niveau 1.** C'est le cœur
   du changement : le kiosque distribuait selon le niveau, il distribue selon la
   saison. Une série ouverte se tire, quel que soit le compteur d'expérience de
   celui qui la demande. */
r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'MS' } });
check('une série ouverte se distribue, sans condition de niveau',
  r.json.cards?.length === 5);

/* ------------------------------------------- le plafond des clubs suivis

   La question ouverte tranchée : le niveau lève le plafond, les écharpes
   achètent en dessous. Personne ne perd un emplacement déjà payé, et le niveau
   garde un effet sans rien donner.                                          */

await pool.query('UPDATE user_wallet SET scarves = 5000 WHERE user_id = ?', [U]);
r = await call('/api/me/slot', { method: 'POST' });
const troisieme = r.json.slots ?? r.json.error;
check(`le troisième emplacement s’achète dès le niveau 4 (${troisieme})`, r.json.slots === 3);

r = await call('/api/me/slot', { method: 'POST' });
check('le quatrième est refusé : il demande le niveau 9',
  r.json.error === 'onboarding.error.slot_locked');

await pool.query('UPDATE user_wallet SET xp = ? WHERE user_id = ?', [seuil(9), U]);
r = await call('/api/me/slot', { method: 'POST' });
check('au niveau 9, il s’achète', r.json.slots === 4);

/* ---------------------------------------- le deck respecte son plafond */

for (const f of ['TR32', 'MS30', 'TR33']) {
  await pool.query(`INSERT IGNORE INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`,
    [U, f]);
}
r = await call('/api/deck/mien');
check('le deck annonce le plafond du moment', r.json.possede?.fanzzyMax === 3);

// Redescendu sous le niveau 5 : le troisième emplacement se referme.
await pool.query('UPDATE user_wallet SET xp = ? WHERE user_id = ?', [seuil(3), U]);
r = await call('/api/deck/mien');
check('sous le niveau 5, le deck n’a que deux emplacements',
  r.json.possede?.fanzzyMax === 2);

const communes = (await call('/api/deck/catalogue')).json.actions
  .filter((a) => a.rar === 'commune' && !a.condition).map((a) => a.id);
const dix = [...communes, ...communes, ...communes].slice(0, 10);
r = await call('/api/deck/mien', { method: 'PUT', body: {
  nom: 'Trop grand',
  fanzzy: [{ id: 'TR32' }, { id: 'MS30' }, { id: 'TR33' }],
  actions: dix } });
check('un troisième Fanzzy est refusé à ce niveau',
  (r.json.detail ?? []).some((p) => p.code === 'deck.error.fanzzy_count' && p.max === 2));

r = await call('/api/deck/mien', { method: 'PUT', body: {
  nom: 'Juste bien', fanzzy: [{ id: 'TR32' }, { id: 'MS30' }], actions: dix } });
check('deux passent', r.json.deck?.fanzzy?.length === 2);

/* --------------------------------------------- le niveau ne rend pas fort

   La règle qui tient tout le reste. Elle se vérifie ici parce qu'elle ne se
   vérifie nulle part ailleurs : rien dans le duel ne lit le niveau, et c'est
   exactement ce qu'on veut garder vrai.                                     */

{
  const source = readFileSync(path.join(RACINE, 'src', 'server', 'nvn', 'engine.js'), 'utf8');
  check('le moteur de duel ignore tout du niveau',
    !/niveau|\bxp\b/i.test(source));
}

/* ===================================================== les aides de la jauge */

const poser = (xp, scarves = 0) =>
  pool.query('UPDATE user_wallet SET xp = ?, scarves = ? WHERE user_id = ?', [xp, scarves, V]);
const lire = async () => {
  const [[w]] = await pool.query('SELECT xp, scarves FROM user_wallet WHERE user_id = ?', [V]);
  return { xp: Number(w.xp), scarves: Number(w.scarves) };
};

/** Égalité profonde, sans tenir compte de l'ordre des clés : on compare des
    valeurs, pas une mise en page de JSON. Une clé de trop ou de moins, en
    revanche, la fait échouer. */
function egal(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.join(',') === kb.join(',') && ka.every((k) => egal(a[k], b[k]));
}
const dire = (quoi, v) => (console.log(`        ${quoi} :`, JSON.stringify(v)), false);

const leve = async (f) => { try { await f(); return null; } catch (e) { return e; } };

/* ================================================ la jauge dans le résultat

   `CONTRATS.md`, § 1. Les valeurs attendues sont **écrites à la main** :
   recalculées par `progression()`, elles diraient seulement que la fonction
   est d'accord avec elle-même. La courbe : 60, 100, 140… d'XP par palier,
   donc le niveau 4 commence à 300, le 5 à 480, le 29 à 16 800 et le 30 à
   17 980 ; un palier atteint verse dix écharpes par niveau. */

console.log('\n— la jauge dans le résultat —');
{
  // Au milieu d'un niveau : ni montée, ni palier, ni écharpe.
  await poser(310);
  const r = await niveau.gagner(V, 20);
  check('au milieu du niveau 4, +20 : la jauge avance de 10 à 30 sur 180', egal(r, {
    xp: 330, gain: 20, niveau: 4, dans: 30, pour: 180, part: 30 / 180, max: false,
    avant: 4, monte: false, paliers: [], ecarpes: 0,
    depart: { xp: 310, niveau: 4, dans: 10, pour: 180, part: 10 / 180, max: false },
  }) || dire('rendu', r));
  check('et la base dit la même chose', egal(await lire(), { xp: 330, scarves: 0 }));
}
{
  /* La montée : l'exemple même du contrat, à la virgule près. 470 est au
     niveau 4, à 170 sur 180 ; 490 est au niveau 5, à 10 sur 220, et le
     palier 5 ouvre le troisième rang de tribune. */
  await poser(470);
  const r = await niveau.gagner(V, 20);
  check('l’exemple du contrat : 470 + 20 monte au niveau 5', egal(r, {
    xp: 490, gain: 20, niveau: 5, dans: 10, pour: 220, part: 10 / 220, max: false,
    avant: 4, monte: true, paliers: [{ niveau: 5, deckFanzzy: 3 }], ecarpes: 50,
    depart: { xp: 470, niveau: 4, dans: 170, pour: 180, part: 170 / 180, max: false },
  }) || dire('rendu', r));
  check('et les 50 écharpes du palier sont dans la bourse', egal(await lire(), { xp: 490, scarves: 50 }));
}
{
  // Le dernier palier : la jauge pleine plutôt qu'une division par zéro.
  await poser(17970);
  const r = await niveau.gagner(V, 20);
  check('à 10 du niveau 30, +20 : jauge pleine et `max`', egal(r, {
    xp: 17990, gain: 20, niveau: 30, dans: 0, pour: 0, part: 1, max: true,
    avant: 29, monte: true, paliers: [{ niveau: 30, slots: 8 }], ecarpes: 300,
    depart: { xp: 17970, niveau: 29, dans: 1170, pour: 1180, part: 1170 / 1180, max: false },
  }) || dire('rendu', r));
  const encore = await niveau.gagner(V, 20);
  check('au niveau 30, l’XP compte encore et la jauge reste pleine', egal(encore, {
    xp: 18010, gain: 20, niveau: 30, dans: 0, pour: 0, part: 1, max: true,
    avant: 30, monte: false, paliers: [], ecarpes: 0,
    depart: { xp: 17990, niveau: 30, dans: 0, pour: 0, part: 1, max: true },
  }) || dire('rendu', encore));
  check('et la bourse a reçu les 300 écharpes une fois', egal(await lire(), { xp: 18010, scarves: 300 }));

  /* Les paliers rendus sont des copies. Ceux de `PALIERS` sont la table du
     jeu : un appelant qui retoucherait sa réponse ne doit pas la changer pour
     tout le monde. */
  r.paliers[0].slots = 99;
  check('les paliers rendus sont des copies de la table du jeu',
    PALIERS.find((p) => p.niveau === 30).slots === 8);
}
{
  const r = await niveau.gagner(V, 0);
  check('un gain nul ne crédite rien et ne porte pas de `gain`',
    egal(r, { xp: 0, niveau: 1, avant: 1, monte: false, paliers: [], ecarpes: 0 }) || dire('rendu', r));
}

/* ============================================ un gain d'XP est atomique (E2)

   Le défaut : `gagner()` lisait l'XP sans verrou, calculait les paliers sur
   cette lecture, puis ajoutait. Deux gains simultanés lisaient la même XP. À
   50, deux fois +20 payaient deux fois les 20 écharpes du niveau 2 ; à 45,
   deux fois +10 ne les payaient jamais, chacun croyant s'arrêter à 55.

   **La course est rendue certaine, pas probable.** Le crochet `apresLecture`
   retient chaque gain entre sa lecture et son écriture, jusqu'à ce que tous
   aient lu — ou, s'ils ne le peuvent pas parce que le premier tient le
   verrou, jusqu'à un délai. Sans verrou, tous lisent la même XP à coup sûr ;
   avec, chacun lit celle que le précédent a laissée. Le relevé des lectures
   le montre directement, en plus des soldes.

   **Deux bases.** Depuis MariaDB 11.6, l'isolation par instantané
   (`innodb_snapshot_isolation`, allumée par défaut, et le poste tourne en
   12.3) arrête d'elle-même l'écriture qui suit une lecture périmée : sans le
   verrou, le second gain y meurt en `ER_CHECKREAD` au lieu de payer deux fois.
   La production peut être d'avant. La course se joue donc aussi sur un pool
   dont chaque connexion éteint cette isolation : c'est là que le palier
   payé deux fois se voit. */

/** Retient chaque gain après sa lecture, jusqu'à `attendus` lectures ou au
    délai. Une fois ouverte, la porte reste ouverte. */
function barriere(attendus, delaiMs = 400) {
  const lus = [];
  let ouvrir;
  let ouverte = false;
  let minuterie = null;
  const porte = new Promise((r) => { ouvrir = r; });
  const ouvre = () => {
    if (ouverte) return;
    ouverte = true;
    clearTimeout(minuterie);
    minuterie = null;
    ouvrir();
  };
  return {
    lus,
    ouvre,
    apresLecture: async ({ xp }) => {
      lus.push(xp);
      if (ouverte) return;
      if (lus.length >= attendus) { ouvre(); return; }
      minuterie ??= setTimeout(ouvre, delaiMs);
      await porte;
    },
  };
}

async function courses(p, nom) {
  for (const [depart, gain, n, apres, palier] of [
    [50, 20, 2, 90, 20],     // le palier 2 payé deux fois, avant
    [45, 10, 2, 65, 20],     // le palier 2 jamais payé, avant
    [50, 20, 10, 250, 50],   // dix onglets : les paliers 2 et 3, une fois chacun
  ]) {
    await poser(depart);
    const b = barriere(n);
    const nv = createNiveau({ pool: p, requireAuth, crochets: { apresLecture: b.apresLecture } });
    const rendus = await enParallele(n, () => nv.gagner(V, gain));
    b.ouvre();
    const titre = `${nom} : à ${depart}, ${n} × +${gain}`;
    check(`${titre} → ${apres} d’XP et ${palier} écharpes de palier, pas une de plus`,
      egal(await lire(), { xp: apres, scarves: palier }) || dire('bourse', await lire()));
    const attendues = Array.from({ length: n }, (_, i) => depart + i * gain);
    check(`${titre} : chacun a lu l’XP que le précédent avait laissée`,
      egal([...b.lus].sort((x, y) => x - y), attendues) || dire('lectures', b.lus));
    check(`${titre} : chaque gain est annoncé, et les paliers annoncés font la somme versée`,
      rendus.every((r) => r.gain === gain)
      && rendus.reduce((s, r) => s + r.ecarpes, 0) === palier
      || dire('rendus', rendus.map((r) => [r.gain, r.depart?.xp, r.ecarpes])));
  }
}

console.log('\n— un gain d’XP est atomique —');
{
  let strict = null;
  try {
    strict = Number((await pool.query('SELECT @@session.innodb_snapshot_isolation AS s'))[0][0].s);
  } catch { /* une base qui ne connaît pas la variable : l'ancien comportement */ }
  await courses(pool, strict === 1 ? 'instantanés stricts' : 'cette base');
  if (strict !== null) {
    const ancienne = mysql.createPool({ uri: DB, connectionLimit: 12, ...OPTIONS_BASE });
    ancienne.on('connection', (c) => c.query('SET SESSION innodb_snapshot_isolation = OFF', () => {}));
    const [[eteinte]] = await ancienne.query('SELECT @@session.innodb_snapshot_isolation AS s');
    check('le second pool a bien éteint l’isolation par instantané', Number(eteinte.s) === 0);
    await courses(ancienne, 'sans instantanés stricts');
    await ancienne.end();
  }
}

/* ===================================== la porte du grand livre : gagnerDans

   Le grand livre (`recompenses.js`) verse les écharpes, les boosters, la
   ligne du registre et l'XP dans **une** transaction, qui tient déjà le
   verrou de la bourse. `gagnerDans` y travaille sur sa connexion : elle ne
   valide rien, n'avale rien, et partage le même verrou que `gagner()`. */

console.log('\n— la porte du grand livre —');
{
  // Une transaction annulée n'a rien laissé, et rien n'était visible avant.
  await poser(50);
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  const r = await niveau.gagnerDans(conn, V, 20);
  const vuDAilleurs = await lire();
  await conn.rollback();
  conn.release();
  check('gagnerDans calcule la montée comme gagner', egal(r, {
    xp: 70, gain: 20, niveau: 2, dans: 10, pour: 100, part: 10 / 100, max: false,
    avant: 1, monte: true, paliers: [], ecarpes: 20,
    depart: { xp: 50, niveau: 1, dans: 50, pour: 60, part: 50 / 60, max: false },
  }) || dire('rendu', r));
  check('elle ne valide rien elle-même : une autre connexion lit encore 50',
    egal(vuDAilleurs, { xp: 50, scarves: 0 }) || dire('lu ailleurs', vuDAilleurs));
  check('annulée, la transaction ne laisse ni XP ni écharpes de palier',
    egal(await lire(), { xp: 50, scarves: 0 }) || dire('bourse', await lire()));
}
{
  /* Les deux portes, un seul verrou. Une transaction du grand livre tient la
     bourse et y crédite +20 ; un `gagner()` lancé pendant ce temps doit
     attendre, puis calculer sur ce qu'elle a écrit. Le palier 2 n'est versé
     qu'une fois. */
  await poser(50);
  const lus = [];
  const nv = createNiveau({ pool, requireAuth,
    crochets: { apresLecture: ({ xp }) => { lus.push(xp); } } });
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  await conn.execute('SELECT scarves, packs FROM user_wallet WHERE user_id = ? FOR UPDATE', [V]);
  await conn.execute('UPDATE user_wallet SET scarves = scarves + 5 WHERE user_id = ?', [V]);
  const dedans = await nv.gagnerDans(conn, V, 20);
  const dehors = nv.gagner(V, 20);
  await new Promise((r) => setTimeout(r, 300));
  const pendant = lus.length;
  await conn.commit();
  conn.release();
  const r2 = await dehors;
  check('sous le verrou qu’elle tient déjà, gagnerDans crédite sans s’attendre elle-même',
    dedans?.xp === 70 && dedans.monte === true);
  check('un gagner() lancé pendant ce temps attend la fin de la transaction',
    pendant === 1 || dire('lectures avant la validation', lus));
  check('puis calcule sur ce qu’elle a écrit', egal(lus, [50, 70]) && r2.depart?.xp === 70
    && r2.monte === false || dire('lectures', lus));
  check('le palier 2 n’est versé qu’une fois, et les 5 écharpes de l’appelant restent',
    egal(await lire(), { xp: 90, scarves: 25 }) || dire('bourse', await lire()));
}
{
  // Les fautes de l'appelant lèvent, sans rien écrire.
  await poser(50);
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  for (const m of [2.5, -1, '20', NaN]) {
    const e = await leve(() => niveau.gagnerDans(conn, V, m));
    check(`un montant ${typeof m === 'string' ? JSON.stringify(m) : String(m)} lève en le nommant`,
      /entier positif ou nul/.test(e?.message ?? '') || dire('erreur', e?.message));
  }
  check('un montant nul ne lit ni n’écrit rien, et rend null',
    (await niveau.gagnerDans(conn, V, 0)) === null);
  const e = await leve(() => niveau.gagnerDans(conn, 'cccccccc-0000-0000-0000-0000000000ff', 20));
  check('sans bourse, elle lève en disant qui doit l’ouvrir',
    /aucune bourse.*assurerBourse/.test(e?.message ?? '') || dire('erreur', e?.message));
  await conn.rollback();
  conn.release();
  check('et rien n’a bougé', egal(await lire(), { xp: 50, scarves: 0 }));
}

/* ================================= une progression illisible n'enlève rien

   La panne du 9 septembre. `sql/niveau.sql` n'avait pas été appliqué en
   production : la colonne `xp` manquait. La version d'alors lisait zéro, en
   concluait « niveau 1 », et **confisquait** — une seule série au kiosque,
   deux emplacements de deck, deux clubs. Le jeu se refermait sur tout le monde
   parce qu'un `ALTER TABLE` n'avait pas été joué, sans erreur et sans message,
   avec des refus parfaitement polis.

   Un schéma incomplet est une faute d'exploitation : elle doit être bruyante
   dans les journaux et invisible pour le joueur. Jamais l'inverse.          */

{
  // Un pool dont la lecture de `xp` échoue, comme si la colonne manquait.
  const sansColonne = {
    execute: async (sql, params) => {
      if (/\bxp\b/.test(sql)) {
        throw Object.assign(new Error("Unknown column 'xp' in 'SELECT'"),
          { code: 'ER_BAD_FIELD_ERROR' });
      }
      return pool.execute(sql, params);
    },
  };
  const degrade = createNiveau({ pool: sansColonne, requireAuth });
  const d = await degrade.droitsDe(U);

  check('sans la colonne, le manque est signalé', d.indisponible === true);
  check('et les trois emplacements de deck aussi', d.deckFanzzy === 3);
  check('et le plafond de clubs n’est pas rabaissé', d.slots === 8);
}

/* ====================================== la colonne absente, pour de vrai

   Les deux portes y répondent à l'inverse l'une de l'autre, et c'est voulu.
   `gagner()` ne lève pas : un booster ouvert reste ouvert, la jauge n'avance
   pas, et le journal nomme le fichier. `gagnerDans()` lève, avec le code de
   la base : le grand livre en fait `schema` et annule tout le versement —
   une ligne qui dirait « 20 XP » sans l'XP ne se rattraperait jamais.

   La colonne est vraiment retirée, puis remise par `sql/niveau.sql` : un faux
   pool ne dirait rien du message que la base envoie réellement. */

console.log('\n— la colonne d’XP absente —');
{
  await poser(50, 7);
  await pool.query('ALTER TABLE user_wallet DROP COLUMN xp');
  let r;
  const e1 = await leve(async () => { r = await niveau.gagner(V, 20); });
  const [[w]] = await pool.query('SELECT scarves FROM user_wallet WHERE user_id = ?', [V]);
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  const e2 = await leve(() => niveau.gagnerDans(conn, V, 20));
  await conn.rollback();
  conn.release();

  const remise = await mysql.createConnection({ uri: DB, multipleStatements: true });
  await remise.query(readFileSync(path.join(RACINE, 'sql', 'niveau.sql'), 'utf8'));
  await remise.end();

  check('gagner() ne lève pas', e1 === null || dire('erreur', e1?.message));
  check('et rend l’objet vide, sans gain', egal(r, {
    xp: 0, niveau: 1, avant: 1, monte: false, paliers: [], ecarpes: 0 }) || dire('rendu', r));
  check('sans toucher aux écharpes', Number(w.scarves) === 7);
  check('gagnerDans() lève, avec le code de la base',
    e2?.code === 'ER_BAD_FIELD_ERROR' || dire('erreur', [e2?.code, e2?.message]));
  const [[col]] = await pool.query(`SELECT COUNT(*) AS n FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'user_wallet' AND column_name = 'xp'`);
  check('et sql/niveau.sql remet la colonne', Number(col.n) === 1);
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
http.close();
await pool.end();
process.exitCode = failures ? 1 : 0;
