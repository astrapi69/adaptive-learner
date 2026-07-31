"""Gate-contract tests for scripts/verify_doc_refs.py (#2254).

Docs may only NAME things that exist. Three same-day precedents (2026-07-31)
of the same class - documentation referencing a nameable, checkable thing
that the repository does not contain:

1. the constant ``LICENSING_ENABLED`` in seven locale help pages
   (state ``6b424f11~1``, fixed by #2252/#2096),
2. seven make targets presented as real inside a ``makefile`` fence in the
   condensed ``76a6b994:.claude/rules/quality-checks.md`` (#2081 family),
3. the dead path ``backend/tests/test_plugin_lock_drift_hook.py`` asserted
   as existing by ``lessons/backend.md`` (#1903 family).

The suite runs the script as a subprocess against throwaway git repos
(the interface the Makefile and pre-commit use; the scan enumerates the
git index, so the tests control that context). Five-point gate contract:
detects, clean pass, fails closed, reports the measured set, and the
number means the same thing everywhere. The three precedent fixtures are
verbatim excerpts of the historical states (embedded, not `git show` at
runtime - CI checkouts may be shallow).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "verify_doc_refs.py"

MAKEFILE = """\
test:
\techo test
check-types:
\techo types
sync-versions:
\techo sync
"""


def _git(root: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)


def _repo(root: Path) -> Path:
    """A minimal repo: Makefile with real targets, some code, a docs tree."""
    _git(root, "init", "-q")
    (root / "Makefile").write_text(MAKEFILE, encoding="utf-8")
    backend = root / "backend" / "app"
    backend.mkdir(parents=True)
    (backend / "config.py").write_text(
        'RATE_LIMIT_ENABLED = True\nADAPTIVE_LEARNER_DEBUG = "env"\n', encoding="utf-8"
    )
    docs = root / "docs"
    docs.mkdir()
    return docs


def _track(root: Path) -> None:
    _git(root, "add", "-A")


def _baseline(root: Path, count: int) -> Path:
    p = root / "docs" / ".doc-refs-baseline.json"
    p.write_text(json.dumps({"broken_ref_count": count}), encoding="utf-8")
    return p


def _run(root: Path, *extra: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--root", str(root), *extra],
        capture_output=True,
        text=True,
    )


# --- 1. detects each violation class -----------------------------------------


def test_detects_a_missing_make_target(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "guide.md").write_text("Run `make not-a-target` before pushing.", encoding="utf-8")
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0, r.stdout
    assert "not-a-target" in r.stdout


def test_detects_a_dead_repo_path(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "guide.md").write_text("See `backend/app/gone_forever.py` for details.", encoding="utf-8")
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0, r.stdout
    assert "gone_forever" in r.stdout


def test_detects_an_unknown_constant(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "guide.md").write_text("Toggle `TOTALLY_FAKE_FLAG` to enable it.", encoding="utf-8")
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0, r.stdout
    assert "TOTALLY_FAKE_FLAG" in r.stdout


# --- 2. passes on a clean tree ------------------------------------------------


def test_clean_tree_passes(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "guide.md").write_text(
        "Run `make test` then `make check-types`. Config lives in\n"
        "`backend/app/config.py`; `RATE_LIMIT_ENABLED` and\n"
        "`ADAPTIVE_LEARNER_DEBUG` control it. Snippets like\n"
        "`poetry run pytest -x` and values like `0.21.0` are not judged.\n",
        encoding="utf-8",
    )
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode == 0, r.stdout + r.stderr


# --- 3. the three precedents, each individually RED ---------------------------

# Verbatim excerpt of docs/help/en/developer/architecture.md at 6b424f11~1.
PRECEDENT_CONSTANT = """\
- All plugins are free (MIT). The licensing infrastructure
  exists but is dormant (`LICENSING_ENABLED = False`).
"""

# Verbatim excerpt of .claude/rules/quality-checks.md at 76a6b994 - a
# ``makefile`` fence presenting seven targets that do not exist.
PRECEDENT_MAKE_BLOCK = """\
## Makefile Targets for Quality Checks

```makefile
check-all: test check-types
\t@echo "All checks passed."

test-all: test test-frontend
\t@echo "All tests passed."

mutmut-backend:
\tcd backend && poetry run mutmut run

mutmut-export:
\tcd plugins/adaptive-learner-plugin-export && poetry run mutmut run

mutmut-results:
\tcd backend && poetry run mutmut results

mutmut-html:
\tcd backend && poetry run mutmut html

stryker-api:
\tcd frontend && bunx stryker run --mutate "src/api/**/*.ts"
```
"""

# Verbatim claim from .claude/rules/lessons/backend.md (live until #2254).
PRECEDENT_DEAD_PATH = """\
Verified by 6 hook self-check tests in
`backend/tests/test_plugin_lock_drift_hook.py` (commit `e31c4fd`),
all green at 0.22 s.
"""


def test_precedent_1_licensing_constant_is_red(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "architecture.md").write_text(PRECEDENT_CONSTANT, encoding="utf-8")
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0, r.stdout
    assert "LICENSING_ENABLED" in r.stdout


def test_precedent_2_condensed_make_targets_are_red(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "quality-checks.md").write_text(PRECEDENT_MAKE_BLOCK, encoding="utf-8")
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0, r.stdout
    for target in (
        "check-all",
        "test-all",
        "mutmut-backend",
        "mutmut-export",
        "mutmut-results",
        "mutmut-html",
        "stryker-api",
    ):
        assert target in r.stdout, f"claimed target {target} not flagged"


def test_precedent_3_dead_rule_path_is_red(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "backend-lessons.md").write_text(PRECEDENT_DEAD_PATH, encoding="utf-8")
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0, r.stdout
    assert "test_plugin_lock_drift_hook.py" in r.stdout


# --- 4. fails CLOSED when its basis is missing --------------------------------


def test_fails_closed_without_a_makefile(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (tmp_path / "Makefile").unlink()
    (docs / "guide.md").write_text("Run `make test`.", encoding="utf-8")
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0
    assert "fail-closed" in r.stdout


def test_fails_closed_without_a_baseline(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "guide.md").write_text("Run `make test`.", encoding="utf-8")
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0
    assert "fail-closed" in r.stdout


def test_fails_closed_outside_a_git_repo(tmp_path: Path) -> None:
    (tmp_path / "Makefile").write_text(MAKEFILE, encoding="utf-8")
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "guide.md").write_text("Run `make test`.", encoding="utf-8")
    (docs / ".doc-refs-baseline.json").write_text(
        json.dumps({"broken_ref_count": 0}), encoding="utf-8"
    )
    r = _run(tmp_path)
    assert r.returncode != 0
    assert "fail-closed" in r.stdout


def test_fails_closed_on_zero_scanned_documents(tmp_path: Path) -> None:
    _repo(tmp_path)  # docs dir exists but holds no tracked .md
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0
    assert "fail-closed" in r.stdout


# --- 5. reports WHAT it measured ----------------------------------------------


def test_reports_the_measured_set(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "a.md").write_text(
        "`make test` and `backend/app/config.py` and `RATE_LIMIT_ENABLED`.",
        encoding="utf-8",
    )
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode == 0, r.stdout
    assert "scanned 1 tracked doc" in r.stdout
    assert "make-targets: 1" in r.stdout
    assert "paths: 1" in r.stdout
    assert "constants: 1" in r.stdout


# --- 6. the error-counter ratchet (three-way distinction, #2235) --------------


def test_a_rise_fails_even_with_auto_lower(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "guide.md").write_text("`make nope-one` and `make nope-two`.", encoding="utf-8")
    _track(tmp_path)
    baseline = _baseline(tmp_path, 1)
    _track(tmp_path)
    r = _run(tmp_path, "--auto-lower")
    assert r.returncode != 0
    assert "rose" in r.stdout
    assert json.loads(baseline.read_text())["broken_ref_count"] == 1  # untouched


def test_a_fall_is_banked_by_auto_lower(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "guide.md").write_text("All clean: `make test`.", encoding="utf-8")
    _track(tmp_path)
    baseline = _baseline(tmp_path, 3)
    _track(tmp_path)
    r = _run(tmp_path, "--auto-lower")
    assert r.returncode == 0, r.stdout
    assert json.loads(baseline.read_text())["broken_ref_count"] == 0
    assert _run(tmp_path).returncode == 0  # green against the banked number


def test_an_unbanked_fall_fails_readonly(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "guide.md").write_text("All clean: `make test`.", encoding="utf-8")
    _track(tmp_path)
    _baseline(tmp_path, 3)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0
    assert "fell" in r.stdout


# --- 7. a foreign-repo link label is not a claim about this repo (#2261) ------


def test_label_of_a_foreign_repo_link_is_not_judged(tmp_path: Path) -> None:
    """`[`docs/X.md`](https://github.com/other/repo/blob/main/docs/X.md)` names
    a file in ANOTHER repository - the URL says so. This repo cannot be asked
    to contain it (the fifth look-alike class, found in the #2254 inherited
    findings: every user-facing entry was one of these)."""
    docs = _repo(tmp_path)
    (docs / "guide.md").write_text(
        "See [`docs/GETTING-STARTED.md`]"
        "(https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)\n"
        "but `docs/really-missing.md` on its own is judged.\n",
        encoding="utf-8",
    )
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0, r.stdout
    assert "really-missing" in r.stdout
    assert "GETTING-STARTED" not in r.stdout


def test_a_relative_link_label_is_still_judged(tmp_path: Path) -> None:
    """Only an ABSOLUTE url delegates the claim elsewhere; a relative link
    still points inside this repo."""
    docs = _repo(tmp_path)
    (docs / "guide.md").write_text(
        "See [`docs/gone.md`](gone.md) for details.\n", encoding="utf-8"
    )
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0
    assert "gone.md" in r.stdout


# --- 7. exemptions are single-line, named, never blanket ----------------------


def test_inline_exemption_skips_exactly_that_line(tmp_path: Path) -> None:
    docs = _repo(tmp_path)
    (docs / "guide.md").write_text(
        "A documented counter-example: `backend/tests/removed_file.py`"
        " <!-- doc-ref-exempt: dead path cited as the incident's example -->\n"
        "But `make still-fake` on another line is judged.\n",
        encoding="utf-8",
    )
    _track(tmp_path)
    _baseline(tmp_path, 0)
    _track(tmp_path)
    r = _run(tmp_path)
    assert r.returncode != 0
    assert "still-fake" in r.stdout
    assert "removed_file" not in r.stdout
