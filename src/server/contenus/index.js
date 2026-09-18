/**
 * Les contenus qui n'étaient pas en base : cartes d'action, équipement, stades.
 *
 * ## Ce que ce module règle
 *
 * Une saison ouvre du contenu. Elle savait ouvrir les **séries** de Fanzzy et
 * publier les **tenues** ; les vingt-neuf cartes d'action, les dix-sept pièces
 * d'équipement et les dix stades vivaient dans `src/shared/`, c'est-à-dire dans
 * le code. `saisons.stuff` et `saisons.actions` existaient et ne servaient qu'à
 * écrire une phrase — on pouvait annoncer « la saison 5 apporte quatre cartes
 * d'action » alors que les quatre étaient jouables depuis la livraison d'avant.
 *
 * ## Le code reste la forme, la base porte l'état
 *
 * C'est le patron du catalogue des Fanzzy, et il est repris tel quel. Le semis
 * **n'écrase jamais** une ligne existante : un nom corrigé depuis
 * l'administration survit à la prochaine livraison. En échange, une carte
 * modifiée dans le code peut ne jamais arriver en base — d'où le constat
 * d'écart, à voix haute, au démarrage.
 *
 * ## Pourquoi des lectures synchrones
 *
 * `ACTIONS`, `STUFF` et `STADES` sont importés dans une quinzaine de fichiers,
 * dont le moteur de duel, qui les lit en pleine partie. Les rendre asynchrones
 * aurait voulu dire toucher à quinze fichiers pour un besoin — savoir si une
 * carte est publiée — qui ne change pas dix fois par seconde.
 *
 * On charge donc **une fois au démarrage**, et on sert de la mémoire. C'est ce
 * que fait déjà `catalogue.js`, et pour la même raison.
 *
 * ## Sans la table, tout est ouvert
 *
 * Une installation où `sql/contenus.sql` n'est pas appliqué joue exactement
 * comme avant : les listes du code, toutes jouables. C'est l'état d'avant, et
 * c'est le bon repli — le contraire fermerait le jeu en silence sur une base
 * incomplète.
 */
import { ACTIONS } from '../../shared/duel/actions.js';
import { STUFF } from '../../shared/fanzzy/inventaire.js';
import { STADES } from '../../shared/stades.js';

/** Les trois familles, et ce que le code en dit. */
export const FAMILLES = {
  action: { source: ACTIONS, nom: 'cartes d’action' },
  stuff: { source: STUFF, nom: 'pièces d’équipement' },
  stade: { source: STADES, nom: 'stades' },
};

/* Ce qui vit en colonnes ; tout le reste part dans `donnees`. */
const COLONNES = new Set(['id', 'nom', 'rar', 'texte', 'publie']);

/** Ce qui n'a pas de colonne à soi : le coût d'une carte, les mods d'un stade. */
const donneesDe = (o) => Object.fromEntries(
  Object.entries(o).filter(([k]) => !COLONNES.has(k)));

/**
 * L'état en mémoire.
 *
 * `null` tant qu'on n'a pas chargé — et non un objet vide : les deux se
 * comportent pareil à la lecture, mais seul `null` permet de dire « la base n'a
 * rien dit » plutôt que « la base a dit rien ».
 */
let memoire = null;

export function createContenus({ pool } = {}) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /**
   * Semer ce que le code connaît, sans écraser ce que la base porte.
   *
   * `publie` vient de la fiche quand elle le dit, et vaut 1 sinon. **Tout ce qui
   * est déjà dans le jeu y reste** : une migration qui fermerait le catalogue en
   * attendant qu'une saison le rouvre retirerait du jour au lendemain des cartes
   * que les joueurs jouent. Les contenus neufs, eux, naîtront fermés — en
   * écrivant `publie: false` sur leur fiche.
   */
  async function semer() {
    let pose = 0;
    for (const [famille, { source }] of Object.entries(FAMILLES)) {
      for (const o of source) {
        const [r] = await pool.execute(
          `INSERT IGNORE INTO contenus (famille, id, nom, rar, texte, donnees, publie)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [famille, o.id, o.nom, o.rar ?? null, o.texte ?? null,
            JSON.stringify(donneesDe(o)), o.publie === false ? 0 : 1]);
        if (r.affectedRows) pose += 1;
      }
    }
    return pose;
  }

  /**
   * Le constat d'écart, à voix haute.
   *
   * `semer` n'écrase jamais, et c'est voulu. Mais ça veut dire qu'une carte
   * modifiée dans le code peut ne jamais arriver en base, et qu'une ligne que le
   * code ne connaît plus peut rester jouable. **Aucun des deux ne lève.**
   *
   * Sans cette phrase, ça se verrait des semaines plus tard, à un effet de
   * carte qui ne correspond pas à ce que le texte annonce. Le catalogue des
   * Fanzzy a payé exactement cette faute.
   */
  function ecarts(rangs) {
    const dits = [];
    for (const [famille, { source, nom }] of Object.entries(FAMILLES)) {
      const enBase = new Map(rangs.filter((r) => r.famille === famille).map((r) => [r.id, r]));
      const enCode = new Map(source.map((o) => [o.id, o]));
      const absents = [...enCode.keys()].filter((id) => !enBase.has(id));
      const orphelins = [...enBase.keys()].filter((id) => !enCode.has(id));
      const changes = [...enCode.entries()]
        .filter(([id, o]) => enBase.has(id) && enBase.get(id).nom !== o.nom)
        .map(([id]) => id);
      if (absents.length || orphelins.length || changes.length) {
        dits.push(`[contenus] ${nom} : ${absents.length} absent(s) de la base`
          + `, ${orphelins.length} que le code ne connaît plus`
          + `, ${changes.length} dont le nom diffère`);
      }
    }
    return dits;
  }

  /**
   * Charger. Appelé une fois, au démarrage.
   *
   * Sans la table, on garde les listes du code et on le dit — le jeu tourne
   * exactement comme avant, et c'est le bon repli.
   */
  async function charger() {
    try {
      await semer();
      const rangs = await q('SELECT famille, id, nom, rar, texte, donnees, publie FROM contenus');
      for (const d of ecarts(rangs)) console.warn(d);
      memoire = {};
      for (const famille of Object.keys(FAMILLES)) memoire[famille] = [];
      for (const r of rangs) {
        if (!memoire[r.famille]) continue;
        const donnees = typeof r.donnees === 'string' ? JSON.parse(r.donnees) : (r.donnees ?? {});
        memoire[r.famille].push({
          id: r.id, nom: r.nom, rar: r.rar ?? undefined, texte: r.texte ?? undefined,
          ...donnees, publie: r.publie === 1,
        });
      }
      /* L'ordre du code, et non celui de la base. Les écrans les affichent dans
         cet ordre depuis le premier jour, et un `SELECT` sans `ORDER BY` rend ce
         que le moteur veut — ce qui ferait bouger le classeur sans raison. */
      for (const [famille, { source }] of Object.entries(FAMILLES)) {
        const rang = new Map(source.map((o, i) => [o.id, i]));
        memoire[famille].sort((a, b) => (rang.get(a.id) ?? 1e9) - (rang.get(b.id) ?? 1e9));
      }
      return { charge: true, total: rangs.length };
    } catch (e) {
      if (e?.code !== 'ER_NO_SUCH_TABLE') throw e;
      console.warn('[contenus] table absente : les cartes d’action, l’équipement et les '
        + 'stades restent ceux du code, tous jouables (applique sql/contenus.sql)');
      memoire = null;
      return { charge: false, total: 0 };
    }
  }

  /**
   * Publier ou fermer, par famille.
   *
   * C'est ce qu'une saison appelle à son lancement. `publie` est un booléen et
   * non un verbe : fermer se fait par le même chemin, ce qui évite d'avoir deux
   * fonctions dont l'une serait la négation mal tenue de l'autre.
   */
  async function publier(famille, ids, publie = true) {
    const liste = (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(String);
    if (!liste.length) return 0;
    const [r] = await pool.query(
      'UPDATE contenus SET publie = ? WHERE famille = ? AND id IN (?)',
      [publie ? 1 : 0, famille, liste]);
    /* La mémoire suit, sans attendre un redémarrage : une saison lancée doit
       changer le jeu pour les joueurs déjà connectés, et c'est tout l'intérêt
       d'un lancement. */
    if (memoire?.[famille]) {
      for (const o of memoire[famille]) if (liste.includes(o.id)) o.publie = publie;
    }
    return r.affectedRows ?? 0;
  }

  return { charger, semer, publier };
}

/* ------------------------------------------------------------- la lecture

   Hors de la fabrique, parce que quinze fichiers les lisent sans avoir de
   raison de connaître le pool. C'est ce que fait déjà `catalogue.js`. */

/** Tout ce que le jeu connaît d'une famille, publié ou non. */
export function tous(famille) {
  return memoire?.[famille] ?? FAMILLES[famille]?.source ?? [];
}

/**
 * Ce qui est **jouable**.
 *
 * Sans mémoire — table absente, module non chargé — on rend la liste du code
 * en entier. C'est l'état d'avant, et il vaut mieux qu'un jeu qui se ferme
 * parce qu'un fichier SQL n'a pas été appliqué.
 */
export function publies(famille) {
  if (!memoire?.[famille]) return FAMILLES[famille]?.source ?? [];
  return memoire[famille].filter((o) => o.publie);
}

/** Uniquement pour les suites : repartir sans mémoire. */
export function oublier() { memoire = null; }
