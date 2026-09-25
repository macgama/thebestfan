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

/* `--sans-liste` : la chaîne enchaîne sinon `maj-illustres`, qui réécrit le vrai
   `public/fanzzy-art.js` d'après le vrai dossier d'images. Un test n'a pas à
   modifier un fichier livré — et celui-là aurait remis les empreintes à jour
   juste avant le contrôle qui doit dire si elles le sont. */
const sortie = execFileSync('node', [path.join(REPO, 'scripts/fanzzy-images.mjs'),
  brut, '--sortie', out, '--sans-liste'], { encoding: 'utf8' });
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
  brut2, '--sortie', out2, '--sans-liste'], { encoding: 'utf8' });
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
  /* **167 → 217, relevé en connaissance de cause** — le seul motif admissible,
     et il tient en une phrase : cinquante de ces cartes affichaient le dessin
     de quelqu'un d'autre.

     Dix-sept illustrations étaient rangées sous un identifiant `X<n>` qui ne
     leur appartenait pas. Le même lot avait été livré deux fois : nommé à la
     main le 6-7 septembre, puis remis le 8 en passant par `rendus.js`, qui l'a
     posé sur ses vraies cartes. Dans chacune des dix-sept paires, le côté `X`
     n'a aucun numéro de rendu et le côté nommé en a un — le constat est net et
     il ne souffre pas d'interprétation. Les fichiers `X` sont partis dans
     `art/_doublons/`, et leurs âges supérieurs ont perdu leur repli avec eux.

     S'y ajoute la lignée TR37/TR37B/TR37C, qui s'appelait « Le Gamin de Devant » et
     était Le Petit Teigneux (TR1) écrit une seconde fois.

     Cinquante cartes de plus sans dessin, donc, et c'est un progrès : **une
     silhouette dit « pas encore dessiné », un visage emprunté dit une chose
     fausse.** La dette n'a pas augmenté, elle vient seulement d'être comptée
     juste. */
  /* 217 → 244. Vingt-sept de plus, et pour une fois ce n'est pas une
     correction : **ce sont des cartes neuves**. LA TRIBUNE avait quarante et
     une communes jouables en face de dix légendaires ; les neuf ajoutées la
     portent à cinquante, et chacune arrive avec ses deux âges.

     C'est la seule raison admissible de relever ce cliquet en plus de celles
     déjà écrites : du contenu ajouté, et non du contenu perdu. */
  /* 244 → 179. Les vingt-sept premiers âges de LA TRIBUNE sont dessinés, et
     chacun en emporte deux derrière lui : la série est complète, cinquante
     communes et dix légendaires, toutes avec un visage.

     Le cliquet **descend** ici, et c'est le seul sens dans lequel on peut le
     bouger sans s'expliquer. Le laisser à 244 laisserait passer sans bruit la
     perte de soixante-cinq dessins. */
  /* 179 → 220. Quarante et une de plus, et c'est **du contenu ajouté** : la
     série LA REPRISE, douze lignées communes de trois âges et cinq légendaires.
     Elles n'ont aucune image et elles n'en auront pas avant que quelqu'un les
     dessine — 1 476 fichiers d'états et 41 cartes.

     C'est la seule raison admissible de relever ce cliquet, et elle est déjà
     écrite au-dessus : on le bouge pour du contenu neuf, jamais pour du contenu
     perdu. Le laisser à 179 aurait voulu dire refuser toute nouvelle série tant
     qu'elle n'est pas dessinée — ce qui interdirait d'écrire une saison avant de
     l'illustrer, alors que c'est l'ordre naturel.

     `npm run dessins --serie RP` dit où en est cette dette-là. */
  /* 220 → 233. **Deux mouvements en un**, et ils ne s'autorisent pas de la même
     façon : il faut donc les dire séparément, sans quoi on ne saurait jamais
     lequel des deux a payé pour l'autre.

     **D'abord il descend, de 220 à 179.** Les dix-sept premières lignées de LA
     REPRISE ont été dessinées depuis que ce cliquet a été posé. Le laisser à 220
     aurait laissé passer sans bruit la perte de ces quarante et un dessins — et
     c'est exactement ce que la note du dessus reproche à un cliquet qu'on
     n'abaisse pas. Descendre est toujours permis, et ici c'était dû.

     **Ensuite il remonte, de 179 à 233.** Cinquante-quatre cartes neuves :
     dix-huit lignées communes de trois âges, ajoutées à LA REPRISE parce qu'elle
     est la série d'ouverture et que douze humains laissaient croire que le jeu
     ne collectionne que des supporters. Un oiseau, une antenne, un lierre, un
     drone, une salamandre, un car — chacune fait signe vers une famille de
     personnages qui vit ailleurs au catalogue. Voir l'en-tête de `dex-saison.js`,
     qui dit aussi pourquoi les saisons suivantes reviendront à douze.

     C'est du contenu **ajouté**, donc la seule raison admissible, celle qui est
     déjà écrite trois fois au-dessus. Elles n'ont aucune image et elles n'en
     auront pas avant que quelqu'un les dessine : 1 944 fichiers d'états et 54
     cartes. `scripts/fanzzy_prompts.py` sait écrire leurs prompts ;
     `npm run dessins --serie RP` dit ce qu'il reste. */
  const DETTE = 233;
  check(`et ${DEX.length - avec} cartes restent sans dessin d’aucune sorte`,
    DEX.length - avec <= DETTE
    || (console.log('        ', DEX.filter((f) => !adresse(f.id))
      .slice(0, 8).map((f) => f.id).join(' ')),
      console.log(`        — la dette était de ${DETTE} : ce lot ajoute des `
        + 'cartes sans dessin. Lance `npm run images`, ou relève le cliquet '
        + 'en connaissance de cause.'), false));
  console.log(`     ${enPropre} dessinées · ${gagnees} par leur premier âge · `
    + `${DEX.length - avec} sans rien`);

  /* ---------------------------------------- une carte redessinée arrive

     Les images sont servies « immuables, un an », et le service worker les
     garde sans les redemander. **RP1 a changé de visage sous la même
     adresse**, et qui avait vu l'ancien l'aurait gardé un an. L'adresse
     porte donc l'empreinte du fichier : ce contrôle la recalcule sur le
     disque, pour chaque carte dessinée, et la compare à celle que le jeu
     sert. Il rougit si l'on a remplacé une image sans relancer
     `maj-illustres` — c'est-à-dire exactement quand l'ancien dessin
     resterait coincé chez les joueurs. */
  const { empreinteIllustration } = await import('./empreinte-illustration.mjs');
  const IMG = path.join(REPO, 'public', 'img', 'fanzzy');
  const perimees = [];
  for (const id of ILLUSTRES) {
    const attendue = empreinteIllustration(IMG, id);
    for (const variante of ['buste', 'plein']) {
      const src = adresse(id, variante) ?? '';
      if (!src.endsWith(`?v=${attendue}`)) perimees.push(`${id} (${variante}) : ${src}`);
    }
  }
  check(`chaque carte dessinée porte l’empreinte de son image (${ILLUSTRES.size})`,
    perimees.length === 0
    || (console.log('        ', perimees.slice(0, 4).join(' | ')),
      console.log('         — une image a changé sans que l’empreinte suive : '
        + 'lance `node scripts/maj-illustres.mjs`.'), false));
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

  /* **Zéro, et ce n'est plus un cliquet : c'est une règle.**

     Il y en avait dix-sept quand ce contrôle a été écrit, toutes dues au même
     lot livré deux fois. Elles sont parties d'un coup, parce qu'il ne s'agissait
     pas de dessiner dix-sept images mais de retirer dix-sept fichiers rangés
     sous le mauvais nom.

     Le seuil reste donc à zéro, et il n'a aucune raison de remonter : deux
     cartes ne peuvent pas montrer le même rendu. Le jour où une livraison en
     réintroduit une, ce contrôle rougit avant que personne ne l'ait vue. */
  const JUMEAUX = 0;
  check(jumeaux.length
    ? `${jumeaux.length} paire(s) de cartes partagent un rendu`
    : 'aucune carte ne porte le dessin d’une autre',
    jumeaux.length <= JUMEAUX
    || (console.log('        ', jumeaux.slice(0, 6)
      .map(([a, b]) => `${a.id}=${b.id}`).join('  ')),
      console.log('        — deux cartes ne peuvent pas montrer le même rendu. '
        + '`npm run doublons` les met côte à côte ; le fichier à retirer est '
        + 'celui dont l’identifiant n’a pas de numéro dans rendus.js.'), false));
  if (jumeaux.length) {
    console.log(`     ${jumeaux.length} paire(s) : `
      + jumeaux.slice(0, 4).map(([a, b]) => `${a.id}≡${b.id}`).join(' · ')
      + (jumeaux.length > 4 ? ' …' : ''));
  }
}

await rm(tmp, { recursive: true, force: true });
/* ============== les deux tables des familles d'état, et leur écart

   `FAMILLE` dit de quel dessin se sert chacun des douze moments. Elle vit
   dans `src/shared/fanzzy/rendus.js`, qui fait foi — et elle est **recopiée**
   dans `public/fanzzy-etats.js`, parce que ce fichier est servi au navigateur
   comme script classique et ne peut rien importer de `src/`. `ETATS` y est
   recopiée depuis bien plus longtemps, pour la même raison.

   Une copie non surveillée finit toujours par diverger, et celle-ci
   divergerait en silence : un moment rangé dans une famille ici et dans une
   autre là-bas ne casse rien — il montre simplement le mauvais visage, ce
   qu'aucune suite ne remarque et qu'un joueur remarque tout de suite.

   On compare donc les deux, clé par clé. C'est le prix d'avoir le droit de
   recopier. */
{
  const source = await import('../src/shared/fanzzy/rendus.js');
  const client = await readFile(path.join(REPO, 'public/fanzzy-etats.js'), 'utf8');

  /* On lit la table du client dans son texte : la charger voudrait dire
     exécuter un script écrit pour un navigateur. */
  const bloc = /const FAMILLE = \{([\s\S]*?)\};/.exec(client)?.[1] ?? '';
  const copie = {};
  for (const m of bloc.matchAll(/(\w+)\s*:\s*(null|'([^']*)')/g)) {
    copie[m[1]] = m[2] === 'null' ? null : m[3];
  }

  check(`la table des familles est lisible côté client (${Object.keys(copie).length} moments)`,
    Object.keys(copie).length > 0
    || (console.log('        FAMILLE introuvable dans public/fanzzy-etats.js'), false));

  const ecarts = [];
  for (const [moment, fam] of Object.entries(source.FAMILLE)) {
    if (!(moment in copie)) { ecarts.push(`${moment} absent du client`); continue; }
    if (copie[moment] !== fam) {
      ecarts.push(`${moment} : ${fam ?? "null"} ici, ${copie[moment] ?? "null"} là-bas`);
    }
  }
  for (const moment of Object.keys(copie)) {
    if (!(moment in source.FAMILLE)) ecarts.push(`${moment} en trop côté client`);
  }
  check('et elle dit exactement la même chose que celle de rendus.js',
    ecarts.length === 0
    || (console.log('        ', ecarts.join(' · ')), false));

  /* Chaque famille nommée doit être un état qui se dessine, sinon le pont
     mène dans le vide et le moment retombe sur neutre sans que rien ne le
     dise. */
  const inconnues = [...new Set(Object.values(source.FAMILLE).filter(Boolean))]
    .filter((f) => !source.ETATS_DESSINES.includes(f));
  check(`les ${source.ETATS_DESSINES.length} états dessinés couvrent toutes les familles`,
    inconnues.length === 0
    || (console.log('        familles sans dessin :', inconnues.join(', ')), false));

  /* Et chaque moment du jeu doit être rangé, fût-ce dans `null` : un moment
     oublié de la table se résoudrait par `undefined`, ce que la chaîne de
     repli traite comme une famille absente — juste, mais par accident. */
  const orphelins = source.ETATS.filter((e) => !(e in source.FAMILLE));
  check('et les douze moments sont tous rangés', orphelins.length === 0
    || (console.log('        non rangés :', orphelins.join(', ')), false));
}
console.log(ko ? `\n${ko} échec(s)\n` : '\ntout est vert\n');
process.exitCode = ko ? 1 : 0;
