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

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";

import {useI18n} from "../../hooks/ui/useI18n";
import PageContainer from "../../shared/layout/PageContainer";
import {LANGUAGE_OPTIONS} from "../../lib/content/language/language-options";
import {readContributorName} from "../../lib/content/placement/contribution-history";
import MetadataStep from "../../components/create-lesson/MetadataStep";
import WizardSteps from "../../components/create-lesson/WizardSteps";
import EditLoadState from "../../components/create-lesson/EditLoadState";
import {MIN_CARDS} from "../../components/create-lesson/CardEditor";
import {
    hasIncompleteExercise,
    minExercisesToAdvance,
} from "../../components/create-lesson/ExerciseGenerator";
import {
    DEFAULT_EXERCISE_GEN_CONFIG,
    generateExercises,
    validateExtensionExercise,
    buildExtensionLesson,
    type ExerciseGenConfig,
} from "../../lib/exercises";
import {localizedExercisePrompts} from "../../lib/content/lesson/exercise/exercise-prompts";
import {migrateLegacyExercisePrompts} from "../../lib/content/lesson/exercise/legacy-prompt-migration";
import {buildExtensionUserSetInput} from "../../lib/content/lesson/user-set-input";
import ExtensionSteps from "../../components/create-lesson/ExtensionSteps";
import ExerciseEditSteps from "../../components/create-lesson/ExerciseEditSteps";
import {
    SavedLessonActions,
    WizardNav,
} from "../../components/create-lesson/CreateLessonFooter";
import CreateLessonDialogs from "../../components/create-lesson/CreateLessonDialogs";
import PromptMigrationNotice from "../../components/create-lesson/PromptMigrationNotice";
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
    draftCardsToGeneratorCards,
    draftSetId,
    lessonToDraftInput,
    preservedTheorySteps,
    type DraftValidationChecks,
} from "../../lib/content/lesson/draft-to-lesson";
import {
    buildBookLessons,
    buildBookLessonsUserSetInput,
    normalizeBook,
} from "../../lib/content/lesson/book-to-lesson";
import type {GeneratedBookLesson} from "../../lib/ai/generation/generate-book-lessons";
import {downloadLessonJson} from "../../lib/content/lesson/lesson-export";
import {nextCopySetId} from "../../lib/content/lesson/lesson-import";
import {BookSteps, type BookFields} from "../../components/create-lesson/book";
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
/** #1852 — the extension-authoring path: Metadata -> Extensions -> Review. */
const TOTAL_STEPS_EXT = 3;
const DRAFT_AUTOSAVE_MS = 10_000;

const EMPTY_BOOK_FIELDS: BookFields = {title: "", author: "", url: "", asin: ""};

/** Total wizard steps for the active path. Every compact branch — book-text
 *  (#1743), extension (#1852) and cardless-edit (#1967) — is a 3-step
 *  Metadata -> content -> Review flow; the card-driven path has 4. */
function stepCountFor(compactFlow: boolean): number {
    return compactFlow ? TOTAL_STEPS_BOOK : TOTAL_STEPS;
}

/** The wizard's page heading — "Edit lesson" when reopening an existing
 *  lesson, otherwise "Create a lesson". */
function headerTitle(
    editMode: boolean,
    t: (key: string, fallback?: string) => string,
): string {
    return editMode
        ? t("create_lesson.edit_title", "Edit lesson")
        : t("create_lesson.title", "Create a lesson");
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
    // #1967 — editing a cardless (theory/exercise) lesson, e.g. one authored
    // via the book-text path (#1743): the wizard skips the vocabulary-card step
    // and opens straight on the generated exercises. Set on edit-load once the
    // reconstructed draft is known to carry no cards.
    const [cardlessEdit, setCardlessEdit] = useState(false);
    const [editLoading, setEditLoading] = useState(editMode);
    const [editError, setEditError] = useState<string | null>(null);
    // #1860 — how many legacy English prompts were migrated to the UI
    // language on edit-load (0 = notice hidden). State only, persisted
    // only if the user saves.
    const [promptsMigrated, setPromptsMigrated] = useState(0);

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

    // #1756 — which card-based template was applied. Pure feedback state:
    // the templates fill cards/genConfig silently (visible only on step 2),
    // so the clicked card renders a pressed state.
    const [selectedTemplate, setSelectedTemplate] = useState<LessonTemplateKey | null>(null);

    // #1743 — book-text path state. ``bookMode`` switches the wizard to the
    // 3-step Metadata -> BookText -> Review flow; the AI produces the theory
    // steps + exercises from the pasted chunk.
    const [bookMode, setBookMode] = useState(false);
    // #1852 — the extension-authoring branch (mutually exclusive with
    // bookMode). Reuses the shared ``exercises`` state for its ext exercises.
    const [extMode, setExtMode] = useState(false);
    const [bookText, setBookText] = useState("");
    const [bookFields, setBookFields] = useState<BookFields>(EMPTY_BOOK_FIELDS);
    // #1949 — the generated book lessons: the single paste path yields a
    // one-element list (title "" -> follows meta.title), the multi-select
    // upload path yields one entry per selected section.
    const [bookLessons, setBookLessons] = useState<GeneratedBookLesson[]>([]);

    // An alternative authoring branch (book-text #1743 / extension #1852)
    // runs the compact 3-step flow instead of the card-driven one. The
    // cardless-edit branch (#1967 — Metadata -> Exercises -> Review) is a third
    // compact flow, entered only when editing a card-free lesson.
    const compactFlow = bookMode || extMode || cardlessEdit;
    const totalSteps = stepCountFor(compactFlow);

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
                // #1860 — opportunistically migrate legacy hardcoded-English
                // prompts (exact-match only) to the UI language. Edit-state
                // only; persisted only if the user saves.
                const {exercises: migratedExercises, migratedCount} =
                    migrateLegacyExercisePrompts(prefill.exercises, t);
                setMeta(prefill.meta);
                setCards(prefill.cards);
                setExercises(migratedExercises);
                // #1967 — a lesson with no vocabulary cards (a book-text /
                // theory lesson) edits its exercises directly; the card step
                // and its MIN_CARDS gate would otherwise trap the user.
                setCardlessEdit(prefill.cards.length === 0);
                setPromptsMigrated(migratedCount);
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
        // `t` drives the #1860 migration target language but is intentionally
        // NOT a dep: this is a load-once effect, and re-running on a language
        // change would reload from storage and clobber unsaved edits. The
        // migration uses whatever language is active at load time.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            bookText.trim().length > 0 ||
            bookLessons.length > 0,
        [meta.title, meta.titleNative, meta.description, bookText, bookLessons],
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
            // Book flow: step 2 requires at least one generated lesson
            // (single paste or batch) before advancing to Review.
            if (step === 2) {
                if (bookLessons.length === 0) {
                    setExerciseError(true);
                    return;
                }
                setExerciseError(false);
            }
            setStep((s) => Math.min(TOTAL_STEPS_BOOK, s + 1));
            return;
        }
        if (extMode) {
            // Extension flow: step 2 requires >= 1 extension exercise, all
            // complete (reusing the shipped payload validators).
            if (step === 2) {
                if (
                    exercises.length === 0 ||
                    exercises.some((ex) => !validateExtensionExercise(ex).valid)
                ) {
                    setExerciseError(true);
                    return;
                }
                setExerciseError(false);
            }
            setStep((s) => Math.min(TOTAL_STEPS_EXT, s + 1));
            return;
        }
        if (cardlessEdit) {
            // #1967 — cardless edit flow: step 2 is the exercise editor, then
            // Review. No card step in between. #1970 — cardlessEdit is edit-only,
            // so the count floor is 1, not the create-time minimum; a
            // half-filled exercise still blocks.
            if (step === 2) {
                if (
                    exercises.length < minExercisesToAdvance(true) ||
                    hasIncompleteExercise(exercises)
                ) {
                    setExerciseError(true);
                    return;
                }
                setExerciseError(false);
            }
            setStep((s) => Math.min(TOTAL_STEPS_BOOK, s + 1));
            return;
        }
        if (step === 2) {
            // #1970 — the card-count minimum is a create-time requirement;
            // editing an existing lesson never re-imposes it.
            if (!editMode && cards.length < MIN_CARDS) {
                setCardError(true);
                return;
            }
            setCardError(false);
        }
        if (step === 3) {
            // Too few (create-time only, #1970), OR any exercise still
            // incomplete — the completeness guard applies in both modes so a
            // half-filled manual exercise can't slip into step 4.
            if (
                exercises.length < minExercisesToAdvance(editMode) ||
                hasIncompleteExercise(exercises)
            ) {
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
        setSelectedTemplate(key);
    }

    /** #1743 — enter the book-text path from Step 1 and advance to the
     *  BookText step. #1946 — gated on a title, exactly like the main
     *  wizard's step-1 ``handleNext`` guard: without it the user could reach
     *  the save step title-less and hit the raw ajv error. */
    function startBookMode() {
        if (!metaValid) {
            setShowError(true);
            return;
        }
        setShowError(false);
        // #1967 — entering an alternative authoring mode exits the cardless
        // edit flow so the two never render side by side.
        setCardlessEdit(false);
        setBookMode(true);
        setStep(2);
    }

    /** #1852 — enter the extension-authoring path from Step 1. #1946 — same
     *  title guard as the book path (the extension flow shares the identical
     *  bypass of the step-1 title validation). */
    function startExtMode() {
        if (!metaValid) {
            setShowError(true);
            return;
        }
        setShowError(false);
        setCardlessEdit(false);
        setExtMode(true);
        setStep(2);
    }

    /** Single paste path: one lesson from the pasted chunk. Title "" so the
     *  lesson tracks ``meta.title`` at save time (regression-preserving). */
    function handleBookGenerated(
        steps: TheoryStep[],
        generated: ContentLessonExercise[],
    ) {
        setBookLessons([{title: "", theorySteps: steps, exercises: generated}]);
        setExerciseError(false);
    }

    /** #1949 — batch path: one lesson per selected section (titles carried). */
    function handleBookBatchGenerated(lessons: GeneratedBookLesson[]) {
        setBookLessons(lessons);
        setExerciseError(false);
    }

    function generateLessonExercises() {
        setExercises(
            generateExercises(draftCardsToGeneratorCards(cards), genConfig, {
                prompts: localizedExercisePrompts(t),
            }),
        );
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
        // #1946 — defense-in-depth: every save path (book / extension / core)
        // ends in ``validateGeneratedLesson``, which throws the raw ajv
        // ``/title must NOT have fewer than 1 characters`` on an empty title.
        // Surface the same friendly message the metadata step uses instead of
        // leaking that path-based schema error to the user.
        if (meta.title.trim().length === 0) {
            notify.error(
                t("create_lesson.meta.title_required", "A title is required."),
            );
            return null;
        }
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
                // #1949 — build one lesson per generated entry (single = 1,
                // batch = N) into a single set.
                const builtLessons = buildBookLessons(meta, bookLessons);
                lesson = builtLessons[0];
                input = buildBookLessonsUserSetInput(
                    meta,
                    builtLessons,
                    normalizeBook(bookFields),
                );
            } else if (extMode) {
                const extInput = {meta, exercises};
                lesson = buildExtensionLesson(extInput);
                input = buildExtensionUserSetInput(extInput, lesson);
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
        setExtMode(false);
        setCardlessEdit(false);
        setBookText("");
        setBookFields(EMPTY_BOOK_FIELDS);
        setBookLessons([]);
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
    function addCard(c: {
        front: string;
        back: string;
        notes: string;
        image: string;
        example: string;
        altAnswers: string[];
    }) {
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

    // --- exercise handlers (shared by every authoring flow) ---
    function deleteExercise(id: string) {
        setExercises((prev) => prev.filter((e) => e.id !== id));
    }
    function updateExercise(id: string, updated: ContentLessonExercise) {
        setExercises((prev) => prev.map((e) => (e.id === id ? updated : e)));
    }
    function addExercise(exercise: ContentLessonExercise) {
        setExercises((prev) => [...prev, exercise]);
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

    // #1740 — "Save as a copy" is only offered in edit mode; shared by the
    // card-driven and cardless-edit flows so the ternary lives in one place.
    const onSaveCopyHandler = editMode ? () => void saveCopy() : undefined;

    return (
        <PageContainer testId="create-lesson-page">
            <header className="create-lesson-header mb-6 flex flex-col gap-1">
                <h1>{headerTitle(editMode, t)}</h1>
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

            <PromptMigrationNotice
                count={promptsMigrated}
                onDismiss={() => setPromptsMigrated(0)}
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
                    selectedTemplate={selectedTemplate}
                    onStartBookMode={startBookMode}
                    onStartExtensions={startExtMode}
                    t={t}
                />
            )}

            {extMode && (
                <ExtensionSteps
                    step={step}
                    saved={Boolean(savedEntry)}
                    meta={meta}
                    exercises={exercises}
                    advanceBlocked={exerciseError}
                    saving={saving}
                    onAddExercise={addExercise}
                    onUpdateExercise={updateExercise}
                    onDeleteExercise={deleteExercise}
                    onSaveLocal={() => void saveLocally()}
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
                    onBatchGenerated={handleBookBatchGenerated}
                    bookLessons={bookLessons}
                    advanceBlocked={exerciseError}
                    saving={saving}
                    onSaveLocal={() => void saveLocally()}
                    onSaveShare={() => void saveAndShare()}
                    t={t}
                />
            )}

            {cardlessEdit && (
                <ExerciseEditSteps
                    step={step}
                    saved={Boolean(savedEntry)}
                    meta={meta}
                    cards={cards}
                    exercises={exercises}
                    genConfig={genConfig}
                    exerciseError={exerciseError}
                    draftChecks={draftChecks}
                    saving={saving}
                    onGenerate={generateLessonExercises}
                    onConfigChange={setGenConfig}
                    onReorderExercises={setExercises}
                    onDeleteExercise={deleteExercise}
                    onUpdateExercise={updateExercise}
                    onAddExercise={addExercise}
                    onSaveLocal={() => void saveLocally()}
                    onSaveShare={() => void saveAndShare()}
                    onSaveCopy={onSaveCopyHandler}
                    t={t}
                />
            )}

            {!compactFlow && (
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
                    onDeleteExercise={deleteExercise}
                    onUpdateExercise={updateExercise}
                    onAddExercise={addExercise}
                    onSaveLocal={() => void saveLocally()}
                    onSaveShare={() => void saveAndShare()}
                    onSaveCopy={onSaveCopyHandler}
                    t={t}
                />
            )}

            {savedEntry && (
                <SavedLessonActions
                    onPlay={playSaved}
                    onExport={exportSavedLesson}
                    onCreateAnother={createAnother}
                    onToBrowser={() => navigate("/content?tab=import")}
                    t={t}
                />
            )}

            {!savedEntry && !editLoading && !editError && (
                <WizardNav
                    step={step}
                    totalSteps={totalSteps}
                    onCancel={handleCancel}
                    onBack={handleBack}
                    onNext={handleNext}
                    t={t}
                />
            )}

            <CreateLessonDialogs
                confirmCancel={confirmCancel}
                pendingDraft={pendingDraft}
                onKeepEditing={() => setConfirmCancel(false)}
                onDiscard={discard}
                onStartFresh={startFresh}
                onContinueDraft={applyDraft}
                t={t}
            />
        </PageContainer>
    );
}
