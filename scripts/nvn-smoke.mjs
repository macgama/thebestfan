/**
 * Test du moteur NvN.
 * Aucune base, aucun réseau : on donne des intentions, on vérifie les
 * événements. C'est ce qui permet de tester chaque effet un par un.
 */
import { DuelNvN, RULES } from '../src/server/nvn/engine.js';
import { GESTES, GESTURES, MOTIFS, grade, instantsDuMotif }
  from '../src/server/ferveur/gestures.js';
import { ACTION_BY_ID } from '../src/shared/duel/actions.js';
import { BY_ID } from '../src/shared/fanzzy/dex.js';
import { combine } from '../src/shared/fanzzy/inventaire.js';

let failures = 0;

/**
 * Impose le geste d'un joueur, et rend son identifiant.
 *
 * Le duel fait **tourner** le geste d'un chant à l'autre depuis qu'il en
 * compte dix : le client ne le choisit plus, le serveur le donne. Ces
 * contrôles-ci portent sur un geste précis — le tempo, presque toujours — et
 * doivent donc l'imposer au lieu de l'annoncer dans un paramètre que le
 * moteur n'écoute plus. Sans ça, ils noteraient des frappes de tempo contre
 * le geste du moment, et ils échoueraient un chant sur deux.
 */
const impose = (duel, id, geste) => { duel.joueurs.get(id).geste = geste; return id; };
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const jitter = (t, a = 25) => Math.max(0, t + (Math.random() * a * 2 - a));
const tempoParfait = () => Array.from({ length: 8 }, (_, i) => jitter(i * 560, 30));
const tempoRate = () => Array.from({ length: 8 }, (_, i) => jitter(i * 560 + 280, 30));

/** Les âges d'un personnage, comme le catalogue les enchaîne. */
const ages = (id) => {
  const ch = [BY_ID.get(id)];
  while (ch.at(-1)?.evo) ch.push(BY_ID.get(ch.at(-1).evo));
  return ch;
};

/**
 * Le loadout tel que `src/server/deck/index.js` le construit.
 *
 * `debloque` dit jusqu'où le joueur a fait grandir chaque personnage — ce que
 * ses écharpes ont payé. Le duel n'en met jamais que le premier âge en tribune :
 * cette table ne sert qu'à savoir jusqu'où la Relève pourra aller.
 */
function loadout(ids, cartes, stuff = {}, debloque = {}) {
  return {
    fanzzy: ids.map((id) => {
      const lign = ages(id);
      const habiller = (d, i) => ({ id, nom: d.nom, type: d.type, cri: d.cri, stage: i + 1,
        mods: { id, ...combine(d.mods, stuff[id] ?? []) } });
      const jouables = lign.slice(0, Math.min(debloque[id] ?? 1, lign.length)).map(habiller);
      return { ...jouables[0], stuff: stuff[id] ?? [], stade: 1, ages: jouables };
    }),
    actions: cartes.map((c) => ACTION_BY_ID.get(c)),
  };
}

const CARTES = ['a-fumigene','a-torche','a-bache','a-thermos','a-arbitre',
                'a-silence','a-vol','a-craquage','a-remontada','a-mosaique'];

function duel(n = 1, mode = 'entrainement', t = 1_000_000) {
  const eq = (side) => Array.from({ length: n }, (_, i) => ({
    userId: `${side}-${i}`, nom: `J${side}${i}`,
    loadout: loadout(['V1','P1','F1'], CARTES),
  }));
  return new DuelNvN({ id:'d1', equipes:[eq(0), eq(1)], mode, now: t,
    fixture: { id: 7001, elapsed: 20 } });
}

/* ------------------------------------------------------------- bases */

let t = 1_000_000;
let d = duel(1);
let v = d.vue('0-0');
check('main de cinq cartes', v.moi.main.length === 5);
check('trois Fanzzy, un actif', v.moi.fanzzy.length === 3 && v.moi.fanzzy[0].actif);
check('corde au centre', v.rope === 0);

d.joueurs.get('0-0').breath = 100;
const memeGeste = tempoParfait();
let ev = d.chanter(impose(d, '0-0', 'tempo'), { taps: memeGeste }, t);
check('chant noté par le serveur', ev[0].t === 'chant' && ev[0].quality > 0.6);
check('la corde penche du bon côté', d.rope < 0);
check('le souffle est débité', d.vue('0-0').moi.breath < 100);

d.joueurs.get('1-0').breath = 100;
// Le même geste, exactement, pour les deux tribunes.
//
// Le test rejouait `tempoParfait()` une seconde fois. Or cette fonction
// décale chaque frappe de ±30 ms au hasard : les deux chants n'obtenaient
// pas la même note, les deux poussées ne s'annulaient pas, et la corde
// s'écartait parfois de plus de 1. L'échec tombait environ une fois sur dix
// et n'avait rien à voir avec ce que le test vérifie — que la tribune adverse
// pousse bien en sens inverse. À gestes identiques, l'annulation est exacte.
d.chanter(impose(d, '1-0', 'tempo'), { taps: memeGeste }, t);
check('l\u2019adverse pousse dans l\u2019autre sens', Math.abs(d.rope) < 1);

// Souffle rétabli : sinon le refus viendrait du manque de souffle, pas de
// la détection de triche, et le test ne vérifierait rien.
d.joueurs.get('0-0').breath = 100;
// Vingt frappes à 20 ms d'écart : sous le plafond de frappes, mais bien
// au-dessus de ce qu'un doigt humain peut faire.
try {
  d.chanter(impose(d, '0-0', 'tempo'), { taps: Array.from({ length:20 }, (_, i) => i * 20) }, t);
  check('frappes inhumaines rejetées', false);
} catch (e) {
  check(`frappes inhumaines rejetées (${e.code})`, e.code === 'ferveur.error.taps_too_fast');
}

// Et le plafond de frappes, qui est un contrôle distinct.
d.joueurs.get('0-0').breath = 100;
try {
  d.chanter(impose(d, '0-0', 'tempo'), { taps: Array.from({ length:40 }, (_, i) => i * 90) }, t);
  check('plafond de frappes', false);
} catch (e) {
  check('trop de frappes rejeté', e.code === 'ferveur.error.too_many_taps');
}

/* ------------------------------------------------------------ cartes */

d = duel(1); t = 1_000_000;
const j0 = d.joueurs.get('0-0'); const j1 = d.joueurs.get('1-0');
j0.breath = 100; j1.breath = 100; j0.main = [...CARTES.slice(0,5)];

ev = d.jouer('0-0', 'a-fumigene', t);
check('carte jouée sans geste', ev.some((e) => e.t === 'push'));
check('la carte quitte la main', !d.joueurs.get('0-0').main.includes('a-fumigene'));

try { d.jouer('0-0', 'a-fumigene', t); check('carte rejouée refusée', false); }
catch (e) { check('une carte hors de la main est refusée', e.code.includes('card_not_in_hand')); }

j0.main.push('a-fumigene');
try { d.jouer('0-0', 'a-fumigene', t + 1000); check('délai ignoré', false); }
catch (e) { check('délai de réutilisation respecté', e.code.includes('cooldown')); }

/* ---------------------------------------------------------- entraves */

d = duel(1); t = 1_000_000;
d.joueurs.get('0-0').breath = 100; d.joueurs.get('1-0').breath = 100;
d.joueurs.get('0-0').main = ['a-silence','a-vol','a-bache','a-thermos','a-arbitre'];
d.jouer('0-0', 'a-silence', t);
try { d.chanter(impose(d, '1-0', 'tempo'), { taps: tempoParfait() }, t + 500); check('silence sans effet', false); }
catch (e) { check('le silence coupe le chant adverse', e.code.includes('silenced')); }
d.tick(t + 5000);
d.joueurs.get('1-0').breath = 100;
ev = d.chanter(impose(d, '1-0', 'tempo'), { taps: tempoParfait() }, t + 5000);
check('le silence s\u2019arrête bien après 4 s', ev[0].t === 'chant');

const avant = d.joueurs.get('1-0').breath;
d.jouer('0-0', 'a-vol', t + 6000);
check('le vol prend du souffle à l\u2019adversaire', d.joueurs.get('1-0').breath < avant);

/* ------------------------------------------------------------- garde */

d = duel(1); t = 1_000_000;
d.joueurs.get('1-0').breath = 100; d.joueurs.get('0-0').breath = 100;
d.joueurs.get('1-0').main = ['a-bache','a-fumigene','a-thermos','a-arbitre','a-torche'];
d.joueurs.get('0-0').main = ['a-fumigene','a-torche','a-thermos','a-arbitre','a-bache'];
d.jouer('1-0', 'a-bache', t);
const ropeAvant = d.rope;
ev = d.jouer('0-0', 'a-fumigene', t + 100);
check('la bâche absorbe la poussée', ev.some((e) => e.t === 'shield'));
check('la corde bouge peu ou pas', Math.abs(d.rope - ropeAvant) < 5);

/* -------------------------------------------------------- conditions */

d = duel(1); t = 1_000_000;
d.joueurs.get('0-0').breath = 100;
d.joueurs.get('0-0').main = ['a-remontada','a-fumigene','a-thermos','a-arbitre','a-bache'];
try { d.jouer('0-0','a-remontada', t); check('remontada sans être mené', false); }
catch (e) { check('la remontada exige d\u2019être mené', e.code.includes('condition_not_met')); }
d.goals = [0, 1];
ev = d.jouer('0-0','a-remontada', t);
check('remontada jouable une fois mené', ev.some((e) => e.t === 'push'));

/* ------------------------------------------------------- changement */

d = duel(1); t = 1_000_000;
d.joueurs.get('0-0').breath = 100;
d.joueurs.get('0-0').main = ['a-arbitre','a-fumigene','a-thermos','a-bache','a-torche'];
try { d.changer('0-0', 1, t); check('changement sans carte', false); }
catch (e) { check('changer sans carte arbitre est refusé', e.code.includes('no_substitution')); }
d.jouer('0-0','a-arbitre', t);
ev = d.changer('0-0', 1, t + 100);
check('le Fanzzy change', ev[0].t === 'swap' && d.vue('0-0').moi.fanzzy[1].actif);
try { d.changer('0-0', 2, t + 200); check('deuxième changement gratuit', false); }
catch (e) { check('la carte arbitre ne sert qu\u2019une fois', e.code.includes('no_substitution')); }

/* --------------------------------------------------------- collectif */

d = duel(3); t = 1_000_000;
for (const j of d.joueurs.values()) { j.breath = 100; j.main = [...CARTES.slice(0,5)]; }
d.joueurs.get('0-0').main = ['a-mosaique','a-fumigene','a-thermos','a-bache','a-torche'];
ev = d.jouer('0-0','a-mosaique', t);
check('mosaïque seule ne pousse pas', !ev.some((e) => e.t === 'push'));

d.joueurs.get('0-1').dernierChant = t;
d.joueurs.get('0-2').dernierChant = t;
d.joueurs.get('0-0').cooldowns = {};
d.joueurs.get('0-0').main.push('a-mosaique');
d.joueurs.get('0-0').breath = 100;
ev = d.jouer('0-0','a-mosaique', t + 1000);
check('mosaïque compte les coéquipiers qui ont chanté',
  ev.some((e) => e.t === 'effect' && e.mates === 2) && ev.some((e) => e.t === 'push'));

/* ------------------------------------------- le nombre ne décide pas */

const solo = duel(1); const cinq = duel(5);
for (const D of [solo, cinq]) for (const j of D.joueurs.values()) j.breath = 100;
solo.chanter(impose(solo, '0-0', 'tempo'), { taps: tempoParfait() }, t);
for (let i = 0; i < 5; i++) cinq.chanter(impose(cinq, `0-${i}`, 'tempo'), { taps: tempoParfait() }, t);
check('cinq chanteurs ne poussent pas cinq fois plus',
  Math.abs(Math.abs(cinq.rope) - Math.abs(solo.rope)) < Math.abs(solo.rope) * 0.35);

/* ------------------------------------------------------------- fin */

d = duel(1, 'classe'); t = 1_000_000;
d.goals = [2, 0];
d.rope = -RULES.goalAt + 1;
d.joueurs.get('0-0').breath = 100;
ev = d.chanter(impose(d, '0-0', 'tempo'), { taps: tempoParfait() }, t);
check('troisième but : la partie s\u2019arrête', d.termine && d.vainqueur === 0);
check('le duel classé est signalé comme tel',
  ev.some((e) => e.t === 'over' && e.classement === true));

d = duel(1, 'entrainement', t);
ev = d.tick(t + RULES.dureeMs + 10);
check('au temps écoulé, la partie se termine', ev.some((e) => e.t === 'over' && e.raison === 'temps'));
check('un entraînement ne compte pas',
  ev.find((e) => e.t === 'over').classement === false);

/* ------------------------------------------------------------ but réel */

/**
 * Le vrai match déborde sur la corde. Les deux tribunes d'un duel ne sont pas
 * les deux clubs du match — les équipes se forment par ordre d'arrivée — donc
 * ce qui compte est qui suit le club buteur, des deux côtés.
 */
{
  d = duel(2, 'classe', t);
  for (const j of d.joueurs.values()) j.breath = 30;
  const ropeAvant = d.rope;

  // Personne ne suit ce club : le but ne regarde pas ce duel.
  let ev = d.butReel({ teamId: 999 }, new Set(), t);
  check('un but d’un club que personne ne suit ne fait rien',
    ev.length === 0 && d.rope === ropeAvant);
  check('et il ne rend de souffle à personne',
    [...d.joueurs.values()].every((j) => j.breath <= 31));

  // Toute la tribune 0 suit le buteur : la corde penche de son côté.
  ev = d.butReel({ teamId: 85, minute: 37, joueur: 'Baltazar' },
    new Set(['0-0', '0-1']), t);
  const e = ev.find((x) => x.t === 'but_reel');
  check('le but est annoncé', Boolean(e));
  check('il nomme le buteur et la minute', e?.joueur === 'Baltazar' && e?.minute === 37);
  check('il dit combien de supporters de chaque tribune sont concernés',
    e?.souffles?.[0] === 2 && e?.souffles?.[1] === 0);
  check('la corde penche du côté de ceux qui suivent le buteur', d.rope < 0);
  check('ceux qui suivent le club reprennent du souffle',
    d.joueurs.get('0-0').breath > 40 && d.joueurs.get('0-1').breath > 40);
  check('les autres ne reçoivent rien',
    d.joueurs.get('1-0').breath <= 31 && d.joueurs.get('1-1').breath <= 31);

  // Deux tribunes qui exultent en même temps ne se poussent pas.
  d = duel(2, 'classe', t);
  const avant = d.rope;
  ev = d.butReel({ teamId: 85 }, new Set(['0-0', '0-1', '1-0', '1-1']), t);
  check('un club suivi des deux côtés fait tressaillir la corde sans la déplacer',
    d.rope === avant);
  check('mais tout le monde reprend son souffle',
    ev.find((x) => x.t === 'but_reel')?.souffles?.every((n) => n === 2));

  // Le souffle est plafonné : un but n'est pas une réserve infinie.
  d = duel(1, 'classe', t);
  d.joueurs.get('0-0').breath = RULES.breathMax;
  d.butReel({ teamId: 85 }, new Set(['0-0']), t);
  check('le souffle ne dépasse pas son plafond',
    d.joueurs.get('0-0').breath === RULES.breathMax);

  // Un duel terminé ne bouge plus.
  d = duel(1, 'classe', t);
  d.finir(0, 'buts', []);
  check('un duel terminé ignore les buts réels',
    d.butReel({ teamId: 85 }, new Set(['0-0']), t).length === 0);
}


/* ============================================================= la Relève

   Le personnage grandit en pleine partie. C'est la seule carte qui modifie
   durablement celui qui la joue, et elle touche à la promesse d'équité du
   duel : tout le monde entre au premier âge, et ce qu'on a payé en écharpes
   n'achète que le droit de jouer cette carte-là.

   Trois choses doivent tenir, et aucune ne se lit dans le code de la carte :
   que les modificateurs changent vraiment (le moteur relit le Fanzzy actif à
   chaque geste, mais encore faut-il qu'on ait remplacé le bon objet), qu'on ne
   dépasse pas ce qu'on a débloqué, et que rien ne fuie hors du duel.          */
{
  const CARTES_R = ['a-releve','a-releve','a-fumigene','a-torche','a-bache',
                    'a-thermos','a-arbitre','a-silence','a-vol','a-craquage'];
  // V1 → V2 → V3 : le Choriste, le Meneur de chant, le Capo di Curva.
  const chaine = ages('V1');

  const duelR = (debloque) => {
    const eq = (side) => [{ userId: `${side}-0`, nom: `J${side}`,
      loadout: loadout(['V1','P1','F1'], CARTES_R, {}, debloque) }];
    return new DuelNvN({ id:'dR', equipes:[eq(0), eq(1)], mode:'entrainement',
      now: t, fixture: { id: 7001, elapsed: 20 } });
  };

  let dR = duelR({ V1: 3 });
  let j = dR.joueurs.get('0-0');
  j.main.push('a-releve');
  j.breath = 100;

  check('en tribune, le personnage entre à son premier âge',
    j.fanzzy[0].nom === chaine[0].nom && j.fanzzy[0].stade === 1);
  const tempoAvant = j.fanzzy[0].mods.tempoWindow;

  let evR = dR.jouer('0-0', 'a-releve', t);
  check('la Relève annonce le nouvel âge',
    evR.some((x) => x.t === 'evolve' && x.nom === chaine[1].nom && x.stade === 2));
  check('et le Fanzzy en tribune a changé de nom', j.fanzzy[0].nom === chaine[1].nom);
  check('ses modificateurs suivent, sinon la carte ne fait rien de visible',
    j.fanzzy[0].mods.tempoWindow === chaine[1].mods.tempoWindow
    && j.fanzzy[0].mods.tempoWindow !== tempoAvant);
  check('le souffle a été payé', j.breath === 100 - ACTION_BY_ID.get('a-releve').cost);

  // Un cran par carte : le troisième âge demande une seconde Relève, donc un
  // second emplacement dans le deck. C'est là qu'est le vrai coût.
  j.main.push('a-releve');
  j.breath = 100;
  j.cooldowns['a-releve'] = 0;
  evR = dR.jouer('0-0', 'a-releve', t + 40_000);
  check('un second exemplaire mène au troisième âge',
    j.fanzzy[0].stade === 3 && j.fanzzy[0].nom === chaine[2].nom);
  check('et le moteur dit qu’il n’y a plus rien après',
    evR.find((x) => x.t === 'evolve')?.encore === false);

  j.main.push('a-releve');
  j.breath = 100;
  j.cooldowns['a-releve'] = 0;
  try {
    dR.jouer('0-0', 'a-releve', t + 80_000);
    check('au bout de la lignée, la Relève est refusée', false);
  } catch (e) { check('au bout de la lignée, la Relève est refusée',
    e.code.includes('evolution_locked')); }

  /* Celui qui n'a rien payé ne peut pas la jouer — c'est toute la barrière, et
     elle doit porter son propre code : ce n'est pas une tricherie, c'est une
     carte inutile dans cette main, et le joueur doit pouvoir lire pourquoi. */
  const dPauvre = duelR({});
  const p = dPauvre.joueurs.get('0-0');
  p.main.push('a-releve');
  p.breath = 100;
  try {
    dPauvre.jouer('0-0', 'a-releve', t);
    check('sans âge débloqué, la Relève est refusée', false);
  } catch (e) {
    check('sans âge débloqué, la Relève est refusée', e.code.includes('evolution_locked'));
  }
  check('et le souffle n’a pas été prélevé pour rien', p.breath === 100);

  /* La fuite qui ne se verrait qu'au deuxième duel. Le moteur écrit dans les
     objets Fanzzy ; s'il travaillait sur ceux du loadout, un joueur qui
     enchaîne deux parties repartirait avec son personnage déjà grandi, et la
     règle « tout le monde entre au premier âge » tomberait en silence. */
  const partage = loadout(['V1','P1','F1'], CARTES_R, {}, { V1: 3 });
  const eqP = (side) => [{ userId: `${side}-0`, nom: `J${side}`, loadout: partage }];
  const d1 = new DuelNvN({ id:'p1', equipes:[eqP(0), eqP(1)], mode:'entrainement',
    now: t, fixture: { id: 7001, elapsed: 20 } });
  const j1 = d1.joueurs.get('0-0');
  j1.main.push('a-releve'); j1.breath = 100;
  d1.jouer('0-0', 'a-releve', t);
  check('faire grandir un Fanzzy ne sort pas du duel',
    partage.fanzzy[0].nom === chaine[0].nom && partage.fanzzy[0].stade === 1);

  const d2 = new DuelNvN({ id:'p2', equipes:[eqP(0), eqP(1)], mode:'entrainement',
    now: t, fixture: { id: 7001, elapsed: 20 } });
  check('le duel suivant repart bien du premier âge',
    d2.joueurs.get('0-0').fanzzy[0].nom === chaine[0].nom);

  // Ce que voit le joueur : de quoi griser la carte avant de la jouer, plutôt
  // que de la lui laisser jouer pour rien.
  const vue = d2.vue('0-0');
  check('l’état dit le stade en jeu et les âges disponibles',
    vue.moi.fanzzy[0].stade === 1 && vue.moi.fanzzy[0].ages?.length === 3);
  check('et un personnage sans évolution n’en annonce qu’un',
    vue.moi.fanzzy[1].ages?.length === 1);
}

/* ============================ dix gestes, et ils tournent ================

   Le duel proposait **toujours** le même geste : celui du cri du Fanzzy,
   pendant les cinq minutes. Ce n'est pas le nombre de gestes qui rendait le
   jeu répétitif, c'est ça. Ces contrôles portent donc sur la rotation autant
   que sur la notation.
   ===================================================================== */
{
  const solo2 = duel(1);
  const j = solo2.joueurs.get('0-0');
  const sien = j.fanzzy[0]?.cri?.gest ?? 'tempo';

  check('le duel annonce le geste du prochain chant',
    typeof solo2.vue('0-0').moi.geste === 'string');
  check('et il commence par celui du Fanzzy', solo2.vue('0-0').moi.geste === sien);

  /* On enchaîne des chants et on regarde ce que le serveur propose. Le geste
     du joueur doit revenir souvent — c'est sa spécialité, ses modificateurs
     ne paient que là — mais il ne doit pas être le seul. */
  const vus = [];
  for (let i = 0; i < 12; i++) {
    const g = solo2.joueurs.get('0-0').geste;
    vus.push(g);
    solo2.joueurs.get('0-0').breath = 100;
    // Des frappes quelconques : ce qu'on mesure ici, c'est la rotation.
    try { solo2.chanter('0-0', { taps: [0, 200, 500, 900] }, t + i * 100); } catch { /* peu importe */ }
  }
  const distincts = new Set(vus);
  check('le geste change d’un chant à l’autre', distincts.size >= 4);
  if (distincts.size < 4) console.log('        vus :', vus.join(' '));
  check('et celui du Fanzzy revient régulièrement',
    vus.filter((g) => g === sien).length >= 5);
  check('tous les gestes proposés sont connus', vus.every((g) => GESTES.includes(g)));

  /* Le client ne choisit plus son geste. C'est le point : sinon il jouerait
     toujours celui qu'il réussit, et la rotation ne servirait à rien. */
  const avant = solo2.joueurs.get('0-0').geste;
  solo2.joueurs.get('0-0').breath = 100;
  solo2.joueurs.get('0-0').geste = 'tenue';
  const ev = solo2.chanter('0-0', { geste: 'mash', taps: [0, 3000] }, t + 9000);
  check('le geste annoncé par le client est ignoré',
    ev.find((e) => e.t === 'chant') && avant !== null);
  check('c’est le geste du serveur qui est noté',
    solo2.joueurs.get('0-0').chants > 0);
}

/* -------------------------------------------- l'écho, motif après motif */
{
  /* L'écho est le seul geste qui change à chaque chant : c'est lui qui porte
     le plus de rejouabilité. Le serveur dit quel motif jouer, et note contre
     celui-là — sans quoi le joueur choisirait le plus facile. */
  const e = duel(1);
  const j = e.joueurs.get('0-0');

  const motifs = new Set();
  for (let i = 0; i < 7; i++) {
    motifs.add(e.vue('0-0').moi.gestes.echo.motif);
    j.breath = 100;
    j.geste = 'echo';
    e.chanter('0-0', { taps: e.vue('0-0').moi.gestes.echo.instants }, t + i * 50);
  }
  check('le motif de l’écho change d’un chant à l’autre', motifs.size >= 5);

  /* Et tous les motifs valent la même durée : sinon, attendre le plus facile
     serait une tactique. */
  const durees = new Set(MOTIFS.map((m) => m.reduce((a, b) => a + b, 0)));
  check('tous les motifs d’écho ont la même durée', durees.size === 1);

  /* Jouer le motif qu'on a reçu paie ; en jouer un autre, non. */
  j.breath = 100; j.geste = 'echo'; j.motif = 0;
  const bon = e.chanter('0-0', { taps: instantsDuMotif(MOTIFS[0]) }, t + 8000)
    .find((x) => x.t === 'chant')?.quality ?? 0;
  j.breath = 100; j.geste = 'echo'; j.motif = 0;
  const faux = e.chanter('0-0', { taps: instantsDuMotif(MOTIFS[3]) }, t + 9000)
    .find((x) => x.t === 'chant')?.quality ?? 0;
  check('refaire le motif reçu paie', bon > 0.9);
  check('et en refaire un autre paie moins', faux < bon - 0.2);
  if (!(faux < bon - 0.2)) console.log(`        bon ${bon} · faux ${faux}`);
}

/* ------------------------------- les gestes où en faire trop coûte cher */
{
  /* `tenue` est le seul geste du jeu où dépasser fait tout perdre, et
     `retenue` le seul où marteler est puni. Ce sont les deux qui demandent un
     vrai choix, et donc les deux à protéger. */
  check('le sang-froid paie près de la limite',
    grade('tenue', [0, GESTURES.tenue.limite - 150]) > 0.9);
  check('et ne paie plus du tout au-delà',
    grade('tenue', [0, GESTURES.tenue.limite + 50]) === 0);
  check('la mesure paie au nombre exact',
    grade('retenue', Array.from({ length: GESTURES.retenue.exact },
      (_, i) => i * 300 + (i % 4) * 11)) > 0.9);
  check('et marteler ne la paie pas',
    grade('retenue', Array.from({ length: 26 }, (_, i) => i * 150 + (i % 4) * 13)) < 0.2);
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exit(failures ? 1 : 0);
