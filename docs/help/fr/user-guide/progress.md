# Progression

La page Progression donne un aperçu détaillé de votre activité
d'apprentissage, de vos évaluations par étape et de votre historique
de commits.

---

## Aperçu des évaluations par étape

La section en haut de la page agrège les données d'évaluation de l'IA
évaluatrice sur toutes vos sessions :

| Métrique | Explication |
|----------|-------------|
| Évaluations totales | Nombre de fois où l'évaluateur à double invite a jugé votre réponse |
| Confiance moyenne | Score moyen (0-100 %) sur toutes les évaluations |
| Avances | Combien de fois avez-vous avancé à l'étape suivante |
| Répétitions | Combien de fois avez-vous répété une étape |
| Reculs | Combien de fois avez-vous reculé d'une étape |
| Répartition par étape | Quelle étape prend le plus de temps ? |

Ces données révèlent des schémas - par exemple : si l'étape 2 (Attempt)
génère régulièrement des répétitions, cela indique que le matériel d'input
de l'étape 1 n'est pas suffisamment clair.

---

## Historique des commits

En dessous de l'aperçu se trouve votre historique de **ProgressCommit**
complet - une entrée par session complétée.

Chaque entrée affiche :
- Date et heure
- Méthode utilisée
- Étape de cycle atteinte
- Nombre de cycles
- Notes de compréhension, stress et adéquation (1-5)
- Extrait des notes de session (si renseignées)

---

## Filtrage et tri

Vous pouvez filtrer l'historique par :
- Projet
- Méthode
- Plage de dates
- Note de compréhension (par ex. uniquement les sessions avec compréhension ≥ 4)

---

## Exportation

La page Progression propose plusieurs options d'exportation :

| Format | Contenu |
|--------|---------|
| JSON | Tous les commits avec métadonnées complètes |
| Markdown | Résumé lisible des sessions |
| CSV | Données tabulaires pour analyse dans un tableur |

---

## Lien avec les plugins

- **Learning Repository** - exporte toutes les données de progression
  vers un dépôt Git avec des commits sémantiques
- **Anki** - les flashcards extraites sont liées à leurs sessions sources
- **NotebookLM** - les questions générées peuvent être filtrées par session
