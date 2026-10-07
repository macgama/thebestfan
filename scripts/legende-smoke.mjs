/**
 * La légende entre en jeu (`src/shared/legende.js`), et elle est rare.
 *
 * Aucune base, aucun réseau : la règle du deck, le deck tel qu'il entre en
 * jeu, l'éveil au duel et au Virage, et les taux de tirage réglables.
 */
import { DuelNvN } from '../src/server/nvn/engine.js';
import { VirageRoom } from '../src/server/ferveur/virage.js';
import { refusLegendes, selonLaRegle, seuilLegende, chantReussi }
  from '../src/shared/legende.js';
import { validerDeck, ACTION_BY_ID } from '../src/shared/duel/actions.js';
import { BY_ID, RATES } from '../src/shared/fanzzy/dex.js';
import { STUFF_BY_ID, combine } from '../src/shared/fanzzy/inventaire.js';
import { CHANTS } from '../src/shared/duel/chants.js';
import { poserReglages, reglagesVivants } from '../src/shared/reglages.js';
import { etalStuff, prixDe } from '../src/shared/etal.js';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const RARETE = {
  fanzzy: (id) => BY_ID.get(id)?.rar,
  stuff: (id) => STUFF_BY_ID.get(id)?.rar,
};
const codes = (deck) => refusLegendes(deck, RARETE).map((p) => p.code).sort().join(',');

/* Des identifiants sûrs : deux légendaires, une commune, deux pièces. */
const LEG = 'TR55', LEG2 = 'TR56', COM = 'TR32';
check('les cartes du contrôle ont la rareté attendue',
  BY_ID.get(LEG)?.rar === 'legendaire' && BY_ID.get(LEG2)?.rar === 'legendaire'
  && BY_ID.get(COM)?.rar === 'commune'
  && STUFF_BY_ID.get('bache')?.rar === 'legendaire'
  && STUFF_BY_ID.get('fanion')?.rar === 'legendaire'
  && STUFF_BY_ID.get('jumelles')?.rar === 'commune');

console.log('\nLa règle du deck');
check('un légendaire titulaire est refusé',
  codes({ fanzzy: [{ id: LEG }, { id: COM }] }) === 'deck.error.legende_titulaire');
check('un légendaire en remplaçant passe', codes({ fanzzy: [{ id: COM }, { id: LEG }] }) === '');
check('deux légendaires sont refusés (Fanzzy et pièce)',
  codes({ fanzzy: [{ id: COM, stuff: ['bache'] }, { id: LEG }] }) === 'deck.error.legende_une_seule');
check('deux pièces légendaires sont refusées',
  codes({ fanzzy: [{ id: COM, stuff: ['bache', 'fanion'] }] }) === 'deck.error.legende_une_seule');
check('une pièce légendaire seule passe, même sur le titulaire',
  codes({ fanzzy: [{ id: COM, stuff: ['bache', 'jumelles'] }] }) === '');
check('sans rareté connue, aucune règle (comme avant)',
  refusLegendes({ fanzzy: [{ id: LEG }] }, undefined).length === 0);
{
  const possede = { fanzzy: new Set([LEG, COM]), stuff: new Set(), actions: new Set(['a-arbitre']),
    rarete: RARETE };
  const v = validerDeck({ fanzzy: [{ id: LEG }, { id: COM }],
    actions: Array(10).fill('a-arbitre') }, possede);
  check('validerDeck applique la règle',
    !v.valide && v.problemes.some((p) => p.code === 'deck.error.legende_titulaire'));
}

console.log('\nUn deck d\'avant la règle se joue selon elle');
{
  const g = selonLaRegle([{ id: LEG }, { id: COM }], RARETE);
  check('le légendaire titulaire passe derrière', g[0].id === COM && g[1].id === LEG && g[1].legende);
  const h = selonLaRegle([{ id: COM }, { id: LEG }, { id: LEG2 }], RARETE);
  check('le second légendaire reste hors du jeu', h.length === 2 && !h.some((f) => f.id === LEG2));
  const k = selonLaRegle([{ id: COM, stuff: ['bache', 'fanion'] }], RARETE);
  check('la seconde pièce légendaire est ôtée du sac',
    k[0].stuff.join() === 'bache' && k[0].stuffLegende === 'bache');
  const s = selonLaRegle([{ id: LEG }], RARETE);
  check('seul au deck, il reste en tribune', s.length === 1 && s[0].legende);
}

console.log('\nAu duel, la légende dort puis s\'éveille');

/** Le loadout comme `deck/index.js` le construit, `modsBanc` compris. */
function loadout(deck) {
  return {
    fanzzy: selonLaRegle(deck, RARETE).map((f) => {
      const d = BY_ID.get(f.id);
      const dort = f.legende || f.stuffLegende;
      const sacBanc = f.stuff.filter((x) => x !== f.stuffLegende);
      return { id: f.id, nom: d.nom, type: d.type, cri: d.cri, stage: 1, stade: 1,
        mods: { id: f.id, ...combine(d.mods, f.stuff) }, modsBase: d.mods,
        ...(dort ? { modsBanc: { id: f.id, ...combine(f.legende ? {} : d.mods, sacBanc) } } : {}),
        stuff: f.stuff, ages: [], legende: f.legende, stuffLegende: f.stuffLegende };
    }),
    actions: Array(10).fill(ACTION_BY_ID.get('a-arbitre')),
  };
}
const tempoParfait = () => Array.from({ length: 8 }, (_, i) => i * 560);

function duel(deck) {
  return new DuelNvN({ id: 'leg1', mode: 'entrainement', now: 1_000_000,
    equipes: [[{ userId: 'a', nom: 'A', loadout: loadout(deck) }],
      [{ userId: 'b', nom: 'B', loadout: loadout([{ id: COM }]) }]],
    fixture: { id: 7001, elapsed: 20, home: { id: 1, name: 'H' }, away: { id: 2, name: 'A' } } });
}
function chanteBien(d, userId, t) {
  let cardId = d.repertoire.find((id) => CHANTS[id].gest === 'tempo');
  if (!cardId) {
    cardId = Object.keys(CHANTS).find((id) => CHANTS[id].gest === 'tempo');
    d.repertoire[0] = cardId;
  }
  d.joueurs.get(userId).breath = 100;
  return d.chanter(userId, { cardId, taps: tempoParfait() }, t);
}

check('le seuil par défaut est de cinq chants', seuilLegende() === 5);
check('un chant BON compte, un MOYEN non', chantReussi(0.8) && !chantReussi(0.5));
{
  const d = duel([{ id: COM }, { id: LEG }]);
  const j = d.joueurs.get('a');
  const v0 = d.vue('a');
  check('la vue dit où en est la légende',
    v0.moi.legende?.reussis === 0 && v0.moi.legende?.seuil === 5 && !v0.moi.legende.eveillee);
  check('l\'adversaire sans légendaire n\'a rien à éveiller', d.vue('b').moi.legende === null);
  j.effets.push({ type: 'peut_changer', charges: 1 });
  let refuse = null;
  try { d.changer('a', 1, 1_000_100); } catch (e) { refuse = e.message ?? e.code; }
  check('un légendaire endormi ne peut pas entrer', String(refuse).includes('legend_asleep'));
  check('le refus ne coûte pas le changement',
    j.effets.find((e) => e.type === 'peut_changer')?.charges === 1);
  j.effets = [];

  let t = 1_000_000, evs = [];
  for (let i = 0; i < 5; i++) { t += 6000; evs.push(...chanteBien(d, 'a', t)); }
  const eveil = evs.find((e) => e.t === 'legende' && e.eveillee);
  check('cinq chants réussis éveillent la légende', j.legende.eveillee && Boolean(eveil));
  check('l\'éveil nomme le légendaire du banc', eveil?.fanzzy === LEG && eveil?.index === 1);
  check('l\'éveil offre un changement',
    j.effets.some((e) => e.type === 'peut_changer' && e.charges > 0));
  d.changer('a', 1, t + 10);
  check('éveillé, il entre', j.actif === 1);
  check('et ses modificateurs comptent',
    d.vue('a').moi.mods.tempoWindow === BY_ID.get(LEG).mods.tempoWindow);
}
{
  const d = duel([{ id: COM, stuff: ['bache'] }]);
  const j = d.joueurs.get('a');
  const pBache = STUFF_BY_ID.get('bache').mods.parryBonus;
  const avant = d.vue('a').moi.mods.parryBonus ?? 1;
  check('la pièce légendaire ne compte pas tant qu\'elle dort', avant !== pBache);
  let t = 1_000_000;
  for (let i = 0; i < 5; i++) { t += 6000; chanteBien(d, 'a', t); }
  check('éveillée, elle compte', d.vue('a').moi.mods.parryBonus === pBache);
  check('sans Fanzzy légendaire au banc, pas de changement offert',
    !j.effets.some((e) => e.type === 'peut_changer'));
}
{
  const avant = reglagesVivants();
  poserReglages({ ...avant, 'legende.chants': 0 });
  const d = duel([{ id: COM }, { id: LEG }]);
  check('à zéro, la légende est éveillée d\'emblée', d.joueurs.get('a').legende.eveillee);
  poserReglages(avant);
}

console.log('\nAu Virage');
{
  const salle = new VirageRoom({ fixture: { id: 9101, homeId: 1, awayId: 2 },
    emit: () => {}, onPush: () => {}, log: { warn() {}, error() {} } });
  const pleins = { tempoWindow: 1.28 }, banc = {};
  salle.join('v1', { side: 0, name: 'V', mods: pleins, modsBanc: banc, actions: [] });
  const m = salle.members.get('v1');
  check('il entre avec les modificateurs du banc', m.mods === banc && !m.legende.eveillee);
  check('la vue dit où en est la légende', salle.snapshotFor('v1').you.legende?.reussis === 0);
  for (let i = 0; i < 4; i++) salle.eveiller(m);
  check('quatre chants ne suffisent pas', m.mods === banc);
  salle.eveiller(m);
  check('le cinquième l\'éveille', m.legende.eveillee && m.mods === pleins
    && m.modsLieu.tempoWindow !== undefined);
  salle.join('v1', { side: 0, name: 'V', mods: pleins, modsBanc: banc, actions: [] });
  check('revenir ne la rendort pas', m.mods === pleins);
  salle.join('v2', { side: 0, name: 'W', mods: pleins, actions: [] });
  check('sans légende, rien ne dort', salle.members.get('v2').mods === pleins
    && salle.snapshotFor('v2').you.legende === null);
}

console.log('\nLes légendaires sont rares');
{
  const avant = reglagesVivants();
  const parBooster = () => 1 - RATES[4][0][1] * RATES[5][0][1];
  check('par défaut, 2 % des boosters donnent un Fanzzy légendaire',
    Math.abs(parBooster() - 0.02) < 1e-9);
  poserReglages({ ...avant, 'pack.legendaire_fanzzy': 3 });
  check('le taux suit /admin', Math.abs(parBooster() - 0.03) < 1e-9);
  check('les tables restent des probabilités',
    [4, 5].every((k) => Math.abs(RATES[k][0][1] + RATES[k][1][1] - 1) < 1e-12));
  check('le réglage de la pièce existe, à 3 % par défaut',
    avant['pack.legendaire_stuff'] === 3);
  check('les taux partent en JSON', JSON.stringify(RATES).includes('"4"'));
  poserReglages(avant);
}

console.log('\nL\'étal ne vend plus de légendaire');
check('aucune pièce légendaire à l\'étal', !etalStuff().some((x) => x.rar === 'legendaire'));
check('les autres raretés y restent',
  ['commune', 'rare', 'epique'].every((r) => etalStuff().some((x) => x.rar === r)));
check('l\'achat direct d\'une légendaire est refusé', prixDe('stuff', 'bache') === null);
check('une épique s\'achète toujours', prixDe('stuff', 'megaphone') > 0);

if (failures) { console.error(`\n${failures} échec(s)`); process.exit(1); }
console.log('\nlegende:smoke — tout passe');
