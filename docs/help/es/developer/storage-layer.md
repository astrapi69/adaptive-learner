# Capa de almacenamiento

La capa de almacenamiento v0.7.0 (`frontend/src/storage/`) le da
al frontend dos backends intercambiables detrás de un único
contrato. El contrato ha crecido hasta 22 espacios de nombres a
lo largo de las Fases 7–34.

## IStorageService

`frontend/src/storage/types.ts` define la interfaz que satisface
cada implementación de almacenamiento. Refleja los espacios de
nombres `api.*` de `api/client.ts` en una correspondencia 1:1:

```typescript
export interface IStorageService {
  readonly mode: StorageMode;
  health(): Promise<HealthInfo>;
  // Núcleo
  i18n: II18nNamespace;
  users: IUsersNamespace;
  projects: IProjectsNamespace;
  settings: ISettingsNamespace;   // get/set including key_source_*
  assessment: IAssessmentNamespace;
  session: ISessionNamespace;     // includes streamMessage()
  tracking: ITrackingNamespace;
  tools: IToolsNamespace;
  curricula: ICurriculaNamespace;
  topics: ITopicsNamespace;
  lessons: ILessonsNamespace;
  plugins: IPluginsNamespace;
  system: ISystemNamespace;
  // Fase 12+
  backup: IBackupNamespace;
  export: IExportNamespace;
  imports: IImportsNamespace;
  // Fase 22 - taxonomía
  subjects: ISubjectsNamespace;
  tags: ITagsNamespace;
  projectTaxonomy: IProjectTaxonomyNamespace;
  // Fases 29-32 - gamificación + exportaciones
  gamification: IGamificationNamespace;
  anki: IAnkiNamespace;
  notebooklm: INotebookLmNamespace;
  pronunciation: IPronunciationNamespace;
}
```

Cada página consume `IStorageService` mediante la factoría
`getStorage()`. Las páginas nunca importan `api/client.ts` ni la
base de datos Dexie directamente.

## ApiStorage

`storage/api-storage.ts` es un paso directo ligero hacia `api.*`.
Cada método delega en una correspondencia 1:1. El comportamiento
es idéntico al de v0.6.0.

## DexieStorage

`storage/dexie-storage.ts` persiste todo en IndexedDB mediante
Dexie 4.4.2. El esquema en `storage/db.ts` refleja los 25 modelos
SQLAlchemy en una correspondencia 1:1, más las 4 tablas de
asociación (project_subjects / project_tags / etc.).

Los submódulos bajo `storage/` llevan la lógica portada:

| Módulo | Responsabilidad |
|---|---|
| `assessment.ts` | Paquete de 12 preguntas + calculadora del perfil |
| `prompts.ts` | Matriz de prompts del sistema de 42 celdas |
| `step-evaluator.ts` | Puerto del evaluador de pasos de doble prompt |
| `session-flow.ts` | Orquestación de inicio + mensaje |
| `tracking.ts` | Agregador + buildCommitFromSession |
| `tools.ts` | rankTools + buildSpacedRecommendations |
| `ai-providers.ts` | Clientes HTTP Anthropic/OpenAI/Gemini |

Los datos incluidos viven en `frontend/src/data/`:

- `assessment-questions.json` - exportado literalmente de la
  lista `QUESTIONS` del backend (12 preguntas × 4 respuestas ×
  5 idiomas).
- `session-prompts.json` - exportado literalmente del diccionario
  `_PROMPTS` del backend (6 métodos × 7 pasos × 2 idiomas).

## Añadir un tercer backend de almacenamiento

Implementa `IStorageService` con la capa de persistencia que
quieras (Supabase, Firestore, una API REST personalizada).
Regístralo en la factoría de `storage/index.ts`:

```typescript
if (mode === "supabase") {
  cachedStorage = supabaseStorage;
}
```

Añade el modo al tipo `StorageMode`:

```typescript
export type StorageMode = "api" | "dexie" | "supabase";
```

Conéctalo a la sección de modo de almacenamiento de la interfaz
de Ajustes. No se necesitan otros cambios de archivo - las páginas
siguen usando `getStorage()`.

## Llamadas a la IA directas desde el navegador

`storage/ai-providers.ts` implementa tres clientes de proveedor:

- **Anthropic** - POST a `https://api.anthropic.com/v1/messages`
  con el encabezado `anthropic-dangerous-direct-browser-access: true`.
  Este es el opt-in explícito de Anthropic para llamadores desde
  el navegador; sin él CORS rechaza.
- **OpenAI** - POST a `https://api.openai.com/v1/chat/completions`
  con `Authorization: Bearer ${apiKey}`. CORS abierto por defecto.
- **Gemini** - POST a
  `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`.
  Autenticación por parámetro de consulta, sin campo system; los
  mensajes del sistema se pliegan en el primer turno del usuario.

Los tres normalizan los errores en `ApiError(status, "Proveedor: detalle")`
para que la interfaz de toast / Issue de GitHub existente los
renderice sin bifurcaciones.

## ¿Por qué claves API en texto claro en el modo Dexie?

En el modo Dexie la clave API del usuario se guarda en texto
claro en IndexedDB (`UserSettings.api_key_{proveedor}`). Modelo
de amenaza aceptable:

- Los datos nunca salen del propio dispositivo del usuario.
- El proveedor de IA es el ÚNICO endpoint de red que ve la clave.
- Cifrar en IndexedDB requeriría una contraseña por sesión (hostil
  para la UX) o una clave fija incluida en la aplicación (teatro
  de seguridad - el atacante tiene el paquete).

El comportamiento en modo Servidor es diferente: las claves API
pasan por el cifrado Fernet en reposo (`ADAPTIVE_LEARNER_SECRET_KEY`).
ApiStorage nunca ve el texto claro.

Desde v1.20.0 / Fase 34, ambos modos también muestran una
atribución de origen por proveedor
(`UserSettings.key_source_anthropic | openai | gemini`) para que
la interfaz pueda mostrar «Clave de: secrets.yaml» / «entorno» /
«Ajustes». En el modo Dexie el origen se reduce a `settings` o
`none` porque el sandbox del navegador no tiene acceso al sistema
de archivos - `secrets.yaml` es un concepto de escritorio /
modo servidor.

## Resolución de modo

`storage/index.ts` resuelve el modo en este orden:

1. `localStorage["adaptive-learner.storage_mode"]` - elección del
   usuario desde Ajustes.
2. `VITE_STORAGE_MODE` - valor por defecto en tiempo de
   compilación (GH Pages lo establece en `"dexie"`).
3. Fallback: `"api"`.

El resultado se almacena en caché durante la vida de la página.
El código de prueba puede reiniciarlo mediante
`_resetStorageCacheForTests()`.
