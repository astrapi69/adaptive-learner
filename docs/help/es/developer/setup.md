# Configuración del entorno de desarrollo

## Requisitos previos

- **Python 3.12+** (3.11 también funciona para el backend, pero
  los plugins se prueban con 3.12).
- **Node 24+** (requerido por Vite 8). Las versiones más antiguas
  de Node fallarán en el paso de compilación con
  `crypto.hash is not a function`.
- **Poetry** para la gestión de dependencias Python. Instalación:
  `curl -sSL https://install.python-poetry.org | python3 -`.
- **Bun** 1.3+ (gestor de paquetes del frontend, #1492).
- **GNU Make** para los objetivos de orquestación. El Makefile
  es la fuente de verdad — cada comando de CI está ahí.

## Clonar + instalar

```bash
git clone git@github.com:astrapi69/adaptive-learner.git
cd adaptive-learner
make install
```

`make install` ejecuta:

1. `cd backend && poetry install` — backend + dependencias de
   rutas de los plugins.
2. `cd frontend && bun install` — dependencias del frontend (Node 24).
3. Instala cada plugin de `plugins/` como dependencia de ruta en
   el entorno virtual del backend (`develop = true` para que las
   ediciones sean inmediatas).

Si `make install` falla, el culpable más común es Poetry
seleccionando el Python equivocado. Ejecuta `poetry env use python3.12`
en `backend/` (y en cada plugin si necesitas ir más a fondo) y
reinstala.

## Configuración

El backend lee su configuración de una cadena de tres capas
(la prioridad más alta gana):

1. **Variables de entorno** con prefijo `ADAPTIVE_LEARNER_*`.
2. **Secretos del usuario** en
   `~/.config/adaptive_learner/secrets.yaml` — generado
   automáticamente como plantilla comentada en el primer inicio
   (`chmod 0600` en POSIX); nunca se confirma en git.
3. **Valores por defecto** en `backend/config/app.yaml`.

Más la resolución de claves de IA por proveedor:
**env > secrets.yaml > columna BD cifrada con Fernet** (configurada
mediante la interfaz de Ajustes), expuesta en la interfaz como el
campo `key_source_*` en `UserSettingsOut`.

El único secreto obligatorio es `ADAPTIVE_LEARNER_SECRET_KEY` —
usado para cifrar las claves de API de los usuarios en reposo con
Fernet. Genera una con `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
Tres lugares donde ponerla (la prioridad más alta gana):
variable de entorno `ADAPTIVE_LEARNER_SECRET_KEY`, `secret_key:`
en `secrets.yaml`, o `make dev-secret` para una clave de
desarrollo de un solo uso. La aplicación falla de forma
contundente al inicio si la clave no está configurada (sin
trampa de generación silenciosa por defecto — consulta
[docs/configuration.md](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)).

## Ejecutar

```bash
make dev
```

Inicia el backend en el puerto 18001 y el frontend en el puerto
15174, en paralelo. El backend tiene recarga automática mediante
`--reload` de uvicorn; el frontend usa el servidor de desarrollo
de Vite. Presiona Ctrl-C una vez para detener ambos.

Modo en segundo plano:

```bash
make dev-bg   # inicia backend + frontend en segundo plano
make dev-down # detenerlos
```

## Pruebas

```bash
make test                 # backend + plugins + Vitest del frontend
make test-backend         # solo pytest del backend
make test-frontend        # solo Vitest del frontend
make test-coverage        # ejecución de cobertura opcional (lenta)
```

Pruebas E2E:

```bash
cd e2e && npx playwright test
```

16 archivos de especificación de humo en v1.20.0: página de
inicio, incorporación + evaluación, sesión (SSE de 3 partes),
plan de estudios, ajustes, ventanas gráficas móviles, emparejamiento
de sincronización, ciclo completo de copia de seguridad,
auto-bucle de varios ciclos, importación + análisis, exportación
Markdown, filtro de asignaturas/etiquetas, notas de texto
enriquecido, selector de modelos.

## Linting + formato

```bash
cd backend && poetry run ruff check .       # lint Python
cd backend && poetry run ruff format .      # formato Python
cd frontend && bunx tsc --noEmit             # comprobación TypeScript
cd frontend && bun run lint                 # ESLint
cd frontend && bun run format               # Prettier
```

Los hooks de pre-commit aplican las comprobaciones de ruff y
formato en cada confirmación:

```bash
cd backend && poetry run pre-commit install
```

## Documentación

```bash
make docs-install   # una vez, instala el entorno virtual de MkDocs en docs/
make docs-serve     # sirve la documentación en localhost:8000 con recarga automática
make docs-build     # compila el sitio estático en site/
```

El entorno virtual de docs es independiente del del backend —
MkDocs tiene su propio `docs/pyproject.toml` con mkdocs-material
y mkdocs-static-i18n.

## Problemas comunes

- **`make dev` falla con "puerto ya en uso"**: hay otra instancia
  de AdaptiveLearner en ejecución. Usa `make dev-down` o
  `pkill -f uvicorn`.
- **Las pruebas fallan con "duplicate column name"**: una migración
  Alembic cambió el esquema. Elimina
  `backend/adaptive_learner.db` y vuelve a ejecutar.
- **`bun run build` falla con Node 18**: actualiza a Node 24.
  Vite 8 lo requiere.
