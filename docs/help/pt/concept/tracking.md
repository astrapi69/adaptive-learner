<!-- Translation: AI-generated, pending native review -->

# Rastreamento: Git para aprendizagem

A maioria das aplicações de aprendizagem rastreia "percentagem
concluída" ou "dias de sequência." Esses números são fáceis de
calcular mas dizem-lhe quase nada sobre como está realmente a
aprender. O AdaptiveLearner toma de empréstimo o modelo mental
do Git.

## A analogia com o Git

| Git | Aprendizagem |
|---|---|
| Commit | Instantâneo de uma sessão (método, avaliações, duração) |
| Diff | Delta da sessão anterior no mesmo tópico |
| Branch | Uma mudança de método (dedutivo → dialógico) |
| Log | O historial cronológico completo de commits |
| Blame | Que sessão introduziu um padrão específico |
| Bisect | Encontrar a sessão em que a compreensão parou de crescer |

Não usamos Git literalmente. Usamos a sua disciplina de estado
versionado, recuperável e comparável. As sessões são duráveis;
não desaparecem quando fecha o separador. Pode olhar para trás,
comparar e encontrar padrões.

## O que é commitado

Cada sessão que termina com uma avaliação produz uma linha
`ProgressCommit`:

| Coluna | O que captura |
|---|---|
| method | Qual dos seis métodos esta sessão usou |
| understanding | A sua avaliação de 1-5, reescalada para 0.0-1.0 |
| stress | Mesma reescala |
| error_rate | 0.0-1.0 (atualmente sempre 0.0; reservado para uma futura fração de erros por passo) |
| duration_minutes | Tempo decorrido entre started_at e ended_at |
| committed_at | Quando o commit foi escrito |
| project_id | Qual projeto de aprendizagem |
| session_id | Qual sessão |

É isso. Sete campos, sem NULLs (os valores de avaliação são
obrigatórios para terminar). Um punhado de bytes por sessão.

## O que pode fazer com isto

### Linhas de tendência

A Linha do Tempo de Progresso do Dashboard traça as suas
últimas 5 avaliações de compreensão + stress. Cinco pontos são
suficientes para detetar a direção:

- Ambos a subir: progresso + confiança ambos a aumentar.
  Continue.
- Compreensão a subir, stress a subir: está a esticar-se.
  Isto é bom mas apenas sustentável até certo ponto.
- Compreensão estável, stress a subir: estagnação. A heurística
  de mudança de método é ativada aqui.
- Compreensão a cair: algo mudou. O tópico ficou mais difícil?
  O método deixou de se adequar? Hora de olhar para o historial.

### Distribuição de métodos

Quais métodos usou realmente? Muitos aprendentes descobrem que
recorrem por defeito a um método (muitas vezes dedutivo) e
nunca experimentam os outros. O gráfico de barras no Dashboard
é um espelho — não uma competição.

### Sequência

Dias de calendário consecutivos com pelo menos uma sessão.
Reinicia no momento em que um dia passa sem sessão. Esta é a
única métrica de "gamificação" no AdaptiveLearner e é
deliberadamente discreta. O outro lado do gráfico é mais
importante.

### Agregados de avaliação de passo

O avaliador de duplo prompt escreve uma linha `StepEvaluation`
por troca de IA. O agregador de rastreamento transforma-as em:

- **Confiança média** — quão certo está a IA em média de que
  está pronto para avançar. Baixa (< 0.5) significa que o
  material é genuinamente difícil para si. Isso é informação,
  não um veredicto.
- **Contagem de repetições** — quantas vezes o avaliador disse
  "fique aqui." As fases de repetição intensa são normais para
  tópicos densos.
- **Tempo por passo** — total de segundos de relógio de parede
  que passou em cada passo ao longo do projeto (limitado para
  excluir intervalos > 2h). O passo com mais tempo é onde o
  trabalho cognitivo está a acontecer para si.

A página de Progresso renderiza tudo isto como gráficos de
barras.

## O que não rastreamos

Deliberadamente:

- **Sem métricas de envolvimento** — sem culpa de "minutos por
  dia", sem notificações, sem lembretes diários. O Adaptive
  Learner não luta pela sua atenção.
- **Sem comparação com outros utilizadores** — está sozinho nos
  seus dados (modo Local) ou sozinho com o backend (modo
  Servidor). Sem classificações, sem comparação entre pares.
- **Sem "lições concluídas"** — não existe um currículo fixo
  para completar. Você define o seu próprio tópico.
- **Sem "percentagem de domínio"** — o que significaria 100%
  para um tópico de aprendizagem? O domínio é uma postura, não
  uma linha de chegada.

## Camada de gamificação (v1.16.0)

Sobre o substrato ProgressCommit-como-Git, três camadas
motivacionais são incluídas:

- **XP + Níveis** — base de 50 XP por sessão terminada, mais
  +10 por ciclo concluído, +25 por ciclo-passo-7, +50 bónus de
  primeiro método, tudo multiplicado pelo multiplicador de
  sequência (até 2.75× numa sequência de 7 dias). Os níveis
  seguem `threshold(n) = 50 * n * (n - 1)`; os níveis 1-5
  ficam em 0 / 100 / 300 / 600 / 1000 XP.
- **24 emblemas** em 5 categorias (getting_started 3 /
  consistency 4 / method_explorer 7 / depth 7 / polyglot 3),
  semeados a partir de `badges.yaml` no primeiro arranque.
  Os predicados avaliam após cada sessão.
- **Mapa de calor de sequência** — 365 dias, estilo GitHub,
  colunas semanais. Congelamentos: 1 por cada 7 dias de
  sequência, máximo de 3 acumulados, semântica de
  pausa-não-reinício. Alternância de modo de fim de semana
  que ignora lacunas de Sáb/Dom.

A gamificação é **opcional**. Desativar as notificações
toast em Definições → Gamificação silencia os prompts; o sistema
continua a registar o estado. As informações de avaliação de
passo + historial de commits ao estilo Git permanecem a análise
de carga.

## Privacidade

No modo Local, os dados estão no IndexedDB do seu dispositivo.
Leia-os através das DevTools do navegador ou exporte-os para
backup. Mais ninguém os pode ver a menos que tenha acesso a
este perfil do navegador.

No modo Servidor, os dados estão em SQLite no host do backend.
Excluindo as chaves de API encriptadas, nenhum dos dados de
linha é sensível no sentido habitual — são apenas nomes de
métodos, avaliações inteiras, timestamps. Mas são *seus*. O
Adaptive Learner não envia nenhum deles para qualquer serviço
de análise ou telemetria de terceiros.

## Porque isto importa para a aprendizagem

Os contadores de sequência na maioria das aplicações são
viciantes mas superficiais. Não aprende nada de uma sequência
de 90 dias no Duolingo sobre *o que* aprendeu. O modelo Git
dá-lhe padrões:

- "Mudei de dedutivo para dialógico a 10 de maio e a minha
  linha de compreensão disparou nessa semana."
- "Passei 40% do meu tempo no passo 3 (Erro). O tópico tem
  mais armadilhas do que esperava."
- "Não fiz uma sessão contextual há três semanas; o cartão de
  recomendação espaçada está certo em me dar um empurrão."

Estas são as perguntas que um aprendente sério faz a si mesmo.
O Adaptive Learner dá-lhe o substrato para as fazer; a camada
de gamificação v1.16.0 é a cobertura, desativada por
predisposição.
