# Navegación

La navegación principal de la app es un pequeño conjunto de
**entradas agrupadas** (EXP-037, siguiendo la pauta de Nielsen-Norman
de "5-7 elementos") **sin pérdida de funciones**: todas las páginas
siguen siendo accesibles y los enlaces antiguos siguen funcionando
mediante redirecciones.

<!-- TODO: Captura de pantalla - la navegación principal agrupada y la barra de pestañas inferior del móvil -->

---

## Escritorio: entradas agrupadas

La navegación de escritorio está organizada en grupos con etiqueta
mediante un componente reutilizable `NavGroup`:

- **Aprender** - Panel, Ruta de aprendizaje y Sesión.
- **Contenido** - el **hub de contenido** (`/content`) con cuatro
  pestañas: *Descubrir* (el catálogo), *Mi contenido* (lo que
  descargaste), *Importar* y *Crear* (una lección nueva propia). El
  hub se abre en la primera pestaña de tu orden; por defecto es
  Descubrir. Puedes cambiar el orden en *Ajustes > General >
  Apariencia*.
- **Progreso** - el **ProgressHub** (`/progress`), con Resumen,
  Estadísticas y Mis rutas como pestañas.
- **Ajustes** y **Ayuda** completan la barra.

Anki no es una entrada propia; es una acción de la página Contenido, y
su ruta `/anki` sigue funcionando.

### Una navegación principal por viewport

En anchuras de escritorio, la barra superior horizontal es la
**única** navegación principal: no hay botón de hamburguesa ni cajón.
En anchuras estrechas o de móvil, las mismas entradas agrupadas pasan
a un **cajón hamburguesa**. Ambas presentaciones se generan a partir
de una única lista compartida de destinos, así que siempre llevan a
las mismas páginas. El elemento activo lleva `aria-current`, cada
objetivo mide al menos 44px y funciona con todos los temas. (La
página de Ajustes tiene su propia barra lateral de secciones para sus
pestañas, que no tiene relación con la navegación principal.)

---

## Móvil: barra de pestañas inferior (opcional)

En un teléfono, la navegación está arriba como botón de menú de forma
predeterminada. En *Ajustes > General > Interfaz*, **Posición del menú
(móvil)** la cambia a **Abajo (barra de pestañas)**, una barra con
cinco pestañas al alcance del pulgar: **Aprender / Contenido / Ruta de
aprendizaje / Progreso / Más**. *Más* abre una hoja inferior con
Ajustes y Ayuda. El cajón hamburguesa sigue disponible en ambas
posiciones. Los objetivos miden 44px, la barra respeta todos los temas
y se oculta en el embudo de onboarding y durante una lección, para que
nada tape el contenido.

---

## Hubs y redirecciones

Dos páginas son **hubs con pestañas**, que solo montan la pestaña
activa:

- **ProgressHub** (`/progress`) integra Progreso + Estadísticas de
  aprendizaje + Currículo.
- **Hub de contenido** (`/content`) integra Descubrir + Mi contenido +
  Importar + Crear.

Las URL antiguas se conservan mediante redirecciones, p. ej.
`/statistics` → `/progress?tab=stats`, `/curriculum` →
`/progress?tab=paths`, `/discover` → `/content?tab=discover`,
`/import` → `/content?tab=import`.

---

## Páginas relacionadas

- [Progreso](progress.md) - las pestañas del ProgressHub
- [Explorador de contenido](../features/content-browser.md) - Mi contenido
- [Descubrir contenido](../features/discover.md) - el catálogo
