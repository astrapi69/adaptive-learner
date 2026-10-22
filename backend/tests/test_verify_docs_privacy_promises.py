"""No catalog value, help page or UI fallback promises that no personal data is sent (#3812).

Two AI dialogs told the learner, at the moment of deciding, that no personal
data is transmitted, while the browser sends the request with the learner's
IP address and API key, and the lesson text can itself be personal. The same
promise sat in all 11 catalogs and, in another wording, in the Japanese FAQ.

The probe table seeds every language with at least one sentence that makes
the promise (it must be found) and at least one legitimate sentence (it must
not be found): the replacement text of the dialogs and a sentence that only
says that text can contain personal data.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from verify_docs_privacy_promises import (  # noqa: E402
    CHECK,
    HISTORICAL,
    HISTORICAL_PAGES,
    PROMISE_PATTERNS,
    STEMS,
    check_privacy_promises,
    promise_hits,
)

# (language, id, sentence that promises no personal data is sent)
PROMISES = [
    (
        "en",
        "shipped",
        "Your lesson cards will be sent for review. No personal data is transmitted.",
    ),
    ("en", "verb-first", "The check does not send any personal data to the provider."),
    ("en", "never-sent", "Your personal data is never sent to the AI provider."),
    ("de", "shipped-share", "Keine persönlichen Daten werden übermittelt."),
    ("de", "shipped-check", "Es werden keine personenbezogenen Daten übertragen."),
    ("de", "verb-first", "Die App sendet keine personenbezogenen Daten an den Anbieter."),
    ("es", "shipped", "No se transmiten datos personales."),
    ("es", "ningun", "Ningún dato personal se envía al proveedor."),
    ("fr", "shipped", "Aucune donnée personnelle n'est transmise."),
    ("fr", "never-sent", "Tes données personnelles ne sont jamais envoyées."),
    ("pt", "shipped", "Nenhum dado pessoal é transmitido."),
    ("pt", "not-sent", "Os seus dados pessoais não são enviados."),
    ("el", "shipped-share", "Δεν μεταδίδονται προσωπικά δεδομένα."),
    ("el", "shipped-check", "Δεν μεταβιβάζονται προσωπικά δεδομένα."),
    ("tr", "shipped-share", "Hiçbir kişisel veri iletilmez."),
    ("tr", "shipped-check", "Kişisel veri aktarılmaz."),
    ("ja", "shipped-share", "個人データは送信されません。"),
    ("ja", "shipped-check", "個人情報は送信されません。"),
    ("ko", "shipped", "개인 데이터는 전송되지 않습니다."),
    ("hi", "shipped-share", "कोई व्यक्तिगत डेटा प्रेषित नहीं किया जाता।"),
    ("hi", "shipped-check", "कोई व्यक्तिगत डेटा नहीं भेजा जाता।"),
    ("id", "shipped", "Tidak ada data pribadi yang dikirimkan."),
    ("id", "not-sent", "Data pribadi tidak dikirim ke penyedia."),
]

# (language, id, legitimate sentence that must pass)
LEGITIMATE = [
    (
        "en",
        "new-note",
        "Only your cards are sent (front, back, notes), no profile and no learning progress. "
        "As with every request, your AI provider also receives, among other things, your IP "
        "address and your API key.",
    ),
    ("en", "may-contain", "Text you write into your own cards can itself be personal data."),
    ("en", "export", "The exported file contains no personal data."),
    (
        "de",
        "new-note",
        "Gesendet werden nur deine Lernkarten (Vorderseite, Rückseite, Notizen), kein Profil "
        "und kein Lernfortschritt. Wie bei jeder Anfrage erhält dein KI-Anbieter dabei unter "
        "anderem deine IP-Adresse und deinen API-Schlüssel.",
    ),
    (
        "de",
        "may-contain",
        "Was du in Karten schreibst, kann selbst personenbezogene Daten enthalten.",
    ),
    (
        "es",
        "new-note",
        "Solo se envían tus tarjetas (anverso, reverso, notas), sin tu perfil ni tu progreso.",
    ),
    ("es", "may-contain", "Lo que escribes en tus tarjetas puede contener datos personales."),
    (
        "fr",
        "new-note",
        "Seules tes cartes sont envoyées (recto, verso, notes), sans ton profil ni ta progression.",
    ),
    (
        "fr",
        "may-contain",
        "Ce que tu écris dans tes cartes peut contenir des données personnelles.",
    ),
    (
        "pt",
        "new-note",
        "Só são enviados os seus cartões (frente, verso, notas), sem o seu perfil nem o seu progresso.",
    ),
    ("pt", "may-contain", "O que escreve nos seus cartões pode conter dados pessoais."),
    (
        "el",
        "new-note",
        "Αποστέλλονται μόνο οι κάρτες σου, χωρίς το προφίλ και την πρόοδό σου.",
    ),
    ("el", "may-contain", "Ό,τι γράφεις στις κάρτες σου μπορεί να περιέχει προσωπικά δεδομένα."),
    (
        "tr",
        "new-note",
        "Yalnızca kartlarınız gönderilir (ön yüz, arka yüz, notlar), profiliniz ve "
        "ilerlemeniz gönderilmez.",
    ),
    ("tr", "may-contain", "Kartlarınıza yazdıklarınız kişisel veri içerebilir."),
    (
        "ja",
        "new-note",
        "送信されるのは学習カード（表面、裏面、メモ）のみで、プロフィールや学習の進捗は送信されません。",
    ),
    (
        "ja",
        "export",
        "エクスポートされたファイルにはレッスンのコンテンツのみが含まれます。"
        "進捗、エラー履歴、個人情報は含まれません。",
    ),
    (
        "ko",
        "new-note",
        "레슨 카드(앞면, 뒷면, 메모)만 전송되며, 프로필과 학습 진행 상황은 전송되지 않습니다.",
    ),
    ("ko", "may-contain", "카드에 쓴 내용에는 개인 정보가 포함될 수 있습니다."),
    (
        "hi",
        "new-note",
        "केवल आपके कार्ड भेजे जाते हैं, आपकी प्रोफ़ाइल और सीखने की प्रगति नहीं।",
    ),
    ("hi", "may-contain", "आपके कार्ड में लिखी बातों में व्यक्तिगत डेटा हो सकता है।"),
    (
        "id",
        "new-note",
        "Hanya kartu pelajaranmu yang dikirim (depan, belakang, catatan), tanpa profil dan "
        "kemajuan belajarmu.",
    ),
    ("id", "may-contain", "Isi kartu yang kamu tulis bisa memuat data pribadi."),
]

CATALOG_LANGS = sorted(p.stem for p in (REPO / "backend" / "config" / "i18n").glob("*.yaml"))


class _Report:
    def __init__(self) -> None:
        self.fails: list[str] = []
        self.notes: list[str] = []

    def fail(self, check: str, message: str, fixed: bool = False) -> None:
        assert check == CHECK
        self.fails.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)


@pytest.mark.parametrize(
    ("lang", "text"),
    [(lang, text) for lang, _, text in PROMISES],
    ids=[f"{lang}-{name}" for lang, name, _ in PROMISES],
)
def test_finds_the_promise(lang: str, text: str) -> None:
    hits = promise_hits(text)
    assert hits, f"no hit for {text!r}"
    assert lang in {hit.lang for hit in hits}


@pytest.mark.parametrize(
    "text",
    [text for _, _, text in LEGITIMATE],
    ids=[f"{lang}-{name}" for lang, name, _ in LEGITIMATE],
)
def test_passes_a_legitimate_sentence(text: str) -> None:
    assert promise_hits(text) == []


def test_every_catalog_language_has_patterns_and_both_kinds_of_probe() -> None:
    assert CATALOG_LANGS, "no catalogs found"
    assert sorted(PROMISE_PATTERNS) == CATALOG_LANGS
    assert {lang for lang, _, _ in PROMISES} == set(CATALOG_LANGS)
    assert {lang for lang, _, _ in LEGITIMATE} == set(CATALOG_LANGS)


def test_every_pattern_names_a_stem_so_the_prefilter_never_hides_it() -> None:
    for lang, patterns in PROMISE_PATTERNS.items():
        for pattern in patterns:
            assert any(stem in pattern.lower() for stem in STEMS), (lang, pattern)


def test_finds_a_promise_wrapped_over_two_lines_and_names_its_first_line() -> None:
    page = "# FAQ\n\nあなたの学習プロフィール、XP、バッジ、その他の個人データは\nAI プロバイダーには送信されません。\n"
    hits = promise_hits(page)
    assert [(hit.line, hit.lang) for hit in hits] == [(3, "ja")]


@pytest.mark.parametrize(
    "catalog",
    [
        "  ai_privacy_link: 개인정보 처리방침\n  sync: 서버로 전송되지 않습니다\n",
        '{"ai_privacy_link": "개인정보 처리방침", "sync": "전송되지 않습니다"}',
        "  label: Keine persönlichen Daten\n  hint: gesendet am Montag\n",
    ],
    ids=["ko-yaml", "ko-json", "de-yaml"],
)
def test_a_promise_never_spans_two_catalog_values(catalog: str) -> None:
    assert promise_hits(catalog) == []


def test_reports_one_hit_where_two_patterns_overlap() -> None:
    assert len(promise_hits("Hiçbir kişisel veri iletilmez.")) == 1


@pytest.mark.parametrize(
    "page",
    [
        "```\nNo personal data is transmitted.\n```\n",
        "<!-- No personal data is transmitted. -->\n",
        "The old text `No personal data is transmitted.` is gone.\n",
    ],
    ids=["fenced-code", "html-comment", "inline-code"],
)
def test_markdown_code_and_comments_are_not_prose(page: str) -> None:
    assert promise_hits(page, markdown=True) == []


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _repo(tmp_path: Path) -> Path:
    """A tree with one clean file in every group the check requires."""
    _write(
        tmp_path / "backend/config/i18n/en.yaml", "content:\n  privacy: Only your cards are sent.\n"
    )
    _write(
        tmp_path / "frontend/src/data/i18n/en.json", '{"privacy": "Only your cards are sent."}\n'
    )
    _write(tmp_path / "backend/config/help/concepts.en.yaml", "x: A learning project.\n")
    _write(tmp_path / "docs/help/en/user-guide/faq.md", "# FAQ\n\nYour IP address goes along.\n")
    _write(tmp_path / "frontend/src/components/Note.tsx", 'export const label = "Only cards";\n')
    return tmp_path


def test_passes_a_clean_tree_and_reports_what_it_scanned(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _write(repo / "README.md", "# App\n")
    _write(repo / "docs/development/notes.md", "Nothing to promise.\n")
    report = _Report()
    check_privacy_promises(report, repo)
    assert report.fails == []
    note = next(note for note in report.notes if note.startswith(CHECK))
    assert "scanned 7 files" in note
    assert "catalogs 2" in note and "help pages 1" in note and "UI sources 1" in note


@pytest.mark.parametrize(
    ("rel", "text"),
    [
        ("backend/config/i18n/de.yaml", "privacy: Keine persönlichen Daten werden übermittelt.\n"),
        ("frontend/src/data/i18n/ko.json", '{"privacy": "개인 데이터는 전송되지 않습니다."}\n'),
        (
            "backend/config/help/features.fr.yaml",
            "x: |\n  Aucune donnée personnelle\n  n'est transmise.\n",
        ),
        ("docs/help/ja/user-guide/faq.md", "個人データは\nAI プロバイダーには送信されません。\n"),
        ("docs/development/ai.md", "The check does not send any personal data.\n"),
        ("README.md", "No personal data is transmitted.\n"),
        ("frontend/src/components/Dialog.tsx", 't("k", "No personal data is transmitted.")\n'),
    ],
    ids=[
        "catalog-yaml",
        "catalog-json",
        "glossary",
        "help-page",
        "other-docs",
        "readme",
        "ui-fallback",
    ],
)
def test_fails_on_a_promise_with_file_and_line(tmp_path: Path, rel: str, text: str) -> None:
    repo = _repo(tmp_path)
    _write(repo / rel, text)
    report = _Report()
    check_privacy_promises(report, repo)
    assert len(report.fails) == 1
    assert report.fails[0].startswith(f"{rel}:")
    assert "#3812" in report.fails[0]


@pytest.mark.parametrize(
    "rel",
    [
        "docs/explorations/EXP-033-ai-content-validation.md",
        "docs/review/i18n-v1.98.0/07-content.md",
        "docs/journal/chat-journal-session-2026-10-21.md",
        "docs/roadmap-archive/2026-10.md",
        "docs/help/de/changelog.md",
        "frontend/src/components/Dialog.test.tsx",
    ],
    ids=["explorations", "review", "journal", "roadmap-archive", "help-changelog", "ui-test"],
)
def test_historical_records_and_tests_are_exempt(tmp_path: Path, rel: str) -> None:
    repo = _repo(tmp_path)
    _write(repo / rel, "Keine persönlichen Daten werden übermittelt.\n")
    report = _Report()
    check_privacy_promises(report, repo)
    assert report.fails == []


def test_the_exempt_set_is_the_historical_records_only() -> None:
    assert HISTORICAL == (
        "docs/explorations/",
        "docs/review/",
        "docs/journal/",
        "docs/roadmap-archive/",
    )
    assert HISTORICAL_PAGES == ("changelog.md",)


@pytest.mark.parametrize(
    "missing",
    [
        "backend/config/i18n/en.yaml",
        "frontend/src/data/i18n/en.json",
        "backend/config/help/concepts.en.yaml",
        "docs/help/en/user-guide/faq.md",
        "frontend/src/components/Note.tsx",
    ],
    ids=["backend-catalogs", "frontend-catalogs", "glossary", "help-pages", "ui-sources"],
)
def test_fails_closed_when_a_required_group_is_empty(tmp_path: Path, missing: str) -> None:
    repo = _repo(tmp_path)
    (repo / missing).unlink()
    report = _Report()
    check_privacy_promises(report, repo)
    assert len(report.fails) == 1
    assert "basis missing" in report.fails[0]


def test_the_shipped_tree_makes_no_promise() -> None:
    report = _Report()
    check_privacy_promises(report, REPO)
    assert report.fails == []
