# Premiers pas

Adaptive Learner est un compagnon d'apprentissage qui repose sur
un modèle à six méthodes étayé par la recherche. Tu passes un court
test qui détermine quelles méthodes te conviennent, puis tu mènes
des sessions d'apprentissage assistées par IA à travers un cycle en
sept étapes. L'application apprend avec toi et adapte sa façon
d'enseigner.

## Essayer maintenant

Le moyen le plus rapide de découvrir Adaptive Learner est la
version en ligne publique :

[**Ouvrir l'application**](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }

Celle-ci fonctionne en **mode local** - toutes tes données restent
dans ton navigateur (IndexedDB), et les appels IA partent
directement de la page vers Anthropic, OpenAI ou Google Gemini avec
ta propre clé d'API. Aucun backend entre les deux.

## Installer comme application web progressive

Adaptive Learner est installable. Les navigateurs modernes
affichent dès la première visite une invite « Installer » ou
« Ajouter à l'écran d'accueil ». Accepte-la et Adaptive Learner
devient une application autonome sur ton smartphone ou ton bureau,
lançable sans onglet de navigateur.

L'application fonctionne hors ligne pour le tableau de bord et les
sessions passées. Les nouvelles sessions IA nécessitent Internet,
car le fournisseur d'IA se trouve en dehors du navigateur.

## Ce dont tu as besoin

- **Un navigateur moderne** (Chrome 100+, Firefox 100+, Safari
  17+, Edge 100+). L'application utilise IndexedDB, les service
  workers et du JavaScript moderne.
- **Une clé d'API IA** pour au moins l'un des trois fournisseurs
  pris en charge (Anthropic, OpenAI ou Google Gemini). Les quotas
  gratuits suffisent généralement pour débuter ; voir
  [Paramètres](settings.md) pour la configuration de la clé.

## Les cinq premières minutes

1. **Ouvrir l'application** et choisir la langue. Les 8 langues
   d'interface sont entièrement traduites (DE, EN, ES, FR, EL, PT,
   TR, JA).
2. **Intégration : seulement le nom + le sujet.** Le démarrage
   rapide ne demande que ces deux champs, tout le reste prend des
   valeurs par défaut. Ensuite, tu peux choisir « Démarrer
   directement » ou configurer de façon plus détaillée ton profil
   dans l'assistant. Voir [Intégration](onboarding.md).
3. **Démarrer la première leçon** - le moyen le plus rapide sans
   clé IA : ouvre le
   [Navigateur de contenu](../features/content-browser.md) sous
   `/content`, choisis un ensemble de leçons et démarre une leçon.
   Tu lis une courte théorie et fais des exercices ; à la fin, tu
   vois ton résultat avec des étoiles. Voir
   [Leçons et révisions](lessons.md).
4. **Optionnel : sessions IA.** Si tu préfères la conversation
   d'apprentissage guidée à six méthodes, dépose une **clé d'API**
   (Paramètres ou `~/.config/adaptive-learner/secrets.yaml`),
   passe le [test de style d'apprentissage](assessment.md)
   optionnel et démarre une [session d'apprentissage](learning-session.md).
5. **Sauvegarder ton résultat.** Depuis le récapitulatif de la
   leçon, tu peux copier le résultat en Markdown ou l'enregistrer
   comme fichier, et créer une [sauvegarde](../features/backup.md)
   sous **Paramètres → Données**.

## Et ensuite

- [Leçons et révisions](lessons.md) - le déroulement d'une leçon en détail
- [Navigateur de contenu](../features/content-browser.md) - trouver et filtrer des leçons
- [Plusieurs dépôts de contenu](../features/content-repos.md) - connecter ses propres sources de contenu
- [Sauvegarde et restauration](../features/backup.md)
- [Comprendre ton tableau de bord](dashboard.md) - progression, série, XP, badges
- [FAQ - questions fréquentes](faq.md)
- [L'idée pédagogique derrière l'application](../concept/philosophy.md)
