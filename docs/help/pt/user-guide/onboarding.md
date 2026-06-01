<!-- Translation: AI-generated, pending native review -->

# Integração

Após o seletor de idioma na página de Início, o fluxo de
integração recolhe quatro campos obrigatórios mais taxonomia
opcional:

1. **Tópico** — o que quer aprender. "Gramática espanhola",
   "Fundamentos de aprendizagem automática", "Improvisação
   de guitarra principal". Seja específico; a IA usará isto
   para ancorar cada sessão.
2. **Objetivo** — como é o sucesso. "Passar no exame B2",
   "Construir um motor de recomendação de ponta a ponta",
   "Solo num blues de 12 compassos sobre uma faixa de
   acompanhamento sem perder o compasso." Objetivos concretos
   produzem orientação de IA mais útil.
3. **Prazo** — quando quer atingir o objetivo. "6 semanas",
   "Fim do verão", "Até ao T3". Usado para calibrar
   expetativas e definir o alvo de rastreamento de sequência.
4. **Minutos diários** — quanto tempo pode realisticamente
   dedicar. 15-45 minutos é o ponto ótimo para aprendizagem
   adaptativa; a aplicação não recompensa sessões maratona.

**Taxonomia de assuntos** (opcional, desde v1.9.0) — um
sugeridor difuso corresponde o seu tópico à taxonomia semeada
com mais de 80 nós em Línguas / Matemática / Programação /
Ciências / Música / Humanidades / Ciências Sociais /
Competências. Escolher um assunto de Línguas desbloqueia
a Prática de Pronúncia para o projeto mais tarde.

**Etiquetas** (opcional) — rótulos de texto livre separados
por vírgulas ("preparação-exame", "diário", "ao-meu-ritmo")
que aparecem na barra de filtros do Dashboard mais tarde.

Também pode saltar o formulário completamente — um utilizador
padrão é criado e aterra no Dashboard imediatamente.

Também escolhe um **idioma** para o projeto. Este é o idioma
em que a IA responderá durante as sessões; pode ser diferente
do idioma da interface (pode preferir a interface no seu idioma
nativo mas aprender espanhol em espanhol).

## Opcional: problema atual

Um campo "problema atual" permite-lhe trazer uma pergunta
aberta para o projeto imediatamente. Se o preencher, a primeira
sessão começa com este obstáculo concreto em vez de um prompt
aberto "no que quer trabalhar?".

## O que acontece a seguir

Quando submete o formulário, três coisas acontecem numa única
troca:

1. Um registo `User` é criado (ou reutilizado — o seu navegador
   local mantém o mesmo utilizador entre sessões).
2. Uma linha `LearningProject` fica com o seu tópico / objetivo
   / prazo / minutos-diários / idioma.
3. A rota de Avaliação abre automaticamente. Pode saltá-la daqui,
   mas a aplicação então usa por defeito o método de aprendizagem
   "dedutivo" até que a faça.

## Editar o seu projeto

Os detalhes do projeto não estão gravados em pedra. A página do
Currículo permite-lhe ajustar o tópico e o objetivo à medida
que descobre o que realmente quer aprender. A página de
Definições trata as alterações de idioma.

## O que não é armazenado

- **Sem e-mail**, sem palavra-passe, sem conta.
- **Sem análises**, sem rastreadores de terceiros.
- **Sem telemetria** enviada fora do seu dispositivo no modo Local.

O seu fornecedor de IA vê as suas mensagens (esse é o ponto
principal de perguntar à IA). O próprio Adaptive Learner apenas
armazena o que escreve — localmente ou no backend FastAPI,
dependendo do [modo de armazenamento](settings.md#storage-mode)
que escolheu.
