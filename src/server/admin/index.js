import express from 'express';
import { TYPES, RAR, SETS } from '../../shared/fanzzy/dex.js';
import { parIdentifiant, recharger, tous, chargerSeries, seriesOuvertes, serieOuverte }
  from '../fanzzy/catalogue.js';
import { toutesTenues, tenuePar, rechargerTenues } from '../fanzzy/tenues.js';
import { chargerSaisons, toutesLesSaisons, saisonEnCours } from '../fanzzy/saisons.js';
import { STUFF } from '../../shared/fanzzy/inventaire.js';
import { ACTIONS } from '../../shared/duel/actions.js';
import { STADES } from '../../shared/stades.js';
import { REGLAGES, SECTIONS, DEFAUTS } from '../../shared/reglages.js';
// Les gestes du jeu viennent de leur source unique : voir plus bas.
import { GESTES as GESTES_DU_JEU } from '../ferveur/gestures.js';
import { ecrireReglage, rendreAuDefaut, tousLesReglages } from '../reglages/index.js';
import { assurerBourse } from '../bourse.js';

/**
 * Administration.
 *
 * Trois principes qui ne se négocient pas :
 *
 * **Tout est tracé.** Chaque écriture passe par le journal d'audit, avec
 * l'auteur, la cible et le détail. Le jour où un compte est bloqué à tort ou
 * où dix mille écharpes apparaissent, la seule question qui compte est « qui,
 * quand, pourquoi » — et personne ne s'en souvient trois semaines après.
 *
 * **Un administrateur ne peut pas se retirer ses propres droits**, ni
 * supprimer son compte depuis cette interface. C'est le moyen le plus simple
 * de se retrouver avec une application sans personne pour l'administrer.
 *
 * **Rien ici ne lit un mot de passe.** Le module ne renvoie jamais de hachage,
 * et ne permet pas d'en fixer un : un administrateur qui peut choisir le mot
 * de passe d'un joueur peut se connecter à sa place.
 */

export function createAdmin({ pool, requireAuth, deps = {} }) {
  // Les dépendances d'exploitation (client API, salles du virage) sont
  // branchées après coup : elles n'existent pas encore au moment où ce module
  // est créé, et il ne doit pas les attendre pour fonctionner.
  const module = { deps };
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const fail = (code, status = 400) => Object.assign(new Error(code), { code, status });

  /* -------------------------------------------------------------- rôle */

  /** Promeut les adresses listées dans ADMIN_EMAILS. Résout l'amorçage. */
  async function amorcer(emails) {
    const liste = String(emails ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!liste.length) return 0;
    let n = 0;
    for (const email of liste) {
      const [r] = await pool.execute(
        `UPDATE users SET role = 'admin' WHERE email = ? AND role <> 'admin'`, [email]);
      if (r.affectedRows) {
        n++;
        await journal('systeme', 'admin.promu', email, { via: 'ADMIN_EMAILS' }, null);
      }
    }
    return n;
  }

  const estAdmin = async (userId) => {
    const r = await q(`SELECT role FROM users WHERE public_id = ?`, [userId]);
    return r[0]?.role === 'admin';
  };

  function requireAdmin(req, res, next) {
    requireAuth(req, res, async () => {
      if (!(await estAdmin(req.user.id))) {
        return res.status(403).json({ error: 'admin.error.forbidden' });
      }
      next();
    });
  }

  /* ------------------------------------------------------------- audit */

  async function journal(acteur, action, cible, detail, ip) {
    await q(
      `INSERT INTO admin_audit (acteur, action, cible, detail, ip) VALUES (?, ?, ?, ?, ?)`,
      [acteur, action, cible ?? null, JSON.stringify(detail ?? null), ip ?? null]);
  }

  const ip = (req) => (req.headers['x-forwarded-for']?.split(',')[0]
    ?? req.socket.remoteAddress ?? '').trim().slice(0, 45);

  /* ----------------------------------------------------------- aperçu */

  /**
   * MySQL renvoie les SUM() en chaînes de caractères, pas en nombres.
   * Un client qui compare ou additionne se casse dessus : on convertit ici,
   * une fois, plutôt que dans chaque page.
   */
  const nombres = (o) => Object.fromEntries(Object.entries(o ?? {})
    .map(([k, v]) => [k, v === null ? 0 : (typeof v === 'string' && /^-?\d+$/.test(v) ? Number(v) : v)]));

  async function apercu() {
    const [[u]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(status = 'active') AS actifs,
              SUM(role = 'admin') AS admins,
              SUM(email_verified_at IS NOT NULL) AS verifies,
              SUM(created_at > NOW(3) - INTERVAL 7 DAY) AS nouveaux
         FROM users`);
    const [[j]] = await pool.query(
      `SELECT COUNT(*) AS souvenirs,
              SUM(kind = 'presence') AS vecus FROM user_souvenirs`).catch(() => [[{}]]);
    const [[v]] = await pool.query(
      `SELECT COUNT(DISTINCT user_id) AS supporters, COALESCE(SUM(ferveur),0) AS ferveur
         FROM virage_presence`).catch(() => [[{}]]);
    const [[c]] = await pool.query(
      `SELECT COUNT(*) AS competitions, SUM(enabled = 1) AS activees
         FROM souvenir_leagues`).catch(() => [[{}]]);

    return {
      joueurs: nombres(u),
      jeu: nombres({ ...j, ...v }),
      competitions: nombres(c),
      quota: module.deps.client?.quota ?? null,
      virage: module.deps.virage ? [...module.deps.virage.rooms.values()].map((r) => ({
        fixtureId: r.fixture.id, foule: r.crowd(), corde: Math.round(r.rope),
      })) : [],
      mail: globalThis.mailer?.status ?? null,
    };
  }

  /* ---------------------------------------------------------- joueurs */

  /**
   * La liste des joueurs de l'administration.
   *
   * Elle dit **l'échéance de l'abonnement**, et non un simple oui/non :
   * « abonné jusqu'au 12 mars » se lit, « abonné : oui » demande une seconde
   * question. Une ligne sans échéance veut dire sans terme — un accès offert
   * par l'administration — et `abonne` sépare ce cas de « pas de ligne du
   * tout », que rien d'autre ne distinguerait.
   *
   * **L'abonnement se lit à part, et son absence ne casse rien.** Une
   * sous-requête dans le SELECT principal aurait éteint tout l'écran des
   * joueurs sur une base où `sql/abonnement.sql` n'est pas encore appliqué :
   * c'est la panne que ce projet a déjà payée le 8 septembre, un écran entier
   * perdu pour une colonne manquante. Une table absente veut dire « personne
   * n'est abonné », et l'administration reste utilisable.
   */
  async function joueurs({ q: terme = '', limite = 40, offset = 0 } = {}) {
    const where = terme ? `WHERE (u.pseudo LIKE ? OR u.email LIKE ?)` : '';
    const args = terme ? [`%${terme}%`, `%${terme}%`] : [];
    const lignes = await q(
      `SELECT u.public_id, u.pseudo, u.email, u.role, u.status, u.locale,
              u.email_verified_at, u.created_at, u.last_login_at,
              w.scarves, w.packs, w.follow_slots, w.onboarded_at,
              (SELECT COUNT(*) FROM user_fanzzy f WHERE f.user_id = u.public_id) AS fanzzy,
              (SELECT COALESCE(SUM(vp.ferveur),0) FROM virage_presence vp
                WHERE vp.user_id = u.public_id) AS ferveur
         FROM users u LEFT JOIN user_wallet w ON w.user_id = u.public_id
         ${where}
        ORDER BY u.created_at DESC
        LIMIT ${Number(limite) || 40} OFFSET ${Number(offset) || 0}`, args);

    if (!lignes.length) return lignes;
    let abos = new Map();
    try {
      const ids = lignes.map((l) => l.public_id);
      const rows = await q(
        `SELECT user_id, formule, fin, (fin IS NULL OR fin > NOW(3)) AS actif
           FROM abonnements WHERE user_id IN (${ids.map(() => '?').join(',')})`, ids);
      abos = new Map(rows.map((r) => [r.user_id, r]));
    } catch (e) {
      if (e?.code !== 'ER_NO_SUCH_TABLE') throw e;
    }
    return lignes.map((l) => {
      const a = abos.get(l.public_id);
      return { ...l,
        abonne: Boolean(a && Number(a.actif)),
        abo_fin: a?.fin ?? null,
        abo_formule: a?.formule ?? null };
    });
  }

  /**
   * Modifie un joueur. Chaque champ est traité séparément et journalisé :
   * une seule requête qui écrirait tout d'un bloc rendrait le journal illisible.
   */
  async function modifier(acteur, cibleId, champs, adresseIp) {
    const cible = (await q(`SELECT public_id, role, status FROM users WHERE public_id = ?`,
      [cibleId]))[0];
    if (!cible) throw fail('admin.error.unknown_user', 404);

    const fait = {};

    if (champs.status && ['active', 'locked'].includes(champs.status)) {
      if (cibleId === acteur) throw fail('admin.error.not_yourself');
      await q(`UPDATE users SET status = ? WHERE public_id = ?`, [champs.status, cibleId]);
      // Un compte bloqué doit perdre ses sessions immédiatement, sinon il
      // reste connecté jusqu'à expiration.
      if (champs.status === 'locked') {
        await q(`DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE public_id = ?)`,
          [cibleId]);
      }
      fait.status = champs.status;
    }

    if (champs.role && ['joueur', 'admin'].includes(champs.role)) {
      if (cibleId === acteur) throw fail('admin.error.not_yourself');
      await q(`UPDATE users SET role = ? WHERE public_id = ?`, [champs.role, cibleId]);
      fait.role = champs.role;
    }

    if (champs.verifier === true) {
      await q(`UPDATE users SET email_verified_at = NOW(3) WHERE public_id = ?`, [cibleId]);
      fait.verifie = true;
    }

    // Les montants sont des ajustements, positifs ou négatifs. Le plancher
    // s'applique au résultat, pas à l'ajustement : sinon un débit serait
    // silencieusement transformé en zéro et ne ferait rien.
    if (Number.isInteger(champs.scarves) && champs.scarves !== 0) {
      await assurerBourse(q, cibleId);
      await q(`UPDATE user_wallet SET scarves = GREATEST(0, scarves + ?) WHERE user_id = ?`,
        [champs.scarves, cibleId]);
      fait.scarves = champs.scarves;
    }

    if (Number.isInteger(champs.packs) && champs.packs !== 0) {
      await assurerBourse(q, cibleId);
      await q(`UPDATE user_wallet SET packs = GREATEST(0, LEAST(99, packs + ?)) WHERE user_id = ?`,
        [champs.packs, cibleId]);
      fait.packs = champs.packs;
    }

    if (Number.isInteger(champs.slots)) {
      await q(`UPDATE user_wallet SET follow_slots = GREATEST(2, LEAST(12, ?)) WHERE user_id = ?`,
        [champs.slots, cibleId]);
      fait.slots = champs.slots;
    }

    if (!Object.keys(fait).length) throw fail('admin.error.nothing_to_do');
    await journal(acteur, 'joueur.modifie', cibleId, fait, adresseIp);
    return fait;
  }

  /* ----------------------------------------------------- compétitions */

  async function competitions({ q: terme = '', pays = '', palier = '', limite = 100 } = {}) {
    const w = [];
    const a = [];
    if (terme) { w.push('(name LIKE ? OR country LIKE ?)'); a.push(`%${terme}%`, `%${terme}%`); }
    if (pays) { w.push('country = ?'); a.push(pays); }
    if (palier) { w.push('tier = ?'); a.push(Number(palier)); }
    return q(
      `SELECT league_id, season, name, country, type, family, tier, enabled,
              has_events, has_standings, has_top_scorers, starts_on, ends_on
         FROM souvenir_leagues
         ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
        ORDER BY tier, country, name
        LIMIT ${Number(limite) || 100}`, a);
  }

  async function modifierCompetition(acteur, leagueId, season, champs, adresseIp) {
    const fait = {};
    if (typeof champs.enabled === 'boolean') {
      await q(`UPDATE souvenir_leagues SET enabled = ? WHERE league_id = ? AND season = ?`,
        [champs.enabled ? 1 : 0, leagueId, season]);
      fait.enabled = champs.enabled;
    }
    if ([1, 2, 3].includes(Number(champs.tier))) {
      await q(`UPDATE souvenir_leagues SET tier = ? WHERE league_id = ? AND season = ?`,
        [Number(champs.tier), leagueId, season]);
      fait.tier = Number(champs.tier);
    }
    // Les dates de saison décident de ce qui s'affiche dans le télétexte :
    // les corriger à la main évite d'attendre que l'API se mette à jour.
    for (const [k, col] of [['debut', 'starts_on'], ['fin', 'ends_on']]) {
      if (champs[k] && /^\d{4}-\d{2}-\d{2}$/.test(champs[k])) {
        await q(`UPDATE souvenir_leagues SET ${col} = ? WHERE league_id = ? AND season = ?`,
          [champs[k], leagueId, season]);
        fait[k] = champs[k];
      }
    }
    if (!Object.keys(fait).length) throw fail('admin.error.nothing_to_do');
    await journal(acteur, 'competition.modifiee', `${leagueId}/${season}`, fait, adresseIp);
    return fait;
  }

  /* -------------------------------------------------------- réglages */

  async function reglages() {
    const rows = await q(`SELECT cle, valeur, maj FROM reglages`);
    return Object.fromEntries(rows.map((r) => [r.cle,
      typeof r.valeur === 'string' ? JSON.parse(r.valeur) : r.valeur]));
  }

  /**
   * Écrit un réglage.
   *
   * Deux chemins, et c'est délibéré. Une clé **du registre** passe par
   * `ecrireReglage` : elle est validée contre sa déclaration — type, bornes,
   * longueur — et le cache est repoussé, sans quoi le jeu continuerait sur
   * l'ancienne valeur pendant que l'écran affiche la nouvelle.
   *
   * Une clé **hors registre** garde l'ancien chemin, sans validation possible
   * puisque rien ne déclare ce qu'elle accepte. `series_actives` est dans ce
   * cas : elle est écrite par l'onglet des Fanzzy, elle porte un tableau
   * d'identifiants de séries, et elle n'a pas sa place dans un écran de
   * réglages fins.
   */
  async function fixerReglage(acteur, cle, valeur, adresseIp) {
    if (!/^[a-z0-9_.]{2,48}$/.test(String(cle))) throw fail('admin.error.bad_key');

    if (cle in DEFAUTS) {
      const pose = await ecrireReglage(pool, cle, valeur, acteur);
      await journal(acteur, 'reglage.modifie', cle, { valeur: pose }, adresseIp);
      return { cle, valeur: pose };
    }

    await q(
      `INSERT INTO reglages (cle, valeur, maj_par) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE valeur = VALUES(valeur), maj_par = VALUES(maj_par)`,
      [cle, JSON.stringify(valeur ?? null), acteur]);
    await journal(acteur, 'reglage.modifie', cle, { valeur }, adresseIp);
    return { cle, valeur };
  }

  /* ------------------------------------------------ catalogue Fanzzy

     C'est la raison d'être de cet écran : ajouter une carte ne doit plus
     demander un déploiement. Trois garde-fous, qui ne sont pas négociables :

     **On ne supprime pas.** Un identifiant effacé orphelinerait les
     collections, les decks et le Fanzzy équipé de tous ceux qui le possèdent.
     On dépublie : la carte sort des tirages, elle reste connue du jeu.

     **On ne renomme pas un identifiant.** C'est la clé que portent les lignes
     de `user_fanzzy`. Le changer reviendrait à supprimer, en pire — sans même
     s'en apercevoir.

     **Le cache est rechargé après chaque écriture.** Sans ça la base et le
     jeu divergent, et rien ne le signale avant qu'un joueur tire une carte
     que le serveur croit inexistante.                                       */

  const TYPES_VALIDES = new Set(Object.keys(TYPES));
  const RAR_VALIDES = new Set(Object.keys(RAR));
  /* **Les quinze gestes, et non trois.**
   *
   * Cette liste était écrite ici à la main, et elle datait du jour où le jeu
   * n'en avait que trois. Douze gestes sont arrivés depuis — les sept de
   * rythme, puis les cinq épreuves — sans que personne ne repasse par ici.
   *
   * Conséquence : l'administration **refusait** d'enregistrer une carte dont le
   * cri portait l'un des douze autres, avec le message « geste inconnu ». La
   * carte était juste, le jeu la jouait, le serveur la validait partout
   * ailleurs — seul cet écran disait non.
   *
   * Elle est donc importée, comme partout. Une liste recopiée finit toujours
   * par décrire un jeu qui n'existe plus. */
  const GESTES = new Set(GESTES_DU_JEU);

  /** Une chaîne bornée : ce qui arrive d’un formulaire n’a pas de longueur. */
  const texte = (v, max) => String(v ?? '').trim().slice(0, max);

  /** Les champs qu'un formulaire a le droit de poser, et rien d'autre. */
  function nettoyer(corps, { creation = false } = {}) {
    const p = {};

    if (creation) {
      p.id = texte(corps.id, 12).toUpperCase();
      if (!/^[A-Z][A-Z0-9]{0,11}$/.test(p.id)) throw fail('admin.error.fanzzy_id');
    }
    if (corps.nom !== undefined) {
      p.nom = texte(corps.nom, 64);
      if (p.nom.length < 2) throw fail('admin.error.fanzzy_nom');
    }
    if (corps.type !== undefined) {
      p.type = texte(corps.type, 8);
      if (!TYPES_VALIDES.has(p.type)) throw fail('admin.error.fanzzy_type');
    }
    if (corps.set !== undefined) {
      p.set_id = texte(corps.set, 4);
      if (!SETS.some((s) => s.id === p.set_id)) throw fail('admin.error.fanzzy_set');
    }
    if (corps.rar !== undefined) {
      p.rar = texte(corps.rar, 8);
      if (!RAR_VALIDES.has(p.rar)) throw fail('admin.error.fanzzy_rarete');
    }
    if (corps.stage !== undefined) {
      p.stage = Number(corps.stage);
      if (![1, 2, 3].includes(p.stage)) throw fail('admin.error.fanzzy_stage');
    }
    if (corps.evo !== undefined) p.evo = texte(corps.evo, 12).toUpperCase() || null;
    if (corps.histoire !== undefined) p.histoire = texte(corps.histoire, 2000) || null;
    if (corps.publie !== undefined) p.publie = corps.publie ? 1 : 0;
    if (corps.ordre !== undefined) p.ordre = Number(corps.ordre) || 0;

    if (corps.mods !== undefined) {
      if (typeof corps.mods !== 'object' || Array.isArray(corps.mods)) {
        throw fail('admin.error.fanzzy_mods');
      }
      p.mods = JSON.stringify(corps.mods ?? {});
    }
    if (corps.cri !== undefined) {
      const c = corps.cri ?? {};
      if (!GESTES.has(c.gest)) throw fail('admin.error.fanzzy_geste');
      p.cri = JSON.stringify({
        label: texte(c.label, 48), gest: c.gest, power: Number(c.power) || 50,
      });
    }
    return p;
  }

  /**
   * Une évolution doit pointer sur une carte qui existe, sinon la lignée casse
   * à l'affichage et le coût d'évolution devient inatteignable.
   */
  function verifierEvo(id, evo) {
    if (!evo) return;
    if (evo === id) throw fail('admin.error.fanzzy_evo_soi');
    if (!parIdentifiant(evo)) throw fail('admin.error.fanzzy_evo_inconnue');
  }

  /* ------------------------------------------------- séries ouvertes

     Ouvrir le jeu série par série. Cent soixante-six cartes d'un coup, c'est
     trop pour commencer : un joueur qui lit « 1/166 » à sa première ouverture
     sait qu'il n'y arrivera jamais. LA TRIBUNE seule se complète, et compléter
     est ce qui donne envie d'ouvrir la suivante.

     C'est un interrupteur par série et non par carte. La dépublication carte
     par carte existe déjà — c'est elle qui a retiré les trente-deux doublons —
     mais ouvrir une série à la main demanderait cent vingt-sept clics, puis
     autant pour la suivante. Personne ne le ferait deux fois.                */

  /** Chaque série, son état, et de quoi décider : combien elle distribue. */
  function listerSeries() {
    const cartes = tous();
    return SETS.map((s) => {
      const dedans = cartes.filter((f) => f.set === s.id);
      const tirables = dedans.filter((f) => f.publie && f.stage === 1);
      return {
        ...s,
        ouverte: serieOuverte(s.id),
        cartes: dedans.length,
        publiees: dedans.filter((f) => f.publie).length,
        // Ce qui compte vraiment pour un booster : seul le stade 1 se tire.
        // Une série sans stade 1 publié ne peut pas en distribuer, et l'écran
        // doit le montrer avant qu'on l'ouvre, pas après.
        tirables: tirables.length,
      };
    });
  }

  /* ================================================================ saisons

     Une saison ouvre du contenu pour **tout le monde en même temps**, et
     l'annonce. Voir `src/server/fanzzy/saisons.js` pour ce qu'elle ouvre
     réellement et pourquoi elle a remplacé l'ouverture par niveau.

     Il n'y a plus de « fixer les séries ouvertes » : les séries ouvertes sont
     l'union des saisons lancées, et rien d'autre ne les décide. Une liste
     modifiable à côté des saisons aurait été une seconde vérité, et le jour où
     les deux divergent personne ne sait laquelle le jeu applique.            */

  /** Ce qu'une saison peut nommer. Tout le reste est refusé, nommément. */
  function validerContenu(p) {
    const liste = (v) => (Array.isArray(v) ? [...new Set(v.map(String))] : []);
    const series = liste(p.series);
    const tenues = liste(p.tenues);
    const stuff = liste(p.stuff);
    const actions = liste(p.actions);
    const stades = liste(p.stades);

    const inconnue = series.find((id) => !SETS.some((s) => s.id === id));
    if (inconnue) throw fail('admin.error.serie_inconnue');

    /* Une série ouverte sans carte de stade 1 publiée ferait lever le tirage au
       premier booster. On refuse ici, où l'on peut encore le dire — et au
       moment de la **préparer**, pas au moment de la lancer devant tout le
       monde. */
    const cartes = tous();
    const vide = series.find((id) =>
      !cartes.some((f) => f.set === id && f.publie && f.stage === 1));
    if (vide) throw fail('admin.error.serie_sans_carte');

    if (tenues.some((id) => !tenuePar(id))) throw fail('admin.error.tenue_inconnue');
    if (stuff.some((id) => !STUFF.some((s) => s.id === id))) {
      throw fail('admin.error.stuff_inconnu');
    }
    if (actions.some((id) => !ACTIONS.some((a) => a.id === id))) {
      throw fail('admin.error.action_inconnue');
    }
    /* Les stades rejoignent les trois autres familles. La vérification se fait
       contre le **code**, comme pour l'équipement et les cartes : c'est lui qui
       dit ce qui existe, la base ne portant que l'état de publication. */
    if (stades.some((id) => !STADES.some((x) => x.id === id))) {
      throw fail('admin.error.stade_inconnu');
    }
    return { series, tenues, stuff, actions, stades };
  }

  /* `texte` existe déjà plus haut et tronque sans jamais rendre `null`. Ici on
     veut la nuance : une annonce vide n'est pas une chaîne vide, c'est **pas
     d'annonce** — et une colonne qui contient `''` se lit comme un texte qu'on
     a oublié d'écrire. D'où un nom distinct plutôt qu'un second `texte`, que
     JavaScript refuse de toute façon dans la même portée. */
  const texteOuRien = (v, max) => {
    const s = String(v ?? '').trim();
    return s ? s.slice(0, max) : null;
  };

  async function listerSaisons() {
    return {
      saisons: toutesLesSaisons(),
      enCours: saisonEnCours(),
      series: listerSeries(),
      ouvertes: seriesOuvertes(),
      /* De quoi remplir les listes de l'écran sans une seconde requête, et
         surtout sans que la page se fabrique sa propre idée de ce qui existe. */
      choix: {
        series: SETS.map((s) => ({ id: s.id, nom: s.nom })),
        tenues: toutesTenues().map((t) => ({ id: t.id, nom: t.nom, publie: t.publie })),
        stuff: STUFF.map((s) => ({ id: s.id, nom: s.nom })),
        actions: ACTIONS.map((a) => ({ id: a.id, nom: a.nom })),
        /* **Les stades manquaient.** La colonne `saisons.stades` existe,
           `validerContenu` les accepte et `lancerSaison` les publie — mais ils
           n'étaient pas dans cette liste, donc l'écran ne pouvait pas les
           proposer. Dix stades dans le code, aucun levier pour les ouvrir : un
           champ réglable qui n'apparaît nulle part est un champ qui n'existe
           pas, quoi qu'en dise le serveur. */
        stades: STADES.map((x) => ({ id: x.id, nom: x.nom })),
      },
    };
  }

  async function creerSaison(acteur, p, ip_) {
    const c = validerContenu(p ?? {});
    const nom = texteOuRien(p?.nom, 64);
    if (!nom) throw fail('admin.error.saison_sans_nom');
    /* Le numéro proposé suit le plus grand existant. Il reste modifiable : on
       peut vouloir une saison 0 d'archive, ou renuméroter. */
    const suivant = toutesLesSaisons().reduce((m, s) => Math.max(m, s.numero), 0) + 1;
    const numero = Number.isInteger(Number(p?.numero)) && Number(p.numero) >= 0
      ? Number(p.numero) : suivant;

    const r = await q(
      `INSERT INTO saisons (numero, nom, texte, series, tenues, stuff, actions, stades)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [numero, nom, texteOuRien(p?.texte, 500), JSON.stringify(c.series),
       JSON.stringify(c.tenues), JSON.stringify(c.stuff), JSON.stringify(c.actions),
       JSON.stringify(c.stades ?? [])]);
    await chargerSaisons(pool);
    await journal(acteur, 'saison.creee', String(r.insertId), { nom, numero, ...c }, ip_);
    return listerSaisons();
  }

  async function modifierSaison(acteur, id, p, ip_) {
    const avant = toutesLesSaisons().find((s) => s.id === Number(id));
    if (!avant) throw fail('admin.error.saison_inconnue', 404);
    const c = validerContenu(p ?? {});
    const nom = texteOuRien(p?.nom, 64) ?? avant.nom;

    await q(
      `UPDATE saisons SET numero = ?, nom = ?, texte = ?, series = ?, tenues = ?,
                          stuff = ?, actions = ?, stades = ?
        WHERE id = ?`,
      [Number.isInteger(Number(p?.numero)) ? Number(p.numero) : avant.numero,
       nom, texteOuRien(p?.texte, 500), JSON.stringify(c.series), JSON.stringify(c.tenues),
       JSON.stringify(c.stuff), JSON.stringify(c.actions),
       JSON.stringify(c.stades ?? []), avant.id]);
    await chargerSaisons(pool);
    /* Modifier une saison **déjà lancée** change ce qui est ouvert. On recharge
       donc les séries, sans quoi le jeu continuerait de distribuer selon
       l'ancienne liste jusqu'au prochain redémarrage. */
    await chargerSeries(pool);
    await journal(acteur, 'saison.modifiee', String(avant.id), { nom, ...c }, ip_);
    return listerSaisons();
  }

  /**
   * Lance une saison, ou la remet en brouillon.
   *
   * Lancer, c'est **ouvrir ses séries et publier son contenu** — tenues,
   * cartes d'action, équipement, stades — pour tout le monde, à cet instant.
   * C'est le geste le plus visible de toute l'administration : il change le jeu
   * de tous les joueurs connectés.
   *
   * Les trois dernières familles ne faisaient qu'être **annoncées** jusqu'ici :
   * elles vivaient dans le code, une saison pouvait écrire leur nom dans son
   * texte et rien de plus. On pouvait donc annoncer « quatre cartes d'action »
   * qui étaient jouables depuis la livraison précédente. Voir
   * `sql/contenus.sql`.
   *
   * Remettre en brouillon referme les séries que cette saison-là ouvrait — et
   * seulement celles-là : les séries d'une autre saison lancée restent
   * ouvertes, puisque les séries ouvertes sont l'union. Les tenues publiées ne
   * se dépublient pas : quelqu'un les a peut-être déjà gagnées, et une tenue
   * qui disparaît d'une collection est une perte, pas une fermeture.
   */
  async function lancerSaison(acteur, id, lancer, ip_) {
    const s = toutesLesSaisons().find((x) => x.id === Number(id));
    if (!s) throw fail('admin.error.saison_inconnue', 404);

    if (lancer) {
      /* On revalide au lancement. Le catalogue a pu bouger depuis la création —
         une carte dépubliée, une série vidée — et lancer une saison dont une
         série n'a plus de carte de stade 1 ferait lever le premier booster. */
      validerContenu(s);
      await q(`UPDATE saisons SET lancee_a = NOW(3) WHERE id = ?`, [s.id]);
      if (s.tenues.length) {
        /* `IN (?)` avec un tableau : mysql2 déplie la liste. `execute` ne le
           fait pas — il prépare la requête, et un tableau y devient une seule
           valeur. D'où `query`, et la liste construite à partir d'identifiants
           déjà vérifiés par `validerContenu`. */
        await pool.query(`UPDATE tenues SET publie = 1 WHERE id IN (?)`, [s.tenues]);
        await rechargerTenues(pool);
      }

      /* Les trois autres familles, par le module qui les tient. Facultatif :
         sans `sql/contenus.sql` appliqué, tout est déjà jouable et il n'y a
         rien à ouvrir — la saison se lance quand même, et ses séries et ses
         tenues, elles, s'ouvrent. */
      if (deps.contenus) {
        for (const [famille, liste] of [['action', s.actions], ['stuff', s.stuff],
          ['stade', s.stades]]) {
          if (liste?.length) await deps.contenus.publier(famille, liste, true);
        }
      }
    } else {
      await q(`UPDATE saisons SET lancee_a = NULL WHERE id = ?`, [s.id]);
    }

    await chargerSaisons(pool);
    await chargerSeries(pool);
    await journal(acteur, lancer ? 'saison.lancee' : 'saison.retiree', String(s.id),
      { nom: s.nom, numero: s.numero, series: s.series, tenues: s.tenues }, ip_);
    return listerSaisons();
  }

  /**
   * Supprime une saison.
   *
   * Refusé si elle est lancée : on ne retire pas du jeu ce que des joueurs sont
   * en train de collectionner par un bouton de suppression. Il faut d'abord la
   * remettre en brouillon, ce qui est un geste distinct et réversible.
   */
  async function supprimerSaison(acteur, id, ip_) {
    const s = toutesLesSaisons().find((x) => x.id === Number(id));
    if (!s) throw fail('admin.error.saison_inconnue', 404);
    if (s.lancee) throw fail('admin.error.saison_lancee');
    await q(`DELETE FROM saisons WHERE id = ?`, [s.id]);
    await chargerSaisons(pool);
    await journal(acteur, 'saison.supprimee', String(s.id), { nom: s.nom }, ip_);
    return listerSaisons();
  }

  async function listerFanzzy() {
    // On lit la base et non le cache : l'administration doit voir l'état réel,
    // y compris si un rechargement a été manqué.
    return q(`SELECT id, nom, type, set_id, stage, rar, evo, histoire,
                     mods, cri, publie, ordre, maj_a
                FROM fanzzy ORDER BY ordre, id`);
  }

  /* ---------------------------------------------------- les tenues */

  /**
   * L'identifiant d'une tenue devient un **nom de dossier** dans
   * `public/img/fanzzy/<ID>/e1/<tenue>/`. Il ne peut donc contenir ni accent,
   * ni espace, ni majuscule : le disque, lui, ne pardonne pas.
   */
  const idTenue = (v) => {
    const id = String(v ?? '').trim().toLowerCase();
    return /^[a-z][a-z0-9]{1,23}$/.test(id) ? id : null;
  };

  async function creerTenue(acteur, corps, ip_) {
    const id = idTenue(corps.id);
    if (!id) throw fail('admin.error.tenue_id');
    const nom = texte(corps.nom, 48);
    if (!nom) throw fail('admin.error.tenue_nom');
    const rar = texte(corps.rar, 16) || 'rare';
    if (!RAR_VALIDES.has(rar)) throw fail('admin.error.tenue_rarete');
    if (tenuePar(id)) throw fail('admin.error.tenue_existe');

    const [r] = await pool.execute(
      `SELECT COALESCE(MAX(ordre), 0) + 1 AS suivant FROM tenues`);
    await pool.execute(
      `INSERT INTO tenues (id, nom, texte, rar, publie, ordre) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, nom, texte(corps.texte, 160) || null, rar,
       corps.publie === false ? 0 : 1, r[0].suivant]);

    await rechargerTenues(pool);
    await journal(acteur, 'tenue.creee', id, { nom, rar }, ip_);
    /* Le dossier d'images n'existe pas encore, et c'est normal : la chaîne le
       crée au premier rendu déposé. On le dit quand même, parce qu'une tenue
       sans dessin s'affiche comme la tenue de base et que personne ne devine
       pourquoi. */
    return {
      ...tenuePar(id),
      dossier: `<ID>/e1/${id}/`,
      /* Ce que l’administrateur doit vraiment savoir : le nom du fichier à
         déposer. Le dossier de sortie, la chaîne le fabrique ; le nom de la
         source, elle ne le devine pas — et un fichier mal nommé est ignoré
         en silence. Un thème n’a qu’un état, `neutre` : il habille, il ne
         rejoue pas les douze réactions. */
      source: `art/<ID>/_src/<numéro>-e1-${id}-neutre.png`,
      sansImages: true,
    };
  }

  async function modifierTenue(acteur, id, corps, ip_) {
    if (!tenuePar(id)) throw fail('admin.error.tenue_inconnue');
    const champs = [];
    const vals = [];

    if (corps.nom !== undefined) {
      const nom = texte(corps.nom, 48);
      if (!nom) throw fail('admin.error.tenue_nom');
      champs.push('nom = ?'); vals.push(nom);
    }
    if (corps.texte !== undefined) {
      champs.push('texte = ?'); vals.push(texte(corps.texte, 160) || null);
    }
    if (corps.rar !== undefined) {
      const rar = texte(corps.rar, 16);
      if (!RAR_VALIDES.has(rar)) throw fail('admin.error.tenue_rarete');
      champs.push('rar = ?'); vals.push(rar);
    }
    if (corps.publie !== undefined) {
      champs.push('publie = ?'); vals.push(corps.publie ? 1 : 0);
    }
    if (!champs.length) return tenuePar(id);

    /* sql-sur : `champs` ne contient que des littéraux écrits douze lignes
       plus haut — « nom = ? », « texte = ? », « rar = ? », « publie = ? » — et
       chaque valeur part en paramètre. Rien de ce que le client envoie
       n'atteint la chaîne SQL ; il ne décide que **quelles** colonnes sont
       reprises, parmi quatre que ce fichier énumère.

       Le marqueur est là pour que l'audit `npm run securite` compte cette
       exception au lieu de la taire : une interpolation dans du SQL se relit,
       toujours, même quand elle est juste. */
    await pool.execute(`UPDATE tenues SET ${champs.join(', ')} WHERE id = ?`, [...vals, id]);
    await rechargerTenues(pool);
    await journal(acteur, 'tenue.modifiee', id, corps, ip_);
    return tenuePar(id);
  }

  async function creerFanzzy(acteur, corps, ip_) {
    const p = nettoyer(corps, { creation: true });
    if (parIdentifiant(p.id)) throw fail('admin.error.fanzzy_existe');
    for (const champ of ['nom', 'type', 'set_id', 'rar', 'cri']) {
      if (p[champ] === undefined) throw fail('admin.error.fanzzy_incomplet');
    }
    verifierEvo(p.id, p.evo);

    const colonnes = Object.keys(p);
    await q(`INSERT INTO fanzzy (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`,
      colonnes.map((c) => p[c]));
    await recharger(pool);
    await journal(acteur, 'fanzzy.cree', p.id, { nom: p.nom, set: p.set_id, rar: p.rar }, ip_);
    return parIdentifiant(p.id);
  }

  async function modifierFanzzy(acteur, id, corps, ip_) {
    const avant = parIdentifiant(id);
    if (!avant) throw fail('admin.error.fanzzy_inconnu', 404);
    // L'identifiant est la clé des collections : il ne se change jamais.
    const p = nettoyer(corps);
    delete p.id;
    if (!Object.keys(p).length) throw fail('admin.error.nothing_to_do');
    verifierEvo(id, p.evo);

    const colonnes = Object.keys(p);
    await q(`UPDATE fanzzy SET ${colonnes.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...colonnes.map((c) => p[c]), id]);
    await recharger(pool);
    await journal(acteur, 'fanzzy.modifie', id, p, ip_);
    return parIdentifiant(id);
  }

  /* ---------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (res.headersSent) return;
    console.error('[admin]', e.message);
    /* `raison` accompagne le code quand l'erreur en porte une. C'est le cas des
       refus du registre : « attendu entre 50 et 2000, reçu 5 » se corrige sans
       rien ouvrir, là où « refusé » oblige à essayer des valeurs au hasard.
       Elle n'est jointe que si l'erreur l'a prévue — un message d'exception
       quelconque n'a rien à faire sous les yeux de quelqu'un. */
    res.status(e.status ?? 400).json({
      error: e.code ?? 'admin.error.server',
      ...(e.raison ? { raison: e.raison } : {}),
    });
  });

  /** Le client demande si l'onglet doit exister. Ouvert à tout connecté. */
  router.get('/suis-je', requireAuth, safe(async (req, res) =>
    res.json({ admin: await estAdmin(req.user.id) })));

  router.use(requireAdmin);

  router.get('/apercu', safe(async (_req, res) => res.json(await apercu())));

  router.get('/joueurs', safe(async (req, res) => res.json({
    joueurs: await joueurs({ q: String(req.query.q ?? ''),
      limite: req.query.limite, offset: req.query.offset }),
  })));

  router.patch('/joueur/:id', safe(async (req, res) =>
    res.json(await modifier(req.user.id, req.params.id, req.body ?? {}, ip(req)))));

  /* -------------------------------------------------------- abonnement

     Accorder un abonnement depuis l'administration. C'est ce qui permet
     d'ouvrir la bêta et d'éprouver les deux côtés du jeu **sans attendre le
     prestataire de paiement** — et c'est aussi le geste de service après-vente
     du jour où il sera branché : un remboursement, un mois offert.

     Comme toute écriture d'administration, il passe par `admin_audit` : qui,
     sur qui, quelle formule, combien de jours. Un accès offert sans trace est
     un accès dont plus personne ne sait d'où il vient.

     La règle de ce que l'abonnement ouvre ne vit pas ici : elle est dans
     `abonnement/index.js`, et l'administration ne fait que l'accorder. */

  router.post('/joueur/:id/abonnement', safe(async (req, res) => {
    if (!deps.abonnement) return res.status(503).json({ error: 'admin.error.abo_absent' });
    const cible = (await q('SELECT public_id, pseudo FROM users WHERE public_id = ?',
      [req.params.id]))[0];
    if (!cible) return res.status(404).json({ error: 'admin.error.joueur_inconnu' });

    /* `jours` nul veut dire **sans terme** : c'est ce qu'on pose pour un
       bêta-testeur. Rien ne l'expire, et c'est voulu — un accès offert qui
       s'éteint sans prévenir se lit comme une panne. */
    const brut = req.body?.jours;
    const jours = brut === null || brut === undefined || brut === ''
      ? null : Math.min(3650, Math.max(1, Number(brut) || 0));
    if (jours !== null && !Number.isInteger(jours)) {
      return res.status(400).json({ error: 'admin.error.jours' });
    }
    const formule = ['mensuel', 'annuel', 'offert'].includes(req.body?.formule)
      ? req.body.formule : 'offert';

    const etat = await deps.abonnement.accorder(cible.public_id,
      { formule, jours, source: 'admin' });
    await journal(req.user.id, 'abonnement.accorder', cible.public_id,
      { formule, jours }, ip(req));
    res.json({ abonnement: etat });
  }));

  router.delete('/joueur/:id/abonnement', safe(async (req, res) => {
    if (!deps.abonnement) return res.status(503).json({ error: 'admin.error.abo_absent' });
    const etat = await deps.abonnement.retirer(req.params.id);
    await journal(req.user.id, 'abonnement.retirer', req.params.id, null, ip(req));
    res.json({ abonnement: etat });
  }));

  router.get('/competitions', safe(async (req, res) => res.json({
    competitions: await competitions({
      q: String(req.query.q ?? ''), pays: String(req.query.pays ?? ''),
      palier: req.query.palier }),
  })));

  router.patch('/competition/:id/:season', safe(async (req, res) =>
    res.json(await modifierCompetition(req.user.id, Number(req.params.id),
      Number(req.params.season), req.body ?? {}, ip(req)))));

  /* Le registre : ce qui existe, ce que ça accepte, ce que ça vaut par
     défaut. L'écran s'en sert pour **se dessiner** — un champ par déclaration,
     avec son type, ses bornes et son unité. L'ancien écran demandait une clé
     et du JSON tapés de mémoire : pour s'en servir il fallait avoir lu le
     code, ce qui n'est pas un écran d'administration.

     `valeurs` porte l'effectif, `brutes` ce que la base contient vraiment.
     La différence dit quelles clés ont été touchées — sans elle, impossible de
     distinguer un réglage laissé au défaut d'un réglage réglé sur sa valeur
     par défaut, et donc impossible de savoir ce qu'on a changé. */
  router.get('/registre', safe(async (_req, res) => res.json({
    sections: SECTIONS,
    reglages: REGLAGES,
    defauts: DEFAUTS,
    valeurs: tousLesReglages(),
    brutes: await reglages(),
  })));

  // Conservée : d'anciennes clés hors registre y vivent encore, dont
  // `series_actives`, qui est écrite par l'onglet des Fanzzy.
  router.get('/reglages', safe(async (_req, res) => res.json(await reglages())));

  router.put('/reglage/:cle', safe(async (req, res) =>
    res.json(await fixerReglage(req.user.id, req.params.cle, req.body?.valeur, ip(req)))));

  router.delete('/reglage/:cle', safe(async (req, res) => {
    const valeur = await rendreAuDefaut(pool, req.params.cle, req.user.id);
    await journal(req.user.id, 'reglage.defaut', req.params.cle, { valeur }, ip(req));
    return res.json({ cle: req.params.cle, valeur, defaut: true });
  }));

  router.get('/journal', safe(async (req, res) => res.json({
    journal: await q(
      `SELECT a.id, a.action, a.cible, a.detail, a.au, u.pseudo AS acteur
         FROM admin_audit a LEFT JOIN users u ON u.public_id = a.acteur
        ORDER BY a.au DESC LIMIT ?`, [Number(req.query.limite) || 100]),
  })));

  /* -------------------------------------------------- outils d'exploitation */

  router.post('/cache/purge', safe(async (req, res) => {
    const [r] = await pool.query(`DELETE FROM api_cache`);
    await journal(req.user.id, 'cache.purge', null, { lignes: r.affectedRows }, ip(req));
    res.json({ purge: r.affectedRows });
  }));

  router.post('/mail-test', safe(async (req, res) => {
    const r = await globalThis.mailer?.test(req.user.email);
    await journal(req.user.id, 'mail.test', req.user.email, { delivered: r?.delivered }, ip(req));
    res.json({ ...r, etat: globalThis.mailer?.status });
  }));

  /* ------------------------------------------------ catalogue Fanzzy */

  router.get('/fanzzy', safe(async (_req, res) =>
    res.json({ fanzzy: await listerFanzzy(), types: TYPES, sets: SETS, rar: RAR,
               series: listerSeries(), ouvertes: seriesOuvertes() })));

  /* ------------------------------------------------------- les saisons

     `PUT /series` n'existe plus. Les séries ouvertes sont l'union des saisons
     lancées, et rien d'autre ne les décide : une liste modifiable à côté aurait
     été une seconde vérité, et le jour où les deux divergent personne ne sait
     laquelle le jeu applique. */

  router.get('/saisons', safe(async (_req, res) => res.json(await listerSaisons())));

  router.post('/saisons', safe(async (req, res) =>
    res.json(await creerSaison(req.user.id, req.body ?? {}, ip(req)))));

  router.patch('/saison/:id', safe(async (req, res) =>
    res.json(await modifierSaison(req.user.id, req.params.id, req.body ?? {}, ip(req)))));

  /* Le geste le plus visible de toute l'administration : il change le jeu de
     tous les joueurs connectés. D'où une route à lui, et non un champ de plus
     dans la modification. */
  /* `lancer` doit être un booléen, et rien d'autre.

     Cette route lisait `req.body?.lancer !== false` : un corps qu'elle ne
     comprenait pas — champ absent, mal nommé, mal emballé — voulait donc dire
     **lance**. C'est le pire défaut possible pour le geste qui ouvre du
     contenu à tous les joueurs en même temps : une requête fautive ne
     produisait pas un refus, elle produisait un lancement. L'écran l'a
     démontré à ses dépens, en envoyant pendant des semaines un corps de la
     mauvaise forme : impossible de refermer une saison, très possible d'en
     ouvrir une.

     Un geste irréversible aux yeux des joueurs se demande explicitement. */
  router.post('/saison/:id/lancer', safe(async (req, res) => {
    if (typeof req.body?.lancer !== 'boolean') throw fail('admin.error.lancer_manquant');
    return res.json(await lancerSaison(req.user.id, req.params.id, req.body.lancer, ip(req)));
  }));

  router.delete('/saison/:id', safe(async (req, res) =>
    res.json(await supprimerSaison(req.user.id, req.params.id, ip(req)))));

  router.post('/fanzzy', safe(async (req, res) =>
    res.json(await creerFanzzy(req.user.id, req.body ?? {}, ip(req)))));

  router.patch('/fanzzy/:id', safe(async (req, res) =>
    res.json(await modifierFanzzy(req.user.id, String(req.params.id), req.body ?? {}, ip(req)))));

  /* ------------------------------------------------------- les tenues

     Créer un thème ne doit pas demander un déploiement — c'est la raison
     d'être de ces trois routes, et c'est le même trajet qu'a pris le catalogue
     Fanzzy.

     **Aucune ne supprime.** Une tenue effacée orphelinerait les `user_skins`
     de tous ceux qui la possèdent : elle disparaîtrait de leur collection sans
     explication, et la fiche chercherait un identifiant qui n'existe plus. On
     dépublie — `publie: false` la sort des boosters et la laisse à qui l'a
     gagnée.                                                                 */

  /* ================================================ les contenus du jeu

     Vingt-neuf cartes d'action, dix-sept pièces d'équipement, dix stades. Ils
     ont un module qui sait les publier — `contenus.publier` — et **aucune route
     ne l'atteignait** : on ne pouvait les ouvrir qu'en les cochant dans une
     saison, et jamais les refermer. Les Fanzzy et les tenues ont chacun leur
     écran ; ces trois familles-là n'avaient rien.

     Facultatif de bout en bout : sans `sql/contenus.sql` appliqué, le module
     n'est pas branché. La route le **dit** au lieu de lever, et l'écran affiche
     alors la liste sans ses boutons — voir le repli de `contenus/index.js`. */
  router.get('/contenus', safe(async (_req, res) => {
    if (!module.deps.contenus) return res.json({ disponible: false, familles: {} });
    const { tous: tousLes, FAMILLES } = await import('../contenus/index.js');
    const familles = {};
    for (const [famille, { nom }] of Object.entries(FAMILLES)) {
      familles[famille] = { nom, liste: tousLes(famille) };
    }
    res.json({ disponible: true, familles });
  }));

  router.post('/contenus/publier', safe(async (req, res) => {
    if (!module.deps.contenus) throw fail('admin.error.contenus_absents');
    const { FAMILLES } = await import('../contenus/index.js');
    const famille = String(req.body?.famille ?? '');
    if (!FAMILLES[famille]) throw fail('admin.error.famille_inconnue');
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    if (!ids.length) throw fail('admin.error.nothing_to_do');
    /* Un identifiant que le code ne connaît pas ne se publie pas : le code
       porte la forme, la base porte l'état, et un état sans forme est une ligne
       que plus aucun écran ne sait afficher. */
    const connus = new Set(FAMILLES[famille].source.map((x) => x.id));
    const inconnu = ids.find((id) => !connus.has(id));
    if (inconnu) throw fail('admin.error.contenu_inconnu');

    const publie = Boolean(req.body?.publie);
    const change = await module.deps.contenus.publier(famille, ids, publie);
    await journal(req.user.id, publie ? 'contenu.publie' : 'contenu.retire',
      `${famille}:${ids.join(',')}`, { famille, ids, publie }, ip(req));
    res.json({ change });
  }));

  router.get('/tenues', safe(async (_req, res) =>
    // `rar` avec : l’écran de création a besoin de l’échelle, et une seconde
    // requête pour quatre mots serait un aller-retour pour rien.
    res.json({ tenues: toutesTenues(), rar: RAR })));

  router.post('/tenues', safe(async (req, res) =>
    res.json(await creerTenue(req.user.id, req.body ?? {}, ip(req)))));

  router.patch('/tenues/:id', safe(async (req, res) =>
    res.json(await modifierTenue(req.user.id, String(req.params.id), req.body ?? {}, ip(req)))));

  return Object.assign(module, { router, requireAdmin, estAdmin, amorcer, apercu, joueurs,
    modifier, competitions, modifierCompetition, reglages, fixerReglage, journal,
    listerFanzzy, creerFanzzy, modifierFanzzy, listerSeries,
    listerSaisons, creerSaison, modifierSaison, lancerSaison, supprimerSaison,
    creerTenue, modifierTenue });
}
