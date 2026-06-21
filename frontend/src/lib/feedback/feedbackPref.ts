/**
 * Feedback preferences (EXP-008 / Phase 55).
 *
 * Persists the celebration/feedback preferences in localStorage.
 * These are presentation-only flags - they never change the XP /
 * badge / streak algorithms, only how loudly success is
 * celebrated.
 *
 * Three intensity levels (Phase 55E):
 *   - "subtle":       only correct/wrong colour flash; no
 *                     phrases, no confetti, no milestone overlays.
 *   - "normal" (def): animations + phrases + confetti on 3-star +
 *                     milestone overlays. Praise on correct is
 *                     frequency-controlled (not every answer).
 *   - "enthusiastic": everything + praise on EVERY correct answer.
 *
 * Sound (Phase 55F) is OFF by default; volume 0..100 (default 50).
 *
 * ``prefers-reduced-motion`` overrides the effective intensity to
 * "subtle" (handled by ``useFeedbackIntensity`` / the effective
 * helpers) so motion-sensitive users never get animations even
 * when their stored level is higher.
 */

export type FeedbackIntensity = "subtle" | "normal" | "enthusiastic";

const KEY_INTENSITY = "adaptive-learner.feedback.intensity";
const KEY_SOUND_ENABLED = "adaptive-learner.feedback.sound_enabled";
const KEY_SOUND_VOLUME = "adaptive-learner.feedback.sound_volume";

const VALID_INTENSITIES: readonly FeedbackIntensity[] = [
    "subtle",
    "normal",
    "enthusiastic",
];

export const DEFAULT_INTENSITY: FeedbackIntensity = "normal";
export const DEFAULT_SOUND_ENABLED = false;
export const DEFAULT_SOUND_VOLUME = 50;

/** Read the stored feedback intensity, falling back to
 *  {@link DEFAULT_INTENSITY} when unset or invalid. */
export function readFeedbackIntensity(): FeedbackIntensity {
    try {
        const raw = localStorage.getItem(KEY_INTENSITY);
        if (raw && (VALID_INTENSITIES as string[]).includes(raw)) {
            return raw as FeedbackIntensity;
        }
    } catch {
        /* no-op */
    }
    return DEFAULT_INTENSITY;
}

/** Event dispatched on the window whenever any feedback pref
 *  changes within the same tab, so hooks re-read live (the
 *  native ``storage`` event only fires in OTHER tabs). */
export const FEEDBACK_PREF_CHANGE_EVENT = "adaptive-learner:feedback-pref";

function notifyChange(): void {
    try {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event(FEEDBACK_PREF_CHANGE_EVENT));
        }
    } catch {
        /* no-op */
    }
}

/** Persist the feedback intensity and notify same-tab listeners. */
export function setFeedbackIntensity(intensity: FeedbackIntensity): void {
    try {
        localStorage.setItem(KEY_INTENSITY, intensity);
    } catch {
        /* no-op */
    }
    notifyChange();
}

/** Read whether celebration sounds are enabled, falling back to
 *  {@link DEFAULT_SOUND_ENABLED} when unset or invalid. */
export function readSoundEnabled(): boolean {
    try {
        const raw = localStorage.getItem(KEY_SOUND_ENABLED);
        if (raw === "true") return true;
        if (raw === "false") return false;
    } catch {
        /* no-op */
    }
    return DEFAULT_SOUND_ENABLED;
}

/** Persist the sound-enabled flag and notify same-tab listeners. */
export function setSoundEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(KEY_SOUND_ENABLED, enabled ? "true" : "false");
    } catch {
        /* no-op */
    }
    notifyChange();
}

/** Read the stored sound volume clamped to 0..100, falling back to
 *  {@link DEFAULT_SOUND_VOLUME} when unset or invalid. */
export function readSoundVolume(): number {
    try {
        const raw = localStorage.getItem(KEY_SOUND_VOLUME);
        if (raw !== null) {
            const parsed = Number.parseInt(raw, 10);
            if (Number.isFinite(parsed)) {
                return Math.max(0, Math.min(100, parsed));
            }
        }
    } catch {
        /* no-op */
    }
    return DEFAULT_SOUND_VOLUME;
}

/** Persist the sound volume (rounded + clamped to 0..100) and
 *  notify same-tab listeners. */
export function setSoundVolume(volume: number): void {
    try {
        const clamped = Math.max(0, Math.min(100, Math.round(volume)));
        localStorage.setItem(KEY_SOUND_VOLUME, String(clamped));
    } catch {
        /* no-op */
    }
    notifyChange();
}

/**
 * True when the user (or OS) has requested reduced motion. SSR /
 * test-safe: returns ``false`` when ``matchMedia`` is absent.
 */
export function prefersReducedMotion(): boolean {
    try {
        return (
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        );
    } catch {
        return false;
    }
}

/**
 * The intensity actually in effect: the stored level, clamped to
 * "subtle" whenever reduced motion is requested.
 */
export function effectiveIntensity(): FeedbackIntensity {
    if (prefersReducedMotion()) return "subtle";
    return readFeedbackIntensity();
}

/** Whether confetti / star pop should fire at the given level. */
export function allowsConfetti(intensity: FeedbackIntensity): boolean {
    return intensity !== "subtle";
}

/** Whether milestone overlays should fire at the given level. */
export function allowsMilestones(intensity: FeedbackIntensity): boolean {
    return intensity !== "subtle";
}

/**
 * Whether a praise phrase should be shown for the ``correctIndex``-th
 * correct answer this session (0-based). "subtle" never praises;
 * "enthusiastic" praises every correct answer; "normal" praises
 * periodically (every 3rd, starting with the first) so success
 * stays EARNED rather than patronizing.
 */
export function shouldPraiseCorrect(
    intensity: FeedbackIntensity,
    correctIndex: number,
): boolean {
    if (intensity === "subtle") return false;
    if (intensity === "enthusiastic") return true;
    return correctIndex % 3 === 0;
}

// Session-local count of correct answers seen, used for the
// "normal" intensity frequency control. Not persisted; resets on
// reload or via ``resetCorrectAnswerCount``.
let _correctAnswerCount = 0;

/** Return the current 0-based correct-answer index for this
 *  session, then advance the counter. */
export function nextCorrectAnswerIndex(): number {
    return _correctAnswerCount++;
}

/** Reset the session-local correct-answer counter (tests + new
 *  sessions). */
export function resetCorrectAnswerCount(): void {
    _correctAnswerCount = 0;
}
