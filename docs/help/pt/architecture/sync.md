# Arquitetura de sincronização

O Adaptive Learner é local-first: o modo servidor (API) mantém os
dados no sistema de ficheiros, o modo apenas browser (Dexie) no
IndexedDB. A **sincronização** destina-se a ligar estes
dispositivos através da rede local. A referência completa está em
[`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md).

---

## Três papéis de dispositivo

A interface de sincronização tem um aspeto diferente consoante o
papel do dispositivo - e só é mostrada onde é utilizável:

| Papel | Modo de armazenamento | Interface de sync |
|---|---|---|
| Desktop (servidor) | API | gerar QR, status, "Sincronizar agora" |
| Móvel (cliente) | Dexie | ler QR / colar link, status após emparelhamento |
| Apenas-PWA | Dexie | nenhuma |

---

## SYNC-UI-GATE: mostrar apenas o que funciona

Uma função não disponível **não é oferecida** - sem botões mortos,
sem marcadores de posição esbatidos. Atualmente (a fase de
emparelhamento LAN ainda não está implementada), a secção de
sincronização é, por isso, visível **apenas no modo API**; sem um
fluxo de emparelhamento funcional, a interface de cliente móvel iria
funcionar no vazio.

Quando o modo LAN chegar, o gate binário (API vs. Dexie) será
reconstruído no gate de três valores da tabela acima. A interface de
emparelhamento **não** será reativada antes no modo Dexie, para que
no deployment apenas-PWA não surja nenhum elemento de controlo morto.

---

## Páginas relacionadas

- [Camada de armazenamento](../developer/storage-layer.md) - a abstração dupla de armazenamento
- [Backup e restauro](../features/backup.md) - transferência manual de dados sem sync
- [`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
