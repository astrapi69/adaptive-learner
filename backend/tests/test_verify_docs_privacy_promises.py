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
        "The check sends your AI provider the cards of the set (identifier, front, back, notes) as "
        "well as the set's source language, target language and level, but neither your profile "
        "nor your learning progress. In addition, as with every AI request, your AI provider "
        "receives, among other things, your IP address and your API key.",
    ),
    ("en", "may-contain", "Text you write into your own cards can itself be personal data."),
    ("en", "export", "The exported file contains no personal data."),
    (
        "de",
        "new-note",
        "Die Prüfung schickt deinem KI-Anbieter die Karten des Sets (Kennung, Vorderseite, "
        "Rückseite, Notizen) sowie Ausgangssprache, Zielsprache und Niveau des Sets, aber weder "
        "dein Profil noch deinen Lernfortschritt. Außerdem erhält dein KI-Anbieter, wie bei jeder "
        "KI-Anfrage, unter anderem deine IP-Adresse und deinen API-Schlüssel.",
    ),
    (
        "de",
        "may-contain",
        "Was du in Karten schreibst, kann selbst personenbezogene Daten enthalten.",
    ),
    (
        "es",
        "new-note",
        "La revisión envía a tu proveedor de IA las tarjetas del conjunto (identificador, anverso, "
        "reverso, notas), así como el idioma de origen, el idioma de destino y el nivel del "
        "conjunto, pero ni tu perfil ni tu progreso de aprendizaje. Además, como en cada solicitud "
        "a la IA, tu proveedor de IA recibe, entre otras cosas, tu dirección IP y tu clave API.",
    ),
    ("es", "may-contain", "Lo que escribes en tus tarjetas puede contener datos personales."),
    (
        "fr",
        "new-note",
        "La vérification envoie à ton fournisseur d'IA les cartes de l'ensemble (identifiant, "
        "recto, verso, notes) ainsi que la langue source, la langue cible et le niveau de "
        "l'ensemble, mais ni ton profil ni ta progression. De plus, comme pour chaque requête à "
        "l'IA, ton fournisseur d'IA reçoit, entre autres, ton adresse IP et ta clé API.",
    ),
    (
        "fr",
        "may-contain",
        "Ce que tu écris dans tes cartes peut contenir des données personnelles.",
    ),
    (
        "pt",
        "new-note",
        "A verificação envia ao seu provedor de IA os cartões do conjunto (identificador, frente, "
        "verso, notas), bem como o idioma de origem, o idioma de destino e o nível do conjunto, "
        "mas nem o seu perfil nem o seu progresso. Além disso, como em cada pedido à IA, o seu "
        "provedor de IA recebe, entre outras coisas, o seu endereço IP e a sua chave de API.",
    ),
    ("pt", "may-contain", "O que escreve nos seus cartões pode conter dados pessoais."),
    (
        "el",
        "new-note",
        "Ο έλεγχος στέλνει στον πάροχο ΤΝ σου τις κάρτες του σετ (αναγνωριστικό, μπροστινή και "
        "πίσω όψη, σημειώσεις), καθώς και τη γλώσσα προέλευσης, τη γλώσσα-στόχο και το επίπεδο του "
        "σετ, αλλά ούτε το προφίλ σου ούτε την πρόοδό σου. Επιπλέον, όπως σε κάθε αίτημα προς την "
        "ΤΝ, ο πάροχος ΤΝ σου λαμβάνει, μεταξύ άλλων, τη διεύθυνση IP σου και το κλειδί API σου.",
    ),
    ("el", "may-contain", "Ό,τι γράφεις στις κάρτες σου μπορεί να περιέχει προσωπικά δεδομένα."),
    (
        "tr",
        "new-note",
        "Denetim, yapay zekâ sağlayıcınıza setin kartlarını (tanımlayıcı, ön yüz, arka yüz, "
        "notlar), ayrıca setin kaynak dilini, hedef dilini ve seviyesini gönderir, ancak ne "
        "profilinizi ne de öğrenme ilerlemenizi gönderir. Ek olarak yapay zekâ sağlayıcınız, her "
        "yapay zekâ isteğinde olduğu gibi, başka şeylerin yanı sıra IP adresinizi ve API "
        "anahtarınızı da alır.",
    ),
    ("tr", "may-contain", "Kartlarınıza yazdıklarınız kişisel veri içerebilir."),
    (
        "ja",
        "new-note",
        "この確認では、設定済みのAIプロバイダーに、セットのカード（識別子、表面、裏面、メモ）と、"
        "セットの出発言語、対象言語、レベルを送信しますが、"
        "あなたのプロフィールと学習の進捗は送信しません。さらに、すべての AI リクエストと同様に、"
        "設定済みのAIプロバイダーはほかの情報とともに、あなたの IP アドレスと API "
        "キーも受け取ります。",
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
        "이 검사는 설정된 AI 제공자에 세트의 카드(식별자, 앞면, 뒷면, 메모)와 세트의 출처 언어, "
        "목표 언어, 레벨을 보내지만, 프로필도 학습 진행 상황도 보내지 않습니다. 또한 모든 AI "
        "요청과 마찬가지로 설정된 AI 제공자는 IP 주소와 API 키를 비롯한 여러 정보를 받습니다.",
    ),
    ("ko", "may-contain", "카드에 쓴 내용에는 개인 정보가 포함될 수 있습니다."),
    (
        "hi",
        "new-note",
        "जाँच आपके AI प्रदाता को सेट के कार्ड (पहचानकर्ता, आगे का भाग, पीछे का भाग, नोट्स) और साथ "
        "ही सेट की स्रोत भाषा, लक्ष्य भाषा और स्तर भेजती है, लेकिन न आपकी प्रोफ़ाइल भेजती है और न "
        "ही आपकी सीखने की प्रगति। इसके अलावा, हर AI अनुरोध की तरह, आपका AI प्रदाता अन्य जानकारी के "
        "साथ आपका IP पता और आपकी API कुंजी भी प्राप्त करता है।",
    ),
    ("hi", "may-contain", "आपके कार्ड में लिखी बातों में व्यक्तिगत डेटा हो सकता है।"),
    (
        "id",
        "new-note",
        "Pemeriksaan ini mengirimkan kepada penyedia AI-mu kartu-kartu set (pengidentifikasi, "
        "depan, belakang, catatan) serta bahasa sumber, bahasa target, dan tingkat set, tetapi "
        "tidak mengirimkan profilmu maupun kemajuan belajarmu. Selain itu, seperti pada setiap "
        "permintaan AI, penyedia AI-mu juga menerima, antara lain, alamat IP-mu dan kunci API-mu.",
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
    # #3829: the privacy policy's own summary, which the new help texts reuse,
    # in the wording of #3840 ("is stored", no longer "stays ... for you"; what
    # is stored named "among other things").
    (
        "en",
        "3829-policy",
        "Stored in your browser are, among other things, your\nlearning progress, your "
        "statistics and your settings.",
    ),
    (
        "de",
        "3829-policy",
        "In Ihrem Browser gespeichert werden\nunter anderem Ihr Lernfortschritt, Ihre Statistiken "
        "und Ihre Einstellungen.",
    ),
    (
        "es",
        "3829-policy",
        "En su navegador se almacenan, entre\notras cosas, su progreso, sus estadísticas y sus "
        "ajustes.",
    ),
    (
        "fr",
        "3829-policy",
        "Sont stockés\ndans votre navigateur, entre autres, votre progression, vos statistiques "
        "et vos\nparamètres.",
    ),
    (
        "pt",
        "3829-policy",
        "No seu\nbrowser são armazenados, entre outras coisas, o seu progresso, as suas\n"
        "estatísticas e as suas definições.",
    ),
    (
        "tr",
        "3829-policy",
        "Tarayıcınızda başka şeylerin yanı\nsıra öğrenme ilerlemeniz, istatistikleriniz ve "
        "ayarlarınız saklanır.",
    ),
    (
        "el",
        "3829-policy",
        "Στο πρόγραμμα περιήγησής σας αποθηκεύονται, μεταξύ άλλων, η πρόοδός\n"
        "σας, τα στατιστικά σας και οι ρυθμίσεις σας.",
    ),
    (
        "ja",
        "3829-policy",
        "お客様のブラウザ内には、お客様の\n学習の進捗、統計、設定などが保存されます。",
    ),
    # #3829: the new master texts.
    (
        "en",
        "3829-lessons",
        "All lesson progress, element-error rows, review-queue states and\nscheduling data are "
        "stored **with you**: in the browser (IndexedDB) or, in API mode, in your\nown backend's "
        "database; others get parts of them only when a feature you use needs them. The "
        "privacy policy describes when which data goes to others.",
    ),
    (
        "de",
        "3829-lessons",
        "Alle Lektionsfortschritte, Element-Fehler-Zeilen,\nWiederholungs-Warteschlangen-Zustände "
        "und Planungsdaten werden **bei dir** gespeichert: im Browser (IndexedDB) oder, im "
        "API-Modus, in der "
        "Datenbank deines eigenen Backends; andere erhalten Teile davon nur, wenn eine Funktion "
        "sie braucht, die du nutzt.",
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
        "It runs in **local mode**: your progress, statistics, settings and\nyour API key are "
        "stored in your browser (IndexedDB); others get parts of them only when a feature you\n"
        "use needs them. AI calls, for example, go straight from the page to your AI provider.",
    ),
    (
        "de",
        "3829-local-mode",
        "Die öffentliche PWA läuft im **Local-Modus**: Lernfortschritt,\nStatistiken, "
        "Einstellungen und dein API-Schlüssel werden in deinem Browser gespeichert (IndexedDB); "
        "andere erhalten Teile davon nur, wenn eine Funktion sie braucht, die du nutzt.",
    ),
    (
        "en",
        "3829-faq",
        "progress, statistics and settings are stored in your browser; others get\n   parts of "
        "them only when a feature you use needs them. The app contacts servers when a feature "
        "needs it.",
    ),
    (
        "de",
        "3829-faq",
        "Lernfortschritt, Statistiken und Einstellungen werden in deinem\n   Browser gespeichert; "
        "andere erhalten Teile davon nur, wenn eine Funktion sie braucht, die du nutzt.",
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
        tmp_path / "backend/config/i18n/en.yaml",
        "content:\n  privacy: The check sends the cards of the set.\n",
    )
    _write(
        tmp_path / "frontend/src/data/i18n/en.json",
        '{"privacy": "The check sends the cards of the set."}\n',
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
