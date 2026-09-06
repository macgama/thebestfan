/**
 * Contrôle des pages, à passer avant toute livraison front.
 *
 * Il attrape trois fautes que la relecture ne voit pas :
 *
 *   1. **Un script de page qui ne compile pas.** Une page cassée ne prévient
 *      pas : elle s'affiche à moitié et rend la main sans rien dire. On
 *      compile donc chaque bloc <script> inline, plus les fichiers autonomes
 *      de public/.
 *
 *   2. **Un accent grave égaré dans un bloc CSS écrit en gabarit de chaîne.**
 *      Un seul caractère ` au milieu d'une règle CSS ferme le gabarit et
 *      transforme la suite en code. Cette faute a cassé nav.js deux fois. Elle
 *      est invisible à la lecture parce que le reste du fichier a l'air normal,
 *      et le message du moteur pointe cinquante lignes plus bas.
 *
 *   3. **Une page qui oublie la barre commune.** Une page sans nav.js est un
 *      cul-de-sac sur téléphone : plus aucun moyen d'en sortir sans le bouton
 *      retour du navigateur.
 *
 * Usage : node scripts/verif-pages.mjs
 * Sortie : 0 si tout va bien, 1 sinon — utilisable tel quel avant un déploiement.
 */
import { readdir, readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import path from 'node:path';

const DOSSIER = 'public';

/** Pages où la barre commune n'a délibérément pas sa place. */
const SANS_BARRE = new Set(['compte.html', 'bienvenue.html', 'admin.html']);

let fautes = 0;
const ko = (fichier, message) => { fautes++; console.log(` FAIL  ${fichier} — ${message}`); };
const ok = (fichier, message) => console.log(`  ok   ${fichier} — ${message}`);

/**
 * Cherche un accent grave à l'intérieur d'un gabarit de chaîne qui contient du
 * CSS. On ne signale que ce cas précis : un accent grave ailleurs dans le
 * fichier est légitime, c'est justement ce qui rend la faute discrète.
 */
function accentGraveDansCss(code) {
  const soucis = [];
  // Un gabarit qui commence par du CSS reconnaissable : un sélecteur suivi
  // d'une accolade, ou une déclaration de variable personnalisée.
  const gabarits = code.matchAll(/`([^`\\]|\\.)*`/g);
  for (const g of gabarits) {
    const contenu = g[0];
    if (!/[{;]\s*(--|[a-z-]+\s*:)/i.test(contenu)) continue;
    // À l'intérieur du gabarit, un accent grave échappé est suspect : il n'a
    // aucune raison d'être dans du CSS et signale presque toujours une chaîne
    // refermée trop tôt puis rafistolée.
    const idx = contenu.indexOf('\\`');
    if (idx > 0) {
      const ligne = code.slice(0, g.index + idx).split('\n').length;
      soucis.push(`accent grave échappé dans un bloc CSS, ligne ${ligne}`);
    }
  }
  return soucis;
}

/** Compile un morceau de code et renvoie le message d'erreur, ou null. */
function compile(code, nom) {
  try { new Script(code, { filename: nom }); return null; }
  catch (e) { return e.message; }
}

const fichiers = await readdir(DOSSIER);

/* ------------------------------------------------------------ les pages */

for (const nom of fichiers.filter((f) => f.endsWith('.html')).sort()) {
  const html = await readFile(path.join(DOSSIER, nom), 'utf8');
  let blocs = 0;
  let propre = true;

  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    blocs++;
    const erreur = compile(m[2], `${nom} bloc ${blocs}`);
    if (erreur) { ko(nom, `bloc ${blocs} ne compile pas : ${erreur}`); propre = false; }
    for (const s of accentGraveDansCss(m[2])) { ko(nom, s); propre = false; }
  }

  if (!SANS_BARRE.has(nom) && !/src\s*=\s*["']\/nav\.js/.test(html)) {
    ko(nom, 'la barre commune (nav.js) n\u2019est pas chargée : la page est un cul-de-sac');
    propre = false;
  }

  if (propre) ok(nom, `${blocs} bloc${blocs > 1 ? 's' : ''} de script`);
}

/* -------------------------------------------------- les scripts autonomes */

for (const nom of fichiers.filter((f) => f.endsWith('.js')).sort()) {
  // Le paquet du duel est produit par esbuild : il n'est pas relu ici.
  if (nom.endsWith('.bundle.js')) continue;
  const code = await readFile(path.join(DOSSIER, nom), 'utf8');
  const erreur = compile(code, nom);
  if (erreur) { ko(nom, `ne compile pas : ${erreur}`); continue; }
  const soucis = accentGraveDansCss(code);
  for (const s of soucis) ko(nom, s);
  if (!soucis.length) ok(nom, 'compile');
}

/* ------------------------------------------------ cohérence du catalogue */

/**
 * `public/fanzzy.html` a longtemps gardé sa propre copie du catalogue, et
 * cette copie avait divergé : la lignée du Gamin de Devant y manquait alors
 * que le serveur la tirait des boosters, et un G1 sorti d'un paquet cassait
 * l'ouverture.
 *
 * La page lit maintenant `/api/fanzzy/dex`. Ce contrôle garde la porte
 * fermée : il refuse qu'un catalogue soit à nouveau écrit en dur, parce
 * qu'une copie qu'il faut penser à mettre à jour finit toujours par ne plus
 * l'être.
 */
{
  const html = await readFile(path.join(DOSSIER, 'fanzzy.html'), 'utf8');

  // Un catalogue recopié se reconnaît à une suite d'entrées littérales.
  const entrees = [...html.matchAll(/\{\s*id:\s*'[A-Z]\d+'\s*,\s*nom:/g)].length;
  if (entrees > 2) {
    ko('fanzzy.html', `${entrees} Fanzzy écrits en dur : le catalogue est de nouveau `
      + 'recopié au lieu d\u2019être lu depuis /api/fanzzy/dex');
  } else if (!/['"`]\/dex['"`]|api\/fanzzy\/dex/.test(html)) {
    ko('fanzzy.html', 'le catalogue n\u2019est ni recopié ni demandé au serveur');
  } else {
    ok('fanzzy.html', 'catalogue lu depuis /api/fanzzy/dex, aucune copie locale');
  }

  // Une illustration promise mais absente laisse un cadre vide sans message.
  const illu = [...(html.match(/ILLUSTRES = new Set\(\[([^\]]*)\]/)?.[1] ?? '')
    .matchAll(/'([A-Z0-9]+)'/g)].map((m) => m[1]);
  const manquants = [];
  for (const id of illu) {
    for (const variante of ['', '-buste']) {
      for (const ext of ['.avif', '.webp', '.png']) {
        const f = path.join(DOSSIER, 'img', 'fanzzy', id + variante + ext);
        try { await readFile(f); } catch { manquants.push(id + variante + ext); }
      }
    }
  }
  if (manquants.length) ko('fanzzy.html', `illustrations annoncées mais absentes : ${manquants.join(', ')}`);
  else ok('fanzzy.html', `${illu.length} illustration(s) présentes en trois formats`);
}

console.log(fautes
  ? `\n${fautes} faute(s) — ne pas livrer en l\u2019état.`
  : '\nToutes les pages compilent, la barre est partout où elle doit être.');
process.exit(fautes ? 1 : 0);
