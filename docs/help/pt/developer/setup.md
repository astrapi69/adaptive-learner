<!-- Translation: AI-generated, pending native review -->

# Configuração de desenvolvimento

## Pré-requisitos

- **Python 3.12+** (3.11 também funciona para o backend, mas os
  plugins são testados com 3.12).
- **Node 24+** (exigido pelo Vite 8). Versões mais antigas do Node
  falharão no passo de compilação com `crypto.hash is not a function`.
- **Poetry** para gestão de dependências Python. Instale com:
  `curl -sSL https://install.python-poetry.org | python3 -`.
- **Bun** 1.3+ (gerenciador de pacotes do frontend, #1492).
- **GNU Make** para os alvos de orquestração. O Makefile é a fonte
  de verdade — todos os comandos de CI estão lá.

## Clonar + instalar

```bash
git clone git@github.com:astrapi69/adaptive-learner.git
cd adaptive-learner
make install
```

`make install` executa:

1. `cd backend && poetry install` — backend + dependências de caminho dos plugins.
2. `cd frontend && bun install` — dependências frontend (Node 24).
3. Instala cada plugin em `plugins/` como dependência de caminho no
   venv do backend (`develop = true` para que as edições sejam em
   direto).

Se `make install` falhar, o culpado mais comum é o Poetry escolher
o Python errado. Execute `poetry env use python3.12` em `backend/`
(e em cada plugin se for mais fundo) e reinstale.

## Configuração

O backend lê a sua configuração a partir de uma cadeia de três
camadas (maior prioridade ganha):

1. **Variáveis de ambiente** com prefixo `ADAPTIVE_LEARNER_*`.
2. **Segredos do utilizador** em `~/.config/adaptive_learner/secrets.yaml`
   — gerado automaticamente como modelo comentado no primeiro
   arranque (`chmod 0600` no POSIX); nunca comprometido no git.
3. **Padrões** em `backend/config/app.yaml`.

Mais a resolução de chave de IA por fornecedor por cima:
**env > secrets.yaml > coluna DB encriptada com Fernet** (definida
via a interface de Definições), exposta à interface como o campo
`key_source_*` em `UserSettingsOut`.

O único segredo obrigatório é `ADAPTIVE_LEARNER_SECRET_KEY` —
utilizado para encriptar as chaves de API do utilizador em repouso
com Fernet. Gere uma com
`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
Três lugares para colocá-la (maior prioridade ganha):
variável de ambiente `ADAPTIVE_LEARNER_SECRET_KEY`, `secret_key:` em
`secrets.yaml`, ou `make dev-secret` para uma chave de desenvolvimento
de uso único.
A aplicação falha imediatamente no arranque se a chave não estiver
definida (sem valor padrão gerado silenciosamente — consulte
[docs/configuration.md](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)).

## Executar

```bash
make dev
```

Inicia o backend na porta 18001 e o frontend na porta 15174, em
paralelo. O backend tem recarregamento em tempo real via
`--reload` do uvicorn; o frontend é o servidor de desenvolvimento
do Vite. Prima Ctrl-C uma vez para parar ambos.

Modo em segundo plano:

```bash
make dev-bg   # iniciar backend + frontend em segundo plano
make dev-down # pará-los
```

## Testes

```bash
make test                 # backend + plugins + frontend Vitest
make test-backend         # apenas backend pytest
make test-frontend        # apenas frontend Vitest
make test-coverage        # execução de cobertura opcional (lento)
```

Testes E2E:

```bash
cd e2e && npx playwright test
```

16 ficheiros de especificação smoke na v1.20.0: landing, integração
+ avaliação, sessão (SSE em 3 partes), currículo, definições,
viewports mobile, emparelhamento de sincronização, ciclo de backup,
auto-loop multi-ciclo, importação + análise, exportação MD,
filtro de assuntos/etiquetas, notas em rich-text, seletor de modelo.

## Linting + formatação

```bash
cd backend && poetry run ruff check .       # lint Python
cd backend && poetry run ruff format .      # formatar Python
cd frontend && bunx tsc --noEmit             # verificação TypeScript
cd frontend && bun run lint                 # ESLint
cd frontend && bun run format               # Prettier
```

Os ganchos pré-commit impõem verificações de ruff + formatador em
cada commit:

```bash
cd backend && poetry run pre-commit install
```

## Documentação

```bash
make docs-install   # uma vez, instala o venv do MkDocs em docs/
make docs-serve     # servir docs em localhost:8000 com recarregamento em tempo real
make docs-build     # compilar site estático para site/
```

O venv de documentação é separado do backend — o MkDocs tem o seu
próprio `docs/pyproject.toml` com mkdocs-material +
mkdocs-static-i18n.

## Problemas comuns

- **`make dev` falha com "port already in use"**: outra instância do
  AdaptiveLearner ainda está a correr. Use `make dev-down` ou
  `pkill -f uvicorn`.
- **Testes falham com "duplicate column name"**: uma migração Alembic
  alterou o esquema. Elimine `backend/adaptive_learner.db` e
  re-execute.
- **`bun run build` falha no Node 18**: atualize para Node 24.
  O Vite 8 exige isso.
