# Incorporación: tu primera corrección de bug

Un recorrido práctico, paso a paso, para una persona que empieza a
contribuir. A diferencia de las páginas de
[Arquitectura](architecture.md) y [Configuración](setup.md) (que
explican *qué* es el sistema), esta página te guía para *hacer* tu
primera corrección de bug de principio a fin: desde un clon recién
hecho hasta un pull request fusionado.

## 1. Configurar el entorno de desarrollo

Requisitos previos: **Python 3.12** (la restricción del backend es
`~3.12`), **Node 24+** (requerido por Vite 8), **Poetry**, **Bun**
y **GNU Make**.

```bash
# Clone
git clone https://github.com/astrapi69/adaptive-learner.git
cd adaptive-learner

# Install everything: Poetry backend + plugin path-deps + Bun frontend
make install

# Establish a green baseline before you change anything
make test

# Run the app (backend on :18001, frontend on :15174)
make dev
```

El servidor de desarrollo del frontend corre en
**http://localhost:15174** y el backend en **http://localhost:18001**.
Ambos puertos se pueden sobrescribir mediante
`ADAPTIVE_LEARNER_FRONTEND_PORT` / `ADAPTIVE_LEARNER_PORT`. Pulsa
Ctrl-C una vez para detener ambos.

Si `make install` falla, el culpable habitual es Poetry eligiendo el
Python equivocado: ejecuta `poetry env use python3.12` en `backend/` y
reinstala. Para la cadena de configuración completa (secretos, claves de
IA, la obligatoria `ADAPTIVE_LEARNER_SECRET_KEY`) consulta
[Configuración](setup.md).

## 2. Encontrar un bug

Los issues son la cola de trabajo. Toda corrección necesita un issue
**primero** (`GITHUB-ISSUE-PFLICHT`).

```bash
# Open bug issues
gh issue list --label bug --state open
```

O en GitHub:
<https://github.com/astrapi69/adaptive-learner/issues?q=is%3Aissue+is%3Aopen+label%3Abug>

Para empezar, elige algo pequeño: busca `good first issue` o un `bug`
de poco esfuerzo. Si no existe un issue para el bug que encontraste,
**crea uno antes de tocar código**, y abre un issue *separado* para
cualquier bug nuevo que descubras por el camino.

## 3. Entender el issue

- Lee la descripción y reproduce el bug en local.
- Anota en qué modo de almacenamiento ocurre. Adaptive Learner incluye
  **almacenamiento dual** (API/SQLite *y* Dexie/IndexedDB); un bug
  puede vivir en un modo, en el otro o en ambos. Consulta
  [Capa de almacenamiento](storage-layer.md).
- Si no puedes reproducirlo, pregunta en el issue en lugar de adivinar.

## 4. Crear una rama

Adaptive Learner usa **gitflow**: `develop` es la rama activa; `main`
contiene solo releases. Crea la rama *desde* `develop` y abre tu PR
*contra* `develop`.

```bash
git checkout develop
git pull origin develop
git checkout -b fix/short-description
```

Nombres de rama:

| Prefijo | Para |
|---|---|
| `fix/...` | correcciones de bugs |
| `feature/...` | funcionalidades nuevas |
| `refactor/...` | refactorizaciones |
| `docs/...` | documentación |
| `chore/...` | herramientas / mantenimiento |

## 5. Corregir el bug

Consejos para encontrar el código:

```bash
# Search by an error string / symbol (use ripgrep)
rg "the error message" frontend/src backend/app
```

- Errores del frontend: abre la consola de las DevTools del navegador.
- `cd frontend && bunx vitest --watch <file>` te da feedback de pruebas
  en vivo mientras editas (ejecuta vitest siempre desde `frontend/`, no
  desde la raíz del repo).
- **Estilos: solo clases utilitarias de Tailwind**, sin estilos de color
  en línea y sin reglas nuevas en `global.css`. Los colores pasan por
  design tokens (variables CSS): consulta [Sistema de temas](themes.md).
- **Ambos modos de almacenamiento deben seguir funcionando.** Una
  funcionalidad que se publica en modo API sin una ruta Dexie (o sin un
  mensaje amable de "no disponible en modo navegador") bloquea el
  lanzamiento.

## 6. Escribir una prueba de regresión

Toda corrección necesita al menos una prueba que falle antes del cambio
y pase después.

```bash
# Frontend (Vitest) - run from frontend/
cd frontend && bunx vitest run src/path/to/file.test.ts

# Backend (pytest)
cd backend && poetry run pytest tests/path/ -v

# A single plugin
make test-plugin-gamification
```

Para los cambios que tocan las copias de seguridad hay una barrera
adicional: un viaje de ida y vuelta real Exportar → Importar en
`make dev` con datos reales (el `BACKUP-AKZEPTANZTEST`). Las pruebas
unitarias por sí solas nunca justifican fusionar un cambio de copias de
seguridad.

## 7. Ejecutar la barrera completa en local

```bash
make test            # backend + plugins + frontend Vitest
make check-types     # mypy + tsc --noEmit
make test-dexie-smoke  # GH-Pages-shape build, every route, no backend
cd frontend && bun run build
```

Todo debe estar en verde antes de abrir un PR.

## 8. Commit y push

[Conventional Commits](https://www.conventionalcommits.org/). Referencia
el issue con una palabra clave de cierre para que la fusión lo cierre
automáticamente.

```bash
git add -A
git commit -m "fix(area): short description

Longer description of what the problem was and how it was fixed.

Closes #123"

git push -u origin fix/short-description
```

Mantén los commits **atómicos**: cada commit deja el árbol en verde
(`make test` pasa). Combina un cambio de código con su cambio de prueba
en el mismo commit cuando separarlos crearía un estado intermedio rojo.

## 9. Abrir un pull request

```bash
gh pr create --base develop \
  --title "fix(area): short description" \
  --body "Closes #123

## What changed
- ...

## Tests
- ..."
```

Apunta siempre a **`develop`**, nunca a `main` (`main` es la rama de
releases). Para un sub-issue de un umbrella/epic, cita el *sub-issue*
con `Closes #<sub-issue>`, más `Refs #<umbrella>` para la trazabilidad.

## 10. Esperar a la CI

La CI ejecuta las barreras de corrección en cada PR:

- Pruebas del frontend (Vitest) + pruebas del backend / plugins (pytest)
- TypeScript (`tsc --noEmit`) + mypy + ruff + ESLint
- Hooks de pre-commit
- Barrera de complejidad (ratchet con línea base: las funciones nuevas
  deben quedar por debajo del umbral de complejidad ciclomática)
- Guardas de tamaño de carpeta + de archivo (prevención de god-files /
  god-folders)
- Paridad de i18n (cada catálogo bajo `backend/config/i18n/` debe
  definir cada clave)
- Guarda de design tokens (sin colores fijos / utilidades de paleta fija)
- Verificador de deriva de documentación

Las comprobaciones más pesadas (E2E en modo Dexie, cobertura, pruebas de
mutación, análisis de seguridad, deriva de content-stats) se ejecutan
cada noche + en el lanzamiento, no en cada PR. Por eso un PR en verde no
prueba que `develop` esté en verde.

Cuando una barrera te bloquea, sobre todo un **ratchet** (complejidad,
tamaño de archivo, tamaño de carpeta, ...), lee
[Barreras, ratchets y protección de ramas](gates-and-ratchets.md)
antes de suponer que se equivoca. Explica qué es cada barrera, qué
hacer cuando un ratchet te bloquea y cómo ejecutar las barreras en local
con `make ci` antes de hacer push.

## 11. Revisión y fusión

Espera la revisión (o fusiona tú mismo si tienes permisos de
mantenedor). Los PR se fusionan con **squash** en `develop`, así que los
commits de tu rama se reducen a un único commit limpio en el tronco.

---

## Reglas del proyecto (versión corta)

| Regla | Significado |
|---|---|
| `GITHUB-ISSUE-PFLICHT` | cada corrección/funcionalidad necesita un issue primero |
| Solo Tailwind | nada añadido a `global.css`, sin estilos de color en línea |
| Design tokens | colores mediante variables CSS, nunca literales hex |
| Paridad del modo Dexie | todo funciona en modo Dexie *y* API |
| Biblioteca primero | API nativa > framework > biblioteca > código propio |
| Conventional Commits | `fix()`, `feat()`, `refactor()`, `docs()`, ... |
| i18n | todas las cadenas de la UI en cada catálogo de `backend/config/i18n/` |
| Objetivos táctiles de 44px | elementos interactivos aptos para móvil |
| Un asunto por PR | cada PR contiene un único cambio coherente |
| Protección de ramas | `develop` necesita una rama actualizada + comprobaciones en verde (vincula también a los administradores) |

Conjunto completo de reglas: [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).

## Comandos habituales

```bash
make dev               # start backend + frontend
make test              # all tests (backend + plugins + Vitest)
make test-dexie-smoke  # Dexie-mode release gate (no backend)
make check-types       # mypy + tsc --noEmit
make check-complexity-gate   # complexity ratchet
make check-folder-size       # god-folder guard
make sync-i18n         # regenerate frontend i18n from backend YAML
make sync-versions     # propagate the canonical version
cd frontend && bun run build   # build the frontend
```

`make help` enumera todos los objetivos; el
[Makefile](https://github.com/astrapi69/adaptive-learner/blob/develop/Makefile)
es la fuente de verdad para los comandos de compilación.

## La arquitectura en una pantalla

```
frontend/src/
  api/          FastAPI client (the only place fetch() lives)
  components/   UI components, grouped by concern (dashboard/, lesson/, ...)
  features/     feature-strategy gating (useFeatureAvailable)
  hooks/        React hooks
  lib/          business logic, grouped by domain (lesson/, srs/, ai/, ...)
  pages/        route components (+ content/, dashboard/, lesson/ subdirs)
  shared/       app-independent reusable components
  storage/      dual storage: getStorage() -> IStorageService
  styles/       design tokens + per-theme CSS

backend/app/
  routers/      thin FastAPI endpoints (delegate to services)
  services/     business logic (no FastAPI imports)
  repositories/ data layer (Session-free contracts)
  models/       SQLAlchemy models (single-file domain model)
  hookspecs.py  the 10 plugin hooks

plugins/        PluginForge plugins (one package each; the
                catalogue lives in CLAUDE.md)
```

Detalles: [Arquitectura](architecture.md).

## ¿Dónde encuentro...?

| Qué | Dónde |
|---|---|
| Reglas del proyecto | [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules) |
| Arquitectura | [Arquitectura](architecture.md) |
| Barreras, ratchets, protección de ramas | [Barreras, ratchets y protección de ramas](gates-and-ratchets.md) |
| Capa de almacenamiento | [Capa de almacenamiento](storage-layer.md) |
| Sistema de plugins | [Escribir un plugin](plugin-guide.md) |
| Integración de IA | [Integración de IA](ai-integration.md) |
| Pruebas | [Pruebas](testing.md) |
| Flujo de lanzamiento | [Flujo de lanzamiento](release.md) |
| Formato del contenido de lecciones | [Crear contenido de lecciones](authoring-content.md) |
| i18n | [Internacionalización](i18n.md) |
| Despliegue | [Despliegue](deployment.md) |
| Hoja de ruta | [`docs/ROADMAP.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/ROADMAP.md) |
