# Primeros pasos

Adaptive Learner es un compañero de aprendizaje construido sobre
un modelo de seis métodos respaldado por la investigación. Realizas
una breve evaluación para descubrir qué métodos te van mejor, luego
llevas a cabo sesiones con apoyo de IA a través de un ciclo de siete
pasos. La aplicación aprende contigo y adapta cómo te enseña.

## Pruébala ahora

La forma más rápida de probar Adaptive Learner es la instalación
pública:

[**Abrir la aplicación**](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }

Funciona en **modo Local**: todos tus datos permanecen en tu
navegador (IndexedDB), y las llamadas a la IA se disparan
directamente desde la página a Anthropic, OpenAI o Google Gemini
usando tu propia clave API. No se necesita backend.

## Instalar como Progressive Web App

Adaptive Learner es instalable. En navegadores modernos verás un
mensaje de «Instalar» o «Añadir a la pantalla de inicio» la primera
vez que abras el sitio. Acéptalo y Adaptive Learner se convierte
en una aplicación independiente en tu teléfono o escritorio,
ejecutable sin una pestaña del navegador.

La aplicación también funciona sin conexión para el Panel principal
y las sesiones pasadas. Las nuevas sesiones de IA aún necesitan
internet porque el proveedor de IA vive fuera del navegador.

## Qué necesitas

- **Un navegador moderno** (Chrome 100+, Firefox 100+, Safari 17+,
  Edge 100+). La aplicación usa IndexedDB, service workers y
  JavaScript moderno.
- **Una clave API de IA** para al menos uno de los proveedores
  compatibles (Anthropic, OpenAI o Google Gemini). Los niveles
  gratuitos suelen ser suficientes para empezar; consulta
  [Ajustes](settings.md) para saber cómo añadir una clave.

## Los primeros cinco minutos

1. **Abre la aplicación** y elige tu idioma. Los 8 idiomas de la
   interfaz están completamente traducidos (DE, EN, ES, FR, EL,
   PT, TR, JA).
2. **Configura tu proyecto de aprendizaje**: tema, objetivo, plazo,
   minutos al día, más taxonomía de asignatura y etiquetas
   opcionales. Ver [Incorporación](onboarding.md).
3. **Realiza la evaluación de 12 preguntas** para que la aplicación
   sepa en qué métodos de aprendizaje apoyarse. Desliza a
   izquierda/derecha entre preguntas en el móvil. Ver
   [Evaluación](assessment.md).
4. **Añade tu clave API de IA** en Ajustes, O colócala en
   `~/.config/adaptive-learner/secrets.yaml` si usas el launcher
   de escritorio. La interfaz de Ajustes muestra de qué capa
   proviene tu clave.
5. **Inicia tu primera sesión**. El botón «Iniciar sesión» del
   Panel principal te lleva a una conversación de aprendizaje. Las
   respuestas de la IA se transmiten token a token; el evaluador
   de doble prompt decide cada paso del ciclo. Ver
   [Sesión de aprendizaje](learning-session.md).

## Hacia dónde ir después

- [El ciclo de aprendizaje de 7 pasos explicado](learning-session.md)
- [Cómo leer tu Panel principal](dashboard.md)
- [Preguntas frecuentes](faq.md)
- [El concepto pedagógico detrás de la aplicación](../concept/philosophy.md)
