"""Bold that renders as literal asterisks in the in-app help (#3655).

The in-app help renders the help pages with react-markdown (CommonMark plus
GFM). Whether a ``**`` run opens or closes bold depends on the flanking rule:
the characters directly before and after it. ``カード**「ラベル」**は`` renders
its asterisks, because the opening run sits between a letter and a bracket;
``「**ラベル**」`` is bold. Japanese pages hit this most, since CJK text has no
spaces around bold, but any locale can (an unclosed run, a wrapped line that
starts with ``+ `` and becomes a list item).

This check applies the flanking rule and a pairing pass to every ``**`` run of
every help page, outside fenced code, inline code, HTML comments and escapes,
and models the GFM autolink literal that swallows a ``**`` inside a bare URL.
Measured against mdast-util-from-markdown with GFM on all help pages it found
the same runs, none extra and none missing. Stdlib only, so verify_docs keeps
running before any project environment exists. Runs of other lengths than two
are left to the renderer.

No help page at all is a FAIL (#2287): "could not check" never reads as clean.
"""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path
from typing import Protocol

CHECK = "help-strong-emphasis"
FENCE = re.compile(r"^\s*(```|~~~)")
COMMENT = re.compile(r"<!--.*?-->", re.S)
HEADING = re.compile(r"^\s{0,3}#{1,6}\s+(.*)$")
LIST_ITEM = re.compile(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$")
QUOTE = re.compile(r"^\s*>\s?(.*)$")
BARE_URL = re.compile(r"(?<![(<\w])(?:https?://|www\.)[^\s<]+")
AUTOLINK_TRAILING = "?!.,:*_~"


class _Report(Protocol):
    def fail(self, check: str, message: str, fixed: bool = False) -> None: ...

    def note(self, message: str) -> None: ...


def _is_space(ch: str) -> bool:
    return ch == "" or ch.isspace()


def _is_punct(ch: str) -> bool:
    """CommonMark punctuation: Unicode categories P* and S*."""
    return ch != "" and unicodedata.category(ch)[0] in "PS"


def _inline_blocks(text: str) -> list[tuple[int, str]]:
    """Split a page into inline contexts as ``(first line, text)``.

    Paragraphs (lines joined), list items, headings, blockquotes and table
    cells each form one context; fenced code is skipped.
    """
    blocks: list[tuple[int, str]] = []
    lines_buf: list[str] = []
    start = 0
    in_fence = False

    def flush() -> None:
        nonlocal lines_buf
        if lines_buf:
            blocks.append((start, "\n".join(lines_buf)))
        lines_buf = []

    for number, line in enumerate(text.split("\n"), 1):
        if FENCE.match(line):
            flush()
            in_fence = not in_fence
            continue
        stripped = line.strip()
        if in_fence:
            continue
        if not stripped:
            flush()
        elif stripped.startswith("|"):
            flush()
            blocks += [(number, cell) for cell in stripped.strip("|").split("|")]
        elif heading := HEADING.match(line):
            flush()
            blocks.append((number, heading.group(1)))
        elif item := LIST_ITEM.match(line):
            flush()
            start, lines_buf = number, [item.group(3)]
        else:
            quote = QUOTE.match(line)
            if not lines_buf:
                start = number
            lines_buf.append(quote.group(1) if quote else stripped)
    flush()
    return blocks


def _mask_code(s: str) -> str:
    """Hide inline code, autolinks and escapes, keeping their delimiters.

    The delimiters stay because they are what the flanking rule sees next to
    a ``**`` run (a backtick counts as punctuation, not as space).
    """
    s = re.sub(
        r"(`+)(.+?)\1",
        lambda m: m.group(1) + "x" * len(m.group(2)) + m.group(1),
        s,
        flags=re.S,
    )
    s = re.sub(r"<(https?://[^>]*)>", lambda m: "<" + "x" * len(m.group(1)) + ">", s)
    return s.replace("\\*", "\\x")


def _mask_autolinks(s: str) -> tuple[str, list[int]]:
    """Mask GFM autolink literals; a ``**`` swallowed by one renders literally.

    A bare URL runs to the next whitespace or ``<``; only trailing
    ``?!.,:*_~`` are cut off, so a ``**`` inside the URL is link text.
    """
    swallowed: list[int] = []
    chars = list(s)
    for match in BARE_URL.finditer(s):
        end = match.end()
        while end > match.start() and s[end - 1] in AUTOLINK_TRAILING:
            end -= 1
        span = s[match.start() : end]
        swallowed += [match.start() + run.start() for run in re.finditer(r"\*\*", span)]
        chars[match.start() : end] = "x" * (end - match.start())
    return "".join(chars), swallowed


def _literal_offsets(block: str) -> list[int]:
    """Offsets of the ``**`` runs in one inline context that stay literal."""
    s, literal = _mask_autolinks(_mask_code(block))
    openers: list[int] = []
    for run in re.finditer(r"\*+", s):
        if len(run.group(0)) != 2:
            continue
        before = s[run.start() - 1] if run.start() > 0 else ""
        after = s[run.end()] if run.end() < len(s) else ""
        left = not _is_space(after) and (
            not _is_punct(after) or _is_space(before) or _is_punct(before)
        )
        right = not _is_space(before) and (
            not _is_punct(before) or _is_space(after) or _is_punct(after)
        )
        if right and openers:
            openers.pop()
        elif left:
            openers.append(run.start())
        else:
            literal.append(run.start())
    return literal + openers


def literal_strong_lines(text: str) -> list[int]:
    """Line numbers of every ``**`` run in ``text`` that renders literally.

    Args:
        text: A Markdown page.

    Returns:
        One line number per literal run, ascending.
    """
    text = COMMENT.sub(lambda m: "\n" * m.group(0).count("\n"), text)
    lines: list[int] = []
    for first_line, block in _inline_blocks(text):
        lines += [first_line + block.count("\n", 0, offset) for offset in _literal_offsets(block)]
    return sorted(lines)


def check_strong_emphasis(report: _Report, help_root: Path) -> None:
    """FAIL on every help page line whose bold renders as literal asterisks.

    Args:
        report: The verify_docs report collecting FAILs and notes.
        help_root: ``docs/help``.
    """
    pages = sorted(help_root.glob("*/**/*.md"))
    if not pages:
        report.fail(CHECK, f"no help pages under {help_root} - cannot check (#2287)")
        return
    report.note(f"{CHECK}: scanned {len(pages)} help pages")
    for page in pages:
        rel = page.relative_to(help_root).as_posix()
        for line in sorted(set(literal_strong_lines(page.read_text(encoding="utf-8")))):
            report.fail(CHECK, f"{rel}:{line}: bold renders as literal ** in the in-app help")
