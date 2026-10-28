"""No catalog value, help page or UI fallback promises more privacy than the app keeps.

#3812: two AI dialogs told the learner, at the moment of deciding, that no
personal data is transmitted, while the browser sends the request with the
learner's IP address and API key, and the lesson text can itself be personal.
The same promise sat in all 11 catalogs and, in another wording, in the
Japanese FAQ.

#3829: four more phrasings in the help and the READMEs: nothing about the
words you struggle with is sent anywhere, nothing is uploaded to a server,
all your data stays in your browser, and nothing is sent to a server except
the AI calls.

The probe table seeds every language with at least one sentence that makes
the promise (it must be found) and at least one legitimate sentence (it must
not be found): the replacement text of the dialogs and a sentence that only
says that text can contain personal data. For #3829 it seeds each phrasing in
every language it occurred in, as develop had it, line breaks included, and
the true sentences that come closest to it: the backup note and the Docker
answer, which say the same words about one feature, and the privacy policy's
own summary.
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
    # #3829, user-guide/lessons.md: nothing about your mistakes is sent anywhere.
    (
        "de",
        "3829-struggle",
        "Nichts darüber,\nmit welchen Wörtern du kämpfst, wird irgendwohin gesendet.",
    ),
    ("en", "3829-struggle", "Nothing about which\nwords you struggle with is sent anywhere."),
    (
        "es",
        "3829-struggle",
        "No\nse envía a ningún sitio nada sobre con qué palabras te cuesta.",
    ),
    ("pt", "3829-struggle", "Nada sobre as palavras com que lutas é enviado\npara qualquer lado."),
    (
        "tr",
        "3829-struggle",
        "Hangi kelimelerle zorlandığına dair\nhiçbir şey herhangi bir yere gönderilmez.",
    ),
    (
        "el",
        "3829-struggle",
        "Τίποτα σχετικά με\nτο ποιες λέξεις σε δυσκολεύουν δεν αποστέλλεται πουθενά.",
    ),
    (
        "fr",
        "3829-struggle",
        "Rien sur les mots avec lesquels tu luttes n'est envoyé\noù que ce soit.",
    ),
    (
        "ja",
        "3829-struggle",
        "あなたがどの単語で苦労しているかについて、何かが\nどこかに送信されることはありません。",
    ),
    # #3829, user-guide/my-lessons.md: nothing is uploaded to a server.
    (
        "de",
        "3829-uploaded",
        "Alles\nfunktioniert offline; nichts wird auf einen Server hochgeladen.",
    ),
    ("en", "3829-uploaded", "Everything works offline; nothing is uploaded to a\nserver."),
    ("es", "3829-uploaded", "Todo funciona sin\nconexión; nada se sube a un servidor."),
    ("el", "3829-uploaded", "Όλα λειτουργούν offline· τίποτα δεν ανεβαίνει\nσε διακομιστή."),
    ("ja", "3829-uploaded", "すべてオフラインで動作し、サーバーには何もアップロードされません。"),
    ("pt", "3829-uploaded", "Tudo funciona offline; nada é enviado para um\nservidor."),
    ("tr", "3829-uploaded", "Her şey çevrimdışı çalışır; hiçbir şey\nsunucuya yüklenmez."),
    # #3829, README.md, README-de.md, user-guide/getting-started.md: all your
    # data stays in your browser.
    ("en", "3829-stays", "all your data stays in\nyour browser (IndexedDB)"),
    ("de", "3829-stays-readme", "alle Daten\nbleiben in deinem Browser (IndexedDB)"),
    ("de", "3829-stays", "alle deine Daten bleiben in\ndeinem Browser (IndexedDB)"),
    ("es", "3829-stays", "todos tus datos permanecen en\ntu navegador (IndexedDB)"),
    ("fr", "3829-stays", "toutes tes données restent\ndans ton navigateur (IndexedDB)"),
    ("pt", "3829-stays", "todos os teus dados permanecem no\nteu browser (IndexedDB)"),
    ("tr", "3829-stays", "tüm verilerin tarayıcında (IndexedDB)\nkalır"),
    (
        "el",
        "3829-stays",
        "όλα τα δεδομένα σου παραμένουν\nστο πρόγραμμα περιήγησής σου (IndexedDB)",
    ),
    ("ja", "3829-stays", "あなたのデータはすべて\nブラウザ（IndexedDB）に留まり"),
    # #3829, user-guide/faq.md item 7: nothing is sent to a server, except ...
    (
        "de",
        "3829-except",
        "alles in deinem Browser, nichts\n   wird an einen Server gesendet (außer deine KI-Aufrufe).",
    ),
    (
        "en",
        "3829-except",
        "everything in your browser,\n   nothing sent to a server (except your AI calls).",
    ),
    (
        "es",
        "3829-except",
        "todo en tu navegador, nada enviado\n   a un servidor (excepto tus llamadas a la IA).",
    ),
    (
        "pt",
        "3829-except",
        "tudo no seu navegador, nada\n   enviado para um servidor (exceto as suas chamadas de IA).",
    ),
    (
        "tr",
        "3829-except",
        "her şey tarayıcınızda, hiçbir şey\n"
        "   bir sunucuya gönderilmez (yapay zeka çağrılarınız hariç).",
    ),
    (
        "el",
        "3829-except",
        "όλα στο browser σου, τίποτα\n   δεν αποστέλλεται σε διακομιστή (εκτός από κλήσεις ΤΝ).",
    ),
]

# (language, id, legitimate sentence that must pass)
LEGITIMATE = [
    (
        "en",
        "new-note",
        "Only your cards are sent (front, back, notes), no profile and no learning progress. "
        "As with every request, your AI provider also receives your IP address and your API key.",
    ),
    ("en", "may-contain", "Text you write into your own cards can itself be personal data."),
    ("en", "export", "The exported file contains no personal data."),
    (
        "de",
        "new-note",
        "Gesendet werden nur deine Lernkarten (Vorderseite, Rückseite, Notizen), kein Profil "
        "und kein Lernfortschritt. Wie bei jeder Anfrage erhält dein KI-Anbieter dabei deine "
        "IP-Adresse und deinen API-Schlüssel.",
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
    # #3829: the backup note says "nothing is sent to a server" about one
    # feature, where it is true; only the FAQ's "except ..." made it a claim
    # about the whole app, and only "Tudo funciona offline" makes the pt
    # sentence of my-lessons one.
    (
        "en",
        "3829-backup-note",
        "It is only stored\n    wherever you put it - nothing is sent to a server.",
    ),
    (
        "de",
        "3829-backup-note",
        "Es wird nur dort\n    gespeichert, wohin du es legst - nichts wird an einen Server\n"
        "    gesendet.",
    ),
    (
        "es",
        "3829-backup-note",
        "Solo se\n    guarda allí donde tú la coloques: no se envía nada a ningún\n    servidor.",
    ),
    (
        "pt",
        "3829-backup-note",
        "É guardado apenas\n    onde o colocares - nada é enviado para um servidor.",
    ),
    (
        "tr",
        "3829-backup-note",
        "Yalnızca koyduğun yere\n    kaydedilir - hiçbir şey bir sunucuya gönderilmez.",
    ),
    (
        "el",
        "3829-backup-note",
        "Αποθηκεύεται\n    μόνο εκεί όπου το βάζεις - τίποτα δεν αποστέλλεται σε κάποιον\n    server.",
    ),
    (
        "ja",
        "3829-backup-note",
        "あなたが\n    置いた場所にのみ保存され、サーバーには何も送信されません。",
    ),
    # #3829: the Docker answer says "nothing about your data is sent" to one
    # company, by one act; the book import says "nothing is uploaded" about one
    # file; a code comment says "nothing is sent to any server" about one buffer.
    (
        "en",
        "3829-docker",
        "Your learning data stays local; nothing about your data is\n"
        "sent to Docker, Inc. by installing Docker.",
    ),
    (
        "es",
        "3829-docker",
        "Tus datos de aprendizaje permanecen locales;\n"
        "al instalar Docker no se envía nada sobre tus datos a Docker, Inc.",
    ),
    (
        "tr",
        "3829-docker",
        "Öğrenme verilerin yerel\nkalır; Docker'ı kurmakla verilerine ilişkin hiçbir şey "
        "Docker, Inc.\nşirketine gönderilmez.",
    ),
    (
        "el",
        "3829-docker",
        "με την εγκατάσταση του Docker δεν αποστέλλεται\nτίποτα από τα δεδομένα σου στη Docker, Inc.",
    ),
    (
        "ja",
        "3829-docker",
        "Docker をインストールしても、あなたのデータに関する\n"
        "情報が Docker, Inc. に送られることはありません。",
    ),
    (
        "en",
        "3829-book-import",
        "The file is parsed\nentirely **in the browser** - nothing is uploaded - and the",
    ),
    (
        "de",
        "3829-book-import",
        "vollständig **im Browser** zerlegt - nichts wird hochgeladen - und",
    ),
    (
        "tr",
        "3829-book-import",
        "Dosya tamamen\n**tarayıcıda** ayrıştırılır - hiçbir şey bir sunucuya yüklenmez -",
    ),
    (
        "pt",
        "3829-book-import",
        "O ficheiro é analisado\ninteiramente **no navegador** - nada é enviado para um servidor - e",
    ),
    (
        "el",
        "3829-book-import",
        "αναλύεται εξ ολοκλήρου **στο πρόγραμμα περιήγησης** - τίποτα δεν\n"
        "αποστέλλεται σε διακομιστή - και",
    ),
    (
        "ja",
        "3829-book-import",
        "ファイルは完全に**ブラウザ内で**解析され - 何も\nアップロードされません -",
    ),
    ("en", "3829-code-comment", "but still dies with the tab. Nothing is sent to any server."),
    (
        "fr",
        "3829-faq",
        "Rien - pas vos sessions, pas vos erreurs, pas votre progression - n'est\n"
        "envoyé à un serveur Adaptive Learner.",
    ),
    # #3829: the privacy policy's own summary, which the new help texts reuse.
    (
        "en",
        "3829-policy",
        "Your learning progress, statistics and settings stay in\nyour browser, for you.",
    ),
    (
        "de",
        "3829-policy",
        "Ihr Lernfortschritt, Ihre Statistiken und\nIhre Einstellungen bleiben in Ihrem Browser, "
        "für Sie.",
    ),
    (
        "es",
        "3829-policy",
        "Su progreso, sus estadísticas y sus ajustes se\nquedan en su navegador, para usted.",
    ),
    (
        "fr",
        "3829-policy",
        "Votre progression,\nvos statistiques et vos paramètres restent dans votre navigateur, "
        "pour vous.",
    ),
    (
        "pt",
        "3829-policy",
        "O seu progresso, as suas\nestatísticas e as suas definições ficam no seu browser, "
        "para si.",
    ),
    (
        "tr",
        "3829-policy",
        "Öğrenme ilerlemeniz,\nistatistikleriniz ve ayarlarınız tarayıcınızda, sizin için kalır.",
    ),
    (
        "el",
        "3829-policy",
        "Η πρόοδός σας, τα στατιστικά σας και οι ρυθμίσεις σας παραμένουν στο\n"
        "πρόγραμμα περιήγησής σας, για εσάς.",
    ),
    (
        "ja",
        "3829-policy",
        "お客様の学習の進捗、統計、設定は、\nお客様のブラウザ内に、お客様のためにとどまります。",
    ),
    # #3829: the new master texts, as #3841 reworded the lessons, local-mode
    # and FAQ passages.
    (
        "en",
        "3829-lessons",
        "All lesson progress, element-error rows, review-queue states and\nscheduling data are "
        "stored: in local mode in your browser\n(IndexedDB), in API mode in the database of the "
        "backend the app is\nconnected to; whoever runs that backend has access to it. Lesson\n"
        "progress and voice recordings made offline in API mode wait in your\nbrowser until "
        "they are transferred. Others get parts of them only when a feature needs them.",
    ),
    (
        "de",
        "3829-lessons",
        "Alle Lektionsfortschritte, Element-Fehler-Zeilen,\nWiederholungs-Warteschlangen-Zustände "
        "und Planungsdaten\nwerden gespeichert: im Lokal-Modus in deinem Browser (IndexedDB),\n"
        "im API-Modus in der Datenbank des Backends, mit dem die App\nverbunden ist; wer dieses "
        "Backend betreibt, hat Zugriff darauf.\nLektionsfortschritt und Sprachaufnahmen, die im "
        "API-Modus offline\nentstehen, warten bis zur Übertragung in deinem Browser. Teile davon "
        "erhalten andere nur, wenn eine Funktion sie braucht.",
    ),
    (
        "en",
        "3829-my-lessons",
        "These steps work offline, and your lessons stay on your\ndevice until you use a feature "
        "that passes them on, for example a community contribution (pull request).",
    ),
    (
        "de",
        "3829-my-lessons",
        "Diese Schritte funktionieren offline, und deine Lektionen bleiben auf\ndeinem Gerät, bis "
        "du eine Funktion nutzt, die sie weitergibt.",
    ),
    (
        "en",
        "3829-local-mode",
        "It runs in **local mode**: among other things, your progress, your\nstatistics, your "
        "settings and your API keys are stored in your\nbrowser. Others get parts of them only "
        "when a feature needs them, for\nexample GitHub, when the app asks for new content on "
        "its own at\nstart-up. AI calls are an example too: they go straight from your\nbrowser "
        "to your AI provider.",
    ),
    (
        "de",
        "3829-local-mode",
        "Die öffentliche PWA läuft im **Local-Modus**: In deinem Browser\ngespeichert werden "
        "unter anderem dein Lernfortschritt, deine\nStatistiken, deine Einstellungen und deine "
        "API-Schlüssel. Teile\ndavon erhalten andere nur, wenn eine Funktion sie braucht, zum\n"
        "Beispiel GitHub, wenn die App beim Start von selbst nach neuen\nInhalten fragt.",
    ),
    (
        "en",
        "3829-faq",
        "in local mode your browser stores,\n   among other things, progress, statistics and "
        "settings; others\n   get parts of them only when a feature needs them. The app\n"
        "   contacts servers when a feature needs it.",
    ),
    (
        "de",
        "3829-faq",
        "Im Lokal-Modus speichert dein Browser\n   unter anderem Lernfortschritt, Statistiken "
        "und Einstellungen;\n   Teile davon erhalten andere nur, wenn eine Funktion sie braucht.",
    ),
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
        (
            "README-de.md",
            "# App\n\nDie öffentliche PWA läuft im **Local-Modus**, alle Daten\n"
            "bleiben in deinem Browser (IndexedDB).\n",
        ),
    ],
    ids=[
        "catalog-yaml",
        "catalog-json",
        "glossary",
        "help-page",
        "other-docs",
        "readme",
        "ui-fallback",
        "readme-3829",
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


def test_a_3829_finding_names_the_line_it_starts_on_and_its_issue(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    rel = "docs/help/en/user-guide/my-lessons.md"
    _write(
        repo / rel, "# My Lessons\n\nEverything works offline; nothing is uploaded to a\nserver.\n"
    )
    report = _Report()
    check_privacy_promises(report, repo)
    assert len(report.fails) == 1
    assert report.fails[0].startswith(f"{rel}:3:")
    assert "#3829" in report.fails[0]


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
