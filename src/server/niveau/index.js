import express from 'express';
import { assurerBourse } from '../bourse.js';
import { XP, niveauPour, progression, droits, paliersEntre, ecarpesDuPalier, NIVEAU_MAX,
  PALIERS }
  from '../../shared/niveau.js';

/**
 * Le niveau, côté serveur.
 *
 * Deux responsabilités, et une seule porte pour chacune :
 *
 * **Créditer.** Toute XP entre par ici, et par une seule règle de calcul,
 * `gagnerDans()`. Les modules qui en produisent — les boosters, les duels, le
 * grand livre des récompenses — n'écrivent jamais la colonne eux-mêmes. Sans
 * ce passage obligé, la montée de palier serait détectée à trois endroits
 * différents, et un jour à deux seulement.
 *
 * Il y a deux façons d'entrer, selon ce que l'appelant tient déjà :
 *
 *   — `gagner(userId, xp)` ouvre sa propre transaction. C'est la porte des
 *     boosters et des duels, qui créditent l'XP après coup, hors de leur
 *     propre transaction, et qui ne doivent jamais échouer pour elle ;
 *   — `gagnerDans(conn, userId, xp)` travaille sur la connexion de
 *     l'appelant, **dans sa transaction**. C'est la porte du grand livre
 *     (`recompenses.js`) : la ligne du registre, les écharpes, les boosters et
 *     l'XP y entrent ensemble ou pas du tout.
 *
 * Une seule règle de calcul, deux façons de l'appeler : `gagner()` n'est que
 * `gagnerDans()` enveloppée d'une transaction et d'un filet.
 *
 * **Autoriser.** `droitsDe()` répond « ce joueur a-t-il le droit ». Les slots
 * d'équipe et les emplacements de deck passent par là plutôt que de refaire
 * chacun sa comparaison de niveau.
 *
 * Les **séries** en sont sorties : elles s'ouvrent par saison, pour tout le
 * monde le même jour, et plus au niveau de chacun. Ce que le niveau ouvre
 * encore est une capacité — elle n'a de sens que pour un joueur donné, et
 * personne n'a envie qu'on la lui annonce.
 *
 * **Un gain d'XP ne fait jamais échouer ce qui l'a produit**, quand il passe
 * par `gagner()`. Un booster ouvert reste ouvert même si la bourse n'a pas pu
 * être créditée : les cartes sont déjà dans la collection, et rendre une
 * erreur au joueur pour une barre de progression serait absurde. On
 * journalise et on continue — c'est la même règle que pour les écharpes de fin
 * de duel. `gagnerDans()` fait l'inverse, exprès : son appelant a promis
 * « entier ou rien », et c'est à lui d'annuler.
 *
 * @param o.pool         le pool du serveur (`mysql2/promise`)
 * @param o.requireAuth  le garde de session des routes
 * @param o.crochets     pour les suites seulement : `apresLecture({ userId,
 *                       xp, montant })`, attendu entre la lecture de l'XP et
 *                       son écriture. Il rend une course **certaine** au lieu
 *                       de probable : sans verrou, deux gains qui s'y
 *                       retrouvent ensemble ont forcément lu la même XP.
 */
export function createNiveau({ pool, requireAuth, crochets = {} }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /* L'objet rendu quand rien n'a été crédité : celui d'avant le contrat, à
     l'identique. Les appelants le reconnaissent à `xp: 0` et à l'absence de
     `gain` — le contrat veut alors le champ `niveau` absent de la réponse, pas
     une jauge à zéro (`CONTRATS.md`, § 1, « Absence »). Neuf à chaque appel :
     un tableau `paliers` partagé finirait modifié par un appelant. */
  const vide = () => ({ xp: 0, niveau: 1, avant: 1, monte: false, paliers: [], ecarpes: 0 });

  /**
   * Crédite `montant` d'XP sur la connexion de l'appelant, dans sa
   * transaction, et rend la jauge d'avant et d'après.
   *
   * **Sans filet, exprès.** Ni `beginTransaction`, ni `commit`, ni `try` qui
   * avale : une erreur remonte telle quelle, son `code` compris
   * (`ER_BAD_FIELD_ERROR` pour une colonne absente, que le grand livre traduit
   * en `schema`), et c'est l'appelant qui annule. Une ligne du grand livre qui
   * dit « 20 XP » sans que l'XP soit arrivée ne se rattraperait jamais : sa
   * clé interdit de la verser une seconde fois.
   *
   * **L'XP se relit sous verrou.** C'était le défaut E2. La lecture se faisait
   * sans verrou, les paliers se calculaient sur elle, puis l'écriture
   * ajoutait. Deux gains simultanés — un booster et la fin d'un duel, deux
   * onglets — lisaient donc la même XP : à 50, deux fois +20 payaient deux
   * fois les écharpes du niveau 2 ; à 45, deux fois +10 ne les payaient
   * jamais, chacun croyant s'arrêter à 55. Avec `FOR UPDATE`, le second
   * attend que le premier ait validé, et calcule sur ce que le premier a
   * écrit. Le grand livre tient déjà le verrou de cette ligne dans la même
   * transaction : il est repris sans attendre.
   *
   * La bourse doit exister : l'appelant l'ouvre (`assurerBourse`) **avant** sa
   * transaction. Dedans, `INSERT IGNORE` sur une ligne qui existe pose un
   * verrou partagé, et deux transactions du même joueur qui en tiendraient
   * chacune un s'interbloqueraient au `FOR UPDATE`.
   *
   * @param conn     une connexion de `mysql2/promise`, transaction ouverte
   * @param userId   l'identifiant public du joueur
   * @param montant  un entier ≥ 0. À 0, rien n'est lu ni écrit, et la fonction
   *                 rend `null` : sans gain, il n'y a pas de jauge à montrer.
   * @returns {null | {xp:number, gain:number, niveau:number, dans:number,
   *            pour:number, part:number, max:boolean, avant:number,
   *            monte:boolean, paliers:Array, ecarpes:number,
   *            depart:{xp:number, niveau:number, dans:number, pour:number,
   *                    part:number, max:boolean}}}
   *          l'objet `niveau` de `CONTRATS.md`, § 1, champ pour champ
   */
  async function gagnerDans(conn, userId, montant) {
    /* Un montant qui n'est pas un entier positif est une faute de l'appelant,
       pas un gain à arrondir : le grand livre inscrit le sien tel quel, et
       l'XP créditée doit être exactement celle que sa ligne annonce. */
    if (!Number.isInteger(montant) || montant < 0) {
      throw new Error(`niveau : gagnerDans attend un entier positif ou nul, reçu ${
        JSON.stringify(montant)}`);
    }
    if (montant === 0) return null;

    const [lignes] = await conn.execute(
      'SELECT xp FROM user_wallet WHERE user_id = ? FOR UPDATE', [userId]);
    if (!lignes.length) {
      throw new Error(`niveau : aucune bourse pour le joueur ${userId} — l’appelant l’ouvre `
        + '(assurerBourse) avant sa transaction');
    }
    const avantXp = Number(lignes[0].xp ?? 0);
    if (crochets.apresLecture) await crochets.apresLecture({ userId, xp: avantXp, montant });

    const apresXp = avantXp + montant;
    const avant = niveauPour(avantXp);
    const apres = progression(apresXp);

    /* Les écharpes de palier se versent dans la même requête que l'XP.
       Séparées, un incident entre les deux laisserait un joueur monté de
       niveau sans sa récompense — et rien pour s'en apercevoir, puisque le
       palier ne se franchit qu'une fois. */
    let ecarpes = 0;
    for (let k = avant + 1; k <= apres.niveau; k++) ecarpes += ecarpesDuPalier(k);

    await conn.execute(
      'UPDATE user_wallet SET xp = xp + ?, scarves = scarves + ? WHERE user_id = ?',
      [montant, ecarpes, userId]);

    /* La jauge d'avant se calcule sur l'XP **lue**, pas sur celle d'après
       moins le gain : c'est la même chose tant que tout va bien, et ce n'est
       plus la même chose le jour où quelque chose écrit à côté. L'anneau
       s'anime de `depart.part` vers `part` : un départ faux le ferait sauter.

       Les paliers sont des copies : ceux de `PALIERS` sont la table du jeu,
       et une réponse qu'un appelant retoucherait ne doit pas la modifier. */
    return {
      xp: apresXp,
      gain: montant,
      ...apres,
      avant,
      monte: apres.niveau > avant,
      paliers: paliersEntre(avant, apres.niveau).map((p) => ({ ...p })),
      ecarpes,
      depart: { xp: avantXp, ...progression(avantXp) },
    };
  }

  /**
   * Ajoute de l'XP dans une transaction à lui, et rend ce qui a changé.
   *
   * `montant` est calculé par l'appelant à partir de `XP` : c'est lui qui sait
   * s'il s'agit d'un booster, d'un entraînement ou d'une victoire.
   *
   * Rend l'objet `niveau` du contrat (`CONTRATS.md`, § 1), avec un `gain`
   * positif, quand l'XP est créditée — montée ou pas. Sinon (montant nul,
   * schéma incomplet, base indisponible) : l'objet vide, à `xp: 0` et **sans
   * `gain`**. Ne lève jamais.
   *
   * **Jamais depuis une transaction qui tient déjà la bourse de ce joueur sur
   * une autre connexion.** `gagner()` attendrait ce verrou, que l'appelant ne
   * rendrait qu'après lui : cinquante secondes d'attente, puis un gain perdu.
   * Qui tient une transaction appelle `gagnerDans()` avec sa connexion.
   */
  async function gagner(userId, montant) {
    const n = Math.max(0, Math.round(Number(montant) || 0));
    if (!n) return vide();

    let conn = null;
    let enCours = false;
    try {
      // Avant la transaction, pas dedans : voir le pavé de `gagnerDans`.
      await assurerBourse(q, userId);
      conn = await pool.getConnection();
      await conn.beginTransaction();
      enCours = true;
      const r = await gagnerDans(conn, userId, n);
      await conn.commit();
      enCours = false;
      return r;
    } catch (e) {
      if (enCours) await conn.rollback().catch(() => {});
      // Une colonne absente ne doit pas casser l'ouverture d'un booster : le
      // message nomme le fichier à appliquer, ce que « Unknown column 'xp' »
      // ne fait pas.
      if (e?.code === 'ER_BAD_FIELD_ERROR' || e?.code === 'ER_NO_SUCH_TABLE'
        || /Unknown column|doesn't exist/i.test(e?.message ?? '')) {
        console.error('[niveau] schéma incomplet — applique sql/niveau.sql :', e.message);
      } else {
        console.error('[niveau]', e?.message ?? e);
      }
      return vide();
    } finally {
      conn?.release();
    }
  }

  /**
   * L'XP d'un joueur, ou `null` si la colonne est **illisible** — sans lever
   * quand elle n'existe pas encore.
   *
   * La nuance compte, et elle a coûté cher : renvoyer zéro dans les deux cas
   * confondait « nouveau joueur » et « migration pas appliquée ».
   */
  let deja = false;
  async function xpDe(userId) {
    try {
      const r = await q(`SELECT xp FROM user_wallet WHERE user_id = ?`, [userId]);
      return Number(r[0]?.xp ?? 0);
    } catch (e) {
      // Une fois, pas à chaque requête : ce message doit rester lisible dans
      // un journal, pas le noyer.
      if (!deja) {
        deja = true;
        console.error('[niveau] colonne xp illisible — applique sql/niveau.sql. '
          + 'En attendant, tous les déblocages sont ouverts : ' + e.message);
      }
      return null;
    }
  }

  /**
   * Ce que ce joueur a le droit de faire.
   *
   * Les modules qui limitent — kiosque, clubs suivis, deck — passent par ici.
   * Refaire la comparaison de niveau chacun de son côté, c'est se garantir que
   * deux d'entre eux finiront par ne plus dire la même chose.
   */
  async function droitsDe(userId) {
    const xp = await xpDe(userId);

    /* **Une progression illisible n'enlève rien.**
     *
     * C'est la règle, et elle vient d'une vraie panne. Sans la colonne `xp`,
     * la version d'avant lisait zéro, en concluait « niveau 1 », et
     * *confisquait* : plus qu'une série au kiosque, deux emplacements de deck,
     * deux clubs. Le jeu se refermait sur tout le monde parce qu'un `ALTER
     * TABLE` n'avait pas été joué — sans erreur, sans message, avec des refus
     * parfaitement polis.
     *
     * Un schéma incomplet est une faute d'exploitation. Elle doit être bruyante
     * dans les journaux et **invisible pour le joueur**, jamais l'inverse. On
     * ouvre donc tout, et le journal dit quoi appliquer.
     */
    if (xp === null) {
      return { xp: 0, ...progression(0), ...droits(NIVEAU_MAX), indisponible: true };
    }

    return { xp, ...progression(xp), ...droits(niveauPour(xp)) };
  }

  /* -------------------------------------------------------------- routes */

  const router = express.Router();

  router.get('/', requireAuth, async (req, res) => {
    const d = await droitsDe(req.user.id);
    res.json({
      xp: d.xp,
      niveau: d.niveau,
      dans: d.dans,
      pour: d.pour,
      part: d.part,
      max: d.max,
      niveauMax: NIVEAU_MAX,
      /* Plus de `series` ici. Le niveau n'ouvre plus de séries — ce sont les
         saisons, depuis l'administration, pour tout le monde le même jour. Les
         séries ouvertes sont dans `/api/fanzzy/dex`, qui les sert déjà à tous
         puisqu'elles ne dépendent plus du joueur. */
      slots: d.slots,
      deckFanzzy: d.deckFanzzy,
      // Ce que rapporte chaque geste, pour que l'écran puisse l'annoncer sans
      // recopier le barème — une copie qui divergerait au premier réglage.
      gains: XP,
      /* **Le chemin**, palier par palier : ce qui est derrière, ce qui vient.

         Un joueur ne voyait de son niveau qu'une pastille sur l'accueil — un
         chiffre, sans jauge, sans suite, sans rien qui dise à quoi il sert.
         Monter d'un niveau n'était donc jamais attendu, et le palier qui ouvre
         un troisième Fanzzy au deck arrivait comme une surprise chez ceux qui
         le remarquaient.

         On envoie la **donnée** — le rang et ce qu'il ouvre — et non la phrase :
         c'est à l'écran de nommer, et au serveur de compter. Une page qui
         porterait sa propre copie de la table promettrait un jour un déblocage
         que le serveur refuse. */
      paliers: PALIERS.map((p) => ({
        niveau: p.niveau,
        slots: p.slots ?? null,
        deckFanzzy: p.deckFanzzy ?? null,
        /* Les écharpes que ce palier verse en arrivant. Elles existent depuis
           longtemps — voir `ecarpesDuPalier` — et rien ne les annonçait jamais
           avant qu'elles tombent. */
        echarpes: ecarpesDuPalier(p.niveau),
      })),
      /* Les écharpes de **chaque** niveau, du 2 au dernier, et pas seulement
         de ceux qui ouvrent quelque chose.

         Le chemin du profil pose un nœud par niveau à venir, et chacun annonce
         ce qu'il versera en arrivant. `paliers` ne le disait que pour sept
         d'entre eux : pour les vingt-deux autres, la page recopiait la règle
         « dix par niveau » de `ecarpesDuPalier`. Une copie qui ne se voit pas,
         et qui promettrait un montant faux le jour où la règle changera — en
         réglage, par exemple. Le serveur compte, l'écran nomme (`CONTRATS.md`,
         R7) : on sert donc les nombres eux-mêmes.

         La même table pour tout le monde, comme `paliers` : elle ne dépend pas
         du joueur, et une progression illisible (`indisponible`) ne la rend
         pas moins vraie. Le niveau 1 n'y est pas : on y entre, on ne le
         franchit pas. Calculée à chaque lecture plutôt qu'une fois pour
         toutes : si la règle devient un réglage, elle suivra sans redémarrage. */
      echarpesParNiveau: Array.from({ length: NIVEAU_MAX - 1 }, (_, i) => ({
        niveau: i + 2,
        echarpes: ecarpesDuPalier(i + 2),
      })),
    });
  });

  return { router, gagner, gagnerDans, xpDe, droitsDe };
}
