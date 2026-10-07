# Portes, cliquets et protection de branche

Ce projet est inhabituellement strict : des dizaines de portes CI, une
famille de cliquets à références figées, des issues et pull requests
obligatoires, un contrat de test des portes, et une protection de branche
qui s'applique aussi aux administrateurs. Presque rien de tout cela n'a été
écrit là où un humain le lit : tout vit dans les fichiers de règles
destinés aux agents, sous
[`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).
Cette page est la carte pour les humains : ce qu'est chaque mécanisme,
pourquoi il existe et, ce qui compte vraiment quand vous êtes bloqué, ce
qu'il faut faire.

Rien ici ne reformule une norme. Là où une règle porte la formulation
contraignante, cette page renvoie vers elle et l'explique. Les règles sont
la source de vérité ; une seconde copie dériverait, et ce dépôt l'a vu
arriver plus d'une fois.

## Deux cadences : portes de PR et équipe de nuit

Une pull request verte ne signifie **pas** que `develop` est vert. La CI
des PR n'exécute que les portes de correction, celles dont l'échec doit
bloquer une fusion. Tout ce qui est informatif, en simple avertissement ou
dépendant d'un état externe s'exécute dans l'équipe de nuit (une
planification nocturne plus `workflow_dispatch`).

| S'exécute sur chaque PR | S'exécute la nuit + à la publication |
|---|---|
| tests backend / plugins / frontend, ruff + mypy, pre-commit, vérificateur de dérive des docs | analyse de sécurité (pip-audit / bun audit / bandit) |
| cliquet de complexité, gardes de taille de dossier + de fichier | rapport de couverture (un rapport, pas une porte) |
| porte des références visuelles, porte des références testid | E2E en mode Dexie, régression visuelle, tests de mutation |
| docker-build-smoke (filtré par chemin) | dérive des statistiques de contenu, porte WebKit |

La conséquence : une modification d'une surface que seule l'équipe de nuit
couvre peut passer une PR propre et rendre rouge l'exécution nocturne
suivante. C'est une classe de risque connue et récurrente, pas un cas
isolé. Le tableau de référence et le raisonnement se trouvent dans
[`quality-checks.md` -> « CI cadence: PR gates vs the night shift »](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).

## Ce qu'est une porte, et ce qu'elle n'est pas

Une porte est une vérification qui **échoue de manière fermée**. Le contrat
de test des portes du projet (cinq tests par porte) est détaillé dans
[`quality-checks.md` -> « Gate test contract »](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).
Les deux règles que vous ressentirez en tant que contributeur :

- **Une porte qui ne peut pas vérifier ne doit jamais afficher vert.**
  « Je n'ai pas pu m'exécuter » n'est pas « il n'y a rien à trouver ». Si
  la base d'une porte manque (référence absente, utilitaire planté,
  frontend non construit), elle échoue, elle ne passe pas.
- **Une porte indique ce qu'elle a mesuré.** « 0 constat » et « 0 fichier
  examiné » ne sont pas le même résultat, et la porte est construite pour
  que vous puissiez les distinguer.

Donc, quand une porte vous bloque, lisez ce qu'elle dit avoir mesuré avant
de supposer qu'elle se trompe. La plupart des « faux » échecs de porte sont
la porte qui signale correctement une vraie dérive que vous n'attendiez pas.

## Cliquets et références

Un **cliquet** compare une mesure actuelle à une référence figée qui vit
dans l'arborescence. La mesure peut s'améliorer librement ; elle ne peut
pas régresser en silence. Les deux moitiés, le nombre et la référence, sont
commitées, donc les deux peuvent dériver.

La famille des cliquets et l'emplacement de chaque référence :

| Cliquet | Fichier de référence | Cible locale |
|---|---|---|
| Complexité cyclomatique | `.complexity-baseline` | `make check-complexity-gate` |
| Taille des fichiers (lignes) | `.filesize-baseline` | `make check-file-sizes` |
| Taille des dossiers (fichiers à plat/dossier) | `.dirsize-baseline` | `make check-folder-size` |
| Taille de `global.css` | `.css-size-baseline` | `make check-css-size` |
| Jetons de thème / contraste | `.theme-baseline.json` | `make verify-theme` |
| Taille du corpus de règles | `.claude/rules/.corpus-baseline.json` | `make verify-rule-corpus-size` |
| Substituts d'umlauts dans les docs | `docs/.docs-hygiene-baseline.json` | `make verify-docs-hygiene` |
| Références de docs cassées | `docs/.doc-refs-baseline.json` | `make verify-doc-refs` |
| Taille de l'image publiée | (dans `verify-image-size`) | `make verify-image-size` |

### Quand un cliquet vous bloque

1. **Fusionnez d'abord `develop`, puis remesurez.** Un cliquet compare
   l'arborescence actuelle à une référence ; une branche en retard sur sa
   base porte une *ancienne* référence face à un *nouveau* contenu fusionné,
   donc le nombre que vous lisez localement n'est pas celui que lit la CI.
   Mettez votre branche à jour avant de toucher à quoi que ce soit.
   Pourquoi cela mord est documenté dans
   [`lessons/ci-gates.md` -> « A ratchet baseline is itself a
   measurement »](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md).

2. **Si la hausse est légitime, relevez la référence délibérément, et
   dites pourquoi.** Chaque cliquet a une cible explicite de relèvement ou
   de mise à jour, afin que le nouveau plafond arrive dans votre diff,
   relisible, avec une raison dans le message de commit :

   ```bash
   make check-complexity-gate-update      # regenerate .complexity-baseline
   make check-folder-size-update          # show offenders to whitelist
   make verify-theme-baseline-update      # re-record .theme-baseline.json
   make verify-rule-corpus-size-raise     # raise the corpus ceiling
   make verify-image-size-raise           # raise the image ceiling
   ```

3. **N'attendez pas d'un cliquet qu'il s'abaisse tout seul.** Certains
   cliquets encaissent automatiquement une réduction réelle (un compteur
   d'erreurs qui devrait être à zéro) ; un cliquet de *budget* garde une
   réduction comme marge et ne bouge que par un acte délibéré ; un cliquet
   à *oracle dérivant* (complexité, le CSS Tailwind construit) ne s'abaisse
   jamais automatiquement, car une baisse pourrait venir d'une dérive de
   l'outil plutôt que d'un vrai gain. Cette décision à trois voies est
   expliquée dans le contrat de test des portes, point 5. Si un cliquet a
   échoué parce qu'un nombre a *diminué*, c'est aussi un constat, pas un
   laissez-passer.

Ne baissez jamais un plafond pour faire passer au vert un rouge local. Le
nombre signifie la même chose partout, par conception ; le déplacer en
silence est exactement l'échec que le cliquet existe pour empêcher.

### Un exemple concret : le cliquet du corpus de règles

Supposons que vous ajoutiez une section à un fichier de règles sous
`.claude/rules/`. Chacun de ces fichiers est injecté dans chaque prompt,
donc le cliquet du corpus surveille leur taille totale. Lancez-le et il
bloque :

```
$ make verify-rule-corpus-size
rule corpus: 24 files, 292314 chars (~73078 tokens per prompt)
rule corpus is 58 chars over the ceiling (292314 > 292256).
  - condense or delete elsewhere in the corpus (see the condensation rule
  - raise the ceiling deliberately:
      make verify-rule-corpus-size-raise
    and say in the commit what the corpus bought for the space.
make: *** [Makefile:899: verify-rule-corpus-size] Error 1
```

La porte affiche les deux sorties légitimes, et seulement ces deux-là :
condenser ou supprimer autre chose pour que le total tienne à nouveau, ou
relever le plafond volontairement avec `make verify-rule-corpus-size-raise`
et le justifier dans le commit. Elle se termine avec un code non nul
(`Error 1`), donc elle fait échouer le build tant que vous n'avez pas fait
l'une des deux ; il n'existe pas de troisième voie où l'ajout passe
simplement. Chaque cliquet du tableau ci-dessus bloque de la même façon :
une ligne qui nomme ce qu'il a mesuré, la valeur actuelle face au plafond,
et sa propre cible de relèvement ou de mise à jour.

Une porte qui ne mord qu'après le push coûte un aller-retour. Lancez les
portes sans build dans l'ordre de la CI avec une seule commande :

```bash
make ci        # every build-free gate, in CI order (BASE=<ref> for diff gates)
make ci-full   # the above plus gates that need a built frontend
```

`make ci` exécute, dans l'ordre : dérive des docs, hygiène des docs,
références de docs, liens porte<->règle, inventaire des vérifications,
inventaire des leçons, changements normatifs, taille du corpus de règles,
cliquet de complexité, références testid, contexte docker, tailles de
fichiers et l'instantané OpenAPI. Deux portes ont besoin d'un frontend
installé et construit (elles construisent l'oracle des classes Tailwind),
elles se trouvent donc dans `make ci-full`, pas dans `make ci`. Les suites
de tests sont à part : `make test`.

## Les portes sont couplées aux règles, et les changements sont déclarés

Deux manifestes gardent l'application des règles honnête, et vous pouvez
déclencher l'un ou l'autre en modifiant un fichier de règles ou un workflow :

- [`.claude/rules/gates.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/gates.yaml)
  couple chaque porte qui applique une règle à la section de règle qu'elle
  applique. `make verify-gate-rule-links` échoue dans les deux sens : une
  porte sans règle, ou une règle qui cite un workflow qui n'existe plus.
  Chaque porte couplée porte aussi un `body_sha` de la section de règle,
  donc vider le corps d'une règle en gardant son titre est détecté.
- [`.claude/rules/checks.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/checks.yaml)
  inventorie chaque vérification. `make verify-check-inventory` prouve
  qu'une vérification `active` est réellement câblée et n'a pas dégénéré en
  opération vide. Désactiver une vérification n'est permis qu'en déclarant
  `status: disabled` avec une raison, et le diff le montre. C'est la
  désactivation silencieuse qui devient impossible.

Si votre PR ajoute ou retire une formulation contraignante dans un fichier
de règles, ou change le statut d'une porte, `make verify-normative-changes`
vous demandera de le **déclarer** : le label `rule-change-declared`, ou une
ligne `RULE-CHANGE DECLARED: <what and why>` dans le corps de la PR ou dans
un message de commit. La déclaration est franchissable exprès, jamais par
accident, et elle converge dans
[`docs/rule-change-log.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/rule-change-log.md)
de façon automatique. Le raisonnement complet : la série #2075 / #2077 /
#2079 / #2081 / #2087 dans
[`quality-checks.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).

Le corpus de règles a un plafond pour une raison concrète : chaque fichier
`.claude/rules/**/*.md` est injecté dans chaque prompt de chaque session
d'agent, donc une nouvelle section de règle est un échange, pas un ajout :
condensez ou retirez quelque chose d'abord, ou dites dans le commit ce que
le corpus a obtenu en échange de la place.

## La protection de branche s'applique aussi aux administrateurs

`develop` exige une branche à jour et des vérifications requises vertes
avant une fusion. Depuis le 2026-08-06, `enforce_admins` est **activé**
pour `develop`, donc les vérifications requises s'imposent aussi aux
administrateurs du dépôt ; les désactiver est un acte délibéré et visible,
jamais une partie d'une fusion de routine. Cela existe parce que des
fusions retour de publication et de correctif ont un jour atteint `develop`
sans contrôle et l'ont laissé rouge pour toutes les branches jusqu'à ce
qu'un humain s'en aperçoive ; l'historique se trouve dans
[`lessons/ci-gates.md` -> « Release/hotfix back-merges land
ratchet-tripping changes on develop ungated »](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md)
et
[`docs/development/release-ratchet-gap.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/development/release-ratchet-gap.md).

Effet pratique : personne ne fusionne en contournant une porte rouge. Si
votre PR est en retard sur `develop`, mettez-la à jour pour que la CI se
relance sur l'état combiné avant qu'elle puisse être fusionnée.

## Les obligations : issue, PR, plan de test, un seul sujet

Quatre obligations permanentes s'ajoutent aux portes. Ce sont des normes,
pas des vérifications CI, et elles s'appliquent qu'une tâche les ait
demandées ou non :

- **Issue d'abord** (`GITHUB-ISSUE-PFLICHT`) : chaque bogue ou changement
  nécessite une issue GitHub *avant* la correction, et le commit/la PR la
  cite avec un mot-clé de fermeture (`Closes #NN`).
- **Toujours une PR** (`PR-PFLICHT`) : toute modification de code poussée
  ouvre une pull request contre `develop`, qu'elle ait été demandée ou non.
  Une branche poussée sans PR est un travail inachevé.
- **Plan de test pour un changement visible** (`TESTPLAN-PFLICHT`) : un
  changement du comportement visible par l'utilisateur met à jour le plan
  de test manuel (allemand et anglais) dans la même PR. Les refactorisations
  pures, l'infrastructure et la documentation en sont exemptées.
- **Un seul sujet par PR** : chaque PR porte un seul changement cohérent.

La formulation contraignante se trouve dans
[`.claude/rules/ai-workflow/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules/ai-workflow)
(`github-issue-policy.md`, `pr-policy.md`, `testplan-policy.md`) et dans
[`vibe-coding.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/vibe-coding.md).

## Où cela s'inscrit

Cette page est le compagnon « pourquoi la porte est là » du
[parcours d'intégration](onboarding.md), qui décrit pas à pas le chemin du
clone à la PR fusionnée. Pour le processus de test lui-même
(Red-Green-Refactor et un exemple concret), voir [Tests](testing.md). Pour
les portes au moment de la publication, voir
[Processus de publication](release.md).
