# Navigation

La navigation principale de l'application se compose d'un petit
nombre d'**entrées groupées** (EXP-037, d'après la recommandation
« 5 à 7 éléments » de Nielsen-Norman) **sans perte de
fonctionnalité** : chaque page reste accessible, et les anciens liens
continuent de fonctionner grâce à des redirections.

<!-- TODO: Screenshot - la navigation principale groupée et la barre d'onglets mobile en bas -->

---

## Ordinateur : entrées groupées

La navigation sur ordinateur est organisée en groupes étiquetés via
un composant réutilisable `NavGroup` :

- **Apprendre** - Tableau de bord, Parcours d'apprentissage et
  Session.
- **Contenu** - le **hub de contenu** (`/content`) avec quatre
  onglets : *Découvrir* (le catalogue), *Mon contenu* (ce que tu as
  téléchargé), *Importer* et *Créer* (une nouvelle leçon à toi). Le
  hub s'ouvre sur le premier onglet de ton ordre ; par défaut, c'est
  Découvrir. Tu peux modifier l'ordre sous *Paramètres > Général >
  Apparence*.
- **Progrès** - le **ProgressHub** (`/progress`), avec Aperçu,
  Statistiques et Mes parcours comme onglets.
- **Paramètres** et **Aide** complètent la barre.

Anki n'est pas une entrée à part entière ; c'est une action de la page
Contenu, et sa route `/anki` continue de fonctionner.

### Une seule navigation principale par viewport

Sur les largeurs d'ordinateur, la barre horizontale du haut est la
**seule** navigation principale : il n'y a ni bouton hamburger ni
tiroir. Sur les largeurs étroites / mobiles, les mêmes entrées
groupées passent derrière un **tiroir hamburger**. Les deux
présentations sont rendues à partir d'une seule liste partagée de
destinations, elles mènent donc toujours aux mêmes pages. L'élément
actif porte `aria-current`, chaque cible mesure au moins 44px, et cela
fonctionne avec tous les thèmes. (La page Paramètres a sa propre barre
latérale de sections pour ses propres onglets ; celle-ci n'a aucun
rapport avec la navigation principale.)

---

## Mobile : barre d'onglets en bas (facultatif)

Sur un téléphone, la navigation se trouve par défaut en haut, sous
forme de bouton de menu. Sous *Paramètres > Général > Interface*,
**Position du menu (mobile)** la bascule sur **En bas (barre
d'onglets)** : une barre de cinq onglets à portée du pouce,
**Apprendre / Contenu / Parcours d'apprentissage / Progrès / Plus**.
*Plus* ouvre un panneau inférieur avec Paramètres et Aide. Le tiroir
hamburger reste disponible dans les deux positions. Les cibles
mesurent 44px, la barre respecte tous les thèmes, et elle se masque
pendant le parcours d'intégration et pendant une leçon, pour que rien
ne recouvre le contenu.

---

## Hubs et redirections

Deux pages sont des **hubs à onglets**, qui ne montent que l'onglet
actif :

- **ProgressHub** (`/progress`) intègre Progrès + Statistiques
  d'apprentissage + Programme.
- **Hub de contenu** (`/content`) intègre Découvrir + Mon contenu +
  Importer + Créer.

Les anciennes URL sont conservées par des redirections, p. ex.
`/statistics` → `/progress?tab=stats`, `/curriculum` →
`/progress?tab=paths`, `/discover` → `/content?tab=discover`,
`/import` → `/content?tab=import`.

---

## Pages associées

- [Progression](progress.md) - les onglets du ProgressHub
- [Navigateur de contenu](../features/content-browser.md) - Mon contenu
- [Découvrir du contenu](../features/discover.md) - le catalogue
