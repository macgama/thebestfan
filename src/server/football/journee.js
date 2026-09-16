/**
 * La journée du football, telle que le reste du jeu doit la lire.
 *
 * ## Pourquoi elle ne peut pas venir de la table `fixtures`
 *
 * `fixtures` ne contient que ce que le guetteur relève, et le guetteur ne
 * relève que les clubs suivis et les salles occupées — c'est ainsi qu'il tient
 * dans le quota. Pour tout le reste, sa ligne date du jour où quelqu'un s'y est
 * intéressé, ou n'existe pas.
 *
 * Trois écrans en ont souffert de la même façon : le Grand Virage annonçait un
 * score vieux d'une demi-heure, le choix du match support ignorait la moitié
 * des rencontres en direct, et les deux se contredisaient avec la page des
 * matchs, qui a toujours eu juste parce qu'elle lit la **journée entière** —
 * un appel pour le monde entier, mis en cache quarante-cinq secondes.
 *
 * C'est donc cette journée qui fait foi, et elle est lue ici une fois pour
 * tous. Elle ne coûte rien de plus : le cache est celui de la page des matchs.
 *
 * ## Ce que la base garde quand même
 *
 * Les couleurs des clubs, les matchs des huit prochains jours — la journée ne
 * connaît qu'aujourd'hui — et les rencontres d'un club suivi dans une
 * compétition que le jeu n'a pas activée. Les appelants fusionnent donc les
 * deux, et la journée l'emporte quand les deux parlent du même match.
 */

/** Les statuts d'un match qui se joue. Écrits une fois, lus partout. */
export const EN_DIRECT = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'];
export const TERMINE = ['FT', 'AET', 'PEN'];

/**
 * Les matchs du jour, rangés par identifiant.
 *
 * Rend une Map vide plutôt que de lever : une panne du télétexte doit laisser
 * l'appelant retomber sur la base — incomplet, jamais rien. C'est la règle de
 * tout ce qui touche à l'API depuis le début.
 *
 * @param jourDuFoot une fonction qui rend la journée du télétexte, ou null.
 */
export async function journeeParId(jourDuFoot) {
  const parId = new Map();
  if (!jourDuFoot) return parId;

  let j;
  try { j = await jourDuFoot(); }
  catch (e) {
    console.error('[journée]', e.message);
    return parId;
  }

  for (const g of j?.groupes ?? []) {
    for (const m of g.matchs ?? []) {
      parId.set(Number(m.id), {
        id: Number(m.id),
        leagueId: g.ligue?.id ?? null,
        leagueName: g.ligue?.name ?? null,
        // Le palier de la compétition : il sert à ordonner une liste devenue
        // mondiale, pour qu'une finale ne passe pas derrière un championnat U19.
        tier: g.ligue?.tier ?? 3,
        date: m.date,
        status: m.status,
        elapsed: m.elapsed ?? null,
        extra: m.extra ?? null,
        // L'instant de la lecture chez l'API : c'est lui qui fait courir la
        // minute chez le client, sans un appel de plus.
        luA: m.luA ?? null,
        home: { id: m.home?.id, name: m.home?.name, logo: m.home?.logo,
                goals: m.home?.goals ?? null },
        away: { id: m.away?.id, name: m.away?.name, logo: m.away?.logo,
                goals: m.away?.goals ?? null },
        live: Boolean(m.live),
        fini: Boolean(m.fini),
      });
    }
  }
  return parId;
}
