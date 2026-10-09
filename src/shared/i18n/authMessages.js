/**
 * Textes des e-mails. Séparés de l'interface : ils sont rendus côté serveur,
 * dans la langue choisie par le destinataire au moment de son inscription.
 */
export const messages = {
  fr: {
    'mail.btn.verify': 'Confirmer mon adresse',
    'mail.btn.reset': 'Choisir un mot de passe',
    'mail.btn.abo': 'Voir mon abonnement',
    'mail.btn.resil': 'Garder mon abonnement',
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
    'mail.abo.subject': 'Ton abonnement est actif — thebestfan',
    'mail.abo.body':
      'Salut {pseudo},\n\n' +
      'Bienvenue dans le PASS DE TRIBUNE : ton abonnement {formule} est actif jusqu\'au {fin}.{packs}\n' +
      'Il se renouvelle seul à chaque échéance, au même prix.\n\n' +
      'Tu peux le résilier quand tu veux, en deux gestes, sur la page de l\'abonnement :\n{link}\n\n' +
      'thebestfan.online',
    'mail.abo.pack': ' Un booster vient d\'arriver dans ta réserve.',
    'mail.abo.packs': ' {n} boosters viennent d\'arriver dans ta réserve.',
    'mail.resil.subject': 'Ta résiliation est enregistrée — thebestfan',
    'mail.resil.body':
      'Salut {pseudo},\n\n' +
      'Nous avons bien reçu ta résiliation. Ton abonnement s\'arrête le {fin} : plus rien ne sera prélevé, et tu gardes tout jusque-là.\n\n' +
      'Tu changes d\'avis ? Tu peux le garder jusqu\'à cette date, depuis la page de l\'abonnement :\n{link}\n\n' +
      'thebestfan.online',
  },
  en: {
    'mail.btn.verify': 'Confirm my address',
    'mail.btn.reset': 'Choose a password',
    'mail.btn.abo': 'See my subscription',
    'mail.btn.resil': 'Keep my subscription',
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
    'mail.abo.subject': 'Your subscription is active — thebestfan',
    'mail.abo.body':
      'Hi {pseudo},\n\n' +
      'Welcome to the STAND PASS: your {formule} subscription is active until {fin}.{packs}\n' +
      'It renews automatically at the same price.\n\n' +
      'You can cancel any time, in two taps, on the subscription page:\n{link}\n\n' +
      'thebestfan.online',
    'mail.abo.pack': ' A booster just landed in your stock.',
    'mail.abo.packs': ' {n} boosters just landed in your stock.',
    'mail.resil.subject': 'Your cancellation is confirmed — thebestfan',
    'mail.resil.body':
      'Hi {pseudo},\n\n' +
      'We received your cancellation. Your subscription ends on {fin}: nothing more will be charged, and you keep everything until then.\n\n' +
      'Changed your mind? You can keep it until that date on the subscription page:\n{link}\n\n' +
      'thebestfan.online',
  },
  de: {
    'mail.btn.verify': 'Adresse bestätigen',
    'mail.btn.reset': 'Passwort wählen',
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
  it: {
    'mail.verify.subject': 'Conferma il tuo indirizzo — thebestfan',
    'mail.verify.body':
      'Ciao {pseudo},\n\n' +
      'Conferma il tuo indirizzo per attivare il tuo account:\n{link}\n\n' +
      'Questo link scade tra 48 ore.\n' +
      'Se non ti sei iscritto tu, ignora questo messaggio.\n\n' +
      'thebestfan.online',
    'mail.reset.subject': 'Reimposta la tua password — thebestfan',
    'mail.reset.body':
      'Ciao {pseudo},\n\n' +
      'Ecco il link per scegliere una nuova password:\n{link}\n\n' +
      'Scade tra 1 ora e funziona una sola volta.\n' +
      'Se non l’hai chiesto tu, la tua password attuale resta valida.\n\n' +
      'thebestfan.online',
    'mail.changed.subject': 'La tua password è cambiata — thebestfan',
    'mail.changed.body':
      'Ciao {pseudo},\n\n' +
      'La tua password è appena stata modificata e tutte le tue sessioni sono state chiuse.\n' +
      'Se non sei stato tu, reimpostala subito dalla pagina di accesso.\n\n' +
      'thebestfan.online',
  },
  es: {
    'mail.btn.verify': 'Confirmar mi dirección',
    'mail.btn.reset': 'Elegir una contraseña',
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
