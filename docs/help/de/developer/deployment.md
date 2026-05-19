# Deployment

Drei Deployment-Modi ab v0.7.0:

| Modus | Wo | Backend | KI-Aufrufe | Anwendungsfall |
|---|---|---|---|---|
| Lokal-Dev | `make dev` | FastAPI auf :18001 | Serverseitig | Entwickeln |
| GitHub Pages | `https://astrapi69.github.io/adaptive-learner/` | Keins (Dexie) | Browser-direkt | Public-Probelauf |
| Server | Docker Compose | FastAPI im Container | Serverseitig | Selbst-gehostet |

## Lokale Entwicklung

```bash
make dev
```

Startet Backend (FastAPI + uvicorn `--reload`) auf Port 18001
und Frontend (Vite-Dev-Server) auf Port 15174 parallel.
Ctrl-C einmal stoppt beide.

Vites Proxy leitet `/api/*` ans Backend, also nutzt das
Frontend immer `/api` als Base-URL — keine CORS-Konfig nötig
für die lokale Entwicklung.

Hintergrund-Modus:

```bash
make dev-bg     # detached
make dev-down   # stoppen
```

## GitHub Pages (nur Dexie)

`.github/workflows/deploy-gh-pages.yml` baut das Frontend mit:

- `VITE_BASE="/adaptive-learner/"` — präfixt jede Asset-URL
  für den Pages-Unterpfad.
- `VITE_STORAGE_MODE="dexie"` — pinnt DexieStorage als
  Standardmodus.
- `VITE_API_BASE=""` — kein Backend zum Anpeilen.

Der Workflow läuft bei jedem Push auf `main` und bei manueller
Auslösung. Nach dem Build kopiert er `dist/index.html` nach
`dist/404.html` für den SPA-Router-Fallback und nutzt dann
`actions/upload-pages-artifact@v5` + `actions/deploy-pages@v5`
zur Veröffentlichung.

Die Site-URL ist `https://astrapi69.github.io/adaptive-learner/`.
Bei eigener Domain legen Nutzer eine `CNAME`-Datei in
`frontend/public/` ab; GitHubs Domain-aware Pages-Routing
erledigt den Rest.

## Docker Compose (voller Stack)

```bash
make prod        # docker compose up -d
make prod-down   # docker compose down
```

`docker-compose.prod.yml` enthält:

- **backend** (FastAPI in einem Python-3.12-Image), Port 7880.
- **nginx** als Sidecar, der das gebaute Frontend
  (`frontend/dist/`) ausliefert und `/api/*` ans Backend
  proxied.
- **Ein SQLite-Volume**, das Container-Neustarts überlebt.

`install.sh` und `install.ps1` sind die curl-pipe-Installer
für Endnutzer — sie holen ein Tag-Release-Tarball, setzen
`ADAPTIVE_LEARNER_SECRET_KEY` und machen `docker compose up`.

Die Installer werden zur Release-Zeit aus
`install.sh.template` / `install.ps1.template` plus der
Version aus `backend/pyproject.toml` neu generiert (siehe
`scripts/sync_versions.py`). Die generierten Dateien nicht
direkt editieren.

## Konfiguration für Produktion

Drei Dinge sind in Produktion wichtig:

1. **`ADAPTIVE_LEARNER_SECRET_KEY`**: muss ein stabiler
   Fernet-Key sein. Einmal generieren, sicher hinterlegen
   (HashiCorp Vault, AWS Secrets Manager, versiegelte `.env`).
   Verlust = alle verschlüsselten API-Keys werden unlesbar.
2. **`ADAPTIVE_LEARNER_CORS_ORIGINS`**: kommagetrennte Liste
   erlaubter Origins. Standard ist permissiv; in Produktion
   enger schnallen.
3. **`ADAPTIVE_LEARNER_DEBUG`**: in Produktion ungesetzt /
   false lassen. Debug-Modus legt Stacktraces in Fehler-
   Antworten offen.

Die volle 3-Schichten-Config-Kette (Projekt-YAML <
User-Overlay < Env-Vars) ist in `docs/configuration.md`
dokumentiert.

## Launcher (Cross-OS-Desktop)

`launcher/` ist ein PyInstaller-basierter One-Binary-Installer.
GitHub Actions baut drei Binaries pro Release:

- `launcher-linux.yml` → `adaptive-learner-launcher-linux`
- `launcher-macos.yml` → `adaptive-learner-launcher-macos`
- `launcher-windows.yml` → `adaptive-learner-launcher.exe`

Jeder Launcher trägt die Version in sich (`__version__`-
Literal + `_build_info.py`, das die Spec-Datei zur Build-Zeit
schreibt) und holt das passende Tag-Release-Tarball, packt es
aus, bootstrapped das Backend und öffnet das Frontend im
Browser des Nutzers.

Der Launcher ist bewusst NICHT der primäre Vertriebskanal
(Docker ist es). Er existiert für Nutzer, die ein "Doppelklick
zum Installieren"-Erlebnis wollen.

## CI/CD-Architektur

Jeder Workflow läuft isoliert; kein Shared-State zwischen
ihnen:

| Workflow | Trigger | Was er tut |
|---|---|---|
| `ci.yml` | push, pull_request | Tests + Lint + tsc |
| `coverage.yml` | push auf main | Coverage HTML + xml |
| `release-gate.yml` | Tag-Push | Version-Pin-Drift-Check |
| `deploy-gh-pages.yml` | push auf main, dispatch | GH-Pages-Build + Deploy |
| `launcher-{linux,macos,windows}.yml` | release: created | Launcher-Binary bauen + anhängen |
| `docs.yml` | push auf main | MkDocs-Build (aktuell inaktiv — die Site kommt aus dem GH-Pages-Workflow) |
