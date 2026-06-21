import {render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import ErrorBoundary from "./ErrorBoundary";

function Boom(): never {
    throw new Error("boom in render");
}

describe("ErrorBoundary", () => {
    beforeEach(() => {
        // The boundary logs via console.error in componentDidCatch.
        // Silence it for test output cleanliness; production
        // behaviour is unchanged.
        vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders children when nothing throws", () => {
        render(
            <ErrorBoundary>
                <div data-testid="child">ok</div>
            </ErrorBoundary>,
        );
        expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("renders the default fallback when a child throws", () => {
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>,
        );
        const fallback = screen.getByTestId("error-boundary");
        expect(fallback).toBeInTheDocument();
        expect(fallback.textContent).toContain("boom in render");
    });

    it("invokes the custom fallback when provided", () => {
        render(
            <ErrorBoundary fallback={(error) => <div data-testid="custom">{error.message}</div>}>
                <Boom />
            </ErrorBoundary>,
        );
        const custom = screen.getByTestId("custom");
        expect(custom.textContent).toBe("boom in render");
    });
});
