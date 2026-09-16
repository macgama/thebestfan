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
 *   3. **Le compte des visages**, qui se lit sur `FZART.ILLUSTRES` et ne
 *      s'écrit pas à la main. Recopié, il mentirait au premier dessin ajouté.
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
  w.FZART = {
    ILLUSTRES: new Set(Array.from({ length: 211 }, (_, i) => `TR${i + 1}`)),
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
  dit(/Plus de 210 supporters/.test(d.getElementById('vCombien').textContent),
    `le compte suit la liste des dessins (${d.getElementById('vCombien').textContent})`);
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

console.log(echecs
  ? `\n${echecs} contrôle(s) en échec.`
  : '\nLa vitrine se garnit, et se tait quand elle n’a rien à dire.');
process.exit(echecs ? 1 : 0);
