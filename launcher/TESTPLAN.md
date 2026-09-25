# Launcher manual test plan

Manual acceptance checklist for the Adaptive Learner desktop launcher.
Each state is tested individually on a real device. Unit tests
(`poetry run pytest tests/`) cover the orchestration logic; this plan
covers what only a human at a real machine can confirm: the window
actually appears, is readable, and behaves.

> Run any flow with `--debug` to capture a full trace to
> `launcher-debug.log` in the current directory:
> `python3 -m adaptive_learner_launcher --debug`. Attach that log to a
> bug report.

---

## State 1: First install (no container)

```bash
# Prep: make sure there is no old container
docker rm -f adaptive-learner 2>/dev/null
docker rmi adaptive-learner 2>/dev/null

# Test:
cd launcher
python3 -m adaptive_learner_launcher
```

- [ ] LTC-0001 Window appears immediately (no empty screen)
- [ ] LTC-0002 Docker check is the first step
- [ ] LTC-0003 If Docker is not running: notice + "Start Docker" button
- [ ] LTC-0004 If Docker is running: progress is visible
- [ ] LTC-0005 Step 1: "Check Docker ✓"
- [ ] LTC-0006 Step 2: "Download image..." (spinner)
- [ ] LTC-0007 Step 3: "Start container..." (spinner)
- [ ] LTC-0008 Step 4: "App is ready!" + "Open in browser" button
- [ ] LTC-0009 Browser opens on the correct port
- [ ] LTC-0010 Window stays open until the user closes it

## State 2: App already running

```bash
# Prep: container is running
docker ps | grep adaptive-learner

# Test:
python3 -m adaptive_learner_launcher
```

- [ ] LTC-0011 Window shows "Adaptive Learner running on port XXXX"
- [ ] LTC-0012 "Open in browser" button -> opens the app
- [ ] LTC-0013 "Stop" button -> container stops
- [ ] LTC-0014 "Uninstall" button -> confirmation -> removes container

## State 3: App installed but stopped

```bash
# Prep:
docker stop adaptive-learner

# Test:
python3 -m adaptive_learner_launcher
```

- [ ] LTC-0015 Window shows "Installed but stopped"
- [ ] LTC-0016 "Start" button -> container starts + app opens
- [ ] LTC-0017 "Uninstall" button -> removes container

## State 4: Port conflict

```bash
# Prep: occupy the port
python3 -c "import http.server; http.server.HTTPServer(('', 8501), None).serve_forever()" &

# Test:
python3 -m adaptive_learner_launcher
```

- [ ] LTC-0018 Launcher detects the port conflict
- [ ] LTC-0019 Suggests an alternative port
- [ ] LTC-0020 User can change the port

## State 5: Docker not installed / not started

```bash
# Prep: quit Docker Desktop

# Test:
python3 -m adaptive_learner_launcher
```

- [ ] LTC-0021 FIRST dialog: "Docker Desktop must be started"
- [ ] LTC-0022 "Start Docker" or "Retry" button
- [ ] LTC-0023 No further step until Docker is running

## State 6: Window interaction

- [ ] LTC-0024 Window title: "Adaptive Learner" (not "Bibliogon")
- [ ] LTC-0025 Icon: Adaptive Learner icon (not Bibliogon)
- [ ] LTC-0026 X button closes the window cleanly (no crash)
- [ ] LTC-0027 Window is not resizable below its minimum size
- [ ] LTC-0028 All text readable (no truncation)

## State 7: Command-line options

```bash
python3 -m adaptive_learner_launcher --port 9000
python3 -m adaptive_learner_launcher --help
python3 -m adaptive_learner_launcher --debug
python3 -m adaptive_learner_launcher --version
```

- [ ] LTC-0029 `--port` sets the port (default 8501)
- [ ] LTC-0030 `--help` shows the options (incl. `--version`)
- [ ] LTC-0031 `--debug` prints verbose logs to stdout and writes `launcher-debug.log`
- [ ] LTC-0032 `--version` prints the launcher version and exits

## State 8: Error handling

```bash
# Docker image build fails (e.g. no network)
# Test: airplane mode during the image download
```

- [ ] LTC-0033 Error message visible (not a silent crash)
- [ ] LTC-0034 Window stays open with error details
- [ ] LTC-0035 Retry possible

---

## Notes

- Target runtime: CPython 3.14 (what runs on the device).
- Tkinter is the only GUI dependency (ships with Python).
- No `asyncio` in Tk code; background work uses threads
  (`StatusWindow.run_in_background`).
- All user-facing messages are bilingual (DE + EN) via the i18n module.
