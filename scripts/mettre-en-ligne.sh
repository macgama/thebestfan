#!/usr/bin/env bash
#
# Mise en ligne complète — **à exécuter sur le PC** (Git Bash), là où sont les
# images et les vidéos hors git.
#
# En une commande, sans mot de passe :
#   1. envoie au serveur les images et vidéos nouvelles (envoyer-images.sh) ;
#   2. lance sur le serveur scripts/deployer.sh de main (code, paquets, build,
#      schéma, VERSION, relance) ;
#   3. attend que https://thebestfan.online/healthz annonce le nouveau commit.
#
# Il suppose une clé SSH dédiée, sans phrase de passe, dont la moitié publique
# est dans ~/.ssh/authorized_keys du serveur :
#
#   ssh-keygen -t ed25519 -C "thebestfan mise en ligne" -f ~/.ssh/thebestfan -N ""
#
# Variables :
#   TBF_SSH           utilisateur@hôte                         (obligatoire)
#   TBF_SSH_CLE       la clé privée              (défaut ~/.ssh/thebestfan)
#   TBF_RACINE        le dossier du site sur le serveur
#   TBF_REDEMARRAGE   la commande de relance sur le serveur (voir deployer.sh)
#   TBF_ORIGINE       l'adresse à interroger   (défaut https://thebestfan.online)
#
#   npm run mettre-en-ligne            images nouvelles + code
#   npm run mettre-en-ligne -- --tout  toutes les images + code

set -euo pipefail

if [ -z "${TBF_SSH:-}" ]; then
  echo "TBF_SSH manque : donne l'accès SSH, par exemple utilisateur@hote" >&2
  exit 1
fi
CLE="${TBF_SSH_CLE:-$HOME/.ssh/thebestfan}"
if [ ! -f "$CLE" ]; then
  echo "Clé introuvable : $CLE (voir l'en-tête de ce script)" >&2
  exit 1
fi
cd "$(dirname "$0")/.."

# BatchMode : jamais de mot de passe demandé. Si la clé est refusée, on
# s'arrête net au lieu d'attendre une saisie que personne ne fera.
export GIT_SSH_COMMAND="ssh -i $CLE -o BatchMode=yes -o IdentitiesOnly=yes"
SSH=(ssh -i "$CLE" -o BatchMode=yes -o IdentitiesOnly=yes)

echo "→ contrôle de l'accès SSH"
"${SSH[@]}" "$TBF_SSH" true

echo "→ code : main à jour"
git fetch -q origin main
ATTENDU="$(git rev-parse --short=10 origin/main)"

echo "→ images et vidéos"
TBF_SSH_CMD="${SSH[*]}" bash scripts/envoyer-images.sh "$@"

echo "→ déploiement sur le serveur ($ATTENDU)"
# Le script part de main (et non de la copie du serveur, qui date du
# déploiement précédent), écrit dans un fichier puis lancé, comme dans
# .github/workflows/deploiement.yml.
git show origin/main:scripts/deployer.sh | "${SSH[@]}" "$TBF_SSH" \
  "export TBF_RACINE='${TBF_RACINE:-}' TBF_REDEMARRAGE='${TBF_REDEMARRAGE:-}' TBF_BRANCHE=main; f=\$(mktemp); cat > \"\$f\"; bash \"\$f\" < /dev/null; s=\$?; rm -f \"\$f\"; exit \$s"

BASE="${TBF_ORIGINE:-https://thebestfan.online}"
echo "→ attente de $ATTENDU sur $BASE/healthz"
for essai in $(seq 1 30); do
  R="$(curl -fsS --max-time 10 "$BASE/healthz" || true)"
  case "$R" in
    *"\"version\":\"$ATTENDU\""*'"ok":true'*|*'"ok":true'*"\"version\":\"$ATTENDU\""*)
      echo "→ en ligne : $ATTENDU"; exit 0 ;;
  esac
  sleep 6
done
echo "Le site n'annonce pas encore $ATTENDU : la relance n'a pas eu lieu."
echo "Redémarrer dans le Manager (onglet Node.js), ou régler TBF_REDEMARRAGE."
exit 2
