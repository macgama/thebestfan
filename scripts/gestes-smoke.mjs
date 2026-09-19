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
import { grade, GESTURES, MOTIFS, instantsDuMotif, instantsDuCrescendo, Cheat }
  from '../src/server/ferveur/gestures.js';

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

console.log(ko ? `\n${ko} échec(s)\n` : '\ntout est vert\n');
process.exitCode = ko ? 1 : 0;
