/**
 * « Signaler un problème » : un joueur décrit ce qu'il voit, et Gaël le
 * reçoit par mail.
 *
 * ## Pourquoi un mail et pas une table
 *
 * Demandé par Gaël le 25 octobre 2026, avant d'ouvrir le jeu à une vingtaine
 * de bêta-testeurs. Ils lui écrivaient déjà : le mail est l'endroit où il lit
 * leurs retours. Une table demanderait un schéma et un écran de plus dans
 * /admin, pour vingt personnes qui ont son adresse. Le mail part avec
 * `Reply-To` sur l'adresse du joueur : répondre, c'est lui répondre.
 *
 * ## Ce que le mail dit en plus du texte
 *
 * La page, l'écran, le navigateur, la langue et la version : les cinq
 * questions qu'on pose à chaque retour (« sur quelle page ? », « quel
 * téléphone ? », « as-tu rechargé ? »). La page les envoie ; le serveur les
 * borne, il ne les croit pas plus loin que ça.
 *
 * ## À qui
 *
 * `SIGNALEMENTS_A` si elle est posée (une ou plusieurs adresses, séparées par
 * des virgules), sinon les comptes administrateurs de la base. Sans
 * destinataire ni SMTP, le signalement retombe dans la console du serveur,
 * comme tous les mails du jeu : il n'est pas perdu, il est dans les journaux.
 */
import express from 'express';
import { ETIQUETTE } from '../../shared/version.js';

/** Bornes : un signalement se lit d'une traite, et le mail reste un mail. */
export const TEXTE_MIN = 5;
export const TEXTE_MAX = 2000;
/** Cinq par heure et par joueur : assez pour tout dire, trop peu pour noyer. */
export const PAR_HEURE = 5;

const borne = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, n);

export function createSignalement({ pool, requireAuth, mailer, destinataires = process.env.SIGNALEMENTS_A }) {
  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));

  /* Le débit, en mémoire : un redémarrage le remet à zéro, et c'est sans
     importance pour cinq messages par heure. */
  const envois = new Map();
  const peutEnvoyer = (id, t = Date.now()) => {
    const recents = (envois.get(id) ?? []).filter((x) => t - x < 3_600_000);
    if (recents.length >= PAR_HEURE) { envois.set(id, recents); return false; }
    recents.push(t);
    envois.set(id, recents);
    return true;
  };

  async function aQui() {
    const fixes = String(destinataires ?? '').split(',').map((e) => e.trim()).filter(Boolean);
    if (fixes.length) return fixes;
    const [rows] = await pool.execute(`SELECT email FROM users WHERE role = 'admin' AND email IS NOT NULL`);
    return rows.map((r) => r.email).filter(Boolean);
  }

  router.post('/', requireAuth, async (req, res) => {
    const texte = borne(req.body?.texte, TEXTE_MAX);
    if (texte.length < TEXTE_MIN) return res.status(400).json({ error: 'signalement.error.trop_court' });
    if (!peutEnvoyer(req.user.id)) return res.status(429).json({ error: 'signalement.error.trop_souvent' });

    const u = req.user;
    const contexte = [
      `Joueur : ${u.pseudo} <${u.email}>`,
      `Page : ${borne(req.body?.page, 200) || '—'}`,
      `Écran : ${borne(req.body?.ecran, 40) || '—'}`,
      `Navigateur : ${borne(req.body?.navigateur, 300) || '—'}`,
      `Langue : ${borne(req.body?.langue, 10) || u.locale || '—'}`,
      `Version : ${ETIQUETTE}${borne(req.body?.construction, 40) ? ` (${borne(req.body?.construction, 40)})` : ''}`,
    ].join('\n');

    try {
      const a = await aQui();
      const envoi = await mailer.sendSignalement({
        to: a.length ? a.join(', ') : 'console',
        replyTo: u.email, pseudo: u.pseudo, texte, contexte,
      });
      if (!a.length) console.warn('[signalement] aucun destinataire : SIGNALEMENTS_A vide et aucun administrateur');
      res.json({ ok: true, livre: Boolean(envoi?.delivered) });
    } catch (e) {
      console.error('[signalement]', e.message);
      console.log(`\n[signalement de ${u.pseudo}]\n${texte}\n${contexte}\n`);
      res.json({ ok: true, livre: false });
    }
  });

  return { router };
}
