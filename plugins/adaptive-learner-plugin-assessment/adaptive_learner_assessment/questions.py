"""12 assessment questions in DE + EN with per-method weight tags.

Each answer carries a ``weights`` dict mapping one or more of the
six method keys to a float in ``[0.0, 1.0]``. The profile
calculator (see :mod:`.profile`) sums these contributions across
all 12 answers and normalises by the question count, so each
method ends up in ``[0.0, 1.0]`` representing "what fraction of
your answers leaned toward this method".

Weights are designed so that:

- A purely-one-method respondent (always picks the answer fully
  weighted to method X) scores 1.0 on X and 0.0 elsewhere.
- A balanced respondent scores ~0.17 on each method.
- The dominant method is unambiguous for clearly typed
  respondents; ties resolve alphabetically via
  :attr:`app.models.LearningProfile.dominant_method`.

Translations are maintainer-authored (DE + EN both produced by
the project owner who is bilingual). When adding a new question,
keep ``id`` strictly numeric-suffixed (``q13`` etc.) so an
external tooling chain can rely on the ordering without parsing
prose.
"""

from __future__ import annotations

from typing import Any, TypedDict

# --- The six method keys (must match :mod:`app.schemas.LearningMethod`) ---

METHODS: tuple[str, ...] = (
    "deductive",
    "inductive",
    "error_based",
    "dialogic",
    "contextual",
    "ai_adaptive",
)


class Answer(TypedDict, total=False):
    """Per-answer payload. ``text_es`` / ``text_fr`` / ``text_el``
    were added in Phase 5F; ``text_pt`` / ``text_tr`` / ``text_ja``
    in Phase 26 / v1.13.0. All translation fields are optional —
    ``_text_key`` falls back to EN for any language that doesn't
    have a translation registered yet.
    """

    id: str
    text_de: str
    text_en: str
    text_es: str
    text_fr: str
    text_el: str
    text_pt: str
    text_tr: str
    text_ja: str
    weights: dict[str, float]


class Question(TypedDict, total=False):
    id: str
    # ``"single"`` (radio buttons, exactly one answer) or ``"multi"``
    # (checkboxes, one or more answers — multi-select). v0.4.0 adds
    # multi-select for questions where multiple learning preferences
    # can genuinely apply at the same time (e.g. "How do you approach
    # a new topic?" — a learner can lean on BOTH reading theory AND
    # examples). When omitted, the question is treated as "single".
    type: str
    text_de: str
    text_en: str
    text_es: str
    text_fr: str
    text_el: str
    text_pt: str
    text_tr: str
    text_ja: str
    answers: list[Answer]


QUESTIONS: list[Question] = [
    {
        "id": "q01",
        "type": "multi",
        "text_de": "Wie gehst du an ein neues Thema heran?",
        "text_en": "How do you approach a new topic?",
        "text_es": "Como abordas un tema nuevo?",
        "text_fr": "Comment abordes-tu un nouveau sujet ?",
        "text_el": "Πώς προσεγγίζεις ένα νέο θέμα;",
        "text_ja": "新しいトピックにはどうアプローチしますか?",
        "text_tr": "Yeni bir konuya nasıl yaklaşırsın?",
        "text_pt": "Como você aborda um tema novo?",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich lese erst die Regeln und Theorie.",
                "text_en": "I read the rules and theory first.",
                "text_es": "Primero leo las reglas y la teoria.",
                "text_fr": "Je lis d'abord les regles et la theorie.",
                "text_el": "Διαβάζω πρώτα τους κανόνες και τη θεωρία.",
                "text_ja": "まず規則と理論を読みます。",
                "text_tr": "Önce kuralları ve teoriyi okurum.",
                "text_pt": "Primeiro leio as regras e a teoria.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Ich schaue mir Beispiele an und leite die Regel selbst ab.",
                "text_en": "I look at examples and derive the rule myself.",
                "text_es": "Miro ejemplos y deduzco la regla por mi mismo.",
                "text_fr": "Je regarde des exemples et je deduis la regle moi-meme.",
                "text_el": "Κοιτάω παραδείγματα και βγάζω μόνος τον κανόνα.",
                "text_ja": "例を見て、規則は自分で導きます。",
                "text_tr": "Örneklere bakar, kuralı kendim çıkarırım.",
                "text_pt": "Olho exemplos e deduzo a regra eu mesmo.",
                "weights": {"inductive": 1.0},
            },
            {
                "id": "c",
                "text_de": "Ich probiere etwas und lerne aus Fehlern.",
                "text_en": "I try something and learn from mistakes.",
                "text_es": "Pruebo algo y aprendo de los errores.",
                "text_fr": "J'essaie quelque chose et j'apprends de mes erreurs.",
                "text_el": "Δοκιμάζω κάτι και μαθαίνω από τα λάθη.",
                "text_ja": "何かを試して、間違いから学びます。",
                "text_tr": "Bir şey denerim ve hatalardan öğrenirim.",
                "text_pt": "Tento alguma coisa e aprendo com os erros.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ich bespreche es mit jemandem, der es bereits kennt.",
                "text_en": "I discuss it with someone who already knows it.",
                "text_es": "Lo hablo con alguien que ya lo conoce.",
                "text_fr": "J'en discute avec quelqu'un qui le connait deja.",
                "text_el": "Το συζητάω με κάποιον που ήδη το ξέρει.",
                "text_ja": "すでに知っている人と話し合います。",
                "text_tr": "Konuyu zaten bilen biriyle konuşurum.",
                "text_pt": "Converso com alguém que já conhece o assunto.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q02",
        "type": "multi",
        "text_de": "Wenn du einen Fehler machst, was hilft dir am meisten?",
        "text_en": "When you make a mistake, what helps you most?",
        "text_es": "Cuando cometes un error, que te ayuda mas?",
        "text_fr": "Quand tu fais une erreur, qu'est-ce qui t'aide le plus ?",
        "text_el": "Όταν κάνεις λάθος, τι σε βοηθάει περισσότερο;",
        "text_ja": "間違えたとき、何が一番役に立ちますか?",
        "text_tr": "Bir hata yaptığında sana en çok ne yardım eder?",
        "text_pt": "Quando você comete um erro, o que mais te ajuda?",
        "answers": [
            {
                "id": "a",
                "text_de": "Eine klare Erklärung, warum es falsch war.",
                "text_en": "A clear explanation of why it was wrong.",
                "text_es": "Una explicacion clara de por que estuvo mal.",
                "text_fr": "Une explication claire de pourquoi c'etait faux.",
                "text_el": "Μια ξεκάθαρη εξήγηση γιατί ήταν λάθος.",
                "text_ja": "なぜ間違っていたのかの明確な説明。",
                "text_tr": "Neden yanlış olduğuna dair net bir açıklama.",
                "text_pt": "Uma explicação clara de por que estava errado.",
                "weights": {"deductive": 0.5, "error_based": 0.5},
            },
            {
                "id": "b",
                "text_de": "Den Fehler selbst nochmal durchgehen und korrigieren.",
                "text_en": "Walking through the mistake again and correcting it.",
                "text_es": "Repasar el error y corregirlo.",
                "text_fr": "Reprendre l'erreur et la corriger.",
                "text_el": "Να ξαναπεράσω το λάθος και να το διορθώσω.",
                "text_ja": "間違いをもう一度なぞって修正すること。",
                "text_tr": "Hatayı tekrar gözden geçirip düzeltmek.",
                "text_pt": "Refazer o erro e corrigi-lo.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "c",
                "text_de": "Mit jemandem darüber sprechen, der den Fehler einordnen kann.",
                "text_en": "Talking to someone who can put the mistake in context.",
                "text_es": "Hablar con alguien que pueda contextualizar el error.",
                "text_fr": "Parler a quelqu'un qui peut replacer l'erreur dans son contexte.",
                "text_el": "Να μιλήσω με κάποιον που μπορεί να βάλει το λάθος σε πλαίσιο.",
                "text_ja": "間違いを文脈に位置づけられる人と話すこと。",
                "text_tr": "Hatayı bağlamına oturtabilecek biriyle konuşmak.",
                "text_pt": "Falar com alguém que consegue colocar o erro em contexto.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ein Beispiel sehen, wo es richtig gemacht wurde.",
                "text_en": "Seeing an example where it was done correctly.",
                "text_es": "Ver un ejemplo donde se hizo bien.",
                "text_fr": "Voir un exemple ou cela a ete fait correctement.",
                "text_el": "Να δω ένα παράδειγμα όπου έγινε σωστά.",
                "text_ja": "正しく行われた例を見ること。",
                "text_tr": "Doğru yapılmış bir örnek görmek.",
                "text_pt": "Ver um exemplo em que foi feito corretamente.",
                "weights": {"inductive": 0.7, "contextual": 0.3},
            },
        ],
    },
    {
        "id": "q03",
        "text_de": "Welches Lerntempo fühlt sich richtig an?",
        "text_en": "Which learning pace feels right?",
        "text_es": "Que ritmo de aprendizaje te resulta adecuado?",
        "text_fr": "Quel rythme d'apprentissage te convient ?",
        "text_el": "Ποιος ρυθμός μάθησης σου φαίνεται σωστός;",
        "text_ja": "どんな学習ペースが自分に合っていると感じますか?",
        "text_tr": "Hangi öğrenme temposu sana doğru geliyor?",
        "text_pt": "Que ritmo de aprendizado parece o ideal?",
        "answers": [
            {
                "id": "a",
                "text_de": "Strukturiert und vorhersehbar.",
                "text_en": "Structured and predictable.",
                "text_es": "Estructurado y predecible.",
                "text_fr": "Structure et previsible.",
                "text_el": "Δομημένος και προβλέψιμος.",
                "text_ja": "構造化されていて予測可能。",
                "text_tr": "Yapılandırılmış ve öngörülebilir.",
                "text_pt": "Estruturado e previsível.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Schnell und ausprobierend.",
                "text_en": "Fast and exploratory.",
                "text_es": "Rapido y exploratorio.",
                "text_fr": "Rapide et exploratoire.",
                "text_el": "Γρήγορος και εξερευνητικός.",
                "text_ja": "速く、探索的。",
                "text_tr": "Hızlı ve keşfedici.",
                "text_pt": "Rápido e exploratório.",
                "weights": {"error_based": 0.5, "inductive": 0.5},
            },
            {
                "id": "c",
                "text_de": "Anpassbar an meine Tagesform.",
                "text_en": "Adaptable to my daily energy.",
                "text_es": "Adaptable a mi energia diaria.",
                "text_fr": "Adaptable a mon energie du jour.",
                "text_el": "Προσαρμόσιμος στην ημερήσια ενέργειά μου.",
                "text_ja": "その日の調子に合わせて調整可能。",
                "text_tr": "Günlük enerjime uyarlanabilen.",
                "text_pt": "Adaptável à minha energia do dia.",
                "weights": {"ai_adaptive": 1.0},
            },
            {
                "id": "d",
                "text_de": "Im Gespräch, so wie es sich entwickelt.",
                "text_en": "Conversationally, however it develops.",
                "text_es": "Conversacional, como se vaya dando.",
                "text_fr": "Conversationnel, au fil de l'echange.",
                "text_el": "Συνομιλιακός, όπως κι αν εξελιχθεί.",
                "text_ja": "会話的に、流れに任せて。",
                "text_tr": "Sohbet ederek, nasıl gelişirse.",
                "text_pt": "Conversacional, conforme se desenrolar.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q04",
        "type": "multi",
        "text_de": "Wo lernst du am besten?",
        "text_en": "Where do you learn best?",
        "text_es": "Donde aprendes mejor?",
        "text_fr": "Ou apprends-tu le mieux ?",
        "text_el": "Πού μαθαίνεις καλύτερα;",
        "text_ja": "どこで一番よく学べますか?",
        "text_tr": "Nerede en iyi öğrenirsin?",
        "text_pt": "Onde você aprende melhor?",
        "answers": [
            {
                "id": "a",
                "text_de": "Allein, mit einem Buch oder Skript.",
                "text_en": "Alone, with a book or script.",
                "text_es": "A solas, con un libro o apuntes.",
                "text_fr": "Seul, avec un livre ou des notes.",
                "text_el": "Μόνος, με βιβλίο ή σημειώσεις.",
                "text_ja": "一人で、本や台本と共に。",
                "text_tr": "Yalnız, bir kitap ya da metinle.",
                "text_pt": "Sozinho, com um livro ou apostila.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "In einer echten Anwendungssituation.",
                "text_en": "In a real-world application setting.",
                "text_es": "En una situacion de aplicacion real.",
                "text_fr": "Dans un contexte d'application reel.",
                "text_el": "Σε ένα πραγματικό πλαίσιο εφαρμογής.",
                "text_ja": "実際の応用の場で。",
                "text_tr": "Gerçek dünya uygulama ortamında.",
                "text_pt": "Em uma situação de aplicação real.",
                "weights": {"contextual": 1.0},
            },
            {
                "id": "c",
                "text_de": "Im Gespräch mit anderen.",
                "text_en": "In conversation with others.",
                "text_es": "En conversacion con otros.",
                "text_fr": "En conversation avec d'autres.",
                "text_el": "Σε συζήτηση με άλλους.",
                "text_ja": "他の人との会話の中で。",
                "text_tr": "Başkalarıyla sohbet ederek.",
                "text_pt": "Em conversa com outras pessoas.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "d",
                "text_de": "An einem Projekt, das mich interessiert.",
                "text_en": "On a project that interests me.",
                "text_es": "En un proyecto que me interesa.",
                "text_fr": "Sur un projet qui m'interesse.",
                "text_el": "Σε ένα έργο που με ενδιαφέρει.",
                "text_ja": "自分が興味のあるプロジェクトで。",
                "text_tr": "İlgimi çeken bir projede.",
                "text_pt": "Em um projeto que me interessa.",
                "weights": {"contextual": 0.7, "error_based": 0.3},
            },
        ],
    },
    {
        "id": "q05",
        "type": "multi",
        "text_de": "Wie merkst du dir am besten Neues?",
        "text_en": "How do you remember new things best?",
        "text_es": "Como recuerdas mejor las cosas nuevas?",
        "text_fr": "Comment te souviens-tu le mieux de nouvelles choses ?",
        "text_el": "Πώς θυμάσαι καλύτερα νέα πράγματα;",
        "text_ja": "新しいことを一番よく覚えるにはどうしますか?",
        "text_tr": "Yeni şeyleri en iyi nasıl hatırlarsın?",
        "text_pt": "Como você se lembra melhor de coisas novas?",
        "answers": [
            {
                "id": "a",
                "text_de": "Durch Wiederholung und feste Regeln.",
                "text_en": "Through repetition and fixed rules.",
                "text_es": "Mediante repeticion y reglas fijas.",
                "text_fr": "Par la repetition et des regles fixes.",
                "text_el": "Μέσα από επανάληψη και σταθερούς κανόνες.",
                "text_ja": "繰り返しと固定された規則を通じて。",
                "text_tr": "Tekrar ve sabit kurallarla.",
                "text_pt": "Pela repetição e regras fixas.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Durch echte Anwendung im Alltag.",
                "text_en": "Through real application in everyday life.",
                "text_es": "Mediante la aplicacion real en la vida cotidiana.",
                "text_fr": "Par l'application reelle au quotidien.",
                "text_el": "Μέσα από πραγματική εφαρμογή στην καθημερινότητα.",
                "text_ja": "日常生活での実際の応用を通じて。",
                "text_tr": "Günlük hayatta gerçek uygulamayla.",
                "text_pt": "Pela aplicação real no dia a dia.",
                "weights": {"contextual": 1.0},
            },
            {
                "id": "c",
                "text_de": "Durch mehrfache eigene Fehler und Korrekturen.",
                "text_en": "Through multiple personal mistakes + corrections.",
                "text_es": "A traves de multiples errores y correcciones propias.",
                "text_fr": "A travers plusieurs erreurs et corrections personnelles.",
                "text_el": "Μέσα από πολλά προσωπικά λάθη και διορθώσεις.",
                "text_ja": "複数の自分の間違いと修正を通じて。",
                "text_tr": "Birden çok kişisel hata ve düzeltmeyle.",
                "text_pt": "Por vários erros pessoais e correções.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "d",
                "text_de": "Durch Diskussion und Erklären an andere.",
                "text_en": "Through discussion and explaining to others.",
                "text_es": "Discutiendo y explicando a otros.",
                "text_fr": "En discutant et en expliquant aux autres.",
                "text_el": "Μέσα από συζήτηση και εξήγηση σε άλλους.",
                "text_ja": "議論と他人への説明を通じて。",
                "text_tr": "Tartışarak ve başkalarına anlatarak.",
                "text_pt": "Discutindo e explicando para outras pessoas.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q06",
        "type": "multi",
        "text_de": "Welche Ressource hilft dir am meisten?",
        "text_en": "Which resource helps you most?",
        "text_es": "Que recurso te ayuda mas?",
        "text_fr": "Quelle ressource t'aide le plus ?",
        "text_el": "Ποιος πόρος σε βοηθάει περισσότερο;",
        "text_ja": "どんなリソースが一番役に立ちますか?",
        "text_tr": "Hangi kaynak sana en çok yardımcı olur?",
        "text_pt": "Qual recurso te ajuda mais?",
        "answers": [
            {
                "id": "a",
                "text_de": "Ein gut strukturiertes Lehrbuch.",
                "text_en": "A well-structured textbook.",
                "text_es": "Un libro de texto bien estructurado.",
                "text_fr": "Un manuel bien structure.",
                "text_el": "Ένα καλά δομημένο εγχειρίδιο.",
                "text_ja": "よく構造化された教科書。",
                "text_tr": "İyi yapılandırılmış bir ders kitabı.",
                "text_pt": "Um livro-texto bem estruturado.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Beispiel-orientierte Tutorials oder Videos.",
                "text_en": "Example-driven tutorials or videos.",
                "text_es": "Tutoriales o videos basados en ejemplos.",
                "text_fr": "Des tutoriels ou videos centres sur des exemples.",
                "text_el": "Tutorial ή βίντεο βασισμένα σε παραδείγματα.",
                "text_ja": "例を中心にしたチュートリアルや動画。",
                "text_tr": "Örnek odaklı kılavuzlar ya da videolar.",
                "text_pt": "Tutoriais ou vídeos baseados em exemplos.",
                "weights": {"inductive": 1.0},
            },
            {
                "id": "c",
                "text_de": "Reale Projekte oder Fallstudien.",
                "text_en": "Real-world projects or case studies.",
                "text_es": "Proyectos reales o estudios de caso.",
                "text_fr": "Des projets reels ou des etudes de cas.",
                "text_el": "Πραγματικά έργα ή μελέτες περίπτωσης.",
                "text_ja": "実際のプロジェクトやケーススタディ。",
                "text_tr": "Gerçek dünya projeleri ya da vaka çalışmaları.",
                "text_pt": "Projetos reais ou estudos de caso.",
                "weights": {"contextual": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ein erfahrener Mensch, der mich begleitet.",
                "text_en": "An experienced person who guides me.",
                "text_es": "Una persona con experiencia que me guie.",
                "text_fr": "Une personne experimentee qui me guide.",
                "text_el": "Ένα έμπειρο άτομο που με καθοδηγεί.",
                "text_ja": "私を導いてくれる経験豊富な人。",
                "text_tr": "Bana rehberlik eden deneyimli biri.",
                "text_pt": "Uma pessoa experiente que me oriente.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q07",
        "text_de": "Wie reagierst du auf Unsicherheit beim Lernen?",
        "text_en": "How do you react to uncertainty while learning?",
        "text_es": "Como reaccionas ante la incertidumbre al aprender?",
        "text_fr": "Comment reagis-tu a l'incertitude en apprenant ?",
        "text_el": "Πώς αντιδράς στην αβεβαιότητα κατά τη μάθηση;",
        "text_ja": "学習中の不確かさにどう反応しますか?",
        "text_tr": "Öğrenirken belirsizliğe nasıl tepki verirsin?",
        "text_pt": "Como você reage à incerteza ao aprender?",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich suche eine eindeutige Quelle, die sie auflöst.",
                "text_en": "I find an unambiguous source that resolves it.",
                "text_es": "Busco una fuente clara que la resuelva.",
                "text_fr": "Je cherche une source sans ambiguite qui la resout.",
                "text_el": "Βρίσκω μια ξεκάθαρη πηγή που τη λύνει.",
                "text_ja": "それを解決する明確な情報源を探します。",
                "text_tr": "Belirsizliği gideren açık bir kaynak bulurum.",
                "text_pt": "Procuro uma fonte clara que resolva a dúvida.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Ich frage jemanden, dem ich vertraue.",
                "text_en": "I ask someone I trust.",
                "text_es": "Le pregunto a alguien de confianza.",
                "text_fr": "Je demande a quelqu'un de confiance.",
                "text_el": "Ρωτάω κάποιον που εμπιστεύομαι.",
                "text_ja": "信頼できる人に尋ねます。",
                "text_tr": "Güvendiğim birine sorarım.",
                "text_pt": "Pergunto a alguém de confiança.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "c",
                "text_de": "Ich probiere weiter und sortiere unterwegs.",
                "text_en": "I keep trying and sort things out as I go.",
                "text_es": "Sigo intentando y voy resolviendo sobre la marcha.",
                "text_fr": "Je continue d'essayer et je demele en chemin.",
                "text_el": "Συνεχίζω να προσπαθώ και ξεδιαλύνω καθώς προχωράω.",
                "text_ja": "試し続けて、進みながら整理します。",
                "text_tr": "Denemeye devam eder, yolda hallederim.",
                "text_pt": "Continuo tentando e vou resolvendo no caminho.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ich lasse mich von einem KI-Assistenten leiten.",
                "text_en": "I let an AI assistant guide me.",
                "text_es": "Dejo que un asistente de IA me guie.",
                "text_fr": "Je laisse un assistant IA me guider.",
                "text_el": "Αφήνω έναν βοηθό AI να με καθοδηγήσει.",
                "text_ja": "AI アシスタントに案内してもらいます。",
                "text_tr": "Bir YZ asistanının bana rehberlik etmesine izin veririm.",
                "text_pt": "Deixo um assistente de IA me guiar.",
                "weights": {"ai_adaptive": 1.0},
            },
        ],
    },
    {
        "id": "q08",
        "type": "multi",
        "text_de": "Wann sitzt der Stoff für dich wirklich?",
        "text_en": "When does material really stick for you?",
        "text_es": "Cuando se te queda realmente el material?",
        "text_fr": "Quand la matiere s'ancre-t-elle vraiment chez toi ?",
        "text_el": "Πότε εμπεδώνεται πραγματικά η ύλη για σένα;",
        "text_ja": "内容はいつ本当に身につきますか?",
        "text_tr": "İçerik sende ne zaman gerçekten yer eder?",
        "text_pt": "Quando o conteúdo realmente fica para você?",
        "answers": [
            {
                "id": "a",
                "text_de": "Wenn ich ihn in einem echten Kontext angewendet habe.",
                "text_en": "When I've applied it in a real context.",
                "text_es": "Cuando lo he aplicado en un contexto real.",
                "text_fr": "Quand je l'ai applique dans un contexte reel.",
                "text_el": "Όταν το έχω εφαρμόσει σε πραγματικό πλαίσιο.",
                "text_ja": "実際の文脈で応用したとき。",
                "text_tr": "Gerçek bir bağlamda uyguladığımda.",
                "text_pt": "Quando apliquei em um contexto real.",
                "weights": {"contextual": 1.0},
            },
            {
                "id": "b",
                "text_de": "Wenn ich die Regel sauber abstrahieren kann.",
                "text_en": "When I can cleanly abstract the rule.",
                "text_es": "Cuando puedo abstraer la regla con claridad.",
                "text_fr": "Quand je peux abstraire la regle proprement.",
                "text_el": "Όταν μπορώ να αφαιρέσω καθαρά τον κανόνα.",
                "text_ja": "規則をきれいに抽象化できたとき。",
                "text_tr": "Kuralı temiz biçimde soyutlayabildiğimde.",
                "text_pt": "Quando consigo abstrair a regra com clareza.",
                "weights": {"deductive": 0.5, "inductive": 0.5},
            },
            {
                "id": "c",
                "text_de": "Wenn ich es jemandem erklärt habe.",
                "text_en": "When I've explained it to someone.",
                "text_es": "Cuando se lo he explicado a alguien.",
                "text_fr": "Quand je l'ai explique a quelqu'un.",
                "text_el": "Όταν το έχω εξηγήσει σε κάποιον.",
                "text_ja": "誰かに説明したとき。",
                "text_tr": "Birine anlattığımda.",
                "text_pt": "Quando expliquei para alguém.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "d",
                "text_de": "Wenn ich genug Fehler gemacht und korrigiert habe.",
                "text_en": "When I've made + corrected enough mistakes.",
                "text_es": "Cuando he cometido y corregido suficientes errores.",
                "text_fr": "Quand j'ai fait et corrige assez d'erreurs.",
                "text_el": "Όταν έχω κάνει και διορθώσει αρκετά λάθη.",
                "text_ja": "十分な間違いをして修正したとき。",
                "text_tr": "Yeterince hata yapıp düzelttiğimde.",
                "text_pt": "Quando cometi e corrigi erros o suficiente.",
                "weights": {"error_based": 1.0},
            },
        ],
    },
    {
        "id": "q09",
        "text_de": "Wer legt am liebsten dein Lernprogramm fest?",
        "text_en": "Who do you prefer to set your learning programme?",
        "text_es": "Quien prefieres que defina tu programa de aprendizaje?",
        "text_fr": "Qui preferes-tu pour fixer ton programme d'apprentissage ?",
        "text_el": "Ποιος προτιμάς να καθορίζει το πρόγραμμα μάθησής σου;",
        "text_ja": "学習プログラムは誰に決めてもらいたいですか?",
        "text_tr": "Öğrenme programını kimin belirlemesini tercih edersin?",
        "text_pt": "Quem você prefere que defina o seu programa de aprendizado?",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich selbst, nach klarem Plan.",
                "text_en": "Myself, on a clear plan.",
                "text_es": "Yo, sobre un plan claro.",
                "text_fr": "Moi-meme, avec un plan clair.",
                "text_el": "Εγώ ο ίδιος, με ξεκάθαρο πλάνο.",
                "text_ja": "自分自身、明確な計画に基づいて。",
                "text_tr": "Kendim, net bir plana göre.",
                "text_pt": "Eu mesmo, seguindo um plano claro.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Eine Mentorin oder ein Coach.",
                "text_en": "A mentor or coach.",
                "text_es": "Un mentor o coach.",
                "text_fr": "Un mentor ou coach.",
                "text_el": "Ένας μέντορας ή coach.",
                "text_ja": "メンターやコーチ。",
                "text_tr": "Bir mentor ya da koç.",
                "text_pt": "Um mentor ou coach.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "c",
                "text_de": "Eine KI, die meine Fortschritte einbezieht.",
                "text_en": "An AI that incorporates my progress.",
                "text_es": "Una IA que incorpore mi progreso.",
                "text_fr": "Une IA qui integre ma progression.",
                "text_el": "Μια AI που ενσωματώνει την πρόοδό μου.",
                "text_ja": "私の進捗を取り入れる AI。",
                "text_tr": "İlerlememi dikkate alan bir YZ.",
                "text_pt": "Uma IA que incorpora o meu progresso.",
                "weights": {"ai_adaptive": 1.0},
            },
            {
                "id": "d",
                "text_de": "Das Thema selbst - ich folge meinen Fragen.",
                "text_en": "The topic itself - I follow my own questions.",
                "text_es": "El tema en si - sigo mis propias preguntas.",
                "text_fr": "Le sujet lui-meme - je suis mes propres questions.",
                "text_el": "Το ίδιο το θέμα - ακολουθώ τις δικές μου ερωτήσεις.",
                "text_ja": "トピック自体 - 自分の疑問を追います。",
                "text_tr": "Konunun kendisi - kendi sorularımı takip ederim.",
                "text_pt": "O próprio tema - sigo as minhas próprias perguntas.",
                "weights": {"inductive": 0.5, "contextual": 0.5},
            },
        ],
    },
    {
        "id": "q10",
        "text_de": "Wann möchtest du Feedback bekommen?",
        "text_en": "When do you want feedback?",
        "text_es": "Cuando quieres feedback?",
        "text_fr": "Quand veux-tu un retour ?",
        "text_el": "Πότε θέλεις ανατροφοδότηση;",
        "text_ja": "フィードバックはいつ欲しいですか?",
        "text_tr": "Geri bildirimi ne zaman istersin?",
        "text_pt": "Quando você quer feedback?",
        "answers": [
            {
                "id": "a",
                "text_de": "Sofort nach jedem Schritt.",
                "text_en": "Immediately after every step.",
                "text_es": "Inmediatamente despues de cada paso.",
                "text_fr": "Immediatement apres chaque etape.",
                "text_el": "Αμέσως μετά από κάθε βήμα.",
                "text_ja": "各ステップの直後に。",
                "text_tr": "Her adımdan hemen sonra.",
                "text_pt": "Imediatamente após cada passo.",
                "weights": {"error_based": 0.7, "dialogic": 0.3},
            },
            {
                "id": "b",
                "text_de": "Am Ende einer abgeschlossenen Einheit.",
                "text_en": "At the end of a completed unit.",
                "text_es": "Al final de una unidad completada.",
                "text_fr": "A la fin d'une unite terminee.",
                "text_el": "Στο τέλος μιας ολοκληρωμένης ενότητας.",
                "text_ja": "完了した単元の最後に。",
                "text_tr": "Tamamlanmış bir ünitenin sonunda.",
                "text_pt": "Ao final de uma unidade concluída.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "c",
                "text_de": "Wenn ich ausdrücklich frage.",
                "text_en": "When I explicitly ask for it.",
                "text_es": "Cuando lo pido explicitamente.",
                "text_fr": "Quand je le demande explicitement.",
                "text_el": "Όταν το ζητήσω ρητά.",
                "text_ja": "明示的に求めたときに。",
                "text_tr": "Açıkça istediğimde.",
                "text_pt": "Quando eu pedir explicitamente.",
                "weights": {"inductive": 0.5, "ai_adaptive": 0.5},
            },
            {
                "id": "d",
                "text_de": "Im Gespräch, im Hin und Her.",
                "text_en": "In conversation, back and forth.",
                "text_es": "En conversacion, ida y vuelta.",
                "text_fr": "En conversation, dans un va-et-vient.",
                "text_el": "Σε συζήτηση, πέρα-δώθε.",
                "text_ja": "会話の中で、やり取りしながら。",
                "text_tr": "Sohbet içinde, karşılıklı.",
                "text_pt": "Em conversa, indo e voltando.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q11",
        "text_de": "Wie stehst du zu KI-Tools beim Lernen?",
        "text_en": "How do you feel about AI tools while learning?",
        "text_es": "Que opinas de las herramientas de IA al aprender?",
        "text_fr": "Que penses-tu des outils d'IA pour apprendre ?",
        "text_el": "Πώς νιώθεις για τα εργαλεία AI στη μάθηση;",
        "text_ja": "学習中の AI ツールについてどう感じますか?",
        "text_tr": "Öğrenirken YZ araçları hakkında ne düşünüyorsun?",
        "text_pt": "O que você acha de ferramentas de IA ao aprender?",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich nutze sie als Hauptbegleiter.",
                "text_en": "I use them as my main companion.",
                "text_es": "Las uso como mi principal compañero.",
                "text_fr": "Je les utilise comme mon compagnon principal.",
                "text_el": "Τα χρησιμοποιώ ως κύριο συνοδό.",
                "text_ja": "メインの相棒として使います。",
                "text_tr": "Onları temel yoldaşım olarak kullanırım.",
                "text_pt": "Uso como meu principal companheiro.",
                "weights": {"ai_adaptive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Selektiv - wenn ich konkrete Fragen habe.",
                "text_en": "Selectively - when I have specific questions.",
                "text_es": "De forma selectiva - cuando tengo preguntas concretas.",
                "text_fr": "De maniere selective - quand j'ai des questions precises.",
                "text_el": "Επιλεκτικά - όταν έχω συγκεκριμένες ερωτήσεις.",
                "text_ja": "選択的に - 具体的な質問があるときに。",
                "text_tr": "Seçici biçimde - belirli sorularım olduğunda.",
                "text_pt": "De forma seletiva - quando tenho dúvidas específicas.",
                "weights": {"ai_adaptive": 0.5, "inductive": 0.5},
            },
            {
                "id": "c",
                "text_de": "Eher selten; ich vertraue Büchern und Menschen.",
                "text_en": "Rarely; I trust books and people more.",
                "text_es": "Pocas veces; confio mas en libros y personas.",
                "text_fr": "Rarement ; je fais davantage confiance aux livres et aux personnes.",
                "text_el": "Σπάνια· εμπιστεύομαι περισσότερο τα βιβλία και τους ανθρώπους.",
                "text_ja": "ほとんど使いません。本や人をもっと信頼します。",
                "text_tr": "Nadiren; kitaplara ve insanlara daha çok güvenirim.",
                "text_pt": "Raramente; confio mais em livros e pessoas.",
                "weights": {"deductive": 0.5, "dialogic": 0.5},
            },
            {
                "id": "d",
                "text_de": "Erst nachdem ich es ohne probiert habe.",
                "text_en": "Only after I've tried without one first.",
                "text_es": "Solo despues de haberlo intentado sin ellas primero.",
                "text_fr": "Seulement apres avoir essaye sans elles d'abord.",
                "text_el": "Μόνο αφού πρώτα δοκιμάσω χωρίς αυτά.",
                "text_ja": "まず使わずに試してから。",
                "text_tr": "Sadece önce onsuz denedikten sonra.",
                "text_pt": "Só depois de ter tentado sem elas primeiro.",
                "weights": {"error_based": 0.7, "contextual": 0.3},
            },
        ],
    },
    {
        "id": "q12",
        "type": "multi",
        "text_de": "Wie verhältst du dich bei Stoff, der nicht klick macht?",
        "text_en": "How do you respond to material that just won't click?",
        "text_es": "Como respondes ante material que no te entra?",
        "text_fr": "Comment reagis-tu face a une matiere qui ne passe pas ?",
        "text_el": "Πώς αντιδράς σε ύλη που δεν κουμπώνει;",
        "text_ja": "どうしてもしっくりこない内容にはどう対応しますか?",
        "text_tr": "Bir türlü oturmayan bir içeriğe nasıl tepki verirsin?",
        "text_pt": "Como você reage a um conteúdo que simplesmente não engata?",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich gehe zurück zur Theorie und lese nochmal genau.",
                "text_en": "I go back to the theory and read more carefully.",
                "text_es": "Vuelvo a la teoria y leo con mas atencion.",
                "text_fr": "Je retourne a la theorie et je lis plus attentivement.",
                "text_el": "Επιστρέφω στη θεωρία και διαβάζω πιο προσεκτικά.",
                "text_ja": "理論に戻って、より注意深く読みます。",
                "text_tr": "Teoriye dönüp daha dikkatli okurum.",
                "text_pt": "Volto à teoria e leio com mais atenção.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Ich suche mehr Beispiele aus der Praxis.",
                "text_en": "I look for more examples from real practice.",
                "text_es": "Busco mas ejemplos de la practica real.",
                "text_fr": "Je cherche plus d'exemples de la pratique reelle.",
                "text_el": "Ψάχνω περισσότερα παραδείγματα από την πραγματική πράξη.",
                "text_ja": "実際の現場からもっと例を探します。",
                "text_tr": "Gerçek uygulamadan daha fazla örnek ararım.",
                "text_pt": "Procuro mais exemplos da prática real.",
                "weights": {"inductive": 0.5, "contextual": 0.5},
            },
            {
                "id": "c",
                "text_de": "Ich versuche es bis es klappt - auch mit Fehlern.",
                "text_en": "I keep trying until it works - mistakes included.",
                "text_es": "Sigo intentando hasta que funciona - errores incluidos.",
                "text_fr": "Je continue jusqu'a ce que cela fonctionne - erreurs comprises.",
                "text_el": "Συνεχίζω να προσπαθώ μέχρι να πετύχει - με τα λάθη.",
                "text_ja": "うまくいくまで試し続けます - 間違いも含めて。",
                "text_tr": "İşe yarayana kadar denemeye devam ederim - hatalar dahil.",
                "text_pt": "Continuo tentando até dar certo - com os erros junto.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ich lasse mir den Weg von einer KI vorschlagen.",
                "text_en": "I let an AI suggest the path.",
                "text_es": "Dejo que una IA me sugiera el camino.",
                "text_fr": "Je laisse une IA proposer le chemin.",
                "text_el": "Αφήνω μια AI να προτείνει την πορεία.",
                "text_ja": "AI に道筋を提案してもらいます。",
                "text_tr": "Bir YZ'nin yolu önermesine izin veririm.",
                "text_pt": "Deixo uma IA sugerir o caminho.",
                "weights": {"ai_adaptive": 1.0},
            },
        ],
    },
]


_LANG_TO_KEY: dict[str, str] = {
    "de": "text_de",
    "en": "text_en",
    "es": "text_es",
    "fr": "text_fr",
    "el": "text_el",
    # v1.13.0 / Phase 26 — PT/TR/JA full translations.
    "pt": "text_pt",
    "tr": "text_tr",
    "ja": "text_ja",
}


def _text_key(lang: str) -> str:
    """Map a UI language code to the in-file translation key.

    v0.2.0 shipped DE + EN + ES + FR + EL; Phase 26 (v1.13.0)
    adds PT + TR + JA. Unknown codes still fall back to EN.
    Future translation packs add a row to ``_LANG_TO_KEY`` AND
    populate the matching field in every QUESTIONS entry.
    """
    # Match the most-specific 2-char prefix first so ``en-US`` /
    # ``de-AT`` etc. resolve to the base language.
    for prefix, key in _LANG_TO_KEY.items():
        if lang.startswith(prefix):
            return key
    return "text_en"


def questions_for_lang(lang: str) -> list[dict[str, Any]]:
    """Return the 12-question pack, with ``text`` resolved for ``lang``.

    Output shape matches the project plan §6.3 contract::

        [{"id": "q01",
          "text": "...",
          "answers": [{"id": "a", "text": "...", "weights": {...}}, ...]},
         ...]
    """
    key = _text_key(lang)
    out: list[dict[str, Any]] = []
    for q in QUESTIONS:
        # v0.2.0: a future question added without ES / FR / EL
        # translations gracefully falls back to EN. The
        # `total=False` TypedDicts mean ``.get`` is the right
        # access pattern.
        q_text = q.get(key) or q["text_en"]  # type: ignore[arg-type]
        out.append(
            {
                "id": q["id"],
                # v0.4.0: ``type`` lets the frontend pick radio
                # vs checkbox rendering. Default "single" for
                # backward compatibility with anything that
                # forgot to declare it.
                "type": q.get("type", "single"),
                "text": q_text,
                "answers": [
                    {
                        "id": a["id"],
                        "text": a.get(key) or a["text_en"],  # type: ignore[arg-type]
                        "weights": dict(a["weights"]),
                    }
                    for a in q["answers"]
                ],
            }
        )
    return out


def lang_neutral_questions() -> list[dict[str, Any]]:
    """Variant used by the profile calculator: drops the text, keeps
    the answer-id -> weights mapping. Cheaper to lookup at evaluation
    time than rebuilding the structure per request.
    """
    out: list[dict[str, Any]] = []
    for q in QUESTIONS:
        out.append(
            {
                "id": q["id"],
                "answers": [{"id": a["id"], "weights": dict(a["weights"])} for a in q["answers"]],
            }
        )
    return out
