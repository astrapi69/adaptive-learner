# Plusieurs dépôts de contenu

Les leçons proviennent de **dépôts de contenu** — des dépôts
GitHub publics qui regroupent des ensembles de leçons
structurés. Tu n'es pas limité au catalogue officiel : Adaptive
Learner peut charger plusieurs dépôts en même temps, en connecter
de personnels et en recommander de curatés (EXP-023).

<!-- TODO: Screenshot — Paramètres → Données → section Dépôts de contenu avec le dépôt officiel + un dépôt personnel -->

---

## Le dépôt officiel

Le dépôt officiel
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
est toujours chargé et ne peut pas être retiré. Il fournit le
catalogue standard maintenu (cours de langues, bases de Python,
psychologie et plus encore). Chaque ensemble qui en provient
porte dans le navigateur de contenu le badge de source
**Officiel**.

De plus, une sélection de leçons est directement **intégrée** à
l'application (Intégré), afin que le site public GitHub Pages
affiche immédiatement des contenus même sans connexion réseau. Si
un ensemble existe à la fois en version intégrée et dans le dépôt
officiel, la version la plus élevée l'emporte ; en cas d'égalité,
la variante GitHub est privilégiée.

---

## Connecter un dépôt personnel

Sous **Paramètres → Données → Dépôts de contenu**, tu ajoutes une
URL de dépôt GitHub. L'application vérifie automatiquement le
dépôt (voir *Niveaux de confiance* ci-dessous), synchronise le
catalogue de leçons et le stocke localement dans le même cache
que les contenus officiels (système de fichiers en mode serveur,
IndexedDB en mode purement navigateur).

- **Synchronisation manuelle et automatique.** Tu peux à tout
  moment appuyer sur « Synchroniser maintenant » ; de plus, chaque
  dépôt se met à jour automatiquement toutes les 24 heures.
- **Badge de source.** Les ensembles issus de ton dépôt portent
  dans le navigateur de contenu un badge de source propre, de
  sorte que tu vois à tout moment d'où provient une leçon.

---

## Gérer plusieurs dépôts

Tu peux connecter autant de dépôts que tu veux. Dans la liste sous
**Paramètres → Données**, tu peux :

- **Ajouter** via l'URL du dépôt,
- **Retirer** (le dépôt officiel reste protégé),
- **Réorganiser** — l'ordre détermine la **priorité**. Si deux
  dépôts contiennent le même ensemble, celui placé plus haut
  l'emporte.

Les installations plus anciennes avec un seul dépôt connecté sont
automatiquement reprises dans le nouvel affichage en liste.

---

## Partager des dépôts

Tu peux transmettre un dépôt par **lien profond** et **code QR**.
Un lien de la forme `/add-repo?...` ouvre directement chez le
destinataire la boîte de dialogue « Ajouter un dépôt » avec l'URL
pré-remplie ; le code QR fait de même sur le smartphone. Tu
partages ainsi un cours avec ton groupe d'apprentissage sans
ressaisie manuelle.

<!-- TODO: Screenshot — Boîte de dialogue de partage avec code QR -->

---

## Niveaux de confiance

Chaque dépôt connecté passe par une **validation technique
automatique** qui s'exécute à nouveau à chaque synchronisation. Il
en résulte un niveau de confiance :

| Niveau | Signification |
|---|---|
| **0** | Pas encore validé ou vérification échouée. |
| **1** | Techniquement valide : au moins une leçon, aucun contenu exécutable. |
| **3** | **Officiellement recommandé** — issu de la liste de recommandations curatée. |

La validation est purement technique (structure + sécurité). Une
évaluation de contenu/communautaire (confiance 2) nécessite un
service backend partagé et est actuellement reportée.

---

## Dépôts recommandés

Le dépôt officiel gère une liste curatée
(`recommended-repos.json`). Sous **Paramètres → Données**, il en
résulte une section Découvrir où tu ajoutes des dépôts recommandés
en **un clic**. Ils apparaissent avec le badge **Officiellement
recommandé** (confiance 3).

---

## Évaluations locales

Tu peux attribuer localement des **étoiles** à chaque dépôt. Cette
évaluation est purement privée et n'est enregistrée que sur ton
appareil — elle t'aide à organiser tes propres sources. Les
évaluations à l'échelle de la communauté nécessitent elles aussi
un service backend partagé et sont reportées.

---

## Dépôts privés et de coach

Un dépôt peut être privé (par exemple celui d'un enseignant). Pour
cela, tu déposes pour chaque dépôt un **jeton d'accès personnel**.
Le jeton est conservé localement (localStorage) et ne fait
délibérément **pas** partie de la configuration exportable, afin
qu'il ne soit pas transmis par inadvertance lors du partage des
paramètres.

---

## Pages connexes

- [Navigateur de contenu](content-browser.md) — trouver, filtrer, télécharger des ensembles
- [Créer des leçons](../content-creation/overview.md) — contribuer ses propres contenus
- [Sauvegarde et restauration](backup.md) — les dépôts connectés font partie de l'instantané
