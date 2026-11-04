#!/usr/bin/env bash
#
# Envoi des images au serveur — **à exécuter sur ta machine**, pas sur le
# serveur.
#
# ## Pourquoi les images ne passent plus par git
#
# Le dépôt avait atteint vingt-huit gigaoctets, et plus aucune copie neuve ne
# tenait sur le disque d'un fil de travail. Presque tout venait des images :
# chaque dessin d'un Fanzzy existe en PNG, en WebP et en AVIF, et
# `public/img/fanzzy` pesait à lui seul neuf gigaoctets. L'historique a donc
# été réécrit le 3 novembre 2026 pour les en sortir (voir .gitignore), et les
# images voyagent désormais par ce script, en SSH.
#
# Les manifestes JSON de ces dossiers, eux, restent dans git : ils pèsent peu,
# et le code en a besoin pour tourner sans les images.
#
# ## Ce qu'il fait
#
# Il emballe les images plus récentes que le dernier envoi réussi, et les
# déballe dans le dossier du site. Il n'efface rien sur le serveur : une image
# retirée ici reste là-bas, ce qui ne casse jamais une page déjà en cache.
# `--tout` renvoie tout, pour un serveur neuf.
#
# Variables :
#   TBF_SSH      l'accès SSH, utilisateur@hôte   (obligatoire)
#   TBF_RACINE   le dossier du site sur le serveur (défaut sites/thebestfan.online)

set -euo pipefail

if [ -z "${TBF_SSH:-}" ]; then
  echo "TBF_SSH manque : donne l'accès SSH, par exemple utilisateur@hote" >&2
  exit 1
fi
RACINE="${TBF_RACINE:-sites/thebestfan.online}"
cd "${TBF_DEPOT:-$(dirname "$0")/..}"

# public/video : les fonds filmés de fx.js et les vidéos tutoriel de « Comment
# jouer » (video-tuto.js). Ce sont des .mp4, hors de git comme les images.
DOSSIERS=()
for d in public/img/fanzzy public/img/ultime public/video; do
  [ -d "$d" ] && DOSSIERS+=("$d")
done
REPERE=.tbf-images-envoyees

if [ "${1:-}" = "--tout" ] || [ ! -f "$REPERE" ]; then
  echo "→ envoi complet"
  find "${DOSSIERS[@]}" -type f > .tbf-images-liste
else
  echo "→ images plus récentes que le dernier envoi"
  find "${DOSSIERS[@]}" -type f -newer "$REPERE" > .tbf-images-liste
fi

N="$(wc -l < .tbf-images-liste | tr -d ' ')"
if [ "$N" = "0" ]; then
  echo "→ rien à envoyer"
  rm -f .tbf-images-liste
  exit 0
fi
echo "→ $N fichiers"

# Le repère est posé **avant** l'envoi : une image écrite pendant le transfert
# partira la fois suivante au lieu de passer entre les deux.
touch "$REPERE.nouveau"
tar -cf - -T .tbf-images-liste | ${TBF_SSH_CMD:-ssh} "$TBF_SSH" "cd '$RACINE' && tar -xf -"
mv "$REPERE.nouveau" "$REPERE"
rm -f .tbf-images-liste
echo "→ envoyé"
