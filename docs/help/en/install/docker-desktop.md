# Install Docker Desktop

Adaptive Learner runs as a small set of containers on your own
machine. The desktop launcher starts and stops those containers for
you, but it needs **Docker** to be installed and running first. This
guide walks you through installing Docker Desktop.

## What you need

- About 800 MB of download for Docker Desktop itself.
- About 110-120 MB of download plus roughly 500 MB of disk for the
  Adaptive Learner image on the first run (this happens once; later
  starts are fast and work offline).

## Install

1. Open the official Docker Desktop download page:
   [docs.docker.com/desktop](https://docs.docker.com/desktop/).
2. Download the installer for your operating system (Windows, macOS,
   or Linux).
3. Run the installer and follow the prompts. Accept the defaults
   unless you have a reason to change them.
4. Start Docker Desktop and wait until its whale icon shows
   "Docker Desktop is running".

## Start the launcher

Once Docker Desktop is running, start the Adaptive Learner launcher
again. It checks Docker first, then downloads and starts the app, and
finally offers an "Open in browser" button. Nothing is built on your
machine - the launcher pulls a ready-built, verified image.

If Docker is not yet running when you start the launcher, it shows a
notice with a "Start Docker" button so you can bring it up without
leaving the launcher.

Once running, the app is reachable only from this computer
(`127.0.0.1`) by default. It has no login, so making it reachable
from other devices is a deliberate step - see
[Start the desktop launcher](launcher.md) for how and when to do that.

## Is Docker safe to install?

Yes. Docker Desktop is made by Docker, Inc., a well-known company,
and is used by millions of developers worldwide. It is the standard
way to run containerized applications on a personal computer.

Adaptive Learner uses Docker only to run its own containers on your
machine. Your learning data stays local; nothing about your data is
sent to Docker, Inc. by installing Docker. You can uninstall Docker
Desktop at any time from your operating system, the same as any other
application.

## Troubleshooting

- **The launcher says Docker is not running.** Start Docker Desktop
  and wait for the "running" state, then click "Retry".
- **The port is already in use.** The launcher detects this and
  offers an alternative port; accept the suggestion.
- **Something else went wrong.** Re-run the launcher with the
  `--debug` flag and share the generated `launcher-debug.log`:

  ```bash
  python3 -m adaptive_learner_launcher --debug
  ```
