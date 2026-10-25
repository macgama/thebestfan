/**
 * Les championnats qui ont leurs Fanzzy.
 *
 * Demande de Gaël du 25 octobre 2026 : « vu que nous avons les fanzzy pour
 * le championnat de premier league anglaise, il faudrait avoir un effet
 * visuel sur le championnat pour montrer que ce championnat a ses propres
 * fanzzy, ses propres cris ». La liste des matchs du jour et la page du
 * championnat lisent ici la série d'une compétition : son nom, ses couleurs,
 * ses Fanzzy club par club et le cri de chaque club.
 *
 * Une nouvelle série de championnat (FR, IT…) s'ajoute à `SERIES` le jour où
 * ses Fanzzy entrent au catalogue, avec sa table dans `clubs.js`.
 */

import { CLUB_DE, CRI_DU_CLUB } from './clubs.js';
import { SET_TERRACES } from './dex-terraces.js';

/* Compétition (identifiant API-Football) → série. 39 : la Premier League. */
const SERIES = new Map([
  [39, SET_TERRACES],
]);

/** Les Fanzzy d'une série, regroupés par club, dans l'ordre des fiches. */
function parClub(code) {
  const clubs = new Map();
  for (const [fanzzy, club] of CLUB_DE) {
    if (!fanzzy.startsWith(code)) continue;
    if (!clubs.has(club)) clubs.set(club, []);
    clubs.get(club).push(fanzzy);
  }
  return [...clubs].map(([club, fanzzy]) => ({ club, cri: CRI_DU_CLUB.get(club) ?? null, fanzzy }));
}

/**
 * La série d'une compétition, ou `null`. `clubs` donne, pour chaque club, ses
 * Fanzzy et son cri ; le nom et le logo du club viennent de la page, qui les
 * a déjà par les matchs ou le classement.
 */
export function serieDeLigue(leagueId) {
  const set = SERIES.get(Number(leagueId));
  if (!set) return null;
  return { code: set.id, nom: set.nom, ligne: set.ligne, c1: set.c1, c2: set.c2, clubs: parClub(set.id) };
}

/** Le cri d'un club de série, pour la liste des matchs ; `null` hors série. */
export function criDeSerie(teamId) {
  return CRI_DU_CLUB.get(Number(teamId)) ?? null;
}
