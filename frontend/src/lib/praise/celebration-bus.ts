/**
 * Celebration event bus (EXP-008 / Phase 55G / P-143).
 *
 * The single decoupled dispatch point for celebration triggers.
 * Producers (exercise components, the lesson summary, the
 * completion flow) call ``emitCelebration``; the bus performs the
 * cross-cutting side-effects:
 *   - plays the mapped sound effect (self-gated on the sound
 *     preference inside ``playSound``),
 *   - forwards the event to any registered subscriber.
 *
 * Milestones additionally route through the celebration queue via
 * the ``celebrate*`` helpers, gated on the effective feedback
 * intensity (so "subtle" / reduced-motion shows no overlays).
 *
 * Kept free of React + storage so any layer can emit without a
 * provider in scope; the visual animations live in the components
 * that render the result.
 */

import {playSound, type SoundName} from "../audio/sound-effects";
import {enqueueMilestone} from "../feedback/celebrationQueue";
import {
    allowsMilestones,
    effectiveIntensity,
} from "../feedback/feedbackPref";
import {
    badgeMilestone,
    detectMilestones,
    type Milestone,
    type MilestoneSnapshot,
} from "../feedback/milestones";
import {nextPraise} from "./phrase-picker";

export type CelebrationType =
    | "answer_correct"
    | "answer_wrong"
    | "stars_earned"
    | "confetti"
    | "lesson_complete"
    | "badge_earned"
    | "level_up"
    | "streak_milestone"
    | "mastery"
    | "mission_complete"
    | "all_missions_complete";

export interface CelebrationEvent {
    type: CelebrationType;
    payload?: Record<string, unknown>;
}

type Listener = (event: CelebrationEvent) => void;
const listeners = new Set<Listener>();

/** Map each celebration to the sound effect it should play.
 *  ``lesson_complete`` has no sound of its own - the 3-star case
 *  emits ``stars_earned`` separately. */
const SOUND_MAP: Partial<Record<CelebrationType, SoundName>> = {
    answer_correct: "correct_answer",
    answer_wrong: "wrong_answer",
    stars_earned: "star_earned",
    confetti: "confetti",
    badge_earned: "badge_earned",
    level_up: "level_up",
    streak_milestone: "star_earned",
    mastery: "star_earned",
    mission_complete: "badge_earned",
    all_missions_complete: "level_up",
};

/** Subscribe to celebration events. Returns an unsubscribe. */
export function subscribeCelebration(cb: Listener): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

/** Emit a celebration event: play its sound + notify listeners. */
export function emitCelebration(event: CelebrationEvent): void {
    const sound = SOUND_MAP[event.type];
    if (sound) playSound(sound);
    for (const listener of listeners) {
        try {
            listener(event);
        } catch {
            /* a faulty subscriber must not break the emit */
        }
    }
}

function milestoneEventType(milestone: Milestone): CelebrationType {
    switch (milestone.type) {
        case "level_up":
            return "level_up";
        case "streak":
            return "streak_milestone";
        case "mastery":
            return "mastery";
        case "badge":
            return "badge_earned";
    }
}

/** Queue a milestone overlay + play its sound, gated on intensity. */
export function celebrateMilestone(milestone: Milestone): void {
    if (!allowsMilestones(effectiveIntensity())) return;
    enqueueMilestone(milestone);
    emitCelebration({
        type: milestoneEventType(milestone),
        payload: {value: milestone.value},
    });
}

/** Detect + celebrate every milestone crossed between two
 *  gamification snapshots. Returns the milestones celebrated. */
export function celebrateMilestonesFromSnapshots(
    before: MilestoneSnapshot,
    after: MilestoneSnapshot,
): Milestone[] {
    if (!allowsMilestones(effectiveIntensity())) return [];
    const milestones = detectMilestones(before, after);
    for (const milestone of milestones) {
        celebrateMilestone(milestone);
    }
    return milestones;
}

/**
 * Celebrate mission completions (EXP-010 / Phase 56J). Plays the
 * mission sound, plays the bigger "all-clear" sound when every
 * mission for the day is done, and (unless intensity is "subtle")
 * returns a "mission_complete" praise phrase for the caller to
 * surface. No-op + null when nothing newly completed.
 */
export function celebrateMissions(opts: {
    newlyCompletedCount: number;
    allComplete: boolean;
    lang: string;
}): {praise: string | null; allClear: boolean} {
    if (opts.newlyCompletedCount <= 0) {
        return {praise: null, allClear: false};
    }
    emitCelebration({type: "mission_complete"});
    if (opts.allComplete) {
        emitCelebration({type: "all_missions_complete"});
    }
    let praise: string | null = null;
    if (effectiveIntensity() !== "subtle") {
        praise = nextPraise("mission_complete", opts.lang)?.phrase ?? null;
    }
    return {praise, allClear: opts.allComplete};
}

/** Celebrate a newly-earned badge (overlay + jingle). */
export function celebrateBadge(
    badgeId: string,
    name: string,
    description: string,
): void {
    celebrateMilestone(badgeMilestone(badgeId, name, description));
}
