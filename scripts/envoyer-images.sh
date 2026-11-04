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
# Il demande au serveur la liste de ce qu'il a, emballe les images et vidéos
# qui y manquent (ou dont la taille diffère), et les déballe dans le dossier
# du site. Il n'efface rien sur le serveur : une image
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
SSH_CMD="${TBF_SSH_CMD:-ssh}"

if [ "${1:-}" = "--tout" ]; then
  echo "→ envoi complet"
  find "${DOSSIERS[@]}" -type f > .tbf-images-liste
else
  # On demande au serveur ce qu'il a déjà (taille et chemin), et l'on
  # n'envoie que ce qui y manque ou n'y a pas la même taille. Plus fiable
  # qu'une date : la réécriture du 3 novembre a retouché tous les fichiers.
  echo "→ comparaison avec le serveur"
  $SSH_CMD "$TBF_SSH" "cd '$RACINE' && find ${DOSSIERS[*]} -type f -printf '%s %p\\n' 2>/dev/null; true" \
    | LC_ALL=C sort > .tbf-images-distant
  find "${DOSSIERS[@]}" -type f -printf "%s %p\n" | LC_ALL=C sort > .tbf-images-local
  comm -23 .tbf-images-local .tbf-images-distant | cut -d' ' -f2- > .tbf-images-liste
  rm -f .tbf-images-local .tbf-images-distant
fi

N="$(wc -l < .tbf-images-liste | tr -d ' ')"
if [ "$N" = "0" ]; then
  echo "→ rien à envoyer"
  rm -f .tbf-images-liste
  exit 0
fi
TAILLE="$(tr '\n' '\0' < .tbf-images-liste | du -ch --files0-from=- 2>/dev/null | tail -1 | cut -f1)"
echo "→ $N fichiers, ${TAILLE:-?} — par exemple :"
head -3 .tbf-images-liste | sed 's/^/    /'

# Un point d'étape toutes les ~100 Mo : sans lui, la fenêtre reste muette
# pendant tout l'envoi, et un envoi de quelques gigaoctets a l'air bloqué.
tar -cf - -T .tbf-images-liste --checkpoint=10000 --checkpoint-action='echo=  … %{}T envoyés' \
  | $SSH_CMD "$TBF_SSH" "cd '$RACINE' && tar -xf -"
rm -f .tbf-images-liste
echo "→ envoyé"
