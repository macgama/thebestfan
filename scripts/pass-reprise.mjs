/**
 * La reprise des abonnements d'avant par le PASS de saison.
 *
 * ## Ce que Gaël a validé (2 novembre 2026)
 *
 * L'abonnement mensuel ou annuel est remplacé par un PASS payé une fois, qui
 * vaut pour une saison. Les joueurs déjà abonnés ne perdent rien :
 *
 *   - **Un abonnement Stripe en cours** ne se renouvelle plus
 *     (`cancel_at_period_end` chez Stripe). Le joueur garde tout jusqu'à la
 *     fin de sa période déjà payée, et reçoit le PASS de la saison où cette
 *     période se termine.
 *   - **Un abonnement offert** (bêta-testeurs, depuis /admin) devient le PASS
 *     de la saison en cours ; sa ligne d'abonnement s'arrête au dernier jour
 *     de cette saison, au lieu de courir sans terme.
 *   - Un abonnement déjà terminé ne donne rien.
 *
 * ## Les gardes
 *
 * - Sans `--pour-de-bon`, c'est un **essai** : il montre ce qu'il ferait et
 *   ne touche à rien, ni à la base ni chez Stripe.
 * - On peut le relancer : un PASS déjà posé ne se pose pas deux fois
 *   (`INSERT IGNORE`), une résiliation déjà demandée se redemande sans effet.
 * - Sans STRIPE_SECRET_KEY, il s'arrête s'il y a des abonnements Stripe en
 *   cours : on ne pose pas un PASS en laissant Stripe prélever.
 *
 * Usage, en SSH, dans le dossier du site, après `npm run schema:appliquer` :
 *
 *     npm run pass:reprise-essai              (ne touche à rien)
 *     npm run pass:reprise                    (pour de bon)
 *
 * Pas besoin de redémarrer ensuite : tout est lu dans la base.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.stripe.com/v1';
const jourDe = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? '').slice(0, 10));

/**
 * La saison où tombe ce jour : celle dont l'ouverture et la fin l'encadrent.
 * Une saison lancée sans `ouvre_le` s'ouvre au jour de son lancement. Au-delà
 * de la dernière fin connue, la dernière saison ; avant tout, la première.
 *
 * @param {{numero:number, ouvre:string|null, fin:string|null}[]} saisons
 */
export function saisonDuJour(saisons, jour) {
  const j = jourDe(jour);
  const datees = saisons.filter((s) => s.ouvre && s.fin)
    .sort((a, b) => a.ouvre.localeCompare(b.ouvre));
  if (!datees.length) return null;
  const dedans = datees.find((s) => s.ouvre <= j && j <= s.fin);
  if (dedans) return dedans;
  if (j > datees.at(-1).fin) return datees.at(-1);
  /* Entre deux saisons : la suivante. */
  return datees.find((s) => s.ouvre > j) ?? datees[0];
}

/**
 * Ce que la reprise fera, ligne par ligne, sans rien écrire.
 *
 * @param {object[]} abonnements  les lignes de `abonnements`
 * @param {object[]} saisons      `{ numero, ouvre, fin, lancee }`
 * @param {Date} maintenant
 * @returns {{ user_id, quoi: 'stripe'|'offert'|'fini', saison: number|null,
 *   reference: string|null, finAbo: string|null }[]}
 */
export function planifier(abonnements, saisons, maintenant = new Date()) {
  const aujourdhui = jourDe(maintenant);
  const lancees = saisons.filter((s) => s.lancee);
  const enCours = saisonDuJour(lancees.length ? lancees : saisons, aujourdhui);
  return abonnements.map((a) => {
    const fin = a.fin ? new Date(a.fin) : null;
    const actif = fin === null || fin > maintenant;
    if (!actif) return { user_id: a.user_id, quoi: 'fini', saison: null, reference: null, finAbo: null };
    if (a.source === 'stripe' && a.reference && fin) {
      const s = saisonDuJour(saisons, fin) ?? enCours;
      return { user_id: a.user_id, quoi: 'stripe', saison: s?.numero ?? null,
        reference: a.reference, finAbo: null };
    }
    /* Offert (ou Stripe sans référence : rien à résilier chez Stripe). Sa
       ligne s'arrête avec la saison en cours. */
    return { user_id: a.user_id, quoi: 'offert', saison: enCours?.numero ?? null, reference: null,
      finAbo: fin === null && enCours?.fin ? `${enCours.fin} 23:59:59.000` : null };
  });
}

function sortir(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function principal() {
  const pourDeBon = process.argv.slice(2).includes('--pour-de-bon');
  const url = process.env.DATABASE_URL;
  if (!url) sortir('DATABASE_URL est absent. Sur le serveur, il vit dans .env : lance « npm run pass:reprise-essai ».');
  const mysql = await import('mysql2/promise');
  const db = await mysql.createConnection({ uri: url, charset: 'utf8mb4', timezone: 'Z', dateStrings: false });
  const q = async (sql, params = []) => (await db.query(sql, params))[0];

  try {
    await q('SELECT 1 FROM user_pass LIMIT 1').catch(() =>
      sortir('La table user_pass manque : lance d\'abord « npm run schema:appliquer ».'));
    const abos = await q('SELECT user_id, formule, source, reference, debut, fin FROM abonnements')
      .catch(() => []);
    const saisons = (await q(
      `SELECT numero, DATE_FORMAT(COALESCE(ouvre_le, DATE(lancee_a)), '%Y-%m-%d') AS ouvre,
              DATE_FORMAT(fin_le, '%Y-%m-%d') AS fin, lancee_a IS NOT NULL AS lancee
         FROM saisons`)).map((s) => ({ numero: Number(s.numero), ouvre: s.ouvre, fin: s.fin,
      lancee: Boolean(s.lancee) }));
    const plan = planifier(abos, saisons, new Date());

    const stripes = plan.filter((p) => p.quoi === 'stripe');
    const offerts = plan.filter((p) => p.quoi === 'offert');
    console.log(`\n${pourDeBon ? 'POUR DE BON' : 'ESSAI (rien n\'est touché)'}`);
    console.log(`  ${abos.length} abonnement(s) dans la base`);
    console.log(`  ${stripes.length} Stripe en cours : résiliation à l'échéance, puis PASS de la saison où elle tombe`);
    console.log(`  ${offerts.length} offert(s) : PASS de la saison en cours`);
    console.log(`  ${plan.filter((p) => p.quoi === 'fini').length} déjà terminé(s) : rien`);
    for (const p of plan.filter((x) => x.quoi !== 'fini')) {
      console.log(`    ${p.user_id}  ${p.quoi.padEnd(6)}  PASS ${p.saison ?? '?'}${p.finAbo ? `  (abonnement jusqu'au ${p.finAbo.slice(0, 10)})` : ''}`);
    }
    if (plan.some((p) => p.quoi !== 'fini' && p.saison == null)) {
      sortir('Aucune saison datée dans la base : impossible de savoir quel PASS donner.');
    }
    const cle = process.env.STRIPE_SECRET_KEY || '';
    if (stripes.length && !cle) {
      sortir('Il y a des abonnements Stripe en cours, mais STRIPE_SECRET_KEY est absent : rien n\'est touché.');
    }
    if (!pourDeBon) {
      console.log('\nC\'était un essai. Pour de bon : npm run pass:reprise\n');
      return;
    }

    /* Stripe d'abord : un PASS posé pendant que Stripe prélève encore serait
       un double paiement. Un échec arrête tout, et une relance reprend. */
    for (const p of stripes) {
      const r = await fetch(`${API}/subscriptions/${encodeURIComponent(p.reference)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ cancel_at_period_end: 'true' }).toString(),
      });
      const j = await r.json().catch(() => ({}));
      /* Un abonnement déjà supprimé chez Stripe n'a plus rien à résilier. */
      if (!r.ok && j?.error?.code !== 'resource_missing') {
        sortir(`Stripe refuse de résilier ${p.reference} : ${j?.error?.message ?? r.status}. Rien d'autre n'est fait ; relance une fois réglé.`);
      }
    }

    await db.beginTransaction();
    let poses = 0;
    for (const p of plan.filter((x) => x.quoi !== 'fini')) {
      const [r] = await db.query(
        'INSERT IGNORE INTO user_pass (user_id, saison, source, reference) VALUES (?, ?, ?, ?)',
        [p.user_id, p.saison, p.quoi === 'stripe' ? 'stripe' : 'offert', p.reference ?? 'reprise']);
      poses += r.affectedRows;
      if (p.finAbo) await db.query('UPDATE abonnements SET fin = ? WHERE user_id = ? AND fin IS NULL', [p.finAbo, p.user_id]);
    }
    await db.query(
      `INSERT INTO admin_audit (acteur, action, cible, detail) VALUES ('ssh:pass-reprise', 'pass.reprise', NULL, ?)`,
      [JSON.stringify({ stripe: stripes.length, offerts: offerts.length, poses })]).catch(() => {});
    await db.commit();
    console.log(`\nFait : ${stripes.length} résiliation(s) à l'échéance chez Stripe, ${poses} PASS posé(s).\n`);
  } catch (e) {
    await db.rollback().catch(() => {});
    sortir(`Échec : ${e.message}. La base n'a pas été modifiée.`);
  } finally {
    await db.end().catch(() => {});
  }
}

const lance = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (lance) principal();
