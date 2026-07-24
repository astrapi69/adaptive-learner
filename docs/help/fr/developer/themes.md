# Système de thèmes

La phase 58 (v1.41.0) a remplacé l'ancien couple clair/sombre par
un système de six thèmes classiques sur une seule dimension
`data-theme`, plus un choix `auto` qui suit le système
d'exploitation. La phase 63 (v1.63.0) a ajouté six **préréglages
WCAG AA recommandés**, de sorte que le sélecteur propose au total
**12 thèmes**.

## Préréglages recommandés (phase 63 / v1.63.0)

Le sélecteur sous Paramètres → Apparence ouvre sur un sous-onglet
**Recommandé** :

- **Clair :** `catppuccin-latte`, `supabase`, `graphite`
- **Sombre :** `catppuccin-mocha`, `soft-pop`, `amethyst-haze`

Ils ont été générés à partir de préréglages tweakcn via
`scripts/generate_preset_themes.py` sous forme de thèmes complets à
44 jetons, avec **WCAG AA imposé par le calcul**
(`contrast.test.ts` sur tous les 12 thèmes). Les six classiques
(`light`, `dark`, `ocean`, `forest`, `high-contrast`, `sepia`)
restent inchangés.

## Fonctionnement

- **Les jetons de couleur canoniques** se trouvent dans
  `frontend/src/styles/themes/theme-<id>.css`, un bloc par valeur
  `data-theme` (`light`, `dark`, `ocean`, `forest`,
  `high-contrast`, `sepia`). Chaque fichier définit le jeu de
  jetons sémantiques **complet** - il n'y a pas de repli sur le
  clair.
- **Les jetons indépendants du thème** (espacements, rayon,
  polices, la palette de méthodes de marque) et les **alias
  hérités** (`--bg`, `--surface`, `--fg`, `--danger`, ...) se
  trouvent dans `styles/global.css :root`. Les alias se résolvent
  *à travers* les jetons canoniques et suivent ainsi
  automatiquement le thème actif.
- Les fichiers de thème sont importés dans `main.tsx`, **le clair
  en premier**, afin que le thème actif gagne l'égalité de
  spécificité face à `:root`.
- `frontend/src/lib/themes.ts` est le registre : `THEMES`, les
  types `ThemeId` / `ThemeChoice`, `resolveTheme(choice, prefersDark)`
  pour le mappage `auto` et les échantillons de couleur de l'aperçu.
- `frontend/src/hooks/useTheme.ts` possède l'attribut `data-theme`
  appliqué et enregistre le choix sous `adaptive-learner.theme`
  (migre une fois l'ancienne clé `adaptive-learner-theme`).
- `index.html` contient un petit script en ligne qui applique le
  thème enregistré **avant le premier rendu** (pas de
  scintillement). Il reflète la résolution du hook ; garde les deux
  synchronisés.
- Les graphiques (Recharts) ne peuvent pas lire les variables CSS
  dans les attributs SVG, c'est pourquoi `lib/chartTheme.ts` +
  `useChartTheme` lisent les valeurs de jetons calculées et les
  relisent lors d'un changement de `data-theme`.

## Jeu de jetons (défini par chaque thème)

Arrière-plans (`--bg-primary/secondary/surface/elevated/overlay`),
texte (`--fg-primary/secondary/muted/inverse`), bordures
(`--border-primary/subtle/accent`), interactif
(`--interactive-bg/hover/active/disabled`), accent
(`--accent`, `-hover`, `-fg`, `-subtle`, `-rgb`), paires de statut
(`--success/-bg`, `--error/-bg`, `--warning/-bg`, `--info/-bg`),
retour d'exercice (`--exercise-correct/-wrong/-selected/-matched`),
`--star`, séries de graphiques (`--chart-1..6`) et ombres
(`--shadow-card/-elevated/-md`).

`styles/themes/themes.test.ts` échoue si un jeton manque à un thème
ou s'il en a un supplémentaire ; `styles/contrast.test.ts` vérifie
WCAG 2.1 AA sur tous les 12 thèmes. La référence complète des
jetons se trouve dans
[Architecture des jetons de design](../architecture/design-tokens.md).

## Ajouter un nouveau thème

1. **Copie** un fichier existant, p. ex.
   `cp theme-dark.css theme-midnight.css`, et change le sélecteur en
   `[data-theme="midnight"]`. Conserve **chaque** jeton - ne change
   que les valeurs. Aucun style de composant ici.
2. **Enregistre**-le dans `lib/themes.ts` : ajoute à `THEMES` une
   entrée `ThemeMeta` (id, `label` anglais, `family` light|dark et
   un `swatch` pour l'aperçu des paramètres) et complète l'id dans
   l'union `ThemeId`.
3. **Importe**-le dans `main.tsx` après `theme-light.css` (l'ordre
   ne compte que par rapport au clair).
4. **Autorise-le dans la garde pré-rendu** : complète l'id dans le
   tableau `valid` dans le `<script>` en ligne de `index.html`.
5. **i18n** : ajoute `ui.themes.midnight` dans tous les huit
   catalogues sous `backend/config/i18n/*.yaml` et exécute
   `make sync-i18n`.
6. **Vérifie** : `bunx vitest run src/styles/themes src/styles/contrast`
   - les épingles de complétude et de contraste doivent rester
   vertes (ajuste les valeurs jusqu'à ce que le contraste satisfasse
   AA dans le nouveau thème).

C'est tout - le ThemePicker, le script pré-rendu, les graphiques et
chaque composant reprennent automatiquement le nouveau thème, car
ils lisent tous les jetons canoniques.

## Règles

- **Aucune couleur codée en dur** dans les composants.
  `styles/no-hardcoded-colors.test.ts` l'impose pour les styles
  `.tsx` (une allowlist documentée couvre les résolveurs de
  graphiques, les confettis décoratifs et les couleurs de données).
- **Chaque thème définit chaque jeton.** Pas de lacunes avec
  héritage du clair - c'était l'erreur de l'audit F1 (jetons non
  définis qui affichaient un hex clair en mode sombre).
- **Le changement de thème est immédiat** - un échange de
  `data-theme`, jamais un rechargement.
