#!/usr/bin/env node
/**
 * Les dix gestes de rythme, joués pour de vrai.
 * ============================================
 *
 * ## Ce qui manquait
 *
 * Les dix-sept gestes du jeu étaient **comptés** — `virage-smoke.mjs` vérifie
 * que la liste attendue couvre `GESTES`, et que chacun a son chant. Les sept
 * épreuves sont **jouées**, une par une, dans un vrai navigateur
 * (`epreuves-ui-smoke.mjs`). Les dix gestes de rythme, eux, n'étaient notés
 * nulle part : seuls `tempo` et `mash` apparaissent dans un contrôle, et
 * seulement pour éprouver l'effet de l'équipement dessus.
 *
 * Huit gestes sur dix pouvaient donc rendre n'importe quoi. Un geste cassé ne
 * lève aucune erreur : il rend une note. Un joueur qui fait exactement ce
 * qu'on lui demande et récolte 0,2 croit qu'il joue mal, et personne ne
 * découvre rien — c'est déjà arrivé ici, avec les Jumelles qui pénalisaient
 * celui qui les portait.
 *
 * ## Ce que « fonctionne » veut dire
 *
 * Deux choses, et les deux sont nécessaires :
 *
 *   1. **Bien jouer paie.** L'exécution exacte de la consigne rend au moins
 *      0,9. Sans ça, le geste est injouable.
 *   2. **Mal jouer ne paie pas.** Une exécution qui rate la consigne — et non
 *      une absence de frappes — rend nettement moins. Sans ça, le geste est
 *      décoratif : on tape n'importe comment et on touche pareil.
 *
 * Le second est le plus important, et le plus facile à perdre : un geste trop
 * indulgent se joue exactement comme un geste absent.
 *
 * ## Pourquoi ces exécutions-là
 *
 * Chaque « raté » est **la faute que le geste existe pour refuser**, pas du
 * bruit. Taper sur le temps au contretemps, refaire le mauvais motif à l'écho,
 * garder un rythme constant au crescendo, dépasser la limite au sang-froid :
 * ce sont les erreurs qu'un joueur commet vraiment, et c'est d'elles que la
 * note doit savoir se distinguer. Des frappes au hasard ne prouveraient rien.
 *
 * ## Sans base ni navigateur
 *
 * `grade` est une fonction pure : des nombres entrent, une note sort. La
 * jouer directement va mille fois plus vite qu'un navigateur, et éprouve
 * exactement ce que le serveur exécute — c'est lui qui note, jamais la page.
 *
 *   node scripts/gestes-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { createContext, Script } from 'node:vm';
import { grade, GESTURES, MOTIFS, instantsDuMotif, instantsDuCrescendo, Cheat, resoudreGeste }
  from '../src/server/ferveur/gestures.js';
import { VERDICTS } from '../src/shared/verdict.js';

let ko = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) ko++; };

/**
 * Un tremblement humain sur un instant.
 *
 * Il n'est pas cosmétique : `sanity` refuse une régularité mécanique — un
 * écart-type de moins de 6 ms sur dix intervalles ou plus. Un « parfait »
 * calculé au millième serait donc rejeté comme un robot, et le contrôle
 * échouerait sur la défense au lieu d'éprouver la note.
 *
 * Déterministe : un générateur semé, pour que deux exécutions de cette suite
 * rendent exactement les mêmes nombres. Un contrôle qui varie d'un lancement à
 * l'autre finit par être relancé jusqu'à ce qu'il passe.
 */
let graine = 20260919;
const alea = () => {
  graine = (graine * 1103515245 + 12345) % 2147483648;
  return graine / 2147483648;
};
const tremble = (t, ampleur = 14) => Math.round(t + (alea() - 0.5) * 2 * ampleur);

/** Une suite d'instants régulièrement espacés, tremblée. */
const suite = (n, pas, depart = 0) =>
  Array.from({ length: n }, (_, i) => tremble(depart + i * pas));

/* ==================================================== les dix exécutions

   `parfait` fait exactement ce que la consigne demande ; `rate` commet la
   faute que ce geste-là existe pour sanctionner. */

const T = GESTURES;

const JEUX = {
  tempo: {
    consigne: 'taper sur chaque pulsation',
    parfait: () => suite(T.tempo.beats, T.tempo.interval),
    rate: () => suite(T.tempo.beats, Math.round(T.tempo.interval * 0.55)),
    faute: 'taper deux fois trop vite',
  },

  mash: {
    consigne: 'taper le plus vite possible',
    parfait: () => suite(T.mash.target, Math.floor(T.mash.ms / T.mash.target)),
    rate: () => suite(5, 400),
    faute: 'ne taper que cinq fois',
  },

  hold: {
    consigne: 'tenir sans lâcher',
    // [appui, relâchement] : une seule tenue, pleine.
    parfait: () => [0, T.hold.need],
    rate: () => [0, 900, 1100, 2000],
    faute: 'lâcher en cours de route',
  },

  contretemps: {
    consigne: 'taper entre les pulsations',
    parfait: () => Array.from({ length: T.contretemps.beats },
      (_, i) => tremble((i + 0.5) * T.contretemps.interval)),
    /* La faute du geste : taper **sur** le temps. C'est ce que le corps veut
       faire, et c'est exactement ce que ce geste refuse. */
    rate: () => suite(T.contretemps.beats, T.contretemps.interval),
    faute: 'taper sur le temps',
  },

  echo: {
    consigne: 'refaire le motif montré',
    parfait: () => instantsDuMotif(MOTIFS[0], T.echo.unite).map((t) => tremble(t)),
    /* Le bon nombre de frappes, le mauvais motif. C'est la faute qui a coûté
       cher ici : la notation accrochait chaque frappe à l'instant le plus
       proche, et un autre motif récoltait 0,8. Elle note dans l'ordre depuis. */
    rate: () => instantsDuMotif(MOTIFS[3], T.echo.unite).map((t) => tremble(t)),
    faute: 'refaire un autre motif',
  },

  crescendo: {
    consigne: 'accélérer régulièrement',
    parfait: () => instantsDuCrescendo(T.crescendo).map((t) => tremble(t)),
    /* Garder un rythme constant : la moyenne des intervalles attendus. Le
       total dure autant, et pourtant ce n'est pas un crescendo. */
    rate: () => suite(T.crescendo.coups,
      Math.round((T.crescendo.debut + T.crescendo.fin) / 2)),
    faute: 'garder un rythme constant',
  },

  relance: {
    consigne: 'tenir, puis lâcher sur la pulsation',
    parfait: () => [0, T.relance.attente],
    rate: () => [0, T.relance.tenirMin - 300],
    faute: 'lâcher avant d’avoir tenu',
  },

  salves: {
    consigne: 'trois rafales séparées par des silences',
    parfait: () => {
      const t = [];
      let h = 0;
      for (let r = 0; r < T.salves.rafales; r++) {
        for (let i = 0; i < T.salves.parRafale; i++) { t.push(tremble(h, 8)); h += 120; }
        h += T.salves.silence - 120;
      }
      return t;
    },
    /* Le même nombre de frappes, d'un seul tenant : c'est du martelage, et le
       geste doit savoir faire la différence. */
    rate: () => suite(T.salves.rafales * T.salves.parRafale, 120),
    faute: 'tout jouer d’un seul tenant',
  },

  tenue: {
    consigne: 'tenir longtemps sans dépasser la limite',
    parfait: () => [0, Math.round(T.tenue.limite * 0.98)],
    /* Dépasser, c'est tout perdre — la seule règle de ce genre dans le jeu. */
    rate: () => [0, T.tenue.limite + 500],
    faute: 'dépasser la limite',
  },

  retenue: {
    consigne: 'exactement le nombre demandé',
    parfait: () => suite(T.retenue.exact, Math.floor(T.retenue.ms / T.retenue.exact)),
    /* Marteler : l'exact contraire de ce qu'on demande, et la tentation
       naturelle de quelqu'un qui vient de faire un martelage. */
    rate: () => suite(T.retenue.maxTaps, Math.floor(T.retenue.ms / T.retenue.maxTaps)),
    faute: 'marteler',
  },
};

const RYTHME = Object.keys(JEUX);

console.log(`\nLes ${RYTHME.length} gestes de rythme, joués`);

/* La liste vient du module, pas d'ici : un geste ajouté sans exécution dans ce
   fichier doit rougir, sinon la couverture se dégrade en silence. */
{
  const connus = Object.keys(GESTURES);
  const sansJeu = connus.filter((g) => !RYTHME.includes(g));
  const inventes = RYTHME.filter((g) => !connus.includes(g));
  check(`chacun des ${connus.length} gestes du module est joué ici`,
    sansJeu.length === 0 && inventes.length === 0
    || (console.log('        jamais joués :', sansJeu.join(', ') || '—'),
      console.log('        inconnus du module :', inventes.join(', ') || '—'), false));
}

for (const nom of RYTHME) {
  const jeu = JEUX[nom];
  let bien = null;
  let mal = null;
  let souci = null;

  try { bien = grade(nom, jeu.parfait()); }
  catch (e) { souci = `parfait refusé : ${e.code ?? e.message}`; }
  try { mal = grade(nom, jeu.rate()); }
  catch (e) { souci = souci ?? `raté refusé : ${e.code ?? e.message}`; }

  if (souci) {
    check(`${nom} — ${jeu.consigne}`, false);
    console.log('        ', souci);
    continue;
  }

  check(`${nom} — ${jeu.consigne} : bien joué paie (${bien.toFixed(2)})`, bien >= 0.9);
  check(`  et ${jeu.faute} ne paie pas (${mal.toFixed(2)})`, mal <= 0.45);
  /* L'écart, et pas seulement les deux bornes : un geste qui rendrait 0,91 et
     0,44 passerait les deux contrôles du dessus tout en étant illisible à
     jouer — on ne sentirait pas la différence. */
  check(`  et l’écart se sent (${(bien - mal).toFixed(2)})`, bien - mal >= 0.45);
}

/* ============================================ les gardes communes

   Elles ne cherchent pas à être malines — elles écartent l'automatisation
   évidente, ce qui suffit tant qu'aucun gain réel n'est en jeu. Mais elles
   doivent exister : sans elles, la note du serveur ne vaut pas mieux que celle
   qu'annoncerait le client. */

console.log('\nLes gardes');

const refuse = (quoi, fn) => {
  try { fn(); return `aucune erreur — ${quoi} est passé`; }
  catch (e) { return e instanceof Cheat ? null : `mauvaise erreur : ${e.message}`; }
};

{
  const r = refuse('un geste inconnu', () => grade('valse', [0, 100]));
  check('un geste que le jeu ne connaît pas est refusé', r === null
    || (console.log('        ', r), false));
}
{
  const r = refuse('deux frappes à 10 ms',
    () => grade('mash', [0, 10, 20, 30, 40, 50]));
  check('deux frappes plus rapprochées qu’un doigt humain sont refusées', r === null
    || (console.log('        ', r), false));
}
{
  const r = refuse('cent frappes', () => grade('mash',
    Array.from({ length: T.mash.maxTaps + 10 }, (_, i) => i * 45)));
  check('plus de frappes que le geste n’en accepte est refusé', r === null
    || (console.log('        ', r), false));
}
{
  /* La régularité de métronome : douze intervalles identiques au millième. Un
     humain n'en est pas capable, une boucle si. */
  const r = refuse('un métronome', () => grade('retenue',
    Array.from({ length: 14 }, (_, i) => i * 280)));
  check('une régularité mécanique est refusée', r === null
    || (console.log('        ', r), false));
}
{
  const r = refuse('une frappe hors de la fenêtre',
    () => grade('tempo', [0, 560, 1120, 99000]));
  check('une frappe très au-delà de la fenêtre est refusée', r === null
    || (console.log('        ', r), false));
}

/* ======================================== ce que l'équipement change

   Le geste doit **répondre** aux modificateurs, sinon l'équipement est
   décoratif. Une fenêtre élargie doit rattraper une exécution approximative
   que la fenêtre normale sanctionne. */

console.log('\nCe que l’équipement change');

{
  const approximatif = Array.from({ length: T.tempo.beats },
    (_, i) => i * T.tempo.interval + 150);
  const nu = grade('tempo', approximatif);
  const large = grade('tempo', approximatif, { tempoWindow: 1.8 });
  check(`une fenêtre élargie rattrape une exécution approximative (${
    nu.toFixed(2)} → ${large.toFixed(2)})`, large > nu + 0.2);
}
{
  /* **Quinze frappes, et non vingt et une.**

     La cible pleine saturait les deux exécutions à 1,00 : le contrôle passait
     sans rien mesurer, ce qui est pire qu'un contrôle absent. En dessous de la
     cible, l'écart se lit — et c'est là que le joueur le sent aussi, puisque
     personne n'atteint la cible à tous les coups.

     Le marché du Tambour de poche : un martelage plus court vise moins de
     frappes, donc le même effort y vaut plus. Voir `mashBonus: 0.94` dans
     `inventaire.js`, qui reprend d'une main ce que `mashTime` donne de
     l'autre. */
  const effort = suite(15, 140);
  const normal = grade('mash', effort);
  const court = grade('mash', effort, { mashTime: -600 });
  check(`un martelage raccourci rend plus pour le même effort (${
    normal.toFixed(2)} → ${court.toFixed(2)})`, court > normal + 0.1);
}
{
  const deuxLachers = [0, 900, 1100, 2400];
  const strict = grade('hold', deuxLachers);
  const indulgent = grade('hold', deuxLachers, { holdForgive: 1 });
  check(`un lâcher pardonné change tout (${strict.toFixed(2)} → ${
    indulgent.toFixed(2)})`, strict === 0 && indulgent > 0);
}

/* ============================================ le lecteur et le verdict

   Le serveur note et nomme ; le lecteur de la page (`public/geste.js`) pose
   le mot qu'on lui sert. Ce qui peut diverger entre les deux se contrôle ici,
   sans navigateur : le lecteur est chargé dans un bac à sable, avec juste
   assez de `window` pour qu'il se déclare — il ne touche à la page qu'au
   moment de jouer, jamais à son chargement. Ce qu'il fait sous le doigt se
   joue dans un vrai navigateur, dans `repetition:ui`. */

console.log('\nLe lecteur de la page et le verdict servi');

const SOURCE_GESTE = readFileSync(new URL('../public/geste.js', import.meta.url), 'utf8');
const SOURCE_SALLE = readFileSync(new URL('../public/repetition.html', import.meta.url), 'utf8');
const FEUILLE = readFileSync(new URL('../public/ui.css', import.meta.url), 'utf8');

const bac = { window: {}, document: { documentElement: { dataset: {} } }, navigator: {} };
bac.window.document = bac.document;
let G = null;
try {
  new Script(SOURCE_GESTE, { filename: 'geste.js' }).runInContext(createContext(bac));
  G = bac.window.TBF_GESTE ?? null;
} catch (e) {
  console.log('        geste.js ne se charge pas :', e.message);
}
check('geste.js se déclare sans page autour (TBF_GESTE)', Boolean(G?.jouer && G?.tamponner && G?.attendre));

if (G) {
  /* **Les quatre mots sont ceux du serveur, dans le même ordre.** Le lecteur
     les recopie (un script de navigateur n'importe rien) : un mot ajouté au
     serveur et pas ici ne s'écrirait jamais — « un mot inconnu ne s'écrit
     pas » —, un mot retiré là-bas resterait affiché ici. */
  const mots = Object.keys(G.MOTS ?? {});
  check(`les mots du lecteur sont ceux du serveur (${mots.join(', ')})`,
    JSON.stringify(mots) === JSON.stringify([...VERDICTS])
    || (console.log('        serveur :', VERDICTS.join(', ')), false));

  const attendus = { parfait: 'PARFAIT', bon: 'BON', moyen: 'MOYEN', rate: 'RATÉ' };
  const ecarts = Object.entries(attendus)
    .filter(([v, m]) => G.mot(v) !== m)
    .map(([v]) => `${v} → ${G.mot(v)}`);
  check('PARFAIT, BON, MOYEN, RATÉ : les quatre mots de l’arène (Q3)', ecarts.length === 0
    || (console.log('        ', ecarts.join(' · ')), false));

  /* **La couleur est à la feuille, une fois.** Le lecteur pose le code servi
     dans `data-verdict` ; chaque code doit y avoir sa teinte, sinon le tampon
     prend celle par défaut — le vert — et un RATÉ s'écrirait en vert. Et le
     lecteur ne garde aucune table de tons à lui : le même BON n'a pas la même
     encre sur le sombre, sur la craie du pavé et sur une carte, et c'est la
     feuille qui sait sur quoi il tombe. */
  const teintes = new Set([...FEUILLE.matchAll(/\[data-verdict=(\w+)\]\s*\{[^}]*--v-clair/g)].map((m) => m[1]));
  const sansTeinte = VERDICTS.filter((v) => !teintes.has(v));
  check('chaque verdict a sa teinte dans ui.css (data-verdict)', sansTeinte.length === 0
    || (console.log('        sans teinte :', sansTeinte.join(', ')), false));
  const codeGeste = SOURCE_GESTE.replace(/\/\*[\s\S]*?\*\//g, ' ');
  check('le lecteur ne garde aucune table de tons (ni data-ton, ni TONS)',
    !/data-ton|dataset\.ton|\bTONS\b/.test(codeGeste) && !('TONS' in G));

  /* Un mot que la table ne connaît pas ne s'écrit pas — y compris les noms
     qu'un objet JavaScript porte de naissance : `MOTS.constructor` est une
     fonction, et un « verdict » de ce nom écrirait son code dans le tampon. */
  const intrus = ['super', '', undefined, null, 'constructor', '__proto__', 'toString', 'PARFAIT']
    .filter((v) => G.mot(v) !== null);
  check('un mot inconnu ne s’écrit pas (même « constructor » ou « PARFAIT » en capitales)',
    intrus.length === 0 || (console.log('        acceptés :', intrus.map(String).join(', ')), false));

  /* **Les quatre gestes qui s'enfoncent** (direction, amendement 9). Un geste
     glissé dans cette liste ferait bouger un pavé que la direction veut
     immobile — le martelage perdrait des images là où la note se joue. */
  const frappe = [...(G.FRAPPE ?? [])].sort();
  check(`seuls tempo, contretemps, écho et crescendo s’enfoncent (${frappe.join(', ')})`,
    JSON.stringify(frappe) === JSON.stringify(['contretemps', 'crescendo', 'echo', 'tempo'])
    && frappe.every((g) => g in GESTURES));

  check(`la fenêtre attend le verdict 600 ms au plus (${G.DELAI_VERDICT})`, G.DELAI_VERDICT === 600);
}

/* ======================================= la pulsation dessinée paie

   Le lecteur dessine la pulsation, le serveur note les frappes : les deux
   doivent parler du même instant. **Ils ne le faisaient pas.** Le tempo et
   le contretemps étaient dessinés un temps trop tard pour la note — un
   joueur qui tapait pile sur chaque pulsation récoltait 0,00, RATÉ, à
   chaque fois —, et l'écho comptait depuis « À TOI » au lieu de la première
   frappe : un motif juste, commencé un temps de réaction plus tard, tombait
   hors de toutes ses fenêtres. Les exécutions « parfaites » plus haut ne le
   voyaient pas : elles partent de zéro, ce que l'écran ne montre pas.

   Ici, la grille du lecteur (`TBF_GESTE.grille`, celle que `jouer` suit
   pour battre l'anneau et compter les frappes) est jouée contre `grade`,
   sur la configuration que le serveur sert, avec et sans équipement : taper
   sur ce qu'on voit doit payer. Le même joueur en navigateur, contre la
   vraie route : `repetition:ui`. */

console.log('\nLa pulsation dessinée et la note du serveur');

if (G?.grille) {
  /* Des modificateurs qui existent : l'intervalle allongé et la fenêtre
     élargie des Jumelles, la fenêtre doublée d'une carte d'action, celle que
     l'adversaire resserre au duel (`src/shared/duel/actions.js`). */
  const MODS = [
    ['sans équipement', {}],
    ['intervalle allongé, fenêtre élargie', { tempoInterval: 70, tempoWindow: 1.5 }],
    ['fenêtre doublée', { tempoWindow: 2 }],
    ['fenêtre resserrée', { tempoWindow: 0.66 }],
  ];
  /* Ce que le joueur rend en tapant sur ce qu'il voit, compté comme le
     lecteur compte : depuis `zero` (la première pulsation, ou l'ouverture),
     ou depuis sa première frappe à l'écho (`zero` nul). */
  const REACTION = 260;
  const rendus = {
    tempo: (gr) => gr.pulsations.map((t) => tremble(t - gr.zero, 10)),
    // Entre deux pulsations, une frappe par intervalle.
    contretemps: (gr) => gr.pulsations.slice(1)
      .map((t, i) => tremble((gr.pulsations[i] + t) / 2 - gr.zero, 10)),
    crescendo: (gr) => gr.pulsations.map((t) => tremble(t - gr.zero, 10)),
    /* Le motif entendu, refait un temps de réaction après « À TOI ». */
    echo: (gr) => {
      const f = gr.pulsations.map((t) => tremble(gr.tour + REACTION + t - gr.pulsations[0], 10));
      return gr.zero === null ? f.map((t) => t - f[0]) : f.map((t) => t - gr.zero);
    },
  };
  const RYTHME = ['tempo', 'contretemps', 'echo', 'crescendo'];

  for (const [nom, mods] of MODS) {
    for (const motif of [0, 3]) {
      const servie = resoudreGeste(mods, { motif });
      const notes = RYTHME.map((k) => {
        const gr = G.grille(k, servie);
        try { return [k, gr ? grade(k, rendus[k](gr), mods, { motif }) : NaN]; }
        catch (e) { return [k, `refusé (${e.code ?? e.message})`]; }
      });
      check(`${nom}, motif ${motif} : taper sur la pulsation dessinée paie (${
        notes.map(([k, q]) => `${k} ${typeof q === 'number' ? q.toFixed(2) : q}`).join(', ')})`,
      notes.every(([, q]) => typeof q === 'number' && q >= 0.9));
    }
  }

  /* **L'erreur d'avant, rejouée** : compter depuis l'ouverture (et depuis
     « À TOI » à l'écho) ne paierait rien. C'est ce qui prouve que le
     contrôle ci-dessus distingue — et ce qui rougirait si le zéro revenait. */
  {
    const s = resoudreGeste({});
    const avant = ['tempo', 'contretemps', 'echo'].map((k) => {
      const gr = G.grille(k, s);
      const comme = k === 'echo'
        ? gr.pulsations.map((t) => tremble(REACTION + t - gr.pulsations[0], 10))
        : rendus[k]({ ...gr, zero: 0 });
      return [k, grade(k, comme)];
    });
    check(`compter depuis l’ouverture, comme avant, ne paierait rien (${
      avant.map(([k, q]) => `${k} ${q.toFixed(2)}`).join(', ')})`, avant.every(([, q]) => q < 0.1));
  }

  /* **Le pavé ne prend rien que le serveur refuserait.** Une frappe plus de
     `AVANCE` avant le zéro fait refuser le geste entier, comme une triche :
     la borne du lecteur doit être celle du serveur, au milliseconde près. */
  {
    const t = GESTURES.tempo;
    const suiteDe = (premiere) => [premiere, ...Array.from({ length: t.beats - 1 },
      (_, i) => tremble((i + 1) * t.interval, 10))];
    let passe = true;
    try { grade('tempo', suiteDe(-G.AVANCE)); } catch { passe = false; }
    let refuse = false;
    try { grade('tempo', suiteDe(-G.AVANCE - 1)); } catch (e) { refuse = e instanceof Cheat; }
    check(`la borne du lecteur est celle du serveur (−${G.AVANCE} passe, −${G.AVANCE + 1} est refusé)`,
      passe && refuse);
    const ouvertures = MODS.flatMap(([, mods]) => ['tempo', 'contretemps', 'crescendo'].map((k) => {
      const gr = G.grille(k, resoudreGeste(mods));
      return { k, ouvert: gr.ouvert, zero: gr.zero };
    }));
    check('le pavé s’ouvre au plus une fenêtre avant le premier temps, jamais plus tôt que la borne',
      ouvertures.every((o) => o.ouvert <= o.zero && o.ouvert >= o.zero - G.AVANCE)
      || (console.log('        ', JSON.stringify(ouvertures)), false));
  }

  /* **Exactement les temps servis**, et la fenêtre ouverte jusqu'après le
     dernier : un temps de plus dessiné après le dernier temps noté (le
     constat du lot 6, sous 420 ms d'intervalle) est un temps sur lequel le
     joueur tape pour rien. */
  {
    const s = resoudreGeste({});
    const n = (k) => G.grille(k, s)?.pulsations.length;
    const finApres = RYTHME.every((k) => {
      const gr = G.grille(k, s);
      return gr.fin > gr.pulsations[gr.pulsations.length - 1] && (gr.tour ?? 0) < gr.fin;
    });
    check(`le tempo bat ses ${s.tempo.beats} temps, le contretemps un de plus (${n('tempo')}, ${n('contretemps')})`,
      n('tempo') === s.tempo.beats && n('contretemps') === s.contretemps.beats + 1 && finApres);
    const vite = G.grille('tempo', { tempo: { interval: 250, beats: 4, window: 120 } });
    check(`à 250 ms d’intervalle aussi, quatre temps pour quatre (${vite?.pulsations.join(', ')})`,
      JSON.stringify(vite?.pulsations) === JSON.stringify([250, 500, 750, 1000]));
  }

  /* **Le crescendo a un temps d'avance, comme le tempo.** Son premier temps
     tombait à l'ouverture même : il ne se voyait pas venir, et coûtait à
     chacun un temps de réaction — deux dixièmes, plus que la fenêtre de
     165 ms —, quoi qu'il fasse. L'ouverture devient le temps zéro, qu'on ne
     frappe pas, et le premier temps vient un intervalle plus tard (le
     premier du crescendo) ; les frappes rendues, comptées depuis lui, ne
     changent pas d'un chiffre. */
  {
    const s = resoudreGeste({});
    const gr = G.grille('crescendo', s);
    const inst = s.crescendo.instants;
    const avance = inst[1] - inst[0];
    check(`le premier temps du crescendo ne tombe plus à l’ouverture : un intervalle d’avance (${
      gr?.pulsations[0]} ms, le zéro à ${gr?.zero}, le pavé ouvert à ${gr?.ouvert})`,
    Boolean(gr) && avance > 0 && gr.zero === avance && gr.pulsations[0] === avance
      && gr.pulsations.every((p, i) => p === inst[i] + avance)
      && gr.ouvert > 0 && gr.ouvert >= gr.zero - G.AVANCE
      && gr.fin === gr.pulsations[gr.pulsations.length - 1] + 600);
  }

  /* **La démonstration de l'écho a un temps d'avance, elle aussi** (phase
     des besoins du lot 6, demandé par `fx`). Elle battait son premier coup
     à l'ouverture : la tribune, qui chante cette grille (`son.js`), le
     trouvait déjà passé d'une latence de sortie, faisait glisser le motif
     derrière son dessin, et le taisait au-delà de 150 ms — un casque sans
     fil. L'avance est le temps le plus court du motif, **le même pour les
     sept motifs** : ils durent tous autant (`MOTIFS`), et doivent le rester
     jusqu'à « À TOI ». La note ne bouge pas : le zéro reste la première
     frappe du joueur (`zero` nul), ce que « taper sur la pulsation dessinée
     paie » éprouve plus haut sur deux motifs. */
  {
    const lus = MOTIFS.map((_, m) => {
      const s = resoudreGeste({}, { motif: m });
      const inst = s.echo.instants;
      const plusCourt = Math.min(...inst.slice(1).map((t, k) => t - inst[k]));
      return { m, inst, plusCourt, gr: G.grille('echo', s) };
    });
    const fautes = lus.filter(({ inst, plusCourt, gr }) => !gr || gr.zero !== null
      || !(plusCourt > 0) || gr.pulsations[0] !== plusCourt
      || !gr.pulsations.every((p, i) => p === inst[i] + plusCourt)
      || gr.tour !== gr.pulsations[gr.pulsations.length - 1] + 700 || gr.ouvert !== gr.tour);
    const avances = new Set(lus.map(({ gr }) => gr?.pulsations[0]));
    const tours = new Set(lus.map(({ gr }) => gr?.tour));
    const fins = new Set(lus.map(({ gr }) => gr?.fin));
    check(`la démonstration de l’écho ne commence plus à l’ouverture : le temps le plus court du motif d’avance (${
      [...avances].join(', ')} ms), le même pour les ${MOTIFS.length} motifs, « À TOI » à ${[...tours].join(', ')}`,
    fautes.length === 0 && avances.size === 1 && tours.size === 1 && fins.size === 1
      || (console.log('        ', JSON.stringify(fautes.map(({ m, gr }) => ({ m, gr })))), false));
  }

  /* **Aucun geste de rythme ne bat à l'ouverture** : c'est le contrat que
     `son.js` tient de cette grille (`TBF_GESTE.grille(…).pulsations`, sa
     seule source pour les instants du chant) — des instants en
     millisecondes depuis l'origine, finis, croissants, et un premier coup
     qui laisse à la tribune le temps de partir. Un premier coup à zéro est
     déjà passé quand le chant démarre : il glisse ou se tait. Sur la
     configuration servie, avec et sans équipement, et sur les sept motifs. */
  {
    const vus = [];
    for (const [, mods] of MODS) {
      for (let m = 0; m < MOTIFS.length; m++) {
        const s = resoudreGeste(mods, { motif: m });
        for (const k of RYTHME) {
          const p = G.grille(k, s)?.pulsations;
          const bon = Array.isArray(p) && p.length > 0 && p[0] > 0
            && p.every((t, i) => Number.isFinite(t) && (i === 0 || t > p[i - 1]));
          if (!bon) vus.push(`${k} motif ${m} : ${JSON.stringify(p)}`);
        }
      }
    }
    check('aucun des quatre gestes chantés ne bat à l’ouverture (des instants finis, croissants, le premier après zéro)',
      vus.length === 0 || (console.log('        ', vus.slice(0, 4).join(' · ')), false));
  }

  /* **La dernière frappe attendue finit le geste** (`grille`, `frappes`) :
     la fenêtre ne tient plus le joueur un temps et demi après son dernier
     coup, et l'attente du verdict part de ce coup-là (« 600 ms après la
     dernière frappe », le brief à la lettre). Ce n'est juste que si le
     serveur ne lit **que** ces frappes : la dernière doit compter, et une de
     plus ne rien changer. Contrôlé sur `grade` lui-même, pour les quatre
     gestes et deux motifs — le jour où la note lirait une frappe de plus,
     finir sur la dernière coûterait des points, et ceci rougirait. */
  {
    for (const motif of [0, 2]) {
      const s = resoudreGeste({}, { motif });
      const attendu = { tempo: s.tempo.beats, contretemps: s.contretemps.beats,
        echo: s.echo.instants.length, crescendo: s.crescendo.instants.length };
      const lus = RYTHME.map((k) => [k, G.grille(k, s)?.frappes]);
      check(`motif ${motif} : le geste finit sur la dernière frappe que le serveur lit (${
        lus.map(([k, n]) => `${k} ${n}`).join(', ')})`,
      lus.every(([k, n]) => n === attendu[k]));
      const notes = RYTHME.map((k) => {
        const gr = G.grille(k, s);
        const juste = rendus[k](gr).slice(0, gr.frappes);
        const note = (taps) => grade(k, taps, {}, { motif });
        return [k, note(juste.slice(0, -1)), note(juste), note([...juste, juste[juste.length - 1] + 300])];
      });
      check(`  la dernière compte, une de plus n’aurait rien changé (${
        notes.map(([k, sans, avec, plus]) => `${k} ${sans.toFixed(2)} → ${avec.toFixed(2)} = ${plus.toFixed(2)}`)
          .join(', ')})`,
      notes.every(([, sans, avec, plus]) => avec > sans && plus === avec));
    }
  }

  /* Sans durées servies lisibles, pas de grille : aucun tempo n'est inventé.
     Le tempo sans intervalle battait toutes les quatre millisecondes et ne
     finissait jamais. Et un geste sans pulsation n'en a pas. */
  check('sans durées servies lisibles, pas de grille (aucun tempo inventé)', [
    G.grille('tempo', {}),
    G.grille('tempo', { tempo: { interval: 'vite', beats: 8 } }),
    G.grille('contretemps', { contretemps: { interval: 620, beats: 0 } }),
    G.grille('echo', { echo: { instants: [] } }),
    G.grille('crescendo', { crescendo: { instants: [0, -5] } }),
    G.grille('mash', resoudreGeste({})),
    G.grille('constructor', { constructor: {} }),
  ].every((x) => x === null));
} else {
  check('le lecteur expose sa grille (TBF_GESTE.grille)', false);
}

/* **Aucun seuil dans les deux fichiers du lecteur.** Le mot vient du serveur
   (`CONTRATS.md` § 16.1) : une comparaison de `quality`, de `note` ou de
   `q` à un nombre écrit en dur, c'est une seconde échelle qui recommence.
   La salle en avait une (0,95 / 0,8 / 0,6 / 0,3) et ses mots à elle ; les
   anciens mots n'ont plus le droit d'y revenir non plus. Le contrôle ne lit
   que le code : les commentaires citent ces nombres pour dire pourquoi ils
   sont partis. */
{
  const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
  const SEUIL = /\b(?:quality|note|q)\b\s*(?:[<>]=?)\s*(?:0?\.\d+|1(?:\.0+)?|[1-9]\d)\b|(?:0?\.\d+|[1-9]\d)\s*(?:[<>]=?)\s*\b(?:quality|note|q)\b/g;
  const fautes = [];
  for (const [nom, src] of [['geste.js', SOURCE_GESTE], ['repetition.html', SOURCE_SALLE]]) {
    for (const m of sansCommentaires(src).matchAll(SEUIL)) fautes.push(`${nom} : « ${m[0]} »`);
    for (const ancien of ['TRÈS BIEN', 'ÇA VIENT', 'À REPRENDRE']) {
      if (sansCommentaires(src).includes(ancien)) fautes.push(`${nom} : l’ancien mot « ${ancien} »`);
    }
    if (/shared\/verdict/.test(sansCommentaires(src))) fautes.push(`${nom} : lit src/shared/verdict.js`);
  }
  check('ni geste.js ni la salle n’écrivent un seuil de verdict', fautes.length === 0
    || (console.log('        ', fautes.join(' · ')), false));
}

console.log(ko ? `\n${ko} échec(s)\n` : '\ntout est vert\n');
process.exitCode = ko ? 1 : 0;
