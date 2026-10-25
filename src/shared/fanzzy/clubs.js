/**
 * Les Fanzzy liés à un club.
 *
 * ## Ce que la règle dit
 *
 * Demandée par Gaël le 21 octobre 2026 : un Fanzzy d'une série de championnat
 * porte les couleurs d'un club, et il lui est **lié**. Quand un joueur joue un
 * match de son club avec un Fanzzy lié à ce club, il gagne un peu plus et il
 * pousse un peu plus fort, au Virage comme au duel. Un Fanzzy des séries à
 * thème (BG, RP, TR…) est neutre : il ne gagne ni ne perd rien.
 *
 * « Son club », c'est celui que le joueur soutient **dans ce match**, par la
 * règle de `football/suivis.js` : un club qu'il suit et qui joue. Un neutre
 * venu pousser chez les autres n'a pas de club ce soir-là, et son Fanzzy lié
 * n'y change rien — sinon il suffirait d'aligner un Fanzzy d'Arsenal pour
 * être chez soi partout.
 *
 * ## Le lien est un numéro, jamais un nom
 *
 * C'est la prudence juridique des séries de championnat (`dex-terraces.js`) :
 * le nom du club n'apparaît nulle part dans le jeu. Le lien passe donc par
 * l'identifiant API-Football du club, celui que portent déjà `user_follows`
 * et `fixtures`. La carte elle-même ne porte rien du club ; **la fiche, elle,
 * le nomme** depuis le 25 octobre 2026 (demande de Gaël) : son nom et son logo
 * tels que la liste des matchs les affiche déjà, lus dans `teams`.
 *
 * L'ordre des clubs est celui des fiches (`fanzzy-prompts/AN-les-terraces.md`
 * et `AN-les-terraces-2.md`) : vingt clubs par ordre alphabétique, et trois
 * Fanzzy par club — AN1 à AN20, AN21 à AN40, AN41 à AN60. Une lignée absente
 * du catalogue (pas encore dessinée) n'a simplement personne à lier.
 */

import { reglage } from '../reglages.js';

/* Les vingt clubs de la saison 2026-2027, dans l'ordre des fiches. Le nom
   n'est là que pour qui relit cette table : il ne descend jamais plus bas. */
const TERRACES = [
  42,    // Arsenal
  66,    // Aston Villa
  35,    // Bournemouth
  55,    // Brentford
  51,    // Brighton
  49,    // Chelsea
  1346,  // Coventry City
  52,    // Crystal Palace
  45,    // Everton
  36,    // Fulham
  64,    // Hull City
  57,    // Ipswich Town
  63,    // Leeds United
  40,    // Liverpool
  50,    // Manchester City
  33,    // Manchester United
  34,    // Newcastle United
  65,    // Nottingham Forest
  746,   // Sunderland
  47,    // Tottenham Hotspur
];

/** Lignée → club (identifiant API-Football). */
export const CLUB_DE = new Map(
  [0, 20, 40].flatMap((d) => TERRACES.map((club, i) => ['AN'.concat(d + i + 1), club])));

/** La racine d'une lignée : « AN12C » → « AN12 », « AN3B » → « AN3 ». */
const racine = (id) => String(id ?? '').replace(/^([A-Z]{2}\d+)[A-Z]?$/, '$1');

/** Le club d'un Fanzzy, ou `null` s'il est neutre. */
export function clubDe(fanzzyId) {
  return CLUB_DE.get(racine(fanzzyId)) ?? null;
}

/**
 * Ce Fanzzy est-il lié au club `teamId` ? Faux pour un neutre ou un match sans club.
 *
 * `clubAchete` : le club auquel le joueur a lié lui-même un Fanzzy neutre,
 * contre des écharpes (`user_fanzzy.club_id`). Le club d'une série de
 * championnat passe devant : il ne s'achète pas, il est écrit sur la carte.
 */
export function lieA(fanzzyId, teamId, clubAchete = null) {
  const c = clubDe(fanzzyId) ?? (clubAchete == null ? null : Number(clubAchete));
  return c != null && teamId != null && c === Number(teamId);
}

/**
 * Le bonus d'un Fanzzy lié, en modificateurs du moteur.
 *
 * `pushMult` est la force (la corde, au Virage comme au duel). Le gain n'est
 * pas le même d'une arène à l'autre : au Virage, c'est la ferveur
 * (`ferveurBonus`, que `crediter` lit) ; au duel, ce sont les écharpes
 * (`scarvesBonus`), que `recompenser` verse lui-même pour un titulaire lié —
 * aucun moteur ne lit cette clé, elle est là pour que le panneau des bonus
 * dise la vérité.
 *
 * @param {{force:number, gain:number}} taux en fractions : 0,05 pour +5 %.
 * @param {'virage'|'duel'} arene
 */
export function modsDuLien({ force = 0, gain = 0 } = {}, arene = 'virage') {
  return { pushMult: 1 + force, [arene === 'duel' ? 'scarvesBonus' : 'ferveurBonus']: 1 + gain };
}

/** Les taux réglés dans /admin (`fanzzy.lien_force`, `fanzzy.lien_gain`), en fractions. */
export function tauxDuLien() {
  return { force: reglage('fanzzy.lien_force') / 100, gain: reglage('fanzzy.lien_gain') / 100 };
}

/**
 * Pose le lien sur les modificateurs déjà composés : les facteurs se
 * multiplient, comme ceux du lieu ou du KOP. Rend un nouvel objet.
 */
export function avecLien(mods, taux, arene = 'virage') {
  if (!mods) return mods;
  const out = { ...mods };
  for (const [k, v] of Object.entries(modsDuLien(taux, arene))) out[k] = (out[k] ?? 1) * v;
  return out;
}

/**
 * Le deck d'un joueur pour **un** duel : chaque Fanzzy lié au club qu'il
 * soutient porte le bonus dans ses totaux, à tous ses âges — la Relève fait
 * grandir un Fanzzy lié sans qu'il cesse de l'être — et `lien`, le bonus seul,
 * pour que l'écran dise d'où il vient.
 *
 * `teamId` nul (un neutre, un entraînement sans club) rend le deck tel quel.
 * Rend une copie : le loadout lu en base sert aussi à d'autres matchs.
 */
export function lierLeDeck(loadout, teamId, taux) {
  if (!loadout?.fanzzy || teamId == null) return loadout;
  const lien = modsDuLien(taux, 'duel');
  const lier = (age) => ({
    ...age,
    mods: avecLien(age.mods, taux, 'duel'),
    ...(age.modsBanc ? { modsBanc: avecLien(age.modsBanc, taux, 'duel') } : {}),
    lie: true,
    lien,
  });
  return {
    ...loadout,
    fanzzy: loadout.fanzzy.map((f) => (!lieA(f.id, teamId, f.club) ? f : {
      ...lier(f),
      ages: (f.ages ?? []).map(lier),
    })),
  };
}
