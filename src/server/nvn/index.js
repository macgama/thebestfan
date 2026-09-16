import { randomUUID } from 'node:crypto';
import express from 'express';
import { DuelNvN, RULES } from './engine.js';
import { Cheat } from '../ferveur/gestures.js';
import { FORMATS } from '../deck/index.js';
import { XP } from '../../shared/niveau.js';
import { reglage } from '../../shared/reglages.js';
// La même règle qu'au Virage : le club qu'on soutient dans cette
// rencontre, ou rien du tout si on n'en suit aucun des deux.
import { clubSoutenu, campDe } from '../football/suivis.js';

/**
 * Couche réseau du duel N contre N.
 *
 * Le moteur ne connaît ni socket ni base. Ce module fait le reste : il forme
 * les équipes, ouvre les salles, diffuse les événements et gère les départs.
 *
 * Deux choix qui gouvernent le reste :
 *
 * **La file est par format, par match support ET par camp.** Deux joueurs qui
 * veulent un 3v3 sur Sion–Bâle jouent ensemble ; celui qui veut un 3v3 sur un
 * autre match attend ailleurs. Et les deux tribunes du duel sont les deux
 * clubs du match : on est placé d'office du côté du club qu'on suit, et on
 * choisit son camp quand on n'en suit aucun.
 *
 * C'est deux fois plus lent à remplir, et c'est le prix de la chose : un duel
 * dont les deux tribunes se valent n'est pas un duel de tribunes. Le camp
 * délaissé est annoncé dans la file et sa ferveur vaut davantage — sans quoi
 * un match dont personne ne suit le visiteur ne partirait jamais.
 *
 * **Une déconnexion ne fait pas perdre l'équipe.** Le joueur cesse simplement
 * de pousser et sa place l'attend : les tribunes ne s'effondrent pas parce que
 * quelqu'un a pris l'ascenseur.
 */

const TICK_MS = 500;
const BOT_APRES_MS = 20_000;
const GRACE_MS = 90_000;

export function createNvN({ pool, io, requireAuth, decks, niveau = null, kop = null }) {
  const salles = new Map();          // duelId -> { duel, membres, timer }
  const salleDe = new Map();         // userId -> duelId
  const files = new Map();           // clé -> [candidats]
  const cadence = new WeakMap();     // socket -> horodatages

  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const cle = (format, fixtureId, camp) => `${format}:${fixtureId}:${camp}`;

  /* ------------------------------------------------------- appariement */

  async function entrerEnFile(socket, { format, fixtureId, camp, contreBot }) {
    const u = socket.data?.user;
    // On vérifie l'identifiant, pas seulement la présence de l'objet : une
    // session à moitié montée donnait un `{ userId: undefined }` bien truthy,
    // qui passait la garde et allait mourir au bind SQL. Le joueur recevait
    // alors « erreur serveur » là où la cause était une session invalide.
    if (!u?.userId) throw new Cheat('unauthenticated');
    if (!FORMATS[format]) throw new Cheat('unknown_format');
    if (!Number.isFinite(Number(fixtureId))) throw new Cheat('fixture_unknown');

    // Le deck et le match sont validés avant toute chose : mieux vaut refuser
    // maintenant que faire attendre trois minutes pour rien.
    const loadout = await decks.loadout(u.userId);
    if (!loadout) throw new Cheat('no_deck');
    const support = await decks.matchSupport(Number(fixtureId), u.userId);
    const maison = support.fixture.home.id;
    const exterieur = support.fixture.away.id;

    /* Le camp.
     *
     * **Chez soi, il ne se choisit pas** : il découle du club qu'on suit, et
     * c'est ce qui empêche d'aller pousser contre son propre club. Même règle
     * qu'au Grand Virage, et la même fonction — il n'y en a qu'une.
     *
     * **Ailleurs, il se choisit**, et c'est tout l'objet de ce duel-ci : on
     * vient tenir une tribune qui n'est pas la sienne. */
    const club = await clubSoutenu(q, u.userId, maison, exterieur);
    const monCamp = club.neutre
      ? (Number(camp) === 1 ? 1 : 0)
      : campDe(club.teamId, maison, exterieur);

    quitterFile(u.userId);

    const taille = FORMATS[format];
    const c = cle(format, fixtureId, monCamp);
    const file = files.get(c) ?? [];
    const enFace = files.get(cle(format, fixtureId, monCamp ^ 1)) ?? [];

    /* Le renfort.
     *
     * Un duel est maintenant tribune contre tribune : un match dont personne
     * ne suit l'équipe visiteuse ne se remplirait jamais. Celui qui va tenir le
     * camp délaissé en est donc payé — sa ferveur vaut davantage, et d'autant
     * plus que ce camp était vide quand il est arrivé.
     *
     * Le bonus est **figé à l'entrée** et ne bouge plus. Il récompense un
     * geste — être venu là où il manquait du monde — et non un état : au coup
     * d'envoi, les deux camps sont pleins et l'état a disparu.
     *
     * Il dépend du camp et non de la personne : un supporter du club délaissé
     * en profite comme un neutre. Un bonus qui dépendrait aussi de qui l'on est
     * demanderait deux phrases pour s'expliquer au lieu d'une. */
    const manque = Math.max(0, Math.min(taille, enFace.length - file.length));
    const bonus = 1 + (manque / taille) * (reglage('duel.renfort_max') - 1);

    file.push({ userId: u.userId, nom: u.name, socket, loadout, support,
                depuis: Date.now(), format, camp: monCamp,
                neutre: club.neutre, teamId: club.teamId, bonus,
                contreBot: Boolean(contreBot) });
    files.set(c, file);

    const clubs = [support.fixture.home, support.fixture.away];
    socket.emit('nvn:file', {
      format, mode: support.mode, raison: support.raison,
      camp: monCamp, neutre: club.neutre,
      club: clubs[monCamp], enFaceClub: clubs[monCamp ^ 1],
      attendus: taille, presents: file.length,
      enFace: enFace.length,
      // Ce qu'il manque **en face** : c'est cette phrase-là qui fait venir
      // quelqu'un tenir le camp délaissé.
      manqueEnFace: Math.max(0, taille - enFace.length),
      renfort: Number(bonus.toFixed(2)),
      botDansMs: attenteAvantBots(support.mode),
    });

    if (contreBot) return ouvrirAvecBots(c);
    return tenterAppariement(format, Number(fixtureId));
  }

  /**
   * Le temps qu'on laisse à de vraies gens avant d'appeler des bots.
   *
   * Vingt secondes pour un entraînement : on vient y jouer seul, tout de
   * suite. Bien plus pour un duel classé, et c'est nouveau — la file se scinde
   * désormais en deux camps, et vingt secondes ne laissent à personne le temps
   * de venir tenir celui qui manque. Le renfort n'aurait alors jamais lieu :
   * on jouerait toujours contre des machines avant qu'un humain arrive.
   *
   * Le serveur basculait déjà au bout de vingt secondes pour un duel classé
   * **sans le dire** — il annonçait `botDansMs` seulement en entraînement. Le
   * délai est maintenant annoncé dans les deux cas : un joueur qui attend a le
   * droit de savoir combien de temps.
   */
  const attenteAvantBots = (mode) => (mode === 'classe'
    ? reglage('duel.attente_classe_sec') * 1000 : BOT_APRES_MS);

  function quitterFile(userId) {
    for (const [c, file] of files) {
      const i = file.findIndex((f) => f.userId === userId);
      if (i === -1) continue;
      file.splice(i, 1);
      if (!file.length) files.delete(c);
      else files.set(c, file);
    }
  }

  /**
   * Deux camps pleins, et le duel part.
   *
   * Il n'y a plus d'alternance à faire : **le camp est l'équipe**. La liste
   * répartissait les arrivants un sur deux pour que les six premiers d'un 3v3
   * ne forment pas une équipe d'habitués contre une équipe de retardataires —
   * c'était la bonne réponse tant que les deux tribunes n'étaient qu'un ordre
   * d'arrivée. Elles portent maintenant les couleurs d'un vrai club.
   */
  function tenterAppariement(format, fixtureId) {
    const taille = FORMATS[format];
    const cles = [cle(format, fixtureId, 0), cle(format, fixtureId, 1)];
    const camps = cles.map((k) => files.get(k) ?? []);
    if (camps[0].length < taille || camps[1].length < taille) return null;

    const equipes = camps.map((f) => f.splice(0, taille));
    cles.forEach((k, i) => { if (!camps[i].length) files.delete(k); });
    return ouvrir(equipes, equipes[0][0].support);
  }

  /**
   * Entraînement immédiat : les places manquantes sont tenues par des bots.
   *
   * Les humains gardent **leur** camp, les bots tiennent le reste — le leur
   * comme celui d'en face. Un camp est un club : on ne mélange pas, même
   * quand la moitié de la salle est faite de machines.
   */
  function ouvrirAvecBots(c) {
    const file = files.get(c);
    if (!file?.length) return null;
    const { format, camp } = file[0];
    const taille = FORMATS[format];
    const humains = file.splice(0, taille);
    if (!file.length) files.delete(c);

    const equipes = [[], []];
    equipes[camp] = [...humains];
    for (const side of [0, 1]) {
      while (equipes[side].length < taille) {
        equipes[side].push(faireBot(humains[0].loadout, equipes[side].length, side));
      }
    }
    // Un entraînement ne compte jamais, même adossé à un match du jour.
    return ouvrir(equipes, { ...humains[0].support, mode: 'entrainement' });
  }

  function faireBot(modele, i, side) {
    return {
      userId: `bot:${randomUUID().slice(0, 8)}`,
      nom: ['Momo', 'Sarah', 'Le Gros', 'Nadia', 'Tonio'][i % 5],
      socket: null,
      /* Un bot d'entraînement **enseigne**, il ne verrouille pas.

         Il chantait toutes les 2,5 à 6 secondes, avec une adresse de 0,55 à
         0,85. Or un geste de tempo demande quatre secondes et demie à exécuter :
         **il était plus rapide qu'un humain ne peut physiquement l'être**, et
         il poussait aussi fort. Les deux camps se neutralisaient, et cinq
         minutes de duel se terminaient sur un nul.

         Il chante maintenant toutes les 7 à 13 secondes, moins juste. Un joueur
         appliqué gagne ; un débutant marque une ou deux fois et perd — ce qui
         est le but d'un entraînement. */
      bot: { prochain: Date.now() + 2500 + Math.random() * 3000,
        adresse: 0.30 + Math.random() * 0.25 },
      loadout: modele,
    };
  }

  /* ------------------------------------------------------------ salles */

  function ouvrir(equipes, support) {
    const id = randomUUID();
    const duel = new DuelNvN({
      id,
      equipes: equipes.map((eq) => eq.map((p) => ({
        userId: p.userId, nom: p.nom, loadout: p.loadout }))),
      fixture: support.fixture,
      mode: support.mode,
    });

    const membres = new Map();
    equipes.flat().forEach((p) => membres.set(p.userId, {
      socket: p.socket, bot: p.bot ?? null, coupeA: null, nom: p.nom,
      /* Ce que le joueur a décidé **en entrant en file** : le club qu'il
         défend, s'il y était chez lui, et ce que son renfort lui vaut. Retenu
         ici plutôt que relu à la fin — un joueur peut cesser de suivre un club
         pendant le duel, et ce qui compte est ce qui était vrai au moment du
         choix. Les bots n'ont rien décidé : les valeurs par défaut sont les
         leurs, et elles ne servent jamais puisqu'on les écarte. */
      neutre: p.neutre ?? true, teamId: p.teamId ?? null, bonus: p.bonus ?? 1 }));

    const salle = { duel, membres, room: `nvn:${id}` };
    salles.set(id, salle);

    for (const [userId, m] of membres) {
      if (!m.socket) continue;
      salleDe.set(userId, id);
      m.socket.join(salle.room);
      m.socket.emit('nvn:start', duel.vue(userId));
    }

    /* L'affiche part **après** le départ, et sans le retenir : elle lit la base,
       et un duel n'a pas à attendre une requête pour commencer. Un client qui ne
       la reçoit pas joue exactement comme avant. */
    void affiche(duel).then((a) => {
      for (const m of membres.values()) {
        if (m.socket?.connected) m.socket.emit('nvn:affiche', a);
      }
    }).catch((e) => console.error('[nvn] affiche', e.message));

    salle.timer = setInterval(() => void horloge(salle), TICK_MS);
    return salle;
  }

  /**
   * Un but réel dans un match support.
   *
   * Il ne concerne que les duels adossés à ce match précis. Les autres salles
   * n'en savent rien : un but à Lens ne doit pas secouer une corde tendue sur
   * un match de Super League.
   */
  function butReel(g) {
    let touchees = 0;
    for (const salle of salles.values()) {
      if (Number(salle.duel.fixture?.id) !== Number(g.fixtureId)) continue;
      const ev = salle.duel.butReel(
        { teamId: g.teamId, minute: g.minute, joueur: g.player });
      if (!ev.length) continue;
      touchees++;
      diffuser(salle, ev);
    }
    return touchees;
  }

  /**
   * Diffusion : les événements partent à tous, les vues restent privées.
   *
   * **L'état part même quand il ne s'est rien passé**, et c'est le point.
   *
   * La fonction commençait par `if (!evenements?.length) return;` : entre deux
   * actions, plus rien ne partait. Or il se passe quelque chose en permanence —
   * la corde retombe de 1,2 point par seconde, l'horloge tourne, le souffle
   * revient. Le joueur voyait donc une corde **figée** jusqu'à ce que quelqu'un
   * chante, puis un saut. La décroissance, qui est la tension du jeu, était
   * invisible : on ne pouvait pas voir qu'on était en train de perdre son
   * avance sans rien faire.
   *
   * Les **événements** restent conditionnels — envoyer un tableau vide dix fois
   * par seconde n'apprendrait rien à personne. C'est l'état qui part à chaque
   * battement, et il ne coûte que ce qu'il pèse : une salle diffuse deux fois
   * par seconde.
   */
  function diffuser(salle, evenements) {
    if (evenements?.length) io.to(salle.room).emit('nvn:events', evenements);
    for (const [userId, m] of salle.membres) {
      if (m.socket?.connected) m.socket.emit('nvn:state', salle.duel.vue(userId));
    }
    if (salle.duel.termine) fermer(salle);
  }

  async function horloge(salle) {
    const t = Date.now();
    try {
      const ev = salle.duel.tick(t);

      // Les bots jouent : un entraînement sans adversaire actif n'apprend rien.
      for (const [userId, m] of salle.membres) {
        if (!m.bot || salle.duel.termine || t < m.bot.prochain) continue;
        m.bot.prochain = t + 6000 + Math.random() * 5000;
        try {
          const j = salle.duel.joueur(userId);
          const carte = j.main[Math.floor(Math.random() * j.main.length)];
          if (carte && Math.random() < 0.35) ev.push(...salle.duel.jouer(userId, carte, t));
          else {
            /* Le bot choisit son chant comme un joueur : dans le répertoire du
               duel. Il envoyait `geste: 'tempo'`, un champ que le moteur
               n'a jamais lu — il chantait donc le geste que la rotation lui
               donnait, quel qu'il soit, avec des frappes de tempo. Il ratait
               tous les gestes qui n'en sont pas, et personne ne s'en étonnait
               puisqu'un bot est censé rater.

               Il prend au hasard : un bot qui optimiserait son souffle serait
               un adversaire d'entraînement plus dur qu'un humain. */
            const chant = salle.duel.repertoire[
              Math.floor(Math.random() * salle.duel.repertoire.length)];
            ev.push(...salle.duel.chanter(userId, {
              cardId: chant,
              taps: Array.from({ length: 8 }, (_, i) =>
                i * 560 + (Math.random() * 2 - 1) * 260 * (1 - m.bot.adresse)),
            }, t));
          }
        } catch { /* souffle insuffisant ou geste refusé : il attend */ }
      }

      // Grâce épuisée : le joueur est retiré de la salle, pas puni.
      for (const [userId, m] of salle.membres) {
        if (m.coupeA && t - m.coupeA > GRACE_MS) {
          m.parti = true;
          m.coupeA = null;
          ev.push({ seq: ++salle.duel.seq, t: 'left', userId });
        }
      }

      diffuser(salle, ev);
    } catch (e) {
      console.error(`[nvn ${salle.duel.id}]`, e.message);
    }
  }

  /**
   * Ce qu'un duel rapporte, en écharpes.
   *
   * Le classé paie le double de l'entraînement : c'est ce qui fait préférer un
   * vrai adversaire pendant un vrai match. Le perdant touche quand même — une
   * défaite qui ne rapporte rien pousse à quitter la salle avant la fin, et un
   * duel abandonné gâche la soirée des deux camps.
   *
   * Les montants sont volontairement modestes au regard d'un booster (45) :
   * les écharpes viennent surtout des doublons, le duel est un complément.
   */
  const GAIN = {
    classe: { gagne: 30, perdu: 12 },
    entrainement: { gagne: 15, perdu: 6 },
  };

  /**
   * Le double quand on pousse pour son club.
   *
   * On peut jouer pour n'importe quel match — c'est ce qui permet de trouver un
   * adversaire un mardi soir de trêve. Mais pousser pour son club doit rester ce
   * qui rapporte le plus, sinon le suivi d'équipe ne veut plus rien dire et le
   * joueur va simplement là où il y a du monde.
   *
   * Le multiplicateur se calcule **par joueur**, pas par duel : deux adversaires
   * peuvent très bien avoir chacun leur club sur le terrain, ou un seul, ou
   * aucun. C'est justement l'intérêt d'un derby.
   */
  const DOUBLE_CLUB = 2;

  /**
   * Qui, parmi ces joueurs, suit l'une des deux équipes du match.
   *
   * Une requête pour tout le monde, et non une par joueur : `fermer()` tourne à
   * la fin de chaque duel, et un aller-retour par participant sur un 5 contre 5
   * pour lire une table de deux lignes serait du gaspillage pur.
   */
  /**
   * Pour chaque joueur, le club qu'il suit et qui joue ce match — ou rien.
   *
   * Une Map et non un ensemble : il ne suffit plus de savoir *si* le joueur
   * est concerné, il faut savoir **par quel club**, puisque son KOP est celui
   * de ce club-là.
   *
   * Une requête pour tout le monde, et non une par joueur : `fermer()` tourne
   * à la fin de chaque duel, et un aller-retour par participant sur un 5
   * contre 5 pour lire une table de deux lignes serait du gaspillage pur.
   */
  async function concernes(userIds, fixture) {
    const equipes = [fixture?.home?.id, fixture?.away?.id].filter(Number.isFinite);
    if (!userIds.length || !equipes.length) return new Map();
    const trous = userIds.map(() => '?').join(',');
    const rows = await q(
      `SELECT user_id, team_id FROM user_follows
        WHERE user_id IN (${trous}) AND team_id IN (${equipes.map(() => '?').join(',')})`,
      [...userIds, ...equipes]);
    // Un joueur peut suivre les deux clubs d’un derby : le premier suffit,
    // c’est le même doublement et le même KOP par club de toute façon.
    const m = new Map();
    for (const r of rows) if (!m.has(r.user_id)) m.set(r.user_id, r.team_id);
    return m;
  }

  /**
   * Verse les gains de fin de duel — et **dit ce qu'elle a versé**.
   *
   * Elle ne disait rien. Le joueur voyait son solde d'écharpes changer entre
   * deux écrans sans savoir ni combien ni pourquoi, et la part reversée à son
   * KOP n'existait que dans un message socket séparé, envoyé au milieu d'une
   * fin de partie — c'est-à-dire au moment où personne ne regarde encore.
   *
   * Le retour est indexé par joueur : c'est l'écran de fin qui décide de
   * l'ordre et de ce qu'il en montre.
   */
  /**
   * Les cinq derniers duels classés d'une poignée de joueurs.
   *
   * Une seule requête pour tout le monde, et non une par joueur : à cinq contre
   * cinq, dix requêtes au coup d'envoi pour afficher dix pastilles seraient dix
   * requêtes de trop.
   *
   * Le **plus récent d'abord** — c'est le sens dans lequel on lit une forme, et
   * celui qui a perdu ses quatre premiers et gagné le dernier ne raconte pas la
   * même chose que l'inverse.
   *
   * Un joueur sans historique rend une liste vide, jamais `null` : l'écran
   * affiche « premier duel », ce qui est une information, là où une absence
   * l'obligerait à deviner.
   */
  async function forme(userIds) {
    const vrais = [...new Set(userIds)].filter((u) => u && !String(u).startsWith('bot:'));
    const out = new Map(vrais.map((u) => [u, []]));
    if (!vrais.length) return out;
    try {
      /* `ended_at` est indexé avec `user_id` : on prend large et on coupe à
         cinq par joueur en mémoire. Une fenêtre par joueur en SQL demanderait
         une jointure latérale pour économiser quelques dizaines de lignes. */
      const trous = vrais.map(() => '?').join(',');
      const lignes = await q(
        `SELECT user_id, outcome, goals_for, goals_against, ended_at
           FROM duel_results
          WHERE user_id IN (${trous})
          ORDER BY ended_at DESC
          LIMIT ?`, [...vrais, vrais.length * 5]);
      for (const l of lignes) {
        const liste = out.get(l.user_id);
        if (liste && liste.length < 5) {
          liste.push({ issue: l.outcome, pour: l.goals_for, contre: l.goals_against });
        }
      }
    } catch (e) {
      /* La forme est un ornement. Une table absente ou une base lente ne doit
         pas empêcher un duel de commencer : on rend des listes vides, et
         l'affiche dit simplement qu'elle ne sait pas. */
      console.error('[nvn] forme récente', e.message);
    }
    return out;
  }

  /**
   * L'affiche : qui joue, avec quels Fanzzy, dans quel état de forme.
   *
   * Elle ne contient **que** ce que l'état ne dit pas déjà. Le score, la corde
   * et la main partent dix fois par seconde dans `vue()` ; l'affiche part une
   * fois, au coup d'envoi, et ne revient jamais.
   */
  async function affiche(duel) {
    const joueurs = [...duel.joueurs.values()];
    const formes = await forme(joueurs.map((j) => j.userId));
    return {
      id: duel.id, mode: duel.mode,
      stade: duel.stade
        ? { id: duel.stade.id, nom: duel.stade.nom, effet: duel.stade.effet } : null,
      joueurs: joueurs.map((j) => ({
        userId: j.userId, nom: j.nom, side: j.side,
        bot: String(j.userId).startsWith('bot:'),
        /* Tous ses Fanzzy, pas seulement celui qui entre : l'affiche montre
           l'équipe, et c'est en la voyant qu'on comprend qu'on peut changer. */
        fanzzy: j.fanzzy.map((f) => ({
          id: f.id, nom: f.nom, stade: f.stade ?? 1, type: f.type,
          rar: f.rar, cri: f.cri?.label ?? null, geste: f.cri?.gest ?? null,
        })),
        forme: formes.get(j.userId) ?? [],
      })),
    };
  }

  async function recompenser(salle) {
    const d = salle.duel;
    const bareme = GAIN[d.mode] ?? GAIN.entrainement;
    const verse = new Map();
    try {
      // Un bot n'a pas de bourse, et lui en créer une inventerait un joueur.
      const humains = [...d.joueurs].filter(([userId]) => !userId.startsWith('bot:'));
      const clubs = await concernes(humains.map(([u]) => u), d.fixture);

      for (const [userId, j] of humains) {
        const gagne = d.vainqueur !== null && j.side === d.vainqueur;
        const base = gagne ? bareme.gagne : bareme.perdu;
        const pourSonClub = clubs.has(userId);
        const montant = base * (pourSonClub ? DOUBLE_CLUB : 1);
        await q(`INSERT IGNORE INTO user_wallet (user_id) VALUES (?)`, [userId]);
        await q(`UPDATE user_wallet SET scarves = scarves + ? WHERE user_id = ?`,
          [montant, userId]);
        verse.set(userId, { echarpes: montant, pourSonClub, xp: 0, kop: null });

        /* L'XP, elle, **ne double pas** pour son club.
           Les écharpes récompensent la ferveur, et il est juste qu'elles
           penchent du côté de son équipe. Le niveau mesure le temps passé à
           jouer : le doubler ferait d'un joueur qui suit trois gros clubs un
           joueur qui progresse deux fois plus vite, pour un choix fait à
           l'inscription. */
        if (niveau) {
          const gain = (XP.duel[d.mode] ?? XP.duel.entrainement)
            + (gagne ? XP.victoire : 0);
          await niveau.gagner(userId, gain);
          verse.get(userId).xp = gain;
        }

        /* La part du club, versée au pot du KOP.

           Elle **s’ajoute**, elle ne se prend pas au joueur : le même geste
           sert les deux, et il n’y a aucune raison de faire choisir entre soi
           et son groupe.

           Sans KOP, elle est perdue — et on le dit, sur le socket de ce
           joueur. C’est toute la raison d’en créer un, et une écharpe qui
           disparaît sans un mot ne donne envie de rien. */
        if (kop && pourSonClub) {
          const part = Math.round(base * kop.PART_POT);
          const r = await kop.verser(userId, clubs.get(userId), part);
          const m = salle.membres.get(userId);
          if (r.sansKop) {
            m?.socket?.emit('nvn:kop', { sansKop: true, teamId: clubs.get(userId),
              perdu: part });
            verse.get(userId).kop = { sansKop: true, perdu: part };
          } else if (r.verse) {
            m?.socket?.emit('nvn:kop', { verse: r.verse, kop: r.nom });
            verse.get(userId).kop = { verse: r.verse, nom: r.nom };
          }
        }
      }
    } catch (e) {
      // Un duel qui s'est bien joué ne doit pas se terminer en erreur parce
      // que la bourse n’a pas pu être créditée. On le dit et on continue.
      console.error('[nvn] écharpes de fin de duel', e.message);
    }
    return verse;
  }
  async function fermer(salle) {
    clearInterval(salle.timer);
    const d = salle.duel;
    salles.delete(d.id);
    for (const userId of salle.membres.keys()) salleDe.delete(userId);

    // Un duel rapporte toujours quelque chose, classé ou non.
    //
    // L'entraînement ne rapportait rien du tout : on pouvait y passer une
    // heure et repartir les mains vides, ce qui en faisait un didacticiel
    // plutôt qu'une façon de jouer. Il paie maintenant, moins qu'un duel
    // classé, et il reste hors du classement — c'est là qu'est la différence,
    // pas dans la récompense.
    const gains = await recompenser(salle);

    /* **L'écran de fin.**
     *
     * Rien n'annonçait la fin d'un duel : le client la déduisait du drapeau
     * `termine` dans un état parmi dix par seconde, et posait un voile gris
     * avec un mot dessus. Cinq minutes de jeu se terminaient sur moins qu'un
     * message d'erreur.
     *
     * Le bilan part **avant** l'écriture en base : un joueur n'a pas à attendre
     * une requête pour savoir s'il a gagné, et une base indisponible ne doit
     * pas lui voler sa fin de partie. */
    {
      const bilan = d.bilan();
      for (const [userId, m] of salle.membres) {
        if (!m.socket?.connected) continue;
        m.socket.emit('nvn:fin', { ...bilan, gains: gains.get(userId) ?? null });
      }
    }

    /* **Les nuls s'écrivent aussi.**
     *
     * Seuls les duels classés **avec un vainqueur** étaient enregistrés. La
     * table accepte pourtant `draw` depuis le premier jour : les matchs nuls
     * n'étaient donc nulle part, et « tes cinq derniers duels » aurait menti
     * par omission — en oubliant exactement les parties les plus serrées.
     *
     * L'entraînement reste dehors, et c'est une autre décision : il ne compte
     * pas, c'est là toute sa différence avec le duel classé. */
    if (d.mode !== 'classe') return;
    try {
      /* **Le duel rapporte de la ferveur**, la même que le Virage — le moteur
         la compte par joueur depuis le premier jour, elle n'était simplement
         écrite nulle part. Un duel ne pouvait donc compter dans aucun
         classement, et le mot « points » du jeu n'avait qu'une source.

         Le match support donne la compétition : elle n'est pas recopiée ici,
         `fixtures` la porte déjà. Le club, lui, est celui qu'on suit parmi les
         deux — et à défaut on est neutre, la ferveur vaut moitié et ne
         rapporte à aucune tribune. C'est la règle du Virage, appliquée telle
         quelle : venir jouer sur le match des autres se fait, mais on ne se
         bâtit une réputation que chez soi. */
      const f = d.fixture ?? null;
      const neutreCoef = reglage('ferveur.neutre');

      for (const [userId, j] of d.joueurs) {
        if (userId.startsWith('bot:')) continue;
        const adverse = [...d.joueurs.values()].find((x) => x.side !== j.side);
        const issue = d.vainqueur === null || d.vainqueur === undefined ? 'draw'
          : (j.side === d.vainqueur ? 'win' : 'loss');

        /* Le camp, le club et le renfort ont été décidés à l'entrée en file :
           on les relit sur la salle plutôt que d'interroger la base une
           seconde fois pour une réponse qui pourrait avoir changé entre-temps. */
        const m = salle.membres.get(userId);
        const ferveur = Math.max(0, Math.round((j.ferveur ?? 0)
          * (m?.neutre === false ? 1 : neutreCoef) * (m?.bonus ?? 1)));

        await q(
          `INSERT IGNORE INTO duel_results
             (duel_id, user_id, opponent_id, outcome, goals_for, goals_against,
              fixture_id, team_id, ferveur, ended_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
          [d.id, userId, adverse?.userId ?? 'inconnu', issue,
           d.goals[j.side], d.goals[j.side ^ 1],
           f?.id ?? null, m?.teamId ?? null, ferveur]);
      }
    } catch (e) {
      console.error('[nvn] enregistrement du résultat', e.message);
    }
  }

  /* ------------------------------------------------------------ socket */

  const MAX_ACTIONS_10S = 30;

  function limite(socket) {
    const t = Date.now();
    const b = (cadence.get(socket) ?? []).filter((x) => t - x < 10_000);
    if (b.length >= MAX_ACTIONS_10S) return false;
    b.push(t); cadence.set(socket, b);
    return true;
  }

  io.on('connection', (socket) => {
    const moi = () => socket.data?.user ?? null;
    const maSalle = () => {
      const u = moi();
      const id = u ? salleDe.get(u.userId) : null;
      return id ? salles.get(id) : null;
    };

    const erreur = (e) => socket.emit('nvn:error',
      { code: e instanceof Cheat ? e.code : 'nvn.error.server' });

    socket.on('nvn:queue', async (p = {}) => {
      try { await entrerEnFile(socket, p); }
      catch (e) {
        if (!(e instanceof Cheat)) console.error('[nvn] file', e.message);
        socket.emit('nvn:error', { code: e.code ?? 'nvn.error.server' });
      }
    });

    socket.on('nvn:leave_queue', () => {
      const u = moi();
      if (u) quitterFile(u.userId);
    });

    for (const [evt, fn] of [
      ['nvn:chant', (salle, u, p) => salle.duel.chanter(u.userId, p)],
      ['nvn:play', (salle, u, p) => salle.duel.jouer(u.userId, String(p?.cardId))],
      ['nvn:swap', (salle, u, p) => salle.duel.changer(u.userId, Number(p?.index))],
    ]) {
      socket.on(evt, (p = {}) => {
        const u = moi();
        const salle = maSalle();
        if (!u || !salle) return socket.emit('nvn:error', { code: 'nvn.error.not_in_duel' });
        if (!limite(socket)) return socket.emit('nvn:error', { code: 'nvn.error.rate_limited' });
        try { diffuser(salle, fn(salle, u, p)); }
        catch (e) { erreur(e); }
      });
    }

    /** Reprise après coupure : la place attendait. */
    socket.on('nvn:resume', () => {
      const u = moi();
      const salle = maSalle();
      if (!u || !salle) return socket.emit('nvn:error', { code: 'nvn.error.not_in_duel' });
      const m = salle.membres.get(u.userId);
      if (!m || m.parti) return socket.emit('nvn:error', { code: 'nvn.error.slot_lost' });
      m.socket = socket;
      m.coupeA = null;
      socket.join(salle.room);
      socket.emit('nvn:start', salle.duel.vue(u.userId));
      io.to(salle.room).emit('nvn:events',
        [{ seq: ++salle.duel.seq, t: 'back', userId: u.userId }]);
    });

    socket.on('disconnect', () => {
      const u = moi();
      if (!u) return;
      quitterFile(u.userId);
      const salle = maSalle();
      const m = salle?.membres.get(u.userId);
      if (!m) return;
      m.socket = null;
      m.coupeA = Date.now();
      io.to(salle.room).emit('nvn:events', [{
        seq: ++salle.duel.seq, t: 'disconnected', userId: u.userId,
        graceMs: GRACE_MS,
      }]);
    });
  });

  /* ---------------------------------------------- bascule vers les bots */

  const veille = setInterval(() => {
    const t = Date.now();
    for (const [c, file] of [...files]) {
      // Un joueur seul un mardi soir doit pouvoir jouer : au bout du délai,
      // les places manquantes sont tenues par des bots, en entraînement. Le
      // délai est plus long pour un duel classé — voir `attenteAvantBots`.
      const attente = attenteAvantBots(file[0]?.support?.mode);
      if (file.some((f) => t - f.depuis > attente)) ouvrirAvecBots(c);
    }
  }, 2000);
  veille.unref?.();

  /* ------------------------------------------------------------ routes */

  const router = express.Router();

  router.get('/etat', requireAuth, (req, res) => {
    res.json({
      formats: Object.keys(FORMATS),
      files: [...files].map(([c, f]) => ({ cle: c, presents: f.length })),
      salles: salles.size,
      duelEnCours: salleDe.get(req.user.id) ?? null,
    });
  });

  return { router, salles, files, ouvrir, ouvrirAvecBots, tenterAppariement, butReel,
           stop: () => { clearInterval(veille); for (const s of salles.values()) clearInterval(s.timer); } };
}
