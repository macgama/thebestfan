/** Test des classements. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createClassements } from '../src/server/classements/index.js';
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
for (const f of ['auth.sql','football.sql', 'minutes.sql', 'couleurs.sql','duel.sql','souvenirs.sql', 'billets.sql','fanzzy.sql','inventaire.sql', 'skins.sql', 'etats.sql', 'kop.sql', 'historique.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
await raw.query(`INSERT INTO teams (id,name,country) VALUES
  (85,'Petit Club','Suisse'),(91,'Gros Club','France')`);

// Petit Club : 2 supporters très actifs. Gros Club : 4 supporters mous.
const gens = [
  ['u1','Momo',85,900],['u2','Sarah',85,700],
  ['u3','Kevin',91,300],['u4','Lila',91,120],['u5','Theo',91,60],['u6','Ines',91,20],
];
for (const [id,pseudo,club,ferveur] of gens) {
  const pid = `${id}0000-0000-0000-0000-00000000000${id.slice(1)}`.slice(0,36);
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [pid,`${id}@ex.fr`,pseudo]);
  await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,?,1)`,[pid,club]);
  await raw.query(`INSERT INTO virage_presence (user_id,fixture_id,side,ferveur) VALUES (?,?,0,?)`,
    [pid, 7001, ferveur]);
  await raw.query(`INSERT INTO duel_results (duel_id,user_id,opponent_id,outcome)
    VALUES (?,?,?,?),(?,?,?,?),(?,?,?,?)`,
    [`d1-${id}`,pid,'x','win', `d2-${id}`,pid,'x', ferveur>200?'win':'loss', `d3-${id}`,pid,'x','loss']);
}
/* ------------------------------------------- deux compétitions, et des KOP

   Les classements par compétition lisent la ferveur à travers `fixtures` :
   sans match, il n'y a pas de compétition, et sans deuxième compétition on ne
   verrait pas que le filtre filtre.

   **Rien n'est ajouté, tout est complété.** Une présence ou un duel de plus
   déplacerait les moyennes et les comptes de victoires que les contrôles plus
   haut éprouvent — et un banc dont les nombres bougent quand on ajoute un
   sujet n'éprouve plus le premier. */

await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
  VALUES (7001,61,2026,85,91,'FT',NOW()),
         (7002,207,2026,85,91,'FT',NOW())`);

// Le club soutenu, sur les présences déjà écrites : c'est lui, et non les
// clubs suivis, qui décide de ce qui remonte à une tribune ou à un KOP.
await raw.query(`UPDATE virage_presence vp
   JOIN user_follows uf ON uf.user_id = vp.user_id
    SET vp.team_id = uf.team_id, vp.side = IF(uf.team_id = 85, 0, 1)`);

// La ferveur du duel, posée sur des duels qui existent déjà.
await raw.query(`UPDATE duel_results dr
   JOIN user_follows uf ON uf.user_id = dr.user_id
    SET dr.fixture_id = 7001, dr.team_id = uf.team_id, dr.ferveur = 100
  WHERE dr.duel_id LIKE 'd1-%'`);

/* Une ferveur énorme dans une **autre** compétition, glissée sur un duel qui
   existait déjà. Si elle remonte dans le classement de la Ligue 1, c'est que
   la jointure ne filtre rien. */
await raw.query(`UPDATE duel_results
    SET fixture_id = 7002, team_id = 85, ferveur = 5000
  WHERE duel_id = 'd2-u1'`);

/* Deux KOP, un par club. Celui du Petit Club a deux membres très actifs,
   celui du Gros Club deux membres plus mous : la division par le nombre doit
   remettre le petit devant, comme pour les tribunes. */
const KOPS = [['k1', 85, 'Les Fidèles', ['u1', 'u2']],
              ['k2', 91, 'La Tribune Nord', ['u3', 'u4']]];
for (const [kid, club, nom, membres] of KOPS) {
  const id = `${kid}000000-0000-0000-0000-0000000000`.slice(0, 36);
  const chef = `${membres[0]}0000-0000-0000-0000-00000000000${membres[0].slice(1)}`.slice(0, 36);
  await raw.query(`INSERT INTO kops (id,team_id,nom,createur) VALUES (?,?,?,?)`,
    [id, club, nom, chef]);
  for (const m of membres) {
    const pid = `${m}0000-0000-0000-0000-00000000000${m.slice(1)}`.slice(0, 36);
    await raw.query(`INSERT INTO kop_membres (kop_id,user_id,team_id) VALUES (?,?,?)`,
      [id, pid, club]);
  }
}

await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
let moi = 'u10000-0000-0000-0000-000000000001'.slice(0,36);
const C = createClassements({ pool, requireAuth: (r,_s,n)=>{ r.user={id:moi}; n(); } });
const app = express();
/* `attachUser` pose `req.user` sur chaque requête en production ; le banc
   fait pareil, sans quoi la place du lecteur dans un classement de
   compétition ne serait jamais lue. */
app.use((req, _res, next) => { req.user = { id: moi }; next(); });
app.use('/api/rank', C.router);
const http = createServer(app); await new Promise((r)=>http.listen(0,r));
const base = `http://localhost:${http.address().port}`;
const get = async (p) => (await fetch(base+p)).json();

let r = await get('/api/rank/supporters');
check('classement des supporters', r.classement.length === 6);
/* **900 de virage plus 5 100 de duels classés.** Ce contrôle attendait 900 :
   il mesurait l'époque où ce classement ne lisait que le Grand Virage. La
   ferveur du duel était comptée, écrite, montrée au parcours et au classement
   par compétition — et ignorée ici. Le nombre change parce que le sens
   change, et c'est la décision qu'on vient de prendre : la ferveur est la
   ferveur, d'où qu'elle vienne. */
check('trié sur la ferveur',
  r.classement[0].pseudo === 'Momo' && Number(r.classement[0].ferveur) === 6000
  || (console.log('        en tête :', r.classement[0].pseudo,
    r.classement[0].ferveur), false));
check('le club du joueur est indiqué', r.classement[0].club === 'Petit Club');

r = await get('/api/rank/tribunes');
check('classement des tribunes', r.classement.length === 2);
check('le petit club passe devant grâce à la moyenne',
  r.classement[0].name === 'Petit Club');
const petit = r.classement.find((x)=>x.name==='Petit Club');
const gros = r.classement.find((x)=>x.name==='Gros Club');

/* ------------------------- la ferveur va au club pour lequel on a poussé

   La jointure ne regardait que `user_id` : la ferveur d'un supporter était
   versée à **tous les clubs qu'il suit**. Quelqu'un qui suit les deux et qui
   pousse une soirée entière pour le Petit Club faisait monter le Gros Club
   d'autant, sans y avoir chanté une fois.

   Ça ne se voyait pas, et c'est pour ça que ça a duré : les deux nombres
   restaient plausibles, l'ordre restait vraisemblable, et il fallait suivre
   deux clubs pour que l'écart existe. Le jeu de données de cette suite donnait
   un club par joueur — le cas exact où le défaut n'apparaît jamais.

   On fait donc suivre les deux clubs à quelqu'un, et on regarde si le club où
   il n'a pas mis les pieds encaisse sa ferveur. */
{
  const avant = Number(gros.ferveur);
  /* Momo pousse pour le Petit Club (85) ; on lui fait suivre le Gros (91)
     aussi. `moi` **est** son identifiant public — l'écrire 'u1' en dur passait
     par `INSERT IGNORE`, qui avale le refus de clé étrangère : la ligne n'était
     jamais posée et le contrôle passait au vert sans rien mesurer. */
  const [ins] = await pool.query(`INSERT INTO user_follows (user_id, team_id, is_main)
                                  VALUES (?, 91, 0)`, [moi]);
  check('le second club est bien suivi', ins.affectedRows === 1);
  C.oublier();
  const r2 = await get('/api/rank/tribunes');
  const gros2 = r2.classement.find((x) => x.name === 'Gros Club');
  check('suivre un club ne lui donne pas la ferveur poussée ailleurs',
    Number(gros2.ferveur) === avant
    || (console.log(`        il passe de ${avant} à ${gros2.ferveur}`), false));
  /* Et il compte quand même comme supporter : c'est bien un fidèle de plus,
     simplement un qui n'a encore rien donné là-bas. La moyenne baisse, et
     c'est juste — c'est exactement ce que ce classement mesure. */
  check('mais il compte bien comme supporter de plus',
    Number(gros2.supporters) === Number(gros.supporters) + 1);

  await pool.query('DELETE FROM user_follows WHERE user_id = ? AND team_id = 91', [moi]);
  C.oublier();
}
/* Les deux moyennes montent, et pour la même raison : les duels classés de
   chaque supporter remontent désormais à la tribune pour laquelle il a joué.
   Petit Club : 1 600 de virage + 5 200 de duels sur 2 fidèles. Gros Club :
   500 + 400 sur 4. L'ordre, lui, ne bouge pas — c'est bien la moyenne qui
   classe, pas le total. */
check('la moyenne est bien par supporter',
  Number(petit.moyenne) === 3400 && Number(gros.moyenne) === 225
  || (console.log('        petit', petit.moyenne, '· gros', gros.moyenne), false));
check('le gros club a plus de supporters mais moins de moyenne',
  gros.supporters > petit.supporters && Number(gros.moyenne) < Number(petit.moyenne));

r = await get('/api/rank/duellistes');
check('classement des duels', r.classement.length === 6);

/* **Il ne trie plus sur les victoires.** C'était le cas, et ça récompensait
   celui qui joue beaucoup : quelqu'un qui gagne une fois sur deux mais joue
   trois soirs par semaine passait devant quelqu'un qui gagne quatre fois sur
   cinq. Le tri se fait maintenant sur la **cote**, qui tient compte de
   l'adversaire — voir `shared/cote.js`.

   Ces deux contrôles décrivaient l'ancien tri et rougissaient sur le nouveau.
   Ils sont remplacés, pas retirés : le taux et les victoires restent servis,
   ils ne décident simplement plus de l'ordre. */
check('la cote est servie avec chaque ligne',
  r.classement.every((x) => Number.isFinite(Number(x.cote)))
  || (console.log('        il rend :', JSON.stringify(r.classement[0])), false));
/* Les lignes de ce jeu d'essai sont posées à la main, sans cote écrite : elles
   valent donc le défaut de la colonne, mille. Ce qui compte ici est que la
   valeur remonte jusqu'à l'écran, pas ce qu'elle vaut — le calcul est éprouvé
   dans `cote:test`, et son écriture dans `nvn:net`. */
check('et le tri se fait dessus, de la plus haute à la plus basse',
  r.classement.every((x, i, t) => i === 0 || Number(t[i - 1].cote) >= Number(x.cote))
  || (console.log('        l’ordre :',
    r.classement.map((x) => x.cote).join(' ')), false));
/* Les victoires et le taux restent lisibles : ils ne classent plus, ils
   informent. Les retirer de la réponse aurait vidé la ligne de l'écran. */
check('les victoires restent servies, sans classer',
  r.classement.every((x) => Number.isFinite(Number(x.gagnes))
    && Number.isFinite(Number(x.taux))));

r = await get('/api/rank/moi');
/* La même somme que la liste, et c'est tout l'objet : « ma place » lisait le
   virage seul pendant que SUPPORTERS en lit deux, et le joueur lisait donc un
   rang calculé sur d'autres nombres que le classement qu'il surmonte. */
check('ma ferveur', r.ferveur === 6000
  || (console.log('        elle dit :', r.ferveur), false));
check('mon rang', r.rang === 1 && r.sur === 6);
check('mes duels comptés', r.duels.joues === 3);

moi = 'u60000-0000-0000-0000-000000000006'.slice(0,36);
r = await get('/api/rank/moi');
check('le dernier est bien dernier', r.rang === 6);

/* =============================== les classements d'une compétition

   Ce qu'ils ajoutent au classement général n'est pas une vue de plus : c'est
   un classement qu'on peut gagner. Personne ne vise la tête d'un classement
   mondial ; tout le monde vise la tête de sa compétition.

   Trois choses s'y jouent et aucune ne se lit dans le code :

     1. la ferveur du **Duel** compte au même titre que celle du Virage ;
     2. la compétition **filtre** — une ferveur gagnée ailleurs ne remonte pas ;
     3. le club soutenu décide de ce qui revient à une tribune et à un KOP. */

r = await get('/api/rank/competition/61?saison=2026');

check('la saison demandée est celle rendue', r.saison === 2026);
check('les joueurs de la compétition sont classés', r.joueurs.length === 6);
check('en tête, celui qui a le plus donné', r.joueurs[0].pseudo === 'Momo');
check('la ferveur du duel s’ajoute à celle du virage',
  Number(r.joueurs[0].ferveur) === 1000
  || (console.log('        il dit :', r.joueurs[0].ferveur), false));
check('une ferveur gagnée dans une autre compétition ne remonte pas',
  Number(r.joueurs[0].ferveur) < 5000);

check('les tribunes de la compétition sont classées', r.tribunes.length === 2);
check('le petit club passe devant grâce à la moyenne',
  r.tribunes[0].name === 'Petit Club');
check('et sa moyenne est par supporter, pas par joueur présent',
  Number(r.tribunes[0].moyenne) === 900
  || (console.log('        elle dit :', r.tribunes[0].moyenne), false));

check('les KOP sont classés', r.kops.length === 2);
check('celui du club le plus fervent devant', r.kops[0].nom === 'Les Fidèles');
check('un KOP ne marque que ce que ses membres ont donné pour son club',
  Number(r.kops[0].ferveur) === 1800
  || (console.log('        il dit :', r.kops[0].ferveur), false));
check('divisé par le nombre de membres', Number(r.kops[0].moyenne) === 900);

check('ma place dans cette compétition', r.moi?.rang === 6);

/* La compétition où un seul joueur a poussé : le classement existe quand
   même, et il n'invente personne. */
r = await get('/api/rank/competition/207?saison=2026');
check('une compétition peu jouée se classe aussi', r.joueurs.length === 1);
/* **Le plateau entier, poussé ou non.**

   Ce contrôle demandait l'inverse — une seule tribune, celle qui avait de la
   ferveur — et il avait raison tant que la liste se tirait des lignes de
   ferveur. Mais cette liste est présentée comme « les tribunes de la
   compétition » : un joueur y cherche son club, et une compétition de vingt
   équipes en montrait deux. Il ne pouvait pas savoir s'il était mal classé ou
   absent du jeu.

   Les équipes viennent donc des matchs, comme les résultats et le classement
   de la ligue deux onglets plus loin. Un club à zéro est une tribune à
   prendre, pas une ligne de trop — et « fantôme » ne s'applique qu'à une
   équipe qui ne joue pas cette compétition, ce que le contrôle vérifie
   toujours. */
const noms = r.tribunes.map((t) => t.name).sort();
check('les deux équipes du plateau y figurent, poussées ou non',
  r.tribunes.length === 2
  || (console.log('        la liste :', noms.join(', ')), false));
check('celle qui a de la ferveur devant', r.tribunes[0].name === 'Petit Club'
  || (console.log('        en tête :', r.tribunes[0].name), false));
check('et l’autre est là, à zéro, plutôt qu’absente',
  Number(r.tribunes[1].ferveur) === 0 && r.tribunes[1].name === 'Gros Club'
  || (console.log('        seconde :', JSON.stringify(r.tribunes[1])), false));
/* La compétition 61 n'a pas d'autre équipe : aucune ne doit s'y inviter. */
check('et aucune équipe étrangère à la compétition ne s’y invite',
  noms.every((x) => ['Petit Club', 'Gros Club'].includes(x)));

/* Une compétition dont on n'a aucun match : une page vide, pas une panne. */
r = await get('/api/rank/competition/4242');
check('une compétition sans match rend des listes vides',
  r.joueurs.length === 0 && r.tribunes.length === 0 && r.kops.length === 0);


/* ============================================ le parcours d'un joueur

 * « Qu'est-ce que j'ai joué, et qu'est-ce que ça m'a rapporté ? »
 *
 * Le jeu savait répondre à tout le monde et à personne en particulier. Un
 * joueur n'avait aucun moyen de retrouver sa soirée : ni la liste de ses
 * parties, ni ce que chacune avait donné. Tout était en base depuis le premier
 * jour, rien ne le lisait.
 *
 * Ce qui se vérifie ici tient en trois points : les sortes de parties sont
 * comptées **séparément** — un 2v2 d'entraînement n'est pas un 1v1 classé —,
 * l'entraînement figure au parcours mais **pas** aux classements, et
 * l'historique mêle duels et virages dans le bon ordre.
 */
{
  /* Deux entraînements et un 2v2 classé, posés sur le joueur qu'on interroge.
     Le reste du banc garde ses lignes d'avant — `mode` y vaut « classe » par
     défaut, ce qui est exactement ce que dit la migration du passé. */
  await pool.query(`UPDATE duel_results SET format = '1v1' WHERE user_id = ?`, [moi]);
  await pool.query(
    `INSERT INTO duel_results
       (duel_id, user_id, opponent_id, outcome, goals_for, goals_against,
        fixture_id, team_id, ferveur, format, mode, ended_at)
     VALUES ('e1-u1', ?, 'x', 'win',  2, 1, 7001, 85, 40, '1v1', 'entrainement', NOW(3)),
            ('e2-u1', ?, 'x', 'loss', 0, 3, 7001, 85, 10, '2v2', 'entrainement', NOW(3)),
            ('c4-u1', ?, 'x', 'draw', 1, 1, 7001, 85, 90, '2v2', 'classe', NOW(3))`,
    [moi, moi, moi]);

  const p = await get('/api/rank/parcours');

  const sorte = (jeu, mode, format) => (p.sortes ?? []).find((s) =>
    s.jeu === jeu && s.mode === mode && s.format === format);

  check('le parcours sépare les sortes de partie',
    Boolean(sorte('duel', 'entrainement', '1v1'))
    && Boolean(sorte('duel', 'entrainement', '2v2'))
    && Boolean(sorte('duel', 'classe', '2v2'))
    || (console.log('        vu :', JSON.stringify(p.sortes)), false));

  check('et compte gagnés, nuls et perdus',
    sorte('duel', 'entrainement', '1v1')?.gagnes === 1
    && sorte('duel', 'classe', '2v2')?.nuls === 1);

  check('le Grand Virage y figure comme une sorte à part',
    sorte('virage', null, null)?.joues === 1);

  /* Le total dit **deux** nombres : tout ce qu'on a gagné, et la part qui
     compte au classement. Les deux côte à côte disent la règle mieux qu'une
     phrase — et c'est le serveur qui les calcule, pour que la page ne la
     recopie pas. */
  check('le total additionne les deux jeux',
    p.total?.parties === (p.sortes ?? []).reduce((n, s) => n + s.joues, 0));
  check('et met à part la ferveur qui compte au classement',
    p.total?.ferveurClassee === p.total.ferveur - 50
    || (console.log('        ', JSON.stringify(p.total)), false));

  /* L'entraînement ne remonte nulle part. C'est sa seule différence avec le
     classé, et elle se joue **à la lecture** : les lignes sont écrites, les
     classements les écartent. */
  /* Le classement est mémorisé deux minutes, et la suite en a déjà demandé un
     plus haut : sans cet oubli, on relirait l'état d'avant les lignes qu'on
     vient d’écrire, et le contrôle passerait au vert sans rien éprouver. */
  C.oublier();
  const duel = await get('/api/rank/duellistes');
  /* Par identifiant et non par pseudo : `moi` change au fil de la suite, et
     nommer un joueur en dur ferait lire les parties de quelqu'un d'autre —
     ce qui est exactement arrivé au premier jet. */
  const mien = (duel.classement ?? []).find((x) => x.public_id === moi);
  check('l’entraînement ne gonfle pas le classement des duellistes',
    Number(mien?.joues) === 4
    || (console.log('        parties comptées :', mien?.joues), false));

  /* L'historique : les deux jeux mêlés, la plus récente d'abord. */
  check('l’historique mêle duels et virages',
    (p.lignes ?? []).some((l) => l.jeu === 'duel')
    && (p.lignes ?? []).some((l) => l.jeu === 'virage'));
  check('et il est rangé du plus récent au plus ancien',
    (p.lignes ?? []).every((l, i, t) =>
      i === 0 || new Date(t[i - 1].quand) >= new Date(l.quand)));

  const une = (p.lignes ?? []).find((l) => l.jeu === 'duel' && l.match);
  check('chaque ligne nomme le match qui la portait',
    une?.match?.domicile === 'Petit Club' && une?.match?.exterieur === 'Gros Club');
  check('et le club pour lequel on poussait', une?.pour === 'Petit Club');
  check('elle dit ce qu’elle a rapporté', typeof une?.ferveur === 'number');

  /* La pagination est **par curseur** et non par numéro de page : deux parties
     peuvent finir pendant qu'on lit, et un OFFSET en rendrait une deux fois. */
  const court = await get('/api/rank/parcours?limite=2');
  check('la liste se demande par tranches', (court.lignes ?? []).length === 2);
  check('et elle donne le curseur de la suite', Boolean(court.suite));
  const suite = await get(`/api/rank/parcours?limite=2&avant=${encodeURIComponent(court.suite)}`);
  check('la suite ne rejoue pas ce qu’on a déjà vu',
    (suite.lignes ?? []).every((l) => new Date(l.quand) < new Date(court.suite)));
  check('et elle ne recompte pas les statistiques', suite.sortes === undefined);
}

/* --------------------------------------------- l'historique dit contre qui

   `duel_results.opponent_id` était écrit depuis le premier jour et relu nulle
   part : la ligne du parcours donnait le match de football et pas l'adversaire,
   qui est pourtant le sujet d'un duel.

   Trois cas, et les trois doivent rendre une ligne : un vrai adversaire, un
   bot, et un identifiant qu'on ne retrouve pas. Une jointure fermée aurait fait
   disparaître les deux derniers du parcours — c'est-à-dire la plupart des
   parties d'un joueur qui s'entraîne. */
{
  const [sarahRow] = (await pool.query(
    'SELECT public_id FROM users WHERE pseudo = ? LIMIT 1', ['Sarah']))[0];
  const sarah = sarahRow?.public_id;
  check('un second joueur existe pour ce contrôle', Boolean(sarah));

  /* **Les duels de `moi`, pas ceux de u1.** `moi` est réaffecté plus haut dans
     cette suite — il désigne Inès et non Momo au moment où on arrive ici. On
     retrouve donc les parties par le lecteur lui-même, ce qui reste juste
     quelle que soit la valeur du dessus. */
  const [mesDuels] = await pool.query(
    'SELECT duel_id FROM duel_results WHERE user_id = ? ORDER BY duel_id', [moi]);
  check('le lecteur a au moins trois duels', mesDuels.length >= 3
    || (console.log('        il en a :', mesDuels.length), false));
  const maj = (i, v) => pool.query(
    'UPDATE duel_results SET opponent_id = ? WHERE duel_id = ? AND user_id = ?',
    [v, mesDuels[i].duel_id, moi]);
  await maj(0, sarah);
  await maj(1, 'bot:abcd1234');
  await maj(2, 'inconnu');

  const h = await C.historiqueDe(moi, { limite: 50 });
  const duels = (h.lignes ?? []).filter((l) => l.jeu === 'duel');
  check('les trois duels sont dans le parcours', duels.length >= 3
    || (console.log('        il en rend :', duels.length), false));

  check('celui contre un joueur le nomme',
    duels.some((l) => l.adversaire === 'Sarah')
    || (console.log('        adversaires :',
      JSON.stringify(duels.map((l) => l.adversaire))), false));
  /* Un bot n'a pas de ligne dans `users` : il n'a pas de pseudo, et c'est le
     drapeau qui laisse la page écrire « contre un bot » plutôt que « contre — ». */
  check('celui contre un bot le dit sans inventer de pseudo',
    duels.some((l) => l.contreBot === true && l.adversaire === null));
  /* Et l'adversaire qu'on ne retrouve pas ne fait pas disparaître la partie. */
  check('un adversaire introuvable garde quand même sa ligne',
    duels.some((l) => l.adversaire === null && l.contreBot === false));
}

/* ======================================= une seule monnaie, deux sources

   **La ferveur est la ferveur**, qu'elle vienne du Grand Virage ou d'un duel
   classé. Elle est comptée et écrite pareil des deux côtés ; elle doit être
   lue pareil.

   Elle ne l'était pas. Le classement par compétition additionnait déjà les deux
   — et le fait toujours — pendant que SUPPORTERS et TRIBUNES ne lisaient que
   `virage_presence`. Quelqu'un qui ne faisait que des duels avait de la
   ferveur, la voyait dans son parcours et au classement de la Ligue 1, et
   restait à zéro au classement des supporters. Le même mot mesurait deux
   choses selon l'onglet.

   On fabrique donc le cas qui n'apparaissait nulle part : un joueur qui n'a
   jamais mis les pieds dans un virage et qui a gagné des duels. */
{
  const DUELLISTE = 'd90000-0000-0000-0000-000000000009'.slice(0, 36);
  await pool.query(`INSERT INTO users (public_id,email,pseudo,password_hash,status)
                    VALUES (?,?,?,'x','active')`,
    [DUELLISTE, 'duelliste@ex.fr', 'Rachid']);
  // Il suit le Gros Club (91) et n'a aucune ligne de virage.
  await pool.query('INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,91,1)',
    [DUELLISTE]);
  await pool.query(`INSERT INTO duel_results
      (duel_id,user_id,opponent_id,outcome,fixture_id,team_id,ferveur,mode,ended_at)
    VALUES ('dz-1',?,'x','win',7001,91,400,'classe',NOW(3)),
           ('dz-2',?,'x','win',7001,91,350,'classe',NOW(3))`, [DUELLISTE, DUELLISTE]);
  /* Et une soirée d'entraînement, qui ne doit rien rapporter à personne :
     c'est toute la différence avec le duel classé, et le tri se fait à la
     lecture — la ligne existe, elle ne compte pas. */
  await pool.query(`INSERT INTO duel_results
      (duel_id,user_id,opponent_id,outcome,fixture_id,team_id,ferveur,mode,ended_at)
    VALUES ('dz-3',?,'x','win',7001,91,9999,'entrainement',NOW(3))`, [DUELLISTE]);
  C.oublier();

  const sup = (await get('/api/rank/supporters')).classement ?? [];
  const lui = sup.find((x) => x.pseudo === 'Rachid');
  check('un joueur qui ne fait que des duels est classé parmi les supporters',
    Boolean(lui)
    || (console.log('        la liste :', sup.map((x) => x.pseudo).join(', ')), false));
  check('avec la ferveur de ses duels classés', Number(lui?.ferveur) === 750
    || (console.log('        il a :', lui?.ferveur), false));
  /* Neuf mille neuf cent quatre-vingt-dix-neuf d'entraînement le mettraient
     premier : c'est le contrôle qui compte le plus ici. */
  check('et l’entraînement ne lui rapporte rien', Number(lui?.ferveur) !== 10749);

  /* La tribune de son club l'encaisse aussi : il a poussé **pour elle**. */
  const trib = (await get('/api/rank/tribunes')).classement ?? [];
  const gros3 = trib.find((x) => x.name === 'Gros Club');
  check('et sa tribune reçoit cette ferveur', Number(gros3?.ferveur) >= 750
    || (console.log('        elle a :', gros3?.ferveur), false));

  /* Et sa place le dit comme la liste : les deux lisaient deux sources
     différentes, et le joueur lisait « 312e » sous un classement qui ne le
     classait pas sur les mêmes nombres. */
  const avant = moi;
  moi = DUELLISTE;
  const place = await get('/api/rank/moi');
  moi = avant;
  check('sa place est calculée sur la même ferveur que la liste',
    Number(place.ferveur) === 750
    || (console.log('        sa place dit :', JSON.stringify(place)), false));
  check('et elle le classe', Number(place.rang) > 0);

  /* ================================ la carte « ma place » suit l'onglet

     Elle répondait toujours à la question de la ferveur, y compris sous DUELS :
     on lisait « 312e sur 1 400 supporters classés » au-dessus du classement des
     duellistes. Le rang était exact et répondait à autre chose, et la conclusion
     tombait toute seule — mes duels n'ont pas été comptés.

     Rachid est le cas exact : deux duels classés, donc **sous le plancher**.
     Sa carte doit dire ce qui manque, et surtout ne pas se taire. */
  check('sa place compte ses duels classés', Number(place.duels?.joues) === 2
    || (console.log('        elle dit :', JSON.stringify(place.duels)), false));
  check('et ne le classe pas encore, puisqu’il est sous le plancher',
    place.duels?.rang === null);
  check('mais elle envoie le plancher, pour que l’écran dise combien il manque',
    Number(place.plancher) === 3
    || (console.log('        plancher :', place.plancher), false));

  /* L'onglet TRIBUNES ne classe pas des joueurs : la question qu'on s'y pose
     est « où va ma ferveur ». Un neutre n'en alimente aucune, et rien ne le
     disait nulle part. */
  check('et elle nomme la tribune qui reçoit sa ferveur',
    place.tribune?.nom === 'Gros Club'
    || (console.log('        tribune :', JSON.stringify(place.tribune)), false));

  /* ============================ le club, dans le classement des duellistes

     SUPPORTERS et ENTRAÎNEMENT nommaient le club de chacun ; DUELS, seul des
     trois, le taisait — et c'est là qu'il compte le plus, puisqu'un duel classé
     ne se joue que pendant un match de son club. Il lui faut une troisième
     partie pour entrer : c'est le plancher, et il vaut aussi pour ce test. */
  await pool.query(`INSERT INTO duel_results
      (duel_id,user_id,opponent_id,outcome,fixture_id,team_id,ferveur,mode,ended_at)
    VALUES ('dz-4',?,'x','win',7001,91,100,'classe',NOW(3))`, [DUELLISTE]);
  C.oublier();

  const duel3 = (await get('/api/rank/duellistes')).classement ?? [];
  const rachid = duel3.find((x) => x.pseudo === 'Rachid');
  check('à la troisième partie, il entre au classement des duellistes',
    Boolean(rachid)
    || (console.log('        la liste :', duel3.map((x) => x.pseudo).join(', ')), false));
  check('et sa ligne nomme son club', rachid?.club === 'Gros Club'
    || (console.log('        elle dit :', JSON.stringify(rachid)), false));

  moi = DUELLISTE;
  const place3 = await get('/api/rank/moi');
  check('sa carte le classe alors parmi les duellistes',
    Number(place3.duels?.rang) > 0
    || (console.log('        elle dit :', JSON.stringify(place3.duels)), false));
  check('sur le même effectif que la liste',
    Number(place3.duels?.sur) === duel3.length
    || (console.log('        elle dit :', place3.duels?.sur, 'liste :', duel3.length), false));

  /* ======================= un match que le cache ne connaît pas

     `fixtures` n'est qu'un cache des compétitions suivies : on peut jouer un
     duel sur un match qui n'y figure pas. La ligne perdait alors le match, la
     compétition **et le club**, alors que le club est écrit dessus depuis le
     premier jour. Le parcours affichait « match inconnu » et plus rien d'autre,
     ce qui accusait le jeu d'avoir perdu une partie qu'il avait entière. */
  await pool.query(`INSERT INTO duel_results
      (duel_id,user_id,opponent_id,outcome,fixture_id,team_id,ferveur,mode,ended_at)
    VALUES ('dz-5',?,'x','win',999777,91,10,'classe',NOW(3))`, [DUELLISTE]);

  const parc = await get('/api/rank/parcours');
  const perdue = (parc.lignes ?? []).find((l) => l.ferveur === 10);
  check('un duel sur un match hors cache reste dans le parcours', Boolean(perdue)
    || (console.log('        le parcours :', JSON.stringify(parc.lignes ?? []).slice(0, 200)), false));
  check('il garde le club pour lequel on s’est battu', perdue?.pour === 'Gros Club'
    || (console.log('        il dit :', JSON.stringify(perdue)), false));
  check('et il dit que le match existait, au lieu de le nier',
    perdue?.oublie === true && perdue?.match === null
    || (console.log('        oublie :', perdue?.oublie, 'match :', perdue?.match), false));

  await pool.query(`DELETE FROM duel_results WHERE duel_id IN ('dz-4','dz-5')`);
  moi = avant;
  C.oublier();

  await pool.query(`DELETE FROM duel_results WHERE user_id = ?`, [DUELLISTE]);
  await pool.query(`DELETE FROM user_follows WHERE user_id = ?`, [DUELLISTE]);
  await pool.query(`DELETE FROM users WHERE public_id = ?`, [DUELLISTE]);
  C.oublier();
}

/* ==================================== le tableau de ceux qui s'entraînent

   L'entraînement ne rapporte rien — pas de ferveur, aucun effet sur les
   classements — et c'est toute sa différence avec le duel classé. Mais « ne
   rien rapporter » et « n'exister nulle part » sont deux choses : quelqu'un qui
   passe une soirée à s'entraîner n'en trouvait aucune trace ailleurs que dans
   son propre parcours.

   **Il classe sur les parties jouées, pas sur les victoires**, et c'est le
   contrôle qui compte le plus ici. On s'entraîne aussi contre des machines :
   classer sur les victoires ferait un tableau de qui bat le plus de bots, ce
   qui se gagne en y passant la nuit et ne dit rien de personne. Les parties
   coûtent le même prix à tout le monde — cinq minutes chacune. */
{
  const ASSIDU = 'a90000-0000-0000-0000-00000000000a'.slice(0, 36);
  const VAINQUEUR = 'v90000-0000-0000-0000-00000000000v'.slice(0, 36);
  for (const [id, mail, nom] of [[ASSIDU, 'assidu@ex.fr', 'Nadia'],
    [VAINQUEUR, 'vainqueur@ex.fr', 'Tonio']]) {
    await pool.query(`INSERT INTO users (public_id,email,pseudo,password_hash,status)
                      VALUES (?,?,?,'x','active')`, [id, mail, nom]);
  }
  // Nadia joue beaucoup et perd souvent. Tonio joue peu et gagne tout.
  const lignes = [];
  for (let i = 0; i < 6; i++) lignes.push([`en-a${i}`, ASSIDU, i < 2 ? 'win' : 'loss']);
  for (let i = 0; i < 3; i++) lignes.push([`en-v${i}`, VAINQUEUR, 'win']);
  for (const [duel, uid, issue] of lignes) {
    await pool.query(`INSERT INTO duel_results
        (duel_id,user_id,opponent_id,outcome,ferveur,mode,ended_at)
      VALUES (?,?,'bot:aaaa1111',?,0,'entrainement',NOW(3))`, [duel, uid, issue]);
  }
  C.oublier();

  const e = (await get('/api/rank/entrainements')).classement ?? [];
  const nadia = e.find((x) => x.pseudo === 'Nadia');
  const tonio = e.find((x) => x.pseudo === 'Tonio');
  check('le tableau des entraînements existe et se remplit', Boolean(nadia && tonio)
    || (console.log('        il rend :', JSON.stringify(e).slice(0, 160)), false));
  check('il compte les parties jouées', Number(nadia?.joues) === 6);
  check('et montre les victoires à côté', Number(nadia?.gagnes) === 2);
  /* Tonio gagne trois fois sur trois, Nadia deux fois sur six : sur les
     victoires, Tonio serait devant à égalité de taux parfait. C'est bien
     l'assiduité qui classe. */
  check('celui qui joue le plus passe devant celui qui gagne le mieux',
    e.indexOf(nadia) < e.indexOf(tonio)
    || (console.log('        l’ordre :', e.map((x) => x.pseudo).join(', ')), false));

  /* Et il ne déborde nulle part : l'entraînement ne rapporte aucune ferveur,
     donc ni le classement des supporters ni celui des duellistes ne doivent
     avoir bougé. C'est la moitié de la règle, et c'est celle qu'on casse en
     voulant bien faire. */
  const sup2 = (await get('/api/rank/supporters')).classement ?? [];
  check('s’entraîner ne fait entrer personne au classement des supporters',
    !sup2.some((x) => x.pseudo === 'Nadia'));
  const duel2 = (await get('/api/rank/duellistes')).classement ?? [];
  check('ni à celui des duellistes',
    !duel2.some((x) => x.pseudo === 'Nadia'));

  /* Trois parties au minimum, comme pour les duellistes : une liste où l'on
     entre après une partie est une liste où tout le monde est. */
  await pool.query(`DELETE FROM duel_results WHERE duel_id IN ('en-a0','en-a1','en-a2','en-a3')`);
  C.oublier();
  const e2 = (await get('/api/rank/entrainements')).classement ?? [];
  check('en dessous de trois parties, on n’y figure pas',
    !e2.some((x) => x.pseudo === 'Nadia')
    || (console.log('        il rend encore :', JSON.stringify(e2).slice(0, 120)), false));

  await pool.query('DELETE FROM duel_results WHERE user_id IN (?,?)', [ASSIDU, VAINQUEUR]);
  await pool.query('DELETE FROM users WHERE public_id IN (?,?)', [ASSIDU, VAINQUEUR]);
  C.oublier();
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);

/**
 * La sortie, et pourquoi elle ne passe pas par `process.exit()`.
 *
 * Attendre `http.close()` ne suffisait pas : l'échec revenait environ une fois
 * sur cinq, et seulement lorsque la suite était lancée à la file derrière une
 * autre — jamais seule, ce qui l'a rendu long à attraper. libuv s'arrêtait sur
 * `!(handle->flags & UV_HANDLE_CLOSING)`, c'est-à-dire un handle fermé alors
 * qu'il était déjà en train de se fermer.
 *
 * `process.exit()` coupe la boucle d'événements sans lui laisser finir ses
 * fermetures. Le pool MySQL rend ses sockets de façon asynchrone, et quitter
 * pendant ce rendu tombe sur l'assertion. On pose donc un code de sortie et on
 * laisse Node partir de lui-même quand il n'a plus rien à faire.
 *
 * Effet de bord voulu : si un handle traînait vraiment, la suite ne mourrait
 * plus au hasard, elle resterait ouverte — un symptôme qu'on peut chercher.
 */
await pool.end();
await new Promise((r) => http.close(r));
process.exitCode = failures ? 1 : 0;
