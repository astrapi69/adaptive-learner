"""Tests for the Lesson schema v1.0
(Phase 43 / EXP-002 / 2B-lesson — P-102 + P-103 lesson half).

Pin the closed enums (ExerciseType / StepType), the per-type
required-field validators, referential integrity between
exercise.card_ids and lesson.cards, slug-safe id rules, the
JSON round-trip, and the JSON Schema export for every model
in this module.
"""

from __future__ import annotations

import pytest
from adaptive_learner_content_loader.schema import (
    Card,
    CardTokenRole,
    ClozeBlank,
    Exercise,
    ExerciseType,
    InlineExample,
    Lesson,
    LessonStep,
    StepType,
    TokenRole,
    dict_to_lesson,
    lesson_to_dict,
)
from adaptive_learner_content_loader.schema_export import (
    card_schema,
    exercise_schema,
    lesson_schema,
    lesson_step_schema,
    write_schemas,
)
from pydantic import ValidationError

# --- Card ----------------------------------------------------------------


class TestCard:
    def test_minimal_card(self) -> None:
        c = Card(id="bonjour", front="Bonjour", back="Hello")
        assert c.tags == []
        assert c.image is None

    def test_id_must_be_slug(self) -> None:
        with pytest.raises(ValidationError):
            Card(id="Mixed Case", front="x", back="y")

    def test_tags_must_be_slug(self) -> None:
        Card(id="bonjour", front="x", back="y", tags=["greeting", "a1"])
        with pytest.raises(ValidationError):
            Card(id="bonjour", front="x", back="y", tags=["Bad Tag"])

    def test_frozen(self) -> None:
        c = Card(id="bonjour", front="x", back="y")
        with pytest.raises(ValidationError):
            c.front = "tampered"  # type: ignore[misc]


# --- ExerciseType (closed enum) -----------------------------------------


class TestExerciseTypeEnum:
    def test_known_values(self) -> None:
        assert ExerciseType("matching") is ExerciseType.MATCHING
        assert ExerciseType("picture_choice") is ExerciseType.PICTURE_CHOICE
        assert ExerciseType("free_text") is ExerciseType.FREE_TEXT
        assert ExerciseType("word_tiles") is ExerciseType.WORD_TILES
        # Phase 52D / v1.35.0 — schema 1.0 → 1.1 added CLOZE.
        assert ExerciseType("cloze") is ExerciseType.CLOZE

    def test_unknown_value_rejected(self) -> None:
        # Future-release candidates that have NOT yet landed.
        # Phase 52D ships CLOZE; ``ordering`` and
        # ``drag_image_pair`` would each be a future minor bump.
        with pytest.raises(ValueError):
            ExerciseType("ordering")


# --- TokenRole (closed enum, Phase 52I / P-130) -------------------------


class TestTokenRoleEnum:
    """Pin the closed grammatical-role enum.

    Adding a role is a minor schema_version bump; rejecting
    unknown values here surfaces typos in pilot content at
    validation time, not at runtime when the cloze generator
    silently skips them.
    """

    def test_known_values(self) -> None:
        assert TokenRole("article") is TokenRole.ARTICLE
        assert TokenRole("verb") is TokenRole.VERB
        assert TokenRole("noun") is TokenRole.NOUN
        assert TokenRole("adjective") is TokenRole.ADJECTIVE
        assert TokenRole("preposition") is TokenRole.PREPOSITION
        assert TokenRole("gender_marker") is TokenRole.GENDER_MARKER
        assert TokenRole("tense_marker") is TokenRole.TENSE_MARKER

    def test_unknown_value_rejected(self) -> None:
        # ``pronoun`` is documented as a future-release extension —
        # 52I ships the seven roles only, this typo-of-tomorrow MUST
        # fail today.
        with pytest.raises(ValueError):
            TokenRole("pronoun")


class TestCardTokenRole:
    """Pin the ``{token, role}`` annotation model."""

    def test_minimal_annotation(self) -> None:
        annotation = CardTokenRole(token="le", role=TokenRole.ARTICLE)
        assert annotation.token == "le"
        assert annotation.role is TokenRole.ARTICLE

    def test_role_accepts_string_value(self) -> None:
        # JSON deserialisation always lands the role as a string.
        annotation = CardTokenRole.model_validate({"token": "soy", "role": "verb"})
        assert annotation.role is TokenRole.VERB

    def test_unknown_role_rejected_at_model_level(self) -> None:
        with pytest.raises(ValidationError):
            CardTokenRole.model_validate({"token": "x", "role": "auxiliary"})

    def test_empty_token_rejected(self) -> None:
        with pytest.raises(ValidationError):
            CardTokenRole(token="", role=TokenRole.NOUN)

    def test_extra_fields_rejected(self) -> None:
        with pytest.raises(ValidationError):
            CardTokenRole.model_validate({"token": "le", "role": "article", "comment": "nope"})

    def test_frozen(self) -> None:
        annotation = CardTokenRole(token="le", role=TokenRole.ARTICLE)
        with pytest.raises(ValidationError):
            annotation.token = "la"  # type: ignore[misc]


class TestCardTokenRolesField:
    """Pin the optional ``Card.token_roles`` field (P-130)."""

    def test_card_without_token_roles_is_valid(self) -> None:
        # Old content (v1.0 cards) keeps validating; the field is optional.
        card = Card(id="bonjour", front="Bonjour", back="Hello")
        assert card.token_roles is None

    def test_card_with_token_roles_validates(self) -> None:
        card = Card(
            id="art-le",
            front="le",
            back="the (masculine singular)",
            token_roles=[CardTokenRole(token="le", role=TokenRole.ARTICLE)],
        )
        assert card.token_roles is not None
        assert len(card.token_roles) == 1
        assert card.token_roles[0].role is TokenRole.ARTICLE

    def test_card_with_multiple_token_roles(self) -> None:
        card = Card(
            id="phr-soy-estudiante",
            front="Soy estudiante.",
            back="I am a student.",
            token_roles=[
                CardTokenRole(token="Soy", role=TokenRole.VERB),
                CardTokenRole(token="estudiante", role=TokenRole.NOUN),
            ],
        )
        assert len(card.token_roles or []) == 2

    def test_card_token_roles_from_json(self) -> None:
        # The pilot lessons store token_roles as JSON; round-trip must work.
        card = Card.model_validate(
            {
                "id": "ser-soy",
                "front": "yo soy",
                "back": "I am (ser)",
                "tags": ["verb"],
                "token_roles": [{"token": "soy", "role": "verb"}],
            }
        )
        assert card.token_roles is not None
        assert card.token_roles[0].token == "soy"

    def test_card_with_invalid_role_rejected(self) -> None:
        with pytest.raises(ValidationError):
            Card.model_validate(
                {
                    "id": "ser-soy",
                    "front": "yo soy",
                    "back": "I am",
                    "token_roles": [{"token": "soy", "role": "auxiliary"}],
                }
            )

    def test_card_token_roles_max_length(self) -> None:
        # The schema caps at 10 entries to keep the JSON files compact.
        too_many = [{"token": f"t{idx}", "role": "noun"} for idx in range(11)]
        with pytest.raises(ValidationError):
            Card.model_validate(
                {
                    "id": "x",
                    "front": "x",
                    "back": "x",
                    "token_roles": too_many,
                }
            )

    # --- v1.3: technical / programming fields ---------------------------

    def test_card_without_code_fields_is_valid(self) -> None:
        # Backward compatibility: pre-v1.3 content omits every new field.
        card = Card(id="bonjour", front="Bonjour", back="Hello")
        assert card.code_snippet is None
        assert card.media_type is None
        assert card.difficulty is None

    def test_card_with_full_code_payload_validates(self) -> None:
        card = Card.model_validate(
            {
                "id": "py-print",
                "front": "print()",
                "back": "Gibt Text auf der Konsole aus",
                "code_snippet": "print('Hallo Welt')\nprint(42)",
                "code_language": "python",
                "expected_output": "Hallo Welt\n42",
                "notes": "print() kann mehrere Argumente trennen.",
                "hint": "Denke an die Klammern",
                "difficulty": 1,
                "tags": ["syntax", "output"],
                "media_type": "code",
            }
        )
        assert card.code_language == "python"
        assert card.expected_output.startswith("Hallo Welt")
        assert card.hint == "Denke an die Klammern"
        assert card.difficulty == 1
        assert card.media_type == "code"

    def test_card_excel_formula_payload(self) -> None:
        card = Card.model_validate(
            {
                "id": "xl-sverweis",
                "front": "SVERWEIS / VLOOKUP",
                "back": "Sucht einen Wert in der ersten Spalte",
                "code_snippet": "=SVERWEIS(A2; B:D; 3; FALSCH)",
                "code_language": "excel",
                "media_type": "formula",
                "difficulty": 3,
            }
        )
        assert card.media_type == "formula"
        assert card.code_snippet.startswith("=SVERWEIS")

    def test_card_rejects_unknown_media_type(self) -> None:
        with pytest.raises(ValidationError):
            Card(id="x", front="x", back="y", media_type="video")

    def test_card_rejects_out_of_range_difficulty(self) -> None:
        with pytest.raises(ValidationError):
            Card(id="x", front="x", back="y", difficulty=6)
        with pytest.raises(ValidationError):
            Card(id="x", front="x", back="y", difficulty=0)


# --- Exercise: type-specific validation --------------------------------


def _exercise_matching(**overrides: object) -> Exercise:
    defaults: dict[str, object] = {
        "id": "ex-match-1",
        "type": ExerciseType.MATCHING,
        "prompt": "Match each French word with its English translation",
        "pairs": [
            {"left": "Bonjour", "right": "Hello"},
            {"left": "Merci", "right": "Thank you"},
        ],
    }
    defaults.update(overrides)
    return Exercise(**defaults)


def _exercise_picture(**overrides: object) -> Exercise:
    defaults: dict[str, object] = {
        "id": "ex-pic-1",
        "type": ExerciseType.PICTURE_CHOICE,
        "prompt": "Which image shows 'chat' (cat)?",
        "images": [
            {"src": "assets/cat.png", "label": "Cat", "is_correct": "true"},
            {"src": "assets/dog.png", "label": "Dog"},
            {"src": "assets/bird.png", "label": "Bird"},
        ],
    }
    defaults.update(overrides)
    return Exercise(**defaults)


def _exercise_free(**overrides: object) -> Exercise:
    defaults: dict[str, object] = {
        "id": "ex-free-1",
        "type": ExerciseType.FREE_TEXT,
        "prompt": "Translate 'Hello' to French.",
        "accept": ["Bonjour", "bonjour"],
    }
    defaults.update(overrides)
    return Exercise(**defaults)


def _exercise_tiles(**overrides: object) -> Exercise:
    defaults: dict[str, object] = {
        "id": "ex-tile-1",
        "type": ExerciseType.WORD_TILES,
        "prompt": "Arrange: 'Je m'appelle Pierre'",
        "tiles": ["Je", "m'appelle", "Pierre"],
    }
    defaults.update(overrides)
    return Exercise(**defaults)


class TestExerciseDirection:
    """EXP-018 / Phase 62 — the optional ``direction`` field."""

    def test_defaults_to_receptive(self) -> None:
        """Omitting direction yields target_to_source (backward compatible)."""
        assert _exercise_matching().direction == "target_to_source"
        assert _exercise_free().direction == "target_to_source"

    @pytest.mark.parametrize(
        "direction",
        ["source_to_target", "target_to_source", "both", "random"],
    )
    def test_all_four_values_valid(self, direction: str) -> None:
        assert _exercise_free(direction=direction).direction == direction

    def test_invalid_direction_rejected(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_free(direction="sideways")

    def test_direction_round_trips_from_json(self) -> None:
        ex = Exercise.model_validate(
            {
                "id": "ex-dir-1",
                "type": "free_text",
                "prompt": "Translate 'Hello'.",
                "accept": ["Bonjour"],
                "direction": "source_to_target",
            }
        )
        assert ex.direction == "source_to_target"

    def test_direction_enum_carries_the_four_drill_modes(self) -> None:
        """The Direction enum (generated from the canonical engine schema)
        carries exactly the four drill modes. Post-D3b the JSON Schema is
        the mirrored engine artefact, not a Pydantic export - its content
        is byte-gated by check_engine_schema_parity.py."""
        from adaptive_learner_content_loader.schema import Direction

        assert {member.value for member in Direction} == {
            "source_to_target",
            "target_to_source",
            "both",
            "random",
        }


class TestMatchingExercise:
    def test_valid(self) -> None:
        ex = _exercise_matching()
        assert ex.type is ExerciseType.MATCHING
        assert len(ex.pairs or []) == 2

    def test_pairs_required(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_matching(pairs=None)
        with pytest.raises(ValidationError):
            _exercise_matching(pairs=[])

    def test_pair_keys_strict(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_matching(
                pairs=[{"left": "x", "wrong_key": "y"}],
            )
        with pytest.raises(ValidationError):
            _exercise_matching(
                pairs=[{"left": "x", "right": "y", "extra": "z"}],
            )


class TestMatchingFromCards:
    """``from_cards`` derives pairs from the referenced cards; parity with the
    engine (learn-content-engine 0.7.0)."""

    def test_from_cards_without_pairs_is_valid(self) -> None:
        ex = _exercise_matching(
            from_cards=True, card_ids=["bonjour", "merci"], pairs=None
        )
        assert ex.from_cards is True
        assert ex.pairs is None

    def test_from_cards_requires_card_ids(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_matching(from_cards=True, card_ids=[], pairs=None)

    def test_from_cards_forbids_explicit_pairs(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_matching(
                from_cards=True,
                card_ids=["bonjour"],
                pairs=[{"left": "Bonjour", "right": "Hello"}],
            )

    def test_plain_matching_still_requires_pairs(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_matching(from_cards=False, pairs=None)


class TestMultipleChoiceExercise:
    """Native multiple_choice (schema v1.6); parity with the engine
    (learn-content-engine 0.8.0). Coexists with cloze select/multiselect."""

    @staticmethod
    def _exercise(**overrides: object) -> Exercise:
        defaults: dict[str, object] = {
            "id": "ex-mc-1",
            "type": ExerciseType.MULTIPLE_CHOICE,
            "prompt": "Wer hat an einer Kreuzung ohne Zeichen Vorfahrt?",
            "options": [
                {"text": "Wer von rechts kommt", "correct": True},
                {"text": "Wer von links kommt"},
                {"text": "Das groessere Fahrzeug"},
            ],
        }
        defaults.update(overrides)
        return Exercise(**defaults)

    def test_single_valid(self) -> None:
        ex = self._exercise()
        assert ex.type is ExerciseType.MULTIPLE_CHOICE
        assert ex.multiple is False
        assert len(ex.options or []) == 3

    def test_multi_valid(self) -> None:
        ex = self._exercise(
            multiple=True,
            options=[
                {"text": "2", "correct": True},
                {"text": "3", "correct": True},
                {"text": "4"},
            ],
        )
        assert ex.multiple is True

    def test_requires_two_options(self) -> None:
        with pytest.raises(ValidationError):
            self._exercise(options=[{"text": "only", "correct": True}])
        with pytest.raises(ValidationError):
            self._exercise(options=None)

    def test_single_requires_exactly_one_correct(self) -> None:
        with pytest.raises(ValidationError):
            self._exercise(options=[{"text": "a"}, {"text": "b"}])
        with pytest.raises(ValidationError):
            self._exercise(
                options=[
                    {"text": "a", "correct": True},
                    {"text": "b", "correct": True},
                ]
            )

    def test_multi_requires_at_least_one_correct(self) -> None:
        with pytest.raises(ValidationError):
            self._exercise(multiple=True, options=[{"text": "a"}, {"text": "b"}])

    def test_option_texts_must_be_unique(self) -> None:
        with pytest.raises(ValidationError):
            self._exercise(
                options=[
                    {"text": "same", "correct": True},
                    {"text": "same"},
                ]
            )

    def test_option_shape_strict(self) -> None:
        with pytest.raises(ValidationError):
            self._exercise(
                options=[
                    {"text": "a", "correct": True, "hint": "no"},
                    {"text": "b"},
                ]
            )


class TestPictureChoiceExercise:
    def test_valid(self) -> None:
        ex = _exercise_picture()
        assert ex.type is ExerciseType.PICTURE_CHOICE
        assert len(ex.images or []) == 3

    def test_min_two_images(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_picture(images=None)
        with pytest.raises(ValidationError):
            _exercise_picture(
                images=[{"src": "a.png", "label": "A", "is_correct": "true"}],
            )

    def test_exactly_one_correct(self) -> None:
        # Zero correct
        with pytest.raises(ValidationError):
            _exercise_picture(
                images=[
                    {"src": "a.png", "label": "A"},
                    {"src": "b.png", "label": "B"},
                ],
            )
        # Two correct
        with pytest.raises(ValidationError):
            _exercise_picture(
                images=[
                    {"src": "a.png", "label": "A", "is_correct": "true"},
                    {"src": "b.png", "label": "B", "is_correct": "true"},
                ],
            )

    def test_image_keys_strict(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_picture(
                images=[
                    {"src": "a.png", "label": "A", "is_correct": "true"},
                    {"src": "b.png"},  # missing label
                ],
            )
        with pytest.raises(ValidationError):
            _exercise_picture(
                images=[
                    {
                        "src": "a.png",
                        "label": "A",
                        "is_correct": "true",
                        "garbage": "x",
                    },
                    {"src": "b.png", "label": "B"},
                ],
            )


class TestFreeTextExercise:
    def test_valid(self) -> None:
        ex = _exercise_free()
        assert ex.accept == ["Bonjour", "bonjour"]

    def test_accept_required(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_free(accept=None)
        with pytest.raises(ValidationError):
            _exercise_free(accept=[])


class TestWordTilesExercise:
    def test_valid(self) -> None:
        ex = _exercise_tiles()
        assert ex.tiles == ["Je", "m'appelle", "Pierre"]

    def test_min_two_tiles(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_tiles(tiles=None)
        with pytest.raises(ValidationError):
            _exercise_tiles(tiles=["Onlyone"])

    def test_accept_orderings_must_permute(self) -> None:
        # Valid: two permutations of [0,1,2]
        _exercise_tiles(accept_orderings=[[0, 1, 2], [2, 1, 0]])
        # Invalid: missing index
        with pytest.raises(ValidationError):
            _exercise_tiles(accept_orderings=[[0, 1]])
        # Invalid: duplicate index
        with pytest.raises(ValidationError):
            _exercise_tiles(accept_orderings=[[0, 0, 1]])
        # Invalid: out-of-range
        with pytest.raises(ValidationError):
            _exercise_tiles(accept_orderings=[[0, 1, 5]])


def _exercise_cloze(**overrides: object) -> Exercise:
    defaults: dict[str, object] = {
        "id": "ex-cloze-1",
        "type": ExerciseType.CLOZE,
        "prompt": "Fill in the article.",
        "sentence": "Je vois ___ chat dans le jardin.",
        "blanks": [
            {
                "accept": ["un", "Un"],
                "hint": "indefinite article",
                "placeholder": "?",
            }
        ],
    }
    defaults.update(overrides)
    return Exercise(**defaults)


class TestClozeBlank:
    """Pin the per-blank metadata model (Phase 52D / P-127)."""

    def test_minimal_blank(self) -> None:
        blank = ClozeBlank(accept=["un"])
        assert blank.accept == ["un"]
        assert blank.hint is None
        assert blank.placeholder is None

    def test_accept_must_be_non_empty(self) -> None:
        with pytest.raises(ValidationError):
            ClozeBlank(accept=[])

    def test_extras_forbidden(self) -> None:
        with pytest.raises(ValidationError):
            ClozeBlank.model_validate({"accept": ["un"], "footnote": "nope"})


class TestClozeExercise:
    """Pin the v1.1 CLOZE exercise type (Phase 52D / P-127, F-111)."""

    def test_valid_single_blank(self) -> None:
        ex = _exercise_cloze()
        assert ex.type is ExerciseType.CLOZE
        assert ex.sentence == "Je vois ___ chat dans le jardin."
        assert ex.blanks is not None and len(ex.blanks) == 1
        assert ex.blanks[0].accept == ["un", "Un"]

    def test_sentence_required(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_cloze(sentence=None)

    def test_blanks_required(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_cloze(blanks=None)

    def test_marker_count_must_equal_blanks_length(self) -> None:
        # Two markers but one blank — rejected.
        with pytest.raises(ValidationError):
            _exercise_cloze(
                sentence="J'ai ___ ami et ___ amie.",
                blanks=[{"accept": ["un"]}],
            )
        # One marker but two blanks — rejected.
        with pytest.raises(ValidationError):
            _exercise_cloze(
                sentence="J'ai ___ ami.",
                blanks=[
                    {"accept": ["un"]},
                    {"accept": ["une"]},
                ],
            )

    def test_multiple_blanks_in_order(self) -> None:
        ex = _exercise_cloze(
            sentence="J'ai ___ ami et ___ amie.",
            blanks=[
                {"accept": ["un"]},
                {"accept": ["une"]},
            ],
        )
        assert ex.blanks is not None and len(ex.blanks) == 2
        assert ex.blanks[0].accept == ["un"]
        assert ex.blanks[1].accept == ["une"]

    def test_cloze_mode_optional_defaults_to_none(self) -> None:
        ex = _exercise_cloze()
        # Default is None — renderer treats absence as "type".
        assert ex.cloze_mode is None

    def test_cloze_mode_type_accepted(self) -> None:
        ex = _exercise_cloze(cloze_mode="type")
        assert ex.cloze_mode == "type"

    def test_cloze_mode_select_requires_distractors(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_cloze(cloze_mode="select")
        # With distractors, select is fine.
        ex = _exercise_cloze(
            cloze_mode="select",
            distractors=["le", "la", "les"],
        )
        assert ex.cloze_mode == "select"
        assert ex.distractors == ["le", "la", "les"]

    def test_cloze_mode_rejects_unknown_string(self) -> None:
        # Literal["type", "select"] rejects anything else.
        with pytest.raises(ValidationError):
            _exercise_cloze(cloze_mode="dropdown")

    def test_json_roundtrip(self) -> None:
        ex = _exercise_cloze(
            cloze_mode="select",
            distractors=["le", "la"],
            hint="article indéfini",
        )
        payload = ex.model_dump(mode="json")
        rebuilt = Exercise.model_validate(payload)
        assert rebuilt == ex


def _exercise_multiselect(**overrides: object) -> Exercise:
    """A valid #1195 cloze multiselect exercise: question stem + the
    ``accept`` (all correct) / ``distractors`` (all wrong) option lists,
    no blanks/markers."""
    defaults: dict[str, object] = {
        "id": "ex-cloze-ms-1",
        "type": ExerciseType.CLOZE,
        "cloze_mode": "multiselect",
        "prompt": "Select all that apply.",
        "sentence": "Welche Staedte liegen in Deutschland?",
        "accept": ["Berlin", "Hamburg"],
        "distractors": ["Wien", "Zuerich"],
    }
    defaults.update(overrides)
    return Exercise(**defaults)


class TestClozeMultiSelect:
    """Pin the #1195 cloze ``multiselect`` ('select all that apply') mode.

    Reuses ``accept`` (every entry correct in this mode) + ``distractors``;
    no new field, no blanks/markers."""

    def test_valid_multiselect(self) -> None:
        ex = _exercise_multiselect()
        assert ex.cloze_mode == "multiselect"
        assert ex.accept == ["Berlin", "Hamburg"]
        assert ex.distractors == ["Wien", "Zuerich"]
        # No blanks/markers required in this mode.
        assert ex.blanks is None

    def test_requires_non_empty_accept(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_multiselect(accept=None)
        with pytest.raises(ValidationError):
            _exercise_multiselect(accept=[])

    def test_requires_non_empty_distractors(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_multiselect(distractors=[])

    def test_requires_non_empty_sentence(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_multiselect(sentence=None)

    def test_accept_and_distractors_must_be_disjoint(self) -> None:
        # The same option may not be both correct and a distractor.
        with pytest.raises(ValidationError):
            _exercise_multiselect(
                accept=["Berlin", "Hamburg"],
                distractors=["Hamburg", "Wien"],
            )

    def test_does_not_require_blanks_or_markers(self) -> None:
        # A multiselect sentence has no '___' markers and no blanks; this
        # must NOT trip the blank-based marker-count check.
        ex = _exercise_multiselect(sentence="No markers here at all?")
        assert ex.cloze_mode == "multiselect"

    def test_multiselect_json_roundtrip(self) -> None:
        ex = _exercise_multiselect()
        rebuilt = Exercise.model_validate(ex.model_dump(mode="json"))
        assert rebuilt == ex


class TestClozeBackwardCompat:
    """The blank-based ``type`` / ``select`` modes are unchanged (#1195)."""

    def test_type_mode_still_valid(self) -> None:
        ex = _exercise_cloze(cloze_mode="type")
        assert ex.cloze_mode == "type"
        assert ex.blanks is not None and len(ex.blanks) == 1

    def test_select_mode_still_requires_distractors(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_cloze(cloze_mode="select")
        ex = _exercise_cloze(cloze_mode="select", distractors=["le", "la"])
        assert ex.cloze_mode == "select"

    def test_blank_based_marker_check_still_enforced(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_cloze(
                sentence="J'ai ___ ami et ___ amie.",
                blanks=[{"accept": ["un"]}],
            )


class TestExerciseCommon:
    def test_id_must_be_slug(self) -> None:
        with pytest.raises(ValidationError):
            _exercise_matching(id="Bad Id")

    def test_card_ids_must_be_slug(self) -> None:
        _exercise_matching(card_ids=["bonjour", "merci"])
        with pytest.raises(ValidationError):
            _exercise_matching(card_ids=["Bad Id"])

    def test_extra_forbidden(self) -> None:
        with pytest.raises(ValidationError):
            Exercise(
                id="x",
                type=ExerciseType.MATCHING,
                prompt="p",
                pairs=[{"left": "x", "right": "y"}],
                unknown="surprise",
            )

    def test_distractor_pool_optional_and_capped(self) -> None:
        ex = _exercise_matching(distractors=["d1", "d2"])
        assert ex.distractors == ["d1", "d2"]
        # Capped at 20
        with pytest.raises(ValidationError):
            _exercise_matching(distractors=[f"d{i}" for i in range(21)])


# --- LessonStep --------------------------------------------------------


class TestLessonStep:
    def test_theory_requires_body(self) -> None:
        with pytest.raises(ValidationError):
            LessonStep(id="s1", type=StepType.THEORY)

    def test_theory_forbids_exercise(self) -> None:
        with pytest.raises(ValidationError):
            LessonStep(
                id="s1",
                type=StepType.THEORY,
                body="text",
                exercise=_exercise_matching(),
            )

    def test_exercise_requires_exercise_payload(self) -> None:
        with pytest.raises(ValidationError):
            LessonStep(id="s1", type=StepType.EXERCISE)

    def test_exercise_forbids_body(self) -> None:
        with pytest.raises(ValidationError):
            LessonStep(
                id="s1",
                type=StepType.EXERCISE,
                body="should-not-be-here",
                exercise=_exercise_matching(),
            )

    def test_valid_theory(self) -> None:
        s = LessonStep(
            id="intro",
            type=StepType.THEORY,
            title="Why greetings matter",
            body="# Greetings\n\nA few common phrases...",
        )
        assert s.exercise is None

    def test_valid_exercise(self) -> None:
        s = LessonStep(
            id="ex-1",
            type=StepType.EXERCISE,
            title="Match these",
            exercise=_exercise_matching(),
        )
        assert s.body is None

    def test_exercise_accepts_theory_ref(self) -> None:
        # #709 — content annotates exercises with an explicit theory_ref;
        # extra="forbid" must NOT reject it.
        s = LessonStep(
            id="ex-1",
            type=StepType.EXERCISE,
            theory_ref="intro",
            exercise=_exercise_matching(),
        )
        assert s.theory_ref == "intro"

    def test_theory_ref_defaults_to_none(self) -> None:
        s = LessonStep(id="ex-1", type=StepType.EXERCISE, exercise=_exercise_matching())
        assert s.theory_ref is None


# --- Lesson ------------------------------------------------------------


def _minimal_lesson() -> Lesson:
    return Lesson(
        id="01-greetings",
        title="Greetings",
        cards=[
            Card(id="bonjour", front="Bonjour", back="Hello"),
            Card(id="merci", front="Merci", back="Thank you"),
        ],
        steps=[
            LessonStep(
                id="intro",
                type=StepType.THEORY,
                body="# Greetings\n\nLet's learn how to greet in French.",
            ),
            LessonStep(
                id="ex-1",
                type=StepType.EXERCISE,
                exercise=_exercise_matching(
                    card_ids=["bonjour", "merci"],
                ),
            ),
        ],
    )


class TestLesson:
    def test_minimal_valid(self) -> None:
        lesson = _minimal_lesson()
        assert lesson.id == "01-greetings"
        assert len(lesson.steps) == 2
        assert lesson.estimated_minutes == 10  # default

    def test_id_must_be_slug(self) -> None:
        with pytest.raises(ValidationError):
            Lesson(
                id="Greetings 1",
                title="x",
                cards=[],
                steps=[
                    LessonStep(id="s1", type=StepType.THEORY, body="x"),
                ],
            )

    def test_at_least_one_step(self) -> None:
        with pytest.raises(ValidationError):
            Lesson(id="empty", title="x", cards=[], steps=[])

    def test_unique_card_ids(self) -> None:
        with pytest.raises(ValidationError):
            Lesson(
                id="dup",
                title="x",
                cards=[
                    Card(id="bonjour", front="Bonjour", back="Hello"),
                    Card(id="bonjour", front="x", back="y"),
                ],
                steps=[
                    LessonStep(id="s1", type=StepType.THEORY, body="x"),
                ],
            )

    def test_unique_step_ids(self) -> None:
        with pytest.raises(ValidationError):
            Lesson(
                id="dup",
                title="x",
                cards=[],
                steps=[
                    LessonStep(id="s1", type=StepType.THEORY, body="x"),
                    LessonStep(id="s1", type=StepType.THEORY, body="y"),
                ],
            )

    def test_referential_integrity_passes(self) -> None:
        _minimal_lesson()  # would raise if broken

    def test_referential_integrity_catches_missing_card(self) -> None:
        with pytest.raises(ValidationError) as exc:
            Lesson(
                id="orphan",
                title="x",
                cards=[Card(id="bonjour", front="x", back="y")],
                steps=[
                    LessonStep(
                        id="ex-1",
                        type=StepType.EXERCISE,
                        exercise=_exercise_matching(
                            card_ids=["bonjour", "missing-card"],
                        ),
                    ),
                ],
            )
        assert "missing-card" in str(exc.value)

    def test_get_step_by_id(self) -> None:
        lesson = _minimal_lesson()
        step = lesson.get_step("intro")
        assert step is not None
        assert step.type is StepType.THEORY
        assert lesson.get_step("not-there") is None

    def test_get_card_by_id(self) -> None:
        lesson = _minimal_lesson()
        card = lesson.get_card("bonjour")
        assert card is not None
        assert card.front == "Bonjour"
        assert lesson.get_card("not-there") is None

    def test_estimated_minutes_bounded(self) -> None:
        with pytest.raises(ValidationError):
            Lesson(
                id="x",
                title="x",
                cards=[],
                estimated_minutes=0,
                steps=[
                    LessonStep(id="s", type=StepType.THEORY, body="x"),
                ],
            )
        with pytest.raises(ValidationError):
            Lesson(
                id="x",
                title="x",
                cards=[],
                estimated_minutes=500,
                steps=[
                    LessonStep(id="s", type=StepType.THEORY, body="x"),
                ],
            )

    def test_extra_forbidden(self) -> None:
        with pytest.raises(ValidationError):
            Lesson(
                id="x",
                title="x",
                cards=[],
                unknown_field="surprise",
                steps=[
                    LessonStep(id="s", type=StepType.THEORY, body="x"),
                ],
            )

    def test_json_round_trip(self) -> None:
        original = _minimal_lesson()
        payload = lesson_to_dict(original)
        revived = dict_to_lesson(payload)
        assert revived == original

    def test_language_pair_optional_defaults_none(self) -> None:
        # Pre-v1.2 lessons omit the pair fields entirely; the
        # parent set is authoritative.
        lesson = _minimal_lesson()
        assert lesson.target_language is None
        assert lesson.source_language is None

    def test_language_pair_round_trip(self) -> None:
        # A standalone exported lesson can carry its own pair.
        payload = lesson_to_dict(_minimal_lesson())
        payload["target_language"] = "fr"
        payload["source_language"] = "de"
        revived = dict_to_lesson(payload)
        assert revived.target_language == "fr"
        assert revived.source_language == "de"

    def test_language_pair_must_be_bcp47(self) -> None:
        payload = lesson_to_dict(_minimal_lesson())
        payload["source_language"] = "deutsch"
        with pytest.raises(ValidationError):
            dict_to_lesson(payload)


# --- Schema export -----------------------------------------------------


class TestLessonSchemaExport:
    def test_lesson_schema_object_with_required_fields(self) -> None:
        schema = lesson_schema()
        assert schema["type"] == "object"
        assert {"id", "title", "steps"} <= set(schema["required"])

    def test_lesson_schema_inlines_nested_models(self) -> None:
        schema = lesson_schema()
        # Pydantic v2 puts nested models under $defs
        assert "$defs" in schema
        defs = set(schema["$defs"].keys())
        # ContentLoader schema models all surface
        assert {"Card", "Exercise", "LessonStep"} <= defs

    def test_card_schema_required_fields(self) -> None:
        schema = card_schema()
        assert {"id", "front", "back"} <= set(schema["required"])

    def test_exercise_schema_lists_type_enum(self) -> None:
        schema = exercise_schema()

        def resolve(node: dict) -> dict:
            if "$ref" in node:
                ref_name = node["$ref"].rsplit("/", 1)[-1]
                return schema["$defs"][ref_name]
            return node

        # Since schema 1.7 the type field is anyOf(core enum, ext pattern):
        # the CORE enum stays the closed six-type set, the second branch is
        # the opaque ``ext:``-namespace tier (engine 0.10.0).
        type_schema = resolve(schema["properties"]["type"])
        branches = [resolve(branch) for branch in type_schema.get("anyOf", [type_schema])]
        enum_branch = next(branch for branch in branches if "enum" in branch)
        assert set(enum_branch["enum"]) == {
            "matching",
            "picture_choice",
            "free_text",
            "word_tiles",
            "cloze",
            "multiple_choice",
        }
        pattern_branch = next((branch for branch in branches if "pattern" in branch), None)
        assert pattern_branch is not None and pattern_branch["pattern"].startswith("^ext:")

    def test_lesson_step_schema_lists_step_type_enum(self) -> None:
        schema = lesson_step_schema()
        type_schema = schema["properties"]["type"]
        if "$ref" in type_schema:
            ref_name = type_schema["$ref"].rsplit("/", 1)[-1]
            type_schema = schema["$defs"][ref_name]
        assert set(type_schema["enum"]) == {"theory", "exercise"}

    def test_write_schemas_emits_all_six(self, tmp_path: object) -> None:
        out = tmp_path / "schemas"  # type: ignore[operator]
        written = write_schemas(out)
        assert set(written.keys()) == {
            "content-manifest.schema.json",
            "content-set.schema.json",
            "lesson.schema.json",
            "card.schema.json",
            "exercise.schema.json",
            "lesson-step.schema.json",
        }
        for path in written.values():
            assert path.exists()
            assert path.read_text(encoding="utf-8").startswith("{")


class TestInlineExamples:
    """Schema v1.5 — inline ``examples`` on theory steps + exercises (#1326).

    Additive + optional: an example carries real inline content (a sample
    sentence, or a syntax-highlighted code snippet when ``language`` is
    set), distinct from the ``example_url`` LINK variant (#139 / v1.4).
    """

    def test_theory_step_accepts_text_and_code_examples(self) -> None:
        step = LessonStep(
            id="s-theory",
            type=StepType.THEORY,
            body="A component returns JSX.",
            examples=[
                InlineExample(content="Bonjour tout le monde !", title="Greeting"),
                InlineExample(
                    content="function App() {\n  return <h1>Hi</h1>;\n}",
                    language="jsx",
                    title="A React component",
                ),
            ],
        )
        assert step.examples is not None
        assert len(step.examples) == 2
        # Text example: no language.
        assert step.examples[0].language is None
        assert step.examples[0].content.startswith("Bonjour")
        # Code example: language drives syntax highlighting downstream.
        assert step.examples[1].language == "jsx"

    def test_exercise_accepts_examples(self) -> None:
        exercise = _exercise_free(
            examples=[InlineExample(content="Merci = Thank you")]
        )
        assert exercise.examples is not None
        assert exercise.examples[0].content == "Merci = Thank you"
        assert exercise.examples[0].language is None
        assert exercise.examples[0].title is None

    def test_content_without_examples_stays_valid(self) -> None:
        """Backward compatibility: pre-v1.5 content omits ``examples``."""
        step = LessonStep(id="s1", type=StepType.THEORY, body="x")
        assert step.examples is None
        exercise = _exercise_free()
        assert exercise.examples is None

    def test_example_requires_content(self) -> None:
        with pytest.raises(ValidationError):
            InlineExample(language="python")  # type: ignore[call-arg]
        with pytest.raises(ValidationError):
            InlineExample(content="")

    def test_example_rejects_unknown_field(self) -> None:
        """``extra='forbid'`` guards against typo'd keys."""
        with pytest.raises(ValidationError):
            InlineExample(content="ok", lang="python")  # type: ignore[call-arg]

    def test_examples_coexist_with_example_url(self) -> None:
        """Inline ``examples`` and the external ``example_url`` link are
        complementary, not mutually exclusive."""
        step = LessonStep(
            id="s-both",
            type=StepType.THEORY,
            body="x",
            example_url="https://example.com/demo",
            examples=[InlineExample(content="inline sample")],
        )
        assert step.example_url == "https://example.com/demo"
        assert step.examples is not None and len(step.examples) == 1

    def test_examples_survive_round_trip(self) -> None:
        """``lesson_to_dict`` → ``dict_to_lesson`` preserves examples."""
        lesson = Lesson(
            id="l1",
            title="Examples",
            steps=[
                LessonStep(
                    id="s1",
                    type=StepType.THEORY,
                    body="x",
                    examples=[InlineExample(content="print('hi')", language="python")],
                ),
                LessonStep(
                    id="s2",
                    type=StepType.EXERCISE,
                    exercise=_exercise_free(
                        id="ex1",
                        examples=[InlineExample(content="Bonjour", title="hint")],
                    ),
                ),
            ],
        )
        restored = dict_to_lesson(lesson_to_dict(lesson))
        theory = restored.get_step("s1")
        assert theory is not None and theory.examples is not None
        assert theory.examples[0].language == "python"
        exercise_step = restored.get_step("s2")
        assert exercise_step is not None and exercise_step.exercise is not None
        assert exercise_step.exercise.examples is not None
        assert exercise_step.exercise.examples[0].title == "hint"

    def test_lesson_schema_defines_inline_example(self) -> None:
        """The generated JSON-Schema carries the InlineExample shape."""
        schema = lesson_schema()
        assert "InlineExample" in schema.get("$defs", {})
        node = schema["$defs"]["InlineExample"]
        assert "content" in node["properties"]
        assert node.get("required") == ["content"]
