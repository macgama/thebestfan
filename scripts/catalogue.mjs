/**
 * Le catalogue illustré : tous les Fanzzy, par famille, avec leurs dessins.
 *
 * ## Ce qu'il est, et ce qu'il n'est pas
 *
 * `dossier.html` dit **où en est le jeu** : ses règles, ses barèmes, ses
 * chiffres. Il ne montre pas une seule image, et c'est très bien — il se lit.
 *
 * Celui-ci est sa suite, et il répond à l'autre question : **qu'est-ce qu'on a
 * dessiné, et qu'est-ce qui manque**. Six cent quarante-trois cartes, deux cent
 * quatre illustrations, douze états par âge et trois âges par personnage : cette
 * comptabilité-là ne tient dans aucune tête, et jusqu'ici elle n'existait nulle
 * part. On savait « il manque des dessins ». On ne savait pas lesquels.
 *
 * La page range donc le catalogue **par famille** — voix, percussion, tifo,
 * pyro, déplacement, fidélité — parce que c'est ainsi que le jeu l'emploie, et
 * pour chaque personnage elle montre sa lignée, ses détails, et une grille de
 * ce qui est dessiné : les trois âges, les douze états, les tenues.
 *
 * ## Pourquoi les images sont dans le fichier
 *
 * Elle doit s'ouvrir seule, hors du site, sur une machine qui n'a pas le dépôt.
 * Une page qui pointe vers `/img/...` est une page vide partout ailleurs. Les
 * vignettes sont donc **réduites et incrustées** : du WebP de cent trente
 * pixels, ce qui suffit à reconnaître un personnage et tient dans un fichier
 * qu'on peut envoyer.
 *
 * On réduit plutôt que d'incruster les originaux : les deux cent quatre bustes
 * pèsent trois mégaoctets et demi en AVIF, et quatre fois plus en base64. Les
 * quatre-vingt-neuf dessins qui manquent encore feraient déborder la page avant
 * qu'elle ne soit finie.
 *
 *   node scripts/catalogue.mjs               écrit catalogue.html à la racine
 *   node scripts/catalogue.mjs --sortie X    écrit ailleurs
 *   node scripts/catalogue.mjs --nu          sans la coque html, pour publier
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { DEX, SETS, TYPES, EVO_COST } from '../src/shared/fanzzy/dex.js';
import { SKINS } from '../src/shared/fanzzy/inventaire.js';
import { ETATS } from '../src/shared/fanzzy/rendus.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const IMG = path.join(RACINE, 'public', 'img', 'fanzzy');
const args = process.argv.slice(2);
const sortie = args.includes('--sortie')
  ? args[args.indexOf('--sortie') + 1] : path.join(RACINE, 'catalogue.html');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* --------------------------------------------------------- les vignettes

   Une image réduite coûte du temps de génération. On ne la fabrique donc
   qu'une fois par fichier source, même si trois endroits de la page la
   demandent — un personnage apparaît dans sa lignée, dans sa grille d'états et
   parfois dans celle d'un autre âge. */

const cache = new Map();
let octets = 0;

/**
 * Réduit une image et la rend en `data:` URI.
 *
 * @param {string} fichier chemin absolu, tel qu'il existe ou non.
 * @param {number} large   largeur voulue, en pixels.
 * @returns {Promise<string|null>} `null` si le dessin n'existe pas — ce qui est
 *   une information, pas une erreur : c'est ce que la page est faite pour dire.
 */
async function vignette(fichier, large) {
  const cle = `${fichier}|${large}`;
  if (cache.has(cle)) return cache.get(cle);
  if (!existsSync(fichier)) { cache.set(cle, null); return null; }
  /* WebP et non AVIF : à cette taille l'écart de poids est de quelques
     centaines d'octets, et le WebP s'affiche partout — y compris dans les
     visionneuses de fichiers locales, qui sont la façon dont cette page sera
     lue la moitié du temps. */
  const buf = await sharp(fichier)
    .resize({ width: large, withoutEnlargement: true })
    .webp({ quality: 62 })
    .toBuffer();
  octets += buf.length;
  const uri = `data:image/webp;base64,${buf.toString('base64')}`;
  cache.set(cle, uri);
  return uri;
}

const buste = (id, large = 128) => vignette(path.join(IMG, `${id}-buste.png`), large);
const plein = (id, large = 190) => vignette(path.join(IMG, `${id}.png`), large);
const etat = (id, evo, skin, nom, large = 104) =>
  vignette(path.join(IMG, id, `e${evo}`, skin, `${nom}.png`), large);

/* ------------------------------------------------------------ les données */

/** Le manifeste des états. Absent, la page dit « rien de dessiné » — c'est vrai. */
const MANIFESTE = await readFile(path.join(IMG, 'index.json'), 'utf8')
  .then((t) => JSON.parse(t).fanzzy ?? {})
  .catch(() => ({}));

const SET_PAR_ID = new Map(SETS.map((s) => [s.id, s]));
const PUBLIE = DEX.filter((f) => f.publie !== false);
/** Un personnage est un âge dont aucun autre n'est la suite. */
const EST_AGE_SUP = new Set(DEX.map((f) => f.evo).filter(Boolean));
const PERSOS = PUBLIE.filter((f) => !EST_AGE_SUP.has(f.id));

/** Les âges d'un personnage, du premier au dernier. */
function lignee(f) {
  const l = [f];
  let x = f;
  while (x?.evo) {
    x = DEX.find((y) => y.id === x.evo);
    if (!x || l.includes(x)) break;
    l.push(x);
  }
  return l;
}

/** Les raretés écrites comme le jeu les écrit — accents compris. */
const NOM_RAR = { commune: 'Commune', rare: 'Rare', epique: 'Épique',
                  legendaire: 'Légendaire' };

/**
 * Les effets, dits comme le jeu les dit.
 *
 * Les mêmes mots que `modsText` dans `public/cartes.js` : un document de
 * référence qui appelle « fenêtre de tempo » ce que la carte appelle « tempo
 * plus tolérant » oblige à traduire dans sa tête, et c'est ainsi qu'on finit
 * par croire qu'il s'agit de deux effets.
 *
 * La table est recopiée plutôt que partagée, et c'est délibéré : `cartes.js`
 * est un script de navigateur chargé par `<script src>`, il n'exporte rien et
 * ne peut rien importer. Le rapprochement se fait donc par un contrôle —
 * `catalogue:test` vérifie que toute clé employée par une carte ou une pièce
 * d'équipement a bien sa phrase là-bas. C'est en l'écrivant qu'on a découvert
 * que `parryResist`, porté par cent trois cartes, n'en avait aucune.
 *
 * Ici, la valeur brute suit la phrase : le joueur n'a pas à la voir, celui qui
 * équilibre le jeu si.
 */
const NOM_MOD = {
  tempoWindow: 'tempo plus tolérant', tempoInterval: 'cadence ralentie',
  mashTime: 'martelage plus court', mashBonus: 'martelage',
  holdBonus: 'endurance', holdForgive: 'lâchers pardonnés',
  perfectBonus: 'geste parfait', backfire: 'retour de flamme au raté',
  parryBonus: 'contre', parryResist: 'résiste au contre',
  breathBonus: 'souffle', refundBonus: 'reprise',
  costPenalty: 'chants plus chers',
};
const modsTexte = (m) => Object.entries(m ?? {})
  .map(([k, v]) => `${NOM_MOD[k] ?? k} ${String(v).replace('.', ',')}`)
  .join(' · ') || '—';

/* ------------------------------------------------------------- le rendu */

/**
 * La grille des états d'un personnage.
 *
 * Douze lignes, trois colonnes. C'est la seule vue qui répond d'un coup d'œil à
 * « qu'est-ce qu'il reste à dessiner sur celui-là », et elle n'existait pas :
 * l'information vivait dans un `index.json` de six cents lignes que personne
 * n'ouvre.
 */
async function grilleEtats(p) {
  const m = MANIFESTE[p.id];
  const ages = lignee(p);
  if (!m) {
    return `<p class="rien">Aucun état dessiné. ${ages.length > 1
      ? `Ses ${ages.length} âges tombent sur le dessin du premier.`
      : 'Il n’a qu’un âge.'}</p>`;
  }

  const skinsVus = new Set();
  for (const e of Object.values(m.evolutions ?? {})) {
    for (const s of Object.keys(e.skins ?? {})) skinsVus.add(s);
  }
  const skins = [...skinsVus];

  const bloc = async (skin) => {
    const lignes = [];
    for (const nom of ETATS) {
      const cells = [];
      for (const evo of [1, 2, 3]) {
        const dispo = m.evolutions?.[`e${evo}`]?.skins?.[skin]?.etats?.includes(nom);
        if (!dispo) { cells.push('<td class="non">—</td>'); continue; }
        const src = await etat(p.id, evo, skin, nom);
        cells.push(src
          ? `<td class="oui"><img src="${src}" alt="${esc(nom)} · âge ${evo}" loading="lazy"></td>`
          : '<td class="oui">✓</td>');
      }
      lignes.push(`<tr><th>${esc(nom)}</th>${cells.join('')}</tr>`);
    }
    return `<div class="skinbloc">
      <h5>${esc(SKINS.find((s) => s.id === skin)?.nom ?? skin)}</h5>
      <table class="etats"><thead><tr><th></th><th>âge 1</th><th>âge 2</th><th>âge 3</th></tr></thead>
      <tbody>${lignes.join('')}</tbody></table></div>`;
  };

  const blocs = [];
  for (const s of skins) blocs.push(await bloc(s));
  return `<div class="skins">${blocs.join('')}</div>`;
}

/**
 * Le dessin d'un âge — **les deux rangements, dans l'ordre**.
 *
 * Le jeu a deux arborescences d'images, et elles ne se nomment pas pareil :
 *
 *   `TR1.png`, `TR1-buste.png`       le plein-pied, rangé par identifiant d'âge
 *   `TR1/e2/base/neutre.png`         les douze états, rangés par **lignée** et
 *                                    numéro d'évolution
 *
 * Un âge supérieur n'a jamais de plein-pied à son nom : `TR1B.png` n'existe
 * pas, et n'a aucune raison d'exister — son repos vit dans `TR1/e2/`. La page
 * ne regardait que le premier rangement, si bien qu'elle affichait
 * « pas dessiné » pour Le Teigneux **au-dessus de ses douze états**, qu'elle
 * montrait deux centimètres plus bas. Le pire genre de faux : il se contredit
 * dans le même écran.
 *
 * L'ordre compte. Le buste est un cadrage fait pour une vignette ; le repos des
 * états est un plein-pied. On prend ce qui existe, en préférant ce qui est
 * fait pour cette taille-là.
 */
async function dessinDe(age, racine, stade, large = 128) {
  return (await buste(age.id, large))
    ?? (await plein(age.id, large))
    ?? (await vignette(path.join(IMG, racine, `e${stade}`, 'base', 'neutre.png'), large));
}

/** Ce même dessin existe-t-il, sans le produire ? Pour les comptes. */
const aUnDessin = (age, racine, stade) =>
  existsSync(path.join(IMG, `${age.id}.png`))
  || existsSync(path.join(IMG, racine, `e${stade}`, 'base', 'neutre.png'));

/** La lignée en images : les âges, avec ce que chacun coûte. */
async function bandeAges(p) {
  const ages = lignee(p);
  const cases = [];
  for (const [i, a] of ages.entries()) {
    const src = await dessinDe(a, p.id, i + 1);
    cases.push(`<div class="age${src ? '' : ' vide'}">
      ${src ? `<img src="${src}" alt="${esc(a.nom)}" loading="lazy">`
        : '<div class="apas">pas dessiné</div>'}
      <b>${esc(a.nom)}</b>
      <span class="r r-${esc(a.rar)}">${esc(NOM_RAR[a.rar] ?? a.rar)}</span>
      <span class="c">${a.stage > 1 ? `${EVO_COST[a.stage] ?? '?'} écharpes` : 'de départ'}</span>
      <span class="cri">${esc(a.cri?.label ?? '—')}${
        a.cri?.power ? ` · ${a.cri.power}` : ''}</span>
      <span class="mods">${esc(modsTexte(a.mods))}</span>
    </div>`);
  }
  return `<div class="ages">${cases.join('')}</div>`;
}

async function fiche(p) {
  const s = SET_PAR_ID.get(p.set);
  const ages = lignee(p);
  const dessines = ages.filter((a, i) => aUnDessin(a, p.id, i + 1)).length;
  return `<article class="perso" id="f-${esc(p.id)}" data-serie="${esc(p.set)}"
      data-dessine="${dessines ? 'oui' : 'non'}">
    <header>
      <h3>${esc(p.nom)}<code>${esc(p.id)}</code></h3>
      <div class="meta">
        <span class="serie" style="--sc:${esc(s?.c1 ?? '#888')}">${esc(s?.nom ?? p.set)}</span>
        <span>${ages.length} âge${ages.length > 1 ? 's' : ''}</span>
        <span>${dessines}/${ages.length} dessiné${dessines > 1 ? 's' : ''}</span>
      </div>
    </header>
    ${p.histoire ? `<p class="hist">${esc(p.histoire)}</p>` : ''}
    ${await bandeAges(p)}
    <details><summary>Les douze états, par âge et par tenue</summary>
      ${await grilleEtats(p)}</details>
  </article>`;
}

/* --------------------------------------------------------------- la page */

const familles = Object.entries(TYPES).map(([cle, t]) => ({
  cle, ...t, membres: PERSOS.filter((f) => f.type === cle),
}));

const sections = [];
for (const fam of familles) {
  const fiches = [];
  for (const p of fam.membres.sort((a, b) =>
    a.set.localeCompare(b.set) || a.nom.localeCompare(b.nom))) {
    fiches.push(await fiche(p));
  }
  const dessines = fam.membres.filter((p) =>
    existsSync(path.join(IMG, `${p.id}.png`))).length;
  sections.push(`<section class="famille" id="fam-${fam.cle}" style="--fc:${fam.c}">
    <h2><svg viewBox="0 0 24 24"><path d="${fam.ico}"/></svg>${esc(fam.nom)}
      <span>${fam.membres.length} personnages · ${dessines} dessinés</span></h2>
    <div class="grille">${fiches.join('')}</div>
  </section>`);
}

const totalPersos = PERSOS.length;
const totalDessines = PERSOS.filter((p) =>
  existsSync(path.join(IMG, `${p.id}.png`))).length;
const avecEtats = Object.keys(MANIFESTE).length;

/* ------------------------------------------------------------- les tenues

   La question qu'on se pose devant un skin est « est-il dessiné, et sur
   combien de personnages ». Sans cette table, la page répondait en creux — les
   grilles d'états ne montrent que les tenues qui existent, donc une tenue
   jamais dessinée n'apparaissait nulle part, et son absence se lisait comme un
   oubli de la page plutôt que comme un état du jeu.

   Une tenue dépubliée reste listée : dix-neuf joueurs la possèdent, et c'est
   la règle du catalogue — rien ne se supprime, on dépublie. */
const tenues = SKINS.map((s) => {
  const porteurs = Object.values(MANIFESTE).filter((m) =>
    Object.values(m.evolutions ?? {}).some((e) => e.skins?.[s.id])).length;
  return { ...s, porteurs };
});
const blocTenues = `<section class="famille" id="tenues" style="--fc:#8257DA">
  <h2><svg viewBox="0 0 24 24"><path d="M8 4l4 2 4-2 4 3-3 3v10H7V10L4 7z"/></svg>Les tenues
    <span>${tenues.length} tenues · ${tenues.filter((t) => t.porteurs).length} dessinées</span></h2>
  <div class="tenues">${tenues.map((t) => `<div class="tenue${
    t.porteurs ? '' : ' vide'}">
    <b>${esc(t.nom)}</b>
    <span class="r r-${esc(t.rar)}">${esc(NOM_RAR[t.rar] ?? t.rar)}</span>
    <span class="c">${t.publie === false ? 'retirée des tirages' : 'en circulation'}</span>
    <span class="n">${t.porteurs
      ? `${t.porteurs} personnage${t.porteurs > 1 ? 's' : ''} dessiné${t.porteurs > 1 ? 's' : ''}`
      : 'aucun dessin'}</span>
    ${t.texte ? `<p>${esc(t.texte)}</p>` : ''}
  </div>`).join('')}</div>
</section>`;

/* La tête de la page : ce qui la nomme et ce qui l'habille.
   Séparée du corps pour pouvoir servir les deux formes — voir plus bas. */
const tete = `<title>Le catalogue Fanzzy</title>
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&display=swap">
<style>
/* La palette est celle du jeu, prise dans ui.css : le noir du stade, la craie
   des maillots, le jaune des projecteurs. Un document de référence qui se
   présente dans d'autres couleurs que le produit qu'il décrit oblige à faire la
   traduction à chaque coup d'œil.

   Un seul thème, assumé : ce jeu est un stade la nuit, et une version claire
   n'aurait rien à dire. Le fond est peint explicitement, donc la page tient sur
   n'importe quel hôte. */
:root{color-scheme:dark;
  --craie:#F2EEE4;--fond:#0A0D11;--pan:#121821;--trait:rgba(242,238,228,.13);
  --projo:#F5C33B;--vert:#1E9E6A;--flare:#E0402C;
  /* Oswald est la police des bandeaux du jeu. Elle porte ici les titres et les
     étiquettes, jamais le texte courant : c'est une police d'affiche, et un
     paragraphe écrit dedans se lit mal. */
  --banner:"Oswald",Impact,"Haettenschweiler","Arial Narrow Bold",sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--fond);color:var(--craie);
  font:14px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
:focus-visible{outline:2px solid var(--projo);outline-offset:2px;border-radius:4px}
a{color:var(--projo)}
.enveloppe{max-width:1180px;margin:0 auto;padding:0 18px 80px}
header.haut{padding:34px 0 20px;border-bottom:1px solid var(--trait);margin-bottom:22px}
header.haut h1{font-family:var(--banner);font-size:30px;letter-spacing:.04em;
  margin:0 0 8px;text-wrap:balance}
header.haut p{margin:0;opacity:.62;max-width:66ch}
.compte{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
.compte div{background:var(--pan);border:1px solid var(--trait);border-radius:10px;
  padding:10px 14px;min-width:120px}
.compte b{display:block;font-family:var(--banner);font-size:26px;color:var(--projo);
  line-height:1.15;font-variant-numeric:tabular-nums}
.compte span{font-size:10.5px;letter-spacing:.09em;opacity:.5;text-transform:uppercase}

nav.familles{position:sticky;top:0;z-index:5;background:rgba(10,13,17,.94);
  backdrop-filter:blur(8px);display:flex;gap:6px;flex-wrap:wrap;
  padding:10px 0;border-bottom:1px solid var(--trait);margin-bottom:20px}
nav.familles a{display:inline-flex;align-items:center;gap:7px;text-decoration:none;
  color:inherit;border:1px solid var(--trait);border-radius:20px;padding:6px 13px;font-size:12px}
nav.familles svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;
  stroke-linecap:round;stroke-linejoin:round}

.famille{margin:0 0 46px}
.famille h2{display:flex;align-items:center;gap:10px;font-family:var(--banner);
  font-size:19px;letter-spacing:.07em;
  margin:0 0 14px;color:var(--fc);text-transform:uppercase}
.famille h2 svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;
  stroke-linecap:round;stroke-linejoin:round}
.famille h2 span{margin-left:auto;font-size:11px;letter-spacing:.08em;opacity:.45;
  color:var(--craie);text-transform:none}

/* align-items:start — sans lui, deplier la grille des etats d un personnage
   etirait toute sa rangee, et ses deux voisines devenaient des colonnes vides
   de huit cents pixels. Pas d accent grave ici : ce bloc CSS vit dans un
   gabarit de chaine, et un seul le refermerait au mauvais endroit. */
.grille{display:grid;gap:14px;align-items:start;
  grid-template-columns:repeat(auto-fill,minmax(330px,1fr))}
.perso{background:var(--pan);border:1px solid var(--trait);border-radius:12px;padding:14px}
.perso[data-dessine=non]{opacity:.72}
.perso header{display:flex;flex-direction:column;gap:5px;margin-bottom:8px}
.perso h3{margin:0;font-family:var(--banner);font-size:17px;letter-spacing:.02em;
  display:flex;align-items:baseline;gap:8px;text-wrap:balance}
.perso h3 code{font:11px ui-monospace,monospace;opacity:.4}
.perso .meta{display:flex;gap:8px;flex-wrap:wrap;font-size:10.5px;opacity:.55}
.perso .serie{color:var(--sc);opacity:1}
.hist{margin:0 0 10px;font-size:12px;opacity:.62;line-height:1.55}

.ages{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.age{flex:1 1 0;min-width:96px;background:rgba(0,0,0,.32);border-radius:9px;padding:8px;
  display:flex;flex-direction:column;gap:3px;text-align:center}
.age img{width:100%;aspect-ratio:1;object-fit:contain;background:rgba(255,255,255,.02);
  border-radius:7px;display:block}
.age .apas{aspect-ratio:1;display:grid;place-items:center;font-size:10px;opacity:.35;
  border:1px dashed var(--trait);border-radius:7px}
.age b{font-size:11.5px;line-height:1.3}
.age .r{font-size:9px;letter-spacing:.08em;text-transform:uppercase;opacity:.75}
.r-commune{color:#C2CAD6}.r-rare{color:#3C82E8}
.r-epique{color:#8257DA}.r-legendaire{color:var(--projo)}
.age .c{font-size:9.5px;opacity:.45}
.age .cri{font-family:var(--banner);font-size:10px;letter-spacing:.03em;
  color:var(--projo);opacity:.85}
.age .mods{font-size:9px;opacity:.45;line-height:1.4}

details{margin-top:10px;border-top:1px solid var(--trait);padding-top:8px}
summary{cursor:pointer;font-size:11.5px;opacity:.6}
.rien{font-size:11.5px;opacity:.45;margin:8px 0 0}
.skins{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px}
.skinbloc h5{margin:0 0 6px;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  opacity:.5}
table.etats{border-collapse:collapse;font-size:10px}
table.etats th{font-weight:500;opacity:.5;text-align:left;padding:2px 6px 2px 0;
  white-space:nowrap}
table.etats thead th{font-size:9px;letter-spacing:.06em;text-transform:uppercase}
table.etats td{padding:2px;text-align:center;width:46px}
table.etats td.non{opacity:.2}
table.etats td.oui img{width:44px;height:44px;object-fit:contain;display:block;
  background:rgba(255,255,255,.03);border-radius:5px}

.tenues{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.tenue{background:var(--pan);border:1px solid var(--trait);border-radius:11px;padding:12px;
  display:flex;flex-direction:column;gap:3px}
.tenue.vide{opacity:.55}
.tenue b{font-family:var(--banner);font-size:15px;letter-spacing:.03em}
.tenue .c{font-size:10px;opacity:.45}
.tenue .n{font-size:11px;color:var(--projo);opacity:.85}
.tenue p{margin:6px 0 0;font-size:11.5px;opacity:.55;line-height:1.5}

footer{margin-top:40px;padding-top:18px;border-top:1px solid var(--trait);
  font-size:11.5px;opacity:.45}
@media (max-width:560px){.grille{grid-template-columns:1fr}}
</style>`;

const corps = `<div class="enveloppe">
<header class="haut">
  <h1>Le catalogue illustré</h1>
  <p>Tous les personnages du jeu, rangés par famille, avec ce qui est dessiné et
  ce qui ne l’est pas. Ce document est produit par <code>scripts/catalogue.mjs</code>
  à partir du catalogue et du disque : il ne peut pas mentir plus longtemps
  qu’une commande. C’est la suite du <b>dossier</b>, qui dit les règles ; celui-ci
  dit les dessins.</p>
  <div class="compte">
    <div><b>${totalPersos}</b><span>personnages</span></div>
    <div><b>${PUBLIE.length}</b><span>cartes publiées</span></div>
    <div><b>${totalDessines}</b><span>premiers âges dessinés</span></div>
    <div><b>${totalPersos - totalDessines}</b><span>à dessiner</span></div>
    <div><b>${avecEtats}</b><span>avec leurs états</span></div>
    <div><b>${ETATS.length}</b><span>états par âge</span></div>
  </div>
</header>

<nav class="familles">${familles.map((f) =>
  `<a href="#fam-${f.cle}"><svg viewBox="0 0 24 24"><path d="${f.ico}"/></svg>${
    esc(f.nom)} <b style="opacity:.45;font-weight:400">${f.membres.length}</b></a>`).join('')}
<a href="#tenues"><svg viewBox="0 0 24 24"><path d="M8 4l4 2 4-2 4 3-3 3v10H7V10L4 7z"/></svg>Les tenues <b style="opacity:.45;font-weight:400">${tenues.length}</b></a>
</nav>

${sections.join('\n')}

${blocTenues}

<footer>
  Un âge supérieur sans dessin tombe sur celui de son premier âge : c’est
  pourquoi « premiers âges dessinés » est le compte qui décide, et non le nombre
  de cartes. Les états ne sont dessinés que pour ${avecEtats} personnage${
  avecEtats > 1 ? 's' : ''} — les autres jouent leur image de repos dans les
  douze situations.<br>
  Généré le ${new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}.
</footer>
</div>`;

/**
 * Deux formes, un seul contenu.
 *
 * Le fichier autonome porte sa coque — on l'ouvre depuis le disque, on l'envoie
 * par courriel, et sans `<!doctype>` un navigateur le rend en mode
 * « quirks » : la page perd sa mise en page sans rien dire.
 *
 * La forme `--nu` n'a que le titre, la feuille et le corps : c'est ce
 * qu'attend la publication en artefact, qui pose elle-même la coque. Les deux
 * viennent des **mêmes** chaînes, sinon l'une des deux prend du retard — et ce
 * serait toujours celle qu'on regarde le moins.
 */
const nu = args.includes('--nu');
const page = nu ? `${tete}\n${corps}\n` : `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${tete}
</head><body>
${corps}
</body></html>`;

await writeFile(sortie, page, 'utf8');
console.log(`Catalogue écrit : ${sortie}${nu ? ' (sans coque)' : ''}`);
console.log(`  ${totalPersos} personnages · ${totalDessines} dessinés · `
  + `${avecEtats} avec états · ${(octets / 1e6).toFixed(1)} Mo d'images réduites`);
console.log(`  page : ${(Buffer.byteLength(page) / 1e6).toFixed(1)} Mo`);
