<!-- Translation: AI-generated, pending native review -->

# FAQ

## Os meus dados estão seguros?

No **modo Local** todos os seus dados vivem no IndexedDB no seu
próprio dispositivo. Sem backend, sem serviço de terceiros.
Fechar o separador do navegador não os elimina; limpar os dados
do site, sim. Se partilha o dispositivo, qualquer pessoa com
acesso a este perfil do navegador pode lê-los.

No **modo Servidor** os dados vivem na base de dados SQLite que
o backend FastAPI gere. As chaves de API são encriptadas em
repouso com Fernet usando um segredo que define via a variável
de ambiente `ADAPTIVE_LEARNER_SECRET_KEY`, ou via `secret_key:`
em `~/.config/adaptive-learner/secrets.yaml`.

Nenhum dos modos envia telemetria, análises ou as suas
mensagens para terceiros além do fornecedor de IA que escolheu
— e esse apenas vê o conteúdo da mensagem que esperaria
(prompt do sistema + o seu texto + as respostas anteriores da
IA na sessão).

## Preciso de uma chave de API?

Sim para sessões de IA. A aplicação usa **traga a sua própria
chave** para todos os três fornecedores suportados: Anthropic
Claude, OpenAI GPT, Google Gemini. Os limites do tier gratuito
costumam ser suficientes para começar.

Três lugares para colocar a chave (maior prioridade ganha):
uma variável de ambiente `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`,
o campo `ai.<provider>.api_key` em
`~/.config/adaptive-learner/secrets.yaml`, ou a interface de
Definições. A interface mostra a fonte por fornecedor para que
saiba sempre de onde veio a sua chave.

Pode navegar no Currículo, fazer a Avaliação, ver o seu
Dashboard e até executar a Importação de historial de chat
sem uma chave de API. A página de Sessão + o passo de análise
+ as funcionalidades de extração por IA são as que precisam
de uma chave.

## Posso usá-lo offline?

Parcialmente. O service worker da PWA armazena em cache os
ativos estáticos (HTML, JS, CSS, ícones) para que a aplicação
inicie sem internet. Os dados de sessões passadas e do Dashboard
também carregam do armazenamento local, por isso ler material
antigo funciona bem.

**As sessões em tempo real ainda precisam de internet** porque
o fornecedor de IA fica fora do seu navegador. A página de
Sessão deteta "offline" e mostra uma mensagem clara em linha
em vez de falhar silenciosamente.

## O que significa a mudança de método?

Quando três sessões seguidas mostram a sua compreensão
estagnada E o seu stress alto, a aplicação apresenta um banner:
"Quer tentar [outro método] para a próxima sessão?". A
recomendação prefere o seu segundo método mais forte da
avaliação que não usou recentemente.

É uma *sugestão*, não uma ordem. Pode dispensar o banner e
continuar com o seu método atual; o banner reaparece se o
padrão de estagnação continuar. As mudanças de método são
registadas na tabela `method_switches` e aparecem na
distribuição da página de Progresso.

## O que é o auto-loop?

Quando uma sessão atinge o passo 7 (Integração) e o avaliador
de transição de tópico julga o tópico integrado E recomenda
continuar, um novo ciclo começa automaticamente com um novo
subtópico. Até 5 ciclos por sessão (proteção contra
descontrolo). O historial do chat renderiza cartões com borda
tracejada "Ciclo N" em cada transição. O diálogo de avaliação
de fim de sessão resume a jornada de múltiplos ciclos quando
`cycle_count > 1`.

## Posso exportar os meus dados?

Sim. Três caminhos de exportação incluídos:

- **Backup**: Definições → Backup → Criar Backup. Descarrega
  um JSON com timestamp com todas as linhas da sua conta. As
  chaves de API são removidas. Funciona em ambos os modos de
  armazenamento.
- **Relatórios de Progresso / Sessão / Currículo**: Definições
  → Exportar. Markdown + PDF (impressão para PDF do navegador).
- **Anki .apkg**: reveja os flashcards extraídos pela IA na
  página `/anki`, aceite os que gosta, clique em Exportar.
  O ficheiro funciona diretamente no Anki desktop.
- **ZIP NotebookLM**: a partir da página de Progresso, descarregue
  um ZIP estruturado (resumo + vocabulário + regras + erros +
  flashcards + sessões) formatado para o upload de fontes do
  NotebookLM.

## O que é a funcionalidade de voz?

Três integrações da Web Speech API (desde v1.18.0):

- **Texto para Fala** nas respostas da IA + resultados da
  Avaliação — um botão ▶ ao lado de cada um fala-o em voz
  alta, com correspondência de idioma.
- **Fala para Texto** na entrada da Sessão — um botão 🎤
  captura a sua voz e preenche a área de texto com transcrições
  provisórias antes de enviar.
- **Prática de Pronúncia** para projetos de idiomas — visite
  `/pronunciation`, a IA gera uma frase alvo, você fala, e
  uma IA juiz pontua a semelhança + sugere melhorias.

As alternâncias de voz ficam em Definições → Voz. A secção
oculta-se nos navegadores que não suportam a API.

## O que é a importação de historial de chat?

A página de Importação (`/import`) aceita transcrições de
chat coladas ou carregadas do ChatGPT, Claude.ai (tanto
exportação JSON em massa como exportação Markdown de conversa
única), Gemini e Markdown arbitrário. O analisador extrai o
seu tópico, pontos fracos, padrões de erros, método
recomendado, vocabulário (para conversas em idiomas) e um
currículo sugerido. Um clique semeia um Currículo + inicia
uma sessão direcionada a partir da análise.

A exportação Markdown por conversa do Claude.ai foi o caso de
auditoria v1.19.0 — o analisador inclui extração completa de
timestamps + preservação de limite de papel para esse formato
(BL-25 / BL-26 / BL-28 fechados na v1.19.1).

## Sincronização entre dispositivos?

Sincronização bidirecional em rede local desde v1.0.0.
Definições → Sincronização → "Emparelhar este dispositivo":
digitalize o código QR no ecrã do outro dispositivo (câmara
traseira), ou cole o URL de emparelhamento. Uma vez emparelhado,
os botões de envio + receção trocam dados; os conflitos passam
por um resolvedor de fusão de IA. 28 tabelas na superfície de
sincronização a partir de v1.19.0 (assuntos + etiquetas +
questões de estudo incluídas).

## Como é diferente do ChatGPT?

O ChatGPT é uma interface de chat para um único modelo. O
Adaptive Learner é um *sistema de aprendizagem estruturado*
que usa uma IA internamente mas adiciona:

1. **Uma matriz de 6 métodos × 7 passos** de prompts de sistema
   personalizados.
2. **Avaliação de passo por turno** — uma segunda chamada de IA
   julga a prontidão e pode movê-lo para a frente / para trás.
3. **Auto-loop para novos ciclos** quando o tópico é integrado.
4. **Um perfil** das suas preferências de aprendizagem da
   avaliação de 12 perguntas.
5. **Rastreamento a longo prazo** — ProgressCommits, mapa de
   calor de sequência, XP, emblemas, gráficos de tempo por
   passo. O ChatGPT esquece quando fecha o separador.
6. **Liberdade de fornecedor** — Anthropic, OpenAI ou Gemini.
7. **Opção local primeiro** — tudo no seu navegador, nada
   enviado para um servidor (exceto as suas chamadas de IA).

## E se a IA correr mal?

O sistema falha visivelmente:

- **Chave de API errada**: a chamada de IA devolve uma mensagem
  de erro clara, apresentada em linha no chat.
- **Fornecedor em baixo**: o mesmo — o erro renderiza o estado
  HTTP da API do fornecedor.
- **Falha na análise de JSON do avaliador**: um avanço
  determinístico de +1 entra em ação (limitado ao passo 7),
  com `fallback_used: true` registado para que uma auditoria
  futura possa identificar modelos que têm dificuldades com
  o formato.
- **Streaming abortado a meio da resposta**: a resposta parcial
  é guardada; a próxima mensagem continua a partir daí.
- **Resposta de IA obsoleta ou estranha**: termine a sessão,
  dê-lhe uma avaliação baixa, recomece. A heurística de mudança
  de método apresentará um método diferente se o padrão persistir.
