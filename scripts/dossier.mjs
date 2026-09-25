/**
 * Le dossier de l'administrateur : où en est le jeu.
 *
 * ## Pourquoi il est *généré* et non écrit
 *
 * Un document qui dit « dix-sept mini-jeux, vingt-neuf cartes, dix stades »
 * est faux le jour où l'on en ajoute un, et personne ne le sait. Celui-ci lit
 * le catalogue réel à chaque passage : les nombres, les règles, les coûts et
 * les barèmes viennent des mêmes modules que le jeu. Il ne peut pas mentir
 * plus longtemps qu'une commande.
 *
 * Ce qui reste écrit à la main, c'est ce qu'aucun module ne sait dire : à quoi
 * sert une mécanique, pourquoi elle existe, et ce qui n'est pas encore fait.
 *
 *   node scripts/dossier.mjs            écrit dossier.html à la racine
 *   node scripts/dossier.mjs --sortie X écrit ailleurs
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEX, SETS, TYPES, RAR, SCARVES, EVO_COST, RATES } from '../src/shared/fanzzy/dex.js';
import { STUFF } from '../src/shared/fanzzy/inventaire.js';
import { ACTIONS, DECK_RULES, dansLeVirage } from '../src/shared/duel/actions.js';
import { CHANTS, ORDRE } from '../src/shared/duel/chants.js';
import { STADES } from '../src/shared/stades.js';
import { GESTURES, GESTES } from '../src/server/ferveur/gestures.js';
import { REGLES, EPREUVES } from '../src/server/ferveur/epreuves.js';
import { SECTIONS, REGLAGES, DEFAUTS } from '../src/shared/reglages.js';
import { PALIERS, XP } from '../src/shared/niveau.js';
/* Les saisons viennent de la base : ce sont elles qui ouvrent les séries. */
import { chargerSaisons, toutesLesSaisons } from '../src/server/fanzzy/saisons.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const sortie = args.includes('--sortie')
  ? args[args.indexOf('--sortie') + 1] : path.join(RACINE, 'dossier.html');

/** Les décimales s'écrivent à la virgule : le dossier est en français. */
const n = (v) => String(v).replace('.', ',');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ------------------------------------------------------------ les données */

/**
 * Les saisons, si une base est joignable.
 *
 * C'est la **seule** donnée de ce dossier qui ne vienne pas du code, et il a
 * bien fallu : ce sont les saisons qui ouvrent les séries, et elles vivent en
 * base parce qu'elles se lancent depuis l'administration.
 *
 * Sans `DATABASE_URL`, ou avec une base injoignable, la liste reste vide et la
 * colonne « ouverte par » dit « — ». C'est exact — le dossier ne sait pas — et
 * c'est très différent d'inventer un chiffre. Un document de référence qui
 * refuse de se générer sans base serait un document qu'on ne génère plus.
 */
/**
 * Ce qui est dessiné, compté **sur le disque**.
 *
 * Ce paragraphe portait trois nombres écrits à la main — « 198 personnages,
 * 262 âges, 183 cartes » — dans un document dont l'en-tête promet qu'il ne peut
 * pas mentir plus longtemps qu'une commande. Ils dataient du lot d'avant, et
 * rien n'aurait prévenu : un chiffre faux a exactement l'air d'un chiffre.
 *
 * Le compte qui décide est celui des **premiers âges**. Un âge supérieur sans
 * dessin tombe sur celui de son premier âge, donc dessiner une lignée efface la
 * dette de tous ses âges d'un coup.
 */
const DESSINS = await (async () => {
  const { existsSync } = await import('node:fs');
  const img = path.join(RACINE, 'public', 'img', 'fanzzy');
  const suite = new Set(DEX.map((f) => f.evo).filter(Boolean));
  const persos = DEX.filter((f) => f.publie !== false && !suite.has(f.id));
  const faits = persos.filter((p) => existsSync(path.join(img, `${p.id}.png`))).length;
  const etats = await import('node:fs/promises')
    .then((fs) => fs.readFile(path.join(img, 'index.json'), 'utf8'))
    .then((t) => Object.keys(JSON.parse(t).fanzzy ?? {}).length)
    .catch(() => 0);
  return { total: persos.length, faits, restent: persos.length - faits, etats };
})();

const SAISONS = await (async () => {
  if (!process.env.DATABASE_URL) return [];
  try {
    const mysql = await import('mysql2/promise');
    const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 1 });
    await chargerSaisons(pool);
    const liste = toutesLesSaisons();
    await pool.end();
    return liste;
  } catch {
    console.warn('  saisons : base injoignable — la colonne « ouverte par » restera vide');
    return [];
  }
})();

const stade1 = DEX.filter((f) => f.stage === 1 && f.publie !== false);
const parSerie = (id) => stade1.filter((f) => f.set === id);
const parRarete = (l, r) => l.filter((f) => f.rar === r).length;

/** Les gestes d'une famille, avec le compte de cartes qui les portent. */
const gestesDe = (type) => (TYPES[type].gestes ?? []).map((g) => ({
  id: g,
  n: stade1.filter((f) => f.type === type && f.cri.gest === g).length,
}));

/* Les chants par geste : c'est par eux qu'on accède à un mini-jeu. */
const chantsDuGeste = (g) => ORDRE.filter((id) => CHANTS[id].gest === g)
  .map((id) => CHANTS[id].nom);

/**
 * La règle d'un mini-jeu, en français.
 *
 * Les nombres viennent des barèmes ; la phrase est écrite ici parce qu'aucun
 * module ne sait dire « tape entre les pulsations ». Les deux sont donc côte à
 * côte, et si un barème change, seul le nombre bouge.
 */
const REGLE_DITE = {
  tempo: (g) => `${g.beats} frappes, une par pulsation de ${g.interval} ms. `
    + `Fenêtre de ±${g.window} ms.`,
  mash: (g) => `Le plus de frappes possible en ${n(g.ms / 1000)} s. `
    + `${g.target} frappes valent le plein.`,
  hold: (g) => `Garder le doigt appuyé ${n(g.need / 1000)} s sans lâcher.`,
  contretemps: (g) => `${g.beats} frappes **entre** les pulsations de ${g.interval} ms. `
    + `Fenêtre plus étroite qu'au tempo : ±${g.window} ms.`,
  echo: (g) => `Un motif de ${g.coups} coups est joué une fois, puis on le refait. `
    + `Unité de ${g.unite} ms, fenêtre ±${g.window} ms. Le motif change à chaque chant.`,
  crescendo: (g) => `${g.coups} frappes en accélérant régulièrement de ${g.debut} `
    + `à ${g.fin} ms. Fenêtre ±${g.window} ms.`,
  relance: (g) => `Tenir au moins ${g.tenirMin} ms, puis lâcher **pile** sur la `
    + `pulsation de ${g.attente} ms. Fenêtre ±${g.window} ms.`,
  salves: (g) => `${g.rafales} rafales de ${g.parRafale} frappes, séparées par des `
    + `silences de ${g.silence} ms. Tolérance ${g.tolerance} ms.`,
  tenue: (g) => `Tenir le plus longtemps possible — mais **lâcher avant ${n(g.limite / 1000)} s**. `
    + `Au-delà, tout est perdu : le seul geste où en faire trop coûte plus cher `
    + `que d'en faire trop peu.`,
  retenue: (g) => `**Exactement ${g.exact} frappes** en ${n(g.ms / 1000)} s. Ni plus, ni moins.`,
  tifo: (g) => `Tracer une forme au doigt en ${n(g.ms / 1000)} s sans quitter le trait. `
    + `Noté sur trois choses multipliées : la précision, le parcours entier, et l'ordre.`,
  memoire: (g) => `${g.paires} paires de visages montrées ${n(g.apercu / 1000)} s, puis `
    + `retournées. Les retrouver en ${n(g.ms / 1000)} s. Un essai raté coûte, moins qu'une `
    + `paire ne rapporte.`,
  mosaique: (g) => `Une grille ${g.cotes}×${g.cotes} dont ${g.allumees} cases s'allument `
    + `${n(g.apercu / 1000)} s, puis s'éteignent. La refaire en ${n(g.ms / 1000)} s. Une case `
    + `fausse annule une case juste.`,
  echarpe: (g) => `${g.tours} tours d'écharpe en ${n(g.ms / 1000)} s, ronds et réguliers, `
    + `dans le sens indiqué. Le sens change d'une fois sur l'autre.`,
  capo: (g) => `Le capo montre une suite de ${g.longueur} coups sur ${g.zones} zones, `
    + `à ${g.pas} ms. Noté sur le **plus long début juste**, pas sur le nombre de coups justes.`,
  tri: (g) => `${g.cartons} cartons de ${g.couleurs} couleurs : ramasser une seule `
    + `couleur en ${n(g.ms / 1000)} s. **Un mauvais carton coûte un bon** — s'arrêter quand `
    + `on n'est plus sûr est un choix qui se défend.`,
  compte: (g) => `Un compte à rebours s'affiche ${n(g.visible / 1000)} s puis **s'éteint**. `
    + `Toucher quand il arrive à zéro : entre ${n(g.cibleMin / 1000)} et ${n(g.cibleMax / 1000)} s, `
    + `tolérance ${n(g.tolerance / 1000)} s. Le seul geste où il n'y a rien à regarder au `
    + `moment d'agir.`,

  /* **Les trois derniers arrivés, et personne ne leur avait écrit de phrase.**

     Le document tombait dessus — `REGLE_DITE[g] is not a function` — et ne
     se produisait plus du tout. Trois gestes sans texte emportaient les
     dix-sept autres, les barèmes, les stades et tout le reste avec eux.

     Les nombres viennent des barèmes, comme partout ici ; la phrase vient de
     ce que le joueur lit à l'écran, dans `public/geste.js`. Les inventer
     depuis les noms de champs aurait mis de fausses règles dans le seul
     document qui prétend les dire. */
  bascule: (g) => `${g.coups} poussées, une toutes les ${g.pas} ms, du côté montré — `
    + `**sauf « à contre-courant »**, environ ${Math.round(g.contrePart * 100)} % des `
    + `coups, où il faut aller de l'autre. Fenêtre ${g.fenetre} ms.`,
  visee: (g) => `${g.cibles} fumigènes s'allument l'un après l'autre, un toutes les `
    + `${g.apparition} ms. Toucher chacun tant qu'il brûle : le bon endroit `
    + `(rayon ${Math.round(g.rayon * 100)} % de la zone) **et** le bon moment `
    + `(note pleine pendant ${g.fenetre} ms, plus rien après ${g.vie ?? g.fenetre} ms, `
    + `quand le fumigène s'éteint).`,
  jauge: (g) => `Garder le curseur dans une bande de ${Math.round(g.largeur * 100)} % `
    + `pendant ${n(g.ms / 1000)} s. Elle tient, puis elle saute : ${g.points} positions, `
    + `${g.transition} ms de transition. Mesuré toutes les ${g.echantillon} ms, et il en `
    + `faut au moins ${g.minMesures} pour que la tenue compte.`,
};

/** Ce que chaque mini-jeu mesure, en un mot. */
const MESURE = {
  tempo: 'la régularité', mash: 'la vitesse', hold: 'la constance',
  contretemps: 'le décalage', echo: 'l’oreille', crescendo: 'l’accélération',
  relance: 'l’instant', salves: 'le découpage', tenue: 'le sang-froid',
  retenue: 'le compte exact', tifo: 'le tracé', memoire: 'la mémoire des paires',
  mosaique: 'la mémoire spatiale', echarpe: 'le geste circulaire',
  capo: 'l’empan mnésique', tri: 'la discrimination rapide',
  compte: 'l’horloge intérieure',
  bascule: 'la lecture d’une consigne qui se retourne',
  visee: 'la main et l’instant, ensemble',
  jauge: 'la correction continue',
};

const LABEL = {
  tempo: 'TEMPO', mash: 'MARTELAGE', hold: 'ENDURANCE', contretemps: 'CONTRETEMPS',
  echo: 'ÉCHO', crescendo: 'CRESCENDO', relance: 'RELANCE', salves: 'SALVES',
  tenue: 'SANG-FROID', retenue: 'MESURE', tifo: 'TIFO', memoire: 'LES VISAGES',
  mosaique: 'MOSAÏQUE', echarpe: 'L’ÉCHARPE', capo: 'LE CAPO', tri: 'LE TRI',
  compte: 'LE COMPTE',
  /* Les mêmes mots que `public/geste.js` : le document nomme les gestes comme
     le jeu les nomme, sans quoi on parlerait de deux choses. */
  bascule: 'LA BASCULE', visee: 'LA VISÉE', jauge: 'LA JAUGE',
};

/** Le gras de Markdown, et rien d'autre : les textes en portent, pas de HTML. */
const gras = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

/** Un modificateur, rendu lisible. */
const FACTEURS = new Set(['tempoWindow', 'mashBonus', 'holdBonus', 'perfectBonus',
  'parryBonus', 'parryResist', 'breathBonus', 'refundBonus', 'costPenalty',
  'pushMult', 'ferveurBonus']);
const NOM_MOD = {
  tempoWindow: 'fenêtre de tempo', tempoInterval: 'cadence', mashBonus: 'martelage',
  mashTime: 'temps de martelage', holdBonus: 'tenue', holdForgive: 'tolérance de tenue',
  parryBonus: 'contre', parryResist: 'résistance au contre', perfectBonus: 'geste parfait',
  backfire: 'retour de bâton', breathBonus: 'souffle', refundBonus: 'reprise',
  costPenalty: 'prix des cartes', pushMult: 'poussée', ferveurBonus: 'ferveur',
};
function modHTML(mods = {}) {
  return Object.entries(mods).map(([k, v]) => {
    const nom = NOM_MOD[k] ?? k;
    if (typeof v === 'boolean') {
      return `<li class="${v ? 'moins' : 'plus'}">${esc(nom)} ${v ? 'oui' : 'non'}</li>`;
    }
    if (FACTEURS.has(k)) {
      const pct = Math.round((v - 1) * 100);
      return `<li class="${pct >= 0 ? 'plus' : 'moins'}">${esc(nom)} ${pct >= 0 ? '+' : ''}${pct} %</li>`;
    }
    /* Les décalages : un temps de martelage *plus court* est un bonus, une
       cadence *plus longue* est un malus. Le signe seul ne suffit pas. */
    const bon = k === 'mashTime' || k === 'tempoInterval' ? v < 0 : v > 0;
    return `<li class="${bon ? 'plus' : 'moins'}">${esc(nom)} ${v > 0 ? '+' : ''}${v}</li>`;
  }).join('');
}

/* ---------------------------------------------------------------- le HTML */

const COULEUR_SET = Object.fromEntries(SETS.map((s) => [s.id, s.c1 ?? '#F5C33B']));

const html = `<title>Le dossier du jeu</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Barlow:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
/* Le jeu se joue de nuit, sous les projecteurs, et ce dossier reste dans ce
   monde quel que soit le thème de qui le lit : parti pris, pas oubli. Toutes
   les couleurs sont donc posées explicitement. */
:root{
  --nuit:#0C0F14; --beton:#161B22; --carte:#1A2029;
  --craie:#EFEBE1; --craie-2:#98A1AC;
  --projo:#F5C33B; --flare:#E0402C; --vert:#4FB98A; --bleu:#5FA8FF;
  --trait:rgba(239,235,225,.11);
  --banner:"Oswald","Arial Narrow",Impact,sans-serif;
  --ui:"Barlow",ui-sans-serif,system-ui,-apple-system,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--nuit);color:var(--craie);font-family:var(--ui);
  font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased;
  background-image:radial-gradient(120% 55% at 50% -12%,rgba(245,195,59,.10),transparent 62%)}
.enveloppe{max-width:1100px;margin:0 auto;padding:0 20px 90px}
b{font-weight:600;color:var(--craie)}
code,.cle{overflow-wrap:anywhere}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em;
  background:var(--beton);padding:1px 5px;color:var(--craie-2)}

/* --------------------------------------------------------------- ouverture */
.tete{padding:54px 0 30px;border-bottom:1px solid var(--trait)}
.eyebrow{font-family:var(--banner);font-size:11px;letter-spacing:.34em;color:var(--projo);
  margin:0 0 14px;text-transform:uppercase}
h1{font-family:var(--banner);font-weight:700;font-size:clamp(36px,7.4vw,66px);line-height:.95;
  letter-spacing:.02em;margin:0;text-wrap:balance}
h1 em{font-style:normal;color:var(--projo)}
.chapo{max-width:64ch;color:var(--craie-2);margin:20px 0 0;font-size:16.5px}
.compte{display:flex;flex-wrap:wrap;gap:22px 38px;margin:30px 0 0;padding:0;list-style:none}
.compte li{display:flex;flex-direction:column;gap:2px}
.compte b{font-family:var(--banner);font-size:29px;line-height:1;font-variant-numeric:tabular-nums;
  color:var(--craie)}
.compte span{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--craie-2)}
.sommaire{display:flex;flex-wrap:wrap;gap:8px;margin:30px 0 0;padding:0;list-style:none}
.sommaire a{display:block;text-decoration:none;color:var(--craie);
  border:1px solid var(--trait);border-left:3px solid var(--projo);
  padding:7px 13px;font-family:var(--banner);font-size:12.5px;letter-spacing:.08em}
.sommaire a:hover{background:var(--beton)}
.sommaire a:focus-visible{outline:2px solid var(--projo);outline-offset:2px}

/* ---------------------------------------------------------------- sections */
.sec{padding:56px 0 0;scroll-margin-top:16px}
.sec-tete{border-top:2px solid var(--projo);padding-top:16px;
  display:flex;align-items:flex-start;gap:18px}
.sec-num{font-family:var(--banner);font-size:42px;line-height:.9;margin:0;
  color:var(--projo);font-variant-numeric:tabular-nums;flex:none}
.sec-tete h2{font-family:var(--banner);font-weight:600;font-size:clamp(21px,3.2vw,29px);
  letter-spacing:.05em;margin:0;line-height:1.06;text-wrap:balance}
.sec-tete p{margin:6px 0 0;color:var(--craie-2);max-width:66ch}
h3{font-family:var(--banner);font-weight:600;font-size:15px;letter-spacing:.15em;
  margin:34px 0 12px;color:var(--craie);text-transform:uppercase}

p{max-width:74ch}
.note{color:var(--craie-2);font-size:13.5px;max-width:72ch}

/* ------------------------------------------------------------------ tables */
table{width:100%;border-collapse:collapse;margin:14px 0 0;font-size:13.5px}
th{font-family:var(--banner);font-size:10px;letter-spacing:.15em;text-transform:uppercase;
  color:var(--craie-2);text-align:left;padding:0 12px 8px 0;font-weight:500;
  border-bottom:1px solid var(--trait);vertical-align:bottom}
td{padding:11px 12px 11px 0;border-bottom:1px solid var(--trait);vertical-align:top}
td.n{font-variant-numeric:tabular-nums;white-space:nowrap}
tr:last-child td{border-bottom:0}
.nom{font-family:var(--banner);font-size:14.5px;letter-spacing:.02em;color:var(--craie)}
.cle{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;
  color:var(--craie-2)}
.dit{color:var(--craie-2);font-size:13px;line-height:1.5}
.tag{display:inline-block;font-family:var(--banner);font-size:9.5px;letter-spacing:.12em;
  text-transform:uppercase;padding:2px 7px;border:1px solid currentColor;white-space:nowrap}
.or{color:var(--projo)} .rouge{color:var(--flare)} .vert{color:var(--vert)}
.bleu{color:var(--bleu)} .gris{color:var(--craie-2)}

/* Sur téléphone une table à cinq colonnes est illisible : chaque ligne devient
   un bloc, et l'en-tête de colonne passe en étiquette devant sa valeur. */
@media (max-width:720px){
  table,thead,tbody,tr,td{display:block;width:100%}
  thead{display:none}
  tr{border-bottom:1px solid var(--trait);padding:12px 0}
  tr:last-child{border-bottom:0}
  /* **L etiquette prend sa propre ligne.**

     Deux essais avant celui-ci. En flex, le contenu d une cellule est un texte
     nu qui ne sait pas retrecir sous sa largeur minimale. En grille a deux
     colonnes, ce n etait pas mieux : un titre suivi d un <span> fait *trois*
     elements avec le pseudo-element, et le troisieme repassait a la ligne dans
     la colonne etroite de quatre-vingt-huit pixels.

     En bloc, il n y a plus ni colonne ni element a repartir : l etiquette est
     au-dessus, la valeur dessous, et rien ne peut deborder. C est aussi ce qui
     se lit le mieux sur un telephone. */
  td{border:0;padding:3px 0 5px;display:block}
  /* En pile, un nombre n'a plus de voisin à bousculer : l'interdiction de
     retour à la ligne ne protège plus rien, et empêche seulement une longue
     valeur de céder. */
  td.n{white-space:normal}
  td::before{content:attr(data-t);display:block;font-family:var(--banner);
    font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
    color:var(--craie-2);margin-bottom:1px}
  td:empty{display:none}
}

/* ------------------------------------------------------------------ cartes */
.cartes{display:grid;gap:1px;margin-top:16px;background:var(--trait);
  border:1px solid var(--trait);grid-template-columns:repeat(auto-fill,minmax(268px,1fr))}
.c{background:var(--carte);padding:14px 16px 16px}
.c-tete{display:flex;align-items:baseline;gap:9px;margin-bottom:5px}
.c-tete .cle{margin-left:auto}
.c h4{font-family:var(--banner);font-weight:600;font-size:16px;letter-spacing:.02em;
  margin:0 0 6px;line-height:1.14;text-wrap:balance}
.c p{margin:0;color:var(--craie-2);font-size:13px;line-height:1.5}
.mods{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:5px}
.mods li{font-size:10.5px;padding:2px 7px;border:1px solid;font-variant-numeric:tabular-nums}
.mods .plus{color:var(--vert);border-color:rgba(79,185,138,.4)}
.mods .moins{color:var(--flare);border-color:rgba(224,64,44,.45)}

/* ------------------------------------------------------------------- barre */
.barre{display:flex;height:8px;margin:6px 0 0;background:var(--beton);overflow:hidden}
.barre i{display:block;height:100%}
.leg{display:flex;flex-wrap:wrap;gap:4px 12px;margin:7px 0 0;padding:0;list-style:none;
  font-size:11.5px;color:var(--craie-2)}
.leg li{display:flex;align-items:center;gap:5px}
.leg em{width:8px;height:8px;display:block;flex:none}
.leg b{font-variant-numeric:tabular-nums}

/* -------------------------------------------------------------------- état */
.etat{display:grid;gap:1px;background:var(--trait);border:1px solid var(--trait);
  grid-template-columns:repeat(auto-fill,minmax(250px,1fr));margin-top:16px}
.e{background:var(--carte);padding:14px 16px}
.e b{display:block;font-family:var(--banner);font-size:13px;letter-spacing:.1em;
  margin-bottom:5px}
.e p{margin:0;font-size:12.5px;color:var(--craie-2);line-height:1.5}
.e[data-f=fait] b{color:var(--vert)}
.e[data-f=partiel] b{color:var(--projo)}
.e[data-f=reste] b{color:var(--flare)}

.pied{margin-top:66px;padding-top:22px;border-top:1px solid var(--trait);
  color:var(--craie-2);font-size:13.5px;max-width:70ch}
.pied p{margin:0 0 12px}
</style>

<div class="enveloppe">

<header class="tete">
  <p class="eyebrow">thebestfan · dossier de développement</p>
  <h1>Le jeu,<br><em>mécanique par mécanique</em></h1>
  <p class="chapo">Ce dossier est <b>généré depuis le code</b> : les nombres, les règles,
    les coûts et les barèmes viennent des mêmes modules que le jeu. Un document écrit à la
    main serait faux au premier ajout, et personne ne le saurait. Il se refait par
    <code>node scripts/dossier.mjs</code>.</p>
  <ul class="compte">
    <li><b>${DEX.length}</b><span>cartes au catalogue</span></li>
    <li><b>${stade1.length}</b><span>personnages tirables</span></li>
    <li><b>${SETS.length}</b><span>séries</span></li>
    <li><b>${GESTES.length}</b><span>mini-jeux</span></li>
    <li><b>${ORDRE.length}</b><span>chants</span></li>
    <li><b>${ACTIONS.length}</b><span>cartes d’action</span></li>
    <li><b>${STUFF.length}</b><span>pièces d’équipement</span></li>
    <li><b>${STADES.length}</b><span>stades</span></li>
  </ul>
  <ul class="sommaire">
    <li><a href="#fanzzy">LE FANZZY</a></li>
    <li><a href="#familles">LES FAMILLES</a></li>
    <li><a href="#series">LES SÉRIES</a></li>
    <li><a href="#minijeux">LES MINI-JEUX</a></li>
    <li><a href="#chants">LES CHANTS</a></li>
    <li><a href="#modes">LES DEUX MODES</a></li>
    <li><a href="#actions">LES CARTES D’ACTION</a></li>
    <li><a href="#stuff">L’ÉQUIPEMENT</a></li>
    <li><a href="#stades">LES STADES</a></li>
    <li><a href="#economie">L’ÉCONOMIE</a></li>
    <li><a href="#reglages">L’ADMINISTRATION</a></li>
    <li><a href="#etat">OÙ ON EN EST</a></li>
  </ul>
</header>

<!-- ====================================================== le Fanzzy -->
<section class="sec" id="fanzzy">
  <header class="sec-tete"><p class="sec-num">1</p><div>
    <h2>Ce qu’est un Fanzzy</h2>
    <p>Dix caractéristiques, dont deux seulement décident de ce qu’il fait en jeu :
      ses modificateurs et son cri.</p>
  </div></header>

  <table>
    <thead><tr><th>Champ</th><th>Exemple</th><th>Ce que c’est</th></tr></thead>
    <tbody>
      <tr><td data-t="Champ"><span class="cle">id</span></td><td data-t="Exemple" class="n">TR1</td>
        <td data-t="Rôle" class="dit">L’identifiant. La lignée s’y lit : <code>TR1</code>,
          <code>TR1B</code>, <code>TR1C</code> sont les trois âges du même personnage.</td></tr>
      <tr><td data-t="Champ"><span class="cle">nom</span></td><td data-t="Exemple">Le Petit Teigneux</td>
        <td data-t="Rôle" class="dit">—</td></tr>
      <tr><td data-t="Champ"><span class="cle">set</span></td><td data-t="Exemple">TR · LA TRIBUNE</td>
        <td data-t="Rôle" class="dit"><b>La série.</b> L’unité de collection : un booster
          tire dans une seule série, et les séries s’ouvrent <b>par saison</b> —
          depuis l’administration, pour tout le monde le même jour.</td></tr>
      <tr><td data-t="Champ"><span class="cle">type</span></td><td data-t="Exemple">voix · Voix</td>
        <td data-t="Rôle" class="dit"><b>La famille.</b> Elle décide des gestes que le
          personnage peut porter — voir la section suivante.</td></tr>
      <tr><td data-t="Champ"><span class="cle">rar</span></td><td data-t="Exemple">commune</td>
        <td data-t="Rôle" class="dit">La rareté. Elle <b>suit l’âge</b> : stade 1 commune,
          stade 2 rare, stade 3 épique. La légendaire est hors échelle.</td></tr>
      <tr><td data-t="Champ"><span class="cle">stage</span></td><td data-t="Exemple" class="n">1</td>
        <td data-t="Rôle" class="dit">L’âge : 1, 2 ou 3. Un booster ne donne que du stade 1 ;
          les suivants s’achètent en écharpes.</td></tr>
      <tr><td data-t="Champ"><span class="cle">evo</span></td><td data-t="Exemple" class="n">TR1B</td>
        <td data-t="Rôle" class="dit">L’âge suivant, ou rien. Une légendaire n’en a
          jamais — c’est sa définition.</td></tr>
      <tr><td data-t="Champ"><span class="cle">histoire</span></td><td data-t="Exemple">« Onze ans, une parka trop grande… »</td>
        <td data-t="Rôle" class="dit">Deux phrases. Elles ne font rien, et c’est
          précisément pour elles qu’on collectionne.</td></tr>
      <tr><td data-t="Champ"><span class="cle">mods</span></td><td data-t="Exemple">tempoWindow ×1,1</td>
        <td data-t="Rôle" class="dit"><b>Ses modificateurs</b>, de un à quatre. Même
          vocabulaire que l’équipement, les KOP et les stades — le moteur ne sait pas d’où
          vient un modificateur, et c’est ce qui permet d’en ajouter sans le toucher.</td></tr>
      <tr><td data-t="Champ"><span class="cle">cri</span></td><td data-t="Exemple">« C’EST PAS FINI » · tempo · 48</td>
        <td data-t="Rôle" class="dit"><b>Sa spécialité.</b> Un libellé, un geste, et une
          puissance. Le geste doit appartenir à sa famille.</td></tr>
    </tbody>
  </table>

  <h3>Le vocabulaire des modificateurs</h3>
  <p class="note">Quinze clés, partagées par les Fanzzy, l’équipement, les stades et les
    bonus de KOP. Un facteur se multiplie (1,1 = +10 %), un décalage s’additionne.</p>
  <table>
    <thead><tr><th>Clé</th><th>Ce qu’elle change</th><th>Sens</th></tr></thead>
    <tbody>${Object.entries(NOM_MOD).map(([k, n]) => `
      <tr><td data-t="Clé"><span class="cle">${esc(k)}</span></td>
        <td data-t="Effet" class="dit">${esc(n)}</td>
        <td data-t="Sens" class="dit">${FACTEURS.has(k) ? 'facteur' : 'décalage'}</td></tr>`).join('')}
    </tbody>
  </table>
</section>

<!-- ===================================================== les familles -->
<section class="sec" id="familles">
  <header class="sec-tete"><p class="sec-num">2</p><div>
    <h2>Les six familles</h2>
    <p>La famille d’un personnage décide des <b>gestes qu’il peut porter</b>. Les
      ${GESTES.length} mini-jeux y sont répartis sans trou ni doublon : chacun appartient à
      une famille et à une seule.</p>
  </div></header>

  <p class="note">Le premier geste de chaque liste est celui qui porte le nom de la
    famille — il équipe la moitié de ses cartes. Les autres sont ses variantes, et elles
    se partagent le reste : sans elles, choisir une Voix voudrait toujours dire choisir
    un tempo.</p>

  <div class="cartes">${Object.entries(TYPES).map(([id, t]) => {
    const g = gestesDe(id);
    const total = g.reduce((n, x) => n + x.n, 0) || 1;
    return `<div class="c">
      <p class="c-tete"><span class="nom" style="color:${t.c}">${esc(t.nom)}</span>
        <span class="cle">${esc(id)} · ${total} cartes</span></p>
      <div class="barre">${g.map((x, i) => `<i style="width:${(x.n / total) * 100}%;
        background:${t.c};opacity:${1 - i * 0.22}"></i>`).join('')}</div>
      <ul class="leg">${g.map((x, i) => `<li><em style="background:${t.c};
        opacity:${1 - i * 0.22}"></em>${esc(LABEL[x.id])} <b>${x.n}</b></li>`).join('')}</ul>
    </div>`;
  }).join('')}</div>
</section>

<!-- ====================================================== les séries -->
<section class="sec" id="series">
  <header class="sec-tete"><p class="sec-num">3</p><div>
    <h2>Les ${SETS.length} séries</h2>
    <p>Un booster tire dans une seule série. Chacune a <b>au moins cinq légendaires</b> —
      c’est son point le plus haut, et une série sans sommet est une série qu’on collectionne
      sans rien espérer. LA TRIBUNE en compte dix : elle a hérité de celles de VIRAGE NORD,
      dissoute avec les NUITS EUROPÉENNES au profit des cinq séries neuves. Aucune carte n’a
      été supprimée — les quarante-deux ont changé de série en gardant leur identifiant, donc
      les collections, les decks et les tenues les ont suivies.</p>
    <p>Une série s’ouvre <b>par saison</b>, depuis l’administration, pour tout le monde
      le même jour — et non plus au niveau de chaque joueur. ${(() => {
    const lancees = SAISONS.filter((x) => x.lancee);
    const nommantes = lancees.filter((x) => x.series.length);
    if (!SAISONS.length) {
      return 'Cette base ne déclare aucune saison — ou n’était pas joignable au moment '
        + 'de générer : toutes les séries sont alors ouvertes.';
    }
    if (!nommantes.length) {
      return `${lancees.length} saison(s) lancée(s), dont aucune ne nomme de série : `
        + 'l’union est vide, ce qui vaut « aucune restriction ». Toutes les séries sont '
        + 'ouvertes.';
    }
    return `${lancees.length} saison(s) lancée(s). Les séries ouvertes sont leur `
      + '<b>union</b> : une saison n’annule jamais la précédente, sans quoi un '
      + 'collectionneur perdrait en route ce qu’il avait commencé.';
  })()}</p>
  </div></header>

  <table>
    <thead><tr><th>Série</th><th>Ce qu’elle raconte</th><th>Stade 1</th><th>Communes</th><th>Légendaires</th><th>Ouverte par</th></tr></thead>
    <tbody>${SETS.map((s) => {
      const l = parSerie(s.id);
      /* Quelle saison a ouvert cette série. Remplace le palier de niveau, qui
         disait à quel niveau elle se débloquait — le niveau n'ouvre plus rien de
         tel. La plus ancienne saison qui la nomme : c'est le jour où elle est
         arrivée dans le jeu qui compte. */
      const saison = [...SAISONS]
        .filter((x) => x.lancee && x.series.includes(s.id))
        .sort((a, b) => a.numero - b.numero)[0];
      return `<tr>
        <td data-t="Série"><span class="nom" style="color:${COULEUR_SET[s.id]}">${esc(s.nom)}</span>
          <br><span class="cle">${esc(s.id)}</span></td>
        <td data-t="Ligne" class="dit">${esc(s.ligne ?? '')}</td>
        <td data-t="Stade 1" class="n">${l.length}</td>
        <td data-t="Communes" class="n">${parRarete(l, 'commune')}</td>
        <td data-t="Légendaires" class="n or">${parRarete(l, 'legendaire')}</td>
        <td data-t="Saison" class="n">${saison ? `saison ${saison.numero}` : '—'}</td></tr>`;
    }).join('')}</tbody>
  </table>

  <h3>L’échelle des raretés</h3>
  <p class="note">Elle disait deux choses à la fois — la force d’un personnage et sa
    rareté au tirage. Elle n’en dit plus qu’une : <b>la rareté suit l’âge</b>.</p>
  <table>
    <thead><tr><th>Rareté</th><th>Ce que c’est</th><th>Un doublon rend</th><th>Y monter coûte</th></tr></thead>
    <tbody>
      <tr><td data-t="Rareté"><span class="tag gris">Commune</span></td>
        <td data-t="Sens" class="dit">Stade 1 — ce qu’un booster donne</td>
        <td data-t="Doublon" class="n">${SCARVES.commune} écharpe</td><td data-t="Coût" class="n">—</td></tr>
      <tr><td data-t="Rareté"><span class="tag bleu">Rare</span></td>
        <td data-t="Sens" class="dit">Stade 2 — s’achète, ne se tire pas</td>
        <td data-t="Doublon" class="n">${SCARVES.rare} écharpes</td>
        <td data-t="Coût" class="n">${EVO_COST[2]} écharpes</td></tr>
      <tr><td data-t="Rareté"><span class="tag" style="color:#B98CFF">Épique</span></td>
        <td data-t="Sens" class="dit">Stade 3 — s’achète, ne se tire pas</td>
        <td data-t="Doublon" class="n">${SCARVES.epique} écharpes</td>
        <td data-t="Coût" class="n">${EVO_COST[3]} écharpes</td></tr>
      <tr><td data-t="Rareté"><span class="tag or">Légendaire</span></td>
        <td data-t="Sens" class="dit">Hors échelle — <b>aucune lignée</b>. Elle ne se
          fabrique pas à l’écharpe, elle se tire.</td>
        <td data-t="Doublon" class="n">${SCARVES.legendaire} écharpes</td><td data-t="Coût" class="n">—</td></tr>
    </tbody>
  </table>
  <p class="note">Un booster tire cinq cartes, dont <b>deux seulement rendent un
    supporter</b> — la première toujours, la deuxième sept fois sur dix. Ce sont elles qui
    portent le tirage de rareté : ${RATES[4][1][1] * 100} % de légendaire sur la première,
    ${RATES[5][1][1] * 100} % sur la deuxième. Les trois autres places rendent un objet,
    une tenue, une carte d’action ou des écharpes.</p>
</section>

<!-- ==================================================== les mini-jeux -->
<section class="sec" id="minijeux">
  <header class="sec-tete"><p class="sec-num">4</p><div>
    <h2>Les ${GESTES.length} mini-jeux</h2>
    <p>C’est ce qu’on fait réellement avec ses doigts. Chacun est <b>noté par le
      serveur</b> à partir des instants de frappe ou de la réponse rendue : le client
      n’attribue jamais de note, et ne connaît aucun nombre de jeu.</p>
  </div></header>

  <p class="note">Les dix premiers sont des <b>gestes de rythme</b> : le serveur reçoit une
    suite d’instants et la juge. Les sept derniers sont des <b>épreuves</b> : le serveur
    envoie une consigne — une forme, une grille, une suite — et note la réponse. Les
    moteurs ne savent pas laquelle est laquelle ; ils demandent une note, ils reçoivent
    une note.</p>

  <table>
    <thead><tr><th>Mini-jeu</th><th>Famille</th><th>Ce qu’il mesure</th><th>La règle</th><th>Son chant</th></tr></thead>
    <tbody>${GESTES.map((g) => {
      const fam = Object.entries(TYPES).find(([, t]) => (t.gestes ?? []).includes(g));
      const epreuve = EPREUVES.includes(g);
      const cfg = epreuve ? REGLES[g] : GESTURES[g];
      const chants = chantsDuGeste(g);
      return `<tr>
        <td data-t="Mini-jeu"><span class="nom">${esc(LABEL[g])}</span>
          <br><span class="cle">${esc(g)}</span>
          ${epreuve ? '<br><span class="tag gris">épreuve</span>' : ''}</td>
        <td data-t="Famille" class="dit" ${fam ? `style="color:${fam[1].c}"` : ''}>${fam ? esc(fam[1].nom) : '—'}</td>
        <td data-t="Mesure" class="dit">${esc(MESURE[g] ?? '')}</td>
        <!-- Un geste neuf sans phrase se signale ici plutôt que de faire
             tomber le document entier : un trou nommé se répare, un script
             qui ne tourne plus se contourne et s’oublie. -->
        <td data-t="Règle" class="dit">${cfg && REGLE_DITE[g]
          ? gras(REGLE_DITE[g](cfg))
          : '<span class="rouge">règle à écrire</span>'}</td>
        <td data-t="Chant" class="dit">${chants.map(esc).join('<br>') || '<span class="rouge">aucun</span>'}</td></tr>`;
    }).join('')}</tbody>
  </table>

  <h3>Comment un joueur y accède</h3>
  <p>Par <b>un chant</b>, et seulement par là — dans les deux modes, depuis que le duel a
    reçu le répertoire du Virage. Le joueur se voit offrir cinq chants parmi
    ${ORDRE.length}, chacun portant son geste, son coût en souffle et sa poussée. Choisir
    un chant, c’est choisir un mini-jeu <em>et</em> une dépense.</p>
  <p class="note">Un geste sans chant est donc <b>injouable</b>, où qu’il soit déclaré par
    ailleurs. C’est arrivé deux fois — aux cinq épreuves, puis au tri et au compte — et
    <code>virage-smoke</code> le vérifie maintenant en confrontant le répertoire à la liste
    des gestes du jeu.</p>
</section>

<!-- ====================================================== les chants -->
<section class="sec" id="chants">
  <header class="sec-tete"><p class="sec-num">5</p><div>
    <h2>Les ${ORDRE.length} chants</h2>
    <p>Le répertoire. Cinq sont offerts à la fois, dans l’ordre ci-dessous — au Virage
      il tourne toutes les dix minutes de match réel ; en duel il est fixe, tiré de
      l’identifiant de la partie.</p>
  </div></header>

  <table>
    <thead><tr><th>Chant</th><th>Mini-jeu</th><th>Coût</th><th>Poussée</th><th>Effet</th></tr></thead>
    <tbody>${ORDRE.map((id) => {
      const c = CHANTS[id];
      return `<tr>
        <td data-t="Chant"><span class="nom">${esc(c.nom)}</span>
          <br><span class="cle">${esc(id)}</span></td>
        <td data-t="Mini-jeu" class="dit">${esc(LABEL[c.gest] ?? c.gest)}</td>
        <td data-t="Coût" class="n">${c.cost}</td>
        <td data-t="Poussée" class="n or">${c.power}</td>
        <td data-t="Effet" class="dit">${c.effect ? esc(c.effect) : '—'}</td></tr>`;
    }).join('')}</tbody>
  </table>
</section>

<!-- ==================================================== les deux modes -->
<section class="sec" id="modes">
  <header class="sec-tete"><p class="sec-num">6</p><div>
    <h2>Les deux façons de jouer</h2>
    <p>Elles se jouent désormais <b>de la même manière</b> : même répertoire, mêmes
      mini-jeux, même barème, même deck. Ce qui les distingue est <em>contre qui</em> on
      tire la corde.</p>
  </div></header>

  <table>
    <thead><tr><th></th><th>Le duel</th><th>Le Grand Virage</th></tr></thead>
    <tbody>
      <tr><td data-t="En face" class="dit"><b>En face</b></td>
        <td data-t="Duel" class="dit">Un adversaire, ou une petite tribune (jusqu’à 5 contre 5)</td>
        <td data-t="Virage" class="dit">Une foule d’inconnus, des deux côtés</td></tr>
      <tr><td data-t="Durée" class="dit"><b>Durée</b></td>
        <td data-t="Duel" class="n">${DEFAUTS['duel.duree_min']} minutes</td>
        <td data-t="Virage" class="dit">Toute la durée du vrai match</td></tr>
      <tr><td data-t="But" class="dit"><b>La corde marque à</b></td>
        <td data-t="Duel" class="n">${DEFAUTS['duel.but_a']} points</td>
        <td data-t="Virage" class="n">${DEFAUTS['virage.but_a']} points</td></tr>
      <tr><td data-t="Retour" class="dit"><b>Elle retombe de</b></td>
        <td data-t="Duel" class="n">${DEFAUTS['duel.decroissance']} / s</td>
        <td data-t="Virage" class="n">${DEFAUTS['virage.decroissance']} / s</td></tr>
      <tr><td data-t="Chants" class="dit"><b>Le chant</b></td>
        <td data-t="Duel" class="dit">5 offerts, fixes pour la partie</td>
        <td data-t="Virage" class="dit">5 offerts, ils tournent toutes les 10 min de match</td></tr>
      <tr><td data-t="Cartes" class="dit"><b>Cartes d’action</b></td>
        <td data-t="Duel" class="dit">Les ${ACTIONS.length}</td>
        <td data-t="Virage" class="dit">${ACTIONS.filter(dansLeVirage).length} — celles qui
          n’agressent personne. Une carte qui traverse serait écrasante contre trois cents
          personnes, ou nulle une fois divisée par l’effectif.</td></tr>
      <tr><td data-t="Gains" class="dit"><b>On y gagne</b></td>
        <td data-t="Duel" class="dit">Écharpes, XP, part au KOP, classement</td>
        <td data-t="Virage" class="dit">Ferveur, et une carte-souvenir par but réel vécu</td></tr>
    </tbody>
  </table>

  <h3>Le deck</h3>
  <p class="note">Le même dans les deux modes : <b>${DECK_RULES.fanzzy} Fanzzy au plus</b>
    (un seul suffit), ${DECK_RULES.stuffParFanzzy} pièces d’équipement par Fanzzy, et
    <b>exactement ${DECK_RULES.actions} cartes d’action</b> dont ${DECK_RULES.mainVisible}
    visibles à la fois. Aucun plafond par carte : dix exemplaires de la même sont permis —
    un débutant en possède cinq, et dix emplacements à remplir sans doublon serait
    arithmétiquement impossible.</p>
</section>

<!-- ================================================ les cartes d'action -->
<section class="sec" id="actions">
  <header class="sec-tete"><p class="sec-num">7</p><div>
    <h2>Les ${ACTIONS.length} cartes d’action</h2>
    <p>Ce qu’on joue <em>entre</em> les chants. Elles coûtent du souffle, ont une recharge,
      et changent les règles quelques secondes.</p>
  </div></header>

  <table>
    <thead><tr><th>Carte</th><th>Famille</th><th>Coût</th><th>Recharge</th><th>Ce qu’elle fait</th><th>Virage</th></tr></thead>
    <tbody>${ACTIONS.map((a) => `<tr>
      <td data-t="Carte"><span class="nom">${esc(a.nom)}</span>
        <br><span class="cle">${esc(a.id)}</span></td>
      <td data-t="Famille" class="dit">${esc(a.fam ?? '—')}
        <br><span class="tag ${a.rar === 'legendaire' ? 'or' : a.rar === 'epique' ? 'bleu' : 'gris'}">${esc(a.rar ?? '')}</span></td>
      <td data-t="Coût" class="n">${a.cost}</td>
      <td data-t="Recharge" class="n">${a.cd} s</td>
      <td data-t="Effet" class="dit">${esc(a.texte ?? '')}</td>
      <td data-t="Virage" class="n">${dansLeVirage(a) ? '<span class="vert">oui</span>' : '<span class="gris">non</span>'}</td>
    </tr>`).join('')}</tbody>
  </table>
</section>

<!-- ===================================================== l'équipement -->
<section class="sec" id="stuff">
  <header class="sec-tete"><p class="sec-num">8</p><div>
    <h2>Les ${STUFF.length} pièces d’équipement</h2>
    <p>Deux au plus par Fanzzy. <b>Chacune a un revers</b>, sans exception : une pièce qui
      n’aurait que des bonus ne se choisirait pas, elle s’accumulerait.</p>
  </div></header>

  <div class="cartes">${STUFF.map((s) => `<div class="c">
    <p class="c-tete"><span class="tag ${s.rar === 'legendaire' ? 'or' : s.rar === 'epique' ? 'bleu' : 'gris'}">${esc(s.rar)}</span>
      <span class="cle">${esc(s.id)}</span></p>
    <h4>${esc(s.nom)}</h4>
    <p>${esc(s.texte ?? '')}</p>
    <ul class="mods">${modHTML(s.mods)}</ul>
  </div>`).join('')}</div>
</section>

<!-- ========================================================= les stades -->
<section class="sec" id="stades">
  <header class="sec-tete"><p class="sec-num">9</p><div>
    <h2>Les ${STADES.length} stades</h2>
    <p>Le lieu appartient <b>au match</b>, jamais à un joueur — et son effet s’applique aux
      deux camps. Un stade qui avantagerait son propriétaire serait la première chose du jeu
      à donner de la puissance sans que l’adversaire l’ait choisie.</p>
  </div></header>

  <div class="cartes">${STADES.map((s) => `<div class="c">
    <p class="c-tete"><span class="tag ${s.rar === 'epique' ? 'bleu' : 'gris'}">${esc(s.rar)}</span>
      <span class="cle">${esc(s.id)}</span></p>
    <h4>${esc(s.nom)}</h4>
    <p>${esc(s.texte ?? '')}</p>
    <ul class="mods">${modHTML(s.mods)}</ul>
    <p style="margin-top:9px;color:var(--projo);font-size:12.5px">${esc(s.effet ?? '')}</p>
  </div>`).join('')}</div>
</section>

<!-- ========================================================= l'économie -->
<section class="sec" id="economie">
  <header class="sec-tete"><p class="sec-num">10</p><div>
    <h2>L’économie</h2>
    <p>Le booster donne les personnages, les doublons donnent les écharpes, les écharpes
      font grandir les personnages. C’est la boucle entière.</p>
  </div></header>

  <table>
    <thead><tr><th>Ce que c’est</th><th>Valeur</th><th>Note</th></tr></thead>
    <tbody>
      <tr><td data-t="Quoi" class="dit"><b>Boosters au départ</b></td>
        <td data-t="Valeur" class="n">${DEFAUTS['pack.depart']}</td>
        <td data-t="Note" class="dit">Trois, pas douze : douze d’un coup, c’est cinq minutes
          d’ouverture puis plus rien à faire pendant deux heures.</td></tr>
      <tr><td data-t="Quoi" class="dit"><b>Réserve maximale</b></td>
        <td data-t="Valeur" class="n">${DEFAUTS['pack.max']}</td><td data-t="Note" class="dit">—</td></tr>
      <tr><td data-t="Quoi" class="dit"><b>Un booster se recharge en</b></td>
        <td data-t="Valeur" class="n">${DEFAUTS['pack.regen_min']} min</td>
        <td data-t="Note" class="dit">Soit ${Math.floor((24 * 60) / DEFAUTS['pack.regen_min'])} par jour
          en se connectant régulièrement.</td></tr>
      <tr><td data-t="Quoi" class="dit"><b>Un booster s’achète</b></td>
        <td data-t="Valeur" class="n">${DEFAUTS['pack.prix_echarpes']} écharpes</td><td data-t="Note" class="dit">—</td></tr>
      <tr><td data-t="Quoi" class="dit"><b>Faire grandir</b></td>
        <td data-t="Valeur" class="n">${EVO_COST[2]} puis ${EVO_COST[3]}</td>
        <td data-t="Note" class="dit">Une lignée complète coûte ${EVO_COST[2] + EVO_COST[3]} écharpes.</td></tr>
      <tr><td data-t="Quoi" class="dit"><b>XP par booster</b></td>
        <td data-t="Valeur" class="n">${XP.pack}</td><td data-t="Note" class="dit">—</td></tr>
      <tr><td data-t="Quoi" class="dit"><b>XP par duel</b></td>
        <td data-t="Valeur" class="n">${XP.duel.entrainement} / ${XP.duel.classe}</td>
        <td data-t="Note" class="dit">Entraînement / classé, plus ${XP.victoire} en cas de
          victoire. L’XP <b>ne double pas</b> quand on pousse pour son club : les écharpes
          récompensent la ferveur, le niveau mesure le temps passé à jouer.</td></tr>
      <tr><td data-t="Quoi" class="dit"><b>Paliers de niveau</b></td>
        <td data-t="Valeur" class="n">${PALIERS.length}</td>
        <td data-t="Note" class="dit">Ils ouvrent des <b>capacités</b>, et rien que des
          capacités : des emplacements de club à suivre, un troisième rang de tribune.
          Les séries en sont sorties — elles s’ouvrent par saison. Une capacité n’a de
          sens que pour un joueur donné, et personne n’a envie qu’on la lui annonce.</td></tr>
    </tbody>
  </table>

  <h3>Les deux monnaies</h3>
  <p class="note"><b>Les écharpes</b> se gagnent en jouant : doublons, fins de duel, part du
    KOP. Elles paient les évolutions et les boosters. <b>Les billets</b> s’achètent avec de
    l’argent réel et ne paient que des tenues et de l’équipement — jamais un booster, jamais
    une carte. On n’achète pas de la collection.</p>
</section>

<!-- ==================================================== l'administration -->
<section class="sec" id="reglages">
  <header class="sec-tete"><p class="sec-num">11</p><div>
    <h2>Ce qui se règle sans déploiement</h2>
    <p>${REGLAGES.length} réglages en ${SECTIONS.length} sections, modifiables depuis
      <code>/admin</code>. Ils prennent effet immédiatement : le jeu les relit à chaque
      lecture, il ne les copie pas au démarrage.</p>
  </div></header>

  ${SECTIONS.map((sec) => {
    const siens = REGLAGES.filter((r) => r.section === sec.id);
    if (!siens.length) return '';
    return `<h3>${esc(sec.titre)}</h3>
    <p class="note">${esc(sec.aide ?? '')}</p>
    <table>
      <thead><tr><th>Réglage</th><th>Défaut</th><th>Bornes</th><th>Clé</th></tr></thead>
      <tbody>${siens.map((r) => `<tr>
        <td data-t="Réglage" class="dit">${esc(r.titre)}${r.unite ? ` <span class="gris">(${esc(r.unite)})</span>` : ''}</td>
        <td data-t="Défaut" class="${typeof r.defaut === 'string' && r.defaut.length > 12 ? 'dit' : 'n'}">${esc(String(r.defaut))}</td>
        <td data-t="Bornes" class="n gris">${r.min !== undefined ? `${r.min} – ${r.max}` : '—'}</td>
        <td data-t="Clé"><span class="cle">${esc(r.cle)}</span></td></tr>`).join('')}
      </tbody></table>`;
  }).join('')}

  <p class="note" style="margin-top:20px">Ce qui <b>ne</b> se règle pas ici : les taux de
    tirage, les barèmes des gestes et les prix en euros. Ils décrivent les règles du jeu et
    non son équilibrage — et un prix qu’un écran peut changer d’un doigt est un prix qui
    finira changé par erreur.</p>
</section>

<!-- =========================================================== l'état -->
<section class="sec" id="etat">
  <header class="sec-tete"><p class="sec-num">12</p><div>
    <h2>Où en est le développement</h2>
    <p>Ce qui tourne, ce qui tourne à moitié, et ce qui manque. Cette section est la seule
      écrite à la main — aucun module ne sait dire si une chose est finie.</p>
  </div></header>

  <div class="etat">
    <div class="e" data-f="fait"><b>LE JEU</b><p>Duel et Grand Virage, ${GESTES.length}
      mini-jeux, ${ORDRE.length} chants, ${ACTIONS.length} cartes d’action. Les deux modes
      se jouent de la même façon.</p></div>
    <div class="e" data-f="fait"><b>LE CATALOGUE</b><p>${DEX.length} cartes,
      ${SETS.length} séries, au moins cinq légendaires chacune. Chaque famille tient sa promesse de
      gestes.</p></div>
    <div class="e" data-f="fait"><b>LA COLLECTION</b><p>Boosters, kiosque, classeur, deck,
      évolutions, ${STUFF.length} pièces d’équipement, tenues.</p></div>
    <div class="e" data-f="fait"><b>LE SOCIAL</b><p>KOP avec pot commun et votes, amis,
      classements, cartes-souvenirs liées aux vrais buts.</p></div>
    <div class="e" data-f="fait"><b>L’ADMINISTRATION</b><p>${REGLAGES.length} réglages,
      catalogue éditable, journal d’audit, gestion des joueurs.</p></div>
    <div class="e" data-f="fait"><b>LA SÉCURITÉ</b><p>Notation côté serveur, détection de
      frappes non humaines, en-têtes de sécurité, limitation de débit, SQL paramétré.</p></div>

    <div class="e" data-f="partiel"><b>LES ILLUSTRATIONS</b><p>${DESSINS.faits}
      personnages sur ${DESSINS.total} sont dessinés ; <b>${DESSINS.restent}</b> attendent
      encore leur premier âge, et leurs âges supérieurs avec — un âge sans dessin tombe sur
      celui de son premier. Les douze états ne sont dessinés que pour
      ${DESSINS.etats} personnage${DESSINS.etats > 1 ? 's' : ''}.<br>
      Le détail, dessin par dessin :
      <a href="https://claude.ai/code/artifact/e1a1cacd-6653-4db2-981a-792cbfe94162"
        >le catalogue illustré</a>.</p></div>
    <div class="e" data-f="partiel"><b>LA BOUTIQUE</b><p>L’étal fonctionne en écharpes et en
      billets. Les paiements en euros ne sont <b>pas branchés</b> : la boutique est en
      vitrine.</p></div>
    <div class="e" data-f="partiel"><b>LES STADES</b><p>Les ${STADES.length} existent,
      s’affichent et appliquent leurs effets. Ils ne se <b>collectionnent pas encore</b> :
      le lieu est tiré du match, pas des possessions.</p></div>

    <div class="e" data-f="reste"><b>ÉCRAN LARGE</b><p>L’application est une colonne pensée
      pour le téléphone. Sur un ordinateur, les deux tiers de l’écran sont vides.</p></div>
    <div class="e" data-f="reste"><b>LES ÂGES DESSINÉS</b><p>Voir un personnage vieillir est
      ce que le jeu promet. Le repli montre le bon personnage, pas son âge.</p></div>
    <div class="e" data-f="reste"><b>LE JURIDIQUE</b><p>Droit de rétractation, mentions
      légales et TVA : rien de tout cela n’est traité, et il le faudra avant le premier
      paiement réel.</p></div>
  </div>
</section>

<footer class="pied">
  <p><b>Ce dossier se refait.</b> <code>node scripts/dossier.mjs</code> le régénère depuis
    le catalogue réel. Les nombres, les règles, les coûts et les barèmes ne peuvent donc pas
    vieillir plus longtemps qu’une commande — seule la dernière section, celle de l’état,
    est écrite à la main.</p>
  <p>Généré le ${new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
</footer>

</div>
`;

writeFileSync(sortie, html);
console.log(`Dossier écrit : ${sortie}`);
console.log(`  ${DEX.length} cartes · ${GESTES.length} mini-jeux · ${ORDRE.length} chants`
  + ` · ${ACTIONS.length} actions · ${STUFF.length} pièces · ${STADES.length} stades`
  + ` · ${REGLAGES.length} réglages`);
