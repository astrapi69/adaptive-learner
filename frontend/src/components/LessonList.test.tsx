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

    it("renders a row per lesson with title + content", () => {
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
        expect(screen.getByText("Body of l1.")).toBeInTheDocument();
        // l2 has no content; the <p> stays hidden so the row is
        // visually tighter.
        expect(screen.queryByText(/Continuity body/)).not.toBeInTheDocument();
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

    it("Edit reveals title + content inputs, save fires onUpdate", async () => {
        const onUpdate = vi.fn(async () => {});
        render(
            <LessonList
                lessons={[lesson("l1", "Old", "Body.")]}
                onCreate={async () => {}}
                onUpdate={onUpdate}
                onDelete={async () => {}}
            />,
        );
        fireEvent.click(screen.getByTestId("lesson-edit-l1"));
        const title = screen.getByTestId("lesson-edit-title-l1") as HTMLInputElement;
        const content = screen.getByTestId("lesson-edit-content-l1") as HTMLTextAreaElement;
        // Pre-filled with current values.
        expect(title.value).toBe("Old");
        expect(content.value).toBe("Body.");
        fireEvent.change(title, {target: {value: "New"}});
        fireEvent.change(content, {target: {value: "Updated body."}});
        await act(async () => {
            fireEvent.click(screen.getByTestId("lesson-edit-save-l1"));
        });
        expect(onUpdate).toHaveBeenCalledWith("l1", "New", "Updated body.");
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
