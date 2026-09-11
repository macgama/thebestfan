#!/usr/bin/env bash
#
# Déploiement — **à exécuter sur le serveur**, pas sur ta machine.
#
# C'est ce que faisait la mise en ligne à la main : récupérer le dépôt,
# installer, appliquer le schéma, redémarrer. Rien de plus, rien de nouveau —
# la seule différence est qu'aucune de ces étapes ne peut plus être oubliée,
# et que le schéma passe **avant** le redémarrage.
#
# Il est appelé par .github/workflows/deploiement.yml, mais il se lance aussi
# très bien tout seul, en SSH :
#
#     cd ~/sites/thebestfan.online && bash scripts/deployer.sh
#
# ## Ce qu'il faut savoir avant de s'en servir
#
# **Le dépôt fait foi.** On ne fusionne pas, on aligne : `git reset --hard` sur
# la branche distante. Une modification faite directement sur le serveur est
# donc perdue — c'est voulu. Un serveur qui diverge du dépôt est une machine
# dont plus personne ne sait ce qu'elle exécute. `.env` n'est pas suivi par
# git : il survit, comme `node_modules` et `VERSION`.
#
# **Le redémarrage n'est pas deviné.** Chaque hébergement le fait à sa façon.
# Celui-ci touche `tmp/restart.txt`, la convention de Passenger, et c'est un
# **choix par défaut, pas une certitude**. S'il ne relance rien chez toi,
# donne la bonne commande dans TBF_REDEMARRAGE — sans avoir à toucher au
# fichier ni au workflow.
#
# Variables reconnues, toutes facultatives :
#   TBF_RACINE        le dossier du site        (défaut ~/sites/thebestfan.online)
#   TBF_BRANCHE       la branche à déployer     (défaut main)
#   TBF_REDEMARRAGE   la commande de relance    (défaut touch tmp/restart.txt)
#   TBF_SANS_SCHEMA=1 saute l'application du schéma (à n'employer qu'en connaissance)

set -euo pipefail

RACINE="${TBF_RACINE:-$HOME/sites/thebestfan.online}"
BRANCHE="${TBF_BRANCHE:-main}"

echo "→ dossier   : $RACINE"
cd "$RACINE"

# ---------------------------------------------------------------- le code

echo "→ récupération de origin/$BRANCHE"
git fetch --prune origin "$BRANCHE"
git reset --hard "origin/$BRANCHE"

# --short=10 et non --short : la longueur par défaut dépend du nombre
# d'objets du dépôt, et elle peut donc différer entre le serveur et le coureur
# GitHub. Deux abréviations du même commit qui ne se ressemblent pas feraient
# échouer la vérification finale sur un déploiement parfaitement réussi.
COMMIT="$(git rev-parse --short=10 HEAD)"
echo "→ commit    : $COMMIT — $(git log -1 --pretty=%s)"

# ------------------------------------------------------------ les paquets
#
# `npm ci` et non `npm install` : il installe exactement ce que
# package-lock.json décrit, et il échoue si le verrou et le manifeste ne
# s'accordent pas — au lieu de réécrire le verrou en silence sur le serveur.

echo "→ npm ci"
npm ci --no-audit --no-fund

echo "→ build"
node build.mjs

# ------------------------------------------------------------- le schéma
#
# **Avant le redémarrage, et c'est tout l'intérêt.** Une table absente fait
# lever le démarrage, et toutes les routes /api disparaissent — connexion
# comprise. Le site répond, sert ses pages, et refuse tout le monde. C'est
# arrivé deux fois ; ça n'arrivera plus par oubli.

if [ "${TBF_SANS_SCHEMA:-0}" = "1" ]; then
  echo "→ schéma    : sauté (TBF_SANS_SCHEMA=1)"
else
  echo "→ schéma"
  npm run --silent schema:appliquer
fi

# ---------------------------------------------------------- la version en ligne
#
# Écrit avant la relance : c'est ce que /healthz renverra, et ce que le
# déploiement attendra pour se déclarer terminé.

printf '%s' "$COMMIT" > VERSION

# --------------------------------------------------------- le redémarrage

REDEMARRAGE="${TBF_REDEMARRAGE:-mkdir -p tmp && touch tmp/restart.txt}"
echo "→ redémarrage : $REDEMARRAGE"
eval "$REDEMARRAGE"

echo "→ déployé   : $COMMIT"
