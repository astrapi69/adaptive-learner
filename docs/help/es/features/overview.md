# Resumen de funciones

Esta página es la respuesta canónica a la pregunta "¿qué puede hacer
realmente Adaptive Learner?". Enumera todas las capacidades
principales de la app visibles para el usuario, agrupadas por tema, y
se mantiene al día con cada versión. Otros lugares (el README, las
páginas de ayuda individuales) enlazan aquí en lugar de mantener sus
propias copias de esta lista.

## Núcleo de aprendizaje

- **Seis métodos de aprendizaje** (deductivo, inductivo, basado en
  errores, dialógico, contextual, adaptativo por IA) con prompts de
  IA propios por método y paso.
- **Ciclo de sesión de siete pasos**: input, foco, intento, feedback,
  refinamiento, transferencia, integración. Un evaluador de doble
  prompt juzga cada turno y decide si avanzar, repetir, saltar hacia
  adelante o retroceder.
- **Auto-loop**: cuando un tema queda integrado, la sesión elige un
  nuevo subtema y arranca un ciclo nuevo (con límite por sesión).
- **Cambio de método**: la detección de estancamiento recomienda un
  método distinto cuando las valoraciones se aplanan; se acepta con
  un clic.
- **Evaluación de nivel inicial** (opcional, reanudable) que calcula
  un perfil de aprendizaje de seis métodos; un inicio rápido de dos
  campos funciona sin ella.

Consulta [Sesiones de aprendizaje](../user-guide/learning-session.md)
y [El método de aprendizaje](../concept/philosophy.md).

## Chat con el tutor de IA

- **Chat de sesión construido sobre assistant-ui**: respuestas en
  streaming token a token, renderizado de Markdown, temas y
  localización completa.
- **Voz**: dictado por micrófono en el chat, lectura en voz alta de
  las respuestas y un modo dedicado de práctica de pronunciación.
- **Trae tu propia clave (BYOK)**: Anthropic Claude, OpenAI GPT y
  Google Gemini como plugins de proveedor separados; descubrimiento
  de modelos en vivo con un selector de recomendados/todos; prueba de
  clave por proveedor y un almacén de claves con reversión.
- **Las conversaciones importadas continúan como sesiones de
  tutoría**, conservando el tema original y el contexto del análisis.
- **"Preguntar a la IA"** en bloques de teoría y ejercicios, y
  respuestas de la IA siempre en el idioma de interfaz del aprendiz.

## Tipos de ejercicio

Seis tipos principales que todo conjunto puede usar, más cinco tipos
de extensión que un conjunto puede incluir:

| Tipo principal | Qué hace el aprendiz |
|---|---|
| Emparejar | Unir términos entre dos columnas (se puede empezar por cualquiera de los dos lados) |
| Elección de imagen | Elegir la imagen que corresponde |
| Texto libre | Escribir la respuesta (tolerancia a erratas, varias respuestas aceptadas, segunda opinión de la IA opcional) |
| Cloze (texto con huecos) | Rellenar los huecos escribiendo, seleccionando o con selección múltiple |
| Fichas de palabras | Componer la respuesta a partir de fichas desordenadas (arrastre táctil) |
| Opción múltiple | Respuesta única o múltiple |

| Tipo de extensión | Qué hace el aprendiz |
|---|---|
| Categorización | Clasificar elementos en grupos |
| Corrección de errores | Encontrar y corregir el error de una frase |
| Comprensión lectora | Leer un texto y responder preguntas |
| Cuestionario calificado | Un mini-cuestionario con puntuación |
| Dictado de audio | Escuchar y escribir lo que se ha dicho |

- Los ejercicios son **conscientes de la dirección** (reconocer
  frente a producir), muestran un **indicador de dificultad por
  ejercicio**, admiten **contenido de código y de fórmulas** con
  resaltado de sintaxis y ofrecen variantes de **audio primero**
  (escuchar antes de leer).
- Las respuestas incorrectas reciben **feedback de diferencias a
  nivel de token**; las pistas están escalonadas y cuestan XP.

Consulta [Lecciones](../user-guide/lessons.md) para la vista del
aprendiz.

## Lecciones y mecánica de aprendizaje

- **Siete maneras de jugar una lección o un conjunto**: Práctica,
  Examen (feedback diferido, veredicto de aprobado/no aprobado,
  bonificación de XP), Con tiempo, Inverso, Aleatorio, Infinito y un
  modo desbloqueable "Entrenar errores" que repite solo lo que salió
  mal.
- **Repetición espaciada (SRS)** sobre el historial de errores por
  elemento: cola de repasos pendientes, dominio consciente de la
  dirección, aumento del intervalo en modo examen y longitud
  configurable de la sesión de repaso.
- **Lecciones adaptativas** generadas bajo demanda a partir de tus
  propios patrones de error (basadas en reglas, sin conexión, sin
  necesidad de clave de API).
- **La repetición de errores y una ronda de corrección** al final de
  la lección ejercitan exactamente las palabras que fallaste.
- **Control del flujo de la lección**: pausar, reanudar en el paso
  exacto, autoguardado y un widget de lecciones pausadas en el panel.
- Valoración de 0 a 3 estrellas, favoritos, sugerencias del siguiente
  paso, división automática de lecciones demasiado grandes y enlaces
  de vuelta a la teoría desde los ejercicios.

## Creación de lecciones (Create-Lesson)

- **Un asistente sin clave de API** construye una lección completa y
  compartible: editor de tarjetas con arrastrar y soltar e
  importación CSV, subida de imagen por tarjeta, plantillas,
  autoguardado de borradores y vista previa en el reproductor de
  lecciones real.
- **Todos los ejercicios son editables**: todos los tipos principales
  se pueden editar tras la generación, añadir a mano y equilibrar; un
  **asistente de creación de extensiones** cubre los cinco tipos de
  extensión, incluida la subida de un archivo de audio para el
  dictado.
- **Ingestión de texto de libro**: pega texto de un manual o sube un
  archivo de libro (EPUB, DOCX, TXT, Markdown) con selector de
  capítulos, selección múltiple de las secciones detectadas, una
  heurística automática de exclusión de las páginas preliminares y
  finales y generación de lecciones por lotes por sección.
- **Generación de ejercicios con IA** (con tu propia clave) con una
  puerta de calidad determinista, regeneración con feedback y
  generación por lotes para un conjunto entero.
- **Gestiona tus propias lecciones**: edita cualquier lección de un
  conjunto de varias lecciones mediante un selector de lecciones,
  combina lecciones propias en un conjunto y elige un dominio de
  contenido (idiomas más dominios de conocimiento).

Consulta [Crear lecciones](../content-creation/overview.md).

## Importación y análisis

- **Importación de historiales de chat** desde ChatGPT, Claude,
  Gemini y Markdown arbitrario o texto pegado.
- El **análisis con IA** extrae el tema, las debilidades, los
  patrones de error, el método recomendado, el vocabulario y una
  propuesta de plan de estudios.
- Un clic siembra un **currículo**, inicia una **sesión dirigida** o
  convierte el análisis en una **lección sin conexión reproducible**.

## Gestión de contenido

- **Hub de contenido** con las pestañas Descubrir / Mis contenidos /
  Importar, vista de lista o de cuadrícula y una barra de búsqueda y
  filtros (idioma, nivel, dominio, confianza, verificado por IA).
- **Conjuntos de lecciones descargables** desde repositorios de
  contenido públicos de GitHub, almacenados en caché para uso sin
  conexión; los conjuntos pueden ocultarse mediante un indicador de
  visibilidad en el manifiesto.
- **Repositorios federados**: conecta varios repos de contenido
  propios o de terceros (repos privados mediante token), una sección
  de repos recomendados e insignias de confianza por fuente.
- **Compartir con la comunidad**: un asistente de cuatro pasos abre
  un pull request real contra un repo de contenido, con colocación
  inteligente y detección de duplicados; los códigos de invitación
  permiten el intercambio privado para coaches.
- **Enlaces profundos y códigos QR por conjunto**, una vista de ruta
  de aprendizaje con dominio por conjunto, recomendaciones de libros
  por dominio y una sección de libro de acompañamiento por conjunto.

Consulta [Explorador de contenido](content-browser.md),
[Descubrir contenido](discover.md) y
[Repositorios de contenido](content-repos.md).

## Gamificación

- **XP y niveles** con una insignia de XP visible y recompensas por
  lección.
- **Catálogo de insignias por niveles** (bronce/plata/oro; las
  insignias bloqueadas siguen visibles con una pista de desbloqueo).
- **Rachas** con mapa de calor y **misiones diarias** (hasta tres
  objetivos adaptativos al día).
- **Celebraciones**: elogios merecidos y de intensidad configurable,
  overlays de hitos, sonidos opcionales, todo seguro con movimiento
  reducido.

## Exportaciones y copia de seguridad

- **Anki**: tarjetas de memoria extraídas por la IA, revisadas en la
  app y exportadas como `.apkg` o `.txt`.
- **NotebookLM**: un ZIP con resumen, vocabulario, reglas, errores,
  tarjetas y sesiones, además de preguntas de recuerdo activo y una
  guía de estudio.
- **Repositorio de aprendizaje**: artefactos Markdown por proyecto
  (README, estadísticas, chuleta, hoja de ruta), descargables como
  ZIP o confirmados con git en modo servidor.
- **Informes de progreso** como Markdown o PDF; resultados de lección
  exportables para seguir practicando con ayuda de la IA; hoja de
  compartir nativa para los resultados.
- **Copias de seguridad**: copia `.alb` en ZIP que cubre toda la
  superficie de datos, guardado en disco, restauración en el primer
  arranque, migración de online a local y una exportación `.alk`
  separada, cifrada con frase de contraseña, para las claves de IA.

Consulta [Copia de seguridad y restauración](backup.md).

## Plataforma

- **Progressive Web App**: instalable, funciona sin conexión,
  actualizaciones por service worker con banner de actualización,
  funciona por completo en el navegador.
- **Dos modos de almacenamiento**: local primero (todo en el
  IndexedDB del navegador, las llamadas de IA van directas al
  proveedor, sin necesidad de servidor) o modo servidor (backend
  FastAPI con SQLite, varios dispositivos).
- **Sincronización en red local** entre dispositivos con
  emparejamiento por código QR y resolución de conflictos.
- **Launcher de escritorio** para Linux, macOS y Windows: una
  configuración autoalojada de un clic basada en Docker con detección
  de Docker consciente del contexto y autodiagnóstico.
- **Once idiomas de interfaz**, totalmente traducidos, con un
  selector de idioma con búsqueda.
- **Formato de contenido abierto**: las lecciones son JSON plano
  validado contra un esquema publicado; la app consume el motor de
  contenido como paquete.

Consulta [Instalación](../install/launcher.md).

## Accesibilidad y UX

- **Temas verificados según WCAG AA** (claro, oscuro, presets de
  color, modo automático que sigue al sistema operativo), asegurados
  por comprobaciones de contraste automatizadas.
- **Teclado primero**: atajos globales con overlay de ayuda, Enter
  avanza en las lecciones, Tab navega por los huecos del cloze.
- **Compatibilidad con lectores de pantalla**: landmarks, etiquetas
  ARIA y regiones vivas, tablas de datos para los gráficos, gestión
  del foco en los diálogos.
- El **movimiento reducido** se respeta en todas partes; lectura en
  voz alta (TTS) para lecciones y chat.
- **Ayuda contextual dentro de la app**: el panel de ayuda abre el
  artículo de la vista actual; cada artículo enlaza con este sitio de
  documentación.
