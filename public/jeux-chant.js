/**
 * Le chant en rythme, sur la page des mini-jeux (`jeux.html`).
 *
 * Un « Guitar Hero » de tribune : les notes descendent sur trois tambours, on
 * tape le bon tambour quand la note touche la ligne. La page juge chaque
 * frappe pour l'afficher ; le serveur, lui, reçoit la liste des frappes et
 * note le chant tout seul, sur la même partition (la graine de la partie).
 *
 * Script classique, chargé après le script de la page : il en lit `$`,
 * `api`, `dire`, `etat`, `charger`, `classement`, `hasard` et `tailleCanvas`.
 */

/* Les règles du serveur, mot pour mot (`src/shared/mini-jeux.js`, entre les
   deux repères) : la suite `jeux:ui` compare les deux textes. */
/* @page:debut chant */
const CHANT = Object.freeze({
  COULOIRS: 3,
  /* La première note tombe après `DEBUT_MS`, la dernière avant `DUREE_MS`. */
  DEBUT_MS: 2400,
  DUREE_MS: 42000,
  /* Le temps qu'une note met à descendre du haut du terrain à la ligne. */
  CHUTE_MS: 1500,
  PARFAIT_MS: 60,
  BON_MS: 130,
  POINTS_PARFAIT: 100,
  POINTS_BON: 50,
  /* Le multiplicateur monte d'un cran toutes les `PALIER` notes réussies
     d'affilée, jusqu'à `MULT_MAX`. */
  PALIER: 10,
  MULT_MAX: 4,
});

/**
 * La partition d'un chant : `{ bpm, notes: [{ t, c }] }`, `t` en
 * millisecondes depuis le début de la partie, `c` le tambour (0 à 2). Le
 * chant se densifie de mesure en mesure.
 */
function partitionDuChant(graine) {
  const r = hasard(graine);
  const bpm = 96 + Math.floor(r() * 5) * 6;
  const croche = 60000 / bpm / 2;
  const notes = [];
  let c = 1;
  for (let k = 0; ; k++) {
    const t = Math.round(CHANT.DEBUT_MS + k * croche);
    if (t > CHANT.DUREE_MS) break;
    const mesure = Math.floor(k / 8);
    const densite = Math.min(0.9, 0.3 + mesure * 0.045);
    const p = k % 2 === 0 ? densite + 0.25 : densite * 0.55;
    if (r() < p) {
      /* Le plus souvent, le tambour d'à côté : la main court sur la peau. */
      const saut = r();
      c = saut < 0.4 ? c : saut < 0.8 ? (c + 1) % 3 : (c + 2) % 3;
      notes.push({ t, c });
    }
  }
  return { bpm, notes };
}

/**
 * Note les frappes d'un chant. `frappes` : `[{ c, t }]` dans l'ordre du
 * temps. Rend `null` si la liste est impossible, sinon
 * `{ score, parfaits, bons, rates, fausses, serieMax, reussis }`.
 *
 * Chaque note prend, sur son tambour, la frappe libre la plus proche dans sa
 * fenêtre ; les frappes qui ne trouvent aucune note sont « fausses ».
 */
function noterChant(partition, frappes) {
  const notes = partition.notes;
  if (!Array.isArray(frappes) || frappes.length > notes.length * 2 + 20) return null;
  let avant = -Infinity;
  for (const f of frappes) {
    if (!f || !Number.isInteger(f.c) || f.c < 0 || f.c >= CHANT.COULOIRS) return null;
    if (typeof f.t !== 'number' || !Number.isFinite(f.t) || f.t < 0
      || f.t > CHANT.DUREE_MS + 5000 || f.t < avant) return null;
    avant = f.t;
  }
  const prise = new Array(frappes.length).fill(false);
  const evenements = [];
  for (const n of notes) {
    let meilleure = -1;
    let ecart = Infinity;
    for (let i = 0; i < frappes.length; i++) {
      if (prise[i] || frappes[i].c !== n.c) continue;
      const e = Math.abs(frappes[i].t - n.t);
      if (e <= CHANT.BON_MS && e < ecart) { ecart = e; meilleure = i; }
    }
    if (meilleure >= 0) prise[meilleure] = true;
    evenements.push({ t: n.t, v: meilleure < 0 ? 'rate' : ecart <= CHANT.PARFAIT_MS ? 'parfait' : 'bon' });
  }
  frappes.forEach((f, i) => { if (!prise[i]) evenements.push({ t: f.t, v: 'fausse' }); });
  evenements.sort((a, b) => a.t - b.t);
  const bilan = { score: 0, parfaits: 0, bons: 0, rates: 0, fausses: 0, serieMax: 0, reussis: 0 };
  let serie = 0;
  for (const e of evenements) {
    if (e.v === 'parfait' || e.v === 'bon') {
      const mult = Math.min(CHANT.MULT_MAX, 1 + Math.floor(serie / CHANT.PALIER));
      bilan.score += (e.v === 'parfait' ? CHANT.POINTS_PARFAIT : CHANT.POINTS_BON) * mult;
      bilan[e.v === 'parfait' ? 'parfaits' : 'bons']++;
      bilan.reussis++;
      serie++;
      bilan.serieMax = Math.max(bilan.serieMax, serie);
    } else {
      bilan[e.v === 'rate' ? 'rates' : 'fausses']++;
      serie = 0;
    }
  }
  return bilan;
}
/* @page:fin chant */

const CH = { partie: null, partition: null, t0: 0, frappes: [], jugees: null, score: 0, serie: 0,
  raf: 0, fini: true, taille: null, eclats: [] };
const chc = $('ch-canvas');
const chctx = chc.getContext('2d');
const COULEURS_TAMBOURS = ['#E5484D', '#F5C33B', '#3FA7F5'];
const LIGNE = 0.82;

/* Un coup de tambour synthétisé : le chant se joue aussi à l'oreille. */
let audioCh = null;
function tambour(c, fort = 1) {
  try {
    audioCh ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCh.currentTime;
    const o = audioCh.createOscillator();
    const g = audioCh.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime([110, 150, 200][c] * 1.6, t);
    o.frequency.exponentialRampToValueAtTime([110, 150, 200][c] * 0.6, t + 0.12);
    g.gain.setValueAtTime(0.32 * fort, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(audioCh.destination);
    o.start(t);
    o.stop(t + 0.18);
  } catch { /* sans son, on joue quand même */ }
}

const maintenant = () => performance.now() - CH.t0;

function dessinerChant() {
  const { w, h, dpr } = CH.taille;
  chctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  chctx.clearRect(0, 0, w, h);
  const ly = h * LIGNE;
  const lw = w / 3;
  const now = maintenant();
  /* Les trois couloirs, la ligne, les tambours. */
  for (let c = 0; c < 3; c++) {
    chctx.fillStyle = c % 2 ? 'rgba(242,238,228,.03)' : 'rgba(242,238,228,.06)';
    chctx.fillRect(c * lw, 0, lw, h);
  }
  chctx.strokeStyle = 'rgba(242,238,228,.7)';
  chctx.lineWidth = 3;
  chctx.beginPath(); chctx.moveTo(0, ly); chctx.lineTo(w, ly); chctx.stroke();
  for (let c = 0; c < 3; c++) {
    const x = lw * (c + 0.5);
    const coup = CH.eclats.find((e) => e.c === c && now - e.t < 120);
    chctx.fillStyle = coup ? COULEURS_TAMBOURS[c] : 'rgba(10,13,17,.9)';
    chctx.strokeStyle = COULEURS_TAMBOURS[c];
    chctx.lineWidth = 4;
    chctx.beginPath(); chctx.ellipse(x, ly, lw * 0.36, lw * 0.16, 0, 0, Math.PI * 2);
    chctx.fill(); chctx.stroke();
  }
  /* Les notes qui descendent. */
  const notes = CH.partition?.notes ?? [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const d = n.t - now;
    if (d > CHANT.CHUTE_MS) break;
    if (CH.jugees[i] && CH.jugees[i] !== 'rate') continue;
    if (d < -300) continue;
    const y = ly - (d / CHANT.CHUTE_MS) * ly;
    chctx.globalAlpha = CH.jugees[i] === 'rate' ? 0.3 : 1;
    chctx.fillStyle = COULEURS_TAMBOURS[n.c];
    chctx.beginPath(); chctx.arc(lw * (n.c + 0.5), y, lw * 0.17, 0, Math.PI * 2); chctx.fill();
    chctx.strokeStyle = '#05070A';
    chctx.lineWidth = 3;
    chctx.stroke();
    chctx.globalAlpha = 1;
  }
  /* Les mots qui claquent au-dessus des tambours. */
  chctx.textAlign = 'center';
  chctx.font = `700 ${Math.round(w * 0.05)}px Oswald, sans-serif`;
  for (const e of CH.eclats) {
    const age = now - e.t;
    if (age > 600 || !e.mot) continue;
    chctx.globalAlpha = 1 - age / 600;
    chctx.fillStyle = e.couleur;
    chctx.fillText(window.TBF_LANGUE?.t(e.mot) ?? e.mot, lw * (e.c + 0.5), ly - lw * 0.3 - age * 0.05);
  }
  chctx.globalAlpha = 1;
}

const MOTS = { parfait: 'PARFAIT', bon: 'BON', rate: 'RATÉ', fausse: 'À CÔTÉ' };
const TEINTES = { parfait: '#F5C33B', bon: '#F2EEE4', rate: '#E5484D', fausse: '#E5484D' };

function compter(verdict, c) {
  if (verdict === 'parfait' || verdict === 'bon') {
    const mult = Math.min(CHANT.MULT_MAX, 1 + Math.floor(CH.serie / CHANT.PALIER));
    CH.score += (verdict === 'parfait' ? CHANT.POINTS_PARFAIT : CHANT.POINTS_BON) * mult;
    CH.serie++;
  } else {
    CH.serie = 0;
  }
  CH.eclats.push({ c, t: maintenant(), mot: MOTS[verdict], couleur: TEINTES[verdict] });
  if (CH.eclats.length > 30) CH.eclats.splice(0, CH.eclats.length - 30);
  $('ch-score').textContent = CH.score;
  const mult = Math.min(CHANT.MULT_MAX, 1 + Math.floor(CH.serie / CHANT.PALIER));
  $('ch-multi').textContent = mult > 1 ? `×${mult}` : '';
}

function frapperChant(c) {
  if (CH.fini) return;
  const t = Math.round(maintenant() * 10) / 10;
  CH.frappes.push({ c, t });
  tambour(c);
  /* La note la plus proche sur ce tambour, pas encore jugée. */
  const notes = CH.partition.notes;
  let meilleure = -1;
  let ecart = Infinity;
  for (let i = 0; i < notes.length; i++) {
    if (notes[i].t - t > CHANT.BON_MS) break;
    if (CH.jugees[i] || notes[i].c !== c) continue;
    const e = Math.abs(notes[i].t - t);
    if (e <= CHANT.BON_MS && e < ecart) { ecart = e; meilleure = i; }
  }
  if (meilleure < 0) { compter('fausse', c); return; }
  const v = ecart <= CHANT.PARFAIT_MS ? 'parfait' : 'bon';
  CH.jugees[meilleure] = v;
  compter(v, c);
}

function boucleChant() {
  if ($('ch-terrain').hidden) { CH.raf = 0; return; }
  const now = maintenant();
  const notes = CH.partition?.notes ?? [];
  if (!CH.fini) {
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].t > now - CHANT.BON_MS) break;
      if (!CH.jugees[i]) { CH.jugees[i] = 'rate'; compter('rate', notes[i].c); }
    }
    if (now > CHANT.DUREE_MS + 900) finirChant();
  }
  dessinerChant();
  CH.raf = requestAnimationFrame(boucleChant);
}

async function lancerChant() {
  let p;
  try { p = await api('/partie/chant', {}); } catch (e) { dire(e); return; }
  CH.partie = p;
  CH.partition = partitionDuChant(p.graine);
  CH.jugees = new Array(CH.partition.notes.length).fill(null);
  CH.frappes = [];
  CH.eclats = [];
  CH.score = 0;
  CH.serie = 0;
  CH.fini = false;
  $('ch-accueil').hidden = true;
  $('ch-terrain').hidden = false;
  $('ch-fin').hidden = true;
  $('ch-score').textContent = '0';
  $('ch-multi').textContent = '';
  $('ch-consigne').textContent = `${CH.partition.bpm} BPM · tape le tambour quand la note touche la ligne`;
  CH.taille = tailleCanvas(chc);
  CH.t0 = performance.now();
  if (!CH.raf) CH.raf = requestAnimationFrame(boucleChant);
  $('ch-terrain').scrollIntoView({ block: 'center', behavior: 'smooth' });
}

async function finirChant() {
  CH.fini = true;
  $('ch-consigne').textContent = 'Le décompte…';
  let r;
  try {
    r = await api(`/partie/chant/${CH.partie.id}`, { frappes: CH.frappes });
  } catch (e) {
    dire(e);
    $('ch-terrain').hidden = true;
    $('ch-accueil').hidden = false;
    return;
  }
  if (r.echarpes) window.dispatchEvent(new Event('tbf:bourse'));
  $('ch-total').textContent = r.score;
  const lignes = [];
  if (r.nouveauRecord) lignes.push('<span class="tbf-sticker">NOUVEAU RECORD</span>');
  lignes.push(`PARFAIT : ${r.parfaits} · BON : ${r.bons} · RATÉ : ${r.rates}`);
  lignes.push(`Meilleure série : ${r.serieMax}`);
  if (r.echarpes) lignes.push(`+${r.echarpes} écharpes`);
  $('ch-bilan').innerHTML = lignes.join('<br>');
  $('ch-fin').hidden = false;
  $('ch-consigne').textContent = '';
  charger();
}

chc.addEventListener('pointerdown', (e) => {
  if (CH.fini || !CH.taille) return;
  const r = chc.getBoundingClientRect();
  frapperChant(Math.min(2, Math.max(0, Math.floor((e.clientX - r.left) / (r.width / 3)))));
});
/* Au clavier, sur un ordinateur : J, K, L (ou les flèches). */
window.addEventListener('keydown', (e) => {
  if (CH.fini || e.repeat) return;
  const c = { j: 0, k: 1, l: 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 }[e.key];
  if (c != null) { e.preventDefault(); frapperChant(c); }
});
$('ch-jouer').addEventListener('click', lancerChant);
$('ch-rejouer').addEventListener('click', lancerChant);
$('ch-quitter').addEventListener('click', () => {
  $('ch-terrain').hidden = true;
  $('ch-accueil').hidden = false;
  $('c-chant').scrollIntoView({ block: 'start', behavior: 'smooth' });
});
window.addEventListener('resize', () => {
  if (!$('ch-terrain').hidden) CH.taille = tailleCanvas(chc);
});
