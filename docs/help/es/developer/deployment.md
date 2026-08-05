# Despliegue

Se incluyen cuatro modos de despliegue:

| Modo | Dónde | Backend | Llamadas a la IA | Fuente de clave |
|---|---|---|---|---|
| Desarrollo local | `make dev` | FastAPI en :18001 | Del lado del servidor | env / secrets.yaml / BD |
| GitHub Pages | `astrapi69.github.io/adaptive-learner/` | Ninguno (Dexie) | Directo desde el navegador | BD (IndexedDB) |
| Lanzador de escritorio | Binario PyInstaller (basado en Docker) | FastAPI en un contenedor Docker | Del lado del servidor | `.env` (auto-generado) / interfaz de Ajustes |
| Docker | Docker Compose autoalojado | FastAPI en contenedor | Del lado del servidor | env / interfaz de Ajustes |

## Desarrollo local

```bash
make dev
```

Inicia el backend (FastAPI + uvicorn `--reload`) en el puerto
18001 y el frontend (servidor de desarrollo Vite) en el puerto
15174 en paralelo. Presiona Ctrl-C una vez para detener ambos.

El proxy Vite del frontend reenvía `/api/*` al backend, por lo
que el frontend siempre usa `/api` como URL base - no se necesita
configuración de CORS para el desarrollo local.

Para el modo en segundo plano:

```bash
make dev-bg     # separado
make dev-down   # detener
```

## GitHub Pages (solo Dexie)

`.github/workflows/deploy-gh-pages.yml` compila el frontend con:

- `VITE_BASE="/adaptive-learner/"` - añade el prefijo de la ruta
  de Pages del repositorio a cada URL de recurso.
- `VITE_STORAGE_MODE="dexie"` - fija DexieStorage como modo por
  defecto.
- `VITE_API_BASE=""` - no hay backend al que apuntar.

El flujo de trabajo se ejecuta en cada push a `main` y en
despacho manual. Después de la compilación copia
`dist/index.html` a `dist/404.html` para el fallback del router
SPA, luego usa `actions/upload-pages-artifact@v5` +
`actions/deploy-pages@v5` para publicar.

La URL del sitio es `https://astrapi69.github.io/adaptive-learner/`.
Los usuarios con dominio personalizado añaden un archivo `CNAME`
en `frontend/public/` con el nombre de dominio; el enrutamiento
de Pages de GitHub se encarga del resto.

## Docker Compose (pila completa)

```bash
make prod        # docker compose up -d
make prod-down   # docker compose down
```

`docker-compose.prod.yml` incluye **un único servicio, `app`**
(un solo contenedor desde #2058 - no hay nginx ni contenedor de
frontend separado):

- **FastAPI (imagen Python 3.12)** sirve TANTO los statics del
  frontend compilado COMO `/api/*`, en el puerto interno
  `${ADAPTIVE_LEARNER_BACKEND_PORT:-8000}`.
- Puerto publicado en el host:
  `${ADAPTIVE_LEARNER_BIND_ADDRESS:-127.0.0.1}:${ADAPTIVE_LEARNER_PUBLIC_PORT:-8501}` -
  loopback por defecto.
- **Un volumen con nombre `adaptive-learner-data`** en `/app/data`
  que sobrevive a las reconstrucciones del contenedor.

`install.sh` e `install.ps1` son los instaladores de curl-pipe
para usuarios finales - descargan un tarball de versión etiquetada,
configuran `ADAPTIVE_LEARNER_SECRET_KEY` y ejecutan
`docker compose up`.

Los instaladores se regeneran en el momento del lanzamiento a
partir de `install.sh.template` / `install.ps1.template` más la
versión de `backend/pyproject.toml` (ver `scripts/sync_versions.py`).
No edites los archivos generados directamente.

## Configuración para producción

Cuatro cosas importan para prod:

1. **`ADAPTIVE_LEARNER_SECRET_KEY`**: debe ser una clave Fernet
   estable. Genérala una vez, guárdala en un lugar seguro
   (HashiCorp Vault, AWS Secrets Manager, un `.env` protegido).
   Perderla significa que todas las claves API cifradas dejan de
   ser legibles. La aplicación falla de forma contundente al
   inicio si no está configurada (sin valor por defecto silencioso).
2. **`ADAPTIVE_LEARNER_CORS_ORIGINS`**: lista separada por comas
   de orígenes permitidos. El valor por defecto es permisivo;
   restríngelo para producción.
3. **`ADAPTIVE_LEARNER_DEBUG`**: déjalo sin configurar / false en
   producción. El modo de depuración expone trazas de pila en las
   respuestas de error.
4. **`ADAPTIVE_LEARNER_BIND_ADDRESS`**: por defecto `127.0.0.1`,
   así que el puerto publicado solo es accesible desde el propio
   host. La app no tiene autenticación - vincula `0.0.0.0` solo
   deliberadamente, y solo en una red de confianza o detrás de tu
   propia capa de auth (reverse proxy con basic auth, VPN).

Para contenedores, las variables de entorno son el canal de
inyección idiomático. La capa de `~/.config/adaptive_learner/secrets.yaml`
está pensada para uso en escritorio / lanzador; también puedes
montarla como bind en un contenedor si prefieres un archivo de
configuración en lugar de varias variables de entorno.

## Lanzador de escritorio

`launcher/` es un lanzador de escritorio de un solo binario
basado en PyInstaller. No es un servidor embebido: es un
envoltorio fino sobre el motor publicado `docker-app-launcher`,
configurado mediante `launcher/launcher.json`. La configuración
distribuida funciona en **modo imagen** (`deployment_mode:
"image"`): el lanzador descarga la imagen de lanzamiento ya
compilada y verificada (`ghcr.io/astrapi69/adaptive-learner:<versión>`,
fijada a la versión de la app embebida) y la inicia como
contenedor Docker (por defecto `http://localhost:8501`), con el
volumen de datos `adaptive-learner-data` montado en `/app/data`;
después abre el navegador por defecto del usuario. Nada se
compila, descarga como código fuente ni se extrae localmente.

La cadena de configuración completa de tres capas (YAML del
proyecto < capa de usuario < variables de entorno) está
documentada en `docs/configuration.md`.

## Lanzador (escritorio multiplataforma)

`launcher/` es un instalador de un solo binario basado en
PyInstaller. GitHub Actions compila tres binarios por lanzamiento:

- `launcher-linux.yml` → `adaptive-learner-launcher-linux`
- `launcher-macos.yml` → `adaptive-learner-launcher-macos`
- `launcher-windows.yml` → `adaptive-learner-launcher.exe`

Cada lanzador incrusta la versión (`__version__` literal +
`_build_info.py` escrito por el archivo spec en tiempo de
compilación). El motor además ejecuta una comprobación de
actualizaciones en segundo plano contra la API de GitHub
Releases (activada con `update_check_enabled` en
`launcher.json`); falla en silencio ante cualquier error para no
bloquear nunca el lanzador.

El lanzador no es intencionalmente el canal de distribución
principal (Docker lo es). Existe para los usuarios que quieren
una experiencia de «doble clic para instalar».

## Arquitectura de CI/CD

Cada flujo de trabajo se ejecuta de forma aislada; sin estado
compartido entre ellos:

| Flujo de trabajo | Disparador | Qué hace |
|---|---|---|
| `ci.yml` | push, pull_request | Pruebas + lint + tsc |
| `coverage.yml` | push a main | Cobertura HTML + xml |
| `release-gate.yml` | push de etiqueta | Comprobación de deriva de versiones |
| `deploy-gh-pages.yml` | push a main, despacho | Compilación + despliegue en GH Pages |
| `launcher-{linux,macos,windows}.yml` | release: created | Compilar + adjuntar binario del lanzador |
| `docs.yml` | push a main | Compilación de MkDocs (actualmente inactivo - el sitio proviene del flujo de GH Pages) |
