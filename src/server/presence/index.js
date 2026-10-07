import express from 'express';
import { reglage } from '../../shared/reglages.js';
import { assurerBourse } from '../bourse.js';

/**
 * La présence : qui, parmi mes amis, est en ligne, au Virage ou en duel.
 *
 * C'est la donnée la plus sensible du jeu (`serveur/RISQUES.md`, V3), pour un
 * public qui compte des mineurs et que rien ne filtre à l'entrée (L5). Tout
 * ce module est donc écrit à partir de ce qu'il **ne** fait **pas** — c'est la
 * décision de Gaël du 3 octobre 2026 (Q2), et `CONTRATS.md`, § 18 :
 *
 *   — **rien n'est écrit en base.** L'activité est une marque en mémoire, qui
 *     disparaît au redémarrage ; les états « au Virage » et « en duel » se
 *     lisent dans ce que les deux arènes tiennent déjà en mémoire. Seul le
 *     choix de se cacher s'écrit (`user_wallet.presence`), parce qu'un choix
 *     qui s'oublierait au redémarrage montrerait quelqu'un qui avait demandé à
 *     ne plus l'être ;
 *   — **trois états grossiers, et un seul à la fois** : `virage`, `duel`,
 *     `en_ligne`. Jamais le match, jamais une heure, jamais « vu il y a ». Dire
 *     *quel* match on pousse, c'est la phrase que le module des amis refuse
 *     depuis le début : « je sais où tu vas le week-end » ;
 *   — **les amis mutuels seulement** (`amities.etat = 'amis'`) : une amitié
 *     acceptée est déjà un double consentement. Jamais une demande en attente,
 *     un refus, un inconnu, un compte supprimé ;
 *   — **chacun peut se cacher** (« apparaître hors ligne ») : caché, on
 *     n'apparaît chez personne, et l'on voit ses amis comme avant ;
 *   — **livrée éteinte** : tant que `presence.actif` est faux, rien n'est
 *     servi, rien n'est gardé, et `/api/presence` répond `{ actif: false }`
 *     pour que le tiroir ne dessine pas l'interrupteur. On l'allume après la
 *     mise en ligne de la politique de confidentialité
 *     (`public/confidentialite.html`, à `/confidentialite`), pas avant.
 *
 * ## Qui lit quoi
 *
 * `amis/index.js` demande les états de la liste qu'il vient de lire
 * (`etatsPour`) ; le Virage demande, à chaque entrée, quels amis sont dans la
 * salle (`amisPresents`, pour « 2 AMIS ICI ») et à qui annoncer l'arrivée
 * (`aPrevenir`) ; le tiroir lit et pose l'interrupteur (`/api/presence`).
 * Aucune page ne reçoit de socket de plus pour ça (P6) : la tribune a déjà la
 * sienne, et la liste d'amis est une lecture qu'on fait de toute façon.
 *
 * ## Ce que ça coûte
 *
 * Les amis mutuels d'un joueur et leurs choix se lisent **en une requête**,
 * gardée deux minutes : au coup d'envoi, mille entrées dans une tribune ne
 * paient pas mille lectures pour des amis qui ne changent pas d'avis toutes
 * les secondes. Ce qui changerait la réponse avant ces deux minutes — une
 * amitié acceptée ou retirée, un joueur qui se cache — vide la mémoire
 * concernée tout de suite : le choix de se cacher vaut **dès la lecture
 * suivante** (`CONTRATS.md`, § 18.2).
 */

/** Les trois états servis, du plus précis au plus vague : le premier vrai part. */
export const ETATS = ['virage', 'duel', 'en_ligne'];

/**
 * Combien de temps les amis mutuels et les choix de présence restent en
 * mémoire. Deux minutes, celles du plan (`SERVEUR-VAGUE2.md`, § 6.4) : assez
 * pour qu'un coup d'envoi ne relise pas mille fois la même liste, trop court
 * pour qu'une amitié défaite par un autre chemin que ce module (une
 * suppression de compte) se voie longtemps.
 */
export const GARDE_MS = 2 * 60_000;

/**
 * Combien de temps une colonne absente éteint la présence avant qu'on
 * réessaie : dix minutes, le délai des autres replis du serveur. Assez pour ne
 * pas relancer une requête vouée à l'échec à chaque lecture ; assez court pour
 * que `schema:appliquer` suffise, sans redémarrer.
 */
const REPLI_MS = 10 * 60_000;

/**
 * @param {object} o
 * @param {import('mysql2/promise').Pool} o.pool
 * @param {Function} o.requireAuth
 * @param {() => number} [o.horloge]  l'heure, en millisecondes. Les suites la
 *   remplacent pour avancer de deux minutes sans les attendre.
 * @param {Console} [o.log]
 */
export function createPresence({ pool, requireAuth, horloge = Date.now, log = console }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /* ------------------------------------------------------------ la mémoire */

  /** Joueur → instant de sa dernière activité. La seule « présence » gardée. */
  const activite = new Map();
  /** Joueur → { ids: Set de ses amis mutuels, t: lu à }. */
  const amisDe = new Map();
  /** Lectures d'amis en vol : dix entrées simultanées font une requête, pas dix. */
  const amisEnVol = new Map();
  /**
   * Joueur → { v: 1 | 0 | null, t, tour }. `v` est la colonne telle quelle :
   * `null` veut dire « le défaut du registre », et le défaut se lit **à
   * chaque fois**, jamais gardé ici — Gaël le change depuis `/admin`, et
   * l'effet doit être immédiat pour tous ceux qui n'ont pas choisi.
   */
  const choix = new Map();
  const choixEnVol = new Map();
  /**
   * Un compteur qui monte à chaque choix posé. Une lecture d'amis partie
   * **avant** un choix ne doit pas le recouvrir en revenant après lui avec
   * l'ancienne valeur : elle ne recopie que les choix plus vieux qu'elle.
   */
  let tour = 0;
  /**
   * Une amitié change pendant qu'une lecture est en vol : cette lecture ne
   * doit pas être gardée deux minutes. Chaque joueur a un numéro de version
   * de sa liste, que `oublierAmis` fait monter.
   */
  const versionAmis = new Map();

  let menageA = 0;
  /** Jusqu'à quand la colonne `user_wallet.presence` est tenue pour absente. */
  let sansColonneJusqua = 0;
  let sansColonneDit = false;

  /** Ce que les deux arènes savent : posé après coup, elles se montent après. */
  const sources = { estAuVirage: null, estEnDuel: null };
  const pannesDites = new Set();

  /**
   * La présence est-elle servie, maintenant ?
   *
   * Le réglage se relit **à chaque appel** : l'éteindre depuis `/admin` doit
   * couper la présence à la requête suivante, sans redémarrer.
   *
   * **Sans la colonne du choix, elle s'éteint aussi**, et c'est un choix de
   * prudence plutôt qu'un repli commode. Sans `sql/arenes.sql`, personne ne
   * peut se cacher : servir la présence quand même, au défaut du registre,
   * montrerait des joueurs — des mineurs, souvent — à qui l'on a promis un
   * interrupteur qui ne marche pas. Le tiroir ne le dessine pas
   * (`{ actif: false }`), et le journal nomme le fichier.
   */
  function actif() {
    if (!reglage('presence.actif')) return false;
    return horloge() >= sansColonneJusqua;
  }

  /** Éteinte, on ne garde rien : pas même la marque d'activité d'hier. */
  function vider() {
    if (activite.size) activite.clear();
    if (amisDe.size) amisDe.clear();
    if (choix.size) choix.clear();
  }

  /** La colonne du choix manque : on éteint dix minutes, et on le dit une fois. */
  function colonneAbsente() {
    sansColonneJusqua = horloge() + REPLI_MS;
    vider();
    if (!sansColonneDit) {
      sansColonneDit = true;
      log.warn('[presence] colonne user_wallet.presence absente : la présence reste '
        + 'éteinte tant qu’on ne peut pas s’y cacher (applique sql/arenes.sql)');
    }
  }

  /**
   * Le ménage, au plus une fois par minute : les marques d'activité trop
   * vieilles pour dire « en ligne », et les lectures de plus de deux minutes.
   * Sans lui, la mémoire garderait la trace de chaque joueur passé depuis le
   * démarrage — ce qui ressemblerait beaucoup à un journal de connexions.
   */
  function menage(t) {
    menageA = t;
    const vieux = reglage('presence.en_ligne_sec') * 1000;
    for (const [id, vu] of activite) if (t - vu >= vieux) activite.delete(id);
    for (const [id, c] of amisDe) if (t - c.t >= GARDE_MS) amisDe.delete(id);
    for (const [id, c] of choix) if (t - c.t >= GARDE_MS) choix.delete(id);
  }

  /* ------------------------------------------------------------- l'activité */

  /**
   * Une activité : une requête `/api` sous session, une socket qui se
   * connecte. **Mémoire seule, aucune écriture** — c'est le cœur de la
   * promesse, et `presence-smoke` compte les instructions pour le vérifier.
   *
   * Éteinte, elle ne note rien : on ne prépare pas en silence une donnée
   * qu'on n'a pas encore le droit de montrer.
   */
  function noter(userId) {
    if (!userId) return;
    if (!actif()) { vider(); return; }
    const t = horloge();
    activite.set(String(userId), t);
    if (t - menageA >= 60_000) menage(t);
  }

  /**
   * Branche ce que savent les arènes, une fois qu'elles sont montées
   * (`server.js` les construit après ce module).
   *
   * Une source absente n'empêche rien — l'état correspondant n'est
   * simplement jamais servi —, mais elle se dit au journal : c'est exactement
   * la panne muette que `scripts/verif-cablage.mjs` surveille.
   */
  function brancher({ estAuVirage = null, estEnDuel = null } = {}) {
    sources.estAuVirage = typeof estAuVirage === 'function' ? estAuVirage : null;
    sources.estEnDuel = typeof estEnDuel === 'function' ? estEnDuel : null;
    if (!sources.estAuVirage) log.warn('[presence] Virage non branché : « au Virage » ne sera jamais servi');
    if (!sources.estEnDuel) log.warn('[presence] duel non branché : « en duel » ne sera jamais servi');
  }

  /**
   * Une source répond-elle vrai ?
   *
   * **Après `await`**, toujours : une source qui rendrait une promesse serait
   * « vraie » pour un simple `if` — une promesse est un objet —, et tout le
   * monde serait au Virage. Synchrone ou non, c'est sa réponse qui compte.
   * Une source qui lève ne fait pas tomber la liste d'amis : l'état n'est pas
   * servi, et le journal le dit une fois.
   */
  async function vrai(nom, userId) {
    const fn = sources[nom];
    if (!fn) return false;
    try {
      return Boolean(await fn(userId));
    } catch (e) {
      if (!pannesDites.has(nom)) {
        pannesDites.add(nom);
        log.error(`[presence] ${nom} a levé :`, e?.message ?? e);
      }
      return false;
    }
  }

  /** L'état d'un joueur, sans regarder qui le demande : `virage`, `duel`, `en_ligne` ou `null`. */
  async function etatDe(userId) {
    if (await vrai('estAuVirage', userId)) return 'virage';
    if (await vrai('estEnDuel', userId)) return 'duel';
    const vu = activite.get(userId);
    /* « Depuis moins de » : strictement. À `en_ligne_sec` secondes pile, on
       n'est plus en ligne — la borne est écrite, on la tient. */
    if (vu !== undefined && horloge() - vu < reglage('presence.en_ligne_sec') * 1000) {
      return 'en_ligne';
    }
    return null;
  }

  /* --------------------------------------------- les amis, et leurs choix */

  /**
   * Garde le choix lu par une requête partie au `tour` donné, sauf si un
   * choix plus récent a été posé entre-temps.
   */
  function retenirChoix(id, v, t, depuisTour) {
    const deja = choix.get(id);
    if (deja && deja.tour > depuisTour) return;
    choix.set(id, { v: v === undefined ? null : v, t, tour: depuisTour });
  }

  /**
   * Les amis mutuels d'un joueur, comptes actifs seulement, et le choix de
   * chacun dans la même lecture.
   *
   * Lue une fois pour deux minutes, et partagée par toutes les demandes qui
   * arrivent pendant qu'elle est en vol.
   */
  async function amisMutuels(userId) {
    const id = String(userId);
    const t = horloge();
    const garde = amisDe.get(id);
    if (garde && t - garde.t < GARDE_MS) return garde.ids;
    if (amisEnVol.has(id)) return amisEnVol.get(id);

    const depuisTour = tour;
    const version = versionAmis.get(id) ?? 0;
    const p = (async () => {
      let lignes;
      try {
        lignes = await q(
          `SELECT u.public_id AS id, w.presence AS choix
             FROM amities am
             JOIN users u ON u.public_id = IF(am.a = ?, am.b, am.a)
             LEFT JOIN user_wallet w ON w.user_id = u.public_id
            WHERE (am.a = ? OR am.b = ?) AND am.etat = 'amis' AND u.status = 'active'`,
          [id, id, id]);
      } catch (e) {
        if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
        colonneAbsente();
        return new Set();
      }
      const ids = new Set(lignes.map((l) => String(l.id)));
      for (const l of lignes) retenirChoix(String(l.id), l.choix, t, depuisTour);
      /* Une amitié a changé pendant la lecture : la réponse sert à ceux qui
         l'attendaient déjà, mais on ne la garde pas. */
      if ((versionAmis.get(id) ?? 0) === version) amisDe.set(id, { ids, t });
      return ids;
    /* Ne retirer que **sa propre** place : `oublierAmis` a pu la vider
       pendant le vol, et une lecture neuve s'y être assise. L'effacer en
       finissant ferait partir une troisième lecture au lieu de rejoindre
       celle qui est déjà en route. */
    })().finally(() => { if (amisEnVol.get(id) === p) amisEnVol.delete(id); });
    amisEnVol.set(id, p);
    return p;
  }

  /**
   * Oublie les amis gardés de ces joueurs : une amitié vient d'être acceptée,
   * refusée ou retirée entre eux. Appelé par `amis/index.js`. Sans lui, un ami
   * retiré verrait encore où l'on est pendant deux minutes.
   */
  function oublierAmis(...ids) {
    for (const brut of ids) {
      if (!brut) continue;
      const id = String(brut);
      amisDe.delete(id);
      amisEnVol.delete(id);
      versionAmis.set(id, (versionAmis.get(id) ?? 0) + 1);
    }
  }

  /** Le choix brut d'un joueur (`1`, `0` ou `null`), gardé deux minutes. */
  async function choixDe(userId) {
    const id = String(userId);
    const t = horloge();
    const garde = choix.get(id);
    if (garde && t - garde.t < GARDE_MS) return garde.v;
    if (choixEnVol.has(id)) return choixEnVol.get(id);

    const depuisTour = tour;
    const p = (async () => {
      let v = null;
      try {
        const l = (await q('SELECT presence AS choix FROM user_wallet WHERE user_id = ?', [id]))[0];
        v = l?.choix ?? null;
      } catch (e) {
        if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
        colonneAbsente();
        return null;
      }
      retenirChoix(id, v, t, depuisTour);
      return choix.get(id)?.v ?? v;
    })().finally(() => choixEnVol.delete(id));
    choixEnVol.set(id, p);
    return p;
  }

  /**
   * Ce joueur se montre-t-il à ses amis ? Son choix, à défaut celui du
   * registre (`presence.visible_defaut`), relu à chaque appel.
   *
   * Faux quand la présence est éteinte : un module qui l'appellerait sans
   * regarder `actif()` d'abord ne doit pas pouvoir montrer quelqu'un.
   */
  async function visible(userId) {
    if (!userId || !actif()) return false;
    const v = await choixDe(userId);
    if (v === null || v === undefined) return Boolean(reglage('presence.visible_defaut'));
    return Number(v) === 1;
  }

  /* --------------------------------------------------- ce qui est servi */

  /**
   * L'état de chaque ami d'une liste, pour `GET /api/amis`.
   *
   * `amisIds` est ce que la liste vient de lire ; on ne s'y fie pas pour
   * autant : un identifiant qui n'est pas un ami mutuel du lecteur ne reçoit
   * rien, quel que soit l'appelant. Absent de la réponse veut dire hors ligne,
   * caché ou présence éteinte — l'écran ne distingue pas, et c'est voulu.
   *
   * Le lecteur peut être caché : il voit ses amis comme avant.
   *
   * @returns {Promise<Map<string, 'virage' | 'duel' | 'en_ligne'>>}
   */
  async function etatsPour(lecteurId, amisIds = []) {
    const etats = new Map();
    if (!actif()) { vider(); return etats; }
    if (!lecteurId) return etats;
    const mutuels = await amisMutuels(lecteurId);
    for (const brut of new Set(amisIds)) {
      const id = String(brut);
      if (id === String(lecteurId) || !mutuels.has(id)) continue;
      if (!(await visible(id))) continue;
      const e = await etatDe(id);
      if (e) etats.set(id, e);
    }
    return etats;
  }

  /**
   * Ses amis mutuels **visibles** parmi ceux d'une salle : ce que la tribune
   * annonce à l'entrant (« 2 AMIS ICI », `virage:amis`). Un joueur caché
   * reçoit quand même les siens. Rien quand la présence est éteinte.
   *
   * @param {string} userId  l'entrant
   * @param {Iterable<string>} idsDansLaSalle
   * @returns {Promise<Array<{ id: string }>>}
   */
  async function amisPresents(userId, idsDansLaSalle = []) {
    if (!userId || !actif()) return [];
    const mutuels = await amisMutuels(userId);
    const presents = [];
    for (const brut of new Set(idsDansLaSalle)) {
      const id = String(brut);
      if (id === String(userId) || !mutuels.has(id)) continue;
      if (await visible(id)) presents.push({ id });
    }
    return presents;
  }

  /**
   * À qui, dans une salle, annoncer qu'un joueur entre ou s'en va
   * (`virage:ami`) : **tous** ses amis mutuels présents, cachés compris —
   * un joueur caché voit ses amis comme avant —, et personne si c'est lui qui
   * est caché, ou si la présence est éteinte.
   *
   * Elle existe à côté d'`amisPresents` parce que les deux listes diffèrent
   * exactement là où la règle se joue : la première filtre sur la visibilité
   * des amis, celle-ci sur celle de l'entrant.
   *
   * **Les amis d'abord, le choix de l'entrant ensuite, et seulement s'il y a
   * quelqu'un à prévenir.** La tribune appelle `amisPresents` puis celle-ci à
   * chaque entrée : la liste de ses amis est déjà en mémoire, et dans le cas
   * courant — aucun ami dans la salle — l'entrée ne coûte que cette lecture-là,
   * pas une seconde pour son propre choix. Au coup d'envoi, mille entrées
   * paient mille lectures de moins.
   *
   * @returns {Promise<Array<{ id: string }>>}
   */
  async function aPrevenir(userId, idsDansLaSalle = []) {
    if (!userId || !actif()) return [];
    const mutuels = await amisMutuels(userId);
    const ici = [...new Set(idsDansLaSalle)].map(String)
      .filter((id) => id !== String(userId) && mutuels.has(id));
    if (!ici.length) return [];
    if (!(await visible(userId))) return [];
    return ici.map((id) => ({ id }));
  }

  /* ---------------------------------------------------------------- route */

  const router = express.Router();
  router.use(express.json({ limit: '1kb' }));

  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (res.headersSent) return;
    log.error('[presence]', e?.message ?? e);
    /* 503 : le tiroir lit une panne comme une absence (R2), et ne dessine pas
       l'interrupteur plutôt que d'en montrer un qui ment. */
    res.status(503).json({ error: 'presence.error.server' });
  });

  /** Exactement `{ "visible": <booléen> }`, et rien d'autre. */
  const corpsExact = (b) => b !== null && typeof b === 'object' && !Array.isArray(b)
    && Object.keys(b).length === 1 && typeof b.visible === 'boolean';

  router.get('/', requireAuth, safe(async (req, res) => {
    res.set('cache-control', 'no-store');
    if (!actif()) { vider(); return res.json({ actif: false }); }
    const v = await visible(req.user.id);
    /* Relu après : une colonne découverte absente pendant la lecture éteint. */
    if (!actif()) return res.json({ actif: false });
    res.json({ actif: true, visible: v });
  }));

  /**
   * L'interrupteur « apparaître hors ligne ».
   *
   * Le corps se juge **avant** l'état de la présence : une requête mal formée
   * l'est, allumée ou non. Éteinte, rien ne s'écrit — l'interrupteur n'est
   * pas dessiné, et un choix posé en douce attendrait l'allumage pour
   * surprendre son auteur.
   *
   * Le choix vaut **tout de suite** : la mémoire de ce joueur est remplacée
   * par sa nouvelle valeur, et `GET /api/amis` de ses amis le lit à la requête
   * suivante. Ceux qui l'ont déjà vu entrer dans une tribune ne reçoivent rien
   * de plus (`CONTRATS.md`, § 18.2).
   */
  router.post('/', requireAuth, safe(async (req, res) => {
    res.set('cache-control', 'no-store');
    if (!corpsExact(req.body)) return res.status(400).json({ error: 'presence.error.requete' });
    if (!actif()) { vider(); return res.json({ actif: false }); }

    const id = String(req.user.id);
    const v = req.body.visible ? 1 : 0;
    /* La bourse d'abord, par la règle commune (`bourse.js`) : un compte sans
       ligne de bourse doit pouvoir se cacher aussi — un choix de se cacher
       qui ne s'écrit pas, c'est la pire panne de ce module. */
    await assurerBourse(q, id);
    try {
      await q('UPDATE user_wallet SET presence = ? WHERE user_id = ?', [v, id]);
    } catch (e) {
      if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
      colonneAbsente();
      return res.json({ actif: false });
    }
    tour += 1;
    choix.set(id, { v, t: horloge(), tour });
    res.json({ actif: true, visible: v === 1 });
  }));

  /* Un JSON illisible, trop long ou d'un autre type : la même réponse qu'un
     corps faux. Sans ce gestionnaire, Express rendrait sa page d'erreur en
     HTML, que le tiroir ne sait pas lire. Quatre paramètres, `_next`
     compris : c'est à leur nombre qu'Express reconnaît un gestionnaire
     d'erreur. */
  router.use((err, _req, res, _next) => {
    if (res.headersSent) return;
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large'
      || err?.status === 400 || err?.status === 413) {
      return res.status(400).json({ error: 'presence.error.requete' });
    }
    log.error('[presence]', err?.message ?? err);
    res.status(503).json({ error: 'presence.error.server' });
  });

  return { noter, brancher, etatsPour, amisPresents, aPrevenir, visible,
           oublierAmis, actif, router };
}
