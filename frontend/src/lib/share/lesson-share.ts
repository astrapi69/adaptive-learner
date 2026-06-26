/**
 * Lesson-result share-text builder (#1073).
 *
 * After a completed lesson the learner can share the *actual* result —
 * lesson title + score % + correct/total (+ optional level/XP) — not just a
 * generic "I aced a lesson" line. This module is the pure, PII-free core: it
 * maps a {@link LessonShareResult} to a motivation tier (which drives the CTA
 * copy) and to the share text. It exposes ONLY non-personal data (lesson
 * title, score, level, streak length) — never a user name or identifier.
 *
 * The strings come from the i18n catalog (``share.result.*`` /
 * ``share.achievement.hashtag``) so every learner shares in their own UI
 * language; the caller passes its ``t`` in (keeps this module hook-free).
 *
 * @example
 * const {t} = useI18n();
 * const {text, url} = buildLessonShareText(result, t);
 * await shareOrCopy(text, url);
 */

import {SHARE_URL, interpolate} from "./generate-share-text";

/** Minimal ``t`` shape so this module stays free of the i18n hook type. */
type Translate = (key: string, fallback?: string) => string;

/**
 * The shareable, PII-free outcome of a completed lesson. Every field is
 * either content metadata (the lesson title) or an aggregate score — never a
 * user identifier.
 */
export interface LessonShareResult {
    /** Lesson title (content metadata, not personal). */
    lessonTitle: string;
    /** Correct answers this run. */
    correct: number;
    /** Total scored items this run. */
    total: number;
    /** Score percentage 0-100 (derived; passed in so the card matches the UI). */
    scorePct: number;
    /** Stars earned 0-3. */
    stars: number;
    /** Current gamification level (optional — omitted on an anonymous run). */
    level?: number;
    /** Total XP (optional). */
    xp?: number;
    /** Current learning-streak length in days (optional). */
    streakDays?: number;
    /** This run set a new personal best for the lesson (optional). */
    isNewRecord?: boolean;
    /** This run pushed the learner to a new level (optional). */
    leveledUp?: boolean;
}

/**
 * The motivation tier of a result, driving how loud the share CTA is. A low
 * score is never punished — it still gets a quiet, neutral "Share result"
 * (the button is shown for every completed lesson, per the feature-state
 * "never hidden" policy), just never a celebratory "Show everyone!".
 */
export type MotivationTier = "record" | "great" | "neutral" | "low";

/** The score at/above which a run counts as "great" (strong CTA). */
export const GREAT_SCORE_PCT = 80;
/** The score below which the CTA stays deliberately quiet. */
export const LOW_SCORE_PCT = 50;
/** A streak of this many days unlocks the celebratory tier. */
export const STREAK_MILESTONE_DAYS = 7;

/**
 * Classify a result into a {@link MotivationTier}. A new record, a level-up,
 * or a milestone streak earns the loudest tier; then ≥80% is "great"; <50% is
 * "low" (quiet); everything else is "neutral".
 *
 * @param result - The completed-lesson result.
 */
export function motivationTier(result: LessonShareResult): MotivationTier {
    if (
        result.isNewRecord ||
        result.leveledUp ||
        (result.streakDays ?? 0) >= STREAK_MILESTONE_DAYS
    ) {
        return "record";
    }
    if (result.scorePct >= GREAT_SCORE_PCT) return "great";
    if (result.scorePct < LOW_SCORE_PCT) return "low";
    return "neutral";
}

/** The i18n key + English fallback for a tier's share-button label. */
const CTA_BY_TIER: Record<MotivationTier, {key: string; fallback: string}> = {
    record: {key: "share.result.cta_record", fallback: "Show your friends!"},
    great: {key: "share.result.cta_great", fallback: "Share your great result!"},
    neutral: {key: "share.result.cta_neutral", fallback: "Share result"},
    low: {key: "share.result.cta_low", fallback: "Share result"},
};

/**
 * The localized share-button label for a result, varied by motivation tier.
 *
 * @param result - The completed-lesson result.
 * @param t - The i18n lookup.
 */
export function shareCtaLabel(
    result: LessonShareResult,
    t: Translate,
): string {
    const {key, fallback} = CTA_BY_TIER[motivationTier(result)];
    return t(key, fallback);
}

/** English fallback for the shared phrase. */
const TEXT_FALLBACK =
    'I completed "{title}" with {pct}%! 🎓 {correct} of {total} correct.';

export interface LessonShareTextResult {
    text: string;
    url: string;
}

/**
 * Build the share text (phrase + hashtag) and URL for a lesson result. The
 * returned ``text`` contains no personal data by construction — only the
 * lesson title and the aggregate score.
 *
 * @param result - The completed-lesson result.
 * @param t - The i18n lookup (shares in the learner's UI language).
 */
export function buildLessonShareText(
    result: LessonShareResult,
    t: Translate,
): LessonShareTextResult {
    const phrase = interpolate(t("share.result.text", TEXT_FALLBACK), {
        title: result.lessonTitle,
        pct: String(result.scorePct),
        correct: String(result.correct),
        total: String(result.total),
    }).trim();
    const hashtag = t("share.achievement.hashtag", "#AdaptiveLearner").trim();
    const text = `${phrase} ${hashtag}`.trim();
    return {text, url: SHARE_URL};
}
