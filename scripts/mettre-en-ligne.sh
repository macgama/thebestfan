#!/usr/bin/env bash
#
# Mise en ligne complète — **à exécuter sur le PC** (Git Bash), là où sont les
# images et les vidéos hors git.
#
# En une commande, sans rien taper :
#   1. envoie au serveur les images et vidéos nouvelles (envoyer-images.sh) ;
#   2. lance sur le serveur scripts/deployer.sh de main (code, paquets, build,
#      schéma, VERSION, relance) ;
#   3. attend que https://thebestfan.online/healthz annonce le nouveau commit.
#
# L'hébergement Node.js d'Infomaniak n'accepte pas encore les clés SSH
# (novembre 2026) : on passe donc par le mot de passe, rangé chiffré par
# Windows et donné à ssh par scripts/ssh-mot-de-passe.sh (voir son en-tête).
# Sans ce fichier, ssh le demande au clavier, comme avant.
#
# Variables :
#   TBF_SSH           utilisateur@hôte (VSHXbBEk9F_thebesfan@57-116302.ssh.hosting-ik.com)
#   TBF_RACINE        le dossier du site sur le serveur
#   TBF_REDEMARRAGE   la commande de relance sur le serveur (voir deployer.sh)
#   TBF_ORIGINE       l'adresse à interroger   (défaut https://thebestfan.online)
#
#   npm run mettre-en-ligne            images nouvelles + code
#   npm run mettre-en-ligne -- --tout  toutes les images + code

set -euo pipefail

TBF_SSH="${TBF_SSH:-VSHXbBEk9F_thebesfan@57-116302.ssh.hosting-ik.com}"
export TBF_SSH
# Les scripts voisins viennent du même dossier que celui-ci ; les images, du
# dépôt TBF_DEPOT (défaut : le dépôt qui contient ce script). On peut donc
# lancer la version de main sans changer de branche :
#   git show origin/main:scripts/mettre-en-ligne.sh > …/scripts/…  (les trois)
#   TBF_DEPOT=~/Documents/GitHub/thebestfan bash …/scripts/mettre-en-ligne.sh
OUTILS="$(cd "$(dirname "$0")" && pwd)"
cd "${TBF_DEPOT:-$OUTILS/..}"

MDP="$HOME/.ssh/thebestfan.mdp"
if [ -f "$MDP" ]; then
  # force : ssh prend le mot de passe du script même s'il a un terminal.
  export SSH_ASKPASS="$OUTILS/ssh-mot-de-passe.sh" SSH_ASKPASS_REQUIRE=force DISPLAY="${DISPLAY:-:0}"
else
  echo "→ pas de mot de passe rangé ($MDP) : ssh le demandera"
fi

# accept-new : la première connexion enregistre l'empreinte du serveur, les
# suivantes refusent un serveur qui aurait changé.
SSH=(ssh -o LogLevel=ERROR -o StrictHostKeyChecking=accept-new -o PubkeyAuthentication=no -o NumberOfPasswordPrompts=1)

echo "→ contrôle de l'accès SSH"
"${SSH[@]}" "$TBF_SSH" true

echo "→ code : main à jour"
git fetch -q origin main
ATTENDU="$(git rev-parse --short=10 origin/main)"

echo "→ images et vidéos"
TBF_SSH_CMD="${SSH[*]}" TBF_DEPOT="$PWD" bash "$OUTILS/envoyer-images.sh" "$@"

echo "→ déploiement sur le serveur ($ATTENDU)"
# Le serveur prend lui-même deployer.sh dans main (et non sa copie de
# travail, qui date du déploiement précédent), puis le lance. Rien ne passe
# par l'entrée de ssh (-n) : le programme qui donne le mot de passe pourrait
# l'avaler, et le premier essai s'est arrêté ainsi, sans un mot.
RAC="${TBF_RACINE:-sites/thebestfan.online}"
set +e
"${SSH[@]}" -n "$TBF_SSH" "cd '$RAC' && git fetch -q origin main && f=\$(mktemp) && git show origin/main:scripts/deployer.sh > \"\$f\" && TBF_REDEMARRAGE='${TBF_REDEMARRAGE:-}' TBF_BRANCHE=main bash \"\$f\" < /dev/null 2>&1; s=\$?; rm -f \"\$f\"; exit \$s"
CODE=$?
set -e
if [ "$CODE" != "0" ]; then
  echo "Échec du déploiement sur le serveur (code $CODE) : voir les lignes au-dessus." >&2
  exit "$CODE"
fi

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
