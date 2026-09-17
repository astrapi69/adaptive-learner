# Ajustes

La página de Ajustes recoge todo lo que puedes modificar sin tocar
código ni YAML. Secciones de arriba a abajo:

1. **Idioma** - idioma de la interfaz (DE / EN / ES / FR / EL /
   PT / TR / JA, todos completamente traducidos).
2. **Proveedor de IA + selector de modelo** - qué proveedor ve
   tus mensajes y qué modelo usar.
3. **Claves API** - claves por proveedor con atribución de origen
   (entorno / `secrets.yaml` / Ajustes).
4. **Modo de almacenamiento** - Servidor (FastAPI + SQLite) vs
   Local (IndexedDB del navegador).
5. **Sincronización** - emparejar este dispositivo con otro en la
   red local.
6. **Copia de seguridad** - exportar / importar / comparar.
7. **Voz** - alternadores de TTS + STT + pronunciación.
8. **Interfaz** - tema + densidad.
9. **Aprendizaje** - cinco áreas: Fundamentos, En la lección, Lectura en
   voz alta y dictado, Después de la lección, Motivación y rutina.
10. **Gamificación** - notificaciones de XP / insignias + modo fin
    de semana.
11. **Acerca de** - versión, información del sistema, créditos,
    donaciones, licencia.

## Idioma

Intercambia en vivo todas las cadenas de la interfaz en el
siguiente renderizado mediante `PATCH /api/settings/{user_id}`.
Los 8 idiomas son de primera clase: DE / EN / ES / FR / EL / PT /
TR / JA, cada uno con un catálogo completamente traducido.
Persistido entre recargas mediante `localStorage`.

## Proveedor de IA + selector de modelo

El desplegable de proveedor escribe `active_provider` en
UserSettings; la siguiente llamada a la IA pasa por el plugin del
nuevo proveedor (modo Servidor) o el cliente HTTP del nuevo
proveedor (modo Local).

El **Selector de modelo** es un desplegable con
búsqueda agrupado en Recomendado / Todo, poblado desde el endpoint
`/v1/models` en vivo de cada proveedor (caché de 1h). Cada fila
muestra el nombre legible + id bruto + distintivo de ventana de
contexto. Cuando la lista descubierta no está disponible (sin clave
API, sin red), el selector vuelve a los predeterminados estáticos y
muestra un aviso de «usando predeterminado sin conexión». El
encabezado de Sesión lee `<Proveedor>: <Nombre del modelo>`; el id
completo + la ventana de contexto están en la información sobre
herramientas.

## Claves API

Cada proveedor tiene su propia fila: un campo de entrada de clave,
un botón Guardar, un botón Eliminar, el distintivo de proveedor
activo, más el nuevo distintivo de **atribución de origen**:

- **Clave de: Ajustes** - la clave se almacena cifrada con Fernet
  en la BD (modo Servidor) o en texto claro en IndexedDB (modo
  Local). Puedes guardar / eliminar libremente.
- **Clave de: secrets.yaml** - la clave está configurada en
  `~/.config/adaptive-learner/secrets.yaml`. El botón Guardar
  está desactivado; edita el archivo directamente para cambiarla.
  Un banner informativo debajo de la fila te recuerda la ruta.
- **Clave de: entorno** - la clave está configurada mediante la
  variable de entorno `ADAPTIVE_LEARNER_<PROVEEDOR>_API_KEY`.
  Guardar desactivado; la variable de entorno es la fuente de
  verdad.
- **Sin clave configurada** - no hay nada configurado en ningún
  lado. Escribe y haz clic en Guardar para empezar.

Cadena de resolución (prioridad más alta gana): entorno >
secrets.yaml > BD. Ver [la documentación de Configuración](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)
para el desglose completo.

## Modo de almacenamiento

El alternador entre almacenamiento **Servidor** y **Local
(Navegador)**:

- **Servidor** - cada lectura y escritura llega al backend
  FastAPI. Requiere un backend en ejecución. Mejor para el uso
  en múltiples dispositivos con sincronización del lado del
  servidor.
- **Local (Navegador)** - cada lectura y escritura llega a
  IndexedDB en este navegador. Las llamadas a la IA se disparan
  directamente al proveedor. No se requiere backend. Mejor para
  una configuración privada y local en el dispositivo.

Cambiar modos guarda en `localStorage` y muestra un aviso de
«se requiere recarga». Los datos NO se sincronizan entre modos.

## Sincronización

Empareja este dispositivo con otro en tu red local usando el
escáner de código QR (cámara trasera) o pega la URL de
emparejamiento. Una vez emparejados, los botones de enviar +
recibir intercambian datos bidireccionalmente. Los conflictos
pasan por un resolvedor de fusión de IA en el backend.

Alternativa para navegadores restringidos: sube una captura de
pantalla del código QR desde tu otro dispositivo
(`Html5Qrcode.scanFile`).

## Copia de seguridad

Tres funciones en una sección: **Exportar** (descargar un JSON
con marca de tiempo), **Importar** (restaurar desde archivo) y
**Comparar** (diferencia lado a lado con el estado actual). Las
claves API se eliminan de cada exportación.

La restauración es una FUSIÓN, no una sobreescritura: las filas
nuevas se insertan, las filas mutables se actualizan con el
`updated_at` más reciente, las filas de historial (sesiones /
commits / calificaciones) se deduplicen por UUID. La vista previa
de comparación muestra las filas añadidas / eliminadas / cambiadas
por tabla antes de hacer clic en Restaurar; la etiqueta del botón
Restaurar lee «Restaurar (N añadidas, M actualizadas)» una vez que
la diferencia se consolida.

En el modo Local la sección también muestra el bloque de
**Copia de seguridad automática**: anillo rotatorio de 3
instantáneas en una BD IndexedDB separada, se ejecuta cada 10
sesiones O cada 7 días (lo que ocurra primero). Cada instantánea
tiene sus propios botones de Restaurar + Eliminar +
Comparar-como-A/B.

### Limpieza

Dos ajustes del ciclo de vida de los datos están en la pestaña Datos,
justo al lado del almacenamiento al que afectan:

- **Tamaño máximo de lección** (justo debajo de *Caché sin conexión*):
  cuando un análisis de chat largo se guarda como lección sin conexión,
  las lecciones con más pasos que este número se dividen en varias
  partes. *Pasos por parte* admite de 5 a 20; el predeterminado es 10.
- **Retención de lecciones pausadas** (justo encima de la limpieza
  *Contenido desconectado*, que solo aparece cuando hay algo que limpiar):
  las lecciones pausadas más antiguas que este período se abandonan
  automáticamente en la siguiente carga del Panel principal. Elige 7, 14,
  30 o 60 días, o *Nunca*; el predeterminado es 30 días. Se conservan
  hasta 10 lecciones pausadas independientemente de su antigüedad.

Ambos valores se guardan en este navegador y se aplican por igual en el
modo Servidor y en el modo Local.

## Voz

Cuatro alternadores:

- **TTS activado** - añade un botón ▶ junto a las respuestas de
  la IA + los resultados de la Evaluación que los lee en voz alta.
  Elige la voz que coincide con el idioma cuando está disponible;
  velocidad + tono limitados a [0,5; 2,0].
- **Reproducción automática de IA** - habla cada respuesta de la
  IA automáticamente (predeterminado DESACTIVADO: el audio
  sorpresa raramente es lo que quieres).
- **STT activado** - añade un botón 🎤 a la entrada de Sesión que
  captura el habla y rellena el área de texto con transcripciones
  provisionales antes de enviar.
- **Práctica de pronunciación activada** - muestra la página
  `/pronunciation` desde el inicio rápido del Panel principal para
  proyectos etiquetados como Idiomas.

La sección de Voz se oculta cuando ninguno de los dos lados de la
Web Speech API (síntesis ni reconocimiento) es compatible con el
navegador.

## Apariencia

El selector de **Tema** en *General > Apariencia* ofrece seis
temas más un modo automático:

- **Claro** - el predeterminado, brillante y de alto contraste.
- **Oscuro** - superficies atenuadas para uso con poca luz.
- **Océano** - tonos azul profundo, calmado y agradable por la
  noche.
- **Bosque** - tonos cálidos de verde y ámbar terrosos.
- **Alto contraste** - accesibilidad primero: negro, blanco y
  colores de señal audaces, con bordes de tarjeta nítidos. Úsalo
  si necesitas la máxima legibilidad.
- **Sepia** - tonos cálidos de papel, cómodo para lecturas largas.
- **Auto (Sistema)** - sigue la configuración de claro/oscuro de
  tu sistema operativo y cambia automáticamente cuando el sistema
  lo hace.

Elige un tema desde su tarjeta de vista previa; el cambio se
aplica al instante sin recarga, y tu elección se recuerda entre
visitas. Cada tema está diseñado para cumplir el contraste WCAG
2.1 AA, así que el texto, los gráficos, las insignias y la
retroalimentación de ejercicios son legibles en todos ellos.

## Interfaz

Dos controles: la **información sobre herramientas de los botones** (un
tooltip al pasar el ratón sobre los botones de icono; las etiquetas para
lectores de pantalla siguen activas de todos modos) y la **Posición del
menú (móvil)** (arriba como botón de menú, el predeterminado, o abajo como
barra de pestañas al alcance del pulgar). Los gestos de deslizamiento son
un ajuste de lección y viven en *Aprendizaje > En la lección >
Interacción*.

El **Modo desarrollador** (en la pestaña **Diagnóstico y soporte**) tiene
un valor predeterminado que depende de la rama de compilación: está
**ACTIVADO por defecto en la rama Latest (vista previa)** y **DESACTIVADO
en Main**, para que los probadores de la vista previa vean el detalle
técnico completo de los errores mientras los usuarios de producción
reciben mensajes amigables. Puedes cambiarlo en cualquier momento.

## Aprendizaje

La pestaña **Aprendizaje** agrupa sus tarjetas en cinco áreas
etiquetadas, en el orden en que transcurre una lección. Cada área tiene un
encabezado pequeño y una descripción de una línea; las tarjetas de dentro
conservan sus propios títulos.

### Fundamentos

Quién aprende y en qué idiomas.

- **Perfil de aprendizaje** - crear, continuar o repetir el perfil de
  aprendizaje que hay detrás de los pesos de los seis métodos.
- **Idiomas de origen adicionales** - qué idiomas de origen muestra el
  árbol de contenidos además del idioma de la aplicación.

### En la lección

Cómo se comportan los ejercicios mientras respondes.

- **Modo de lección** - el **Modo predeterminado** (Práctica / Examen /
  Con tiempo), el **Umbral para aprobar** el examen y la **Dificultad del
  modo con tiempo** (Rápido, Normal, Relajado); ver
  [Lecciones y repasos](lessons.md).
- **Pistas** - si aparece un botón de pista por etapas en cada ejercicio,
  y el **coste en XP por pista** (0 para pistas gratuitas).
- **Interacción** - los **Gestos de deslizamiento** (deslizar para navegar
  en la Evaluación, la Sesión y el Plan de estudios; predeterminado
  ACTIVADO en dispositivos táctiles), los **Atajos de teclado en las
  lecciones** (Intro comprueba la respuesta, Intro de nuevo pasa a la
  siguiente), **Avanzar automáticamente al acertar** y si se muestra el
  botón **Preguntar a la IA**.
- **Dirección de ejercicio preferida** - con qué dirección se abren los
  ejercicios direccionales.
- **Animación al resolver** - el efecto que reproduce un ejercicio de
  emparejamiento resuelto.

### Lectura en voz alta y dictado

Voces, velocidad, micrófono y práctica de pronunciación.

- **Voz** - los alternadores descritos arriba en *Voz*: texto a voz,
  reproducción automática, voz a texto y práctica de pronunciación.

Esta área solo aparece cuando el navegador admite al menos un lado de la
Web Speech API (síntesis o reconocimiento). De lo contrario falta, título
incluido, y *Después de la lección* sigue directamente a *En la lección*.

### Después de la lección

Sesiones de repaso, el resumen de la lección y la repetición de errores.

- **Repaso** - las explicaciones de errores generadas automáticamente y el
  número de preguntas por sesión de repaso. La tarjeta termina con el
  bloque de solo lectura **Repetición espaciada**: el calendario de
  intervalos (respuestas correctas seguidas frente a días hasta el
  siguiente repaso), cuándo un elemento cuenta como dominado, y un enlace
  al método de aprendizaje.
- **Resumen tras las lecciones** - qué secciones muestra el resumen al
  final de la lección, y en qué orden.
- **Repetir errores** - qué errores recoge la ronda de repetición.

### Motivación y rutina

Modo de juego, comentarios, misiones diarias y recordatorios.

- **Modo juego** - lecciones lúdicas, incluida la **Variante de la
  mascota**, los esquemas de color de Lernfunke que se desbloquean con
  niveles e insignias o a cambio de XP (las variantes bloqueadas muestran
  su condición, las compras piden una confirmación en dos pasos). Lo que
  cambia el modo de juego en detalle se explica en
  [Elogios y celebraciones](celebrations.md).
- **Comentarios** - intensidad de los comentarios y sonidos (volumen,
  botón de prueba).
- **Misiones diarias** - si las misiones están activas, cuántas por día,
  la mezcla de dificultad y un reordenamiento de las misiones de hoy.
- **Recordatorios** - la hora del recordatorio y los días en que se
  aplica.

La tarjeta del modo de juego muestra el interruptor principal, los sonidos
del modo de juego y una línea de estado que cuenta cuántos extras están
activados. **Detalles del modo de juego** (corazones, cuenta atrás,
arcade, rondas especiales, tickets, lecciones extra, XP de racha y
mascota) está plegado y recuerda tu elección; mientras **Lecciones
lúdicas** está desactivado, las opciones de dentro aparecen atenuadas.

La pestaña termina con **Gamificación** (bajo una línea separadora,
porque esa tarjeta contiene *Reiniciar progreso*). Los dos ajustes de limpieza -
*Retención de lecciones pausadas* y *Tamaño máximo de lección* - son
ajustes del ciclo de vida de los datos y viven en la pestaña **Datos**
(ver *Limpieza* bajo Copia de seguridad).

La **Vista de contenidos** (lista / cuadrícula) y el **Orden de las
pestañas de Contenido** están en la pestaña **General** bajo
*Apariencia*.

### Gamificación

Alternadores para notificaciones de XP / insignias / subida de
nivel (desactivar silencia los toasts pero el sistema sigue
registrando el estado), **modo fin de semana** (omitir los huecos
de sáb./dom. en el mapa de calor de racha), meta de sesión diaria
(1..10), y **Reiniciar progreso** (confirmación doble; borra las
filas `user_xp` + `user_badges` + `user_streaks`).

## Acerca de

Cinco bloques de solo lectura: **Versión** (versión canónica de
`pyproject.toml`, hash de compilación, fecha de compilación),
**Sistema** (modo de almacenamiento, directorio de datos, ruta de
BD en modo Servidor, información de Python + plataforma),
**Créditos** (autor, reconocimientos de dependencias), **Apoyar
el desarrollo** (enlaces a Liberapay / GitHub Sponsors / Ko-fi),
**Licencia y recursos** (enlace MIT, repositorio, documentación,
rastreador de problemas).

En el modo Local el panel oculta las filas que solo tienen sentido
para un backend en ejecución (versión de Python, versiones de
FastAPI / SQLAlchemy / Pydantic / PluginForge, ruta de BD).
