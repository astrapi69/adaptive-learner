# Ajustes

La página de Ajustes recoge todo lo que puedes modificar sin tocar
código ni YAML. Está organizada como una **página con pestañas**: eliges
una pestaña y se abre su panel, así que no tienes que recorrer una larga
lista de arriba a abajo. En una pantalla ancha las pestañas están en una
barra lateral a la izquierda; en el móvil se abren desde un botón de
menú encima del panel. La dirección indica la pestaña abierta
(`/settings?tab=data`), de modo que un enlace o una recarga te llevan a
la misma pestaña; sin ella la página se abre en **General**.

Las pestañas se agrupan en cuatro grupos:

- **General**
    - **General**: perfil (nombre visible, avatar, marcos del avatar),
      apariencia (tema, vista de contenidos, orden de las pestañas de
      Contenido), idioma de la interfaz, interfaz (descripciones de los
      botones, posición del menú en el móvil), modo de almacenamiento,
      preferencias de actualización, instalación de la aplicación y el
      indicador de modo.
- **Aprendizaje e IA**
    - **Aprendizaje**: cómo se comportan las lecciones, en cinco áreas
      que van del perfil de aprendizaje a la motivación y la rutina,
      incluidos los ajustes de voz y la gamificación.
    - **IA**: selector de proveedor y de modelo, claves API por
      proveedor con atribución de origen y la vista general de los
      proveedores configurados.
    - **Complementos**: los complementos instalados y los ajustes del
      Repositorio de aprendizaje.
- **Datos e integraciones**
    - **Datos**: fuentes de contenido, sincronización, contenido sin
      conexión, copia de seguridad y exportación (incluida la
      exportación cifrada de claves), limpieza y la zona de peligro, con
      una barra de secciones arriba.
    - **Integraciones**: la integración con GitHub (el token para
      compartir lecciones como pull request).
- **Info**
    - **Ayuda**: el glosario integrado con búsqueda.
    - **Diagnóstico y soporte**: el informe de error, el Modo
      Desarrollador y la sonda de toques y viewport.
    - **Acerca de**: versión, información del sistema, créditos,
      compartir la app, donaciones, licencia.

## Perfil

En *General > Perfil* defines tu **Nombre visible** y das estilo a tu
**avatar**:

- **Subir imagen** abre el diálogo de recorte; el resultado aparece
  arriba a la derecha en la navegación.
- **O elige una figura**: ocho figuras predefinidas como alternativa a
  tu propia foto; basta con un clic. Si hay una foto subida activa, un
  diálogo pregunta antes de que la figura la sustituya; la foto se
  guarda aparte y puedes recuperarla en cualquier momento con
  **Restaurar foto** (hasta que subas una foto nueva).
- **Marco del avatar**: anillos decorativos alrededor del avatar.
  Bronce, Plata y Oro se desbloquean con tu nivel, Llama con la
  insignia de racha de 3 días; Estrella y Acento se canjean por XP
  (confirmación en dos pasos, el coste aparece en el botón). Los marcos
  bloqueados muestran su condición.

Tu elección y los marcos comprados se conservan y viajan con tu
[copia de seguridad](../features/backup.md).

## Apariencia

El selector de **Tema** en *General > Apariencia* ordena los temas
en dos pestañas:

- **Recomendados** - Catppuccin Latte, Supabase y Graphite (claros),
  Catppuccin Mocha, **Soft Pop** y Amethyst Haze (oscuros). Los
  usuarios nuevos empiezan con **Soft Pop**, y el selector se abre en
  esta pestaña.
- **Clásicos** - los temas originales: Claro, Oscuro, Océano, Bosque,
  Alto contraste (negro, blanco y colores de señal intensos, con
  bordes de tarjeta nítidos, para la máxima legibilidad) y Sepia
  (tonos cálidos de papel para lecturas largas). Si tu tema activo es
  uno clásico, el selector se abre en esta pestaña.

Ambas pestañas ofrecen además **Automático (sistema)**, que sigue la
configuración de claro/oscuro de tu sistema operativo y cambia
automáticamente con él.

Elige un tema desde su tarjeta de vista previa; el cambio se
aplica al instante sin recarga, y tu elección se recuerda entre
visitas. Cada tema está diseñado para cumplir el contraste WCAG
2.1 AA, así que el texto, los gráficos, las insignias y la
retroalimentación de ejercicios son legibles en todos ellos.

También en esta tarjeta: la **Vista de contenidos**, la preferencia
global *lista / cuadrícula* del área de Contenido (predeterminado
**lista**). Es la misma preferencia que el conmutador de vista dentro de
las pestañas *Mis contenidos* / *Descubrir*, así que cambiarla en
cualquiera de los dos sitios mantiene ambos sincronizados. Justo debajo
de la tarjeta defines el **Orden de las pestañas de Contenido**
(Descubrir / Mis contenidos / Importar / Crear), para que el área de
Contenido se abra en la pestaña que más usas.

## Idioma

*General > Idioma* intercambia en vivo todas las cadenas de la interfaz
en el siguiente renderizado mediante `PATCH /api/settings/{user_id}`.
Los 11 idiomas son de primera clase: DE / EL / EN / ES / FR / HI / ID /
JA / KO / PT / TR, cada uno con un catálogo completamente traducido.
Persistido entre recargas mediante `localStorage`.

## Interfaz

*General > Interfaz* tiene dos controles: **Mostrar descripciones de
botones** (un tooltip al pasar el ratón sobre los botones de icono; las
etiquetas para lectores de pantalla siguen activas de todos modos) y la
**Posición del menú (móvil)** (arriba como botón de menú, el
predeterminado, o abajo como barra de pestañas al alcance del pulgar).
Los gestos de deslizamiento son un ajuste de lección y viven en
*Aprendizaje > En la lección > Interacción*. El Modo Desarrollador está
en la pestaña **Diagnóstico y soporte** (ver más abajo).

## Modo de almacenamiento

*General > Modo de almacenamiento* alterna entre almacenamiento
**Servidor** y **Local (Navegador)**:

- **Servidor** - cada lectura y escritura llega al backend
  FastAPI. Requiere un backend en ejecución. Mejor para el uso
  en múltiples dispositivos con sincronización del lado del
  servidor.
- **Local (Navegador)** - cada lectura y escritura llega a
  IndexedDB en este navegador. Las llamadas a la IA se disparan
  directamente al proveedor. No se requiere backend. Mejor para
  una configuración privada y local en el dispositivo.

Cambiar de modo guarda en `localStorage` y muestra un aviso de
«se requiere recarga». Los datos NO se sincronizan entre modos.

La versión web pública y la aplicación web instalada no tienen backend,
así que allí la tarjeta no aparece y la app usa siempre Local
(Navegador).

## Actualizaciones e instalación de la app

El resto de la pestaña **General** trata de cómo se ejecuta la app:

- **Actualizaciones** (solo en modo Servidor): **Comprobación automática
  de actualizaciones** y el **Intervalo de comprobación** (diario,
  semanal, mensual o nunca), además de la hora de la última comprobación
  y la versión actual. El botón manual **Buscar actualizaciones** está
  en la pestaña **Acerca de**.
- **Instalar aplicación**: instala Adaptive Learner como aplicación
  independiente (ventana propia, icono en la pantalla de inicio, arranca
  sin red). Una vez instalada, el botón muestra **Ya instalada**.
- **Modo**: el Modo en solitario está activo; el Modo multijugador
  aparece marcado como Próximamente.

## Aprendizaje

La pestaña **Aprendizaje** agrupa sus tarjetas en cinco áreas
etiquetadas, en el orden en que transcurre una lección. Cada área tiene un
encabezado pequeño y una descripción de una línea; las tarjetas de dentro
conservan sus propios títulos.

Una **barra de secciones** encima de las áreas las muestra como chips:
haz clic en uno para saltar a esa área. En el escritorio la barra sigue
visible bajo la cabecera de la app mientras te desplazas; en el móvil se
desplaza con la página y la fila puede deslizarse hacia los lados. La
barra refleja la dirección: `/settings?tab=learning&section=review` abre
la pestaña desplazada hasta *Después de la lección* (ids: `basics`,
`lessons`, `voice`, `review`, `motivation`), y un clic en un chip
actualiza la dirección sin añadir una entrada al historial. Al cambiar a
otra pestaña la sección se descarta. Un área que no se muestra (el área
de voz en un navegador sin Web Speech) no tiene chip, y una sección
desconocida se ignora. Mientras te desplazas, el chip resaltado sigue al
área que está en pantalla.

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
  y el **Coste de XP por pista** (0 para pistas gratuitas).
- **Interacción** - los **Gestos de deslizamiento** (deslizar para navegar
  en la Evaluación, la Sesión y el Plan de estudios; predeterminado
  ACTIVADO en dispositivos táctiles), los **Atajos de teclado en las
  lecciones** (Intro comprueba la respuesta, Intro de nuevo pasa a la
  siguiente), **Avanzar automáticamente al acertar** y si se muestra el
  botón **Preguntar a la IA**.
- **Dirección de ejercicio preferida** - con qué dirección se abren los
  ejercicios direccionales.
- **Ejercicio de emparejamiento** - **Corrección como vista aparte**
  (predeterminado ACTIVADO): tras comprobar, «Mis respuestas» muestra
  solo tus propias parejas con tus errores, las respuestas correctas
  están en «Correcciones» y la solución en «Resolver». Desactivado: la
  respuesta correcta aparece directamente bajo cada error en «Mis
  respuestas». Además, la **Animación al resolver**, el efecto que
  reproduce un ejercicio de emparejamiento resuelto.

### Lectura en voz alta y dictado

Voces, velocidad, micrófono y práctica de pronunciación. El área
contiene la tarjeta **Voz**:

- **Mostrar botones de voz** - añade un botón de altavoz junto a las
  respuestas de la IA y los resultados de la Evaluación que los lee en
  voz alta.
- **Reproducir respuestas IA automáticamente** - lee cada respuesta de
  la IA automáticamente (predeterminado DESACTIVADO: el audio sorpresa
  raramente es lo que quieres).
- **Voz** - la voz con la que se lee; el valor predeterminado elige la
  más cercana al idioma de tu proyecto.
- **Velocidad** y **Tono** - deslizadores de 0,5 a 2.
- **Mostrar botón de micrófono** - añade un botón de micrófono a la
  entrada de la Sesión que captura el habla y rellena el área de texto
  con transcripciones provisionales antes de enviar.
- **Idioma de dictado** - un código BCP-47 (por ejemplo `es-ES`);
  déjalo vacío para usar el idioma del proyecto o de la interfaz.
- **Práctica de Pronunciación** - muestra un botón *Práctica de
  pronunciación* en los paneles de los proyectos de aprendizaje de
  idiomas.

Los controles de lectura en voz alta (los cinco primeros) solo aparecen
cuando el navegador admite la síntesis de voz, los dos controles de
dictado solo cuando admite el reconocimiento de voz. Cuando el navegador
no admite ninguno de los dos lados de la Web Speech API, falta toda el
área, título incluido, y *Después de la lección* sigue directamente a
*En la lección*.

### Después de la lección

Sesiones de repaso, el resumen de la lección y la repetición de errores.

- **Repaso** - las explicaciones tras la respuesta (la explicación que
  escribió el autor de un ejercicio, mostrada bajo el ejercicio una vez
  comprobado, y los consejos de regla generados automáticamente tras una
  lección) y el número de preguntas por sesión de repaso. El
  interruptor **Repasar también los elementos sin errores**
  (desactivado por defecto) decide si el repaso contiene solo elementos
  con errores o si también vuelve a traer, a los 3 y 7 días, elementos
  que nunca fallaste. La tarjeta termina con el bloque de solo lectura
  **Repetición espaciada**: el calendario de intervalos (respuestas
  correctas seguidas frente a días hasta el siguiente repaso), cuándo
  un elemento cuenta como dominado, y un enlace al método de
  aprendizaje.
- **Resumen tras las lecciones** - qué secciones muestra el resumen al
  final de la lección, y en qué orden. Solo *Resultado y estadísticas* y
  *Recompensa de XP* están activadas por defecto, la vista compacta que
  cabe en una pantalla de móvil; todo lo demás lo muestra el botón
  *Evaluación detallada* al final de una lección, o lo marcas aquí de
  forma permanente. *Por qué fallaste estas* es una de estas secciones;
  su interruptor principal sigue siendo *Mostrar explicaciones* en
  *Repaso*.
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
- **Gamificación** - avisos de XP / insignias, modo fin de semana, la
  meta de sesiones diaria y *Reiniciar progreso*; la última tarjeta, ver
  más abajo.

La tarjeta del modo de juego muestra el interruptor principal, los sonidos
del modo de juego y una línea de estado que cuenta cuántos extras están
activados. **Detalles del modo de juego** (corazones, cuenta atrás,
arcade, rondas especiales, tickets, lecciones extra, XP de racha y
mascota) está plegado y recuerda tu elección; mientras **Lecciones
lúdicas** está desactivado, las opciones de dentro aparecen atenuadas.

La pestaña termina con **Gamificación** (bajo una línea separadora,
porque esa tarjeta contiene *Reiniciar progreso*). Los dos ajustes de
limpieza, *Lecciones pausadas en el Panel* y el *Tamaño máximo de
lección*, son ajustes del ciclo de vida de los datos y viven en la
pestaña **Datos** (ver *Contenido sin conexión* y [Limpieza](#limpieza)).

La **Vista de contenidos** (lista / cuadrícula) y el **Orden de las
pestañas de Contenido** están en la pestaña **General** bajo
*Apariencia*.

### Gamificación

Alternadores para notificaciones de XP / insignias / subida de
nivel (desactivar silencia los toasts pero el sistema sigue
registrando el estado), **Modo fin de semana** (omitir los huecos
de sáb./dom. en el mapa de calor de racha), meta de sesiones diaria
(1..10), y **Reiniciar progreso** (confirmación doble; borra las
filas `user_xp` + `user_badges` + `user_streaks`).

## Proveedor de IA + selector de modelo

En la pestaña **IA**, el desplegable de proveedor escribe
`active_provider` en UserSettings; la siguiente llamada a la IA pasa por
el plugin del nuevo proveedor (modo Servidor) o el cliente HTTP del
nuevo proveedor (modo Local).

El **selector de modelo** es un desplegable con búsqueda agrupado en
Recomendado / Todo, poblado desde el endpoint `/v1/models` en vivo de
cada proveedor (caché de 1h). Cada fila muestra el nombre legible + id
bruto + distintivo de ventana de contexto. Cuando la lista descubierta
no está disponible (sin clave API, sin red), el selector vuelve a los
predeterminados estáticos y muestra un aviso de «usando predeterminado
sin conexión». El encabezado de Sesión muestra
`<Proveedor>: <Nombre del modelo>`; el id completo + la ventana de
contexto están en el tooltip.

## Claves API

Cada proveedor tiene su propia fila: un campo de entrada de clave,
un botón Guardar, un botón Eliminar, el distintivo de proveedor
activo, más el nuevo distintivo de **atribución de origen**:

- **Clave desde: secrets.yaml** - la clave se almacena cifrada con
  Fernet en `~/.config/adaptive_learner/secrets.yaml`. Es ahí donde el
  modo Servidor guarda cada clave que introduces aquí, así que tras
  Guardar la fila muestra este distintivo. Guardar y Eliminar siguen
  disponibles; guardar sobrescribe la clave almacenada. Una línea
  informativa bajo la fila indica la ruta.
- **Clave desde: Ajustes** - una clave antigua que aún está en la base
  de datos de antes de que las claves se trasladaran a `secrets.yaml`;
  se traslada allí en el siguiente arranque. En el modo Local
  (navegador) la clave vive en IndexedDB y también muestra este
  distintivo. Puedes guardar / eliminar libremente.
- **Clave desde: variable de entorno** - la clave está configurada
  mediante la variable de entorno
  `ADAPTIVE_LEARNER_<PROVEEDOR>_API_KEY`. Guardar y Eliminar están
  desactivados; la variable de entorno es la fuente de verdad.
- **Ninguna clave configurada** - no hay nada configurado en ningún
  lado. Escribe y haz clic en Guardar para empezar.

Cadena de resolución (prioridad más alta gana): entorno >
secrets.yaml > BD. Ver [la documentación de Configuración](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)
para el desglose completo.

Los campos de clave usan una **entrada secreta** enmascarada (con un
conmutador para mostrar/ocultar) y no activan el gestor de contraseñas
del navegador.

Las claves API se **excluyen** deliberadamente de la copia de seguridad
normal (`.alb`). Para llevar tus claves a otro dispositivo o navegador,
usa la **exportación cifrada de claves (`.alk`)** dedicada: aquí, en la
pestaña IA, hay un **botón de referencia** que te lleva directamente a
ella en la **pestaña Datos** (ver *Claves de IA - exportación cifrada*
más abajo).

## Proveedores configurados

La vista general **Proveedores de IA configurados** enumera los
proveedores de IA que has configurado, cada uno con una **vista previa
enmascarada de la clave** para que veas de un vistazo qué proveedores
están listos. Cada fila tiene un botón **Probar** que llama al endpoint
de lista de modelos del proveedor e informa de ok / clave no válida /
límite de peticiones / error de red: una comprobación segura que no
gasta tokens de generación.

## Complementos

La pestaña **Complementos** tiene dos tarjetas. **Complementos
instalados** enumera cada complemento que cargó la aplicación de
escritorio: nombre, versión, origen (paquete o registrado directamente)
y hora de activación. Un error de carga o un filtro de descubrimiento
aparece como marca en la fila, igual que un cambio de configuración
tras la activación. En el modo navegador la tarjeta sigue visible con
un aviso de que solo la aplicación de escritorio tiene un anfitrión de
complementos. **Repositorio de aprendizaje** contiene los ajustes de
ese complemento (persistencia en git, directorio del repositorio).

## Datos

La pestaña **Datos** agrupa sus tarjetas en seis áreas, en un orden
fijo: de dónde viene el contenido, qué ocurre con él, qué resulta, cómo
lo proteges, qué puedes limpiar y, por último, lo que no se puede
deshacer. Cada área tiene un encabezado pequeño y una descripción de una
línea.

Una **barra de secciones** encima de las áreas las muestra como chips:
*Fuentes*, *Sincronización*, *Contenido sin conexión*, *Copia de
seguridad y exportación*, *Limpieza* y *Zona de peligro*. Funciona como
la de la pestaña Aprendizaje: un clic salta al área, en el escritorio la
barra sigue visible bajo la cabecera de la app, el chip resaltado sigue
al área en pantalla y la dirección lo refleja
(`/settings?tab=data&section=backup`; ids: `sources`, `sync`,
`offline`, `backup`, `cleanup`, `danger`).

### Fuentes

- **Repositorios de contenido** - los repositorios de los que proceden
  tus lecciones; ver
  [Repositorios de contenido](../features/content-repos.md).
- **Registra tu repositorio** - propone tu propio repositorio de
  contenido para el directorio compartido que usa la búsqueda entre
  repositorios.

### Sincronización

Empareja este dispositivo con otro en tu red local usando el
escáner de código QR (cámara trasera) o pega la URL de
emparejamiento. Una vez emparejados, los botones de enviar +
recibir intercambian datos bidireccionalmente. Los conflictos
pasan por un resolvedor de fusión de IA en el backend.

Alternativa para navegadores restringidos: sube una captura de
pantalla del código QR desde tu otro dispositivo
(`Html5Qrcode.scanFile`).

La sincronización necesita la aplicación de escritorio. En el modo
navegador el área sigue visible, pero sus controles se sustituyen por el
aviso «Solo disponible con la aplicación de escritorio.»

### Contenido sin conexión

- **Caché sin conexión** - el tamaño y el número de lecciones de la
  caché de lecciones sin conexión, con un botón para vaciarla (pide
  confirmación).
- **Tamaño máximo de lección** - cuando un análisis de chat largo se
  guarda como lección sin conexión, las lecciones con más pasos que este
  número se dividen en varias partes. *Pasos por parte* admite de 5 a
  20; el predeterminado es 10.

### Copia de seguridad y exportación

**Copia de seguridad** ofrece tres funciones: **Crear copia de
seguridad** (descarga un archivo de copia de seguridad `.alb`),
**Restaurar desde copia de seguridad** (restaurar desde un archivo) y
**Comparar** (diferencia lado a lado con el estado actual). Las claves
API se eliminan de cada exportación.

La restauración es una FUSIÓN, no una sobrescritura: las filas
nuevas se insertan, las filas mutables se actualizan con el
`updated_at` más reciente, las filas de historial (sesiones /
commits / calificaciones) se deduplican por UUID. La vista previa
de comparación muestra las filas añadidas / eliminadas / cambiadas
por tabla antes de hacer clic en Restaurar; la etiqueta del botón
Restaurar muestra «Restaurar (N añadidos, M actualizados)» una vez
que la diferencia se consolida.

En el modo Local la tarjeta también muestra el bloque de
**Copia de seguridad automática**: anillo rotatorio de 3
instantáneas en una BD IndexedDB separada, se ejecuta cada 10
sesiones O cada 7 días (lo que ocurra primero). Cada instantánea
tiene sus propios botones de Restaurar + Eliminar +
Comparar como A/B.

Otras tarjetas de esta área:

- **Archivo de identidad** (solo en modo Servidor) - una vista de solo
  lectura del archivo de recuperación que guarda el backend, para que
  veas si existe y dónde está.
- **Claves de IA - exportación cifrada** - ver más abajo.
- **Exportación de datos** - una copia de seguridad completa con un
  clic, o una exportación selectiva en la que marcas las categorías de
  datos que quieres incluir; ambas producen el mismo archivo de copia
  de seguridad importable.
- **Exportar** - tres informes: *Progreso de aprendizaje*, *Detalle de
  la sesión* y *Plan de estudios*, cada uno como Markdown o como PDF (a
  través del diálogo de impresión del navegador).

#### Exportación cifrada de claves (.alk)

La copia de seguridad normal elimina tus claves API, lo cual es seguro,
pero significa que un cambio de dispositivo o de navegador te obliga a
volver a introducir cada clave a mano. La **exportación cifrada de
claves** (tarjeta *Claves de IA - exportación cifrada*) cierra ese hueco
con un archivo aparte protegido por frase de contraseña:

- Contiene **solo** las credenciales sensibles: tus **claves API** más
  los ajustes del proveedor (proveedor activo, modelos personalizados).
  NO contiene el resto de los datos de la app (eso sigue en la copia de
  seguridad `.alb`).
- **Exportar** pide una frase de contraseña (más su confirmación) y
  descarga un archivo **`.alk`** dedicado. Las claves que contiene están
  cifradas con **AES-GCM-256**, con la clave derivada de tu frase de
  contraseña mediante **PBKDF2**; el archivo nunca contiene una clave en
  texto claro.
- **Importar** lee un `.alk`, pide la frase de contraseña, descifra y
  escribe las claves + los ajustes del proveedor de vuelta en el mismo
  almacenamiento seguro que usa la introducción manual (los proveedores
  presentes se sobrescriben, los ausentes no se tocan).
- Una **frase de contraseña incorrecta o un archivo manipulado** se
  rechaza limpiamente con un único mensaje y **sin importación
  parcial**: no se escribe nada a medias.
- Los campos de frase de contraseña se validan **en línea** mientras
  escribes: una frase demasiado corta o una confirmación que no
  coincide se muestra directamente en el campo (y el botón de envío
  sigue desactivado) en lugar de lanzar un toast de error tras el clic.
  Igual que los campos de clave API, estos campos **no** activan el
  gestor de contraseñas del navegador.

Esta exportación está en la **pestaña Datos**, junto a la copia de
seguridad normal; la **pestaña IA** solo tiene un botón de referencia
que te trae aquí. En el **modo Local (navegador)** las claves viven en
IndexedDB, así que la exportación está plenamente disponible (y es el
caso de uso principal). En el **modo Servidor** las claves se guardan en
el servidor y el cliente nunca ve el texto claro, así que la entrada
está **desactivada con una indicación**. La exportación también está
desactivada cuando todavía no hay ninguna clave exportable configurada.

### Limpieza

- **Lecciones pausadas en el Panel**: la tarjeta de lecciones pausadas
  del Panel solo muestra las lecciones pausadas dentro de este período
  (*Ocultar lecciones pausadas con más de* 7, 14, 30 o 60 días, o
  *Nunca*; el predeterminado es 30 días). Una lección más antigua solo
  desaparece de la tarjeta: no se abandona nada y conserva su posición y
  sus respuestas. La tarjeta muestra las cinco lecciones pausadas más
  recientemente.
- **Contenido desconectado** (modo navegador): el progreso cuyo
  repositorio de contenido ya no está conectado permanece oculto hasta
  que lo eliminas aquí. La tarjeta solo aparece cuando hay algo que
  limpiar.

El *Tamaño máximo de lección* y *Lecciones pausadas en el Panel* se
guardan en este navegador y se aplican por igual en el modo Servidor y
en el modo Local.

### Zona de peligro

La última área, separada visualmente: **Restablecer todo** borra todos
tus datos (en el modo Servidor en el backend, en el modo navegador en
este navegador). Primero ofrece crear una copia de seguridad, luego pide
confirmación, y el botón final **Eliminar permanentemente** solo se
desbloquea después de escribir `RESET`.

## Integraciones

La pestaña **Integraciones** contiene la **Integración con GitHub**: un
token de GitHub (con el permiso `repo`) que permite a la app compartir
lecciones como pull request. El campo del token comprueba el formato
mientras escribes, **Probar** verifica el token y muestra la cuenta a la
que pertenece, y una línea de origen indica dónde está guardado el token
(secrets.yaml, una variable de entorno o este navegador), con
**Eliminar** para borrarlo. Un token que procede de una variable de
entorno no se puede editar aquí.

## Ayuda

La pestaña **Ayuda** contiene el glosario integrado: un campo de
búsqueda filtra las entradas por título y texto, y las entradas se
agrupan en *Conceptos básicos*, *Métodos de aprendizaje*, *Pasos del
ciclo* y *Funciones de la app*. Un clic en una entrada abre el artículo
completo en el panel de ayuda.

## Diagnóstico y soporte

La pestaña **Diagnóstico y soporte** reúne lo que ayuda al desarrollador
a ver qué ocurrió en tu dispositivo:

- **Soporte** - **Crear informe de error** recopila tus acciones
  recientes en un informe que revisas antes de que nada salga de tu
  navegador.
- **Modo Desarrollador** - muestra el detalle técnico completo (código
  de estado, endpoint, traza de pila) en los toasts de error, y una
  insignia «DEV» en la barra de navegación mientras está activado. Su
  valor predeterminado depende de la rama de compilación: está
  **ACTIVADO por defecto en la rama Latest (vista previa)** y
  **DESACTIVADO en Main**, para que los probadores de la vista previa
  vean el detalle técnico completo de los errores mientras los usuarios
  de producción reciben mensajes amigables. Puedes cambiarlo en
  cualquier sentido.
- **Sonda de toques y viewport** - registra las posiciones de los toques
  y los cambios del viewport en un protocolo persistente mientras está
  activada, para acotar errores de visualización difíciles de
  reproducir. **Mostrar barra de medición** muestra u oculta la barra de
  arriba mientras la grabación continúa; **Botón flotante para la barra
  de medición** añade un botón flotante (con elección de esquina) que
  muestra u oculta la barra. **Copiar protocolo** y **Borrar protocolo**
  actúan sobre los eventos registrados, y un contador muestra cuántos
  hay.

## Acerca de

Cinco bloques de solo lectura: **Versión** (versión canónica de
`pyproject.toml`, hash de compilación, fecha de compilación),
**Sistema** (modo de almacenamiento, directorio de datos, ruta de
BD en modo Servidor, información de Python + plataforma),
**Créditos** (autor, reconocimientos de dependencias), **Apoya el
desarrollo** (enlaces a Liberapay / GitHub Sponsors / Ko-fi),
**Licencia y recursos** (enlace MIT, repositorio, documentación,
rastreador de problemas).

En el modo Local el panel oculta las filas que solo tienen sentido
para un backend en ejecución (versión de Python, versiones de
FastAPI / SQLAlchemy / Pydantic / PluginForge, ruta de BD).

### Rama de compilación: Main frente a Latest

Adaptive Learner se ejecuta en dos ramas de despliegue, y la pestaña
Acerca de te indica en cuál estás:

- **Main** - el sitio de producción estable
  (`https://astrapi69.github.io/adaptive-learner/`). Se muestra como
  una insignia discreta, sin estilo de advertencia.
- **Latest** - el sitio de vista previa/pruebas construido desde
  `develop`
  (`https://astrapi69.github.io/adaptive-learner-content-test/`). Se
  muestra como una insignia clara de **versión de prueba** para que
  sepas que puede contener errores.

La insignia muestra la rama de despliegue junto con la rama de git y el
hash corto del commit. Se basa en la información de compilación
incorporada en el momento de compilar; una heurística por URL es solo
una alternativa claramente marcada, y la información que falta se
muestra como «desconocida» en lugar de adivinarse.

### Compartir la app

La pestaña Acerca de tiene una entrada **Compartir la app** que muestra
un **código QR** escaneable de la URL pública de la app, con acciones
para copiar / descargar como PNG / compartir de forma nativa: práctico
para llevar la app a un móvil.

Cuando estás en la rama **Latest**, compartir ofrece la URL de la vista
previa **solo como enlace, sin código QR**, junto con una advertencia de
inestabilidad, para que un código escaneado nunca envíe a nadie sin
saberlo a la versión de prueba inestable. En **Main**, compartir
funciona como siempre con el código QR de la URL de producción.

### Buscar actualizaciones

Un botón **Buscar actualizaciones** en el bloque Versión compara tu
versión con la última versión publicada en GitHub. La compilación de
escritorio ejecuta además un **comprobador automático de
actualizaciones** mediante la API de GitHub Releases y te avisa cuando
hay una versión más reciente; su intervalo se configura en la pestaña
**General** bajo *Actualizaciones*. Tras una actualización de la PWA, el
banner de «nueva versión disponible» permanece cerrado una vez que lo
aceptas (ya no reaparece en cada recarga).
