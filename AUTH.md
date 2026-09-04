# Authentification — thebestfan

Comptes, sessions et mots de passe, en JavaScript pur. Aucune compilation, aucun
module natif : `npm install` suffit sur l'hébergement Infomaniak.

## Fichiers à poser dans le dépôt

```
server.js                              remplace l'actuel
package.json                           remplace l'actuel (ajoute mysql2 et nodemailer)
public/compte.html                     page connexion / inscription / mot de passe oublié
sql/auth.sql                           schéma à appliquer une fois
src/server/auth/db.js                  pool MariaDB
src/server/auth/password.js            hachage scrypt
src/server/auth/tokens.js              jetons, empreintes, tickets socket
src/server/auth/store.js               requêtes SQL
src/server/auth/routes.js              routes HTTP
src/server/auth/mailer.js              envoi SMTP, repli console
src/server/auth/socket.js              authentification du handshake socket.io
src/shared/i18n/authMessages.js        textes des e-mails, 4 langues
scripts/auth-smoke.mjs                 test de bout en bout
```

## Mise en place

```bash
# 1. appliquer le schéma
mysql -h o42s1v.myd.infomaniak.com -u o42s1v_tbf -p o42s1v_thebestfan < sql/auth.sql

# 2. pousser les fichiers, puis dans le Manager :
#    commande de build   : git pull && npm install --omit=dev
#    commande de lancement : npm start
```

`npm start` charge `.env` automatiquement (`--env-file-if-exists`), donc la
commande de lancement redevient `npm start` et non `node --env-file=.env server.js`.

Variables attendues dans `.env` :

```
DATABASE_URL=mysql://o42s1v_tbf:motdepasse@o42s1v.myd.infomaniak.com:3306/o42s1v_thebestfan
PUBLIC_ORIGIN=https://thebestfan.online
SESSION_SECRET=<openssl rand -hex 32>
SMTP_URL=smtps://compte@thebestfan.online:motdepasse@mail.infomaniak.com:465
MAIL_FROM=thebestfan <no-reply@thebestfan.online>
```

Sans `SMTP_URL`, les e-mails s'affichent dans la console d'exécution du Manager :
tu peux tester l'inscription et la réinitialisation avant d'avoir configuré la
messagerie, en copiant le lien depuis les logs.

## Vérifier

```bash
node scripts/auth-smoke.mjs     # 50 vérifications sur une vraie base
curl https://thebestfan.online/healthz
```

`healthz` doit indiquer `"db":"connectée"` et `"auth":"active"`. Puis
`https://thebestfan.online/compte` pour créer un compte.

## Routes

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/register` | inscription, connexion immédiate, mail de vérification |
| POST | `/api/auth/login` | connexion |
| POST | `/api/auth/logout` | déconnexion |
| GET | `/api/auth/me` | session courante |
| PATCH | `/api/auth/me` | langue, club suivi |
| DELETE | `/api/auth/me` | suppression RGPD, mot de passe exigé |
| POST | `/api/auth/verify` | validation de l'adresse |
| POST | `/api/auth/resend-verification` | renvoi du mail |
| POST | `/api/auth/forgot` | demande de réinitialisation |
| POST | `/api/auth/reset` | nouveau mot de passe |
| POST | `/api/auth/socket-ticket` | ticket court pour socket.io |

## Choix à connaître

**scrypt plutôt qu'argon2id.** Je t'avais annoncé argon2id. Il exige une
compilation native ou des binaires précompilés, ce qui est fragile sur un
hébergement mutualisé où l'on ne maîtrise ni le compilateur ni la libc. scrypt
est intégré à Node, sans aucune dépendance, et reste une fonction à coût
mémoire reconnue. Le format porte son nom en préfixe et `needsRehash` réhache à
la connexion : on pourra migrer vers argon2id plus tard sans déconnecter
personne.

**Rien n'est stocké en clair.** Ni les mots de passe, ni les jetons de session,
ni les liens de réinitialisation : seules les empreintes SHA-256 sont en base.
Une copie de la base ne permet donc pas d'usurper une session ouverte.

**L'existence d'un compte ne fuite pas.** Une connexion avec une adresse
inconnue consomme le même temps de calcul qu'une vraie vérification, et
`/forgot` répond la même chose que le compte existe ou non. L'inscription fait
exception : elle doit bien dire qu'une adresse est déjà prise.

**Le duel est verrouillé.** `createSocketAuthenticator` remplace le mode
développement où le jeton valait identité. Un joueur ne peut plus reprendre le
duel d'un autre. Il se branche ainsi :

```js
attachDuelServer(io, { store, authenticate: socketAuth });
```

## Reste à faire

1. Appliquer `sql/auth.sql` sur la base de production.
2. Créer l'adresse d'envoi chez Infomaniak et renseigner `SMTP_URL`.
3. Vérifier que `SESSION_SECRET` est bien défini : le serveur démarre sans, mais
   il l'écrit dans les logs et les tickets socket seraient devinables.
4. Prévoir la page de profil : changement de mot de passe une fois connecté,
   choix du club suivi.
