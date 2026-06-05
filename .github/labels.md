# Issue + PR labels

Canonical label taxonomy, adopted 1:1 from
[bibliogon](https://github.com/astrapi69/bibliogon) (which manages
labels manually, not via a `labels.yml`). Documented here so the set is
reproducible. Create a missing label with:

```bash
gh label create "<name>" --color "<hex>" --description "<text>" \
  --repo astrapi69/adaptive-learner
```

## Type

| Label | Color | Meaning |
|-------|-------|---------|
| `bug` | `d73a4a` | Something is broken |
| `enhancement` | `a2eeef` | New feature or request |
| `question` | `d876e3` | Further information is requested |
| `documentation` | `0075ca` | Documentation changes |
| `tech-debt` | `d93f0b` | Known debt to address |

## Area

| Label | Color | Meaning |
|-------|-------|---------|
| `ui` | `c5def5` | User interface and frontend layout |
| `editor` | `bfe5bf` | TipTap editor and related components |
| `tooling` | `fbca04` | Developer tooling and local setup |
| `dependencies` | `0366d6` | Dependency upgrades and tracking |
| `distribution` | `0075ca` | Distribution and packaging |

## Platform

| Label | Color | Meaning |
|-------|-------|---------|
| `linux` | `d4c5f9` | Linux platform |
| `macos` | `d4c5f9` | macOS platform |
| `windows` | `d4c5f9` | Windows platform |

## Process

| Label | Color | Meaning |
|-------|-------|---------|
| `smoke-test` | `e4e669` | Manual smoke test required |
| `needs-repro` | `d876e3` | Needs a reproduction before it can be worked |

Bibliogon's version-history label `pre-v0.21.0` is intentionally NOT
adopted — it is specific to that project's release history.
