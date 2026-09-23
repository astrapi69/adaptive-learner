import {describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen} from "@testing-library/react";

import ResetSetResultsDialog from "./ResetSetResultsDialog";

const summary = {progressIds: ["a", "b", "c"], lessonCount: 3, averagePercent: 58};

function renderDialog(overrides: Partial<Parameters<typeof ResetSetResultsDialog>[0]> = {}) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const utils = render(
        <ResetSetResultsDialog
            open
            setTitle="Psychologie"
            summary={summary}
            busy={false}
            onConfirm={onConfirm}
            onCancel={onCancel}
            {...overrides}
        />,
    );
    return {...utils, onConfirm, onCancel};
}

describe("ResetSetResultsDialog (#3171)", () => {
    it("names the set, the lesson count and the current average", () => {
        renderDialog();
        const dialog = screen.getByTestId("reset-set-results-confirm");
        expect(dialog).toHaveTextContent("Psychologie");
        expect(dialog).toHaveTextContent("3");
        expect(screen.getByTestId("reset-set-results-average")).toHaveTextContent("58");
    });

    it("says there is no average yet when the set has no scored lesson", () => {
        renderDialog({summary: {progressIds: [], lessonCount: 0, averagePercent: null}});
        expect(screen.getByTestId("reset-set-results-average")).not.toHaveTextContent("%");
    });

    it("keeps confirm disabled while the summary is still loading or the reset is running", () => {
        const loading = renderDialog({summary: null});
        expect(screen.getByTestId("reset-set-results-confirm-confirm")).toBeDisabled();
        loading.unmount();
        renderDialog({busy: true});
        expect(screen.getByTestId("reset-set-results-confirm-confirm")).toBeDisabled();
    });

    it("reports confirm and cancel through the callbacks", () => {
        const {onConfirm, onCancel} = renderDialog();
        fireEvent.click(screen.getByTestId("reset-set-results-confirm-confirm"));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId("reset-set-results-confirm-cancel"));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("renders nothing while closed", () => {
        renderDialog({open: false});
        expect(screen.queryByTestId("reset-set-results-confirm")).toBeNull();
    });
});
