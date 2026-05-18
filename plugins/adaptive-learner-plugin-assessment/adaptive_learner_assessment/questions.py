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
    are optional: questions added before Phase 5F's translation
    pass don't carry them. ``_text_key`` falls back to EN for any
    language that doesn't have a translation registered yet.
    """

    id: str
    text_de: str
    text_en: str
    text_es: str
    text_fr: str
    text_el: str
    weights: dict[str, float]


class Question(TypedDict, total=False):
    id: str
    text_de: str
    text_en: str
    text_es: str
    text_fr: str
    text_el: str
    answers: list[Answer]


QUESTIONS: list[Question] = [
    {
        "id": "q01",
        "text_de": "Wie gehst du an ein neues Thema heran?",
        "text_en": "How do you approach a new topic?",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich lese erst die Regeln und Theorie.",
                "text_en": "I read the rules and theory first.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Ich schaue mir Beispiele an und leite die Regel selbst ab.",
                "text_en": "I look at examples and derive the rule myself.",
                "weights": {"inductive": 1.0},
            },
            {
                "id": "c",
                "text_de": "Ich probiere etwas und lerne aus Fehlern.",
                "text_en": "I try something and learn from mistakes.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ich bespreche es mit jemandem, der es bereits kennt.",
                "text_en": "I discuss it with someone who already knows it.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q02",
        "text_de": "Wenn du einen Fehler machst, was hilft dir am meisten?",
        "text_en": "When you make a mistake, what helps you most?",
        "answers": [
            {
                "id": "a",
                "text_de": "Eine klare Erklaerung, warum es falsch war.",
                "text_en": "A clear explanation of why it was wrong.",
                "weights": {"deductive": 0.5, "error_based": 0.5},
            },
            {
                "id": "b",
                "text_de": "Den Fehler selbst nochmal durchgehen und korrigieren.",
                "text_en": "Walking through the mistake again and correcting it.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "c",
                "text_de": "Mit jemandem darueber sprechen, der den Fehler einordnen kann.",
                "text_en": "Talking to someone who can put the mistake in context.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ein Beispiel sehen, wo es richtig gemacht wurde.",
                "text_en": "Seeing an example where it was done correctly.",
                "weights": {"inductive": 0.7, "contextual": 0.3},
            },
        ],
    },
    {
        "id": "q03",
        "text_de": "Welches Lerntempo fuehlt sich richtig an?",
        "text_en": "Which learning pace feels right?",
        "answers": [
            {
                "id": "a",
                "text_de": "Strukturiert und vorhersehbar.",
                "text_en": "Structured and predictable.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Schnell und ausprobierend.",
                "text_en": "Fast and exploratory.",
                "weights": {"error_based": 0.5, "inductive": 0.5},
            },
            {
                "id": "c",
                "text_de": "Anpassbar an meine Tagesform.",
                "text_en": "Adaptable to my daily energy.",
                "weights": {"ai_adaptive": 1.0},
            },
            {
                "id": "d",
                "text_de": "Im Gespraech, so wie es sich entwickelt.",
                "text_en": "Conversationally, however it develops.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q04",
        "text_de": "Wo lernst du am besten?",
        "text_en": "Where do you learn best?",
        "answers": [
            {
                "id": "a",
                "text_de": "Allein, mit einem Buch oder Skript.",
                "text_en": "Alone, with a book or script.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "In einer echten Anwendungssituation.",
                "text_en": "In a real-world application setting.",
                "weights": {"contextual": 1.0},
            },
            {
                "id": "c",
                "text_de": "Im Gespraech mit anderen.",
                "text_en": "In conversation with others.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "d",
                "text_de": "An einem Projekt, das mich interessiert.",
                "text_en": "On a project that interests me.",
                "weights": {"contextual": 0.7, "error_based": 0.3},
            },
        ],
    },
    {
        "id": "q05",
        "text_de": "Wie merkst du dir am besten Neues?",
        "text_en": "How do you remember new things best?",
        "answers": [
            {
                "id": "a",
                "text_de": "Durch Wiederholung und feste Regeln.",
                "text_en": "Through repetition and fixed rules.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Durch echte Anwendung im Alltag.",
                "text_en": "Through real application in everyday life.",
                "weights": {"contextual": 1.0},
            },
            {
                "id": "c",
                "text_de": "Durch mehrfache eigene Fehler und Korrekturen.",
                "text_en": "Through multiple personal mistakes + corrections.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "d",
                "text_de": "Durch Diskussion und Erklaeren an andere.",
                "text_en": "Through discussion and explaining to others.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q06",
        "text_de": "Welche Ressource hilft dir am meisten?",
        "text_en": "Which resource helps you most?",
        "answers": [
            {
                "id": "a",
                "text_de": "Ein gut strukturiertes Lehrbuch.",
                "text_en": "A well-structured textbook.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Beispiel-orientierte Tutorials oder Videos.",
                "text_en": "Example-driven tutorials or videos.",
                "weights": {"inductive": 1.0},
            },
            {
                "id": "c",
                "text_de": "Reale Projekte oder Fallstudien.",
                "text_en": "Real-world projects or case studies.",
                "weights": {"contextual": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ein erfahrener Mensch, der mich begleitet.",
                "text_en": "An experienced person who guides me.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q07",
        "text_de": "Wie reagierst du auf Unsicherheit beim Lernen?",
        "text_en": "How do you react to uncertainty while learning?",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich suche eine eindeutige Quelle, die sie aufloest.",
                "text_en": "I find an unambiguous source that resolves it.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Ich frage jemanden, dem ich vertraue.",
                "text_en": "I ask someone I trust.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "c",
                "text_de": "Ich probiere weiter und sortiere unterwegs.",
                "text_en": "I keep trying and sort things out as I go.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ich lasse mich von einem KI-Assistenten leiten.",
                "text_en": "I let an AI assistant guide me.",
                "weights": {"ai_adaptive": 1.0},
            },
        ],
    },
    {
        "id": "q08",
        "text_de": "Wann sitzt der Stoff fuer dich wirklich?",
        "text_en": "When does material really stick for you?",
        "answers": [
            {
                "id": "a",
                "text_de": "Wenn ich ihn in einem echten Kontext angewendet habe.",
                "text_en": "When I've applied it in a real context.",
                "weights": {"contextual": 1.0},
            },
            {
                "id": "b",
                "text_de": "Wenn ich die Regel sauber abstrahieren kann.",
                "text_en": "When I can cleanly abstract the rule.",
                "weights": {"deductive": 0.5, "inductive": 0.5},
            },
            {
                "id": "c",
                "text_de": "Wenn ich es jemandem erklaert habe.",
                "text_en": "When I've explained it to someone.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "d",
                "text_de": "Wenn ich genug Fehler gemacht und korrigiert habe.",
                "text_en": "When I've made + corrected enough mistakes.",
                "weights": {"error_based": 1.0},
            },
        ],
    },
    {
        "id": "q09",
        "text_de": "Wer legt am liebsten dein Lernprogramm fest?",
        "text_en": "Who do you prefer to set your learning programme?",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich selbst, nach klarem Plan.",
                "text_en": "Myself, on a clear plan.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Eine Mentorin oder ein Coach.",
                "text_en": "A mentor or coach.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "c",
                "text_de": "Eine KI, die meine Fortschritte einbezieht.",
                "text_en": "An AI that incorporates my progress.",
                "weights": {"ai_adaptive": 1.0},
            },
            {
                "id": "d",
                "text_de": "Das Thema selbst — ich folge meinen Fragen.",
                "text_en": "The topic itself — I follow my own questions.",
                "weights": {"inductive": 0.5, "contextual": 0.5},
            },
        ],
    },
    {
        "id": "q10",
        "text_de": "Wann moechtest du Feedback bekommen?",
        "text_en": "When do you want feedback?",
        "answers": [
            {
                "id": "a",
                "text_de": "Sofort nach jedem Schritt.",
                "text_en": "Immediately after every step.",
                "weights": {"error_based": 0.7, "dialogic": 0.3},
            },
            {
                "id": "b",
                "text_de": "Am Ende einer abgeschlossenen Einheit.",
                "text_en": "At the end of a completed unit.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "c",
                "text_de": "Wenn ich ausdruecklich frage.",
                "text_en": "When I explicitly ask for it.",
                "weights": {"inductive": 0.5, "ai_adaptive": 0.5},
            },
            {
                "id": "d",
                "text_de": "Im Gespraech, im Hin und Her.",
                "text_en": "In conversation, back and forth.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q11",
        "text_de": "Wie stehst du zu KI-Tools beim Lernen?",
        "text_en": "How do you feel about AI tools while learning?",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich nutze sie als Hauptbegleiter.",
                "text_en": "I use them as my main companion.",
                "weights": {"ai_adaptive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Selektiv — wenn ich konkrete Fragen habe.",
                "text_en": "Selectively — when I have specific questions.",
                "weights": {"ai_adaptive": 0.5, "inductive": 0.5},
            },
            {
                "id": "c",
                "text_de": "Eher selten; ich vertraue Buechern und Menschen.",
                "text_en": "Rarely; I trust books and people more.",
                "weights": {"deductive": 0.5, "dialogic": 0.5},
            },
            {
                "id": "d",
                "text_de": "Erst nachdem ich es ohne probiert habe.",
                "text_en": "Only after I've tried without one first.",
                "weights": {"error_based": 0.7, "contextual": 0.3},
            },
        ],
    },
    {
        "id": "q12",
        "text_de": "Wie verhaeltst du dich bei Stoff, der nicht klick macht?",
        "text_en": "How do you respond to material that just won't click?",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich gehe zurueck zur Theorie und lese nochmal genau.",
                "text_en": "I go back to the theory and read more carefully.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Ich suche mehr Beispiele aus der Praxis.",
                "text_en": "I look for more examples from real practice.",
                "weights": {"inductive": 0.5, "contextual": 0.5},
            },
            {
                "id": "c",
                "text_de": "Ich versuche es bis es klappt — auch mit Fehlern.",
                "text_en": "I keep trying until it works — mistakes included.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ich lasse mir den Weg von einer KI vorschlagen.",
                "text_en": "I let an AI suggest the path.",
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
}


def _text_key(lang: str) -> str:
    """Map a UI language code to the in-file translation key.

    v0.2.0 ships DE + EN + ES + FR + EL. Any code that doesn't
    match (PT / TR / JA / unknown) falls back to EN. Future
    translation packs add a row to ``_LANG_TO_KEY`` AND populate
    the matching field in every QUESTIONS entry.
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
