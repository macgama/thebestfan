/**
 * Le crochet de la simulation : il laisse noter une épreuve sans la jouer.
 *
 * Les dix gestes de rythme se simulent pour de vrai — le joueur simulé envoie
 * des instants de frappe, le serveur les note avec sa propre règle. Les seize
 * épreuves (dessiner un tifo, retrouver des paires, viser un fumigène…)
 * attendent un tracé ou une grille : les fabriquer bien ou mal à la main pour
 * chacune serait un second jeu à écrire. Une réponse `{ __note }` passe donc
 * ici à côté de `grade`, et la note annoncée est celle du joueur simulé.
 *
 * Rien d'autre ne change : une vraie liste de frappes suit le chemin du jeu,
 * refus compris. Ne sert qu'à `scripts/simuler-parties.mjs`.
 */
export async function load(url, context, next) {
  const r = await next(url, context);
  if (!url.endsWith('/src/server/ferveur/gestures.js')) return r;
  let src = String(r.source);
  src = src.replace('export function grade(', 'function gradeDuJeu(');
  src += `
export function grade(kind, taps, mods = {}, opts = {}) {
  if (taps && typeof taps === 'object' && !Array.isArray(taps) && '__note' in taps) {
    return Math.max(0, Math.min(1.2, Number(taps.__note) || 0));
  }
  return gradeDuJeu(kind, taps, mods, opts);
}
`;
  return { ...r, source: src, shortCircuit: true };
}
