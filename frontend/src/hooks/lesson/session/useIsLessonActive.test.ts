import {describe, expect, it} from "vitest";

import {isLessonRoute, LESSON_ROUTE_PREFIXES} from "./useIsLessonActive";

describe("isLessonRoute", () => {
    it("matches the active-learning route families", () => {
        expect(
            isLessonRoute(
                "/lesson/astrapi69--adaptive-learner-content/es-a1/01.json",
            ),
        ).toBe(true);
        expect(isLessonRoute("/review/es-a1")).toBe(true);
        expect(isLessonRoute("/adaptive-lesson/es-a1")).toBe(true);
        expect(
            isLessonRoute(
                "/error-replay/astrapi69--adaptive-learner-content/es-a1/01.json",
            ),
        ).toBe(true);
    });

    // #3197 - every runner route registered in App.tsx (lines 257-264) must
    // collapse the navigation; the list here mirrors those routes on purpose
    // so a new runner without a prefix entry turns this table red.
    it.each([
        ["/lesson/es-a1-from-de/es-a1/01-greetings.json", "lesson"],
        ["/review/es-a1", "review"],
        ["/adaptive-lesson/es-a1", "adaptive lesson"],
        ["/shuffle-lesson/es-a1", "shuffle lesson"],
        ["/endless-lesson/es-a1", "endless lesson"],
        ["/error-replay/es-a1-from-de/es-a1/01-greetings.json", "error replay"],
    ])("treats %s (%s) as an active lesson route", (path) => {
        expect(isLessonRoute(path)).toBe(true);
    });

    it("does not match non-lesson routes", () => {
        for (const path of [
            "/dashboard",
            "/content",
            "/learning-path",
            "/create-lesson",
            "/settings",
            "/session",
            "/",
        ]) {
            expect(isLessonRoute(path)).toBe(false);
        }
    });

    it("is prefix-matched, so dynamic params never break detection", () => {
        for (const prefix of LESSON_ROUTE_PREFIXES) {
            expect(isLessonRoute(`${prefix}anything/here`)).toBe(true);
        }
    });

    it("does not false-positive on lookalike prefixes", () => {
        // ``/lessons`` (plural) is not a lesson route; the prefix
        // carries the trailing slash precisely to avoid this.
        expect(isLessonRoute("/lessons")).toBe(false);
        expect(isLessonRoute("/reviewer")).toBe(false);
    });
});
