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

console.log(ko ? `\n${ko} échec(s)\n` : '\ntout est vert\n');
process.exit(ko ? 1 : 0);
