import {describe, it, expect, vi, beforeEach} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";

import AnimatedCounter from "./AnimatedCounter";

beforeEach(() => {
    cleanup();
    // happy-dom: default matchMedia → not reduced unless stubbed.
    vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({matches: false, addEventListener() {}, removeEventListener() {}})),
    );
});

describe("AnimatedCounter", () => {
    it("renders the target immediately when disabled", () => {
        render(<AnimatedCounter value={42} enabled={false} />);
        expect(screen.getByTestId("animated-counter")).toHaveTextContent("42");
    });

    it("jumps to the target under reduced motion", () => {
        vi.stubGlobal(
            "matchMedia",
            vi.fn(() => ({matches: true, addEventListener() {}, removeEventListener() {}})),
        );
        render(<AnimatedCounter value={99} />);
        expect(screen.getByTestId("animated-counter")).toHaveTextContent("99");
    });

    it("applies the format function", () => {
        render(
            <AnimatedCounter
                value={5}
                enabled={false}
                format={(n) => `+${n} XP`}
            />,
        );
        expect(screen.getByTestId("animated-counter")).toHaveTextContent(
            "+5 XP",
        );
    });

    it("renders 0 immediately for a non-positive target", () => {
        render(<AnimatedCounter value={0} />);
        expect(screen.getByTestId("animated-counter")).toHaveTextContent("0");
    });

    it("forwards an aria-label", () => {
        render(<AnimatedCounter value={3} enabled={false} ariaLabel="XP gain" />);
        expect(screen.getByTestId("animated-counter")).toHaveAttribute(
            "aria-label",
            "XP gain",
        );
    });
});
