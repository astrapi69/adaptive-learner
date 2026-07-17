import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import CombineLessonsDialog from "./CombineLessonsDialog";
import type {CombinedLanguages} from "../../../lib/content/lesson/combine-lessons";
import type {ContentSetEntry} from "../../../storage/types";

function entry(over: Partial<ContentSetEntry>): ContentSetEntry {
    return {
        source: "user-generated",
        branch: "",
        id: "created-target",
        title: "Target set",
        title_native: null,
        language: "fr",
        target_language: "fr",
        source_language: "de",
        level: "A1",
        domain: "imported",
        version: "1.0.0",
        lesson_count: 1,
        description: null,
        tags: [],
        cover_image: null,
        cached_version: "1.0.0",
        update_available: false,
        ...over,
    } as ContentSetEntry;
}

const CONSISTENT: CombinedLanguages = {
    targetLanguage: "fr",
    sourceLanguage: "de",
    level: "A1",
    consistent: true,
};

function renderDialog(over: Partial<React.ComponentProps<typeof CombineLessonsDialog>> = {}) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
        <CombineLessonsDialog
            open
            selectedCount={2}
            languages={CONSISTENT}
            existingTargets={[entry({})]}
            combining={false}
            onCancel={onCancel}
            onConfirm={onConfirm}
            {...over}
        />,
    );
    return {onConfirm, onCancel};
}

describe("CombineLessonsDialog (#1741)", () => {
    it("emits a NEW-set decision with the entered title/level", () => {
        const {onConfirm} = renderDialog();
        fireEvent.change(screen.getByTestId("combine-new-title"), {
            target: {value: "Bundle"},
        });
        fireEvent.change(screen.getByTestId("combine-new-level"), {
            target: {value: "B1"},
        });
        fireEvent.click(screen.getByTestId("combine-confirm"));
        expect(onConfirm).toHaveBeenCalledWith({
            mode: "new",
            title: "Bundle",
            description: "",
            level: "B1",
        });
    });

    it("blocks confirm until a new-set title is entered", () => {
        const {onConfirm} = renderDialog();
        expect(screen.getByTestId("combine-confirm")).toBeDisabled();
        fireEvent.change(screen.getByTestId("combine-new-title"), {
            target: {value: "X"},
        });
        expect(screen.getByTestId("combine-confirm")).not.toBeDisabled();
        fireEvent.click(screen.getByTestId("combine-confirm"));
        expect(onConfirm).toHaveBeenCalled();
    });

    it("emits an EXISTING-set decision when adding to a set (point 4)", () => {
        const target = entry({id: "created-target", title: "Target set"});
        const {onConfirm} = renderDialog({existingTargets: [target]});
        fireEvent.click(screen.getByTestId("combine-mode-existing"));
        fireEvent.click(screen.getByTestId("combine-confirm"));
        expect(onConfirm).toHaveBeenCalledWith({mode: "existing", entry: target});
    });

    it("shows a non-blocking hint when the selection is mixed", () => {
        renderDialog({
            languages: {
                targetLanguage: "fr",
                sourceLanguage: "de",
                level: "A1",
                consistent: false,
            },
        });
        expect(
            screen.getByTestId("combine-lessons-mixed-hint"),
        ).toBeInTheDocument();
    });

    it("forces new mode + disables the existing option with no targets", () => {
        renderDialog({existingTargets: []});
        expect(screen.getByTestId("combine-mode-existing")).toBeDisabled();
        // With no existing target, a title still gates a valid new set.
        fireEvent.change(screen.getByTestId("combine-new-title"), {
            target: {value: "Solo"},
        });
        expect(screen.getByTestId("combine-confirm")).not.toBeDisabled();
    });
});
