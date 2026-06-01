# Visión general de la API

El backend de AdaptiveLearner expone una API REST con FastAPI. En modo
Servidor el frontend se comunica con ella; en modo Local (Dexie) la
API no está disponible: las mismas operaciones se ejecutan en el
navegador.

## URL base

- **Desarrollo local**: `http://localhost:18001/api`
- **Docker producción**: configurado por despliegue (p. ej.
  `https://yourdomain.com/api`)
- **GH Pages**: no aplica (modo Dexie)

El frontend resuelve la URL base desde `VITE_API_BASE` en tiempo
de compilación; el valor por defecto es `/api` para que el proxy del
servidor de desarrollo de Vite reenvíe de forma transparente.

## Autenticación

v1.20.0 no tiene autenticación por petición. El sistema es de un solo
usuario por navegador: un `user_id` se almacena en
`localStorage` y se pasa en las rutas de URL
(`/users/{user_id}/...`).

Las claves de los proveedores de IA se resuelven mediante una cadena
de tres capas (`services.settings.resolve_api_key`):

1. Variable de entorno `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`.
2. `ai.<provider>.api_key` en
   `~/.config/adaptive_learner/secrets.yaml`.
3. Columna `UserSettings.api_key_<provider>` cifrada con Fernet
   (configurada desde la UI de Ajustes; nunca se devuelve al frontend
   en texto plano).
4. `None`: la llamada de IA muestra un error en la UI.

`UserSettingsOut.key_source_*` (enum
`env | secrets_yaml | settings | none`) informa de qué capa resolvió
la clave activa, por proveedor, para la insignia de fuente de la UI
de Ajustes.

Una futura fase multi-usuario / multi-tenant añadirá autenticación.
Por ahora, los despliegues deben situarse detrás de su propia capa de
autenticación (proxy inverso con autenticación básica HTTP, Tailscale,
VPN, etc.) cuando se expongan a una red.

## Formato de respuesta

Las respuestas exitosas devuelven el objeto de datos directamente, sin
envoltorio:

```json
{
  "id": "abc-123",
  "topic": "Gramática española",
  "active": true
}
```

Las listas devuelven arrays JSON:

```json
[
  {"id": "p1", "topic": "Español"},
  {"id": "p2", "topic": "Cálculo"}
]
```

Códigos de estado HTTP:

| Código | Significado |
|---|---|
| 200 | OK (lectura) |
| 201 | Creado (POST) |
| 204 | Sin contenido (DELETE) |
| 400 | Error de validación (Pydantic) |
| 404 | No encontrado |
| 409 | Conflicto (poco frecuente) |
| 422 | Error de validación de Pydantic (valor por defecto de FastAPI) |
| 500 | Error del servidor |
| 502 | Servicio externo no disponible (proveedor de IA) |

## Formato de error

Los errores devuelven un único campo `detail`:

```json
{"detail": "Project abc-123 not found"}
```

Los errores de validación de Pydantic devuelven una lista estructurada:

```json
{
  "detail": [
    {"loc": ["body", "daily_minutes"], "msg": "value is not a valid integer", "type": "type_error.integer"}
  ]
}
```

En modo debug (`ADAPTIVE_LEARNER_DEBUG=true`) la respuesta
también incluye un campo `traceback`. Los despliegues en producción
deben mantener el debug desactivado.

La clase `ApiError` del frontend consume ambas formas; consulta
`frontend/src/api/client.ts` para el parser exacto.

## Grupos de endpoints

| Grupo | Prefijo | Función |
|---|---|---|
| Salud + i18n | `/health`, `/i18n/{lang}` | Estado de la app + cadenas de UI |
| Usuarios | `/users` | CRUD de usuario + proyectos anidados |
| Proyectos | `/projects` | Lecturas / actualizaciones con ámbito de proyecto |
| Ajustes | `/settings/{user_id}` | UserSettings + claves API + key_source + modelos disponibles |
| Sistema | `/system/info` | Versión, rutas, versiones de dependencias |
| Copia de seguridad | `/backup/export`, `/backup/import`, `/backup/stats` | Instantánea JSON + restauración |
| Exportación | `/export/{progress,session,curriculum}` | Informes en MD + PDF |
| Sincronización | `/sync/...` | Push, pull, resolver, emparejar |
| Importaciones | `/users/{user_id}/imports` | Importación de historial de chats + analizador |
| Materias + etiquetas | `/subjects`, `/users/{id}/tags`, `/projects/{id}/{subjects,tags}` | Taxonomía global + etiquetas por usuario |
| Plugin de evaluación | `/plugins/assessment/...` | Preguntas, evaluar, perfil |
| Plugin de sesión | `/plugins/session/...` | Inicio, mensaje + streaming, valorar, finalizar, cambio, pronunciación |
| Plugin de seguimiento | `/plugins/tracking/...` | Progreso + commits |
| Plugin de herramientas | `/plugins/tools/...` | Recomendaciones + espaciado |
| Plugin de gamificación | `/plugins/gamification/...` | XP, insignias, rachas, restablecer |
| Plugin de Anki | `/plugins/anki/...` | CRUD de fichas + extracción con IA + marcar-exportadas |
| Plugin de NotebookLM | `/plugins/notebooklm/...` | Preguntas de estudio + guía de estudio |
| Currículo | `/users/{user_id}/curricula`, `/curricula/{id}` | CRUD de currículo + temas + lecciones |
| Descubrimiento de plugins | `/plugins/manifests`, `/plugins/health`, `/plugins/errors` | Qué está registrado |

Consulta [Endpoints principales](core-endpoints.md) y
[Endpoints de plugins](plugin-endpoints.md) para la lista completa de
métodos con ejemplos de petición / respuesta.

## OpenAPI / Swagger

FastAPI genera automáticamente una especificación OpenAPI 3.1 a partir
de los esquemas Pydantic. En modo dev:

- **Swagger UI**: `http://localhost:18001/api/docs`
- **Redoc**: `http://localhost:18001/api/redoc`
- **JSON OpenAPI sin procesar**: `http://localhost:18001/api/openapi.json`

Estas son las referencias autoritativas para la forma exacta de cada
endpoint. Las páginas Markdown aquí son un subconjunto seleccionado
para mayor legibilidad.

## Paginación

Los endpoints no paginan en v1.20.0. El conjunto de datos es de un
solo usuario y pequeño; la lista más larga (sesiones por proyecto) llega
a cientos, no a miles. Una futura fase añadirá paginación basada en
cursores si el volumen de datos crece.

## Versiones

La API no tiene prefijo de versión en la URL. Los cambios que rompen
la compatibilidad aterrizan en los límites de versión mayor de semver;
el CHANGELOG documenta qué se movió.
