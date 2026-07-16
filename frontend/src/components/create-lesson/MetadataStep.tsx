/**
 * Step 1 of the Lesson Creator wizard (Phase 65A): lesson metadata —
 * template picker, title, native title, language pair, level,
 * description and author. Extracted from CreateLesson for the
 * complexity burn-down (#400). Pure presentation; all state + edits
 * come via props.
 */

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
    t,
}: MetadataStepProps) {
    return (
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
                            onClick={() => onApplyTemplate(key)}
                        >
                            <span className="template-card-title">
                                {t(`create_lesson.templates.${key}.title`, TEMPLATE_FALLBACKS[key].title)}
                            </span>
                            <span className="template-card-desc muted">
                                {t(`create_lesson.templates.${key}.desc`, TEMPLATE_FALLBACKS[key].desc)}
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
                    onChange={(e) => onUpdate("title", e.target.value)}
                    autoFocus
                />
            </label>
            {showError && titleMissing && (
                <FormHint
                    variant="warning"
                    data-testid="create-lesson-title-error"
                    role="alert"
                >
                    {t(
                        "create_lesson.meta.title_required",
                        "A title is required.",
                    )}
                </FormHint>
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
                    onChange={(e) => onUpdate("titleNative", e.target.value)}
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
                <div className="form-field">
                    <span className="form-label">
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
                <div className="form-field">
                    <span className="form-label">
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
            {showError && sameLanguage && (
                <FormHint
                    variant="warning"
                    data-testid="create-lesson-same-language-error"
                    role="alert"
                >
                    {t(
                        "create_lesson.meta.same_language",
                        "The language learned must differ from your language.",
                    )}
                </FormHint>
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
                    onChange={(e) => onUpdate("description", e.target.value)}
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
                    onChange={(e) => onUpdate("author", e.target.value)}
                />
            </label>
        </section>
    );
}
