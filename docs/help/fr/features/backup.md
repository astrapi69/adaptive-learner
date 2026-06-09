# Sauvegarde et restauration

Adaptive Learner peut sauvegarder l'intégralité de ton état
d'apprentissage dans un seul fichier et le restaurer sur un autre
appareil, dans une installation neuve ou après un changement de
navigateur. Tu trouves tout cela sous **Paramètres → Données**.

<!-- TODO: Screenshot — Paramètres → Données avec les boutons « Créer une sauvegarde » et « Restaurer » -->

---

## Ce que contient la sauvegarde

Une sauvegarde est un **instantané complet** : les 30 tables de
données (projets d'apprentissage, sessions, progression des
leçons, erreurs au niveau des éléments, gamification avec
XP/série/badges, missions, cartes Anki, notes et plus encore)
**plus tes ensembles de contenu téléchargés**. Rien d'important ne
reste en arrière.

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
permanent** (toast) apparaît, qui ne disparaît pas de lui-même —
ainsi tu ne manques aucune erreur. En mode développeur
(Paramètres → Interface), le message contient les détails
techniques pour un ticket GitHub.

---

## Import inter-identités

Tu n'as **pas** besoin d'être le même utilisateur sur le même
appareil. Une sauvegarde peut être importée dans une
**installation neuve** ou sous un **autre profil utilisateur**. La
restauration rattache les données au profil actif et résout
proprement au passage les références internes (clés étrangères),
de sorte que ta progression reste cohérente — y compris la
progression par étape des leçons, la série et les badges.

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
modes de stockage — serveur (API) et purement navigateur
(Dexie/IndexedDB). Le format est un unique fichier JSON ; il n'y a
aucun format d'archive propriétaire.

!!! note "Protection des données"
    La sauvegarde reste entièrement entre tes mains. Elle n'est
    enregistrée que là où tu la places — rien n'est envoyé à un
    serveur.

---

## Pages connexes

- [Paramètres](../user-guide/settings.md) — un aperçu de toutes les actions sur les données
- [Plusieurs dépôts de contenu](content-repos.md) — les dépôts connectés font partie de l'instantané
