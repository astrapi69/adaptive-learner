# Adaptive Learner Launcher

A small, stdlib-only desktop launcher for Adaptive Learner. It checks
Docker, downloads/builds the app stack, starts the containers, opens the
browser, and lets the user stop or uninstall the app from a Tk window.

- GUI: Tkinter only (ships with Python; keeps the PyInstaller bundle small)
- Runtime: CPython 3.11-3.14 (real devices run it on 3.14)
- No `asyncio` in Tk code; background work runs on threads
  (`StatusWindow.run_in_background`)
- Layered: **Actions** (`actions.py`, pure, verified, Tk-free) ← GUI +
  CLI call only actions. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Headless actions (CLI ↔ GUI parity)

Every GUI operation is also a CLI flag, routed through `actions.py`:

```bash
python3 -m adaptive_learner_launcher --check       # Docker status
python3 -m adaptive_learner_launcher --status      # app state
python3 -m adaptive_learner_launcher --install     # build + start
python3 -m adaptive_learner_launcher --start
python3 -m adaptive_learner_launcher --stop
python3 -m adaptive_learner_launcher --uninstall
python3 -m adaptive_learner_launcher --open        # open in browser
```

## Run from source

```bash
cd launcher
python3 -m adaptive_learner_launcher
```

## Command-line options

| Option | Effect |
|--------|--------|
| `--port N` | Use host port `N` (1-65535) for the app (default 8501). |
| `--debug` | Verbose logging to stdout **and** `launcher-debug.log` (written to the current directory, truncated each run). |
| `--version` | Print the launcher version and exit. |
| `--help` / `-h` | Show usage and exit. |

Default host port is **8501** (not 7880 — that is Bibliogon's). Port
source priority: `--port` > `launcher.json` > `.env`
(`ADAPTIVE_LEARNER_PUBLIC_PORT`) > default 8501. On a conflict the
launcher offers an alternative free port and persists the choice.

## Prerequisites

- Python 3.11+ (the launcher runs from source on the system Python; real
  devices run it on CPython 3.14).
- Docker Desktop installed and running. See
  [Install Docker Desktop](../docs/help/en/install/docker-desktop.md).

## Uninstall

From the launcher's management menu (when the app is installed): choose
**Uninstall**. It stops + removes the `adaptive-learner` container and
image but keeps your data (volumes are not deleted). To also wipe
volumes, config, and shortcuts, use the cleanup scripts below.

## Troubleshooting

- **"Docker Desktop not started"** — start Docker Desktop, wait for the
  running state, click "Retry". The launcher checks Docker first and does
  nothing else until it is up.
- **Port already in use** — the launcher detects the conflict before
  starting the container and offers an alternative free port; accept the
  suggestion (it is persisted for next time).
- **Docker build failed** — re-run with `--debug` and share
  `launcher-debug.log`; it captures every docker command + its output.
  If a previous attempt left stale containers/images, run the cleanup
  script and retry.

When a launcher bug appears, reproduce it with `--debug` and share the
generated `launcher-debug.log`:

```bash
python3 -m adaptive_learner_launcher --debug
```

The debug log captures step transitions, Docker commands + their output,
and any exception raised inside a Tk callback (which otherwise only
reaches stderr).

## Tests

```bash
cd launcher
poetry run pytest tests/
```

`tests/test_launcher_flow.py` includes a contract test
(`TestStatusWindowContract`) that fails if `__main__` ever calls a
`window.*` method the real `StatusWindow` does not provide -- the class
wraps `tk.Tk` by composition, so Tk methods such as `destroy` are **not**
inherited; use `close()` (regression pin for #948).

For the manual acceptance checklist, see [TESTPLAN.md](TESTPLAN.md).

## Cleanup scripts

If a launch leaves stale containers, images, or config behind (for
example after an interrupted install or a misconfigured build), reset to
a clean state:

- Linux / macOS: `scripts/cleanup-adaptive-learner.sh`
- Windows: `scripts/cleanup-adaptive-learner.bat`

```bash
chmod +x scripts/cleanup-adaptive-learner.sh
./scripts/cleanup-adaptive-learner.sh          # default port 8501
./scripts/cleanup-adaptive-learner.sh 9000     # custom port to check
```

The scripts stop and remove the `adaptive-learner` containers and images
(also cleaning up legacy `adaptive_learner` / Bibliogon-era names left by
a faulty launcher), optionally remove Docker volumes (with a
data-loss confirmation), remove config dirs under `~/.adaptive-learner`,
`~/.config/adaptive-learner`, and `~/.local/share/adaptive-learner`,
remove desktop shortcuts, and check whether the port is free. Then
restart the launcher.
