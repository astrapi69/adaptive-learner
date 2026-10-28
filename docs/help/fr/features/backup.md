# Sauvegarde et restauration

Adaptive Learner peut sauvegarder l'intégralité de ton état
d'apprentissage dans un seul fichier et le restaurer sur un autre
appareil, dans une installation neuve ou après un changement de
navigateur. Tu trouves tout cela sous **Paramètres → Données**.

<!-- TODO: Screenshot - Paramètres → Données avec les boutons « Créer une sauvegarde » et « Restaurer » -->

---

## Ce que contient la sauvegarde

Une sauvegarde est un **instantané complet** : toutes les tables de
données (projets d'apprentissage, sessions, progression des
leçons, erreurs au niveau des éléments, gamification avec
XP/série/badges, missions, cartes Anki, notes et plus encore)
**plus tes ensembles de contenu téléchargés**.

**Également inclus :** les dépôts de contenu connectés, les
invitations utilisées et l'activation du Learning Repository.
En mode navigateur, les résultats de tes vérifications de contenu par
IA sont aussi inclus, le badge « Vérifié par IA » est donc conservé.

**Ne sont pas inclus**, par exemple :

- le jeton d'accès d'un dépôt privé (saisis-le à nouveau après la
  restauration) ;
- le dossier du Learning Repository, qui appartient à l'appareil ;
- en mode serveur, la progression des leçons et les enregistrements
  vocaux faits hors ligne qui ne sont pas encore arrivés au serveur ;
- les index de recherche et les listes de médias en cache, le compteur
  de la sauvegarde automatique et la position de la synchronisation LAN.

Le réglage qui indique si la sauvegarde automatique est activée est, en
revanche, inclus. En mode serveur, l'application garde en mémoire dans
ce navigateur ce qui est créé hors ligne : jusqu'à 50 modifications de
la progression des leçons et des enregistrements vocaux ; s'il y en a
davantage, les plus anciennes sont supprimées. Elle les transmet
d'elle-même quand la connexion revient pendant que l'application est
ouverte, ou au prochain démarrage avec connexion. Seul ce qui est
arrivé au serveur entre dans la sauvegarde ; en mode serveur, ne crée
donc une sauvegarde qu'une fois que l'application a été rouverte avec
une connexion après l'apprentissage hors ligne, pas avant.

Avant l'export, l'application affiche un aperçu **« Ta sauvegarde
contient … »** avec le nombre d'enregistrements par domaine, afin
que tu voies avant d'enregistrer ce qui sera sauvegardé.

---

## Créer une sauvegarde

1. Ouvre **Paramètres → Données**.
2. Appuie sur **Créer une sauvegarde**.
3. En mode purement navigateur, tu peux choisir directement un
   emplacement via l'API File System Access (« Enregistrer sur le
   disque ») ; si le navigateur ne le prend pas en charge,
   l'application télécharge le fichier à la place.

**Sauvegarde automatique :** en option, l'application conserve un
anneau glissant des derniers instantanés, afin que tu ne te
retrouves jamais totalement sans sauvegarde.

---

## Restaurer

1. **Paramètres → Données → Restaurer**.
2. Choisis le fichier de sauvegarde.
3. L'application importe chaque table et fait défiler vers le haut
   jusqu'à un **récapitulatif par table** (ajouté / mis à jour /
   ignoré), afin que tu voies exactement ce qui a été importé.

Si quelque chose se passe mal pendant l'import, un **avis d'erreur
permanent** (toast) apparaît, qui ne disparaît pas de lui-même -
ainsi tu ne manques aucune erreur. En mode développeur
(Paramètres > Diagnostic et assistance), le message contient les détails
techniques pour un ticket GitHub.

---

## Import inter-identités

Tu n'as **pas** besoin d'être le même utilisateur sur le même appareil.

- **Sur un appareil vide**, le mieux est d'importer la sauvegarde dès le
  départ (voir "Sauvegarde lors de la première connexion"). L'app reprend
  alors le profil de la sauvegarde.
- **Sur un appareil où tu as déjà créé un profil**, tu peux importer la
  sauvegarde via Paramètres > Données. Si elle appartient à un autre
  profil, la fenêtre de confirmation te le signale avant l'import. La
  progression de la sauvegarde est alors rattachée à ton **profil actif**
  et fusionnée avec la tienne : la progression des leçons, les erreurs, les
  passages, les enregistrements, les projets et l'historique s'ajoutent, et
  ta propre progression est conservée. Les XP, la série et les paramètres
  sont repris de la sauvegarde. Ton profil actif reste actif ; aucun
  deuxième profil n'est créé.

---

## Sauvegarde lors de la première connexion

Si tu relances l'application (ou la lances pour la première fois
sur un appareil), Adaptive Learner te propose activement
d'importer une sauvegarde existante au lieu de commencer avec un
état vide. Ainsi, après un changement d'appareil ou de navigateur,
tu retrouves immédiatement ton flux d'apprentissage.

---

## Les deux modes de stockage

La sauvegarde et la restauration fonctionnent dans les **deux**
modes de stockage - serveur (API) et purement navigateur
(Dexie/IndexedDB). La sauvegarde est un **fichier `.alb`** : une
archive ZIP qui regroupe les tables de données, l'instantané du
localStorage et les ensembles de contenu. Les fichiers `.alb` sont
acceptés partout où l'on importe une sauvegarde (Paramètres > Données
et la Zone de danger). Les anciennes sauvegardes en un seul fichier
JSON s'importent toujours sans problème.

!!! note "Protection des données"
    La sauvegarde reste entièrement entre tes mains. Elle n'est
    enregistrée que là où tu la places - rien n'est envoyé à un
    serveur.

---

## Pages connexes

- [Paramètres](../user-guide/settings.md) - un aperçu de toutes les actions sur les données
- [Plusieurs dépôts de contenu](content-repos.md) - les dépôts connectés et les invitations utilisées voyagent avec la sauvegarde
