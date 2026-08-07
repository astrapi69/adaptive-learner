/**
 * #1743 — Book-text step of the Lesson Creator (knowledge-from-text path).
 *
 * The user pastes ONE textbook chunk plus optional book metadata; a single
 * click reformulates the prose into theory steps (AI, in the model's own
 * words — never a copy) and generates exercises from them. It composes the
 * existing EXP-036 engine ({@link generateExercises} + {@link cardsToExercises})
 * with the #1743 theory rephraser ({@link generateTheoryFromText}).
 *
 * Mirrors {@link GenerateExercisesButton}: it owns its spinner, the no-key
 * notice, and the success/error toasts; the AI engines are injected
 * (``generateTheory`` / ``generate``) so the unit test runs without a real
 * network call. Book metadata edits are lifted via ``onBookChange`` so the
 * wizard can write them to ``sets[].book`` on save.
 */

import {useState} from "react";
import {BookOpen, Sparkles} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import ApiKeyRequiredNotice from "../../settings/ai/ApiKeyRequiredNotice";
import FormHint from "../../../shared/forms/FormHint";
import BookFileUpload from "./BookFileUpload";
import AssistantTypeSelector from "./AssistantTypeSelector";
import {
    loadAssistantTypes,
    saveAssistantTypes,
} from "../../../lib/exercises";
import {exerciseTypeLabelKey} from "../../../lib/content/lesson/edit-error-keys";
import {
    browserDirectProvider,
    generateExercises as defaultGenerate,
} from "../../../lib/ai/generation/generate-exercises";
import {generateTheoryFromText as defaultGenerateTheory} from "../../../lib/ai/generation/generate-theory-from-text";
import {cardsToExercises} from "../../../lib/ai/generation/cards-to-exercises";
import {generateBookLessonsBatch} from "../../../lib/ai/generation/generate-book-lessons";
import type {
    BatchFailure,
    BatchProgress,
    BatchSectionInput,
    GeneratedBookLesson,
} from "../../../lib/ai/generation/generate-book-lessons";
import {MAX_SECTION_CHARS} from "../../../lib/content/book-upload";
import type {TheoryStep} from "../../../lib/ai/generation/exercise-generation-prompt";
import type {ResolvedAiProvider} from "../../../lib/ai/providers/resolve-provider";
import type {ContentLessonExercise} from "../../../storage/types";
import {notify} from "../../../utils/notify";

type Translate = (key: string, fallback?: string) => string;

/** The raw book-metadata fields the user edits in this step. */
export interface BookFields {
    title: string;
    author: string;
    url: string;
    asin: string;
}

interface BookTextStepProps {
    /** The pasted textbook chunk. */
    bookText: string;
    onBookTextChange: (value: string) => void;
    /** Book-metadata fields (optional; a blank title means "no book"). */
    book: BookFields;
    onBookChange: (patch: Partial<BookFields>) => void;
    /** Target language for the generated theory + exercises. */
    language?: string;
    /**
     * Resolve the active provider's config, or ``null`` when no key is set
     * (the "no key" signal — the Dexie caller reads it browser-direct).
     */
    resolveProvider: () => Promise<ResolvedAiProvider | null>;
    /** Receives the generated theory steps + exercises (single path). */
    onGenerated: (
        theorySteps: TheoryStep[],
        exercises: ContentLessonExercise[],
    ) => void;
    /** #1949 — receives the batch-generated lessons (multi-select path). */
    onBatchGenerated: (lessons: GeneratedBookLesson[]) => void;
    /** True once a generation succeeded (drives the summary label). */
    generatedSummary?: {theory: number; exercises: number} | null;
    t: Translate;
    /** Test seams; default to the real engines. */
    generateTheory?: typeof defaultGenerateTheory;
    generate?: typeof defaultGenerate;
}

/** Book-text paste + book metadata + one-click AI generation. */
export default function BookTextStep({
    bookText,
    onBookTextChange,
    book,
    onBookChange,
    language,
    resolveProvider,
    onGenerated,
    onBatchGenerated,
    generatedSummary,
    t,
    generateTheory = defaultGenerateTheory,
    generate = defaultGenerate,
}: BookTextStepProps) {
    const [busy, setBusy] = useState(false);
    const [needsKey, setNeedsKey] = useState(false);
    // #1949 — batch generation state (multi-select upload path).
    const [batchBusy, setBatchBusy] = useState(false);
    const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(
        null,
    );
    const [batchSummary, setBatchSummary] = useState<{
        succeeded: number;
        total: number;
        failures: BatchFailure[];
    } | null>(null);
    // #2510 — the user's exercise-type selection (remembered across runs) and
    // the feedback list of selected types that produced nothing (Part 4).
    const [selectedTypes, setSelectedTypes] = useState<string[]>(() =>
        loadAssistantTypes(),
    );
    const [missingTypes, setMissingTypes] = useState<string[]>([]);

    function changeTypes(types: string[]) {
        setSelectedTypes(types);
        saveAssistantTypes(types);
    }

    /** #1949 — batch: generate one lesson per selected section. Reuses the
     *  same chunk->lesson pipeline as the single path via
     *  {@link generateBookLessonsBatch}; a per-section failure never aborts
     *  the run. */
    async function runBatch(sections: BatchSectionInput[]) {
        if (batchBusy || busy) return;
        setBatchBusy(true);
        setNeedsKey(false);
        setBatchSummary(null);
        setBatchProgress(null);
        try {
            const config = await resolveProvider();
            if (!config) {
                setNeedsKey(true);
                return;
            }
            const provider = browserDirectProvider(config);
            const result = await generateBookLessonsBatch(
                sections,
                provider,
                {
                    language,
                    clozePrompt: t(
                        "content.lesson_gen.cloze_prompt",
                        "Fill in the missing word.",
                    ),
                    maxSectionChars: MAX_SECTION_CHARS,
                    types: selectedTypes,
                },
                {
                    generateTheory,
                    generate,
                    onProgress: setBatchProgress,
                },
            );
            setBatchSummary({
                succeeded: result.lessons.length,
                total: sections.length,
                failures: result.failures,
            });
            if (result.lessons.length === 0) {
                notify.error(
                    t(
                        "create_lesson.book.batch_all_failed",
                        "No lessons could be generated from the selected sections.",
                    ),
                );
                return;
            }
            notify.success(
                t(
                    "create_lesson.book.batch_summary",
                    "{ok} of {n} lesson(s) generated.",
                )
                    .replace("{ok}", String(result.lessons.length))
                    .replace("{n}", String(sections.length)),
            );
            onBatchGenerated(result.lessons);
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            notify.error(
                `${t(
                    "create_lesson.book.generate_failed",
                    "Could not generate the lesson. Please try again.",
                )} ${detail}`,
            );
        } finally {
            setBatchBusy(false);
            setBatchProgress(null);
        }
    }

    async function runGeneration() {
        if (busy || batchBusy) return;
        if (bookText.trim() === "") {
            notify.error(
                t(
                    "create_lesson.book.paste_required",
                    "Paste a section of your textbook first.",
                ),
            );
            return;
        }
        setBusy(true);
        setNeedsKey(false);
        setMissingTypes([]);
        try {
            const config = await resolveProvider();
            if (!config) {
                setNeedsKey(true);
                return;
            }
            const provider = browserDirectProvider(config);
            const theory = await generateTheory(bookText, provider, {language});
            if (theory.steps.length === 0) {
                notify.error(
                    t(
                        "create_lesson.book.theory_failed",
                        "The AI returned no usable theory. Please try again.",
                    ),
                );
                return;
            }
            const result = await generate(theory.steps, provider, {
                language,
                // #2510 — restrict generation to the user's selected types.
                types: selectedTypes,
            });
            const {exercises} = cardsToExercises(result.cards, {
                clozePrompt: t(
                    "content.lesson_gen.cloze_prompt",
                    "Fill in the missing word.",
                ),
            });
            // #2510 (Part 4) — a selected type the text did not yield is named,
            // never silently dropped: "less delivered" must be distinguishable
            // from "all delivered".
            const produced = new Set(exercises.map((ex) => ex.type));
            setMissingTypes(selectedTypes.filter((type) => !produced.has(type)));
            if (exercises.length === 0) {
                notify.error(
                    t(
                        "create_lesson.book.exercises_failed",
                        "No usable exercises were generated. Please try again.",
                    ),
                );
                return;
            }
            notify.success(
                t(
                    "create_lesson.book.generated",
                    "{t} theory step(s) and {e} exercise(s) generated.",
                )
                    .replace("{t}", String(theory.steps.length))
                    .replace("{e}", String(exercises.length)),
            );
            onGenerated(theory.steps, exercises);
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            notify.error(
                `${t(
                    "create_lesson.book.generate_failed",
                    "Could not generate the lesson. Please try again.",
                )} ${detail}`,
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <section
            className="create-lesson-step flex flex-col gap-6"
            data-testid="create-lesson-book-step"
            aria-label={t(
                "create_lesson.book.heading",
                "Create a lesson from text",
            )}
        >
            <div className="flex flex-col gap-1">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-fg-primary">
                    <BookOpen className="h-5 w-5" aria-hidden="true" />
                    {t("create_lesson.book.heading", "Create a lesson from text")}
                </h2>
                <p className="text-sm text-fg-muted">
                    {t(
                        "create_lesson.book.intro",
                        "Paste one section (e.g. a chapter) of your textbook. The AI rewrites it in its own words as theory and generates exercises. Add another section by running the wizard again.",
                    )}
                </p>
            </div>

            <BookFileUpload
                currentText={bookText}
                onApply={onBookTextChange}
                onGenerateSections={(sections) => void runBatch(sections)}
                generating={batchBusy}
                t={t}
            />

            {batchBusy && batchProgress && (
                <div
                    className="flex items-center gap-2 text-sm text-fg-primary"
                    data-testid="book-batch-progress"
                    role="status"
                    aria-live="polite"
                >
                    <span className="btn-spinner" aria-hidden="true" />
                    {t(
                        "create_lesson.book.batch_progress",
                        "Generating lesson {current} of {total}: {title}…",
                    )
                        .replace("{current}", String(batchProgress.current))
                        .replace("{total}", String(batchProgress.total))
                        .replace("{title}", batchProgress.title)}
                </div>
            )}

            {batchSummary && !batchBusy && (
                <div
                    className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm"
                    data-testid="book-batch-summary"
                >
                    <p className="text-fg-primary">
                        {t(
                            "create_lesson.book.batch_summary",
                            "{ok} of {n} lesson(s) generated.",
                        )
                            .replace("{ok}", String(batchSummary.succeeded))
                            .replace("{n}", String(batchSummary.total))}
                    </p>
                    {batchSummary.failures.length > 0 && (
                        <ul className="flex flex-col gap-0.5 text-xs text-fg-muted">
                            {batchSummary.failures.map((failure) => (
                                <li
                                    key={failure.title}
                                    data-testid="book-batch-failure"
                                >
                                    {t(
                                        "create_lesson.book.batch_failed_item",
                                        "Failed: {title}",
                                    ).replace("{title}", failure.title)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <label className="form-row flex flex-col gap-1.5">
                <span className="form-label text-sm font-medium text-fg-primary">
                    {t("create_lesson.book.text_label", "Textbook section")}
                </span>
                <textarea
                    data-testid="book-text-input"
                    className="flex min-h-[12rem] w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={bookText}
                    rows={10}
                    placeholder={t(
                        "create_lesson.book.text_placeholder",
                        "Paste the chapter text here…",
                    )}
                    onChange={(e) => onBookTextChange(e.target.value)}
                />
            </label>

            <p
                className="-mt-3 text-xs text-fg-muted"
                data-testid="book-rights-hint"
            >
                {t(
                    "create_lesson.book.rights_hint",
                    "Only paste or upload text you have the rights to, or that is intended for personal use.",
                )}
            </p>

            <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
                <legend className="px-1 text-sm font-medium text-fg-primary">
                    {t(
                        "create_lesson.book.meta_legend",
                        "Book reference (optional)",
                    )}
                </legend>
                <label className="form-row flex flex-col gap-1.5">
                    <span className="form-label text-sm font-medium text-fg-primary">
                        {t("create_lesson.book.title_label", "Book title")}
                    </span>
                    <Input
                        type="text"
                        data-testid="book-title"
                        value={book.title}
                        onChange={(e) => onBookChange({title: e.target.value})}
                    />
                </label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <label className="form-field flex flex-col gap-1.5">
                        <span className="form-label text-sm font-medium text-fg-primary">
                            {t("create_lesson.book.author_label", "Author")}
                        </span>
                        <Input
                            type="text"
                            data-testid="book-author"
                            value={book.author}
                            onChange={(e) =>
                                onBookChange({author: e.target.value})
                            }
                        />
                    </label>
                    <label className="form-field flex flex-col gap-1.5">
                        <span className="form-label text-sm font-medium text-fg-primary">
                            {t("create_lesson.book.url_label", "URL")}
                        </span>
                        <Input
                            type="url"
                            data-testid="book-url"
                            value={book.url}
                            onChange={(e) => onBookChange({url: e.target.value})}
                        />
                    </label>
                    <label className="form-field flex flex-col gap-1.5">
                        <span className="form-label text-sm font-medium text-fg-primary">
                            {t("create_lesson.book.asin_label", "ISBN / ASIN")}
                        </span>
                        <Input
                            type="text"
                            data-testid="book-asin"
                            value={book.asin}
                            onChange={(e) => onBookChange({asin: e.target.value})}
                        />
                    </label>
                </div>
            </fieldset>

            <AssistantTypeSelector
                selected={selectedTypes}
                onChange={changeTypes}
                t={t}
            />

            {missingTypes.length > 0 && (
                <div
                    className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3"
                    data-testid="book-gen-missing"
                    role="status"
                >
                    <FormHint as="p" variant="warning">
                        {t(
                            "create_lesson.book.gen_missing_intro",
                            "These selected types did not come out of the text:",
                        )}
                    </FormHint>
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                        {missingTypes.map((type) => (
                            <li
                                key={type}
                                className="text-sm text-fg-secondary"
                                data-testid={`book-gen-missing-${type.replace("ext:al-", "")}`}
                            >
                                {t(exerciseTypeLabelKey(type), type)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="button"
                    onClick={() => void runGeneration()}
                    disabled={busy || batchBusy}
                    data-testid="book-generate"
                >
                    {busy ? (
                        <span
                            className="btn-spinner"
                            data-testid="book-generate-spinner"
                            aria-hidden="true"
                        />
                    ) : (
                        <Sparkles size={16} aria-hidden="true" className="mr-1" />
                    )}
                    {busy
                        ? t("create_lesson.book.generating", "Generating…")
                        : t(
                              "create_lesson.book.generate",
                              "Generate theory + exercises",
                          )}
                </Button>
                {generatedSummary && (
                    <p
                        className="text-sm text-fg-muted"
                        data-testid="book-generated-summary"
                    >
                        {t(
                            "create_lesson.book.summary",
                            "{t} theory step(s), {e} exercise(s) ready.",
                        )
                            .replace("{t}", String(generatedSummary.theory))
                            .replace("{e}", String(generatedSummary.exercises))}
                    </p>
                )}
            </div>

            {needsKey && (
                <div className="w-full" data-testid="book-no-key">
                    <ApiKeyRequiredNotice
                        compact
                        feature={t(
                            "create_lesson.book.feature",
                            "to generate a lesson from text",
                        )}
                    />
                </div>
            )}
        </section>
    );
}
