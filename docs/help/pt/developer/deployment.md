<!-- Translation: AI-generated, pending native review -->

# Implementação

Quatro modos de implementação são incluídos na v1.20.0:

| Modo | Onde | Backend | Chamadas de IA | Fonte de chave |
|---|---|---|---|---|
| Desenvolvimento local | `make dev` | FastAPI em :18001 | Lado do servidor | env / secrets.yaml / BD |
| GitHub Pages | `astrapi69.github.io/adaptive-learner/` | Nenhum (Dexie) | Direto do navegador | BD (IndexedDB) |
| Launcher de desktop | Binário PyInstaller | FastAPI iniciado localmente | Lado do servidor | secrets.yaml (criado automaticamente) / Interface de Definições |
| Docker | Docker Compose self-host | FastAPI em contentor | Lado do servidor | env / Interface de Definições |

## Desenvolvimento local

```bash
make dev
```

Inicia o backend (FastAPI + uvicorn `--reload`) na porta 18001 e o
frontend (servidor de desenvolvimento Vite) na porta 15174 em
paralelo. Prima Ctrl-C uma vez para parar ambos.

O proxy Vite do frontend redireciona `/api/*` para o backend, por
isso o frontend usa sempre `/api` como URL base - sem necessidade
de configuração CORS para desenvolvimento local.

Para modo em segundo plano:

```bash
make dev-bg     # desanexado
make dev-down   # parar
```

## GitHub Pages (apenas Dexie)

`.github/workflows/deploy-gh-pages.yml` compila o frontend com:

- `VITE_BASE="/adaptive-learner/"` - prefixo de cada URL de
  recurso para o caminho de Pages por repositório.
- `VITE_STORAGE_MODE="dexie"` - fixa o DexieStorage como modo
  padrão.
- `VITE_API_BASE=""` - sem backend para apontar.

O workflow corre em cada push para `main` e em despacho manual.
Após a compilação, copia `dist/index.html` para `dist/404.html`
para o fallback do roteador SPA, depois usa
`actions/upload-pages-artifact@v5` + `actions/deploy-pages@v5`
para publicar.

O URL do site é `https://astrapi69.github.io/adaptive-learner/`.
Os utilizadores com domínio personalizado adicionam um ficheiro
`CNAME` em `frontend/public/` com o nome de domínio; o
encaminhamento de Pages com reconhecimento de domínio do GitHub
trata do resto.

## Docker Compose (pilha completa)

```bash
make prod        # docker compose up -d
make prod-down   # docker compose down
```

`docker-compose.prod.yml` inclui:

- **backend** (FastAPI numa imagem Python 3.12), expondo a porta
  7880.
- **nginx** sidecar que serve o frontend compilado
  (`frontend/dist/`) e proxifica `/api/*` para o backend.
- **Um volume SQLite** que sobrevive a reinícios do contentor.

`install.sh` e `install.ps1` são os instaladores curl-pipe para
utilizadores finais - descarregam um arquivo de lançamento com
etiqueta, configuram `ADAPTIVE_LEARNER_SECRET_KEY` e executam
`docker compose up`.

Os instaladores são regenerados no momento do lançamento a partir
de `install.sh.template` / `install.ps1.template` mais a versão
do `backend/pyproject.toml` (ver `scripts/sync_versions.py`). Não
edite os ficheiros gerados diretamente.

## Configuração para produção

Três coisas importam para produção:

1. **`ADAPTIVE_LEARNER_SECRET_KEY`**: deve ser uma chave Fernet
   estável. Gere uma vez, guarde-a num local seguro (HashiCorp
   Vault, AWS Secrets Manager, um `.env` selado). Perdê-la
   significa que todas as chaves de API encriptadas ficam
   ilegíveis. A aplicação falha imediatamente no arranque se não
   estiver definida (sem padrão silencioso).
2. **`ADAPTIVE_LEARNER_CORS_ORIGINS`**: lista separada por vírgulas
   de origens permitidas. O padrão é permissivo; restrinja para
   produção.
3. **`ADAPTIVE_LEARNER_DEBUG`**: deixe indefinido / false em
   produção. O modo de depuração expõe stack traces nas respostas
   de erro.

Para contentores, as variáveis de ambiente são o canal de injeção
idiomático. A sobreposição `~/.config/adaptive_learner/secrets.yaml`
é para uso em desktop / launcher; também pode montá-la num
contentor se preferir um ficheiro de configuração em vez de várias
variáveis de ambiente.

## Launcher de desktop

Os binários PyInstaller em `launcher/` iniciam um FastAPI local em
`http://localhost:7880`, depois abrem o navegador padrão do
utilizador. Na primeira inicialização, o launcher também cria
`~/.config/adaptive-learner/secrets.yaml` como modelo comentado +
`chmod 0600` no POSIX para que o utilizador possa colocar as suas
chaves de API lá sem nunca tocar na interface de Definições.

A cadeia de configuração completa de três camadas (YAML do projeto
< sobreposição do utilizador < variáveis de ambiente) está
documentada em `docs/configuration.md`.

## Launcher (desktop multiplataforma)

`launcher/` é um instalador de binário único baseado em
PyInstaller. O GitHub Actions compila três binários por lançamento:

- `launcher-linux.yml` → `adaptive-learner-launcher-linux`
- `launcher-macos.yml` → `adaptive-learner-launcher-macos`
- `launcher-windows.yml` → `adaptive-learner-launcher.exe`

Cada launcher embute a versão (`__version__` literal +
`_build_info.py` escrito pelo ficheiro de especificação no momento
da compilação) e descarrega o arquivo de lançamento com etiqueta
correspondente + extrai + inicia o backend + abre o frontend no
navegador do utilizador.

O launcher não é intencionalmente o canal de distribuição principal
(o Docker é). Existe para utilizadores que querem uma experiência
de "duplo clique para instalar".

## Arquitetura CI/CD

Cada workflow corre em isolamento; sem estado partilhado entre eles:

| Workflow | Acionador | O que faz |
|---|---|---|
| `ci.yml` | push, pull_request | Testes + lint + tsc |
| `coverage.yml` | push para main | Cobertura HTML + xml |
| `release-gate.yml` | push de etiqueta | Verificação de deriva de pins de versão |
| `deploy-gh-pages.yml` | push para main, despacho | Compilação + implementação GH Pages |
| `launcher-{linux,macos,windows}.yml` | release: created | Compilar + anexar binário do launcher |
| `docs.yml` | push para main | Compilação MkDocs (atualmente inativa - o site vem do workflow GH Pages) |
