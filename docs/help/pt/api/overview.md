<!-- Translation: AI-generated, pending native review -->

# Visão geral da API

O backend do AdaptiveLearner expõe uma API REST FastAPI. No modo
Servidor, o frontend comunica com ela; no modo Local (Dexie) a API
não é acessível — as mesmas operações correm no navegador.

## URL base

- **Desenvolvimento local**: `http://localhost:18001/api`
- **Docker prod**: configurado por implementação (p.ex.
  `https://yourdomain.com/api`)
- **GH Pages**: não aplicável (modo Dexie)

O frontend resolve o URL base de `VITE_API_BASE` no momento da
compilação; o padrão é `/api` para que o proxy do servidor de
desenvolvimento Vite encaminhe de forma transparente.

## Autenticação

A v1.20.0 não tem autenticação por pedido. O sistema é de
utilizador único por navegador: um `user_id` é armazenado em
`localStorage` e passado nos caminhos URL (`/users/{user_id}/...`).

As chaves de fornecedor de IA são resolvidas via uma cadeia de
três camadas (`services.settings.resolve_api_key`):

1. Variável de ambiente `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`.
2. `ai.<provider>.api_key` em
   `~/.config/adaptive_learner/secrets.yaml`.
3. Coluna Fernet-encriptada `UserSettings.api_key_<provider>`
   (definida via a interface de Definições; nunca retornada ao
   frontend em texto simples).
4. `None` — a chamada de IA apresenta um erro na interface.

`UserSettingsOut.key_source_*` (enum `env | secrets_yaml |
settings | none`) informa qual camada resolveu a chave ativa,
por fornecedor, para o emblema de fonte da interface de Definições.

Uma futura fase multi-utilizador / multi-tenant irá adicionar
autenticação. Por enquanto, as implementações devem ficar por
trás da sua própria camada de autenticação (proxy reverso com
HTTP basic auth, Tailscale, VPN, etc.) quando expostas a uma rede.

## Formato de resposta

As respostas com sucesso retornam o objeto de dados diretamente,
sem envelope:

```json
{
  "id": "abc-123",
  "topic": "Gramática espanhola",
  "active": true
}
```

As listas retornam arrays JSON:

```json
[
  {"id": "p1", "topic": "Espanhol"},
  {"id": "p2", "topic": "Cálculo"}
]
```

Códigos de estado HTTP:

| Código | Significado |
|---|---|
| 200 | OK (leitura) |
| 201 | Criado (POST) |
| 204 | Sem conteúdo (DELETE) |
| 400 | Erro de validação (Pydantic) |
| 404 | Não encontrado |
| 409 | Conflito (raro) |
| 422 | Erro de validação Pydantic (padrão FastAPI) |
| 500 | Erro do servidor |
| 502 | Serviço externo inacessível (fornecedor de IA) |

## Formato de erro

Os erros retornam um único campo `detail`:

```json
{"detail": "Project abc-123 not found"}
```

Os erros de validação Pydantic retornam uma lista estruturada:

```json
{
  "detail": [
    {"loc": ["body", "daily_minutes"], "msg": "value is not a valid integer", "type": "type_error.integer"}
  ]
}
```

No modo de depuração (`ADAPTIVE_LEARNER_DEBUG=true`) a resposta
também inclui um campo `traceback`. As implementações de produção
devem deixar a depuração desligada.

A classe `ApiError` do frontend consome ambas as formas — consulte
`frontend/src/api/client.ts` para o analisador exato.

## Grupos de endpoints

| Grupo | Prefixo | O que faz |
|---|---|---|
| Saúde + i18n | `/health`, `/i18n/{lang}` | Saúde da aplicação + strings de interface |
| Utilizadores | `/users` | CRUD de utilizadores + projetos aninhados |
| Projetos | `/projects` | Leituras / atualizações com âmbito de projeto |
| Definições | `/settings/{user_id}` | UserSettings + chaves de API + key_source + modelos disponíveis |
| Sistema | `/system/info` | Versão, caminhos, versões de dependências |
| Backup | `/backup/export`, `/backup/import`, `/backup/stats` | Instantâneo JSON + restauração |
| Exportação | `/export/{progress,session,curriculum}` | Relatórios MD + PDF |
| Sincronização | `/sync/...` | Envio, receção, resolução, emparelhamento |
| Importações | `/users/{user_id}/imports` | Importação de historial de chat + analisador |
| Assuntos + etiquetas | `/subjects`, `/users/{id}/tags`, `/projects/{id}/{subjects,tags}` | Taxonomia global + etiquetas por utilizador |
| Plugin Assessment | `/plugins/assessment/...` | Perguntas, avaliar, perfil |
| Plugin Session | `/plugins/session/...` | Iniciar, mensagem + streaming, classificar, terminar, mudar, pronúncia |
| Plugin Tracking | `/plugins/tracking/...` | Progresso + commits |
| Plugin Tools | `/plugins/tools/...` | Recomendações + espaçado |
| Plugin Gamification | `/plugins/gamification/...` | XP, emblemas, sequências, reiniciar |
| Plugin Anki | `/plugins/anki/...` | CRUD de cartões + extração por IA + marcar-exportado |
| Plugin NotebookLM | `/plugins/notebooklm/...` | Questões de estudo + guia de estudo |
| Currículo | `/users/{user_id}/curricula`, `/curricula/{id}` | CRUD de Currículo + tópicos + lições |
| Descoberta de plugins | `/plugins/manifests`, `/plugins/health`, `/plugins/errors` | O que está registado |

Consulte [Endpoints principais](core-endpoints.md) e
[Endpoints de plugins](plugin-endpoints.md) para a lista completa
de métodos com exemplos de pedido / resposta.

## OpenAPI / Swagger

O FastAPI gera automaticamente uma especificação OpenAPI 3.1 a
partir dos esquemas Pydantic. No modo de desenvolvimento:

- **Swagger UI**: `http://localhost:18001/api/docs`
- **Redoc**: `http://localhost:18001/api/redoc`
- **JSON OpenAPI bruto**: `http://localhost:18001/api/openapi.json`

Estas são a referência autoritária para a forma exata de cada
endpoint. As páginas Markdown aqui são um subconjunto selecionado
para legibilidade.

## Paginação

Os endpoints não paginam na v1.20.0. O conjunto de dados é de
utilizador único e pequeno; a maior lista (sessões por projeto)
atinge centenas, não milhares. Uma fase futura adicionará
paginação baseada em cursor se a forma dos dados crescer.

## Versões

A API não tem prefixo de versão no URL. As alterações
incompatíveis chegam nos limites de semver-major; o CHANGELOG
documenta o que foi movido.
