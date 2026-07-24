# Foire aux questions

---

## Mes données sont-elles en sécurité ?

**Oui.** Toutes les données restent sur votre propre appareil.

- **Mode API** : base SQLite dans `~/.local/share/adaptive_learner/`
  (Linux/macOS) ou `%LOCALAPPDATA%\adaptive_learner\` (Windows).
- **Mode Dexie** : IndexedDB dans votre navigateur.

Rien - pas vos sessions, pas vos erreurs, pas votre progression - n'est
envoyé à un serveur Adaptive Learner. Seuls les appels à votre fournisseur
IA configuré quittent votre appareil.

---

## Comment configurer une clé API ?

Trois méthodes, par ordre de priorité :

1. **Variable d'environnement** : `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
   ou `GEMINI_API_KEY`. Prioritaire sur tout le reste.
2. **secrets.yaml** : créez `~/.config/adaptive_learner/secrets.yaml` avec
   `anthropic_api_key: sk-ant-...`. Prioritaire sur les paramètres.
3. **Interface Paramètres** : entrez la clé dans **Paramètres → IA**.
   Stockée chiffrée (Fernet) dans la base de données locale.

---

## Puis-je utiliser l'application sans clé API ?

**Oui.** Les fonctionnalités suivantes ne nécessitent pas de clé API :

- Leçons de contenu (matching, images, texte libre, assemblage de mots, cloze)
- File d'attente SRS et sessions de révision
- Missions quotidiennes
- Tableau de bord, suivi des badges et XP

Ce qui nécessite une clé API : sessions d'apprentissage IA, analyse de
conversation, génération de flashcards Anki, questions NotebookLM.

---

## Comment fonctionne la recommandation de changement de méthode ?

La recommandation de changement de méthode se déclenche lorsque ces trois
conditions sont simultanément vraies :

1. Au moins 3 sessions dans la méthode actuelle
2. Stress moyen > 3 sur les 3 dernières évaluations
3. Adéquation de méthode < 3 sur les 3 dernières évaluations

Vous voyez la suggestion en tant que bannière dans l'interface de session.
Vous pouvez accepter, refuser ou reporter. Refuser retarde la prochaine
suggestion de 3 sessions.

---

## L'auto-boucle va-t-elle sans fin ?

Non. L'auto-boucle s'arrête lorsque l'un de ces critères est atteint :

- Le nombre maximum de cycles configuré est atteint (défaut : 5)
- Vous cliquez sur **Terminer la session**
- Vous soumettez une évaluation (la session se suspend, vous décidez
  de continuer ou d'arrêter)
- Une recommandation de changement de méthode est acceptée

---

## Comment exporter mes données ?

Plusieurs options :

- **Paramètres → Données → Sauvegarde** - export JSON complet de toutes
  les données
- **Plugin Learning Repository** - exporte vers un dépôt Git local avec
  commits sémantiques
- **Plugin Anki** - exporte les flashcards en fichier `.apkg`
- **Plugin NotebookLM** - exporte les questions en ZIP Markdown

---

## La voix fonctionne-t-elle hors ligne ?

Les sessions de prononciation nécessitent un accès réseau pour l'API de
synthèse vocale. La détection de disponibilité de la prononciation est
basée sur la taxonomie du sujet - elle ne s'active que pour les projets
liés à l'apprentissage des langues.

---

## Comment importer des chats depuis ChatGPT ou Claude ?

1. Exportez votre conversation depuis la plateforme IA (généralement au
   format JSON ou Markdown)
2. Allez dans **Importer** dans la navigation
3. Déposez le fichier ou utilisez le sélecteur de fichiers
4. Le système détecte le format automatiquement
5. Déclenchez l'analyse depuis la page de détail de l'import

Voir la [section Analyse de conversation](../user-guide/my-lessons.md) pour
plus de détails.

---

## Puis-je synchroniser entre plusieurs appareils ?

**Mode API** : oui, via la synchronisation locale sur réseau. Allez dans
**Paramètres → Données → Synchronisation** et configurez l'adresse de
votre instance de synchronisation.

**Mode Dexie** : non - les données IndexedDB restent dans le navigateur.
L'exportation/importation manuelle de sauvegarde JSON est la seule option.

---

## En quoi Adaptive Learner est-il différent de ChatGPT pour apprendre ?

| Aspect | ChatGPT | Adaptive Learner |
|--------|---------|-----------------|
| Évaluation | Aucune - le chat ne sait pas si vous avez compris | Évaluateur à double invite après chaque réponse |
| Progression | Aucune - chaque chat repart de zéro | Profil d'apprentissage, historique de commits, SRS |
| Méthode | Aucune - répondre aux questions | Six méthodes avec matrice d'invites 42 cellules |
| Outils | Limité | Anki, NotebookLM, Learning Repository intégrés |
| Données | Dans le cloud, utilisées pour l'entraînement | Sur votre appareil uniquement |

Adaptive Learner utilise votre clé API pour appeler le même modèle, mais
ajoute la structure pédagogique, le suivi et l'adaptation que le chat seul
ne fournit pas.
