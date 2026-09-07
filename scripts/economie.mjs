/**
 * Simulation de l'économie de la collection.
 *
 * Les chiffres de `dex.js` — « compléter la collection rapporte environ 1 150
 * écharpes » — avaient été calculés une fois, à 27 cartes, et n'ont jamais été
 * recalculés depuis. À 36 cartes ils étaient déjà faux ; à 100 ils n'ont plus
 * aucun rapport avec le jeu.
 *
 * Ce script ne remplace pas ces chiffres par d'autres chiffres figés : il les
 * **recalcule à la demande**, en rejouant le tirage exact du serveur sur le
 * catalogue tel qu'il est ce jour-là. Il se relance après chaque ajout de
 * carte, et c'est là son intérêt.
 *
 *   node scripts/economie.mjs              # sur le catalogue réel
 *   node scripts/economie.mjs 100          # sur une projection à 100 Fanzzy
 *   node scripts/economie.mjs 100 5000     # avec 5 000 tirages au lieu de 2 000
 *
 * Aucune base, aucun réseau : c'est du calcul.
 */
import { readFileSync } from 'node:fs';
import { DEX, RATES, SCARVES, EVO_COST } from '../src/shared/fanzzy/dex.js';

/* ------------------------------------------------- les règles du serveur

   Une simulation qui recopie les règles finit toujours par simuler un jeu qui
   n'existe plus. Les trois constantes exportées sont donc importées, et les
   trois autres — qui ne le sont pas — sont relues dans le source et
   comparées. Le script s'arrête net si l'une a bougé.                      */

import { MAX_PACKS, PACK_REGEN_MS, PACK_PRICE } from '../src/server/fanzzy/index.js';

const TAILLE_PAQUET = 5;
const PLACES_GARANTIES = 3;      // les trois premières sont toujours des d1
const CHANCE_SKIN = 0.22;        // sur les places 4 et 5, si un skin est libre

{
  const src = readFileSync(new URL('../src/server/fanzzy/index.js', import.meta.url), 'utf8');
  const attendu = [
    [`CHANCE_SKIN = ${CHANCE_SKIN}`, 'la chance de tirer un skin'],
    [`i < ${PLACES_GARANTIES} ? 'd1'`, 'le nombre de places garanties en commune'],
    [`length: ${TAILLE_PAQUET} }`, 'la taille du paquet'],
  ];
  const perdus = attendu.filter(([motif]) => !src.includes(motif));
  if (perdus.length) {
    console.error('\nLa simulation ne correspond plus au serveur :');
    for (const [motif, quoi] of perdus) console.error(`  ${quoi} — « ${motif} » introuvable`);
    console.error('Corrige les constantes en tête de ce fichier avant de lire ses chiffres.\n');
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const PLANCHER = args.includes('--plancher');
const chiffres = args.filter((a) => !a.startsWith('--')).map(Number);
const CIBLE = chiffres[0] || null;
const TIRAGES = chiffres[1] || 2000;

/* ------------------------------------------------------------ le catalogue

   Pour une projection, on étire le catalogue actuel jusqu'à la taille visée
   en conservant sa forme : mêmes proportions de raretés dans chaque série.
   C'est la seule hypothèse honnête tant que les cartes ne sont pas écrites —
   et elle se vérifiera d'elle-même en relançant le script quand elles le
   seront.                                                                  */

function catalogue(taille) {
  if (!taille || taille <= DEX.length) return DEX.map((f) => ({ id: f.id, set: f.set, rar: f.rar }));
  const facteur = taille / DEX.length;
  const out = [];
  const parCle = new Map();
  for (const f of DEX) {
    const cle = `${f.set}/${f.rar}`;
    parCle.set(cle, (parCle.get(cle) ?? 0) + 1);
  }
  let i = 0;
  for (const [cle, n] of parCle) {
    const [set, rar] = cle.split('/');
    const vise = Math.max(1, Math.round(n * facteur));
    for (let k = 0; k < vise; k++) out.push({ id: `S${i++}`, set, rar });
  }
  return out;
}

const CARTES = catalogue(CIBLE);
const SET_IDS = [...new Set(CARTES.map((c) => c.set))];

/** Les pools du serveur : une carte se tire dans sa série et sa rareté. */
const POOLS = new Map();
for (const s of SET_IDS) {
  for (const r of ['d1', 'd2', 'd3', 'star', 'crown']) {
    POOLS.set(`${s}/${r}`, CARTES.filter((c) => c.set === s && c.rar === r));
  }
}
const pool = (set, rar) => {
  const p = POOLS.get(`${set}/${rar}`);
  return p?.length ? p : POOLS.get(`${set}/d1`);
};

const rnd = (a) => a[Math.floor(Math.random() * a.length)];

function tirerRarete(place) {
  const table = RATES[place];
  const r = Math.random();
  let acc = 0;
  for (const [rar, p] of table) { acc += p; if (r < acc) return rar; }
  return 'd2';
}

/**
 * Un booster, exactement comme `drawPack` côté serveur.
 *
 * `plancher` active la variante proposée : les trois places garanties ne
 * restent en commune que **tant qu'il manque une commune** au joueur dans
 * cette série. Une fois qu'il les a toutes, elles montent au tirage normal.
 *
 * Sans cette variante, un joueur qui possède les vingt-cinq communes reçoit
 * trois doublons garantis à une écharpe pièce dans chaque paquet, jusqu'à la
 * fin du jeu — soixante pour cent de chaque booster devient du remplissage.
 * C'est invisible à 27 cartes et écrasant à 100.
 */
function ouvrir(setId, possedeQuelqueChose, manqueCommune) {
  const tirees = [];
  for (let i = 0; i < TAILLE_PAQUET; i++) {
    // Les places 4 et 5 peuvent devenir un skin, mais seulement si le joueur
    // possède déjà un Fanzzy à habiller.
    if (i >= PLACES_GARANTIES && possedeQuelqueChose && Math.random() < CHANCE_SKIN) {
      tirees.push(null);           // un skin : ni carte neuve, ni doublon
      continue;
    }
    const garantie = i < PLACES_GARANTIES && (!PLANCHER || manqueCommune);
    const rar = garantie ? 'd1' : tirerRarete(Math.max(4, i + 1));
    tirees.push(rnd(pool(setId, rar)));
  }
  return tirees;
}

/* --------------------------------------------------------- une collection */

/**
 * Un joueur ouvre des boosters jusqu'à tout avoir.
 *
 * Il choisit à chaque fois la série où il lui manque le plus de cartes :
 * c'est ce que fait un collectionneur, et supposer un choix au hasard
 * donnerait un résultat plus flatteur que la réalité.
 */
function unePartie() {
  const eus = new Set();
  const manquePar = (s) => CARTES.filter((c) => c.set === s && !eus.has(c.id)).length;

  let paquets = 0;
  let ecarpes = 0;
  let doublons = 0;
  const paliers = [];
  const total = CARTES.length;

  // Garde-fou : une série sans carte d'une rareté donnée retombe sur les d1,
  // donc la collection reste atteignable. Mais si un pool est vide des deux
  // côtés, on s'arrêterait jamais.
  const PLAFOND = 200_000;

  while (eus.size < total && paquets < PLAFOND) {
    const set = SET_IDS.slice().sort((a, b) => manquePar(b) - manquePar(a))[0];
    if (manquePar(set) === 0) break;
    const manqueCommune = POOLS.get(`${set}/d1`).some((c) => !eus.has(c.id));
    for (const c of ouvrir(set, eus.size > 0, manqueCommune)) {
      if (!c) continue;
      if (eus.has(c.id)) { ecarpes += SCARVES[c.rar]; doublons++; }
      else {
        eus.add(c.id);
        const part = eus.size / total;
        for (const p of [0.5, 0.9]) {
          if (part >= p && !paliers.some((x) => x.part === p)) {
            paliers.push({ part: p, paquets: paquets + 1 });
          }
        }
      }
    }
    paquets++;
  }
  return { paquets, ecarpes, doublons, complet: eus.size >= total, paliers };
}

/* ------------------------------------------------------------- la mesure */

const moyenne = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const mediane = (xs) => { const t = xs.slice().sort((a, b) => a - b); return t[Math.floor(t.length / 2)]; };

const parties = Array.from({ length: TIRAGES }, unePartie);
const abouties = parties.filter((p) => p.complet);

const paquets = abouties.map((p) => p.paquets);
const gains = abouties.map((p) => p.ecarpes);

/* ------------------------------------------------------- le coût d'évolution */

// Une lignée coûte 25 puis 90 : il faut donc posséder les trois étages.
const lignees = new Set(DEX.filter((f) => f.evo).map((f) => f.id[0])).size;
const coutEvolutions = lignees * (EVO_COST[2] + EVO_COST[3]);

/* --------------------------------------------------------------- rapport */

const h = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
const heures = (p) => (p / (60 / (PACK_REGEN_MS / 60000))).toFixed(0);

console.log(`\nCatalogue simulé : ${CARTES.length} Fanzzy`
  + (CIBLE && CIBLE > DEX.length ? ` (projection depuis ${DEX.length} réels)` : ' (réels)'));
console.log(`Séries : ${SET_IDS.join(', ')} · ${TIRAGES} collections simulées\n`);

console.log('Répartition des pools');
for (const s of SET_IDS) {
  const parts = ['d1', 'd2', 'd3', 'star', 'crown']
    .map((r) => `${r} ${POOLS.get(`${s}/${r}`).length}`).join(' · ');
  console.log(`  ${s} : ${parts}`);
}

console.log('\nPour compléter la collection');
console.log(`  boosters     médiane ${h(mediane(paquets))} · moyenne ${h(moyenne(paquets))}`);
console.log(`  cartes vues  ${h(moyenne(paquets) * TAILLE_PAQUET)}`);
console.log(`  écharpes gagnées en doublons  ${h(moyenne(gains))}`);

console.log('\nCe que ça coûte et ce que ça rapporte');
console.log(`  écharpes rapportées par la collection   ${h(moyenne(gains))}`);
console.log(`  coût des ${lignees} lignées à faire évoluer        ${h(coutEvolutions)}`);
const reste = moyenne(gains) - coutEvolutions;
console.log(`  reste après avoir tout fait évoluer     ${h(reste)}`
  + (reste < 0 ? '   ← IMPOSSIBLE sans acheter' : ''));

console.log('\nEn temps de jeu');
console.log(`  boosters gratuits : 1 toutes les ${PACK_REGEN_MS / 60000} min, ${MAX_PACKS} en réserve`);
console.log(`  soit ${h(6 * 24)} par jour en se connectant régulièrement`);
console.log(`  collection complète en ${h(moyenne(paquets) / (6 * 24))} jours de boosters gratuits`);
console.log(`  ou ${h(moyenne(paquets) * PACK_PRICE)} écharpes si tout est acheté à ${PACK_PRICE}`);

const mi = abouties.map((p) => p.paliers.find((x) => x.part === 0.5)?.paquets).filter(Boolean);
const neuf = abouties.map((p) => p.paliers.find((x) => x.part === 0.9)?.paquets).filter(Boolean);
console.log('\nLa courbe, qui compte plus que le total');
console.log(`  la moitié de la collection en  ${h(moyenne(mi))} boosters`);
console.log(`  les 90 % en                    ${h(moyenne(neuf))} boosters`);
console.log(`  les 10 % derniers coûtent      ${h(moyenne(paquets) - moyenne(neuf))} boosters`
  + `, soit ${((1 - moyenne(neuf) / moyenne(paquets)) * 100).toFixed(0)} % du total`);

if (abouties.length < parties.length) {
  console.log(`\n${parties.length - abouties.length} collection(s) jamais complétées : un pool est inatteignable.`);
}
console.log('');
