/**
 * **Le booster d'où sort une pièce d'équipement** (choix de Gaël du
 * 2 novembre 2026, carte « Seulement dans son booster »).
 *
 * Une pièce qui appartient à une série — par son préfixe (`an-`, `su-`,
 * `rp-`…) ou par la série posée dans CATALOGUE › CONTENUS (`donnees.serie`,
 * qui l'emporte) — ne tombe que dans les boosters de cette série. Les pièces
 * communes au jeu (identifiant nu : `jumelles`, `tambour`…) et celles d'un
 * skin (`hw-`, `ph-`, `ap-` : ce ne sont pas des séries de Fanzzy) tombent
 * dans tous les boosters.
 *
 * Aucun schéma : la série se lit sur la pièce elle-même. Une nouvelle série de
 * championnat n'a donc rien à déclarer ici — ses pièces prennent son préfixe,
 * et c'est son booster qui les donne dès qu'elles sont ouvertes.
 */
import { SETS } from './dex.js';

const CODES = new Set(SETS.map((s) => s.id));

/** Le code de la série d'une pièce (`'AN'`), ou `null` si elle est commune. */
export function serieDeLaPiece(piece) {
  if (!piece) return null;
  const id = String(piece.id ?? '');
  const code = piece.serie
    ?? (id.includes('-') ? id.split('-')[0].toUpperCase() : null);
  return code && CODES.has(code) ? code : null;
}

/** La pièce peut-elle sortir d'un booster de la série `setId` ? */
export function tombeDans(piece, setId) {
  const s = serieDeLaPiece(piece);
  return s === null || s === setId;
}
