# Système de thèmes

La Phase 58 (v1.41.0) a remplacé l'ancienne paire clair/sombre par un
système à six thèmes sur une seule dimension `data-theme`, plus un choix
`auto` qui suit le système d'exploitation.

## Fonctionnement

- **Les tokens de couleurs canoniques** se trouvent dans
  `frontend/src/styles/themes/theme-<id>.css`, un bloc par valeur de
  `data-theme` (`light`, `dark`, `ocean`, `forest`, `high-contrast`,
  `sepia`). Chaque fichier définit le jeu **complet** de tokens sémantiques —
  il n'y a pas de repli vers le thème clair.
- **Les tokens agnostiques aux thèmes** (espacement, rayon, polices, la
  palette de marque) et les **alias legacy** (`--bg`, `--surface`, `--fg`,
  `--danger`, ...) se trouvent dans `:root` de `styles/global.css`. Les
  alias se résolvent *à travers* les tokens canoniques, donc les anciennes
  règles suivent automatiquement le thème actif.
- Les fichiers de thèmes sont importés depuis `main.tsx`, **clair en
  premier**, pour que le thème actif gagne la résolution à spécificité égale
  face à `:root`.
- `frontend/src/lib/themes.ts` est le registre : `THEMES`, les types
  `ThemeId` / `ThemeChoice`, `resolveTheme(choice, prefersDark)` pour le
  mappage `auto`, et les palettes de la carte de prévisualisation.
- `frontend/src/hooks/useTheme.ts` gère l'attribut `data-theme` appliqué et
  persiste le choix sous `adaptive-learner.theme` (avec migration de l'ancienne
  clé `adaptive-learner-theme` pré-58E).
- `index.html` contient un petit script inline qui applique le thème
  sauvegardé **avant le premier rendu** (sans flash). Il reflète la résolution
  du hook ; gardez les deux synchronisés.
- Les graphiques (Recharts) ne peuvent pas lire les variables CSS dans les
  attributs SVG, donc `lib/chartTheme.ts` + `useChartTheme` lisent les
  valeurs de tokens calculées et se mettent à jour lors d'un changement
  `data-theme`.

## Jeu de tokens (défini par chaque thème)

Arrière-plans (`--bg-primary/secondary/surface/elevated/overlay`),
texte (`--fg-primary/secondary/muted/inverse`), bordures
(`--border-primary/subtle/accent`), interactif
(`--interactive-bg/hover/active/disabled`), accent
(`--accent`, `-hover`, `-fg`, `-subtle`, `-rgb`), paires de statut
(`--success/-bg`, `--error/-bg`, `--warning/-bg`, `--info/-bg`),
feedback d'exercice (`--exercise-correct/-wrong/-selected/-matched`),
`--star`, séries de graphiques (`--chart-1..6`), et ombres
(`--shadow-card/-elevated/-md`).

`styles/themes/themes.test.ts` échoue si un thème manque un de ces tokens
ou en ajoute un extra ; `styles/contrast.test.ts` vérifie WCAG 2.1 AA
sur les six thèmes.

## Comment ajouter un nouveau thème

1. **Copiez** un fichier existant, par exemple
   `cp theme-dark.css theme-midnight.css`, et changez le sélecteur en
   `[data-theme="midnight"]`. Conservez **tous** les tokens — changez
   uniquement les valeurs. N'ajoutez pas de styles de composants ici.
2. **Enregistrez-le** dans `lib/themes.ts` : ajoutez une entrée `ThemeMeta`
   à `THEMES` (id, `label` anglais, famille `light|dark`, et un `swatch`
   pour l'aperçu dans les Paramètres) et ajoutez l'id à l'union `ThemeId`.
3. **Importez-le** dans `main.tsx` après `theme-light.css` (l'ordre n'a
   d'importance que par rapport à light).
4. **Autorisez-le dans le garde pré-rendu** : ajoutez l'id au tableau
   `valid` dans le script `<script>` inline d'`index.html`.
5. **i18n** : ajoutez `ui.themes.midnight` dans les huit catalogues sous
   `backend/config/i18n/*.yaml`, puis exécutez `make sync-i18n`.
6. **Vérifiez** : `npx vitest run src/styles/themes src/styles/contrast`
   — les pins de complétude + contraste doivent rester verts (ajustez les
   valeurs jusqu'à ce que le contraste passe AA dans votre nouveau thème).

C'est tout — le ThemePicker, le script pré-rendu, les graphiques et chaque
composant adoptent automatiquement le nouveau thème car ils lisent tous
les tokens canoniques.

## Règles

- **Pas de couleurs codées en dur** dans les composants. `styles/no-hardcoded-colors.test.ts`
  l'applique pour les styles `.tsx` (une liste blanche documentée couvre les
  résolveurs de graphiques, les confettis décoratifs et les couleurs de données).
- **Chaque thème définit chaque token.** Pas de lacunes héritées du clair —
  c'était le bug de l'audit F1 (tokens non définis rendus en hex clair en
  mode sombre).
- **Le changement de thème est instantané** — un échange `data-theme`, jamais
  un rechargement.
