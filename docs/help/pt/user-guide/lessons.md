<!-- Translation: AI-generated, pending native review -->

# Lições de conteúdo e revisões

Uma **lição de conteúdo** é uma pequena unidade de aprendizagem
criada manualmente (normalmente 5–10 minutos) descarregada de
um conjunto de lições público. Corre num visualizador dedicado,
não na sessão de chat com IA. Após a lição, a aplicação lembra
exatamente quais palavras, pares ou frases errou e agenda-os
para uma sessão de revisão focada mais tarde.

As lições são um **caminho alternativo** para aprender que não
precisa de uma chave de API de IA — perfeito para experimentar
a aplicação ou para conteúdo onde o material curado supera o
chat de forma livre.

---

## De onde vêm as lições

As lições vivem em **conjuntos de conteúdo** — pequenos
pacotes publicados em repositórios públicos do GitHub. O
**Navegador de Conjuntos** da aplicação em `/content` lista
todos os conjuntos disponíveis; clique num para o descarregar.
O conjunto é armazenado em cache localmente (no sistema de
ficheiros se executar com um backend, no IndexedDB na
implementação apenas para navegador), por isso pode estudar
offline após o primeiro descarregamento.

O conjunto piloto v1.27.0 é **Francês A1** (2 lições, 14
cartões, 9 exercícios cobrindo todos os quatro tipos de
exercícios). Cada lançamento desde então adiciona mais —
consulte o [repositório de conjuntos](https://github.com/astrapi69/adaptive-learner-content)
para o catálogo atual.

---

## O fluxo da lição

Abra um conjunto, escolha uma lição, e o **visualizador de
lições** guia-o por cada cartão e exercício passo a passo:

1. **Cartões** apresentam material para ler. Clique em
   "Seguinte" quando estiver pronto.
2. **Exercícios** verificam o que se lembra. Quatro tipos
   incluídos:
   - **Correspondência** — arrastar pares (palavra ↔
     tradução).
   - **Escolha de imagem** — escolher a imagem que corresponde
     a um prompt.
   - **Texto livre** — escrever a resposta.
   - **Mosaicos de palavras** — montar uma frase a partir de
     mosaicos.

Uma barra de progresso no topo rastreia até onde está na lição.
Pode sair a qualquer momento — o seu progresso é guardado por
passo e retoma onde ficou.

### O ecrã de resumo

Quando o último exercício termina, o **resumo da lição** aparece:

- Uma **classificação de 0–3 estrelas** baseada na sua pontuação:
  - **3 estrelas** ≥ 90 % correto
  - **2 estrelas** ≥ 75 %
  - **1 estrela** ≥ 50 %
  - **0 estrelas** abaixo de 50 %
- Uma **análise por exercício** mostrando quais os exercícios
  que passou e quais tiveram erros (com a resposta correta
  revelada para os errados).
- Botões **Lição seguinte**, **Repetir** e **Voltar ao conjunto**
  para que a próxima ação seja a um clique.

Acerte 3 estrelas na primeira tentativa e as estrelas reproduzem
uma pequena animação comemorativa. (Se ativou a definição "reduzir
movimento" do SO, a animação respeita isso.)

---

## Rastreamento de erros ao nível de elemento

Cada resposta errada em cada tipo de exercício escreve uma linha
vinculada ao **elemento específico que errou** — a palavra, par
ou frase individual. A aplicação NÃO se lembra apenas de "marcou
6/10 na lição 3"; lembra "teve dificuldades com *bonjour* e
*merci* especificamente".

Acerte no mesmo elemento **3 vezes seguidas** e passa para
**dominado** — removido da fila de revisão. Erre um elemento
dominado mais tarde e **desmove de volta** para a fila. Um
domínio falhado é um domínio esquecido.

---

## A fila de revisão

Quando tem um ou mais elementos que precisam de revisão, o
**cartão de fila de revisão** aparece no Dashboard. Mostra:

- Quantos elementos estão em atraso
- Quantos estão **em atraso** (passada a data de revisão
  agendada)
- Um botão **Rever agora** que abre uma mini-sessão focada
  em `/review/:setId`

O agendamento usa três bandas baseadas em quantas vezes acertou
no elemento seguidas:

| Sequência de acertos | Próxima revisão |
|---|---|
| 0 | 1 dia depois |
| 1 | 3 dias depois |
| 2 | 7 dias depois |
| 3 (dominado) | removido da fila |

Dentro da fila, os itens ordenam-se: **em atraso primeiro**,
depois por **contagem de erros decrescente**, depois pela
**falha mais recente primeiro**. Por isso os elementos com que
mais tem dificuldades sobem ao topo.

---

## Sessões de revisão

Uma sessão de revisão em `/review/:setId` sintetiza uma
**mini-lição na hora** a partir dos itens do topo da sua fila.
Estratégia mista a partir do **v1.35.0**:

- Se originalmente errou uma palavra num exercício de
  **correspondência** ou **escolha de imagem**, vai refazer
  esse exercício (com embaralhamento novo, para que não seja
  pura memória muscular).
- Se errou algo em **texto livre** ou **mosaicos de palavras**,
  a revisão tenta gerar um **cloze** ("preencher o espaço")
  que visa exatamente a palavra que errou. Mesmo conhecimento
  numa forma diferente — a sua flexibilidade é exercitada,
  não apenas a sua recordação de um formato específico de
  exercício.
- Se a geração de cloze não conseguir construir um espaço
  limpo para esse item (ex.: o prompt de origem não tinha a
  resposta em linha), a revisão silenciosamente recua para
  repetir o original. Nunca vê um passo quebrado ou vazio.

Quando termina uma sessão de revisão, a mesma maquinaria de
pontuação + classificação com estrelas + rastreamento de
elementos corre. Domine 50 elementos através de revisões e
ganha o emblema **Mestre de Revisão**.

## Ronda de correção no final de cada lição

Novidade no **v1.35.0**: quando termina uma lição que teve
respostas erradas, a página de resumo mostra uma pequena
**ronda de correção** entre a sua pontuação e o botão
"Lição seguinte". Escolhe até cinco dos seus erros específicos
desta lição e oferece cada um como um cloze novo direcionado
à palavra ou artigo exato que errou.

- **Pode saltar a qualquer momento.** O botão "Lição seguinte"
  permanece visível durante todo o processo — a ronda de
  correção é prática opt-in, não uma barreira.
- **Só aparece quando há algo para corrigir.** Lições com
  pontuação perfeita saltam-na inteiramente. Lições cujos
  erros não podem ser transformados num cloze limpo (raro)
  também saltam.
- **Cada cloze concluído conta para o domínio.** A ronda de
  correção escreve as mesmas linhas de rastreamento de
  elementos que a lição principal; a sua sequência nesses
  elementos específicos avança em direção ao limiar de domínio
  de 3 acertos corretos.

Uma linha curta "{n} elementos melhorados" aparece no final da
ronda, para que possa ver o impacto da sua prática extra.

## Feedback de diferença visual

Também novo no **v1.35.0**: as respostas erradas de texto livre
e mosaicos de palavras mostram agora uma **diferença ao nível
do token** entre o que escreveu e a resposta canónica. Três
cores, nunca apenas por cor:

- **Tachado a vermelho** — o que escreveu que não pertence
  (com um marcador × para leitores de ecrã e utilizadores
  daltónicos).
- **Verde** — o que o canónico inclui que faltou (com um
  marcador +).
- **Âmbar** com uma seta → — uma palavra que errou ligeiramente,
  mostrada como `o-que-escreveu` → `esperado`.

A mesma diferença aparece nas linhas de análise por exercício
do resumo da lição para qualquer tentativa de texto livre ou
mosaicos de palavras que o armazenamento v1.35.0+ tem a
resposta do utilizador.

---

## XP e emblemas

Cada lição concluída ganha XP sob uma fórmula por estrela:

- **30 XP** base
- **+10 XP por estrela** ganha (0 → 0, 1 → +10, 2 → +20, 3 → +30)
- **+20 XP bónus** se ganhar 3 estrelas na primeira tentativa
  (cada passo com tentativas = 1, sem repetições)
- O mesmo **multiplicador de sequência diária** que as sessões
  de chat (+25 % por dia consecutivo de atividade, limitado a
  7 dias)

Quatro novos emblemas desbloqueiam em torno das lições:

- **Primeira Lição** — complete a sua primeira lição de conteúdo.
- **10 Lições Concluídas** — complete 10 lições de conteúdo.
- **Sequência de 3 Estrelas** — ganhe 3 estrelas em três lições
  seguidas.
- **Mestre de Revisão** — domine 50 elementos através da
  repetição espaçada.

As conclusões de lições também contam para a sua **sequência
diária**, por isso estudar com lições de conteúdo preenche o
mapa de calor da mesma forma que as sessões de chat.

---

## Modos de armazenamento

As lições funcionam em **ambos** os modos de armazenamento —
API (backend) e Dexie (apenas navegador / GitHub Pages). O
rastreamento de erros ao nível de elemento e o agendamento SRS
correm de forma idêntica contra o IndexedDB na implementação
apenas para navegador, por isso os utilizadores que visitam
o site público GitHub Pages obtêm o loop de revisão completo
sem um backend.

O que é *diferente* no modo apenas para navegador: os efeitos
colaterais de atribuição de XP / ganho de emblemas apenas
disparam no modo API (precisam dos hooks de gamificação do
backend). No modo Dexie ainda ganha XP e emblemas via o
caminho da sessão de chat; a conclusão da lição simplesmente
ainda não adiciona a esse total.

---

## Privacidade

Todo o progresso da lição, linhas de erro de elemento, estado
da fila de revisão e dados de agendamento ficam **no seu
próprio dispositivo** no modo API (sistema de ficheiros) ou
navegador (IndexedDB). Nada sobre quais palavras tem
dificuldades é enviado a lado nenhum.
