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
   * Caviarder un message d'erreur avant de le garder.
   *
   * **`/healthz` est public.** Il n'y a pas de session, pas de jeton, pas de
   * réseau privé : c'est une sonde d'hébergeur, elle doit répondre à tout le
   * monde. Or `derniereErreur` y est servi tel quel, et nodemailer met la
   * valeur qu'il a reçue dans ses messages — le 18 septembre 2026, la sonde
   * annonçait au monde entier :
   *
   *     Cannot create property 'mailer' on string
   *     'info@thebestfan.online:<le mot de passe>:465'
   *
   * Le mot de passe SMTP du domaine, en clair, sur une adresse publique, à
   * cause d'une variable mal formée. Ce n'est pas nodemailer qui a tort : un
   * message d'erreur cite ce qu'on lui a donné, c'est son travail.
   *
   * On retire donc **les secrets qu'on connaît** — on les connaît tous, ils
   * viennent d'ici — avant de ranger quoi que ce soit. Et on passe ensuite un
   * filet générique sur la forme `identifiant:secret@hôte`, pour le jour où un
   * secret arrivera par un chemin qu'on n'a pas prévu.
   */
  const SECRETS = [pass, smtpUrl].filter((x) => typeof x === 'string' && x.length >= 4);
  const caviarder = (message) => {
    let t = String(message ?? '');
    for (const secret of SECRETS) t = t.split(secret).join('[caviardé]');
    /* Le filet : tout ce qui ressemble à des identifiants dans une URL. Il ne
       remplace pas la liste ci-dessus — il la double, et c'est volontaire. */
    return t.replace(/\/\/[^\s/@]+:[^\s/@]+@/g, '//[caviardé]@')
      .replace(/'[^'\s]*:[^'\s]*:\d+'/g, "'[caviardé]'");
  };
  /** Tout passe par ici. Écrire dans `derniereErreur` directement est la faute. */
  const retenir = (message) => { derniereErreur = caviarder(message); };

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

  /**
   * `SMTP_URL` est-il une URL ?
   *
   * Sans schéma, nodemailer reçoit une chaîne qu'il prend pour un objet de
   * configuration et échoue sur `Cannot create property 'mailer' on string` —
   * un message qui ne nomme pas le vrai défaut et qui, en le citant, publiait
   * le mot de passe.
   *
   * On le dit donc ici, clairement, et **sans citer la valeur** : c'est la
   * forme qui est fausse, pas le secret qui est intéressant.
   *
   * La cause est presque toujours la même : l'identifiant SMTP est une adresse
   * e-mail, elle contient un `@`, et on écrit `user@domaine:motdepasse:465` en
   * croyant faire une URL. Les quatre variables séparées — SMTP_HOST,
   * SMTP_USER, SMTP_PASS, SMTP_PORT — n'ont pas ce piège, et c'est pour ça
   * qu'elles passent devant dans `config()`.
   */
  function urlDouteuse() {
    if (host && user) return null;
    if (!smtpUrl) return null;
    if (/^smtps?:\/\//i.test(smtpUrl)) return null;
    return 'SMTP_URL n’est pas une URL : il lui manque « smtps:// » et le nom du '
      + 'serveur. Préfère les quatre variables séparées — SMTP_HOST, SMTP_USER, '
      + 'SMTP_PASS, SMTP_PORT — qui évitent le piège de l’arobase dans '
      + 'l’identifiant. (La valeur n’est pas répétée ici : elle contient le mot '
      + 'de passe, et cet état est lisible depuis /healthz, qui est public.)';
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
          retenir(e.message);
          console.error('[mail] SMTP refusé :', caviarder(e.message));
          console.error('[mail] les messages seront écrits dans cette console');
          return null;
        }
        return transport;
      })().catch((e) => {
        etat = 'smtp-erreur';
        retenir(e.message);
        console.error('[mail] transport indisponible, repli console :', caviarder(e.message));
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
      retenir(e.message);
      console.error('[mail] envoi refusé :', caviarder(e.message));
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
    /* Ce que sert `/healthz`, qui est public. L'erreur y est déjà caviardée à
       l'écriture ; le `caviarder` de sortie est une seconde barrière, pour le
       jour où quelqu'un écrira dans `derniereErreur` sans passer par
       `retenir`. Deux barrières sur un secret, ce n'est pas de la paranoïa —
       c'est le prix d'une qui cède sans qu'on le voie. */
    get status() {
      const forme = urlDouteuse();
      return {
        etat, configure: Boolean(config()),
        erreur: derniereErreur === null ? null : caviarder(derniereErreur),
        ...(forme ? { forme } : {}),
      };
    },

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
