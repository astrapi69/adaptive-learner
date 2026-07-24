# Deployment

Vier Deployment-Modi:

| Modus | Wo | Backend | KI-Aufrufe | Schlüssel-Quelle |
|---|---|---|---|---|
| Lokal-Dev | `make dev` | FastAPI auf :18001 | Serverseitig | env / secrets.yaml / DB |
| GitHub Pages | `astrapi69.github.io/adaptive-learner/` | Keins (Dexie) | Browser-direkt | DB (IndexedDB) |
| Desktop-Launcher | PyInstaller-Binary (Docker-basiert) | FastAPI in einem Docker-Container | Serverseitig | `.env` (autom. generiert) / Einstellungs-UI |
| Docker | Docker-Compose-Selbst-Host | FastAPI im Container | Serverseitig | env / Einstellungs-UI |

## Lokale Entwicklung

```bash
make dev
```

Startet Backend (FastAPI + uvicorn `--reload`) auf Port 18001
und Frontend (Vite-Dev-Server) auf Port 15174 parallel.
Ctrl-C einmal stoppt beide.

Beide Ports sind konfigurierbar: `ADAPTIVE_LEARNER_PORT`
(Backend) und `ADAPTIVE_LEARNER_FRONTEND_PORT` (Frontend) in der
Umgebung überschreiben, oder `make BACKEND_PORT=… FRONTEND_PORT=… dev`.
Die Standardwerte (18001 / 15174) sind absichtlich nicht-Standard,
damit Adaptive Learner mit anderen Projekten koexistiert, die schon
auf 8000 / 5173 gebunden sind.

Vites Proxy leitet `/api/*` ans Backend, also nutzt das
Frontend immer `/api` als Base-URL - keine CORS-Konfig nötig
für die lokale Entwicklung.

Hintergrund-Modus:

```bash
make dev-bg     # detached
make dev-down   # stoppen
```

## GitHub Pages (nur Dexie)

`.github/workflows/deploy-gh-pages.yml` baut das Frontend mit:

- `VITE_BASE="/adaptive-learner/"` - präfixt jede Asset-URL
  für den Pages-Unterpfad.
- `VITE_STORAGE_MODE="dexie"` - pinnt DexieStorage als
  Standardmodus.
- `VITE_API_BASE=""` - kein Backend zum Anpeilen.

Der Workflow läuft bei jedem Push auf `develop` (dem aktiven
Entwicklungs-Branch unter Gitflow) und bei manueller Auslösung.
Nach dem Build kopiert er `dist/index.html` nach `dist/404.html`
für den SPA-Router-Fallback und nutzt dann
`actions/upload-pages-artifact@v5` + `actions/deploy-pages@v5`
zur Veröffentlichung.

Das Ergebnis ist ein voll statischer, backend-freier Build:
DexieStorage hält die kanonischen Daten in IndexedDB, KI-Aufrufe
gehen browser-direkt an den Provider, und die Lektions-Inhalte
sind in den Build gebündelt, sodass die Site offline funktioniert.

Die Site-URL ist `https://astrapi69.github.io/adaptive-learner/`.
Bei eigener Domain legen Nutzer eine `CNAME`-Datei in
`frontend/public/` ab; GitHubs Domain-aware Pages-Routing
erledigt den Rest.

## Docker Compose (voller Stack)

Es gibt zwei Compose-Dateien:

- `docker-compose.yml` (Dev): mountet den Quellbaum, fährt
  uvicorn `--reload` und den Vite-Dev-Server, veröffentlicht die
  Dev-Ports (Backend `${ADAPTIVE_LEARNER_PORT:-18001}`, Frontend
  `${ADAPTIVE_LEARNER_FRONTEND_PORT:-15174}`).
- `docker-compose.prod.yml` (Produktion), von `make prod` genutzt:

```bash
make prod        # docker compose up -d
make prod-down   # docker compose down
```

`docker-compose.prod.yml` enthält:

- **backend** (FastAPI in einem Python-3.12-slim-Image) auf einem
  festen internen Port **8000** mit `--workers 2`. Der Port ist
  ein Implementierungsdetail, entkoppelt vom host-veröffentlichten
  Port.
- **frontend** (nginx), das das gebaute Frontend ausliefert und
  `/api/*` über das Compose-Netzwerk ans Backend reverse-proxied.
  nginx lauscht auf Container-Port 80, host-veröffentlicht auf
  **`${ADAPTIVE_LEARNER_PUBLIC_PORT:-7880}`** - das ist der Port,
  den der Nutzer im Browser erreicht.
- **Ein benanntes `adaptive-learner-data`-Volume**, gemountet auf
  `/app/data` (gesetzt über `ADAPTIVE_LEARNER_DATA_DIR`), das
  Container-Rebuilds überlebt. Die DB liegt unter
  `$DATA_DIR/adaptive_learner.db`, Uploads unter
  `$DATA_DIR/uploads/`.

Das Backend-Image läuft als **Nicht-Root-Nutzer**
(`adaptive_learner`, angelegt in `backend/Dockerfile`).

`install.sh` und `install.ps1` sind die curl-pipe-Installer
für Endnutzer - sie holen ein Tag-Release-Tarball, setzen
`ADAPTIVE_LEARNER_SECRET_KEY` und machen `docker compose up`.
`start.sh` ist der entsprechende lokale Einstiegspunkt: prüft
Docker, generiert beim ersten Lauf einen zufälligen Secret in
`.env` aus `.env.example`, wenn keine `.env` existiert, und fährt
dann den Prod-Stack hoch.

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
   Verlust = alle verschlüsselten API-Keys werden unlesbar. Die
   App bricht beim Start hart ab, wenn er ungesetzt ist (kein
   stiller Default). Für den Docker-Stack generieren `start.sh` /
   der Launcher beim ersten Lauf einen zufälligen Key in `.env`,
   wenn keiner existiert.
2. **`ADAPTIVE_LEARNER_CORS_ORIGINS`**: kommagetrennte Liste
   erlaubter Origins. Standard ist permissiv; in Produktion
   enger schnallen.
3. **`ADAPTIVE_LEARNER_DEBUG`**: in Produktion ungesetzt /
   false lassen. Debug-Modus legt Stacktraces in Fehler-
   Antworten offen.

## Desktop-Launcher (Cross-OS, Docker-basiert)

`launcher/` ist ein PyInstaller-basierter One-Binary-Desktop-
Launcher. Er ist **kein** eingebetteter Server - er orchestriert
unter der Haube Docker Compose. Der Ablauf
(`adaptive_learner_launcher/__main__.py`) ist bewusst linear:

1. Prüfen, ob Docker installiert ist und läuft (sonst leiten
   klare Fehlerdialoge den Nutzer zum Installieren/Starten von
   Docker an).
2. Die App-Installation auflösen: bei einer Neuinstallation das
   passende Tag-Release-ZIP von GitHub herunterladen und auspacken
   (`installer.py`, nur Stdlib - keine git-Abhängigkeit), dann
   `.env` aus `.env.example` mit einem zufälligen Secret
   generieren.
3. Den Prod-Stack per `docker compose up` hochfahren.
4. Auf den Backend-Health-Check warten, dann den Standard-Browser
   des Nutzers auf dem veröffentlichten Port öffnen.
5. Beim nutzer-gesteuerten Stopp `docker compose down`.

Der Launcher trägt die Ziel-Version in sich (`__version__`-Literal
+ `_build_info.py`, das die Spec-Datei zur Build-Zeit schreibt;
Source-of-Truth ist `backend/pyproject.toml`). Er führt außerdem
einen **Hintergrund-Update-Check** gegen die GitHub-Releases-API
aus (`update_check.py`, seit v1.90.0): er fragt
`/repos/.../releases/latest` ab und benachrichtigt den Nutzer nur,
wenn ein echt neueres Release existiert. Der Check scheitert bei
jedem Fehler still (kein Netz, GitHub down, Rate-Limit, kaputte
Antwort), sodass er den Launcher nie blockiert oder unterbricht.

GitHub Actions baut drei Binaries pro Release:

- `launcher-linux.yml` → `adaptive-learner-launcher` (Linux)
- `launcher-macos.yml` → `adaptive-learner-launcher` (macOS)
- `launcher-windows.yml` → `adaptive-learner-launcher.exe`

Der Launcher ist bewusst NICHT der primäre Vertriebskanal
(Docker ist es). Er existiert für Nutzer, die ein "Doppelklick
zum Installieren"-Erlebnis wollen, ohne Compose-Befehle zu tippen.

Die volle 3-Schichten-Config-Kette (Projekt-YAML <
User-Overlay < Env-Vars) ist in `docs/configuration.md`
dokumentiert.

## CI/CD-Architektur

Jeder Workflow läuft isoliert; kein Shared-State zwischen
ihnen:

| Workflow | Trigger | Was er tut |
|---|---|---|
| `ci.yml` | push / PR auf `develop`, `main` | Tests + Lint + tsc |
| `coverage.yml` | täglicher Schedule, dispatch | Coverage HTML + xml |
| `release-gate.yml` | `v*.*.*`-Tag-Push, dispatch | Version-Pin-Drift-Check |
| `deploy-gh-pages.yml` | push auf `develop`, dispatch | GH-Pages-Build + Deploy |
| `launcher-{linux,macos,windows}.yml` | release: created | Launcher-Binary bauen + anhängen |
| `dexie-smoke.yml` | täglicher Schedule, `release/**`, dispatch | Dexie-Modus-Route-Smoke-Gate |
