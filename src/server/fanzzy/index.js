import express from 'express';
// Les cartes viennent de la base ; les barèmes — séries, types, raretés, taux,
// coûts — restent du code, parce qu'ils décrivent les règles du jeu et non son
// contenu. On ne change pas un taux de tirage depuis un écran d'administration.
import { SETS, TYPES, RAR, RATES, SCARVES, EVO_COST } from '../../shared/fanzzy/dex.js';
import { tous, publies, parIdentifiant, obtenables, seriesOuvertes, serieOuverte,
  racineDe, lignee, auStade } from './catalogue.js';
import { STUFF, STUFF_BY_ID, combine } from '../../shared/fanzzy/inventaire.js';
// Les tenues viennent de la base : elles se créent depuis l'administration,
// et une liste figée dans le code redeviendrait une seconde vérité.
import { toutesTenues, tenuesPubliees } from './tenues.js';
import { ACTIONS, DECK_RULES } from '../../shared/duel/actions.js';
import { DEFAUTS, reglage } from '../../shared/reglages.js';
import { XP } from '../../shared/niveau.js';
import { saisonsLancees, saisonEnCours } from './saisons.js';
import { assurerBourse } from '../bourse.js';

/**
 * Collection Fanzzy, tenue par le serveur.
 *
 * Rien de tout ceci ne peut vivre dans le navigateur : le tirage d'un booster,
 * le solde d'écharpes et les évolutions décident de ce qu'un joueur possède, et
 * un joueur possède des choses qui s'achètent. Le client n'affiche que ce que
 * le serveur lui dit.
 */

export const MAX_PACKS = DEFAUTS['pack.max'];
/**
 * Ce qu'un nouveau joueur trouve dans sa réserve.
 *
 * Trois, et non douze. Douze boosters d'un coup, c'est cinq minutes
 * d'ouverture frénétique puis plus rien à faire pendant deux heures — et
 * soixante cartes vues avant d'avoir compris ce qu'est un Fanzzy. Trois
 * laissent le temps de regarder, et la réserve se remplit ensuite d'elle-même
 * jusqu'à douze.
 */
/* Les valeurs **par défaut**, déduites du registre : elles ne sont plus
   écrites deux fois. Ce sont elles qu'importent les scripts d'analyse et les
   suites ; le jeu, lui, lit `reglage(...)` à chaque fois, pour que l'écran
   d'administration ait un effet réel et immédiat. */
export const PACKS_DEPART = DEFAUTS['pack.depart'];
export const PACK_REGEN_MS = DEFAUTS['pack.regen_min'] * 60_000;
export const PACK_PRICE = DEFAUTS['pack.prix_echarpes'];

/** Les mêmes, mais vivantes. Une fonction et non une constante : une constante
    relue au chargement du module ne bougerait plus jamais. */
const maxPacks = () => reglage('pack.max');
/* La réserve de départ vit dans `src/server/bourse.js`, avec la fonction
   qui ouvre une bourse : quatre autres modules en créaient une sans connaître
   ce nombre, et c'est toujours l'un d'eux qui arrivait le premier. */
const regenMs = () => reglage('pack.regen_min') * 60_000;
const prixPack = () => reglage('pack.prix_echarpes');

const rnd = (a) => a[Math.floor(Math.random() * a.length)];

/**
 * Quelle saison a ouvert chaque série.
 *
 * Remplace `NIVEAU_DE_SERIE`, qui disait à quel niveau une série se débloquait :
 * le niveau n'ouvre plus de séries, les saisons le font. Déduit des saisons
 * lancées plutôt que recopié — une table de plus à tenir à jour finirait par
 * diverger de celle qui décide vraiment.
 *
 * Une série ouverte par deux saisons est attribuée à la **plus ancienne** :
 * c'est le jour où elle est arrivée dans le jeu qui intéresse le joueur, pas la
 * dernière fois qu'on l'a renommée dans une liste.
 */
function saisonDeSerie() {
  const par = {};
  for (const s of saisonsLancees()) {
    for (const id of s.series) {
      if (!par[id] || s.numero < par[id].numero) {
        par[id] = { numero: s.numero, nom: s.nom };
      }
    }
  }
  return par;
}

/**
 * `niveau` est facultatif : sans lui le module tourne exactement comme avant,
 * boosters compris. C'est ce qui permet aux suites qui n'éprouvent pas la
 * progression de monter le module seul, et à une installation dont
 * `sql/niveau.sql` n'est pas encore appliqué de continuer à distribuer.
 */
/**
 * @param {object} [opts.decks]  le module de deck, s'il est monté. La fiche s'en
 *   sert pour dire **où** ce personnage se trouve dans la tribune du joueur —
 *   titulaire, remplaçant, ou nulle part — et quelles places sont ouvertes. Sans
 *   lui, la fiche reste lisible et le bouton d'entrée en duel disparaît : mieux
 *   vaut pas de bouton qu'un bouton qui ne peut pas tenir sa promesse.
 */
export function createFanzzy({ pool, requireAuth, niveau = null, decks = null,
  /* L’abonnement ouvre le **rythme** des boosters : une réserve plus haute et
     une recharge plus courte. Rien d’autre — voir `abonnement/index.js`, qui
     porte la règle : on vend de la largeur et du confort, jamais de la
     puissance. Absent, tout le monde est joueur inscrit, ce qui est l'état
     d'avant. */
  abonnement = null }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /* -------------------------------------------------------- portefeuille */

  /**
   * Recharge les boosters au prorata du temps ecoule, puis renvoie l'etat.
   * Le calcul se fait a la lecture plutot qu'avec une tache periodique :
   * pas de minuterie a maintenir, et le resultat est le meme.
   *
   * **Le plafond et la cadence dependent de l'abonnement**, et de rien d'autre.
   * Ce sont les deux seules choses que l'abonnement change ici : la reserve est
   * plus haute et le booster revient plus vite. Le contenu d'un booster, lui,
   * est exactement le meme — sans quoi on vendrait de la collection, donc de la
   * puissance par la bande.
   */
  async function wallet(userId) {
    const abonne = abonnement ? await abonnement.estAbonne(userId) : false;
    const plafond = abonnement ? abonnement.plafondPacks(abonne) : maxPacks();
    const cadence = abonnement ? abonnement.regenMs(abonne) : regenMs();
    await assurerBourse(q, userId);
    const w = (await q(
      `SELECT scarves, billets, packs, packs_at, active_fanzzy, active_evo
         FROM user_wallet WHERE user_id = ?`,
      [userId],
    ))[0];

    if (w.packs < plafond) {
      const gained = Math.floor((Date.now() - new Date(w.packs_at).getTime()) / cadence);
      if (gained > 0) {
        const packs = Math.min(plafond, w.packs + gained);
        const at = new Date(new Date(w.packs_at).getTime() + gained * cadence);
        await q(`UPDATE user_wallet SET packs = ?, packs_at = ? WHERE user_id = ?`,
          [packs, at, userId]);
        w.packs = packs; w.packs_at = at;
      }
    } else {
      await q(`UPDATE user_wallet SET packs_at = NOW(3) WHERE user_id = ?`, [userId]);
      w.packs_at = new Date();
    }

    const nextIn = w.packs >= plafond ? null
      : Math.max(0, cadence - (Date.now() - new Date(w.packs_at).getTime()));
    return { scarves: w.scarves, billets: w.billets, packs: w.packs,
      nextPackInMs: nextIn, active: w.active_fanzzy,
      /* L’âge auquel le montrer. Nul = l’âge atteint, et c’est ce que lit
         l’accueil : la bourse disait déjà qui est à l’écran, elle dit
         maintenant à quel âge — la page n’a pas deux réponses à rapprocher. */
      activeEvo: w.active_evo === null ? null : Number(w.active_evo) };
  }

  async function collection(userId) {
    const rows = await q(`SELECT fanzzy_id, copies FROM user_fanzzy WHERE user_id = ?`, [userId]);
    return Object.fromEntries(rows.map((r) => [r.fanzzy_id, r.copies]));
  }

  /**
   * La dernière saison dont ce joueur a vu l'annonce.
   *
   * La colonne vient de `sql/saisons.sql`, que rien n'oblige à appliquer. Sans
   * elle on rend `null` : l'annonce s'affiche, ce qui est le bon défaut — mieux
   * vaut la montrer une fois de trop que de la perdre en silence.
   */
  async function saisonVue(userId) {
    try {
      const r = await q(`SELECT saison_vue FROM user_wallet WHERE user_id = ?`, [userId]);
      return r[0]?.saison_vue ?? null;
    } catch (e) {
      if (e.code !== 'ER_BAD_FIELD_ERROR') throw e;
      return null;
    }
  }

  /**
   * Jusqu'où chaque personnage a été fait grandir.
   *
   * Volontairement à part de `collection`, qui rend un nombre d'exemplaires par
   * identifiant : y glisser un objet aurait cassé en silence tout ce qui lit
   * cette valeur comme un compteur — le classeur en fait un total, l'accueil en
   * fait une jauge. Deux cartes, deux significations, deux champs.
   *
   * Seuls les stades supérieurs à 1 y figurent : le premier âge est le défaut,
   * et une entrée par personnage possédé n'apprendrait rien.
   */
  async function stades(userId) {
    const rows = await q(
      `SELECT fanzzy_id, stage FROM user_fanzzy WHERE user_id = ? AND stage > 1`, [userId]);
    return Object.fromEntries(rows.map((r) => [r.fanzzy_id, Number(r.stage)]));
  }

  /* -------------------------------------------------------------- tirage */

  function pickRarity(slot) {
    const r = Math.random();
    let acc = 0;
    for (const [rar, p] of RATES[slot]) { acc += p; if (r < acc) return rar; }
    return 'rare';
  }

  /**
   * Cinq cartes d'une série. Les deux premières tirent leur rareté, les trois
   * suivantes sont communes — et de toute façon remplacées par `openPack`.
   *
   * **Le repli descend l'échelle au lieu de sauter directement aux communes.**
   * L'ancienne version tentait la rareté tirée puis, si elle était vide,
   * `pool_('commune')` — et si la série n'avait aucune commune, elle renvoyait
   * `undefined`. Cinq `undefined` dans un booster ne lèvent pas : ils
   * traversent la transaction, se rangent en base, et ressortent trois écrans
   * plus loin en « Cannot read properties of undefined ».
   *
   * C'est arrivé le jour où les sept lignées ont quitté NUITS EUROPÉENNES : la
   * série a perdu d'un coup toutes ses cartes de stade 1, donc toutes ses
   * communes. Le défaut existait avant, il attendait juste qu'une série se
   * retrouve sans commune — ce qu'un seul clic dans l'administration suffit à
   * provoquer.
   */
  function drawPack(setId) {
    // **Un booster ne donne que des cartes de stade 1.**
    //
    // Depuis que la rareté suit le stade, une rare est un stade 2 et une épique
    // un stade 3 : les tirer directement contournerait les 115 écharpes qu'ils
    // coûtent, et l'évolution ne servirait plus à rien. Le booster donne les
    // personnages, les doublons donnent les écharpes, les écharpes font
    // grandir les personnages. C'est la boucle entière du jeu.
    const base = publies().filter((f) => f.set === setId && f.stage === 1);
    const pool_ = (rar) => base.filter((f) => f.rar === rar);
    // Le dernier filet, qui ne doit jamais être vide.
    const toutes = base;
    if (!toutes.length) {
      throw new Error(`La série « ${setId} » n'a aucune carte de stade 1 publiée : `
        + 'impossible d’en tirer un booster. Les évolutions ne se tirent pas, elles '
        + 's’achètent — il faut donc au moins un personnage de stade 1 publié dans '
        + 'cette série, ou la retirer des boosters proposés.');
    }

    const ECHELLE = ['legendaire', 'epique', 'rare', 'commune'];

    /* **Le tirage de rareté va sur les places qui rendent un supporter.**
     *
     * Il allait sur les deux dernières, et `RATES` le dit encore : « les deux
     * dernières places sont les seules qui peuvent tomber sur une légendaire ».
     * Mais `openPack` a fait des trois dernières places des places ouvertes,
     * qui ne rendent plus jamais de supporter : le tirage de rareté roulait
     * donc sur des cartes systématiquement jetées.
     *
     * Résultat : **aucune légendaire ne pouvait sortir d'un booster**, et les
     * quatorze personnages légendaires publiés étaient hors d'atteinte. Les
     * deux règles étaient justes chacune de son côté et fausses ensemble — ce
     * que ni l'une ni l'autre ne pouvait dire seule, puisqu'elles vivent à cent
     * lignes d'écart. C'est `scripts/economie.mjs` qui l'a vu, en mesurant ce
     * qu'un booster rend au lieu de le supposer.
     *
     * Les deux places conservées portent donc les deux tables : la première au
     * taux le plus prudent, la deuxième au plus généreux. */
    const PLACES_QUI_ROULENT = 2;
    return Array.from({ length: 5 }, (_, i) => {
      const vise = i < PLACES_QUI_ROULENT ? pickRarity(i + 4) : 'commune';
      // On redescend depuis le cran visé : une série sans épique donne une rare
      // plutôt qu'une commune, ce qui reste plus proche de ce qu'on promettait.
      const depart = Math.max(0, ECHELLE.indexOf(vise));
      for (const rar of ECHELLE.slice(depart)) {
        const p = pool_(rar);
        if (p.length) return rnd(p);
      }
      return rnd(toutes);
    });
  }

  /**
   * Ce que peut contenir une place ouverte, c'est-à-dire une place qui n'est
   * pas réservée à un supporter.
   *
   * Sept pièces d'équipement et quinze cartes d'action sur vingt et une
   * n'étaient **obtenables nulle part** : le paquet de bienvenue en donnait une
   * de chaque, au hasard, et c'était tout. Un joueur pouvait ouvrir trois cents
   * boosters sans jamais voir un mégaphone.
   *
   * **Il n'y a plus de supporter dans cette table.** Un booster en donnait
   * quatre sur cinq en moyenne — trois garantis, plus une chance sur deux à
   * chacune des deux dernières places — et l'ouverture se ressemblait d'une
   * fois sur l'autre : une pile de têtes, dont la plupart en double. Les places
   * ouvertes donnent maintenant autre chose, toujours.
   *
   * Les écharpes en font partie, et ce n'est pas un lot de consolation : c'est
   * ce qui paie les évolutions, donc les âges qu'on ne tire jamais. C'est aussi
   * le seul lot qui ne peut pas être vide, et il sert donc de dernier recours à
   * un joueur qui possède déjà toutes les tenues, tout l'équipement et toutes
   * les cartes d'action — à qui l'on rendait un supporter de plus.
   *
   * @returns {{carte, scarves}}
   */
  const PLACES_OUVERTES = [
    ['action', 0.30],
    ['stuff', 0.25],
    ['skin', 0.20],
    ['echarpes', 0.25],
  ];

  /* Trois poignées, de la plus probable à la plus rare. Un booster coûte
     quarante-cinq écharpes ; trois places ouvertes en rendent donc rarement le
     prix, et c'est voulu — on achète des cartes, pas de la monnaie. */
  const POIGNEES = [[6, 0.55], [14, 0.33], [30, 0.12]];

  function tirerCategorie() {
    const r = Math.random();
    let acc = 0;
    for (const [cat, p] of PLACES_OUVERTES) { acc += p; if (r < acc) return cat; }
    return 'echarpes';
  }

  function tirerPoignee() {
    const r = Math.random();
    let acc = 0;
    for (const [n, p] of POIGNEES) { acc += p; if (r < acc) return n; }
    return POIGNEES[0][0];
  }

  async function tirerAutreChose(ctx) {
    const { conn, userId, avant, stadeDe, skinsPris, stuffPris, actionsPrises } = ctx;
    const cat = tirerCategorie();

    /* Les écharpes. Le seul lot qui ne peut pas être vide, et donc le recours
       de toutes les autres catégories : voir les `return echarpes()` plus bas,
       qui remplacent les anciens `return null` — lesquels rendaient la main au
       supporter tiré, c'est-à-dire à la carte qu'on cherche justement à ne plus
       donner cinq fois. */
    const echarpes = () => {
      const n = tirerPoignee();
      return { carte: { type: 'echarpes', id: 'echarpes', montant: n, new: false },
               scarves: n };
    };
    if (cat === 'echarpes') return echarpes();

    /* Chaque catégorie peut être vide — tout l'équipement déjà possédé, aucun
       Fanzzy à habiller. On retombe alors sur le supporter plutôt que de rendre
       une place blanche : une carte vide dans un booster est pire qu'une carte
       banale. */

    if (cat === 'skin') {
      // Un skin habille **un âge précis**. On ne propose donc que les âges que
      // le joueur a débloqués : lui donner la tenue d'hiver d'un Capo qu'il
      // n'a pas encore serait un cadeau qu'il ne peut pas ouvrir.
      const places = [];
      for (const id of avant) {
        const stade = stadeDe.get(id) ?? 1;
        for (let s = 1; s <= stade; s++) {
          for (const sk of tenuesPubliees()) {
            if (sk.id === 'base') continue;
            if (!skinsPris.has(`${id}:${s}:${sk.id}`)) places.push({ id, stade: s, skin: sk.id });
          }
        }
      }
      if (!places.length) return echarpes();
      const p = rnd(places);
      skinsPris.add(`${p.id}:${p.stade}:${p.skin}`);
      await conn.query(
        `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id) VALUES (?, ?, ?, ?)`,
        [userId, p.id, p.stade, p.skin]);
      return { carte: { type: 'skin', id: p.skin, pour: p.id, stade: p.stade, new: true },
        scarves: 0 };
    }

    if (cat === 'stuff') {
      const def = STUFF.find((s) => s.rar === pickRarity(5) && !stuffPris.has(s.id))
        ?? STUFF.find((s) => !stuffPris.has(s.id));
      // Tout possédé : un doublon d'équipement rapporte des écharpes, comme un
      // doublon de supporter. Il ne se perd pas.
      if (!def) {
        const dedans = rnd(STUFF);
        await conn.query(
          `UPDATE user_stuff SET copies = copies + 1 WHERE user_id = ? AND stuff_id = ?`,
          [userId, dedans.id]);
        return { carte: { type: 'stuff', id: dedans.id, new: false },
          scarves: SCARVES[dedans.rar] ?? 1 };
      }
      stuffPris.add(def.id);
      await conn.query(
        `INSERT INTO user_stuff (user_id, stuff_id, copies) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE copies = copies + 1`, [userId, def.id]);
      return { carte: { type: 'stuff', id: def.id, new: true }, scarves: 0 };
    }

    /* La dernière branche est **nommée**, et ce qui reste tombe en écharpes.
       Elle ne l'était pas : toute catégorie sans branche à elle finissait ici,
       en carte d'action, sans que rien ne le dise. Ajouter une ligne à
       `PLACES_OUVERTES` sans écrire la branche qui va avec donnait donc
       silencieusement autre chose que ce qu'on avait déclaré — et un contrôle
       qui remet « fanzzy » dans la table restait vert, puisque le supporter
       promis sortait en carte d'action. */
    if (cat !== 'action') return echarpes();

    // Une carte d'action ne se possède qu'une fois : le deck en accepte dix
    // exemplaires, mais c'est le même droit répété. Un doublon rapporte donc
    // des écharpes plutôt qu'une ligne de plus.
    const libres = ACTIONS.filter((a) => a.rar !== 'commune' && !actionsPrises.has(a.id));
    if (!libres.length) return echarpes();
    const vise = pickRarity(5);
    const def = rnd(libres.filter((a) => a.rar === vise).length
      ? libres.filter((a) => a.rar === vise) : libres);
    actionsPrises.add(def.id);
    await conn.query(
      `UPDATE user_wallet SET action_cards = JSON_ARRAY_APPEND(
         COALESCE(action_cards, JSON_ARRAY()), '$', ?) WHERE user_id = ?`,
      [def.id, userId]);
    return { carte: { type: 'action', id: def.id, new: true }, scarves: 0 };
  }

  /**
   * Ouvre un booster. Toute l'opération est transactionnelle : sans cela, deux
   * requêtes lancées en même temps consommeraient un seul booster pour deux
   * tirages.
   */
  async function openPack(userId, setId, { buy = false } = {}) {
    if (!SETS.some((s) => s.id === setId)) throw fail('fanzzy.error.unknown_set');
    // Une série fermée ne distribue plus. Le kiosque ne la propose pas, mais un
    // client modifié — ou un onglet resté ouvert depuis avant la fermeture —
    // peut encore demander son booster : le refus se décide ici.
    if (!serieOuverte(setId)) throw fail('fanzzy.error.set_closed');

    /* **Il n'y a plus de second verrou.** Le niveau du joueur en posait un :
       une série pouvait être ouverte pour tout le monde et hors de portée pour
       celui-là. Deux règles pour une question, et le joueur devait comprendre
       laquelle le refusait.

       Les séries s'ouvrent maintenant par saison, pour tout le monde le même
       jour. `fanzzy.error.set_locked` n'est plus émis nulle part ; le message
       reste traduit côté client le temps qu'un onglet resté ouvert depuis avant
       le déploiement finisse sa session. */

    await wallet(userId);   // recharge avant de débiter

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[w]] = await conn.query(
        `SELECT scarves, packs FROM user_wallet WHERE user_id = ? FOR UPDATE`, [userId]);

      if (w.packs > 0) {
        await conn.query(
          `UPDATE user_wallet SET packs = packs - 1,
             packs_at = IF(packs = ?, NOW(3), packs_at) WHERE user_id = ?`,
          [maxPacks(), userId]);
      } else if (buy) {
        const [d] = await conn.query(
          `UPDATE user_wallet SET scarves = scarves - ? WHERE user_id = ? AND scarves >= ?`,
          [prixPack(), userId, prixPack()]);
        if (!d.affectedRows) throw fail('fanzzy.error.not_enough_scarves');
      } else {
        throw fail('fanzzy.error.no_packs');
      }

      const pull = drawPack(setId);

      const [owned] = await conn.query(
        `SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?`, [userId]);
      const had = new Set(owned.map((o) => o.fanzzy_id));
      // Les stades atteints : un skin se gagne **pour un âge**, et on ne peut
      // en gagner un que pour un âge que le joueur a effectivement débloqué.
      const [stadesOwned] = await conn.query(
        `SELECT fanzzy_id, stage FROM user_fanzzy WHERE user_id = ?`, [userId]);
      const stadeDe = new Map(stadesOwned.map((s) => [s.fanzzy_id, Number(s.stage)]));

      const [skinsOwned] = await conn.query(
        `SELECT fanzzy_id, stage, skin_id FROM user_skins WHERE user_id = ?`, [userId]);
      const skinsPris = new Set(
        skinsOwned.map((s) => `${s.fanzzy_id}:${s.stage}:${s.skin_id}`));

      const [stuffOwned] = await conn.query(
        `SELECT stuff_id FROM user_stuff WHERE user_id = ?`, [userId]);
      const stuffPris = new Set(stuffOwned.map((s) => s.stuff_id));

      const [wRow] = await conn.query(
        `SELECT action_cards FROM user_wallet WHERE user_id = ?`, [userId]);
      const brutActions = wRow[0]?.action_cards;
      const actionsPrises = new Set(typeof brutActions === 'string'
        ? JSON.parse(brutActions) : (brutActions ?? []));

      // Photographie de la collection avant ouverture : un skin ne peut pas
      // habiller un supporter reçu dans le même paquet. Le joueur n'a pas
      // encore eu le temps de le regarder.
      const avant = new Set(had);

      let scarves = 0;
      const cards = [];

      for (const [i, f] of pull.entries()) {
        /* Un ou deux supporters par booster, jamais plus.
         *
         * La première place en est un : c'est la garantie, et elle tient toute
         * l'ouverture — personne ne doit tomber sur cinq objets et zéro
         * personnage. La deuxième en est un sept fois sur dix, ce qui fait la
         * différence entre deux boosters ouverts à la suite.
         *
         * Les trois dernières n'en sont jamais. Avant, un booster donnait
         * quatre têtes sur cinq en moyenne, dont la plupart en double : la
         * collection avançait, mais l'équipement, les tenues et les cartes
         * d'action n'arrivaient presque jamais, et deux ouvertures se
         * ressemblaient. */
        const ouverte = i >= 2 || (i === 1 && Math.random() >= 0.7);
        if (ouverte) {
          const autre = await tirerAutreChose({
            conn, userId, avant, stadeDe, skinsPris, stuffPris, actionsPrises });
          if (autre) {
            scarves += autre.scarves ?? 0;
            cards.push(autre.carte);
            continue;
          }
        }

        const isNew = !had.has(f.id);
        if (isNew) had.add(f.id); else scarves += SCARVES[f.rar];
        cards.push({ type: 'fanzzy', id: f.id, new: isNew });
        await conn.query(
          `INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE copies = copies + 1`,
          [userId, f.id]);
        if (!stadeDe.has(f.id)) stadeDe.set(f.id, 1);
        // Le skin de base accompagne toujours le supporter, au premier âge —
        // le seul qu'il ait en sortant d'un booster.
        await conn.query(
          `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id, equipped)
           VALUES (?, ?, 1, 'base', 1)`,
          [userId, f.id]);
        skinsPris.add(`${f.id}:1:base`);
      }
      if (scarves) {
        await conn.query(`UPDATE user_wallet SET scarves = scarves + ? WHERE user_id = ?`,
          [scarves, userId]);
      }

      // Premier Fanzzy obtenu : on l'équipe d'office, sinon le duel démarre nu.
      const premierFanzzy = cards.find((c) => c.type === 'fanzzy')?.id ?? pull[0].id;
      await conn.query(
        `UPDATE user_wallet SET active_fanzzy = COALESCE(active_fanzzy, ?) WHERE user_id = ?`,
        [premierFanzzy, userId]);

      await conn.commit();

      /* L'XP **après** la validation, et hors de la transaction.
         Le booster est ouvert : les cartes sont dans la collection et le
         joueur les a vues. Faire échouer tout ça parce qu'une barre de
         progression n'a pas pu monter serait absurde — `gagner()` avale déjà
         ses propres incidents et rend une progression nulle. */
      const monte = niveau ? await niveau.gagner(userId, XP.pack) : null;

      return { cards, scarvesGained: scarves,
        ...(monte?.xp ? { niveau: monte } : {}) };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /* ----------------------------------------------------------- évolution

     Faire évoluer ne remplace plus une carte par une autre : **le personnage
     grandit**. Sa ligne dans la collection reste la même, son compteur d'âge
     avance d'un cran.

     Deux conséquences voulues.

     Les **doublons ne se consomment plus**. L'ancienne version retirait un
     exemplaire du premier âge pour en poser un du second ; quand le joueur n'en
     avait qu'un, elle supprimait sa ligne et en créait une autre. C'était
     invisible tant que les deux âges étaient deux cartes. Ce ne l'est plus :
     décrémenter jusqu'à zéro reviendrait à lui reprendre le personnage qu'il
     vient de payer. Les écharpes sont le seul coût, et c'est sur elles que
     l'économie est calibrée.

     Et le **stade est plafonné par ce qui est écrit**. Cent cinquante-deux
     personnages n'ont encore qu'un âge : leur évolution se refuse avec un code
     que le client sait nommer, au lieu de laisser passer un stade 2 qui ne
     correspond à aucune fiche et dont plus rien ne saurait tirer un nom.      */

  async function evolve(userId, idDemande) {
    // On accepte l'identifiant de n'importe quel âge : un deck ou un lien
    // enregistré avant le repliage désigne encore « TR32B ».
    const id = racineDe(String(idDemande));
    const perso = parIdentifiant(id);
    if (!perso) throw fail('fanzzy.error.unknown');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[have]] = await conn.query(
        `SELECT copies, stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ? FOR UPDATE`,
        [userId, id]);
      if (!have || have.copies < 1) throw fail('fanzzy.error.not_owned');

      const vers = Number(have.stage) + 1;
      const age = auStade(id, vers);
      if (!age) throw fail('fanzzy.error.no_evolution');
      const cost = EVO_COST[vers] ?? 90;

      const [d] = await conn.query(
        `UPDATE user_wallet SET scarves = scarves - ? WHERE user_id = ? AND scarves >= ?`,
        [cost, userId, cost]);
      if (!d.affectedRows) throw fail('fanzzy.error.not_enough_scarves');

      // `AND stage = ?` : la ligne est déjà verrouillée, mais cette condition
      // rend l'écriture juste même si elle ne l'était pas. Deux évolutions
      // lancées en même temps ne peuvent pas faire sauter deux stades pour le
      // prix d'un.
      await conn.query(
        `UPDATE user_fanzzy SET stage = ? WHERE user_id = ? AND fanzzy_id = ? AND stage = ?`,
        [vers, userId, id, have.stage]);

      /* Le nouvel âge a besoin d'une tenue.
         Depuis qu'un skin appartient à un âge et non au personnage, grandir
         sans cette ligne laisserait le Capo sans rien à porter : la fiche
         n'aurait aucun skin à montrer, et l'accueil chercherait un dossier
         `e2/` qu'aucun skin ne désigne. Le skin de base, donc, comme à
         l'acquisition. */
      await conn.query(
        `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id, equipped)
         VALUES (?, ?, ?, 'base', 1)`,
        [userId, id, vers]);

      await conn.commit();
      return { id, stade: vers, nom: age.nom, rar: age.rar, spent: cost,
        // `from`/`to` restent pour les pages qui les lisent encore. Ils
        // désignent maintenant deux âges du même personnage, pas deux cartes.
        from: id, to: age.id };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  const fail = (code) => Object.assign(new Error(code), { code });

  /**
   * Traduit une erreur technique en code lisible par le client.
   *
   * Sans cela, une table manquante remonte sous le code `ER_NO_SUCH_TABLE`,
   * que le client ne reconnaît pas et affiche en « impossible ». On perd alors
   * la seule information utile : le schéma n'est pas à jour.
   */
  const traduire = (e) => {
    if (e.code && String(e.code).startsWith('fanzzy.')) return e;
    if (/doesn't exist|Unknown column/i.test(e.message ?? '')) {
      const t = Object.assign(new Error(e.message), { code: 'fanzzy.error.schema' });
      t.detail = 'Applique sql/inventaire.sql, sql/deck.sql, sql/admin.sql '
        + 'puis sql/rattrapage.sql';
      console.error('[fanzzy] schéma incomplet :', e.message);
      return t;
    }
    console.error('[fanzzy]', e.message);
    return Object.assign(new Error(e.message), { code: 'fanzzy.error.server' });
  };

  /* ------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));

  const send = (res, p) => p.then((v) => res.json(v))
    .catch((e) => {
      const t = traduire(e);
      res.status(400).json({ error: t.code, detail: t.detail });
    });

  /**
   * Le catalogue : envoyé une fois, mis en cache par le navigateur.
   *
   * Il porte **tout** ce dont une page a besoin pour afficher la collection,
   * y compris les paliers de rareté et les taux de tirage. Ce n'est pas du
   * zèle : tant qu'il manquait une seule de ces constantes, la page en gardait
   * une copie, et une copie finit toujours par diverger. C'est exactement ce
   * qui s'est produit — la lignée du Gamin de Devant manquait au catalogue
   * recopié dans la page alors que le serveur la tirait des boosters.
   */
  router.get('/dex', (_req, res) => {
    // Une minute et non une heure : la liste des séries ouvertes se change
    // depuis l'administration, et un kiosque qui met soixante minutes à
    // s'apercevoir qu'une série vient d'ouvrir n'est pas administrable.
    res.set('cache-control', 'public, max-age=60');
    const ouvertes = seriesOuvertes();
    res.json({
      // Tout le catalogue publié, y compris les séries fermées : un joueur qui
      // possède déjà une carte d'une série refermée doit continuer à la voir
      // dans son classeur et à la jouer. Fermer, c'est cesser de distribuer.
      //
      // `racine` et `stade` sont ajoutés ici plutôt que laissés à déduire. Une
      // page qui doit deviner qu'une entrée est le deuxième âge d'une autre le
      // devinera de travers le jour où la règle bouge, et elle le fera en
      // silence — c'est exactement la faute du catalogue recopié, sous une
      // autre forme.
      dex: publies().map((f) => ({ ...f, racine: racineDe(f.id),
        stade: lignee(f.id).findIndex((x) => x.id === f.id) + 1 })),
      /* `ouverte` porte l'information : le kiosque n'affiche que celles-là, et
         la progression ne se compte que sur elles. `saison` dit **par quelle
         saison** elle est arrivée — ce qui remplace l'ancien `niveau`, et qui
         est désormais la même chose pour tout le monde.

         Une série fermée n'a pas de saison : c'est ce qui permet à l'écran de
         dire « pas encore » plutôt que d'inventer une date. */
      sets: (() => {
        const parSerie = saisonDeSerie();
        return SETS.map((s) => ({ ...s, ouverte: serieOuverte(s.id),
          saison: parSerie[s.id] ?? null }));
      })(),
      /* La saison en cours, pour que le kiosque puisse l'annoncer. Ici plutôt
         que dans `/state` : elle ne dépend pas du joueur, et cette réponse-ci
         est celle que toutes les pages chargent déjà. */
      saison: saisonEnCours(),
      // Ce qu'un joueur peut encore obtenir. La page pourrait le recalculer,
      // mais elle le recalculerait *mal* le jour où la règle se nuance — et
      // c'est précisément le genre de copie que ce projet a déjà payé.
      aCollectionner: obtenables().length,
      seriesOuvertes: ouvertes,
      types: TYPES, scarves: SCARVES, evoCost: EVO_COST, rar: RAR, rates: RATES,
      // Un booster ne tire pas que des supporters : ses places 4 et 5
      // donnent des tenues, de l’équipement et des cartes d’action. La page
      // ne recevait que le catalogue Fanzzy, si bien qu’elle traitait les
      // trois autres comme des cartes inconnues — elle les jetait, prévenait
      // le joueur que sa version était périmée, et lui montrait trois cartes
      // en annonçant « 1 / 5 ». Ce qui se tire doit être servi.
      stuff: STUFF, actions: ACTIONS, tenues: toutesTenues(),
    });
  });

  /**
   * L'état du joueur.
   *
   * `series` y portait **les séries que ce joueur-là avait débloquées**, tirées
   * de son niveau. Il n'y en a plus : les séries s'ouvrent par saison, pour tout
   * le monde le même jour, et `/dex` les sert déjà à tous. Une liste par joueur
   * qui vaudrait la même chose pour tout le monde serait une requête de plus
   * pour redire ce qui est déjà dit.
   *
   * Ce qui reste vrai, et qui valait la peine : **un jeu ne cache pas ce qui
   * vient**. Le kiosque montre les séries fermées, verrouillées, en disant
   * qu'elles attendent une saison — plutôt que de laisser le joueur les
   * découvrir par un refus après avoir appuyé.
   *
   * `saisonVue` sert à ne montrer l'annonce qu'une fois. Ce joueur-là l'a vue
   * ou non : c'est bien un état de joueur, et sa place est ici.
   */
  router.get('/state', requireAuth, (req, res) =>
    send(res, Promise.all([
      wallet(req.user.id), collection(req.user.id), stades(req.user.id),
      saisonVue(req.user.id),
    ]).then(([w, col, st, vue]) => ({ wallet: w, collection: col, stades: st,
      saison: saisonEnCours(), saisonVue: vue,
      maxPacks: maxPacks(), packPrice: prixPack() }))));

  /**
   * « J'ai vu l'annonce de cette saison. »
   *
   * Sans cette marque, l'annonce reviendrait à chaque ouverture du kiosque, pour
   * toujours — et une annonce qu'on ne peut pas faire taire est une annonce
   * qu'on apprend à ne plus lire. La suivante ne serait pas lue non plus.
   */
  router.post('/saison-vue', requireAuth, (req, res) => send(res, (async () => {
    const s = saisonEnCours();
    if (!s) return { saisonVue: null };
    await q(`UPDATE user_wallet SET saison_vue = ? WHERE user_id = ?`, [s.id, req.user.id]);
    return { saisonVue: s.id };
  })()));

  /* Le repli est **LA TRIBUNE**, la seule série ouverte au niveau 1 : un joueur
     qui n'en a pas encore débloqué d'autre ne peut ouvrir que celle-là.
     Il valait `VN` — une série qui n'existe plus depuis la dissolution de
     VIRAGE NORD, ce qui faisait d'une requête sans série une ouverture vide.
     Un repli qui nomme une série codée en dur doit nommer celle que tout le
     monde possède. */
  router.post('/open', requireAuth, (req, res) =>
    send(res, openPack(req.user.id, String(req.body?.set ?? 'TR'), { buy: Boolean(req.body?.buy) })
      .then(async (r) => ({ ...r, wallet: await wallet(req.user.id) }))));

  router.post('/evolve', requireAuth, (req, res) =>
    send(res, evolve(req.user.id, String(req.body?.id ?? ''))
      .then(async (r) => ({ ...r, wallet: await wallet(req.user.id) }))));

  router.get('/fiche/:id', requireAuth, (req, res) => {
    // Un identifiant inexistant est une ressource absente, pas une requête
    // invalide : 404, et non 400.
    fiche(req.user.id, String(req.params.id))
      .then((d) => (d ? res.json(d) : res.status(404).json({ error: 'fanzzy.error.unknown' })))
      .catch((e) => {
        const t = traduire(e);
        res.status(400).json({ error: t.code, detail: t.detail });
      });
  });

  /** Le catalogue de l'équipement, pour l'écran de détail. */
  router.get('/stuff', (_req, res) => {
    res.set('cache-control', 'public, max-age=3600');
    res.json({ stuff: STUFF, skins: toutesTenues() });
  });

  /**
   * L'avatar — et depuis la règle du titulaire, un simple raccourci.
   *
   * « Mon FANZZY » et le titulaire du deck étaient deux notions séparées : on
   * pouvait lire « TITULAIRE » sur la fiche d'un personnage et en voir un autre
   * partout ailleurs. C'est une notion de trop ; le personnage qu'on met en
   * avant est celui qu'on aligne, et c'est `enregistrer` qui l'écrit désormais.
   *
   * Cette route reste parce qu'elle est le seul endroit qui pouvait encore les
   * séparer. Elle **passe donc par le deck** quand il est là : demander l'avatar,
   * c'est demander le brassard. Le repli existe pour une installation sans
   * module de deck, et pour le cas où le deck refuse — un joueur sans carte
   * d'action, par exemple : il vaut mieux un avatar posé qu'un refus sur un
   * geste qui n'a jamais rien refusé.
   */
  router.post('/active', requireAuth, (req, res) => send(res, (async () => {
    // On équipe un personnage, jamais un âge : c'est le même individu, et la
    // collection ne connaît que lui. Accepter « TR32B » tel quel poserait dans la
    // bourse un identifiant introuvable au moment de le dessiner.
    const id = racineDe(String(req.body?.id ?? ''));
    if (!parIdentifiant(id)) throw fail('fanzzy.error.unknown');
    const stade = (await q(
      `SELECT stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`,
      [req.user.id, id]))[0];
    if (!stade) throw fail('fanzzy.error.not_owned');

    /* ----------------------------------------------------- et à quel âge

       Le même geste dit qui et à quel âge, parce que c'est **une seule
       décision** : « voilà le personnage qu'on voit de moi ». Une seconde
       route pour l'âge aurait demandé deux appels pour un seul choix, et
       laissé exister l'instant où la bourse porte un personnage et l'âge d'un
       autre.

       L'âge demandé ne peut pas dépasser l'âge atteint : on montre ce qu'on a
       fait grandir, et rien de plus. Au-delà, ce serait un aperçu de ce qu'on
       n'a pas payé, exposé aux amis comme s'il était acquis.

       Absent, il vaut **nul**, c'est-à-dire l'âge atteint. C'est aussi ce qui
       remet les compteurs à zéro en changeant de personnage : le classeur
       envoie `{ id }` sans âge, et le nouveau venu se montre donc au sien —
       garder l'âge du précédent l'afficherait à un stade qu'il n'a peut-être
       jamais atteint. */
    const atteint = Math.max(1, Number(stade.stage) || 1);
    const brut = req.body?.evo;
    let evo = null;
    if (brut !== undefined && brut !== null && brut !== '') {
      const n = Number(brut);
      if (!Number.isInteger(n) || n < 1) throw fail('fanzzy.error.age_inconnu');
      if (n > atteint) throw fail('fanzzy.error.age_non_atteint', { atteint });
      /* L'âge atteint s'écrit nul plutôt que son numéro : sans cela, choisir
         « le dernier » aujourd'hui figerait l'affichage sur cet âge-là, et le
         joueur qui fait grandir son Fanzzy demain ne le verrait pas changer. */
      evo = n < atteint ? n : null;
    }

    if (decks) {
      try {
        await decks.placer(req.user.id, { id, place: 0 });
        await q(`UPDATE user_wallet SET active_evo = ? WHERE user_id = ?`, [evo, req.user.id]);
        return { active: id, activeEvo: evo };
      } catch { /* le deck a refusé : on pose au moins l'avatar. */ }
    }
    await q(`UPDATE user_wallet SET active_fanzzy = ?, active_evo = ? WHERE user_id = ?`,
      [id, evo, req.user.id]);
    return { active: id, activeEvo: evo };
  })()));

  /**
   * Fiche complète d'un Fanzzy : ce qu'il est, ce que le joueur en possède,
   * ses tenues, sa lignée et l'effet réel de son équipement.
   *
   * Tout est assemblé côté serveur en une seule fois : la page n'a pas à
   * enchaîner cinq requêtes pour afficher une carte.
   */
  /**
   * Les places de la tribune du deck, et qui les occupe.
   *
   * Une place par rang ouvert : la première est le titulaire — celui qui entre
   * au coup d'envoi — les suivantes sont des remplaçants, que la carte
   * Changement fait entrer en cours de partie.
   *
   * Rend `null` si le module de deck n'est pas monté. La fiche retire alors son
   * bouton plutôt que d'en proposer un qui échouerait.
   */
  async function laTribune(userId, fanzzyId) {
    if (!decks) return null;
    try {
      const [deck, possede] = await Promise.all([
        decks.deckDe(userId), decks.possessions(userId),
      ]);
      const rangs = deck?.fanzzy ?? [];
      /* Le plafond vient du niveau, borné par la règle — exactement comme dans
         l'écran de deck. Le recopier ici donnerait une seconde vérité. */
      const ouvertes = Math.min(DECK_RULES.fanzzy, possede.fanzzyMax);
      return {
        places: Array.from({ length: ouvertes }, (_, i) => {
          const occupant = rangs[i] ? parIdentifiant(rangs[i].id) : null;
          return {
            place: i,
            role: i === 0 ? 'titulaire' : 'remplacant',
            /* **Atteignable ou non.** Poser quelqu'un au rang 2 quand le rang 1
               est vide laisserait un trou, et c'est `fanzzy[0]` qui décide du
               titulaire : le serveur refuse, la page grise. */
            ouverte: i <= rangs.length,
            occupant: occupant ? { id: occupant.id, nom: occupant.nom } : null,
          };
        }),
        /* Où est ce personnage aujourd'hui. `-1` : nulle part. */
        siege: rangs.findIndex((x) => x.id === racineDe(String(fanzzyId ?? ''))),
      };
    } catch {
      /* Un deck illisible ne doit pas emporter la fiche : le joueur perdrait
         l'accès à sa collection entière pour un JSON abîmé. */
      return null;
    }
  }

  async function fiche(userId, fanzzyId) {
    // La fiche d'un âge supérieur est la fiche de son personnage : c'est le
    // même individu, et le joueur n'en possède qu'un.
    const id = racineDe(String(fanzzyId));
    const perso = parIdentifiant(id);
    if (!perso) return null;

    const [mien, skins, stuff, w, tribune] = await Promise.all([
      q(`SELECT copies, stage, first_at FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`,
        [userId, id]),
      q(`SELECT skin_id, stage, equipped, got_at FROM user_skins
          WHERE user_id = ? AND fanzzy_id = ?`, [userId, id]),
      q(`SELECT stuff_id, copies, slot FROM user_stuff WHERE user_id = ?`, [userId]),
      q(`SELECT active_fanzzy, scarves FROM user_wallet WHERE user_id = ?`, [userId]),
      /* La tribune du deck, assemblée ici et pas par la page.
         Elle enchaînerait sinon deux requêtes pour afficher une carte, et la
         seconde arriverait après le premier rendu — le bouton changerait de
         texte sous le doigt du joueur. */
      laTribune(userId, id),
    ]);

    const ages = lignee(id);
    const stade = Number(mien[0]?.stage ?? 1);
    // Ce qu'il est **aujourd'hui** : nom, histoire, bonus et cri de l'âge
    // atteint. Afficher toujours le premier âge donnerait à quelqu'un qui a
    // payé quatre-vingt-dix écharpes une fiche identique à celle d'avant.
    const f = ages[stade - 1] ?? perso;

    const portes = stuff.filter((s) => s.slot).sort((a, b) => a.slot - b.slot)
      .map((s) => s.stuff_id);

    return {
      fanzzy: {
        id,
        /* `ageId` est la carte du catalogue à l'âge atteint — `id`, lui, est la
           lignée. Le dessin est rangé sous la première, les possessions sous la
           seconde. La fiche demandait l'illustration sous le nom de la lignée :
           elle affichait donc le Choriste avec le nom du Meneur de chant. */
        ageId: f.id,
        nom: f.nom, type: f.type, set: f.set, stage: stade, rar: f.rar,
        /* Le nom de la série, et pas seulement son identifiant.
           La fiche d'un Fanzzy qu'on ne possède pas dit maintenant dans quel
           booster il se tire ; sans ce champ elle aurait dû se fabriquer sa
           propre table « TR → LA TRIBUNE », c'est-à-dire une copie de moins en
           moins juste de celle qui vit dans `dex.js`. */
        setNom: SETS.find((s) => s.id === f.set)?.nom ?? null,
        mods: f.mods, cri: f.cri, evo: f.evo ?? null,
        histoire: f.histoire ?? null,
      },
      possede: mien[0]?.copies ?? 0,
      stade,
      /* **Ce qu'il a en poche.**

         La fiche proposait ÉVOLUER sans jamais savoir si le joueur pouvait
         payer : on ouvrait le panneau, on confirmait, et le refus arrivait au
         troisième geste sous la forme d'un petit message. Deux clics pour
         apprendre une chose qui se savait avant le premier.

         C'est la même faute que le bouton d'ouverture du kiosque, et elle se
         corrige de la même façon : le prix et la bourse voyagent ensemble, et
         l'écran dit « il te faut » au lieu de laisser essayer. */
      echarpes: Number(w[0]?.scarves ?? 0),
      depuis: mien[0]?.first_at ?? null,
      /* **L'avatar, et non le deck.** C'est le personnage que voient les amis
         et l'accueil. Le champ s'appelait `equipe` et la fiche en tirait
         « DÉJÀ EN DUEL » — sur quelqu'un qui n'était dans aucun deck. Renommé
         pour ce qu'il est ; ce qui concerne le duel est dans `tribune`. */
      avatar: w[0]?.active_fanzzy === id,
      /* Où il est dans la tribune du deck, et quelles places sont ouvertes.
         `null` si le module de deck n'est pas monté. */
      tribune,
      /* Les tenues de **l’âge atteint**, et rien d’autre.

         Un skin appartient désormais à un âge : le Capo n’hérite pas de la
         garde-robe du gamin. Montrer toutes les tenues du personnage ferait
         croire le contraire, et le joueur chercherait longtemps le bouton qui
         ne viendra pas. */
      skins: toutesTenues().map((sk) => {
        const m = skins.find((x) => x.skin_id === sk.id && Number(x.stage) === stade);
        return { ...sk, possede: Boolean(m), porte: Boolean(m?.equipped),
                 depuis: m?.got_at ?? null };
      }),
      // Ce qui est gagné aux autres âges, pour que la fiche puisse le dire
      // plutôt que de laisser croire à une perte.
      skinsAutresAges: skins.filter((x) => Number(x.stage) !== stade)
        .map((x) => ({ id: x.skin_id, stade: Number(x.stage) })),
      // `possede` par âge veut dire « atteint », pas « détenu à part ». Un âge
      // au-delà du stade actuel se lit donc comme un objectif chiffré, ce qui
      // est exactement ce que la page en fait.
      /* `mods` et `cri` voyagent avec chaque âge, et pas seulement avec l'âge
         atteint : la fiche demande confirmation avant d'évoluer, et une
         confirmation qui ne montre pas ce qu'on gagne ne demande rien du tout.
         Quatre-vingt-dix écharpes se dépensent en connaissance de cause. */
      lignee: ages.map((x, i) => ({
        id: x.id, nom: x.nom, stage: i + 1, rar: x.rar,
        mods: x.mods ?? {}, cri: x.cri ?? null,
        possede: mien.length > 0 && stade >= i + 1,
        cout: i ? (EVO_COST[i + 1] ?? 90) : 0,
      })),
      // L'effet réel : les modificateurs du Fanzzy combinés à l'équipement
      // actuellement porté. C'est ce que le duel utilisera vraiment.
      effetReel: combine(f.mods, portes),
      stuffPorte: portes.map((id) => STUFF_BY_ID.get(id)).filter(Boolean),
    };
  }

  /** Le Fanzzy équipé, lu par le duel au démarrage d'une partie. */
  /**
   * Le Fanzzy équipé, lu par le duel au démarrage d'une partie.
   *
   * Il rend **le premier âge**, toujours, quel que soit le stade atteint. Ce
   * n'est pas un oubli : un duel se joue depuis le début, et le personnage y
   * grandit en jeu, par une carte. Ce que les écharpes ont acheté, c'est le
   * droit de jouer cette carte — pas un avantage acquis au coup d'envoi.
   */
  async function activeFanzzy(userId) {
    const w = (await q(`SELECT active_fanzzy FROM user_wallet WHERE user_id = ?`, [userId]))[0];
    const f = w?.active_fanzzy ? parIdentifiant(racineDe(w.active_fanzzy)) : null;
    return f ?? null;
  }

  /**
   * Le Fanzzy équipé **tel qu'il est à l'écran** : l'identifiant du
   * personnage, l'âge atteint, le nom et le cri de cet âge.
   *
   * `activeFanzzy`, juste au-dessus, rend la racine et sert aux barèmes.
   * Celui-ci sert à l'affichage, et les deux ne peuvent pas être une seule
   * fonction : le barème suit la racine — c'est l'équilibrage d'aujourd'hui —
   * tandis que le dessin, le nom et le cri suivent l'âge atteint. Les
   * confondre ferait pousser un Capo avec les chiffres du Choriste, ou
   * afficher le Choriste à quelqu'un qui a payé quatre-vingt-dix écharpes
   * pour ne plus le voir.
   */
  async function personnageActif(userId) {
    const w = (await q(
      `SELECT active_fanzzy, active_evo FROM user_wallet WHERE user_id = ?`, [userId]))[0];
    if (!w?.active_fanzzy) return null;
    const id = racineDe(w.active_fanzzy);
    const r = (await q(`SELECT stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`,
      [userId, id]))[0];
    const atteint = Math.max(1, Number(r?.stage) || 1);
    /* **L'âge choisi, borné par l'âge atteint.** Le joueur peut préférer se
       montrer jeune — c'est son visage, et celui de l'âge 1 n'a rien d'une
       version inférieure. Mais la borne reste : une colonne qui dirait 3 alors
       que la collection n'a fait grandir qu'au 2 afficherait aux amis un
       personnage que son propriétaire n'a pas. Ça arrive sans mauvaise
       intention — un âge choisi puis une remise à zéro de la collection — et
       le clamp coûte moins cher que d'y penser à chaque écriture.

       Nul = l'âge atteint, ce qui est le comportement d'avant : personne
       n'ayant encore choisi, tout le monde se voit exactement comme hier. */
    const evo = Math.min(atteint, Math.max(1, Number(w.active_evo) || atteint));
    // `auStade` peut ne rien rendre : cent cinquante-deux personnages n'ont
    // qu'un âge écrit, et une base qui annonce un stade 2 inexistant ne doit
    // pas faire disparaître le personnage de l'écran.
    const age = auStade(id, evo) ?? parIdentifiant(id);
    if (!age) return null;
    /* Deux identifiants, et les confondre donne le mauvais dessin : `id` est
       la lignée — c'est sous ce nom que sont rangés les douze états — tandis
       que `age` est la carte du catalogue, sous laquelle est rangée
       l'illustration en pied. Le Meneur de chant, c'est `TR32` avec `evo: 2`
       pour ses états, et `TR32B` pour son dessin. */
    return { id, age: age.id, evo, nom: age.nom,
      cri: age.cri?.label ?? null, rar: age.rar ?? null };
  }

  /**
   * Remettre une tenue ou une pièce d'équipement, hors booster.
   *
   * C'est la boutique qui appelle, avec **sa** connexion : la remise doit
   * vivre dans la transaction qui marque la commande livrée, sinon un hoquet
   * entre les deux perd la marchandise ou la donne deux fois.
   *
   * On tire parmi ce qui **manque** au joueur. Tout possédé : des écharpes, au
   * tarif de la rareté — c'est déjà ce que fait un doublon de booster, et
   * rendre une commande blanche serait le seul endroit du jeu où l'on paie
   * pour rien.
   */
  async function offrir(conn, userId, type, combien = 1) {
    const rendu = { skins: [], stuff: [], scarves: 0 };

    for (let k = 0; k < combien; k++) {
      if (type === 'skin') {
        const [avant] = await conn.query(
          `SELECT fanzzy_id, stage FROM user_fanzzy uf
             JOIN user_skins us ON us.user_id = uf.user_id AND us.fanzzy_id = uf.fanzzy_id
            WHERE uf.user_id = ? GROUP BY fanzzy_id, stage`, [userId]);
        const [pris] = await conn.query(
          `SELECT fanzzy_id, stage, skin_id FROM user_skins WHERE user_id = ?`, [userId]);
        const dejaLa = new Set(pris.map((p) => `${p.fanzzy_id}:${p.stage}:${p.skin_id}`));

        const places = [];
        for (const f of avant) {
          for (const sk of tenuesPubliees()) {
            if (sk.id === 'base') continue;
            if (!dejaLa.has(`${f.fanzzy_id}:${f.stage}:${sk.id}`)) {
              places.push({ id: f.fanzzy_id, stade: f.stage, skin: sk.id });
            }
          }
        }
        if (!places.length) { rendu.scarves += SCARVES.rare; continue; }
        const p = places[Math.floor(Math.random() * places.length)];
        await conn.query(
          `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id)
           VALUES (?, ?, ?, ?)`, [userId, p.id, p.stade, p.skin]);
        rendu.skins.push(p);
        continue;
      }

      if (type === 'stuff') {
        const [ont] = await conn.query(
          `SELECT stuff_id FROM user_stuff WHERE user_id = ?`, [userId]);
        const dejaLa = new Set(ont.map((s) => s.stuff_id));
        const libres = STUFF.filter((s) => !dejaLa.has(s.id));
        if (!libres.length) { rendu.scarves += SCARVES.rare; continue; }
        const def = libres[Math.floor(Math.random() * libres.length)];
        await conn.query(
          `INSERT INTO user_stuff (user_id, stuff_id, copies) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE copies = copies + 1`, [userId, def.id]);
        rendu.stuff.push(def.id);
        continue;
      }

      throw new Error('fanzzy.error.offre_inconnue');
    }

    if (rendu.scarves) {
      await conn.query(`UPDATE user_wallet SET scarves = scarves + ? WHERE user_id = ?`,
        [rendu.scarves, userId]);
    }
    return rendu;
  }

  /* ------------------------------------------------- remettre un objet nommé

     `offrir` tire au sort ; `remettre` donne ce qu'on a demandé. Les deux
     existent parce qu'un booster et un achat ne posent pas la même question :
     « donne-lui quelque chose » et « donne-lui ceci ».

     Elle **refuse** au lieu de rattraper. Chaque refus porte son code, et il
     arrive **avant** le débit : débiter puis découvrir qu'on ne peut pas
     livrer, c'est prendre de l'argent contre rien, et personne ne saura que
     c'est arrivé. */

  /**
   * Remet une pièce d'équipement nommée.
   *
   * Un doublon est permis — l'équipement se porte sur plusieurs Fanzzy, et
   * deux exemplaires de la même pièce ont un usage. La page le dit avant.
   */
  async function remettreStuff(conn, userId, stuffId) {
    if (!STUFF_BY_ID.has(stuffId)) throw fail('boutique.error.objet_inconnu');
    await conn.query(
      `INSERT INTO user_stuff (user_id, stuff_id, copies) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE copies = copies + 1`, [userId, stuffId]);
    return { stuff: [stuffId] };
  }

  /**
   * Remet une tenue, sur un Fanzzy et à un âge précis.
   *
   * Trois refus, et ils ne sont pas interchangeables — un joueur à qui l'on dit
   * « impossible » cherche au mauvais endroit :
   *   — la tenue n'existe pas, ou n'est plus publiée ;
   *   — le joueur ne possède pas ce Fanzzy à cet âge ;
   *   — il l'a déjà habillé ainsi.
   */
  async function remettreTenue(conn, userId, { tenue, fanzzy, stage }) {
    const t = tenuesPubliees().find((x) => x.id === tenue);
    if (!t || tenue === 'base') throw fail('boutique.error.tenue_inconnue');

    const etage = Number(stage);
    const [[a]] = [await conn.query(
      `SELECT 1 FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ? AND stage = ?`,
      [userId, fanzzy, etage])];
    if (!a.length) throw fail('boutique.error.fanzzy_non_possede');

    const [pose] = await conn.query(
      `SELECT 1 FROM user_skins WHERE user_id = ? AND fanzzy_id = ? AND stage = ? AND skin_id = ?`,
      [userId, fanzzy, etage, tenue]);
    if (pose.length) throw fail('boutique.error.tenue_deja_posee');

    await conn.query(
      `INSERT INTO user_skins (user_id, fanzzy_id, stage, skin_id) VALUES (?, ?, ?, ?)`,
      [userId, fanzzy, etage, tenue]);
    return { skins: [{ id: fanzzy, stade: etage, skin: tenue }] };
  }

  return { router, wallet, collection, stades, openPack, evolve, activeFanzzy,
    personnageActif, fiche, offrir, remettreStuff, remettreTenue };
}
