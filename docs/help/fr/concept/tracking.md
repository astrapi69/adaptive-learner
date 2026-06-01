# Suivi de l'apprentissage

Adaptive Learner traite chaque session d'apprentissage terminée comme un
**commit Git** pour vos connaissances. Cette analogie n'est pas accessoire —
elle est au cœur du modèle de données.

---

## Pourquoi l'analogie Git ?

Un commit Git enregistre :
- **Ce qui a changé** (le diff)
- **Quand cela s'est produit** (l'horodatage)
- **Pourquoi cela s'est produit** (le message de commit)
- **Dans quel contexte** (la branche, le parent)

Un **ProgressCommit** dans Adaptive Learner enregistre :
- **Ce qui a été appris** (méthode, étape du cycle, notes)
- **Quand cela s'est produit** (début et fin de la session)
- **Comment cela s'est passé** (compréhension, stress, adéquation de méthode)
- **Dans quel contexte** (projet, profil, nombre de cycles)

---

## Le modèle ProgressCommit

Chaque session terminée génère une entrée dans votre historique contenant :

| Champ | Signification |
|-------|---------------|
| `session_id` | Référence à la session source |
| `method` | Méthode d'apprentissage utilisée |
| `cycle_step` | Jusqu'à quelle étape du cycle (1-7) |
| `cycle_count` | Combien de cycles dans cette session |
| `understanding` | Votre auto-évaluation de la compréhension (1-5) |
| `stress` | Votre niveau de stress ressenti (1-5) |
| `method_fit` | Adéquation perçue de la méthode (1-5) |
| `notes` | Notes de session en texte enrichi (optionnel) |
| `committed_at` | Horodatage de fin de session |

---

## La couche de gamification

Par-dessus le suivi s'appuie une couche de gamification légère :

**XP (points d'expérience)**
Chaque session complète génère des XP selon votre performance.
Les niveaux montent avec les XP selon une fonction racine carrée,
pour que les débuts soient motivants et les niveaux élevés récompensent
la persévérance.

**Badges**
Des jalons thématiques (première session, 10 sessions dans une méthode,
série de 30 jours, maîtrise de 50 éléments via le SRS, etc.) sont
enregistrés comme badges. Les badges ont trois niveaux : bronze, argent, or.

**Séries**
Un apprentissage quotidien sans interruption incrémente votre série. Les
séries expirent après 24 heures sans activité — avec trois gels de série
par mois pour les jours de déplacement ou de maladie.

---

## Dépôt d'apprentissage

Le plugin **Learning Repository** peut exporter un instantané de tous
vos commits de progression vers un dépôt Git local. Chaque projet
devient un dossier avec :

- Un `README.md` avec vos statistiques d'apprentissage
- Un `LEARNING_STATS.md` avec les données de progression détaillées
- Un `CHEATSHEET.md` issu de vos notes de session
- Des dossiers de sujets numérotés à partir de votre curriculum

Si le mode Git est activé, chaque achèvement de session crée un véritable
commit Git avec un message de commit sémantique.

---

## Confidentialité

Tout le suivi reste **sur votre propre appareil**. En mode API, les données
sont stockées dans une base SQLite dans votre répertoire utilisateur.
En mode Dexie (déploiement GitHub Pages), tout est dans l'IndexedDB
de votre navigateur. Rien sur vos difficultés ou vos progrès d'apprentissage
n'est jamais envoyé à un serveur central.
