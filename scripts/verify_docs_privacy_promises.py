"""No shipped text promises more privacy than the app keeps (#3812, #3829).

Two AI dialogs told the learner "No personal data is transmitted" in all 11
catalogs, and the Japanese FAQ said the learning profile and other personal
data never reach the AI provider. Neither is true: the browser calls the
provider directly, so every request carries the learner's IP address and API
key, the session prompt carries the learning project, the lesson progress and
the recent mistakes, and text the learner wrote can itself be personal. The
owner decided on 2026-10-20 that the app states what leaves the device
instead of promising what does not.

#3829 added four phrasings the help and the READMEs used in the languages
they occurred in: nothing about the words you struggle with is sent anywhere,
nothing is uploaded to a server, all your data stays in your browser, and
nothing is sent to a server except the AI calls.

A list of phrasings gives precision only, never recall: a false promise in
words this list does not know passes. Finding every statement about data
leaving the device and holding it against approved sentences is #3830.

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
ISSUES = "#3812, #3829"

HISTORICAL = (
    "docs/explorations/",
    "docs/review/",
    "docs/journal/",
    "docs/roadmap-archive/",
)
HISTORICAL_PAGES = ("changelog.md",)

# The gap between the subject and the verb never crosses a sentence end, nor
# a quote or a colon, so it cannot run from one catalog value into the next.
_GAP = r"[^.!?。！？।\":]{0,60}?"

# The #3829 patterns, per language, cover the four phrasings in every
# language they occurred in on develop (0ec0c30b7):
# - "struggle": nothing about the words you struggle with is sent anywhere
#   (user-guide/lessons.md); "anywhere" is what makes it false.
# - "uploaded": nothing is uploaded to a server (user-guide/my-lessons.md).
# - "stays": all your data stays in your browser (README.md, README-de.md,
#   user-guide/getting-started.md).
# - "except": nothing is sent to a server, except ... (user-guide/faq.md
#   item 7). The backup note says "nothing is sent to a server" about one
#   feature, where it is true, so the exception clause, which turns it into a
#   claim about the whole app, is part of the pattern.
# Like every pattern here they give precision only; the class is #3830.
PROMISE_PATTERNS: dict[str, tuple[str, ...]] = {
    "de": (
        r"\bkeine\s+(?:persönlichen|personenbezogenen)\s+Daten\b"
        + _GAP
        + r"\b(?:gesendet|übermittelt|übertragen|verschickt|geschickt|hochgeladen)",
        r"\b(?:persönliche|personenbezogene)\s+Daten\s+(?:werden|wird)\s+(?:nie|niemals|nicht)\s+"
        r"(?:gesendet|übermittelt|übertragen|verschickt|geschickt|hochgeladen)",
        r"\b(?:sendet|übermittelt|überträgt|schickt)\s+(?:keine|nie|niemals)\s+"
        r"(?:persönlichen|personenbezogenen)\s+Daten",
        # #3829 struggle
        r"\bnichts\s+darüber\b"
        + _GAP
        + r"\bwird\s+irgendwohin\s+(?:gesendet|geschickt|übermittelt|übertragen|hochgeladen)",
        # #3829 uploaded
        r"\bnichts\s+wird\s+(?:auf|an|zu)\s+(?:einen|irgendeinen|den)\s+Server\s+hochgeladen",
        # #3829 stays
        r"\balle\s+(?:deine\s+|Ihre\s+)?Daten\s+bleiben\s+(?:nur\s+)?in\s+(?:deinem|Ihrem)\s+Browser",
        # #3829 except
        r"\bnichts\s+wird\s+(?:an|auf|zu)\s+(?:einen|irgendeinen|den)\s+Server\s+"
        r"(?:gesendet|geschickt|übermittelt|übertragen|hochgeladen)\s*[(,]?\s*"
        r"(?:außer|ausgenommen|abgesehen)",
    ),
    "el": (
        r"\bδεν\s+(?:μεταδίδονται|μεταβιβάζονται|αποστέλλονται|στέλνονται|διαβιβάζονται)\s+"
        r"(?:κανένα\s+)?προσωπικά\s+δεδομένα",
        r"\bπροσωπικά\s+δεδομένα\s+δεν\s+"
        r"(?:μεταδίδονται|μεταβιβάζονται|αποστέλλονται|στέλνονται|διαβιβάζονται)",
        r"\bδεν\s+(?:στέλνει|στέλνουμε|μεταδίδει|αποστέλλει|μεταβιβάζει)\s+"
        r"(?:κανένα\s+)?προσωπικά\s+δεδομένα",
        # #3829 struggle
        r"\bτίποτα\b"
        + _GAP
        + r"\bδεν\s+(?:αποστέλλεται|στέλνεται|μεταδίδεται|ανεβαίνει)\s+πουθενά",
        # #3829 uploaded
        r"\bτίποτα\s+δεν\s+(?:ανεβαίνει|ανεβάζεται)\s+σε\s+(?:κάποιον\s+)?(?:διακομιστή|server)",
        # #3829 stays
        r"\bόλα\s+τα\s+δεδομένα\s+(?:σου|σας)\s+παραμένουν\s+(?:μόνο\s+)?στο\s+"
        r"(?:πρόγραμμα\s+περιήγησής\s+(?:σου|σας)|browser)",
        # #3829 except
        r"\bτίποτα\s+δεν\s+(?:αποστέλλεται|στέλνεται|ανεβαίνει)\s+σε\s+(?:κάποιον\s+)?"
        r"(?:διακομιστή|server)\s*[(,]?\s*(?:εκτός|πέρα\s+από)",
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
        # #3829 struggle
        r"\bnothing\s+about\b"
        + _GAP
        + r"\b(?:is|are|gets?|will\s+be)\s+(?:ever\s+)?(?:sent|uploaded|transmitted|shared)\s+anywhere",
        # #3829 uploaded
        r"\bnothing\s+(?:is\s+|gets\s+|will\s+be\s+)?(?:ever\s+)?uploaded\s+to\s+(?:a|any|the)\s+server",
        # #3829 stays
        r"\ball\s+(?:of\s+)?your\s+data\s+(?:stays|remains)\s+(?:only\s+)?in\s+your\s+browser",
        # #3829 except
        r"\bnothing\s+(?:is\s+|gets\s+)?(?:ever\s+)?(?:sent|uploaded|transmitted)\s+to\s+"
        r"(?:a|any|the)\s+server\s*[(,]?\s*(?:except|other\s+than|apart\s+from|besides)",
    ),
    "es": (
        r"\bno\s+se\s+(?:transmiten|envían|envian|transfieren|suben)\s+(?:ningún\s+|tus\s+)?"
        r"datos\s+personales",
        r"\bningún\s+dato\s+personal\b"
        + _GAP
        + r"\b(?:se\s+)?(?:transmite|envía|envia|enviará|transfiere|transmitirá)",
        r"\bdatos\s+personales\s+no\s+se\s+(?:transmiten|envían|envian|transfieren)",
        r"\bno\s+(?:envía|envia|transmite|transfiere)\s+(?:ningún\s+dato\s+personal|datos\s+personales)",
        # #3829 struggle
        r"\bno\s+se\s+(?:envía|envia|sube|transmite)\s+a\s+ningún\s+(?:sitio|lado|lugar)\s+nada\b",
        # #3829 uploaded
        r"\bnada\s+se\s+sube\s+a\s+(?:un|ningún)\s+servidor",
        # #3829 stays
        r"\btodos\s+(?:tus|sus)\s+datos\s+(?:permanecen|se\s+quedan|quedan)\s+(?:solo\s+)?en\s+"
        r"(?:tu|su)\s+navegador",
        # #3829 except
        r"\bnada\s+(?:se\s+)?(?:enviado|envía|envia|sube|subido)\s+a\s+(?:un|ningún)\s+servidor"
        r"\s*[(,]?\s*(?:excepto|salvo|menos|aparte\s+de)",
    ),
    "fr": (
        r"\baucune\s+donnée\s+personnelle\b"
        + _GAP
        + r"\b(?:n['’]est|ne\s+sera|ne\s+sont)\s+(?:\w+\s+)?(?:transmise|envoyée|transférée)",
        r"\b(?:n['’](?:envoie|envoyons)|ne\s+(?:transmet|transmettons|envoie|transfère))\s+"
        r"(?:aucune\s+donnée\s+personnelle|pas\s+(?:de|vos|tes)\s+données\s+personnelles)",
        r"\bdonnées\s+personnelles\s+ne\s+(?:sont|seront)\s+(?:pas|jamais)\s+"
        r"(?:transmises|envoyées|transférées)",
        # #3829 struggle
        r"\brien\s+sur\b"
        + _GAP
        + r"\bn['’]est\s+(?:envoyé|transmis|transféré)e?\s+(?:où\s+que\s+ce\s+soit|nulle\s+part)",
        # #3829 stays
        r"\btoutes\s+(?:tes|vos)\s+données\s+restent\s+(?:uniquement\s+)?dans\s+(?:ton|votre)\s+"
        r"navigateur",
    ),
    "hi": (
        r"कोई\s+(?:भी\s+)?(?:व्यक्तिगत|निजी)\s+(?:डेटा|जानकारी)(?=[^।!?\":]{0,40}?नहीं)"
        r"[^।!?\":]{0,40}?(?:प्रेषित|भेज)",
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
        r"個人(?:データ|情報)(?:は|を|が|も)[^。！？\":]{0,30}?(?:送信|転送|送付|伝送)(?:され|し)(?:ません|ない)",
        # #3829 struggle
        r"何か(?:が|を)?\s*どこか(?:に|へ)\s*(?:送信|送ら|アップロード)[^。！？\":]{0,10}?(?:ません|ない)",
        # #3829 uploaded
        r"サーバー(?:に|へ)は?何も\s*アップロードされ(?:ません|ない)",
        # #3829 stays
        r"データは(?:すべて|全て)[^。！？\":]{0,10}?ブラウザ[^。！？\":]{0,20}?(?:に|で)\s*(?:留ま|とどま|残)",
    ),
    "ko": (
        r"개인\s*(?:데이터|정보)(?:는|은|가|이|를|도)?[^.。!?\":]{0,30}?(?:전송|송신|전달)(?:되지|하지)\s*않",
    ),
    "pt": (
        r"\bnenhum\s+dado\s+pessoal\b"
        + _GAP
        + r"\b(?:é|será|e)\s+(?:transmitido|enviado|transferido)",
        r"\bdados\s+pessoais\s+não\s+(?:são|serão)\s+(?:transmitidos|enviados|transferidos)",
        r"\bnão\s+(?:envia|transmite|transfere)\s+(?:nenhum\s+dado\s+pessoal|dados\s+pessoais)",
        # #3829 struggle
        r"\bnada\s+sobre\b" + _GAP + r"\b(?:é|será)\s+enviad[oa]\s+para\s+qualquer\s+lado",
        # #3829 uploaded: the backup note says "nada é enviado para um servidor"
        # about itself, where it is true; "everything works offline" before it
        # is what made it a claim about the whole page.
        r"\btudo\s+funciona\s+offline\s*[;,]\s*nada\s+(?:é\s+)?(?:enviado|carregado)\s+para\s+"
        r"(?:um|nenhum)\s+servidor",
        # #3829 stays
        r"\btodos\s+os\s+(?:teus|seus)\s+dados\s+(?:permanecem|ficam)\s+(?:apenas\s+)?no\s+"
        r"(?:teu|seu)\s+(?:browser|navegador)",
        # #3829 except
        r"\bnada\s+(?:é\s+)?enviado\s+para\s+(?:um|nenhum)\s+servidor\s*[(,]?\s*"
        r"(?:exceto|excepto|salvo|além\s+d)",
    ),
    "tr": (
        r"\bhiçbir\s+kişisel\s+(?:veri|bilgi)\b"
        + _GAP
        + r"(?:iletilmez|gönderilmez|aktarılmaz|iletilmeyecek|gönderilmeyecek)",
        r"\bkişisel\s+(?:veri|bilgi)(?:ler)?(?:iniz)?\s+(?:asla\s+)?"
        r"(?:iletilmez|gönderilmez|aktarılmaz|iletilmeyecek|gönderilmeyecek)",
        # #3829 struggle
        r"\bhiçbir\s+şey\s+herhangi\s+bir\s+yere\s+(?:gönderilmez|iletilmez|yüklenmez|aktarılmaz)",
        # #3829 uploaded: the book import says "hiçbir şey bir sunucuya
        # yüklenmez" about one file, where it is true; "everything works
        # offline" before it is what made it a claim about the whole page.
        r"\bçevrimdışı\s+çalışır\s*[;,]\s*hiçbir\s+şey\s+(?:bir\s+)?sunucuya\s+"
        r"(?:yüklenmez|gönderilmez)",
        # #3829 stays
        r"\btüm\s+veriler(?:in|iniz)\s+tarayıcı(?:n|nız)da\b[^.!?\":]{0,30}?\bkalır",
        # #3829 except: the exception follows in parentheses, "hariç" last.
        r"\bhiçbir\s+şey\s+(?:bir\s+)?sunucuya\s+(?:gönderilmez|yüklenmez|iletilmez)\s*\(\s*"
        r"[^)]{0,60}?\b(?:hariç|dışında)",
    ),
}

# Every pattern names one of these stems as a word it cannot match without:
# personal data (#3812), or for #3829 the "anywhere" of the struggle
# phrasing, the server or the browser. A pattern runs only on a text that
# holds one of its own stems; "browser" and "server" are common in the UI
# sources, so one list for all patterns would let most files through.
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
    # #3829 struggle
    "anywhere",
    "irgendwohin",
    "ningún",
    "qualquer",
    "herhangi",
    "πουθενά",
    "rien",
    "どこか",
    # #3829 uploaded, except
    "server",
    "servidor",
    "διακομιστ",
    "sunucu",
    "サーバー",
    # #3829 stays
    "browser",
    "navegador",
    "navigateur",
    "tarayıcı",
    "περιήγησ",
    "ブラウザ",
)

_COMPILED = [
    (
        lang,
        re.compile(pattern, re.IGNORECASE),
        tuple(stem for stem in STEMS if stem in pattern.lower()),
    )
    for lang, patterns in PROMISE_PATTERNS.items()
    for pattern in patterns
]

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
    """Every known promise of more privacy than the app keeps, in ``text``.

    Args:
        text: A catalog, glossary, help page or source file.
        markdown: Skip fenced code, inline code and HTML comments.

    Returns:
        One hit per promise, in text order; where patterns of several
        languages or several patterns of one language overlap, the first
        match wins.
    """
    lowered = text.lower()
    present = {stem for stem in STEMS if stem in lowered}
    if not present:
        return []
    prose = _markdown_prose(text) if markdown else text
    matches = sorted(
        (
            (match.start(), match.end(), lang, match.group(0))
            for lang, pattern, stems in _COMPILED
            if present.intersection(stems)
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
    """FAIL on every known privacy promise the app does not keep, in shipped text and current docs."""
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
                    f'{rel}:{hit.line}: "{hit.found}" ({hit.lang}) promises more privacy than '
                    f"the app keeps; say what leaves the device instead ({ISSUES})",
                )
    report.note(
        f"{CHECK}: scanned {sum(counts.values())} files ({_summary(counts)}); "
        f"exempt as historical: {', '.join(HISTORICAL)} and the help {HISTORICAL_PAGES[0]}"
    )
