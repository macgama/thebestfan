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
// Les saisons décident des séries ouvertes : `charger` les charge donc en
// premier, et personne d'autre n'a à y penser. Voir `charger` plus bas.
import { chargerSaisons } from './saisons.js';
import { comparer, resumer } from './ecarts.js';
import { fusionner, resumerFusion, instantane, CHAMPS, MAX_DEFAUT }
  from './reconciliation.js';

let charge = false;
let liste = [];
let parId = new Map();
/** Le dernier constat d'écart entre `dex.js` et la base. `null` avant chargement. */
let ecarts = null;

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
 * Raccroche les âges supérieurs à leur personnage, sur une base déjà peuplée.
 *
 * `amorcer` n'écrase jamais une ligne existante — c'est ce qui protège les
 * cartes modifiées depuis l'administration, et il faut que ça le reste. Mais
 * cette prudence a un angle mort : le jour où l'on donne une lignée à cent
 * trente-huit personnages déjà en base, leurs nouveaux âges s'insèrent très
 * bien et **le lien `evo` du premier âge, lui, n'est jamais posé**. Les
 * `TR1B` et `TR1C` existent, personne ne les désigne, et les lignées
 * n'apparaissent nulle part.
 *
 * Rien ne l'aurait signalé : pas d'erreur, pas de log, juste des cartes
 * inaccessibles. C'est le défaut exact que ce projet a déjà payé plusieurs
 * fois.
 *
 * D'où cette reprise, et sa clause : `WHERE evo IS NULL`. On **remplit un
 * trou**, on ne corrige jamais un choix. Une lignée débranchée depuis
 * l'administration le reste.
 */
async function raccrocherLignees(pool) {
  let liens = 0;
  for (const f of AMORCE) {
    if (!f.evo) continue;
    const [r] = await pool.execute(
      `UPDATE fanzzy SET evo = ? WHERE id = ? AND evo IS NULL`, [f.evo, f.id]);
    liens += r.affectedRows;
  }
  return liens;
}

/**
 * La colonne `amorce` est-elle là ?
 *
 * Elle vient de `sql/fanzzy.sql`, et **rien n'oblige à le rejouer** : le
 * déploiement pousse le code, jamais le schéma. Écrire dedans sans le
 * demander ferait lever l'amorçage, le `catch` du démarrage attraperait tout,
 * et *toutes* les routes `/api` disparaîtraient — connexion comprise. C'est
 * mot pour mot la panne du 8 septembre 2026, onze heures durant, sur un
 * fichier de schéma oublié.
 *
 * On regarde donc avant d'écrire. Sans la colonne, le catalogue s'amorce comme
 * avant et la réconciliation se tait : le jeu tourne, il ne reprend rien, et le
 * démarrage dit quel fichier appliquer.
 *
 * Pas de cache : une requête au démarrage, et les suites qui refont la table
 * entre deux appels obtiennent la vérité du moment plutôt qu'un souvenir.
 */
async function colonneAmorce(pool) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM fanzzy LIKE 'amorce'`);
  return rows.length > 0;
}

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
async function amorcer(pool, avecAmorce) {
  let pose = 0;
  for (const [i, f] of AMORCE.entries()) {
    // `publie` vient de la fiche et non d'un 1 en dur : trente-deux anciennes
    // cartes refont un personnage du lot de 2026 et ne doivent plus être
    // proposées. Écrire 1 quoi qu'il arrive les remettrait dans les tirages à
    // chaque base neuve, et il faudrait les retirer à la main après chaque
    // installation — ce que personne ne pense à faire.
    /* La ligne emporte sa **référence d'amorçage** : ce que le code disait au
       moment où elle a été posée. C'est elle qui permettra plus tard de savoir
       si une valeur a bougé parce que le code a changé ou parce que quelqu'un
       l'a corrigée à l'écran — deux choses qu'aucune comparaison des seules
       valeurs ne peut distinguer. Voir `reconciliation.js`. */
    const champs = ['id', 'nom', 'type', 'set_id', 'stage', 'rar', 'evo',
      'histoire', 'mods', 'cri', 'publie', 'ordre'];
    const valeurs = [f.id, f.nom, f.type, f.set, f.stage, f.rar, f.evo ?? null,
      f.histoire ?? null, JSON.stringify(f.mods ?? {}), JSON.stringify(f.cri ?? {}),
      f.publie === false ? 0 : 1, i];
    if (avecAmorce) { champs.push('amorce'); valeurs.push(JSON.stringify(instantane(f))); }
    const [r] = await pool.execute(
      `INSERT IGNORE INTO fanzzy (${champs.join(', ')})
       VALUES (${champs.map(() => '?').join(', ')})`, valeurs);
    if (r.affectedRows) pose++;
  }
  return pose;
}

/* ------------------------------------------------------- la réconciliation

   `amorcer` pose les cartes neuves. Celle-ci fait redescendre le code dans les
   cartes **déjà là** — ce qu'`INSERT IGNORE` ne saura jamais faire — sans
   écraser une correction faite à l'écran. La règle vit dans
   `reconciliation.js`, pure et éprouvée à part ; ici, on lit, on écrit, on
   raconte.                                                                   */

/** Les colonnes SQL des champs gérés. `set` est réservé, d'où `set_id`. */
const COLONNE = { nom: 'nom', set: 'set_id', stage: 'stage', rar: 'rar', evo: 'evo',
  histoire: 'histoire', mods: 'mods', cri: 'cri', publie: 'publie' };

/** Une valeur de champ vers ce que le pilote doit envoyer. */
const versSql = (champ, v) => {
  if (champ === 'publie') return v ? 1 : 0;
  if (champ === 'mods' || champ === 'cri') return JSON.stringify(v ?? {});
  return v ?? null;
};

/**
 * Les cartes que l'administration a modifiées, d'après son journal.
 *
 * Sert au seul cas des lignes d'avant ce mécanisme : sans référence
 * d'amorçage, c'est la seule trace qui dise si quelqu'un y a touché. Le journal
 * peut manquer — `sql/admin.sql` non appliqué — et alors **on n'adopte rien** :
 * une table absente ne doit jamais se lire comme « personne n'a rien fait ».
 */
async function cartesTouchees(pool) {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT cible FROM admin_audit WHERE action LIKE 'fanzzy.%' AND cible IS NOT NULL`);
    return { connu: true, ids: new Set(rows.map((r) => r.cible)) };
  } catch (e) {
    if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    return { connu: false, ids: new Set() };
  }
}

/**
 * Fait redescendre le code dans la base, champ par champ.
 *
 * Ne lève jamais pour une raison de schéma : sans la colonne `amorce`, elle se
 * désactive en le disant. Le jeu tourne exactement comme avant — il ne reprend
 * simplement rien — et c'est le bon comportement pour une pièce qui s'ajoute :
 * la panne du 8 septembre 2026 est partie d'un fichier de schéma non appliqué
 * qui a éteint toutes les routes `/api`.
 */
async function reconcilier(pool, avecAmorce) {
  if (!avecAmorce) {
    console.warn('catalogue : colonne `amorce` absente, réconciliation désactivée '
      + '— applique sql/fanzzy.sql pour que les corrections du code atteignent '
      + 'les cartes déjà en base.');
    return null;
  }
  const colonnes = [...new Set(Object.values(COLONNE))].join(', ');
  const [rows] = await pool.query(`SELECT id, ${colonnes}, amorce FROM fanzzy`);

  const touchees = await cartesTouchees(pool);
  const base = rows.map((r) => ({
    ...versJeu(r),
    amorce: typeof r.amorce === 'string' ? JSON.parse(r.amorce) : r.amorce,
    /* Journal absent : on ne sait pas, donc on ne touche pas. `true` ici veut
       dire « considère-la comme corrigée à l'écran », ce qui est le refus
       d'adopter — le seul défaut qui ne perd rien. */
    toucheeAdmin: touchees.connu ? touchees.ids.has(r.id) : true,
  }));

  const max = Number(process.env.TBF_RECONCILIATION_MAX) || MAX_DEFAUT;
  const plan = fusionner({ code: AMORCE, base, max });
  for (const ligne of resumerFusion(plan)) console.warn(ligne);
  if (plan.bloque) return plan;

  for (const e of plan.ecrire) {
    const champs = Object.keys(e.valeurs);
    const sets = [...champs.map((c) => `${COLONNE[c]} = ?`), 'amorce = ?'];
    await pool.execute(
      `UPDATE fanzzy SET ${sets.join(', ')} WHERE id = ?`,
      [...champs.map((c) => versSql(c, e.valeurs[c])), JSON.stringify(e.amorce), e.id]);
  }
  return plan;
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

/**
 * À appeler une fois au démarrage, avant de monter les modules du jeu.
 *
 * **Il charge les saisons lui-même**, et en premier. Ce n'est pas une commodité :
 * `chargerSeries` en dépend entièrement — les séries ouvertes sont l'union des
 * saisons lancées — et tout ce qui monte un catalogue passe déjà par ici. Le
 * confier à l'appelant aurait voulu dire l'ajouter à dix-neuf suites et à chaque
 * nouvelle, avec pour seule sanction d'un oubli une exception au premier
 * affichage du kiosque.
 */
export async function charger(pool) {
  const saisons = await chargerSaisons(pool);
  const avecAmorce = await colonneAmorce(pool);
  const amorces = await amorcer(pool, avecAmorce);
  const liens = await raccrocherLignees(pool);
  /* Après l'amorçage — qui pose les cartes neuves avec leur référence — et
     avant la relecture, pour que la mémoire porte l'état fusionné et non celui
     d'avant. */
  const fusion = await reconcilier(pool, avecAmorce);
  const n = await recharger(pool);
  const series = await chargerSeries(pool);

  /* ## Le constat d'écart, à chaque démarrage, et à voix haute

     `amorcer` n'écrase jamais une ligne existante — c'est voulu, et ça ne
     changera pas. Mais ça veut dire qu'une carte modifiée dans `dex.js` peut
     ne jamais arriver en base, et qu'une ligne que le code ne connaît plus
     peut continuer d'être distribuée. **Aucun des deux ne lève d'erreur.**
     Jusqu'ici, ça se voyait à un compteur bizarre dans le classeur, des
     semaines plus tard, et il fallait penser à lancer `npm run ecarts`.

     Un garde-fou qu'on lance à la main se lance après avoir vu le symptôme.
     Celui-ci parle tout seul, ici, parce que tout ce qui monte un catalogue
     passe par `charger` — le serveur comme les dix-neuf suites. Une base
     amorcée depuis le même `dex.js` ne dit rien du tout : le silence est le
     cas normal, et c'est ce qui rend le bruit lisible le jour où il arrive. */
  ecarts = comparer({ code: AMORCE, base: liste, ouvertes });
  for (const ligne of resumer(ecarts)) console.warn(ligne);

  return { total: n, amorces, liens, series, saisons, ecarts, fusion };
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
   Six cent quarante cartes d'un coup, c'est trop pour commencer : un joueur qui
   lit « 1/280 » à sa première ouverture sait qu'il n'y arrivera jamais. On
   ouvre donc les séries par vagues.

   ## Ce sont les saisons qui ouvrent, plus le niveau du joueur

   Chaque série s'ouvrait à un **niveau** : LA TRIBUNE au 1, LES MÉTIERS DU
   STADE au 3, et ainsi de suite jusqu'au 26. C'était une progression
   solitaire — chacun découvrait le jeu à son rythme, seul, et le jour où une
   série arrivait n'existait pour personne d'autre. Deux joueurs qui se
   parlaient ne parlaient jamais de la même chose.

   Une saison ouvre **pour tout le monde en même temps**. C'est ce qui permet de
   relancer le jeu, d'annoncer quelque chose, et que ce quelque chose soit
   partagé. Voir `saisons.js`.

   Les séries ouvertes sont donc **l'union des saisons lancées**. Aucune saison
   en base — une installation dont `sql/saisons.sql` n'est pas appliqué — et
   tout reste ouvert : le jeu s'ouvre plutôt que de se fermer à double tour, et
   l'erreur se voit tout de suite au lieu de vider les kiosques en silence.

   Ce qui n'est PAS filtré : ce qu'un joueur possède déjà. Fermer une série ne
   lui retire rien — sa carte reste dans son classeur, dans son deck et sur son
   accueil. Fermer, c'est cesser de distribuer, pas confisquer.                */

const TOUTES = null;         // `null` : aucune restriction enregistrée
let ouvertes = TOUTES;

/**
 * Relit les séries ouvertes depuis les saisons lancées.
 *
 * Appelée au démarrage et après chaque écriture de l'administration, comme
 * `recharger`. Le nom reste : c'est bien la liste des séries ouvertes qu'elle
 * charge, et seule sa source a changé.
 */
export async function chargerSeries(pool) {
  let rows = [];
  try {
    [rows] = await pool.execute(
      `SELECT series FROM saisons WHERE lancee_a IS NOT NULL`);
  } catch (e) {
    /* `saisons` vient de sql/saisons.sql, que rien n'oblige à appliquer. Sans
       ce filet, une installation sans ce fichier ferait lever le démarrage — et
       le catch de server.js éteindrait *toutes* les routes /api, connexion
       comprise. C'est exactement la panne du 8 septembre, reprise sur une autre
       table. Pas de saisons, pas de restriction : tout est ouvert. */
    if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    console.warn('table saisons absente : toutes les séries restent ouvertes '
      + '(applique sql/saisons.sql pour pouvoir lancer des saisons)');
    ouvertes = TOUTES;
    return null;
  }

  const vues = new Set();
  for (const r of rows) {
    const v = typeof r.series === 'string' ? JSON.parse(r.series) : r.series;
    for (const id of Array.isArray(v) ? v : []) vues.add(String(id));
  }
  /* Aucune saison lancée, ou des saisons qui n'ouvrent rien : on interprète
     comme « aucune restriction » plutôt que comme « rien ». Un jeu sans une
     seule série ouverte n'est jamais ce qu'on a voulu dire. */
  ouvertes = vues.size ? vues : TOUTES;
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

/**
 * Le dernier constat d'écart entre `dex.js` et la base, ou `null`.
 *
 * Il est calculé au chargement et pas à la demande : il porte l'état du
 * catalogue **tel qu'il a été monté**, ce qui est précisément la question
 * qu'on pose après un déploiement. `/healthz` le sert.
 */
export const ecartsCatalogue = () => ecarts;

/** Utile aux tests et au diagnostic. */
export const estCharge = () => charge;

/** Uniquement pour les tests : repart d'un catalogue non chargé. */
export function oublier() {
  charge = false; liste = []; parId = new Map();
  racines = new Map(); chaines = new Map();
  ecarts = null;
}
