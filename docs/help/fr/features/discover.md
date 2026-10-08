# Découvrir du contenu

**Découvrir** est l'endroit où tu trouves de nouveaux ensembles de
leçons dans toute la bibliothèque et où tu les télécharges. Il se
présente comme l'**onglet Découvrir du hub de contenu** (`/content`) ;
l'ancien lien `/discover` fonctionne toujours et y redirige.

La séparation est voulue : **Mon contenu** n'affiche que ce que tu as
déjà téléchargé, tandis que **Découvrir** est le catalogue que tu
parcours et dans lequel tu puises. Ainsi, ta surface d'apprentissage
quotidienne reste libre des ensembles que tu n'as pas encore choisis.
**Découvrir est l'onglet par défaut** du hub de contenu, de sorte
qu'à la première visite, on est guidé vers la recherche de contenu
plutôt que vers une page « Mon contenu » vide.

<!-- TODO: Screenshot - l'onglet Découvrir avec la barre de recherche/filtres, le sélecteur de vue et les boutons de téléchargement par ensemble -->

---

## Recherche et filtres

Découvrir s'appuie sur un **index de recherche** couvrant le
catalogue. Une **barre de bascule compacte Rechercher/Filtrer** se
trouve en haut : appuie sur **Rechercher** pour saisir une requête, ou
sur **Filtrer** pour affiner le catalogue avec des **filtres
combinables** - **langue**, **niveau**, **domaine**, niveau de
**confiance** et **vérifié par IA**. Recherche et filtres fonctionnent
ensemble, et la barre reste compacte (elle ne déploie que la partie
que tu utilises) afin de ne pas encombrer les résultats sur les petits
écrans.

La saisie filtre instantanément les titres d'ensembles, les
descriptions, les domaines, les titres de leçons, les recto et verso
des cartes ainsi que les tags. La recherche est tolérante à la casse
et aux accents et connaît les digrammes allemands (ae/oe/ue/ss).
L'index est construit à la demande lors de la première interaction -
aucun appel au backend, il fonctionne dans les deux modes de stockage.

---

## Vue en liste et en grille

Découvrir respecte la même **préférence globale d'affichage du
contenu** que *Mon contenu* : un **sélecteur de vue** fait basculer le
catalogue entre une **liste** compacte (par défaut) et une **grille**
de cartes plus riche. La modifier ici la modifie aussi dans *Mon
contenu*, et le choix est mémorisé. Tu peux aussi la régler depuis
**Paramètres > Général > Apparence**.

---

## Télécharger un ensemble

Chaque résultat porte une action **Télécharger**. Le téléchargement
copie l'ensemble dans ton cache local (IndexedDB en mode purement
navigateur, le cache du système de fichiers en mode serveur), après
quoi il apparaît sous **Mon contenu** et peut être joué hors ligne.

Chaque ensemble affiche un **badge de source** - Officiel / Inclus,
ton propre dépôt connecté, ou Officiellement recommandé. Le filtre
**confiance** (voir ci-dessus) restreint le catalogue à une seule
source ou à un seul niveau de confiance. Voir
[Plusieurs dépôts de contenu](content-repos.md) pour connecter et
gérer tes propres sources.

---

## Onglet Importer

Le hub de contenu propose aussi un onglet **Importer** pour faire
entrer un export de chat ou un fichier de leçon unique. Les **boutons
d'action** d'import et de création ainsi que **Mes leçons** (les
leçons que tu as créées ou importées) se trouvent désormais aussi ici.
Les anciens liens `/import` y redirigent.

---

## Pages connexes

- [Navigateur de contenu](content-browser.md) - ton « Mon contenu » téléchargé
- [Plusieurs dépôts de contenu](content-repos.md) - sources et niveaux de confiance
- [Leçons et révisions](../user-guide/lessons.md) - le déroulement d'une leçon
