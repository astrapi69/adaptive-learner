/**
 * Phase 6D smoke: Curriculum CRUD round-trip. Creates a
 * curriculum, adds a root topic, adds a lesson, asserts both
 * end up rendered.
 */

import {expect, test} from "@playwright/test";

import {completeOnboarding} from "../helpers/onboarding";

test.describe("Curriculum + topics + lessons", () => {
    test("create curriculum → add topic → add lesson", async ({page}) => {
        await completeOnboarding(page, {name: "Curriculum Smoke"});
        // The onboarding helper leaves us on /assessment; skip
        // straight to /curriculum without finishing the
        // assessment — Curriculum only needs user_id, not a
        // profile.
        await page.goto("/curriculum");
        await expect(page.getByTestId("curriculum")).toBeVisible();

        // Create a curriculum.
        await page.getByTestId("curriculum-new-title").fill("Smoke Calculus");
        await page.getByTestId("curriculum-create").click();
        await expect(page.getByTestId("curriculum-empty")).toBeVisible();

        // Add a root topic.
        await page.getByTestId("curriculum-add-root").click();
        await page.getByTestId("add-topic-input").fill("Limits");
        await page.getByTestId("add-topic-submit").click();
        await expect(page.getByTestId("topic-tree")).toBeVisible();
        await expect(page.getByText("Limits")).toBeVisible();

        // Add a lesson.
        await page.getByTestId("lesson-new-title").fill("Lesson 1: intro");
        await page.getByTestId("lesson-create").click();
        await expect(page.getByText("Lesson 1: intro")).toBeVisible();
    });
});
