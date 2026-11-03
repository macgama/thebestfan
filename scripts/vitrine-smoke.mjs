/**
 * Test de la vitrine : les deux blocs de preuve de l'écran non connecté.
 *
 * La vitrine — ce que voit quelqu'un qui n'a pas de compte — montre depuis
 * peu deux choses qu'elle ne faisait que promettre : les vrais matchs du jour
 * et une poignée de Fanzzy dessinés. Trois règles s'y vérifient mal à la
 * lecture du HTML, et toutes les trois portent sur ce qui arrive **quand il
 * n'y a rien** :
 *
 *   1. **Le silence.** Un cadre « les matchs du jour » vide sur la page
 *      d'accueil dit au visiteur que rien ne tourne ici. Les deux blocs
 *      naissent `hidden` et ne s'ouvrent qu'une fois remplis — télétexte
 *      éteint, journée sans match, réseau coupé, la vitrine se lit
 *      exactement comme avant.
 *
 *   2. **L'ordre.** Ce qui se joue maintenant d'abord, puis ce qui va se
 *      jouer, puis ce qui vient de finir. C'est tout l'intérêt du bloc : un
 *      match en direct relégué en troisième position ne sert à rien.
 *
 *   3. **Le compte des visages**, qui se lit sur `FZART.jouables()` (les
 *      dessins des séries ouvertes) et ne s'écrit pas à la main. Recopié, il
 *      mentirait au premier dessin ajouté.
 *
 * Ni base, ni navigateur : on prend le HTML réel de la page et le vrai code
 * des fonctions, lus dans `public/index.html`. Recopier l'un ou l'autre ici
 * ferait passer la suite sur du code qui n'est plus celui qui tourne — c'est
 * la faute que ce fichier existe pour ne pas commettre.
 *
 * Avant de lancer :  npm install
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(path.join(RACINE, 'public', 'index.html'), 'utf8');

/* Les deux morceaux de la page qu'on éprouve. On échoue fort s'ils sont
   introuvables : une suite qui ne trouve plus ce qu'elle mesure et passe au
   vert est pire qu'une suite absente. */
const vitrine = html.match(/<div class="wrap" id="vitrine">[\s\S]*?\n {2}<\/div>/)?.[0];
const code = html.match(
  /\/\* -+ la vitrine : le direct et les visages[\s\S]*?\n\}\n(?=\n\/\* -+ le hub)/)?.[0];
if (!vitrine) throw new Error('vitrine introuvable dans public/index.html — a-t-elle changé de forme ?');
if (!code) throw new Error('le code de la vitrine est introuvable dans public/index.html');

/** Une journée ordinaire : un match à venir, un terminé, un en cours. */
const JOUR = {
  date: '2026-09-16', total: 5, enDirect: 1, stale: false,
  groupes: [
    { ligue: { id: 61, name: 'Ligue 1', country: 'France', tier: 1 }, matchs: [
      { id: 1, date: '2026-09-16T19:00:00+00:00', status: 'NS', elapsed: null, extra: null,
        luA: Date.now(), live: false, fini: false,
        home: { id: 85, name: 'Paris', logo: 'https://x/85.png', goals: null },
        away: { id: 81, name: 'Marseille', logo: 'https://x/81.png', goals: null } },
      { id: 2, date: '2026-09-16T13:00:00+00:00', status: 'FT', elapsed: 90, extra: null,
        luA: Date.now(), live: false, fini: true,
        home: { id: 80, name: 'Lyon', logo: 'https://x/80.png', goals: 2, vainqueur: true },
        away: { id: 79, name: 'Lille', logo: 'https://x/79.png', goals: 0, vainqueur: false } },
    ] },
    { ligue: { id: 39, name: 'Premier League', country: 'England', tier: 1 }, matchs: [
      { id: 3, date: '2026-09-16T15:30:00+00:00', status: '2H', elapsed: 67, extra: null,
        luA: Date.now(), live: true, fini: false,
        home: { id: 40, name: 'Liverpool', logo: 'https://x/40.png', goals: 1 },
        away: { id: 50, name: 'Man City', logo: 'https://x/50.png', goals: 1 } },
    ] },
  ],
};

/**
 * Une vitrine garnie, avec la réponse du télétexte qu'on lui donne.
 *
 * Les deux bibliothèques de la page sont remplacées par le strict nécessaire :
 * `FZART` pour le répertoire des dessins, `TBF_HORLOGE` pour la minute. Ce
 * sont les deux seules choses que la vitrine leur demande, et les éprouver
 * elles n'est pas le travail de ce fichier.
 */
async function monter(reponse) {
  const dom = new JSDOM(`<body>${vitrine}</body>`, { runScripts: 'outside-only' });
  const w = dom.window;
  w.$ = (id) => w.document.getElementById(id);
  w.esc = (s) => String(s ?? '').replace(/[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  /* 211 dessins, dont 95 jouables : la vitrine ne montre et ne compte que
     les jouables (les séries ouvertes, demande de Gaël du 27 octobre 2026). */
  const illustres = Array.from({ length: 211 }, (_, i) => `TR${i + 1}`);
  w.FZART = {
    ILLUSTRES: new Set(illustres),
    jouables: async () => illustres.slice(0, 95),
    adresse: (id, v) => `/img/fanzzy/${id}${v === 'buste' ? '-buste' : ''}.avif`,
  };
  w.TBF_HORLOGE = { texte: (e) => (e.statut === '2H' ? `${e.minute}'` : '') };
  w.fetch = async () => reponse;
  // Le battement du direct est neutralisé : la suite ne dure pas une minute.
  w.setTimeout = () => 0;
  w.eval(`${code}\nwindow.__garnir = garnirVitrine;`);
  await w.__garnir();
  return w.document;
}

let echecs = 0;
const dit = (bon, quoi) => {
  console.log(`  ${bon ? 'ok  ' : 'KO  '} ${quoi}`);
  if (!bon) echecs++;
};

/* ---------------------------------------------- une journée avec des matchs */
{
  const d = await monter({ ok: true, json: async () => JOUR });
  dit(!d.getElementById('vDirect').hidden, 'le bloc du direct s’ouvre');
  dit(!d.getElementById('vGalerie').hidden, 'la galerie s’ouvre');

  const lignes = [...d.querySelectorAll('#vScores .sc')];
  dit(lignes.length === 3, `trois matchs affichés (${lignes.length})`);
  dit(lignes[0]?.classList.contains('live'), 'le match en direct passe en premier');
  dit(lignes[0]?.querySelector('.quand').textContent === "67'",
    `la minute court (${lignes[0]?.querySelector('.quand').textContent})`);
  dit(lignes[1]?.querySelector('.quand').textContent.includes(':'),
    'le match à venir montre son heure');
  dit(lignes[2]?.querySelector('.quand').textContent === 'FINI',
    'le match terminé vient en dernier');
  dit(lignes[2]?.querySelectorAll('.r')[1].classList.contains('perd'),
    'le perdant est estompé');
  dit(!d.getElementById('vPoint').hidden, 'le point rouge est allumé');
  dit(d.getElementById('vTitre').textContent === '1 match en direct',
    `le titre annonce le direct (${d.getElementById('vTitre').textContent})`);

  const cadres = [...d.querySelectorAll('#vEventail i')];
  dit(cadres.length === 8, `huit visages (${cadres.length})`);
  dit(new Set(cadres.map((c) => c.querySelector('img').getAttribute('src'))).size === 8,
    'huit visages différents');
  dit(/Plus de 90 supporters/.test(d.getElementById('vCombien').textContent),
    `le compte suit la liste des jouables (${d.getElementById('vCombien').textContent})`);
  dit(cadres.every((c) => Number(/TR(\d+)-/.exec(c.querySelector('img').getAttribute('src'))?.[1]) <= 95),
    'les visages ne sont que des jouables');
}

/* -------------------------------------------------- une journée sans direct */
{
  const sansDirect = { ...JOUR, enDirect: 0,
    groupes: JOUR.groupes.map((g) => ({ ...g,
      matchs: g.matchs.map((m) => ({ ...m, live: false, status: m.live ? 'NS' : m.status })) })) };
  const d = await monter({ ok: true, json: async () => sansDirect });
  dit(d.getElementById('vPoint').hidden, 'sans direct, pas de point rouge');
  dit(d.getElementById('vTitre').textContent === '5 matchs aujourd’hui',
    `le titre compte la journée (${d.getElementById('vTitre').textContent})`);
}

/* ------------------------------------------------- le télétexte est éteint */
{
  const d = await monter({ ok: false, json: async () => ({}) });
  dit(d.getElementById('vDirect').hidden, 'télétexte éteint : le bloc reste fermé');
  dit(!d.getElementById('vGalerie').hidden, 'la galerie s’ouvre quand même');
}

/* ---------------------------------------------------- une journée sans match */
{
  const d = await monter({ ok: true, json: async () => ({ groupes: [], total: 0, enDirect: 0 }) });
  dit(d.getElementById('vDirect').hidden, 'aucun match : le bloc reste fermé');
}

/* ------------------------------------------- la vitrine vivante et le PASS

   `vitrine-vivante.js` (Gaël, 3 novembre 2026 : « plus vivante, gaming ; le
   PASS s'ouvre le 1er décembre »). Les animations ne se mesurent pas ici ;
   ce qui se vérifie, c'est ce qu'elles ne doivent pas casser — le nom du jeu
   se lit pareil — et ce qui informe : BIENTÔT et le compte à rebours avant
   l'ouverture, plus rien après, et le but qui allume sa ligne. */
const vivante = readFileSync(path.join(RACINE, 'public', 'vitrine-vivante.js'), 'utf8');
async function vivre(maintenant, annonce) {
  const d = await monter({ ok: true, json: async () => JOUR });
  const w = d.defaultView;
  w.Date.now = () => maintenant;
  w.setInterval = () => 0;
  w.requestAnimationFrame = () => 0;
  w.FZART.prochaine = async () => annonce;
  w.eval(vivante);
  await new Promise((r) => { globalThis.setTimeout(r, 30); });
  return d;
}
{
  const d = await vivre(Date.UTC(2026, 10, 3, 12), { numero: 1, ouvre: '2026-12-01' });
  const p = d.getElementById('vPass');
  dit(d.querySelector('.logo').textContent === 'THEBESTFANLE JEU DES TRIBUNES',
    `le nom du jeu se lit pareil, lettre par lettre (${d.querySelector('.logo').textContent})`);
  dit(!p.querySelector('.vpass-bientot').hidden, 'avant le 1er décembre, le PASS dit BIENTÔT');
  dit(p.querySelector('.vpass-chrono').textContent === 'J-28',
    `et compte les jours (${p.querySelector('.vpass-chrono').textContent})`);
  dit(/1er décembre/.test(p.querySelector('.vpass-texte').textContent),
    `et dit le jour (${p.querySelector('.vpass-texte').textContent})`);
  dit(d.defaultView.TBF_VITRINE_VIVANTE.minuitZurich('2026-12-01') === Date.UTC(2026, 10, 30, 23),
    'le 1er décembre commence à minuit, heure de Zurich');

  const ligne = d.querySelector('#vScores .sc.live');
  const id = ligne.dataset.id;
  const plus = structuredClone(JOUR);
  plus.groupes[1].matchs[0].home.goals = 2;
  d.defaultView.fetch = async () => ({ ok: true, json: async () => plus });
  await d.defaultView.eval('scoresVitrine()');
  await new Promise((r) => { globalThis.setTimeout(r, 30); });
  const apres = d.querySelector(`#vScores .sc[data-id="${id}"]`);
  dit(apres?.classList.contains('vv-allume') && apres.querySelector('.vv-but')?.textContent === 'BUT !',
    'un but en direct allume sa ligne');
}
{
  const d = await vivre(Date.UTC(2026, 11, 2, 12), { numero: 1, ouvre: '2026-12-01' });
  const p = d.getElementById('vPass');
  dit(p.querySelector('.vpass-bientot').hidden && p.querySelector('.vpass-chrono').textContent === '›',
    'une fois ouvert, plus de BIENTÔT ni de compte à rebours');
}
{
  const d = await vivre(Date.UTC(2026, 10, 30, 22, 0, 0), null);
  dit(d.getElementById('vPass').querySelector('.vpass-chrono').textContent === '01:00:00',
    `sans annonce, le 1er décembre ; le dernier jour, les heures (${
      d.getElementById('vPass').querySelector('.vpass-chrono').textContent})`);
}

console.log(echecs
  ? `\n${echecs} contrôle(s) en échec.`
  : '\nLa vitrine se garnit, et se tait quand elle n’a rien à dire.');
process.exit(echecs ? 1 : 0);
