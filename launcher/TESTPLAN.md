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

- [ ] Window appears immediately (no empty screen)
- [ ] Docker check is the first step
- [ ] If Docker is not running: notice + "Start Docker" button
- [ ] If Docker is running: progress is visible
- [ ] Step 1: "Check Docker ✓"
- [ ] Step 2: "Download image..." (spinner)
- [ ] Step 3: "Start container..." (spinner)
- [ ] Step 4: "App is ready!" + "Open in browser" button
- [ ] Browser opens on the correct port
- [ ] Window stays open until the user closes it

## State 2: App already running

```bash
# Prep: container is running
docker ps | grep adaptive-learner

# Test:
python3 -m adaptive_learner_launcher
```

- [ ] Window shows "Adaptive Learner running on port XXXX"
- [ ] "Open in browser" button -> opens the app
- [ ] "Stop" button -> container stops
- [ ] "Uninstall" button -> confirmation -> removes container

## State 3: App installed but stopped

```bash
# Prep:
docker stop adaptive-learner

# Test:
python3 -m adaptive_learner_launcher
```

- [ ] Window shows "Installed but stopped"
- [ ] "Start" button -> container starts + app opens
- [ ] "Uninstall" button -> removes container

## State 4: Port conflict

```bash
# Prep: occupy the port
python3 -c "import http.server; http.server.HTTPServer(('', 8501), None).serve_forever()" &

# Test:
python3 -m adaptive_learner_launcher
```

- [ ] Launcher detects the port conflict
- [ ] Suggests an alternative port
- [ ] User can change the port

## State 5: Docker not installed / not started

```bash
# Prep: quit Docker Desktop

# Test:
python3 -m adaptive_learner_launcher
```

- [ ] FIRST dialog: "Docker Desktop must be started"
- [ ] "Start Docker" or "Retry" button
- [ ] No further step until Docker is running

## State 6: Window interaction

- [ ] Window title: "Adaptive Learner" (not "Bibliogon")
- [ ] Icon: Adaptive Learner icon (not Bibliogon)
- [ ] X button closes the window cleanly (no crash)
- [ ] Window is not resizable below its minimum size
- [ ] All text readable (no truncation)

## State 7: Command-line options

```bash
python3 -m adaptive_learner_launcher --port 9000
python3 -m adaptive_learner_launcher --help
python3 -m adaptive_learner_launcher --debug
python3 -m adaptive_learner_launcher --version
```

- [ ] `--port` sets the port (default 8501)
- [ ] `--help` shows the options (incl. `--version`)
- [ ] `--debug` prints verbose logs to stdout and writes `launcher-debug.log`
- [ ] `--version` prints the launcher version and exits

## State 8: Error handling

```bash
# Docker image build fails (e.g. no network)
# Test: airplane mode during the image download
```

- [ ] Error message visible (not a silent crash)
- [ ] Window stays open with error details
- [ ] Retry possible

---

## Notes

- Target runtime: CPython 3.14 (what runs on the device).
- Tkinter is the only GUI dependency (ships with Python).
- No `asyncio` in Tk code; background work uses threads
  (`StatusWindow.run_in_background`).
- All user-facing messages are bilingual (DE + EN) via the i18n module.
