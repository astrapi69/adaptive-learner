<!-- Translation: AI-generated, pending native review -->

# Testes

A disciplina de testes do AdaptiveLearner é imposta por `make test`
em cada alteração. A estratégia é uma pirâmide: testes unitários
na base, integração no meio, smoke E2E no topo.

## Contagens de testes (v1.20.0)

| Camada | Contagem | Ferramenta |
|---|---|---|
| Backend unidade + integração | 786 | pytest ^9 |
| Testes de plugins (10 plugins) | 615 | pytest ^9 |
| Frontend unidade + integração | 1233 | Vitest 4 |
| Smoke E2E | 16 ficheiros de especificação | Playwright |
| **Total (`make test`)** | **2634** | |

Distribuição por plugins: assessment 110 + ai-anthropic 34 +
ai-openai 31 + ai-gemini 33 + session 215 + tracking 64 +
tools 58 + gamification 23 + anki 20 + notebooklm 27.

## Backend pytest

```bash
make test-backend      # 786 testes, ~35s
cd backend && poetry run pytest -k "test_session" -v
cd backend && poetry run pytest --pdb
```

Os testes vivem em `backend/tests/`. As fixtures em `conftest.py`
fornecem uma BD SQLite fresca em memória por teste, o
`TestClient` e um gestor de plugins simulado. O isolamento de
testes é rigoroso — `ADAPTIVE_LEARNER_TEST=1` é definido antes de
qualquer importação de `app.*`.

## Testes de plugins

Cada plugin tem o seu próprio diretório `tests/`:

```bash
make test-plugins              # todos os 7
make test-plugin-session       # apenas um
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

Os testes de plugins não carregam a aplicação FastAPI — exercitam
os módulos do plugin em isolamento. Simule o `pluggy.PluginManager`
ao testar o disparo de hooks.

## Frontend Vitest

```bash
make test-frontend                # 387 testes, ~2s
cd frontend && bunx vitest         # modo de observação
cd frontend && bunx vitest run src/storage/  # um diretório
```

Os testes vivem ao lado da fonte: `Component.test.tsx` ao lado de
`Component.tsx`. happy-dom é o ambiente; React 19 + RTL.

## Padrões de simulação

**Fornecedores de IA**: simular `global.fetch` e assertar no URL,
cabeçalhos, corpo:

```typescript
beforeEach(() => {
  global.fetch = vi.fn(async (input, init) => {
    calls.push({url, method, body});
    return new Response(JSON.stringify({content: [{type: "text", text: "hi"}]}), {status: 200});
  });
});
```

**fake-indexeddb**: no topo de cada ficheiro de teste Dexie:

```typescript
import "fake-indexeddb/auto";

beforeEach(async () => {
  await _resetDbForTests();
  const {IDBFactory} = await import("fake-indexeddb");
  (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
});
```

Cada teste obtém um IndexedDB fresco em memória — sem fugas.

**Simulações de api/client.ts** (páginas legadas):

```typescript
vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {...actual, api: {...actual.api, users: {...actual.api.users, get: apiGetMock}}};
});
```

A página importa `getStorage()`, que delega para ApiStorage, que
delega para `api.*`. A simulação entra na camada `api.*` e ainda
dispara através da pilha de armazenamento.

## Playwright E2E

```bash
cd e2e && npx playwright test
cd e2e && npx playwright test --ui   # interativo
cd e2e && npx playwright test smoke/mobile-viewports.spec.ts
```

As especificações smoke cobrem os caminhos críticos do utilizador:

- Seletor de idioma na landing + formulário de integração
- Avaliação de 12 perguntas + renderização do radar
- Início + fim + classificação de sessão
- Definições idioma + chave de API
- Criação de currículo
- Viewports mobile (iPhone SE, iPhone 14, Pixel 7, iPad)

As especificações usam apenas seletores `data-testid` — sem
seletores CSS frágeis. As especificações smoke NÃO estão no
caminho `make test`; precisam de uma aplicação em execução
(primeiro `make dev-bg`).

## Cobertura

```bash
make test-coverage   # opcional; lento + intensivo para o hardware
```

A cobertura corre no CI para cada push para main; descarregue os
artefactos:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

Metas por `.claude/rules/quality-checks.md`:

- Serviços + lógica de negócio: mínimo 95%
- Endpoints de API: mínimo 90%
- Componentes frontend com lógica: mínimo 85%
- Hooks + utilitários: mínimo 95%

Global: 85-95% em todo o projeto.

## Pré-commit

```bash
cd backend && poetry run pre-commit install
```

Hooks: ruff check (correção automática), ruff format, espaços em
branco finais, corretor de fim de ficheiro, check-yaml,
check-merge-conflict. Apenas backend — o lint do frontend corre
em tempo de CI, não em pré-commit.

## CI

`.github/workflows/ci.yml` corre em cada push para main + cada PR:

1. Testes de backend (matriz Python 3.12 + 3.13)
2. Testes de plugins (um job por plugin; estratégia de matriz)
3. Frontend Vitest + tsc + lint
4. ruff check + verificação de formato

`.github/workflows/release-gate.yml` corre em pushes de etiqueta:
verifica se os pins de versão estão sincronizados (sem deriva em
12 ficheiros), se os lockfiles dos plugins correspondem, se os
artefactos regenerados estão atualizados.
