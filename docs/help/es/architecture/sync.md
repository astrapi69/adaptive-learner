# Arquitectura de sincronización

Adaptive Learner es local-first. En el modo de almacenamiento Servidor
(internamente API), el backend de la aplicación de escritorio guarda los
datos de aprendizaje; solo unas pocas cosas se quedan en el navegador,
por ejemplo algunos ajustes y, hasta que se transfieren, los cambios
guardados sin conexión (ver [Ajustes](../user-guide/settings.md)). En
el modo de almacenamiento Local (Navegador), llamado internamente Dexie,
los datos de aprendizaje residen en el IndexedDB del navegador en el que
se ejecuta la app. La **sincronización** pretende conectar en el futuro
dispositivos a través de la red local; todavía no es utilizable (ver la
sección SYNC-UI-GATE más abajo). La referencia completa está en
[`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md).

---

## Tres roles de dispositivo

La interfaz de sincronización está planificada de forma distinta según
el rol del dispositivo:

| Rol | Modo de almacenamiento | Interfaz de sincronización |
|---|---|---|
| Escritorio (servidor) | API | generar QR, estado, "Sincronizar ahora" |
| Móvil (cliente) | Dexie | escanear QR / pegar enlace, estado tras el emparejamiento |
| Solo PWA | Dexie | ninguna |

---

## SYNC-UI-GATE: principio y estado actual

El principio es: mostrar solo lo que funciona. El modo LAN (fase 1)
solo está implementado en parte y todavía no es utilizable. De las
vistas de emparejamiento, por ahora solo es accesible la que genera un
enlace de emparejamiento, y esta, además, solo en el modo de
almacenamiento Servidor de la aplicación de escritorio; la vista que
canjea el enlace en otro dispositivo (pegar el enlace, escanear el
código QR) está desactivada a propósito. El gate se rige por el modo de
almacenamiento:

- En el modo de almacenamiento **Servidor** (internamente API), que solo
  existe en la aplicación de escritorio, el área *Ajustes > Datos >
  Sincronización* solo ofrece generar un enlace de emparejamiento:
  muestra campos de entrada para el host y el puerto y el botón
  «Generar código de emparejamiento»; tras hacer clic en él aparecen un
  código QR, el enlace de emparejamiento y un botón para copiar.
- En el modo de almacenamiento **Local (Navegador)**, llamado
  internamente Dexie, el área sigue visible, pero no muestra controles,
  sino el aviso «Solo disponible con la aplicación de escritorio.» La
  versión de navegador usa siempre este modo de almacenamiento, también
  como aplicación web instalada (PWA); en la aplicación de escritorio
  también se puede elegir. Desde #335/#336, las funciones que solo
  funcionan con el backend de la aplicación de escritorio se desactivan
  con un aviso en lugar de ocultarse; si la sincronización está
  desactivada lo decide aquí el modo de almacenamiento, no el tipo de
  app.
- La vista para canjear solo aparecería en el modo de almacenamiento
  Local (Navegador), donde el área está desactivada; por eso no aparece
  nunca.

Como no se puede emparejar ningún dispositivo, tampoco aparece la vista
de un dispositivo emparejado y, con ella, tampoco su botón
«Sincronizar ahora»; la sincronización no intercambia datos.

Hoy el área se aparta del principio de estas formas, entre otras:

- Su descripción «Vincular dispositivos y mantener los datos al día.»
  promete vincular dispositivos y mantener los datos al día, y ninguna
  de las dos cosas existe todavía.
- En el modo de almacenamiento Servidor, la aplicación de escritorio
  ofrece generar un enlace de emparejamiento que todavía ningún
  dispositivo puede canjear.
- El aviso «Solo disponible con la aplicación de escritorio.» remite a
  la aplicación de escritorio, con la que tampoco se puede sincronizar
  todavía; en la propia aplicación de escritorio aparece en el modo de
  almacenamiento Local (Navegador).

Cuando el modo LAN esté implementado, el gate binario (API frente a
Dexie) debe convertirse en el gate de tres valores de la tabla
anterior. La vista para canjear no debe volver a activarse hasta que
exista este gate. Si se activara mientras siga vigente el gate binario,
aparecería en todos los dispositivos en el modo de almacenamiento Local
(Navegador), porque este gate no distingue los roles «Móvil (cliente)»
y «Solo PWA». Allí sería un control muerto: mientras el modo LAN no
esté implementado, en cada uno de esos dispositivos, y también después
de su implementación todavía en los dispositivos con el rol «Solo PWA»,
mientras siga vigente el gate binario.

---

## Páginas relacionadas

- [Capa de almacenamiento](../developer/storage-layer.md) - la abstracción de almacenamiento dual
- [Copia de seguridad y restauración](../features/backup.md) - transferencia manual de datos sin sincronización
- [`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
