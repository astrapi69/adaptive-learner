/**
 * Report strings for the Markdown/PDF export renderers (#3426).
 *
 * The strings live in the catalogs under ``export.report.*`` (all UI
 * languages), the method and step labels reuse ``methods.<m>.label`` and
 * ``cycle_steps.<step>.label``. The renderer stays synchronous: the caller
 * hands it the app's ``t`` (already loaded for the UI language), and this
 * module only maps report keys onto catalog keys. The English values below
 * are the ``t`` fallbacks for a catalog that has not loaded yet.
 */

/** The app's translator: ``useI18n().t``. */
export type Translate = (key: string, fallback?: string) => string;

const REPORT_FALLBACKS = {
    progress_report_title: "Learning Progress",
    session_detail_title: "Session Detail",
    curriculum_overview_title: "Curriculum Overview",
    generated_at: "Generated at",
    app_version: "App version",
    learner: "Learner",
    language: "Language",
    method_profile: "Method profile",
    dominant_method: "Dominant method",
    assessed_at: "Last assessed",
    no_profile: "No assessment yet. Complete the entry assessment to see your profile.",
    projects: "Projects",
    no_projects: "No learning projects yet.",
    topic: "Topic",
    goal: "Goal",
    timeframe: "Timeframe",
    daily_minutes: "Daily minutes",
    current_problem: "Current obstacle",
    status: "Status",
    active: "active",
    archived: "archived",
    session_count: "Sessions",
    total_minutes: "Total minutes",
    mean_understanding: "Average understanding",
    mean_stress: "Average stress",
    method_distribution: "Method distribution",
    method_switches: "Method switches",
    no_switches: "No method switches in this project.",
    switched_from_to: "Switch",
    reason: "Reason",
    recent_sessions: "Recent sessions",
    no_sessions: "No sessions completed yet.",
    method: "Method",
    duration: "Duration",
    understanding: "Understanding",
    stress: "Stress",
    method_fit: "Method fit",
    notes: "Notes",
    step_evaluation_insights: "Step evaluations",
    no_step_insights: "No step evaluations available yet.",
    step: "Step",
    evaluations_count: "Evaluations",
    advance_rate: "Advance rate",
    mean_confidence: "Average confidence",
    deferred: "deferred",
    repeated: "repeated",
    advanced: "advanced",
    extractions: "Analyzed conversations",
    no_extractions: "No analyzed conversations yet.",
    imported_at: "Imported at",
    messages: "Messages",
    source: "Source",
    analysis: "Analysis",
    no_session: "Session not found.",
    session: "Session",
    started_at: "Started at",
    ended_at: "Ended at",
    cycle_step: "Current cycle step",
    transcript: "Transcript",
    no_messages: "No messages in this session.",
    role_user: "Learner",
    role_assistant: "AI",
    role_system: "System",
    rating: "Rating",
    no_rating: "Session was not rated.",
    step_evaluations: "Step evaluations",
    from_step: "From step",
    to_step: "To step",
    confidence: "Confidence",
    applied: "Applied",
    not_applied: "Not applied",
    fallback: "Fallback used",
    evaluated_at: "Evaluated at",
    curriculum: "Curriculum",
    description: "Description",
    topics: "Topics",
    no_topics: "No topics in this curriculum.",
    lessons: "Lessons",
    no_lessons: "No lessons in this curriculum.",
    out_of: "out of",
    minutes_short: "min",
    scale_5: "on a scale from 1 to 5",
    analysis_topic: "Detected topic",
    analysis_subtopics: "Subtopics",
    analysis_user_level: "Level",
    analysis_strengths: "Strengths",
    analysis_weaknesses: "Weaknesses",
    analysis_error_patterns: "Error patterns",
    analysis_recommended_method: "Recommended method",
    analysis_recommended_focus: "Recommended focus",
    analysis_suggested_curriculum: "Suggested curriculum",
    analysis_summary: "Summary",
    analysis_priority: "Priority",
    level_beginner: "Beginner",
    level_intermediate: "Intermediate",
    level_advanced: "Advanced",
    linked_project: "Linked project",
    status_completed: "completed",
    status_abandoned: "abandoned",
} as const;

/** A report string key (``export.report.<key>`` in the catalogs). */
export type ExportStringKey = keyof typeof REPORT_FALLBACKS;

const METHOD_FALLBACKS: Record<string, string> = {
    deductive: "Deductive",
    inductive: "Inductive",
    error_based: "Error-based",
    dialogic: "Dialogic",
    contextual: "Contextual",
    ai_adaptive: "AI-adaptive",
};

/** 1-based cycle step -> its ``cycle_steps.<key>`` catalog key and fallback. */
const STEPS: Record<number, [string, string]> = {
    1: ["input", "Input"],
    2: ["attempt", "Attempt"],
    3: ["error", "Error"],
    4: ["feedback", "Feedback"],
    5: ["adapt", "Adapt"],
    6: ["repeat", "Repeat"],
    7: ["integrate", "Integrate"],
};

/** Session status -> its report key. */
const STATUS_KEYS: Record<string, ExportStringKey> = {
    active: "active",
    completed: "status_completed",
    abandoned: "status_abandoned",
};

/** The translator a report is rendered with. */
export interface ReportText {
    translate: Translate;
}

/**
 * Bind the app's translator for one render.
 *
 * @example
 * const text = reportText(t);
 * t(text, "progress_report_title"); // "Lernfortschritt" in German
 */
export function reportText(translate: Translate): ReportText {
    return { translate };
}

/** A report string in the UI language. */
export function t(text: ReportText, key: ExportStringKey): string {
    return text.translate(`export.report.${key}`, REPORT_FALLBACKS[key]);
}

/** Localized display label for a learning ``method``; the raw key is returned when unknown. */
export function methodLabel(text: ReportText, method: string): string {
    const fallback = METHOD_FALLBACKS[method];
    return fallback ? text.translate(`methods.${method}.label`, fallback) : method;
}

/** Localized display label for a 1-7 session ``step``; the number is returned when unknown. */
export function stepLabel(text: ReportText, step: number): string {
    const entry = STEPS[step];
    return entry ? text.translate(`cycle_steps.${entry[0]}.label`, entry[1]) : String(step);
}

/** Localized display label for a project/session ``status``; the raw key is returned when unknown. */
export function statusLabel(text: ReportText, status: string): string {
    const key = STATUS_KEYS[status];
    return key ? t(text, key) : status;
}
