# Cambiar el puerto (y conservar tus datos)

El lanzador de escritorio te permite cambiar el puerto en el que se
ejecuta Adaptive Learner (por defecto es **8501**). Esto es útil cuando
otra app ya usa ese puerto - pero hay una consecuencia que conviene
conocer antes de hacerlo.

## Por qué el puerto importa para tus datos

El almacenamiento de una app web está ligado a su dirección web exacta,
incluido el puerto. `http://localhost:8501` y `http://localhost:8502`
son dos direcciones **diferentes** para tu navegador, y cada una tiene
su propio almacenamiento separado.

Lo que esto significa en la práctica depende de cómo ejecutes Adaptive
Learner:

- **Modo servidor** (el predeterminado del lanzador de escritorio). Tus
  conjuntos, lecciones y progreso residen en el backend propio de la
  app, no en el navegador. **No** se ven afectados por un cambio de
  puerto - la app los vuelve a encontrar automáticamente en la nueva
  dirección.
- **Modo de almacenamiento del navegador** (la opción que puedes activar
  en *Ajustes > General > Modo de almacenamiento*, y el modo que usa la
  versión web pública). Tus
  conjuntos, tu progreso y los ejercicios creados por ti residen **en
  el navegador**, ligados a la dirección actual. Tras un cambio de
  puerto, la app se abre en la nueva dirección con el almacenamiento
  del navegador vacío, así que parece un comienzo desde cero. **Tus
  datos no se borran** - siguen guardados con el puerto anterior, solo
  que no son visibles en el nuevo.

## Llevar tus datos al nuevo puerto

Si usas el modo de almacenamiento del navegador y ya has cambiado el
puerto, tus datos te esperan en la dirección antigua. Tráelos con una
copia de seguridad:

1. Vuelve **al puerto anterior** (por ejemplo
   `http://localhost:8501`). Tus datos aparecen de nuevo.
2. Abre **Ajustes > Datos > Crear copia de seguridad** y guarda el
   archivo `.alb`.
3. Cambia al **nuevo puerto**.
4. En la pantalla de bienvenida elige **Restaurar desde una copia de seguridad existente** y selecciona el archivo `.alb`. Todo - conjuntos,
   progreso, ejercicios y tus ajustes - se restaura.

Consulta [Copia de seguridad y restauración](../features/backup.md)
para saber más sobre las copias de seguridad.

## Evita la sorpresa: haz primero una copia de seguridad

El hábito más seguro es **exportar una copia de seguridad antes de
cambiar el puerto**, para poder restaurarla en la nueva dirección si
falta algo. Una copia de seguridad periódica es un buen seguro en
general - también te permite trasladar tu aprendizaje entre
dispositivos.

## Cambiar el puerto no abre la app a la red

Elijas el puerto que elijas, la app sigue escuchando solo en
`127.0.0.1` - accesible desde este ordenador, no desde otros
dispositivos. No tiene inicio de sesión, así que acceder a ella desde
tu teléfono u otra máquina es un paso aparte y deliberado
(`ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0`), y solo tiene sentido en una
red de confianza - consulta
[Iniciar el lanzador de escritorio](launcher.md) ("Quién puede acceder
a la aplicación").
