/**
 * ProjectTaxonomy tests (Phase 22D).
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";

import ProjectTaxonomy from "./ProjectTaxonomy";
import {I18nProvider} from "../hooks/useI18n";
import {_resetDbForTests} from "../storage/db";
import {_resetStorageCacheForTests, getStorage} from "../storage";

vi.mock("../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

async function seed(): Promise<{userId: string; projectId: string}> {
    const storage = getStorage();
    const user = await storage.users.create({name: "P"});
    const project = await storage.users.projects.create(user.id, {
        topic: "Spanish",
        goal: "Goal",
        timeframe: "1m",
        daily_minutes: 15,
    });
    return {userId: user.id, projectId: project.id};
}

beforeEach(async () => {
    localStorage.setItem("adaptive-learner.storage_mode", "dexie");
    _resetStorageCacheForTests();
    await _resetDbForTests();
    const {IDBFactory} = await import("fake-indexeddb");
    (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB =
        new IDBFactory();
});

afterEach(async () => {
    await _resetDbForTests();
    localStorage.clear();
});

describe("ProjectTaxonomy", () => {
    it("renders empty state when no subjects + tags assigned", async () => {
        const {userId, projectId} = await seed();
        render(
            <I18nProvider>
                <ProjectTaxonomy projectId={projectId} userId={userId} />
            </I18nProvider>,
        );
        expect(
            await screen.findByTestId("project-taxonomy-subjects-empty"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("project-taxonomy-tags-empty"),
        ).toBeInTheDocument();
    });

    it("shows assigned subjects as chips with remove buttons", async () => {
        const {userId, projectId} = await seed();
        const subject = await getStorage().subjects.create({name: "MathAssigned"});
        await getStorage().projectTaxonomy.assignSubject(projectId, subject.id);

        render(
            <I18nProvider>
                <ProjectTaxonomy projectId={projectId} userId={userId} />
            </I18nProvider>,
        );
        const chip = await screen.findByText("MathAssigned");
        expect(chip).toBeInTheDocument();
        const remove = screen.getByTestId(
            `project-taxonomy-unassign-subject-${subject.id}`,
        );
        fireEvent.click(remove);
        await waitFor(() => {
            expect(screen.queryByText("MathAssigned")).toBeNull();
        });
    });

    it("creates and assigns a new tag in one flow", async () => {
        const {userId, projectId} = await seed();
        render(
            <I18nProvider>
                <ProjectTaxonomy projectId={projectId} userId={userId} />
            </I18nProvider>,
        );
        await screen.findByTestId("project-taxonomy-tags-empty");

        fireEvent.change(
            screen.getByTestId("project-taxonomy-tag-create-input"),
            {target: {value: "exam-prep"}},
        );
        fireEvent.click(screen.getByTestId("project-taxonomy-tag-create-submit"));

        await waitFor(() => {
            expect(screen.getByText("exam-prep")).toBeInTheDocument();
        });
        const assigned = await getStorage().projectTaxonomy.listTags(projectId);
        expect(assigned.map((t) => t.name)).toEqual(["exam-prep"]);
    });

    it("assigns an existing tag via badge click", async () => {
        const {userId, projectId} = await seed();
        const tag = await getStorage().tags.create(userId, {name: "daily"});

        render(
            <I18nProvider>
                <ProjectTaxonomy projectId={projectId} userId={userId} />
            </I18nProvider>,
        );
        const badge = await screen.findByTestId(
            `project-taxonomy-tag-toggle-${tag.id}`,
        );
        fireEvent.click(badge);
        await waitFor(async () => {
            const assigned = await getStorage().projectTaxonomy.listTags(
                projectId,
            );
            expect(assigned.length).toBe(1);
        });
        // UI shows the badge as selected after refresh().
        await waitFor(() => {
            expect(
                screen
                    .getByTestId(`project-taxonomy-tag-toggle-${tag.id}`)
                    .className,
            ).toMatch(/tag-badge-selected/);
        });
    });

    it("opens the subject picker on toggle", async () => {
        const {userId, projectId} = await seed();
        render(
            <I18nProvider>
                <ProjectTaxonomy projectId={projectId} userId={userId} />
            </I18nProvider>,
        );
        await screen.findByTestId("project-taxonomy-subjects-empty");
        expect(
            screen.queryByTestId("project-taxonomy-subject-picker"),
        ).toBeNull();
        fireEvent.click(screen.getByTestId("project-taxonomy-add-subject"));
        await waitFor(() => {
            expect(
                screen.getByTestId("project-taxonomy-subject-picker"),
            ).toBeInTheDocument();
        });
    });
});
