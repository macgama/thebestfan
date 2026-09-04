import { messages } from '../../shared/i18n/authMessages.js';

/**
 * Envoi d'e-mails. Tant que SMTP_URL n'est pas défini, les messages sont
 * affichés dans la console d'exécution : on peut donc tester l'inscription et
 * la réinitialisation avant même d'avoir configuré la messagerie.
 *
 * Chez Infomaniak : SMTP_URL=smtps://adresse@thebestfan.online:motdepasse@mail.infomaniak.com:465
 */
export function createMailer({ smtpUrl, from, origin }) {
  let transport = null;
  let ready = null;

  async function getTransport() {
    if (!smtpUrl) return null;
    if (!ready) {
      ready = (async () => {
        const specifier = 'nodemailer';
        const nodemailer = await import(/* @vite-ignore */ specifier);
        transport = nodemailer.createTransport(smtpUrl);
        return transport;
      })().catch((e) => {
        console.error('[mail] transport indisponible, repli console', e.message);
        return null;
      });
    }
    return ready;
  }

  async function send({ to, subject, text }) {
    const t = await getTransport();
    if (!t) {
      console.log(`\n[mail → ${to}] ${subject}\n${text}\n`);
      return { delivered: false, logged: true };
    }
    await t.sendMail({ from: from ?? `thebestfan <no-reply@thebestfan.online>`, to, subject, text });
    return { delivered: true, logged: false };
  }

  const t = (locale, key, params = {}) => {
    const dict = messages[locale] ?? messages.fr;
    return Object.entries(params).reduce(
      (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
      dict[key] ?? key,
    );
  };

  return {
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
