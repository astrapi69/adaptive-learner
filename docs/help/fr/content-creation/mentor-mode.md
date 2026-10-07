# Mode mentor : améliorer tes propres leçons en les jouant

Le meilleur contrôle de qualité d'une leçon, c'est de la jouer
soi-même : en tant qu'auteur, tu remarques les fautes de frappe, les
questions peu claires et les réponses mal évaluées exactement là où
elles se produisent. Le mode mentor transforme ce parcours en un flux
de travail en boucle : **annoter en jouant, traiter dans l'éditeur** -
sans interrompre le flux d'apprentissage et sans perdre la moindre
progression d'apprentissage.

---

## À quelles leçons cela s'applique-t-il ?

Les fonctions de mentor n'apparaissent que sur **tes propres leçons** -
les ensembles que tu as créés dans l'application, importés, ou dérivés
d'un ensemble téléchargé via « Modifier en tant que copie ». Sur les
ensembles originaux téléchargés et sur les leçons d'analyse issues de
l'import de chat, le lecteur de leçons reste inchangé ; leur
modification passe toujours par « Mes contenus ».

---

## Les trois étapes du flux de travail

### 1. En jouant : recueillir des notes de mentor

Sous chaque étape d'une leçon personnelle - théorie comme exercice -
se trouve le bouton discret **« Note de mentor »**. Un appui ouvre un
petit formulaire :

- **Catégorie** : quel est le problème ? (voir le tableau ci-dessous)
- **Texte libre** : qu'est-ce qui doit être amélioré exactement ?

**« Enregistrer la note »** te ramène directement au flux
d'apprentissage. Une étape qui porte déjà une note affiche à la place
**« Modifier la note de mentor »** - la note peut être modifiée à tout
moment ou supprimée avec **« Supprimer la note »**.

Important : la note ne modifie **pas** la leçon elle-même. Tes
réponses sont évaluées comme d'habitude ; la progression et la
planification des révisions continuent sans changement.

| Catégorie | À quoi elle sert |
|---|---|
| Faute de frappe | Orthographe, caractères manquants, ponctuation |
| Formulation peu claire | La question est ambiguë ou facile à mal comprendre |
| Trop facile | L'exercice ne présente pas de défi (p. ex. distracteurs trop évidents) |
| Trop difficile | L'exercice est trop exigeant à ce stade de la leçon |
| Réponse mal évaluée | Une bonne réponse n'est pas acceptée (ou inversement) |
| Autre | Tout le reste - p. ex. un paragraphe de théorie qui devrait être restructuré |

### 2. Dans le récapitulatif : la liste des points à traiter

À la fin de la leçon, le récapitulatif affiche le bloc
**« Notes de mentor (n) »** : chaque annotation du parcours avec sa
catégorie et son texte. Chaque ligne peut être supprimée
individuellement - par exemple lorsque tu écartes une annotation après
réflexion.

En dessous, **« Modifier cette leçon dans l’éditeur »** mène
directement à l'éditeur de leçons avec exactement cet ensemble et
cette leçon préchargés. Le même lien vers l'éditeur est déjà
disponible pendant le jeu, dans le panneau repliable **Options** du
lecteur - au cas où tu voudrais corriger une erreur immédiatement au
lieu de terminer d'abord la leçon.

### 3. Dans l'éditeur : traiter les notes

Lorsque tu ouvres dans l'éditeur une leçon personnelle qui porte des
notes de mentor, le panneau **« Notes de mentor pour cette leçon (n) »**
apparaît au-dessus de l'assistant - ta liste de points à traiter,
exactement là où tu corriges. Pour chaque note :

- La catégorie et le texte se trouvent juste à côté des étapes que tu
  modifies.
- L'icône de corbeille marque une note comme traitée et la supprime -
  de manière synchronisée avec le lecteur et le récapitulatif aussi.

Comme ta progression d'apprentissage est ancrée à des identités
d'exercice stables, tes cartes de révision survivent aux corrections :
une faute de frappe corrigée ou une question reformulée ne rend
orphelin aucun historique SRS.

---

## Suggestions IA (optionnel, ta propre clé)

Chaque note du panneau de l'éditeur propose le bouton
**« Suggestion IA »**. Il envoie ton annotation avec l'exercice
concerné à ton fournisseur d'IA configuré et renvoie une proposition
de révision courte et concrète dans la langue de ton application.

- La proposition est **uniquement affichée** - elle n'est jamais
  appliquée automatiquement à la leçon. Tu décides toi-même, à la
  main, de ce que tu intègres.
- Comme toute fonction IA, elle est **BYOK** (bring your own key,
  apporte ta propre clé) : sans clé configurée, le bouton est grisé et
  renvoie à Paramètres → IA.
- Lorsque rien d'exploitable ne revient, l'application le dit
  honnêtement - mieux vaut aucune proposition qu'une mauvaise.

Pour les notes sur les étapes de théorie, la requête part sans JSON
d'exercice ; la proposition s'appuie alors sur ton annotation et le
titre de la leçon.

---

## Où les notes sont stockées

Les notes de mentor sont une **aide à la rédaction locale** sur ton
appareil - elles ne sont pas du contenu d'apprentissage partagé et ne
sont pas synchronisées entre appareils. Par ailleurs :

- Elles se comportent de manière identique dans les deux modes de
  stockage (mode serveur et mode navigateur).
- Elles survivent au rechargement, au redémarrage de l'application et
  au retour dans la leçon.
- Elles voyagent avec ta sauvegarde : export → import restaure aussi
  les notes de mentor ouvertes.

---

## Pourquoi ne pas modifier directement dans le lecteur ?

C'est voulu. Une leçon qui change sous le lecteur en cours d'exécution
est une source classique de progression orpheline et d'évaluation
incohérente. Le mode mentor sépare donc proprement : le lecteur
recueille des observations, l'éditeur modifie le contenu - par le même
chemin d'écriture éprouvé que toute autre modification. Tu ne perds
rien : le lien vers l'éditeur t'amène au bon endroit d'un seul appui,
à tout moment.

---

## Conseils pratiques

- **Joue comme un apprenant, annote comme un mentor.** Réponds
  sérieusement - tes propres tentatives erronées te montrent quels
  exercices sont vraiment perfectibles.
- **Une note courte suffit.** « Distracteur B trop proche de la
  réponse » vaut plus qu'un paragraphe - tu ajoutes les détails dans
  l'éditeur.
- **Vide la liste des points à traiter.** Ne supprime une note qu'une
  fois la correction enregistrée - ainsi la liste reste ton reste à
  faire honnête.
- **Rejoue-la une fois après coup.** La preuve la plus rapide qu'une
  correction fonctionne, c'est le même chemin sur lequel tu as trouvé
  l'erreur.
