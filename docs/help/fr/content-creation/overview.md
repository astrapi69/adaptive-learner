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
en 4 étapes (Métadonnées → Éditeur de cartes → Générateur
d'exercices → Enregistrer/Partager) et ne nécessite **aucune clé
IA** :

- Ordonner les cartes par glisser-déposer ou les **importer depuis
  un CSV**.
- **Générer automatiquement** des exercices à partir des cartes
  (les cinq types d'exercices) ou les ajuster finement à la main.
- **Modèles** (Vierge / Vocabulaire / Grammaire / Conversation) et
  **enregistrement automatique du brouillon**.
- **Aperçu** dans le véritable lecteur de leçons avant
  l'enregistrement.
- **Enregistrer localement** ou **partager via une pull request**.

Des points d'entrée existent dans le navigateur de contenu et dans
le tableau de bord.

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
