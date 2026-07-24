# Sistema de temas

La fase 58 (v1.41.0) reemplazó el antiguo par claro/oscuro por un
sistema de seis temas clásicos sobre una única dimensión
`data-theme`, más una opción `auto` que sigue al sistema
operativo. La fase 63 (v1.63.0) añadió seis **presets WCAG AA
recomendados**, de modo que el selector incluye en total **12
temas**.

## Presets recomendados (Fase 63 / v1.63.0)

El selector en Ajustes → Apariencia encabeza con una subpestaña
**Recomendados**:

- **Claros:** `catppuccin-latte`, `supabase`, `graphite`
- **Oscuros:** `catppuccin-mocha`, `soft-pop`, `amethyst-haze`

Se generaron a partir de presets de tweakcn mediante
`scripts/generate_preset_themes.py` como temas completos de 44
tokens, con **WCAG AA forzado de forma computacional**
(`contrast.test.ts` sobre los 12 temas). Los seis clásicos
(`light`, `dark`, `ocean`, `forest`, `high-contrast`, `sepia`)
permanecen sin cambios.

## Cómo funciona

- Los **tokens de color canónicos** residen en
  `frontend/src/styles/themes/theme-<id>.css`, un bloque por valor
  de `data-theme` (`light`, `dark`, `ocean`, `forest`,
  `high-contrast`, `sepia`). Cada archivo define el conjunto
  semántico de tokens **completo**: no hay fallback al tema claro.
- Los **tokens independientes del tema** (espaciados, radio,
  fuentes, la paleta de métodos de marca) y los **alias heredados**
  (`--bg`, `--surface`, `--fg`, `--danger`, ...) residen en
  `styles/global.css :root`. Los alias resuelven *a través de* los
  tokens canónicos y, así, siguen automáticamente al tema activo.
- Los archivos de tema se importan en `main.tsx`, **el claro
  primero**, para que el tema activo gane el empate de
  especificidad frente a `:root`.
- `frontend/src/lib/themes.ts` es el registro: `THEMES`, los tipos
  `ThemeId` / `ThemeChoice`, `resolveTheme(choice, prefersDark)`
  para el mapeo `auto` y las muestras de color de la vista previa.
- `frontend/src/hooks/useTheme.ts` posee el atributo `data-theme`
  aplicado y guarda la elección bajo `adaptive-learner.theme`
  (migra una sola vez la antigua clave `adaptive-learner-theme`).
- `index.html` contiene un pequeño script en línea que aplica el
  tema guardado **antes del primer paint** (sin parpadeo). Refleja
  la resolución del hook; mantenlos sincronizados.
- Los gráficos (Recharts) no pueden leer variables CSS en
  atributos SVG, por lo que `lib/chartTheme.ts` + `useChartTheme`
  leen los valores computados de los tokens y vuelven a leerlos al
  cambiar `data-theme`.

## Conjunto de tokens (definido por cada tema)

Fondos (`--bg-primary/secondary/surface/elevated/overlay`), texto
(`--fg-primary/secondary/muted/inverse`), bordes
(`--border-primary/subtle/accent`), interactivo
(`--interactive-bg/hover/active/disabled`), acento
(`--accent`, `-hover`, `-fg`, `-subtle`, `-rgb`), pares de estado
(`--success/-bg`, `--error/-bg`, `--warning/-bg`, `--info/-bg`),
feedback de ejercicios
(`--exercise-correct/-wrong/-selected/-matched`), `--star`, series
de gráficos (`--chart-1..6`) y sombras
(`--shadow-card/-elevated/-md`).

`styles/themes/themes.test.ts` falla si a un tema le falta uno de
estos tokens o tiene uno de más; `styles/contrast.test.ts`
comprueba WCAG 2.1 AA sobre los 12 temas. La referencia completa
de tokens está en
[Arquitectura de tokens de diseño](../architecture/design-tokens.md).

## Añadir un tema nuevo

1. **Copia** un archivo existente, p. ej.
   `cp theme-dark.css theme-midnight.css`, y cambia el selector a
   `[data-theme="midnight"]`. Conserva **cada** token; cambia solo
   los valores. Nada de estilos de componentes aquí.
2. **Regístralo** en `lib/themes.ts`: añade a `THEMES` una entrada
   `ThemeMeta` (id, `label` en inglés, `family` light|dark y un
   `swatch` para la vista previa de Ajustes) y agrega la id a la
   unión `ThemeId`.
3. **Impórtalo** en `main.tsx` después de `theme-light.css` (el
   orden solo cuenta en relación con el claro).
4. **Permítelo en el guard de pre-paint**: agrega la id al array
   `valid` en el `<script>` en línea de `index.html`.
5. **i18n**: añade `ui.themes.midnight` en los ocho catálogos bajo
   `backend/config/i18n/*.yaml` y ejecuta `make sync-i18n`.
6. **Comprueba**: `bunx vitest run src/styles/themes src/styles/contrast`
   - los pins de completitud y de contraste deben seguir en verde
   (ajusta los valores hasta que el contraste cumpla AA en el tema
   nuevo).

Eso es todo: el ThemePicker, el script de pre-paint, los gráficos
y cada componente adoptan el tema nuevo automáticamente, porque
todos leen los tokens canónicos.

## Reglas

- **Sin colores codificados de forma fija** en los componentes.
  `styles/no-hardcoded-colors.test.ts` lo impone para los estilos
  `.tsx` (una lista de permitidos documentada cubre los
  resolutores de gráficos, el confeti decorativo y los colores de
  datos).
- **Cada tema define cada token.** Sin huecos con herencia del
  claro: ese fue el error del audit F1 (tokens sin definir que
  mostraban hex claro en modo oscuro).
- **El cambio de tema es instantáneo**: un intercambio de
  `data-theme`, nunca una recarga.
