import express from 'express';
import { createHash } from 'node:crypto';
import webpush from 'web-push';
import { reglage } from '../../shared/reglages.js';
import { traduire } from '../langues.js';

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
 * Et, depuis le 25 octobre 2026 (demande de Gaël : « que le joueur sache
 * quand ses équipes favorites jouent, quand un Virage est en cours avec
 * elles, quand une personne le demande en ami ») :
 *
 *   — **son club joue bientôt** : trente minutes avant le coup d'envoi d'un
 *     match d'un club qu'il suit (`avantMatch`, à la minute) ;
 *   — **le Virage de son club s'ouvre** : au coup d'envoi, le lien mène droit
 *     à la tribune du match (`coupDEnvoi`, branché sur le relevé du direct) ;
 *   — **ses amis** : une demande d'ami, une demande acceptée, un ami qui
 *     l'invite dans son duel.
 *
 * Les deux messages d'un même match portent le même `tag` : le second
 * remplace le premier sur l'écran, il ne s'empile pas.
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
export const SUJETS = ['kop', 'duel', 'club', 'virage', 'amis'];

/** Combien de minutes avant le coup d'envoi part « ton club joue bientôt ». */
export const AVANT_MATCH_MIN = 30;

/** Au-delà de cette minute de jeu, un match en cours n'est plus « qui commence » :
    un redémarrage du serveur en plein match n'annonce pas un coup d'envoi passé. */
export const COUP_D_ENVOI_MAX_MIN = 10;

/** Les périodes d'un match en cours, et celles d'un match fini (`scoreEnDirect`). */
const EN_JEU = new Set(['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const FINS = new Set(['FT', 'AET', 'PEN']);

/** Combien d'envois en vol à la fois : un coup d'envoi ne doit pas ouvrir mille connexions. */
const EN_VOL = 8;

/** Le temps de vie d'un message chez le service de notification, en secondes. */
const TTL = { kop: 3 * 60, duel: 2 * 60, club: AVANT_MATCH_MIN * 60, virage: 20 * 60,
  amis: 12 * 60 * 60 };

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

  /* Une case neuve dont la colonne manque encore (le code mis en ligne avant
     `npm run schema:appliquer`) : ce sujet se tait, les autres continuent. */
  let colonneDite = false;
  function colonneAbsente(e) {
    if (e?.code !== 'ER_BAD_FIELD_ERROR') return false;
    if (!colonneDite) {
      log.warn('[notifications] colonne absente : appliquer sql/notifications.sql.', e.message);
      colonneDite = true;
    }
    return true;
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
    if (!ids.length || !actives()) return 0;
    if (estLaNuit(horloge()) && !message.memeLaNuit) return 0;
    const k = await lesCles();
    if (!k) return 0;

    let appareils;
    try {
      appareils = await q(
        `SELECT a.id, a.endpoint, a.p256dh, a.auth, u.locale FROM notif_appareils a
           JOIN users u ON u.public_id = a.user_id AND u.status = 'active'
          WHERE a.${sujet} = 1 AND a.user_id IN (${ids.map(() => '?').join(',')})`, ids);
    } catch (e) {
      if (colonneAbsente(e)) return 0;
      if (!tableAbsente(e)) log.error('[notifications] appareils illisibles :', e.message);
      return 0;
    }
    if (!appareils.length) return 0;

    /* Chaque appareil reçoit le message dans la langue de son joueur. Un
       message peut fournir sa propre traduction (`traduction(langue)`)
       quand le français ne se laisse pas découper ; sinon le titre et le
       corps passent par les dictionnaires. */
    const { traduction, ttl: _ttl, memeLaNuit: _nuit, ...base } = message;
    const parLangue = new Map();
    const corpsEn = (l) => {
      if (!parLangue.has(l)) {
        const m = l === 'fr' || !l ? base
          : { ...base, ...(traduction ? traduction(l)
            : { titre: traduire(l, base.titre), corps: traduire(l, base.corps) }) };
        parLangue.set(l, JSON.stringify(m));
      }
      return parLangue.get(l);
    };
    const options = {
      TTL: message.ttl ?? TTL[sujet],
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
            corpsEn(a.locale), options);
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
        /* « il manque un supporter de Sion » : la préposition française ne
           se traduit pas, la phrase est donc reprise entière. */
        traduction: (l) => {
          const match = contre?.name ? `${contre.name} – ${club.name}` : club.name;
          return {
            titre: traduire(l, 'Un duel t’attend'),
            corps: traduire(l, `${match} : il manque un supporter de ${club.name}. Viens tenir la tribune ›`),
          };
        },
        url: `/duel-nvn?${lien}`,
        tag: `duel-${fixtureId}`,
      });
    } catch (e) {
      log.error('[notifications] duel :', e.message);
      return 0;
    }
  }

  /* ------------------------------------------------------------ les clubs */

  /** Les deux clubs d'un match, par leurs noms, et ceux qui suivent l'un ou l'autre. */
  async function leMatch(fixtureId) {
    const f = (await q(
      `SELECT f.id, f.home_id, f.away_id, h.name AS home, a.name AS away
         FROM fixtures f
         LEFT JOIN teams h ON h.id = f.home_id
         LEFT JOIN teams a ON a.id = f.away_id
        WHERE f.id = ?`, [fixtureId]))[0];
    if (!f) return null;
    const suiveurs = (await q(
      'SELECT DISTINCT user_id FROM user_follows WHERE team_id IN (?, ?)',
      [f.home_id, f.away_id])).map((r) => r.user_id);
    const affiche = [f.home, f.away].filter(Boolean).join(' – ');
    return { ...f, affiche, suiveurs };
  }

  /** `sujet:match` → instant : un match ne s'annonce qu'une fois par sujet. */
  const matchsDits = new Map();
  function dejaDit(cle, t) {
    for (const [c, v] of matchsDits) if (t - v > 24 * 60 * 60_000) matchsDits.delete(c);
    if (matchsDits.has(cle)) return true;
    matchsDits.set(cle, t);
    return false;
  }

  /**
   * « Ton club joue bientôt » : les matchs des clubs suivis dont le coup
   * d'envoi tombe dans `AVANT_MATCH_MIN` minutes, à cinq près. Appelé chaque
   * minute (`demarrer`) ; un match vu deux fois ne part qu'une.
   *
   * La fenêtre de dix minutes couvre un tour manqué ou un serveur lent. Un
   * redémarrage au milieu de la fenêtre peut redire un match : le même `tag`
   * remplace alors l'ancien message sur l'écran, il ne s'en ajoute pas.
   */
  async function avantMatch() {
    if (!actives()) return 0;
    const t = horloge();
    if (estLaNuit(t)) return 0;
    try {
      const debut = new Date(t + (AVANT_MATCH_MIN - 5) * 60_000);
      const fin = new Date(t + (AVANT_MATCH_MIN + 5) * 60_000);
      const sql = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
      const matchs = await q(
        `SELECT DISTINCT f.id FROM fixtures f
          WHERE f.status_short IN ('NS','TBD')
            AND f.kickoff_at >= ? AND f.kickoff_at < ?
            AND (f.home_id IN (SELECT team_id FROM user_follows)
              OR f.away_id IN (SELECT team_id FROM user_follows))`,
        [sql(debut), sql(fin)]);
      let partis = 0;
      for (const { id } of matchs) {
        if (dejaDit(`club:${id}`, t)) continue;
        const m = await leMatch(id);
        if (!m?.suiveurs.length) continue;
        partis += await prevenir(m.suiveurs, 'club', {
          titre: 'Ton club joue bientôt',
          corps: `${m.affiche} : coup d’envoi dans ${AVANT_MATCH_MIN} minutes. Le Virage ouvre au coup d’envoi ›`,
          traduction: (l) => ({
            titre: traduire(l, 'Ton club joue bientôt'),
            corps: traduire(l, `${m.affiche} : coup d’envoi dans ${AVANT_MATCH_MIN} minutes. Le Virage ouvre au coup d’envoi ›`),
          }),
          url: '/aujourdhui',
          tag: `match-${id}`,
        });
      }
      return partis;
    } catch (e) {
      log.error('[notifications] avant-match :', e.message);
      return 0;
    }
  }

  /**
   * « Le Virage de ton club s'ouvre » : le relevé du direct vient de voir ce
   * match commencer. Branché sur `onStatus` (server.js), qui part à chaque
   * tour pour chaque match relevé : seul le premier tour en première
   * mi-temps, dans les `COUP_D_ENVOI_MAX_MIN` premières minutes, prévient.
   */
  async function coupDEnvoi(fixtureId, etat = {}) {
    if (etat.status !== '1H' || (etat.elapsed ?? 0) > COUP_D_ENVOI_MAX_MIN) return 0;
    if (!actives()) return 0;
    const t = horloge();
    if (estLaNuit(t) || dejaDit(`virage:${fixtureId}`, t)) return 0;
    try {
      const m = await leMatch(fixtureId);
      if (!m?.suiveurs.length) return 0;
      return await prevenir(m.suiveurs, 'virage', {
        titre: 'Le Virage est ouvert',
        corps: `${m.affiche} a commencé. Viens pousser avec la tribune ›`,
        traduction: (l) => ({
          titre: traduire(l, 'Le Virage est ouvert'),
          corps: traduire(l, `${m.affiche} a commencé. Viens pousser avec la tribune ›`),
        }),
        url: `/virage?match=${encodeURIComponent(fixtureId)}`,
        tag: `match-${fixtureId}`,
      });
    } catch (e) {
      log.error('[notifications] coup d’envoi :', e.message);
      return 0;
    }
  }

  /**
   * Le score en direct, dans la notification du match : demande de Gaël du
   * 29 octobre 2026 (« suivre l'évolution du score sur son mobile, comme
   * Google »). Branché sur `onStatus`, comme `coupDEnvoi` : le score et la
   * période sont déjà dans la réponse du relevé, sans un appel de plus.
   *
   * Un message part quand le score change (un but, ou un but annulé), à la
   * mi-temps et au coup de sifflet final ; jamais au premier tour où l'on
   * voit un match (un redémarrage ne redit pas un score déjà connu). Tous
   * portent le `tag` du match : sur l'appareil, la même notification change
   * au lieu d'en empiler une par but. La mi-temps change sans vibrer.
   *
   * Même case que « ton club joue bientôt » (`club`) : pas de colonne de
   * plus. Et un match commencé avant 22 h se suit jusqu'au bout, même la
   * nuit : le joueur a choisi ce club, et le score final est ce qu'il attend.
   * Une seule notification remplacée, pas une sonnerie par minute.
   */
  const scoresVus = new Map();
  async function scoreEnDirect(fixtureId, etat = {}) {
    const { status, homeGoals: h, awayGoals: a } = etat;
    const phase = status === 'HT' ? 'mi-temps' : FINS.has(status) ? 'fin'
      : EN_JEU.has(status) ? 'jeu' : null;
    if (!phase || h == null || a == null) return 0;
    const t = horloge();
    for (const [c, v] of scoresVus) if (t - v.t > 6 * 60 * 60_000) scoresVus.delete(c);
    const avant = scoresVus.get(fixtureId);
    scoresVus.set(fixtureId, { h, a, phase, t });
    if (!avant || avant.phase === 'fin') return 0;
    const but = h !== avant.h || a !== avant.a;
    const quoi = but ? 'but' : phase !== avant.phase && phase !== 'jeu' ? phase : null;
    if (!quoi || !actives()) return 0;

    const coup = Date.parse(etat.kickoffAt ?? '');
    const memeLaNuit = Number.isFinite(coup) && !estLaNuit(coup) && t - coup < 4 * 60 * 60_000;
    try {
      const m = await leMatch(fixtureId);
      if (!m?.suiveurs.length) return 0;
      const titre = `${m.home ?? ''} ${h} – ${a} ${m.away ?? ''}`.trim();
      const minute = (etat.elapsed ?? 0) + (etat.elapsedExtra ?? 0);
      let corps;
      if (quoi === 'fin') corps = 'Score final ›';
      else if (quoi === 'mi-temps') corps = 'Mi-temps. Le Virage t’attend ›';
      else if (h + a < avant.h + avant.a) corps = `But annulé (${minute}e). Suis le match ›`;
      else {
        const pour = h > avant.h ? m.home : m.away;
        corps = `But pour ${pour} (${minute}e). Suis le match ›`;
      }
      return await prevenir(m.suiveurs, 'club', {
        titre,
        corps,
        bouton: 'Voir le match',
        traduction: (l) => ({ titre, corps: traduire(l, corps), bouton: traduire(l, 'Voir le match') }),
        url: quoi === 'fin' ? '/aujourdhui' : `/virage?match=${encodeURIComponent(fixtureId)}`,
        tag: `match-${fixtureId}`,
        silencieux: quoi === 'mi-temps',
        ttl: quoi === 'fin' ? 2 * 60 * 60 : 10 * 60,
        memeLaNuit,
      });
    } catch (e) {
      log.error('[notifications] score en direct :', e.message);
      return 0;
    }
  }

  /* ------------------------------------------------------------ les amis

     Jamais le pseudo de l'autre : « un supporter », « un ami ». La page des
     amis le dit, une fois le téléphone déverrouillé. */

  /** `demandeur:demandé` → instant. Demander, retirer, redemander : la page
      des amis le permet, et chaque fois ferait vibrer le téléphone de
      l'autre. Une paire ne prévient qu'une fois par jour. */
  const demandesDites = new Map();

  /** Quelqu'un (`deQui`) vient de demander ce joueur en ami. */
  async function amiDemande(userId, deQui = '') {
    const t = horloge();
    for (const [c, v] of demandesDites) if (t - v > 24 * 60 * 60_000) demandesDites.delete(c);
    const cle = `${deQui}:${userId}`;
    if (deQui && demandesDites.has(cle)) return 0;
    if (deQui) demandesDites.set(cle, t);
    return prevenir([userId], 'amis', {
      titre: 'Nouvelle demande d’ami',
      corps: 'Un supporter veut devenir ton ami. Réponds-lui ›',
      url: '/amis',
      tag: 'amis-demande',
    }).catch(() => 0);
  }

  /** Une demande de ce joueur vient d'être acceptée. */
  function amiAccepte(userId) {
    return prevenir([userId], 'amis', {
      titre: 'Demande acceptée',
      corps: 'Tu as un nouvel ami dans la tribune ›',
      url: '/amis',
      tag: 'amis-accepte',
    }).catch(() => 0);
  }

  /** Un ami invite ce joueur dans son duel, qui attend. Une place ne se garde
      que quelques minutes : un message plus vieux ne mènerait à rien. */
  function inviteDuel(userId, code) {
    return prevenir([userId], 'amis', {
      titre: 'Un ami t’invite en duel',
      corps: 'Une place t’attend dans sa tribune. Viens vite ›',
      url: `/duel-nvn?${new URLSearchParams({ duel: String(code ?? '') })}`,
      tag: 'amis-duel',
      ttl: 5 * 60,
    }).catch(() => 0);
  }

  /** La minute qui cherche les matchs à annoncer. Arrêtée par `arreter`. */
  let minute = null;
  function demarrer() {
    if (minute) return;
    minute = setInterval(() => { void avantMatch(); }, 60_000);
    minute.unref?.();
  }
  function arreter() {
    if (minute) clearInterval(minute);
    minute = null;
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
      /* `*` et non la liste des cases : une colonne pas encore ajoutée ne
         doit pas faire disparaître celles qui existent. */
      const l = (await q('SELECT * FROM notif_appareils WHERE id = ? AND user_id = ?',
        [empreinteAppareil(endpoint), req.user.id]))[0];
      res.json({ sujets: l
        ? Object.fromEntries(SUJETS.map((s) => [s, Boolean(l[s] ?? false)])) : null });
    } catch (e) {
      tableAbsente(e);
      res.json({ sujets: null });
    }
  });

  /**
   * Inscrire cet appareil, ou changer ses cases. Toutes les cases à faux
   * désinscrivent : un appareil qui ne veut rien n'a rien à faire en base.
   *
   * Une case que la page n'envoie pas vaut non : la page dit toutes celles
   * qu'elle montre, et un joueur n'est pas prévenu d'un sujet qu'il n'a pas
   * vu. (La colonne vaut oui par défaut pour les appareils inscrits avant la
   * case, qui avaient déjà dit oui aux notifications.)
   */
  router.put('/appareil', requireAuth, async (req, res) => {
    if (!actives()) return res.status(409).json({ error: 'notifications.error.eteintes' });
    const a = abonnementValide(req.body?.abonnement);
    if (!a) return res.status(400).json({ error: 'notifications.error.appareil' });
    const s = req.body?.sujets ?? {};
    const id = empreinteAppareil(a.endpoint);
    try {
      /* Les colonnes réellement présentes : le code peut tourner une heure
         avant que le schéma ait reçu les cases neuves. */
      const cases = Object.fromEntries((await colonnesPresentes())
        .map((x) => [x, s[x] ? 1 : 0]));
      if (!Object.values(cases).some(Boolean)) {
        await q('DELETE FROM notif_appareils WHERE id = ?', [id]);
        return res.json({ sujets: null });
      }
      const noms = Object.keys(cases);
      await q(
        `INSERT INTO notif_appareils (id, user_id, endpoint, p256dh, auth, ${noms.join(', ')})
         VALUES (?, ?, ?, ?, ?, ${noms.map(() => '?').join(', ')})
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh),
           auth = VALUES(auth), ${noms.map((x) => `${x} = VALUES(${x})`).join(', ')}`,
        [id, req.user.id, a.endpoint, a.p256dh, a.auth, ...Object.values(cases)]);
      res.json({ sujets: Object.fromEntries(SUJETS.map((x) => [x, Boolean(cases[x])])) });
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

  /** Les cases que la table porte déjà, lues une fois. */
  let presentes = null;
  async function colonnesPresentes() {
    if (presentes) return presentes;
    const cols = await q(
      `SELECT column_name AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'notif_appareils'`);
    const vues = new Set(cols.map((r) => String(r.c).toLowerCase()));
    const l = SUJETS.filter((x) => vues.has(x));
    /* Toutes là : on retient. Sinon on relira, le schéma peut arriver. */
    if (l.length === SUJETS.length) presentes = l;
    return l;
  }

  return { router, prevenir, voteOuvert, duelAttend, avantMatch, coupDEnvoi, scoreEnDirect,
    amiDemande, amiAccepte, inviteDuel, demarrer, arreter, lesCles };
}
