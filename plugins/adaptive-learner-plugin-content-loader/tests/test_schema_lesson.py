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
    Exercise,
    ExerciseType,
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

    def test_unknown_value_rejected(self) -> None:
        with pytest.raises(ValueError):
            ExerciseType("cloze")


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
        # The type field discriminates the four ExerciseType
        # values; the JSON schema surfaces them as an enum.
        type_schema = schema["properties"]["type"]
        if "$ref" in type_schema:
            ref_name = type_schema["$ref"].rsplit("/", 1)[-1]
            type_schema = schema["$defs"][ref_name]
        assert set(type_schema["enum"]) == {
            "matching",
            "picture_choice",
            "free_text",
            "word_tiles",
        }

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
