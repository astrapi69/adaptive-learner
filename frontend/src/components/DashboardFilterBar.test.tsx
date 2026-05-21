/**
 * DashboardFilterBar tests (Phase 22E).
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";

import DashboardFilterBar, {applyFilter} from "./DashboardFilterBar";
import {I18nProvider} from "../hooks/useI18n";
import {_resetDbForTests} from "../storage/db";
import {_resetStorageCacheForTests, getStorage} from "../storage";
import type {LearningProject} from "../types/domain";

vi.mock("../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

async function seedScenario(): Promise<{
    userId: string;
    spanishProject: LearningProject;
    pythonProject: LearningProject;
    examTag: {id: string};
    languageSubject: {id: string};
}> {
    const storage = getStorage();
    const user = await storage.users.create({name: "Polyglot"});
    const spanish = await storage.users.projects.create(user.id, {
        topic: "Spanish Grammar",
        goal: "Master Spanish",
        timeframe: "3m",
        daily_minutes: 30,
    });
    const python = await storage.users.projects.create(user.id, {
        topic: "Python Algorithms",
        goal: "Master DSA",
        timeframe: "6m",
        daily_minutes: 45,
    });
    const languageSubject = await storage.subjects.create({name: "Languages"});
    const progSubject = await storage.subjects.create({name: "Programming"});
    const examTag = await storage.tags.create(user.id, {name: "exam-prep"});
    await storage.projectTaxonomy.assignSubject(
        spanish.id,
        languageSubject.id,
    );
    await storage.projectTaxonomy.assignSubject(python.id, progSubject.id);
    await storage.projectTaxonomy.assignTag(spanish.id, examTag.id);
    await storage.projectTaxonomy.assignTag(python.id, examTag.id);
    return {
        userId: user.id,
        spanishProject: spanish,
        pythonProject: python,
        examTag: {id: examTag.id},
        languageSubject: {id: languageSubject.id},
    };
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

function renderBar(userId: string, initialEntry = "/dashboard") {
    return render(
        <I18nProvider>
            <MemoryRouter initialEntries={[initialEntry]}>
                <DashboardFilterBar userId={userId} />
            </MemoryRouter>
        </I18nProvider>,
    );
}

describe("applyFilter (unit)", () => {
    const project = (id: string, topic: string): LearningProject => ({
        id,
        user_id: "u",
        topic,
        goal: "",
        timeframe: "",
        daily_minutes: 0,
        current_problem: null,
        active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
    });

    const projects = [project("p1", "Spanish"), project("p2", "Python")];
    const index = {
        subjectsByProject: new Map([
            ["p1", new Set(["s-lang"])],
            ["p2", new Set(["s-prog"])],
        ]),
        tagsByProject: new Map([
            ["p1", new Set(["t-exam", "t-daily"])],
            ["p2", new Set(["t-exam"])],
        ]),
    };

    it("returns every project when no filter is set", () => {
        const out = applyFilter(projects, index, null, new Set());
        expect(out).toEqual(projects);
    });

    it("filters by subject", () => {
        const out = applyFilter(projects, index, "s-lang", new Set());
        expect(out.map((p) => p.id)).toEqual(["p1"]);
    });

    it("filters by tag (AND semantics across tags)", () => {
        const out = applyFilter(projects, index, null, new Set(["t-exam"]));
        expect(out.map((p) => p.id)).toEqual(["p1", "p2"]);
        const out2 = applyFilter(
            projects,
            index,
            null,
            new Set(["t-exam", "t-daily"]),
        );
        expect(out2.map((p) => p.id)).toEqual(["p1"]);
    });

    it("combines subject + tag with AND", () => {
        const out = applyFilter(
            projects,
            index,
            "s-prog",
            new Set(["t-exam"]),
        );
        expect(out.map((p) => p.id)).toEqual(["p2"]);
    });
});

describe("DashboardFilterBar", () => {
    it("lists every project when no filter", async () => {
        const {userId} = await seedScenario();
        renderBar(userId);
        await waitFor(() => {
            expect(
                screen.getByTestId("dashboard-filter-project-list"),
            ).toBeInTheDocument();
        });
        expect(screen.getByText("Spanish Grammar")).toBeInTheDocument();
        expect(screen.getByText("Python Algorithms")).toBeInTheDocument();
    });

    it("filters down to Spanish when Languages subject is picked via URL", async () => {
        const seeded = await seedScenario();
        renderBar(
            seeded.userId,
            `/dashboard?subject=${seeded.languageSubject.id}`,
        );
        await screen.findByTestId("dashboard-filter-bar");
        await waitFor(() => {
            expect(screen.getByText("Spanish Grammar")).toBeInTheDocument();
            expect(screen.queryByText("Python Algorithms")).toBeNull();
        });
    });

    it("filters to both when exam-prep tag is selected via URL", async () => {
        const seeded = await seedScenario();
        renderBar(seeded.userId, `/dashboard?tag=${seeded.examTag.id}`);
        await screen.findByTestId("dashboard-filter-bar");
        await waitFor(() => {
            expect(screen.getByText("Spanish Grammar")).toBeInTheDocument();
            expect(screen.getByText("Python Algorithms")).toBeInTheDocument();
        });
    });

    it("toggles tag selection on chip click", async () => {
        const seeded = await seedScenario();
        renderBar(seeded.userId);
        const chip = await screen.findByTestId(
            `dashboard-filter-tag-${seeded.examTag.id}`,
        );
        fireEvent.click(chip);
        await waitFor(() => {
            expect(
                screen.getByTestId(
                    `dashboard-filter-tag-${seeded.examTag.id}`,
                ).className,
            ).toMatch(/tag-badge-selected/);
        });
    });

    it("clear-filters button restores the full project list", async () => {
        const seeded = await seedScenario();
        renderBar(
            seeded.userId,
            `/dashboard?subject=${seeded.languageSubject.id}`,
        );
        // Wait for the bar to finish loading AND the filter to be applied.
        await screen.findByTestId("dashboard-filter-bar");
        await waitFor(() => {
            expect(screen.getByText("Spanish Grammar")).toBeInTheDocument();
            expect(screen.queryByText("Python Algorithms")).toBeNull();
        });
        fireEvent.click(screen.getByTestId("dashboard-filter-clear"));
        await waitFor(() => {
            expect(screen.getByText("Python Algorithms")).toBeInTheDocument();
        });
    });

    it("renders empty state when nothing matches", async () => {
        const seeded = await seedScenario();
        const phantom = await getStorage().tags.create(seeded.userId, {
            name: "phantom",
        });
        renderBar(seeded.userId, `/dashboard?tag=${phantom.id}`);
        await screen.findByTestId("dashboard-filter-bar");
        await waitFor(() => {
            expect(
                screen.getByTestId("dashboard-filter-empty"),
            ).toBeInTheDocument();
        });
    });
});
