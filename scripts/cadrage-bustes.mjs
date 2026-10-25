/**
 * Le cadrage du buste, **à la main**, pour les Fanzzy dont le visage n'est
 * pas en haut.
 *
 * Le buste se centre sur la tête, et la tête se trouve en érodant le masque :
 * la première matière épaisse en partant du haut (`centreTete`, dans
 * `fanzzy-images.mjs` et `fanzzy-art.mjs`). C'est juste pour un personnage.
 * C'est faux pour un objet dont le visage est peint au milieu du corps : le
 * haut du Car Remisé est son toit, celui du Briquet Increvable son capot, et
 * la carte montrait une bande de moumoute jaune ou un couvercle, sans un œil
 * (25 octobre 2026, Gaël : « il y a un souci d'affichage avec Car remisé et
 * sa ligne »). Le catalogue entier a été passé en revue ce jour-là, les 776
 * bustes et portraits : ceux d'ici sont ceux où l'on ne voyait pas le visage.
 *
 * Une entrée par carte — un âge : `RP34` le premier, `RP34B` le deuxième,
 * `RP34C` le troisième. Elle vaut pour le buste plat (`RP34C-buste`) et pour
 * les portraits de toutes les tenues de cet âge (`RP34/e3/<tenue>/portrait`).
 *
 *   y  le milieu du carré, en part de la hauteur du sujet (0 = son sommet) ;
 *   c  le côté du carré, en part de la hauteur du sujet (0,42 d'ordinaire).
 *
 * Un carré qui déborde de l'image se complète de vide : le sujet est détouré.
 *
 * Pour en ajouter un : une ligne ici, puis `node scripts/recadrer-bustes.mjs`.
 */
export const CADRAGES = {
  // Le car : le visage est sur la calandre, sous le pare-brise.
  RP34: { y: 0.62, c: 0.9 }, RP34B: { y: 0.62, c: 0.9 }, RP34C: { y: 0.64, c: 0.85 },
  // Le briquet : le visage est sur le corps, sous la mèche et le capot.
  RP32: { y: 0.48, c: 0.62 }, RP32B: { y: 0.48, c: 0.62 },
  // La bannière : le visage est au tiers, sous la hampe.
  RP28: { y: 0.42, c: 0.5 }, RP28B: { y: 0.42, c: 0.5 }, RP28C: { y: 0.36, c: 0.52 },
  // Le robot : en drone, ses hélices font le haut.
  RP29B: { y: 0.36, c: 0.6 }, RP29C: { y: 0.32, c: 0.56 },
  // La théière : le bonnet prenait tout le carré.
  AN46: { y: 0.47, c: 0.6 }, AN46B: { y: 0.47, c: 0.6 }, AN46C: { y: 0.45, c: 0.62 },
  // La cabane : le toit d'abord, le visage plus bas.
  AN47: { y: 0.7, c: 0.62 }, AN47B: { y: 0.64, c: 0.66 }, AN47C: { y: 0.46, c: 0.62 },
  // La cabine : le visage derrière la vitre, au quart.
  AN51: { y: 0.3, c: 0.52 }, AN51B: { y: 0.3, c: 0.52 }, AN51C: { y: 0.3, c: 0.52 },
  // La rhubarbe : la feuille en haut, le visage dessous.
  AN53: { y: 0.27, c: 0.46 }, AN53B: { y: 0.27, c: 0.46 }, AN53C: { y: 0.27, c: 0.46 },
  // Le crabe : une pince levée passait pour une tête.
  BG5: { y: 0.42, c: 0.66 },
  // Le bocal : le couvercle passait pour une tête.
  RV1: { y: 0.42, c: 0.62 },
};

/** La carte d'un âge : `RP34` et 3 → `RP34C`. */
export const carteDAge = (racine, evo) => `${racine}${['', 'B', 'C'][evo - 1] ?? ''}`;

/**
 * Le buste d'après son cadrage : un carré de `cote` × `cote` posé sur le
 * sujet (`boite`, en pixels de l'image), complété de vide où il déborde,
 * ramené à `taille`.
 *
 * @param {import('sharp')} sharp
 * @param {Buffer} rgba    pixels RGBA de l'image entière
 * @param {number} l       largeur de l'image
 * @param {number} h       hauteur de l'image
 * @param {{x0:number,y0:number,x1:number,y1:number}} boite
 * @param {{y:number,c:number}} k
 * @param {{l:number,h:number}} taille
 */
export async function bustCadre(sharp, rgba, l, h, boite, k, taille) {
  const haut = boite.y1 - boite.y0 + 1;
  const cote = Math.round(haut * k.c);
  const gx = Math.round((boite.x0 + boite.x1) / 2 - cote / 2);
  const gy = Math.round(boite.y0 + haut * k.y - cote / 2);
  const marge = { top: Math.max(0, -gy), left: Math.max(0, -gx),
    bottom: Math.max(0, gy + cote - h), right: Math.max(0, gx + cote - l) };
  const etendu = await sharp(rgba, { raw: { width: l, height: h, channels: 4 } })
    .extend({ ...marge, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp(etendu)
    .extract({ left: gx + marge.left, top: gy + marge.top, width: cote, height: cote })
    .resize(taille.l, taille.h, { fit: 'cover' });
}
