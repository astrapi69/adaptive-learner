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

import {Download} from "lucide-react";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";

import {useI18n} from "../../hooks/ui/useI18n";
import PageContainer from "../../shared/layout/PageContainer";
import {LANGUAGE_OPTIONS} from "../../lib/content/language/language-options";
import {readContributorName} from "../../lib/content/placement/contribution-history";
import {Button} from "@/components/ui/button";
import MetadataStep from "../../components/create-lesson/MetadataStep";
import WizardSteps from "../../components/create-lesson/WizardSteps";
import EditLoadState from "../../components/create-lesson/EditLoadState";
import {MIN_CARDS} from "../../components/create-lesson/CardEditor";
import {MIN_EXERCISES} from "../../components/create-lesson/ExerciseGenerator";
import {
    DEFAULT_EXERCISE_GEN_CONFIG,
    generateExercises,
    type ExerciseGenConfig,
    type GeneratorCard,
} from "../../lib/content/lesson/exercise-generator";
import {
    clearLessonDraft,
    draftHasContent,
    loadLessonDraft,
    newCardId,
    saveLessonDraft,
    type LessonCardDraft,
    type LessonDraft,
    type LessonMeta,
} from "../../lib/content/lesson/lesson-draft";
import {
    buildLessonFromDraft,
    buildUserSetInput,
    checkDraft,
    draftSetId,
    lessonToDraftInput,
    preservedTheorySteps,
    type DraftValidationChecks,
} from "../../lib/content/lesson/draft-to-lesson";
import {
    buildBookLesson,
    buildBookUserSetInput,
    normalizeBook,
} from "../../lib/content/lesson/book-to-lesson";
import {downloadLessonJson} from "../../lib/content/lesson/lesson-export";
import {nextCopySetId} from "../../lib/content/lesson/lesson-import";
import BookSteps from "../../components/create-lesson/BookSteps";
import type {BookFields} from "../../components/create-lesson/BookTextStep";
import {resolveActiveAiProvider} from "../../lib/ai/providers/resolve-provider";
import {readLearnerState} from "../../lib/learning/learnerState";
import type {TheoryStep} from "../../lib/ai/generation/exercise-generation-prompt";
import {getStorage} from "../../storage";
import {notify} from "../../utils/notify";
import {
    applyTemplate,
    type LessonTemplateKey,
} from "../../lib/content/lesson/lesson-templates";
import {
    USER_GENERATED_SOURCE,
    type ContentLesson,
    type ContentLessonExercise,
    type ContentLessonStep,
    type ContentSetEntry,
    type UserLessonOrigin,
} from "../../storage/types";

/** Edit-mode context (#1740): the existing set/lesson the wizard was
 *  opened to edit. Held so a save overwrites the SAME set + lesson file
 *  (preserving filename-keyed progress) and preserves the lesson's
 *  authored theory + any sibling lessons the wizard doesn't touch. */
interface EditContext {
    source: string;
    setId: string;
    origin: UserLessonOrigin;
    /** All lessons in the set (the edited one + untouched siblings). */
    lessons: ContentLesson[];
    /** Index (in ``lessons``) of the lesson being edited. */
    editIndex: number;
    /** The edited lesson's original steps (for theory preservation). */
    originalSteps: ContentLessonStep[];
    /** The edited lesson's id (== its ``lessons/{id}.json`` filename). */
    lessonId: string;
}

const TOTAL_STEPS = 4;
/** #1743 — the book-text path skips the card + deterministic-exercise
 *  steps: Metadata -> BookText -> Review. */
const TOTAL_STEPS_BOOK = 3;
const DRAFT_AUTOSAVE_MS = 10_000;

const EMPTY_BOOK_FIELDS: BookFields = {title: "", author: "", url: "", asin: ""};

/** Total wizard steps for the active path (book flow skips two steps). */
function stepCountFor(bookMode: boolean): number {
    return bookMode ? TOTAL_STEPS_BOOK : TOTAL_STEPS;
}

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
    const params = useParams();
    // #1740 — /create-lesson/edit/:source/:setId opens the wizard
    // pre-filled to edit an existing own lesson.
    const editMode = Boolean(params.source && params.setId);
    const [editContext, setEditContext] = useState<EditContext | null>(null);
    const [editLoading, setEditLoading] = useState(editMode);
    const [editError, setEditError] = useState<string | null>(null);

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
    // #1672 — the built lesson, kept so "Save as file" can export the exact
    // canonical JSON without rebuilding from the (already-cleared) draft.
    const [savedLesson, setSavedLesson] = useState<ContentLesson | null>(null);
    const [confirmCancel, setConfirmCancel] = useState(false);
    // Draft restore: a saved draft with content prompts continue-or-fresh
    // before any edits. Held until the user chooses.
    const [pendingDraft, setPendingDraft] = useState<LessonDraft | null>(null);

    // #1743 — book-text path state. ``bookMode`` switches the wizard to the
    // 3-step Metadata -> BookText -> Review flow; the AI produces the theory
    // steps + exercises from the pasted chunk.
    const [bookMode, setBookMode] = useState(false);
    const [bookText, setBookText] = useState("");
    const [bookFields, setBookFields] = useState<BookFields>(EMPTY_BOOK_FIELDS);
    const [theorySteps, setTheorySteps] = useState<TheoryStep[]>([]);

    const totalSteps = stepCountFor(bookMode);

    /** Resolve the active AI provider seam, or ``null`` when no key /
     *  learner is set (the "no key" signal the BookTextStep gates on). */
    const resolveProvider = useCallback(async () => {
        const {userId} = readLearnerState();
        if (!userId) return null;
        return resolveActiveAiProvider(userId);
    }, []);

    // On mount: surface a restorable draft (don't auto-apply). Skipped in
    // edit mode — editing loads the existing lesson, not the draft slot,
    // and must never clobber an unrelated new-lesson draft (#1740).
    useEffect(() => {
        if (editMode) return;
        const draft = loadLessonDraft();
        if (draftHasContent(draft)) setPendingDraft(draft);
    }, [editMode]);

    // #1740 — edit mode: load the existing set, pre-fill the wizard.
    useEffect(() => {
        if (!editMode) return;
        let cancelled = false;
        const source = decodeURIComponent(params.source as string);
        const setId = decodeURIComponent(params.setId as string);
        (async () => {
            try {
                const storage = getStorage();
                const [listing, setsList] = await Promise.all([
                    storage.contentLoader.listLessons(source, setId),
                    storage.contentLoader.listSets(),
                ]);
                if (listing.lessons.length === 0) {
                    throw new Error("This set has no lessons to edit.");
                }
                const lessons = await Promise.all(
                    listing.lessons.map((f) =>
                        storage.contentLoader.getLesson(source, setId, f),
                    ),
                );
                const entry = setsList.sets.find(
                    (s) => s.source === source && s.id === setId,
                );
                const editIndex = 0;
                const editLesson = lessons[editIndex];
                const prefill = lessonToDraftInput(editLesson, entry);
                if (cancelled) return;
                setMeta(prefill.meta);
                setCards(prefill.cards);
                setExercises(prefill.exercises);
                setEditContext({
                    source,
                    setId,
                    origin: (entry?.domain as UserLessonOrigin) ?? "imported",
                    lessons,
                    editIndex,
                    originalSteps: editLesson.steps,
                    lessonId: editLesson.id,
                });
                setEditLoading(false);
            } catch (err) {
                if (cancelled) return;
                setEditError(err instanceof Error ? err.message : String(err));
                setEditLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [editMode, params.source, params.setId]);

    // Phase 65B — autosave the draft every 10s while editing. Skipped
    // while the restore prompt is open (we haven't applied a choice yet)
    // and in edit mode (which never writes the shared draft slot, #1740).
    const stateRef = useRef({step, meta, cards});
    stateRef.current = {step, meta, cards};
    useEffect(() => {
        if (pendingDraft || editMode) return;
        const id = setInterval(() => {
            const {step: s, meta: m, cards: c} = stateRef.current;
            saveLessonDraft({schema: 1, step: s, meta: m, cards: c, updatedAt: ""});
        }, DRAFT_AUTOSAVE_MS);
        return () => clearInterval(id);
    }, [pendingDraft, editMode]);

    const titleMissing = meta.title.trim().length === 0;
    // #1715 — a same-language pair (source === target) is legitimate
    // knowledge-domain content (e.g. the ki-einsteiger set: de -> de),
    // so it does NOT block advancing. It only drives a non-blocking hint
    // in Step 1, mirroring SaveOfflineLessonModal.
    const sameLanguage = meta.sourceLanguage === meta.targetLanguage;
    const metaValid = !titleMissing;

    // Dirty = anything the user could lose. Title/description/native
    // are the free-text fields; language/level have sensible defaults.
    const dirty = useMemo(
        () =>
            meta.title.trim().length > 0 ||
            meta.titleNative.trim().length > 0 ||
            meta.description.trim().length > 0 ||
            bookText.trim().length > 0,
        [meta.title, meta.titleNative, meta.description, bookText],
    );

    function update(key: keyof LessonMeta, value: string) {
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
        if (bookMode) {
            // Book flow: step 2 requires a successful AI generation (theory
            // + at least one exercise) before advancing to Review.
            if (step === 2) {
                if (theorySteps.length === 0 || exercises.length === 0) {
                    setExerciseError(true);
                    return;
                }
                setExerciseError(false);
            }
            setStep((s) => Math.min(TOTAL_STEPS_BOOK, s + 1));
            return;
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

    /** #1743 — enter the book-text path from Step 1 and advance to the
     *  BookText step. */
    function startBookMode() {
        setBookMode(true);
        setStep(2);
    }

    /** BookTextStep reports the AI-generated theory + exercises. */
    function handleBookGenerated(
        steps: TheoryStep[],
        generated: ContentLessonExercise[],
    ) {
        setTheorySteps(steps);
        setExercises(generated);
        setExerciseError(false);
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

    /** #1740 — the set ids already taken by user-generated sets, so a
     *  "save as copy" never collides with an existing lesson. */
    async function listExistingUserSetIds(): Promise<Set<string>> {
        try {
            const list = await getStorage().contentLoader.listSets();
            return new Set(
                list.sets
                    .filter((s) => s.source === USER_GENERATED_SOURCE)
                    .map((s) => s.id),
            );
        } catch {
            return new Set();
        }
    }

    async function saveLocally(): Promise<ContentSetEntry | null> {
        if (saving) return null;
        setSaving(true);
        try {
            let lesson: ContentLesson;
            let input: Parameters<
                ReturnType<typeof getStorage>["contentLoader"]["saveUserSet"]
            >[0];
            if (editContext) {
                // Edit mode (#1740): reuse the existing set id + lesson
                // filename so the save OVERWRITES in place (progress keyed
                // on the filename survives), preserve the lesson's authored
                // theory, and carry any sibling lessons the wizard doesn't
                // touch.
                lesson = buildLessonFromDraft(
                    {meta, cards, exercises},
                    {
                        id: editContext.lessonId,
                        theorySteps: preservedTheorySteps(
                            editContext.originalSteps,
                            meta,
                        ),
                    },
                );
                input = buildUserSetInput({meta, cards, exercises}, lesson, {
                    setId: editContext.setId,
                    origin: editContext.origin,
                });
                if (editContext.lessons.length > 1) {
                    input = {
                        ...input,
                        lessons: editContext.lessons.map((l, i) =>
                            i === editContext.editIndex ? lesson : l,
                        ),
                    };
                }
            } else if (bookMode) {
                const bookInput = {meta, theorySteps, exercises};
                lesson = buildBookLesson(bookInput);
                input = buildBookUserSetInput(
                    bookInput,
                    lesson,
                    normalizeBook(bookFields),
                );
            } else {
                lesson = buildLessonFromDraft({meta, cards, exercises});
                input = buildUserSetInput({meta, cards, exercises}, lesson);
            }
            const entry = await getStorage().contentLoader.saveUserSet(input);
            if (!editMode) clearLessonDraft();
            setSavedLessonId(lesson.id);
            setSavedLesson(lesson);
            setSavedEntry(entry);
            notify.success(
                editMode
                    ? t("create_lesson.save.updated", "Lesson updated!")
                    : t("create_lesson.save.saved", "Lesson saved!"),
            );
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

    /** #1740 — save the edited lesson as a NEW copy, leaving the original
     *  untouched (the deliberate alternative to overwriting). */
    async function saveCopy(): Promise<ContentSetEntry | null> {
        if (saving || !editContext) return null;
        setSaving(true);
        try {
            const copyMeta: LessonMeta = {
                ...meta,
                title: `${meta.title.trim()} ${t(
                    "create_lesson.save.copy_suffix",
                    "(copy)",
                )}`,
            };
            const copyInput = {meta: copyMeta, cards, exercises};
            const lesson = buildLessonFromDraft(copyInput, {
                theorySteps: preservedTheorySteps(
                    editContext.originalSteps,
                    copyMeta,
                ),
            });
            const existing = await listExistingUserSetIds();
            const setId = nextCopySetId(draftSetId(copyMeta), existing);
            const input = buildUserSetInput(copyInput, lesson, {
                setId,
                origin: "imported",
            });
            const entry = await getStorage().contentLoader.saveUserSet(input);
            setSavedLessonId(lesson.id);
            setSavedLesson(lesson);
            setSavedEntry(entry);
            notify.success(t("create_lesson.save.copied", "Saved as a copy!"));
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
        setBookMode(false);
        setBookText("");
        setBookFields(EMPTY_BOOK_FIELDS);
        setTheorySteps([]);
        setSavedEntry(null);
        setSavedLessonId("");
        setSavedLesson(null);
        setStep(1);
    }

    /** #1672 — download the just-created lesson as canonical JSON, an
     *  independent alternative to the PR share path (backup / move to
     *  another device). */
    function exportSavedLesson() {
        if (!savedLesson) return;
        downloadLessonJson(savedLesson);
        notify.success(
            t("create_lesson.save.file_saved", "Lesson saved as a file."),
        );
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
        // #1740 — in edit mode the shared new-lesson draft slot is not
        // ours to clear (it may hold an unrelated unfinished lesson).
        if (!editMode) clearLessonDraft();
        navigate("/content?tab=my");
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
            navigate("/content?tab=my");
        }
    }

    return (
        <PageContainer testId="create-lesson-page">
            <header className="create-lesson-header mb-6 flex flex-col gap-1">
                <h1>
                    {editMode
                        ? t("create_lesson.edit_title", "Edit lesson")
                        : t("create_lesson.title", "Create a lesson")}
                </h1>
                {!editLoading && !editError && (
                    <p
                        className="create-lesson-step-indicator text-sm text-fg-muted"
                        data-testid="create-lesson-step-indicator"
                    >
                        {t("create_lesson.step_of", "Step {current} of {total}")
                            .replace("{current}", String(step))
                            .replace("{total}", String(totalSteps))}
                    </p>
                )}
            </header>

            <EditLoadState
                loading={editLoading}
                error={Boolean(editError)}
                onBack={() => navigate("/content?tab=my")}
                t={t}
            />

            {!editLoading && !editError && step === 1 && (
                <MetadataStep
                    meta={meta}
                    showError={showError}
                    titleMissing={titleMissing}
                    sameLanguage={sameLanguage}
                    onUpdate={update}
                    onApplyTemplate={applyLessonTemplate}
                    onStartBookMode={startBookMode}
                    t={t}
                />
            )}

            {bookMode && (
                <BookSteps
                    step={step}
                    saved={Boolean(savedEntry)}
                    bookText={bookText}
                    onBookTextChange={setBookText}
                    book={bookFields}
                    onBookChange={(patch) =>
                        setBookFields((prev) => ({...prev, ...patch}))
                    }
                    language={meta.targetLanguage}
                    resolveProvider={resolveProvider}
                    onGenerated={handleBookGenerated}
                    theorySteps={theorySteps}
                    exercises={exercises}
                    advanceBlocked={exerciseError}
                    saving={saving}
                    onSaveLocal={() => void saveLocally()}
                    onSaveShare={() => void saveAndShare()}
                    t={t}
                />
            )}

            {!bookMode && (
                <WizardSteps
                    step={step}
                    saved={Boolean(savedEntry)}
                    meta={meta}
                    cards={cards}
                    exercises={exercises}
                    genConfig={genConfig}
                    cardError={cardError}
                    exerciseError={exerciseError}
                    draftChecks={draftChecks}
                    saving={saving}
                    editMode={editMode}
                    onAddCard={addCard}
                    onUpdateCard={updateCard}
                    onDeleteCard={deleteCard}
                    onReorderCards={setCards}
                    onImportCards={importCards}
                    onGenerate={generateLessonExercises}
                    onConfigChange={setGenConfig}
                    onReorderExercises={setExercises}
                    onDeleteExercise={(id) =>
                        setExercises((prev) => prev.filter((e) => e.id !== id))
                    }
                    onSaveLocal={() => void saveLocally()}
                    onSaveShare={() => void saveAndShare()}
                    onSaveCopy={editMode ? () => void saveCopy() : undefined}
                    t={t}
                />
            )}

            {savedEntry && (
                <section
                    className="create-lesson-step flex flex-col gap-4"
                    data-testid="create-lesson-saved"
                >
                    <h2 className="text-xl font-semibold text-fg-primary">{t("create_lesson.save.saved", "Lesson saved!")}</h2>
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
                            data-testid="create-lesson-save-file"
                            onClick={exportSavedLesson}
                        >
                            <Download className="h-5 w-5" aria-hidden="true" />
                            {t(
                                "create_lesson.save.save_file",
                                "Save as file",
                            )}
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
                            // #1253 — "My Lessons" lives on the Import tab now,
                            // so land the just-created lesson there.
                            onClick={() => navigate("/content?tab=import")}
                        >
                            {t(
                                "create_lesson.save.to_browser",
                                "To Content Browser",
                            )}
                        </Button>
                    </div>
                </section>
            )}

            {!savedEntry && !editLoading && !editError && (
            <nav className="create-lesson-nav mt-6 flex flex-wrap items-center justify-end gap-3" aria-label={t(
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
                {step < totalSteps && (
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
        </PageContainer>
    );
}
