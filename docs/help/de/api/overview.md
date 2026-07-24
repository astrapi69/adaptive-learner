# API-Übersicht

Das Backend von AdaptiveLearner exponiert eine FastAPI-REST-
API. Im Server-Modus spricht das Frontend mit ihr; im Lokal-
(Dexie-)Modus ist die API nicht erreichbar - die gleichen
Operationen laufen im Browser.

## Basis-URL

- **Lokal-Dev**: `http://localhost:18001/api`
- **Docker-Prod**: pro Deployment konfiguriert (z.B.
  `https://deinedomain.de/api`)
- **GH Pages**: nicht anwendbar (Dexie-Modus)

Das Frontend löst die Basis-URL aus `VITE_API_BASE` zur
Build-Zeit auf; Standard ist `/api`, sodass der Vite-Dev-
Server-Proxy transparent weiterleitet.

## Authentifizierung

Die API hat keine Pro-Request-Authentifizierung. Das System
ist Single-User-pro-Browser: eine `user_id` liegt im
`localStorage` und wird in URL-Pfaden mitgegeben
(`/users/{user_id}/...`).

KI-Anbieter-Keys werden über eine Drei-Schichten-Kette
aufgelöst (`services.settings.resolve_api_key`):

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`-Umgebungsvariable.
2. `ai.<provider>.api_key` in
   `~/.config/adaptive_learner/secrets.yaml`.
3. Fernet-verschlüsselte
   `UserSettings.api_key_<provider>`-DB-Spalte (über die
   Einstellungs-UI gesetzt; nie im Klartext ans Frontend
   zurückgegeben).
4. `None` - der KI-Aufruf zeigt einen Fehler in der UI.

`UserSettingsOut.key_source_*` (Enum
`env | secrets_yaml | settings | none`) meldet pro
Anbieter, aus welcher Schicht der aktive Schlüssel kam.

Eine zukünftige Multi-User/Multi-Tenant-Phase wird
Authentifizierung hinzufügen. Aktuell sollten Deployments
hinter einer eigenen Auth-Schicht stehen (Reverse Proxy mit
HTTP-Basic-Auth, Tailscale, VPN etc.), wenn ans Netzwerk
exponiert.

## Response-Format

Erfolgreiche Antworten liefern das Daten-Objekt direkt, ohne
Envelope:

```json
{
  "id": "abc-123",
  "topic": "Spanische Grammatik",
  "active": true
}
```

Listen kommen als JSON-Arrays:

```json
[
  {"id": "p1", "topic": "Spanisch"},
  {"id": "p2", "topic": "Analysis"}
]
```

HTTP-Status-Codes:

| Code | Bedeutung |
|---|---|
| 200 | OK (Read) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Validierungsfehler (Pydantic) |
| 404 | Nicht gefunden |
| 409 | Konflikt (selten) |
| 422 | Pydantic-Validierungsfehler (FastAPI-Standard) |
| 500 | Serverfehler |
| 502 | Externer Dienst nicht erreichbar (KI-Anbieter) |

## Fehler-Format

Fehler liefern ein einzelnes `detail`-Feld:

```json
{"detail": "Project abc-123 not found"}
```

Pydantic-Validierungsfehler kommen als strukturierte Liste:

```json
{
  "detail": [
    {"loc": ["body", "daily_minutes"], "msg": "value is not a valid integer", "type": "type_error.integer"}
  ]
}
```

Im Debug-Modus (`ADAPTIVE_LEARNER_DEBUG=true`) enthält die
Response zusätzlich ein `traceback`-Feld. Produktions-
Deployments sollten Debug ausgeschaltet lassen.

Die `ApiError`-Klasse des Frontends konsumiert beide Formen -
siehe `frontend/src/api/client.ts` für den exakten Parser.

## Endpoint-Gruppen

| Gruppe | Präfix | Zweck |
|---|---|---|
| Health + i18n | `/health`, `/i18n/{lang}` | App-Health + UI-Strings |
| Users | `/users` | User-CRUD + verschachtelte Projekte |
| Projects | `/projects` | Projekt-scoped Reads / Updates |
| Settings | `/settings/{user_id}` | UserSettings + API-Keys |
| Assessment-Plugin | `/plugins/assessment/...` | Fragen, Auswerten, Profil |
| Session-Plugin | `/plugins/session/...` | Start, Message, Rate, End, Switch |
| Tracking-Plugin | `/plugins/tracking/...` | Fortschritt + Commits |
| Tools-Plugin | `/plugins/tools/...` | Empfehlungen + Spaced |
| Curriculum | `/users/{user_id}/curricula`, `/curricula/{id}` | Curriculum + Topics + Lessons CRUD |
| Plugin-Discovery | `/plugins/manifests`, `/plugins/health`, `/plugins/errors` | Was ist registriert |

Siehe [Core-Endpoints](core-endpoints.md) und
[Plugin-Endpoints](plugin-endpoints.md) für die volle
Methodenliste mit Request/Response-Beispielen.

## OpenAPI / Swagger

FastAPI generiert automatisch eine OpenAPI-3.1-Spec aus den
Pydantic-Schemas. Im Dev-Modus:

- **Swagger-UI**: `http://localhost:18001/api/docs`
- **Redoc**: `http://localhost:18001/api/redoc`
- **Rohes OpenAPI-JSON**: `http://localhost:18001/api/openapi.json`

Diese sind die autoritative Referenz für jede exakte
Endpoint-Form. Die Markdown-Seiten hier sind eine kuratierte
Untermenge für Lesbarkeit.

## Paginierung

Endpunkte paginieren nicht. Der Datensatz ist
Single-User und klein; die größte Liste (Sessions pro
Projekt) liegt im niedrigen dreistelligen Bereich, nicht im
vierstelligen. Eine spätere Phase wird Cursor-basierte
Paginierung einführen, falls der Datenumfang wächst.

## Versionierung

Die API hat kein Versions-Präfix in der URL. Breaking
Changes landen an SemVer-Major-Grenzen; der CHANGELOG
dokumentiert, was sich verschoben hat.
