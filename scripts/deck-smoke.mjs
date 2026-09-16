/** Test des decks et du choix du match support. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createDecks } from '../src/server/deck/index.js';
import { ACTIONS, DECK_RULES } from '../src/shared/duel/actions.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql','football.sql', 'minutes.sql', 'couleurs.sql','souvenirs.sql', 'billets.sql','fanzzy.sql','inventaire.sql', 'skins.sql', 'tenues.sql','deck.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = 'dddddddd-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
  [U,'d@ex.fr','Deckeur']);
await raw.query(`INSERT INTO user_wallet (user_id,scarves,action_cards) VALUES (?,500,?)`,
  [U, JSON.stringify(['a-silence','a-vol','a-metronome','a-appel'])]);
for (const f of ['TR32','TR32B','MS30','TR33']) {
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

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
await chargerTenues(pool);
/* La journée du football, telle que le télétexte la sert. Nulle par défaut :
   la plupart des contrôles n'en ont que faire, et le choix du match doit tenir
   sans elle. Le dernier bloc la remplit. */
let journee = null;
const D = createDecks({ pool, requireAuth: (r,_s,n)=>{ r.user={id:U}; n(); },
  jourDuFoot: () => journee });
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

/* Trois personnages **différents**. `TR32B` n'est plus un Fanzzy à part : c'est le
   deuxième âge de `TR32`, et un deck qui alignerait les deux alignerait deux fois
   la même personne. Le deck le refuse maintenant comme un doublon — voir le cas
   dédié plus bas. */
const bon = { nom:'Virage Nord',
  fanzzy:[{id:'TR32',stuff:['jumelles']},{id:'MS30',stuff:['echarpe','tambour']},{id:'TR33',stuff:[]}],
  actions: dixCartes };

r = await call('/api/deck/mien', { method:'PUT', body: bon });
check('deck valide accepté', r.json.deck?.fanzzy?.length === 3);
check('avertissement si aucun arbitre',
  bon.actions.includes('a-arbitre') || r.json.avertissements.some((a)=>a.code==='deck.warn.no_substitution'));

const cas = [
  ['aucun Fanzzy', { ...bon, fanzzy: [] }, 'deck.error.fanzzy_count'],
  ['quatre Fanzzy', { ...bon, fanzzy: [...bon.fanzzy, {id:'MS31'}] }, 'deck.error.fanzzy_count'],
  ['Fanzzy en double', { ...bon, fanzzy:[{id:'TR32'},{id:'TR32'},{id:'MS30'}] }, 'deck.error.fanzzy_duplicate'],
  // Deux âges du même personnage, c'est la même personne deux fois. Le deck
  // ramenant tout au premier âge, le doublon est vu au lieu de passer.
  ['le même personnage à deux âges',
    { ...bon, fanzzy:[{id:'TR32'},{id:'TR32B'},{id:'MS30'}] }, 'deck.error.fanzzy_duplicate'],
  ['Fanzzy non possédé', { ...bon, fanzzy:[{id:'MS31'},{id:'MS30'},{id:'TR33'}] }, 'deck.error.fanzzy_not_owned'],
  ['trois pièces sur un Fanzzy',
    { ...bon, fanzzy:[{id:'TR32',stuff:['jumelles','echarpe','tambour']},{id:'MS30'},{id:'TR33'}] },
    'deck.error.too_much_stuff'],
  ['même pièce sur deux Fanzzy',
    { ...bon, fanzzy:[{id:'TR32',stuff:['jumelles']},{id:'MS30',stuff:['jumelles']},{id:'TR33'}] },
    'deck.error.stuff_shared'],
  ['équipement non possédé',
    { ...bon, fanzzy:[{id:'TR32',stuff:['megaphone']},{id:'MS30'},{id:'TR33'}] },
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
  { ...bon, fanzzy: [{ id:'TR32' }] } });
check('un seul Fanzzy aussi', r.json.deck?.fanzzy?.length === 1);

r = await call('/api/deck/mien', { method:'PUT', body:
  { ...bon, fanzzy: [{ id:'TR32', stuff: [] }, { id:'MS30' }, { id:'TR33' }] } });
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

/* **Classé, c'est en cours — et non « aujourd'hui ».**

   La règle d'avant faisait compter au classement un duel joué à dix heures du
   matin sur une rencontre du soir : on poussait pour une tribune qui n'existait
   pas encore. Un duel de tribunes se joue pendant le match, sinon il ne se
   distingue en rien d'un entraînement, et c'est ce qu'il devient. */
r = await call('/api/deck/match/2');
check('match du jour pas encore commencé : entraînement', r.json.mode === 'entrainement');
check('et la page dit pourquoi', /n’a pas commencé/.test(r.json.raison ?? '')
  || (console.log('        elle dit :', r.json.raison), false));

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

/* ------------------------------------------- placer depuis la fiche

   Le bouton « EMMENER EN DUEL » de la fiche d'un Fanzzy. Il écrivait
   `user_wallet.active_fanzzy` — **l'avatar**, celui que voient les amis et
   l'accueil — et le personnage n'entrait dans aucun deck. La fiche affichait
   ensuite « DÉJÀ EN DUEL » sur quelqu'un qui ne jouerait jamais.

   Ce que ces contrôles défendent, c'est qu'il fasse ce qu'il dit, et qu'il ne
   puisse pas casser le deck en le faisant. */
{
  const poser = (id, place) => call('/api/deck/placer', { method: 'POST', body: { id, place } });

  // On repart du deck valide : TR32 titulaire, MS30 et TR33 remplaçants.
  await call('/api/deck/mien', { method: 'PUT', body: bon });

  r = await poser('TR33', 0);
  check('placer au rang 0 met le personnage titulaire', r.json.deck?.fanzzy?.[0]?.id === 'TR33');
  /* **Un échange, pas une insertion.** Sans lui, déplacer le titulaire laisserait
     le rang 0 vide et le deck invalide — et le sortant disparaîtrait du deck sans
     que rien ne le dise. */
  check('et le sortant prend la place libérée', r.json.deck.fanzzy[2]?.id === 'TR32');
  check('le deck garde ses trois rangs', r.json.deck.fanzzy.length === 3);
  check('et ses dix cartes d’action', r.json.deck.actions.length === 10);
  check('l’écran sait qui a cédé sa place', r.json.remplace === 'TR32');
  /* L'équipement suit son porteur : c'est le sien, et le voir rester au rang
     serait incompréhensible. */
  check('l’équipement voyage avec le personnage',
    r.json.deck.fanzzy[2].stuff?.[0] === 'jumelles');


  /* ---------------------------- le titulaire est « Mon FANZZY »

     Deux notions vivaient côte à côte sans se parler : `active_fanzzy`, le
     personnage que montrent l'accueil, les amis et l'écran « Mon FANZZY », et
     `fanzzy[0]`, celui qui entre au coup d'envoi. Un joueur lisait donc
     « TITULAIRE » sur une fiche et voyait quelqu'un d'autre partout ailleurs
     — sans panne, et sans qu'aucun écran ne puisse le lui expliquer.

     C'est une notion de trop. Ce qui se vérifie ici, c'est que le brassard et
     l'avatar ne peuvent plus se séparer, quel que soit le chemin pris. */
  const avatar = async () => (await pool.query(
    'SELECT active_fanzzy FROM user_wallet WHERE user_id = ?', [U]))[0][0]?.active_fanzzy;

  await call('/api/deck/mien', { method: 'PUT', body: bon });
  check('enregistrer un deck fait du titulaire le Fanzzy de la maison',
    (await avatar()) === bon.fanzzy[0].id
    || (console.log('        avatar :', await avatar(), '— titulaire', bon.fanzzy[0].id), false));

  await poser('TR33', 0);
  check('et changer de titulaire depuis une fiche le suit',
    (await avatar()) === 'TR33'
    || (console.log('        avatar :', await avatar()), false));

  /* Poser quelqu'un en **remplaçant** ne touche pas à l'avatar : c'est le rang
     0 qui porte la règle, pas le fait d'entrer au deck. */
  await poser('TR32', 1);
  check('mais entrer en remplaçant ne prend pas le brassard',
    (await avatar()) === 'TR33');

  r = await poser('TR33', 2);
  check('replacer le même personnage ailleurs le déplace',
    r.json.deck.fanzzy.filter((f) => f.id === 'TR33').length === 1
    && r.json.deck.fanzzy[2].id === 'TR33');

  /* Une carte qu'on ne possède pas ne se place pas. Le client ne la propose
     pas, mais le client n'est pas ce qui décide.

     `TR1` et non `TR32C` : `TR32C` est le **troisième âge** de `TR32`, donc `racineDe`
     le ramène à `TR32`, qui est possédé. Le premier essai y est tombé — et c'est
     précisément le comportement qu'on veut, pas un défaut : un joueur qui ouvre
     la fiche d'un âge supérieur place le personnage, pas l'âge. */
  r = await poser('TR1', 0);
  check('un Fanzzy non possédé est refusé', r.json.error === 'deck.error.fanzzy_not_owned');

  r = await poser('TR32C', 1);
  check('un âge supérieur place son personnage', r.json.deck?.fanzzy?.[1]?.id === 'TR32');

  r = await poser('PASUNID', 0);
  check('un identifiant inconnu est refusé', r.json.error === 'deck.error.fanzzy_unknown');

  for (const mauvaise of [-1, 3, 99, 'titulaire', null]) {
    r = await poser('TR32', mauvaise);
    if (r.json.error !== 'deck.error.place_hors_deck') {
      check(`place « ${mauvaise} » refusée`, false);
      break;
    }
  }
  check('une place hors du deck est refusée', true);

  /* **Le trou au milieu.** Poser quelqu'un au rang 2 quand le rang 1 est vide
     laisserait un trou, et c'est `fanzzy[0]` qui décide du titulaire : le deck
     serait alors mené par le premier rang non vide, qui n'est pas celui que le
     joueur a choisi. */
  await call('/api/deck/mien', { method: 'PUT',
    body: { ...bon, fanzzy: [{ id: 'TR32', stuff: [] }] } });
  r = await poser('MS30', 2);
  check('on ne saute pas une place vide', r.json.error === 'deck.error.place_vide_avant');
  r = await poser('MS30', 1);
  check('mais la place juste après la dernière s’ouvre', r.json.deck?.fanzzy?.length === 2);
}

/* ===================================== la journée complète la base

   La table `fixtures` ne connaît que les clubs suivis : le guetteur ne relève
   qu'eux, c'est ainsi qu'il tient dans le quota. La liste des matchs support en
   ignorait donc la moitié — « il en manque pas mal par rapport à la page des
   matchs » — et donnait un statut périmé sur ceux qu'elle avait.

   La journée du football, celle que lit la page des matchs, fait foi. Deux
   choses à éprouver, et elles sont contraires : elle **ajoute** ce que la base
   ignore, et elle **corrige** ce que la base croit savoir. */

{
  journee = {
    groupes: [
      // Le match 4 est en base, à la 20e minute. La journée le donne fini :
      // il doit disparaître de la liste, et non y rester « en cours ».
      { ligue: { id: 207, name: 'Super League', tier: 2 },
        matchs: [{
          id: 4, date: new Date(Date.now() - 2 * 3600e3).toISOString(),
          status: 'FT', elapsed: 90, live: false, fini: true,
          home: { id: 85, name: 'Sion', goals: 2 },
          away: { id: 91, name: 'Bâle', goals: 1 },
        }] },
      // Et un match que la base n'a jamais vu, en cours.
      { ligue: { id: 39, name: 'Premier League', tier: 1 },
        matchs: [{
          id: 5000, date: new Date(Date.now() - 30 * 60e3).toISOString(),
          status: '1H', elapsed: 28, live: true, fini: false,
          home: { id: 33, name: 'Manchester United', goals: 1 },
          away: { id: 40, name: 'Liverpool', goals: 0 },
        }] },
    ],
  };

  r = await call('/api/deck/matchs?tous=1');
  const noms = (r.json.matchs ?? []).map((m) => m.home_name);
  check('un match que la base ignore paraît dans la liste',
    noms.includes('Manchester United'));

  const inconnu = r.json.matchs.find((m) => m.id === 5000);
  check('il est classé, puisqu’il se joue', inconnu?.mode === 'classe');
  check('avec sa compétition', inconnu?.league_name === 'Premier League');
  check('et ce qui se joue passe devant', r.json.matchs[0]?.id === 5000);

  check('un match que la journée dit fini quitte la liste',
    !(r.json.matchs ?? []).some((m) => m.id === 4));

  /* Et il faut pouvoir l'entrer : la liste le propose, `matchSupport` doit
     l'accepter. Sans cela, on cliquerait sur un match pour s'entendre répondre
     qu'il n'existe pas. */
  r = await call('/api/deck/match/5000');
  check('et on peut le choisir comme support', r.json.mode === 'classe');
  check('avec ses deux clubs',
    r.json.fixture?.home?.name === 'Manchester United'
    && r.json.fixture?.away?.name === 'Liverpool');

  journee = null;
}
console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end(); http.close();
process.exit(failures ? 1 : 0);
