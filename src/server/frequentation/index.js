/**
 * La fréquentation : combien de joueurs connectés en ce moment, pour
 * l'administration (demande de Gaël du 5 novembre 2026).
 *
 * Un **nombre**, jamais une liste (l'administration lit aussi l'heure d'un
 * joueur précis, sur sa ligne de JOUEURS › COMPTES). Rien n'est écrit en base : chaque requête
 * `/api` d'un joueur connecté pose sa dernière heure en mémoire, et le ménage
 * oublie tout ce qui a plus de 24 heures. Au redémarrage, la mémoire repart
 * de zéro — l'aperçu dit alors depuis quand il compte.
 *
 * Ce n'est pas la présence (`../presence`) : elle, montre un état à des amis
 * et reste éteinte tant que `presence.actif` est faux. Ici, rien n'est montré
 * à personne d'autre qu'un administrateur, et seulement en total.
 */

export const FENETRES = { maintenant: 5 * 60_000, heure: 60 * 60_000, jour: 24 * 60 * 60_000 };

/** @param {{ horloge?: () => number }} [o] */
export function createFrequentation({ horloge = Date.now } = {}) {
  const vus = new Map();          // id du joueur → dernière activité (ms)
  const depuis = horloge();
  let menageA = depuis;

  function noter(userId) {
    if (!userId) return;
    const t = horloge();
    vus.set(String(userId), t);
    if (t - menageA >= 60_000) {
      menageA = t;
      for (const [id, vu] of vus) if (t - vu >= FENETRES.jour) vus.delete(id);
    }
  }

  /** Les trois totaux, et l'heure depuis laquelle on compte. */
  function compter() {
    const t = horloge();
    const n = { maintenant: 0, heure: 0, jour: 0 };
    for (const vu of vus.values()) {
      const age = t - vu;
      if (age < FENETRES.maintenant) n.maintenant++;
      if (age < FENETRES.heure) n.heure++;
      if (age < FENETRES.jour) n.jour++;
    }
    return { ...n, depuis: new Date(depuis).toISOString() };
  }

  /** La dernière activité d'un joueur dans les 24 h, en ms, ou `null` :
      pour la colonne « dernière visite » de l'administration, plus fraîche
      que la base, qui ne note la session qu'une fois par jour. */
  function vuA(userId) {
    const vu = vus.get(String(userId));
    return vu != null && horloge() - vu < FENETRES.jour ? vu : null;
  }

  return { noter, compter, vuA };
}
