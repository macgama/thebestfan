/**
 * « Depuis ta dernière visite » : le ticket qui glisse trois secondes au lever
 * du rideau (`CONTRATS.md`, § 8).
 *
 * ## Ce qu'il dit, et ce qu'il tait
 *
 * Des faits, comptés par le serveur : des amitiés acceptées, des demandes
 * reçues, ce qui s'est passé dans ses KOP (arrivées, versements au pot, votes
 * clos), les invitations, les matchs finis de ses clubs, les cartes-souvenirs
 * gagnées, une saison lancée. **Jamais un montant d'écharpes** : le jeu ne
 * tient aucun journal de tout ce qu'il verse, et un chiffre partiel mentirait.
 *
 * ## Une marque qu'un `GET` ne déplace pas
 *
 * La marque (`user_wallet.visite_a`) n'avance que par `POST /visite`, que le
 * hub envoie **après** avoir montré le ticket. Un aperçu de lien ou un
 * préchargement qui lirait l'état ne mange donc pas le ticket.
 *
 * Tout se compare **en SQL** à cette marque : elle est écrite par `NOW(3)`,
 * et les colonnes qu'on lui oppose aussi (`repondu_le`, `depuis`, `ferme`,
 * `le`, `acquired_at`, `lancee_a`). Les matchs font exception, comme partout :
 * `kickoff_at` est en UTC, et se compare à `UTC_TIMESTAMP()` décalé du temps
 * écoulé depuis la marque, mesuré en secondes Unix.
 *
 * ## Ce que coûte un ticket
 *
 * Six lectures au plus, et seulement quand la marque a au moins
 * `quotidien.retour_heures` : le hub le demande à chaque arrivée, et la
 * réponse « pas de ticket » se décide dans la lecture du jour, sans une
 * requête de plus.
 */

/* La marque, relue dans chaque requête plutôt que passée par le pilote : un
   DATETIME aller-retour par un pool en `timezone: 'Z'` changerait d'heure.

   sql-sur : les requêtes de ce fichier n'interpolent que ce fragment et la
   clause constante de `marquerVisite` ; les valeurs passent toutes par `?`. */
const MARQUE = '(SELECT visite_a FROM user_wallet WHERE user_id = ?)';

const SCHEMA = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR']);

/* Une table absente (un fichier de schéma pas encore appliqué) retire la
   rubrique qu'elle porte, pas le ticket : un KOP illisible ne doit pas cacher
   l'ami qui vient d'accepter. */
async function essai(fn, defaut) {
  try { return await fn(); } catch (e) {
    if (SCHEMA.has(e?.code)) return defaut;
    throw e;
  }
}

/** Le JSON d'une colonne : objet ou texte selon le pilote et la version. */
function json(v) {
  if (v == null) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v) ?? {}; } catch { return {}; }
}

/**
 * Le ticket, ou `null` s'il n'y a rien à dire.
 *
 * @param lire        (sql, params) → lignes
 * @param userId      l'identifiant public du joueur
 * @param ilYaMs      l'absence, déjà mesurée par la lecture du jour
 * @param instantane  la photo des pots à la marque (`user_wallet.instantane`)
 */
export async function lireDepuis(lire, userId, { ilYaMs, instantane }) {
  const [amis, compteurs, kops, evenements, matchs, saisons] = await Promise.all([
    /* Les amitiés acceptées depuis, dans les deux sens, et les demandes
       reçues en attente. `repondu_le` est écrit à l'acceptation (et à
       l'amitié directe d'un parrainage) ; un compte effacé ne se montre pas. */
    essai(() => lire(
      `(SELECT 'ami' AS sorte, u.public_id AS id, u.pseudo AS pseudo, 1 AS n
          FROM amities a
          JOIN users u ON u.public_id = IF(a.a = ?, a.b, a.a)
         WHERE (a.a = ? OR a.b = ?) AND a.etat = 'amis' AND u.status = 'active'
           AND a.repondu_le > ${MARQUE}
         ORDER BY a.repondu_le DESC
         LIMIT 5)
       UNION ALL
       (SELECT 'demande', NULL, NULL, COUNT(*)
          FROM amities a
         WHERE (a.a = ? OR a.b = ?) AND a.etat = 'demande' AND a.par <> ?
           AND a.demande_le > ${MARQUE})`,
      [userId, userId, userId, userId, userId, userId, userId, userId]), []),
    /* Deux compteurs, une lecture. */
    essai(() => lire(
      `SELECT (SELECT COUNT(*) FROM kop_invites WHERE user_id = ? AND le > ${MARQUE}) AS invitations,
              (SELECT COUNT(*) FROM user_souvenirs WHERE user_id = ? AND acquired_at > ${MARQUE})
                AS souvenirs`,
      [userId, userId, userId, userId]), []),
    essai(() => lire(
      `SELECT k.id, k.nom, k.pot, k.verse_total
         FROM kops k JOIN kop_membres m ON m.kop_id = k.id
        WHERE m.user_id = ?`, [userId]), []),
    /* Les arrivées dans ses KOP et les votes clos depuis. Un vote dont
       l'échéance est passée mais qui n'a pas encore été dépouillé (il l'est à
       la lecture du KOP) reste « en_cours » : on ne sait pas son issue, on
       n'en dit rien. */
    essai(() => lire(
      `(SELECT 'arrivee' AS sorte, m.kop_id, u.pseudo AS quoi, NULL AS issue, m.depuis AS quand
          FROM kop_membres m JOIN users u ON u.public_id = m.user_id
         WHERE m.kop_id IN (SELECT kop_id FROM kop_membres WHERE user_id = ?)
           AND m.user_id <> ? AND u.status = 'active' AND m.depuis > ${MARQUE})
       UNION ALL
       (SELECT 'vote', v.kop_id, v.bonus_id, v.issue, v.ferme
          FROM kop_votes v
         WHERE v.kop_id IN (SELECT kop_id FROM kop_membres WHERE user_id = ?)
           AND v.issue <> 'en_cours' AND v.ferme > ${MARQUE} AND v.ferme <= NOW(3))
       ORDER BY quand DESC`,
      [userId, userId, userId, userId, userId]), []),
    /* Les matchs finis de ses clubs, au coup d'envoi postérieur à la marque.
       `kickoff_at` est en UTC : la borne est l'heure UTC moins l'absence,
       mesurée en secondes Unix dans la base.

       Et les cartons rouges de chaque camp, pour que le Fanzzy de l'accueil
       se fâche de celui que son club a pris (lot 7). L'API en a deux : le
       rouge direct et le second jaune, qui expulse tout autant. La
       collation compare sans la casse — l'API écrit `Second Yellow card`,
       mais rien ne garantit qu'elle s'y tienne. */
    essai(() => lire(
      `SELECT f.id, f.home_id, f.away_id, f.home_goals, f.away_goals,
              th.name AS domicile, ta.name AS exterieur,
              (SELECT COUNT(*) FROM fixture_events e
                WHERE e.fixture_id = f.id AND e.team_id = f.home_id AND e.type = 'Card'
                  AND e.detail IN ('Red Card', 'Second Yellow card')) AS rouges_domicile,
              (SELECT COUNT(*) FROM fixture_events e
                WHERE e.fixture_id = f.id AND e.team_id = f.away_id AND e.type = 'Card'
                  AND e.detail IN ('Red Card', 'Second Yellow card')) AS rouges_exterieur,
              (SELECT uf.team_id FROM user_follows uf
                WHERE uf.user_id = ? AND uf.team_id IN (f.home_id, f.away_id)
                ORDER BY uf.is_main DESC, uf.created_at LIMIT 1) AS club
         FROM fixtures f
         LEFT JOIN teams th ON th.id = f.home_id
         LEFT JOIN teams ta ON ta.id = f.away_id
        WHERE f.status_short IN ('FT', 'AET', 'PEN')
          AND (f.home_id IN (SELECT team_id FROM user_follows WHERE user_id = ?)
               OR f.away_id IN (SELECT team_id FROM user_follows WHERE user_id = ?))
          AND f.kickoff_at > UTC_TIMESTAMP()
                - INTERVAL (UNIX_TIMESTAMP() - UNIX_TIMESTAMP(${MARQUE})) SECOND
        ORDER BY f.kickoff_at DESC
        LIMIT 3`,
      [userId, userId, userId, userId]), []),
    essai(() => lire(
      `SELECT id, numero, nom FROM saisons
        WHERE lancee_a IS NOT NULL AND lancee_a > ${MARQUE}
        ORDER BY lancee_a DESC LIMIT 1`, [userId]), []),
  ]);

  const d = {};

  const nouveaux = amis.filter((r) => r.sorte === 'ami').slice(0, 5)
    .map((r) => ({ id: String(r.id), pseudo: r.pseudo }));
  const demandes = Number(amis.find((r) => r.sorte === 'demande')?.n ?? 0);
  if (nouveaux.length || demandes) {
    d.amis = { ...(nouveaux.length ? { nouveaux } : {}), ...(demandes ? { demandes } : {}) };
  }

  const photo = json(instantane);
  const kopsVus = [];
  for (const k of kops) {
    const entree = { id: String(k.id), nom: k.nom };
    const arrivees = evenements
      .filter((e) => e.sorte === 'arrivee' && e.kop_id === k.id).slice(0, 5).map((e) => e.quoi);
    if (arrivees.length) entree.arrivees = arrivees;
    /* Le pot et ce qui y est tombé, comparés à la photo prise à la marque.
       Un KOP rejoint depuis n'a pas de photo : on ne sait pas ce qu'il
       valait, on n'en dit rien. `verse_total` ne descend jamais (le pot,
       lui, descend quand on achète) : c'est le seul cumul daté par
       différence. */
    const avant = photo[k.id];
    if (avant && Number.isFinite(Number(avant.verse))) {
      const verse = Number(k.verse_total) - Number(avant.verse);
      if (verse > 0) entree.verse = verse;
      if (Number(avant.pot) !== Number(k.pot) || verse > 0) {
        entree.pot = { avant: Number(avant.pot), apres: Number(k.pot) };
      }
    }
    const votes = evenements.filter((e) => e.sorte === 'vote' && e.kop_id === k.id)
      .map((e) => ({ bonusId: e.quoi, issue: e.issue }));
    if (votes.length) entree.votes = votes;
    if (entree.arrivees || entree.verse || entree.votes || entree.pot) kopsVus.push(entree);
  }
  if (kopsVus.length) d.kops = kopsVus;

  const c = compteurs[0] ?? {};
  if (Number(c.invitations) > 0) d.invitationsKop = Number(c.invitations);

  const finis = matchs.filter((x) => x.club != null).map((x) => {
    const chezSoi = Number(x.club) === Number(x.home_id);
    const pour = Number(chezSoi ? x.home_goals : x.away_goals);
    const contre = Number(chezSoi ? x.away_goals : x.home_goals);
    const rouges = Number(chezSoi ? x.rouges_domicile : x.rouges_exterieur) || 0;
    return {
      fixtureId: Number(x.id),
      domicile: x.domicile ?? '',
      exterieur: x.exterieur ?? '',
      score: [Number(x.home_goals ?? 0), Number(x.away_goals ?? 0)],
      club: (chezSoi ? x.domicile : x.exterieur) ?? '',
      issue: pour > contre ? 'gagne' : pour < contre ? 'perdu' : 'nul',
      /* Ceux du club suivi seulement, et absent sans rouge : un rouge de
         l'adversaire ne fâche personne de ce côté-ci. */
      ...(rouges > 0 ? { rouges } : {}),
    };
  });
  if (finis.length) d.matchs = finis;

  if (Number(c.souvenirs) > 0) d.souvenirs = Number(c.souvenirs);

  const s = saisons[0];
  if (s) d.saison = { id: Number(s.id), numero: Number(s.numero), nom: s.nom };

  /* Rien à dire : pas de ticket du tout. Un ticket « rien de neuf » apprend
     à ne plus le lire. */
  if (!Object.keys(d).length) return null;
  return { ilYaMs, ...d };
}

/**
 * Déplace la marque, et photographie les pots de ses KOP au même instant.
 *
 * **Au plus une écriture par minute** : le hub l'envoie à chaque arrivée, et
 * une écriture à chaque retour au hub ne servirait à rien. La condition est
 * dans l'`UPDATE` lui-même, pas lue avant : deux onglets qui arrivent ensemble
 * n'écrivent qu'une fois.
 *
 * La photo est fabriquée par la base, dans la même instruction : l'identifiant
 * d'un KOP est un UUID et les deux montants des entiers, il n'y a rien à
 * échapper. Sans KOP, elle est nulle.
 *
 * @returns le nombre de lignes écrites (0 ou 1)
 */
export async function marquerVisite(lire, userId) {
  const conditions = 'WHERE user_id = ? AND (visite_a IS NULL OR visite_a < NOW(3) - INTERVAL 1 MINUTE)';
  try {
    const r = await lire(
      `UPDATE user_wallet
          SET visite_a = NOW(3),
              instantane = (SELECT CONCAT('{', GROUP_CONCAT(CONCAT('"', k.id, '":{"pot":', k.pot,
                                   ',"verse":', k.verse_total, '}')), '}')
                              FROM kops k JOIN kop_membres m ON m.kop_id = k.id
                             WHERE m.user_id = ?)
        ${conditions}`,
      [userId, userId]);
    return Number(r.affectedRows ?? 0);
  } catch (e) {
    /* Sans les tables des KOP, la marque avance quand même, sans photo. */
    if (e?.code !== 'ER_NO_SUCH_TABLE') throw e;
    const r = await lire(
      `UPDATE user_wallet SET visite_a = NOW(3), instantane = NULL ${conditions}`, [userId]);
    return Number(r.affectedRows ?? 0);
  }
}
