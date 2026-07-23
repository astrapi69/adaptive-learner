# El ciclo de siete pasos

Cada sesión recorre un ciclo de aprendizaje de 7 pasos. Los pasos
provienen de la serie de artículos *Von Theorie zur Praxis* y
reflejan el arco cognitivo real de adquirir una nueva habilidad.

## El arco

| # | Paso | Lo que ocurre cognitivamente |
|---|------|------------------------------|
| 1 | Entrada | Encontrarse con material nuevo por primera vez |
| 2 | Intento | Intentar aplicarlo |
| 3 | Error | Darse cuenta de que la aplicación falló |
| 4 | Retroalimentación | Procesar por qué ocurrió el error |
| 5 | Adaptación | Ajustar el modelo mental |
| 6 | Repetición | Practicar con el modelo ajustado |
| 7 | Integración | Conectar con el contexto más amplio |

## Por qué este orden

No es solo conveniente: cada paso depende del anterior.

- **Entrada → Intento** no es trivial. Muchos aprendices se saltan
  el Intento y pasan directamente de la entrada al «lo intentaré
  más tarde». Ese retraso erosiona el recuerdo. El paso 2 fuerza
  la aplicación inmediata.
- **Intento → Error** es la fricción productiva. El error es
  *información*. Una sesión de aprendizaje que evita los errores
  dándote solo preguntas fáciles no te dice nada sobre tu
  comprensión.
- **Error → Retroalimentación** es donde ocurre el aprendizaje
  más profundo. El mismo error explicado inmediatamente, con
  referencia a tu intento específico, cala; el mismo error
  explicado una hora después desde un libro de texto no.
- **Retroalimentación → Adaptación** es interna. La IA no puede
  ver que este paso ocurre; lo haces en tu cabeza. El prompt de la
  IA en el paso 5 te invita deliberadamente a articular qué has
  cambiado en tu enfoque.
- **Adaptación → Repetición** verifica la adaptación. La nueva
  tarea de práctica usa el mismo principio con una forma
  ligeramente diferente, de modo que la adaptación tiene que
  generalizarse.
- **Repetición → Integración** eleva la habilidad fuera de la
  práctica aislada y la conecta con otras cosas que sabes. Esto
  es lo que hace que el aprendizaje sea duradero.

## Qué ocurre si te saltas un paso

Cada paso omitido tiene un coste:

- **Saltarse la Entrada**: intentas aplicar algo que nunca has visto
  explicado. Generalmente se siente como agitarse sin rumbo.
- **Saltarse el Intento**: lees la regla y asumes que la entiendes.
  Meses después descubrirás que no.
- **Saltarse el Error**: nunca produces un error que la IA pueda
  diagnosticar. El aprendizaje se reduce a un goteo.
- **Saltarse la Retroalimentación**: cometiste un error pero no
  procesaste la explicación. En la siguiente sesión cometerás el
  mismo error.
- **Saltarse la Adaptación**: asentiste ante la retroalimentación
  pero en realidad no cambiaste tu modelo mental. El siguiente
  Intento lo revelará.
- **Saltarse la Repetición**: te adaptaste una vez pero no
  verificaste que la adaptación se generaliza. La habilidad no
  se transferirá a una forma superficial diferente.
- **Saltarse la Integración**: la habilidad permanece en un silo.
  Puedes aplicarla en ejercicios de práctica pero no en una
  situación real.

El evaluador de IA de doble prompt observa tus intercambios y puede
sugerir quedarse en el paso actual cuando te has saltado un momento
cognitivo. Por eso existen las sugerencias de «quedarse»: no son
la IA siendo molesta.

## Cómo decide la IA

Después de cada mensaje de `usuario` + respuesta de la IA, se
dispara una segunda llamada a la IA con este prompt de sistema
(parafraseado):

> Lee el intercambio. ¿Ha terminado el aprendiz el paso actual del
> ciclo? Emite JSON: `{advance, confidence, reason, suggested_step}`.

El esquema aplica un único objeto JSON; si la IA devuelve texto
no parseable, se aplica un avance determinista de +1 (limitado al
paso 7).

El `suggested_step` puede ser:

- `actual + 1` — avance normal (el más común).
- `actual` — quedarse; el aprendiz necesita más tiempo aquí.
- Un salto hacia adelante (p. ej., 1 → 3) — el aprendiz ya
  comprende la entrada.
- Un paso hacia atrás (p. ej., 4 → 2) — el aprendiz está
  confundido y necesita volver a intentarlo.

La ruta aplica la sugerencia solo cuando
`confidence >= 0.6` (el `step_evaluation.confidence_threshold`
predeterminado en `app.yaml`). Los veredictos de reserva siempre
aplican el avance de +1.

## Por qué doble prompt en lugar de uno solo

La misma llamada de IA podría emitir tanto la respuesta de
aprendizaje como el veredicto del paso. No lo hacemos porque:

1. **Separación de responsabilidades** — el prompt de aprendizaje
   se compone por (método, paso). El prompt del evaluador es
   consciente del método pero agnóstico al paso.
2. **Presupuestos de tokens** — la respuesta de aprendizaje se
   beneficia de 1024 tokens; el veredicto necesita solo 256.
3. **Robustez del parsing de JSON** — pedirle a la IA que produzca
   prosa Y una cola JSON en una sola respuesta es frágil. Se
   pregunta dos veces, se parsea con limpieza.
4. **Reproducibilidad** — cuando algo sale mal, tenemos las dos
   respuestas registradas por separado y podemos auditarlas.

El coste son dos llamadas a la API por turno. A precios del nivel
económico (claude-haiku, gpt-4o-mini, gemini-flash) eso es una
fracción de céntimo por intercambio.

## Indicador de progreso del ciclo

La página de Sesión muestra una tira de 7 círculos en la parte
superior. Relleno = hecho; el círculo del paso actual está en el
color de acento del proyecto y pulsa sutilmente mientras la IA
está pensando. En las transiciones de paso (hacia adelante o hacia
atrás), la tira se anima para que el ciclo se sienta vivo.

En móvil (≤768px) la tira se convierte en una única fila
horizontal de pequeños círculos para ahorrar espacio vertical.
Deslizar sobre la tira muestra una superposición informativa que
describe el paso anterior / siguiente del ciclo.

## Auto-bucle + transiciones de tema

El paso 7 ya no es un callejón sin salida. Una vez que el
evaluador de pasos te mueve al paso 7 con `advance=true`, una
tercera llamada a la IA — el evaluador de transición de tema —
juzga si el tema ha sido integrado y si iniciar un nuevo ciclo.

```
       paso 1..7 (ciclo normal)
                ↓
         paso 7 alcanzado
                ↓
   llamada IA de transición de tema:
       ¿integrado?  ¿continuar_recomendado?
                ↓                    ↓
              sí ∧ sí             si no
                ↓                    ↓
   cycle_step ← 1           cycle_step permanece en 7
   cycle_count += 1         (sesión lista para terminar)
   cycle_topics ← [..., resumen]
   nuevo subtema elegido
```

El límite máximo de `max_cycles=5` por sesión previene bucles
sin fin. Un respaldo determinista mantiene el comportamiento del
límite en el paso 7 ante cualquier fallo de la IA o
del parsing.

El chat renderiza las transiciones de ciclo como tarjetas con
borde discontinuo «Ciclo N» en el historial de la sesión. El
diálogo de calificación resume el viaje de varios ciclos cuando
`cycle_count > 1`.

## Evaluación paralela en el límite de ciclo

En la transición del paso 6 → 7, tanto el evaluador de pasos como
el evaluador de transición de tema se disparan concurrentemente
mediante `asyncio.gather` (`async_evaluation: true` en `app.yaml`).
Esto ahorra ~T₂ de latencia en el límite del ciclo.

La respuesta del mensaje incluye un bloque `timings` con
`learning_ms` / `evaluation_ms` / `topic_transition_ms` /
`total_ms` / `parallel_saved_ms`.
