#!/usr/bin/env bash
#
# Donne à ssh le mot de passe du serveur, sans que personne ne le tape ni ne
# le lise. ssh appelle ce script (SSH_ASKPASS) quand il a besoin du mot de
# passe ; le script le déchiffre et l'écrit sur sa sortie, pour ssh seul.
#
# Le mot de passe est rangé chiffré par Windows (DPAPI) dans
# %USERPROFILE%\.ssh\thebestfan.mdp : seul ce compte Windows, sur ce PC, peut
# le relire. Gaël l'y range lui-même, une fois, dans PowerShell :
#
#   Read-Host "Mot de passe SSH" -AsSecureString | ConvertFrom-SecureString | Set-Content "$env:USERPROFILE\.ssh\thebestfan.mdp"
#
# Rien de ce fichier n'entre dans le dépôt, et ce script ne l'affiche jamais
# ailleurs que pour ssh.
exec powershell.exe -NoProfile -NonInteractive -Command \
  '$s = Get-Content "$env:USERPROFILE\.ssh\thebestfan.mdp" | ConvertTo-SecureString; [Console]::Out.Write([Net.NetworkCredential]::new("", $s).Password)'
