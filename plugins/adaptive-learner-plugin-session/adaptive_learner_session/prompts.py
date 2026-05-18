"""Per-method × per-step system prompt composition.

The composed prompt is::

    {method_core}

    {step_modifier}

    {context_block}

``method_core`` defines HOW the session runs (project-reference
§11): rule-first / example-first / error-provoking / dialogic /
contextual / AI-adaptive. ``step_modifier`` says WHERE in the
7-step learning cycle (§3.2) the user is right now.
``context_block`` injects the project topic + goal +
dominant-profile-method hint so the AI never has to ask "what
are we learning?".

Languages: DE + EN. Anything not starting with ``de`` falls back
to EN. Adding a translation pack means extending the inner dict;
no callsite changes.
"""

from __future__ import annotations

from typing import Any

METHODS: tuple[str, ...] = (
    "deductive",
    "inductive",
    "error_based",
    "dialogic",
    "contextual",
    "ai_adaptive",
)
MIN_STEP = 1
MAX_STEP = 7
STEP_RANGE = tuple(range(MIN_STEP, MAX_STEP + 1))

# --- Method cores: HOW the session runs ------------------------------------

_METHOD_CORES: dict[str, dict[str, str]] = {
    "deductive": {
        "de": (
            "Du bist ein deduktiver Lernbegleiter. Erklaere zuerst die Regel "
            "klar und vollstaendig, gib dann konkrete Uebungen, die diese "
            "Regel anwenden. Sei strukturiert und vorhersehbar."
        ),
        "en": (
            "You are a deductive learning companion. State the rule clearly "
            "and completely first, then give concrete exercises that apply "
            "the rule. Be structured and predictable."
        ),
    },
    "inductive": {
        "de": (
            "Du bist ein induktiver Lernbegleiter. Beginne mit Beispielen; "
            "lass die Nutzerin die zugrundeliegende Regel selbst ableiten. "
            "Bestaetige oder korrigiere die Ableitung erst nachdem sie "
            "ausgesprochen wurde."
        ),
        "en": (
            "You are an inductive learning companion. Start with examples; "
            "let the learner derive the underlying rule themselves. Confirm "
            "or correct the derivation only after it's stated."
        ),
    },
    "error_based": {
        "de": (
            "Du bist ein fehlerzentrierter Lernbegleiter. Provoziere gezielt "
            "die typischen Fehler dieses Themas, dann erklaere ausfuehrlich, "
            "warum sie auftreten. Lernen ueber den Schmerz des Irrtums."
        ),
        "en": (
            "You are an error-focused learning companion. Deliberately "
            "provoke this topic's typical mistakes, then explain in detail "
            "why they happen. Learning through the friction of being wrong."
        ),
    },
    "dialogic": {
        "de": (
            "Du bist ein dialogischer Lernbegleiter. Fuehre ein Gespraech, "
            "korrigiere sofort und freundlich, halte das Stressniveau "
            "niedrig. Bestaerke kleine Fortschritte explizit."
        ),
        "en": (
            "You are a dialogic learning companion. Hold a conversation, "
            "correct gently and immediately, keep stress low. Affirm small "
            "wins explicitly."
        ),
    },
    "contextual": {
        "de": (
            "Du bist ein kontextueller Lernbegleiter. Simuliere eine "
            "konkrete Alltagssituation, in der das Thema gebraucht wird. "
            "Theorie nur dann, wenn die Situation sie aufwirft."
        ),
        "en": (
            "You are a contextual learning companion. Simulate a concrete "
            "everyday situation that needs this topic. Introduce theory "
            "only when the situation demands it."
        ),
    },
    "ai_adaptive": {
        "de": (
            "Du bist ein KI-adaptiver Lernbegleiter. Waehle die fuer diesen "
            "Nutzer und dieses Thema passendste Methode aus den anderen "
            "fuenf, begruende kurz warum, und arbeite nach dieser Methode."
        ),
        "en": (
            "You are an AI-adaptive learning companion. Pick whichever of "
            "the other five methods fits this learner + this topic best, "
            "briefly justify the choice, then run the session that way."
        ),
    },
}


# --- Step modifiers: WHERE in the 7-step cycle the learner is --------------

_STEP_MODIFIERS: dict[int, dict[str, str]] = {
    1: {
        "de": "Aktueller Zyklus-Schritt: 1 (Input). Praesentiere Information, ein Beispiel oder eine Aufgabe — noch ohne Erwartung an Antwort.",
        "en": "Current cycle step: 1 (Input). Present information, an example, or a task — no answer expected yet.",
    },
    2: {
        "de": "Aktueller Zyklus-Schritt: 2 (Versuch). Lass die Nutzerin den Stoff anwenden, ohne Sicherheitsnetz.",
        "en": "Current cycle step: 2 (Attempt). Let the learner apply the material without a safety net.",
    },
    3: {
        "de": "Aktueller Zyklus-Schritt: 3 (Fehler). Stelle die Abweichung zwischen Erwartung und Ergebnis nuechtern fest.",
        "en": "Current cycle step: 3 (Error). State the gap between expectation and result, matter-of-factly.",
    },
    4: {
        "de": "Aktueller Zyklus-Schritt: 4 (Feedback). Korrigiere mit Erklaerung; vermeide reines 'Falsch / Richtig'.",
        "en": "Current cycle step: 4 (Feedback). Correct with explanation; never just 'wrong / right'.",
    },
    5: {
        "de": "Aktueller Zyklus-Schritt: 5 (Anpassung). Schlage eine Aenderung von Methode, Tempo oder Fokus vor.",
        "en": "Current cycle step: 5 (Adapt). Suggest a change in method, pace, or focus.",
    },
    6: {
        "de": "Aktueller Zyklus-Schritt: 6 (Wiederholung). Bitte um einen neuen Versuch mit dem angepassten Vorgehen.",
        "en": "Current cycle step: 6 (Repeat). Ask for another attempt under the adjusted approach.",
    },
    7: {
        "de": "Aktueller Zyklus-Schritt: 7 (Integration). Hilf der Nutzerin, das Geuebte in einen breiteren Zusammenhang zu setzen.",
        "en": "Current cycle step: 7 (Integration). Help the learner place what they've practiced into a broader context.",
    },
}


def _lang_key(lang: str) -> str:
    return "de" if isinstance(lang, str) and lang.startswith("de") else "en"


def _format_weight(value: float) -> str:
    """Two-decimal float, no trailing zero noise."""
    return f"{value:.2f}".rstrip("0").rstrip(".") or "0"


def _dominant_method(profile: dict[str, Any]) -> str | None:
    """Argmax over the six method-weight keys; alphabetical tiebreak.

    Returns None when the profile doesn't carry any of the six
    keys (e.g. the user hasn't been assessed yet — the session
    plugin still runs but the AI loses the profile-tilt hint).
    """
    weights = {
        m: float(profile.get(m, 0.0)) for m in METHODS if isinstance(profile.get(m), (int, float))
    }
    if not weights:
        return None
    return max(sorted(weights), key=weights.__getitem__)


def build_prompt(
    project: dict[str, Any],
    profile: dict[str, Any],
    method: str,
    step: int,
    lang: str,
) -> str:
    """Compose the system prompt for one ``(method, step, lang)`` cell.

    Raises ``ValueError`` on unknown method / out-of-range step;
    callers (the route handler + the hookimpl) translate that into
    a typed AdaptiveLearnerError so the global handler maps it to
    HTTP 400.
    """
    if method not in METHODS:
        raise ValueError(f"Unknown method {method!r}; expected one of {METHODS}.")
    if not isinstance(step, int) or step < MIN_STEP or step > MAX_STEP:
        raise ValueError(f"step must be an int in [{MIN_STEP}, {MAX_STEP}]; got {step!r}.")

    key = _lang_key(lang)
    core = _METHOD_CORES[method][key]
    modifier = _STEP_MODIFIERS[step][key]

    topic = project.get("topic", "?")
    goal = project.get("goal", "?")
    dominant = _dominant_method(profile)
    if key == "de":
        context = f"Lernprojekt: '{topic}' | Ziel: '{goal}'."
        if dominant:
            weight = _format_weight(float(profile.get(dominant, 0.0)))
            context += f" Profil-Hinweis: dominante Methode ist {dominant} (Gewicht {weight})."
    else:
        context = f"Learning project: '{topic}' | Goal: '{goal}'."
        if dominant:
            weight = _format_weight(float(profile.get(dominant, 0.0)))
            context += f" Profile hint: dominant method is {dominant} (weight {weight})."

    return f"{core}\n\n{modifier}\n\n{context}"
