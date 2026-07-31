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
python3 -m adaptive_learner_launcher --window      # persistent window (preview)
```

## Persistent window (preview)

`--window` opens a single long-lived window (instead of the dialog chain)
showing the current state with an inline, live-validated **port field**
(✓/✗ via `actions.check_port`) and state-aware buttons (Install / Start /
Stop / Uninstall / Open). All actions go through the `actions` layer on a
background thread. It is opt-in while the classic flow stays the default;
it becomes the default once verified on a real device.

### Minimize to system tray (optional)

With the optional `tray` extra installed, closing the window **while the
app is running** minimizes it to the system tray instead of quitting:

```bash
pip install adaptive-learner-launcher[tray]   # installs pystray + Pillow
```

On **Linux**, `pystray`'s GTK/AppIndicator backend additionally needs the
AppIndicator GIR typelib (Ubuntu ships the GNOME tray extension by default,
but not always the typelib):

```bash
sudo apt install gir1.2-ayatanaappindicator3-0.1   # or gir1.2-appindicator3-0.1
```

A tray icon then appears with a right-click menu (Open / Open in browser /
Stop / Quit) and click-to-restore; the tooltip shows the running port. All
tray actions route through the `actions` layer. If the tray cannot start
(extra not installed, AppIndicator missing, or the icon never appears) the
X button simply closes the launcher — no crash, and the window is never
hidden with no way to bring it back. Run `python -m adaptive_learner_launcher
--debug` and grep for `tray` to see which case applied.

**The downloadable binary has no tray, on purpose.** The frozen artifact
excludes pystray and Pillow: they cost megabytes that every learner
downloads, and on GNOME a docked icon would additionally need a shell
extension, so the promise would be conditional - worse than none. The
dependency declaration was removed to match, so the configuration and the
artifact say the same thing. In the binary the X therefore always closes
the launcher (the app itself keeps running in Docker; start the launcher
again to stop or check it). The tray remains available when running from
source with the `tray` extra.

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
