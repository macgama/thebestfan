/** Test des decks et du choix du match support. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createDecks, FORMATS, primeDeFormat } from '../src/server/deck/index.js';
import { ACTIONS, DECK_RULES } from '../src/shared/duel/actions.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql','football.sql', 'minutes.sql', 'couleurs.sql','souvenirs.sql', 'billets.sql','fanzzy.sql','inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql','deck.sql']) {
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

/* **Classé, c'est le jour du match.**

   La règle a fait un aller-retour. Elle a d'abord dit « aujourd'hui », puis
   « en cours » — pour qu'un duel joué le matin ne compte pas pour une
   rencontre du soir — et elle redit « aujourd'hui ».

   Ce que la version resserrée ne pesait pas, c'est combien de temps la porte
   restait ouverte : un match dure deux heures, et hors de ces deux heures il
   n'existait aucun duel classé du tout. Une règle juste que personne ne peut
   satisfaire ne protège rien, elle ferme le jeu. */
r = await call('/api/deck/match/2');
check('match du jour pas encore commencé : classé quand même',
  r.json.mode === 'classe'
  || (console.log('        il dit :', r.json.mode, '·', r.json.raison), false));
check('et la page dit pourquoi', /aujourd’hui/.test(r.json.raison ?? '')
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

  /* ------------------------- l'âge choisi appartient au personnage choisi

     L'accueil laisse dire **à quel âge** on se montre : `active_evo`, à côté de
     `active_fanzzy`. Changer de titulaire doit donc l'effacer — un âge choisi
     pour un personnage ne veut rien dire pour le suivant, et le garder
     afficherait le nouveau venu à un stade qu'il n'a peut-être jamais atteint.

     Mais **seulement** quand le titulaire change. `enregistrer` passe ici à
     chaque sauvegarde du deck, y compris quand on ne touche qu'à une carte
     d'action : effacer à tous les coups annulerait le choix du joueur pour un
     geste qui n'a rien à voir, et il ne saurait jamais lequel des deux écrans
     le lui a repris. */
  const ageMontre = async () => (await pool.query(
    'SELECT active_evo FROM user_wallet WHERE user_id = ?', [U]))[0][0]?.active_evo;

  await pool.query('UPDATE user_wallet SET active_evo = 1 WHERE user_id = ?', [U]);
  await call('/api/deck/mien', { method: 'PUT', body: { ...bon,
    fanzzy: [{ id: 'TR33', stuff: [] }, ...bon.fanzzy.filter((f) => f.id !== 'TR33')] } });
  check('enregistrer sans changer de titulaire garde l’âge choisi',
    Number(await ageMontre()) === 1
    || (console.log('        l’âge montré :', await ageMontre()), false));

  await poser('TR32', 0);
  check('mais changer de titulaire remet l’âge à celui du nouveau',
    (await ageMontre()) === null
    || (console.log('        l’âge montré :', await ageMontre()), false));

  // On remet le deck dans l'état que la suite attend.
  await poser('TR33', 0);
  await poser('TR32', 1);

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

  /* **Un match fini du jour reste dans la liste.** Il en sortait, et c'était
     cohérent tant que « classé » voulait dire « en cours » : une rencontre
     terminée ne pouvait plus rien valoir. Depuis que la règle est la journée,
     l'en sortir fermerait précisément la soirée — le moment où l'on a envie de
     rejouer le match qu'on vient de regarder. */
  const fini = (r.json.matchs ?? []).find((m) => m.id === 4);
  check('un match fini du jour reste dans la liste', Boolean(fini)
    || (console.log('        les matchs :',
      (r.json.matchs ?? []).map((m) => m.id).join(', ')), false));
  check('et il reste classé, puisque c’est sa journée', fini?.mode === 'classe'
    || (console.log('        il dit :', fini?.mode), false));
  /* Mais il passe derrière ce qui se joue encore : on propose d'abord un match
     en cours. */
  check('sans passer devant ce qui se joue', r.json.matchs[0]?.id !== 4);

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

/* ===================================== ce qui est en jeu, avant d'entrer en file

   CONTRATS.md § 17 (décision Q12) : chaque match de la liste sert `enJeu`, les
   écharpes qu'une **victoire** rapporterait dans chaque format — barème du
   mode (30 classé, 15 entraînement) × prime du format × 2 si l'on suit l'un
   des deux clubs. Le serveur compte, la page nomme ; elle n'écrit rien sans
   ce champ. Absent sur un match qu'on ne peut plus jouer.

   Les montants attendus sont **exacts**, écrits depuis le barème et la prime
   du registre, jamais « plus que zéro ». */
{
  const attendu = (bareme, double) => Object.fromEntries(Object.keys(FORMATS)
    .map((f) => [f, Math.round(bareme * primeDeFormat(f)) * double]));
  const pareil = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  r = await call('/api/deck/matchs');
  const duJour = r.json.matchs.find((m) => m.id === 2);
  check(`1 contre 1 classé chez soi : 30 × 2 (${duJour?.enJeu?.['1v1']})`,
    duJour?.enJeu?.['1v1'] === 60);
  check('et chaque format porte sa prime, doublée pour son club',
    pareil(duJour?.enJeu, attendu(30, 2))
    || (console.log('        servi :', JSON.stringify(duJour?.enJeu),
      '· attendu :', JSON.stringify(attendu(30, 2))), false));
  const plusTard = r.json.matchs.find((m) => m.id === 3);
  check('à l’entraînement, le barème de l’entraînement, doublé pour son club',
    pareil(plusTard?.enJeu, attendu(15, 2))
    || (console.log('        servi :', JSON.stringify(plusTard?.enJeu)), false));

  /* Un match où l'on ne suit personne : pas de double. Semé ici et retiré
     après, pour ne rien changer à ce que les blocs du dessus comptent. */
  await pool.query(`INSERT INTO teams (id,name) VALUES (92,'Lugano')`);
  await pool.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
    VALUES (20,207,2026,91,92,'NS', UTC_TIMESTAMP() + INTERVAL 3 DAY)`);
  /* La journée apporte un match du jour qu'on ne suit pas, et un match
     d'hier : elle peut en rapporter un, la requête de la base non. */
  /* « Maintenant » et non « il y a trente minutes » : passé minuit UTC, le
     second serait la veille, et le contrôle accuserait le barème. */
  journee = { groupes: [{ ligue: { id: 39, name: 'Premier League', tier: 1 }, matchs: [
    { id: 5000, date: new Date().toISOString(),
      status: '1H', elapsed: 28, live: true, fini: false,
      home: { id: 33, name: 'Manchester United', goals: 1 },
      away: { id: 40, name: 'Liverpool', goals: 0 } },
    { id: 6000, date: new Date(Date.now() - 30 * 3600e3).toISOString(),
      status: 'FT', elapsed: 90, live: false, fini: true,
      home: { id: 33, name: 'Manchester United', goals: 2 },
      away: { id: 40, name: 'Liverpool', goals: 2 } },
  ] }] };

  r = await call('/api/deck/matchs?tous=1');
  const ailleurs = r.json.matchs.find((m) => m.id === 20);
  check(`3 contre 3 à l’entraînement, sans son club : 15 × la prime (${ailleurs?.enJeu?.['3v3']})`,
    ailleurs?.enJeu?.['3v3'] === Math.round(15 * primeDeFormat('3v3'))
    && pareil(ailleurs?.enJeu, attendu(15, 1))
    || (console.log('        servi :', JSON.stringify(ailleurs?.enJeu)), false));
  const enDirect = r.json.matchs.find((m) => m.id === 5000);
  check('classé, sans son club : le barème simple',
    pareil(enDirect?.enJeu, attendu(30, 1))
    || (console.log('        servi :', JSON.stringify(enDirect?.enJeu)), false));

  const hier = r.json.matchs.find((m) => m.id === 6000);
  check('un match d’hier rapporté par la journée n’a rien en jeu',
    Boolean(hier) && !('enJeu' in hier)
    || (console.log('        il dit :', JSON.stringify(hier ?? '(absent de la liste)')), false));
  /* Et c'est bien un match où l'on ne peut plus entrer : la liste et le choix
     du support disent la même chose. */
  const support = await call('/api/deck/match/6000');
  check('et l’on ne peut d’ailleurs plus y entrer', support.json.error === 'duel.error.fixture_past'
    || (console.log('        il dit :', JSON.stringify(support.json)), false));

  journee = null;
  await pool.query('DELETE FROM fixtures WHERE id = 20');
  await pool.query('DELETE FROM teams WHERE id = 92');
}

/* ===================================== les couleurs des deux clubs (lot 6)

   L'affiche du match choisi porte une écharpe aux couleurs des deux clubs, et
   le camp se choisit sur deux bâches teintes : la liste les sert comme celle
   du Virage (`homeColors`, `awayColors` : une ou deux couleurs, un tableau vide
   quand on ne les a pas). Lues par clé primaire, **une** lecture pour toute la
   liste, et une base sans `sql/couleurs.sql` rend la liste sans couleurs
   plutôt que de la faire tomber. */
{
  await pool.query(`UPDATE teams SET color1 = '#C8102E', color2 = '#FFFFFF' WHERE id = 85`);
  await pool.query(`UPDATE teams SET color1 = '#1D428A', color2 = NULL WHERE id = 91`);
  /* Un match du jour que la base ne connaît pas : ses clubs n'ont pas de
     couleurs lues (au plus une ligne posée par l'ancrage, sans teinte). */
  journee = { groupes: [{ ligue: { id: 39, name: 'Premier League', tier: 1 }, matchs: [
    { id: 5001, date: new Date().toISOString(), status: 'NS', elapsed: null, live: false, fini: false,
      home: { id: 33, name: 'Manchester United', goals: 0 },
      away: { id: 40, name: 'Liverpool', goals: 0 } } ] }] };

  // Compter les lectures des clubs : une par liste, jamais une par match.
  const executer = pool.execute.bind(pool);
  let lectures = 0;
  pool.execute = (sql, ...reste) => {
    if (/FROM teams WHERE id IN/.test(sql)) lectures++;
    return executer(sql, ...reste);
  };
  try {
    r = await call('/api/deck/matchs?tous=1');
  } finally { pool.execute = executer; }
  const pareil = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const m2 = r.json.matchs?.find((m) => m.id === 2);
  check(`Sion–Bâle porte les couleurs des deux clubs (${JSON.stringify([m2?.homeColors, m2?.awayColors])})`,
    pareil(m2?.homeColors, ['#C8102E', '#FFFFFF']) && pareil(m2?.awayColors, ['#1D428A']));
  const m3 = r.json.matchs?.find((m) => m.id === 3);
  check('et Bâle–Sion, dans l’autre sens',
    pareil(m3?.homeColors, ['#1D428A']) && pareil(m3?.awayColors, ['#C8102E', '#FFFFFF']));
  const inconnu = r.json.matchs?.find((m) => m.id === 5001);
  check('des clubs sans couleurs lues : deux tableaux vides, jamais une couleur inventée',
    Boolean(inconnu) && pareil(inconnu.homeColors, []) && pareil(inconnu.awayColors, [])
    || (console.log('        il dit :', JSON.stringify(inconnu ?? '(absent)')), false));
  check(`une seule lecture des clubs pour ${r.json.matchs?.length} matchs (${lectures})`,
    lectures === 1 && r.json.matchs.length > 3);

  /* Sans la seconde colonne, la liste répond, sans couleurs, et le journal le
     dit une fois. Remise ensuite comme `sql/couleurs.sql` la pose. */
  await pool.query('ALTER TABLE teams DROP COLUMN color2');
  const dire = console.error;
  const journal = [];
  console.error = (...a) => { journal.push(a.join(' ')); };
  let sans, encore;
  try {
    sans = await call('/api/deck/matchs?tous=1');
    encore = await call('/api/deck/matchs?tous=1');
  } finally {
    console.error = dire;
    await pool.query('ALTER TABLE teams ADD COLUMN IF NOT EXISTS color2 CHAR(7) NULL AFTER color1');
  }
  const s2 = sans.json.matchs?.find((m) => m.id === 2);
  check('sans sql/couleurs.sql, la liste répond quand même, sans couleurs',
    sans.status === 200 && Boolean(s2) && pareil(s2.homeColors, []) && 'enJeu' in s2
    || (console.log('        il dit :', sans.status, JSON.stringify(sans.json).slice(0, 200)), false));
  check('et le journal le dit une fois, pas à chaque liste',
    encore.status === 200 && journal.filter((l) => l.includes('couleurs des clubs')).length === 1
    || (console.log('        journal :', journal.join(' | ')), false));
  journee = null;
}

/* ===================================== ce que la liste annonce, l'entrée le tient (lot 6)

   La liste des matchs annonce un mode et ce qui est en jeu ; `matchSupport`
   décide à l'entrée en file. Deux constats de la partie A, éprouvés ici :

   1. **Un match reporté ou annulé ne porte aucun duel.** La requête de la
      liste écartait CANC et PST, mais la journée du football, qui se
      superpose à la base, les y remettait — et `matchSupport` les acceptait,
      qu'ils viennent de la journée ou de la base. Un match reporté le matin
      même restait proposé, écharpes en jeu, et un duel classé s'y montait.

   2. **La liste et l'entrée lisent le même jour.** La liste prenait le jour
      UTC de l'instant du coup d'envoi ; l'entrée, les dix premiers caractères
      de la date servie. Une date servie avec son décalage — 01:30 à +02:00,
      c'est-à-dire la veille à 23:30 UTC — faisait annoncer un duel classé par
      la liste et monter un entraînement à l'entrée.

   Et ce que l'entrée sert maintenant en plus : `enJeu` sur la route d'un
   match (le même que sur la liste), et les couleurs des deux clubs dans le
   match support, que la vue du duel transporte. */
{
  const pareil = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const D0 = new Date().toISOString().slice(0, 10);
  const lendemain = new Date(Date.parse(`${D0}T00:00:00Z`) + 86400e3).toISOString().slice(0, 10);
  // Les couleurs des deux clubs : le bloc du dessus a retiré puis remis `color2`.
  await pool.query(`UPDATE teams SET color1 = '#C8102E', color2 = '#FFFFFF' WHERE id = 85`);
  await pool.query(`UPDATE teams SET color1 = '#1D428A', color2 = NULL WHERE id = 91`);
  /* En base : un match du jour reporté (la journée ne le connaît pas), et un
     match du jour que la base croit encore à venir. */
  await pool.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
    VALUES (30,207,2026,85,91,'PST', UTC_DATE() + INTERVAL 21 HOUR),
           (31,207,2026,91,85,'NS',  UTC_DATE() + INTERVAL 22 HOUR)`);
  const club = (id, name) => ({ id, name, goals: null });
  journee = { groupes: [{ ligue: { id: 207, name: 'Super League', tier: 2 }, matchs: [
    // La base le croit à venir ; la journée le sait reporté.
    { id: 31, date: `${D0}T22:00:00+00:00`, status: 'PST', elapsed: null, live: false, fini: false,
      home: club(91, 'Bâle'), away: club(85, 'Sion') },
    // Annulé, et inconnu de la base.
    { id: 7000, date: `${D0}T18:00:00+00:00`, status: 'CANC', elapsed: null, live: false, fini: false,
      home: club(85, 'Sion'), away: club(91, 'Bâle') },
    // Aujourd'hui à 23:30 UTC, écrit à l'heure de Zurich en été : sa date affichée est demain.
    { id: 7001, date: `${lendemain}T01:30:00+02:00`, status: 'NS', elapsed: null, live: false,
      fini: false, home: club(85, 'Sion'), away: club(91, 'Bâle') },
  ] }] };

  r = await call('/api/deck/matchs?tous=1');
  const liste = r.json.matchs ?? [];
  const statuts = liste.map((m) => `${m.id}:${m.status_short}`);
  check('aucun match reporté ou annulé n’est proposé, d’où qu’il vienne',
    !liste.some((m) => ['CANC', 'PST'].includes(m.status_short))
    || (console.log('        la liste :', statuts.join(', ')), false));
  check('pas même celui que la base croit à venir et que la journée sait reporté',
    !liste.some((m) => m.id === 31) && !liste.some((m) => m.id === 7000)
    || (console.log('        la liste :', statuts.join(', ')), false));
  for (const [id, quoi] of [[30, 'reporté, connu de la base seule'],
    [31, 'reporté selon la journée'], [7000, 'annulé, connu de la journée seule']]) {
    const x = await call(`/api/deck/match/${id}`);
    check(`et l’entrée le refuse (${quoi})`, x.json.error === 'duel.error.fixture_annule'
      || (console.log('        il dit :', JSON.stringify(x.json).slice(0, 160)), false));
  }

  /* **Et la page du duel sait le dire.** Un refus du support ne se lit pas
     sur cette route-ci — aucune page ne l'appelle — mais à l'entrée en file :
     `nvn:queue` relaie le code de `matchSupport` tel quel (`nvn:error`), et la
     page le traduit par son tableau `MESSAGES`. Un code sans phrase s'y lit
     « Refusé par le serveur : duel.error.fixture_annule ». Le contrôle des
     refus d'`appels-smoke` ne voit que les `new Cheat` de `nvn/index.js` :
     ceux du support lui échappent, et le refus d'un match reporté ou annulé
     est né sans phrase. On lit les deux fichiers plutôt que d'en recopier un :
     une liste recopiée ne mesurerait que sa copie. */
  const refusDuSupport = (src) =>
    new Set([...src.matchAll(/fail\('(duel\.error\.[a-z_]+)'/g)].map((m) => m[1]));
  const sansPhrase = (src, page) => {
    const traduits = new Set([...page.matchAll(/'(duel\.error\.[a-z_]+)'\s*:/g)].map((m) => m[1]));
    return [...refusDuSupport(src)].filter((c) => !traduits.has(c));
  };
  // Le canari : sans lui, une lecture qui ne trouve rien passerait pour un vert.
  check('le contrôle des phrases dénonce un refus que la page ne traduit pas',
    sansPhrase("throw fail('duel.error.x');", "{ 'duel.error.y': 'Y' }").join() === 'duel.error.x');
  check('et se tait quand la phrase est écrite',
    sansPhrase("throw fail('duel.error.x');", "{ 'duel.error.x':  'X' }").length === 0);
  const srcDeck = readFileSync(new URL('../src/server/deck/index.js', import.meta.url), 'utf8');
  const pageDuel = readFileSync(new URL('../public/duel-nvn.html', import.meta.url), 'utf8');
  const muets = sansPhrase(srcDeck, pageDuel);
  check(muets.length
    ? `${muets.length} refus du support ${muets.length > 1 ? 's’affichent' : 's’affiche'} en code brut sur la page du duel : ${
      muets.join(', ')} (phrase à écrire dans MESSAGES, public/duel-nvn.html)`
    : `chacun des ${refusDuSupport(srcDeck).size} refus du support a sa phrase sur la page du duel`,
  refusDuSupport(srcDeck).size >= 3 && muets.length === 0);

  /* Le même mode et le même `enJeu`, ligne par ligne, sur la liste et à
     l'entrée : ce qu'on annonce est ce que l'entrée décidera. */
  const ecarts = [];
  for (const m of liste) {
    const x = await call(`/api/deck/match/${m.id}`);
    if (x.json.mode !== m.mode || !pareil(x.json.enJeu, m.enJeu)) {
      ecarts.push(`${m.id} : liste ${m.mode} ${JSON.stringify(m.enJeu)} · entrée ${
        x.json.error ?? x.json.mode} ${JSON.stringify(x.json.enJeu)}`);
    }
  }
  check(`la liste et l’entrée disent le même mode et le même enJeu (${liste.length} matchs)`,
    liste.length > 3 && ecarts.length === 0
    || (console.log('       ', ecarts.join('\n        ')), false));
  const decale = liste.find((m) => m.id === 7001);
  check('une date servie avec son décalage reste du jour où elle tombe en UTC',
    decale?.mode === 'classe'
    && (await call('/api/deck/match/7001')).json.mode === 'classe'
    || (console.log('        il dit :', decale?.mode), false));

  /* Les couleurs, dans le match support : c'est lui que le duel emporte
     (`fixture`), et que la vue sert dix fois par seconde sans relire. */
  r = await call('/api/deck/match/2');
  check(`le match support porte les couleurs des deux clubs (${JSON.stringify(
    [r.json.fixture?.homeColors, r.json.fixture?.awayColors])})`,
    pareil(r.json.fixture?.homeColors, ['#C8102E', '#FFFFFF'])
    && pareil(r.json.fixture?.awayColors, ['#1D428A']));
  check('et ce qui y est en jeu, comme sur la liste : 30 × 2 en 1 contre 1',
    r.json.enJeu?.['1v1'] === 60);
  /* Un match que seule la journée connaît : ses couleurs se lisent par
     l'identifiant de ses clubs, pas par une ligne de match. */
  r = await call('/api/deck/match/7001');
  check('un match venu de la journée porte aussi les couleurs de ses clubs',
    pareil(r.json.fixture?.homeColors, ['#C8102E', '#FFFFFF'])
    && pareil(r.json.fixture?.awayColors, ['#1D428A'])
    || (console.log('        il dit :', JSON.stringify(r.json.fixture)), false));
  /* Et un club dont on n'a rien lu : un tableau vide, jamais absent. */
  await pool.query(`UPDATE teams SET color1 = NULL, color2 = NULL WHERE id = 91`);
  const sansTeinte = await call('/api/deck/match/3');
  await pool.query(`UPDATE teams SET color1 = '#1D428A' WHERE id = 91`);
  check('un club sans couleurs lues : un tableau vide, jamais une couleur inventée',
    pareil(sansTeinte.json.fixture?.homeColors, [])
    && pareil(sansTeinte.json.fixture?.awayColors, ['#C8102E', '#FFFFFF'])
    || (console.log('        il dit :', JSON.stringify(sansTeinte.json.fixture)), false));

  /* Sans `color2`, l'entrée en file ne doit pas tomber pour une teinte. */
  await pool.query('ALTER TABLE teams DROP COLUMN color2');
  const dire = console.error;
  console.error = () => {};
  let sans;
  try { sans = await call('/api/deck/match/2'); }
  finally {
    console.error = dire;
    await pool.query('ALTER TABLE teams ADD COLUMN IF NOT EXISTS color2 CHAR(7) NULL AFTER color1');
  }
  check('sans sql/couleurs.sql, le match support répond, sans couleurs',
    sans.status === 200 && sans.json.mode === 'classe'
    && pareil(sans.json.fixture?.homeColors, [])
    || (console.log('        il dit :', sans.status, JSON.stringify(sans.json).slice(0, 200)), false));

  journee = null;
  await pool.query('DELETE FROM fixtures WHERE id IN (30, 31, 7000, 7001)');
}
console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end(); http.close();
process.exit(failures ? 1 : 0);
