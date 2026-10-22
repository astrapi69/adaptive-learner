# Flujo de lanzamiento

AdaptiveLearner publica un lanzamiento en cada finalización de
subfase mayor. El proceso completo está automatizado por
`make sync-versions` y un trabajo CI de comprobación del
lanzamiento; los pasos humanos son simplemente la elección de
versión, el CHANGELOG y la etiqueta.

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

## El lanzamiento en 8 pasos

### 1. Capturar el estado

```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD
git diff --stat $(git describe --tags --abbrev=0)..HEAD
```

Revisa qué se entregó desde la última etiqueta. Decide el nivel
del incremento.

### 2. Escribir las notas del lanzamiento

Añade un archivo `changelog/releases/vX.Y.Z.md` siguiendo la
forma del lanzamiento más reciente (Añadido / Corregido /
Pruebas / Elementos del backlog cerrados / Commits / Notas de
actualización). El CI de comprobación del lanzamiento verifica
que este archivo exista para la etiqueta que se está enviando.

### 3. Editar manualmente la versión canónica

El único campo de versión editado manualmente en todo el
repositorio:

```toml
# backend/pyproject.toml
[tool.poetry]
version = "X.Y.Z"
```

### 4. Propagar

```bash
make sync-versions
```

Actualiza automáticamente cada archivo que lleva la versión (el
conjunto completo está en `scripts/sync_versions.py`):

- `frontend/package.json`
- `launcher/pyproject.toml`
- `launcher/adaptive_learner_launcher/__init__.py`
- `launcher/adaptive-learner-launcher.spec` (plist CFBundle +
  CFBundleShortVersionString)
- cada `plugins/adaptive-learner-plugin-*/pyproject.toml`
- cada `__init__.py` de plugin con un literal `__version__`
- `install.sh` (regenerado desde `install.sh.template`)
- `install.ps1` (regenerado desde `install.ps1.template`)

### 5. Verificar

```bash
make sync-versions-check     # sale con error en caso de deriva
make test                    # la suite completa debe pasar
cd frontend && bun run build # debe tener éxito
```

El flujo de trabajo CI de comprobación del lanzamiento
(`.github/workflows/release-gate.yml`) ejecuta el mismo
`sync-versions-check` en cada push de etiqueta. Si local
coincide pero CI falla, la deriva se introdujo entre tu
comprobación local y el push - investígalo.

### 6. Confirmar + etiquetar

```bash
git add -A
git commit -m "chore(release): bump version to vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z - titular de la fase + resumen"
```

Los mensajes de etiqueta son anotados, de varias líneas y
resumen el lanzamiento. Se convierten en las notas de la GitHub
Release cuando se ejecuta el siguiente paso.

### 7. Publicar

```bash
git push origin main --tags
```

Activa:

- `ci.yml` en el nuevo commit (pruebas)
- `release-gate.yml` en la nueva etiqueta (comprobación de
  deriva de versiones)
- `deploy-gh-pages.yml` en el nuevo commit (publicar sitio
  público)
- `launcher-{linux,macos,windows}.yml` cuando GitHub crea la
  Release a partir de la etiqueta

`coverage.yml` no se ejecuta con el push, sino cada noche y bajo
demanda; para un informe del commit de la release, ejecuta
`gh workflow run coverage.yml --ref main`.

### 8. Crear la GitHub Release

```bash
gh release create vX.Y.Z \
  --title "Adaptive Learner vX.Y.Z" \
  --notes-file changelog/releases/vX.Y.Z.md
```

`--notes-file` garantiza que la página de GitHub Release coincida
con las notas del lanzamiento confirmadas en el paso 2.

## Versiones de plugins

Los plugins avanzan al mismo ritmo que la versión canónica de la
aplicación. El mismo número en cada `pyproject.toml` de plugin más
los literales `__version__` en los `__init__.py` de plugins. Una
futura decisión de «plugins núcleo vs. de terceros» podría
desvincularlos, pero la configuración actual es uniforme en todos
los archivos propagados.

## Flujo de hotfix

Los lanzamientos de nivel parche (0.X.1, 0.X.2) siguen los mismos
8 pasos. La sección «Historial de hotfixes» del CHANGELOG del
lanzamiento registra la cadena cuando aterrizan varios hotfixes
seguidos.

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
