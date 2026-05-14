# Code-Hygiene

Automatisierte Durchsetzung von Codequalitaet.

## Formatierung und Linting

### Python (Backend + Plugins)

```toml
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
cd backend && poetry run black .              # Formatierung
```

### TypeScript (Frontend)

Standard ESLint + Prettier Config via Vite Template.

---

## Error-Handling Architektur

### Backend: Eigene Exception-Hierarchie

Services werfen NIEMALS `HTTPException`. Services nutzen eigene Exceptions:

```python
class AdaptiveLearnerError(Exception):
    """Basis-Exception."""

class NotFoundError(AdaptiveLearnerError):
    """Ressource nicht gefunden."""

class ValidationError(AdaptiveLearnerError):
    """Validierungsfehler."""

class ProviderError(AdaptiveLearnerError):
    """AI-Provider-Fehler."""
```

Der globale Exception-Handler in main.py mappt:

```python
@app.exception_handler(NotFoundError)
async def not_found_handler(request, exc):
    return JSONResponse(status_code=404, content={"detail": str(exc)})
```

### Frontend: ApiError

```typescript
try {
  const result = await api.session.start(data);
} catch (error) {
  if (error instanceof ApiError) {
    showError(error.detail);
  }
}
```

### Regeln

- JEDES except-Block MUSS logger.error() aufrufen.
- JEDES except-Block MUSS str(e) in die Exception einbauen.
- Generische Fehlermeldungen ohne Details sind VERBOTEN.
- AI-Provider-Fehler abfangen und sinnvoll melden (kein Stack-Trace ans Frontend).
- Frontend: Loading-States waehrend API-Calls.

---

## API-Konventionen

```
GET    /api/users                    # Liste
GET    /api/users/{id}               # Einzeln
POST   /api/users                    # Erstellen
PATCH  /api/users/{id}               # Aktualisieren
DELETE /api/users/{id}               # Loeschen
```

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
