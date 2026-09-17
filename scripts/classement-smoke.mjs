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
await raw.query(`DROP TABLE IF EXISTS abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql','football.sql', 'minutes.sql', 'couleurs.sql','duel.sql','souvenirs.sql', 'billets.sql','fanzzy.sql','inventaire.sql', 'skins.sql', 'kop.sql', 'historique.sql']) {
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
check('trié sur la ferveur', r.classement[0].pseudo === 'Momo' && Number(r.classement[0].ferveur) === 900);
check('le club du joueur est indiqué', r.classement[0].club === 'Petit Club');

r = await get('/api/rank/tribunes');
check('classement des tribunes', r.classement.length === 2);
check('le petit club passe devant grâce à la moyenne',
  r.classement[0].name === 'Petit Club');
const petit = r.classement.find((x)=>x.name==='Petit Club');
const gros = r.classement.find((x)=>x.name==='Gros Club');
check('la moyenne est bien par supporter',
  Number(petit.moyenne) === 800 && Number(gros.moyenne) === 125);
check('le gros club a plus de supporters mais moins de moyenne',
  gros.supporters > petit.supporters && Number(gros.moyenne) < Number(petit.moyenne));

r = await get('/api/rank/duellistes');
check('classement des duels', r.classement.length === 6);
check('trié sur les victoires', Number(r.classement[0].gagnes) === 2);
check('taux de victoire calculé', Number(r.classement[0].taux) === 67);

r = await get('/api/rank/moi');
check('ma ferveur', r.ferveur === 900);
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
check('sans tribune fantôme', r.tribunes.length === 1);

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
