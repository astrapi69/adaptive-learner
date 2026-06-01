<!-- Translation: AI-generated, pending native review -->

# Primeiros passos

O Adaptive Learner é um companheiro de aprendizagem construído
sobre um modelo de seis métodos com base em investigação.
Faz uma avaliação curta para descobrir quais os métodos que
melhor se adequam a si, depois realiza sessões com suporte de
IA através de um ciclo de sete passos. A aplicação aprende
consigo e adapta a forma como ensina.

## Experimente agora

A forma mais rápida de experimentar o Adaptive Learner é a
implementação pública:

[**Abrir a aplicação em direto**](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }

Isto corre em **modo Local** — todos os seus dados ficam no
seu navegador (IndexedDB), e as chamadas de IA disparam
diretamente da página para Anthropic, OpenAI ou Google Gemini
usando a sua própria chave de API. Sem backend envolvido.

## Instalar como Progressive Web App

O Adaptive Learner é instalável. Em navegadores modernos verá
um prompt "Instalar" ou "Adicionar ao ecrã inicial" na
primeira vez que abrir o site. Aceite e o Adaptive Learner
torna-se uma aplicação autónoma no seu telemóvel ou desktop,
que pode ser lançada sem um separador de navegador.

A aplicação também funciona offline para o Dashboard e para
sessões passadas. As novas sessões de IA ainda precisam de
internet porque o fornecedor de IA vive fora do navegador.

## O que precisa

- **Um navegador moderno** (Chrome 100+, Firefox 100+,
  Safari 17+, Edge 100+). A aplicação usa IndexedDB, service
  workers e JavaScript moderno.
- **Uma chave de API de IA** para pelo menos um dos
  fornecedores suportados (Anthropic, OpenAI ou Google Gemini).
  Os tiers gratuitos costumam ser suficientes para começar;
  consulte [Definições](settings.md) para saber como
  adicionar uma chave.

## Primeiros cinco minutos

1. **Abra a aplicação** e escolha o seu idioma. Todos os 8
   idiomas da interface estão totalmente traduzidos
   (DE, EN, ES, FR, EL, PT, TR, JA).
2. **Integre o seu projeto de aprendizagem**: tópico, objetivo,
   prazo, minutos por dia, mais taxonomia de assunto opcional
   e etiquetas. Consulte [Integração](onboarding.md).
3. **Faça a avaliação de 12 perguntas** para que a aplicação
   saiba em quais métodos de aprendizagem se apoiar. Deslize
   para a esquerda/direita entre perguntas no dispositivo
   móvel. Consulte [Avaliação](assessment.md).
4. **Adicione a sua chave de API de IA** em Definições, OU
   coloque-a em `~/.config/adaptive-learner/secrets.yaml` se
   executar o lançador de desktop. A interface de Definições
   mostra de que camada veio a sua chave.
5. **Inicie a sua primeira sessão**. O botão "Iniciar sessão"
   do Dashboard leva-o para uma conversa de aprendizagem. As
   respostas da IA são transmitidas token a token; o avaliador
   de duplo prompt decide cada passo do ciclo. Consulte
   [Sessão de aprendizagem](learning-session.md).

## Para onde ir a seguir

- [O ciclo de aprendizagem de 7 passos explicado](learning-session.md)
- [Ler o seu Dashboard](dashboard.md)
- [FAQ — perguntas frequentes](faq.md)
- [O conceito pedagógico por detrás da aplicação](../concept/philosophy.md)
