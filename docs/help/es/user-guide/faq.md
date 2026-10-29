# Preguntas frecuentes

## ¿Están seguros mis datos?

En el **modo Local** tu navegador almacena tus datos en tu propio
dispositivo (en IndexedDB y localStorage), entre otras cosas tu
progreso, las conversaciones importadas y tus ajustes, incluidas
las claves API y el token de GitHub; no interviene ningún servidor
del operador. Otros reciben partes de ellos solo cuando las
necesita una función, por ejemplo tu proveedor de IA, cuando usas
la IA, o GitHub, cuando la app pregunta por sí misma al iniciarse
si hay contenidos nuevos. Cerrar la pestaña del navegador no
elimina estos datos; borrar los datos del sitio en el navegador
los quita de tu dispositivo. Si compartes el dispositivo,
cualquiera con acceso a este perfil del navegador puede leerlos.

En el **modo Servidor** tus datos de aprendizaje residen en la
base de datos SQLite que gestiona el backend FastAPI. Lo que se
genera sin conexión en cuanto a progreso de lecciones y grabaciones
de voz espera en este navegador hasta que la app lo transfiere; qué
cantidad espera como máximo y qué ocurre con el resto se indica en
[Copia de seguridad y restauración](../features/backup.md). Las
claves API se guardan cifradas con Fernet en
`~/.config/adaptive_learner/secrets.yaml`, y por cada proveedor una
copia de respaldo de la última clave API que funcionó, también
cifrada, en la base de datos. La clave de cifrado se genera en el
primer inicio y se guarda en `~/.config/adaptive_learner/secret.key`;
no tienes que configurar nada. Si quieres definir una propia, establece
`ADAPTIVE_LEARNER_SECRET_KEY` (o `secret_key:` en `secrets.yaml`)
antes del primer inicio.

Ninguno de los dos modos envía telemetría, analíticas ni tus
mensajes a ningún tercero aparte del proveedor de IA que hayas
elegido. En una sesión de aprendizaje ese proveedor recibe:

- la instrucción del sistema, con el tema y el objetivo de tu
  proyecto de aprendizaje, una indicación de perfil (tu método de
  aprendizaje preferido y su peso), tus lecciones completadas con
  sus resultados, la lección y el paso en los que estás
  trabajando, tus errores recientes (cada uno con tu respuesta, la
  correcta y cuántas veces) y el idioma en el que debe responder
  la IA; una sesión iniciada desde una conversación importada
  lleva el análisis y la transcripción de esa conversación en
  lugar de tu progreso;
- tus mensajes y las respuestas anteriores de la IA en la sesión;
- como en cada solicitud, entre otras cosas, tu dirección IP y tu
  clave API.

Tus XP e insignias no forman parte de esto. También otras
funciones de IA envían datos a tu proveedor, por ejemplo el
análisis de una conversación importada. La
[revisión de contenido con IA](ai-validation.md) envía las
tarjetas del set que revisa (de cada tarjeta, su identificador,
anverso, reverso y notas). La revisión con IA antes de compartir
envía, de tus lecciones, solo las que compartes y, de ellas, entre
otras cosas, las tarjetas, los textos de los pasos y los
ejercicios (enunciado y opciones de respuesta incorrectas). Ambas
envían además el idioma de origen, el idioma de destino y el nivel
del set. Lo que tú mismo escribes en este contenido se envía con
él y puede ser personal en sí mismo. La
[política de privacidad](../legal/privacy.md) enumera cada
solicitud a la IA.

## ¿Necesito una clave API?

Sí, para las sesiones de IA. La aplicación usa el modelo
**bring-your-own-key** para cada proveedor compatible: Anthropic
Claude, OpenAI GPT y Google Gemini, más Perplexity en modo servidor
(la app de escritorio; la versión de navegador no puede llamar a
Perplexity directamente). Los límites del nivel gratuito suelen ser
suficientes para empezar.

Hay tres lugares donde poner la clave (la prioridad más alta
gana): una variable de entorno `ADAPTIVE_LEARNER_<PROVEEDOR>_API_KEY`,
el campo `ai.<proveedor>.api_key` en
`~/.config/adaptive_learner/secrets.yaml`, o la interfaz de
Ajustes. La interfaz muestra la fuente por proveedor para que
siempre sepas de dónde viene tu clave.

Puedes navegar por el Plan de estudios, realizar la Evaluación,
ver tu Panel principal e incluso ejecutar la Importación del
historial de chat sin una clave API. La página de Sesión, el paso
de análisis y las funciones de extracción con IA son las que
necesitan una clave.

## ¿Puedo usarlo sin conexión?

Parcialmente. El service worker de la PWA almacena en caché los
recursos estáticos (HTML, JS, CSS, iconos) para que la aplicación
se inicie sin internet. Los datos de sesiones pasadas y del Panel
principal también se cargan desde el almacenamiento local, por lo
que consultar material antiguo funciona bien.

**Las sesiones en vivo siguen necesitando conexión** porque el
proveedor de IA está fuera de tu navegador. La página de Sesión
detecta el estado "sin conexión" y muestra un mensaje claro en
línea en lugar de fallar silenciosamente.

## ¿Qué significa el cambio de método?

Cuando tres sesiones seguidas muestran tu comprensión estancada
Y tu estrés alto, la aplicación muestra un banner: «¿Quieres
probar [otro método] en la siguiente sesión?». La recomendación
prefiere tu segundo método más fuerte de la evaluación que no
hayas usado recientemente.

Es una *sugerencia*, no una orden. Puedes descartar el banner y
continuar con tu método actual; el banner reaparece si el patrón
de estancamiento persiste. Los cambios de método se registran en
la tabla `method_switches` y aparecen en la distribución de la
página de Progreso.

## ¿Qué es el auto-bucle?

Cuando una sesión llega al paso 7 (Integración) y el evaluador de
transición de tema considera el tema integrado Y recomienda
continuar, un nuevo ciclo comienza automáticamente con un nuevo
subtema. Hasta 5 ciclos por sesión (protección contra bucles
infinitos). El historial del chat muestra tarjetas con borde
discontinuo «Ciclo N» en cada transición. El diálogo de
calificación al final de la sesión resume el viaje de varios
ciclos cuando `cycle_count > 1`.

Solo en la app de escritorio: en la versión de navegador la sesión se
queda en el paso 7, y la página de la sesión lo indica. Termina ahí la
sesión y empieza una nueva.

## ¿Puedo exportar mis datos?

Sí, entre otras, de estas formas:

- **Copia de seguridad**: Ajustes > Datos > Copia de seguridad y
  exportación > Crear copia de seguridad. Descarga un archivo de copia
  de seguridad `.alb`; puedes crear una copia de seguridad en ambos
  modos de almacenamiento. Tus claves API no están incluidas en ella;
  cómo transferirlas se explica en la página [Ajustes](settings.md), en
  la sección «Exportación cifrada de claves (.alk)». La página
  [Copia de seguridad y restauración](../features/backup.md) da más
  ejemplos de lo que una copia de seguridad no contiene.
- **Informes de Progreso / Sesión / Plan de estudios**: Ajustes >
  Datos > Copia de seguridad y exportación > Exportar. Markdown + PDF (impresión a PDF del navegador).
- **Anki .apkg**: revisa las tarjetas de memoria extraídas por la
  IA en la página `/anki`, acepta las que te gusten y haz clic en
  Exportar. El archivo funciona directamente en Anki de escritorio.
- **ZIP para NotebookLM**: desde la página de Progreso, descarga un
  ZIP estructurado (resumen + vocabulario + reglas + errores +
  tarjetas + sesiones) formateado para la carga de fuentes en
  NotebookLM.

## ¿Qué es la función de voz?

Tres integraciones con la Web Speech API:

- **Texto a voz** en las respuestas de la IA y los resultados de
  la Evaluación - un botón ▶ junto a cada uno lo lee en voz alta,
  coincidiendo con el idioma.
- **Voz a texto** en la entrada de Sesión - un botón 🎤 captura
  tu voz y rellena el área de texto con transcripciones
  provisionales antes de enviar.
- **Práctica de pronunciación** para proyectos de idiomas - visita
  `/pronunciation`, la IA genera una frase objetivo, tú hablas y
  una IA evaluadora puntúa la similitud y sugiere mejoras.

Los alternadores de voz se encuentran en Ajustes > Aprendizaje >
Lectura en voz alta y dictado. El área se oculta en navegadores que
no admiten la API.

## ¿Qué es la importación del historial de chat?

La página de Importación (`/import`) acepta transcripciones de
chat pegadas o subidas de ChatGPT, Claude.ai (tanto la exportación
masiva en JSON como la exportación de una conversación individual
en Markdown), Gemini y Markdown arbitrario. El analizador extrae
tu tema, puntos débiles, patrones de errores, método recomendado,
vocabulario (para conversaciones de idiomas) y un plan de estudios
sugerido. Un clic inicia un Plan de estudios y comienza una sesión
dirigida a partir del análisis.

La exportación Markdown por conversación de Claude.ai es un caso
de importación validado - el analizador incluye extracción
completa de marcas de tiempo y preservación de límites de roles
para ese formato.

## ¿Sincronización entre dispositivos?

Todavía no. La app aún no puede sincronizar tus datos entre
dispositivos: por ahora no puedes emparejar un dispositivo, y sin
emparejamiento la sincronización no intercambia datos. Lo que ves en
Ajustes > Datos > Sincronización depende del modo de almacenamiento:

- En el modo Local esta área no muestra controles, sino el aviso
  «Solo disponible con la aplicación de escritorio.» La versión de
  navegador usa siempre el modo Local, también como aplicación web
  instalada; en la app de escritorio aparece el mismo aviso mientras
  esté configurada en el modo Local (Ajustes > General > Modo de
  almacenamiento: «Local (Navegador)»). Sin embargo, la app de
  escritorio tampoco sincroniza por ahora (ver el punto siguiente).
- En el modo Servidor de la app de escritorio (Ajustes > General >
  Modo de almacenamiento: «Servidor») esta área muestra campos para el
  host y el puerto y el botón «Generar código de emparejamiento». Un
  clic en él muestra un enlace de emparejamiento, un código QR y un
  botón para copiar el enlace. Pero ningún dispositivo puede canjear
  todavía este enlace, tampoco a través del código QR; por tanto, por
  ahora no se puede emparejar un segundo dispositivo con él.

Mientras la sincronización no esté disponible, llevas tus datos a otro
dispositivo con una copia de seguridad, aunque no todos. Entre otras
cosas, una copia de seguridad no contiene tus claves API; cómo
transferir las claves API se explica en la página [Ajustes](settings.md),
en la sección «Exportación cifrada de claves (.alk)». La página
[Copia de seguridad y restauración](../features/backup.md) da más
ejemplos de lo que una copia de seguridad no contiene.

## ¿En qué se diferencia esto de ChatGPT?

ChatGPT es una interfaz de chat para un solo modelo. Adaptive
Learner es un *sistema de aprendizaje estructurado* que usa una
IA internamente pero añade:

1. **Una matriz de 6 métodos × 7 pasos** de prompts del sistema
   especializados.
2. **Evaluación de paso por turno** - una segunda llamada a la IA
   juzga la disposición y puede moverte hacia adelante o hacia
   atrás.
3. **Auto-bucle en nuevos ciclos** cuando el tema está integrado.
4. **Un perfil** de tus preferencias de aprendizaje a partir de
   la evaluación de 12 preguntas.
5. **Seguimiento a largo plazo** - ProgressCommits, mapa de calor
   de racha, XP, insignias, gráficos de tiempo por paso. ChatGPT
   olvida cuando cierras la pestaña.
6. **Libertad de proveedor** - Anthropic, OpenAI o Gemini, más
   Perplexity en modo servidor.
7. **Opción local primero** - en el modo local, tu navegador
   almacena, entre otras cosas, el progreso, las estadísticas y los
   ajustes; otros reciben partes de ellos solo cuando las necesita
   una función. La app se conecta a servidores cuando una función lo
   necesita, por ejemplo a GitHub para los contenidos (para ello
   también sincroniza por sí sola los repositorios conectados al
   iniciarse), a tu proveedor de IA, y a GitHub cuando compartes
   algo o abres allí un informe de error. La
   [política de privacidad](../legal/privacy.md) describe qué casos
   son y qué se transfiere.

## ¿Qué pasa si la IA falla?

El sistema falla de forma visible:

- **Clave API incorrecta**: la llamada a la IA devuelve un
  mensaje de error claro, mostrado en línea en el chat.
- **Proveedor caído**: igual - el error muestra el estado HTTP
  de la API del proveedor.
- **Fallo de análisis JSON del evaluador**: se activa un avance
  determinista de +1 (limitado al paso 7), con `fallback_used: true`
  registrado para que una auditoría futura pueda detectar los
  modelos que tienen dificultades con el formato.
- **Transmisión interrumpida a mitad de respuesta**: la respuesta
  parcial se guarda; el siguiente mensaje continúa desde allí.
- **Respuesta de IA obsoleta o extraña**: termina la sesión,
  dale una calificación baja y repite. El heurístico de cambio de
  método propondrá un método diferente si el patrón persiste.
