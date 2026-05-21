import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import LessonList from "./LessonList";
import type {Lesson} from "../types";

function lesson(id: string, title: string, content = ""): Lesson {
    return {
        id,
        curriculum_id: "c1",
        title,
        content,
        order_index: 0,
        created_at: "2026-05-18T00:00:00Z",
        updated_at: "2026-05-18T00:00:00Z",
    };
}

describe("LessonList", () => {
    it("renders empty state when no lessons", () => {
        render(
            <LessonList
                lessons={[]}
                onCreate={async () => {}}
                onUpdate={async () => {}}
                onDelete={async () => {}}
            />,
        );
        expect(screen.getByTestId("lesson-list-empty")).toBeInTheDocument();
    });

    it("renders a row per lesson with title + read-only content editor", async () => {
        const lessons = [
            lesson("l1", "Limits", "Body of l1."),
            lesson("l2", "Continuity"),
        ];
        render(
            <LessonList
                lessons={lessons}
                onCreate={async () => {}}
                onUpdate={async () => {}}
                onDelete={async () => {}}
            />,
        );
        expect(screen.getByTestId("lesson-row-l1")).toBeInTheDocument();
        expect(screen.getByTestId("lesson-row-l2")).toBeInTheDocument();
        // Read-only RichTextEditor renders the legacy plain-text
        // content. The text shows up inside the editor's content
        // surface.
        await waitFor(() =>
            expect(
                screen.getByTestId("lesson-content-l1-content").textContent,
            ).toContain("Body of l1."),
        );
        // l2 has no content -> no read-only editor mounted.
        expect(screen.queryByTestId("lesson-content-l2-root")).toBeNull();
    });

    it("Create form is disabled until the input has content", () => {
        const onCreate = vi.fn(async () => {});
        render(
            <LessonList
                lessons={[]}
                onCreate={onCreate}
                onUpdate={async () => {}}
                onDelete={async () => {}}
            />,
        );
        const btn = screen.getByTestId("lesson-create") as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
        fireEvent.change(screen.getByTestId("lesson-new-title"), {
            target: {value: "New lesson"},
        });
        expect(btn.disabled).toBe(false);
    });

    it("Create submission fires onCreate with the trimmed title", async () => {
        const onCreate = vi.fn(async () => {});
        render(
            <LessonList
                lessons={[]}
                onCreate={onCreate}
                onUpdate={async () => {}}
                onDelete={async () => {}}
            />,
        );
        fireEvent.change(screen.getByTestId("lesson-new-title"), {
            target: {value: "  My lesson  "},
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId("lesson-create"));
        });
        expect(onCreate).toHaveBeenCalledWith("My lesson");
    });

    it("Edit reveals the title input + rich-text editor + toolbar", async () => {
        render(
            <LessonList
                lessons={[lesson("l1", "Old", "Legacy body.")]}
                onCreate={async () => {}}
                onUpdate={async () => {}}
                onDelete={async () => {}}
            />,
        );
        fireEvent.click(screen.getByTestId("lesson-edit-l1"));
        const title = screen.getByTestId("lesson-edit-title-l1") as HTMLInputElement;
        expect(title.value).toBe("Old");
        await waitFor(() =>
            expect(
                screen.getByTestId("lesson-edit-content-l1-root"),
            ).toBeTruthy(),
        );
        // Toolbar mounts in edit mode too.
        await waitFor(() =>
            expect(
                screen.getByTestId("lesson-edit-toolbar-l1-root"),
            ).toBeTruthy(),
        );
        // The editor renders the legacy plain-text content
        // wrapped as a paragraph.
        expect(
            screen.getByTestId("lesson-edit-content-l1-content").textContent,
        ).toContain("Legacy body.");
    });

    it("Save fires onUpdate with the (possibly migrated) content string", async () => {
        const onUpdate =
            vi.fn<(id: string, title: string, content: string) => Promise<void>>(
                async () => {},
            );
        render(
            <LessonList
                lessons={[lesson("l1", "Old", "Legacy body.")]}
                onCreate={async () => {}}
                onUpdate={onUpdate}
                onDelete={async () => {}}
            />,
        );
        fireEvent.click(screen.getByTestId("lesson-edit-l1"));
        await waitFor(() =>
            expect(
                screen.getByTestId("lesson-edit-content-l1-root"),
            ).toBeTruthy(),
        );
        // Change title, leave content untouched.
        fireEvent.change(screen.getByTestId("lesson-edit-title-l1"), {
            target: {value: "Renamed"},
        });
        await act(async () => {
            fireEvent.click(screen.getByTestId("lesson-edit-save-l1"));
        });
        await waitFor(() => expect(onUpdate).toHaveBeenCalled());
        const [id, newTitle, newContent] = onUpdate.mock.calls[0];
        expect(id).toBe("l1");
        expect(newTitle).toBe("Renamed");
        // Legacy plain text gets migrated to TipTap JSON on save.
        // Verify the new shape is valid JSON wrapping a doc.
        const parsed = JSON.parse(newContent);
        expect(parsed.type).toBe("doc");
        expect(JSON.stringify(parsed)).toContain("Legacy body.");
    });

    it("Edit cancel exits edit mode without firing onUpdate", () => {
        const onUpdate = vi.fn(async () => {});
        render(
            <LessonList
                lessons={[lesson("l1", "Old")]}
                onCreate={async () => {}}
                onUpdate={onUpdate}
                onDelete={async () => {}}
            />,
        );
        fireEvent.click(screen.getByTestId("lesson-edit-l1"));
        fireEvent.click(screen.getByTestId("lesson-edit-cancel-l1"));
        expect(
            screen.queryByTestId("lesson-edit-title-l1"),
        ).not.toBeInTheDocument();
        expect(onUpdate).not.toHaveBeenCalled();
    });

    it("Delete fires onDelete with the lesson id", async () => {
        const onDelete = vi.fn(async () => {});
        render(
            <LessonList
                lessons={[lesson("l1", "Doomed")]}
                onCreate={async () => {}}
                onUpdate={async () => {}}
                onDelete={onDelete}
            />,
        );
        await act(async () => {
            fireEvent.click(screen.getByTestId("lesson-delete-l1"));
        });
        await waitFor(() => expect(onDelete).toHaveBeenCalledWith("l1"));
    });
});
