/**
 * Les saisons : ce qui ouvre le contenu, et ce qui l'annonce.
 *
 * ## Ce qui a changé, et pourquoi
 *
 * Les séries s'ouvraient **au niveau du joueur**. LA TRIBUNE au niveau 1, LES
 * MÉTIERS DU STADE au 3, LE VIRAGE IMPOSSIBLE au 26. Ça marchait, et ça avait
 * un défaut qu'on ne voit qu'en regardant le jeu vivre : **rien n'arrivait
 * jamais à personne en même temps**. Chacun découvrait une série le jour où son
 * compteur d'expérience passait un seuil, seul, sans que ce jour-là existe pour
 * qui que ce soit d'autre. Deux joueurs qui se parlent ne parlent alors jamais
 * de la même chose, et il n'y a rien à annoncer — puisqu'il n'y a rien de neuf,
 * seulement quelqu'un qui rattrape.
 *
 * Une saison fait l'inverse. Elle ouvre pour **tout le monde, le même jour**.
 * C'est ce qui permet de relancer le jeu : cinq séries neuves, des tenues, des
 * mécaniques, et une annonce qui dit qu'il se passe quelque chose.
 *
 * ## Ce qu'une saison ouvre vraiment
 *
 * Les **séries** et les **tenues** : les deux seuls contenus du jeu qui aient un
 * état de publication. Lancer une saison ouvre les unes et publie les autres.
 *
 * Les pièces d'équipement et les cartes d'action sont du **code**, pas de la
 * base. Une saison peut les *annoncer* — c'est à cela que servent `stuff` et
 * `actions` — mais elle ne les retient pas, parce que rien ne sait les retenir.
 * Le dire ici plutôt que de faire semblant : le jour où ils vivront en base
 * comme le catalogue, les deux champs deviendront des leviers sans changer de
 * forme.
 *
 * ## Additif, jamais soustractif
 *
 * Ce qu'une saison ouvre reste ouvert. La saison 4 n'annule pas la 3 : les
 * séries ouvertes sont **l'union** de toutes les saisons lancées. Un
 * collectionneur qui a commencé LES REVENANTS doit pouvoir les finir, et une
 * série qui se referme derrière lui transformerait sa collection en dette.
 *
 * Refermer reste possible, dans l'autre sens : on remet la saison en brouillon.
 * C'est rare, et c'est délibérément malcommode.
 *
 * ## La lecture est synchrone
 *
 * Comme le catalogue et les tenues : on charge tout en mémoire au démarrage, on
 * recharge après chaque écriture. Une liste de cinq lignes relue à chaque
 * ouverture de kiosque serait absurde.
 */

let charge = false;
let liste = [];

function garde() {
  if (charge) return;
  throw new Error(
    'Les saisons n’ont pas été chargées. Appelle chargerSaisons(pool) au '
    + 'démarrage, avant de monter les modules qui s’en servent — fanzzy et '
    + 'administration. Dans un test, appelle-le juste après avoir appliqué '
    + 'sql/saisons.sql.');
}

/** Une colonne JSON revient en objet ou en chaîne selon le pilote et la version. */
const lireJson = (v) => {
  const x = typeof v === 'string' ? JSON.parse(v || '[]') : (v ?? []);
  return Array.isArray(x) ? x.map(String) : [];
};

const versJeu = (r) => ({
  id: Number(r.id),
  numero: Number(r.numero),
  nom: r.nom,
  texte: r.texte ?? null,
  series: lireJson(r.series),
  tenues: lireJson(r.tenues),
  stuff: lireJson(r.stuff),
  actions: lireJson(r.actions),
  /* Les stades rejoignent les trois autres familles de contenu. La colonne
     est arrivée après les autres : une base d'avant sql/contenus.sql ne la
     sert pas, et `lireJson` rend alors une liste vide — une saison sans
     stade, ce qui est la vérité. */
  stades: lireJson(r.stades),
  // `lancee` plutôt qu'un booléen déduit ailleurs : la date porte les deux
  // informations, et un écran qui veut dire « lancée le 3 octobre » l'a sous la
  // main sans seconde requête.
  lanceeA: r.lancee_a ?? null,
  lancee: r.lancee_a != null,
});

/**
 * Relit toute la table. Ne lève jamais si `sql/saisons.sql` manque : sans lui
 * le jeu tourne exactement comme avant, toutes séries ouvertes. C'est la même
 * précaution que pour `reglages` — une table absente ne doit pas éteindre les
 * routes `/api`, connexion comprise.
 *
 * @returns {Promise<number|null>} le nombre de saisons, ou `null` sans table.
 */
export async function chargerSaisons(pool) {
  try {
    const [rows] = await pool.execute(
      /* Toutes les colonnes, et non la liste nommée qu'il y avait ici.
         `stades` est arrivée avec sql/contenus.sql : la nommer ferait lever
         sur une base où ce fichier n'est pas appliqué, et le `catch` en
         dessous ne rattrape que la table absente — pas la colonne. Une base
         d'avant rend alors une saison sans stade, ce qui est sa vérité. */
      `SELECT * FROM saisons ORDER BY numero, id`);
    liste = rows.map(versJeu);
    charge = true;
    return liste.length;
  } catch (e) {
    if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    console.warn('table saisons absente : le jeu tourne sans saisons '
      + '(applique sql/saisons.sql)');
    liste = [];
    charge = true;
    return null;
  }
}

/** Toutes les saisons, brouillons compris. C'est ce que voit l'administration. */
export function toutesLesSaisons() { garde(); return liste; }

/** Celles qui sont lancées, de la plus ancienne à la plus récente. */
export const saisonsLancees = () => toutesLesSaisons().filter((s) => s.lancee);

/**
 * La saison en cours : la dernière lancée.
 *
 * C'est elle qu'on annonce. Pas « celle qui a le plus grand numéro » — on peut
 * préparer la 5 en brouillon pendant que la 4 court, et annoncer la 5 avant de
 * l'avoir lancée serait promettre ce qui n'existe pas encore.
 */
export function saisonEnCours() {
  const lancees = saisonsLancees();
  if (!lancees.length) return null;
  return lancees.reduce((a, b) =>
    (new Date(b.lanceeA) >= new Date(a.lanceeA) ? b : a));
}

/** Uniquement pour les tests : repart d'un état non chargé. */
export function oublierSaisons() { charge = false; liste = []; }

/** Utile aux tests et au diagnostic. */
export const saisonsChargees = () => charge;
