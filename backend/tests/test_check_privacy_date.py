"""A changed privacy policy carries a date no older than its change (#3823).

The policy changed three times in two days (#3809, a register fix, #3805), and
each time the date line in eight files had to be moved by hand. A policy whose
text changes while its date stays is a silent false statement.
``scripts/check_privacy_date.py`` compares every ``legal/privacy.md`` against
the merge base. Tested the way it runs: as a subprocess in a real git repo.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "check_privacy_date.py"

DATE_LINES = {
    "de": ("Stand: {d}. Oktober 2026", "Stand: {d}. November 2026"),
    "en": ("Last updated: {d} October 2026", "Last updated: {d} November 2026"),
    "es": (
        "Última actualización: {d} de octubre de 2026",
        "Última actualización: {d} de noviembre de 2026",
    ),
    "fr": ("Dernière mise à jour : {d} octobre 2026", "Dernière mise à jour : {d} novembre 2026"),
    "pt": (
        "Última atualização: {d} de outubro de 2026",
        "Última atualização: {d} de novembro de 2026",
    ),
    "el": ("Τελευταία ενημέρωση: {d} Οκτωβρίου 2026", "Τελευταία ενημέρωση: {d} Νοεμβρίου 2026"),
    "ja": ("最終更新日: 2026年10月{d}日", "最終更新日: 2026年11月{d}日"),
    "tr": ("Son güncelleme: {d} Ekim 2026", "Son güncelleme: {d} Kasım 2026"),
}


def _env(root: Path) -> dict[str, str]:
    home = root / "home"
    home.mkdir(exist_ok=True)
    return {
        "PATH": os.environ["PATH"],
        "HOME": str(home),
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_AUTHOR_NAME": "Test",
        "GIT_AUTHOR_EMAIL": "test@example.invalid",
        "GIT_COMMITTER_NAME": "Test",
        "GIT_COMMITTER_EMAIL": "test@example.invalid",
    }


def _git(repo: Path, *args: str, when: str = "2026-10-20T10:00:00") -> str:
    env = _env(repo.parent) | {"GIT_AUTHOR_DATE": when, "GIT_COMMITTER_DATE": when}
    return subprocess.run(
        ["git", *args], cwd=repo, env=env, check=True, capture_output=True, text=True
    ).stdout.strip()


def _policy(lang: str, date_line: str, body: str) -> str:
    return f"# Privacy\n\n{date_line}\n\n{body}\n"


def _write(repo: Path, rel: str, text: str) -> None:
    path = repo / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _commit(repo: Path, message: str, when: str) -> None:
    _git(repo, "add", "-A")
    _git(repo, "-c", "commit.gpgsign=false", "commit", "-q", "-m", message, when=when)


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A repo whose develop holds all eight policies dated 20 October 2026."""
    work = tmp_path / "work"
    work.mkdir()
    _git(work, "init", "-q", "-b", "develop")
    for lang, (october, _) in DATE_LINES.items():
        _write(
            work,
            f"docs/help/{lang}/legal/privacy.md",
            _policy(lang, october.format(d=20), "Old text."),
        )
    _write(work, "docs/help/de/user-guide/faq.md", "# FAQ\n\nOld.\n")
    _commit(work, "base", "2026-10-20T10:00:00")
    _git(work, "switch", "-q", "-c", "feature")
    return work


def _check(repo: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["python3", str(SCRIPT), "--base", "develop", *args],
        cwd=repo,
        env=_env(repo.parent),
        capture_output=True,
        text=True,
    )


@pytest.mark.parametrize("lang", sorted(DATE_LINES))
def test_a_body_change_under_an_unchanged_date_fails(repo: Path, lang: str) -> None:
    october, _ = DATE_LINES[lang]
    _write(
        repo, f"docs/help/{lang}/legal/privacy.md", _policy(lang, october.format(d=20), "New text.")
    )
    _commit(repo, "change", "2026-11-02T10:00:00")

    result = _check(repo, "--head", "HEAD")

    assert result.returncode == 1, result.stdout + result.stderr
    assert f"docs/help/{lang}/legal/privacy.md" in result.stdout


@pytest.mark.parametrize("lang", sorted(DATE_LINES))
def test_a_body_change_with_the_date_of_the_change_passes(repo: Path, lang: str) -> None:
    _, november = DATE_LINES[lang]
    _write(
        repo, f"docs/help/{lang}/legal/privacy.md", _policy(lang, november.format(d=2), "New text.")
    )
    _commit(repo, "change", "2026-11-02T10:00:00")

    result = _check(repo, "--head", "HEAD")

    assert result.returncode == 0, result.stdout + result.stderr
    assert "1 changed privacy polic" in result.stdout


def test_a_second_change_on_the_same_day_keeps_its_date(repo: Path) -> None:
    """Two edits on 2 November: the second leaves the already current date."""
    _, november = DATE_LINES["de"]
    path = "docs/help/de/legal/privacy.md"
    _write(repo, path, _policy("de", november.format(d=2), "First edit."))
    _commit(repo, "first", "2026-11-02T09:00:00")
    _write(repo, path, _policy("de", november.format(d=2), "Second edit."))
    _commit(repo, "second", "2026-11-02T17:00:00")

    assert _check(repo, "--head", "HEAD").returncode == 0


def test_a_date_only_change_passes(repo: Path) -> None:
    _, november = DATE_LINES["en"]
    _write(repo, "docs/help/en/legal/privacy.md", _policy("en", november.format(d=2), "Old text."))
    _commit(repo, "date", "2026-11-02T10:00:00")

    assert _check(repo, "--head", "HEAD").returncode == 0


def test_an_unreadable_date_fails(repo: Path) -> None:
    _write(repo, "docs/help/en/legal/privacy.md", _policy("en", "Last updated: soon", "New text."))
    _commit(repo, "broken date", "2026-11-02T10:00:00")

    result = _check(repo, "--head", "HEAD")

    assert result.returncode == 1
    assert "date" in result.stdout


def test_a_file_outside_legal_is_ignored(repo: Path) -> None:
    _write(repo, "docs/help/de/user-guide/faq.md", "# FAQ\n\nNew.\n")
    _commit(repo, "faq", "2026-11-02T10:00:00")

    result = _check(repo, "--head", "HEAD")

    assert result.returncode == 0
    assert "0 changed privacy polic" in result.stdout


def test_an_uncommitted_change_is_checked_against_today(repo: Path) -> None:
    october, _ = DATE_LINES["fr"]
    _write(repo, "docs/help/fr/legal/privacy.md", _policy("fr", october.format(d=20), "New text."))

    result = _check(repo)

    assert result.returncode == 1
    assert "docs/help/fr/legal/privacy.md" in result.stdout


def test_a_base_that_does_not_resolve_cannot_check(repo: Path) -> None:
    result = subprocess.run(
        ["python3", str(SCRIPT), "--base", "no-such-branch", "--head", "HEAD"],
        cwd=repo,
        env=_env(repo.parent),
        capture_output=True,
        text=True,
    )

    assert result.returncode == 2
    assert "cannot check" in result.stdout + result.stderr
