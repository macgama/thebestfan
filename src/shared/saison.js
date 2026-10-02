/**
 * La saison, en règles pures : le carnet de tampons, les divisions, et la
 * borne de fin de sa fenêtre.
 *
 * ## Pourquoi un module partagé, sans base
 *
 * Trois modules du serveur lisent la saison : le quotidien (le carnet et le
 * jour où une mission cesse de le remplir), le classement (la fenêtre du
 * classement « saison » et les divisions), et l'administration (qui saisit le
 * carnet). S'ils écrivaient chacun leur règle, ils finiraient par ne plus dire
 * la même chose — c'est l'histoire de la table des effets, recopiée cinq fois
 * et fausse dans trois. Ici, une seule fois.
 *
 * Rien dans ce fichier ne lit la base ni l'horloge. Les dates, elles, sont
 * l'affaire de `src/server/fanzzy/saisons.js` et du SQL : le jour de jeu est
 * celui de la base, jamais celui de Node.
 *
 * ## Ce que ce fichier ne contient pas, exprès
 *
 * **Aucun gain de division.** Une division ne paie que l'honneur : l'insigne,
 * et le titre pour Capo. La ferveur classée n'a pas de plafond pour un
 * abonné ; une division qui verserait des écharpes ou des boosters
 * s'achèterait donc en partie (`SERVEUR.md`, § 6). Le gain nul de la forme R5
 * s'écrit en dur à l'endroit qui verse, et aucun réglage ne peut le remplir.
 */

import { reglage, DEFAUTS } from './reglages.js';

/* ============================================================== le carnet

   Le carnet de tampons de la saison 1, « La reprise » (`SERVEUR.md`, § 5).
   C'est le carnet par défaut : une saison qui n'a pas le sien en base
   (`saisons.carnet` nul) suit celui-ci.

   Forme **saisie** (celle de la colonne et de l'onglet Saisons) : le seuil en
   tampons, le nom, les écharpes et les boosters versés, l'insigne s'il y en a
   un, et `titre: true` quand le nom du palier devient un titre. Le titre est
   le nom lui-même : deux champs qui disent la même chose finiraient par
   diverger.

   Calibré sur 63 jours de missions (mise en ligne au plus tard le
   19 octobre 2026). Plus tard, il se recale dans l'onglet Saisons, seuils
   multipliés par « jours restants / 63 », **avant** le premier palier versé. */

export const CARNET_DEFAUT = Object.freeze([
  { tampons: 10, nom: 'De retour', echarpes: 100, packs: 0 },
  { tampons: 40, nom: 'Dans le bain', echarpes: 150, packs: 1, insigne: 'lisere' },
  { tampons: 100, nom: 'Remis en voix', echarpes: 250, packs: 2, insigne: 'tampon' },
  { tampons: 180, nom: 'Au rendez-vous', echarpes: 400, packs: 3 },
  { tampons: 260, nom: 'Revenu pour de bon', echarpes: 600, packs: 4, titre: true },
].map((p) => Object.freeze(p)));

/** Les bornes d'un carnet saisi. Écrites une fois : le refus les cite. */
export const LIMITES_CARNET = Object.freeze({
  paliersMin: 1, paliersMax: 8,
  /* Le seuil le plus haut qu'un carnet puisse demander. Un assidu fait
     environ 4,7 tampons par jour : cent mille, c'est une borne de saisie,
     pas une règle de jeu. */
  tamponsMax: 100000,
  echarpesMax: 2000, packsMax: 10, nomMax: 40,
});

const INSIGNES = ['lisere', 'tampon'];
const CLES_PALIER = ['tampons', 'nom', 'echarpes', 'packs', 'insigne', 'titre'];

/**
 * Un carnet refusé. Il nomme le palier **et** ce qui ne va pas : « seuils
 * décroissants » oblige à relire tout le carnet, « palier 3 : 100 tampons
 * après 100 » se corrige sans rien ouvrir.
 */
export class CarnetInvalide extends Error {
  constructor(raison) {
    super(`carnet invalide : ${raison}`);
    this.code = 'admin.error.carnet_invalide';
    this.raison = `Carnet refusé — ${raison}`;
    this.status = 400;
  }
}

const entier = (v) => typeof v === 'number' && Number.isInteger(v);

/**
 * Valide un carnet saisi et le rend sous sa forme normalisée.
 *
 * Accepte le texte de l'onglet Saisons (du JSON), un tableau de paliers, ou
 * un objet `{ paliers: [...] }`. Rend un tableau gelé de paliers
 * `{ tampons, nom, echarpes, packs, insigne?, titre? }`, ou lève
 * `CarnetInvalide` en nommant le défaut.
 *
 * **Une clé inconnue est refusée**, nommément. `"echarpe": 300` au lieu de
 * `"echarpes"` ne doit pas verser zéro écharpe en silence à des milliers de
 * joueurs : c'est le genre de faute qu'on ne voit qu'au premier palier versé,
 * c'est-à-dire quand le carnet ne se modifie plus.
 */
export function validerCarnet(brut) {
  let v = brut;
  if (typeof v === 'string') {
    if (!v.trim()) throw new CarnetInvalide('il est vide');
    try { v = JSON.parse(v); } catch (e) {
      throw new CarnetInvalide(`ce n’est pas du JSON lisible (${e.message})`);
    }
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const cles = Object.keys(v);
    if (cles.length === 1 && Array.isArray(v.paliers)) v = v.paliers;
    else throw new CarnetInvalide('attendu un tableau de paliers');
  }
  if (!Array.isArray(v)) throw new CarnetInvalide('attendu un tableau de paliers');

  const { paliersMin, paliersMax, tamponsMax, echarpesMax, packsMax, nomMax } = LIMITES_CARNET;
  if (v.length < paliersMin || v.length > paliersMax) {
    throw new CarnetInvalide(`de ${paliersMin} à ${paliersMax} paliers, reçu ${v.length}`);
  }

  const sortie = [];
  let precedent = 0;
  v.forEach((p, i) => {
    const ici = `palier ${i + 1}`;
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      throw new CarnetInvalide(`${ici} : attendu un objet`);
    }
    const inconnue = Object.keys(p).find((k) => !CLES_PALIER.includes(k));
    if (inconnue) {
      throw new CarnetInvalide(`${ici} : clé inconnue « ${inconnue} » `
        + `(attendu : ${CLES_PALIER.join(', ')})`);
    }

    if (!entier(p.tampons) || p.tampons < 1 || p.tampons > tamponsMax) {
      throw new CarnetInvalide(`${ici} : « tampons » est un entier de 1 à ${tamponsMax}, `
        + `reçu ${JSON.stringify(p.tampons)}`);
    }
    /* Strictement croissants : deux paliers au même seuil se débloqueraient
       ensemble, et un seuil plus bas après un plus haut se débloquerait
       avant lui — la jauge du carnet reculerait. */
    if (p.tampons <= precedent) {
      throw new CarnetInvalide(`${ici} : les seuils doivent monter strictement `
        + `(${p.tampons} tampons après ${precedent})`);
    }
    precedent = p.tampons;

    const nom = typeof p.nom === 'string' ? p.nom.trim() : '';
    if (!nom || nom.length > nomMax) {
      throw new CarnetInvalide(`${ici} : « nom » est un texte de 1 à ${nomMax} caractères`);
    }

    const echarpes = p.echarpes ?? 0;
    if (!entier(echarpes) || echarpes < 0 || echarpes > echarpesMax) {
      throw new CarnetInvalide(`${ici} : « echarpes » est un entier de 0 à ${echarpesMax}, `
        + `reçu ${JSON.stringify(p.echarpes)}`);
    }
    const packs = p.packs ?? 0;
    if (!entier(packs) || packs < 0 || packs > packsMax) {
      throw new CarnetInvalide(`${ici} : « packs » (les boosters) est un entier de 0 à `
        + `${packsMax}, reçu ${JSON.stringify(p.packs)}`);
    }

    const insigne = p.insigne ?? null;
    if (insigne !== null && !INSIGNES.includes(insigne)) {
      throw new CarnetInvalide(`${ici} : « insigne » vaut ${INSIGNES.join(' ou ')}, `
        + `reçu ${JSON.stringify(p.insigne)}`);
    }
    const titre = p.titre ?? false;
    if (typeof titre !== 'boolean') {
      throw new CarnetInvalide(`${ici} : « titre » est vrai ou faux — le titre, c’est `
        + 'le nom du palier');
    }

    /* Un palier qui ne donne rien afficherait RÉCUPÉRER pour rien. C'est
       presque toujours une clé oubliée, et on le dit pendant qu'on peut
       encore corriger. */
    if (!echarpes && !packs && !insigne && !titre) {
      throw new CarnetInvalide(`${ici} : il ne donne rien (ni écharpes, ni boosters, `
        + 'ni insigne, ni titre)');
    }

    sortie.push(Object.freeze({ tampons: p.tampons, nom, echarpes, packs,
      ...(insigne ? { insigne } : {}), ...(titre ? { titre: true } : {}) }));
  });
  return Object.freeze(sortie);
}

/** Deux carnets normalisés disent-ils la même chose ? */
export function memeCarnet(a, b) {
  return JSON.stringify(a ?? CARNET_DEFAUT) === JSON.stringify(b ?? CARNET_DEFAUT);
}

const avertis = new Set();

/**
 * Le carnet d'une saison, prêt à servir (`CONTRATS.md`, § 6.1) :
 * `[{ n, tampons, nom, gain, insigne?, titre? }]`, où `gain` a la forme R5 et
 * `titre` est le texte du titre. L'`etat` de chaque palier dépend du joueur :
 * c'est à l'appelant de l'ajouter. Les objets rendus sont neufs à chaque
 * appel.
 *
 * `saison.carnet` absent ou nul : le carnet par défaut. Un carnet en base qui
 * ne passe plus la validation (une main passée dans la base, des bornes qui
 * ont changé) retombe aussi sur le défaut, et le journal le dit une fois par
 * saison : un carnet illisible ne doit pas éteindre le quotidien.
 */
export function carnetDe(saison) {
  let paliers = CARNET_DEFAUT;
  if (saison?.carnet != null) {
    try { paliers = validerCarnet(saison.carnet); } catch (e) {
      const qui = saison.id ?? '?';
      if (!avertis.has(qui)) {
        avertis.add(qui);
        console.warn(`saison ${qui} : carnet en base illisible, carnet par défaut `
          + `servi (${e.raison ?? e.message})`);
      }
    }
  }
  return paliers.map((p, i) => ({
    n: i + 1,
    tampons: p.tampons,
    nom: p.nom,
    gain: { echarpes: p.echarpes, packs: p.packs, xp: 0, tampons: 0 },
    ...(p.insigne ? { insigne: p.insigne } : {}),
    ...(p.titre ? { titre: p.nom } : {}),
  }));
}

/* =========================================================== les divisions

   Cinq divisions de saison, comptées sur la **ferveur classée** de la saison.
   Des seuils fixes, jamais des pourcentages : une division atteinte reste
   acquise, même si d'autres joueurs vous dépassent. Sympathisant arrive dès
   la première ferveur ; les quatre autres seuils sont des réglages
   (`rang.habitue` … `rang.capo`). */

export const DIVISIONS = Object.freeze([
  { n: 1, id: 'sympathisant', nom: 'SYMPATHISANT' },
  { n: 2, id: 'habitue', nom: 'HABITUÉ' },
  { n: 3, id: 'fervent', nom: 'FERVENT' },
  { n: 4, id: 'ultra', nom: 'ULTRA' },
  { n: 5, id: 'capo', nom: 'CAPO' },
].map((d) => Object.freeze(d)));

/* Le réglage de chaque seuil. À part de `DIVISIONS`, dont les objets ont
   exactement la forme `division` du contrat : un champ de plus y partirait
   dans les réponses. */
const SEUIL_DE = { habitue: 'rang.habitue', fervent: 'rang.fervent',
  ultra: 'rang.ultra', capo: 'rang.capo' };

/**
 * Les cinq divisions et leur seuil, tel que le jeu l'applique maintenant :
 * `[{ n, id, nom, seuil }]`.
 *
 * Le registre ne contrôle pas les seuils entre eux : on peut régler Fervent
 * sous Habitué. Ils sont donc rendus **monotones** ici, chacun au moins égal
 * au précédent, avant que quiconque s'en serve. Deux seuils égaux se
 * franchissent ensemble ; un seuil plus bas que le précédent ne peut pas
 * faire passer quelqu'un au-dessus d'une division qu'il n'a pas.
 */
export function seuilsDivisions() {
  let plancher = 1;   // Sympathisant : dès la première ferveur
  return DIVISIONS.map((d) => {
    const cle = SEUIL_DE[d.id];
    let v = cle ? Number(reglage(cle)) : 1;
    if (!Number.isFinite(v) || v < 0) v = cle ? DEFAUTS[cle] : 1;
    plancher = Math.max(plancher, Math.floor(v));
    return { ...d, seuil: plancher };
  });
}

/**
 * La division atteinte pour cette ferveur : `{ n, id, nom }`, ou `null` tant
 * que la ferveur de la saison est nulle (le contrat n'a alors pas de
 * division : on n'affiche jamais « aucune division »).
 */
export function divisionPour(ferveur, seuils = seuilsDivisions()) {
  const f = Number(ferveur);
  if (!Number.isFinite(f) || f <= 0) return null;
  let atteinte = null;
  for (const d of seuils) if (f >= d.seuil) atteinte = d;
  return atteinte ? { n: atteinte.n, id: atteinte.id, nom: atteinte.nom } : null;
}

/**
 * La division suivante : `{ n, id, nom, seuil, manque }`, ou `null` à Capo.
 * C'est la première dont le seuil n'est pas encore atteint — deux seuils
 * égaux ne font donc jamais annoncer une division qu'on a déjà.
 */
export function divisionSuivante(ferveur, seuils = seuilsDivisions()) {
  const f = Math.max(0, Number(ferveur) || 0);
  const d = seuils.find((x) => x.seuil > f);
  return d ? { n: d.n, id: d.id, nom: d.nom, seuil: d.seuil, manque: d.seuil - f } : null;
}

/** Le titre que donne une division, ou `null` : seul Capo en donne un. */
export function titreDivision(n, numero) {
  return Number(n) === 5 ? `Capo de la saison ${numero}` : null;
}

/* ================================================== la fenêtre d'une saison

   **Une seule borne, écrite en SQL, pour tous.** Le classement « saison », les
   divisions, la saison passée et les missions lisent la même fin : sinon un
   joueur verrait sa division close pendant que le classement compte encore,
   ou un carnet fermé recevoir des tampons.

   La fenêtre d'une saison va de son lancement (`lancee_a`) à la **fin de son
   jour `fin_le`** — ou au **lancement de la saison suivante** s'il vient
   avant, ou s'il n'y a pas de `fin_le`. Sans cette seconde borne, une saison 1
   sans date continuerait de remplir son carnet et ses divisions sous la
   saison 2.

   Pourquoi du SQL et pas une date calculée ici : le jour de jeu est celui de
   la base (`CURDATE()`, son fuseau). `fin_le` est un jour ; la fin de ce jour
   est minuit **à l'heure de la base**, et seule la base sait où tombent ses
   changements d'heure. Une date fabriquée en JavaScript et passée au pool
   (en `timezone: 'Z'`) se décalerait d'une à deux heures. */

/* La fin d'une fenêtre qui n'en a pas : la plus grande valeur d'un DATETIME.
   Une borne nulle ferait de toute comparaison un NULL, donc un faux, et une
   saison sans fin ne compterait plus rien. */
const JAMAIS = "TIMESTAMP('9999-12-31 23:59:59')";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const COLONNE = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;

function alias(a) {
  /* Ces fragments se collent dans une requête : un alias qui ne serait pas un
     identifiant simple serait du SQL injecté. Il vient du code, jamais d'une
     requête, et on le vérifie quand même. */
  if (!IDENT.test(String(a))) throw new Error(`finDeFenetre : alias SQL invalide « ${a} »`);
  return a;
}

/**
 * La fin (exclue) de la fenêtre de la saison portée par la ligne `a` de
 * `saisons`, en **expression SQL** : un DATETIME qui se compare à `NOW(3)` et
 * aux colonnes écrites par `NOW(3)`.
 *
 *     SELECT … FROM saisons s WHERE s.id = ?
 *       AND x.quand >= s.lancee_a AND x.quand < ${finDeFenetre('s')}
 *
 * Une saison sans fin ni suivante rend `9999-12-31 23:59:59`. La saison est
 * close quand `NOW(3) >= ${finDeFenetre('s')}`.
 *
 * Demande les colonnes de `sql/quotidien.sql` (`fin_le`) : sans elles, la
 * requête lève `ER_BAD_FIELD_ERROR`, et c'est à l'appelant de retomber sur son
 * comportement d'avant.
 */
export function finDeFenetre(a = 's') {
  const s = alias(a);
  return `LEAST(COALESCE(TIMESTAMP(${s}.fin_le + INTERVAL 1 DAY), ${JAMAIS}), `
    + `COALESCE((SELECT MIN(fenetre_suivante.lancee_a) FROM saisons fenetre_suivante `
    + `WHERE fenetre_suivante.lancee_a > ${s}.lancee_a), ${JAMAIS}))`;
}

/** Le début de la fenêtre : le lancement de la saison. */
export function debutDeFenetre(a = 's') {
  return `${alias(a)}.lancee_a`;
}

/**
 * La condition « `colonne` tombe dans la fenêtre de la saison `a` », en SQL.
 * `colonne` est un instant écrit par `NOW(3)` (une poussée au Virage, une fin
 * de duel).
 */
export function dansLaFenetre(colonne, a = 's') {
  if (!COLONNE.test(String(colonne))) {
    throw new Error(`dansLaFenetre : colonne SQL invalide « ${colonne} »`);
  }
  return `(${colonne} >= ${debutDeFenetre(a)} AND ${colonne} < ${finDeFenetre(a)})`;
}
