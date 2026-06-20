/**
 * DashboardFilterBar tests (Phase 22E).
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";

import DashboardFilterBar, {applyFilter} from "./DashboardFilterBar";
import {I18nProvider} from "../hooks/ui/useI18n";
import {_resetDbForTests} from "../storage/db/db";
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
        kind: "standard",
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

    it("hides content-kind pseudo-projects (Phase 46F.3 / v1.31.0)", async () => {
        // Seed two standard projects + one pseudo via direct
        // Dexie put (the storage API can't create kind=content
        // — that's the backend's lazy-create path). Bar should
        // render the two standard topics and skip the pseudo.
        const seeded = await seedScenario();
        const {getDb} = await import("../storage/db/db");
        const db = getDb();
        await db.learningProjects.put({
            id: "pseudo-content",
            user_id: seeded.userId,
            topic: "Content Lessons",
            goal: "auto-managed",
            timeframe: "ongoing",
            daily_minutes: 1,
            current_problem: null,
            active: true,
            kind: "content",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        });
        renderBar(seeded.userId);
        await waitFor(() => {
            expect(
                screen.getByTestId("dashboard-filter-project-list"),
            ).toBeInTheDocument();
        });
        expect(screen.getByText("Spanish Grammar")).toBeInTheDocument();
        expect(screen.getByText("Python Algorithms")).toBeInTheDocument();
        // The pseudo-project's topic must NOT appear in the picker.
        expect(screen.queryByText("Content Lessons")).toBeNull();
    });

    it("only offers subjects attached to the user's projects (#72)", async () => {
        const {userId} = await seedScenario();
        // A global subject nobody uses must not pollute the filter.
        await getStorage().subjects.create({name: "Astrophysics"});

        renderBar(userId);
        const select = (await screen.findByTestId(
            "dashboard-filter-subject-select",
        )) as HTMLSelectElement;
        await waitFor(() => {
            expect(select.querySelectorAll("option").length).toBeGreaterThan(1);
        });
        const options = Array.from(select.querySelectorAll("option")).map(
            (o) => o.textContent ?? "",
        );
        // The placeholder + the two attached subjects (Languages,
        // Programming) — exactly three options. Seeded subject names are
        // translated via subjects.* (#80), so assert by structure rather
        // than the English label. The unused global subject is custom
        // (no catalog key) and renders verbatim, so its absence is a
        // direct text check.
        expect(options.length).toBe(3);
        expect(options.some((o) => o.includes("Astrophysics"))).toBe(false);
    });

    it("hides the subject filter entirely when no project has a subject (#72)", async () => {
        const storage = getStorage();
        const user = await storage.users.create({name: "Solo"});
        await storage.users.projects.create(user.id, {
            topic: "Untagged goal",
            goal: "x",
            timeframe: "1m",
            daily_minutes: 10,
        });
        // A global subject exists but is attached to no project.
        await storage.subjects.create({name: "Astrophysics"});

        renderBar(user.id);
        await waitFor(() => {
            expect(
                screen.getByTestId("dashboard-filter-project-list"),
            ).toBeInTheDocument();
        });
        expect(
            screen.queryByTestId("dashboard-filter-subject-select"),
        ).toBeNull();
    });

    it("hides the subject filter when the user has only one subject (#111)", async () => {
        const storage = getStorage();
        const user = await storage.users.create({name: "Mono"});
        const project = await storage.users.projects.create(user.id, {
            topic: "Single",
            goal: "x",
            timeframe: "1m",
            daily_minutes: 10,
        });
        const only = await storage.subjects.create({name: "Languages"});
        await storage.projectTaxonomy.assignSubject(project.id, only.id);

        renderBar(user.id);
        await waitFor(() => {
            expect(
                screen.getByTestId("dashboard-filter-project-list"),
            ).toBeInTheDocument();
        });
        // A filter with a single option is not a filter — it is hidden.
        expect(
            screen.queryByTestId("dashboard-filter-subject-select"),
        ).toBeNull();
    });
});
