/**
 * La collection d'un joueur, vue et complétée depuis l'administration, et les
 * KOP.
 *
 * Demande de Gaël du 28 octobre 2026 : « tout ce qui doit être ajouté pour
 * bien administrer l'application, le plus simple possible ». L'écran JOUEURS
 * offrait des écharpes, des boosters et le PASS, mais ne montrait rien de ce
 * qu'un joueur possède : à un bêta-testeur qui écrit « mon Fanzzy a disparu »,
 * on ne pouvait ni vérifier, ni rendre. On voit donc ici ses Fanzzy, ses
 * skins, ses cartes Ultimate, son équipement, ses stades, ses amis et ses KOP,
 * et l'on peut lui offrir un Fanzzy, un skin, une carte Ultimate ou une pièce.
 *
 * **On offre, on ne retire pas.** Rien ici n'efface une ligne d'un joueur :
 * un geste d'administration qui retire une carte gagnée serait la seule façon
 * de perdre ce qu'on possède, et c'est précisément ce que le jeu promet de ne
 * jamais faire. Le seul effacement est celui d'un KOP, à la demande (un nom
 * choquant, un groupe abandonné) : ses membres ne perdent rien de leur
 * collection, seulement le groupe et son pot.
 *
 * Chaque cadeau suit les mêmes écritures qu'un booster (`fanzzy/index.js`) :
 * le Fanzzy avec sa tenue de base au premier âge, le skin et la carte Ultimate
 * sur un âge déjà atteint d'un Fanzzy possédé, et la nouveauté qui allume le
 * badge chez le joueur. Tout est journalisé sous `joueur.offert`.
 */
import { parIdentifiant, racineDe, lignee, personnages } from '../fanzzy/catalogue.js';
import { toutesTenues, tenuePar } from '../fanzzy/tenues.js';
import { STUFF, STUFF_BY_ID } from '../../shared/fanzzy/inventaire.js';
import { STADES } from '../../shared/stades.js';
import { ETAT_ULTIME } from '../../shared/ultime.js';
import { nomValide } from '../../shared/kop.js';

/** Une table que la base n'a pas encore : on lit « rien », l'écran reste debout. */
const sansTable = (e, vide) => {
  if (e?.code === 'ER_NO_SUCH_TABLE') return vide;
  throw e;
};

export function createCollectionAdmin({ q, pool, journal, fail }) {
  async function cible(id) {
    const [u] = await q(`SELECT public_id, pseudo FROM users WHERE public_id = ?`, [id]);
    if (!u) throw fail('admin.error.unknown_user', 404);
    return u;
  }

  /** Ce qu'un joueur possède, rangé pour se lire d'un coup d'œil. */
  async function collection(id) {
    const u = await cible(id);
    const [fz, sk, ult, st, lieux, amis, kops] = await Promise.all([
      q(`SELECT fanzzy_id, copies, stage, club_id FROM user_fanzzy WHERE user_id = ?
          ORDER BY first_at`, [id]),
      q(`SELECT fanzzy_id, stage, skin_id FROM user_skins
          WHERE user_id = ? AND skin_id <> 'base'`, [id]),
      q(`SELECT fanzzy_id, stage FROM user_etats WHERE user_id = ? AND etat = ?`,
        [id, ETAT_ULTIME]).catch((e) => sansTable(e, [])),
      q(`SELECT stuff_id, copies FROM user_stuff WHERE user_id = ?`, [id]),
      q(`SELECT stade_id FROM user_stades WHERE user_id = ?`, [id])
        .catch((e) => sansTable(e, [])),
      q(`SELECT COUNT(*) AS n FROM amities WHERE (a = ? OR b = ?) AND etat = 'amis'`, [id, id])
        .catch((e) => sansTable(e, [{ n: 0 }])),
      q(`SELECT k.id, k.nom FROM kop_membres m JOIN kops k ON k.id = m.kop_id
          WHERE m.user_id = ?`, [id]).catch((e) => sansTable(e, [])),
    ]);

    const nomDe = (fid) => parIdentifiant(fid)?.nom ?? fid;
    return {
      joueur: { id: u.public_id, pseudo: u.pseudo },
      fanzzy: fz.map((r) => {
        const f = parIdentifiant(r.fanzzy_id);
        return { id: r.fanzzy_id, nom: f?.nom ?? r.fanzzy_id, set: f?.set ?? null,
          rar: f?.rar ?? null, age: Number(r.stage) || 1, ages: lignee(r.fanzzy_id).length || 1,
          copies: Number(r.copies) || 1, club: r.club_id ?? null };
      }),
      skins: sk.map((r) => ({ fanzzy: r.fanzzy_id, nomFanzzy: nomDe(r.fanzzy_id),
        age: Number(r.stage) || 1, id: r.skin_id, nom: tenuePar(r.skin_id)?.nom ?? r.skin_id })),
      ultimes: ult.map((r) => ({ fanzzy: r.fanzzy_id, nomFanzzy: nomDe(r.fanzzy_id),
        age: Number(r.stage) || 1 })),
      stuff: st.map((r) => ({ id: r.stuff_id, nom: STUFF_BY_ID.get(r.stuff_id)?.nom ?? r.stuff_id,
        copies: Number(r.copies) || 1 })),
      stades: lieux.map((r) => ({ id: r.stade_id,
        nom: STADES.find((s) => s.id === r.stade_id)?.nom ?? r.stade_id })),
      amis: Number(amis[0]?.n) || 0,
      kops: kops.map((k) => ({ id: k.id, nom: k.nom })),
    };
  }

  /** De quoi remplir les listes de l'écran : une fois, pas à chaque joueur. */
  function choix() {
    return {
      fanzzy: personnages().filter((f) => f.publie !== false)
        .map((f) => ({ id: f.id, nom: f.nom, set: f.set })),
      skins: toutesTenues().filter((t) => t.id !== 'base').map((t) => ({ id: t.id, nom: t.nom })),
      stuff: STUFF.map((s) => ({ id: s.id, nom: s.nom })),
    };
  }

  async function nouveaute(conn, userId, cle) {
    try {
      await conn.query(
        `INSERT INTO user_nouveautes (user_id, cle, sorte) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE got_at = got_at`, [userId, cle, cle.split(':')[0]]);
    } catch (e) { sansTable(e, null); }
  }

  /**
   * Offre une chose à un joueur. `sorte` : fanzzy, skin, ultime ou stuff.
   *
   * Le skin et la carte Ultimate visent un âge **déjà atteint** d'un Fanzzy
   * **possédé** : c'est la règle du booster, et un skin posé sur un Fanzzy
   * qu'on n'a pas serait une ligne que la fiche ne montrerait jamais.
   */
  async function offrir(acteur, id, corps, adresseIp) {
    await cible(id);
    const sorte = String(corps?.sorte ?? '');
    const conn = await pool.getConnection();
    let detail;
    try {
      const possede = async (fid) => {
        const racine = racineDe(String(fid ?? ''));
        const [[r]] = await conn.query(
          `SELECT stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?`, [id, racine]);
        if (!r) throw fail('admin.error.fanzzy_pas_possede');
        const age = corps?.age == null || corps.age === '' ? 1 : Number(corps.age);
        if (!Number.isInteger(age) || age < 1 || age > (Number(r.stage) || 1)) {
          throw fail('admin.error.age_pas_atteint');
        }
        return { racine, age };
      };

      if (sorte === 'fanzzy') {
        const racine = racineDe(String(corps?.fanzzy ?? ''));
        if (!parIdentifiant(racine)) throw fail('admin.error.fanzzy_inconnu', 404);
        await conn.query(
          `INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE copies = copies + 1`, [id, racine]);
        await conn.query(
          `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id, equipped)
           VALUES (?, ?, 1, 'base', 1)`, [id, racine]);
        await nouveaute(conn, id, `fanzzy:${racine}`);
        detail = { sorte, fanzzy: racine };
      } else if (sorte === 'skin') {
        const t = tenuePar(String(corps?.skin ?? ''));
        if (!t || t.id === 'base') throw fail('admin.error.skin_inconnu', 404);
        const { racine, age } = await possede(corps?.fanzzy);
        const [r] = await conn.query(
          `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id) VALUES (?, ?, ?, ?)`,
          [id, racine, age, t.id]);
        if (!r.affectedRows) throw fail('admin.error.deja_possede');
        await nouveaute(conn, id, `skin:${racine}:${age}:${t.id}`);
        detail = { sorte, fanzzy: racine, age, skin: t.id };
      } else if (sorte === 'ultime') {
        const { racine, age } = await possede(corps?.fanzzy);
        const [r] = await conn.query(
          `INSERT IGNORE INTO user_etats (user_id, fanzzy_id, stage, etat) VALUES (?, ?, ?, ?)`,
          [id, racine, age, ETAT_ULTIME]);
        if (!r.affectedRows) throw fail('admin.error.deja_possede');
        await nouveaute(conn, id, `etat:${racine}:${age}:${ETAT_ULTIME}`);
        detail = { sorte, fanzzy: racine, age };
      } else if (sorte === 'stuff') {
        const s = STUFF_BY_ID.get(String(corps?.stuff ?? ''));
        if (!s) throw fail('admin.error.stuff_inconnu', 404);
        await conn.query(
          `INSERT INTO user_stuff (user_id, stuff_id, copies) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE copies = copies + 1`, [id, s.id]);
        await nouveaute(conn, id, `stuff:${s.id}`);
        detail = { sorte, stuff: s.id };
      } else {
        throw fail('admin.error.sorte_inconnue');
      }
    } finally {
      conn.release();
    }
    await journal(acteur, 'joueur.offert', id, detail, adresseIp);
    return collection(id);
  }

  /* --------------------------------------------------------------- KOP */

  async function kops({ q: terme = '' } = {}) {
    const where = terme ? `WHERE k.nom LIKE ? OR t.name LIKE ?` : '';
    const args = terme ? [`%${terme}%`, `%${terme}%`] : [];
    return q(
      `SELECT k.id, k.nom, k.team_id, t.name AS club, k.pot, k.cree, u.pseudo AS createur,
              (SELECT COUNT(*) FROM kop_membres m WHERE m.kop_id = k.id) AS membres
         FROM kops k
         LEFT JOIN teams t ON t.id = k.team_id
         LEFT JOIN users u ON u.public_id = k.createur
         ${where}
        ORDER BY k.cree DESC LIMIT 100`, args)
      .then((rows) => rows.map((r) => ({ ...r, pot: Number(r.pot) || 0,
        membres: Number(r.membres) || 0 })))
      .catch((e) => sansTable(e, []));
  }

  async function kopPar(kopId) {
    const [k] = await q(`SELECT id, nom FROM kops WHERE id = ?`, [kopId]);
    if (!k) throw fail('admin.error.kop_inconnu', 404);
    return k;
  }

  async function renommerKop(acteur, kopId, nomBrut, adresseIp) {
    const k = await kopPar(kopId);
    const nom = nomValide(nomBrut);
    if (!nom) throw fail('admin.error.kop_nom');
    await q(`UPDATE kops SET nom = ? WHERE id = ?`, [nom, k.id]);
    await journal(acteur, 'kop.renomme', k.id, { avant: k.nom, nom }, adresseIp);
    return kops();
  }

  /** Les membres, les votes, les bonus et les invitations partent en cascade. */
  async function supprimerKop(acteur, kopId, adresseIp) {
    const k = await kopPar(kopId);
    await q(`DELETE FROM kops WHERE id = ?`, [k.id]);
    await journal(acteur, 'kop.supprime', k.id, { nom: k.nom }, adresseIp);
    return kops();
  }

  return { collection, choix, offrir, kops, renommerKop, supprimerKop };
}
