#!/usr/bin/env python3
"""ASCII-Ersatzschreibungen in der deutschen Doku umschreiben (#2311).

Nutzt die kuratierte Ganzwort-Wortliste von manuscript-tools plus die
Projekt-Ergaenzung in ``docs/.docs-hygiene-extra-words.txt``. Bewusst KEINE
Digraph-Suche: Deutsch ist voller legitimer ae/oe/ue-Folgen ("Frauen",
"Goethe"), und unsere Doku enthaelt spanische und franzoesische
Beispielsaetze ("fuera", "langue"), die eine Substring-Suche zerstoeren
wuerde - genau der Fehler aus #2289.

Der Lauf ist an einen Nachweis gekoppelt, den er selbst fuehrt: ein
Fixer, der 144 Woerter trifft und die uebrigen desselben Satzes stehen
laesst, macht aus einheitlich falschen Dateien uneinheitliche. Das ist
der schlechtere Ausgangspunkt fuer jede weitere Bereinigung
(lessons/docs-i18n.md, Mixed-Encoding als schlimmster Fall). Deshalb
misst dieses Werkzeug drei Zahlen, und nur eine davon hat ein Vetorecht:

A) NEU GEMISCHT (blockierend) - die Zeile war einheitlich ASCII und
   traegt nach dem Lauf beides: einen geschriebenen Umlaut UND einen
   verbliebenen Ersatz-Token. Muss null sein.
B) VORHER SCHON GEMISCHT (nicht blockierend) - der Lauf verbessert
   teilweise und verschlechtert nichts. Wer das einrechnet, blockiert an
   einem Zustand, den er nicht verursacht hat.
C) UNGEAENDERTE ZEILEN MIT RESTEN (nicht blockierend) - bekannter
   Restbestand: Woerter, die weder Liste noch Ergaenzung kennen.

``--apply`` schreibt NUR bei A == 0. Ohne ``--apply`` wird nichts
angefasst.

Ein Resttoken zaehlt nur, wenn seine umlautierte Form im Korpus als
echtes Deutsch vorkommt. Ohne diesen Anker meldet jede spanische Zeile
einen Rest.

Drei Klassen sind ausgenommen (#2311, Blocker-Befunde vor dem
Anwendungslauf):

- ``docs/journal/**``: datierte Aufzeichnungen dessen, was war - ein
  nachtraeglicher Umbau macht Rekonstruktionen daraus. Sie liefern aber
  Anker-Evidenz, denn dort steht echtes Deutsch.
- ``docs/review/**``: eingefrorene Wortlaut-Zeugen (i18n-Katalog-Exporte).
  Jede Zeile zitiert einen Katalogwert, um ueber dessen SCHREIBWEISE eine
  Aussage zu machen; ein korrigierter Wert liesse das Dokument einen
  Katalogstand behaupten, den es nie gab.
- Generierte Artefakte (Kopfzeilen-Marker "Nicht von Hand editieren" /
  "Do not edit by hand"): eine Doku-seitige Korrektur macht den
  Byte-Gleichheits-Pin (test_lesson_schema_drift.py) rot und wird beim
  naechsten Generatorlauf verworfen - die Korrektur gehoert in den
  Generator.

Versalien-Bezeichner (Grep-Schluessel wie ``FUNKTION-NICHT-VERFUEGBAR``)
werden weder umgeschrieben noch als Rest gezaehlt: sie stehen identisch im
Quelltext, eine nur-Doku-Korrektur spaltet die Schreibweise und ein grep
findet danach nur noch die Haelfte.

Faellt geschlossen: fehlende Wortliste, leere Dateimenge, unlesbarer
Git-Index und fehlendes manuscript-tools sind Fehler, nie ein gruener
Lauf.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

TOKEN = re.compile(r"[A-Za-zÄÖÜäöüß]+")
UMLAUT_CHARS = frozenset("äöüÄÖÜ")
JOURNAL_PREFIX = "docs/journal/"
REVIEW_PREFIX = "docs/review/"
EXTRA_WORDS_FILE = "docs/.docs-hygiene-extra-words.txt"
MIN_RESIDUAL_LENGTH = 5
# Kopfzeilen-Marker generierter Doku; im Kopfbereich (erste Zeilen) gesucht.
GENERATED_MARKER = re.compile(r"(?i)nicht von hand editieren|do not edit by hand")
GENERATED_HEAD_LINES = 6
# Versalien-Bezeichner mit Ersatz-Digraph (Grep-Schluessel, kein Fliesstext).
UPPER_ID = re.compile(r"\b[A-Z][A-Z-]{3,}\b")


class ToolingError(RuntimeError):
    """Der Lauf kann seine eigene Grundlage nicht herstellen."""


@dataclass
class MixedLine:
    """Eine Zeile, die nach dem Lauf zwei Schreibungen traegt."""

    path: Path
    before: str
    after: str
    residuals: list[str]


@dataclass
class Report:
    """Was der Lauf gemessen hat."""

    version: str
    known_words: int
    extra_words: int
    files_scanned: int
    files_total: int
    files_generated: int = 0
    replacements: int = 0
    changed_lines: int = 0
    newly_mixed: list[MixedLine] = field(default_factory=list)
    pre_mixed: list[MixedLine] = field(default_factory=list)
    stock: Counter[str] = field(default_factory=Counter)

    @property
    def blocked(self) -> bool:
        return bool(self.newly_mixed)


def load_manuscript_tools():
    """manuscript-tools importieren oder mit Hinweis abbrechen."""
    try:
        import manuscript_tools
        from manuscript_tools import checker, umlauts
        from manuscript_tools.umlaut_words import UMLAUT_WORDS
    except ImportError as exc:
        raise ToolingError(
            f"manuscript-tools nicht importierbar ({exc}). "
            "Installieren: pip install 'manuscript-tools==0.11.0'"
        ) from exc
    return manuscript_tools, checker, umlauts, UMLAUT_WORDS


def read_extra_words(root: Path) -> list[str]:
    """Die Projekt-Ergaenzung lesen; leer oder fehlend ist ein Fehler."""
    path = root / EXTRA_WORDS_FILE
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ToolingError(f"Wortliste nicht lesbar unter {path} ({exc})") from exc
    words = [
        line.strip().lower()
        for line in raw.splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    if not words:
        raise ToolingError(f"Wortliste {path} enthaelt kein einziges Wort")
    return words


def tracked_markdown(root: Path) -> list[Path]:
    """Verfolgte ``docs/**/*.md`` ueber den Git-Index (#2217)."""
    proc = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z", "--cached", "--", "docs"],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise ToolingError(
            f"git ls-files fehlgeschlagen unter {root}: {proc.stderr.strip() or 'kein Git-Index'}"
        )
    paths = [root / rel for rel in proc.stdout.split("\0") if rel.endswith(".md")]
    return [p for p in paths if p.exists()]


def repo_root_from_cwd() -> Path:
    """Die Wurzel aus dem Arbeitsverzeichnis ableiten, nicht aus ``__file__``.

    ``__file__`` zeigt auf den Checkout, in dem das SKRIPT liegt - unter
    ``git worktree`` ist das ein anderer als der, an dem gearbeitet wird.
    Ein Werkzeug, das dann still im falschen Baum misst, meldet gruen,
    ohne hingesehen zu haben (lessons/core.md).
    """
    proc = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    if proc.returncode != 0 or not proc.stdout.strip():
        raise ToolingError(
            "Repo-Wurzel nicht bestimmbar: git rev-parse --show-toplevel "
            f"fehlgeschlagen ({proc.stderr.strip() or 'kein Git-Repo'}). "
            "Aus dem Repo heraus aufrufen oder --root setzen."
        )
    return Path(proc.stdout.strip())


def is_journal(path: Path, root: Path) -> bool:
    return path.relative_to(root).as_posix().startswith(JOURNAL_PREFIX)


def is_review(path: Path, root: Path) -> bool:
    """``docs/review/**``: eingefrorene Wortlaut-Zeugen, nie umschreiben."""
    return path.relative_to(root).as_posix().startswith(REVIEW_PREFIX)


def is_generated(text: str) -> bool:
    """Traegt der Kopfbereich den Generiert-Marker?"""
    head = "\n".join(text.splitlines()[:GENERATED_HEAD_LINES])
    return bool(GENERATED_MARKER.search(head))


def mask_upper_identifiers(text: str) -> tuple[str, dict[str, str]]:
    """Versalien-Bezeichner mit Ersatz-Digraph vor dem Umschreiber verstecken.

    Platzhalter aus Private-Use-Zeichen: kein Wortzeichen, also fuer den
    Umschreiber, den Zeilenvergleich und die Rest-Suche unsichtbar.
    """
    masked: dict[str, str] = {}

    def _repl(match: re.Match[str]) -> str:
        token = match.group(0)
        if not re.search(r"AE|OE|UE", token):
            return token
        key = f"{len(masked)}"
        masked[key] = token
        return key

    return UPPER_ID.sub(_repl, text), masked


def unmask_upper_identifiers(text: str, masked: dict[str, str]) -> str:
    for key, token in masked.items():
        text = text.replace(key, token)
    return text


class GermanAnchor:
    """Der Anker gegen Fehlalarme: kommt die umlautierte Form im Korpus vor?

    Ohne ihn meldet spanisch "prueba" oder franzoesisch "langue" einen
    Rest. Mit ihm zaehlt ein Token nur, wenn seine umlautierte Form
    anderswo im Korpus tatsaechlich als deutsches Wort vorkommt.

    Der Vergleich ist ein STAMMTREFFER, kein exakter Tokentreffer
    (#2313). Deutsche Flexion bricht den exakten Vergleich: "sekundaere"
    wird zu "sekundäre", im Korpus steht aber "sekundären" - ein
    Tokenvergleich findet nichts und der Rest entgeht der Erkennung. Da
    der Anker an das Schreiben gekoppelt ist, wird aus einem zu engen
    Anker eine Zusicherung ohne Deckung: 24 Zeilen wurden so als null
    gemeldet.

    Belegt ist eine Form deshalb, wenn sie Praefix eines Korpus-Tokens
    ist ODER ein Korpus-Token ihr Praefix ist. Die Untergrenze von
    ``MIN_RESIDUAL_LENGTH`` Zeichen haelt kurze Fragmente draussen, die
    sonst auf alles passen wuerden.
    """

    def __init__(self, files: list[Path]) -> None:
        self.tokens: set[str] = set()
        self.prefixes: set[str] = set()
        for path in files:
            text = path.read_text(encoding="utf-8", errors="replace")
            for match in TOKEN.finditer(text):
                word = match.group(0).lower()
                if UMLAUT_CHARS & set(word):
                    self.tokens.add(word)
        for token in self.tokens:
            for cut in range(MIN_RESIDUAL_LENGTH, len(token)):
                self.prefixes.add(token[:cut])

    def attests(self, form: str) -> bool:
        """Ist *form* im Korpus als echtes Deutsch belegt?"""
        if form in self.tokens or form in self.prefixes:
            return True
        return any(form[:cut] in self.tokens for cut in range(MIN_RESIDUAL_LENGTH, len(form)))

    def __len__(self) -> int:
        return len(self.tokens)


def strip_protected(line: str, checker) -> str:
    """Code, Link-Ziele und URLs ausblenden - dort bleibt ASCII korrekt."""
    line = checker._INLINE_CODE.sub(" ", line)
    line = checker._LINK_TARGET.sub("]( )", line)
    return checker._BARE_URL.sub(" ", line)


def find_residuals(line: str, known: frozenset[str], anchor: GermanAnchor, checker) -> list[str]:
    """Ersatzschreibungen, die der Lauf in dieser Zeile stehen laesst."""
    residuals = []
    for match in TOKEN.finditer(strip_protected(line, checker)):
        # Versalien-Bezeichner sind Grep-Schluessel, kein Fliesstext (#2311).
        if match.group(0).isupper() and len(match.group(0)) >= 4:
            continue
        word = match.group(0).lower()
        if word in known or len(word) < MIN_RESIDUAL_LENGTH:
            continue
        if not re.search(r"ae|oe|ue", word):
            continue
        if anchor.attests(checker.umlautify(word).lower()):
            residuals.append(word)
    return residuals


def analyse(root: Path, *, apply: bool) -> Report:
    """Den Lauf messen und - bei ``apply`` und A == 0 - schreiben."""
    manuscript_tools, checker, umlauts, base_words = load_manuscript_tools()
    extras = read_extra_words(root)
    all_files = tracked_markdown(root)
    if not all_files:
        raise ToolingError(f"0 verfolgte Markdown-Dateien unter {root}/docs")
    anchor = GermanAnchor(all_files)
    candidates = [
        p for p in all_files if not is_journal(p, root) and not is_review(p, root)
    ]
    if not candidates:
        raise ToolingError(
            f"0 Zieldateien unter {root}/docs (Journale/Review ausgenommen)"
        )
    texts: dict[Path, str] = {
        p: p.read_text(encoding="utf-8", errors="replace") for p in candidates
    }
    generated = [p for p in candidates if is_generated(texts[p])]
    targets = [p for p in candidates if p not in set(generated)]
    if not targets:
        raise ToolingError(
            f"0 Zieldateien unter {root}/docs (Journale/Review/Generiert ausgenommen)"
        )

    known = frozenset(base_words) | frozenset(extras)
    report = Report(
        version=manuscript_tools.__version__,
        known_words=len(base_words),
        extra_words=len(extras),
        files_scanned=len(targets),
        files_total=len(all_files),
        files_generated=len(generated),
    )
    rewritten_by_path: dict[Path, str] = {}

    for path in targets:
        original = texts[path]
        masked_original, upper_ids = mask_upper_identifiers(original)
        rewritten_masked, replacements = umlauts.replace_ascii_umlauts(
            masked_original, tuple(extras)
        )
        rewritten = unmask_upper_identifiers(rewritten_masked, upper_ids)
        report.replacements += replacements
        if replacements:
            rewritten_by_path[path] = rewritten
        in_fence = False
        # strict: der Umschreiber ersetzt Woerter in der Zeile und darf die
        # Zeilenzahl nicht veraendern. Wenn eine kuenftige Version das doch
        # tut, soll der Lauf abbrechen und nicht stillschweigend versetzt
        # vergleichen.
        for before, after in zip(original.splitlines(), rewritten.splitlines(), strict=True):
            if checker._FENCE.match(before):
                in_fence = not in_fence
                continue
            if in_fence:
                continue
            if before == after:
                for word in find_residuals(before, known, anchor, checker):
                    report.stock[word] += 1
                continue
            report.changed_lines += 1
            residuals = find_residuals(after, known, anchor, checker)
            if not residuals:
                continue
            entry = MixedLine(path=path, before=before, after=after, residuals=residuals)
            if UMLAUT_CHARS & set(before):
                report.pre_mixed.append(entry)
            else:
                report.newly_mixed.append(entry)

    if apply and not report.blocked:
        for path, rewritten in rewritten_by_path.items():
            path.write_text(rewritten, encoding="utf-8")
    return report


def print_report(report: Report, *, apply: bool, samples: int) -> None:
    print(
        f"manuscript-tools {report.version}: {report.known_words} Woerter "
        f"+ {report.extra_words} Projekt-Ergaenzung"
    )
    print(
        f"Dateien: {report.files_scanned} von {report.files_total} verfolgten "
        f"(journal/review ausgenommen, {report.files_generated} generierte uebersprungen)"
    )
    print(f"Ersetzungen: {report.replacements} | geaenderte Zeilen: {report.changed_lines}")
    print(f"A) neu gemischt (blockierend):     {len(report.newly_mixed)}")
    print(f"B) vorher schon gemischt:          {len(report.pre_mixed)}")
    print(
        f"C) ungeaenderte Zeilen mit Resten: {sum(report.stock.values())} "
        f"({len(report.stock)} verschiedene Woerter, dem Gate unsichtbar)"
    )
    if report.newly_mixed:
        drivers = Counter(w for entry in report.newly_mixed for w in entry.residuals)
        print(f"\nFEHLGESCHLAGEN: der Lauf wuerde {len(report.newly_mixed)} Zeile(n) mischen.")
        print(f"Treiberwoerter ({len(drivers)} verschiedene), gehoeren in {EXTRA_WORDS_FILE}:")
        for word, count in drivers.most_common(samples):
            print(f"  {count:4d}  {word}")
        for entry in report.newly_mixed[:samples]:
            print(f"\n  {entry.path}\n    -{entry.before.strip()[:120]}")
            print(f"    +{entry.after.strip()[:120]}\n    Rest: {entry.residuals}")
        return
    if apply:
        print("\nGeschrieben. A war null - keine Zeile wurde gemischt.")
    else:
        print("\nTrockenlauf, nichts geschrieben. A ist null: --apply waere zulaessig.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Repo-Wurzel mit docs/ (Standard: die Wurzel des Arbeitsverzeichnisses)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Schreiben statt nur messen. Wirkt nur, wenn A null ist.",
    )
    parser.add_argument("--samples", type=int, default=15, help="Beispielzeilen im Bericht")
    args = parser.parse_args(argv)

    try:
        root = args.root if args.root is not None else repo_root_from_cwd()
        report = analyse(root, apply=args.apply)
    except ToolingError as exc:
        print(f"FEHLGESCHLAGEN: {exc} (faellt geschlossen)")
        return 2
    print_report(report, apply=args.apply, samples=args.samples)
    return 1 if report.blocked else 0


if __name__ == "__main__":
    sys.exit(main())
