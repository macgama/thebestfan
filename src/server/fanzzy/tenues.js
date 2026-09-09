/**
 * Le catalogue des tenues, en base.
 *
 * Même trajet que le catalogue Fanzzy, et pour la même raison : ajouter un
 * thème ne doit pas demander un déploiement. `inventaire.js` n'en est plus que
 * l'amorçage.
 *
 * **La lecture reste synchrone.** Une ouverture de booster consulte les tenues
 * cinq fois, une fiche autant : une requête à chaque lecture serait absurde
 * pour une liste de dix lignes. On charge tout en mémoire au démarrage, et on
 * recharge après chaque écriture de l'administration.
 *
 * **Rien ne se supprime.** Une tenue effacée orphelinerait les `user_skins` de
 * tous ceux qui la possèdent — elle disparaîtrait de leur collection sans
 * explication, et la fiche chercherait un identifiant qui n'existe plus. On
 * dépublie : elle sort des boosters, elle reste à qui l'a gagnée.
 */
import { SKINS as AMORCE } from '../../shared/fanzzy/inventaire.js';

let charge = false;
let liste = [];
let parId = new Map();

function garde() {
  if (charge) return;
  throw new Error(
    'Le catalogue des tenues n’a pas été chargé. Appelle chargerTenues(pool) au '
    + 'démarrage, avant de monter les modules qui s’en servent — fanzzy, '
    + 'onboarding, administration. Dans un test, appelle-le juste après avoir '
    + 'appliqué sql/tenues.sql.');
}

const versJeu = (r) => ({
  id: r.id,
  nom: r.nom,
  rar: r.rar,
  ...(r.texte ? { texte: r.texte } : {}),
  // `pour` n'a jamais servi à autre chose qu'à dire « toutes les cartes ». Il
  // reste dans la forme rendue pour ne pas casser ce qui le lit, et il ne se
  // range pas en base : une colonne qui vaut toujours la même chose est une
  // colonne qui ment sur son utilité.
  pour: '*',
  publie: Boolean(r.publie),
});

/**
 * Amorçage : les tenues d'`inventaire.js` que la base ne connaît pas encore.
 *
 * `INSERT IGNORE` et non `REPLACE` : on ajoute ce qui manque, on n'écrase
 * jamais ce qui existe. Une tenue renommée depuis l'administration doit
 * survivre au redémarrage suivant.
 */
async function amorcer(pool) {
  let pose = 0;
  for (const [i, s] of AMORCE.entries()) {
    const [r] = await pool.execute(
      `INSERT IGNORE INTO tenues (id, nom, texte, rar, publie, ordre)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [s.id, s.nom, s.texte ?? null, s.rar, s.publie === false ? 0 : 1, i]);
    if (r.affectedRows) pose++;
  }
  return pose;
}

/** Relit toute la table. Appelé au démarrage et après chaque écriture. */
export async function rechargerTenues(pool) {
  const [rows] = await pool.query('SELECT * FROM tenues ORDER BY ordre, id');
  liste = rows.map(versJeu);
  parId = new Map(liste.map((s) => [s.id, s]));
  charge = true;
  return liste.length;
}

/** À appeler une fois au démarrage, avant de monter les modules du jeu. */
export async function chargerTenues(pool) {
  const amorces = await amorcer(pool);
  const total = await rechargerTenues(pool);
  return { total, amorces };
}

/** Tout le catalogue, publié ou non. C'est ce que voit l'administration. */
export function toutesTenues() { garde(); return liste; }

/**
 * Ce qui se tire et s'affiche.
 *
 * Une tenue dépubliée reste lisible par identifiant — sinon la collection de
 * qui la possède déjà se briserait — mais elle ne sort plus d'un booster.
 */
export function tenuesPubliees() { garde(); return liste.filter((s) => s.publie); }

/** Par identifiant, publiée ou non : une tenue déjà possédée doit s'afficher. */
export function tenuePar(id) { garde(); return parId.get(id); }

/** Uniquement pour les tests : repart d'un catalogue non chargé. */
export function oublierTenues() { charge = false; liste = []; parId = new Map(); }
