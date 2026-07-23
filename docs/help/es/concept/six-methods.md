# Los seis métodos de aprendizaje

Cada método tiene una postura, una fortaleza, una debilidad y un
estilo característico que adopta la IA durante las sesiones. La
matriz de prompts de 42 celdas (6 métodos × 7 pasos) implementa
estas posturas por cada paso del ciclo.

## Deductivo

**Postura**: la teoría primero. Enunciar la regla completamente,
luego demostrar con ejemplos, luego pedir al aprendiz que la aplique.

**Fortaleza cuando**: el tema tiene reglas claras y enunciables
(gramática formal, demostraciones matemáticas, sistemas de tipos).
El aprendiz ya acepta que las reglas gobiernan el dominio y quiere
internalizarlas de manera eficiente.

**Debilidad cuando**: las reglas son difusas, discutidas o
dependientes del contexto. La enseñanza puramente deductiva del
«buen gusto» o la «claridad» resulta plana: el aprendiz necesita
ver muchos ejemplos antes de que el patrón implícito cristalice.

**Estilo de la IA**: precisa, estructurada, completa. Enuncia la
regla en lenguaje llano, demuestra con ejemplos trabajados
prototípicos y luego pide al aprendiz que resuelva un caso nuevo.

## Inductivo

**Postura**: ejemplos primero. Mostrar tres o cuatro ejemplos
cuidadosamente elegidos del mismo fenómeno y dejar que el aprendiz
derive la regla por sí mismo. Revelar la regla solo después de que
el aprendiz haya formulado una hipótesis.

**Fortaleza cuando**: el reconocimiento de patrones es exactamente
la habilidad cognitiva que el aprendiz necesita desarrollar. El
aprendizaje de idiomas, la teoría musical, las tácticas de ajedrez
y la intuición en aprendizaje automático se benefician todos de la
práctica inductiva.

**Debilidad cuando**: la velocidad importa. El camino inductivo es
más lento que el deductivo cuando la regla es simple e inequívoca.
«Libera siempre la memoria» no necesita tres ejemplos; simplemente
se enuncia.

**Estilo de la IA**: presenta ejemplos en paralelo, se abstiene de
explicar y pregunta «¿qué patrón ves?» o «¿cuál es el siguiente
elemento de esta serie?».

## Basado en errores

**Postura**: provocar errores y luego aprender de ellos. Plantear
tareas diseñadas específicamente para llevar al aprendiz a las
trampas clásicas del tema y luego explicar *por qué* la trampa
es tan tentadora.

**Fortaleza cuando**: el tema tiene trampas bien conocidas
(concordancia sujeto-verbo en oraciones largas, errores de índice
en bucles, falacias comunes en la argumentación). El aprendiz se
beneficia de sentir el tirón de la trampa antes de comprender el
mecanismo correctivo.

**Debilidad cuando**: el aprendiz es frágil, está ansioso o es
principiante. La «frustración productiva» puede derivar en «soy
malo en esto» sin un encuadre cuidadoso. El prompt de la IA para
el paso 3 (Error) en este método dice explícitamente «diagnostica
con precisión sin amortiguadores»: es una elección pedagógica, no
un defecto de personalidad.

**Estilo de la IA**: confrontacional respecto al error y luego
profundamente explicativo sobre su mecanismo. «Esa es la trampa
clásica X: caíste en ella porque Y. He aquí por qué es tan
tentadora.»

## Dialógico

**Postura**: intercambio conversacional sin presión. Enmarcar las
tareas como invitaciones, no como pruebas. Afirmar explícitamente
lo que está bien antes de hacer correcciones. Dejar que el aprendiz
codirigea.

**Fortaleza cuando**: el aprendiz tiene ansiedad, confianza frágil
o ha chocado contra un muro. El tono relajado devuelve la agencia.
También funciona bien cuando el tema en sí es conversacional
(retórica, debate, habilidades de presentación).

**Debilidad cuando**: el aprendiz quiere instrucción directa y se
frustra con el encuadre de «¿quieres intentarlo?». Algunos aprendices
leen los prompts dialógicos como evasivos.

**Estilo de la IA**: cálida, curiosa, baja densidad. Pregunta
«¿qué te llevó a eso?» antes de corregir. Afirma explícitamente
la corrección parcial. Sugiere cambios de ritmo o de enfoque.

## Contextual

**Postura**: escenarios del mundo real primero. Plantear una
situación concreta donde el tema se necesita de inmediato; la
teoría llega solo después de que el aprendiz ha intentado actuar
en el escenario.

**Fortaleza cuando**: el tema es aplicado o específico de un dominio
(comunicación empresarial, razonamiento clínico, compensaciones de
ingeniería). El aprendiz necesita sentir la presión situacional para
comprender qué variable teórica importa realmente.

**Debilidad cuando**: el tema es genuinamente abstracto (teoría de
conjuntos, lógica formal, teoría musical en abstracto). Forzar un
escenario hace que la lección se sienta forzada.

**Estilo de la IA**: establece la escena. «Estás en la puerta de
una reunión con el cliente y te preguntan…». Pide la siguiente
acción concreta del aprendiz. Muestra las consecuencias dentro
del escenario.

## Adaptativo con IA

**Postura**: la IA elige por turno. Lee el perfil y el historial
de la sesión; selecciona cuál de los otros cinco métodos encaja
*en este intercambio*. Justifica la elección en una oración.

**Fortaleza cuando**: el aprendiz tiene un perfil equilibrado (sin
método dominante) o está en una sesión donde varios métodos podrían
funcionar. También es útil para aprendices avanzados que pueden
articular cuándo un método no está funcionando.

**Debilidad cuando**: el aprendiz quiere un estilo de enseñanza
estable y predecible. El cambio constante de método puede sentirse
errático si no se justifica bien por turno.

**Estilo de la IA**: metaconsciente. Nombra el método que está
eligiendo («Déjame intentarlo inductivamente...»), ejecuta ese
método fielmente y cambia cuando la señal indica que no está
funcionando.

## Cómo implementa la aplicación cada uno

Los seis métodos no son solo etiquetas. Cada uno impulsa una
personalidad de IA distinta a través de la **matriz de prompts de
42 celdas** en `plugins/.../session/prompts.py`: un prompt por par
(método, paso), seis métodos × siete pasos. Un prompt de Entrada
deductivo abre con la regla y pide ejemplos; un prompt de Entrada
contextual abre con un escenario real y pregunta cómo lo abordaría
el aprendiz. Mismo paso, textura completamente diferente.

La matriz se exporta íntegramente a
`frontend/src/data/session-prompts.json` para la paridad en el
modo Dexie: no es posible que haya divergencia entre los modos
Servidor y Local.

## Cómo elegir entre ellos

Tu evaluación te da un perfil de 6 métodos. El método dominante es
con el que comienzan las nuevas sesiones. Pero:

- El **evaluador de pasos** (dual-prompt) puede sugerir
  quedarse, avanzar o —raramente— retroceder en cada paso del
  ciclo.
- El **heurístico de cambio de método** detecta el estancamiento
  (tres sesiones de comprensión plana + estrés alto) y muestra un
  banner de «¿quieres probar [otro método]?» en ambos modos de
  almacenamiento.
- Puedes **elegir manualmente** un método en el botón de inicio
  de la página de Sesión. Útil cuando sabes que el tema requiere
  un método específico.

Cambiar de método es el objetivo, no la lealtad al método. Un
aprendiz que ha usado cinco de los seis métodos a lo largo de su
historial en Adaptive Learner tiene un repertorio mental más rico
que alguien que está bloqueado en el deductivo para siempre.
