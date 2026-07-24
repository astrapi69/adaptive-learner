# Primeiros passos

O Adaptive Learner é um companheiro de aprendizagem que assenta
num modelo de seis métodos apoiado em investigação. Fazes um breve
teste que descobre que métodos combinam contigo e depois realizas
sessões de aprendizagem com IA através de um ciclo de sete passos.
A aplicação aprende contigo e ajusta a forma como ensina.

## Experimenta agora

A forma mais rápida de conhecer o Adaptive Learner é a versão
pública online:

[**Abrir aplicação**](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }

Esta corre no **modo local** - todos os teus dados permanecem no
teu browser (IndexedDB), e as chamadas de IA vão diretamente da
página para a Anthropic, OpenAI ou Google Gemini com a tua própria
chave de API. Sem backend pelo meio.

## Instalar como Progressive Web App

O Adaptive Learner é instalável. Os browsers modernos mostram na
primeira visita uma sugestão "Instalar" ou "Adicionar ao ecrã
inicial". Aceita-a e o Adaptive Learner torna-se numa aplicação
autónoma no teu smartphone ou desktop, iniciável sem separador do
browser.

A aplicação funciona offline para o Dashboard e as sessões
passadas. Novas sessões de IA precisam de Internet, porque o
fornecedor de IA fica fora do browser.

## O que precisas

- **Um browser moderno** (Chrome 100+, Firefox 100+, Safari 17+,
  Edge 100+). A aplicação usa IndexedDB, service workers e
  JavaScript moderno.
- **Uma chave de API de IA** para pelo menos um dos três
  fornecedores suportados (Anthropic, OpenAI ou Google Gemini).
  Os planos gratuitos costumam chegar para começar; vê
  [Definições](settings.md) para a configuração da chave.

## Os primeiros cinco minutos

1. **Abrir a aplicação** e escolher o idioma. Todos os 8 idiomas
   da interface estão totalmente traduzidos (DE, EN, ES, FR, EL,
   PT, TR, JA).
2. **Onboarding: apenas Nome + Tema.** O início rápido exige
   apenas estes dois campos, tudo o resto assume predefinições.
   Depois podes escolher "Começar já" ou, opcionalmente,
   configurar o teu perfil com mais detalhe no assistente.
   Vê [Onboarding](onboarding.md).
3. **Iniciar a primeira lição** - o caminho mais rápido sem chave
   de IA: Abre o
   [Navegador de Conteúdo](../features/content-browser.md) em
   `/content`, escolhe um conjunto de lições e inicia uma lição.
   Lês teoria breve e fazes exercícios; no final vês o teu
   resultado com estrelas. Vê
   [Lições e revisões](lessons.md).
4. **Opcional: sessões de IA.** Se preferires a conversa de
   aprendizagem guiada de seis métodos, define uma **chave de API**
   (Definições ou `~/.config/adaptive-learner/secrets.yaml`), faz o
   [teste de tipo de aprendizagem](assessment.md) opcional e inicia
   uma [sessão de aprendizagem](learning-session.md).
5. **Salvaguardar o teu resultado.** A partir do resumo da lição
   podes copiar o resultado como Markdown ou guardá-lo como
   ficheiro, e em **Definições → Dados** criar um
   [backup](../features/backup.md).

## Como continuar

- [Lições e revisões](lessons.md) - o fluxo da lição em detalhe
- [Navegador de Conteúdo](../features/content-browser.md) - encontrar e filtrar lições
- [Múltiplos repositórios de conteúdo](../features/content-repos.md) - ligar fontes de conteúdo próprias
- [Backup e restauro](../features/backup.md)
- [Compreender o teu Dashboard](dashboard.md) - progresso, Streak, XP, Badges
- [FAQ - perguntas frequentes](faq.md)
- [A ideia pedagógica por trás da aplicação](../concept/philosophy.md)
