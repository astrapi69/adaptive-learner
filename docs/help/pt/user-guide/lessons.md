# Lições de conteúdo e revisões

Uma **lição de conteúdo** é uma pequena unidade de aprendizagem
feita à mão (normalmente 5–10 minutos), descarregada de um
conjunto de lições público. Corre num visualizador próprio, não
na sessão de chat com IA. Após a lição, a aplicação lembra-se
exatamente de que palavras, pares ou frases respondeste mal e
agenda-os para uma sessão de revisão dirigida mais tarde.

As lições são um **caminho de aprendizagem alternativo** que não
precisa de chave de API de IA - ideal para experimentar a aplicação
ou para conteúdos em que material curado funciona melhor do que o
chat livre.

---

## De onde vêm as lições

As lições vivem em **conjuntos de conteúdo** - pequenos pacotes
publicados em repos GitHub públicos. O **Navegador de conjuntos**
em `/content` lista cada conjunto disponível; clica num para o
descarregar. O conjunto é armazenado localmente em cache (no
sistema de ficheiros em funcionamento com backend, no IndexedDB no
modo apenas browser), para que possas aprender offline após o
primeiro download.

A biblioteca incluída abrange vários conjuntos de conteúdo em
diferentes idiomas e domínios. Cada lançamento adiciona mais - vê o
[repo de conjuntos](https://github.com/astrapi69/adaptive-learner-content)
para o catálogo atual.

---

## O fluxo da lição

Abre um conjunto, escolhe uma lição, e o **visualizador de lições**
conduz-te passo a passo por cada cartão e exercício:

1. **Cartões** apresentam material para ler. Clica em "Continuar"
   quando estiveres pronto.
2. **Exercícios** testam o que memorizaste. Os tipos do
   núcleo:
   - **Correspondência** - toca numa peça e depois no seu par na
     outra coluna (palavra ↔ tradução); podes começar por qualquer
     um dos lados. Ambas
     as peças de um par encontrado partilham uma **cor própria** e
     um **badge numérico**, para que a correspondência seja
     reconhecível de forma segura para daltónicos (não apenas pela
     cor), e resolver um par reproduz uma breve **animação** para
     que a ligação seja fácil de seguir. Para mudar um par, toca
     numa peça já emparelhada e depois no seu novo par: o par
     passa para lá. Se o novo par já estiver emparelhado, os dois
     pares trocam de parceiro, por isso o número de pares nunca
     desce. Um simples toque nunca desfaz um par; **Ctrl/Cmd+Z**
     desfaz o último par que formaste.
   - **Escolha de imagem** - escolhe a imagem que corresponde à
     pista.
   - **Texto livre** - escreve a resposta.
   - **Peças de palavras** - monta uma frase a partir de peças.
   - **Texto com lacunas** - preenche uma lacuna na frase (surge
     deliberadamente dos teus erros, ver abaixo).
   - **Escolha múltipla** - escolhe uma ou (conforme a tarefa)
     várias respostas corretas.

   A estes juntam-se **tipos de extensão** que um conjunto pode
   trazer: categorização, correção de erros, compreensão de
   leitura, questionário avaliado e **ditado de áudio** (ouvir,
   depois transcrever).

Se um exercício traz uma **dificuldade** atribuída pelo autor, um
pequeno badge indica o nível (**Fácil / Médio / Difícil**). É pura
transparência: vês porque é que o gerador adaptativo pode propor um
cartão mais cedo ou com mais frequência - o badge não altera nem a
pontuação nem a ordem.

Um indicador de progresso no topo acompanha até onde estás na
lição. Podes parar a qualquer momento - o teu progresso é guardado
por passo e continua de onde paraste. A exceção é o exame: um exame
iniciado só conta quando é feito de uma vez, por isso recomeça do
início quando o voltas a abrir. Uma tentativa iniciada noutro modo
também não continua como exame, nem uma tentativa de exame como
prática; a lição recomeça nesse caso. Podes ainda mudar de modo até
à primeira resposta da tentativa.

### Atalho Enter

Podes operar toda a lição pelo teclado: **Enter** verifica um
exercício respondido e depois passa ao passo seguinte; os campos de
texto livre e de texto com lacunas submetem com Enter (sem quebra de
linha). Os elementos de controlo que precisam do próprio Enter têm
precedência. O atalho é comutável em **Definições → Aprendizagem**
(ativado por predefinição) e aplica-se também no Replay de Erros
("Repetir erros").

### Links de exemplo e de teoria

- **Ver exemplo:** Um passo de teoria pode trazer um link opcional
  para um exemplo detalhado, que aparece como botão "Ver exemplo".
- **Reler a teoria:** Um exercício mostra um link discreto para a
  teoria precedente mais próxima; daí "Voltar ao exercício"
  leva-te de novo à tarefa. Assim consultas uma regra sem perder o
  fio.

### Leitura em voz alta na lição

Os passos de teoria podem ser lidos em voz alta: com o botão de leitura
do passo, com **"Ler tudo"** ou, com **"Leitura automática"** nas opções
da lição, em cada passo por si só. Enquanto lê, um pequeno leitor
oferece pausa/reproduzir e o passo anterior e o seguinte. O **X**
encerra a leitura para esta lição; com "Leitura automática" ativada, a
lição seguinte volta a ser lida em voz alta. Para a desligar de vez,
usa o interruptor **"Leitura automática"**.

### O resumo

Quando o último exercício está concluído, aparece o **resumo da
lição**:

- Uma **classificação por estrelas de 0–3** baseada no teu
  resultado:
  - **3 estrelas** ≥ 90 % correto
  - **2 estrelas** ≥ 75 %
  - **1 estrela** ≥ 50 %
  - **0 estrelas** abaixo de 50 %

  Num exame com regras de avaliação próprias do conjunto não há
  classificação por estrelas; vale o veredicto do conjunto.
- Um **detalhamento exercício a exercício** (a visão geral das
  respostas na avaliação detalhada) que mostra quais exercícios
  passaste e quais continham erros (com a resposta correta para os
  errados).
- **"Corrigir erros (N)"** enquanto houver erros desta tentativa por
  corrigir (ver a ronda de correção mais abaixo).
- **Próxima lição**, **Praticar novamente** e **Voltar ao explorador
  de conteúdo** como botões, para que a próxima ação esteja a um
  clique de distância.

Se consegues 3 estrelas à primeira tentativa, toca uma pequena
animação de celebração. (Se ativaste a definição do SO "reduzir
movimento", a animação respeita-o.)

### Exportar resultado

O resumo oferece **"Copiar resultado"** e **"Guardar como
ficheiro"**. Ambos geram um **relatório Markdown** com a tua
pontuação, um detalhamento erro a erro (a tua resposta + a resposta
correta) e as áreas ainda fracas. O relatório serve para colar num
assistente de IA que te ajude de forma dirigida. A exportação é um
gerador puro sem backend e funciona em ambos os modos de
armazenamento.

---

## Rastreio de erros ao nível do elemento

Cada resposta errada em cada tipo de exercício escreve uma linha que
aponta para o **elemento concreto que falhaste** - a palavra, o par
ou a frase individual. A aplicação NÃO se lembra apenas de "atingiste
6/10 na lição 3"; lembra-se de "tiveste especial dificuldade com
*bonjour* e *merci*".

Se respondes ao mesmo elemento **corretamente 3 vezes seguidas**,
ele é marcado como **dominado** - e removido da fila de revisão. Se
respondes mais tarde de forma errada a um elemento dominado, ele
**volta a descer** para a fila. Um domínio falhado é um domínio
esquecido.

---

## A fila de revisão

Quando tens um ou mais elementos que precisam de revisão, aparece o
**cartão de revisão** no Dashboard. Mostra:

- Quantos elementos estão pendentes
- Quantos estão **em atraso** (após a data de revisão agendada)
- Um botão **Rever agora**, que abre uma mini-sessão focada em
  `/review/:setId`

O agendamento usa três níveis, com base na frequência com que
respondeste ao elemento corretamente em sequência:

| Sequência correta | Próxima revisão |
|---|---|
| 0 | 1 dia depois |
| 1 | 3 dias depois |
| 2 | 7 dias depois |
| 3 (dominado) | removido da fila |

Dentro da fila, as entradas ordenam-se: **as em atraso primeiro**,
depois por **número de erros decrescente**, depois por **erro mais
recente primeiro**. Assim, os elementos com que mais lutas sobem ao
topo.

---

## Sessões de revisão

Uma sessão de revisão em `/review/:setId` sintetiza uma
**mini-lição em voo** a partir das entradas no topo da tua fila.
Estratégia mista:

- Se falhaste uma palavra originalmente num exercício de
  **correspondência** ou de **escolha de imagem**, fazes exatamente
  esse exercício de novo (com baralhamento fresco - não apenas
  memória muscular).
- Se falhaste algo em **texto livre** ou **peças de palavras**, a
  revisão tenta gerar um exercício de **texto com lacunas** que
  visa exatamente a palavra falhada. O mesmo conhecimento noutra
  forma - treina-se a flexibilidade, não apenas a repetição de um
  formato de exercício específico.
- Se não for possível construir um texto com lacunas limpo para um
  elemento (p. ex. quando a pista original não continha a resposta
  na frase), a revisão reproduz silenciosamente o exercício
  original. Nunca recebes um passo partido ou vazio.

Quando concluis uma sessão de revisão, corre a mesma maquinaria de
avaliação + estrelas + rastreio de elementos. Domina 50 elementos
através de revisões e ganhas o badge **Mestre da revisão**.

## Ronda de correção no fim da lição

Quando concluis uma lição com erros, o resumo compacto mostra
**"Corrigir erros (N)"** logo acima das ações para continuar; N é o
número de erros desta tentativa que ainda estão por corrigir. O botão
abre a **ronda de correção** diretamente no primeiro exercício e não
altera nenhuma definição. Na **avaliação detalhada**, ou se marcares a
secção em **Configurações → Aprendizagem → Resumo após as lições**, a
ronda aparece no resumo como a secção **"Corrija seus erros"** e
abre-se com **"Corrigir agora"**. Ela pega em até cinco erros
concretos dessa lição e oferece cada um como um texto com lacunas
fresco que visa exatamente a palavra / o artigo falhado.

- **Pode saltar-se a qualquer momento.** As ações para continuar
  permanecem visíveis - a ronda de correção é exercício voluntário,
  não um gate.
- **Só aparece se houver algo a corrigir.** As lições com pontuação
  perfeita saltam-na por completo. Se os erros não se puderem
  transformar num texto com lacunas limpo (raro), a secção chama-se
  **"Repita seus erros"** e aí refazes os exercícios falhados.
- **Cada texto com lacunas concluído conta para o domínio.** A ronda
  de correção escreve os mesmos registos de rastreio de elementos
  que a lição principal; a tua sequência nesses elementos avança em
  direção ao limiar de domínio de 3-corretos.

No final aparece uma breve linha "{n} elementos melhorados", para
que vejas o efeito do teu exercício adicional.

Depois da ronda, ou assim que um erro desta tentativa é corrigido,
aparece por baixo **"As tuas correções"**: "Primeira tentativa: X de Y
certas", "N de M corrigidos" e cada erro com o seu estado
(**Corrigido** / **Ainda por corrigir**), a tua primeira resposta ao
lado da correta e, enquanto estiver por corrigir, a explicação do
exercício. O fim de **"Repetir erros"** mostra a mesma visão geral
quando o abres a partir do resumo. O resumo compacto mostra "N de M
corrigidos" assim que algo é corrigido; quando todos os erros estão
corrigidos, o botão "Corrigir erros (N)" desaparece. Na **avaliação
detalhada**, a visão geral das respostas e "Porque errou estes" marcam
cada erro como **Corrigido** ou **Ainda por corrigir**; um erro
corrigido continua listado aí.

## Feedback visual de diff

As respostas erradas de texto livre
e de peças de palavras mostram agora um **diff ao nível do token**
entre a tua entrada e a resposta canónica. Três cores, nunca apenas
a cor sozinha:

- **Vermelho riscado** - o que escreveste e que não pertencia (com
  um marcador × para utilizadores daltónicos).
- **Verde** - o que a resposta canónica contém e que omitiste (com
  um marcador +).
- **Amarelo** com seta → - uma palavra ligeiramente errada,
  representada como `tua-palavra` → `esperada`.

Os leitores de ecrã leem cada marca como uma frase no idioma da tua
interface, por exemplo "A mais: …", "Falta: …" ou "Escrito: …,
esperado: …", e saltam os símbolos visíveis.

O mesmo diff aparece no resumo da lição no detalhamento de cada
exercício - para cada resposta de texto livre ou de peças de
palavras cuja entrada do utilizador o armazenamento conheça.

---

## XP e badges

Cada lição concluída ganha XP segundo uma fórmula de estrelas:

- **30 XP** de base
- **+10 XP por estrela** alcançada (0 → 0, 1 → +10, 2 → +20,
  3 → +30)
- **+20 XP de bónus** se alcançares 3 estrelas à primeira tentativa
  (cada passo com tentativas = 1, sem repetições)
- O mesmo **multiplicador de sequência diária** que nas sessões de
  chat (+25 % por dia consecutivo, com limite aos 7 dias)

Quatro novos badges desbloqueiam-se em torno das lições:

- **Primeira lição** - conclui a tua primeira lição de conteúdo.
- **10 lições concluídas** - conclui 10 lições de conteúdo.
- **Sequência de 3 estrelas** - alcança três lições seguidas com 3
  estrelas.
- **Mestre da revisão** - domina 50 elementos por repetição
  espaçada.

As conclusões de lições também contam para a tua **sequência
diária**, de forma que aprender com lições de conteúdo preenche o
heatmap da mesma maneira que as sessões de chat.

---

## Modos de armazenamento

As lições funcionam em **ambos** os modos de armazenamento - API
(backend) e Dexie (apenas browser / GitHub Pages). O rastreio de
erros ao nível do elemento e o agendamento SRS correm de forma
idêntica contra o IndexedDB no modo apenas browser, de forma que os
utilizadores que visitam a página pública do GitHub Pages obtêm o
ciclo completo de revisão sem backend.

Também a gamificação está alinhada: no modo
apenas browser ganhas pelas lições concluídas os **mesmos XP e
badges de lição** que no modo servidor - a lógica de estrelas,
Streak e badges está portada para TypeScript e protegida contra
valores-ouro idênticos. Já não existe nenhuma diferença de
funcionalidade entre os modos na conclusão de lições.

---

## Privacidade

Todo o progresso das lições, as linhas de erros de elementos, os
estados da fila de revisão e os dados de agendamento são
armazenados **do teu lado**: no browser (IndexedDB) ou, no modo API,
na base de dados do teu próprio backend; outros recebem partes deles
só quando uma funcionalidade que utilizas precisa delas. Uma sessão de
aprendizagem com IA, por exemplo, envia ao teu fornecedor de IA os
teus erros recentes, cada um com a tua resposta, a resposta correta e
quantas vezes o cometeste. A
[política de privacidade](../legal/privacy.md) descreve que dados vão
para outros e quando.
