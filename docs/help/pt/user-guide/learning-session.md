<!-- Translation: AI-generated, pending native review -->

# Uma sessão de aprendizagem

Uma sessão é uma conversa focada com a IA através do ciclo de
aprendizagem de sete passos. As sessões são curtas - 15-45
minutos é típico. O botão "Iniciar sessão" do Dashboard cria
uma nova; a aplicação escolhe o método de aprendizagem (o seu
dominante da avaliação) e o passo inicial do ciclo
(normalmente 1 = Input).

## Os sete passos

| # | Passo | O que acontece |
|---|---|---|
| 1 | Input | A IA apresenta novo material no estilo do método ativo |
| 2 | Tentativa | Aplica o que acabou de aprender - a IA propõe uma tarefa |
| 3 | Erro | Um erro aparece; a IA assinala-o com precisão |
| 4 | Feedback | A IA explica a correção em profundidade |
| 5 | Adaptação | Ajusta a sua abordagem; a IA pode reformular |
| 6 | Repetição | Uma nova tarefa que exercita o mesmo conceito |
| 7 | Integração | A IA liga o material de hoje a um contexto mais amplo |

O ciclo é uma *estrutura*, não uma linha de montagem. Os passos
podem repetir-se, avançar ou mesmo recuar quando a sua última
mensagem mostrar confusão. A IA julga por troca e a barra de
progresso da aplicação atualiza em conformidade.

[O ciclo em detalhe](../concept/seven-steps.md)

## Como a IA o guia

Cada mensagem que envia desencadeia até três chamadas de IA:

1. **A resposta de aprendizagem** - transmitida token a token
   via SSE. Vê o cursor em linha (▍) enquanto o assistente
   pensa; os tokens aterram na bolha à medida que chegam (sem
   marcador de posição "A pensar..."). O prompt do sistema é
   composto a partir de uma matriz de 42 células (6 métodos ×
   7 passos), por isso um Input dedutivo parece muito diferente
   de uma Repetição contextual.
2. **O avaliador de passo** - uma segunda chamada de IA lê a
   troca e decide se está pronto para avançar. Emite `advance`,
   `confidence`, `reason`, `suggested_step`. A aplicação aplica
   a sugestão quando a confiança ≥ 0.6.
3. **O avaliador de transição de tópico** (apenas no passo 7)
   - uma terceira chamada de IA decide se o tópico foi
   integrado. Se sim E `continue_recommended`, um novo ciclo
   começa automaticamente com um novo subtópico (auto-loop,
   máx. 5 ciclos por sessão).

O veredicto é mostrado discretamente acima do chat como uma
notificação "Passo moveu de X para Y porque…" quando é
realmente aplicado. Os cartões de transição de ciclo são
renderizados como cartões com borda tracejada "Ciclo N" no
historial do chat.

**Voz ligada/desligada** - um botão TTS (▶) ao lado de cada
resposta da IA lê-a em voz alta; um botão de microfone (🎤)
na entrada permite-lhe ditar; as transcrições provisórias
preenchem a área de texto para que possa rever antes de enviar.
Ambos são Web Speech API; alterne em Definições → Voz.

## Indicador de progresso do ciclo

Ao longo do topo da página de Sessão fica uma faixa de
progresso de 7 círculos. O passo atual está preenchido na cor
de destaque do seu projeto; os passos passados estão
preenchidos mais ténuemente; os passos futuros estão vazios.
Quando o avaliador o move para a frente (ou para trás!), a
faixa anima para tornar a transição visível.

Em dispositivos móveis (≤768px) a faixa torna-se uma única
fila horizontal de círculos pequenos para poupar espaço
vertical.

## Recomendações de mudança de método

Às vezes o método ativo simplesmente não resulta. Após três
sessões em que a sua avaliação de "compreensão" não cresce e
a sua avaliação de "stress" permanece alta, a aplicação
apresenta um **MethodSwitchBanner**: "Quer tentar [outro
método] para a próxima sessão?". Aceite e a próxima sessão
começa com o novo método ativo.

A recomendação lê o seu perfil e prefere o seu segundo método
mais forte que não usou recentemente. Pode dispensar o banner;
ele voltará se o padrão de estagnação continuar.

Ambos os modos de armazenamento (Servidor + Local) suportam
recomendações de mudança de método.

## Avaliação + terminar uma sessão

A página de Sessão tem um botão "Terminar sessão". Antes de
a sessão fechar, preenche uma breve avaliação: compreensão,
stress e adequação do método numa escala de 1-5, mais uma
**nota em rich-text** opcional (TipTap: negrito, itálico,
listas, blocos de código com realce de sintaxe, ligações).
A nota é sua - a IA não a lê.

As avaliações + resumo da jornada de múltiplos ciclos
transformam-se numa linha `ProgressCommit` - o instantâneo
ao estilo Git de uma sessão. Concluir uma sessão atribui XP
(50 base × multiplicador de sequência, mais bónus por ciclo),
verifica emblemas recém-ganhos e atualiza a sua sequência.
Consulte [Progresso](progress.md), [Dashboard](dashboard.md)
e o [conceito de Rastreamento](../concept/tracking.md).
