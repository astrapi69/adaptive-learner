<!-- Translation: AI-generated, pending native review -->

# Definições

A página de Definições reúne tudo o que pode ajustar sem
tocar em código ou YAML. Secções, de cima para baixo:

1. **Idioma** - idioma da interface (DE / EN / ES / FR / EL /
   PT / TR / JA, todos totalmente traduzidos).
2. **Fornecedor de IA + seletor de modelo** - qual fornecedor
   vê as suas mensagens e qual modelo usar.
3. **Chaves de API** - chaves por fornecedor com atribuição de
   fonte (env / `secrets.yaml` / Definições).
4. **Modo de armazenamento** - Servidor (FastAPI + SQLite) vs
   Local (IndexedDB do navegador).
5. **Sincronização** - emparelhe este dispositivo com outro
   pela rede local.
6. **Backup** - exportar / importar / comparar.
7. **Voz** - alternâncias de TTS + STT + pronúncia.
8. **Interface** - tema + densidade.
9. **Aprendizagem** - cinco áreas: Fundamentos, Na lição, Leitura em
   voz alta e ditado, Depois da lição, Motivação e rotina.
10. **Gamificação** - notificações de XP / emblemas + modo de
    fim de semana.
11. **Sobre** - versão, informações do sistema, créditos,
    doações, licença.

## Idioma

Troca em tempo real todas as strings da interface na próxima
renderização via `PATCH /api/settings/{user_id}`. Todos os 8
idiomas são de primeira classe - DE / EN / ES / FR / EL / PT /
TR / JA - cada um com um catálogo totalmente traduzido.
Persistido entre recarregamentos via `localStorage`.

## Fornecedor de IA + seletor de modelo

O menu suspenso do fornecedor escreve `active_provider` em
UserSettings; a próxima chamada de IA passa pelo plugin do
novo fornecedor (modo Servidor) ou pelo cliente HTTP do novo
fornecedor (modo Local).

O **seletor de Modelo** é um menu suspenso
pesquisável agrupado em Recomendado / Todos, preenchido a
partir do endpoint `/v1/models` em tempo real de cada
fornecedor (cache de 1h). Cada linha mostra o nome legível +
id bruto + emblema de janela de contexto. Quando a lista
descoberta não está disponível (sem chave de API, sem rede),
o seletor usa os padrões estáticos e apresenta uma dica
"usando padrão offline". O cabeçalho da Sessão lê
`<Fornecedor>: <Nome do modelo>`; o id completo + janela de
contexto ficam na dica de ferramenta.

## Chaves de API

Cada fornecedor tem a sua própria linha: uma entrada de chave,
um botão Guardar, um botão Remover, o emblema de fornecedor
ativo, mais o novo emblema de **atribuição de fonte**:

- **Chave de: Definições** - a chave está armazenada com
  encriptação Fernet na BD (modo Servidor) ou em texto simples
  no IndexedDB (modo Local). Pode Guardar / Remover livremente.
- **Chave de: secrets.yaml** - a chave está configurada em
  `~/.config/adaptive-learner/secrets.yaml`. O botão Guardar
  está desativado; edite o ficheiro diretamente para alterá-la.
  Um banner informativo abaixo da linha lembra-o do caminho.
- **Chave de: ambiente** - a chave está configurada via a
  variável de ambiente `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`.
  Guardar desativado; a variável de ambiente é a fonte da
  verdade.
- **Sem chave configurada** - nada está definido em lado
  nenhum. Escreva e clique em Guardar para começar.

Cadeia de resolução (maior prioridade ganha): env >
secrets.yaml > BD. Consulte [o documento de Configuração](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)
para a análise completa.

## Modo de armazenamento

A alternância entre armazenamento **Servidor** e **Local
(Navegador)**:

- **Servidor** - cada leitura e escrita atinge o backend
  FastAPI. Requer um backend em execução. Melhor para uso em
  múltiplos dispositivos com sincronização do lado do backend.
- **Local (Navegador)** - cada leitura e escrita atinge o
  IndexedDB neste navegador. As chamadas de IA disparam
  diretamente para o fornecedor. Sem backend necessário. Melhor
  para uma configuração privada e local do dispositivo.

Mudar de modo guarda em `localStorage` e apresenta uma
notificação "reinício necessário". Os dados NÃO são
sincronizados entre modos.

## Sincronização

Emparelhe este dispositivo com outro pela sua rede local
usando o leitor de código QR (câmara traseira) ou cole o
URL de emparelhamento. Uma vez emparelhado, os botões de
envio + receção trocam dados bidirecionalmente. Os conflitos
passam por um resolvedor de fusão de IA no backend.

Fallback de navegador restrito: carregue uma captura de ecrã
do código QR do seu outro dispositivo (`Html5Qrcode.scanFile`).

## Backup

Três coisas numa secção: **Exportar** (transferir um JSON com
timestamp), **Importar** (restaurar a partir de ficheiro) e
**Comparar** (diferença lado a lado com o estado atual). As
chaves de API são removidas de todas as exportações.

Restaurar é uma FUSÃO, não uma substituição: novas linhas
inserem, linhas mutáveis atualizam em `updated_at` mais
recente, linhas de historial (sessões / commits / avaliações)
deduplicam em UUID. A pré-visualização de comparação mostra
por tabela adicionado / removido / alterado antes de clicar
em Restaurar; o rótulo do botão Restaurar lê "Restaurar
(N adicionados, M atualizados)" assim que a diferença se
estabiliza.

No modo Local a secção também mostra o bloco de **Backup
automático**: anel rotativo de 3 instantâneos numa BD IndexedDB
separada, corre a cada 10 sessões OU a cada 7 dias (o que
ocorrer primeiro). Cada instantâneo tem os seus próprios
botões Restaurar + Eliminar + Comparar-como-A/B.

### Arrumação

Duas definições do ciclo de vida dos dados ficam no separador Dados, mesmo
ao lado do armazenamento a que dizem respeito:

- **Tamanho máximo de aula** (logo abaixo de *Cache off-line*): quando uma
  análise de chat longa é guardada como lição offline, as lições com mais
  etapas do que este número são divididas em várias partes. *Etapas por
  parte* aceita de 5 a 20; o padrão é 10.
- **Retenção de aulas pausadas** (logo acima da limpeza *Conteúdo
  desconectado*, que só aparece quando há algo para limpar): as lições
  pausadas mais antigas do que este período são abandonadas automaticamente
  no próximo carregamento do Dashboard. Escolha 7, 14, 30 ou 60 dias, ou
  *Nunca*; o padrão é 30 dias. Até 10 lições pausadas são mantidas
  independentemente da idade.

Ambos os valores são guardados neste navegador e aplicam-se tanto no modo
Servidor como no modo Local.

## Voz

Três alternâncias:

- **TTS ativado** - adiciona um botão ▶ ao lado das respostas
  da IA + resultados da Avaliação que as lê em voz alta. Escolhe
  a voz correspondente ao idioma quando disponível; taxa +
  pitch limitados a [0.5, 2.0].
- **Reprodução automática da IA** - fala cada resposta da IA
  automaticamente (padrão DESLIGADO - áudio surpresa raramente
  é o que quer).
- **STT ativado** - adiciona um botão 🎤 à entrada da Sessão
  que captura a fala e preenche a área de texto com transcrições
  provisórias antes de enviar.
- **Prática de Pronúncia ativada** - apresenta a página
  `/pronunciation` a partir do início rápido do Dashboard para
  projetos marcados como Línguas.

A secção de Voz oculta-se quando nenhum lado da Web Speech API
(síntese nem reconhecimento) é suportado pelo navegador.

## Aparência

O seletor de **Tema** em *Geral > Aparência* oferece seis
temas mais um modo automático:

- **Claro** - o padrão, brilhante e de alto contraste.
- **Escuro** - superfícies atenuadas para uso com pouca luz.
- **Oceano** - tons de azul profundo, calmo e suave para os
  olhos à noite.
- **Floresta** - tons terrosos quentes de verde e âmbar.
- **Alto Contraste** - acessibilidade em primeiro lugar: preto,
  branco e cores de sinal a negrito, com arestas de cartão
  nítidas. Use este se precisar de máxima legibilidade.
- **Sépia** - tons de papel quentes, confortáveis para leitura
  prolongada.
- **Auto (Sistema)** - segue a configuração claro/escuro do seu
  sistema operativo e muda automaticamente quando o sistema o faz.

Escolha um tema a partir do seu cartão de pré-visualização; a
alteração aplica-se instantaneamente sem recarregamento, e a
sua escolha é lembrada entre visitas. Todos os temas são
concebidos para cumprir o contraste WCAG 2.1 AA, por isso o
texto, gráficos, emblemas e feedback de exercícios mantêm-se
legíveis em todos eles.

## Interface

Dois controlos: as **dicas de ferramentas dos botões** (uma dica ao passar
o rato sobre botões de ícone; as etiquetas para leitores de ecrã mantêm-se
ativas de qualquer forma) e a **Posição do menu (celular)** (em cima como
botão de menu, o padrão, ou embaixo como barra de abas ao alcance do
polegar). Os gestos de deslizar são uma definição de lição e vivem em
*Aprendizagem > Na lição > Interação*.

O **Modo de Programador** (no separador **Diagnóstico e suporte**) tem um
padrão que depende do ramo de build: está **LIGADO por padrão no ramo
Latest (pré-visualização)** e **DESLIGADO em Main**, para que os testadores
da pré-visualização vejam o detalhe técnico completo dos erros enquanto os
utilizadores de produção recebem mensagens amigáveis. Pode alterá-lo a
qualquer momento.

## Aprendizagem

O separador **Aprendizagem** agrupa os seus cartões em cinco áreas
etiquetadas, pela ordem em que uma lição decorre. Cada área tem um pequeno
título e uma descrição de uma linha; os cartões lá dentro mantêm os seus
próprios títulos.

### Fundamentos

Quem aprende e em que idiomas.

- **Perfil de aprendizagem** - criar, continuar ou refazer o perfil de
  aprendizagem por trás dos pesos dos seis métodos.
- **Idiomas de origem adicionais** - que idiomas de origem a árvore de
  conteúdo mostra além do idioma da aplicação.

### Na lição

Como os exercícios se comportam enquanto você responde.

- **Modo de lição** - o **Modo padrão** (Prática / Exame / Cronometrado),
  o **Limite para aprovação** do exame e a **Dificuldade do modo
  cronometrado** (Rápido, Normal, Relaxado); consulte
  [Lições e revisões](lessons.md).
- **Dicas** - se aparece um botão de dica por etapas em cada exercício, e
  o **custo em XP por dica** (0 para dicas gratuitas).
- **Interação** - **Gestos de deslizar** (deslizar para navegar na
  Avaliação, na Sessão e no Currículo; padrão LIGADO em dispositivos com
  toque), **Atalhos de teclado nas lições** (Enter verifica a resposta,
  Enter de novo avança), **Avançar automaticamente após uma resposta
  correta** e se o botão **Perguntar à IA** é mostrado.
- **Direção de exercício preferida** - com que direção os exercícios
  direcionais abrem.
- **Animação de resolução** - o efeito que um exercício de correspondência
  resolvido reproduz.

### Leitura em voz alta e ditado

Vozes, velocidade, microfone e prática de pronúncia.

- **Voz** - as alternâncias descritas acima em *Voz*: texto para fala,
  reprodução automática, fala para texto e prática de pronúncia.

Esta área só aparece quando o navegador suporta pelo menos um lado da Web
Speech API (síntese ou reconhecimento). Caso contrário está ausente,
título incluído, e *Depois da lição* segue-se diretamente a *Na lição*.

### Depois da lição

Sessões de revisão, o resumo da lição e a repetição de erros.

- **Revisão** - as explicações de erros geradas automaticamente e o número
  de perguntas por sessão de revisão. O cartão termina com o bloco só de
  leitura **Repetição espaçada**: o calendário de intervalos (respostas
  corretas seguidas contra dias até à próxima revisão), quando um item
  conta como dominado, e uma ligação para o método de aprendizagem.
- **Resumo após as lições** - que secções o resumo de fim de lição
  mostra, e por que ordem.
- **Repetir erros** - que erros a ronda de repetição recolhe.

### Motivação e rotina

Modo de jogo, feedback, missões diárias e lembretes.

- **Modo jogo** - lições lúdicas, incluindo a **Variante do mascote**, os
  esquemas de cores do Lernfunke que se desbloqueiam com níveis e emblemas
  ou em troca de XP (as variantes bloqueadas mostram a sua condição, as
  compras pedem uma confirmação em dois passos). O que o modo de jogo muda
  em detalhe está em [Elogios e celebrações](celebrations.md).
- **Feedback** - intensidade do feedback e sons (volume, botão de teste).
- **Missões diárias** - se as missões estão ativas, quantas por dia, a
  mistura de dificuldade e um baralhar das missões de hoje.
- **Lembretes** - a hora do lembrete e os dias em que se aplica.

O cartão do modo de jogo mostra o interruptor principal, os sons do modo de
jogo e uma linha de estado que conta quantos extras estão ativados.
**Detalhes do modo de jogo** (corações, contagem regressiva, arcade,
rodadas especiais, tickets, lições bônus, XP de sequência e mascote) está
recolhido e lembra a sua escolha; enquanto **Lições lúdicas** estiver
desligado, as opções lá dentro ficam esbatidas.

O separador termina com os lembretes. As duas definições de arrumação -
*Retenção de aulas pausadas* e *Tamanho máximo de aula* - são definições
do ciclo de vida dos dados e vivem no separador **Dados** (consulte
*Arrumação* em Backup).

A **Visualização de conteúdo** (lista / grelha) e a **Ordem das abas de
Conteúdo** estão no separador **Geral** em *Aparência*.

## Gamificação

Alternâncias para notificações de XP / emblemas / subida de
nível (desligado silencia as notificações toast mas o sistema
continua a registar o estado), **modo de fim de semana** (ignorar
lacunas de Sáb/Dom no mapa de calor de sequência), objetivo de
sessão diária (1..10) e **Reiniciar progresso** (confirmação
dupla; apaga linhas de `user_xp` + `user_badges` + `user_streaks`).

## Sobre

Cinco blocos só de leitura: **Versão** (versão canónica do
`pyproject.toml`, hash de construção, data de construção),
**Sistema** (modo de armazenamento, diretório de dados, caminho
da BD no modo Servidor, Python + informações da plataforma),
**Créditos** (autor, reconhecimentos de dependências),
**Apoiar o desenvolvimento** (ligações para Liberapay /
GitHub Sponsors / Ko-fi), **Licença e recursos** (ligação MIT,
repositório, documentação, rastreador de problemas).

No modo Local o painel oculta as linhas que apenas fazem
sentido para um backend em execução (versão do Python, versões
do FastAPI / SQLAlchemy / Pydantic / PluginForge, caminho da BD).
