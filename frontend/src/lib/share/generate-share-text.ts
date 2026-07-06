/**
 * Share-text builder for learning achievements.
 *
 * Pure + PII-free: given an achievement kind and a few numeric/label
 * inputs, returns the text + URL to hand to the Web Share API or the
 * clipboard fallback. It deliberately exposes ONLY non-personal data
 * (level, streak length, badge name, learning-language label) — never
 * a user name, email, or any identifier.
 *
 * The strings come from the i18n catalog (``share.achievement.*``) so
 * every UI language shares in the learner's own language; the caller
 * passes its ``t`` function in (keeps this module free of the hook).
 *
 * @example
 * const {t} = useI18n();
 * const {text, url} = generateShareText({kind: "streak", days: 30}, t);
 * await shareOrCopy(text, url);
 */

/** The public deployment learners point their friends at. */
export const SHARE_URL = "https://astrapi69.github.io/adaptive-learner/";

/**
 * The stable production strand (Haupt). Alias of {@link SHARE_URL} kept as
 * a named export so the strand-aware share UI (#1172) reads symmetrically
 * alongside {@link LATEST_APP_URL}.
 */
export const HAUPT_APP_URL = SHARE_URL;

/**
 * The Latest/preview strand (#1172) — the staging deployment built from
 * develop/feature/fix branches. It is unstable (a test version that can
 * contain bugs), so the share UI pairs BOTH share paths — the plain link
 * and, since #1316, a QR code too — with an always-visible instability
 * warning; the QR is never a bare scan-and-go.
 */
export const LATEST_APP_URL =
    "https://astrapi69.github.io/adaptive-learner-content-test/";

/** Minimal ``t`` shape so this module stays free of the i18n hook type. */
type Translate = (key: string, fallback?: string) => string;

/** The achievement a learner can share. Each maps to one phrase. */
export type ShareKind =
    | "lesson_complete"
    | "streak"
    | "level"
    | "badge"
    | "progress";

export interface ShareTextInput {
    kind: ShareKind;
    /** Current learning level (gamification level number). */
    level?: number;
    /** Streak length in days. */
    days?: number;
    /** Human-readable badge name (already localized by the caller). */
    badge?: string;
    /** Optional learning-language label (e.g. "Spanish"); never the user. */
    language?: string;
}

export interface ShareTextResult {
    text: string;
    url: string;
}

/**
 * Interpolate ``{token}`` placeholders in a template with the supplied
 * values. Unknown tokens are left untouched so a translation that drops
 * a token never crashes — it just renders literally. Exported so the
 * lesson-result share builder reuses one interpolation contract.
 */
export function interpolate(
    template: string,
    values: Record<string, string>,
): string {
    return template.replace(/\{([a-z_][a-z0-9_]*)\}/g, (whole, key: string) =>
        key in values ? values[key] : whole,
    );
}

/** Default English phrasing — the fallback when a catalog lacks the key. */
const FALLBACK: Record<ShareKind, string> = {
    lesson_complete: "I just aced a lesson on Adaptive Learner!",
    streak: "I am on a {days}-day learning streak with Adaptive Learner!",
    level: "I just reached level {level} on Adaptive Learner!",
    badge: 'I earned the "{badge}" badge on Adaptive Learner!',
    progress:
        "I am learning with Adaptive Learner, level {level}, {days}-day streak.",
};

/**
 * Build the share text (phrase + hashtag) and URL for an achievement.
 * The returned ``text`` contains no personal data by construction.
 */
export function generateShareText(
    input: ShareTextInput,
    t: Translate,
): ShareTextResult {
    const values: Record<string, string> = {
        level: String(input.level ?? 0),
        days: String(input.days ?? 0),
        badge: input.badge ?? "",
        language: input.language ?? "",
    };
    const template = t(
        `share.achievement.${input.kind}`,
        FALLBACK[input.kind],
    );
    const phrase = interpolate(template, values).trim();
    const hashtag = t("share.achievement.hashtag", "#AdaptiveLearner").trim();
    const text = `${phrase} ${hashtag}`.trim();
    return {text, url: SHARE_URL};
}
