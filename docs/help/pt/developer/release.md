<!-- Translation: AI-generated, pending native review -->

# Fluxo de lançamento

O AdaptiveLearner faz um lançamento em cada conclusão de sub-fase
principal. O processo completo é automatizado por `make sync-versions`
e um job de CI de portão de lançamento; as etapas humanas são apenas
a escolha de versão, CHANGELOG e etiqueta.

## Convenção de versões

O Adaptive Learner segue o Versionamento Semântico 2.0.0:

- **Maior (X.0.0)** — alterações incompatíveis na API ou
  arquitetura. Reservado para grandes mudanças futuras.
- **Menor (X.Y.0)** — novas funcionalidades, compatíveis com
  versões anteriores. Padrão para cada conclusão de fase (estamos
  na v1.20.0 / 34 fases lançadas).
- **Correção (X.Y.Z)** — correções de bugs, compatíveis com
  versões anteriores. Cadeias de hotfix.

As etiquetas pré-lançamento (`-alpha`, `-beta`, `-rc`) não são
utilizadas. Os lançamentos são sempre estáveis.

## O lançamento em 8 passos

### 1. Capturar o estado

```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD
git diff --stat $(git describe --tags --abbrev=0)..HEAD
```

Reveja o que chegou desde a última etiqueta. Decida o nível de
incremento.

### 2. Escrever as notas do lançamento

Adicione um ficheiro `changelog/releases/vX.Y.Z.md` seguindo a
forma do lançamento mais recente (Adicionado / Corrigido / Testes /
Itens de backlog fechados / Commits / Notas de atualização). O CI
do portão de lançamento verifica que este ficheiro existe para a
etiqueta que está a ser enviada.

### 3. Editar manualmente a versão canónica

O único campo de versão editado manualmente em todo o repositório:

```toml
# backend/pyproject.toml
[tool.poetry]
version = "X.Y.Z"
```

### 4. Propagar

```bash
make sync-versions
```

Atualiza **18 ficheiros** automaticamente:

- `frontend/package.json`
- `launcher/pyproject.toml`
- `launcher/adaptive_learner_launcher/__init__.py`
- `launcher/adaptive-learner-launcher.spec` (plist CFBundle +
  CFBundleShortVersionString)
- 10× `plugins/adaptive-learner-plugin-*/pyproject.toml`
- 3× literais `__version__` em `__init__.py` de plugins
- `install.sh` (regenerado a partir de `install.sh.template`)
- `install.ps1` (regenerado a partir de `install.ps1.template`)

### 5. Verificar

```bash
make sync-versions-check     # sai com valor não zero em caso de deriva
make test                    # 2634 testes devem passar
cd frontend && npm run build # deve ter sucesso
```

O workflow de CI do portão de lançamento
(`.github/workflows/release-gate.yml`) executa o mesmo
`sync-versions-check` em cada push de etiqueta. Se o local
concorda mas o CI falha, a deriva foi introduzida entre a sua
verificação local e o push — investigue.

### 6. Commit + etiqueta

```bash
git add -A
git commit -m "chore(release): bump version to vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z — destaque da fase + resumo"
```

As mensagens de etiqueta são anotadas, multi-linha e resumem o
lançamento. Tornam-se as notas do GitHub Release quando o próximo
passo é executado.

### 7. Enviar

```bash
git push origin main --tags
```

Aciona:

- `ci.yml` no novo commit (testes)
- `release-gate.yml` na nova etiqueta (verificação de deriva de
  pins de versão)
- `coverage.yml` no novo commit (HTML de cobertura)
- `deploy-gh-pages.yml` no novo commit (publicar site público)
- `launcher-{linux,macos,windows}.yml` quando o GitHub cria o
  Release a partir da etiqueta

### 8. Criar o GitHub Release

```bash
gh release create vX.Y.Z \
  --title "Adaptive Learner vX.Y.Z" \
  --notes-file changelog/releases/vX.Y.Z.md
```

`--notes-file` garante que a página do GitHub Release corresponde
às notas por lançamento comprometidas no passo 2.

## Versões de plugins

Os plugins mantêm-se em sincronia com a versão canónica da
aplicação. O mesmo número em todos os 10 ficheiros
`pyproject.toml` de plugins mais os três literais `__version__` em
`__init__.py` de plugins. Uma futura decisão "núcleo vs plugin de
terceiros" pode desassociá-los, mas a configuração v1.20.0 é
uniforme nos 18 ficheiros propagados.

## Fluxo de hotfix

Os lançamentos ao nível de correção (0.X.1, 0.X.2) seguem os
mesmos 8 passos. A secção "Historial de hotfix" do CHANGELOG do
lançamento regista a cadeia quando vários hotfixes chegam
consecutivamente.

## Commits de varredura de dependências pré-lançamento discretos

Quando o ciclo de lançamento faz avançar dependências (Vite, React,
etc.), mantenha cada incremento como o seu próprio commit. Razões:

- **Granularidade de bisect** — uma regressão isola-se num único
  incremento.
- **Legibilidade do CHANGELOG** — os leitores veem a motivação
  real de cada incremento.
- **Reversão** — um incremento problemático pode ser revertido
  independentemente.

O padrão completo está documentado em
`.claude/rules/release-workflow.md`. A disciplina de regras como
documentação mantém os documentos legíveis por humanos (esta
página) e as regras legíveis por máquinas em sincronia.
