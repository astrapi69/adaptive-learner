# Theme-System

Phase 58 (v1.41.0) ersetzte das alte Hell/Dunkel-Paar durch ein
System aus sechs Themes auf einer einzigen `data-theme`-Dimension,
plus eine `auto`-Auswahl, die dem Betriebssystem folgt.

## Funktionsweise

- **Kanonische Farb-Tokens** liegen in
  `frontend/src/styles/themes/theme-<id>.css`, ein Block pro
  `data-theme`-Wert (`light`, `dark`, `ocean`, `forest`,
  `high-contrast`, `sepia`). Jede Datei definiert das **vollständige**
  semantische Token-Set - es gibt kein Durchfallen auf Hell.
- **Theme-unabhängige Tokens** (Abstände, Radius, Schriften, die
  Marken-Methodenpalette) und die **Legacy-Aliase** (`--bg`,
  `--surface`, `--fg`, `--danger`, ...) liegen in
  `styles/global.css :root`. Die Aliase lösen *über* die kanonischen
  Tokens auf und folgen so automatisch dem aktiven Theme.
- Die Theme-Dateien werden in `main.tsx` importiert, **Hell zuerst**,
  damit das aktive Theme den Gleichstand der Spezifität gegen `:root`
  gewinnt.
- `frontend/src/lib/themes.ts` ist das Register: `THEMES`, die Typen
  `ThemeId` / `ThemeChoice`, `resolveTheme(choice, prefersDark)` für
  das `auto`-Mapping und die Vorschau-Farbproben.
- `frontend/src/hooks/useTheme.ts` besitzt das angewandte
  `data-theme`-Attribut und speichert die Wahl unter
  `adaptive-learner.theme` (migriert den alten
  `adaptive-learner-theme`-Schlüssel einmalig).
- `index.html` enthält ein kleines Inline-Skript, das das gespeicherte
  Theme **vor dem ersten Paint** anwendet (kein Flackern). Es spiegelt
  die Auflösung des Hooks; halte beide synchron.
- Diagramme (Recharts) können CSS-Variablen nicht in SVG-Attributen
  lesen, daher lesen `lib/chartTheme.ts` + `useChartTheme` die
  berechneten Token-Werte und lesen bei `data-theme`-Wechsel neu.

## Token-Set (von jedem Theme definiert)

Hintergründe (`--bg-primary/secondary/surface/elevated/overlay`),
Text (`--fg-primary/secondary/muted/inverse`), Ränder
(`--border-primary/subtle/accent`), interaktiv
(`--interactive-bg/hover/active/disabled`), Akzent
(`--accent`, `-hover`, `-fg`, `-subtle`, `-rgb`), Status-Paare
(`--success/-bg`, `--error/-bg`, `--warning/-bg`, `--info/-bg`),
Übungs-Feedback (`--exercise-correct/-wrong/-selected/-matched`),
`--star`, Diagrammreihen (`--chart-1..6`) und Schatten
(`--shadow-card/-elevated/-md`).

`styles/themes/themes.test.ts` schlägt fehl, wenn einem Theme eines
dieser Tokens fehlt oder es ein zusätzliches hat;
`styles/contrast.test.ts` prüft WCAG 2.1 AA über alle sechs Themes.

## Ein neues Theme hinzufügen

1. **Kopiere** eine bestehende Datei, z. B.
   `cp theme-dark.css theme-midnight.css`, und ändere den Selektor auf
   `[data-theme="midnight"]`. Behalte **jedes** Token - ändere nur die
   Werte. Keine Komponenten-Styles hier.
2. **Registriere** es in `lib/themes.ts`: füge `THEMES` einen
   `ThemeMeta`-Eintrag hinzu (id, englisches `label`, `family`
   light|dark und ein `swatch` für die Settings-Vorschau) und ergänze
   die id in der `ThemeId`-Union.
3. **Importiere** es in `main.tsx` nach `theme-light.css` (die
   Reihenfolge zählt nur relativ zu Hell).
4. **Erlaube es im Pre-Paint-Guard**: ergänze die id im `valid`-Array
   im Inline-`<script>` in `index.html`.
5. **i18n**: füge `ui.themes.midnight` in allen acht Katalogen unter
   `backend/config/i18n/*.yaml` hinzu und führe `make sync-i18n` aus.
6. **Prüfe**: `npx vitest run src/styles/themes src/styles/contrast` -
   die Vollständigkeits- und Kontrast-Pins müssen grün bleiben (passe
   die Werte an, bis der Kontrast im neuen Theme AA erfüllt).

Das war's - der ThemePicker, das Pre-Paint-Skript, die Diagramme und
jede Komponente übernehmen das neue Theme automatisch, weil sie alle
die kanonischen Tokens lesen.

## Regeln

- **Keine fest codierten Farben** in Komponenten.
  `styles/no-hardcoded-colors.test.ts` erzwingt das für `.tsx`-Styles
  (eine dokumentierte Allowlist deckt Diagramm-Resolver, dekoratives
  Konfetti und Daten-Farben ab).
- **Jedes Theme definiert jedes Token.** Keine Lücken mit Vererbung
  von Hell - das war der F1-Audit-Fehler (undefinierte Tokens, die im
  Dunkelmodus helles Hex zeigten).
- **Theme-Wechsel ist sofortig** - ein `data-theme`-Tausch, niemals
  ein Neuladen.
