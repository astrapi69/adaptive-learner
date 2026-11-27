<!-- Translation: AI-generated, pending native review -->

# Fluxo de lançamento

Um lançamento é feito por dois workflows, não à mão. `release.yml` corta o branch de lançamento, define a versão e executa a verificação completa antes de enviar qualquer coisa. `release-finish.yml` faz o merge em `main`, cria a tag e cria o lançamento como rascunho. A versão vinculante, passo a passo, é `.claude/rules/release-workflow.md`; esta página é o resumo.

## Convenção de versões

O Adaptive Learner segue o Versionamento Semântico 2.0.0:

- **Maior (X.0.0)** - alterações incompatíveis na API ou
  arquitetura. Reservado para grandes mudanças futuras.
- **Menor (X.Y.0)** - novas funcionalidades, compatíveis com
  versões anteriores. Padrão para cada conclusão de fase (estamos
  na v1.20.0 / 34 fases lançadas).
- **Correção (X.Y.Z)** - correções de bugs, compatíveis com
  versões anteriores. Cadeias de hotfix.

As etiquetas pré-lançamento (`-alpha`, `-beta`, `-rc`) não são
utilizadas. Os lançamentos são sempre estáveis.

## O caminho

1. **Em develop, por pull request**: as notas `changelog/releases/vX.Y.Z.md`, a seção "Novidades" das páginas de ajuda e as atualizações de dependências. Sem o arquivo de notas o workflow não inicia.
2. **Ensaiar**: `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare` corta, define a versão e verifica no runner, e não envia nada.
3. **Cortar**: `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare -f push_branch=true`. Com a verificação verde, o branch `release/X.Y.Z` é enviado; a partir daí develop fica congelado.
4. **Verificar o branch**: a construção da imagem, a análise de segurança, a verificação WebKit, a comparação visual e as três construções do launcher são disparadas no branch de lançamento. Um branch enviado por um workflow não inicia nenhuma delas sozinho.
5. **Finalizar**: `gh workflow run release-finish.yml --ref release/X.Y.Z -f version=X.Y.Z` faz o merge em `main` sem fast-forward, cria a tag no commit de merge, abre o pull request que devolve o lançamento a develop e cria o lançamento do GitHub como rascunho.
6. **Publicar**: `publish-image.yml` publica e verifica a imagem, os binários do launcher das construções verdes de `main` são anexados, e só então o rascunho fica visível.

### A versão é definida em um só lugar

`backend/pyproject.toml` é a única fonte. O corte a define e `make sync-versions` escreve todos os outros arquivos com campo de versão (o conjunto completo é `collect_targets()` em `scripts/sync_versions.py`). Ninguém edita um campo de versão à mão. `release-gate.yml` verifica os pins de novo na tag.

### O que inicia o quê

- um push para `main`: `ci.yml`, `deploy-gh-pages.yml` e as construções do launcher
- a tag: `release-gate.yml`
- o rascunho do lançamento: nada; a imagem e os binários vêm do passo de publicação

`coverage.yml` não roda no push; roda toda noite e sob demanda (`gh workflow run coverage.yml --ref main`).

## Versões de plugins

Os plugins mantêm-se em sincronia com a versão canónica da
aplicação. O mesmo número em cada `pyproject.toml` de plugin mais
os literais `__version__` nos `__init__.py` de plugins. Uma futura
decisão "núcleo vs plugin de terceiros" pode desassociá-los, mas a
configuração atual é uniforme em todos os ficheiros propagados.

## Fluxo de hotfix

Um hotfix é o único lançamento feito à mão: nenhum dos dois workflows consegue cortar a partir de `main`. Branch `hotfix/vX.Y.Z` a partir de `main`, correção, definir a versão e escrever as notas, verificar o branch com `release-prepare.yml`, depois `make release-finish VERSION=X.Y.Z FINISH_BRANCH=hotfix/vX.Y.Z` e `make release-publish VERSION=X.Y.Z`.

Uma tag enviada nunca é apagada nem movida. Um lançamento errado é corrigido pela versão seguinte.

## Commits de varredura de dependências pré-lançamento discretos

Quando o ciclo de lançamento faz avançar dependências (Vite, React,
etc.), mantenha cada incremento como o seu próprio commit. Razões:

- **Granularidade de bisect** - uma regressão isola-se num único
  incremento.
- **Legibilidade do CHANGELOG** - os leitores veem a motivação
  real de cada incremento.
- **Reversão** - um incremento problemático pode ser revertido
  independentemente.

O padrão completo está documentado em
`.claude/rules/release-workflow.md`. A disciplina de regras como
documentação mantém os documentos legíveis por humanos (esta
página) e as regras legíveis por máquinas em sincronia.
