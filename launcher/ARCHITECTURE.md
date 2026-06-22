# Launcher architecture: Actions / GUI / CLI separation

Every operation the launcher performs is an **isolated action**. The GUI
and the CLI call only actions; actions know nothing of Tkinter. This makes
the launcher's behaviour unit-testable without a display, and keeps a
single source of truth for business logic.

## Layer 1 — Actions (`actions.py`, pure Python, testable)

`adaptive_learner_launcher/actions.py` imports **no tkinter**. Each action:

- takes plain parameters (`str` / `int` / `Path`);
- returns `(success: bool, message: str)` (a few return richer tuples,
  e.g. `find_free_port -> (found, port, message)`);
- **verifies** its result instead of blindly reporting success (e.g.
  `uninstall`/`stop` re-list containers to confirm the outcome);
- has no GUI dependency and is tested in `tests/test_actions.py` (no Tk).

Long-running actions (`install`, `start`) accept an optional
`on_step(label: str)` progress callback — a plain callable. The GUI passes
one that marshals onto the Tk thread; the action neither knows nor cares.

API: `check_docker`, `get_state`, `check_port`, `find_free_port`,
`install`, `start`, `stop`, `uninstall`, `health_check`, `open_browser`,
`get_version`, `load_config`, `save_config`, `set_port`.

## Layer 2 — GUI (`ui.py` + the handlers in `__main__.py`, thin)

The GUI renders dialogs/progress and binds events. It contains **no
business logic**: a handler disables controls, calls an action (on a
background thread for blocking ops, marshalling the result back via
`window.after`), and shows the result. Example: the uninstall handler
calls `actions.uninstall(project)` and shows its `(ok, message)` — the
container removal + verification lives entirely in the action.

## Layer 3 — CLI (`__main__.py`, thin routing)

`_maybe_run_cli_action(argv)` maps each headless flag to an action and
returns its exit code; no business logic lives there. With no action flag
it returns `None` and the GUI launches.

## Rule: CLI ↔ GUI parity

Every action callable from the GUI is also callable from the CLI, and
vice versa (pinned by `TestCliGuiParity` in `tests/test_actions.py`).

| Action | CLI | GUI |
|--------|-----|-----|
| Check Docker | `--check` | automatic on start |
| Status | `--status` | automatic on start |
| Install | `--install` | Install button |
| Start | `--start` | Start button |
| Stop | `--stop` | Stop button |
| Uninstall | `--uninstall` | Uninstall button |
| Open browser | `--open` | Open-in-browser button |
| Set port | `--port N` | port field |
| Version | `--version` | About section |
| Debug | `--debug` | (CLI only, developer) |

## Migration status

- **Done:** `actions.py` is the business-logic source; the CLI routes
  every action through it; the GUI's stop/uninstall handlers delegate to
  it; `test_actions.py` covers the layer with no Tk.
- **Remaining (incremental):** migrating the last GUI handlers (install
  worker, docker-ready loop, start flow, state detection) fully onto
  `actions.*`, and an inline GUI port field with live `check_port`
  feedback. The low-level `docker.py`/`config.py`/`installer.py`/
  `health.py` primitives stay as the verified building blocks `actions`
  composes; they are reduced to thin wrappers as each caller migrates.
