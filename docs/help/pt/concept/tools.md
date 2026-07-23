<!-- Translation: AI-generated, pending native review -->

# Ferramentas: os três pilares

O AdaptiveLearner não tenta ser a sua única ferramenta de
aprendizagem. Tenta ser o orquestrador que o aponta para a
ferramenta externa certa para o que está a fazer agora. Cinco
ferramentas fazem parte do catálogo, mapeadas para três pilares.

## Os três pilares

### 1. Repetição espaçada

A ciência cognitiva é clara: a revisão espaçada supera a
revisão mássica para retenção a longo prazo. O intervalo entre
revisões importa; ferramentas como o Anki transformam isto numa
disciplina.

**Ferramenta recomendada**: [Anki](https://apps.ankiweb.net/).
Gratuito no desktop, pago em iOS, o algoritmo de agendamento
está bem calibrado, e é o padrão de facto. A maioria das outras
aplicações neste espaço copia os intervalos do Anki.

**Use para**: qualquer coisa que precise de ser lembrada a longo
prazo. Vocabulário, fórmulas, entidades nomeadas, receitas de
correção de erros. As sessões do Adaptive Learner são ótimas
para compreensão; o Anki é ótimo para não esquecer.

Os pesos do perfil do Adaptive Learner associam "dedutivo" e
"error_based" mais fortemente ao Anki, uma vez que ambos os
métodos produzem material que vale a pena transformar em cartões.

### 2. Recordação ativa a partir das suas próprias fontes

O segundo pilar é construir conhecimento a partir de documentos
que fornece. As ferramentas modernas permitem-lhe carregar PDFs,
notas, transcrições e depois testar-se a si próprio ou fazer
perguntas fundamentadas nesse corpus específico.

**Ferramenta recomendada**: [NotebookLM](https://notebooklm.google.com/).
A ferramenta do Google que transforma as suas fontes num gráfico
de conhecimento interativo. Melhor do que o ChatGPT para este
propósito porque as respostas da IA estão ancoradas nos seus
documentos fornecidos.

**Também útil**:
[Excalidraw](https://excalidraw.com/) para esboçar a estrutura
do seu conhecimento,
[Obsidian](https://obsidian.md/) para gráficos de conhecimento
de notas ligadas que crescem ao longo de meses.

**Use para**: aprendizagem específica de domínio onde tem
material existente (artigos de investigação, documentos internos,
diapositivos de cursos) e quer extrair dele a estrutura de
conhecimento.

### 3. Prompts de IA adaptativos

O terceiro pilar é o acesso direto à IA para perguntas pontuais
que não se encaixam nos outros dois pilares. Às vezes apenas
precisa de uma explicação. Às vezes quer fazer brainstorming.

**Ferramenta recomendada**:
[Claude](https://claude.ai/),
[ChatGPT](https://chat.openai.com/), ou
[Gemini](https://gemini.google.com/). O AdaptiveLearner usa as
mesmas APIs internamente; também pode falar com elas diretamente
nas suas interfaces web para exploração menos estruturada.

**Use para**: perguntas abertas, brainstorming, "explica este
parágrafo", "dá-me três enquadramentos diferentes deste
problema". O chat não estruturado brilha para o pensamento
divergente; as sessões do AdaptiveLearner brilham para prática
convergente focada.

## Como o AdaptiveLearner classifica as ferramentas

O cartão de Recomendações de Ferramentas do Dashboard executa
uma pontuação simples:

```
pontuação(ferramenta) = sum(profile_weight[k] for k in ferramenta.weight_keys)
```

Cada ferramenta declara quais 1-2 eixos de método serve melhor:

| Ferramenta | Chaves de peso | Porquê |
|---|---|---|
| Anki | deductive, error_based | Cartões codificam regras + correções |
| NotebookLM | inductive, contextual | Exemplos + material situado |
| Prompt de IA Adaptativa | ai_adaptive, dialogic | Conversa adaptativa |
| Excalidraw | contextual, inductive | Estrutura visual a partir de exemplos |
| Obsidian | deductive, inductive | Teoria + exemplos num único gráfico |

Os pesos do perfil da sua avaliação são somados pelas
weight_keys de cada ferramenta, e a lista classificada é o que
o Dashboard apresenta. A classificação atualiza-se sempre que
o seu perfil muda (reavaliando a avaliação).

## Recomendações espaçadas

Uma segunda superfície de rastreamento no Dashboard: o cartão
**Espaçado**. Isto NÃO são recomendações de ferramentas; são
recomendações de ações. O sistema rastreia quanto tempo passou
desde a última sessão em cada método, depois sugere:

| Tempo desde o último commit | Tipo de cartão | Intervalo |
|---|---|---|
| Nunca | primeiro | 1 dia |
| > 14 dias | refrescar | 1 dia |
| 7-14 dias | revisão | 3 dias |
| 3-7 dias | prática | 7 dias |
| < 3 dias | manter | 14 dias |

Assim, um método que não tocou há duas semanas recebe um cartão
"Refrescar em 1 dia". Um método que usou ontem recebe "Manter em
14 dias" (ou não aparece de todo porque a lista tem limite de 5).

Os cartões são ordenados por urgência (intervalo menor × peso
mais forte = prioridade mais alta). Não tem de os seguir — são
sugestões, não comandos.

## Integrações integradas de primeira classe

Três ferramentas são incluídas como exportação integrada em vez
de recomendação externa:

- **Exportação Anki .apkg** — reveja os
  flashcards extraídos pela IA na página `/anki`, aceite os que
  quer, clique em Exportar. O `.apkg` é construído do lado do
  cliente via sql.js + JSZip e funciona diretamente no Anki
  desktop. Sem transferência manual.
- **Pacote ZIP NotebookLM** — Página de
  Progresso → Transferir pacote de estudo. O ZIP contém
  `summary.md`, `vocabulary.md`, `rules.md`, `errors.md`,
  `flashcards.md` e `sessions/*.md` formatados para o upload
  de fontes do NotebookLM. O NotebookLM não tem API pública,
  por isso este é o melhor caminho seguinte.
- **Voz (TTS + STT + Prática de Pronúncia)** —
  Integrações da Web Speech API diretamente na
  Sessão + Avaliação + uma página `/pronunciation` dedicada
  para projetos de idiomas. Não é necessária nenhuma ferramenta
  externa.

## O que NÃO está no catálogo

Deliberadamente excluído:

- **Duolingo / Babbel / aplicações gamificadas semelhantes** —
  entram em conflito com a filosofia. O Adaptive Learner inclui
  XP + emblemas + sequências, mas como camada
  motivacional sobre conteúdo não gamificado, não como o loop
  principal.
- **Khan Academy / Coursera** — orientados para a conclusão de
  cursos, não para a aquisição de competências. Espaço de
  problema diferente.
- **Memrise** — demasiado próximo do Anki; o catálogo mantém
  uma ferramenta por nicho.
- **Notion** — excessivo para o nicho de "notas ligadas";
  o Obsidian encaixa de forma limpa sem bloqueio na nuvem.

O catálogo é pequeno por intenção. Adicionar mais diluiria o
sinal.
