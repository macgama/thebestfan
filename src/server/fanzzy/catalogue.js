/**
 * Le catalogue Fanzzy, en base.
 *
 * Il vivait dans `src/shared/fanzzy/dex.js` : ajouter une carte demandait un
 * déploiement. À cent Fanzzy ce n'est plus tenable, et c'est encore moins
 * tenable pour quelqu'un qui ne veut pas toucher au code. Le catalogue devient
 * donc une donnée, `dex.js` n'en est plus que l'amorçage.
 *
 * **La lecture reste synchrone.** Tout le jeu lit le catalogue en plein tirage
 * de booster, en pleine ouverture de deck, dix fois par seconde dans un duel :
 * une requête à chaque lecture serait absurde. On charge tout en mémoire au
 * démarrage, et on recharge après chaque écriture de l'administration. Le
 * catalogue tient en quelques dizaines de kilo-octets, même à cent cartes.
 *
 * **Rien ne se supprime.** Un identifiant effacé orphelinerait les
 * collections, les decks et le Fanzzy équipé de tous ceux qui le possèdent —
 * `BY_ID.get()` renverrait `undefined` et l'ouverture de booster casserait.
 * On dépublie : la carte sort des tirages, elle reste connue du jeu.
 */
import { DEX as AMORCE } from '../../shared/fanzzy/dex.js';

let charge = false;
let liste = [];
let parId = new Map();

/**
 * Le catalogue n'a jamais été chargé.
 *
 * Ce message est long exprès. Un `undefined` silencieux ici produit une
 * collection vide, des boosters qui ne tirent rien et un deck invalide — trois
 * symptômes qui n'évoquent jamais leur cause. Plusieurs séances ont déjà été
 * perdues sur des « impossible » de ce genre.
 */
function garde() {
  if (charge) return;
  throw new Error(
    'Le catalogue Fanzzy n’a pas été chargé. Appelle charger(pool) au démarrage, '
    + 'avant de monter les modules qui en dépendent — fanzzy, deck, onboarding. '
    + 'Dans un test, appelle-le juste après avoir appliqué sql/fanzzy.sql.');
}

/** Une ligne de la base vers la forme que le jeu attend. */
const versJeu = (r) => ({
  id: r.id,
  nom: r.nom,
  type: r.type,
  set: r.set_id,
  stage: Number(r.stage),
  rar: r.rar,
  ...(r.evo ? { evo: r.evo } : {}),
  ...(r.histoire ? { histoire: r.histoire } : {}),
  // Selon la version du pilote, une colonne JSON revient décodée ou en chaîne.
  // Les deux cas doivent marcher, sinon le catalogue lève à chaque démarrage.
  mods: typeof r.mods === 'string' ? JSON.parse(r.mods) : r.mods,
  cri: typeof r.cri === 'string' ? JSON.parse(r.cri) : r.cri,
  publie: Boolean(r.publie),
});

/**
 * Amorçage : les cartes de `dex.js` que la base ne connaît pas encore.
 *
 * `INSERT IGNORE` et non `REPLACE` : on ajoute ce qui manque, on n'écrase
 * jamais ce qui existe. Une carte modifiée depuis l'administration doit
 * survivre au redémarrage suivant.
 *
 * On ne se contente pas d'amorcer une base vide : sinon une carte ajoutée à
 * `dex.js` n'arriverait jamais en base, et le fichier d'amorçage divergerait
 * silencieusement du catalogue réel — exactement la faute que ce projet a déjà
 * payée avec le catalogue recopié dans la page.
 */
async function amorcer(pool) {
  let pose = 0;
  for (const [i, f] of AMORCE.entries()) {
    // `publie` vient de la fiche et non d'un 1 en dur : trente-deux anciennes
    // cartes refont un personnage du lot de 2026 et ne doivent plus être
    // proposées. Écrire 1 quoi qu'il arrive les remettrait dans les tirages à
    // chaque base neuve, et il faudrait les retirer à la main après chaque
    // installation — ce que personne ne pense à faire.
    const [r] = await pool.execute(
      `INSERT IGNORE INTO fanzzy
         (id, nom, type, set_id, stage, rar, evo, histoire, mods, cri, publie, ordre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [f.id, f.nom, f.type, f.set, f.stage, f.rar, f.evo ?? null,
       f.histoire ?? null, JSON.stringify(f.mods ?? {}), JSON.stringify(f.cri ?? {}),
       f.publie === false ? 0 : 1, i]);
    if (r.affectedRows) pose++;
  }
  return pose;
}

/** Relit toute la table. Appelé au démarrage et après chaque écriture. */
export async function recharger(pool) {
  const [rows] = await pool.query(
    'SELECT * FROM fanzzy ORDER BY ordre, id');
  liste = rows.map(versJeu);
  parId = new Map(liste.map((f) => [f.id, f]));
  indexerLignees();
  charge = true;
  return liste.length;
}

/** À appeler une fois au démarrage, avant de monter les modules du jeu. */
export async function charger(pool) {
  const amorces = await amorcer(pool);
  const n = await recharger(pool);
  const series = await chargerSeries(pool);
  return { total: n, amorces, series };
}

/* --------------------------------------------------------------- lecture */

/** Tout le catalogue, publié ou non. C'est ce que voit l'administration. */
export function tous() { garde(); return liste; }

/**
 * Ce que voit un joueur, et ce dans quoi on tire.
 *
 * Une carte dépubliée reste lisible par identifiant — sinon la collection de
 * qui la possède déjà se briserait — mais elle ne sort plus d'un booster.
 */
export function publies() { garde(); return liste.filter((f) => f.publie); }

/** Par identifiant, publiée ou non : une carte déjà possédée doit s'afficher. */
export function parIdentifiant(id) { garde(); return parId.get(id); }

/* ------------------------------------------- personnages et stades

   Le catalogue garde **une ligne par âge** : le Choriste, le Meneur de chant et
   le Capo di Curva sont trois lignes, reliées par `evo`. C'est ce qui permet de
   leur donner chacun son nom, son histoire, ses bonus et son dessin.

   Mais ce sont trois âges d'**un seul personnage**, et c'est le personnage que
   le joueur collectionne. Il en possède un exemplaire, arrivé à un certain
   stade ; il n'en possède pas trois. Tout ce qui compte — la jauge, le
   classeur, le deck, l'avatar — raisonne donc en personnages, et ne descend au
   niveau des âges que pour lire un nom ou des modificateurs.

   Ces deux index existent pour que cette traduction se fasse en une lecture,
   partout, au lieu d'être refaite à la main dans chaque module — c'est ainsi
   que deux modules finissent par ne plus compter pareil.                     */

/** id de n'importe quel âge → id du personnage (son premier âge). */
let racines = new Map();
/** id du personnage → ses âges, du premier au dernier. */
let chaines = new Map();

function indexerLignees() {
  racines = new Map();
  chaines = new Map();
  // Un âge est une racine s'il n'est la suite de personne. On part de là plutôt
  // que de `stage === 1` : le stade est une donnée d'affichage, modifiable
  // depuis l'administration, et une lignée mal numérotée doit rester lisible.
  const suivi = new Set(liste.map((f) => f.evo).filter(Boolean));
  for (const depart of liste.filter((f) => !suivi.has(f.id))) {
    const chaine = [depart];
    const vus = new Set([depart.id]);
    let c = depart;
    // `vus` n'est pas de la prudence gratuite : `evo` s'écrit depuis
    // l'administration, et deux cartes qui se désignent l'une l'autre feraient
    // tourner cette boucle sans fin — au démarrage, donc sans que rien ne
    // démarre. Le contrôle de saisie refuse déjà le cas ; celui-ci reste parce
    // qu'une base peut avoir été modifiée à la main.
    while (c.evo && parId.has(c.evo) && !vus.has(c.evo)) {
      c = parId.get(c.evo);
      vus.add(c.id);
      chaine.push(c);
    }
    chaines.set(depart.id, chaine);
    for (const f of chaine) racines.set(f.id, depart.id);
  }
  // Une carte prise dans un cycle n'a aucune racine : elle serait invisible
  // partout, y compris pour qui la possède. On la traite comme sa propre
  // lignée, seule.
  for (const f of liste) {
    if (racines.has(f.id)) continue;
    racines.set(f.id, f.id);
    chaines.set(f.id, [f]);
  }
}

/** Le personnage auquel appartient un âge. Rend l'identifiant tel quel s'il est inconnu. */
export function racineDe(id) { garde(); return racines.get(id) ?? id; }

/** Les âges d'un personnage, du premier au dernier. Toujours au moins un. */
export function lignee(id) {
  garde();
  return chaines.get(racineDe(id)) ?? [];
}

/**
 * L'âge `n` d'un personnage — 1, 2 ou 3 — ou `undefined` s'il n'est pas écrit.
 *
 * Cent cinquante-deux personnages n'ont encore que leur premier âge. Ce n'est
 * pas une anomalie à corriger dans le code : c'est du contenu à écrire, et
 * jusque-là leur évolution se refuse proprement.
 */
export function auStade(id, n) { return lignee(id)[n - 1]; }

/** Combien d'âges ce personnage a-t-il d'écrits ? */
export const stadesEcrits = (id) => lignee(id).length;

/**
 * Les personnages, pas les âges.
 *
 * C'est sur cet ensemble que se compte une collection. Le compter sur les
 * lignes du catalogue donnait vingt et une entrées pour sept personnages —
 * dont quatorze qu'aucun booster ne peut sortir, puisqu'ils ne s'obtiennent
 * qu'en faisant évoluer. La jauge promettait donc au joueur des cartes qui
 * n'existaient nulle part.
 */
export function personnages() {
  garde();
  return [...chaines.values()].map((c) => c[0]);
}

/* ------------------------------------------------- les séries ouvertes

   Le catalogue publié n'est pas ce qu'un joueur peut obtenir *aujourd'hui*.
   Cent soixante-six cartes d'un coup, c'est trop pour commencer : la
   simulation demande cinq cents boosters pour tout avoir, et un joueur qui lit
   « 1/166 » à sa première ouverture sait qu'il n'y arrivera jamais. On ouvre
   donc les séries une par une, en commençant par LA TRIBUNE — trente-neuf
   cartes, qui se complètent.

   La liste vit dans la table `reglages`, sous la clé `series_actives`, écrite
   depuis l'administration. **Absente, tout est ouvert** : une installation
   neuve se comporte comme avant, et le jour où quelqu'un vide la valeur par
   erreur, le jeu s'ouvre au lieu de se fermer.

   Ce qui n'est PAS filtré : ce qu'un joueur possède déjà. Fermer une série ne
   lui retire rien — sa carte reste dans son classeur, dans son deck et sur son
   accueil. Fermer, c'est cesser de distribuer, pas confisquer.                */

const TOUTES = null;         // `null` : aucune restriction enregistrée
let ouvertes = TOUTES;

/**
 * Relit les séries ouvertes. Appelée au démarrage et après chaque écriture de
 * l'administration, comme `recharger`.
 */
export async function chargerSeries(pool) {
  let rows = [];
  try {
    [rows] = await pool.execute(
      `SELECT valeur FROM reglages WHERE cle = 'series_actives'`);
  } catch (e) {
    // `reglages` vient de sql/admin.sql, que rien n'oblige à appliquer. Sans ce
    // filet, une installation sans administration ferait lever le démarrage —
    // et le catch de server.js éteindrait *toutes* les routes /api, connexion
    // comprise. C'est exactement la panne du 8 septembre, reprise sur une autre
    // table. Pas de réglages, pas de restriction : tout est ouvert.
    if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    console.warn('table reglages absente : toutes les séries restent ouvertes '
      + '(applique sql/admin.sql pour pouvoir les fermer)');
    ouvertes = TOUTES;
    return null;
  }
  const brut = rows[0]?.valeur;
  const v = typeof brut === 'string' ? JSON.parse(brut) : brut;
  // Une liste vide serait un jeu fermé à double tour, et ce n'est jamais ce
  // qu'on veut dire — on l'interprète comme « aucune restriction ».
  ouvertes = Array.isArray(v) && v.length ? new Set(v) : TOUTES;
  return ouvertes ? [...ouvertes] : null;
}

/** Les identifiants des séries ouvertes, ou `null` si elles le sont toutes. */
export function seriesOuvertes() { return ouvertes ? [...ouvertes] : null; }

/** Cette série distribue-t-elle des boosters en ce moment ? */
export function serieOuverte(setId) { return !ouvertes || ouvertes.has(setId); }

/**
 * Ce qu'un joueur peut encore obtenir : un **personnage** publié, dans une
 * série ouverte.
 *
 * C'est sur cet ensemble que se compte la progression. La compter sur tout le
 * catalogue afficherait « 31/166 » à quelqu'un qui possède déjà tout ce qu'il
 * peut posséder — le pire message qu'on puisse envoyer à un collectionneur. Et
 * la compter sur les lignes du catalogue y ajouterait les quatorze âges
 * supérieurs des sept lignées, qu'aucun booster ne distribue : la jauge
 * n'aurait jamais pu arriver au bout.
 */
export function obtenables() {
  garde();
  return personnages().filter((f) => f.publie && serieOuverte(f.set));
}

/** Utile aux tests et au diagnostic. */
export const estCharge = () => charge;

/** Uniquement pour les tests : repart d'un catalogue non chargé. */
export function oublier() {
  charge = false; liste = []; parId = new Map();
  racines = new Map(); chaines = new Map();
}
