<!-- Translation: AI-generated, pending native review -->

# Testes

A disciplina de testes do AdaptiveLearner é imposta por `make test`
em cada alteração. A estratégia é uma pirâmide: testes unitários
na base, integração no meio, smoke E2E no topo.

## Contagens de testes

| Camada | Ferramenta |
|---|---|
| Backend unidade + integração | pytest ^9 |
| Testes de plugins (todos os plugins) | pytest ^9 |
| Frontend unidade + integração | Vitest 4 |
| Smoke E2E | Playwright |
| Porta de publicação em modo Dexie | Playwright |

As contagens crescem a cada versão. Para evitar números duplicados
que se dessincronizam, esta página NÃO fixa nenhum total.
`docs/audits/current-coverage.md` é a única fonte canónica e sempre
atual de contagens de testes e cobertura. Os plugins são
assessment, os fornecedores de IA (anthropic / openai / gemini /
perplexity), session, tracking, tools, gamification, anki,
notebooklm, learning-repo, content-loader e missions.

## Backend pytest

```bash
make test-backend      # todos os testes do backend
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
make test-frontend                # corre o Vitest a partir de frontend/
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
caminho `make test`; iniciam os seus próprios servidores em
portas próprias e não precisam de uma aplicação em execução. Um
`make dev` em execução não é afetado.

## Cobertura

```bash
make test-coverage   # opcional; lento + intensivo para o hardware
```

A cobertura é um relatório, não um gate de merge, por isso não corre
nos PRs. O workflow `coverage.yml` corre todas as noites (e por
dispatch); descarregue os artefactos:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

Cada plugin tem o seu próprio artefacto `<diretório-do-plugin>-coverage`,
por exemplo
`gh run download --name adaptive-learner-plugin-session-coverage`; um
plugin novo fica coberto sem alterar o workflow.

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

Os hooks estão em `.pre-commit-config.yaml`, por exemplo ruff check
(correção automática) e ruff format, verificações de espaços, YAML,
JSON e conflitos de merge, o ESLint do frontend, as verificações da
documentação (ratchet de substitutos de tremas, referências da
documentação) e `plugin-lock-paired-with-pyproject` (bloqueante):
executa `poetry check --lock` para cada plugin cujo `pyproject.toml`
ou `poetry.lock` esteja envolvido e falha quando as dependências
mudaram desde que o lock foi escrito; também corre no job de
pré-commit do CI sobre todos os ficheiros. Nesse job o hook `eslint`
é ignorado (o job de testes do frontend corre o ESLint com as
dependências instaladas). O Prettier não é um hook:
`bun run format:check` corre no job de testes do frontend, sem
bloquear até à reformatação única de #3270.

## CI

O CI divide-se em dois níveis: os gates de correção correm em cada
PR (têm de passar para o merge) e as suítes caras ou apenas de
aviso correm no turno noturno e na altura do release.

`.github/workflows/ci.yml` corre em push para `develop` / `main` e
em cada PR (Python 3.12):

1. Testes de backend (pytest)
2. Testes de plugins (`make test-plugins`, todos através do
   venv do backend)
3. Frontend: `tsc --noEmit`, ESLint (`--max-warnings 0`),
   verificação de dependências circulares, Stylelint, Vitest,
   `vite build`, `bun audit --audit-level=high` (bloqueia em
   resultados altos e críticos). Um aviso sem versão corrigida que só
   atinge uma dependência de desenvolvimento é isentado por ID em
   `frontend/audit-ignore.txt`: um ID por linha, com um comentário por
   cima que dá o motivo e quando a entrada sai.
   `make check-security` lê a mesma lista; `security-scan.yml` continua
   sem filtro.
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
Também a primeira execução de um PR é seletiva: restaura os dados do testmon que o job `testmon-seed` grava em cada push para `develop` (#3901).

Mais alguns gates de PR vivem em workflows próprios:

- `complexity-check.yml` - o gate de ratchet de complexidade
  (`make check-complexity-gate`, radon para Python + complexidade
  do ESLint para TS). É um ratchet de baseline: falha apenas em
  infratores NOVOS ou regredidos face a `.complexity-baseline`,
  pelo que bloqueia complexidade nova sem forçar uma limpeza da
  dívida pré-existente. O relatório de complexidade completo,
  apenas de aviso, corre à noite. No mesmo job corre a verificação
  do tamanho das pastas (`scripts/check-folder-size.sh` contra
  `.dirsize-baseline`); localmente `make check-folder-size` ou como
  parte de `make ci`.
- `cohesion-check.yml` - a verificação do tamanho dos ficheiros
  (gate contra `.filesize-whitelist`) mais dois gates de nomes de
  classe: nomes de classe CSS mortos (`check-dead-classnames.py`
  contra `.dead-classnames-baseline`) e o **gate de className sem
  estilo** (`--unstyled`, um ratchet contra
  `.unstyled-classnames-baseline`) - um `className` cujos tokens
  estão todos mortos bloqueia o PR.
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
- `dexie-smoke.yml` - o gate E2E do modo Dexie: em cada pull request
  que lhe diga respeito (`scripts/dexie_smoke_affected.py` decide; o
  job `Dexie smoke (required)` reporta sempre), além de diariamente,
  em `release/**` e por dispatch; localmente `make test-dexie-smoke`.
- `backup-e2e.yml` - corre nos PRs que tocam um caminho de cópias de
  segurança (por exemplo `frontend/src/storage/backup/`, as stores do
  Dexie ou os serviços de cópia de segurança do backend; a lista está
  no workflow) e executa cada `e2e/dexie/backup-*.spec.ts`, incluindo
  a ida e volta por todas as tabelas da cópia de segurança.

**Turno noturno / release (não nos PRs):**

- `coverage.yml` - relatório de cobertura (diário + dispatch)
- `security-scan.yml` - pip-audit / bun audit / bandit (semanal +
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
- `smoke-nightly.yml` - execução noturna do smoke de viewports
  móveis; as descobertas vão para um único issue de acompanhamento
- `unused-catalog-keys.yml` - relatório noturno das chaves de
  catálogo sem consumidor mais antigas do que a janela de preparação
  (`AGE_DAYS` em `frontend/src/i18n/unused-catalog-keys.ts`), num
  único issue de acompanhamento; cada chave é uma candidata e é
  verificada uma a uma antes de ser removida

`.github/workflows/release-gate.yml` corre em pushes de etiqueta:
verifica se os pins de versão estão sincronizados em todos os
ficheiros com versão (sem deriva), se os lockfiles dos plugins
correspondem e se os artefactos regenerados estão atualizados.
