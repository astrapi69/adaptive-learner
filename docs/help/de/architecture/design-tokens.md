# Design-Token-Architektur

Alle visuellen Eigenschaften der App werden über **Design-Tokens**
(CSS-Variablen) gesteuert. Wer die App umfärben oder ein neues
Theme bauen will, bearbeitet eine einzige `theme-*.css`-Datei und
fasst keine Komponente an. Diese Regel ist durch Tests erzwungen,
nicht nur Konvention. Die vollständige Token-Referenz steht in
[`docs/policies/DESIGN-TOKENS.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/DESIGN-TOKENS.md).

---

## Die Token-Schichten

1. **Pro-Theme-Tokens** — der kanonische Satz von 44 Tokens, je
   einmal pro Theme in `frontend/src/styles/themes/theme-<id>.css`
   definiert (Hintergründe, Text, Ränder, Interaktiv, Akzent,
   Status, Übungs-Feedback, Stern, Charts, Schatten). Ein Wechsel
   von `[data-theme]` kippt alle. **Jedes Theme muss exakt
   denselben Satz definieren** (durch `themes.test.ts` gepinnt).
2. **Theme-agnostische Tokens** — Werte, die konstruktionsbedingt
   in jedem Theme gleich sind (z. B. Marken-Palette, Syntax-Farben,
   Layout-Abstände). Sie leben in `global.css :root`.
3. **Legacy-Aliase** — alte Namen wie `--surface`, `--danger`, die
   **durch** die kanonischen Tokens auflösen.

---

## Die Regeln (kurz)

- **Keine rohen Farbliterale** (`#hex`, `rgb()`, `hsl()`) in einer
  konsumierenden Deklaration. Ein Literal ist nur als Wert einer
  `--token:`-Definition erlaubt. In Komponenten und CSS-Regeln
  referenzierst du Tokens: `color: var(--fg-primary)`.
- **Keine Tailwind-Utilities mit fester Palette** (`bg-blue-500`).
  Nutze token-gestützte Utilities (`bg-accent` → `var(--accent)`)
  oder einen Arbitrary-Value über einem Token.
- **Keine Inline-Styles mit Farbwerten.**
- **Schatten, Radien, Abstände sind ebenfalls Tokens**
  (`--shadow-elevated`, `--radius-md`, `--space-4`).

---

## Ein Theme bauen oder anpassen

1. Kopiere ein bestehendes `theme-<id>.css` als Vorlage.
2. Setze alle 44 kanonischen Tokens (die Parität ist Pflicht).
3. Achte auf **WCAG-AA-Kontrast** — `contrast.test.ts` prüft alle
   Themes rechnerisch.
4. Registriere das Theme; der Picker unter Einstellungen →
   Darstellung übernimmt es.

Braucht ein neues Feature eine neue Farbe: **füge ein Token
hinzu**, kein Literal. Variiert es pro Theme, ergänze es in allen
`theme-*.css`; ist es überall gleich, in `global.css :root`.

---

## Durchsetzung

Drei Guards laufen in `make test`
(`no-hardcoded-colors.test.ts`): Farbliterale in `.tsx` (über eine
nur schrumpfende Allowlist), Farbliterale in Nicht-Theme-CSS und
Tailwind-Utilities mit fester Palette (müssen null sein). Dazu
`themes.test.ts` (Token-Parität) und `contrast.test.ts` (AA über
alle Themes).

---

## Verwandte Seiten

- [Theme-System](../developer/themes.md) — die ausgelieferten Themes + Picker
- [`docs/policies/DESIGN-TOKENS.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/DESIGN-TOKENS.md) — vollständige Token-Liste
