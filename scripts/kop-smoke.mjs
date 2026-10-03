/**
 * Test des KOP.
 *
 * Trois choses s'y jouent, et les trois se cassent en silence.
 *
 * **L'appartenance.** « Un seul KOP par club » est une règle d'argent : un
 * joueur inscrit à deux KOP du même club verserait dans les deux, ou dans
 * aucun, selon l'ordre des requêtes. Elle est tenue par une clé unique en base,
 * et ce fichier vérifie que la base la tient vraiment — pas que le code y
 * pense.
 *
 * **Le dépouillement.** Cinq voix au créateur, et il départage. Les bornes s'y
 * cachent : l'égalité exacte, le créateur qui n'a pas voté, le pot qui a fondu
 * entre le vote et la clôture.
 *
 * **La consommation des bonus.** Un bonus de match doit se dépenser une fois
 * par match, pas une fois par entrée dans le virage. Sans ça, quelqu'un qui
 * rafraîchit trois fois brûle trois matchs de bonus, et personne ne comprend
 * où ils sont passés.
 *
 * Et, depuis le chantier serveur de la refonte (`PLAN.md`, § 6.7) :
 *
 *   - **un vote échu ne s'applique qu'une fois**, même lu par dix regards à la
 *     fois (E4) ;
 *   - **la clôture se juge à l'horloge de la base** : le chrono rendu et la
 *     garde du vote (E5) ;
 *   - **un bonus de saison s'éteint avec sa saison** (C6) ;
 *   - **les membres ont un visage et un niveau**, et un compte effacé n'en a
 *     plus (`CONTRATS.md`, § 3) ; sans catalogue, ils n'ont pas de visage du
 *     tout, plutôt qu'un visage « nul » qui dirait « pas de Fanzzy » ;
 *   - **mes KOP portent les couleurs de leur club** (`couleurs`), pour la
 *     bâche de la page, et rien quand elles ne sont pas connues ; **la carte
 *     d'un club sans KOP aussi** (`GET /api/kop/club/:id`) ;
 *   - **le KOP ne vend que ce que le Virage applique** (`SERVEUR.md`,
 *     § 11.3) : « La quête » promettait des écharpes que rien ne verse, et
 *     « Mur de bâches » des contres que le Virage ne connaît pas.
 *
 * La suite tourne aussi sous un autre fuseau que celui de la base. Sous
 * Windows, depuis PowerShell — Git Bash ne transmet pas `TZ` à Node, et la
 * suite tournerait alors à l'heure de Zurich sans le dire :
 *
 *     $env:TZ = 'America/Montreal'; node scripts/kop-smoke.mjs
 *
 * Usage : node scripts/kop-smoke.mjs
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createKop, couleursDuClub, MODS_DU_VIRAGE, EN_VENTE, agit }
  from '../src/server/kop/index.js';
import { BONUS, BONUS_PAR_ID, VOIX_CREATEUR, depouiller, nomValide, DUREE_VOTE_MS }
  from '../src/shared/kop.js';
import { seuil } from '../src/shared/niveau.js';
import { AVATAR_PUBLIC } from '../src/server/fanzzy/avatar.js';
import { charger as chargerCatalogue, oublier as oublierCatalogue }
  from '../src/server/fanzzy/catalogue.js';
import { createStore } from '../src/server/auth/store.js';
import { baseDeTest, OPTIONS_BASE, figerHorloge, enParallele } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/** Le code d'un refus attendu, ou '' si l'appel a réussi. */
async function refus(fn) {
  try { await fn(); return ''; } catch (e) { return e.code ?? e.message; }
}

/* ======================================================= le dépouillement

   Sans base : c'est de l'arithmétique de vote, et c'est là que sont les
   bornes.                                                                   */

const A = 'aaaa'; const B = 'bbbb'; const C = 'cccc'; const D = 'dddd';

check('le créateur pèse cinq voix',
  depouiller([{ userId: A, pour: true }], A).pour === VOIX_CREATEUR);
check('un membre en pèse une',
  depouiller([{ userId: B, pour: true }], A).pour === 1);
check('cinq contre quatre : le créateur l’emporte seul',
  depouiller([{ userId: A, pour: true }, { userId: B, pour: false },
    { userId: C, pour: false }, { userId: D, pour: false }], A).adopte === true);
check('mais pas contre six',
  depouiller([{ userId: A, pour: true },
    ...['b', 'c', 'd', 'e', 'f', 'g'].map((u) => ({ userId: u, pour: false }))], A)
    .adopte === false);
check('à égalité, le bulletin du créateur tranche',
  depouiller([{ userId: A, pour: true },
    ...['b', 'c', 'd', 'e', 'f'].map((u) => ({ userId: u, pour: false }))], A)
    .adopte === true);
check('et s’il a voté contre, l’égalité rejette',
  depouiller([{ userId: A, pour: false },
    ...['b', 'c', 'd', 'e', 'f'].map((u) => ({ userId: u, pour: true }))], A)
    .adopte === false);
check('sans le créateur, une égalité vaut rejet',
  depouiller([{ userId: B, pour: true }, { userId: C, pour: false }], A).adopte === false);
check('personne n’a voté : rien n’est adopté',
  depouiller([], A).adopte === false);

check('un nom vide est refusé', nomValide('  ') === null);
check('un nom trop long aussi', nomValide('x'.repeat(41)) === null);
check('le balisage est refusé', nomValide('<b>KOP</b>') === null);
check('un nom normal est nettoyé', nomValide('  Le   Virage  Nord ') === 'Le Virage Nord');

/* Les couleurs d'un club, telles que la page les pose dans une propriété CSS :
   une teinte qui n'en est pas une ne part pas, la casse est ramenée aux
   minuscules, et deux teintes égales n'en font qu'une. */
const memes = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check('deux teintes partent, en minuscules, la principale d’abord',
  memes(couleursDuClub('#D7141A', '#ffffff'), ['#d7141a', '#ffffff']));
check('une seule si le blason n’en a donné qu’une',
  memes(couleursDuClub('#0047ab', null), ['#0047ab']));
check('la seconde seule si la première est illisible',
  memes(couleursDuClub('rouge', '#0047AB'), ['#0047ab'])
  && memes(couleursDuClub('#12345', '#0047ab'), ['#0047ab'])
  && memes(couleursDuClub('#0047ab;}', null), []));
check('deux teintes égales n’en font qu’une',
  memes(couleursDuClub('#FFFFFF', '#ffffff'), ['#ffffff']));
check('et aucune quand le club n’en a pas', memes(couleursDuClub(null, null), []));

/* ============================================ ce que le Virage applique

   Un bonus de KOP n'arrive qu'au Virage, et le serveur ne vend que ceux dont
   le Virage lit chaque clé (`MODS_DU_VIRAGE`). Cette liste est écrite à la
   main, faute d'être publiée par le Virage : on la confronte donc à son code,
   dans les deux sens. Une lecture, c'est la clé prise sur un objet
   (`mods.pushMult`, `(…).breathBonus ??`), commentaires ôtés : une clé citée
   dans une phrase ne s'applique pas.                                        */

console.log('\n— ce que le Virage applique —');
const codeDuVirage = (() => {
  const dossier = path.join(RACINE, 'src', 'server', 'ferveur');
  return readdirSync(dossier).filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(path.join(dossier, f), 'utf8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    // Une adresse (`http://`) n'ouvre pas un commentaire.
    .replace(/(^|[^:])\/\/.*$/gm, (_, avant) => avant);
})();
const lue = (cle) => new RegExp(`\\.${cle}\\b`).test(codeDuVirage);

const sansLecture = [...MODS_DU_VIRAGE].filter((k) => !lue(k));
check(`le Virage lit encore les ${MODS_DU_VIRAGE.size} clés que le KOP vend`,
  sansLecture.length === 0 || (console.log('        plus lues :', sansLecture.join(', ')), false));
const clesDuCatalogue = new Set(BONUS.flatMap((b) => Object.keys(b.mods ?? {})));
const luesHorsListe = [...clesDuCatalogue].filter((k) => !MODS_DU_VIRAGE.has(k) && lue(k));
check('et aucune autre clé du catalogue (sinon, l’ajouter à MODS_DU_VIRAGE)',
  luesHorsListe.length === 0
  || (console.log('        lues sans être vendues :', luesHorsListe.join(', ')), false));
check(`le KOP vend ${EN_VENTE.length} bonus sur ${BONUS.length}, et chacun agit`,
  EN_VENTE.length > 0 && EN_VENTE.every(agit)
  && BONUS.filter(agit).length === EN_VENTE.length);
check('« La quête » n’est vendue que si le Virage lit scarvesBonus',
  EN_VENTE.some((b) => b.id === 'echarpes') === lue('scarvesBonus'));
check('« Mur de bâches » que s’il lit parryBonus et parryResist',
  EN_VENTE.some((b) => b.id === 'contres') === (lue('parryBonus') && lue('parryResist')));
check('un identifiant inconnu n’agit pas', agit(undefined) === false && agit({ mods: {} }) === false);

/* ============================================================== en base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
/* `saisons` et ce que pose `sql/quotidien.sql` sont vidés aussi : un bonus
   de saison se juge contre les saisons lancées, et une saison laissée là par
   une autre suite changerait ce que ce fichier éprouve. */
await raw.query(`DROP TABLE IF EXISTS parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops,
  user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
  souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
  duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
  leagues, api_quota, login_attempts, auth_tokens, sessions, users,
  saisons, reglages, admin_audit, recompenses, missions_jour, compteurs_jour, user_nouveautes`);
/* `niveau.sql` pour l'XP des membres, `admin.sql` pour `reglages`, que lit la
   reprise de `saisons.sql`, et `quotidien.sql` pour la date de fin d'une
   saison (`saisons.fin_le`). */
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql',
                 'inventaire.sql', 'skins.sql', 'etats.sql', 'stades.sql', 'kop.sql', 'niveau.sql',
                 'admin.sql', 'saisons.sql', 'quotidien.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

/* Le cinquième n'est membre de rien : c'est le curieux qui lit la page d'un
   KOP où il n'est pas. */
const U = ['1', '2', '3', '4', '5'].map((i) => `kkkkkkkk-0000-0000-0000-00000000000${i}`);
for (const [i, id] of U.entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `k${i}@ex.fr`, `Kopiste${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves) VALUES (?,0)`, [id]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle')`);
// Tout le monde suit Sion ; seul le premier suit aussi Bâle.
for (const id of U) {
  await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)`, [id]);
}
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,91,0)`, [U[0]]);

/* Des visages et des niveaux qui se distinguent. Le premier et le troisième
   jouent le Choriste, au premier âge ; le deuxième n'a pas de Fanzzy. Le
   premier est niveau 7 (cinq points au-dessus du seuil, pour qu'un niveau
   compté au seuil près se voie), le troisième au niveau maximum. */
for (const id of [U[0], U[2]]) {
  await raw.query(`UPDATE user_wallet SET active_fanzzy = 'TR32' WHERE user_id = ?`, [id]);
  await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies,stage) VALUES (?,'TR32',1,1)`,
    [id]);
}
await raw.query(`UPDATE user_wallet SET xp = ? WHERE user_id = ?`, [seuil(7) + 5, U[0]]);
await raw.query(`UPDATE user_wallet SET xp = ? WHERE user_id = ?`, [seuil(30) + 100, U[2]]);
await raw.query(`UPDATE user_wallet SET xp = ? WHERE user_id = ?`, [seuil(3), U[4]]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
/* Le catalogue : sans lui, on ne sait pas dessiner un Fanzzy, et les membres
   seraient servis sans avatar. Chargé comme le fait server.js. */
await chargerCatalogue(pool);
const K = createKop({ pool, requireAuth: (r, _s, n) => n() });

/* ----------------------------------------------------- créer, rejoindre */

const kop = await K.creer(U[0], 85, 'Le Virage Nord');
check('un KOP se crée', Boolean(kop.id) && kop.nom === 'Le Virage Nord');

try {
  await K.creer(U[0], 91, 'Bâle aussi');
  check('un second KOP pour un autre club est permis', true);
} catch { check('un second KOP pour un autre club est permis', false); }

/* La règle qui protège l'argent : un seul KOP par club. Elle est tenue par la
   clé unique de la base, et c'est bien elle qu'on éprouve ici — pas la
   vérification du code, qui pourrait céder sur deux requêtes simultanées. */
try {
  await K.creer(U[0], 85, 'Un deuxième pour Sion');
  check('un second KOP pour le même club est refusé', false);
} catch (e) {
  check('un second KOP pour le même club est refusé', e.code === 'kop.error.deja_membre');
}

try {
  await K.creer(U[1], 60, 'Un club que je ne suis pas');
  check('on ne crée pas le KOP d’un club qu’on ne suit pas', false);
} catch (e) {
  check('on ne crée pas le KOP d’un club qu’on ne suit pas',
    e.code === 'kop.error.pas_ton_club');
}

for (const u of [U[1], U[2], U[3]]) await K.rejoindre(u, kop.id);
let etat = await K.etat(kop.id, U[0]);
check('les quatre sont membres', etat.membres.length === 4);
check('le créateur est marqué',
  etat.membres.find((m) => m.id === U[0])?.createur === true && etat.jeSuisCreateur);

/* ------------------------------------------------- les couleurs du club

   La page du KOP peint sa bâche, son écharpe et son pot aux couleurs du club
   que `GET /api/kop/miens` lui sert (`couleurs`), et retombe sur le violet
   des gens quand le champ manque. Le premier joueur a deux KOP : Sion, dont
   on connaît le blason (en majuscules, comme une saisie à la main), et Bâle,
   dont on ne sait rien encore. Lu par la vraie route, pour que le nom du
   champ soit éprouvé là où la page le lit.

   La carte d'un club suivi **sans** KOP — l'état de la plupart des joueurs —
   porte la même bâche, et la page lit ses couleurs sur
   `GET /api/kop/club/:id`, à la racine de la réponse. Lugano en est le cas :
   un blason connu et aucun KOP, donc aucune ligne dans `kops` d'où joindre
   `teams`. C'est précisément le cas qu'une jointure depuis `kops` aurait
   manqué.                                                                   */

console.log('\n— les couleurs du club —');
{
  await pool.query(`UPDATE teams SET color1 = '#D7141A', color2 = '#FFFFFF' WHERE id = 85`);
  await pool.query(`INSERT INTO teams (id,name,color1,color2) VALUES (87,'Lugano','#000000','#FFFFFF')`);

  const app = express();
  app.use((req, _res, next) => { req.user = { id: U[0] }; next(); });
  app.use('/api/kop', K.router);
  const serveur = app.listen(0);
  await new Promise((ok) => serveur.once('listening', ok));
  const lireMiens = async () => {
    const r = await fetch(`http://127.0.0.1:${serveur.address().port}/api/kop/miens`);
    return r.ok ? (await r.json()).kops : { statut: r.status, corps: await r.text() };
  };
  const lireClub = async (id) => {
    const r = await fetch(`http://127.0.0.1:${serveur.address().port}/api/kop/club/${id}`);
    return r.ok ? r.json() : { statut: r.status, corps: await r.text() };
  };
  /* Rien d'autre que `kops` et `couleurs` : ni les colonnes de travail, ni
     un champ vide (R1). */
  const horsForme = (j) => Object.keys(j ?? {}).filter((c) => c !== 'kops' && c !== 'couleurs');

  try {
    let kops = await lireMiens();
    const sion = Array.isArray(kops) ? kops.find((k) => k.team_id === 85) : null;
    const bale = Array.isArray(kops) ? kops.find((k) => k.team_id === 91) : null;
    check('le KOP de Sion porte les deux couleurs du club, en minuscules',
      memes(sion?.couleurs, ['#d7141a', '#ffffff'])
      || (console.log('        il porte :', JSON.stringify(sion ?? kops)), false));
    check('celui de Bâle, sans couleur connue, n’a pas de champ couleurs',
      (Boolean(bale) && !('couleurs' in bale))
      || (console.log('        il porte :', JSON.stringify(bale ?? kops)), false));
    const enTrop = (Array.isArray(kops) ? kops : [])
      .flatMap((k) => Object.keys(k).filter((c) => /^(couleur[12]|color[12])$/.test(c)));
    check('les colonnes de travail ne partent pas dans la réponse',
      enTrop.length === 0 || (console.log('        en trop :', enTrop.join(',')), false));

    let club = await lireClub(87);
    check('un club sans KOP sert ses couleurs, à la racine, en minuscules',
      (memes(club?.kops, []) && memes(club?.couleurs, ['#000000', '#ffffff'])
        && horsForme(club).length === 0)
      || (console.log('        elle répond :', JSON.stringify(club)), false));
    club = await lireClub(85);
    check('un club qui a un KOP aussi, les mêmes que sur /miens',
      (club?.kops?.length === 1 && memes(club?.couleurs, ['#d7141a', '#ffffff'])
        && memes(club?.couleurs, sion?.couleurs) && horsForme(club).length === 0)
      || (console.log('        elle répond :', JSON.stringify(club)), false));
    club = await lireClub(91);
    check('un club sans couleur connue n’a pas de champ couleurs',
      (club?.kops?.length === 1 && !('couleurs' in club) && horsForme(club).length === 0)
      || (console.log('        elle répond :', JSON.stringify(club)), false));
    club = await lireClub(4242);
    check('un club inconnu non plus, et la liste reste vide',
      memes(club, { kops: [] }) || (console.log('        elle répond :', JSON.stringify(club)), false));

    /* Une colonne de sept caractères accepte ce qu'on y pose : une valeur qui
       n'est pas une teinte ne part pas, l'autre reste. */
    await pool.query(`UPDATE teams SET color1 = 'rouge', color2 = '#0047AB' WHERE id = 91`);
    kops = await lireMiens();
    check('une teinte illisible ne part pas, la lisible reste',
      memes(kops?.find?.((k) => k.team_id === 91)?.couleurs, ['#0047ab'])
      || (console.log('        il porte :', JSON.stringify(kops)), false));

    /* Sans `sql/couleurs.sql`, la page du KOP se lit encore : sans couleurs,
       pas sans KOP. */
    await pool.query('ALTER TABLE teams DROP COLUMN color2');
    kops = await lireMiens();
    check('sans les colonnes de couleur, mes KOP se lisent quand même',
      (Array.isArray(kops) && kops.length === 2 && kops.every((k) => !('couleurs' in k)))
      || (console.log('        elle répond :', JSON.stringify(kops)), false));
    const [clubSans, clubAvec] = [await lireClub(87), await lireClub(85)];
    check('et la carte d’un club aussi, sans couleurs mais avec ses KOP',
      (memes(clubSans, { kops: [] }) && clubAvec?.kops?.length === 1 && !('couleurs' in clubAvec))
      || (console.log('        elle répond :', JSON.stringify([clubSans, clubAvec])), false));
    await pool.query('ALTER TABLE teams ADD COLUMN IF NOT EXISTS color2 CHAR(7) NULL AFTER color1');
    await pool.query(`UPDATE teams SET color1 = NULL, color2 = NULL WHERE id = 91`);
    await pool.query(`DELETE FROM teams WHERE id = 87`);
  } finally {
    await new Promise((ok) => serveur.close(ok));
  }
}

/* -------------------------------------------------------------- le pot */

let r = await K.verser(U[1], 85, 60);
check('un versement remplit le pot', r.verse === 60 && r.kopId === kop.id);
await K.verser(U[2], 85, 40);
etat = await K.etat(kop.id, U[0]);
check('le pot cumule', etat.pot === 100 && etat.verseTotal === 100);
check('et chacun sait ce qu’il a versé',
  etat.membres.find((m) => m.id === U[1])?.verse === 60);

// Sans KOP pour ce club, les écharpes sont perdues — et ça se dit.
r = await K.verser(U[1], 91, 50);
check('sans KOP, la part est perdue et signalée', r.verse === 0 && r.sansKop === true);

/* ------------------------------------------------- ce qui est versé est versé

   Quitter ne rend rien. Sans cette règle, on entrerait la veille du match, on
   voterait, et on repartirait avec sa part.                                  */

await K.quitter(U[3], kop.id);
etat = await K.etat(kop.id, U[0]);
check('quitter retire du KOP', etat.membres.length === 3);
check('mais ne vide pas le pot', etat.pot === 100);
await K.rejoindre(U[3], kop.id);

/* ------------------------------------------------------------- le vote */

const CORDE = BONUS_PAR_ID.get('corde');
try {
  await K.proposer(U[1], kop.id, 'corde');
  check('un vote demande un pot suffisant', false);
} catch (e) {
  check('un vote demande un pot suffisant', e.code === 'kop.error.pot_insuffisant');
}

await pool.query('UPDATE kops SET pot = ? WHERE id = ?', [CORDE.prix + 100, kop.id]);
const vote = await K.proposer(U[1], kop.id, 'corde');
check('un vote s’ouvre', Boolean(vote.id) && vote.prix === CORDE.prix);
check('et il est court', vote.fermeDansMs === DUREE_VOTE_MS);

etat = await K.etat(kop.id, U[1]);
check('celui qui propose a voté pour d’office', etat.vote?.monBulletin === 1);
check('le décompte est visible en direct', etat.vote?.pour === 1 && etat.vote?.contre === 0);

try {
  await K.proposer(U[2], kop.id, 'souffle');
  check('un seul vote à la fois', false);
} catch (e) { check('un seul vote à la fois', e.code === 'kop.error.vote_en_cours'); }

await K.voter(U[2], vote.id, false);
await K.voter(U[3], vote.id, false);
etat = await K.etat(kop.id, U[0]);
check('les membres pèsent une voix chacun', etat.vote.pour === 1 && etat.vote.contre === 2);

// Le créateur arrive : cinq voix contre deux.
await K.voter(U[0], vote.id, true);
etat = await K.etat(kop.id, U[0]);
check('le créateur renverse le vote à lui seul',
  etat.vote.pour === VOIX_CREATEUR + 1 && etat.vote.adopte === true);

// On change d'avis tant que c'est ouvert : trois minutes, c'est la durée d'une
// discussion.
await K.voter(U[0], vote.id, false);
etat = await K.etat(kop.id, U[0]);
check('on peut changer d’avis', etat.vote.adopte === false);
await K.voter(U[0], vote.id, true);

/* ---------------------------------------------------- la clôture

   Le dépouillement se fait à la lecture. On force donc l'échéance dans le
   passé plutôt que d'attendre trois minutes : c'est la même porte.          */

await pool.query('UPDATE kop_votes SET ferme = NOW(3) - INTERVAL 1 SECOND WHERE id = ?',
  [vote.id]);
const faits = await K.depouillerEchus(kop.id);
check('le vote se dépouille au premier regard qui suit l’échéance',
  faits.length === 1 && faits[0].issue === 'adopte');

etat = await K.etat(kop.id, U[0]);
check('le pot est débité du prix', etat.pot === 100);
check('le bonus est actif', etat.bonus.length === 1 && etat.bonus[0].bonusId === 'corde');
check('et le vote n’est plus en cours', etat.vote === null);

try {
  await K.voter(U[2], vote.id, true);
  check('on ne vote plus après la clôture', false);
} catch (e) { check('on ne vote plus après la clôture', e.code === 'kop.error.vote_clos'); }

/* ------------------------------------------------- le bonus dans le virage */

let mods = await K.modsDe(U[1], 85);
check('le bonus arrive en modificateurs du moteur',
  mods.pushMult === CORDE.mods.pushMult && mods.kopNom === 'Le Virage Nord');
check('et il nomme le KOP qui l’offre', mods.kopId === kop.id);

check('un joueur sans KOP pour ce club n’a aucun bonus',
  Object.keys(await K.modsDe(U[2], 91)).length === 0);

/* La borne qui coûte cher : un bonus de match se consomme **une fois par
   match**. Trois entrées dans le virage du même match n'en brûlent qu'un. */
await K.modsDe(U[1], 85, 7001);
await K.modsDe(U[1], 85, 7001);
await K.modsDe(U[2], 85, 7001);
etat = await K.etat(kop.id, U[0]);
check('trois entrées dans le même match ne brûlent qu’un bonus',
  etat.bonus.length === 0);
check('et il est bien épuisé, pas supprimé',
  (await pool.query('SELECT COUNT(*) n FROM kop_bonus WHERE kop_id = ?',
    [kop.id]))[0][0].n === 1);

/* L'instant de l'épuisement suit l'horloge de la base, comme `achete` à côté.
   Un `Date` de Node passé au pool l'écrivait en UTC : deux heures avant
   l'heure de la base à Zurich, ce que l'écart lu ici montrerait. */
{
  const [[e]] = await pool.query(
    `SELECT TIMESTAMPDIFF(SECOND, epuise, NOW(3)) AS d FROM kop_bonus WHERE kop_id = ?`,
    [kop.id]);
  check('l’épuisement est daté à l’heure de la base',
    (e?.d !== null && Number(e?.d) >= 0 && Number(e?.d) < 60)
    || (console.log('        écart en secondes :', e?.d), false));
}

mods = await K.modsDe(U[1], 85);
check('épuisé, il n’apporte plus rien', mods.pushMult === undefined);

/* ------------------------------------ un pot qui fond avant la clôture

   Deux votes ne peuvent pas coexister, mais un achat peut vider le pot entre
   l'ouverture d'un vote et son dépouillement — un versement annulé, une
   correction d'administration. On rejette alors plutôt que de creuser un pot
   négatif, et on le dit autrement qu'un rejet ordinaire.                    */

await pool.query('UPDATE kops SET pot = ? WHERE id = ?', [CORDE.prix, kop.id]);
const v2 = await K.proposer(U[0], kop.id, 'corde');
await pool.query('UPDATE kops SET pot = 0 WHERE id = ?', [kop.id]);
await pool.query('UPDATE kop_votes SET ferme = NOW(3) - INTERVAL 1 SECOND WHERE id = ?',
  [v2.id]);
const faits2 = await K.depouillerEchus(kop.id);
check('un vote adopté sur un pot vide est rejeté',
  faits2[0].issue === 'rejete' && faits2[0].potInsuffisant === true);
check('et le pot ne devient jamais négatif',
  (await K.etat(kop.id, U[0])).pot === 0);

/* ========================================= le KOP ne vend que ce qui agit

   « La quête » promettait 25 % d'écharpes en plus que rien ne verse, et
   « Mur de bâches » des contres que le Virage ne connaît pas : un KOP qui les
   votait perdait 900 ou 500 écharpes pour rien (`SERVEUR.md`, § 11.3). Le
   serveur ne les sert plus au catalogue — la page en tire la liste des
   dépenses **et** les crans du pot —, refuse de les mettre aux voix, ne paie
   pas un vote ouvert avant de cesser de les vendre, et ne compte pas parmi
   les bonus actifs une ligne achetée avant. Si le Virage branche un jour
   leurs clés, ils reviennent en vente, et ces contrôles se taisent.        */

console.log('\n— ce qui est en vente —');
{
  const ids = (liste) => (Array.isArray(liste) ? liste.map((b) => b.id).sort().join(',') : '?');
  const app = express();
  app.use((req, _res, next) => { req.user = { id: U[0] }; next(); });
  app.use('/api/kop', K.router);
  const serveur = app.listen(0);
  await new Promise((ok) => serveur.once('listening', ok));
  const lire = async (chemin) => {
    const r = await fetch(`http://127.0.0.1:${serveur.address().port}/api/kop${chemin}`);
    return r.ok ? r.json() : { statut: r.status };
  };
  try {
    const mes = await lire('/miens');
    check('la page lit un catalogue où chaque bonus agit',
      (ids(mes.catalogue) === ids(EN_VENTE) && mes.catalogue.every(agit))
      || (console.log('        elle lit :', ids(mes.catalogue)), false));
    const sien = await lire(`/${kop.id}`);
    check('et l’état d’un KOP sert le même',
      ids(sien.catalogue) === ids(EN_VENTE) || (console.log('        il sert :', ids(sien.catalogue)), false));
  } finally {
    await new Promise((ok) => serveur.close(ok));
  }

  const HORS = BONUS.filter((b) => !agit(b));
  const Q = HORS.find((b) => b.id === 'echarpes') ?? HORS[0] ?? null;
  if (!Q) console.log('  (tout le catalogue agit : il n’y a plus de bonus hors vente à refuser)');

  if (Q) {
    await pool.query('UPDATE kops SET pot = ? WHERE id = ?', [Q.prix * 2, kop.id]);
    const code = await refus(() => K.proposer(U[0], kop.id, Q.id));
    check(`« ${Q.nom} » ne se met pas aux voix, même avec le pot pour`,
      code === 'kop.error.bonus_inconnu' || (console.log('        il répond :', code || 'accepté'), false));
    const [[{ n }]] = await pool.query(
      'SELECT COUNT(*) n FROM kop_votes WHERE kop_id = ? AND bonus_id = ?', [kop.id, Q.id]);
    check('et aucun vote ne s’est ouvert', n === 0);
  }

  /* Un vote ouvert avant (le déploiement tombe pendant ses trois minutes), et
     un identifiant que le catalogue partagé ne connaît plus : adoptés par le
     créateur, échus, sur un pot qui les couvre. Le pot ne paie ni l'un ni
     l'autre — et le second faisait tomber toute lecture du KOP. */
  for (const bonusId of [...(Q ? [Q.id] : []), 'disparu']) {
    await pool.query('UPDATE kops SET pot = 5000 WHERE id = ?', [kop.id]);
    const id = randomUUID();
    await pool.query(
      `INSERT INTO kop_votes (id, kop_id, bonus_id, prix, ouvert_par, ferme)
       VALUES (?, ?, ?, 900, ?, NOW(3) - INTERVAL 1 SECOND)`, [id, kop.id, bonusId, U[0]]);
    await pool.query('INSERT INTO kop_bulletins (vote_id, user_id, pour) VALUES (?, ?, 1)',
      [id, U[0]]);
    let fait = null;
    let erreur = '';
    try {
      fait = (await K.depouillerEchus(kop.id)).find((f) => f.id === id) ?? null;
    } catch (e) { erreur = e.message; }
    check(`un vote adopté sur « ${bonusId} », hors vente, est rejeté et dit pourquoi`,
      (fait?.issue === 'rejete' && fait.horsVente === true && fait.potInsuffisant === false)
      || (console.log('        il rend :', erreur || JSON.stringify(fait)), false));
    const [[{ pot }]] = await pool.query('SELECT pot FROM kops WHERE id = ?', [kop.id]);
    const [[{ n }]] = await pool.query(
      'SELECT COUNT(*) n FROM kop_bonus WHERE kop_id = ? AND bonus_id = ?', [kop.id, bonusId]);
    check('sans débiter le pot ni inscrire de bonus', (pot === 5000 && n === 0)
      || (console.log('        pot :', pot, '· lignes :', n), false));
  }

  /* Acheté avant que le serveur cesse de le vendre : il n'agit pas, il ne
     s'affiche donc pas comme actif, ni dans la page ni dans le panneau du
     Virage, et il ne se décompte pas — si sa clé est branchée un jour, il
     agira pour les matchs qu'il avait encore. */
  if (Q) {
    const restant = Q.portee === 'charges' ? (Q.charges ?? 3) : Q.portee === 'match' ? 1 : null;
    await pool.query(
      `INSERT INTO kop_bonus (id, kop_id, bonus_id, portee, restant) VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), kop.id, Q.id, Q.portee, restant]);
    check('acheté avant, il ne s’affiche pas parmi les bonus actifs',
      !(await K.etat(kop.id, U[0])).bonus.some((b) => b.bonusId === Q.id));
    const m = await K.modsDe(U[1], 85, 7101);
    check('le Virage ne le reçoit pas',
      (Object.keys(Q.mods).every((k) => !(k in m)) && !(m.kopBonus ?? []).includes(Q.id))
      || (console.log('        il reçoit :', JSON.stringify(m)), false));
    const [[b]] = await pool.query(
      'SELECT restant, fixture_id FROM kop_bonus WHERE kop_id = ? AND bonus_id = ?', [kop.id, Q.id]);
    check('et il ne se décompte pas : ses matchs restent',
      (b?.restant === restant && b?.fixture_id === null)
      || (console.log('        ligne :', JSON.stringify(b)), false));
  }
}

/* ============================================== la clôture se juge en base

   `ferme` est écrit par `NOW(3)`, à l'heure de la session MySQL. Relu par le
   pilote, qui lit en UTC, il partait deux heures dans le futur sur une base à
   l'heure de Zurich : le chrono affiché après un rechargement durait deux
   heures et trois minutes, et la garde de `voter()` laissait voter pendant
   ces deux heures. C'est le décalage de la base sur UTC qui rend la faute
   visible : sur une base réglée en UTC, ces contrôles ne pourraient pas
   rougir, et la suite le dit plutôt que de passer au vert sans rien
   prouver.                                                                  */

console.log('\n— la clôture du vote —');
{
  const [[{ d }]] = await pool.query(
    'SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW()) AS d');
  if (Number(d) === 0) {
    console.log('  (base réglée en UTC : les contrôles de clôture ne peuvent pas rougir ici)');
  }
}
await pool.query('UPDATE kops SET pot = ? WHERE id = ?', [CORDE.prix * 10, kop.id]);
const v3 = await K.proposer(U[1], kop.id, 'corde');
{
  const ms = (await K.etat(kop.id, U[1])).vote?.fermeDansMs;
  check('relu juste après l’ouverture, le chrono dit trois minutes, pas plus',
    (Number.isInteger(ms) && ms > 170_000 && ms <= 180_000)
    || (console.log('        il dit :', ms), false));
}

/* L'échéance est passée et personne n'a encore regardé : le vote est
   toujours « en cours » en base. C'est exactement la fenêtre où l'ancienne
   garde laissait voter. */
await pool.query('UPDATE kop_votes SET ferme = NOW(3) - INTERVAL 1 SECOND WHERE id = ?', [v3.id]);
{
  const code = await refus(() => K.voter(U[2], v3.id, false));
  check('un vote échu, même pas encore dépouillé, refuse les bulletins',
    code === 'kop.error.vote_clos' || (console.log('        il répond :', code || 'accepté'), false));
  const [[{ n }]] = await pool.query(
    'SELECT COUNT(*) n FROM kop_bulletins WHERE vote_id = ? AND user_id = ?', [v3.id, U[2]]);
  check('et rien ne s’est écrit', n === 0);
}

/* ================================================== un seul dépouillement

   Le vote ci-dessus est échu et adopté (une voix pour, aucune contre), et le
   pot couvre dix fois son prix : un dépouillement appliqué deux fois se
   verrait à l'écharpe près. Dix regards à la fois — cinq pages du KOP, cinq
   entrées au Virage — comme au coup d'envoi. Le pot était débité autant de
   fois qu'il y avait de regards, avec autant de lignes de bonus.            */

console.log('\n— dix regards sur un vote échu —');
{
  const emis = [];
  const fauxIo = { on() {}, to: (salle) => ({ emit: (ev, data) => emis.push({ salle, ev, data }) }) };
  const Kio = createKop({ pool, requireAuth: (r, _s, n) => n(), io: fauxIo });
  const compter = async () => (await pool.query(
    'SELECT COUNT(*) n FROM kop_bonus WHERE kop_id = ?', [kop.id]))[0][0].n;
  const avant = await compter();

  let erreur = null;
  try {
    await enParallele(10, (i) => (i % 2
      ? Kio.etat(kop.id, U[i % 4])
      : Kio.modsDe(U[1 + (i % 3)], 85)));
  } catch (e) { erreur = e; }
  check('les dix lectures passent',
    erreur === null || (console.log('        ', erreur?.code, erreur?.message), false));

  const [[k]] = await pool.query('SELECT pot FROM kops WHERE id = ?', [kop.id]);
  check('le pot n’est débité qu’une fois',
    k.pot === CORDE.prix * 9 || (console.log('        pot :', k.pot, '· attendu', CORDE.prix * 9), false));
  const apres = await compter();
  check('une seule ligne de bonus est inscrite',
    apres - avant === 1 || (console.log('        lignes :', apres - avant), false));
  const [[v]] = await pool.query('SELECT issue FROM kop_votes WHERE id = ?', [v3.id]);
  check('le vote est adopté', v.issue === 'adopte');
  const annonces = emis.filter((x) => x.ev === 'kop:votes');
  check('et annoncé une seule fois aux membres',
    (annonces.length === 1 && annonces[0].data.length === 1
      && annonces[0].salle === `kop:${kop.id}`)
    || (console.log('        annonces :', annonces.length), false));
}

/* ====================================== un bonus de saison finit avec elle

   « Le virage debout » promet d'agir jusqu'à la fin de la saison, et rien ne
   l'éteignait : une saison n'avait pas de fin. Il agit désormais tant que la
   saison pendant laquelle il a été acheté court encore — jusqu'à la fin de
   son jour `fin_le`, ou jusqu'au lancement de la suivante.

   L'horloge de la base est figée : le dernier jour se joue à la seconde, et
   c'est le serveur lui-même qui date l'achat, par le vrai chemin d'un vote.
   Les saisons sont semées en heure murale de la base, comme
   l'administration les écrit par `NOW(3)`.                                  */

console.log('\n— le bonus de saison —');
{
  const SAISON = BONUS_PAR_ID.get('saison');
  const [[{ id: bale }]] = await pool.query('SELECT id FROM kops WHERE team_id = 91');
  await pool.query('UPDATE kops SET pot = ? WHERE id = ?', [SAISON.prix * 4, bale]);

  await pool.query('DELETE FROM saisons');
  await pool.query(`INSERT INTO saisons (numero, nom, series, tenues, lancee_a, fin_le)
    VALUES (1, 'La reprise', JSON_ARRAY(), JSON_ARRAY(), '2026-10-01 12:00:00', '2026-11-10')`);

  /* Le contrôle du contrôle : l'horloge figée l'est sur deux connexions
     différentes du pool, pas seulement sur celle qui a posé la valeur. */
  await figerHorloge(pool, '2026-10-05 10:00:00');
  {
    const c1 = await pool.getConnection();
    const c2 = await pool.getConnection();
    const heure = async (c) =>
      (await c.query(`SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS t`))[0][0].t;
    const [t1, t2] = [await heure(c1), await heure(c2)];
    c1.release(); c2.release();
    check('l’horloge de la base est figée sur deux connexions',
      (t1 === '2026-10-05 10:00:00' && t2 === t1) || (console.log('        elles disent :', t1, t2), false));
  }

  const acheter = async (instant) => {
    await figerHorloge(pool, instant);
    const v = await K.proposer(U[0], bale, 'saison');
    await pool.query('UPDATE kop_votes SET ferme = NOW(3) - INTERVAL 1 SECOND WHERE id = ?', [v.id]);
    return (await K.depouillerEchus(bale))[0]?.issue;
  };
  const agit = async (instant) => {
    await figerHorloge(pool, instant);
    return (await K.modsDe(U[0], 91)).breathBonus === SAISON.mods.breathBonus;
  };
  const affiches = async () =>
    (await K.etat(bale, U[0])).bonus.filter((b) => b.bonusId === 'saison').length;

  check('le bonus de saison s’achète le 5 octobre', await acheter('2026-10-05 10:00:00') === 'adopte');
  const [[b]] = await pool.query(
    `SELECT DATE_FORMAT(achete, '%Y-%m-%d %H:%i:%s') AS a FROM kop_bonus
      WHERE kop_id = ? AND bonus_id = 'saison'`, [bale]);
  check('daté par l’horloge de la base', b?.a === '2026-10-05 10:00:00'
    || (console.log('        acheté le :', b?.a), false));

  check('il agit pendant la saison', await agit('2026-10-20 12:00:00'));
  check('jusqu’à la dernière seconde de son dernier jour', await agit('2026-11-10 23:59:59'));
  check('et plus le lendemain de sa fin', !(await agit('2026-11-11 00:00:01')));
  check('la page du KOP ne le compte plus parmi les bonus actifs', await affiches() === 0);

  /* Acheté avant le lancement de la saison en cours : il appartenait à une
     autre. La borne se joue à l'instant près. */
  await pool.query(`UPDATE saisons SET lancee_a = '2026-10-05 10:00:00.001', fin_le = NULL`);
  check('un bonus acheté avant le lancement de la saison en cours n’agit pas',
    !(await agit('2026-10-20 12:00:00')));
  await pool.query(`UPDATE saisons SET lancee_a = '2026-10-05 10:00:00'`);
  check('acheté à l’instant du lancement, il agit', await agit('2026-10-20 12:00:00'));

  /* La saison suivante lancée, sans qu'aucune date de fin n'ait été saisie :
     la fenêtre de la première s'arrête au lancement de la seconde. */
  await pool.query(`INSERT INTO saisons (numero, nom, series, tenues, lancee_a)
    VALUES (2, 'La trêve', JSON_ARRAY(), JSON_ARRAY(), '2026-10-15 12:00:00')`);
  check('le lancement de la saison suivante éteint le bonus de la précédente',
    !(await agit('2026-10-20 12:00:00')));
  check('un bonus acheté sous la nouvelle saison agit',
    await acheter('2026-10-20 12:00:00') === 'adopte' && await agit('2026-10-20 12:30:00'));
  await pool.query(`INSERT INTO saisons (numero, nom, series, tenues)
    VALUES (3, 'Le printemps', JSON_ARRAY(), JSON_ARRAY())`);
  check('une saison en brouillon n’éteint rien', await agit('2026-10-20 12:30:00'));
  check('la page du KOP montre le seul bonus de la saison qui court', await affiches() === 1);

  /* Les replis : sur une base où sql/quotidien.sql n'est pas passé, sans
     saison lancée, ou sans la table des saisons, les bonus de saison agissent
     comme avant. Un bonus qui ne s'éteint pas vaut mieux qu'un Virage où l'on
     n'entre plus. */
  await pool.query('ALTER TABLE saisons DROP COLUMN fin_le');
  check('sans la colonne fin_le, les deux bonus agissent comme avant', await affiches() === 2);
  check('et le Virage les reçoit', await agit('2026-10-20 12:30:00'));
  await pool.query('ALTER TABLE saisons ADD COLUMN IF NOT EXISTS fin_le DATE NULL');
  await pool.query('UPDATE saisons SET lancee_a = NULL');
  check('sans aucune saison lancée, ils agissent aussi', await affiches() === 2);
  await pool.query('RENAME TABLE saisons TO saisons_cachees');
  check('et sans la table des saisons, la page du KOP se lit', await affiches() === 2);
  await pool.query('RENAME TABLE saisons_cachees TO saisons');
  await figerHorloge(pool, null);
  /* Les saisons de ce banc ne restent pas derrière lui : une table vide est
     l'état d'une base neuve, que la suite suivante sait reprendre. */
  await pool.query('DELETE FROM saisons');
}

/* ==================================================== les visages des membres

   La tribune de la page du KOP montre chaque membre par son personnage et
   son niveau (`CONTRATS.md`, § 3), en liste blanche : ce qu'un classement
   montre déjà, rien de plus. La page se lit par tout compte connecté, membre
   ou non ; elle ne dit donc rien de plus à l'un qu'à l'autre.               */

console.log('\n— les visages des membres —');
{
  // Une instance neuve : sa mémoire des visages est vide.
  const Kv = createKop({ pool, requireAuth: (r, _s, n) => n() });
  const e = await Kv.etat(kop.id, U[0]);
  const par = new Map(e.membres.map((m) => [m.id, m]));
  const premier = par.get(U[0]);
  check('un membre porte son Fanzzy et son niveau',
    (premier?.avatar?.id === 'TR32' && premier?.avatar?.age === 'TR32'
      && premier?.avatar?.evo === 1 && premier?.niveau === 7)
    || (console.log('        il porte :', JSON.stringify(premier)), false));
  check('l’avatar ne porte que sa liste blanche',
    Object.keys(premier?.avatar ?? {}).sort().join(',') === [...AVATAR_PUBLIC].sort().join(',')
    || (console.log('        clés :', Object.keys(premier?.avatar ?? {}).join(',')), false));
  check('un membre sans Fanzzy a un avatar nul, et son niveau',
    (par.get(U[1])?.avatar === null && par.get(U[1])?.niveau === 1)
    || (console.log('        il porte :', JSON.stringify(par.get(U[1]))), false));
  check('le niveau s’arrête au maximum', par.get(U[2])?.niveau === 30);

  const CLES = new Set(['id', 'pseudo', 'verse', 'depuis', 'createur', 'avatar', 'niveau']);
  const vu = await Kv.etat(kop.id, U[4]);
  const enTrop = vu.membres.flatMap((m) => Object.keys(m).filter((c) => !CLES.has(c)));
  check('un non-membre lit la tribune sans aucun champ de plus',
    (vu.membres.length === e.membres.length && enTrop.length === 0 && vu.jeSuisCreateur === false)
    || (console.log('        en trop :', enTrop.join(',')), false));

  /* La mémoire d'une minute. La page relit l'état toutes les trente
     secondes, pour chaque membre qui la regarde : sans elle, chaque relecture
     coûterait trois requêtes de plus. On compte la lecture des âges
     atteints, que fait l'habillage dès qu'un membre a un Fanzzy. */
  let lectures = 0;
  const comptant = {
    execute: (sql, p) => { if (/FROM user_fanzzy/.test(sql)) lectures += 1; return pool.execute(sql, p); },
    query: (...a) => pool.query(...a),
    getConnection: () => pool.getConnection(),
  };
  const Kc = createKop({ pool: comptant, requireAuth: (r, _s, n) => n() });
  await Kc.etat(kop.id, U[0]);
  await Kc.etat(kop.id, U[1]);
  check('deux relectures de la page n’habillent les membres qu’une fois',
    lectures === 1 || (console.log('        habillages :', lectures), false));
  await Kc.rejoindre(U[4], kop.id);
  const arrive = (await Kc.etat(kop.id, U[4])).membres.find((m) => m.id === U[4]);
  check('un arrivant a son visage tout de suite, sans attendre la minute',
    (lectures === 2 && arrive?.niveau === 3)
    || (console.log('        habillages :', lectures, '· il porte :', JSON.stringify(arrive)), false));
  await Kc.quitter(U[4], kop.id);

  /* Un compte supprimé par la vraie fonction, qui anonymise sans effacer :
     sa ligne de membre reste — son versement au pot a eu lieu — mais son
     personnage ne doit jamais réapparaître. */
  check('avant la suppression, le troisième avait un visage', par.get(U[2])?.avatar?.id === 'TR32');
  const [[{ id: interne }]] = await pool.query('SELECT id FROM users WHERE public_id = ?', [U[2]]);
  await createStore(pool).deleteUser(interne);
  const Kd = createKop({ pool, requireAuth: (r, _s, n) => n() });
  const apres = await Kd.etat(kop.id, U[0]);
  const efface = apres.membres.find((m) => m.id === U[2]);
  check('un membre au compte supprimé garde sa ligne',
    apres.membres.length === e.membres.length && Boolean(efface));
  check('mais plus son personnage, ni son niveau',
    (efface?.avatar === null && !('niveau' in (efface ?? {})))
    || (console.log('        il porte :', JSON.stringify(efface)), false));

  /* Sans catalogue — une suite qui monte le module sans lui, un démarrage où
     il n'a pas pu se charger —, on ne sait pas dessiner un Fanzzy : l'avatar
     est alors **absent**, pas nul. Nul dirait « pas de Fanzzy » d'un joueur
     qui en a un, et la page poserait l'initiale comme une certitude
     (`habillerJoueurs`, `ECARTS.md`, classement § 8). Le niveau ne doit
     rien au catalogue, il reste ; et un compte effacé, lui, est sans visage
     de toute façon. En dernier : le catalogue ne revient pas. */
  oublierCatalogue();
  const Ks = createKop({ pool, requireAuth: (r, _s, n) => n() });
  const sans = new Map((await Ks.etat(kop.id, U[0])).membres.map((m) => [m.id, m]));
  check('sans catalogue, un membre n’a pas de champ avatar, mais garde son niveau',
    (!('avatar' in (sans.get(U[0]) ?? { avatar: 1 })) && sans.get(U[0])?.niveau === 7
      && !('avatar' in (sans.get(U[1]) ?? { avatar: 1 })) && sans.get(U[1])?.niveau === 1)
    || (console.log('        ils portent :', JSON.stringify([...sans.values()])), false));
  check('et le compte effacé reste sans visage ni niveau',
    (sans.get(U[2])?.avatar === null && !('niveau' in (sans.get(U[2]) ?? {})))
    || (console.log('        il porte :', JSON.stringify(sans.get(U[2]))), false));
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end();
process.exitCode = failures ? 1 : 0;
