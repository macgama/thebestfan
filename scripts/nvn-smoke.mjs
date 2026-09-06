/**
 * Test du moteur NvN.
 * Aucune base, aucun réseau : on donne des intentions, on vérifie les
 * événements. C'est ce qui permet de tester chaque effet un par un.
 */
import { DuelNvN, RULES } from '../src/server/nvn/engine.js';
import { ACTION_BY_ID } from '../src/shared/duel/actions.js';
import { BY_ID } from '../src/shared/fanzzy/dex.js';
import { combine } from '../src/shared/fanzzy/inventaire.js';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const jitter = (t, a = 25) => Math.max(0, t + (Math.random() * a * 2 - a));
const tempoParfait = () => Array.from({ length: 8 }, (_, i) => jitter(i * 560, 30));
const tempoRate = () => Array.from({ length: 8 }, (_, i) => jitter(i * 560 + 280, 30));

function loadout(ids, cartes, stuff = {}) {
  return {
    fanzzy: ids.map((id) => {
      const d = BY_ID.get(id);
      return { id, nom: d.nom, type: d.type, cri: d.cri,
        stuff: stuff[id] ?? [], mods: { id, ...combine(d.mods, stuff[id] ?? []) } };
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
let ev = d.chanter('0-0', { geste:'tempo', taps: memeGeste }, t);
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
d.chanter('1-0', { geste:'tempo', taps: memeGeste }, t);
check('l\u2019adverse pousse dans l\u2019autre sens', Math.abs(d.rope) < 1);

// Souffle rétabli : sinon le refus viendrait du manque de souffle, pas de
// la détection de triche, et le test ne vérifierait rien.
d.joueurs.get('0-0').breath = 100;
// Vingt frappes à 20 ms d'écart : sous le plafond de frappes, mais bien
// au-dessus de ce qu'un doigt humain peut faire.
try {
  d.chanter('0-0', { geste:'tempo', taps: Array.from({ length:20 }, (_, i) => i * 20) }, t);
  check('frappes inhumaines rejetées', false);
} catch (e) {
  check(`frappes inhumaines rejetées (${e.code})`, e.code === 'ferveur.error.taps_too_fast');
}

// Et le plafond de frappes, qui est un contrôle distinct.
d.joueurs.get('0-0').breath = 100;
try {
  d.chanter('0-0', { geste:'tempo', taps: Array.from({ length:40 }, (_, i) => i * 90) }, t);
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
try { d.chanter('1-0', { geste:'tempo', taps: tempoParfait() }, t + 500); check('silence sans effet', false); }
catch (e) { check('le silence coupe le chant adverse', e.code.includes('silenced')); }
d.tick(t + 5000);
d.joueurs.get('1-0').breath = 100;
ev = d.chanter('1-0', { geste:'tempo', taps: tempoParfait() }, t + 5000);
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
solo.chanter('0-0', { geste:'tempo', taps: tempoParfait() }, t);
for (let i = 0; i < 5; i++) cinq.chanter(`0-${i}`, { geste:'tempo', taps: tempoParfait() }, t);
check('cinq chanteurs ne poussent pas cinq fois plus',
  Math.abs(Math.abs(cinq.rope) - Math.abs(solo.rope)) < Math.abs(solo.rope) * 0.35);

/* ------------------------------------------------------------- fin */

d = duel(1, 'classe'); t = 1_000_000;
d.goals = [2, 0];
d.rope = -RULES.goalAt + 1;
d.joueurs.get('0-0').breath = 100;
ev = d.chanter('0-0', { geste:'tempo', taps: tempoParfait() }, t);
check('troisième but : la partie s\u2019arrête', d.termine && d.vainqueur === 0);
check('le duel classé est signalé comme tel',
  ev.some((e) => e.t === 'over' && e.classement === true));

d = duel(1, 'entrainement', t);
ev = d.tick(t + RULES.dureeMs + 10);
check('au temps écoulé, la partie se termine', ev.some((e) => e.t === 'over' && e.raison === 'temps'));
check('un entraînement ne compte pas',
  ev.find((e) => e.t === 'over').classement === false);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exit(failures ? 1 : 0);
