<!-- Translation: AI-generated, pending native review -->

# Gates, ratchets e proteção de ramos

Este projeto é invulgarmente rigoroso: dezenas de gates de CI, uma
família de ratchets com baselines congeladas, issues e pull requests
obrigatórios, um contrato de testes de gate, e uma proteção de ramos
que também vincula os administradores. Quase nada disso foi escrito
onde um humano o lê: vive nos ficheiros de regras dirigidos aos agentes
em
[`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).
Esta página é o mapa para humanos: o que é cada mecanismo, porque
existe e, a parte que realmente importa quando está bloqueado, o que
fazer a respeito.

Nada aqui repete uma norma. Onde uma regra contém a formulação
vinculativa, esta página aponta para ela e explica-a. As regras são a
fonte de verdade; uma segunda cópia divergiria, e esta base de código
já apanhou isso a acontecer mais de uma vez.

## Duas cadências: gates de PR vs o turno da noite

Um pull request verde **não** significa que `develop` está verde. A CI
de PR corre apenas os gates de correção, aqueles cuja falha tem de
bloquear um merge. Tudo o que é informativo, apenas de aviso, ou
dependente de estado externo corre no turno da noite (um agendamento
noturno mais `workflow_dispatch`).

| Corre em cada PR | Corre à noite + na release |
|---|---|
| testes de backend / plugins / frontend, ruff + mypy, pre-commit, verificador de desvio da documentação | análise de segurança (pip-audit / bun audit / bandit) |
| ratchet de complexidade, guardas de tamanho de pasta + de ficheiro | relatório de cobertura (um relatório, não um gate) |
| gate de baselines visuais, gate de referências de testid | E2E em modo Dexie, regressão visual, testes de mutação |
| docker-build-smoke (filtrado por caminho) | desvio de content-stats, gate WebKit |

A consequência: uma alteração a uma superfície que só o turno da noite
cobre pode passar um PR limpo e deixar vermelha a execução noturna
seguinte. É uma classe de risco conhecida e recorrente, não um caso
isolado. A tabela de referência e o raciocínio vivem em
[`quality-checks.md` -> "CI cadence: PR gates vs the night shift"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).

## O que um gate é, e o que não é

Um gate é uma verificação que **falha fechada**. O contrato de testes de
gate do projeto (cinco testes por gate) está descrito em
[`quality-checks.md` -> "Gate test contract"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).
As duas regras que vai sentir como contribuidor:

- **Um gate que não consegue verificar nunca pode reportar verde.** "Não
  consegui correr" não é "não há nada para encontrar". Se a base de um
  gate estiver em falta (baseline ausente, auxiliar que falhou,
  frontend não construído), ele falha, não passa.
- **Um gate reporta o que mediu.** "0 resultados" e "0 ficheiros
  analisados" não são o mesmo resultado, e o gate está construído para
  que os consiga distinguir.

Por isso, quando um gate o bloqueia, leia o que ele diz ter medido antes
de assumir que está errado. A maioria das falhas "falsas" de gates é o
gate a reportar corretamente um desvio real que não esperava.

## Ratchets e baselines

Um **ratchet** compara uma medição atual com uma baseline congelada que
vive na árvore. A medição pode melhorar livremente; não pode regredir em
silêncio. As duas metades, o número e a baseline, estão versionadas,
por isso ambas podem divergir.

A família de ratchets e onde vive cada baseline:

| Ratchet | Ficheiro de baseline | Alvo local |
|---|---|---|
| Complexidade ciclomática | `.complexity-baseline` | `make check-complexity-gate` |
| Tamanho de ficheiro (linhas) | `.filesize-baseline` | `make check-file-sizes` |
| Tamanho de pasta (ficheiros planos/dir) | `.dirsize-baseline` | `make check-folder-size` |
| Tamanho de `global.css` | `.css-size-baseline` | `make check-css-size` |
| Tokens de tema / contraste | `.theme-baseline.json` | `make verify-theme` |
| Tamanho do corpus de regras | `.claude/rules/.corpus-baseline.json` | `make verify-rule-corpus-size` |
| Substitutos de tremas na documentação | `docs/.docs-hygiene-baseline.json` | `make verify-docs-hygiene` |
| Referências de documentação partidas | `docs/.doc-refs-baseline.json` | `make verify-doc-refs` |
| Tamanho da imagem publicada | (em `verify-image-size`) | `make verify-image-size` |

### Quando um ratchet o bloqueia

1. **Faça primeiro merge de `develop`, depois volte a medir.** Um
   ratchet compara a árvore atual com uma baseline; um ramo atrasado em
   relação à sua base transporta uma baseline *antiga* contra conteúdo
   integrado *novo*, por isso o número que lê localmente não é o número
   que a CI lê. Atualize o seu ramo antes de tocar em qualquer coisa.
   Porque é que isto morde está documentado em
   [`lessons/ci-gates.md` -> "A ratchet baseline is itself a
   measurement"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md).

2. **Se o aumento for legítimo, suba a baseline deliberadamente, e
   diga porquê.** Cada ratchet tem um alvo explícito de subida/
   atualização para que o novo teto apareça no seu diff, revisível, com
   uma razão na mensagem de commit:

   ```bash
   make check-complexity-gate-update      # regenerate .complexity-baseline
   make check-folder-size-update          # show offenders to whitelist
   make verify-theme-baseline-update      # re-record .theme-baseline.json
   make verify-rule-corpus-size-raise     # raise the corpus ceiling
   make verify-image-size-raise           # raise the image ceiling
   ```

3. **Não espere que um ratchet se baixe sozinho.** Alguns ratchets
   registam automaticamente uma redução genuína (um contador de erros
   que deveria ser zero); um ratchet de *orçamento* mantém uma redução
   como margem e só se move por um ato deliberado; um ratchet de
   *oráculo instável* (complexidade, o CSS Tailwind construído) nunca
   baixa automaticamente, porque uma descida pode ser desvio da
   ferramenta e não um ganho real. A decisão a três vias é explicada no
   contrato de testes de gate, ponto 5. Se um ratchet falhou porque um
   número *diminuiu*, isso também é um resultado, não um passe livre.

Nunca baixe um teto para tornar verde um vermelho local. O número
significa o mesmo em todo o lado por desenho; movê-lo em silêncio é
exatamente a falha que o ratchet existe para impedir.

### Um exemplo prático: o ratchet do corpus de regras

Imagine que adiciona uma secção a um ficheiro de regras em
`.claude/rules/`. Cada um desses ficheiros é injetado em cada prompt,
por isso o ratchet do corpus guarda o seu tamanho total. Execute-o e
ele bloqueia:

```
$ make verify-rule-corpus-size
rule corpus: 24 files, 292314 chars (~73078 tokens per prompt)
rule corpus is 58 chars over the ceiling (292314 > 292256).
  - condense or delete elsewhere in the corpus (see the condensation rule
  - raise the ceiling deliberately:
      make verify-rule-corpus-size-raise
    and say in the commit what the corpus bought for the space.
make: *** [Makefile:899: verify-rule-corpus-size] Error 1
```

O gate imprime as duas saídas legítimas, e só essas duas: condensar ou
apagar outra coisa para que o total volte a caber, ou subir o teto de
propósito com `make verify-rule-corpus-size-raise` e justificá-lo no
commit. Termina com código diferente de zero (`Error 1`), por isso faz
falhar a build até fazer uma delas; não existe um terceiro caminho em
que a adição simplesmente passa. Cada ratchet da tabela acima bloqueia
com a mesma forma: uma linha a dizer o que mediu, o valor atual face ao
teto, e o seu próprio alvo de subida/atualização.

Um gate que só morde depois do push custa uma ida e volta. Execute os
gates que não precisam de build pela ordem da CI com um só comando:

```bash
make ci        # every build-free gate, in CI order (BASE=<ref> for diff gates)
make ci-full   # the above plus gates that need a built frontend
```

`make ci` corre, por ordem: desvio da documentação, higiene da
documentação, referências de documentação, ligações gate<->regra,
inventário de verificações, inventário de lições, alterações
normativas, tamanho do corpus de regras, ratchet de complexidade,
referências de testid, contexto docker, tamanhos de ficheiro e o
snapshot OpenAPI. Dois gates precisam de um frontend instalado +
construído (constroem o oráculo de classes Tailwind), por isso ficam em
`make ci-full`, não em `make ci`. As suites de testes são à parte:
`make test`.

## Os gates estão acoplados às regras, e as alterações são declaradas

Dois manifestos mantêm a imposição honesta, e pode acionar qualquer um
deles ao editar um ficheiro de regras ou um workflow:

- [`.claude/rules/gates.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/gates.yaml)
  acopla cada gate que impõe regras à secção de regra que impõe.
  `make verify-gate-rule-links` falha nas duas direções: um gate sem
  regra, ou uma regra que cita um workflow que já não existe. Cada gate
  acoplado tem ainda um `body_sha` da secção de regra, por isso esvaziar
  o corpo de uma regra mantendo o título é detetado.
- [`.claude/rules/checks.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/checks.yaml)
  inventaria cada verificação. `make verify-check-inventory` prova que
  uma verificação `active` está mesmo ligada e não degenerou num no-op.
  Desligar uma verificação só é permitido declarando `status: disabled`
  com uma razão; o diff mostra-o. A desativação silenciosa é o que se
  torna impossível.

Se o seu PR adicionar ou remover formulação vinculativa num ficheiro de
regras, ou alterar o estado de um gate, `make verify-normative-changes`
vai pedir-lhe que o **declare**: a etiqueta `rule-change-declared`, ou
uma linha `RULE-CHANGE DECLARED: <what and why>` no corpo do PR ou numa
mensagem de commit. A declaração é ultrapassável de propósito, nunca
por acidente, e converge em
[`docs/rule-change-log.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/rule-change-log.md)
por máquina. O raciocínio completo: a série #2075 / #2077 / #2079 /
#2081 / #2087 em
[`quality-checks.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).

O corpus de regras tem um teto por uma razão concreta: cada ficheiro
`.claude/rules/**/*.md` é injetado em cada prompt de cada sessão de
agente, por isso uma nova secção de regras é uma troca, não um
acréscimo: condense ou remova algo primeiro, ou diga no commit o que o
corpus comprou com o espaço.

## A proteção de ramos também vincula os administradores

`develop` exige um ramo atualizado e verificações obrigatórias verdes
antes de um merge. Desde 2026-08-06 `enforce_admins` está **ligado**
para `develop`, por isso as verificações obrigatórias vinculam também
os administradores do repositório; desligá-las é um ato deliberado e
visível, nunca parte de um merge de rotina. Isto existe porque os
back-merges de release e de hotfix chegaram em tempos a `develop` sem
gate e deixaram-no vermelho para todos os ramos até um humano reparar;
o histórico está em
[`lessons/ci-gates.md` -> "Release/hotfix back-merges land
ratchet-tripping changes on develop ungated"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md)
e
[`docs/development/release-ratchet-gap.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/development/release-ratchet-gap.md).

Efeito prático: ninguém faz merge contornando um gate vermelho. Se o
seu PR estiver atrasado em relação a `develop`, atualize-o para que a
CI volte a correr sobre o estado combinado antes de poder ser integrado.

## As obrigações: issue, PR, plano de testes, uma só preocupação

Quatro obrigações permanentes assentam sobre os gates. São normas, não
verificações de CI, e são vinculativas quer uma tarefa as tenha pedido
quer não:

- **Issue primeiro** (`GITHUB-ISSUE-PFLICHT`): cada bug ou alteração
  precisa de uma issue no GitHub *antes* da correção, e o commit/PR
  cita-a com uma palavra-chave de fecho (`Closes #NN`).
- **PR sempre** (`PR-PFLICHT`): qualquer alteração de código enviada
  abre um pull request contra `develop`, quer tenha sido pedido quer
  não. Um ramo enviado sem PR é trabalho inacabado.
- **Plano de testes para alterações visíveis** (`TESTPLAN-PFLICHT`):
  uma alteração ao comportamento visível para o utilizador atualiza o
  plano de testes manual (alemão e inglês) no mesmo PR. Refatorações
  puras, infraestrutura e documentação estão isentas.
- **Uma só preocupação por PR**: cada PR transporta uma única alteração
  coerente.

A formulação vinculativa vive em
[`.claude/rules/ai-workflow/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules/ai-workflow)
(`github-issue-policy.md`, `pr-policy.md`, `testplan-policy.md`) e em
[`vibe-coding.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/vibe-coding.md).

## Onde isto se encaixa

Esta página é o complemento "porque é que o gate está lá" do
[percurso de integração](onboarding.md), que é o caminho passo a passo
do clone até ao PR integrado. Para o próprio fluxo de testes
(Red-Green-Refactor e um exemplo prático) veja [Testes](testing.md).
Para os gates da altura da release veja
[Fluxo de lançamento](release.md).
