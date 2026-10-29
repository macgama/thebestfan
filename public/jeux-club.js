/**
 * Les deux jeux du club, sur la page des mini-jeux (`jeux.html`) : le tifo,
 * que tous les supporters d'un club peignent ensemble avant le prochain
 * match, et la tribune contre le boss de la semaine.
 *
 * Le club est celui du supporter : son club de cœur, sinon le premier qu'il
 * a suivi. Rien ne se décide ici : la page montre ce que le serveur sert, et
 * envoie les cases peintes une à une.
 *
 * Script classique, chargé après le script de la page : il en lit `$`, `esc`,
 * `api`, `dire` et `toast`.
 */

const TF = { etat: null, couleur: 0, charge: false };

const SANS_CLUB = `<p>Le tifo et le boss se jouent avec la tribune de ton club. Choisis ton club de cœur dans <a href="/equipes">Mes clubs</a>.</p>`;

function quand(d) {
  try {
    return new Date(`${String(d).replace(' ', 'T')}${/Z|[+-]\d\d:?\d\d$/.test(String(d)) ? '' : 'Z'}`)
      .toLocaleString(document.documentElement.lang || 'fr', { weekday: 'long', day: 'numeric',
        month: 'long', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

const adversaire = (m) => (m.domicile ? `Contre <b>${esc(m.adversaire ?? '')}</b>`
  : `Chez <b>${esc(m.adversaire ?? '')}</b>`);
const fidele = (m) => `Fidèle à ${Math.round(m.fidelite * 100)} % · Peintres : ${m.peintres}`;
const pourToi = (n) => (n ? `<br>+${n} écharpes pour toi` : '');

/* La grille, la même que celle qui se lève au Virage et sur l'accueil. */
const grille = (...a) => window.TBF_TIFO.grille(...a);

function dessinerTifo() {
  const t = TF.etat;
  const corps = $('tf-corps');
  if (!t?.club) {
    corps.innerHTML = SANS_CLUB;
    $('tf-leve').hidden = true;
    return;
  }
  const c = t.club.couleurs;
  if (!t.prochain) {
    corps.innerHTML = `<p>Pas de match de ${esc(t.club.nom)} au programme pour l’instant. Le prochain tifo s’ouvrira avec lui.</p>`;
  } else {
    const reste = Math.max(0, t.casesJour - t.mesCasesAujourdhui);
    corps.innerHTML = `<p>Tous les supporters de ${esc(t.club.nom)} peignent ensemble le tifo du prochain match. Choisis une couleur et touche une case : le modèle se devine sous les cases vides. Au coup d’envoi, le tifo se lève ; s’il est fidèle au modèle à ${t.seuil} %, chaque peintre reçoit ${t.gain} écharpes.</p>
      <p class="match">${adversaire(t.prochain)} · ${esc(quand(t.prochain.coupEnvoi))}</p>
      ${grille(t.prochain.cases, t.motif, c)}
      <div class="palette">${c.map((x, i) => `<button data-couleur="${i}" class="${i === TF.couleur ? 'on' : ''}"
        style="background:${x}"></button>`).join('')}</div>
      <div class="tifo-infos"><span>À peindre aujourd’hui : <b id="tf-reste">${reste}</b></span>
        <span>${fidele(t.prochain)}</span></div>`;
  }
  const l = t.leve;
  const leve = $('tf-leve');
  if (!l) { leve.hidden = true; return; }
  leve.hidden = false;
  leve.innerHTML = `<h2>LE TIFO LEVÉ</h2>
    <p class="match">${adversaire(l)}</p>
    ${grille(l.cases, t.motif, c, { leve: true })}
    <div class="tifo-infos"><span></span><span>${fidele(l)}</span></div>
    <p class="boss-tombe">${l.reussi ? '<span class="tbf-sticker">TIFO RÉUSSI</span>'
    : '<span>Pas assez de cases au coup d’envoi. Le prochain sera le bon.</span>'}${pourToi(l.verse)}</p>`;
  if (l.verse) window.dispatchEvent(new Event('tbf:bourse'));
}

async function chargerTifo() {
  try { TF.etat = await api('/tifo'); } catch (e) { if (e.message !== 'auth') $('tf-corps').innerHTML = ''; return; }
  TF.charge = true;
  dessinerTifo();
}

$('tf-corps').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-couleur]');
  if (b) {
    TF.couleur = Number(b.dataset.couleur);
    document.querySelectorAll('.palette button').forEach((x) => x.classList.toggle('on', x === b));
    return;
  }
  const caseEl = e.target.closest('.tifo:not(.leve) [data-n]');
  const t = TF.etat;
  if (!caseEl || !t?.prochain) return;
  const n = Number(caseEl.dataset.n);
  if (t.prochain.cases[n] === TF.couleur) return;
  if (t.mesCasesAujourdhui >= t.casesJour) { toast('Plus de case pour aujourd’hui, reviens demain'); return; }
  let r;
  try {
    r = await api('/tifo', { match: t.prochain.id, case: n, couleur: TF.couleur });
  } catch (err) { dire(err); return; }
  t.prochain.cases[n] = TF.couleur;
  t.mesCasesAujourdhui = r.mesCasesAujourdhui;
  caseEl.classList.remove('vide');
  caseEl.classList.add('moi');
  caseEl.style.background = t.club.couleurs[TF.couleur];
  const reste = Math.max(0, t.casesJour - t.mesCasesAujourdhui);
  if ($('tf-reste')) $('tf-reste').textContent = reste;
  /* La fidélité et les peintres restaient ceux de l'ouverture de l'onglet :
     on peignait ses quinze cases sous « Fidèle à 0 % · Peintres : 0 ». Le
     serveur les recompte, une fois que le pinceau s'est posé. */
  clearTimeout(TF.relire);
  TF.relire = setTimeout(chargerTifo, 1200);
});

/* ================================================================ le boss */

/* Une tribune rivale par semaine, tirée du numéro de la semaine. */
const BOSS = [
  'Les Sifflets d’Acier', 'La Tribune du Brouillard', 'Le Kop des Tambours Crevés',
  'Les Mégaphones du Nord', 'La Curva des Muets', 'Les Klaxons de la Rocade',
  'Le Virage des Grincheux', 'Les Cornes de Brume',
];
const nomDuBoss = (lundi) => BOSS[Math.floor(Date.parse(`${lundi}T00:00:00Z`) / 604800000) % BOSS.length];

/** La tribune rivale au pochoir : des gradins, une foule, un mégaphone géant. */
function silhouette(tombe) {
  const tetes = [];
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 14; i++) {
      tetes.push(`<circle cx="${18 + i * 24 + (r % 2) * 12}" cy="${120 - r * 22}" r="7"/>`);
    }
  }
  return `<svg class="boss-art" viewBox="0 0 360 170" aria-hidden="true">
    <g fill="${tombe ? 'rgba(242,238,228,.18)' : 'rgba(229,72,77,.85)'}">
      <path d="M0 170 L0 130 L360 70 L360 170 Z" opacity=".45"/>
      ${tetes.join('')}
      <circle cx="160" cy="22" r="10"/><path d="M150 36 h20 v24 h-20 Z"/>
      <path d="M172 30 L222 10 L222 52 L172 38 Z"/>
    </g>
    ${tombe ? '<path d="M120 30 L240 120 M240 30 L120 120" stroke="#F2EEE4" stroke-width="10" stroke-linecap="round"/>' : ''}
  </svg>`;
}

function dessinerBoss(b) {
  const corps = $('b-corps');
  if (!b?.club) { corps.innerHTML = SANS_CLUB; return; }
  const s = b.semaine;
  const reste = Math.max(0, s.voix - s.retire);
  const p = b.precedente;
  corps.innerHTML = `<div class="boss-nom">${esc(nomDuBoss(s.lundi))}</div>
    ${silhouette(s.tombe)}
    <div class="voix"><i style="width:${Math.round(reste / s.voix * 100)}%"></i></div>
    <div class="tifo-infos"><span>Sa voix : ${reste} / ${s.voix}</span><span>Tes chants : ${s.mesCoups}</span></div>
    ${s.tombe
    ? `<p class="boss-tombe"><span class="tbf-sticker">FAIT TAIRE</span>${pourToi(s.verse)}</p>`
    : `<p>Chaque chant réussi par un supporter de ${esc(b.club.nom)}, au Virage, au duel ou au chant en rythme, lui coupe un peu la voix. Faites-le taire avant dimanche soir : ${b.gain} écharpes pour chaque supporter qui a poussé.</p>`}
    <div class="actions">
      <a class="tbf-plaque" data-ton="flare" href="/virage">AU VIRAGE</a>
      <button class="tbf-plaque" data-ton="violet" data-aller="chant">LE CHANT EN RYTHME</button>
    </div>
    ${p.retire ? `<p class="mapl">${p.tombe ? '<span>La semaine passée, il s’est tu.</span>'
    : `<span>La semaine passée : ${p.retire} chants sur ${p.voix}.</span>`}${pourToi(p.verse)}</p>` : ''}`;
  if (s.verse || p.verse) window.dispatchEvent(new Event('tbf:bourse'));
}

async function chargerBoss() {
  try { dessinerBoss(await api('/boss')); } catch (e) { if (e.message !== 'auth') $('b-corps').innerHTML = ''; }
}
$('b-corps').addEventListener('click', (e) => {
  const b = e.target.closest('[data-aller]');
  if (b) montrer(b.dataset.aller);
});

/* Chargés quand on ouvre leur onglet, pas avant : la page des mini-jeux
   s'ouvre sur les jongles. */
window.addEventListener('jeux:onglet', (e) => {
  if (e.detail === 'tifo') chargerTifo();
  if (e.detail === 'boss') chargerBoss();
});
