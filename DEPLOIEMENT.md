# Mise en ligne : GitHub → Infomaniak

## 1. Poser le module dans le dépôt

Décompresse `fanzduel-realtime.zip` à côté de ton dépôt, puis :

```bash
cd FANZDuel
git checkout -b duel-temps-reel

cp -r ../fanzduel-realtime/src/shared/duel      src/shared/duel
cp -r ../fanzduel-realtime/src/shared/i18n      src/shared/i18n
cp -r ../fanzduel-realtime/src/server/duel      src/server/duel
cp -r ../fanzduel-realtime/src/client/duel      src/client/duel
cp -r ../fanzduel-realtime/sql                  sql
cp ../fanzduel-realtime/scripts/duel-*.mjs      scripts/
cp ../fanzduel-realtime/server.duel.example.ts  .
cp ../fanzduel-realtime/README.md               DUEL.md
```

Aucun fichier existant n'est écrasé : tous les chemins sont nouveaux, sauf
`README.md` que je renomme en `DUEL.md` pour laisser le tien en place.

## 2. Vérifier avant de committer

```bash
npx tsc --noEmit                    # ton script "lint"
git status                          # rien d'inattendu ?
git diff --cached --name-only       # après le git add
```

Contrôle aussi qu'aucune clé ne part dans le dépôt public : `.env.local`,
`firebase-applet-config.json`, `GEMINI_API_KEY`, `API_FOOTBALL_KEY`.
`git log -p -- .env.local` dit si une clé a déjà été poussée par le passé ;
si oui, il faut la révoquer, pas seulement la supprimer.

## 3. Pousser

```bash
git add src/shared/duel src/shared/i18n src/server/duel src/client/duel \
        sql scripts/duel-smoke.mjs scripts/duel-loadtest.mjs \
        server.duel.example.ts DUEL.md
git commit -m "Duel temps réel : moteur autoritaire, serveur Socket.IO, i18n 4 langues"
git push -u origin duel-temps-reel
```

Puis ouvre une pull request sur `main`, ou pousse directement sur `main` si tu
travailles seul.

## 4. Le site Node.js chez Infomaniak

Manager → ton hébergement Web → **Ajouter** → projet avec technologies
avancées → **Node.js** → domaine `thebestfan.online` → méthode
**personnalisée** → dépôt Git.

- Dépôt public : `https://github.com/macgama/FANZDuel.git`, rien d'autre.
- Dépôt privé : `https://macgama:<TOKEN>@github.com/macgama/FANZDuel.git`.
  Utilise un jeton GitHub à portée fine, en lecture seule sur ce dépôt
  (Settings → Developer settings → Fine-grained tokens → Contents: Read-only).
  Pas ton mot de passe : GitHub ne l'accepte plus, et il finirait stocké chez
  l'hébergeur.

## 5. Réglages Node.js (Gérer les paramètres avancés → onglet Node.js)

| Champ | Valeur |
|---|---|
| Dossier d'exécution | `./` |
| Commande de construction | `npm install && npm run build` |
| Commande de lancement | `npm start` |
| Version de Node.js | une LTS (20 ou 22) |
| Port d'écoute | celui attribué par le Manager |

Ton `package.json` est déjà compatible : `build` enchaîne `vite build` et le
bundle esbuild de `server.ts` vers `dist/server.cjs`, et `start` lance ce
fichier. Une seule chose à corriger dans `server.ts` : le port doit venir de
`process.env.PORT`, et il doit correspondre à celui affiché dans le Manager.

Variables d'environnement à définir dans le Manager, jamais dans le dépôt :
`DATABASE_URL`, `PUBLIC_ORIGIN=https://thebestfan.online`, `API_FOOTBALL_KEY`,
et les identifiants Firebase si tu les gardes.

## 6. Déployer une mise à jour

Il n'y a pas de déploiement automatique au `git push`. La mise à jour passe par
la commande de construction, lancée depuis le Manager :

```
git pull && npm install && npm run build
```

Puis **Redémarrer** l'application depuis le tableau de bord. Cette construction
tourne dans un environnement dédié, donc elle ne ralentit pas le site en
production pendant ce temps.

## 7. Vérifier que le temps réel passe vraiment

```bash
# depuis ta machine, une fois le site démarré
curl https://thebestfan.online/healthz
node scripts/duel-loadtest.mjs 50 https://thebestfan.online
```

Si `healthz` répond mais que le test de charge affiche des `connect:` en
erreur, c'est l'upgrade WebSocket qui ne passe pas : le repli `polling` est
déjà activé dans la configuration socket.io fournie, le jeu reste jouable, mais
la latence monte. La console d'exécution du Manager donne alors la raison.
