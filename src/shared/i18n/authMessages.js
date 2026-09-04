/**
 * Textes des e-mails. Séparés de l'interface : ils sont rendus côté serveur,
 * dans la langue choisie par le destinataire au moment de son inscription.
 */
export const messages = {
  fr: {
    'mail.verify.subject': 'Confirme ton adresse — thebestfan',
    'mail.verify.body':
      'Salut {pseudo},\n\n' +
      'Confirme ton adresse pour activer ton compte :\n{link}\n\n' +
      'Ce lien expire dans 48 heures.\n' +
      "Si tu n'es pas à l'origine de cette inscription, ignore ce message.\n\n" +
      'thebestfan.online',
    'mail.reset.subject': 'Réinitialiser ton mot de passe — thebestfan',
    'mail.reset.body':
      'Salut {pseudo},\n\n' +
      'Voici le lien pour choisir un nouveau mot de passe :\n{link}\n\n' +
      "Ce lien expire dans 1 heure et ne fonctionne qu'une fois.\n" +
      "Si tu n'as rien demandé, ton mot de passe actuel reste valable.\n\n" +
      'thebestfan.online',
    'mail.changed.subject': 'Ton mot de passe a changé — thebestfan',
    'mail.changed.body':
      'Salut {pseudo},\n\n' +
      'Ton mot de passe vient d\'être modifié et toutes tes sessions ont été fermées.\n' +
      "Si ce n'est pas toi, réinitialise-le immédiatement depuis la page de connexion.\n\n" +
      'thebestfan.online',
  },
  en: {
    'mail.verify.subject': 'Confirm your address — thebestfan',
    'mail.verify.body':
      'Hi {pseudo},\n\n' +
      'Confirm your address to activate your account:\n{link}\n\n' +
      'This link expires in 48 hours.\n' +
      "If you didn't sign up, just ignore this message.\n\n" +
      'thebestfan.online',
    'mail.reset.subject': 'Reset your password — thebestfan',
    'mail.reset.body':
      'Hi {pseudo},\n\n' +
      'Here is the link to choose a new password:\n{link}\n\n' +
      'It expires in 1 hour and works only once.\n' +
      "If you didn't ask for it, your current password still works.\n\n" +
      'thebestfan.online',
    'mail.changed.subject': 'Your password changed — thebestfan',
    'mail.changed.body':
      'Hi {pseudo},\n\n' +
      'Your password was just changed and all your sessions were closed.\n' +
      "If this wasn't you, reset it immediately from the sign-in page.\n\n" +
      'thebestfan.online',
  },
  de: {
    'mail.verify.subject': 'Bestätige deine Adresse — thebestfan',
    'mail.verify.body':
      'Hallo {pseudo},\n\n' +
      'Bestätige deine Adresse, um dein Konto zu aktivieren:\n{link}\n\n' +
      'Dieser Link läuft in 48 Stunden ab.\n' +
      'Wenn du dich nicht registriert hast, ignoriere diese Nachricht.\n\n' +
      'thebestfan.online',
    'mail.reset.subject': 'Passwort zurücksetzen — thebestfan',
    'mail.reset.body':
      'Hallo {pseudo},\n\n' +
      'Hier ist der Link für ein neues Passwort:\n{link}\n\n' +
      'Er läuft in 1 Stunde ab und funktioniert nur einmal.\n' +
      'Wenn du nichts angefordert hast, bleibt dein aktuelles Passwort gültig.\n\n' +
      'thebestfan.online',
    'mail.changed.subject': 'Dein Passwort wurde geändert — thebestfan',
    'mail.changed.body':
      'Hallo {pseudo},\n\n' +
      'Dein Passwort wurde soeben geändert und alle Sitzungen wurden beendet.\n' +
      'Warst du das nicht, setze es sofort über die Anmeldeseite zurück.\n\n' +
      'thebestfan.online',
  },
  es: {
    'mail.verify.subject': 'Confirma tu dirección — thebestfan',
    'mail.verify.body':
      'Hola {pseudo}:\n\n' +
      'Confirma tu dirección para activar tu cuenta:\n{link}\n\n' +
      'Este enlace caduca en 48 horas.\n' +
      'Si no te has registrado, ignora este mensaje.\n\n' +
      'thebestfan.online',
    'mail.reset.subject': 'Restablecer tu contraseña — thebestfan',
    'mail.reset.body':
      'Hola {pseudo}:\n\n' +
      'Aquí tienes el enlace para elegir una nueva contraseña:\n{link}\n\n' +
      'Caduca en 1 hora y solo funciona una vez.\n' +
      'Si no lo has pedido, tu contraseña actual sigue siendo válida.\n\n' +
      'thebestfan.online',
    'mail.changed.subject': 'Tu contraseña ha cambiado — thebestfan',
    'mail.changed.body':
      'Hola {pseudo}:\n\n' +
      'Tu contraseña acaba de cambiar y se han cerrado todas tus sesiones.\n' +
      'Si no has sido tú, restablécela de inmediato desde la página de acceso.\n\n' +
      'thebestfan.online',
  },
};
