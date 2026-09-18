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
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

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
await raw.query(`DROP TABLE IF EXISTS parrainages, abonnements, saisons, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql',
                 'inventaire.sql', 'skins.sql', 'tenues.sql', 'deck.sql', 'niveau.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = 'cccccccc-0000-0000-0000-00000000000n'.replace('n', '1');
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
  [U, 'niv@ex.fr', 'Grimpeur']);
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs) VALUES (?,0,40)`, [U]);
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle'),(60,'Lugano'),(61,'Coire')`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
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

/* ------------------------------------------------- l'XP se gagne en jouant */

const avantXp = await xpEnBase();
r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'TR' } });
check('un booster s’ouvre', r.json.cards?.length === 5);
check('et il rapporte de l’XP', (await xpEnBase()) === avantXp + XP.pack);
check('l’ouverture annonce la progression', r.json.niveau?.xp === avantXp + XP.pack);

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

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
http.close();
await pool.end();
process.exitCode = failures ? 1 : 0;
