import express from 'express';
// Les cartes viennent de la base ; les barèmes — séries, types, raretés, taux,
// coûts — restent du code, parce qu'ils décrivent les règles du jeu et non son
// contenu. On ne change pas un taux de tirage depuis un écran d'administration.
import { SETS, TYPES, RAR, RATES, SCARVES, EVO_COST } from '../../shared/fanzzy/dex.js';
import { tous, publies, parIdentifiant, obtenables, seriesOuvertes, serieOuverte,
  racineDe, lignee, auStade } from './catalogue.js';
import { SKINS, SKIN_BY_ID, STUFF, STUFF_BY_ID, combine } from '../../shared/fanzzy/inventaire.js';

/**
 * Collection Fanzzy, tenue par le serveur.
 *
 * Rien de tout ceci ne peut vivre dans le navigateur : le tirage d'un booster,
 * le solde d'écharpes et les évolutions décident de ce qu'un joueur possède, et
 * un joueur possède des choses qui s'achètent. Le client n'affiche que ce que
 * le serveur lui dit.
 */

export const MAX_PACKS = 12;
/**
 * Ce qu'un nouveau joueur trouve dans sa réserve.
 *
 * Trois, et non douze. Douze boosters d'un coup, c'est cinq minutes
 * d'ouverture frénétique puis plus rien à faire pendant deux heures — et
 * soixante cartes vues avant d'avoir compris ce qu'est un Fanzzy. Trois
 * laissent le temps de regarder, et la réserve se remplit ensuite d'elle-même
 * jusqu'à douze.
 */
export const PACKS_DEPART = 3;
export const PACK_REGEN_MS = 10 * 60 * 1000;
export const PACK_PRICE = 45;          // acheter un booster en écharpes

/**
 * Chance qu'une carte du booster soit un skin plutôt qu'un Fanzzy.
 *
 * Un skin ne tombe que pour un Fanzzy déjà possédé : sans le supporter, la
 * tenue n'a rien à habiller. Un joueur qui n'a encore rien reçoit donc des
 * Fanzzy, ce qui est exactement ce qu'il lui faut.
 */
const CHANCE_SKIN = 0.22;

const rnd = (a) => a[Math.floor(Math.random() * a.length)];

export function createFanzzy({ pool, requireAuth }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /* -------------------------------------------------------- portefeuille */

  /**
   * Recharge les boosters au prorata du temps écoulé, puis renvoie l'état.
   * Le calcul se fait à la lecture plutôt qu'avec une tâche périodique :
   * pas de minuterie à maintenir, et le résultat est le même.
   */
  async function wallet(userId) {
    await q(
      `INSERT IGNORE INTO user_wallet (user_id, scarves, packs) VALUES (?, 0, ?)`,
      [userId, PACKS_DEPART],
    );
    const w = (await q(
      `SELECT scarves, packs, packs_at, active_fanzzy FROM user_wallet WHERE user_id = ?`,
      [userId],
    ))[0];

    if (w.packs < MAX_PACKS) {
      const gained = Math.floor((Date.now() - new Date(w.packs_at).getTime()) / PACK_REGEN_MS);
      if (gained > 0) {
        const packs = Math.min(MAX_PACKS, w.packs + gained);
        const at = new Date(new Date(w.packs_at).getTime() + gained * PACK_REGEN_MS);
        await q(`UPDATE user_wallet SET packs = ?, packs_at = ? WHERE user_id = ?`,
          [packs, at, userId]);
        w.packs = packs; w.packs_at = at;
      }
    } else {
      await q(`UPDATE user_wallet SET packs_at = NOW(3) WHERE user_id = ?`, [userId]);
      w.packs_at = new Date();
    }

    const nextIn = w.packs >= MAX_PACKS ? null
      : Math.max(0, PACK_REGEN_MS - (Date.now() - new Date(w.packs_at).getTime()));
    return { scarves: w.scarves, packs: w.packs, nextPackInMs: nextIn, active: w.active_fanzzy };
  }

  async function collection(userId) {
    const rows = await q(`SELECT fanzzy_id, copies FROM user_fanzzy WHERE user_id = ?`, [userId]);
    return Object.fromEntries(rows.map((r) => [r.fanzzy_id, r.copies]));
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
   * Cinq cartes d'une série. Les trois premières sont communes.
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
    return Array.from({ length: 5 }, (_, i) => {
      const vise = i < 3 ? 'commune' : pickRarity(i + 1);
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
          [MAX_PACKS, userId]);
      } else if (buy) {
        const [d] = await conn.query(
          `UPDATE user_wallet SET scarves = scarves - ? WHERE user_id = ? AND scarves >= ?`,
          [PACK_PRICE, userId, PACK_PRICE]);
        if (!d.affectedRows) throw fail('fanzzy.error.not_enough_scarves');
      } else {
        throw fail('fanzzy.error.no_packs');
      }

      const pull = drawPack(setId);

      const [owned] = await conn.query(
        `SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?`, [userId]);
      const had = new Set(owned.map((o) => o.fanzzy_id));
      const [skinsOwned] = await conn.query(
        `SELECT fanzzy_id, skin_id FROM user_skins WHERE user_id = ?`, [userId]);
      const skinsPris = new Set(skinsOwned.map((s) => `${s.fanzzy_id}:${s.skin_id}`));

      // Photographie de la collection avant ouverture : un skin ne peut pas
      // habiller un supporter reçu dans le même paquet. Le joueur n'a pas
      // encore eu le temps de le regarder.
      const avant = new Set(had);

      let scarves = 0;
      const cards = [];

      for (const [i, f] of pull.entries()) {
        // Les trois premières places restent des supporters : c'est la
        // garantie qui empêche une ouverture entièrement décevante.
        const candidats = i < 3 ? [] : [...avant].filter((id) =>
          SKINS.some((sk) => sk.id !== 'base' && !skinsPris.has(`${id}:${sk.id}`)));

        if (candidats.length && Math.random() < CHANCE_SKIN) {
          const pour = rnd(candidats);
          const libres = SKINS.filter((sk) => sk.id !== 'base' && !skinsPris.has(`${pour}:${sk.id}`));
          const skin = rnd(libres);
          skinsPris.add(`${pour}:${skin.id}`);
          await conn.query(
            `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, skin_id) VALUES (?, ?, ?)`,
            [userId, pour, skin.id]);
          cards.push({ type: 'skin', id: skin.id, pour, new: true });
          continue;
        }

        const isNew = !had.has(f.id);
        if (isNew) had.add(f.id); else scarves += SCARVES[f.rar];
        cards.push({ type: 'fanzzy', id: f.id, new: isNew });
        await conn.query(
          `INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE copies = copies + 1`,
          [userId, f.id]);
        // Le skin de base accompagne toujours le supporter.
        await conn.query(
          `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, skin_id, equipped)
           VALUES (?, ?, 'base', 1)`,
          [userId, f.id]);
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
      return { cards, scarvesGained: scarves };
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
    // enregistré avant le repliage désigne encore « V2 ».
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
      // `ouverte` porte l'information ; le kiosque n'affiche que celles-là, et
      // la progression ne se compte que sur elles.
      sets: SETS.map((s) => ({ ...s, ouverte: serieOuverte(s.id) })),
      // Ce qu'un joueur peut encore obtenir. La page pourrait le recalculer,
      // mais elle le recalculerait *mal* le jour où la règle se nuance — et
      // c'est précisément le genre de copie que ce projet a déjà payé.
      aCollectionner: obtenables().length,
      seriesOuvertes: ouvertes,
      types: TYPES, scarves: SCARVES, evoCost: EVO_COST, rar: RAR, rates: RATES,
    });
  });

  router.get('/state', requireAuth, (req, res) =>
    send(res, Promise.all([wallet(req.user.id), collection(req.user.id), stades(req.user.id)])
      .then(([w, col, st]) => ({ wallet: w, collection: col, stades: st,
        maxPacks: MAX_PACKS, packPrice: PACK_PRICE }))));

  router.post('/open', requireAuth, (req, res) =>
    send(res, openPack(req.user.id, String(req.body?.set ?? 'VN'), { buy: Boolean(req.body?.buy) })
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
    res.json({ stuff: STUFF, skins: SKINS });
  });

  router.post('/active', requireAuth, (req, res) => send(res, (async () => {
    // On équipe un personnage, jamais un âge : c'est le même individu, et la
    // collection ne connaît que lui. Accepter « V2 » tel quel poserait dans la
    // bourse un identifiant introuvable au moment de le dessiner.
    const id = racineDe(String(req.body?.id ?? ''));
    if (!parIdentifiant(id)) throw fail('fanzzy.error.unknown');
    const owned = await q(`SELECT 1 FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`,
      [req.user.id, id]);
    if (!owned.length) throw fail('fanzzy.error.not_owned');
    await q(`UPDATE user_wallet SET active_fanzzy = ? WHERE user_id = ?`, [id, req.user.id]);
    return { active: id };
  })()));

  /**
   * Fiche complète d'un Fanzzy : ce qu'il est, ce que le joueur en possède,
   * ses tenues, sa lignée et l'effet réel de son équipement.
   *
   * Tout est assemblé côté serveur en une seule fois : la page n'a pas à
   * enchaîner cinq requêtes pour afficher une carte.
   */
  async function fiche(userId, fanzzyId) {
    // La fiche d'un âge supérieur est la fiche de son personnage : c'est le
    // même individu, et le joueur n'en possède qu'un.
    const id = racineDe(String(fanzzyId));
    const perso = parIdentifiant(id);
    if (!perso) return null;

    const [mien, skins, stuff, w] = await Promise.all([
      q(`SELECT copies, stage, first_at FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`,
        [userId, id]),
      q(`SELECT skin_id, equipped, got_at FROM user_skins WHERE user_id = ? AND fanzzy_id = ?`,
        [userId, id]),
      q(`SELECT stuff_id, copies, slot FROM user_stuff WHERE user_id = ?`, [userId]),
      q(`SELECT active_fanzzy FROM user_wallet WHERE user_id = ?`, [userId]),
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
        id, nom: f.nom, type: f.type, set: f.set, stage: stade, rar: f.rar,
        mods: f.mods, cri: f.cri, evo: f.evo ?? null,
        histoire: f.histoire ?? null,
      },
      possede: mien[0]?.copies ?? 0,
      stade,
      depuis: mien[0]?.first_at ?? null,
      equipe: w[0]?.active_fanzzy === id,
      skins: SKINS.map((sk) => {
        const m = skins.find((x) => x.skin_id === sk.id);
        return { ...sk, possede: Boolean(m), porte: Boolean(m?.equipped),
                 depuis: m?.got_at ?? null };
      }),
      // `possede` par âge veut dire « atteint », pas « détenu à part ». Un âge
      // au-delà du stade actuel se lit donc comme un objectif chiffré, ce qui
      // est exactement ce que la page en fait.
      lignee: ages.map((x, i) => ({
        id: x.id, nom: x.nom, stage: i + 1, rar: x.rar,
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

  return { router, wallet, collection, stades, openPack, evolve, activeFanzzy, fiche };
}
