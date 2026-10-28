/**
 * **Le camp d'un but : le tableau d'affichage fait foi.**
 *
 * L'API range chaque but sous une équipe (`team.id`), et c'est elle que la
 * carte-souvenir grave : l'écusson en grand, le score à cet instant. Mais
 * l'API se trompe parfois de camp — vu le 25 octobre 2026, FC Sion –
 * Lausanne, 1-0 : le but de Blin (Sion) rangé sous Lausanne, et la carte
 * disait 0-1 avec l'écusson de Lausanne. Un contre son camp peut aussi être
 * rangé sous l'équipe du joueur plutôt que sous celle qui en profite.
 *
 * Le score du match, lui, ne se trompe pas de camp. Quand la liste des buts
 * en compte autant que le tableau, mais pas répartis de la même façon, ce
 * sont les camps de la liste qui sont faux, et on les remet d'accord avec le
 * tableau :
 *
 *   1. d'abord en retournant les contre-son-camp, si cela suffit — c'est
 *      l'erreur de convention, la plus probable ;
 *   2. sinon dans l'ordre du match : un but qui ferait dépasser à son équipe
 *      le score qu'elle a au tableau passe à l'autre, si celle-ci a de la
 *      place. Exact pour un seul but mal rangé dans un match à sens unique
 *      (le 1-0 de Sion) ; dans un match où les deux équipes marquent, le
 *      score final est juste et le rang des buts au mieux de ce qu'on sait.
 *
 * Une liste qui n'a pas autant de buts que le tableau (en avance ou en
 * retard d'un but sur le score) n'est pas touchée : on ne sait pas lequel
 * manque.
 *
 * Rend une nouvelle liste (les buts corrigés sont des copies, le reste est
 * rendu tel quel) et le nombre de buts changés de camp.
 */
export function remettreLesCamps(evenements, { homeId, awayId, home, away }, estUnBut) {
  const camp = (e) => e.teamId ?? e.team_id;
  const buts = evenements.filter(estUnBut);
  if (homeId == null || awayId == null || home == null || away == null) {
    return { evenements, corriges: 0 };
  }
  const compte = (liste) => ({
    h: liste.filter((e) => camp(e) === homeId).length,
    a: liste.filter((e) => camp(e) === awayId).length,
  });
  const n = compte(buts);
  if (buts.length !== home + away || (n.h === home && n.a === away)) {
    return { evenements, corriges: 0 };
  }

  const autre = (id) => (id === homeId ? awayId : id === awayId ? homeId : null);
  const nouveaux = new Map();     // but d'origine -> camp corrigé

  /* 1. Les contre-son-camp retournés suffisent-ils ? */
  const csc = buts.filter((e) => e.detail === 'Own Goal' && autre(camp(e)) != null);
  if (csc.length) {
    const essai = compte(buts.map((e) => (csc.includes(e) ? { teamId: autre(camp(e)) } : e)));
    if (essai.h === home && essai.a === away) {
      for (const e of csc) nouveaux.set(e, autre(camp(e)));
    }
  }

  /* 2. Sinon, dans l'ordre du match, le tableau borne chaque équipe. */
  if (!nouveaux.size) {
    const ordonnes = buts.slice().sort((a, b) =>
      (a.minute ?? 0) - (b.minute ?? 0) || (a.extra ?? 0) - (b.extra ?? 0));
    const reste = { [homeId]: home, [awayId]: away };
    /* Les buts sans équipe connue se placent à la fin, là où il reste de la
       place : ils ne prennent pas celle d'un but bien rangé. */
    const sansCamp = [];
    for (const e of ordonnes) {
      const id = camp(e);
      if (id !== homeId && id !== awayId) { sansCamp.push(e); continue; }
      if (reste[id] > 0) { reste[id] -= 1; continue; }
      const lautre = autre(id);
      if (reste[lautre] > 0) { reste[lautre] -= 1; nouveaux.set(e, lautre); }
    }
    for (const e of sansCamp) {
      const id = reste[homeId] > 0 ? homeId : reste[awayId] > 0 ? awayId : null;
      if (id == null) continue;
      reste[id] -= 1;
      nouveaux.set(e, id);
    }
  }

  if (!nouveaux.size) return { evenements, corriges: 0 };
  return {
    evenements: evenements.map((e) => {
      if (!nouveaux.has(e)) return e;
      const id = nouveaux.get(e);
      return 'team_id' in e && !('teamId' in e) ? { ...e, team_id: id } : { ...e, teamId: id };
    }),
    corriges: nouveaux.size,
  };
}
