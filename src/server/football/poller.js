import { QuotaExhausted } from './client.js';

/* ------------------------------------------------------- normalisation */

const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const DONE = new Set(['FT', 'AET', 'PEN']);

export const isLive = (s) => LIVE.has(s);
export const isDone = (s) => DONE.has(s);

/**
 * Intervalle minimal entre deux relevés d'événements d'un même match.
 *
 * Le direct tourne toutes les vingt secondes ; y accrocher un appel
 * d'événements ferait trois appels par minute et par match suivi, soit près de
 * quatre cents pour un match de deux heures. À la minute, c'est cent vingt —
 * et seulement pour les matchs dont une salle de virage est occupée.
 */
export const EVENTS_MIN_MS = 60_000;

/**
 * Écart maximal, en minutes de jeu et dans la même période, entre la ligne en
 * base et ce que l'API répond, pour que la ligne vaille encore comme point de
 * départ du match : voir `poserSocle`. Cinq minutes couvrent un redémarrage du
 * serveur et deux tours du direct.
 *
 * Ce n'est pas l'âge d'un but. Juger un but frais à moins de cinq minutes de
 * jeu de l'horloge de l'API ne tient pas : cette horloge s'arrête pendant les
 * pauses, et à la mi-temps un but de la 41e passerait pour frais un quart
 * d'heure plus tard, carte de présence comprise pour qui ouvrirait la salle à
 * ce moment-là.
 */
export const LIGNE_FRAICHE_MIN = 5;

/** Les buts au tableau, d'une ligne de l'API ou de la base. */
const auTableau = (home, away) => (home ?? 0) + (away ?? 0);

/** Convertit une date ISO renvoyée par l'API en DATETIME MySQL, en UTC. */
const toSqlDate = (iso) => new Date(iso).toISOString().slice(0, 19).replace('T', ' ');

export function mapFixture(r) {
  return {
    id: r.fixture.id,
    leagueId: r.league.id,
    season: r.league.season,
    round: r.league.round ?? null,
    homeId: r.teams.home.id,
    awayId: r.teams.away.id,
    homeGoals: r.goals?.home ?? null,
    awayGoals: r.goals?.away ?? null,
    status: r.fixture.status?.short ?? 'NS',
    elapsed: r.fixture.status?.elapsed ?? null,
    /* `extra` : le temps additionnel, servi à part par l'API. 90+3 n'est pas
       93, et la différence compte pour qui regarde le match — c'est aussi la
       seule façon de savoir qu'on a dépassé le terme réglementaire, donc de
       cesser d'annoncer « 90' » une fois le coup de sifflet donné. */
    elapsedExtra: r.fixture.status?.extra ?? null,
    venue: r.fixture.venue?.name ?? null,
    kickoffAt: toSqlDate(r.fixture.date),
    teams: r.teams,
    league: r.league,
  };
}

export function mapEvent(e) {
  return {
    type: e.type,
    detail: e.detail ?? null,
    teamId: e.team?.id,
    player: e.player?.name ?? null,
    assist: e.assist?.name ?? null,
    minute: e.time?.elapsed ?? null,
    extra: e.time?.extra ?? null,
    /* La séance de tirs au but arrive en `Goal`, minute 120 : seul ce
       commentaire la distingue d'un penalty du match. */
    comments: e.comments ?? null,
  };
}

/**
 * Un but qui compte au tableau d'affichage.
 *
 * L'API range sous `Goal` le penalty manqué et chaque tir de la séance de
 * tirs au but, marqué ou non. Aucun ne change le score ; les compter frappait
 * une carte-souvenir pour un ballon à côté, secouait la corde du côté qui
 * venait de rater, ouvrait la minute double, et décalait d'un cran le rang et
 * le score de tous les buts suivants du match — gravés sur leurs cartes.
 */
export const estUnBut = (e) => e.type === 'Goal'
  && e.detail !== 'Missed Penalty' && !/penalty shootout/i.test(e.comments ?? '');

/* ---------------------------------------------------------------- worker */

/**
 * Interroge API-Football et tient la base à jour.
 *
 * Principe d'économie : on n'interroge que les équipes réellement suivies par
 * au moins un joueur. Une équipe que personne ne suit ne coûte rien. Le direct
 * regroupe jusqu'à 20 matchs par appel, ce qui rend un samedi après-midi
 * abordable même avec beaucoup d'utilisateurs.
 */
export function createPoller({ client, store, broadcast, onGoal, onFinished,
                               onEvents, onStatus, onAbsent,
                               fixturesAuFil = () => [], log = console }) {
  // Matchs dont la fin a déjà été signalée. Sans ce garde, chaque tour
  // d'horloge réinvaliderait le cache d'une compétition déjà à jour.
  const finis = new Set();
  // Dernier relevé d'événements par match, pour ne pas en demander deux dans
  // la même minute.
  const releves = new Map();
  /* **Ce que ce processus a vu de chaque match, et depuis quand.**

     `socles` : combien de buts étaient déjà au tableau quand le relevé a
     regardé le match pour la première fois. `histoires` : si la base gardait
     déjà des événements de ce match à son premier relevé d'événements. Les
     deux servent à `pullEvents` : un but qui était au tableau avant qu'on
     regarde n'est pas une nouvelle. `fraiches` : si la ligne en base valait
     encore point de départ à ce premier regard — c'est elle qui dit si
     l'histoire rangée en base est complète. Bornés, comme `releves`, par le
     nombre de matchs vus depuis le démarrage. */
  const socles = new Map();         // fixtureId -> buts au tableau au premier regard
  const histoires = new Map();      // fixtureId -> la base en avait-elle déjà ?
  const fraiches = new Map();       // fixtureId -> la ligne du premier regard était-elle fraîche ?
  /* **Et quand il a cessé de le regarder.** Un match qu'aucun club suivi ne
     joue n'est demandé au direct que tant que sa salle est occupée. Le socle
     posé au premier regard restait pourtant celui de toute la vie du
     processus : entrer à la 10e, ressortir, revenir à la 44e, et les deux buts
     marqués salle vide partaient comme frais — corde, minute double, et la
     carte de présence à qui venait de rentrer.

     **Le trou se compte en tours, et non en minutes.** Une tolérance de cinq
     minutes laissait le même geste payer à qui sortait : sorti à la 10e,
     revenu chanter à la 14e, on avait la carte du but de la 12e marqué salle
     vide, quand celui resté assis, qui chantait au même instant, ne l'avait
     pas — le but était parti à la 12e, sans lui. Un script qui passait un tour
     en tribune toutes les quatre minutes vingt avait ainsi la carte de tous
     les buts du match. Aucune fenêtre de temps ne ferme ça : la carte se gagne
     par une poussée dans les deux minutes qui précèdent l'annonce, et toute
     fenêtre de cet ordre se rejoue.

     `dejaDemandes` garde les matchs qu'un tour a déjà demandés, `tourPrecedent`
     ceux du dernier tour ; un match demandé de nouveau sans l'avoir été au tour
     d'avant revient d'un trou, va dans `oublies`, et `poserSocle` le reprend
     comme au premier regard, sur ce qu'on voit maintenant. C'est la
     **demande** qui compte, et non la réponse : un relevé qui demande sans
     obtenir — l'API en panne, le quota épuisé — n'a pas cessé de regarder, et
     les buts de la panne partent encore à son retour, comme avant.

     Ce que ça coûte, et c'est assumé : le seul occupant d'une salle qui
     recharge sa page pile à l'instant où un tour dresse sa liste — la salle
     n'est vide que la seconde ou deux du rechargement — fait manquer ce tour
     à son match. Un but marqué entre le tour d'avant et le suivant est alors
     rangé sans être annoncé : le score le porte, la carte ne sera pas
     frappée. Si cette salle était seule au relevé, le tour suivant tombe deux
     minutes plus tard — la boucle ralentit quand rien n'est en jeu —, et
     c'est aussi pourquoi on ne tolère pas un tour manqué : salle vide, un
     seul tour couvre toute la fenêtre de présence. */
  const dejaDemandes = new Set();   // fixtureIds qu'un tour a déjà demandés
  let tourPrecedent = new Set();    // fixtureIds demandés au tour d'avant
  const oublies = new Set();        // fixtureIds revenus au direct après un trou
  let timers = [];
  let running = false;

  /* ---------------------------------------------------- rafraîchissements */

  /** Appelé quand un joueur suit un club, puis une fois par jour. */
  async function refreshTeam(teamId) {
    const [teamRow] = await client.teamById(teamId);
    if (!teamRow) return null;
    await store.upsertTeam({ ...teamRow.team, country: teamRow.team.country });

    // Compétitions en cours de l'équipe.
    const leagues = await client.leaguesOfTeam(teamId);
    const current = [];
    for (const l of leagues) {
      const season = (l.seasons ?? []).find((s) => s.current)?.year
        ?? (l.seasons ?? []).at(-1)?.year;
      if (!season) continue;
      await store.upsertLeague({ ...l.league, country: l.country?.name, season });
      await store.linkTeamLeague(teamId, l.league.id, season);
      current.push({ leagueId: l.league.id, season });
    }

    // Calendrier : 45 jours en arrière, 45 en avant. Un seul appel par saison.
    const seasons = [...new Set(current.map((c) => c.season))];
    const from = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10);

    for (const season of seasons) {
      const rows = await client.fixturesOfTeam(teamId, season, from, to);
      for (const r of rows) {
        const f = mapFixture(r);
        await store.upsertTeam(f.teams.home);
        await store.upsertTeam(f.teams.away);
        await store.upsertLeague({ ...f.league, season: f.season });
        await store.upsertFixture(f);
      }
    }
    return teamRow.team;
  }

  /* ------------------------------------------------------------- direct */

  /**
   * Un tour de direct. Renvoie le nombre de matchs suivis en cours, ce qui
   * permet à la boucle d'accélérer ou de se mettre en veille.
   */
  async function pollLive() {
    /* Les matchs dont une salle de virage est occupée.
     *
     * Ils servent deux fois. D'abord ici : **ils entrent dans le relevé même
     * si personne ne suit leurs clubs.** Depuis que le virage s'ouvre à tous
     * les matchs en direct, on peut pousser sur une rencontre qu'aucun joueur
     * ne suit — et le relevé, lui, ne regardait que les clubs suivis. Ces
     * matchs-là n'étaient donc jamais rafraîchis : ils restaient figés sur
     * « 90' EN DIRECT » longtemps après le coup de sifflet, score compris.
     *
     * Ensuite plus bas, pour décider s'ils méritent un relevé d'événements.
     */
    let auFil = new Set();
    try { auFil = new Set(fixturesAuFil() ?? []); }
    catch (e) { log.error('[foot] salles au fil', e.message); }

    const ids = [...new Set([
      ...(await store.liveFixtureIds()),
      ...(await store.dueToStartIds()),
      ...auFil,
    ])];

    /* Avant l'appel, et pour tous : voir `oublies`. Un lot qui échoue a quand
       même été demandé. Et **avant de rendre la main sur un tour vide** : la
       salle qui s'est vidée fait un tour sans rien demander, et c'est ce tour-là
       qui doit compter comme manqué. */
    for (const id of ids) {
      if (dejaDemandes.has(id) && !tourPrecedent.has(id)) oublies.add(id);
      dejaDemandes.add(id);
    }
    tourPrecedent = new Set(ids);
    if (!ids.length) return 0;

    let live = 0;
    for (let i = 0; i < ids.length; i += 20) {
      const batch = ids.slice(i, i + 20);
      const rows = await client.fixturesByIds(batch);

      /* **Un lot qui a répondu sans un match demandé** : l'API ne le rend
         plus — supprimé, renuméroté —, ou ne l'a jamais rendu. On le dit à
         qui le demandait, pour qu'il cesse de le redemander à chaque tour :
         une salle ouverte par un lien sur un tel match payait sinon le direct
         jour et nuit. Seul un lot **réussi** le dit : un lot qui échoue — API
         en panne, quota épuisé — lève avant d'arriver ici, et une panne ne
         doit pas passer pour une disparition. Avant les lignes rendues : une
         écriture en base qui lève plus bas ne doit pas le taire. */
      const rendus = new Set(rows.map((r) => Number(r.fixture?.id)));
      for (const id of batch) {
        if (rendus.has(Number(id))) continue;
        try { onAbsent?.(Number(id)); } catch (e) { log.error('[foot] onAbsent', e.message); }
      }

      for (const r of rows) {
        const f = mapFixture(r);
        const before = await store.upsertFixture(f);
        poserSocle(f, before);
        if (isLive(f.status)) live++;

        const scoreChanged = before
          && (before.home_goals !== f.homeGoals || before.away_goals !== f.awayGoals);
        const statusChanged = !before || before.status_short !== f.status;

        if (scoreChanged || statusChanged) {
          broadcast?.('football:fixture', publicFixture(f));
        }

        /* Le score, la minute et la période partent à chaque tour, sans un
           appel de plus : ils sont déjà dans la réponse qu'on vient de lire.
           C'est ce qui permet au fil du Grand Virage d'annoncer la mi-temps
           et le coup de sifflet final même les jours où le quota est serré. */
        /* L'heure du coup d'envoi part avec, telle que l'API la donne : un
           match avancé, reculé ou reprogrammé sous le même numéro gardait
           dans sa salle l'heure lue en base à l'ouverture, et la salle
           décidait de son relevé sur une heure fausse. */
        try {
          onStatus?.(f.id, { status: f.status, elapsed: f.elapsed,
            elapsedExtra: f.elapsedExtra,
            homeGoals: f.homeGoals, awayGoals: f.awayGoals,
            kickoffAt: r.fixture?.date ?? null });
        } catch (e) { log.error('[foot] onStatus', e.message); }

        /* Match terminé : les classements de sa compétition sont désormais
           faux, et c'est exactement le moment où on va les regarder.

           L'annonce vivait dans `pullEvents`, qui ne s'exécutait que sur un
           changement de score : un match sans but ne l'a jamais déclenchée, et
           un match à but l'a déclenchée au dernier but plutôt qu'au coup de
           sifflet. Ici elle est adossée au statut, qu'on lit de toute façon —
           et elle ne coûte toujours rien. */
        if (isDone(f.status) && !finis.has(f.id)) {
          finis.add(f.id);
          try { await onFinished?.(f); }
          catch (e) { log.error('[poller] fin de match', e.message); }
        }

        /* Les événements, eux, coûtent un appel par match. Deux raisons
           seulement de les demander :

             — le score a bougé : il faut le buteur pour la carte-souvenir ;
             — quelqu'un est dans le virage de ce match et attend son fil.

           Le second cas est borné à un relevé par minute. Un match que
           personne ne regarde ne coûte donc pas un appel de plus qu'avant le
           fil, et le fil ne peut pas coûter plus d'un appel par minute et par
           salle occupée.

           **Et seulement pour un match en jeu.** Une salle restée ouverte
           après le coup de sifflet relevait ses événements chaque minute, jour
           et nuit, et une salle sur un match suspendu, reporté ou « à venir »
           dont l'heure est passée en faisait autant : aucun événement n'arrive
           pour ces matchs-là. `sallesOccupees` écarte ou ralentit ces salles,
           et cette garde est la ceinture.

           **Sauf au tour qui voit le match sortir du jeu** — coup de sifflet,
           suspension, arrêt : celui-là relève une dernière fois, et sans
           attendre la minute. Les cartons du temps additionnel ont droit au
           fil, et la porte d'une minute, à la cadence de vingt secondes du
           direct, ne s'ouvre qu'un tour sur trois : au tour suivant, la salle
           finie n'est déjà plus au relevé, et le carton serait perdu pour
           toujours. Cela coûte au plus un appel par fin de match. */
        const enJeu = isLive(f.status);
        const sortDuJeu = !enJeu && statusChanged;
        const attendu = auFil.has(f.id) && (sortDuJeu
          || (enJeu && Date.now() - (releves.get(f.id) ?? 0) >= EVENTS_MIN_MS));
        if (scoreChanged || attendu) await pullEvents(f);
      }
    }
    return live;
  }

  /**
   * Identité d'un événement.
   *
   * On ne peut pas se fier à sa position dans la liste : l'API en insère
   * parfois un plus tôt — correction VAR, carton ajouté après coup — et tout
   * ce qui suit se décale. Un but pouvait alors être considéré comme déjà vu
   * et n'être jamais annoncé. C'est ce qui explique un 3-1 avec seulement
   * trois cartes-souvenirs.
   */
  const identite = (e) => {
    // Les lignes lues en base nomment la colonne `team_id`, les événements de
    // l'API `teamId`. Sans cette normalisation, aucune identité ne correspond
    // et chaque relevé réannonce tous les buts du match.
    const equipe = e.teamId ?? e.team_id;
    return `${e.type}|${equipe}|${e.minute ?? '?'}|${e.extra ?? 0}|` +
           `${e.player ?? ''}|${e.detail ?? ''}`;
  };

  /**
   * Le socle d'un match : combien de buts étaient déjà au tableau quand ce
   * processus l'a regardé pour la première fois.
   *
   * La ligne en base sert de point de départ quand elle est fraîche — même
   * période de jeu, à `LIGNE_FRAICHE_MIN` près : c'est celle que ce relevé
   * écrivait juste avant un redémarrage, ou que l'ancrage vient de poser
   * depuis la journée, et un but au-delà d'elle vient de tomber. Sinon — une
   * ligne « à venir » posée par le télétexte, une ligne d'il y a trois heures,
   * une période qui a changé entre-temps —, rien ne date ce qui a été marqué
   * depuis, et seul compte ce qu'on voit maintenant.
   *
   * Un but refusé par la vidéo fait redescendre le score : le socle descend
   * avec lui, sinon le but suivant prendrait le rang de celui qu'on a retiré
   * et ne serait jamais annoncé.
   *
   * **Un match revenu après un trou repart d'ici**, comme au premier regard
   * et sans ligne fraîche : la ligne en base est celle du dernier tour qui
   * l'a demandé, aussi vieille que le trou — ou celle que le télétexte a
   * rangée entre-temps, fraîche en apparence et en retard d'un but. Ni l'une
   * ni l'autre ne date ce qui a été marqué pendant que personne ne regardait :
   * c'est rangé sans être annoncé.
   *
   * Ce que ça coûte, et c'est assumé : un match relevé au coup d'œil — une
   * reprise après une suspension, un statut que l'API laisse figé — perd
   * l'annonce des buts marqués entre deux coups d'œil : le score les porte,
   * la carte ne sera pas frappée. Et qui était seul en tribune et en est
   * sorti, ne serait-ce qu'un tour, ne voit pas tomber à son retour les buts
   * de son absence : c'est exactement ce qu'on voulait.
   */
  function poserSocle(f, before) {
    const maintenant = auTableau(f.homeGoals, f.awayGoals);
    const deja = socles.get(f.id);
    const revenu = oublies.delete(f.id);
    if (deja !== undefined && !revenu) {
      if (maintenant < deja) socles.set(f.id, maintenant);
      return;
    }
    const fraiche = !revenu && Boolean(before) && isLive(f.status)
      && before.status_short === f.status
      && Number.isFinite(before.elapsed) && Number.isFinite(f.elapsed)
      && f.elapsed >= before.elapsed && f.elapsed - before.elapsed <= LIGNE_FRAICHE_MIN;
    fraiches.set(f.id, fraiche);
    socles.set(f.id, fraiche
      ? Math.min(maintenant, auTableau(before.home_goals, before.away_goals))
      : maintenant);
  }

  async function pullEvents(f) {
    const known = await store.eventsOf(f.id);
    /* Lu avant l'appel, et retenu même s'il échoue : c'est un fait de la
       base, pas de l'API. */
    if (!histoires.has(f.id)) histoires.set(f.id, known.length > 0);
    const rows = await client.eventsOfFixture(f.id);
    const events = rows.map(mapEvent);
    releves.set(f.id, Date.now());

    const dejaVus = new Set(known.map(identite));
    /* **Ce qui était au tableau avant qu'on regarde n'est pas une nouvelle.**

       Un match qu'aucun club suivi ne joue n'a rien dans `fixture_events`
       quand le premier supporter entre dans sa salle — elle est ancrée depuis
       la journée, ou posée par le télétexte. Son premier relevé trouvait donc
       tous les buts déjà marqués « jamais vus », et les annonçait comme
       frais : corde secouée, minute double, score du duel doublé, carte de
       présence pour qui n'y était pas. Les `socle` premiers buts, dans l'ordre
       du match, sont donc rangés sans être annoncés ; le score les porte déjà.

       **La fraîcheur se lit en temps réel**, sur ce que ce processus a vu, et
       non en minutes de jeu : l'horloge de l'API s'arrête aux pauses, et un
       but marqué un quart d'heure plus tôt passerait pour frais à la
       mi-temps.

       **Et pas sur une base vide.** Une base vide ne dit pas « premier
       relevé » : le relevé d'un club suivi peut revenir sans le but que le
       score vient d'annoncer — l'API publie le score avant l'événement —, ou
       échouer, et la base reste vide jusqu'au but suivant. Le premier but
       sauterait alors, carte comprise. Le socle d'un club suivi, lui, est
       posé avant le coup d'envoi : zéro, et tous ses buts partent.

       Quand la base avait déjà une histoire de ce match, **et que la ligne
       du premier regard était fraîche**, c'est elle qui fait foi, par
       `dejaVus` : un redémarrage annonce encore les buts marqués pendant la
       coupure, qui n'avaient jamais été annoncés. Sans ligne fraîche, une
       histoire en base ne prouve rien : un carton rangé à la 10e par
       quelqu'un qui est aussitôt ressorti, puis un déploiement, et les buts
       de la 30e et de la 41e partaient pour le premier entrant de la 44e.

       Ce que ça coûte : un redémarrage qui dure plus de `LIGNE_FRAICHE_MIN`
       minutes de jeu, ou qui enjambe un changement de période, n'annonce pas
       les buts de la coupure, même avec des événements rangés. Une fraîcheur
       lue en temps réel sur `polled_at` les distinguerait ; elle demanderait
       au store de la calculer en SQL — voir la note sur les fuseaux dans
       `ferveur/index.js`. Un trou, lui, efface tout : voir `poserSocle`. */
    const socle = histoires.get(f.id) && fraiches.get(f.id) ? 0 : (socles.get(f.id) ?? 0);
    /* Et jamais plus de buts annoncés que le score n'en a pris depuis : une
       liste de l'API qui porte un but de plus que le tableau — un but refusé
       que la vidéo n'a pas encore retiré — ferait sinon passer le dernier des
       anciens pour frais. Seulement au-dessus d'un socle : le chemin d'un
       club suivi depuis le coup d'envoi reste celui d'avant. */
    const neufs = auTableau(f.homeGoals, f.awayGoals) - socle;

    const buts = events.filter(estUnBut);

    // Le rang d'un but est sa place parmi tous les buts du match, dans
    // l'ordre chronologique. Il ne dépend plus de ce qui l'entoure, donc il
    // reste le même d'un relevé à l'autre : la frappe est rejouable.
    const ordonnes = buts.slice().sort((a, b) =>
      (a.minute ?? 0) - (b.minute ?? 0) || (a.extra ?? 0) - (b.extra ?? 0));

    /* **Un but que le plafond retient n'est pas rangé non plus.**

       Dans un même tour, le score vient du lot du direct, et les événements
       d'un appel parti après lui, match par match : un but marqué entre les
       deux est dans la liste et pas encore au tableau. Le plafond le retient,
       c'est son rôle. Mais il était rangé quand même, et au tour suivant,
       quand le tableau l'avait rattrapé, la base le donnait pour déjà vu : il
       n'était jamais annoncé — ni corde, ni minute double, ni carte. Il reste
       donc hors de la base, et hors du fil, tant que le tableau ne le couvre
       pas, et repasse au plafond à chaque relevé. Un but refusé que la liste
       garde n'est jamais couvert : il reste dehors, et jamais annoncé. */
    const enAvance = new Set(ordonnes.filter((g, i) => socle > 0 && i >= socle
      && i < ordonnes.length - neufs && !dejaVus.has(identite(g))));
    const ranges = enAvance.size ? events.filter((e) => !enAvance.has(e)) : events;
    await store.insertEvents(f.id, ranges);

    /* Tout ce qui n'avait pas encore été vu part au fil du Grand Virage :
       cartons, remplacements, arbitrage vidéo. Les buts sont du lot, mais la
       salle les écarte — ils ont déjà leur chemin, celui qui secoue la corde
       et ouvre la minute double, et le fil ne doit pas les raconter deux
       fois. */
    const nouveaux = ranges.filter((e) => !dejaVus.has(identite(e)));
    if (nouveaux.length) {
      try { onEvents?.(f.id, nouveaux); }
      catch (e) { log.error('[foot] onEvents', e.message); }
    }

    for (const [i, g] of ordonnes.entries()) {
      if (dejaVus.has(identite(g))) continue;
      /* Par le rang, et non par la minute : un vieux but que l'API publie en
         retard, après le premier relevé, reste un vieux but. Et le rang
         reste celui de tous les buts : un but frais garde la clé de frappe
         qu'un relevé suivi depuis le coup d'envoi lui aurait donnée. */
      if (i < socle || enAvance.has(g)) continue;

      // Score à cet instant précis, reconstitué en comptant les buts
      // précédents. L'ancien code prenait le score courant, ce qui datait
      // faussement toutes les cartes frappées dans le même relevé.
      const avant = ordonnes.slice(0, i + 1);
      const marques = (equipe) => avant.filter((x) => x.teamId === equipe).length;

      const payload = {
        fixtureId: f.id,
        seq: i + 1,
        leagueId: f.leagueId,
        kickoffAt: f.kickoffAt,
        teamId: g.teamId,
        minute: g.minute,
        player: g.player,
        score: [marques(f.teams.home?.id), marques(f.teams.away?.id)],
        home: f.teams.home,
        away: f.teams.away,
      };
      broadcast?.('football:goal', payload);
      try {
        await onGoal?.(payload);
      } catch (e) {
        log.error('[foot] onGoal', e.message);
      }
    }
  }

  /* -------------------------------------------------------- classements */

  /**
   * Les classements des competitions que quelqu'un suit.
   *
   * ## Deux defauts, et le second coutait plus cher que le premier
   *
   * **Une ligne sans equipe.** `s.team.id` arrivait parfois vide — une
   * competition dont la phase n'a pas encore de classement, un en-tete de
   * groupe rendu comme une ligne. La colonne `team_id` refuse le nul, et
   * l'insertion levait : « Column 'team_id' cannot be null ».
   *
   * **Et la boucle s'arretait la.** L'erreur remontait jusqu'a `safely`, donc
   * toutes les competitions qui venaient apres dans la liste n'etaient pas
   * rafraichies — pendant six heures, jusqu'au tour suivant, qui echouait au
   * meme endroit. Une seule ligne malformee privait tout le monde de son
   * classement, et le journal ne nommait qu'elle.
   *
   * On ecarte donc la ligne muette, et on isole chaque competition : celle qui
   * echoue le dit, les autres passent.
   */
  async function refreshStandings() {
    const stale = await store.staleLeagues(6);
    let ecartees = 0;
    for (const { league_id: leagueId, season } of stale) {
      try {
        const rows = await client.standings(leagueId, season);
        const groups = rows[0]?.league?.standings ?? [];
        for (const group of groups) {
          /* Sans identifiant d'equipe, la ligne ne designe personne : on ne
             peut ni l'ecrire ni la lire, et l'inventer serait pire. */
          const utiles = (group ?? []).filter((s) => Number.isFinite(Number(s?.team?.id)));
          ecartees += (group ?? []).length - utiles.length;
          if (!utiles.length) continue;
          await store.upsertStandings(leagueId, season, utiles.map((s) => ({
            teamId: s.team.id,
            rank: s.rank,
            points: s.points,
            played: s.all?.played ?? 0,
            win: s.all?.win ?? 0,
            draw: s.all?.draw ?? 0,
            lose: s.all?.lose ?? 0,
            goalsFor: s.all?.goals?.for ?? 0,
            goalsAgainst: s.all?.goals?.against ?? 0,
            form: s.form ?? null,
            group: s.group ?? null,
          })));
          for (const s of utiles) await store.upsertTeam(s.team);
        }
      } catch (e) {
        /* Nommer la competition : « cannot be null » sans son numero envoyait
           chercher dans deux cents classements. */
        console.warn(`[foot] classement ${leagueId}/${season} :`, e.message);
      }
    }
    if (ecartees) {
      console.warn(`[foot] ${ecartees} ligne(s) de classement sans equipe, ecartee(s)`);
    }
    return stale.length;
  }

  async function refreshAllTeams() {
    const ids = await store.followedTeamIds();
    for (const id of ids) {
      try {
        await refreshTeam(id);
      } catch (e) {
        if (e instanceof QuotaExhausted) throw e;
        log.error(`[foot] équipe ${id}`, e.message);
      }
    }
    return ids.length;
  }

  /* ----------------------------------------------------------- boucles */

  async function safely(name, fn) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof QuotaExhausted) log.warn(`[foot] ${name} reporté : ${e.message}`);
      else log.error(`[foot] ${name}`, e.message);
      return null;
    }
  }

  function start() {
    if (running) return;
    running = true;

    // Direct : 20 s tant qu'un match suivi est en cours, sinon un simple
    // coup d'œil à la base toutes les 2 minutes, qui ne coûte aucun appel.
    let liveDelay = 120_000;
    const liveLoop = async () => {
      if (!running) return;
      const live = await safely('direct', pollLive);
      liveDelay = live > 0 ? 20_000 : 120_000;
      timers.push(setTimeout(liveLoop, liveDelay));
    };
    timers.push(setTimeout(liveLoop, 3_000));

    timers.push(setInterval(() => safely('classements', refreshStandings), 6 * 3600_000));
    timers.push(setInterval(() => safely('calendriers', refreshAllTeams), 24 * 3600_000));
    timers.push(setInterval(() => client.resetDay(), 24 * 3600_000));

    // Premier remplissage peu après le démarrage.
    timers.push(setTimeout(() => safely('classements', refreshStandings), 30_000));
    return this;
  }

  function stop() {
    running = false;
    for (const t of timers) { clearTimeout(t); clearInterval(t); }
    timers = [];
  }

  return { start, stop, refreshTeam, refreshAllTeams, pollLive, refreshStandings };
}

/** Forme envoyée aux clients : pas de données brutes de l'API. */
export function publicFixture(f) {
  return {
    id: f.id,
    league: { id: f.league?.id, name: f.league?.name, logo: f.league?.logo, round: f.round },
    home: { id: f.homeId, name: f.teams?.home?.name, logo: f.teams?.home?.logo, goals: f.homeGoals },
    away: { id: f.awayId, name: f.teams?.away?.name, logo: f.teams?.away?.logo, goals: f.awayGoals },
    status: f.status,
    elapsed: f.elapsed,
    kickoffAt: f.kickoffAt,
    live: isLive(f.status),
    done: isDone(f.status),
  };
}
