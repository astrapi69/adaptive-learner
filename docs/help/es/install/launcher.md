# Iniciar el lanzador de escritorio

!!! tip "La mayoría de los usuarios no necesitan el lanzador"
    Adaptive Learner se ejecuta directamente en el navegador, sin
    instalación, sin Docker, sin lanzador:
    **[astrapi69.github.io/adaptive-learner](https://astrapi69.github.io/adaptive-learner/)**.
    El lanzador de escritorio solo es para ti si quieres alojar la app
    por tu cuenta o ejecutar funciones de backend (modo servidor,
    sincronización local) de forma local.

El lanzador de escritorio es la forma más sencilla de ejecutar Adaptive
Learner **con su propio backend** en tu equipo. Es una pequeña ventana
que se encarga de todo lo demás por ti: comprueba que Docker está en
ejecución, descarga y compila la imagen de la app en el primer inicio
(una sola vez, 5-10 minutos es normal), arranca los contenedores y luego
abre la app en tu navegador en `http://localhost:8501`. Desde la misma
ventana también puedes detener la app, cambiar el puerto o desinstalarlo
todo.

El puerto es **8501** de forma predeterminada y se puede cambiar en la
ventana del lanzador; si está ocupado, el lanzador recurre a un puerto
libre.

## Quién puede acceder a la aplicación

De forma predeterminada, la aplicación solo es accesible **desde este
ordenador** (`127.0.0.1`). Es intencionado: no tiene inicio de sesión y
guarda tus claves de proveedores de IA. Si estuviera visible en la red,
cualquier dispositivo de esa misma red - una LAN de oficina, el wifi de
un hotel o de un congreso - podría abrirla y usarla sin más.

Acceder desde otro dispositivo, por ejemplo desde el móvil en tu propia
wifi, sigue siendo posible, pero es una decisión consciente: define
`ADAPTIVE_LEARNER_BIND_ADDRESS=0.0.0.0` en el archivo `.env`. Hazlo solo
en una red de confianza y ten presente que entonces todos los que estén
en ella tendrán el mismo acceso que tú.

## Requisito previo: Docker - el lanzador lo comprueba por sí mismo

El lanzador requiere un Docker en ejecución, porque la propia app se
ejecuta como un grupo de contenedores. **No** necesitas verificar nada
manualmente: al iniciarse, el lanzador comprueba por sí mismo si Docker
está instalado y en ejecución, también encuentra un Docker que se
ejecuta bajo un contexto de Docker distinto (como Docker Desktop para
Linux o Docker sin privilegios de root) y muestra un mensaje claro con
una solución cuando falta algo. Si Docker todavía no está instalado en
absoluto: [Instalar Docker Desktop](docker-desktop.md).

Los mensajes del lanzador y lo que significan:

| Mensaje | Significado | Solución |
|---------|-------------|----------|
| "Docker no está instalado (docker no está en el PATH)." | No se encontró el comando `docker`. | [Instalar Docker Desktop](docker-desktop.md). El lanzador muestra el enlace de instalación directamente. |
| "Docker está instalado pero no iniciado." o "Docker no está en ejecución. Contexto comprobado '...' (...): ..." | El servicio de Docker no está en ejecución en este momento; la forma detallada nombra el contexto probado, el socket y el error original de Docker. | Haz clic en el botón **"Iniciar Docker"** del lanzador (Linux) o abre Docker Desktop (macOS/Windows), luego **"Reintentar"**. |
| "Docker está instalado, pero no tienes permiso." | Tu usuario no está en el grupo `docker` (Linux). | El lanzador muestra el comando exacto; después cierra sesión y vuelve a iniciarla. |
| "Docker no responde." | Lo más probable es que Docker aún se esté iniciando (típico justo después de abrir Docker Desktop). | Espera un momento y luego **"Reintentar"**. |
| "Docker se ejecuta mediante el contexto '...' - el contexto activo no era accesible, el lanzador se conectó automáticamente." | Solo informativo: Docker se ejecutaba bajo un contexto distinto, el lanzador lo encontró y lo usa. | Nada que hacer. |
| "Docker Desktop está instalado pero no en el PATH." | La app de Docker Desktop está presente, pero su herramienta de línea de comandos (todavía) no es accesible. | Inicia Docker Desktop mediante el botón del lanzador y espera un momento. |

La detección de contextos con mensajes detallados se incluye a partir de
la versión del lanzador posterior a docker-app-launcher#26; las
versiones anteriores muestran los mensajes más cortos de la misma tabla.

## Descarga

Los tres lanzadores se publican con cada versión en
[github.com/astrapi69/adaptive-learner/releases](https://github.com/astrapi69/adaptive-learner/releases):

| Plataforma | Archivo | Suma de comprobación |
|------------|---------|----------------------|
| Linux | `adaptive-learner-launcher` | `adaptive-learner-launcher.sha256` |
| macOS | `adaptive-learner-launcher-macos.zip` | `adaptive-learner-launcher-macos.zip.sha256` |
| Windows | `adaptive-learner-launcher.exe` | `adaptive-learner-launcher.exe.sha256` |

### Qué está verificado y qué no

Cada uno de estos programas se inicia una vez durante su construcción,
exactamente en el sistema operativo al que está destinado. Con ello queda
comprobado que arranca: en Linux, en Windows y en macOS con Apple
Silicon. La imagen de la aplicación se verifica en cada versión: una
descarga anónima (sin inicio de sesión) y un arranque real con
comprobación de salud, por separado para ambos tipos de procesador
(Intel/AMD y ARM), en máquinas de ese tipo. Lo que aún no se ha medido
es la descarga desde el registro en motores Docker muy antiguos (de la
era 20.10); la propia cadena del motor está comprobada en un motor así
contra otro registro, y la medición contra el registro de GitHub se
sigue upstream.

Lo que no está comprobado es cómo reacciona tu sistema operativo ante un
archivo **descargado**: los programas no llevan una firma de pago, así
que macOS avisa al abrirlos por primera vez ("desarrollador no
identificado") y Windows muestra el aviso de SmartScreen. Es una
advertencia, no un defecto; cómo confirmarla una sola vez está más abajo
en [macOS](#macos) y [Windows](#windows). Verifica antes la suma de
comprobación: es una prueba más fiable que cualquier diálogo.

## Linux

1. Verifica la suma de comprobación (ambos archivos en la misma
   carpeta):

    ```bash
    sha256sum -c adaptive-learner-launcher.sha256
    ```

2. Asigna el permiso de ejecución. La descarga desde el navegador
   siempre se lo quita al binario, así que este paso es **siempre**
   necesario:

    ```bash
    chmod +x adaptive-learner-launcher
    ```

3. Inícialo, lo más fácil desde el terminal:

    ```bash
    ./adaptive-learner-launcher
    ```

    El doble clic en el gestor de archivos también puede funcionar,
    según tu entorno; GNOME/Nautilus requiere "Permitir la ejecución del
    archivo como programa" en Propiedades > Permisos. Iniciarlo desde el
    terminal tiene la ventaja de que ves los mensajes de error
    directamente.

Errores frecuentes:

- **"Permission denied"**: se omitió el paso 2 (`chmod +x`).
- **Error de GLIBC al iniciar**: el binario se compila en Ubuntu 22.04 y
  necesita glibc 2.35 o más reciente (Ubuntu 22.04+, Debian 12+,
  Fedora 36+). En distribuciones más antiguas, ejecuta la app mediante
  `install.sh` o directamente con Docker Compose.
- **La app no es accesible en el navegador**: si el navegador no se abre
  automáticamente, abre `http://localhost:8501` manualmente (o el puerto
  que se muestre en la ventana del lanzador). Ten en cuenta que la app se
  publica en todas las interfaces de red, no solo en `localhost`, y no
  tiene autenticación: manten ese puerto cerrado en el cortafuegos salvo
  que quieras deliberadamente que otros dispositivos de tu red lleguen a
  ella.

## macOS

1. Verifica la suma de comprobación y descomprime el ZIP:

    ```bash
    shasum -a 256 -c adaptive-learner-launcher-macos.zip.sha256
    unzip adaptive-learner-launcher-macos.zip
    ```

2. Al abrirlo por primera vez, **macOS bloquea el programa**. Según la
   versión de macOS, el diálogo solo ofrece "Mover a la papelera" y
   "Listo", sin botón de abrir. No es un error ni un defecto del
   programa: Adaptive Learner **no está certificado por Apple**, lo que
   exige una cuenta de desarrollador de pago.

   Cómo abrirlo de todos modos:

    1. Cierra el diálogo con **Listo** (no lo muevas a la papelera).
    2. Abre **Ajustes del Sistema > Privacidad y seguridad** y baja del
       todo.
    3. Allí aparece el aviso de que el programa fue bloqueado, con el
       botón **Abrir igualmente**. Púlsalo y confirma en el siguiente
       diálogo.

   A partir de ahí se abrirá sin preguntar.

   En este caso, la suma de comprobación del paso 1 es tu verdadera
   garantía: el sistema no puede confirmarte de dónde viene el archivo;
   una suma que coincide, sí.

## Windows

1. Verifica la suma de comprobación (PowerShell, ambos archivos en la
   misma carpeta):

    ```powershell
    Get-FileHash .\adaptive-learner-launcher.exe -Algorithm SHA256
    Get-Content .\adaptive-learner-launcher.exe.sha256
    ```

    Los dos valores de hash deben coincidir.

2. Haz doble clic en `adaptive-learner-launcher.exe`. En el primer
   inicio, SmartScreen advierte ("Windows protegió su PC"): haz clic en
   **Más información** y luego en **Ejecutar de todas formas**.

## Si algo sale mal

- El propio lanzador muestra un diálogo de aviso cuando Docker no está
  en ejecución y ofrece iniciar Docker Desktop.
- El primer inicio descarga y compila la imagen de la app; la lista de
  pasos en la ventana del lanzador (Check Docker / Download / Build /
  Start / Ready) muestra el progreso. Los inicios posteriores son
  rápidos.
- Mientras la app está en ejecución, siempre puedes acceder a ella en
  `http://localhost:8501` (o el puerto que hayas cambiado); el botón
  "Abrir en el navegador" del lanzador hace lo mismo.
