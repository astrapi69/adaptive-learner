# Preguntas frecuentes

## ¿Están seguros mis datos?

En el **modo Local** todos tus datos residen en IndexedDB en tu
propio dispositivo. Sin backend, sin servicio de terceros. Cerrar
la pestaña del navegador no los elimina; borrar los datos del
sitio sí lo hace. Si compartes el dispositivo, cualquiera con
acceso a este perfil del navegador puede leerlos.

En el **modo Servidor** los datos residen en la base de datos
SQLite que gestiona el backend FastAPI. Las claves API se cifran
en reposo con Fernet usando un secreto que configuras mediante la
variable de entorno `ADAPTIVE_LEARNER_SECRET_KEY` o mediante
`secret_key:` en `~/.config/adaptive-learner/secrets.yaml`.

Ninguno de los dos modos envía telemetría, analíticas ni tus
mensajes a ningún tercero aparte del proveedor de IA que hayas
elegido - y ese solo ve el contenido del mensaje que cabría
esperar (prompt del sistema + tu texto + las respuestas previas
de la IA en la sesión).

## ¿Necesito una clave API?

Sí, para las sesiones de IA. La aplicación usa el modelo
**bring-your-own-key** para los tres proveedores compatibles:
Anthropic Claude, OpenAI GPT, Google Gemini. Los límites del
nivel gratuito suelen ser suficientes para empezar.

Hay tres lugares donde poner la clave (la prioridad más alta
gana): una variable de entorno `ADAPTIVE_LEARNER_<PROVEEDOR>_API_KEY`,
el campo `ai.<proveedor>.api_key` en
`~/.config/adaptive-learner/secrets.yaml`, o la interfaz de
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

## ¿Puedo exportar mis datos?

Sí. Se han implementado tres rutas de exportación:

- **Copia de seguridad**: Ajustes → Copia de seguridad → Crear
  copia. Descarga un JSON con marca de tiempo con todas las filas
  de tu cuenta. Las claves API se eliminan. Funciona en ambos
  modos de almacenamiento.
- **Informes de Progreso / Sesión / Plan de estudios**: Ajustes →
  Exportar. Markdown + PDF (impresión a PDF del navegador).
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

Los alternadores de voz se encuentran en Ajustes → Voz. La
sección se oculta en navegadores que no admiten la API.

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

Sincronización bidireccional en la red local.
Ajustes → Sincronización → «Emparejar este dispositivo»: escanea
el código QR en la pantalla del otro dispositivo (cámara trasera)
o pega la URL de emparejamiento. Una vez emparejados, los botones
de enviar y recibir intercambian datos; los conflictos pasan por
un resolvedor de fusión de IA. 28 tablas en la superficie de
sincronización (asignaturas, etiquetas y preguntas
de estudio incluidas).

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
6. **Libertad de proveedor** - Anthropic, OpenAI o Gemini.
7. **Opción local primero** - todo en tu navegador, nada enviado
   a un servidor (excepto tus llamadas a la IA).

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
