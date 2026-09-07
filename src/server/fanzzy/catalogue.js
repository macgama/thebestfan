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
 * Amorçage : la base vide reçoit le contenu de `dex.js`.
 *
 * On n'écrase jamais une carte existante. Le jour où `dex.js` ne sera plus
 * qu'un fichier d'amorçage historique, une modification faite dans
 * l'administration ne doit pas être annulée au redémarrage suivant.
 */
async function amorcer(pool) {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM fanzzy');
  if (n > 0) return 0;

  let pose = 0;
  for (const [i, f] of AMORCE.entries()) {
    await pool.execute(
      `INSERT IGNORE INTO fanzzy
         (id, nom, type, set_id, stage, rar, evo, histoire, mods, cri, publie, ordre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [f.id, f.nom, f.type, f.set, f.stage, f.rar, f.evo ?? null,
       f.histoire ?? null, JSON.stringify(f.mods ?? {}), JSON.stringify(f.cri ?? {}), i]);
    pose++;
  }
  return pose;
}

/** Relit toute la table. Appelé au démarrage et après chaque écriture. */
export async function recharger(pool) {
  const [rows] = await pool.query(
    'SELECT * FROM fanzzy ORDER BY ordre, id');
  liste = rows.map(versJeu);
  parId = new Map(liste.map((f) => [f.id, f]));
  charge = true;
  return liste.length;
}

/** À appeler une fois au démarrage, avant de monter les modules du jeu. */
export async function charger(pool) {
  const amorces = await amorcer(pool);
  const n = await recharger(pool);
  return { total: n, amorces };
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

/** Utile aux tests et au diagnostic. */
export const estCharge = () => charge;

/** Uniquement pour les tests : repart d'un catalogue non chargé. */
export function oublier() { charge = false; liste = []; parId = new Map(); }
