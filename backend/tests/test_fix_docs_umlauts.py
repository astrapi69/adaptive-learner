"""Vertragstests fuer scripts/fix_docs_umlauts.py (#2311).

Laeuft das Skript als Subprozess gegen echte Wegwerf-Git-Repos - die
Schnittstelle, die der Lauf tatsaechlich benutzt, nie ein Mock
(lessons/core.md "Test a tool through the interface it actually uses").
Das Werkzeug enumeriert ueber den Git-Index, also muessen die Tests
diesen Kontext herstellen.

Deckt den Fuenf-Punkte-Vertrag ab (quality-checks.md "Gate test
contract"): findet den Verstoss, ist gruen auf sauberem Baum, faellt
GESCHLOSSEN wenn die eigene Grundlage fehlt, berichtet WAS gemessen
wurde, und die Zahl bedeutet ueberall dasselbe (Git-Index statt
Dateisystem). Dazu die Kopplung, die den Anwendungslauf absichert:
geschrieben wird nur, wenn keine Zeile gemischt wird.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "fix_docs_umlauts.py"

pytestmark = pytest.mark.skipif(
    shutil.which("git") is None, reason="git wird fuer die Index-Enumeration gebraucht"
)


def _run(root: Path, *extra: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--root", str(root), *extra],
        capture_output=True,
        text=True,
    )


def _run_from_cwd(cwd: Path, *extra: str) -> subprocess.CompletedProcess:
    """Ohne --root: die Wurzel muss aus dem Arbeitsverzeichnis kommen."""
    return subprocess.run(
        [sys.executable, str(SCRIPT), *extra],
        capture_output=True,
        text=True,
        cwd=str(cwd),
    )


def _git(root: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)


def _tree(root: Path, files: dict[str, str], *, extras: str = "uebungstypen") -> Path:
    """Ein Repo mit docs/, Wortliste und gestagten Dateien aufbauen."""
    docs = root / "docs"
    docs.mkdir(parents=True, exist_ok=True)
    if not (root / ".git").exists():
        _git(root, "init", "-q")
    for rel, text in files.items():
        target = root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
    if extras is not None:
        (docs / ".docs-hygiene-extra-words.txt").write_text(
            "# Testliste\n" + extras + "\n", encoding="utf-8"
        )
    _git(root, "add", "-A", "docs")
    return docs


# Der Anker: "laeuft" gilt nur dann als Rest, wenn "läuft" im Korpus als
# echtes Deutsch vorkommt. Ohne ihn meldet jede spanische Zeile einen Rest.
ANCHOR = "Der Job läuft und die Prüfung ist fällig.\n"


# --- 1. findet den Verstoss ------------------------------------------------


def test_reports_newly_mixed_line_and_fails(tmp_path: Path) -> None:
    """ "laeuft" kennt die Liste nicht: der Lauf schreibt "Loesung" und
    "fuer" um und laesst "laeuft" stehen - genau die Mischung, die den
    Bestand von einheitlich falsch auf uneinheitlich bringt."""
    _tree(
        tmp_path,
        {
            "docs/note.md": "Die Loesung laeuft fuer alle.\n",
            "docs/anchor.md": ANCHOR,
        },
    )
    result = _run(tmp_path)
    assert result.returncode == 1, result.stdout
    assert "A) neu gemischt (blockierend):     1" in result.stdout
    assert "laeuft" in result.stdout


def test_names_the_driver_words_for_the_word_list(tmp_path: Path) -> None:
    """Der Bericht sagt, welche Woerter nachzulegen sind - sonst muss der
    naechste Lauf sie von Hand aus den Beispielzeilen klauben."""
    _tree(
        tmp_path,
        {
            "docs/note.md": "Die Loesung laeuft fuer alle.\n",
            "docs/anchor.md": ANCHOR,
        },
    )
    result = _run(tmp_path)
    assert "docs/.docs-hygiene-extra-words.txt" in result.stdout
    assert "Treiberwoerter" in result.stdout


# --- 2. gruen auf sauberem Baum --------------------------------------------


def test_passes_when_no_line_would_be_mixed(tmp_path: Path) -> None:
    _tree(tmp_path, {"docs/note.md": "Die Loesung ist fuer alle.\n"})
    result = _run(tmp_path)
    assert result.returncode == 0, result.stdout
    assert "A) neu gemischt (blockierend):     0" in result.stdout
    assert "nichts geschrieben" in result.stdout


def test_extra_words_close_the_gap(tmp_path: Path) -> None:
    """Dasselbe Dokument wie im Verstoss-Test, nur mit "laeuft" in der
    Projekt-Ergaenzung: die Mischung verschwindet."""
    _tree(
        tmp_path,
        {
            "docs/note.md": "Die Loesung laeuft fuer alle.\n",
            "docs/anchor.md": ANCHOR,
        },
        extras="laeuft",
    )
    result = _run(tmp_path)
    assert result.returncode == 0, result.stdout
    assert "+ 1 Projekt-Ergaenzung" in result.stdout


# --- 3. faellt GESCHLOSSEN --------------------------------------------------


def test_missing_word_list_is_an_error_not_a_pass(tmp_path: Path) -> None:
    _tree(tmp_path, {"docs/note.md": "Die Loesung ist fuer alle.\n"})
    (tmp_path / "docs" / ".docs-hygiene-extra-words.txt").unlink()
    result = _run(tmp_path)
    assert result.returncode == 2, result.stdout
    assert "faellt geschlossen" in result.stdout


def test_word_list_without_a_single_word_is_an_error(tmp_path: Path) -> None:
    """Eine Datei aus lauter Kommentaren ist keine Liste."""
    _tree(tmp_path, {"docs/note.md": "Die Loesung ist fuer alle.\n"})
    (tmp_path / "docs" / ".docs-hygiene-extra-words.txt").write_text(
        "# nur ein Kommentar\n", encoding="utf-8"
    )
    result = _run(tmp_path)
    assert result.returncode == 2, result.stdout
    assert "kein einziges Wort" in result.stdout


def test_missing_git_index_is_an_error_not_a_pass(tmp_path: Path) -> None:
    docs = tmp_path / "docs"
    docs.mkdir(parents=True)
    (docs / "note.md").write_text("Die Loesung ist fuer alle.\n", encoding="utf-8")
    (docs / ".docs-hygiene-extra-words.txt").write_text("uebungstypen\n", encoding="utf-8")
    result = _run(tmp_path)
    assert result.returncode == 2, result.stdout
    assert "faellt geschlossen" in result.stdout


def test_zero_target_files_is_an_error_not_a_pass(tmp_path: Path) -> None:
    """Nur Journale und die Wortliste: kein Ziel, also kein gruener Lauf."""
    _tree(tmp_path, {"docs/journal/j.md": "Die Loesung ist fuer alle.\n"})
    result = _run(tmp_path)
    assert result.returncode == 2, result.stdout
    assert "0 Zieldateien" in result.stdout


# --- 4. berichtet, WAS gemessen wurde --------------------------------------


def test_report_names_the_size_of_the_set_it_looked_at(tmp_path: Path) -> None:
    """Sonst liest sich "0 Funde" wie "0 Dateien angesehen"."""
    _tree(
        tmp_path,
        {"docs/a.md": "Die Loesung ist fuer alle.\n", "docs/b.md": "Nichts hier.\n"},
    )
    result = _run(tmp_path)
    assert "Dateien: 2 von 2 verfolgten" in result.stdout
    assert "manuscript-tools" in result.stdout


# --- 5. die Zahl bedeutet ueberall dasselbe --------------------------------


def test_untracked_file_is_invisible(tmp_path: Path) -> None:
    """Nicht gestagte Dateien fehlen im Commit und muessen deshalb auch
    dem Lauf fehlen (#2217) - sonst haengt die Zahl an der Maschine."""
    _tree(tmp_path, {"docs/note.md": "Alles korrekt hier.\n"})
    (tmp_path / "docs" / "lose.md").write_text("Die Loesung laeuft fuer alle.\n", encoding="utf-8")
    result = _run(tmp_path)
    assert result.returncode == 0, result.stdout
    assert "Ersetzungen: 0" in result.stdout


# --- Klassentrennung: nur A blockiert --------------------------------------


def test_line_that_was_already_mixed_does_not_block(tmp_path: Path) -> None:
    """Vorher schon gemischt: der Lauf verbessert teilweise und
    verschlechtert nichts. Wer das einrechnet, blockiert an einem
    Zustand, den er nicht verursacht hat."""
    _tree(
        tmp_path,
        {
            "docs/note.md": "Die Lösung laeuft fuer alle.\n",
            "docs/anchor.md": ANCHOR,
        },
    )
    result = _run(tmp_path)
    assert result.returncode == 0, result.stdout
    assert "A) neu gemischt (blockierend):     0" in result.stdout
    assert "B) vorher schon gemischt:          1" in result.stdout


def test_untouched_line_with_residues_is_reported_not_blocking(tmp_path: Path) -> None:
    """Bekannter Restbestand: die Zeile bleibt unangetastet, weil die
    Liste kein Wort darin kennt."""
    _tree(tmp_path, {"docs/note.md": "Das laeuft.\n", "docs/anchor.md": ANCHOR})
    result = _run(tmp_path)
    assert result.returncode == 0, result.stdout
    assert "C) ungeaenderte Zeilen mit Resten: 1" in result.stdout
    assert "dem Gate unsichtbar" in result.stdout


def test_spanish_prose_is_neither_rewritten_nor_counted(tmp_path: Path) -> None:
    """ "fuera" ist korrektes Spanisch und enthaelt "fuer" - der Fehler,
    an dem die Substring-Suche gescheitert ist (#2289)."""
    _tree(
        tmp_path,
        {
            "docs/es.md": "Si fuera visible en la red, la prueba continue.\n",
            "docs/anchor.md": ANCHOR,
        },
    )
    result = _run(tmp_path, "--apply")
    assert result.returncode == 0, result.stdout
    assert "Ersetzungen: 0" in result.stdout
    assert (tmp_path / "docs" / "es.md").read_text(encoding="utf-8") == (
        "Si fuera visible en la red, la prueba continue.\n"
    )


# --- Kopplung: schreiben nur bei A == 0 ------------------------------------


def test_apply_refuses_to_write_while_a_line_would_be_mixed(tmp_path: Path) -> None:
    """Die eigentliche Absicherung des Anwendungslaufs: der Nachweis ist
    nicht bloss ein Bericht, er haelt die Schreiboperation auf."""
    original = "Die Loesung laeuft fuer alle.\n"
    _tree(tmp_path, {"docs/note.md": original, "docs/anchor.md": ANCHOR})
    result = _run(tmp_path, "--apply")
    assert result.returncode == 1, result.stdout
    assert (tmp_path / "docs" / "note.md").read_text(encoding="utf-8") == original


def test_apply_writes_when_nothing_would_be_mixed(tmp_path: Path) -> None:
    _tree(tmp_path, {"docs/note.md": "Die Loesung ist fuer alle.\n"})
    result = _run(tmp_path, "--apply")
    assert result.returncode == 0, result.stdout
    assert (tmp_path / "docs" / "note.md").read_text(encoding="utf-8") == (
        "Die Lösung ist für alle.\n"
    )
    assert "Geschrieben" in result.stdout


def test_journal_stays_untouched(tmp_path: Path) -> None:
    """Datierte Aufzeichnungen dessen, was war - ein nachtraeglicher
    Umbau macht Rekonstruktionen daraus."""
    journal = "Die Loesung war fuer alle da.\n"
    _tree(tmp_path, {"docs/note.md": "Alles korrekt.\n", "docs/journal/j.md": journal})
    result = _run(tmp_path, "--apply")
    assert result.returncode == 0, result.stdout
    assert (tmp_path / "docs" / "journal" / "j.md").read_text(encoding="utf-8") == journal
    assert "Dateien: 1 von 2 verfolgten" in result.stdout


# --- Wurzelbestimmung: cwd, nicht __file__ ---------------------------------


def test_root_comes_from_the_working_directory_not_the_script_location(
    tmp_path: Path,
) -> None:
    """Das Skript liegt in einem anderen Checkout als der Baum, der
    gemessen wird - unter git worktree der Normalfall. Wer aus __file__
    ableitet, misst still im falschen Baum (lessons/core.md)."""
    _tree(tmp_path, {"docs/note.md": "Die Loesung ist fuer alle.\n"})
    result = _run_from_cwd(tmp_path)
    assert result.returncode == 0, result.stdout
    assert "Dateien: 1 von 1 verfolgten" in result.stdout


def test_outside_any_repo_is_an_error_not_a_pass(tmp_path: Path) -> None:
    outside = tmp_path / "kein-repo"
    outside.mkdir()
    result = _run_from_cwd(outside)
    assert result.returncode == 2, result.stdout
    assert "Repo-Wurzel nicht bestimmbar" in result.stdout


# --- Anker: Stammtreffer, nicht exakter Tokentreffer (#2313) ---------------


def test_residual_is_found_when_the_corpus_has_only_an_inflected_form(
    tmp_path: Path,
) -> None:
    """Der Fehler aus #2313: "sekundaere" wird zu "sekundäre", im Korpus
    steht aber "sekundären". Ein exakter Tokenvergleich findet nichts,
    der Rest entgeht der Erkennung - und weil der Nachweis an das
    Schreiben gekoppelt ist, wird aus dem zu engen Anker eine Zusicherung
    ohne Deckung."""
    _tree(
        tmp_path,
        {
            "docs/note.md": "Die Loesung ist keine sekundaere Karte.\n",
            "docs/anchor.md": "Wir behandeln die sekundären Karten zuletzt.\n",
        },
    )
    result = _run(tmp_path)
    assert result.returncode == 1, result.stdout
    assert "A) neu gemischt (blockierend):     1" in result.stdout
    assert "sekundaere" in result.stdout


def test_anchor_still_ignores_foreign_prose(tmp_path: Path) -> None:
    """Die Erweiterung darf den Anker nicht aufweichen: spanische und
    franzoesische Woerter haben keine deutsche Entsprechung im Korpus und
    duerfen auch als Stamm nicht anschlagen."""
    _tree(
        tmp_path,
        {
            "docs/note.md": "Die Loesung ist fuer alle.\n",
            "docs/es.md": "Si fuera visible, la prueba continue en la langue.\n",
            "docs/anchor.md": "Der Job läuft und die Prüfung ist fällig.\n",
        },
    )
    result = _run(tmp_path)
    assert result.returncode == 0, result.stdout
    assert "A) neu gemischt (blockierend):     0" in result.stdout


def test_short_fragments_do_not_attest_everything(tmp_path: Path) -> None:
    """Der Stammtreffer hat eine Untergrenze. Ohne sie wuerde ein kurzes
    Umlaut-Token im Korpus jede beliebige Form belegen."""
    _tree(
        tmp_path,
        {
            "docs/note.md": "Die Loesung ist fuer alle.\n",
            "docs/anchor.md": "Ein ü und ein är stehen hier allein.\n",
        },
    )
    result = _run(tmp_path)
    assert result.returncode == 0, result.stdout


# --- #2311 Anwendungslauf: die drei Ausnahmen -------------------------------


def test_review_witness_docs_stay_untouched(tmp_path: Path) -> None:
    """docs/review/** sind eingefrorene Wortlaut-Zeugen (Katalog-Exporte).
    Ein korrigierter Wert liesse das Dokument einen Katalogstand behaupten,
    den es nie gab - derselbe Grund wie beim Journal-Ausschluss."""
    witness = "- **de**: Hilfe oeffnen fuer alle\n"
    _tree(
        tmp_path,
        {
            "docs/review/i18n-v1/de.md": witness,
            "docs/note.md": "Das gilt fuer alle.\n",
            "docs/anchor.md": ANCHOR,
        },
    )
    result = _run(tmp_path, "--apply")
    assert result.returncode == 0, result.stdout
    assert (tmp_path / "docs/review/i18n-v1/de.md").read_text(encoding="utf-8") == witness
    assert "für" in (tmp_path / "docs/note.md").read_text(encoding="utf-8")


def test_generated_artefacts_stay_untouched(tmp_path: Path) -> None:
    """Generierte Doku (Kopfzeilen-Marker) wird ausgelassen: eine Korrektur
    macht den Byte-Gleichheits-Pin rot und wird beim naechsten Generatorlauf
    verworfen. Die Korrektur gehoert in den Generator."""
    de = "# Referenz\n\n> **Generiert** via make sync-schema. Nicht von Hand editieren.\n\nGilt fuer alle.\n"
    en = "# Reference\n\n> **Generated** via make sync-schema. Do not edit by hand.\n\nGilt fuer alle.\n"
    _tree(
        tmp_path,
        {
            "docs/help/de/ref.md": de,
            "docs/help/en/ref.md": en,
            "docs/note.md": "Das gilt fuer alle.\n",
            "docs/anchor.md": ANCHOR,
        },
    )
    result = _run(tmp_path, "--apply")
    assert result.returncode == 0, result.stdout
    assert (tmp_path / "docs/help/de/ref.md").read_text(encoding="utf-8") == de
    assert (tmp_path / "docs/help/en/ref.md").read_text(encoding="utf-8") == en
    assert "für" in (tmp_path / "docs/note.md").read_text(encoding="utf-8")


def test_uppercase_identifier_is_neither_rewritten_nor_blocking(tmp_path: Path) -> None:
    """Versalien-Bezeichner sind Grep-Schluessel, kein Fliesstext: eine
    Doku-seitige Korrektur spaltet die Schreibweise vom Code ab. Der Lauf
    laesst sie stehen, und sie blockieren den Nachweis nicht als Rest."""
    _tree(
        tmp_path,
        {
            "docs/policy.md": "Der Schluessel FUNKTION-NICHT-VERFUEGBAR gilt fuer alle.\n",
            "docs/anchor.md": ANCHOR + "Die Funktion ist verfügbar und der Schlüssel passt.\n",
        },
        extras="uebungstypen\nschluessel",
    )
    result = _run(tmp_path, "--apply")
    assert result.returncode == 0, result.stdout
    rewritten = (tmp_path / "docs/policy.md").read_text(encoding="utf-8")
    assert "FUNKTION-NICHT-VERFUEGBAR" in rewritten
    assert "Schlüssel" in rewritten and "für" in rewritten
