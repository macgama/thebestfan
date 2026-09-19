#!/usr/bin/env node
/**
 * La répétition : la salle où l'on essaie un geste sans rien risquer.
 *
 * ## Ce que cette suite défend, et ce qu'elle laisse aux autres
 *
 * Elle n'éprouve **pas** les gestes : `gestes:test` les joue tous les dix,
 * bien et mal, et `epreuves:ui` fait de même pour les dix épreuves dans un
 * vrai navigateur. Les rejouer ici ne mesurerait qu'une troisième copie de la
 * même chose.
 *
 * Elle éprouve la **salle**, c'est-à-dire les quatre promesses qui la rendent
 * utile, et dont aucune ne se voit en lisant l'écran :
 *
 *   1. **Elle n'aide pas.** La configuration part sans modificateur : ni
 *      Fanzzy, ni équipement, ni stade. Un joueur qui répète le tempo sur un
 *      intervalle élargi par ses Jumelles apprend un geste qu'il ne retrouvera
 *      pas en duel — c'est exactement la faute qui a déjà coûté cher ici, dans
 *      l'autre sens.
 *   2. **Elle ne paie pas.** Rien n'est écrit nulle part, et cette suite le
 *      démontre de la seule façon qui ne puisse pas mentir : **elle n'ouvre
 *      aucune base**. Si le module venait un jour à écrire quelque chose, il
 *      lui faudrait un pool, et ce fichier ne compilerait plus.
 *   3. **Elle ne rejoue pas la même chose.** Le motif est tiré à chaque appel.
 *      Sans ça, l'écho, les visages et la mosaïque n'apprendraient qu'une
 *      suite, toujours la même.
 *   4. **Elle ne casse pas devant un geste refusé.** Le moteur rejette ce
 *      qu'aucune main ne peut faire. En partie c'est juste. Ici, rendre une
 *      erreur serveur à quelqu'un qui a tapé trop vite lui apprend seulement
 *      que le jeu est cassé.
 *
 * Usage : node scripts/repetition-smoke.mjs
 */
import { createServer } from 'node:http';
import express from 'express';
import { createRepetition } from '../src/server/repetition/index.js';
import { GESTES, GESTURES, MOTIFS } from '../src/server/ferveur/gestures.js';

let ko = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) ko++; };

/* Aucune base. Voir l'en-tête : c'est le contrôle, pas une commodité. */
const app = express();
app.use('/api/repetition', createRepetition().router);
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}/api/repetition`;

const get = () => fetch(base).then((r) => r.json());
const post = (body) => fetch(base, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}).then(async (r) => ({ statut: r.status, corps: await r.json() }));

/* ===================================================== ce que la salle propose */
{
  const d = await get();
  check(`les ${GESTES.length} gestes sont proposés (${d.liste?.length})`,
    Array.isArray(d.liste) && d.liste.length === GESTES.length
    && GESTES.every((g) => d.liste.includes(g))
    || (console.log('        elle propose :', (d.liste ?? []).join(' ')), false));

  /* Chacun doit avoir sa configuration, épreuves comprises : une salle qui
     listerait un geste sans savoir le dresser enverrait le joueur sur un pavé
     vide, et il croirait l'avoir cassé. */
  const sansConfig = GESTES.filter((g) => d.gestes?.[g] == null);
  check('et chacun part avec sa configuration', sansConfig.length === 0
    || (console.log('        sans configuration :', sansConfig.join(' ')), false));

  check('le motif est l’un de ceux du jeu',
    Number.isInteger(d.motif) && d.motif >= 0 && d.motif < MOTIFS.length
    || (console.log('        motif :', d.motif), false));
}

/* ======================================================== elle n'aide personne

   Le contrôle compare à la table du code, et non à un nombre écrit ici : un
   intervalle de tempo réglé un jour autrement ne doit pas faire rougir cette
   suite, il doit continuer d'être servi **nu**. */
{
  const d = await get();
  check(`le tempo part sans bonus (${d.gestes.tempo.interval} ms)`,
    d.gestes.tempo.interval === GESTURES.tempo.interval
    && d.gestes.tempo.window === GESTURES.tempo.window
    || (console.log('        servi :', JSON.stringify(d.gestes.tempo),
      '· nu :', JSON.stringify(GESTURES.tempo)), false));
  check('et le martelage aussi',
    d.gestes.mash.ms === GESTURES.mash.ms && d.gestes.mash.target === GESTURES.mash.target);
  check('la tenue n’est pas allongée',
    d.gestes.hold.ms === GESTURES.hold.ms);
}

/* ================================================== le motif change d'un essai
   à l'autre

   Vingt appels : avec sept motifs, en voir un seul vingt fois de suite est si
   improbable qu'on peut l'appeler un défaut. Le contrôle ne dépend d'aucun
   tirage précis — il dit « pas toujours le même », et c'est toute la règle. */
{
  const vus = new Set();
  for (let i = 0; i < 20; i++) vus.add((await get()).motif);
  check(`le motif est retiré à chaque essai (${vus.size} vus sur ${MOTIFS.length})`,
    vus.size > 1 || (console.log('        toujours le même :', [...vus]), false));
}

/* ============================================================= la notation

   Un aller-retour, pas un barème : bien jouer paie, mal jouer paie moins. Le
   détail de chaque geste appartient à `gestes:test`, qui les joue tous. */
{
  const d = await get();
  const t = d.gestes.tempo;
  /* Tremblé : le moteur refuse une régularité mécanique — c'est une défense,
     et l'éprouver ici mesurerait la défense au lieu de la note. */
  let graine = 20260919;
  const alea = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
  const suite = (n, pas) => Array.from({ length: n },
    (_, i) => Math.round(i * pas + (alea() - 0.5) * 24));

  const juste = await post({ geste: 'tempo', motif: d.motif, rendu: suite(t.beats, t.interval) });
  check(`jouer juste paie (${juste.corps.note?.toFixed?.(2)})`,
    juste.statut === 200 && juste.corps.note >= 0.8
    || (console.log('        rendu :', JSON.stringify(juste)), false));
  check('et rien n’est refusé', juste.corps.refuse === null);

  const faux = await post({ geste: 'tempo', motif: d.motif,
    rendu: suite(t.beats, Math.round(t.interval * 0.55)) });
  check(`taper deux fois trop vite paie moins (${faux.corps.note?.toFixed?.(2)})`,
    faux.corps.note < juste.corps.note - 0.2
    || (console.log('        contre juste :', juste.corps.note), false));
}

/* ============================================ un geste refusé n'est pas une panne

   Quatre-vingts frappes en une seconde : aucune main ne le fait, et le moteur
   lève. La salle doit rendre une note nulle **et le dire**, pas une erreur. */
{
  const d = await get();
  const r = await post({ geste: 'mash', motif: d.motif,
    rendu: Array.from({ length: 80 }, (_, i) => i * 12) });
  check(`un geste impossible rend 200 et non une panne (${r.statut})`, r.statut === 200
    || (console.log('        rendu :', JSON.stringify(r)), false));
  check('la note est nulle', r.corps.note === 0);
  check('et la salle dit pourquoi', typeof r.corps.refuse === 'string' && r.corps.refuse.length > 0
    || (console.log('        elle dit :', r.corps.refuse), false));
}

/* ================================================== ce qui n'est pas un geste */
{
  const r = await post({ geste: 'chant-magique', motif: 0, rendu: [] });
  check('un geste inventé est refusé', r.statut === 400
    && r.corps.error === 'repetition.error.geste_inconnu'
    || (console.log('        rendu :', JSON.stringify(r)), false));

  const vide = await post({});
  check('et une demande vide aussi, sans lever', vide.statut === 400
    && typeof vide.corps.error === 'string');
}

/* ===================================================== la note reste une note

   Bornée entre zéro et un : elle s'affiche telle quelle sur l'écran, et un
   1,04 ou un -0,2 y serait lu comme un défaut d'affichage. */
{
  const d = await get();
  const r = await post({ geste: 'hold', motif: d.motif,
    rendu: [{ down: 0, up: d.gestes.hold.ms * 4 }] });
  check(`la note reste entre 0 et 1 (${r.corps.note})`,
    r.corps.note >= 0 && r.corps.note <= 1);
}

await new Promise((r) => http.close(r));
console.log(`\n${ko ? `${ko} échec(s)` : 'tout est vert'}`);
process.exitCode = ko ? 1 : 0;
