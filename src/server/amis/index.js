import express from 'express';
import { racineDe, auStade } from '../fanzzy/catalogue.js';

/**
 * Les amis.
 *
 * Le jeu se joue à côté d'autres gens — la même corde, le même KOP, le même
 * classement — mais rien ne permettait de les **retrouver**. On poussait à
 * mille dans un virage sans jamais savoir qui était là. Ce module répond à une
 * seule question : *qui d'autre supporte mon club, et comment le garder ?*
 *
 * ## Ce qui est public, et ce qui ne l'est pas
 *
 * On expose un pseudo, un identifiant public et les clubs qu'on a en commun —
 * exactement ce qu'un classement montre déjà. **Jamais** d'adresse e-mail,
 * jamais la liste complète des clubs suivis par quelqu'un d'autre : seulement
 * ceux qu'on partage avec lui. La différence n'a l'air de rien ; c'est
 * pourtant celle entre « on se croise au stade » et « je sais où tu vas le
 * week-end ».
 *
 * ## Une ligne pour deux personnes
 *
 * Une amitié est une paire, pas une flèche. La table range donc les deux
 * identifiants — le plus petit d'abord — et n'en garde qu'une ligne, avec
 * `par` pour dire qui a demandé. C'est la base qui interdit alors les demandes
 * croisées et les doublons ; le code n'a pas à y veiller, donc il ne peut pas
 * l'oublier.
 *
 * ## Le refus se garde
 *
 * Un refus efface la demande **mais laisse la trace**, et une nouvelle demande
 * n'est possible qu'après un délai. Sans cette trace, dire non ne servirait à
 * rien : la demande reviendrait dans la seconde, autant de fois que l'autre le
 * voudrait.
 */

/** Le délai avant de pouvoir redemander à quelqu'un qui a dit non. */
export const DELAI_APRES_REFUS_MS = 7 * 24 * 60 * 60 * 1000;

/** Au plus tant de suggestions : c'est une page, pas un annuaire. */
const MAX_SUGGESTIONS = 40;

export function createAmis({ pool, requireAuth, kop = null }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const fail = (code, extra) => Object.assign(new Error(code), { code, extra });

  /**
   * Le Fanzzy équipé de quelqu'un, **à l'âge qu'il a atteint**.
   *
   * On se reconnaît à son personnage avant de lire un pseudo : autant que ce
   * soit le bon. La base garde la lignée dans le portefeuille et le stade dans
   * la collection ; le catalogue fait le reste.
   *
   * Sous garde, et pas par prudence excessive : le catalogue est chargé au
   * démarrage du serveur, mais une suite de test peut monter ce module sans
   * lui. Un avatar au premier âge vaut mieux qu'une liste d'amis qui lève.
   */
  function ageDe(id, stade) {
    if (!id) return null;
    try {
      const racine = racineDe(id);
      return (auStade(racine, Math.max(1, Number(stade) || 1)) ?? { id: racine }).id;
    } catch { return id; }
  }

  /** La paire, rangée. Tout passe par ici : deux ordres, ce serait deux lignes. */
  const paire = (x, y) => (x < y ? [x, y] : [y, x]);

  /* --------------------------------------------------------------- lire */

  /**
   * Tout ce qu'un joueur doit voir d'un coup : ses amis, ce qu'on lui demande,
   * ce qu'il a demandé, et les KOP où on l'invite.
   *
   * En une seule réponse plutôt qu'en quatre appels : ces listes sont courtes,
   * elles s'affichent ensemble, et une page qui les charge séparément affiche
   * ses onglets les uns après les autres.
   */
  async function tableau(userId) {
    const lignes = await q(
      `SELECT am.a, am.b, am.par, am.etat, am.demande_le,
              u.public_id, u.pseudo, w.active_fanzzy, uf.stage
         FROM amities am
         JOIN users u ON u.public_id = IF(am.a = ?, am.b, am.a)
         LEFT JOIN user_wallet w ON w.user_id = u.public_id
         LEFT JOIN user_fanzzy uf ON uf.user_id = u.public_id
                                 AND uf.fanzzy_id = w.active_fanzzy
        WHERE (am.a = ? OR am.b = ?) AND am.etat IN ('demande','amis')
        ORDER BY am.demande_le DESC`,
      [userId, userId, userId]);

    const gens = lignes.map((l) => ({
      id: l.public_id,
      pseudo: l.pseudo,
      fanzzy: ageDe(l.active_fanzzy, l.stage),
      etat: l.etat,
      // « à moi de répondre » : la demande vient de l'autre.
      aMoi: l.etat === 'demande' && l.par !== userId,
      depuis: l.demande_le,
    }));

    return {
      amis: gens.filter((g) => g.etat === 'amis'),
      recues: gens.filter((g) => g.etat === 'demande' && g.aMoi),
      envoyees: gens.filter((g) => g.etat === 'demande' && !g.aMoi),
      invitations: await invitationsDe(userId),
    };
  }

  /** Les KOP où l'on m'invite, avec qui invite et ce que pèse le groupe. */
  async function invitationsDe(userId) {
    return q(
      `SELECT i.kop_id AS kopId, i.le, k.nom, k.team_id AS teamId, k.pot,
              t.name AS club, u.pseudo AS parQui,
              (SELECT COUNT(*) FROM kop_membres m WHERE m.kop_id = k.id) AS membres
         FROM kop_invites i
         JOIN kops k ON k.id = i.kop_id
         LEFT JOIN teams t ON t.id = k.team_id
         LEFT JOIN users u ON u.public_id = i.par
        WHERE i.user_id = ?
        ORDER BY i.le DESC`, [userId]);
  }

  /**
   * Les gens qui suivent au moins un de mes clubs.
   *
   * **Seuls les clubs communs remontent**, et c'est délibéré : on n'apprend
   * pas de quelqu'un qu'il suit six autres équipes. Le tri met devant ceux
   * avec qui on en partage le plus — c'est la meilleure approximation de
   * « vous vous croiserez souvent ».
   *
   * Ceux qu'on connaît déjà — amis, demandes en cours, refus dans les deux
   * sens — n'y sont plus : une liste qui repropose sans cesse la personne qui
   * a dit non n'est pas une suggestion, c'est une insistance.
   */
  async function suggestions(userId) {
    /* Une ligne par club partagé, regroupée ici plutôt que par un
       `GROUP_CONCAT`. Recoller des noms de clubs dans une seule chaîne
       demande un séparateur qu'aucun nom ne contient — et ce genre de pari se
       perd un jour, silencieusement, sur une équipe au nom inhabituel.

       Le `NOT EXISTS` regarde **les deux sens** au lieu de ranger la paire
       avec `LEAST`/`GREATEST` : le rangement de la table suit l'ordre de
       JavaScript, celui de SQL suivrait la collation de la colonne. Les deux
       coïncident sur des identifiants en minuscules, et cesseraient de
       coïncider le jour où ils changeraient de forme — en ne montrant rien
       d'autre qu'une suggestion qui revient alors qu'on l'a écartée. */
    const lignes = await q(
      `SELECT u.public_id AS id, u.pseudo, w.active_fanzzy AS fanzzy, uf.stage, t.name AS club
         FROM user_follows f
         JOIN user_follows moi ON moi.team_id = f.team_id AND moi.user_id = ?
         JOIN users u ON u.public_id = f.user_id
         LEFT JOIN teams t ON t.id = f.team_id
         LEFT JOIN user_wallet w ON w.user_id = u.public_id
         LEFT JOIN user_fanzzy uf ON uf.user_id = u.public_id
                                 AND uf.fanzzy_id = w.active_fanzzy
        WHERE f.user_id <> ?
          AND NOT EXISTS (
            SELECT 1 FROM amities am
             WHERE (am.a = ? AND am.b = u.public_id)
                OR (am.a = u.public_id AND am.b = ?))
        ORDER BY u.pseudo`,
      [userId, userId, userId, userId]);

    const par = new Map();
    for (const l of lignes) {
      const g = par.get(l.id)
        ?? { id: l.id, pseudo: l.pseudo, fanzzy: ageDe(l.fanzzy, l.stage), clubs: [] };
      if (l.club) g.clubs.push(l.club);
      par.set(l.id, g);
    }
    // Le plus de clubs en commun d'abord : c'est la meilleure approximation de
    // « vous vous croiserez souvent ».
    return [...par.values()]
      .map((g) => ({ ...g, communs: g.clubs.length }))
      .sort((x, y) => y.communs - x.communs || x.pseudo.localeCompare(y.pseudo, 'fr'))
      .slice(0, MAX_SUGGESTIONS);
  }

  /* ------------------------------------------------------------ demander */

  /** L'état actuel d'une paire, ou `null` si ces deux-là ne se connaissent pas. */
  async function lien(x, y) {
    const [a, b] = paire(x, y);
    return (await q(`SELECT * FROM amities WHERE a = ? AND b = ?`, [a, b]))[0] ?? null;
  }

  async function demander(userId, autreId) {
    if (!autreId || autreId === userId) throw fail('amis.error.soi_meme');
    const cible = (await q(`SELECT public_id FROM users WHERE public_id = ?`, [autreId]))[0];
    if (!cible) throw fail('amis.error.inconnu');

    const deja = await lien(userId, autreId);
    if (deja?.etat === 'amis') throw fail('amis.error.deja_amis');
    if (deja?.etat === 'demande') {
      /* Il m'avait déjà demandé : redemander, c'est accepter. C'est ce que le
         joueur veut dire, et lui répondre « demande déjà en cours » le
         laisserait chercher où l'accepter. */
      if (deja.par !== userId) return repondre(userId, autreId, true);
      throw fail('amis.error.deja_demande');
    }
    if (deja?.etat === 'refuse') {
      const depuis = Date.now() - new Date(deja.repondu_le ?? deja.demande_le).getTime();
      if (depuis < DELAI_APRES_REFUS_MS) {
        throw fail('amis.error.refus_recent',
          { jours: Math.ceil((DELAI_APRES_REFUS_MS - depuis) / 86_400_000) });
      }
      // Le délai est passé : la ligne repart à zéro plutôt que de s'empiler.
      const [a, b] = paire(userId, autreId);
      await q(`UPDATE amities SET par = ?, etat = 'demande', demande_le = NOW(3),
                                  repondu_le = NULL WHERE a = ? AND b = ?`,
        [userId, a, b]);
      return { etat: 'demande' };
    }

    const [a, b] = paire(userId, autreId);
    try {
      await q(`INSERT INTO amities (a, b, par, etat) VALUES (?, ?, ?, 'demande')`,
        [a, b, userId]);
    } catch (e) {
      // Deux clics simultanés : la base a tranché, on ne se plaint pas d'un
      // doublon que le joueur ne voit même pas.
      if (e.code === 'ER_DUP_ENTRY') throw fail('amis.error.deja_demande');
      throw e;
    }
    return { etat: 'demande' };
  }

  /**
   * Répondre à une demande reçue.
   *
   * On ne répond qu'à une demande **qu'on n'a pas faite** : sans cette garde,
   * on accepterait sa propre demande et l'on serait ami avec qui n'a rien dit.
   */
  async function repondre(userId, autreId, oui) {
    const l = await lien(userId, autreId);
    if (!l || l.etat !== 'demande') throw fail('amis.error.pas_de_demande');
    if (l.par === userId) throw fail('amis.error.pas_a_toi');

    const [a, b] = paire(userId, autreId);
    await q(`UPDATE amities SET etat = ?, repondu_le = NOW(3) WHERE a = ? AND b = ?`,
      [oui ? 'amis' : 'refuse', a, b]);
    return { etat: oui ? 'amis' : 'refuse' };
  }

  /**
   * Retirer : annuler sa demande, ou défaire une amitié.
   *
   * La ligne disparaît vraiment. Ce n'est pas un refus — personne n'a dit non,
   * et rien ne justifie d'imposer un délai avant de se reparler.
   */
  async function retirer(userId, autreId) {
    const [a, b] = paire(userId, autreId);
    const r = await q(
      `DELETE FROM amities WHERE a = ? AND b = ? AND etat IN ('demande','amis')
         AND (? = a OR ? = b)`, [a, b, userId, userId]);
    if (!r.affectedRows) throw fail('amis.error.pas_de_lien');
    return { retire: true };
  }

  /* -------------------------------------------------------- le KOP à deux */

  /**
   * Inviter quelqu'un dans un de mes KOP.
   *
   * L'invitation ne donne **aucun droit** : rejoindre un KOP est déjà ouvert à
   * qui suit le club. Elle désigne un groupe à quelqu'un qui ne l'aurait pas
   * cherché, et c'est tout — ce qui explique qu'on puisse l'effacer sans rien
   * casser.
   *
   * Trois refus, et chacun dit sa cause : on n'invite pas dans un KOP dont on
   * n'est pas membre, on n'invite pas quelqu'un qui ne suit pas le club — il
   * ne pourrait pas accepter — et on n'invite pas un membre.
   */
  async function inviterAuKop(userId, autreId, kopId) {
    const k = (await q(
      `SELECT k.id, k.nom, k.team_id FROM kops k
         JOIN kop_membres m ON m.kop_id = k.id AND m.user_id = ?
        WHERE k.id = ?`, [userId, kopId]))[0];
    if (!k) throw fail('amis.error.pas_ton_kop');

    const suit = await q(
      `SELECT 1 FROM user_follows WHERE user_id = ? AND team_id = ?`, [autreId, k.team_id]);
    if (!suit.length) throw fail('amis.error.pas_son_club');

    const membre = await q(
      `SELECT 1 FROM kop_membres WHERE kop_id = ? AND user_id = ?`, [kopId, autreId]);
    if (membre.length) throw fail('amis.error.deja_membre');

    await q(`INSERT INTO kop_invites (kop_id, user_id, par) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE par = VALUES(par), le = NOW(3)`,
      [kopId, autreId, userId]);
    return { invite: true, kop: { id: k.id, nom: k.nom, teamId: k.team_id } };
  }

  /**
   * Accepter ou décliner une invitation.
   *
   * L'acceptation passe par le module KOP, pas par un `INSERT` d'ici : les
   * règles d'entrée — suivre le club, un seul KOP par club — y sont déjà
   * écrites, et une seconde porte d'entrée finirait par ne plus les appliquer
   * toutes. L'invitation est consommée dans les deux cas.
   */
  async function repondreAuKop(userId, kopId, oui) {
    const inv = (await q(
      `SELECT * FROM kop_invites WHERE kop_id = ? AND user_id = ?`, [kopId, userId]))[0];
    if (!inv) throw fail('amis.error.pas_invite');

    let rejoint = null;
    if (oui) {
      if (!kop?.rejoindre) throw fail('amis.error.kop_indisponible');
      rejoint = await kop.rejoindre(userId, kopId);
    }
    await q(`DELETE FROM kop_invites WHERE kop_id = ? AND user_id = ?`, [kopId, userId]);
    return { rejoint };
  }

  /* ------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (res.headersSent) return;
    // Les codes du KOP traversent tels quels : une invitation refusée parce
    // qu'on est déjà dans un autre KOP du club doit le dire avec les mots du
    // KOP, pas se transformer en « erreur serveur ».
    const propre = String(e.code ?? '').startsWith('amis.')
      || String(e.code ?? '').startsWith('kop.');
    if (!propre) console.error('[amis]', e.message);
    res.status(400).json({ error: propre ? e.code : 'amis.error.server', ...(e.extra ?? {}) });
  });

  router.get('/', requireAuth, safe(async (req, res) =>
    res.json(await tableau(req.user.id))));

  router.get('/suggestions', requireAuth, safe(async (req, res) =>
    res.json({ gens: await suggestions(req.user.id) })));

  router.post('/demande', requireAuth, safe(async (req, res) =>
    res.json(await demander(req.user.id, String(req.body?.id ?? '')))));

  router.post('/reponse', requireAuth, safe(async (req, res) =>
    res.json(await repondre(req.user.id, String(req.body?.id ?? ''), Boolean(req.body?.ok)))));

  router.delete('/:id', requireAuth, safe(async (req, res) =>
    res.json(await retirer(req.user.id, String(req.params.id)))));

  router.post('/kop/inviter', requireAuth, safe(async (req, res) =>
    res.json(await inviterAuKop(req.user.id, String(req.body?.id ?? ''),
      String(req.body?.kopId ?? '')))));

  router.post('/kop/reponse', requireAuth, safe(async (req, res) =>
    res.json(await repondreAuKop(req.user.id, String(req.body?.kopId ?? ''),
      Boolean(req.body?.ok)))));

  return { router, tableau, suggestions, demander, repondre, retirer,
           inviterAuKop, repondreAuKop };
}
