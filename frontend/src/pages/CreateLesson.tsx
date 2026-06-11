/**
 * /create-lesson — standalone Lesson Creator (Phase 65 / EXP-021).
 *
 * A four-step wizard that lets a user author a lesson from scratch:
 *   Step 1 — Metadata (title, language pair, level, topic, author)
 *   Step 2 — Card editor                (65B)
 *   Step 3 — Exercise generator         (65C)
 *   Step 4 — Save + share               (65D)
 *
 * Reuses the existing content-authoring building blocks: the shared
 * language/level option lists (extracted from SaveOfflineLessonModal),
 * the analysis-to-lesson exercise generator (65C), and the Phase-64
 * Share Wizard (65D). The created lesson uses the SAME content schema
 * (v1.2) as every other lesson — no special format.
 *
 * 65A ships the metadata step + the wizard shell; later steps land in
 * 65B-65D. Storage-mode-agnostic (works in API + Dexie modes).
 */

import {useEffect, useMemo, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import {Download, Share2} from "lucide-react";

import {useI18n} from "../hooks/useI18n";
import {
    CEFR_LEVELS,
    LANGUAGE_OPTIONS,
} from "../lib/content/language-options";
import {readContributorName} from "../lib/content/contribution-history";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import CardEditor, {MIN_CARDS} from "../components/create-lesson/CardEditor";
import ExerciseGenerator, {
    MIN_EXERCISES,
} from "../components/create-lesson/ExerciseGenerator";
import {
    DEFAULT_EXERCISE_GEN_CONFIG,
    generateExercises,
    type ExerciseGenConfig,
    type GeneratorCard,
} from "../lib/content/exercise-generator";
import {
    clearLessonDraft,
    draftHasContent,
    loadLessonDraft,
    newCardId,
    saveLessonDraft,
    type LessonCardDraft,
    type LessonDraft,
    type LessonMeta,
} from "../lib/content/lesson-draft";
import {
    allChecksPass,
    buildLessonFromDraft,
    buildUserSetInput,
    checkDraft,
    type DraftValidationChecks,
} from "../lib/content/draft-to-lesson";
import {getStorage} from "../storage";
import {notify} from "../utils/notify";
import {
    applyTemplate,
    LESSON_TEMPLATE_KEYS,
    type LessonTemplateKey,
} from "../lib/content/lesson-templates";
import type {ContentLessonExercise, ContentSetEntry} from "../storage/types";

const TOTAL_STEPS = 4;
const DRAFT_AUTOSAVE_MS = 10_000;

/** Build the default metadata, seeding source language from the
 *  app language and target from the first differing option. */
function defaultMeta(appLang: string): LessonMeta {
    const source = LANGUAGE_OPTIONS.some((o) => o.code === appLang)
        ? appLang
        : "en";
    const target =
        LANGUAGE_OPTIONS.find((o) => o.code !== source)?.code ?? "en";
    return {
        title: "",
        titleNative: "",
        sourceLanguage: source,
        targetLanguage: target,
        level: "A1",
        description: "",
        author: readContributorName(),
    };
}

export default function CreateLesson() {
    const {t, lang} = useI18n();
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [meta, setMeta] = useState<LessonMeta>(() =>
        defaultMeta((lang || "en").split("-")[0]),
    );
    const [cards, setCards] = useState<LessonCardDraft[]>([]);
    const [exercises, setExercises] = useState<ContentLessonExercise[]>([]);
    const [genConfig, setGenConfig] = useState<ExerciseGenConfig>(
        DEFAULT_EXERCISE_GEN_CONFIG,
    );
    const [showError, setShowError] = useState(false);
    const [cardError, setCardError] = useState(false);
    const [exerciseError, setExerciseError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedEntry, setSavedEntry] = useState<ContentSetEntry | null>(null);
    const [savedLessonId, setSavedLessonId] = useState("");
    const [confirmCancel, setConfirmCancel] = useState(false);
    // Draft restore: a saved draft with content prompts continue-or-fresh
    // before any edits. Held until the user chooses.
    const [pendingDraft, setPendingDraft] = useState<LessonDraft | null>(null);

    // On mount: surface a restorable draft (don't auto-apply).
    useEffect(() => {
        const draft = loadLessonDraft();
        if (draftHasContent(draft)) setPendingDraft(draft);
    }, []);

    // Phase 65B — autosave the draft every 10s while editing. Skipped
    // while the restore prompt is open (we haven't applied a choice yet).
    const stateRef = useRef({step, meta, cards});
    stateRef.current = {step, meta, cards};
    useEffect(() => {
        if (pendingDraft) return;
        const id = setInterval(() => {
            const {step: s, meta: m, cards: c} = stateRef.current;
            saveLessonDraft({schema: 1, step: s, meta: m, cards: c, updatedAt: ""});
        }, DRAFT_AUTOSAVE_MS);
        return () => clearInterval(id);
    }, [pendingDraft]);

    const titleMissing = meta.title.trim().length === 0;
    const sameLanguage = meta.sourceLanguage === meta.targetLanguage;
    const metaValid = !titleMissing && !sameLanguage;

    // Dirty = anything the user could lose. Title/description/native
    // are the free-text fields; language/level have sensible defaults.
    const dirty = useMemo(
        () =>
            meta.title.trim().length > 0 ||
            meta.titleNative.trim().length > 0 ||
            meta.description.trim().length > 0,
        [meta.title, meta.titleNative, meta.description],
    );

    function update<K extends keyof LessonMeta>(key: K, value: LessonMeta[K]) {
        setMeta((prev) => ({...prev, [key]: value}));
    }

    function handleNext() {
        if (step === 1) {
            if (!metaValid) {
                setShowError(true);
                return;
            }
            setShowError(false);
        }
        if (step === 2) {
            if (cards.length < MIN_CARDS) {
                setCardError(true);
                return;
            }
            setCardError(false);
        }
        if (step === 3) {
            if (exercises.length < MIN_EXERCISES) {
                setExerciseError(true);
                return;
            }
            setExerciseError(false);
        }
        setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    }

    function applyLessonTemplate(key: LessonTemplateKey) {
        const {cards: tplCards, config} = applyTemplate(key);
        setCards(tplCards);
        setGenConfig(config);
    }

    function generateLessonExercises() {
        const genCards: GeneratorCard[] = cards.map((c) => ({
            id: c.id,
            front: c.front,
            back: c.back,
            example: c.notes,
            image: c.image,
        }));
        setExercises(generateExercises(genCards, genConfig));
        setExerciseError(false);
    }

    // --- Step 4: save + share ---
    const draftChecks = useMemo<DraftValidationChecks>(
        () => checkDraft({meta, cards, exercises}),
        [meta, cards, exercises],
    );

    async function saveLocally(): Promise<ContentSetEntry | null> {
        if (saving) return null;
        setSaving(true);
        try {
            const lesson = buildLessonFromDraft({meta, cards, exercises});
            const input = buildUserSetInput({meta, cards, exercises}, lesson);
            const entry = await getStorage().contentLoader.saveUserSet(input);
            clearLessonDraft();
            setSavedLessonId(lesson.id);
            setSavedEntry(entry);
            notify.success(t("create_lesson.save.saved", "Lesson saved!"));
            return entry;
        } catch (err) {
            notify.error(
                `${t("create_lesson.save.failed", "Could not save the lesson.")} ${
                    err instanceof Error ? err.message : ""
                }`,
            );
            return null;
        } finally {
            setSaving(false);
        }
    }

    async function saveAndShare() {
        const entry = await saveLocally();
        if (entry) navigate(`/content?share=${encodeURIComponent(entry.id)}`);
    }

    function createAnother() {
        clearLessonDraft();
        setMeta(defaultMeta((lang || "en").split("-")[0]));
        setCards([]);
        setExercises([]);
        setGenConfig(DEFAULT_EXERCISE_GEN_CONFIG);
        setSavedEntry(null);
        setSavedLessonId("");
        setStep(1);
    }

    function playSaved() {
        if (!savedEntry) return;
        const slug = savedEntry.source.replace(/\//g, "--");
        navigate(
            `/lesson/${encodeURIComponent(slug)}/${encodeURIComponent(
                savedEntry.id,
            )}/${encodeURIComponent(`${savedLessonId}.json`)}`,
        );
    }

    // --- card handlers (Step 2) ---
    function addCard(c: {front: string; back: string; notes: string; image: string}) {
        setCards((prev) => [...prev, {id: newCardId(), ...c}]);
    }
    function updateCard(id: string, patch: Partial<LessonCardDraft>) {
        setCards((prev) =>
            prev.map((card) => (card.id === id ? {...card, ...patch} : card)),
        );
    }
    function deleteCard(id: string) {
        setCards((prev) => prev.filter((card) => card.id !== id));
    }
    function importCards(rows: {front: string; back: string; notes: string}[]) {
        setCards((prev) => [
            ...prev,
            ...rows.map((r) => ({id: newCardId(), image: "", ...r})),
        ]);
    }

    function discard() {
        clearLessonDraft();
        navigate("/content");
    }

    function applyDraft(draft: LessonDraft) {
        setMeta(draft.meta);
        setCards(draft.cards);
        setStep(draft.step >= 1 && draft.step <= TOTAL_STEPS ? draft.step : 1);
        setPendingDraft(null);
    }

    function startFresh() {
        clearLessonDraft();
        setPendingDraft(null);
    }

    function handleBack() {
        setStep((s) => Math.max(1, s - 1));
    }

    function handleCancel() {
        if (dirty) {
            setConfirmCancel(true);
        } else {
            navigate("/content");
        }
    }

    return (
        <main
            id="main"
            className="page create-lesson-page"
            data-testid="create-lesson-page"
        >
            <header className="create-lesson-header">
                <h1>{t("create_lesson.title", "Create a lesson")}</h1>
                <p
                    className="create-lesson-step-indicator"
                    data-testid="create-lesson-step-indicator"
                >
                    {t("create_lesson.step_of", "Step {current} of {total}")
                        .replace("{current}", String(step))
                        .replace("{total}", String(TOTAL_STEPS))}
                </p>
            </header>

            {step === 1 && (
                <section
                    className="create-lesson-step"
                    data-testid="create-lesson-step-1"
                    aria-label={t("create_lesson.meta.heading", "Lesson details")}
                >
                    <h2>{t("create_lesson.meta.heading", "Lesson details")}</h2>

                    <div
                        className="create-lesson-templates"
                        data-testid="create-lesson-templates"
                    >
                        <p className="form-label">
                            {t(
                                "create_lesson.templates.heading",
                                "Start from a template",
                            )}
                        </p>
                        <div className="template-cards">
                            {LESSON_TEMPLATE_KEYS.map((key) => (
                                <button
                                    type="button"
                                    key={key}
                                    className="template-card"
                                    data-testid={`template-${key}`}
                                    onClick={() => applyLessonTemplate(key)}
                                >
                                    <span className="template-card-title">
                                        {t(
                                            `create_lesson.templates.${key}.title`,
                                            key,
                                        )}
                                    </span>
                                    <span className="template-card-desc muted">
                                        {t(
                                            `create_lesson.templates.${key}.desc`,
                                            "",
                                        )}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className="form-row">
                        <span className="form-label">
                            {t("create_lesson.meta.title_label", "Title")} *
                        </span>
                        <Input
                            type="text"
                            data-testid="create-lesson-title"
                            value={meta.title}
                            placeholder={t(
                                "create_lesson.meta.title_placeholder",
                                "My Lesson",
                            )}
                            onChange={(e) => update("title", e.target.value)}
                            autoFocus
                        />
                    </label>
                    {showError && titleMissing && (
                        <p
                            className="form-hint form-hint-warning"
                            data-testid="create-lesson-title-error"
                            role="alert"
                        >
                            {t(
                                "create_lesson.meta.title_required",
                                "A title is required.",
                            )}
                        </p>
                    )}

                    <label className="form-row">
                        <span className="form-label">
                            {t(
                                "create_lesson.meta.title_native_label",
                                "Title in target language",
                            )}
                        </span>
                        <Input
                            type="text"
                            data-testid="create-lesson-title-native"
                            value={meta.titleNative}
                            onChange={(e) =>
                                update("titleNative", e.target.value)
                            }
                        />
                    </label>

                    <div className="form-row form-row-inline">
                        <div className="form-field">
                            <span className="form-label">
                                {t(
                                    "create_lesson.meta.target_lang_label",
                                    "Language learned",
                                )}{" "}
                                *
                            </span>
                            <Select
                                value={meta.targetLanguage}
                                onValueChange={(v) =>
                                    update("targetLanguage", v)
                                }
                            >
                                <SelectTrigger data-testid="create-lesson-target-lang">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LANGUAGE_OPTIONS.map((o) => (
                                        <SelectItem key={o.code} value={o.code}>
                                            {o.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="form-field">
                            <span className="form-label">
                                {t(
                                    "create_lesson.meta.source_lang_label",
                                    "Your language",
                                )}
                            </span>
                            <Select
                                value={meta.sourceLanguage}
                                onValueChange={(v) =>
                                    update("sourceLanguage", v)
                                }
                            >
                                <SelectTrigger data-testid="create-lesson-source-lang">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LANGUAGE_OPTIONS.map((o) => (
                                        <SelectItem key={o.code} value={o.code}>
                                            {o.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="form-field">
                            <span className="form-label">
                                {t("create_lesson.meta.level_label", "Level")}
                            </span>
                            <Select
                                value={meta.level}
                                onValueChange={(v) => update("level", v)}
                            >
                                <SelectTrigger data-testid="create-lesson-level">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CEFR_LEVELS.map((lvl) => (
                                        <SelectItem key={lvl} value={lvl}>
                                            {lvl}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {showError && sameLanguage && (
                        <p
                            className="form-hint form-hint-warning"
                            data-testid="create-lesson-same-language-error"
                            role="alert"
                        >
                            {t(
                                "create_lesson.meta.same_language",
                                "The language learned must differ from your language.",
                            )}
                        </p>
                    )}

                    <label className="form-row">
                        <span className="form-label">
                            {t(
                                "create_lesson.meta.description_label",
                                "Topic / description",
                            )}
                        </span>
                        <textarea
                            data-testid="create-lesson-description"
                            value={meta.description}
                            rows={3}
                            onChange={(e) =>
                                update("description", e.target.value)
                            }
                        />
                    </label>

                    <label className="form-row">
                        <span className="form-label">
                            {t("create_lesson.meta.author_label", "Author name")}
                        </span>
                        <Input
                            type="text"
                            data-testid="create-lesson-author"
                            value={meta.author}
                            onChange={(e) => update("author", e.target.value)}
                        />
                    </label>
                </section>
            )}

            {step === 2 && (
                <>
                    <CardEditor
                        cards={cards}
                        onAdd={addCard}
                        onUpdate={updateCard}
                        onDelete={deleteCard}
                        onReorder={setCards}
                        onClearAll={() => setCards([])}
                        onImport={importCards}
                    />
                    {cardError && cards.length < MIN_CARDS && (
                        <p
                            className="form-hint form-hint-warning"
                            data-testid="create-lesson-card-error"
                            role="alert"
                        >
                            {t(
                                "create_lesson.cards.min_to_advance",
                                "Add at least {n} cards to continue.",
                            ).replace("{n}", String(MIN_CARDS))}
                        </p>
                    )}
                </>
            )}

            {step === 3 && (
                <>
                    <ExerciseGenerator
                        exercises={exercises}
                        config={genConfig}
                        onConfigChange={setGenConfig}
                        onGenerate={generateLessonExercises}
                        onReorder={setExercises}
                        onDelete={(id) =>
                            setExercises((prev) =>
                                prev.filter((e) => e.id !== id),
                            )
                        }
                    />
                    {exerciseError && exercises.length < MIN_EXERCISES && (
                        <p
                            className="form-hint form-hint-warning"
                            data-testid="create-lesson-exercise-error"
                            role="alert"
                        >
                            {t(
                                "create_lesson.exercises.min_to_advance",
                                "Generate at least {n} exercises to continue.",
                            ).replace("{n}", String(MIN_EXERCISES))}
                        </p>
                    )}
                </>
            )}

            {step === 4 && !savedEntry && (
                <section
                    className="create-lesson-step"
                    data-testid="create-lesson-step-4"
                    aria-label={t("create_lesson.review.heading", "Review and save")}
                >
                    <h2>{t("create_lesson.review.heading", "Review and save")}</h2>
                    <ul
                        className="create-lesson-summary"
                        data-testid="create-lesson-summary"
                    >
                        <li>
                            {t("create_lesson.review.title", "Title")}:{" "}
                            <strong>{meta.title}</strong>
                        </li>
                        <li>
                            {t("create_lesson.review.pair", "Languages")}:{" "}
                            {meta.sourceLanguage} → {meta.targetLanguage} ·{" "}
                            {meta.level}
                        </li>
                        <li>
                            {t("create_lesson.review.cards", "Cards")}:{" "}
                            {cards.length}
                        </li>
                        <li>
                            {t("create_lesson.review.exercises", "Exercises")}:{" "}
                            {exercises.length}
                        </li>
                    </ul>
                    <ul
                        className="create-lesson-checklist"
                        data-testid="create-lesson-checklist"
                    >
                        {(
                            [
                                ["hasTitle", "Has a title"],
                                ["languagePair", "Language pair is valid"],
                                ["enoughCards", "At least 4 cards"],
                                ["enoughExercises", "At least 5 exercises"],
                                ["enoughTypes", "At least 2 exercise types"],
                                ["schemaValid", "Valid lesson structure"],
                            ] as Array<[keyof DraftValidationChecks, string]>
                        ).map(([key, fallback]) => {
                            const pass = draftChecks[key];
                            return (
                                <li
                                    key={key}
                                    data-testid={`check-${key}`}
                                    data-pass={pass ? "true" : "false"}
                                    className={
                                        pass ? "check-pass" : "check-fail"
                                    }
                                >
                                    {pass ? "✓" : "✗"}{" "}
                                    {t(`create_lesson.review.check_${key}`, fallback)}
                                </li>
                            );
                        })}
                    </ul>
                    <div className="form-actions">
                        <Button
                            type="button"
                            data-testid="create-lesson-save-local"
                            disabled={!allChecksPass(draftChecks) || saving}
                            onClick={() => void saveLocally()}
                        >
                            <Download className="h-5 w-5" aria-hidden="true" />
                            {saving
                                ? t("common.loading", "Loading…")
                                : t("create_lesson.save.save_local", "Save locally")}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            data-testid="create-lesson-save-share"
                            disabled={!allChecksPass(draftChecks) || saving}
                            onClick={() => void saveAndShare()}
                        >
                            <Share2 className="h-5 w-5" aria-hidden="true" />
                            {t("create_lesson.save.save_share", "Save and share")}
                        </Button>
                    </div>
                </section>
            )}

            {savedEntry && (
                <section
                    className="create-lesson-step"
                    data-testid="create-lesson-saved"
                >
                    <h2>{t("create_lesson.save.saved", "Lesson saved!")}</h2>
                    <div className="form-actions">
                        <Button
                            type="button"
                            data-testid="create-lesson-play"
                            onClick={playSaved}
                        >
                            {t("create_lesson.save.play", "Play lesson")}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            data-testid="create-lesson-create-another"
                            onClick={createAnother}
                        >
                            {t(
                                "create_lesson.save.create_another",
                                "Create another lesson",
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            data-testid="create-lesson-to-browser"
                            onClick={() => navigate("/content")}
                        >
                            {t(
                                "create_lesson.save.to_browser",
                                "To Content Browser",
                            )}
                        </Button>
                    </div>
                </section>
            )}

            {!savedEntry && (
            <nav className="create-lesson-nav" aria-label={t(
                "create_lesson.nav_label",
                "Wizard navigation",
            )}>
                <Button
                    type="button"
                    variant="outline"
                    data-testid="create-lesson-cancel"
                    onClick={handleCancel}
                >
                    {t("create_lesson.cancel", "Cancel")}
                </Button>
                {step > 1 && (
                    <Button
                        type="button"
                        variant="outline"
                        data-testid="create-lesson-back"
                        onClick={handleBack}
                    >
                        {t("create_lesson.back", "Back")}
                    </Button>
                )}
                {step < TOTAL_STEPS && (
                    <Button
                        type="button"
                        data-testid="create-lesson-next"
                        onClick={handleNext}
                    >
                        {t("create_lesson.next", "Next")}
                    </Button>
                )}
            </nav>
            )}

            {confirmCancel && (
                <div
                    className="modal-overlay"
                    data-testid="create-lesson-cancel-confirm"
                >
                    <div
                        className="modal-card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-lesson-cancel-title"
                    >
                        <h2
                            id="create-lesson-cancel-title"
                            className="modal-title"
                        >
                            {t(
                                "create_lesson.cancel_confirm_title",
                                "Discard this lesson?",
                            )}
                        </h2>
                        <p>
                            {t(
                                "create_lesson.cancel_confirm_body",
                                "Your unsaved lesson will be lost.",
                            )}
                        </p>
                        <div className="form-actions">
                            <Button
                                type="button"
                                variant="outline"
                                data-testid="create-lesson-cancel-keep"
                                onClick={() => setConfirmCancel(false)}
                            >
                                {t(
                                    "create_lesson.cancel_keep",
                                    "Keep editing",
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                data-testid="create-lesson-cancel-discard"
                                onClick={discard}
                            >
                                {t("create_lesson.cancel_discard", "Discard")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {pendingDraft && (
                <div
                    className="modal-overlay"
                    data-testid="create-lesson-draft-prompt"
                >
                    <div
                        className="modal-card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-lesson-draft-title"
                    >
                        <h2
                            id="create-lesson-draft-title"
                            className="modal-title"
                        >
                            {t(
                                "create_lesson.draft.title",
                                "Draft found",
                            )}
                        </h2>
                        <p>
                            {t(
                                "create_lesson.draft.body",
                                "You have an unfinished lesson. Continue where you left off or start fresh?",
                            )}
                        </p>
                        <div className="form-actions">
                            <Button
                                type="button"
                                variant="secondary"
                                data-testid="create-lesson-draft-fresh"
                                onClick={startFresh}
                            >
                                {t(
                                    "create_lesson.draft.start_fresh",
                                    "Start fresh",
                                )}
                            </Button>
                            <Button
                                type="button"
                                data-testid="create-lesson-draft-continue"
                                onClick={() => applyDraft(pendingDraft)}
                            >
                                {t(
                                    "create_lesson.draft.continue",
                                    "Continue",
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
