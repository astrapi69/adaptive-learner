# Premiers pas

## Prérequis

Adaptive Learner peut être utilisé de deux manières :

| Mode | Prérequis | Fonctionnalités |
|------|-----------|-----------------|
| **Mode API** (par défaut) | Python 3.11+, Node 24+ | Toutes les fonctionnalités |
| **Mode navigateur** (GitHub Pages) | Navigateur moderne | Leçons de contenu, SRS, missions |

Pour le mode API avec fonctionnalités IA complètes, vous aurez besoin
d'une clé API pour au moins un fournisseur : Anthropic, OpenAI ou Gemini.

---

## Installation (mode API)

```bash
# Cloner le dépôt
git clone https://github.com/astrapi69/adaptive-learner.git
cd adaptive-learner

# Installer toutes les dépendances
make install

# Démarrer le backend et le frontend
make dev
```

L'application sera disponible à l'adresse `http://localhost:15174`.

---

## Installation de l'application web progressive (PWA)

Adaptive Learner peut être installé comme une application de bureau depuis
votre navigateur :

1. Ouvrez `http://localhost:15174` dans Chrome, Edge ou Safari
2. Cliquez sur l'icône d'installation dans la barre d'adresse (ou le
   menu du navigateur)
3. L'application s'ouvre dans sa propre fenêtre et fonctionne hors ligne
   pour les leçons consultées précédemment

---

## Vos 5 premières minutes

### Étape 1 : Configuration de la clé API

Rendez-vous dans **Paramètres → IA** et entrez votre clé API pour au moins
un fournisseur. La clé est stockée de manière chiffrée dans votre base
de données locale.

Si vous préférez ne pas entrer de clé dans l'interface, vous pouvez la
définir via une variable d'environnement :

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=...
```

### Étape 2 : Test d'évaluation

Depuis le tableau de bord, cliquez sur **Commencer l'évaluation**. Les
12 questions prennent environ 3 minutes. Le résultat est un profil
pondéré sur les six méthodes d'apprentissage — votre point de départ
pour les recommandations de session.

### Étape 3 : Créer un projet d'apprentissage

Cliquez sur **Nouveau projet** et renseignez :

- **Sujet** — que souhaitez-vous apprendre ?
- **Objectif** — que voulez-vous être capable de faire ?
- **Calendrier** — pour quand ?

Les autres champs sont facultatifs lors du premier démarrage.

### Étape 4 : Démarrer votre première session

Depuis votre projet, cliquez sur **Nouvelle session**. L'application
propose une méthode basée sur votre profil — vous pouvez l'accepter
ou en choisir une autre.

La session se déroule dans une interface de chat. Le cycle en sept étapes
s'exécute en arrière-plan ; vous n'avez pas besoin d'y penser.

### Étape 5 : Évaluer et terminer

Après avoir atteint l'étape 7 (ou quand vous êtes prêt), cliquez sur
**Terminer la session**. Notez la compréhension, le stress et l'adéquation
de la méthode — ces notes influencent les recommandations futures.

---

## Prochaines étapes

- [Test d'évaluation](assessment.md) — comprendre votre profil
- [Sessions d'apprentissage](learning-session.md) — guide détaillé de la session
- [Leçons de contenu](lessons.md) — apprendre sans clé API
- [Tableau de bord](dashboard.md) — comprendre votre progression
