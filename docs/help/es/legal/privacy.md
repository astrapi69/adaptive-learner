# Política de privacidad

> Esta página es una traducción automática del original en alemán y se ofrece solo a título informativo. Únicamente la versión en alemán es jurídicamente vinculante.

Última actualización: 29 de octubre de 2026

Como texto jurídico, esta política utiliza el trato de usted; en la app y en
el resto de la ayuda te tratamos de tú.

Esta política se aplica a la versión web pública de Adaptive Learner en
`astrapi69.github.io/adaptive-learner`, a la vista previa pública de la
próxima versión en `astrapi69.github.io/adaptive-learner-content-test` y a
estas páginas de documentación. Si usted instala Adaptive Learner por su
cuenta (lanzador de escritorio o Docker), usted opera la app en su propio
dispositivo y el operador de estas páginas solo recibe lo que usted mismo le
envíe, por ejemplo una lección compartida o un informe de error. Aun así, la
app y el lanzador consultan `api.github.com` en busca de nuevas versiones, los
contenidos de aprendizaje proceden de GitHub y su propio servidor envía las
solicitudes de IA al proveedor elegido.

## Responsable del tratamiento

Asterios Raptis, Seestraße 68, 71638 Ludwigsburg, Alemania

Correo electrónico: asteri.raptis@gmail.com

## En resumen

Adaptive Learner no tiene ningún servidor del operador. La app y estas páginas
no instalan cookies, no utilizan servicios de análisis ni de seguimiento y no
cargan fuentes ni scripts de terceros. En su navegador se almacenan, entre
otras cosas, su progreso, sus estadísticas y sus ajustes. De ellos, el operador
solo recibe lo que usted mismo le envíe, y otros reciben partes de ellos solo
cuando una función las necesita, por ejemplo su proveedor de IA, cuando usted
utiliza la IA con su propia clave, o GitHub, cuando la app pregunta por sí
misma si hay contenidos nuevos.

Los datos solo salen de su dispositivo en estos casos, descritos en detalle
más abajo:

- Cuando usted abre la app y estas páginas, GitHub, como proveedor de
  alojamiento, trata, entre otras cosas, su dirección IP.
- La app carga los contenidos de aprendizaje desde GitHub y comprueba allí,
  también por sí misma, si hay novedades.
- Cuando usted comparte una lección con la comunidad o utiliza funciones de
  GitHub con su propio token de acceso, los datos van a GitHub; el operador
  también recibe las contribuciones compartidas.
- GitHub solo recibe un informe de error cuando usted mismo lo abre en
  GitHub.
- Las funciones de IA envían sus solicitudes, con su propia clave,
  directamente al proveedor que usted ha elegido.
- Para la entrada de voz y la lectura en voz alta, su navegador puede utilizar,
  según el fabricante, un servicio en línea.
- Los botones para compartir y los enlaces externos abren otros sitios solo
  después de que usted haga clic.
- Usted escribe un correo electrónico al operador.

## Alojamiento en GitHub Pages

La app, la vista previa y esta documentación se sirven mediante GitHub Pages,
un servicio de GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA
94107, USA. En cada solicitud, GitHub trata la dirección IP de su dispositivo
y los datos de conexión habituales (hora, archivo solicitado, tipo de
navegador); según sus propias indicaciones, GitHub registra y conserva la
dirección IP con fines de seguridad. El operador no recibe estos datos.

La base jurídica es el interés legítimo en una entrega segura y eficiente
(art. 6, apartado 1, letra f), del Reglamento general de protección de datos,
RGPD). GitHub está certificado conforme al Marco de Privacidad de Datos
UE-EE. UU. (EU-US Data Privacy Framework), por lo que una decisión de
adecuación ampara la transferencia a Estados Unidos (art. 45 del RGPD). Más
información:
[Declaración de privacidad de GitHub](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

Más allá de eso, estas páginas de documentación no cargan nada de otros
servidores: usan las fuentes de su sistema, y la búsqueda se ejecuta en su
navegador sin que sus términos de búsqueda salgan de él.

## Carga de contenidos de aprendizaje

Los contenidos de aprendizaje se encuentran en repositorios de contenido en
GitHub. Su navegador los carga directamente desde `raw.githubusercontent.com`,
y los repositorios con token de acceso propio a través de `api.github.com`. El
destinatario, en calidad de responsable del tratamiento, es GitHub, Inc.
(véase arriba). La app carga:

- al abrir, descargar o actualizar un conjunto, sus lecciones e imágenes,
- al abrir la página Contenido, el catálogo: repositorios recomendados,
  índices de búsqueda, listas de medios y de libros, y portadas de libros,
- al final de cada lección, la lista de medios complementarios,
- cuando usted añade o comprueba un repositorio, canjea un código de
  invitación o abre un enlace compartido a un conjunto, una invitación o un
  repositorio, los archivos necesarios para ello.

Además, la app comprueba por sí misma, sin que usted haga clic en nada, si sus
conjuntos tienen versiones nuevas y qué repasos están pendientes. Para ello lee
los archivos de manifiesto del catálogo oficial y de sus repositorios
conectados, por ejemplo al iniciarse, al cambiar de página, cuando la ventana
vuelve a primer plano y después de sus respuestas en los repasos. Su navegador
suele responder desde su caché a las solicitudes que se repiten en poco tiempo.
La
comprobación se ejecuta en todas las páginas de la app que muestran la barra de
navegación, es decir, también ya en una primera visita a través de un enlace
compartido o directo y en la página de error de una dirección mal escrita,
incluso bajo /docs/. Además, la app sincroniza los repositorios conectados al
cargarse cualquier página, también sin barra de navegación, si la última
sincronización tiene más de un día.

GitHub recibe su dirección IP, los datos habituales del navegador (tipo y
versión del navegador, sistema operativo, idioma), por lo general el origen de
la solicitud (`astrapi69.github.io`) y la ruta del archivo solicitado. La ruta
muestra qué repositorios, conjuntos y lecciones utiliza usted, incluidos los
repositorios que haya añadido usted mismo, y, al canjearlo, el código de
invitación. No se instalan ni se envían cookies.

La base jurídica es, para los contenidos que usted solicita, la prestación de
la función (art. 6, apartado 1, letra b), del RGPD) y, para la comprobación
automática, el interés legítimo en mostrarle contenidos actualizados y los
repasos pendientes (art. 6, apartado 1, letra f), del RGPD). Sobre la
transferencia a Estados Unidos, véase arriba.

## Funciones de GitHub con su propio token de acceso

Algunas funciones utilizan la API de GitHub (`api.github.com`) con un token de
acceso personal que usted mismo introduce, en Ajustes, en Integraciones, o
para un repositorio concreto. El token se almacena en su navegador y solo se
envía a GitHub. Con él, la app actúa en su nombre:

- Comprueba el token y, al hacerlo, lee su nombre de usuario de GitHub.
- Lee los repositorios privados que usted ha conectado, también durante la
  comprobación automática descrita arriba.
- Comparte una lección con la comunidad: como pull request al repositorio
  público `astrapi69/adaptive-learner-content` del operador, a través de una
  copia (fork) en su cuenta.
- Envía su propio repositorio de contenido para la búsqueda, también como pull
  request a `astrapi69/adaptive-learner-content`.
- Exporta un conjunto a un nuevo repositorio de su cuenta, privado por
  defecto.
- Para los coaches, crea, enumera y desactiva códigos de invitación en la
  carpeta `codes/` de su propio repositorio.

Sin token, «Compartir con la comunidad» abre en su lugar la página de edición
de GitHub (`github.com`); si la lección cabe en la dirección de esa página, su
contenido figura en ella. «Preparar envío» (Ajustes > Datos > Registra tu
repositorio) consulta en `api.github.com` el último estado del repositorio que
usted indique, con el token de ese repositorio si lo ha guardado.

GitHub recibe el token, su dirección IP, los datos habituales del navegador,
los nombres de los repositorios y archivos y todo lo que usted comparte o
exporta: la lección o los archivos del conjunto, el mensaje de commit, el
título y la descripción del pull request con los datos de la lección, la
entrada del registro y, si lo indica, su nombre como autor o autora. Un código
de invitación contiene el código, el repositorio, la rama, el número máximo de
usos, la fecha de caducidad, una nota y, si lo incluye, un token de lectura;
cualquiera que pueda leer el archivo del código puede leer ese token.

Lo que usted envía a `astrapi69/adaptive-learner-content` se convierte en un
pull request público con su nombre de usuario de GitHub y, si lo indica, su
nombre de autor. El operador lo recibe, lo revisa y, en su caso, incorpora la
contribución a los contenidos (art. 6, apartado 1, letras b) y f), del RGPD).
El pull request y el historial de versiones del repositorio se conservan
mientras exista el repositorio. Para las demás funciones, la base jurídica es
su solicitud (art. 6, apartado 1, letra b), del RGPD). El destinatario es
GitHub, Inc. (véase arriba).

## Informes de error

Usted prepara un informe de error con el botón de un mensaje de error o de una
vista que no se pudo cargar («Informar de un problema») o con «Crear informe de
error» en Ajustes, en «Diagnóstico y soporte». Primero ve el informe. Solo
cuando hace clic en «Abrir en GitHub», la app abre en una pestaña nueva un
formulario prerrellenado para una nueva incidencia (issue) en el repositorio
`astrapi69/adaptive-learner` en `github.com`. El informe figura en la dirección
de esa página, por lo que GitHub lo recibe en cuanto se abre la pestaña, antes
de que usted envíe nada allí. Ante un error interno al crear una lección,
«Informar del problema» abre directamente un formulario de este tipo, solo con
ese mensaje de error.

El informe contiene el mensaje de error con datos técnicos (por ejemplo,
código de estado, endpoint, hora o traza de la pila) y su propia descripción.
La app solo añade la información del entorno (versión de la app, navegador,
sistema operativo, página actual) y el historial de acciones (véase
Almacenamiento en su dispositivo) si usted marca la casilla correspondiente;
ambas están inicialmente desmarcadas.

Si envía la incidencia en GitHub, es pública y queda vinculada a su cuenta de
GitHub. El operador la recibe y la utiliza para corregir el error (art. 6,
apartado 1, letra f), del RGPD); se conserva mientras exista la incidencia. El
destinatario es GitHub, Inc. (véase arriba).

## Funciones de IA con su propia clave

Las funciones asistidas por IA solo existen si usted introduce su propia clave
de API de un proveedor en Ajustes, en IA. Su navegador envía entonces las
solicitudes directamente a ese proveedor; el operador no recibe estos datos.
Usted tiene su propio contrato con el proveedor, y se aplican sus condiciones
y su aviso de privacidad. El destinatario es el proveedor cuya clave usted
utiliza:

- Anthropic (`api.anthropic.com`): para clientes en el EEE, Anthropic Ireland,
  Limited, 6th Floor, South Bank House, Barrow Street, Dublin 4, D04 TR29,
  Irlanda. La clave va en la cabecera de la solicitud.
- OpenAI (`api.openai.com`): para clientes en el EEE, OpenAI Ireland Limited,
  1st Floor, The Liffey Trust Centre, 117-126 Sheriff Street Upper, Dublin 1,
  D01 YC43, Irlanda. La clave va en la cabecera de la solicitud.
- Google (`generativelanguage.googleapis.com`, la API de Gemini): para el uso
  de pago con dirección de facturación en el EEE, Google Cloud EMEA Limited,
  70 Sir John Rogerson's Quay, Dublin 2, Irlanda (con dirección de facturación
  en Francia, Italia o Polonia, la sociedad de Google Cloud de ese país); para
  el uso gratuito, Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA
  94043, USA. Aquí la clave va en la dirección de la solicitud, no en su
  cabecera.

Se envían solicitudes cuando usted utiliza una función de IA, por ejemplo
sesiones de aprendizaje (incluida la evaluación automática de cada paso),
«Preguntar a la IA» en las lecciones, la revisión de sus respuestas por la IA,
la generación de ejercicios y lecciones, el análisis de chats importados, las
tarjetas, las preguntas de estudio y la guía de estudio, la práctica de
pronunciación y la revisión y generación de contenidos por la IA. Sin que usted escriba nada, la app envía además:

- una consulta de los modelos disponibles cuando abre la página Sesión o la
  selección de modelo en Ajustes,
- una solicitud de prueba al proveedor de una clave cuando guarda la clave,
  restaura una copia de seguridad de la clave o hace clic en «Probar», aunque
  ese proveedor no esté activo,
- una sola vez, las primeras solicitudes de una sesión de aprendizaje que
  inicia a partir de un chat importado; contienen el chat pegado.

Cada solicitud incluye su clave, su dirección IP y los datos habituales del
navegador, también el origen de la solicitud (`astrapi69.github.io`). La
consulta de modelos y la solicitud de prueba son una misma consulta de la lista
de modelos y no contienen nada más; tras una consulta correcta, la app no
vuelve a enviarla para la misma clave en la misma pestaña durante una hora. Las
demás solicitudes contienen, según la función:

- sus mensajes, preguntas y respuestas y el historial de la sesión hasta el
  momento,
- los contenidos de aprendizaje afectados (lecciones, ejercicios, tarjetas),
- el tema y el objetivo de su proyecto de aprendizaje y su método de
  aprendizaje preferido con su peso,
- los títulos y resultados de sus lecciones completadas, la lección en la que
  está trabajando y sus últimos errores con su respuesta y la esperada,
- para las preguntas de estudio, el historial de hasta cinco de sus últimas
  sesiones completadas con hora de inicio y método,
- para la guía de estudio, el historial de hasta diez de sus últimas sesiones
  completadas con hora de inicio y método y, además, el plazo, los minutos al
  día, todos los pesos de los métodos y el vocabulario de los chats analizados,
- en los chats importados, su título y el texto pegado completo,
- en la práctica de pronunciación, la frase objetivo y el texto reconocido de
  su intento,
- el idioma en el que debe responder la IA.

La base jurídica es la función que usted utiliza (art. 6, apartado 1, letra
b), del RGPD); para la consulta de modelos y la solicitud de prueba, el
interés legítimo en mostrarle los modelos disponibles y avisarle de inmediato
de una clave no válida (art. 6, apartado 1, letra f), del RGPD).

Los proveedores también pueden tratar los datos fuera de la UE, en particular
en Estados Unidos. Anthropic, según sus propias condiciones contractuales, basa
las transferencias a terceros países en las cláusulas tipo de protección de
datos adoptadas por la Comisión Europea (art. 46, apartado 2, letra c), del
RGPD), y OpenAI en cláusulas tipo de protección de datos o en una decisión de
adecuación; Google LLC está certificada conforme al Marco de Privacidad de
Datos UE-EE. UU. (art. 45 del RGPD). Avisos de privacidad de los proveedores:

- [Anthropic](https://www.anthropic.com/legal/privacy)
- [OpenAI](https://openai.com/policies/eu-privacy-policy/)
- [Google](https://policies.google.com/privacy) y las
  [condiciones de la API de Gemini](https://ai.google.dev/gemini-api/terms)

## Entrada de voz

Cuando usted toca el micrófono (en el campo de entrada de la sesión de
aprendizaje y en la práctica de pronunciación), la app utiliza el
reconocimiento de voz de su navegador. La grabación empieza solo después de
tocarlo; antes de que comience, su navegador pide permiso para usar el
micrófono, salvo que usted ya se lo haya concedido a este sitio. El
reconocimiento lo realiza el navegador, no la app: Google Chrome envía para
ello, entre otras cosas, la grabación y el idioma elegido a un servicio de
Google (`www.google.com`); los demás navegadores también pueden enviar la
grabación a un servicio de su fabricante. El responsable de este tratamiento es
el fabricante del navegador, y se aplica su aviso de privacidad. En Chrome se
trata de Google; para los usuarios del EEE, según la
[política de privacidad de Google](https://policies.google.com/privacy), de
Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlanda; Google
también puede tratar los datos en Estados Unidos, y Google LLC está certificada
conforme al Marco de Privacidad de Datos UE-EE. UU.

La app solo recibe el texto reconocido. En la sesión de aprendizaje llega al
campo de entrada, en la práctica de pronunciación a su intento; cuando usted
lo envía, va a su proveedor de IA. La base jurídica para iniciar el
reconocimiento es su solicitud (art. 6, apartado 1, letra b), del RGPD). En
Ajustes, en Aprendizaje, «Mostrar botón de micrófono» oculta la entrada de
voz. Las grabaciones de los ejercicios de expresión oral, en cambio, las hace
la propia app; se almacenan en su navegador.

## Lectura en voz alta

Usted inicia la lectura en voz alta con los botones de lectura, la tecla R o
«Leer todo»; la lectura automática solo funciona si usted la activa. Se leen
los textos de las lecciones, los enunciados, las preguntas de la evaluación del
tipo de aprendizaje, las respuestas de la IA y las frases de la práctica de
pronunciación. Para ello, la app utiliza la síntesis de voz de su navegador o
de su sistema operativo. Da preferencia a una voz que se ejecuta en su
dispositivo. Una voz en línea solo lee en tres casos: si no hay ninguna voz
local para el idioma, si usted mismo ha elegido una voz en línea en Ajustes, y
en los primeros instantes tras la carga de una página, porque en ese momento su
dispositivo aún no ha puesto a disposición sus propias voces.

Una voz en línea envía el texto que se va a leer a su proveedor. En Google
Chrome son voces de Google; el texto figura entonces en la dirección de la
solicitud a `www.google.com`. En Linux, Chrome suele ofrecer solo voces de este
tipo. El responsable es el proveedor de la voz, en Chrome Google (véase
Entrada de voz). La base jurídica es su solicitud (art. 6, apartado 1, letra
b), del RGPD).

## Botones para compartir

Aparece un botón para compartir en el Panel, en las filas de «Continuar
aprendiendo», en cuanto usted completa una lección con resultado, y al final de
una lección en la evaluación detallada. En el resumen compacto solo aparece si
está activado en Ajustes, en Aprendizaje, en «Resumen tras las lecciones» (de
forma predeterminada está desactivado). Si su dispositivo ofrece
su propio diálogo para compartir, la app lo abre y usted elige allí dónde
compartir. Si no, muestra enlaces a Facebook, LinkedIn, X y WhatsApp y una
opción para copiar.

Solo cuando usted hace clic en uno de estos enlaces, su navegador abre la
página de la red; la red recibe entonces su dirección IP, los datos habituales
del navegador y las cookies que ella misma haya instalado en su dispositivo.
Facebook y LinkedIn solo reciben la dirección de la app; X y WhatsApp, un
texto prerrellenado con el título de la lección, su resultado (porcentaje y
número de respuestas correctas) y la dirección de la app; usted aún puede
modificar este texto antes de enviarlo. La app no integra scripts ni botones de
estas redes; a partir del clic se aplican sus avisos de privacidad. La base
jurídica es su solicitud (art. 6, apartado 1, letra b), del RGPD).

## Enlaces externos

La app y estas páginas contienen enlaces a servicios externos (entre ellos
GitHub, Amazon, YouTube, AnkiWeb y plataformas de donación). Los vídeos y las
imágenes de los contenidos de aprendizaje o de las respuestas de la IA que
apuntan a otros servidores también los muestra la app como enlace; solo se
cargan después de que usted haga clic. Con el clic, usted abandona la app o
estas páginas; a partir de ese momento se aplica el aviso de privacidad del
proveedor correspondiente. No se incluyen scripts, botones ni contenidos
incrustados de estos proveedores.

## Almacenamiento en su dispositivo

Lo que usted crea en la app lo almacena su navegador localmente en IndexedDB y
localStorage: perfil, proyectos de aprendizaje, progreso y estadísticas,
notas, chats importados, lecciones descargadas, grabaciones de los ejercicios
de expresión oral, copias de seguridad automáticas y sus ajustes, incluidas
sus claves de API y su token de GitHub, además de catálogos en caché. La app
utiliza además:

- el sessionStorage, que su navegador borra al cerrar la pestaña, para el
  historial de acciones destinado a los informes de error (sus últimas
  acciones en la app, como botones pulsados, cambios de página, opciones
  elegidas, avisos y errores, pero ninguna entrada de teclado) y, si ha
  introducido una clave de IA, para la lista de modelos de su proveedor,
  durante una hora y guardada bajo una huella breve de su clave en lugar de la
  propia clave,
- el Cache Storage para los archivos de la app y las lecciones descargadas,
  para que funcione también sin conexión.

Estas páginas de documentación solo guardan el esquema de colores (claro u
oscuro) en el localStorage. La vista previa pública está en el mismo dominio
(`astrapi69.github.io`) que la app, por lo que ambas comparten el
almacenamiento de su navegador.

Este almacenamiento es estrictamente necesario para las funciones que usted
utiliza y está comprendido en la excepción del artículo 25, apartado 2,
número 2, de la TDDDG alemana; no se requiere consentimiento. El
almacenamiento en sí no transmite nada; cuándo salen datos de su dispositivo
se describe en las secciones anteriores. Puede exportar o eliminar los datos
en cualquier momento en Ajustes, o borrar los datos del sitio en su navegador.

## Contacto por correo electrónico

Si usted escribe un correo electrónico al operador, sus datos se almacenan
para tramitar la solicitud (art. 6, apartado 1, letras b) y f), del RGPD) y se
eliminan una vez resuelta la solicitud, siempre que no se oponga ninguna
obligación legal de conservación.

## Sus derechos

Frente al responsable del tratamiento, usted tiene derecho de acceso (art. 15
del RGPD), de rectificación (art. 16), de supresión (art. 17), a la limitación
del tratamiento (art. 18), a la portabilidad de los datos (art. 20) y de
oposición al tratamiento basado en intereses legítimos (art. 21). También
puede presentar una reclamación ante una autoridad de control en materia de
protección de datos (art. 77 del RGPD), por ejemplo la autoridad de su lugar de
residencia habitual o la de la sede del responsable del tratamiento.

Dado que el operador no dispone de sus datos de aprendizaje, las solicitudes de
acceso y supresión relativas a esos datos se gestionan en su propio
dispositivo: Ajustes, Datos, Exportar o Eliminar. Para las contribuciones, los
informes de error y los correos electrónicos que el operador haya recibido de
usted, diríjase a la dirección de correo electrónico indicada arriba.

## Cambios

Esta política se actualiza cuando cambian la app o la situación jurídica. La
fecha de la versión vigente figura al principio.

Véase también el [aviso legal](imprint.md).
