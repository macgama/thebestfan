import express from 'express';
import { parIdentifiant } from '../fanzzy/catalogue.js';

/**
 * Les classements.
 *
 * Trois échelles, et elles ne récompensent pas la même chose :
 *
 *   — les supporters, sur la ferveur donnée dans le Grand Virage. C'est du
 *     temps et de la justesse, pas de la collection : un joueur qui n'a jamais
 *     ouvert un booster peut être premier.
 *   — les tribunes, c'est-à-dire les clubs classés par la ferveur cumulée de
 *     leurs supporters, ramenée à leur nombre. Sans cette division, le plus
 *     gros club gagnerait toujours et personne ne défendrait le sien.
 *   — les duellistes, sur les duels gagnés, entraînements exclus.
 *
 * Les trois se déclinent aussi **par compétition et par saison**, sur la même
 * ferveur : « qui a le plus donné en Ligue 1 cette année » est une question
 * qu'on peut gagner, là où le classement mondial ne se vise pas. Le Duel y
 * entre au même titre que le Virage — il compte la même ferveur, et il adosse
 * ses parties à un vrai match, donc à une compétition.
 *
 * Tout est calculé par agrégation et mis en cache : un classement n'a pas
 * besoin d'être exact à la seconde, et une requête lourde toutes les cinq
 * minutes vaut mieux que la même à chaque affichage.
 */

const TTL_MS = 5 * 60 * 1000;

export function createClassements({ pool, requireAuth,
  /* L'abonnement ouvre la **mémoire longue** du parcours : un joueur inscrit
     voit ses vingt dernières parties, un abonné tout son historique. Rien
     n’est effacé, et les classements ne changent pas d’un iota — c’est la
     lecture qui s’arrête. Voir `abonnement/index.js`. */
  abonnement = null }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  const cache = new Map();
  async function memo(cle, fn) {
    const hit = cache.get(cle);
    if (hit && Date.now() < hit.expire) return hit.valeur;
    const valeur = await fn();
    cache.set(cle, { valeur, expire: Date.now() + TTL_MS });
    return valeur;
  }

  /* Uniquement pour les tests : un classement est mémorisé deux minutes, et
     une suite qui écrit des lignes puis relit obtient sinon l'état d'avant —
     un rouge qui ne parle de rien. Même rôle que `oublier` du catalogue. */
  function oublier() { cache.clear(); }

  /* ============================================ la ferveur, où qu'elle naisse

     **Une seule monnaie, deux sources.** Le Grand Virage et le duel classé
     rapportent la même ferveur ; elle est comptée, écrite et lue de la même
     façon dans les deux cas.

     Ce n'était pas vrai. Le classement par compétition additionnait déjà les
     deux — voir `SOURCE`, plus bas, qui fait exactement ça — pendant que les
     deux classements qu'on voit en premier, SUPPORTERS et TRIBUNES, ne lisaient
     que `virage_presence`. Un joueur qui ne faisait que des duels avait donc
     de la ferveur, la voyait dans son parcours, la voyait au classement de la
     Ligue 1, et restait à zéro au classement des supporters. **Le même mot
     mesurait deux choses selon l'onglet**, et rien à l'écran ne pouvait
     l'expliquer.

     Il y avait deux réponses cohérentes — additionner partout, ou séparer
     partout. C'est la première qui est retenue : elle récompense de jouer,
     quelle que soit la façon, et elle ne demande à personne de choisir entre
     pousser et se battre.

     **L'entraînement reste dehors**, et c'est toute sa différence avec le duel
     classé. Le tri se fait ici, à la lecture, jamais à l'écriture : un joueur
     doit retrouver ses soirées d'entraînement dans son parcours, elles ne
     doivent simplement rapporter à personne.

     `quand` porte la date des deux côtés sous un seul nom — `last_push_at`
     pour le virage, `ended_at` pour le duel — pour que la fenêtre de temps
     n'ait pas à savoir d'où vient la ligne.

     `team_id` nul veut dire neutre : la ligne compte pour le joueur et pour la
     compétition, jamais pour une tribune. La règle s'applique d'elle-même, par
     la condition de jointure, sans avoir à l'écrire deux fois. */
  const FERVEUR = `
    SELECT user_id, team_id, ferveur, fixture_id, last_push_at AS quand
      FROM virage_presence
    UNION ALL
    SELECT user_id, team_id, ferveur, fixture_id, ended_at AS quand
      FROM duel_results WHERE mode = 'classe'`;

  /** Fenêtre : la saison en cours, ou les trente derniers jours. */
  const depuis = (periode) => (periode === 'mois'
    ? 'AND x.quand > (NOW(3) - INTERVAL 30 DAY)' : '');

  /* -------------------------------------------------------- supporters */

  async function supporters(periode = 'saison', limite = 50) {
    return memo(`sup:${periode}:${limite}`, () => q(
      `SELECT u.public_id, u.pseudo,
              SUM(x.ferveur) AS ferveur,
              COUNT(DISTINCT x.fixture_id) AS matchs,
              (SELECT COUNT(*) FROM user_souvenirs us
                WHERE us.user_id = u.public_id AND us.kind = 'presence') AS vecus,
              (SELECT t.name FROM user_follows f JOIN teams t ON t.id = f.team_id
                WHERE f.user_id = u.public_id ORDER BY f.is_main DESC LIMIT 1) AS club
         FROM (${FERVEUR}) x
         JOIN users u ON u.public_id = x.user_id
        WHERE u.status = 'active' ${depuis(periode)}
        GROUP BY u.public_id, u.pseudo
        ORDER BY ferveur DESC
        LIMIT ${Number(limite) || 50}`));
  }

  /* ----------------------------------------------------------- tribunes */

  /**
   * Les clubs, classés sur la ferveur moyenne par supporter.
   * Un petit club dont trente fidèles chantent juste passe devant un géant
   * dont mille abonnés regardent — c'est exactement ce qu'on veut célébrer.
   *
   * ## La jointure porte **deux** conditions, et la seconde est la règle
   *
   * Elle n'en portait qu'une — `vp.user_id = f.user_id` — et la ferveur d'un
   * supporter était donc versée à **tous les clubs qu'il suit**. Quelqu'un qui
   * suit Sion et Bâle et qui pousse une soirée entière dans le virage de Sion
   * faisait monter Bâle d'autant, sans y avoir chanté une seule fois.
   *
   * Ça ne se voyait pas : les deux nombres étaient plausibles, le classement
   * gardait un ordre vraisemblable, et il fallait suivre deux clubs pour que
   * l'écart existe — ce que fait une minorité de joueurs, mais la plus
   * assidue. Le résultat était un classement des clubs les plus **suivis en
   * plus d'un autre**, pas des mieux poussés.
   *
   * `vp.team_id` porte la réponse depuis `sql/historique.sql`, et le
   * classement par compétition l'utilise déjà (voir `SOURCE`). Les deux
   * lectures disent enfin la même chose.
   *
   * Un neutre a `team_id` nul : sa ferveur ne remonte à aucune tribune, ce
   * qui est la règle du jeu, et la condition l'applique sans avoir à l'écrire.
   */
  async function tribunes(limite = 50) {
    return memo(`trib:${limite}`, () => q(
      `SELECT t.id, t.name, t.logo, t.country,
              COUNT(DISTINCT f.user_id) AS supporters,
              COALESCE(SUM(x.ferveur), 0) AS ferveur,
              ROUND(COALESCE(SUM(x.ferveur), 0) / GREATEST(COUNT(DISTINCT f.user_id), 1)) AS moyenne
         FROM user_follows f
         JOIN teams t ON t.id = f.team_id
         LEFT JOIN (${FERVEUR}) x
                ON x.user_id = f.user_id AND x.team_id = f.team_id
         GROUP BY t.id, t.name, t.logo, t.country
        HAVING supporters >= 1
        ORDER BY moyenne DESC, ferveur DESC
        LIMIT ${Number(limite) || 50}`));
  }

  /* -------------------------------------------------------- duellistes */

  /**
   * Les duellistes, classés sur leur **cote**.
   *
   * ## Pourquoi pas sur les victoires
   *
   * C'était le cas, et ça récompensait celui qui joue beaucoup : quelqu'un qui
   * gagne une fois sur deux mais joue trois soirs par semaine passait devant
   * quelqu'un qui gagne quatre fois sur cinq et joue le samedi. Ce n'est pas
   * faux — l'assiduité compte — mais ce n'est pas ce que le mot « duelliste »
   * promet, et l'assiduité a son tableau à elle depuis qu'existe celui des
   * entraînements.
   *
   * Une cote répond à l'autre question : **contre qui as-tu gagné ?** Voir
   * `shared/cote.js` pour la formule et les trois choix qui ne sont pas dedans.
   *
   * ## La cote du moment, c'est la dernière écrite
   *
   * Elle est cumulative : chaque partie part de la précédente. La cote actuelle
   * de quelqu'un est donc l'`elo_after` de sa dernière partie classée, et non
   * une moyenne ni une somme — les deux n'auraient aucun sens ici.
   *
   * D'où la sous-requête plutôt qu'un `MAX` : `MAX(elo_after)` rendrait le
   * meilleur jour de quelqu'un, pas son niveau. C'est une erreur qui ne se voit
   * pas, parce que les deux nombres se ressemblent.
   */
  /* Trois parties avant d'entrer, pour les duels comme pour l'entraînement.
     Nommé plutôt qu'écrit deux fois dans deux `HAVING` : le jour où le chiffre
     bouge, il doit bouger dans la règle **et** dans la phrase que lit le
     joueur, et deux littéraux ne bougent jamais ensemble. */
  const PLANCHER_CLASSE = 3;

  async function duellistes(limite = 50) {
    return memo(`duel:${limite}`, () => q(
      `SELECT u.public_id, u.pseudo,
              SUM(dr.outcome = 'win') AS gagnes,
              COUNT(*) AS joues,
              ROUND(100 * SUM(dr.outcome = 'win') / COUNT(*)) AS taux,
              (SELECT d2.elo_after FROM duel_results d2
                WHERE d2.user_id = u.public_id AND d2.mode = 'classe'
                ORDER BY d2.ended_at DESC LIMIT 1) AS cote,
              /* **Pour qui il se bat.** SUPPORTERS et ENTRAÎNEMENT nomment le
                 club de chacun ; DUELS, seul des trois, le taisait — et c'est
                 pourtant là qu'il compte le plus, puisqu'un duel classé ne se
                 joue que pendant un match de son club. Trois tableaux côte à
                 côte dont un seul omet la même donnée se lisent comme une
                 donnée perdue, et c'en était une. */
              (SELECT t.name FROM user_follows fo JOIN teams t ON t.id = fo.team_id
                WHERE fo.user_id = u.public_id ORDER BY fo.is_main DESC LIMIT 1) AS club
         FROM duel_results dr
         JOIN users u ON u.public_id = dr.user_id
        WHERE u.status = 'active' AND dr.mode = 'classe'
        GROUP BY u.public_id, u.pseudo
       HAVING joues >= ${PLANCHER_CLASSE}
        ORDER BY cote DESC, joues DESC
        LIMIT ${Number(limite) || 50}`));
  }

  /* ---------------------------------------------------- les entraînements

     **Un tableau de l'assiduité, et surtout pas un second classement.**

     L'entraînement ne rapporte rien : pas de ferveur, aucun effet sur le
     classement, et c'est toute sa différence avec le duel classé. Mais « ne
     rien rapporter » et « n'exister nulle part » sont deux choses, et c'est la
     seconde qu'on corrige ici : quelqu'un qui passe une soirée à s'entraîner
     n'en trouvait aucune trace ailleurs que dans son propre parcours.

     ## Il classe sur les parties jouées, pas sur les victoires

     Et ce n'est pas un détail de présentation. L'entraînement se joue aussi
     contre des machines — c'est même sa raison d'être, on s'entraîne quand
     personne n'est là. Classer sur les victoires ferait donc un tableau de qui
     bat le plus de bots, ce qui se gagne en y passant la nuit et ne dit rien de
     personne. Les parties jouées, elles, coûtent le même prix à tout le monde :
     cinq minutes chacune. Le tableau dit **qui s'entraîne**, et c'est ce qu'on
     voulait encourager.

     Les victoires sont montrées à côté, parce qu'elles intéressent celui qui
     les a — mais elles ne départagent qu'à égalité de parties, et jamais avant.

     ## Trois parties, comme l'autre

     Le même plancher que `duellistes`, pour la même raison : une liste où l'on
     entre après une partie est une liste où tout le monde est, donc une liste
     que personne ne regarde.
   */

  async function assidus(limite = 50) {
    return memo(`entr:${limite}`, () => q(
      `SELECT u.public_id, u.pseudo,
              COUNT(*) AS joues,
              SUM(dr.outcome = 'win') AS gagnes,
              (SELECT t.name FROM user_follows fo JOIN teams t ON t.id = fo.team_id
                WHERE fo.user_id = u.public_id ORDER BY fo.is_main DESC LIMIT 1) AS club
         FROM duel_results dr
         JOIN users u ON u.public_id = dr.user_id
        WHERE u.status = 'active' AND dr.mode = 'entrainement'
        GROUP BY u.public_id, u.pseudo
       HAVING joues >= ${PLANCHER_CLASSE}
        ORDER BY joues DESC, gagnes DESC
        LIMIT ${Number(limite) || 50}`));
  }

  /* ================================================ par compétition

     Les trois mêmes échelles, mais dans une compétition et une saison : « qui
     a le plus donné en Ligue 1 cette année », et non « qui a le plus donné ».
     C'est ce qui rend un classement atteignable — personne ne vise la tête
     d'un classement mondial, tout le monde vise la tête du sien.

     **Une seule monnaie, deux sources.** Le Grand Virage et le Duel comptent
     tous deux de la ferveur, et le duel adosse ses parties à un vrai match :
     les deux se lisent donc ensemble, et la compétition se déduit du match par
     une jointure. Rien n'est recopié — ni la compétition, ni la saison — parce
     que `fixtures` les porte déjà et que deux endroits qui portent la même
     valeur finissent par se contredire.

     **Le club soutenu décide de ce qui remonte au groupe.** Un neutre — venu
     pousser sur un match dont aucun club n'est le sien — compte pour lui-même
     et pour la compétition, mais sa ligne porte `team_id` nul : elle ne
     remonte ni à une tribune ni à un KOP, dont il n'est pas membre. C'est la
     règle du jeu, et elle est écrite ici en une condition de jointure.

     **L'entraînement ne compte pas.** Il s'écrit désormais — un joueur doit
     retrouver ses soirées dans son parcours — mais il ne rapporte rien à
     personne : c'est toute sa différence avec le duel classé. Le tri se fait
     ici, à la lecture, et non à l'écriture. Écarter ces parties au moment de
     les enregistrer aurait rendu le classement juste et le parcours faux. */

  /* `duel` distingue les deux sources sans les séparer : tout ce qui lit
     `SOURCE` additionne la même ferveur, et ce drapeau permet à qui le veut
     de compter les duels à part. L'annuaire des tribunes s'en sert — « combien
     de duels se sont joués pour ce club » est une question qu'on pose devant
     une compétition, et à laquelle rien ne répondait. */
  const SOURCE = `
    SELECT vp.user_id, vp.team_id, vp.ferveur, 0 AS duel
      FROM virage_presence vp
      JOIN fixtures f ON f.id = vp.fixture_id
     WHERE f.league_id = ? AND f.season = ?
    UNION ALL
    SELECT dr.user_id, dr.team_id, dr.ferveur, 1 AS duel
      FROM duel_results dr
      JOIN fixtures f ON f.id = dr.fixture_id
     WHERE f.league_id = ? AND f.season = ? AND dr.mode = 'classe'`;

  /**
   * La saison à classer, quand la page n'en demande pas.
   *
   * La page en connaît une — celle que le télétexte a choisie sur les dates de
   * la compétition — et elle la transmet. Ce repli ne sert qu'à répondre
   * quelque chose de sensé à une adresse tapée à la main : la saison la plus
   * récente dont on ait un match. Le refaire ici avec les dates dupliquerait
   * une règle qui vit déjà dans `teletext/seasonOf`.
   */
  async function saisonDe(leagueId) {
    const [r] = await q(
      `SELECT MAX(season) AS s FROM fixtures WHERE league_id = ?`, [leagueId]);
    return r?.s ?? null;
  }

  /** Les joueurs, sur la ferveur donnée dans cette compétition. */
  async function joueursDe(leagueId, saison, limite = 50) {
    return q(
      `SELECT u.public_id, u.pseudo,
              SUM(x.ferveur) AS ferveur,
              COUNT(*) AS seances,
              (SELECT t.name FROM user_follows fo JOIN teams t ON t.id = fo.team_id
                WHERE fo.user_id = u.public_id ORDER BY fo.is_main DESC LIMIT 1) AS club
         FROM (${SOURCE}) x
         JOIN users u ON u.public_id = x.user_id
        WHERE u.status = 'active'
        GROUP BY u.public_id, u.pseudo
       HAVING ferveur > 0
        ORDER BY ferveur DESC
        LIMIT ${Number(limite) || 50}`,
      [leagueId, saison, leagueId, saison]);
  }

  /**
   * Les tribunes d'une compétition : **toutes ses équipes**, poussées ou non.
   *
   * ## Ce que la liste tirait d'elle-même
   *
   * Elle se construisait à partir des lignes de ferveur — `JOIN teams ON
   * t.id = x.team_id` — puis écartait le reste par un `HAVING ferveur > 0`.
   * Autrement dit, un club n'existait que si quelqu'un avait déjà poussé pour
   * lui. Une compétition de vingt équipes en affichait deux, et la page les
   * présentait comme « le classement des tribunes » : on y cherchait son club,
   * on ne l'y trouvait pas, et rien ne disait s'il était mal classé ou
   * simplement absent du jeu.
   *
   * Les équipes viennent donc de `fixtures`, qui est la même source que les
   * résultats et le classement de la ligue affichés deux onglets plus loin :
   * la compétition montre partout le même plateau. Un club sans ferveur figure
   * à zéro, ce qui est une information — c'est une tribune à prendre.
   *
   * ## Pourquoi les duels sont comptés à part
   *
   * « Combien de duels se sont joués pour ce club » est la question qu'on pose
   * devant une compétition, et la ferveur seule n'y répond pas : elle mélange
   * le virage et le duel, qui ne demandent ni le même temps ni le même geste.
   *
   * ## La moyenne, comme ailleurs
   *
   * Divisée par le nombre de supporters du club, pas par celui de ceux qui ont
   * joué : mille abonnés qui regardent doivent peser contre trente fidèles qui
   * chantent. Sans cette division, le plus gros club gagne toujours et personne
   * ne défend le sien.
   */
  async function tribunesDe(leagueId, saison, limite = 50) {
    return q(
      `SELECT t.id, t.name, t.logo,
              COALESCE(f.ferveur, 0) AS ferveur,
              COALESCE(f.duels, 0) AS duels,
              COALESCE(s.n, 0) AS supporters,
              ROUND(COALESCE(f.ferveur, 0) / GREATEST(COALESCE(s.n, 1), 1)) AS moyenne
         FROM (SELECT home_id AS team_id FROM fixtures WHERE league_id = ? AND season = ?
               UNION
               SELECT away_id FROM fixtures WHERE league_id = ? AND season = ?) plateau
         JOIN teams t ON t.id = plateau.team_id
         LEFT JOIN (SELECT team_id, COUNT(*) AS n FROM user_follows GROUP BY team_id) s
                ON s.team_id = t.id
         LEFT JOIN (SELECT y.team_id, SUM(y.ferveur) AS ferveur, SUM(y.duel) AS duels
                      FROM (${SOURCE}) y GROUP BY y.team_id) f
                ON f.team_id = t.id
        ORDER BY moyenne DESC, ferveur DESC, t.name ASC
        LIMIT ${Number(limite) || 50}`,
      [leagueId, saison, leagueId, saison, leagueId, saison, leagueId, saison]);
  }

  /**
   * Les KOP.
   *
   * Un KOP est attaché à un club, et il ne marque que ce que ses membres ont
   * donné **pour ce club-là**. Un membre parti pousser ailleurs marque pour
   * lui et pour la compétition ; il ne rapporte rien à son groupe, qui n'y
   * était pas.
   *
   * Divisé par le nombre de membres, pour la même raison que les tribunes. Le
   * pot du KOP n'entre pas dans le calcul : ce classement dit qui a chanté,
   * pas qui a payé, et mêler les deux dans un seul chiffre ne dirait ni l'un
   * ni l'autre.
   */
  async function kopsDe(leagueId, saison, limite = 50) {
    return q(
      `SELECT k.id, k.nom, t.name AS club, t.logo,
              m.n AS membres,
              COALESCE(SUM(p.ferveur), 0) AS ferveur,
              ROUND(COALESCE(SUM(p.ferveur), 0) / GREATEST(m.n, 1)) AS moyenne
         FROM kops k
         JOIN teams t ON t.id = k.team_id
         JOIN (SELECT kop_id, COUNT(*) AS n FROM kop_membres GROUP BY kop_id) m
              ON m.kop_id = k.id
         JOIN kop_membres km ON km.kop_id = k.id
         LEFT JOIN (
               SELECT y.user_id, y.team_id, SUM(y.ferveur) AS ferveur
                 FROM (${SOURCE}) y
                GROUP BY y.user_id, y.team_id
              ) p ON p.user_id = km.user_id AND p.team_id = k.team_id
        GROUP BY k.id, k.nom, t.name, t.logo, m.n
       HAVING ferveur > 0
        ORDER BY moyenne DESC, ferveur DESC
        LIMIT ${Number(limite) || 50}`,
      [leagueId, saison, leagueId, saison]);
  }

  /**
   * Ma place dans cette compétition.
   *
   * Un classement de cinquante n'a d'intérêt que si on y figure ; pour tous
   * les autres, « 312e sur 1 400 » vaut mieux que rien. Calculé à part, et
   * jamais mis en cache : c'est la seule ligne de la page qui parle du lecteur,
   * et une ligne périmée sur soi se remarque tout de suite.
   */
  async function maPlaceDans(userId, leagueId, saison) {
    const [moi] = await q(
      `SELECT COALESCE(SUM(x.ferveur), 0) AS f, COUNT(*) AS seances
         FROM (${SOURCE}) x WHERE x.user_id = ?`,
      [leagueId, saison, leagueId, saison, userId]);

    const [rang] = await q(
      `SELECT COUNT(*) + 1 AS rang FROM (
         SELECT x.user_id, SUM(x.ferveur) AS f FROM (${SOURCE}) x GROUP BY x.user_id
       ) z WHERE z.f > ?`,
      [leagueId, saison, leagueId, saison, Number(moi.f)]);

    const [total] = await q(
      `SELECT COUNT(DISTINCT x.user_id) AS n FROM (${SOURCE}) x WHERE x.ferveur > 0`,
      [leagueId, saison, leagueId, saison]);

    return {
      ferveur: Number(moi.f), seances: Number(moi.seances),
      rang: Number(moi.f) > 0 ? rang.rang : null,
      sur: total.n,
    };
  }

  /** Les trois échelles d'un coup : la page les montre côte à côte. */
  async function competition(leagueId, saison, limite = 50) {
    return memo(`comp:${leagueId}:${saison}:${limite}`, async () => {
      const [joueurs, tribunes2, kops] = await Promise.all([
        joueursDe(leagueId, saison, limite),
        tribunesDe(leagueId, saison, limite),
        kopsDe(leagueId, saison, limite),
      ]);
      return { saison, joueurs, tribunes: tribunes2, kops };
    });
  }

  /* ------------------------------------------------------------- ma place */

  /**
   * Le rang d'un joueur, calculé à part.
   * Le voir dans une liste de cinquante n'a d'intérêt que si on y figure ;
   * pour tous les autres, savoir qu'on est 312e sur 1 400 vaut mieux que rien.
   */
  async function maPlace(userId) {
    /* **La même source que la liste où l'on se cherche.** Ces trois requêtes
       ne lisaient que le virage pendant que SUPPORTERS en lit deux : le joueur
       lisait « 312e sur 1 400 » sous une liste qui ne le classait pas sur les
       mêmes nombres. Une place qui ne correspond pas au classement qu'elle
       surmonte est pire qu'une absence de place. */
    const [ferveur] = await q(
      `SELECT COALESCE(SUM(x.ferveur), 0) AS f, COUNT(DISTINCT x.fixture_id) AS m
         FROM (${FERVEUR}) x WHERE x.user_id = ?`, [userId]);

    const [rang] = await q(
      `SELECT COUNT(*) + 1 AS rang FROM (
         SELECT user_id, SUM(ferveur) AS f FROM (${FERVEUR}) y GROUP BY user_id
       ) x WHERE x.f > ?`, [ferveur.f]);

    const [total] = await q(
      `SELECT COUNT(DISTINCT x.user_id) AS n FROM (${FERVEUR}) x`);

    /* ------------------------------------- une place par échelle, pas une

       **La carte « ma place » répondait toujours à la question de la ferveur**,
       y compris sous l'onglet DUELS. Quelqu'un qui venait de jouer ses duels
       lisait donc, au-dessus du tableau des duellistes, « 312e sur 1 400
       supporters classés » — un rang exact, calculé sur autre chose. La
       conclusion tombait toute seule : mes duels n'ont pas été comptés.

       Ils l'étaient. La ferveur d'un duel classé entre dans `FERVEUR` comme
       celle du virage, et c'est ce rang-là qu'il lisait. Ce qui manquait
       n'était pas le calcul, c'était la réponse à la question posée par
       l'onglet qu'il regardait.

       Chaque échelle rend donc la sienne, et surtout **de quoi comprendre une
       absence** : le plancher, et le nombre de parties déjà au compteur. « Tu
       n'es pas classé » et « il te manque deux parties » demandent deux gestes
       différents, et un seul des deux existe. */
    const [duels] = await q(
      `SELECT SUM(outcome = 'win') AS gagnes, COUNT(*) AS joues,
              (SELECT d2.elo_after FROM duel_results d2
                WHERE d2.user_id = ? AND d2.mode = 'classe'
                ORDER BY d2.ended_at DESC LIMIT 1) AS cote
         FROM duel_results WHERE user_id = ? AND mode = 'classe'`, [userId, userId]);

    const [entr] = await q(
      `SELECT COUNT(*) AS joues, SUM(outcome = 'win') AS gagnes
         FROM duel_results WHERE user_id = ? AND mode = 'entrainement'`, [userId]);

    /* Le classement des duellistes, vu d'ici, doit être **le même** que celui
       du tableau : même plancher, même cote, même tri. Deux requêtes qui
       classent différemment placeraient le joueur à un rang qu'il ne
       trouverait pas dans la liste juste en dessous. */
    const classes = (mode) => `
      SELECT dr.user_id, COUNT(*) AS joues,
             (SELECT d2.elo_after FROM duel_results d2
               WHERE d2.user_id = dr.user_id AND d2.mode = '${mode}'
               ORDER BY d2.ended_at DESC LIMIT 1) AS cote
        FROM duel_results dr
        JOIN users u ON u.public_id = dr.user_id
       WHERE u.status = 'active' AND dr.mode = '${mode}'
       GROUP BY dr.user_id
      HAVING joues >= ${PLANCHER_CLASSE}`;

    const admis = Number(duels.joues ?? 0) >= PLANCHER_CLASSE;
    const admisEntr = Number(entr.joues ?? 0) >= PLANCHER_CLASSE;

    const [rangDuel] = admis ? await q(
      `SELECT COUNT(*) + 1 AS rang FROM (${classes('classe')}) z WHERE z.cote > ?`,
      [Number(duels.cote ?? 0)]) : [{ rang: null }];
    const [surDuel] = await q(
      `SELECT COUNT(*) AS n FROM (${classes('classe')}) z`);

    const [rangEntr] = admisEntr ? await q(
      `SELECT COUNT(*) + 1 AS rang FROM (${classes('entrainement')}) z WHERE z.joues > ?`,
      [Number(entr.joues ?? 0)]) : [{ rang: null }];
    const [surEntr] = await q(
      `SELECT COUNT(*) AS n FROM (${classes('entrainement')}) z`);

    /* **À quelle tribune va ta ferveur.** C'est la question que pose l'onglet
       TRIBUNES à quelqu'un qui s'y cherche — et un supporter en neutre, ou qui
       ne suit aucun club, n'y figure jamais. Sans cette ligne, il ne pouvait
       pas savoir pourquoi. Voir la même règle dite dans `teletext.html`. */
    const [tribune] = await q(
      `SELECT t.id, t.name AS nom, COALESCE(SUM(x.ferveur), 0) AS ferveur
         FROM user_follows f
         JOIN teams t ON t.id = f.team_id
         LEFT JOIN (${FERVEUR}) x
                ON x.user_id = f.user_id AND x.team_id = f.team_id
        WHERE f.user_id = ?
        GROUP BY t.id, t.name
        ORDER BY MAX(f.is_main) DESC, ferveur DESC
        LIMIT 1`, [userId]);

    return {
      ferveur: Number(ferveur.f), matchs: ferveur.m,
      rang: ferveur.f > 0 ? rang.rang : null,
      sur: total.n,
      plancher: PLANCHER_CLASSE,
      duels: {
        gagnes: Number(duels.gagnes ?? 0), joues: Number(duels.joues ?? 0),
        cote: duels.cote == null ? null : Number(duels.cote),
        rang: rangDuel.rang == null ? null : Number(rangDuel.rang),
        sur: Number(surDuel.n),
      },
      entrainements: {
        joues: Number(entr.joues ?? 0), gagnes: Number(entr.gagnes ?? 0),
        rang: rangEntr.rang == null ? null : Number(rangEntr.rang),
        sur: Number(surEntr.n),
      },
      tribune: tribune
        ? { id: tribune.id, nom: tribune.nom, ferveur: Number(tribune.ferveur) }
        : null,
    };
  }

  /* ================================================== le parcours d'un joueur

     « Qu'est-ce que j'ai joué, et qu'est-ce que ça m'a rapporté ? »

     Le jeu savait répondre à tout le monde — les classements — et à personne en
     particulier. Un joueur n'avait aucun moyen de retrouver sa soirée : ni la
     liste de ses parties, ni ce que chacune avait donné, ni même combien il en
     avait joué. Tout était en base depuis le premier jour, et rien ne le
     lisait.

     ## Une monnaie, deux façons de la gagner

     Le Grand Virage et le Duel rapportent la même chose — de la ferveur — et
     c'est ce qui permet de les mettre dans la même liste et de les additionner.
     Ce qui les distingue est la **sorte** de partie : le virage, et les quatre
     sortes de duel (entraînement ou classé, 1v1 ou 2v2). On les compte donc
     séparément et on les totalise ensemble.

     ## Pourquoi deux requêtes et non une vue

     Le décompte parcourt tout le passé ; la liste n'en montre que vingt lignes.
     Les mêmes lignes servent deux questions de tailles très différentes, et une
     seule requête aurait obligé à choisir laquelle des deux faire mal. */

  /**
   * Ce qu'il a joué, par sorte, depuis toujours.
   *
   * `mode` et `format` viennent de `duel_results` (voir `sql/historique.sql`).
   * Le format est nul pour les parties d'avant ces colonnes : on les range sous
   * « duel », sans inventer un format qu'on ne connaît pas.
   */
  async function statsDe(userId) {
    /* ------------------------------ ce qui ne doit pas dépendre de la fixture

       **Le club soutenu se lit sur `dr.team_id`, pas sur le match.**

       `pour` se déduisait de `home_id`/`away_id`, donc d'une ligne de
       `fixtures` — et `fixtures` n'est qu'un cache des compétitions suivies.
       Un duel joué sur un match qui n'y figure pas perdait d'un coup le match,
       la compétition **et** le club. Or le club est écrit sur la ligne du duel
       depuis le premier jour : une donnée qu'on possède ne doit pas disparaître
       avec une jointure qui en concerne une autre.

       **`dr.fixture_id` en plus de `f.id`**, parce que les deux ne disent pas la
       même chose : le premier dit qu'un match support existait, le second qu'on
       sait le nommer. Les confondre faisait écrire « match inconnu » sur un duel
       qui en avait parfaitement un — et accusait le jeu d'avoir perdu une partie
       là où il lui manquait une ligne de cache. */
    const duels = await q(
      `SELECT mode, format,
              COUNT(*)                   AS joues,
              SUM(outcome = 'win')       AS gagnes,
              SUM(outcome = 'draw')      AS nuls,
              SUM(outcome = 'loss')      AS perdus,
              COALESCE(SUM(ferveur), 0)  AS ferveur,
              COALESCE(SUM(goals_for), 0)     AS pour,
              COALESCE(SUM(goals_against), 0) AS contre
         FROM duel_results
        WHERE user_id = ?
        GROUP BY mode, format`, [userId]);

    const [virage] = await q(
      `SELECT COUNT(*) AS matchs, COALESCE(SUM(ferveur), 0) AS ferveur
         FROM virage_presence WHERE user_id = ?`, [userId]);

    const sortes = duels.map((d) => ({
      jeu: 'duel',
      mode: d.mode,
      format: d.format ?? null,
      joues: Number(d.joues),
      gagnes: Number(d.gagnes), nuls: Number(d.nuls), perdus: Number(d.perdus),
      ferveur: Number(d.ferveur),
      buts: { pour: Number(d.pour), contre: Number(d.contre) },
    }));
    if (Number(virage?.matchs ?? 0) > 0) {
      sortes.push({ jeu: 'virage', mode: null, format: null,
        joues: Number(virage.matchs), ferveur: Number(virage.ferveur) });
    }

    /* Le total ne s'additionne pas à l'écran : une page qui refait la somme la
       referait mal le jour où l'entraînement cesse de compter, ou commence. */
    return {
      sortes,
      total: {
        parties: sortes.reduce((n, s) => n + s.joues, 0),
        ferveur: sortes.reduce((n, s) => n + s.ferveur, 0),
        /* La ferveur **classée** à part : c'est elle seule qui pèse dans les
           classements, et les deux nombres côte à côte disent la règle mieux
           qu'une phrase. */
        ferveurClassee: sortes
          .filter((s) => s.jeu === 'virage' || s.mode === 'classe')
          .reduce((n, s) => n + s.ferveur, 0),
      },
    };
  }

  /**
   * Ses dernières parties, duels et virages mêlés, la plus récente d'abord.
   *
   * `avant` est l'horodatage de la dernière ligne reçue : c'est une pagination
   * par curseur et non par numéro de page. Deux parties peuvent finir pendant
   * qu'on lit, et un `OFFSET` en rendrait une deux fois et en sauterait une
   * autre — exactement sur l'écran où l'on compte ce qu'on a fait.
   *
   * Les deux moitiés sont tirées séparément puis fusionnées : une `UNION` aurait
   * obligé les deux à porter les mêmes colonnes, donc à inventer un `outcome`
   * pour le virage et un `camp` pour le duel.
   */
  async function historiqueDe(userId, { limite = 20, avant = null } = {}) {
    const n = Math.min(50, Math.max(1, Number(limite) || 20));
    const borne = avant ? new Date(avant) : null;
    const filtre = borne && !Number.isNaN(borne.getTime())
      ? borne.toISOString().slice(0, 23).replace('T', ' ') : null;

    /* **Le plancher d’un joueur inscrit.**

       Sans abonnement, le parcours s’arrête aux vingt dernières parties. On
       ne le fait pas en comptant les lignes rendues : la pagination est par
       curseur, donc le serveur ne sait pas à quelle page il en est, et un
       compteur porté dans le curseur se falsifierait d’un doigt.

       On cherche donc **la date de la vingtième partie**, une fois, et on
       refuse tout ce qui est plus ancien. C’est exact, sans état, et
       impossible à contourner en demandant une page plus lointaine.

       `null` = aucune limite : c’est ce que rend un abonnement, et aussi ce
       qu’on obtient sans module d’abonnement monté. */
    let plancher = null;
    if (abonnement) {
      const garde = abonnement.profondeurParcours(await abonnement.estAbonne(userId));
      if (garde !== null) {
        const [p] = await q(
          `SELECT quand FROM (
             SELECT ended_at AS quand FROM duel_results WHERE user_id = ?
             UNION ALL
             SELECT joined_at AS quand FROM virage_presence WHERE user_id = ?
           ) x ORDER BY quand DESC LIMIT 1 OFFSET ?`,
          [userId, userId, garde - 1]);
        /* Moins de parties que la limite : il les voit toutes, et il n’y a
           rien à cacher. */
        plancher = p?.quand ?? null;
      }
    }

    const match = `
        LEFT JOIN fixtures f ON f.id = %.fixture_id
        LEFT JOIN teams  h ON h.id = f.home_id
        LEFT JOIN teams  a ON a.id = f.away_id
        LEFT JOIN leagues l ON l.id = f.league_id`;

    /* **Contre qui.** `opponent_id` est écrit depuis le premier jour et n'était
       relu nulle part : la ligne disait le match de football — « Sion – Bâle » —
       et pas l'adversaire, qui est pourtant le sujet d'un duel. « J'ai perdu
       contre Marie » se raconte ; « j'ai perdu sur Sion – Bâle » ne dit rien de
       ce qui s'est passé.

       Jointure à gauche, et c'est nécessaire dans trois cas : l'adversaire était
       un bot (`bot:xxxxxxxx`, aucune ligne dans `users`), il a fermé son compte
       depuis, ou la partie est d'avant que la colonne soit remplie
       (`'inconnu'`). Dans les trois, on rend la ligne sans nom plutôt que de
       perdre la partie. */
    /* ------------------------------ ce qui ne doit pas dépendre de la fixture

       **Le club soutenu se lit sur `dr.team_id`, pas sur le match.**

       `pour` se déduisait de `home_id`/`away_id`, donc d'une ligne de
       `fixtures` — et `fixtures` n'est qu'un cache des compétitions suivies.
       Un duel joué sur un match qui n'y figure pas perdait d'un coup le match,
       la compétition **et** le club. Or le club est écrit sur la ligne du duel
       depuis le premier jour : une donnée qu'on possède ne doit pas disparaître
       avec une jointure qui en concerne une autre.

       **`dr.fixture_id` en plus de `f.id`**, parce que les deux ne disent pas la
       même chose : le premier dit qu'un match support existait, le second qu'on
       sait le nommer. Les confondre faisait écrire « match inconnu » sur un duel
       qui en avait parfaitement un — et accusait le jeu d'avoir perdu une partie
       là où il lui manquait une ligne de cache. */
    const duels = await q(
      `SELECT dr.duel_id, dr.ended_at AS quand, dr.outcome,
              dr.goals_for, dr.goals_against,
              dr.ferveur, dr.mode, dr.format, dr.team_id, dr.opponent_id,
              dr.fanzzy_id, dr.xp, dr.duree_s, dr.side,
              uo.pseudo AS adversaire,
              tc.name AS club,
              dr.fixture_id AS support_id,
              f.id AS fixture_id, f.home_id, f.away_id, l.name AS competition,
              h.name AS domicile, h.logo AS domicile_logo,
              a.name AS exterieur, a.logo AS exterieur_logo
         FROM duel_results dr
         LEFT JOIN users uo ON uo.public_id = dr.opponent_id
         LEFT JOIN teams tc ON tc.id = dr.team_id ${match.split('%').join('dr')}
        WHERE dr.user_id = ? ${filtre ? 'AND dr.ended_at < ?' : ''}
        ORDER BY dr.ended_at DESC
        LIMIT ${n}`, filtre ? [userId, filtre] : [userId]);

    const virages = await q(
      `SELECT vp.joined_at AS quand, vp.ferveur, vp.side, vp.team_id,
              tc.name AS club, vp.fixture_id AS support_id,
              f.id AS fixture_id, f.home_id, f.away_id, l.name AS competition,
              h.name AS domicile, h.logo AS domicile_logo,
              a.name AS exterieur, a.logo AS exterieur_logo
         FROM virage_presence vp
         LEFT JOIN teams tc ON tc.id = vp.team_id ${match.split('%').join('vp')}
        WHERE vp.user_id = ? ${filtre ? 'AND vp.joined_at < ?' : ''}
        ORDER BY vp.joined_at DESC
        LIMIT ${n}`, filtre ? [userId, filtre] : [userId]);

    /* ============================================ qui jouait avec, qui contre

       `opponent_id` ne nomme **qu'un** adversaire, pris au hasard parmi ceux
       d'en face : sur un 3v3 il en tait cinq. Les lignes d'une même partie
       partagent `duel_id` et portent chacune leur camp, alors on les relit
       toutes d'un coup.

       Une seule requête pour toute la page, pas une par ligne : vingt parties
       de 3v3 feraient vingt allers-retours pour une réponse qui tient en un
       `IN`. Elle passe par `pool.query` et non `execute` — un `IN (?)` déplié
       depuis un tableau est une chose que l'instruction préparée ne sait pas
       faire.

       **Les bots n'ont pas de ligne** : `fermer` les saute, et c'est juste —
       une machine n'a pas d'historique. Le camp se retrouve donc incomplet, et
       on ne le cache pas : le format dit combien on attendait de chaque côté,
       la différence est le nombre de machines, et l'écran peut dire « avec
       deux bots » plutôt que de laisser croire qu'on était seul. */
    /** Le nom d'un Fanzzy, quand le catalogue est chargé. Sous garde : une
        suite peut monter ce module seul, et un identifiant nu vaut mieux qu'une
        page qui lève. */
    const nomDe = (id) => { try { return parIdentifiant(id)?.nom ?? null; } catch { return null; } };

    const camps = new Map();
    if (duels.length) {
      const [rangs] = await pool.query(
        `SELECT dr.duel_id, dr.user_id, dr.side, u.pseudo
           FROM duel_results dr
           LEFT JOIN users u ON u.public_id = dr.user_id
          WHERE dr.duel_id IN (?)`,
        [duels.map((d) => d.duel_id)]);
      for (const x of rangs) {
        if (!camps.has(x.duel_id)) camps.set(x.duel_id, []);
        camps.get(x.duel_id).push(x);
      }
    }

    /** Combien de joueurs par camp le format annonçait. `3v3` → 3. */
    const parCamp = (format) => {
      const m = /^(\d+)v(\d+)$/.exec(String(format ?? ''));
      return m ? Number(m[1]) : 1;
    };

    /**
     * Les deux listes, et ce qui manque de chaque côté.
     *
     * Le lecteur est retiré de la sienne : « avec Marie » se lit, « avec moi et
     * Marie » se relit deux fois.
     */
    const equipes = (r) => {
      const tous = camps.get(r.duel_id) ?? [];
      const attendu = parCamp(r.format);
      const mien = tous.filter((x) => x.side === r.side && x.user_id !== userId);
      const leur = tous.filter((x) => x.side !== r.side);
      const nom = (x) => x.pseudo ?? null;
      return {
        avec: mien.map(nom).filter(Boolean),
        contre: leur.map(nom).filter(Boolean),
        /* Ce que les machines occupaient. Négatif impossible, mais `max` le
           garde vrai si le format ment — une partie ouverte en 3v3 qui part à
           deux ne doit pas annoncer « -1 bot ». */
        botsAvec: Math.max(0, attendu - 1 - mien.length),
        botsContre: Math.max(0, attendu - leur.length),
      };
    };

    const ligne = (r, jeu) => ({
      jeu,
      quand: r.quand,
      ferveur: Number(r.ferveur ?? 0),
      mode: r.mode ?? null,
      format: r.format ?? null,
      issue: r.outcome ?? null,
      score: jeu === 'duel'
        ? { pour: Number(r.goals_for ?? 0), contre: Number(r.goals_against ?? 0) } : null,
      /* Le pseudo s'il y en a un, et sinon **pourquoi il n'y en a pas**. Un
         champ vide ferait écrire « contre — » ; le drapeau laisse la page dire
         « contre un bot », qui est une information. */
      adversaire: jeu === 'duel' ? (r.adversaire ?? null) : null,
      contreBot: jeu === 'duel' && String(r.opponent_id ?? '').startsWith('bot:'),
      /* **Les deux camps, nommés.** Voir `equipes`. */
      ...(jeu === 'duel' ? equipes(r) : {}),
      /* Le Fanzzy aligné au coup d'envoi, avec son nom : `TR32` ne dit rien à
         personne, « Choriste » se reconnaît. Le catalogue peut ne pas être
         chargé — une suite monte ce module seul — et l'identifiant nu vaut
         alors mieux que rien. */
      fanzzy: jeu === 'duel' && r.fanzzy_id
        ? { id: r.fanzzy_id, nom: nomDe(r.fanzzy_id) } : null,
      /* L'XP et la durée, et les deux ne se comportent pas pareil.

         `xp` est `NOT NULL DEFAULT 0` : une partie d'avant la colonne rend donc
         **zéro**, comme un forfait — qui n'en verse pas non plus, c'est la
         règle. Les deux cas se confondent, et ce n'est pas grave : dans les
         deux, il n'y a rien à annoncer, et l'écran n'écrit rien. Écrire « +0 XP »
         serait la seule faute possible ici.

         `duree_s` est nullable, elle : une partie d'avant la colonne rend nul et
         l'écran se tait, là où zéro aurait annoncé un duel de zéro seconde. */
      xp: jeu === 'duel' ? Number(r.xp ?? 0) : null,
      duree: jeu === 'duel' && r.duree_s !== null ? Number(r.duree_s) : null,
      /* La tribune tenue, **même en neutre**. `pour` rend le club soutenu et
         vaut nul pour un neutre : on ne savait donc pas de quel côté il était,
         alors que c'est la seule chose qui situe un duel. Le camp le dit. */
      camp: jeu === 'duel' && r.side !== null
        ? (Number(r.side) === 0 ? r.domicile : r.exterieur) : null,
      /* Le camp du virage se dit en club et non en 0/1 : « tu poussais pour le
         FC Sion » se lit, « side: 0 » se décode. */
      /* `r.club` d'abord : il vient de la ligne elle-même et survit à
         l'absence de la fixture. Le calcul par `home_id` reste derrière,
         pour les lignes d'avant `team_id` — et le camp derrière encore,
         pour un neutre, dont c'est la seule façon d'être situé. */
      pour: r.club
        ?? (r.team_id
          ? (r.team_id === r.home_id ? r.domicile : r.exterieur)
          : (r.side === 1 ? r.exterieur : r.side === 0 ? r.domicile : null)),
      neutre: !r.team_id,
      /* **Trois états, pas deux.** Un match nommé, un match qu'on ne sait plus
         nommer, et pas de match du tout. L'écran les confondait sous « match
         inconnu », qui accusait le jeu d'avoir perdu une partie alors qu'il
         lui manquait seulement une ligne de cache. `oublie` porte la
         nuance, et la page peut la dire. */
      match: r.fixture_id ? {
        id: r.fixture_id, competition: r.competition ?? null,
        domicile: r.domicile, domicileLogo: r.domicile_logo,
        exterieur: r.exterieur, exterieurLogo: r.exterieur_logo,
      } : null,
      oublie: !r.fixture_id && !!r.support_id,
    });

    let tout = [...duels.map((r) => ligne(r, 'duel')),
               ...virages.map((r) => ligne(r, 'virage'))]
      .sort((x, y) => new Date(y.quand) - new Date(x.quand));

    /* Le plancher coupe **avant** la tranche, et non après : sinon une page
       pleine de parties trop anciennes rendrait une liste vide en annonçant
       qu’il y a une suite. Voir le calcul du plancher, plus haut. */
    const tronque = plancher !== null
      && tout.some((l) => new Date(l.quand) < new Date(plancher));
    if (plancher !== null) {
      tout = tout.filter((l) => new Date(l.quand) >= new Date(plancher));
    }
    tout = tout.slice(0, n);

    /* `suite` porte le curseur de la page suivante, et vaut `null` quand il n'y
       a plus rien : c'est à la réponse de le dire, pas à la page de le deviner
       en comparant des longueurs.

       `tronque` dit que la mémoire s’arrête là **par abonnement**, et non
       parce qu’il n’a rien joué de plus. Les deux se ressemblent à l’écran, et
       les confondre laisserait croire que des parties ont disparu. */
    return { lignes: tout,
             suite: tout.length === n && !tronque ? tout[tout.length - 1].quand : null,
             tronque };
  }

  /* ---------------------------------------------------------- routes */

  const router = express.Router();
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    console.error('[classement]', e.message);
    if (!res.headersSent) res.status(503).json({ error: 'rank.error.unavailable' });
  });

  router.get('/supporters', safe(async (req, res) => {
    res.set('cache-control', 'private, max-age=120');
    res.json({ classement: await supporters(String(req.query.periode ?? 'saison')) });
  }));

  router.get('/tribunes', safe(async (_req, res) => {
    res.set('cache-control', 'private, max-age=120');
    res.json({ classement: await tribunes() });
  }));

  /* **Le plancher voyage avec la liste.**
   *
   * Ces deux tableaux n'admettent qu'au bout de trois parties — une liste où
   * l'on entre après une partie est une liste où tout le monde est. La règle
   * est bonne ; ce qui ne l'était pas, c'est que l'écran n'en savait rien. Un
   * joueur qui avait gagné son premier duel classé lisait « ce classement est
   * encore vide, sois le premier à y entrer » alors qu'il venait précisément
   * d'y entrer — et que le tableau, lui, l'attendait deux parties de plus.
   *
   * Un écran qui ignore la condition d'entrée invente forcément une phrase
   * fausse. Il la reçoit donc. */
  router.get('/duellistes', safe(async (_req, res) => {
    res.set('cache-control', 'private, max-age=120');
    res.json({ classement: await duellistes(), plancher: PLANCHER_CLASSE });
  }));

  /* Sa propre adresse, et non un paramètre de la précédente : ce n'est pas le
     même classement vu autrement, c'est une autre question — « qui s'entraîne »
     et non « qui gagne ». Les confondre sous un filtre finirait par faire
     croire qu'on peut monter au classement en s'entraînant. */
  router.get('/entrainements', safe(async (_req, res) => {
    res.set('cache-control', 'private, max-age=120');
    res.json({ classement: await assidus(), plancher: PLANCHER_CLASSE });
  }));

  /**
   * Les classements d'une compétition.
   *
   * La saison arrive de la page, qui la tient du télétexte — lequel la choisit
   * sur les dates de la compétition. Une seule règle, un seul endroit.
   *
   * `moi` n'est joint que pour un joueur connecté, et il n'est pas mis en
   * cache : c'est la seule ligne qui parle du lecteur.
   */
  router.get('/competition/:id', safe(async (req, res) => {
    const leagueId = Number(req.params.id);
    if (!Number.isInteger(leagueId) || leagueId <= 0) {
      return res.status(400).json({ error: 'rank.error.unknown_league' });
    }
    const saison = Number(req.query.saison) || await saisonDe(leagueId);
    if (!saison) return res.json({ saison: null, joueurs: [], tribunes: [], kops: [] });

    const c = await competition(leagueId, saison);
    const moi = req.user?.id ? await maPlaceDans(req.user.id, leagueId, saison) : null;
    res.set('cache-control', 'private, max-age=120');
    res.json({ ...c, moi });
  }));

  router.get('/moi', requireAuth, safe(async (req, res) =>
    res.json(await maPlace(req.user.id))));

  /**
   * Le parcours du joueur : ce qu’il a joué, et ce que ça lui a rapporté.
   *
   * Les statistiques et la première page d’historique arrivent ensemble : le
   * profil les montre côte à côte, et deux appels pour un seul écran feraient
   * apparaître la moitié avant l’autre.
   *
   * `avant` demande la suite. Aucun cache : c’est le seul écran où le joueur
   * vient vérifier ce qu’il vient de faire, et deux minutes de retard y
   * ressemblent à une partie perdue.
   */
  router.get('/parcours', requireAuth, safe(async (req, res) => {
    const avant = req.query.avant ? String(req.query.avant) : null;
    const [stats, histoire] = await Promise.all([
      avant ? null : statsDe(req.user.id),
      historiqueDe(req.user.id, { avant, limite: req.query.limite }),
    ]);
    res.set('cache-control', 'no-store');
    res.json({ ...(stats ?? {}), ...histoire });
  }));

  return { router, supporters, tribunes, duellistes, assidus, maPlace,
           competition, maPlaceDans, saisonDe, statsDe, historiqueDe, oublier };
}
