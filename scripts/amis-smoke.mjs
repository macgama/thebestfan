/**
 * Test des amis.
 *
 * Trois choses s'y jouent, et deux d'entre elles ne se voient qu'en base.
 *
 *   1. **Une amitié est une paire, pas une flèche.** La table n'en garde
 *      qu'une ligne, avec les deux identifiants rangés. Si le rangement fuit
 *      quelque part, on obtient deux lignes pour deux personnes — et deux
 *      vérités contradictoires qui ne se réparent qu'à la main. On éprouve
 *      donc les deux sens de chaque geste.
 *
 *   2. **Le refus tient.** Il ne suffit pas d'afficher « non » : sans trace du
 *      refus, la demande revient dans la seconde, autant de fois que l'autre
 *      le veut. C'est la seule mesure du jeu contre le harcèlement.
 *
 *   3. **Ce qu'on montre des autres.** Un pseudo et les clubs *communs* — rien
 *      d'autre. Une adresse e-mail qui traverserait une réponse ne casserait
 *      rien, ne lèverait rien, et se retrouverait dans le cache du navigateur
 *      de tout le monde.
 *
 * Usage : node scripts/amis-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAmis, DELAI_APRES_REFUS_MS } from '../src/server/amis/index.js';
import { createKop } from '../src/server/kop/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/** Le code d'un refus attendu, ou '' si l'appel a réussi. */
async function refus(fn) {
  try { await fn(); return ''; } catch (e) { return e.code ?? e.message; }
}

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS achats, kop_invites, amities, kop_bulletins, kop_votes,
  kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql',
                 'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'stades.sql', 'kop.sql', 'amis.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

/* Quatre supporters. Les identifiants sont choisis pour que **l'ordre
   alphabétique ne suive pas l'ordre des demandes** : la table range la paire,
   et un rangement qui marche seulement quand le demandeur vient en premier ne
   se voit pas autrement. */
const [ANA, BOB, CLA, DAN] = [
  'aaaaaaaa-0000-0000-0000-000000000001',
  'ffffffff-0000-0000-0000-000000000002',
  'bbbbbbbb-0000-0000-0000-000000000003',
  'eeeeeeee-0000-0000-0000-000000000004',
];
const NOMS = { [ANA]: 'Ana', [BOB]: 'Bob', [CLA]: 'Clara', [DAN]: 'Dan' };
for (const [id, nom] of Object.entries(NOMS)) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `${nom.toLowerCase()}@ex.fr`, nom]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves,active_fanzzy) VALUES (?,50,'V1')`,
    [id]);
}
/* Clara a fait évoluer son Choriste : elle joue le Meneur de chant. C'est ce
   que les autres doivent voir d'elle — on se reconnaît à son personnage. */
await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies,stage) VALUES (?,'V1',1,2)`,
  [CLA]);
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle'),(99,'Lugano')`);
// Ana suit Sion et Bâle. Bob suit Sion. Clara suit Sion et Bâle. Dan ne suit
// que Lugano : il n'a rien en commun, et ne doit apparaître nulle part.
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES
  (?,85,1),(?,91,0),(?,85,1),(?,85,1),(?,91,0),(?,99,1)`,
[ANA, ANA, BOB, CLA, CLA, DAN]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
/* Le catalogue : sans lui, on ne sait pas que le second âge du Choriste
   s'appelle V2, et l'avatar d'un ami montrerait le personnage qu'il n'est
   plus. Chargé comme le fait server.js. */
await chargerCatalogue(pool);
const kop = createKop({ pool, requireAuth: (r, _s, n) => n() });
const A = createAmis({ pool, requireAuth: (r, _s, n) => n(), kop });

/* --------------------------------------------------------- se trouver */

{
  const gens = await A.suggestions(ANA);
  const par = new Map(gens.map((g) => [g.id, g]));
  check('on voit les gens qui suivent les mêmes clubs',
    par.has(BOB) && par.has(CLA));
  check('et pas ceux qui n’ont aucun club en commun', !par.has(DAN));
  check('ni soi-même', !par.has(ANA));

  /* Le tri met devant ceux avec qui on partage le plus de clubs : c'est la
     meilleure approximation de « vous vous croiserez souvent ». */
  check('celui avec qui on partage le plus est en tête', gens[0]?.id === CLA);
  check('le nombre de clubs communs est juste',
    par.get(CLA)?.communs === 2 && par.get(BOB)?.communs === 1);

  /* **Les clubs communs, et eux seuls.** Clara suit Sion et Bâle, et c'est ce
     qu'on montre parce qu'Ana les suit aussi. Le jour où Clara suivra Lugano,
     Ana ne doit pas l'apprendre ici : la nuance sépare « on se croise au
     stade » de « je sais où tu vas le week-end ». */
  check('avec le nom des clubs partagés',
    (par.get(CLA)?.clubs ?? []).sort().join('+') === 'Bâle+Sion');

  /* Le personnage **à l'âge atteint**, comme partout ailleurs dans le jeu.
     Montrer la racine ferait voir le Choriste de quelqu'un qui a payé pour ne
     plus l'être — et personne ne s'en apercevrait, puisque ça ressemble à un
     personnage parfaitement valide. */
  check('chacun est montré par son Fanzzy, à l’âge atteint',
    par.get(CLA)?.fanzzy === 'V2' && par.get(BOB)?.fanzzy === 'V1'
    || (console.log('        elle joue :', par.get(CLA)?.fanzzy), false));
  const deDan = await A.suggestions(DAN);
  check('celui qui ne partage rien ne voit personne', deDan.length === 0);

  /* Une adresse e-mail n'a rien à faire là. Elle ne casserait rien, ne
     lèverait rien — elle se retrouverait simplement dans le cache du
     navigateur de tout le monde. */
  check('aucune adresse e-mail ne traverse la réponse',
    !/@/.test(JSON.stringify(gens)));
}

/* ------------------------------------------------------- demander, répondre */

{
  await A.demander(ANA, BOB);
  const chezAna = await A.tableau(ANA);
  const chezBob = await A.tableau(BOB);
  check('la demande apparaît chez celui qui l’envoie',
    chezAna.envoyees.some((g) => g.id === BOB) && chezAna.recues.length === 0);
  check('et chez celui qui la reçoit',
    chezBob.recues.some((g) => g.id === ANA) && chezBob.envoyees.length === 0);
  check('le nom est là, l’adresse jamais',
    chezBob.recues[0]?.pseudo === 'Ana' && !/@/.test(JSON.stringify(chezBob)));

  check('on ne redemande pas deux fois',
    await refus(() => A.demander(ANA, BOB)) === 'amis.error.deja_demande');
  /* Le destinataire seul répond. Sans cette garde, on accepterait sa propre
     demande et l'on serait ami avec quelqu'un qui n'a rien dit. */
  check('et on ne répond pas à sa propre demande',
    await refus(() => A.repondre(ANA, BOB, true)) === 'amis.error.pas_a_toi');

  /* Sous garde, et pas par confort : c'est ici que casse le rangement de la
     paire. Un `await` nu ferait tomber la suite entière avec une trace de
     pile, et un test qui plante n'annonce pas ce qu'il a trouvé. */
  const accepte = await refus(() => A.repondre(BOB, ANA, true));
  check('le destinataire peut accepter',
    accepte === '' || (console.log('        il est refusé :', accepte), false));

  const apresA = await A.tableau(ANA);
  const apresB = await A.tableau(BOB);
  check('accepter les rend amis des deux côtés',
    apresA.amis.some((g) => g.id === BOB) && apresB.amis.some((g) => g.id === ANA));
  check('et la demande disparaît des deux listes',
    apresA.envoyees.length === 0 && apresB.recues.length === 0);

  /* Une seule ligne pour deux personnes : c'est la base qui l'impose, et
     c'est ce qui empêche deux vérités contradictoires sur la même paire. */
  const [[{ n }]] = await pool.query(
    `SELECT COUNT(*) n FROM amities WHERE (a = ? OR b = ?) AND (a = ? OR b = ?)`,
    [ANA, ANA, BOB, BOB]);
  check('une amitié ne tient qu’une ligne en base', n === 1);

  check('un ami n’est plus une suggestion',
    !(await A.suggestions(ANA)).some((g) => g.id === BOB));
  check('on ne demande pas deux fois quelqu’un qu’on a déjà',
    await refus(() => A.demander(ANA, BOB)) === 'amis.error.deja_amis');
}

/* --------------------------------------------------- les demandes croisées */

{
  /* Deux personnes qui se demandent en même temps veulent la même chose.
     Répondre « demande déjà en cours » à la seconde la laisserait chercher où
     l'accepter — alors qu'elle vient de le dire. */
  await A.demander(ANA, CLA);
  let r = null;
  const code = await refus(async () => { r = await A.demander(CLA, ANA); });
  check('se demander l’un l’autre, c’est accepter',
    r?.etat === 'amis'
    || (console.log('        elle répond :', code || JSON.stringify(r)), false));
  check('et ça ne fait toujours qu’une ligne',
    (await pool.query(`SELECT COUNT(*) n FROM amities WHERE (a = ? OR b = ?) AND (a = ? OR b = ?)`,
      [ANA, ANA, CLA, CLA]))[0][0].n === 1);
}

/* ------------------------------------------------------------- le refus */

{
  check('on ne se demande pas soi-même',
    await refus(() => A.demander(ANA, ANA)) === 'amis.error.soi_meme');
  check('ni quelqu’un qui n’existe pas',
    await refus(() => A.demander(ANA, 'personne')) === 'amis.error.inconnu');
  check('et on ne répond pas à une demande qui n’existe pas',
    await refus(() => A.repondre(ANA, DAN, true)) === 'amis.error.pas_de_demande');

  await A.demander(ANA, DAN);
  await A.repondre(DAN, ANA, false);
  const chezDan = await A.tableau(DAN);
  check('un refus vide les deux listes',
    chezDan.recues.length === 0 && (await A.tableau(ANA)).envoyees.length === 0);

  /* La trace du refus. Sans elle, dire non ne servirait à rien. */
  const code = await refus(() => A.demander(ANA, DAN));
  check('on ne redemande pas tout de suite à qui a dit non',
    code === 'amis.error.refus_recent');
  let jours = null;
  try { await A.demander(ANA, DAN); } catch (e) { jours = e.extra?.jours; }
  check('et le refus dit dans combien de jours on pourra',
    Number.isInteger(jours) && jours > 0 && jours <= 7
    || (console.log('        il dit :', jours), false));

  /* Le délai passé, la porte se rouvre : un refus n'est pas un bannissement.
     On recule la date plutôt que d'attendre une semaine. */
  await pool.query(`UPDATE amities SET repondu_le = ? WHERE a = ? OR b = ?`,
    [new Date(Date.now() - DELAI_APRES_REFUS_MS - 60_000), ANA < DAN ? ANA : DAN,
     ANA < DAN ? DAN : ANA]);
  const r = await A.demander(ANA, DAN);
  check('le délai passé, on peut redemander', r.etat === 'demande');
  await A.repondre(DAN, ANA, false);
}

/* ------------------------------------------------------------ se retirer */

{
  await A.retirer(ANA, BOB);
  check('retirer un ami le retire des deux côtés',
    !(await A.tableau(ANA)).amis.some((g) => g.id === BOB)
    && !(await A.tableau(BOB)).amis.some((g) => g.id === ANA));
  /* Ce n'est pas un refus : personne n'a dit non, et rien ne justifie
     d'imposer un délai avant de se reparler. */
  check('et il redevient quelqu’un qu’on peut redemander',
    (await A.demander(ANA, BOB)).etat === 'demande');
  await A.retirer(ANA, BOB);
  check('annuler sa propre demande marche aussi',
    (await A.tableau(BOB)).recues.length === 0);
  check('retirer un lien qui n’existe pas est refusé en le disant',
    await refus(() => A.retirer(ANA, BOB)) === 'amis.error.pas_de_lien');
}

/* --------------------------------------------------------- le KOP à deux */

{
  const leKop = await kop.creer(ANA, 85, 'Le Virage Nord');

  check('on n’invite pas dans un KOP dont on n’est pas membre',
    await refus(() => A.inviterAuKop(BOB, CLA, leKop.id)) === 'amis.error.pas_ton_kop');
  /* Dan ne suit pas Sion : il ne pourrait pas accepter. Mieux vaut le dire à
     celui qui invite que de lui laisser envoyer une invitation morte. */
  check('ni quelqu’un qui ne suit pas le club',
    await refus(() => A.inviterAuKop(ANA, DAN, leKop.id)) === 'amis.error.pas_son_club');

  await A.inviterAuKop(ANA, BOB, leKop.id);
  const chezBob = await A.tableau(BOB);
  const inv = chezBob.invitations[0];
  check('l’invitation arrive chez l’invité', chezBob.invitations.length === 1);
  check('elle dit quel KOP, quel club, et qui invite',
    inv?.nom === 'Le Virage Nord' && inv?.club === 'Sion' && inv?.parQui === 'Ana'
    || (console.log('        elle dit :', JSON.stringify(inv)), false));

  check('on ne répond pas à une invitation qu’on n’a pas',
    await refus(() => A.repondreAuKop(CLA, leKop.id, true)) === 'amis.error.pas_invite');

  await A.repondreAuKop(BOB, leKop.id, true);
  const membres = await pool.query(
    `SELECT user_id FROM kop_membres WHERE kop_id = ?`, [leKop.id]);
  check('accepter fait entrer dans le KOP',
    membres[0].some((m) => m.user_id === BOB));
  check('et l’invitation est consommée',
    (await A.tableau(BOB)).invitations.length === 0);
  check('on n’invite pas quelqu’un qui est déjà membre',
    await refus(() => A.inviterAuKop(ANA, BOB, leKop.id)) === 'amis.error.deja_membre');

  /* Décliner consomme aussi l'invitation : une invitation refusée qui resterait
     affichée est une invitation qu'on refuse tous les jours. */
  await A.inviterAuKop(ANA, CLA, leKop.id);
  await A.repondreAuKop(CLA, leKop.id, false);
  check('décliner la fait disparaître aussi',
    (await A.tableau(CLA)).invitations.length === 0);
  check('sans faire entrer personne',
    !(await pool.query(`SELECT 1 FROM kop_membres WHERE kop_id = ? AND user_id = ?`,
      [leKop.id, CLA]))[0].length);

  /* Les refus du KOP traversent avec **leurs** mots : « tu es déjà dans un
     autre KOP de ce club » n'est pas une erreur serveur, et le joueur doit
     pouvoir comprendre ce qui lui arrive. */
  const autre = await kop.creer(CLA, 85, 'Les Anciens');
  await A.inviterAuKop(CLA, ANA, autre.id);
  const code = await refus(() => A.repondreAuKop(ANA, autre.id, true));
  check('un refus du KOP garde les mots du KOP', code.startsWith('kop.error.'));
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end();
process.exit(failures ? 1 : 0);
