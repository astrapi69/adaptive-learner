"""One term per concept in the help pages and the help glossary (#3433).

The German help said "Session" and "Streak" while the app said "Sitzung" and
"Serie"; Japanese help said ストリーク next to the app's 連続記録. The term
decisions live in one table, ``frontend/src/data/i18n-terms.json``: the
catalogs are checked against it by ``frontend/src/data/i18n/terms.test.ts``,
the help by this check. verify_docs runs on every PR, so a help-only PR (which
never starts the Vitest step) is checked as well.

Scope per language: the help glossary ``backend/config/help/*.<lang>.yaml``
and the pages ``docs/help/<lang>/**/*.md``, except

- ``developer/`` and ``api/``: contributor reference, where "Session" names
  the code (``LearningSession``, ``/api/sessions``), not the learner's term;
- ``changelog.md``: release history, quoted as it shipped.

Fenced code, inline code, HTML comments and ``{placeholders}`` are not prose
and are skipped. Python's ``\\b`` is Unicode-aware where JavaScript's is ASCII
only; the table's patterns do not depend on the difference.

No table, or a language with a help tree but no scanned file, is a FAIL
(#2287): "could not check" never reads as clean. Stdlib only.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

CHECK = "help-terms"
TABLE = Path("frontend/src/data/i18n-terms.json")
EXCLUDED_DIRS = {"developer", "api"}
EXCLUDED_FILES = {"changelog.md"}
FENCE = re.compile(r"^\s*(```|~~~)")
INLINE_CODE = re.compile(r"`[^`\n]*`")
COMMENT = re.compile(r"<!--.*?-->", re.S)
PLACEHOLDER = re.compile(r"\{[^}\n]*\}")


class _Report(Protocol):
    def fail(self, check: str, message: str, fixed: bool = False) -> None: ...

    def note(self, message: str) -> None: ...


@dataclass(frozen=True)
class TermHit:
    """One rejected term in a text: line number, the matched text, the rule."""

    line: int
    found: str
    preferred: str
    issue: str


def _compile(rules: list[dict[str, str]]) -> list[tuple[re.Pattern[str], dict[str, str]]]:
    compiled = []
    for rule in rules:
        flags = re.IGNORECASE if "i" in rule.get("flags", "") else 0
        compiled.append((re.compile(rule["rejected"], flags), rule))
    return compiled


def _prose_lines(text: str) -> list[tuple[int, str]]:
    """Lines of ``text`` with code, comments and placeholders removed."""
    text = COMMENT.sub(lambda m: "\n" * m.group(0).count("\n"), text)
    out: list[tuple[int, str]] = []
    in_fence = False
    for number, line in enumerate(text.split("\n"), 1):
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        out.append((number, PLACEHOLDER.sub("", INLINE_CODE.sub("", line))))
    return out


def rejected_terms(text: str, rules: list[dict[str, str]]) -> list[TermHit]:
    """Every use of a rejected term in the prose of ``text``.

    Args:
        text: A help page or glossary file.
        rules: Rows of the term table for the file's language.

    Returns:
        One hit per match, in line order.
    """
    compiled = _compile(rules)
    hits: list[TermHit] = []
    for number, line in _prose_lines(text):
        for pattern, rule in compiled:
            for match in pattern.finditer(line):
                hits.append(TermHit(number, match.group(0), rule["preferred"], rule["issue"]))
    return hits


def _help_files(repo: Path, lang: str) -> tuple[bool, list[Path]]:
    """Whether ``lang`` has any help, and the files this check covers."""
    glossary = sorted((repo / "backend" / "config" / "help").glob(f"*.{lang}.yaml"))
    page_root = repo / "docs" / "help" / lang
    pages = []
    for page in sorted(page_root.glob("**/*.md")):
        parts = page.relative_to(page_root).parts
        if page.name in EXCLUDED_FILES or EXCLUDED_DIRS.intersection(parts[:-1]):
            continue
        pages.append(page)
    return bool(glossary) or page_root.is_dir(), glossary + pages


def check_help_terms(report: _Report, repo: Path) -> None:
    """FAIL on a rejected term in the help prose of any language in the table."""
    table_path = repo / TABLE
    try:
        table = json.loads(table_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        report.fail(CHECK, f"cannot read the term table {TABLE}: {exc} (basis missing; #2287)")
        return
    counts: dict[str, int] = {}
    for lang, rules in table.items():
        has_help, files = _help_files(repo, lang)
        if not has_help:
            report.note(f"{CHECK}: {lang} has no help pages or glossary")
            continue
        if not files:
            report.fail(CHECK, f"{lang}: no help files found to check (basis missing; #2287)")
            continue
        counts[lang] = len(files)
        for path in files:
            rel = path.relative_to(repo).as_posix()
            for hit in rejected_terms(path.read_text(encoding="utf-8"), rules):
                report.fail(
                    CHECK, f'{rel}:{hit.line}: "{hit.found}" (use "{hit.preferred}", {hit.issue})'
                )
    per_lang = ", ".join(f"{lang} {n}" for lang, n in counts.items())
    report.note(
        f"{CHECK}: scanned {sum(counts.values())} files ({per_lang}) "
        "excl. developer/, api/, changelog.md"
    )
