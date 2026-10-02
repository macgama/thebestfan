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
 *
 * ## La saison datée : aucune date ne traverse le pilote
 *
 * Une saison finit à la fin d'un **jour de jeu** (`fin_le`), et une saison en
 * préparation peut annoncer son jour d'ouverture (`ouvre_le`). Ces jours sont
 * ceux de la base : son `CURDATE()`, son minuit, son fuseau — celui des quotas
 * gratuits et des missions.
 *
 * Ils ne sont donc **jamais** relus en objet `Date`. Le pilote est en
 * `timezone: 'Z'` : une colonne `DATE` y devient minuit UTC, et la même date
 * s'affiche la veille à Montréal. Le jour part en texte
 * (`DATE_FORMAT(…, '%Y-%m-%d')`), et les durées sont mesurées **par la base**
 * au chargement — `UNIX_TIMESTAMP(fin + 1 jour) - UNIX_TIMESTAMP(NOW(3))`,
 * qui compte juste les jours de 23 h et de 25 h, là où `TIMESTAMPDIFF` compte
 * l'heure murale et se trompe d'une heure deux dimanches par an. Ensuite,
 * elles s'ajustent du temps écoulé mesuré par Node : une durée relative ne
 * dépend d'aucun fuseau.
 *
 * Le nombre de jours restants se compte de la même façon, à partir du minuit
 * suivant mesuré par la base. Au premier appel après ce minuit, la table est
 * relue en arrière-plan (une requête par jour) : sans cela, un processus qui
 * a traversé un changement d'heure compterait ses minuits suivants une heure
 * trop tôt ou trop tard, jusqu'au prochain redémarrage.
 */

import { validerCarnet } from '../../shared/saison.js';

let charge = false;
let liste = [];

const JOUR_MS = 86_400_000;

/* Les dates de chaque saison, mesurées au chargement :
   id → { fin: { jour, ms, jours } | null, ouvre: { jour, ms, finMs, jours } | null }.
   `ms` est une durée à l'instant du chargement, `jours` un écart de jours de
   jeu (`DATEDIFF`). Rien ici n'est un instant absolu. */
let dates = new Map();
/* Le carnet propre à chaque saison, normalisé ; absent : le carnet par défaut. */
let carnets = new Map();
/* `t` : l'instant du chargement pour Node (`performance.now()`), `minuitMs` :
   la durée jusqu'au minuit suivant de la base, au même instant. */
let ancre = { t: 0, minuitMs: null };

/* La relecture de minuit, et ce qui l'empêche de se marcher dessus. */
let poolVu = null;
let enRelecture = null;
let pasAvant = 0;
let lancees = 0;      // chargements commencés
let appliquee = 0;    // dernier chargement dont le résultat a été posé
let sansColonnesDit = false;

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

/* Toutes les colonnes (`s.*`), et non une liste nommée : `stades` est arrivée
   avec sql/contenus.sql, et la nommer ferait lever sur une base où ce fichier
   n'est pas appliqué. Une base d'avant rend alors une saison sans stade, ce
   qui est sa vérité.

   Les jours partent en texte et les durées sont mesurées ici, par la base,
   dans son fuseau. `minuit_ms` ne dépend pas de la ligne : il est le même
   pour toutes, et le lire ici évite une requête de plus. */
const AVEC_DATES = `SELECT s.*,
    DATE_FORMAT(s.fin_le, '%Y-%m-%d') AS fin_jour,
    DATEDIFF(s.fin_le, CURDATE()) AS fin_jours,
    ROUND((UNIX_TIMESTAMP(s.fin_le + INTERVAL 1 DAY) - UNIX_TIMESTAMP(NOW(3))) * 1000) AS fin_ms,
    DATE_FORMAT(s.ouvre_le, '%Y-%m-%d') AS ouvre_jour,
    DATEDIFF(s.ouvre_le, CURDATE()) AS ouvre_jours,
    ROUND((UNIX_TIMESTAMP(s.ouvre_le) - UNIX_TIMESTAMP(NOW(3))) * 1000) AS ouvre_ms,
    ROUND((UNIX_TIMESTAMP(s.ouvre_le + INTERVAL 1 DAY) - UNIX_TIMESTAMP(NOW(3))) * 1000) AS ouvre_fin_ms,
    ROUND((UNIX_TIMESTAMP(CURDATE() + INTERVAL 1 DAY) - UNIX_TIMESTAMP(NOW(3))) * 1000) AS minuit_ms
  FROM saisons s ORDER BY s.numero, s.id`;

/** Un nombre lu en base (DECIMAL arrive en chaîne), ou `null`. */
const nombre = (v) => (v === null || v === undefined ? null : Number(v));

async function lire(pool) {
  try {
    const [rows] = await pool.execute(AVEC_DATES);
    return rows;
  } catch (e) {
    /* Les colonnes viennent de sql/quotidien.sql. Sans elles, le jeu tourne
       comme avant : la saison est servie sans date, sans carnet propre, et
       personne ne voit de fin. On le dit une fois, en nommant le fichier. */
    if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
    if (!sansColonnesDit) {
      sansColonnesDit = true;
      console.warn('saisons sans date : colonnes fin_le, ouvre_le ou carnet absentes '
        + '(applique sql/quotidien.sql, puis redémarre)');
    }
    const [rows] = await pool.execute(`SELECT * FROM saisons ORDER BY numero, id`);
    return rows;
  }
}

/** Le carnet propre d'une ligne, normalisé, ou `null` (le carnet par défaut). */
function carnetDeLaLigne(r) {
  if (r.carnet === null || r.carnet === undefined) return null;
  try { return validerCarnet(r.carnet); } catch (e) {
    /* Un carnet que l'administration n'a pas pu écrire (une main passée dans
       la base) : on le garde tel quel, et `carnetDe` retombera sur le défaut
       en le disant. Le jeter ici effacerait la trace de ce qui a été saisi. */
    console.warn(`saison ${r.id} : carnet en base illisible (${e.raison ?? e.message})`);
    return typeof r.carnet === 'string' ? r.carnet : JSON.stringify(r.carnet);
  }
}

function poser(rows, t) {
  liste = rows.map(versJeu);
  dates = new Map(rows.map((r) => [Number(r.id), {
    fin: r.fin_jour ? { jour: r.fin_jour, ms: nombre(r.fin_ms), jours: nombre(r.fin_jours) } : null,
    ouvre: r.ouvre_jour ? { jour: r.ouvre_jour, ms: nombre(r.ouvre_ms),
      finMs: nombre(r.ouvre_fin_ms), jours: nombre(r.ouvre_jours) } : null,
  }]));
  carnets = new Map();
  for (const r of rows) {
    const c = carnetDeLaLigne(r);
    if (c !== null) carnets.set(Number(r.id), c);
  }
  const minuit = rows.find((r) => r.minuit_ms !== undefined && r.minuit_ms !== null);
  ancre = { t, minuitMs: minuit ? nombre(minuit.minuit_ms) : null };
  charge = true;
}

/**
 * Relit toute la table. Ne lève jamais si `sql/saisons.sql` manque : sans lui
 * le jeu tourne exactement comme avant, toutes séries ouvertes. C'est la même
 * précaution que pour `reglages` — une table absente ne doit pas éteindre les
 * routes `/api`, connexion comprise.
 *
 * Deux lectures peuvent se croiser : celle de l'administration après une
 * écriture, et la relecture de minuit, lancée en arrière-plan. Un résultat
 * n'est posé que s'il est plus récent que le dernier posé : une relecture
 * partie avant l'écriture et revenue après ne remet jamais l'ancienne liste.
 *
 * @returns {Promise<number|null>} le nombre de saisons, ou `null` sans table.
 */
export async function chargerSaisons(pool) {
  poolVu = pool;
  const moi = ++lancees;
  /* L'instant pris **avant** la requête : la durée lue est un peu plus courte
     que la vraie, jamais plus longue. Une saison se dit finie quelques
     millisecondes tôt plutôt que tard. */
  const t = performance.now();
  let rows;
  try {
    rows = await lire(pool);
  } catch (e) {
    if (e.code !== 'ER_NO_SUCH_TABLE') throw e;
    console.warn('table saisons absente : le jeu tourne sans saisons '
      + '(applique sql/saisons.sql)');
    rows = null;
  }
  if (moi < appliquee) return rows ? rows.length : null;
  appliquee = moi;
  poser(rows ?? [], t);
  return rows ? liste.length : null;
}

/** Le temps écoulé depuis le chargement, et les minuits de la base passés depuis. */
function maintenant() {
  const e = performance.now() - ancre.t;
  const m = ancre.minuitMs;
  const minuits = m === null || e < m ? 0 : 1 + Math.floor((e - m) / JOUR_MS);
  if (minuits > 0) relireApresMinuit();
  return { e, minuits };
}

/* Au premier appel après le minuit de la base, on relit en arrière-plan. Le
   premier minuit est exact (mesuré par la base) ; les suivants ne seraient
   que supposés à vingt-quatre heures, et un changement d'heure les décalerait.
   Une relecture qui échoue ne se retente pas avant une minute : un pool fermé
   ne doit pas faire une requête à chaque appel. */
function relireApresMinuit() {
  if (!poolVu || enRelecture || performance.now() < pasAvant) return;
  enRelecture = chargerSaisons(poolVu)
    .catch((e) => {
      pasAvant = performance.now() + 60_000;
      console.warn(`saisons : relecture de minuit impossible (${e.message})`);
    })
    .finally(() => { enRelecture = null; });
}

/** La fin d'une saison, à cet instant : `{ fin, finDansMs, joursRestants }` ou `null`. */
function finDe(id, { e, minuits }) {
  const d = dates.get(id)?.fin;
  if (!d || d.ms === null) return null;
  const finDansMs = Math.max(0, Math.round(d.ms - e));
  /* Aujourd'hui compris : 1 le dernier jour, 0 une fois finie. Tant qu'il
     reste du temps, il reste au moins ce jour-ci. */
  const joursRestants = finDansMs > 0 ? Math.max(1, d.jours + 1 - minuits) : 0;
  return { fin: d.jour, finDansMs, joursRestants };
}

/**
 * Une saison telle qu'on la sert, à cet instant : sa forme de jeu, plus `fin`,
 * `finDansMs` et `joursRestants` quand une date de fin est saisie (absents
 * sinon), `finie`, et `carnet` quand la saison a le sien (absent : le carnet
 * par défaut). Un objet neuf à chaque appel : les durées bougent.
 */
function habiller(s, instant, { annonce = false } = {}) {
  const f = finDe(s.id, instant);
  const o = { ...s };
  if (f) Object.assign(o, f);
  o.finie = Boolean(f && f.finDansMs <= 0);
  const c = carnets.get(s.id);
  if (c) o.carnet = c;
  if (annonce) {
    const ou = dates.get(s.id)?.ouvre;
    if (ou) o.ouvre = ou.jour;
  }
  return o;
}

/**
 * Toutes les saisons, brouillons compris. C'est ce que voit l'administration :
 * chacune porte en plus, quand elle en a, sa date de fin (`fin`,
 * `finDansMs`, `joursRestants`), sa date d'ouverture annoncée (`ouvre`) et son
 * carnet propre (`carnet`).
 */
export function toutesLesSaisons() {
  garde();
  const instant = maintenant();
  return liste.map((s) => habiller(s, instant, { annonce: true }));
}

/** Celles qui sont lancées, de la plus ancienne à la plus récente. */
export const saisonsLancees = () => toutesLesSaisons().filter((s) => s.lancee);

/**
 * La saison en cours : la dernière lancée.
 *
 * C'est elle qu'on annonce. Pas « celle qui a le plus grand numéro » — on peut
 * préparer la 5 en brouillon pendant que la 4 court, et annoncer la 5 avant de
 * l'avoir lancée serait promettre ce qui n'existe pas encore.
 *
 * Elle porte la forme de `CONTRATS.md`, § 7.1 : ses champs d'avant, plus
 * `fin`, `finDansMs`, `joursRestants` (absents tant qu'aucune date de fin
 * n'est saisie) et `finie`. Une saison finie reste « en cours » jusqu'au
 * lancement de la suivante : ce qu'elle a ouvert reste ouvert, seuls son
 * carnet, ses divisions et son classement s'arrêtent.
 */
export function saisonEnCours() {
  garde();
  const lanceesIci = liste.filter((s) => s.lancee);
  if (!lanceesIci.length) return null;
  /* L'ordre des lancements se lit sur `lanceeA` tel que le pilote le rend :
     toutes les lignes passent par la même conversion, l'ordre est donc juste
     même si l'heure affichée ne l'est pas. Aucune durée n'en est tirée. */
  const derniere = lanceesIci.reduce((a, b) =>
    (new Date(b.lanceeA) >= new Date(a.lanceeA) ? b : a));
  return habiller(derniere, maintenant());
}

/**
 * La saison annoncée (`CONTRATS.md`, § 7.2) :
 * `{ id, numero, nom, ouvre, ouvreDansMs, joursAvant }`, ou `null`.
 *
 * Une saison **en brouillon** qui porte une date d'ouverture, jusqu'à la fin
 * de ce jour-là. Le jour annoncé, `ouvreDansMs` et `joursAvant` valent 0
 * (« AUJOURD'HUI ») tant qu'elle n'est pas lancée ; le lendemain, une annonce
 * restée en brouillon disparaît — on n'affiche jamais une date dépassée.
 * Poser cette date dans l'administration, c'est décider de l'annoncer : sans
 * elle, aucun « SAISON 2 » nulle part.
 *
 * Deux brouillons annoncés : le plus proche.
 */
export function saisonProchaine() {
  garde();
  const { e, minuits } = maintenant();
  let choix = null;
  for (const s of liste) {
    if (s.lancee) continue;
    const o = dates.get(s.id)?.ouvre;
    if (!o || o.finMs === null || o.finMs - e <= 0) continue;
    if (!choix || o.jour < choix.o.jour
      || (o.jour === choix.o.jour && s.numero < choix.s.numero)) choix = { s, o };
  }
  if (!choix) return null;
  const { s, o } = choix;
  return {
    id: s.id, numero: s.numero, nom: s.nom, ouvre: o.jour,
    ouvreDansMs: Math.max(0, Math.round(o.ms - e)),
    joursAvant: Math.max(0, o.jours - minuits),
  };
}

/**
 * Les séries que la saison annoncée **ouvrira** : `{ <série>: <numéro> }`,
 * pour `sets[].prochaine` de `/dex` (`CONTRATS.md`, § 7.2). Vide sans annonce.
 *
 * Seulement celles qui sont fermées aujourd'hui : une série déjà ouverte par
 * une saison lancée ne « s'ouvre » pas à la suivante. La règle d'ouverture est
 * celle du catalogue (`chargerSeries`) : l'union des saisons lancées, et tout
 * ouvert si cette union est vide.
 */
export function seriesAnnoncees() {
  const p = saisonProchaine();
  if (!p) return {};
  const s = liste.find((x) => x.id === p.id);
  const ouvertes = new Set(liste.filter((x) => x.lancee).flatMap((x) => x.series));
  if (!ouvertes.size) return {};
  return Object.fromEntries((s?.series ?? [])
    .filter((id) => !ouvertes.has(id)).map((id) => [id, p.numero]));
}

/** Uniquement pour les tests : repart d'un état non chargé. */
export function oublierSaisons() {
  charge = false; liste = []; dates = new Map(); carnets = new Map();
  ancre = { t: 0, minuitMs: null }; pasAvant = 0;
}

/** Utile aux tests et au diagnostic. */
export const saisonsChargees = () => charge;
