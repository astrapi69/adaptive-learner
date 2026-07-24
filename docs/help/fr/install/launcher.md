# Démarrer le lanceur de bureau

!!! tip "La plupart des utilisateurs n'ont pas besoin du lanceur"
    Adaptive Learner fonctionne directement dans le navigateur, sans
    installation, sans Docker, sans lanceur :
    **[astrapi69.github.io/adaptive-learner](https://astrapi69.github.io/adaptive-learner/)**.
    Le lanceur de bureau n'est utile que si tu veux héberger
    l'application toi-même ou exécuter localement des fonctionnalités
    du backend (mode serveur, synchronisation locale).

Le lanceur de bureau est le moyen le plus simple d'exécuter Adaptive
Learner **avec son propre backend** sur ta propre machine. C'est une
petite fenêtre qui s'occupe de tout le reste pour toi : elle vérifie
que Docker est en cours d'exécution, télécharge et construit l'image
de l'application au premier démarrage (une seule fois, 5-10 minutes
c'est normal), démarre les conteneurs, puis ouvre l'application dans
ton navigateur à l'adresse `http://localhost:8501`. Depuis la même
fenêtre, tu peux aussi arrêter l'application, changer le port ou tout
désinstaller.

Le port est **8501** par défaut et peut être changé dans la fenêtre du
lanceur ; s'il est occupé, le lanceur se rabat sur un port libre.

## Prérequis : Docker - le lanceur le vérifie lui-même

Le lanceur nécessite un Docker en cours d'exécution, car l'application
elle-même fonctionne comme un groupe de conteneurs. Tu n'as **rien** à
vérifier manuellement : au démarrage, le lanceur contrôle lui-même si
Docker est installé et en cours d'exécution, trouve aussi un Docker
qui tourne sous un contexte Docker différent (comme Docker Desktop
pour Linux ou Docker rootless), et affiche un message clair avec une
solution lorsque quelque chose manque. Si Docker n'est pas encore
installé du tout : [Installer Docker Desktop](docker-desktop.md).

Les messages du lanceur et ce qu'ils signifient :

| Message | Signification | Solution |
|---------|---------------|----------|
| "Docker n'est pas installé (docker absent du PATH)." | La commande `docker` est introuvable. | [Installer Docker Desktop](docker-desktop.md). Le lanceur affiche directement le lien d'installation. |
| "Docker est installé mais n'est pas démarré." ou "Docker n'est pas en cours d'exécution. Contexte vérifié '...' (...) : ..." | Le service Docker ne tourne pas en ce moment ; la forme détaillée nomme le contexte sondé, le socket et l'erreur d'origine de Docker. | Clique sur le bouton **"Démarrer Docker"** dans le lanceur (Linux) ou ouvre Docker Desktop (macOS/Windows), puis **"Réessayer"**. |
| "Docker est installé, mais tu n'as pas la permission." | Ton utilisateur n'est pas dans le groupe `docker` (Linux). | Le lanceur affiche la commande exacte ; déconnecte-toi puis reconnecte-toi ensuite. |
| "Docker ne répond pas." | Docker est très probablement encore en train de démarrer (typique juste après l'ouverture de Docker Desktop). | Attends un instant, puis **"Réessayer"**. |
| "Docker fonctionne via le contexte '...' - le contexte actif était injoignable, le lanceur s'est connecté automatiquement." | Purement informatif : Docker tournait sous un autre contexte, le lanceur l'a trouvé et l'utilise. | Rien à faire. |
| "Docker Desktop est installé mais absent du PATH." | L'application Docker Desktop est présente, mais son outil en ligne de commande n'est pas (encore) accessible. | Démarre Docker Desktop via le bouton du lanceur et attends un instant. |

La détection de contexte avec messages détaillés est incluse à partir
de la version du lanceur qui suit docker-app-launcher#26 ; les versions
plus anciennes affichent les messages plus courts de la même table.

## Téléchargement

Les trois lanceurs sont fournis à chaque version sur
[github.com/astrapi69/adaptive-learner/releases](https://github.com/astrapi69/adaptive-learner/releases) :

| Plateforme | Fichier | Somme de contrôle |
|------------|---------|-------------------|
| Linux | `adaptive-learner-launcher` | `adaptive-learner-launcher.sha256` |
| macOS | `adaptive-learner-launcher-macos.zip` | `adaptive-learner-launcher-macos.zip.sha256` |
| Windows | `adaptive-learner-launcher.exe` | `adaptive-learner-launcher.exe.sha256` |

## Linux

1. Vérifie la somme de contrôle (les deux fichiers dans le même
   dossier) :

    ```bash
    sha256sum -c adaptive-learner-launcher.sha256
    ```

2. Attribue le droit d'exécution. Le téléchargement par le navigateur
   le retire toujours au binaire, cette étape est donc **toujours**
   nécessaire :

    ```bash
    chmod +x adaptive-learner-launcher
    ```

3. Démarre-le, le plus simple depuis le terminal :

    ```bash
    ./adaptive-learner-launcher
    ```

    Le double-clic dans le gestionnaire de fichiers peut aussi
    fonctionner, selon ton environnement ; GNOME/Nautilus requiert
    "Autoriser l'exécution du fichier comme un programme" sous
    Propriétés > Permissions. Le démarrage depuis le terminal a
    l'avantage de te montrer directement les messages d'erreur.

Pièges connus :

- **"Permission denied"** : l'étape 2 a été oubliée (`chmod +x`).
- **Erreur GLIBC au démarrage** : le binaire est construit sur Ubuntu
  22.04 et nécessite glibc 2.35 ou plus récent (Ubuntu 22.04+, Debian
  12+, Fedora 36+). Sur les distributions plus anciennes, exécute
  plutôt l'application via `install.sh` ou directement avec Docker
  Compose.
- **Application inaccessible dans le navigateur** : l'application ne
  tourne qu'en local (`localhost`), aucune règle de pare-feu n'est donc
  nécessaire. Si le navigateur ne s'ouvre pas automatiquement, ouvre
  `http://localhost:8501` manuellement (ou le port affiché dans la
  fenêtre du lanceur).

## macOS

1. Vérifie la somme de contrôle et décompresse le ZIP :

    ```bash
    shasum -a 256 -c adaptive-learner-launcher-macos.zip.sha256
    unzip adaptive-learner-launcher-macos.zip
    ```

2. À la première ouverture, Gatekeeper bloque le binaire comme
   provenant d'un "développeur non identifié". Deux façons de
   contourner cela :

    - Clic droit (ou Ctrl-clic) sur le binaire > **Ouvrir** > confirme
      **Ouvrir** dans la boîte de dialogue. macOS le mémorise pour tous
      les démarrages suivants.
    - Ou : Réglages Système > **Confidentialité et sécurité** > descends
      jusqu'à l'application bloquée et clique sur **Ouvrir quand même**.

## Windows

1. Vérifie la somme de contrôle (PowerShell, les deux fichiers dans le
   même dossier) :

    ```powershell
    Get-FileHash .\adaptive-learner-launcher.exe -Algorithm SHA256
    Get-Content .\adaptive-learner-launcher.exe.sha256
    ```

    Les deux valeurs de hachage doivent correspondre.

2. Double-clique sur `adaptive-learner-launcher.exe`. Au premier
   démarrage, SmartScreen avertit ("Windows a protégé votre
   ordinateur") : clique sur **Informations complémentaires**, puis
   **Exécuter quand même**.

## Si quelque chose se passe mal

- Le lanceur affiche lui-même une boîte de dialogue lorsque Docker
  n'est pas en cours d'exécution et propose de démarrer Docker Desktop.
- Le premier démarrage télécharge et construit l'image de
  l'application ; la liste d'étapes dans la fenêtre du lanceur (Check
  Docker / Download / Build / Start / Ready) montre la progression. Les
  démarrages suivants sont rapides.
- Pendant que l'application tourne, tu peux toujours l'atteindre à
  `http://localhost:8501` (ou ton port modifié) ; le bouton "Ouvrir
  dans le navigateur" du lanceur fait la même chose.
