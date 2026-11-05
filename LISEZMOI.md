Catalogue des images visibles par les joueurs

Page : https://claude.ai/artifact/Q1QdzkxhGKKFkULZtf7Zmt (demande de Gaël, 2026-10-29 : mise à jour chaque nuit avec l'état des lieux des séries).

Fichiers ici :
- construire.mjs : lit l'arbre de main, range les images par section, signale les manques, refait les planches de vignettes des groupes changés, écrit site/index.html.
- vignettes.py : fabrique une planche (Python + Pillow).
- gabarit.html : la page (le script y injecte les données).
- site/ : le dernier résultat ET le cache (etat.json + vignettes/). Ne pas effacer : sans lui, tout est refait (≈ 7 min et ≈ 600 Mo de téléchargement).

Relevé de minuit (à faire après le relevé de l'état des lieux) :
1. Clone léger, SANS checkout (un checkout télécharge 5 Go d'images) :
   git clone -q --no-checkout --filter=blob:none --depth=1 --single-branch -b main https://github.com/macgama/thebestfan <clone>
   (un clone déjà là : git fetch --filter=blob:none --depth=1 origin main, puis --ref origin/main)
2. node /mnt/project-files/suite/catalogue-images/construire.mjs --repo <clone> --ref HEAD --out /mnt/project-files/suite/catalogue-images/site
   Il ne récupère que les fichiers des groupes changés (≈ 100 s et 85 Mo pour deux groupes). La dernière ligne imprimée est un bilan JSON (images, manques par section, planches refaites).
   Ne jamais lancer `git archive` ni un checkout dans le clone : dans un clone partiel ils réclament tous les blobs (8 Go).
3. Copier site/ dans le dossier de travail de la session (l'outil Artifact ne lit que le dossier de travail ou le scratchpad) :
   cp -r /mnt/project-files/suite/catalogue-images/site/. <scratchpad>/catalogue/
4. Republier avec l'outil Artifact : url = la page ci-dessus, file_path = <scratchpad>/catalogue/index.html, root = <scratchpad>/catalogue,
   files = les clés de site/a-publier.json (planches changées ; une valeur null = planche à retirer, à passer en null dans la forme objet de files).
   La première fois depuis une autre session : action "read" sur l'url avant de publier.
   Si a-publier.json est vide, publier quand même index.html (date et commit changent).
5. Dans le résumé à Gaël : une ligne avec le total d'images, le nombre de manques et ce qui a changé.

Depuis l'allègement du dépôt (2026-11-03, images hors git) : le catalogue se fait SUR LE PC de Gaël.
- Outil sur le PC : C:\Users\gaelm\Documents\catalogue-images\ (cache site\ à garder), copie sur la branche orpheline `catalogue-outil`.
- Lancer par Remote Control (dossier Documents) : `git fetch origin main` dans Documents\GitHub\thebestfan, puis
  node construire.mjs --repo C:\Users\gaelm\Documents\GitHub\thebestfan --ref origin/main --disque C:\Users\gaelm\Documents\GitHub\thebestfan --out C:\Users\gaelm\Documents\catalogue-images\site
  (PYTHON=python ; Pillow installé). Pousser site\ (index.html, a-publier.json, etat.json, vignettes changées) sur la branche orpheline `catalogue-site` par index temporaire, --force.
- Dans le cloud : git fetch origin catalogue-site, extraire par cat-file dans <scratchpad>/catalogue/, publier index.html + les clés de a-publier.json (255 fichiers au plus par publication : en plusieurs fois).
- Si le PC est éteint ou Remote Control inactif : le dire à Gaël, garder la page de la veille.
