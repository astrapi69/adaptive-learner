# Arquitectura

Adaptive Learner es una aplicación de 4 capas impulsada por
plugins.

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend           React 19 + TypeScript 6 + Vite 8 +       │
│                    Vitest 4 + Dexie 4 (IndexedDB) + TipTap  │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ /api/*
┌─────────────────────────────────────────────────────────────┐
│ Backend            FastAPI ^0.136 + SQLAlchemy ^2.0 +       │
│                    Pydantic v2 + Alembic + Fernet           │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ hookspecs
┌─────────────────────────────────────────────────────────────┐
│ PluginForge        ^0.10.0 (PyPI externo; acceso por        │
│                    identidad via target_application)        │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ entry_points
┌─────────────────────────────────────────────────────────────┐
│ Plugins            10 paquetes en plugins/                  │
│                    (ai-{anthropic,openai,gemini}, assessment,│
│                    session, tracking, tools, gamification,  │
│                    anki, notebooklm)                        │
└─────────────────────────────────────────────────────────────┘
```

Las nuevas funcionalidades SIEMPRE pertenecen a un plugin, a
menos que toquen el núcleo (usuarios / proyectos / ajustes /
plan de estudios / temas / lecciones / copia de seguridad /
sincronización / sistema / importación).

## Almacenamiento dual (v0.7.0)

El frontend tiene un único punto de entrada donde se elige el
almacenamiento: `getStorage(): IStorageService`. Dos
implementaciones satisfacen un mismo contrato:

- **`apiStorage`** (por defecto): envoltorio ligero sobre
  `api/client.ts` que habla con el backend FastAPI.
- **`dexieStorage`** (local primero): pila completa de IndexedDB
  que refleja los 25 modelos SQLAlchemy. Las llamadas a la IA se
  disparan directamente desde el navegador mediante
  `storage/ai-providers.ts`.

`IStorageService` expone 22 espacios de nombres (users, projects,
settings, assessment, session con streaming, tracking, tools,
curricula, topics, lessons, plugins, system, backup, export,
subjects, tags, projectTaxonomy, imports, gamification, anki,
pronunciation, notebooklm). Ambas implementaciones implementan
cada método.

La factoría lee `localStorage["adaptive-learner.storage_mode"]`,
luego `VITE_STORAGE_MODE` (configurado por la compilación de GH
Pages) y luego toma `api` por defecto. Cambiar de modo no es un
intercambio en vivo: la página de Ajustes persiste la elección y
muestra un aviso de recarga requerida.

## Secretos en tres capas (v1.20.0 / Fase 34)

```
variables de entorno  > secrets.yaml         > columna BD Fernet
ADAPTIVE_LEARNER_*      ~/.config/...yaml      api_key_<proveedor>
```

Cada llamada a la IA recorre la cadena mediante
`services/settings.resolve_api_key`:

1. Variable de entorno `ADAPTIVE_LEARNER_<PROVEEDOR>_API_KEY`.
2. `ai.<proveedor>.api_key` en
   `~/.config/adaptive_learner/secrets.yaml`.
3. Columna BD descifrada con Fernet.
4. `None` - la llamada a la IA muestra un error en la interfaz.

La atribución del origen vive en `UserSettingsOut.key_source_*`
(enumeración: `env` / `secrets_yaml` / `settings` / `none`).
La interfaz de Ajustes deshabilita Guardar / Eliminar cuando el
origen es env o secrets_yaml.

La misma cadena se aplica a los sobreescrituras de `default_model`
por proveedor; `secrets.yaml` supera la sobreescritura de la
interfaz según el diseño de la Fase 34 (la configuración en
archivo prevalece sobre la interfaz para usuarios avanzados).

## Estructura del plugin

```
plugins/adaptive-learner-plugin-<nombre>/
  adaptive_learner_<nombre>/
    plugin.py     # <Nombre>Plugin(BasePlugin), implementaciones de hooks
    routes.py     # router FastAPI (delega en funciones de servicio)
    <módulo>.py   # lógica de negocio
  tests/
    test_*.py     # pruebas pytest
  pyproject.toml  # punto de entrada: [project.entry-points."adaptive_learner.plugins"]
```

- La clase del plugin hereda de `BasePlugin` (pluginforge).
- La lógica de negocio vive en sus propios módulos, NO en routes.py.
- routes.py contiene solo los endpoints FastAPI que delegan.
- Las especificaciones de hooks viven en `backend/app/hookspecs.py`.
- Dependencias del plugin como atributo de clase: `depends_on =
  ["session"]`.
- Todos los plugins son gratuitos (MIT). La infraestructura de
  licencias existe pero está inactiva (`LICENSING_ENABLED = False`).

## Hooks (8 especificaciones en `backend/app/hookspecs.py`)

| Hook | Cuándo | ¿Primer resultado? |
|---|---|---|
| `get_assessment_questions(lang)` | Carga de la página de Evaluación | sí |
| `calculate_profile(answers)` | Envío de la Evaluación | sí |
| `create_session_prompt(...)` | Cada turno del chat | sí |
| `ai_complete(messages, model, api_key, max_tokens)` | Llamada estándar a la IA | sí (enruta por prefijo de modelo) |
| `ai_complete_async(...)` | Evaluación paralela en límite de ciclo (v1.5.0) | sí |
| `ai_complete_stream(...)` | Respuesta de sesión en streaming (v1.6.0) | sí |
| `recommend_method_switch(...)` | Panel principal + Sesión | sí |
| `on_session_complete(session, rating)` | Fin de sesión | broadcast |
| `get_progress_summary(project_id)` | Widgets del Panel principal | broadcast |
| `get_tool_recommendations(profile, lang)` | Herramientas del Panel principal | broadcast |

## Flujo de datos

```
UI (React) → IStorageService
            → (modo API) router FastAPI → servicio → SQLAlchemy → SQLite
            → (modo Dexie) tabla Dexie → IndexedDB
            ↓
            orquestador IA → resolve_api_key (env > yaml > BD)
                           → pluginforge → plugin proveedor ai_complete*
                           → SDK Anthropic / OpenAI / Gemini
```

Unidireccional. Sin acceso directo a la BD desde los routers
(los servicios son dueños del trabajo SQLAlchemy). Sin código
frontend en el backend.

## Gestión de errores

```
Frontend       ApiError (estado + detalle) → toast para el usuario
Cliente API    Error HTTP → convertido a ApiError
Router         Ligero, no captura nada. El manejador global de excepciones mapea.
Servicio       Lanza subclases de AdaptiveLearnerError
Plugin         Lanza PluginError(nombre_plugin, mensaje)
Externo        ExternalServiceError(servicio, mensaje) para SDK de proveedores
```

Los servicios NUNCA lanzan `HTTPException`; los routers no
capturan NADA. El manejador global de excepciones en `main.py`
mapea los errores de dominio a códigos de estado HTTP. Consulta
`.claude/rules/code-hygiene.md` para el patrón completo.

## Persistencia

- Backend: SQLAlchemy + SQLite. Migraciones Alembic en
  `backend/migrations/versions/`.
- Superficie de sincronización: 28 tablas (línea base v1.19.0).
  Filas de historial de solo-adición (sesiones, mensajes,
  calificaciones, commits de progreso, evaluaciones de pasos,
  cambios de método, conversaciones importadas, mensajes
  importados, tarjetas Anki, preguntas de estudio) más ajustes
  mutables + filas de plan de estudios.
- Formato de copia de seguridad: JSON; claves API eliminadas en
  la exportación; la restauración es una fusión.
- Aislamiento de pruebas: los directorios de datos de producción
  llevan un marcador `.adaptive-learner-production`; si una
  prueba lo detecta, la ejecución aborta con
  `pytest.exit(returncode=2)`.

## Temas

5 temas (Classic, Cool Modern, Nord, Notebook, Studio) ×
claro/oscuro = 10 variantes. Variables CSS en toda la aplicación;
sin Tailwind. Propiedades personalizadas en
`frontend/src/styles/global.css`. Los nuevos elementos de
interfaz DEBEN usar el conjunto de variables.

## Móvil / PWA

`@media (max-width: 768px)` es el punto de corte canónico para
móvil (cajón hamburguesa, objetivos táctiles de 44×44, diseños
apilados). `@media (max-width: 360px)` es la red de seguridad
para pantallas muy estrechas. Los estilos de escritorio ≥769px
no se modifican.

Service worker (Workbox mediante vite-plugin-pwa): NetworkFirst
en GET `/api/` con tiempo de espera de 4s, LRU de 24h, límite de
60 entradas. Las escrituras en `/api/` usan NetworkOnly.
