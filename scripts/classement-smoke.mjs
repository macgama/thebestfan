/** Test des classements. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createClassements } from '../src/server/classements/index.js';
import { habillerJoueurs, AVATAR_PUBLIC } from '../src/server/fanzzy/avatar.js';
import { charger as chargerCatalogue, parIdentifiant } from '../src/server/fanzzy/catalogue.js';
import { chargerSaisons, saisonEnCours } from '../src/server/fanzzy/saisons.js';
import { poserReglages } from '../src/shared/reglages.js';
import { niveauPour } from '../src/shared/niveau.js';
import { baseDeTest, OPTIONS_BASE, figerHorloge, enParallele } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
/* Les tables du quotidien et les saisons partent aussi : la suite éprouve la
   fenêtre de saison et le grand livre des divisions, et une saison laissée par
   une autre suite (lancée hier, finie avant-hier) déplacerait chaque nombre
   du classement « saison ». Aucune n'a de clé étrangère vers `users`. */
await raw.query(`DROP TABLE IF EXISTS recompenses, missions_jour, compteurs_jour, user_nouveautes,
  saisons, parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
/* Dans l'ordre de `scripts/ordre-schema.mjs` : `admin` pose `reglages`, que
   `saisons.sql` lit ; `niveau` l'XP des visages ; `abonnement` pour le
   contrôle « abonné comme gratuit » ; `quotidien` en dernier, qui complète
   `saisons` (`fin_le`) et `user_wallet` (`rangs_vus`) et pose le grand livre. */
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'duel.sql',
  'souvenirs.sql', 'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql', 'admin.sql',
  'kop.sql', 'niveau.sql', 'billets.sql', 'saisons.sql', 'historique.sql', 'abonnement.sql',
  'quotidien.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
/* **Une saison lancée hier**, semée comme l'administration l'écrit
   (`NOW(3)`). Tout ce que la suite pose ensuite tombe dans sa fenêtre : les
   contrôles d'avant les saisons gardent leurs nombres, et le classement
   « saison » les compte comme le cumul. `saisons.sql` en pose une d'office
   quand la table est vide ; on la remplace par celle-ci. */
await raw.query('DELETE FROM saisons');
await raw.query(`INSERT INTO saisons (id, numero, nom, series, tenues, lancee_a)
  VALUES (1, 1, 'La reprise', JSON_ARRAY('RP'), JSON_ARRAY(), NOW(3) - INTERVAL 1 DAY)`);
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

/* Douze connexions : dix réclamations simultanées tiennent chacune la sienne
   en attendant le verrou du joueur (le grand livre), et la lecture de l'état
   d'après doit encore en trouver une. */
const pool = mysql.createPool({ uri: DB, connectionLimit: 12, ...OPTIONS_BASE });

/* **Le pool instrumenté.** Toute requête du module passe par `execute` ou
   `query` du pool ; tant que `journal` est un tableau, chacune y est notée.
   C'est ce qui mesure le budget de `/moi` et le mémo, sans lire le code. */
let journal = null;
for (const m of ['execute', 'query']) {
  const vraie = pool[m].bind(pool);
  pool[m] = (sql, ...reste) => {
    if (journal) journal.push(String(typeof sql === 'object' ? sql.sql : sql));
    return vraie(sql, ...reste);
  };
}
const mesurer = async (fn) => {
  journal = [];
  try { await fn(); return journal; } finally { journal = null; }
};

/* Le catalogue, comme `server.js` le charge : sans lui, on ne sait pas que le
   second âge du Choriste s'appelle TR32B, et les visages se taisent. */
await chargerCatalogue(pool);

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
/** Un POST : `corps` est un objet, ou une chaîne envoyée telle quelle. */
const post = async (p, corps) => {
  const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: typeof corps === 'string' ? corps : JSON.stringify(corps) });
  return { status: r.status, json: await r.json().catch(() => null) };
};

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

/* ===================================================================
   La vague du quotidien : les visages, la fenêtre de saison, les
   divisions, l'évolution du rang (`CONTRATS.md`, § 3, § 4.2, § 5.2, § 5.3).
   =================================================================== */

/** Un identifiant public neuf, à 36 caractères comme ceux du jeu. */
const ID = (n) => `c1a55e00-0000-0000-0000-${String(n).padStart(12, '0')}`;
/** Un joueur, et sa bourse s'il en a une. */
async function joueur(id, pseudo, { bourse = true, xp = 0, fanzzy = null, stage = null,
  etat = null, scarves = 0, packs = 3 } = {}) {
  await pool.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `${id}@ex.fr`, pseudo]);
  if (bourse) {
    await pool.query(`INSERT INTO user_wallet (user_id, scarves, packs, xp, active_fanzzy, active_etat)
      VALUES (?,?,?,?,?,?)`, [id, scarves, packs, xp, fanzzy, etat]);
  }
  if (fanzzy && stage) {
    await pool.query(`INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage) VALUES (?,?,1,?)`,
      [id, fanzzy, stage]);
  }
}
/* Une présence au Virage, **semée comme le Virage l'écrit** : `last_push_at`
   par `NOW(3)`, ou par une expression SQL relative à lui, jamais par une date
   fabriquée ici. `quand` vient de la suite, pas d'une requête. */
const pousser = (id, fixture, ferveur, quand = 'NOW(3)') => pool.query(
  `INSERT INTO virage_presence (user_id, fixture_id, side, ferveur, last_push_at)
   VALUES (?, ?, 0, ?, ${quand})`, [id, fixture, ferveur]);
const q = async (sql, params) => (await pool.execute(sql, params))[0];
const GAIN_ZERO = JSON.stringify({ echarpes: 0, packs: 0, xp: 0, tampons: 0 });
const memes = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const lire = async (p) => { const r = await fetch(base + p); return { status: r.status, json: await r.json() }; };
const MOMO = 'u10000-0000-0000-0000-000000000001';
const SARAH = 'u20000-0000-0000-0000-000000000002';

/* ================================================ les visages dans les listes

   Chaque ligne de joueur porte son personnage et son niveau, pour qu'on s'y
   reconnaisse avant de lire un pseudo. Mais une liste publique ne reçoit
   qu'une **liste blanche** : ni la garde-robe de chaque âge, ni l'avatar
   d'entrée en jeu, ni le cri. Momo porte une tenue au premier âge — elle vit
   dans `tenuesParAge`, et ne doit pas sortir d'ici. */
{
  await pool.query(`INSERT INTO user_wallet (user_id, scarves, xp, active_fanzzy, active_etat)
    VALUES (?, 0, 500, 'TR32', 'joie')`, [MOMO]);
  await pool.query(`INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage)
    VALUES (?, 'TR32', 1, 2)`, [MOMO]);
  await pool.query(`INSERT INTO user_skins (user_id, fanzzy_id, stage, skin_id, equipped)
    VALUES (?, 'TR32', 1, 'hiver', 1)`, [MOMO]);
  /* Trois entraînements, pour qu'il figure aussi au tableau de l'assiduité. */
  await pool.query(`INSERT INTO duel_results (duel_id,user_id,opponent_id,outcome,mode)
    VALUES ('mo-e1',?,'x','win','entrainement'),('mo-e2',?,'x','win','entrainement'),
           ('mo-e3',?,'x','loss','entrainement')`, [MOMO, MOMO, MOMO]);
  C.oublier();

  const age = parIdentifiant('TR32B');
  check('le catalogue connaît le second âge du Choriste', Boolean(age));
  const attendu = { id: 'TR32', age: 'TR32B', evo: 2, nom: age?.nom ?? null, skin: 'base',
    etat: 'joie', rar: age?.rar ?? null };
  /* La liste blanche est écrite ici en toutes lettres, et non importée : un
     champ ajouté à celle du module doit faire rougir ce contrôle. */
  const BLANCHE = ['id', 'age', 'evo', 'nom', 'skin', 'etat', 'rar'];
  check('la liste blanche du module est celle du contrat', memes(AVATAR_PUBLIC, BLANCHE));

  const sup = (await get('/api/rank/supporters')).classement ?? [];
  const m = sup.find((x) => x.public_id === MOMO);
  check('une ligne de supporters porte le personnage tel qu’il l’a choisi',
    memes(m?.avatar, attendu)
    || (console.log('        il rend :', JSON.stringify(m?.avatar)), false));
  check('et seulement les champs de la liste blanche',
    memes(Object.keys(m?.avatar ?? {}), BLANCHE)
    || (console.log('        clés :', Object.keys(m?.avatar ?? {}).join(', ')), false));
  check('et son niveau, tiré de son XP', m?.niveau === 5 && niveauPour(500) === 5
    || (console.log('        niveau :', m?.niveau), false));

  /* Sarah n'a pas de bourse : pas de personnage, et surtout pas de niveau
     inventé — « NIV. 1 » par défaut mentirait. */
  const s = sup.find((x) => x.public_id === SARAH);
  check('un joueur sans Fanzzy a un avatar nul', s?.avatar === null);
  check('et pas de niveau quand son XP est illisible', s && !('niveau' in s));

  const duel = (await get('/api/rank/duellistes')).classement ?? [];
  check('les duellistes portent aussi leur visage et leur niveau',
    memes(duel.find((x) => x.public_id === MOMO)?.avatar, attendu)
    && duel.find((x) => x.public_id === MOMO)?.niveau === 5);
  const entr = (await get('/api/rank/entrainements')).classement ?? [];
  check('le tableau des entraînements aussi',
    memes(entr.find((x) => x.public_id === MOMO)?.avatar, attendu)
    || (console.log('        il rend :', JSON.stringify(entr).slice(0, 160)), false));

  const comp = await get('/api/rank/competition/61?saison=2026');
  check('les joueurs d’une compétition aussi',
    memes(comp.joueurs?.find((x) => x.public_id === MOMO)?.avatar, attendu));
  check('mais ni les tribunes ni les KOP, qui sont des groupes',
    !(comp.tribunes ?? []).some((t) => 'avatar' in t || 'niveau' in t)
    && !(comp.kops ?? []).some((k) => 'avatar' in k || 'niveau' in k));

  /* ------------------------------------------------ mon visage dans /moi

     La ligne épinglée sous la liste et la carte de supporter du profil
     montrent le buste du joueur : `/moi` le sert, par la même liste blanche
     que les listes, et le niveau avec. Le lecteur courant (Inès) n'a ni
     Fanzzy ni bourse : un avatar nul, et surtout pas de niveau inventé. */
  const ines = await get('/api/rank/moi');
  check('/moi sans Fanzzy ni bourse : un avatar nul, et pas de niveau',
    'avatar' in ines && ines.avatar === null && !('niveau' in ines)
    || (console.log('        il rend :', JSON.stringify({ avatar: ines.avatar, niveau: ines.niveau })), false));
  const lecteur = moi;
  moi = MOMO;
  const mm = await get('/api/rank/moi');
  moi = lecteur;
  check('/moi sert mon personnage, liste blanche comprise', memes(mm.avatar, attendu)
    || (console.log('        il rend :', JSON.stringify(mm.avatar)), false));
  check('et mon niveau, tiré de mon XP', mm.niveau === 5
    || (console.log('        niveau :', mm.niveau), false));

  /* ------------------------------ un compte supprimé n'a plus de visage

     Les classements ne listent que les comptes actifs. Mais `habillerJoueurs`
     sert aussi les membres d'un KOP, lus sans filtre de statut : c'est donc
     lui qui doit refuser de montrer le personnage d'un compte effacé. */
  const FANTOME = ID(1);
  await joueur(FANTOME, 'Fantome', { xp: 900, fanzzy: 'TR32', stage: 1 });
  await pousser(FANTOME, 7001, 99999);
  await pool.query(`UPDATE users SET status = 'deleted' WHERE public_id = ?`, [FANTOME]);
  C.oublier();
  const sup2 = (await get('/api/rank/supporters')).classement ?? [];
  const tous2 = (await get('/api/rank/supporters?periode=toujours')).classement ?? [];
  check('un compte supprimé n’apparaît dans aucun classement',
    !sup2.some((x) => x.public_id === FANTOME) && !tous2.some((x) => x.public_id === FANTOME));
  const carte = await habillerJoueurs(q, [FANTOME, 'inconnu-0000-0000-0000-000000000000', MOMO]);
  check('habillé, un compte supprimé rend un avatar nul et aucun niveau',
    memes(carte.get(FANTOME), { avatar: null })
    || (console.log('        il rend :', JSON.stringify(carte.get(FANTOME))), false));
  check('un identifiant inconnu aussi',
    memes(carte.get('inconnu-0000-0000-0000-000000000000'), { avatar: null }));
  check('et un compte actif garde le sien', carte.get(MOMO)?.avatar?.age === 'TR32B');
  await pool.query('DELETE FROM virage_presence WHERE user_id = ?', [FANTOME]);

  /* -------------------------------------- trois requêtes, quelle que soit
     la longueur de la liste. Lire chaque joueur à part ferait cent
     cinquante requêtes pour un classement de cinquante lignes. */
  const lot = Array.from({ length: 50 }, (_, i) => ID(100 + i));
  await pool.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES ${
    lot.map(() => "(?,?,?,'x')").join(',')}`, lot.flatMap((id, i) => [id, `lot${i}@ex.fr`, `Lot${i}`]));
  await pool.query(`INSERT INTO user_wallet (user_id, scarves, xp, active_fanzzy) VALUES ${
    lot.map(() => "(?,0,?,'TR32')").join(',')}`, lot.flatMap((id, i) => [id, i * 40]));
  await pool.query(`INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage) VALUES ${
    lot.map(() => "(?,'TR32',1,1)").join(',')}`, lot);
  const compter = async (ids) => {
    const vus = [];
    const r = await habillerJoueurs(async (sql, p) => { vus.push(sql); return q(sql, p); }, ids);
    return { n: vus.length, r };
  };
  const cinq = await compter(lot.slice(0, 5));
  const cinquante = await compter(lot);
  check('trois requêtes pour habiller cinq joueurs', cinq.n === 3
    || (console.log('        il en fait :', cinq.n), false));
  check('et trois pour cinquante', cinquante.n === 3
    || (console.log('        il en fait :', cinquante.n), false));
  check('et chacun des cinquante reçoit son visage et son niveau',
    lot.every((id, i) => cinquante.r.get(id)?.avatar?.age === 'TR32'
      && cinquante.r.get(id)?.niveau === niveauPour(i * 40)));

  /* --------------------------- dix lectures simultanées après expiration

     Le mémo gardait la valeur, posée une fois le calcul fini : entre
     l'expiration et cette fin, chaque lecture relançait le calcul. Appelé
     directement, sans réseau : les dix appels partent avant qu'aucun n'ait
     fini, ce qui rend la course certaine et non probable. */
  C.oublier();
  const vus = await mesurer(() => enParallele(10, () => C.supporters('saison')));
  check('dix lectures simultanées après expiration : un seul calcul',
    vus.filter((s) => s.includes('AS vecus')).length === 1
    || (console.log('        calculs :', vus.filter((s) => s.includes('AS vecus')).length), false));
}

/* ======================================== le classement « saison » compte la saison

   Il additionnait tout depuis toujours, sous un onglet qui disait SAISON.
   Zoé a poussé et joué **avant** le lancement de la saison (semé en SQL, deux
   et trois jours avant `NOW(3)`), puis un peu depuis. */
const ZOE = ID(2);
{
  await joueur(ZOE, 'Zoe');
  await pousser(ZOE, 7001, 400, 'NOW(3) - INTERVAL 2 DAY');
  await pool.query(`INSERT INTO duel_results (duel_id,user_id,opponent_id,outcome,ferveur,mode,ended_at)
    VALUES ('zo-1',?,'x','win',300,'classe',NOW(3) - INTERVAL 3 DAY)`, [ZOE]);
  await pousser(ZOE, 7002, 50);
  C.oublier();

  const saison = (await get('/api/rank/supporters?periode=saison')).classement ?? [];
  const toujours = (await get('/api/rank/supporters?periode=toujours')).classement ?? [];
  const mois = (await get('/api/rank/supporters?periode=mois')).classement ?? [];
  const zs = saison.find((x) => x.public_id === ZOE);
  const zt = toujours.find((x) => x.public_id === ZOE);
  check('une ferveur d’avant le lancement ne compte pas pour la saison',
    Number(zs?.ferveur) === 50 || (console.log('        saison :', zs?.ferveur), false));
  check('elle compte pour toujours, l’ancien cumul',
    Number(zt?.ferveur) === 750 || (console.log('        toujours :', zt?.ferveur), false));
  check('et pour le mois, qui ne change pas',
    Number(mois.find((x) => x.public_id === ZOE)?.ferveur) === 750);
  check('sans période, c’est la saison',
    memes(saison, (await get('/api/rank/supporters')).classement));
  check('une période inconnue retombe sur la saison',
    memes(saison, (await get('/api/rank/supporters?periode=n-importe')).classement));
  check('sous SAISON, chaque ligne porte sa division : Sympathisant dès la première ferveur',
    zs?.division === 1 || (console.log('        division :', zs?.division), false));
  check('les autres périodes ne la portent pas',
    !toujours.some((x) => 'division' in x) && !mois.some((x) => 'division' in x));

  /* La racine de /moi garde son sens (tous les temps) ; la place sous SAISON
     vit dans `saison`, calculée sur la même fenêtre que la liste. */
  moi = ZOE;
  const z = await get('/api/rank/moi');
  check('la racine de /moi garde le cumul de tous les temps', z.ferveur === 750);
  check('saison.ferveur ne compte que la saison', z.saison?.ferveur === 50
    || (console.log('        saison :', JSON.stringify(z.saison)), false));
  const position = saison.findIndex((x) => x.public_id === ZOE) + 1;
  check('saison.rang égale la position dans la liste SAISON',
    position > 0 && z.saison?.rang === position
    || (console.log(`        rang ${z.saison?.rang}, position ${position}`), false));
  check('et diffère du rang de tous les temps, qu’une ligne d’avant le lancement déplace',
    z.saison?.rang !== z.rang);
  check('saison.sur est l’effectif de la liste SAISON', z.saison?.sur === saison.length
    || (console.log(`        sur ${z.saison?.sur}, liste ${saison.length}`), false));
  check('la saison se nomme', z.saison?.id === 1 && z.saison?.numero === 1
    && z.saison?.nom === 'La reprise');
}

/* ======================================================== les divisions

   Des seuils fixes, réglables : on les pose bas pour la suite. Une division
   ne verse **rien** — l'insigne, et le titre pour Capo. */
const SEUILS = { 'rang.habitue': 100, 'rang.fervent': 300, 'rang.ultra': 1000, 'rang.capo': 3000 };
poserReglages(SEUILS);
const DORA = ID(3);
const FRED = ID(4);
const ABO = ID(5);
const GRA = ID(6);
const CAPO = ID(7);
{
  await joueur(DORA, 'Dora', { scarves: 77, packs: 5 });
  await pousser(DORA, 7001, 299);
  moi = DORA;
  let d = await get('/api/rank/moi');
  check('à 299, juste sous Fervent : Habitué',
    memes(d.saison?.division, { n: 2, id: 'habitue', nom: 'HABITUÉ' })
    || (console.log('        division :', JSON.stringify(d.saison?.division)), false));
  check('et la suivante dit ce qui manque, à l’unité',
    memes(d.saison?.prochaine, { n: 3, id: 'fervent', nom: 'FERVENT', seuil: 300, manque: 1 })
    || (console.log('        prochaine :', JSON.stringify(d.saison?.prochaine)), false));
  const p = d.saison?.paliers ?? [];
  check('quatre paliers, de Habitué à Capo', memes(p.map((x) => x.n), [2, 3, 4, 5]));
  check('chacun avec son état', memes(p.map((x) => x.etat), ['pret', 'a_venir', 'a_venir', 'a_venir']));
  check('et un gain à quatre zéros : une division ne verse rien',
    p.length === 4 && p.every((x) => JSON.stringify(x.gain) === GAIN_ZERO));
  check('Capo seul porte un titre',
    p.find((x) => x.n === 5)?.titre === 'Capo de la saison 1'
    && p.filter((x) => 'titre' in x).length === 1);
  check('les seuils sont ceux du moment', memes(p.map((x) => x.seuil), [100, 300, 1000, 3000]));
  check('aReclamer compte les divisions prêtes', d.saison?.aReclamer === 1);

  await pousser(DORA, 7002, 1);
  d = await get('/api/rank/moi');
  check('à 300 pile : Fervent', d.saison?.division?.id === 'fervent');
  check('et la suivante est Ultra, à 700', memes(d.saison?.prochaine,
    { n: 4, id: 'ultra', nom: 'ULTRA', seuil: 1000, manque: 700 }));
  check('deux divisions prêtes', d.saison?.aReclamer === 2);
  C.oublier();
  check('sa ligne sous SAISON porte la division 3',
    (await get('/api/rank/supporters')).classement.find((x) => x.public_id === DORA)?.division === 3);

  /* Des seuils réglés dans le désordre : Fervent sous Habitué. Le registre
     ne les contrôle pas entre eux ; `shared/saison.js` les rend monotones. */
  poserReglages({ ...SEUILS, 'rang.fervent': 50 });
  d = await get('/api/rank/moi');
  check('un seuil réglé sous le précédent est remonté à lui',
    d.saison?.paliers?.find((x) => x.id === 'fervent')?.seuil === 100
    || (console.log('        paliers :', JSON.stringify(d.saison?.paliers)), false));
  poserReglages(SEUILS);

  /* ----------------------------------------------------- porter l'insigne */
  const avant = (await q('SELECT scarves, packs, packs_at FROM user_wallet WHERE user_id = ?', [DORA]))[0];
  const r = await post('/api/rank/division', { saison: 1, id: 'fervent' });
  check('porter l’insigne de Fervent répond 200', r.status === 200);
  check('versé, avec un gain à quatre zéros',
    r.json?.verse === true && JSON.stringify(r.json?.gain) === GAIN_ZERO
    || (console.log('        il rend :', JSON.stringify(r.json).slice(0, 200)), false));
  check('la bourse rendue est celle d’avant', memes(r.json?.wallet, { scarves: 77, packs: 5 }));
  check('et pas de niveau : aucune XP', r.json && !('niveau' in r.json));
  check('la réponse porte la saison à jour',
    r.json?.saison?.paliers?.find((x) => x.id === 'fervent')?.etat === 'reclame'
    && r.json?.saison?.aReclamer === 1);
  const apres = (await q('SELECT scarves, packs, packs_at FROM user_wallet WHERE user_id = ?', [DORA]))[0];
  check('la bourse en base n’a pas bougé, minuterie comprise', memes(avant, apres));
  const lignes = await q(`SELECT source, cle, saison_id, echarpes, packs, xp, tampons, titre, insigne
    FROM recompenses WHERE user_id = ?`, [DORA]);
  check('le grand livre inscrit une ligne, à gain nul, avec l’insigne',
    memes(lignes, [{ source: 'division', cle: 'S1:fervent', saison_id: 1, echarpes: 0, packs: 0,
      xp: 0, tampons: 0, titre: null, insigne: 'fervent' }])
    || (console.log('        il inscrit :', JSON.stringify(lignes)), false));
  const encore = await post('/api/rank/division', { saison: 1, id: 'fervent' });
  check('la même réclamation une seconde fois : déjà',
    encore.json?.verse === false && encore.json?.raison === 'deja');

  /* Deux onglets, puis dix : une seule ligne. */
  const deux = await enParallele(2, () => post('/api/rank/division', { saison: 1, id: 'habitue' }));
  check('deux réclamations simultanées : une versée, une « déjà »',
    deux.filter((x) => x.json?.verse === true).length === 1
    && deux.filter((x) => x.json?.raison === 'deja').length === 1
    || (console.log('        réponses :', JSON.stringify(deux.map((x) => x.json?.raison ?? x.json?.verse))), false));
  check('et une seule ligne au grand livre',
    (await q(`SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ? AND cle = 'S1:habitue'`, [DORA]))[0].n === 1);

  await joueur(FRED, 'Fred');
  await pousser(FRED, 7001, 150);
  moi = FRED;
  const dix = await enParallele(10, () => post('/api/rank/division', { saison: 1, id: 'habitue' }));
  check('dix réclamations simultanées : une versée, neuf « déjà »',
    dix.filter((x) => x.json?.verse === true).length === 1
    && dix.filter((x) => x.json?.raison === 'deja').length === 9
    || (console.log('        réponses :', JSON.stringify(dix.map((x) => x.status))), false));
  check('et une seule ligne',
    (await q(`SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ?`, [FRED]))[0].n === 1);

  /* Pas atteinte : le serveur recompte, il ne croit pas l'écran. */
  moi = DORA;
  const capo = await post('/api/rank/division', { saison: 1, id: 'capo' });
  check('une division pas atteinte : incomplet, rien d’inscrit',
    capo.json?.verse === false && capo.json?.raison === 'incomplet'
    && (await q(`SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ? AND cle = 'S1:capo'`, [DORA]))[0].n === 0
    || (console.log('        il rend :', JSON.stringify(capo.json).slice(0, 160)), false));
  for (const [corps, quoi] of [[{ saison: 999, id: 'fervent' }, 'une saison inconnue'],
    [{ saison: 1, id: 'sympathisant' }, 'Sympathisant, qui ne se récupère pas'],
    [{ saison: 1, id: 'zzz' }, 'une division inconnue']]) {
    const x = await post('/api/rank/division', corps);
    check(`${quoi} : inconnu`, x.status === 200 && x.json?.verse === false && x.json?.raison === 'inconnu'
      || (console.log('        il rend :', x.status, JSON.stringify(x.json).slice(0, 120)), false));
  }
  for (const [corps, quoi] of [[{ saison: 'x', id: 'fervent' }, 'une saison qui n’est pas un nombre'],
    [{}, 'un corps vide'], ['{pas du json', 'un corps illisible'], [{ saison: 1 }, 'sans division']]) {
    const x = await post('/api/rank/division', corps);
    check(`${quoi} : 400, sous la forme habituelle`,
      x.status === 400 && x.json?.error === 'rank.error.division_requete'
      || (console.log('        il rend :', x.status, JSON.stringify(x.json)), false));
  }

  /* --------------------- une division récupérée reste acquise

     L'administration relève Fervent au-dessus de sa ferveur : elle le porte
     déjà, elle le garde, et on ne lui réannonce pas ce qu'elle a. */
  poserReglages({ ...SEUILS, 'rang.fervent': 10000 });
  d = await get('/api/rank/moi');
  check('un seuil relevé ne retire pas une division déjà portée',
    d.saison?.division?.id === 'fervent'
    && d.saison?.paliers?.find((x) => x.id === 'fervent')?.etat === 'reclame'
    || (console.log('        il rend :', JSON.stringify(d.saison).slice(0, 220)), false));
  check('et la suivante est au-delà de ce qu’elle porte',
    memes(d.saison?.prochaine, { n: 4, id: 'ultra', nom: 'ULTRA', seuil: 10000, manque: 9700 })
    || (console.log('        prochaine :', JSON.stringify(d.saison?.prochaine)), false));
  poserReglages(SEUILS);

  /* --------------------- abonné ou gratuit, une division ne verse rien

     La ferveur classée n'a pas de plafond pour un abonné : une division qui
     paierait se gagnerait en partie en payant. Les deux bourses doivent
     rester exactement ce qu'elles étaient. */
  await joueur(ABO, 'Abonne', { scarves: 40, packs: 2 });
  await joueur(GRA, 'Gratuit', { scarves: 40, packs: 2 });
  await pool.query(`INSERT INTO abonnements (user_id, formule, fin) VALUES (?, 'mensuel', NULL)`, [ABO]);
  for (const [id, qui] of [[ABO, 'un abonné'], [GRA, 'un gratuit']]) {
    await pousser(id, 7001, 150);
    moi = id;
    const b0 = (await q('SELECT scarves, packs, packs_at FROM user_wallet WHERE user_id = ?', [id]))[0];
    const x = await post('/api/rank/division', { saison: 1, id: 'habitue' });
    const b1 = (await q('SELECT scarves, packs, packs_at FROM user_wallet WHERE user_id = ?', [id]))[0];
    const l = (await q(`SELECT echarpes, packs, xp, tampons FROM recompenses WHERE user_id = ?`, [id]))[0];
    check(`pour ${qui}, la division est portée sans changer ni écharpes ni réserve`,
      x.json?.verse === true && memes(b0, b1)
      && memes(l, { echarpes: 0, packs: 0, xp: 0, tampons: 0 })
      || (console.log('        avant', JSON.stringify(b0), 'après', JSON.stringify(b1),
        'ligne', JSON.stringify(l)), false));
  }

  /* --------------------------------------------- tout porter, et le titre */
  await joueur(CAPO, 'Capo');
  await pousser(CAPO, 7001, 3000);
  moi = CAPO;
  const tout = await post('/api/rank/division', { tout: true });
  check('tout porter verse les quatre divisions prêtes, sans rien verser',
    tout.json?.verse === true && JSON.stringify(tout.json?.gain) === GAIN_ZERO
    && (await q(`SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ?`, [CAPO]))[0].n === 4
    || (console.log('        il rend :', JSON.stringify(tout.json).slice(0, 200)), false));
  check('et la réponse porte la saison, plus rien à porter', tout.json?.saison?.aReclamer === 0);
  const capoLigne = (await q(`SELECT titre, insigne FROM recompenses WHERE user_id = ? AND cle = 'S1:capo'`, [CAPO]))[0];
  check('la ligne de Capo porte le titre et l’insigne',
    memes(capoLigne, { titre: 'Capo de la saison 1', insigne: 'capo' }));
  const c = await get('/api/rank/moi');
  check('le titre est servi dans /moi',
    memes(c.titres, [{ nom: 'Capo de la saison 1', source: 'division', saison: 1 }])
    || (console.log('        titres :', JSON.stringify(c.titres)), false));
  check('à Capo, pas de division suivante', c.saison?.division?.id === 'capo' && !('prochaine' in c.saison));
  const rien = await post('/api/rank/division', { tout: true });
  check('tout porter quand tout est porté : incomplet',
    rien.json?.verse === false && rien.json?.raison === 'incomplet');
  moi = DORA;
  check('sans titre gagné, pas de champ titres', !('titres' in await get('/api/rank/moi')));
}

/* ========================================================= depuis hier

   L'horloge de la base est figée : le jour de jeu est le sien. Eva est
   encadrée par deux joueurs posés exprès (280 et 260) et personne d'autre
   entre 250 et 300 : en passant de 250 à 290, elle monte d'exactement deux
   places. */
const EVA = ID(8);
{
  const instant = await figerHorloge(pool, '2026-10-10 12:00:00');
  /* Le contrôle du contrôle : deux connexions différentes du pool rendent
     l'heure figée. */
  const c1 = await pool.getConnection();
  const c2 = await pool.getConnection();
  const [[h1]] = await c1.query('SELECT UNIX_TIMESTAMP(NOW()) AS t, CONNECTION_ID() AS id');
  const [[h2]] = await c2.query('SELECT UNIX_TIMESTAMP(NOW()) AS t, CONNECTION_ID() AS id');
  c1.release(); c2.release();
  check('l’horloge figée vaut sur deux connexions du pool',
    h1.id !== h2.id && Number(h1.t) === Math.floor(instant) && Number(h2.t) === Math.floor(instant));

  await joueur(EVA, 'Eva');
  await joueur(ID(9), 'Haut', { bourse: false });
  await joueur(ID(10), 'Bas', { bourse: false });
  await pousser(ID(9), 7001, 280);
  await pousser(ID(10), 7001, 260);
  await pousser(EVA, 7001, 250);
  await pool.query(`INSERT INTO duel_results (duel_id,user_id,opponent_id,outcome,mode,elo_after)
    VALUES ('ev-1',?,'x','win','classe',1000),('ev-2',?,'x','win','classe',1000),
           ('ev-3',?,'x','win','classe',1000)`, [EVA, EVA, EVA]);
  /* Trois entraînements, autant que Momo : à égalité, elle est première du
     tableau de l'assiduité. */
  await pool.query(`INSERT INTO duel_results (duel_id,user_id,opponent_id,outcome,mode)
    VALUES ('ev-e1',?,'x','win','entrainement'),('ev-e2',?,'x','win','entrainement'),
           ('ev-e3',?,'x','win','entrainement')`, [EVA, EVA, EVA]);
  moi = EVA;
  const ecritures = (j) => j.filter((s) => /^\s*UPDATE user_wallet SET rangs_vus/.test(s)).length;

  let rep;
  let j = await mesurer(async () => { rep = await get('/api/rank/moi'); });
  check('le premier jour, pas d’évolution', rep.saison && !('evolution' in rep));
  check('et la photo du jour s’écrit, une fois', ecritures(j) === 1);
  const photo = (await q(`SELECT JSON_UNQUOTE(JSON_EXTRACT(rangs_vus, '$.jour.jour')) AS jour
    FROM user_wallet WHERE user_id = ?`, [EVA]))[0];
  check('datée du jour de jeu de la base', photo?.jour === '2026-10-10');
  const r1 = rep.saison?.rang;
  j = await mesurer(async () => { rep = await get('/api/rank/moi'); });
  check('une deuxième lecture le même jour n’écrit rien', ecritures(j) === 0);
  check('et n’a toujours pas d’évolution', !('evolution' in rep));

  /* Le lendemain : deux places de mieux, une cote qui monte de 30, et une
     place de perdue à l'entraînement, où Momo l'a dépassée (le signe compte :
     positif, on a monté ; négatif, on a descendu). */
  await pousser(EVA, 7002, 40);
  await pool.query(`INSERT INTO duel_results (duel_id,user_id,opponent_id,outcome,mode,elo_after)
    VALUES ('ev-4',?,'x','win','classe',1030)`, [EVA]);
  await pool.query(`INSERT INTO duel_results (duel_id,user_id,opponent_id,outcome,mode)
    VALUES ('mo-e4',?,'x','win','entrainement')`, [MOMO]);
  await figerHorloge(pool, '2026-10-11 09:00:00');
  const attendue = { depuis: '2026-10-10', ferveur: { rang: 2 }, duels: { rang: 0, cote: 30 },
    entrainements: { rang: -1 } };
  j = await mesurer(async () => { rep = await get('/api/rank/moi'); });
  check('le lendemain, l’évolution compare au dernier jour vu',
    memes(rep.evolution, attendue)
    || (console.log(`        rang ${r1} → ${rep.saison?.rang}, il rend :`, JSON.stringify(rep.evolution)), false));
  check('et la photo du jour s’écrit, une fois', ecritures(j) === 1);
  j = await mesurer(async () => { rep = await get('/api/rank/moi'); });
  check('une deuxième lecture du jour rend la même évolution',
    memes(rep.evolution, attendue)
    || (console.log('        il rend :', JSON.stringify(rep.evolution)), false));
  check('sans rien écrire', ecritures(j) === 0);

  /* Trois jours sans venir : la référence est le dernier jour **vu**. */
  await figerHorloge(pool, '2026-10-14 10:00:00');
  rep = await get('/api/rank/moi');
  check('après une absence, on compare au dernier jour vu',
    memes(rep.evolution, { depuis: '2026-10-11', ferveur: { rang: 0 }, duels: { rang: 0, cote: 0 },
      entrainements: { rang: 0 } })
    || (console.log('        il rend :', JSON.stringify(rep.evolution)), false));
  await figerHorloge(pool, null);
}

/* ================================================ une seule saison passée

   Trois saisons : la 1 finie à sa date, la 2 sans date — finie au lancement
   de la 3 —, la 3 en cours. Pia a de quoi porter Habitué dans la 1 et dans la
   2 ; seule la plus récente est servie, puis l'autre quand elle est vidée. */
const PIA = ID(11);
{
  await pool.query('DELETE FROM saisons');
  await pool.query(`INSERT INTO saisons (id, numero, nom, series, tenues, lancee_a, fin_le) VALUES
    (11, 1, 'La reprise', JSON_ARRAY(), JSON_ARRAY(), NOW(3) - INTERVAL 30 DAY, CURDATE() - INTERVAL 25 DAY),
    (12, 2, 'La trêve', JSON_ARRAY(), JSON_ARRAY(), NOW(3) - INTERVAL 20 DAY, NULL),
    (13, 3, 'Le printemps', JSON_ARRAY(), JSON_ARRAY(), NOW(3) - INTERVAL 10 DAY, NULL)`);
  await joueur(PIA, 'Pia');
  await pousser(PIA, 9001, 150, 'NOW(3) - INTERVAL 28 DAY');
  await pousser(PIA, 9002, 150, 'NOW(3) - INTERVAL 15 DAY');
  /* Dans la saison 3. Si la fenêtre de la 2, sans date, ne s'arrêtait pas au
     lancement de la 3, ces 10 l'amèneraient à 160 — au-dessus de Fervent. */
  await pousser(PIA, 9003, 10, 'NOW(3) - INTERVAL 5 DAY');
  poserReglages({ ...SEUILS, 'rang.fervent': 155 });
  moi = PIA;
  let p = await get('/api/rank/moi');
  check('la saison en cours est la dernière lancée', p.saison?.id === 13 && p.saison?.ferveur === 10);
  check('saisonPassee sert la plus récente des saisons finies qui a une division prête',
    memes(p.saisonPassee, { id: 12, numero: 2, nom: 'La trêve', paliers: [{ n: 2, id: 'habitue',
      nom: 'HABITUÉ', seuil: 100, etat: 'pret', gain: JSON.parse(GAIN_ZERO) }] })
    || (console.log('        il rend :', JSON.stringify(p.saisonPassee)), false));
  const x = await post('/api/rank/division', { saison: 12, id: 'habitue' });
  check('une fois vidée, la précédente prend sa place',
    x.json?.verse === true && x.json?.saisonPassee?.id === 11
    || (console.log('        il rend :', JSON.stringify(x.json).slice(0, 200)), false));
  const y = await post('/api/rank/division', { tout: true });
  check('et quand tout est porté, il n’y a plus de saison passée',
    y.json?.verse === true && !('saisonPassee' in y.json) && y.json?.saison?.id === 13);

  /* ------------------------------- une présence sans match connu compte

     `fixtures` n'est qu'un cache des compétitions suivies, et les poussées
     de Pia (9001 à 9003) n'y ont aucune ligne. Elles comptent pour la saison
     comme les autres : la liste SAISON ne passe jamais par un match. L'état
     « classement@classé » de l'audit sème sa ferveur ainsi ; exiger une
     rencontre viderait sa liste sans un mot. */
  C.oublier();
  const enLice = (await get('/api/rank/supporters?periode=saison')).classement ?? [];
  const sansMatch = (await q('SELECT COUNT(*) AS n FROM fixtures WHERE id IN (9001, 9002, 9003)'))[0].n;
  check('une présence sur un match absent de fixtures compte dans la liste SAISON',
    sansMatch === 0 && Number(enLice.find((z) => z.public_id === PIA)?.ferveur) === 10
    || (console.log('        Pia :', JSON.stringify(enLice.find((z) => z.public_id === PIA)),
      'matchs connus :', sansMatch), false));

  /* ----------------------------------------- la fin, au sens de /dex

     La ligne épinglée et le profil écrivent « SAISON 3 · 12 JOURS » sans
     lire /dex : /moi porte `fin`, `joursRestants` et `finie` (`CONTRATS.md`,
     § 7.1), et doit dire **exactement** ce que /dex dit au même instant —
     `fanzzy/saisons.js`, relu après chaque changement de date. Sans date
     saisie, ni fin ni jours : jamais « 0 JOUR ». */
  const finDe = (s) => ({ fin: s?.fin, joursRestants: s?.joursRestants, finie: s?.finie });
  const jourSql = async (k) => (await q(
    `SELECT DATE_FORMAT(CURDATE() + INTERVAL ? DAY, '%Y-%m-%d') AS j`, [k]))[0].j;
  const dex = async () => { await chargerSaisons(pool); return finDe(saisonEnCours()); };
  p = await get('/api/rank/moi');
  check('sans date de fin : ni fin ni jours restants, et pas finie',
    p.saison && !('fin' in p.saison) && !('joursRestants' in p.saison) && p.saison.finie === false
    || (console.log('        il rend :', JSON.stringify(finDe(p.saison))), false));
  for (const [k, jours, quoi] of [[11, 12, 'dans onze jours : douze jours, aujourd’hui compris'],
    [0, 1, 'aujourd’hui : le dernier jour']]) {
    await pool.query('UPDATE saisons SET fin_le = CURDATE() + INTERVAL ? DAY WHERE id = 13', [k]);
    p = await get('/api/rank/moi');
    const attendue = { fin: await jourSql(k), joursRestants: jours, finie: false };
    check(`fin ${quoi}`, memes(finDe(p.saison), attendue)
      || (console.log('        il rend :', JSON.stringify(finDe(p.saison))), false));
    const d = await dex();
    check(`et /dex dit la même chose (${jours} jour${jours > 1 ? 's' : ''})`, memes(d, attendue)
      || (console.log('        /dex :', JSON.stringify(d)), false));
  }

  /* La saison en cours **finie** : sa date est passée, la suivante n'est
     pas lancée. Elle reste la saison servie, sa liste est figée — une
     poussée d'aujourd'hui n'y compte plus —, et l'on n'annonce plus de
     division suivante : il n'y a plus rien à gagner. */
  await pool.query('UPDATE saisons SET fin_le = CURDATE() - INTERVAL 1 DAY WHERE id = 13');
  await pousser(PIA, 9004, 500);
  C.oublier();
  p = await get('/api/rank/moi');
  check('finie, la saison reste servie, sa ferveur figée',
    p.saison?.id === 13 && p.saison?.ferveur === 10
    || (console.log('        il rend :', JSON.stringify(p.saison).slice(0, 200)), false));
  check('sans division suivante à annoncer', p.saison && !('prochaine' in p.saison));
  check('et elle ne passe pas dans saisonPassee', !('saisonPassee' in p));
  const finie = { fin: await jourSql(-1), joursRestants: 0, finie: true };
  check('finie : la date d’hier, zéro jour, finie vraie', memes(finDe(p.saison), finie)
    || (console.log('        il rend :', JSON.stringify(finDe(p.saison))), false));
  const dFinie = await dex();
  check('et /dex dit la même chose (finie)', memes(dFinie, finie)
    || (console.log('        /dex :', JSON.stringify(dFinie)), false));
  check('sa liste aussi est figée',
    Number((await get('/api/rank/supporters')).classement.find((x) => x.public_id === PIA)?.ferveur) === 10);
  await pool.query('UPDATE saisons SET fin_le = NULL WHERE id = 13');
  await pool.query('DELETE FROM virage_presence WHERE user_id = ? AND fixture_id = 9004', [PIA]);
  C.oublier();

  /* Ferveur nulle dans la saison : la saison est servie, mais ni place, ni
     effectif, ni division — on n'est pas dans la liste. La prochaine est
     Sympathisant, à la première ferveur. */
  const NUL = ID(13);
  await joueur(NUL, 'Nul');
  moi = NUL;
  const n0 = await get('/api/rank/moi');
  check('à ferveur nulle : ni rang, ni effectif, ni division',
    n0.saison?.ferveur === 0 && !('rang' in n0.saison) && !('sur' in n0.saison)
    && !('division' in n0.saison)
    || (console.log('        il rend :', JSON.stringify(n0.saison).slice(0, 200)), false));
  check('et la prochaine est Sympathisant, à la première ferveur',
    memes(n0.saison?.prochaine, { n: 1, id: 'sympathisant', nom: 'SYMPATHISANT', seuil: 1, manque: 1 }));
  poserReglages(SEUILS);
}

/* ============================================================ le budget

   `/moi` faisait dix requêtes pour un joueur classé partout (ferveur, rang,
   effectif, duels, entraînements, deux rangs, deux effectifs, tribune). Le
   rang et l'effectif de chaque échelle se lisent maintenant ensemble : sept.
   La vague en ajoute quatre — les saisons avec ma ferveur, ma place dans la
   saison, le grand livre, la photo d'hier — plus une écriture, la première
   fois du jour seulement, et mon visage : trois lectures quand un Fanzzy est
   équipé (bourse, âges, tenues), une sans. Bud en porte un : c'est le pire
   cas qu'on mesure, toujours quinze et quatorze. */
const BUD = ID(12);
{
  await joueur(BUD, 'Bud', { fanzzy: 'TR32', stage: 1 });
  await pousser(BUD, 7001, 70);
  await pool.query(`INSERT INTO duel_results (duel_id,user_id,opponent_id,outcome,mode) VALUES
    ('bu-1',?,'x','win','classe'),('bu-2',?,'x','win','classe'),('bu-3',?,'x','win','classe'),
    ('bu-4',?,'x','win','entrainement'),('bu-5',?,'x','win','entrainement'),
    ('bu-6',?,'x','win','entrainement')`, [BUD, BUD, BUD, BUD, BUD, BUD]);
  moi = BUD;
  let rep;
  const j1 = await mesurer(async () => { rep = await get('/api/rank/moi'); });
  check('le budget se mesure avec un visage servi', rep.avatar?.age === 'TR32'
    || (console.log('        avatar :', JSON.stringify(rep.avatar)), false));
  const j2 = await mesurer(() => get('/api/rank/moi'));
  check('/moi : quinze requêtes la première fois du jour, écriture comprise', j1.length === 15
    || (console.log('        il en fait :', j1.length), false));
  check('et quatorze ensuite', j2.length === 14
    || (console.log('        il en fait :', j2.length), false));
}

/* ======================================================= les divisions éteintes

   L'interrupteur coupé fait deux choses : plus rien de neuf (ni nœud, ni
   insigne sur les lignes) et les réclamations refusent. Les titres, eux,
   sont gagnés pour toujours. */
{
  poserReglages({ ...SEUILS, 'rang.actif': false });
  C.oublier();
  moi = DORA;
  const d = await get('/api/rank/moi');
  check('éteintes : ni saison ni saison passée dans /moi',
    !('saison' in d) && !('saisonPassee' in d));
  check('ni division sur les lignes',
    !((await get('/api/rank/supporters')).classement ?? []).some((x) => 'division' in x));
  const x = await post('/api/rank/division', { saison: 13, id: 'habitue' });
  const t = await post('/api/rank/division', { tout: true });
  check('et la réclamation refuse : inactif',
    x.json?.verse === false && x.json?.raison === 'inactif' && t.json?.raison === 'inactif');
  moi = CAPO;
  check('les titres restent', (await get('/api/rank/moi')).titres?.[0]?.nom === 'Capo de la saison 1');
  poserReglages(SEUILS);
  C.oublier();
}

/* ============================================= un schéma qui manque

   Une table absente éteint la fonction, pas la route : `/moi` et les listes
   répondent, sans ce qu'ils ne peuvent pas lire. */
{
  const appliquer = async (...fichiers) => {
    const raw2 = await mysql.createConnection({ uri: DB, multipleStatements: true });
    for (const f of fichiers) await raw2.query(readFileSync(new URL(`../sql/${f}.sql`, import.meta.url), 'utf8'));
    await raw2.end();
  };
  moi = DORA;
  await pool.query('ALTER TABLE user_wallet DROP COLUMN rangs_vus');
  let r = await lire('/api/rank/moi');
  check('sans rangs_vus, /moi répond, sans évolution, saison comprise',
    r.status === 200 && !('evolution' in r.json) && r.json.saison?.id === 13);

  await pool.query('DROP TABLE recompenses');
  r = await lire('/api/rank/moi');
  check('sans grand livre, /moi répond sans saison ni titres',
    r.status === 200 && !('saison' in r.json) && !('titres' in r.json) && r.json.ferveur > 0);
  const x = await post('/api/rank/division', { saison: 13, id: 'habitue' });
  check('et la réclamation refuse : schema', x.status === 200 && x.json?.raison === 'schema');

  await pool.query('ALTER TABLE saisons DROP COLUMN fin_le');
  C.oublier();
  const s = await lire('/api/rank/supporters?periode=saison');
  const t = await lire('/api/rank/supporters?periode=toujours');
  /* Triées par identifiant : deux calculs séparés peuvent ranger autrement
     deux joueurs à égalité, et ce n'est pas ce qu'on éprouve ici. */
  const trier = (l) => [...(l ?? [])].sort((a, b) => (a.public_id < b.public_id ? -1 : 1));
  check('sans fin_le, le classement « saison » répond, sans fenêtre ni division',
    s.status === 200 && memes(trier(s.json.classement), trier(t.json.classement))
    || (console.log('        saison', s.status, (s.json.classement ?? []).length,
      'toujours', (t.json.classement ?? []).length), false));
  r = await lire('/api/rank/moi');
  check('et /moi aussi, sans saison', r.status === 200 && !('saison' in r.json));

  await pool.query('ALTER TABLE user_wallet DROP COLUMN xp');
  C.oublier();
  const sans = (await lire('/api/rank/supporters?periode=toujours')).json.classement ?? [];
  const m = sans.find((y) => y.public_id === MOMO);
  check('sans la colonne xp, les visages restent et le niveau se tait',
    m?.avatar?.age === 'TR32B' && !('niveau' in m));

  /* La base rendue comme on l'a trouvée, pour la suite d'après. */
  await appliquer('niveau', 'quotidien');
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
