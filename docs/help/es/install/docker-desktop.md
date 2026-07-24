# Instalar Docker Desktop

Adaptive Learner se ejecuta como un pequeño grupo de contenedores en tu
propio equipo. El lanzador de escritorio inicia y detiene esos
contenedores por ti, pero primero necesita que **Docker** esté
instalado y en ejecución. Esta guía te acompaña en la instalación de
Docker Desktop.

## Qué necesitas

- Alrededor de 800 MB de descarga para el propio Docker Desktop.
- Alrededor de 2 GB de disco para la imagen de Adaptive Learner en el
  primer inicio (esto ocurre una sola vez; los inicios posteriores son
  rápidos).
- Unos pocos minutos para la primera compilación (5-10 minutos es
  normal).

## Instalación

1. Abre la página oficial de descarga de Docker Desktop:
   [docs.docker.com/desktop](https://docs.docker.com/desktop/).
2. Descarga el instalador para tu sistema operativo (Windows, macOS o
   Linux).
3. Ejecuta el instalador y sigue las indicaciones. Acepta los valores
   predeterminados salvo que tengas un motivo para cambiarlos.
4. Inicia Docker Desktop y espera hasta que su icono de la ballena
   muestre "Docker Desktop is running".

## Iniciar el lanzador

Una vez que Docker Desktop esté en ejecución, vuelve a iniciar el
lanzador de Adaptive Learner. Primero comprueba Docker, luego descarga,
compila e inicia la app y, por último, ofrece un botón "Abrir en el
navegador".

Si Docker aún no está en ejecución cuando inicias el lanzador, este
muestra un aviso con un botón "Iniciar Docker" para que puedas
arrancarlo sin salir del lanzador.

## ¿Es seguro instalar Docker?

Sí. Docker Desktop está desarrollado por Docker, Inc., una empresa muy
conocida, y lo usan millones de desarrolladores en todo el mundo. Es la
forma estándar de ejecutar aplicaciones en contenedores en un ordenador
personal.

Adaptive Learner usa Docker únicamente para ejecutar sus propios
contenedores en tu equipo. Tus datos de aprendizaje permanecen locales;
al instalar Docker no se envía nada sobre tus datos a Docker, Inc.
Puedes desinstalar Docker Desktop en cualquier momento desde tu sistema
operativo, igual que cualquier otra aplicación.

## Solución de problemas

- **El lanzador dice que Docker no está en ejecución.** Inicia Docker
  Desktop, espera al estado "running" y luego haz clic en "Reintentar".
- **El puerto ya está en uso.** El lanzador lo detecta y ofrece un
  puerto alternativo; acepta la sugerencia.
- **Algo más salió mal.** Vuelve a ejecutar el lanzador con el flag
  `--debug` y comparte el archivo `launcher-debug.log` generado:

  ```bash
  python3 -m adaptive_learner_launcher --debug
  ```
