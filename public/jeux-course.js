/**
 * Le déplacement, sur la page des mini-jeux (`jeux.html`) : une course sans
 * fin vers le stade adverse, dessinée à la craie (aucune image neuve : le
 * coureur est le Fanzzy du joueur).
 *
 * La course avance image par image, à 60 images par seconde, avec les règles
 * du serveur recopiées mot pour mot : la page note chaque geste avec son
 * image, et le serveur rejoue la course pour trouver la distance.
 *
 * Script classique, chargé après le script de la page : il en lit `$`,
 * `api`, `dire`, `charger`, `hasard`, `tailleCanvas`, `imageFanzzy` et
 * `avatar`.
 */

/* @page:debut course */
const COURSE = Object.freeze({
  IMAGES_S: 60,
  IMAGES_MAX: 60 * 60 * 15,
  GRAVITE: 2600,
  SAUT: 900,
  /* Une glissade dure tant d'images ; en l'air, elle plaque au sol. */
  GLISSADE: 36,
  V0: 260,
  ACCEL: 7,
  VMAX: 640,
  /* Le Fanzzy, en pixels de route : sa place à l'écran, sa largeur, sa
     hauteur debout et en glissade. */
  X: 70,
  LARGEUR: 34,
  HAUT: 70,
  HAUT_GLISSE: 32,
  /* La route apparaît à cette distance devant lui. */
  VUE: 420,
  PX_PAR_METRE: 20,
  TICKET_M: 20,
});

const OBSTACLES = Object.freeze({
  barriere: { l: 26, bas: 0, haut: 44 },
  peage: { l: 30, bas: 46, haut: 400 },
  car: { l: 110, bas: 0, haut: 58 },
  ticket: { l: 22, bas: 0, haut: 22 },
});

/** Une course neuve : son état, et `pas(geste)` pour avancer d'une image. */
function nouvelleCourse(graine) {
  const r = hasard(graine);
  const dt = 1 / COURSE.IMAGES_S;
  const s = { image: 0, dist: 0, y: 0, vy: 0, glisse: 0, v: COURSE.V0, tickets: 0, fini: false,
    route: [], prochain: COURSE.VUE };

  function poser() {
    const avance = s.dist > 1600;
    const x = r();
    const type = !avance || x < 0.45 ? 'barriere' : x < 0.75 ? 'peage' : 'car';
    const o = OBSTACLES[type];
    s.route.push({ type, x: s.prochain, l: o.l, bas: o.bas, haut: o.haut });
    const ecart = s.v * (0.95 + r() * 0.9);
    if (r() < 0.4) {
      const bas = r() < 0.5 ? 20 : 110;
      s.route.push({ type: 'ticket', x: s.prochain + o.l + ecart * 0.45, l: OBSTACLES.ticket.l, bas,
        haut: bas + OBSTACLES.ticket.haut });
    }
    s.prochain += o.l + ecart;
  }

  /** Une image. `geste` : 0 rien, 1 sauter, 2 glisser. */
  function pas(geste) {
    if (s.fini) return s;
    if (geste === 1 && s.y === 0) { s.vy = COURSE.SAUT; s.glisse = 0; }
    if (geste === 2) {
      s.glisse = COURSE.GLISSADE;
      if (s.y > 0) s.vy = Math.min(s.vy, -COURSE.SAUT);
    }
    s.image++;
    s.v = Math.min(COURSE.VMAX, COURSE.V0 + COURSE.ACCEL * s.image * dt);
    s.dist += s.v * dt;
    if (s.y > 0 || s.vy > 0) {
      s.vy -= COURSE.GRAVITE * dt;
      s.y += s.vy * dt;
      if (s.y <= 0) { s.y = 0; s.vy = 0; }
    }
    if (s.glisse > 0) s.glisse--;
    while (s.prochain < s.dist + COURSE.VUE) poser();

    const gauche = s.dist + COURSE.X;
    const droite = gauche + COURSE.LARGEUR;
    const bas = s.y;
    const haut = s.y + (s.glisse > 0 ? COURSE.HAUT_GLISSE : COURSE.HAUT);
    for (let i = 0; i < s.route.length; i++) {
      const o = s.route[i];
      if (o.x > droite || o.x + o.l < gauche || o.bas > haut || o.haut < bas) continue;
      if (o.type === 'ticket') { s.tickets++; s.route.splice(i, 1); i--; continue; }
      s.fini = true;
      break;
    }
    while (s.route.length && s.route[0].x + s.route[0].l < s.dist) s.route.shift();
    if (s.image >= COURSE.IMAGES_MAX) s.fini = true;
    return s;
  }

  return { etat: s, pas };
}

/** Les mètres et le score d'une course. */
function scoreDeCourse(s) {
  const metres = Math.floor(s.dist / COURSE.PX_PAR_METRE);
  return { metres, tickets: s.tickets, score: metres + s.tickets * COURSE.TICKET_M };
}
/* @page:fin course */

const D = { partie: null, course: null, gestes: [], attente: 0, raf: 0, dernier: 0, reste: 0,
  taille: null, fini: true, image: null, doigt: null };
const dc = $('d-canvas');
const dctx = dc.getContext('2d');
/* La route se voit sur 360 pixels de large, le sol aux trois quarts. */
const LARGEUR_VUE = 360;
const SOL = 0.78;

function dessinerCourse() {
  const { w, h, dpr } = D.taille;
  const k = w / LARGEUR_VUE;
  const sol = h * SOL;
  const s = D.course.etat;
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dctx.clearRect(0, 0, w, h);

  /* Le ciel du soir, le stade au loin qui défile lentement. */
  const ciel = dctx.createLinearGradient(0, 0, 0, sol);
  ciel.addColorStop(0, '#0B1220');
  ciel.addColorStop(1, '#1E2A3A');
  dctx.fillStyle = ciel;
  dctx.fillRect(0, 0, w, sol);
  dctx.fillStyle = 'rgba(242,238,228,.08)';
  const loin = (s.dist * 0.15) % (w * 1.6);
  for (let i = -1; i < 3; i++) {
    const x = i * w * 0.8 - loin * 0.5;
    dctx.fillRect(x, sol - h * 0.16, w * 0.32, h * 0.16);
    dctx.fillRect(x + w * 0.04, sol - h * 0.22, w * 0.02, h * 0.06);
    dctx.fillRect(x + w * 0.26, sol - h * 0.22, w * 0.02, h * 0.06);
  }
  /* La route et ses traits qui filent. */
  dctx.fillStyle = '#1A1D22';
  dctx.fillRect(0, sol, w, h - sol);
  dctx.strokeStyle = 'rgba(242,238,228,.75)';
  dctx.lineWidth = 3;
  dctx.beginPath(); dctx.moveTo(0, sol); dctx.lineTo(w, sol); dctx.stroke();
  dctx.strokeStyle = 'rgba(245,195,59,.6)';
  dctx.setLineDash([24 * k, 24 * k]);
  dctx.lineDashOffset = (s.dist * k) % (48 * k);
  dctx.beginPath(); dctx.moveTo(0, sol + (h - sol) * 0.5); dctx.lineTo(w, sol + (h - sol) * 0.5); dctx.stroke();
  dctx.setLineDash([]);

  /* La route : barrières, péages, cars, tickets. */
  const ecran = (x) => (x - s.dist) * k;
  const haut = (y) => sol - y * k;
  for (const o of s.route) {
    const x = ecran(o.x);
    if (x > w || x + o.l * k < 0) continue;
    if (o.type === 'barriere') {
      dctx.fillStyle = '#F2EEE4';
      dctx.fillRect(x, haut(o.haut), o.l * k, (o.haut - o.bas) * k * 0.3);
      dctx.fillStyle = '#E5484D';
      dctx.fillRect(x + o.l * k * 0.25, haut(o.haut), o.l * k * 0.25, (o.haut - o.bas) * k * 0.3);
      dctx.fillStyle = '#C2CAD6';
      dctx.fillRect(x + 2 * k, haut(o.haut), 4 * k, o.haut * k);
      dctx.fillRect(x + o.l * k - 6 * k, haut(o.haut), 4 * k, o.haut * k);
    } else if (o.type === 'peage') {
      /* La cabine au-dessus, et la barrière rayée qui barre le passage. */
      dctx.fillStyle = 'rgba(194,202,214,.25)';
      dctx.fillRect(x - 6 * k, haut(170), (o.l + 12) * k, 110 * k);
      for (let i = 0; i < 4; i++) {
        dctx.fillStyle = i % 2 ? '#F2EEE4' : '#E5484D';
        dctx.fillRect(x + (o.l * k / 4) * i, haut(o.bas + 14), o.l * k / 4, 14 * k);
      }
      dctx.fillStyle = '#C2CAD6';
      dctx.fillRect(x + o.l * k - 5 * k, haut(o.bas + 60), 5 * k, (o.bas + 60) * k);
    } else if (o.type === 'car') {
      dctx.fillStyle = '#3A6EA5';
      dctx.beginPath();
      dctx.roundRect?.(x, haut(o.haut), o.l * k, (o.haut - 10) * k, 6 * k);
      if (!dctx.roundRect) dctx.rect(x, haut(o.haut), o.l * k, (o.haut - 10) * k);
      dctx.fill();
      dctx.fillStyle = 'rgba(242,238,228,.7)';
      for (let i = 0; i < 4; i++) dctx.fillRect(x + (8 + i * 25) * k, haut(o.haut - 8), 18 * k, 14 * k);
      dctx.fillStyle = '#05070A';
      for (const r of [0.2, 0.8]) {
        dctx.beginPath(); dctx.arc(x + o.l * k * r, haut(8), 9 * k, 0, Math.PI * 2); dctx.fill();
      }
      /* En panne : la fumée. */
      dctx.fillStyle = 'rgba(194,202,214,.35)';
      for (let i = 0; i < 3; i++) {
        dctx.beginPath();
        dctx.arc(x + o.l * k * 0.9 + i * 6 * k, haut(o.haut + 10 + i * 12), (7 + i * 3) * k, 0, Math.PI * 2);
        dctx.fill();
      }
    } else if (o.type === 'ticket') {
      dctx.save();
      dctx.translate(x + o.l * k / 2, haut(o.bas + 11));
      dctx.rotate(-0.2);
      dctx.fillStyle = '#F5C33B';
      dctx.fillRect(-o.l * k / 2, -7 * k, o.l * k, 14 * k);
      dctx.strokeStyle = '#05070A';
      dctx.setLineDash([2 * k, 2 * k]);
      dctx.beginPath(); dctx.moveTo(o.l * k * 0.15, -7 * k); dctx.lineTo(o.l * k * 0.15, 7 * k); dctx.stroke();
      dctx.setLineDash([]);
      dctx.restore();
    }
  }

  /* Le coureur : son Fanzzy, couché quand il glisse. */
  const glisse = s.glisse > 0;
  const hj = (glisse ? COURSE.HAUT_GLISSE : COURSE.HAUT) * k;
  const x = COURSE.X * k;
  const y = haut(s.y);
  dctx.fillStyle = 'rgba(0,0,0,.35)';
  dctx.beginPath(); dctx.ellipse(x + COURSE.LARGEUR * k / 2, sol + 3, COURSE.LARGEUR * k * 0.7, 4 * k, 0, 0, Math.PI * 2);
  dctx.fill();
  if (D.image?.complete && D.image.naturalWidth) {
    const ih = (glisse ? COURSE.HAUT * 0.62 : COURSE.HAUT * 1.25) * k;
    const iw = ih * D.image.naturalWidth / D.image.naturalHeight;
    dctx.save();
    dctx.translate(x + COURSE.LARGEUR * k / 2, y);
    if (glisse) dctx.rotate(-0.5);
    else if (s.y === 0) dctx.rotate(Math.sin(s.image / 4) * 0.06);
    dctx.drawImage(D.image, -iw / 2, -ih, iw, ih);
    dctx.restore();
  } else {
    dctx.strokeStyle = '#F2EEE4';
    dctx.lineWidth = 5;
    dctx.strokeRect(x, y - hj, COURSE.LARGEUR * k, hj);
  }
}

function boucleCourse(t) {
  if ($('d-terrain').hidden) { D.raf = 0; return; }
  if (!D.fini) {
    D.reste += Math.min(0.1, (t - (D.dernier || t)) / 1000);
    D.dernier = t;
    const pas = 1 / COURSE.IMAGES_S;
    while (D.reste >= pas && !D.course.etat.fini) {
      const geste = D.attente;
      D.attente = 0;
      if (geste) D.gestes.push([D.course.etat.image, geste]);
      D.course.pas(geste);
      D.reste -= pas;
    }
    const sc = scoreDeCourse(D.course.etat);
    $('d-metres').textContent = `${sc.metres} m`;
    if (D.course.etat.fini) finirCourse();
  }
  dessinerCourse();
  D.raf = requestAnimationFrame(boucleCourse);
}

async function lancerCourse() {
  let p;
  try { p = await api('/partie/deplacement', {}); } catch (e) { dire(e); return; }
  D.partie = p;
  D.course = nouvelleCourse(p.graine);
  D.gestes = [];
  D.attente = 0;
  D.reste = 0;
  D.dernier = 0;
  D.fini = false;
  const src = imageFanzzy(avatar, 'joie');
  if (src && D.image?.dataset.src !== src) {
    D.image = new Image();
    D.image.dataset.src = src;
    D.image.src = src;
  }
  $('d-accueil').hidden = true;
  $('d-terrain').hidden = false;
  $('d-fin').hidden = true;
  $('d-consigne').textContent = 'Touche pour sauter, glisse vers le bas pour passer dessous';
  D.taille = tailleCanvas(dc);
  if (!D.raf) D.raf = requestAnimationFrame(boucleCourse);
  $('d-terrain').scrollIntoView({ block: 'center', behavior: 'smooth' });
}

async function finirCourse() {
  D.fini = true;
  $('d-consigne').textContent = 'Le décompte…';
  let r;
  try {
    r = await api(`/partie/deplacement/${D.partie.id}`, { gestes: D.gestes });
  } catch (e) {
    dire(e);
    $('d-terrain').hidden = true;
    $('d-accueil').hidden = false;
    return;
  }
  if (r.echarpes) window.dispatchEvent(new Event('tbf:bourse'));
  $('d-total').textContent = `${r.metres} m`;
  const lignes = [];
  if (r.nouveauRecord) lignes.push('<span class="tbf-sticker">NOUVEAU RECORD</span>');
  lignes.push(`Tickets : ${r.tickets} · ${r.score} points`);
  if (r.echarpes) lignes.push(`+${r.echarpes} écharpes`);
  $('d-bilan').innerHTML = lignes.join('<br>');
  $('d-fin').hidden = false;
  $('d-consigne').textContent = '';
  charger();
}

/* Toucher : sauter tout de suite. Glisser vers le bas : se baisser (en
   l'air, le Fanzzy se plaque au sol). */
dc.addEventListener('pointerdown', (e) => {
  if (D.fini) return;
  D.doigt = { y: e.clientY, glisse: false };
  D.attente = 1;
});
dc.addEventListener('pointermove', (e) => {
  if (D.fini || !D.doigt || D.doigt.glisse) return;
  if (e.clientY - D.doigt.y > 26) { D.doigt.glisse = true; D.attente = 2; }
});
dc.addEventListener('pointerup', () => { D.doigt = null; });
window.addEventListener('keydown', (e) => {
  if (D.fini || $('d-terrain').hidden) return;
  if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); D.attente = 1; }
  if (e.key === 'ArrowDown') { e.preventDefault(); D.attente = 2; }
});
$('d-jouer').addEventListener('click', lancerCourse);
$('d-rejouer').addEventListener('click', lancerCourse);
$('d-quitter').addEventListener('click', () => {
  $('d-terrain').hidden = true;
  $('d-accueil').hidden = false;
  $('c-deplacement').scrollIntoView({ block: 'start', behavior: 'smooth' });
});
window.addEventListener('resize', () => {
  if (!$('d-terrain').hidden) D.taille = tailleCanvas(dc);
});
