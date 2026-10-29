# Pruebas

La disciplina de pruebas de AdaptiveLearner se aplica mediante
`make test` en cada cambio. La estrategia es una pirámide:
unitarias en la base, integración en el medio, humo E2E en la
cima.

## Recuentos de pruebas

| Capa | Herramienta |
|---|---|
| Backend unit + integración | pytest ^9 |
| Pruebas de plugins (todos los plugins) | pytest ^9 |
| Frontend unit + integración | Vitest 4 |
| Humo E2E | Playwright |
| Puerta de publicación en modo Dexie | Playwright |

Los recuentos crecen con cada versión. Para evitar números
duplicados que se desincronizan, esta página NO fija ningún total.
`docs/audits/current-coverage.md` es la única fuente canónica y
siempre actual de recuentos de pruebas y cobertura. Los plugins son
assessment, los proveedores de IA (anthropic / openai / gemini /
perplexity), session, tracking, tools, gamification, anki,
notebooklm, learning-repo, content-loader y missions.

## pytest del backend

```bash
make test-backend      # todas las pruebas del backend
cd backend && poetry run pytest -k "test_session" -v
cd backend && poetry run pytest --pdb
```

Las pruebas viven en `backend/tests/`. Los fixtures en
`conftest.py` proporcionan una base de datos SQLite en memoria
nueva por prueba, el `TestClient` y un gestor de plugins simulado.
El aislamiento de pruebas es estricto - `ADAPTIVE_LEARNER_TEST=1`
se establece antes de cualquier importación de `app.*`.

## Pruebas de plugins

Cada plugin tiene su propio directorio `tests/`:

```bash
make test-plugins              # todos los 7
make test-plugin-session       # solo uno
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

Las pruebas de plugins no cargan la aplicación FastAPI - ejercitan
los módulos del plugin de forma aislada. Simula el `pluggy.PluginManager`
al probar la activación de hooks.

## Vitest del frontend

```bash
make test-frontend                # ejecuta Vitest desde frontend/
cd frontend && bunx vitest         # modo vigilancia
cd frontend && bunx vitest run src/storage/  # un directorio
```

Las pruebas viven junto al código fuente: `Componente.test.tsx`
junto a `Componente.tsx`. happy-dom es el entorno; React 19 + RTL.

## Patrones de simulación

**Proveedores de IA**: simula `global.fetch` y verifica la URL,
los encabezados y el cuerpo:

```typescript
beforeEach(() => {
  global.fetch = vi.fn(async (input, init) => {
    calls.push({url, method, body});
    return new Response(JSON.stringify({content: [{type: "text", text: "hi"}]}), {status: 200});
  });
});
```

**fake-indexeddb**: al principio de cada archivo de prueba Dexie:

```typescript
import "fake-indexeddb/auto";

beforeEach(async () => {
  await _resetDbForTests();
  const {IDBFactory} = await import("fake-indexeddb");
  (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
});
```

Cada prueba obtiene un IndexedDB en memoria nuevo - sin filtraciones.

**Simulaciones de api/client.ts** (páginas heredadas):

```typescript
vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {...actual, api: {...actual.api, users: {...actual.api.users, get: apiGetMock}}};
});
```

La página importa `getStorage()`, que delega en ApiStorage, que
delega en `api.*`. La simulación intercepta en la capa `api.*` y
sigue disparando a través de la pila de almacenamiento.

## E2E con Playwright

```bash
cd e2e && npx playwright test
cd e2e && npx playwright test --ui   # interactivo
cd e2e && npx playwright test smoke/mobile-viewports.spec.ts
```

Las especificaciones de humo cubren las rutas críticas del usuario:

- Selector de idioma de la página de inicio + formulario de
  incorporación
- Evaluación con 12 preguntas + renderizado del radar
- Inicio de sesión + finalización + calificación
- Ajustes de idioma + clave API
- Creación del plan de estudios
- Ventanas gráficas móviles (iPhone SE, iPhone 14, Pixel 7, iPad)

Las especificaciones usan solo selectores `data-testid` - sin
selectores CSS frágiles. Las especificaciones de humo NO están en
la ruta de `make test`; arrancan sus propios servidores en sus
propios puertos y no necesitan una aplicación en ejecución. Un
`make dev` en marcha no se toca.

## Cobertura

```bash
make test-coverage   # opcional; lento y consume recursos
```

La cobertura es un informe, no un gate de fusión, así que no se
ejecuta en los PRs. El flujo `coverage.yml` se ejecuta cada noche (y
bajo demanda); descarga los artefactos:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

Cada plugin tiene su propio artefacto `<directorio-del-plugin>-coverage`,
por ejemplo
`gh run download --name adaptive-learner-plugin-session-coverage`; un
plugin nuevo queda cubierto sin editar el flujo de trabajo.

Objetivos según `.claude/rules/quality-checks.md`:

- Servicios + lógica de negocio: mínimo 95%
- Endpoints de API: mínimo 90%
- Componentes del frontend con lógica: mínimo 85%
- Hooks + utilidades: mínimo 95%

Global: 85-95% en todo el proyecto.

## Pre-commit

```bash
cd backend && poetry run pre-commit install
```

Los hooks están en `.pre-commit-config.yaml`, por ejemplo ruff check
(auto-reparación) y ruff format, comprobaciones de espacios, YAML,
JSON y conflictos de fusión, ESLint del frontend, las comprobaciones
de la documentación (trinquete de sustitutos de diéresis, referencias
de la documentación) y `plugin-lock-paired-with-pyproject`
(bloqueante): ejecuta `poetry check --lock` para cada plugin cuyo
`pyproject.toml` o `poetry.lock` esté implicado y falla cuando las
dependencias cambiaron desde que se escribió el lock; también se
ejecuta en el job de pre-commit de la CI sobre todos los archivos.
En ese job se omite el hook `eslint` (el job de pruebas del frontend
ejecuta ESLint con las dependencias instaladas). Prettier no es un
hook: `bun run format:check` se ejecuta en el job de pruebas del
frontend, sin bloquear hasta el reformateo único de #3270.

## CI

La CI se divide en dos niveles: los gates de corrección se ejecutan
en cada PR (deben pasar para poder fusionar), y las suites caras o
solo de aviso se ejecutan en el turno de noche y en el momento del
release.

`.github/workflows/ci.yml` se ejecuta en cada push a `develop` /
`main` y en cada PR (Python 3.12):

1. Pruebas del backend (pytest)
2. Pruebas de plugins (`make test-plugins`, todos mediante el venv
   del backend)
3. Frontend: `tsc --noEmit`, ESLint (`--max-warnings 0`),
   comprobación de dependencias circulares, Stylelint, Vitest,
   `vite build`, `bun audit --audit-level=high` (bloquea ante
   hallazgos altos y críticos). Un aviso sin versión corregida que
   solo alcanza una dependencia de desarrollo se exime por ID en
   `frontend/audit-ignore.txt`: un ID por línea, con un comentario
   encima que da el motivo y cuándo se retira la entrada.
   `make check-security` lee la misma lista; `security-scan.yml`
   sigue sin filtrar.
4. Hooks de pre-commit sobre todos los archivos
5. ruff + mypy + pip-audit del backend
6. Verificador de deriva de la documentación (`verify_docs.py` +
   sincronización de la navegación de mkdocs)

**Test Impact Analysis (#615):** en un PR solo se ejecutan las
pruebas afectadas - `vitest run --changed origin/<base>` y
`pytest --testmon`. Los push a `develop` / `main`, las ejecuciones
nocturnas y las de release ejecutan siempre la suite COMPLETA. El
retorno a la suite completa es automático (una referencia base no
resoluble o un fallo de la caché de testmon).

Otros gates de PR viven en flujos de trabajo propios:

- `complexity-check.yml` - el gate de trinquete de complejidad
  (`make check-complexity-gate`, radon para Python + complejidad de
  ESLint para TS). Es un trinquete de línea base: solo falla ante
  infractores NUEVOS o que empeoran frente a `.complexity-baseline`,
  de modo que bloquea la complejidad nueva sin forzar una limpieza
  de la deuda preexistente. El informe completo de complejidad, solo
  de aviso, se ejecuta cada noche. En el mismo job se ejecuta la
  comprobación de tamaño de carpeta (`scripts/check-folder-size.sh`
  contra `.dirsize-baseline`); localmente `make check-folder-size` o
  como parte de `make ci`.
- `cohesion-check.yml` - la comprobación de tamaño de archivo
  (gate contra `.filesize-whitelist`) más dos gates de nombres de
  clase: nombres de clase CSS muertos (`check-dead-classnames.py`
  contra `.dead-classnames-baseline`) y el **gate de className sin
  estilos** (`--unstyled`, un trinquete contra
  `.unstyled-classnames-baseline`) - un `className` cuyos tokens
  están todos muertos bloquea el PR.
- `visual-baseline-gate.yml` - un PR que cambia rutas visualmente
  críticas (componentes de lección, renderizadores de ejercicios,
  archivos de tema/CSS) debe incluir en el mismo PR las capturas
  de referencia (baselines) afectadas; etiqueta de escape
  `visual-baselines-unaffected` para cambios demostrablemente
  inertes.
- `testid-reference-gate.yml` - si un PR elimina o renombra un
  `data-testid` que una spec E2E referencia estáticamente (en una
  superficie muy visible para el usuario) sin tocar la spec, el
  gate falla (`make check-testid-refs`); etiqueta de escape
  `testid-refs-unaffected`.
- `docker-build-smoke.yml` - smoke de solo build de las imágenes
  de Compose de producción (la ruta del launcher / install.sh),
  filtrado por rutas en PRs, además en `release/**`, semanalmente
  y bajo demanda; localmente `make docker-build-smoke`.
- `dexie-smoke.yml` - el gate E2E del modo Dexie: en cada pull
  request al que afecta (`scripts/dexie_smoke_affected.py` decide; el
  job `Dexie smoke (required)` siempre informa), además a diario, en
  `release/**` y bajo demanda; localmente `make test-dexie-smoke`.
- `backup-e2e.yml` - se ejecuta en los PRs que tocan una ruta de
  copias de seguridad (por ejemplo `frontend/src/storage/backup/`, los
  stores de Dexie o los servicios de copia de seguridad del backend;
  la lista está en el flujo de trabajo) y ejecuta cada
  `e2e/dexie/backup-*.spec.ts`, incluido el viaje de ida y vuelta por
  todas las tablas de la copia de seguridad.

**Turno de noche / release (no en PRs):**

- `coverage.yml` - informe de cobertura (diario + bajo demanda)
- `security-scan.yml` - pip-audit / bun audit / bandit (semanal +
  en `release/**` + bajo demanda; solo de aviso)
- `content-stats.yml` - deriva de las estadísticas de contenido
  frente a un checkout fresco del contenido (diaria + bajo demanda)
- `mutation-frontend.yml` - mutation testing con Stryker
  (nocturno tras la variable de repo `ENABLE_NIGHTLY_MUTATION` +
  bajo demanda; cada ejecución muta una porción de los archivos
  para que la ejecución quepa en el límite de tiempo del job); el
  mutation testing del backend usa mutmut
- `webkit-gate.yml` - el gate de layout con el motor WebKit real
  (clases de bugs de iOS/Safari que los gates de Chromium no
  pueden ver estructuralmente), diario tras la variable de repo
  `ENABLE_NIGHTLY_WEBKIT`, siempre en `release/**` y bajo demanda
- `visual-regression.yml` - la matriz de baselines visuales
  (diaria + bajo demanda; `update_baselines=true` vuelve a
  renderizar los baselines en CI y los sube como artefacto)
- `visual-baseline-sync.yml` - flujo de trabajo de servicio:
  renderiza los baselines en CI y los empuja como commit a la
  rama del PR (etiqueta `refresh-visual-baselines`, o bajo demanda
  con un número de PR) - la revisión de las imágenes antes del
  merge sigue siendo obligatoria
- `smoke-nightly.yml` - ejecución nocturna del smoke de viewports
  móviles; los hallazgos van a un único issue de seguimiento
- `unused-catalog-keys.yml` - informe nocturno de las claves de
  catálogo sin consumidor más antiguas que la ventana previa
  (`AGE_DAYS` en `frontend/src/i18n/unused-catalog-keys.ts`), en un
  único issue de seguimiento; cada clave es una candidata y se revisa
  una a una antes de eliminarla

`.github/workflows/release-gate.yml` se ejecuta en pushes de
etiquetas: verifica que los pins de versión estén sincronizados en
todos los archivos que llevan versión (sin deriva), que los
lockfiles de plugins coincidan y que los artefactos regenerados
estén actualizados.
