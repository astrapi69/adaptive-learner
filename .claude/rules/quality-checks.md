# Qualitaetspruefung und Teststrategie

## Schnell-Check nach jeder Aenderung

### 1. Tests laufen lassen

```bash
# Alles (MUSS gruen sein vor jedem Commit)
make test

# Einzeln:
make test-backend         # pytest Backend
make test-plugins         # Alle Plugin-Tests
```

### 2. Richtlinien manuell pruefen

Vor dem Commit:

- [ ] Kein `any` in TypeScript ohne Kommentar
- [ ] Keine fetch()-Aufrufe ausserhalb von api/client.ts
- [ ] Keine hardcodierten Strings in UI, i18n nutzen
- [ ] CSS nutzt Variables, keine festen Farben
- [ ] Kein Em-Dash in Code oder Texten
- [ ] Conventional Commit Message (feat:, fix:, refactor:, ...)
- [ ] AI-Provider-Tests nutzen Mocks, keine echten API-Calls
- [ ] API-Keys erscheinen nirgends im Klartext (Logs, Frontend, Tests)

---

## Teststrategie

### Testpyramide

```
      /    E2E     \        Playwright (spaeter)
     / ------------ \       Wenige, kritische User-Flows
    / Integration    \      pytest + TestClient
   / ---------------- \    API-Endpunkte mit echtem DB-Zustand
  /    Unit Tests      \    pytest
 / -------------------- \  Geschaeftslogik isoliert
```

### Unit Tests (Backend - pytest)

**Was testen:** Profil-Berechnung, Prompt-Generierung, Switching-Logik, Crypto.
**Was NICHT testen:** FastAPI-Routing (Integrationstests).

**Wann neue Tests:**
- Neuer Service: Mindestens Happy-Path + ein Fehlerfall.
- Bugfix: Erst failing Test, dann Fix.
- Switching-Logik: Verschiedene Rating-Szenarien.

### Integrationstests (Backend - pytest + TestClient)

**Was testen:** API-Endpunkte mit echtem DB-Zustand.

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_user_and_project():
    resp = client.post("/api/users", json={"name": "Test", "language": "de"})
    assert resp.status_code == 200
    user_id = resp.json()["id"]

    resp = client.post(f"/api/users/{user_id}/projects",
                       json={"topic": "Python", "goal": "Job", "daily_minutes": 30})
    assert resp.status_code == 200
```

### AI-Provider-Mocking

```python
from unittest.mock import patch, MagicMock

def test_session_message():
    with patch("plugins.ai_anthropic.plugin.anthropic") as mock:
        mock.Anthropic.return_value.messages.create.return_value = MagicMock(
            content=[MagicMock(text="Lass uns mit einer Regel beginnen.")]
        )
        # ... Session-Message testen
```

NIEMALS echte API-Calls in Tests. Immer mocken.

---

## Prioritaet fuer Verbesserungen

1. **Basis-Tests** - Core-Endpunkte, Profil-Berechnung, Crypto
2. **Plugin-Tests** - Assessment, Session, Tracking
3. **Frontend Vitest** - API Client, Utilities
4. **E2E Playwright** - Kritische User-Flows
5. **CI-Pipeline** - GitHub Actions
6. **Mutation Testing** - mutmut (spaeter)
