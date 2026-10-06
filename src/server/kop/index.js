import { randomUUID } from 'node:crypto';
import express from 'express';
import { BONUS, BONUS_PAR_ID, DUREE_VOTE_MS, PART_POT, depouiller, nomValide }
  from '../../shared/kop.js';
import { habillerJoueurs } from '../fanzzy/avatar.js';

/**
 * Combien de temps on garde les visages des membres d'un KOP.
 *
 * La page du KOP relit l'état toutes les trente secondes, pour chaque membre
 * qui la regarde. Sans mémoire, chaque relecture coûterait trois requêtes de
 * plus (`habillerJoueurs`) pour une information qui ne bouge presque jamais :
 * on ne change pas de personnage entre deux relectures. Une minute couvre
 * deux relectures, et un membre qui vient de changer de Fanzzy se voit au
 * plus une minute en retard.
 */
const VISAGES_MS = 60_000;

/** Une teinte telle que la page la pose : `#` et six chiffres hexadécimaux. */
const TEINTE = /^#[0-9a-f]{6}$/i;

/**
 * Les couleurs d'un club, prêtes à peindre : une ou deux teintes, ou aucune.
 *
 * `teams.color1` et `color2` sont écrites par l'extraction du blason, qui les
 * écrit en minuscules ; mais une colonne de sept caractères accepte tout ce
 * qu'on y pose à la main. Une valeur qui n'est pas une teinte ne part donc
 * pas (la page la poserait dans une propriété CSS), la casse est ramenée aux
 * minuscules, et une seconde teinte égale à la première n'en est pas une :
 * la page prend alors la première pour les deux.
 *
 * @returns {string[]} zéro, une ou deux teintes, la principale d'abord.
 */
export function couleursDuClub(c1, c2) {
  const res = [];
  for (const c of [c1, c2]) {
    const t = typeof c === 'string' ? c.trim().toLowerCase() : '';
    if (TEINTE.test(t) && !res.includes(t)) res.push(t);
  }
  return res;
}

/**
 * Les bonus retirés du catalogue, et ce que le pot avait payé pour chacun.
 *
 * « La quête » (`scarvesBonus`) et « Mur de bâches » (`parryBonus`,
 * `parryResist`) portaient des clés qu'aucun moteur ne lit : un bonus de KOP
 * n'arrive qu'au Virage, qui ne verse aucune écharpe et ne connaît pas le
 * contre. Un KOP qui les votait payait 900 ou 500 écharpes pour rien. Le
 * serveur avait cessé de les vendre le 3 octobre 2026, en les gardant au
 * catalogue partagé faute de décision (`serveur/ECARTS.md`, social § 6) ;
 * Gaël a tranché le 6 octobre : ils en sortent pour de bon, et ce qu'ils ont
 * coûté revient au pot (`rendreLesRetires`, plus bas).
 *
 * Le prix est écrit ici parce que `kop_bonus` ne le garde pas. Il est sûr :
 * c'est celui du catalogue, qui n'a pas changé depuis l'arrivée du KOP (un
 * seul commit, le 23 septembre 2026), et que `proposer` recopiait dans le
 * vote dont le dépouillement débitait le pot. Le nom sert au journal.
 */
export const BONUS_RETIRES = new Map([
  ['echarpes', { nom: 'La quête', prix: 900 }],
  ['contres', { nom: 'Mur de bâches', prix: 500 }],
]);

/**
 * La marque d'une ligne remboursée : son `bonus_id` devient `rendu:echarpes`.
 *
 * Elle tient dans la colonne (`VARCHAR(32)`), ne ressemble à aucun bonus du
 * catalogue, et dit sur la ligne elle-même ce qui lui est arrivé — sans
 * colonne ni table de plus, et sans rien effacer : `kop_bonus` garde tout.
 */
const RENDU = 'rendu:';

/**
 * Le KOP, côté serveur.
 *
 * **Le dépouillement se fait à la lecture, jamais par une minuterie.** Un vote
 * dont l'échéance est passée est dépouillé au premier regard — celui d'un
 * membre qui ouvre la page, ou celui du VIRAGE qui cherche les bonus actifs.
 * Une tâche périodique aurait demandé un ordonnanceur à maintenir, et surtout
 * elle aurait laissé des votes ouverts pour l'éternité au premier redémarrage
 * tombé au mauvais moment.
 *
 * **Le pot ne se retire pas.** Il n'existe aucun chemin qui rende des écharpes
 * à un membre. C'est la règle « ce qui est versé est versé », et elle tient
 * parce qu'on ne l'a écrite nulle part — il n'y a simplement pas de fonction
 * pour le faire. Le seul crédit du pot qui ne vient pas d'un versement est le
 * remboursement des bonus retirés (`rendreLesRetires`) : il rend au pot ce que
 * le pot avait payé, et rien à personne.
 */
export function createKop({ pool, requireAuth, io = null,
  /* **Créer** un KOP est un geste d'abonné ; **rejoindre** reste libre.

     C’est la porte la mieux placée de tout l’abonnement : elle fait payer
     ceux qui organisent, c’est-à-dire ceux qui font vivre le jeu, et chaque
     abonné ramène des joueurs inscrits au lieu d’en éloigner. Un KOP qui
     existe est ouvert à tous — l’abonnement ne ferme aucune porte à
     personne, il en ouvre une à celui qui veut tenir la barre.

     Et rien de ce qu’un KOP apporte en jeu n’est réservé : ses bonus valent
     pour tous ses membres, abonnés ou non. Voir `abonnement/index.js`. */
  abonnement = null }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const fail = (code, extra) => Object.assign(new Error(code), { code, extra });

  /* Un schéma incomplet se dit une fois au journal, pas à chaque relecture
     d'une page qui relit toutes les trente secondes. */
  const dejaDit = new Set();
  const direUneFois = (cause, message) => {
    if (dejaDit.has(cause)) return;
    dejaDit.add(cause);
    console.warn(message);
  };

  /* Sur une base où `sql/couleurs.sql` n'est pas passé, la colonne absente
     ferait tomber toute la page du KOP pour une teinte. Les deux lectures qui
     en ont besoin (`miens`, `couleursPour`) servent alors sans couleurs, et
     le journal le dit une fois pour les deux : c'est le même schéma à
     compléter. Toute autre erreur remonte telle quelle. */
  const sansCouleurs = (e) => {
    if (e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
    direUneFois('couleurs', `[kop] KOP et clubs servis sans les couleurs du club : ${
      e.sqlMessage ?? e.message} (applique sql/couleurs.sql)`);
  };

  /* --------------------------------------------------------- appartenance */

  /**
   * Les KOP de ce joueur, un par club suivi au plus.
   *
   * **Avec les couleurs du club** (`couleurs`), quand elles sont connues :
   * la page du KOP en peint la bâche, l'écharpe et le pot. Elles viennent de
   * la jointure sur `teams` qui donnait déjà le nom du club : aucune requête
   * de plus. Elles ne sont jamais cherchées d'ici — le blason se lit depuis
   * la liste des matchs (`football/couleurs.js`) ; un club dont on ne les a
   * pas encore extraites n'a simplement pas de bâche, et la page retombe
   * sur le violet des gens.
   *
   * Sans `sql/couleurs.sql`, la liste se lit sans couleurs (`sansCouleurs`).
   */
  async function miens(userId) {
    const lire = (couleurs) => q(
      `SELECT k.id, k.nom, k.team_id, k.pot, k.verse_total, k.createur,
              m.verse, m.depuis, t.name AS team_nom, ${couleurs},
              (SELECT COUNT(*) FROM kop_membres x WHERE x.kop_id = k.id) AS membres
         FROM kop_membres m
         JOIN kops k ON k.id = m.kop_id
         LEFT JOIN teams t ON t.id = k.team_id
        WHERE m.user_id = ?
        ORDER BY m.depuis`, [userId]);

    let lignes;
    try {
      lignes = await lire('t.color1 AS couleur1, t.color2 AS couleur2');
    } catch (e) {
      sansCouleurs(e);
      lignes = await lire('NULL AS couleur1, NULL AS couleur2');
    }

    /* Les deux colonnes de travail ne partent pas telles quelles : la
       réponse porte `couleurs`, ou rien (`CONTRATS.md`, R1). */
    return lignes.map(({ couleur1, couleur2, ...k }) => {
      const couleurs = couleursDuClub(couleur1, couleur2);
      return couleurs.length ? { ...k, couleurs } : k;
    });
  }

  /** Le KOP de ce joueur pour ce club, ou `null`. */
  async function mienPour(userId, teamId) {
    const r = await q(
      `SELECT k.* FROM kop_membres m JOIN kops k ON k.id = m.kop_id
        WHERE m.user_id = ? AND m.team_id = ? LIMIT 1`, [userId, teamId]);
    return r[0] ?? null;
  }

  /** Les KOP existants pour un club, pour qu'on puisse en rejoindre un. */
  async function pourClub(teamId) {
    return q(
      `SELECT k.id, k.nom, k.pot, k.verse_total, k.cree,
              (SELECT COUNT(*) FROM kop_membres x WHERE x.kop_id = k.id) AS membres
         FROM kops k WHERE k.team_id = ?
        ORDER BY membres DESC, k.cree`, [teamId]);
  }

  /**
   * Les couleurs d'un club, qu'il ait un KOP ou non.
   *
   * La carte d'un club suivi **sans** KOP — l'état de la plupart des joueurs —
   * reprend la tête d'un KOP : le nom du club en banderole, sur la bâche aux
   * couleurs du club. Ce club n'a justement aucune ligne dans `kops` : une
   * jointure depuis `kops` ne rendrait rien, et ses couleurs se lisent donc
   * sur `teams` seul, par sa clé. Mêmes colonnes et même règle
   * (`couleursDuClub`) que `miens`, pour que les deux cartes d'un même club
   * aient la même bâche.
   *
   * Un club inconnu, dont le blason n'est pas encore lu, ou un identifiant
   * qui n'est pas un entier n'a pas de couleurs : la page ne pose pas de
   * bâche, elle n'invente pas les couleurs d'un club.
   *
   * @returns {Promise<string[]>} zéro, une ou deux teintes, la principale d'abord.
   */
  async function couleursPour(teamId) {
    if (!Number.isSafeInteger(teamId)) return [];
    try {
      const [t] = await q(`SELECT color1, color2 FROM teams WHERE id = ?`, [teamId]);
      return couleursDuClub(t?.color1, t?.color2);
    } catch (e) {
      sansCouleurs(e);
      return [];
    }
  }

  /** On ne crée ni ne rejoint le KOP d'un club qu'on ne suit pas. */
  async function suit(userId, teamId) {
    const r = await q(`SELECT 1 FROM user_follows WHERE user_id = ? AND team_id = ?`,
      [userId, teamId]);
    return r.length > 0;
  }

  async function creer(userId, teamId, nomBrut) {
    /* Le refus vient **en premier** : inutile de valider un nom et un club
       pour annoncer ensuite qu’on n’a pas le droit. */
    if (abonnement && !(await abonnement.estAbonne(userId))) {
      throw fail('kop.error.abonnement');
    }
    const nom = nomValide(nomBrut);
    if (!nom) throw fail('kop.error.nom');
    if (!Number.isFinite(Number(teamId))) throw fail('kop.error.club');
    if (!await suit(userId, teamId)) throw fail('kop.error.pas_ton_club');

    const id = randomUUID();
    try {
      await q(`INSERT INTO kops (id, team_id, nom, createur) VALUES (?, ?, ?, ?)`,
        [id, teamId, nom, userId]);
      await q(
        `INSERT INTO kop_membres (kop_id, user_id, team_id) VALUES (?, ?, ?)`,
        [id, userId, teamId]);
    } catch (e) {
      // La clé unique fait foi : le joueur est déjà au KOP d'un club, et c'est
      // la base qui le dit — pas une vérification qu'on aurait pu manquer.
      if (e.code === 'ER_DUP_ENTRY') {
        await q(`DELETE FROM kops WHERE id = ?`, [id]);
        throw fail('kop.error.deja_membre');
      }
      throw e;
    }
    return { id, nom, teamId, createur: userId };
  }

  async function rejoindre(userId, kopId) {
    const k = (await q(`SELECT * FROM kops WHERE id = ?`, [kopId]))[0];
    if (!k) throw fail('kop.error.inconnu');
    if (!await suit(userId, k.team_id)) throw fail('kop.error.pas_ton_club');
    try {
      await q(`INSERT INTO kop_membres (kop_id, user_id, team_id) VALUES (?, ?, ?)`,
        [kopId, userId, k.team_id]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') throw fail('kop.error.deja_membre');
      throw e;
    }
    return { id: k.id, nom: k.nom, teamId: k.team_id };
  }

  /**
   * Quitter. **Rien n'est rendu.**
   *
   * Le versement reste au pot, et c'est ce qui empêche d'entrer la veille du
   * match, de voter, puis de repartir avec sa part. Le compteur personnel
   * disparaît avec l'adhésion : il ne décrivait qu'une relation qui n'existe
   * plus.
   *
   * Un créateur qui part laisse le KOP debout. Ses cinq voix partent avec lui —
   * plus personne ne départage, et une égalité vaut alors rejet. Un groupe sans
   * meneur décide plus difficilement, ce qui est une description assez juste de
   * la réalité.
   */
  async function quitter(userId, kopId) {
    const r = await q(`DELETE FROM kop_membres WHERE kop_id = ? AND user_id = ?`,
      [kopId, userId]);
    if (!r.affectedRows) throw fail('kop.error.pas_membre');
    return { quitte: kopId };
  }

  /* ------------------------------------------------------------- le pot */

  /**
   * Verse au pot du KOP la part gagnée pour ce club.
   *
   * Rend `{ verse, kopId }`, ou `{ verse: 0, sansKop: true }` quand le joueur
   * n'a pas de KOP pour ce club — l'appelant s'en sert pour le lui dire. Les
   * écharpes sont alors **perdues** : c'est voulu, et c'est ce qui donne une
   * raison d'en créer un.
   *
   * Jamais d'exception : verser au pot ne doit pas faire échouer la fin d'un
   * duel qui s'est bien joué.
   */
  async function verser(userId, teamId, montant) {
    const n = Math.max(0, Math.round(Number(montant) || 0));
    if (!n) return { verse: 0 };
    try {
      const k = await mienPour(userId, teamId);
      if (!k) return { verse: 0, sansKop: true, teamId };
      await q(`UPDATE kops SET pot = pot + ?, verse_total = verse_total + ? WHERE id = ?`,
        [n, n, k.id]);
      await q(`UPDATE kop_membres SET verse = verse + ? WHERE kop_id = ? AND user_id = ?`,
        [n, k.id, userId]);
      return { verse: n, kopId: k.id, nom: k.nom };
    } catch (e) {
      if (/doesn't exist/i.test(e.message ?? '')) {
        console.error('[kop] schéma incomplet — applique sql/kop.sql :', e.message);
      } else {
        console.error('[kop]', e.message);
      }
      return { verse: 0 };
    }
  }

  /* -------------------------------------------------------------- votes */

  /**
   * Dépouille les votes échus d'un KOP, et applique ceux qui sont adoptés.
   *
   * Appelée avant toute lecture. C'est ce qui remplace l'ordonnanceur : le vote
   * se ferme au premier regard qui suit son échéance, et jamais plus tard —
   * puisque personne ne peut lire l'état sans passer par ici.
   *
   * **Plusieurs regards arrivent en même temps**, et c'est le cas ordinaire :
   * tous les membres regardent le même compte à rebours de trois minutes, et
   * tous les supporters d'un KOP entrent au Virage au coup d'envoi. Chacun
   * trouve le vote échu et le dépouille ; un seul doit l'appliquer. Voir
   * `depouillerUn`.
   */
  async function depouillerEchus(kopId) {
    const echus = await q(
      `SELECT id, kop_id, bonus_id, prix FROM kop_votes
        WHERE kop_id = ? AND issue = 'en_cours' AND ferme <= NOW(3)`, [kopId]);
    const faits = [];

    for (const v of echus) {
      const fait = await depouillerUn(v);
      // Un vote qu'un autre regard a dépouillé pendant ce temps n'est pas un
      // fait de plus : il a déjà été annoncé, par celui qui l'a appliqué.
      if (fait) faits.push(fait);
    }

    if (faits.length && io) io.to(`kop:${kopId}`).emit('kop:votes', faits);
    return faits;
  }

  /**
   * Dépouille un vote échu et l'applique, **une seule fois**, ou rend `null`
   * si un autre regard l'a fait.
   *
   * Le pot ne se débitait jusqu'ici qu'à la condition d'un
   * `UPDATE … WHERE issue = 'en_cours'` dont personne ne lisait le résultat :
   * cinq lectures simultanées après l'échéance passaient toutes au débit, et
   * le pot payait cinq fois un bonus acheté une fois, avec cinq lignes de
   * bonus. C'est maintenant **la ligne touchée par cette écriture** qui donne
   * le droit d'appliquer le vote, dans une transaction : qui ne l'a pas
   * touchée annule sans rien écrire.
   *
   * L'ordre des instructions compte, et il est voulu :
   *
   *   1. le pot **sous verrou d'abord** (`FOR UPDATE`) : deux dépouillements
   *      du même KOP passent l'un après l'autre, et le second lit le pot que
   *      le premier a laissé. C'est aussi la première lecture de la
   *      transaction : elle ne prend aucune photo de la base, de sorte que
   *      la lecture suivante voit ce que le premier vient de valider (sur un
   *      MariaDB à isolation par instantané, lire avant de verrouiller ferait
   *      échouer le second sur « la ligne a changé depuis ta lecture ») ;
   *   2. les bulletins, figés depuis l'échéance (`voter` refuse après) ;
   *   3. l'écriture de l'issue, dont le nombre de lignes touchées décide.
   */
  async function depouillerUn(v) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[k]] = await conn.execute(
        `SELECT createur, pot FROM kops WHERE id = ? FOR UPDATE`, [v.kop_id]);
      const [bulletins] = await conn.execute(
        `SELECT user_id AS userId, pour FROM kop_bulletins WHERE vote_id = ?`, [v.id]);
      const r = depouiller(bulletins.map((b) => ({ userId: b.userId, pour: Boolean(b.pour) })),
        k?.createur);

      /* Adopté, mais le bonus n'est plus au catalogue : un vote ouvert avant
         le déploiement qui l'a retiré (le redémarrage tombe au milieu de ses
         trois minutes — « La quête » et « Mur de bâches », le 6 octobre 2026),
         ou tout autre identifiant que le catalogue ne connaît pas. Le pot ne
         paie pas un bonus qui n'existe plus ; et sans cette garde, un
         identifiant inconnu faisait tomber le dépouillement sur `def.portee`,
         donc toute lecture de ce KOP, à chaque regard. */
      const def = BONUS_PAR_ID.get(v.bonus_id);
      const enVente = Boolean(def);
      // Adopté, mais le pot a fondu entre-temps — un autre vote est passé
      // avant. On rejette plutôt que de creuser un pot négatif, et le KOP
      // pourra revoter.
      const couvert = (k?.pot ?? 0) >= v.prix;
      const payable = r.adopte && enVente && couvert;

      const [maj] = await conn.execute(
        `UPDATE kop_votes SET issue = ? WHERE id = ? AND issue = 'en_cours'`,
        [payable ? 'adopte' : 'rejete', v.id]);
      if (maj.affectedRows !== 1) {
        // Un autre regard l'a dépouillé avant nous : rien à écrire.
        await conn.rollback();
        return null;
      }

      if (payable) {
        await conn.execute(`UPDATE kops SET pot = pot - ? WHERE id = ?`, [v.prix, v.kop_id]);
        await conn.execute(
          `INSERT INTO kop_bonus (id, kop_id, bonus_id, portee, restant)
           VALUES (?, ?, ?, ?, ?)`,
          [randomUUID(), v.kop_id, v.bonus_id, def.portee,
           def.portee === 'match' ? 1 : def.portee === 'charges' ? (def.charges ?? 3) : null]);
      }
      await conn.commit();
      return { id: v.id, bonusId: v.bonus_id, ...r,
        issue: payable ? 'adopte' : 'rejete',
        // On distingue les trois : « rejeté », « pot insuffisant » et « hors
        // vente » ne se corrigent pas de la même façon.
        potInsuffisant: r.adopte && enVente && !couvert,
        horsVente: r.adopte && !enVente };
    } catch (e) {
      try { await conn.rollback(); } catch { /* la connexion est déjà perdue */ }
      throw e;
    } finally {
      conn.release();
    }
  }

  async function proposer(userId, kopId, bonusId) {
    const def = BONUS_PAR_ID.get(String(bonusId));
    /* Un bonus retiré du catalogue — proposé par une page restée ouverte
       d'avant, ou par une requête écrite à la main — n'existe pas. Le code est
       celui que la page sait déjà dire. */
    if (!def) throw fail('kop.error.bonus_inconnu');

    const m = await q(`SELECT 1 FROM kop_membres WHERE kop_id = ? AND user_id = ?`,
      [kopId, userId]);
    if (!m.length) throw fail('kop.error.pas_membre');

    await depouillerEchus(kopId);

    // Un seul vote à la fois. Deux votes ouverts, ce sont deux dépenses
    // acceptées séparément sur un pot qui n'en couvre qu'une — et le second
    // serait rejeté au dépouillement, après que tout le monde a voté pour.
    const enCours = await q(
      `SELECT id FROM kop_votes WHERE kop_id = ? AND issue = 'en_cours'`, [kopId]);
    if (enCours.length) throw fail('kop.error.vote_en_cours');

    const k = (await q(`SELECT pot FROM kops WHERE id = ?`, [kopId]))[0];
    if (!k) throw fail('kop.error.inconnu');
    if (k.pot < def.prix) throw fail('kop.error.pot_insuffisant');

    const id = randomUUID();
    await q(
      `INSERT INTO kop_votes (id, kop_id, bonus_id, prix, ouvert_par, ferme)
       VALUES (?, ?, ?, ?, ?, NOW(3) + INTERVAL ? MICROSECOND)`,
      [id, kopId, def.id, def.prix, userId, DUREE_VOTE_MS * 1000]);

    // Celui qui propose vote pour : il n'aurait pas proposé sinon, et le lui
    // faire cliquer une seconde fois ne prouve rien.
    await q(`INSERT INTO kop_bulletins (vote_id, user_id, pour) VALUES (?, ?, 1)`,
      [id, userId]);

    const vote = { id, kopId, bonusId: def.id, prix: def.prix, nom: def.nom,
      fermeDansMs: DUREE_VOTE_MS, ouvertPar: userId };
    /* La notification. Trois minutes, c'est court : si l'on attendait que les
       membres rafraîchissent leur page, la moitié d'entre eux voterait après la
       clôture. */
    if (io) io.to(`kop:${kopId}`).emit('kop:vote', vote);
    return vote;
  }

  async function voter(userId, voteId, pour) {
    /* **La clôture se juge en SQL**, comme elle s'écrit. `ferme` est écrit par
       `NOW(3)`, à l'heure de la session MySQL ; relu par le pilote, qui lit en
       UTC (`timezone: 'Z'`), il partait deux heures dans le futur sur une base
       à l'heure de Zurich, et l'on votait encore deux heures après la clôture
       d'un vote de trois minutes. */
    const v = (await q(
      `SELECT kop_id, (issue = 'en_cours' AND ferme > NOW(3)) AS ouvert
         FROM kop_votes WHERE id = ?`, [voteId]))[0];
    if (!v) throw fail('kop.error.vote_inconnu');
    const m = await q(`SELECT 1 FROM kop_membres WHERE kop_id = ? AND user_id = ?`,
      [v.kop_id, userId]);
    if (!m.length) throw fail('kop.error.pas_membre');
    if (!Number(v.ouvert)) throw fail('kop.error.vote_clos');
    // On peut changer d'avis tant que c'est ouvert : trois minutes, c'est
    // exactement la durée d'une discussion.
    await q(
      `INSERT INTO kop_bulletins (vote_id, user_id, pour) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE pour = VALUES(pour), a = NOW(3)`,
      [voteId, userId, pour ? 1 : 0]);
    return { voteId, pour: Boolean(pour) };
  }

  /* ------------------------------------------------------------ bonus */

  /**
   * Les bonus du KOP qui agissent encore.
   *
   * Un bonus de match ou à charges s'éteint quand il est consommé. Un bonus
   * de **saison** promet d'agir « jusqu'à la fin de la saison », et rien ne
   * l'éteignait : une saison n'avait pas de fin, `restant` vaut NULL pour
   * toujours, et le bonus voté en septembre aurait encore agi dans trois ans.
   * Il agit désormais tant que la saison **pendant laquelle il a été acheté**
   * court encore :
   *
   *   - acheté après le lancement de la saison en cours (la dernière lancée).
   *     Un bonus acheté sous la saison 1 s'éteint donc au lancement de la 2 —
   *     c'est la même borne que le classement « saison » et les divisions ;
   *   - et cette saison n'est pas finie : sa fin est la fin de son jour
   *     `fin_le`, comparé à `CURDATE()`, le jour de jeu. Un jour, pas un
   *     instant : il ne traverse aucun fuseau.
   *
   * Sans aucune saison lancée, le bonus agit comme avant : il n'y a pas de
   * saison qui puisse finir.
   *
   * Tout se juge en SQL, sur les colonnes écrites par l'horloge de la base
   * (`achete`, `lancee_a`). Sur une base où `sql/quotidien.sql` n'est pas
   * passé (pas de `fin_le`) ou sans `sql/saisons.sql`, la lecture retombe
   * sur celle d'avant, et le journal le dit une fois : un bonus qui ne
   * s'éteint pas vaut mieux qu'un Virage où l'on ne peut plus entrer.
   *
   * **Un bonus que le catalogue ne connaît pas n'est pas actif** : il ne
   * s'affiche pas parmi les bonus actifs de la page, ne s'annonce pas dans le
   * panneau du Virage, et ne se décompte pas. Les lignes de « La quête » et
   * de « Mur de bâches » sont remboursées et éteintes au démarrage
   * (`rendreLesRetires`) avant qu'aucune lecture n'arrive ; la garde vaut
   * pour ce qui leur échapperait, et pour un bonus qu'on retirerait demain.
   */
  async function bonusActifs(kopId) {
    const lignes = await lireActifs(kopId);
    return lignes.filter((a) => BONUS_PAR_ID.has(a.bonus_id));
  }

  /** La règle de saison ci-dessus, en base, avec ses replis. */
  async function lireActifs(kopId) {
    try {
      /* La saison « s » est la saison en cours si aucune n'a été lancée
         après elle. */
      return await q(
        `SELECT b.* FROM kop_bonus b
          WHERE b.kop_id = ? AND b.epuise IS NULL
            AND (b.restant IS NULL OR b.restant > 0)
            AND (b.portee <> 'saison'
                 OR NOT EXISTS (SELECT 1 FROM saisons x WHERE x.lancee_a IS NOT NULL)
                 OR EXISTS (
                   SELECT 1 FROM saisons s
                    WHERE s.lancee_a IS NOT NULL
                      AND NOT EXISTS (SELECT 1 FROM saisons t
                                       WHERE t.lancee_a IS NOT NULL
                                         AND t.lancee_a > s.lancee_a)
                      AND b.achete >= s.lancee_a
                      AND (s.fin_le IS NULL OR s.fin_le >= CURDATE())))`, [kopId]);
    } catch (e) {
      if (e?.code !== 'ER_NO_SUCH_TABLE' && e?.code !== 'ER_BAD_FIELD_ERROR') throw e;
      // Sans la table des bonus, il n'y a rien à replier : c'est sql/kop.sql
      // qui manque, et l'appelant le dit.
      if (/kop_bonus/.test(e.sqlMessage ?? e.message ?? '')) throw e;
      direUneFois('saison', `[kop] les bonus de saison ne s’éteignent pas : ${
        e.sqlMessage ?? e.message} (applique sql/saisons.sql puis sql/quotidien.sql)`);
      return q(
        `SELECT * FROM kop_bonus
          WHERE kop_id = ? AND epuise IS NULL
            AND (restant IS NULL OR restant > 0)`, [kopId]);
    }
  }

  /**
   * Les modificateurs que le KOP de ce joueur lui apporte pour ce match.
   *
   * Rendus dans le vocabulaire du moteur — `tempoWindow`, `breathBonus`,
   * `pushMult`… — et fusionnés par multiplication. Le VIRAGE les mêle à ceux du
   * Fanzzy équipé sans savoir d'où ils viennent, et c'est ce qui permet à un
   * bonus de KOP de peser sur une mécanique inventée demain.
   *
   * Les bonus **ne se cumulent pas entre eux sur la même clé** : le plus fort
   * l'emporte. Deux bonus de tempo achetés le même soir donneraient sinon une
   * fenêtre de tempo absurde, et un KOP riche deviendrait injouable à
   * affronter.
   */
  async function modsDe(userId, teamId, fixtureId = null) {
    try {
      const k = await mienPour(userId, teamId);
      if (!k) return {};
      await depouillerEchus(k.id);

      const actifs = await bonusActifs(k.id);
      if (!actifs.length) return {};

      const mods = {};
      const ids = [];
      for (const a of actifs) {
        const def = BONUS_PAR_ID.get(a.bonus_id);
        if (!def) continue;
        ids.push(def.id);
        for (const [cle, v] of Object.entries(def.mods)) {
          mods[cle] = Math.max(mods[cle] ?? 0, v);
        }
      }

      /* La consommation. Un bonus de match ou à charges se décompte **une fois
         par match**, pas une fois par entrée dans le VIRAGE : sans
         `fixture_id`, quelqu'un qui rafraîchit sa page trois fois brûlerait
         trois matchs de bonus. */
      if (fixtureId != null) {
        for (const a of actifs) {
          if (a.portee === 'saison') continue;
          if (Number(a.fixture_id) === Number(fixtureId)) continue;
          const restant = Math.max(0, Number(a.restant ?? 1) - 1);
          /* L'instant de l'épuisement par l'horloge de la base, comme
             `achete` à côté : un `Date` de Node passé au pool s'écrivait en
             UTC, deux heures avant l'heure de toutes les autres colonnes. */
          await q(
            `UPDATE kop_bonus SET restant = ?, fixture_id = ?,
                    epuise = IF(? > 0, NULL, NOW(3))
              WHERE id = ? AND (fixture_id IS NULL OR fixture_id <> ?)`,
            [restant, fixtureId, restant, a.id, fixtureId]);
        }
      }

      return { ...mods, kopId: k.id, kopNom: k.nom, kopBonus: ids };
    } catch (e) {
      // Un bonus indisponible ne doit pas empêcher d'entrer dans le virage.
      if (!/doesn't exist/i.test(e.message ?? '')) console.error('[kop] mods', e.message);
      return {};
    }
  }

  /* ------------------------------------------------------ les visages

     Le personnage et le niveau de chaque membre, pour la tribune de la page
     du KOP (`CONTRATS.md`, § 3). `habillerJoueurs` les lit en trois requêtes
     pour toute la liste, réduit l'avatar à sa liste blanche, et rend
     `avatar: null` sans niveau pour un compte qui n'est plus actif : un
     membre dont le compte a été supprimé garde sa ligne — son versement au
     pot a eu lieu — mais son personnage ne réapparaît jamais.

     La carte est gardée `VISAGES_MS` par KOP, **avec la liste des membres
     qu'elle habille** : un arrivant n'attend pas une minute son visage, la
     liste a changé, la carte se refait. On garde la promesse et non la
     valeur, pour que dix relectures simultanées après l'expiration ne
     lancent qu'un calcul. */
  const visages = new Map();   // kopId → { cle, t, carte: Promise<Map> }

  function visagesDe(kopId, ids) {
    const cle = [...ids].sort().join(',');
    const maintenant = Date.now();
    const deja = visages.get(kopId);
    if (deja && deja.cle === cle && maintenant - deja.t < VISAGES_MS) return deja.carte;

    const entree = { cle, t: maintenant, carte: habillerJoueurs(q, ids) };
    visages.set(kopId, entree);
    // Un échec ne reste pas en mémoire : la relecture suivante réessaie.
    entree.carte.catch(() => {
      if (visages.get(kopId) === entree) visages.delete(kopId);
    });
    /* Une entrée par KOP regardé : on balaie les périmées quand il y en a
       beaucoup, pour qu'un serveur qui tourne des mois ne les garde pas
       toutes. */
    if (visages.size > 500) {
      for (const [id, v] of visages) if (maintenant - v.t >= VISAGES_MS) visages.delete(id);
    }
    return entree.carte;
  }

  /** L'état complet d'un KOP : membres, pot, vote en cours, bonus actifs. */
  async function etat(kopId, userId) {
    await depouillerEchus(kopId);
    const k = (await q(`SELECT * FROM kops WHERE id = ?`, [kopId]))[0];
    if (!k) throw fail('kop.error.inconnu');

    /* Le temps restant du vote se compte **en SQL**, entre deux valeurs de la
       même horloge. `ferme` est écrit par `NOW(3)`, à l'heure de la session
       MySQL ; relu par le pilote en UTC, il partait deux heures dans le futur
       sur une base à l'heure de Zurich, et le chrono affiché après un
       rechargement durait deux heures et trois minutes. */
    const [membres, vote, actifs] = await Promise.all([
      q(`SELECT m.user_id, m.verse, m.depuis, u.pseudo
           FROM kop_membres m JOIN users u ON u.public_id = m.user_id
          WHERE m.kop_id = ? ORDER BY m.verse DESC`, [kopId]),
      q(`SELECT *,
                GREATEST(0, UNIX_TIMESTAMP(ferme) - UNIX_TIMESTAMP(NOW(3))) * 1000
                  AS ferme_dans_ms
           FROM kop_votes WHERE kop_id = ? AND issue = 'en_cours' LIMIT 1`, [kopId]),
      bonusActifs(kopId),
    ]);

    let bulletins = [];
    if (vote[0]) {
      bulletins = await q(
        `SELECT user_id AS userId, pour FROM kop_bulletins WHERE vote_id = ?`, [vote[0].id]);
    }

    /* Les visages sont un habillage : s'ils manquent, la tribune montre les
       initiales, et la page du KOP — le pot, le vote — reste lisible. */
    let carte = null;
    try {
      carte = await visagesDe(kopId, membres.map((m) => m.user_id));
    } catch (e) {
      direUneFois(`visages:${e?.code ?? e?.message}`,
        `[kop] membres servis sans avatar ni niveau : ${e?.sqlMessage ?? e?.message}`);
    }

    return {
      id: k.id, nom: k.nom, teamId: k.team_id, pot: k.pot, verseTotal: k.verse_total,
      createur: k.createur, jeSuisCreateur: k.createur === userId,
      membres: membres.map((m) => {
        const ligne = { id: m.user_id, pseudo: m.pseudo, verse: m.verse,
          depuis: m.depuis, createur: m.user_id === k.createur };
        /* `avatar` absent : on ne sait pas (catalogue absent, table
           manquante) ; `null` : pas de Fanzzy, ou un compte effacé. Le
           niveau, lui, est absent dès qu'il n'est pas sûr. */
        const h = carte?.get(m.user_id);
        if (h && 'avatar' in h) ligne.avatar = h.avatar;
        if (Number.isInteger(h?.niveau)) ligne.niveau = h.niveau;
        return ligne;
      }),
      vote: vote[0] ? {
        id: vote[0].id, bonusId: vote[0].bonus_id, prix: vote[0].prix,
        ferme: vote[0].ferme,
        fermeDansMs: Math.max(0, Math.round(Number(vote[0].ferme_dans_ms) || 0)),
        // Le décompte en direct, avec le poids réel de chaque voix.
        ...depouiller(bulletins.map((b) => ({ userId: b.userId, pour: Boolean(b.pour) })),
          k.createur),
        monBulletin: bulletins.find((b) => b.userId === userId)?.pour ?? null,
      } : null,
      bonus: actifs.map((a) => ({ id: a.id, bonusId: a.bonus_id, portee: a.portee,
        restant: a.restant })),
      catalogue: BONUS,
    };
  }

  /* ------------------------------------------ le remboursement des retirés */

  /**
   * Rend au pot de chaque KOP ce que les bonus retirés lui avaient coûté,
   * **une fois** — et ne fait rien quand il n'y a rien à rendre.
   *
   * `server.js` l'appelle à **chaque** démarrage, avant d'écouter : c'est ce
   * qui le fait passer en production sans geste de plus que le déploiement
   * habituel. Le premier démarrage après la livraison rembourse ; les
   * suivants ne trouvent plus rien, et une seule lecture le leur dit (la
   * table des bonus achetés est petite : quelques lignes par KOP).
   *
   * **La marque est sur la ligne, et elle s'écrit avec le crédit.** Dans une
   * seule transaction par KOP : chaque ligne de `kop_bonus` d'un bonus retiré
   * prend le `bonus_id` `rendu:<id>` (`RENDU`), `restant` à zéro et son
   * épuisement daté s'il ne l'était pas ; puis le pot reçoit la somme des
   * prix. Une transaction interrompue ne laisse donc ni un pot crédité sans
   * marque, qui serait recrédité au démarrage suivant, ni une marque sans
   * crédit, qui ne le serait jamais. Toutes les lignes sont rendues, même
   * celles que des matchs avaient décomptées avant le 3 octobre : ces matchs
   * n'ont rien reçu.
   *
   * L'ordre est celui du dépouillement (`depouillerUn`), et pour la même
   * raison : le pot **sous verrou d'abord**, première lecture de la
   * transaction, puis les lignes relues sous verrou. Deux démarrages
   * simultanés, ou un dépouillement en même temps, passent l'un après
   * l'autre, et le second ne trouve plus de ligne à rendre.
   *
   * Un KOP par transaction : celui qui échoue (verrou trop long, connexion
   * perdue) n'empêche pas les autres, il est annulé entier, et le démarrage
   * suivant le reprend. **Ne lève jamais** : un remboursement en panne ne doit
   * pas éteindre l'application (une exception au démarrage coupe `/api`). Le
   * journal dit chaque KOP remboursé, chaque échec, et le bilan.
   *
   * Les identifiants retirés partent en **un** paramètre, une liste que
   * `query` développe en `'echarpes', 'contres'` (`execute` ne le sait pas) :
   * le texte de la requête ne reçoit rien, et le jour où un troisième bonus
   * serait retiré, il suffirait de l'ajouter à `BONUS_RETIRES`.
   *
   * @returns {Promise<{ kops: number, lignes: number, echarpes: number, echecs: number }>}
   */
  async function rendreLesRetires() {
    const ids = [...BONUS_RETIRES.keys()];
    const bilan = { kops: 0, lignes: 0, echarpes: 0, echecs: 0 };

    let concernes;
    try {
      [concernes] = await pool.query(
        'SELECT DISTINCT kop_id FROM kop_bonus WHERE bonus_id IN (?)', [ids]);
    } catch (e) {
      bilan.echecs = 1;
      console.error(`[kop] bonus retirés : rien n’a pu être rendu (${
        e.sqlMessage ?? e.message}) — repris au prochain démarrage`);
      return bilan;
    }

    for (const { kop_id: kopId } of concernes) {
      try {
        const r = await rendreAuKop(kopId, ids);
        if (!r) continue;
        bilan.kops += 1;
        bilan.lignes += r.lignes;
        bilan.echarpes += r.echarpes;
        console.log(`[kop] bonus retirés : ${r.echarpes} écharpes rendues au pot du KOP « ${
          r.nom} » (${kopId}) pour ${r.detail} ; pot ${r.avant} → ${r.avant + r.echarpes}`);
      } catch (e) {
        bilan.echecs += 1;
        console.error(`[kop] bonus retirés : le KOP ${kopId} n’a pas été remboursé (${
          e.sqlMessage ?? e.message}) — rien n’est écrit, repris au prochain démarrage`);
      }
    }

    console.log(bilan.kops || bilan.echecs
      ? `[kop] bonus retirés : ${bilan.echarpes} écharpes rendues à ${bilan.kops} KOP pour ${
        bilan.lignes} achat(s)${bilan.echecs ? `, ${bilan.echecs} KOP en échec` : ''}`
      : '[kop] bonus retirés : rien à rendre');
    return bilan;
  }

  /** Le remboursement d'un KOP, dans sa transaction ; `null` s'il n'y a rien. */
  async function rendreAuKop(kopId, ids) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[k]] = await conn.execute(
        `SELECT nom, pot FROM kops WHERE id = ? FOR UPDATE`, [kopId]);
      const [lignes] = await conn.query(
        `SELECT id, bonus_id FROM kop_bonus
          WHERE kop_id = ? AND bonus_id IN (?) FOR UPDATE`, [kopId, ids]);
      // Un autre démarrage est passé avant : il n'y a plus rien à rendre.
      if (!k || !lignes.length) {
        await conn.rollback();
        return null;
      }

      const parBonus = new Map();
      for (const l of lignes) parBonus.set(l.bonus_id, (parBonus.get(l.bonus_id) ?? 0) + 1);
      const echarpes = lignes.reduce((s, l) => s + BONUS_RETIRES.get(l.bonus_id).prix, 0);

      const [maj] = await conn.query(
        `UPDATE kop_bonus
            SET bonus_id = CONCAT(?, bonus_id), restant = 0, epuise = COALESCE(epuise, NOW(3))
          WHERE kop_id = ? AND bonus_id IN (?)`, [RENDU, kopId, ids]);
      /* Sous verrou, elles sont toutes là. Si ce n'était pas le cas, rien ne
         s'écrit : un crédit qui ne correspondrait pas aux lignes marquées est
         exactement ce qu'il ne faut pas laisser. */
      if (maj.affectedRows !== lignes.length) {
        await conn.rollback();
        throw new Error(`${maj.affectedRows} ligne(s) marquée(s) pour ${lignes.length} lue(s)`);
      }
      await conn.execute(`UPDATE kops SET pot = pot + ? WHERE id = ?`, [echarpes, kopId]);
      await conn.commit();

      return {
        nom: k.nom, avant: Number(k.pot), echarpes, lignes: lignes.length,
        detail: [...parBonus].map(([id, n]) => `${n} × « ${BONUS_RETIRES.get(id).nom} »`)
          .join(' et '),
      };
    } catch (e) {
      try { await conn.rollback(); } catch { /* la connexion est déjà perdue */ }
      throw e;
    } finally {
      conn.release();
    }
  }

  /* ------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (res.headersSent) return;
    const code = String(e.code ?? '').startsWith('kop.') ? e.code : 'kop.error.server';
    if (code === 'kop.error.server') console.error('[kop]', e.message);
    res.status(400).json({ error: code });
  });

  router.get('/miens', requireAuth, safe(async (req, res) => {
    const liste = await miens(req.user.id);
    for (const k of liste) await depouillerEchus(k.id);
    res.json({ kops: liste, catalogue: BONUS, dureeVoteMs: DUREE_VOTE_MS });
  }));

  /* Les KOP d'un club, et ses couleurs quand elles sont connues, de la forme
     de `/miens` : la page en peint la bâche de la carte du club. `couleurs`
     est absent plutôt que vide (`CONTRATS.md`, R1). Les deux lectures
     partent ensemble : la seconde est une lecture par clé, la page n'attend
     pas davantage. */
  router.get('/club/:teamId', requireAuth, safe(async (req, res) => {
    const teamId = Number(req.params.teamId);
    const [kops, couleurs] = await Promise.all([pourClub(teamId), couleursPour(teamId)]);
    res.json(couleurs.length ? { kops, couleurs } : { kops });
  }));

  router.get('/:id', requireAuth, safe(async (req, res) =>
    res.json(await etat(req.params.id, req.user.id))));

  router.post('/', requireAuth, safe(async (req, res) =>
    res.json(await creer(req.user.id, Number(req.body?.teamId), req.body?.nom))));

  router.post('/:id/rejoindre', requireAuth, safe(async (req, res) =>
    res.json(await rejoindre(req.user.id, req.params.id))));

  router.post('/:id/quitter', requireAuth, safe(async (req, res) =>
    res.json(await quitter(req.user.id, req.params.id))));

  router.post('/:id/proposer', requireAuth, safe(async (req, res) =>
    res.json(await proposer(req.user.id, req.params.id, req.body?.bonusId))));

  router.post('/vote/:voteId', requireAuth, safe(async (req, res) =>
    res.json(await voter(req.user.id, req.params.voteId, Boolean(req.body?.pour)))));

  /* ------------------------------------------------------------- socket

     Le serveur émet vers `kop:<id>` quand un vote s'ouvre ou se dépouille.
     Encore faut-il que quelqu'un y soit : sans ce salon, les notifications
     partaient dans le vide et les trois minutes du vote s'écoulaient pendant
     que les membres regardaient une page immobile.

     On rejoint **tous ses KOP** d'un coup plutôt qu'un par page ouverte : un
     vote qui s'ouvre sur le KOP de Bâle doit atteindre celui qui regarde la
     page de son KOP de Sion, sinon il le découvre après la clôture. */
  if (io) {
    io.on('connection', (socket) => {
      socket.on('kop:suivre', async () => {
        const u = socket.data?.user;
        if (!u?.userId) return;
        try {
          for (const k of await miens(u.userId)) socket.join(`kop:${k.id}`);
        } catch (e) {
          // Pas de KOP, pas de table, peu importe : la page marche sans temps
          // réel, elle relit simplement à son rythme.
          if (!/doesn't exist/i.test(e.message ?? '')) console.error('[kop] suivre', e.message);
        }
      });
    });
  }

  return { router, miens, mienPour, pourClub, creer, rejoindre, quitter,
    verser, proposer, voter, depouillerEchus, modsDe, etat, rendreLesRetires, PART_POT };
}
