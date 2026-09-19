/**
 * La répétition : essayer un geste sans que rien ne soit en jeu.
 *
 * ## Ce qu'elle règle
 *
 * Les vingt gestes ne s'apprennent nulle part. On les découvre **en duel** ou
 * **dans le Grand Virage**, c'est-à-dire au seul moment où les rater coûte
 * quelque chose : un chant payé qui ne pousse pas, une carte jouée pour rien,
 * et une salle de quatre-vingt-dix minutes où l'on n'ose plus rien tenter.
 * « La jauge tient puis elle saute » se lit en une seconde et se comprend en
 * trois essais — sauf qu'il n'existait aucun endroit pour les faire.
 *
 * ## Deux décisions, et elles tiennent tout
 *
 * **Aucun modificateur.** Le geste est joué et noté à `mods = {}` : ni Fanzzy,
 * ni équipement, ni stade. C'est ce qui fait de cette salle un endroit où l'on
 * apprend le **geste**, et non son deck — et c'est aussi ce qui l'empêche de
 * devenir un banc d'essai pour mesurer ce que vaut une carte rare avant de
 * l'acheter.
 *
 * **La salle ne paie rien.** Pas d'écharpes, pas de ferveur, pas d'expérience,
 * aucune trace en base. Un endroit où l'on s'entraîne et qui rapporte cesse
 * d'être un endroit où l'on s'entraîne : il devient le moyen le plus rentable
 * de jouer, et plus personne ne va au match.
 *
 * C'est aussi la réponse à la question qu'on se pose toujours ici — « et si le
 * client mentait ? ». Il peut. Il peut renvoyer un motif qu'il n'a pas joué,
 * des instants parfaits, n'importe quoi. Il obtiendra un nombre, qu'il est seul
 * à voir, et qui ne s'écrit nulle part. **Tricher à la répétition, c'est se
 * priver de la répétition.** Le meilleur score, lui, vit dans le navigateur du
 * joueur — voir `public/repetition.html`.
 *
 * ## Ce qu'elle ne réimplémente pas
 *
 * Rien. `resoudreGeste` fabrique la configuration des vingt, `grade` les note
 * toutes — la même paire que le Virage et le duel appellent. Une salle qui
 * aurait son propre barème aurait fini par enseigner un geste qui n'existe pas.
 */
import express from 'express';
import { resoudreGeste, grade, GESTES, MOTIFS, Cheat } from '../ferveur/gestures.js';
import { Triche } from '../ferveur/epreuves.js';

/**
 * Le motif, tiré ici et à chaque fois.
 *
 * L'écho, les visages et la mosaïque changent avec lui : sans tirage, on
 * rejouerait éternellement la même suite, et la salle n'apprendrait qu'à
 * réciter celle-là.
 */
const motifAuHasard = () => Math.floor(Math.random() * MOTIFS.length);

/* Aucune dépendance, pas même le pool : cette salle ne lit rien et n'écrit
   rien. C'est la conséquence directe du fait qu'elle ne paie rien, et c'est ce
   qui la rend montable avant tout le reste dans `server.js`. */
export function createRepetition() {
  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (!res.headersSent) res.status(400).json({ error: e.code ?? 'repetition.error.server' });
  });

  /**
   * Ce qu'il faut pour jouer : la liste des gestes et leur configuration.
   *
   * Publique, et sans cache. Publique parce qu'un geste ne s'achète pas et
   * n'appartient à personne — quelqu'un qui hésite à s'inscrire doit pouvoir
   * essayer avant. Sans cache parce que le motif change à chaque appel, et
   * qu'une configuration mise en cache une heure ferait rejouer le même écho
   * tout l'après-midi.
   */
  router.get('/', (_req, res) => {
    res.set('cache-control', 'no-store');
    const motif = motifAuHasard();
    res.json({ gestes: resoudreGeste({}, { motif }), motif, liste: GESTES });
  });

  /**
   * Noter ce qui vient d'être joué.
   *
   * `mods = {}` : voir l'en-tête. Le motif vient du client, et c'est assumé —
   * il ne peut mentir qu'à lui-même.
   *
   * Les deux refus du moteur — `Cheat` pour les gestes, `Triche` pour les
   * épreuves — sont attrapés **ici** et rendus comme une note nulle assortie
   * d'un motif. En partie ils coupent le geste, ce qui est juste : on ne
   * discute pas avec quelqu'un qui envoie quatre-vingts frappes en une
   * seconde. À la répétition il n'y a rien à protéger, et un écran qui répond
   * « erreur serveur » à un joueur qui a tapé trop vite lui apprend seulement
   * que le jeu est cassé.
   */
  router.post('/', safe(async (req, res) => {
    const geste = String(req.body?.geste ?? '');
    if (!GESTES.includes(geste)) throw Object.assign(new Error('x'), { code: 'repetition.error.geste_inconnu' });
    const motif = Number(req.body?.motif) || 0;

    try {
      const note = grade(geste, req.body?.rendu, {}, { motif });
      res.json({ note: Math.max(0, Math.min(1, Number(note) || 0)), refuse: null });
    } catch (e) {
      if (e instanceof Cheat || e instanceof Triche) {
        res.json({ note: 0, refuse: e.message || 'refuse' });
        return;
      }
      throw e;
    }
  }));

  return { router };
}
