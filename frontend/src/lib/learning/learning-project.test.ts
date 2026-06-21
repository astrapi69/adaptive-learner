/**
 * Pure tests for the LearningProject filter helpers
 * (Phase 46F.3 / v1.31.0).
 */

import { describe, it, expect } from "vitest";

import {
    filterStandardProjects,
    isStandardProject,
} from "./learning-project";
import type { LearningProject } from "../../types/domain";

function makeProject(
    overrides: Partial<LearningProject> = {},
): LearningProject {
    return {
        id: "p-1",
        user_id: "u-1",
        topic: "Topic",
        goal: "Goal",
        timeframe: "1 week",
        daily_minutes: 30,
        current_problem: null,
        active: true,
        kind: "standard",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

describe("isStandardProject", () => {
    it("returns true for standard-kind projects", () => {
        expect(isStandardProject(makeProject({ kind: "standard" }))).toBe(true);
    });

    it("returns false for content-kind pseudo-projects", () => {
        expect(isStandardProject(makeProject({ kind: "content" }))).toBe(false);
    });

    it("defaults to standard when kind is undefined (pre-v1.31.0 wire)", () => {
        const project = makeProject();
        // Simulate a response that didn't carry the new field.
        (project as unknown as { kind: undefined }).kind = undefined;
        expect(isStandardProject(project)).toBe(true);
    });
});

describe("filterStandardProjects", () => {
    it("drops content-kind projects from a mixed list", () => {
        const projects = [
            makeProject({ id: "p-1", kind: "standard" }),
            makeProject({ id: "p-2", kind: "content" }),
            makeProject({ id: "p-3", kind: "standard" }),
        ];
        const filtered = filterStandardProjects(projects);
        expect(filtered.map((p) => p.id)).toEqual(["p-1", "p-3"]);
    });

    it("returns empty when every project is the pseudo-project", () => {
        const projects = [makeProject({ kind: "content" })];
        expect(filterStandardProjects(projects)).toEqual([]);
    });

    it("returns input as-is when no pseudo-projects present", () => {
        const projects = [
            makeProject({ id: "p-1" }),
            makeProject({ id: "p-2" }),
        ];
        expect(filterStandardProjects(projects)).toHaveLength(2);
    });
});
