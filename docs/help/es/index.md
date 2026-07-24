# Adaptive Learner

**Aprende de la forma en que realmente aprendes.**

Adaptive Learner es una plataforma de aprendizaje adaptativo de código
abierto que te acompaña a lo largo del ciclo de aprendizaje de siete
pasos: desde la entrada inicial hasta la integración duradera del
conocimiento. La IA se adapta a ti, y no al revés.

[Comenzar ahora](user-guide/getting-started.md){ .md-button .md-button--primary }
[Ver en GitHub](https://github.com/astrapi69/adaptive-learner){ .md-button }

---

## ¿Por qué Adaptive Learner?

La mayoría de las herramientas de IA para el aprendizaje son chatbots
glorificados. Adaptive Learner es diferente: implementa seis métodos
de aprendizaje respaldados por investigación, hace un seguimiento de
tu progreso a nivel de elemento y adapta tanto el método como el
contenido a tu perfil.

- **Seis métodos de aprendizaje** - deductivo, inductivo, basado en
  errores, dialógico, contextual y adaptativo con IA.
- **Ciclo de siete pasos** - entrada → intento → error →
  retroalimentación → adaptación → repetición → integración.
- **Evaluador de doble prompt** - un segundo agente de IA mide tu
  comprensión y avanza el ciclo automáticamente.
- **Funciona sin conexión** - el modo Dexie almacena todo en el
  navegador; no necesitas servidor.

---

## Inicio rápido

1. **Crea un proyecto de aprendizaje** - tema, objetivo, plazo,
   minutos al día.
2. **Realiza la evaluación** - 12 preguntas te sitúan en el radar
   de seis métodos.
3. **Inicia una sesión** - la IA aplica tu método dominante.
4. **Valora la sesión** - comprensión, estrés, adecuación del método.
5. **Repasa** - el panel muestra qué repasar hoy.

---

## Documentación

### Guía de usuario

| | |
|---|---|
| [Primeros pasos](user-guide/getting-started.md) | Instalación, requisitos, inicio rápido |
| [Incorporación](user-guide/onboarding.md) | Primer proyecto y evaluación |
| [Panel principal](user-guide/dashboard.md) | Radar de perfil, XP, racha, widgets |
| [Sesión de aprendizaje](user-guide/learning-session.md) | El ciclo de siete pasos en acción |
| [Plan de estudios](user-guide/curriculum.md) | Árbol de temas, editor de lecciones |
| [Lecciones de contenido](user-guide/lessons.md) | Conjuntos de lecciones, tipos de ejercicios, SRS |
| [Progreso](user-guide/progress.md) | Historial de commits, perspectivas por paso |
| [Misiones](user-guide/missions.md) | Metas diarias, configuración, comodín de racha |
| [Mis lecciones](user-guide/my-lessons.md) | Crear, guardar, exportar e importar lecciones |
| [Celebraciones](user-guide/celebrations.md) | Retroalimentación por respuesta, intensidad |
| [Ajustes](user-guide/settings.md) | Proveedor de IA, claves API, tema, copia de seguridad |
| [Preguntas frecuentes](user-guide/faq.md) | Respuestas a las preguntas más comunes |

### Conceptos

| | |
|---|---|
| [Filosofía](concept/philosophy.md) | Por qué seis métodos y siete pasos |
| [Los seis métodos](concept/six-methods.md) | Deductivo, inductivo, basado en errores, dialógico, contextual, adaptativo |
| [Los siete pasos](concept/seven-steps.md) | El ciclo de aprendizaje en detalle |
| [Herramientas](concept/tools.md) | Repetición espaciada, recuperación activa, IA adaptativa |
| [Seguimiento](concept/tracking.md) | Commits de progreso, XP, insignias |

### Para desarrolladores

| | |
|---|---|
| [Arquitectura](developer/architecture.md) | 4 capas, almacenamiento dual, plugins |
| [Configuración](developer/setup.md) | Prerrequisitos, instalación, comandos |
| [Despliegue](developer/deployment.md) | Desarrollo local, GitHub Pages, Docker, launcher |
| [Guía de plugins](developer/plugin-guide.md) | Tutorial completo de creación de plugins |
| [Capa de almacenamiento](developer/storage-layer.md) | IStorageService, ApiStorage, DexieStorage |
| [Integración de IA](developer/ai-integration.md) | Hook ai_complete, doble prompt, streaming |
| [Internacionalización](developer/i18n.md) | Catálogos YAML, 8 idiomas, añadir uno nuevo |
| [Pruebas](developer/testing.md) | Pirámide de pruebas, pytest, Vitest, Playwright |
| [Versiones](developer/release.md) | SemVer, proceso de publicación, versiones de plugins |
| [Temas](developer/themes.md) | Sistema de seis temas, tokens, añadir un tema nuevo |
| [Creación de contenido](developer/authoring-content.md) | Esquema de lecciones, ejercicios, validación |
| [Lecciones y SRS](developer/lessons-and-srs.md) | Seguimiento de errores por elemento, bandas de SRS |
| [Misiones (dev)](developer/missions.md) | Arquitectura, catálogo de plantillas, flujo |
| [Celebraciones (dev)](developer/celebrations.md) | Capa de celebración, bus, cola |

### Referencia de la API

| | |
|---|---|
| [Vista general](api/overview.md) | URL base, autenticación, códigos de respuesta |
| [Endpoints del núcleo](api/core-endpoints.md) | Usuarios, proyectos, ajustes, currículum |
| [Endpoints de plugins](api/plugin-endpoints.md) | Evaluación, sesión, seguimiento, gamificación |
| [Especificaciones de hooks](api/hooks.md) | Los 10 hookspecs de PluginForge |
| [Modelos de datos](api/models.md) | 25 modelos SQLAlchemy y sus esquemas Pydantic |

---

## Estado

```
Almacenamiento : SQLite (ApiStorage) · IndexedDB (DexieStorage)
Idiomas UI     : DE · EN · ES · FR · EL · PT · TR · JA
Proveedores IA : Anthropic · OpenAI · Gemini (clave propia)
Licencia       : MIT
```
