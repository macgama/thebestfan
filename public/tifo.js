/**
 * Le tifo du club qui se lève : le grand moment, au Virage et sur l'accueil
 * (demande de Gaël, 18 octobre 2026). Les supporters d'un club le peignent
 * ensemble dans les mini-jeux (`/jeux#tifo`) ; au coup d'envoi, il se lève.
 *
 *   TBF_TIFO.grille(cases, motif, couleurs, { leve })  la grille en HTML
 *   TBF_TIFO.aLaccueil()   lève, une fois, le tifo du dernier match du club
 *                          (commencé depuis moins d'un jour)
 *   TBF_TIFO.auMatch(id)   au Virage : lève le tifo de ce match s'il est
 *                          commencé, ou attend son coup d'envoi
 *
 * Un tifo que personne n'a peint ne se lève pas. Chaque tifo ne se lève
 * qu'une fois par lieu et par appareil (`localStorage`) : le revoir, c'est
 * dans les mini-jeux.
 *
 * Tout vient de `GET /api/jeux/tifo`, qui paie aussi les peintres d'un tifo
 * réussi : la grande scène dit ce qui vient d'être versé.
 *
 * Script classique, sans dépendance.
 */
(() => {
  if (window.TBF_TIFO) return;

  const esc = (s) => String(s ?? '').replace(/[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  const STYLE = `
.tifo{display:grid;grid-template-columns:repeat(20,1fr);gap:1px;background:rgba(242,238,228,.12);
  border:1px solid var(--trait,rgba(242,238,228,.18));border-radius:6px;overflow:hidden}
.tifo i{aspect-ratio:1;display:block;position:relative}
.tifo i.vide::after{content:'';position:absolute;inset:0;background:rgba(5,7,10,.72)}
.tifo-leve{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;
  padding:18px;background:rgba(4,6,9,.95);animation:tifo-fond .4s ease-out both}
.tifo-leve[hidden]{display:none}
.tifo-leve .boite{width:100%;max-width:440px;display:flex;flex-direction:column;align-items:center;gap:12px;
  text-align:center;color:var(--craie,#F2EEE4)}
.tifo-leve h2{font-family:var(--banner,Oswald,sans-serif);font-weight:700;font-size:30px;letter-spacing:.08em;
  margin:0;text-shadow:0 3px 0 #000}
.tifo-leve .sous{font-size:13px;margin:0;opacity:.92}
.tifo-leve .tifo{width:100%;perspective:600px;background:#05070A}
.tifo-leve .tifo i.vide{background:#11151B!important}
.tifo-leve .tifo i.vide::after{display:none}
.tifo-leve .tifo i{animation:tifo-case .5s cubic-bezier(.2,.9,.3,1.2) both;
  animation-delay:calc(var(--r) * 110ms + var(--c) * 12ms)}
.tifo-leve .issue{min-height:24px;font-size:13px;opacity:0;animation:tifo-fond .4s ease-out 1.6s both}
.tifo-leve .tbf-plaque{min-width:200px;opacity:0;animation:tifo-fond .4s ease-out 1.8s both}
@keyframes tifo-fond{from{opacity:0}to{opacity:1}}
@keyframes tifo-case{from{transform:translateY(60%) rotateX(80deg);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){
  .tifo-leve,.tifo-leve .tifo i,.tifo-leve .issue,.tifo-leve .tbf-plaque{animation:none;opacity:1}
}`;

  function poserStyle() {
    if (document.getElementById('tbf-tifo-style')) return;
    const st = document.createElement('style');
    st.id = 'tbf-tifo-style';
    st.textContent = STYLE;
    document.head.append(st);
  }

  /** La grille : chaque case peinte de sa couleur, les autres en ombre du modèle. */
  function grille(cases, motif, couleurs, { leve = false } = {}) {
    return `<div class="tifo${leve ? ' leve' : ''}">${motif.map((m, i) => {
      const c = cases[i];
      const pos = `--r:${11 - Math.floor(i / 20)};--c:${i % 20}`;
      return c == null
        ? `<i class="vide" data-n="${i}" style="background:${couleurs[m]};${pos}"></i>`
        : `<i data-n="${i}" style="background:${couleurs[c]};${pos}"></i>`;
    }).join('')}</div>`;
  }

  const vu = (lieu, id) => {
    try { return localStorage.getItem(`tbf_tifo_${lieu}`) === String(id); } catch { return false; }
  };
  const marquer = (lieu, id) => {
    try { localStorage.setItem(`tbf_tifo_${lieu}`, String(id)); } catch { /* sans mémoire, tant pis */ }
  };

  async function lire() {
    try {
      const r = await fetch('/api/jeux/tifo', { credentials: 'same-origin' });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }

  /** La grande scène : le tifo se lève, rang par rang, depuis le bas. */
  function lever(t) {
    const l = t.leve;
    poserStyle();
    const voile = document.createElement('div');
    voile.className = 'tifo-leve';
    voile.setAttribute('role', 'dialog');
    voile.setAttribute('aria-modal', 'true');
    const adversaire = l.domicile ? `Contre <b>${esc(l.adversaire ?? '')}</b>`
      : `Chez <b>${esc(l.adversaire ?? '')}</b>`;
    voile.innerHTML = `<div class="boite">
      <h2>LE TIFO SE LÈVE</h2>
      <p class="sous">${esc(t.club.nom)} · ${adversaire}</p>
      ${grille(l.cases, t.motif, t.club.couleurs, { leve: true })}
      <p class="sous">Fidèle à ${Math.round(l.fidelite * 100)} % · Peintres : ${l.peintres}</p>
      <div class="issue">${l.reussi ? '<span class="tbf-sticker">TIFO RÉUSSI</span>'
    : '<span>Pas assez de cases au coup d’envoi. Le prochain sera le bon.</span>'}${l.verse
  ? `<br><span>+${l.verse} écharpes pour toi</span>` : ''}</div>
      <button class="tbf-plaque" data-ton="flare" type="button">ALLEZ !</button>
    </div>`;
    const fermer = () => voile.remove();
    voile.addEventListener('click', (e) => {
      if (e.target === voile || e.target.closest('button')) fermer();
    });
    document.addEventListener('keydown', function echap(e) {
      if (e.key !== 'Escape') return;
      document.removeEventListener('keydown', echap);
      fermer();
    });
    document.body.append(voile);
    if (l.verse) window.dispatchEvent(new Event('tbf:bourse'));
    return voile;
  }

  /** Le tifo de ce lieu se lève-t-il ? Rend la scène, ou `null`. */
  function leverSi(t, lieu, id) {
    const l = t?.leve;
    if (!l || !t.club || !l.peintres || (id != null && l.id !== id) || vu(lieu, l.id)) return null;
    marquer(lieu, l.id);
    return lever(t);
  }

  let attente = 0;

  const api = {
    grille,
    lever,
    /** Sur l'accueil : le tifo du dernier match, levé depuis moins d'un jour. */
    async aLaccueil() {
      const t = await lire();
      if (!t?.leve || t.leve.dans < -24 * 3600) return null;
      return leverSi(t, 'accueil', null);
    },
    /**
     * Au Virage d'un match : son tifo se lève s'il est commencé ; avant le
     * coup d'envoi (moins de six heures), la page attend et le lève à
     * l'heure.
     */
    async auMatch(id) {
      clearTimeout(attente);
      const t = await lire();
      if (!t?.club) return null;
      if (t.leve?.id === id) return leverSi(t, 'virage', id);
      const p = t.prochain;
      if (p?.id === id && p.dans > 0 && p.dans < 6 * 3600) {
        attente = setTimeout(() => api.auMatch(id), (p.dans + 5) * 1000);
      }
      return null;
    },
    /** Quitter le match : plus rien à attendre. */
    oublier() { clearTimeout(attente); },
  };
  window.TBF_TIFO = api;
})();
