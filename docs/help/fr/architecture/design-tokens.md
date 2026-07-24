# Architecture des jetons de design

Toutes les propriétés visuelles de l'application sont pilotées par
des **jetons de design** (variables CSS). Qui veut recolorer
l'application ou construire un nouveau thème modifie un seul
fichier `theme-*.css` et ne touche à aucun composant. Cette règle
est imposée par des tests, pas seulement par convention. La
référence complète des jetons se trouve dans
[`docs/policies/DESIGN-TOKENS.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/DESIGN-TOKENS.md).

---

## Les couches de jetons

1. **Jetons par thème** - le jeu canonique de 44 jetons, défini
   une fois par thème dans
   `frontend/src/styles/themes/theme-<id>.css` (arrière-plans,
   texte, bordures, interactif, accent, statut, retour
   d'exercice, étoile, graphiques, ombres). Un changement de
   `[data-theme]` bascule tous. **Chaque thème doit définir
   exactement le même jeu** (épinglé par `themes.test.ts`).
2. **Jetons indépendants du thème** - des valeurs qui, par
   construction, sont identiques dans chaque thème (p. ex. palette
   de marque, couleurs de syntaxe, espacements de mise en page).
   Ils vivent dans `global.css :root`.
3. **Alias hérités** - d'anciens noms comme `--surface`,
   `--danger`, qui se résolvent **à travers** les jetons
   canoniques.

---

## Les règles (en bref)

- **Aucun littéral de couleur brut** (`#hex`, `rgb()`, `hsl()`)
  dans une déclaration consommatrice. Un littéral n'est autorisé
  qu'en tant que valeur d'une définition `--token:`. Dans les
  composants et les règles CSS, tu référence des jetons :
  `color: var(--fg-primary)`.
- **Aucune utilitaire Tailwind à palette fixe** (`bg-blue-500`).
  Utilise des utilitaires basées sur des jetons (`bg-accent` →
  `var(--accent)`) ou une valeur arbitraire au-dessus d'un jeton.
- **Aucun style en ligne avec des valeurs de couleur.**
- **Les ombres, rayons et espacements sont eux aussi des jetons**
  (`--shadow-elevated`, `--radius-md`, `--space-4`).

---

## Construire ou adapter un thème

1. Copie un `theme-<id>.css` existant comme modèle.
2. Définis les 44 jetons canoniques (la parité est obligatoire).
3. Veille au **contraste WCAG AA** - `contrast.test.ts` vérifie
   tous les thèmes par le calcul.
4. Enregistre le thème ; le sélecteur sous Paramètres → Apparence
   le reprend.

Si une nouvelle fonctionnalité a besoin d'une nouvelle couleur :
**ajoute un jeton**, pas un littéral. S'il varie selon le thème,
ajoute-le dans tous les `theme-*.css` ; s'il est identique
partout, dans `global.css :root`.

---

## Application

Trois gardes s'exécutent dans `make test`
(`no-hardcoded-colors.test.ts`) : littéraux de couleur dans
`.tsx` (via une allowlist qui ne fait que rétrécir), littéraux de
couleur dans le CSS hors thème et utilitaires Tailwind à palette
fixe (doivent être nuls). À cela s'ajoutent `themes.test.ts`
(parité des jetons) et `contrast.test.ts` (AA sur tous les
thèmes).

---

## Pages connexes

- [Système de thèmes](../developer/themes.md) - les thèmes livrés + le sélecteur
- [`docs/policies/DESIGN-TOKENS.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/DESIGN-TOKENS.md) - liste complète des jetons
