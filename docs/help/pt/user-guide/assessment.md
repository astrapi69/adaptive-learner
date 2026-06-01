<!-- Translation: AI-generated, pending native review -->

# A avaliação do tipo de aprendizagem

A avaliação consiste em 12 perguntas sobre como tende a abordar
novo material. Cada pergunta demora 5-10 segundos a responder;
o teste completo corre em menos de dois minutos.

## Como funciona

Cada pergunta mostra 3-4 respostas possíveis. A maioria das
perguntas é de **seleção única** (botões de opção — escolha um).
Algumas são de **seleção múltipla** (caixas de verificação —
escolha tudo o que se aplica). A aplicação indica qual o tipo
de cada pergunta.

Em dispositivos móveis e de toque, **deslize para a esquerda
ou direita** para navegar entre perguntas. As teclas de seta do
teclado fazem o mesmo no desktop. Uma dica única na primeira
pergunta aponta isto.

Por trás de cada resposta está um peso: quanto a escolha o inclina
para um dos seis métodos de aprendizagem (dedutivo, indutivo,
baseado em erros, dialógico, contextual, adaptativo por IA). A
calculadora soma esses pesos, normaliza pelo número de perguntas
e produz um perfil de 6 métodos.

## Os seis métodos em resumo

| Método | Ponto forte |
|---|---|
| Dedutivo | Regras primeiro, exemplos depois — orientado pela teoria |
| Indutivo | Exemplos primeiro, derivar a regra — orientado por padrões |
| Baseado em erros | Provocar erros, aprender com eles — orientado pelo atrito |
| Dialógico | Conversa sem stress — orientado pela troca |
| Contextual | Cenários do mundo real — orientado pela situação |
| Adaptativo por IA | A IA escolhe por turno — orientado pela meta |

[Os seis métodos em profundidade](../concept/six-methods.md)

## O seu perfil

Após a última pergunta vê um **gráfico de radar**: seis eixos,
o peso de cada método como um ponto no seu eixo. A forma
diz-lhe muito:

- **Um ponto claro** que se destaca muito = um método dominante.
  A aplicação baseará nesse método por defeito.
- **Uma forma redonda** = aprendente equilibrado. A aplicação
  começa com o padrão "dedutivo" mas está mais disposta a mudar
  de métodos entre sessões.
- **Uma forma plana** com valores baixos = não escolheu
  preferências fortes. Tudo bem; o método adaptativo por IA
  funciona especialmente bem aqui.

O **método dominante** (peso mais alto, desempate alfabético)
é mostrado explicitamente acima do gráfico. Um botão de
**Texto para Fala** ao lado do resultado lê o resumo em voz
alta (Web Speech API; funciona em navegadores modernos).

## Perguntas de seleção múltipla

Quando uma pergunta permite múltiplas respostas, o peso de cada
escolha é dividido pelo número que escolheu. Escolher duas
respostas contribui com o mesmo peso total que escolher uma —
por isso não pode enganar o teste escolhendo sempre tudo.

## Refazer a avaliação

A sua visão de como aprende muda ao longo do tempo. A página
de Avaliação é sempre acessível a partir do link "Refazer
avaliação" do Dashboard. A reavaliação incrementa o campo
`version` do seu perfil e substitui os pesos anteriores; o
comportamento da IA muda a partir da próxima sessão em diante.

## Saltar a avaliação

Se saltar o teste, a aplicação usa **dedutivo** como método
padrão e ainda obterá sessões úteis. Faça a avaliação quando
estiver pronto — não há penalização por adiar.
