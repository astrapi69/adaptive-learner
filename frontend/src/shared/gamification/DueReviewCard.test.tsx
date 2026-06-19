/**
 * DueReviewCard tests (#588).
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import DueReviewCard from "./DueReviewCard";

const labels = {
    totalLabel: "due for review",
    overdueLabel: "overdue",
    startLabel: "Start review",
};

describe("DueReviewCard", () => {
    it("renders null at total 0", () => {
        const {container} = render(
            <DueReviewCard total={0} overdue={0} onStart={() => {}} {...labels} />,
        );
        expect(container.firstChild).toBeNull();
    });

    it("shows total + overdue and fires onStart", () => {
        const onStart = vi.fn();
        render(
            <DueReviewCard
                total={12}
                overdue={5}
                onStart={onStart}
                testId="due"
                {...labels}
            />,
        );
        expect(screen.getByTestId("due-total")).toHaveTextContent("12");
        expect(screen.getByTestId("due-overdue")).toHaveTextContent("5");
        fireEvent.click(screen.getByTestId("due-start"));
        expect(onStart).toHaveBeenCalledOnce();
    });

    it("hides the overdue line when overdue is 0", () => {
        render(
            <DueReviewCard
                total={3}
                overdue={0}
                onStart={() => {}}
                testId="due2"
                {...labels}
            />,
        );
        expect(screen.queryByTestId("due2-overdue")).not.toBeInTheDocument();
    });

    it("renders the secondary action and fires onSecondary (#628)", () => {
        const onSecondary = vi.fn();
        render(
            <DueReviewCard
                total={4}
                overdue={0}
                onStart={() => {}}
                secondaryLabel="Quick review"
                onSecondary={onSecondary}
                testId="due3"
                {...labels}
            />,
        );
        const secondary = screen.getByTestId("due3-secondary");
        expect(secondary).toHaveTextContent("Quick review");
        fireEvent.click(secondary);
        expect(onSecondary).toHaveBeenCalledOnce();
    });

    it("omits the secondary action when no handler is provided", () => {
        render(
            <DueReviewCard
                total={4}
                overdue={0}
                onStart={() => {}}
                secondaryLabel="Quick review"
                testId="due4"
                {...labels}
            />,
        );
        expect(screen.queryByTestId("due4-secondary")).not.toBeInTheDocument();
    });
});
