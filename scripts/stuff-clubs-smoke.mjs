/**
 * Les pièces de club (demande de Gaël du 28 octobre 2026).
 *
 * Aucune base, aucun réseau. Deux choses :
 *
 *   1. **Ne pas les oublier.** Chaque série de clubs (`SERIES_DE_CLUBS`,
 *      `shared/fanzzy/clubs.js`) a deux pièces par club, une commune et une
 *      rare, écrites dans `inventaire.js` avec leur invite de dessin. Brancher
 *      une série de clubs sans elles rougit ici, et rien n'entre dans main
 *      avec une suite rouge.
 *   2. **La règle** : le COMBO adoucit le revers, le PLEIN CLUB rapporte,
 *      ni l'un ni l'autre ne fait pousser plus fort.
 */
import { STUFF, STUFF_BY_ID, combine, faitCombo, modsDeLaPiece, partDuCombo }
  from '../src/shared/fanzzy/inventaire.js';
import { SERIES_DE_CLUBS, clubDe, pleinClub, facteurPleinClub, gainPleinClub,
  lierLeDeck, tauxDuLien } from '../src/shared/fanzzy/clubs.js';
import { apportsDe } from '../src/shared/apports.js';
import { INVITES_CLUBS, FOND_MAGENTA } from './stuff-clubs-invites.mjs';
import { poserReglages, PAR_CLE } from '../src/shared/reglages.js';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const proche = (a, b) => Math.abs(a - b) < 1e-9;

console.log('\nDeux pièces par club, dans chaque série de clubs');
for (const [serie, clubs] of Object.entries(SERIES_DE_CLUBS)) {
  /* Une série dont les clubs n'ont pas encore leur identifiant (SU, au
     28 octobre 2026) est dite en attente, sans rougir : ses pièces ne
     peuvent viser personne. Dès qu'un identifiant est écrit, la règle
     s'applique à toute la série. */
  if (clubs.every((c) => c == null)) {
    console.log(`  ..   ${serie} : ${clubs.length} clubs sans identifiant, ses ${clubs.length * 2} pièces attendent`);
    continue;
  }
  const manquent = clubs.filter((c) => {
    const p = STUFF.filter((s) => Number(s.club) === Number(c));
    return p.length < 2 || !p.some((s) => s.rar === 'commune') || !p.some((s) => s.rar === 'rare');
  });
  check(`${serie} : ${clubs.length} clubs, une commune et une rare chacun`
    + (manquent.length ? ` — manquent : ${manquent.join(', ')}` : ''), manquent.length === 0);
}
const deClub = STUFF.filter((s) => s.club != null);
const connus = new Set(Object.values(SERIES_DE_CLUBS).flat().filter((c) => c != null).map(Number));
check('chaque pièce de club vise un club d’une série', deClub.every((s) => connus.has(Number(s.club))));
check('aucune pièce de club n’est légendaire ni épique',
  deClub.every((s) => s.rar === 'commune' || s.rar === 'rare'));
check('chacune a un revers, comme toute pièce', deClub.every((s) =>
  Object.entries(s.mods).some(([k, v]) => (k === 'costPenalty' ? v > 1
    : ['tempoInterval', 'mashTime'].includes(k) ? v > 0 : v < 1))));
check('aucune ne porte de retour de flamme (il ne s’adoucit pas)',
  deClub.every((s) => !('backfire' in s.mods)));
check('chacune a son sujet de dessin', deClub.every((s) => INVITES_CLUBS[s.id]));
check('aucun sujet sans pièce', Object.keys(INVITES_CLUBS).every((id) => STUFF_BY_ID.get(id)?.club != null));
check('chaque sujet dit l’objet nu, sans écusson ni texte', deClub.every((s) =>
  /no crest, no logo and no lettering/.test(INVITES_CLUBS[s.id] ?? '')));
{
  const NOMS = /arsenal|villa|bournemouth|brentford|brighton|chelsea|coventry|palace|everton|fulham|hull|ipswich|leeds|liverpool|manchester|newcastle|nottingham|forest|sunderland|tottenham|spurs|gunner|magpie|toffee|hornet|seagull|cherr|blades|reds\b|blues\b|maillot|écusson/i;
  check('ni nom de club, ni surnom, ni maillot dans un nom ou un texte',
    deClub.every((s) => !NOMS.test(s.nom) && !NOMS.test(s.texte)));
  /* DIE KURVE : les villes et clubs suisses, et ce que dessinent leurs
     écussons et armoiries. */
  const SUISSES = /b[âa]le\b|basel|grasshopper|lausanne|lucerne|luzern|lugano|gall|servette|\bsion\b|thoun|\bthun\b|vaduz|young|\bboys\b|z[üu]rich|\bbern|\bours\b|[ée]toile|aigle|\bcl[ée]\b|sauterelle|basilic|croix/i;
  check('ni ville ni club suisse, ni ours, étoile, aigle ou clé dans une pièce SU',
    deClub.filter((s) => s.id.startsWith('su-')).every((s) => !SUISSES.test(s.nom) && !SUISSES.test(s.texte)));
  const INTERDITS_SU = /\bbear|\bstar\b|eagle|\bkey\b|insect|grasshopper|letter v\b|basilisk|\bcross\b(?! and no star)|\bflag/i;
  check('ni ours, étoile, aigle, clé, insecte ni drapeau dans le sujet d’une pièce SU',
    deClub.filter((s) => s.id.startsWith('su-')).every((s) =>
      !INTERDITS_SU.test(INVITES_CLUBS[s.id].replace(/no cross and no star anywhere/, ''))));
  check('les pièces vertes se dessinent sur magenta, et elles seules',
    [...FOND_MAGENTA].every((id) => STUFF_BY_ID.get(id)?.club === 1011)
    && deClub.filter((s) => s.club === 1011).every((s) => FOND_MAGENTA.has(s.id)));
}

console.log('\nLe COMBO : le revers s’adoucit, le bonus ne bouge pas');
check('le réglage existe, 50 % par défaut', PAR_CLE.get('stuff.club_revers')?.defaut === 50
  && proche(partDuCombo(), 0.5));
{
  const p = STUFF_BY_ID.get('an-guitare'); // tempoWindow 1.3, parryBonus 0.84
  const club = p.club;
  check('faitCombo : vrai pour son club, faux ailleurs ou sans club',
    faitCombo(p, club) && faitCombo(p, String(club)) && !faitCombo(p, 1) && !faitCombo(p, null)
    && !faitCombo(STUFF_BY_ID.get('jumelles'), club));
  const m = modsDeLaPiece(p, club);
  check('−16 % devient −8 %, +30 % reste +30 %', proche(m.parryBonus, 0.92) && m.tempoWindow === 1.3);
  check('sans combo, la pièce est telle quelle', modsDeLaPiece(p, null) === p.mods);
  const d = modsDeLaPiece(STUFF_BY_ID.get('an-enclume'), STUFF_BY_ID.get('an-enclume').club);
  check('un décalage de cadence se divise aussi', d.tempoInterval === 35 && d.mashBonus === 1.28);
  const g = modsDeLaPiece(STUFF_BY_ID.get('an-guidon'), STUFF_BY_ID.get('an-guidon').club);
  check('une cadence accélérée est un bonus : elle ne bouge pas', g.tempoInterval === -60
    && proche(g.refundBonus, 0.93));
  const avec = combine({ tempoWindow: 1.1 }, ['an-guitare', 'an-amarre'], { club });
  const sans = combine({ tempoWindow: 1.1 }, ['an-guitare', 'an-amarre']);
  check('combine passe le club aux deux pièces', proche(avec.parryBonus, 0.92)
    && proche(avec.tempoWindow, 1.1 * 1.3 * 0.95) && proche(sans.tempoWindow, 1.1 * 1.3 * 0.9));
  check('un Fanzzy de la série porte le club de la pièce',
    clubDe('AN14') === club && clubDe('AN34') === club && clubDe('AN54') === club);
  poserReglages({ 'stuff.club_revers': 0 });
  check('à 0 dans /admin, le combo ne change rien', modsDeLaPiece(p, club) === p.mods);
  poserReglages({ 'stuff.club_revers': 100 });
  check('à 100, le revers disparaît', modsDeLaPiece(p, club).parryBonus === 1);
  poserReglages({});
  const ap = apportsDe({ stuff: ['an-guitare', 'jumelles'], clubPorteur: club });
  check('le panneau des bonus dit COMBO et les mods adoucis', ap[0].combo === true
    && proche(ap[0].mods.parryBonus, 0.92) && !ap[1].combo);
}

console.log('\nLe PLEIN CLUB : le vrai fan gagne plus, jamais plus fort');
check('le réglage existe, 15 % par défaut', PAR_CLE.get('stuff.club_gain')?.defaut === 15
  && proche(gainPleinClub(), 0.15));
{
  const liv = STUFF_BY_ID.get('an-guitare').club;
  const base = { fanzzyId: 'AN14', stuff: ['an-guitare', 'an-amarre'], teamId: liv };
  check('deux pièces de son club, chez son club principal : 2', pleinClub({ ...base, principal: liv }) === 2);
  check('un club suivi qui n’est pas le principal : 0', pleinClub({ ...base, principal: 42 }) === 0);
  check('sans club principal : 0', pleinClub({ ...base, principal: null }) === 0);
  check('un autre Fanzzy que celui du club : 0', pleinClub({ ...base, fanzzyId: 'AN1', principal: liv }) === 0);
  check('une seule pièce de son club : 1', pleinClub({ ...base, stuff: ['an-guitare', 'jumelles'], principal: liv }) === 1);
  check('la pièce d’un autre club ne compte pas', pleinClub({ ...base, stuff: ['an-mitaines'], principal: liv }) === 0);
  check('un Fanzzy neutre lié par achat compte aussi',
    pleinClub({ ...base, fanzzyId: 'TR32', clubAchete: liv, principal: liv }) === 2);
  check('deux pièces : ×1,15 ×1,15', proche(facteurPleinClub(2), 1.15 * 1.15) && facteurPleinClub(0) === 1);

  const loadout = { fanzzy: [
    { id: 'AN14', stuff: ['an-guitare', 'an-amarre'], mods: { pushMult: 1 }, ages: [{ id: 'AN14', mods: { pushMult: 1 } }] },
    { id: 'AN1', stuff: [], mods: {}, ages: [] },
  ] };
  const t = tauxDuLien();
  const plein = lierLeDeck(loadout, liv, t, { principal: liv }).fanzzy[0];
  const simple = lierLeDeck(loadout, liv, t, { principal: 42 }).fanzzy[0];
  check('au duel, le gain du lien grossit au PLEIN CLUB',
    proche(plein.lien.scarvesBonus, 1.1 * 1.15 * 1.15) && plein.pleinClub === 2
    && proche(simple.lien.scarvesBonus, 1.1) && simple.pleinClub === 0);
  check('la force reste celle du lien seul', proche(plein.mods.pushMult, 1.05)
    && proche(plein.lien.pushMult, 1.05) && proche(plein.ages[0].mods.pushMult, 1.05));
  check('le Fanzzy d’un autre club n’est pas touché', lierLeDeck(loadout, liv, t, { principal: liv })
    .fanzzy[1] === loadout.fanzzy[1]);
  const ap = apportsDe({ club: { ...plein.lien, pleinClub: 2 } });
  check('le panneau nomme le PLEIN CLUB, sans la clé de comptage',
    ap[0].nom === 'PLEIN CLUB' && !('pleinClub' in ap[0].mods));
}

console.log(failures ? `\n${failures} échec(s).\n` : '\nTout est vert.\n');
process.exit(failures ? 1 : 0);
