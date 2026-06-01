# Sistema de temas

La Fase 58 (v1.41.0) reemplazó el antiguo par claro/oscuro con
un sistema de seis temas en una única dimensión `data-theme`, más
una opción `auto` que sigue el sistema operativo.

## Cómo funciona

- Los **tokens de color canónicos** viven en
  `frontend/src/styles/themes/theme-<id>.css`, un bloque por
  valor `data-theme` (`light`, `dark`, `ocean`, `forest`,
  `high-contrast`, `sepia`). Cada archivo define el conjunto
  **completo** de tokens semánticos — no hay herencia desde el
  tema claro.
- Los **tokens independientes del tema** (espaciado, radio,
  fuentes, la paleta de métodos de marca) y los **alias
  heredados** (`--bg`, `--surface`, `--fg`, `--danger`, ...)
  viven en `:root` de `styles/global.css`. Los alias se resuelven
  *a través de* los tokens canónicos, por lo que las reglas más
  antiguas siguen el tema activo automáticamente.
- Los archivos de tema se importan desde `main.tsx`, **primero
  el claro**, de forma que el tema activo gana el empate de
  especificidad igual frente a `:root`.
- `frontend/src/lib/themes.ts` es el registro: `THEMES`, los
  tipos `ThemeId` / `ThemeChoice`, `resolveTheme(choice, prefersDark)`
  para el mapeo `auto` y los swatches de la tarjeta de vista
  previa.
- `frontend/src/hooks/useTheme.ts` gestiona el atributo
  `data-theme` aplicado y persiste la elección bajo
  `adaptive-learner.theme` (migra la clave
  `adaptive-learner-theme` anterior a 58E una vez).
- `index.html` lleva un pequeño script en línea que aplica el
  tema guardado **antes del primer pintado** (sin parpadeo).
  Refleja la resolución del hook; mantén los dos sincronizados.
- Los gráficos (Recharts) no pueden leer variables CSS en atributos
  SVG, por lo que `lib/chartTheme.ts` + `useChartTheme` leen los
  valores de tokens calculados y los vuelven a leer al cambiar
  `data-theme`.

## Conjunto de tokens (definido por cada tema)

Fondos (`--bg-primary/secondary/surface/elevated/overlay`),
texto (`--fg-primary/secondary/muted/inverse`), bordes
(`--border-primary/subtle/accent`), interactivo
(`--interactive-bg/hover/active/disabled`), acento
(`--accent`, `-hover`, `-fg`, `-subtle`, `-rgb`), pares de estado
(`--success/-bg`, `--error/-bg`, `--warning/-bg`, `--info/-bg`),
retroalimentación de ejercicios
(`--exercise-correct/-wrong/-selected/-matched`), `--star`,
series de gráficos (`--chart-1..6`) y sombras
(`--shadow-card/-elevated/-md`).

`styles/themes/themes.test.ts` falla si algún tema carece de uno
de estos o añade uno extra; `styles/contrast.test.ts` verifica el
cumplimiento WCAG 2.1 AA en los seis temas.

## Cómo añadir un nuevo tema

1. **Copia** un archivo existente, p. ej.
   `cp theme-dark.css theme-midnight.css`, y cambia el selector a
   `[data-theme="midnight"]`. Mantén **todos** los tokens —
   cambia solo los valores. No añadas estilos de componentes aquí.
2. **Regístralo** en `lib/themes.ts`: añade una entrada
   `ThemeMeta` a `THEMES` (id, `label` en inglés, `family`
   light|dark y un `swatch` para la vista previa en Ajustes) y
   añade el id a la unión `ThemeId`.
3. **Impórtalo** en `main.tsx` después de `theme-light.css`
   (el orden solo importa en relación con el claro).
4. **Permítelo en el guard pre-pintado**: añade el id al array
   `valid` en el `<script>` en línea de `index.html`.
5. **i18n**: añade `ui.themes.midnight` a los ocho catálogos en
   `backend/config/i18n/*.yaml`, luego ejecuta `make sync-i18n`.
6. **Verifica**: `npx vitest run src/styles/themes src/styles/contrast`
   — las pruebas de completitud y contraste deben seguir en verde
   (ajusta los valores hasta que el contraste supere AA en tu
   nuevo tema).

Eso es todo — el ThemePicker, el script pre-pintado, los gráficos
y cada componente recogen el nuevo tema automáticamente porque
todos leen los tokens canónicos.

## Reglas

- **Sin colores codificados** en los componentes.
  `styles/no-hardcoded-colors.test.ts` lo aplica para los estilos
  `.tsx` (una lista de excepciones documentada cubre los
  resolutores de gráficos, el confeti decorativo y los colores
  de datos).
- **Cada tema define cada token.** Sin espacios de herencia desde
  el claro — ese fue el bug de la auditoría F1 (tokens no
  definidos que renderizan el hex claro en modo oscuro).
- **El cambio de tema es instantáneo** — un swap de `data-theme`,
  nunca una recarga.
