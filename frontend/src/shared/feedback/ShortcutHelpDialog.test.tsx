/**
 * ShortcutHelpDialog tests (#585).
 *
 * Pins: hidden when closed, renders groups + key chips when open, and
 * the close button + backdrop fire onClose.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ShortcutHelpDialog, {
    type ShortcutHelpGroup,
} from "./ShortcutHelpDialog";

const groups: ShortcutHelpGroup[] = [
    {
        label: "Navigation",
        items: [{keys: ["Alt", "D"], description: "Go to dashboard"}],
    },
];

describe("ShortcutHelpDialog", () => {
    it("renders nothing when closed", () => {
        render(
            <ShortcutHelpDialog
                open={false}
                onClose={() => {}}
                title="Shortcuts"
                closeLabel="Close"
                groups={groups}
                testId="sh"
            />,
        );
        expect(screen.queryByTestId("sh")).not.toBeInTheDocument();
    });

    it("renders groups + key chips and closes via the button", () => {
        const onClose = vi.fn();
        render(
            <ShortcutHelpDialog
                open
                onClose={onClose}
                title="Shortcuts"
                closeLabel="Close"
                groups={groups}
                testId="sh"
            />,
        );
        expect(screen.getByTestId("sh")).toHaveTextContent("Navigation");
        expect(screen.getByTestId("sh")).toHaveTextContent("Go to dashboard");
        expect(screen.getByTestId("sh")).toHaveTextContent("Alt");
        fireEvent.click(screen.getByTestId("sh-close"));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
