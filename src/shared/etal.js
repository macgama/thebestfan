/**
 * L'étal : ce que les écharpes achètent, en dehors des boosters.
 *
 * ## La monnaie a changé, la règle non
 *
 * Il se payait en **billets**, la monnaie que l'argent réel achetait. Les
 * billets n'existent plus : l'argent réel n'achète plus que l'abonnement, et
 * les écharpes ne se gagnent qu'en jouant.
 *
 * Ce que ça change à la chaîne euro → tirage : elle est coupée **à la
 * racine**, et non plus par une séparation qu'il fallait tenir. Il n'y a plus
 * de monnaie achetable du tout, donc plus rien à séparer.
 *
 * Ce que ça ne change pas : rien ici n'est tiré au sort, et c'était déjà la
 * règle. Voir plus bas.
 *
 * ## Rien n'y est tiré au sort
 *
 * C'est la différence avec tout ce que la boutique vendait avant. On n'achète
 * pas « une pièce d'équipement », on achète **le mégaphone**. On n'achète pas
 * « une tenue », on achète **cette tenue-là, pour ce Fanzzy-là, à cet âge-là**.
 * Le joueur voit ce qu'il prend avant de le prendre, et le prix ne dépend
 * d'aucun tirage.
 *
 * C'est ce qui permet à l'argent réel d'exister dans ce jeu sans que la
 * question des coffres payants se pose : la chaîne euro → billet → objet nommé
 * ne passe jamais par le hasard.
 *
 * ## L'étal n'est pas une liste écrite à la main
 *
 * Il se **déduit** des catalogues qui existent déjà — `STUFF` pour
 * l'équipement, la table des tenues pour les costumes. Une liste recopiée ici
 * divergerait au premier objet ajouté depuis l'administration : l'étal
 * proposerait une pièce qui n'existe plus, ou tairait celle qu'on vient de
 * créer. C'est le même raisonnement que pour les séries de Fanzzy, et il a
 * déjà coûté une fois.
 *
 * ## Le prix vient du registre
 *
 * Par rareté, et réglable depuis l'administration — à la différence des prix
 * en euros, qui n'ont rien à faire dans un écran. Le prix d'un objet en
 * monnaie de jeu est de l'équilibrage : il se retouche en regardant ce que les
 * joueurs prennent, et attendre un déploiement pour ça revient à ne jamais le
 * faire.
 */
import { reglage } from './reglages.js';
import { STUFF, STUFF_BY_ID } from './fanzzy/inventaire.js';

/** Les raretés que l'étal sait tarifer, de la plus commune à la plus rare. */
export const RARETES = ['commune', 'rare', 'epique', 'legendaire'];

/**
 * Le prix d'une pièce d'équipement, **en écharpes**.
 *
 * `null` pour une rareté inconnue, et non un prix par défaut : un objet dont la
 * rareté est mal écrite doit **disparaître de l'étal**, pas s'y afficher à un
 * prix inventé. Un prix inventé se vend, et il ne se rattrape plus.
 */
export function prixStuff(rarete) {
  if (!RARETES.includes(rarete)) return null;
  return reglage(`etal.stuff_${rarete}`) ?? null;
}

/** Le prix d'une tenue, **en écharpes**. Identique quelle que soit la rareté :
    une tenue ne change rien au jeu, elle change ce qu'on regarde. */
export function prixTenue() {
  return reglage('etal.tenue') ?? null;
}

/**
 * L'équipement en vente.
 *
 * `possede` est l'ensemble des identifiants que le joueur a déjà. Une pièce
 * possédée reste **listée** mais marquée : la retirer ferait un étal qui
 * rétrécit à mesure qu'on achète, et l'on ne saurait plus si une pièce manque
 * parce qu'on l'a ou parce qu'elle n'existe pas.
 */
export function etalStuff(possede = new Set()) {
  return STUFF
    .map((s) => ({
      type: 'stuff',
      id: s.id,
      nom: s.nom,
      texte: s.texte,
      rar: s.rar,
      prix: prixStuff(s.rar),
      possede: possede.has(s.id),
    }))
    .filter((s) => s.prix !== null);
}

/**
 * Les tenues en vente.
 *
 * Une tenue s'applique à un Fanzzy **et à un âge** : c'est ce couple qui est
 * acheté, pas la tenue seule. L'étal liste donc les tenues, et la page demande
 * sur qui la poser — le serveur revérifie de toute façon.
 *
 * `base` n'est jamais en vente : c'est la tenue que tout le monde a déjà.
 */
export function etalTenues(tenues = []) {
  const p = prixTenue();
  if (p === null) return [];
  return tenues
    .filter((t) => t.id !== 'base' && t.publie !== false && t.publie !== 0)
    .map((t) => ({ type: 'tenue', id: t.id, nom: t.nom, texte: t.texte ?? null,
      rar: t.rar, prix: p }));
}

/**
 * Le prix d'un achat, ou `null` si l'objet n'est pas en vente.
 *
 * C'est **cette fonction** que le serveur interroge au moment de débiter, et
 * non l'étal qu'il vient d'envoyer à la page. Un prix relu depuis la liste
 * affichée serait un prix venu du client, avec une étape de plus pour le
 * cacher.
 */
export function prixDe(type, id, tenues = []) {
  if (type === 'stuff') {
    const s = STUFF_BY_ID.get(id);
    return s ? prixStuff(s.rar) : null;
  }
  if (type === 'tenue') {
    const t = tenues.find((x) => x.id === id);
    if (!t || t.id === 'base' || t.publie === false || t.publie === 0) return null;
    return prixTenue();
  }
  return null;
}
