/**
 * Step 1 of the Lesson Creator wizard (Phase 65A): lesson metadata —
 * template picker, title, native title, language pair, level,
 * description and author. Extracted from CreateLesson for the
 * complexity burn-down (#400). Pure presentation; all state + edits
 * come via props.
 */

import {Blocks, BookOpen, Info} from "lucide-react";

import {Input} from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {CEFR_LEVELS, LANGUAGE_OPTIONS} from "../../lib/content/language/language-options";
import {
    LESSON_TEMPLATE_KEYS,
    type LessonTemplateKey,
} from "../../lib/content/lesson/lesson-templates";
import type {LessonMeta} from "../../lib/content/lesson/lesson-draft";
import FormHint from "../../shared/forms/FormHint";

type Translate = (key: string, fallback?: string) => string;

// English first-paint fallbacks for the template cards, mirroring the
// catalog entries (create_lesson.templates.*): shown only while no catalog
// is loaded (fresh profile, offline), so the cards never render the bare
// template id or a raw dot-notation key (#1667).
const TEMPLATE_FALLBACKS: Record<LessonTemplateKey, {title: string; desc: string}> = {
    blank: {title: "Blank Lesson", desc: "Just metadata, add cards yourself."},
    vocabulary: {title: "Vocabulary List", desc: "10 card slots, matching + free text."},
    grammar: {title: "Grammar Lesson", desc: "5 card slots, mixed exercises with cloze."},
    conversation: {title: "Conversation Practice", desc: "5 card slots, word tiles + cloze."},
};

interface MetadataStepProps {
    meta: LessonMeta;
    showError: boolean;
    titleMissing: boolean;
    sameLanguage: boolean;
    onUpdate: (key: keyof LessonMeta, value: string) => void;
    onApplyTemplate: (key: LessonTemplateKey) => void;
    /** #1756 — the template the user applied, rendered as a pressed
     *  state on its card. Without it the card-based templates give no
     *  immediate feedback (their effect only shows on step 2), which
     *  reads as a dead click next to the instant book-mode card. */
    selectedTemplate: LessonTemplateKey | null;
    /** #1743 — enter the book-text path (paste a chapter, AI writes the
     *  theory + exercises). Separate from the card-based templates. */
    onStartBookMode: () => void;
    /** #1852 — enter the extension-authoring branch. */
    onStartExtensions: () => void;
    t: Translate;
}

/** The metadata-entry step (wizard step 1). */
export default function MetadataStep({
    meta,
    showError,
    titleMissing,
    sameLanguage,
    onUpdate,
    onApplyTemplate,
    onStartExtensions,
    selectedTemplate,
    onStartBookMode,
    t,
}: MetadataStepProps) {
    return (
        <section
            className="create-lesson-step flex flex-col gap-6"
            data-testid="create-lesson-step-1"
            aria-label={t("create_lesson.meta.heading", "Lesson details")}
        >
            <h2 className="text-xl font-semibold text-fg-primary">
                {t("create_lesson.meta.heading", "Lesson details")}
            </h2>

            <div
                className="create-lesson-templates flex flex-col gap-2"
                data-testid="create-lesson-templates"
            >
                <p className="form-label text-sm font-medium text-fg-primary">
                    {t(
                        "create_lesson.templates.heading",
                        "Start from a template",
                    )}
                </p>
                <div className="template-cards grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {LESSON_TEMPLATE_KEYS.map((key) => (
                        <button
                            type="button"
                            key={key}
                            className={`template-card flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                                selectedTemplate === key
                                    ? "border-accent bg-accent/10 ring-1 ring-accent"
                                    : "border-border bg-card"
                            }`}
                            data-testid={`template-${key}`}
                            aria-pressed={selectedTemplate === key}
                            onClick={() => onApplyTemplate(key)}
                        >
                            <span className="template-card-title font-semibold text-fg-primary">
                                {t(`create_lesson.templates.${key}.title`, TEMPLATE_FALLBACKS[key].title)}
                            </span>
                            <span className="template-card-desc muted text-sm text-fg-muted">
                                {t(`create_lesson.templates.${key}.desc`, TEMPLATE_FALLBACKS[key].desc)}
                            </span>
                        </button>
                    ))}
                </div>
                {/* #1743 — the book-text path is a distinct entry (AI writes
                    the theory + exercises from a pasted chapter), not a
                    card-based template, so it sits below the template grid. */}
                <button
                    type="button"
                    className="template-card mt-1 flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    data-testid="template-knowledge-from-text"
                    onClick={onStartBookMode}
                >
                    <BookOpen
                        className="mt-0.5 h-5 w-5 shrink-0 text-accent"
                        aria-hidden="true"
                    />
                    <span className="flex flex-col gap-1">
                        <span className="template-card-title font-semibold text-fg-primary">
                            {t(
                                "create_lesson.templates.knowledge_from_text.title",
                                "Knowledge lesson from text",
                            )}
                        </span>
                        <span className="template-card-desc muted text-sm text-fg-muted">
                            {t(
                                "create_lesson.templates.knowledge_from_text.desc",
                                "Paste a textbook section; the AI writes the theory in its own words and generates exercises.",
                            )}
                        </span>
                    </span>
                </button>
                {/* #1852 — the extension-authoring path (advanced exercise
                    types with a different data shape than the core types). */}
                <button
                    type="button"
                    className="template-card mt-1 flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    data-testid="template-extensions"
                    onClick={onStartExtensions}
                >
                    <Blocks
                        className="mt-0.5 h-5 w-5 shrink-0 text-accent"
                        aria-hidden="true"
                    />
                    <span className="flex flex-col gap-1">
                        <span className="template-card-title font-semibold text-fg-primary">
                            {t(
                                "create_lesson.templates.extensions.title",
                                "Advanced exercise types",
                            )}
                        </span>
                        <span className="template-card-desc muted text-sm text-fg-muted">
                            {t(
                                "create_lesson.templates.extensions.desc",
                                "Categorization and error-correction exercises. Advanced types that may not be supported by every app version.",
                            )}
                        </span>
                    </span>
                </button>
            </div>

            <label className="form-row flex flex-col gap-1.5">
                <span className="form-label text-sm font-medium text-fg-primary">
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
                    onChange={(e) => onUpdate("title", e.target.value)}
                    autoFocus
                />
                {showError && titleMissing && (
                    <span
                        className="m-0 text-sm font-medium text-[var(--error)]"
                        data-testid="create-lesson-title-error"
                        role="alert"
                    >
                        {t(
                            "create_lesson.meta.title_required",
                            "A title is required.",
                        )}
                    </span>
                )}
            </label>

            <label className="form-row flex flex-col gap-1.5">
                <span className="form-label text-sm font-medium text-fg-primary">
                    {t(
                        "create_lesson.meta.title_native_label",
                        "Title in target language",
                    )}
                </span>
                <Input
                    type="text"
                    data-testid="create-lesson-title-native"
                    value={meta.titleNative}
                    onChange={(e) => onUpdate("titleNative", e.target.value)}
                />
            </label>

            <div className="form-row form-row-inline flex flex-col gap-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="form-field flex flex-col gap-1.5">
                        <span className="form-label text-sm font-medium text-fg-primary">
                            {t(
                                "create_lesson.meta.target_lang_label",
                                "Language learned",
                            )}{" "}
                            *
                        </span>
                        <Select
                            value={meta.targetLanguage}
                            onValueChange={(v) => onUpdate("targetLanguage", v)}
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
                    <div className="form-field flex flex-col gap-1.5">
                        <span className="form-label text-sm font-medium text-fg-primary">
                            {t("create_lesson.meta.source_lang_label", "Your language")}
                        </span>
                        <Select
                            value={meta.sourceLanguage}
                            onValueChange={(v) => onUpdate("sourceLanguage", v)}
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
                    <div className="form-field flex flex-col gap-1.5">
                        <span className="form-label text-sm font-medium text-fg-primary">
                            {t("create_lesson.meta.level_label", "Level")}
                        </span>
                        <Select
                            value={meta.level}
                            onValueChange={(v) => onUpdate("level", v)}
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
                {/* #1715 — a same-language pair (source === target) is a
                    legitimate knowledge-domain lesson (e.g. ki-einsteiger:
                    de -> de). Surface a neutral, non-blocking hint, mirroring
                    SaveOfflineLessonModal — never a blocking error. */}
                {sameLanguage && (
                    <FormHint
                        className="flex items-start gap-1.5"
                        data-testid="create-lesson-same-language-hint"
                    >
                        <Info
                            className="mt-0.5 h-4 w-4 shrink-0"
                            aria-hidden="true"
                        />
                        <span>
                            {t(
                                "content.save_lesson.same_language_hint",
                                "Learned and your language are the same — fine for a grammar or knowledge lesson. When shared, it lands in the same-language branch of the content tree.",
                            )}
                        </span>
                    </FormHint>
                )}
            </div>

            <label className="form-row flex flex-col gap-1.5">
                <span className="form-label text-sm font-medium text-fg-primary">
                    {t(
                        "create_lesson.meta.description_label",
                        "Topic / description",
                    )}
                </span>
                <textarea
                    data-testid="create-lesson-description"
                    className="flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={meta.description}
                    rows={3}
                    onChange={(e) => onUpdate("description", e.target.value)}
                />
            </label>

            <label className="form-row flex flex-col gap-1.5">
                <span className="form-label text-sm font-medium text-fg-primary">
                    {t("create_lesson.meta.author_label", "Author name")}
                </span>
                <Input
                    type="text"
                    data-testid="create-lesson-author"
                    value={meta.author}
                    onChange={(e) => onUpdate("author", e.target.value)}
                />
            </label>
        </section>
    );
}
