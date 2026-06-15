/**
 * HintButton tests (#590).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import HintButton from "./HintButton";

describe("HintButton", () => {
    it("renders nothing with no hints", () => {
        const {container} = render(
            <HintButton hints={[]} revealLabel="Hint" />,
        );
        expect(container.firstChild).toBeNull();
    });

    it("reveals hints one at a time and fires onReveal", () => {
        const onReveal = vi.fn();
        render(
            <HintButton
                hints={["first hint", "second hint"]}
                revealLabel="Hint"
                costLabel="−5 XP"
                onReveal={onReveal}
                testId="h"
            />,
        );
        expect(screen.queryByTestId("h-hint-0")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("h-reveal"));
        expect(screen.getByTestId("h-hint-0")).toHaveTextContent("first hint");
        expect(onReveal).toHaveBeenLastCalledWith(0);
        fireEvent.click(screen.getByTestId("h-reveal"));
        expect(screen.getByTestId("h-hint-1")).toHaveTextContent("second hint");
        expect(onReveal).toHaveBeenLastCalledWith(1);
        // all revealed → reveal button gone
        expect(screen.queryByTestId("h-reveal")).not.toBeInTheDocument();
    });

    it("shows the cost chip only when provided", () => {
        render(<HintButton hints={["x"]} revealLabel="Hint" testId="h2" />);
        expect(screen.getByTestId("h2-reveal")).not.toHaveTextContent("XP");
    });
});
