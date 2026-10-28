/* =======================================================================
   Où jouer, match par match : les pastilles des pages MATCHS et
   COMPÉTITIONS.

   28 octobre 2026, Gaël : « ce serait bien s'il y avait la possibilité de
   voir les informations liées au jeu également, de pouvoir cliquer sur un
   match s'il y a un Virage (ouvert) ou un duel ouvert en manque de joueur ».
   Jusque-là il fallait ouvrir la fiche d'un match pour découvrir qu'on
   pouvait y jouer, et rien, nulle part sur ces pages, ne disait qu'un duel
   attendait quelqu'un.

   Deux pastilles, sous le match :
     — **VIRAGE**, en vert, quand la tribune est ouverte : pendant le match,
       et dans la demi-heure qui le précède — la règle de `/api/virage/live`,
       recopiée ici telle quelle. « 12 EN TRIBUNE », quand il y a quelqu'un :
       les supporters qui poussent dans la tribune. Elle mène droit au
       Virage de ce match ;
     — **DUEL**, en violet (celui de l'onglet EN ATTENTE), quand quelqu'un
       attend un adversaire sur ce match. Elle mène au duel avec le format
       de la file la plus remplie et la tribune qui manque déjà choisis.

   La page n'a qu'une chose à faire : poser, là où les pastilles doivent
   apparaître, un élément vide
       <div class="tbf-jeu" data-jeu="<id>" data-statut="<statut>"
            data-coup="<coup d'envoi ISO>"></div>
   Ce fichier le remplit, à chaque rendu de la page (il guette les
   changements du document) et à chaque relecture de `/api/virage/a-jouer`,
   toutes les vingt secondes tant que la page se voit — et tout de suite
   quand le rappel du duel annonce que les files ont bougé (`tbf:attentes`).
   Vide, l'élément ne prend aucune place (ui.css, « Où jouer »).

   Le filtre À JOUER de /matchs demande `TBF_A_JOUER.jouable(id, statut,
   coup)` (la même règle que les pastilles : un match à garder en a une), et
   se redessine à l'événement `tbf:a-jouer`, envoyé quand une relecture
   change ce qu'on sait.

   La page garde son toucher : appuyer à côté des pastilles ouvre la fiche du
   match, comme avant. Ses écouteurs laissent passer un appui sur
   `.tbf-jeu a`, qui suit son lien.
   ======================================================================= */

(() => {
  if (window.TBF_A_JOUER) return;

  const CADENCE_MS = 20_000;
  // Les statuts où la tribune est ouverte : ceux de `/api/virage/live`.
  const OUVERTS = new Set(['1H', 'HT', '2H', 'ET', 'P', 'LIVE']);
  const FINIS = new Set(['FT', 'AET', 'PEN']);
  const AVANT_MS = 30 * 60_000;

  let foules = new Map();   // fixtureId -> nombre de supporters qui poussent
  let duels = new Map();    // fixtureId -> { n, format, camp }
  let minuterie = null;

  /** La tribune de ce match est-elle ouverte maintenant ? */
  function virageOuvert(statut, coup) {
    if (FINIS.has(statut)) return false;
    if (OUVERTS.has(statut)) return true;
    const dans = new Date(coup).getTime() - Date.now();
    return Number.isFinite(dans) && dans > 0 && dans <= AVANT_MS;
  }

  /**
   * Les files d'un match, ramenées à une seule invitation.
   *
   * La file la plus remplie d'abord — c'est elle qui partira le plus vite, la
   * règle du choix de l'onglet EN ATTENTE —, et dans cette file la tribune
   * qui a le moins de monde au regard de ce qu'il faut : c'est elle qui
   * manque. À égalité, celle de l'équipe qui reçoit.
   */
  function lireDuels(liste) {
    const parMatch = new Map();
    for (const a of liste ?? []) {
      const camps = Array.isArray(a.camps) ? a.camps.map((n) => Number(n) || 0) : [0, 0];
      const n = camps[0] + camps[1];
      if (!(n > 0)) continue;
      const id = Number(a.fixtureId);
      const e = parMatch.get(id) ?? { n: 0, meilleure: null };
      e.n += n;
      if (!e.meilleure || n > e.meilleure.n) {
        e.meilleure = { n, format: a.format, camp: camps[1] < camps[0] ? 1 : 0 };
      }
      parMatch.set(id, e);
    }
    return new Map([...parMatch].map(([id, e]) =>
      [id, { n: e.n, format: e.meilleure.format, camp: e.meilleure.camp }]));
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /** Les pastilles d'un match, en balisage. Rien du tout s'il n'y a rien. */
  function pastilles(id, statut, coup) {
    const out = [];
    if (virageOuvert(statut, coup)) {
      const n = foules.get(id) ?? 0;
      out.push(`<a class="virage" href="/virage?match=${id}"><span>VIRAGE</span>${n > 0
        ? `<small>${n} EN TRIBUNE</small>` : ''}</a>`);
    }
    const d = FINIS.has(statut) ? null : duels.get(id);
    if (d) {
      const q = new URLSearchParams({ match: String(id), format: d.format, camp: String(d.camp) });
      out.push(`<a class="duel" href="/duel-nvn?${esc(q.toString())}"><span>DUEL</span><small>${d.n > 1
        ? `${d.n} T’ATTENDENT` : '1 T’ATTEND'}</small></a>`);
    }
    return out.join('');
  }

  /** Remplit chaque emplacement, et ne touche qu'à ceux qui changent. */
  function poser(racine = document) {
    for (const el of racine.querySelectorAll('[data-jeu]')) {
      const id = Number(el.dataset.jeu);
      if (!Number.isInteger(id) || id <= 0) continue;
      const html = pastilles(id, el.dataset.statut ?? '', el.dataset.coup ?? '');
      /* Comparé à ce qu'on a posé la dernière fois, pas au contenu : la
         traduction de `langue.js` réécrit le texte en place, et le comparer
         au français le ferait reposer à chaque tour, sans fin. */
      if (el.dataset.pose === html) continue;
      el.dataset.pose = html;
      el.innerHTML = html;
    }
  }

  /** Peut-on jouer sur ce match maintenant ? Le filtre À JOUER de /matchs. */
  const jouable = (id, statut, coup) => pastilles(Number(id), statut ?? '', coup ?? '') !== '';

  /* Ce qu'on sait, résumé : la page qui filtre n'est prévenue (`tbf:a-jouer`)
     que si ça change. */
  let vu = null;
  function prevenir() {
    const sig = JSON.stringify([[...foules], [...duels]]);
    if (sig === vu) return;
    vu = sig;
    window.dispatchEvent(new CustomEvent('tbf:a-jouer'));
  }

  async function lire() {
    clearTimeout(minuterie);
    if (document.visibilityState === 'visible') {
      try {
        const r = await fetch('/api/virage/a-jouer', { credentials: 'same-origin', cache: 'no-store' });
        if (r.ok) {
          const d = await r.json();
          foules = new Map((d?.foules ?? []).map((f) =>
            [Number(f.fixtureId), (Number(f.crowd?.[0]) || 0) + (Number(f.crowd?.[1]) || 0)]));
          duels = lireDuels(d?.duels);
        }
      } catch { /* hors ligne : on garde ce qu'on a, et on réessaie */ }
      // Même sans réponse : une tribune s'ouvre à l'heure, pas au serveur.
      poser();
      prevenir();
    }
    minuterie = setTimeout(lire, CADENCE_MS);
  }

  /* Chaque rendu de la page recrée ses lignes, et leurs emplacements vides :
     on les remplit dans la foulée, avec ce qu'on sait déjà. */
  let prevu = false;
  new MutationObserver((changes) => {
    if (prevu) return;
    const neuf = changes.some((c) => [...c.addedNodes].some((n) => n.nodeType === 1
      && (n.matches?.('[data-jeu]') || n.querySelector?.('[data-jeu]:not([data-pose])'))));
    if (!neuf) return;
    prevu = true;
    queueMicrotask(() => { prevu = false; poser(); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void lire();
  });
  window.addEventListener('tbf:attentes', () => void lire());

  window.TBF_A_JOUER = { poser, relire: lire, virageOuvert, jouable };
  void lire();
})();
