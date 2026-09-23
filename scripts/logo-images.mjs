/**
 * Les emblèmes : une marque par série, par type et par rareté.
 * ===========================================================
 *
 * ## Pourquoi des pin's, et pas des logos
 *
 * Un « logotype » de série aurait été un dessin plat avec un nom dedans. Deux
 * problèmes : le texte est interdit partout ailleurs dans ce jeu — les
 * générateurs l'écrivent de travers, et il faudrait treize versions par langue
 * — et un aplat vectoriel n'appartient à rien.
 *
 * Le jeu est une collection, et ce que les supporters collectionnent vraiment
 * s'épingle sur une écharpe. Les emblèmes sont donc des **pin's émaillés** :
 * métal, émail, un objet reconnaissable dedans. Ça se lit à vingt pixels par
 * sa silhouette, ça se regarde à deux cents par sa matière, et ça a une raison
 * d'exister dans ce monde-là.
 *
 * ## Les trois familles, et pourquoi elles ne servent pas au même
 *
 * — **série** : c'est celle qui manquait. Le classeur trie par série depuis
 *   septembre 2026 et ne le montrait nulle part : les cartes changeaient de
 *   monde sans qu'une ligne le dise. L'emblème ouvre chaque rubrique.
 *
 * — **type** et **rareté** : les six types ont déjà leur glyphe SVG et leur
 *   couleur, les quatre raretés leur marque (`♛`, `★`, des points). Ces
 *   marques-là **restent** : elles tiennent à vingt pixels, elles ne coûtent
 *   pas une requête, et elles ne peuvent pas manquer. L'emblème vient
 *   **par-dessus**, aux endroits où l'on a la place — la fiche, le kiosque —
 *   selon la règle déjà écrite dans `deck.html` : « le dessin se pose après le
 *   glyphe, pas à sa place ».
 *
 * ## Usage
 *
 *   node scripts/logo-images.mjs --invites   (imprime les invites)
 *   node scripts/logo-images.mjs             (range les rendus déposés)
 *
 * Les rendus se déposent dans `art/logo/`, un fichier par emblème, nommé
 * `<famille>-<id>` : `serie-RP.png`, `type-voix.png`, `rarete-legendaire.png`.
 * Les sources restent **hors de `public/`**, comme partout ailleurs ici.
 */
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SETS, TYPES } from '../src/shared/fanzzy/dex.js';
import { enIcone, partSuspecte, ecrireLesTrois } from './detourage.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = path.join(RACINE, 'art', 'logo');
const CIBLE = path.join(RACINE, 'public', 'img', 'logo');

/**
 * Le côté de l'emblème servi.
 *
 * Deux cent cinquante-six comme les objets, et pour la même raison : le plus
 * grand emplacement prévu est la fiche, à cent vingt pixels, et on double pour
 * les écrans à forte densité. Au-delà on ne paierait que du poids.
 */
const COTE = 256;

/* -------------------------------------------------------------- les invites

   Le fond vert de studio est celui de `stuff-images` : aucun emblème du jeu
   n'est vert, et c'est ce qui permet au détourage de ne jamais se tromper. */
const FOND = `Background: a completely flat, uniform, saturated studio green
(#00B140), the exact same colour everywhere. No gradient, no vignette, no
surface, no cast shadow, no reflection, no green glow or green rim spilling
onto the pin itself.`;

const STYLE = `Style: a collectible enamel pin badge, photographed straight on.
Polished metal outline and raised metal dividers, filled with glossy hard
enamel in flat blocks of colour, a single soft highlight across the enamel.
Bold simplified shapes, thick clean silhouette, readable at very small size.
NOT a flat vector logo, NOT a sticker, NOT photorealistic.

Composition: the pin alone, centred, seen straight from the front, filling most
of the frame, floating.

${FOND}

Strictly forbidden: any text, letters, numbers, words, real club crests,
national flags, card frame or border, human faces, hands, watermark.`;

/**
 * Le sujet de chaque emblème.
 *
 * **Une seule idée par pin, et un objet plutôt qu'une scène.** Un emblème qui
 * raconte deux choses ne se reconnaît plus une fois réduit à la taille d'une
 * puce, et c'est à cette taille-là qu'on le verra le plus souvent.
 */
export const INVITES = {
  /* ------------------------------------------------- les treize séries */
  'serie-IM': 'an impossible stairway that loops back into itself, drawn as a '
    + 'terrace of concrete steps, silver metal and pale blue enamel',
  'serie-TR': 'a section of terrace crush barrier — a horizontal rail on two '
    + 'uprights — over three concrete steps, silver metal and warm grey enamel',
  'serie-MS': 'a referee whistle crossed with a wide yard broom, silver metal '
    + 'and deep green enamel',
  'serie-BG': 'the head of an invented shaggy beast with small round horns, '
    + 'facing forward, gold metal and russet brown enamel',
  'serie-RV': 'a simple rounded ghost with two hollow eyes, drifting, silver '
    + 'metal and pale bone-white enamel',
  'serie-OB': 'a crushed paper cup lying on its side with a bent straw, silver '
    + 'metal and faded yellow enamel',
  'serie-EP': 'an hourglass with sand running through it, gold metal and deep '
    + 'amber enamel',
  'serie-VP': 'a single slender champagne flute, gold metal and pale gold enamel',
  'serie-GC': 'a paper tray of thick-cut chips seen from the front, gold metal '
    + 'and warm ochre enamel',
  'serie-GD': 'an old coach seen head on, tilted, with one wheel missing and a '
    + 'wisp of smoke from the bonnet, silver metal and dull orange enamel',
  'serie-MT': 'a single cloud with three straight rain lines and one lightning '
    + 'bolt below it, silver metal and slate blue enamel',
  'serie-HC': 'a plump armchair seen from the front with a television remote '
    + 'resting on its arm, gold metal and deep red enamel',
  'serie-RP': 'a freshly mown football pitch shown as a small rectangle of '
    + 'mowing stripes, with a single green shoot sprouting from its centre, '
    + 'silver metal and two tones of grass green enamel',

  /* ---------------------------------------------------- les six types

     Ils reprennent la silhouette de leur glyphe SVG — mégaphone, tambour,
     cœur, banderole, torche, écharpe — pour qu'on reconnaisse le même signe
     d'un écran à l'autre. Et la couleur de l'émail est **celle du type**,
     déclarée dans `dex.js` : c'est elle qu'on lit d'abord. */
  'type-voix': 'a megaphone seen from the side with sound arcs coming from it, '
    + 'gold metal and bright golden yellow enamel (#F5C33B)',
  'type-perc': 'a marching drum seen from the front with two crossed sticks, '
    + 'silver metal and strong blue enamel (#3C82E8)',
  'type-fide': 'a plain rounded heart, silver metal and pale silver-grey enamel '
    + '(#C2CAD6)',
  'type-tifo': 'a banner hanging from a horizontal pole, its lower edge cut in '
    + 'a shallow V, silver metal and violet enamel (#8257DA)',
  'type-pyro': 'a lit flare held upright with a plume of flame, gold metal and '
    + 'bright red-orange enamel (#E0402C)',
  'type-depl': 'a knitted supporter scarf tied around a signpost, silver metal '
    + 'and deep green enamel (#1E9E6A)',

  /* ------------------------------------------------- les quatre raretés

     Elles montent par la matière autant que par le signe : étain, argent, or,
     or serti. Une rareté se lit de loin ou ne se lit pas. */
  'rarete-commune': 'a plain circular pin with a single small dot in its '
    + 'centre, dull pewter metal and flat grey enamel, no shine',
  'rarete-rare': 'a circular pin with two dots side by side in its centre, '
    + 'polished silver metal and clear blue enamel',
  'rarete-epique': 'a five-pointed star, polished metal and deep violet enamel '
    + 'with a bright highlight',
  'rarete-legendaire': 'a small crown with three points, rich gold metal and '
    + 'warm amber enamel, with tiny faceted gem inserts',
};

/** Tout ce qui doit exister, dans l'ordre où on le fait découvrir. */
export const EMBLEMES = [
  ...SETS.map((s) => ({ cle: `serie-${s.id}`, nom: s.nom, famille: 'série' })),
  ...Object.entries(TYPES).map(([id, t]) => ({ cle: `type-${id}`, nom: t.nom, famille: 'type' })),
  ...['commune', 'rare', 'epique', 'legendaire']
    .map((r) => ({ cle: `rarete-${r}`, nom: r, famille: 'rareté' })),
];

export const inviteDe = (cle) => (INVITES[cle]
  ? `Subject: an enamel pin badge of ${INVITES[cle]}.\n\n${STYLE}` : null);

/* ------------------------------------------------------------- l'exécution

   **Uniquement quand on lance ce script à la main.**

   `verif-pages` importe ce fichier pour une seule chose : la liste des
   emblèmes, qui lui sert à compter ce qui manque. Sans cette garde, cet
   import relançait toute la production — vingt-trois détourages et
   soixante-neuf fichiers réécrits à chaque `npm run pages`.

   Ce n'est pas une hypothèse : c'est arrivé à la première exécution du
   contrôle, qui a imprimé le rapport de détourage au milieu de son propre
   résultat. Un script d'atelier **fait son travail au chargement**, et c'est
   précisément pour ne pas avoir à importer `stuff-images.mjs` que le
   détourage a été sorti dans `detourage.mjs`. La même règle vaut ici.

   `pathToFileURL` et non une comparaison de chaînes : sous Windows,
   `process.argv[1]` arrive en `C:\…` et `import.meta.url` en `file:///C:/…`.
   Comparer les deux tels quels rendrait toujours faux, et le script ne
   produirait plus rien — une panne silencieuse pour un garde-fou. */

const lanceALaMain = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;

if (lanceALaMain) {
  if (process.argv.includes('--invites')) {
    for (const e of EMBLEMES) {
      console.log(`\n=== ${e.cle}  —  ${e.nom} (${e.famille})  →  art/logo/${e.cle}.png`);
      console.log(inviteDe(e.cle) ?? '(aucune invite)');
    }
    console.log('\nDépose les fichiers dans art/logo/, puis : npm run logos');
    process.exit(0);
  }

  const sharp = (await import('sharp')).default;
  await mkdir(CIBLE, { recursive: true });

  if (!existsSync(SOURCE)) {
    console.error(`\n  ${path.relative(RACINE, SOURCE)} n'existe pas.\n\n`
      + '  Les rendus se déposent là, un fichier par emblème, nommé <famille>-<id>.\n'
      + '  Les invites : node scripts/logo-images.mjs --invites\n');
    process.exit(1);
  }

  const sources = (await readdir(SOURCE)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const connus = new Set(EMBLEMES.map((e) => e.cle));
  const orphelins = sources.map((f) => f.replace(/\.[^.]+$/, '')).filter((n) => !connus.has(n));

  let faits = 0;
  const manquants = [];
  const suspects = [];

  for (const e of EMBLEMES) {
    const src = sources.find((f) => f.replace(/\.[^.]+$/, '') === e.cle);
    if (!src) { manquants.push(e.cle); continue; }

    const { png, part } = await enIcone(sharp, path.join(SOURCE, src), COTE, e.cle);
    if (partSuspecte(part)) suspects.push(`${e.cle} (${Math.round(part * 100)} % de fond)`);
    await ecrireLesTrois(sharp, png, CIBLE, e.cle);
    faits++;
    process.stdout.write(`\r  ${faits} emblème(s) rangé(s)`);
  }

  console.log(`\n${faits} emblème(s) détouré(s) en trois formats dans public/img/logo.`);
  if (manquants.length) console.log(`Sans dessin : ${manquants.join(', ')}`);
  if (suspects.length) {
    console.log(`\nDétourage douteux — à regarder : ${suspects.join(', ')}`);
    console.log('Le fond du rendu est-il bien plat et uniforme ?');
  }
  if (orphelins.length) {
    console.log(`\nFichiers qui ne correspondent à aucun emblème : ${orphelins.join(', ')}`);
    console.log('Leur nom doit être exactement <famille>-<id>.');
  }
}
