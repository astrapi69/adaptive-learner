# El Panel principal

El Panel principal es tu base de operaciones. Reúne varias
secciones de datos en una vista: quién eres como aprendiz (perfil +
XP + insignias), cómo te va ahora mismo (mapa de calor de racha +
contador de sesiones), qué has estado haciendo (sesiones recientes +
distribución de métodos), y qué hacer a continuación (recomendaciones
de herramientas y espaciado).

En la parte superior se encuentra la **barra de filtros de
Asignaturas + Etiquetas**: elige una asignatura (p. ej., Idiomas →
Español) o una etiqueta para limitar todos los widgets de abajo a
los proyectos con esa clasificación. Los filtros se pueden compartir
mediante parámetros de consulta de URL.

## Radar de perfil

El gráfico radar en la parte superior muestra tu perfil de 6
métodos de la evaluación. Misma forma que el gráfico posterior a
la evaluación en la página de Evaluación. El método dominante se
resalta bajo el gráfico con un distintivo de color.

Si aún no has realizado la evaluación, el radar muestra una forma
en cero y enlaza a la página de Evaluación.

## XP + Racha + Insignias

- **Widget de XP** - nivel actual + XP total + una barra de
  progreso hasta el siguiente nivel. Los niveles siguen una curva
  exponencial (`threshold(n) = 50 * n * (n - 1)`); los niveles
  1-5 están a 0 / 100 / 300 / 600 / 1000 XP. 50 XP base por
  sesión terminada, más bonificaciones por ciclo + bonificación
  por primer método + multiplicador de racha (hasta 2,75× a los
  7 días de racha).
- **Mapa de calor de racha** (estilo GitHub) - 365 días de
  actividad en columnas semanales Lun..Dom. Cinco colores de
  nivel mediante `color-mix` en `var(--accent)`. Activa el modo
  fin de semana en Ajustes para omitir los huecos de sáb./dom.;
  la reserva de congelaciones (1 por cada 7 días de racha, máximo
  3) actúa como pausa-no-reinicio en un día de semana faltante.
- **Galería de insignias** - 24 insignias en 5 categorías
  (getting_started 3, consistency 4, method_explorer 7, depth 7,
  polyglot 3). Las obtenidas se iluminan con color y fecha; las
  bloqueadas permanecen grises.
- **Contador de sesiones** - fichas para sesiones, minutos, racha
  actual, comprensión media, estrés medio.

## Línea de tiempo de progreso

Un gráfico de dos líneas bajo el radar. Dos métricas por sesión:
tu calificación de **comprensión** y tu calificación de **estrés**,
ambas reescaladas de la entrada 1-5 a un eje 0-1. Se muestran las
cinco sesiones más recientes por defecto, ordenadas de la más
antigua (izquierda) a la más nueva (derecha).

Qué buscar: una línea de comprensión ascendente es exactamente lo
que quieres. Una línea de comprensión plana con estrés creciente
es exactamente la señal que el heurístico de cambio de método
vigila; te sugerirá cambiar de método.

## Distribución de métodos

Un gráfico de barras horizontal que muestra cuáles de los 6
métodos has estado usando. La longitud de cada barra es el
porcentaje de sesiones que usaron ese método. Las barras se
ordenan de mayor a menor; los empates mantienen el orden canónico
de métodos.

El objetivo de este gráfico no es la competición consigo mismo; es
un espejo. Algunos aprendices llevan el 80% de sesiones deductivas
y está bien. Otros descubren que nunca han usado el método
contextual y quieren probarlo.

## Sesiones recientes

Las últimas 5 sesiones como una lista compacta: distintivo de
método, la calificación de comprensión de la sesión (como una
pequeña barra) y la duración en minutos. Hacer clic en una fila
lleva a la página de Progreso filtrada a esa sesión, útil cuando
una sesión en particular se sintió muy bien o muy mal y quieres
ver qué ocurrió.

## Recomendaciones de herramientas y espaciado

Dos tarjetas de recomendación en el borde inferior:

- **Herramientas** - herramientas externas clasificadas adaptadas
  a tu perfil. Anki + NotebookLM son ahora de primera clase con
  exportaciones integradas (sin transferencia manual). Cada una
  muestra un «por qué» en una línea en tu idioma de interfaz.
- **Repetición espaciada** - tarjetas cortas de «haz esto a
  continuación» impulsadas por los métodos que no has practicado
  recientemente. Una política de cinco bandas (primera vez /
  refrescar / repasar / practicar / mantener) guía las sugerencias
  de intervalo.

Ambas listas se actualizan en cada carga del Panel principal: son
baratas de calcular y reflejan la última sesión.

## Iniciar sesión

El gran botón primario en la parte superior: «Iniciar sesión». Abre
la página de Sesión con una nueva fila de sesión creada, el método
activo elegido previamente de tu perfil y el ciclo en el paso 1.
