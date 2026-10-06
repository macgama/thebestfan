/** Test de l'administration : rôles, actions, traçabilité. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createAdmin } from '../src/server/admin/index.js';
import { SETS } from '../src/shared/fanzzy/dex.js';
import { charger as chargerCatalogue, parIdentifiant, publies }
  from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE, figerHorloge } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
/* `saisons` est dans la liste, et c'est nécessaire : la table décide des séries
   ouvertes pour tout le jeu, et `sql/saisons.sql` n'y repose sa saison 1 que si
   elle est vide. Une saison laissée par un passage précédent — ou par une suite
   voisine — fermerait des séries que celle-ci croit ouvertes, et les contrôles
   parleraient d'un état que personne n'a voulu. */
/* Les quatre tables de `sql/quotidien.sql` aussi : la saison datée lit le grand
   livre pour savoir si un carnet est figé, et une ligne laissée par un passage
   précédent figerait un carnet que cette suite croit libre. */
await raw.query(`DROP TABLE IF EXISTS parrainages, contenus, abonnements, achats, kop_invites, amities, saisons,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, reglages, admin_audit, user_decks, user_stuff, user_etats, user_skins,
  user_fanzzy, user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache,
  souvenir_leagues, duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings,
  fixtures, team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users,
  recompenses, missions_jour, compteurs_jour, user_nouveautes`);
/* `quotidien.sql` en dernier, comme dans `ORDRE` : il ajoute à `saisons` les
   colonnes de la saison datée (`fin_le`, `ouvre_le`, `carnet`). */
for (const f of ['auth.sql','football.sql', 'minutes.sql', 'couleurs.sql','souvenirs.sql', 'billets.sql','fanzzy.sql','inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql',
                 'teletext.sql','admin.sql','saisons.sql','contenus.sql','abonnement.sql',
                 'quotidien.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
// La table `fanzzy` n'est pas dans le DROP ci-dessus, et c'est voulu : elle
// porte le catalogue, que toutes les suites partagent. Mais cette suite y crée
// une carte d'essai — et sans ce ménage, elle réussit une fois puis échoue à
// chaque lancement suivant sur « identifiant déjà pris ». Un test qui ne passe
// qu'au premier essai finit par être cru sur parole.
await raw.query(`DELETE FROM fanzzy WHERE id LIKE 'ZZ%'`);
const A = 'aaaa0000-0000-0000-0000-000000000001';   // futur admin
const B = 'bbbb0000-0000-0000-0000-000000000002';   // joueur
const C = 'cccc0000-0000-0000-0000-000000000003';   // second admin
for (const [id, mail, pseudo] of [[A,'patron@ex.fr','Patron'],[B,'joueur@ex.fr','Joueur'],
                                  [C,'second@ex.fr','Second']]) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, mail, pseudo]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs) VALUES (?,100,5)`,[id]);
}
await raw.query(`INSERT INTO souvenir_leagues (league_id,season,name,country,family,tier,enabled,has_events)
  VALUES (207,2026,'Super League','Switzerland','championnat',2,1,1),
         (999,2026,'Petite Coupe','France','coupe',3,1,1)`);
await raw.query(`INSERT INTO api_cache (k,payload,expires_at) VALUES
  ('x','{}', NOW(3) + INTERVAL 1 HOUR),('y','{}', NOW(3) + INTERVAL 1 HOUR)`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
// Le catalogue vit en base : l’administration le modifie, il faut donc
// qu’il soit chargé, exactement comme au démarrage du serveur.
await chargerCatalogue(pool);
await chargerTenues(pool);
let moi = B;   // on commence en simple joueur
/* L'abonnement est monté comme `server.js` le monte : sans lui,
   l'administration répond « module absent » et les contrôles ci-dessous
   éprouveraient ce refus plutôt que le geste. */
const { createAbonnement } = await import('../src/server/abonnement/index.js');
const abonnement = createAbonnement({ pool, requireAuth: (r,_s,n)=>n() });
const { createContenus } = await import('../src/server/contenus/index.js');
const contenus = createContenus({ pool });
await contenus.semer();
await contenus.charger();

const adm = createAdmin({ pool,
  requireAuth: (r,_s,n)=>{ r.user = { id: moi, email: moi===A?'patron@ex.fr':'joueur@ex.fr' }; n(); },
  deps: { abonnement, contenus } });
const app = express(); app.use('/api/admin', adm.router);
const http = createServer(app); await new Promise((r)=>http.listen(0,r));
const base = `http://localhost:${http.address().port}`;
const call = async (p,o={}) => {
  const r = await fetch(base+p,{ method:o.method ?? (o.body?'POST':'GET'),
    headers:{'content-type':'application/json'}, body:o.body?JSON.stringify(o.body):undefined });
  return { status:r.status, json: await r.json().catch(()=>({})) };
};

/* --------------------------------------------------------- amorçage */

let r = await call('/api/admin/suis-je');
check('un joueur n\u2019est pas admin', r.json.admin === false);
r = await call('/api/admin/apercu');
check('un joueur ne voit pas l\u2019aperçu', r.status === 403);

const n = await adm.amorcer('patron@ex.fr, inconnu@ex.fr');
check('promotion par ADMIN_EMAILS', n === 1);
moi = A;
r = await call('/api/admin/suis-je');
check('l\u2019admin est reconnu', r.json.admin === true);
check('l\u2019amorçage est journalisé',
  (await call('/api/admin/journal')).json.journal.some((l)=>l.action==='admin.promu'));

/* ---------------------------------------------------------- aperçu */

r = await call('/api/admin/apercu');
check('aperçu des joueurs', r.json.joueurs.total === 3 && r.json.joueurs.admins === 1);
check('aperçu des compétitions', r.json.competitions.competitions === 2);

/* --------------------------------------------------------- joueurs */

r = await call('/api/admin/joueurs?q=Joueur');
check('recherche de joueur', r.json.joueurs.length === 1 && r.json.joueurs[0].pseudo === 'Joueur');
check('aucun hachage exposé', !JSON.stringify(r.json).includes('password'));

r = await call(`/api/admin/joueur/${B}`, { method:'PATCH', body:{ scarves: 250 } });
check('écharpes créditées', r.json.scarves === 250);
const [[w]] = await pool.query('SELECT scarves FROM user_wallet WHERE user_id = ?', [B]);
check('le solde a bien bougé', w.scarves === 350);

r = await call(`/api/admin/joueur/${B}`, { method:'PATCH', body:{ scarves: -1000 } });
const [[w2]] = await pool.query('SELECT scarves FROM user_wallet WHERE user_id = ?', [B]);
check('un solde ne peut pas devenir négatif', w2.scarves === 0);

r = await call(`/api/admin/joueur/${B}`, { method:'PATCH', body:{ status:'locked' } });
check('compte bloqué', r.json.status === 'locked');

await pool.query(`INSERT INTO sessions (token_hash,user_id,expires_at)
  SELECT REPEAT('a',64), id, NOW(3)+INTERVAL 1 DAY FROM users WHERE public_id = ?`, [B]);
await call(`/api/admin/joueur/${B}`, { method:'PATCH', body:{ status:'active' } });
await call(`/api/admin/joueur/${B}`, { method:'PATCH', body:{ status:'locked' } });
const [sess] = await pool.query(`SELECT 1 FROM sessions s JOIN users u ON u.id = s.user_id
  WHERE u.public_id = ?`, [B]);
check('bloquer ferme les sessions ouvertes', sess.length === 0);

r = await call(`/api/admin/joueur/${A}`, { method:'PATCH', body:{ role:'joueur' } });
check('un admin ne peut pas se retirer ses droits', r.json.error === 'admin.error.not_yourself');

r = await call(`/api/admin/joueur/${A}`, { method:'PATCH', body:{ status:'locked' } });
check('un admin ne peut pas se bloquer', r.json.error === 'admin.error.not_yourself');

r = await call(`/api/admin/joueur/${C}`, { method:'PATCH', body:{ role:'admin' } });
check('un second admin peut être nommé', r.json.role === 'admin');

r = await call('/api/admin/joueur/inexistant', { method:'PATCH', body:{ scarves: 10 } });
check('joueur inconnu : 404', r.status === 404);

r = await call(`/api/admin/joueur/${B}`, { method:'PATCH', body:{} });
check('une modification vide est refusée', r.json.error === 'admin.error.nothing_to_do');

/* ---------------------------------------------------- compétitions */

r = await call('/api/admin/competitions?q=Super');
check('recherche de compétition', r.json.competitions.length === 1);

r = await call('/api/admin/competition/999/2026', { method:'PATCH',
  body:{ enabled:false, tier:1, debut:'2026-08-01' } });
check('compétition désactivée et repalierée',
  r.json.enabled === false && r.json.tier === 1 && r.json.debut === '2026-08-01');
const [[c]] = await pool.query(
  'SELECT enabled,tier,starts_on FROM souvenir_leagues WHERE league_id=999', []);
check('la base reflète le changement', c.enabled === 0 && c.tier === 1);

r = await call('/api/admin/competition/999/2026', { method:'PATCH', body:{ debut:'pas-une-date' } });
check('date invalide refusée', r.json.error === 'admin.error.nothing_to_do');

/* -------------------------------------------------------- réglages */

r = await call('/api/admin/reglage/annonce', { method:'PUT',
  body:{ valeur:{ texte:'Maintenance ce soir', actif:true } } });
check('réglage enregistré', r.json.cle === 'annonce');
r = await call('/api/admin/reglages');
check('réglage relu', r.json.annonce.texte === 'Maintenance ce soir');

r = await call('/api/admin/reglage/Mauvaise Clé!', { method:'PUT', body:{ valeur:1 } });
check('clé invalide refusée', r.json.error === 'admin.error.bad_key');

/* ----------------------------------------------------------- outils */

r = await call('/api/admin/cache/purge', { method:'POST' });
check('cache purgé', r.json.purge === 2);

/* ------------------------------------------------------------ audit */

r = await call('/api/admin/journal');
const actions = r.json.journal.map((l)=>l.action);
check('les modifications de joueur sont tracées', actions.includes('joueur.modifie'));
check('les compétitions aussi', actions.includes('competition.modifiee'));
check('les réglages aussi', actions.includes('reglage.modifie'));
check('la purge aussi', actions.includes('cache.purge'));
check('l\u2019auteur est nommé', r.json.journal.some((l)=>l.acteur === 'Patron'));
check('le détail est conservé',
  r.json.journal.some((l)=>l.detail && JSON.stringify(l.detail).includes('scarves')));

const avant = r.json.journal.length;
moi = B;
await call('/api/admin/joueur/' + A, { method:'PATCH', body:{ role:'joueur' } });
moi = A;
r = await call('/api/admin/journal');
check('une tentative refusée n\u2019écrit rien', r.json.journal.length === avant);


/* ---------------------------------------------- le catalogue Fanzzy

   C'est la raison d'être de cet écran : ajouter une carte sans toucher au
   code. Les trois garde-fous comptent plus que le cas passant — on ne
   supprime pas, on ne renomme pas un identifiant, et le cache suit. */

moi = A;
r = await call('/api/admin/fanzzy');
check('le catalogue est listé', r.json.fanzzy.length > 0);
check('avec les barèmes pour peupler les listes déroulantes',
  Boolean(r.json.types && r.json.sets && r.json.rar));

const combienAvant = r.json.fanzzy.length;

// Création.
r = await call('/api/admin/fanzzy', { body: { id:'ZZ9', nom:'Le Testeur', type:'voix',
  set:'TR', rar:'commune', stage:1, cri:{ label:'ESSAI', gest:'tempo', power:50 },
  mods:{ tempoWindow:1.1 } } });
check('un Fanzzy se crée', r.status === 200 && r.json.id === 'ZZ9');
check('et il arrive aussitôt dans le cache du jeu',
  Boolean(parIdentifiant('ZZ9')));
check('avec ses effets', parIdentifiant('ZZ9')?.mods?.tempoWindow === 1.1);

// Le même identifiant deux fois.
r = await call('/api/admin/fanzzy', { body: { id:'ZZ9', nom:'Doublon', type:'voix',
  set:'TR', rar:'commune', cri:{ label:'X', gest:'tempo', power:50 } } });
check('un identifiant déjà pris est refusé',
  r.json.error === 'admin.error.fanzzy_existe');

// Les validations.
r = await call('/api/admin/fanzzy', { body: { id:'zz-8', nom:'Mauvais', type:'voix',
  set:'TR', rar:'commune', cri:{ label:'X', gest:'tempo', power:50 } } });
check('un identifiant mal formé est refusé', r.json.error === 'admin.error.fanzzy_id');

r = await call('/api/admin/fanzzy/ZZ9', { method:'PATCH', body:{ type:'inconnu' } });
check('un type inconnu est refusé', r.json.error === 'admin.error.fanzzy_type');

r = await call('/api/admin/fanzzy/ZZ9', { method:'PATCH', body:{ evo:'NEXISTEPAS' } });
check('une évolution vers le vide est refusée',
  r.json.error === 'admin.error.fanzzy_evo_inconnue');

r = await call('/api/admin/fanzzy/ZZ9', { method:'PATCH', body:{ evo:'ZZ9' } });
check('un Fanzzy ne peut pas évoluer en lui-même',
  r.json.error === 'admin.error.fanzzy_evo_soi');

// Modification.
r = await call('/api/admin/fanzzy/ZZ9', { method:'PATCH', body:{ nom:'Le Testeur Modifié' } });
check('un Fanzzy se modifie', parIdentifiant('ZZ9')?.nom === 'Le Testeur Modifié');

// L'identifiant est la clé des collections : il ne bouge jamais.
r = await call('/api/admin/fanzzy/ZZ9', { method:'PATCH', body:{ id:'AUTRE', nom:'Renommé' } });
check('l’identifiant ne se renomme pas', Boolean(parIdentifiant('ZZ9')) && !parIdentifiant('AUTRE'));

// Dépublication : la carte sort des tirages sans disparaître.
await call('/api/admin/fanzzy/ZZ9', { method:'PATCH', body:{ publie:false } });
check('une carte retirée sort des tirages', !publies().some((x) => x.id === 'ZZ9'));
check('mais reste lisible par identifiant', Boolean(parIdentifiant('ZZ9')));
check('et le catalogue n’a rien perdu',
  (await call('/api/admin/fanzzy')).json.fanzzy.length === combienAvant + 1);

// Tout est tracé.
r = await call('/api/admin/journal');
check('la création est journalisée',
  r.json.journal.some((l) => l.action === 'fanzzy.cree' && l.cible === 'ZZ9'));
check('la modification aussi',
  r.json.journal.some((l) => l.action === 'fanzzy.modifie' && l.cible === 'ZZ9'));

// Un joueur ordinaire ne touche à rien.
moi = B;
r = await call('/api/admin/fanzzy');
check('un joueur ne voit pas le catalogue d’administration', r.status === 403);
r = await call('/api/admin/fanzzy/ZZ9', { method:'PATCH', body:{ nom:'Pirate' } });
check('et ne peut pas le modifier',
  r.status === 403 && parIdentifiant('ZZ9')?.nom !== 'Pirate');
moi = A;

/* ------------------------------------------------- les séries ouvertes

   Ouvrir le jeu série par série. Ce qui compte ici n'est pas l'interrupteur
   mais ce qu'il n'emporte pas avec lui : une série fermée cesse de
   distribuer, elle ne retire rien à personne. */

moi = A;

r = await call('/api/admin/fanzzy');
check('les séries sont listées avec leur état',
  Array.isArray(r.json.series) && r.json.series.length === SETS.length
  && r.json.series.every((s) => 'ouverte' in s && 'tirables' in s));
check('toutes les séries sont ouvertes au départ',
  r.json.ouvertes === null && r.json.series.every((s) => s.ouverte));

/* ================================================= les saisons

   Les séries s'ouvraient au niveau du joueur, et l'administration en tenait la
   liste à part. Il n'y a plus qu'un levier : **une saison**, qui ouvre pour
   tout le monde le même jour. `PUT /api/admin/series` n'existe plus.

   Ce qui se vérifie ici est ce qui se vérifiait avant — qui a le droit
   d'ouvrir, ce qu'on refuse d'ouvrir, et que le catalogue ne perde rien — plus
   ce que la saison ajoute : le brouillon, le lancement, et le retour. */

// La série de la carte d'essai : c'est elle qu'on va ouvrir.
const uneSerie = parIdentifiant('ZZ9').set;

r = await call('/api/admin/saisons');
check('les saisons se listent, avec de quoi en composer une',
  Array.isArray(r.json.saisons)
  && Array.isArray(r.json.choix?.series) && Array.isArray(r.json.choix?.tenues)
  && Array.isArray(r.json.choix?.stuff) && Array.isArray(r.json.choix?.actions));

r = await call('/api/admin/saisons', { method: 'POST',
  body: { nom: 'Essai', texte: 'Pour voir.', series: [uneSerie] } });
check('une saison se crée en brouillon', r.status === 200
  && r.json.saisons.some((x) => x.nom === 'Essai' && x.lancee === false));

const essai = r.json.saisons.find((x) => x.nom === 'Essai');

/* **Un brouillon n'ouvre rien.** C'est tout l'intérêt : on prépare une saison
   sans que rien ne change pour personne, et on la relit avant de la lancer. */
r = await call('/api/admin/fanzzy');
check('un brouillon ne change rien à ce qui est ouvert', r.json.ouvertes === null);

r = await call('/api/admin/saisons', { method: 'POST', body: { series: [uneSerie] } });
check('une saison sans nom est refusée', r.json.error === 'admin.error.saison_sans_nom');

r = await call(`/api/admin/saison/${essai.id}/lancer`, { method: 'POST', body: { lancer: true } });
check('la lancer ouvre ses séries', r.status === 200
  && r.json.ouvertes?.length === 1 && r.json.ouvertes[0] === uneSerie);

r = await call('/api/admin/fanzzy');
check('et les autres sont fermées',
  r.json.series.filter((x) => x.ouverte).length === 1);

// Le point qui compte : le catalogue ne perd rien. Une carte d'une série
// fermée reste connue, sinon la collection de qui la possède se briserait.
check('le catalogue garde toutes ses cartes',
  (await call('/api/admin/fanzzy')).json.fanzzy.length === combienAvant + 1);
{
  const ailleurs = publies().find((f) => f.set !== uneSerie);
  check('et une carte d’une série fermée reste lisible par identifiant',
    Boolean(ailleurs && parIdentifiant(ailleurs.id)));
}

/* Une saison lancée ne se supprime pas : on ne retire pas du jeu ce que des
   joueurs collectionnent par un bouton. Il faut d'abord la remettre en
   brouillon, ce qui est un geste distinct et réversible. */
r = await call(`/api/admin/saison/${essai.id}`, { method: 'DELETE' });
check('une saison lancée ne se supprime pas', r.json.error === 'admin.error.saison_lancee');

/* ---------------------------------- le retour au brouillon referme les stades

   Les cinq familles d'une saison ne se referment pas de la même façon, et la
   différence n'est pas un oubli :

     — les **séries** se referment par l'union, sans qu'on ait rien à écrire ;
     — les **tenues**, l'**équipement** et les **cartes d'action** ne se
       referment pas du tout : quelqu'un les a peut-être gagnées, et une carte
       qui disparaît d'une collection est une perte, pas une fermeture ;
     — les **stades**, si. C'est la seule famille que personne ne possède : un
       stade appartient au match, jamais à un joueur.

   Sans ce contrôle, remettre une saison en brouillon laissait ses lieux
   ouverts — c'est-à-dire que le geste le plus visible de l'administration ne
   se défaisait qu'à moitié, en silence. */
{
  const { publies: jouables } = await import('../src/server/contenus/index.js');
  const { STADES } = await import('../src/shared/stades.js');
  const lieu = STADES.at(-1).id;
  const autre = STADES.at(-2).id;

  r = await call('/api/admin/saisons', { method: 'POST',
    body: { nom: 'Les lieux', series: [uneSerie], stades: [lieu, autre] } });
  const saisonLieux = r.json.saisons?.at(-1);
  check('une saison peut ouvrir des stades', Boolean(saisonLieux));

  await call(`/api/admin/contenus/publier`, { method: 'POST',
    body: { famille: 'stade', ids: [lieu, autre], publie: false } });
  check('les deux lieux partent fermés',
    !jouables('stade').some((x) => x.id === lieu || x.id === autre));

  await call(`/api/admin/saison/${saisonLieux.id}/lancer`,
    { method: 'POST', body: { lancer: true } });
  check('la lancer les ouvre',
    jouables('stade').some((x) => x.id === lieu)
    && jouables('stade').some((x) => x.id === autre));

  /* **L'union, et pas la liste de la saison qu'on retire.** Une seconde saison
     lancée garde `autre` ouvert ; seul `lieu`, que personne d'autre n'annonce,
     doit se refermer. C'est exactement la faute qu'on ferait en fermant tout ce
     que la saison listait — et elle ne se verrait qu'au moment où un joueur
     tomberait sur un lieu manquant. */
  r = await call('/api/admin/saisons', { method: 'POST',
    body: { nom: 'Les lieux, encore', series: [uneSerie], stades: [autre] } });
  const seconde = r.json.saisons?.at(-1);
  await call(`/api/admin/saison/${seconde.id}/lancer`,
    { method: 'POST', body: { lancer: true } });

  await call(`/api/admin/saison/${saisonLieux.id}/lancer`,
    { method: 'POST', body: { lancer: false } });
  check('le retour au brouillon referme le lieu qu’elle seule annonçait',
    !jouables('stade').some((x) => x.id === lieu));
  check('et laisse ouvert celui qu’une autre saison lancée annonce aussi',
    jouables('stade').some((x) => x.id === autre)
    || (console.log('        il s’est refermé :', autre), false));

  await call(`/api/admin/saison/${seconde.id}/lancer`,
    { method: 'POST', body: { lancer: false } });
  await call(`/api/admin/saison/${seconde.id}`, { method: 'DELETE' });
  await call(`/api/admin/saison/${saisonLieux.id}`, { method: 'DELETE' });
  await call(`/api/admin/contenus/publier`, { method: 'POST',
    body: { famille: 'stade', ids: [lieu, autre], publie: true } });
}


// Une série sans carte de stade 1 publiée ne peut pas distribuer : on refuse
// de l'ouvrir plutôt que de laisser le premier booster lever.
{
  const vide = SETS.map((x) => x.id).find((id) =>
    !publies().some((f) => f.set === id && f.stage === 1));
  if (vide) {
    r = await call('/api/admin/saisons', { method: 'POST',
      body: { nom: 'Vide', series: [uneSerie, vide] } });
    check('une série sans carte tirable est refusée',
      r.json.error === 'admin.error.serie_sans_carte');
  } else {
    check('une série sans carte tirable est refusée', true);
    console.log('       (aucune série vide dans ce jeu de données)');
  }
}

r = await call('/api/admin/saisons', { method: 'POST',
  body: { nom: 'Inconnue', series: ['ZZZ'] } });
check('une série inconnue est refusée', r.json.error === 'admin.error.serie_inconnue');

/* **Le lancement revalide.**
 *
 * Un brouillon se prépare des semaines avant d'être lancé, et le catalogue
 * bouge entre-temps : une carte dépubliée ici, une série vidée là. Lancer une
 * saison dont une série n'a plus aucune carte de stade 1 publiée ferait lever le
 * premier booster — devant tout le monde, puisqu'une saison s'ouvre pour tout le
 * monde.
 *
 * On rejoue exactement ça : on compose un brouillon valide, on vide la série
 * par-derrière, et on lance. Puis on remet tout en place — cette suite tourne
 * sur le vrai catalogue, elle n'a pas le droit de le laisser abîmé.
 */
{
  // La plus petite série publiée : le moins de cartes à dépublier et à rendre.
  const compte = new Map();
  for (const f of publies().filter((f) => f.stage === 1)) {
    compte.set(f.set, [...(compte.get(f.set) ?? []), f.id]);
  }
  const [petite, cartes] = [...compte.entries()].sort((a, b) => a[1].length - b[1].length)[0];

  r = await call('/api/admin/saisons', { method: 'POST',
    body: { nom: 'Fragile', series: [petite] } });
  const fragile = r.json.saisons.find((x) => x.nom === 'Fragile');
  check('un brouillon sur une série pleine est accepté', Boolean(fragile));

  for (const id of cartes) {
    await call(`/api/admin/fanzzy/${id}`, { method: 'PATCH', body: { publie: false } });
  }
  r = await call(`/api/admin/saison/${fragile.id}/lancer`, { method: 'POST', body: { lancer: true } });
  check('une saison dont une série s’est vidée depuis ne se lance pas',
    r.json.error === 'admin.error.serie_sans_carte'
    || (console.log('        elle répond :', JSON.stringify(r.json).slice(0, 90)), false));

  for (const id of cartes) {
    await call(`/api/admin/fanzzy/${id}`, { method: 'PATCH', body: { publie: true } });
  }
  await call(`/api/admin/saison/${fragile.id}`, { method: 'DELETE' });
  check('et le catalogue est rendu intact',
    publies().filter((f) => f.set === petite && f.stage === 1).length === cartes.length);
}

r = await call('/api/admin/saisons', { method: 'POST',
  body: { nom: 'Objet', stuff: ['pas-une-piece'] } });
check('une pièce d’équipement inconnue est refusée',
  r.json.error === 'admin.error.stuff_inconnu');

/* Le retour en brouillon referme ses séries. Plus aucune saison lancée : on
   retombe sur « aucune restriction », qui est le bon défaut — un jeu sans une
   seule série ouverte n'est jamais ce qu'on a voulu dire. */
r = await call(`/api/admin/saison/${essai.id}/lancer`, { method: 'POST', body: { lancer: false } });
check('la remettre en brouillon referme ses séries', r.json.ouvertes === null);

/* Un corps que la route ne comprend pas ne veut pas dire « lance ».

   Elle lisait `lancer !== false` : champ absent, mal nommé ou mal emballé
   valaient tous « oui ». Le geste le plus visible du jeu — celui qui ouvre du
   contenu à tous les joueurs au même instant — se déclenchait donc sur une
   requête fautive, et c'est précisément ce que l'écran d'administration a fait
   pendant des semaines en envoyant un corps de la mauvaise forme. */
r = await call(`/api/admin/saison/${essai.id}/lancer`, { method: 'POST', body: {} });
check('une demande de lancement sans réponse claire est refusée, pas devinée',
  r.status === 400 && r.json.error === 'admin.error.lancer_manquant');
r = await call(`/api/admin/saisons`);
check('et elle n’a rien lancé',
  r.json.saisons.find((x) => x.id === essai.id)?.lancee === false);

r = await call(`/api/admin/saison/${essai.id}`, { method: 'DELETE' });
check('et un brouillon se supprime', r.status === 200
  && !r.json.saisons.some((x) => x.id === essai.id));

r = await call('/api/admin/journal');
check('le lancement d’une saison est journalisé',
  r.json.journal.some((l) => l.action === 'saison.lancee'));

moi = B;
r = await call('/api/admin/saisons', { method: 'POST', body: { nom: 'Pirate' } });
check('un joueur ne peut pas lancer de saison', r.status === 403);
moi = A;

/* ================================================ le catalogue des tenues

   Il a quitté le code pour la base : créer un thème ne doit pas demander un
   déploiement. C'est le même trajet qu'a pris le catalogue Fanzzy, et ce qui
   se vérifie ici est la même chose — que l’écriture atteigne le cache, sinon
   la tenue existe en base et reste invisible jusqu’au prochain redémarrage.

   Et surtout : **aucune route ne supprime**. Une tenue effacée orphelinerait
   les user_skins de tous ceux qui la possèdent. */

{
  r = await call('/api/admin/tenues');
  const avant = r.json.tenues ?? [];
  check('les tenues se listent', avant.length >= 3);
  check('les deux nouveaux thèmes sont là',
    ['prehistorique', 'apocalyptique'].every((id) => avant.some((t) => t.id === id)));
  check('les six anciens sont dépubliés, pas supprimés',
    ['pluie', 'nocturne', 'derby', 'anniv', 'promo', 'legende']
      .every((id) => avant.find((t) => t.id === id)?.publie === false));

  r = await call('/api/admin/tenues', { method: 'POST',
    body: { id: 'carnaval', nom: 'Carnaval', rar: 'epique', texte: 'Confettis et grosse caisse.' } });
  check('un thème se crée depuis l’administration', r.json.id === 'carnaval');
  check('et la réponse dit où déposer ses images',
    (r.json.dossier ?? '').includes('e1/carnaval'));

  r = await call('/api/admin/tenues');
  check('le cache est rechargé aussitôt',
    (r.json.tenues ?? []).some((t) => t.id === 'carnaval'));

  r = await call('/api/admin/tenues', { method: 'POST',
    body: { id: 'carnaval', nom: 'Encore', rar: 'rare' } });
  check('un identifiant déjà pris est refusé', r.json.error === 'admin.error.tenue_existe');

  // L’identifiant devient un nom de dossier : le disque ne pardonne pas.
  r = await call('/api/admin/tenues', { method: 'POST',
    body: { id: 'Été 2026', nom: 'Été', rar: 'rare' } });
  check('un identifiant avec accent ou espace est refusé',
    r.json.error === 'admin.error.tenue_id');

  r = await call('/api/admin/tenues/carnaval', { method: 'PATCH', body: { publie: false } });
  check('un thème se dépublie', r.json.publie === false);
  r = await call('/api/admin/tenues');
  check('et il reste au catalogue, pour ceux qui l’ont',
    (r.json.tenues ?? []).some((t) => t.id === 'carnaval'));

  r = await call('/api/admin/tenues/inconnue', { method: 'PATCH', body: { nom: 'x' } });
  check('une tenue inconnue est refusée', r.json.error === 'admin.error.tenue_inconnue');

  // La suite doit pouvoir être rejouée : on efface le thème d’essai en base,
  // directement — c’est un test, pas un usage.
  await pool.query(`DELETE FROM tenues WHERE id = 'carnaval'`);
}

/* ------------------------------ accorder un abonnement depuis l'administration

 * C'est ce qui permet d'ouvrir la bêta et d'éprouver les deux côtés du jeu
 * **sans attendre le prestataire de paiement** — et ce sera le geste de service
 * après-vente du jour où il sera branché : un remboursement, un mois offert.
 *
 * Comme toute écriture d'administration, il passe par `admin_audit`. Un accès
 * offert sans trace est un accès dont plus personne ne sait d'où il vient.
 */
{
  const cible = (await pool.query(
    "SELECT public_id FROM users WHERE pseudo = 'Joueur'"))[0][0]?.public_id;
  check('un joueur existe pour ce contrôle', Boolean(cible));

  r = await call(`/api/admin/joueur/${cible}/abonnement`,
    { method: 'POST', body: { formule: 'offert', jours: null } });
  check('l’administration accorde un abonnement', r.json.abonnement?.abonne === true
    || (console.log('        rendu :', JSON.stringify(r.json).slice(0, 140)), false));
  /* Sans terme : c'est ce qu'on pose pour un bêta-testeur. Rien ne l'expire, et
     c'est voulu — un accès offert qui s'éteint sans prévenir se lit comme une
     panne. */
  check('et il est sans terme', r.json.abonnement?.fin === null);

  /* La liste des joueurs le dit, avec son échéance : « abonné jusqu'au 12
     mars » se lit, « abonné : oui » demande une seconde question. */
  r = await call('/api/admin/joueurs?q=Joueur');
  const vu = r.json.joueurs?.find((j) => j.public_id === cible);
  check('la liste des joueurs montre qui est abonné', vu?.abonne === true
    || (console.log('        vu :', JSON.stringify(vu).slice(0, 160)), false));
  check('et sous quelle formule', vu?.abo_formule === 'offert');

  /* Tracé, comme toute écriture d'administration. */
  r = await call('/api/admin/journal');
  const trace = (r.json.journal ?? []).find((x) => x.action === 'abonnement.accorder');
  check('l’accord est journalisé', Boolean(trace)
    || (console.log('        actions :',
      (r.json.journal ?? []).map((x) => x.action).join(', ')), false));
  check('et le journal nomme la cible', trace?.cible === cible);

  /* Une durée bornée, pour le cas d'un mois offert. */
  r = await call(`/api/admin/joueur/${cible}/abonnement`,
    { method: 'POST', body: { formule: 'mensuel', jours: 30 } });
  check('une durée bornée s’accorde aussi', r.json.abonnement?.fin !== null
    && r.json.abonnement?.abonne === true);

  /* Et on peut le retirer. */
  r = await call(`/api/admin/joueur/${cible}/abonnement`, { method: 'DELETE' });
  check('l’administration retire un abonnement', r.json.abonnement?.abonne === false);
  r = await call('/api/admin/journal');
  check('le retrait est journalisé aussi',
    (r.json.journal ?? []).some((x) => x.action === 'abonnement.retirer'));

  /* Un joueur qui n'existe pas se dit, plutôt que de rendre un abonnement
     accordé à personne. */
  r = await call('/api/admin/joueur/inconnu-0000/abonnement',
    { method: 'POST', body: { formule: 'offert' } });
  check('un joueur inconnu est refusé', r.json.error === 'admin.error.joueur_inconnu'
    || (console.log('        rendu :', JSON.stringify(r.json).slice(0, 120)), false));
}

/* ======================================================= les contenus du jeu

   Vingt-neuf cartes d'action, dix-sept pièces d'équipement, dix stades. Ils
   avaient un module capable de les publier et **aucune route pour l'atteindre**
   : on ne pouvait les ouvrir qu'en les cochant dans une saison, jamais les
   refermer. Ces contrôles tiennent la porte ouverte.

   Le refus d'un identifiant inconnu compte autant que la réussite : le code
   porte la forme, la base porte l'état, et un état sans forme est une ligne que
   plus aucun écran ne sait afficher. */
console.log('\n— les contenus —');
{
  const lire = async () => (await call('/api/admin/contenus')).json;
  const basculer = (famille, ids, publie) =>
    call('/api/admin/contenus/publier', { body: { famille, ids, publie } });

  const d = await lire();
  check('les contenus se listent', d.disponible === true
    || (console.log('        il rend :', JSON.stringify(d).slice(0, 140)), false));
  check('les trois familles sont là',
    ['action', 'stuff', 'stade'].every((f) => Array.isArray(d.familles?.[f]?.liste))
    || (console.log('        familles :', Object.keys(d.familles ?? {}).join(' ')), false));
  check('et chaque famille porte son nom en français',
    Object.values(d.familles).every((f) => typeof f.nom === 'string' && f.nom.length > 3));

  const cible = d.familles.stade.liste[0];
  check('un stade est publié au départ', cible.publie !== false);

  await basculer('stade', [cible.id], false);
  const revu = (await lire()).familles.stade.liste.find((x) => x.id === cible.id);
  check('retirer un stade le sort du jeu', revu.publie === false
    || (console.log('        il dit :', JSON.stringify(revu)), false));

  /* **C'est le geste qui manquait.** Une saison ouvre ; jusqu'ici rien ne
     refermait. */
  await basculer('stade', [cible.id], true);
  check('et le republier le remet',
    (await lire()).familles.stade.liste.find((x) => x.id === cible.id).publie !== false);

  const j = (await call('/api/admin/journal')).json;
  const lignes = j.journal ?? j.lignes ?? [];
  check('les deux gestes sont journalisés',
    lignes.filter((l) => String(l.action).startsWith('contenu.')).length >= 2
    || (console.log('        journal :', JSON.stringify(lignes).slice(0, 160)), false));

  let x = await basculer('licornes', ['x'], true);
  check('une famille inventée est refusée',
    x.json.error === 'admin.error.famille_inconnue'
    || (console.log('        il dit :', x.status, JSON.stringify(x.json)), false));
  x = await basculer('stade', ['pas-un-stade'], true);
  check('un identifiant que le code ne connaît pas est refusé',
    x.json.error === 'admin.error.contenu_inconnu'
    || (console.log('        il dit :', x.status, JSON.stringify(x.json)), false));
  x = await basculer('stade', [], true);
  check('une liste vide ne fait rien, et le dit',
    x.json.error === 'admin.error.nothing_to_do');
}

/* Les stades étaient absents des choix servis à l'écran des saisons : la
   colonne existait, le serveur les acceptait, et le formulaire ne pouvait pas
   les proposer. Un champ réglable qu'aucun écran n'atteint n'existe pas. */
{
  const d = (await call('/api/admin/saisons')).json;
  check('l’écran des saisons reçoit la liste des stades',
    Array.isArray(d.choix?.stades) && d.choix.stades.length > 0
    || (console.log('        choix :', Object.keys(d.choix ?? {}).join(' ')), false));
  check('et chaque stade y porte un nom',
    (d.choix.stades ?? []).every((x) => x.id && x.nom));
}

/* ====================================================== la saison datée

   Une saison finit à la fin d'un **jour de jeu**, celui de la base. Ce qui se
   vérifie ici, c'est que personne n'y fabrique de date : ni l'écran, ni Node,
   ni le pilote. Deux pièges l'ont déjà prouvé ailleurs dans ce dépôt — un jour
   relu en objet `Date` à travers un pool en `timezone: 'Z'` recule d'un jour à
   l'ouest de Greenwich, et `TIMESTAMPDIFF` compte l'heure murale, donc se
   trompe d'une heure les deux dimanches de changement d'heure.

   D'où l'horloge de la base **figée** aux instants qui piègent (le 25 octobre
   2026 à 00:30, le dimanche de 25 heures ; le 28 mars 2027, celui de 23), et
   les mêmes contrôles rejoués sous `TZ=America/Montreal`. Les durées se
   mesurent au chargement des saisons : chaque changement d'heure est donc
   suivi d'une relecture, par une écriture d'administration ou explicitement.

   Rien ici n'écrit de saison de production : ce sont des saisons d'essai,
   effacées à la fin. La fin de la saison 1 et l'ouverture d'une saison 2 sont
   des décisions de Gaël, prises dans l'onglet Saisons. */
console.log('\n— la saison datée —');
{
  const { chargerSaisons, saisonEnCours, saisonProchaine, seriesAnnoncees } =
    await import('../src/server/fanzzy/saisons.js');
  const SH = await import('../src/shared/saison.js');
  const { poserReglages, reglagesVivants } = await import('../src/shared/reglages.js');
  const { chargerSeries } = await import('../src/server/fanzzy/catalogue.js');
  /* `/dex` est la route qui sert la saison en cours à toutes les pages : on la
     monte telle que le serveur la monte, pour vérifier les noms de champ du
     contrat là où les écrans les lisent. */
  const { createFanzzy } = await import('../src/server/fanzzy/index.js');
  app.use('/api/fanzzy', createFanzzy({ pool, requireAuth: (_r, _s, n) => n() }).router);

  const lire = async () => (await call('/api/admin/saisons')).json;
  const dire = (x) => JSON.stringify(x);
  const montre = (l, x) => (console.log(`        ${l} :`, dire(x)?.slice(0, 220)), false);
  /* À la seconde près : la durée est mesurée par la base, puis décomptée par
     Node pendant les quelques millisecondes du contrôle. */
  const aPeuPres = (v, attendu) => Number.isInteger(v) && Math.abs(v - attendu) <= 1000;
  const aLHeure = async (instant) => { await figerHorloge(pool, instant); await chargerSaisons(pool); };
  /* Une modification renvoie tout le contenu, comme l'écran : la route remplace
     les listes absentes par des listes vides. */
  const patch = (s, champs) => call(`/api/admin/saison/${s.id}`, { method: 'PATCH',
    body: { nom: s.nom, numero: s.numero, texte: s.texte, series: s.series, tenues: s.tenues,
      stuff: s.stuff, actions: s.actions, stades: s.stades, ...champs } });
  const ligne = async (id) => (await pool.query(
    `SELECT DATE_FORMAT(fin_le, '%Y-%m-%d') AS fin, DATE_FORMAT(ouvre_le, '%Y-%m-%d') AS ouvre,
            carnet FROM saisons WHERE id = ?`, [id]))[0][0];
  const carnetLu = (v) => (v == null ? null : (typeof v === 'string' ? JSON.parse(v) : v));

  /* ------------------------------------------- le contrôle du contrôle */
  await figerHorloge(pool, '2026-10-25 00:30:00');
  {
    const c1 = await pool.getConnection();
    const c2 = await pool.getConnection();
    try {
      const sql = `SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS n, CONNECTION_ID() AS id`;
      const [[a]] = await c1.query(sql);
      const [[b]] = await c2.query(sql);
      check('contrôle du contrôle : NOW() rend l’instant figé, sur deux connexions du pool',
        (a.n === '2026-10-25 00:30:00' && b.n === a.n && a.id !== b.id) || montre('lu', [a, b]));
    } finally { c1.release(); c2.release(); }
  }

  /* ------------------------------------------------- les règles pures */
  {
    const c = SH.carnetDe(null);
    check('le carnet par défaut est celui de la saison 1 : 10, 40, 100, 180, 260 tampons',
      c.map((p) => p.tampons).join() === '10,40,100,180,260' || montre('carnet', c));
    check('chaque palier a la forme du contrat (n, tampons, nom, gain à quatre clés)',
      c.every((p, i) => p.n === i + 1 && typeof p.nom === 'string'
        && dire(Object.keys(p.gain)) === dire(['echarpes', 'packs', 'xp', 'tampons'])
        && p.gain.xp === 0 && p.gain.tampons === 0));
    check('les gains sont ceux de SERVEUR.md : 100, 150 + 1, 250 + 2, 400 + 3, 600 + 4',
      c.map((p) => `${p.gain.echarpes}+${p.gain.packs}`).join() === '100+0,150+1,250+2,400+3,600+4');
    check('le liseré au palier 2, le tampon au 3, le titre au 5 — et nulle part ailleurs',
      c.map((p) => p.insigne ?? '-').join() === '-,lisere,tampon,-,-'
      && c.map((p) => p.titre ?? '-').join() === '-,-,-,-,Revenu pour de bon');

    const refus = (carnet) => { try { SH.validerCarnet(carnet); return null; } catch (e) { return e.raison ?? e.message; } };
    const P = (o) => ({ tampons: 10, nom: 'Un', echarpes: 10, ...o });
    check('le carnet par défaut passe sa propre validation', refus(SH.CARNET_DEFAUT) === null);
    check('neuf paliers sont refusés',
      /de 1 à 8 paliers/.test(refus(Array.from({ length: 9 }, (_, i) => P({ tampons: i + 1 })))));
    check('2 001 écharpes, onze boosters, un nom de 41 lettres sont refusés',
      /echarpes/.test(refus([P({ echarpes: 2001 })])) && /packs/.test(refus([P({ packs: 11 })]))
      && /nom/.test(refus([P({ nom: 'x'.repeat(41) })])));
    check('une insigne inventée, un titre écrit en texte, un seuil en chaîne sont refusés',
      /insigne/.test(refus([P({ insigne: 'or' })])) && /titre/.test(refus([P({ titre: 'Capo' })]))
      && /tampons/.test(refus([P({ tampons: '10' })])));

    /* Les seuils de division ne sont pas contrôlés entre eux par le registre :
       le module les rend monotones avant de s'en servir. */
    const avant = reglagesVivants();
    poserReglages({ 'rang.habitue': 5000, 'rang.fervent': 1000, 'rang.ultra': 100000, 'rang.capo': 50 });
    const s = SH.seuilsDivisions();
    check('des seuils de division non monotones sont rendus monotones',
      s.map((d) => d.seuil).join() === '1,5000,5000,100000,100000' || montre('seuils', s));
    check('deux seuils égaux se franchissent ensemble, et la suivante est une division qu’on n’a pas',
      SH.divisionPour(5000, s)?.id === 'fervent' && SH.divisionSuivante(5000, s)?.id === 'ultra');
    poserReglages(avant);
    check('pas de division sans ferveur ; Sympathisant dès la première',
      SH.divisionPour(0) === null && SH.divisionPour(1)?.id === 'sympathisant');
    check('Habitué au seuil exact, pas un point avant',
      SH.divisionPour(5000)?.id === 'habitue' && SH.divisionPour(4999)?.id === 'sympathisant');
    check('la division a exactement la forme du contrat, la suivante dit ce qui manque',
      dire(SH.divisionPour(41250)) === dire({ n: 3, id: 'fervent', nom: 'FERVENT' })
      && dire(SH.divisionSuivante(41250))
        === dire({ n: 4, id: 'ultra', nom: 'ULTRA', seuil: 100000, manque: 58750 }));
    check('pas de suivante à Capo ; seul Capo donne un titre',
      SH.divisionSuivante(300000) === null && SH.titreDivision(5, 1) === 'Capo de la saison 1'
      && SH.titreDivision(4, 1) === null);
  }

  /* ------------------------------------------ les refus de l'administration */
  r = await call('/api/admin/saisons', { body: { nom: 'Datée', fin_le: '2026-02-30' } });
  check('un jour impossible (30 février) est refusé, et le refus le nomme',
    (r.status === 400 && r.json.error === 'admin.error.date_invalide'
      && String(r.json.raison).includes('2026-02-30')) || montre('rendu', r.json));
  r = await call('/api/admin/saisons', { body: { nom: 'Datée', fin_le: '20/12/2026' } });
  check('un jour mal formé aussi',
    r.json.error === 'admin.error.date_invalide' && String(r.json.raison).includes('20/12/2026'));
  r = await call('/api/admin/saisons', { body: { nom: 'Datée', ouvre_le: '2026-13-01' } });
  check('et une ouverture annoncée au treizième mois, nommée comme telle',
    r.json.error === 'admin.error.date_invalide' && /Ouverture/.test(r.json.raison));
  r = await call('/api/admin/saisons', { body: { nom: 'Carnetée', carnet: JSON.stringify([
    { tampons: 40, nom: 'Haut', echarpes: 10 }, { tampons: 10, nom: 'Bas', echarpes: 10 }]) } });
  check('un carnet aux seuils décroissants est refusé, palier nommé',
    (r.status === 400 && r.json.error === 'admin.error.carnet_invalide'
      && /palier 2/.test(r.json.raison)) || montre('rendu', r.json));
  r = await call('/api/admin/saisons', { body: { nom: 'Carnetée',
    carnet: JSON.stringify([{ tampons: 10, nom: 'X', echarpe: 300 }]) } });
  check('une clé mal orthographiée est refusée, pas versée à zéro',
    r.json.error === 'admin.error.carnet_invalide' && /echarpe/.test(r.json.raison));
  check('et aucun refus n’a laissé de saison derrière lui',
    !(await lire()).saisons.some((x) => ['Datée', 'Carnetée'].includes(x.nom)));

  /* L'onglet préremplit la zone de texte avec le carnet par défaut : renvoyé tel
     quel, il ne doit pas devenir un « carnet propre » qui ne suivrait plus le
     code. */
  r = await call('/api/admin/saisons', { body: { nom: 'Défaut tapé',
    carnet: JSON.stringify(SH.CARNET_DEFAUT, null, 2) } });
  {
    const t = r.json.saisons?.find((x) => x.nom === 'Défaut tapé');
    check('un carnet identique au défaut s’enregistre comme « défaut »',
      (Boolean(t) && (await ligne(t.id)).carnet === null && !('carnet' in t))
      || montre('rendu', t));
    if (t) await call(`/api/admin/saison/${t.id}`, { method: 'DELETE' });
  }

  /* ---------------------------------------------- les saisons d'essai
     Une saison lancée qui ouvre une série, pour que d'autres soient fermées ;
     un brouillon qui annoncera une série fermée et une ouverte.

     La saison 1 reprise par `sql/saisons.sql` est lancée à l'heure réelle du
     passage de la suite. On la date du 19 septembre 2026, comme en production,
     pour que l'ordre des lancements ne dépende pas du jour où l'on lance la
     suite : lancée un 3 novembre, elle passerait sinon après la saison d'essai
     et deviendrait la saison en cours. Écrit en heure murale, comme `NOW(3)`
     l'aurait écrit ce jour-là. */
  await pool.query(`UPDATE saisons SET lancee_a = '2026-09-19 10:00:00'
                     WHERE numero = 1 AND lancee_a IS NOT NULL`);
  await chargerSaisons(pool);
  const autre = publies().find((f) => f.stage === 1 && f.set !== uneSerie)?.set;
  check('une seconde série tirable existe pour l’annonce', Boolean(autre));
  r = await call('/api/admin/saisons', { body: { nom: 'Essai daté', numero: 90,
    series: [uneSerie], fin_le: '2026-10-25' } });
  const datee = r.json.saisons?.find((x) => x.nom === 'Essai daté');
  check('une saison se crée avec son dernier jour, rendu tel quel',
    (datee?.fin === '2026-10-25' && (await ligne(datee.id)).fin === '2026-10-25')
    || montre('rendu', r.json));
  r = await call(`/api/admin/saison/${datee.id}/lancer`, { body: { lancer: true } });
  check('et se lance le jour même de sa fin', r.status === 200 || montre('rendu', r.json));
  r = await call('/api/admin/saisons', { body: { nom: 'Saison annoncée', numero: 91,
    series: [uneSerie, autre], ouvre_le: '2027-04-02' } });
  const annoncee = r.json.saisons?.find((x) => x.nom === 'Saison annoncée');
  check('un brouillon se crée avec son jour d’ouverture', annoncee?.ouvre === '2027-04-02'
    || montre('rendu', r.json));

  /* ------------------------------------------- la fin, mesurée par la base */
  async function eprouverLesDates(ou) {
    const ici = (l) => `${l} [${ou}]`;

    await figerHorloge(pool, '2026-10-25 00:30:00');
    r = await patch(datee, { fin_le: '2026-10-25' });
    let s = saisonEnCours();
    check(ici('le dimanche de 25 h à 00:30, fin le jour même : finDansMs = 88 200 000'),
      (s?.id === datee.id && aPeuPres(s.finDansMs, 88_200_000)) || montre('saison', s));
    check(ici('le dernier jour : 1 jour restant, pas finie'),
      s?.joursRestants === 1 && s?.finie === false);
    check(ici('le dernier jour part en texte, tel qu’il a été saisi'), s?.fin === '2026-10-25'
      || montre('fin', s?.fin));
    const dex = await (await fetch(base + '/api/fanzzy/dex')).json();
    check(ici('/dex sert fin, finDansMs, joursRestants et finie sur la saison en cours'),
      (dex.saison?.fin === '2026-10-25' && aPeuPres(dex.saison.finDansMs, 88_200_000)
        && dex.saison.joursRestants === 1 && dex.saison.finie === false)
      || montre('saison', dex.saison));

    await aLHeure('2026-10-26 00:30:00');
    s = saisonEnCours();
    check(ici('le lendemain : finie, 0 jour, 0 ms, et toujours la saison en cours'),
      (s?.id === datee.id && s.finie === true && s.joursRestants === 0 && s.finDansMs === 0
        && s.fin === '2026-10-25') || montre('saison', s));

    await figerHorloge(pool, '2026-11-01 12:00:00');
    await patch(datee, { fin_le: '2026-12-20' });
    s = saisonEnCours();
    check(ici('le 1er novembre à midi, fin le 20 décembre : 50 jours, 49 jours et demi'),
      (s?.joursRestants === 50 && aPeuPres(s.finDansMs, 49.5 * 86_400_000) && s.finie === false)
      || montre('saison', s));

    await figerHorloge(pool, '2027-03-28 00:30:00');
    await patch(datee, { fin_le: '2027-03-28' });
    s = saisonEnCours();
    check(ici('le dimanche de 23 h à 00:30, fin le jour même : finDansMs = 81 000 000'),
      (aPeuPres(s?.finDansMs, 81_000_000) && s.joursRestants === 1) || montre('saison', s));

    await patch(datee, { fin_le: '' });
    s = saisonEnCours();
    check(ici('une fin effacée : ni fin, ni finDansMs, ni joursRestants, et pas finie'),
      (Boolean(s) && !('fin' in s) && !('finDansMs' in s) && !('joursRestants' in s)
        && s.finie === false && (await ligne(datee.id)).fin === null) || montre('saison', s));
    await patch(datee, { fin_le: '2027-03-28' });

    /* L'annonce : présente jusqu'à la fin du jour annoncé, absente le lendemain. */
    await figerHorloge(pool, '2027-03-30 12:00:00');
    await patch(annoncee, { ouvre_le: '2027-04-02' });
    let p = saisonProchaine();
    check(ici('annoncée pour le 2 avril, le 30 mars à midi : 3 jours, 60 heures'),
      (p?.id === annoncee.id && p.numero === 91 && p.nom === 'Saison annoncée'
        && p.ouvre === '2027-04-02' && p.joursAvant === 3
        && aPeuPres(p.ouvreDansMs, 60 * 3_600_000)) || montre('prochaine', p));
    check(ici('elle a exactement les champs du contrat'),
      dire(Object.keys(p ?? {}).sort())
        === dire(['id', 'joursAvant', 'nom', 'numero', 'ouvre', 'ouvreDansMs']));
    check(ici('seules ses séries encore fermées porteront « prochaine »'),
      dire(seriesAnnoncees()) === dire({ [autre]: 91 }) || montre('séries', seriesAnnoncees()));
    check(ici('l’onglet Saisons montre ce qui est annoncé'),
      (await lire()).prochaine?.id === annoncee.id);

    await aLHeure('2027-04-02 23:59:00');
    p = saisonProchaine();
    check(ici('le jour annoncé, jusqu’à sa dernière minute : 0 jour, 0 ms (AUJOURD’HUI)'),
      (p?.id === annoncee.id && p.joursAvant === 0 && p.ouvreDansMs === 0) || montre('prochaine', p));

    await aLHeure('2027-04-03 00:00:30');
    check(ici('le lendemain, une annonce restée en brouillon disparaît'),
      (saisonProchaine() === null && dire(seriesAnnoncees()) === '{}')
      || montre('prochaine', saisonProchaine()));
  }

  await eprouverLesDates(Intl.DateTimeFormat().resolvedOptions().timeZone);
  /* Le même passage à l'ouest de Greenwich : un jour relu par le pilote en
     objet `Date` y reculerait d'un jour, et seul ce passage le voit. */
  {
    const tz = process.env.TZ;
    process.env.TZ = 'America/Montreal';
    try {
      await eprouverLesDates('TZ=America/Montreal');
    } finally {
      if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz;
    }
  }

  /* ------------------------------------------- la fenêtre d'une saison
     Une seule borne, écrite en SQL, que le classement, les divisions, la
     saison passée et les missions lisent tous. */
  await aLHeure('2027-04-03 12:00:00');
  {
    const premiere = (await lire()).saisons.find((x) => x.numero === 1 && x.lancee);
    const fenetre = async (id) => (await pool.query(
      `SELECT DATE_FORMAT(${SH.finDeFenetre('s')}, '%Y-%m-%d %H:%i:%s') AS fin
         FROM saisons s WHERE s.id = ?`, [id]))[0][0]?.fin;
    const dedans = async (id, quand) => Number((await pool.query(
      `SELECT ${SH.dansLaFenetre('x.quand', 's')} AS d
         FROM saisons s JOIN (SELECT TIMESTAMP(?) AS quand) x WHERE s.id = ?`,
      [quand, id]))[0][0]?.d) === 1;

    check('la saison 1 reprise est là, lancée, sans date de fin',
      Boolean(premiere) && !premiere.fin);
    let f = await fenetre(premiere.id);
    check('une saison sans fin s’arrête au lancement de la suivante',
      f === '2026-10-25 00:30:00' || montre('fin de fenêtre', f));
    f = await fenetre(datee.id);
    check('la dernière lancée court jusqu’à la fin de son dernier jour',
      f === '2027-03-29 00:00:00' || montre('fin de fenêtre', f));

    r = await patch(premiere, { fin_le: '2026-10-10' });
    f = await fenetre(premiere.id);
    check('une fin saisie avant le lancement suivant l’emporte',
      (r.status === 200 && f === '2026-10-11 00:00:00') || montre('fin de fenêtre', [r.json.error, f]));
    check('le dernier jour compte jusqu’à sa dernière seconde, le lendemain non',
      await dedans(premiere.id, '2026-10-10 23:59:59')
      && !(await dedans(premiere.id, '2026-10-11 00:00:00')));
    check('et rien ne compte avant le lancement',
      !(await dedans(premiere.id, '2026-01-01 00:00:00')));

    r = await patch(datee, { fin_le: '2026-10-24' });
    check('une fin avant le jour du lancement est refusée, en le disant',
      (r.json.error === 'admin.error.fin_avant_lancement' && /2026-10-24/.test(r.json.raison))
      || montre('rendu', r.json));
    r = await call('/api/admin/saisons', { body: { nom: 'Close d’avance', fin_le: '2027-01-01' } });
    const close = r.json.saisons?.find((x) => x.nom === 'Close d’avance');
    r = await call(`/api/admin/saison/${close?.id}/lancer`, { body: { lancer: true } });
    check('une saison dont le dernier jour est passé ne se lance pas',
      r.json.error === 'admin.error.fin_passee' || montre('rendu', r.json));
    if (close) await call(`/api/admin/saison/${close.id}`, { method: 'DELETE' });
  }

  /* ------------------------------------ le carnet se fige au premier palier */
  {
    const A = [{ tampons: 5, nom: 'Premier', echarpes: 50 },
      { tampons: 20, nom: 'Second', echarpes: 80, packs: 1, insigne: 'lisere' }];
    const Bc = [{ tampons: 8, nom: 'Premier', echarpes: 50 },
      { tampons: 30, nom: 'Second', echarpes: 80, packs: 1, titre: true }];
    /* La base garde la forme normalisée : `packs: 0` écrit, clés dans l'ordre. */
    const nA = SH.validerCarnet(A);
    const nB = SH.validerCarnet(Bc);

    r = await patch(datee, { carnet: JSON.stringify(A) });
    check('avant tout palier versé, un carnet propre s’enregistre, normalisé',
      (r.status === 200 && dire(carnetLu((await ligne(datee.id)).carnet)) === dire(nA))
      || montre('rendu', [r.json.error, (await ligne(datee.id)).carnet]));
    check('et la saison en cours le porte, pour carnetDe',
      dire(SH.carnetDe(saisonEnCours()).map((p) => p.tampons)) === '[5,20]');
    r = await patch(datee, { carnet: JSON.stringify(Bc) });
    check('il se modifie encore tant que rien n’est versé',
      r.status === 200 && dire(carnetLu((await ligne(datee.id)).carnet)) === dire(nB));

    /* Un palier versé, inscrit comme le grand livre l'inscrit. */
    await pool.query(
      `INSERT INTO recompenses (user_id, source, cle, saison_id, echarpes, packs, xp, tampons)
       VALUES (?, 'carnet', ?, ?, 50, 0, 0, 0)`, [B, `S${datee.id}:1`, datee.id]);

    r = await patch(datee, { carnet: JSON.stringify(A) });
    check('après un palier versé, un carnet changé est refusé, et le refus dit pourquoi',
      (r.status === 409 && r.json.error === 'admin.error.carnet_fige' && /figé/.test(r.json.raison))
      || montre('rendu', [r.status, r.json]));
    check('et la base garde le carnet promis',
      dire(carnetLu((await ligne(datee.id)).carnet)) === dire(nB));
    r = await patch(datee, { carnet: '' });
    check('revenir au carnet par défaut est aussi un changement',
      r.json.error === 'admin.error.carnet_fige');
    r = await patch(datee, { carnet: JSON.stringify(Bc, null, 2), fin_le: '2027-04-30' });
    check('le même carnet renvoyé ne bloque pas une autre modification',
      (r.status === 200 && (await ligne(datee.id)).fin === '2027-04-30') || montre('rendu', r.json));
    check('l’onglet sait quels carnets sont figés',
      (await lire()).carnetsFiges?.includes(datee.id));

    const j = (await call('/api/admin/journal')).json.journal ?? [];
    const modifs = j.filter((l) => l.action === 'saison.modifiee' && l.cible === String(datee.id));
    const detail = (l) => (typeof l.detail === 'string' ? JSON.parse(l.detail) : l.detail) ?? {};
    check('le journal inscrit le jour de fin et le carnet saisis',
      modifs.some((l) => detail(l).fin_le === '2027-04-30')
      && modifs.some((l) => dire(detail(l).carnet) === dire(nB)));
  }

  /* ------------------------------------------- une base sans les colonnes
     Le code part avant le schéma, parfois : le jeu doit tourner comme avant. */
  {
    await pool.query('ALTER TABLE saisons DROP COLUMN fin_le, DROP COLUMN ouvre_le, DROP COLUMN carnet');
    await chargerSaisons(pool);
    const s = saisonEnCours();
    check('sans sql/quotidien.sql, la saison est servie sans date et rien n’est annoncé',
      (Boolean(s) && !('fin' in s) && !('carnet' in s) && s.finie === false
        && saisonProchaine() === null) || montre('saison', s));
    r = await call('/api/admin/saisons', { body: { nom: 'Sans date' } });
    check('une saison sans date se crée comme avant',
      r.status === 200 && r.json.saisons?.some((x) => x.nom === 'Sans date'));
    r = await call('/api/admin/saisons', { body: { nom: 'Avec date', fin_le: '2027-05-01' } });
    check('une saison avec une date est refusée en nommant le fichier à appliquer',
      (r.status === 503 && r.json.error === 'admin.error.saison_colonnes'
        && /quotidien\.sql/.test(r.json.raison)) || montre('rendu', [r.status, r.json]));
    const raw2 = await mysql.createConnection({ uri: DB, multipleStatements: true });
    await raw2.query(readFileSync(new URL('../sql/quotidien.sql', import.meta.url), 'utf8'));
    await raw2.end();
    await chargerSaisons(pool);
    check('le fichier rejoué rend les colonnes', (await ligne(datee.id))?.fin === null);
  }

  /* ------------------ deux lectures croisées, et la relecture de minuit

     Sur un faux pool dont on règle l'ordre des réponses : la course est
     certaine, pas probable. Les colonnes calculées arrivent en chaînes, comme
     un DECIMAL du pilote. */
  {
    const dodo = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const fausse = (o) => ({ id: 900, numero: 9, nom: 'Fausse', texte: null, series: '[]',
      tenues: '[]', stuff: '[]', actions: '[]', stades: '[]',
      lancee_a: new Date(Date.UTC(2026, 9, 1)), carnet: null,
      fin_jour: null, fin_jours: null, fin_ms: null, ouvre_jour: null, ouvre_jours: null,
      ouvre_ms: null, ouvre_fin_ms: null, minuit_ms: '3600000', ...o });
    const faux = (suite, ms) => ({ appels: 0, execute() {
      const rows = suite[Math.min(this.appels++, suite.length - 1)];
      return new Promise((ok) => setTimeout(() => ok([[rows]]), ms));
    } });

    /* L'administration écrit et relit pendant qu'une relecture partie avant
       l'écriture est encore en route ; celle-ci revient la dernière. */
    const lente = faux([fausse({ nom: 'Ancienne' })], 120);
    const rapide = faux([fausse({ nom: 'Nouvelle' })], 10);
    await Promise.all([chargerSaisons(lente), chargerSaisons(rapide)]);
    check('une relecture partie avant une écriture et revenue après ne remet pas l’ancienne liste',
      saisonEnCours()?.nom === 'Nouvelle' || montre('en cours', saisonEnCours()?.nom));

    /* Le minuit de la base tombe 40 ms après la lecture : le dernier jour de
       la saison s'achève, et la table doit être relue une fois, en
       arrière-plan, sans qu'aucun appel n'attende. */
    const minuit = faux([
      fausse({ nom: 'Avant minuit', fin_jour: '2026-10-25', fin_jours: '0', fin_ms: '40',
        minuit_ms: '40' }),
      fausse({ nom: 'Après minuit', fin_jour: '2026-10-25', fin_jours: '-1', fin_ms: '-30',
        minuit_ms: '86399970' }),
    ], 5);
    await chargerSaisons(minuit);
    let s = saisonEnCours();
    check('avant le minuit de la base : le dernier jour, pas finie',
      (s?.nom === 'Avant minuit' && s.joursRestants === 1 && s.finie === false) || montre('saison', s));
    await dodo(90);
    const vues = Array.from({ length: 5 }, () => saisonEnCours());
    check('passé ce minuit, la saison se dit finie tout de suite, sans attendre la relecture',
      vues.every((v) => v.finie === true && v.joursRestants === 0 && v.finDansMs === 0)
      || montre('vues', vues.map((v) => [v.nom, v.finie, v.joursRestants])));
    await dodo(60);
    s = saisonEnCours();
    check('et la table est relue une seule fois, pas une fois par appel',
      (minuit.appels === 2 && s?.nom === 'Après minuit' && s.finie === true)
      || montre('relue', [minuit.appels, s?.nom]));
    await chargerSaisons(pool);
  }

  /* Le ménage : l'horloge repart, les saisons d'essai s'effacent. */
  await figerHorloge(pool, null);
  await pool.query(`DELETE FROM saisons WHERE nom IN ('Essai daté', 'Saison annoncée', 'Sans date')`);
  await pool.query(`UPDATE saisons SET fin_le = NULL WHERE numero = 1`);
  await chargerSaisons(pool);
  await chargerSeries(pool);
}

/* ------------------------------------------ recaler les seuils de division

   L'annexe A d'`ECONOMIE.md`, servie par l'administration : la règle pure
   d'abord, sur des nombres posés à la main, puis la lecture de la base. */
{
  const SH = await import('../src/shared/saison.js');
  const { poserReglages, reglagesVivants } = await import('../src/shared/reglages.js');
  const dire = (x) => JSON.stringify(x);
  const montre = (l, x) => (console.log(`        ${l} :`, dire(x)?.slice(0, 260)), false);

  /* Cent joueurs, de 100 à 10 000, en vingt jours sur cent vingt. */
  const cent = Array.from({ length: 100 }, (_, i) => ({ ferveur: (i + 1) * 100, jours: 10 }));
  let p = SH.proposerSeuils({ joueurs: cent, joursEcoules: 20, joursTotaux: 120 });
  check('les rangs 30, 60, 85 et 96 % sont lus sur la liste rangée',
    dire(p.lus) === dire({ habitue: 3000, fervent: 6000, ultra: 8500, capo: 9600 }) || montre('lus', p));
  check('projetés sur la saison (× 6) et arrondis à deux chiffres',
    dire(p.seuils) === dire({ 'rang.habitue': 18000, 'rang.fervent': 36000,
      'rang.ultra': 51000, 'rang.capo': 58000 }) || montre('seuils', p.seuils));
  check('assez de joueurs et de jours : aucun avertissement, Capo sous le plafond',
    (p.avertissements.length === 0 && p.plafond === 100000) || montre('rendu', p));

  /* Les plus appliqués ne font que 300 par jour : rien au-delà de 36 000. */
  const bas = cent.map((j) => ({ ...j, jours: 30 }));
  bas[99] = { ferveur: 300 * 15, jours: 15 };
  p = SH.proposerSeuils({ joueurs: bas, joursEcoules: 20, joursTotaux: 120 });
  check('Capo ne dépasse jamais ce qu’un gratuit assidu fait dans la saison',
    (p.seuils['rang.capo'] <= p.plafond && p.avertissements.includes('capo_borne'))
    || montre('rendu', p));
  check('ni aucune autre division, et les seuils restent rangés',
    (Object.values(p.seuils).every((x) => x <= p.plafond)
      && p.seuils['rang.capo'] >= p.seuils['rang.ultra']) || montre('seuils', p.seuils));

  p = SH.proposerSeuils({ joueurs: cent.slice(0, 5), joursEcoules: 3, joursTotaux: 120 });
  check('cinq joueurs en trois jours : une proposition, dite fragile deux fois',
    (p.seuils && p.avertissements.includes('peu_de_joueurs')
      && p.avertissements.includes('trop_tot')) || montre('rendu', p));
  p = SH.proposerSeuils({ joueurs: cent, joursEcoules: 20, joursTotaux: null });
  check('sans dernier jour saisi, rien ne se projette',
    (p.seuils === null && p.avertissements.includes('sans_fin')) || montre('rendu', p));
  p = SH.proposerSeuils({ joueurs: [{ ferveur: 0, jours: 1 }], joursEcoules: 20, joursTotaux: 120 });
  check('les joueurs à zéro ne comptent pas',
    (p.seuils === null && p.joueurs === 0 && p.avertissements.includes('aucun_joueur'))
    || montre('rendu', p));
  p = SH.proposerSeuils({ joueurs: cent, joursEcoules: 0.2, joursTotaux: 120 });
  check('le premier soir se projette comme un jour, pas sur six cents fois sa durée',
    p.facteur === 120 || montre('facteur', p.facteur));

  /* La base. `duel_results` n'est pas posée par cette suite jusqu'ici. */
  const brut = await mysql.createConnection({ uri: DB, multipleStatements: true });
  for (const f of ['duel.sql', 'historique.sql']) {
    await brut.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
  }
  await brut.end();
  const avant = reglagesVivants();
  await pool.query(`UPDATE saisons SET lancee_a = NULL WHERE numero <> 1`);
  await pool.query(`UPDATE saisons SET lancee_a = CURDATE() - INTERVAL 20 DAY,
                      fin_le = NULL WHERE numero = 1`);

  r = await call('/api/admin/divisions/recalage');
  check('sans dernier jour de jeu, la lecture le dit et ne propose rien',
    (r.status === 200 && r.json.seuils === null && r.json.avertissements.includes('sans_fin')
      && r.json.saison?.numero === 1 && r.json.joueurs === null) || montre('rendu', r.json));
  r = await call('/api/admin/divisions/recalage', { body: {} });
  check('et poser est refusé, avec sa raison',
    (r.status === 409 && r.json.error === 'admin.error.recalage_impossible') || montre('rendu', r.json));

  await pool.query(`UPDATE saisons SET fin_le = CURDATE() + INTERVAL 99 DAY WHERE numero = 1`);
  /* Quarante joueurs sans abonnement, de 100 à 4 000 au Virage compté. */
  const R = (i) => `rrrr0000-0000-0000-0000-${String(i).padStart(12, '0')}`;
  for (let i = 0; i < 42; i++) {
    await pool.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
      [R(i), `r${i}@ex.fr`, `R${i}`]);
  }
  for (let i = 0; i < 40; i++) {
    await pool.query(`INSERT INTO virage_presence (user_id, fixture_id, side, ferveur, classe,
        last_push_at, joined_at) VALUES (?, ?, 0, ?, 1, NOW(3) - INTERVAL ? DAY, NOW(3) - INTERVAL ? DAY)`,
      [R(i), 7000 + i, (i + 1) * 100, i % 5, i % 5]);
  }
  /* Le quarantième a aussi trois duels classés, trois autres jours. */
  for (const j of [6, 7, 8]) {
    await pool.query(`INSERT INTO duel_results (duel_id, user_id, opponent_id, outcome, ferveur,
        mode, ended_at) VALUES (UUID(), ?, 'x', 'win', 100, 'classe', NOW(3) - INTERVAL ? DAY)`, [R(39), j]);
  }
  /* Ce qui ne compte pas : l'entraînement, le Virage hors classement, la
     ferveur d'avant la saison, et l'abonné (le 41ᵉ). Un abonnement échu ne
     retire personne : le premier joueur en a eu un. */
  await pool.query(`INSERT INTO duel_results (duel_id, user_id, opponent_id, outcome, ferveur, mode)
      VALUES (UUID(), ?, 'x', 'win', 1000000, 'entrainement')`, [R(0)]);
  await pool.query(`INSERT INTO virage_presence (user_id, fixture_id, side, ferveur, classe)
      VALUES (?, 7100, 0, 1000000, 0)`, [R(1)]);
  await pool.query(`INSERT INTO virage_presence (user_id, fixture_id, side, ferveur, classe,
      last_push_at, joined_at) VALUES (?, 7101, 0, 1000000, 1, CURDATE() - INTERVAL 30 DAY,
      CURDATE() - INTERVAL 30 DAY)`, [R(2)]);
  await pool.query(`INSERT INTO virage_presence (user_id, fixture_id, side, ferveur, classe)
      VALUES (?, 7102, 0, 9000000, 1)`, [R(40)]);
  await pool.query(`INSERT INTO abonnements (user_id, formule, fin) VALUES (?, 'offert', NULL),
      (?, 'mensuel', NOW(3) - INTERVAL 1 DAY)`, [R(40), R(0)]);

  r = await call('/api/admin/divisions/recalage');
  const g = r.json;
  check('quarante joueurs sans abonnement : l’abonné, l’entraînement et le hors-saison restent dehors',
    (g.joueurs === 40 && g.lus?.capo === 3900 && g.lus?.habitue === 1200) || montre('rendu', g));
  check('la saison compte ses cent vingt jours, dont un peu plus de vingt écoulés',
    (g.joursTotaux === 120 && g.joursEcoules > 20 && g.joursEcoules < 21) || montre('jours', g));
  check('le plafond suit le seul gratuit qui a joué trois jours (1 075 par jour)',
    g.plafond === 120000 || montre('plafond', g.plafond));
  check('quatre seuils proposés et rangés ; 40 joueurs en 20 jours : rien de fragile',
    (g.seuils && g.seuils['rang.habitue'] < g.seuils['rang.fervent']
      && g.seuils['rang.fervent'] < g.seuils['rang.ultra']
      && g.seuils['rang.ultra'] < g.seuils['rang.capo'] && g.avertissements.length === 0)
    || montre('rendu', g));
  check('les seuils actuels sont rendus à côté',
    g.actuels?.['rang.capo'] === SH.seuilsDivisions()[4].seuil || montre('actuels', g.actuels));

  r = await call('/api/admin/divisions/recalage', { body: {} });
  const v = reglagesVivants();
  check('poser écrit les quatre réglages proposés',
    (r.status === 200 && ['rang.habitue', 'rang.fervent', 'rang.ultra', 'rang.capo']
      .every((cle) => v[cle] === g.seuils[cle])) || montre('posé', [r.json, v]));
  r = await call('/api/admin/journal?limite=1000');
  check('et chacun au journal, sous le nom de l’administrateur',
    ['rang.habitue', 'rang.fervent', 'rang.ultra', 'rang.capo'].every((cle) =>
      r.json.journal.some((l) => l.action === 'reglage.modifie' && l.cible === cle))
    || montre('journal', r.json.journal.map((l) => [l.action, l.cible])));

  poserReglages(avant);
  await pool.query(`DELETE FROM reglages WHERE cle LIKE 'rang.%'`);
  await pool.query(`UPDATE saisons SET fin_le = NULL WHERE numero = 1`);
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end();

await new Promise((r) => http.close(r));
// Pas de process.exit : il coupe la boucle pendant que le pool rend ses
// sockets, et libuv s’arrête au hasard sur UV_HANDLE_CLOSING.
process.exitCode = failures ? 1 : 0;
