<!-- Translation: AI-generated, pending native review -->

# O ciclo de sete passos

Cada sessão percorre um ciclo de aprendizagem de 7 passos. Os
passos provêm da série de artigos *Von Theorie zur Praxis* e
refletem o arco cognitivo real de aquisição de uma nova
competência.

## O arco

| # | Passo | O que acontece cognitivamente |
|---|---|---|
| 1 | Input | Encontrar material novo pela primeira vez |
| 2 | Tentativa | Tentar aplicá-lo |
| 3 | Erro | Perceber que a aplicação falhou |
| 4 | Feedback | Processar porquê o erro aconteceu |
| 5 | Adaptação | Ajustar o modelo mental |
| 6 | Repetição | Praticar com o modelo ajustado |
| 7 | Integração | Ligar ao contexto mais amplo |

## Porquê esta ordem

Não é apenas conveniente — cada passo depende do anterior:

- **Input → Tentativa** não é trivial. Muitos aprendentes saltam
  a Tentativa e vão diretamente do input para "tentarei mais
  tarde." Esse atraso corrói a recordação. O passo 2 força a
  aplicação imediata.
- **Tentativa → Erro** é o atrito produtivo. O erro é
  *informação*. Uma sessão de aprendizagem que evita erros
  dando-lhe apenas perguntas fáceis não lhe diz nada sobre a
  sua compreensão.
- **Erro → Feedback** é onde a aprendizagem mais profunda
  acontece. O mesmo erro explicado imediatamente, com referência
  à sua tentativa específica, faz efeito; o mesmo erro explicado
  uma hora depois a partir de um manual não.
- **Feedback → Adaptação** é interno. A IA não consegue ver este
  passo acontecer; você faz-o na sua cabeça. O passo 5 no prompt
  da IA convida-o deliberadamente a articular o que mudou na sua
  abordagem.
- **Adaptação → Repetição** verifica a adaptação. A nova tarefa
  de prática usa o mesmo princípio numa forma ligeiramente
  diferente, por isso a adaptação tem de generalizar.
- **Repetição → Integração** eleva a competência da prática
  isolada e liga-a a outras coisas que sabe. É isto que torna a
  aprendizagem durável.

## O que acontece se saltar um passo

Cada passo saltado tem um custo:

- **Saltar Input**: tenta aplicar algo que nunca viu explicado.
  Normalmente parece estar às cegas.
- **Saltar Tentativa**: leu a regra e assume que a compreende.
  Meses depois descobrirá que não.
- **Saltar Erro**: nunca produz um erro que a IA possa
  diagnosticar. A aprendizagem abranda a um fio.
- **Saltar Feedback**: teve um erro mas não processou a
  explicação. Na sessão seguinte cometerá o mesmo erro.
- **Saltar Adaptação**: assentiu ao feedback mas não alterou
  realmente o seu modelo mental. A próxima Tentativa irá
  revelá-lo.
- **Saltar Repetição**: adaptou uma vez mas não verificou se a
  adaptação generaliza. A competência não se transferirá para
  uma forma de superfície diferente.
- **Saltar Integração**: a competência fica num silo. Consegue
  fazê-la em problemas de prática mas não numa situação real.

O avaliador de IA de duplo prompt observa as suas trocas e pode
sugerir ficar no passo atual quando saltou um ritmo cognitivo.
É por isso que existem sugestões de "ficar" — não é a IA a ser
irritante.

## Como a IA decide

Após cada mensagem `user` + resposta da IA, uma segunda chamada
de IA dispara com este prompt de sistema (parafraseado):

> Leia a troca. O aprendente terminou o passo do ciclo atual?
> Emita JSON: `{advance, confidence, reason, suggested_step}`.

O esquema impõe um único objeto JSON; se a IA devolver texto não
parseável, aplica-se um fallback determinístico de +1 (limitado
ao passo 7).

O suggested_step pode ser:

- `atual + 1` — avanço normal (o mais comum).
- `atual` — ficar; o aprendente precisa de mais tempo aqui.
- Um salto para a frente (ex.: 1 → 3) — o aprendente já
  compreende o input.
- Um passo atrás (ex.: 4 → 2) — o aprendente está confuso e
  precisa de tentar novamente.

A rota aplica a sugestão apenas quando
`confidence >= 0.6` (o `step_evaluation.confidence_threshold`
padrão em app.yaml). Os veredictos de fallback aplicam sempre
o avanço de +1.

## Porquê duplo prompt em vez de único

A mesma chamada de IA poderia produzir tanto a resposta de
aprendizagem como o veredicto de passo. Não o fazemos porque:

1. **Separação de preocupações** — o prompt de aprendizagem é
   composto por (método, passo). O prompt do avaliador é
   consciente do método mas agnóstico quanto ao passo.
2. **Orçamentos de tokens** — a resposta de aprendizagem
   beneficia de 1024 tokens; o veredicto precisa apenas de 256.
3. **Robustez na análise de JSON** — pedir à IA para produzir
   prosa E uma cauda JSON numa única resposta é frágil.
   Perguntamos duas vezes, analisamos de forma limpa.
4. **Repetibilidade** — quando algo corre mal, temos as duas
   respostas registadas separadamente e podemos auditar.

O custo são duas chamadas de API por troca. Com preços de tier
económico (claude-haiku, gpt-4o-mini, gemini-flash) isso é uma
fração de cêntimo por troca.

## Indicador de progresso do ciclo

A página de Sessão renderiza uma faixa de 7 círculos no topo.
Preenchido = concluído; o círculo do passo atual está na cor de
destaque do projeto e pulsa subtilmente durante o processamento
da IA. Nas transições de passo (para a frente ou para trás),
a faixa anima para que o ciclo pareça vivo.

Em dispositivos móveis (≤768px) a faixa torna-se uma única fila
horizontal de círculos pequenos para poupar espaço vertical.
Deslizar para ver na faixa mostra uma sobreposição informativa
descrevendo o passo do ciclo anterior/seguinte.

## Auto-loop + transições de tópico

O passo 7 já não é um beco sem saída. Assim que o avaliador de
passo o move para o passo 7 com `advance=true`, uma terceira
chamada de IA — o avaliador de transição de tópico — julga se
o tópico foi integrado e se deve iniciar um novo ciclo.

```
       passo 1..7 (ciclo normal)
                ↓
         passo 7 atingido
                ↓
   chamada de IA de transição de tópico:
       integrado?  continuar_recomendado?
                ↓                    ↓
              sim ∧ sim            caso contrário
                ↓                    ↓
   cycle_step ← 1                cycle_step fica em 7
   cycle_count += 1              (sessão pronta para terminar)
   cycle_topics ← [..., resumo]
   novo subtópico escolhido
```

O limite máximo `max_cycles=5` por sessão impede loops
descontrolados. Um fallback determinístico mantém o comportamento
de limite em 7 em caso de falha da IA ou de análise.

O chat renderiza as transições de ciclo como cartões com borda
tracejada "Ciclo N" no historial da sessão. O diálogo de
avaliação resume a jornada de múltiplos ciclos quando
`cycle_count > 1`.

## Avaliação paralela no limite do ciclo

Na transição do passo 6 → 7, tanto o avaliador de passo como o
avaliador de transição de tópico disparam concorrentemente via
`asyncio.gather` (`async_evaluation: true` em `app.yaml`).
Isto poupa ~T₂ de latência no limite do ciclo.

A resposta da mensagem carrega um bloco `timings` com
`learning_ms` / `evaluation_ms` / `topic_transition_ms` /
`total_ms` / `parallel_saved_ms`.
