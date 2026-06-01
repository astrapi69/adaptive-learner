<!-- Translation: AI-generated, pending native review -->

# Camada de armazenamento

A camada de armazenamento v0.7.0 (`frontend/src/storage/`) dá ao
frontend dois backends intercambiáveis por trás de um único
contrato. O contrato cresceu para 22 espaços de nomes ao longo das
Fases 7–34.

## IStorageService

`frontend/src/storage/types.ts` define a interface que cada
implementação de armazenamento satisfaz. Espelha os espaços de
nomes `api.*` de `api/client.ts` 1:1:

```typescript
export interface IStorageService {
  readonly mode: StorageMode;
  health(): Promise<HealthInfo>;
  // Núcleo
  i18n: II18nNamespace;
  users: IUsersNamespace;
  projects: IProjectsNamespace;
  settings: ISettingsNamespace;   // get/set incluindo key_source_*
  assessment: IAssessmentNamespace;
  session: ISessionNamespace;     // inclui streamMessage()
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
  // Fase 22 — taxonomia
  subjects: ISubjectsNamespace;
  tags: ITagsNamespace;
  projectTaxonomy: IProjectTaxonomyNamespace;
  // Fase 29-32 — gamificação + exportações
  gamification: IGamificationNamespace;
  anki: IAnkiNamespace;
  notebooklm: INotebookLmNamespace;
  pronunciation: IPronunciationNamespace;
}
```

Cada página consome `IStorageService` via a fábrica `getStorage()`.
As páginas nunca importam `api/client.ts` ou a base de dados Dexie
diretamente.

## ApiStorage

`storage/api-storage.ts` é um passador fino para `api.*`. Cada
método delega 1:1. O comportamento é idêntico ao v0.6.0.

## DexieStorage

`storage/dexie-storage.ts` persiste tudo no IndexedDB via Dexie
4.4.2. O esquema em `storage/db.ts` espelha todos os 25 modelos
SQLAlchemy 1:1, mais as 4 tabelas de associação
(project_subjects / project_tags / etc.).

Submódulos em `storage/` transportam a lógica portada:

| Módulo | Responsabilidade |
|---|---|
| `assessment.ts` | Pacote de 12 perguntas + calculadora de perfil |
| `prompts.ts` | Matriz de prompt do sistema de 42 células |
| `step-evaluator.ts` | Porta de avaliação de passo com duplo prompt |
| `session-flow.ts` | Orquestração de início + mensagem |
| `tracking.ts` | Agregador + buildCommitFromSession |
| `tools.ts` | rankTools + buildSpacedRecommendations |
| `ai-providers.ts` | Clientes HTTP Anthropic/OpenAI/Gemini |

Os dados empacotados vivem em `frontend/src/data/`:

- `assessment-questions.json` — exportado verbatim da lista
  `QUESTIONS` do backend (12 perguntas × 4 respostas × 5
  idiomas).
- `session-prompts.json` — exportado verbatim do dict `_PROMPTS`
  do backend (6 métodos × 7 passos × 2 idiomas).

## Adicionar um terceiro backend de armazenamento

Implemente `IStorageService` com qualquer camada de persistência
que quiser (Supabase, Firestore, uma API REST personalizada).
Registe-a na fábrica de `storage/index.ts`:

```typescript
if (mode === "supabase") {
  cachedStorage = supabaseStorage;
}
```

Adicione o modo ao tipo `StorageMode`:

```typescript
export type StorageMode = "api" | "dexie" | "supabase";
```

Integre-o na secção de modo de armazenamento da interface de
Definições. Sem outras alterações de ficheiros — as páginas ainda
passam por `getStorage()`.

## Chamadas de IA diretas do navegador

`storage/ai-providers.ts` implementa três clientes de fornecedores:

- **Anthropic** — POST para `https://api.anthropic.com/v1/messages`
  com o cabeçalho `anthropic-dangerous-direct-browser-access: true`.
  Este é o opt-in explícito do Anthropic para chamadores do
  navegador; sem ele o CORS rejeita.
- **OpenAI** — POST para `https://api.openai.com/v1/chat/completions`
  com `Authorization: Bearer ${apiKey}`. CORS aberto por padrão.
- **Gemini** — POST para
  `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`.
  Autenticação por parâmetro de query, sem campo de sistema; as
  mensagens de sistema são dobradas no primeiro turno do utilizador.

Os três normalizam erros em `ApiError(status, "Provider: detail")`
para que o toast frontend / GitHub-Issue UX existente os renderize
sem ramificação.

## Porque as chaves de API estão em texto simples no modo Dexie?

No modo Dexie a chave de API do utilizador fica em IndexedDB em
texto simples (`UserSettings.api_key_{provider}`). Modelo de
ameaça aceitável:

- Os dados nunca saem do próprio dispositivo do utilizador.
- O fornecedor de IA É o único endpoint de rede que alguma vez vê
  a chave.
- Encriptar no IndexedDB exigiria um prompt de palavra-passe por
  sessão (hostil do ponto de vista da UX) ou uma chave fixa
  empacotada na aplicação (teatro de segurança — o atacante tem o
  pacote).

O comportamento no modo Servidor é diferente: as chaves de API
passam pela encriptação Fernet em repouso (`ADAPTIVE_LEARNER_SECRET_KEY`).
O ApiStorage nunca vê o texto simples.

Desde a v1.20.0 / Fase 34, ambos os modos também apresentam uma
atribuição de fonte por fornecedor
(`UserSettings.key_source_anthropic | openai | gemini`) para que a
interface possa renderizar "Chave de: secrets.yaml" /
"ambiente" / "Definições". No modo Dexie a fonte colapsa para
`settings` ou `none` porque a sandbox do navegador não tem acesso
ao sistema de ficheiros — `secrets.yaml` é um conceito de desktop /
modo servidor.

## Resolução de modo

`storage/index.ts` resolve o modo nesta ordem:

1. `localStorage["adaptive-learner.storage_mode"]` — escolha do
   utilizador nas Definições.
2. `VITE_STORAGE_MODE` — padrão em tempo de compilação (GH Pages
   define-o como `"dexie"`).
3. Fallback: `"api"`.

O resultado é armazenado em cache pelo tempo de vida da página. O
código de teste pode reiniciar via `_resetStorageCacheForTests()`.
