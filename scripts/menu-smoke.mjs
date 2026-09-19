/**
 * Le menu accordéon : le même partout, et complet pour un administrateur.
 *
 * ## Ce que ce contrôle attrape, et que rien d'autre n'attrapait
 *
 * Deux fautes ont vécu longtemps, chacune invisible à la relecture et à toutes
 * les suites existantes.
 *
 *   1. **Deux menus.** `nav.js` en montait un sur les dix-huit pages de
 *      contenu ; l'accueil, qui ne charge pas `nav.js`, s'était écrit le sien
 *      dans son HTML. Ils ont divergé de six entrées — pas de Virage, pas de
 *      duel, pas de boutique, pas de boosters, pas de carnet, pas d'amis
 *      depuis l'accueil — et d'une confirmation de déconnexion présente d'un
 *      côté seulement. Rien ne cassait : les deux s'ouvraient, les deux
 *      menaient quelque part.
 *
 *   2. **L'entrée d'administration disparue.** Elle se posait avec
 *      `nav.appendChild(a)`, sur une variable `nav` qui avait disparu avec la
 *      barre du bas. La référence levait, le `try { } catch { }` du bloc
 *      l'avalait, et **plus aucun administrateur ne voyait l'entrée**. Un
 *      `catch` muet autour d'un ajout facultatif est le meilleur endroit pour
 *      cacher une panne : il n'y a ni erreur, ni trace, ni test qui tombe.
 *
 * On mesure donc la seule chose qui compte : **les liens réellement présents
 * dans le tiroir**, sur l'accueil et sur une page de contenu, pour un compte
 * administrateur et pour un compte qui ne l'est pas. Deux listes comparées, pas
 * deux fichiers relus.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ----------------------------------------------------------- le serveur

   Pas de base : ce contrôle ne regarde que le menu, et le menu ne dépend
   d'aucune donnée de jeu. Les pages interrogent le serveur pour leur propre
   contenu — on répond de quoi les laisser se monter, et rien de plus. */

let estAdmin = false;

const app = express();
app.get('/api/auth/me', (_q, s) => s.json({ user: { pseudo: 'Momo', role: 'joueur' } }));
app.get('/api/admin/suis-je', (_q, s) => s.json({ admin: estAdmin }));
app.get('/api/virage/live', (_q, s) => s.json({ matchs: [] }));
app.get('/api/public/reglages', (_q, s) => s.json({}));
/* Le reste du jeu, en creux. Une page qui demande son contenu et reçoit un
   objet vide se monte quand même ; une page qui reçoit un 404 en HTML tombe
   sur `r.json()` et le contrôle mesurerait alors une page morte. */
app.use('/api', (_q, s) => s.json({}));

for (const [route, fichier] of [['/', 'index.html'], ['/carnet', 'carnet.html'],
  ['/admin', 'admin.html']]) {
  app.get(route, (_q, s) => s.sendFile(path.join(RACINE, 'public', fichier)));
}
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* -------------------------------------------------------------- la page */

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });

/**
 * Ouvre une page, déplie le menu, et rend ce qu'il contient vraiment.
 *
 * On **clique** le bouton plutôt que de lire le HTML du tiroir : c'est le seul
 * moyen de vérifier que le bouton de cette page-là est bien branché. L'accueil
 * et les pages de contenu n'ont pas le même bouton, et c'est exactement le
 * genre d'écart qui se perd dans un refactor.
 */
async function menuDe(chemin) {
  const page = await nav.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 900, height: 900 });
  await page.goto(base + chemin, { waitUntil: 'networkidle0' });

  // Le menu se peuple après la réponse de `/api/admin/suis-je` : l'entrée
  // d'administration arrive une image après les autres.
  const ouvert = await page.evaluate(async () => {
    const b = document.querySelector('.tbf-burger');
    if (!b) return null;
    b.click();
    await new Promise((r) => setTimeout(r, 600));
    const t = document.querySelector('.tbf-tiroir');
    if (!t) return null;
    return {
      visible: t.classList.contains('on') && !t.hidden,
      liens: [...t.querySelectorAll('a')].map((a) => a.getAttribute('href')),
      libelles: [...t.querySelectorAll('a')].map((a) => a.textContent.trim()),
      rubriques: [...t.querySelectorAll('.tbf-rubrique')].map((d) => d.textContent.trim()),
      // La page où l'on est doit se marquer : sans ça le menu propose d'aller
      // là où on est déjà.
      marquee: [...t.querySelectorAll('a.on, .tbf-tiroir-ici.on')]
        .map((a) => a.getAttribute('href')),
    };
  });
  return { page, erreurs, ...(ouvert ?? {}) };
}

/* ------------------------------------- le même menu sur deux pages très
   différentes : l'accueil, qui ne charge pas nav.js, et une page de contenu,
   qui ne charge que lui. */

estAdmin = false;
const accueil = await menuDe('/');
const carnet = await menuDe('/carnet');

check('l’accueil a un menu qui s’ouvre', accueil.visible === true);
check('une page de contenu a un menu qui s’ouvre', carnet.visible === true);

check('les deux mènent exactement aux mêmes endroits',
  JSON.stringify(accueil.liens) === JSON.stringify(carnet.liens)
  || (console.log('    accueil :', accueil.liens),
      console.log('    carnet  :', carnet.liens), false));
check('et les libellés sont les mêmes, mot pour mot',
  JSON.stringify(accueil.libelles) === JSON.stringify(carnet.libelles));
check('les rubriques y sont aussi',
  JSON.stringify(accueil.rubriques) === JSON.stringify(['JOUER', 'MA COLLECTION', 'LE FOOTBALL']));

/* Le menu est la seule navigation du jeu : ce qui n'y est pas n'existe pas.
   La liste est écrite ici en toutes lettres plutôt que relue depuis menu.js —
   un contrôle qui lit sa référence dans le fichier qu'il contrôle est d'accord
   avec lui par construction, et laisserait passer une entrée supprimée. */
const ATTENDUS = ['/', '/virage', '/duel-nvn', '/kop', '/deck', '/boosters', '/boutique',
  '/fanzzy', '/carnet', '/amis', '/matchs', '/equipes', '/teletext', '/classement',
  '/profil', '/compte', '/aide'];
const manquants = ATTENDUS.filter((h) => !accueil.liens.includes(h));
check('toutes les destinations du jeu y sont', manquants.length === 0);
if (manquants.length) console.log('    manquent :', manquants.join(' '));

check('la déconnexion ferme la liste', accueil.liens.at(-1) === '#');
check('la page où l’on est se marque, et elle seule',
  JSON.stringify(carnet.marquee) === JSON.stringify(['/carnet'])
  || (console.log('    marqué :', carnet.marquee), false));

/* ------------------------------------------------ l'entrée d'administration

   Elle est **absente** pour un joueur et **présente** pour un administrateur.
   Les deux moitiés comptent : une entrée toujours affichée ne serait pas une
   panne visible, seulement une fuite d'information. */

check('un joueur ordinaire ne voit pas l’administration',
  !accueil.liens.includes('/admin') && !carnet.liens.includes('/admin'));

estAdmin = true;
const accueilAdmin = await menuDe('/');
const carnetAdmin = await menuDe('/carnet');
const adminPage = await menuDe('/admin');

check('un administrateur la voit depuis l’accueil', accueilAdmin.liens.includes('/admin'));
check('et depuis une page de contenu', carnetAdmin.liens.includes('/admin'));
check('elle se place juste avant la déconnexion',
  accueilAdmin.liens.at(-2) === '/admin');
check('la page d’administration porte le même menu que le reste du jeu',
  adminPage.visible === true
  && JSON.stringify(adminPage.liens) === JSON.stringify(accueilAdmin.liens));

/* ---------------------------------------------- la déconnexion se demande

   Elle se demandait sur l'accueil et pas ailleurs. Une confirmation qui
   n'apparaît que sur certains écrans est pire qu'aucune : on apprend que le
   jeu ne demande pas, et on cesse de lire le jour où il demande. */
for (const [nom, m] of [['l’accueil', accueil], ['une page de contenu', carnet]]) {
  /* Le `try` n'est pas une politesse : sans confirmation, le clic déconnecte
     pour de bon et la page **part** vers l'accueil. Puppeteer lève alors
     « Execution context was destroyed » et la suite s'arrête au milieu, sur
     une pile d'appels qui ne nomme pas le défaut. Une navigation ici *est* le
     défaut, et c'est ainsi qu'on l'écrit. */
  let demande = '';
  try {
    demande = await m.page.evaluate(async () => {
      document.querySelector('.tbf-tiroir .sortie').click();
      await new Promise((r) => setTimeout(r, 400));
      const d = document.querySelector('.tbf-dial, dialog, [role="alertdialog"]');
      return d ? d.textContent.replace(/\s+/g, ' ').trim() : '';
    });
  } catch { demande = '(la page a été quittée sans rien demander)'; }
  check(`la déconnexion demande confirmation depuis ${nom}`,
    /DÉCONNECTER/i.test(demande) || (console.log('    dit :', demande || '(rien)'), false));
}

/* ------------------------------------------------------------ le silence */

const bruit = [accueil, carnet, accueilAdmin, carnetAdmin, adminPage]
  .flatMap((m) => m.erreurs);
check('aucune erreur de script sur aucune des cinq ouvertures', bruit.length === 0);
if (bruit.length) console.log('   ', bruit.slice(0, 4));

await nav.close();
await new Promise((r) => http.close(r));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
// Pas de process.exit : voir le piège documenté dans ETAT.md.
process.exitCode = failures ? 1 : 0;
