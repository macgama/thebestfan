/** Test des decks et du choix du match support. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createDecks } from '../src/server/deck/index.js';
import { ACTIONS, DECK_RULES } from '../src/shared/duel/actions.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql','football.sql','souvenirs.sql','fanzzy.sql','inventaire.sql', 'skins.sql', 'tenues.sql','deck.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = 'dddddddd-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
  [U,'d@ex.fr','Deckeur']);
await raw.query(`INSERT INTO user_wallet (user_id,scarves,action_cards) VALUES (?,500,?)`,
  [U, JSON.stringify(['a-silence','a-vol','a-metronome','a-appel'])]);
for (const f of ['V1','V2','P1','F1']) {
  await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`,[U,f]);
}
for (const s of ['jumelles','echarpe','tambour']) {
  await raw.query(`INSERT INTO user_stuff (user_id,stuff_id,copies) VALUES (?,?,1)`,[U,s]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle')`);
await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Super League')`);
// trois matchs : hier, aujourd'hui, dans trois jours
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at) VALUES
  (1,207,2026,85,91,'FT', UTC_TIMESTAMP() - INTERVAL 1 DAY),
  (2,207,2026,85,91,'NS', UTC_DATE() + INTERVAL 20 HOUR),
  (3,207,2026,91,85,'NS', UTC_TIMESTAMP() + INTERVAL 3 DAY),
  (4,207,2026,85,91,'1H', UTC_TIMESTAMP() - INTERVAL 20 MINUTE)`);
// Un match par jour de la semaine à venir. Le test ne tenait qu'à « dans trois
// jours » : la faute de comparaison de dates ne se voyait que si le nom du jour
// visé passait avant celui d'aujourd'hui dans l'ordre alphabétique — un mardi
// contre un vendredi. Six jours couvrent tous les cas, quel que soit le jour où
// la suite tourne.
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
  SELECT 10+n,207,2026,91,85,'NS', UTC_TIMESTAMP() + INTERVAL n DAY FROM
  (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) j`);
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)`,[U]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset:'utf8mb4' });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
await chargerTenues(pool);
const D = createDecks({ pool, requireAuth: (r,_s,n)=>{ r.user={id:U}; n(); } });
const app = express(); app.use('/api/deck', D.router);
const http = createServer(app); await new Promise((r)=>http.listen(0,r));
const base = `http://localhost:${http.address().port}`;
const call = async (p,o={}) => {
  const r = await fetch(base+p,{ method:o.method ?? (o.body?'POST':'GET'),
    headers:{'content-type':'application/json'},
    body:o.body?JSON.stringify(o.body):undefined });
  return { status:r.status, json: await r.json().catch(()=>({})) };
};

const communes = ACTIONS.filter((a)=>a.rar==='commune').map((a)=>a.id);
const dixCartes = [...communes, ...communes].slice(0,10);

let r = await call('/api/deck/catalogue');
check('catalogue des cartes', r.json.actions.length >= 18);
check('sept familles de mécaniques',
  new Set(r.json.actions.map((a)=>a.fam)).size === 7);
check('règles annoncées', r.json.regles.fanzzy === 3 && r.json.regles.actions === 10);

r = await call('/api/deck/mien');
check('aucun deck au départ', r.json.deck === null);
check('les communes sont offertes', r.json.possede.actions.length > 4);

/* --------------------------------------------------------- validation */

/* Trois personnages **différents**. `V2` n'est plus un Fanzzy à part : c'est le
   deuxième âge de `V1`, et un deck qui alignerait les deux alignerait deux fois
   la même personne. Le deck le refuse maintenant comme un doublon — voir le cas
   dédié plus bas. */
const bon = { nom:'Virage Nord',
  fanzzy:[{id:'V1',stuff:['jumelles']},{id:'P1',stuff:['echarpe','tambour']},{id:'F1',stuff:[]}],
  actions: dixCartes };

r = await call('/api/deck/mien', { method:'PUT', body: bon });
check('deck valide accepté', r.json.deck?.fanzzy?.length === 3);
check('avertissement si aucun arbitre',
  bon.actions.includes('a-arbitre') || r.json.avertissements.some((a)=>a.code==='deck.warn.no_substitution'));

const cas = [
  ['aucun Fanzzy', { ...bon, fanzzy: [] }, 'deck.error.fanzzy_count'],
  ['quatre Fanzzy', { ...bon, fanzzy: [...bon.fanzzy, {id:'T1'}] }, 'deck.error.fanzzy_count'],
  ['Fanzzy en double', { ...bon, fanzzy:[{id:'V1'},{id:'V1'},{id:'P1'}] }, 'deck.error.fanzzy_duplicate'],
  // Deux âges du même personnage, c'est la même personne deux fois. Le deck
  // ramenant tout au premier âge, le doublon est vu au lieu de passer.
  ['le même personnage à deux âges',
    { ...bon, fanzzy:[{id:'V1'},{id:'V2'},{id:'P1'}] }, 'deck.error.fanzzy_duplicate'],
  ['Fanzzy non possédé', { ...bon, fanzzy:[{id:'T1'},{id:'P1'},{id:'F1'}] }, 'deck.error.fanzzy_not_owned'],
  ['trois pièces sur un Fanzzy',
    { ...bon, fanzzy:[{id:'V1',stuff:['jumelles','echarpe','tambour']},{id:'P1'},{id:'F1'}] },
    'deck.error.too_much_stuff'],
  ['même pièce sur deux Fanzzy',
    { ...bon, fanzzy:[{id:'V1',stuff:['jumelles']},{id:'P1',stuff:['jumelles']},{id:'F1'}] },
    'deck.error.stuff_shared'],
  ['équipement non possédé',
    { ...bon, fanzzy:[{id:'V1',stuff:['megaphone']},{id:'P1'},{id:'F1'}] },
    'deck.error.stuff_not_owned'],
  ['neuf cartes', { ...bon, actions: dixCartes.slice(0,9) }, 'deck.error.actions_count'],
  ['carte non possédée', { ...bon, actions: ['a-miroir', ...dixCartes.slice(0,9)] },
    'deck.error.action_not_owned'],
];
for (const [nom, deck, attendu] of cas) {
  const x = await call('/api/deck/mien', { method:'PUT', body: deck });
  const codes = (x.json.detail ?? []).map((p)=>p.code);
  check(`refusé : ${nom}`, x.json.error === 'deck.error.invalid' && codes.includes(attendu));
}

/* ------------------------------------- ce qu'un débutant a le droit d'envoyer

   Un joueur qui vient d'ouvrir son premier booster n'a pas trois Fanzzy, ni
   dix cartes différentes. Le deck refusait les deux, et lui refusait donc
   l'entrée du virage par une règle qu'il ne pouvait pas satisfaire. */

r = await call('/api/deck/mien', { method:'PUT', body:
  { ...bon, fanzzy: bon.fanzzy.slice(0,2) } });
check('deux Fanzzy suffisent', r.json.deck?.fanzzy?.length === 2);

r = await call('/api/deck/mien', { method:'PUT', body:
  { ...bon, fanzzy: [{ id:'V1' }] } });
check('un seul Fanzzy aussi', r.json.deck?.fanzzy?.length === 1);

r = await call('/api/deck/mien', { method:'PUT', body:
  { ...bon, fanzzy: [{ id:'V1', stuff: [] }, { id:'P1' }, { id:'F1' }] } });
check('un Fanzzy sans équipement est accepté',
  r.json.deck?.fanzzy?.[0]?.stuff?.length === 0);

r = await call('/api/deck/mien', { method:'PUT', body:
  { ...bon, actions: Array(10).fill(communes[0]) } });
check('dix fois la même carte d’action passent',
  r.json.deck?.actions?.length === 10);

/* ------------------------------------------------------------ loadout */

await call('/api/deck/mien', { method:'PUT', body: bon });
r = await call('/api/deck/loadout');
check('le loadout donne les trois Fanzzy', r.json.fanzzy.length === 3);
check('les modificateurs sont déjà combinés',
  r.json.fanzzy[0].mods && Object.keys(r.json.fanzzy[0].mods).length > 1);
check('l\u2019équipement suit son Fanzzy',
  r.json.fanzzy[1].stuff.length === 2 && r.json.fanzzy[2].stuff.length === 0);
check('cinq cartes visibles', r.json.mainVisible === DECK_RULES.mainVisible);

/* ------------------------------------------------------ choix du match */

r = await call('/api/deck/match/1');
check('match d\u2019hier refusé', r.json.error === 'duel.error.fixture_past');

r = await call('/api/deck/match/2');
check('match du jour : classé', r.json.mode === 'classe');

r = await call('/api/deck/match/4');
check('match en cours : classé', r.json.mode === 'classe' && r.json.enCours === true);

r = await call('/api/deck/match/3');
check('match dans trois jours : entraînement', r.json.mode === 'entrainement');
check('la raison est expliquée au joueur', /entra/i.test(r.json.raison));

// Aucun de ces six matchs n'a eu lieu : aucun ne doit être refusé comme passé.
const refuses = [];
for (let n = 1; n <= 6; n++) {
  const x = await call(`/api/deck/match/${10 + n}`);
  if (x.json.mode !== 'entrainement') refuses.push(`J+${n} → ${x.json.error ?? x.json.mode}`);
}
check('un match à venir n’est jamais pris pour un match passé',
  refuses.length === 0 || (console.log('       ', refuses.join(', ')), false));

r = await call('/api/deck/match/999');
check('match inconnu refusé', r.json.error === 'duel.error.fixture_unknown');

r = await call('/api/deck/matchs');
check('les matchs passés ne sont pas proposés',
  r.json.matchs.every((m)=>m.id !== 1));
check('le match du jour arrive en tête', r.json.matchs[0].mode === 'classe');

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end(); http.close();
process.exit(failures ? 1 : 0);
