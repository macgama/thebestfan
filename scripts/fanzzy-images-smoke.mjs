/**
 * Éprouve la chaîne d'images sur un cas fabriqué qui reproduit les trois
 * pièges du § 9 :
 *   — une tache CLAIRE au milieu du sujet, sur fond CLAIR (les cartes
 *     blanches tenues sur fond blanc) : elle doit rester opaque ;
 *   — un bras fin tendu très haut, plus haut que le crâne : le buste ne doit
 *     pas se centrer dessus ;
 *   — un fond uni à détourer.
 */
import { mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';

const REPO = 'C:/Users/gaelm/Documents/GitHub/thebestfan';
const tmp = path.join(process.env.TEMP, 'fz-test');
const brut = path.join(tmp, 'brut');
const out = path.join(tmp, 'out');
await rm(tmp, { recursive: true, force: true });
await mkdir(brut, { recursive: true });

/* ---- on fabrique un rendu : fond blanc, corps sombre, tache blanche ---- */

const L = 600, H = 1000;
const px = Buffer.alloc(L * H * 3, 245);          // fond clair uni

const point = (x, y, [r, g, b]) => {
  if (x < 0 || y < 0 || x >= L || y >= H) return;
  const i = (y * L + x) * 3;
  px[i] = r; px[i + 1] = g; px[i + 2] = b;
};
const disque = (cx, cy, r, c) => {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) point(x, y, c);
    }
  }
};
const rect = (x0, y0, x1, y1, c) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) point(x, y, c);
};

const CORPS = [40, 45, 55];
// Le crâne, centré à x=300.
disque(300, 260, 90, CORPS);
// Le tronc.
rect(220, 340, 380, 880, CORPS);
// Un bras FIN tendu très haut à gauche, plus haut que le crâne (y=120).
rect(120, 120, 150, 420, CORPS);
// Une tache CLAIRE au milieu du tronc, de la couleur du fond : elle ne touche
// pas le bord, donc elle doit rester opaque.
rect(260, 500, 340, 620, [245, 245, 245]);

await sharp(px, { raw: { width: L, height: H, channels: 3 } })
  .png().toFile(path.join(brut, 'ZZ.png'));

/* ------------------------------------------------------------ exécution */

const sortie = execFileSync('node', [path.join(REPO, 'scripts/fanzzy-images.mjs'),
  brut, '--sortie', out], { encoding: 'utf8' });
console.log(sortie.trim());

/* ------------------------------------------------------------ contrôles */

let ko = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) ko++; };

const plein = await sharp(path.join(out, 'ZZ.png')).ensureAlpha()
  .raw().toBuffer({ resolveWithObject: true });
const { width: pl, height: ph } = plein.info;
const a = (x, y) => plein.data[(y * pl + x) * 4 + 3];

check('le plein pied fait 520×945', pl === 520 && ph === 945);
check('les coins sont transparents', a(2, 2) === 0 && a(pl - 3, 2) === 0);

// La tache claire au centre du tronc : opaque, parce qu'aucun chemin ne la
// relie au bord. C'est le piège n°1.
const centreTronc = a(Math.round(pl / 2), Math.round(ph * 0.62));
check('une tache de la couleur du fond, isolée au milieu du sujet, reste opaque',
  centreTronc > 200);

// Le buste doit être centré sur le crâne (x≈300 sur 600, soit le milieu),
// pas sur le bras fin (x≈135, soit à gauche).
const buste = await sharp(path.join(out, 'ZZ-buste.png')).ensureAlpha()
  .raw().toBuffer({ resolveWithObject: true });
const bl = buste.info.width;
let somme = 0, n = 0;
for (let y = 0; y < buste.info.height; y++) {
  for (let x = 0; x < bl; x++) {
    if (buste.data[(y * bl + x) * 4 + 3] > 128) { somme += x; n++; }
  }
}
const centre = n ? somme / n : 0;
check('le buste fait 320×320', bl === 320 && buste.info.height === 320);
check('le buste contient de la matière', n > 2000);
check('le buste est centré sur le crâne, pas sur le bras levé',
  Math.abs(centre - bl / 2) < bl * 0.22);
if (n) console.log(`     centre de masse du buste : x=${Math.round(centre)} sur ${bl}`);

/* ------------------------------- un rendu déjà détouré, le second cas

 * Le lot de septembre 2026 est arrivé avec son canal alpha. La chaîne, elle,
 * cherchait toujours une couleur de fond à écarter — et sous la transparence,
 * le noir résiduel du rendu a été pris pour du sujet : chaque carte est sortie
 * avec un rectangle noir autour du personnage.
 *
 * On refabrique exactement ce cas : alpha propre, RGB noir sous le vide. Si la
 * chaîne se remet à deviner, les coins redeviennent opaques.               */

const brut2 = path.join(tmp, 'brut-alpha');
const out2 = path.join(tmp, 'out-alpha');
await mkdir(brut2, { recursive: true });
{
  const rgba = Buffer.alloc(L * H * 4, 0);        // noir, entièrement transparent
  const pose = (x, y) => {
    if (x < 0 || y < 0 || x >= L || y >= H) return;
    const i = (y * L + x) * 4;
    rgba[i] = 200; rgba[i + 1] = 60; rgba[i + 2] = 60; rgba[i + 3] = 255;
  };
  // Une tête et un tronc, opaques, au milieu d'un vide noir transparent.
  for (let y = 120; y < 300; y++) for (let x = 240; x < 360; x++) pose(x, y);
  for (let y = 300; y < 820; y++) for (let x = 210; x < 390; x++) pose(x, y);
  await sharp(rgba, { raw: { width: L, height: H, channels: 4 } })
    .png().toFile(path.join(brut2, 'AA.png'));
}

const sortie2 = execFileSync('node', [path.join(REPO, 'scripts/fanzzy-images.mjs'),
  brut2, '--sortie', out2], { encoding: 'utf8' });
check('la chaîne annonce qu’elle a lu l’alpha du rendu', /alpha du rendu/.test(sortie2));

const dej = await sharp(path.join(out2, 'AA.png')).ensureAlpha()
  .raw().toBuffer({ resolveWithObject: true });
const dl = dej.info.width;
const da = (x, y) => dej.data[(y * dl + x) * 4 + 3];
check('un rendu déjà détouré garde ses coins transparents',
  da(2, 2) === 0 && da(dl - 3, 2) === 0 && da(2, dej.info.height - 3) === 0);

// Le vrai symptôme n'était pas un coin isolé : c'était un rectangle noir qui
// remplissait presque tout le cadre. On mesure donc la part d'opaque. Le sujet
// fabriqué ici est étroit et haut : après mise au cadre il en couvre environ la
// moitié. Avec la faute, il couvrait la totalité.
//
// On ne peut pas mesurer le pourtour ligne par ligne : le cadrage colle au
// sujet, donc la première et la dernière ligne sont *censées* être pleines.
let opaques = 0;
for (let i = 3; i < dej.data.length; i += 4) if (dej.data[i] > 40) opaques++;
const part = opaques / (dl * dej.info.height);
check('et il n’est pas noyé dans un rectangle noir', part < 0.8);
console.log(`     ${Math.round(part * 100)} % du cadre est opaque`);

await rm(tmp, { recursive: true, force: true });
console.log(ko ? `\n${ko} échec(s)\n` : '\ntout est vert\n');
process.exitCode = ko ? 1 : 0;
