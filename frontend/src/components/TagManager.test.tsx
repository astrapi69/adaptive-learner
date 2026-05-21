/**
 * TagManager tests (Phase 22D).
 */

import "fake-indexeddb/auto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";

import TagManager from "./TagManager";
import {I18nProvider} from "../hooks/useI18n";
import {_resetDbForTests} from "../storage/db";
import {_resetStorageCacheForTests, getStorage} from "../storage";

vi.mock("../utils/notify", () => ({
    notify: {error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn()},
}));

const USER_ID_PLACEHOLDER = "user-dummy";

async function seedUser(): Promise<string> {
    return (await getStorage().users.create({name: "Tagger"})).id;
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

function renderManager(
    userId = USER_ID_PLACEHOLDER,
    props: Partial<React.ComponentProps<typeof TagManager>> = {},
) {
    return render(
        <I18nProvider>
            <TagManager userId={userId} {...props} />
        </I18nProvider>,
    );
}

describe("TagManager", () => {
    it("renders empty state when user has no tags", async () => {
        const userId = await seedUser();
        renderManager(userId);
        expect(
            await screen.findByTestId("tag-manager-empty"),
        ).toBeInTheDocument();
    });

    it("creates a new tag and shows it as a badge", async () => {
        const userId = await seedUser();
        renderManager(userId);
        await screen.findByTestId("tag-manager-empty");
        fireEvent.change(screen.getByTestId("tag-create-input"), {
            target: {value: "exam-prep"},
        });
        fireEvent.click(screen.getByTestId("tag-create-submit"));
        await waitFor(() => {
            expect(screen.getByText("exam-prep")).toBeInTheDocument();
        });
    });

    it("renames a tag", async () => {
        const userId = await seedUser();
        const tag = await getStorage().tags.create(userId, {name: "old"});
        renderManager(userId);
        await screen.findByText("old");
        fireEvent.click(screen.getByTestId(`tag-rename-${tag.id}`));
        fireEvent.change(screen.getByTestId(`tag-rename-input-${tag.id}`), {
            target: {value: "renamed"},
        });
        fireEvent.submit(
            screen.getByTestId(`tag-rename-input-${tag.id}`).closest("form")!,
        );
        await waitFor(() => {
            expect(screen.getByText("renamed")).toBeInTheDocument();
        });
    });

    it("deletes a tag after confirm", async () => {
        const userId = await seedUser();
        const tag = await getStorage().tags.create(userId, {name: "transient"});
        // happy-dom does not ship a real window.confirm; stub one.
        const originalConfirm = window.confirm;
        window.confirm = vi.fn(() => true) as unknown as typeof window.confirm;
        renderManager(userId);
        await screen.findByText("transient");
        fireEvent.click(screen.getByTestId(`tag-delete-${tag.id}`));
        await waitFor(() => {
            expect(screen.queryByText("transient")).toBeNull();
        });
        window.confirm = originalConfirm;
    });

    it("fires onToggleSelected on badge click", async () => {
        const userId = await seedUser();
        const tag = await getStorage().tags.create(userId, {name: "selectable"});
        const onToggleSelected = vi.fn();
        renderManager(userId, {onToggleSelected});
        const badge = await screen.findByTestId(`tag-badge-${tag.id}`);
        fireEvent.click(badge);
        expect(onToggleSelected).toHaveBeenCalledWith(tag.id);
    });

    it("hides create form in readOnly mode", async () => {
        const userId = await seedUser();
        await getStorage().tags.create(userId, {name: "anything"});
        renderManager(userId, {readOnly: true});
        await screen.findByText("anything");
        expect(screen.queryByTestId("tag-create-form")).toBeNull();
        expect(screen.queryByTestId("tag-rename-anything")).toBeNull();
    });
});
