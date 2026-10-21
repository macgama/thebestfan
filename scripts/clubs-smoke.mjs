/**
 * Les Fanzzy liés à un club (`src/shared/fanzzy/clubs.js`).
 *
 * Aucune base, aucun réseau : la table des liens, le bonus des réglages, le
 * deck lié pour un match, la poussée plus forte au duel, et la ligne du
 * panneau des bonus.
 */
import { DuelNvN } from '../src/server/nvn/engine.js';
import { CLUB_DE, clubDe, lieA, modsDuLien, avecLien, lierLeDeck, tauxDuLien }
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
  check('un neutre (club nul) garde son deck tel quel', lierLeDeck(brut, null, tauxDuLien()) === brut);
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

console.log(failures ? `\n${failures} échec(s)` : '\nTout est bon.');
process.exit(failures ? 1 : 0);
