/**
 * Les Fanzzy liés à un club (`src/shared/fanzzy/clubs.js`).
 *
 * Aucune base, aucun réseau : la table des liens, le bonus des réglages, le
 * deck lié pour un match, la poussée plus forte au duel, et la ligne du
 * panneau des bonus.
 */
import { DuelNvN } from '../src/server/nvn/engine.js';
import { CLUB_DE, CRI_DU_CLUB, CRIS_TYPES, criDuClub, avecCriDuClub, clubDe, lieA, modsDuLien, avecLien, lierLeDeck, tauxDuLien }
  from '../src/shared/fanzzy/clubs.js';
import { BY_ID } from '../src/shared/fanzzy/dex.js';
import { ACTION_BY_ID } from '../src/shared/duel/actions.js';
import { apportsDe } from '../src/shared/apports.js';
import { poserReglages, PAR_CLE } from '../src/shared/reglages.js';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

console.log('\nLa table des liens');
check('soixante lignées, trois par club', CLUB_DE.size === 60
  && new Set(CLUB_DE.values()).size === 20
  && [...new Set(CLUB_DE.values())].every((c) =>
    [...CLUB_DE.values()].filter((x) => x === c).length === 3));
check('AN1, AN21 et AN41 partagent le même club', clubDe('AN1') === clubDe('AN21')
  && clubDe('AN21') === clubDe('AN41') && clubDe('AN1') != null);
check('un âge supérieur garde le lien de sa lignée', clubDe('AN3C') === clubDe('AN3')
  && clubDe('AN12B') === clubDe('AN12'));
check('une série à thème est neutre', clubDe('TR32') === null && clubDe('RP1') === null
  && clubDe('BG4') === null);
check('chaque Fanzzy de LES TERRACES au catalogue est lié',
  [...BY_ID.values()].filter((f) => f.set === 'AN').every((f) => clubDe(f.id) != null));
check('lieA : faux sans club, faux pour un autre club, vrai pour le sien',
  !lieA('AN1', null) && !lieA('TR32', clubDe('AN1')) && !lieA('AN1', clubDe('AN2'))
  && lieA('AN1', clubDe('AN1')) && lieA('AN1', String(clubDe('AN1'))));

console.log('\nLe bonus, réglable');
check('les deux réglages existent, +10 % et +5 % par défaut',
  PAR_CLE.get('fanzzy.lien_gain')?.defaut === 10 && PAR_CLE.get('fanzzy.lien_force')?.defaut === 5);
{
  const t = tauxDuLien();
  check('tauxDuLien rend des fractions', Math.abs(t.gain - 0.1) < 1e-9 && Math.abs(t.force - 0.05) < 1e-9);
  const v = modsDuLien(t);
  const d = modsDuLien(t, 'duel');
  check('au Virage : la force et la ferveur', v.pushMult === 1.05 && v.ferveurBonus === 1.1 && !('scarvesBonus' in v));
  check('au duel : la force et les écharpes', d.pushMult === 1.05 && d.scarvesBonus === 1.1 && !('ferveurBonus' in d));
  const m = avecLien({ id: 'AN1', pushMult: 2, holdBonus: 1.16 }, t);
  check('le lien multiplie ce qui est déjà composé', Math.abs(m.pushMult - 2.1) < 1e-9
    && m.holdBonus === 1.16 && m.id === 'AN1');
  poserReglages({ 'fanzzy.lien_force': 0, 'fanzzy.lien_gain': 0 });
  const z = modsDuLien(tauxDuLien());
  check('à zéro dans /admin, le lien ne change rien', z.pushMult === 1 && z.ferveurBonus === 1);
  poserReglages({});
}

console.log('\nLe deck lié pour un match');
function loadout(ids) {
  return {
    fanzzy: ids.map((id) => {
      const d = BY_ID.get(id);
      const age = { id, nom: d.nom, type: d.type, cri: d.cri, stage: 1,
        mods: { id, ...d.mods }, modsBase: d.mods };
      return { ...age, stuff: [], stade: 1, ages: [age, { ...age, stage: 2 }], tenues: {} };
    }),
    actions: Array(10).fill(ACTION_BY_ID.get('a-arbitre')),
  };
}
const CLUB = clubDe('AN1');
{
  const brut = loadout(['AN1', 'AN2', 'TR32']);
  const lie = lierLeDeck(brut, CLUB, tauxDuLien());
  check('le Fanzzy de son club est lié, les autres non',
    lie.fanzzy[0].lie === true && !lie.fanzzy[1].lie && !lie.fanzzy[2].lie);
  check('ses totaux portent le bonus, à tous ses âges',
    Math.abs(lie.fanzzy[0].mods.pushMult - 1.05) < 1e-9
    && lie.fanzzy[0].ages.every((a) => Math.abs(a.mods.pushMult - 1.05) < 1e-9 && a.lie));
  check('ses modificateurs propres ne bougent pas (le panneau les montre à part)',
    lie.fanzzy[0].modsBase === brut.fanzzy[0].modsBase && lie.fanzzy[0].lien?.pushMult === 1.05);
  check('le deck lu en base n\'est pas touché', brut.fanzzy[0].mods.pushMult === undefined);
  check('le Fanzzy lié porte son club, pour le son et l\'éclat de la page',
    lie.fanzzy[0].lieAuClub === CLUB && lie.fanzzy[1].lieAuClub === undefined);
  check('un neutre (club nul) garde son deck tel quel', lierLeDeck(brut, null, tauxDuLien()) === brut);
}

console.log('\nLes championnats qui ont leurs Fanzzy');
{
  const { serieDeLigue, criDeSerie } = await import('../src/shared/fanzzy/series-ligues.js');
  const pl = serieDeLigue(39);
  check('la Premier League a sa série, LES TERRACES, à ses couleurs',
    pl?.code === 'AN' && pl.nom === 'LES TERRACES' && /^#/.test(pl.c1) && /^#/.test(pl.c2));
  check('vingt clubs, trois Fanzzy et un cri chacun',
    pl.clubs.length === 20 && pl.clubs.every((c) => c.fanzzy.length === 3 && c.cri === CRI_DU_CLUB.get(c.club)));
  check('une compétition sans série n\'en a pas', serieDeLigue(61) === null && serieDeLigue('x') === null);
  check('le cri de série d\'un club anglais, rien pour un autre', criDeSerie(40) === CRI_DU_CLUB.get(40) && criDeSerie(85) === null);
}
console.log('\nLe cri du club');
check('vingt cris, un par club, quatre mots au plus et sans chiffre',
  CRI_DU_CLUB.size === 20 && [...CRI_DU_CLUB.values()].every((c) =>
    c.replace(/[,!’']/g, ' ').trim().split(/\s+/).length <= 4 && !/\d/.test(c)));
check('chaque club de la série a le sien', [...new Set(CLUB_DE.values())].every((c) => CRI_DU_CLUB.has(c)));
{
  const lie = lierLeDeck(loadout(['AN1', 'TR32']), CLUB, tauxDuLien());
  const cri = CRI_DU_CLUB.get(CLUB);
  check('au duel, le Fanzzy lié pousse le cri de son club, à tous ses âges',
    lie.fanzzy[0].cri.label === cri && lie.fanzzy[0].ages.every((a) => a.cri.label === cri));
  check('son geste et sa puissance restent les siens',
    lie.fanzzy[0].cri.gest === BY_ID.get('AN1').cri.gest && lie.fanzzy[0].cri.power === BY_ID.get('AN1').cri.power);
  check('le neutre garde son cri', lie.fanzzy[1].cri.label === BY_ID.get('TR32').cri.label);
  check('un club hors de la table pousse son cri type, toujours le même',
    avecCriDuClub({ cri: { label: 'X' } }, 85).cri.label === CRIS_TYPES[85 % CRIS_TYPES.length]
    && criDuClub(85) === criDuClub('85'));
  check('sans club, le cri ne change pas', avecCriDuClub({ cri: { label: 'X' } }, null).cri.label === 'X');
  check('huit cris types, quatre mots au plus et sans chiffre, distincts des cris de série',
    CRIS_TYPES.length === 8 && CRIS_TYPES.every((c) => c.replace(/[,!’']/g, ' ').trim().split(/\s+/).length <= 4 && !/\d/.test(c))
    && CRIS_TYPES.every((c) => ![...CRI_DU_CLUB.values()].includes(c)));
}

console.log('\nAu duel, il pousse plus fort');
function poussee(lie) {
  const deckA = lie ? lierLeDeck(loadout(['AN1']), CLUB, tauxDuLien()) : loadout(['AN1']);
  const d = new DuelNvN({ id: 'club1', mode: 'entrainement', now: 1_000_000,
    equipes: [[{ userId: 'a', nom: 'A', loadout: deckA }],
      [{ userId: 'b', nom: 'B', loadout: loadout(['TR32']) }]],
    fixture: { id: 7001, elapsed: 20, home: { id: CLUB, name: 'H' }, away: { id: 2, name: 'A' } } });
  return d.pousser(d.joueurs.get('a'), 100, 1_000_100, []);
}
{
  const sans = poussee(false), avec = poussee(true);
  check(`la même poussée vaut 5 % de plus (${sans.toFixed(2)} → ${avec.toFixed(2)})`,
    sans > 0 && Math.abs(avec / sans - 1.05) < 1e-6);
}

console.log('\nLe panneau des bonus');
{
  const a = apportsDe({ fanzzy: { nom: 'X', mods: { holdBonus: 1.16 } }, club: modsDuLien(tauxDuLien()) });
  const c = a.find((x) => x.quoi === 'club');
  check('une ligne « ton club », sans nom de club', c && c.nom === 'Fanzzy lié à ton club'
    && c.mods.pushMult === 1.05);
  check('sans lien, pas de ligne', !apportsDe({ fanzzy: { nom: 'X', mods: { holdBonus: 1.1 } } })
    .some((x) => x.quoi === 'club'));
}

console.log('\nUn Fanzzy neutre lié contre des écharpes, hors base');
check('lieA lit le club acheté pour un neutre', lieA('TR32', 85, 85) && !lieA('TR32', 91, 85)
  && !lieA('TR32', 85, null));
check('le club écrit d\'un Fanzzy de série passe devant un club acheté',
  lieA('AN1', CLUB, 85) && !lieA('AN1', 85, 85));
{
  const brut = loadout(['TR32', 'TR33']);
  brut.fanzzy[0].club = 85;
  const lie = lierLeDeck(brut, 85, tauxDuLien());
  check('lierLeDeck lie le neutre acheté, pas l\'autre', lie.fanzzy[0].lie && !lie.fanzzy[1].lie);
}

/* ------------------------------------------------------------ en base */

console.log('\nEn base : acheter le lien, le deck, la fiche');
const { readFileSync } = await import('node:fs');
const { createFanzzy } = await import('../src/server/fanzzy/index.js');
const { createDecks } = await import('../src/server/deck/index.js');
const { charger: chargerCatalogue } = await import('../src/server/fanzzy/catalogue.js');
const { chargerTenues } = await import('../src/server/fanzzy/tenues.js');
const { baseDeTest, OPTIONS_BASE } = await import('./base-de-test.mjs');
const mysql = await import('mysql2/promise');
const DB = baseDeTest();
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS pronostics, parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users,
                 recompenses, missions_jour, compteurs_jour, user_nouveautes`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql',
  'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql', 'deck.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = 'cccccccc-0000-0000-0000-000000000001';
const SANS = 'cccccccc-0000-0000-0000-000000000002';
for (const [u, e] of [[U, 'c@ex.fr'], [SANS, 's@ex.fr']]) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`, [u, e, e]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves) VALUES (?,200)`, [u]);
  for (const f of ['TR32', 'MS30', 'AN1']) {
    await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [u, f]);
  }
}
await raw.query(`INSERT INTO teams (id,name,logo) VALUES (85,'Sion',NULL),(91,'Bâle',NULL),
  (${clubDe('AN1')},'Club Témoin','https://exemple.test/logo.png')`);
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,91,0),(?,85,1)`, [U, U]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);
const F = createFanzzy({ pool, requireAuth: (_q, _s, n) => n() });
const D = createDecks({ pool, requireAuth: (_q, _s, n) => n() });
const echarpes = async (u) => Number((await pool.query(
  `SELECT scarves FROM user_wallet WHERE user_id = ?`, [u]))[0][0].scarves);
const refus = async (p) => { try { await p; return null; } catch (e) { return e.code; } };

let f = await F.fiche(U, 'TR32');
check('la fiche d\'un neutre propose le lien, à 120 écharpes', f.club?.lie === false
  && f.club.prix === 120 && f.club.clubPrincipal === true);
f = await F.fiche(U, 'AN1');
check('la fiche d\'un AN est liée d\'office, à un club que ce joueur ne suit pas',
  f.club?.lie === true && f.club.tonClub === false && f.club.achete === false);
check('la fiche d\'un AN nomme son club et montre son logo, même non suivi',
  f.club.nom === 'Club Témoin' && f.club.logo === 'https://exemple.test/logo.png');
check('un Fanzzy de série ne s\'achète pas', await refus(F.lierAuClub(U, 'AN1')) === 'fanzzy.error.deja_lie');
check('sans club principal, refusé sans rien prendre',
  await refus(F.lierAuClub(SANS, 'TR32')) === 'fanzzy.error.sans_club' && await echarpes(SANS) === 200);
check('un Fanzzy qu\'on n\'a pas ne se lie pas', await refus(F.lierAuClub(U, 'TR33')) === 'fanzzy.error.not_owned');

const r = await F.lierAuClub(U, 'TR32B');
check('lier coûte 120 écharpes', r.spent === 120 && await echarpes(U) === 80);
check('au club principal, pas au premier suivi', Number((await pool.query(
  `SELECT club_id FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = 'TR32'`, [U]))[0][0].club_id) === 85);
check('une seconde fois : refusé, rien de pris',
  await refus(F.lierAuClub(U, 'TR32')) === 'fanzzy.error.deja_lie' && await echarpes(U) === 80);
check('pas assez d\'écharpes : refusé',
  await refus(F.lierAuClub(U, 'MS30')) === 'fanzzy.error.not_enough_scarves' && await echarpes(U) === 80);
f = await F.fiche(U, 'TR32');
check('la fiche dit LIÉ À TON CLUB', f.club?.lie === true && f.club.tonClub === true && f.club.achete === true);
check('et nomme le club acheté', f.club.nom === 'Sion');
check('un club hors de la table a son cri type', f.club.cri === criDuClub(85) && CRIS_TYPES.includes(f.club.cri));
check('la fiche d\'un AN donne le cri de son club', (await F.fiche(U, 'AN1')).club.cri === CRI_DU_CLUB.get(clubDe('AN1')));

await pool.query(`INSERT INTO user_decks (user_id,nom,contenu,actif) VALUES (?, 'd', ?, 1)`,
  [U, JSON.stringify({ fanzzy: [{ id: 'TR32' }, { id: 'MS30' }], actions: [] })]);
const l = await D.loadout(U);
check('le deck porte le club acheté', l.fanzzy[0].club === 85 && l.fanzzy[1].club === null);
const lie = lierLeDeck(l, 85, tauxDuLien());
check('et le duel d\'un match de son club le lie', lie.fanzzy[0].lie && !lie.fanzzy[1].lie);
check('pas dans un match d\'un autre club', !lierLeDeck(l, 91, tauxDuLien()).fanzzy[0].lie);
await pool.end();

console.log(failures ? `\n${failures} échec(s)` : '\nTout est bon.');
process.exit(failures ? 1 : 0);
