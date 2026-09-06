import { messages } from '../../shared/i18n/authMessages.js';

/**
 * Envoi d'e-mails. Tant que SMTP_URL n'est pas défini, les messages sont
 * affichés dans la console d'exécution : on peut donc tester l'inscription et
 * la réinitialisation avant même d'avoir configuré la messagerie.
 *
 * Chez Infomaniak : SMTP_URL=smtps://adresse@thebestfan.online:motdepasse@mail.infomaniak.com:465
 */
export function createMailer({ smtpUrl, host, port, user, pass, secure, from, origin }) {
  let transport = null;
  let ready = null;
  // État lisible depuis /healthz : c'est lui qui dit pourquoi rien ne part.
  let etat = 'console';
  let derniereErreur = null;

  /**
   * Configuration du transport.
   *
   * Deux façons de le décrire, parce que l'URL est piégeuse : l'identifiant
   * SMTP est une adresse e-mail, donc il contient un `@`, et un mot de passe
   * peut contenir `:`, `/` ou `#`. Les variables séparées évitent toute
   * question d'encodage — c'est la forme à préférer.
   */
  function config() {
    if (host && user) {
      const p = Number(port ?? 465);
      return { host, port: p, secure: secure ?? p === 465, auth: { user, pass } };
    }
    return smtpUrl || null;
  }

  async function getTransport() {
    const conf = config();
    if (!conf) return null;
    if (!ready) {
      ready = (async () => {
        const specifier = 'nodemailer';
        const nodemailer = await import(/* @vite-ignore */ specifier);
        transport = nodemailer.createTransport(conf);
        // Un échec de connexion doit se voir au démarrage, pas à la première
        // inscription d'un vrai utilisateur qui, lui, ne dira rien.
        try {
          await transport.verify();
          etat = 'smtp';
          console.log('[mail] connexion SMTP vérifiée');
        } catch (e) {
          etat = 'smtp-erreur';
          derniereErreur = e.message;
          console.error('[mail] SMTP refusé :', e.message);
          console.error('[mail] les messages seront écrits dans cette console');
          return null;
        }
        return transport;
      })().catch((e) => {
        etat = 'smtp-erreur';
        derniereErreur = e.message;
        console.error('[mail] transport indisponible, repli console :', e.message);
        return null;
      });
    }
    return ready;
  }

  async function send({ to, subject, text }) {
    const t = await getTransport();
    if (!t) {
      // Repli console : le lien reste utilisable, il faut juste aller le
      // chercher dans les logs du Manager.
      console.log(`\n[mail → ${to}] ${subject}\n${text}\n`);
      return { delivered: false, logged: true, etat, erreur: derniereErreur };
    }
    try {
      const info = await t.sendMail({
        from: from ?? 'thebestfan <no-reply@thebestfan.online>', to, subject, text });
      return { delivered: true, logged: false, id: info.messageId };
    } catch (e) {
      derniereErreur = e.message;
      console.error('[mail] envoi refusé :', e.message);
      console.log(`\n[mail → ${to}] ${subject}\n${text}\n`);
      return { delivered: false, logged: true, erreur: e.message };
    }
  }

  const t = (locale, key, params = {}) => {
    const dict = messages[locale] ?? messages.fr;
    return Object.entries(params).reduce(
      (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
      dict[key] ?? key,
    );
  };

  return {
    /** État pour /healthz et pour la route de diagnostic. */
    get status() { return { etat, erreur: derniereErreur, configure: Boolean(config()) }; },

    /** Envoi de contrôle, déclenché par un administrateur. */
    async test(to) {
      return send({
        to,
        subject: 'Test — thebestfan',
        text: 'Si tu lis ceci, la configuration SMTP fonctionne.',
      });
    },

    async sendVerification({ to, pseudo, locale, token }) {
      const link = `${origin}/compte?verifier=${encodeURIComponent(token)}`;
      return send({
        to,
        subject: t(locale, 'mail.verify.subject'),
        text: t(locale, 'mail.verify.body', { pseudo, link }),
      });
    },

    async sendReset({ to, pseudo, locale, token }) {
      const link = `${origin}/compte?reinitialiser=${encodeURIComponent(token)}`;
      return send({
        to,
        subject: t(locale, 'mail.reset.subject'),
        text: t(locale, 'mail.reset.body', { pseudo, link }),
      });
    },

    async sendPasswordChanged({ to, pseudo, locale }) {
      return send({
        to,
        subject: t(locale, 'mail.changed.subject'),
        text: t(locale, 'mail.changed.body', { pseudo }),
      });
    },
  };
}
