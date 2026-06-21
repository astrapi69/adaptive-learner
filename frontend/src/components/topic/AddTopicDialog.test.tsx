import {render, screen, fireEvent} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import AddTopicDialog from "./AddTopicDialog";

describe("AddTopicDialog", () => {
    it("renders nothing when closed", () => {
        render(
            <AddTopicDialog
                open={false}
                onCancel={() => {}}
                onSubmit={() => {}}
            />,
        );
        expect(screen.queryByTestId("add-topic-dialog")).not.toBeInTheDocument();
    });

    it("renders with the initialTitle pre-filled when opened", () => {
        render(
            <AddTopicDialog
                open
                initialTitle="Original title"
                onCancel={() => {}}
                onSubmit={() => {}}
            />,
        );
        const input = screen.getByTestId("add-topic-input") as HTMLInputElement;
        expect(input.value).toBe("Original title");
    });

    it("submit is disabled while input is empty", () => {
        render(
            <AddTopicDialog open onCancel={() => {}} onSubmit={() => {}} />,
        );
        const submit = screen.getByTestId("add-topic-submit") as HTMLButtonElement;
        expect(submit.disabled).toBe(true);
        fireEvent.change(screen.getByTestId("add-topic-input"), {
            target: {value: "X"},
        });
        expect(submit.disabled).toBe(false);
    });

    it("onSubmit fires with the trimmed title", () => {
        const onSubmit = vi.fn();
        render(<AddTopicDialog open onCancel={() => {}} onSubmit={onSubmit} />);
        fireEvent.change(screen.getByTestId("add-topic-input"), {
            target: {value: "  My topic  "},
        });
        fireEvent.click(screen.getByTestId("add-topic-submit"));
        expect(onSubmit).toHaveBeenCalledWith("My topic");
    });

    it("Cancel fires onCancel", () => {
        const onCancel = vi.fn();
        render(<AddTopicDialog open onCancel={onCancel} onSubmit={() => {}} />);
        fireEvent.click(screen.getByTestId("add-topic-cancel"));
        expect(onCancel).toHaveBeenCalled();
    });

    it("submitting disables both buttons", () => {
        render(
            <AddTopicDialog
                open
                onCancel={() => {}}
                onSubmit={() => {}}
                submitting
            />,
        );
        expect(
            (screen.getByTestId("add-topic-submit") as HTMLButtonElement).disabled,
        ).toBe(true);
        expect(
            (screen.getByTestId("add-topic-cancel") as HTMLButtonElement).disabled,
        ).toBe(true);
    });

    // Phase 39 C2 — WCAG SC 2.1.2 keyboard escape pin.
    it("Escape key fires onCancel", () => {
        const onCancel = vi.fn();
        render(<AddTopicDialog open onCancel={onCancel} onSubmit={() => {}} />);
        fireEvent.keyDown(window, {key: "Escape"});
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("Escape is ignored while submitting", () => {
        const onCancel = vi.fn();
        render(
            <AddTopicDialog
                open
                onCancel={onCancel}
                onSubmit={() => {}}
                submitting
            />,
        );
        fireEvent.keyDown(window, {key: "Escape"});
        expect(onCancel).not.toHaveBeenCalled();
    });
});
