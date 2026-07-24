# Créer des leçons — aperçu

Adaptive Learner vit de ses contenus. Tu peux construire tes
propres leçons — directement dans l'application ou sous forme de
fichier au format dépôt de contenu — et les partager avec la
communauté. Cette page donne l'aperçu ; les détails complets du
format se trouvent dans les sources liées.

---

## Deux manières de créer des leçons

### 1. Dans l'application : le créateur de leçons

Le **créateur de leçons** sous `/create-lesson` est un assistant
en 4 étapes (Métadonnées → Éditeur de cartes → Éditeur
d'exercices → Enregistrer/Partager) et ne nécessite **aucune clé
IA** :

- Ordonner les cartes par glisser-déposer ou les **importer depuis
  un CSV** ; les cartes peuvent porter une **image téléversée**.
- L'étape des métadonnées propose un sélecteur de **domaine de
  connaissances** (p. ex. langue, programmation, psychologie,
  éducation canine, code de la route).
- **Générer automatiquement** des exercices à partir des cartes ou
  les **éditer entièrement toi-même** à l'étape 3 : chaque type
  d'exercice de base peut être créé, modifié et ajouté
  manuellement — y compris le **choix multiple** natif avec un
  commutateur bien visible **sélection simple/multiple**.
- La **dictée** (dictée audio) est disponible directement dans le
  sélecteur de type d'exercice ; téléverse le clip audio comme
  fichier (intégré dans la leçon) ou saisis un chemin d'asset. La
  leçon est automatiquement marquée comme dépendante d'extensions.
- L'**assistant de rédaction d'extensions** construit avec
  l'assistance de l'IA les cinq types d'exercices d'extension
  (catégorisation, correction d'erreurs, compréhension écrite,
  quiz noté, dictée).
- **Modèles** (Vierge / Vocabulaire / Grammaire / Conversation) et
  **enregistrement automatique du brouillon**.
- **Aperçu** dans le véritable lecteur de leçons avant
  l'enregistrement.
- **Enregistrer localement** ou **partager via une pull request**.

Des points d'entrée existent dans le navigateur de contenu et dans
le tableau de bord.

#### Leçon de savoir à partir d'un texte (mode livre)

La cinquième carte de modèle, **« Leçon de savoir à partir d'un
texte »**, lance un flux dédié en 3 étapes (Métadonnées → Texte du
livre → Vérification) : colle une section (p. ex. un chapitre) de
ton manuel — l'IA la reformule **dans ses propres mots** en étapes
de théorie (jamais une copie) et génère des exercices assortis qui
renvoient à leur étape de théorie. En option, des métadonnées de
livre (titre, auteur, URL, ISBN/ASIN) peuvent être jointes ; elles
sont conservées lorsque tu modifies la leçon plus tard.

Au lieu de coller du texte, tu peux aussi **téléverser un fichier
de livre** (EPUB, DOCX, TXT ou Markdown, jusqu'à 20 MiB). Le
fichier est analysé entièrement **dans le navigateur** — rien
n'est envoyé — et les chapitres détectés apparaissent sous forme
de **liste à cases à cocher**. Les sections qui ressemblent à des
pages liminaires ou annexes (préface, glossaire, index, …) sont
**décochées par défaut** par une heuristique, mais restent
visibles et sélectionnables :

- **Une section sélectionnée** — elle est reprise dans le champ de
  texte (avec un aperçu ; un champ déjà rempli demande d'abord).
- **Plusieurs sections sélectionnées** — la **génération par
  lots** crée **une leçon par section** et les enregistre ensemble
  comme ensemble multi-leçons.

Lors de la **modification** d'un ensemble multi-leçons, un
**sélecteur de leçon** demande quelle leçon ouvrir ; les leçons de
texte de livre ouvrent directement l'éditeur d'exercices.

Contrairement à la voie basée sur les cartes, ce mode nécessite
une **clé IA configurée**. Ne colle que des textes sur lesquels tu
as les droits, ou qui sont destinés à un usage personnel.

### 2. Sous forme de fichier : le format dépôt de contenu

Une leçon est un fichier JSON dans un **ensemble de contenu**. Les
ensembles se trouvent dans des dépôts GitHub publics et suivent
une arborescence fixe (`sets/{langue-source}/{langue-cible-niveau}/`).
Les guides de référence se trouvent dans le dépôt de contenu :

- **Premiers pas :**
  [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- **Format de leçon :**
  [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

Un **kit de démarrage** prêt à observer et copier est
[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test).

---

## Partager via une pull request

Partager une leçon crée une véritable **pull request** (fork →
commit → PR). L'application propose automatiquement le bon chemin
et un nom de fichier numéroté et détecte les doublons/variantes.
La **pipeline de validation** du dépôt de contenu vérifie chaque
leçon soumise à chaque PR (schéma, paire de langues, seuils de
qualité minimaux), de sorte que seuls des contenus propres entrent
dans le catalogue. En option, il existe une vérification de
contenu assistée par IA ; elle ne bloque jamais le partage.

---

## Pages connexes

- [Créer des contenus de leçon (développeur)](../developer/authoring-content.md) — détails du schéma, ressources, cartes code/formule
- [Recommandations de livres](books.md) — gérer `books.yaml`
- [Plusieurs dépôts de contenu](../features/content-repos.md) — connecter son propre dépôt
