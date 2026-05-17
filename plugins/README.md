# Plugins

This directory is empty by design. The plugin loader infrastructure
(`backend/app/hookspecs.py`, `backend/app/main.py` discovery via
PluginForge, `backend/app/import_plugins/` registry) is in place; no
plugin packages ship with the skeleton.

## Adding a plugin

A plugin is a separate Python package that declares an entry point
under the group `adaptive_learner.plugins` (renamed in Phase 2 to
`adaptive_learner.plugins`).

Minimal layout:

```
plugins/adaptive-learner-plugin-<name>/
├── pyproject.toml
├── adaptive_learner_<name>/
│   ├── __init__.py
│   ├── plugin.py        # <Name>Plugin(BasePlugin) with hook impls
│   └── routes.py        # optional FastAPI router
└── tests/
    └── test_<name>.py
```

`pyproject.toml` entry-point declaration:

```toml
[tool.poetry.plugins."adaptive_learner.plugins"]
<name> = "adaptive_learner_<name>.plugin:<Name>Plugin"
```

Register the path-dep in `backend/pyproject.toml`:

```toml
adaptive-learner-plugin-<name> = {path = "../plugins/adaptive-learner-plugin-<name>", develop = true}
```

Enable in `backend/config/app.yaml`:

```yaml
plugins:
  enabled:
    - <name>
```

After editing pyproject: `cd backend && poetry lock && poetry install`.

## Plugin hookspecs

Hook signatures live in `backend/app/hookspecs.py`. Each carries
an `api_version` constant; bump it when changing a signature so
existing plugins fail loudly instead of silently misbehaving.
