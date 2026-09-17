# Novedades (v1.61 – v2.15)

Una visión general orientada al usuario de las versiones desde
v1.61.0. Las notas técnicas completas por versión están en
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases).

---

## v2.15.0 - Ejercicios más completos, resumen compacto de la lección

- **Ejercicios paramétricos:** una lección puede declarar variables
  cuyos valores se sortean de nuevo en cada intento; las respuestas
  numéricas se evalúan con un margen de tolerancia.
- **Tres tipos de ejercicio nuevos:** Zonas, Parsons y Ordenar,
  todos se pueden crear en el creador de lecciones.
- **Explicaciones después de la respuesta**; si creas una lección a
  partir de un texto, la IA puede redactarlas por ti.
- **Resumen compacto de la lección** (resultado y XP), a menos que
  hayas personalizado las secciones del resumen; **Evaluación
  detallada** abre la revisión completa.
- **Ajustes reorganizados:** secciones con título y una barra de
  secciones en las pestañas Aprendizaje y Datos; la app de escritorio
  muestra sus complementos instalados.
- **Refrescar** en Mis contenidos aplica de una vez todas las
  actualizaciones de sets disponibles, salvo las que afectarían a tu
  progreso; el hub de contenido tiene su propia pestaña Crear.
- Aviso legal y política de privacidad en alemán e inglés; arreglos
  para el móvil en el teclado de iOS, las cabeceras saturadas y las
  barras de pestañas de los hubs.

## v2.14.0 - Modo de juego y arcade

- **Modo de juego opcional:** rachas de combos, puntos que salen
  volando, puntos de control, física en las respuestas, corazones y
  cuenta atrás, además de su propio conjunto de sonidos.
- **Minijuegos de arcade** que se desbloquean con XP (Lern-Memory,
  Snake, TicTacToe, Simon), además de rondas relámpago al completar un
  set.
- Variantes de color para la mascota; avatares predefinidos y marcos
  ligados al desbloqueo de niveles e insignias.
- Las **páginas de set** muestran sus lecciones con su progreso, al
  salir de una lección vuelves a su set, y un repaso al completar el
  set reúne todos los errores del set.
- Los Ajustes incorporan la pestaña **Diagnóstico y soporte**.
- Tres tipos de extensión nuevos en el asistente de creación: hablar y
  grabar, elección de audio y mosaicos de audio.

## v2.13.0 - Convertir tipos de ejercicio

- **Cambia el tipo de un ejercicio ahí mismo** en el editor de
  lecciones; el historial de repaso se conserva cuando el contenido
  sigue siendo válido, y la IA rellena los campos que la conversión
  deja vacíos.
- **Editar como copia** directamente en un set descargado; tu copia se
  marca como edición propia, y al volver a importar un set se conserva
  el historial de repaso de los ejercicios sin cambios.
- La ronda de corrección al final de la lección vuelve a registrar tus
  respuestas, y la lectura en voz alta mantiene la pantalla encendida.

## v2.12.0 - Empezar un set de nuevo

- Empieza de nuevo un set terminado como una **ronda nueva**, mientras
  tu historial de repetición espaciada continúa.
- Importa claves de proveedores desde una exportación Topos `.alk`;
  **Perplexity** se suma a los proveedores de IA.

## v2.11.0 - Progreso estable

- El progreso de aprendizaje se ancla a **identidades de ejercicio
  estables**. Una migración local única en el primer arranque reasigna
  el progreso existente, así que las correcciones de contenido ya no
  dejan huérfanas tus tarjetas de repaso.
- Ejercicios de emparejamiento rediseñados: la ayuda está en la fila
  de botones y el contador de progreso, arriba.

## v2.10.0 - Seguridad: solo local por defecto

- **Se recomienda actualizar.** El lanzador de escritorio y el archivo
  compose vinculan ahora la app a `127.0.0.1`. Antes, cualquiera en la
  misma red podía abrirla sin autenticarse, incluidas las claves de IA
  guardadas.
- Si quieres acceder a la app desde otro dispositivo a propósito,
  define `ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0` en `.env`, y solo en
  una red de confianza.

## v2.9.0 - El lanzador vuelve a cerrarse

- El lanzador descargado se cierra cuando cierras su ventana, también
  en escritorios sin bandeja del sistema (por ejemplo Ubuntu GNOME).
  La app sigue funcionando en Docker.
- El orden de lecciones que defines marca ahora la secuencia de
  aprendizaje, y la edición pertenece a cada lección.

## v2.7.0–v2.8.2 - El lanzador usa una imagen publicada

- El lanzador de escritorio **descarga una imagen publicada y
  verificada** en lugar de compilarla en tu equipo (v2.7.0 se
  etiquetó, pero sus cambios llegaron a los usuarios con v2.8.0).
- Un aviso de recuperación ayuda a quienes perdieron el progreso de
  repaso de las lecciones A1 corregidas de japonés, coreano y chino;
  primero ofrece una copia de seguridad y nunca se ejecuta
  automáticamente.
- **Parche de seguridad v2.8.1/v2.8.2 (se recomienda actualizar):** la
  imagen v2.8.0 mostraba una página en blanco en el modo de imagen, y
  el contenedor por sí solo ya no arranca en modo de depuración.

## v2.6.0–v2.6.1 - Nuevo chat de sesión, lecciones desde libros

- El **chat de sesión** se ha reconstruido sobre assistant-ui.
- **Crear lecciones a partir de un libro:** sube un EPUB, TXT, MD o
  DOCX, elige los capítulos y genera una lección por cada sección
  seleccionada.
- El editor de dictado acepta archivos de audio subidos; los sets de
  contenido se pueden ocultar mediante su manifiesto.
- Lanzador: detección de Docker según el contexto e interfaz del
  lanzador traducida.

## v2.5.0 - Creación completa de ejercicios

- Todos los tipos de ejercicio básicos se pueden **editar en el
  creador de lecciones**, puedes añadir ejercicios a mano, y la opción
  múltiple se puede crear con respuesta única o múltiple.
- Un **asistente para ejercicios de extensión** cubre categorización,
  corrección de errores, comprensión lectora y cuestionario calificado;
  el **dictado de audio** se suma como tipo de extensión.

## v2.4.0 - Mejoras en la creación

- Crea una lección de conocimiento a partir de **texto pegado de un
  libro de texto**, edita una lección propia existente, agrupa
  lecciones propias en un set y sube imágenes para las tarjetas.
- Los ejercicios de texto libre aceptan **varias respuestas** y
  ofrecen una **segunda opinión de la IA** ante una respuesta
  incorrecta.
- La pestaña IA de los ajustes lleva directamente a la importación de
  claves.

## v2.3.0 - Reproductor de lecciones renovado

- Panel de opciones plegable, control de pausa en el pie y una zona de
  título más compacta.
- **Ejercicios de audio en los que primero escuchas**.
- Importación y exportación más robustas de archivos de lecciones y
  sets.

## v2.2.0 - Ejercicios de extensión

- Cuatro **tipos de ejercicio de extensión creados con IA**, además de
  la opción múltiple nativa.
- Un **registro federado de repositorios de contenido** con un flujo
  para registrar tu propio repo.
- Navegación móvil más sencilla, sin la barra de pestañas inferior.

## v2.1.0 - Pulido tras el lanzamiento

- Quitar un repositorio de contenido **ya no deja progreso fantasma**
  en el Panel, en la cola de repaso ni en las lecciones pausadas.
- Ajustes reorganizados, arreglos en la Ruta de aprendizaje, un botón
  **Preguntar a la IA** fácil de encontrar y una sincronización de
  contenido más robusta.

## v2.0.0 - Lanzamiento público

- La primera versión para el público general: gratuita y de código
  abierto (MIT), offline-first, sin cuenta, repetición espaciada, con
  tu propia clave de IA, lecciones propias que puedes crear y
  compartir, e instalable como PWA.
- Un hito de lanzamiento, no una ruptura técnica: ningún cambio
  incompatible respecto a v1.99.0.

## v1.99.0 - Refuerzo para móviles

- **Opción múltiple con botones de respuesta táctiles**, lo que
  corrige los toques fallidos en el iPhone.
- Arreglos por dispositivo: el zoom al enfocar en iOS, el menú de
  borrado del iPhone y un idioma de la interfaz que se recuerda.
- Filtro por idioma del contenido en Descubrir, selección múltiple en
  Mis contenidos, avance automático opcional y ejemplos resueltos
  integrados.

## v1.97.0–v1.98.0 - Hub de contenido rediseñado

- **Mis contenidos** muestra solo el contenido descargado; la
  importación y la creación pasan a la pestaña Importar; vista de
  lista o de cuadrícula y una barra compacta de búsqueda y filtros.
- Barra lateral plegable en escritorio y estado por set (activo,
  aplazado, completado) con opción de borrar.
- Navegación vertical en escritorio y enlaces directos a un set; texto
  con huecos con "Selecciona todas las que correspondan"; las
  respuestas de examen alargan los intervalos de repaso; exportación
  `.alk` de las claves de IA cifrada con frase de contraseña.
- Traducciones al español y al francés revisadas.

## v1.95.0–v1.96.0 - Modos de lección

- Juega una lección o un set en modo **Práctica, Examen, Con tiempo o
  Aleatorio**, además de "Entrenar errores"; el modo examen trae
  corrección diferida, vista de resultados, aprobado o suspenso y un
  bonus de XP.
- Modos **Inverso e Infinito**, códigos de invitación para compartir
  contenido y traslado de los datos de la versión online a una
  instalación local.
- Exporta un set a un repositorio de GitHub.

## v1.92.0–v1.94.1 - Refuerzo offline y del lanzador

- La PWA instalada funciona en **modo de almacenamiento del navegador**
  como estaba previsto, con arreglos para la guía de estudio, la
  pronunciación y la identidad.
- **Lanzador de escritorio:** flujo que empieza por Docker con
  progreso visible, puertos configurables y una única ventana
  persistente; el lanzador de Windows vuelve a compilarse.
- Los diálogos de la revisión de contenido con IA se desplazan en
  escritorio y muestran qué proveedor y qué modelo hicieron la
  revisión.

## v1.91.0 - Reestructuración de la navegación

- **Navegación principal reducida de más de 12 entradas a 7 entradas
  agrupadas** (Panel, Ruta de aprendizaje, Mi contenido, Descubrir,
  Progreso, Ajustes, Ayuda) sin perder funciones: todas las páginas
  siguen siendo accesibles.
- **Barra de pestañas inferior en móvil** (Aprender / Contenido /
  Descubrir / Progreso / Más) con una hoja inferior "Más".
- **ProgressHub** (`/progress`) agrupa Resumen / Estadísticas / Mis
  rutas en pestañas; **DiscoverHub** (`/discover`) gana una pestaña
  Importar. Los enlaces antiguos siguen funcionando mediante
  redirecciones.
- El aviso de actualización de la PWA ya no vuelve a aparecer después
  de aceptar una actualización.

## v1.90.0 - Generación de ejercicios con IA + actualización automática

- **Pipeline de generación de ejercicios con IA:** genera ejercicios
  para una lección solo de teoría, con control de calidad, equilibrio
  de tipos, regeneración con comentarios y generación por lotes para
  un set completo.
- **Resolución animada de parejas** en el ejercicio de emparejamiento.
- **Botón Probar por proveedor** en el resumen de proveedores
  configurados ([Ajustes](user-guide/settings.md)).
- **Comprobación de actualizaciones en escritorio** mediante la API de
  GitHub Releases.
- Las respuestas de la sesión de IA llegan ahora en el idioma de tu
  interfaz.

## v1.87.0–v1.88.0 - Descubrir contenido + compartir por QR

- **Descubrir contenido (`/discover`):** un índice de búsqueda sobre
  la biblioteca; la descarga por set se ha trasladado aquí, separada
  de tus "Mis contenidos" locales.
- **Compartir la app por código QR:** comparte la app con un código QR
  escaneable (copiar / descargar PNG / compartir de forma nativa).
- **Creador de currículos** + recordatorios diarios de aprendizaje.
- **Coreano e indonesio** se suman a los idiomas de la interfaz
  (ahora 11).

## v1.86.0–v1.87.0 - Revisión de contenido con IA + copia de seguridad `.alb`

- **Revisión de contenido con IA:** comprobaciones de calidad para
  todo el set con una interfaz de informe, informe en caché +
  exportación a Markdown, y una insignia "Revisado por IA".
- **Integración de medios:** una sección de lección "Profundiza en el
  tema".
- El **formato de copia de seguridad ZIP `.alb`** sustituye al volcado
  JSON único y ahora incluye también un snapshot de localStorage
  ([Copia de seguridad y restauración](features/backup.md)).

## v1.70.0–v1.84.0 - UX, temas y TipTap 3

- **Restauración en el primer arranque:** una instalación vacía ofrece
  "Restaurar desde una copia de seguridad" durante el onboarding.
- **Documentación renovada** + ayuda contextual dentro de la app.
- **Editor TipTap migrado v2 → v3** (toda la pila `@tiptap/*`).
- **Control de funciones por feature-strategy:** las funciones de IA
  cambian entre activo / desactivado / oculto sin recargar.
- Amplio refuerzo del contraste del tema oscuro y del diseño en móvil.

## v1.69.0 - Enlaces de ejemplo + recomendaciones de libros

- **Enlaces de ejemplo en la teoría:** un paso de teoría puede
  llevar un enlace opcional "Ver ejemplo".
- **Recomendaciones de libros por dominio** en el explorador de
  contenido
  ([Recomendaciones de libros](content-creation/books.md)).
- **Atajo Enter también en la repetición de errores** ("Repetir
  errores").
- **Corrección de copia de seguridad:** el título del conjunto se
  lee correctamente del manifiesto al restaurar.

## v1.68.0 - Exportar resultados + retroenlaces de teoría

- **Exportar el resultado de la lección:** "Copiar resultado" /
  "Guardar como archivo" (informe Markdown para asistentes de IA).
- **Retroenlaces de teoría:** saltar de un ejercicio a la teoría
  correspondiente y volver.
- **Ejercicio de asociación rediseñado:** parejas con color +
  insignias numéricas (seguro para daltónicos).
- **Contraste en modo oscuro** corregido en varios lugares.

## v1.67.1 - Restauración de copias + estabilidad de despliegue

- Corrección sistemática de la **restauración de copias de
  seguridad**.
- Recarga automática ante un chunk de despliegue obsoleto.
- Pulido del filtro de Subject (oculto con ≤ 1 Subject, más usados
  primero).

## v1.65.0 - Evaluación reanudable + atajo Enter

- **Evaluación reanudable:** interrumpir la prueba y continuar más
  tarde donde lo dejaste.
- **Atajo Enter:** Enter comprueba un ejercicio respondido y avanza
  (conmutable en Ajustes → Aprendizaje).
- Ejercicios de asociación más claros + revisión de tokens de
  diseño.

## v1.64.0 - Rediseño del onboarding

- **Inicio rápido con solo nombre + tema**; el resto toma valores
  predeterminados.
- **Asistente de onboarding** opcional (una pregunta por
  pantalla).
- La **evaluación ahora es opcional**
  ([Onboarding](user-guide/onboarding.md)).

## v1.63.0 - Presets de temas WCAG AA

- **6 temas recomendados** (Catppuccin Latte/Mocha, Supabase,
  Graphite, Soft Pop, Amethyst Haze), conformes con AA de forma
  computacional ([Sistema de temas](developer/themes.md)).
- Auditoría sistemática de i18n; filtro del Dashboard
  personalizado.

## v1.62.0 - Integridad de copias + procedencia de la build

- Endurecimiento de la **restauración de copias de seguridad**
  (coerción de tipos de datos, orden de claves foráneas).
- About muestra información real de la build en lugar de
  "unknown".

## v1.61.0 - Conformidad de botones + reanudar lección

- Conformidad de botones shadcn en toda la app.
- La **lección pausada** continúa en el paso exacto.
- Validación de contenido entre repos.

---

## Líneas principales del periodo

- **Varios repositorios de contenido (EXP-023):** conectar repos
  propios, gestionar varios, compartir mediante enlace/QR, niveles
  de confianza, repos recomendados, valoraciones locales
  ([Varios repositorios de contenido](features/content-repos.md)).
- **Copia de seguridad como snapshot completo** con importación
  entre identidades
  ([Copia de seguridad y restauración](features/backup.md)).

---

## Páginas relacionadas

- [Primeros pasos](user-guide/getting-started.md)
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) - notas completas
