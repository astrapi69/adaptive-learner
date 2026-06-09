# Arquitectura de sincronización

Adaptive Learner es local-first: el modo servidor (API) guarda los
datos en el sistema de archivos, y el modo navegador puro (Dexie)
en IndexedDB. La **sincronización** pretende conectar estos
dispositivos a través de la red local. La referencia completa está
en
[`docs/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/SYNC-ARCHITECTURE.md).

---

## Tres roles de dispositivo

La interfaz de sincronización tiene un aspecto distinto según el
rol del dispositivo, y solo se muestra allí donde es utilizable:

| Rol | Modo de almacenamiento | Interfaz de sincronización |
|---|---|---|
| Escritorio (servidor) | API | generar QR, estado, "Sincronizar ahora" |
| Móvil (cliente) | Dexie | escanear QR / pegar enlace, estado tras el emparejamiento |
| Solo PWA | Dexie | ninguna |

---

## SYNC-UI-GATE: mostrar solo lo que funciona

Una función no disponible **no se ofrece**: sin botones muertos,
sin marcadores de posición atenuados. Actualmente (la fase de
emparejamiento LAN aún no está implementada), la sección de
sincronización es por tanto visible **solo en API**; sin un flujo
de emparejamiento funcional, la interfaz del cliente móvil
quedaría en el vacío.

Cuando llegue el modo LAN, el gate binario (API frente a Dexie) se
reconvertirá en el gate de tres valores de la tabla anterior. La
interfaz de emparejamiento **no** se reactivará antes en el modo
Dexie, para que en el despliegue solo-PWA no surja ningún control
muerto.

---

## Páginas relacionadas

- [Capa de almacenamiento](../developer/storage-layer.md) — la abstracción de almacenamiento dual
- [Copia de seguridad y restauración](../features/backup.md) — transferencia manual de datos sin sincronización
- [`docs/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/SYNC-ARCHITECTURE.md)
