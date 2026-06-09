# Arquitectura de tokens de diseño

Todas las propiedades visuales de la app se controlan mediante
**tokens de diseño** (variables CSS). Quien quiera recolorear la
app o construir un tema nuevo edita un único archivo
`theme-*.css` y no toca ningún componente. Esta regla la imponen
los tests, no es solo una convención. La referencia completa de
tokens está en
[`docs/DESIGN-TOKENS.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/DESIGN-TOKENS.md).

---

## Las capas de tokens

1. **Tokens por tema** — el conjunto canónico de 44 tokens,
   definido una vez por tema en
   `frontend/src/styles/themes/theme-<id>.css` (fondos, texto,
   bordes, interactivo, acento, estado, feedback de ejercicios,
   estrella, gráficos, sombras). Cambiar `[data-theme]` invierte
   todos ellos. **Cada tema debe definir exactamente el mismo
   conjunto** (fijado por `themes.test.ts`).
2. **Tokens agnósticos al tema** — valores que, por construcción,
   son iguales en cada tema (p. ej. la paleta de marca, los
   colores de sintaxis, los espaciados de layout). Residen en
   `global.css :root`.
3. **Alias heredados** — nombres antiguos como `--surface`,
   `--danger`, que resuelven **a través de** los tokens canónicos.

---

## Las reglas (en breve)

- **Sin literales de color en bruto** (`#hex`, `rgb()`, `hsl()`)
  en una declaración consumidora. Un literal solo se permite como
  valor de una definición `--token:`. En componentes y reglas CSS
  referencias tokens: `color: var(--fg-primary)`.
- **Sin utilidades de Tailwind con paleta fija** (`bg-blue-500`).
  Usa utilidades respaldadas por tokens (`bg-accent` →
  `var(--accent)`) o un valor arbitrario sobre un token.
- **Sin estilos en línea con valores de color.**
- **Las sombras, los radios y los espaciados también son tokens**
  (`--shadow-elevated`, `--radius-md`, `--space-4`).

---

## Construir o adaptar un tema

1. Copia un `theme-<id>.css` existente como plantilla.
2. Define los 44 tokens canónicos (la paridad es obligatoria).
3. Cuida el **contraste WCAG AA** — `contrast.test.ts` comprueba
   todos los temas de forma computacional.
4. Registra el tema; el selector en Ajustes → Apariencia lo
   adopta.

Si una nueva función necesita un color nuevo: **añade un token**,
no un literal. Si varía según el tema, agrégalo en todos los
`theme-*.css`; si es igual en todas partes, en `global.css :root`.

---

## Aplicación

Tres guards se ejecutan en `make test`
(`no-hardcoded-colors.test.ts`): literales de color en `.tsx`
(mediante una lista de permitidos que solo puede encogerse),
literales de color en CSS que no es de tema, y utilidades de
Tailwind con paleta fija (deben ser cero). Además,
`themes.test.ts` (paridad de tokens) y `contrast.test.ts` (AA en
todos los temas).

---

## Páginas relacionadas

- [Sistema de temas](../developer/themes.md) — los temas incluidos + el selector
- [`docs/DESIGN-TOKENS.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/DESIGN-TOKENS.md) — lista completa de tokens
