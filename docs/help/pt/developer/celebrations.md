<!-- Translation: AI-generated, pending native review -->

# Camada de celebrações

A camada de celebrações (EXP-008, Fase 55) adiciona feedback
emocional por cima do rastreamento mecânico existente. É exclusiva
do frontend e funciona em ambos os modos de armazenamento.

## Componentes

| Módulo | Papel |
|---|---|
| `lib/praise/phrase-picker.ts` | Ciclo de frases de elogio sem repetição, lê `data/praise/{lang}.json` (empacotado a partir de `backend/config/praise/*.yaml` via `make sync-praise`). |
| `lib/feedback/feedbackPref.ts` | Intensidade (`subtle`/`normal`/`enthusiastic`) + preferências de som em localStorage; substituição de movimento reduzido; controle por nível e helpers de frequência. |
| `hooks/useFeedbackIntensity.ts` | Intensidade efetiva em tempo real (relê em alteração de preferência + alteração de movimento reduzido). |
| `lib/feedback/milestones.ts` | Deteção pura de limiar (sequência/domínio/nível). |
| `lib/feedback/celebrationQueue.ts` | FIFO a nível de módulo com desduplicação de id; um ouvinte (o host). |
| `lib/praise/celebration-bus.ts` | `emitCelebration` (toca o som mapeado + notifica subscritores) e os helpers de marco `celebrate*`. |
| `lib/feedback/celebration-stats.ts` | Instantâneos de gamificação + dirige celebração de marco/emblema na conclusão. |
| `lib/audio/sound-effects.ts` | Sons sintetizados em tempo de execução (sem ficheiros de áudio). |
| `components/exercises/AnswerCelebration.tsx` | Háptico + elogio por resposta + emissão no bus. |
| `components/feedback/Confetti.tsx` | Explosão de confetes apenas CSS. |
| `components/feedback/MilestoneHost.tsx` + `MilestoneOverlay.tsx` | Drena a fila, mostra uma sobreposição de cada vez. |

## Fluxo

1. Um exercício renderiza `<AnswerCelebration isCorrect>`; dispara
   um háptico, escolhe uma frase (controlada por intensidade +
   frequência) e emite `answer_correct`/`answer_wrong` no bus.
2. `emitCelebration` toca o som mapeado (autocontrolado na
   preferência de som) e notifica os subscritores.
3. Na conclusão da lição, a página tira um instantâneo da
   gamificação, executa o prémio, depois `celebrateProgressSince`
   deteta marcos + emblemas e encaminha-os através de
   `celebrateMilestone`, que enfileira uma sobreposição e emite
   um som. `MilestoneHost` mostra as sobreposições
   sequencialmente.

## Regras

- Todas as animações são CSS (transform + opacity); sem
  bibliotecas de animação. `prefers-reduced-motion` suprime
  todas as animações e força a intensidade efetiva para
  `subtle`.
- Os sons são sintetizados em tempo de execução a partir de
  receitas aditivas (`renderSamples` é o núcleo puro e testável);
  o `AudioContext` é criado preguiçosamente no primeiro toque
  dentro de um gesto do utilizador.
- A camada de celebrações é suplementar: cada sinal também é
  visível. Uma falha nela nunca deve interromper o fluxo da
  lição (as leituras de estatísticas são defensivas).
