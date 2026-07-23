# Progreso

La página de Progreso es la vista detallada de tus datos de
aprendizaje: todo lo que el Panel principal resume, con gráficos
y tablas para profundizar.

## Lo que ves

Cuatro secciones, de arriba a abajo:

1. **Perspectivas de tendencia** — comprensión media, estrés
   medio, minutos totales, días de racha. Los números que el
   Panel principal muestra en una ficha compacta aquí se
   convierten en filas etiquetadas.
2. **Distribución de métodos** — el mismo gráfico de barras
   horizontal que el Panel principal, con información sobre
   herramientas que muestra el recuento exacto de sesiones por
   método.
3. **Perspectivas de evaluación de pasos** — lee de las
   filas StepEvaluation que produce la ruta
   de sesión.
4. **Historial de commits** — cada fila ProgressCommit en orden
   cronológico, la más reciente primero.

## Perspectivas de evaluación de pasos

La arquitectura de doble prompt escribe una fila `StepEvaluation`
por cada turno de la IA con el veredicto del evaluador (advance,
confidence, suggested_step, fallback_used, reason). El agregador
de seguimiento los lee y produce cuatro números que vale la pena
examinar:

- **Total de evaluaciones** — cada turno de la IA produce una.
  Un proyecto de larga duración tendrá cientos.
- **Confianza media** — en todas las evaluaciones. Un promedio
  bajo (< 0,5) significa que la IA raramente está segura de que
  estás listo para avanzar, lo que generalmente es una señal de
  que el material es genuinamente difícil para ti. No es malo:
  es información.
- **Recuento de repeticiones** — con qué frecuencia el evaluador
  eligió mantenerte en el mismo paso. Las fases con muchas
  repeticiones son normales cuando el material es denso.
- **Recuento de reservas** — con qué frecuencia la salida JSON
  de la IA no se pudo parsear y se sustituyó por el avance
  determinista de +1. Números altos (> 10% de las evaluaciones)
  sugieren que la IA tiene dificultades con el formato de salida
  JSON; generalmente es un problema del modelo, no tuyo.

## Tiempo por paso

Un gráfico de barras que muestra el total de segundos gastados en
cada paso del ciclo a lo largo del proyecto. El agregador limita
los huecos de más de 2 horas (te alejaste de la pantalla: no es
tiempo de aprendizaje real) para que las sesiones nocturnas
individuales no dominen.

En qué paso pasas más tiempo dice mucho. Mucho tiempo en el paso
3 (Error) significa que el material tiene muchas trampas: quizás
eso es exactamente para lo que te apuntaste. Mucho tiempo en el
paso 1 (Entrada) significa que el material es denso y lees
despacio.

## Historial de commits

Cada fila es un ProgressCommit: método, calificación de
comprensión, calificación de estrés, duración en minutos, marca
de tiempo de committed_at, más la nota de sesión en texto
enriquecido renderizada en línea (TipTap de solo lectura). La
lista es ordenable por fecha o por comprensión.

Las notas renderizadas muestran negrita / cursiva / listas /
bloques de código con resaltado de sintaxis / enlaces: exactamente
lo que se escribió en el diálogo de calificación al final de la
sesión. Las notas de texto plano heredadas
pasan sin cambios.

## Exportaciones

Tres tipos de exportación mediante Ajustes → Exportar, todos
idénticos en forma en todos los modos de almacenamiento:

- **Informe de progreso** — la página completa de Progreso
  empaquetada en un documento Markdown o PDF.
- **Detalle de sesión** — la transcripción + calificación +
  evaluaciones de pasos de una sola sesión.
- **Resumen del plan de estudios** — el árbol de temas +
  resúmenes de lecciones para un solo plan de estudios.

El Markdown se genera en el cliente; el PDF usa la función de
impresión a PDF del navegador (abre un iframe oculto con una hoja
de estilo optimizada para imprimir, luego `contentWindow.print()`).
Sin biblioteca de PDF externa, sin viaje de ida y vuelta al
backend.

## Filtrado

Una barra de filtros simple te permite acotar por:

- **Método** — solo los commits que usan el deductivo (o
  cualquier otro).
- **Rango de fechas** — últimos 7 / 30 / 90 días, o todo el
  tiempo.

Los filtros se aplican en las cuatro secciones (perspectivas de
tendencia, distribución, agregados de evaluación de pasos,
historial).

## Recordatorio de privacidad

En el modo Local, la página de Progreso lee de IndexedDB y te
muestra lo que has persistido en este navegador. En el modo
Servidor lee de la base de datos SQLite del backend FastAPI. En
cualquier caso, nada de esto se envía nunca a un servicio externo
de análisis.
