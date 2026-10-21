"""No shipped text promises that no personal data is sent (#3812).

Two AI dialogs told the learner "No personal data is transmitted" in all 11
catalogs, and the Japanese FAQ said the learning profile and other personal
data never reach the AI provider. Neither is true: the browser calls the
provider directly, so every request carries the learner's IP address and API
key, the session prompt carries the learning project, the lesson progress and
the recent mistakes, and text the learner wrote can itself be personal. The
owner decided on 2026-10-20 that the app states what leaves the device
instead of promising what does not.

This check FAILs on such a promise, in every catalog language, in:

- the catalogs: ``backend/config/i18n/*.yaml`` and the generated
  ``frontend/src/data/i18n/**/*.json``;
- the help glossary: ``backend/config/help/*.yaml`` and its generated copy
  ``frontend/src/data/help/*.json``;
- the help pages ``docs/help/**/*.md`` and every other ``docs/**/*.md``;
- the Markdown files at the repository root (README, CONTRIBUTING, ...);
- the UI sources ``frontend/src/**/*.ts(x)``, where the ``t()`` fallbacks
  live; test files are not shipped and are left out.

Exempt are the historical records, which keep what was true when they were
written: ``docs/explorations/``, ``docs/review/``, ``docs/journal/``,
``docs/roadmap-archive/`` and the help ``changelog.md`` pages.

In Markdown, fenced code, inline code and HTML comments are not prose and are
skipped. A pattern may span a line break (help pages wrap their lines); the
finding names the line where the promise starts. A required group without a
file is a FAIL (#2287): "could not check" never reads as clean. Stdlib only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

CHECK = "privacy-promises"
ISSUE = "#3812"

HISTORICAL = (
    "docs/explorations/",
    "docs/review/",
    "docs/journal/",
    "docs/roadmap-archive/",
)
HISTORICAL_PAGES = ("changelog.md",)

# The gap between the subject and the verb never crosses a sentence end.
_GAP = r"[^.!?。！？।]{0,60}?"

PROMISE_PATTERNS: dict[str, tuple[str, ...]] = {
    "de": (
        r"\bkeine\s+(?:persönlichen|personenbezogenen)\s+Daten\b"
        + _GAP
        + r"\b(?:gesendet|übermittelt|übertragen|verschickt|geschickt|hochgeladen)",
        r"\b(?:persönliche|personenbezogene)\s+Daten\s+(?:werden|wird)\s+(?:nie|niemals|nicht)\s+"
        r"(?:gesendet|übermittelt|übertragen|verschickt|geschickt|hochgeladen)",
        r"\b(?:sendet|übermittelt|überträgt|schickt)\s+(?:keine|nie|niemals)\s+"
        r"(?:persönlichen|personenbezogenen)\s+Daten",
    ),
    "el": (
        r"\bδεν\s+(?:μεταδίδονται|μεταβιβάζονται|αποστέλλονται|στέλνονται|διαβιβάζονται)\s+"
        r"(?:κανένα\s+)?προσωπικά\s+δεδομένα",
        r"\bπροσωπικά\s+δεδομένα\s+δεν\s+"
        r"(?:μεταδίδονται|μεταβιβάζονται|αποστέλλονται|στέλνονται|διαβιβάζονται)",
        r"\bδεν\s+(?:στέλνει|στέλνουμε|μεταδίδει|αποστέλλει|μεταβιβάζει)\s+"
        r"(?:κανένα\s+)?προσωπικά\s+δεδομένα",
    ),
    "en": (
        r"\bno\s+personal\s+(?:data|information)\b"
        + _GAP
        + r"\b(?:is|are|will\s+be|gets?)\s+(?:ever\s+)?(?:sent|transmitted|transferred|uploaded)",
        r"\b(?:not|never|n't)\s+(?:be\s+)?"
        r"(?:send|sends|sent|transmit|transmits|transmitted|transfer|transfers|transferred"
        r"|upload|uploads|uploaded)\s+(?:any\s+|your\s+)?personal\s+(?:data|information)",
        r"\bpersonal\s+(?:data|information)\s+(?:is|are|will\s+be)\s+(?:never|not)\s+(?:be\s+)?"
        r"(?:sent|transmitted|transferred|uploaded)",
    ),
    "es": (
        r"\bno\s+se\s+(?:transmiten|envían|envian|transfieren|suben)\s+(?:ningún\s+|tus\s+)?"
        r"datos\s+personales",
        r"\bningún\s+dato\s+personal\b"
        + _GAP
        + r"\b(?:se\s+)?(?:transmite|envía|envia|enviará|transfiere|transmitirá)",
        r"\bdatos\s+personales\s+no\s+se\s+(?:transmiten|envían|envian|transfieren)",
        r"\bno\s+(?:envía|envia|transmite|transfiere)\s+(?:ningún\s+dato\s+personal|datos\s+personales)",
    ),
    "fr": (
        r"\baucune\s+donnée\s+personnelle\b"
        + _GAP
        + r"\b(?:n['’]est|ne\s+sera|ne\s+sont)\s+(?:\w+\s+)?(?:transmise|envoyée|transférée)",
        r"\b(?:n['’](?:envoie|envoyons)|ne\s+(?:transmet|transmettons|envoie|transfère))\s+"
        r"(?:aucune\s+donnée\s+personnelle|pas\s+(?:de|vos|tes)\s+données\s+personnelles)",
        r"\bdonnées\s+personnelles\s+ne\s+(?:sont|seront)\s+(?:pas|jamais)\s+"
        r"(?:transmises|envoyées|transférées)",
    ),
    "hi": (
        r"कोई\s+(?:भी\s+)?(?:व्यक्तिगत|निजी)\s+(?:डेटा|जानकारी)(?=[^।!?]{0,40}?नहीं)"
        r"[^।!?]{0,40}?(?:प्रेषित|भेज)",
    ),
    "id": (
        r"\btidak\s+ada\s+data\s+pribadi\b"
        + _GAP
        + r"\b(?:dikirim|dikirimkan|ditransmisikan|ditransfer)",
        r"\bdata\s+pribadi\s+(?:tidak|tak)\s+(?:akan\s+)?(?:pernah\s+)?"
        r"(?:dikirim|dikirimkan|ditransmisikan|ditransfer)",
        r"\btidak\s+(?:mengirim|mengirimkan)\s+data\s+pribadi",
    ),
    "ja": (
        r"個人(?:データ|情報)(?:は|を|が|も)[^。！？]{0,30}?(?:送信|転送|送付|伝送)(?:され|し)(?:ません|ない)",
    ),
    "ko": (
        r"개인\s*(?:데이터|정보)(?:는|은|가|이|를|도)?[^.。!?]{0,30}?(?:전송|송신|전달)(?:되지|하지)\s*않",
    ),
    "pt": (
        r"\bnenhum\s+dado\s+pessoal\b"
        + _GAP
        + r"\b(?:é|será|e)\s+(?:transmitido|enviado|transferido)",
        r"\bdados\s+pessoais\s+não\s+(?:são|serão)\s+(?:transmitidos|enviados|transferidos)",
        r"\bnão\s+(?:envia|transmite|transfere)\s+(?:nenhum\s+dado\s+pessoal|dados\s+pessoais)",
    ),
    "tr": (
        r"\bhiçbir\s+kişisel\s+(?:veri|bilgi)\b"
        + _GAP
        + r"(?:iletilmez|gönderilmez|aktarılmaz|iletilmeyecek|gönderilmeyecek)",
        r"\bkişisel\s+(?:veri|bilgi)(?:ler)?(?:iniz)?\s+(?:asla\s+)?"
        r"(?:iletilmez|gönderilmez|aktarılmaz|iletilmeyecek|gönderilmeyecek)",
    ),
}

_COMPILED = [
    (lang, re.compile(pattern, re.IGNORECASE))
    for lang, patterns in PROMISE_PATTERNS.items()
    for pattern in patterns
]

# Every pattern names personal data, so a text without one of these stems
# cannot hold a promise; skipping it keeps the scan of the UI sources fast.
STEMS = (
    "personal",
    "persönlich",
    "personenbezogen",
    "personnel",
    "pesso",
    "προσωπικ",
    "kişisel",
    "個人",
    "개인",
    "व्यक्तिगत",
    "निजी",
    "pribadi",
)

_FENCE = re.compile(r"^[ \t]*(```|~~~).*?^[ \t]*\1[^\n]*$", re.M | re.S)
_COMMENT = re.compile(r"<!--.*?-->", re.S)
_INLINE_CODE = re.compile(r"`[^`\n]*`")

_UI_SOURCE_SUFFIXES = (".ts", ".tsx")
_TEST_MARKERS = (".test.", ".spec.")


class _Report(Protocol):
    def fail(self, check: str, message: str, fixed: bool = False) -> None: ...

    def note(self, message: str) -> None: ...


@dataclass(frozen=True)
class PromiseHit:
    """One promise in a text: the line it starts on, the matched words, the language."""

    line: int
    found: str
    lang: str


def _blank(match: re.Match[str]) -> str:
    """Replace a match by spaces, keeping its line breaks so line numbers hold."""
    return re.sub(r"[^\n]", " ", match.group(0))


def _markdown_prose(text: str) -> str:
    """``text`` with fenced code, HTML comments and inline code blanked out."""
    for pattern in (_FENCE, _COMMENT, _INLINE_CODE):
        text = pattern.sub(_blank, text)
    return text


def promise_hits(text: str, markdown: bool = False) -> list[PromiseHit]:
    """Every promise that no personal data is sent, in ``text``.

    Args:
        text: A catalog, glossary, help page or source file.
        markdown: Skip fenced code, inline code and HTML comments.

    Returns:
        One hit per promise, in text order; where patterns of several
        languages or several patterns of one language overlap, the first
        match wins.
    """
    lowered = text.lower()
    if not any(stem in lowered for stem in STEMS):
        return []
    prose = _markdown_prose(text) if markdown else text
    matches = sorted(
        (
            (match.start(), match.end(), lang, match.group(0))
            for lang, pattern in _COMPILED
            for match in pattern.finditer(prose)
        ),
        key=lambda found: (found[0], -found[1]),
    )
    hits: list[PromiseHit] = []
    covered_until = -1
    for start, end, lang, found in matches:
        if start < covered_until:
            continue
        covered_until = end
        line = prose.count("\n", 0, start) + 1
        hits.append(PromiseHit(line, " ".join(found.split()), lang))
    return hits


def _is_historical(rel: str) -> bool:
    return rel.startswith(HISTORICAL) or (
        rel.startswith("docs/help/") and rel.rsplit("/", 1)[-1] in HISTORICAL_PAGES
    )


def _ui_sources(repo: Path) -> list[Path]:
    root = repo / "frontend" / "src"
    return [
        path
        for path in sorted(root.rglob("*"))
        if path.suffix in _UI_SOURCE_SUFFIXES
        and not any(marker in path.name for marker in _TEST_MARKERS)
        and "test" not in path.relative_to(root).parts[:-1]
    ]


def _groups(repo: Path) -> dict[str, tuple[bool, list[Path]]]:
    """The scanned files per group, and whether an empty group is a FAIL."""
    docs = [
        path
        for path in sorted((repo / "docs").rglob("*.md"))
        if not _is_historical(path.relative_to(repo).as_posix())
    ]
    help_pages = [path for path in docs if path.relative_to(repo).parts[:2] == ("docs", "help")]
    return {
        "backend catalogs": (True, sorted((repo / "backend/config/i18n").glob("*.yaml"))),
        "frontend catalogs": (True, sorted((repo / "frontend/src/data/i18n").rglob("*.json"))),
        "glossary": (
            True,
            sorted((repo / "backend/config/help").glob("*.yaml"))
            + sorted((repo / "frontend/src/data/help").glob("*.json")),
        ),
        "help pages": (True, help_pages),
        "other docs": (False, [path for path in docs if path not in help_pages]),
        "root docs": (False, sorted(repo.glob("*.md"))),
        "UI sources": (True, _ui_sources(repo)),
    }


def _summary(counts: dict[str, int]) -> str:
    catalogs = counts["backend catalogs"] + counts["frontend catalogs"]
    parts = [f"catalogs {catalogs}"] + [
        f"{group} {count}" for group, count in counts.items() if "catalogs" not in group
    ]
    return ", ".join(parts)


def check_privacy_promises(report: _Report, repo: Path) -> None:
    """FAIL on every promise that no personal data is sent, in shipped text and current docs."""
    counts: dict[str, int] = {}
    for group, (required, files) in _groups(repo).items():
        counts[group] = len(files)
        if required and not files:
            report.fail(CHECK, f"{group}: no files found to check (basis missing; #2287)")
            continue
        for path in files:
            rel = path.relative_to(repo).as_posix()
            text = path.read_text(encoding="utf-8")
            for hit in promise_hits(text, markdown=path.suffix == ".md"):
                report.fail(
                    CHECK,
                    f'{rel}:{hit.line}: "{hit.found}" ({hit.lang}) promises that no personal '
                    f"data is sent; say what is sent instead ({ISSUE})",
                )
    report.note(
        f"{CHECK}: scanned {sum(counts.values())} files ({_summary(counts)}); "
        f"exempt as historical: {', '.join(HISTORICAL)} and the help {HISTORICAL_PAGES[0]}"
    )
