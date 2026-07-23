# Start the desktop launcher

The desktop launcher is the easiest way to run Adaptive Learner on your
own machine. It is a small window that does everything else for you: it
checks that Docker is running, downloads and builds the app image on the
first start (one-time, 5-10 minutes is normal), starts the containers,
and then opens the app in your browser at `http://localhost:8501`. From
the same window you can also stop the app, change the port, or
uninstall everything.

The port defaults to **8501** and can be changed in the launcher
window; if it is taken, the launcher falls back to a free port.

## Prerequisite: Docker is installed AND running

The launcher strictly requires a running Docker, because the app itself
runs as a group of containers. The most common cause of a failing start
is not the launcher but a Docker that is installed yet not currently
running. If Docker is still missing:
[Install Docker Desktop](docker-desktop.md).

Check both before starting the launcher:

### Linux

```bash
docker --version   # is Docker installed?
docker info        # is the daemon actually running?
```

If `docker info` reports a connection error, start the service:

```bash
systemctl status docker    # inspect the state
sudo systemctl start docker
```

If `docker info` only works with `sudo`, your user is missing from the
`docker` group:

```bash
sudo usermod -aG docker $USER
```

Log out and back in afterwards, or the group change does not take
effect.

### macOS

Docker Desktop must be installed **and started** (whale icon visible in
the menu bar). Docker Desktop does not start automatically after a Mac
reboot unless you configured it to in its settings. Confirm in the
terminal:

```bash
docker info
```

### Windows

Docker Desktop (with the WSL2 backend) must be installed and started.
Confirm in PowerShell:

```powershell
docker info
```

If Docker Desktop reports a WSL2 problem, follow its hint; WSL2 is a
requirement of the Docker Desktop backend, not of the launcher itself.

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
