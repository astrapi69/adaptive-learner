# Ajustes

La página de Ajustes recoge todo lo que puedes modificar sin tocar
código ni YAML. Secciones de arriba a abajo:

1. **Idioma** — idioma de la interfaz (DE / EN / ES / FR / EL /
   PT / TR / JA, todos completamente traducidos).
2. **Proveedor de IA + selector de modelo** — qué proveedor ve
   tus mensajes y qué modelo usar.
3. **Claves API** — claves por proveedor con atribución de origen
   (entorno / `secrets.yaml` / Ajustes).
4. **Modo de almacenamiento** — Servidor (FastAPI + SQLite) vs
   Local (IndexedDB del navegador).
5. **Sincronización** — emparejar este dispositivo con otro en la
   red local.
6. **Copia de seguridad** — exportar / importar / comparar.
7. **Voz** — alternadores de TTS + STT + pronunciación.
8. **Interfaz** — gestos + tema + densidad.
9. **Gamificación** — notificaciones de XP / insignias + modo fin
   de semana.
10. **Acerca de** — versión, información del sistema, créditos,
    donaciones, licencia.

## Idioma

Intercambia en vivo todas las cadenas de la interfaz en el
siguiente renderizado mediante `PATCH /api/settings/{user_id}`.
Los 8 idiomas son de primera clase: DE / EN / ES / FR / EL / PT /
TR / JA, cada uno con un catálogo completamente traducido.
Persistido entre recargas mediante `localStorage`.

## Proveedor de IA + selector de modelo

El desplegable de proveedor escribe `active_provider` en
UserSettings; la siguiente llamada a la IA pasa por el plugin del
nuevo proveedor (modo Servidor) o el cliente HTTP del nuevo
proveedor (modo Local).

El **Selector de modelo** (desde v1.11.0) es un desplegable con
búsqueda agrupado en Recomendado / Todo, poblado desde el endpoint
`/v1/models` en vivo de cada proveedor (caché de 1h). Cada fila
muestra el nombre legible + id bruto + distintivo de ventana de
contexto. Cuando la lista descubierta no está disponible (sin clave
API, sin red), el selector vuelve a los predeterminados estáticos y
muestra un aviso de «usando predeterminado sin conexión». El
encabezado de Sesión lee `<Proveedor>: <Nombre del modelo>`; el id
completo + la ventana de contexto están en la información sobre
herramientas.

## Claves API (Fase 34 / v1.20.0)

Cada proveedor tiene su propia fila: un campo de entrada de clave,
un botón Guardar, un botón Eliminar, el distintivo de proveedor
activo, más el nuevo distintivo de **atribución de origen**:

- **Clave de: Ajustes** — la clave se almacena cifrada con Fernet
  en la BD (modo Servidor) o en texto claro en IndexedDB (modo
  Local). Puedes guardar / eliminar libremente.
- **Clave de: secrets.yaml** — la clave está configurada en
  `~/.config/adaptive-learner/secrets.yaml`. El botón Guardar
  está desactivado; edita el archivo directamente para cambiarla.
  Un banner informativo debajo de la fila te recuerda la ruta.
- **Clave de: entorno** — la clave está configurada mediante la
  variable de entorno `ADAPTIVE_LEARNER_<PROVEEDOR>_API_KEY`.
  Guardar desactivado; la variable de entorno es la fuente de
  verdad.
- **Sin clave configurada** — no hay nada configurado en ningún
  lado. Escribe y haz clic en Guardar para empezar.

Cadena de resolución (prioridad más alta gana): entorno >
secrets.yaml > BD. Ver [la documentación de Configuración](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)
para el desglose completo.

## Modo de almacenamiento

El alternador entre almacenamiento **Servidor** y **Local
(Navegador)**:

- **Servidor** — cada lectura y escritura llega al backend
  FastAPI. Requiere un backend en ejecución. Mejor para el uso
  en múltiples dispositivos con sincronización del lado del
  servidor.
- **Local (Navegador)** — cada lectura y escritura llega a
  IndexedDB en este navegador. Las llamadas a la IA se disparan
  directamente al proveedor. No se requiere backend. Mejor para
  una configuración privada y local en el dispositivo.

Cambiar modos guarda en `localStorage` y muestra un aviso de
«se requiere recarga». Los datos NO se sincronizan entre modos.

## Sincronización

Empareja este dispositivo con otro en tu red local usando el
escáner de código QR (cámara trasera) o pega la URL de
emparejamiento. Una vez emparejados, los botones de enviar +
recibir intercambian datos bidireccionalmente. Los conflictos
pasan por un resolvedor de fusión de IA en el backend.

Alternativa para navegadores restringidos: sube una captura de
pantalla del código QR desde tu otro dispositivo
(`Html5Qrcode.scanFile`).

## Copia de seguridad

Tres funciones en una sección: **Exportar** (descargar un JSON
con marca de tiempo), **Importar** (restaurar desde archivo) y
**Comparar** (diferencia lado a lado con el estado actual). Las
claves API se eliminan de cada exportación.

La restauración es una FUSIÓN, no una sobreescritura: las filas
nuevas se insertan, las filas mutables se actualizan con el
`updated_at` más reciente, las filas de historial (sesiones /
commits / calificaciones) se deduplicen por UUID. La vista previa
de comparación muestra las filas añadidas / eliminadas / cambiadas
por tabla antes de hacer clic en Restaurar; la etiqueta del botón
Restaurar lee «Restaurar (N añadidas, M actualizadas)» una vez que
la diferencia se consolida.

En el modo Local la sección también muestra el bloque de
**Copia de seguridad automática**: anillo rotatorio de 3
instantáneas en una BD IndexedDB separada, se ejecuta cada 10
sesiones O cada 7 días (lo que ocurra primero). Cada instantánea
tiene sus propios botones de Restaurar + Eliminar +
Comparar-como-A/B.

## Voz

Cuatro alternadores (desde v1.18.0):

- **TTS activado** — añade un botón ▶ junto a las respuestas de
  la IA + los resultados de la Evaluación que los lee en voz alta.
  Elige la voz que coincide con el idioma cuando está disponible;
  velocidad + tono limitados a [0,5; 2,0].
- **Reproducción automática de IA** — habla cada respuesta de la
  IA automáticamente (predeterminado DESACTIVADO: el audio
  sorpresa raramente es lo que quieres).
- **STT activado** — añade un botón 🎤 a la entrada de Sesión que
  captura el habla y rellena el área de texto con transcripciones
  provisionales antes de enviar.
- **Práctica de pronunciación activada** — muestra la página
  `/pronunciation` desde el inicio rápido del Panel principal para
  proyectos etiquetados como Idiomas.

La sección de Voz se oculta cuando ninguno de los dos lados de la
Web Speech API (síntesis ni reconocimiento) es compatible con el
navegador.

## Apariencia (Fase 58 / v1.41.0)

El selector de **Tema** en *General > Apariencia* ofrece seis
temas más un modo automático:

- **Claro** — el predeterminado, brillante y de alto contraste.
- **Oscuro** — superficies atenuadas para uso con poca luz.
- **Océano** — tonos azul profundo, calmado y agradable por la
  noche.
- **Bosque** — tonos cálidos de verde y ámbar terrosos.
- **Alto contraste** — accesibilidad primero: negro, blanco y
  colores de señal audaces, con bordes de tarjeta nítidos. Úsalo
  si necesitas la máxima legibilidad.
- **Sepia** — tonos cálidos de papel, cómodo para lecturas largas.
- **Auto (Sistema)** — sigue la configuración de claro/oscuro de
  tu sistema operativo y cambia automáticamente cuando el sistema
  lo hace.

Elige un tema desde su tarjeta de vista previa; el cambio se
aplica al instante sin recarga, y tu elección se recuerda entre
visitas. Cada tema está diseñado para cumplir el contraste WCAG
2.1 AA, así que el texto, los gráficos, las insignias y la
retroalimentación de ejercicios son legibles en todos ellos.

## Interfaz

El **alternador de Gestos** (desde v1.10.0, predeterminado
ACTIVADO para dispositivos táctiles) cubre la navegación por
deslizamiento de la Evaluación, el deslizamiento para revelar el
tema del Plan de estudios y el vistazo del ciclo de Sesión.
También aquí: información sobre herramientas de botones y Modo
desarrollador.

## Gamificación

Alternadores para notificaciones de XP / insignias / subida de
nivel (desactivar silencia los toasts pero el sistema sigue
registrando el estado), **modo fin de semana** (omitir los huecos
de sáb./dom. en el mapa de calor de racha), meta de sesión diaria
(1..10), y **Reiniciar progreso** (confirmación doble; borra las
filas `user_xp` + `user_badges` + `user_streaks`).

## Acerca de

Cinco bloques de solo lectura: **Versión** (versión canónica de
`pyproject.toml`, hash de compilación, fecha de compilación),
**Sistema** (modo de almacenamiento, directorio de datos, ruta de
BD en modo Servidor, información de Python + plataforma),
**Créditos** (autor, reconocimientos de dependencias), **Apoyar
el desarrollo** (enlaces a Liberapay / GitHub Sponsors / Ko-fi),
**Licencia y recursos** (enlace MIT, repositorio, documentación,
rastreador de problemas).

En el modo Local el panel oculta las filas que solo tienen sentido
para un backend en ejecución (versión de Python, versiones de
FastAPI / SQLAlchemy / Pydantic / PluginForge, ruta de BD).
