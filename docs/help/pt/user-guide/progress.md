<!-- Translation: AI-generated, pending native review -->

# Progresso

A página de Progresso é a vista detalhada dos seus dados de
aprendizagem — tudo o que o Dashboard resume, com gráficos e
tabelas para aprofundar.

## O que vê

Quatro secções, de cima para baixo:

1. **Insights de tendência** — compreensão média, stress médio,
   total de minutos, dias de sequência. Números que o Dashboard
   mostra num mosaico compacto tornam-se aqui linhas rotuladas.
2. **Distribuição de métodos** — o mesmo gráfico de barras
   horizontal que o Dashboard, com dicas de ferramentas ao
   passar o rato mostrando a contagem exata de sessões por
   método.
3. **Insights de avaliação de passo** — lê a partir das
   linhas StepEvaluation que a rota de sessão
   produz.
4. **Historial de commits** — cada linha ProgressCommit em
   ordem cronológica, mais recente primeiro.

## Insights de avaliação de passo

A arquitetura de duplo prompt escreve uma linha
`StepEvaluation` por troca de IA com o veredicto do avaliador
(advance, confidence, suggested_step, fallback_used, reason).
O agregador de rastreamento lê-as e produz quatro números que
valem a pena observar:

- **Total de avaliações** — cada troca de IA produz uma. Um
  projeto de longa duração terá centenas.
- **Confiança média** — em todas as avaliações. Uma média baixa
  (< 0.5) significa que a IA raramente tem a certeza de que
  está pronto para avançar, o que normalmente é um sinal de que
  o material é genuinamente difícil para si. Não é mau — é
  informação.
- **Contagem de repetições** — quantas vezes o avaliador optou
  por mantê-lo no mesmo passo. As fases com muitas repetições
  são normais quando o material é denso.
- **Contagem de fallback** — quantas vezes a saída JSON da IA
  não pôde ser analisada e o avanço determinístico de +1 foi
  substituído. Números altos (> 10% das avaliações) sugerem
  que a IA está a ter dificuldades com o formato de saída JSON;
  normalmente um problema de modelo, não culpa sua.

## Tempo por passo

Um gráfico de barras mostrando o total de segundos passados em
cada passo do ciclo ao longo do projeto. O agregador limita
intervalos superiores a 2 horas (afastou-se do ecrã — não é
tempo de aprendizagem real) para que sessões únicas de uma
noite não dominem.

O passo em que passa mais tempo diz muito. Muito tempo no
passo 3 (Erro) significa que o material tem muitas armadilhas
— pode ser exatamente o que se inscreveu. Muito tempo no passo
1 (Input) significa que o material é denso e está a ler
lentamente.

## Historial de commits

Cada linha é um ProgressCommit: método, avaliação de
compreensão, avaliação de stress, duração em minutos,
timestamp de committed_at, mais a nota de sessão em rich-text
renderizada em linha (TipTap só de leitura). A lista pode ser
ordenada por data ou por compreensão.

As notas renderizadas mostram negrito / itálico / listas /
blocos de código com realce de sintaxe / ligações —
exatamente o que foi escrito no diálogo de avaliação de fim
de sessão. As notas de texto simples legadas
passam inalteradas.

## Exportações

Três tipos de exportação via Definições → Exportar, todos
idênticos em forma nos modos de armazenamento:

- **Relatório de Progresso** — a página de Progresso completa
  empacotada num documento Markdown ou PDF.
- **Detalhe de Sessão** — a transcrição + avaliação + avaliações
  de passo de uma única sessão.
- **Visão Geral do Currículo** — a árvore de tópicos + resumos
  de lições de um único currículo.

O Markdown é gerado do lado do cliente; o PDF usa a impressão
para PDF do navegador (abrir um iframe oculto com uma folha de
estilo otimizada para impressão, depois `contentWindow.print()`).
Sem biblioteca PDF externa, sem viagem de ida e volta ao backend.

## Filtragem

Uma faixa de filtros simples permite-lhe restringir por:

- **Método** — apenas commits usando dedutivo (ou qualquer
  outro).
- **Intervalo de datas** — últimos 7 / 30 / 90 dias, ou
  todos os tempos.

Os filtros aplicam-se a todas as quatro secções (insights de
tendência, distribuição, agregados de avaliação de passo,
historial).

## Lembrete de privacidade

No modo Local a página de Progresso lê do IndexedDB e
mostra-lhe o que persistiu neste navegador. No modo Servidor
lê da base de dados SQLite do backend FastAPI. De qualquer
forma, nada aqui é alguma vez enviado para um serviço de
análise de terceiros.
