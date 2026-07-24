<!-- Translation: AI-generated, pending native review -->

# Testes

A disciplina de testes do AdaptiveLearner é imposta por `make test`
em cada alteração. A estratégia é uma pirâmide: testes unitários
na base, integração no meio, smoke E2E no topo.

## Contagens de testes

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
testes é rigoroso - `ADAPTIVE_LEARNER_TEST=1` é definido antes de
qualquer importação de `app.*`.

## Testes de plugins

Cada plugin tem o seu próprio diretório `tests/`:

```bash
make test-plugins              # todos os 7
make test-plugin-session       # apenas um
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

Os testes de plugins não carregam a aplicação FastAPI - exercitam
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

Cada teste obtém um IndexedDB fresco em memória - sem fugas.

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

As especificações usam apenas seletores `data-testid` - sem
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
check-merge-conflict. Apenas backend - o lint do frontend corre
em tempo de CI, não em pré-commit.

## CI

O CI divide-se em dois níveis: os gates de correção correm em cada
PR (têm de passar para o merge) e as suítes caras ou apenas de
aviso correm no turno noturno e na altura do release.

`.github/workflows/ci.yml` corre em push para `develop` / `main` e
em cada PR (Python 3.12):

1. Testes de backend (pytest)
2. Testes de plugins (`make test-plugins`, todos os 13 através do
   venv do backend)
3. Frontend: `tsc --noEmit`, ESLint (`--max-warnings 0`),
   verificação de dependências circulares, Stylelint, Vitest,
   `vite build`, `npm audit`
4. Hooks de pré-commit em todos os ficheiros
5. Backend ruff + mypy + pip-audit
6. Verificador de deriva da documentação (`verify_docs.py` +
   sincronização do nav do mkdocs)

**Test Impact Analysis (#615):** num PR correm apenas os testes
impactados - `vitest run --changed origin/<base>` e
`pytest --testmon`. Push para `develop` / `main`, as execuções
noturnas e as execuções de release correm sempre a suíte COMPLETA.
O fallback para a suíte completa é automático (ref de base não
resolúvel, ou um cache miss do testmon).

Mais alguns gates de PR vivem em workflows próprios:

- `complexity-check.yml` - o gate de ratchet de complexidade
  (`make check-complexity-gate`, radon para Python + complexidade
  do ESLint para TS). É um ratchet de baseline: falha apenas em
  infratores NOVOS ou regredidos face a `.complexity-baseline`,
  pelo que bloqueia complexidade nova sem forçar uma limpeza da
  dívida pré-existente. O relatório de complexidade completo,
  apenas de aviso, corre à noite.
- `cohesion-check.yml` - a verificação do tamanho dos ficheiros
  (gate contra `.filesize-whitelist`) mais dois gates de nomes de
  classe: nomes de classe CSS mortos (`check-dead-classnames.py`
  contra `.dead-classnames-baseline`) e o **gate de className sem
  estilo** (`--unstyled`, um ratchet contra
  `.unstyled-classnames-baseline`) - um `className` cujos tokens
  estão todos mortos bloqueia o PR. A verificação do tamanho das
  pastas que o acompanha corre localmente via
  `make check-folder-size`.
- `visual-baseline-gate.yml` - um PR que altera caminhos
  visualmente críticos (componentes de lição, renderers de
  exercícios, ficheiros de tema/CSS) tem de trazer os screenshots
  de baseline afetados no mesmo PR; label de escape
  `visual-baselines-unaffected` para alterações comprovadamente
  inertes.
- `testid-reference-gate.yml` - se um PR remove ou renomeia um
  `data-testid` que um spec E2E referencia estaticamente (numa
  superfície muito visível para o utilizador) sem tocar no spec,
  o gate falha (`make check-testid-refs`); label de escape
  `testid-refs-unaffected`.
- `docker-build-smoke.yml` - smoke só de build das imagens
  Compose de produção (o caminho do launcher / install.sh),
  filtrado por caminhos nos PRs, além de em `release/**`,
  semanalmente e por dispatch; localmente
  `make docker-build-smoke`.

**Turno noturno / release (não nos PRs):**

- `dexie-smoke.yml` - o gate E2E do modo Dexie (diário + em
  `release/**` + dispatch; localmente `make test-dexie-smoke`)
- `coverage.yml` - relatório de cobertura (diário + dispatch)
- `security-scan.yml` - pip-audit / npm audit / bandit (semanal +
  em `release/**` + dispatch; apenas aviso)
- `content-stats.yml` - deriva das estatísticas de conteúdo face a
  um checkout fresco do conteúdo (diário + dispatch)
- `mutation-frontend.yml` - mutation testing com Stryker (noturno
  atrás da variável de repo `ENABLE_NIGHTLY_MUTATION` + dispatch;
  cada execução muta uma fatia dos ficheiros para caber no limite
  de tempo do job); o mutation testing do backend usa mutmut
- `webkit-gate.yml` - o gate de layout no motor WebKit real
  (classes de bugs de iOS/Safari que os gates Chromium
  estruturalmente não conseguem ver), diário atrás da variável de
  repo `ENABLE_NIGHTLY_WEBKIT`, sempre em `release/**` e por
  dispatch
- `visual-regression.yml` - a matriz de baselines visuais (diária
  + dispatch; `update_baselines=true` volta a renderizar as
  baselines no CI e carrega-as como artefacto)
- `visual-baseline-sync.yml` - workflow de serviço: renderiza as
  baselines no CI e faz push delas como commit para o branch do
  PR (label `refresh-visual-baselines`, ou dispatch com um número
  de PR) - a revisão das imagens antes do merge continua
  obrigatória

`.github/workflows/release-gate.yml` corre em pushes de etiqueta:
verifica se os pins de versão estão sincronizados em todos os
ficheiros com versão (sem deriva), se os lockfiles dos plugins
correspondem e se os artefactos regenerados estão atualizados.
