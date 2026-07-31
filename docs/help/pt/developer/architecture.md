<!-- Translation: AI-generated, pending native review -->

# Arquitetura

O Adaptive Learner é uma aplicação orientada a plugins com 4 camadas.

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
│ PluginForge        ^0.10.0 (PyPI externo; com restrição de  │
│                    identidade via target_application)       │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ entry_points
┌─────────────────────────────────────────────────────────────┐
│ Plugins            10 pacotes em plugins/                   │
│                    (ai-{anthropic,openai,gemini}, assessment,│
│                    session, tracking, tools, gamification,  │
│                    anki, notebooklm)                        │
└─────────────────────────────────────────────────────────────┘
```

Novas funcionalidades pertencem SEMPRE a um plugin, exceto se
tocarem no núcleo (utilizadores / projetos / definições /
currículo / tópicos / lições / backup / sincronização / sistema /
importação).

## Armazenamento duplo (v0.7.0)

O frontend tem uma única costura onde o armazenamento é escolhido:
`getStorage(): IStorageService`. Duas implementações satisfazem um
contrato:

- **`apiStorage`** (padrão): invólucro fino em torno de
  `api/client.ts` que comunica com o backend FastAPI.
- **`dexieStorage`** (local primeiro): pilha IndexedDB completa
  espelhando todos os 25 modelos SQLAlchemy. As chamadas de IA
  disparam diretamente do navegador via `storage/ai-providers.ts`.

`IStorageService` expõe 22 espaços de nomes (users, projects,
settings, assessment, session com streaming, tracking, tools,
curricula, topics, lessons, plugins, system, backup, export,
subjects, tags, projectTaxonomy, imports, gamification, anki,
pronunciation, notebooklm). Ambos os backends implementam cada
método.

A fábrica lê `localStorage["adaptive-learner.storage_mode"]`, depois
`VITE_STORAGE_MODE` (definido pela compilação para GH Pages), e
depois usa `api` como padrão. Mudar de modo não é uma troca em
tempo real: a página de Definições persiste a escolha e notifica
com um toast de recarregamento necessário.

## Segredos em três camadas (v1.20.0 / Fase 34)

```
variáveis de ambiente  > secrets.yaml         > coluna DB Fernet
ADAPTIVE_LEARNER_*       ~/.config/...yaml      api_key_<provider>
```

Cada chamada de IA percorre a cadeia via
`services/settings.resolve_api_key`:

1. Variável de ambiente `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`.
2. `ai.<provider>.api_key` em
   `~/.config/adaptive_learner/secrets.yaml`.
3. Coluna DB desencriptada com Fernet.
4. `None` - a chamada de IA apresenta um erro na interface.

A atribuição de fonte vive em `UserSettingsOut.key_source_*`
(enum: `env` / `secrets_yaml` / `settings` / `none`).
A interface de Definições desativa Guardar / Remover quando a
fonte é env ou secrets_yaml.

A mesma cadeia aplica-se às substituições `default_model` por
fornecedor; `secrets.yaml` ganha sobre a substituição da interface
por design da Fase 34 (configuração em ficheiro ganha sobre a
interface para utilizadores avançados).

## Estrutura de plugins

```
plugins/adaptive-learner-plugin-<name>/
  adaptive_learner_<name>/
    plugin.py     # <Name>Plugin(BasePlugin), implementações de hooks
    routes.py     # roteador FastAPI (delega para funções de serviço)
    <module>.py   # lógica de negócio
  tests/
    test_*.py     # testes pytest
  pyproject.toml  # ponto de entrada: [project.entry-points."adaptive_learner.plugins"]
```

- A classe Plugin herda de `BasePlugin` (pluginforge).
- A lógica de negócio vive nos seus próprios módulos, NÃO em routes.py.
- routes.py contém apenas endpoints FastAPI que delegam.
- As especificações de hooks vivem em `backend/app/hookspecs.py`.
- Dependências do plugin como atributo de classe: `depends_on =
  ["session"]`.
- Todos os plugins são gratuitos (MIT). Não existe uma camada de licenciamento.

## Hooks (8 especificações em `backend/app/hookspecs.py`)

| Hook | Quando | Primeiro resultado? |
|---|---|---|
| `get_assessment_questions(lang)` | Carregamento da página de Avaliação | sim |
| `calculate_profile(answers)` | Submissão da Avaliação | sim |
| `create_session_prompt(...)` | Cada turno de chat | sim |
| `ai_complete(messages, model, api_key, max_tokens)` | Chamada de IA padrão | sim (rotas por prefixo de modelo) |
| `ai_complete_async(...)` | Avaliação paralela em limite de ciclo (v1.5.0) | sim |
| `ai_complete_stream(...)` | Resposta de sessão em streaming (v1.6.0) | sim |
| `recommend_method_switch(...)` | Dashboard + Sessão | sim |
| `on_session_complete(session, rating)` | Fim de sessão | broadcast |
| `get_progress_summary(project_id)` | Widgets do Dashboard | broadcast |
| `get_tool_recommendations(profile, lang)` | Ferramentas do Dashboard | broadcast |

## Fluxo de dados

```
Interface (React) → IStorageService
            → (modo API) roteador FastAPI → serviço → SQLAlchemy → SQLite
            → (modo Dexie) tabela Dexie → IndexedDB
            ↓
            Orquestrador de IA → resolve_api_key (env > yaml > BD)
                              → pluginforge → plugin do fornecedor ai_complete*
                              → SDK Anthropic / OpenAI / Gemini
```

Unidirecional. Sem acesso direto à BD a partir dos roteadores (os
serviços possuem o trabalho SQLAlchemy). Sem código frontend no
backend.

## Tratamento de erros

```
Frontend       ApiError (status + detail) → toast para o utilizador
Cliente API    Erro HTTP → convertido em ApiError
Roteador       Fino, não captura nada. O gestor global de exceções mapeia.
Serviço        Lança subclasses de AdaptiveLearnerError
Plugin         Lança PluginError(plugin_name, message)
Externo        ExternalServiceError(service, message) para SDKs de fornecedores
```

Os serviços NUNCA lançam `HTTPException`; os roteadores não capturam
NADA. O gestor global de exceções em `main.py` mapeia erros de
domínio para códigos de estado HTTP. Consulte
`.claude/rules/code-hygiene.md` para o padrão completo.

## Persistência

- Backend: SQLAlchemy + SQLite. Migrações Alembic em
  `backend/migrations/versions/`.
- Superfície de sincronização: 28 tabelas (linha de base v1.19.0).
  Linhas de histórico somente-adição (sessões, mensagens,
  classificações, commits de progresso, avaliações de passo,
  mudanças de método, conversas importadas, mensagens importadas,
  cartões anki, questões de estudo) mais definições mutáveis +
  linhas de currículo.
- Formato de backup: JSON; chaves de API removidas na exportação;
  a restauração é uma fusão.
- Isolamento de testes: os diretórios de dados de produção têm um
  marcador `.adaptive-learner-production`; se um teste o vir, a
  execução aborta com `pytest.exit(returncode=2)`.

## Temas

5 temas (Classic, Cool Modern, Nord, Notebook, Studio) ×
claro/escuro = 10 variantes. Variáveis CSS em todo o lado; sem
Tailwind. Propriedades personalizadas em
`frontend/src/styles/global.css`. Novos elementos de interface
DEVEM usar o conjunto de variáveis.

## Mobile / PWA

`@media (max-width: 768px)` é o ponto de corte canonical para
mobile (gaveta de hamburger, alvos de toque de 44×44, layouts
empilhados). `@media (max-width: 360px)` é a rede de segurança
para ecrãs muito estreitos. Estilos de desktop ≥769px sem
alterações.

Service worker (Workbox via vite-plugin-pwa): NetworkFirst em
GET `/api/` com timeout de 4s, LRU de 24h, limite de 60 entradas.
`/api/` mutante é NetworkOnly.
