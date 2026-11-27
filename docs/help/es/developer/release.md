# Flujo de lanzamiento

Un lanzamiento lo hacen dos workflows, no se hace a mano. `release.yml` corta la rama de lanzamiento, fija la versión y ejecuta la comprobación completa antes de subir nada. `release-finish.yml` fusiona en `main`, etiqueta y crea el lanzamiento como borrador. La versión vinculante, paso a paso, es `.claude/rules/release-workflow.md`; esta página es el resumen.

## Convención de versiones

Adaptive Learner sigue el Versionado Semántico 2.0.0:

- **Mayor (X.0.0)** - cambios de ruptura en la API o la
  arquitectura. Reservado para grandes cambios futuros.
- **Menor (X.Y.0)** - nuevas funcionalidades, compatibles con
  versiones anteriores. Por defecto para cada finalización de
  fase (estamos en v1.20.0 / 34 fases entregadas).
- **Parche (X.Y.Z)** - correcciones de errores, compatibles con
  versiones anteriores. Cadenas de hotfixes.

Las etiquetas de prelanzamiento (`-alpha`, `-beta`, `-rc`) no se
usan. Los lanzamientos son siempre estables.

## El camino

1. **En develop, por pull request**: las notas `changelog/releases/vX.Y.Z.md`, la sección "Novedades" de las páginas de ayuda y las actualizaciones de dependencias. Sin el archivo de notas el workflow no arranca.
2. **Ensayar**: `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare` corta, fija la versión y comprueba en el runner, y no sube nada.
3. **Cortar**: `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare -f push_branch=true`. Con la comprobación en verde se sube la rama `release/X.Y.Z`; desde entonces develop queda congelado.
4. **Revisar la rama**: la construcción de la imagen, el análisis de seguridad, la comprobación de WebKit, la comparación visual y las tres construcciones del launcher se lanzan sobre la rama de lanzamiento. Una rama subida por un workflow no inicia ninguna por sí sola.
5. **Finalizar**: `gh workflow run release-finish.yml --ref release/X.Y.Z -f version=X.Y.Z` fusiona en `main` sin fast-forward, etiqueta el commit de fusión, abre el pull request que devuelve el lanzamiento a develop y crea el lanzamiento de GitHub como borrador.
6. **Publicar**: `publish-image.yml` publica y verifica la imagen, se adjuntan los binarios del launcher de las construcciones verdes de `main`, y solo entonces el borrador se hace visible.

### La versión se fija en un solo lugar

`backend/pyproject.toml` es la única fuente. El corte la fija y `make sync-versions` escribe todos los demás archivos con campo de versión (el conjunto completo es `collect_targets()` en `scripts/sync_versions.py`). Nadie edita un campo de versión a mano. `release-gate.yml` vuelve a comprobar los pins en la etiqueta.

### Qué inicia qué

- un push a `main`: `ci.yml`, `deploy-gh-pages.yml` y las construcciones del launcher
- la etiqueta: `release-gate.yml`
- el borrador del lanzamiento: nada; la imagen y los binarios vienen del paso de publicación

`coverage.yml` no se ejecuta con el push; se ejecuta cada noche y bajo demanda (`gh workflow run coverage.yml --ref main`).

## Versiones de plugins

Los plugins avanzan al mismo ritmo que la versión canónica de la
aplicación. El mismo número en cada `pyproject.toml` de plugin más
los literales `__version__` en los `__init__.py` de plugins. Una
futura decisión de «plugins núcleo vs. de terceros» podría
desvincularlos, pero la configuración actual es uniforme en todos
los archivos propagados.

## Flujo de hotfix

Un hotfix es el único lanzamiento hecho a mano: ninguno de los dos workflows puede cortar desde `main`. Rama `hotfix/vX.Y.Z` desde `main`, corrección, fijar la versión y escribir las notas, comprobar la rama con `release-prepare.yml`, después `make release-finish VERSION=X.Y.Z FINISH_BRANCH=hotfix/vX.Y.Z` y `make release-publish VERSION=X.Y.Z`.

Una etiqueta subida nunca se borra ni se mueve. Un lanzamiento erróneo lo corrige la versión siguiente.

## Commits discretos de actualización de dependencias

Cuando el ciclo de lanzamiento actualiza dependencias (Vite,
React, etc.), mantén cada actualización como su propio commit.
Motivos:

- **Granularidad de bisección** - una regresión se aísla a una
  sola actualización.
- **Legibilidad del CHANGELOG** - los lectores ven la motivación
  real de cada actualización.
- **Reversión** - una actualización problemática puede revertirse
  de forma independiente.

El patrón completo está documentado en
`.claude/rules/release-workflow.md`. La disciplina de reglas como
documentación mantiene los docs legibles por humanos (esta página)
y las reglas legibles por máquinas sincronizadas.
