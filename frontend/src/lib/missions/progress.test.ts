/**
 * Q-121: mission progress evaluation tests.
 */

import {describe, expect, it} from "vitest";

import {evaluateProgress, readStat} from "./progress";
import type {MissionStats, MissionTemplate} from "./types";

function emptyStats(): MissionStats {
    return {
        lessons_completed_today: 0,
        lessons_min_2_stars_today: 0,
        lessons_min_3_stars_today: 0,
        new_sets_started_today: 0,
        elements_reviewed_today: 0,
        review_sessions_completed_today: 0,
        overdue_cleared_today: 0,
        elements_mastered_today: 0,
        perfect_lessons_today: 0,
        adaptive_lessons_started_today: 0,
        cloze_exercises_today: 0,
        exercise_types_used_today: 0,
        minutes_learned_today: 0,
        streak_kept_today: 0,
        current_streak_days: 0,
        weekend_learning_today: 0,
    };
}

const COMPLETE_3: MissionTemplate = {
    id: "complete-3-lessons",
    title_key: "x",
    description_key: "x",
    category: "learning",
    target_value: 3,
    difficulty: "hard",
    xp_reward: 60,
    icon: "book-open",
    check_function: "lessons_completed_today",
};

describe("evaluateProgress", () => {
    it("reports partial progress, clamped, not yet complete", () => {
        const stats = {...emptyStats(), lessons_completed_today: 2};
        expect(evaluateProgress(COMPLETE_3, stats)).toEqual({
            current: 2,
            target: 3,
            completed: false,
        });
    });

    it("completes at the target", () => {
        const stats = {...emptyStats(), lessons_completed_today: 3};
        expect(evaluateProgress(COMPLETE_3, stats)).toEqual({
            current: 3,
            target: 3,
            completed: true,
        });
    });

    it("clamps current to the target when exceeded", () => {
        const stats = {...emptyStats(), lessons_completed_today: 9};
        const p = evaluateProgress(COMPLETE_3, stats);
        expect(p.current).toBe(3);
        expect(p.completed).toBe(true);
    });

    it("unknown check function reads 0", () => {
        expect(readStat("nope", emptyStats())).toBe(0);
    });
});
