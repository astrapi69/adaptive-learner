# Pruebas

La disciplina de pruebas de AdaptiveLearner se aplica mediante
`make test` en cada cambio. La estrategia es una pirámide:
unitarias en la base, integración en el medio, humo E2E en la
cima.

## Recuentos de pruebas (v1.20.0)

| Capa | Recuento | Herramienta |
|---|---|---|
| Backend unit + integración | 786 | pytest ^9 |
| Pruebas de plugins (10 plugins) | 615 | pytest ^9 |
| Frontend unit + integración | 1233 | Vitest 4 |
| Humo E2E | 16 archivos de especificación | Playwright |
| **Total (`make test`)** | **2634** | |

Desglose de plugins: assessment 110 + ai-anthropic 34 +
ai-openai 31 + ai-gemini 33 + session 215 + tracking 64 +
tools 58 + gamification 23 + anki 20 + notebooklm 27.

## pytest del backend

```bash
make test-backend      # 786 pruebas, ~35s
cd backend && poetry run pytest -k "test_session" -v
cd backend && poetry run pytest --pdb
```

Las pruebas viven en `backend/tests/`. Los fixtures en
`conftest.py` proporcionan una base de datos SQLite en memoria
nueva por prueba, el `TestClient` y un gestor de plugins simulado.
El aislamiento de pruebas es estricto — `ADAPTIVE_LEARNER_TEST=1`
se establece antes de cualquier importación de `app.*`.

## Pruebas de plugins

Cada plugin tiene su propio directorio `tests/`:

```bash
make test-plugins              # todos los 7
make test-plugin-session       # solo uno
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

Las pruebas de plugins no cargan la aplicación FastAPI — ejercitan
los módulos del plugin de forma aislada. Simula el `pluggy.PluginManager`
al probar la activación de hooks.

## Vitest del frontend

```bash
make test-frontend                # 387 pruebas, ~2s
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

Cada prueba obtiene un IndexedDB en memoria nuevo — sin filtraciones.

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

Las especificaciones usan solo selectores `data-testid` — sin
selectores CSS frágiles. Las especificaciones de humo NO están en
la ruta de `make test`; necesitan una aplicación en ejecución
(`make dev-bg` primero).

## Cobertura

```bash
make test-coverage   # opcional; lento y consume recursos
```

La cobertura se ejecuta en CI para cada push a main; descarga los
artefactos:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

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

Hooks: ruff check (auto-reparación), ruff format, espacios en
blanco al final, corrector de final de archivo, check-yaml,
check-merge-conflict. Solo para el backend — el lint del frontend
se ejecuta en tiempo de CI, no en pre-commit.

## CI

`.github/workflows/ci.yml` se ejecuta en cada push a main + cada
PR:

1. Pruebas del backend (matriz Python 3.12 + 3.13)
2. Pruebas de plugins (un trabajo por plugin; estrategia de matriz)
3. Vitest del frontend + tsc + lint
4. ruff check + comprobación de formato

`.github/workflows/release-gate.yml` se ejecuta en pushes de
etiquetas: verifica que las versiones estén sincronizadas (sin
deriva en 12 archivos), que los lockfiles de plugins coincidan y
que los artefactos regenerados estén actualizados.
