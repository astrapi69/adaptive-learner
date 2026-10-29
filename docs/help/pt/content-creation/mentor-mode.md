<!-- Translation: AI-generated, pending native review -->

# Modo mentor: melhorar as próprias lições ao percorrê-las

A melhor verificação de qualidade de uma lição é percorrê-la em
pessoa: na posição de autor, notam-se gralhas, perguntas pouco
claras e respostas mal avaliadas exatamente onde acontecem. O modo
mentor transforma esse percurso num fluxo de trabalho em rondas:
**anotar durante o percurso, resolver no editor** - sem interromper
o fluxo de aprendizagem e sem perder nada do progresso de
aprendizagem.

---

## A que lições se aplica?

As funções de mentor aparecem apenas nas **lições próprias** -
conjuntos criados na aplicação, importados ou derivados de um
conjunto descarregado através de "Editar como cópia". Nos conjuntos
originais descarregados e nas lições de análise da importação de
chat, o visualizador de lições mantém-se inalterado; editá-las
continua a passar por "Meu conteúdo".

---

## As três estações do fluxo de trabalho

### 1. Durante o percurso: recolher notas de mentor

Por baixo de cada passo de uma lição própria - tanto de teoria como
de exercício - está o discreto botão **"Nota de mentor"**. Um toque
nele abre um pequeno formulário:

- **Categoria**: qual é o problema? (ver a tabela abaixo)
- **Texto livre**: o que exatamente deve ser melhorado?

**"Salvar nota"** regressa diretamente ao fluxo de aprendizagem. Um
passo que já tem uma nota mostra em vez disso **"Editar nota de
mentor"** - a nota pode ser alterada a qualquer momento ou apagada
com **"Remover nota"**.

Importante: a nota **não** altera a lição em si. As respostas são
avaliadas como habitualmente; o progresso e o agendamento das
revisões continuam inalterados.

| Categoria | Para que serve |
|---|---|
| Erro de digitação | Ortografia, caracteres em falta, pontuação |
| Formulação pouco clara | A pergunta é ambígua ou fácil de interpretar mal |
| Fácil demais | O exercício não desafia (p. ex. distratores demasiado óbvios) |
| Difícil demais | O exercício é excessivo neste ponto da lição |
| Resposta avaliada incorretamente | Uma resposta correta não é aceite (ou vice-versa) |
| Outro | Tudo o resto - p. ex. um parágrafo de teoria que deveria ser reestruturado |

### 2. No resumo: a lista de pendentes

No fim da lição, o resumo mostra o bloco **"Notas de mentor (n)"**:
cada anotação do percurso com a sua categoria e o seu texto. Cada
linha pode ser removida individualmente - por exemplo, quando uma
anotação é descartada depois de melhor reflexão.

Por baixo, **"Editar esta lição no editor"** leva diretamente ao
editor de lições com exatamente este conjunto e esta lição
pré-carregados. O mesmo link para o editor já está disponível
durante o percurso, dentro do painel recolhível **Opções** do
visualizador - para o caso de se querer corrigir um erro de
imediato em vez de terminar primeiro a lição.

### 3. No editor: resolver

Ao abrir no editor uma lição própria que tem notas de mentor, o
painel **"Notas de mentor desta lição (n)"** aparece por cima do
assistente - a lista de pendentes, exatamente onde se faz a
correção. Para cada nota:

- A categoria e o texto ficam mesmo ao lado dos passos em edição.
- O ícone do caixote do lixo marca uma nota como concluída e
  remove-a - também em sincronia com o visualizador e com o resumo.

Como o progresso de aprendizagem está ancorado a identidades
estáveis dos exercícios, os cartões de revisão sobrevivem às
correções: uma gralha corrigida ou uma pergunta reformulada não
deixa nenhum histórico SRS órfão.

---

## Sugestões de IA (opcional, chave própria)

Cada nota no painel do editor oferece o botão **"Sugestão de IA"**.
Este envia a anotação juntamente com o exercício afetado ao
fornecedor de IA configurado e devolve uma proposta de revisão
curta e concreta no idioma da aplicação.

- A proposta é **apenas mostrada** - nunca é aplicada
  automaticamente à lição. O que incorporar decide-se e faz-se à
  mão.
- Como todas as funções de IA, isto é **BYOK** (bring your own key,
  chave própria): sem uma chave configurada, o botão fica a cinzento
  e remete para Configurações → IA.
- Quando não vem nada utilizável, a aplicação di-lo com honestidade -
  melhor nenhuma proposta do que uma má.

Para notas em passos de teoria, o pedido é enviado sem o JSON do
exercício; a proposta baseia-se então na anotação e no título da
lição.

---

## Onde são guardadas as notas

As notas de mentor são uma **ajuda de autoria local** no
dispositivo - não são conteúdo de aprendizagem partilhado e não são
sincronizadas entre dispositivos. Além disso:

- Comportam-se de forma idêntica em ambos os modos de armazenamento
  (modo servidor e modo browser).
- Sobrevivem a recarregar a página, a reiniciar a aplicação e a
  voltar a entrar na lição.
- Viajam com a cópia de segurança: exportar → importar restaura
  também as notas de mentor em aberto.

---

## Porque não editar diretamente no visualizador?

Por conceção. Uma lição que muda por baixo do visualizador em
execução é uma fonte clássica de progresso órfão e de avaliação
inconsistente. Por isso, o modo mentor separa de forma limpa: o
visualizador recolhe observações, o editor altera o conteúdo -
através do mesmo caminho de escrita comprovado que qualquer outra
edição. Não se perde nada: o link para o editor leva ao sítio certo
com um único toque, a qualquer momento.

---

## Dicas práticas

- **Percorrer como quem aprende, anotar como mentor.** Responder a
  sério - as próprias tentativas erradas mostram quais os exercícios
  que ainda têm arestas por limar.
- **Uma nota curta basta.** "Distrator B demasiado próximo da
  resposta" vale mais do que um parágrafo - os detalhes
  acrescentam-se no editor.
- **Esvaziar a lista de pendentes.** Remover uma nota só depois de a
  correção estar guardada - assim a lista continua a mostrar com
  honestidade o que falta.
- **Percorrer a lição mais uma vez no fim.** A prova mais rápida de
  que uma correção funciona é o mesmo caminho em que se encontrou o
  erro.
