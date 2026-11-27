# Processus de publication

Une publication est faite par deux workflows, pas à la main. `release.yml` coupe la branche de publication, fixe la version et exécute la porte complète avant de pousser quoi que ce soit. `release-finish.yml` fusionne dans `main`, pose le tag et crée la publication en brouillon. La version contraignante, étape par étape, est `.claude/rules/release-workflow.md` ; cette page en est l'aperçu.

## Convention de versionnement

Adaptive Learner suit le Versionnement Sémantique 2.0.0 :

- **Majeur (X.0.0)** - changements incompatibles dans l'API ou
  l'architecture. Réservé aux grandes évolutions futures.
- **Mineur (X.Y.0)** - nouvelles fonctionnalités, rétrocompatibles.
  Valeur par défaut pour chaque complétion de phase.
- **Correctif (X.Y.Z)** - corrections de bogues, rétrocompatibles.
  Chaînes de correctifs.

Les tags de pré-publication (`-alpha`, `-beta`, `-rc`) ne sont
pas utilisés. Les publications sont toujours stables.

## Le chemin

1. **Sur develop, par pull request** : les notes `changelog/releases/vX.Y.Z.md`, la section « Nouveautés » des pages d'aide et les mises à jour de dépendances. Sans le fichier de notes, le workflow ne démarre pas.
2. **Répéter** : `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare` coupe, fixe la version et vérifie sur le runner, et ne pousse rien.
3. **Couper** : `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare -f push_branch=true`. Quand la porte est verte, la branche `release/X.Y.Z` est poussée ; à partir de là, develop est gelé.
4. **Vérifier la branche** : la construction de l'image, l'analyse de sécurité, la porte WebKit, la comparaison visuelle et les trois constructions du launcher sont lancées sur la branche de publication. Une branche poussée par un workflow n'en démarre aucune d'elle-même.
5. **Terminer** : `gh workflow run release-finish.yml --ref release/X.Y.Z -f version=X.Y.Z` fusionne dans `main` sans fast-forward, pose le tag sur le commit de fusion, ouvre la pull request qui ramène la publication dans develop et crée la publication GitHub en brouillon.
6. **Publier** : `publish-image.yml` publie et vérifie l'image, les binaires du launcher des constructions vertes de `main` sont joints, et alors seulement le brouillon devient visible.

### La version est fixée à un seul endroit

`backend/pyproject.toml` est la seule source. La coupe la fixe et `make sync-versions` écrit tous les autres fichiers portant une version (l'ensemble complet est `collect_targets()` dans `scripts/sync_versions.py`). Personne ne modifie un champ de version à la main. `release-gate.yml` vérifie de nouveau les versions sur le tag.

### Ce qui déclenche quoi

- un push sur `main` : `ci.yml`, `deploy-gh-pages.yml` et les constructions du launcher
- le tag : `release-gate.yml`
- le brouillon de publication : rien ; l'image et les binaires viennent de l'étape de publication

`coverage.yml` ne s'exécute pas au push ; il s'exécute chaque nuit et à la demande (`gh workflow run coverage.yml --ref main`).

## Versions des plugins

Les plugins suivent en parallèle la version canonique de
l'application. Le même numéro dans chaque `pyproject.toml` de
plugin et dans les littéraux `__version__` des `__init__.py` des
plugins. Une future décision « core vs plugin tiers » pourrait les
dissocier, mais la configuration actuelle est uniforme sur tous les
fichiers propagés.

## Flux de correctif

Un correctif est la seule publication faite à la main : aucun des deux workflows ne peut couper depuis `main`. Branche `hotfix/vX.Y.Z` depuis `main`, correction, fixer la version et écrire les notes, vérifier la branche avec `release-prepare.yml`, puis `make release-finish VERSION=X.Y.Z FINISH_BRANCH=hotfix/vX.Y.Z` et `make release-publish VERSION=X.Y.Z`.

Un tag poussé n'est jamais supprimé ni déplacé. Une publication erronée est corrigée par la version suivante.

## Commits discrets de mise à jour des dépendances

Lors de la mise à jour des dépendances dans le cycle de
publication (Vite, React, etc.), garder chaque mise à jour dans
son propre commit. Raisons :

- **Granularité de bisect** - une régression s'isole en un seul
  bump.
- **Lisibilité du CHANGELOG** - les lecteurs voient la motivation
  réelle de chaque bump.
- **Rollback** - un mauvais bump peut être annulé indépendamment.

Le pattern complet est documenté dans
`.claude/rules/release-workflow.md`. La discipline
règles-comme-docs maintient les docs lisibles par les humains
(cette page) et les règles lisibles par la machine synchronisées.
