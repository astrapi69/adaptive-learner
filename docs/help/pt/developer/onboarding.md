<!-- Translation: AI-generated, pending native review -->

# Integração: a sua primeira correção de bug

Um percurso prático, passo a passo, para um novo contribuidor. Ao
contrário das páginas [Arquitetura](architecture.md) e
[Configuração de desenvolvimento](setup.md) (que explicam *o que* o
sistema é), esta página acompanha-o a *fazer* a sua primeira correção
de bug de ponta a ponta, desde um clone fresco até um pull request
integrado.

## 1. Configurar o ambiente de desenvolvimento

Pré-requisitos: **Python 3.12** (a restrição do backend é `~3.12`),
**Node 24+** (exigido pelo Vite 8), **Poetry**, **Bun**
e **GNU Make**.

```bash
# Clone
git clone https://github.com/astrapi69/adaptive-learner.git
cd adaptive-learner

# Install everything: Poetry backend + plugin path-deps + Bun frontend
make install

# Establish a green baseline before you change anything
make test

# Run the app (backend on :18001, frontend on :15174)
make dev
```

O servidor de desenvolvimento do frontend corre em
**http://localhost:15174**, o backend em **http://localhost:18001**.
Ambas as portas podem ser substituídas através de
`ADAPTIVE_LEARNER_FRONTEND_PORT` / `ADAPTIVE_LEARNER_PORT`. Prima
Ctrl-C uma vez para parar ambos.

Se `make install` falhar, o culpado habitual é o Poetry a escolher o
Python errado: execute `poetry env use python3.12` em `backend/` e
reinstale. Para a cadeia completa de configuração (segredos, chaves de
IA, a obrigatória `ADAPTIVE_LEARNER_SECRET_KEY`) veja
[Configuração de desenvolvimento](setup.md).

## 2. Encontrar um bug

As issues são a fila de trabalho. Cada correção precisa de uma issue
**primeiro** (`GITHUB-ISSUE-PFLICHT`).

```bash
# Open bug issues
gh issue list --label bug --state open
```

Ou no GitHub:
<https://github.com/astrapi69/adaptive-learner/issues?q=is%3Aissue+is%3Aopen+label%3Abug>

Escolha algo pequeno para começar: procure `good first issue` ou um
`bug` de pouco esforço. Se não existir issue para o bug que encontrou,
**crie uma antes de tocar no código**, e abra uma issue *separada* para
qualquer novo bug que descubra pelo caminho.

## 3. Compreender a issue

- Leia a descrição e reproduza o bug localmente.
- Anote em que modo de armazenamento ocorre. O Adaptive Learner traz
  **armazenamento duplo** (API/SQLite *e* Dexie/IndexedDB); um bug pode
  viver num modo, no outro, ou em ambos. Veja
  [Camada de armazenamento](storage-layer.md).
- Se não o conseguir reproduzir, pergunte na issue em vez de adivinhar.

## 4. Criar um ramo

O Adaptive Learner usa **gitflow**: `develop` é o ramo ativo; `main`
contém apenas releases. Crie o ramo *a partir de* `develop` e abra o
seu PR *contra* `develop`.

```bash
git checkout develop
git pull origin develop
git checkout -b fix/short-description
```

Nomes de ramos:

| Prefixo | Para |
|---|---|
| `fix/...` | correções de bugs |
| `feature/...` | novas funcionalidades |
| `refactor/...` | refatorações |
| `docs/...` | documentação |
| `chore/...` | ferramentas / manutenção |

## 5. Corrigir o bug

Dicas para encontrar o código:

```bash
# Search by an error string / symbol (use ripgrep)
rg "the error message" frontend/src backend/app
```

- Erros do frontend: abra a consola das DevTools do navegador.
- `cd frontend && bunx vitest --watch <file>` dá feedback de testes em
  tempo real enquanto edita (execute sempre o vitest a partir de
  `frontend/`, não da raiz do repo).
- **Estilos: apenas classes utilitárias Tailwind**, sem estilos de cor
  inline e sem novas regras em `global.css`. As cores passam por
  design tokens (variáveis CSS); veja [Sistema de temas](themes.md).
- **Ambos os modos de armazenamento têm de continuar a funcionar.** Uma
  funcionalidade entregue em modo API sem um caminho Dexie (ou uma
  mensagem elegante "não disponível no modo navegador") bloqueia a
  release.

## 6. Escrever um teste de regressão

Cada correção precisa de pelo menos um teste que falhe antes da
alteração e passe depois dela.

```bash
# Frontend (Vitest) - run from frontend/
cd frontend && bunx vitest run src/path/to/file.test.ts

# Backend (pytest)
cd backend && poetry run pytest tests/path/ -v

# A single plugin
make test-plugin-gamification
```

Para alterações que tocam nas cópias de segurança há um gate extra: uma
ida e volta real Exportar → Importar em `make dev` com dados reais (o
`BACKUP-AKZEPTANZTEST`). Os testes unitários por si só nunca justificam
um merge relativo a cópias de segurança.

## 7. Executar o gate completo localmente

```bash
make test            # backend + plugins + frontend Vitest
make check-types     # mypy + tsc --noEmit
make test-dexie-smoke  # GH-Pages-shape build, every route, no backend
cd frontend && bun run build
```

Tudo tem de estar verde antes de abrir um PR.

## 8. Commit e push

[Conventional Commits](https://www.conventionalcommits.org/). Referencie
a issue com uma palavra-chave de fecho para que o merge a feche
automaticamente.

```bash
git add -A
git commit -m "fix(area): short description

Longer description of what the problem was and how it was fixed.

Closes #123"

git push -u origin fix/short-description
```

Mantenha os commits **atómicos**: cada commit deixa a árvore verde
(`make test` passa). Junte uma alteração de código com a respetiva
alteração de teste no mesmo commit quando separá-las criaria um estado
intermédio vermelho.

## 9. Abrir um pull request

```bash
gh pr create --base develop \
  --title "fix(area): short description" \
  --body "Closes #123

## What changed
- ...

## Tests
- ..."
```

Aponte sempre para **`develop`**, nunca para `main` (`main` é o ramo
de release). Para uma sub-issue de uma umbrella/epic, cite a
*sub-issue* com `Closes #<sub-issue>`, mais `Refs #<umbrella>` para
rastreabilidade.

## 10. Esperar pela CI

A CI corre os gates de correção em cada PR:

- Testes do frontend (Vitest) + testes do backend / plugins (pytest)
- TypeScript (`tsc --noEmit`) + mypy + ruff + ESLint
- Hooks de pre-commit
- Gate de complexidade (ratchet com baseline: as novas funções têm de
  ficar abaixo do limiar de complexidade ciclomática)
- Guardas de tamanho de pasta + de ficheiro (prevenção de god-files /
  god-folders)
- Paridade i18n (cada catálogo em `backend/config/i18n/` tem de
  definir todas as chaves)
- Guarda de design tokens (sem cores fixas no código / utilitários de
  paleta fixa)
- Verificador de desvio da documentação

As verificações mais pesadas (E2E em modo Dexie, cobertura, testes de
mutação, análise de segurança, desvio de content-stats) correm à noite
+ na release, não em cada PR. Um PR verde não é, portanto, prova de que
`develop` está verde.

Quando um gate o bloquear, sobretudo um **ratchet** (complexidade,
tamanho de ficheiro, tamanho de pasta, ...), leia
[Gates, ratchets e proteção de ramos](gates-and-ratchets.md)
antes de assumir que está errado. Explica o que é cada gate, o que
fazer quando um ratchet o bloqueia, e como executar os gates localmente
com `make ci` antes do push.

## 11. Revisão e merge

Espere pela revisão (ou faça o merge você mesmo se tiver direitos de
maintainer). Os PRs são integrados com **squash-merge** em `develop`,
por isso os commits do seu ramo colapsam num único commit limpo no
tronco.

---

## Regras do projeto (versão curta)

| Regra | Significado |
|---|---|
| `GITHUB-ISSUE-PFLICHT` | cada correção/funcionalidade precisa primeiro de uma issue |
| Apenas Tailwind | sem acréscimos a `global.css`, sem estilos de cor inline |
| Design tokens | cores através de variáveis CSS, nunca literais hex |
| Paridade do modo Dexie | tudo funciona em modo Dexie *e* em modo API |
| Biblioteca primeiro | API nativa > framework > biblioteca > código próprio |
| Conventional Commits | `fix()`, `feat()`, `refactor()`, `docs()`, ... |
| i18n | todas as strings da UI em cada catálogo de `backend/config/i18n/` |
| Alvos de toque de 44px | elementos interativos adequados a dispositivos móveis |
| Uma só preocupação por PR | cada PR transporta uma única alteração coerente |
| Proteção de ramos | `develop` precisa de um ramo atualizado + verificações verdes (também vincula os administradores) |

Conjunto completo de regras: [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).

## Comandos comuns

```bash
make dev               # start backend + frontend
make test              # all tests (backend + plugins + Vitest)
make test-dexie-smoke  # Dexie-mode release gate (no backend)
make check-types       # mypy + tsc --noEmit
make check-complexity-gate   # complexity ratchet
make check-folder-size       # god-folder guard
make sync-i18n         # regenerate frontend i18n from backend YAML
make sync-versions     # propagate the canonical version
cd frontend && bun run build   # build the frontend
```

`make help` lista todos os alvos; o
[Makefile](https://github.com/astrapi69/adaptive-learner/blob/develop/Makefile)
é a fonte de verdade para os comandos de build.

## A arquitetura num só ecrã

```
frontend/src/
  api/          FastAPI client (the only place fetch() lives)
  components/   UI components, grouped by concern (dashboard/, lesson/, ...)
  features/     feature-strategy gating (useFeatureAvailable)
  hooks/        React hooks
  lib/          business logic, grouped by domain (lesson/, srs/, ai/, ...)
  pages/        route components (+ content/, dashboard/, lesson/ subdirs)
  shared/       app-independent reusable components
  storage/      dual storage: getStorage() -> IStorageService
  styles/       design tokens + per-theme CSS

backend/app/
  routers/      thin FastAPI endpoints (delegate to services)
  services/     business logic (no FastAPI imports)
  repositories/ data layer (Session-free contracts)
  models/       SQLAlchemy models (single-file domain model)
  hookspecs.py  the 10 plugin hooks

plugins/        PluginForge plugins (one package each; the
                catalogue lives in CLAUDE.md)
```

Detalhes: [Arquitetura](architecture.md).

## Onde encontro...?

| O quê | Onde |
|---|---|
| Regras do projeto | [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules) |
| Arquitetura | [Arquitetura](architecture.md) |
| Gates, ratchets, proteção de ramos | [Gates, ratchets e proteção de ramos](gates-and-ratchets.md) |
| Camada de armazenamento | [Camada de armazenamento](storage-layer.md) |
| Sistema de plugins | [Escrever um plugin](plugin-guide.md) |
| Integração de IA | [Integração de IA](ai-integration.md) |
| Testes | [Testes](testing.md) |
| Fluxo de lançamento | [Fluxo de lançamento](release.md) |
| Formato do conteúdo das lições | [Criar conteúdos de lições](authoring-content.md) |
| i18n | [Internacionalização](i18n.md) |
| Implementação | [Implementação](deployment.md) |
| Roadmap | [`docs/ROADMAP.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/ROADMAP.md) |
