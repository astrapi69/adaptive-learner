# Code-Hygiene

Automatisierte Durchsetzung von Codequalitaet.

## Formatierung und Linting

### Python (Backend + Plugins)

```toml
# backend/pyproject.toml

[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "B", "SIM"]
ignore = ["E501"]

[tool.ruff.lint.isort]
known-first-party = ["app", "plugins"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

```bash
cd backend && poetry run ruff check .         # Linting
cd backend && poetry run ruff check --fix .   # Auto-Fix
cd backend && poetry run ruff format .        # Formatierung
cd backend && poetry run black .              # Formatierung (black)
```

### TypeScript (Frontend)

Standard ESLint + Prettier Config via Vite Template.

---

## Error-Handling Patterns

### Backend (FastAPI)

```python
from fastapi import HTTPException

async def get_user(user_id: str):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    return user
```

- HTTP 404: Ressource nicht gefunden.
- HTTP 422: Validierungsfehler (Pydantic automatisch).
- HTTP 500: Nur fuer unerwartete Fehler.
- Service-Funktionen werfen ValueError, Router mappen zu HTTPException.
- AI-Provider-Fehler abfangen und sinnvoll melden (kein Stack-Trace ans Frontend).

### Frontend (React)

```typescript
try {
  await startSession(data)
  // Erfolg
} catch (error) {
  if (error instanceof ApiError) {
    // Fehler anzeigen
  }
}
```

- API-Fehler dem User zeigen.
- Loading-States waehrend API-Calls.

---

## API-Konventionen

```
GET    /api/users                    # Liste
GET    /api/users/{id}               # Einzeln
POST   /api/users                    # Erstellen
PATCH  /api/users/{id}               # Aktualisieren
DELETE /api/users/{id}               # Loeschen
```

- Keine Envelope. HTTP-Status reicht.
- IDs sind UUIDs als Strings.
- Timestamps als ISO 8601 (UTC).
- Plugin-Endpunkte unter /api/plugins/{name}/.

---

## Logging

```python
import logging
logger = logging.getLogger(__name__)

logger.info("Session started", extra={"project_id": project.id, "method": method})
logger.error("AI provider failed", extra={"provider": name}, exc_info=True)
```

- Kein print(). Logger nutzen.
- Kein console.log im Production-Frontend.
- API-Keys NIEMALS loggen.

---

## Inline-Dokumentation

- Kommentare erklaeren WARUM, nicht WAS.
- Docstrings fuer oeffentliche Python-Funktionen (Google-Style).
- Keine auskommentierten Code-Bloecke. Git ist die Versionierung.
