# Descubrir contenido

**Descubrir** es donde encuentras nuevos conjuntos de lecciones de
toda la biblioteca y los descargas. Está en la **pestaña Descubrir
dentro del hub de contenido** (`/content`); el antiguo enlace
`/discover` sigue funcionando y redirige allí.

La separación es deliberada: **Mi contenido** muestra solo lo que
ya has descargado, mientras que **Descubrir** es el catálogo que
exploras y del que descargas. Así tu superficie de aprendizaje
diaria queda libre de conjuntos que aún no has elegido.
**Descubrir es la pestaña predeterminada** del hub de contenido, de
modo que quien lo visita por primera vez recibe orientación para
encontrar contenido en lugar de una página "Mi contenido" vacía.

<!-- TODO: Captura de pantalla - la pestaña Descubrir con la barra de búsqueda/filtros, el conmutador de vista y los botones de descarga por conjunto -->

---

## Búsqueda y filtros

Descubrir se apoya en un **índice de búsqueda** sobre el catálogo.
En la parte superior hay una **barra compacta para alternar entre
Buscar y Filtrar**: toca **Buscar** para escribir una consulta, o
**Filtrar** para acotar el catálogo con **filtros combinables** -
**idioma**, **nivel**, **área**, nivel de **confianza** y
**verificado por IA**. La búsqueda y los filtros funcionan juntos,
y la barra se mantiene compacta (solo despliega la parte que estás
usando), para que no ocupe el espacio de los resultados en
pantallas pequeñas.

Al escribir se filtra al instante por títulos de conjuntos,
descripciones, dominios, títulos de lecciones, anversos y reversos
de tarjetas, y etiquetas. La búsqueda tolera mayúsculas/minúsculas
y acentos, y entiende los dígrafos alemanes (ae/oe/ue/ss). El
índice se construye de forma diferida en la primera interacción -
sin llamada al backend, funciona en ambos modos de almacenamiento.

---

## Vista de lista y de cuadrícula

Descubrir respeta la misma **preferencia global de vista de
contenido** que *Mi contenido*: un **conmutador de vista** cambia
el catálogo entre una **lista** compacta (la predeterminada) y una
**cuadrícula** de tarjetas más rica. Si lo cambias aquí, también
cambia en *Mi contenido*, y la elección se recuerda. También puedes
configurarla en **Ajustes > General > Apariencia**.

---

## Descargar un conjunto

Cada resultado tiene una acción **Descargar**. Al descargar, el
conjunto se copia en tu caché local (IndexedDB en modo solo
navegador, la caché del sistema de archivos en modo servidor),
tras lo cual aparece en **Mi contenido** y se puede practicar sin
conexión.

Cada conjunto muestra una **insignia de origen** - Oficial /
Incluido, tu propio repo conectado o Recomendado oficialmente. El
filtro de **confianza** (ver arriba) acota el catálogo a un único
origen o nivel de confianza. Consulta
[Varios repositorios de contenido](content-repos.md) para conectar
y gestionar tus propios orígenes.

---

## Pestaña Importar

El hub de contenido también ofrece una pestaña **Importar** para
traer una exportación de chat o un único archivo de lección. Los
**botones de acción** de importación/creación y tus
**Mis lecciones** (las lecciones que has creado o importado) también
están ahora aquí. Los enlaces antiguos de `/import` redirigen a
ella.

---

## Páginas relacionadas

- [Explorador de contenido](content-browser.md) - tu "Mi contenido" descargado
- [Varios repositorios de contenido](content-repos.md) - orígenes y niveles de confianza
- [Lecciones y repasos](../user-guide/lessons.md) - el flujo de la lección
