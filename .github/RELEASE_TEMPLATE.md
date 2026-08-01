# AdaptiveLearner vX.Y.Z

> **Static reference template.** Copy the relevant sections into
> `changelog/releases/vX.Y.Z.md` before invoking
> `gh release create --notes-file ...` (release-workflow.md Step 8).
> No automation reads this file; it exists so every release reuses
> the same prerequisites + verification block instead of being
> rewritten from memory.

## Before you install

AdaptiveLearner runs in Docker. You need Docker Desktop installed and running before starting the launcher.

- [Docker installation guide (English)](https://github.com/astrapi69/adaptive_learner/blob/main/docs/help/en/install/docker-desktop.md) - includes a "Is Docker safe to install?" section
- [Docker-Installationsanleitung (Deutsch)](https://github.com/astrapi69/adaptive_learner/blob/main/docs/help/de/install/docker-desktop.md) - mit Abschnitt "Ist Docker sicher zu installieren?"

The launcher detects Docker, downloads the ready-built AdaptiveLearner image from GitHub's registry (about 110-120 MB compressed, roughly 500 MB on disk - nothing is built on your machine), and opens the app in your browser. Later starts are fast and work offline.

## Download

| Platform | File |
|----------|------|
| Windows | `adaptive-learner-launcher.exe` |
| macOS (Apple silicon) | `adaptive-learner-launcher-macos.zip` |
| Linux | `adaptive-learner-launcher` (ELF binary) |

Each platform also ships a `*.sha256` checksum next to the binary.

## Verifying downloads

```bash
# macOS / Linux
shasum -a 256 adaptive-learner-launcher-<platform>
cat adaptive-learner-launcher-<platform>.sha256
```

```powershell
# Windows
Get-FileHash -Algorithm SHA256 .\adaptive-learner-launcher.exe
Get-Content .\adaptive-learner-launcher.exe.sha256
```

The hashes must match.

**macOS blocks the binary on first open** and, depending on the macOS
version, offers only "Move to Trash" and "Done" - no Open button. The
program is not notarized by Apple (that needs a paid developer account).
Dismiss with **Done**, then open **System Settings > Privacy & Security**,
scroll down and click **Open Anyway**. Windows shows a SmartScreen notice
with a "More info" > "Run anyway" path. Full walkthrough per platform:
[installation overview](https://github.com/astrapi69/adaptive_learner/blob/main/docs/help/en/installation.md).

Verify the checksum first. When the system cannot tell you where a file
came from, a matching checksum is the check you can still make yourself.

## What's new

<!-- Paste the per-version changelog excerpt here. Keep the
"Before you install", "Download", and "Verifying downloads"
sections above unchanged across releases; only the changelog
varies. -->
