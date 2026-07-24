import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router";

import TrainErrorsButton from "./TrainErrorsButton";

function renderButton(props: Parameters<typeof TrainErrorsButton>[0]) {
    return render(
        <MemoryRouter>
            <TrainErrorsButton {...props} />
        </MemoryRouter>,
    );
}

describe("TrainErrorsButton (#1012)", () => {
    it("renders nothing when there are no error cards", () => {
        const {container} = renderButton({setId: "psych", errorCount: 0});
        expect(container.firstChild).toBeNull();
    });

    it("renders nothing for a negative count", () => {
        const {container} = renderButton({setId: "psych", errorCount: -1});
        expect(container.firstChild).toBeNull();
    });

    it("links to the set-wide adaptive lesson with the count", () => {
        renderButton({setId: "psych", errorCount: 4});
        const link = screen.getByTestId("set-train-errors-psych");
        expect(link).toHaveAttribute("href", "/adaptive-lesson/psych");
        expect(link).toHaveTextContent("4");
        // #779 — button-styled link must opt out of the global anchor color.
        expect(link).toHaveAttribute("data-slot", "button");
    });

    it("scopes to a single lesson via ?lesson= when lessonId is given", () => {
        renderButton({setId: "psych", lessonId: "03.json", errorCount: 2});
        const link = screen.getByTestId("lesson-train-errors-03.json");
        expect(link).toHaveAttribute(
            "href",
            "/adaptive-lesson/psych?lesson=03.json",
        );
        expect(link).toHaveTextContent("2");
    });

    it("honours an explicit testId override", () => {
        renderButton({setId: "psych", errorCount: 1, testId: "custom-id"});
        expect(screen.getByTestId("custom-id")).toBeInTheDocument();
    });
});
