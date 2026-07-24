# Guide des plugins

Ce guide vous accompagne dans la création d'un plugin Adaptive Learner
de bout en bout.

---

## Structure du plugin

```
plugins/adaptive-learner-plugin-monplugin/
  adaptive_learner_monplugin/
    __init__.py
    plugin.py
    routes.py
    service.py
  tests/
    test_monplugin.py
  pyproject.toml
```

---

## 1. pyproject.toml

```toml
[tool.poetry]
name = "adaptive-learner-plugin-monplugin"
version = "1.0.0"
description = "Mon plugin Adaptive Learner"
packages = [{include = "adaptive_learner_monplugin"}]

[tool.poetry.dependencies]
python = "^3.11"
pluginforge = "^0.10.0"
fastapi = "^0.136"

[project.entry-points."adaptive_learner.plugins"]
monplugin = "adaptive_learner_monplugin.plugin:MonpluginPlugin"
```

---

## 2. plugin.py

```python
from pluginforge import BasePlugin, hookimpl
from fastapi import FastAPI

class MonpluginPlugin(BasePlugin):
    name = "monplugin"
    version = "1.0.0"
    target_application = "adaptive_learner"
    license_tier = "core"

    def register_routes(self, app: FastAPI) -> None:
        from .routes import router
        app.include_router(router, prefix="/api/plugins/monplugin", tags=["monplugin"])

    @hookimpl
    def on_session_complete(self, session: dict, db) -> None:
        """Appelé par le plugin session lorsqu'une session se termine."""
        # Votre logique ici
        pass
```

---

## 3. routes.py

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from . import service

router = APIRouter()

@router.get("/items/{user_id}")
def list_items(user_id: str, db: Session = Depends(get_db)):
    return service.get_items(user_id, db)

@router.post("/items")
def create_item(body: service.ItemCreate, db: Session = Depends(get_db)):
    return service.create_item(body, db)
```

---

## 4. service.py

```python
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.exceptions import NotFoundError

class ItemCreate(BaseModel):
    user_id: str
    content: str

def get_items(user_id: str, db: Session) -> list:
    # Pas d'HTTPException ici - utilisez des sous-classes AdaptiveLearnerError
    return db.query(...).filter_by(user_id=user_id).all()

def create_item(body: ItemCreate, db: Session):
    item = Item(user_id=body.user_id, content=body.content)
    db.add(item)
    db.commit()
    return item
```

---

## 5. Tests

```python
# tests/test_monplugin.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_list_items_empty(test_user):
    resp = client.get(f"/api/plugins/monplugin/items/{test_user.id}")
    assert resp.status_code == 200
    assert resp.json() == []

def test_create_item(test_user):
    resp = client.post("/api/plugins/monplugin/items", json={
        "user_id": test_user.id,
        "content": "Test"
    })
    assert resp.status_code == 200
    assert resp.json()["content"] == "Test"
```

---

## 6. Installer et activer

```bash
# Depuis le répertoire backend
poetry add --editable ../plugins/adaptive-learner-plugin-monplugin

# Activer dans backend/config/app.yaml
# plugins:
#   enabled:
#     - monplugin
```

Redémarrez le backend - votre plugin sera découvert via les entry points.

---

## Les 10 hookspecs

| Hook | Signature |
|------|-----------|
| `get_assessment_questions` | `(lang: str) -> list[dict]` |
| `calculate_profile` | `(answers: list[dict]) -> dict` |
| `create_session_prompt` | `(profile: dict, step: int, method: str, lang: str) -> str` |
| `ai_complete` | `(prompt: str, model: str, messages: list) -> str` |
| `ai_complete_async` | `async (prompt, model, messages) -> str` |
| `ai_complete_stream` | `async (prompt, model, messages) -> AsyncIterator[str]` |
| `recommend_method_switch` | `(session: dict, history: list) -> dict|None` |
| `on_session_complete` | `(session: dict, db: Session) -> None` |
| `get_progress_summary` | `(project_id: str, db: Session) -> dict` |
| `get_tool_recommendations` | `(profile: dict, lang: str) -> list[dict]` |

Utilisez `@hookimpl` sur vos implémentations. Un seul plugin peut implémenter
`ai_complete` (firstresult). Tous peuvent implémenter `on_session_complete`.

---

## Configuration du plugin

Ajoutez un fichier `backend/config/plugins/monplugin.yaml` :

```yaml
enabled: true
max_items: 50      # paramètre configurable par l'utilisateur
debug_mode: false  # INTERNE - pas de contrôle UI
```

Lisez-le depuis votre plugin :

```python
def activate(self) -> None:
    self._settings = self.config.get("settings", {})
    self._max_items = self._settings.get("max_items", 50)
```

**Règle :** tout paramètre influençant le comportement visible par l'utilisateur
doit soit apparaître dans l'UI des Paramètres, soit être marqué `# INTERNE`.
