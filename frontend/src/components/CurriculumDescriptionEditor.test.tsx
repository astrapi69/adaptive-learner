import {render, screen, fireEvent, waitFor, act} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import CurriculumDescriptionEditor from "./CurriculumDescriptionEditor";

describe("CurriculumDescriptionEditor", () => {
    it("renders the empty-state placeholder + Add button when description is null", () => {
        render(
            <CurriculumDescriptionEditor
                description={null}
                onSave={async () => {}}
            />,
        );
        expect(
            screen.getByTestId("curriculum-description-empty"),
        ).toBeInTheDocument();
        const editBtn = screen.getByTestId(
            "curriculum-description-edit",
        ) as HTMLButtonElement;
        expect(editBtn.textContent).toMatch(/add/i);
    });

    it("renders the read-only editor when description carries content", async () => {
        render(
            <CurriculumDescriptionEditor
                description="A short summary."
                onSave={async () => {}}
            />,
        );
        await waitFor(() =>
            expect(
                screen.getByTestId("curriculum-description-view-content"),
            ).toBeTruthy(),
        );
        expect(
            screen.getByTestId("curriculum-description-view-content").textContent,
        ).toContain("A short summary.");
        const editBtn = screen.getByTestId(
            "curriculum-description-edit",
        ) as HTMLButtonElement;
        expect(editBtn.textContent).toMatch(/edit/i);
    });

    it("clicking Edit reveals the toolbar + editable surface", async () => {
        render(
            <CurriculumDescriptionEditor
                description={null}
                onSave={async () => {}}
            />,
        );
        fireEvent.click(screen.getByTestId("curriculum-description-edit"));
        await waitFor(() =>
            expect(
                screen.getByTestId(
                    "curriculum-description-edit-editor-root",
                ),
            ).toBeTruthy(),
        );
        expect(
            screen.getByTestId("curriculum-description-toolbar-root"),
        ).toBeTruthy();
        expect(
            screen.getByTestId("curriculum-description-save"),
        ).toBeTruthy();
        expect(
            screen.getByTestId("curriculum-description-cancel"),
        ).toBeTruthy();
    });

    it("Save fires onSave with serialised TipTap JSON for non-empty content", async () => {
        const onSave = vi.fn<(next: string | null) => Promise<void>>(
            async () => {},
        );
        render(
            <CurriculumDescriptionEditor
                description="Original."
                onSave={onSave}
            />,
        );
        fireEvent.click(screen.getByTestId("curriculum-description-edit"));
        await waitFor(() =>
            expect(
                screen.getByTestId(
                    "curriculum-description-edit-editor-root",
                ),
            ).toBeTruthy(),
        );
        await act(async () => {
            fireEvent.click(screen.getByTestId("curriculum-description-save"));
        });
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        const next = onSave.mock.calls[0][0];
        // Legacy "Original." -> migrated to TipTap JSON on save.
        expect(next).not.toBeNull();
        const parsed = JSON.parse(next!);
        expect(parsed.type).toBe("doc");
        expect(JSON.stringify(parsed)).toContain("Original.");
    });

    it("Save fires onSave with null when the editor is empty", async () => {
        const onSave = vi.fn<(next: string | null) => Promise<void>>(
            async () => {},
        );
        render(
            <CurriculumDescriptionEditor
                description={null}
                onSave={onSave}
            />,
        );
        fireEvent.click(screen.getByTestId("curriculum-description-edit"));
        await waitFor(() =>
            expect(
                screen.getByTestId(
                    "curriculum-description-edit-editor-root",
                ),
            ).toBeTruthy(),
        );
        await act(async () => {
            fireEvent.click(screen.getByTestId("curriculum-description-save"));
        });
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        expect(onSave.mock.calls[0][0]).toBeNull();
    });

    it("Cancel exits edit mode without firing onSave", async () => {
        const onSave = vi.fn(async () => {});
        render(
            <CurriculumDescriptionEditor
                description="Stay."
                onSave={onSave}
            />,
        );
        fireEvent.click(screen.getByTestId("curriculum-description-edit"));
        await waitFor(() =>
            expect(
                screen.getByTestId(
                    "curriculum-description-edit-editor-root",
                ),
            ).toBeTruthy(),
        );
        fireEvent.click(screen.getByTestId("curriculum-description-cancel"));
        await waitFor(() =>
            expect(
                screen.queryByTestId(
                    "curriculum-description-edit-editor-root",
                ),
            ).toBeNull(),
        );
        expect(onSave).not.toHaveBeenCalled();
        // View mode is back; the read-only editor renders.
        await waitFor(() =>
            expect(
                screen.getByTestId("curriculum-description-view-content"),
            ).toBeTruthy(),
        );
    });

    it("external description prop change updates the view surface", async () => {
        const {rerender} = render(
            <CurriculumDescriptionEditor
                description="First curriculum."
                onSave={async () => {}}
            />,
        );
        await waitFor(() =>
            expect(
                screen.getByTestId("curriculum-description-view-content")
                    .textContent,
            ).toContain("First curriculum."),
        );
        rerender(
            <CurriculumDescriptionEditor
                description="Second curriculum."
                onSave={async () => {}}
            />,
        );
        await waitFor(() =>
            expect(
                screen.getByTestId("curriculum-description-view-content")
                    .textContent,
            ).toContain("Second curriculum."),
        );
    });
});
