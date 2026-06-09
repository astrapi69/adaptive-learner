# Novedades (v1.61 – v1.69)

Una visión general orientada al usuario de las versiones desde
v1.61.0. Las notas técnicas completas por versión están en
[GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases).

---

## v1.69.0 — Enlaces de ejemplo + recomendaciones de libros

- **Enlaces de ejemplo en la teoría:** un paso de teoría puede
  llevar un enlace opcional "Ver ejemplo".
- **Recomendaciones de libros por dominio** en el explorador de
  contenido
  ([Recomendaciones de libros](content-creation/books.md)).
- **Atajo Enter también en la repetición de errores** ("Repetir
  errores").
- **Corrección de copia de seguridad:** el título del conjunto se
  lee correctamente del manifiesto al restaurar.

## v1.68.0 — Exportar resultados + retroenlaces de teoría

- **Exportar el resultado de la lección:** "Copiar resultado" /
  "Guardar como archivo" (informe Markdown para asistentes de IA).
- **Retroenlaces de teoría:** saltar de un ejercicio a la teoría
  correspondiente y volver.
- **Ejercicio de asociación rediseñado:** parejas con color +
  insignias numéricas (seguro para daltónicos).
- **Contraste en modo oscuro** corregido en varios lugares.

## v1.67.1 — Restauración de copias + estabilidad de despliegue

- Corrección sistemática de la **restauración de copias de
  seguridad**.
- Recarga automática ante un chunk de despliegue obsoleto.
- Pulido del filtro de Subject (oculto con ≤ 1 Subject, más usados
  primero).

## v1.65.0 — Evaluación reanudable + atajo Enter

- **Evaluación reanudable:** interrumpir la prueba y continuar más
  tarde donde lo dejaste.
- **Atajo Enter:** Enter comprueba un ejercicio respondido y avanza
  (conmutable en Ajustes → Aprendizaje).
- Ejercicios de asociación más claros + revisión de tokens de
  diseño.

## v1.64.0 — Rediseño del onboarding

- **Inicio rápido con solo nombre + tema**; el resto toma valores
  predeterminados.
- **Asistente de onboarding** opcional (una pregunta por
  pantalla).
- La **evaluación ahora es opcional**
  ([Onboarding](user-guide/onboarding.md)).

## v1.63.0 — Presets de temas WCAG AA

- **6 temas recomendados** (Catppuccin Latte/Mocha, Supabase,
  Graphite, Soft Pop, Amethyst Haze), conformes con AA de forma
  computacional ([Sistema de temas](developer/themes.md)).
- Auditoría sistemática de i18n; filtro del Dashboard
  personalizado.

## v1.62.0 — Integridad de copias + procedencia de la build

- Endurecimiento de la **restauración de copias de seguridad**
  (coerción de tipos de datos, orden de claves foráneas).
- About muestra información real de la build en lugar de
  "unknown".

## v1.61.0 — Conformidad de botones + reanudar lección

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
- [GitHub Releases](https://github.com/astrapi69/adaptive-learner/releases) — notas completas
