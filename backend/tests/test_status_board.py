"""Tests for the generated ecosystem STATUS.md / BOARD.md (#3889).

Every function under test is pure: the GitHub reads are replaced by fixture
snapshots, so no test touches the network (#3870). Each failure class of
``make status-check`` has a seeded counter-probe that must turn red, and the
clean fixture must stay green - a check that cannot fail proves nothing
(gate contract, quality-checks.md #2083).
"""

from __future__ import annotations

import sys
import urllib.error
from datetime import UTC, date, datetime
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from status_board import (  # noqa: E402
    STATUS_REPORT_MARKER,
    Entry,
    FetchError,
    GitHub,
    Issue,
    RepoConfig,
    Snapshot,
    WaitsError,
    _attach_commit_messages,
    build_rows,
    check,
    compute_blocks,
    issue_key,
    last_movement,
    level_of,
    newest_movement,
    normalize_for_compare,
    open_pr_refs,
    parse_repos,
    parse_waits,
    render_board,
    render_status,
    stale_rows,
)
from status_movement import works_on  # noqa: E402

T0 = datetime(2026, 10, 29, 12, 0, tzinfo=UTC)
GEN = datetime(2026, 10, 29, 13, 0, tzinfo=UTC)


def _issue(
    repo: str,
    number: int,
    *,
    labels: tuple[str, ...] = (),
    moved: datetime = T0,
    api_blocked_by: tuple[str, ...] = (),
    prs: tuple[str, ...] = (),
) -> Issue:
    return Issue(
        repo=repo,
        number=number,
        title=f"title {number}",
        url=f"https://github.com/o/{repo}/issues/{number}",
        labels=labels,
        last_movement=moved,
        api_blocked_by=api_blocked_by,
        open_pr_refs=prs,
    )


def _entry(
    key: str,
    waits: str = "nothing",
    *,
    blocked_by: tuple[str, ...] = (),
    checked: date = date(2026, 10, 29),
    needed_by: str | None = None,
) -> Entry:
    return Entry(
        key=key,
        summary=f"summary of {key}",
        waits=waits,
        detail=f"detail of {key}",
        evidence=f"https://github.com/o/{key.replace('#', '/issues/')}",
        checked=checked,
        blocked_by=blocked_by,
        needed_by=needed_by,
    )


REPOS = (
    RepoConfig(name="app", role="the app", release="github"),
    RepoConfig(name="engine", role="the engine", release="tag", npm="engine-pkg"),
)


def _snapshot(issues: list[Issue], **kw) -> Snapshot:
    defaults = dict(
        owner="o",
        repos=REPOS,
        issues={issue_key(i.repo, i.number): i for i in issues},
        closed_keys=frozenset(),
        now_lines=("App: v1.0.0",),
        recent=(),
        ecosystem_repos=("app", "engine"),
        generated_at=GEN,
    )
    defaults.update(kw)
    return Snapshot(**defaults)


def _clean():
    issues = [
        _issue("app", 1, labels=("P1", "bug")),
        _issue("app", 2, labels=("P3",)),
        _issue("engine", 5),
    ]
    entries = {
        "app#1": _entry("app#1"),
        "app#2": _entry("app#2", "issue", blocked_by=("engine#5",)),
        "engine#5": _entry("engine#5", "decision", needed_by="v2.18.0"),
    }
    return _snapshot(issues), entries


def _files(snap: Snapshot, entries: dict[str, Entry], plan: str | None = None) -> tuple[str, str]:
    rows = build_rows(snap, entries)
    return render_board(snap, rows), render_status(snap, rows, plan)


# --- data extraction ---------------------------------------------------------


@pytest.mark.parametrize(
    ("labels", "expected"),
    [
        (("bug", "P2"), "P2"),
        (("P0",), "P0"),
        (("bug",), "none"),
        ((), "none"),
        (("P3", "P1"), "P1"),
    ],
    ids=["one-tier", "p0", "no-tier", "no-labels", "two-tiers-takes-highest"],
)
def test_level_of_reads_the_tier_label(labels, expected):
    assert level_of(labels) == expected


TARGET = ("astrapi69", "app", 5)


def _pr(body: str, *, title: str = "chore: x", repo: str = "astrapi69/app", state: str = "open"):
    return {
        "html_url": f"https://github.com/{repo}/pull/77",
        "state": state,
        "pull_request": {},
        "labels": [],
        "title": title,
        "body": body,
        "repository": {"full_name": repo},
    }


def _xref(source: dict, created_at: str = "2026-10-25T10:00:00Z") -> dict:
    return {"event": "cross-referenced", "created_at": created_at, "source": {"issue": source}}


def test_last_movement_counts_comments_and_commits():
    events = [
        {"event": "labeled", "created_at": "2026-10-28T10:00:00Z"},
        {"event": "commented", "created_at": "2026-10-20T10:00:00Z"},
        {"event": "committed", "committer": {"date": "2026-10-22T09:00:00Z"}},
        {"event": "referenced", "created_at": "2026-10-21T10:00:00Z"},
        {"event": "renamed", "created_at": "2026-10-29T10:00:00Z"},
    ]
    assert last_movement(events, "2026-10-01T00:00:00Z", TARGET) == datetime(
        2026, 10, 22, 9, tzinfo=UTC
    )


def test_last_movement_falls_back_to_creation_when_nothing_moved():
    assert last_movement(
        [{"event": "labeled", "created_at": "2026-10-28T10:00:00Z"}],
        "2026-10-01T00:00:00Z",
        TARGET,
    ) == datetime(2026, 10, 1, tzinfo=UTC)


def test_an_issue_mention_is_not_movement():
    """#3898: #3896 naming #3881 under Related moved nothing on #3881."""
    mention = {
        "html_url": "https://github.com/astrapi69/app/issues/9",
        "state": "open",
        "labels": [],
        "title": "x",
        "body": "Related: #5, Closes #5",
        "repository": {"full_name": "astrapi69/app"},
    }
    events = [{"event": "commented", "created_at": "2026-10-02T10:00:00Z"}, _xref(mention)]
    assert last_movement(events, "2026-10-01T00:00:00Z", TARGET) == datetime(
        2026, 10, 2, 10, tzinfo=UTC
    )


def test_a_pr_that_only_mentions_the_issue_is_not_movement_nor_in_progress():
    events = [
        {"event": "commented", "created_at": "2026-10-02T10:00:00Z"},
        _xref(_pr("The same class as #5, see there.")),
    ]
    assert last_movement(events, "2026-10-01T00:00:00Z", TARGET) == datetime(
        2026, 10, 2, 10, tzinfo=UTC
    )
    assert open_pr_refs(events, TARGET) == ()


@pytest.mark.parametrize(
    ("title", "body"),
    [
        ("chore: x", "Closes #5"),
        ("chore: x", "closes #5"),
        ("chore: x", "Fixes #5"),
        ("chore: x", "Resolved: #5"),
        ("chore: x", "Refs #5"),
        ("chore: x", "Refs #4, #5"),
        ("chore: x", "Refs #4 and #5"),
        ("chore: x", "Closes astrapi69/app#5"),
        ("chore: x", "Refs https://github.com/astrapi69/app/issues/5"),
        ("fix: x, fixes #5", ""),
    ],
    ids=[
        "closes",
        "lower-case",
        "fixes",
        "resolved-colon",
        "refs",
        "refs-list-comma",
        "refs-list-and",
        "cross-repo-form",
        "full-url",
        "in-title",
    ],
)
def test_a_pr_that_works_on_the_issue_is_movement_and_in_progress(title, body):
    events = [_xref(_pr(body, title=title))]
    assert works_on(_pr(body, title=title), TARGET)
    assert last_movement(events, "2026-10-01T00:00:00Z", TARGET) == datetime(
        2026, 10, 25, 10, tzinfo=UTC
    )
    assert open_pr_refs(events, TARGET) == ("https://github.com/astrapi69/app/pull/77",)


@pytest.mark.parametrize(
    ("body", "repo"),
    [
        ("Closes #6", "astrapi69/app"),
        ("Closes astrapi69/other#5", "astrapi69/app"),
        ("Closes #5", "astrapi69/other"),
        ("Refs https://github.com/astrapi69/other/issues/5", "astrapi69/app"),
        ("four fixes from the first runs (#5)", "astrapi69/app"),
    ],
    ids=[
        "other-number",
        "same-number-other-repo",
        "short-ref-means-the-prs-own-repo",
        "url-to-other-repo",
        "keyword-not-followed-by-the-ref",
    ],
)
def test_a_reference_to_another_issue_is_not_work_on_this_one(body, repo):
    assert not works_on(_pr(body, repo=repo), TARGET)


def _commit_ref(
    message: str | None,
    *,
    repo: str = "astrapi69/app",
    created_at: str = "2026-10-25T10:00:00Z",
) -> dict:
    event = {
        "event": "referenced",
        "created_at": created_at,
        "commit_id": "abc123",
        "commit_url": f"https://api.github.com/repos/{repo}/commits/abc123",
    }
    if message is not None:
        event["commit_message"] = message
    return event


def test_a_commit_that_only_mentions_the_issue_is_not_movement():
    """#3902: the squash of #3899 named #3881 and #3896 in its prose."""
    message = "fix(status): only a PR that works on an issue counts (#3898)\n\nSee also #5."
    events = [{"event": "commented", "created_at": "2026-10-02T10:00:00Z"}, _commit_ref(message)]
    assert last_movement(events, "2026-10-01T00:00:00Z", TARGET) == datetime(
        2026, 10, 2, 10, tzinfo=UTC
    )


@pytest.mark.parametrize(
    "message",
    [
        "fix: x\n\nCloses #5",
        "fix: x (refs #5)",
        "fix: x\n\nFixes #4, #5",
        "fix: x\n\nResolves astrapi69/app#5",
        "fix: x\n\nRefs https://github.com/astrapi69/app/issues/5",
    ],
    ids=["closes", "refs-in-subject", "fixes-list", "cross-repo-form", "full-url"],
)
def test_a_commit_that_names_the_issue_as_work_is_movement(message):
    events = [_commit_ref(message)]
    assert last_movement(events, "2026-10-01T00:00:00Z", TARGET) == datetime(
        2026, 10, 25, 10, tzinfo=UTC
    )


def test_a_short_ref_in_another_repositorys_commit_is_not_this_issue():
    events = [_commit_ref("fix: x\n\nCloses #5", repo="astrapi69/other")]
    assert last_movement(events, "2026-10-01T00:00:00Z", TARGET) == datetime(
        2026, 10, 1, tzinfo=UTC
    )


def test_a_commit_without_a_message_is_not_movement():
    """A commit that no longer exists (404 on fetch) carries no message."""
    events = [_commit_ref(None)]
    assert last_movement(events, "2026-10-01T00:00:00Z", TARGET) == datetime(
        2026, 10, 1, tzinfo=UTC
    )


class _FakeCommits:
    """A ``GitHub`` stand-in answering commit reads from a dict (None = 404)."""

    def __init__(self, messages: dict[str, str | None]) -> None:
        self.messages = messages
        self.calls: list[str] = []

    def get_optional(self, path: str):
        self.calls.append(path)
        message = self.messages[path]
        return None if message is None else {"commit": {"message": message}}


def test_attach_commit_messages_reads_only_referenced_commits():
    found = "https://api.github.com/repos/astrapi69/app/commits/a"
    gone = "https://api.github.com/repos/astrapi69/app/commits/b"
    events = [
        {"event": "referenced", "commit_url": found},
        {"event": "commented", "created_at": "2026-10-02T10:00:00Z"},
        {"event": "referenced", "commit_url": gone},
    ]
    gh = _FakeCommits({found: "fix: x\n\nCloses #5", gone: None})
    _attach_commit_messages(gh, events)
    assert gh.calls == [found, gone]
    assert events[0]["commit_message"] == "fix: x\n\nCloses #5"
    assert "commit_message" not in events[1]
    assert "commit_message" not in events[2]


def _fail_with(code: int):
    def request(self, url):
        cause = urllib.error.HTTPError(url, code, "x", {}, None)
        raise FetchError(f"GET {url}: {cause}") from cause

    return request


def test_get_optional_answers_none_for_a_missing_commit(monkeypatch):
    monkeypatch.setattr(GitHub, "_request", _fail_with(404))
    assert GitHub(None).get_optional("repos/o/r/commits/x") is None


def test_get_optional_raises_every_other_failure(monkeypatch):
    monkeypatch.setattr(GitHub, "_request", _fail_with(502))
    with pytest.raises(FetchError):
        GitHub(None).get_optional("repos/o/r/commits/x")


def test_board_own_references_are_not_movement_and_not_in_progress():
    """A PR listing the board's data links every issue; that is not movement (#3889)."""
    board_pr = {
        "html_url": "https://x/pull/3890",
        "state": "open",
        "pull_request": {},
        "labels": [{"name": "status-board"}],
        "body": "| app#1 | ...",
    }
    report = {
        "html_url": "https://x/issues/9",
        "state": "open",
        "labels": [],
        "body": f"findings {STATUS_REPORT_MARKER}",
    }
    events = [
        {"event": "commented", "created_at": "2026-10-02T10:00:00Z"},
        {
            "event": "cross-referenced",
            "created_at": "2026-10-29T10:00:00Z",
            "source": {"issue": board_pr},
        },
        {
            "event": "cross-referenced",
            "created_at": "2026-10-28T10:00:00Z",
            "source": {"issue": report},
        },
    ]
    assert last_movement(events, "2026-10-01T00:00:00Z", TARGET) == datetime(
        2026, 10, 2, 10, tzinfo=UTC
    )
    assert open_pr_refs(events, TARGET) == ()


def test_open_pr_refs_lists_only_open_pull_requests():
    closed = _pr("Closes #5", state="closed")
    closed["html_url"] = "https://github.com/astrapi69/app/pull/78"
    issue = {**_pr("Closes #5"), "html_url": "https://github.com/astrapi69/app/issues/9"}
    del issue["pull_request"]
    events = [_xref(_pr("Closes #5")), _xref(closed), _xref(issue)]
    assert open_pr_refs(events, TARGET) == ("https://github.com/astrapi69/app/pull/77",)


# --- waits.yaml parsing -------------------------------------------------------


def _raw(**fields):
    base = {
        "summary": "s",
        "waits": "nothing",
        "detail": "d",
        "evidence": "https://github.com/o/app/issues/1",
        "checked": "2026-10-29",
    }
    base.update(fields)
    return {"issues": {"app#1": base}}


def test_parse_waits_reads_a_valid_entry():
    entries = parse_waits(_raw(waits="issue", blocked_by=["engine#5"], needed_by="v2"))
    assert entries["app#1"].blocked_by == ("engine#5",)
    assert entries["app#1"].checked == date(2026, 10, 29)
    assert entries["app#1"].needed_by == "v2"


@pytest.mark.parametrize(
    "fields",
    [
        {"waits": "later"},
        {"summary": ""},
        {"detail": None},
        {"evidence": "see issue"},
        {"checked": "yesterday"},
        {"waits": "issue"},
        {"waits": "nothing", "blocked_by": ["engine#5"]},
        {"waits": "issue", "blocked_by": ["engine-5"]},
    ],
    ids=[
        "unknown-waits",
        "empty-summary",
        "missing-detail",
        "evidence-not-a-link",
        "checked-not-a-date",
        "issue-without-blocked-by",
        "blocked-by-without-issue",
        "blocked-by-malformed",
    ],
)
def test_parse_waits_rejects_a_malformed_entry(fields):
    with pytest.raises(WaitsError):
        parse_waits(_raw(**fields))


def test_parse_waits_rejects_a_malformed_key():
    with pytest.raises(WaitsError):
        parse_waits({"issues": {"app-1": _raw()["issues"]["app#1"]}})


def test_parse_repos_requires_a_non_empty_list():
    with pytest.raises(WaitsError):
        parse_repos({"owner": "o", "repos": []})
    config = parse_repos(
        {
            "owner": "o",
            "ecosystem_pattern": "^a",
            "repos": [{"name": "app", "role": "r", "release": "github"}],
        }
    )
    assert config[0] == "o" and config[2][0].name == "app"


# --- merging, inversion, sorting, staleness -----------------------------------


def test_blocks_is_the_inverse_of_yaml_and_api_blocked_by():
    snap = _snapshot(
        [
            _issue("app", 1),
            _issue("app", 2, api_blocked_by=("engine#5",)),
            _issue("engine", 5),
            _issue("app", 3),
        ]
    )
    entries = {
        "app#1": _entry("app#1", "issue", blocked_by=("engine#5",)),
        "app#2": _entry("app#2", "issue", blocked_by=("engine#5",)),
        "engine#5": _entry("engine#5"),
        "app#3": _entry("app#3", "issue", blocked_by=("app#1",)),
    }
    blocks = compute_blocks(build_rows(snap, entries))
    assert blocks == {"engine#5": ("app#1", "app#2"), "app#1": ("app#3",)}


def test_rows_sort_by_level_then_repo_order_then_number():
    snap = _snapshot(
        [
            _issue("engine", 4, labels=("P1",)),
            _issue("app", 9, labels=("P1",)),
            _issue("app", 3),
            _issue("app", 2, labels=("P0",)),
        ]
    )
    entries = {k: _entry(k) for k in snap.issues}
    assert [r.key for r in build_rows(snap, entries)] == ["app#2", "app#9", "engine#4", "app#3"]


def test_stale_means_nothing_to_wait_for_and_quiet_for_more_than_14_days():
    newest = datetime(2026, 10, 29, tzinfo=UTC)
    snap = _snapshot(
        [
            _issue("app", 1, moved=datetime(2026, 10, 14, tzinfo=UTC)),
            _issue("app", 2, moved=datetime(2026, 10, 15, tzinfo=UTC)),
            _issue("app", 3, moved=datetime(2026, 10, 1, tzinfo=UTC)),
            _issue("app", 4, moved=newest),
        ]
    )
    entries = {
        "app#1": _entry("app#1"),
        "app#2": _entry("app#2"),
        "app#3": _entry("app#3", "decision"),
        "app#4": _entry("app#4"),
    }
    rows = build_rows(snap, entries)
    assert newest_movement(snap) == newest
    assert [r.key for r in stale_rows(rows, newest)] == ["app#1"]


# --- rendering -----------------------------------------------------------------


def test_board_groups_issues_and_writes_the_header():
    snap = _snapshot(
        [
            _issue("app", 1, prs=("https://x/pull/7",)),
            _issue("app", 2),
            _issue("engine", 5),
            _issue("app", 6),
        ]
    )
    entries = {
        "app#1": _entry("app#1"),
        "app#2": _entry("app#2", "issue", blocked_by=("engine#5",)),
        "engine#5": _entry("engine#5", "decision"),
        "app#6": _entry("app#6", "external"),
    }
    board = render_board(snap, build_rows(snap, entries))
    sections = board.split("\n---\n")
    titles = [s.strip().split("\n")[0] for s in sections[1:]]
    assert titles == [
        "## In progress",
        "## Doable now",
        "## Waiting only for a decision",
        "## Waiting (external / other issue)",
        "## Stale",
        "## Rules",
    ]
    assert "Generated by `make status` at 2026-10-29 13:00 UTC" in sections[0]
    assert "Issue state as of 2026-10-29 12:00 UTC" in sections[0]
    in_progress, doable, decision, waiting = sections[1], sections[2], sections[3], sections[4]
    assert "summary of app#1" in in_progress and "summary of app#1" not in doable
    decision_row = next(line for line in decision.split("\n") if "summary of engine#5" in line)
    assert decision_row.split("|")[6].strip() == "app#2"
    assert "summary of app#2" in waiting and "summary of app#6" in waiting
    assert "—" not in board and "–" not in board
    assert all(line == line.rstrip() for line in board.split("\n"))
    assert board.endswith("\n") and not board.endswith("\n\n")


def _cells(section: str, needle: str) -> list[str]:
    row = next(line for line in section.split("\n") if needle in line)
    return [cell.strip() for cell in row.split("|")]


def test_the_waiting_table_says_what_each_entry_waits_for_and_by_when():
    snap = _snapshot([_issue("app", 6), _issue("app", 7), _issue("engine", 5)])
    entries = {
        "app#6": _entry("app#6", "external", needed_by="next release (v2.18.0)"),
        "app#7": _entry("app#7", "issue", blocked_by=("engine#5",)),
        "engine#5": _entry("engine#5"),
    }
    sections = render_board(snap, build_rows(snap, entries)).split("\n---\n")
    doable, waiting = sections[2], sections[4]
    assert _cells(waiting, "| Repo")[1:-1] == [
        "Repo",
        "#",
        "Title",
        "Level",
        "Waits for",
        "What",
        "Needed by",
        "Blocks",
        "Last movement",
    ]
    external = _cells(waiting, "summary of app#6")
    assert external[5:8] == ["external", "detail of app#6", "next release (v2.18.0)"]
    blocked = _cells(waiting, "summary of app#7")
    assert blocked[5:8] == ["issue: engine#5", "detail of app#7", "-"]
    assert "What" not in _cells(doable, "| Repo"), "only the waiting table grows"


def test_board_warns_when_more_than_five_issues_are_in_progress():
    issues = [_issue("app", n, prs=(f"https://x/pull/{n}",)) for n in range(1, 7)]
    snap = _snapshot(issues)
    board = render_board(snap, build_rows(snap, {k: _entry(k) for k in snap.issues}))
    assert "more than 5 issues in progress" in board
    snap5 = _snapshot(issues[:5])
    board5 = render_board(snap5, build_rows(snap5, {k: _entry(k) for k in snap5.issues}))
    assert "more than 5 issues in progress" not in board5


def test_status_lists_decisions_with_their_needed_by_and_the_plan():
    snap, entries = _clean()
    _, status = _files(snap, entries)
    assert status.startswith("# STATUS: Adaptive Learner ecosystem\n")
    assert "| engine#5 | detail of engine#5 | v2.18.0 |" in status
    assert "No plan recorded yet." in status
    _, with_plan = _files(snap, entries, plan="1. First the engine.\n")
    assert "1. First the engine." in with_plan and "No plan recorded yet." not in with_plan


def test_status_now_has_at_most_three_lines():
    snap, entries = _clean()
    snap = _snapshot(list(snap.issues.values()), now_lines=("a", "b", "c", "d"))
    with pytest.raises(ValueError):
        _files(snap, entries)


def test_normalize_drops_only_the_generated_at_line():
    text = (
        "# BOARD\n\n> Generated by `make status` at 2026-10-29 13:00 UTC.\n> Issue state as of x\n"
    )
    assert normalize_for_compare(text) == "# BOARD\n\n> Issue state as of x\n"


# --- the check: clean tree green, every failure class red ----------------------


def _check(snap, entries, board=None, status=None, plan=None):
    fresh_board, fresh_status = _files(snap, entries, plan)
    return check(
        snap,
        entries,
        board if board is not None else fresh_board,
        status if status is not None else fresh_status,
        plan,
    )


def test_check_passes_on_a_clean_fixture():
    snap, entries = _clean()
    assert _check(snap, entries) == []


def test_check_still_passes_when_only_the_generation_time_differs():
    snap, entries = _clean()
    board, status = _files(snap, entries)
    later = Snapshot(**{**snap.__dict__, "generated_at": datetime(2026, 10, 30, tzinfo=UTC)})
    assert check(later, entries, board, status, None) == []


def test_check_flags_an_open_issue_without_an_entry():
    snap, entries = _clean()
    del entries["app#1"]
    assert any("app#1" in f and "no entry" in f for f in _check(snap, entries))


def test_check_flags_an_entry_for_a_closed_issue():
    snap, entries = _clean()
    entries["app#99"] = _entry("app#99")
    snap = _snapshot(list(snap.issues.values()), closed_keys=frozenset({"app#99"}))
    assert any("app#99" in f and "closed" in f for f in _check(snap, entries))


def test_check_flags_an_entry_for_an_unknown_issue():
    snap, entries = _clean()
    entries["app#98"] = _entry("app#98")
    assert any("app#98" in f and "unknown" in f for f in _check(snap, entries))


def test_check_flags_movement_after_the_checked_date():
    snap, entries = _clean()
    entries["app#1"] = _entry("app#1", checked=date(2026, 10, 28))
    assert any("app#1" in f and "moved" in f for f in _check(snap, entries))


def test_check_accepts_movement_on_the_checked_day():
    snap, entries = _clean()
    entries["app#1"] = _entry("app#1", checked=date(2026, 10, 29))
    assert _check(snap, entries) == []


@pytest.mark.parametrize("target", ["engine#77", "app#99"], ids=["unknown", "closed"])
def test_check_flags_blocked_by_a_closed_or_unknown_issue(target):
    snap, entries = _clean()
    snap = _snapshot(list(snap.issues.values()), closed_keys=frozenset({"app#99"}))
    entries["app#2"] = _entry("app#2", "issue", blocked_by=(target,))
    assert any("app#2" in f and target in f for f in _check(snap, entries))


def test_check_flags_a_github_blocked_by_that_waits_yaml_does_not_say():
    snap, entries = _clean()
    issues = dict(snap.issues)
    issues["app#1"] = _issue("app", 1, labels=("P1", "bug"), api_blocked_by=("engine#5",))
    snap = _snapshot(list(issues.values()))
    assert any("app#1" in f and "GitHub" in f for f in _check(snap, entries))


def test_check_flags_files_older_than_the_newest_movement():
    snap, entries = _clean()
    old_board, old_status = _files(snap, entries)
    issues = dict(snap.issues)
    issues["engine#5"] = _issue("engine", 5, moved=datetime(2026, 10, 29, 12, 30, tzinfo=UTC))
    moved = _snapshot(list(issues.values()))
    findings = check(moved, entries, old_board, old_status, None)
    assert any("BOARD.md" in f and "older" in f for f in findings)
    assert any("STATUS.md" in f and "older" in f for f in findings)


def test_check_flags_files_that_differ_from_a_fresh_render():
    snap, entries = _clean()
    board, status = _files(snap, entries)
    findings = _check(
        snap,
        entries,
        board=board.replace("summary of app#1", "edited by hand"),
        status=status + "\nextra\n",
    )
    assert any("BOARD.md" in f and "fresh" in f for f in findings)
    assert any("STATUS.md" in f and "fresh" in f for f in findings)


def test_check_flags_a_missing_file():
    snap, entries = _clean()
    assert any("BOARD.md" in f and "missing" in f for f in _check(snap, entries, board=""))


def test_check_flags_an_unlisted_ecosystem_repository():
    snap, entries = _clean()
    snap = _snapshot(list(snap.issues.values()), ecosystem_repos=("app", "engine", "alc-new"))
    assert any("alc-new" in f for f in _check(snap, entries))


def test_report_issue_is_excluded_by_its_marker():
    assert "status-board-report" in STATUS_REPORT_MARKER
