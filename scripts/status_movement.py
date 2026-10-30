"""Which timeline events move an issue on the status board (#3889, #3898, #3902).

Movement is the newest comment, or the newest pull request or commit that
works on the issue: a closing keyword (close, fix, resolve and their forms) or
``Refs`` names it, in a PR's title or body or in a commit's message. A mention
in the prose, a mention from another issue and the board's own references move
nothing. Pure functions over timeline events; ``status_board.py`` fetches them
and attaches each referenced commit's message.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

STATUS_REPORT_MARKER = "<!-- status-board-report (#3889) -->"
REGENERATION_LABEL = "status-board"
MOVEMENT_EVENTS = frozenset({"commented", "referenced", "cross-referenced", "committed"})

# #3898: a PR works on an issue when a closing keyword or "Refs" names it; the
# references may form a list ("Refs #4, #5", "Refs #4 and #5").
_ISSUE_REF = r"(?:https://github\.com/[\w.-]+/[\w.-]+/issues/\d+|(?:[\w.-]+/[\w.-]+)?#\d+)"
WORK_REF_RE = re.compile(
    rf"\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?)\b:?\s+"
    rf"(?P<refs>{_ISSUE_REF}(?:\s*(?:,|\band\b)\s*{_ISSUE_REF})*)",
    re.IGNORECASE,
)
ISSUE_REF_RE = re.compile(
    r"https://github\.com/(?P<url_repo>[\w.-]+/[\w.-]+)/issues/(?P<url_number>\d+)"
    r"|(?P<repo>[\w.-]+/[\w.-]+)?#(?P<number>\d+)"
)


IssueRef = tuple[str, str, int]
"""An issue as (owner, repository, number)."""


def _parse_ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def _is_board_own(event: dict[str, Any]) -> bool:
    """True for a reference made by the board itself.

    A PR labelled ``status-board`` lists every issue it classifies, and the
    nightly report issue names the ones it flags; GitHub records each such
    link as a cross-reference. Counted as movement, one regeneration PR
    would make every issue look fresh and empty the Stale block.
    """
    source = _source(event)
    labels = {label.get("name") for label in source.get("labels") or []}
    return REGENERATION_LABEL in labels or STATUS_REPORT_MARKER in (source.get("body") or "")


def _source(event: dict[str, Any]) -> dict[str, Any]:
    """The issue or pull request a cross-reference comes from (empty if none)."""
    return (event.get("source") or {}).get("issue") or {}


def works_on(source: dict[str, Any], target: IssueRef) -> bool:
    """Whether ``source`` is a pull request that works on ``target`` (#3898).

    It does when a closing keyword (close, fix, resolve and their forms) or
    ``Refs`` in its title or body names the issue. A short ``#N`` means the
    PR's own repository; ``owner/repo#N`` and the full issue URL name another
    one. A mention in the prose, and any mention from an issue, is not work.
    """
    if "pull_request" not in source:
        return False
    own = (source.get("repository") or {}).get("full_name") or ""
    text = f"{source.get('title') or ''}\n{source.get('body') or ''}"
    return names_as_work(text, own, target)


def names_as_work(text: str, own_repo: str, target: IssueRef) -> bool:
    """Whether a closing keyword or ``Refs`` in ``text`` names ``target``.

    A short ``#N`` means ``own_repo``; ``owner/repo#N`` and the full issue URL
    name another one. The shared test of :func:`works_on` and
    :func:`commit_works_on`.
    """
    wanted = (f"{target[0]}/{target[1]}".lower(), target[2])
    for match in WORK_REF_RE.finditer(text):
        for ref in ISSUE_REF_RE.finditer(match.group("refs")):
            if ref.group("url_number"):
                named = (ref.group("url_repo").lower(), int(ref.group("url_number")))
            else:
                named = ((ref.group("repo") or own_repo).lower(), int(ref.group("number")))
            if named == wanted:
                return True
    return False


def commit_works_on(event: dict[str, Any], target: IssueRef) -> bool:
    """Whether a ``referenced`` event's commit works on ``target`` (#3902).

    The same rule as for pull requests: the commit message names the issue
    with a closing keyword or ``Refs``. A mention in its prose is not work, nor
    is a commit whose message could not be fetched (``commit_message`` is
    attached by :func:`_attach_commit_messages`).
    """
    message = event.get("commit_message")
    if not message:
        return False
    return names_as_work(message, _commit_repo(event.get("commit_url") or ""), target)


def _commit_repo(commit_url: str) -> str:
    """``owner/repo`` of an API commit URL (``.../repos/owner/repo/commits/sha``)."""
    parts = commit_url.split("/repos/", 1)[-1].split("/")
    return f"{parts[0]}/{parts[1]}" if len(parts) >= 2 else ""


def last_movement(events: list[dict[str, Any]], created_at: str, target: IssueRef) -> datetime:
    """Return the newest comment, commit or working PR; the creation time if none.

    Label, title and assignment changes are not movement, which is why
    ``updated_at`` is never used; nor are the board's own references. A
    cross-reference counts only from a pull request that works on the issue
    (:func:`works_on`, #3898), a commit reference only from a commit whose
    message does (:func:`commit_works_on`, #3902): a mention from an issue, in
    a PR's prose or in a commit's prose moves nothing.
    """
    stamps = [created_at]
    for event in events:
        kind = event.get("event")
        if kind not in MOVEMENT_EVENTS or _is_board_own(event):
            continue
        if kind == "cross-referenced" and not works_on(_source(event), target):
            continue
        if kind == "referenced" and not commit_works_on(event, target):
            continue
        if kind == "committed":
            stamp = (event.get("committer") or {}).get("date") or (event.get("author") or {}).get(
                "date"
            )
        else:
            stamp = event.get("created_at")
        if stamp:
            stamps.append(stamp)
    return max(_parse_ts(s) for s in stamps)


def open_pr_refs(events: list[dict[str, Any]], target: IssueRef) -> tuple[str, ...]:
    """Return the open pull requests that work on the issue (:func:`works_on`)."""
    refs: list[str] = []
    for event in events:
        if event.get("event") != "cross-referenced" or _is_board_own(event):
            continue
        source = _source(event)
        if works_on(source, target) and source.get("state") == "open":
            url = source.get("html_url", "")
            if url and url not in refs:
                refs.append(url)
    return tuple(refs)
