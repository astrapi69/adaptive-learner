# Navigateur de contenu

Le **navigateur de contenu** sous `/content` est ton point
d'entrée central pour trouver, télécharger et démarrer des
ensembles de leçons. Il est construit autour du flux
d'apprentissage : d'abord la recherche, ensuite la reprise, puis
le catalogue.

<!-- TODO: Screenshot — Navigateur de contenu avec champ de recherche, zone Continuer l'apprentissage et arborescence des ensembles -->

---

## Recherche

Tout en haut se trouve un **champ de recherche sur toute la
largeur**. Il filtre instantanément (avec anti-rebond, sur le
catalogue mis en cache localement) les titres d'ensembles, les
descriptions, le domaine, les titres de leçons, les recto et
verso des cartes ainsi que les tags. La recherche est
**tolérante** à la casse et aux accents et connaît les digrammes
allemands (ae/oe/ue/ss). Les résultats remplacent l'arborescence
du catalogue, avec mise en évidence, nombre de résultats et état
vide. `Cmd/Ctrl + K` place le curseur directement dans le champ
de recherche.

---

## Continuer l'apprentissage

Juste sous la recherche, **Continuer l'apprentissage** affiche la
dernière leçon abordée par ensemble, chacune avec exactement une
action : **reprendre** (leçon en cours/en pause, étape n sur
total), **suivante** (la leçon suivante avec ses étoiles après un
achèvement), ou **ensemble terminé**.

---

## Langues et savoir

Le catalogue se divise en deux arborescences :

- **Langues** — sous forme d'arbre *langue source → langue cible →
  niveau*, filtré selon la langue de ton application (tu peux
  activer des langues sources supplémentaires dans Paramètres →
  Apprentissage).
- **Savoir** — domaines non linguistiques (p. ex. programmation,
  psychologie) avec leurs propres icônes.

---

## Badges de source et filtre de source

Chaque ensemble téléchargé porte un **badge de source** qui
indique sa provenance :

- **Officiel** / **Intégré** — issu du catalogue officiel ou
  intégré à l'application.
- **Mon dépôt** — issu d'un dépôt que tu as connecté.
- **Officiellement recommandé** — issu de la liste de
  recommandations curatée.

Un **filtre de source** n'affiche au besoin que les ensembles
d'une source donnée. Pour en savoir plus :
[Plusieurs dépôts de contenu](content-repos.md).

---

## Recommandations de livres

Si le catalogue gère des livres recommandés pour un domaine
(`books.yaml`), le navigateur de contenu les affiche comme
**lectures complémentaires** pour le domaine concerné. Cela
fonctionne dans les deux modes de stockage et ne nécessite aucun
backend. Format et maintenance :
[Recommandations de livres](../content-creation/books.md).

---

## Filtre par sujet

Si tu as associé des sujets (domaines) à tes projets
d'apprentissage, le **tableau de bord** affiche un filtre par
sujet qui ne liste **que tes propres** sujets (masqué s'il n'y en
a aucun), trié par **usage le plus fréquent** et regroupé par
catégorie au-delà de cinq entrées.

---

## Mes leçons

Les leçons que tu as créées toi-même ou importées apparaissent
dans la section **Mes leçons** avec des actions pour lire,
modifier, supprimer, exporter et partager. Pour savoir comment
construire tes propres leçons, voir
[Créer des leçons](../content-creation/overview.md).

---

## Pages connexes

- [Leçons et révisions](../user-guide/lessons.md) — le déroulement d'une leçon
- [Plusieurs dépôts de contenu](content-repos.md) — connecter et gérer des sources
- [Mes leçons](../user-guide/my-lessons.md)
