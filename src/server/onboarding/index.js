import express from 'express';
import { SCARVES } from '../../shared/fanzzy/dex.js';
import { stadeAffiche } from '../../shared/fanzzy/ages.js';
/* `obtenables` et non `publies` : publiées, **de série ouverte**, et le
   premier âge seul. Voir `tirerBienvenue`. */
import { obtenables, parIdentifiant } from '../fanzzy/catalogue.js';
import { STUFF, SKIN_BY_ID, STUFF_BY_ID, combine }
  from '../../shared/fanzzy/inventaire.js';
/* Les cartes d'action viennent du **catalogue du jeu**, et de nulle part
   ailleurs. `inventaire.js` en portait une liste de quatre, qui avait divergé :
   un nouveau joueur sur quatre recevait `a-relance`, une carte qui n'existe
   pas. Voir la note à l'endroit où cette liste se trouvait. */
import { ACTIONS } from '../../shared/duel/actions.js';
/* Ce que les saisons ont ouvert de l’équipement et des cartes d’action.
   Renommé à l’import : `publies` désigne déjà le catalogue Fanzzy dans les
   modules voisins, et deux sens pour un nom finissent par se confondre.
   Voir `tirerBienvenue`. */
import { publies as jouables } from '../contenus/index.js';
import { toutesTenues, tenuesPubliees } from '../fanzzy/tenues.js';
import { verifierEmplacement, SLOTS_DEPART, SLOTS_MAX } from './slots.js';
import { assurerBourse } from '../bourse.js';

/**
 * L'arrivée d'un joueur, et ce qu'il possède.
 *
 * Trois choses au moment de l'inscription : il choisit son club, il reçoit
 * deux emplacements de suivi, et il ouvre un paquet de bienvenue. Ensuite
 * l'inventaire suit — skins et équipement.
 *
 * Le paquet de bienvenue n'est pas un booster ordinaire : il est **garanti**.
 * Un joueur qui tombe sur cinq communes à sa première ouverture ne revient
 * pas. Il contient donc toujours un Fanzzy peu commun au minimum, une pièce
 * d'équipement et des écharpes.
 */

/* Réexportés pour ne pas casser ce qui les importe d'ici depuis toujours.
   Leur définition, elle, a déménagé avec la règle qu'ils servent. */
export { SLOTS_DEPART, SLOTS_MAX };
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

/**
 * `niveau` est facultatif. Sans lui, le plafond d'emplacements reste celui
 * d'avant — huit — et rien ne change : une installation dont
 * `sql/niveau.sql` n'est pas encore appliqué continue de fonctionner.
 */
export function createOnboarding({ pool, requireAuth, football = null, niveau = null,
  decks = null,
  /* L'abonnement ouvre deux choses ici : un emplacement de club de plus, et
     le droit de porter toute tenue publiée. Ni l’un ni l’autre ne pèse sur
     la corde — voir `abonnement/index.js`. */
  abonnement = null }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const fail = (code) => Object.assign(new Error(code), { code });

  /**
   * Le suivi des matchs n'existe que si `API_FOOTBALL_KEY` est présent, et
   * `server.js` le construit *après* l'inscription. Reçu en simple paramètre,
   * il restait donc à `null` pour toujours : le club choisi à la cérémonie
   * d'arrivée n'avait jamais son calendrier chargé, et `/deck`, `/duel-nvn` et
   * `/virage` n'avaient aucun match à proposer au joueur — sur son tout premier
   * écran. On garde la référence dans un objet que `server.js` rebranche une
   * fois le module prêt, comme il le fait déjà pour l'administration.
   */
  /* `decks` sert au deck de départ, écrit à la première ouverture de paquet.
     Il vient en paramètre et non par rebranchement : `server.js` monte les
     decks avant l'inscription, il l'a donc déjà sous la main. */
  const module = { football, decks, abonnement };

  /* ------------------------------------------------------------- état */

  async function state(userId) {
    await assurerBourse(q, userId);
    const w = (await q(
      `SELECT scarves, packs, follow_slots, onboarded_at, active_fanzzy, action_cards
         FROM user_wallet WHERE user_id = ?`, [userId]))[0];

    const [suivis, skins, stuff] = await Promise.all([
      q(`SELECT f.team_id, f.is_main, t.name, t.logo, t.country
           FROM user_follows f LEFT JOIN teams t ON t.id = f.team_id
          WHERE f.user_id = ? ORDER BY f.is_main DESC`, [userId]),
      q(`SELECT fanzzy_id, stage, skin_id, equipped FROM user_skins WHERE user_id = ?`, [userId]),
      q(`SELECT stuff_id, copies, slot FROM user_stuff WHERE user_id = ?`, [userId]),
    ]);

    return {
      onboarded: Boolean(w.onboarded_at),
      slots: { used: suivis.length, total: w.follow_slots, max: SLOTS_MAX },
      follows: suivis,
      scarves: w.scarves,
      packs: w.packs,
      activeFanzzy: w.active_fanzzy,
      actions: typeof w.action_cards === 'string'
        ? JSON.parse(w.action_cards) : (w.action_cards ?? []),
      skins,
      stuff,
      worn: stuff.filter((s) => s.slot).map((s) => s.stuff_id),
    };
  }

  /* ---------------------------------------------- emplacements de suivi */

  /**
   * Suivre un club.
   *
   * La défense des emplacements est dans `slots.js`, et elle y est pour une
   * raison : elle vivait ici, avec un commentaire expliquant que « la route
   * football ne les connaît pas ». C'était vrai, et c'était le trou — cette
   * autre route écrivait sans rien vérifier, et la page « Mes clubs » passe
   * par elle.
   */
  async function follow(userId, teamId, { main = false } = {}) {
    await verifierEmplacement(q, userId, teamId);
    if (main) await q(`UPDATE user_follows SET is_main = 0 WHERE user_id = ?`, [userId]);
    await q(
      `INSERT INTO user_follows (user_id, team_id, is_main) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE is_main = VALUES(is_main)`,
      [userId, teamId, main ? 1 : 0]);
    // Premier suivi d'un club inconnu : on charge son calendrier en fond.
    // Sans lui, `fixtures` reste vide pour ce club jusqu'à la passe
    // quotidienne, et le joueur n'a aucun match sur lequel s'adosser.
    module.football?.poller.refreshTeam(teamId).catch((e) =>
      console.error('[onboarding] calendrier du club', teamId, e.message));
  }

  /** Un emplacement supplémentaire s'achète, il ne se donne pas. */
  const PRIX_SLOT = [0, 0, 120, 220, 380, 600, 900, 1300];

  /**
   * **Le niveau lève le plafond, les écharpes achètent en dessous.**
   *
   * C'était la question ouverte : remplacer l'achat par un déblocage, ou
   * faire cohabiter les deux. Les deux, et pour une raison simple — un
   * joueur qui a déjà payé trois cents écharpes pour un emplacement ne doit
   * pas le perdre parce qu'on introduit une progression. Le niveau ouvre le
   * droit d'en avoir un de plus, les écharpes restent ce qu'il en coûte.
   *
   * Et le niveau garde ainsi un effet visible sans rien donner : c'est la
   * règle de `shared/niveau.js`, tenue jusque dans les cas particuliers.
   */
  async function buySlot(userId) {
    const w = (await q(`SELECT follow_slots, scarves FROM user_wallet WHERE user_id = ?`, [userId]))[0];
    /* **L'abonnement lève le plafond, il n'offre pas l'emplacement.** Les
       écharpes restent ce qu’il en coûte : c’est la même règle que pour le
       niveau, qui « ouvre le droit d’en avoir un de plus » sans le donner.
       On vend donc de la largeur, et le joueur la paie quand même. */
    const enPlus = module.abonnement
      ? module.abonnement.clubsEnPlus(await module.abonnement.estAbonne(userId)) : 0;
    const plafond = niveau
      ? Math.min(SLOTS_MAX, (await niveau.droitsDe(userId)).slots + enPlus)
      : SLOTS_MAX;
    if (w.follow_slots >= plafond) {
      throw fail(w.follow_slots >= SLOTS_MAX ? 'onboarding.error.max_slots'
                                            : 'onboarding.error.slot_locked');
    }
    const prix = PRIX_SLOT[w.follow_slots] ?? 1300;
    const [d] = await pool.execute(
      `UPDATE user_wallet SET scarves = scarves - ?, follow_slots = follow_slots + 1
        WHERE user_id = ? AND scarves >= ?`, [prix, userId, prix]);
    if (!d.affectedRows) throw fail('onboarding.error.not_enough_scarves');
    return { slots: w.follow_slots + 1, spent: prix };
  }

  /* --------------------------------------------------- paquet d'arrivée */

  /**
   * Le paquet de bienvenue. Cinq cartes, toujours les mêmes catégories :
   * deux Fanzzy dont un beau, une pièce d'équipement, des cartes d'action, et
   * des écharpes. Aucun mauvais tirage possible.
   *
   * ## Il tirait dans tout le catalogue, et il court-circuitait le jeu
   *
   * `publies()`, c'est **toute** carte publiée : les six cent quarante, séries
   * fermées comprises, et chaque **âge** de chaque personnage. Un nouveau
   * joueur recevait donc, à sa toute première ouverture, des cartes qu'il ne
   * pouvait ni jouer ni retrouver au kiosque — la seule chose que le jeu lui
   * demandait de faire, collectionner, commençait par deux cartes hors-jeu.
   *
   * Pire, et plus discret : il demandait « un Fanzzy rare ou épique ». Or
   * `openPack` l'écrit en toutes lettres — **la rareté suit le stade** : une
   * rare est un stade 2, une épique un stade 3. En tirer une, c'est offrir un
   * Capo di Curva à quelqu'un qui n'a jamais vu le Choriste, et contourner les
   * cent quinze écharpes que coûte l'évolution. Le booster s'en garde depuis
   * longtemps ; le paquet de bienvenue n'avait jamais reçu la consigne.
   *
   * ## Ce qu'il tire maintenant
   *
   * `obtenables()` : publiées, **de série ouverte**, premier âge seul. C'est
   * exactement la liste d'un booster, et il n'y a aucune raison que le premier
   * paquet soit plus large que les suivants — au contraire.
   *
   * Au premier âge, il n'existe que deux raretés : commune et légendaire. Le
   * « beau » Fanzzy du paquet est donc une **légendaire**, ce qui tient la
   * promesse d'origine — un cran au-dessus de commun — sans rien court-
   * circuiter : une légendaire de stade 1 est un personnage, pas une avance
   * sur son évolution.
   *
   * Les replis existent parce qu'une série ouverte peut n'avoir aucune
   * légendaire : mieux vaut deux communes qu'une erreur au premier écran.
   */
  function tirerBienvenue() {
    const ouvrables = obtenables();
    const communs = ouvrables.filter((f) => f.rar === 'commune');
    const beaux = ouvrables.filter((f) => f.rar !== 'commune');
    const premier = communs.length ? communs : ouvrables;
    const second = beaux.length ? beaux : premier;
    /* **Ce qu'une saison a ouvert, ici comme dans le booster.** Le paquet de
       bienvenue est le premier tirage d'un joueur : s'il était le seul à ignorer
       les saisons, il livrerait à chaque nouvel inscrit, et à lui seul, du
       contenu que personne d'autre n'a encore. */
    const equipement = jouables('stuff')
      .filter((s) => ['commune', 'rare'].includes(s.rar));
    /* **Cinq cartes d'action, et l'Arbitre parmi elles.**
     *
     * Il y en avait **une**. Un deck demande exactement dix cartes et n'impose
     * aucun plafond par carte, donc le premier deck légal d'un nouveau joueur
     * était dix fois la même : jouable, et sans aucune décision à prendre.
     *
     * L'Arbitre est garanti et non tiré. C'est la carte qui ouvre le
     * changement : sans elle, les deux Fanzzy du paquet de bienvenue ne
     * servent à rien — le second reste sur le banc pendant tout le duel, et le
     * joueur n'a aucun moyen de découvrir qu'une tribune se relaie. Une
     * mécanique entière du jeu dépendait d'un tirage à une chance sur dix-sept.
     *
     * Les quatre autres sont tirées sans remise parmi les cartes de début :
     * tirer avec remise donnerait parfois quatre fois le même Fumigène, ce qui
     * ramènerait exactement au problème qu'on vient de corriger. */
    const OUVRE_LE_CHANGEMENT = 'a-arbitre';
    const debut = jouables('action');
    const debutantes = debut.filter((a) => ['commune', 'rare'].includes(a.rar)
      && a.id !== OUVRE_LE_CHANGEMENT);
    const melange = [...debutantes];
    for (let i = melange.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      [melange[i], melange[k]] = [melange[k], melange[i]];
    }

    /* L'Arbitre est garanti **s'il est ouvert**. Il l'est aujourd'hui et le
       restera vraisemblablement toujours — c'est une carte de fondation, pas
       une nouveauté de saison — mais « vraisemblablement » n'est pas une
       garantie, et offrir une carte fermée donnerait un paquet de bienvenue
       dont une carte sur cinq n'est pas jouable. Fermé, on prend simplement une
       débutante de plus : le paquet garde ses cinq cartes. */
    const arbitre = debut.some((a) => a.id === OUVRE_LE_CHANGEMENT);

    return [
      { type: 'fanzzy', id: rnd(premier).id },
      { type: 'fanzzy', id: rnd(second).id },
      { type: 'stuff', id: rnd(equipement).id },
      ...(arbitre ? [{ type: 'action', id: OUVRE_LE_CHANGEMENT }] : []),
      ...melange.slice(0, arbitre ? 4 : 5).map((a) => ({ type: 'action', id: a.id })),
      { type: 'scarves', amount: 80 + Math.floor(Math.random() * 40) },
    ];
  }

  async function openWelcome(userId, teamId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[w]] = await conn.query(
        `SELECT onboarded_at FROM user_wallet WHERE user_id = ? FOR UPDATE`, [userId]);
      if (w?.onboarded_at) throw fail('onboarding.error.already_done');

      const cartes = tirerBienvenue();
      let scarves = 0;
      const actions = [];

      for (const c of cartes) {
        if (c.type === 'fanzzy') {
          await conn.query(
            `INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE copies = copies + 1`, [userId, c.id]);
          // Le skin de base vient avec le Fanzzy, toujours.
          await conn.query(
            `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id, equipped)
             VALUES (?, ?, 1, 'base', 1)`, [userId, c.id]);
        } else if (c.type === 'stuff') {
          await conn.query(
            `INSERT INTO user_stuff (user_id, stuff_id, copies, slot) VALUES (?, ?, 1, 1)
             ON DUPLICATE KEY UPDATE copies = copies + 1`, [userId, c.id]);
        } else if (c.type === 'action') {
          actions.push(c.id);
        } else {
          scarves += c.amount;
        }
      }

      const premier = cartes.find((c) => c.type === 'fanzzy' && parIdentifiant(c.id).rar !== 'commune')
        ?? cartes.find((c) => c.type === 'fanzzy');

      await conn.query(
        `UPDATE user_wallet
            SET onboarded_at = NOW(3), scarves = scarves + ?,
                active_fanzzy = COALESCE(active_fanzzy, ?),
                action_cards = ?
          WHERE user_id = ?`,
        [scarves, premier.id, JSON.stringify(actions), userId]);

      await conn.commit();
      /* ------------------------------------ la tribune de départ

         Le joueur sortait d'ici avec des cartes, un avatar — et **un deck
         vide**. Or le premier écran qu'il croise ensuite lui propose d'entrer
         en duel : il y arrivait sans personne sur la corde, et devait monter
         une tribune avant d'avoir compris ce qu'était une tribune.

         Le Fanzzy qu'on vient de lui donner devient donc son titulaire, avec
         dix cartes d'action prises dans ce qu'il possède. C'est un point de
         départ jouable, qu'il remaniera à l'écran de deck.

         **Hors transaction, et sans faire échouer l'ouverture.** Le paquet est
         écrit et validé ; perdre cinq cartes parce qu'un deck de commodité n'a
         pas pu s'enregistrer serait absurde. Voir `premierDeck`, qui ne touche
         à rien si un deck existe déjà. */
      try { await module.decks?.premierDeck(userId, premier.id); }
      catch { /* il montera sa tribune lui-même. */ }


      /* **Le paquet dit ce qu'il contient, pas seulement ses références.**
         Il ne rendait que `{ type, id }` : la page n'avait aucun moyen de
         nommer un Fanzzy, et affichait « TR1 » en gros au moment exact où le
         joueur découvre son premier supporter. Le nom vient du catalogue, que
         le serveur a déjà en mémoire — l'envoyer coûte trois mots par carte,
         et lui éviter une requête de plus en vaut cent. */
      const nommees = cartes.map((c) => {
        if (c.type !== 'fanzzy') return c;
        const f = parIdentifiant(c.id);
        return { ...c, nom: f?.nom ?? c.id, set: f?.set ?? null, rar: f?.rar ?? null };
      });

      return { cartes: nommees, scarves, activeFanzzy: premier.id };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /* ----------------------------------------------------------- porté */

  async function equip(userId, stuffId, slot) {
    if (![1, 2].includes(Number(slot))) throw fail('onboarding.error.bad_slot');
    const owned = await q(
      `SELECT 1 FROM user_stuff WHERE user_id = ? AND stuff_id = ?`, [userId, stuffId]);
    if (!owned.length) throw fail('onboarding.error.not_owned');
    // Un seul objet par emplacement, et un objet ne se porte qu'une fois.
    await q(`UPDATE user_stuff SET slot = NULL WHERE user_id = ? AND (slot = ? OR stuff_id = ?)`,
      [userId, slot, stuffId]);
    await q(`UPDATE user_stuff SET slot = ? WHERE user_id = ? AND stuff_id = ?`,
      [slot, userId, stuffId]);
    return { stuffId, slot: Number(slot) };
  }

  async function unequip(userId, stuffId) {
    await q(`UPDATE user_stuff SET slot = NULL WHERE user_id = ? AND stuff_id = ?`,
      [userId, stuffId]);
  }

  /**
   * Porter une tenue.
   *
   * ## Ce que l'abonnement ouvre ici
   *
   * Une tenue est **purement décorative** : elle n'entre dans aucun
   * modificateur, et le duel ne la lit jamais. C'est donc exactement ce qu'un
   * abonnement peut vendre sans toucher à l'équilibre — de l'identité, pas de
   * la puissance.
   *
   * Un abonné peut porter n'importe quelle tenue **publiée** ; un joueur
   * inscrit ne porte que celles qu'il a gagnées.
   *
   * ## Et il la garde
   *
   * La tenue prise pendant l'abonnement s'inscrit dans `user_skins` comme une
   * autre : elle reste à lui quand l'abonnement s'arrête. C'est la règle que ce
   * jeu s'est déjà donnée ailleurs — « fermer, c'est cesser de distribuer », une
   * série qu'on referme n'efface pas les cartes de qui les possède. Reprendre
   * une tenue qu'on a vue sur son personnage serait la seule chose qu'un
   * collectionneur ne pardonne pas.
   *
   * Ce qui s'arrête à l'échéance est donc le droit d'en prendre de nouvelles,
   * et non celles qu'on porte.
   */
  async function wearSkin(userId, fanzzyId, skinId, stade = null) {
    const s = stade ?? Number((await q(
      `SELECT stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`,
      [userId, fanzzyId]))[0]?.stage ?? 1);

    const owned = await q(
      `SELECT 1 FROM user_skins
        WHERE user_id = ? AND fanzzy_id = ? AND stage = ? AND skin_id = ?`,
      [userId, fanzzyId, s, skinId]);

    if (!owned.length) {
      /* Non possédée. Un abonné la prend si elle est publiée ; les autres
         reçoivent le refus d'avant, mot pour mot. */
      const abonne = module.abonnement ? await module.abonnement.estAbonne(userId) : false;
      const publiee = abonne && tenuesPubliees().some((t) => t.id === skinId);
      if (!publiee) throw fail('onboarding.error.not_owned');
      /* Le personnage doit quand même être à lui : une tenue se porte sur
         quelqu'un, et l'abonnement n'offre pas les Fanzzy. */
      const sien = await q(
        `SELECT 1 FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`, [userId, fanzzyId]);
      if (!sien.length) throw fail('onboarding.error.not_owned');
      await q(
        `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id, equipped)
         VALUES (?, ?, ?, ?, 0)`, [userId, fanzzyId, s, skinId]);
    }

    await q(`UPDATE user_skins SET equipped = 0
              WHERE user_id = ? AND fanzzy_id = ? AND stage = ?`,
      [userId, fanzzyId, s]);
    await q(`UPDATE user_skins SET equipped = 1
              WHERE user_id = ? AND fanzzy_id = ? AND stage = ? AND skin_id = ?`,
      [userId, fanzzyId, s, skinId]);
  }

  /**
   * Les modificateurs réellement en jeu : ceux du Fanzzy équipé, combinés aux
   * deux pièces portées. Le skin n'intervient pas, par construction.
   */
  async function loadout(userId) {
    /* L'âge atteint vient avec : une tenue appartient à un âge, et sans lui
       la requête d'en dessous ne savait pas laquelle chercher. */
    const w = (await q(
      `SELECT w.active_fanzzy, w.active_evo, uf.stage AS atteint
         FROM user_wallet w
         LEFT JOIN user_fanzzy uf
           ON uf.user_id = w.user_id AND uf.fanzzy_id = w.active_fanzzy
        WHERE w.user_id = ?`, [userId]))[0];
    const f = w?.active_fanzzy ? parIdentifiant(w.active_fanzzy) : null;
    const portes = await q(
      `SELECT stuff_id FROM user_stuff WHERE user_id = ? AND slot IS NOT NULL ORDER BY slot`,
      [userId]);
    /* **`stage` manquait à cette requête.** Depuis que les tenues appartiennent
       à un âge, un joueur peut en porter trois — une par âge — et sans la
       condition de stade, `[0]` en prenait une au hasard. Le duel habillait
       donc parfois le Capo avec le déguisement du gamin, et rien ne le disait :
       le dessin existe, il est juste celui de quelqu'un d'autre. */
    const skin = (await q(
      `SELECT skin_id FROM user_skins
        WHERE user_id = ? AND fanzzy_id = ? AND stage = ? AND equipped = 1 LIMIT 1`,
      [userId, w?.active_fanzzy ?? '', stadeAffiche(w?.atteint, w?.active_evo)
      ]))[0]?.skin_id ?? 'base';

    return {
      fanzzy: f ? { id: f.id, nom: f.nom, type: f.type, cri: f.cri } : null,
      skin,
      stuff: portes.map((p) => p.stuff_id),
      mods: f ? { id: f.id, ...combine(f.mods, portes.map((p) => p.stuff_id)) } : {},
    };
  }

  /* ---------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (!res.headersSent) res.status(400).json({ error: e.code ?? 'onboarding.error.server' });
  });

  router.get('/catalogue', (_req, res) => {
    res.set('cache-control', 'public, max-age=3600');
    res.json({ skins: toutesTenues(), stuff: STUFF, actions: ACTIONS, prixSlots: PRIX_SLOT });
  });

  router.get('/state', requireAuth, safe(async (req, res) =>
    res.json(await state(req.user.id))));

  router.get('/loadout', requireAuth, safe(async (req, res) =>
    res.json(await loadout(req.user.id))));

  router.post('/follow', requireAuth, safe(async (req, res) => {
    await follow(req.user.id, Number(req.body?.teamId), { main: Boolean(req.body?.main) });
    res.json(await state(req.user.id));
  }));

  router.delete('/follow/:teamId', requireAuth, safe(async (req, res) => {
    await q(`DELETE FROM user_follows WHERE user_id = ? AND team_id = ?`,
      [req.user.id, Number(req.params.teamId)]);
    res.json(await state(req.user.id));
  }));

  router.post('/slot', requireAuth, safe(async (req, res) =>
    res.json(await buySlot(req.user.id))));

  router.post('/welcome', requireAuth, safe(async (req, res) => {
    const teamId = Number(req.body?.teamId);
    if (Number.isInteger(teamId)) await follow(req.user.id, teamId, { main: true });
    res.json(await openWelcome(req.user.id, teamId));
  }));

  router.post('/equip', requireAuth, safe(async (req, res) =>
    res.json(await equip(req.user.id, String(req.body?.stuffId), req.body?.slot))));

  router.post('/unequip', requireAuth, safe(async (req, res) => {
    await unequip(req.user.id, String(req.body?.stuffId));
    res.json(await state(req.user.id));
  }));

  router.post('/skin', requireAuth, safe(async (req, res) => {
    await wearSkin(req.user.id, String(req.body?.fanzzyId), String(req.body?.skinId));
    res.json({ ok: true });
  }));

  // `module` porte la référence rebranchée par server.js : c'est le même objet
  // qui est renvoyé, sinon le rebranchement ne toucherait rien.
  return Object.assign(module,
    { router, state, follow, buySlot, openWelcome, equip, wearSkin, loadout });
}
