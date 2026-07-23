<!-- Translation: AI-generated, pending native review -->

# Os seis métodos de aprendizagem

Cada método tem uma postura, um ponto forte, um ponto fraco e
um estilo característico que a IA adota durante as sessões. A
matriz de 42 prompts (6 métodos × 7 passos) implementa estas
posturas por passo do ciclo.

## Dedutivo

**Postura**: teoria primeiro. Enunciar a regra na totalidade,
depois demonstrar com exemplos, depois pedir ao aprendente
que a aplique.

**Funciona bem quando**: o tópico tem regras claras e
enunciáveis (gramática formal, demonstrações matemáticas,
sistemas de tipos). O aprendente já aceita que regras governam
o domínio e quer internalizá-las eficientemente.

**Funciona mal quando**: as regras são difusas, contestadas ou
dependentes do contexto. O ensino puramente dedutivo de "bom
gosto" ou "clareza" não resulta — o aprendente precisa de ver
muitos exemplos antes de o padrão implícito cristalizar.

**Estilo da IA**: preciso, estruturado, completo. Enuncia a
regra em linguagem simples, demonstra com exemplos-tipo
trabalhados, depois pede ao aprendente que resolva uma nova
instância.

## Indutivo

**Postura**: exemplos primeiro. Mostrar três a quatro exemplos
cuidadosamente escolhidos do mesmo fenómeno e deixar o
aprendente derivar a regra por si próprio. Revelar a regra
apenas depois de o aprendente ter formado uma hipótese.

**Funciona bem quando**: o reconhecimento de padrões é
exatamente a competência cognitiva que o aprendente precisa de
desenvolver. Aprendizagem de línguas, teoria musical, táticas
de xadrez, intuição de aprendizagem automática — todos
beneficiam da prática indutiva.

**Funciona mal quando**: a velocidade é importante. O caminho
indutivo é mais lento do que o dedutivo quando a regra é
simples e inequívoca. "Liberte sempre a memória" não precisa de
três exemplos; diga-a diretamente.

**Estilo da IA**: apresenta exemplos lado a lado, abstém-se
de explicar, pergunta "que padrão vê?" ou "qual é o próximo
elemento desta série?".

## Baseado em Erros

**Postura**: provocar erros e depois aprender com eles. Propor
tarefas especificamente concebidas para levar o aprendente às
armadilhas clássicas do tópico. Depois explicar *porquê* a
armadilha é tão tentadora.

**Funciona bem quando**: o tópico tem armadilhas bem conhecidas
(concordância sujeito-verbo em frases longas, erros off-by-one
em ciclos, falácias comuns em argumentação). O aprendente
beneficia de sentir a atração da armadilha antes de compreender
o mecanismo corretivo.

**Funciona mal quando**: o aprendente é frágil, ansioso ou
iniciante. A "frustração produtiva" pode transformar-se em
"não sou bom nisto" sem um enquadramento cuidadoso. O prompt da
IA para o `passo 3 (Erro)` neste método diz explicitamente
"diagnosticar com precisão sem rodeios" — é uma escolha
pedagógica, não um defeito de personalidade.

**Estilo da IA**: confronta o erro, depois explica o seu
mecanismo em profundidade. "Essa é a armadilha clássica X —
caiu nela porque Y. Eis porque é tão tentadora."

## Dialógico

**Postura**: troca conversacional, sem pressão. Enquadrar as
tarefas como convites, não como testes. Afirmar explicitamente
o que está correto antes de dar correções. Deixar o aprendente
co-orientar.

**Funciona bem quando**: o aprendente tem ansiedade, confiança
frágil, ou bateu numa barreira. O tom relaxado restaura a
agência. Também funciona bem quando o próprio tópico é
conversacional (retórica, debate, competências de apresentação).

**Funciona mal quando**: o aprendente quer instrução direta e
fica frustrado com enquadramentos como "quer tentar?". Alguns
aprendentes leem prompts dialógicos como evasivos.

**Estilo da IA**: calorosa, curiosa, de baixa densidade.
Pergunta "o que o levou a isso?" antes de corrigir. Afirma
explicitamente a correção parcial. Sugere mudanças de ritmo
ou foco.

## Contextual

**Postura**: cenários do mundo real primeiro. Configurar uma
situação concreta onde o tópico é imediatamente necessário;
a teoria vem apenas depois de o aprendente ter tentado agir
no cenário.

**Funciona bem quando**: o tópico é aplicado ou específico de
domínio (comunicação empresarial, raciocínio clínico, trade-offs
de engenharia). O aprendente precisa de sentir a pressão
situacional para perceber qual o parâmetro teórico que
realmente importa.

**Funciona mal quando**: o tópico é genuinamente abstrato
(teoria dos conjuntos, lógica formal, teoria musical no
vácuo). Forçar um cenário faz a lição parecer artificial.

**Estilo da IA**: criação de cenário. "Está na porta de uma
reunião com cliente e eles perguntam…". Pede a próxima ação
concreta do aprendente. Mostra consequências dentro do cenário.

## Adaptativo por IA

**Postura**: a IA escolhe por turno. Lê o perfil e o historial
da sessão; seleciona aquele dos outros cinco métodos que se
adequa a *esta troca*. Justifica a escolha numa frase.

**Funciona bem quando**: o aprendente tem um perfil equilibrado
(sem método dominante) ou está numa sessão onde vários métodos
podem funcionar. Também funciona bem para aprendentes avançados
que conseguem articular quando um método não está a resultar.

**Funciona mal quando**: o aprendente quer um estilo de ensino
estável e previsível. A mudança constante de método pode
parecer instável se não for bem justificada por turno.

**Estilo da IA**: meta-consciente. Nomeia o método que está a
escolher ("Vou tentar de forma indutiva…"), executa esse método
com fidelidade, e muda quando o sinal diz que não está a
funcionar.

## Como a aplicação implementa cada um

Os seis métodos não são apenas rótulos. Cada um orienta uma
personalidade de IA distinta através da **matriz de 42 prompts**
em `plugins/.../session/prompts.py`: um prompt por par
(método, passo), seis métodos × sete passos. Um prompt de Input
dedutivo abre com a regra e pede exemplos; um prompt de Input
contextual abre com um cenário do mundo real e pergunta como
o aprendente o abordaria. Mesmo passo, textura completamente
diferente.

A matriz é exportada verbatim para
`frontend/src/data/session-prompts.json` para paridade no modo
Dexie — sem deriva possível entre os modos Servidor e Local.

## Escolher entre eles

A sua avaliação dá-lhe um perfil de 6 métodos. O método
dominante é aquele com que as novas sessões começam. Mas:

- O **avaliador de passo** (duplo prompt) pode sugerir
  permanecer, avançar ou — raramente — recuar por passo do
  ciclo.
- A **heurística de mudança de método** deteta estagnação
  (três sessões com compreensão estável + stress elevado) e
  apresenta um banner "quer tentar [outro método]?" em ambos
  os modos de armazenamento.
- Pode **escolher manualmente** um método no botão de início
  da página de Sessão. Útil quando sabe que o tópico requer
  um método específico.

A mudança de método é o objetivo, não a fidelidade ao método.
Um aprendente que usou cinco dos seis métodos ao longo do seu
historial no Adaptive Learner tem um conjunto de ferramentas
mentais mais rico do que aquele que está bloqueado no dedutivo
para sempre.
