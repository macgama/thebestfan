/**
 * L'écart entre le catalogue écrit dans le code et celui qui est en base.
 *
 * ## Pourquoi cette comparaison doit se faire toute seule
 *
 * Le catalogue vit en base parce qu'il s'édite depuis l'administration, et il
 * s'amorce depuis `dex.js` en `INSERT IGNORE` — on ajoute ce qui manque, on
 * n'écrase jamais ce qui existe, sans quoi chaque redémarrage effacerait les
 * corrections faites à l'écran.
 *
 * La contrepartie est rarement énoncée, et elle est coûteuse : **changer une
 * carte déjà en base dans le code ne change rien.** La ligne est là, `IGNORE`
 * l'ignore, et le jeu continue d'afficher l'ancienne version. Sans erreur,
 * sans trace. Quatre migrations du dossier `sql/` n'existent que pour
 * rattraper ça à la main — `identites.sql`, `raretes.sql`, `series-neuves.sql`,
 * `prefixes.sql` — et deux scripts sont nés du même trou.
 *
 * `scripts/fanzzy-ecarts.mjs` savait déjà dire ce qui diffère. Son défaut
 * n'était pas ce qu'il calcule, c'est qu'il faut **y penser** : un garde-fou
 * qu'on lance à la main est un garde-fou qu'on lance après avoir vu le
 * symptôme. Ce module sort le calcul du script pour que le démarrage le fasse
 * à chaque fois, et il ne touche ni à la base ni à la console : il prend deux
 * listes, il rend un constat. C'est ce qui le rend éprouvable sans base.
 *
 * ## Quatre écarts, et ils n'ont pas la même gravité
 *
 * Trois sont des **fautes** — aucune raison légitime de les voir un jour :
 *
 *   — `manquantes` : une carte du code absente de la base. L'amorçage n'a pas
 *     tourné depuis son ajout, ou il a échoué en silence.
 *   — `orphelines` : une ligne en base que le code ne connaît pas. C'est le
 *     reste d'un renommage non appliqué : elle compte dans la progression,
 *     occupe une case de classeur, et n'a plus de dessin puisque le fichier est
 *     parti avec le nouvel identifiant.
 *   — `doublons` : deux cartes publiées sous le même nom. C'est le même
 *     personnage vu deux fois par le joueur, une fois dessiné, une fois en
 *     silhouette.
 *
 * Le quatrième ne l'est pas : `retouchees` — une carte présente des deux
 * côtés dont un champ diffère. Ça peut être une correction faite à l'écran,
 * qui est **la raison d'être** de cette table, comme un texte changé dans le
 * code qui n'est jamais arrivé. On ne peut pas trancher d'ici, donc on ne
 * crie pas : on compte. Une alarme qui se déclenche sur du travail normal
 * cesse d'être lue au troisième démarrage, et c'est ainsi qu'on perd aussi les
 * trois autres.
 */

/** Les champs qu'on compare, et qui existent des deux côtés. */
const CHAMPS = ['nom', 'set', 'stage', 'rar', 'evo', 'publie', 'histoire', 'mods', 'cri'];

/**
 * Une écriture stable d'une valeur, pour la comparer.
 *
 * Les clés d'un objet JSON ne reviennent pas de MySQL dans l'ordre où on les a
 * écrites — le moteur range les siennes à sa façon. Comparer deux
 * `JSON.stringify` bruts annoncerait donc **tout le catalogue comme retouché**
 * au premier démarrage, ce qui est la seule façon sûre de rendre ce constat
 * inutile. On trie les clés avant d'écrire.
 */
function stable(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/**
 * Deux valeurs disent-elles la même chose ?
 *
 * `null` et `undefined` sont le même vide : le code écrit `histoire` absente,
 * la base écrit `NULL`, et les annoncer comme un écart ferait crier le
 * démarrage sur trois cents cartes qui vont très bien.
 */
const pareil = (a, b) => stable(a ?? null) === stable(b ?? null);

/** Un âge est une racine s'il n'est la suite de personne — la règle du serveur. */
const racines = (liste) => {
  const suivi = new Set(liste.map((f) => f.evo).filter(Boolean));
  return liste.filter((f) => !suivi.has(f.id));
};

/**
 * Une ligne SQL vers la forme du jeu, pour les appelants qui lisent la base
 * directement. `catalogue.js` a déjà la sienne — c'est `versJeu` — et lui passe
 * donc sa liste telle quelle.
 */
export const depuisLigne = (r) => ({
  id: r.id,
  nom: r.nom,
  set: r.set_id,
  stage: Number(r.stage),
  rar: r.rar,
  evo: r.evo ?? null,
  histoire: r.histoire ?? null,
  mods: typeof r.mods === 'string' ? JSON.parse(r.mods) : r.mods,
  cri: typeof r.cri === 'string' ? JSON.parse(r.cri) : r.cri,
  publie: Boolean(r.publie),
});

/**
 * Compare le catalogue du code à celui de la base.
 *
 * Pure : deux listes entrent, un constat sort. Ni base, ni console, ni horloge
 * — c'est ce qui permet de l'éprouver sur des cas fabriqués, et c'est ce qui
 * manquait au script pour pouvoir être branché au démarrage.
 *
 * @param {object}  e
 * @param {Array}   e.code      le catalogue de `dex.js`, forme du jeu
 * @param {Array}   e.base      le catalogue en base, même forme
 * @param {Set|null} [e.ouvertes] les séries ouvertes, `null` si aucune restriction
 */
export function comparer({ code = [], base = [], ouvertes = null } = {}) {
  const parIdCode = new Map(code.map((f) => [f.id, f]));
  const parIdBase = new Map(base.map((f) => [f.id, f]));
  const publiee = (f) => f.publie !== false;

  const manquantes = code.filter((f) => !parIdBase.has(f.id)).map((f) => f.id);

  const orphelines = base.filter((f) => !parIdCode.has(f.id))
    .map((f) => ({ id: f.id, nom: f.nom, set: f.set, publie: publiee(f) }));

  /* Deux lignes publiées sous le même nom : presque toujours une carte
     renommée dont l'ancienne ligne est restée. On ne regarde que les publiées —
     une carte dépubliée qui garde le nom de celle qui l'a remplacée est
     exactement ce qu'on veut, et la signaler reviendrait à crier sur la
     manœuvre correcte. */
  const parNom = new Map();
  for (const f of base.filter(publiee)) {
    const clef = String(f.nom ?? '').trim().toLowerCase();
    if (!clef) continue;
    if (!parNom.has(clef)) parNom.set(clef, []);
    parNom.get(clef).push(f.id);
  }
  const doublons = [...parNom.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([, ids]) => ({ nom: parIdBase.get(ids[0]).nom, ids }));

  const retouchees = [];
  for (const f of code) {
    const b = parIdBase.get(f.id);
    if (!b) continue;
    const champs = CHAMPS.filter((c) => {
      // `publie` est absent du code quand la carte est publiée : c'est le
      // défaut, et `amorcer` l'écrit déjà comme tel.
      if (c === 'publie') return publiee(f) !== publiee(b);
      return !pareil(f[c], b[c]);
    });
    if (champs.length) retouchees.push({ id: f.id, nom: b.nom, champs });
  }

  const visible = (f) => publiee(f) && (!ouvertes || ouvertes.has(f.set));
  const compteurs = {
    base: base.length,
    code: code.length,
    personnages: racines(base.filter(publiee)).length,
    aCollectionner: racines(base.filter(publiee)).filter(visible).length,
    attendu: racines(code.filter(publiee)).filter(visible).length,
  };

  return {
    manquantes,
    orphelines,
    doublons,
    retouchees,
    compteurs,
    /** Au moins un écart qu'aucune manœuvre normale ne produit. */
    faute: manquantes.length > 0
      || orphelines.some((o) => o.publie)
      || doublons.length > 0,
  };
}

/**
 * Le constat en quelques lignes, pour un journal de démarrage.
 *
 * Rend un tableau vide quand tout va bien : **le silence est le cas normal**,
 * et une ligne « catalogue conforme » à chaque démarrage se confondrait avec
 * les quarante autres, jusqu'à ce que celle qui compte passe inaperçue.
 *
 * Chaque ligne dit ce qui ne va pas *et* ce qu'on en fait. Un message qui
 * nomme le symptôme sans nommer la manœuvre coûte toujours plus cher qu'il
 * n'économise — c'est écrit dans la méthode du projet, et cette ligne-ci a été
 * payée quatre fois.
 */
export function resumer(rapport) {
  const l = [];
  const { manquantes, orphelines, doublons, retouchees, compteurs } = rapport;

  if (manquantes.length) {
    l.push(`catalogue : ${manquantes.length} carte(s) du code absente(s) de la base`
      + ` — ${manquantes.slice(0, 8).join(' ')}${manquantes.length > 8 ? ' …' : ''}`
      + ' — l’amorçage n’a pas tourné depuis leur ajout.');
  }

  const pub = orphelines.filter((o) => o.publie);
  if (pub.length) {
    l.push(`catalogue : ${pub.length} ligne(s) publiée(s) en base que le code ne connaît pas`
      + ` — ${pub.slice(0, 8).map((o) => o.id).join(' ')}${pub.length > 8 ? ' …' : ''}`
      + ' — elles sont tirables, comptent dans la progression et n’ont pas de dessin.'
      + ' Reste d’un renommage : voir sql/prefixes.sql.');
  }

  if (doublons.length) {
    l.push(`catalogue : ${doublons.length} nom(s) porté(s) par plusieurs cartes publiées`
      + ` — ${doublons.slice(0, 4).map((d) => `« ${d.nom} » ${d.ids.join('+')}`).join(', ')}`
      + ' — le joueur voit le même personnage deux fois.');
  }

  if (compteurs.aCollectionner !== compteurs.attendu) {
    l.push(`catalogue : « à collectionner » vaut ${compteurs.aCollectionner},`
      + ` le code en prévoit ${compteurs.attendu}.`);
  }

  /* Le cas ambigu, et il se dit d'une ligne sans point d'exclamation : une
     retouche peut être le travail normal de l'administration. On donne le
     nombre et la commande qui montre le détail, pas la liste. */
  if (retouchees.length) {
    l.push(`catalogue : ${retouchees.length} carte(s) dont un champ diffère du code`
      + ' — correction faite à l’écran, ou texte changé dans le code et jamais'
      + ' arrivé. `npm run ecarts` dit lesquelles.');
  }

  return l;
}
