# Primeros pasos

Adaptive Learner es un compañero de aprendizaje basado en un
modelo de seis métodos respaldado por la investigación. Haces una
breve prueba que averigua qué métodos encajan contigo y luego
realizas sesiones de aprendizaje asistidas por IA a través de un
ciclo de siete pasos. La app aprende contigo y adapta cómo
enseña.

## Pruébalo ahora

La forma más rápida de conocer Adaptive Learner es la versión
pública en línea:

[**Abrir la app**](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }

Esta se ejecuta en **modo local**: todos tus datos permanecen en
tu navegador (IndexedDB), y las llamadas de IA van directamente
desde la página a Anthropic, OpenAI o Google Gemini con tu propia
clave de API. Sin ningún backend de por medio.

## Instalar como aplicación web progresiva

Adaptive Learner es instalable. Los navegadores modernos muestran
en la primera visita un aviso de "Instalar" o "Añadir a la
pantalla de inicio". Acéptalo y Adaptive Learner se convierte en
una app independiente en tu smartphone o escritorio, que puedes
iniciar sin una pestaña del navegador.

La app funciona sin conexión para el Dashboard y las sesiones
pasadas. Las nuevas sesiones de IA necesitan internet, porque el
proveedor de IA reside fuera del navegador.

## Qué necesitas

- **Un navegador moderno** (Chrome 100+, Firefox 100+, Safari
  17+, Edge 100+). La app usa IndexedDB, service workers y
  JavaScript moderno.
- **Una clave de API de IA** para al menos uno de los tres
  proveedores admitidos (Anthropic, OpenAI o Google Gemini). Los
  cupos gratuitos suelen bastar para empezar; consulta
  [Ajustes](settings.md) para la configuración de claves.

## Los primeros cinco minutos

1. **Abre la app** y elige el idioma. Los 8 idiomas de la interfaz
   están completamente traducidos (DE, EN, ES, FR, EL, PT, TR,
   JA).
2. **Onboarding: solo nombre + tema.** El inicio rápido solo
   requiere estos dos campos; todo lo demás toma valores
   predeterminados. Después puedes elegir "Empezar directamente" o,
   de forma opcional, configurar tu perfil con más detalle en el
   asistente. Consulta [Onboarding](onboarding.md).
3. **Inicia tu primera lección** - la vía más rápida sin clave de
   IA: abre el
   [explorador de contenido](../features/content-browser.md) en
   `/content`, elige un conjunto de lecciones e inicia una
   lección. Lees una breve teoría y haces ejercicios; al final ves
   tu resultado con estrellas. Consulta
   [Lecciones y repasos](lessons.md).
4. **Opcional: sesiones de IA.** Si en cambio prefieres la
   conversación de aprendizaje guiada de seis métodos, guarda una
   **clave de API** (Ajustes o
   `~/.config/adaptive-learner/secrets.yaml`), haz la
   [prueba de tipo de aprendizaje](assessment.md) opcional e
   inicia una [sesión de aprendizaje](learning-session.md).
5. **Asegura tu resultado.** Desde el resumen de la lección puedes
   copiar el resultado como Markdown o guardarlo como archivo, y
   crear una [copia de seguridad](../features/backup.md) en
   **Ajustes → Datos**.

## Cómo continuar

- [Lecciones y repasos](lessons.md) - el flujo de la lección en detalle
- [Explorador de contenido](../features/content-browser.md) - encontrar y filtrar lecciones
- [Varios repositorios de contenido](../features/content-repos.md) - conectar tus propios orígenes de contenido
- [Copia de seguridad y restauración](../features/backup.md)
- [Entender tu Dashboard](dashboard.md) - progreso, racha, XP, insignias
- [FAQ - preguntas frecuentes](faq.md)
- [La idea pedagógica detrás de la app](../concept/philosophy.md)
