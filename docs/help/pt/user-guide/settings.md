<!-- Translation: AI-generated, pending native review -->

# Definições

A página de Definições reúne tudo o que pode ajustar sem
tocar em código ou YAML. Secções, de cima para baixo:

1. **Idioma** — idioma da interface (DE / EN / ES / FR / EL /
   PT / TR / JA, todos totalmente traduzidos).
2. **Fornecedor de IA + seletor de modelo** — qual fornecedor
   vê as suas mensagens e qual modelo usar.
3. **Chaves de API** — chaves por fornecedor com atribuição de
   fonte (env / `secrets.yaml` / Definições).
4. **Modo de armazenamento** — Servidor (FastAPI + SQLite) vs
   Local (IndexedDB do navegador).
5. **Sincronização** — emparelhe este dispositivo com outro
   pela rede local.
6. **Backup** — exportar / importar / comparar.
7. **Voz** — alternâncias de TTS + STT + pronúncia.
8. **Interface** — gestos + tema + densidade.
9. **Gamificação** — notificações de XP / emblemas + modo de
   fim de semana.
10. **Sobre** — versão, informações do sistema, créditos,
    doações, licença.

## Idioma

Troca em tempo real todas as strings da interface na próxima
renderização via `PATCH /api/settings/{user_id}`. Todos os 8
idiomas são de primeira classe — DE / EN / ES / FR / EL / PT /
TR / JA — cada um com um catálogo totalmente traduzido.
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

- **Chave de: Definições** — a chave está armazenada com
  encriptação Fernet na BD (modo Servidor) ou em texto simples
  no IndexedDB (modo Local). Pode Guardar / Remover livremente.
- **Chave de: secrets.yaml** — a chave está configurada em
  `~/.config/adaptive-learner/secrets.yaml`. O botão Guardar
  está desativado; edite o ficheiro diretamente para alterá-la.
  Um banner informativo abaixo da linha lembra-o do caminho.
- **Chave de: ambiente** — a chave está configurada via a
  variável de ambiente `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`.
  Guardar desativado; a variável de ambiente é a fonte da
  verdade.
- **Sem chave configurada** — nada está definido em lado
  nenhum. Escreva e clique em Guardar para começar.

Cadeia de resolução (maior prioridade ganha): env >
secrets.yaml > BD. Consulte [o documento de Configuração](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)
para a análise completa.

## Modo de armazenamento

A alternância entre armazenamento **Servidor** e **Local
(Navegador)**:

- **Servidor** — cada leitura e escrita atinge o backend
  FastAPI. Requer um backend em execução. Melhor para uso em
  múltiplos dispositivos com sincronização do lado do backend.
- **Local (Navegador)** — cada leitura e escrita atinge o
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

## Voz

Três alternâncias:

- **TTS ativado** — adiciona um botão ▶ ao lado das respostas
  da IA + resultados da Avaliação que as lê em voz alta. Escolhe
  a voz correspondente ao idioma quando disponível; taxa +
  pitch limitados a [0.5, 2.0].
- **Reprodução automática da IA** — fala cada resposta da IA
  automaticamente (padrão DESLIGADO — áudio surpresa raramente
  é o que quer).
- **STT ativado** — adiciona um botão 🎤 à entrada da Sessão
  que captura a fala e preenche a área de texto com transcrições
  provisórias antes de enviar.
- **Prática de Pronúncia ativada** — apresenta a página
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

A **alternância de Gestos** (padrão LIGADO para
dispositivos com toque) cobre a navegação por deslize da
Avaliação, a revelação por deslize de tópicos do Currículo e
a espiada de ciclo da Sessão. Também aqui: dicas de ferramentas
de botões e Modo de Programador.

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
