/**
 * La voix contre le boss : chaque chant réussi d'un supporter, au Virage, au
 * duel ou au chant en rythme, retire un peu de voix au boss de la semaine de
 * son club (`jeux_boss`).
 *
 * Le Virage et le duel jugent leurs chants en mémoire, des dizaines par
 * seconde dans une grosse tribune : ils ne touchent pas la base pour ça. Ils
 * appellent `chantReussiPour(userId)`, qui compte en mémoire, et le compte
 * part en base toutes les `FLUX_MS`. Sans base branchée (une suite qui monte
 * un moteur seul), rien n'est gardé.
 *
 * Un compte perdu au redémarrage coûte au plus quelques secondes de chants :
 * c'est un jeu de tribune, pas un grand livre.
 */

const FLUX_MS = 15000;

let pool = null;
const enAttente = new Map();

/** Un chant réussi de plus pour ce supporter (ou `n`). */
export function chantReussiPour(userId, n = 1) {
  if (!pool || !userId || !(n > 0)) return;
  enAttente.set(userId, (enAttente.get(userId) ?? 0) + n);
}

/**
 * Écrit les chants en attente : une ligne par supporter, sur son club suivi
 * et le lundi de la semaine. Un supporter sans club ne nourrit aucun boss.
 */
export async function verserLaVoix() {
  if (!pool || !enAttente.size) return;
  const lot = [...enAttente];
  enAttente.clear();
  for (const [userId, n] of lot) {
    try {
      await pool.execute(
        `INSERT INTO jeux_boss (team_id, semaine, user_id, coups)
         SELECT main_team_id, CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY, public_id, ?
           FROM users WHERE public_id = ? AND main_team_id IS NOT NULL
         ON DUPLICATE KEY UPDATE coups = coups + VALUES(coups)`, [n, userId]);
    } catch (e) {
      if (e?.code !== 'ER_NO_SUCH_TABLE') console.error('[jeux] voix', e.message);
    }
  }
}

/** Branche la base, et le flux régulier. Rend la fonction qui débranche. */
export function brancherLaVoix(p) {
  pool = p;
  const t = setInterval(() => { verserLaVoix().catch(() => {}); }, FLUX_MS);
  t.unref?.();
  return () => { clearInterval(t); pool = null; enAttente.clear(); };
}
