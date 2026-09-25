/**
 * Détourage sur fond uni, partagé par les chaînes d'icônes.
 * ========================================================
 *
 * ## Pourquoi il vit ici
 *
 * `stuff-images.mjs` portait cette mécanique en entier. `logo-images.mjs` en a
 * eu besoin le jour où les séries ont voulu leur emblème, et il y avait deux
 * issues : la recopier, ou importer l'autre script. La seconde est un piège
 * que ce dépôt a déjà rencontré — un script d'atelier **fait son travail au
 * chargement**, donc l'importer pour une fonction relance toute sa production.
 *
 * Restait la recopie, et ce dépôt sait ce qu'elle coûte : trois copies d'une
 * même liste d'ordre SQL y ont divergé jusqu'à ce que des tables manquent en
 * production. Soixante lignes d'algorithme recopiées auraient divergé de la
 * même façon, en plus discret — un seuil ajusté d'un côté, pas de l'autre, et
 * deux familles d'icônes qui ne se détourent plus pareil.
 *
 * ## Ce qu'il fait
 *
 * Le générateur rend l'objet sur un vert de studio uni. On rend transparent
 * tout ce qui **se propage depuis les bords** avec cette couleur, on adoucit le
 * bord, on recadre sur l'objet, et on réduit à un carré.
 */
import path from 'node:path';

/**
 * Tolérance de couleur, en unités par canal.
 *
 * Le fond demandé est uni, mais un générateur d'images ne rend jamais deux
 * pixels identiques : il reste un bruit de quelques unités. Trop bas, le seuil
 * laisse un grain de fond tout autour de l'objet ; trop haut, il mange les
 * parties de l'objet reliées au bord — la sangle noire d'un mégaphone qui sort
 * du cadre. Quarante-quatre passe les pièces, vérifié à l'œil sur une planche
 * contact.
 */
export const TOLERANCE = 44;

/** Largeur de l'adoucissement du bord, en pixels. */
export const FRANGE = 1.2;

/**
 * Rend l'image transparente partout où le fond se propage depuis les bords.
 *
 * On part de **tous** les pixels du bord, pas d'un coin : un objet qui touche
 * un côté couperait le fond en deux, et la moitié non visitée resterait
 * opaque. C'est arrivé sur une première version avec le mégaphone, dont la
 * sangle sortait par la droite.
 *
 * Écrit dans `data` sur place, et rend de quoi juger le résultat.
 *
 * **`trous`** : rendre transparent aussi le fond **enfermé** dans l'objet —
 * l'œil d'une clé à molette, l'anneau de son manche. La propagation depuis
 * les bords ne l'atteint pas, et c'est voulu en général : un noir intérieur
 * est une ombre, pas un trou. Mais sur le vert de studio, qu'aucun objet du
 * jeu ne porte, un vert intérieur ne peut être que du fond. Les équipements
 * l'activent ; les logos, qui peuvent être verts, non.
 */
export function detourer({ data, width, height }, reference, { trous = false } = {}) {
  const n = width * height;
  const fond = new Uint8Array(n);
  const pile = [];

  const ressemble = (i) => {
    const p = i * 4;
    return Math.abs(data[p] - reference[0]) <= TOLERANCE
      && Math.abs(data[p + 1] - reference[1]) <= TOLERANCE
      && Math.abs(data[p + 2] - reference[2]) <= TOLERANCE;
  };

  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const i = y * width + x;
      if (!fond[i] && ressemble(i)) { fond[i] = 1; pile.push(i); }
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const i = y * width + x;
      if (!fond[i] && ressemble(i)) { fond[i] = 1; pile.push(i); }
    }
  }

  while (pile.length) {
    const i = pile.pop();
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) { const j = i - 1; if (!fond[j] && ressemble(j)) { fond[j] = 1; pile.push(j); } }
    if (x < width - 1) { const j = i + 1; if (!fond[j] && ressemble(j)) { fond[j] = 1; pile.push(j); } }
    if (y > 0) { const j = i - width; if (!fond[j] && ressemble(j)) { fond[j] = 1; pile.push(j); } }
    if (y < height - 1) { const j = i + width; if (!fond[j] && ressemble(j)) { fond[j] = 1; pile.push(j); } }
  }

  /* Seulement sur le vert de studio : les premières pièces ont été rendues sur
     du **noir**, et sur elles la même passe trouait les ombres intérieures —
     jusqu’à un quart de la capuche. */
  const studio = reference[1] > reference[0] + 60 && reference[1] > reference[2] + 60;
  if (trous && studio) {
    for (let i = 0; i < n; i++) if (!fond[i] && ressemble(i)) fond[i] = 1;
  }
  for (let i = 0; i < n; i++) data[i * 4 + 3] = fond[i] ? 0 : 255;
  return { decoupes: fond.reduce((s, v) => s + v, 0), total: n };
}

/**
 * Un fichier rendu par le générateur → une icône carrée à fond transparent.
 *
 * @param sharp   le module, passé par l'appelant : il n'est pas en
 *   `devDependencies` — voir l'explication dans `fanzzy-images.mjs` — et un
 *   module partagé ne doit pas décider à la place de celui qui l'emploie.
 * @param entree  le chemin du rendu.
 * @param cote    le côté du carré produit, en pixels.
 * @param nom     l'identifiant, pour que les messages d'erreur le nomment.
 * @param options `{ trous }` — voir `detourer`.
 * @returns {{png: Buffer, part: number}} l'image détourée, et la part de
 *   l'image qui a été jugée « fond » — voir `partSuspecte`.
 */
export async function enIcone(sharp, entree, cote, nom, options = {}) {
  const { data, info } = await sharp(entree).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });

  /* La couleur de référence est lue dans un coin, pas écrite en dur : le
     générateur rend la couleur demandée à quelques unités près, et d'une image
     à l'autre ce n'est pas le même écart. */
  const reference = [data[0], data[1], data[2]];
  const { decoupes, total } = detourer(
    { data, width: info.width, height: info.height }, reference, options);

  /* On adoucit **le masque seul**, jamais l'image. Un flou posé sur les quatre
     canaux ensemble rendait aussi le dessin flou : la maille d'une écharpe et
     les dents du pavillon d'un mégaphone y perdaient tout leur piqué, pour un
     bord qu'on ne regarde jamais de si près. */
  const n = info.width * info.height;
  const rvb = Buffer.allocUnsafe(n * 3);
  const alpha = Buffer.allocUnsafe(n);
  for (let i = 0; i < n; i++) {
    rvb[i * 3] = data[i * 4];
    rvb[i * 3 + 1] = data[i * 4 + 1];
    rvb[i * 3 + 2] = data[i * 4 + 2];
    alpha[i] = data[i * 4 + 3];
  }

  /* `toColourspace('b-w')` n'est pas décoratif : sans lui, sharp **rend trois
     canaux** pour un masque qui n'en a qu'un. `joinChannel` relit alors le
     tampon avec un pas de un, décale chaque ligne d'un tiers, et sort un objet
     cisaillé — une image fausse, jamais une erreur. La vérification de longueur
     juste en dessous est là pour que ça se dise, si le jour vient où une
     version de sharp change encore d'avis. */
  const masque = await sharp(alpha,
    { raw: { width: info.width, height: info.height, channels: 1 } })
    .blur(FRANGE).toColourspace('b-w').raw().toBuffer();
  if (masque.length !== n) {
    throw new Error(`masque de ${nom} : ${masque.length} octets pour ${n} pixels `
      + `(${masque.length / n} canaux au lieu d'un). Le détourage sortirait cisaillé.`);
  }

  /* Le recollage et la réduction se font en **deux passes**, et pas en une.
     `joinChannel` recolle en fin de chaîne, à la taille d'origine : un `resize`
     posé dans la même chaîne est silencieusement sans effet, et les fichiers
     sortaient en mille vingt-quatre pixels — quatre fois trop lourds, sans un
     mot d'erreur. */
  const pleine = await sharp(rvb,
    { raw: { width: info.width, height: info.height, channels: 3 } })
    .joinChannel(masque, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png().toBuffer();

  /* **On recadre sur l'objet avant de réduire.**
     Les rendus n'arrivent pas tous au même format — un générateur rend parfois
     celui qu'il veut, sans le dire autrement que dans un champ de sa réponse.
     Sans recadrage, `fit:'contain'` ferait tenir une image large dans un carré :
     l'objet, qui occupe la moitié centrale du cadre, se retrouverait au quart
     de la vignette, entouré de vide — plus petit que les autres, et personne ne
     saurait pourquoi. Le fond étant déjà transparent, `trim` coupe exactement
     sur l'objet. */
  const serre = await sharp(pleine).trim({ threshold: 1 }).png().toBuffer()
    .catch(() => pleine);   // une image entièrement pleine n'a rien à couper

  const png = await sharp(serre)
    .resize(cote, cote, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();

  return { png, part: decoupes / total };
}

/**
 * Le détourage a-t-il raté ?
 *
 * Un détourage qui n'emporte presque rien, ou presque tout, a raté : dans le
 * premier cas le fond n'était pas celui qu'on croit, dans le second l'objet
 * lui-même a été mangé. Les deux donnent une image que personne ne regarde
 * avant la mise en ligne — d'où ce contrôle, qui la signale sans la refuser.
 */
export const partSuspecte = (part) => part < 0.2 || part > 0.92;

/**
 * Écrit les trois formats servis, à partir du PNG détouré.
 *
 * L'AVIF et le WebP portent l'alpha aussi bien que le PNG, et pèsent deux à
 * cinq fois moins ; le PNG reste pour les moteurs qui ne prennent ni l'un ni
 * l'autre. Le serveur choisit — voir `src/server/images/index.js`.
 */
export async function ecrireLesTrois(sharp, png, dossier, id) {
  await sharp(png).avif({ quality: 66 }).toFile(path.join(dossier, `${id}.avif`));
  await sharp(png).webp({ quality: 86 }).toFile(path.join(dossier, `${id}.webp`));
  await sharp(png).png({ compressionLevel: 9, palette: true })
    .toFile(path.join(dossier, `${id}.png`));
}
