/**
 * SubjectBrowser tests (Phase 22D).
 *
 * Drives the dexie storage backing via fake-indexeddb so the
 * component's full add/list/filter round-trip exercises the same
 * code path as production.
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";

import SubjectBrowser, {filterSubjects} from "./SubjectBrowser";
import {I18nProvider} from "../hooks/useI18n";
import {_resetDbForTests} from "../storage/db";
import {_resetStorageCacheForTests, getStorage} from "../storage";
import type {Subject} from "../types/domain";

vi.mock("../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

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

function renderBrowser(
    props: Partial<React.ComponentProps<typeof SubjectBrowser>> = {},
) {
    return render(
        <I18nProvider>
            <SubjectBrowser {...props} />
        </I18nProvider>,
    );
}

describe("SubjectBrowser", () => {
    it("renders empty state when no subjects exist", async () => {
        renderBrowser();
        expect(
            await screen.findByTestId("subject-browser-empty"),
        ).toBeInTheDocument();
    });

    it("shows seeded subjects as a tree", async () => {
        const storage = getStorage();
        const lang = await storage.subjects.create({name: "Languages"});
        const spanish = await storage.subjects.create({
            name: "Spanish",
            parent_id: lang.id,
        });
        renderBrowser();
        expect(
            await screen.findByTestId(`subject-row-${lang.id}`),
        ).toBeInTheDocument();
        expect(
            await screen.findByTestId(`subject-row-${spanish.id}`),
        ).toBeInTheDocument();
    });

    it("filters by case-insensitive search and keeps ancestor path", async () => {
        const storage = getStorage();
        const lang = await storage.subjects.create({name: "Languages"});
        const spanish = await storage.subjects.create({
            name: "Spanish",
            parent_id: lang.id,
        });
        const math = await storage.subjects.create({name: "Mathematics"});

        renderBrowser();
        await screen.findByTestId(`subject-row-${lang.id}`);

        const search = screen.getByTestId(
            "subject-browser-search",
        ) as HTMLInputElement;
        fireEvent.change(search, {target: {value: "spanish"}});

        await waitFor(() => {
            expect(screen.queryByTestId(`subject-row-${math.id}`)).toBeNull();
            // Spanish + parent path stay.
            expect(
                screen.getByTestId(`subject-row-${spanish.id}`),
            ).toBeInTheDocument();
            expect(
                screen.getByTestId(`subject-row-${lang.id}`),
            ).toBeInTheDocument();
        });
    });

    it("adds a new top-level subject", async () => {
        renderBrowser();
        await waitFor(() =>
            expect(screen.getByTestId("subject-browser")).toBeInTheDocument(),
        );
        fireEvent.click(screen.getByTestId("subject-browser-add-root"));
        fireEvent.change(screen.getByTestId("subject-add-input"), {
            target: {value: "New Topic"},
        });
        fireEvent.click(screen.getByTestId("subject-add-submit"));
        await waitFor(() => {
            expect(screen.getByText("New Topic")).toBeInTheDocument();
        });
    });

    it("fires onSelect with id when a row is clicked, and null on second click", async () => {
        const storage = getStorage();
        const s = await storage.subjects.create({name: "Clickable"});
        const onSelect = vi.fn();
        renderBrowser({onSelect});
        const row = await screen.findByTestId(`subject-row-${s.id}`);
        fireEvent.click(row);
        expect(onSelect).toHaveBeenCalledWith(s.id);
    });

    it("hides Add buttons in readOnly mode", async () => {
        const s = await getStorage().subjects.create({name: "ReadOnly Subject"});
        renderBrowser({readOnly: true});
        await screen.findByTestId(`subject-row-${s.id}`);
        expect(screen.queryByTestId("subject-browser-add-root")).toBeNull();
    });
});

describe("filterSubjects (unit)", () => {
    const rows: Subject[] = [
        {
            id: "lang",
            parent_id: null,
            name: "Languages",
            description: null,
            icon: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        },
        {
            id: "es",
            parent_id: "lang",
            name: "Spanish",
            description: null,
            icon: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        },
        {
            id: "math",
            parent_id: null,
            name: "Mathematics",
            description: null,
            icon: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        },
    ];

    it("keeps every row when query is empty", () => {
        expect(filterSubjects(rows, "")).toHaveLength(3);
    });

    it("matches case-insensitively", () => {
        const out = filterSubjects(rows, "SPANISH");
        expect(out.map((s) => s.id).sort()).toEqual(["es", "lang"]);
    });

    it("drops branches that don't match", () => {
        const out = filterSubjects(rows, "math");
        expect(out.map((s) => s.id)).toEqual(["math"]);
    });
});
