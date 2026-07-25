# Start the desktop launcher

!!! tip "Most users do not need the launcher"
    Adaptive Learner runs directly in the browser - no installation, no
    Docker, no launcher:
    **[astrapi69.github.io/adaptive-learner](https://astrapi69.github.io/adaptive-learner/)**.
    The desktop launcher is only for you if you want to self-host the
    app or run backend features (server mode, local sync) locally.

The desktop launcher is the easiest way to run Adaptive Learner **with
its own backend** on your own machine. It is a small window that does everything else for you: it
checks that Docker is running, downloads and builds the app image on the
first start (one-time, 5-10 minutes is normal), starts the containers,
and then opens the app in your browser at `http://localhost:8501`. From
the same window you can also stop the app, change the port, or
uninstall everything.

The port defaults to **8501** and can be changed in the launcher
window; if it is taken, the launcher falls back to a free port. If you
use browser storage mode, changing the port also changes where your
data lives - see [Changing the port](changing-the-port.md) before you
do it.

## Prerequisite: Docker - the launcher checks it itself

The launcher requires a running Docker, because the app itself runs as
a group of containers. You do **not** need to verify anything manually:
on start the launcher itself checks whether Docker is installed and
running, also finds a Docker running under a different Docker context
(such as Docker Desktop for Linux or rootless Docker), and shows a
clear message with a fix when something is missing. If Docker is not
installed at all yet: [Install Docker Desktop](docker-desktop.md).

The launcher's messages and what they mean:

| Message | Meaning | Fix |
|---------|---------|-----|
| "Docker is not installed (docker not in PATH)." | The `docker` command was not found. | [Install Docker Desktop](docker-desktop.md). The launcher shows the install link directly. |
| "Docker is installed but not started." or "Docker is not running. Checked context '...' (...): ..." | The Docker service is not running right now; the detailed form names the probed context, the socket, and Docker's original error. | Click the **"Start Docker"** button in the launcher (Linux) or open Docker Desktop (macOS/Windows), then **"Retry"**. |
| "Docker is installed, but you don't have permission." | Your user is not in the `docker` group (Linux). | The launcher shows the exact command; log out and back in afterwards. |
| "Docker is not responding." | Docker is most likely still starting up (typical right after opening Docker Desktop). | Wait a moment, then **"Retry"**. |
| "Docker is running via context '...' - the active context was unreachable, the launcher connected automatically." | Informational only: Docker ran under a different context, the launcher found it and uses it. | Nothing to do. |
| "Docker Desktop is installed but not in PATH." | The Docker Desktop app is there, but its command-line tool is not (yet) reachable. | Start Docker Desktop via the launcher button and wait briefly. |

The context detection with detailed messages ships with the launcher
version following docker-app-launcher#26; older versions show the
shorter messages from the same table.

## Download

All three launchers ship with every release at
[github.com/astrapi69/adaptive-learner/releases](https://github.com/astrapi69/adaptive-learner/releases):

| Platform | File | Checksum |
|----------|------|----------|
| Linux | `adaptive-learner-launcher` | `adaptive-learner-launcher.sha256` |
| macOS | `adaptive-learner-launcher-macos.zip` | `adaptive-learner-launcher-macos.zip.sha256` |
| Windows | `adaptive-learner-launcher.exe` | `adaptive-learner-launcher.exe.sha256` |

## Linux

1. Verify the checksum (both files in the same folder):

    ```bash
    sha256sum -c adaptive-learner-launcher.sha256
    ```

2. Set the execute permission. Browser downloads always strip it from
   the binary, so this step is **always** needed:

    ```bash
    chmod +x adaptive-learner-launcher
    ```

3. Start it, easiest from the terminal:

    ```bash
    ./adaptive-learner-launcher
    ```

    Double-clicking in the file manager can work too, depending on your
    environment; GNOME/Nautilus requires "Allow executing file as
    program" under Properties > Permissions. The terminal start has the
    advantage that you see error messages directly.

Known pitfalls:

- **"Permission denied"**: step 2 was skipped (`chmod +x`).
- **GLIBC error on start**: the binary is built on Ubuntu 22.04 and
  needs glibc 2.35 or newer (Ubuntu 22.04+, Debian 12+, Fedora 36+).
  On older distributions run the app via `install.sh` or Docker
  Compose directly instead.
- **App not reachable in the browser**: the app runs locally only
  (`localhost`), so no firewall rule is needed. If the browser does
  not open automatically, open `http://localhost:8501` manually (or
  the port shown in the launcher window).

## macOS

1. Verify the checksum and unpack the ZIP:

    ```bash
    shasum -a 256 -c adaptive-learner-launcher-macos.zip.sha256
    unzip adaptive-learner-launcher-macos.zip
    ```

2. On first open, Gatekeeper blocks the binary as coming from an
   "unidentified developer". Two ways around it:

    - Right-click (or Ctrl-click) the binary > **Open** > confirm
      **Open** in the dialog. macOS remembers this for all further
      starts.
    - Or: System Settings > **Privacy & Security** > scroll down to the
      blocked app and click **Open Anyway**.

## Windows

1. Verify the checksum (PowerShell, both files in the same folder):

    ```powershell
    Get-FileHash .\adaptive-learner-launcher.exe -Algorithm SHA256
    Get-Content .\adaptive-learner-launcher.exe.sha256
    ```

    The two hash values must match.

2. Double-click `adaptive-learner-launcher.exe`. On the first start
   SmartScreen warns ("Windows protected your PC"): click **More
   info**, then **Run anyway**.

## If something goes wrong

- The launcher itself shows a notice dialog when Docker is not running
  and offers to start Docker Desktop.
- The first start downloads and builds the app image; the step
  checklist in the launcher window (Check Docker / Download / Build /
  Start / Ready) shows the progress. Later starts are fast.
- While the app is running you can always reach it at
  `http://localhost:8501` (or your changed port); the "Open in
  browser" button in the launcher does the same.
