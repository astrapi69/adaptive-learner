# Installer Docker Desktop

Adaptive Learner fonctionne comme un petit ensemble de conteneurs sur
ta propre machine. Le lanceur de bureau démarre et arrête ces
conteneurs à ta place, mais il faut d'abord que **Docker** soit
installé et en cours d'exécution. Ce guide t'accompagne dans
l'installation de Docker Desktop.

## Ce dont tu as besoin

- Environ 800 Mo de téléchargement pour Docker Desktop lui-même.
- Environ 2 Go de disque pour l'image d'Adaptive Learner au premier
  démarrage (cela n'arrive qu'une fois ; les démarrages suivants sont
  rapides).
- Quelques minutes pour la première construction (5-10 minutes, c'est
  normal).

## Installer

1. Ouvre la page officielle de téléchargement de Docker Desktop :
   [docs.docker.com/desktop](https://docs.docker.com/desktop/).
2. Télécharge le programme d'installation pour ton système
   d'exploitation (Windows, macOS ou Linux).
3. Lance le programme d'installation et suis les indications. Accepte
   les valeurs par défaut, sauf si tu as une raison de les modifier.
4. Démarre Docker Desktop et attends que son icône de baleine affiche
   "Docker Desktop is running".

## Démarrer le lanceur

Une fois Docker Desktop en cours d'exécution, redémarre le lanceur
d'Adaptive Learner. Il vérifie d'abord Docker, puis télécharge,
construit et démarre l'application, et propose enfin un bouton
"Ouvrir dans le navigateur".

Si Docker n'est pas encore en cours d'exécution quand tu démarres le
lanceur, celui-ci affiche un message avec un bouton "Démarrer Docker"
pour que tu puisses le lancer sans quitter le lanceur.

Par défaut, l'application en cours d'exécution n'est accessible que
depuis cet ordinateur (`127.0.0.1`). Elle n'a pas de connexion ;
l'ouvrir à d'autres appareils est un choix délibéré - voir
[Démarrer le lanceur de bureau](launcher.md).

## Docker est-il sûr à installer ?

Oui. Docker Desktop est développé par Docker, Inc., une entreprise
bien connue, et est utilisé par des millions de développeuses et
développeurs dans le monde. C'est la façon standard d'exécuter des
applications conteneurisées sur un ordinateur personnel.

Adaptive Learner utilise Docker uniquement pour exécuter ses propres
conteneurs sur ta machine. Tes données d'apprentissage restent
locales ; l'installation de Docker n'envoie aucune de tes données à
Docker, Inc. Tu peux désinstaller Docker Desktop à tout moment depuis
ton système d'exploitation, comme n'importe quelle autre application.

## Dépannage

- **Le lanceur indique que Docker n'est pas en cours d'exécution.**
  Démarre Docker Desktop, attends l'état "running", puis clique sur
  "Réessayer".
- **Le port est déjà utilisé.** Le lanceur le détecte et propose un
  autre port ; accepte la suggestion.
- **Autre chose s'est mal passé.** Relance le lanceur avec le flag
  `--debug` et partage le fichier `launcher-debug.log` généré :

  ```bash
  python3 -m adaptive_learner_launcher --debug
  ```
