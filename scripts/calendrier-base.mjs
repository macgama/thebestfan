/**
 * Passer au calendrier des PASS : la BASE d'abord, puis un PASS par saison.
 *
 * Demande de Gaël du 3 novembre 2026 (carte « Oui, BASE puis PASS 1 au
 * 1.12 ») : la saison lancée le 26 octobre devient la **saison 0, la BASE**,
 * jusqu'au 30 novembre ; le PASS 1 s'ouvre seul le 1er décembre. Les PASS
 * suivent les saisons météorologiques (`src/shared/saisons-prevues.js`) :
 *
 *   PASS 1  1er décembre 2026 – 28 février 2027   Les héros du canapé (HC), tenue Préhistorique
 *   PASS 2  1er mars – 31 mai 2027                 Les phénomènes météo (MT)
 *   PASS 3  1er juin – 31 août 2027                Les galères de déplacement (GD)
 *   PASS 4  1er septembre – 30 novembre 2027       Les revenants (RV)
 *
 * Ce que fait le script, d'un bloc :
 *   - la saison lancée numéro 1 prend le numéro 0, son dernier jour devient
 *     le 30 novembre 2026 ; son nom, ses listes (la BASE) et son carnet
 *     restent ; son annonce ne parle plus de « saison 1 » ;
 *   - les brouillons des séries HC, MT, GD et RV prennent les numéros 1 à 4,
 *     leurs dates, leur nom, leur annonce et leur carnet de trois mois ; un
 *     brouillon absent est créé ;
 *   - le PASS 1 garde Préhistorique (`saisons.tenue_pass` si la colonne existe).
 *
 * Rien chez les joueurs ne bouge : leurs PASS (`user_pass.saison = 1`) restent
 * le PASS 1, actif tout de suite pendant la BASE ; leurs tampons restent ceux
 * de la saison actuelle (rangés par son identifiant, qui ne change pas).
 *
 *     npm run calendrier:essai        (ne touche à rien, montre l'avant et l'après)
 *     npm run calendrier:appliquer    (pour de bon : taper CALENDRIER)
 *
 * Puis redémarrer le site dans le Manager.
 */
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAISONS_PREVUES, CARNET_TRIMESTRE } from '../src/shared/saisons-prevues.js';
import { STUFF } from '../src/shared/fanzzy/inventaire.js';

export const FIN_BASE = '2026-11-30';
export const TEXTE_BASE = 'TBFO est lancé : tous les championnats du monde et, pour tous, les Fanzzy '
  + 'de La Reprise et des Terraces (Premier League).';

const lireListe = (v) => {
  const x = typeof v === 'string' ? JSON.parse(v || '[]') : (v ?? []);
  return Array.isArray(x) ? x.map(String) : [];
};

/**
 * Le plan, sans rien écrire : `{ erreur }` ou `{ base, pass: [{ id|null, ... }] }`.
 * `saisons` : les lignes de la table (id, numero, nom, series, lancee_a).
 */
export function planifier(saisons) {
  const lancees = saisons.filter((s) => s.lancee_a != null);
  if (saisons.some((s) => Number(s.numero) === 0)) {
    return { erreur: 'Une saison 0 existe déjà : le calendrier est sans doute déjà appliqué.' };
  }
  const s1 = saisons.filter((s) => Number(s.numero) === 1);
  if (s1.length !== 1 || s1[0].lancee_a == null) {
    return { erreur: `Attendu une seule saison numéro 1, lancée ; trouvé ${s1.length}.` };
  }
  if (lancees.length !== 1) {
    return { erreur: `Attendu une seule saison lancée (la 1), trouvé ${lancees.length}.` };
  }
  const base = s1[0];
  const pris = new Set([base.id]);
  const pass = SAISONS_PREVUES.map((p) => {
    /* Par sa série, ou à défaut par son nom : en production, le brouillon
       des héros du canapé n'a pas pu nommer HC (aucune carte encore publiée,
       la création refuse une série vide de cartes) et sa liste est vide. */
    const libre = (s) => !pris.has(s.id) && s.lancee_a == null;
    const memeNom = (s) => String(s.nom ?? '').trim().toLowerCase() === p.nom.toLowerCase();
    const brouillon = saisons.find((s) => libre(s) && lireListe(s.series).includes(p.series[0]))
      ?? saisons.find((s) => libre(s) && memeNom(s));
    if (brouillon) pris.add(brouillon.id);
    return {
      id: brouillon?.id ?? null, avant: brouillon ? Number(brouillon.numero) : null,
      numero: p.numero, nom: p.nom, texte: p.texte, ouvre: p.ouvre, fin: p.fin,
      /* Toujours sa série, en plus de ce que le brouillon nommait déjà. */
      series: [...new Set([...p.series, ...(brouillon ? lireListe(brouillon.series) : [])])],
      stuff: p.stuff ? STUFF.filter((x) => x.id.startsWith(p.stuff)).map((x) => x.id) : [],
      tenue: p.tenue ?? null,
    };
  });
  /* Un autre brouillon resté sur un numéro 1 à 4 ferait deux PASS au même
     numéro : on s'arrête plutôt que de deviner. */
  const autres = saisons.filter((s) => !pris.has(s.id));
  const collision = autres.find((s) => pass.some((p) => p.numero === Number(s.numero)));
  if (collision) {
    return { erreur: `Le brouillon « ${collision.nom} » (numéro ${collision.numero}) n'est `
      + 'aucune des séries HC, MT, GD, RV et garde un numéro de PASS. Change son numéro dans /admin.' };
  }
  return { base: { id: base.id, nom: base.nom }, pass, autres };
}

/** Écrire le plan, dans une transaction. `q(sql, params)`. */
export async function appliquer(q, plan, { tenuePass = false } = {}) {
  await q('START TRANSACTION');
  try {
    await q('UPDATE saisons SET numero = 0, fin_le = ?, texte = ? WHERE id = ?',
      [FIN_BASE, TEXTE_BASE, plan.base.id]);
    if (tenuePass) await q(`UPDATE saisons SET tenue_pass = '' WHERE id = ?`, [plan.base.id]);
    for (const p of plan.pass) {
      const valeurs = [p.numero, p.nom, p.texte, JSON.stringify(p.series), JSON.stringify(p.stuff),
        p.ouvre, p.fin, JSON.stringify(CARNET_TRIMESTRE)];
      let id = p.id;
      if (id) {
        await q(`UPDATE saisons SET numero = ?, nom = ?, texte = ?, series = ?, stuff = ?,
                   ouvre_le = ?, fin_le = ?, carnet = ? WHERE id = ?`, [...valeurs, id]);
      } else {
        const r = await q(`INSERT INTO saisons (numero, nom, texte, series, stuff, ouvre_le, fin_le,
                             carnet, tenues, actions, stades)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', '[]')`, valeurs);
        id = r.insertId;
      }
      if (tenuePass && p.tenue) await q('UPDATE saisons SET tenue_pass = ? WHERE id = ?', [p.tenue, id]);
    }
    await q(`INSERT INTO admin_audit (acteur, action, cible, detail)
             VALUES ('calendrier', 'saisons.calendrier', 'base', ?)`,
    [JSON.stringify({ base: plan.base.id, pass: plan.pass.map((p) => ({ id: p.id, numero: p.numero })) })])
      .catch(() => {});
    await q('COMMIT');
  } catch (e) {
    await q('ROLLBACK');
    throw e;
  }
}

const lance = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (lance) await principal();

async function principal() {
  const pourDeBon = process.argv.includes('--pour-de-bon');
  const url = process.env.DATABASE_URL;
  if (!url) sortir('DATABASE_URL est absent. Lance-le depuis ~/sites/thebestfan.online : npm run calendrier:essai');

  const mysql = await import('mysql2/promise');
  const db = await mysql.createConnection({ uri: url, charset: 'utf8mb4', timezone: 'Z' });
  const q = async (sql, p) => (await db.query(sql, p))[0];

  console.log('');
  console.log(pourDeBon ? '  CALENDRIER DES PASS — POUR DE BON' : '  CALENDRIER DES PASS — ESSAI (rien ne sera modifié)');
  console.log('');

  const saisons = await q(`SELECT id, numero, nom, series, lancee_a,
      DATE_FORMAT(ouvre_le, '%Y-%m-%d') AS ouvre_le, DATE_FORMAT(fin_le, '%Y-%m-%d') AS fin_le
      FROM saisons ORDER BY numero, id`);
  console.log('  Avant :');
  for (const s of saisons) {
    console.log(`    ${String(s.numero).padStart(2)}  ${s.lancee_a ? 'lancée   ' : 'brouillon'}  `
      + `${s.ouvre_le ?? '—'} → ${s.fin_le ?? '—'}  ${s.nom}`);
  }
  const plan = planifier(saisons);
  if (plan.erreur) sortir(`${plan.erreur} Rien n'a été touché.`);

  const [col] = await q(`SELECT COUNT(*) AS n FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'saisons' AND column_name = 'tenue_pass'`);
  const tenuePass = Number(col.n) > 0;
  const [pass] = await q('SELECT COUNT(*) AS n FROM user_pass WHERE saison = 1').catch(() => [{ n: 0 }]);

  console.log('');
  console.log('  Après :');
  console.log(`     0  lancée     … → ${FIN_BASE}  ${plan.base.nom}  (la BASE)`);
  for (const p of plan.pass) {
    console.log(`    ${String(p.numero).padStart(2)}  brouillon  ${p.ouvre} → ${p.fin}  ${p.nom}`
      + `${p.id ? '' : '  (créé)'}${p.tenue ? `  tenue des membres : ${p.tenue}` : ''}`);
  }
  for (const s of plan.autres) console.log(`    ${String(s.numero).padStart(2)}  inchangé   ${s.nom}`);
  console.log('');
  console.log(`  PASS 1 déjà donnés ou achetés : ${pass.n} — ils restent, actifs tout de suite.`);
  if (!tenuePass) console.log('  Colonne tenue_pass absente : lance d\'abord npm run schema:appliquer.');
  console.log('');

  if (!pourDeBon) {
    console.log('  Essai terminé : rien n\'a été modifié. Pour de bon : npm run calendrier:appliquer');
    await db.end();
    return;
  }
  if (!tenuePass) sortir('Lance d\'abord npm run schema:appliquer. Rien n\'a été touché.');
  const reponse = await demander('  Tape CALENDRIER pour appliquer (autre chose annule) : ');
  if (reponse.trim().toUpperCase() !== 'CALENDRIER') sortir('Annulé. Rien n\'a été touché.');
  await appliquer(q, plan, { tenuePass });
  await db.end();
  console.log('');
  console.log('  Fait. Redémarre maintenant le site dans le Manager Infomaniak.');
  console.log('');
}

function sortir(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function demander(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    process.stdout.write(question);
    let fait = false;
    rl.once('line', (l) => { fait = true; rl.close(); resolve(l); });
    rl.once('close', () => { if (!fait) resolve(''); });
  });
}
