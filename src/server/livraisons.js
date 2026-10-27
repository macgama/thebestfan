/**
 * Le compte des mises en ligne, qui fait monter le numéro du menu.
 *
 * ## Pourquoi au démarrage, et pas à la construction
 *
 * La mise en ligne passe par le Manager Infomaniak : une construction, puis un
 * redémarrage. Rien ne garantit que `git` soit là pendant la construction, et
 * compter les commits d'un dépôt sans lui demande de lire ses paquets. Le
 * serveur, lui, sait déjà quel code il fait tourner (`commitDuDepot`, ou le
 * fichier `VERSION`) : à chaque démarrage, il compare ce repère au dernier
 * qu'il a noté. Différent, c'est une mise en ligne : le compte monte d'un.
 * Pareil, c'est un simple redémarrage : rien ne bouge.
 *
 * ## Pourquoi dans `reglages`
 *
 * C'est la table clé-valeur qui existe déjà, gardée par la remise à zéro de
 * saison : le numéro ne repart pas en arrière quand on vide les comptes. Aucun
 * schéma à appliquer. La clé est hors du registre, comme `series_actives` :
 * personne ne doit la régler depuis l'écran d'administration.
 *
 * ## Pourquoi le verrou
 *
 * Deux processus qui démarrent ensemble sur le même commit ne doivent compter
 * qu'une livraison. `FOR UPDATE` dans une transaction suffit.
 */
export const CLE = 'version.livraisons';

/** Lit une colonne JSON, que le pilote rend analysée ou non. */
function lire(v) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
}

/**
 * Note le code qui démarre et rend le nombre de livraisons.
 *
 * `repere` : le commit, ou à défaut l'empreinte du jeu. Sans repère, on lit le
 * compte sans le toucher : on ne saurait pas dire si quelque chose a changé.
 * La toute première fois, le compte part à 1 : c'est déjà une mise en ligne.
 */
export async function compterLivraison(pool, repere) {
  const cnx = await pool.getConnection();
  try {
    await cnx.beginTransaction();
    const [rows] = await cnx.query(
      'SELECT valeur FROM reglages WHERE cle = ? FOR UPDATE', [CLE]);
    const avant = rows.length ? lire(rows[0].valeur) : null;
    const n = Math.max(0, Math.trunc(Number(avant?.n) || 0));
    if (!repere || avant?.repere === repere) {
      await cnx.commit();
      return n;
    }
    const apres = { n: n + 1, repere, le: new Date().toISOString() };
    await cnx.query(
      `INSERT INTO reglages (cle, valeur) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
      [CLE, JSON.stringify(apres)]);
    await cnx.commit();
    return apres.n;
  } catch (e) {
    try { await cnx.rollback(); } catch { /* déjà perdue */ }
    throw e;
  } finally {
    cnx.release();
  }
}
