import express from 'express';
import { createHash } from 'node:crypto';
import webpush from 'web-push';
import { reglage } from '../../shared/reglages.js';

/**
 * Les notifications : prévenir un joueur dont l'onglet est fermé.
 *
 * ## Ce qu'elles disent, et rien d'autre
 *
 * Deux choses, celles qui ne se rattrapent pas :
 *
 *   — **un vote du KOP qui s'ouvre.** Trois minutes, c'est court : sans un mot
 *     hors de la page, la moitié d'un KOP vote après la clôture
 *     (`ETAT.md`, § 5, point 6) ;
 *   — **un duel classé qui attend un supporter de ton club.** Les bots
 *     complètent au bout de `duel.attente_classe_sec` ; prévenu à temps, c'est
 *     toi qui tiens la tribune. L'entraînement ne prévient personne : ses bots
 *     entrent au bout de vingt secondes, avant qu'on ait déverrouillé son
 *     téléphone.
 *
 * Un message ne nomme **jamais** un joueur : le public compte des mineurs, et
 * un écran verrouillé se lit par-dessus l'épaule. Il nomme des clubs, un KOP,
 * un bonus. C'est assez pour décider de venir.
 *
 * ## Ce qui décide qu'un message part
 *
 *   1. le joueur a dit oui **sur cet appareil**, case par case, depuis la page
 *      du compte — et le navigateur l'a redemandé par sa propre fenêtre ;
 *   2. `notifications.actif` est allumé, et `sql/notifications.sql` appliqué ;
 *   3. il ne fait pas nuit à Zurich (de 22 h à 8 h) ;
 *   4. pour un duel : ce match ne lui a pas déjà été annoncé, et le dernier
 *      duel annoncé date de plus de `notifications.duel_pause_min`.
 *
 * Le service worker (`public/sw.js`) en ajoute un cinquième, côté appareil :
 * si le jeu est déjà ouvert sous les yeux du joueur, il ne montre rien — la
 * page le lui dit déjà.
 *
 * ## Les clés
 *
 * Un envoi se signe (VAPID). Les deux clés se créent seules au premier
 * démarrage et se gardent dans `notif_cles` : il n'y a rien à saisir dans le
 * Manager, et elles ne changent plus — en changer rendrait muets tous les
 * appareils inscrits. `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` passent avant,
 * si un jour on les pose dans l'environnement.
 *
 * ## Ce qui ne doit jamais arriver
 *
 * Qu'un envoi ralentisse le jeu ou le fasse tomber. Tout part **après** la
 * réponse au geste qui l'a causé, sans être attendu, et une erreur s'écrit au
 * journal sans remonter. Un appareil que le service de notification dit
 * disparu (404, 410) est oublié tout de suite.
 */

/** Les sujets, tels que les cases de la page du compte les nomment. */
export const SUJETS = ['kop', 'duel'];

/** Combien d'envois en vol à la fois : un coup d'envoi ne doit pas ouvrir mille connexions. */
const EN_VOL = 8;

/** Le temps de vie d'un message chez le service de notification, en secondes. */
const TTL = { kop: 3 * 60, duel: 2 * 60 };

/** Une table absente éteint pour dix minutes, le délai des autres replis. */
const REPLI_MS = 10 * 60_000;

/** L'heure de Zurich, de 0 à 23. Par morceaux : en français, le texte entier
    est « 23 h », que `Number` ne lit pas. */
const FORMAT_HEURE = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Zurich',
});
const heureZurich = (t) => Number(FORMAT_HEURE.formatToParts(new Date(t))
  .find((p) => p.type === 'hour')?.value);

/** La nuit : de 22 h à 8 h. Personne n'est réveillé pour un duel. */
export const estLaNuit = (t) => { const h = heureZurich(t); return h >= 22 || h < 8; };

/** L'empreinte d'une adresse d'appareil : la clé de sa ligne. */
export const empreinteAppareil = (endpoint) =>
  createHash('sha256').update(String(endpoint)).digest('hex');

/** « de FC Sion », « du Servette », « d'Arsenal » : la même règle que l'accueil. */
export function deClub(nom) {
  const m = /^(les?)\s+(\S.*)$/iu.exec(nom);
  if (m) return `${m[1].length === 2 ? 'du' : 'des'} ${m[2]}`;
  return /^[aeiouàâäéèêëîïôöùûü]/iu.test(nom) ? `d’${nom}` : `de ${nom}`;
}

/**
 * Ce qu'un appareil nous envoie, vérifié. Rend `null` si ce n'en est pas un.
 *
 * L'adresse doit être en `https://` : c'est vers elle que le serveur écrit, et
 * une adresse quelconque ferait de lui un relais vers n'importe quel hôte.
 */
export function abonnementValide(a) {
  const endpoint = a?.endpoint;
  const p256dh = a?.keys?.p256dh;
  const auth = a?.keys?.auth;
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return null;
  let url;
  try { url = new URL(endpoint); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  const b64 = /^[A-Za-z0-9_\-+/=]{8,255}$/;
  if (typeof p256dh !== 'string' || !b64.test(p256dh)) return null;
  if (typeof auth !== 'string' || !b64.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

/**
 * @param {object} o
 * @param {import('mysql2/promise').Pool} o.pool
 * @param {Function} o.requireAuth
 * @param {string} [o.origine]  l'adresse du site, qui signe les envois.
 * @param {Function} [o.envoyer]  `webpush.sendNotification` ; les suites la
 *   remplacent pour compter ce qui part sans rien envoyer.
 * @param {() => number} [o.horloge]
 * @param {Console} [o.log]
 */
export function createNotifications({ pool, requireAuth, origine = 'https://thebestfan.online',
  envoyer = (...a) => webpush.sendNotification(...a), horloge = Date.now, log = console }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  /* Le signataire doit être une adresse `https:` ou `mailto:` : un serveur de
     développement en `http://localhost` ferait refuser chaque envoi. */
  const signataire = /^https:\/\//.test(origine) ? origine : 'mailto:no-reply@thebestfan.online';

  /* ------------------------------------------------------------ les clés */

  let cles = null;
  let clesEnVol = null;
  let sansTableJusqua = 0;
  let sansTableDit = false;

  function tableAbsente(e) {
    if (e?.code !== 'ER_NO_SUCH_TABLE') return false;
    sansTableJusqua = horloge() + REPLI_MS;
    if (!sansTableDit) {
      log.warn('[notifications] table absente : appliquer sql/notifications.sql. Éteintes d’ici là.');
      sansTableDit = true;
    }
    return true;
  }

  /**
   * Les deux clés, lues ou créées. `null` si la table manque.
   *
   * **Créées une seule fois, même à deux démarrages simultanés** : on tente
   * d'écrire la ligne 1 et l'on relit toujours ce qui est en base. Le second
   * à écrire perd sa paire et prend celle du premier.
   */
  async function lesCles() {
    if (cles) return cles;
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      cles = { publique: process.env.VAPID_PUBLIC_KEY, privee: process.env.VAPID_PRIVATE_KEY };
      return cles;
    }
    if (horloge() < sansTableJusqua) return null;
    if (!clesEnVol) {
      clesEnVol = (async () => {
        try {
          let l = (await q('SELECT publique, privee FROM notif_cles WHERE id = 1'))[0];
          if (!l) {
            const k = webpush.generateVAPIDKeys();
            await q('INSERT IGNORE INTO notif_cles (id, publique, privee) VALUES (1, ?, ?)',
              [k.publicKey, k.privateKey]);
            l = (await q('SELECT publique, privee FROM notif_cles WHERE id = 1'))[0];
            log.log('[notifications] clés d’envoi créées');
          }
          if (sansTableDit) {
            log.log('[notifications] table présente : les notifications reprennent');
            sansTableDit = false;
          }
          cles = l ? { publique: l.publique, privee: l.privee } : null;
          return cles;
        } catch (e) {
          if (!tableAbsente(e)) log.error('[notifications] clés illisibles :', e.message);
          return null;
        } finally {
          clesEnVol = null;
        }
      })();
    }
    return clesEnVol;
  }

  const actives = () => reglage('notifications.actif') && horloge() >= sansTableJusqua;

  /* ------------------------------------------------------------ l'envoi */

  /**
   * Envoie un message à tous les appareils de ces joueurs qui ont dit oui à ce
   * sujet. Ne lève jamais ; rend le nombre de messages partis (pour les suites).
   */
  async function prevenir(userIds, sujet, message) {
    if (!SUJETS.includes(sujet)) return 0;
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ids.length || !actives() || estLaNuit(horloge())) return 0;
    const k = await lesCles();
    if (!k) return 0;

    let appareils;
    try {
      appareils = await q(
        `SELECT a.id, a.endpoint, a.p256dh, a.auth FROM notif_appareils a
           JOIN users u ON u.public_id = a.user_id AND u.status = 'active'
          WHERE a.${sujet} = 1 AND a.user_id IN (${ids.map(() => '?').join(',')})`, ids);
    } catch (e) {
      if (!tableAbsente(e)) log.error('[notifications] appareils illisibles :', e.message);
      return 0;
    }
    if (!appareils.length) return 0;

    const corps = JSON.stringify(message);
    const options = {
      TTL: TTL[sujet],
      urgency: 'high',
      // Le même `tag` remplace au lieu d'empiler, côté appareil ; le `topic`
      // fait de même chez le service de notification, s'il n'est pas encore
      // livré. Il n'accepte que 32 caractères de l'alphabet base64url.
      topic: String(message.tag ?? sujet).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || sujet,
      vapidDetails: { subject: signataire, publicKey: k.publique, privateKey: k.privee },
    };

    let partis = 0;
    const file = [...appareils];
    const ouvrier = async () => {
      for (let a = file.shift(); a; a = file.shift()) {
        try {
          await envoyer({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
            corps, options);
          partis++;
        } catch (e) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await q('DELETE FROM notif_appareils WHERE id = ?', [a.id]).catch(() => {});
          } else {
            log.warn('[notifications] envoi refusé :', e?.statusCode ?? '', e?.message ?? e);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(EN_VOL, file.length) }, ouvrier));
    return partis;
  }

  /* ------------------------------------------------------------ le KOP */

  /**
   * Un vote vient de s'ouvrir : tous les membres, sauf celui qui l'a ouvert.
   * Appelé sans être attendu par `kop.ouvrirVote`.
   */
  async function voteOuvert(kopId, vote) {
    if (!actives()) return 0;
    try {
      const kop = (await q('SELECT nom FROM kops WHERE id = ?', [kopId]))[0];
      const membres = (await q('SELECT user_id FROM kop_membres WHERE kop_id = ?', [kopId]))
        .map((m) => m.user_id).filter((u) => u !== vote.ouvertPar);
      const minutes = Math.round((vote.fermeDansMs ?? 180_000) / 60_000);
      return await prevenir(membres, 'kop', {
        titre: `Vote du KOP ${kop?.nom ?? ''}`.trim(),
        corps: `${vote.nom ?? 'Un bonus'} pour ${vote.prix} écharpes. ${minutes} minutes pour voter ›`,
        url: '/kop',
        tag: `kop-${vote.id}`,
      });
    } catch (e) {
      log.error('[notifications] vote du KOP :', e.message);
      return 0;
    }
  }

  /* ------------------------------------------------------------ le duel */

  /** Joueur → instant du dernier duel annoncé. */
  const dernierDuel = new Map();
  /** `joueur:match` → instant : un même match ne s'annonce qu'une fois. */
  const matchsAnnonces = new Map();
  let menageA = 0;

  function menage(t) {
    if (t - menageA < 60 * 60_000) return;
    menageA = t;
    const garde = 24 * 60 * 60_000;
    for (const [c, v] of matchsAnnonces) if (t - v > garde) matchsAnnonces.delete(c);
    for (const [c, v] of dernierDuel) if (t - v > garde) dernierDuel.delete(c);
  }

  /**
   * Un supporter attend en duel classé, et personne ne tient la tribune d'en
   * face : ceux qui suivent ce club-là sont prévenus.
   *
   * @param {object} o
   * @param {number} o.fixtureId
   * @param {{ id: number, name: string }} o.club      le club qui manque
   * @param {{ id: number, name: string }} o.contre    le club de celui qui attend
   * @param {string} o.format       « 1v1 », « 2v2 »…
   * @param {number} o.camp         le camp qui manque, pour le lien
   * @param {string[]} o.exclus     ceux qui sont déjà en file sur ce match
   */
  async function duelAttend({ fixtureId, club, contre, format, camp, exclus = [] }) {
    if (!actives() || !club?.id) return 0;
    const t = horloge();
    if (estLaNuit(t)) return 0;
    menage(t);
    try {
      const pause = reglage('notifications.duel_pause_min') * 60_000;
      const sortis = new Set(exclus);
      const suiveurs = (await q('SELECT user_id FROM user_follows WHERE team_id = ?', [club.id]))
        .map((r) => r.user_id)
        .filter((u) => !sortis.has(u)
          && !matchsAnnonces.has(`${u}:${fixtureId}`)
          && !(t - (dernierDuel.get(u) ?? -Infinity) < pause));
      if (!suiveurs.length) return 0;
      for (const u of suiveurs) {
        matchsAnnonces.set(`${u}:${fixtureId}`, t);
        dernierDuel.set(u, t);
      }
      const lien = new URLSearchParams({ match: String(fixtureId) });
      if (format) lien.set('format', format);
      if (camp === 0 || camp === 1) lien.set('camp', String(camp));
      return await prevenir(suiveurs, 'duel', {
        titre: 'Un duel t’attend',
        corps: `${contre?.name ? `${contre.name} contre ${club.name}` : club.name}`
          + ` : il manque un supporter ${deClub(club.name)}. Viens tenir la tribune ›`,
        url: `/duel-nvn?${lien}`,
        tag: `duel-${fixtureId}`,
      });
    } catch (e) {
      log.error('[notifications] duel :', e.message);
      return 0;
    }
  }

  /* ------------------------------------------------------------ les routes */

  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));

  /**
   * Ce que la page du compte doit savoir pour dessiner la carte : si l'on peut
   * proposer, et avec quelle clé le navigateur doit s'inscrire.
   */
  router.get('/', requireAuth, async (_req, res) => {
    if (!actives()) return res.json({ actif: false });
    const k = await lesCles();
    if (!k) return res.json({ actif: false });
    res.json({ actif: true, cle: k.publique, sujets: SUJETS });
  });

  /**
   * L'état de cet appareil-ci pour ce joueur : ses cases, ou `null` s'il n'est
   * pas inscrit — ou s'il l'est au nom de quelqu'un d'autre, qui s'est
   * déconnecté sans passer par le bouton.
   */
  router.post('/etat', requireAuth, async (req, res) => {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== 'string') return res.json({ sujets: null });
    try {
      const l = (await q('SELECT kop, duel FROM notif_appareils WHERE id = ? AND user_id = ?',
        [empreinteAppareil(endpoint), req.user.id]))[0];
      res.json({ sujets: l ? { kop: Boolean(l.kop), duel: Boolean(l.duel) } : null });
    } catch (e) {
      tableAbsente(e);
      res.json({ sujets: null });
    }
  });

  /**
   * Inscrire cet appareil, ou changer ses cases. Les deux cases à faux
   * désinscrivent : un appareil qui ne veut rien n'a rien à faire en base.
   */
  router.put('/appareil', requireAuth, async (req, res) => {
    if (!actives()) return res.status(409).json({ error: 'notifications.error.eteintes' });
    const a = abonnementValide(req.body?.abonnement);
    if (!a) return res.status(400).json({ error: 'notifications.error.appareil' });
    const s = req.body?.sujets ?? {};
    const kop = s.kop ? 1 : 0;
    const duel = s.duel ? 1 : 0;
    const id = empreinteAppareil(a.endpoint);
    try {
      if (!kop && !duel) {
        await q('DELETE FROM notif_appareils WHERE id = ?', [id]);
        return res.json({ sujets: null });
      }
      await q(
        `INSERT INTO notif_appareils (id, user_id, endpoint, p256dh, auth, kop, duel)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh),
           auth = VALUES(auth), kop = VALUES(kop), duel = VALUES(duel)`,
        [id, req.user.id, a.endpoint, a.p256dh, a.auth, kop, duel]);
      res.json({ sujets: { kop: Boolean(kop), duel: Boolean(duel) } });
    } catch (e) {
      if (!tableAbsente(e)) log.error('[notifications] inscription :', e.message);
      res.status(503).json({ error: 'notifications.error.serveur' });
    }
  });

  /**
   * Oublier cet appareil. Appelé par la déconnexion : un téléphone prêté ne
   * doit pas continuer d'annoncer les votes du KOP de celui qui l'a rendu.
   * N'importe quel joueur connecté peut oublier un appareil dont il tient
   * l'adresse — il la tient parce qu'il est devant.
   */
  router.delete('/appareil', requireAuth, async (req, res) => {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== 'string') return res.json({ ok: true });
    try {
      await q('DELETE FROM notif_appareils WHERE id = ?', [empreinteAppareil(endpoint)]);
    } catch (e) { tableAbsente(e); }
    res.json({ ok: true });
  });

  return { router, prevenir, voteOuvert, duelAttend, lesCles };
}
