/**
 * Les couleurs des clubs : quand les chercher, et où les ranger.
 *
 * L'extraction elle-même vit dans `blason.js`. Ce module-ci décide **quand**
 * elle a lieu, et c'est là que se joue la seule chose qui compte : elle ne
 * doit jamais faire attendre un joueur.
 *
 * Le blason est téléchargé une fois par club, sur le CDN de l'API — donc
 * **hors quota**, ce n'est pas un appel d'API. Le résultat s'écrit en base et
 * n'est plus jamais redemandé. L'échec s'écrit aussi : sans cela, un blason
 * illisible serait retéléchargé à chaque affichage du match, indéfiniment.
 *
 * Le travail est lancé **à côté** de la réponse, jamais dedans : la liste des
 * matchs part avec les couleurs qu'on a, et les nouvelles arrivent au prochain
 * chargement. Un écran qui attend un téléchargement d'image pour s'afficher
 * est une régression qu'aucun joueur ne pardonne, pour un bénéfice qui est un
 * dégradé de couleur.
 */
import { couleursDuBlason, FormatDeBlason } from './blason.js';

/**
 * Les couleurs posées à la main, par identifiant de club (celui de l'API).
 *
 * Pour les clubs dont le blason ne se lit pas (JPEG, page d'erreur…) ou se
 * lit mal. Elles passent avant toute lecture et ne sont jamais écrasées par
 * elle. Deux couleurs CSS, la seconde peut être `null`.
 */
export const COULEURS_A_LA_MAIN = {
  3728: ['#04569C', '#ECE404'],   // FK Varnsdorf (Tchéquie) : bleu et jaune
  7312: ['#FBE10D', '#0064AC'],   // FK Králův Dvůr (Tchéquie) : jaune et bleu
};

/** Au plus ce nombre de blasons par vague : un soir de Coupe d'Europe en
    présente une quarantaine d'un coup, et rien ne presse. */
const PAR_VAGUE = 6;

/** Le blason d'un club pèse quelques kilo-octets ; au-delà, c'est autre chose. */
const TAILLE_MAX = 512 * 1024;
const DELAI_MS = 6000;

export function createCouleurs({ pool, fetchImpl = fetch, log = console,
  aLaMain = COULEURS_A_LA_MAIN }) {
  const q = (sql, p) => pool.query(sql, p).then(([r]) => r);

  /* Les clubs dont on s'occupe déjà. Deux joueurs qui ouvrent le même match à
     la même seconde ne doivent pas télécharger deux fois le même blason. */
  const enCours = new Set();

  /* Les couleurs à la main déjà vérifiées en base depuis le démarrage, et
     les formats illisibles déjà signalés : un seul mot par format, pas un
     par club. */
  const mainFaites = new Set();
  const formatsDits = new Set();

  async function poserALaMain(liste) {
    let faits = 0;
    for (const id of liste) {
      const c = aLaMain[id];
      if (!c || mainFaites.has(id)) continue;
      mainFaites.add(id);
      const [c1, c2 = null] = c;
      const r = await pool.query(
        `UPDATE teams SET color1 = ?, color2 = ?, colors_at = NOW()
          WHERE id = ? AND (color1 IS NULL OR color1 <> ? OR NOT (color2 <=> ?))`,
        [c1, c2, id, c1, c2]);
      faits += r[0]?.affectedRows ?? 0;
    }
    return faits;
  }

  /**
   * Télécharge un blason et rend ses couleurs.
   * Ne lève pas : un blason absent, lent ou illisible n'est pas une panne.
   */
  async function lire(url) {
    const stop = AbortSignal.timeout ? AbortSignal.timeout(DELAI_MS) : undefined;
    const r = await fetchImpl(url, { signal: stop });
    if (!r.ok) throw new Error(`blason : le serveur répond ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > TAILLE_MAX) {
      throw new Error(`blason : ${buf.length} octets, au-delà de la limite`);
    }
    return couleursDuBlason(buf);
  }

  /**
   * S'assure que ces clubs ont leurs couleurs, sans faire attendre personne.
   *
   * @param {number[]} ids
   * @param {object}   [opt]
   * @param {boolean}  [opt.rejouer]  reprendre aussi les échecs précédents.
   * @returns {Promise<number>} le nombre de clubs mis à jour. La valeur n'est
   *   lue que par le script de remplissage et par les tests : les routes, elles,
   *   n'attendent pas cette promesse.
   */
  async function assurer(ids = [], { rejouer = false, parVague = PAR_VAGUE } = {}) {
    const liste = [...new Set(ids.map(Number).filter(Number.isInteger))];
    if (!liste.length) return 0;

    let faits = await poserALaMain(liste);
    const aLire = liste.filter((id) => !aLaMain[id]);
    if (!aLire.length) return faits;

    const manquants = await q(
      `SELECT id, logo FROM teams
        WHERE id IN (?) AND logo IS NOT NULL
          AND ${rejouer ? 'color1 IS NULL' : 'colors_at IS NULL'}
        LIMIT ?`,
      [aLire, parVague]);

    for (const t of manquants) {
      if (enCours.has(t.id)) continue;
      enCours.add(t.id);
      try {
        const { c1, c2 } = await lire(t.logo);
        await q(`UPDATE teams SET color1 = ?, color2 = ?, colors_at = NOW() WHERE id = ?`,
          [c1, c2, t.id]);
        faits++;
      } catch (e) {
        /* On écrit la tentative même ratée, et on dit pourquoi une fois. Le
           club gardera la couleur par défaut du jeu — ce qui est un défaut
           acceptable, contrairement à un téléchargement répété sans fin. */
        await q(`UPDATE teams SET colors_at = NOW() WHERE id = ?`, [t.id]).catch(() => {});
        if (e instanceof FormatDeBlason) {
          if (!formatsDits.has(e.format)) {
            formatsDits.add(e.format);
            log.warn?.(`[couleurs] club ${t.id} : ${e.message} — couleurs par défaut `
              + `(les autres blasons ${e.format} ne seront pas signalés)`);
          }
        } else {
          log.warn?.(`[couleurs] club ${t.id} : ${e.message}`);
        }
      } finally {
        enCours.delete(t.id);
      }
    }
    return faits;
  }

  /**
   * La version qu'on appelle depuis une route : elle part travailler seule.
   * Le `catch` est indispensable — une promesse rejetée sans écoute abat le
   * processus Node, et ce serait le jeu entier tombé pour une couleur.
   */
  function assurerPlusTard(ids, opt) {
    assurer(ids, opt).catch((e) => log.warn?.(`[couleurs] ${e.message}`));
  }

  return { assurer, assurerPlusTard };
}
