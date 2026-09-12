/**
 * Les réglages, côté serveur : la base, et rien d'autre.
 *
 * Le registre — ce qui existe, ce que ça accepte, ce que ça vaut par défaut —
 * vit dans `src/shared/reglages.js`, avec les valeurs vivantes que les
 * constantes du jeu interrogent. Ce module-ci ne fait que le pont vers la
 * table : lire, écrire, et **repousser** le résultat dans le porteur partagé.
 *
 * ## Pourquoi un cache et non une lecture par appel
 *
 * Ces valeurs sont lues dans des boucles chaudes — la corde du Virage diffuse
 * dix fois par seconde, pour chaque tribune ouverte. Une requête par lecture
 * ferait de `reglages` la table la plus sollicitée de la base, pour des valeurs
 * qui changent trois fois par an.
 *
 * ## Pourquoi le rechargement après écriture n'est pas négociable
 *
 * Sans lui, la base et le jeu divergent en silence : l'écran d'administration
 * affiche fièrement la valeur qu'on vient d'écrire, et le serveur continue
 * d'utiliser l'ancienne. C'est la même discipline que le catalogue des Fanzzy,
 * et elle a été apprise au même endroit.
 */
import {
  DEFAUTS, ReglageInvalide, poserReglages, reglagesVivants, toutes, valider,
} from '../../shared/reglages.js';

let charge = false;

/**
 * Lit une valeur telle que la base la rend.
 *
 * Le pilote analyse lui-même les colonnes JSON : un nombre revient en nombre,
 * un texte revient **déjà analysé**, c'est-à-dire en chaîne. Le type seul ne
 * permet donc pas de distinguer « du JSON qui reste à analyser » d'« une chaîne
 * qu'on vient de m'analyser » — et analyser une seconde fois casse tout réglage
 * textuel. C'est ce qui est arrivé au premier d'entre eux : les réglages
 * chiffrés passaient, `annonce.texte` faisait tomber le chargement.
 *
 * On tente donc l'analyse, et l'on garde la valeur telle quelle si elle n'en
 * est pas. Ce filet-là n'est pas décoratif : un réglage textuel l'emprunte à
 * chaque lecture, et la suite le prouve en faisant l'aller-retour.
 */
function lireValeur(v) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}

/** Vrai une fois la base lue. Sert aux contrôles, pas au jeu. */
export function reglagesCharges() {
  return charge;
}

/** Toutes les valeurs effectives, pour l'écran d'administration et les pages. */
export function tousLesReglages() {
  return reglagesVivants();
}

/**
 * Ce que les réglages disent aux joueurs.
 *
 * **Filtré à la main**, et c'est délibéré : on n'expose jamais l'ensemble. Les
 * seuils de la corde, les coûts en souffle, la seconde où l'on sort de la foule
 * sont de l'équilibrage — les publier revient à publier le mode d'emploi de ce
 * qu'il faut exploiter. Une liste noire laisserait passer le prochain réglage
 * ajouté ; une liste blanche oblige à décider, réglage par réglage.
 *
 * La fonction vit ici et non dans la route, pour que la route et la suite
 * éprouvent le même code. Une suite qui recopie la logique qu'elle contrôle ne
 * contrôle qu'elle-même.
 */
export function reglagesPublics() {
  const r = reglagesVivants();
  return {
    annonce: r['annonce.actif'] && r['annonce.texte']
      ? { texte: r['annonce.texte'], ton: r['annonce.ton'] }
      : null,
    maintenance: r['maintenance.actif'] ? { texte: r['maintenance.texte'] } : null,
  };
}

/**
 * Relit la table et remplace les valeurs vivantes.
 *
 * Les valeurs illisibles ou hors bornes retombent sur le défaut — `toutes` s'en
 * charge. On ne refuse pas de démarrer parce qu'une main est passée dans la
 * base : un garde-fou qui fabrique la panne qu'il devait éviter n'en est pas un.
 */
export async function chargerReglages(pool) {
  let lignes = [];
  try {
    const [r] = await pool.query('SELECT cle, valeur FROM reglages');
    lignes = r;
  } catch (e) {
    /* `reglages` vient de sql/admin.sql, que rien n'oblige à appliquer sur une
       base de développement. Sans ce filet, tout le jeu tombe parce qu'un
       fichier de schéma facultatif manque. */
    if (e?.code !== 'ER_NO_SUCH_TABLE') throw e;
    console.warn('table reglages absente : le jeu tourne sur les valeurs du registre '
      + '(appliquer sql/admin.sql pour pouvoir les modifier)');
    charge = true;
    return poserReglages(DEFAUTS);
  }

  const stockes = {};
  for (const l of lignes) stockes[l.cle] = lireValeur(l.valeur);

  charge = true;
  return poserReglages(toutes(stockes));
}

/**
 * Écrit un réglage, après validation contre le registre.
 *
 * La validation est **ici** et non dans l'écran : un écran peut être contourné,
 * une route ne peut pas l'être. `valider` lève une erreur qui nomme la clé et
 * ce qu'on attendait ; on la laisse remonter telle quelle.
 */
export async function ecrireReglage(pool, cle, brut, acteur) {
  const valeur = valider(cle, brut);
  await pool.query(
    `INSERT INTO reglages (cle, valeur, maj_par) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE valeur = VALUES(valeur), maj_par = VALUES(maj_par)`,
    [cle, JSON.stringify(valeur), acteur ?? null]);
  await chargerReglages(pool);
  return valeur;
}

/**
 * Rend un réglage à sa valeur par défaut.
 *
 * En **supprimant la ligne**, et non en écrivant le défaut. Les deux donnent le
 * même comportement aujourd'hui ; ils diffèrent le jour où le défaut change
 * dans le registre. Une ligne écrite fige l'ancienne valeur, et il faudrait se
 * souvenir d'aller la retirer ; une ligne absente suit le registre.
 */
export async function rendreAuDefaut(pool, cle, acteur) {
  if (!(cle in DEFAUTS)) throw new ReglageInvalide(cle, 'cette clé n’est pas au registre');
  await pool.query('DELETE FROM reglages WHERE cle = ?', [cle]);
  await chargerReglages(pool);
  return DEFAUTS[cle];
}

/** Remet les valeurs aux défauts. Pour les suites, qui montent plusieurs serveurs. */
export function oublierReglages() {
  charge = false;
  return poserReglages(DEFAUTS);
}
