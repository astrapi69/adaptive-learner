# Barreras, ratchets y protección de ramas

Este proyecto es inusualmente estricto: decenas de barreras de CI, una
familia de ratchets con líneas base congeladas, issues y pull requests
obligatorios, un contrato de pruebas de barreras y una protección de
ramas que también vincula a los administradores. Casi nada de eso se
escribió donde lo lee una persona: vive en los archivos de reglas
orientados a agentes bajo
[`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).
Esta página es el mapa para personas: qué es cada mecanismo, por qué
existe y, lo que de verdad importa cuando estás bloqueado, qué hacer al
respecto.

Nada de aquí repite una norma. Donde una regla contiene la redacción
vinculante, esta página enlaza a ella y la explica. Las reglas son la
fuente de verdad; una segunda copia derivaría, y este código ya lo ha
detectado más de una vez.

## Dos cadencias: barreras de PR frente al turno de noche

Un pull request en verde **no** significa que `develop` esté en verde. La
CI de PR ejecuta solo las barreras de corrección, aquellas cuyo fallo
debe bloquear una fusión. Todo lo informativo, de solo aviso o
dependiente de estado externo se ejecuta en el turno de noche (una
programación nocturna más `workflow_dispatch`).

| Se ejecuta en cada PR | Se ejecuta cada noche + en el lanzamiento |
|---|---|
| pruebas de backend / plugins / frontend, ruff + mypy, pre-commit, verificador de deriva de documentación | análisis de seguridad (pip-audit / bun audit / bandit) |
| ratchet de complejidad, guardas de tamaño de carpeta + de archivo | informe de cobertura (un informe, no una barrera) |
| barrera de líneas base visuales, barrera de referencias testid | E2E en modo Dexie, regresión visual, pruebas de mutación |
| docker-build-smoke (filtrado por rutas) | deriva de content-stats, barrera WebKit |

La consecuencia: un cambio en una superficie que solo cubre el turno de
noche puede fusionar un PR limpio y poner en rojo la siguiente ejecución
nocturna. Es una clase de riesgo conocida y recurrente, no un caso
aislado. La tabla autoritativa y el razonamiento viven en
[`quality-checks.md` -> "CI cadence: PR gates vs the night shift"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).

## Qué es una barrera, y qué no es

Una barrera es una comprobación que **falla cerrada**. El contrato de
pruebas de barreras del proyecto (cinco pruebas por barrera) se detalla
en
[`quality-checks.md` -> "Gate test contract"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).
Las dos reglas que notarás como contribuidor:

- **Una barrera que no puede comprobar nunca debe informar verde.** "No
  pude ejecutarme" no es "no hay nada que encontrar". Si falta la base
  de una barrera (línea base ausente, helper caído, frontend sin
  compilar), falla, no pasa.
- **Una barrera informa de lo que midió.** "0 hallazgos" y "0 archivos
  examinados" no son el mismo resultado, y la barrera está construida
  para que puedas distinguirlos.

Así que cuando una barrera te bloquea, lee lo que dice haber medido antes
de suponer que se equivoca. La mayoría de los fallos "falsos" de una
barrera son la barrera informando correctamente de una deriva real que no
esperabas.

## Ratchets y líneas base

Un **ratchet** compara una medición actual con una línea base congelada
que vive en el árbol. La medición puede mejorar libremente; no puede
empeorar en silencio. Las dos mitades, el número y la línea base, están
confirmadas en el repositorio, así que ambas pueden derivar.

La familia de ratchets y dónde vive cada línea base:

| Ratchet | Archivo de línea base | Objetivo local |
|---|---|---|
| Complejidad ciclomática | `.complexity-baseline` | `make check-complexity-gate` |
| Tamaño de archivo (líneas) | `.filesize-baseline` | `make check-file-sizes` |
| Tamaño de carpeta (archivos planos/dir) | `.dirsize-baseline` | `make check-folder-size` |
| Tamaño de `global.css` | `.css-size-baseline` | `make check-css-size` |
| Tokens de tema / contraste | `.theme-baseline.json` | `make verify-theme` |
| Tamaño del corpus de reglas | `.claude/rules/.corpus-baseline.json` | `make verify-rule-corpus-size` |
| Sustitutos de diéresis en la documentación | `docs/.docs-hygiene-baseline.json` | `make verify-docs-hygiene` |
| Referencias rotas en la documentación | `docs/.doc-refs-baseline.json` | `make verify-doc-refs` |
| Tamaño de la imagen publicada | (en `verify-image-size`) | `make verify-image-size` |

### Cuando un ratchet te bloquea

1. **Fusiona primero `develop`, después vuelve a medir.** Un ratchet
   compara el árbol actual con una línea base; una rama por detrás de su
   base lleva una línea base *antigua* frente a contenido fusionado
   *nuevo*, así que el número que lees en local no es el que lee la CI.
   Actualiza tu rama antes de tocar nada. Por qué esto muerde está
   documentado en
   [`lessons/ci-gates.md` -> "A ratchet baseline is itself a
   measurement"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md).

2. **Si el aumento es legítimo, sube la línea base deliberadamente, y di
   por qué.** Cada ratchet tiene un objetivo explícito de subida o
   actualización, para que el nuevo techo aparezca en tu diff, revisable,
   con una razón en el mensaje de commit:

   ```bash
   make check-complexity-gate-update      # regenerate .complexity-baseline
   make check-folder-size-update          # show offenders to whitelist
   make verify-theme-baseline-update      # re-record .theme-baseline.json
   make verify-rule-corpus-size-raise     # raise the corpus ceiling
   make verify-image-size-raise           # raise the image ceiling
   ```

3. **No esperes que un ratchet se baje solo.** Algunos ratchets
   registran automáticamente una reducción genuina (un contador de
   errores que debería ser cero); un ratchet de *presupuesto* guarda una
   reducción como margen y solo se mueve mediante un acto deliberado; un
   ratchet de *oráculo que deriva* (complejidad, el CSS de Tailwind
   compilado) nunca se baja solo, porque una caída podría ser deriva de
   la herramienta y no una mejora real. La decisión a tres bandas se
   explica en el contrato de pruebas de barreras, punto 5. Si un ratchet
   falló porque un número *encogió*, eso también es un hallazgo, no vía
   libre.

Nunca bajes un techo para que un rojo local pase a verde. El número
significa lo mismo en todas partes por diseño; moverlo en silencio es
exactamente el fallo que el ratchet existe para evitar.

### Un ejemplo práctico: el ratchet del corpus de reglas

Supón que añades una sección a un archivo de reglas bajo `.claude/rules/`.
Cada uno de esos archivos se inyecta en cada prompt, así que el ratchet
del corpus vigila su tamaño total. Ejecútalo y bloquea:

```
$ make verify-rule-corpus-size
rule corpus: 24 files, 292314 chars (~73078 tokens per prompt)
rule corpus is 58 chars over the ceiling (292314 > 292256).
  - condense or delete elsewhere in the corpus (see the condensation rule
  - raise the ceiling deliberately:
      make verify-rule-corpus-size-raise
    and say in the commit what the corpus bought for the space.
make: *** [Makefile:899: verify-rule-corpus-size] Error 1
```

La barrera imprime las dos salidas legítimas, y solo esas dos: condensar
o borrar otra cosa para que el total vuelva a caber, o subir el techo a
propósito con `make verify-rule-corpus-size-raise` y justificarlo en el
commit. Termina con código distinto de cero (`Error 1`), así que hace
fallar la compilación hasta que hagas una de las dos; no hay una tercera
vía por la que la adición simplemente se cuele. Todos los ratchets de la
tabla anterior bloquean con la misma forma: una línea que nombra lo que
midió, el valor actual frente al techo y su propio objetivo de subida o
actualización.

Una barrera que solo muerde después del push cuesta un viaje de ida y
vuelta. Ejecuta las barreras sin compilación en el orden de la CI con un
solo comando:

```bash
make ci        # every build-free gate, in CI order (BASE=<ref> for diff gates)
make ci-full   # the above plus gates that need a built frontend
```

`make ci` ejecuta, por orden: deriva de documentación, higiene de
documentación, referencias de documentación, enlaces barrera<->regla,
inventario de comprobaciones, inventario de lecciones, cambios
normativos, tamaño del corpus de reglas, ratchet de complejidad,
referencias testid, contexto de docker, tamaños de archivo y la
instantánea de OpenAPI. Dos barreras necesitan un frontend instalado y
compilado (compilan el oráculo de clases de Tailwind), así que están en
`make ci-full`, no en `make ci`. Las suites de pruebas van aparte:
`make test`.

## Las barreras están acopladas a reglas, y los cambios se declaran

Dos manifiestos mantienen honesta la aplicación, y puedes disparar
cualquiera de ellos al editar un archivo de reglas o un workflow:

- [`.claude/rules/gates.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/gates.yaml)
  acopla cada barrera que aplica una regla a la sección de regla que
  aplica. `make verify-gate-rule-links` falla en ambas direcciones: una
  barrera sin regla, o una regla que cita un workflow que ya no existe.
  Cada barrera acoplada lleva además un `body_sha` de la sección de la
  regla, así que se detecta vaciar el cuerpo de una regla manteniendo su
  encabezado.
- [`.claude/rules/checks.yaml`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/checks.yaml)
  inventaría cada comprobación. `make verify-check-inventory` demuestra
  que una comprobación `active` está realmente conectada y no se ha
  degradado a no hacer nada. Desactivar una comprobación solo se permite
  declarando `status: disabled` con una razón: el diff lo muestra. Lo que
  se vuelve imposible es la desactivación silenciosa.

Si tu PR añade o elimina redacción vinculante en un archivo de reglas, o
cambia el estado de una barrera, `make verify-normative-changes` te
pedirá que lo **declares**: la etiqueta `rule-change-declared`, o una
línea `RULE-CHANGE DECLARED: <what and why>` en el cuerpo del PR o en un
mensaje de commit. La declaración es superable a propósito, nunca por
accidente, y converge en
[`docs/rule-change-log.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/rule-change-log.md)
de forma automática. El razonamiento completo: la serie #2075 / #2077 /
#2079 / #2081 / #2087 en
[`quality-checks.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/quality-checks.md).

El corpus de reglas tiene un techo por una razón concreta: cada archivo
`.claude/rules/**/*.md` se inyecta en cada prompt de cada sesión de
agente, así que una nueva sección de regla es un intercambio, no una
adición: condensa o elimina algo antes, o di en el commit qué compró el
corpus con ese espacio.

## La protección de ramas también vincula a los administradores

`develop` exige una rama actualizada y comprobaciones obligatorias en
verde antes de una fusión. Desde 2026-08-06 `enforce_admins` está
**activado** para `develop`, así que las comprobaciones obligatorias
vinculan también a los administradores del repositorio; desactivarlas es
un acto deliberado y visible, nunca parte de una fusión rutinaria. Esto
existe porque las fusiones de vuelta de release y hotfix llegaron una vez
a `develop` sin barreras y lo dejaron en rojo para todas las ramas hasta
que una persona lo notó; la historia está en
[`lessons/ci-gates.md` -> "Release/hotfix back-merges land
ratchet-tripping changes on develop ungated"](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/lessons/ci-gates.md)
y
[`docs/development/release-ratchet-gap.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/development/release-ratchet-gap.md).

Efecto práctico: nadie fusiona saltándose una barrera en rojo. Si tu PR
va por detrás de `develop`, actualízalo para que la CI vuelva a
ejecutarse sobre el estado combinado antes de poder fusionarlo.

## Las obligaciones: issue, PR, plan de pruebas, un asunto

Cuatro obligaciones permanentes se sitúan por encima de las barreras. Son
normas, no comprobaciones de CI, y son vinculantes tanto si una tarea las
pidió como si no:

- **Issue primero** (`GITHUB-ISSUE-PFLICHT`): cada bug o cambio necesita
  un issue de GitHub *antes* de la corrección, y el commit/PR lo cita con
  una palabra clave de cierre (`Closes #NN`).
- **PR siempre** (`PR-PFLICHT`): cualquier cambio de código enviado abre
  un pull request contra `develop`, se haya pedido o no. Una rama
  enviada sin PR es trabajo sin terminar.
- **Plan de pruebas para cambios visibles** (`TESTPLAN-PFLICHT`): un
  cambio en el comportamiento visible para el usuario actualiza el plan
  de pruebas manual (alemán e inglés) en el mismo PR. Las refactorizaciones
  puras, la infraestructura y la documentación están exentas.
- **Un asunto por PR**: cada PR contiene un único cambio coherente.

La redacción vinculante vive en
[`.claude/rules/ai-workflow/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules/ai-workflow)
(`github-issue-policy.md`, `pr-policy.md`, `testplan-policy.md`) y en
[`vibe-coding.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/.claude/rules/vibe-coding.md).

## Dónde encaja esto

Esta página es el complemento de "por qué está ahí la barrera" para el
[recorrido de incorporación](onboarding.md), que es el camino paso a
paso desde el clon hasta el PR fusionado. Para el flujo de pruebas en sí
(Red-Green-Refactor y un ejemplo práctico) consulta [Pruebas](testing.md).
Para las barreras del momento del lanzamiento consulta
[Flujo de lanzamiento](release.md).
