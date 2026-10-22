# Mes leçons

La section **Mes leçons** à `/content` affiche les leçons que vous avez
créées vous-même - soit générées à partir d'une analyse de chat, soit
importées manuellement.

---

## Créer une leçon à partir d'une analyse de conversation

Après avoir importé et analysé un historique de chat :

1. Allez sur la page de détail de l'import (`/import/:id`)
2. Cliquez sur **Enregistrer comme leçon hors ligne**
3. Le système génère automatiquement une leçon complète à partir de l'analyse :
   - Théorie à partir du sujet / résumé / sous-thèmes / forces / faiblesses
   - Matching, texte libre, cloze et assemblage de mots à partir du vocabulaire
4. Vérifiez et enregistrez

Le générateur est **déterministe et hors ligne** - aucun appel IA n'est requis.
La qualité s'adapte à la richesse du vocabulaire dans l'analyse.

---

## Enregistrer une leçon adaptative

Sur la page de résumé d'une session de leçon adaptative (`/adaptive-lesson/:setId`),
un bouton **Enregistrer cette leçon ?** permet de transformer la session en
un ensemble de contenu réutilisable auto-contenu.

---

## Lire, modifier, supprimer, exporter, partager

Dans la section **Mes leçons**, chaque leçon possède des actions :

| Action | Description |
|--------|-------------|
| Lire | Lance la leçon dans le lecteur standard |
| Modifier | Ouvre le **créateur de leçons pré-rempli** avec les métadonnées, les cartes et les exercices de la leçon. Si un de vos ensembles contient **plusieurs leçons**, un **sélecteur de leçon** demande d'abord laquelle modifier. Les leçons de texte de livre ouvrent directement l'**éditeur d'exercices** ; les métadonnées de livre jointes sont conservées. À l'enregistrement, vous choisissez entre **Enregistrer les modifications** (écrase la même leçon - la progression d'apprentissage des cartes inchangées est conservée, les cartes modifiées repartent de zéro) et **Enregistrer comme copie** (crée une nouvelle leçon, l'original reste intact). Les leçons issues d'une analyse ouvrent toujours l'analyse de chat sous-jacente ; les leçons téléchargées d'autres auteurs restent en lecture seule |
| Supprimer | Supprime la leçon localement |
| Exporter | Exporte en fichier `.json` ou `.zip` |
| Partager | Ouvre l'assistant de partage communautaire |

---

## Importer une leçon

Cliquez sur **Importer une leçon** dans la section Mes leçons :

1. Sélectionnez un fichier `.json` ou `.zip`
2. Le système valide le schéma avant d'enregistrer
3. La leçon apparaît dans Mes leçons et peut être lue immédiatement

---

## Partager avec la communauté

**Partager avec la communauté** ouvre un **pull request** sur le dépôt de
contenu officiel. L'export ne demande aucun compte ; le pull request
demande un compte GitHub. Un token GitHub accélère le pull request et est
nécessaire pour partager un ensemble entier comme dépôt personnel (voir
ci-dessous).

L'assistant de partage vous guide à travers :

1. **Validation de contenu** - un validateur côté client vérifie que la leçon
   respecte les normes de qualité (≥ 5 exercices, ≥ 2 types, etc.)
2. **Révision IA optionnelle** - validation de la traduction / grammaire /
   niveau CECR avec suggestions de correction automatique
3. **Aperçu de placement** - où la leçon s'inscrirait dans l'arborescence
   des contenus de la communauté
4. **Soumission** - le pull request se crée par l'un de deux chemins :
   - **Sans token** - une leçon seule ouvre l'éditeur de fichiers de
     GitHub au bon chemin, avec le titre et la description du PR
     pré-remplis. Une petite leçon apporte aussi son contenu ; pour une
     plus grande, l'application télécharge d'abord le fichier et vous le
     collez dans l'éditeur. Un ensemble de plusieurs leçons télécharge
     les fichiers et ouvre la page d'envoi de GitHub, où vous les faites
     glisser. GitHub crée le fork et le pull request dès que vous
     confirmez sur place.
   - **Avec un token GitHub** (Paramètres > Intégrations, voir
     [Paramètres](settings.md)) - une leçon seule se partage sans quitter
     l'application : l'application forke le dépôt, commite la leçon,
     ouvre le pull request puis vous montre son lien. Un ensemble de
     plusieurs leçons passe toujours par le chemin sans token. Si GitHub
     refuse le token, le message renvoie à Paramètres > Intégrations.

La contribution va vers le dépôt de contenu officiel :
[astrapi69/adaptive-learner-content](https://github.com/astrapi69/adaptive-learner-content).
La leçon JSON arrive au bon chemin de l'arborescence et la validation du
dépôt s'exécute automatiquement ; un mainteneur examine le PR et le
fusionne, pour que tout le monde puisse télécharger la leçon.

### Partager comme dépôt

**Partager comme dépôt** envoie l'ensemble entier, au format dépôt de
contenu, vers un dépôt GitHub à vous (créé s'il n'existe pas encore) en
un seul commit. Vous choisissez le dépôt (`owner/name`), privé ou public,
et la branche. Une vérification de qualité passe d'abord : si elle trouve
des problèmes que les contrôles d'un dépôt de contenu refuseraient, elle
les liste et le bouton devient **Exporter quand même**. Vous pouvez
ensuite connecter le dépôt envoyé comme source de contenu (voir
[Plusieurs dépôts de contenu](../features/content-repos.md)). Cela
demande un token GitHub et n'existe que dans la version navigateur de
l'application ; sinon le bouton reste visible mais désactivé, avec la
raison en info-bulle.

---

## Format de leçon

Les leçons utilisateur suivent le même schéma JSON que les leçons
téléchargées. Elles sont jouées dans le lecteur de leçon non modifié - aucune
distinction dans la lecture.

Voir le [guide de création de contenu](../developer/authoring-content.md) pour
le format complet.
