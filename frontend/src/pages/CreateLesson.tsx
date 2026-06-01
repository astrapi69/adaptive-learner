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

import {useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";

import {useI18n} from "../hooks/useI18n";
import {
    CEFR_LEVELS,
    LANGUAGE_OPTIONS,
} from "../lib/content/language-options";
import {readContributorName} from "../lib/content/contribution-history";

export interface LessonMeta {
    title: string;
    titleNative: string;
    sourceLanguage: string;
    targetLanguage: string;
    level: string;
    description: string;
    author: string;
}

const TOTAL_STEPS = 4;

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
    const [showError, setShowError] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);

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
        setStep((s) => Math.min(TOTAL_STEPS, s + 1));
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

                    <label className="form-row">
                        <span className="form-label">
                            {t("create_lesson.meta.title_label", "Title")} *
                        </span>
                        <input
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
                        <input
                            type="text"
                            data-testid="create-lesson-title-native"
                            value={meta.titleNative}
                            onChange={(e) =>
                                update("titleNative", e.target.value)
                            }
                        />
                    </label>

                    <div className="form-row form-row-inline">
                        <label className="form-field">
                            <span className="form-label">
                                {t(
                                    "create_lesson.meta.target_lang_label",
                                    "Language learned",
                                )}{" "}
                                *
                            </span>
                            <select
                                data-testid="create-lesson-target-lang"
                                value={meta.targetLanguage}
                                onChange={(e) =>
                                    update("targetLanguage", e.target.value)
                                }
                            >
                                {LANGUAGE_OPTIONS.map((o) => (
                                    <option key={o.code} value={o.code}>
                                        {o.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="form-field">
                            <span className="form-label">
                                {t(
                                    "create_lesson.meta.source_lang_label",
                                    "Your language",
                                )}
                            </span>
                            <select
                                data-testid="create-lesson-source-lang"
                                value={meta.sourceLanguage}
                                onChange={(e) =>
                                    update("sourceLanguage", e.target.value)
                                }
                            >
                                {LANGUAGE_OPTIONS.map((o) => (
                                    <option key={o.code} value={o.code}>
                                        {o.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="form-field">
                            <span className="form-label">
                                {t("create_lesson.meta.level_label", "Level")}
                            </span>
                            <select
                                data-testid="create-lesson-level"
                                value={meta.level}
                                onChange={(e) =>
                                    update("level", e.target.value)
                                }
                            >
                                {CEFR_LEVELS.map((lvl) => (
                                    <option key={lvl} value={lvl}>
                                        {lvl}
                                    </option>
                                ))}
                            </select>
                        </label>
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
                        <input
                            type="text"
                            data-testid="create-lesson-author"
                            value={meta.author}
                            onChange={(e) => update("author", e.target.value)}
                        />
                    </label>
                </section>
            )}

            {step > 1 && (
                <section
                    className="create-lesson-step"
                    data-testid={`create-lesson-step-${step}`}
                >
                    <h2>
                        {t("create_lesson.step_of", "Step {current} of {total}")
                            .replace("{current}", String(step))
                            .replace("{total}", String(TOTAL_STEPS))}
                    </h2>
                    <p className="muted" data-testid="create-lesson-step-pending">
                        {t(
                            "create_lesson.step_pending",
                            "This step is coming in the next update.",
                        )}
                    </p>
                </section>
            )}

            <nav className="create-lesson-nav" aria-label={t(
                "create_lesson.nav_label",
                "Wizard navigation",
            )}>
                <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid="create-lesson-cancel"
                    onClick={handleCancel}
                >
                    {t("create_lesson.cancel", "Cancel")}
                </button>
                {step > 1 && (
                    <button
                        type="button"
                        className="btn"
                        data-testid="create-lesson-back"
                        onClick={handleBack}
                    >
                        {t("create_lesson.back", "Back")}
                    </button>
                )}
                {step < TOTAL_STEPS && (
                    <button
                        type="button"
                        className="btn btn-primary"
                        data-testid="create-lesson-next"
                        onClick={handleNext}
                    >
                        {t("create_lesson.next", "Next")}
                    </button>
                )}
            </nav>

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
                            <button
                                type="button"
                                className="btn btn-secondary"
                                data-testid="create-lesson-cancel-keep"
                                onClick={() => setConfirmCancel(false)}
                            >
                                {t(
                                    "create_lesson.cancel_keep",
                                    "Keep editing",
                                )}
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                data-testid="create-lesson-cancel-discard"
                                onClick={() => navigate("/content")}
                            >
                                {t("create_lesson.cancel_discard", "Discard")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
