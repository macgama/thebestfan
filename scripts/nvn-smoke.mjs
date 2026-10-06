/**
 * Test du moteur NvN.
 * Aucune base, aucun réseau : on donne des intentions, on vérifie les
 * événements. C'est ce qui permet de tester chaque effet un par un.
 */
import { DuelNvN, RULES } from '../src/server/nvn/engine.js';
import { GESTES, GESTURES, MOTIFS, grade, instantsDuMotif, applyHeroMods }
  from '../src/server/ferveur/gestures.js';
/* Le verdict du duel est nommé par la couche réseau, pas par le moteur : ses
   fonctions pures s'éprouvent ici, sans base ni socket. */
import { chanterEtNommer, noteMesuree, resumeDuCompte, nouveauCompte, compterChant,
  jouerEtMarquer, vuePour } from '../src/server/nvn/index.js';
import { verdictDe } from '../src/shared/verdict.js';
import { ACTION_BY_ID } from '../src/shared/duel/actions.js';
import { BY_ID } from '../src/shared/fanzzy/dex.js';
import { combine } from '../src/shared/fanzzy/inventaire.js';
import { CHANTS, ORDRE } from '../src/shared/duel/chants.js';

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
/**
 * Fait chanter un joueur **sur un geste précis**, par la carte qui le porte.
 *
 * Le duel n'impose plus le geste : il offre cinq chants, et c'est la carte
 * choisie qui décide. Ces contrôles portent sur un geste précis — le tempo,
 * presque toujours — et doivent donc trouver sa carte.
 *
 * Si le répertoire tiré pour ce duel ne l'offre pas, on l'y met : le contrôle
 * éprouve la mécanique du geste, pas la chance du tirage. La contrainte du
 * répertoire, elle, a son propre contrôle plus bas.
 */
function chante(duel, userId, geste, opts, t) {
  let cardId = duel.repertoire.find((id) => CHANTS[id].gest === geste);
  if (!cardId) {
    cardId = Object.keys(CHANTS).find((id) => CHANTS[id].gest === geste);
    if (!cardId) throw new Error(`aucun chant ne porte le geste « ${geste} »`);
    duel.repertoire[0] = cardId;
  }
  return duel.chanter(userId, { cardId, ...opts }, t);
}
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

/* `id` est un paramètre depuis que le répertoire de chants en découle : deux
   duels du même nom offrent les mêmes cinq chants, et c'est précisément ce
   qu'un contrôle de variété doit pouvoir faire varier. */
function duel(n = 1, mode = 'entrainement', t = 1_000_000, id = 'd1') {
  const eq = (side) => Array.from({ length: n }, (_, i) => ({
    userId: `${side}-${i}`, nom: `J${side}${i}`,
    loadout: loadout(['TR32','MS30','TR33'], CARTES),
  }));
  /* Les deux clubs du match : ils sont devenus les deux tribunes du duel, et
     sans eux le moteur ne sait plus de quel côté pousse un vrai but. */
  return new DuelNvN({ id, equipes:[eq(0), eq(1)], mode, now: t,
    fixture: { id: 7001, elapsed: 20,
               home: { id: 85, name: 'Sion' }, away: { id: 91, name: 'Bâle' } } });
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
let ev = chante(d, '0-0', 'tempo', { taps: memeGeste }, t);
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
chante(d, '1-0', 'tempo', { taps: memeGeste }, t);
check('l\u2019adverse pousse dans l\u2019autre sens', Math.abs(d.rope) < 1);

// Souffle rétabli : sinon le refus viendrait du manque de souffle, pas de
// la détection de triche, et le test ne vérifierait rien.
d.joueurs.get('0-0').breath = 100;
// Vingt frappes à 20 ms d'écart : sous le plafond de frappes, mais bien
// au-dessus de ce qu'un doigt humain peut faire.
try {
  chante(d, '0-0', 'tempo', { taps: Array.from({ length:20 }, (_, i) => i * 20) }, t);
  check('frappes inhumaines rejetées', false);
} catch (e) {
  check(`frappes inhumaines rejetées (${e.code})`, e.code === 'ferveur.error.taps_too_fast');
}

// Et le plafond de frappes, qui est un contrôle distinct.
d.joueurs.get('0-0').breath = 100;
try {
  chante(d, '0-0', 'tempo', { taps: Array.from({ length:40 }, (_, i) => i * 90) }, t);
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
try { chante(d, '1-0', 'tempo', { taps: tempoParfait() }, t + 500); check('silence sans effet', false); }
catch (e) { check('le silence coupe le chant adverse', e.code.includes('silenced')); }
d.tick(t + 5000);
d.joueurs.get('1-0').breath = 100;
ev = chante(d, '1-0', 'tempo', { taps: tempoParfait() }, t + 5000);
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
chante(solo, '0-0', 'tempo', { taps: tempoParfait() }, t);
for (let i = 0; i < 5; i++) chante(cinq, `0-${i}`, 'tempo', { taps: tempoParfait() }, t);
check('cinq chanteurs ne poussent pas cinq fois plus',
  Math.abs(Math.abs(cinq.rope) - Math.abs(solo.rope)) < Math.abs(solo.rope) * 0.35);

/* ------------------------------------------------------------- fin */

d = duel(1, 'classe'); t = 1_000_000;
d.goals = [2, 0];
d.rope = -RULES.goalAt + 1;
d.joueurs.get('0-0').breath = 100;
ev = chante(d, '0-0', 'tempo', { taps: tempoParfait() }, t);
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
 * Le vrai match déborde sur la corde.
 *
 * **Les deux tribunes d'un duel sont les deux clubs du match** depuis que la
 * file se scinde par camp. Un but réel pousse donc du côté de la tribune qui
 * l'a marqué, exactement comme au Grand Virage — et ce qu'on éprouve ici, c'est
 * qu'il ne pousse que là, et du bon côté.
 *
 * Avant, les équipes se formaient par ordre d'arrivée : le moteur regardait qui
 * suivait le club buteur, gens qui pouvaient être des deux côtés, et penchait
 * la corde en proportion. Le contrôle du derby — « deux tribunes qui exultent
 * ne se poussent pas » — n'a plus d'objet : un club est d'un seul côté.
 */
{
  d = duel(2, 'classe', t);
  for (const j of d.joueurs.values()) j.breath = 30;
  const ropeAvant = d.rope;

  // Un club étranger à cette rencontre : le but ne regarde pas ce duel.
  let ev = d.butReel({ teamId: 999 }, t);
  check('un but d’un club étranger au match ne fait rien',
    ev.length === 0 && d.rope === ropeAvant);
  check('et il ne rend de souffle à personne',
    [...d.joueurs.values()].every((j) => j.breath <= 31));

  // Le club de la tribune 0 marque.
  ev = d.butReel({ teamId: 85, minute: 37, joueur: 'Baltazar' }, t);
  const e = ev.find((x) => x.t === 'but_reel');
  check('le but est annoncé', Boolean(e));
  check('il nomme le buteur et la minute', e?.joueur === 'Baltazar' && e?.minute === 37);
  check('il dit quelle tribune il concerne', e?.side === 0 && e?.souffles === 2);
  check('la corde penche du côté du club qui a marqué', d.rope < 0);
  check('sa tribune reprend du souffle',
    d.joueurs.get('0-0').breath > 40 && d.joueurs.get('0-1').breath > 40);
  check('l’autre ne reçoit rien',
    d.joueurs.get('1-0').breath <= 31 && d.joueurs.get('1-1').breath <= 31);

  /* Et de l'autre côté quand c'est l'autre club. Sans ce contrôle, un signe
     inversé passerait inaperçu : la corde bougerait, dans le mauvais sens. */
  d = duel(2, 'classe', t);
  d.butReel({ teamId: 91 }, t);
  check('et elle part de l’autre côté quand l’autre club marque', d.rope > 0);

  // Le souffle est plafonné : un but n'est pas une réserve infinie.
  d = duel(1, 'classe', t);
  d.joueurs.get('0-0').breath = RULES.breathMax;
  d.butReel({ teamId: 85 }, t);
  check('le souffle ne dépasse pas son plafond',
    d.joueurs.get('0-0').breath === RULES.breathMax);

  // Un duel terminé ne bouge plus.
  d = duel(1, 'classe', t);
  d.finir(0, 'buts', []);
  check('un duel terminé ignore les buts réels',
    d.butReel({ teamId: 85 }, t).length === 0);
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
  // TR32 → TR32B → TR32C : le Choriste, le Meneur de chant, le Capo di Curva.
  const chaine = ages('TR32');

  const duelR = (debloque) => {
    const eq = (side) => [{ userId: `${side}-0`, nom: `J${side}`,
      loadout: loadout(['TR32','MS30','TR33'], CARTES_R, {}, debloque) }];
    return new DuelNvN({ id:'dR', equipes:[eq(0), eq(1)], mode:'entrainement',
      now: t, fixture: { id: 7001, elapsed: 20 } });
  };

  let dR = duelR({ TR32: 3 });
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

  /* **La tenue d'en face.** La vue dit, pour chaque joueur, l'âge de son
     personnage en tribune et la tenue que son joueur lui a mise à cet âge
     (`tenues`, lue par `loadout`) : l'arène le dessinait en tenue de base. */
  {
    const dT = duelR({ TR32: 3 });
    dT.joueurs.get('0-0').fanzzy[0].tenues = { 1: 'carnaval', 3: 'retro' };
    const enFace = () => vuePour(dT, '1-0', t).equipes[0][0];
    check(`la vue d’en face porte la tenue de son premier âge (${enFace().skin}, âge ${enFace().stade})`,
      enFace().skin === 'carnaval' && enFace().stade === 1);
    const jT = dT.joueurs.get('0-0');
    jT.fanzzy[0].stade = 2;
    check(`à un âge sans tenue mise, la base (${enFace().skin}, âge ${enFace().stade})`,
      enFace().skin === 'base' && enFace().stade === 2);
    jT.fanzzy[0].stade = 3;
    check(`et la Relève l’habille comme son joueur l’a habillé à cet âge (${enFace().skin})`,
      enFace().skin === 'retro');
    check('un deck sans tenues entre en base',
      vuePour(dT, '0-0', t).equipes[1][0].skin === 'base');
  }

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
  const partage = loadout(['TR32','MS30','TR33'], CARTES_R, {}, { TR32: 3 });
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

/* ==================== cinq chants offerts, et on choisit ================

   Le duel proposait **toujours** le même geste : celui du cri du Fanzzy,
   pendant cinq minutes. On y a répondu par une rotation imposée par le serveur ;
   le Virage, lui, y répondait depuis toujours en offrant cinq chants parmi
   dix-neuf et en laissant choisir.

   Les deux modes ont maintenant la réponse du Virage — c'est la dernière
   différence entre eux qui tombe. Ce qui doit rester vrai n'est donc plus
   « les gestes défilent » mais « il y a un choix, et il est borné ».
   ===================================================================== */
{
  const solo2 = duel(1);

  /* **Cinq chants, et le même répertoire pour les deux camps.** La corde est
     commune ; les moyens de la tirer aussi. Un joueur qui aurait cinq chants
     plus forts que l'autre ne jouerait pas le même jeu. */
  check('le duel offre cinq chants', solo2.repertoire.length === 5);
  check('et l’état les décrit, pas seulement nommés',
    solo2.vue('0-0').chants.length === 5
    && solo2.vue('0-0').chants.every((c) => c.nom && c.gest && c.cost && c.power));

  /* Ils ne portent pas tous le même geste. Cinq chants de tempo rendraient le
     choix décoratif, et on retomberait exactement sur ce qu'on corrige. */
  const gestes = new Set(solo2.vue('0-0').chants.map((c) => c.gest));
  check(`les cinq chants portent des gestes différents (${gestes.size})`,
    gestes.size >= 3
    || (console.log('        gestes :', [...gestes].join(' ')), false));

  /* **Le répertoire est une règle, pas une suggestion de la page.** Sans ce
     refus, un client modifié demanderait le chant le plus rentable des
     dix-neuf à chaque fois, et le tirage du répertoire ne servirait à rien. */
  const dehors = ORDRE.find((id) => !solo2.offreDe(solo2.joueurs.get('0-0')).includes(id));
  let refuse = null;
  try {
    solo2.joueurs.get('0-0').breath = 100;
    solo2.chanter('0-0', { cardId: dehors, taps: tempoParfait() }, t);
  } catch (e) { refuse = e.code; }
  check('un chant hors répertoire est refusé', refuse === 'ferveur.error.chant_hors_repertoire'
    || (console.log('        refus :', refuse), false));

  let inconnu = null;
  try { solo2.chanter('0-0', { cardId: 'pas-un-chant', taps: tempoParfait() }, t); }
  catch (e) { inconnu = e.code; }
  check('et un chant qui n’existe pas aussi', inconnu === 'ferveur.error.unknown_card');

  /* **Son geste.** Le chant de la spécialité du Fanzzy en tribune le dit, avec
     sa famille : c'est ce qui le fait chanter à sa manière dans l'arène. Un
     autre chant ne le dit pas — sinon tout chant ferait bouger le personnage,
     et sa spécialité ne se verrait plus. */
  {
    const d = duel(1, 'entrainement', t, 'sien');
    const fz = d.joueurs.get('0-0').fanzzy[0];
    const sienne = ORDRE.find((id) => CHANTS[id].gest === fz.cri.gest);
    const autre = ORDRE.find((id) => CHANTS[id].gest !== fz.cri.gest);
    d.repertoire[0] = sienne;
    d.repertoire[1] = autre;
    d.joueurs.get('0-0').breath = 100;
    const ev1 = d.chanter('0-0', { cardId: sienne, taps: [] }, t).find((e) => e.t === 'chant');
    d.joueurs.get('0-0').breath = 100;
    const ev2 = d.chanter('0-0', { cardId: autre, taps: [] }, t + 20_000).find((e) => e.t === 'chant');
    check(`le chant de son geste le dit, avec sa famille (${fz.cri.gest}, ${fz.type})`,
      ev1?.sien === true && ev1.famille === fz.type);
    check('un autre chant ne le dit pas', ev2 && !('sien' in ev2) && !('famille' in ev2));
  }

  /* **Son chant est toujours dans sa main, au milieu.** Le répertoire tire cinq
     chants sur vingt-six : sans cette place, le geste du Fanzzy n'y tombait
     qu'une fois sur cinq. La main reste de cinq cartes, et elle suit le Fanzzy
     en tribune. */
  {
    let toujours = true, cinq = true, milieu = true, remplace = 0, refuse = true;
    for (let k = 0; k < 40; k++) {
      const d = duel(1, 'entrainement', t, `offre-${k}`);
      const j = d.joueurs.get('0-0');
      const geste = j.fanzzy[j.actif].cri.gest;
      const main = d.vue('0-0').chants;
      cinq &&= main.length === 5 && new Set(main.map((c) => c.id)).size === 5;
      toujours &&= main.some((c) => c.gest === geste);
      milieu &&= main[2]?.gest === geste;
      if (!d.repertoire.some((id) => CHANTS[id].gest === geste)) {
        remplace++;
        // Le chant commun qui lui a laissé sa place n'est plus dans sa main.
        const parti = d.repertoire.find((id) => !main.some((c) => c.id === id));
        j.breath = 100;
        try { d.chanter('0-0', { cardId: parti, taps: [] }, t); refuse = false; } catch { /* refusé */ }
      }
    }
    check('le chant de son Fanzzy est toujours dans sa main', toujours);
    check('qui reste de cinq cartes, sans doublon', cinq);
    check('et il y tient la place du milieu', milieu);
    check(`quand le tirage ne l'offrait pas, il prend une place, et celle-ci n'est plus jouable (${remplace} fois sur 40)`,
      remplace > 0 && refuse);

    // Il suit le Fanzzy en tribune.
    const d = duel(1, 'entrainement', t, 'offre-suit');
    const j = d.joueurs.get('0-0');
    const autre = j.fanzzy.findIndex((f) => f.cri.gest !== j.fanzzy[0].cri.gest);
    if (autre > 0) {
      j.actif = autre;
      check(`et il suit le Fanzzy en tribune (${j.fanzzy[autre].cri.gest})`,
        d.vue('0-0').chants[2].gest === j.fanzzy[autre].cri.gest);
    }
  }

  /* **Le coût et la poussée viennent de la carte.** C'est toute la décision
     qu'on vient d'ajouter : un gros chant coûte plus de souffle et rend plus.
     Tant que les deux étaient constants, choisir ne changeait rien. */
  {
    /* Les deux chants de tempo : même geste, prix du simple au double. On les
       pose dans le répertoire plutôt que de prendre le moins cher et le plus
       cher au hasard — ceux-là auraient des gestes différents, et l'on
       mesurerait alors la capacité du contrôle à exécuter quinze gestes au lieu
       de mesurer un prix. */
    const tempos = ORDRE.filter((id) => CHANTS[id].gest === 'tempo')
      .sort((a, b) => CHANTS[a].cost - CHANTS[b].cost);
    const [petit, gros] = [tempos[0], tempos[tempos.length - 1]];
    solo2.repertoire[0] = petit;
    solo2.repertoire[1] = gros;

    check(`deux chants du même geste n'ont pas le même prix (${CHANTS[petit].cost} et ${CHANTS[gros].cost})`,
      CHANTS[petit].cost !== CHANTS[gros].cost);

    const j = solo2.joueurs.get('0-0');
    j.breath = 100;
    solo2.chanter('0-0', { cardId: petit, taps: tempoParfait() }, t + 20_000);
    const coutPetit = 100 - j.breath;
    j.breath = 100;
    solo2.chanter('0-0', { cardId: gros, taps: tempoParfait() }, t + 40_000);
    const coutGros = 100 - j.breath;
    check(`le gros chant coûte plus que le petit (${coutPetit} contre ${coutGros})`,
      coutGros > coutPetit);

    /* Et il pousse plus. Sans ça, le prix serait une punition et personne ne
       choisirait jamais le gros chant. */
    const corde = (id) => {
      const d = duel(1);
      d.repertoire[0] = id;
      d.joueurs.get('0-0').breath = 100;
      d.chanter('0-0', { cardId: id, taps: tempoParfait() }, t);
      return Math.abs(d.rope);
    };
    const poussePetit = corde(petit);
    const pousseGros = corde(gros);
    check(`et il pousse plus fort (${Math.round(poussePetit)} contre ${Math.round(pousseGros)})`,
      pousseGros > poussePetit);
  }

  /* Le geste noté est **celui de la carte**, et non celui du Fanzzy : c'est ce
     qui fait qu'on découvre un geste en choisissant un chant. */
  {
    /* On donne au Fanzzy un geste de martelage et on lui fait chanter un chant
       de tempo. Si la notation suivait encore le personnage, des frappes de
       tempo seraient jugées au martelage et la note s'effondrerait — c'est
       exactement la faute que la rotation avait déjà value au Virage. */
    const solo3 = duel(1);
    const j3 = solo3.joueurs.get('0-0');
    j3.fanzzy[0].cri = { ...j3.fanzzy[0].cri, gest: 'mash' };
    const chantTempo = ORDRE.find((id) => CHANTS[id].gest === 'tempo');
    solo3.repertoire[0] = chantTempo;

    j3.breath = 100;
    const ev = solo3.chanter('0-0', { cardId: chantTempo, taps: tempoParfait() }, t);
    const chant = ev.find((e) => e.t === 'chant');
    check(`le geste noté est celui de la carte, pas du Fanzzy (${chant?.geste})`,
      chant?.geste === 'tempo');
    check('et l’événement dit quelle carte a été chantée', chant?.cardId === chantTempo);
    /* La note le prouve : des frappes de tempo jugées au martelage vaudraient
       zéro, et la corde n'aurait pas bougé. */
    check(`et la note est celle d’un tempo réussi (${chant?.quality})`,
      (chant?.quality ?? 0) > 0.5);
  }

  /* Deux duels différents n'offrent pas les mêmes cinq chants : c'est ce qui
     remplace la rotation. On rencontre les dix-sept gestes en jouant plusieurs
     parties, au lieu de les voir tous défiler dans une seule. */
  {
    const vus = new Set();
    for (let k = 0; k < 12; k++) {
      /* Douze duels aux identifiants différents — c'est le moteur qui tire leur
         répertoire, pas le contrôle : le recalculer ici reviendrait à vérifier
         que le contrôle est d'accord avec lui-même. */
      const d3 = duel(1, 'entrainement', t, `rep-${k}`);
      for (const id of d3.repertoire) vus.add(CHANTS[id].gest);
    }
    check(`douze duels font rencontrer ${vus.size} gestes différents`, vus.size >= 8
      || (console.log('        vus :', [...vus].join(' ')), false));
  }
}

/* -------------------------------------------- l'écho, motif après motif */
{
  /* L'écho est le seul geste qui change à chaque chant : c'est lui qui porte
     le plus de rejouabilité. Le serveur dit quel motif jouer, et note contre
     celui-là — sans quoi le joueur choisirait le plus facile. */
  const e = duel(1);
  const j = e.joueurs.get('0-0');

  /* Le répons est le chant d'écho : on le pose dans le répertoire plutôt que
     d'écrire `j.geste`, qui n'existe plus depuis que le geste vient de la
     carte choisie. */
  const repons = ORDRE.find((id) => CHANTS[id].gest === 'echo');
  e.repertoire[0] = repons;

  const motifs = new Set();
  for (let i = 0; i < 7; i++) {
    motifs.add(e.vue('0-0').moi.gestes.echo.motif);
    j.breath = 100;
    e.chanter('0-0', { cardId: repons, taps: e.vue('0-0').moi.gestes.echo.instants },
      t + i * 50);
  }
  check('le motif de l’écho change d’un chant à l’autre', motifs.size >= 5);

  /* Et tous les motifs valent la même durée : sinon, attendre le plus facile
     serait une tactique. */
  const durees = new Set(MOTIFS.map((m) => m.reduce((a, b) => a + b, 0)));
  check('tous les motifs d’écho ont la même durée', durees.size === 1);

  /* Jouer le motif qu'on a reçu paie ; en jouer un autre, non. */
  j.breath = 100; j.motif = 0;
  const bon = e.chanter('0-0', { cardId: repons, taps: instantsDuMotif(MOTIFS[0]) }, t + 8000)
    .find((x) => x.t === 'chant')?.quality ?? 0;
  j.breath = 100; j.motif = 0;
  const faux = e.chanter('0-0', { cardId: repons, taps: instantsDuMotif(MOTIFS[3]) }, t + 9000)
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

/* ------------------------------------------------------ on peut marquer

 * Le seul contrôle qui dise que le jeu se joue.
 *
 * Toutes les autres éprouvent des mécaniques — le souffle se débite, un geste
 * raté ne pousse pas, un bouclier absorbe. Aucune ne vérifiait qu'une partie
 * **produise un but**, et elle n'en produisait plus : cinq minutes de duel se
 * terminaient sur un nul, et les vingt-six contrôles du duel étaient verts.
 *
 * ## Pourquoi deux joueurs et non un seul
 *
 * Ma première version jouait en solo, et elle ne mordait pas : même avec
 * l'ancien équilibrage, un joueur que personne ne contre finit toujours par
 * marquer. Le défaut n'existe qu'**avec quelqu'un en face** — deux camps qui
 * poussent, la décroissance par-dessus, et la corde qui ne quitte jamais zéro.
 *
 * C'est la situation que le joueur vit, donc c'est celle qu'on joue : un joueur
 * appliqué, un chant toutes les cinq secondes ; en face, la cadence et
 * l'adresse du bot d'entraînement.
 */
{
  const d = duel(1, 'classe');
  let t0 = t;
  let buts = 0;
  let prochainBot = 0;

  /* Le geste de tempo demande quatre secondes et demie à exécuter : cinq
     secondes entre deux chants est ce qu'un humain appliqué peut tenir, pas un
     rythme optimiste. */
  for (let k = 0; k < 60; k++) {
    t0 += 6000;
    d.tick(t0);

    try {
      const ev = chante(d, '0-0', 'tempo', { taps: tempoParfait() }, t0);
      buts += ev.filter((e) => e.t === 'goal').length;
    } catch { /* souffle insuffisant : il attend */ }

    /* En face, la cadence et l'adresse du bot : un chant toutes les huit
       secondes et demie, à ±150 ms près. */
    if (t0 >= prochainBot) {
      prochainBot = t0 + 8500;
      try {
        chante(d, '1-0', 'tempo', {
          taps: Array.from({ length: 8 }, (_, i) => jitter(i * 560, 150)),
        }, t0);
      } catch { /* pareil */ }
    }
  }

  check(`un joueur ordinaire marque contre le rythme d un bot (${buts} but(s) en 5 min)`,
    buts >= 1
    || (console.log('        la corde n’a jamais atteint le but : c’est le nul '
      + 'systématique qu’on cherche à empêcher'), false));

  /* Et pas trop : un but toutes les dix secondes ferait un score de tennis, et
     la corde n'aurait plus aucun sens. */
  check('sans que le duel tourne au score de tennis', buts <= 12
    || (console.log('        ', buts, 'buts en cinq minutes'), false));
}

/* ============================================== un deck qui ne fond pas

   **Jouer un exemplaire faisait disparaître les autres.** La main retirait
   toutes les cartes du même nom, et une seule partait à la défausse. Le deck
   d'un débutant — peu de cartes, donc des doublons — perdait trois cartes sur
   dix en quatre coups, et les joueurs voyaient leurs cartes « ne jamais
   revenir ». On joue donc un deck plein de doublons bien au-delà d'un tour de
   pioche, et l'on compte ce qui circule. */
{
  const DOUBLONS = ['a-fumigene', 'a-fumigene', 'a-fumigene', 'a-torche', 'a-torche',
    'a-torche', 'a-bache', 'a-bache', 'a-thermos', 'a-thermos'];
  let tD = 3_000_000;
  const eqD = (side) => [{ userId: `${side}-0`, nom: `J${side}`,
    loadout: loadout(['TR32', 'MS30', 'TR33'], DOUBLONS) }];
  const dD = new DuelNvN({ id: 'dD', equipes: [eqD(0), eqD(1)], mode: 'entrainement',
    now: tD, fixture: { id: 7001, elapsed: 20 } });
  const jD = dD.joueurs.get('0-0');
  const circule = () => jD.main.length + jD.pioche.length + jD.defausse.length;
  let minimum = circule();
  for (let k = 0; k < 14; k++) {
    jD.breath = 100;
    jD.cooldowns = {};
    dD.jouer('0-0', jD.main[0], tD);
    minimum = Math.min(minimum, circule());
    tD += RULES.refillMs + 100;
    dD.tick(tD);
  }
  check(`un deck à doublons garde ses ${DOUBLONS.length} cartes en circulation (au plus bas : ${minimum})`,
    minimum === DOUBLONS.length);
  check('et la main se remplit de nouveau', jD.main.length >= RULES.mainVisible - 1
    || (console.log('        main :', jD.main.length), false));
}

/* ============================================== le retour de flamme

   Un Fanzzy à `backfire` qui rate son geste pousse **pour l'adversaire**. La
   page du duel ne l'écrivait nulle part : elle lisait le drapeau du chant pour
   jouer un son, et la poussée offerte s'affichait comme une poussée adverse
   ordinaire — alors que le son ne porte jamais seul une information (chantier
   du son, 2 octobre 2026). Pour l'écrire, elle n'a besoin de rien de neuf :
   le chant porte `backfire`, et la poussée qui le suit garde l'identifiant du
   chanteur sous le camp d'en face. C'est la seule poussée dont l'auteur n'est
   pas du camp qu'elle sert. Ces contrôles épinglent cette forme : si le moteur
   rattachait un jour cette poussée à un autre joueur, ou au camp du chanteur,
   la page retomberait sans bruit dans la poussée adverse ordinaire. */
{
  const tR = 4_000_000;
  /* Un duel neuf par chant : le motif tourne d'un chant à l'autre, et l'on
     éprouve le retour de flamme, pas la notation du motif suivant. */
  const chanteur = (frappes) => {
    const dR = duel(1, 'entrainement', tR, 'dR');
    /* Sans lieu : un stade qui élargit la fenêtre du tempo ou décale sa
       pulsation rend un geste « raté » passable, et le contrôle mesurerait
       alors le stade tiré, pas le retour de flamme. */
    dR.stade = null;
    const jR = dR.joueurs.get('0-0');
    jR.breath = 100;
    /* Le drapeau est posé à la main plutôt que pris au catalogue : ce qui est
       éprouvé est la forme des événements, pas le personnage qui le porte
       cette saison. */
    jR.fanzzy[jR.actif].mods = { ...jR.fanzzy[jR.actif].mods, backfire: true };
    const ferveur = jR.ferveur;
    const ev = chante(dR, '0-0', 'tempo', { taps: frappes() }, tR);
    return { dR, jR, ev, ferveur,
      chant: ev.find((e) => e.t === 'chant'), poussee: ev.find((e) => e.t === 'push') };
  };

  const rate = chanteur(tempoRate);
  check('un geste raté sous retour de flamme est marqué au chant',
    rate.chant?.backfire === true && rate.chant.userId === '0-0' && rate.chant.side === 0
    || (console.log('        chant :', JSON.stringify(rate.chant)), false));
  check('la poussée qui suit garde le chanteur, sous le camp d’en face',
    rate.poussee?.userId === '0-0' && rate.poussee.side === 1 && rate.poussee.valeur > 0
    && rate.ev.indexOf(rate.poussee) > rate.ev.indexOf(rate.chant)
    || (console.log('        événements :', JSON.stringify(rate.ev)), false));
  check('la corde penche vers l’adversaire', rate.dR.rope > 0);
  check('et le chanteur n’en tire aucune ferveur', rate.jR.ferveur === rate.ferveur);

  /* Le même Fanzzy, geste réussi : pas de drapeau, et sa poussée sert son
     propre camp. C'est ce contraste qui rend sûre la règle de la page —
     « une poussée dont l'auteur est d'en face est un retour de flamme ». */
  const reussi = chanteur(tempoParfait);
  check('réussi, le même chant ne porte pas le drapeau et pousse pour son camp',
    reussi.chant?.backfire === false
    && reussi.poussee?.userId === '0-0' && reussi.poussee.side === 0
    || (console.log('        événements :', JSON.stringify(reussi.ev)), false));
}

/* ===================================================== le verdict, au duel

   CONTRATS.md § 17 : chaque évènement `chant` porte `verdict`, mesuré comme au
   § 16.1 — sur la note **avant** les modificateurs du Fanzzy, relevée par le
   plancher du « Second souffle » quand il mord. Le moteur ne sert que la note
   finale, et il ne bouge pas : c'est `nvn/index.js` qui rejoue la note mesurée
   juste avant lui (`chanterEtNommer`) et tient le compte du bilan.

   Les notes se règlent à la milliseconde sur la tenue et le maintien, dont la
   note est une simple proportion (tenu ÷ limite) : 3 990 ms sur 4 200 font
   0,95. Le lieu et les modificateurs des Fanzzy sont retirés, sauf là où un
   contrôle les pose. */
{
  const tV = 5_000_000;
  const tenue = (part) => [0, Math.round(GESTURES.tenue.limite * part)];
  const maintien = (part) => [0, Math.round(GESTURES.hold.need * part)];
  const nu = (id) => {
    const dV = duel(1, 'entrainement', tV, id);
    dV.stade = null;
    for (const j of dV.joueurs.values()) for (const f of j.fanzzy) f.mods = { id: f.id };
    dV.repertoire = ['tenir', 'onetaitla', 'reprise', 'montee', 'cadence'];
    return dV;
  };
  /* Un chant par le chemin du serveur. Le souffle est rempli avant : un refus
     éventuel doit venir du geste, jamais de l'économie. */
  let pas = 0;
  const chanteV = (dV, comptes, uid, cardId, taps) => {
    dV.joueurs.get(uid).breath = 100;
    pas += 1000;
    return chanterEtNommer(dV, comptes, uid, { cardId, taps }, tV + pas)
      .find((e) => e.t === 'chant');
  };

  /* Le moteur seul ne nomme rien. Le jour où il le ferait, le mot aurait deux
     auteurs — et `engine.js` doit rester tel qu'il est (SERVEUR-VAGUE2 § 12). */
  {
    const dV = nu('dV0');
    dV.joueurs.get('0-0').breath = 100;
    const brut = dV.chanter('0-0', { cardId: 'tenir', taps: tenue(0.95) }, tV)
      .find((e) => e.t === 'chant');
    check('le moteur ne nomme pas le verdict : c’est la couche réseau',
      Boolean(brut) && !('verdict' in brut)
      || (console.log('        chant :', JSON.stringify(brut)), false));
  }

  /* 0,95, 0,97, 0,6, puis 0,96 : trois PARFAITS, une série de deux que le
     MOYEN a coupée, et le meilleur geste sur le 0,97 — pas sur le dernier. */
  {
    const dV = nu('dV1');
    const comptes = new Map();
    const vus = [
      chanteV(dV, comptes, '0-0', 'tenir', tenue(0.95)),
      chanteV(dV, comptes, '0-0', 'onetaitla', maintien(0.97)),
      chanteV(dV, comptes, '0-0', 'tenir', tenue(0.6)),
      chanteV(dV, comptes, '0-0', 'tenir', tenue(0.96)),
    ];
    const mots = vus.map((c) => c?.verdict).join(', ');
    check(`chaque chant porte son mot (${mots})`, mots === 'parfait, parfait, moyen, parfait');
    const r = resumeDuCompte(comptes.get('0-0'));
    check(`trois PARFAITS au bilan (${r.parfaits})`, r.parfaits === 3);
    check(`la meilleure série est de deux : le MOYEN l’a remise à zéro (${r.serie})`,
      r.serie === 2);
    check('le meilleur geste est le 0,97, sur son chant et sous son nom',
      r.meilleur?.chant === 'onetaitla' && r.meilleur?.nom === CHANTS.onetaitla.nom
      && r.meilleur?.verdict === 'parfait'
      || (console.log('        meilleur :', JSON.stringify(r.meilleur)), false));
  }

  /* Les bornes, au duel : « au-dessus de », strictement (§ 16.1). 3 780 ms sur
     4 200 font 0,9 tout juste, qui est BON. */
  {
    const dV = nu('dV2');
    const comptes = new Map();
    const bornes = [[3780, 'bon'], [3781, 'parfait'], [2940, 'moyen'], [2941, 'bon'],
      [1680, 'rate'], [1681, 'moyen']];
    const lus = bornes.map(([ms]) => chanteV(dV, comptes, '0-0', 'tenir', [0, ms])?.verdict);
    check(`aux bornes exactes, le mot de l’échelle unique (${lus.join(', ')})`,
      lus.join() === bornes.map((b) => b[1]).join());
  }

  /* **D7 au duel.** Un Fanzzy qui paie mal le parfait fait d'un 0,95 un 0,779 ;
     mesuré sur la note finale, le PARFAIT que le moteur vient de récompenser
     s'écrirait BON. Puis la même chose venue d'en face : « Rouille ». */
  {
    const dV = nu('dV3');
    const comptes = new Map();
    dV.joueurs.get('0-0').fanzzy[0].mods = { id: 'TR32', perfectBonus: 0.82 };
    const c = chanteV(dV, comptes, '0-0', 'tenir', tenue(0.95));
    check(`un Fanzzy qui paie mal le parfait ne change pas le mot (${c?.quality} reste PARFAIT)`,
      c?.quality < 0.9 && c?.verdict === 'parfait'
      || (console.log('        chant :', JSON.stringify(c)), false));
    check('et ce PARFAIT compte au bilan', resumeDuCompte(comptes.get('0-0')).parfaits === 1);

    const j1 = dV.joueurs.get('1-0');
    j1.breath = 100;
    j1.main.push('a-rp-rouille');
    pas += 1000;
    dV.jouer('1-0', 'a-rp-rouille', tV + pas);
    const sous = chanteV(dV, comptes, '0-0', 'tenir', tenue(0.95));
    check(`sous la Rouille d’en face non plus (${sous?.quality} reste PARFAIT)`,
      sous?.quality < 0.6 && sous?.verdict === 'parfait'
      || (console.log('        chant :', JSON.stringify(sous)), false));
  }

  /* Le plancher du « Second souffle » : il relève un raté en MOYEN, une fois,
     et ne mord pas sur un bon geste — sa charge reste alors pour le suivant. */
  {
    const dV = nu('dV4');
    const comptes = new Map();
    const j = dV.joueurs.get('0-0');
    j.breath = 100;
    j.main.push('a-secondsouffle');
    pas += 1000;
    dV.jouer('0-0', 'a-secondsouffle', tV + pas);
    const bien = chanteV(dV, comptes, '0-0', 'tenir', tenue(0.95));
    const sauve = chanteV(dV, comptes, '0-0', 'tenir', tenue(0.2));
    const rate = chanteV(dV, comptes, '0-0', 'tenir', tenue(0.2));
    check('le plancher ne mord pas sur un bon geste', bien?.verdict === 'parfait');
    check(`un raté relevé par le plancher se dit MOYEN (${sauve?.quality})`,
      sauve?.quality === 0.5 && sauve?.verdict === 'moyen'
      || (console.log('        chant :', JSON.stringify(sauve)), false));
    check('la charge partie, le raté suivant est RATÉ', rate?.verdict === 'rate');
  }

  /* Ce que le bilan dit d'un joueur qui n'a pas chanté, ou d'un seul PARFAIT :
     `parfaits` toujours, `serie` à partir de deux, `meilleur` dès un chant. */
  check('sans chant : zéro PARFAIT, ni série ni meilleur geste',
    JSON.stringify(resumeDuCompte(undefined)) === '{"parfaits":0}'
    && JSON.stringify(resumeDuCompte(nouveauCompte())) === '{"parfaits":0}');
  {
    const c = nouveauCompte();
    compterChant(c, 0.95, 'tenir');
    const r = resumeDuCompte(c);
    check('un PARFAIT seul n’est pas une série', r.parfaits === 1 && !('serie' in r)
      && r.meilleur?.verdict === 'parfait'
      || (console.log('        bilan :', JSON.stringify(r)), false));
    // À égalité, le premier chant reste le meilleur : il faut faire mieux.
    compterChant(c, 0.95, 'mur');
    check('à égalité, le premier chant reste le meilleur', resumeDuCompte(c).meilleur?.chant === 'tenir');
  }

  /* **Le rejeu contre le moteur.** La note mesurée est rejouée avant lui avec
     une copie de sa composition des modificateurs : si `engine.js` changeait
     un jour sa façon de les composer, le mot dériverait en silence. Des
     centaines de chants, sur de vrais decks et de vrais lieux (`marin` paie le
     parfait 0,82), avec les cartes qui changent les fenêtres, le parfait et le
     plancher : la note rejouée, passée par `applyHeroMods`, doit retomber
     exactement sur la `quality` du moteur. */
  {
    const RYTHMES = new Set(['tempo', 'mash', 'hold', 'contretemps', 'echo',
      'crescendo', 'relance', 'salves', 'tenue', 'retenue']);
    const bruit = (a) => (Math.random() * 2 - 1) * a;
    /* Des frappes plausibles pour chaque geste, du juste (0) au faux (2), lues
       dans la configuration que le serveur sert au joueur. */
    const frappesPour = (gest, g, v) => {
      const jeu = [15, 50, 140, 25, 12][v];
      const tremble = (arr, plafond = jeu) => arr.map((x, i) =>
        Math.max(0, Math.round(i === 0 ? x : x + bruit(Math.max(12, Math.min(jeu, plafond))))));
      const regulier = (n, span) => Array.from({ length: n }, (_, i) => i * (span / (n + 1)));
      switch (gest) {
        case 'tempo': return tremble(Array.from({ length: g.tempo.beats }, (_, i) => i * g.tempo.interval));
        case 'contretemps': return tremble(Array.from({ length: g.contretemps.beats },
          (_, i) => (i + 0.5) * g.contretemps.interval));
        case 'echo': return tremble(g.echo.instants);
        case 'crescendo': return tremble(g.crescendo.instants);
        case 'mash': return tremble(regulier(Math.round(g.mash.target * [1, 0.85, 0.5, 1.05, 1.1][v]),
          g.mash.ms), 30);
        case 'hold': return [0, Math.round(g.hold.need * [1, 0.92, 0.5, 0.97, 1.02][v])];
        case 'tenue': return [0, Math.round(g.tenue.limite * [0.97, 0.9, 0.5, 0.95, 0.99][v])];
        case 'relance': return [0, Math.round(g.relance.attente + [0, 80, 200, 20, 5][v])];
        case 'retenue': return tremble(regulier(g.retenue.exact + [0, 1, 4, 0, 2][v], g.retenue.ms), 40);
        case 'salves': {
          const t = [];
          for (let r = 0; r < g.salves.rafales; r++) {
            for (let k = 0; k < g.salves.parRafale; k++) {
              t.push(r * (g.salves.parRafale * 120 + g.salves.silence) + k * 120);
            }
          }
          return tremble(t, 30);
        }
        default: return [];
      }
    };
    const PERSOS = [['TR34', 'MS30', 'TR33'], ['RV19', 'TR32', 'MS30'],
      ['MT4', 'TR21', 'TR33'], ['TR32', 'MS30', 'TR33']];
    const CARTES_V = ['a-metronome', 'a-vent', 'a-rp-rouille', 'a-secondsouffle',
      'a-fumigene', 'a-torche', 'a-bache', 'a-thermos', 'a-arbitre', 'a-vol'];
    const EFFETS = ['a-metronome', 'a-vent', 'a-rp-rouille', 'a-secondsouffle'];

    let compares = 0, ecarts = 0, sauves = 0;
    const premiers = [];
    const journal = [];
    const ecrire = console.error;
    console.error = (...a) => { journal.push(a.join(' ')); };
    try {
      for (let k = 0; k < 24; k++) {
        const ids = PERSOS[k % PERSOS.length];
        const eq = (side) => [{ userId: `${side}-0`, nom: `J${side}`,
          loadout: loadout(ids, CARTES_V, { [ids[0]]: ['jumelles'], [ids[1]]: ['tambour'] }) }];
        // Les identifiants `rej-…` tirent de vrais lieux, dont `marin` (rej-0).
        const dK = new DuelNvN({ id: `rej-${k}`, equipes: [eq(0), eq(1)], mode: 'entrainement',
          now: tV, fixture: { id: 7001, elapsed: 20,
            home: { id: 85, name: 'Sion' }, away: { id: 91, name: 'Bâle' } } });
        if (!dK.repertoire.some((id) => RYTHMES.has(CHANTS[id].gest))) dK.repertoire[0] = 'reprise';
        const rythmes = dK.repertoire.filter((id) => RYTHMES.has(CHANTS[id].gest));
        const comptes = new Map();
        let tk = tV;
        for (let n = 0; n < 16; n++) {
          tk += 1500;
          const uid = n % 2 ? '1-0' : '0-0';
          const j = dK.joueurs.get(uid);
          if (n % 3 === 0) {
            const carte = EFFETS[(Math.floor(n / 3) + k) % EFFETS.length];
            j.main.push(carte);
            j.cooldowns = {};
            j.breath = 100;
            try { dK.jouer(uid, carte, tk); } catch { /* une condition : sans effet ici */ }
          }
          j.breath = 100;
          const cardId = rythmes[(n + k) % rythmes.length];
          const p = { cardId, taps: frappesPour(CHANTS[cardId].gest, dK.vue(uid).moi.gestes, (n * 7 + k) % 5) };
          const m = noteMesuree(dK, uid, p, tk);
          let ev;
          try { ev = chanterEtNommer(dK, comptes, uid, p, tk); } catch { continue; }
          const chant = ev.find((e) => e.t === 'chant');
          if (!chant) continue;
          if (!m) { ecarts++; continue; }
          compares++;
          const fin = applyHeroMods(m.avantMods, m.mods);
          if (Number(fin.quality.toFixed(3)) !== chant.quality || fin.backfire !== chant.backfire) {
            ecarts++;
            if (premiers.length < 3) premiers.push(`${dK.id}/${cardId} : rejoué ${fin.quality.toFixed(3)}, moteur ${chant.quality}`);
          }
          if (verdictDe(chant.quality) !== chant.verdict) sauves++;
        }
      }
    } finally { console.error = ecrire; }

    check(`le rejeu retrouve la note du moteur sur ${compares} chants (${ecarts} écart)`,
      compares >= 200 && ecarts === 0
      || (console.log('        ', premiers.join(' · ') || '(trop peu de chants comparés)'), false));
    /* La preuve que le rejeu sert : sur ces chants-là, le mot de la note finale
       aurait été un autre. Sans eux, le contrôle du dessus passerait aussi
       avec un verdict mesuré sur `quality`. */
    check(`et sur ${sauves} d’entre eux, la note finale aurait dit un autre mot`, sauves > 0);
    check('le journal n’a rien eu à signaler',
      !journal.some((l) => l.includes('[nvn] verdict'))
      || (console.log('        journal :', journal.join(' | ')), false));
  }
}

/* ============================================ les effets, vus des deux camps

   L'arène du duel pose chaque effet en objet avec son chrono en anneau. La vue
   du moteur ne servait que `reste`, et seulement pour soi : la page devinait
   la durée et le camp. `nvn/index.js` les lit maintenant dans l'état du
   moteur (`jouerEtMarquer`, `vuePour`), sans toucher `engine.js`.

   L'horloge est la vraie : la vue du moteur calcule `reste` sur `Date.now()`,
   et un instant fabriqué loin de lui le rendrait négatif. */
{
  const t0 = Date.now();
  const dE = duel(1, 'entrainement', t0, 'dE1');
  const donne = (uid, carte) => {
    const j = dE.joueurs.get(uid);
    j.breath = 100; j.cooldowns = {}; j.main.push(carte);
  };
  const effet = (evs, type) => evs.find((e) => e.t === 'effect' && e.type === type);

  donne('0-0', 'a-brouillard');
  const e1 = effet(jouerEtMarquer(dE, '0-0', 'a-brouillard', t0), 'blind');
  check(`le Brouillard : l’évènement dit le camp qui le porte (${e1?.side})`,
    e1?.cible === 'adverse' && e1?.side === 1
    || (console.log('        évènement :', JSON.stringify(e1)), false));
  const vB = vuePour(dE, '1-0', t0 + 1500);
  const vA = vuePour(dE, '0-0', t0 + 1500);
  check('celui qui le porte le voit avec sa durée entière',
    vB.moi.effets.find((e) => e.type === 'blind')?.duree === 6000
    || (console.log('        effets :', JSON.stringify(vB.moi.effets)), false));
  const vuDA = vA.equipes[1][0].effets.find((e) => e.type === 'blind');
  check(`et l’autre camp le voit sur lui : reste ${vuDA?.reste} sur ${vuDA?.duree}`,
    vuDA?.reste === 4500 && vuDA?.duree === 6000
    && !vA.equipes[0][0].effets.some((e) => e.type === 'blind')
    || (console.log('        équipes :', JSON.stringify(vA.equipes)), false));
  check('la vue dit à chacun qui il est', vA.moi.userId === '0-0' && vB.moi.userId === '1-0');
  check('passé son échéance, il n’est plus sur personne',
    !vuePour(dE, '0-0', t0 + 6001).equipes[1][0].effets.some((e) => e.type === 'blind'));

  // Sans échéance (la Bâche absorbe une poussée) : ni reste ni durée.
  donne('1-0', 'a-bache');
  jouerEtMarquer(dE, '1-0', 'a-bache', t0 + 2000);
  const bache = vuePour(dE, '0-0', t0 + 2000).equipes[1][0].effets.find((e) => e.type === 'shield');
  check('un effet sans échéance n’a ni reste ni durée',
    Boolean(bache) && bache.reste === null && bache.duree === null
    || (console.log('        bâche :', JSON.stringify(bache)), false));

  /* **Le Renvoi** : la carte « adverse » se retourne contre celui qui la joue.
     La page lisait le camp d'en face de la dernière carte jouée — ici, le
     mauvais. L'état du moteur, lui, sait où l'effet s'est posé. */
  donne('1-0', 'a-miroir');
  jouerEtMarquer(dE, '1-0', 'a-miroir', t0 + 2500);
  donne('0-0', 'a-silence');
  const ev3 = jouerEtMarquer(dE, '0-0', 'a-silence', t0 + 3000);
  const e3 = effet(ev3, 'silence');
  check(`retourné par un Renvoi, le Silence porte le camp de celui qui l’a joué (${e3?.side})`,
    ev3.some((e) => e.t === 'reflected') && e3?.cible === 'adverse' && e3?.side === 0
    || (console.log('        évènements :', JSON.stringify(ev3)), false));
  check('et il le porte avec sa durée',
    vuePour(dE, '0-0', t0 + 3000).moi.effets.find((e) => e.type === 'silence')?.duree === 4000);

  // Un vol de souffle ne se pose sur personne : pas de camp à dire.
  donne('0-0', 'a-vol');
  const e4 = effet(jouerEtMarquer(dE, '0-0', 'a-vol', t0 + 3500), 'steal');
  check('un effet qui ne se pose sur personne n’a pas de camp', Boolean(e4) && !('side' in e4));
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
/* `process.exitCode` et non `process.exit()` (PLAN.md § 2, règle 13) : rien
   ne reste ouvert ici, et Node part de lui-même. */
process.exitCode = failures ? 1 : 0;
