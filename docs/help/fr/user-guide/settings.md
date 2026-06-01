# Paramètres

La page Paramètres est organisée en onglets. Voici un aperçu de chaque
section.

---

## Général

### Apparence

Choisissez parmi six thèmes :

| Thème | Style |
|-------|-------|
| `light` | Clair — blanc et tons clairs |
| `dark` | Sombre — fond foncé |
| `ocean` | Bleus et teintes océan |
| `forest` | Verts forestiers |
| `high-contrast` | Contraste élevé WCAG AA |
| `sepia` | Tons chauds sépia |
| `auto` | Suit le thème du système d'exploitation |

Le changement de thème est instantané — aucun rechargement nécessaire.

### Langue

Sélectionnez votre langue d'interface parmi les huit disponibles :
allemand, anglais, espagnol, français, grec, portugais, turc, japonais.

### Mode développeur

Activé, ce mode affiche les détails techniques complets dans les messages
d'erreur (statut HTTP, endpoint, trace). Désactivé par défaut — les
utilisateurs en production voient des messages d'erreur conviviaux.

---

## IA

### Fournisseur actif

Choisissez parmi Anthropic, OpenAI ou Gemini. Le fournisseur sélectionné
est utilisé pour toutes les sessions IA, analyses et générations.

### Clés API

Entrez les clés API pour chaque fournisseur. Les clés sont chiffrées
(Fernet) dans la base de données locale.

La source de la clé est indiquée pour chaque fournisseur :
- **Paramètres** — entrée dans cette interface
- **Variable d'environnement** — définie externement, le champ est désactivé
- **secrets.yaml** — lue depuis `~/.config/adaptive_learner/secrets.yaml`

### Modèle

Pour chaque fournisseur, sélectionnez le modèle à utiliser (par ex.
`claude-opus-4-5`, `gpt-4o`, `gemini-2.0-flash`).

---

## Apprentissage

### Stratégie de direction des exercices

Pour les leçons de contenu avec des exercices directionnels :
- **Auto** — réceptif d'abord, puis productif une fois la reconnaissance
  solide
- **Réceptif en priorité** — toujours reconnaître avant de produire
- **Focus productif** — orientation prioritaire vers la production
- **Équilibré** — mélange dès le début

### Paramètres d'auto-boucle

- **Cycles maximum** — combien de cycles avant la pause (défaut : 5)
- **Délai entre cycles** — secondes de pause entre les cycles

### Source de langues du contenu

Langues source supplémentaires à afficher dans l'explorateur de contenu
en plus de votre langue d'application. Par défaut, seul le contenu dans
votre langue d'application est affiché.

---

## Interface

### Intensité des retours

Contrôle les animations et phrases de félicitations lors de bonnes réponses :
- **Subtil** — animations minimales, pas de phrases
- **Normal** — animations modérées et phrases occasionnelles
- **Enthousiaste** — animations complètes et phrases fréquentes

L'option `prefers-reduced-motion` du système d'exploitation force **Subtil**
quelle que soit la valeur configurée.

### Sons

Active les effets sonores de synthèse lors des célébrations. Désactivé
par défaut. Réglage du volume et bouton Test disponibles.

---

## Gamification

### Afficher la gamification

Bascule la visibilité des éléments XP, badge et série sur le tableau
de bord.

### Galerie des badges

Ouvre la galerie de badges complète avec filtrage, tri et vue des
critères de déverrouillage pour chaque badge.

### Réinitialiser

Réinitialise les données XP, badge et série. Le curriculum, les sessions
et les évaluations sont préservés. Nécessite une double confirmation.

---

## Données

### Mode de stockage

Bascule entre **Mode API** (backend SQLite) et **Mode Dexie** (IndexedDB
navigateur). Un rechargement de page est nécessaire après le changement.

### Sauvegarde et restauration

Exportez toutes vos données en JSON. Importez une sauvegarde précédente.

### Synchronisation locale

Si activée, synchronise les données avec d'autres appareils sur votre
réseau local.

### Exportation Anki

Accès direct à la gestion des flashcards Anki — voir la [section Anki
du guide](../user-guide/getting-started.md).

### Durée de conservation des leçons en pause

Nombre de jours avant qu'une leçon en pause soit automatiquement abandonnée.
Défaut : 30 jours. Plage : 7-90 jours.

---

## Aide / À propos

Affiche la version actuelle de l'application, les liens vers la documentation
et GitHub, et les informations de licence.
