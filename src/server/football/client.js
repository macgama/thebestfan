/**
 * Client API-Football.
 *
 * Trois responsabilités, et rien d'autre : signer les appels, compter le
 * quota, et refuser de partir quand il ne reste plus grand-chose. Toute la
 * logique métier vit dans le poller.
 *
 * La clé ne quitte jamais le serveur. Aucun appel n'est fait depuis le
 * navigateur : sinon n'importe qui viderait les 7 500 requêtes du jour.
 */

const BASE = 'https://v3.football.api-sports.io';

export class QuotaExhausted extends Error {
  constructor(remaining) {
    super(`quota API épuisé (${remaining} restants)`);
    this.name = 'QuotaExhausted';
  }
}

export function createClient({ apiKey, store = null, baseUrl = BASE, dailyBudget = 6800, minIntervalMs = 250 }) {
  let quotaStore = store;
  let lastCall = 0;
  let remaining = null;      // dernier X-RateLimit-requests-remaining connu
  let usedToday = 0;

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Budget volontairement inférieur au quota réel : on garde une marge pour
   * les appels déclenchés par les joueurs (recherche d'un club) même si le
   * worker a beaucoup consommé.
   */
  function budgetLeft() {
    if (remaining !== null) return Math.min(remaining, dailyBudget - usedToday);
    return dailyBudget - usedToday;
  }

  async function call(path, params = {}, { critical = false } = {}) {
    if (!critical && budgetLeft() <= 0) throw new QuotaExhausted(budgetLeft());

    // Espacement minimal entre deux appels : le plan Pro autorise un débit
    // élevé, mais marteler l'API n'apporte rien et fait tomber en 429.
    const since = Date.now() - lastCall;
    if (since < minIntervalMs) await wait(minIntervalMs - since);
    lastCall = Date.now();

    const url = new URL(baseUrl + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    let res;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(url, {
          headers: { 'x-apisports-key': apiKey, accept: 'application/json' },
          signal: AbortSignal.timeout(12_000),
        });
      } catch (e) {
        if (attempt >= 2) throw e;
        await wait(500 * 2 ** attempt);
        continue;
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt >= 2) throw new Error(`API-Football ${res.status}`);
        const retryAfter = Number(res.headers.get('retry-after')) || 2 ** attempt;
        await wait(retryAfter * 1000);
        continue;
      }
      break;
    }

    usedToday++;
    const head = res.headers.get('x-ratelimit-requests-remaining');
    if (head !== null) remaining = Number(head);
    quotaStore?.recordApiCall(remaining).catch(() => {});

    if (!res.ok) throw new Error(`API-Football ${res.status} sur ${path}`);
    const body = await res.json();

    // L'API répond 200 même en cas d'erreur métier : le détail est dans
    // `errors`, tantôt objet, tantôt tableau vide.
    const errs = body?.errors;
    if (errs && !Array.isArray(errs) && Object.keys(errs).length) {
      throw new Error(`API-Football: ${Object.values(errs).join(' / ')}`);
    }
    return body?.response ?? [];
  }

  return {
    call,
    /** Le compteur de quota vit en base ; il est branché après la création du pool. */
    attachStore(s) { quotaStore = s; },
    get quota() {
      return { usedToday, remaining, budgetLeft: budgetLeft() };
    },
    resetDay() {
      usedToday = 0;
    },

    /* ------------------------------------------------------- endpoints */

    searchTeams: (query) => call('/teams', { search: query }),
    teamById: (id) => call('/teams', { id }),
    leaguesOfTeam: (teamId, season) => call('/leagues', { team: teamId, season }),

    /** Calendrier d'une équipe sur une fenêtre de dates. */
    fixturesOfTeam: (teamId, season, from, to) =>
      call('/fixtures', { team: teamId, season, from, to, timezone: 'UTC' }),

    /** Jusqu'à 20 matchs par appel : c'est ce qui rend le direct abordable. */
    fixturesByIds: (ids) => call('/fixtures', { ids: ids.slice(0, 20).join('-') }),

    eventsOfFixture: (fixtureId) => call('/fixtures/events', { fixture: fixtureId }),
    standings: (leagueId, season) => call('/standings', { league: leagueId, season }),
  };
}
