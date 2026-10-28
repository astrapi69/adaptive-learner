# Arquitetura de sincronização

O Adaptive Learner é local-first. No modo de armazenamento Servidor
(internamente API), o backend da aplicação de desktop guarda os dados
de aprendizagem; apenas pouca coisa fica no browser, por exemplo
algumas definições e, até serem transferidas, as alterações guardadas
offline (ver [Definições](../user-guide/settings.md)). No modo de
armazenamento Local (Navegador), internamente chamado Dexie, os dados
ficam no IndexedDB do browser em que a aplicação corre. A
**sincronização** destina-se, no futuro, a ligar dispositivos através
da rede local; ainda não é utilizável (ver a secção SYNC-UI-GATE
abaixo). A referência completa está em
[`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md).

---

## Três papéis de dispositivo

A interface de sincronização está prevista de forma diferente
consoante o papel do dispositivo:

| Papel | Modo de armazenamento | Interface de sync |
|---|---|---|
| Desktop (servidor) | API | gerar QR, status, "Sincronizar agora" |
| Móvel (cliente) | Dexie | ler QR / colar link, status após emparelhamento |
| Apenas-PWA | Dexie | nenhuma |

---

## SYNC-UI-GATE: princípio e estado atual

O princípio é: mostrar apenas o que funciona. O modo LAN (fase 1) está
apenas parcialmente implementado e ainda não é utilizável. Das vistas
de emparelhamento, até agora só está acessível a que gera um link de
emparelhamento, e mesmo essa apenas no modo de armazenamento Servidor
da aplicação de desktop; a vista que resgata o link noutro dispositivo
(colar o link, ler o código QR) está desativada de propósito. O gate
orienta-se pelo modo de armazenamento:

- No modo de armazenamento **Servidor** (internamente API), que só
  existe na aplicação de desktop, a área *Definições > Dados > Sincronização*
  oferece apenas a geração de um link de emparelhamento: mostra campos
  de introdução para o host e a porta e o botão "Gerar código de
  pareamento"; depois de um clique nele aparecem um código QR, o link
  de emparelhamento e um botão de copiar.
- No modo de armazenamento **Local (Navegador)**, internamente chamado
  Dexie, a área continua visível, mas, em vez de controlos, mostra o
  aviso "Disponível apenas com o aplicativo para desktop." A versão de
  browser usa sempre este modo de armazenamento, também como aplicação
  web instalada (PWA); na aplicação de desktop também é possível
  escolhê-lo. As funções que só funcionam com o backend da aplicação de
  desktop são, desde #335/#336, desativadas com um aviso em vez de
  ocultadas; se a sincronização está desativada decide-o o modo de
  armazenamento, não o tipo de aplicação.
- A vista de resgate só apareceria no modo de armazenamento Local
  (Navegador), onde a área está desativada; por isso nunca aparece.

Como nenhum dispositivo pode ser emparelhado, também não aparece a
vista para um dispositivo emparelhado e, com ela, também não o seu
botão "Sincronizar agora"; a sincronização não troca dados.

Hoje a área afasta-se do princípio, entre outras, destas formas:

- A sua descrição "Emparelhar dispositivos e manter os dados
  alinhados." promete um emparelhamento e um alinhamento dos dados que
  ainda não existem.
- No modo de armazenamento Servidor, a aplicação de desktop oferece a
  geração de um link de emparelhamento que ainda nenhum dispositivo
  consegue resgatar.
- O aviso "Disponível apenas com o aplicativo para desktop." remete
  para a aplicação de desktop, com a qual também ainda não é possível
  sincronizar; na própria aplicação de desktop aparece no modo de
  armazenamento Local (Navegador).

Quando o modo LAN estiver implementado, o gate binário (API vs. Dexie)
deverá passar a ser o gate de três valores da tabela acima. A vista de
resgate só deverá voltar a ser ativada com esse gate. Se fosse ativada
enquanto ainda vigora o gate binário, apareceria em todos os
dispositivos no modo de armazenamento Local (Navegador), porque esse
gate não distingue os papéis "Móvel (cliente)" e "Apenas-PWA". Aí seria
um elemento de controlo morto: enquanto o modo LAN não estiver
implementado, em cada um desses dispositivos, e mesmo depois da sua
implementação ainda em dispositivos com o papel "Apenas-PWA", enquanto
vigorar o gate binário.

---

## Páginas relacionadas

- [Camada de armazenamento](../developer/storage-layer.md) - a abstração dupla de armazenamento
- [Backup e restauro](../features/backup.md) - transferência manual de dados sem sync
- [`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
