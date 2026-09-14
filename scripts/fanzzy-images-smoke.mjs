/**
 * Éprouve la chaîne d'images sur un cas fabriqué qui reproduit les trois
 * pièges du § 9 :
 *   — une tache CLAIRE au milieu du sujet, sur fond CLAIR (les cartes
 *     blanches tenues sur fond blanc) : elle doit rester opaque ;
 *   — un bras fin tendu très haut, plus haut que le crâne : le buste ne doit
 *     pas se centrer dessus ;
 *   — un fond uni à détourer.
 */
import { mkdir, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Le repli de lignée s'éprouve sur le vrai `fanzzy-art.js`, monté en bac.
import { Script, createContext } from 'node:vm';
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

/* ------------------------------------- le repli sur la racine de la lignée

   Deux cent soixante-deux cartes du catalogue sont des **âges supérieurs de
   personnages déjà dessinés**. Sans repli, elles tombaient toutes sur le rendu
   procédural — une silhouette géométrique dans un cône de projecteur — alors
   que le bon personnage existe, dessiné, à son premier âge.

   Le contrôle ne mesure pas une image : il mesure **combien de cartes du
   catalogue réel obtiennent une adresse**. C'est le seul chiffre qui dise si le
   repli sert encore à quelque chose, et il rougirait le jour où la règle de
   nommage des âges changerait sans que personne ne prévienne. */
{
  const { DEX } = await import('../src/shared/fanzzy/dex.js');
  const source = await readFile(new URL('../public/fanzzy-art.js', import.meta.url), 'utf8');

  /* Le fichier est un script de navigateur : on lui prête un `document` qui
     sait faire un canvas muet, et on lui prend son global. */
  const bac = createContext({
    window: {}, document: { createElement: () => ({ toDataURL: () => '' }) },
  });
  new Script(source).runInContext(bac);
  const { adresse, ILLUSTRES } = bac.window.FZART;

  const avec = DEX.filter((f) => adresse(f.id)).length;
  const enPropre = DEX.filter((f) => ILLUSTRES.has(f.id)).length;
  const gagnees = avec - enPropre;

  check(`le repli rend un dessin à ${gagnees} âges de personnages déjà dessinés`,
    gagnees > 200
    || (console.log(`        ${enPropre} en propre, ${avec} au total — `
      + 'la règle de nommage des âges a-t-elle changé ?'), false));
  /* **Ce nombre est un cliquet, pas une cible.** Il ne doit jamais monter sans
     qu'on l'ait décidé, et il descend à chaque fournée dessinée.

     Les cent soixante-sept en attente sont du contenu écrit récemment et
     pas encore illustré : les trente et une légendaires ajoutées pour donner un
     sommet à chaque série, et les cent cinquante-deux lignes des cinq séries
     neuves — LES VIP, LA GASTRONOMIE DE COMPTOIR, LES GALÈRES DE DÉPLACEMENT,
     LES PHÉNOMÈNES MÉTÉO, LES HÉROS DU CANAPÉ.

     **Quarante-quatre dessins suffiraient à en effacer cent trente-deux** : les
     âges supérieurs tombent sur le dessin de leur premier âge, et les quarante-
     quatre lignées neuves en ont chacune deux. C'est là qu'il faut mettre la
     prochaine fournée, pas sur les légendaires.

     Elles ne sont pas invisibles pour autant : sans adresse, la fiche tombe sur
     le rendu procédural. Mais une légendaire en silhouette géométrique n'est
     pas une légendaire, et c'est bien une dette. */
  /* 167 → 170, **relevé en connaissance de cause**, ce qui est le seul motif
     admissible. La lignée G1/G2/G3 a changé d'identité : elle s'appelait « Le
     Gamin de Devant » et c'était Le Petit Teigneux (TR1) écrit une seconde
     fois — même âge, même place, même parka. Elle est devenue « Le Faux
     Départ », et ses trois dessins, qui montraient l'autre gamin, sont partis
     dans `art/_doublons/`.

     Trois cartes de plus sans dessin, donc, et c'est un progrès : une
     silhouette dit « pas encore dessiné », un visage emprunté dit une chose
     fausse. */
  const DETTE = 170;
  check(`et ${DEX.length - avec} cartes restent sans dessin d’aucune sorte`,
    DEX.length - avec <= DETTE
    || (console.log('        ', DEX.filter((f) => !adresse(f.id))
      .slice(0, 8).map((f) => f.id).join(' ')),
      console.log(`        — la dette était de ${DETTE} : ce lot ajoute des `
        + 'cartes sans dessin. Lance `npm run images`, ou relève le cliquet '
        + 'en connaissance de cause.'), false));
  console.log(`     ${enPropre} dessinées · ${gagnees} par leur premier âge · `
    + `${DEX.length - avec} sans rien`);
}

/* ======================================= deux cartes, un seul dessin

   La faute la plus coûteuse qu'un jeu de collection puisse commettre, et la
   seule qu'aucun contrôle technique n'attrapait : les deux images existent,
   chacune est valide, chacune est au bon endroit, et le compte des dessins en
   voit deux. Rien n'est cassé. C'est simplement une carte de moins à
   collectionner, et un joueur qui se demande s'il a mal vu.

   Elle est arrivée en nombre : dix-neuf cartes `X<n>` portent le rendu d'une
   autre carte du catalogue. Le même lot a été livré deux fois — nommé par
   identifiant `X` le 7 septembre, puis remis le 8 en passant par les numéros de
   `rendus.js`, qui l'ont posé sur ses vraies cartes. Les fichiers `X` sont
   restés.

   On compare par **empreinte de différence**, jamais par octets : deux rendus
   du même prompt ne sont pas identiques à l'octet — grain, compression, une
   mèche ailleurs — et une comparaison de fichiers n'aurait rien vu.

   Le seuil est serré exprès. À deux bits sur soixante-quatre, c'est le même
   rendu, point. Plus haut, on attrape des personnages qui se ressemblent
   légitimement — un tambour et un abonné en manteau sombre se croisent à six —
   et un contrôle qui se plaint de ce qui va bien est un contrôle qu'on
   désactive. La ressemblance de **conception**, elle, ne se mesure pas : elle
   se regarde, avec `npm run doublons`. */

console.log('\nLes doublons de dessin');

{
  /* Le catalogue est importé ici comme dans le bloc précédent : chacun a sa
     portée, et un import hissé en tête ne servirait qu'à créer une dépendance
     entre deux contrôles qui n'en ont pas. */
  const { DEX } = await import('../src/shared/fanzzy/dex.js');

  const empreinte = async (f) => {
    const { data } = await sharp(f).flatten({ background: '#000000' })
      .greyscale().resize(9, 8, { fit: 'fill' }).raw()
      .toBuffer({ resolveWithObject: true });
    const bits = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) bits.push(data[y * 9 + x] > data[y * 9 + x + 1] ? 1 : 0);
    }
    return bits;
  };

  /* Les âges d'une même lignée sont exclus : ils se ressemblent par
     construction, c'est le personnage qui vieillit, et les compter noierait
     les vraies collisions. */
  const suite = new Set(DEX.map((f) => f.evo).filter(Boolean));
  const racine = new Map();
  for (const f of DEX) {
    let r = f;
    for (let g = 0; g < 8; g++) {
      const p = DEX.find((x) => x.evo === r.id);
      if (!p) break;
      r = p;
    }
    racine.set(f.id, r.id);
  }

  const DOSSIER = new URL('../public/img/fanzzy/', import.meta.url);
  const liste = [];
  for (const f of DEX.filter((x) => x.publie !== false)) {
    const p = new URL(`${f.id}.png`, DOSSIER);
    if (!existsSync(p)) continue;
    liste.push({ id: f.id, nom: f.nom, racine: racine.get(f.id) ?? f.id,
      // `fileURLToPath` : sharp veut un chemin, pas une URL — et l'erreur qu'il
      // rend (« Unsupported input … of type object ») ne dit pas laquelle.
      bits: await empreinte(fileURLToPath(p)) });
  }

  const jumeaux = [];
  for (let i = 0; i < liste.length; i++) {
    for (let j = i + 1; j < liste.length; j++) {
      if (liste[i].racine === liste[j].racine) continue;
      const d = liste[i].bits.reduce((n, v, k) => n + (v === liste[j].bits[k] ? 0 : 1), 0);
      if (d <= 2) jumeaux.push([liste[i], liste[j], d]);
    }
  }

  /* **Cliquet, pas cible.** Dix-sept paires existent au moment où ce contrôle
     est écrit ; les corriger demande dix-sept dessins, pas une commande. Le
     nombre ne doit jamais monter — une carte neuve qui reprend le visage d'une
     autre serait rouge le jour même. Il descend à chaque dessin livré. */
  const JUMEAUX = 17;
  check(`${jumeaux.length} paire(s) de cartes partagent un rendu`,
    jumeaux.length <= JUMEAUX
    || (console.log('        ', jumeaux.slice(0, 6)
      .map(([a, b]) => `${a.id}=${b.id}`).join('  ')),
      console.log(`        — il y en avait ${JUMEAUX}. Une carte neuve porte le `
        + 'dessin d’une autre. `npm run doublons` les met côte à côte.'), false));
  if (jumeaux.length) {
    console.log(`     ${jumeaux.length} paire(s) : `
      + jumeaux.slice(0, 4).map(([a, b]) => `${a.id}≡${b.id}`).join(' · ')
      + (jumeaux.length > 4 ? ' …' : ''));
  }
}

await rm(tmp, { recursive: true, force: true });
console.log(ko ? `\n${ko} échec(s)\n` : '\ntout est vert\n');
process.exitCode = ko ? 1 : 0;
