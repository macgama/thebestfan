/**
 * Les cartes du vrai match (Gaël, 3 novembre 2026 : « Ok pour les cartes
 * vrai match »).
 *
 * Mi-temps, But au stade !, Carton rouge, Coup de sifflet, Temps
 * additionnel : elles ne partent qu'au moment du vrai match qu'elles disent.
 * Ce banc les éprouve dans la règle commune, dans le moteur du duel et dans
 * la salle du Virage, sans base ni serveur.
 *
 *     npm run cartes-reelles:smoke
 */
import { ACTION_BY_ID, conditionReelleRemplie, estRouge, dansLeVirage }
  from '../src/shared/duel/actions.js';
import { DuelNvN } from '../src/server/nvn/engine.js';
import { VirageRoom } from '../src/server/ferveur/virage.js';

let rouges = 0;
const check = (nom, ok, ...detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${nom}`);
  if (!ok) { rouges++; if (detail.length) console.log('       ', ...detail); }
};

const IDS = ['a-mitemps', 'a-but-au-stade', 'a-carton-rouge', 'a-coup-sifflet', 'a-temps-additionnel'];

console.log('\n  la règle commune');
check('les cinq cartes existent', IDS.every((id) => ACTION_BY_ID.has(id)));
check('et toutes se jouent au Virage', IDS.every((id) => dansLeVirage(ACTION_BY_ID.get(id))));
{
  const c = ACTION_BY_ID.get('a-mitemps').condition;
  check('Mi-temps : refusée à la 20e', !conditionReelleRemplie(c, { minute: 20, statut: '1H' }));
  check('Mi-temps : jouable à la 43e', conditionReelleRemplie(c, { minute: 43, statut: '1H' }));
  check('Mi-temps : jouable pendant la pause', conditionReelleRemplie(c, { minute: 45, statut: 'HT' }));
  check('Mi-temps : refusée sans match', !conditionReelleRemplie(c, {}));
  const s = ACTION_BY_ID.get('a-coup-sifflet').condition;
  check('Coup de sifflet : jouable à la 4e', conditionReelleRemplie(s, { minute: 4, statut: '1H' }));
  check('Coup de sifflet : refusée à la 30e', !conditionReelleRemplie(s, { minute: 30, statut: '1H' }));
  check('Coup de sifflet : refusée avant le coup d’envoi', !conditionReelleRemplie(s, { minute: null, statut: 'NS' }));
  const b = ACTION_BY_ID.get('a-but-au-stade').condition;
  check('But au stade : jouable 30 s après un but', conditionReelleRemplie(b, { depuisBut: 30_000 }));
  check('But au stade : refusée 3 min après', !conditionReelleRemplie(b, { depuisBut: 180_000 }));
  check('But au stade : refusée sans but', !conditionReelleRemplie(b, { depuisBut: null }));
  check('un rouge se reconnaît, la deuxième jaune comprise',
    estRouge({ type: 'Card', detail: 'Red Card' }) && estRouge({ type: 'Card', detail: 'Second Yellow card' })
    && !estRouge({ type: 'Card', detail: 'Yellow Card' }) && !estRouge({ type: 'subst', detail: 'Red' }));
  check('les cartes sans condition du vrai match passent toujours',
    conditionReelleRemplie(ACTION_BY_ID.get('a-fumigene').condition, {}));
}

/* ------------------------------------------------------------- le duel */

console.log('\n  le duel');
const loadout = (actions) => ({
  fanzzy: [{ id: 'TR32', nom: 'J', stade: 1, cri: { gest: 'tempo', label: 'x' }, mods: {} }],
  actions,
});
function duel(elapsed, status = '1H', t = 1_000_000) {
  const eq = (side) => [{ userId: `${side}-0`, nom: `J${side}`, loadout: loadout(IDS.concat(IDS)) }];
  return new DuelNvN({ id: 'dr', equipes: [eq(0), eq(1)], mode: 'entrainement', now: t,
    fixture: { id: 7101, elapsed, status, home: { id: 85, name: 'Sion' }, away: { id: 91, name: 'Bâle' } } });
}
const essayer = (d, uid, id, t) => {
  const j = d.joueurs.get(uid);
  j.breath = 100; j.cooldowns = {};
  if (!j.main.includes(id)) j.main[0] = id;
  try { d.jouer(uid, id, t); return 'ok'; } catch (e) { return e.message; }
};
{
  let t = 1_000_000;
  let d = duel(20, '1H', t);
  check('Mi-temps refusée à la 20e', essayer(d, '0-0', 'a-mitemps', t) === 'condition_not_met');
  t += 22 * 60_000;
  check('et jouable 22 minutes plus tard : la minute avance pendant le duel',
    essayer(d, '0-0', 'a-mitemps', t) === 'ok', d.minuteDuMatch(t));
  d.etatReel({ status: 'HT', elapsed: 45 }, t);
  t += 10 * 60_000;
  check('la minute ne court pas à la pause', d.minuteDuMatch(t) === 45);

  d = duel(30, '1H', t);
  check('But au stade refusé sans but', essayer(d, '0-0', 'a-but-au-stade', t) === 'condition_not_met');
  d.butReel({ teamId: 85, minute: 31 }, t);
  check('jouable par la tribune du club buteur', essayer(d, '0-0', 'a-but-au-stade', t + 30_000) === 'ok');
  check('pas par l’autre', essayer(d, '1-0', 'a-but-au-stade', t + 30_000) === 'condition_not_met');
  check('et plus après 2 minutes', essayer(d, '0-0', 'a-but-au-stade', t + 150_000) === 'condition_not_met');

  d = duel(50, '2H', t);
  check('Carton rouge refusé sans carton', essayer(d, '0-0', 'a-carton-rouge', t) === 'condition_not_met');
  d.evenementsReels([{ type: 'Card', detail: 'Red Card', teamId: 91 }], t);
  check('un rouge pour Bâle : jouable côté Sion', essayer(d, '0-0', 'a-carton-rouge', t + 1000) === 'ok');
  check('pas côté Bâle', essayer(d, '1-0', 'a-carton-rouge', t + 1000) === 'condition_not_met');

  d = duel(3, '1H', t);
  check('Coup de sifflet à la 3e', essayer(d, '0-0', 'a-coup-sifflet', t) === 'ok');
  d = duel(89, '2H', t);
  check('Temps additionnel refusé à la 89e', essayer(d, '0-0', 'a-temps-additionnel', t) === 'condition_not_met');
  check('jouable à la 90e, deux minutes plus tard', essayer(d, '0-0', 'a-temps-additionnel', t + 120_000) === 'ok');

  const sans = new DuelNvN({ id: 'df', equipes: [[{ userId: 'a', nom: 'A', loadout: loadout(IDS.concat(IDS)) }],
    [{ userId: 'b', nom: 'B', loadout: loadout(IDS.concat(IDS)) }]], mode: 'entrainement', now: t,
  fixture: { id: null, fictif: true, elapsed: null, status: 'NS' } });
  check('à l’entraînement sans vrai match, aucune ne part',
    IDS.every((id) => essayer(sans, 'a', id, t) === 'condition_not_met'));
}

/* ------------------------------------------------------------ le Virage */

console.log('\n  le Virage');
{
  const room = new VirageRoom({
    fixture: { id: 9941, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B', leagueId: 1,
      kickoffAt: new Date(), status: '2H', elapsed: 60 },
    emit: () => {}, log: { warn() {}, error() {} },
  });
  room.join('u1', { side: 0, name: 'U1', actions: IDS.concat(IDS) });
  const tenter = (id) => {
    const m = room.members.get('u1');
    m.souffle = 100; m.breath = 100; m.cooldowns = {};
    if (!m.main.includes(id)) m.main[0] = id;
    try { room.jouer('u1', id); return 'ok'; } catch (e) { return e.message; }
  };
  check('Carton rouge refusé sans carton', tenter('a-carton-rouge') === 'condition_not_met');
  room.matchEvents([{ type: 'Card', detail: 'Red Card', teamId: 2 }]);
  check('un rouge pour l’extérieur : jouable à domicile', tenter('a-carton-rouge') === 'ok');
  check('Mi-temps refusée à la 60e', tenter('a-mitemps') === 'condition_not_met');
  room.minute = 44; room.statut = '1H';
  check('jouable à la 44e', tenter('a-mitemps') === 'ok');
}

console.log(rouges ? `\n  ${rouges} rouge(s)\n` : '\ntout est vert\n');
process.exit(rouges ? 1 : 0);
