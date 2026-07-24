# Copia de seguridad y restauración

Adaptive Learner puede guardar todo tu estado de aprendizaje en un
único archivo y restaurarlo en otro dispositivo, en una
instalación nueva o tras cambiar de navegador. Encuentras todo en
**Ajustes → Datos**.

<!-- TODO: Captura de pantalla - Ajustes → Datos con los botones "Crear copia de seguridad" y "Restaurar" -->

---

## Qué contiene la copia de seguridad

Una copia de seguridad es un **snapshot completo**: las 30 tablas
de datos (proyectos de aprendizaje, sesiones, progreso de
lecciones, errores a nivel de elemento, gamificación con
XP/racha/insignias, misiones, tarjetas de Anki, notas y más)
**más tus conjuntos de contenido descargados**. No queda nada
importante atrás.

Antes de exportar, la app muestra una vista previa **"Tu copia de
seguridad contiene…"** con recuentos de registros por área, para
que veas antes de guardar qué se está respaldando.

---

## Crear una copia de seguridad

1. Abre **Ajustes → Datos**.
2. Pulsa **Crear copia de seguridad**.
3. En modo navegador puro puedes elegir directamente una
   ubicación de guardado mediante la API File System Access
   ("Guardar en disco"); si el navegador no lo admite, la app
   descarga el archivo en su lugar.

**Copia de seguridad automática:** opcionalmente, la app mantiene
un anillo rotativo con los últimos snapshots, para que nunca te
quedes sin respaldo.

---

## Restaurar

1. **Ajustes → Datos → Restaurar**.
2. Selecciona el archivo de copia de seguridad.
3. La app importa cada tabla y desplaza hacia arriba hasta un
   **resumen por tabla** (añadido / actualizado / omitido), para
   que veas exactamente qué se ha cargado.

Si algo sale mal durante la importación, aparece un **aviso de
error persistente** (toast) que no desaparece por sí solo, de modo
que no se te pase ningún error. En modo desarrollador (Ajustes →
Interfaz), el mensaje incluye los detalles técnicos para abrir un
issue en GitHub.

---

## Importación entre identidades

**No** tienes que ser el mismo usuario en el mismo dispositivo.
Una copia de seguridad se puede importar en una **instalación
nueva** o bajo un **perfil de usuario distinto**. La restauración
asigna los datos al perfil activo y, al hacerlo, vuelve a resolver
limpiamente las referencias internas (claves foráneas), de modo
que tu progreso se mantenga coherente, incluidos el progreso por
pasos de las lecciones, la racha y las insignias.

---

## Copia de seguridad al primer inicio de sesión

Cuando reinicias la app (o la abres por primera vez en un
dispositivo), Adaptive Learner te ofrece activamente cargar una
copia de seguridad existente en lugar de empezar con un estado
vacío. Así, tras cambiar de dispositivo o de navegador, vuelves de
inmediato a tu flujo de aprendizaje.

---

## Ambos modos de almacenamiento

La copia de seguridad y la restauración funcionan en **ambos**
modos de almacenamiento: servidor (API) y navegador puro
(Dexie/IndexedDB). El formato es un único archivo JSON; no existe
ningún formato de archivo propietario.

!!! note "Privacidad"
    La copia de seguridad queda por completo en tus manos. Solo se
    guarda allí donde tú la coloques: no se envía nada a ningún
    servidor.

---

## Páginas relacionadas

- [Ajustes](../user-guide/settings.md) - todas las acciones de datos de un vistazo
- [Varios repositorios de contenido](content-repos.md) - los repos conectados forman parte del snapshot
